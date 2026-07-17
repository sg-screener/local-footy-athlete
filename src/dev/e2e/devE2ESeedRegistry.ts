import type {
  OnboardingData,
  Microcycle,
  OverrideContext,
  TrainingProgram,
  UserRemovalConstraint,
  WeekScopedWorkoutOverlay,
  Workout,
  WorkoutExercise,
} from '../../types/domain';
import type { InjuryEpisodeV1 } from '../../rules/injuryEpisode';
import type { TemporarySourceFact } from '../../rules/temporarySourceFact';
import type { ReversibleAdjustmentLedger } from '../../rules/reversibleAdjustmentLedger';
import type { ReadinessSignal } from '../../utils/readiness';
import { generateProgramLocally } from '../../services/api/generateProgram';
import {
  section18PhaseTableSignature,
} from '../../rules/weeklyExposureContractV2';
import {
  getSessionComponents,
  type SessionComponentKind,
} from '../../utils/sessionComponents';
import { dayOfWeekForISODate } from '../../utils/appDate';
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
  | {
      kind: 'canonical_injury_episode';
      constraintId: string;
      expectedEpisodeId: string;
      injuryKey: 'hamstring';
      bodyPart: string;
      severity: number;
      date: string;
    }
  | { kind: 'temporary_equipment'; presetId: 'bodyweight_only'; date: string }
  | { kind: 'calendar_game'; date: string }
  | { kind: 'removable_component_override'; date: string }
  | {
      kind: 'session_feedback';
      date: string;
      workoutId: string;
      planEntryId?: string;
      completion: 'full';
      feeling: 'very_easy';
      soreness: 'none';
      difficulty: number;
    };

export interface DevE2EPrescriptionWitness {
  prescribedSets: number;
  prescribedRepsMin: number | null;
  prescribedRepsMax: number | null;
  prescribedWeightKg: number | null;
}

export type DevE2EWitness =
  | { kind: 'program'; programId: string; weekStart: string }
  | { kind: 'profile_exact'; profile: OnboardingData }
  | {
      kind: 'workout';
      dayOfWeek: number;
      date?: string;
      surface?: 'underlying' | 'accepted_visible';
      workoutId?: string;
      workoutType?: Workout['workoutType'];
      hasTeamTraining?: boolean;
      strengthPattern?: 'squat' | 'hinge' | 'push' | 'pull';
    }
  | { kind: 'exercise_sets'; exerciseId: string; prescribedSets: number }
  | { kind: 'exercise_present'; exerciseId: string; name: string; date?: string }
  | { kind: 'calendar_mark'; date: string; mark: 'game' | 'rest' | 'noGame' }
  | { kind: 'profile_equipment'; equipment: string[]; completeness: 'complete' }
  | {
      kind: 'active_injury';
      bodyPart: string;
      severity: number;
      episodeId: string;
      constraintId: string;
    }
  | {
      kind: 'active_equipment';
      presetId: 'bodyweight_only';
      factId: string;
    }
  | {
      kind: 'session_feedback';
      date: string;
      completion: 'full';
      workoutId: string;
      planEntryId?: string;
    }
  | { kind: 'accepted_week_count'; minimum: number; consecutive: boolean }
  | { kind: 'week_contract_signature'; weekStart: string; signature: string }
  | {
      kind: 'eligible_target_date';
      date: string;
      eligibility: 'rest_or_empty';
      underlyingWorkoutId?: string;
    }
  | {
      kind: 'fixture_identity';
      date: string;
      workoutId: string;
      planEntryId?: string;
      anchorKind: 'game' | 'practice_match';
    }
  | {
      kind: 'component_identity';
      date: string;
      workoutId: string;
      componentId: SessionComponentKind | 'strength:pull';
      identity: string;
      surface?: 'underlying' | 'accepted_visible';
    }
  | {
      kind: 'absent_overlay';
      weekStart?: string;
      date?: string;
      reason?: WeekScopedWorkoutOverlay['reason'];
      requireNoDateOverride?: boolean;
      requireNoOverrideContext?: boolean;
      requireNoUserRemovalOwnership?: boolean;
    }
  | {
      kind: 'absent_source_fact';
      factKind: 'injury' | 'readiness' | 'equipment' | 'schedule';
    }
  | { kind: 'empty_coach_state' }
  | { kind: 'accepted_revision'; revision: number }
  | { kind: 'reversible_ledger_state'; activeCount: number; totalCount: number }
  | {
      kind: 'future_progression_target';
      sourceDate: string;
      sourceWorkoutId: string;
      sourceExerciseRowId: string;
      sourceExerciseId: string;
      targetDate: string;
      targetWorkoutId: string;
      targetExerciseRowId: string;
      targetExerciseId: string;
      baselinePrescription: DevE2EPrescriptionWitness;
    }
  | {
      kind: 'visible_card_detail_equality';
      date: string;
      workoutId: string | null;
    };

export interface DevE2ESeed {
  id: DevE2ESeedId;
  anchorDate: string;
  profile: OnboardingData;
  program: TrainingProgram;
  auxiliaryState: DevE2EAuxiliaryState[];
  witnesses: DevE2EWitness[];
}

export interface DevE2ECoachWitnessState {
  transcriptCount: number;
  memoryCount: number;
  mutationHistoryCount: number;
  pendingClarifier: unknown | null;
  pendingProposal: unknown | null;
}

export interface DevE2EWitnessState {
  program: TrainingProgram | null;
  dateOverrides?: Record<string, Workout | null>;
  overrideContexts?: Record<string, OverrideContext | undefined>;
  weekScopedOverlays?: Record<string, WeekScopedWorkoutOverlay>;
  userRemovalConstraints?: UserRemovalConstraint[];
  reversibleAdjustmentLedger?: ReversibleAdjustmentLedger;
  profile: OnboardingData;
  calendarMarks: Record<string, 'game' | 'rest' | 'noGame'>;
  activeInjury: { bodyPart: string; severity: number } | null;
  activeConstraints: Array<{
    id: string;
    type: string;
    reasonLabel?: string;
    injuryEpisodeId?: string;
    targetDate?: string;
    moveTargetDate?: string;
  }>;
  injuryEpisodes?: InjuryEpisodeV1[];
  temporarySourceFacts?: TemporarySourceFact[];
  readinessSignalsByDate?: Record<string, ReadinessSignal>;
  sessionFeedback: Record<string, {
    completion: string;
    outcomeReceipt?: {
      sessionIdentity: { workoutId: string; planEntryId?: string };
    };
  }>;
  acceptedRevision?: number;
  coachState?: DevE2ECoachWitnessState;
  visibleCardDays?: Record<string, unknown>;
  visibleDetailDays?: Record<string, unknown>;
}

const FIXED_TIMESTAMP = '2026-07-13T12:00:00.000Z';
const ONE_SET_EXERCISE_ID = 'dev-e2e-one-set-main';
const STACKED_WORKOUT_ID = 'dev-e2e-stacked-team-upper-pull';
const INJURY_CONSTRAINT_ID = 'dev-e2e-injury-right-hamstring';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isoDateParts(value: string): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) throw new Error(`Invalid deterministic seed date: ${value}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function addDaysISO(dateISO: string, dayOffset: number): string {
  const [year, month, day] = isoDateParts(dateISO);
  const value = new Date(Date.UTC(year, month - 1, day + dayOffset, 12, 0, 0, 0));
  return value.toISOString().slice(0, 10);
}

function anchoredNoonISO(dateISO: string): string {
  return `${dateISO.slice(0, 10)}T12:00:00.000Z`;
}

function mondayForDate(dateISO: string): string {
  const day = dayOfWeekForISODate(dateISO);
  return addDaysISO(dateISO, -((day + 6) % 7));
}

function dateForWorkout(weekStart: string, workout: Workout): string {
  return addDaysISO(weekStart, (workout.dayOfWeek + 6) % 7);
}

function stableIdPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
}

function stabilizeAuditTimestamps<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => stabilizeAuditTimestamps(entry)) as T;
  }
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
    key,
    (key === 'createdAt' || key === 'updatedAt') && typeof entry === 'string'
      ? FIXED_TIMESTAMP
      : stabilizeAuditTimestamps(entry),
  ])) as unknown as T;
}

function fixedProfile(overrides: Partial<OnboardingData> = {}): OnboardingData {
  return {
    ...clone(DEV_E2E_STANDARD_PROFILE),
    ...clone(overrides),
  };
}

function seedMicrocycleLimit(seedId: DevE2ESeedId): 1 | 4 {
  return seedId === 'feedback-progression-case' ||
    seedId === 'multi-reload-fixture-chain' ||
    seedId === 'repeat-week-phase-transition' ||
    seedId === 'coach-production-replay'
    ? 4
    : 1;
}

function stabilizeProgram(program: TrainingProgram, seedId: DevE2ESeedId): TrainingProgram {
  const result = stabilizeAuditTimestamps(clone(program));
  const anchorDate = DEV_E2E_DATE_ANCHORS[seedId];
  const lastWeekIndex = Math.max(0, result.microcycles.length - 1);
  result.id = `dev-e2e-${seedId}`;
  result.userId = 'dev-e2e-athlete';
  result.name = `Dev E2E: ${seedId}`;
  result.startDate = anchoredNoonISO(anchorDate);
  result.endDate = anchoredNoonISO(addDaysISO(anchorDate, lastWeekIndex * 7 + 6));
  result.createdAt = FIXED_TIMESTAMP;
  result.updatedAt = FIXED_TIMESTAMP;
  result.microcycles = result.microcycles.map((microcycle, weekIndex) =>
    stabilizeMicrocycle(
      microcycle,
      seedId,
      result.id,
      addDaysISO(anchorDate, weekIndex * 7),
    ));
  return result;
}

function stabilizeMicrocycle(
  microcycle: Microcycle,
  seedId: DevE2ESeedId,
  programId: string,
  weekStartDate: string,
): Microcycle {
  const stable = stabilizeAuditTimestamps(clone(microcycle));
  const microcycleId = `dev-e2e-${seedId}-week-${weekStartDate}`;
  return {
    ...stable,
    id: microcycleId,
    programId,
    startDate: anchoredNoonISO(weekStartDate),
    endDate: anchoredNoonISO(addDaysISO(weekStartDate, 6)),
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
    workouts: stable.workouts.map((workout) => {
      const workoutId = `dev-e2e-${seedId}-${weekStartDate}-dow-${workout.dayOfWeek}`;
      return {
        ...workout,
        id: workoutId,
        microcycleId,
        createdAt: FIXED_TIMESTAMP,
        updatedAt: FIXED_TIMESTAMP,
        exercises: workout.exercises.map((exercise, exerciseIndex) => {
          const exerciseIdentity = stableIdPart(
            exercise.exerciseId || exercise.exercise?.id || String(exerciseIndex + 1),
          );
          return {
            ...exercise,
            id: `${workoutId}-exercise-${exerciseIdentity}-${exerciseIndex + 1}`,
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
          };
        }),
      };
    }),
  };
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
    microcycleLimit: seedMicrocycleLimit(seedId),
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

function programForSeed(seedId: DevE2ESeedId, profile: OnboardingData): TrainingProgram {
  let program = deterministicProgram(seedId, profile);
  if (seedId === 'stacked-team-training-upper-pull') {
    program = withStackedTeamUpperPull(program);
  }
  if (seedId === 'one-set-strength') {
    program = withOneSetStrength(program);
  }
  if (seedId === 'repeat-week-phase-transition') {
    program = withRepeatPhaseTransition(program, seedId, profile);
  }
  return program;
}

function withRepeatPhaseTransition(
  program: TrainingProgram,
  seedId: DevE2ESeedId,
  profile: OnboardingData,
): TrainingProgram {
  const targetWeekStart = addDaysISO(DEV_E2E_DATE_ANCHORS[seedId], 7);
  const targetCandidate = generateProgramLocally(profile, {
    todayISO: targetWeekStart,
    blockNumber: 1,
    previousProgram: program,
    seasonPhaseClock: program.seasonPhaseClock,
    targetFixtureDay: 'Saturday',
    activeConstraints: [],
    readinessSignal: null,
    microcycleLimit: 1,
  });
  const target = targetCandidate.microcycles[0];
  if (!target || program.microcycles.length < 2) {
    throw new Error('repeat-week-phase-transition requires an adjacent target week.');
  }
  const result = clone(program);
  result.microcycles[1] = stabilizeMicrocycle(
    target,
    seedId,
    result.id,
    targetWeekStart,
  );
  return result;
}

function underlyingWorkoutForDate(
  program: TrainingProgram | null,
  date: string,
): Workout | null {
  if (!program) return null;
  const weekStart = mondayForDate(date);
  const microcycle = program.microcycles.find((candidate) =>
    candidate.startDate.slice(0, 10) === weekStart);
  return microcycle?.workouts.find((workout) =>
    workout.dayOfWeek === dayOfWeekForISODate(date)) ?? null;
}

function effectiveWorkoutForDate(
  state: Pick<
    DevE2EWitnessState,
    'program' | 'dateOverrides' | 'weekScopedOverlays'
  >,
  date: string,
): Workout | null {
  if (Object.prototype.hasOwnProperty.call(state.dateOverrides ?? {}, date)) {
    return state.dateOverrides?.[date] ?? null;
  }
  const overlay = state.weekScopedOverlays?.[mondayForDate(date)];
  if (overlay && Object.prototype.hasOwnProperty.call(overlay.workoutsByDate, date)) {
    return overlay.workoutsByDate[date] ?? null;
  }
  return underlyingWorkoutForDate(state.program, date);
}

function contractSignatureForWeek(
  state: Pick<DevE2EWitnessState, 'program' | 'weekScopedOverlays'>,
  weekStart: string,
): string {
  const overlayContract = state.weekScopedOverlays?.[weekStart]?.exposureContractV2;
  const microcycleContract = state.program?.microcycles.find((microcycle) =>
    microcycle.startDate.slice(0, 10) === weekStart)?.exposureContractV2;
  return section18PhaseTableSignature(overlayContract ?? microcycleContract);
}

function visibleFixtureWorkoutId(date: string): string {
  return `calendar-game-${date}`;
}

function visibleRecoveryWorkoutId(date: string): string {
  return `derived-recovery-${date}`;
}

function visibleArmsPumpWorkoutId(date: string): string {
  return `derived-arms_pump-${date}`;
}

function teamTrainingWorkout(program: TrainingProgram, date: string): Workout {
  const workout = underlyingWorkoutForDate(program, date);
  if (!workout || !isTeamTrainingWorkout(workout)) {
    throw new Error(`Dev E2E Team Training identity missing on ${date}.`);
  }
  return workout;
}

function prescriptionWitness(row: WorkoutExercise): DevE2EPrescriptionWitness {
  return {
    prescribedSets: row.prescribedSets,
    prescribedRepsMin: row.prescribedRepsMin ?? null,
    prescribedRepsMax: row.prescribedRepsMax ?? null,
    prescribedWeightKg: row.prescribedWeightKg ?? null,
  };
}

interface ProgressionIdentity {
  sourceDate: string;
  sourceWorkout: Workout;
  sourceExercise: WorkoutExercise;
  targetDate: string;
  targetWorkout: Workout;
  targetExercise: WorkoutExercise;
}

function futureProgressionIdentity(
  program: TrainingProgram,
  sourceDate: string,
): ProgressionIdentity {
  const sourceWorkout = underlyingWorkoutForDate(program, sourceDate);
  if (!sourceWorkout) {
    throw new Error(`Dev E2E feedback source session missing on ${sourceDate}.`);
  }
  const future = program.microcycles
    .flatMap((microcycle) => microcycle.workouts.map((workout) => ({
      date: dateForWorkout(microcycle.startDate.slice(0, 10), workout),
      workout,
    })))
    .filter((entry) => entry.date > sourceDate)
    .sort((left, right) => left.date.localeCompare(right.date));
  for (const sourceExercise of sourceWorkout.exercises.filter((row) =>
    row.prescribedSets > 0 && !!row.exerciseId)) {
    const target = future.flatMap((entry) => entry.workout.exercises.map((exercise) => ({
      ...entry,
      exercise,
    }))).find((entry) =>
      entry.exercise.exerciseId === sourceExercise.exerciseId ||
      (
        !!entry.exercise.exercise?.name &&
        entry.exercise.exercise.name === sourceExercise.exercise?.name
      ));
    if (target) {
      return {
        sourceDate,
        sourceWorkout,
        sourceExercise,
        targetDate: target.date,
        targetWorkout: target.workout,
        targetExercise: target.exercise,
      };
    }
  }
  const sourceExercise = sourceWorkout.exercises.find((row) => row.prescribedSets > 0);
  const target = future
    .filter((entry) =>
      entry.workout.dayOfWeek === sourceWorkout.dayOfWeek ||
      strengthPatterns(entry.workout).some((pattern) =>
        strengthPatterns(sourceWorkout).includes(pattern)))
    .flatMap((entry) => entry.workout.exercises
      .filter((exercise) => exercise.prescribedSets > 0)
      .map((exercise) => ({ ...entry, exercise })))[0] ??
    future.flatMap((entry) => entry.workout.exercises
      .filter((exercise) => exercise.prescribedSets > 0)
      .map((exercise) => ({ ...entry, exercise })))[0];
  if (sourceExercise && target) {
    return {
      sourceDate,
      sourceWorkout,
      sourceExercise,
      targetDate: target.date,
      targetWorkout: target.workout,
      targetExercise: target.exercise,
    };
  }
  throw new Error('Dev E2E feedback seed requires a future progression target.');
}

function futureHamstringExposure(
  program: TrainingProgram,
  afterDate: string,
): { date: string; workout: Workout; exercise: WorkoutExercise } {
  const candidates = program.microcycles
    .flatMap((microcycle) => microcycle.workouts.map((workout) => ({
      date: dateForWorkout(microcycle.startDate.slice(0, 10), workout),
      workout,
    })))
    .filter((entry) => entry.date > afterDate)
    .sort((left, right) => left.date.localeCompare(right.date));
  for (const entry of candidates) {
    const exercise = entry.workout.exercises.find((row) => {
      const evidence = row.section18Evidence as {
        mainStrengthPattern?: string;
        strengthPattern?: string;
      } | undefined;
      return /hamstring|nordic|romanian|deadlift|hinge|hip thrust/i.test(
        row.exercise?.name ?? '',
      ) || evidence?.mainStrengthPattern === 'hinge' || evidence?.strengthPattern === 'hinge';
    }) ?? (
      strengthPatterns(entry.workout).includes('hinge')
        ? entry.workout.exercises.find((row) => row.prescribedSets > 0)
        : undefined
    );
    if (exercise) return { ...entry, exercise };
  }
  throw new Error('coach-production-replay requires a future hamstring-relevant exposure.');
}

function componentIdentity(
  workout: Workout,
  componentId: SessionComponentKind | 'strength:pull',
): string {
  if (componentId === 'strength:pull') {
    const hasStrength = getSessionComponents(workout).some((component) =>
      component.id === 'strength');
    if (!hasStrength || !strengthPatterns(workout).includes('pull')) {
      throw new Error(`Workout ${workout.id} does not own an upper-pull component.`);
    }
    return `${workout.id}:component:strength:pull`;
  }
  if (!getSessionComponents(workout).some((component) => component.id === componentId)) {
    throw new Error(`Workout ${workout.id} does not own component ${componentId}.`);
  }
  return `${workout.id}:component:${componentId}`;
}

function expectedOnboardingAcceptedRevision(
  program: TrainingProgram,
  profile: OnboardingData,
  anchorDate: string,
): number {
  let revision = 2; // clearManualOverrides + setCurrentProgram
  if (program.microcycles[0]) revision += 1;
  if (underlyingWorkoutForDate(program, anchorDate)) revision += 1;
  if (profile.gameDay && profile.gameDay !== 'Varies') {
    revision += program.microcycles.length;
  }
  return revision;
}

function canonicalInjuryEpisodeId(): string {
  const suffix = FIXED_TIMESTAMP.replace(/[^0-9]/g, '').slice(0, 17);
  return `injury-episode:v1:${INJURY_CONSTRAINT_ID}:${suffix}`;
}

function baseWitness(seedId: DevE2ESeedId): DevE2EWitness {
  return {
    kind: 'program',
    programId: `dev-e2e-${seedId}`,
    weekStart: DEV_E2E_DATE_ANCHORS[seedId],
  };
}

function cleanSourceFactWitnesses(): DevE2EWitness[] {
  return [
    { kind: 'absent_source_fact', factKind: 'injury' },
    { kind: 'absent_source_fact', factKind: 'readiness' },
    { kind: 'absent_source_fact', factKind: 'equipment' },
    { kind: 'absent_source_fact', factKind: 'schedule' },
  ];
}

function progressionWitness(identity: ProgressionIdentity): DevE2EWitness {
  return {
    kind: 'future_progression_target',
    sourceDate: identity.sourceDate,
    sourceWorkoutId: identity.sourceWorkout.id,
    sourceExerciseRowId: identity.sourceExercise.id,
    sourceExerciseId: identity.sourceExercise.exerciseId,
    targetDate: identity.targetDate,
    targetWorkoutId: identity.targetWorkout.id,
    targetExerciseRowId: identity.targetExercise.id,
    targetExerciseId: identity.targetExercise.exerciseId,
    baselinePrescription: prescriptionWitness(identity.sourceExercise),
  };
}

export function profileForDevE2ESeed(seedId: DevE2ESeedId): OnboardingData {
  if (seedId === 'equipment-restriction-case') {
    return fixedProfile({
      trainingLocation: 'Outdoor',
      equipmentSelectionCompleteness: 'complete',
      equipment: ['bodyweight'],
    });
  }
  if (seedId === 'repeat-week-phase-transition') {
    const profile = fixedProfile({
      seasonPhase: 'Pre-season',
    });
    delete profile.gameDay;
    delete profile.usualGameDay;
    return profile;
  }
  return fixedProfile();
}

export function witnessesForDevE2ESeed(
  seedId: DevE2ESeedId,
  suppliedProgram?: TrainingProgram,
  suppliedProfile?: OnboardingData,
): DevE2EWitness[] {
  const anchorDate = DEV_E2E_DATE_ANCHORS[seedId];
  const profile = suppliedProfile ?? profileForDevE2ESeed(seedId);
  const program = suppliedProgram ?? programForSeed(seedId, profile);
  const fixtureDate = addDaysISO(anchorDate, 5);
  const sundayDate = addDaysISO(anchorDate, 6);
  const followingMonday = addDaysISO(anchorDate, 7);
  const witnesses: DevE2EWitness[] = [
    baseWitness(seedId),
    { kind: 'profile_exact', profile },
  ];

  switch (seedId) {
    case 'standard-in-season-week':
      witnesses.push({ kind: 'calendar_mark', date: fixtureDate, mark: 'game' });
      break;
    case 'stacked-team-training-upper-pull': {
      const stackedDate = addDaysISO(anchorDate, 1);
      const stacked = underlyingWorkoutForDate(program, stackedDate);
      if (!stacked) throw new Error('Stacked witness source workout missing.');
      witnesses.push({
        kind: 'workout',
        dayOfWeek: 2,
        date: stackedDate,
        workoutId: STACKED_WORKOUT_ID,
        workoutType: 'Team Training',
        hasTeamTraining: true,
        strengthPattern: 'pull',
      });
      witnesses.push({
        kind: 'component_identity',
        date: stackedDate,
        workoutId: stacked.id,
        componentId: 'team_training',
        identity: componentIdentity(stacked, 'team_training'),
      });
      witnesses.push({
        kind: 'component_identity',
        date: stackedDate,
        workoutId: stacked.id,
        componentId: 'strength:pull',
        identity: componentIdentity(stacked, 'strength:pull'),
      });
      witnesses.push({
        kind: 'visible_card_detail_equality',
        date: stackedDate,
        workoutId: stacked.id,
      });
      break;
    }
    case 'lower-body-deletion':
      witnesses.push({
        kind: 'workout',
        dayOfWeek: 1,
        date: anchorDate,
        strengthPattern: 'squat',
      });
      break;
    case 'one-set-strength':
      witnesses.push({
        kind: 'exercise_sets',
        exerciseId: ONE_SET_EXERCISE_ID,
        prescribedSets: 1,
      });
      break;
    case 'fixture-move': {
      const sunday = underlyingWorkoutForDate(program, sundayDate);
      witnesses.push({ kind: 'calendar_mark', date: fixtureDate, mark: 'game' });
      witnesses.push({
        kind: 'fixture_identity',
        date: fixtureDate,
        workoutId: visibleFixtureWorkoutId(fixtureDate),
        anchorKind: 'game',
      });
      witnesses.push({
        kind: 'eligible_target_date',
        date: sundayDate,
        eligibility: 'rest_or_empty',
        underlyingWorkoutId: sunday?.id,
      });
      witnesses.push({
        kind: 'absent_overlay',
        date: sundayDate,
        requireNoDateOverride: true,
        requireNoOverrideContext: true,
        requireNoUserRemovalOwnership: true,
      });
      witnesses.push({
        kind: 'visible_card_detail_equality',
        date: fixtureDate,
        workoutId: visibleFixtureWorkoutId(fixtureDate),
      });
      break;
    }
    case 'injury-case':
      witnesses.push({
        kind: 'active_injury',
        bodyPart: 'Right hamstring',
        severity: 5,
        episodeId: canonicalInjuryEpisodeId(),
        constraintId: INJURY_CONSTRAINT_ID,
      });
      break;
    case 'equipment-restriction-case':
      witnesses.push({
        kind: 'profile_equipment',
        equipment: ['bodyweight'],
        completeness: 'complete',
      });
      witnesses.push({
        kind: 'active_equipment',
        presetId: 'bodyweight_only',
        factId: `temporary-equipment-bodyweight-only-${anchorDate}`,
      });
      break;
    case 'feedback-progression-case': {
      const progression = futureProgressionIdentity(program, anchorDate);
      witnesses.push({
        kind: 'session_feedback',
        date: anchorDate,
        completion: 'full',
        workoutId: progression.sourceWorkout.id,
        planEntryId: progression.sourceWorkout.planEntryId,
      });
      witnesses.push(progressionWitness(progression));
      witnesses.push({
        kind: 'visible_card_detail_equality',
        date: progression.targetDate,
        workoutId: progression.targetWorkout.id,
      });
      break;
    }
    case 'multi-reload-fixture-chain': {
      const sunday = underlyingWorkoutForDate(program, sundayDate);
      const nextMonday = underlyingWorkoutForDate(program, followingMonday);
      if (!nextMonday) throw new Error('multi-reload fixture seed requires following Monday.');
      witnesses.push({ kind: 'accepted_week_count', minimum: 2, consecutive: true });
      witnesses.push({ kind: 'calendar_mark', date: fixtureDate, mark: 'game' });
      witnesses.push({
        kind: 'fixture_identity',
        date: fixtureDate,
        workoutId: visibleFixtureWorkoutId(fixtureDate),
        anchorKind: 'game',
      });
      witnesses.push({
        kind: 'eligible_target_date',
        date: sundayDate,
        eligibility: 'rest_or_empty',
        underlyingWorkoutId: sunday?.id,
      });
      witnesses.push({
        kind: 'workout',
        dayOfWeek: 1,
        date: followingMonday,
        surface: 'underlying',
        workoutId: nextMonday.id,
        workoutType: nextMonday.workoutType,
      });
      witnesses.push(...cleanSourceFactWitnesses());
      witnesses.push({ kind: 'reversible_ledger_state', activeCount: 0, totalCount: 0 });
      witnesses.push({
        kind: 'accepted_revision',
        revision: expectedOnboardingAcceptedRevision(program, profile, anchorDate),
      });
      for (const [date, workoutId] of [
        [fixtureDate, visibleFixtureWorkoutId(fixtureDate)],
        [sundayDate, visibleRecoveryWorkoutId(sundayDate)],
        [followingMonday, nextMonday.id],
      ] as const) {
        witnesses.push({ kind: 'visible_card_detail_equality', date, workoutId });
      }
      break;
    }
    case 'repeat-week-phase-transition': {
      const sourceWeek = anchorDate;
      const targetWeek = followingMonday;
      const sourceTeamDate = addDaysISO(sourceWeek, 1);
      const targetTeamDate = addDaysISO(targetWeek, 1);
      const targetFixtureDate = addDaysISO(targetWeek, 5);
      const sourceTeam = teamTrainingWorkout(program, sourceTeamDate);
      const targetTeam = teamTrainingWorkout(program, targetTeamDate);
      const sourceSignature = contractSignatureForWeek(
        { program, weekScopedOverlays: {} },
        sourceWeek,
      );
      const targetSignature = contractSignatureForWeek(
        { program, weekScopedOverlays: {} },
        targetWeek,
      );
      if (sourceSignature === targetSignature) {
        throw new Error('repeat-week-phase-transition requires differing phase signatures.');
      }
      witnesses.push({ kind: 'accepted_week_count', minimum: 2, consecutive: true });
      witnesses.push({
        kind: 'week_contract_signature',
        weekStart: sourceWeek,
        signature: sourceSignature,
      });
      witnesses.push({
        kind: 'week_contract_signature',
        weekStart: targetWeek,
        signature: targetSignature,
      });
      witnesses.push({
        kind: 'workout',
        dayOfWeek: sourceTeam.dayOfWeek,
        date: sourceTeamDate,
        surface: 'underlying',
        workoutId: sourceTeam.id,
      });
      witnesses.push({
        kind: 'workout',
        dayOfWeek: targetTeam.dayOfWeek,
        date: targetTeamDate,
        surface: 'underlying',
        workoutId: targetTeam.id,
      });
      witnesses.push({
        kind: 'fixture_identity',
        date: targetFixtureDate,
        workoutId: visibleFixtureWorkoutId(targetFixtureDate),
        anchorKind: 'practice_match',
      });
      witnesses.push({
        kind: 'component_identity',
        date: targetTeamDate,
        workoutId: targetTeam.id,
        componentId: 'team_training',
        identity: componentIdentity(targetTeam, 'team_training'),
        surface: 'underlying',
      });
      witnesses.push({
        kind: 'absent_overlay',
        weekStart: targetWeek,
        reason: 'repeat_week',
        requireNoDateOverride: true,
        requireNoOverrideContext: true,
        requireNoUserRemovalOwnership: true,
      });
      break;
    }
    case 'coach-production-replay': {
      const sunday = underlyingWorkoutForDate(program, sundayDate);
      const hamstring = futureHamstringExposure(program, anchorDate);
      const progression = futureProgressionIdentity(program, anchorDate);
      witnesses.push({ kind: 'empty_coach_state' });
      witnesses.push({ kind: 'calendar_mark', date: fixtureDate, mark: 'game' });
      witnesses.push({
        kind: 'fixture_identity',
        date: fixtureDate,
        workoutId: visibleFixtureWorkoutId(fixtureDate),
        anchorKind: 'game',
      });
      witnesses.push({
        kind: 'eligible_target_date',
        date: sundayDate,
        eligibility: 'rest_or_empty',
        underlyingWorkoutId: sunday?.id,
      });
      witnesses.push({
        kind: 'workout',
        dayOfWeek: hamstring.workout.dayOfWeek,
        date: hamstring.date,
        surface: 'underlying',
        workoutId: hamstring.workout.id,
        strengthPattern: strengthPatterns(hamstring.workout).includes('hinge')
          ? 'hinge'
          : undefined,
      });
      witnesses.push({
        kind: 'exercise_present',
        exerciseId: hamstring.exercise.id,
        name: hamstring.exercise.exercise?.name ?? '',
        date: hamstring.date,
      });
      witnesses.push(progressionWitness(progression));
      witnesses.push(...cleanSourceFactWitnesses());
      witnesses.push({ kind: 'reversible_ledger_state', activeCount: 0, totalCount: 0 });
      for (const [date, workoutId] of [
        [fixtureDate, visibleFixtureWorkoutId(fixtureDate)],
        [sundayDate, visibleRecoveryWorkoutId(sundayDate)],
        [hamstring.date, visibleArmsPumpWorkoutId(hamstring.date)],
        [progression.targetDate, progression.targetWorkout.id],
      ] as const) {
        witnesses.push({ kind: 'visible_card_detail_equality', date, workoutId });
      }
      break;
    }
  }
  return witnesses;
}

export function buildDevE2ESeed(seedId: DevE2ESeedId): DevE2ESeed {
  if (!isDevE2ESeedId(seedId)) {
    throw new Error(`Unknown Dev E2E seed: ${String(seedId)}`);
  }
  const anchorDate = DEV_E2E_DATE_ANCHORS[seedId];
  const profile = profileForDevE2ESeed(seedId);
  const program = programForSeed(seedId, profile);
  const witnesses = witnessesForDevE2ESeed(seedId, program, profile);
  const auxiliaryState: DevE2EAuxiliaryState[] = [];

  switch (seedId) {
    case 'standard-in-season-week':
    case 'stacked-team-training-upper-pull':
    case 'one-set-strength':
    case 'fixture-move':
    case 'multi-reload-fixture-chain':
    case 'coach-production-replay':
      break;
    case 'repeat-week-phase-transition':
      auxiliaryState.push({
        kind: 'calendar_game',
        date: addDaysISO(anchorDate, 12),
      });
      break;
    case 'lower-body-deletion':
      break;
    case 'injury-case':
      auxiliaryState.push({
        kind: 'canonical_injury_episode',
        constraintId: INJURY_CONSTRAINT_ID,
        expectedEpisodeId: canonicalInjuryEpisodeId(),
        injuryKey: 'hamstring',
        bodyPart: 'Right hamstring',
        severity: 5,
        date: anchorDate,
      });
      break;
    case 'equipment-restriction-case':
      auxiliaryState.push({
        kind: 'temporary_equipment',
        presetId: 'bodyweight_only',
        date: anchorDate,
      });
      break;
    case 'feedback-progression-case': {
      const progression = futureProgressionIdentity(program, anchorDate);
      auxiliaryState.push({
        kind: 'session_feedback',
        date: anchorDate,
        workoutId: progression.sourceWorkout.id,
        planEntryId: progression.sourceWorkout.planEntryId,
        completion: 'full',
        feeling: 'very_easy',
        soreness: 'none',
        difficulty: 3,
      });
      break;
    }
  }

  return { id: seedId, anchorDate, profile, program, auxiliaryState, witnesses };
}

function allWorkouts(program: TrainingProgram | null): Workout[] {
  return program?.microcycles.flatMap((microcycle) => microcycle.workouts) ?? [];
}

function scopedDatesForWeek<T>(
  record: Record<string, T> | undefined,
  weekStart: string,
): string[] {
  return Object.keys(record ?? {}).filter((date) => mondayForDate(date) === weekStart);
}

function exerciseForWitness(
  state: DevE2EWitnessState,
  witness: Extract<DevE2EWitness, { kind: 'exercise_present' }>,
): WorkoutExercise | undefined {
  const workouts = witness.date
    ? [effectiveWorkoutForDate(state, witness.date)].filter(
        (workout): workout is Workout => !!workout,
      )
    : [
        ...allWorkouts(state.program),
        ...Object.values(state.dateOverrides ?? {}).filter(
          (workout): workout is Workout => !!workout,
        ),
      ];
  return workouts
    .flatMap((workout) => workout.exercises)
    .find((candidate) => candidate.id === witness.exerciseId);
}

function componentIdentityMatches(
  workout: Workout,
  witness: Extract<DevE2EWitness, { kind: 'component_identity' }>,
): boolean {
  try {
    return workout.id === witness.workoutId &&
      componentIdentity(workout, witness.componentId) === witness.identity;
  } catch {
    return false;
  }
}

function visibleWorkoutForDate(
  state: DevE2EWitnessState,
  date: string,
): Workout | null {
  const detail = state.visibleDetailDays?.[date];
  if (detail && typeof detail === 'object' && 'workout' in detail) {
    return (detail as { workout?: Workout | null }).workout ?? null;
  }
  return effectiveWorkoutForDate(state, date);
}

function fixtureAnchorMatches(
  state: DevE2EWitnessState,
  witness: Extract<DevE2EWitness, { kind: 'fixture_identity' }>,
): boolean {
  const weekStart = mondayForDate(witness.date);
  const contract = state.weekScopedOverlays?.[weekStart]?.exposureContractV2 ??
    state.program?.microcycles.find((microcycle) =>
      microcycle.startDate.slice(0, 10) === weekStart)?.exposureContractV2;
  const anchor = contract?.anchors.find((candidate) =>
    candidate.kind === witness.anchorKind);
  return anchor?.dayOfWeek === dayOfWeekForISODate(witness.date);
}

function hasSourceFact(
  state: DevE2EWitnessState,
  kind: Extract<DevE2EWitness, { kind: 'absent_source_fact' }>['factKind'],
): boolean {
  if (kind === 'injury') {
    return !!state.activeInjury ||
      (state.injuryEpisodes?.length ?? 0) > 0 ||
      (state.temporarySourceFacts ?? []).some((fact) => 'episodeId' in fact) ||
      state.activeConstraints.some((constraint) => constraint.type === 'injury');
  }
  if (kind === 'readiness') {
    return Object.keys(state.readinessSignalsByDate ?? {}).length > 0 ||
      state.activeConstraints.some((constraint) =>
        constraint.type === 'fatigue' || constraint.type === 'soreness');
  }
  if (kind === 'equipment') {
    return state.activeConstraints.some((constraint) => constraint.type === 'equipment');
  }
  return state.activeConstraints.some((constraint) =>
    constraint.type === 'schedule' || constraint.type === 'missed_session');
}

function prescriptionMatches(
  row: WorkoutExercise,
  expected: DevE2EPrescriptionWitness,
): boolean {
  return semanticFingerprint(prescriptionWitness(row)) === semanticFingerprint(expected);
}

function visibleEqualityProjection(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(visibleEqualityProjection);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => key !== 'createdAt' && key !== 'updatedAt')
    .map(([key, entry]) => [key, visibleEqualityProjection(entry)]));
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
        const workout = witness.date
          ? witness.surface === 'accepted_visible'
            ? effectiveWorkoutForDate(state, witness.date)
            : underlyingWorkoutForDate(state.program, witness.date)
          : workouts.find((candidate) =>
              candidate.dayOfWeek === witness.dayOfWeek &&
              (!witness.workoutId || candidate.id === witness.workoutId)) ?? null;
        const patternOk = !witness.strengthPattern ||
          (!!workout && strengthPatterns(workout).includes(witness.strengthPattern));
        const teamOk = witness.hasTeamTraining === undefined ||
          (!!workout && isTeamTrainingWorkout(workout) === witness.hasTeamTraining);
        if (!workout ||
          workout.dayOfWeek !== witness.dayOfWeek ||
          (witness.workoutId && workout.id !== witness.workoutId) ||
          (witness.workoutType && workout.workoutType !== witness.workoutType) ||
          !patternOk ||
          !teamOk) {
          failures.push(`workout:${witness.date ?? `dow-${witness.dayOfWeek}`}`);
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
      case 'exercise_present': {
        const exercise = exerciseForWitness(state, witness);
        if (!exercise || exercise.exercise?.name !== witness.name) {
          failures.push(`exercise_present:${witness.exerciseId}`);
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
      case 'active_injury': {
        const episode = state.injuryEpisodes?.find((candidate) =>
          candidate.episodeId === witness.episodeId);
        const sourceFact = (state.temporarySourceFacts ?? []).find((fact) =>
          'episodeId' in fact && fact.episodeId === witness.episodeId);
        const constraint = state.activeConstraints.find((candidate) =>
          candidate.id === witness.constraintId &&
          candidate.type === 'injury' &&
          candidate.injuryEpisodeId === witness.episodeId);
        if (state.activeInjury?.bodyPart !== witness.bodyPart ||
          state.activeInjury?.severity !== witness.severity ||
          episode?.legacyMigrationStatus !== 'native_v1' ||
          !sourceFact ||
          !constraint) {
          failures.push(`injury:${witness.bodyPart}:${witness.episodeId}`);
        }
        break;
      }
      case 'active_equipment':
        if (!state.activeConstraints.some((constraint) =>
          constraint.type === 'equipment' &&
          constraint.mode === 'only' &&
          constraint.tags.includes('bodyweight') &&
          constraint.temporarySourceFactIds?.includes(witness.factId)) ||
          !state.temporarySourceFacts?.some((fact) =>
            'factId' in fact &&
            fact.factId === witness.factId &&
            'factKind' in fact &&
            fact.factKind === 'equipment' &&
            fact.status === 'active')) {
          failures.push(`equipment:${witness.presetId}`);
        }
        break;
      case 'session_feedback': {
        const feedback = state.sessionFeedback[witness.date];
        if (feedback?.completion !== witness.completion ||
          feedback.outcomeReceipt?.sessionIdentity.workoutId !== witness.workoutId ||
          (
            witness.planEntryId !== undefined &&
            feedback.outcomeReceipt?.sessionIdentity.planEntryId !== witness.planEntryId
          )) {
          failures.push(`feedback:${witness.date}:${witness.workoutId}`);
        }
        break;
      }
      case 'accepted_week_count': {
        const weeks = (state.program?.microcycles ?? [])
          .filter((microcycle) => !!microcycle.exposureContractV2)
          .map((microcycle) => microcycle.startDate.slice(0, 10))
          .sort();
        const consecutive = !witness.consecutive || weeks.every((week, index) =>
          index === 0 || week === addDaysISO(weeks[index - 1], 7));
        if (weeks.length < witness.minimum || !consecutive) {
          failures.push(`accepted_weeks:${witness.minimum}`);
        }
        break;
      }
      case 'week_contract_signature':
        if (contractSignatureForWeek(state, witness.weekStart) !== witness.signature) {
          failures.push(`week_signature:${witness.weekStart}`);
        }
        break;
      case 'eligible_target_date': {
        const workout = effectiveWorkoutForDate(state, witness.date);
        const underlying = underlyingWorkoutForDate(state.program, witness.date);
        const fixtureFree = state.calendarMarks[witness.date] !== 'game' &&
          state.calendarMarks[witness.date] !== 'noGame';
        const eligible = workout === null || workout.workoutType === 'Rest';
        if (!fixtureFree ||
          !eligible ||
          (
            witness.underlyingWorkoutId !== undefined &&
            underlying?.id !== witness.underlyingWorkoutId
          )) {
          failures.push(`eligible_target:${witness.date}`);
        }
        break;
      }
      case 'fixture_identity': {
        const workout = visibleWorkoutForDate(state, witness.date);
        if (state.calendarMarks[witness.date] !== 'game' ||
          workout?.id !== witness.workoutId ||
          workout.workoutType !== 'Game' ||
          (
            witness.planEntryId !== undefined &&
            workout.planEntryId !== witness.planEntryId
          ) ||
          !fixtureAnchorMatches(state, witness)) {
          failures.push(`fixture_identity:${witness.date}:${witness.workoutId}`);
        }
        break;
      }
      case 'component_identity': {
        const workout = witness.surface === 'underlying'
          ? underlyingWorkoutForDate(state.program, witness.date)
          : effectiveWorkoutForDate(state, witness.date);
        if (!workout || !componentIdentityMatches(workout, witness)) {
          failures.push(`component_identity:${witness.identity}`);
        }
        break;
      }
      case 'absent_overlay': {
        const weekStart = witness.weekStart ?? (
          witness.date ? mondayForDate(witness.date) : undefined
        );
        const overlay = weekStart ? state.weekScopedOverlays?.[weekStart] : undefined;
        const reasonConflict = witness.reason
          ? overlay?.reason === witness.reason
          : witness.date
            ? !!overlay && Object.prototype.hasOwnProperty.call(
                overlay.workoutsByDate,
                witness.date,
              )
            : !!overlay;
        const overrideConflict = witness.requireNoDateOverride && (
          witness.date
            ? Object.prototype.hasOwnProperty.call(state.dateOverrides ?? {}, witness.date)
            : !!weekStart && scopedDatesForWeek(state.dateOverrides, weekStart).length > 0
        );
        const contextConflict = witness.requireNoOverrideContext && (
          witness.date
            ? Object.prototype.hasOwnProperty.call(state.overrideContexts ?? {}, witness.date)
            : !!weekStart && scopedDatesForWeek(state.overrideContexts, weekStart).length > 0
        );
        const removalConflict = witness.requireNoUserRemovalOwnership &&
          (state.userRemovalConstraints ?? []).some((constraint) => {
            const dates = [constraint.targetDate, constraint.moveTargetDate].filter(
              (date): date is string => !!date,
            );
            return witness.date
              ? dates.includes(witness.date)
              : !!weekStart && dates.some((date) => mondayForDate(date) === weekStart);
          });
        if (reasonConflict || overrideConflict || contextConflict || removalConflict) {
          failures.push(`absent_overlay:${witness.date ?? weekStart ?? 'unknown'}`);
        }
        break;
      }
      case 'absent_source_fact':
        if (hasSourceFact(state, witness.factKind)) {
          failures.push(`absent_source_fact:${witness.factKind}`);
        }
        break;
      case 'empty_coach_state': {
        const coach = state.coachState;
        if (!coach ||
          coach.transcriptCount !== 0 ||
          coach.memoryCount !== 0 ||
          coach.mutationHistoryCount !== 0 ||
          coach.pendingClarifier !== null ||
          coach.pendingProposal !== null) {
          failures.push('coach_state:not_empty');
        }
        break;
      }
      case 'accepted_revision':
        if (state.acceptedRevision !== witness.revision) {
          failures.push(`accepted_revision:${witness.revision}`);
        }
        break;
      case 'reversible_ledger_state': {
        const adjustments = state.reversibleAdjustmentLedger?.adjustments ?? [];
        const active = adjustments.filter((adjustment) => adjustment.status === 'active');
        if (adjustments.length !== witness.totalCount || active.length !== witness.activeCount) {
          failures.push(
            `reversible_ledger:${witness.activeCount}:${witness.totalCount}`,
          );
        }
        break;
      }
      case 'future_progression_target': {
        const sourceWorkout = underlyingWorkoutForDate(state.program, witness.sourceDate);
        const sourceExercise = sourceWorkout?.exercises.find((row) =>
          row.id === witness.sourceExerciseRowId &&
          row.exerciseId === witness.sourceExerciseId);
        const targetWorkout = underlyingWorkoutForDate(state.program, witness.targetDate);
        const targetExercise = targetWorkout?.exercises.find((row) =>
          row.id === witness.targetExerciseRowId &&
          row.exerciseId === witness.targetExerciseId);
        if (sourceWorkout?.id !== witness.sourceWorkoutId ||
          !sourceExercise ||
          !prescriptionMatches(sourceExercise, witness.baselinePrescription) ||
          targetWorkout?.id !== witness.targetWorkoutId ||
          !targetExercise) {
          failures.push(
            `future_progression_target:${witness.sourceDate}:${witness.targetDate}`,
          );
        }
        break;
      }
      case 'visible_card_detail_equality': {
        const card = state.visibleCardDays?.[witness.date];
        const detail = state.visibleDetailDays?.[witness.date];
        const cardWorkout = card && typeof card === 'object' && 'workout' in card
          ? (card as { workout?: Workout | null }).workout ?? null
          : undefined;
        const detailWorkout = detail && typeof detail === 'object' && 'workout' in detail
          ? (detail as { workout?: Workout | null }).workout ?? null
          : undefined;
        if (card === undefined ||
          detail === undefined ||
          semanticFingerprint(visibleEqualityProjection(card)) !==
            semanticFingerprint(visibleEqualityProjection(detail)) ||
          (cardWorkout?.id ?? null) !== witness.workoutId ||
          (detailWorkout?.id ?? null) !== witness.workoutId) {
          failures.push(`visible_equality:${witness.date}`);
        }
        break;
      }
    }
  }
  return failures.map((failure) => `${seedId}:${failure}`);
}
