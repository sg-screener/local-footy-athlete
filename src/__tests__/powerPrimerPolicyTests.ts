/**
 * Power / contrast primer policy tests.
 *
 * Run: npx sucrase-node src/__tests__/powerPrimerPolicyTests.ts
 *
 * Covers the pure decision (`decidePowerPrimer`) across every gate, plus the
 * rendered integration (`buildCoachingPlan` → `buildWorkoutsFromCoach`) proving
 * the power block is a distinct block — not conditioning, not a finisher, not in
 * `exercises` — that equipment is respected, and that healthy default weeks keep
 * their strength content unchanged.
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — power primer must be deterministic');
};

import type { OnboardingData } from '../types/domain';
import {
  decidePowerPrimer,
  type PowerPrimerContext,
} from '../rules/powerPrimerPolicy';
import {
  buildCoachingPlan,
  onboardingToCoachingInputs,
} from '../utils/coachingEngine';
import { buildWorkoutsFromCoach } from '../data/defaultProgram';
import { buildWeekScopedWorkoutOverlay } from '../utils/weekRebuild';
import { alignPowerToFinalWorkoutContent } from '../rules/powerRowAlignment';
import { participatesInCounting, powerRows } from '../rules/sessionRowCounting';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, cond: boolean, detail?: unknown): void {
  if (cond) {
    pass++;
    console.log(`  PASS ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  FAIL ${name}${detail === undefined ? '' : `\n      ${String(detail)}`}`);
  }
}

const BASE: PowerPrimerContext = {
  phase: 'Off-season',
  offseasonSubphase: 'late_offseason',
  strengthPattern: 'lower',
  hasGame: false,
  gOffset: -99,
  isTeamDay: false,
  readiness: 'high',
  isBeginner: false,
  experienced: true,
  injuries: [],
  powerGoalNudge: false,
};

function ctx(over: Partial<PowerPrimerContext> = {}): PowerPrimerContext {
  return { ...BASE, ...over };
}

// ── 1. Late off-season suitable athlete gets power (contrast when fresh) ──
{
  const d = decidePowerPrimer(ctx());
  ok('late off-season fresh strength session gets power', d !== null, JSON.stringify(d));
  ok('late off-season fresh high-readiness → contrast', d?.kind === 'contrast', d?.kind);
  ok('dose within Bible bounds (2-4 sets, 2-5 reps)',
    !!d && d.sets >= 2 && d.sets <= 4 && d.repsMin >= 2 && d.repsMax <= 5,
    JSON.stringify(d));
}

// ── 2. Only strength sessions ──
{
  ok('non-strength session gets no power', decidePowerPrimer(ctx({ strengthPattern: undefined })) === null);
}

// ── 3. Low readiness blocks power; a DELOAD DOES NOT ──
//
// This assertion is re-pointed, not deleted. It used to read "deload blocks
// power", which is what the code did and what Sam's deload law (2026-07-27)
// supersedes: "Power/speed: KEEP a small sharp dose … a deload is not a reason
// to lose sharpness." The law had reached three sites (the §18 weekly budget,
// the canonicalisation phase gate, and `deloadPowerDose`) and missed this one —
// so the shrink existed with nothing to shrink, and a deload week rendered no
// power at all. The RATCHET is structural: the policy has no deload input left,
// so the removal cannot be reinstated by flipping a condition.
{
  ok('low readiness blocks power', decidePowerPrimer(ctx({ readiness: 'low' })) === null);
  ok(
    'the policy takes no deload input at all — a deload cannot gate power here',
    !('isDeload' in BASE) &&
      !Object.keys(BASE).some((key) => /deload/i.test(key)),
    Object.keys(BASE).join(', '),
  );
}

// ── 4. Game proximity ──
{
  const game = { hasGame: true, phase: 'In-season' as const };
  ok('game day blocks power', decidePowerPrimer(ctx({ ...game, gOffset: 0 })) === null);
  ok('G+1 (day after game) blocks power', decidePowerPrimer(ctx({ ...game, gOffset: 1 })) === null);
  ok('G-1 blocks power', decidePowerPrimer(ctx({ ...game, gOffset: -1 })) === null);

  const g2 = decidePowerPrimer(ctx({ ...game, gOffset: -2 }));
  ok('G-2 experienced+fresh → tiny primer only', g2?.kind === 'primer' && g2.sets === 2 && g2.repsMax === 3, JSON.stringify(g2));
  ok('G-2 beginner → no power', decidePowerPrimer(ctx({ ...game, gOffset: -2, isBeginner: true })) === null);
  ok('G-2 non-experienced → no power', decidePowerPrimer(ctx({ ...game, gOffset: -2, experienced: false })) === null);
  ok('G-2 medium readiness → no power', decidePowerPrimer(ctx({ ...game, gOffset: -2, readiness: 'medium' })) === null);

  // Away from the game (G-3 or earlier) power is allowed again.
  ok('G-3 in-season allows small primer', decidePowerPrimer(ctx({ ...game, gOffset: -3 }))?.kind === 'primer');
}

// ── 5. Beginner is conservative ──
{
  const off = decidePowerPrimer(ctx({ isBeginner: true, offseasonSubphase: 'mid_offseason' }));
  ok('beginner mid off-season → conservative primer (never contrast)', off?.kind === 'primer' && off.sets === 2, JSON.stringify(off));
  ok('beginner in-season → skips power', decidePowerPrimer(ctx({ isBeginner: true, phase: 'In-season' })) === null);
}

// ── 6. Injury / readiness wins ──
{
  const severeLower = decidePowerPrimer(ctx({ injuries: [{ area: 'Left knee pain', severity: 8 }] }));
  ok('active moderate+ lower injury blocks lower power', severeLower === null);

  // Same knee does NOT block an UPPER strength session's power.
  const upperOk = decidePowerPrimer(ctx({ strengthPattern: 'push', injuries: [{ area: 'Left knee pain', severity: 8 }] }));
  ok('lower injury does not block upper power', upperOk !== null, JSON.stringify(upperOk));

  // Mild niggle → reduced dose, not blocked.
  const mild = decidePowerPrimer(ctx({ injuries: [{ area: 'mild calf tightness', severity: 3 }] }));
  ok('mild same-region niggle → reduced dose', mild?.reduced === true && mild.sets === 2, JSON.stringify(mild));
}

// ── 7. Phase dosing ──
{
  ok('early off-season → no power', decidePowerPrimer(ctx({ offseasonSubphase: 'early_offseason' })) === null);
  ok('missing off-season context is conservative → no power', decidePowerPrimer(ctx({ offseasonSubphase: undefined })) === null);

  const mid = decidePowerPrimer(ctx({ offseasonSubphase: 'mid_offseason', powerGoalNudge: true }));
  ok('mid off-season → primer only even with power nudge', mid?.kind === 'primer', JSON.stringify(mid));

  const late = decidePowerPrimer(ctx({ offseasonSubphase: 'late_offseason' }));
  ok('late off-season → contrast eligible when every safety gate passes', late?.kind === 'contrast', JSON.stringify(late));

  const inSeason = decidePowerPrimer(ctx({ phase: 'In-season' }));
  ok('in-season → small primer, never contrast', inSeason?.kind === 'primer' && inSeason.sets === 2, JSON.stringify(inSeason));

  const preTeam = decidePowerPrimer(ctx({ phase: 'Pre-season', isTeamDay: true }));
  ok('pre-season team day → low-dose primer (respects team load)', preTeam?.kind === 'primer' && preTeam.sets === 2, JSON.stringify(preTeam));

  const prePlain = decidePowerPrimer(ctx({ phase: 'Pre-season' }));
  ok('pre-season non-team default → primer (no forced contrast)', prePlain?.kind === 'primer', JSON.stringify(prePlain));

  const preNudge = decidePowerPrimer(ctx({ phase: 'Pre-season', powerGoalNudge: true }));
  ok('pre-season + power goal nudge → contrast (nudge, not force)', preNudge?.kind === 'contrast', JSON.stringify(preNudge));
}

// ── 8. Power goal nudge only enriches, never creates power where a gate said no ──
{
  ok('nudge cannot create power on G-1', decidePowerPrimer(ctx({ hasGame: true, gOffset: -1, powerGoalNudge: true })) === null);
  ok('nudge cannot override injury', decidePowerPrimer(ctx({ injuries: [{ area: 'groin strain', severity: 6 }], powerGoalNudge: true })) === null);
}

// ══════════════════ INTEGRATION (rendered power ROW) ══════════════════

const OFF_PROFILE: OnboardingData = {
  seasonPhase: 'Off-season',
  position: 'key_position_ruck_tall',
  trainingDaysPerWeek: 4,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Thursday', 'Saturday'],
  teamTrainingDaysPerWeek: 0,
  teamTrainingDays: [],
  trainingLocation: 'Commercial gym',
  equipment: ['Barbell', 'Dumbbells', 'Bench'],
  experienceLevel: '5+ years',
  squatStrength: '1.5x bodyweight',
  benchStrength: '1.25x bodyweight',
  conditioningLevel: 'Good',
  sprintExposure: 'Occasionally',
  recentTrainingLoad: 'Very consistent',
  injuries: [],
  motivation: 'Get stronger',
};

function profile(over: Partial<OnboardingData> = {}): OnboardingData {
  return { ...OFF_PROFILE, ...over };
}

function workoutsFor(
  data: OnboardingData,
  weekKind?: 'deload',
  weekInBlock: number = 4,
) {
  const offseasonSubphase = weekInBlock <= 2 ? 'early_offseason' : 'mid_offseason';
  const plan = buildCoachingPlan(onboardingToCoachingInputs(data, {
    availabilityDateISO: '2026-07-06',
    miniCycleNumber: 1,
    weekNumber: weekInBlock,
    weekInBlock,
    weekKind,
    offseasonSubphase,
  })).weeklyPlan;
  return buildWorkoutsFromCoach([], 'mc-1', plan, data, {
    miniCycleNumber: 1,
    weekInBlock,
    weekStartISO: '2026-07-06',
    weekKind,
    offseasonSubphase,
  });
}

// Early off-season must stay a true base-rebuild week with no hidden primer.
{
  const ws = workoutsFor(profile(), undefined, 1);
  ok('early off-season rendered workouts have no power row',
    ws.every((w) => powerRows(w).length === 0),
    ws.map((w) => `${w.dayOfWeek}:${powerRows(w).length > 0 ? 'POWER' : '-'}`).join(' | '));
}

// Off-season suitable athlete → at least one strength session carries a power row.
{
  const ws = workoutsFor(profile());
  const withPower = ws.filter((w) => powerRows(w).length > 0);
  ok('off-season suitable athlete gets a rendered power row', withPower.length >= 1,
    ws.map((w) => `${w.dayOfWeek}:${powerRows(w)[0]?.power?.kind ?? '-'}`).join(' | '));

  // RE-POINTED to the row era. These four used to read the block's stored
  // `counting` object — a copy of the fence that could say `false` while the
  // counters said otherwise. The fence lives in the authored role now, so they
  // ask the counters directly, which is a stronger question.
  const row = powerRows(withPower[0])[0];
  ok('a power row is counted by nothing', !!row && !participatesInCounting(row));
  ok('a power row carries power Section 18 evidence, never main strength',
    row?.section18Evidence?.role === 'power', JSON.stringify(row?.section18Evidence));
  ok('a power row leads the session — pre-lift placement is its position',
    withPower[0].exercises[0]?.id === row?.id);

  // Power rows DO live in `workout.exercises` now — that is the whole redesign.
  // What must not happen is a power movement arriving as an ORDINARY row, with
  // no authored role, where every name probe would count it as strength.
  const powerNames = /vertical jump|explosive push|pogo|lateral bound|depth jump|kneeling jump|broad jump|box jump/i;
  const unroled = ws.some((w) => w.exercises.some((ex) =>
    powerNames.test(ex.exercise?.name || '') && ex.role !== 'power'));
  ok('no power movement reaches the list without its authored role', !unroled);

  const overlay = buildWeekScopedWorkoutOverlay({
    program: {
      id: 'power-overlay-program',
      microcycles: [{ id: 'power-overlay-microcycle', workouts: [withPower[0]] }],
    } as any,
    weekStart: '2026-07-06',
    anchorDate: '2026-07-11',
    reason: 'one_off_game',
  });
  const clonedRow = Object.values(overlay.workoutsByDate)
    .flatMap((workout) => (workout ? powerRows(workout) : []))[0];
  ok('week rebuild overlay preserves the power exercise',
    clonedRow?.exercise?.name === row?.exercise?.name);
  ok('week rebuild overlay preserves the power dose',
    clonedRow?.prescribedSets === row?.prescribedSets &&
    clonedRow?.prescribedRepsMax === row?.prescribedRepsMax);
  ok('week rebuild overlay preserves the power role and family',
    clonedRow?.role === 'power' && clonedRow?.power?.family === row?.power?.family);
}

// Final rows own the visible power identity. Contrast requires a real heavy
// same-family lift; stale power metadata cannot survive a conditioning shell.
{
  const contrastRow = {
    id: 'power-alignment',
    workoutId: 'x',
    exerciseId: 'ex-vertical-jump',
    exerciseOrder: 0,
    prescribedSets: 3,
    prescribedRepsMin: 3,
    prescribedRepsMax: 3,
    restSeconds: 120,
    notes: 'Do this fresh, early in the session — before the main lifts. Contrast: perform sharply straight after your heavy set, then rest fully.',
    role: 'power',
    power: { family: 'lower', kind: 'contrast' },
    exercise: { id: 'ex-vertical-jump', name: 'Vertical Jump' },
  } as const;

  const conditioningOnly = alignPowerToFinalWorkoutContent({
    id: 'conditioning-only-power',
    microcycleId: 'mc-1',
    name: 'Bike Tempo',
    dayOfWeek: 'Monday',
    orderIndex: 0,
    workoutType: 'Conditioning',
    exercises: [
      { ...contrastRow, workoutId: 'x' },
      {
      id: 'we-bike',
      workoutId: 'conditioning-only-power',
      exerciseId: 'ex-bike',
      exercise: { id: 'ex-bike', name: 'Bike Tempo' },
      prescribedSets: 3,
      prescribedRepsMin: 8,
      prescribedRepsMax: 8,
      restSeconds: 120,
    }],
  } as any);
  ok('conditioning-only final workout cannot carry power',
    conditioningOnly.action === 'removed' && powerRows(conditioningOnly.workout).length === 0,
    JSON.stringify(conditioningOnly));

  const lightLower = alignPowerToFinalWorkoutContent({
    id: 'light-lower-power',
    microcycleId: 'mc-1',
    name: 'Lower Support',
    dayOfWeek: 'Tuesday',
    orderIndex: 1,
    workoutType: 'Strength',
    exercises: [
      { ...contrastRow, workoutId: 'x' },
      {
      id: 'we-goblet',
      workoutId: 'light-lower-power',
      exerciseId: 'ex-goblet',
      exercise: { id: 'ex-goblet', name: 'Goblet Squat' },
      prescribedSets: 3,
      prescribedRepsMin: 10,
      prescribedRepsMax: 12,
      restSeconds: 90,
    }],
  } as any);
  ok('power without a heavy same-family lift is labelled primer, not contrast',
    lightLower.action === 'downgraded'
      && powerRows(lightLower.workout)[0]?.power?.kind === 'primer',
    JSON.stringify(lightLower));

  const heavyLower = alignPowerToFinalWorkoutContent({
    id: 'heavy-lower-power',
    microcycleId: 'mc-1',
    name: 'Lower Strength',
    dayOfWeek: 'Thursday',
    orderIndex: 2,
    workoutType: 'Strength',
    hasCombinedConditioning: true,
    exercises: [
      { ...contrastRow, workoutId: 'x' },
      {
        id: 'we-squat',
        workoutId: 'heavy-lower-power',
        exerciseId: 'ex-squat',
        exercise: { id: 'ex-squat', name: 'Back Squat' },
        prescribedSets: 4,
        prescribedRepsMin: 4,
        prescribedRepsMax: 5,
        prescribedWeightKg: 100,
        restSeconds: 180,
      },
      {
        id: 'we-bike',
        workoutId: 'heavy-lower-power',
        exerciseId: 'ex-bike',
        exercise: { id: 'ex-bike', name: 'Easy Bike' },
        prescribedSets: 1,
        prescribedRepsMin: 20,
        prescribedRepsMax: 20,
        restSeconds: 0,
      },
    ],
    conditioningBlock: {
      options: [{ title: 'Easy Bike', description: '20 minutes easy', exerciseIds: ['we-bike'] }],
    },
  } as any);
  // ⚠ THIS CELL'S ACTION CHANGED FROM 'unchanged' TO 'paired' (item 42), AND
  // THAT IS NOT AN EXPECTATION EDITED TO MATCH A REGRESSION. Its claim is
  // "contrast power is PRESERVED", which is what the second half asserts and
  // which is still true. 'unchanged' was only ever a proxy for "not removed and
  // not downgraded"; the row is now also PAIRED, which is more than preserved.
  // The cells below are what make the new half non-vacuous.
  ok('mixed S+C with real heavy same-family strength preserves contrast power',
    heavyLower.action === 'paired' && powerRows(heavyLower.workout)[0]?.power?.kind === 'contrast',
    JSON.stringify(heavyLower));

  // ── ITEM 42: CONTRAST IS A PAIRING, NOT A SENTENCE ────────────────────────
  //
  // Sam: *"contrast is never actually a pairing"*. Bible `:225` — a heavy lift
  // SUPERSETS with an explosive lift, and *"the pairing sits at the MAIN slot"*.
  // Before this, `kind: 'contrast'` changed a NOTES STRING and nothing else:
  // no `supersetGroup`, no `supersetOrder`, no `pairType`, and the row rendered
  // BEFORE the heavy set its own note told the athlete to do it after.
  const pairedPower = powerRows(heavyLower.workout)[0];
  const pairedSquat = (heavyLower.workout.exercises ?? []).find((row) => row.id === 'we-squat');
  ok('[42a] the contrast power row carries a superset group',
    !!pairedPower?.supersetGroup, JSON.stringify(pairedPower));
  ok('[42b] the HEAVY LIFT carries the SAME group — a pairing has two halves',
    !!pairedSquat?.supersetGroup && pairedSquat.supersetGroup === pairedPower?.supersetGroup,
    { squat: pairedSquat?.supersetGroup, power: pairedPower?.supersetGroup });
  ok('[42c] the heavy lift is FIRST and the explosive movement SECOND',
    pairedSquat?.supersetOrder === 1 && pairedPower?.supersetOrder === 2,
    { squat: pairedSquat?.supersetOrder, power: pairedPower?.supersetOrder });
  ok('[42d] both halves are typed as contrast',
    pairedSquat?.pairType === 'contrast' && pairedPower?.pairType === 'contrast',
    { squat: pairedSquat?.pairType, power: pairedPower?.pairType });
  // NON-VACUITY: the bike is same-workout but not the partner. If the pairing
  // were applied to every row this would red, and [42b] alone would not notice.
  const unpairedBike = (heavyLower.workout.exercises ?? []).find((row) => row.id === 'we-bike');
  ok('[42e] a non-partner row in the same session is NOT dragged into the pairing',
    !unpairedBike?.supersetGroup && !unpairedBike?.pairType, JSON.stringify(unpairedBike));
  // NON-VACUITY: the downgrade path must NOT pair. Without a heavy same-family
  // lift there is nothing to contrast against, so a group here would be a
  // pairing to a partner that does not exist.
  ok('[42f] a downgraded primer is never paired',
    !powerRows(lightLower.workout)[0]?.supersetGroup,
    JSON.stringify(powerRows(lightLower.workout)[0]));
}

// Deload week → power SURVIVES, smaller and just as sharp.
//
// Sam's deload law (2026-07-27), Bible §14: "Power/speed: KEEP a small sharp
// dose — few reps, full recovery, stop the moment speed drops. Power is not
// removed on a deload; a deload is not a reason to lose sharpness." This block
// used to assert the opposite. Three properties, because "power is present" on
// its own would pass with an unshrunk dose, and "the dose shrank" on its own
// would pass with a swapped exercise:
//
//   1. the primer is there at all,
//   2. it carries FEWER SETS than the same athlete's normal week,
//   3. the reps and the EXERCISE are unchanged — the deload law changes the
//      work, not the structure, and `reduced` (the niggle flag that hands the
//      lower slot to Pogo Hops) is deliberately not set by the shrink.
{
  const normal = workoutsFor(profile());
  const deload = workoutsFor(profile(), 'deload');
  const normalBlocks = normal.filter((w) => powerRows(w).length > 0);
  const deloadBlocks = deload.filter((w) => powerRows(w).length > 0);

  ok('deload week still renders power', deloadBlocks.length >= 1,
    deload.map((w) => `${w.dayOfWeek}:${powerRows(w).length > 0 ? 'POWER' : '-'}`).join(' | '));

  const normalSets = powerRows(normalBlocks[0])[0]?.prescribedSets ?? 0;
  const deloadSets = powerRows(deloadBlocks[0])[0]?.prescribedSets ?? 0;
  ok('the deload dose is SMALLER than the normal week\'s', deloadSets < normalSets,
    `normal=${normalSets} deload=${deloadSets}`);
  ok('the deload dose keeps at least one working set', deloadSets >= 1, `${deloadSets}`);

  const normalOption = powerRows(normalBlocks[0])[0];
  const deloadOption = powerRows(deloadBlocks[0])[0];
  ok('the deload keeps the same EXERCISE — structure holds, work shrinks',
    !!normalOption && !!deloadOption &&
      normalOption.exercise?.name === deloadOption.exercise?.name,
    `normal=${normalOption?.exercise?.name} deload=${deloadOption?.exercise?.name}`);
  ok('the deload keeps the rep range — the dose stays sharp',
    !!normalOption && !!deloadOption &&
      normalOption.prescribedRepsMin === deloadOption.prescribedRepsMin &&
      normalOption.prescribedRepsMax === deloadOption.prescribedRepsMax,
    `normal=${normalOption?.prescribedRepsMin}-${normalOption?.prescribedRepsMax} deload=${deloadOption?.prescribedRepsMin}-${deloadOption?.prescribedRepsMax}`);
}

// The power block is BODYWEIGHT-ONLY and equipment-independent.
//
// Sam retired the whole medicine-ball family (Chest Pass and Slam 2026-07-24,
// Overhead Throw 2026-07-25), so `buildPowerBlock` no longer branches on
// equipment at all. These assertions used to prove the med-ball alternate
// appeared only when a ball was available; they now prove the stronger and
// simpler property — owning a medicine ball changes nothing, and no power
// option ever demands an implement the athlete may not have.
{
  const noBall = workoutsFor(profile({ equipment: ['Barbell', 'Dumbbells', 'Bench'] }));
  const withBall = workoutsFor(profile({ equipment: ['Barbell', 'Dumbbells', 'Bench', 'Medicine Ball'] }));
  const blocks = [...noBall, ...withBall].flatMap((w) => powerRows(w));

  ok('every power option needs no equipment at all',
    blocks.every((r) => (r.exercise?.equipmentRequired ?? []).length === 0),
    blocks.map((r) => `${r.exercise?.name}[${(r.exercise?.equipmentRequired ?? []).join(',')}]`).join(' | '));

  ok('no medicine-ball option is offered, with or without a ball',
    blocks.every((r) => !/medicine ball/i.test(r.exercise?.name ?? '')));

  // Equipment-independence, proven by comparison rather than asserted: the same
  // athlete with and without a ball gets byte-identical power options.
  const names = (ws: typeof noBall) =>
    ws.flatMap((w) => powerRows(w)).map((r) => r.exercise?.name ?? '').join(' | ');
  ok('owning a medicine ball changes no power option',
    names(noBall) === names(withBall),
    `noBall="${names(noBall)}"\n      withBall="${names(withBall)}"`);
}

// Healthy default: strength exercise content is unchanged by the power layer
// (power lives in its own block; exercises[] are untouched).
{
  const ws = workoutsFor(profile());
  const strengthWorkouts = ws.filter((w) => w.workoutType === 'Strength');
  ok('strength workouts still have their strength exercises', strengthWorkouts.every((w) => w.exercises.length > 0));
}

console.log(`\nSummary: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  failures.forEach((name) => console.log(`  - ${name}`));
  process.exit(1);
}
