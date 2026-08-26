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
import { composeDaySurfaces } from '../../rules/dayPrecedence';
import { storedGameAnchor } from '../../rules/gameAnchor';
import {
  DEV_E2E_DATE_ANCHORS,
  devE2EProgramStartForSeed,
  devE2EWeekStartForSeed,
  isDevE2ESeedId,
  type DevE2ESeedId,
} from './devE2ESeedIds';
import { DEV_E2E_STANDARD_PROFILE } from './devE2EStandardProfile';
import { semanticFingerprint } from './semanticFingerprint';

export {
  DEV_E2E_DATE_ANCHORS,
  DEV_E2E_SEED_IDS,
  devE2EWeekStartForSeed,
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
/** Monday / Tuesday / Thursday — the days already recorded Done by Friday. */
const SPENT_WEEK_DONE_OFFSETS = [0, 1, 3] as const;

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
  // spent-week-friday needs real ADJACENT weeks: half its reason to exist is
  // asking what an active fact does to the week the athlete swipes to next.
  // A single-microcycle seed answers that question with an empty week, which
  // is a seed artifact rather than a finding.
  // AND `christmas-break-ask` NEEDS FOUR FOR THE SAME REASON, MEASURED THE HARD
  // WAY. Its whole product is what happens to the weeks AFTER the break starts:
  // the athlete answers on 10 December and the club comes off from the 18th. A
  // one-week seed cannot express that — the week-forward control has nowhere to
  // go, and a flow paging into the break lands back on the week it started on.
  // **The golden flow's "team training is gone" assertion then fails against
  // the week BEFORE the break, which legitimately still has it, and reads
  // exactly like a product defect.** It is not one; it is a seed with one week.
  // AND `exercise-removal-restart` NEEDS FOUR BECAUSE THE BLOCK REQUIREMENT IS
  // A DENOMINATOR. Boot regenerates the block and derives
  // `requiredStrengthSessions` from the FOUR-week block window; a one-week seed
  // therefore installs a world whose accepted block disagrees with the one boot
  // writes over it, and the reload gate compares exactly that. Four microcycles
  // is what makes the seeded world and the booted world the same world.
  // AND `block-rollover` NEEDS ALL FOUR because its whole point is a block
  // that has genuinely ENDED: today (2026-08-10) must fall after the last
  // microcycle's Sunday, which only a full four-week block can express.
  return seedId === 'spent-week-friday' ||
    seedId === 'feedback-progression-case' ||
    seedId === 'multi-reload-fixture-chain' ||
    seedId === 'coach-production-replay' ||
    seedId === 'exercise-removal-restart' ||
    seedId === 'christmas-break-ask' ||
    seedId === 'block-rollover'
    ? 4
    : 1;
}

function stabilizeProgram(program: TrainingProgram, seedId: DevE2ESeedId): TrainingProgram {
  const result = stabilizeAuditTimestamps(clone(program));
  // The PROGRAM's own start — identical to the anchor week for every ordinary
  // seed; earlier for the two-date `block-rollover` seed (see
  // DEV_E2E_PROGRAM_START_OVERRIDES).
  const anchorDate = devE2EProgramStartForSeed(seedId);
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
      // A RENAME CARRIES ITS REFERENCES OR IT IS A DELETION.
      //
      // Row ids are rewritten below to make a seed reproducible. Anything that
      // POINTS AT a row by id has to travel with the rename, and until
      // 2026-08-12 nothing did — so `conditioningBlock.options[].exerciseIds`
      // still named the generator's ids, matched no row, and
      // `conditioningIdsFromBlock` returned an empty set. The conditioning work
      // was then filed as strength: **23 of 23 seeded workouts carrying a
      // conditioning block lost their conditioning component**, every seed, and
      // a day the generator built as "Strength + Conditioning" seeded as
      // "Strength" with the conditioning buried inside the strength part.
      //
      // THE RAW GENERATED PROGRAM IS CORRECT AND WAS MEASURED — 4 of 4 blocks
      // resolve, components read `strength, conditioning`. The loss belonged
      // entirely to this stabiliser, which is why it was invisible to every
      // suite that reads the generator and visible only by driving a seeded app.
      //
      // The map below is the whole fix: identities may change here, CONTENT may
      // never. `test:dev-e2e-seeds` holds it.
      const rowIdRewrites = new Map<string, string>();
      const exercises = workout.exercises.map((exercise, exerciseIndex) => {
        const exerciseIdentity = stableIdPart(
          exercise.exerciseId || exercise.exercise?.id || String(exerciseIndex + 1),
        );
        const stableRowId = `${workoutId}-exercise-${exerciseIdentity}-${exerciseIndex + 1}`;
        if (exercise.id) rowIdRewrites.set(String(exercise.id), stableRowId);
        return {
          ...exercise,
          id: stableRowId,
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
      });
      const conditioningBlock = workout.conditioningBlock
        ? {
            ...workout.conditioningBlock,
            options: workout.conditioningBlock.options.map((option) => ({
              ...option,
              exerciseIds: (option.exerciseIds ?? []).map(
                (rowId) => rowIdRewrites.get(String(rowId)) ?? rowId,
              ),
            })),
          }
        : workout.conditioningBlock;
      return {
        ...workout,
        id: workoutId,
        microcycleId,
        createdAt: FIXED_TIMESTAMP,
        updatedAt: FIXED_TIMESTAMP,
        exercises,
        ...(workout.conditioningBlock ? { conditioningBlock } : {}),
      };
    }),
  };
}

function deterministicProgram(
  seedId: DevE2ESeedId,
  profile: OnboardingData,
): TrainingProgram {
  const anchorDate = devE2EProgramStartForSeed(seedId);
  return stabilizeProgram(generateProgramLocally(profile, {
    // A dev seed installs a world; it is never restoring one.
    weekAcceptance: 'forward_decision',
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

/**
 * ── THE R-116 LAYOUT SHOWCASE — DEV ONLY ───────────────────────────────────
 *
 * Sam, 2026-08-20: *"create or repair a dev-only seed route containing
 * Conditioning; Team Training; a genuinely long exercise name. Do not alter
 * production programming or exercise content to manufacture screenshots."*
 *
 * ⚠ **NOTHING HERE IS INVENTED, AND THAT IS THE WHOLE POINT.** The Session
 * screen only opens for TODAY, and the deterministic week puts its conditioning
 * and its team commitment on days that are not today — so the three remaining
 * screenshots were unreachable, not missing. This seed MOVES real components
 * onto Monday; it does not author new ones:
 *
 *   - the conditioning block and its rows are lifted from the day the SAME
 *     generated week already produced them on;
 *   - the team-training row is lifted the same way;
 *   - the long name is `Half-Kneeling Single-Arm Overhead Press` — 39
 *     characters, already in the authored pool and already prescribable.
 *
 * The generator, the pools and the authored content are untouched. This is the
 * same shape `withStackedTeamUpperPull` above already uses, and it throws rather
 * than fabricating if the week does not contain what it means to move.
 */
const SHOWCASE_LONG_NAME = 'Half-Kneeling Single-Arm Overhead Press';

function withSessionLayoutShowcase(program: TrainingProgram): TrainingProgram {
  const result = clone(program);
  const week = result.microcycles[0];
  const today = week.workouts.find((workout) => workout.dayOfWeek === 1);
  if (!today || (today.exercises ?? []).length === 0) {
    throw new Error('session-layout-showcase requires a Monday session to show.');
  }

  // 1. A GENUINELY LONG NAME, on a row that already exists.
  /* A NON-POWER row, so the primer keeps its own identity and the power-first
   * ordering stays readable in the same screenshot. */
  const renamed = today.exercises.find((row) =>
    (row.exercise?.name ?? '').length > 0 && (row as { role?: string }).role !== 'power');
  if (!renamed?.exercise) {
    throw new Error('session-layout-showcase requires a named Monday row to lengthen.');
  }
  renamed.exercise = { ...renamed.exercise, name: SHOWCASE_LONG_NAME };

  /* 2. CONDITIONING — the ROWS, lifted from the day this week already put them
   *    on. Deliberately NOT `conditioningBlock`: this generator's weeks carry
   *    conditioning as `role: 'conditioning'` rows, and a block is a different
   *    (combined-day) shape it does not produce here. The Session screen's
   *    Conditioning section is driven by the rows, which is what has to appear. */
  const conditioningRows = week.workouts
    .filter((workout) => workout.dayOfWeek !== 1)
    .flatMap((workout) => (workout.exercises ?? [])
      .filter((row) => (row as { role?: string }).role === 'conditioning'))
    .slice(0, 2)
    .map((row) => ({ ...row, id: `${row.id}-showcase`, workoutId: today.id }));
  /* ⚠ **CONDITIONING IS OPTIONAL HERE, AND THAT IS A FINDING, NOT A SHORTCUT.**
   *
   * MEASURED over this seed's own generated week, both phases:
   *   in-season   Mon Team Training + strength + power, Tue/Fri strength — no
   *               `role: 'conditioning'` row anywhere, no `conditioningBlock`
   *   off-season  strength on three days, and the club nights disappear too
   *
   * So a day carrying Conditioning AND Team Training together is not something
   * athlete ANSWERS can reach on this generator's deterministic path. Writing a
   * conditioning row here would be exactly what Sam forbade — *"Do not alter
   * production programming or exercise content to manufacture screenshots."* —
   * so the seed lifts one if the week has one and shows the day honestly if it
   * does not. The Conditioning screenshot is reported as BLOCKED rather than
   * staged. */

  /* 3. TEAM TRAINING is ALREADY on this day and needed no lifting — the seed's
   *    profile answers name Monday as a club night, so the generator makes it a
   *    `Team Training` day and `getSessionComponents` gives the session its
   *    team-training component. A team night is a day's TYPE on this generator,
   *    not a row, which is why an earlier cut of this function looked for a row
   *    and threw. Measured, then corrected. */

  today.exercises = [...today.exercises, ...conditioningRows];
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
  if (seedId === 'session-layout-showcase') {
    program = withSessionLayoutShowcase(program);
  }
  return program;
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

/**
 * Tier 2 of THE ordering — `rules/dayPrecedence.ts`.
 *
 * THIS COPY WAS THE ONE THAT DISAGREED. It tested the override surface with
 * `hasOwnProperty`, where every product reader tests truthiness, so an explicit
 * `null` override meant "this day is empty" HERE and meant nothing everywhere
 * else. A witness built on that semantic can assert a state no product reader
 * would ever produce — the fixture-fidelity law (AGENTS.md) at the precedence
 * layer. Delegating deletes the divergence rather than documenting it.
 */
function effectiveWorkoutForDate(
  state: Pick<
    DevE2EWitnessState,
    'program' | 'dateOverrides' | 'weekScopedOverlays'
  >,
  date: string,
): Workout | null {
  return composeDaySurfaces({
    date,
    dateOverrides: state.dateOverrides,
    overlay: state.weekScopedOverlays?.[mondayForDate(date)] ?? null,
    base: underlyingWorkoutForDate(state.program, date),
  }).workout;
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
  if (storedGameAnchor(profile)) {
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
    // The PROGRAM's own first week — identical to the anchor week for every
    // ordinary seed. For the two-date `block-rollover` seed the program
    // deliberately does NOT cover today (that gap IS the seed), so asserting
    // the anchor week here refused the exact world the seed installs.
    weekStart: devE2EProgramStartForSeed(seedId),
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
  if (seedId === 'spent-week-friday') {
    // Sam's device profile (2026-07-24): three training days rather than the
    // standard five, so the generated week is MON strength / TUE team /
    // WED rest / THU team / FRI rest, with the Saturday fixture and Sunday
    // recovery arriving from the visible-week projection.
    return fixedProfile({
      trainingDaysPerWeek: 3,
      preferredTrainingDays: ['Monday', 'Tuesday', 'Thursday'],
    });
  }
  if (seedId === 'session-layout-showcase') {
    /* ⚠ **REAL ANSWERS, NOT ALTERED CONTENT — SAM, 2026-08-20.** *"Do not alter
     * production programming or exercise content to manufacture screenshots."*
     * So this seed changes what the ATHLETE ANSWERED at onboarding — training
     * days, team nights — and lets the real generator decide the rest. Monday is
     * a club night here, which is why today carries Team Training; the extra
     * training days are what give the week its conditioning. Every row, dose and
     * name below is the generator's. */
    return fixedProfile({
      trainingDaysPerWeek: 5,
      preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      teamTrainingDaysPerWeek: 2,
      teamTrainingDays: ['Monday', 'Thursday'],
    });
  }
  if (seedId === 'conditioning-showcase') {
    /* ⚠ **NOTHING IS ASSEMBLED HERE — THIS SEED ONLY ANSWERS ONBOARDING.**
     *
     * Sam: *"Do not hand-write an arbitrary display row. Select a real authored
     * conditioning template and pass it through the canonical production
     * materialisation/projection path."* So there is no `withConditioning...`
     * transform below and there must never be one: these are a PRE-SEASON
     * full-gym athlete's answers, and the production generator is what selects
     * the authored template, materialises its row and projects its section.
     *
     * The world was found by measurement, not guessed: this shape is the one
     * whose generated week places a conditioning row on the Monday. The
     * `session-layout-showcase` athlete's in-season week reaches none, which is
     * recorded as a programming-lane finding rather than papered over here. */
    return fixedProfile({
      seasonPhase: 'Pre-season',
      trainingDaysPerWeek: 4,
      preferredTrainingDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
      /* ⚠ THE TEAM-TRAINING ANSWERS ARE INHERITED, NOT OVERRIDDEN. Setting them
       * to zero/empty made the profile INCOMPLETE and the app refused the seed —
       * it dropped the athlete back onto the Team Training Days step, which is
       * the registry's own documented hazard: *"a profile the app would have
       * turned away"*. The standard profile's answers are a real athlete's. */
      conditioningLevel: 'Average',
      recentTrainingLoad: 'Pretty consistent',
      /* ⚠ THE CARDIO MODALITIES ARE THE WHOLE DIFFERENCE, AND IT WAS MEASURED.
       * Without them the selector has no machine and no run to offer, so
       * `conditioningFeasibility` falls back to `bodyweight_circuit` — a
       * FALLBACK LABEL, not an authored template, which is exactly the
       * "arbitrary display row" Sam forbade. Answering the equipment step the
       * way an athlete with a gym would lets the real selector reach the
       * authored `CONDITIONING_TEMPLATES`. */
      equipmentAnswer: {
        tags: {
          barbell: 'have', dumbbells: 'have', cables: 'have', machine: 'have',
          bands: 'have', bench: 'have', pullup_bar: 'have', kettlebell: 'have',
          foam_roller: 'have', plyo_box: 'have',
        },
        modalities: {
          bike_erg: 'have', air_bike: 'have', row: 'have', ski: 'have', treadmill: 'have',
        },
        answeredOn: '2026-07-13',
      },
    } as Partial<OnboardingData>);
  }
  if (seedId === 'equipment-restriction-case') {
    // `'Bodyweight Only'`, NOT `'bodyweight'` — AND THAT IS THE SAME DEFECT AS
    // THE MISSING 2KM TIME, ONE FIELD OVER.
    //
    // MEASURED 2026-08-10: this seed threw
    // `I still need to know what equipment you can train with before I can build
    // your program.` on every build. `'bodyweight'` is a TAG the resolver emits,
    // not an OPTION the athlete can pick: `tagsForChecklistOption` recognises
    // nothing, `recognized === 0`, and the source resolves to
    // `unanswered_floor` — so the generator refuses, correctly, exactly as it
    // would refuse a real person who skipped the equipment step.
    //
    // **THE SEED WAS ANSWERING IN A VOCABULARY THE APP DOES NOT ACCEPT.** The
    // app's own checklist word is `'Bodyweight Only'`
    // (`CURRENT_CHECKLIST_OPTION_TAGS`), and it maps to the same
    // `['bodyweight']` tag the witness below asserts — so the WITNESS was right
    // all along and the ANSWER was wrong.
    //
    // Recorded rather than quietly corrected because it is the second instance
    // of the class Sam warned about: a practice athlete the app would refuse.
    return fixedProfile({
      trainingLocation: 'Outdoor',
      equipmentSelectionCompleteness: 'complete',
      equipment: ['Bodyweight Only'],
    });
  }
  if (seedId === 'christmas-break-ask') {
    // ── A CLUB ATHLETE IN PRE-SEASON, ON 10 DECEMBER ──
    // `decideChristmasBreakAsk` asks the December question only when the phase
    // HAS a club season and the athlete answered team days — an off-season or
    // clubless athlete is correctly never asked, and a seed missing either half
    // would render nothing and look like the control was broken.
    // **The standard profile is In-season with Tuesday/Thursday club nights**;
    // only the phase moves, because Sam's break is *"an off season inside pre
    // season"*.
    return fixedProfile({ seasonPhase: 'Pre-season' });
  }
  return fixedProfile();
}

export function witnessesForDevE2ESeed(
  seedId: DevE2ESeedId,
  suppliedProgram?: TrainingProgram,
  suppliedProfile?: OnboardingData,
): DevE2EWitness[] {
  const anchorDate = DEV_E2E_DATE_ANCHORS[seedId];
  const weekStart = devE2EWeekStartForSeed(seedId);
  const profile = suppliedProfile ?? profileForDevE2ESeed(seedId);
  const program = suppliedProgram ?? programForSeed(seedId, profile);
  const fixtureDate = addDaysISO(weekStart, 5);
  const sundayDate = addDaysISO(weekStart, 6);
  const followingMonday = addDaysISO(weekStart, 7);
  const witnesses: DevE2EWitness[] = [
    baseWitness(seedId),
    { kind: 'profile_exact', profile },
  ];

  switch (seedId) {
    case 'standard-in-season-week':
      witnesses.push({ kind: 'calendar_mark', date: fixtureDate, mark: 'game' });
      break;
    case 'block-rollover':
      // Four REAL consecutive microcycles — the ended block the boot must
      // roll over. Nothing else is pinned: what the ROLLOVER produces is the
      // flow's question (on-glass asserts), not an install witness — a
      // witness about block 2's content would hand-build the very world the
      // app is supposed to derive.
      witnesses.push({ kind: 'accepted_week_count', minimum: 4, consecutive: true });
      break;
    case 'exercise-removal-restart': {
      // ── EVERY WITNESS HERE IS DERIVED. NONE IS HAND-BUILT. ──────────────────
      //
      // THIS IS THE WHOLE REASON THIS SEED EXISTS. `multi-reload-fixture-chain`
      // and `coach-production-replay` are both structurally correct four-week
      // worlds, and both refuse to install, because each asserts its Sunday card
      // as `visibleRecoveryWorkoutId(sundayDate)` — an id CONSTRUCTED from a
      // naming rule rather than READ from the program beside it. The generator
      // now collapses that Sunday to rest, so the seed asserts a card that does
      // not exist and the seed-rot alarm fires, correctly, forever.
      //
      // So this seed asserts only what it can read back out of the program it
      // was actually given. A witness that outlives the generator is not a
      // stricter witness, it is a broken one.
      const strengthDay = program.microcycles[0]?.workouts.find((workout) =>
        workout.exercises.some((row) => /back squat/i.test(row.exercise?.name ?? '')));
      if (!strengthDay) {
        throw new Error(
          'exercise-removal-restart requires a Back Squat session in week 1.',
        );
      }
      witnesses.push({
        kind: 'workout',
        dayOfWeek: strengthDay.dayOfWeek,
        date: addDaysISO(weekStart, (strengthDay.dayOfWeek + 6) % 7),
        surface: 'underlying',
        workoutId: strengthDay.id,
        workoutType: strengthDay.workoutType,
      });
      // Four REAL microcycles, consecutive — the property the one-week seeds
      // cannot express and the reason this seed was sanctioned.
      witnesses.push({ kind: 'accepted_week_count', minimum: 4, consecutive: true });
      // "No pre-seeded exclusion, result or removal", as an executable claim
      // rather than a sentence in a doc: no source fact of any kind, and an
      // empty reversible ledger — which is where a removal would land.
      witnesses.push(...cleanSourceFactWitnesses());
      witnesses.push({ kind: 'reversible_ledger_state', activeCount: 0, totalCount: 0 });
      break;
    }
    case 'spent-week-friday': {
      // The "week is spent" state every other seed structurally cannot reach:
      // today is FRIDAY, not the Monday anchor, and MON/TUE/THU are already
      // recorded Done. Reported by Sam on device 2026-07-24; the L10 findings
      // A3/A4/A6 were all observed from here, and no Monday-anchored seed can
      // reproduce them because on a Monday nothing is spent yet.
      witnesses.push({ kind: 'calendar_mark', date: fixtureDate, mark: 'game' });
      for (const dayOffset of SPENT_WEEK_DONE_OFFSETS) {
        const date = addDaysISO(weekStart, dayOffset);
        const workout = underlyingWorkoutForDate(program, date);
        if (!workout) {
          throw new Error(`spent-week-friday requires a session on ${date}.`);
        }
        witnesses.push({
          kind: 'workout',
          dayOfWeek: workout.dayOfWeek,
          date,
          workoutId: workout.id,
        });
        witnesses.push({
          kind: 'session_feedback',
          date,
          workoutId: workout.id,
          ...(workout.planEntryId ? { planEntryId: workout.planEntryId } : {}),
          completion: 'full',
        });
      }
      // Wednesday is the in-week rest day and stays an eligible move target —
      // the destination the A6 move-refusal repro needs to distinguish from
      // the blocked G+1 Sunday.
      witnesses.push({
        kind: 'eligible_target_date',
        date: addDaysISO(weekStart, 2),
        eligibility: 'rest_or_empty',
      });
      // Nothing reported yet: the readiness/injury findings all start from a
      // clean fact store, so "next week never changed" cannot be blamed on a
      // pre-existing fact.
      witnesses.push(...cleanSourceFactWitnesses());
      break;
    }
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
        // THE ANSWER THE ATHLETE GAVE, in the app's own checklist vocabulary —
        // see the profile above. This witness compares the profile's raw
        // `equipment` array, so it must hold the OPTION (`'Bodyweight Only'`),
        // not the TAG (`'bodyweight'`) the resolver derives from it. Holding the
        // tag here is what let a seed answering in a made-up vocabulary look
        // declared-and-correct.
        equipment: ['Bodyweight Only'],
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
    // A quiescent accepted block and nothing else: no feedback, no injury, no
    // equipment fact. The Remove slice must start from a world where the only
    // decision on record is the one the athlete is about to make.
    case 'exercise-removal-restart':
      break;
    case 'lower-body-deletion':
      break;
    case 'spent-week-friday': {
      const weekStart = devE2EWeekStartForSeed(seedId);
      for (const dayOffset of SPENT_WEEK_DONE_OFFSETS) {
        const date = addDaysISO(weekStart, dayOffset);
        const workout = underlyingWorkoutForDate(program, date);
        if (!workout) {
          throw new Error(`spent-week-friday requires a session on ${date}.`);
        }
        auxiliaryState.push({
          kind: 'session_feedback',
          date,
          workoutId: workout.id,
          ...(workout.planEntryId ? { planEntryId: workout.planEntryId } : {}),
          completion: 'full',
          feeling: 'very_easy',
          soreness: 'none',
          difficulty: 3,
        });
      }
      break;
    }
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
    return (state.injuryEpisodes?.length ?? 0) > 0 ||
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
        if (episode?.bodyPart !== witness.bodyPart ||
          episode?.severity !== witness.severity ||
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
