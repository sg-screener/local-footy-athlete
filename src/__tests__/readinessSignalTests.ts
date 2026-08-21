/**
 * readinessSignalTests — lightweight readiness stays complementary:
 *   - profile readiness replaces the old hard-coded medium baseline
 *   - quick checks can downshift but never upshift beyond the program
 *   - missing readiness input keeps the plan intact
 *
 * Run: npm run test:readiness
//
// ⚠ THE `short_time` CELLS ARE DELETED, NOT REPAIRED (Sam, 2026-08-21).
// "Short on time" had no athlete-facing route — `buildReadinessSignalPatch` had
// zero production callers and the other door was gated on a `today_only` scope
// nothing dispatches. Proven by `npm run census:short-on-time-route`. The
// option, the policy module, the readiness constraint and the control-action
// branch are all deleted. `weeklyReadinessCardTests` keeps the cell asserting
// the option is ABSENT from the sheet, which now enforces the deletion.
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
  // ⚠ THIS CELL WAS WRONG, AND THE SUITE BEING DARK IS WHY NOBODY SAW IT.
  // It read `missing profile falls back medium`. `utils/readiness.ts:43` says
  // in its own docblock that a missing capacity answer THROWS
  // `MissingCapacityAnswerError` and that "that is the contract, not an
  // accident" — the same fail-loud law that deleted `DEFAULT_BODYWEIGHT_KG`.
  // The cell encoded the behaviour that law replaced. It now asserts the live
  // contract; the product was NOT changed to suit it.
  {
    let threw = false;
    try {
      deriveScheduleReadiness({ onboardingData: null });
    } catch (error) {
      threw = (error as Error).name === 'MissingCapacityAnswerError'
        || /Capacity cannot be scored/.test((error as Error).message);
    }
    ok('missing profile refuses loudly rather than defaulting to medium', threw);
  }
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
}

section('[4] quick patches clear stale fields');
{
  ok(
    'good clears stale minutes',
    !('timeAvailableMinutes' in buildReadinessSignalPatch('good')) ||
      buildReadinessSignalPatch('good').timeAvailableMinutes === undefined,
  );
}

section('[5] readiness builds date-scoped active constraints');
{
  const flat = buildReadinessActiveConstraints(
    signal('2026-05-19', buildReadinessSignalPatch('flat')),
  );
  eq('flat emits one constraint', flat.length, 1);
  eq('flat type fatigue', flat[0]?.type, 'fatigue');
  eq('flat maps to slight reduction severity', (flat[0] as any)?.severity, 3);
  eq('flat scoped to date', (flat[0] as any)?.appliesToDate, '2026-05-19');
  eq('flat has readiness source', (flat[0] as any)?.source, 'readiness');
  ok('flat id marked readiness', isReadinessConstraint(flat[0]));
  ok(
    'flat preserves main lift focus',
    ((flat[0] as any)?.safeFocus ?? []).some((focus: string) => /main lift/i.test(focus)),
  );
  ok(
    'flat trims finishers/accessories first',
    ((flat[0] as any)?.rules ?? []).some((rule: string) => /finisher|accessor/i.test(rule)),
  );

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

section('[7] the readiness label is owned by the constraint itself');
{
  const flat = buildReadinessActiveConstraints(
    signal('2026-05-19', buildReadinessSignalPatch('flat')),
  );
  // THIS CELL WAS REPAIRED, NOT DELETED. It used to read the label off a
  // `buildConstraintPlans` plan ("Feeling flat - 3/10"), and the plan builder is
  // gone — it had zero production execution. The label itself is LIVE and is
  // written by `utils/readinessConstraints.ts:105`, so the claim is now made at
  // that owner. The " - 3/10" suffix was the deleted builder's own formatting.
  const flatConstraint = flat[0];
  ok('readiness produces exactly one dated constraint', flat.length === 1);
  // `ActiveConstraint` is a union and `ActiveInjuryConstraint` does not declare
  // `reasonLabel`; this repo has no `strictNullChecks`, so the member is reached
  // through an `in` narrowing rather than an optional chain.
  eq(
    'readiness constraint carries its display label',
    flatConstraint && 'reasonLabel' in flatConstraint ? flatConstraint.reasonLabel : undefined,
    'Feeling flat',
  );
}

// [8] WAS DELETED WITH ITS SUBJECT — "coach chat routes to same readiness
// language", 17 cells against `routeCoachReadinessMessage`. That router had
// ZERO production execution and is gone; `utils/coachCommandRouter.ts` and
// `utils/coachTurnController.ts` decide what a coach turn is.
//
// THE WEEKLY-CARD CELLS FROM [7] WENT TOO, and they are NOT re-sited: their
// owner `utils/weeklyCoachUpdate.ts` was removed by the 2026-08-19 burn and
// nothing in the app builds that card today. UNCOVERED, on that burn's rebuild
// list — not covered somewhere else.

console.log(`\n— Summary —\n  Pass: ${pass}\n  Fail: ${fail}`);
if (fail > 0) {
  console.log('\n— Failures —');
  failures.forEach((f) => console.log(`  • ${f}`));
  process.exit(1);
}
