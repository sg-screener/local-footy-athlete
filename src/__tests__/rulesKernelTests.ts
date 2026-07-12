/**
 * rulesKernelTests — Phase 1 Bible rules kernel (READ-ONLY module).
 *
 * Proves:
 *   1. Session taxonomy classifies every existing session shape (game,
 *      team days, combined team+strength, strength splits, gunshow,
 *      recovery, easy erg, conditioning sub-types, combined S+C, flush).
 *   2. Stress classification matches Bible Section 3 / 17.A, including
 *      athlete-context shifts (beginner upper → high, poor-conditioning
 *      tempo → high, light team training → medium).
 *   3. Weekly exposure counters reproduce Bible Section 17.A/B counting
 *      on the Bible's own in-season "Option 1" week.
 *   4. Cap audit flags over-cap weeks and stays silent on compliant ones.
 *   5. Bible injury severity bands (defined, NOT wired — Phase 5).
 *   6. Phase rep-scheme data matches Section 5.
 *   7. Role bias mapping: 5 UI roles → 4 programming biases.
 *   8. LIVE SAMPLE: counts a real generated in-season week end-to-end
 *      (coachingEngine + resolveWeekWithConditioning) and reports counts +
 *      cap findings. Informational — generation behaviour is untouched.
 *
 * Run: npm run test:rules-kernel
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  classifyDaySessions,
  classifySessionStress,
  countWeeklyExposures,
  auditWeekAgainstCaps,
  classifyBibleInjurySeverity,
  BIBLE_INJURY_SEVERITY_BANDS,
  BIBLE_WEEKLY_CAPS,
  MAIN_LIFT_REP_SCHEMES,
  getProgrammingRoleBias,
  type SessionUnit,
  type WeekDayInput,
} from '../rules';
import { ROLE_BUCKET_OPTIONS } from '../utils/roleBuckets';
import type { Workout, WorkoutExercise } from '../types/domain';

// ─── Harness ─────────────────────────────────────────────────────────
let pass = 0;
let fail = 0;
const failures: string[] = [];
function ok(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else {
    fail++;
    failures.push(name);
    console.log(`  ✗ ${name}${detail ? '\n      ' + detail : ''}`);
  }
}

// ─── Builders ────────────────────────────────────────────────────────
const NOW = new Date().toISOString();
let exId = 0;

function mkEx(name: string): WorkoutExercise {
  exId += 1;
  return {
    id: `ex-${exId}`, workoutId: 'w', exerciseId: `e-${exId}`, exerciseOrder: exId,
    prescribedSets: 3, prescribedRepsMin: 5, prescribedRepsMax: 8, restSeconds: 90,
    exercise: {
      id: `e-${exId}`, name, description: '', muscleGroups: [], exerciseType: 'Compound',
      equipmentRequired: [], difficultyLevel: 'Intermediate', createdAt: NOW, updatedAt: NOW,
    },
    createdAt: NOW, updatedAt: NOW,
  } as WorkoutExercise;
}

function mkWorkout(partial: Partial<Workout> & { name: string }): Workout {
  return {
    id: 'w', microcycleId: 'mc', dayOfWeek: 1, description: '',
    durationMinutes: 45, intensity: 'Moderate', workoutType: 'Strength',
    exercises: [], createdAt: NOW, updatedAt: NOW, ...partial,
  } as Workout;
}

const cats = (units: SessionUnit[]) => units.map((u) => u.category).sort().join(',');

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Session taxonomy ──');

ok('null workout → no units (rest)', classifyDaySessions(null).length === 0);

{
  const u = classifyDaySessions(mkWorkout({ name: 'Game Day', workoutType: 'Game' }));
  ok('Game → [game], running', cats(u) === 'game' && u[0].modality === 'running');
}
{
  const u = classifyDaySessions(mkWorkout({ name: 'Rest', workoutType: 'Recovery', exercises: [] }));
  ok('explicit Rest stub → [rest]', cats(u) === 'rest');
}
{
  const w = mkWorkout({ name: 'Team Training', workoutType: 'Strength' });
  (w as unknown as { isTeamDay: boolean }).isTeamDay = true;
  const u = classifyDaySessions(w);
  ok('team-only day → [team_training], running', cats(u) === 'team_training' && u[0].modality === 'running');
}
{
  const w = mkWorkout({
    name: 'Team Training + Upper Push',
    description: 'Bench press, overhead press, rows',
    workoutType: 'Strength',
    exercises: [mkEx('Bench Press'), mkEx('Overhead Press')],
  });
  (w as unknown as { isTeamDay: boolean }).isTeamDay = true;
  const u = classifyDaySessions(w);
  ok('combined team day → [team_training, upper_strength]',
    cats(u) === 'team_training,upper_strength', cats(u));
}
{
  const u = classifyDaySessions(mkWorkout({
    name: 'Lower Body Strength',
    description: 'Back squat, RDL, split squat',
    exercises: [mkEx('Back Squat'), mkEx('RDL')],
  }));
  ok('squat+hinge day → [lower_strength]', cats(u) === 'lower_strength', cats(u));
}
{
  const u = classifyDaySessions(mkWorkout({ name: 'Upper Pull', description: 'Pull-ups and rows' }));
  ok('Upper Pull → [upper_strength]', cats(u) === 'upper_strength', cats(u));
}
{
  const u = classifyDaySessions(mkWorkout({ name: 'Upper Push', description: 'Bench press and overhead press' }));
  ok('Upper Push → [upper_strength]', cats(u) === 'upper_strength', cats(u));
}
{
  const u = classifyDaySessions(mkWorkout({ name: 'Full Body Strength', description: 'Full body: squat, push, pull' }));
  ok('Full body → [full_body_strength]', cats(u) === 'full_body_strength', cats(u));
}
{
  const u = classifyDaySessions(mkWorkout({ name: 'Gunshow', description: 'Biceps, triceps, delts pump' }));
  ok('Gunshow → [gunshow_prehab] (NOT main strength)', cats(u) === 'gunshow_prehab', cats(u));
}
{
  const u = classifyDaySessions(mkWorkout({ name: 'Prehab & Accessories', description: 'Shoulder health + calves' }));
  ok('Prehab & Accessories → [gunshow_prehab]', cats(u) === 'gunshow_prehab', cats(u));
}
{
  const u = classifyDaySessions(mkWorkout({
    name: 'Upper body hypertrophy / trunk & accessory work',
    description: 'Curls, pushdowns, face pulls, calves, Pallof press',
    exercises: [mkEx('Bicep Curl'), mkEx('Tricep Pushdown'), mkEx('Face Pull')],
  }));
  ok('upper hypertrophy/trunk accessories → [gunshow_prehab], not upper_strength',
    cats(u) === 'gunshow_prehab', cats(u));
}
{
  const u = classifyDaySessions(mkWorkout({
    name: 'Upper body accessory',
    description: 'Small-muscle pump and trunk only',
  }));
  ok('vague upper body accessory text without main-lift proof → gunshow_prehab',
    cats(u) === 'gunshow_prehab', cats(u));
}
{
  const u = classifyDaySessions(mkWorkout({
    name: 'Upper body hypertrophy / trunk & accessory work',
    description: 'Includes real main lifts today',
    exercises: [mkEx('Bench Press'), mkEx('Barbell Row')],
  }));
  ok('accessory-named session with exercise-proven main lifts → upper_strength',
    cats(u) === 'upper_strength', cats(u));
}
{
  // Regression (S6, 2026-07-08): a strength focus that merely MENTIONS
  // accessories must stay a strength session — 'accessor' substring was
  // reclassifying real lower days (and their finishers) as gunshow.
  const u = classifyDaySessions(mkWorkout({
    name: 'Lower body - squat emphasis (quad-dominant: squat, lunge, leg press; optional quad accessory: leg extension) + aerobic base finisher (20min zone 2)',
    description: 'Lower body squat day with optional accessory',
    hasCombinedConditioning: true, conditioningFlavour: 'aerobic', conditioningCategory: 'aerobic_base',
  }));
  ok('strength focus mentioning "accessory" → strength + finisher, not gunshow',
    cats(u) === 'aerobic_base,lower_strength', cats(u));
}
{
  // Prehab session whose DESCRIPTION mentions pattern words stays gunshow.
  const u = classifyDaySessions(mkWorkout({
    name: 'Prehab & Accessories',
    description: 'Face pulls, rear delt fly, calf raises, hamstring bridge',
  }));
  ok('gunshow-named session with pattern words in description stays gunshow',
    cats(u) === 'gunshow_prehab', cats(u));
}
{
  const u = classifyDaySessions(mkWorkout({
    name: 'Recovery Session', workoutType: 'Recovery', sessionTier: 'recovery',
    exercises: [mkEx('Mobility Flow'), mkEx('Walking')],
  }));
  ok('Recovery session → [recovery], low modality', cats(u) === 'recovery' && u[0].modality === 'none', cats(u));
}
{
  const u = classifyDaySessions(mkWorkout({
    name: 'Easy Bike', workoutType: 'Recovery', sessionTier: 'recovery', intensity: 'Light',
    exercises: [mkEx('Easy Bike')],
  }));
  ok('Easy Bike (recovery-tier erg) → [aerobic_base], off_feet',
    cats(u) === 'aerobic_base' && u[0].modality === 'off_feet', `${cats(u)} / ${u[0]?.modality}`);
}
{
  const u = classifyDaySessions(mkWorkout({
    name: 'Off-Feet MetCon', workoutType: 'MetCon', intensity: 'High',
    exercises: [mkEx('Assault Bike Intervals'), mkEx('Ski Erg Intervals')],
  }));
  ok('MetCon → [hard_conditioning], off_feet',
    cats(u) === 'hard_conditioning' && u[0].modality === 'off_feet', `${cats(u)} / ${u[0]?.modality}`);
}
{
  const u = classifyDaySessions(mkWorkout({
    name: 'MAS 15:15 Blocks', workoutType: 'MAS-Training', intensity: 'Maximal',
    exercises: [mkEx('MAS 15:15 Blocks')],
  }));
  ok('MAS → [hard_conditioning], running',
    cats(u) === 'hard_conditioning' && u[0].modality === 'running', `${cats(u)} / ${u[0]?.modality}`);
}
{
  const u = classifyDaySessions(mkWorkout({ name: 'Tempo Run', workoutType: 'Tempo-Run' }));
  ok('Tempo-Run → [tempo_conditioning], running',
    cats(u) === 'tempo_conditioning' && u[0].modality === 'running', `${cats(u)} / ${u[0]?.modality}`);
}
{
  const u = classifyDaySessions(mkWorkout({
    name: 'Flying Sprints', workoutType: 'Sprint-Intervals',
    exercises: [mkEx('Flying Sprints')],
  }));
  ok('Sprint session → [sprint], running',
    cats(u) === 'sprint' && u[0].modality === 'running', `${cats(u)} / ${u[0]?.modality}`);
}
{
  const u = classifyDaySessions(mkWorkout({ name: 'Flush Run', workoutType: 'Flush-Out', sessionTier: 'recovery', intensity: 'Light', exercises: [mkEx('Flush Run')] }));
  ok('Flush Run → [aerobic_base], running', cats(u) === 'aerobic_base' && u[0].modality === 'running', `${cats(u)} / ${u[0]?.modality}`);
}
{
  const u = classifyDaySessions(mkWorkout({
    name: 'Lower Body Strength',
    description: 'Box squat, hip thrust + easy bike flush',
    hasCombinedConditioning: true,
    conditioningFlavour: 'aerobic',
    exercises: [mkEx('Box Squat'), mkEx('Hip Thrust'), mkEx('Easy Bike')],
  }));
  ok('combined S+C day → [aerobic_base, lower_strength]',
    cats(u) === 'aerobic_base,lower_strength', cats(u));
}

{
  // Regression (found in first live run): a flush named "…easy bike/row"
  // must NOT false-match the pull probe and become upper_strength.
  const u = classifyDaySessions(mkWorkout({
    name: 'Easy Aerobic Flush - 20-30min easy bike/row, 3-4/10.',
    workoutType: 'Strength', // allocation-level sessions can carry a generic type
    intensity: 'Light',
    sessionTier: 'optional',
  }));
  ok('"easy bike/row" flush → [aerobic_base], not upper_strength',
    cats(u) === 'aerobic_base' && u[0].modality === 'off_feet', `${cats(u)} / ${u[0]?.modality}`);
}
{
  // Regression (QA sweep false positive, S13/S14): a truncated team-training
  // name WITHOUT the isTeamDay flag must still classify as team_training,
  // not fall through to the sprint fallback via "(sprint + …" text.
  const u = classifyDaySessions(mkWorkout({
    name: 'Team training - field session (sprint + ',
    description: 'Team training - field session (sprint + skills + game sim)',
    workoutType: 'Strength',
    sessionTier: 'core',
    intensity: 'High',
  }));
  ok('truncated "Team training…" name (no flag) → [team_training], not sprint',
    cats(u) === 'team_training', cats(u));
}
{
  // Regression (local generation, 2026-07-08): canonical region name with
  // no pattern tokens + combined finisher must classify as strength +
  // conditioning, not conditioning-only.
  const u = classifyDaySessions(mkWorkout({
    name: 'Lower Body Strength', description: '', workoutType: 'Mixed',
    hasCombinedConditioning: true, conditioningFlavour: 'tempo', conditioningCategory: 'vo2',
    exercises: [mkEx('Back Squat'), mkEx('RDL')],
  }));
  ok('"Lower Body Strength" (Mixed, bare name) → lower_strength + conditioning',
    cats(u) === 'hard_conditioning,lower_strength', cats(u));
}
{
  // Exercise-derived fallback: lossy name, real strength content.
  const u = classifyDaySessions(mkWorkout({
    name: 'Session A', description: '',
    exercises: [mkEx('Bench Press'), mkEx('Barbell Row')],
  }));
  ok('pattern-less name with press+pull exercises → upper_strength', cats(u) === 'upper_strength', cats(u));
}
{
  // Tie-break control: explicit strength wording beats conditioning words.
  const u = classifyDaySessions(mkWorkout({
    name: 'Upper body - pull emphasis + optional bike flush',
    description: 'Rows, pull-ups',
  }));
  ok('explicit strength wording still classifies as strength',
    u.some((x) => x.category === 'upper_strength'), cats(u));
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Stress classification ──');

const unit = (category: SessionUnit['category'], modality: SessionUnit['modality'] = 'none'): SessionUnit =>
  ({ category, modality, reason: 'test' });

ok('game → high', classifySessionStress(unit('game', 'running')) === 'high');
ok('team training (default) → high', classifySessionStress(unit('team_training', 'running')) === 'high');
ok('team training (Light profile) → medium',
  classifySessionStress(unit('team_training', 'running'), null, { teamTrainingIntensity: 'Light' }) === 'medium');
ok('lower strength → high', classifySessionStress(unit('lower_strength')) === 'high');
ok('sprint → high', classifySessionStress(unit('sprint', 'running')) === 'high');
ok('hard conditioning → high', classifySessionStress(unit('hard_conditioning', 'running')) === 'high');
ok('upper strength → medium', classifySessionStress(unit('upper_strength')) === 'medium');
ok('upper strength for complete beginner → high',
  classifySessionStress(unit('upper_strength'), null, { experienceLevel: 'Complete beginner' }) === 'high');
ok('full body → medium', classifySessionStress(unit('full_body_strength')) === 'medium');
ok('tempo → medium', classifySessionStress(unit('tempo_conditioning', 'running')) === 'medium');
ok('tempo for poor conditioning → high',
  classifySessionStress(unit('tempo_conditioning', 'running'), null, { conditioningLevel: 'Poor' }) === 'high');
ok('aerobic flush → low',
  classifySessionStress(unit('aerobic_base', 'off_feet'), mkWorkout({ name: 'Bike Flush', intensity: 'Light' })) === 'low');
ok('gunshow → low', classifySessionStress(unit('gunshow_prehab')) === 'low');
ok('recovery → low', classifySessionStress(unit('recovery')) === 'low');

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Weekly counters — Bible in-season Option 1 week ──');
// Mon lower + optional flush, Tue upper pull + TT, Wed rest,
// Thu upper push + TT, Fri gunshow, Sat game, Sun recovery.

function teamDay(name: string, description: string, exercises: WorkoutExercise[]): Workout {
  const w = mkWorkout({ name, description, exercises });
  (w as unknown as { isTeamDay: boolean }).isTeamDay = true;
  return w;
}

const OPTION_1_WEEK: WeekDayInput[] = [
  { date: '2026-06-01', workout: mkWorkout({
    name: 'Lower Body Strength', description: 'Box squat, RDL + easy bike flush',
    hasCombinedConditioning: true, conditioningFlavour: 'aerobic',
    exercises: [mkEx('Box Squat'), mkEx('RDL'), mkEx('Easy Bike')],
  }) },
  { date: '2026-06-02', workout: teamDay('Team Training + Upper Pull', 'Rows, pull-ups', [mkEx('Barbell Row'), mkEx('Pull-Ups')]) },
  { date: '2026-06-03', workout: null },
  { date: '2026-06-04', workout: teamDay('Team Training + Upper Push', 'Bench, overhead press', [mkEx('Bench Press'), mkEx('Overhead Press')]) },
  { date: '2026-06-05', workout: mkWorkout({ name: 'Gunshow', description: 'Arms pump' }) },
  { date: '2026-06-06', workout: mkWorkout({ name: 'Game Day', workoutType: 'Game' }) },
  { date: '2026-06-07', workout: mkWorkout({ name: 'Recovery Session', workoutType: 'Recovery', sessionTier: 'recovery' }) },
];

const counts = countWeeklyExposures(OPTION_1_WEEK, { teamTrainingIntensity: 'Hard', conditioningLevel: 'Good' });

ok('main strength = 3 (lower + 2 upper on team days)', counts.mainStrengthExposures === 3, `got ${counts.mainStrengthExposures}`);
ok('hard exposures = 4 (lower, 2×TT, game)', counts.hardExposures === 4, `got ${counts.hardExposures}`);
ok('hard days = 4', counts.hardDays === 4, `got ${counts.hardDays}`);
ok('running exposures = 3 (2×TT + game; flush is off-feet)', counts.runningExposures === 3, `got ${counts.runningExposures}`);
ok('sprint/COD exposures = 3 (2×TT + game)', counts.sprintCodExposures === 3, `got ${counts.sprintCodExposures}`);
ok('conditioning exposures = 4 (2×TT + game + flush)', counts.conditioningExposures === 4, `got ${counts.conditioningExposures}`);
ok('extra (app-added) conditioning = 1 (flush only)', counts.extraConditioningSessions === 1, `got ${counts.extraConditioningSessions}`);
ok('gunshow = 1, recovery = 1, games = 1, TT = 2',
  counts.gunshowSessions === 1 && counts.recoverySessions === 1 && counts.games === 1 && counts.teamTrainingSessions === 2);

const option1Findings = auditWeekAgainstCaps(counts);
ok('Bible Option 1 week has NO over-cap findings',
  option1Findings.filter((f) => f.kind === 'over').length === 0,
  option1Findings.map((f) => f.detail).join('; '));

{
  const weekWithAccessory: WeekDayInput[] = [
    { date: '2026-06-01', workout: mkWorkout({ name: 'Lower Body Strength', description: 'squat', exercises: [mkEx('Back Squat')] }) },
    { date: '2026-06-02', workout: mkWorkout({ name: 'Upper Push', description: 'bench', exercises: [mkEx('Bench Press')] }) },
    { date: '2026-06-03', workout: mkWorkout({ name: 'Lower Hinge', description: 'RDL', exercises: [mkEx('RDL')] }) },
    { date: '2026-06-04', workout: mkWorkout({ name: 'Upper Pull', description: 'rows', exercises: [mkEx('Barbell Row')] }) },
    { date: '2026-06-05', workout: mkWorkout({
      name: 'Upper body hypertrophy / trunk & accessory work',
      description: 'Curls, pushdowns, face pulls',
      exercises: [mkEx('Bicep Curl'), mkEx('Tricep Pushdown'), mkEx('Face Pull')],
    }) },
  ];
  const accessoryCounts = countWeeklyExposures(weekWithAccessory, {});
  const accessoryCaps = auditWeekAgainstCaps(accessoryCounts);
  ok('main strength cap excludes gunshow/accessory/prehab sessions',
    accessoryCounts.mainStrengthExposures === 4 &&
    !accessoryCaps.some((f) => f.cap === 'maxMainStrengthSessions' && f.kind === 'over'),
    `strength=${accessoryCounts.mainStrengthExposures}; ${accessoryCaps.map((f) => f.detail).join('; ')}`);
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Cap audit — over-cap week is flagged ──');
// 5 main strength + 2 TT + game + metcon + 1km repeats: too much of everything.

const OVERCAP_WEEK: WeekDayInput[] = [
  { date: '2026-06-01', workout: mkWorkout({ name: 'Lower Body Strength', description: 'squat + hinge', exercises: [mkEx('Back Squat')] }) },
  { date: '2026-06-02', workout: teamDay('Team Training + Upper Pull', 'rows', [mkEx('Barbell Row')]) },
  { date: '2026-06-03', workout: mkWorkout({ name: 'Lower Body Strength', description: 'squat + hinge again', exercises: [mkEx('Front Squat')] }) },
  { date: '2026-06-04', workout: teamDay('Team Training + Upper Push', 'bench', [mkEx('Bench Press')]) },
  { date: '2026-06-05', workout: mkWorkout({
    name: 'Full Body Strength', description: 'full body + metcon',
    hasCombinedConditioning: true, conditioningFlavour: 'high-intensity',
    exercises: [mkEx('Trap Bar Deadlift'), mkEx('Assault Bike Intervals')],
  }) },
  { date: '2026-06-06', workout: mkWorkout({ name: 'Game Day', workoutType: 'Game' }) },
  { date: '2026-06-07', workout: mkWorkout({ name: '6x1km Repeats', workoutType: '6x1km', intensity: 'Maximal', exercises: [mkEx('1km Repeat Intervals Run')] }) },
];

const overCounts = countWeeklyExposures(OVERCAP_WEEK, {});
const overFindings = auditWeekAgainstCaps(overCounts);
const overCaps = new Set(overFindings.filter((f) => f.kind === 'over').map((f) => f.cap));

ok('flags > 4 main strength', overCaps.has('maxMainStrengthSessions'),
  `strength=${overCounts.mainStrengthExposures}, findings: ${overFindings.map((f) => f.detail).join('; ')}`);
ok('flags > 4 hard days', overCaps.has('maxHardDays'), `hardDays=${overCounts.hardDays}`);
ok('running counter includes on-feet hard conditioning', overCounts.runningExposures === 4, `got ${overCounts.runningExposures}`);
ok('caps constants match Bible Section 17.B',
  BIBLE_WEEKLY_CAPS.maxMainStrengthSessions === 4 &&
  BIBLE_WEEKLY_CAPS.maxRunningExposures === 4 &&
  BIBLE_WEEKLY_CAPS.sprintCodExposures.max === 3 &&
  BIBLE_WEEKLY_CAPS.maxHardDays === 4);

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. Bible injury severity bands (defined, not wired) ──');

ok('severity 1-3 → avoid trigger only', classifyBibleInjurySeverity(2).band === 'avoid_trigger_1_3');
ok('severity 3 stays in mild band', classifyBibleInjurySeverity(3).band === 'avoid_trigger_1_3');
ok('severity 4-5 → reduce affected work', classifyBibleInjurySeverity(4).band === 'reduce_affected_4_5' && classifyBibleInjurySeverity(5).band === 'reduce_affected_4_5');
ok('severity 6-7 → restrict + recommend physio',
  classifyBibleInjurySeverity(6).band === 'restrict_and_refer_6_7' && classifyBibleInjurySeverity(7).recommendPhysio === true);
ok('severity 8-10 → pause affected training',
  classifyBibleInjurySeverity(8).pauseAffectedTraining === true && classifyBibleInjurySeverity(10).band === 'pause_affected_8_10');
{
  // Bands must cover 1-10 without gap or overlap.
  let covered = true;
  for (let s = 1; s <= 10; s++) {
    const hits = BIBLE_INJURY_SEVERITY_BANDS.filter((b) => s >= b.min && s <= b.max).length;
    if (hits !== 1) covered = false;
  }
  ok('bands cover 1-10 exhaustively, no overlap', covered);
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. Phase rep-scheme data (Section 5) ──');

ok('in-season lower = 2-4 × 2-4, base 3x3',
  MAIN_LIFT_REP_SCHEMES['In-season'].lower.repsMax === 4 && MAIN_LIFT_REP_SCHEMES['In-season'].lower.base === '3x3');
ok('pre-season lower base 3x5', MAIN_LIFT_REP_SCHEMES['Pre-season'].lower.base === '3x5');
ok('off-season base 3x8, pulls tolerate up to 12',
  MAIN_LIFT_REP_SCHEMES['Off-season'].lower.base === '3x8' && MAIN_LIFT_REP_SCHEMES['Off-season'].upperPull.repsMax === 12);
ok('pulls ≥ push reps in every phase',
  (['In-season', 'Pre-season', 'Off-season'] as const).every(
    (p) => MAIN_LIFT_REP_SCHEMES[p].upperPull.repsMax >= MAIN_LIFT_REP_SCHEMES[p].upperPush.repsMax));

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 7. Role bias — 5 UI roles → 4 programming biases ──');

ok('UI keeps 5 roles', ROLE_BUCKET_OPTIONS.length === 5);
ok('high_forward_back maps to outside_runner bias', getProgrammingRoleBias('high_forward_back') === 'outside_runner');
ok('outside_mid maps to outside_runner bias', getProgrammingRoleBias('outside_mid') === 'outside_runner');
ok('other roles map to themselves',
  getProgrammingRoleBias('inside_mid') === 'inside_mid' &&
  getProgrammingRoleBias('key_position_ruck_tall') === 'key_position_ruck_tall' &&
  getProgrammingRoleBias('small_forward_back') === 'small_forward_back');

// ═════════════════════════════════════════════════════════════════════
// 8. LIVE SAMPLE — real generated in-season week through the real
//    pipeline, counted read-only. Loose assertions only: this section is
//    observability, not a behavioural gate on the generator.
// ═════════════════════════════════════════════════════════════════════
console.log('\n── 8. Live sample — generated in-season week (read-only count) ──');

import {
  buildCoachingPlan,
  onboardingToCoachingInputs,
} from '../utils/coachingEngine';
import {
  resolveWeekWithConditioning,
  computeGameDatesForBlock,
  addDays,
  type ScheduleState,
} from '../utils/sessionResolver';
import { DEFAULT_ATHLETE_CONTEXT } from '../utils/sessionBuilder';
import type { Microcycle, OnboardingData, TrainingProgram } from '../types/domain';

const BLOCK_START = '2026-03-23';
const BLOCK_END = '2026-04-19';
const TEST_MONDAY = '2026-03-23';
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const IN_SEASON_PROFILE: Partial<OnboardingData> = {
  seasonPhase: 'In-season',
  gameDay: 'Saturday',
  trainingDaysPerWeek: 5,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  teamTrainingDaysPerWeek: 2,
  teamTrainingDays: ['Tuesday', 'Thursday'],
  teamTrainingIntensity: 'Hard',
  sprintExposure: '2+ times per week',
  conditioningLevel: 'Good',
  recentTrainingLoad: 'Very consistent',
  experienceLevel: '2-5 years',
  injuries: [],
};

try {
  const inputs = onboardingToCoachingInputs(IN_SEASON_PROFILE as OnboardingData);
  const plan = buildCoachingPlan(inputs);

  // Mirror the weekPlanQA harness: plan → workouts → ScheduleState.
  // isTeamDay + conditioning metadata are carried so classification sees
  // what the real visible projection sees.
  const workouts: Workout[] = plan.weeklyPlan.map((s, idx) => {
    const dayNum = DAY_NAMES.indexOf(s.dayOfWeek || '');
    const w = mkWorkout({
      name: s.focus.substring(0, 60),
      description: s.focus,
      intensity: s.isHardExposure ? 'High' : s.tier === 'optional' ? 'Light' : 'Moderate',
      workoutType: s.tier === 'recovery' ? 'Recovery' : 'Strength',
      sessionTier: s.tier,
      hasCombinedConditioning: s.hasCombinedConditioning,
      conditioningFlavour: s.conditioningFlavour,
      conditioningCategory: s.conditioningCategory,
      strengthIntent: s.strengthIntent,
      strengthPatternContributions: s.strengthPatternContributions,
    });
    (w as unknown as { id: string; dayOfWeek: number }).id = `w-live-${idx}`;
    (w as unknown as { dayOfWeek: number }).dayOfWeek = dayNum >= 0 ? dayNum : 0;
    if (s.isTeamDay) (w as unknown as { isTeamDay: boolean }).isTeamDay = true;
    return w;
  });

  const microcycle: Microcycle = {
    id: 'mc-live', programId: 'prog-live', weekNumber: 1,
    startDate: BLOCK_START, endDate: addDays(BLOCK_START, 6),
    miniCycleNumber: 1, intensityMultiplier: 1.0,
    workouts, createdAt: NOW, updatedAt: NOW,
  };
  const program: TrainingProgram = {
    id: 'prog-live', userId: 'u', name: 'Live sample', description: '',
    programPhase: 'In-Season', startDate: BLOCK_START, endDate: BLOCK_END,
    microcycles: [microcycle], primaryFocus: 'Strength', isActive: true,
    createdAt: NOW, updatedAt: NOW,
  };

  const markedDays: Record<string, 'game' | 'rest'> = {};
  for (const gd of computeGameDatesForBlock('Saturday', BLOCK_START, BLOCK_END)) markedDays[gd] = 'game';

  const state: ScheduleState = {
    currentProgram: program,
    currentMicrocycle: microcycle,
    manualOverrides: {},
    markedDays,
    athleteContext: DEFAULT_ATHLETE_CONTEXT,
    seasonPhase: 'In-season',
    gameDay: 'Saturday',
    readiness: plan.readiness,
  };

  const resolved = resolveWeekWithConditioning(TEST_MONDAY, state);
  const weekInput: WeekDayInput[] = resolved.map((d) => ({ date: d.date, workout: d.workout }));
  const liveCounts = countWeeklyExposures(weekInput, {
    teamTrainingIntensity: 'Hard',
    conditioningLevel: 'Good',
    experienceLevel: '2-5 years',
  });
  const liveFindings = auditWeekAgainstCaps(liveCounts);

  console.log('\n  Generated week (Sat game, Tue/Thu team training):');
  for (const d of liveCounts.days) {
    const dayName = DAY_NAMES[new Date(`${d.date}T12:00:00`).getDay()].slice(0, 3);
    const unitsStr = d.units.length === 0
      ? 'rest'
      : d.units.map((u) => `${u.category}[${u.stress}${u.modality !== 'none' ? '/' + u.modality : ''}]`).join(' + ');
    console.log(`    ${dayName} ${d.date}  ${d.isHardDay ? 'HARD ' : '     '} ${unitsStr}  ${d.workoutName ? `(${d.workoutName})` : ''}`);
  }
  console.log('\n  Counts:', JSON.stringify({
    hardExposures: liveCounts.hardExposures,
    hardDays: liveCounts.hardDays,
    mainStrength: liveCounts.mainStrengthExposures,
    conditioning: liveCounts.conditioningExposures,
    extraConditioning: liveCounts.extraConditioningSessions,
    running: liveCounts.runningExposures,
    sprintCod: liveCounts.sprintCodExposures,
    byCategory: liveCounts.byCategory,
  }, null, 2).replace(/\n/g, '\n  '));
  if (liveFindings.length > 0) {
    console.log('\n  Cap findings (informational — no enforcement in Phase 1):');
    for (const f of liveFindings) console.log(`    [${f.kind}] ${f.detail}`);
  } else {
    console.log('\n  Cap findings: none');
  }

  ok('live pipeline returns 7 resolved days', resolved.length === 7);
  ok('live week counts exactly 1 game', liveCounts.games === 1, `got ${liveCounts.games}`);
  ok('live week counts 2 team trainings', liveCounts.teamTrainingSessions === 2, `got ${liveCounts.teamTrainingSessions}`);
  ok('no unclassified (other) units in live week',
    (liveCounts.byCategory.other ?? 0) === 0,
    `other=${liveCounts.byCategory.other}; days: ${liveCounts.days.map((d) => `${d.date}:${d.units.map((u) => u.category).join('+') || 'rest'}`).join(' | ')}`);
} catch (e) {
  ok('live sample ran without throwing', false, String(e));
}

// ─── Summary ─────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(60)}`);
console.log(`rulesKernelTests: ${pass} passed, ${fail} failed`);
if (failures.length) console.log('Failures:\n  - ' + failures.join('\n  - '));
process.exit(fail > 0 ? 1 : 0);
