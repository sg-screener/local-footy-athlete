/**
 * trainAroundEngineTests — proves the engine makes correct movement-
 * pattern decisions across the 5 acceptance scenarios:
 *   shoulder 8/10, hamstring 8/10, knee 8/10, lowerBack 8/10, calf 8/10.
 *
 * The engine is NOT a rehab engine. We:
 *   - REMOVE red exercises (no fake substitutions)
 *   - KEEP green exercises
 *   - escalate amber → red at severe tier
 *   - pass coachNotes through globalRules
 *   - final-validation sweep catches any survivors
 *
 * Run: npm run test:train-around-engine
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  classifyExercisePatterns,
  classifyExercise,
  getTrainAroundPolicy,
  applyTrainAroundPolicy,
  validateAgainstPolicy,
  severityToTier,
} from '../utils/trainAroundEngine';
import type { Workout } from '../types/domain';
import { projectVisibleDay } from '../utils/visibleProgramProjection';
import type { ResolvedDay } from '../utils/sessionResolver';

// ─── Harness ─────────────────────────────────────────────────────────
let pass = 0;
let fail = 0;
const failures: string[] = [];
function ok(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  \u2713 ${name}`); }
  else {
    fail++;
    failures.push(name);
    console.log(`  \u2717 ${name}${detail ? '\n      ' + detail : ''}`);
  }
}
function eq<T>(name: string, a: T, b: T) {
  ok(name, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function section(label: string) { console.log(`\n${label}`); }

// ─── Fixtures ────────────────────────────────────────────────────────
function ex(name: string): any {
  return {
    id: `we-${name}`, workoutId: 'wk', exerciseId: `ex-${name}`,
    exerciseOrder: 0, prescribedSets: 3, prescribedRepsMin: 6, prescribedRepsMax: 8,
    prescribedWeightKg: 0, restSeconds: 0,
    exercise: {
      id: `ex-${name}`, name, description: name,
      exerciseType: 'Compound', muscleGroups: [], equipmentRequired: [],
      difficultyLevel: 'Intermediate', createdAt: '', updatedAt: '',
    },
    createdAt: '', updatedAt: '',
  };
}
function wk(name: string, exercises: any[], opts: any = {}): Workout {
  return {
    id: 'w', microcycleId: 'mc', dayOfWeek: 1,
    name, description: '', durationMinutes: 60,
    intensity: 'Moderate' as any,
    workoutType: opts.workoutType || ('Strength' as any),
    sessionTier: opts.sessionTier || ('core' as any),
    exercises, createdAt: '', updatedAt: '',
    coachNotes: opts.coachNotes,
  } as Workout;
}
function day(date: string, workout: Workout | null): ResolvedDay {
  const [y, m, d] = date.split('-').map(Number);
  return {
    date,
    dayOfWeek: new Date(y, m - 1, d, 12, 0, 0, 0).getDay(),
    short: 'MON', isToday: false, workout, source: 'template', indicator: null,
  } as any;
}

// ─────────────────────────────────────────────────────────────────────
// 1. Severity → tier
// ─────────────────────────────────────────────────────────────────────
section('[1] severityToTier');
eq('1/10 → minor', severityToTier(1), 'minor');
eq('3/10 → minor', severityToTier(3), 'minor');
eq('4/10 → moderate', severityToTier(4), 'moderate');
eq('6/10 → severe', severityToTier(6), 'severe');
eq('7/10 → severe', severityToTier(7), 'severe');
eq('10/10 → severe', severityToTier(10), 'severe');

// ─────────────────────────────────────────────────────────────────────
// 2. Movement classifier — AI-named variants must map correctly
// ─────────────────────────────────────────────────────────────────────
section('[2] classifyExercisePatterns — AI-name robustness');
ok(
  'Incline DB Press → horizontal_press',
  classifyExercisePatterns('Incline DB Press').includes('horizontal_press'),
);
ok(
  'Single Arm Half Kneeling DB OHP → vertical_press + overhead_loading',
  classifyExercisePatterns('Single Arm Half Kneeling DB OHP').includes('vertical_press') &&
  classifyExercisePatterns('Single Arm Half Kneeling DB OHP').includes('overhead_loading'),
);
ok(
  'Explosive Push-Ups → explosive_push + horizontal_press',
  classifyExercisePatterns('Explosive Push-Ups').includes('explosive_push') &&
  classifyExercisePatterns('Explosive Push-Ups').includes('horizontal_press'),
);
ok(
  'Slider Hamstring Curl → posterior_chain',
  classifyExercisePatterns('Slider Hamstring Curl').includes('posterior_chain'),
);
ok(
  'Romanian Deadlift → hinge + posterior_chain',
  classifyExercisePatterns('Romanian Deadlift').includes('hinge') &&
  classifyExercisePatterns('Romanian Deadlift').includes('posterior_chain'),
);
ok(
  'Trap Bar Deadlift → hinge + posterior_chain + heavy_pull',
  classifyExercisePatterns('Trap Bar Deadlift').includes('hinge') &&
  classifyExercisePatterns('Trap Bar Deadlift').includes('heavy_pull'),
);
ok(
  'Box Jump → plyometric',
  classifyExercisePatterns('Box Jump').includes('plyometric'),
);
ok(
  'Bulgarian Split Squat → lunge + knee_dominant',
  classifyExercisePatterns('Bulgarian Split Squat').includes('lunge') &&
  classifyExercisePatterns('Bulgarian Split Squat').includes('knee_dominant'),
);
ok(
  'Goblet Squat → squat + knee_dominant',
  classifyExercisePatterns('Goblet Squat').includes('squat') &&
  classifyExercisePatterns('Goblet Squat').includes('knee_dominant'),
);
ok(
  'Lateral Raise → shoulder_isolation',
  classifyExercisePatterns('Lateral Raise').includes('shoulder_isolation'),
);
ok(
  'Pendlay Row → heavy_pull',
  classifyExercisePatterns('Pendlay Row').includes('heavy_pull'),
);
ok(
  'Calf Raise → calf_achilles',
  classifyExercisePatterns('Calf Raise').includes('calf_achilles'),
);
ok(
  '10m Sprint → sprint + running',
  classifyExercisePatterns('10m Sprint').includes('sprint') &&
  classifyExercisePatterns('10m Sprint').includes('running'),
);
ok(
  'Farmer Carry → loaded_carry',
  classifyExercisePatterns('Farmer Carry').includes('loaded_carry'),
);
ok(
  'Copenhagen Plank → adductor_groin',
  classifyExercisePatterns('Copenhagen Plank').includes('adductor_groin'),
);
ok(
  'Stretching → mobility (no false hits)',
  classifyExercisePatterns('Quad Stretch').includes('mobility'),
);

// ─────────────────────────────────────────────────────────────────────
// 3. SHOULDER 8/10 — pressing, OHP, push-ups, lateral raise → all RED
// ─────────────────────────────────────────────────────────────────────
section('[3] Shoulder 8/10 — removes ALL pressing / overhead / explosive push');
{
  const policy = getTrainAroundPolicy('shoulder', 8);
  ok('policy resolved', !!policy);
  eq('tier', policy?.severityTier, 'severe');

  for (const name of [
    'Lateral Raise',
    'Incline DB Press',
    'Bench Press',
    'Single Arm Half Kneeling DB OHP',
    'Explosive Push-Ups',
    'Push Press',
    'Pull-Up',           // heavy_pull → red at severe shoulder
    'Farmer Carry',      // loaded_carry → red
  ]) {
    const decision = classifyExercise(name, policy!);
    ok(`${name} → red`, decision.decision === 'red', decision.reason);
  }

  for (const name of [
    'Goblet Squat',
    'Back Squat',
    'Trap Bar Deadlift', // hinge/heavy_pull — heavy_pull is red for shoulder severe
  ]) {
    const decision = classifyExercise(name, policy!);
    if (name === 'Trap Bar Deadlift') {
      ok(`${name} → red (heavy_pull)`, decision.decision === 'red');
    } else {
      ok(`${name} → green`, decision.decision === 'green');
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// 4. HAMSTRING 8/10 — sprint, deadlift, nordic, plyo → all RED
// ─────────────────────────────────────────────────────────────────────
section('[4] Hamstring 8/10 — removes sprint, hinge, plyo, posterior chain');
{
  const policy = getTrainAroundPolicy('hamstring', 8);
  ok('policy resolved', !!policy);
  eq('tier', policy?.severityTier, 'severe');

  for (const name of [
    '10m Sprint',
    'Tempo Run',
    'Romanian Deadlift',
    'Trap Bar Deadlift',
    'Slider Hamstring Curl',
    'Nordic Lower',
    'Box Jump',           // plyometric → red
    'Hill Sprints',
    'Good Morning',
  ]) {
    const decision = classifyExercise(name, policy!);
    ok(`${name} → red`, decision.decision === 'red', decision.reason);
  }

  // Upper body should be safe.
  for (const name of [
    'Bench Press',
    'Lateral Raise',
    'Pull-Up',
    'Push Press',
  ]) {
    const decision = classifyExercise(name, policy!);
    ok(`${name} → green`, decision.decision === 'green', decision.reason);
  }
}

// ─────────────────────────────────────────────────────────────────────
// 5. KNEE 8/10 — squat, lunge, plyo, sprint → all RED
// ─────────────────────────────────────────────────────────────────────
section('[5] Knee 8/10 — removes squat, lunge, plyometric, sprint');
{
  const policy = getTrainAroundPolicy('knee', 8);
  ok('policy resolved', !!policy);

  for (const name of [
    'Back Squat',
    'Goblet Squat',
    'Bulgarian Split Squat',
    'Reverse Lunge',
    'Box Jump',
    'Depth Jump',
    '10m Sprint',
    'Leg Press',
  ]) {
    const decision = classifyExercise(name, policy!);
    ok(`${name} → red`, decision.decision === 'red', decision.reason);
  }

  // Upper body + bike → green.
  for (const name of [
    'Bench Press',
    'Pull-Up',
    'Assault Bike',
    'Lateral Raise',
  ]) {
    const decision = classifyExercise(name, policy!);
    ok(`${name} → green`, decision.decision === 'green', decision.reason);
  }
}

// ─────────────────────────────────────────────────────────────────────
// 6. LOWER BACK 8/10 — heavy hinge, axial load, carries → RED
// ─────────────────────────────────────────────────────────────────────
section('[6] Lower back 8/10 — removes hinge, heavy pull, axial squat, carries');
{
  const policy = getTrainAroundPolicy('lowerBack', 8);
  ok('policy resolved', !!policy);

  for (const name of [
    'Trap Bar Deadlift',
    'Romanian Deadlift',
    'Back Squat',
    'Pendlay Row',
    'Farmer Carry',
    'Good Morning',
  ]) {
    const decision = classifyExercise(name, policy!);
    ok(`${name} → red`, decision.decision === 'red', decision.reason);
  }

  // Supported upper body and bike → green.
  for (const name of [
    'Bench Press',
    'Lateral Raise',
    'Assault Bike',
  ]) {
    const decision = classifyExercise(name, policy!);
    ok(`${name} → green`, decision.decision === 'green', decision.reason);
  }
}

// ─────────────────────────────────────────────────────────────────────
// 7. CALF 8/10 — sprints, plyos, calf raises → RED
// ─────────────────────────────────────────────────────────────────────
section('[7] Calf 8/10 — removes sprint, plyometric, calf raises');
{
  const policy = getTrainAroundPolicy('calf', 8);
  ok('policy resolved', !!policy);

  for (const name of [
    '10m Sprint',
    'Box Jump',
    'Calf Raise',
    'Tempo Run',
  ]) {
    const decision = classifyExercise(name, policy!);
    ok(`${name} → red`, decision.decision === 'red', decision.reason);
  }

  // Hip-dominant + bike + upper → green.
  for (const name of [
    'Romanian Deadlift',
    'Bench Press',
    'Assault Bike',
  ]) {
    const decision = classifyExercise(name, policy!);
    ok(`${name} → green`, decision.decision === 'green', decision.reason);
  }
}

// ─────────────────────────────────────────────────────────────────────
// 8. applyTrainAroundPolicy — session-level removal + coachNotes
// ─────────────────────────────────────────────────────────────────────
section('[8] applyTrainAroundPolicy — shoulder 8/10 session');
{
  const policy = getTrainAroundPolicy('shoulder', 8)!;
  const workout = wk('Upper Push', [
    ex('Incline DB Press'),
    ex('Lateral Raise'),
    ex('Single Arm Half Kneeling DB OHP'),
    ex('Explosive Push-Ups'),
    ex('Goblet Squat'),     // green — kept
    ex('Pallof Press'),     // trunk — kept
  ]);
  const result = applyTrainAroundPolicy(workout, policy);
  ok('policy applied', result.policyApplied);
  ok('impact high', result.impact === 'high');
  ok('Goblet Squat kept', result.kept.includes('Goblet Squat'));
  ok('Pallof Press kept', result.kept.includes('Pallof Press'));
  ok('Incline DB Press removed', result.removed.some((r) => r.name === 'Incline DB Press'));
  ok('OHP removed', result.removed.some((r) => r.name === 'Single Arm Half Kneeling DB OHP'));
  ok('Explosive Push-Ups removed', result.removed.some((r) => r.name === 'Explosive Push-Ups'));
  ok('Lateral Raise removed', result.removed.some((r) => r.name === 'Lateral Raise'));

  const notes = result.workout.coachNotes ?? [];
  ok('coachNote includes No heavy pressing', notes.some((n) => /no heavy pressing/i.test(n)));
  ok('coachNote includes No overhead loading', notes.some((n) => /no overhead/i.test(n)));
  ok('coachNote includes No explosive push work', notes.some((n) => /explosive push/i.test(n)));
  ok('coachNote includes Removed: per exercise', notes.some((n) => /removed:/i.test(n)));
}

// ─────────────────────────────────────────────────────────────────────
// 9. applyTrainAroundPolicy — recovery untouched, game untouched
// ─────────────────────────────────────────────────────────────────────
section('[9] Recovery + game sessions untouched');
{
  const policy = getTrainAroundPolicy('shoulder', 8)!;
  const recovery = wk('Active Recovery', [ex('Foam Roll')], { workoutType: 'Recovery', sessionTier: 'recovery' });
  const recR = applyTrainAroundPolicy(recovery, policy);
  ok('recovery → not applied', !recR.policyApplied);
  ok('recovery exercises kept', recR.workout.exercises.length === 1);

  const game = wk('Game', [], { workoutType: 'Game' });
  const gameR = applyTrainAroundPolicy(game, policy);
  ok('game → not applied', !gameR.policyApplied);
}

// ─────────────────────────────────────────────────────────────────────
// 10. validateAgainstPolicy — catches survivors
// ─────────────────────────────────────────────────────────────────────
section('[10] validateAgainstPolicy — final consistency sweep');
{
  const policy = getTrainAroundPolicy('shoulder', 8)!;
  // Pretend an earlier pass missed Bench Press.
  const surviving = wk('Upper', [ex('Bench Press'), ex('Goblet Squat')]);
  const result = validateAgainstPolicy(surviving, policy);
  ok('not passed (Bench survives)', !result.passed);
  ok('Bench Press flagged', result.violations.some((v) => v.exercise === 'Bench Press'));
  ok('Goblet Squat NOT flagged', !result.violations.some((v) => v.exercise === 'Goblet Squat'));

  const cleaned = wk('Upper', [ex('Goblet Squat'), ex('Pallof Press')]);
  const ok2 = validateAgainstPolicy(cleaned, policy);
  ok('clean session passes', ok2.passed);
  eq('zero violations', ok2.violations.length, 0);
}

// ─────────────────────────────────────────────────────────────────────
// 11. Minor tier (3/10) — most things kept
// ─────────────────────────────────────────────────────────────────────
section('[11] Minor tier — most exercises stay green');
{
  const policy = getTrainAroundPolicy('hamstring', 3)!;
  eq('tier minor', policy.severityTier, 'minor');
  // Sprint moves from red(severe) to amber(minor) — at minor amber stays amber, kept.
  for (const name of ['Romanian Deadlift', 'Box Jump', '10m Sprint', 'Bench Press', 'Goblet Squat']) {
    const decision = classifyExercise(name, policy);
    ok(`${name} not red at minor`, decision.decision !== 'red', decision.reason);
  }
}

// ─────────────────────────────────────────────────────────────────────
// 12. INTEGRATION — projectVisibleDay end-to-end with shoulder 8/10
// ─────────────────────────────────────────────────────────────────────
section('[12] Integration — shoulder 8/10 visible projection');
{
  const TODAY_ISO = '2026-04-29';
  const NEXT_MON = '2026-05-04';
  const workout = wk('Upper Push', [
    ex('Incline DB Press'),
    ex('Lateral Raise'),
    ex('Single Arm Half Kneeling DB OHP'),
    ex('Explosive Push-Ups'),
    ex('Goblet Squat'),
  ]);
  const out = projectVisibleDay({
    day: day(NEXT_MON, workout),
    activeInjury: {
      bodyPart: 'shoulder',
      bucket: 'shoulder',
      severity: 8,
      status: 'active',
      rules: [],
    },
    todayISO: TODAY_ISO,
  });
  ok('projection applied', out.injuryFilterApplied);
  const names = (out.day.workout?.exercises ?? []).map((e: any) => e.exercise?.name);
  ok('Incline DB Press gone', !names.includes('Incline DB Press'));
  ok('Lateral Raise gone', !names.includes('Lateral Raise'));
  ok('Single Arm Half Kneeling DB OHP gone', !names.includes('Single Arm Half Kneeling DB OHP'));
  ok('Explosive Push-Ups gone', !names.includes('Explosive Push-Ups'));
  ok('Goblet Squat preserved', names.includes('Goblet Squat'));
  const notes = out.day.workout?.coachNotes ?? [];
  ok('coachNote includes No overhead', notes.some((n) => /no overhead/i.test(n)));
}

// ─────────────────────────────────────────────────────────────────────
// 13. INTEGRATION — hamstring 8/10 visible projection
// ─────────────────────────────────────────────────────────────────────
section('[13] Integration — hamstring 8/10 visible projection');
{
  const TODAY_ISO = '2026-04-29';
  const NEXT_MON = '2026-05-04';
  const workout = wk('Lower Body Strength', [
    ex('Trap Bar Deadlift'),
    ex('Slider Hamstring Curl'),
    ex('Box Jump'),
    ex('10m Sprint'),
    ex('Goblet Squat'),
  ]);
  const out = projectVisibleDay({
    day: day(NEXT_MON, workout),
    activeInjury: {
      bodyPart: 'hamstring',
      bucket: 'hamstring',
      severity: 8,
      status: 'active',
      rules: [],
    },
    todayISO: TODAY_ISO,
  });
  ok('projection applied', out.injuryFilterApplied);
  const names = (out.day.workout?.exercises ?? []).map((e: any) => e.exercise?.name);
  ok('Trap Bar Deadlift gone', !names.includes('Trap Bar Deadlift'));
  ok('Slider Hamstring Curl gone', !names.includes('Slider Hamstring Curl'));
  ok('Box Jump gone (severe → plyo red)', !names.includes('Box Jump'));
  ok('10m Sprint gone', !names.includes('10m Sprint'));
  ok('Goblet Squat preserved (squat kept at hammy severe)', names.includes('Goblet Squat'));
}

// ─── Summary ───
console.log(`\n— Summary —`);
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);
if (fail > 0) {
  console.log(`\n— Failures —`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
process.exit(0);
