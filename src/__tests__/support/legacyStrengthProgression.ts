/** Historical per-session progression model. Test-only; never an app writer. */
import type {
  Workout,
  WorkoutExercise,
  SeasonPhase,
  CapacityBand,
  SessionFeeling,
  LoggedWorkout,
  LoggedSet,
} from '../../types/domain';
import { EXERCISE_TAGS, type ExerciseTag, type Region } from '../../data/exerciseTags';
import {
  resolveProgression,
  type ProgressionInput,
  type ProgressionOutput,
  type ProgressionState,
} from '../../utils/progressionRules';
import {
  type ExerciseRole,
  type CompletionQuality,
  type TrendSignal,
  feelingToRPE,
  deriveTrend,
  extractExposureHistory,
  extractSlotExposureHistory,
  deriveCompletionQuality,
  countConsecutiveBuildWeeks,
  estimateWeeksSinceDeload,
} from '../../utils/progressionHelpers';
import type { FeedbackCompletion, FeedbackFeeling, SessionFeedback } from '../../store/programStore';
import { analyzeFeedbackPatterns, applyPatternBiases } from '../../utils/feedbackPatterns';
import { type AdaptationResult, adaptationReportsFatigue } from '../../utils/feedbackAdapter';
import type { ProgramBlockState } from '../../utils/programBlockState';
import { participatesInCounting } from '../../rules/sessionRowCounting';
import { mainLiftSchemeForSlot, type RepScheme } from '../../rules/phaseRepSchemes';
import type { OffseasonSubphase } from '../../rules/offseasonSubphase';
import { normaliseAutomaticExerciseLoadChange } from '../../utils/loadEstimation';


import { rowCanReceiveStrengthProgression, classifyProgressionEligibility, isLowerBodyExercise, workoutHasProgressableStrengthRows, feedbackFeelingToSessionFeeling, deriveMissedStrengthSessionsThisWeek, buildStrengthWorkoutHistoryFromFeedback, DEFAULT_PROGRESSION_CONTEXT, type StrengthProgressionContext, type BuildProgressionContextOptions } from '../../utils/strengthProgressionIntegration';
export * from '../../utils/strengthProgressionIntegration';
/**
 * When a pool-managed exercise has no direct lastPerformedWeight entry
 * (typical for a first-block-after-rotation exercise), look for any
 * sibling in the same (slot, role) that has one. Return the sibling's
 * weight normalized to the target via load ratios.
 *
 * Returns undefined if no sibling has a logged weight, or if the target
 * isn't pool-managed (caller already handled direct lookup).
 *
 * Uses require() to avoid a top-level circular dependency with
 * defaultProgram.ts (which imports this module indirectly via the
 * pool system).
 */
function resolveSiblingPerformedWeight(
  targetName: string,
  lastPerformedWeights: Record<string, number | null>,
): number | null | undefined {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pools = require('../../data/exercisePoolsStrength') as typeof import('../../data/exercisePoolsStrength');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const program = require('../../data/defaultProgram') as typeof import('../../data/defaultProgram');

  const hit = pools.findPoolEntry(targetName);
  if (!hit) return undefined;
  const { entry: targetEntry, slot, role } = hit;
  const siblings = pools.getSlotSiblings(slot, role);

  // Pool position is not evidence that one recorded sibling is the right
  // transfer source. Prefer the same authored group, then the closest ratio;
  // the identity comparison only stabilises an exact semantic tie.
  const available = siblings.filter((sibling) => {
    if (sibling.name === targetName) return false;
    const siblingId = program.findOrCreateExercise(sibling.name).id;
    return siblingId in lastPerformedWeights && lastPerformedWeights[siblingId] !== undefined;
  }).sort((left, right) => {
    const leftGroup = left.group === targetEntry.group ? 0 : 1;
    const rightGroup = right.group === targetEntry.group ? 0 : 1;
    return leftGroup - rightGroup
      || Math.abs(left.loadRatio - targetEntry.loadRatio) - Math.abs(right.loadRatio - targetEntry.loadRatio)
      || left.name.localeCompare(right.name);
  });

  for (const sibling of available) {
    if (sibling.name === targetName) continue;
    const siblingId = program.findOrCreateExercise(sibling.name).id;
    if (!(siblingId in lastPerformedWeights)) continue;
    const weight = lastPerformedWeights[siblingId];
    if (weight === null) return null; // sibling is bodyweight
    if (weight === undefined) continue;
    // ⚠ A BODYWEIGHT TARGET INHERITS NO SIBLING LOAD. This branch used to pass
    // the sibling's weight through raw, and a beginner's Bodyweight Squat was
    // prescribed wearing Goblet Squat's 12.5kg dumbbell (measured 2026-08-27,
    // Sam's overnight item 6). loadRatio 0 means the movement is authored
    // unloaded — the athlete may still ADD weight (Sam, 2026-08-16: "never a
    // prohibition"), but nothing may be transferred onto it.
    if (targetEntry.loadRatio <= 0) return undefined;
    if (sibling.loadRatio <= 0) {
      return weight; // translation undefined — pass through
    }
    return weight * (targetEntry.loadRatio / sibling.loadRatio);
  }
  return undefined;
}

/**
 * The authored band this row was dosed from, or null if it was not dosed from
 * the main-lift table at all.
 *
 * The condition MIRRORS GENERATION's, deliberately and line for line:
 * `defaultProgram.applyPhaseRepSchemeToExercise` writes the main-lift scheme
 * only for an `anchor` in a main-lift slot, and dispatches everything else to
 * the accessory guidelines. Asking a different question here would produce a
 * band the row was never authored from — which is how a lunge ends up bounded
 * by the squat's numbers.
 *
 * Uses require() for the same reason `resolveSiblingPerformedWeight` does: a
 * top-level import of the pool module reintroduces the circular dependency
 * with defaultProgram.ts that this file already works around.
 */
function authoredBandForRow(
  exerciseName: string,
  seasonPhase: SeasonPhase,
  offseasonSubphase?: OffseasonSubphase | null,
): RepScheme | null {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pools = require('../../data/exercisePoolsStrength') as typeof import('../../data/exercisePoolsStrength');
  const classification = pools.classifyPoolSlot(exerciseName);
  if (!classification) return null;
  if (classification.role !== 'anchor') return null;
  return mainLiftSchemeForSlot(classification.slot, seasonPhase, offseasonSubphase);
}

// ─── Prescription Adjustment ───

/** How a prescription changes based on progression output. */
interface PrescriptionDelta {
  setsChange: number;         // +1, 0, -1, -2
  repsMinChange: number;      // for micro_up: 0, for down: -2
  repsMaxChange: number;
  weightMultiplier: number;   // 1.0 = no change, 0.6–0.8 = deload, 1.025 = micro_up
  restChange: number;         // seconds
}

/**
 * Map a ProgressionOutput to concrete prescription deltas.
 */
function outputToPrescriptionDelta(output: ProgressionOutput): PrescriptionDelta {
  const delta: PrescriptionDelta = {
    setsChange: 0,
    repsMinChange: 0,
    repsMaxChange: 0,
    weightMultiplier: 1.0,
    restChange: 0,
  };

  // Load delta
  switch (output.loadDelta) {
    case 'micro_up':
      delta.weightMultiplier = 1.025; // +2.5%
      break;
    case 'up':
      delta.weightMultiplier = 1.05; // +5%
      break;
    case 'down':
      delta.weightMultiplier = 0.95; // -5%
      delta.repsMinChange = -1;
      delta.repsMaxChange = -1;
      break;
    case 'big_down':
      delta.weightMultiplier = 0.7; // -30% (middle of 20-40% range)
      delta.repsMinChange = -2;
      delta.repsMaxChange = -2;
      break;
  }

  // Sets delta
  switch (output.setsDelta) {
    case 'add_one':
      delta.setsChange = 1;
      break;
    case 'drop_one':
      delta.setsChange = -1;
      break;
    case 'drop_two':
      delta.setsChange = -2;
      break;
  }

  // RPE delta → rest adjustment
  switch (output.rpeDelta) {
    case 'push':
      delta.restChange = -15; // shorter rest = higher RPE
      break;
    case 'pull':
      delta.restChange = 15; // longer rest = lower RPE
      break;
  }

  return delta;
}

/**
 * Apply a prescription delta to a WorkoutExercise.
 * Returns a new WorkoutExercise with adjusted prescription.
 *
 * THE AUTHORED BAND IS THE BOUNDARY, AND `band` CARRIES IT.
 * Sam's sets/reps sentences (Bible §5) are the dose; generation writes them
 * and this function used to spend them. It enforced FLOORS ONLY — 1 set, 3
 * reps — two numbers nobody authored, and NO CEILING at all, so three clean
 * sessions carried an early off-season lift to four sets against an authored
 * maximum of three, and a deload cut a 4-6 rep pre-season lift to 3 reps.
 *
 * Two rules, and they are deliberately not symmetric:
 *
 *   • SETS have a CEILING and no band floor. Nothing in the Bible authorises
 *     more sets than the phase allows. Going BELOW the minimum is authored —
 *     R-034, the deload law, HALVES the sets — so clamping up to `setsMin`
 *     would put this function in the deload law's way. The 1-set floor stays.
 *   • REPS are held inside the band in BOTH directions. A deload moves sets
 *     and load, not reps; `deloadWeekRules.deloadPowerDose` already says so in
 *     as many words ("it is the volume that drops").
 *
 * Where a row is ALREADY outside its band — `quality_low_volume`'s 2x3 is
 * exempt from the phase scheme by ruling — the bound widens to admit it. The
 * band bounds what progression may DO; it does not overwrite another owner's
 * authored dose.
 *
 * `band` is null for any row generation did not dose from this table
 * (accessories, isolation, an unclassified name), and then the old floors are
 * all there is — the honest answer, rather than a band borrowed from a
 * neighbouring slot.
 *
 * ⚠ WHAT THIS DOES **NOT** FIX, NAMED SO IT IS NOT MISTAKEN FOR CLOSED.
 * A deload still pulls `repsMax` DOWN to the band's floor (a 4-6 pre-season
 * lift deloads to 4-4, shown as "4" rather than "5"), because `big_down` keeps
 * its own rep term. That term, `drop_two`, and the flat 0.7 load multiplier
 * are this module dosing a deload SECOND — `DELOAD_LAW` already owns that
 * transformation and disagrees with all three (it halves sets, so a 3-set day
 * is 2 and not 1, and it HOLDS load unless the athlete is beat up). Bounding
 * the band does not settle who owns a deload's numbers, and that question is
 * bigger than this unit.
 *
 * NOTE: Progression state is NOT appended to exercise.notes.
 * It lives on _progressionResults metadata (per-exercise) for any
 * system that needs it (e.g. sessionExplanation). Exercise notes
 * stay clean for the athlete.
 */
function applyDelta(
  exercise: WorkoutExercise,
  delta: PrescriptionDelta,
  exerciseName: string,
  band?: RepScheme | null,
): WorkoutExercise {
  const setsCeiling = band
    ? Math.max(band.setsMax, exercise.prescribedSets)
    : Number.POSITIVE_INFINITY;
  /**
   * THE FLOOR NEVER DRAGS AN AUTHORED ROW *UP*.
   *
   * A floor exists to stop progression driving reps DOWN past a sensible
   * minimum. The banded branch has always understood that: it takes the LOWER
   * of the band and what the row was authored at, so a row prescribed below the
   * band keeps its own number. The unbanded branch did not — it asserted a flat
   * `3` — so any row authored at 1 or 2 reps was silently raised to 3 the first
   * time progression touched it.
   *
   * FOUND VIA R-129 (Sam, 2026-08-23), whose Primer authors a heavy-but-easy
   * double: *"make exception to the 3 rep minimum rule here just for this
   * session"*. **The exception is not scoped to that session, because the defect
   * never was.** A per-row opt-out flag would have been a writer with no reader
   * for every other row in the app, and would have left the same bug live for
   * the next authored double. The two branches now say the same thing.
   *
   * `prescribedRepsMin` is guarded because this project has no
   * `strictNullChecks`: an absent value would make `Math.min` return NaN and
   * silently poison every prescription downstream.
   */
  const authoredRepsFloor = typeof exercise.prescribedRepsMin === 'number'
    && exercise.prescribedRepsMin > 0
    ? exercise.prescribedRepsMin
    : Number.POSITIVE_INFINITY;
  const repsFloor = band
    ? Math.min(band.repsMin, exercise.prescribedRepsMin)
    : Math.min(3, authoredRepsFloor);
  const repsCeiling = band
    ? Math.max(band.repsMax, exercise.prescribedRepsMax)
    : Number.POSITIVE_INFINITY;

  const newSets = Math.min(
    setsCeiling,
    Math.max(1, exercise.prescribedSets + delta.setsChange),
  );
  const newRepsMin = Math.min(
    repsCeiling,
    Math.max(repsFloor, exercise.prescribedRepsMin + delta.repsMinChange),
  );
  const newRepsMax = Math.min(
    repsCeiling,
    Math.max(repsFloor, exercise.prescribedRepsMax + delta.repsMaxChange),
  );
  const newRest = Math.max(30, exercise.restSeconds + delta.restChange);

  // Weight: the athlete's logged/saved base stays exact. Only the new automatic
  // target is normalised, through the exercise's typed implement lattice.
  let newWeight = exercise.prescribedWeightKg;
  if (newWeight !== undefined && newWeight !== null && newWeight > 0) {
    const snapped = normaliseAutomaticExerciseLoadChange({
      exerciseName,
      baseKg: newWeight,
      targetKg: delta.weightMultiplier * newWeight,
    });
    // R-343 (2026-09-02): an automatic step never ERASES an added load. On the
    // weighted-bodyweight lattice a -5% week from BW + 2.5 kg snaps to 0 and
    // the athlete's Pull-Up silently read "BW" again (measured on the
    // regenerated year, weeks 30 and 36). R-096: "hold load and reduce volume
    // first" — so a step the lattice cannot express above zero holds.
    newWeight = snapped !== null && snapped > 0 ? snapped : newWeight;
  }

  return {
    ...exercise,
    prescribedSets: newSets,
    prescribedRepsMin: newRepsMin,
    prescribedRepsMax: newRepsMax,
    prescribedWeightKg: newWeight,
    restSeconds: newRest,
    // notes preserved as-is — no progression tags appended
  };
}

// ─── Main API ───

/**
 * Apply strength progression to all eligible exercises in a workout.
 *
 * Classifies each exercise by role, runs resolveProgression() for
 * primary and secondary lifts, and adjusts prescriptions. Accessories,
 * trunk, isolation, and pump exercises are left unchanged.
 *
 * @param workout          - The strength or mixed workout to process
 * @param ctx              - Progression context (season, readiness, history, etc.)
 * @param lastPerformedWeights - Optional map of exerciseId → last performed weight (from weightOverrides store).
 *                               When provided, uses performed weight as baseline instead of template weight.
 *                               null = bodyweight, undefined = use template weight.
 * @returns                - A new Workout with adjusted prescriptions + metadata
 */
export function applyStrengthProgression(
  workout: Workout,
  ctx: StrengthProgressionContext,
  lastPerformedWeights?: Record<string, number | null>,
): Workout & { _progressionResults?: Record<string, ProgressionOutput> } {
  // Only process sessions that actually contain progressable strength rows.
  if (!workoutHasProgressableStrengthRows(workout)) return workout;

  const rpe = feelingToRPE(ctx.sessionFeeling);
  const results: Record<string, ProgressionOutput> = {};

  const newExercises = workout.exercises.map(ex => {
    // AUTHORED ROLE FIRST. Power's dose is owned by `powerPrimerPolicy` and
    // shrunk by `deloadPowerDose`; a progression layer adding a set to a jump
    // would be a second owner dosing the same work, which Section 6 names as a
    // defect outright. It was live the moment power became a row: the name
    // probe below reads `Explosive Push-up` as pressing work and progressed it
    // from 3 sets to 4 in week 4 of a block. Found by the differential harness.
    if (!rowCanReceiveStrengthProgression(ex)) return ex;
    const name = ex.exercise?.name || '';
    const role = classifyProgressionEligibility(name);

    // Skip non-progression exercises
    if (!role) return ex;

    // Build progression input for this exercise. Use slot-keyed history
    // so rotated pool anchors (e.g. Back Squat → Front Squat) inherit
    // the prior block's exposure trend with load normalized via the
    // pool's load ratios. Non-pool exercises fall through to the
    // per-ID extractor inside extractSlotExposureHistory.
    const exposures = extractSlotExposureHistory(
      ctx.workoutHistory,
      name,
      ex.exerciseId,
      3,
    );
    const trend = deriveTrend(exposures);

    // Derive completion quality from most recent workout containing this exercise
    let completionQuality: CompletionQuality = 'full';
    let consecutiveFullCompletions = 1;
    for (const w of ctx.workoutHistory) {
      const matchingSets = w.sets.filter(s => s.workoutExerciseId === ex.exerciseId);
      if (matchingSets.length > 0) {
        completionQuality = deriveCompletionQuality(
          matchingSets,
          ex.prescribedSets,
          ex.prescribedWeightKg,
        );
        // Count consecutive full completions
        if (completionQuality === 'full') {
          consecutiveFullCompletions = 1;
          for (let i = 1; i < ctx.workoutHistory.length; i++) {
            const olderSets = ctx.workoutHistory[i].sets.filter(
              s => s.workoutExerciseId === ex.exerciseId
            );
            if (olderSets.length === 0) break;
            const olderQ = deriveCompletionQuality(olderSets, ex.prescribedSets, ex.prescribedWeightKg);
            if (olderQ === 'full') {
              consecutiveFullCompletions++;
            } else {
              break;
            }
          }
        } else {
          consecutiveFullCompletions = 0;
        }
        break; // only need the most recent exposure
      }
    }

    const input: ProgressionInput = {
      exerciseRole: role,
      seasonPhase: ctx.seasonPhase,
      capacity: ctx.capacity,
      recentFatiguePattern: ctx.recentFatiguePattern,
      completionQuality,
      weeksSinceDeload: ctx.weeksSinceDeload,
      consecutiveBuildWeeks: ctx.consecutiveBuildWeeks,
      recentRPE: rpe,
      daysToGame: ctx.daysToGame,
      daysSinceGame: ctx.daysSinceGame,
      doubleGameWeek: ctx.doubleGameWeek,
      weeksOffTraining: ctx.weeksOffTraining,
      injuryAvoidFlag: ctx.injuryAvoidFlag,
      recentDeloadTrigger: ctx.recentDeloadTrigger,
      missedSessionsThisWeek: ctx.missedSessionsThisWeek,
      sessionFeeling: ctx.sessionFeeling,
      trend,
      isLowerBody: isLowerBodyExercise(name),
      consecutiveFullCompletions,
    };

    const output = resolveProgression(input);
    results[name] = output;

    // Apply the progression decision to the prescription
    const delta = outputToPrescriptionDelta(output);

    // ── Explicit adaptation overrides ──
    // blockProgression: cap load at current level (no increases)
    if (ctx.adaptationBlockProgression) {
      if (delta.weightMultiplier > 1.0) delta.weightMultiplier = 1.0;
      if (delta.repsMinChange > 0) delta.repsMinChange = 0;
      if (delta.repsMaxChange > 0) delta.repsMaxChange = 0;
    }
    // volumeAdjustment: directly adjust sets (-1 or +1)
    if (ctx.adaptationVolumeAdjustment) {
      delta.setsChange += ctx.adaptationVolumeAdjustment;
    }

    // Use last performed weight as baseline if available.
    // Pool rotation note: if the exercise is pool-managed and has no
    // direct entry, fall back to a sibling's last performed weight
    // normalized by load ratio. Same seam as exposure-history transfer.
    let baseEx = ex;
    if (lastPerformedWeights) {
      let performedWeight: number | null | undefined;
      if (ex.exerciseId in lastPerformedWeights) {
        performedWeight = lastPerformedWeights[ex.exerciseId];
      } else {
        const siblingWeight = resolveSiblingPerformedWeight(
          name,
          lastPerformedWeights,
        );
        if (siblingWeight !== undefined) performedWeight = siblingWeight;
      }
      if (performedWeight !== undefined) {
        baseEx = {
          ...ex,
          prescribedWeightKg: performedWeight ?? undefined,
        };
      }
    }

    const band = authoredBandForRow(name, ctx.seasonPhase, ctx.offseasonSubphase);
    return applyDelta(baseEx, delta, name, band);
  });

  return {
    ...workout,
    exercises: newExercises,
    _progressionResults: results,
  };
}

/**
 * Build a StrengthProgressionContext from available schedule state.
 *
 * Assembles context from the same data sources already available
 * in the resolver/builder pipeline. No new stores or services needed.
 *
 * @param seasonPhase      - From ScheduleState
 * @param readiness        - From ScheduleState (default 'medium')
 * @param gameDates        - All game dates in the block
 * @param dateStr          - The date being resolved
 * @param injuries         - From AthleteContext
 * @param markedDays       - Calendar marks for doubleGameWeek detection
 * @param workoutHistory   - From workoutService (passed in, not fetched here)
 */
export function buildProgressionContext(
  seasonPhase: SeasonPhase,
  capacity: CapacityBand,
  gameDates: string[],
  dateStr: string,
  injuries: Array<{ bodyArea: string; severity?: string }>,
  markedDays: Record<string, string>,
  workoutHistory: LoggedWorkout[] = [],
  feedbackFeeling?: FeedbackFeeling | null,
  recentFeedback: SessionFeedback[] = [],
  adaptation?: AdaptationResult | null,
  options: BuildProgressionContextOptions = {},
): StrengthProgressionContext {
  // Compute game proximity
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  let daysToGame: number | null = null;
  let daysSinceGame: number | null = null;
  for (const gd of gameDates) {
    const [gy, gm, gdd] = gd.split('-').map(Number);
    const gameDate = new Date(gy, gm - 1, gdd, 12, 0, 0, 0);
    const diffMs = gameDate.getTime() - date.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays > 0 && (daysToGame === null || diffDays < daysToGame)) {
      daysToGame = diffDays;
    }
    if (diffDays < 0 && (daysSinceGame === null || -diffDays < daysSinceGame)) {
      daysSinceGame = -diffDays;
    }
  }

  // Detect double game week from the week containing dateStr
  const dow = date.getDay();
  const mondayOffset = dow === 0 ? -6 : -(dow - 1);
  const monday = new Date(date.getTime() + mondayOffset * 24 * 60 * 60 * 1000);
  let gamesThisWeek = 0;
  for (let i = 0; i < 7; i++) {
    const checkDate = new Date(monday.getTime() + i * 24 * 60 * 60 * 1000);
    const checkStr = checkDate.toISOString().split('T')[0];
    if (markedDays[checkStr] === 'game') gamesThisWeek++;
  }
  const doubleGameWeek = gamesThisWeek >= 2;

  // Injury avoid flag
  const injuryAvoidFlag = injuries.some(
    i => i.severity && i.severity.toLowerCase() !== 'mild'
  );

  // Determine session feeling: adaptation override > explicit feedback > default
  let sessionFeeling: SessionFeeling = 'Good';
  if (adaptation?.feelingOverride) {
    sessionFeeling = adaptation.feelingOverride;
  } else if (feedbackFeeling) {
    sessionFeeling = feedbackFeelingToSessionFeeling(feedbackFeeling);
  }

  // THE CAPACITY BAND PASSES THROUGH UNTOUCHED (Sam, 2026-08-13). It used to be
  // stepped down here by `applyReadinessBias` — an adaptation, which is evidence
  // about the last few sessions, rewriting the athlete's standing baseline. The
  // adaptation's intent now travels as `recentFatiguePattern`, a peer of the
  // fatigue signals the soft-deload counter already had.
  const recentFatiguePattern = adaptation ? adaptationReportsFatigue(adaptation) : false;

  const historyWeeksSinceDeload = estimateWeeksSinceDeload(workoutHistory);
  const historyBuildWeeks = countConsecutiveBuildWeeks(workoutHistory);
  const weeksSinceDeload = historyWeeksSinceDeload > 0
    ? historyWeeksSinceDeload
    : options.blockState?.weeksSinceDeload ?? DEFAULT_PROGRESSION_CONTEXT.weeksSinceDeload;
  const consecutiveBuildWeeks = historyBuildWeeks > 0
    ? historyBuildWeeks
    : options.blockState?.consecutiveBuildWeeks ?? DEFAULT_PROGRESSION_CONTEXT.consecutiveBuildWeeks;

  const baseCtx: StrengthProgressionContext = {
    seasonPhase,
    offseasonSubphase: options.blockState?.phaseResolution?.offseasonSubphase ?? null,
    capacity,
    recentFatiguePattern,
    daysToGame,
    daysSinceGame,
    doubleGameWeek,
    injuryAvoidFlag,
    sessionFeeling,
    missedSessionsThisWeek: options.missedSessionsThisWeek ?? 0,
    weeksSinceDeload,
    consecutiveBuildWeeks,
    weeksOffTraining: options.weeksOffTraining ?? 0,
    recentDeloadTrigger: options.recentDeloadTrigger ?? null,
    workoutHistory,
    // Explicit adaptation overrides — applied directly in applyStrengthProgression
    adaptationVolumeAdjustment: adaptation?.volumeAdjustment ?? 0,
    adaptationBlockProgression: adaptation?.blockProgression ?? false,
  };

  // Apply feedback pattern biases (single-step adjustments only).
  // Returns unmodified ctx if insufficient feedback data.
  const patternSummary = analyzeFeedbackPatterns(recentFeedback);
  return applyPatternBiases(baseCtx, patternSummary);
}
