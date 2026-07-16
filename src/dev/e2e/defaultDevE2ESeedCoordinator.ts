import { useProfileStore } from '../../store/profileStore';
import { useProgramStore } from '../../store/programStore';
import { useCalendarStore } from '../../store/calendarStore';
import { useReadinessStore } from '../../store/readinessStore';
import { useCoachStore } from '../../store/coachStore';
import { useCoachMemoryStore } from '../../store/coachMemoryStore';
import { useCoachContextStateStore } from '../../store/coachContextStateStore';
import { usePendingCoachClarifierStore } from '../../store/pendingCoachClarifierStore';
import { useCoachMutationHistoryStore } from '../../store/coachMutationHistoryStore';
import { useCoachPreferencesStore } from '../../store/coachPreferencesStore';
import { useCoachUpdatesStore } from '../../store/coachUpdatesStore';
import { useWorkoutLogStore } from '../../store/workoutLogStore';
import { useAthletePreferencesStore } from '../../store/athletePreferencesStore';
import { useUIStore } from '../../store/uiStore';
import { seedOnboardingProgram } from '../../utils/onboardingCompletion';
import { buildTemporaryEquipmentConstraint } from '../../utils/equipmentAvailability';
import {
  createOrUpdateInjuryEpisode,
} from '../../store/injuryEpisodeTransaction';
import type { ActiveInjuryConstraint } from '../../store/coachUpdatesStore';
import {
  commitSessionOutcomeTransaction,
  createRecordSessionOutcomeIntentFromFeedback,
  resolveSessionOutcomeTarget,
} from '../../store/sessionOutcomeTransaction';
import {
  buildDevE2ESeed,
  validateDevE2EWitnesses,
  type DevE2EAuxiliaryState,
  type DevE2EWitnessState,
} from './devE2ESeedRegistry';
import {
  captureDevE2EMemoryFingerprints,
  clearDevE2ECheckpoint,
  clearDevE2EScenarioSession,
  fingerprintMapsMatch,
  readDevE2ECheckpoint,
  readDevE2EScenarioSession,
  readDevE2EPersistedFingerprints,
  waitForDevE2EHydration,
  waitForDevE2EPersistence,
  writeDevE2ECheckpoint,
  writeDevE2EScenarioSession,
} from './devE2EPersistence';
import {
  DevE2ESeedCoordinator,
  type DevE2ECoordinatorDeps,
} from './DevE2ESeedCoordinator';
import {
  exportAthleteActionTraceCheckpointV2,
  clearAthleteActionDiagnosticEvents,
  resumeAthleteActionTraceCheckpointV2,
} from '../../utils/athleteActionDiagnostics';
import { buildScheduleStateImperative } from '../../utils/coachWeekDiff';
import {
  buildDayWorkoutProjectedDay,
  buildProgramTabProjectedWeek,
} from '../../utils/visibleProgramReadModel';
import { buildActiveCoachNotes } from '../../utils/activeCoachNotes';
import { semanticFingerprintV2 } from '../../utils/semanticFingerprintV2';
import type { DevE2EFingerprintMap } from './devE2EPersistence';
import {
  clearPersistedDevE2EClock,
  readActiveDevE2EClockReceipt,
  replacePersistedDevE2EClockForSeed,
} from './devE2EClockPersistence';
import { dayOfWeekForISODate, todayISOLocal } from '../../utils/appDate';
import { resolveDevE2EScenarioManifest } from './devE2EScenarioManifestRegistry';
import { defaultDevE2EScenarioEligibility } from './devE2EScenarioProtocol';
import {
  activateDevE2EScenarioRuntime,
  clearDevE2EScenarioRuntime,
  readActiveDevE2EScenarioSession,
} from './devE2EScenarioRuntime';

function clearLocalStateThroughPublicAPIs(): void {
  clearAthleteActionDiagnosticEvents();
  useCoachContextStateStore.getState().clearCoachContext();
  usePendingCoachClarifierStore.getState().clearPending();
  useWorkoutLogStore.getState().clear();
  useCoachStore.getState().clear();
  useCoachMemoryStore.getState().clearNotes();
  useCalendarStore.getState().clear();
  useReadinessStore.getState().clear();
  useCoachUpdatesStore.getState().clearAllCoachUpdates();
  useCoachMutationHistoryStore.getState().clearAll();
  useCoachPreferencesStore.getState().clearAllModalityPreferences();
  useAthletePreferencesStore.getState().clear();
  useUIStore.getState().clear();
  useProfileStore.getState().clear();
  // ProgramStore is last so no legacy mirror can republish old material.
  useProgramStore.getState().clear();
}

async function applyAuxiliaryState(
  items: readonly DevE2EAuxiliaryState[],
): Promise<void> {
  for (const item of items) {
    if (item.kind === 'canonical_injury_episode') {
      const timestamp = '2026-07-13T12:00:00.000Z';
      const constraint: ActiveInjuryConstraint = {
        id: item.constraintId,
        type: 'injury',
        bodyPart: item.bodyPart,
        bucket: item.injuryKey,
        severity: item.severity,
        status: 'active',
        source: 'coach',
        region: 'lower_body',
        severityBand: 'moderate',
        adjustmentLevel: 'moderate',
        triggers: ['Sprinting', 'Running'],
        seriousSymptoms: false,
        rules: [],
        safeFocus: ['Upper-body strength and pain-free conditioning'],
        advice: ['Progress running only while symptoms stay settled'],
        startDate: item.date,
        lastUpdatedAt: timestamp,
      };
      const result = await createOrUpdateInjuryEpisode({
        constraint,
        sourceActor: 'system',
        sourceSurface: 'dev_e2e_seed',
        note: 'Deterministic Explorer injury seed.',
        todayISO: item.date,
        now: timestamp,
      });
      if (result.episodeId !== item.expectedEpisodeId ||
        result.outcome === 'conflicted' ||
        result.outcome === 'safely_rejected') {
        throw new Error(
          `canonical_injury_seed_failed:${result.outcome}:${result.episodeId ?? 'missing'}`,
        );
      }
      continue;
    }
    if (item.kind === 'temporary_equipment') {
      const constraint = buildTemporaryEquipmentConstraint({
        presetId: item.presetId,
        date: item.date,
        todayISO: `${item.date}T12:00:00.000Z`,
        source: 'system',
      });
      useCoachUpdatesStore.getState().upsertActiveConstraint(constraint);
      continue;
    }
    if (item.kind === 'calendar_game') {
      useCalendarStore.getState().setGameDay(item.date);
      continue;
    }
    if (item.kind === 'removable_component_override') {
      const dayOfWeek = dayOfWeekForISODate(item.date);
      const state = useProgramStore.getState();
      const baseWorkout = state.currentMicrocycle?.workouts.find((workout) =>
        workout.dayOfWeek === dayOfWeek) ??
        state.currentProgram?.microcycles
          .flatMap((microcycle) => microcycle.workouts)
          .find((workout) => workout.dayOfWeek === dayOfWeek);
      if (!baseWorkout) {
        throw new Error(`removable_component_override_missing_workout:${item.date}`);
      }
      const componentId = 'dev-e2e-removable-band-pull-apart';
      useProgramStore.getState().setManualOverride(
        item.date,
        {
          ...baseWorkout,
          id: `${baseWorkout.id}:dev-e2e-removable-component`,
          exercises: [
            {
              id: componentId,
              workoutId: baseWorkout.id,
              exerciseId: componentId,
              exerciseOrder: 0,
              prescribedSets: 2,
              prescribedRepsMin: 12,
              prescribedRepsMax: 15,
              prescribedWeightKg: 0,
              restSeconds: 45,
              exercise: {
                id: componentId,
                name: 'Band Pull-Apart',
                description: 'Optional removable E2E component',
                exerciseType: 'Isolation',
                muscleGroups: [],
                equipmentRequired: ['Resistance Band'],
                difficultyLevel: 'Beginner',
                createdAt: '2026-07-13T12:00:00.000Z',
                updatedAt: '2026-07-13T12:00:00.000Z',
              },
              createdAt: '2026-07-13T12:00:00.000Z',
              updatedAt: '2026-07-13T12:00:00.000Z',
            },
            ...baseWorkout.exercises,
          ],
        },
        {
          intent: 'program_adjustment',
          label: 'Dev E2E removable component',
        },
      );
      continue;
    }
    const target = resolveSessionOutcomeTarget(item.date, item.date);
    if (target.workout.id !== item.workoutId ||
      (
        item.planEntryId !== undefined &&
        target.workout.planEntryId !== item.planEntryId
      )) {
      throw new Error(`session_feedback_seed_identity_mismatch:${item.date}`);
    }
    const intent = createRecordSessionOutcomeIntentFromFeedback({
      date: item.date,
      workout: target.workout,
      feedback: {
        dateStr: item.date,
        completion: item.completion,
        feeling: item.feeling,
        soreness: item.soreness,
        difficulty: item.difficulty,
      },
      source: {
        entryPoint: 'tap',
        surface: 'dev_e2e_seed',
        interpretedIntent: 'record_session_outcome',
        traceId: `dev-e2e-session-feedback:${item.date}:${item.workoutId}`,
      },
      todayISO: item.date,
    });
    const result = await commitSessionOutcomeTransaction(intent);
    if (!result.ok) {
      throw new Error(`session_feedback_seed_failed:${result.code}`);
    }
  }
}

function readWitnessState(): DevE2EWitnessState {
  const program = useProgramStore.getState();
  const updates = useCoachUpdatesStore.getState();
  const accepted = program.acceptedMaterialContext;
  const schedule = buildScheduleStateImperative();
  const todayISO = todayISOLocal();
  const visibleCardDays: Record<string, unknown> = {};
  const visibleDetailDays: Record<string, unknown> = {};
  const weekStarts = program.currentProgram?.microcycles.map((microcycle) =>
    microcycle.startDate.slice(0, 10)) ?? [];
  for (const weekStart of weekStarts) {
    const cardDays = buildProgramTabProjectedWeek({
      mondayISO: weekStart,
      todayISO,
      state: schedule,
      overrideContexts: program.overrideContexts,
    });
    for (const day of cardDays) {
      visibleCardDays[day.date] = day;
      visibleDetailDays[day.date] = buildDayWorkoutProjectedDay({
        date: day.date,
        todayISO,
        state: schedule,
        overrideContext: program.overrideContexts[day.date],
      });
    }
  }
  return {
    program: program.currentProgram,
    dateOverrides: program.dateOverrides,
    overrideContexts: program.overrideContexts,
    weekScopedOverlays: program.weekScopedOverlays,
    userRemovalConstraints: program.userRemovalConstraints,
    reversibleAdjustmentLedger: program.reversibleAdjustmentLedger,
    profile: useProfileStore.getState().onboardingData,
    calendarMarks: useCalendarStore.getState().markedDays,
    activeInjury: updates.activeInjury,
    activeConstraints: updates.activeConstraints,
    injuryEpisodes: accepted.injuryEpisodes,
    temporarySourceFacts: accepted.temporarySourceFacts,
    readinessSignalsByDate: accepted.readinessSignalsByDate,
    sessionFeedback: program.sessionFeedback,
    acceptedRevision: accepted.revision,
    coachState: {
      transcriptCount:
        useCoachStore.getState().messages.length +
        useCoachStore.getState().conversations.length,
      memoryCount: useCoachMemoryStore.getState().notes.length,
      mutationHistoryCount: useCoachMutationHistoryStore.getState().entries.length,
      pendingClarifier: usePendingCoachClarifierStore.getState().pending,
      // Pending Coach proposals are screen-local and non-persisted. A Dev E2E
      // launch starts before CoachScreen creates that ref, so the reset
      // protocol's durable state has no proposal to restore.
      pendingProposal: null,
    },
    visibleCardDays,
    visibleDetailDays,
  };
}

function captureReloadEvidence(
  memory: DevE2EFingerprintMap,
  persisted: DevE2EFingerprintMap,
) {
  const program = useProgramStore.getState();
  const context = program.acceptedMaterialContext;
  const weeks = Array.from(new Set([
    ...(program.currentProgram?.microcycles ?? []).map((microcycle) =>
      microcycle.startDate.slice(0, 10)),
    ...(program.currentMicrocycle ? [program.currentMicrocycle.startDate.slice(0, 10)] : []),
    ...Object.keys(program.weekScopedOverlays ?? {}),
  ])).sort();
  const todayISO = program.currentMicrocycle?.startDate.slice(0, 10) ??
    program.currentProgram?.startDate.slice(0, 10) ??
    '1970-01-01';
  const schedule = buildScheduleStateImperative();
  const cardDays = weeks.flatMap((mondayISO) => buildProgramTabProjectedWeek({
    mondayISO,
    todayISO,
    state: schedule,
    overrideContexts: program.overrideContexts,
  }));
  const detailDays = cardDays.map((day) => buildDayWorkoutProjectedDay({
    date: day.date,
    todayISO,
    state: schedule,
    overrideContext: program.overrideContexts[day.date],
  }));
  const notes = buildActiveCoachNotes(context.activeConstraints, context.activeInjury);
  return {
    accepted: { fingerprints: memory, fingerprint: semanticFingerprintV2(memory) },
    persisted: { fingerprints: persisted, fingerprint: semanticFingerprintV2(persisted) },
    visible: {
      cardFingerprint: semanticFingerprintV2(cardDays),
      detailFingerprint: semanticFingerprintV2(detailDays),
    },
    coachNotes: {
      ownershipFingerprint: semanticFingerprintV2(notes.map((note) => ({
        id: note.id,
        constraintId: note.constraintId,
        modifierId: note.modifierId,
      }))),
      renderedCardIds: notes.map((note) => note.id).sort(),
    },
    acceptedRevision: context.revision,
    verified: true,
  };
}

const DEFAULT_DEPS: DevE2ECoordinatorDeps = {
  waitForHydration: waitForDevE2EHydration,
  resetLocalState: clearLocalStateThroughPublicAPIs,
  clearClock: clearPersistedDevE2EClock,
  installClock: replacePersistedDevE2EClockForSeed,
  readClockReceipt: readActiveDevE2EClockReceipt,
  readTodayISO: todayISOLocal,
  waitForPersistence: waitForDevE2EPersistence,
  buildSeed: buildDevE2ESeed,
  writeProfile: (seed) => useProfileStore.getState().updateOnboardingData(seed.profile),
  installProgram: (seed) => seedOnboardingProgram({
    onboardingData: seed.profile,
    program: seed.program,
  }),
  applyAuxiliaryState,
  completeOnboarding: () => useProfileStore.getState().completeOnboarding(),
  readWitnessState,
  validateWitnesses: validateDevE2EWitnesses,
  captureMemoryFingerprints: captureDevE2EMemoryFingerprints,
  fingerprintMapsMatch,
  writeCheckpoint: writeDevE2ECheckpoint,
  readCheckpoint: readDevE2ECheckpoint,
  readPersistedFingerprints: readDevE2EPersistedFingerprints,
  clearCheckpoint: clearDevE2ECheckpoint,
  writeScenarioSession: writeDevE2EScenarioSession,
  readScenarioSession: readDevE2EScenarioSession,
  clearScenarioSession: clearDevE2EScenarioSession,
  resolveScenarioManifest: resolveDevE2EScenarioManifest,
  evaluateScenarioEligibility: defaultDevE2EScenarioEligibility,
  activateScenarioSession: activateDevE2EScenarioRuntime,
  readActiveScenarioSession: readActiveDevE2EScenarioSession,
  clearScenarioRuntime: clearDevE2EScenarioRuntime,
  captureUnfinishedAthleteActionTraces: exportAthleteActionTraceCheckpointV2,
  resumeAthleteActionTraces: resumeAthleteActionTraceCheckpointV2,
  captureReloadEvidence,
};

export function createDefaultDevE2ESeedCoordinator(isDev: boolean): DevE2ESeedCoordinator {
  return new DevE2ESeedCoordinator(isDev, DEFAULT_DEPS);
}
