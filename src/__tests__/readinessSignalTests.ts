/**
 * readinessSignalTests — lightweight readiness stays complementary:
 *   - profile readiness replaces the old hard-coded medium baseline
 *   - quick checks can downshift but never upshift beyond the program
 *   - missing readiness input keeps the plan intact
 *
 * Run: npm run test:readiness
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  buildReadinessSignalPatch,
  deriveScheduleReadiness,
  getReadinessQuickOption,
  type ReadinessSignal,
} from '../utils/readiness';
import {
  buildReadinessActiveConstraints,
  filterConstraintsForDate,
  isReadinessConstraint,
} from '../utils/readinessConstraints';
import { routeCoachReadinessMessage } from '../utils/coachReadinessAdapter';
import { buildConstraintPlans } from '../utils/constraintPlan';
import { buildWeeklyCoachUpdateFromConstraints } from '../utils/weeklyCoachUpdate';
import type { OnboardingData } from '../types/domain';

let pass = 0;
let fail = 0;
const failures: string[] = [];
function ok(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; failures.push(name); console.log(`  ✗ ${name}${detail ? '\n      ' + detail : ''}`); }
}
function eq<T>(name: string, a: T, b: T) {
  ok(name, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function section(label: string) { console.log(`\n${label}`); }

const strongProfile: OnboardingData = {
  seasonPhase: 'Pre-season',
  recentTrainingLoad: 'Very consistent',
  conditioningLevel: 'Elite',
  sprintExposure: '2+ times per week',
  injuries: [],
  preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
  teamTrainingDaysPerWeek: 0,
  teamTrainingDays: [],
};

const rampProfile: OnboardingData = {
  seasonPhase: 'In-season',
  recentTrainingLoad: 'Hardly at all',
  conditioningLevel: 'Poor',
  sprintExposure: 'No sprint training',
  injuries: [],
  preferredTrainingDays: ['Monday', 'Wednesday'],
  teamTrainingDaysPerWeek: 1,
  teamTrainingDays: ['Thursday'],
  teamTrainingIntensity: 'Hard',
};

function signal(
  date: string,
  patch: Partial<ReadinessSignal>,
): ReadinessSignal {
  return {
    date,
    source: 'quick_check',
    updatedAt: '2026-05-19T08:00:00.000Z',
    ...patch,
  };
}

section('[1] profile baseline replaces hard-coded medium');
{
  eq('strong profile can be high', deriveScheduleReadiness({ onboardingData: strongProfile }), 'high');
  eq('ramp profile can be low', deriveScheduleReadiness({ onboardingData: rampProfile }), 'low');
  eq('missing profile falls back medium', deriveScheduleReadiness({ onboardingData: null }), 'medium');
}

section('[2] quick signal downshifts only');
{
  eq(
    'good signal keeps high profile high',
    deriveScheduleReadiness({
      onboardingData: strongProfile,
      signal: signal('2026-05-19', buildReadinessSignalPatch('good')),
    }),
    'high',
  );
  eq(
    'flat signal downshifts high to low',
    deriveScheduleReadiness({
      onboardingData: strongProfile,
      signal: signal('2026-05-19', buildReadinessSignalPatch('flat')),
    }),
    'low',
  );
  eq(
    'short-time signal trims high to medium',
    deriveScheduleReadiness({
      onboardingData: strongProfile,
      signal: signal('2026-05-19', buildReadinessSignalPatch('short_time')),
    }),
    'medium',
  );
  eq(
    'good signal never upshifts low profile',
    deriveScheduleReadiness({
      onboardingData: rampProfile,
      signal: signal('2026-05-19', buildReadinessSignalPatch('good')),
    }),
    'low',
  );
}

section('[3] quick option detection');
{
  eq('detect good', getReadinessQuickOption(signal('2026-05-19', buildReadinessSignalPatch('good'))), 'good');
  eq('detect flat', getReadinessQuickOption(signal('2026-05-19', buildReadinessSignalPatch('flat'))), 'flat');
  eq('detect sore', getReadinessQuickOption(signal('2026-05-19', buildReadinessSignalPatch('sore'))), 'sore');
  eq(
    'detect short time',
    getReadinessQuickOption(signal('2026-05-19', buildReadinessSignalPatch('short_time'))),
    'short_time',
  );
}

section('[4] quick patches clear stale fields');
{
  ok(
    'good clears short-time minutes',
    !('timeAvailableMinutes' in buildReadinessSignalPatch('good')) ||
      buildReadinessSignalPatch('good').timeAvailableMinutes === undefined,
  );
  ok(
    'short-time clears soreness',
    !('soreness' in buildReadinessSignalPatch('short_time')) ||
      buildReadinessSignalPatch('short_time').soreness === undefined,
  );
}

section('[5] readiness builds date-scoped active constraints');
{
  const flat = buildReadinessActiveConstraints(
    signal('2026-05-19', buildReadinessSignalPatch('flat')),
  );
  eq('flat emits one constraint', flat.length, 1);
  eq('flat type fatigue', flat[0]?.type, 'fatigue');
  eq('flat scoped to date', (flat[0] as any)?.appliesToDate, '2026-05-19');
  eq('flat has readiness source', (flat[0] as any)?.source, 'readiness');
  ok('flat id marked readiness', isReadinessConstraint(flat[0]));

  const sore = buildReadinessActiveConstraints(
    signal('2026-05-19', buildReadinessSignalPatch('sore')),
  );
  eq('sore emits one load constraint', sore.length, 1);
  eq('sore display label', (sore[0] as any)?.reasonLabel, 'General soreness');

  const calf = buildReadinessActiveConstraints(
    signal('2026-05-19', {
      ...buildReadinessSignalPatch('sore'),
      bodyPart: 'calves',
    }),
  );
  eq('body-part soreness emits soreness constraint', calf[0]?.type, 'soreness');
  eq('body-part soreness preserves body part', (calf[0] as any)?.bodyPart, 'calves');
  eq('body-part soreness display label', (calf[0] as any)?.reasonLabel, 'Calves soreness');

  const short = buildReadinessActiveConstraints(
    signal('2026-05-19', buildReadinessSignalPatch('short_time')),
  );
  eq('short time type schedule', short[0]?.type, 'schedule');
  eq('short time display label', (short[0] as any)?.reasonLabel, 'Short time');

  const good = buildReadinessActiveConstraints(
    signal('2026-05-19', buildReadinessSignalPatch('good')),
  );
  eq('good emits no constraint', good.length, 0);
}

section('[6] readiness constraints only apply to their date');
{
  const flat = buildReadinessActiveConstraints(
    signal('2026-05-19', buildReadinessSignalPatch('flat')),
  );
  eq('included on scoped date', filterConstraintsForDate(flat, '2026-05-19').length, 1);
  eq('excluded on other date', filterConstraintsForDate(flat, '2026-05-20').length, 0);
}

section('[7] readiness labels and weekly card scope');
{
  const flat = buildReadinessActiveConstraints(
    signal('2026-05-19', buildReadinessSignalPatch('flat')),
  );
  const plans = buildConstraintPlans(flat);
  eq('plan uses readiness display label', plans[0]?.activeIssue, 'Feeling flat — 7/10');

  const outsideWeek = buildWeeklyCoachUpdateFromConstraints({
    weekStartISO: '2026-05-18',
    visibleWeek: [{ date: '2026-05-20' } as any],
    baselineWeek: [{ date: '2026-05-20' } as any],
    activeConstraints: flat,
  });
  eq('card hidden when scoped date not in visible week', outsideWeek, null);

  const sameDay = buildWeeklyCoachUpdateFromConstraints({
    weekStartISO: '2026-05-18',
    visibleWeek: [{ date: '2026-05-19' } as any],
    baselineWeek: [{ date: '2026-05-19' } as any],
    activeConstraints: flat,
  });
  ok('card appears on scoped date', !!sameDay);
  eq('card uses readiness issue label', sameDay?.activeIssues[0], 'Feeling flat — 7/10');
}

section('[8] coach chat routes to same readiness language');
{
  const cooked = routeCoachReadinessMessage({ message: "I'm cooked today", now: 1000 });
  eq('cooked applies signal', cooked.kind, 'apply_signal');
  if (cooked.kind === 'apply_signal') {
    eq('cooked source reason', cooked.reason, 'fatigue_reported');
    eq('cooked uses flat flag', cooked.signal.flatToday, true);
    ok('cooked reply avoids max-effort copy', !/max-effort/i.test(cooked.reply));
  }

  const feelingShit = routeCoachReadinessMessage({
    message: "I'm actually feeling shit today",
    now: 1000,
  });
  eq('plain-language poor readiness applies signal', feelingShit.kind, 'apply_signal');
  if (feelingShit.kind === 'apply_signal') {
    eq('plain-language poor readiness reason', feelingShit.reason, 'fatigue_reported');
    eq('plain-language poor readiness flat flag', feelingShit.signal.flatToday, true);
  }

  const time = routeCoachReadinessMessage({ message: 'I only have 25 mins', now: 1000 });
  eq('short time applies signal', time.kind, 'apply_signal');
  if (time.kind === 'apply_signal') {
    eq('short time minutes preserved', time.signal.timeAvailableMinutes, 25);
  }

  const durationEdit = routeCoachReadinessMessage({
    message: 'Can you make it 30 mins?',
    now: 1000,
  });
  eq('program duration edit passes to coach router', durationEdit.kind, 'pass');
  if (durationEdit.kind === 'pass') {
    eq('program duration edit reason', durationEdit.reason, 'program_duration_edit');
  }

  const namedDurationEdit = routeCoachReadinessMessage({
    message: 'Set Pilates to 30 minutes',
    now: 1000,
  });
  eq('named duration edit passes to coach router', namedDurationEdit.kind, 'pass');
  if (namedDurationEdit.kind === 'pass') {
    eq('named duration edit reason', namedDurationEdit.reason, 'program_duration_edit');
  }

  const addSkiErg = routeCoachReadinessMessage({
    message: 'Can you also add a 10 min ski erg onto that day',
    now: 1000,
  });
  eq('add 10 min SkiErg is program edit, not short-time signal', addSkiErg.kind, 'pass');
  if (addSkiErg.kind === 'pass') {
    eq('add 10 min SkiErg pass reason', addSkiErg.reason, 'program_duration_edit');
  }

  const addBike = routeCoachReadinessMessage({
    message: 'Chuck a 15 min bike on Tuesday',
    now: 1000,
  });
  eq('add 15 min bike is program edit, not short-time signal', addBike.kind, 'pass');
  if (addBike.kind === 'pass') {
    eq('add 15 min bike pass reason', addBike.reason, 'program_duration_edit');
  }

  const sore = routeCoachReadinessMessage({ message: "I'm sore", now: 1000 });
  eq('generic sore asks body part', sore.kind, 'clarify');
  if (sore.kind === 'clarify') {
    const followup = routeCoachReadinessMessage({
      message: 'calves',
      pending: sore.pending,
      now: 1500,
    });
    eq('body part follow-up applies signal', followup.kind, 'apply_signal');
    if (followup.kind === 'apply_signal') {
      eq('follow-up stores body part', followup.signal.bodyPart, 'calves');
      eq('follow-up soreness moderate', followup.signal.soreness, 'moderate');
    }
  }

  const calfCooked = routeCoachReadinessMessage({
    message: 'my calves are cooked',
    now: 1000,
  });
  eq('calves cooked applies body-part soreness', calfCooked.kind, 'apply_signal');
  if (calfCooked.kind === 'apply_signal') {
    eq('calves cooked body part', calfCooked.signal.bodyPart, 'calves');
    eq('calves cooked soreness', calfCooked.signal.soreness, 'moderate');
    ok('calves reply avoids loading-conservative copy', !/loading conservative/i.test(calfCooked.reply));
  }

  const calfShit = routeCoachReadinessMessage({
    message: 'my calves feel shit',
    now: 1000,
  });
  eq('plain-language body soreness applies signal', calfShit.kind, 'apply_signal');
  if (calfShit.kind === 'apply_signal') {
    eq('plain-language body soreness body part', calfShit.signal.bodyPart, 'calves');
    eq('plain-language body soreness', calfShit.signal.soreness, 'moderate');
  }

  const pain = routeCoachReadinessMessage({ message: 'my calf hurts 7/10', now: 1000 });
  eq('pain with severity passes to injury path', pain.kind, 'pass');
}

console.log(`\n— Summary —\n  Pass: ${pass}\n  Fail: ${fail}`);
if (fail > 0) {
  console.log('\n— Failures —');
  failures.forEach((f) => console.log(`  • ${f}`));
  process.exit(1);
}
