/**
 * R-356 — the week checker judges what the app could honestly build.
 *
 * Five findings the compiler-year runner carried on 2026-09-02, each traced to
 * its rule (docs/STATUS_HINGECOD.md) and approved by Sam ("yep do all"):
 *  1. an injury withdrew a core conditioning session with no off-feet
 *     replacement → recorded as an authorised reduction, not a target miss;
 *  2. two dedicated upper days claimed the same four seats and the second got
 *     none → the second takes the vertical planes;
 *  3. the week's only strength day hit the four-compound ceiling before its
 *     pull seat → push and pull mains are seated before single-leg work;
 *  4. a game moved onto a club night still counted as one high-speed day →
 *     exposures are counted, so no app sprint tops the in-season maximum;
 *  5. a conditioning day the injury emptied stayed as an empty card → it
 *     collapses to an honest rest day.
 *
 * Run: npm run test:week-checker-allowances
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import { ARCHETYPES, athleteAnswers, YEAR_START, yearTimeline, plusDays } from './compilerYear/catalog';
import { commitProfileProgramTransaction } from '../store/profileProgramTransaction';
import { applyPhaseShift } from '../utils/profileMutations';
import {
  coldStartThroughOnboarding, quiet, quietAsync, setJourneyClock, rolloverIfDue, followTheWeek,
} from './support/athleteJourney';
import { deriveVisibleWeekLive } from '../utils/deriveVisibleWeek';
import { executeFixtureMutationTransaction } from '../store/fixtureMutationTransaction';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { rebaseAcceptedEffectiveWeek } from '../rules/acceptedEffectiveWeek';
import { evaluateSection18EffectiveWeek } from '../rules/section18EffectiveWeekEvaluator';
import { getAthleteExclusions } from '../store/athletePreferencesStore';
import { buildGuidedInjuryConstraint } from '../utils/guidedInjuryControl';
import { executeProgramControlActionDurably } from '../utils/programControlActions';
import { createWeeklyStrengthBudget } from '../rules/weeklyStrengthBudget';
import { coverageSlotsForFullBodyDay } from '../rules/composeWeek';
import { createStrengthIntent } from '../rules/strengthPatternContributions';
import type { SessionSlot } from '../rules/sessionSlotCoverage';
import { resetStoresToFreshInstall } from './support/freshInstallStores';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';

armTotalsOrRed();

let passed = 0;
const failures: string[] = [];
function check(name: string, condition: boolean, detail = ''): void {
  if (condition) { passed += 1; console.log(`  ok   ${name}`); }
  else { failures.push(name); console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
}

type Row = { exercise?: { name?: string }; section18Evidence?: { role?: string; mainStrengthPattern?: string | null } };
type Day = { date: string; source?: string; workout?: {
  name: string; workoutType?: string; exercises: Row[]; strengthIntent?: unknown;
  conditioningBlock?: { options?: unknown[] } | null; speedBlock?: unknown;
} | null };

const visible = (weekStart: string): Day[] => quiet(() => deriveVisibleWeekLive(weekStart, weekStart)) as unknown as Day[];
const mains = (day: Day | undefined) => (day?.workout?.exercises ?? [])
  .filter((row) => row.section18Evidence?.role === 'main_strength').map((row) => row.exercise?.name ?? '');
const patternsOf = (day: Day | undefined) => new Set((day?.workout?.exercises ?? [])
  .filter((row) => row.section18Evidence?.role === 'main_strength')
  .map((row) => row.section18Evidence?.mainStrengthPattern ?? ''));

function judge(weekStart: string) {
  const days = visible(weekStart);
  const state = useProgramStore.getState() as unknown as Record<string, unknown>;
  const effective = quiet(() => rebaseAcceptedEffectiveWeek({
    surfaces: { ...state, removalDecisions: state.userRemovalConstraints, athleteExclusions: getAthleteExclusions() },
    weekStart, profile: useProfileStore.getState().onboardingData, markedDays: useCalendarStore.getState().markedDays,
  } as never)) as unknown as { contract: { authorisedReductions?: { metric: string; reason: string; reducedTarget: number }[] } };
  const evaluation = evaluateSection18EffectiveWeek({
    contract: effective.contract, workouts: days.flatMap((day) => day.workout ? [day.workout] : []), weekStart,
  } as never) as unknown as { blockingViolations?: { code: string; domain: string; expected: unknown; actual: unknown }[] } | null;
  const blocking = (evaluation?.blockingViolations ?? []).map((f) => `${f.code}:${f.domain} ${String(f.expected)} vs ${String(f.actual)}`);
  const reductions = (effective.contract.authorisedReductions ?? []).map((r) => `${r.metric}->${r.reducedTarget} (${r.reason})`);
  const emptyConditioning = days.filter((day) => day.workout?.workoutType === 'Conditioning'
    && !(day.workout.conditioningBlock?.options?.length) && !day.workout.speedBlock).map((day) => day.date);
  return { days, blocking, reductions, emptyConditioning };
}

async function shiftPhase(archetype: { days: string[]; clubDays: string[]; gameDay: string | null }, phase: string, date: string) {
  const next = applyPhaseShift(useProfileStore.getState().onboardingData, {
    targetPhase: phase, seasonFinishedOn: phase === 'Off-season' ? plusDays(date, -1) : undefined,
    preferredTrainingDays: [...archetype.days], teamTrainingDays: phase === 'Off-season' ? [] : [...archetype.clubDays],
    gameAnchor: phase === 'In-season' ? archetype.gameDay ? { kind: 'usual_day', day: archetype.gameDay } : { kind: 'no_usual_day' } : undefined,
  } as never) as Record<string, unknown>;
  return commitProfileProgramTransaction({ change: { kind: 'profile_setup', patch: {
    seasonPhase: next.seasonPhase, seasonFinishedOn: next.seasonFinishedOn,
    preferredTrainingDays: next.preferredTrainingDays, trainingDaysPerWeek: next.trainingDaysPerWeek,
    teamTrainingDays: next.teamTrainingDays, teamTrainingDaysPerWeek: next.teamTrainingDaysPerWeek,
    usualGameDay: next.usualGameDay, gameDay: next.gameDay,
  } }, todayISO: date, sourceSurface: 'phase_shift' } as never);
}

async function walkTo(archetypeId: string, phase: string, phaseWeek: number): Promise<string> {
  resetStoresToFreshInstall(`week-checker-allowances:${archetypeId}`);
  const archetype = (ARCHETYPES as unknown as { id: string; days: string[]; clubDays: string[]; gameDay: string | null }[])
    .find((entry) => entry.id === archetypeId)!;
  const installed = await quietAsync(() => coldStartThroughOnboarding({
    profile: athleteAnswers(archetype as never), installDayISO: YEAR_START,
  }));
  check(`${archetypeId}: real onboarding accepted`, installed.onboardingRefusal === null, String(installed.onboardingRefusal));
  for (const week of yearTimeline(archetype as never)) {
    setJourneyClock(week.weekStart);
    if (week.phaseWeek === 1 && week.index > 0) await quietAsync(() => shiftPhase(archetype, week.phase, week.weekStart));
    const roll = quiet(() => rolloverIfDue(week.weekStart)) as { refusal?: string | null };
    if (roll.refusal) throw new Error(`rollover refused at ${week.weekStart}: ${roll.refusal}`);
    if (week.phase === phase && week.phaseWeek === phaseWeek) return week.weekStart;
    quiet(() => followTheWeek(week.weekStart));
  }
  throw new Error(`${archetypeId}: ${phase} week ${phaseWeek} not reached`);
}

async function fixture(id: string, kind: 'game' | 'practice_match', action: 'add' | 'move', weekStart: string, sourceDate?: string, targetDate?: string) {
  return quietAsync(() => executeFixtureMutationTransaction({
    action, fixtureKind: kind, sourceDate, targetDate,
    expectedAcceptedRevision: useProgramStore.getState().acceptedMaterialContext.revision,
    source: { requestedBy: 'athlete', producer: 'tap', surface: 'program_tab', commandId: `allowances:${id}:${weekStart}:${action}` },
    todayISO: weekStart,
  } as never)) as Promise<{ outcome: string }>;
}

async function reportKnee(date: string) {
  const constraint = buildGuidedInjuryConstraint({
    region: 'lower_body', area: 'knee', severity: 7, severityBand: 'moderate',
    adjustmentLevel: 'moderate', triggers: ['running'], seriousSymptoms: false,
  } as never, { todayISO: date });
  return quietAsync(() => executeProgramControlActionDurably({
    type: 'set_injury_modifier', source: { screen: 'my_status', surface: 'status_card', initiatedBy: 'tap' },
    scope: 'current_and_future', payload: { constraint }, requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
  } as never, { todayISO: date })) as Promise<{ ok?: boolean; message?: string }>;
}

(async () => {
  // ── 1 + 5: the home-kit beginner's knee week (the runner's week-10 report) ──
  {
    const weekStart = await walkTo('female-3-novice-home', 'Pre-season', 10);
    const before = judge(weekStart);
    check('CONTROL: the healthy week has no blocking finding and no injury reduction',
      before.blocking.length === 0 && !before.reductions.some((r) => r.includes('injury_restriction')), before.blocking.join(' | '));
    const report = await reportKnee(weekStart);
    check('CONTROL: the knee report was accepted', report.ok === true, String(report.message));
    const after = judge(weekStart);
    check('1: the week checker records the withdrawn conditioning as an injury allowance',
      after.reductions.some((r) => r.startsWith('conditioning_core_frequency->') && r.includes('injury_restriction')), after.reductions.join(' | '));
    check('1: no blocking finding is left on the injured week', after.blocking.length === 0, after.blocking.join(' | '));
    check('5: no conditioning day survives as an empty card', after.emptyConditioning.length === 0, after.emptyConditioning.join(','));
    check('CONTROL: the injured week still trains (a session with rows exists)',
      after.days.some((day) => (day.workout?.exercises.length ?? 0) > 0));
  }

  // ── 1 + 5 again: the two-day home-kit novice's Off-season knee week (the runner's empty-card weeks) ──
  {
    const weekStart = await walkTo('male-2-novice-home', 'Off-season', 10);
    const before = judge(weekStart);
    check('CONTROL: the two-day week has core conditioning to withdraw',
      before.days.some((day) => (day.workout?.conditioningBlock?.options?.length ?? 0) > 0));
    const report = await reportKnee(weekStart);
    check('CONTROL: the two-day novice\'s knee report was accepted', report.ok === true, String(report.message));
    const after = judge(weekStart);
    check('1: the two-day novice\'s withdrawn conditioning is recorded as an injury allowance',
      after.reductions.some((r) => r.startsWith('conditioning_core_frequency->') && r.includes('injury_restriction')), after.reductions.join(' | '));
    check('1: no blocking conditioning finding on the two-day novice\'s injured week',
      !after.blocking.some((f) => f.includes(':conditioning')), after.blocking.join(' | '));
    check('5: the two-day novice\'s emptied conditioning day is not an empty card', after.emptyConditioning.length === 0, after.emptyConditioning.join(','));
  }

  // ── 2: a practice match on a strength day of a five-day home week ──
  {
    const weekStart = await walkTo('female-5-home', 'Pre-season', 6);
    const before = judge(weekStart);
    check('CONTROL: the week before the practice match has no blocking finding', before.blocking.length === 0, before.blocking.join(' | '));
    const occupied = before.days.find((day) => (day.workout?.exercises.length ?? 0) > 0 && day.source !== 'game')!;
    const outcome = await fixture('f5', 'practice_match', 'add', weekStart, undefined, occupied.date);
    check('CONTROL: the practice match was accepted on the occupied day', outcome.outcome === 'accepted', outcome.outcome);
    const after = judge(weekStart);
    const upperDays = after.days.filter((day) => /upper/i.test(day.workout?.name ?? ''));
    check('2: two dedicated upper days both carry a main lift (the second takes the vertical seats)',
      upperDays.length >= 2 && upperDays.every((day) => mains(day).length > 0),
      upperDays.map((day) => `${day.date}: ${mains(day).join(', ') || 'none'}`).join(' | '));
    check('2: no blocking finding after the practice match', after.blocking.length === 0, after.blocking.join(' | '));
  }

  // ── 3: an extra game added on the first strength day of a two-fixture in-season week ──
  {
    const weekStart = await walkTo('male-5-two-fixtures', 'In-season', 5);
    const before = judge(weekStart);
    const target = before.days.find((day) => (day.workout?.exercises.length ?? 0) > 0 && day.source !== 'game')!;
    const outcome = await fixture('m5', 'game', 'add', weekStart, undefined, target.date);
    check('CONTROL: the extra game was accepted', outcome.outcome === 'accepted', outcome.outcome);
    const after = judge(weekStart);
    const strengthDays = after.days.filter((day) => day.workout?.strengthIntent && mains(day).length > 0);
    check('CONTROL: the rebuilt week keeps one strength day with main lifts', strengthDays.length >= 1);
    const lone = strengthDays[0];
    check('3: the rebuilt strength day carries BOTH a push and a pull main lift',
      !!lone && patternsOf(lone).has('push') && patternsOf(lone).has('pull'), `${lone?.date}: ${mains(lone).join(', ')}`);
    check('3: no "no pull main lift" finding after the extra game', after.blocking.length === 0, after.blocking.join(' | '));
  }

  // ── 4: a game moved onto a club night in an in-season week with two club nights ──
  {
    const weekStart = await walkTo('female-4-experienced-gym', 'In-season', 3);
    const before = judge(weekStart);
    const source = before.days.find((day) => day.source === 'game')!;
    const target = before.days.find((day) => (day.workout?.exercises.length ?? 0) > 0 && day.source !== 'game')!;
    const outcome = await fixture('f4', 'game', 'move', weekStart, source.date, target.date);
    check('CONTROL: the game move was accepted', outcome.outcome === 'accepted', outcome.outcome);
    const after = judge(weekStart);
    check('4: no high-speed maximum breach after the move (exposures, not days, are counted)',
      !after.blocking.some((f) => f.startsWith('maximum_breach:sprint_high_speed')), after.blocking.join(' | '));
    check('4: no blocking finding after the move', after.blocking.length === 0, after.blocking.join(' | '));
  }

  // ── Units: the budget split and the lone-day coverage order ──
  {
    const lower = { planEntryId: 'lower', strengthIntent: createStrengthIntent({ archetype: 'lower', plannedPatterns: ['squat', 'hinge'] }) };
    const upperA = { planEntryId: 'upper-a', strengthIntent: createStrengthIntent({ archetype: 'upper', plannedPatterns: ['push', 'pull'] }) };
    const upperB = { planEntryId: 'upper-b', strengthIntent: createStrengthIntent({ archetype: 'upper', plannedPatterns: ['push', 'pull'] }) };
    const owners = createWeeklyStrengthBudget([lower, upperA, upperB]).reservedOwnerBySlot;
    check('2 (unit): the first upper day keeps the horizontal seats', owners.horizontal_push === 'upper-a' && owners.horizontal_pull === 'upper-a', JSON.stringify(owners));
    check('2 (unit): the second upper day takes the vertical seats', owners.vertical_push === 'upper-b' && owners.vertical_pull === 'upper-b', JSON.stringify(owners));
    const solo = createWeeklyStrengthBudget([lower, upperA]).reservedOwnerBySlot;
    check('CONTROL: one upper day still owns all four upper seats', solo.vertical_push === 'upper-a' && solo.vertical_pull === 'upper-a', JSON.stringify(solo));
    const lone = coverageSlotsForFullBodyDay({ suppliedByOtherDays: new Set<SessionSlot>(), takenByEarlierCoverageDays: new Set(), pairCounts: {} });
    check('3 (unit): the week\'s only strength day seats squat, hinge, push and pull before the single-leg pair',
      lone.slice(0, 4).join(',') === 'squat,hinge,horizontal_push,horizontal_pull' && lone.includes('single_leg_knee') && lone.includes('single_leg_hip'),
      lone.join(','));
    const shared = coverageSlotsForFullBodyDay({ suppliedByOtherDays: new Set<SessionSlot>(['horizontal_push', 'vertical_pull']), takenByEarlierCoverageDays: new Set(), pairCounts: {} });
    check('CONTROL: with an upper day elsewhere the ladder order stands (single-leg pair before the remaining upper seats)',
      shared.indexOf('single_leg_knee') < shared.indexOf('horizontal_pull'), shared.join(','));
  }

  console.log(`\nWeek-checker allowances: ${passed} passed, ${failures.length} failed`);
  totalsPrinted(failures.length);
  process.exit(failures.length === 0 ? 0 : 1);
})().catch((error) => {
  console.log(`SUITE THREW ${(error as Error).message}`);
  process.exit(1);
});
