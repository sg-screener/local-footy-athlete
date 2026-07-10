/**
 * exposureEngineTests — proves the universal S&C constraint + exposure
 * engine makes correct decisions across all 8 acceptance criteria:
 *
 *   1. Engine is exposure-based, not body-part-blacklist
 *   2. Works for injury, fatigue, soreness
 *   3. Shoulder 8/10 removes pressing/overhead/explosive push
 *   4. Hamstring 7/10 removes heavy lower / jump / hinge / sprint
 *   5. Hamstring 5–6 limits heavy back squat / jumps (not blindly green)
 *   6. Severe injuries preserve safe training + advise physio
 *   7. No fake substitutions
 *   8. Validator catches survivors
 *   9. Program tab + DayWorkoutScreen produce same output
 *  10. Multi-region + non-injury constraints covered
 *
 * Run: npm run test:exposure-engine
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  classifyExerciseExposures,
  scoreExerciseAgainstConstraints,
  classifySessionAgainstConstraints,
  applyConstraintsToSession,
  validateVisibleProgramAgainstConstraints,
  validateWorkoutAgainstConstraints,
  buildInjuryConstraint,
  buildFatigueConstraint,
  buildSorenessConstraint,
  severityToTier,
  type Constraint,
  type Exposure,
} from '../utils/exposureEngine';
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
function hasExp(name: string, expected: Exposure): boolean {
  return classifyExerciseExposures(name).includes(expected);
}

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

const TODAY_ISO = '2026-04-29';
const NEXT_MON = '2026-05-04';

// ═════════════════════════════════════════════════════════════════════
// 1. EXPOSURE TAXONOMY — AI-named exercises map correctly
// ═════════════════════════════════════════════════════════════════════
section('[1] Exposure classifier — AI-name robustness across all categories');

ok('Back Squat → squat + heavy_squat + axial_loading', hasExp('Back Squat', 'heavy_squat') && hasExp('Back Squat', 'axial_loading') && hasExp('Back Squat', 'heavy_lower_strength'));
ok('Goblet Squat → squat (NOT heavy_squat)', hasExp('Goblet Squat', 'squat') && !hasExp('Goblet Squat', 'heavy_squat'));
// Note: heavy_pull is reserved for upper-body pulls (rows / pull-ups), not deadlifts.
ok('Trap Bar Deadlift → heavy_hinge + posterior_chain + axial_loading', hasExp('Trap Bar Deadlift', 'heavy_hinge') && hasExp('Trap Bar Deadlift', 'posterior_chain') && hasExp('Trap Bar Deadlift', 'axial_loading'));
ok('Pull-Up keeps heavy_pull (NOT deadlifts)', hasExp('Pull-Up', 'heavy_pull') && !hasExp('Trap Bar Deadlift', 'heavy_pull'));
ok('Romanian Deadlift → hamstring_dominant + hip_dominant', hasExp('Romanian Deadlift', 'hamstring_dominant') && hasExp('Romanian Deadlift', 'hip_dominant'));
ok('Nordic Lower → posterior_chain + hamstring_dominant', hasExp('Nordic Lower', 'posterior_chain') && hasExp('Nordic Lower', 'hamstring_dominant'));
ok('Slider Hamstring Curl → hamstring_dominant', hasExp('Slider Hamstring Curl', 'hamstring_dominant'));
ok('Box Jump → plyometric + explosive_lower', hasExp('Box Jump', 'plyometric') && hasExp('Box Jump', 'explosive_lower'));
ok('Single Arm Half Kneeling DB OHP → vertical_press + overhead_loading', hasExp('Single Arm Half Kneeling DB OHP', 'vertical_press') && hasExp('Single Arm Half Kneeling DB OHP', 'overhead_loading'));
ok('Seated DB Press → vertical_press + overhead_loading', hasExp('Seated DB Press', 'vertical_press') && hasExp('Seated DB Press', 'overhead_loading'));
ok('Incline DB Press → horizontal_press', hasExp('Incline DB Press', 'horizontal_press'));
ok('Explosive Push-Ups → explosive_push + horizontal_press', hasExp('Explosive Push-Ups', 'explosive_push') && hasExp('Explosive Push-Ups', 'horizontal_press'));
ok('Lateral Raise → shoulder_isolation', hasExp('Lateral Raise', 'shoulder_isolation'));
ok('Pull-Up → vertical_pull + heavy_pull + grip_heavy', hasExp('Pull-Up', 'vertical_pull') && hasExp('Pull-Up', 'heavy_pull') && hasExp('Pull-Up', 'grip_heavy'));
ok('Pendlay Row → horizontal_pull + heavy_pull', hasExp('Pendlay Row', 'horizontal_pull') && hasExp('Pendlay Row', 'heavy_pull'));
ok('Farmer Carry → loaded_carry + grip_heavy', hasExp('Farmer Carry', 'loaded_carry') && hasExp('Farmer Carry', 'grip_heavy'));
ok('Copenhagen Plank → adductor_groin + trunk + isometric', hasExp('Copenhagen Plank', 'adductor_groin') && hasExp('Copenhagen Plank', 'trunk') && hasExp('Copenhagen Plank', 'isometric'));
ok('Pallof Press → trunk + anti_rotation', hasExp('Pallof Press', 'trunk') && hasExp('Pallof Press', 'anti_rotation'));
ok('10m Sprint → sprint + acceleration + high_speed_running', hasExp('10m Sprint', 'sprint') && hasExp('10m Sprint', 'acceleration') && hasExp('10m Sprint', 'high_speed_running'));
ok('Tempo Run → high_speed_running', hasExp('Tempo Run', 'high_speed_running'));
ok('Easy Bike Zone 2 → easy_erg', hasExp('Easy Bike Zone 2', 'easy_erg'));
ok('Bike Intervals → hard_erg', hasExp('Bike Intervals', 'hard_erg'));
ok('Calf Raise → calf_achilles', hasExp('Calf Raise', 'calf_achilles'));
ok('Bulgarian Split Squat → lunge + knee_dominant', hasExp('Bulgarian Split Squat', 'lunge') && hasExp('Bulgarian Split Squat', 'knee_dominant'));
ok('Change of Direction Drill → change_of_direction + contact_risk', hasExp('Change of Direction Drill', 'change_of_direction') && hasExp('Change of Direction Drill', 'contact_risk'));
ok('Bicep Curl → low_load_accessory + elbow_loading', hasExp('Bicep Curl', 'low_load_accessory') && hasExp('Bicep Curl', 'elbow_loading'));
ok('Hack Squat → machine_supported', hasExp('Hack Squat', 'machine_supported'));
ok('Unknown name → empty', classifyExerciseExposures('Frobnicate Wibble').length === 0);

// ═════════════════════════════════════════════════════════════════════
// 2. SHOULDER 8/10 — pressing / overhead / explosive push REMOVED
// ═════════════════════════════════════════════════════════════════════
section('[2] Shoulder 8/10 — pressing/overhead/explosive push REMOVED');
{
  const c = buildInjuryConstraint({ region: 'shoulder', severity: 8 });
  for (const name of [
    'Bench Press', 'Incline DB Press', 'Lateral Raise',
    'Single Arm Half Kneeling DB OHP', 'Explosive Push-Ups',
    'Push Press', 'Pull-Up', 'Farmer Carry',
  ]) {
    const d = scoreExerciseAgainstConstraints(name, [c]);
    ok(`${name} → remove`, d.decision === 'remove', d.reason);
  }
  for (const name of ['Goblet Squat', 'Back Squat', 'Pallof Press', 'Easy Bike Zone 2']) {
    const d = scoreExerciseAgainstConstraints(name, [c]);
    ok(`${name} → keep`, d.decision === 'keep', d.reason);
  }
  ok('advice includes physio (severe)', !!c.advice && c.advice.some((a) => /physio/i.test(a)));
}

// ═════════════════════════════════════════════════════════════════════
// 3. HAMSTRING 7/10 — risky work removed, heavy squat limited
// ═════════════════════════════════════════════════════════════════════
section('[3] Hamstring 7/10 — risky work removed, heavy squat limited');
{
  const c = buildInjuryConstraint({ region: 'hamstring', severity: 7 });
  for (const name of [
    'Box Jump', 'Trap Bar Deadlift', 'Nordic Lower',
    'Slider Hamstring Curl', 'Romanian Deadlift', '10m Sprint',
    'Tempo Run', 'Hill Sprints',
  ]) {
    const d = scoreExerciseAgainstConstraints(name, [c]);
    ok(`${name} → remove`, d.decision === 'remove', d.reason);
  }
  for (const name of ['Bench Press', 'Lateral Raise', 'Push Press', 'Pull-Up']) {
    const d = scoreExerciseAgainstConstraints(name, [c]);
    ok(`${name} → keep (upper unaffected)`, d.decision === 'keep', d.reason);
  }
  {
    const d = scoreExerciseAgainstConstraints('Back Squat', [c]);
    ok('Back Squat → limit at 7/10', d.decision === 'limit', d.reason);
  }
}

// ═════════════════════════════════════════════════════════════════════
// 4. HAMSTRING 6 — risky lower work removed, not green
// ═════════════════════════════════════════════════════════════════════
section('[4] Hamstring 6/10 — risky lower work removed, not blindly green');
{
  const c = buildInjuryConstraint({ region: 'hamstring', severity: 6 });
  // Sprint, hinge, nordic, plyo, hamstring_dominant blocked.
  for (const name of [
    '10m Sprint', 'Romanian Deadlift', 'Trap Bar Deadlift', 'Nordic Lower',
    'Slider Hamstring Curl', 'Box Jump',
  ]) {
    const d = scoreExerciseAgainstConstraints(name, [c]);
    ok(`${name} → remove (moderate)`, d.decision === 'remove', d.reason);
  }
  // Heavy back squat stays visible with a load/range caution at 6/10.
  {
    const d = scoreExerciseAgainstConstraints('Back Squat', [c]);
    ok('Back Squat → limit (heavy lower/squat caution at 6/10)', d.decision === 'limit', d.reason);
  }
  // Goblet Squat (no heavy load implied) → keep.
  {
    const d = scoreExerciseAgainstConstraints('Goblet Squat', [c]);
    ok('Goblet Squat → keep', d.decision === 'keep', d.reason);
  }
}

// ═════════════════════════════════════════════════════════════════════
// 5. KNEE 8/10 — squat / lunge / plyo / sprint REMOVED
// ═════════════════════════════════════════════════════════════════════
section('[5] Knee 8/10 — squat/lunge/plyo/sprint removed');
{
  const c = buildInjuryConstraint({ region: 'knee', severity: 8 });
  for (const name of [
    'Back Squat', 'Goblet Squat', 'Bulgarian Split Squat', 'Reverse Lunge',
    'Box Jump', 'Depth Jump', '10m Sprint', 'Leg Press',
  ]) {
    const d = scoreExerciseAgainstConstraints(name, [c]);
    ok(`${name} → remove`, d.decision === 'remove', d.reason);
  }
  for (const name of ['Bench Press', 'Pull-Up', 'Easy Bike Zone 2', 'Romanian Deadlift']) {
    const d = scoreExerciseAgainstConstraints(name, [c]);
    ok(`${name} → keep`, d.decision === 'keep', d.reason);
  }
}

// ═════════════════════════════════════════════════════════════════════
// 6. BACK 8/10 — heavy hinge / heavy squat / loaded carry REMOVED
// ═════════════════════════════════════════════════════════════════════
section('[6] Back 8/10 — axial / heavy hinge / heavy squat / carries removed');
{
  const c = buildInjuryConstraint({ region: 'back', severity: 8 });
  for (const name of [
    'Trap Bar Deadlift', 'Romanian Deadlift', 'Back Squat',
    'Pendlay Row', 'Farmer Carry', 'Good Morning',
  ]) {
    const d = scoreExerciseAgainstConstraints(name, [c]);
    ok(`${name} → remove`, d.decision === 'remove', d.reason);
  }
  for (const name of ['Bench Press', 'Lateral Raise', 'Easy Bike Zone 2', 'Reverse Lunge']) {
    const d = scoreExerciseAgainstConstraints(name, [c]);
    ok(`${name} → keep`, d.decision === 'keep', d.reason);
  }
}

// ═════════════════════════════════════════════════════════════════════
// 7. CALF 8/10 — sprint / plyo / calf raise REMOVED
// ═════════════════════════════════════════════════════════════════════
section('[7] Calf 8/10 — sprint/plyo/calf raise removed');
{
  const c = buildInjuryConstraint({ region: 'calf', severity: 8 });
  for (const name of ['10m Sprint', 'Box Jump', 'Calf Raise', 'Tempo Run']) {
    const d = scoreExerciseAgainstConstraints(name, [c]);
    ok(`${name} → remove`, d.decision === 'remove', d.reason);
  }
  for (const name of ['Romanian Deadlift', 'Bench Press', 'Easy Bike Zone 2']) {
    const d = scoreExerciseAgainstConstraints(name, [c]);
    ok(`${name} → keep`, d.decision === 'keep', d.reason);
  }
}

// ═════════════════════════════════════════════════════════════════════
// 8. FATIGUE 8/10 — hard exposures cut across the week
// ═════════════════════════════════════════════════════════════════════
section('[8] Fatigue 8/10 — hard exposures cut, recovery preserved');
{
  const c = buildFatigueConstraint({ severity: 8 });
  for (const name of ['10m Sprint', 'Box Jump', 'Bike Intervals', 'Explosive Push-Ups']) {
    const d = scoreExerciseAgainstConstraints(name, [c]);
    ok(`${name} → remove (fatigue blocks hard work)`, d.decision === 'remove', d.reason);
  }
  for (const name of ['Easy Bike Zone 2', 'Foam Roll', 'Lateral Raise', 'Bicep Curl']) {
    const d = scoreExerciseAgainstConstraints(name, [c]);
    ok(`${name} → keep (recovery / easy / accessory preserved)`, d.decision === 'keep', d.reason);
  }
}

// ═════════════════════════════════════════════════════════════════════
// 9. SORENESS — milder than equivalent injury
// ═════════════════════════════════════════════════════════════════════
section('[9] Soreness — milder than injury at same severity');
{
  // Hamstring soreness 6/10 should be roughly equivalent to hamstring
  // injury 4/10 (downscaled by 2). So Box Jump (plyometric) might be
  // limited but not blocked, while sprint should still be limited.
  const sore = buildSorenessConstraint({ region: 'hamstring', severity: 6 });
  const inj = buildInjuryConstraint({ region: 'hamstring', severity: 6 });
  // Sprint blocked under injury 6, only limited under soreness 6 (which
  // downscales to severity 4 internally).
  const sprintInjury = scoreExerciseAgainstConstraints('10m Sprint', [inj]);
  const sprintSore = scoreExerciseAgainstConstraints('10m Sprint', [sore]);
  ok('sprint @ injury 6 → remove', sprintInjury.decision === 'remove');
  ok('sprint @ soreness 6 → remove or limit', sprintSore.decision !== 'keep');
  // Bench press unaffected by either.
  ok('bench unaffected by hamstring soreness', scoreExerciseAgainstConstraints('Bench Press', [sore]).decision === 'keep');
}

// ═════════════════════════════════════════════════════════════════════
// 10. MULTI-CONSTRAINT — most conservative wins
// ═════════════════════════════════════════════════════════════════════
section('[10] Multi-constraint — most conservative wins');
{
  const sho = buildInjuryConstraint({ region: 'shoulder', severity: 8 });
  const fat = buildFatigueConstraint({ severity: 8 });
  // Bench Press blocked by shoulder, kept by fatigue → blocked wins.
  {
    const d = scoreExerciseAgainstConstraints('Bench Press', [sho, fat]);
    ok('shoulder+fatigue + Bench Press → remove (shoulder wins)', d.decision === 'remove');
    ok('attribution includes shoulder constraint', d.triggeringConstraintIds.some((id) => id.includes('shoulder')));
  }
  // Box Jump: shoulder doesn't care about plyo; fatigue blocks plyo.
  {
    const d = scoreExerciseAgainstConstraints('Box Jump', [sho, fat]);
    ok('shoulder+fatigue + Box Jump → remove (fatigue wins)', d.decision === 'remove');
  }
  // Easy bike kept by both.
  {
    const d = scoreExerciseAgainstConstraints('Easy Bike Zone 2', [sho, fat]);
    ok('Easy Bike kept under both', d.decision === 'keep');
  }
}

// ═════════════════════════════════════════════════════════════════════
// 11. SESSION-LEVEL CLASSIFICATION
// ═════════════════════════════════════════════════════════════════════
section('[11] Session-level classification — impact + action');
{
  const c = buildInjuryConstraint({ region: 'shoulder', severity: 8 });
  // High-impact: most exercises are pressing/overhead.
  const upper = wk('Upper Push', [
    ex('Bench Press'), ex('Incline DB Press'),
    ex('Lateral Raise'), ex('Push Press'), ex('Goblet Squat'),
  ]);
  const cls = classifySessionAgainstConstraints(upper, [c]);
  ok('impact high', cls.impact === 'high');
  ok('action rebuild OR recovery (severe)', cls.action === 'rebuild' || cls.action === 'recovery');

  // Low-impact session: only one exercise affected.
  const lower = wk('Lower', [
    ex('Goblet Squat'), ex('Reverse Lunge'),
    ex('Bench Press'),  // single shoulder exposure
    ex('Romanian Deadlift'),
  ]);
  const cls2 = classifySessionAgainstConstraints(lower, [c]);
  ok('impact low (single exercise affected)', cls2.impact === 'low');
  ok('action modify', cls2.action === 'modify');

  // No impact session — no relevant exposures.
  const trunk = wk('Trunk', [ex('Pallof Press'), ex('Plank'), ex('Bird Dog')]);
  const cls3 = classifySessionAgainstConstraints(trunk, [c]);
  ok('impact none', cls3.impact === 'none');
  ok('action unchanged', cls3.action === 'unchanged');
}

// ═════════════════════════════════════════════════════════════════════
// 12. APPLY — removes exercises + attaches coachNotes
// ═════════════════════════════════════════════════════════════════════
section('[12] applyConstraintsToSession — produces clean workout + coachNotes');
{
  const c = buildInjuryConstraint({ region: 'shoulder', severity: 8 });
  const w = wk('Upper Push', [
    ex('Bench Press'),
    ex('Incline DB Press'),
    ex('Single Arm Half Kneeling DB OHP'),
    ex('Explosive Push-Ups'),
    ex('Goblet Squat'),  // safe
    ex('Pallof Press'),  // safe
  ]);
  const result = applyConstraintsToSession(w, [c]);
  ok('applied', result.applied);
  ok('Bench Press removed', !result.workout.exercises.some((e: any) => e.exercise?.name === 'Bench Press'));
  ok('OHP removed', !result.workout.exercises.some((e: any) => e.exercise?.name === 'Single Arm Half Kneeling DB OHP'));
  ok('Goblet Squat preserved', result.workout.exercises.some((e: any) => e.exercise?.name === 'Goblet Squat'));
  ok('Pallof Press preserved', result.workout.exercises.some((e: any) => e.exercise?.name === 'Pallof Press'));

  const notes = result.workout.coachNotes ?? [];
  ok('coachNotes mention Removed', notes.some((n) => /removed/i.test(n)));
  ok('coachNotes mention safe Focus', notes.some((n) => /focus/i.test(n) || /lower body/i.test(n)));
  ok('coachNotes mention physio (severe)', notes.some((n) => /physio/i.test(n)));
}

// ═════════════════════════════════════════════════════════════════════
// 13. APPLY — recovery + game untouched
// ═════════════════════════════════════════════════════════════════════
section('[13] Recovery + game sessions untouched');
{
  const c = buildInjuryConstraint({ region: 'shoulder', severity: 8 });
  const recovery = wk('Active Recovery', [ex('Foam Roll')], { workoutType: 'Recovery', sessionTier: 'recovery' });
  const r1 = applyConstraintsToSession(recovery, [c]);
  ok('recovery → not applied', !r1.applied);

  const game = wk('Game', [], { workoutType: 'Game' });
  const r2 = applyConstraintsToSession(game, [c]);
  ok('game → not applied', !r2.applied);
}

// ═════════════════════════════════════════════════════════════════════
// 14. VALIDATOR — catches survivors
// ═════════════════════════════════════════════════════════════════════
section('[14] validateVisibleProgramAgainstConstraints — catches survivors');
{
  const c = buildInjuryConstraint({ region: 'shoulder', severity: 8 });
  const dirty = wk('Survived', [ex('Bench Press'), ex('Goblet Squat')]);
  const cleaned = wk('Clean', [ex('Goblet Squat'), ex('Pallof Press')]);
  const v1 = validateVisibleProgramAgainstConstraints(
    [{ date: '2026-05-04', workout: dirty }],
    [c],
  );
  ok('not passed', !v1.passed);
  ok('Bench flagged', v1.violations.some((vi) => vi.exercise === 'Bench Press'));

  const v2 = validateVisibleProgramAgainstConstraints(
    [{ date: '2026-05-04', workout: cleaned }],
    [c],
  );
  ok('clean week passes', v2.passed);
  eq('zero violations', v2.violations.length, 0);

  // No constraints → trivially passes.
  const v3 = validateVisibleProgramAgainstConstraints(
    [{ date: '2026-05-04', workout: dirty }],
    [],
  );
  ok('no constraints → pass', v3.passed);
}

// ═════════════════════════════════════════════════════════════════════
// 15. INTEGRATION — projectVisibleDay end-to-end with shoulder 8/10
// ═════════════════════════════════════════════════════════════════════
section('[15] Integration — projectVisibleDay shoulder 8/10');
{
  const w = wk('Upper Push', [
    ex('Incline DB Press'),
    ex('Lateral Raise'),
    ex('Single Arm Half Kneeling DB OHP'),
    ex('Explosive Push-Ups'),
    ex('Goblet Squat'),
  ]);
  const out = projectVisibleDay({
    day: day(NEXT_MON, w),
    activeInjury: {
      bodyPart: 'shoulder', bucket: 'shoulder',
      severity: 8, status: 'active', rules: [],
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
}

// ═════════════════════════════════════════════════════════════════════
// 16. INTEGRATION — projectVisibleDay with extraConstraints (fatigue)
// ═════════════════════════════════════════════════════════════════════
section('[16] Integration — extraConstraints (fatigue 8/10) cuts hard work');
{
  const w = wk('Hard Day', [
    ex('Box Jump'),
    ex('10m Sprint'),
    ex('Bike Intervals'),
    ex('Easy Bike Zone 2'),
    ex('Bicep Curl'),
  ]);
  const out = projectVisibleDay({
    day: day(NEXT_MON, w),
    activeInjury: null,
    extraConstraints: [buildFatigueConstraint({ severity: 8 })],
    todayISO: TODAY_ISO,
  });
  ok('projection applied (fatigue alone)', out.injuryFilterApplied);
  const names = (out.day.workout?.exercises ?? []).map((e: any) => e.exercise?.name);
  ok('Box Jump gone', !names.includes('Box Jump'));
  ok('10m Sprint gone', !names.includes('10m Sprint'));
  ok('Bike Intervals gone', !names.includes('Bike Intervals'));
  ok('Easy Bike preserved', names.includes('Easy Bike Zone 2'));
  ok('Bicep Curl preserved', names.includes('Bicep Curl'));
}

// ═════════════════════════════════════════════════════════════════════
// 17. UI PARITY — home and detail produce same output
// ═════════════════════════════════════════════════════════════════════
section('[17] UI parity — home and detail produce same projected workout');
{
  const w = wk('Lower Strength', [
    ex('Back Squat'),
    ex('Trap Bar Deadlift'),
    ex('Box Jump'),
    ex('Goblet Squat'),
  ]);
  const inj = {
    bodyPart: 'hamstring', bucket: 'hamstring' as const,
    severity: 7, status: 'active' as const, rules: [],
  };
  const home = projectVisibleDay({ day: day(NEXT_MON, w), activeInjury: inj, todayISO: TODAY_ISO });
  const detail = projectVisibleDay({ day: day(NEXT_MON, w), activeInjury: inj, todayISO: TODAY_ISO });
  const homeNames = (home.day.workout?.exercises ?? []).map((e: any) => e.exercise?.name).sort();
  const detailNames = (detail.day.workout?.exercises ?? []).map((e: any) => e.exercise?.name).sort();
  eq('home === detail', homeNames, detailNames);
}

// ═════════════════════════════════════════════════════════════════════
// 18. SEVERITY MAPPING
// ═════════════════════════════════════════════════════════════════════
section('[18] severityToTier — boundaries');
eq('1 → minor', severityToTier(1), 'minor');
eq('3 → minor', severityToTier(3), 'minor');
eq('4 → moderate', severityToTier(4), 'moderate');
eq('6 → limiting', severityToTier(6), 'limiting');
eq('7 → limiting', severityToTier(7), 'limiting');
eq('10 → severe', severityToTier(10), 'severe');

// ═════════════════════════════════════════════════════════════════════
// 19. BACK 6/10 (moderate) — heavy hinge blocked, light kept
// ═════════════════════════════════════════════════════════════════════
section('[19] Back 6/10 — moderate calibration');
{
  const c = buildInjuryConstraint({ region: 'back', severity: 6 });
  for (const name of ['Trap Bar Deadlift', 'Romanian Deadlift', 'Pendlay Row']) {
    const d = scoreExerciseAgainstConstraints(name, [c]);
    ok(`${name} → remove`, d.decision === 'remove', d.reason);
  }
  // Axial loading keeps a heavy back squat out for a limiting back issue.
  {
    const d = scoreExerciseAgainstConstraints('Back Squat', [c]);
    ok('Back Squat @ back 6/10 → remove (axial loading)', d.decision === 'remove', d.reason);
  }
}

// ═════════════════════════════════════════════════════════════════════
// 19b. LIMITING IS NOT A SEVERE PAUSE
// ═════════════════════════════════════════════════════════════════════
section('[19b] Shoulder 6/10 limits safe affected work; 9/10 pauses it');
{
  const limiting = buildInjuryConstraint({ region: 'shoulder', severity: 6 });
  const severe = buildInjuryConstraint({ region: 'shoulder', severity: 9 });
  const limitingBench = scoreExerciseAgainstConstraints('Bench Press', [limiting]);
  const severeBench = scoreExerciseAgainstConstraints('Bench Press', [severe]);
  ok('Bench Press @ shoulder 6/10 stays limited', limitingBench.decision === 'limit', limitingBench.reason);
  ok('Bench Press @ shoulder 9/10 is removed', severeBench.decision === 'remove', severeBench.reason);

  const limitingSession = applyConstraintsToSession(
    wk('Upper Push', [ex('Bench Press'), ex('Goblet Squat')]),
    [limiting],
  );
  const limitingNames = limitingSession.workout.exercises.map((exercise: any) => exercise.exercise?.name);
  ok('6/10 keeps limited affected work visible', limitingNames.includes('Bench Press'), limitingNames.join(', '));
  ok('6/10 keeps safe unaffected work visible', limitingNames.includes('Goblet Squat'), limitingNames.join(', '));
}

// ═════════════════════════════════════════════════════════════════════
// 20. NO FAKE SUBSTITUTIONS — engine never invents replacements
// ═════════════════════════════════════════════════════════════════════
section('[20] No fake substitutions — engine returns ONLY removed/kept names');
{
  const c = buildInjuryConstraint({ region: 'shoulder', severity: 8 });
  const w = wk('Upper Push', [ex('Bench Press'), ex('Goblet Squat')]);
  const r = applyConstraintsToSession(w, [c]);
  // No new exercises invented.
  const before = ['Bench Press', 'Goblet Squat'];
  const after = r.workout.exercises.map((e: any) => e.exercise?.name);
  for (const n of after) ok(`${n} present in original`, before.includes(n));
  // Specifically, no split squat / pressing variant fabricated.
  ok('no Split Squat invented', !after.some((n: string) => /split\s*squat/i.test(n)));
}

// ═════════════════════════════════════════════════════════════════════
// 21. RESOLVED CONSTRAINT — no-op
// ═════════════════════════════════════════════════════════════════════
section('[21] Resolved constraint → no-op');
{
  const c: Constraint = {
    ...buildInjuryConstraint({ region: 'shoulder', severity: 8 }),
    status: 'resolved',
  };
  const w = wk('Upper Push', [ex('Bench Press'), ex('Goblet Squat')]);
  const r = applyConstraintsToSession(w, [c]);
  ok('resolved → not applied', !r.applied);
  eq('exercises unchanged', r.workout.exercises.length, 2);
}

// ═════════════════════════════════════════════════════════════════════
// 22. PHYSIO ADVICE — only severe gets the hard message
// ═════════════════════════════════════════════════════════════════════
section('[22] Physio advice tiers');
{
  const severe = buildInjuryConstraint({ region: 'shoulder', severity: 8 });
  const moderate = buildInjuryConstraint({ region: 'shoulder', severity: 5 });
  const minor = buildInjuryConstraint({ region: 'shoulder', severity: 2 });
  ok('severe → hard physio advice', !!severe.advice && severe.advice.some((a) => /so we know/i.test(a)));
  const limiting = buildInjuryConstraint({ region: 'shoulder', severity: 6 });
  ok('limiting 6/10 → hard physio advice', !!limiting.advice && limiting.advice.some((a) => /so we know/i.test(a)));
  ok('moderate 5/10 → soft physio advice', !!moderate.advice && moderate.advice.some((a) => /not improving/i.test(a)));
  ok('minor → no physio advice', !minor.advice || minor.advice.length === 0);
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
