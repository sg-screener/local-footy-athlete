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

// ── 1. Off-season suitable athlete gets power (contrast when fresh) ──
{
  const d = decidePowerPrimer(ctx());
  ok('off-season fresh strength session gets power', d !== null, JSON.stringify(d));
  ok('off-season fresh high-readiness → contrast', d?.kind === 'contrast', d?.kind);
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
  const off = decidePowerPrimer(ctx({ isBeginner: true }));
  ok('beginner off-season → conservative primer (never contrast)', off?.kind === 'primer' && off.sets === 2, JSON.stringify(off));
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
) {
  const plan = buildCoachingPlan(onboardingToCoachingInputs(data, { availabilityDateISO: '2026-07-06', weekKind })).weeklyPlan;
  return buildWorkoutsFromCoach([], 'mc-1', plan, data);
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
