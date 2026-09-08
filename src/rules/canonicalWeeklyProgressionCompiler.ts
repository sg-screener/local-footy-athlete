/** Accepted block progression is the sole writer of progression prescriptions.
 * Dated readiness and scheduled deloads remain owned by the weekly compiler.
 * Sam 2026-09-07: retire the second per-session progression pass.
 */
import type { OnboardingData, TrainingProgram } from '../types/domain';
import type { ScheduleState } from '../utils/sessionResolver';
import { resolveReadinessDeload } from './readinessIllnessLaw';
import { previousBlockBoundsISO } from '../utils/programBlockState';
import { applyBlockBoundaryConditioning, applyBlockBoundaryProgression, applyBlockBoundarySetAdditions, applyBlockBoundaryVolume, buildBlockBoundaryExplanation, buildBlockBoundaryReductionExplanation, applyBlockBoundaryConditioningAdvance, decideBlockBoundaryConditioning, decideBlockBoundaryConditioningAdvance, decideBlockBoundaryLoads, decideBlockBoundarySetAdditions, decideBlockBoundaryVolume, readBlockHistory, snapshotAuthoredSets, type BlockBoundaryConditioningAdvance, type BlockBoundaryConditioningDecision, type BlockBoundaryLiftDecision, type BlockBoundaryVolumeDecision } from './blockBoundaryProgression';

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
  /** A compiler preview can resolve one week at its original block position. */
  readonly weekIndexOffset?: number;
  readonly program: TrainingProgram;
  readonly acceptedBlocks?: Readonly<Record<string, import('../store/programStore').AcceptedBlockRecord>>;
  readonly state: Omit<ScheduleState, 'currentProgram' | 'currentMicrocycle'>;
  readonly profile: OnboardingData;
  readonly blockStartISO: string;
  /** Recorded generation input, not the date on which reconstruction runs. */
  readonly asOfISO: string;
  readonly blockNumber: number;
  readonly previousRequiredStrengthSessions: number;
  readonly previousRequiredStrengthDates?: readonly string[];
}
type ProgressionContext = Omit<CanonicalProgramProgressionInput, 'program'>;
function blockRecoveryDecision(input: ProgressionContext, blockStartISO: string) {
  const previousBlock = previousBlockBoundsISO(blockStartISO);
  const feedback = Object.fromEntries(Object.entries(input.state.sessionFeedback ?? {})
    .filter(([, entry]) => entry.dateStr < input.asOfISO));
  const accepted = input.acceptedBlocks?.[previousBlock.startISO];
  const history = readBlockHistory({ feedbackByDate: feedback,
    blockStartISO: previousBlock.startISO, blockEndISO: previousBlock.endISO,
    requiredStrengthSessions: blockStartISO === input.blockStartISO
      ? input.previousRequiredStrengthSessions : accepted?.requiredStrengthSessions ?? 0,
    requiredStrengthDates: blockStartISO === input.blockStartISO
      ? input.previousRequiredStrengthDates : accepted?.requiredStrengthDates });
  return { history, recoveryWindow: resolveReadinessDeload({ declaredOnISO: blockStartISO, lowReadiness: history.reduces }) };
}

/** Scheduling and dose application consume the same dated recovery decision.
 * Historical windows keep a skipped Christmas dose due across a block boundary. */
export function conditioningRecoveryWindowsForProgram(input: ProgressionContext) {
  const starts = new Set([...Object.keys(input.acceptedBlocks ?? {}), input.blockStartISO]);
  return [...starts].filter(start => start <= input.blockStartISO).flatMap(start => {
    if (start === input.blockStartISO && input.blockNumber <= 1) return [];
    const window = blockRecoveryDecision(input, start).recoveryWindow;
    return window ? [window] : [];
  });
}

export function compileCanonicalProgramProgression(input: CanonicalProgramProgressionInput): TrainingProgram {
  const program: TrainingProgram = JSON.parse(JSON.stringify(input.program));
  const authoredSetsByRowId = snapshotAuthoredSets(program.microcycles);
  // Reconstruct the accepted build, not a new build using results recorded
  // since it. Later results feed the next acceptance; restart is not one.
  const authoringBlockNumber = input.blockNumber;
  if (authoringBlockNumber > 1) {
    const allDecisions: BlockBoundaryLiftDecision[] = [];
    const allConditioningAdvances: BlockBoundaryConditioningAdvance[] = [];
    const { history, recoveryWindow } = blockRecoveryDecision(input, input.blockStartISO);
    const allVolumeDecisions: BlockBoundaryVolumeDecision[] = [];
    const allConditioningDecisions: BlockBoundaryConditioningDecision[] = [];
    for (const [relativeWeekIndex, microcycle] of program.microcycles.entries()) {
      const weekIndex = relativeWeekIndex + (input.weekIndexOffset ?? 0);
      // A recovery adjustment is the first week of this accepted block. Its
      // evidence cannot renew it in later weeks or on reconstruction.
      const weekStart = microcycleStartISO(microcycle, input.blockStartISO, weekIndex);
      const weekHistory = { ...history, reduces: !!recoveryWindow && weekStart >= recoveryWindow.startISO && weekStart <= recoveryWindow.endISO && microcycle.weekKind !== 'deload' };
      const decisions = decideBlockBoundaryLoads({
        history: weekHistory,
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
        history: weekHistory,
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
        history: weekHistory,
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
        history: weekHistory,
        nextBlockWorkouts: microcycle.workouts,
        weekIndex,
        phase: input.profile.seasonPhase,
        weekKind: microcycle.weekKind,
      });
      microcycle.workouts = applyBlockBoundaryConditioningAdvance({
        workouts: microcycle.workouts,
        advances: conditioningAdvances,
      });
      for (const advance of conditioningAdvances) allConditioningAdvances.push(advance);

      const volumeDecisions = decideBlockBoundaryVolume({
        history: weekHistory,
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
      ...(reduction ? [{ ...reduction, effectiveFrom: recoveryWindow!.startISO, effectiveUntil: recoveryWindow!.endISO }] : []),
      ...buildBlockBoundaryExplanation(allDecisions),
    ];
  }


  return program;
}
