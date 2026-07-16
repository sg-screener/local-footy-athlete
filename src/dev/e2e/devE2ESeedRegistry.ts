import type {
  OnboardingData,
  TrainingProgram,
  Workout,
} from '../../types/domain';
import { generateProgramLocally } from '../../services/api/generateProgram';
import {
  DEV_E2E_DATE_ANCHORS,
  isDevE2ESeedId,
  type DevE2ESeedId,
} from './devE2ESeedIds';
import { DEV_E2E_STANDARD_PROFILE } from './devE2EStandardProfile';
import { semanticFingerprint } from './semanticFingerprint';

export {
  DEV_E2E_DATE_ANCHORS,
  DEV_E2E_SEED_IDS,
  isDevE2ESeedId,
  type DevE2ESeedId,
} from './devE2ESeedIds';
export { DEV_E2E_STANDARD_PROFILE } from './devE2EStandardProfile';

export type DevE2EAuxiliaryState =
  | { kind: 'active_injury'; injuryKey: 'hamstring'; bodyPart: string; severity: number }
  | { kind: 'temporary_equipment'; presetId: 'bodyweight_only'; date: string }
  | {
      kind: 'session_feedback';
      date: string;
      completion: 'full';
      feeling: 'very_easy';
      soreness: 'none';
      difficulty: number;
    };

export type DevE2EWitness =
  | { kind: 'program'; programId: string; weekStart: string }
  | { kind: 'profile_exact'; profile: OnboardingData }
  | {
      kind: 'workout';
      dayOfWeek: number;
      workoutId?: string;
      workoutType?: Workout['workoutType'];
      hasTeamTraining?: boolean;
      strengthPattern?: 'squat' | 'hinge' | 'push' | 'pull';
    }
  | { kind: 'exercise_sets'; exerciseId: string; prescribedSets: number }
  | { kind: 'calendar_mark'; date: string; mark: 'game' | 'rest' | 'noGame' }
  | { kind: 'profile_equipment'; equipment: string[]; completeness: 'complete' }
  | { kind: 'active_injury'; bodyPart: string; severity: number }
  | { kind: 'active_equipment'; presetId: 'bodyweight_only' }
  | { kind: 'session_feedback'; date: string; completion: 'full' };

export interface DevE2ESeed {
  id: DevE2ESeedId;
  anchorDate: string;
  profile: OnboardingData;
  program: TrainingProgram;
  auxiliaryState: DevE2EAuxiliaryState[];
  witnesses: DevE2EWitness[];
}

export interface DevE2EWitnessState {
  program: TrainingProgram | null;
  profile: OnboardingData;
  calendarMarks: Record<string, 'game' | 'rest' | 'noGame'>;
  activeInjury: { bodyPart: string; severity: number } | null;
  activeConstraints: Array<{ id: string; type: string; reasonLabel?: string }>;
  sessionFeedback: Record<string, { completion: string }>;
}

const FIXED_TIMESTAMP = '2026-07-13T12:00:00.000Z';
const FIXTURE_DATE = '2026-07-18';
const ONE_SET_EXERCISE_ID = 'dev-e2e-one-set-main';
const STACKED_WORKOUT_ID = 'dev-e2e-stacked-team-upper-pull';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function anchoredNoonISO(anchorDate: string, dayOffset: number): string {
  const value = new Date(`${anchorDate}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + dayOffset);
  return value.toISOString();
}

function fixedProfile(overrides: Partial<OnboardingData> = {}): OnboardingData {
  return {
    ...clone(DEV_E2E_STANDARD_PROFILE),
    ...clone(overrides),
  };
}

function stabilizeProgram(program: TrainingProgram, seedId: DevE2ESeedId): TrainingProgram {
  const result = clone(program);
  const anchorDate = DEV_E2E_DATE_ANCHORS[seedId];
  const weekStart = anchoredNoonISO(anchorDate, 0);
  const weekEnd = anchoredNoonISO(anchorDate, 6);
  result.id = `dev-e2e-${seedId}`;
  result.userId = 'dev-e2e-athlete';
  result.name = `Dev E2E: ${seedId}`;
  result.startDate = weekStart;
  result.endDate = weekEnd;
  result.createdAt = FIXED_TIMESTAMP;
  result.updatedAt = FIXED_TIMESTAMP;
  result.microcycles = result.microcycles.map((microcycle, weekIndex) => {
    const microcycleId = `dev-e2e-${seedId}-week-${weekIndex + 1}`;
    return {
      ...microcycle,
      id: microcycleId,
      programId: result.id,
      startDate: weekStart,
      endDate: weekEnd,
      createdAt: FIXED_TIMESTAMP,
      updatedAt: FIXED_TIMESTAMP,
      workouts: microcycle.workouts.map((workout) => {
        const workoutId = `dev-e2e-${seedId}-dow-${workout.dayOfWeek}`;
        return {
          ...workout,
          id: workoutId,
          microcycleId,
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP,
          exercises: workout.exercises.map((exercise, exerciseIndex) => ({
            ...exercise,
            id: `${workoutId}-exercise-${exercise.exerciseId || exerciseIndex + 1}`,
            workoutId,
            createdAt: FIXED_TIMESTAMP,
            updatedAt: FIXED_TIMESTAMP,
            exercise: exercise.exercise
              ? {
                  ...exercise.exercise,
                  createdAt: FIXED_TIMESTAMP,
                  updatedAt: FIXED_TIMESTAMP,
                }
              : exercise.exercise,
          })),
        };
      }),
    };
  });
  return result;
}

function deterministicProgram(
  seedId: DevE2ESeedId,
  profile: OnboardingData,
): TrainingProgram {
  const anchorDate = DEV_E2E_DATE_ANCHORS[seedId];
  return stabilizeProgram(generateProgramLocally(profile, {
    todayISO: anchorDate,
    blockNumber: 1,
    previousProgram: null,
    activeConstraints: [],
    readinessSignal: null,
    microcycleLimit: 1,
  }), seedId);
}

function isTeamTrainingWorkout(workout: Workout): boolean {
  return workout.workoutType === 'Team Training' ||
    /team training/i.test(workout.name) ||
    workout.exercises.some((row) => /team training|field session/i.test(row.exercise?.name ?? ''));
}

function strengthPatterns(workout: Workout): string[] {
  return [...(
    workout.strengthIntent?.effectivePatterns ?? workout.strengthPatternContributions ?? []
  )];
}

function withStackedTeamUpperPull(program: TrainingProgram): TrainingProgram {
  const result = clone(program);
  const week = result.microcycles[0];
  const stacked = week.workouts.find((workout) =>
    workout.dayOfWeek === 2 &&
    isTeamTrainingWorkout(workout) &&
    strengthPatterns(workout).includes('pull'));
  if (!stacked) {
    throw new Error('stacked-team-training-upper-pull requires the deterministic combined session.');
  }
  stacked.id = STACKED_WORKOUT_ID;
  stacked.name = 'Team Training + Upper Pull';
  stacked.description = 'Upper-pull strength stacked with the scheduled club field session.';
  stacked.exercises = stacked.exercises.map((row) => ({
    ...row,
    workoutId: STACKED_WORKOUT_ID,
  }));
  return result;
}

function withOneSetStrength(program: TrainingProgram): TrainingProgram {
  const result = clone(program);
  const targetWorkout = result.microcycles[0].workouts.find((workout) =>
    strengthPatterns(workout).length > 0 && workout.exercises.length > 0);
  const target = targetWorkout?.exercises.find((row) => row.prescribedSets > 0);
  if (!targetWorkout || !target) {
    throw new Error('one-set-strength requires a deterministic strength exercise.');
  }
  target.id = ONE_SET_EXERCISE_ID;
  target.prescribedSets = 1;
  return result;
}

function baseWitness(seedId: DevE2ESeedId): DevE2EWitness {
  return {
    kind: 'program',
    programId: `dev-e2e-${seedId}`,
    weekStart: DEV_E2E_DATE_ANCHORS[seedId],
  };
}

export function profileForDevE2ESeed(seedId: DevE2ESeedId): OnboardingData {
  if (seedId === 'injury-case') {
    return fixedProfile({
      injuries: [{
        bodyArea: 'Hamstring',
        description: 'Mild right hamstring irritation during sprinting',
        severity: 'Moderate',
        whenItHurts: 'Running',
        movementTriggers: ['Sprinting', 'Running'],
      }],
    });
  }
  if (seedId === 'equipment-restriction-case') {
    return fixedProfile({
      trainingLocation: 'Outdoor',
      equipmentSelectionCompleteness: 'complete',
      equipment: ['bodyweight'],
    });
  }
  return fixedProfile();
}

export function witnessesForDevE2ESeed(seedId: DevE2ESeedId): DevE2EWitness[] {
  const anchorDate = DEV_E2E_DATE_ANCHORS[seedId];
  const witnesses: DevE2EWitness[] = [
    baseWitness(seedId),
    { kind: 'profile_exact', profile: profileForDevE2ESeed(seedId) },
  ];
  switch (seedId) {
    case 'standard-in-season-week':
      witnesses.push({ kind: 'calendar_mark', date: FIXTURE_DATE, mark: 'game' });
      break;
    case 'stacked-team-training-upper-pull':
      witnesses.push({
        kind: 'workout',
        dayOfWeek: 2,
        workoutId: STACKED_WORKOUT_ID,
        workoutType: 'Team Training',
        hasTeamTraining: true,
        strengthPattern: 'pull',
      });
      break;
    case 'lower-body-deletion':
      witnesses.push({ kind: 'workout', dayOfWeek: 1, strengthPattern: 'squat' });
      break;
    case 'one-set-strength':
      witnesses.push({
        kind: 'exercise_sets',
        exerciseId: ONE_SET_EXERCISE_ID,
        prescribedSets: 1,
      });
      break;
    case 'fixture-move':
      witnesses.push({ kind: 'calendar_mark', date: FIXTURE_DATE, mark: 'game' });
      break;
    case 'injury-case':
      witnesses.push({ kind: 'active_injury', bodyPart: 'Right hamstring', severity: 5 });
      break;
    case 'equipment-restriction-case':
      witnesses.push({
        kind: 'profile_equipment',
        equipment: ['bodyweight'],
        completeness: 'complete',
      });
      witnesses.push({ kind: 'active_equipment', presetId: 'bodyweight_only' });
      break;
    case 'feedback-progression-case':
      witnesses.push({ kind: 'session_feedback', date: anchorDate, completion: 'full' });
      break;
  }
  return witnesses;
}

export function buildDevE2ESeed(seedId: DevE2ESeedId): DevE2ESeed {
  const anchorDate = DEV_E2E_DATE_ANCHORS[seedId];
  const profile = profileForDevE2ESeed(seedId);

  let program = deterministicProgram(seedId, profile);
  if (seedId === 'stacked-team-training-upper-pull') {
    program = withStackedTeamUpperPull(program);
  }
  if (seedId === 'one-set-strength') {
    program = withOneSetStrength(program);
  }

  const witnesses = witnessesForDevE2ESeed(seedId);
  const auxiliaryState: DevE2EAuxiliaryState[] = [];

  switch (seedId) {
    case 'standard-in-season-week':
      break;
    case 'stacked-team-training-upper-pull':
      break;
    case 'lower-body-deletion':
      break;
    case 'one-set-strength':
      break;
    case 'fixture-move':
      break;
    case 'injury-case':
      auxiliaryState.push({
        kind: 'active_injury',
        injuryKey: 'hamstring',
        bodyPart: 'Right hamstring',
        severity: 5,
      });
      break;
    case 'equipment-restriction-case':
      auxiliaryState.push({
        kind: 'temporary_equipment',
        presetId: 'bodyweight_only',
        date: anchorDate,
      });
      break;
    case 'feedback-progression-case':
      auxiliaryState.push({
        kind: 'session_feedback',
        date: anchorDate,
        completion: 'full',
        feeling: 'very_easy',
        soreness: 'none',
        difficulty: 3,
      });
      break;
  }

  return { id: seedId, anchorDate, profile, program, auxiliaryState, witnesses };
}

function allWorkouts(program: TrainingProgram | null): Workout[] {
  return program?.microcycles.flatMap((microcycle) => microcycle.workouts) ?? [];
}

export function validateDevE2EWitnesses(
  seedId: DevE2ESeedId,
  witnesses: readonly DevE2EWitness[],
  state: DevE2EWitnessState,
): string[] {
  const failures: string[] = [];
  const workouts = allWorkouts(state.program);
  for (const witness of witnesses) {
    switch (witness.kind) {
      case 'program': {
        const hasWeek = state.program?.microcycles.some((week) =>
          week.startDate.slice(0, 10) === witness.weekStart) ?? false;
        if (state.program?.id !== witness.programId || !hasWeek) {
          failures.push(`program:${witness.programId}:${witness.weekStart}`);
        }
        break;
      }
      case 'profile_exact':
        if (semanticFingerprint(state.profile) !== semanticFingerprint(witness.profile)) {
          failures.push('profile:exact');
        }
        break;
      case 'workout': {
        const workout = workouts.find((candidate) =>
          candidate.dayOfWeek === witness.dayOfWeek &&
          (!witness.workoutId || candidate.id === witness.workoutId));
        const patternOk = !witness.strengthPattern ||
          (!!workout && strengthPatterns(workout).includes(witness.strengthPattern));
        const teamOk = witness.hasTeamTraining === undefined ||
          (!!workout && isTeamTrainingWorkout(workout) === witness.hasTeamTraining);
        if (!workout ||
          (witness.workoutType && workout.workoutType !== witness.workoutType) ||
          !patternOk ||
          !teamOk) {
          failures.push(`workout:dow-${witness.dayOfWeek}`);
        }
        break;
      }
      case 'exercise_sets': {
        const exercise = workouts
          .flatMap((workout) => workout.exercises)
          .find((candidate) => candidate.id === witness.exerciseId);
        if (!exercise || exercise.prescribedSets !== witness.prescribedSets) {
          failures.push(`exercise_sets:${witness.exerciseId}`);
        }
        break;
      }
      case 'calendar_mark':
        if (state.calendarMarks[witness.date] !== witness.mark) {
          failures.push(`calendar:${witness.date}:${witness.mark}`);
        }
        break;
      case 'profile_equipment':
        if (state.profile.equipmentSelectionCompleteness !== witness.completeness ||
          JSON.stringify(state.profile.equipment ?? []) !== JSON.stringify(witness.equipment)) {
          failures.push('profile:equipment');
        }
        break;
      case 'active_injury':
        if (state.activeInjury?.bodyPart !== witness.bodyPart ||
          state.activeInjury?.severity !== witness.severity) {
          failures.push(`injury:${witness.bodyPart}`);
        }
        break;
      case 'active_equipment':
        if (!state.activeConstraints.some((constraint) =>
          constraint.type === 'equipment' && constraint.reasonLabel === 'Bodyweight only')) {
          failures.push(`equipment:${witness.presetId}`);
        }
        break;
      case 'session_feedback':
        if (state.sessionFeedback[witness.date]?.completion !== witness.completion) {
          failures.push(`feedback:${witness.date}`);
        }
        break;
    }
  }
  return failures.map((failure) => `${seedId}:${failure}`);
}
