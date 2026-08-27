/** Compiler-owned progression: explicit recorded inputs, private working copy.
 * Preserves authored-set baseline → strength freeze → boundary load → earned
 * sets → conditioning reduction/advance → volume. No store reads or writes.
 */
import type { TrainingProgram, Workout, OnboardingData } from '../types/domain';
import type { SessionFeedback } from '../store/programStore';
import { resolveWeek, getEffectiveGameDates, type ResolvedDay, type ScheduleState } from '../utils/sessionResolver';
import { applyStrengthProgression, buildStrengthWorkoutHistoryFromFeedback, buildProgressionContext, deriveMissedStrengthSessionsThisWeek, workoutHasProgressableStrengthRows } from '../utils/strengthProgressionIntegration';
import { findMatchingFeedback, deriveAdaptation } from '../utils/feedbackAdapter';
import { getStoredBlockStateForDate, getProgramBlockStateForDate, selectMicrocycleForDate, previousBlockBoundsISO } from '../utils/programBlockState';
import { attachPrescriptionEffectEvidence, buildPrescriptionEffectEvidence } from '../utils/deterministicCoachNoteFactory';
import { applyBlockBoundaryConditioning, applyBlockBoundaryProgression, applyBlockBoundarySetAdditions, applyBlockBoundaryVolume, buildBlockBoundaryExplanation, buildBlockBoundaryReductionExplanation, applyBlockBoundaryConditioningAdvance, decideBlockBoundaryConditioning, decideBlockBoundaryConditioningAdvance, decideBlockBoundaryLoads, decideBlockBoundarySetAdditions, decideBlockBoundaryVolume, readBlockHistory, snapshotAuthoredSets, type BlockBoundaryConditioningAdvance, type BlockBoundaryConditioningDecision, type BlockBoundaryLiftDecision, type BlockBoundaryVolumeDecision } from './blockBoundaryProgression';


/**
 * Build a map of exerciseId → last performed weight from weight overrides.
 * Only considers dates strictly before `beforeDate`.
 * Returns an empty record if no overrides exist.
 */
function buildLastPerformedWeights(
  allOverrides: Record<string, Record<string, number | null>>,
  beforeDate: string,
): Record<string, number | null> {
  const result: Record<string, number | null> = {};
  // Walk dates in reverse chronological order
  const dates = Object.keys(allOverrides).filter(d => d < beforeDate).sort().reverse();
  for (const d of dates) {
    const exerciseWeights = allOverrides[d];
    for (const [exId, weight] of Object.entries(exerciseWeights)) {
      // Only take the most recent for each exercise
      if (!(exId in result)) {
        result[exId] = weight;
      }
    }
  }
  return result;
}


/**
 * Resolve a full week with conditioning and recovery placement.
 *
 * Three-pass approach:
 *   Pass 1: Resolve all 7 days normally (strength templates, game proximity, overrides).
 *   Pass 2: Walk Mon→Sun. For each empty day within the active block,
 *           try conditioning placement via the rule engine. Earlier days'
 *           placements feed into later days' WeekLog (progressive accumulation).
 *   Pass 3: Walk Mon→Sun again. For each STILL-empty day within the block,
 *           try recovery placement. Recovery never coexists with strength
 *           or conditioning on the same day. Uses readiness-based category
 *           selection (passive / active / extended) with frequency guards.
 *
 * Resolution order: Strength → Conditioning → Recovery fills gaps.
 * Each pass is additive — never displaces prior passes.
 *
 * If no seasonPhase is available (pre-onboarding), passes 2 and 3 are skipped.
 */
/**
 * Materialise strength progression for a resolved week (AUTHORING step).
 *
 * Applies the progression engine to a private copy of template/manual days.
 * This is the *authoring / acceptance-time* computation:
 * it used to run on every read inside resolveWeekWithConditioning, which made
 * loads drift on each resolution and let mutations snapshot a re-progressed
 * value. Under the §18 ownership redesign (stage 1) it is invoked once when a
 * week is authored / accepted, and resolution merely projects the frozen
 * result. Exported so authoring paths and progression tests drive it directly.
 */
export function compileCanonicalResolvedStrengthWeek(
  inputDays: readonly ResolvedDay[],
  state: ScheduleState,
  gameDates: string[],
): ResolvedDay[] {
  const baseDays: ResolvedDay[] = JSON.parse(JSON.stringify(inputDays));
  const injuries = (state.athleteContext?.injuries || []).map(i => ({
    bodyArea: i.bodyArea,
    severity: i.severity,
  }));

  const feedbackMap = state.sessionFeedback || {};
  const allFeedbackSorted: SessionFeedback[] = Object.values(feedbackMap)
    .sort((a: SessionFeedback, b: SessionFeedback) => b.dateStr.localeCompare(a.dateStr));

  // Build a workout-type-by-date map for session type matching.
  // Uses resolved base days + template workouts to map dates → workoutType.
  const workoutByDate: Record<string, Workout> = {};
  for (const day of baseDays) {
    if (day.workout) {
      workoutByDate[day.date] = day.workout;
    }
  }
  // Also include historical dates from feedback that have no resolved day
  // (previous weeks). Use the workout name/type from the template by dayOfWeek.
  if (state.currentMicrocycle) {
    for (const fb of allFeedbackSorted) {
      const fbMicrocycle = selectMicrocycleForDate(
        state.currentProgram,
        state.currentMicrocycle,
        fb.dateStr,
      );
      if (!workoutByDate[fb.dateStr] && fbMicrocycle?.workouts) {
        const [fy, fm, fd] = fb.dateStr.split('-').map(Number);
        const fbDate = new Date(fy, fm - 1, fd);
        const fbDow = fbDate.getDay();
        const matchingWorkout = fbMicrocycle.workouts.find(
          (w: Workout) => w.dayOfWeek === fbDow
        );
        if (matchingWorkout) {
          workoutByDate[fb.dateStr] = matchingWorkout;
        }
      }
    }
  }

  for (let i = 0; i < baseDays.length; i++) {
    const day = baseDays[i];
    const governingWeek = selectMicrocycleForDate(
      state.currentProgram, state.currentMicrocycle, day.date,
    );
    // Compiler-controlled dose is already materialised. Progression cannot
    // add work back or run its old drop-two/70%-load reduction over it.
    if (governingWeek?.dosePolicyByDay?.[day.dayOfWeek]) continue;
    if (
      day.workout &&
      workoutHasProgressableStrengthRows(day.workout) &&
      (day.source === 'template' || day.source === 'manual')
    ) {
      // Recent feedback before this date — for per-day pattern analysis
      const priorFeedback = allFeedbackSorted.filter(
        (fb: SessionFeedback) => fb.dateStr < day.date
      );
      const lastFeedbackFeeling = priorFeedback.length > 0
        ? (priorFeedback[0].feeling as any) || null
        : null;

      // Session-type-matched adaptation (from new difficulty/soreness fields)
      const matchedFeedback = findMatchingFeedback(
        day.workout,
        feedbackMap,
        workoutByDate,
        day.date,
      );
      const adaptation = deriveAdaptation(matchedFeedback);
      const blockState = state.blockState
        ? getStoredBlockStateForDate(
            state.blockState,
            day.date,
            state.seasonPhase,
            state.currentProgram?.seasonPhaseClock,
          )
        : state.currentProgram
          ? getProgramBlockStateForDate({
            dateISO: day.date,
            programStartISO: state.currentProgram.startDate,
            seasonPhase: state.seasonPhase,
            seasonPhaseClock: state.currentProgram.seasonPhaseClock,
          })
          : undefined;

      const providedWorkoutHistory = (state.workoutHistory ?? [])
        .filter((workout) => workout.loggedDate < day.date)
        .sort((a, b) => b.loggedDate.localeCompare(a.loggedDate));
      const feedbackWorkoutHistory = buildStrengthWorkoutHistoryFromFeedback(
        feedbackMap,
        day.date,
      );
      const workoutHistory = [...providedWorkoutHistory, ...feedbackWorkoutHistory]
        .sort((a, b) => b.loggedDate.localeCompare(a.loggedDate));
      const missedSessionsThisWeek = deriveMissedStrengthSessionsThisWeek(
        feedbackMap,
        day.date,
      );

      const progressionCtx = buildProgressionContext(
        state.seasonPhase!,
        state.capacity || 'medium',
        gameDates,
        day.date,
        injuries,
        state.markedDays || {},
        workoutHistory,
        lastFeedbackFeeling,
        priorFeedback.slice(0, 4), // analysis window for pattern biases
        adaptation.explanation ? adaptation : null,
        { blockState, missedSessionsThisWeek },
      );

      // Build last-performed-weight map from weight overrides (dates before today)
      const lastPerformedWeights = buildLastPerformedWeights(
        state.weightOverrides || {},
        day.date,
      );

      let progressedWorkout: Workout = applyStrengthProgression(
        day.workout,
        progressionCtx,
        Object.keys(lastPerformedWeights).length > 0 ? lastPerformedWeights : undefined,
      );

      if (adaptation.explanation) {
        const adaptationReason = adaptation.volumeAdjustment < 0
          ? 'adaptation_reduced'
          : adaptation.volumeAdjustment > 0
            ? 'adaptation_increased'
            : 'adaptation_held';
        progressedWorkout = attachPrescriptionEffectEvidence(
          progressedWorkout,
          buildPrescriptionEffectEvidence({
            seed: {
              kind: 'progression_adaptation',
              reason: adaptationReason,
              ownerKey: `session-feedback:${matchedFeedback?.dateStr ?? day.date}:${day.workout.workoutType}`,
            },
            before: day.workout.exercises,
            after: progressedWorkout.exercises,
          }),
        );
      }

      // Attach adaptation explanation as metadata for UI consumption
      if (adaptation.explanation) {
        (progressedWorkout as any)._adaptationExplanation = adaptation.explanation;
      }

      baseDays[i] = {
        ...day,
        workout: progressedWorkout,
      };
    }
  }

  return baseDays;
}


/**
 * Author a week's strength progression (AUTHORING/acceptance entry point).
 *
 * Resolves the base week, then materialises strength progression into it and
 * returns the progressed days. This is the single seam that should run once
 * when a week is authored / accepted (its result is then stored and merely
 * projected by resolveWeekWithConditioning). It reproduces exactly what the
 * old read-time progression pass computed for a given ScheduleState — so
 * progression itself is unchanged; only *when* it runs has moved.
 */
export function compileCanonicalStrengthWeek(
  mondayStr: string,
  state: ScheduleState,
): ResolvedDay[] {
  const baseDays = resolveWeek(mondayStr, state);
  const gameDates: string[] = [];
  getEffectiveGameDates(state, mondayStr).forEach((d) => gameDates.push(d));
  return compileCanonicalResolvedStrengthWeek(baseDays, state, gameDates);
}


/**
 * Bake strength progression into a program's stored microcycles (AUTHORING).
 *
 * Runs once at generation so the stored week already carries its progressed
 * loads; resolution then merely projects them. This replaces the retired
 * read-time progression pass as the place progression is applied to a freshly
 * authored program. Mutates each microcycle's workouts in place.
 */
function materialiseBlockStrength(
  program: TrainingProgram,
  state: Omit<ScheduleState, 'currentProgram' | 'currentMicrocycle'>,
): void {
  for (const microcycle of program.microcycles) {
    const weekStart = microcycle.startDate.slice(0, 10);
    const authored = compileCanonicalStrengthWeek(weekStart, {
      ...state,
      currentProgram: program,
      currentMicrocycle: microcycle,
    });
    const progressedById = new Map<string, Workout>();
    for (const day of authored) {
      if (day.workout) progressedById.set(day.workout.id, day.workout);
    }
    microcycle.workouts = microcycle.workouts.map(
      (workout) => progressedById.get(workout.id) ?? workout,
    );
  }
}


/**
 * The Monday a microcycle starts on, as `YYYY-MM-DD`.
 *
 * `Microcycle.startDate` is stored as a full timestamp and the conditioning
 * owner wants a plain day string, so it is narrowed here rather than at the call
 * site. Falls back to counting weeks off the block start when a microcycle
 * carries no date at all — the same grid the caller already owns, never a fresh
 * one derived from today.
 */
function microcycleStartISO(
  microcycle: { startDate?: string | Date },
  blockStartISO: string,
  weekIndex: number,
): string {
  const stored = microcycle.startDate;
  if (typeof stored === 'string' && stored.length >= 10) return stored.slice(0, 10);
  const start = new Date(`${blockStartISO}T12:00:00`);
  start.setDate(start.getDate() + weekIndex * 7);
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
}
export interface CanonicalProgramProgressionInput {
  readonly program: TrainingProgram;
  readonly state: Omit<ScheduleState, 'currentProgram' | 'currentMicrocycle'>;
  readonly profile: OnboardingData;
  readonly blockStartISO: string;
  /** Recorded generation input, not the date on which reconstruction runs. */
  readonly asOfISO: string;
  readonly blockNumber: number;
  readonly previousRequiredStrengthSessions: number;
}
export function compileCanonicalProgramProgression(input: CanonicalProgramProgressionInput): TrainingProgram {
  const program: TrainingProgram = JSON.parse(JSON.stringify(input.program));
  const authoredSetsByRowId = snapshotAuthoredSets(program.microcycles);
  // Reconstruct the accepted build, not a new build using results recorded
  // since it. Later results feed the next acceptance; restart is not one.
  const progressionSessionFeedback = Object.fromEntries(Object.entries(input.state.sessionFeedback ?? {})
    .filter(([, feedback]) => feedback.dateStr < input.asOfISO));
  const progressionState = {
    ...input.state,
    sessionFeedback: progressionSessionFeedback,
    weightOverrides: Object.fromEntries(Object.entries(input.state.weightOverrides ?? {})
      .filter(([date]) => date < input.asOfISO)),
    workoutHistory: (input.state.workoutHistory ?? []).filter((workout) => workout.loggedDate < input.asOfISO),
  };
  materialiseBlockStrength(program, progressionState);
  const authoringBlockNumber = input.blockNumber;
  if (authoringBlockNumber > 1) {
    const allDecisions: BlockBoundaryLiftDecision[] = [];
    const allConditioningAdvances: BlockBoundaryConditioningAdvance[] = [];
    const previousBlock = previousBlockBoundsISO(input.blockStartISO);
    const history = readBlockHistory({
      feedbackByDate: progressionSessionFeedback,
      blockStartISO: previousBlock.startISO,
      blockEndISO: previousBlock.endISO,
      // The same recorded requirement the rotation read above uses, keyed on the
      // same window, so one athlete cannot be rotated off one denominator and
      // progressed off another.
      requiredStrengthSessions:
        input.previousRequiredStrengthSessions,
    });
    const allVolumeDecisions: BlockBoundaryVolumeDecision[] = [];
    const allConditioningDecisions: BlockBoundaryConditioningDecision[] = [];
    for (const [weekIndex, microcycle] of program.microcycles.entries()) {
      const decisions = decideBlockBoundaryLoads({
        history,
        nextBlockWorkouts: microcycle.workouts,
        // PRIORITY 2 needs the athlete's own squat/bench answers — the authored
        // anchor estimate is a function of them, and of nothing the outgoing
        // exercise knows.
        onboardingData: input.profile,
      });
      microcycle.workouts = applyBlockBoundaryProgression({
        workouts: microcycle.workouts,
        decisions,
      });
      for (const decision of decisions) allDecisions.push(decision);

      // ── THE LADDER'S SECOND RUNG — ONE SET, ONLY WHERE LOAD DID NOT MOVE ──
      //
      // ORDER IS THE CONTRACT'S: *"1. Increase load... 2. Add one set when more
      // volume is appropriate and the session remains inside its approved cap."*
      // It runs AFTER the load pass because it is fed that pass's decisions —
      // *"do not increase load and sets on the same exercise in the same
      // rollover"* is only answerable once the load rung has been decided.
      //
      // It is a no-op on every block that is not well-completed AND
      // well-recovered AND tolerated in the strength quality, so the ordinary
      // and the beaten-up athlete both reach the reduction below unchanged.
      const setAdditions = decideBlockBoundarySetAdditions({
        history,
        nextBlockWorkouts: microcycle.workouts,
        weekIndex,
        ...(microcycle.weekKind !== undefined ? { weekKind: microcycle.weekKind } : {}),
        loadDecisions: decisions,
        authoredSetsByRowId,
        // In-season maintains — the set rung is closed there (Bible §5/§16).
        seasonPhase: input.state.seasonPhase ?? null,
      });
      microcycle.workouts = applyBlockBoundarySetAdditions({
        workouts: microcycle.workouts,
        decisions: setAdditions,
      });
      // ── THE REDUCTION, ON A BLOCK THE ATHLETE SAID WAS VERY HARD ──
      //
      // ORDER IS THE CONTRACT'S, NOT AN IMPLEMENTATION CONVENIENCE. Its "Low
      // readiness or high soreness" list is: hard conditioning first, then main-
      // and secondary-lift sets, then easier aerobic work in place of what was
      // removed. Conditioning is decided and applied before volume so that the
      // one thing the contract cuts FIRST is the one thing that cannot be
      // starved by a volume pass that ran ahead of it.
      //
      // Both are no-ops unless `history.reduces` — the decision functions
      // return an empty list for every other verdict, so the ordinary
      // well-recovered block reaches `return program` having changed nothing
      // here.
      const conditioningDecisions = decideBlockBoundaryConditioning({
        history,
        nextBlockWorkouts: microcycle.workouts,
        weekIndex,
      });
      microcycle.workouts = applyBlockBoundaryConditioning({
        workouts: microcycle.workouts,
        decisions: conditioningDecisions,
        seedISO: microcycleStartISO(microcycle, input.blockStartISO, weekIndex),
        miniCycleNumber: weekIndex + 1,
      });
      for (const decision of conditioningDecisions) allConditioningDecisions.push(decision);

      // ── WC-137: THE OTHER DIRECTION, AT THE SAME BOUNDARY ────────────────
      //
      // Conditioning easy while strength was difficult -> exactly one authored
      // step. It runs AFTER the reduce pass on purpose: `reduces` and
      // `conditioningEasy` can both be true of one block, and reduce outranks
      // advance. The decider refuses that combination itself, so this ordering
      // is belt to that braces rather than the only thing stopping it.
      const conditioningAdvances = decideBlockBoundaryConditioningAdvance({
        history,
        nextBlockWorkouts: microcycle.workouts,
        weekIndex,
        phase: input.profile.seasonPhase,
      });
      microcycle.workouts = applyBlockBoundaryConditioningAdvance({
        workouts: microcycle.workouts,
        advances: conditioningAdvances,
      });
      for (const advance of conditioningAdvances) allConditioningAdvances.push(advance);

      const volumeDecisions = decideBlockBoundaryVolume({
        history,
        nextBlockWorkouts: microcycle.workouts,
        authoredSetsByRowId,
      });
      microcycle.workouts = applyBlockBoundaryVolume({
        workouts: microcycle.workouts,
        decisions: volumeDecisions,
      });
      for (const decision of volumeDecisions) allVolumeDecisions.push(decision);
    }
    // Stored beside the prescriptions it explains, so the two cannot drift.
    const reduction = buildBlockBoundaryReductionExplanation({
      history,
      loadDecisions: allDecisions,
      volumeDecisions: allVolumeDecisions,
      conditioningDecisions: allConditioningDecisions,
    });
    program.blockBoundaryExplanation = [
      // THE REDUCTION ROW LEADS. It is the block-level answer to "what happened
      // to my programme"; the per-lift load rows are its detail.
      ...(reduction ? [reduction] : []),
      ...buildBlockBoundaryExplanation(allDecisions),
    ];
  }


  return program;
}
