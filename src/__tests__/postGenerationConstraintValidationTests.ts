/**
 * Systemic post-write safety invariants for active constraints.
 * Run: npx sucrase-node src/__tests__/postGenerationConstraintValidationTests.ts
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  },
};

import fs from 'fs';
import path from 'path';
import type {
  Microcycle,
  OnboardingData,
  TrainingProgram,
  WeekScopedWorkoutOverlay,
  Workout,
} from '../types/domain';
import type {
  ActiveEquipmentConstraint,
  ActiveFatigueConstraint,
  ActiveInjuryConstraint,
} from '../store/coachUpdatesStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useReadinessStore } from '../store/readinessStore';
import {
  validateProgramAgainstActiveConstraints,
  validateWeekOverlayAgainstActiveConstraints,
  validateWorkoutAgainstActiveConstraints,
} from '../utils/postGenerationConstraintValidation';
import { hasMeaningfulWorkoutContent } from '../utils/workoutContent';
import { repeatWeekIntoNextWeekInMemory as repeatWeekIntoNextWeek } from '../utils/repeatWeek';
import { commitRebuiltProgram } from '../utils/weekRebuild';
import {
  COACH_REVISION_PROPOSAL_SCHEMA_VERSION,
  buildCoachRevisionWeekSnapshotFromProjectedDays,
  type CoachRevisionProposal,
} from '../utils/coachRevisionProposal';
import { applyCoachRevisionDateOverrides } from '../utils/coachRevisionOverrideWriter';
import type { ResolvedDay } from '../utils/sessionResolver';
import { classifyVisibleSession } from '../rules/sessionClassificationAdapter';

const TODAY = '2099-01-01';
const MON = '2099-01-05';
const TUE = '2099-01-06';
const NEXT_MON = '2099-01-12';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function section(name: string) { console.log(`\n${name}`); }
function ok(name: string, condition: boolean, detail?: unknown) {
  if (condition) { pass++; console.log(`  PASS ${name}`); }
  else {
    fail++;
    failures.push(name);
    console.log(`  FAIL ${name}${detail === undefined ? '' : ` ${JSON.stringify(detail)}`}`);
  }
}
function eq<T>(name: string, actual: T, expected: T) {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), { expected, actual });
}

function exercise(name: string, equipmentRequired: string[] = []): any {
  const id = `ex-${name.toLowerCase().replace(/\W+/g, '-')}`;
  return {
    id: `row-${id}`,
    workoutId: 'workout',
    exerciseId: id,
    exerciseOrder: 0,
    prescribedSets: 3,
    prescribedRepsMin: 6,
    prescribedRepsMax: 8,
    restSeconds: 90,
    exercise: {
      id,
      name,
      description: name,
      exerciseType: 'Compound',
      muscleGroups: [],
      equipmentRequired,
      difficultyLevel: 'Intermediate',
      createdAt: '',
      updatedAt: '',
    },
    createdAt: '',
    updatedAt: '',
  };
}

function workout(
  name: string,
  dayOfWeek: number,
  rows: any[],
  extra: Partial<Workout> = {},
): Workout {
  return {
    id: `workout-${name.toLowerCase().replace(/\W+/g, '-')}`,
    microcycleId: 'mc-1',
    dayOfWeek,
    name,
    description: '',
    durationMinutes: 60,
    intensity: 'Moderate',
    workoutType: 'Strength',
    sessionTier: 'core',
    exercises: rows,
    createdAt: '',
    updatedAt: '',
    ...extra,
  };
}

function names(value: Workout | null | undefined): string[] {
  return (value?.exercises ?? []).map((row) => row.exercise?.name ?? '').filter(Boolean);
}

function injury(
  bucket: ActiveInjuryConstraint['bucket'],
  severity: number,
  id = `injury-${bucket}-${severity}`,
): ActiveInjuryConstraint {
  return {
    id,
    type: 'injury',
    bodyPart: String(bucket),
    bucket,
    severity,
    status: 'active',
    startDate: TODAY,
    lastUpdatedAt: `${TODAY}T12:00:00.000Z`,
    adjustmentLevel: severity >= 8 ? 'training_paused' : 'moderate',
    seriousSymptoms: false,
    rules: [],
    safeFocus: [],
    advice: [],
  };
}

function noBarbell(): ActiveEquipmentConstraint {
  return {
    id: 'equipment-no-barbell',
    type: 'equipment',
    mode: 'without',
    tags: ['barbell'],
    severity: 0,
    status: 'active',
    startDate: TODAY,
    lastUpdatedAt: `${TODAY}T12:00:00.000Z`,
    source: 'tap',
    modifierAffects: ['current_week', 'future_generation'],
    rules: [],
    safeFocus: [],
    advice: [],
  };
}

const FULL_GYM: OnboardingData = {
  trainingLocation: 'Commercial gym',
  equipment: ['Full Gym'],
};

function microcycle(workouts: Workout[], startDate = MON): Microcycle {
  return {
    id: 'mc-1',
    programId: 'program',
    weekNumber: 1,
    startDate,
    endDate: startDate === MON ? '2099-01-11' : '2099-01-18',
    miniCycleNumber: 1,
    intensityMultiplier: 1,
    workouts,
    createdAt: '',
    updatedAt: '',
  };
}

function program(workouts: Workout[], startDate = MON): TrainingProgram {
  const mc = microcycle(workouts, startDate);
  return {
    id: 'program',
    userId: 'user',
    name: 'Test program',
    description: '',
    programPhase: 'Pre-Season-Skills',
    startDate: mc.startDate,
    endDate: mc.endDate,
    microcycles: [mc],
    primaryFocus: 'S&C',
    isActive: true,
    createdAt: '',
    updatedAt: '',
  };
}

function overlay(workoutsByDate: Record<string, Workout | null>): WeekScopedWorkoutOverlay {
  return {
    id: 'overlay',
    weekStart: NEXT_MON,
    weekEnd: '2099-01-18',
    anchorDate: null,
    reason: 'repeat_week',
    workoutsByDate,
    createdAt: '',
    updatedAt: '',
  };
}

function resolvedDay(date: string, value: Workout | null): ResolvedDay {
  return {
    date,
    dayOfWeek: new Date(`${date}T12:00:00`).getDay(),
    short: 'DAY',
    isToday: false,
    workout: value,
    source: value ? 'template' : 'none',
    indicator: value ? 'core' : null,
  };
}

function resetStores() {
  useProgramStore.getState().clear();
  useCoachUpdatesStore.getState().clearAllCoachUpdates();
  useReadinessStore.getState().clear();
  useProfileStore.getState().clear();
  useProfileStore.getState().updateOnboardingData(FULL_GYM);
}

section('[1] severe knee and hamstring constraints revalidate generated programs');
{
  const kneeCandidate = program([workout('Lower Strength', 1, [
    exercise('Back Squat', ['Barbell']),
    exercise('Box Jump'),
    exercise('Bench Press', ['Barbell', 'Bench']),
  ])]);
  const kneeValidated = validateProgramAgainstActiveConstraints({
    program: kneeCandidate,
    todayISO: TODAY,
    activeConstraints: [injury('knee', 9)],
    profile: FULL_GYM,
  });
  const kneeNames = names(kneeValidated.microcycles[0].workouts[0]);
  ok('9/10 knee removes knee-dominant squat after generation', !kneeNames.includes('Back Squat'), kneeNames);
  ok('9/10 knee removes plyometric work after generation', !kneeNames.includes('Box Jump'), kneeNames);
  ok('9/10 knee preserves unaffected upper work', kneeNames.includes('Bench Press'), kneeNames);
  ok('post-constraint canonicalisation gives preserved unaffected upper work an honest identity',
    kneeValidated.microcycles[0].workouts[0].name === 'Upper Push' &&
      kneeValidated.microcycles[0].workouts[0].workoutType === 'Strength' &&
      !kneeValidated.microcycles[0].workouts[0].conditioningBlock,
    {
      name: kneeValidated.microcycles[0].workouts[0].name,
      type: kneeValidated.microcycles[0].workouts[0].workoutType,
      conditioning: kneeValidated.microcycles[0].workouts[0].conditioningBlock,
    });

  const hamstringCandidate = program([workout('Lower + Running', 1, [
    exercise('Deadlift', ['Barbell']),
    exercise('Nordic Lower'),
    exercise('10m Sprint'),
    exercise('Easy Run'),
    exercise('Bench Press', ['Barbell', 'Bench']),
  ])]);
  const hamstringValidated = validateProgramAgainstActiveConstraints({
    program: hamstringCandidate,
    todayISO: TODAY,
    activeConstraints: [injury('hamstring', 9)],
    profile: FULL_GYM,
  });
  const hamstringNames = names(hamstringValidated.microcycles[0].workouts[0]);
  ok('9/10 hamstring removes Deadlift', !hamstringNames.includes('Deadlift'), hamstringNames);
  ok('9/10 hamstring removes Nordic', !hamstringNames.includes('Nordic Lower'), hamstringNames);
  ok('9/10 hamstring removes sprint and running',
    !hamstringNames.includes('10m Sprint') && !hamstringNames.includes('Easy Run'), hamstringNames);
  ok('9/10 hamstring preserves unaffected upper work', hamstringNames.includes('Bench Press'), hamstringNames);
}

section('[1b] typed hard-running intent cannot hide behind generic conditioning copy');
{
  const runningRow = exercise('Running intervals 20min');
  const candidate = workout('Generic Intervals', 1, [runningRow, exercise('Bench Press')], {
    planEntryId: 'test:typed-mixed-push-conditioning',
    workoutType: 'Mixed',
    strengthIntent: {
      archetype: 'upper',
      primaryPattern: 'push',
      plannedPatterns: ['push'],
      effectivePatterns: ['push'],
    },
    strengthPatternContributions: ['push'],
    conditioningCategory: 'vo2',
    conditioningFlavour: 'high-intensity',
    conditioningBlock: {
      intent: 'high-intensity',
      options: [{
        title: 'Running intervals',
        description: 'Controlled repeat efforts',
        exerciseIds: [runningRow.id],
        ...({ modality: 'running' } as any),
      }],
    },
  });
  const result = validateWorkoutAgainstActiveConstraints({
    workout: candidate,
    date: MON,
    todayISO: TODAY,
    activeConstraints: [injury('hamstring', 9)],
    profile: FULL_GYM,
  });
  ok('9/10 hamstring removes typed high-intensity running when copy omits sprint wording',
    !result.workout?.conditioningBlock && !names(result.workout).includes('Running intervals 20min'), result.workout);
  ok('typed hard-running removal preserves unaffected upper work',
    names(result.workout).includes('Bench Press'), names(result.workout));
}

section('[2] limiting injury is restrictive, not a full pause');
{
  const candidate = workout('Mixed Strength', 1, [
    exercise('Deadlift', ['Barbell']),
    exercise('Goblet Squat', ['Dumbbells']),
    exercise('Bench Press', ['Barbell', 'Bench']),
  ]);
  const result = validateWorkoutAgainstActiveConstraints({
    workout: candidate,
    date: MON,
    todayISO: TODAY,
    activeConstraints: [injury('hamstring', 6)],
    profile: FULL_GYM,
  });
  ok('6/10 hamstring removes heavy hinge', !names(result.workout).includes('Deadlift'), names(result.workout));
  ok('6/10 lower-body restriction removes lower patterns and preserves unaffected upper work',
    !names(result.workout).includes('Goblet Squat') && names(result.workout).includes('Bench Press'),
    names(result.workout));
  ok('6/10 does not collapse the session', !!result.workout && !result.collapsedToRest);
}

section('[3] typed running/speed/power content is filtered and empty shells collapse');
{
  const candidate = workout('Sprint + Plyo', 1, [], {
    workoutType: 'Conditioning',
    conditioningBlock: {
      intent: 'high-intensity',
      options: [{ title: 'Running intervals', description: 'Hard 200m repeat runs', exerciseIds: [] }],
    },
    speedBlock: {
      id: 'speed', title: 'Speed Block', label: 'Speed', kind: 'cod', placement: 'standalone',
      durationMinutes: 15, prescription: '6 hard cuts and accelerations',
      counting: { hardExposure: true, mainStrength: false, conditioningCredit: 'none', createsHardDay: true, sprintCodExposure: true },
    },
    powerBlock: {
      id: 'power', kind: 'primer', family: 'lower', title: 'Power Primer',
      prescription: '3 x 3', placement: 'pre_lift',
      options: [{ name: 'Box Jump', sets: 3, repsMin: 3, repsMax: 3, equipmentRequired: [] }],
      notes: [],
      counting: { hardExposure: false, mainStrength: false, conditioningCredit: 'none', isFinisher: false },
    },
  });
  const result = validateWorkoutAgainstActiveConstraints({
    workout: candidate,
    date: MON,
    todayISO: TODAY,
    activeConstraints: [injury('knee', 9)],
    profile: FULL_GYM,
  });
  ok('severe lower-limb injury clears typed sprint/COD', result.removedComponents.includes('speed'));
  ok('severe lower-limb injury clears running conditioning', result.removedComponents.includes('conditioning'));
  ok('severe knee injury clears lower power work', result.removedComponents.includes('power'));
  ok('all-content removal collapses honestly', result.workout === null && result.collapsedToRest);
}

section('[3b] final content owns power and contrast identity without active constraints');
{
  const contrastPower = {
    id: 'power-final-content',
    kind: 'contrast' as const,
    family: 'lower' as const,
    title: 'Contrast Power',
    prescription: '3 x 3',
    placement: 'pre_lift' as const,
    options: [{
      name: 'Vertical Jump', sets: 3, repsMin: 3, repsMax: 3, equipmentRequired: [],
    }],
    notes: ['Contrast: pair this with the heavy lift.'],
    counting: {
      hardExposure: false,
      mainStrength: false,
      conditioningCredit: 'none' as const,
      isFinisher: false,
    },
  };

  const conditioningOnly = workout('Bike Tempo', 1, [exercise('Bike Tempo')], {
    workoutType: 'Conditioning',
    powerBlock: contrastPower,
  });
  const conditioningResult = validateWorkoutAgainstActiveConstraints({
    workout: conditioningOnly,
    date: MON,
    todayISO: TODAY,
    activeConstraints: [],
    profile: FULL_GYM,
  });
  ok('conditioning-only final workout loses stale power metadata',
    !conditioningResult.workout?.powerBlock && names(conditioningResult.workout).includes('Bike Tempo'),
    conditioningResult.workout);
  ok('alignment reports power removal even without active constraints',
    conditioningResult.changed && conditioningResult.removedComponents.includes('power'),
    conditioningResult);

  const lightLower = workout('Lower Support', 2, [exercise('Goblet Squat')], {
    powerBlock: contrastPower,
  });
  const lightResult = validateWorkoutAgainstActiveConstraints({
    workout: lightLower,
    date: TUE,
    todayISO: TODAY,
    activeConstraints: [],
    profile: FULL_GYM,
  });
  ok('contrast without a heavy same-family main lift becomes Power Primer',
    lightResult.workout?.powerBlock?.kind === 'primer'
      && lightResult.workout.powerBlock.title === 'Power Primer',
    lightResult.workout?.powerBlock);

  const heavySquat = {
    ...exercise('Back Squat', ['Barbell']),
    prescribedRepsMin: 4,
    prescribedRepsMax: 5,
    prescribedWeightKg: 100,
  };
  const heavyLower = workout('Lower Strength', 2, [heavySquat], {
    powerBlock: contrastPower,
  });
  const heavyResult = validateWorkoutAgainstActiveConstraints({
    workout: heavyLower,
    date: TUE,
    todayISO: TODAY,
    activeConstraints: [],
    profile: FULL_GYM,
  });
  ok('real heavy same-family lift preserves Contrast Power',
    heavyResult.workout?.powerBlock?.kind === 'contrast',
    heavyResult.workout?.powerBlock);

  const emptyPowerShell = workout('Power Only Shell', 2, [], { powerBlock: contrastPower });
  const emptyResult = validateWorkoutAgainstActiveConstraints({
    workout: emptyPowerShell,
    date: TUE,
    todayISO: TODAY,
    activeConstraints: [],
    profile: FULL_GYM,
  });
  ok('power-only shell with no final strength collapses honestly',
    emptyResult.workout === null && emptyResult.collapsedToRest,
    emptyResult);

  const equipmentStripped = validateWorkoutAgainstActiveConstraints({
    workout: heavyLower,
    date: TUE,
    todayISO: TODAY,
    activeConstraints: [noBarbell()],
    profile: FULL_GYM,
  });
  ok('post-filter alignment removes power when equipment strips its paired lift',
    equipmentStripped.workout === null
      && equipmentStripped.collapsedToRest
      && equipmentStripped.removedComponents.includes('power'),
    equipmentStripped);
}

section('[4] equipment constraints filter unavailable work without removing safe work');
{
  const candidate = workout('Full Body', 1, [
    exercise('Back Squat', ['Barbell', 'Rack']),
    exercise('Barbell Row', ['Barbell']),
    exercise('Push-Up'),
  ]);
  const result = validateWorkoutAgainstActiveConstraints({
    workout: candidate,
    date: MON,
    todayISO: TODAY,
    activeConstraints: [noBarbell()],
    profile: FULL_GYM,
  });
  ok('no-barbell removes barbell/rack work',
    !names(result.workout).includes('Back Squat') && !names(result.workout).includes('Barbell Row'),
    names(result.workout));
  ok('no-barbell preserves bodyweight work', names(result.workout).includes('Push-Up'), names(result.workout));
}

section('[5] game, practice-match, and team anchors are preserved');
{
  const severeKnee = injury('knee', 9);
  const team = workout('Team Training', 2, [exercise('10m Sprint')], {
    workoutType: 'Team Training',
    ...({ isTeamDay: true } as any),
  });
  const practice = workout('Practice Match', 6, [exercise('Change of Direction Drill')], {
    workoutType: 'Game',
    sessionTier: 'core',
  });
  const teamResult = validateWorkoutAgainstActiveConstraints({
    workout: team, date: TUE, todayISO: TODAY, activeConstraints: [severeKnee], profile: FULL_GYM,
  });
  const gameResult = validateWorkoutAgainstActiveConstraints({
    workout: practice, date: '2099-01-10', todayISO: TODAY, activeConstraints: [severeKnee], profile: FULL_GYM,
  });
  ok('team training anchor is not removed',
    !!teamResult.workout && classifyVisibleSession(teamResult.workout).anchors.teamTraining && teamResult.preservedAnchor);
  ok('game/practice-match anchor is not removed',
    !!gameResult.workout && classifyVisibleSession(gameResult.workout).anchors.game && gameResult.preservedAnchor);
}

section('[6] cleared constraints are neutral');
{
  const cleared = { ...injury('hamstring', 9), status: 'resolved' as const };
  const candidate = workout('Sprint', 1, [exercise('10m Sprint')]);
  const result = validateWorkoutAgainstActiveConstraints({
    workout: candidate, date: MON, todayISO: TODAY, activeConstraints: [cleared], profile: FULL_GYM,
  });
  ok('resolved constraint does not affect future write',
    result.activeConstraintIds.length === 0 && names(result.workout).some((name) => /sprint/i.test(name)));
}

section('[6b] red-flag and full-pause readiness hard stops remain hard stops');
{
  const redFlag = {
    ...injury('hamstring', 9, 'injury-red-flag'),
    seriousSymptoms: true,
    seriousSymptom: 'cannot function normally',
  };
  const fatigue: ActiveFatigueConstraint = {
    id: 'fatigue-full-pause',
    type: 'fatigue',
    severity: 9,
    status: 'active',
    startDate: TODAY,
    lastUpdatedAt: `${TODAY}T12:00:00.000Z`,
    reasonLabel: 'Severe symptoms',
    rules: ['bedridden'],
    safeFocus: ['Rest'],
    advice: [],
  };
  const training = workout('Training', 1, [exercise('Bench Press'), exercise('10m Sprint')]);
  const redFlagResult = validateWorkoutAgainstActiveConstraints({
    workout: training, date: MON, todayISO: TODAY, activeConstraints: [redFlag], profile: FULL_GYM,
  });
  const readinessResult = validateWorkoutAgainstActiveConstraints({
    workout: training, date: MON, todayISO: TODAY, activeConstraints: [fatigue], profile: FULL_GYM,
  });
  ok('serious injury symptom hard-stops non-anchor training', redFlagResult.workout === null);
  ok('full-pause readiness hard-stops non-anchor training', readinessResult.workout === null);
}

section('[7] final ProgramStore boundary covers rebuild, manual, overlay, and repeat writes');
{
  resetStores();
  useCoachUpdatesStore.getState().upsertActiveConstraint(injury('hamstring', 9));

  const unsafe = workout('Unsafe Lower', 1, [exercise('Deadlift', ['Barbell']), exercise('10m Sprint')]);
  commitRebuiltProgram(program([unsafe]), { preserve: [], clear: [], conflictsRemoved: [] });
  const rebuilt = useProgramStore.getState().currentProgram?.microcycles[0].workouts[0];
  ok('rebuild commit cannot reintroduce affected work',
    !names(rebuilt).includes('Deadlift') && !names(rebuilt).includes('10m Sprint'), names(rebuilt));

  const sprintOnly = workout('Sprint Only', 1, [exercise('10m Sprint')]);
  useProgramStore.getState().setManualOverride(MON, sprintOnly, { intent: 'program_adjustment' });
  const manual = useProgramStore.getState().dateOverrides[MON];
  ok('manual write cannot reintroduce affected work',
    !names(manual).includes('Deadlift') && !names(manual).includes('10m Sprint'), names(manual));
  ok('emptied manual session is an honest Rest shell',
    manual.name === 'Rest' && !hasMeaningfulWorkoutContent(manual), manual);

  useProgramStore.getState().setWeekScopedOverlay(overlay({ [NEXT_MON]: sprintOnly }));
  ok('week overlay cannot reintroduce affected work',
    useProgramStore.getState().weekScopedOverlays[NEXT_MON].workoutsByDate[NEXT_MON] === null);

  resetStores();
  const sourceProgram = program([unsafe]);
  useProgramStore.getState().setCurrentProgram(sourceProgram);
  useCoachUpdatesStore.getState().upsertActiveConstraint(injury('hamstring', 9));
  repeatWeekIntoNextWeek({ baseProfile: FULL_GYM, sourceWeekDate: MON, todayISO: TODAY });
  const repeated = useProgramStore.getState().weekScopedOverlays[NEXT_MON];
  ok('repeat-week overlay cannot reintroduce affected source work',
    Object.values(repeated.workoutsByDate).every((value) =>
      value === null || (!names(value).includes('Deadlift') && !names(value).includes('10m Sprint'))));
}

section('[8] equipment refresh and coach revision writes pass through the same boundary');
{
  resetStores();
  useCoachUpdatesStore.getState().upsertActiveConstraint(noBarbell());
  useProgramStore.getState().setCurrentProgram(program([workout('Gym', 1, [
    exercise('Back Squat', ['Barbell', 'Rack']),
    exercise('Push-Up'),
  ])]));
  const refreshed = useProgramStore.getState().currentProgram?.microcycles[0].workouts[0];
  ok('equipment refresh cannot restore unavailable barbell work',
    !names(refreshed).includes('Back Squat') && names(refreshed).includes('Push-Up'), names(refreshed));

  resetStores();
  const sprint = workout('Sprint Session', 1, [exercise('10m Sprint')]);
  const visibleWeek = [resolvedDay(MON, sprint), resolvedDay(TUE, null)];
  const snapshot = buildCoachRevisionWeekSnapshotFromProjectedDays(visibleWeek);
  const source = JSON.parse(JSON.stringify(snapshot.days.find((day) => day.date === MON)!));
  const dest = JSON.parse(JSON.stringify(snapshot.days.find((day) => day.date === TUE)!));
  source.workout = null;
  dest.workout = JSON.parse(JSON.stringify(snapshot.days.find((day) => day.date === MON)!.workout));
  const proposal: CoachRevisionProposal = {
    schemaVersion: COACH_REVISION_PROPOSAL_SCHEMA_VERSION,
    kind: 'revision',
    source: 'semantic',
    confidence: 0.95,
    userIntent: {
      intent: 'move', targetDomain: 'session', actionScope: 'whole_session',
      targetDates: [MON, TUE], protectedRefs: [], reason: 'constraint_boundary_test',
    },
    scope: { mode: 'date_range', dates: [MON, TUE] },
    revisedDays: [source, dest],
    explanation: 'constraint_boundary_test',
  };
  useCoachUpdatesStore.getState().upsertActiveConstraint(injury('hamstring', 9));
  const revision = applyCoachRevisionDateOverrides({
    proposal,
    visibleWeek,
    todayISO: TODAY,
    setManualOverride: (date, value, context) =>
      useProgramStore.getState().setManualOverride(date, value, context),
  });
  ok('coach revision proposal is rejected when canonical safety changes its accepted shape',
    revision.applied.length === 0 && revision.rejected.some((item) =>
      item.code === 'projected_override_mismatch'), revision);
  ok('coach revision rejection writes no unsafe sprint work',
    !useProgramStore.getState().dateOverrides[TUE]);
}

section('[9] architectural guard keeps the validator at the final store boundary');
{
  const storeSource = fs.readFileSync(path.resolve(__dirname, '../store/programStore.ts'), 'utf8');
  ok('program setter validates', /setCurrentProgram[\s\S]{0,500}postValidateProgram/.test(storeSource));
  ok('manual override setter validates', /setManualOverride[\s\S]{0,700}postValidateWorkout/.test(storeSource));
  ok('week overlay setter validates', /setWeekScopedOverlay[\s\S]{0,400}postValidateWeekOverlay/.test(storeSource));
}

console.log(`\nSummary\n  Pass: ${pass}\n  Fail: ${fail}`);
if (fail > 0) {
  console.error(`\nFailures:\n${failures.map((name) => `  - ${name}`).join('\n')}`);
  process.exit(1);
}
