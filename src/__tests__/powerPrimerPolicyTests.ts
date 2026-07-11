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
import { alignPowerBlockToFinalWorkoutContent } from '../rules/powerBlockContentAlignment';

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
  isDeload: false,
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

// ── 3. Deload + low readiness block power ──
{
  ok('deload blocks power', decidePowerPrimer(ctx({ isDeload: true })) === null);
  ok('low readiness blocks power', decidePowerPrimer(ctx({ readiness: 'low' })) === null);
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
  ok('nudge cannot create power in deload', decidePowerPrimer(ctx({ isDeload: true, powerGoalNudge: true })) === null);
  ok('nudge cannot override injury', decidePowerPrimer(ctx({ injuries: [{ area: 'groin strain', severity: 6 }], powerGoalNudge: true })) === null);
}

// ══════════════════ INTEGRATION (rendered powerBlock) ══════════════════

const OFF_PROFILE: OnboardingData = {
  seasonPhase: 'Off-season',
  position: 'key_position_ruck_tall',
  trainingDaysPerWeek: 4,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Thursday', 'Saturday'],
  teamTrainingDaysPerWeek: 0,
  teamTrainingDays: [],
  sessionDurationMinutes: 60,
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
  const plan = buildCoachingPlan(onboardingToCoachingInputs(data, {
    availabilityDateISO: '2026-07-06',
    miniCycleNumber: 1,
    weekNumber: weekInBlock,
    weekInBlock,
    weekKind,
  })).weeklyPlan;
  return buildWorkoutsFromCoach([], 'mc-1', plan, data, {
    miniCycleNumber: 1,
    weekInBlock,
    weekStartISO: '2026-07-06',
    weekKind,
  });
}

// Early off-season must stay a true base-rebuild week with no hidden primer.
{
  const ws = workoutsFor(profile(), undefined, 1);
  ok('early off-season rendered workouts have no powerBlock', ws.every((w) => !w.powerBlock),
    ws.map((w) => `${w.dayOfWeek}:${w.powerBlock ? 'POWER' : '-'}`).join(' | '));
}

// Off-season suitable athlete → at least one strength session carries a powerBlock.
{
  const ws = workoutsFor(profile());
  const withPower = ws.filter((w) => w.powerBlock);
  ok('off-season suitable athlete gets a rendered powerBlock', withPower.length >= 1,
    ws.map((w) => `${w.dayOfWeek}:${w.powerBlock ? w.powerBlock.kind : '-'}`).join(' | '));

  const pb = withPower[0]?.powerBlock;
  ok('powerBlock is NOT conditioning (credit none)', pb?.counting.conditioningCredit === 'none');
  ok('powerBlock is NOT a finisher', pb?.counting.isFinisher === false);
  ok('powerBlock is NOT a hard exposure', pb?.counting.hardExposure === false);
  ok('powerBlock placed pre-lift', pb?.placement === 'pre_lift');

  // Power moves must not leak into the exercises list (classifiers read that).
  const powerNames = /vertical jump|explosive push|pogo|medicine ball|broad jump|box jump/i;
  const leaked = ws.some((w) => w.exercises.some((ex) => powerNames.test(ex.exercise?.name || '')));
  ok('power moves never leak into workout.exercises', !leaked);

  const overlay = buildWeekScopedWorkoutOverlay({
    program: {
      id: 'power-overlay-program',
      microcycles: [{ id: 'power-overlay-microcycle', workouts: [withPower[0]] }],
    } as any,
    weekStart: '2026-07-06',
    anchorDate: '2026-07-11',
    reason: 'one_off_game',
  });
  const clonedPower = Object.values(overlay.workoutsByDate)
    .find((workout) => !!workout?.powerBlock)
    ?.powerBlock;
  ok('week rebuild overlay preserves powerBlock title', clonedPower?.title === pb?.title);
  ok('week rebuild overlay preserves powerBlock prescription', clonedPower?.prescription === pb?.prescription);
  ok('week rebuild overlay preserves powerBlock exercise options',
    JSON.stringify(clonedPower?.options) === JSON.stringify(pb?.options));
}

// Final rows own the visible power identity. Contrast requires a real heavy
// same-family lift; stale power metadata cannot survive a conditioning shell.
{
  const contrastBlock = {
    id: 'power-alignment',
    kind: 'contrast',
    family: 'lower',
    title: 'Contrast Power',
    prescription: '3 x 3 — full rest, fast & sharp',
    placement: 'pre_lift',
    options: [{ name: 'Vertical Jump', sets: 3, repsMin: 3, repsMax: 3, equipmentRequired: [] }],
    notes: ['Contrast: perform sharply straight after your heavy set, then rest fully.'],
    counting: {
      hardExposure: false,
      mainStrength: false,
      conditioningCredit: 'none',
      isFinisher: false,
    },
  } as const;

  const conditioningOnly = alignPowerBlockToFinalWorkoutContent({
    id: 'conditioning-only-power',
    microcycleId: 'mc-1',
    name: 'Bike Tempo',
    dayOfWeek: 'Monday',
    orderIndex: 0,
    workoutType: 'Conditioning',
    exercises: [{
      id: 'we-bike',
      workoutId: 'conditioning-only-power',
      exerciseId: 'ex-bike',
      exercise: { id: 'ex-bike', name: 'Bike Tempo' },
      prescribedSets: 3,
      prescribedRepsMin: 8,
      prescribedRepsMax: 8,
      restSeconds: 120,
    }],
    powerBlock: contrastBlock,
  } as any);
  ok('conditioning-only final workout cannot carry power',
    conditioningOnly.action === 'removed' && !conditioningOnly.workout.powerBlock,
    JSON.stringify(conditioningOnly));

  const lightLower = alignPowerBlockToFinalWorkoutContent({
    id: 'light-lower-power',
    microcycleId: 'mc-1',
    name: 'Lower Support',
    dayOfWeek: 'Tuesday',
    orderIndex: 1,
    workoutType: 'Strength',
    exercises: [{
      id: 'we-goblet',
      workoutId: 'light-lower-power',
      exerciseId: 'ex-goblet',
      exercise: { id: 'ex-goblet', name: 'Goblet Squat' },
      prescribedSets: 3,
      prescribedRepsMin: 10,
      prescribedRepsMax: 12,
      restSeconds: 90,
    }],
    powerBlock: contrastBlock,
  } as any);
  ok('power without a heavy same-family lift is labelled primer, not contrast',
    lightLower.action === 'downgraded'
      && lightLower.workout.powerBlock?.kind === 'primer'
      && lightLower.workout.powerBlock?.title === 'Power Primer',
    JSON.stringify(lightLower));

  const heavyLower = alignPowerBlockToFinalWorkoutContent({
    id: 'heavy-lower-power',
    microcycleId: 'mc-1',
    name: 'Lower Strength',
    dayOfWeek: 'Thursday',
    orderIndex: 2,
    workoutType: 'Strength',
    hasCombinedConditioning: true,
    exercises: [
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
    powerBlock: contrastBlock,
  } as any);
  ok('mixed S+C with real heavy same-family strength preserves contrast power',
    heavyLower.action === 'unchanged' && heavyLower.workout.powerBlock?.kind === 'contrast',
    JSON.stringify(heavyLower));
}

// Deload week → no powerBlock even for a suitable athlete.
{
  const ws = workoutsFor(profile(), 'deload');
  ok('deload week renders no powerBlock', ws.every((w) => !w.powerBlock),
    ws.map((w) => `${w.dayOfWeek}:${w.powerBlock ? 'POWER' : '-'}`).join(' | '));
}

// Equipment respected: med ball option only appears when a med ball is available.
{
  const noBall = workoutsFor(profile({ equipment: ['Barbell', 'Dumbbells', 'Bench'] }));
  const noBallBlocks = noBall.filter((w) => w.powerBlock);
  ok('without a med ball, every power option is bodyweight-feasible',
    noBallBlocks.every((w) => (w.powerBlock!.options[0].equipmentRequired.length === 0)
      && w.powerBlock!.options.every((o) => o.equipmentRequired.every((eq) => !/ball/i.test(eq) || false) || o.equipmentRequired.length === 0)),
    'first option should need no equipment');
  ok('without a med ball, no medicine-ball option is offered',
    noBallBlocks.every((w) => w.powerBlock!.options.every((o) => !/medicine ball/i.test(o.name))));

  const withBall = workoutsFor(profile({ equipment: ['Barbell', 'Dumbbells', 'Bench', 'Medicine Ball'] }));
  const withBallBlocks = withBall.filter((w) => w.powerBlock);
  ok('with a med ball, a medicine-ball option is offered on at least one power block',
    withBallBlocks.some((w) => w.powerBlock!.options.some((o) => /medicine ball/i.test(o.name))),
    withBallBlocks.map((w) => w.powerBlock!.options.map((o) => o.name).join('/')).join(' | '));
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
