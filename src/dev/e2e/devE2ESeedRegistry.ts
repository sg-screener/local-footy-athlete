import type {
  OnboardingData,
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
import { WEEKS_PER_BLOCK } from '../../utils/programBlockState';
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
import type { ProgramControlAction } from '../../types/programControlAction';

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
  | { kind: 'program_control'; action: ProgramControlAction; todayISO: string }
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
      eligibility: 'rest_or_empty' | 'optional_or_empty';
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
  calendarMarks: Record<string, 'game' | 'practice_match' | 'rest' | 'noGame'>;
  activeConstraints: Array<{
    id: string;
    type: string;
    reasonLabel?: string;
    injuryEpisodeId?: string;
    targetDate?: string;
    moveTargetDate?: string;
    mode?: string;
    tags?: string[];
    temporarySourceFactIds?: string[];
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


function mondayForDate(dateISO: string): string {
  const day = dayOfWeekForISODate(dateISO);
  return addDaysISO(dateISO, -((day + 6) % 7));
}

function dateForWorkout(weekStart: string, workout: Workout): string {
  return addDaysISO(weekStart, (workout.dayOfWeek + 6) % 7);
}



function fixedProfile(overrides: Partial<OnboardingData> = {}): OnboardingData {
  return {
    ...clone(DEV_E2E_STANDARD_PROFILE),
    ...clone(overrides),
  };
}

function deterministicProgram(
  seedId: DevE2ESeedId,
  profile: OnboardingData,
): TrainingProgram {
  const anchorDate = devE2EProgramStartForSeed(seedId);
  const program = generateProgramLocally(profile, {
    // A dev seed installs a world; it is never restoring one.
    weekAcceptance: 'forward_decision',
    todayISO: anchorDate,
    blockNumber: 1,
    previousProgram: null,
    activeConstraints: [],
    readinessSignal: null,
    // Match normal onboarding/boot: a shortened seed changes the accepted
    // block's required-session denominator when it is reconstructed.
    microcycleLimit: WEEKS_PER_BLOCK,
  });
  // Install exactly what the real compiler produced. Seed-specific identity
  // rewrites made diagnostic worlds diverge from their own boot reconstruction.
  return program;
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



/** The showcase adds this real generated exercise through the accepted edit door. */
const SHOWCASE_LONG_NAME = 'Half-Kneeling Single-Arm Overhead Press';


function programForSeed(seedId: DevE2ESeedId, profile: OnboardingData): TrainingProgram {
  return deterministicProgram(seedId, profile);
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
    // Three available gym days with completed Mon/Tue/Thu sessions. The
    // canonical compiler may still place optional work on the spare days.
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
    return { ...fixedProfile({
      seasonPhase: 'Pre-season',
      trainingDaysPerWeek: 4,
      preferredTrainingDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
      // Zero team nights is now a valid onboarding answer. This athlete needs
      // app conditioning rather than already meeting demand through club nights.
      teamTrainingDaysPerWeek: 0,
      teamTrainingDays: [],
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
    } as Partial<OnboardingData>), gameDay: undefined, usualGameDay: undefined };
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
    { kind: 'program', programId: program.id, weekStart: devE2EProgramStartForSeed(seedId) },
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
      // Wednesday is a spare day carrying optional mobility, not a required
      // gym session or fixed anchor. Do not erase it to recreate the old seed.
      witnesses.push({
        kind: 'eligible_target_date',
        date: addDaysISO(weekStart, 2),
        eligibility: 'optional_or_empty',
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
        workoutId: stacked.id,
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
    case 'one-set-strength': {
      const row = program.microcycles[0].workouts.find(workout => workout.dayOfWeek === 1)
        ?.exercises.find(row => row.section18Evidence?.role === 'main_strength');
      if (!row) throw new Error('one-set-strength requires generated main strength');
      witnesses.push({
        kind: 'exercise_sets',
        exerciseId: row.id,
        prescribedSets: 1,
      });
      break;
    }
    case 'session-layout-showcase':
      witnesses.push({ kind: 'exercise_present', date: anchorDate,
        exerciseId: `ex-coach-add-half-kneeling-single-arm-overhead-press-${anchorDate}`,
        name: SHOWCASE_LONG_NAME });
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
        [hamstring.date, hamstring.workout.id],
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
    case 'fixture-move':
    case 'multi-reload-fixture-chain':
    case 'coach-production-replay':
    case 'midweek-signup':
    // A quiescent accepted block and nothing else: no feedback, no injury, no
    // equipment fact. The Remove slice must start from a world where the only
    // decision on record is the one the athlete is about to make.
    case 'exercise-removal-restart':
      break;
    case 'lower-body-deletion':
      break;
    case 'one-set-strength':
    case 'session-layout-showcase': {
      const oneSet = seedId === 'one-set-strength';
      const row = oneSet
        ? program.microcycles[0].workouts.find(workout => workout.dayOfWeek === 1)
          ?.exercises.find(row => row.section18Evidence?.role === 'main_strength')
        : program.microcycles[0].workouts.flatMap(workout => workout.exercises)
          .find(row => row.exercise?.name === SHOWCASE_LONG_NAME);
      if (!row?.exercise) throw new Error(`${seedId}: generated source row is missing`);
      const prescription = { name: row.exercise.name, sets: oneSet ? 1 : row.prescribedSets,
        repsMin: row.prescribedRepsMin ?? 8, repsMax: row.prescribedRepsMax ?? 8,
        weight: row.prescribedWeightKg, restSeconds: row.restSeconds };
      const common = { source: { screen: 'session_detail' as const, surface: 'dev_e2e_seed', initiatedBy: 'system' as const },
        scope: 'today_only' as const, requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true };
      auxiliaryState.push({ kind: 'program_control', todayISO: anchorDate, action: oneSet
        ? { ...common, type: 'swap_exercise', payload: { date: anchorDate,
          fromExercise: row.exercise.name, fromExerciseId: row.id, toExercise: prescription } }
        : { ...common, type: 'add_exercise', payload: { date: anchorDate, exercise: prescription } } });
      break;
    }
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
        const exercise = [...Object.values(state.dateOverrides ?? {}).filter((workout): workout is Workout => !!workout), ...workouts]
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
        const eligible = workout === null || workout.workoutType === 'Rest' ||
          (witness.eligibility === 'optional_or_empty' && workout.sessionTier === 'optional');
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
