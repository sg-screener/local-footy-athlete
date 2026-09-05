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

/**
 * ⚠ **EVERY EPISODE, NOT JUST THE FIRST — the same lesson the feedback entries
 * already learned below.** This used to `.find` one injury, so a seed with two
 * (R-379's empty-day showcase needs BOTH regions paused, because one alone lets
 * the scheduler substitute and no day comes back empty) modelled only one and
 * its second witness failed for a harness reason, not a product one.
 *
 * `region` and `triggers` come off the seed now as well; they were hard-coded to
 * the lower-body values, which is the same reason an upper-body seed could not
 * be expressed here.
 */
function canonicalInjuryEpisodes(
  seed: DevE2ESeed,
): InjuryEpisodeV1[] {
  return seed.auxiliaryState.flatMap((item) =>
    (item.kind === 'canonical_injury_episode' ? [injuryEpisodeFrom(seed, item)] : []));
}

function injuryEpisodeFrom(
  seed: DevE2ESeed,
  injury: Extract<DevE2ESeed['auxiliaryState'][number], { kind: 'canonical_injury_episode' }>,
): InjuryEpisodeV1 {
  return {
    protocolVersion: 1,
    episodeId: injury.expectedEpisodeId,
    bodyPart: injury.bodyPart,
    region: injury.region ?? 'lower_body',
    bucket: injury.injuryKey,
    severity: injury.severity,
    status: 'active',
    onsetOrReportedDate: injury.date,
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
    resolvedAt: null,
    triggers: [...(injury.triggers ?? ['Sprinting', 'Running'])],
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

  const injuryEpisodes = canonicalInjuryEpisodes(seed);
  const injuryAuxes = seed.auxiliaryState.filter((item) =>
    item.kind === 'canonical_injury_episode');
  const equipment = seed.auxiliaryState.find((item) =>
    item.kind === 'temporary_equipment');
  // A seed may record MORE than one session as Done (spent-week-friday records
  // three), so every feedback entry has to land — not just the first.
  const feedbackEntries = seed.auxiliaryState.filter((item) =>
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
  for (const feedback of feedbackEntries) {
    if (feedback.kind !== 'session_feedback') continue;
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
    activeConstraints: [
      ...injuryAuxes.flatMap((injuryAux) =>
        (injuryAux.kind === 'canonical_injury_episode'
          ? [{
              id: injuryAux.constraintId,
              type: 'injury',
              injuryEpisodeId: injuryAux.expectedEpisodeId,
            }]
          : [])),
      ...(equipment?.kind === 'temporary_equipment'
        ? [{
            id: `equipment-temporary:${equipment.date}`,
            type: 'equipment',
            reasonLabel: 'Bodyweight only',
            mode: 'only',
            tags: ['bodyweight'],
            temporarySourceFactIds: [
              `temporary-equipment-bodyweight-only-${equipment.date}`,
            ],
          }]
        : []),
    ],
    injuryEpisodes,
    temporarySourceFacts: [
      ...injuryEpisodes,
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
