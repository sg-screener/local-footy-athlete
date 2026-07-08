/**
 * weekStructureValidatorTests — Phase 2 Bible weekly-structure validator.
 *
 * The validator is FINDINGS-ONLY. These tests intentionally assert
 * expected findings (that's what unit tests are for); production call
 * sites remain log-only and never fail on findings.
 *
 * Run: npm run test:week-validator
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  validateProgramWeek,
  deriveWeekValidationFlags,
  validatorDaysFromResolvedWeek,
  looksLikeNeuralPrimer,
  type ValidatorDayInput,
  type WeekFinding,
} from '../rules/weekStructureValidator';
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

function mkEx(name: string, sets = 3, repsMax = 8): WorkoutExercise {
  exId += 1;
  return {
    id: `ex-${exId}`, workoutId: 'w', exerciseId: `e-${exId}`, exerciseOrder: exId,
    prescribedSets: sets, prescribedRepsMin: Math.min(repsMax, 3), prescribedRepsMax: repsMax, restSeconds: 90,
    exercise: {
      id: `e-${exId}`, name, description: '', muscleGroups: [], exerciseType: 'Compound',
      equipmentRequired: [], difficultyLevel: 'Intermediate', createdAt: NOW, updatedAt: NOW,
    },
    createdAt: NOW, updatedAt: NOW,
  } as WorkoutExercise;
}

let wId = 0;
function mkWorkout(partial: Partial<Workout> & { name: string }): Workout {
  wId += 1;
  return {
    id: `w-${wId}`, microcycleId: 'mc', dayOfWeek: 1, description: '',
    durationMinutes: 45, intensity: 'Moderate', workoutType: 'Strength',
    exercises: [], createdAt: NOW, updatedAt: NOW, ...partial,
  } as Workout;
}

function teamDay(name: string, description: string, exercises: WorkoutExercise[] = [], extra: Partial<Workout> = {}): Workout {
  const w = mkWorkout({ name, description, exercises, ...extra });
  (w as unknown as { isTeamDay: boolean }).isTeamDay = true;
  return w;
}

const game = () => mkWorkout({ name: 'Game Day', workoutType: 'Game' });
const gunshow = () => mkWorkout({ name: 'Gunshow', description: 'Arms pump' });
const recovery = () => mkWorkout({ name: 'Recovery Session', workoutType: 'Recovery', sessionTier: 'recovery' });
const lower = (extra: Partial<Workout> = {}) => mkWorkout({
  name: 'Lower Body Strength', description: 'Back squat, RDL',
  exercises: [mkEx('Back Squat'), mkEx('RDL')], intensity: 'High', ...extra,
});
const upper = (emph = 'pull') => mkWorkout({
  name: `Upper Body Strength - ${emph}`, description: emph === 'pull' ? 'Rows, pull-ups' : 'Bench, overhead press',
  exercises: emph === 'pull' ? [mkEx('Barbell Row'), mkEx('Pull-Ups')] : [mkEx('Bench Press'), mkEx('Overhead Press')],
});
const metcon = () => mkWorkout({
  name: 'Off-Feet MetCon', workoutType: 'MetCon', intensity: 'High',
  exercises: [mkEx('Assault Bike Intervals')],
});
const flush = () => mkWorkout({
  name: 'Easy Bike Flush', workoutType: 'Flush-Out', sessionTier: 'recovery', intensity: 'Light',
  exercises: [mkEx('Easy Bike')],
});
const sprints = () => mkWorkout({
  name: 'Flying Sprints', workoutType: 'Sprint-Intervals',
  exercises: [mkEx('Flying Sprints')],
});

// Week helper: dates Mon 2026-06-01 … Sun 2026-06-07.
const DATES = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05', '2026-06-06', '2026-06-07'];
function week(byIndex: Record<number, Array<Workout | null>>): ValidatorDayInput[] {
  return DATES.map((date, i) => ({ date, workouts: byIndex[i] ?? [] }));
}

const ids = (fs: WeekFinding[]) => fs.map((f) => `${f.severity}:${f.ruleId}`).sort().join(' | ');
const byRule = (fs: WeekFinding[], ruleId: string) => fs.filter((f) => f.ruleId === ruleId);

// Bible Option 1 in-season week (Sat game, Tue/Thu TT) — the clean baseline.
function option1Week(): ValidatorDayInput[] {
  return week({
    0: [mkWorkout({
      name: 'Lower Body Strength', description: 'Box squat, RDL + easy bike flush',
      hasCombinedConditioning: true, conditioningFlavour: 'aerobic',
      exercises: [mkEx('Box Squat'), mkEx('RDL'), mkEx('Easy Bike')],
    })],
    1: [teamDay('Team Training + Upper Pull', 'Rows, pull-ups', [mkEx('Barbell Row'), mkEx('Pull-Ups')])],
    3: [teamDay('Team Training + Upper Push', 'Bench, overhead press', [mkEx('Bench Press'), mkEx('Overhead Press')])],
    4: [gunshow()],
    5: [game()],
    6: [recovery()],
  });
}

const PROFILE = { teamTrainingIntensity: 'Hard', conditioningLevel: 'Good' } as const;

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Clean Bible Option 1 week ──');
{
  const r = validateProgramWeek({ days: option1Week(), profile: PROFILE });
  ok('zero findings', r.findings.length === 0, ids(r.findings));
  ok('anchors derived from week (game Sat, TT Tue/Thu)',
    r.anchorsUsed.gameDates.join() === '2026-06-06' &&
    r.anchorsUsed.teamTrainingDates.join() === '2026-06-02,2026-06-04' &&
    r.anchorsUsed.derived);
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. G-1 rules (Friday before Saturday game) ──');
{
  const days = option1Week();
  days[4].workouts = [metcon()]; // Friday hard conditioning
  const r = validateProgramWeek({ days, profile: PROFILE });
  const f = byRule(r.findings, 'g1_not_light');
  ok('G-1 hard conditioning → strong', f.length === 1 && f[0].severity === 'strong', ids(r.findings));
}
{
  const days = option1Week();
  days[4].workouts = [upper('pull')]; // Friday upper (medium)
  const r = validateProgramWeek({ days, profile: PROFILE });
  const f = byRule(r.findings, 'g1_not_light');
  ok('G-1 medium work → soft', f.length === 1 && f[0].severity === 'soft', ids(r.findings));
}
{
  const days = option1Week(); // Friday gunshow baseline
  const r = validateProgramWeek({ days, profile: PROFILE });
  ok('G-1 gunshow → no finding', byRule(r.findings, 'g1_not_light').length === 0, ids(r.findings));
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. G-2 rules (Thursday before Saturday game) ──');
{
  const days = option1Week();
  days[3].workouts = [lower()]; // full hard lower on G-2
  const r = validateProgramWeek({ days, profile: PROFILE });
  const f = byRule(r.findings, 'g2_hard_lower');
  ok('G-2 full lower → strong', f.length === 1 && f[0].severity === 'strong', ids(r.findings));
}
{
  const days = option1Week();
  days[3].workouts = [mkWorkout({
    name: 'Lower power primer (squat + jumps)',
    description: 'High box squat + vertical jump, tiny neural dose',
    exercises: [mkEx('High Box Squat', 2, 3), mkEx('Vertical Jump', 2, 3)],
  })];
  const r = validateProgramWeek({ days, profile: PROFILE });
  const f = byRule(r.findings, 'g2_hard_lower');
  ok('G-2 tiny neural primer → info', f.length === 1 && f[0].severity === 'info' && f[0].data?.neuralPrimer === true, ids(r.findings));
}
{
  const days = option1Week();
  days[3].workouts = [mkWorkout({
    name: 'Lower power primer',
    description: 'Squat + RDL primer',
    exercises: [mkEx('High Box Squat', 2, 3), mkEx('RDL', 2, 3)], // RDL banned
  })];
  const r = validateProgramWeek({ days, profile: PROFILE });
  const f = byRule(r.findings, 'g2_hard_lower');
  ok('G-2 primer containing RDL → strong (not primer)', f.length === 1 && f[0].severity === 'strong', ids(r.findings));
}
{
  const days = option1Week(); // Thursday TT baseline
  const r = validateProgramWeek({ days, profile: PROFILE });
  ok('G-2 team training → no proximity finding',
    byRule(r.findings, 'g2_hard_conditioning').length === 0 && byRule(r.findings, 'g1_not_light').length === 0,
    ids(r.findings));
}
{
  const days = option1Week();
  days[3].workouts = [teamDay('Team Training', 'club session'), metcon()]; // extra metcon stacked on G-2 team day
  const r = validateProgramWeek({ days, profile: PROFILE });
  const f = byRule(r.findings, 'g2_hard_conditioning');
  ok('extra hard conditioning stacked on G-2 team day → strong', f.length === 1 && f[0].severity === 'strong', ids(r.findings));
}
{
  const days = option1Week();
  days[3].workouts = [sprints()];
  const r = validateProgramWeek({ days, profile: PROFILE });
  const f = byRule(r.findings, 'g2_sprint_cod');
  ok('G-2 sprint session → strong', f.length === 1 && f[0].severity === 'strong', ids(r.findings));
}
{
  // Regression (S13/S14 false positive): team training recognised by NAME
  // ONLY (no isTeamDay flag, truncated, "(sprint + …" in text) on G-2 must
  // NOT produce sprint/conditioning proximity findings.
  const days = option1Week();
  days[3].workouts = [mkWorkout({
    name: 'Team training - field session (sprint + ',
    description: 'Team training - field session (sprint + skills + game sim)',
    workoutType: 'Strength', sessionTier: 'core', intensity: 'High',
  })];
  const r = validateProgramWeek({ days, profile: PROFILE });
  ok('G-2 team training by name only → no g2 sprint/conditioning findings',
    byRule(r.findings, 'g2_sprint_cod').length === 0 &&
    byRule(r.findings, 'g2_hard_conditioning').length === 0 &&
    byRule(r.findings, 'g1_not_light').length === 0,
    ids(r.findings));
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. G+1 rules ──');
{
  const days = option1Week();
  days[6].workouts = [upper('pull')]; // Sunday after Saturday game
  const r = validateProgramWeek({ days, profile: PROFILE });
  const f = byRule(r.findings, 'g_plus1_hard_work');
  ok('G+1 medium work → soft', f.length === 1 && f[0].severity === 'soft', ids(r.findings));
}
{
  const days = option1Week();
  days[6].workouts = [metcon()];
  const r = validateProgramWeek({ days, profile: PROFILE });
  const f = byRule(r.findings, 'g_plus1_hard_work');
  ok('G+1 hard conditioning → strong', f.length === 1 && f[0].severity === 'strong', ids(r.findings));
}
{
  const days = option1Week();
  days[6].workouts = [flush()];
  const r = validateProgramWeek({ days, profile: PROFILE });
  ok('G+1 easy flush → no finding', byRule(r.findings, 'g_plus1_hard_work').length === 0, ids(r.findings));
}
{
  // Previous week's Sunday game → Monday is G+1.
  const days = week({ 0: [metcon()], 2: [upper('pull')] });
  const r = validateProgramWeek({
    days, profile: PROFILE,
    anchors: { previousGameDate: '2026-05-31' },
  });
  const f = byRule(r.findings, 'g_plus1_hard_work');
  ok('previousGameDate protects Monday (G+1) → strong', f.length === 1 && f[0].dates.join() === '2026-06-01', ids(r.findings));
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. Weekly caps ──');
{
  const days = week({
    0: [lower()],
    1: [teamDay('Team Training + Upper Pull', 'rows', [mkEx('Barbell Row')])],
    2: [lower()],
    3: [teamDay('Team Training + Upper Push', 'bench', [mkEx('Bench Press')])],
    4: [mkWorkout({
      name: 'Full Body Strength', description: 'full body + metcon',
      hasCombinedConditioning: true, conditioningFlavour: 'high-intensity',
      exercises: [mkEx('Trap Bar Deadlift'), mkEx('Assault Bike Intervals')], intensity: 'High',
    })],
    5: [game()],
    6: [mkWorkout({ name: '6x1km Repeats', workoutType: '6x1km', intensity: 'Maximal', exercises: [mkEx('1km Repeat Intervals Run')] })],
  });
  const r = validateProgramWeek({ days, profile: PROFILE });
  ok('5 main strength → cap over (strong)',
    byRule(r.findings, 'cap_maxMainStrengthSessions_over')[0]?.severity === 'strong', ids(r.findings));
  ok('7 hard days → cap over (strong)',
    byRule(r.findings, 'cap_maxHardDays_over')[0]?.severity === 'strong', ids(r.findings));
}
{
  // Light week with reduced-load modifier: no under nags.
  const days = week({ 0: [upper('pull')], 6: [recovery()] });
  const r = validateProgramWeek({ days, profile: PROFILE, weekFlags: { reducedLoadActive: true } });
  ok('reduced-load week suppresses all under/min findings',
    r.findings.every((f) => !f.ruleId.includes('under')), ids(r.findings));
}
{
  // Same light week WITHOUT the modifier: info nags present, never worse.
  const days = week({ 0: [upper('pull')], 6: [recovery()] });
  const r = validateProgramWeek({ days, profile: PROFILE });
  const unders = r.findings.filter((f) => f.ruleId.includes('under'));
  ok('normal light week → info-level nags only',
    unders.length > 0 && unders.every((f) => f.severity === 'info'), ids(r.findings));
  ok('min_strength_under fires at 1 strength session',
    byRule(r.findings, 'min_strength_under').length === 1, ids(r.findings));
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5b. Graded hard-day cap (4 target / 5 max / 6+ strong) ──');
{
  // In-season 5 hard days: Mon lower, Tue TT, Wed metcon, Thu TT, Sat game.
  const days = week({
    0: [lower()],
    1: [teamDay('Team Training + Upper Pull', 'rows', [mkEx('Barbell Row')])],
    2: [metcon()],
    3: [teamDay('Team Training + Upper Push', 'bench', [mkEx('Bench Press')])],
    5: [game()],
  });
  const r = validateProgramWeek({ days, profile: { ...PROFILE, seasonPhase: 'In-season' } });
  const f = byRule(r.findings, 'cap_maxHardDays_over');
  ok('in-season 5 hard days → soft', f.length === 1 && f[0].severity === 'soft' && f[0].data?.observed === 5, ids(r.findings));
}
{
  // Off-season 5 hard days, well structured otherwise → info.
  const offSeason5 = () => week({
    0: [lower()],
    1: [metcon()],
    2: [lower()],
    3: [mkWorkout({ name: '6x1km Repeats', workoutType: '6x1km', intensity: 'Maximal', exercises: [mkEx('1km Repeat Intervals Run')] })],
    4: [sprints()],
  });
  const r = validateProgramWeek({ days: offSeason5(), profile: { ...PROFILE, seasonPhase: 'Off-season' } });
  const f = byRule(r.findings, 'cap_maxHardDays_over');
  ok('off-season 5 hard days (clean structure) → info', f.length === 1 && f[0].severity === 'info', ids(r.findings));

  // Same count but with a bad pairing in the week → escalated to soft.
  const days = offSeason5();
  days[0].workouts = [mkWorkout({ name: 'Lower Hinge', description: 'Deadlift, RDL', exercises: [mkEx('Deadlift'), mkEx('RDL')] }), sprints()];
  days[4].workouts = [metcon()];
  const r2 = validateProgramWeek({ days, profile: { ...PROFILE, seasonPhase: 'Off-season' } });
  const f2 = byRule(r2.findings, 'cap_maxHardDays_over');
  ok('off-season 5 hard days + bad pairing → escalated to soft',
    f2.length === 1 && f2[0].severity === 'soft' && f2[0].data?.hasDoublePairing === true, ids(r2.findings));
}
{
  // 6 hard days → strong regardless of phase.
  const days = week({
    0: [lower()],
    1: [metcon()],
    2: [lower()],
    3: [mkWorkout({ name: '6x1km Repeats', workoutType: '6x1km', intensity: 'Maximal', exercises: [mkEx('1km Repeat Intervals Run')] })],
    4: [sprints()],
    5: [metcon()],
  });
  const r = validateProgramWeek({ days, profile: { ...PROFILE, seasonPhase: 'Off-season' } });
  const f = byRule(r.findings, 'cap_maxHardDays_over');
  ok('6 hard days → strong', f.length === 1 && f[0].severity === 'strong', ids(r.findings));
}
{
  // Bye week 5 hard days → info.
  const days = week({
    0: [lower()],
    1: [metcon()],
    2: [lower()],
    3: [mkWorkout({ name: '6x1km Repeats', workoutType: '6x1km', intensity: 'Maximal', exercises: [mkEx('1km Repeat Intervals Run')] })],
    4: [metcon()],
  });
  const r = validateProgramWeek({ days, profile: { ...PROFILE, seasonPhase: 'In-season' }, weekFlags: { byeWeek: true } });
  const f = byRule(r.findings, 'cap_maxHardDays_over');
  ok('bye week 5 hard days → info (bye beats in-season; no game to protect)',
    f.length === 1 && f[0].severity === 'info', ids(r.findings));
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. Bye week logic ──');
{
  const days = week({
    0: [lower()],
    1: [teamDay('Team Training + Upper Pull', 'rows', [mkEx('Barbell Row')])],
    2: [lower()],
    3: [teamDay('Team Training + Upper Push', 'bench', [mkEx('Bench Press')])],
    4: [mkWorkout({
      name: 'Upper body hypertrophy / trunk & accessory work',
      description: 'Curls, pushdowns, face pulls, trunk',
      exercises: [mkEx('Bicep Curl'), mkEx('Tricep Pushdown'), mkEx('Face Pull')],
      sessionTier: 'optional',
      intensity: 'Light',
    })],
    5: [lower()],
  });
  const input = { days, profile: { ...PROFILE, seasonPhase: 'In-season' as const } };
  const flags = deriveWeekValidationFlags(input);
  const r = validateProgramWeek(input);
  const strengthOver = byRule(r.findings, 'cap_maxMainStrengthSessions_over');
  const hardDaysOver = byRule(r.findings, 'cap_maxHardDays_over');
  ok('in-season no-game week derives byeWeek=true',
    flags.byeWeek === true && strengthOver[0]?.data?.byeWeek === true,
    `flags=${JSON.stringify(flags)} findings=${ids(r.findings)}`);
  ok('S4/E1-style accessory day is gunshow, so main strength count is 5 not 6',
    r.counts.mainStrengthExposures === 5 && r.counts.gunshowSessions === 1,
    `strength=${r.counts.mainStrengthExposures}, gunshow=${r.counts.gunshowSessions}`);
  ok('S4/E1-style bye +1 strength finding is softened to info',
    strengthOver.length === 1 && strengthOver[0].severity === 'info',
    ids(r.findings));
  ok('S4/E1-style bye 5 hard days finding is info',
    hardDaysOver.length === 1 && hardDaysOver[0].severity === 'info',
    ids(r.findings));
}
{
  const days = week({
    0: [lower()], 1: [upper('pull')], 2: [lower()], 3: [upper('push')], 4: [lower()],
  });
  const offFlags = deriveWeekValidationFlags({
    days,
    profile: { ...PROFILE, seasonPhase: 'Off-season' as const },
  });
  const preFlags = deriveWeekValidationFlags({
    days,
    profile: { ...PROFILE, seasonPhase: 'Pre-season' as const },
  });
  const offReport = validateProgramWeek({ days, profile: { ...PROFILE, seasonPhase: 'Off-season' } });
  const preReport = validateProgramWeek({ days, profile: { ...PROFILE, seasonPhase: 'Pre-season' } });
  ok('off-season no-game week does not derive byeWeek=true',
    offFlags.byeWeek === false &&
    byRule(offReport.findings, 'cap_maxMainStrengthSessions_over')[0]?.severity === 'strong',
    `flags=${JSON.stringify(offFlags)} findings=${ids(offReport.findings)}`);
  ok('pre-season no-game week does not derive byeWeek=true',
    preFlags.byeWeek === false &&
    byRule(preReport.findings, 'cap_maxMainStrengthSessions_over')[0]?.severity === 'strong',
    `flags=${JSON.stringify(preFlags)} findings=${ids(preReport.findings)}`);
}
{
  // Bye week: 5 strength (over by 1) → info; unders suppressed.
  const days = week({
    0: [lower()], 1: [upper('pull')], 2: [lower()], 3: [upper('push')],
    4: [mkWorkout({ name: 'Full Body Strength', description: 'full body: squat, push, pull', exercises: [mkEx('Trap Bar Deadlift'), mkEx('Bench Press')] })],
    5: [metcon()],
  });
  const r = validateProgramWeek({ days, profile: PROFILE, weekFlags: { byeWeek: true } });
  const strengthOver = byRule(r.findings, 'cap_maxMainStrengthSessions_over');
  ok('bye week +1 strength overshoot → downgraded to info',
    strengthOver.length === 1 && strengthOver[0].severity === 'info', ids(r.findings));
  ok('bye week suppresses under/min nags',
    r.findings.every((f) => !f.ruleId.includes('under')), ids(r.findings));
  const hardDaysOver = byRule(r.findings, 'cap_maxHardDays_over');
  ok('bye week major overshoot still reported (hard days over by ≥2 stays strong)',
    hardDaysOver.length === 0 || hardDaysOver[0].severity !== 'info' || (hardDaysOver[0].data?.observed as number) - (hardDaysOver[0].data?.limit as number) <= 1,
    ids(r.findings));
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 7. Team training rules ──');
{
  const days = option1Week();
  days[1].workouts = [teamDay('Team Training', 'club session', [], { workoutType: 'Recovery', sessionTier: 'recovery' })];
  const r = validateProgramWeek({ days, profile: PROFILE });
  const f = byRule(r.findings, 'tt_marked_recovery');
  ok('team training marked recovery → strong', f.length === 1 && f[0].severity === 'strong', ids(r.findings));
}
{
  const r = validateProgramWeek({ days: option1Week(), profile: PROFILE });
  ok('TT counts as running + sprint/COD + conditioning in counts',
    r.counts.runningExposures === 3 && r.counts.sprintCodExposures === 3 && r.counts.conditioningExposures === 4);
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 8. Double-day pairings (multi-workout days) ──');
{
  const days = week({
    0: [mkWorkout({ name: 'Lower Hinge', description: 'Deadlift, RDL', exercises: [mkEx('Deadlift'), mkEx('RDL')] }), sprints()],
    5: [game()],
  });
  const r = validateProgramWeek({ days, profile: PROFILE });
  const f = byRule(r.findings, 'double_hinge_plus_sprint');
  ok('heavy hinge + sprint same day → strong (not hard_stop)',
    f.length === 1 && f[0].severity === 'strong' && f[0].canOverride === true, ids(r.findings));
}
{
  const days = week({
    0: [
      mkWorkout({ name: 'COD Session', description: 'Agility shuttles', workoutType: 'Conditioning', intensity: 'High', exercises: [mkEx('Shuttle Runs'), mkEx('Change of Direction Drills')] }),
      lower(),
    ],
    5: [game()],
  });
  const r = validateProgramWeek({ days, profile: PROFILE });
  const f = byRule(r.findings, 'double_cod_plus_heavy_lower');
  ok('hard COD + heavy lower same day → strong', f.length === 1 && f[0].severity === 'strong', ids(r.findings));
}
{
  const days = week({
    0: [lower(), upper('push')], // two separate full sessions
    5: [game()],
  });
  const r = validateProgramWeek({ days, profile: PROFILE });
  const f = byRule(r.findings, 'double_lower_plus_upper_full');
  ok('lower + upper as two full sessions → soft (prefer full body)',
    f.length === 1 && f[0].severity === 'soft', ids(r.findings));
}
{
  // Good pairings produce NO double-day findings.
  const days = week({
    0: [lower(), flush()],                                        // lower + easy off-feet
    1: [teamDay('Team Training + Upper Pull', 'rows', [mkEx('Barbell Row')])], // upper + TT
    5: [game()],
  });
  const r = validateProgramWeek({ days, profile: PROFILE });
  ok('lower + easy off-feet and upper + TT → no double-day findings',
    r.findings.every((f) => !f.ruleId.startsWith('double_')), ids(r.findings));
  ok('multi-workout day counts both units (strength + conditioning)',
    r.counts.mainStrengthExposures === 2 && r.counts.extraConditioningSessions === 1);
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 9. Severity policy ──');
{
  // No week in this suite may produce hard_stop — reserved for safety.
  const allWeeks = [option1Week()];
  let sawHardStop = false;
  for (const days of allWeeks) {
    const r = validateProgramWeek({ days, profile: PROFILE });
    if (r.findings.some((f) => f.severity === 'hard_stop')) sawHardStop = true;
  }
  ok('validator never emits hard_stop for programming-risk findings', !sawHardStop);
  ok('neural primer helper: empty exercises = NOT a primer (unsure → strong)',
    looksLikeNeuralPrimer(mkWorkout({ name: 'Lower', description: 'squat day' })) === false);
}

// ═════════════════════════════════════════════════════════════════════
// 10. LIVE SAMPLE — validate a real generated in-season week end-to-end.
//     Report-style: prints findings; asserts only structural sanity and
//     the hard_stop reservation (findings themselves are informational).
// ═════════════════════════════════════════════════════════════════════
console.log('\n── 10. Live sample — generated in-season week ──');

import { buildCoachingPlan, onboardingToCoachingInputs } from '../utils/coachingEngine';
import {
  resolveWeekWithConditioning,
  computeGameDatesForBlock,
  addDays,
  type ScheduleState,
} from '../utils/sessionResolver';
import { DEFAULT_ATHLETE_CONTEXT } from '../utils/sessionBuilder';
import type { Microcycle, OnboardingData, TrainingProgram } from '../types/domain';

try {
  const BLOCK_START = '2026-03-23';
  const BLOCK_END = '2026-04-19';
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const profileData: Partial<OnboardingData> = {
    seasonPhase: 'In-season', gameDay: 'Saturday',
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: 2, teamTrainingDays: ['Tuesday', 'Thursday'],
    teamTrainingIntensity: 'Hard', sprintExposure: '2+ times per week',
    conditioningLevel: 'Good', recentTrainingLoad: 'Very consistent',
    experienceLevel: '2-5 years', injuries: [],
  };
  const inputs = onboardingToCoachingInputs(profileData as OnboardingData);
  const plan = buildCoachingPlan(inputs);
  const workouts: Workout[] = plan.weeklyPlan.map((s, idx) => {
    const dayNum = DAY_NAMES.indexOf(s.dayOfWeek || '');
    const w = mkWorkout({
      name: s.focus.substring(0, 60), description: s.focus,
      intensity: s.isHardExposure ? 'High' : s.tier === 'optional' ? 'Light' : 'Moderate',
      workoutType: s.tier === 'recovery' ? 'Recovery' : 'Strength',
      sessionTier: s.tier,
      hasCombinedConditioning: s.hasCombinedConditioning,
      conditioningFlavour: s.conditioningFlavour,
      conditioningCategory: s.conditioningCategory,
    });
    (w as unknown as { id: string; dayOfWeek: number }).id = `w-live-${idx}`;
    (w as unknown as { dayOfWeek: number }).dayOfWeek = dayNum >= 0 ? dayNum : 0;
    if (s.isTeamDay) (w as unknown as { isTeamDay: boolean }).isTeamDay = true;
    return w;
  });
  const microcycle: Microcycle = {
    id: 'mc-live', programId: 'p', weekNumber: 1, startDate: BLOCK_START,
    endDate: addDays(BLOCK_START, 6), miniCycleNumber: 1, intensityMultiplier: 1,
    workouts, createdAt: NOW, updatedAt: NOW,
  };
  const program: TrainingProgram = {
    id: 'p', userId: 'u', name: 'Live', description: '', programPhase: 'In-Season',
    startDate: BLOCK_START, endDate: BLOCK_END, microcycles: [microcycle],
    primaryFocus: 'Strength', isActive: true, createdAt: NOW, updatedAt: NOW,
  };
  const markedDays: Record<string, 'game' | 'rest'> = {};
  for (const gd of computeGameDatesForBlock('Saturday', BLOCK_START, BLOCK_END)) markedDays[gd] = 'game';
  const state: ScheduleState = {
    currentProgram: program, currentMicrocycle: microcycle,
    manualOverrides: {}, markedDays, athleteContext: DEFAULT_ATHLETE_CONTEXT,
    seasonPhase: 'In-season', gameDay: 'Saturday', readiness: plan.readiness,
  };
  const resolved = resolveWeekWithConditioning(BLOCK_START, state);
  const report = validateProgramWeek({
    days: validatorDaysFromResolvedWeek(resolved),
    profile: { seasonPhase: 'In-season', teamTrainingIntensity: 'Hard', conditioningLevel: 'Good', experienceLevel: '2-5 years' },
  });

  if (report.findings.length > 0) {
    console.log('  Findings on live generated week (informational):');
    for (const f of report.findings) console.log(`    [${f.severity}] ${f.ruleId}: ${f.message}`);
  } else {
    console.log('  Live generated week: no findings');
  }
  ok('live week validated (7 days, counts computed)', resolved.length === 7 && report.counts.days.length === 7);
  ok('live week has no hard_stop findings', report.findings.every((f) => f.severity !== 'hard_stop'));
  ok('live week has no strong findings (clean generation)',
    report.findings.every((f) => f.severity !== 'strong'),
    report.findings.filter((f) => f.severity === 'strong').map((f) => f.ruleId).join(', '));
} catch (e) {
  ok('live sample ran without throwing', false, String(e));
}

// ─── Summary ─────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(60)}`);
console.log(`weekStructureValidatorTests: ${pass} passed, ${fail} failed`);
if (failures.length) console.log('Failures:\n  - ' + failures.join('\n  - '));
process.exit(fail > 0 ? 1 : 0);
