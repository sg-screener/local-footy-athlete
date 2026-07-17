import type {
  TrainingProgram,
  Workout,
} from '../types/domain';
import type { InjuryEpisodeV1 } from '../rules/injuryEpisode';
import { createTemporaryEquipmentFact } from '../rules/temporarySourceFact';
import { createEmptyReversibleAdjustmentLedger } from '../rules/reversibleAdjustmentLedger';
import { dayOfWeekForISODate } from '../utils/appDate';
import type {
  DevE2ESeed,
  DevE2EWitnessState,
} from '../dev/e2e/devE2ESeedRegistry';

const FIXED_TIMESTAMP = '2026-07-13T12:00:00.000Z';

function isoDateParts(value: string): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) throw new Error(`Invalid test date: ${value}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function addDaysISO(dateISO: string, dayOffset: number): string {
  const [year, month, day] = isoDateParts(dateISO);
  return new Date(Date.UTC(year, month - 1, day + dayOffset, 12))
    .toISOString()
    .slice(0, 10);
}

function mondayForDate(dateISO: string): string {
  return addDaysISO(dateISO, -((dayOfWeekForISODate(dateISO) + 6) % 7));
}

function workoutForDate(program: TrainingProgram, date: string): Workout | null {
  const week = program.microcycles.find((microcycle) =>
    microcycle.startDate.slice(0, 10) === mondayForDate(date));
  return week?.workouts.find((workout) =>
    workout.dayOfWeek === dayOfWeekForISODate(date)) ?? null;
}

function visibleWorkoutForDate(
  seed: DevE2ESeed,
  dateOverrides: Record<string, Workout | null>,
  calendarMarks: Record<string, 'game' | 'rest' | 'noGame'>,
  date: string,
): Workout | null {
  if (calendarMarks[date] === 'game') {
    return {
      id: `calendar-game-${date}`,
      microcycleId: 'calendar',
      dayOfWeek: dayOfWeekForISODate(date),
      name: 'Game Day',
      description: 'Match day',
      durationMinutes: 120,
      intensity: 'High',
      workoutType: 'Game',
      sessionTier: 'core',
      exercises: [],
      createdAt: FIXED_TIMESTAMP,
      updatedAt: FIXED_TIMESTAMP,
    };
  }
  if (calendarMarks[addDaysISO(date, -1)] === 'game') {
    return {
      id: `derived-recovery-${date}`,
      microcycleId: 'calendar',
      dayOfWeek: dayOfWeekForISODate(date),
      name: 'Recovery Session',
      description: 'Post-game recovery',
      durationMinutes: 30,
      intensity: 'Light',
      workoutType: 'Recovery',
      sessionTier: 'recovery',
      exercises: [],
      createdAt: FIXED_TIMESTAMP,
      updatedAt: FIXED_TIMESTAMP,
    };
  }
  if (calendarMarks[addDaysISO(date, 1)] === 'game') {
    return {
      id: `derived-arms_pump-${date}`,
      microcycleId: 'calendar',
      dayOfWeek: dayOfWeekForISODate(date),
      name: 'Gunshow',
      description: 'Pre-game day - light upper body pump work',
      durationMinutes: 35,
      intensity: 'Light',
      workoutType: 'Strength',
      sessionTier: 'optional',
      exercises: [],
      createdAt: FIXED_TIMESTAMP,
      updatedAt: FIXED_TIMESTAMP,
    };
  }
  if (Object.prototype.hasOwnProperty.call(dateOverrides, date)) {
    return dateOverrides[date] ?? null;
  }
  return workoutForDate(seed.program, date);
}

function canonicalInjuryEpisode(
  seed: DevE2ESeed,
): InjuryEpisodeV1 | null {
  const injury = seed.auxiliaryState.find((item) =>
    item.kind === 'canonical_injury_episode');
  if (!injury || injury.kind !== 'canonical_injury_episode') return null;
  return {
    protocolVersion: 1,
    episodeId: injury.expectedEpisodeId,
    bodyPart: injury.bodyPart,
    region: 'lower_body',
    bucket: injury.injuryKey,
    severity: injury.severity,
    status: 'active',
    onsetOrReportedDate: injury.date,
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
    resolvedAt: null,
    triggers: ['Sprinting', 'Running'],
    seriousSymptoms: false,
    transitionHistory: [{
      timestamp: FIXED_TIMESTAMP,
      fromStatus: 'new',
      toStatus: 'active',
      severity: injury.severity,
      note: 'Deterministic Explorer injury seed.',
      sourceActor: 'system',
      sourceSurface: 'dev_e2e_seed',
    }],
    sourceActor: 'system',
    sourceSurface: 'dev_e2e_seed',
    affectedDates: [],
    affectedWeeks: seed.program.microcycles.map((microcycle) =>
      microcycle.startDate.slice(0, 10)),
    currentRestrictionPolicy: {
      rules: [],
      safeFocus: ['Upper-body strength and pain-free conditioning'],
      advice: ['Progress running only while symptoms stay settled'],
      severityBand: 'moderate',
      adjustmentLevel: 'moderate',
    },
    legacyMigrationStatus: 'native_v1',
    compatibility: {
      constraintId: injury.constraintId,
    },
  };
}

export function buildDevE2EWitnessState(seed: DevE2ESeed): DevE2EWitnessState {
  const calendarMarks = seed.witnesses
    .filter((witness) =>
      witness.kind === 'calendar_mark' || witness.kind === 'fixture_identity')
    .reduce<Record<string, 'game' | 'rest' | 'noGame'>>((marks, witness) => {
      marks[witness.date] = witness.kind === 'calendar_mark' ? witness.mark : 'game';
      return marks;
    }, {});
  const dateOverrides: Record<string, Workout | null> = {};
  const overrideContexts: DevE2EWitnessState['overrideContexts'] = {};
  const removable = seed.auxiliaryState.find((item) =>
    item.kind === 'removable_component_override');
  if (removable?.kind === 'removable_component_override') {
    const base = workoutForDate(seed.program, removable.date);
    if (!base) throw new Error(`Missing removable source on ${removable.date}`);
    const componentId = 'dev-e2e-removable-band-pull-apart';
    dateOverrides[removable.date] = {
      ...base,
      id: `${base.id}:dev-e2e-removable-component`,
      exercises: [{
        id: componentId,
        workoutId: base.id,
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
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP,
        },
        createdAt: FIXED_TIMESTAMP,
        updatedAt: FIXED_TIMESTAMP,
      }, ...base.exercises],
    };
    overrideContexts[removable.date] = {
      intent: 'program_adjustment',
      label: 'Dev E2E removable component',
    };
  }

  const injuryEpisode = canonicalInjuryEpisode(seed);
  const injuryAux = seed.auxiliaryState.find((item) =>
    item.kind === 'canonical_injury_episode');
  const equipment = seed.auxiliaryState.find((item) =>
    item.kind === 'temporary_equipment');
  const feedback = seed.auxiliaryState.find((item) =>
    item.kind === 'session_feedback');
  const equipmentFact = equipment?.kind === 'temporary_equipment'
    ? createTemporaryEquipmentFact({
        observedDate: equipment.date,
        scope: {
          kind: 'week',
          weekStart: equipment.date,
          from: equipment.date,
          until: addDaysISO(equipment.date, 6),
        },
        mode: 'only',
        equipmentTags: ['bodyweight'],
        sourceActor: 'system',
        sourceSurface: 'dev_e2e_seed',
        now: FIXED_TIMESTAMP,
        factId: `temporary-equipment-bodyweight-only-${equipment.date}`,
      })
    : null;
  const sessionFeedback: DevE2EWitnessState['sessionFeedback'] = {};
  if (feedback?.kind === 'session_feedback') {
    sessionFeedback[feedback.date] = {
      completion: feedback.completion,
      outcomeReceipt: {
        sessionIdentity: {
          workoutId: feedback.workoutId,
          ...(feedback.planEntryId ? { planEntryId: feedback.planEntryId } : {}),
        },
      },
    };
  }
  const acceptedRevision = seed.witnesses.find((witness) =>
    witness.kind === 'accepted_revision');
  const visibleCardDays: Record<string, unknown> = {};
  const visibleDetailDays: Record<string, unknown> = {};
  for (const witness of seed.witnesses) {
    if (witness.kind !== 'visible_card_detail_equality' &&
      witness.kind !== 'fixture_identity') continue;
    const visible = {
      date: witness.date,
      workout: visibleWorkoutForDate(
        seed,
        dateOverrides,
        calendarMarks,
        witness.date,
      ),
    };
    visibleCardDays[witness.date] = visible;
    visibleDetailDays[witness.date] = visible;
  }

  return {
    program: seed.program,
    dateOverrides,
    overrideContexts,
    weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    profile: seed.profile,
    calendarMarks,
    activeInjury: injuryAux?.kind === 'canonical_injury_episode'
      ? { bodyPart: injuryAux.bodyPart, severity: injuryAux.severity }
      : null,
    activeConstraints: [
      ...(injuryAux?.kind === 'canonical_injury_episode'
        ? [{
            id: injuryAux.constraintId,
            type: 'injury',
            injuryEpisodeId: injuryAux.expectedEpisodeId,
          }]
        : []),
      ...(equipment?.kind === 'temporary_equipment'
        ? [{
            id: `equipment-temporary:${equipment.date}`,
            type: 'equipment',
            reasonLabel: 'Bodyweight only',
          }]
        : []),
    ],
    injuryEpisodes: injuryEpisode ? [injuryEpisode] : [],
    temporarySourceFacts: [
      ...(injuryEpisode ? [injuryEpisode] : []),
      ...(equipmentFact ? [equipmentFact] : []),
    ],
    readinessSignalsByDate: {},
    sessionFeedback,
    acceptedRevision: acceptedRevision?.kind === 'accepted_revision'
      ? acceptedRevision.revision
      : 0,
    coachState: {
      transcriptCount: 0,
      memoryCount: 0,
      mutationHistoryCount: 0,
      pendingClarifier: null,
      pendingProposal: null,
    },
    visibleCardDays,
    visibleDetailDays,
  };
}
