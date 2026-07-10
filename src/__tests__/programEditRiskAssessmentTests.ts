/**
 * programEditRiskAssessmentTests
 *
 * Pure pre-commit risk assessment contract. This does not wire into UI,
 * PlanChangeSheet, coach revisions, or commit behaviour.
 *
 * Run: npx sucrase-node src/__tests__/programEditRiskAssessmentTests.ts
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import type { Workout, WorkoutExercise } from '../types/domain';
import type { ActiveInjuryConstraint } from '../store/coachUpdatesStore';
import {
  assessProgramEditRisk,
  type ProgramEditRiskAssessment,
} from '../utils/programEditRiskAssessment';
import type { ValidateProgramWeekInput, ValidatorDayInput } from '../rules/weekStructureValidator';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    pass += 1;
    console.log(`  ✓ ${name}`);
    return;
  }
  fail += 1;
  failures.push(name);
  console.log(`  ✗ ${name}${detail ? `\n      ${String(detail)}` : ''}`);
}

function byRule(assessment: ProgramEditRiskAssessment, ruleId: string) {
  return assessment.findings.filter((finding) => finding.ruleId === ruleId);
}

const NOW = '2026-06-01T00:00:00.000Z';
let exId = 0;
let wId = 0;

function mkEx(name: string, sets = 3, repsMax = 8): WorkoutExercise {
  exId += 1;
  return {
    id: `ex-${exId}`,
    workoutId: 'workout',
    exerciseId: `exercise-${exId}`,
    exerciseOrder: exId,
    prescribedSets: sets,
    prescribedRepsMin: Math.min(repsMax, 3),
    prescribedRepsMax: repsMax,
    restSeconds: 90,
    exercise: {
      id: `exercise-${exId}`,
      name,
      description: '',
      muscleGroups: [],
      exerciseType: 'Compound',
      equipmentRequired: [],
      difficultyLevel: 'Intermediate',
      createdAt: NOW,
      updatedAt: NOW,
    },
    createdAt: NOW,
    updatedAt: NOW,
  } as WorkoutExercise;
}

function mkWorkout(partial: Partial<Workout> & { name: string }): Workout {
  wId += 1;
  return {
    id: `workout-${wId}`,
    microcycleId: 'microcycle',
    dayOfWeek: 1,
    name: partial.name,
    description: '',
    durationMinutes: 45,
    intensity: 'Moderate',
    workoutType: 'Strength',
    exercises: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...partial,
  } as Workout;
}

function teamDay(name = 'Team Training'): Workout {
  const workout = mkWorkout({
    name,
    description: 'Club field session',
    workoutType: 'Team Training',
    intensity: 'High',
  });
  (workout as unknown as { isTeamDay: boolean }).isTeamDay = true;
  return workout;
}

const game = () => mkWorkout({ name: 'Game Day', workoutType: 'Game', intensity: 'High' });
const recovery = () => mkWorkout({ name: 'Recovery Session', workoutType: 'Recovery', sessionTier: 'recovery', intensity: 'Light' });
const gunshow = () => mkWorkout({ name: 'Gunshow', description: 'Arms pump', sessionTier: 'optional', intensity: 'Light' });
const lower = () => mkWorkout({
  name: 'Lower Body Strength',
  description: 'Back squat and RDL',
  intensity: 'High',
  exercises: [mkEx('Back Squat'), mkEx('RDL')],
});
const upper = () => mkWorkout({
  name: 'Upper Body Strength',
  description: 'Rows and pull-ups',
  exercises: [mkEx('Barbell Row'), mkEx('Pull-Ups')],
});
const metcon = () => mkWorkout({
  name: 'Hard Conditioning',
  workoutType: 'MetCon',
  intensity: 'High',
  exercises: [mkEx('Assault Bike Intervals')],
});
const sprints = () => mkWorkout({
  name: 'Flying Sprints',
  workoutType: 'Sprint-Intervals',
  intensity: 'High',
  exercises: [mkEx('Flying Sprints')],
});

const DATES = [
  '2026-06-01',
  '2026-06-02',
  '2026-06-03',
  '2026-06-04',
  '2026-06-05',
  '2026-06-06',
  '2026-06-07',
];

function week(byIndex: Record<number, Array<Workout | null>>): ValidatorDayInput[] {
  return DATES.map((date, index) => ({
    date,
    workouts: byIndex[index] ?? [],
  }));
}

const PROFILE = {
  seasonPhase: 'In-season' as const,
  teamTrainingIntensity: 'Hard' as const,
  conditioningLevel: 'Good' as const,
};

function input(days: ValidatorDayInput[], extra: Partial<ValidateProgramWeekInput> = {}): ValidateProgramWeekInput {
  return {
    days,
    profile: PROFILE,
    ...extra,
  };
}

function cleanWeek(): ValidatorDayInput[] {
  return week({
    0: [lower()],
    1: [teamDay('Team Training + Upper Pull')],
    3: [teamDay('Team Training + Upper Push')],
    4: [gunshow()],
    5: [game()],
    6: [recovery()],
  });
}

function ruleList(assessment: ProgramEditRiskAssessment): string {
  return assessment.findings.map((finding) => `${finding.level}:${finding.ruleId}`).join(' | ');
}

console.log('\n[1] unchanged existing findings are not surfaced');
{
  const current = cleanWeek();
  current[4].workouts = [upper()];
  const proposed = cleanWeek();
  proposed[4].workouts = [upper()];
  const assessment = assessProgramEditRisk({
    current: input(current),
    proposed: input(proposed),
  });
  ok('unchanged soft G-1 finding returns allow', assessment.decision === 'allow', ruleList(assessment));
  ok('unchanged finding list is empty', assessment.findings.length === 0, ruleList(assessment));
}

console.log('\n[2] info findings allow');
{
  const lightWeek = week({
    0: [upper()],
    6: [recovery()],
  });
  const assessment = assessProgramEditRisk({
    current: input(lightWeek, { weekFlags: { reducedLoadActive: true, byeWeek: false } }),
    proposed: input(lightWeek, { weekFlags: { byeWeek: false } }),
  });
  ok('new info finding returns allow', assessment.decision === 'allow', ruleList(assessment));
  ok('info finding surfaced', assessment.findings.some((finding) => finding.level === 'info'), ruleList(assessment));
}

console.log('\n[3] soft findings confirm');
{
  const proposed = cleanWeek();
  proposed[4].workouts = [upper()];
  const assessment = assessProgramEditRisk({
    current: input(cleanWeek()),
    proposed: input(proposed),
  });
  ok('new soft finding returns confirm', assessment.decision === 'confirm', ruleList(assessment));
  ok('G-1 medium work is soft', byRule(assessment, 'g1_not_light')[0]?.level === 'soft', ruleList(assessment));
}

console.log('\n[4] strong findings confirm');
{
  const proposed = cleanWeek();
  proposed[6].workouts = [metcon()];
  const assessment = assessProgramEditRisk({
    current: input(cleanWeek()),
    proposed: input(proposed),
  });
  ok('new strong finding returns confirm', assessment.decision === 'confirm', ruleList(assessment));
  ok('G+1 hard work is strong but not blocked', byRule(assessment, 'g_plus1_hard_work')[0]?.level === 'strong', ruleList(assessment));
}

console.log('\n[5] hard-stop findings block');
{
  const proposed = cleanWeek();
  proposed[5].workouts = [game(), lower()];
  const assessment = assessProgramEditRisk({
    current: input(cleanWeek()),
    proposed: input(proposed),
  });
  ok('new hard_stop finding returns block', assessment.decision === 'block', ruleList(assessment));
  ok('game-day hard lower blocks', byRule(assessment, 'game_day_hard_work')[0]?.level === 'hard_stop', ruleList(assessment));
}

console.log('\n[6] G-1 hard lower blocks');
{
  const proposed = cleanWeek();
  proposed[4].workouts = [lower()];
  const assessment = assessProgramEditRisk({
    current: input(cleanWeek()),
    proposed: input(proposed),
  });
  ok('G-1 hard lower proposal returns block', assessment.decision === 'block', ruleList(assessment));
  ok('G-1 hard lower uses hard-stop edit guard', byRule(assessment, 'g1_hard_work')[0]?.source === 'program_edit_guard', ruleList(assessment));
}

console.log('\n[7] 5 hard days confirm, not block');
{
  const proposed = week({
    0: [lower()],
    1: [teamDay('Team Training + Upper Pull')],
    2: [metcon()],
    3: [teamDay('Team Training + Upper Push')],
    5: [game()],
    6: [recovery()],
  });
  const assessment = assessProgramEditRisk({
    current: input(cleanWeek()),
    proposed: input(proposed),
  });
  ok('5 hard days returns confirm', assessment.decision === 'confirm', ruleList(assessment));
  ok('5 hard days is not block', assessment.highestLevel !== 'hard_stop', ruleList(assessment));
  ok('cap finding is soft', byRule(assessment, 'cap_maxHardDays_over')[0]?.level === 'soft', ruleList(assessment));
  ok('cap finding declares the weekly-load hierarchy tier',
    byRule(assessment, 'cap_maxHardDays_over')[0]?.hierarchyTier === 'weekly_load_caps',
    ruleList(assessment));
}

console.log('\n[8] existing noisy week plus safe edit allows');
{
  const current = cleanWeek();
  current[4].workouts = [upper()];
  const proposed = cleanWeek();
  proposed[4].workouts = [upper()];
  proposed[2].workouts = [recovery()];
  const assessment = assessProgramEditRisk({
    current: input(current),
    proposed: input(proposed),
  });
  ok('safe edit does not re-surface existing G-1 noise', assessment.decision === 'allow', ruleList(assessment));
  ok('safe edit surfaces no findings', assessment.findings.length === 0, ruleList(assessment));
}

console.log('\n[9] payload shape');
{
  const proposed = cleanWeek();
  proposed[4].workouts = [upper()];
  const assessment = assessProgramEditRisk({
    current: input(cleanWeek()),
    proposed: input(proposed),
  });
  const finding = assessment.findings[0];
  ok('finding payload includes ruleId', typeof finding?.ruleId === 'string' && finding.ruleId.length > 0);
  ok('finding payload includes level', finding?.level === 'soft');
  ok('finding payload includes message', typeof finding?.message === 'string' && finding.message.length > 0);
  ok('finding payload includes canOverride', typeof finding?.canOverride === 'boolean');
  ok('introducedRuleIds populated', assessment.introducedRuleIds.includes('g1_not_light'), assessment.introducedRuleIds.join(','));
}

console.log('\n[10] protected anchors and red-flag constraints');
{
  const proposed = cleanWeek();
  proposed[5].workouts = [recovery()];
  const assessment = assessProgramEditRisk({
    current: input(cleanWeek()),
    proposed: input(proposed),
  });
  ok('deleting protected game anchor blocks normal edits', assessment.decision === 'block', ruleList(assessment));
  ok('protected game anchor finding is hard_stop', byRule(assessment, 'protected_game_anchor_removed')[0]?.level === 'hard_stop', ruleList(assessment));
  const metadataOnly = assessProgramEditRisk({
    current: input(cleanWeek()),
    proposed: input(proposed, { anchors: { gameDates: ['2026-06-06'] } }),
  });
  ok('anchor metadata does not mask missing visible game section', metadataOnly.decision === 'block', ruleList(metadataOnly));
}
{
  const injury: ActiveInjuryConstraint = {
    id: 'injury-red-flag',
    type: 'injury',
    bodyPart: 'chest',
    bucket: null,
    severity: 8,
    status: 'active',
    startDate: '2026-06-01',
    lastUpdatedAt: NOW,
    source: 'coach',
    seriousSymptoms: true,
    rules: [],
    safeFocus: [],
    advice: [],
    modifierAffects: ['current_week', 'future_generation'],
  };
  const assessment = assessProgramEditRisk({
    current: input(cleanWeek()),
    proposed: input(cleanWeek()),
    activeConstraints: [injury],
    todayISO: '2026-06-01',
  });
  ok('red-flag active constraint blocks normal edits', assessment.decision === 'block', ruleList(assessment));
  ok('red-flag finding is hard_stop', byRule(assessment, 'active_injury_hard_stop')[0]?.level === 'hard_stop', ruleList(assessment));

  const gameConflict = cleanWeek();
  gameConflict[5].workouts = [game(), lower()];
  const ordered = assessProgramEditRisk({
    current: input(cleanWeek()),
    proposed: input(gameConflict),
    activeConstraints: [injury],
    todayISO: '2026-06-01',
  });
  ok('red-flag hard stop is surfaced before game-protection hard stop',
    ordered.findings[0]?.ruleId === 'active_injury_hard_stop',
    ruleList(ordered));
  ok('red-flag finding declares the hard-stop safety hierarchy tier',
    ordered.findings[0]?.hierarchyTier === 'hard_stop_safety',
    ruleList(ordered));
  ok('game-day finding declares the game-protection hierarchy tier',
    byRule(ordered, 'game_day_hard_work')[0]?.hierarchyTier === 'game_day_protection',
    ruleList(ordered));
}

console.log(`\nprogramEditRiskAssessmentTests: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  for (const failure of failures) console.log(` - ${failure}`);
  process.exit(1);
}
