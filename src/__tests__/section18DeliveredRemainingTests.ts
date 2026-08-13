/**
 * §18 DELIVERED vs REMAINING — the contract's governed boundary.
 *
 * From `docs/SECTION18_DELIVERED_VS_REMAINING_REASSESSMENT_2026-07-24.md`
 * (approved, with Sam's maximum-rider clarification). The principle:
 *
 *   > §18 governs what the app PRESCRIBES for the REMAINDER of the week.
 *   > Days already delivered, exposure the athlete brings from their own team
 *   > and game commitments, and days before the program existed are HISTORY:
 *   > they count toward the week's requirements and are never governed, never
 *   > re-prescribed, never rewritten.
 *
 * The asymmetry, exactly as ruled:
 *
 *   • minimums          — satisfied by delivered + prescribed (the sum)
 *   • maximums          — bind the TOTAL week, enforced by constraining the
 *                         prescribed remainder to max(0, maximum - delivered);
 *                         never a contradiction raised over history, and never
 *                         a fresh full allowance on top of delivered work
 *   • authorised reductions — evaluated against APP-AUTHORED prescribed
 *                         exposure only. A reduction is the app's own restraint;
 *                         it cannot un-prescribe the past, and it has no
 *                         authority over exposure the athlete brings.
 *
 * These are unit-level: synthetic contracts and workouts straight into the
 * evaluator, no seeding. The end-to-end consequences (T4, I3/I4, I6, E6) are
 * pinned by `test:fact-horizon` and `test:injury-authority`.
 *
 * Run: npm run test:section18-delivered-remaining
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import type { Workout, WorkoutExercise } from '../types/domain';
import {
  buildSection18WeeklyExposureContractV2,
  type Section18AuthorisedReduction,
  type WeeklyExposureContractV2,
} from '../rules/weeklyExposureContractV2';
import { evaluateSection18EffectiveWeek } from '../rules/section18EffectiveWeekEvaluator';
import { finaliseWorkoutAfterMutation } from '../utils/workoutCanonicalisation';

const WEEK_START = '2026-07-20';
/** Friday. MON/TUE/WED/THU are history; FRI/SAT/SUN are governed. */
const GOVERNED_FROM = '2026-07-24';
const NOW = '2026-07-20T00:00:00.000Z';

let passed = 0;
let failed = 0;

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

function run(name: string, test: () => void): void {
  try { test(); passed += 1; console.log(`  PASS [invariant] ${name}`); }
  catch (error) { failed += 1; console.error(`  FAIL [invariant] ${name}: ${(error as Error).message}`); }
}

function row(workoutId: string, index: number, name: string): WorkoutExercise {
  return {
    id: `${workoutId}-row-${index}`,
    workoutId,
    exerciseId: `exercise-${name.toLowerCase().replace(/\W+/g, '-')}`,
    exerciseOrder: index + 1,
    prescribedSets: 4,
    prescribedRepsMin: 5,
    prescribedRepsMax: 5,
    prescribedWeightKg: 60,
    restSeconds: 120,
    exercise: {
      id: `exercise-${name.toLowerCase().replace(/\W+/g, '-')}`,
      name,
      description: '',
      exerciseType: 'Compound',
      muscleGroups: [],
      equipmentRequired: [],
      difficultyLevel: 'Intermediate',
      createdAt: NOW,
      updatedAt: NOW,
    },
    createdAt: NOW,
    updatedAt: NOW,
  } as WorkoutExercise;
}

/** Canonical evidence stamping — the evaluator reads `section18Evidence`, never
 *  exercise names, so an unstamped fixture would count as zero and every
 *  assertion below would be vacuous. */
function strengthWorkout(id: string, dayOfWeek: number, names: readonly string[]): Workout {
  return finaliseWorkoutAfterMutation(rawStrengthWorkout(id, dayOfWeek, names), {
    offseasonSubphase: 'not_off_season',
    phase: 'In-season',
    restoreMissingPlanPatterns: false,
  }).workout;
}

function rawStrengthWorkout(id: string, dayOfWeek: number, names: readonly string[]): Workout {
  return {
    id,
    microcycleId: 'delivered-remaining-week',
    dayOfWeek,
    name: 'Strength Session',
    description: '',
    durationMinutes: 50,
    intensity: 'High',
    workoutType: 'Strength',
    sessionTier: 'core',
    exercises: names.map((name, index) => row(id, index, name)),
    createdAt: NOW,
    updatedAt: NOW,
  } as Workout;
}

function baseContract(reductions?: Section18AuthorisedReduction[]): WeeklyExposureContractV2 {
  return buildSection18WeeklyExposureContractV2({
    seasonPhase: 'In-season',
    declaredSubphase: 'game_week',
    mode: 'in_season_game_week',
    blockNumber: 1,
    weekInBlock: 2,
    globalWeek: 2,
    weekKind: 'build',
    anchorState: 'game',
    teamTrainingDays: [2],
    participationProvenance: 'derived_healthy_unrestricted',
    fixtureDays: [],
    capacity: 'medium',
    plannerSelected: {
      mainStrength: 3,
      coreConditioning: 1,
      sprintHighSpeed: 1,
      powerPrimers: 1,
    },
    reductions,
    currentProductionClaimsAnchorCredit: true,
  });
}

function dateForDay(dayOfWeek: number): string {
  const date = new Date(`${WEEK_START}T12:00:00`);
  date.setDate(date.getDate() + (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  return date.toISOString().slice(0, 10);
}

function evaluate(args: {
  contract: WeeklyExposureContractV2;
  workouts: readonly Workout[];
  governedFromISO?: string | null;
  deliveredDates?: readonly string[];
}) {
  const contract = JSON.parse(JSON.stringify(args.contract)) as WeeklyExposureContractV2;
  if (args.governedFromISO !== undefined) contract.governedFromISO = args.governedFromISO;
  return evaluateSection18EffectiveWeek({
    contract,
    workouts: args.workouts,
    weekStart: WEEK_START,
    deliveredDates: args.deliveredDates ? new Set(args.deliveredDates) : undefined,
  });
}

function has(result: ReturnType<typeof evaluate>, code: string, domain?: string): boolean {
  return result.blockingViolations.some((finding) =>
    finding.code === code && (!domain || finding.domain === domain));
}

console.log('\n── §18 delivered vs remaining (D1–D6) ──');

// ── D1 — the split exists and is honest. MON and WED strength are history and
// were done; FRI is prescribed. The ledger must report both, and their sum.
run('D1 the ledger splits delivered from prescribed and their sum is the achieved total', () => {
  const result = evaluate({
    contract: baseContract(),
    workouts: [
      strengthWorkout('mon', 1, ['Back Squat']),
      strengthWorkout('wed', 3, ['Bench Press']),
      strengthWorkout('fri', 5, ['Romanian Deadlift']),
    ],
    governedFromISO: GOVERNED_FROM,
    deliveredDates: [dateForDay(1), dateForDay(3)],
  });
  const main = result.ledger.mainStrength;
  assert(main.delivered === 2,
    `expected 2 delivered main-strength sessions, got ${main.delivered}`);
  assert(main.prescribed === 1,
    `expected 1 prescribed main-strength session, got ${main.prescribed}`);
  assert(main.achievedCount === 3,
    `achievedCount must remain the total (delivered + prescribed), got ${main.achievedCount}`);
});

// ── D2 — MINIMUMS BY SUM. Two sessions the athlete already did plus one still to
// come satisfies a floor of three. Counting only the remainder would tell an
// athlete who has done their week that they have done nothing.
run('D2 minimums are satisfied by delivered + prescribed', () => {
  const result = evaluate({
    contract: baseContract(),
    workouts: [
      strengthWorkout('mon', 1, ['Back Squat']),
      strengthWorkout('wed', 3, ['Bench Press']),
      strengthWorkout('fri', 5, ['Romanian Deadlift']),
    ],
    governedFromISO: GOVERNED_FROM,
    deliveredDates: [dateForDay(1), dateForDay(3)],
  });
  assert(!has(result, 'required_minimum_shortfall', 'main_strength'),
    `delivered work did not count toward the minimum: ${JSON.stringify(result.blockingViolations)}`);
});

// ── D3 — NO CONTRADICTION OVER HISTORY. Sam's rider, first half. Delivered work
// alone can never breach a maximum: the app cannot un-prescribe the past, and
// telling an athlete their completed week is illegal is not a coaching act.
run('D3 delivered work alone never raises a maximum breach', () => {
  const contract = baseContract();
  contract.mainStrength.exposure.permittedMaximum = 2;
  const result = evaluate({
    contract,
    workouts: [
      strengthWorkout('mon', 1, ['Back Squat']),
      strengthWorkout('tue', 2, ['Bench Press']),
      strengthWorkout('wed', 3, ['Romanian Deadlift']),
      strengthWorkout('thu', 4, ['Overhead Press']),
    ],
    governedFromISO: GOVERNED_FROM,
    deliveredDates: [dateForDay(1), dateForDay(2), dateForDay(3), dateForDay(4)],
  });
  assert(!has(result, 'maximum_breach'),
    `four delivered sessions raised a maximum breach over history: ${JSON.stringify(result.blockingViolations)}`);
});

// ── D4 — NO FRESH ALLOWANCE. Sam's rider, second half. A maximum of 3 with 2
// already delivered leaves room for 1, not 3. Otherwise "history doesn't count
// against you" becomes a loophole that doubles the athlete's week.
run('D4 the prescribed remainder is capped at (maximum - delivered), not a fresh full allowance', () => {
  const contract = baseContract();
  contract.mainStrength.exposure.permittedMaximum = 3;
  const result = evaluate({
    contract,
    workouts: [
      strengthWorkout('mon', 1, ['Back Squat']),
      strengthWorkout('tue', 2, ['Bench Press']),
      strengthWorkout('fri', 5, ['Romanian Deadlift']),
      strengthWorkout('sat', 6, ['Overhead Press']),
      strengthWorkout('sun', 0, ['Front Squat']),
    ],
    governedFromISO: GOVERNED_FROM,
    deliveredDates: [dateForDay(1), dateForDay(2)],
  });
  assert(has(result, 'maximum_breach', 'main_strength'),
    'three prescribed sessions on top of two delivered stayed inside a maximum of three');
});

// ── D5 — the cap floors at zero. With the maximum already met by history, the
// prescribed allowance is 0 — not negative, and not reopened.
run('D5 with the maximum already delivered, the prescribed allowance is zero', () => {
  const contract = baseContract();
  contract.mainStrength.exposure.permittedMaximum = 2;
  const clean = evaluate({
    contract,
    workouts: [
      strengthWorkout('mon', 1, ['Back Squat']),
      strengthWorkout('tue', 2, ['Bench Press']),
    ],
    governedFromISO: GOVERNED_FROM,
    deliveredDates: [dateForDay(1), dateForDay(2)],
  });
  assert(!has(clean, 'maximum_breach'), 'delivered-only week breached its own maximum');

  const withExtra = evaluate({
    contract,
    workouts: [
      strengthWorkout('mon', 1, ['Back Squat']),
      strengthWorkout('tue', 2, ['Bench Press']),
      strengthWorkout('fri', 5, ['Romanian Deadlift']),
    ],
    governedFromISO: GOVERNED_FROM,
    deliveredDates: [dateForDay(1), dateForDay(2)],
  });
  assert(has(withExtra, 'maximum_breach', 'main_strength'),
    'a prescribed session was allowed after the maximum was already delivered');
});

// ── D6 — REDUCTIONS BIND APP-AUTHORED PRESCRIBED WORK ONLY. A reduction is the
// app declaring its own restraint. It cannot reach backwards over delivered
// work, and it has no authority over the exposure the athlete brings from their
// own team training and game — which is why a lower-body injury authorising
// "no app sprint" must not read as a contradiction against a Saturday game the
// athlete is still playing.
run('D6 an authorised reduction is evaluated against app-authored prescribed exposure only', () => {
  const contract = baseContract([{
    metric: 'sprint_high_speed_frequency',
    originalApprovedTarget: 1,
    reducedTarget: 0,
    reason: 'injury_restriction',
    scope: 'week',
    change: 'frequency',
    detail: 'Lower-body restriction removes app-authored sprint work.',
    provenance: 'live_typed_reduction',
  }]);
  const result = evaluate({
    contract,
    workouts: [strengthWorkout('fri', 5, ['Romanian Deadlift'])],
    governedFromISO: GOVERNED_FROM,
    deliveredDates: [],
  });
  assert(!has(result, 'reduction_contradiction', 'sprint_high_speed'),
    `anchor-brought sprint exposure was read as a breach of the app's own reduction: ` +
    JSON.stringify(result.blockingViolations));
});

// ── D7 — THE BOUNDARY TWIN. The coverage hole this suite carried, named by the
// §18 ownership reassessment (2026-08-05, defect D2): every cell above tests
// DOSE across the governed boundary, and none tested PATTERN COVERAGE. The two
// pattern rules disagreed about the same elapsed days.
//
// `pattern_restore_failure` is already boundary-aware: when the contract governs
// only a remainder, it softens to advisory, because immutable history plus a
// reduced remainder may honestly be unable to restore every pattern and that
// cannot block the athlete's report. `pattern_imbalance` read no boundary at
// all — it counted the WHOLE week, history included, and blocked.
//
// They are two statements about one fact ("this remainder could not cover every
// pattern"), so they must agree about elapsed days. Same week, same missing
// hinge/push, same boundary: the twins are asserted together, in both
// directions, so neither can drift again.
run('D7 pattern_imbalance and pattern_restore_failure agree about elapsed days', () => {
  // MON squat + TUE squat are delivered history. FRI pull is the whole
  // authored remainder. Hinge and push are absent — not removed, never
  // reachable — and the counts are maximally uneven (squat 2, pull 1, rest 0).
  const partialWeek = evaluate({
    contract: baseContract(),
    workouts: [
      strengthWorkout('mon', 1, ['Back Squat']),
      strengthWorkout('tue', 2, ['Front Squat']),
      strengthWorkout('fri', 5, ['Chin-Up']),
    ],
    governedFromISO: GOVERNED_FROM,
    deliveredDates: [dateForDay(1), dateForDay(2)],
  });
  const advisoryCodes = partialWeek.findings
    .filter((finding) => finding.severity === 'advisory')
    .map((finding) => finding.code);
  assert(advisoryCodes.includes('pattern_restore_failure'),
    'the fixture is wrong, not the rule: pattern_restore_failure did not even fire ' +
    `as advisory on a partial week — findings=${JSON.stringify(
      partialWeek.findings.map((finding) => `${finding.code}:${finding.severity}`))}`);
  assert(!has(partialWeek, 'pattern_imbalance', 'strength_patterns'),
    'pattern_imbalance BLOCKED a partial week while its twin pattern_restore_failure ' +
    'softened to advisory over the same elapsed days — one rule counts history the ' +
    `other refuses to: ${JSON.stringify(partialWeek.blockingViolations)}`);

  // The other direction, so the fix cannot be "never block". A WHOLE week the
  // app authored from Monday has no history to excuse it: both twins block.
  const wholeWeek = evaluate({
    contract: baseContract(),
    workouts: [
      strengthWorkout('mon', 1, ['Back Squat']),
      strengthWorkout('tue', 2, ['Front Squat']),
      strengthWorkout('fri', 5, ['Chin-Up']),
    ],
    governedFromISO: null,
    deliveredDates: [],
  });
  assert(has(wholeWeek, 'pattern_imbalance', 'strength_patterns'),
    'a whole authored week with squat 2 / hinge 0 / push 0 must still block on ' +
    `pattern_imbalance — the boundary softening leaked past its boundary: ${
      JSON.stringify(wholeWeek.blockingViolations)}`);
  assert(has(wholeWeek, 'pattern_restore_failure', 'strength_patterns'),
    'the twin must block on a whole week too, or this cell proves nothing about ' +
    `agreement: ${JSON.stringify(wholeWeek.blockingViolations)}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
totalsPrinted(failed);
if (failed > 0) process.exit(1);
