import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DayOfWeek,
  TrainingProgram,
  Microcycle,
  OnboardingData,
  Workout,
  WorkoutExercise,
  OverrideContext,
  UserRemovalConstraint,
  WeekScopedWorkoutOverlay,
} from '../types/domain';
import { logger } from '../utils/logger';
import {
  addDaysISO,
  deriveStoredBlockStateFromProgram,
  getBlockNumberForDate,
  type StoredProgramBlockState,
} from '../utils/programBlockState';
import type { ConditioningPerformanceLog } from '../utils/conditioningLogging';
import type { StrengthExercisePerformanceLog } from '../utils/strengthLogging';
import type { SessionComponentKind } from '../utils/sessionComponents';
import { todayISOLocal } from '../utils/appDate';
import type { WeeklyExposureContract } from '../rules/weeklyExposureContract';
import {
  buildSection18WeeklyExposureContractV2,
  migrateLegacyWeeklyExposureContractV2,
  resolveSection18PhasePlannerSelection,
  type Section18Subphase,
  type Section18WeekMode,
  type WeeklyExposureContractV2,
} from '../rules/weeklyExposureContractV2';
import { applyGenerationSafetyToSection18Contract } from '../rules/section18SafetyPolicy';
import {
  finaliseSection18SafetyWeek,
  finaliseSection18SafetyWorkout,
} from '../rules/section18SafetyFinaliser';
import {
  ensureProgramSeasonPhaseClock,
  resolveSeasonPhaseClock,
  type SeasonPhaseClock,
} from '../rules/seasonPhaseClock';
import { classifyVisibleSession } from '../rules/sessionClassificationAdapter';
import type { CalendarDayType } from './calendarStore';
import type { ActiveConstraint } from './coachUpdatesStore';
import { rebaseAcceptedEffectiveWeek } from '../rules/acceptedEffectiveWeek';
import { effectiveFixtureDatesForWeeks } from '../rules/rollingHorizonRepair';
import { applyUserRemovalConstraintsToWeek } from '../rules/userRemovalConstraints';
import {
  createEmptyAcceptedMaterialContext,
  normalizeAcceptedMaterialContext,
  normalizeAcceptedProgramSurfaces,
  type AcceptedMaterialContext,
} from './acceptedStateColdStart';

export type { AcceptedMaterialContext } from './acceptedStateColdStart';

export class ProgramPersistenceError extends Error {
  readonly code = 'program_persistence_failed' as const;
  readonly originalStack: string | null;

  constructor(public readonly operation: 'read' | 'write' | 'remove', cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = 'ProgramPersistenceError';
    this.originalStack = cause instanceof Error ? cause.stack ?? null : null;
  }
}

function programPersistenceFailure(
  operation: ProgramPersistenceError['operation'],
  cause: unknown,
): ProgramPersistenceError {
  const error = new ProgramPersistenceError(operation, cause);
  logger.error('[ProgramStore][persistence] Persistence failed', {
    stage: 'persistence',
    operation,
    errorName: cause instanceof Error ? cause.name : typeof cause,
    message: error.message,
    stack: error.originalStack,
  });
  return error;
}

const programStateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(name);
    } catch (error) {
      throw programPersistenceFailure('read', error);
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(name, value);
    } catch (error) {
      throw programPersistenceFailure('write', error);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(name);
    } catch (error) {
      throw programPersistenceFailure('remove', error);
    }
  },
};

/**
 * ProgramStore is the final persistence boundary for every generated/edit
 * path. Dynamic loading avoids a store-initialisation cycle while ensuring the
 * same validator runs for program, overlay, and manual-override writes.
 */
function postValidateProgram(program: TrainingProgram): TrainingProgram {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../utils/postGenerationConstraintValidation')
    .validateLiveProgramWrite(program);
}

function postValidateMicrocycle(microcycle: Microcycle): Microcycle {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../utils/postGenerationConstraintValidation')
    .validateLiveMicrocycleWrite(microcycle);
}

function postValidateWorkout(
  date: string,
  workout: Workout,
  options: { restoreMissingPlanPatterns?: boolean } = {},
): Workout {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../utils/postGenerationConstraintValidation')
    .validateLiveWorkoutWrite(date, workout, options);
}

function postValidateNullableWorkout(date: string, workout: Workout | null): Workout | null {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../utils/postGenerationConstraintValidation')
    .validateLiveNullableWorkoutWrite(date, workout);
}

function postValidateWeekOverlay(overlay: WeekScopedWorkoutOverlay): WeekScopedWorkoutOverlay {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../utils/postGenerationConstraintValidation')
    .validateLiveWeekOverlayWrite(overlay);
}

function resolveDateMutationExposureContract(
  date: string,
  workout: Workout,
): { weekStart: string; contract: WeeklyExposureContract } | null {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../utils/postGenerationConstraintValidation')
    .resolveLiveDateMutationExposureContract(date, workout);
}

function resolveEditedWeekExposureContract(
  weekStart: string,
): { weekStart: string; contract: WeeklyExposureContract } | null {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../utils/postGenerationConstraintValidation')
    .resolveLiveEditedWeekExposureContract(weekStart);
}

function mondayForDate(date: string): string {
  const value = new Date(`${date.slice(0, 10)}T12:00:00`);
  value.setDate(value.getDate() - ((value.getDay() + 6) % 7));
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

/**
 * Persistence is a legacy ingress boundary, not a second programming owner.
 * Old store envelopes may pre-date typed strength intent and canonical
 * component sections, so rehydrate them once through the same finaliser used
 * by generation and edits. Existing modern typed intent wins inside that
 * finaliser; display/scalar fields are compatibility inputs only.
 */
function canonicaliseHydratedWorkout(
  workout: Workout,
  phase?: string,
  weekKind?: Microcycle['weekKind'],
): Workout {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { finaliseWorkoutAfterMutation } = require('../utils/workoutCanonicalisation');
  const canonicalPhase = /pre/i.test(phase ?? '')
    ? 'Pre-season'
    : /off/i.test(phase ?? '')
      ? 'Off-season'
      : /in/i.test(phase ?? '')
        ? 'In-season'
        : undefined;
  return finaliseWorkoutAfterMutation(workout, {
    phase: canonicalPhase,
    weekKind,
    // Persisted allocation ownership is legitimate ingress. This preserves
    // explicit legacy contribution arrays even before plan-entry IDs existed.
    planIntentValid: true,
    referenceWorkout: workout,
    section18EvidenceMode: 'preserve_legacy_unknown',
  }).workout;
}

function hydratedWorkoutNeedsIngressCanonicalisation(workout: Workout): boolean {
  const hasStrength = !!workout.strengthIntent?.effectivePatterns.length ||
    !!workout.strengthPatternContributions?.length ||
    workout.exercises.some((row) => row.section18Evidence?.role === 'main_strength');
  const conditioningRole = workout.section18Evidence?.conditioningRole;
  const hasConditioning = !!workout.conditioningBlock ||
    (conditioningRole !== undefined && conditioningRole !== 'none' && conditioningRole !== 'legacy_unknown') ||
    workout.hasCombinedConditioning === true;
  return (
    (!!workout.strengthPatternContributions?.length && !workout.strengthIntent) ||
    (hasStrength && hasConditioning && workout.workoutType !== 'Mixed')
  );
}

export class Section18LegacyMigrationError extends Error {
  readonly code = 'section18_legacy_migration_failed';

  constructor(message: string) {
    super(message);
    this.name = 'Section18LegacyMigrationError';
  }
}

function legacyModeFor(args: {
  phase: 'In-season' | 'Off-season' | 'Pre-season';
  subphase: Section18Subphase | null;
  hasFixture: boolean;
}): { mode: Section18WeekMode; anchorState: 'game' | 'bye' | 'practice_match' | 'none'; declaredSubphase: Section18Subphase } {
  if (args.phase === 'In-season') {
    return args.hasFixture
      ? { mode: 'in_season_game_week', anchorState: 'game', declaredSubphase: 'game_week' }
      : { mode: 'in_season_bye_build', anchorState: 'bye', declaredSubphase: 'bye_build' };
  }
  if (args.phase === 'Off-season') {
    if (
      args.subphase !== 'early_offseason' &&
      args.subphase !== 'mid_offseason' &&
      args.subphase !== 'late_offseason'
    ) {
      throw new Section18LegacyMigrationError('Contractless Off-season week has no trustworthy phase-clock subphase.');
    }
    return { mode: args.subphase, anchorState: 'none', declaredSubphase: args.subphase };
  }
  if (args.hasFixture) {
    return {
      mode: 'practice_match_week',
      anchorState: 'practice_match',
      declaredSubphase: 'practice_match_week',
    };
  }
  if (
    args.subphase !== 'early_preseason' &&
    args.subphase !== 'mid_preseason' &&
    args.subphase !== 'late_preseason'
  ) {
    throw new Section18LegacyMigrationError('Contractless Pre-season week has no trustworthy phase-clock subphase.');
  }
  return { mode: args.subphase, anchorState: 'none', declaredSubphase: args.subphase };
}

function deriveContractlessLegacyContract(args: {
  microcycle: Microcycle;
  selectedPhase: 'In-season' | 'Off-season' | 'Pre-season' | null;
  phaseResolution: ReturnType<typeof resolveSeasonPhaseClock> | null;
}): WeeklyExposureContractV2 {
  if (!args.selectedPhase || !args.phaseResolution) {
    throw new Section18LegacyMigrationError('Contractless week has no trustworthy persisted phase clock.');
  }
  const workouts = args.microcycle.workouts ?? [];
  const teamTrainingDays = workouts
    .filter((workout) => classifyVisibleSession(workout).anchors.teamTraining)
    .map((workout) => workout.dayOfWeek);
  const fixture = workouts.find((workout) => classifyVisibleSession(workout).anchors.game);
  const identity = legacyModeFor({
    phase: args.selectedPhase,
    subphase: args.phaseResolution.subphase,
    hasFixture: !!fixture,
  });
  const availableDayCount = new Set(workouts.map((workout) => workout.dayOfWeek)).size;
  const selection = resolveSection18PhasePlannerSelection({
    mode: identity.mode,
    readiness: 'medium',
    availableDayCount,
    teamTrainingCount: new Set(teamTrainingDays).size,
    weekKind: args.phaseResolution.weekKind,
  });
  return buildSection18WeeklyExposureContractV2({
    seasonPhase: args.selectedPhase,
    declaredSubphase: identity.declaredSubphase,
    mode: identity.mode,
    blockNumber: args.microcycle.miniCycleNumber,
    weekInBlock: ((Math.max(1, args.microcycle.weekNumber) - 1) % 4) + 1,
    globalWeek: args.microcycle.weekNumber,
    phaseWeek: args.phaseResolution.phaseWeekNumber,
    phaseEntryWeekStartISO: args.phaseResolution.clock.phaseEntryWeekStartISO,
    phaseClockSelectedPhase: args.phaseResolution.clock.selectedPhase,
    phaseWeekProvenance: 'preserved_persisted_state',
    weekKind: args.phaseResolution.weekKind,
    anchorState: identity.anchorState,
    teamTrainingDays,
    fixtureDay: fixture?.dayOfWeek ?? null,
    participationProvenance: 'legacy_unknown',
    currentProductionClaimsAnchorCredit: false,
    readiness: 'medium',
    plannerSelected: {
      mainStrength: selection.mainStrength,
      optionalMainStrength: selection.optionalMainStrength,
      coreConditioning: selection.coreConditioning,
      optionalFlush: selection.optionalFlush,
      optionalRecoveryAerobic: selection.optionalRecoveryAerobic,
      sprintHighSpeed: selection.sprintHighSpeed,
      powerPrimers: workouts.filter((workout) => !!workout.powerBlock).length,
    },
    prohibitedPatternProvenance: 'legacy_missing',
    source: 'legacy_migration',
  });
}

const LEGACY_DAY_NAMES: DayOfWeek[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/**
 * ProgramStore and ProfileStore hydrate independently. A contractless program
 * therefore cannot assume the profile has already supplied its scheduling
 * geometry when the accepted-week migration runs. The persisted workout days
 * are trustworthy evidence that those days belonged to the old program; they
 * are not anchor-participation evidence and never create reductions or credit.
 */
function legacyMigrationFallbackProfile(args: {
  profile?: OnboardingData | null;
  microcycle: Microcycle;
  contract: WeeklyExposureContractV2;
}): OnboardingData {
  const persistedDays = Array.from(new Set(
    (args.microcycle.workouts ?? [])
      .map((workout) => workout.dayOfWeek)
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
  )).sort((left, right) => (left === 0 ? 7 : left) - (right === 0 ? 7 : right));
  const persistedDayNames = persistedDays.map((day) => LEGACY_DAY_NAMES[day]);
  const profileDays = args.profile?.preferredTrainingDays?.filter(Boolean) ?? [];
  const profileFrequency = args.profile?.trainingDaysPerWeek;
  return {
    ...(args.profile ?? {}),
    seasonPhase: args.contract.identity.seasonPhase,
    trainingDaysPerWeek: profileFrequency && profileFrequency > 0
      ? profileFrequency
      : persistedDays.length,
    preferredTrainingDays: profileDays.length > 0
      ? profileDays
      : persistedDayNames,
    // Contractless selection above deliberately uses the conservative medium
    // tier. These values are generation-only defaults that reproduce that
    // already-owned decision when the independently persisted profile has not
    // hydrated yet; they are never written back as athlete answers.
    recentTrainingLoad: args.profile?.recentTrainingLoad ?? 'Pretty consistent',
    conditioningLevel: args.profile?.conditioningLevel ?? 'Good',
    injuries: args.profile?.injuries ?? [],
  };
}

function canonicaliseHydratedMicrocycle(
  microcycle: Microcycle,
  phase?: string,
  phaseClock?: SeasonPhaseClock,
  profile?: OnboardingData | null,
): Microcycle {
  const contractWasMissing = !microcycle.exposureContractV2 && !microcycle.exposureContract;
  const selectedPhase = phaseClock?.selectedPhase ?? (
    /pre/i.test(phase ?? '') ? 'Pre-season' :
      /off|base/i.test(phase ?? '') ? 'Off-season' :
        /in/i.test(phase ?? '') ? 'In-season' : null
  );
  const phaseResolution = selectedPhase && phaseClock
    ? resolveSeasonPhaseClock({
        selectedPhase,
        targetWeekStartISO: microcycle.startDate,
        persistedClock: phaseClock,
      })
    : null;
  let exposureContractV2 = microcycle.exposureContractV2 ?? (
    microcycle.exposureContract
      ? migrateLegacyWeeklyExposureContractV2(microcycle.exposureContract, {
          blockNumber: microcycle.miniCycleNumber,
          weekInBlock: ((Math.max(1, microcycle.weekNumber) - 1) % 4) + 1,
          globalWeek: microcycle.weekNumber,
        })
      : undefined
  );
  if (!exposureContractV2) {
    exposureContractV2 = deriveContractlessLegacyContract({
      microcycle,
      selectedPhase,
      phaseResolution,
    });
  }
  if (exposureContractV2 && phaseResolution) {
    const expectedSubphase = exposureContractV2.identity.anchorState === 'practice_match'
      ? 'practice_match_week'
      : phaseResolution.subphase ?? exposureContractV2.identity.expectedSubphase;
    exposureContractV2 = {
      ...exposureContractV2,
      identity: {
        ...exposureContractV2.identity,
        seasonPhase: phaseClock!.selectedPhase,
        expectedSubphase,
        phaseWeek: phaseResolution.phaseWeekNumber,
        phaseEntryWeekStartISO: phaseClock!.phaseEntryWeekStartISO,
        phaseClockSelectedPhase: phaseClock!.selectedPhase,
        phaseWeekProvenance: 'preserved_persisted_state',
        weekKind: phaseResolution.weekKind,
      },
    };
  }
  // Legacy row/contribution ownership must be translated before the weekly
  // evaluator can count it, but this is only ingress normalisation: the
  // complete resulting week still has to pass safety and the accepted-week
  // gateway below before any hydrated state can publish.
  let workouts = (microcycle.workouts ?? []).map((workout) =>
    contractWasMissing || hydratedWorkoutNeedsIngressCanonicalisation(workout)
      ? canonicaliseHydratedWorkout(
          workout,
          selectedPhase ?? phase,
          phaseResolution?.weekKind ?? microcycle.weekKind,
        )
      : workout);
  if (exposureContractV2) {
    exposureContractV2 = applyGenerationSafetyToSection18Contract({
      contract: exposureContractV2,
    });
    const safety = finaliseSection18SafetyWeek({
      contract: exposureContractV2,
      workouts,
      weekStart: microcycle.startDate.slice(0, 10),
      canonicalContext: {
        phase: exposureContractV2.identity.seasonPhase,
        weekKind: phaseResolution?.weekKind ?? microcycle.weekKind,
        section18EvidenceMode: 'preserve_legacy_unknown',
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fallbackProfile = exposureContractV2.source === 'legacy_migration'
      ? legacyMigrationFallbackProfile({
          profile,
          microcycle,
          contract: safety.contract,
        })
      : profile;
    const accepted = require('../rules/section18AcceptedWeekGateway')
      .requireSection18AcceptedWeek({
        contract: safety.contract,
        workouts: safety.workouts,
        weekStart: microcycle.startDate.slice(0, 10),
        profile,
        regenerate: fallbackProfile
          ? () => require('../utils/postGenerationConstraintValidation')
              .buildSection18ProductionFallbackCandidate({
                contract: safety.contract,
                weekStart: microcycle.startDate.slice(0, 10),
                profile: fallbackProfile,
              })
          : undefined,
        safeFallback: fallbackProfile
          ? () => require('../utils/postGenerationConstraintValidation')
              .buildSection18ProductionFallbackCandidate({
                contract: safety.contract,
                weekStart: microcycle.startDate.slice(0, 10),
                profile: fallbackProfile,
              })
          : undefined,
      });
    workouts = accepted.canonicalWorkouts;
    exposureContractV2 = accepted.contract;
  }
  return {
    ...microcycle,
    weekKind: phaseResolution?.weekKind ?? microcycle.weekKind,
    intensityMultiplier: phaseResolution
      ? phaseResolution.weekKind === 'deload'
        ? phaseClock?.selectedPhase === 'Off-season' ? 0.85 : 0.9
        : 1
      : microcycle.intensityMultiplier,
    workouts,
    exposureContractV2,
  };
}

export function canonicaliseHydratedProgram(
  program: TrainingProgram,
  profile?: OnboardingData | null,
): TrainingProgram {
  const clockedProgram = ensureProgramSeasonPhaseClock(program);
  return {
    ...clockedProgram,
    microcycles: (clockedProgram.microcycles ?? []).map((microcycle) =>
      canonicaliseHydratedMicrocycle(
        microcycle,
        clockedProgram.programPhase,
        clockedProgram.seasonPhaseClock,
        profile,
      )),
  };
}

function canonicaliseHydratedSafetyWorkout(
  workout: Workout,
  contract: WeeklyExposureContractV2 | undefined,
  phase?: string,
): Workout {
  return contract
    ? finaliseSection18SafetyWorkout({
        contract,
        workout,
        canonicalContext: {
          phase: contract.identity.seasonPhase,
          section18EvidenceMode: 'preserve_legacy_unknown',
        },
      }).workout
    : canonicaliseHydratedWorkout(workout, phase);
}

export function canonicaliseHydratedState(
  persistedState: Partial<ProgramState>,
  options: {
    programAlreadyAccepted?: boolean;
    activeConstraints?: readonly import('./coachUpdatesStore').ActiveConstraint[];
    profile?: OnboardingData | null;
    markedDays?: Readonly<Record<string, CalendarDayType>>;
    validateWeekStarts?: readonly string[];
  } = {},
): Partial<ProgramState> {
  let currentProgram = persistedState.currentProgram && !options.programAlreadyAccepted
    ? canonicaliseHydratedProgram(persistedState.currentProgram, options.profile)
    : persistedState.currentProgram;
  const overlayOwnedWeekStarts = new Set(Object.keys(persistedState.weekScopedOverlays ?? {}));
  if (currentProgram && options.activeConstraints) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const validator = require('../utils/postGenerationConstraintValidation');
    let changed = false;
    const microcycles = currentProgram.microcycles.map((microcycle) => {
      // An explicit accepted overlay owns this effective week. Validating the
      // hidden base independently would reintroduce a second week authority;
      // the precedence-composed gateway below validates the overlay-owned week.
      if (overlayOwnedWeekStarts.has(microcycle.startDate.slice(0, 10))) return microcycle;
      const validated = validator.validateMicrocycleAgainstActiveConstraints({
        microcycle,
        todayISO: todayISOLocal(),
        activeConstraints: options.activeConstraints!,
        profile: options.profile,
      });
      if (validated !== microcycle) changed = true;
      return validated;
    });
    if (changed) currentProgram = { ...currentProgram, microcycles };
  }
  const phase = currentProgram?.seasonPhaseClock?.selectedPhase ?? currentProgram?.programPhase;
  let currentMicrocycle = persistedState.currentMicrocycle && !options.programAlreadyAccepted
    ? canonicaliseHydratedMicrocycle(
        persistedState.currentMicrocycle,
        phase,
        currentProgram?.seasonPhaseClock,
        options.profile,
      )
    : persistedState.currentMicrocycle;
  if (currentMicrocycle && options.activeConstraints &&
    !overlayOwnedWeekStarts.has(currentMicrocycle.startDate.slice(0, 10))) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    currentMicrocycle = require('../utils/postGenerationConstraintValidation')
      .validateMicrocycleAgainstActiveConstraints({
        microcycle: currentMicrocycle,
        todayISO: todayISOLocal(),
        activeConstraints: options.activeConstraints,
        profile: options.profile,
      });
  }
  let weekScopedOverlays = persistedState.weekScopedOverlays
      ? Object.fromEntries(Object.entries(persistedState.weekScopedOverlays).map(([weekStart, overlay]) => [
        weekStart,
        (() => {
          if (
            !overlay.exposureContractV2 &&
            !overlay.exposureContract &&
            Object.keys(overlay.workoutsByDate ?? {}).length === 0
          ) {
            // Empty future owner placeholders carry no material programming
            // yet. Preserve them byte-for-byte until their target week gains
            // a base contract during rebuild/rollover materialisation.
            return overlay;
          }
          let exposureContractV2 = overlay.exposureContractV2 ?? (
            overlay.exposureContract
              ? migrateLegacyWeeklyExposureContractV2(overlay.exposureContract)
              : undefined
          );
          if (exposureContractV2) {
            const generationConstraints = options.activeConstraints
              ? require('../utils/generationConstraints').buildGenerationConstraintContext({
                  activeConstraints: options.activeConstraints,
                  todayISO: weekStart,
                  periodEndISO: addDaysISO(weekStart, 6),
                })
              : undefined;
            exposureContractV2 = applyGenerationSafetyToSection18Contract({
              contract: exposureContractV2,
              generationConstraints,
              forceFullPause: options.activeConstraints?.some((constraint) =>
                constraint.type === 'injury' && constraint.status !== 'resolved' &&
                constraint.seriousSymptoms === true),
            });
          }
          return {
            ...overlay,
            exposureContractV2,
            workoutsByDate: Object.fromEntries(
              Object.entries(overlay.workoutsByDate).map(([date, workout]) => [
                date,
                  workout
                  ? options.programAlreadyAccepted && !exposureContractV2
                    ? workout
                    : canonicaliseHydratedSafetyWorkout(workout, exposureContractV2, phase)
                  : null,
              ]),
            ),
          };
        })(),
      ]))
    : persistedState.weekScopedOverlays;
  const safetyContractForDate = (date: string): WeeklyExposureContractV2 | undefined => {
    const overlay = weekScopedOverlays?.[mondayForDate(date)];
    if (overlay?.exposureContractV2) return overlay.exposureContractV2;
    const programMicrocycle = currentProgram?.microcycles.find((microcycle) =>
      date >= microcycle.startDate.slice(0, 10) && date <= microcycle.endDate.slice(0, 10));
    if (programMicrocycle?.exposureContractV2) return programMicrocycle.exposureContractV2;
    if (
      currentMicrocycle &&
      date >= currentMicrocycle.startDate.slice(0, 10) &&
      date <= currentMicrocycle.endDate.slice(0, 10)
    ) {
      return currentMicrocycle.exposureContractV2;
    }
    return undefined;
  };
  let dateOverrides = persistedState.dateOverrides
    ? Object.fromEntries(Object.entries(persistedState.dateOverrides).map(([date, workout]) => [
        date,
        {
          ...(options.programAlreadyAccepted && !safetyContractForDate(date)
            ? workout
            : canonicaliseHydratedSafetyWorkout(workout, safetyContractForDate(date), phase)),
          // Date-keyed overrides own a concrete calendar day. Older edit
          // writers used the 1..7 coaching convention (Sunday=7), whereas
          // Workout uses JavaScript 0..6. Normalise at ingress so the weekly
          // gateway cannot mistake a valid Sunday override for a missing day.
          dayOfWeek: new Date(`${date.slice(0, 10)}T12:00:00`).getDay(),
        },
      ]))
    : persistedState.dateOverrides;

  // A migrated overlay or date override can make an otherwise-valid base
  // microcycle invalid. Rebuild the actual precedence-ordered week here and
  // pass that effective candidate through the same accepted-week gateway.
  // Any deterministic cross-day repair is persisted back into the surface
  // that owns the changed date, so hydration cannot merely validate the base
  // program while retaining an invalid visible override.
  const hydratedWeekStarts = new Set<string>([
    ...Object.keys(weekScopedOverlays ?? {}),
    ...Object.keys(dateOverrides ?? {}).map(mondayForDate),
    ...(persistedState.userRemovalConstraints ?? [])
      .filter((constraint) => constraint.status === 'active')
      .map((constraint) => mondayForDate(constraint.targetDate)),
    ...(options.validateWeekStarts ?? []).map((weekStart) => weekStart.slice(0, 10)),
    ...(options.activeConstraints
      ? [
          ...(currentProgram?.microcycles ?? []).map((microcycle) =>
            microcycle.startDate.slice(0, 10)),
          ...(currentMicrocycle ? [currentMicrocycle.startDate.slice(0, 10)] : []),
        ]
      : []),
  ]);
  const activeFixtureDates = options.profile
    ? effectiveFixtureDatesForWeeks({
        profile: options.profile,
        markedDays: options.markedDays ?? {},
        weekStarts: Array.from(hydratedWeekStarts),
      })
    : undefined;
  for (const weekStart of hydratedWeekStarts) {
    const overlay = weekScopedOverlays?.[weekStart];
    const baseMicrocycle = currentProgram?.microcycles.find((microcycle) =>
      weekStart >= microcycle.startDate.slice(0, 10) &&
      weekStart <= microcycle.endDate.slice(0, 10)) ?? (
      currentMicrocycle &&
      weekStart >= currentMicrocycle.startDate.slice(0, 10) &&
      weekStart <= currentMicrocycle.endDate.slice(0, 10)
        ? currentMicrocycle
        : undefined
    );
    const contract = overlay?.exposureContractV2 ?? baseMicrocycle?.exposureContractV2;
    if (!contract) continue;

    const rebased = rebaseAcceptedEffectiveWeek({
      surfaces: {
        currentProgram,
        currentMicrocycle,
        dateOverrides: dateOverrides ?? {},
        weekScopedOverlays: weekScopedOverlays ?? {},
        userRemovalConstraints: persistedState.userRemovalConstraints ?? [],
      },
      weekStart,
      profile: options.profile,
      markedDays: options.markedDays ?? {},
    });
    const effectiveByDate = new Map<string, Workout>(
      rebased.dates.flatMap((entry) => entry.workout ? [[entry.date, entry.workout]] : []),
    );
    const fallbackProfile = contract.source === 'legacy_migration' && baseMicrocycle
      ? legacyMigrationFallbackProfile({
          profile: options.profile,
          microcycle: baseMicrocycle,
          contract,
        })
      : options.profile;
    const buildFallback = fallbackProfile
      ? () => require('../utils/postGenerationConstraintValidation')
          .buildSection18ProductionFallbackCandidate({
            contract,
            weekStart,
            profile: fallbackProfile,
            activeConstraints: options.activeConstraints,
          })
      : undefined;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const accepted = require('../rules/section18AcceptedWeekGateway')
      .requireSection18AcceptedWeek({
        contract,
        workouts: rebased.composedWorkouts,
        weekStart,
        profile: options.profile,
        activeFixtureDates,
        userRemovalConstraints: persistedState.userRemovalConstraints,
        regenerate: buildFallback,
        safeFallback: buildFallback,
        resolveVisibleWorkouts: (candidateWorkouts: readonly Workout[]) =>
          require('../rules/section18AcceptedWeekGateway').resolveFinalVisibleSection18Week({
            contract,
            workouts: candidateWorkouts,
            weekStart,
            profile: options.profile,
            scheduleState: { markedDays: { ...(options.markedDays ?? {}) } },
            userRemovalConstraints: persistedState.userRemovalConstraints,
          }),
      });
    const acceptedByDay = new Map<number, Workout>(
      accepted.canonicalWorkouts.map((workout: Workout) => [workout.dayOfWeek, workout]),
    );
    const overlayWorkouts = overlay ? { ...overlay.workoutsByDate } : null;
    for (let offset = 0; offset < 7; offset++) {
      const date = addDaysISO(weekStart, offset);
      const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
      const before = effectiveByDate.get(date) ?? null;
      const after = acceptedByDay.get(dayOfWeek) ?? null;
      if (JSON.stringify(before) === JSON.stringify(after)) continue;
      if (dateOverrides && Object.prototype.hasOwnProperty.call(dateOverrides, date)) {
        if (after) dateOverrides[date] = after;
        else delete dateOverrides[date];
      } else if (overlayWorkouts) {
        overlayWorkouts[date] = after;
      } else if (after) {
        dateOverrides = { ...(dateOverrides ?? {}), [date]: after };
      }
    }
    if (overlay && overlayWorkouts && weekScopedOverlays) {
      weekScopedOverlays[weekStart] = {
        ...overlay,
        workoutsByDate: overlayWorkouts,
        exposureContractV2: accepted.contract,
      };
    } else {
      // The accepted contract is the persisted ledger for a base-owned week.
      // Repairs may live in explicit date overrides, but the corresponding
      // achieved/reduction ledger must not remain stranded in the transient
      // gateway result.
      if (currentProgram && baseMicrocycle) {
        currentProgram = {
          ...currentProgram,
          microcycles: currentProgram.microcycles.map((microcycle) =>
            microcycle.id === baseMicrocycle.id
              ? { ...microcycle, exposureContractV2: accepted.contract }
              : microcycle),
        };
      }
      if (currentMicrocycle && currentMicrocycle.id === baseMicrocycle?.id) {
        currentMicrocycle = {
          ...currentMicrocycle,
          exposureContractV2: accepted.contract,
        };
      }
    }
  }
  const hydratedTodayWorkout = persistedState.todayWorkout
    ? applyUserRemovalConstraintsToWeek({
        workouts: [persistedState.todayWorkout],
        weekStart: mondayForDate(todayISOLocal()),
        constraints: persistedState.userRemovalConstraints,
      }).find((workout) =>
        workout.dayOfWeek === new Date(`${todayISOLocal()}T12:00:00`).getDay()) ?? null
    : persistedState.todayWorkout;
  return {
    ...persistedState,
    currentProgram,
    currentMicrocycle,
    todayWorkout: hydratedTodayWorkout
      ? options.programAlreadyAccepted && !safetyContractForDate(todayISOLocal())
        ? hydratedTodayWorkout
        : canonicaliseHydratedSafetyWorkout(
            hydratedTodayWorkout,
            safetyContractForDate(todayISOLocal()),
            phase,
          )
      : hydratedTodayWorkout,
    dateOverrides,
    weekScopedOverlays,
  };
}

// ─── Session Feedback ───

export type FeedbackFeeling = 'very_easy' | 'easy' | 'good' | 'hard' | 'very_hard';
export type FeedbackCompletion = 'full' | 'partial' | 'skipped';
export type FeedbackSoreness = 'none' | 'mild' | 'moderate' | 'high';
export type FeedbackPartialReason =
  | 'ran_out_of_time'
  | 'felt_sore_tight'
  | 'too_hard_today'
  | 'equipment_unavailable'
  | 'other';
export type FeedbackSkipReason =
  | 'busy_no_time'
  | 'sore_tight'
  | 'injured_niggle'
  | 'sick_low_energy'
  | 'didnt_feel_like_it'
  | 'equipment_unavailable'
  | 'other';

export interface SessionFeedbackComponent {
  componentId: string;
  kind: SessionComponentKind;
  label: string;
  completion: FeedbackCompletion;
  partialReason?: FeedbackPartialReason;
  skipReason?: FeedbackSkipReason;
}

export interface SessionFeedback {
  dateStr: string;
  completion: FeedbackCompletion;
  /**
   * Component-level completions for combined sessions. Top-level completion
   * remains as a backward-compatible aggregate only.
   */
  components?: SessionFeedbackComponent[];
  /** Session effort. Omitted for skipped sessions to avoid fake exertion data. */
  feeling?: FeedbackFeeling;
  /** RPE-style difficulty rating (1–10). Optional for backward compat. */
  difficulty?: number;
  /** Post-session soreness level. Optional for backward compat. */
  soreness?: FeedbackSoreness;
  /** Optional reason when an athlete completed only part of the session. */
  partialReason?: FeedbackPartialReason;
  /** Required reason when an athlete skips the session from the feedback form. */
  skipReason?: FeedbackSkipReason;
  /**
   * Optional performance data for trackable conditioning sessions.
   * Easy/recovery sessions intentionally keep using completion + feeling only.
   */
  conditioning?: ConditioningPerformanceLog;
  /** Main-lift snapshot captured on save for future progression/diary use. */
  strength?: StrengthExercisePerformanceLog[];
  notes?: string;
}

export interface ProgramState {
  currentProgram: TrainingProgram | null;
  currentMicrocycle: Microcycle | null;
  todayWorkout: Workout | null;
  isGenerating: boolean;
  isLoading: boolean;
  error: string | null;
  blockState: StoredProgramBlockState | null;

  /**
   * One accepted material snapshot for all inputs that can change the visible
   * Section 18 week. Calendar/readiness/constraint stores are compatibility
   * mirrors; athlete-visible projection reads this context with the program
   * surfaces published in the same ProgramStore state replacement.
   */
  acceptedMaterialContext: AcceptedMaterialContext;

  /**
   * Manual workout overrides — ONLY for explicit human/coach edits.
   *
   * Automatic adjustments (game proximity: G+1 recovery, G-1 reduction, etc.)
   * are DERIVED at read time by sessionResolver.ts, never stored here.
   *
   * Key: ISO date 'YYYY-MM-DD', Value: manually-authored Workout
   *
   * NOTE: Persisted under the key 'dateOverrides' for backward compatibility
   * with existing AsyncStorage data. The property name is 'dateOverrides' in
   * the store but semantically represents manual overrides only.
   */
  dateOverrides: Record<string, Workout>;

  /**
   * Optional structured context for each manual override.
   * Key: ISO date (same key as dateOverrides). Value: OverrideContext.
   * Used for stale-override detection — tells us WHY the override was created.
   */
  overrideContexts: Record<string, OverrideContext>;

  /**
   * System-authored week overlays.
   *
   * Used for one-off game / practice-match rebuilds: the selected week can
   * use the engine's with-game/no-game candidate without mutating the shared
   * base program template that future weeks resolve from.
   *
   * Key: Monday ISO date for the overlay week.
   */
  weekScopedOverlays: Record<string, WeekScopedWorkoutOverlay>;

  /** Persisted athlete-authored hard constraints for binned sessions/components. */
  userRemovalConstraints: UserRemovalConstraint[];

  /** Target-week contracts reconciled by explicit date-level edits. */
  exposureContractsByWeek: Record<string, WeeklyExposureContract>;

  /**
   * Session feedback — lightweight post-session capture.
   * Key: ISO date 'YYYY-MM-DD'. Value: SessionFeedback.
   * Fed into progression context on subsequent sessions.
   */
  sessionFeedback: Record<string, SessionFeedback>;

  /**
   * Per-session weight overrides — tracks what weight was actually used.
   *
   * Key: ISO date 'YYYY-MM-DD'.
   * Value: Record of exerciseId → performed weight in kg (null = bodyweight).
   *
   * NOT the same as template weights — these are per-session actuals.
   * Used by progression to determine baseline for future sessions:
   *   "Last time you did this exercise you used X kg, so today starts there."
   *
   * Never overwrites template prescriptions. Read-time only.
   */
  weightOverrides: Record<string, Record<string, number | null>>;

  setCurrentProgram: (
    program: TrainingProgram | null,
    options?: { clearOverrideDates?: readonly string[] },
  ) => void;
  setBlockState: (blockState: StoredProgramBlockState | null) => void;
  ensureBlockState: (dateISO?: string) => StoredProgramBlockState;
  setCurrentMicrocycle: (microcycle: Microcycle | null) => void;
  setTodayWorkout: (workout: Workout | null) => void;
  setGenerating: (generating: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  addExerciseToWorkout: (workoutId: string, exercise: WorkoutExercise) => void;

  /**
   * Replace an exercise in the microcycle template by dayOfWeek + name match.
   * This is a TEMPLATE edit — it changes the program itself, not a date override.
   * Used by the AI coach for single-exercise substitutions.
   */
  replaceExerciseInWorkout: (
    dayOfWeek: number,
    oldExerciseName: string,
    newExercise: WorkoutExercise,
  ) => boolean;

  /** Set a manual override for a specific date (human/coach edit only) */
  setManualOverride: (date: string, workout: Workout, context?: OverrideContext) => void;
  /** Remove a manual override for a specific date */
  removeManualOverride: (date: string) => void;
  /** Clear all manual overrides (called on full program regeneration) */
  clearManualOverrides: () => void;
  /** Dismiss a stale-override warning (user chose "keep") */
  dismissStaleWarning: (date: string) => void;

  /** Set/replace a system-authored week overlay */
  setWeekScopedOverlay: (overlay: WeekScopedWorkoutOverlay) => void;
  /** Remove a system-authored week overlay by Monday ISO key */
  removeWeekScopedOverlay: (weekStart: string) => void;
  /** Clear all system-authored week overlays */
  clearWeekScopedOverlays: () => void;

  /** Save session feedback for a date */
  setSessionFeedback: (date: string, feedback: SessionFeedback) => void;
  /** Remove feedback for a date */
  removeSessionFeedback: (date: string) => void;

  /** Set the performed weight for an exercise on a specific date */
  setWeightOverride: (date: string, exerciseId: string, weightKg: number | null) => void;
  /** Remove a weight override for an exercise on a date */
  removeWeightOverride: (date: string, exerciseId: string) => void;

  clear: () => void;
}

export const useProgramStore = create<ProgramState>()(
  persist(
    (set) => ({
      currentProgram: null,
      currentMicrocycle: null,
      todayWorkout: null,
      isGenerating: false,
      isLoading: false,
      error: null,
      blockState: null,
      acceptedMaterialContext: createEmptyAcceptedMaterialContext(),
      dateOverrides: {},
      overrideContexts: {},
      weekScopedOverlays: {},
      userRemovalConstraints: [],
      exposureContractsByWeek: {},
      sessionFeedback: {},
      weightOverrides: {},

      // Override lifecycle is NOT owned by this setter (2026-07-08).
      // It used to silently wipe dateOverrides/overrideContexts ("new
      // block = fresh slate") — which meant EVERY rebuild destroyed
      // away-day clears, injury swaps and the athlete's manual edits no
      // matter what the rebuild logic decided (the root cause of the
      // "removed Monday resurrects after adding a game" class of bug).
      // Clearing decisions now belong to the canonical sweep
      // (utils/weekRebuild.decideOverrideSweep) or an EXPLICIT
      // clearManualOverrides() where a true fresh slate is intended
      // (onboarding completion, program create, profile reset).
      setCurrentProgram: (program, options) => {
        const candidateProgram = program
          ? postValidateProgram(ensureProgramSeasonPhaseClock(program))
          : null;
        const priorState = normalizeAcceptedProgramSurfaces(useProgramStore.getState());
        const clearedDates = new Set(options?.clearOverrideDates ?? []);
        const candidateOverrides = clearedDates.size > 0
          ? Object.fromEntries(Object.entries(priorState.dateOverrides).filter(([date]) =>
              !clearedDates.has(date)))
          : priorState.dateOverrides;
        const candidateOverrideContexts = clearedDates.size > 0
          ? Object.fromEntries(Object.entries(priorState.overrideContexts).filter(([date]) =>
              !clearedDates.has(date)))
          : priorState.overrideContexts;
        const acceptedSurfaces = candidateProgram
          ? canonicaliseHydratedState({
              currentProgram: candidateProgram,
              dateOverrides: candidateOverrides,
              overrideContexts: candidateOverrideContexts,
              userRemovalConstraints: priorState.userRemovalConstraints,
            }, {
              programAlreadyAccepted: true,
              profile: require('./profileStore').useProfileStore.getState().onboardingData,
            })
          : null;
        const validatedProgram = acceptedSurfaces?.currentProgram ?? candidateProgram;
        const validatedOverrides = acceptedSurfaces?.dateOverrides ?? candidateOverrides;
        const validatedOverrideContexts = acceptedSurfaces?.overrideContexts ?? candidateOverrideContexts;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('./acceptedStateTransaction').commitAcceptedStateTransaction({
          reason: 'program:replace',
          program: {
            currentProgram: validatedProgram,
            currentMicrocycle: null,
            todayWorkout: null,
            dateOverrides: validatedOverrides,
            overrideContexts: validatedOverrideContexts,
            weekScopedOverlays: {},
            exposureContractsByWeek: {},
            blockState: validatedProgram
              ? deriveStoredBlockStateFromProgram(validatedProgram, undefined)
              : null,
          },
          programAlreadyAccepted: true,
          validateWeekStarts: validatedProgram?.microcycles.map((microcycle) =>
            microcycle.startDate.slice(0, 10)) ?? [],
        });
      },

      setBlockState: (blockState) => set({ blockState }),

      ensureBlockState: (dateISO) => {
        const state = normalizeAcceptedProgramSurfaces(useProgramStore.getState());
        if (state.blockState) return state.blockState;
        const derived = deriveStoredBlockStateFromProgram(state.currentProgram, dateISO);
        useProgramStore.setState({ blockState: derived });
        return derived;
      },

      setCurrentMicrocycle: (microcycle) => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('./acceptedStateTransaction').commitAcceptedStateTransaction({
          reason: 'program:select_microcycle',
          program: {
            currentMicrocycle: microcycle ? postValidateMicrocycle(microcycle) : null,
          },
          validateWeekStarts: microcycle ? [microcycle.startDate.slice(0, 10)] : [],
        });
      },

      setTodayWorkout: (workout) => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('./acceptedStateTransaction').commitAcceptedStateTransaction({
          reason: 'program:set_today_workout',
          program: {
            todayWorkout: workout
              ? postValidateNullableWorkout(todayISOLocal(), workout)
              : null,
          },
        });
      },

      setGenerating: (generating) => set({ isGenerating: generating }),

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),

      setManualOverride: (date, workout, context?) => {
        // Raw storage primitive. User-facing tap/coach edit paths must run
        // pre-commit risk checks before reaching this; undo/rebuild/system
        // cleanup paths intentionally keep direct access. The final active-
        // constraint validator still runs here so no producer can reintroduce
        // unsafe work after its own checks.
        const validatedWorkout = {
          ...postValidateWorkout(date, workout, {
          // A manual override is the explicit edited result. Preserve planned
          // intent for diagnostics, but never resurrect content the edit
          // deliberately removed.
            restoreMissingPlanPatterns: false,
          }),
          dayOfWeek: new Date(`${date.slice(0, 10)}T12:00:00`).getDay(),
        };
        const exposureResolution = resolveDateMutationExposureContract(date, validatedWorkout);
        const state = normalizeAcceptedProgramSurfaces(useProgramStore.getState());
        const activeRemovals = state.userRemovalConstraints.filter((constraint) =>
          constraint.status === 'active' && constraint.targetDate === date);
        const restoredAt = new Date().toISOString();
        const userRemovalConstraints = state.userRemovalConstraints.map((constraint) =>
          constraint.status === 'active' && constraint.targetDate === date
            ? {
                ...constraint,
                status: 'restored' as const,
                restoredAt,
                restorationReason: 'explicit_re_add' as const,
              }
            : constraint);
        const acceptedContext = normalizeAcceptedMaterialContext(
          useProgramStore.getState().acceptedMaterialContext,
        );
        const markedDays = { ...acceptedContext.markedDays };
        if (activeRemovals.some((constraint) => constraint.wholeDayRestOwned) &&
          markedDays[date] === 'rest') {
          delete markedDays[date];
        }
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('./acceptedStateTransaction').commitAcceptedStateTransaction({
          reason: `override:set:${date}`,
          program: {
            dateOverrides: { ...state.dateOverrides, [date]: validatedWorkout },
            exposureContractsByWeek: exposureResolution
              ? {
                  ...state.exposureContractsByWeek,
                  [exposureResolution.weekStart]: exposureResolution.contract,
                }
              : state.exposureContractsByWeek,
            overrideContexts: context
              ? { ...state.overrideContexts, [date]: context }
              : state.overrideContexts,
            userRemovalConstraints,
          },
          markedDays,
          validateWeekStarts: [mondayForDate(date)],
        });
      },

      removeManualOverride: (date) => {
        const state = normalizeAcceptedProgramSurfaces(useProgramStore.getState());
        if (!Object.prototype.hasOwnProperty.call(state.dateOverrides, date)) return;
        const weekStart = mondayForDate(date);
        const updatedOverrides = { ...state.dateOverrides };
        delete updatedOverrides[date];
        const updatedContexts = { ...state.overrideContexts };
        delete updatedContexts[date];
        const exposureContractsByWeek = { ...state.exposureContractsByWeek };
        if (!Object.keys(updatedOverrides).some((candidate) =>
          mondayForDate(candidate) === weekStart)) delete exposureContractsByWeek[weekStart];
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('./acceptedStateTransaction').commitAcceptedStateTransaction({
          reason: `override:remove:${date}`,
          program: {
            dateOverrides: updatedOverrides,
            overrideContexts: updatedContexts,
            exposureContractsByWeek,
          },
          validateWeekStarts: [weekStart],
        });
      },

      clearManualOverrides: () => {
        const state = normalizeAcceptedProgramSurfaces(useProgramStore.getState());
        const affectedWeeks = Array.from(new Set(Object.keys(state.dateOverrides).map(mondayForDate)));
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('./acceptedStateTransaction').commitAcceptedStateTransaction({
          reason: 'override:clear_all',
          program: {
            dateOverrides: {},
            overrideContexts: {},
            exposureContractsByWeek: {},
          },
          validateWeekStarts: affectedWeeks,
        });
      },

      setSessionFeedback: (date, feedback) =>
        set((state) => ({
          sessionFeedback: { ...state.sessionFeedback, [date]: feedback },
        })),

      removeSessionFeedback: (date) =>
        set((state) => {
          const updated = { ...state.sessionFeedback };
          delete updated[date];
          return { sessionFeedback: updated };
        }),

      setWeightOverride: (date, exerciseId, weightKg) =>
        set((state) => ({
          weightOverrides: {
            ...state.weightOverrides,
            [date]: {
              ...(state.weightOverrides[date] || {}),
              [exerciseId]: weightKg,
            },
          },
        })),

      removeWeightOverride: (date, exerciseId) =>
        set((state) => {
          const dateOverrides = { ...(state.weightOverrides[date] || {}) };
          delete dateOverrides[exerciseId];
          const allOverrides = { ...state.weightOverrides };
          if (Object.keys(dateOverrides).length === 0) {
            delete allOverrides[date];
          } else {
            allOverrides[date] = dateOverrides;
          }
          return { weightOverrides: allOverrides };
        }),

      dismissStaleWarning: (date) =>
        set((state) => ({
          // Write a 'dismissed' context so neither structured nor heuristic
          // detection will flag this override again. The override itself is untouched.
          overrideContexts: {
            ...state.overrideContexts,
            [date]: { intent: 'dismissed' },
          },
        })),

      setWeekScopedOverlay: (overlay) => {
        const validatedOverlay = postValidateWeekOverlay(overlay);
        const state = normalizeAcceptedProgramSurfaces(useProgramStore.getState());
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('./acceptedStateTransaction').commitAcceptedStateTransaction({
          reason: `overlay:set:${validatedOverlay.weekStart}`,
          program: {
            weekScopedOverlays: {
              ...state.weekScopedOverlays,
              [validatedOverlay.weekStart]: validatedOverlay,
            },
          },
          validateWeekStarts: [validatedOverlay.weekStart],
        });
      },

      removeWeekScopedOverlay: (weekStart) => {
        const state = normalizeAcceptedProgramSurfaces(useProgramStore.getState());
        if (!Object.prototype.hasOwnProperty.call(state.weekScopedOverlays, weekStart)) return;
        const updated = { ...state.weekScopedOverlays };
        delete updated[weekStart];
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('./acceptedStateTransaction').commitAcceptedStateTransaction({
          reason: `overlay:remove:${weekStart}`,
          program: { weekScopedOverlays: updated },
          validateWeekStarts: [weekStart],
        });
      },

      clearWeekScopedOverlays: () => {
        const state = normalizeAcceptedProgramSurfaces(useProgramStore.getState());
        const affectedWeeks = Object.keys(state.weekScopedOverlays);
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('./acceptedStateTransaction').commitAcceptedStateTransaction({
          reason: 'overlay:clear_all',
          program: { weekScopedOverlays: {} },
          validateWeekStarts: affectedWeeks,
        });
      },

      addExerciseToWorkout: (workoutId, exercise) =>
        set((state) => {
          if (!state.currentMicrocycle) return state;

          const updatedWorkouts = state.currentMicrocycle.workouts.map((w) => {
            if (w.id !== workoutId) return w;
            return {
              ...w,
              exercises: [...w.exercises, exercise],
            };
          });

          const updatedMicrocycle = postValidateMicrocycle({
            ...state.currentMicrocycle,
            workouts: updatedWorkouts,
          });

          // Also update todayWorkout if it's the same workout
          const updatedToday =
            state.todayWorkout?.id === workoutId
              ? postValidateNullableWorkout(
                  todayISOLocal(),
                  { ...state.todayWorkout, exercises: [...state.todayWorkout.exercises, exercise] },
                )
              : state.todayWorkout;

          return {
            currentMicrocycle: updatedMicrocycle,
            todayWorkout: updatedToday,
          };
        }),

      replaceExerciseInWorkout: (dayOfWeek, oldExerciseName, newExercise) => {
        const state = useProgramStore.getState();
        if (!state.currentMicrocycle) {
          logger.warn('[programStore] replaceExerciseInWorkout: no currentMicrocycle');
          return false;
        }

        const oldNameLower = oldExerciseName.toLowerCase();
        let swapped = false;

        const updatedWorkouts = state.currentMicrocycle.workouts.map((w) => {
          if (w.dayOfWeek !== dayOfWeek) return w;

          const updatedExercises = w.exercises.map((ex) => {
            const exName = (ex.exercise?.name || ex.exerciseId || '').toLowerCase();
            if (exName.includes(oldNameLower) || oldNameLower.includes(exName)) {
              swapped = true;
              logger.debug(`[programStore] Swapped "${ex.exercise?.name}" → "${newExercise.exercise?.name}" on day ${dayOfWeek}`);
              return {
                ...newExercise,
                id: ex.id, // preserve slot ID
                workoutId: ex.workoutId,
                exerciseOrder: ex.exerciseOrder,
              };
            }
            return ex;
          });

          return { ...w, exercises: updatedExercises, updatedAt: new Date().toISOString() };
        });

        if (!swapped) {
          logger.warn(`[programStore] replaceExerciseInWorkout: "${oldExerciseName}" not found on day ${dayOfWeek}`);
          return false;
        }

        const updatedMicrocycle = postValidateMicrocycle({
          ...state.currentMicrocycle,
          workouts: updatedWorkouts,
          updatedAt: new Date().toISOString(),
        });

        // Also update todayWorkout if it falls on the same dayOfWeek
        const todayDay = new Date().getDay();
        const updatedToday = todayDay === dayOfWeek
          ? postValidateNullableWorkout(
              todayISOLocal(),
              updatedMicrocycle.workouts.find((w) => w.dayOfWeek === dayOfWeek) || state.todayWorkout,
            )
          : state.todayWorkout;

        useProgramStore.setState({
          currentMicrocycle: updatedMicrocycle,
          todayWorkout: updatedToday,
        });

        return true;
      },

      clear: () => {
        set({
          currentProgram: null,
          currentMicrocycle: null,
          todayWorkout: null,
          isGenerating: false,
          isLoading: false,
          error: null,
          blockState: null,
          acceptedMaterialContext: createEmptyAcceptedMaterialContext(),
          dateOverrides: {},
          overrideContexts: {},
          weekScopedOverlays: {},
          userRemovalConstraints: [],
          exposureContractsByWeek: {},
          sessionFeedback: {},
          weightOverrides: {},
        });
      },
    }),
    {
      name: 'program-store',
      storage: createJSONStorage(() => programStateStorage),
      merge: (persisted, current) => {
        const incomingRaw = (persisted as Partial<ProgramState> | undefined) ?? {};
        const acceptedContext = normalizeAcceptedMaterialContext(incomingRaw.acceptedMaterialContext);
        const incoming = {
          ...incomingRaw,
          ...normalizeAcceptedProgramSurfaces(incomingRaw),
          acceptedMaterialContext: acceptedContext,
        };
        const readinessConstraints = acceptedContext.revision > 0
          ? Object.values(acceptedContext.readinessSignalsByDate).flatMap((signal) =>
              require('../utils/readinessConstraints').buildReadinessActiveConstraints(signal))
          : [];
        const constraintsById = new Map<string, ActiveConstraint>();
        for (const constraint of [
          ...acceptedContext.activeConstraints,
          ...readinessConstraints,
        ]) constraintsById.set(constraint.id, constraint);
        const persistedState = canonicaliseHydratedState(
          incoming,
          {
            profile: require('./profileStore').useProfileStore.getState().onboardingData,
            markedDays: acceptedContext.markedDays,
            activeConstraints: constraintsById.size > 0
              ? Array.from(constraintsById.values())
              : undefined,
            validateWeekStarts: [
              ...(incoming.currentProgram?.microcycles ?? []).map((microcycle) =>
                microcycle.startDate.slice(0, 10)),
              ...(incoming.currentMicrocycle
                ? [incoming.currentMicrocycle.startDate.slice(0, 10)]
                : []),
              ...Object.keys(incoming.weekScopedOverlays ?? {}),
            ],
          },
        );
        const merged = { ...current, ...persistedState } as ProgramState;
        if (!merged.blockState) {
          merged.blockState = deriveStoredBlockStateFromProgram(merged.currentProgram);
        }
        return merged;
      },
      onRehydrateStorage: () => (_state, error) => {
        if (error) return;
        const hydrated = useProgramStore.getState();
        // Publish the complete hydrated/migrated program and material context
        // through the same coordinator used at runtime. Legacy store hydration
        // may happen before or after this; their own hooks re-enter this
        // boundary with the staged mirror state.
        require('./acceptedStateTransaction').commitAcceptedStateTransaction({
          reason: 'program:hydration_acceptance',
          validateWeekStarts: [
            ...(hydrated.currentProgram?.microcycles ?? []).map((microcycle) =>
              microcycle.startDate.slice(0, 10)),
            ...(hydrated.currentMicrocycle
              ? [hydrated.currentMicrocycle.startDate.slice(0, 10)]
              : []),
            ...Object.keys(hydrated.weekScopedOverlays ?? {}),
          ],
        });
      },
    },
  ),
);

export function getCurrentBlockNumberForGeneration(dateISO?: string): number {
  const state = useProgramStore.getState();
  const blockState = state.blockState ?? state.ensureBlockState(dateISO);
  const targetISO = dateISO ?? new Date().toISOString().split('T')[0];
  return getBlockNumberForDate(
    blockState.blockStartDate,
    blockState.blockNumber,
    targetISO,
  );
}

/**
 * Get the most recent performed weight for an exercise (across all dates).
 * Returns undefined if the exercise has never been weight-overridden.
 *
 * Standalone function (not a store method) to avoid circular type references.
 * Used by progression to determine baseline weight for future sessions.
 */
export function getLastPerformedWeight(exerciseId: string): number | null | undefined {
  const state = useProgramStore.getState();
  const dates = Object.keys(state.weightOverrides).sort().reverse();
  for (const d of dates) {
    const exerciseWeights = state.weightOverrides[d];
    if (exerciseWeights && exerciseId in exerciseWeights) {
      return exerciseWeights[exerciseId];
    }
  }
  return undefined;
}
