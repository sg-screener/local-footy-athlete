import type {
  DayOfWeek,
  Microcycle,
  OnboardingData,
  OverrideContext,
  TrainingProgram,
  UserRemovalConstraint,
  UserRemovalScope,
  Workout,
  WeekScopedWorkoutOverlay,
} from '../types/domain';
import type { CalendarDayType } from './calendarStore';
import type { ReadinessSignal } from '../utils/readiness';
import type { ActiveConstraint } from './coachUpdatesStore';
import type { InjuryState } from '../utils/injuryProgression';
import type { InjuryEpisodeV1 } from '../rules/injuryEpisode';
import {
  isTemporarySourceFactConstraint,
  type TemporarySourceFact,
} from '../rules/temporarySourceFact';
import {
  canonicaliseAcceptedStateCandidate,
  type AcceptedMaterialContext,
  type ProgramState,
  useProgramStore,
} from './programStore';
import {
  useCalendarStore,
  applyCalendarMarkedDaysWrite,
  beginCalendarResetAction,
  endCalendarResetAction,
} from './calendarStore';
import {
  useReadinessStore,
  applyReadinessSignalsWrite,
  beginReadinessResetAction,
  endReadinessResetAction,
} from './readinessStore';
import {
  publishAcceptedCoachUpdatesCompatibilityMirror,
  useCoachUpdatesStore,
} from './coachUpdatesStore';
import {
  publishAcceptedProfileCompatibilityMirror,
  useProfileStore,
} from './profileStore';
import { buildReadinessActiveConstraints } from '../utils/readinessConstraints';
import { isStructuralGenerationConstraint } from '../utils/generationConstraints';
import { generateProgramLocally } from '../services/api/generateProgram';
import { addDaysISO } from '../utils/programBlockState';
import { appDateNow, todayISOLocal } from '../utils/appDate';
import type { WeeklyExposureContractV2 } from '../rules/weeklyExposureContractV2';
import { storedGameAnchor } from '../rules/gameAnchor';
// The pair `programStore.setCurrentProgram` already applied before publishing:
// stamp the phase clock, then run the final program-write boundary. It lives at
// this owner now so no acceptance door can publish a program without it.
import { ensureProgramSeasonPhaseClock } from '../rules/seasonPhaseClock';
import {
  rebaseAcceptedEffectiveWeek,
  type AcceptedEffectiveWeekSurfaces,
} from '../rules/acceptedEffectiveWeek';
import {
  microcycleCoversWeek,
  selectStoredWeekDeclaration,
} from '../rules/storedWeekDeclaration';
import { isResolverOwnedDerivedSession } from '../rules/derivedSessionProvenance';
import type { G1LandingRouteId } from '../rules/g1LandingAsk';
import { staleAcceptedSnapshotRepair } from '../rules/profileMirrorNarrowing';
import {
  normalizeAcceptedArray,
  normalizeAcceptedKeyedMap,
  normalizeAcceptedMaterialContext,
  normalizeAcceptedProgramSurfaces,
  acceptedProfileForContext,
  ACCEPTED_PROFILE_SNAPSHOT_PROTOCOL_VERSION,
  type AcceptedCompositionBaseV1,
  type AcceptedProfileSnapshotV1,
} from './acceptedStateColdStart';
import {
  canonicalFixtureKind,
  resolveFixtureConditionedAvailability,
  targetWeekFixtures,
  type TargetWeekFixture,
} from '../rules/fixtureConditionedAvailability';
import { ownSeasonPhase } from '../rules/seasonPhaseOwner';
import {
  composeAcceptedEffectiveWeekSurfaces,
  liveAcceptedEffectiveWeekSurfaces,
  storedWorldSurfaces,
} from '../utils/liveEvaluationSurfaces';
import {
  buildFixtureMinimalReplan,
  type FixtureMutationIntent,
  type FixtureReplanEditCost,
  type FixtureMinimalReplanResult,
} from '../utils/fixtureMinimalReplan';
import {
  effectiveFixtureDatesForWeeks,
  rollingHorizonDependencyClosure,
  rollingHorizonWeekStartsForMutation,
  searchRollingHorizonCandidateCombinations,
} from '../rules/rollingHorizonRepair';
import {
  userMoveConstraintId,
  userRemovalConstraintId,
} from '../rules/userRemovalConstraints';
import {
  REVERSIBLE_ADJUSTMENT_PROTOCOL_VERSION,
  reversibleAdjustmentId,
  reversibleAdjustmentWorkoutFingerprint,
  type ReversibleAdjustmentActor,
  type ReversibleAdjustmentKind,
  type ReversibleAdjustmentLinkedReduction,
  type ReversibleAdjustmentOwnedDayDelta,
  type ReversibleAdjustmentOwnedWeekDelta,
  type ReversibleAdjustmentRecord,
  type ReversibleAdjustmentRestorationTarget,
  type ReversibleAdjustmentSurface,
} from '../rules/reversibleAdjustmentLedger';
import { semanticFingerprint } from '../utils/programSemanticSnapshot';
import { Section18WeekAcceptanceError } from '../rules/section18AcceptedWeekGateway';
import { collapseWorkoutToRest } from '../utils/workoutContent';
import type { Section18FindingDomain } from '../rules/section18EffectiveWeekEvaluator';
import {
  shortfallsFromFindings,
  renderSection18ShortfallDisclosure,
} from '../rules/section18ShortfallDisclosure';
import { classifyDaySessions } from '../rules/sessionTaxonomy';
import { isoDateForWeekday } from '../utils/appDate';
import {
  athleteActionDiagnosticHash,
  athleteActionDiagnosticsEnabled,
  athleteActionTerminalReasonChain,
  classifyAthleteActionFailure,
  currentAthleteActionTrace,
  emitAthleteActionDebugSnapshot,
  emitAthleteActionEvent,
  type AthleteActionTraceContext,
} from '../utils/athleteActionDiagnostics';

export type AcceptedProgramSurfaces = Pick<
  ProgramState,
  | 'currentProgram'
  | 'currentMicrocycle'
  | 'todayWorkout'
  | 'blockState'
  | 'dateOverrides'
  | 'overrideContexts'
  | 'weekScopedOverlays'
  | 'userRemovalConstraints'
  | 'reversibleAdjustmentLedger'
  | 'exposureContractsByWeek'
  // R1.3 (shell rebuild): the generation anchor rides the SAME publication
  // as the program it anchors — a second setState would be a second
  // publication (the rollover atomicity suite rightly refuses).
  | 'generationAnchorISO'
>;

/**
 * WHAT KIND OF THING THIS TRANSACTION IS — Sam's forward-only ruling
 * (2026-07-29). Accept-and-reduce serves FACTS AND DECISIONS THE ATHLETE
 * STATED. A restoration replays state that was already accepted, and a stored
 * snapshot that cannot reproduce a valid week is a DEFECT, not a fact — nobody
 * ever stated `requiredMinimum: 99`. `LOST_ONBOARDING_DIAGNOSIS` already ruled
 * this class: refuse and report a corrupt snapshot, never merge it.
 *
 * A typed kind and not a boolean, and never a reason-string inspection. This
 * repo has been bitten three times by unions discriminated on booleans, and
 * `preserveExactAcceptedWorkouts` is a storage-shape flag that happens to
 * correlate with restoration today — correlation is not the distinction.
 *
 * NOTHING IS ABSENT ANY MORE (2026-08-05). The kind is REQUIRED on
 * `AcceptedStateTransactionProposal`, on `assertAcceptedVisibleLedgerEquivalence`,
 * and on the override door — a publication that names no operation is a compile
 * error. "Absent means strict" read as a safe default and behaved as a silent
 * one: on a week the athlete had legitimately made short, six athlete-visible
 * doors inherited the refusal, including the season phase change. The strict
 * path is still the strict path; it is now CHOSEN, at every site, by name.
 *
 * One documented absence remains, deliberately: generation's
 * `GenerateProgramFromProfileOptions.weekAcceptance`, whose 110 harness call
 * sites are not writers of accepted state. Every PRODUCT generation call
 * declares it, enforced by `publicationOperationOwnershipTests` cell 8.
 */
export type AcceptedStateOperationKind = 'forward_decision' | 'restoration';

export interface AcceptedStateTransactionProposal {
  reason: string;
  /**
   * REQUIRED. See `AcceptedStateOperationKind` for the two verdicts.
   *
   * It was optional until 2026-08-05, defaulting to `restoration` at the two
   * commit-site asserts below — which contradicted the instruction on
   * `assertAcceptedVisibleLedgerEquivalence`'s own interface ("there is no
   * default here so a new call site cannot inherit accept-and-reduce by
   * accident") in the opposite direction: a writer that said nothing inherited
   * the STRICT verdict instead. On a week the athlete had legitimately made
   * short — rest marks, accepted and disclosed under the same 2026-07-29
   * ruling — six athlete-visible doors threw: the season phase change
   * (evening-1's missing layer), the readiness answer, undoing your own edit,
   * the named erasure, selecting another week, and republishing derived
   * overlays.
   *
   * Now closed the way `ProgramOverrideWriterId` closed its door (LR-1): a
   * publication that names no operation is a COMPILE error, never a silently
   * strict one. The GATE's semantics are unchanged — `restoration` still
   * throws, and the paths that replay a stored snapshot still declare it.
   * `publicationOperationOwnershipTests` holds the law.
   */
  operation: AcceptedStateOperationKind;
  /** One explicit date owner for transactions that began before async work. */
  todayISO?: string;
  /** Development-only correlation context; never persisted. */
  trace?: AthleteActionTraceContext;
  program?: Partial<AcceptedProgramSurfaces>;
  markedDays?: Record<string, CalendarDayType>;
  readinessSignalsByDate?: Record<string, ReadinessSignal>;
  activeConstraints?: ActiveConstraint[];
  activeInjury?: InjuryState | null;
  injuryEpisodes?: InjuryEpisodeV1[];
  temporarySourceFacts?: TemporarySourceFact[];
  acceptedCompositionBase?: AcceptedCompositionBaseV1 | null;
  acceptedProfileSnapshot?: AcceptedProfileSnapshotV1 | null;
  validateWeekStarts?: readonly string[];
  profile?: OnboardingData | null;
  /** Candidate already owns all non-fact reductions; do not replay legacy
   * constraint projections onto it during hydration/source-fact publication. */
  skipConstraintProjection?: boolean;
  /** Restoration-only mode: keep ledger-owned prescriptions byte-for-byte
   * while still running the complete accepted visible-ledger gateway. */
  preserveExactAcceptedWorkouts?: boolean;
}

export interface AcceptedStateTransactionResult {
  program: AcceptedProgramSurfaces;
  context: AcceptedMaterialContext;
}

export interface ReversibleAdjustmentCreationInput {
  kind: ReversibleAdjustmentKind;
  sourceActor: ReversibleAdjustmentActor;
  sourceSurface: ReversibleAdjustmentSurface;
  sourceActionOrIntentId: string;
  sourceProducer?: 'tap' | 'coach' | 'system';
  sourceTurnId?: string;
  /** Temporary source fact that authored this adjustment (for cascade-revert). */
  sourceFactId?: string;
  proposal: AcceptedStateTransactionProposal;
  affectedDates?: readonly string[];
  restorationTarget?: Partial<ReversibleAdjustmentRestorationTarget>;
  linkedConstraintIds?: readonly string[];
  linkedUserRemovalConstraintIds?: readonly string[];
  userRemovalConstraint?: UserRemovalConstraint | null;
  adjustmentId?: string;
  createdAt?: string;
  nonce?: string;
}

export interface ReversibleAdjustmentCreationStage {
  proposal: AcceptedStateTransactionProposal;
  result: AcceptedStateTransactionResult;
  adjustment: ReversibleAdjustmentRecord | null;
}

export class AcceptedStateLedgerMismatchError extends Error {
  readonly code = 'accepted_state_ledger_mismatch';

  constructor(weekStart: string, detail: string) {
    super(`Accepted-state ledger mismatch for ${weekStart}: ${detail}`);
    this.name = 'AcceptedStateLedgerMismatchError';
  }
}

const PROGRAM_SURFACE_KEYS: Array<keyof AcceptedProgramSurfaces> = [
  'currentProgram',
  'currentMicrocycle',
  'todayWorkout',
  'blockState',
  'dateOverrides',
  'overrideContexts',
  'weekScopedOverlays',
  'userRemovalConstraints',
  'reversibleAdjustmentLedger',
  'exposureContractsByWeek',
];

function programSurfaces(state: ProgramState): AcceptedProgramSurfaces {
  return normalizeAcceptedProgramSurfaces(state);
}

function materialContext(state: ProgramState): AcceptedMaterialContext {
  const accepted = normalizeAcceptedMaterialContext(state.acceptedMaterialContext);
  if (accepted.revision > 0) return accepted;
  return normalizeAcceptedMaterialContext({
    markedDays: normalizeAcceptedKeyedMap(useCalendarStore.getState().markedDays),
    readinessSignalsByDate: normalizeAcceptedKeyedMap(
      useReadinessStore.getState().signalsByDate,
    ),
    activeConstraints: normalizeAcceptedArray(useCoachUpdatesStore.getState().activeConstraints),
    activeInjury: useCoachUpdatesStore.getState().activeInjury ?? null,
    // R3: THE LIFE-FACTS ARE INPUTS AND THIS BRANCH USED TO DROP THEM.
    //
    // Cold start composes the accepted context from the armoured input stores.
    // It named three of them and forgot the two that live in the program
    // store's own input slice — `temporarySourceFacts` and `injuryEpisodes`,
    // both persisted by R1.3's `partialize` and both restored by `merge`.
    // R1.3's boot re-derives at `revision: 0`, so EVERY launch took this
    // branch, and the athlete's stated illness and injury were thrown away at
    // the boundary that was supposed to read them (measured 2026-08-05:
    // facts=1 after the door, 1 after rehydrate, 0 after the boot).
    //
    // It looked fine because `coachUpdatesStore`'s `activeConstraints` MIRROR
    // separately persisted the constraint the fact had derived — a surface
    // plan §1 deletes in R5. The fact carries itself now: the normaliser
    // recomposes constraints, injury compatibility and readiness FROM these
    // facts, so the mirror stops being the thing holding the athlete's illness
    // together. Pinned by `factDoorInputOwnershipTests` with the mirror
    // deliberately deleted before the relaunch.
    temporarySourceFacts: accepted.temporarySourceFacts,
    injuryEpisodes: accepted.injuryEpisodes,
    revision: 0,
    lastTransaction: null,
  });
}

function validationConstraints(
  activeConstraints: readonly ActiveConstraint[],
  signals: Readonly<Record<string, ReadinessSignal>>,
): ActiveConstraint[] {
  const byId = new Map<string, ActiveConstraint>(activeConstraints
    // InjuryEpisodeV1 is composed at the visible accepted boundary. Applying
    // its compatibility constraint here would destructively overwrite the
    // AcceptedCompositionBase that resolution must recompose from.
    .filter((constraint) => !isTemporarySourceFactConstraint(constraint) && constraint.type !== 'injury')
    .filter(isStructuralGenerationConstraint)
    .map((constraint) => [constraint.id, constraint]));
  for (const signal of Object.values(signals)) {
    if ((signal.temporarySourceFactIds?.length ?? 0) > 0) continue;
    for (const constraint of buildReadinessActiveConstraints(signal)) {
      byId.set(constraint.id, constraint);
    }
  }
  return Array.from(byId.values());
}

function materialisedProgramPatch(
  base: AcceptedProgramSurfaces,
  patch: Partial<AcceptedProgramSurfaces> | undefined,
): AcceptedProgramSurfaces {
  return normalizeAcceptedProgramSurfaces({ ...base, ...(patch ?? {}) });
}

/**
 * THE STALE-LEDGER COMPARISON, DELETED — Sam's derive-at-read ruling
 * (2026-07-29). It is recorded here rather than quietly removed, because
 * deleting an invariant deserves an argument.
 *
 * `acceptedLedgerSignature` compared the contract's STORED achieved counts
 * against the counts recomputed from the week that actually renders. It was a
 * real invariant while the counts were stored: it caught a week whose stored
 * tallies had gone stale beside the live week, which is exactly what the walker
 * reached in five actions (move a session off Thursday, add one back, mark a
 * game — the move refreshed the overlay's contract, the add wrote only a date
 * override, and the two disagreed at the next transaction).
 *
 * With `deriveAchievedCounts` as the one owner, both sides of that comparison
 * are the same derivation of the same week. There is no stored copy left to go
 * stale, so the comparison has no subject. This is the north star's promise
 * landing rather than an assertion being weakened: the divergence is now
 * UNREPRESENTABLE instead of tested-for.
 *
 * What still protects the behaviour the docstring cared about — "a later
 * visible precedence layer changing exposure, power, rest or stress" — is
 * behaviour-level and stronger: L4 (visible = accepted) and L4b (screen =
 * domain) in the athlete-door matrix and the action walker, asserted after
 * every action rather than against a stamped copy.
 *
 * The blocking-violation path below is untouched and is still the boundary
 * that matters: forward decisions accept-and-disclose, restorations refuse.
 */

/**
 * Re-resolve a staged persisted week and prove that its observable ledger is
 * exactly the ledger stamped by the accepted gateway. This forbids a later
 * visible precedence layer from changing exposure, power, rest or stress.
 */
/**
 * The shortfall the athlete is told about, derived and handed to the
 * disclosure owner. DERIVED, never stored: it is a fact about the week that
 * falls out of the contract and the week itself, so persisting it would be a
 * stored copy of a derivation — the north star's presumed-wrong shape, and the
 * exact class that produced the profile-mirror wipe.
 *
 * The last shortfall observed is kept in module scope purely so the door that
 * is mid-transaction can render it; it is recomputed on every evaluation and
 * never read back as truth.
 */
let lastAcceptedWeekShortfall: {
  weekStart: string;
  shortfalls: ReturnType<typeof shortfallsFromFindings>;
} | null = null;

/**
 * THE DAY THE SHORTFALL SENTENCE NAMES, read off the week the athlete actually
 * has rather than assumed.
 *
 * NO NEW PREDICATE. `classifyDaySessions` is the session-identity owner and
 * already answers "is this a game" and "is this an explicit rest stub"; the game
 * test exists privately in two other modules already, and a third copy is the
 * defect this repo keeps finding. So identity is ASKED, never re-implemented.
 */
function shortfallDayFacts(
  weekStart: string,
  workouts: readonly Workout[],
  markedDays: Record<string, CalendarDayType> | undefined,
): { gameDate: string | null; restedDate: string | null } {
  // THE ATHLETE'S OWN MARKS COME FIRST, and a regression is why. A rest mark is
  // a CALENDAR fact — `markedDays[date] === 'rest'` — not a workout named Rest,
  // so reading only the week's sessions found no rested day and the disclosure
  // fell silent on exactly the case Sam's accept-and-reduce ruling exists for:
  // the athlete states a fact about their life, the work is reduced, and they
  // must be TOLD. Caught by `acceptedStateTransactionTests` regression 3.
  const weekDates = new Set(
    Array.from({ length: 7 }, (_, offset) => addDaysISO(weekStart, offset)));
  let gameDate: string | null = null;
  let restedDate: string | null = null;
  for (const [date, mark] of Object.entries(markedDays ?? {})) {
    if (!weekDates.has(date)) continue;
    if (!gameDate && mark === 'game') gameDate = date;
    if (!restedDate && mark === 'rest') restedDate = date;
  }
  // THE WEEK'S OWN SESSIONS ARE THE FALLBACK, for a fixture that arrived as a
  // generated game rather than a mark. Identity is ASKED, never re-implemented:
  // `classifyDaySessions` is the owner and two private copies of "is this a
  // game" already exist elsewhere — a third is the defect this repo keeps
  // finding. A workout carries `dayOfWeek`, not a date, and `isoDateForWeekday`
  // is the shared owner of that conversion.
  if (!gameDate || !restedDate) {
    for (const workout of workouts) {
      const date = isoDateForWeekday(weekStart, workout.dayOfWeek);
      const categories = classifyDaySessions(workout).map((unit) => unit.category);
      if (!gameDate && categories.includes('game')) gameDate = date;
      if (!restedDate && categories.includes('rest')) restedDate = date;
    }
  }
  return { gameDate, restedDate };
}

function recordAcceptedWeekShortfall(
  weekStart: string,
  blockingViolations: readonly { domain: Section18FindingDomain; expected: unknown; actual: unknown }[],
  visibleWorkouts: readonly Workout[],
  markedDays: Record<string, CalendarDayType> | undefined,
): void {
  // THE WEEK'S OWN FACTS DECIDE THE SENTENCE. Passing `weekStart` as the day was
  // the live defect: every Monday-start week read "Resting Monday" whichever day
  // was rested, and whether or not anything was rested at all.
  const { gameDate, restedDate } = shortfallDayFacts(weekStart, visibleWorkouts, markedDays);
  lastAcceptedWeekShortfall = {
    weekStart,
    shortfalls: shortfallsFromFindings({ gameDate, restedDate, findings: blockingViolations }),
  };
}

/** What the door should tell the athlete, or null when the week is whole. */
export function takeAcceptedWeekShortfallDisclosure(weekStart?: string): string | null {
  const recorded = lastAcceptedWeekShortfall;
  lastAcceptedWeekShortfall = null;
  if (!recorded) return null;
  if (weekStart && recorded.weekStart !== weekStart.slice(0, 10)) return null;
  return renderSection18ShortfallDisclosure(recorded.shortfalls);
}

export function assertAcceptedVisibleLedgerEquivalence(args: {
  surfaces: AcceptedProgramSurfaces;
  context: AcceptedMaterialContext;
  weekStarts: readonly string[];
  profile?: OnboardingData | null;
  trace?: AthleteActionTraceContext;
  /**
   * Required, deliberately. Every publication boundary states what it is
   * publishing; there is no default here so a new call site cannot inherit
   * accept-and-reduce by accident.
   */
  operation: AcceptedStateOperationKind;
}): void {
  // NO SILENT DEFAULT IN EITHER DIRECTION. The type closes this for every
  // writer the compiler can see, but this owner is also reached through
  // `require(...)` from `programStore`, `coachUpdatesStore` and
  // `postGenerationConstraintValidation`, where an omission is invisible to
  // tsc — and with the `?? 'restoration'` gone, an omission would now fall
  // through to the PERMISSIVE verdict. Swapping one silent default for its
  // opposite is not a fix, so an unnamed operation is refused outright.
  if (args.operation !== 'forward_decision' && args.operation !== 'restoration') {
    throw new Error(
      'accepted_state_operation_undeclared: a publication reached the visible-ledger '
      + `equivalence gate without naming its operation (got ${JSON.stringify(args.operation)}). `
      + 'State `forward_decision` (the athlete just decided something — publish the best '
      + 'achievable week and disclose the shortfall) or `restoration` (replaying state '
      + 'accepted once — an unreproducible week is a corrupt snapshot and is refused).',
    );
  }
  const surfaces = normalizeAcceptedProgramSurfaces(args.surfaces);
  const context = normalizeAcceptedMaterialContext(args.context);
  const profile = args.profile ?? useProfileStore.getState().onboardingData;
  for (const weekStart of Array.from(new Set(args.weekStarts.map((week) => week.slice(0, 10))))) {
    const overlay = surfaces.weekScopedOverlays[weekStart];
    const microcycle = surfaces.currentProgram?.microcycles.find((candidate) =>
      weekStart >= candidate.startDate.slice(0, 10) &&
      weekStart <= candidate.endDate.slice(0, 10)) ?? (
      surfaces.currentMicrocycle &&
      weekStart >= surfaces.currentMicrocycle.startDate.slice(0, 10) &&
      weekStart <= surfaces.currentMicrocycle.endDate.slice(0, 10)
        ? surfaces.currentMicrocycle
        : null
    );
    // THE FLIP, MOVE (ii) — one read door. `microcycle` above already folds
    // the current-microcycle fallback in, so this caller has two candidates.
    const contract = selectStoredWeekDeclaration({
      overlay,
      coveringMicrocycle: microcycle,
      weekStart,
      reader: 'acceptedStateTransaction.validateAcceptedWeeks',
    });
    if (!contract) continue;
    const rebased = rebaseAcceptedEffectiveWeek({
      surfaces: storedWorldSurfaces(surfaces),
      weekStart,
      profile,
      markedDays: context.markedDays,
    });
    const evaluation = rebased.evaluation;
    if (evaluation.blockingViolations.length > 0) {
      emitAthleteActionEvent(args.trace, 'visible_projection_result', {
        acceptedStateVersion: context.revision,
        weekId: weekStart,
        visibleStateHash: athleteActionDiagnosticHash(rebased.visibleWorkouts.map((workout) => ({
          dayOfWeek: workout.dayOfWeek,
          identity: workout.planEntryId ?? workout.id,
        }))),
        visibleEqualsAcceptedState: true,
        rejectionCodes: evaluation.blockingViolations.map((finding) => finding.code),
        rejectingBoundary: 'assertAcceptedVisibleLedgerEquivalence',
        failureCategory: 'accepted_with_shortfall',
      });
      // ACCEPT-AND-REDUCE, FORWARD ONLY (Sam, 2026-07-29). This used to throw.
      //
      // A blocking violation here does NOT mean the two representations
      // disagree — it means the week the athlete now has cannot meet its
      // contract, which is the honest consequence of a fact they stated. The
      // athlete's calendar wins and the program adapts: the fact is kept, the
      // best week around it is published, and the shortfall is disclosed in
      // Sam's signed words (`rules/section18ShortfallDisclosure`).
      //
      // This assertion keeps the job it is named for and only that job — the
      // check immediately below, where the PERSISTED and VISIBLE ledgers
      // genuinely differ. That is two representations of one week disagreeing,
      // it is always a defect, and it still throws.
      //
      // A RESTORATION gets the old behaviour and must: it is replaying state
      // that was accepted once, so a week it cannot reproduce means the stored
      // snapshot is corrupt. Publishing a reduced version of a corrupt snapshot
      // would merge a defect into accepted state, which is the mirror-wipe
      // shape this repo has already paid for once.
      if (args.operation === 'restoration') {
        throw new AcceptedStateLedgerMismatchError(
          weekStart,
          `re-evaluation produced blockers ${evaluation.blockingViolations
            .map((finding: { code: string }) => finding.code).join(',')}`,
        );
      }
      recordAcceptedWeekShortfall(
        weekStart, evaluation.blockingViolations, rebased.visibleWorkouts, context.markedDays);
    }
    emitAthleteActionEvent(args.trace, 'visible_projection_result', {
      acceptedStateVersion: context.revision,
      weekId: weekStart,
      visibleStateHash: athleteActionDiagnosticHash(rebased.visibleWorkouts.map((workout) => ({
        dayOfWeek: workout.dayOfWeek,
        identity: workout.planEntryId ?? workout.id,
      }))),
      visibleEqualsAcceptedState: true,
      outcome: 'accepted',
    });
  }
}

/**
 * Pure staging boundary. No Zustand store is changed until every affected
 * effective week has passed Contract v2 safety and the accepted-week gateway.
 */
/**
 * THE FINAL PROGRAM-WRITE BOUNDARY, RUN WHERE NO DOOR CAN SKIP IT.
 *
 * `utils/postGenerationConstraintValidation` calls itself the *"final
 * canonicalisation and active-constraint boundary for program writes"* — it
 * converts a producer's output to the canonical workout shape and applies the
 * injury/exposure/equipment rules immediately before storage. **Only one of the
 * two acceptance doors was running it.** `programStore.setCurrentProgram` (the
 * onboarding install) validated its candidate before calling the transaction;
 * `weekRebuild.commitRebuiltProgram` — the door the block ROLLOVER, every rebuild
 * and `quiescentBoot` publish through — handed its generated program straight in.
 *
 * So a block was ACCEPTED in one shape and REPUBLISHED in another, and the first
 * restart inside that block re-authored it. Measured on one athlete
 * (`npm run test:mid-block-restart`): the accepted Monday read `Full Body
 * Strength` with `Romanian Deadlift`, and after a genuine process death the same
 * day came back named `full_body` with `Single-Leg RDL` in its place, no dated
 * fact having changed across the restart.
 *
 * ⚠ **IT CANONICALISES. IT DOES NOT RE-ANSWER WEEK ACCEPTANCE, AND THAT
 * SEPARATION IS THE WHOLE DESIGN — measured, not assumed.**
 *
 * The microcycle boundary can also REFUSE, by throwing
 * `Section18WeekAcceptanceError`. Letting that escape from here would mean a boot
 * that throws instead of a boot that launches: measured across the full sweep, it
 * reddened `test:block-two-boot-preservation`, `test:exercise-exclusions` and
 * `test:illness-clear-game-week` — three worlds whose generated week breaches a
 * §18 conditioning maximum and which `quiescent_boot` has always published
 * anyway. **Whether the accepted week is lawful already has an owner a few lines
 * below — `assertAcceptedVisibleLedgerEquivalence`, over the same
 * `validateWeekStarts`.** Asking the question twice, in two shapes, is the
 * second-representation defect this repo exists to fight, and the copy that
 * throws is the one with no repair path from here.
 *
 * So a refusal leaves THAT microcycle exactly as the producer wrote it and says
 * so out loud. It is not a silent fallback and it is not a widening: it is this
 * owner declining to hold a verdict that is not its own. **The divergence those
 * three worlds reveal — that the rebuild door publishes weeks the install door's
 * boundary would refuse — is real, is reported in `docs/STATUS_RESTART.md`, and
 * needs its own unit.**
 *
 * It is safe to run where a door already ran it: the boundary is IDEMPOTENT,
 * measured on a whole program and held by a cell in the unit above, so the
 * install door's own call — which it needs in order to derive the block state and
 * anchor off the program it is actually storing — becomes a no-op repeat rather
 * than a second author.
 */
function canonicaliseAcceptedProgramWrite(
  candidate: AcceptedProgramSurfaces,
  program: TrainingProgram,
  proposal: AcceptedStateTransactionProposal,
): AcceptedProgramSurfaces {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { assertLiveMicrocycleWrite } = require('../utils/postGenerationConstraintValidation') as {
    assertLiveMicrocycleWrite: (microcycle: Microcycle, todayISO?: string) => void;
  };
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { logger } = require('../utils/logger') as {
    logger: { error: (message: string, detail?: unknown) => void };
  };
  const source = ensureProgramSeasonPhaseClock(program);
  const changed = source !== program;
  // ⚠ THE BOUNDARY NO LONGER RETURNS A WEEK (demolition area 1, 2026-08-19).
  // It used to hand back a rewritten microcycle and this function stored it,
  // so the week that reached accepted state was not the week the producer
  // wrote. It now only ASKS, and the producer's week is published either way.
  for (const microcycle of source.microcycles) {
    try {
      assertLiveMicrocycleWrite(microcycle, proposal.todayISO);
    } catch (error) {
      /* ── THIS OWNER CANONICALISES. IT NEVER REFUSES. ──────────────────────
       *
       * The boundary can raise two kinds of refusal — `Section18WeekAcceptanceError`
       * for an unlawful week, and a bare invariant (`temporary_schedule_…_not_preserved`)
       * when the §18 step would breach a live constraint. **Neither verdict is
       * this function's to hold**, and both already have owners at this very
       * transaction: `assertAcceptedVisibleLedgerEquivalence` gates the accepted
       * week over `validateWeekStarts` a few lines below, and the constraint
       * context is staged above. Holding them here as well is a second
       * representation of one decision, and this copy has no repair path — it
       * throws out of `quiescent_boot`, which means an app that does not launch.
       *
       * MEASURED, on the full 403-suite sweep: letting them escape reddened
       * `test:block-two-boot-preservation`, `test:exercise-exclusions` and
       * `test:illness-clear-game-week` — three worlds whose generated week the
       * rebuild door has ALWAYS published and whose refusal is therefore not new
       * information, only newly fatal.
       *
       * ⚠ **THE CATCH WRAPS ONE CALL AND NOTHING ELSE**, so it cannot swallow a
       * fault from anywhere but the boundary it is deferring, and every refusal is
       * reported. **The divergence these worlds reveal is real and is NOT fixed
       * here**: the rebuild door publishes weeks the install door's boundary would
       * refuse. Named, with its receipt, in `docs/STATUS_RESTART.md`; it needs its
       * own unit and a ruling about which week the athlete should get. */
      logger.error(
        '[acceptedStateTransaction] the program-write boundary REFUSED a week and it '
        + 'is being published as the producer wrote it — the accepted-week gate owns '
        + 'this verdict, not this boundary',
        {
          reason: proposal.reason,
          weekStart: microcycle.startDate,
          refusal: error instanceof Section18WeekAcceptanceError
            ? 'section18_week_acceptance'
            : (error as { message?: string })?.message ?? String(error),
        },
      );
    }
  }
  if (!changed) return candidate;
  return { ...candidate, currentProgram: source };
}

export function stageAcceptedStateTransaction(
  proposal: AcceptedStateTransactionProposal,
  sourceState?: ProgramState,
): AcceptedStateTransactionResult {
  const current = sourceState ?? useProgramStore.getState();
  // An explicit source is a closed staging snapshot. Compatibility mirrors
  // must not leak into it, even for a legacy revision-zero envelope.
  const priorContext = sourceState
    ? normalizeAcceptedMaterialContext(sourceState.acceptedMaterialContext)
    : materialContext(current);
  let context = normalizeAcceptedMaterialContext({
    markedDays: proposal.markedDays === undefined
      ? priorContext.markedDays
      : proposal.markedDays,
    readinessSignalsByDate: proposal.readinessSignalsByDate === undefined
      ? priorContext.readinessSignalsByDate
      : proposal.readinessSignalsByDate,
    activeConstraints: proposal.activeConstraints === undefined
      ? priorContext.activeConstraints
      : proposal.activeConstraints,
    activeInjury: proposal.activeInjury === undefined
      ? priorContext.activeInjury
      : proposal.activeInjury,
    injuryEpisodes: proposal.injuryEpisodes === undefined
      ? priorContext.injuryEpisodes
      : proposal.injuryEpisodes,
    temporarySourceFacts: proposal.temporarySourceFacts === undefined
      ? priorContext.temporarySourceFacts
      : proposal.temporarySourceFacts,
    acceptedCompositionBase: proposal.acceptedCompositionBase === undefined
      ? priorContext.acceptedCompositionBase
      : proposal.acceptedCompositionBase,
    acceptedProfileSnapshot: proposal.acceptedProfileSnapshot === undefined
      ? priorContext.acceptedProfileSnapshot
      : proposal.acceptedProfileSnapshot,
    revision: priorContext.revision + 1,
    lastTransaction: proposal.reason,
  });
  const profile = proposal.profile ?? acceptedProfileForContext(
    context,
    useProfileStore.getState().onboardingData,
  );
  if (context.acceptedProfileSnapshot) {
    const profileChanged = JSON.stringify(
      context.acceptedProfileSnapshot.onboardingData,
    ) !== JSON.stringify(profile);
    // A RECORD POORER THAN THE PROFILE REPAIRS ITSELF (Sam, export 6).
    //
    // The condition below asks for `proposal.profile`, and no ordinary
    // transaction carries one — so a snapshot that had gone wrong could never
    // be corrected, while being republished over the live profile by every
    // transaction that ran. Four refused attempts in one second on his device,
    // with the record still reading 2 answers at revision 13.
    //
    // Refusing the publication stopped the damage. This ends the cause: when
    // the record is missing answers the athlete has, the record is what is
    // wrong, and it is re-minted from the live profile at the revision it is
    // corrected at. Deliberately NOT from `profile` — that resolves to the
    // snapshot itself once a revision exists, which would re-mint the corruption.
    //
    // ONLY FOR A TRANSACTION WITH NO OPINION ABOUT THE PROFILE. A transaction
    // that CARRIES one is making a profile decision — leaving In-season clears
    // the game day — and "repairing" that back from the live mirror would undo
    // the athlete's own change. `phaseShiftAtomicityTests` catches it.
    const transactionOwnsTheProfile = proposal.profile !== undefined ||
      proposal.acceptedProfileSnapshot !== undefined;
    const liveProfileNow = useProfileStore.getState().onboardingData;
    const staleRecord = transactionOwnsTheProfile ? null : staleAcceptedSnapshotRepair({
      live: liveProfileNow,
      snapshot: context.acceptedProfileSnapshot.onboardingData,
    });
    if (staleRecord) {
      context = normalizeAcceptedMaterialContext({
        ...context,
        acceptedProfileSnapshot: {
          ...context.acceptedProfileSnapshot,
          updatedAt: appDateNow().toISOString(),
          sourceRevision: context.revision,
          onboardingData: liveProfileNow,
        },
      });
      emitAthleteActionEvent(proposal.trace ?? currentAthleteActionTrace(),
        'profile_snapshot_repaired', {
          internalResultCode: staleRecord.reason,
          missingAnswerCount: staleRecord.missingAnswers.length,
          repairedAtRevision: context.revision,
        });
    } else if (proposal.acceptedProfileSnapshot !== undefined ||
      (proposal.profile !== undefined && profileChanged)) {
      context = normalizeAcceptedMaterialContext({
        ...context,
        acceptedProfileSnapshot: proposal.acceptedProfileSnapshot ?? {
          ...context.acceptedProfileSnapshot,
          updatedAt: appDateNow().toISOString(),
          sourceRevision: context.revision,
          onboardingData: profile,
        },
      });
    }
  } else {
    // Controllable clock (appDateNow) for the accepted-profile snapshot — the
    // rest of the accepted-state path already uses it. A raw `new Date()` here
    // let the profile-snapshot capturedAt drift from the rollback-captured
    // pre-state, producing a false `accepted_state_rollback_mismatch` under a
    // frozen test clock. See docs/READINESS_SOURCE_FACT_REASSESSMENT_2026-07-22.md.
    const now = appDateNow().toISOString();
    context = normalizeAcceptedMaterialContext({
      ...context,
      acceptedProfileSnapshot: {
        protocolVersion: ACCEPTED_PROFILE_SNAPSHOT_PROTOCOL_VERSION,
        capturedAt: now,
        updatedAt: now,
        sourceRevision: context.revision,
        onboardingData: profile,
      },
    });
  }
  // R5.3 LEG (ii), 2026-08-06: the candidate fixture materialiser is GONE.
  //
  // It re-composed every accepted commit's fixture marks by running
  // `buildFixtureProjection` over the candidate surfaces, which made this
  // staging body a SECOND composer of the athlete's week beside the deriver.
  // Measured before deleting it (see docs/R5_DELETION_SEQUENCE_2026-08-06.md
  // (o)): it fired 4,378 times across the bible and changed the candidate 518
  // times through NINE product doors, so this was never boot-only. A fixture is
  // a persisted life-fact; the week that expresses it is DERIVED, and there is
  // now one body that does the deriving.
  const candidate = materialisedProgramPatch(programSurfaces(current), proposal.program);
  if (proposal.preserveExactAcceptedWorkouts) {
    if (context.acceptedCompositionBase) {
      context = normalizeAcceptedMaterialContext({
        ...context,
        acceptedCompositionBase: {
          ...context.acceptedCompositionBase,
          updatedAt: appDateNow().toISOString(),
          sourceRevision: context.revision,
          surfaces: candidate,
        },
      });
    }
    assertAcceptedVisibleLedgerEquivalence({
      surfaces: candidate,
      context,
      weekStarts: proposal.validateWeekStarts ?? [],
      profile,
      operation: proposal.operation,
      trace: proposal.trace,
    });
    return { program: candidate, context };
  }
  const validatedCandidate = candidate.currentProgram
    ? canonicaliseAcceptedProgramWrite(candidate, candidate.currentProgram, proposal)
    : candidate;
  const constraints = validationConstraints(
    context.activeConstraints,
    context.readinessSignalsByDate,
  );
  const accepted = canonicaliseAcceptedStateCandidate(validatedCandidate, {
    // An empty set means "retain the already-accepted reduced program". Do
    // not turn a context-only clear into a whole-program regeneration or a
    // second structural pass. Explicit affected weeks are still re-gated via
    // validateWeekStarts below.
    activeConstraints: !proposal.skipConstraintProjection && constraints.length > 0
      ? constraints
      : undefined,
    profile,
    markedDays: context.markedDays,
    validateWeekStarts: proposal.validateWeekStarts,
    todayISO: proposal.todayISO,
  });
  const program = materialisedProgramPatch(
    validatedCandidate,
    accepted as Partial<AcceptedProgramSurfaces>,
  );
  if (context.acceptedCompositionBase) {
    context = normalizeAcceptedMaterialContext({
      ...context,
      acceptedCompositionBase: {
        ...context.acceptedCompositionBase,
        updatedAt: appDateNow().toISOString(),
        sourceRevision: context.revision,
        surfaces: program,
      },
    });
  }
  return { program, context };
}

/**
 * The sole material publication. Program and every context input used by the
 * athlete-visible resolver enter ProgramStore in one state replacement.
 * Legacy stores are mirrored afterward and are not programming authorities.
 */
export function commitAcceptedStateTransaction(
  proposal: AcceptedStateTransactionProposal,
): AcceptedStateTransactionResult {
  const trace = proposal.trace ?? currentAthleteActionTrace();
  const diagnosticsEnabled = Boolean(trace) && athleteActionDiagnosticsEnabled();
  const current = diagnosticsEnabled ? useProgramStore.getState() : null;
  const beforeContext = current ? materialContext(current) : null;
  const beforeStateHash = current && beforeContext
    ? athleteActionDiagnosticHash({
        program: programSurfaces(current),
        context: beforeContext,
      })
    : undefined;
  emitAthleteActionEvent(trace, 'athlete_action_route_selected', {
    selectedRoute: 'accepted_state_transaction',
    transactionReason: proposal.reason,
    acceptedStateVersion: beforeContext?.revision,
    beforeStateHash,
  });
  let staged: AcceptedStateTransactionResult;
  try {
    staged = stageAcceptedStateTransaction(proposal);
  } catch (error) {
    const code = (error as { code?: string })?.code ?? 'transaction_staging_failed';
    emitAthleteActionEvent(trace, 'transaction_verification_result', {
      verified: false,
      originalRejectionCode: code,
      rejectionCodes: [code],
      rejectingBoundary: 'stageAcceptedStateTransaction',
      failureCategory: classifyAthleteActionFailure(code, 'stageAcceptedStateTransaction'),
      previousStateRestored: true,
      beforeStateHash,
    });
    emitAthleteActionEvent(trace, 'accepted_state_publication_result', {
      published: false,
      atomicRollback: true,
      previousStateRestored: true,
      beforeStateHash,
      afterStateHash: beforeStateHash,
      internalResultCode: code,
    });
    emitAthleteActionEvent(trace, 'transaction_publish_result', {
      published: false,
      persistenceResult: 'not_started',
      previousStateRestored: true,
      beforeStateHash,
      afterStateHash: beforeStateHash,
      internalResultCode: code,
    });
    throw error;
  }
  const equivalenceWeeks = new Set(proposal.validateWeekStarts ?? []);
  if (proposal.activeConstraints !== undefined || proposal.activeInjury !== undefined ||
    proposal.injuryEpisodes !== undefined || proposal.temporarySourceFacts !== undefined) {
    for (const microcycle of staged.program.currentProgram?.microcycles ?? []) {
      equivalenceWeeks.add(microcycle.startDate.slice(0, 10));
    }
    for (const weekStart of Object.keys(staged.program.weekScopedOverlays)) {
      equivalenceWeeks.add(weekStart);
    }
  }
  try {
    assertAcceptedVisibleLedgerEquivalence({
      operation: proposal.operation,
      surfaces: staged.program,
      context: staged.context,
      weekStarts: Array.from(equivalenceWeeks),
      profile: proposal.profile ?? acceptedProfileForContext(
        staged.context,
        useProfileStore.getState().onboardingData,
      ),
      trace,
    });
    emitAthleteActionEvent(trace, 'visible_projection_result', {
      acceptedStateVersion: staged.context.revision,
      dependencyWeeksSelected: Array.from(equivalenceWeeks).sort(),
      visibleStateHash: athleteActionDiagnosticHash({
        programId: staged.program.currentProgram?.id ?? null,
        microcycleId: staged.program.currentMicrocycle?.id ?? null,
        overrideIdentities: Object.entries(staged.program.dateOverrides).map(([date, workout]) => ({
          date,
          identity: workout.planEntryId ?? workout.id,
        })),
        overlayWeeks: Object.keys(staged.program.weekScopedOverlays).sort(),
      }),
      visibleEqualsAcceptedState: true,
      projectionSummary: true,
      outcome: 'accepted',
    });
  } catch (error) {
    const code = (error as { code?: string })?.code ?? 'transaction_verification_failed';
    emitAthleteActionEvent(trace, 'transaction_verification_result', {
      verified: false,
      originalRejectionCode: code,
      rejectionCodes: [code],
      rejectingBoundary: 'assertAcceptedVisibleLedgerEquivalence',
      failureCategory: classifyAthleteActionFailure(code, 'visible_projection'),
      previousStateRestored: true,
      beforeStateHash,
    });
    emitAthleteActionEvent(trace, 'accepted_state_publication_result', {
      published: false,
      atomicRollback: true,
      previousStateRestored: true,
      beforeStateHash,
      afterStateHash: beforeStateHash,
      terminalReasonChain: trace ? athleteActionTerminalReasonChain(trace.traceId) : [],
      internalResultCode: code,
    });
    emitAthleteActionEvent(trace, 'transaction_publish_result', {
      published: false,
      persistenceResult: 'not_started',
      previousStateRestored: true,
      beforeStateHash,
      afterStateHash: beforeStateHash,
      internalResultCode: code,
    });
    throw error;
  }
  emitAthleteActionEvent(trace, 'transaction_verification_result', {
    verified: true,
    acceptedStateVersion: staged.context.revision,
    dependencyWeeksSelected: Array.from(equivalenceWeeks).sort(),
    beforeStateHash,
  });
  useProgramStore.setState({
    ...staged.program,
    acceptedMaterialContext: staged.context,
  });
  // Through the calendar owner: the transaction is a WRITER of markedDays,
  // not an exception to its door — and, exactly like the readiness publish
  // below, an EMPTY map is a common real state here. Removing the last
  // fixture of a world leaves no marks at all, and the athlete's own removal
  // is the legitimate erasure the door's anti-wipe quarantine exists to
  // distinguish from a default overwriting answered data.
  //
  // WHAT THIS FIXES (2026-08-05, found diagnosing the fixture identity law):
  // this publish opened NO reset act, so the quarantine refused it as
  // `default_over_answered_marks` and — because the outcome was discarded —
  // refused it SILENTLY. Removing a game left the accepted mirror saying the
  // fixture was gone while the persisted calendar life-fact still said
  // `game`. The mirror is the copy that does not survive R5, so the athlete's
  // removed fixture was set to come back the moment inputs became the truth.
  // The comment that used to sit here described `calendarStore.clear()`'s own
  // internal reset act, not this one, and read as if this path were covered.
  //
  // AND THE ACT IS NARROWED TO THE DECISION THAT EARNS IT. Only a proposal
  // that DECLARES `markedDays` is publishing a marks decision; when it is
  // absent the context inherited `priorContext.markedDays` (see the staging
  // above), so an empty map there was never authored by anyone and must still
  // meet the quarantine. Opening the act unconditionally would hand every
  // accepted publish the power to wipe the calendar — the hydration
  // refuse-then-overwrite shape, bought back at the one site that publishes
  // most often. The narrowing costs nothing in the legitimate path: an
  // inherited context cannot be empty while the live store has marks.
  {
    const authoredMarksDecision = proposal.markedDays !== undefined;
    const calendarResetActionId = authoredMarksDecision
      ? beginCalendarResetAction('accepted_state_publish')
      : undefined;
    try {
      const published = applyCalendarMarkedDaysWrite({
        next: staged.context.markedDays,
        writer: 'accepted_transaction',
        ...(calendarResetActionId ? { resetActionId: calendarResetActionId } : {}),
      });
      // NOT DISCARDED. Under the reset act the remaining refusal reasons are
      // unreachable by construction, which is exactly why a refusal here is a
      // breach rather than a condition: the accepted state has already been
      // published to the program store one statement above, so a calendar the
      // door would not accept means the two owners of markedDays have already
      // diverged. Loud, not silent — the silence is what cost this defect.
      if (!published.ok) {
        throw new Error(
          `accepted_state_calendar_publish_refused: ${published.reason}`,
        );
      }
    } finally {
      if (calendarResetActionId) endCalendarResetAction(calendarResetActionId);
    }
  }
  // Through the readiness owner. The accepted context is the canonical
  // publisher and an empty map is a common real state (a cleared signal, a
  // pruned week), so the publish is a legitimate erasure under a reset act
  // rather than a write around the door.
  {
    const readinessResetActionId = beginReadinessResetAction('accepted_state_publish');
    try {
      applyReadinessSignalsWrite({
        next: staged.context.readinessSignalsByDate,
        writer: 'accepted_transaction',
        resetActionId: readinessResetActionId,
      });
    } finally {
      endReadinessResetAction(readinessResetActionId);
    }
  }
  if (proposal.activeConstraints !== undefined || proposal.activeInjury !== undefined ||
    proposal.injuryEpisodes !== undefined || proposal.temporarySourceFacts !== undefined) {
    publishAcceptedCoachUpdatesCompatibilityMirror({
      activeConstraints: staged.context.activeConstraints,
      activeInjury: staged.context.activeInjury,
    });
  }
  if (staged.context.acceptedProfileSnapshot) {
    // The athlete's own change, being published as it is accepted — including
    // an answer they deliberately removed (leaving In-season clears the game
    // day). This is the new truth, not a replay of an old one.
    publishAcceptedProfileCompatibilityMirror(
      staged.context.acceptedProfileSnapshot.onboardingData,
      { origin: 'accepted_transaction' },
    );
  }
  const afterStateHash = athleteActionDiagnosticHash({
    program: staged.program,
    context: staged.context,
  });
  emitAthleteActionEvent(trace, 'accepted_state_publication_result', {
    published: true,
    atomicRollback: false,
    previousStateRestored: false,
    acceptedStateVersion: staged.context.revision,
    beforeStateHash,
    afterStateHash,
    outcome: 'accepted',
  });
  emitAthleteActionEvent(trace, 'transaction_publish_result', {
    published: true,
    persistenceResult: 'queued',
    previousStateRestored: false,
    acceptedStateVersion: staged.context.revision,
    beforeStateHash,
    afterStateHash,
    internalResultCode: 'accepted_state_published',
  });
  if (trace && diagnosticsEnabled && beforeContext) {
    const activeNotes = (require('../utils/activeCoachNotes') as typeof import('../utils/activeCoachNotes'))
      .buildActiveCoachNotes(staged.context.activeConstraints, staged.context.activeInjury);
    const beforeNotes = (require('../utils/activeCoachNotes') as typeof import('../utils/activeCoachNotes'))
      .buildActiveCoachNotes(beforeContext.activeConstraints, beforeContext.activeInjury);
    const beforeIds = new Set(beforeNotes.map((note) => note.id));
    const afterIds = new Set(activeNotes.map((note) => note.id));
    const afterConstraintIds = new Set(staged.context.activeConstraints.map((constraint) => constraint.id));
    const beforeConstraintIds = new Set(beforeContext.activeConstraints.map((constraint) => constraint.id));
    const clearedConstraints = beforeContext.activeConstraints.filter((constraint) =>
      !afterConstraintIds.has(constraint.id));
    const clearedLinkedOverrideDates = Array.from(new Set(clearedConstraints.flatMap((constraint) =>
      'linkedOverrideDates' in constraint ? constraint.linkedOverrideDates ?? [] : []))).sort();
    const derivedConstraintIds = new Set(activeNotes.map((note) => note.constraintId));
    emitAthleteActionEvent(trace, 'coach_notes_result', {
      activeAdjustmentCountBefore: beforeContext.activeConstraints.length,
      activeAdjustmentCountAfter: staged.context.activeConstraints.length,
      activeCoachNoteCountBefore: beforeNotes.length,
      activeCoachNoteCountAfter: activeNotes.length,
      noteIdentitiesDerived: activeNotes.map((note) => note.id),
      noteIdentitiesAdded: activeNotes.filter((note) => !beforeIds.has(note.id)).map((note) => note.id),
      noteIdentitiesRemoved: beforeNotes.filter((note) => !afterIds.has(note.id)).map((note) => note.id),
      noteIdentitiesPreserved: activeNotes.filter((note) => beforeIds.has(note.id)).map((note) => note.id),
      noteIdentitiesSuppressed: staged.context.activeConstraints
        .filter((constraint) => !derivedConstraintIds.has(constraint.id))
        .map((constraint) => constraint.id),
      deduplicationKeys: activeNotes.map((note) => note.modifierId),
      adjustmentCleared: clearedConstraints.length > 0,
      clearedAdjustmentIds: clearedConstraints.map((constraint) => constraint.id),
      clearedLinkedOverrideDates,
      displacedSessionRestorationResult: clearedLinkedOverrideDates.length === 0
        ? 'not_applicable'
        : clearedLinkedOverrideDates.every((date) =>
            !Object.prototype.hasOwnProperty.call(staged.program.dateOverrides, date))
          ? 'owned_override_removed_for_visible_reprojection'
          : 'owned_override_still_present',
      noteStateMatchesAcceptedProvenance: activeNotes.every((note) =>
        afterConstraintIds.has(note.constraintId) || (
          staged.context.activeInjury &&
          note.constraintId === 'legacy_active_injury'
        )),
      acceptedConstraintIdsPreserved: staged.context.activeConstraints
        .filter((constraint) => beforeConstraintIds.has(constraint.id))
        .map((constraint) => constraint.id),
    });
    emitAthleteActionDebugSnapshot(trace, 'accepted_state_after_publication', {
      program: staged.program,
      context: staged.context,
    });
  }
  return staged;
}

function cloneAccepted<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function acceptedWorkoutsForDates(args: {
  surfaces: AcceptedProgramSurfaces;
  context: AcceptedMaterialContext;
  profile: OnboardingData | null;
  dates: readonly string[];
}): Map<string, Workout | null> {
  const dates = Array.from(new Set(args.dates.map((date) => date.slice(0, 10))));
  const byDate = new Map<string, Workout | null>();
  for (const weekStart of Array.from(new Set(dates.map(mondayForDate)))) {
    const rebased = rebaseAcceptedEffectiveWeek({
      surfaces: storedWorldSurfaces(args.surfaces),
      weekStart,
      profile: args.profile,
      markedDays: args.context.markedDays,
    });
    const byDay = new Map(rebased.visibleWorkouts.map((workout) =>
      [workout.dayOfWeek, workout]));
    for (const date of dates.filter((candidate) => mondayForDate(candidate) === weekStart)) {
      const workout = byDay.get(new Date(`${date}T12:00:00`).getDay()) ?? null;
      byDate.set(date, workout ? cloneAccepted(workout) : null);
    }
  }
  return byDate;
}

function acceptedSurfaceRowsForDates(args: {
  surfaces: AcceptedProgramSurfaces;
  context: AcceptedMaterialContext;
  profile: OnboardingData | null;
  dates: readonly string[];
}): Map<string, { owner: 'date_override' | 'week_overlay' | 'base_microcycle' | 'empty'; workout: Workout | null }> {
  const dates = Array.from(new Set(args.dates.map((date) => date.slice(0, 10))));
  const byDate = new Map<string, {
    owner: 'date_override' | 'week_overlay' | 'base_microcycle' | 'empty';
    workout: Workout | null;
  }>();
  for (const weekStart of Array.from(new Set(dates.map(mondayForDate)))) {
    const rebased = rebaseAcceptedEffectiveWeek({
      surfaces: storedWorldSurfaces(args.surfaces),
      weekStart,
      profile: args.profile,
      markedDays: args.context.markedDays,
    });
    for (const entry of rebased.dates) {
      if (!dates.includes(entry.date)) continue;
      byDate.set(entry.date, {
        owner: entry.owner,
        workout: entry.workout ? cloneAccepted(entry.workout) : null,
      });
    }
  }
  return byDate;
}

function contractForAcceptedWeek(
  surfaces: AcceptedProgramSurfaces,
  weekStart: string,
): WeeklyExposureContractV2 | undefined {
  // THE FLIP, MOVE (ii) — one read door. Three-branch caller: the current
  // microcycle is consulted only when it COVERS the week, which is what the
  // door's `currentMicrocycle` candidate means.
  return selectStoredWeekDeclaration({
    overlay: surfaces.weekScopedOverlays[weekStart],
    coveringMicrocycle: surfaces.currentProgram?.microcycles.find((candidate) =>
      microcycleCoversWeek(candidate, weekStart)),
    currentMicrocycle: microcycleCoversWeek(surfaces.currentMicrocycle, weekStart)
      ? surfaces.currentMicrocycle
      : null,
    weekStart,
    reader: 'acceptedStateTransaction.contractForAcceptedWeek',
  }) ?? undefined;
}

function linkedReductionSignature(entry: ReversibleAdjustmentLinkedReduction): string {
  return semanticFingerprint(entry);
}

/**
 * LEG (iv) — THE DERIVED CONTRACT FOR AN ACCEPTED WEEK.
 *
 * `contractForAcceptedWeek` reads the STORED contract. Under the pattern-
 * identity ruling a week's contract is derived from the decisions and the
 * facts, so the ledger — which has to name what the athlete can undo — must
 * ask the same question the reader asks. This is that question, and it is the
 * reader's own owner (`rebaseAcceptedEffectiveWeek`), not a restatement.
 *
 * Returns null when the week cannot be derived (no stored identity to derive
 * FROM); callers fall through to the stored answer rather than inventing one.
 */
function derivedContractForAcceptedWeek(args: {
  surfaces: AcceptedProgramSurfaces;
  context: AcceptedMaterialContext;
  profile?: OnboardingData | null;
  weekStart: string;
}): WeeklyExposureContractV2 | null {
  try {
    return rebaseAcceptedEffectiveWeek({
      surfaces: storedWorldSurfaces(args.surfaces),
      weekStart: args.weekStart,
      profile: args.profile,
      markedDays: args.context.markedDays,
    }).contract;
  } catch {
    return null;
  }
}

/**
 * LEG (iv) — THE LINK, DERIVED FROM THE DECISION.
 *
 * The ruling in one sentence: a typed reduction belongs to the adjustment
 * whose CONSTRAINT authored it. So the link is `deletionIdentity ∈ the
 * constraint ids this adjustment carries`, read off the contract the week
 * actually derives to — not the set difference of two stored contracts.
 *
 * Why the diff cannot survive: `applyAthleteRemovalTypedReduction` returns a
 * whole contract with the reduction folded into its targets, and leg (i) stops
 * persisting that arithmetic. An after-minus-before over the stored surface is
 * therefore empty by construction, and an empty link means the undo cannot
 * name its own reduction. Asking the deriver instead is the same question the
 * athlete's screen asks.
 */
function decisionDerivedLinkedReductions(args: {
  surfaces: AcceptedProgramSurfaces;
  context: AcceptedMaterialContext;
  profile?: OnboardingData | null;
  weekStarts: readonly string[];
  constraintIds: readonly string[];
}): ReversibleAdjustmentLinkedReduction[] {
  if (args.constraintIds.length === 0) return [];
  const owned = new Set(args.constraintIds);
  return args.weekStarts.flatMap((weekStart) => {
    const contract = derivedContractForAcceptedWeek({
      surfaces: args.surfaces,
      context: args.context,
      profile: args.profile,
      weekStart,
    });
    return (contract?.authorisedReductions ?? [])
      .filter((entry) => entry.deletionIdentity && owned.has(entry.deletionIdentity))
      .map((entry) => {
        const reduction = {
          weekStart,
          metric: entry.metric,
          reason: entry.reason,
          originalApprovedTarget: entry.originalApprovedTarget,
          reducedTarget: entry.reducedTarget,
          detail: entry.detail,
          deletionIdentity: entry.deletionIdentity ?? null,
        };
        return { ...reduction, fingerprint: semanticFingerprint(reduction) };
      });
  });
}

function acceptedLinkedReductions(
  surfaces: AcceptedProgramSurfaces,
  weekStarts: readonly string[],
): ReversibleAdjustmentLinkedReduction[] {
  return weekStarts.flatMap((weekStart) =>
    (contractForAcceptedWeek(surfaces, weekStart)?.authorisedReductions ?? []).map((entry) => {
      const reduction = {
        weekStart,
        metric: entry.metric,
        reason: entry.reason,
        originalApprovedTarget: entry.originalApprovedTarget,
        reducedTarget: entry.reducedTarget,
        detail: entry.detail,
        deletionIdentity: entry.deletionIdentity ?? null,
      };
      return { ...reduction, fingerprint: semanticFingerprint(reduction) };
    }));
}

function provenanceReferences(
  workouts: ReadonlyMap<string, Workout | null>,
): string[] {
  return Array.from(workouts.entries()).flatMap(([date, workout]) =>
    (workout?.derivedSessionProvenance ?? []).map((record, index) => [
      date,
      workout.planEntryId ?? workout.id,
      record.sourcePlanEntryId ?? 'none',
      record.origin,
      record.scope,
      index,
      semanticFingerprint(record),
    ].join(':')));
}

function overrideOwnerId(
  context: OverrideContext | null | undefined,
): string | null {
  if (!context) return null;
  const candidate = context as OverrideContext & {
    activeModifierId?: string;
    sourceActionId?: string;
    sourceEventId?: string;
  };
  return candidate.activeModifierId ?? candidate.sourceActionId ?? candidate.sourceEventId ?? null;
}

/**
 * Pure reversible creation staging. It first obtains the fully accepted
 * candidate, derives exact owned date deltas from that candidate, then stages
 * the same candidate with one ledger record. No store is published here.
 */
export function stageReversibleAdjustmentCreationTransaction(
  input: ReversibleAdjustmentCreationInput,
): ReversibleAdjustmentCreationStage {
  const current = useProgramStore.getState();
  const beforeProgram = programSurfaces(current);
  const beforeContext = materialContext(current);
  const profile = input.proposal.profile ?? useProfileStore.getState().onboardingData;
  const firstStage = stageAcceptedStateTransaction(input.proposal);
  const rollingDependencyWeeks = Array.from(new Set([
    ...(input.proposal.validateWeekStarts ?? []).map((week) => mondayForDate(week)),
    ...(input.affectedDates ?? []).map(mondayForDate),
  ])).sort();
  const candidateDates = Array.from(new Set([
    ...rollingDependencyWeeks.flatMap(datesInWeek),
    ...(input.affectedDates ?? []).map((date) => date.slice(0, 10)),
  ])).sort();
  const beforeWorkouts = acceptedWorkoutsForDates({
    surfaces: beforeProgram,
    context: beforeContext,
    profile,
    dates: candidateDates,
  });
  const afterWorkouts = acceptedWorkoutsForDates({
    surfaces: firstStage.program,
    context: firstStage.context,
    profile,
    dates: candidateDates,
  });
  const beforeSurfaceRows = acceptedSurfaceRowsForDates({
    surfaces: beforeProgram,
    context: beforeContext,
    profile,
    dates: candidateDates,
  });
  const afterSurfaceRows = acceptedSurfaceRowsForDates({
    surfaces: firstStage.program,
    context: firstStage.context,
    profile,
    dates: candidateDates,
  });
  const changedDates = candidateDates.filter((date) => {
    const beforeFingerprint = reversibleAdjustmentWorkoutFingerprint(
      date,
      beforeWorkouts.get(date) ?? null,
    );
    const afterFingerprint = reversibleAdjustmentWorkoutFingerprint(
      date,
      afterWorkouts.get(date) ?? null,
    );
    return beforeFingerprint !== afterFingerprint ||
      (beforeContext.markedDays[date] ?? null) !== (firstStage.context.markedDays[date] ?? null) ||
      semanticFingerprint(beforeProgram.dateOverrides[date] ?? null) !==
        semanticFingerprint(firstStage.program.dateOverrides[date] ?? null);
  });
  const ownedDays: ReversibleAdjustmentOwnedDayDelta[] = changedDates.map((date) => {
    const beforeWorkout = beforeWorkouts.get(date) ?? null;
    const afterWorkout = afterWorkouts.get(date) ?? null;
    const beforeSurface = beforeSurfaceRows.get(date);
    const afterSurface = afterSurfaceRows.get(date);
    return {
      date,
      weekStart: mondayForDate(date),
      beforeWorkout,
      beforeSurfaceOwner: beforeSurface?.owner ?? 'empty',
      afterSurfaceOwner: afterSurface?.owner ?? 'empty',
      beforeSurfaceWorkout: beforeSurface?.workout ?? null,
      // LR-26: the after side is an identity and two fingerprints — the only
      // things any reader ever consumed. See ReversibleAdjustmentOwnedDayDelta.
      afterStableIdentity: afterWorkout?.planEntryId ?? afterWorkout?.id ?? null,
      afterDateOverrideFingerprint: semanticFingerprint(
        firstStage.program.dateOverrides[date] ?? null),
      afterOverrideContextFingerprint: semanticFingerprint(
        firstStage.program.overrideContexts[date] ?? null),
      beforeDateOverride: beforeProgram.dateOverrides[date]
        ? cloneAccepted(beforeProgram.dateOverrides[date])
        : null,
      beforeOverrideContext: beforeProgram.overrideContexts[date]
        ? cloneAccepted(beforeProgram.overrideContexts[date])
        : null,
      beforeFingerprint: reversibleAdjustmentWorkoutFingerprint(date, beforeWorkout),
      afterFingerprint: reversibleAdjustmentWorkoutFingerprint(date, afterWorkout),
    };
  });
  const calendarFacts = changedDates.flatMap((date) => {
    const before = beforeContext.markedDays[date] ?? null;
    const after = firstStage.context.markedDays[date] ?? null;
    return before === after ? [] : [{ date, before, after }];
  });
  const affectedDates = Array.from(new Set(changedDates)).sort();
  const beforeProvenance = new Set(provenanceReferences(beforeWorkouts));
  const linkedProvenanceIds = provenanceReferences(afterWorkouts)
    .filter((id) => !beforeProvenance.has(id));
  const beforeReductions = new Set(acceptedLinkedReductions(
    beforeProgram,
    rollingDependencyWeeks,
  ).map(linkedReductionSignature));
  // Leg (iv), install site 1 of 2 — THE LINK DERIVES FROM THE DECISION.
  const linkedTypedReductions = decisionDerivedLinkedReductions({
    surfaces: firstStage.program,
    context: firstStage.context,
    profile,
    weekStarts: rollingDependencyWeeks,
    constraintIds: Array.from(new Set(input.linkedUserRemovalConstraintIds ?? [])),
  });
  const ownedWeeks = rollingDependencyWeeks.flatMap((weekStart) => {
    // Leg (iv), install site 2 of 2 — the OWNED WEEK is the week whose
    // contract the decision moved, and under leg (i) that movement is visible
    // only in the DERIVED contract. Comparing stored surfaces reports "nothing
    // changed" for a decision that changed what the athlete trains, so the undo
    // has no contract to restore and no conformance basis to refuse a corrupt
    // one against. Falls back to the stored answer when a week cannot derive.
    const beforeContract = derivedContractForAcceptedWeek({
      surfaces: beforeProgram, context: beforeContext, profile, weekStart,
    }) ?? contractForAcceptedWeek(beforeProgram, weekStart) ?? null;
    const afterContract = derivedContractForAcceptedWeek({
      surfaces: firstStage.program, context: firstStage.context, profile, weekStart,
    }) ?? contractForAcceptedWeek(firstStage.program, weekStart) ?? null;
    const beforeFingerprint = semanticFingerprint(beforeContract);
    const afterFingerprint = semanticFingerprint(afterContract);
    return beforeFingerprint === afterFingerprint ? [] : [{
      weekStart,
      beforeExposureContract: beforeContract ? cloneAccepted(beforeContract) : null,
      afterExposureContract: afterContract ? cloneAccepted(afterContract) : null,
      beforeFingerprint,
      afterFingerprint,
    }];
  });
  if (ownedDays.length === 0 && ownedWeeks.length === 0) {
    return { proposal: input.proposal, result: firstStage, adjustment: null };
  }
  const affectedWeeks = Array.from(new Set([
    ...affectedDates.map(mondayForDate),
    ...ownedWeeks.map((owned) => owned.weekStart),
  ])).sort();
  const createdAt = input.createdAt ?? new Date().toISOString();
  const id = input.adjustmentId ?? reversibleAdjustmentId({
    kind: input.kind,
    sourceActionOrIntentId: input.sourceActionOrIntentId,
    createdAt,
    nonce: input.nonce,
  });
  const existing = beforeProgram.reversibleAdjustmentLedger.adjustments.find((entry) =>
    entry.id === id);
  if (existing) {
    return { proposal: input.proposal, result: firstStage, adjustment: existing };
  }
  const stableIdentities = Array.from(new Set([
    ...(input.restorationTarget?.stableIdentities ?? []),
    ...ownedDays.flatMap((entry) => [
      entry.beforeWorkout?.planEntryId ?? entry.beforeWorkout?.id,
      entry.afterStableIdentity,
    ].filter((value): value is string => !!value)),
  ])).sort();
  const adjustment: ReversibleAdjustmentRecord = {
    protocolVersion: REVERSIBLE_ADJUSTMENT_PROTOCOL_VERSION,
    id,
    kind: input.kind,
    sourceActor: input.sourceActor,
    sourceSurface: input.sourceSurface,
    sourceActionOrIntentId: input.sourceActionOrIntentId,
    ...(input.sourceProducer ? { sourceProducer: input.sourceProducer } : {}),
    ...(input.sourceTurnId ? { sourceTurnId: input.sourceTurnId } : {}),
    ...(input.sourceFactId ? { sourceFactId: input.sourceFactId } : {}),
    createdAt,
    acceptedRevision: firstStage.context.revision,
    status: 'active',
    clearedAt: null,
    supersededById: null,
    supersededReason: null,
    affectedDates,
    affectedWeeks,
    rollingDependencyWeeks,
    displacedOriginalState: {
      ownedDays,
      ownedWeeks,
      calendarFacts,
      userRemovalConstraint: input.userRemovalConstraint
        ? cloneAccepted(input.userRemovalConstraint)
        : null,
    },
    acceptedAfterSemanticFingerprints: ownedDays.map((entry) => ({
      date: entry.date,
      fingerprint: entry.afterFingerprint,
    })),
    restorationTarget: {
      kind: input.restorationTarget?.kind ?? (
        input.kind.includes('fixture') ? 'fixture_state' :
          input.kind === 'session_component_delete' ? 'session_component' : 'session'
      ),
      dates: Array.from(new Set(input.restorationTarget?.dates ?? affectedDates)).sort(),
      stableIdentities,
      ...(input.restorationTarget?.componentScope
        ? { componentScope: input.restorationTarget.componentScope }
        : {}),
    },
    linkedConstraintIds: Array.from(new Set(input.linkedConstraintIds ?? [])).sort(),
    linkedCalendarFacts: calendarFacts,
    linkedOverrideOwners: changedDates.flatMap((date) => {
      const beforeOverride = beforeProgram.dateOverrides[date];
      const afterOverride = firstStage.program.dateOverrides[date];
      if (semanticFingerprint(beforeOverride ?? null) === semanticFingerprint(afterOverride ?? null)) {
        return [];
      }
      return [{
        date,
        ownerId: overrideOwnerId(firstStage.program.overrideContexts[date]) ??
          overrideOwnerId(beforeProgram.overrideContexts[date]),
      }];
    }),
    linkedOverlayIds: rollingDependencyWeeks.flatMap((weekStart) => {
      const before = beforeProgram.weekScopedOverlays[weekStart];
      const after = firstStage.program.weekScopedOverlays[weekStart];
      return semanticFingerprint(before ?? null) === semanticFingerprint(after ?? null) || !after
        ? []
        : [after.id];
    }),
    linkedUserRemovalConstraintIds: Array.from(new Set(
      input.linkedUserRemovalConstraintIds ?? [],
    )).sort(),
    linkedProvenanceIds,
    linkedTypedReductions,
    validity: {
      reversible: true,
      source: 'runtime_exact_delta',
      validWhile: ['accepted_after_semantic_fingerprints_match'],
      invalidWhen: ['newer_athlete_intent_owns_same_target', 'owned_day_fingerprint_changes'],
    },
    laterIntentPolicy: 'newer_athlete_intent_wins',
  };
  const proposal: AcceptedStateTransactionProposal = {
    ...input.proposal,
    program: {
      ...(input.proposal.program ?? {}),
      reversibleAdjustmentLedger: {
        protocolVersion: REVERSIBLE_ADJUSTMENT_PROTOCOL_VERSION,
        adjustments: [
          ...beforeProgram.reversibleAdjustmentLedger.adjustments,
          adjustment,
        ],
      },
    },
  };
  const result = stageAcceptedStateTransaction(proposal);
  return { proposal, result, adjustment };
}

export function commitReversibleAdjustmentCreationTransaction(
  input: ReversibleAdjustmentCreationInput,
): ReversibleAdjustmentCreationStage {
  const staged = stageReversibleAdjustmentCreationTransaction(input);
  const result = commitAcceptedStateTransaction(staged.proposal);
  return { ...staged, result };
}

/**
 * Exact-delta owner for an explicit athlete/coach load reduction. Temporary
 * health facts must never call this helper: they compose reversibly from the
 * AcceptedCompositionBase and therefore do not own a program delta.
 */
export function commitExplicitLoadEditTransaction(args: {
  proposal: AcceptedStateTransactionProposal;
  sourceActionOrIntentId: string;
  affectedDates: readonly string[];
  sourceActor?: ReversibleAdjustmentActor;
  sourceSurface?: ReversibleAdjustmentSurface;
}): ReversibleAdjustmentCreationStage {
  return commitReversibleAdjustmentCreationTransaction({
    kind: 'explicit_load_edit',
    sourceActor: args.sourceActor ?? 'athlete',
    sourceSurface: args.sourceSurface ?? 'coach_chat',
    sourceActionOrIntentId: args.sourceActionOrIntentId,
    proposal: args.proposal,
    affectedDates: args.affectedDates,
    restorationTarget: {
      kind: 'session',
      dates: [...args.affectedDates],
    },
  });
}

export interface AcceptedLoadEditLedgerBaseline {
  program: AcceptedProgramSurfaces;
  context: AcceptedMaterialContext;
}

export function captureAcceptedLoadEditLedgerBaseline(): AcceptedLoadEditLedgerBaseline {
  const state = useProgramStore.getState();
  return {
    program: cloneAccepted(programSurfaces(state)),
    context: cloneAccepted(materialContext(state)),
  };
}

/**
 * Attach exact ownership after a deterministic program-edit executor has
 * already written its accepted candidate inside the surrounding rollback
 * transaction. The owned rows are computed from clean accepted surfaces, so
 * active temporary facts are not counted as a second load reduction.
 */
export function commitExplicitLoadEditLedgerFromBaseline(args: {
  baseline: AcceptedLoadEditLedgerBaseline;
  sourceActionOrIntentId: string;
  affectedDates: readonly string[];
  sourceActor?: ReversibleAdjustmentActor;
  sourceSurface?: ReversibleAdjustmentSurface;
  /** Temporary source fact that authored this edit (for cascade-revert on clear). */
  sourceFactId?: string;
}): ReversibleAdjustmentRecord | null {
  const afterState = useProgramStore.getState();
  const afterProgram = programSurfaces(afterState);
  const afterContext = materialContext(afterState);
  const profile = useProfileStore.getState().onboardingData;
  const candidateDates = Array.from(new Set(args.affectedDates.map((date) => date.slice(0, 10)))).sort();
  const weeks = Array.from(new Set(candidateDates.map(mondayForDate))).sort();
  const beforeWorkouts = acceptedWorkoutsForDates({
    surfaces: args.baseline.program,
    context: args.baseline.context,
    profile,
    dates: candidateDates,
  });
  const afterWorkouts = acceptedWorkoutsForDates({
    surfaces: afterProgram,
    context: afterContext,
    profile,
    dates: candidateDates,
  });
  const beforeSurfaceRows = acceptedSurfaceRowsForDates({
    surfaces: args.baseline.program,
    context: args.baseline.context,
    profile,
    dates: candidateDates,
  });
  const afterSurfaceRows = acceptedSurfaceRowsForDates({
    surfaces: afterProgram,
    context: afterContext,
    profile,
    dates: candidateDates,
  });
  const changedDates = candidateDates.filter((date) =>
    reversibleAdjustmentWorkoutFingerprint(date, beforeWorkouts.get(date) ?? null) !==
      reversibleAdjustmentWorkoutFingerprint(date, afterWorkouts.get(date) ?? null) ||
    semanticFingerprint(args.baseline.program.dateOverrides[date] ?? null) !==
      semanticFingerprint(afterProgram.dateOverrides[date] ?? null));
  const ownedDays: ReversibleAdjustmentOwnedDayDelta[] = changedDates.map((date) => ({
    date,
    weekStart: mondayForDate(date),
    beforeWorkout: cloneAccepted(beforeWorkouts.get(date) ?? null),
    beforeSurfaceOwner: beforeSurfaceRows.get(date)?.owner ?? 'empty',
    afterSurfaceOwner: afterSurfaceRows.get(date)?.owner ?? 'empty',
    beforeSurfaceWorkout: cloneAccepted(beforeSurfaceRows.get(date)?.workout ?? null),
    beforeDateOverride: cloneAccepted(args.baseline.program.dateOverrides[date] ?? null),
    beforeOverrideContext: cloneAccepted(args.baseline.program.overrideContexts[date] ?? null),
    beforeFingerprint: reversibleAdjustmentWorkoutFingerprint(date, beforeWorkouts.get(date) ?? null),
    afterFingerprint: reversibleAdjustmentWorkoutFingerprint(date, afterWorkouts.get(date) ?? null),
    // LR-26: identity + fingerprints, never the after-state copies.
    afterStableIdentity: afterWorkouts.get(date)?.planEntryId
      ?? afterWorkouts.get(date)?.id ?? null,
    afterDateOverrideFingerprint: semanticFingerprint(afterProgram.dateOverrides[date] ?? null),
    afterOverrideContextFingerprint: semanticFingerprint(
      afterProgram.overrideContexts[date] ?? null),
  }));
  const ownedWeeks: ReversibleAdjustmentOwnedWeekDelta[] = weeks.flatMap((weekStart) => {
    const before = contractForAcceptedWeek(args.baseline.program, weekStart) ?? null;
    const after = contractForAcceptedWeek(afterProgram, weekStart) ?? null;
    const beforeFingerprint = semanticFingerprint(before);
    const afterFingerprint = semanticFingerprint(after);
    return beforeFingerprint === afterFingerprint ? [] : [{
      weekStart,
      beforeExposureContract: before ? cloneAccepted(before) : null,
      afterExposureContract: after ? cloneAccepted(after) : null,
      beforeFingerprint,
      afterFingerprint,
    }];
  });
  if (ownedDays.length === 0 && ownedWeeks.length === 0) return null;
  const createdAt = new Date().toISOString();
  const id = reversibleAdjustmentId({
    kind: 'explicit_load_edit',
    sourceActionOrIntentId: args.sourceActionOrIntentId,
    createdAt,
  });
  const beforeReductions = new Set(acceptedLinkedReductions(args.baseline.program, weeks)
    .map(linkedReductionSignature));
  const linkedTypedReductions = acceptedLinkedReductions(afterProgram, weeks)
    .filter((entry) => !beforeReductions.has(linkedReductionSignature(entry)));
  const record: ReversibleAdjustmentRecord = {
    protocolVersion: REVERSIBLE_ADJUSTMENT_PROTOCOL_VERSION,
    id,
    kind: 'explicit_load_edit',
    sourceActor: args.sourceActor ?? 'athlete',
    sourceSurface: args.sourceSurface ?? 'coach_chat',
    sourceActionOrIntentId: args.sourceActionOrIntentId,
    ...(args.sourceFactId ? { sourceFactId: args.sourceFactId } : {}),
    createdAt,
    acceptedRevision: afterContext.revision,
    status: 'active',
    clearedAt: null,
    supersededById: null,
    supersededReason: null,
    affectedDates: changedDates,
    affectedWeeks: weeks,
    rollingDependencyWeeks: weeks,
    displacedOriginalState: {
      ownedDays,
      ownedWeeks,
      calendarFacts: [],
      userRemovalConstraint: null,
    },
    acceptedAfterSemanticFingerprints: ownedDays.map((entry) => ({
      date: entry.date,
      fingerprint: entry.afterFingerprint,
    })),
    restorationTarget: {
      kind: 'session',
      dates: changedDates,
      stableIdentities: Array.from(new Set(ownedDays.flatMap((entry) => [
        entry.beforeWorkout?.planEntryId ?? entry.beforeWorkout?.id,
        entry.afterStableIdentity,
      ].filter((value): value is string => !!value)))).sort(),
    },
    linkedConstraintIds: [],
    linkedCalendarFacts: [],
    linkedOverrideOwners: changedDates.map((date) => ({
      date,
      ownerId: overrideOwnerId(afterProgram.overrideContexts[date]),
    })),
    linkedOverlayIds: [],
    linkedUserRemovalConstraintIds: [],
    linkedProvenanceIds: [],
    linkedTypedReductions,
    validity: {
      reversible: true,
      source: 'runtime_exact_delta',
      validWhile: ['accepted_after_semantic_fingerprints_match'],
      invalidWhen: ['newer_athlete_intent_owns_same_target', 'owned_day_fingerprint_changes'],
    },
    laterIntentPolicy: 'newer_athlete_intent_wins',
  };
  commitAcceptedStateTransaction({
    // The athlete just edited their load and this records the delta that edit
    // produced. The decision is theirs and it is new.
    operation: 'forward_decision',
    reason: 'explicit_load_edit:record_exact_delta',
    program: {
      reversibleAdjustmentLedger: {
        protocolVersion: REVERSIBLE_ADJUSTMENT_PROTOCOL_VERSION,
        adjustments: [...afterProgram.reversibleAdjustmentLedger.adjustments, record],
      },
    },
    validateWeekStarts: weeks,
  });
  return record;
}

function mondayForDate(date: string): string {
  const value = new Date(`${date.slice(0, 10)}T12:00:00`);
  value.setDate(value.getDate() - ((value.getDay() + 6) % 7));
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function dayNameForDate(date: string): DayOfWeek {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
    new Date(`${date}T12:00:00`).getDay()
  ] as DayOfWeek;
}

function datesInWeek(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, offset) => addDaysISO(weekStart, offset));
}

function fixtureFromContract(
  contract: WeeklyExposureContractV2 | undefined,
  weekStart: string,
  ownedPhase: ReturnType<typeof ownSeasonPhase>,
): TargetWeekFixture[] {
  const anchor = contract?.anchors.find((candidate) =>
    candidate.kind === 'game' || candidate.kind === 'practice_match');
  if (!anchor) return [];
  return [{
    date: datesInWeek(weekStart).find((date) =>
      new Date(`${date}T12:00:00`).getDay() === anchor.dayOfWeek)!,
    // An anchor already authored as a practice match stays one; otherwise the
    // owned phase decides, through the one expression.
    kind: anchor.kind === 'practice_match'
      ? 'practice_match'
      : canonicalFixtureKind(ownedPhase),
  }];
}

export function buildFixtureProjection(args: {
  program: TrainingProgram;
  profile: OnboardingData;
  weekStart: string;
  markedDays: Record<string, CalendarDayType>;
  sourceSurfaces?: AcceptedEffectiveWeekSurfaces;
  sourceMarkedDays?: Readonly<Record<string, CalendarDayType>>;
  activeConstraints?: readonly ActiveConstraint[];
  mutationIntent?: FixtureMutationIntent;
  /**
   * THE WORLD THE REPLAN IS JUDGED AGAINST, when it differs from the world the
   * week is COMPOSED FROM (`docs/SURFACES_CONTEXT_RULING_2026-08-06.md`).
   *
   * Two surfaces objects, because a staging transaction genuinely has two
   * worlds: a delete composes from the world where the binned target is still
   * present (it is the relocation template) and is judged against the world
   * where it is gone. Omitted means the two are the same world, which is what
   * every non-staging caller means.
   */
  evaluationSurfaces?: AcceptedEffectiveWeekSurfaces;
  /**
   * Is this projection APPLYING A NEW FIXTURE DECISION, or re-materialising
   * the accepted week's existing fixture marks?
   *
   * They are different operations and only the first may not read the week's
   * own published output — see the fixture identity law below. The MAINTENANCE
   * callers leave this false and compose over the existing overlay: the
   * calendar-mark door, the removal/move constraint door, fixture-adjustment
   * restoration, the program-setup rebuild, and every DEPENDENT week inside
   * `stageRollingHorizonFixtureRepair`. For those the overlay is the state
   * being maintained — the bed relocated work lands in — not a previous
   * decision's product.
   */
  appliesFixtureDecision?: boolean;
}): {
  overlay: WeekScopedWorkoutOverlay;
  profile: OnboardingData;
  replan: FixtureMinimalReplanResult;
  alternatives: Array<{
    overlay: WeekScopedWorkoutOverlay;
    replan: FixtureMinimalReplanResult;
  }>;
} {
  const weekDates = new Set(datesInWeek(args.weekStart));
  const explicitGameDate = Object.entries(args.markedDays)
    .filter(([date, mark]) => weekDates.has(date) && mark === 'game')
    .map(([date]) => date)
    .sort()[0] ?? null;
  const explicitNoGame = Object.entries(args.markedDays).some(
    ([date, mark]) => weekDates.has(date) && mark === 'noGame',
  );
  const liveState = useProgramStore.getState();
  // THE ONE DEFAULT TO THE LIVE WORLD (the ruling names this line). Every
  // other site passes the surfaces it means; this is the single place where a
  // caller that said nothing resolves to the world as persisted.
  const sourceSurfaces = args.sourceSurfaces ?? {
    ...liveAcceptedEffectiveWeekSurfaces(),
    currentProgram: args.program,
  };
  // A caller that names only one world is judged against the world it composes
  // from. That is not a second default to live — it is the identity case.
  const evaluationSurfaces = args.evaluationSurfaces ?? sourceSurfaces;
  // THE FIXTURE IDENTITY LAW (Sam's ruling, option A, 2026-08-05):
  // A FIXTURE DECISION NEVER REBASES FROM THE WEEK A PREVIOUS FIXTURE BUILT.
  //
  // `weekScopedOverlays[weekStart]` is this week's own PUBLISHED OUTPUT. Feed
  // it back in here and a fixture mutation composes over the previous
  // fixture's repair product, so the sequence becomes path-dependent: adding
  // a game to a rest Saturday and removing it again did not restore the week,
  // it RE-REPAIRED the week the add had built, and the carried-forward repair
  // state filled the freed Saturday with a strength-and-conditioning day
  // (Sam's R1 device pass, `fixtureIdentityTests` cell 1 — five of seven days
  // differed, so it was never about Saturdays).
  //
  // Dropping it loses no athlete decision, and that is not a hope — it is
  // what the precedence owner directly above `composedWorkouts` already
  // states: "`date_override` is an athlete-owned surface; `week_overlay` is
  // not — a scoped-regen overlay is authored by a source fact, not by the
  // athlete". The athlete's decisions live in `dateOverrides` and
  // `userRemovalConstraints`, both of which stay in `sourceSurfaces` and go on
  // being conserved exactly as before. What the overlay holds is DERIVED
  // content — fact-authored regen, and the last fixture's repair — and
  // derived content is re-derived here from the facts and constraints this
  // function already reads, never carried forward. That is the north star at
  // one call site: conservation comes from the inputs, not from a stored
  // output.
  //
  // Scoped to the week being projected, deliberately: adjacent weeks in the
  // rolling horizon are each projected by their own call, which drops their
  // own overlay and no one else's.
  //
  // AND SCOPED TO THE OPERATION THAT EARNS IT (`appliesFixtureDecision`). The
  // first cut of this law dropped the overlay for every caller and broke two
  // athlete-DELETION regressions — a Sunday conditioning deletion stopped
  // relocating to Saturday, and conditioning stopped stacking onto Monday's
  // strength. That is not a remembered scar: R5.3's condition 1(b) re-priced
  // the same surface by mutation on 2026-08-06 and `test:athlete-session-deletion`
  // printed TRUE_EXIT=1 with fourteen failures against a baseline of zero,
  // because the maintenance overlay is WHERE RELOCATED WORK LANDS. Applying a
  // decision and maintaining a week are different operations; the caller says
  // which.
  const rebaseOverlays = { ...sourceSurfaces.weekScopedOverlays };
  if (args.appliesFixtureDecision) delete rebaseOverlays[args.weekStart];
  const acceptedSource = rebaseAcceptedEffectiveWeek({
    surfaces: { ...sourceSurfaces, weekScopedOverlays: rebaseOverlays },
    weekStart: args.weekStart,
    profile: args.profile,
    markedDays: args.sourceMarkedDays ?? materialContext(liveState).markedDays,
  });
  const sourceContract = acceptedSource.contract;
  // Mutation structure comes from the accepted precedence-composed snapshot.
  // Only identity-matched accepted prescriptions and dependency-owned work
  // are materialised later; unrelated visible-only fill never becomes input.
  const sourceCanonicalWorkouts = acceptedSource.composedWorkouts;
  const ownedPhase = ownSeasonPhase({ program: args.program, profile: args.profile });
  const contractFixtures = fixtureFromContract(sourceContract, args.weekStart, ownedPhase);
  const visibleFixtureWorkouts = sourceCanonicalWorkouts.filter((workout) =>
    workout.workoutType === 'Game');
  const priorFixtures = contractFixtures.length > 0
    ? contractFixtures
    : visibleFixtureWorkouts.length > 0
      ? visibleFixtureWorkouts.map((workout) => ({
          date: datesInWeek(args.weekStart).find((date) =>
            new Date(`${date}T12:00:00`).getDay() === workout.dayOfWeek)!,
          kind: canonicalFixtureKind(ownedPhase),
        }))
      : [];
  const proposedFixtures = targetWeekFixtures({
    profile: args.profile,
    weekStart: args.weekStart,
    markedDays: args.markedDays,
    ownedPhase,
  });
  const targetGameDay = proposedFixtures[0]
    ? dayNameForDate(proposedFixtures[0].date)
    : null;
  const activeFixtureDates = effectiveFixtureDatesForWeeks({
    profile: args.profile,
    markedDays: args.markedDays,
    weekStarts: [
      addDaysISO(args.weekStart, -7),
      args.weekStart,
      addDaysISO(args.weekStart, 7),
    ],
  });
  const availability = resolveFixtureConditionedAvailability({
    profile: args.profile,
    weekStart: args.weekStart,
    priorFixtures,
    proposedFixtures,
    proposedMarkedDays: args.markedDays,
    ownedPhase,
    byeUsualGameDay: explicitNoGame || proposedFixtures.length === 0,
    activeConstraints: args.activeConstraints,
  });
  let target: TrainingProgram | undefined;
  let targetMicrocycle: Microcycle | undefined;
  const athleteAuthoredMutation = args.mutationIntent === 'athlete_move' ||
    args.mutationIntent === 'athlete_removal' ||
    args.mutationIntent === 'athlete_addition' ||
    args.mutationIntent === 'restore_adjustment';
  if (athleteAuthoredMutation) {
    // The athlete has already supplied the complete source-of-truth candidate.
    // Re-running program generation here creates a second representation that
    // can change exposure targets before the accepted-week gateway sees the
    // move/deletion. Repair the accepted visible snapshot against its accepted
    // Contract v2 ledger instead.
    const base = acceptedSource.baseMicrocycle;
    const now = appDateNow().toISOString();
    targetMicrocycle = {
      id: `athlete-mutation-target:${args.weekStart}`,
      programId: args.program.id,
      weekNumber: base?.weekNumber ?? 1,
      startDate: args.weekStart,
      endDate: addDaysISO(args.weekStart, 6),
      miniCycleNumber: base?.miniCycleNumber ?? 1,
      intensityMultiplier: base?.intensityMultiplier ?? 1,
      weekKind: sourceContract.identity.weekKind,
      exposureContractV2: sourceContract,
      workouts: sourceCanonicalWorkouts,
      createdAt: base?.createdAt ?? now,
      updatedAt: now,
    };
  } else {
    try {
      target = generateProgramLocally(args.profile, {
        // ACCEPTANCE AUTHORS THE BLOCK. Sam: "add one typed
        // BlockExerciseSelection history record at BLOCK ACCEPTANCE." This is
        // that door, and it is the only mutation boundary in production.
        recordSelections: 'author',
        // DECLARED, and the strictness is the point: the `catch` immediately
        // below CONSUMES `Section18WeekAcceptanceError` as the signal that the
        // repair owner — not target generation — must decide. Left unstated
        // this relied on generation's default; stated, the reliance is visible
        // to anyone changing either side.
        weekAcceptance: 'restoration',
        todayISO: args.weekStart,
        previousProgram: args.program,
        seasonPhaseClock: args.program.seasonPhaseClock,
        targetWeekAvailability: availability,
        targetFixtureDay: targetGameDay,
        activeConstraints: args.activeConstraints,
        microcycleLimit: 1,
      });
      targetMicrocycle = target.microcycles[0];
      // WEEK IDENTITY IS THE COVERING WEEK'S, NEVER THE STUB'S (R5.3,
      // 2026-08-06 — measured by the derived-declaration entry gate,
      // `docs/R53_DECLARATION_READER_CENSUS_2026-08-06.md`).
      //
      // The call above regenerates ONE microcycle (`microcycleLimit: 1`)
      // starting at `args.weekStart`, so that microcycle is week 1 of its own
      // little program and its contract is stamped `globalWeek: 1,
      // weekInBlock: 1` — truthfully, for the stub. It is NOT week 1 of the
      // athlete's block, and every consumer downstream believes the stamp:
      // `weeklyExposureContractV2.ts` stores `globalWeek ?? null` and
      // `section18AcceptedWeekGateway.ts:223` reads `?? 1`, then the allocator
      // alternates its patterns on `weekNumber % 2`
      // (`programBlockState.ts:190-205`). So WEEK 1's PATTERNS GET PLANNED ONTO
      // WEEK 2: measured on `fixture-identity-3` as `Lower Hinge|7` published
      // where derivation says `Lower Squat|8`, with Monday's and Wednesday's
      // training halves swapped — the same signature as the L16 relaunch red.
      //
      // The identity is not the stub's to invent. It belongs to the microcycle
      // that COVERS this week, which the accepted source already resolved.
      // This survives the derived-declaration switchover: the projection stops
      // being PUBLISHED there, but it still decides the sweep and the rolling
      // horizon, and a repair planned on the wrong week is wrong either way.
      const coveringWeek = acceptedSource.baseMicrocycle;
      if (coveringWeek && targetMicrocycle?.exposureContractV2) {
        targetMicrocycle = {
          ...targetMicrocycle,
          weekNumber: coveringWeek.weekNumber,
          miniCycleNumber: coveringWeek.miniCycleNumber,
          exposureContractV2: {
            ...targetMicrocycle.exposureContractV2,
            identity: {
              ...targetMicrocycle.exposureContractV2.identity,
              globalWeek: coveringWeek.weekNumber,
              weekInBlock: ((Math.max(1, coveringWeek.weekNumber) - 1) % 4) + 1,
              blockNumber: coveringWeek.miniCycleNumber,
            },
          },
        };
      }
    } catch (error) {
      if (!(error instanceof Section18WeekAcceptanceError)) throw error;
      // The rolling repair owner, not target generation, decides whether the
      // accepted source can be repaired. Preserve the rejected generator's
      // phase-owned contract/candidate and let the shared search consume it
      // instead of treating one invalid fallback representation as terminal.
      const base = acceptedSource.baseMicrocycle;
      const now = appDateNow().toISOString();
      targetMicrocycle = {
        id: `repair-target:${args.weekStart}`,
        programId: args.program.id,
        weekNumber: base?.weekNumber ?? 1,
        startDate: args.weekStart,
        endDate: addDaysISO(args.weekStart, 6),
        miniCycleNumber: base?.miniCycleNumber ?? 1,
        intensityMultiplier: base?.intensityMultiplier ?? 1,
        weekKind: error.result.contract.identity.weekKind,
        exposureContractV2: error.result.contract,
        workouts: error.result.canonicalWorkouts,
        createdAt: base?.createdAt ?? now,
        updatedAt: now,
      };
    }
  }
  if (!targetMicrocycle) throw new Error('Fixture target generation produced no microcycle');
  if (!target) {
    target = {
      ...args.program,
      id: `repair-target-program:${args.weekStart}`,
      startDate: args.weekStart,
      endDate: addDaysISO(args.weekStart, 6),
      microcycles: [targetMicrocycle],
      updatedAt: appDateNow().toISOString(),
    };
  }
  const replan = buildFixtureMinimalReplan({
    profile: args.profile,
    weekStart: args.weekStart,
    sourceWorkouts: sourceCanonicalWorkouts,
    targetMicrocycle,
    availability,
    proposedMarkedDays: args.markedDays,
    priorFixtures,
    proposedFixtures,
    activeFixtureDates,
    surfaces: evaluationSurfaces,
    mutationIntent: args.mutationIntent ?? 'fixture_transition',
  });
  // Dynamic loading avoids an initialisation cycle: weekRebuild itself uses
  // this transaction owner for its final publication.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { buildWeekScopedWorkoutOverlay } = require('../utils/weekRebuild');
  const alternatives = replan.alternatives.map((alternative) => {
    const alternativeReplan: FixtureMinimalReplanResult = {
      ...replan,
      workouts: alternative.workouts,
      gateway: alternative.gateway,
      editCost: alternative.editCost,
      changedDays: alternative.changedDays,
      addedDays: alternative.addedDays,
      removedDays: alternative.removedDays,
      preservedCorePlanEntryIds: alternative.preservedCorePlanEntryIds,
    };
    const minimallyReplannedTarget: TrainingProgram = {
      ...target,
      microcycles: target.microcycles.map((microcycle, index) => index === 0 ? {
        ...microcycle,
        // THE VISIBLE-INTO-CANONICAL MERGE IS GONE (demolition area B/E,
        // 2026-08-19). `materialiseVisibleSystemWork` took the resolver's
        // READ-TIME derived sessions and wrote them into the accepted week,
        // so a filler the resolver synthesised for display became accepted
        // programming. `sessionResolver` documents what that cost: the stored
        // filler arrived back as a `templateWorkout` on the next resolve and
        // snapshotted itself into its own successor — provenance depth +1 and
        // payload x2, every launch, on disk.
        //
        // The canonical week is what gets accepted. Derived sessions are
        // derived on every read, from the accepted choices and the active
        // facts, and are never promoted.
        workouts: alternative.workouts,
        exposureContractV2: alternative.gateway.contract,
      } : microcycle),
    };
    return {
      replan: alternativeReplan,
      overlay: buildWeekScopedWorkoutOverlay({
        program: minimallyReplannedTarget,
        weekStart: args.weekStart,
        anchorDate: explicitGameDate,
        reason: explicitGameDate ? 'one_off_game' : 'one_off_no_game',
      }),
    };
  });
  const selected = alternatives[0];
  if (!selected) throw new Error('Fixture replan returned no accepted alternative');
  return {
    profile: args.profile,
    overlay: selected.overlay,
    replan: selected.replan,
    alternatives,
  };
}

export interface RollingHorizonFixtureRepairProjection {
  weekStart: string;
  overlay: WeekScopedWorkoutOverlay;
  replan: FixtureMinimalReplanResult;
}

export interface RollingHorizonFixtureCandidateScore {
  blockingWeeks: number;
  unavailableDayUses: number;
  boundaryHardTransitions: number;
  staleDependencies: number;
  changedCoreSessions: number;
  changedPlanEntryIdsOrPrescriptions: number;
  totalChangedDays: number;
  restDeficit: number;
  releasedFixtureDayPenalty: number;
  optionalBeforeCoreViolation: number;
  patternImbalance: number;
  duplicateStrengthPatternPenalty: number;
  excessiveActiveStreak: number;
}

export interface RollingHorizonFixtureRepairResult {
  outcome: 'accepted';
  weekStarts: string[];
  projections: RollingHorizonFixtureRepairProjection[];
  totalChangedDays: number;
  horizonScore: RollingHorizonFixtureCandidateScore;
  searchedCandidates: number;
  searchTruncated: boolean;
}

const HORIZON_SCORE_ORDER: readonly (keyof RollingHorizonFixtureCandidateScore)[] = [
  'blockingWeeks',
  'unavailableDayUses',
  'boundaryHardTransitions',
  'staleDependencies',
  'changedCoreSessions',
  'changedPlanEntryIdsOrPrescriptions',
  'totalChangedDays',
  'restDeficit',
  'releasedFixtureDayPenalty',
  'optionalBeforeCoreViolation',
  'patternImbalance',
  'duplicateStrengthPatternPenalty',
  'excessiveActiveStreak',
];

function compareRollingHorizonFixtureScores(
  left: RollingHorizonFixtureCandidateScore,
  right: RollingHorizonFixtureCandidateScore,
): number {
  for (const key of HORIZON_SCORE_ORDER) {
    const delta = left[key] - right[key];
    if (delta !== 0) return delta;
  }
  return 0;
}

function emptyRollingHorizonFixtureScore(): RollingHorizonFixtureCandidateScore {
  return {
    blockingWeeks: 0,
    unavailableDayUses: 0,
    boundaryHardTransitions: 0,
    staleDependencies: 0,
    changedCoreSessions: 0,
    changedPlanEntryIdsOrPrescriptions: 0,
    totalChangedDays: 0,
    restDeficit: 0,
    releasedFixtureDayPenalty: 0,
    optionalBeforeCoreViolation: 0,
    patternImbalance: 0,
    duplicateStrengthPatternPenalty: 0,
    excessiveActiveStreak: 0,
  };
}

function sumFixtureEditCosts(
  projections: readonly RollingHorizonFixtureRepairProjection[],
): FixtureReplanEditCost {
  const seed: FixtureReplanEditCost = {
    section18Blockers: 0,
    unavailableDayUses: 0,
    changedCoreSessions: 0,
    changedDays: 0,
    changedPlanEntryIdsOrPrescriptions: 0,
    releasedFixtureDayPenalty: 0,
    patternImbalance: 0,
    restDeficit: 0,
    duplicateStrengthPatternPenalty: 0,
    excessiveActiveStreak: 0,
    optionalBeforeCoreViolation: 0,
  };
  return projections.reduce((total, projection) => {
    for (const key of Object.keys(seed) as Array<keyof FixtureReplanEditCost>) {
      total[key] += projection.replan.editCost[key];
    }
    return total;
  }, seed);
}

function scoreRollingHorizonFixtureCandidate(args: {
  projections: readonly RollingHorizonFixtureRepairProjection[];
  activeFixtureDates: ReadonlySet<string>;
}): RollingHorizonFixtureCandidateScore {
  const projections = [...args.projections].sort((left, right) =>
    left.weekStart.localeCompare(right.weekStart));
  const costs = sumFixtureEditCosts(projections);
  let boundaryHardTransitions = 0;
  for (let index = 0; index < projections.length - 1; index++) {
    const current = projections[index];
    const following = projections[index + 1];
    if (addDaysISO(current.weekStart, 7) !== following.weekStart) continue;
    const currentHard = current.replan.gateway.evaluation.ledger.restStress.hardDays.includes(0);
    const followingHard = following.replan.gateway.evaluation.ledger.restStress.hardDays.includes(1);
    if (currentHard && followingHard) boundaryHardTransitions += 1;
  }
  const staleDependencies = projections.reduce((total, projection) => total +
    projection.replan.gateway.canonicalWorkouts.reduce((workoutTotal, workout) =>
      workoutTotal + (workout.derivedSessionProvenance ?? []).filter((record) =>
        record.dependency && !args.activeFixtureDates.has(record.dependency.source.date)).length,
    0), 0);
  return {
    blockingWeeks: projections.filter((projection) =>
      projection.replan.gateway.evaluation.blockingViolations.length > 0).length,
    unavailableDayUses: costs.unavailableDayUses,
    boundaryHardTransitions,
    staleDependencies,
    changedCoreSessions: costs.changedCoreSessions,
    changedPlanEntryIdsOrPrescriptions: costs.changedPlanEntryIdsOrPrescriptions,
    totalChangedDays: costs.changedDays,
    restDeficit: costs.restDeficit,
    releasedFixtureDayPenalty: costs.releasedFixtureDayPenalty,
    optionalBeforeCoreViolation: costs.optionalBeforeCoreViolation,
    patternImbalance: costs.patternImbalance,
    duplicateStrengthPatternPenalty: costs.duplicateStrengthPatternPenalty,
    excessiveActiveStreak: costs.excessiveActiveStreak,
  };
}

function rollingHorizonFixtureSignature(
  projections: readonly RollingHorizonFixtureRepairProjection[],
): string {
  return projections.map((projection) => [
    projection.weekStart,
    ...projection.replan.gateway.canonicalWorkouts
      .map((workout) => `${workout.dayOfWeek}:${workout.planEntryId ?? workout.id}:${workout.name}`)
      .sort(),
  ].join('|')).join('||');
}

/**
 * The sole fixture rolling-horizon staging owner. It closes the dependency
 * graph, repairs every materialised week from the same accepted snapshot and
 * returns no partial publication. Callers may commit only the complete result.
 */
export function stageRollingHorizonFixtureRepair(args: {
  program: TrainingProgram;
  profile: OnboardingData;
  beforeMarkedDays: Readonly<Record<string, CalendarDayType>>;
  afterMarkedDays: Record<string, CalendarDayType>;
  sourceSurfaces: AcceptedEffectiveWeekSurfaces;
  activeConstraints?: readonly ActiveConstraint[];
  primaryWeekStarts: readonly string[];
  primaryMutationIntent?: FixtureMutationIntent;
  dependentMutationIntent?: FixtureMutationIntent;
  /** Forwarded verbatim — see `buildFixtureProjection`'s own field. */
  evaluationSurfaces?: AcceptedEffectiveWeekSurfaces;
  /**
   * Set by the fixture door: this staging is APPLYING a fixture decision, so
   * the PRIMARY weeks — the ones the decision is about — may not rebase from
   * their own published output (the fixture identity law, in
   * `buildFixtureProjection`). Dependent weeks are being repaired rather than
   * decided, so they compose over their existing overlay as before.
   */
  appliesFixtureDecision?: boolean;
}): RollingHorizonFixtureRepairResult {
  const trace = currentAthleteActionTrace();
  const primary = new Set(args.primaryWeekStarts.map((weekStart) => mondayForDate(weekStart)));
  const fixtureWeeks = rollingHorizonWeekStartsForMutation({
      before: args.beforeMarkedDays,
      after: args.afterMarkedDays,
      surfaces: args.sourceSurfaces,
    });
  // Athlete moves/deletions can touch persisted cross-week provenance even
  // when no fixture mark changed. Close the dependency graph from the actual
  // mutation weeks as well as any G-relative fixture window.
  const weekStarts = rollingHorizonDependencyClosure({
    seedWeekStarts: [...primary, ...fixtureWeeks],
    surfaces: args.sourceSurfaces,
  })
    .filter((weekStart) => args.program.microcycles.some((microcycle) =>
      weekStart >= microcycle.startDate.slice(0, 10) &&
      weekStart <= microcycle.endDate.slice(0, 10)))
    .sort();
  emitAthleteActionEvent(trace, 'repair_horizon_selected', {
    dependencyWeeksSelected: weekStarts,
    primaryWeeks: Array.from(primary).sort(),
    mutationIntent: args.primaryMutationIntent ?? 'fixture_transition',
    boundary: 'stageRollingHorizonFixtureRepair',
  });
  if (weekStarts.length === 0) {
    return {
      outcome: 'accepted',
      weekStarts: [],
      projections: [],
      totalChangedDays: 0,
      horizonScore: emptyRollingHorizonFixtureScore(),
      searchedCandidates: 0,
      searchTruncated: false,
    };
  }
  const projectionResults = weekStarts.map((weekStart) => ({
    weekStart,
    projection: buildFixtureProjection({
      program: args.program,
      profile: args.profile,
      weekStart,
      markedDays: args.afterMarkedDays,
      sourceSurfaces: args.sourceSurfaces,
      sourceMarkedDays: args.beforeMarkedDays,
      activeConstraints: args.activeConstraints,
      evaluationSurfaces: args.evaluationSurfaces,
      mutationIntent: primary.has(weekStart)
        ? args.primaryMutationIntent ?? 'fixture_transition'
        : args.dependentMutationIntent ?? 'remove_from_date',
      appliesFixtureDecision: !!args.appliesFixtureDecision && primary.has(weekStart),
    }),
  }));
  const activeFixtureDates = effectiveFixtureDatesForWeeks({
    profile: args.profile,
    markedDays: args.afterMarkedDays,
    weekStarts,
  });
  const search = searchRollingHorizonCandidateCombinations({
    candidateGroups: projectionResults.map(({ weekStart, projection }) =>
      projection.alternatives.map((alternative) => ({
        weekStart,
        overlay: alternative.overlay,
        replan: alternative.replan,
      }))),
    score: (candidate) => scoreRollingHorizonFixtureCandidate({
      projections: candidate,
      activeFixtureDates,
    }),
    compare: compareRollingHorizonFixtureScores,
    signature: rollingHorizonFixtureSignature,
    maxCandidates: 64,
  });
  if (!search) throw new Error('Rolling fixture repair produced no complete horizon candidate');
  const projections = search.candidate;
  const statuses = projections.map((projection) => projection.replan.gateway.status);
  /* §18 answers accepted or impossible. The three authored statuses this used
   * to rank between — fallback, regenerated, repaired — named weeks the
   * validator had built itself, and it no longer builds any. */
  const outcome = 'accepted' as const;
  emitAthleteActionEvent(trace, 'repair_candidates_generated', {
    candidateCount: search.searchedCandidates,
    candidateGroupCounts: projectionResults.map(({ projection }) =>
      projection.alternatives.length),
    searchTruncated: search.truncated,
    boundary: 'searchRollingHorizonCandidateCombinations',
  });
  emitAthleteActionEvent(trace, 'repair_candidate_selected', {
    candidateId: athleteActionDiagnosticHash(rollingHorizonFixtureSignature(projections)),
    candidateScore: search.score,
    preservationCost: sumFixtureEditCosts(projections),
    candidateChanges: projections.map((projection) => ({
      weekId: projection.weekStart,
      changedDates: [
        ...projection.replan.changedDays,
        ...projection.replan.addedDays,
        ...projection.replan.removedDays,
      ],
    })),
    outcome,
    boundary: 'stageRollingHorizonFixtureRepair',
  });
  return {
    outcome,
    weekStarts,
    projections,
    totalChangedDays: projections.reduce((total, projection) =>
      total + projection.replan.changedDays.length, 0),
    horizonScore: search.score,
    searchedCandidates: search.searchedCandidates,
    searchTruncated: search.truncated,
  };
}

export function commitCalendarMarkTransaction(args: {
  date: string;
  mark: CalendarDayType | null;
  expectedCurrentMark?: CalendarDayType;
  todayISO?: string;
}): AcceptedStateTransactionResult {
  const state = useProgramStore.getState();
  const prior = materialContext(state);
  const markedDays = { ...prior.markedDays };
  const current = markedDays[args.date];
  if (args.expectedCurrentMark && current !== args.expectedCurrentMark) {
    return { program: programSurfaces(state), context: prior };
  }
  const weekStart = mondayForDate(args.date);
  if (args.mark === null) delete markedDays[args.date];
  else markedDays[args.date] = args.mark;
  if (args.mark === 'game') {
    for (const date of datesInWeek(weekStart)) {
      if (
        date !== args.date &&
        (markedDays[date] === 'game' || markedDays[date] === 'noGame')
      ) delete markedDays[date];
    }
  } else if (args.mark === 'noGame') {
    for (const date of datesInWeek(weekStart)) {
      if (markedDays[date] === 'game') delete markedDays[date];
    }
  } else if (args.mark === null && current === 'game') {
    const profile = useProfileStore.getState().onboardingData;
    const recurringDay = storedGameAnchor(profile);
    if (recurringDay) {
      const recurringDate = datesInWeek(weekStart)
        .find((date) => dayNameForDate(date) === recurringDay);
      if (recurringDate) markedDays[recurringDate] = 'noGame';
    }
  }
  return commitCalendarStateTransaction({
    reason: `calendar:${args.mark ?? 'clear'}:${args.date}`,
    markedDays,
    affectedDates: [args.date],
    fixtureChangedDates: current === 'game' || current === 'noGame' ||
      args.mark === 'game' || args.mark === 'noGame' ? [args.date] : [],
    todayISO: args.todayISO,
  });
}

/**
 * Pure fixture-mark proposal used by the rebuild owner. A week rebuild must
 * not call calendar actions during its commit; the proposed marks travel in
 * the same accepted snapshot as the rebuilt program and overlay.
 */
export function proposeFixtureMarkedDays(args: {
  profile: OnboardingData;
  targetDate: string;
  newGameDay: DayOfWeek | null;
  previousFixtureDate?: string;
}): Record<string, CalendarDayType> {
  const prior = materialContext(useProgramStore.getState());
  const markedDays = { ...prior.markedDays };
  const targetWeekStart = mondayForDate(args.targetDate);

  if (args.previousFixtureDate) delete markedDays[args.previousFixtureDate];
  if (args.newGameDay) {
    for (const date of datesInWeek(targetWeekStart)) {
      if (markedDays[date] === 'game' || markedDays[date] === 'noGame') {
        delete markedDays[date];
      }
    }
    markedDays[args.targetDate] = 'game';
    return markedDays;
  }

  if (markedDays[args.targetDate] === 'game') delete markedDays[args.targetDate];
  const recurringDay = storedGameAnchor(args.profile);
  if (recurringDay) {
    const recurringDate = datesInWeek(targetWeekStart)
      .find((date) => dayNameForDate(date) === recurringDay);
    if (recurringDate) markedDays[recurringDate] = 'noGame';
  }
  return markedDays;
}

export function commitCalendarStateTransaction(args: {
  reason: string;
  todayISO?: string;
  markedDays: Record<string, CalendarDayType>;
  affectedDates: readonly string[];
  fixtureChangedDates?: readonly string[];
  program?: Partial<AcceptedProgramSurfaces>;
  mutationIntent?: FixtureMutationIntent;
}): AcceptedStateTransactionResult {
  const state = useProgramStore.getState();
  const baseProfile = useProfileStore.getState().onboardingData;
  const prior = materialContext(state);
  const affectedWeeks = new Set(args.affectedDates.map(mondayForDate));
  const fixtureWeeks = new Set((args.fixtureChangedDates ?? []).map(mondayForDate));
  const overlays = {
    ...state.weekScopedOverlays,
    ...(args.program?.weekScopedOverlays ?? {}),
  };
  if (state.currentProgram && baseProfile) {
    const proposedUserRemovalConstraints = args.program?.userRemovalConstraints ??
      state.userRemovalConstraints;
    const repair = stageRollingHorizonFixtureRepair({
      program: state.currentProgram,
      profile: baseProfile,
      beforeMarkedDays: prior.markedDays,
      afterMarkedDays: args.markedDays,
      sourceSurfaces: storedWorldSurfaces(state),
      activeConstraints: prior.activeConstraints,
      primaryWeekStarts: Array.from(
        args.mutationIntent === 'athlete_removal' ? affectedWeeks : fixtureWeeks,
      ),
      primaryMutationIntent: args.mutationIntent,
      dependentMutationIntent: 'remove_from_date',
      evaluationSurfaces: storedWorldSurfaces({
        ...state,
        userRemovalConstraints: proposedUserRemovalConstraints,
      }),
    });
    for (const projection of repair.projections) {
      affectedWeeks.add(projection.weekStart);
      overlays[projection.weekStart] = projection.overlay;
    }
  }
  return commitAcceptedStateTransaction({
    // A calendar mark IS the athlete stating a fact about their life — the
    // founding case for accept-and-reduce. The mark is kept and the shortfall
    // disclosed; it is never refused back at them.
    operation: 'forward_decision',
    reason: args.reason,
    todayISO: args.todayISO,
    program: { ...(args.program ?? {}), weekScopedOverlays: overlays },
    markedDays: args.markedDays,
    validateWeekStarts: Array.from(affectedWeeks),
    profile: baseProfile,
  });
}

/**
 * Atomic whole-session/date removal. The accepted target row remains in the
 * planner input, the proposed rest mark removes that date, and any compulsory
 * exposure is relocated before one program/calendar snapshot is published.
 */
export function commitDateUnavailableTransaction(args: {
  date: string;
  reason: string;
}): AcceptedStateTransactionResult {
  const state = useProgramStore.getState();
  const prior = materialContext(state);
  const markedDays = { ...prior.markedDays, [args.date]: 'rest' as const };
  const dateOverrides = { ...state.dateOverrides };
  const overrideContexts = { ...state.overrideContexts };
  delete dateOverrides[args.date];
  delete overrideContexts[args.date];
  return commitCalendarStateTransaction({
    reason: args.reason,
    markedDays,
    affectedDates: [args.date],
    fixtureChangedDates: prior.markedDays[args.date] === 'game' ||
      prior.markedDays[args.date] === 'noGame' ? [args.date] : [],
    program: { dateOverrides, overrideContexts },
    mutationIntent: 'remove_from_date',
  });
}

/**
 * Shared athlete-deletion owner for tap and Coach producers.
 *
 * The typed removal is staged with every repaired week and Contract v2
 * reduction. No producer writes a temporary Rest workout or independently
 * decides whether CORE content is deletable.
 */
export interface AthleteSessionDeletionTransactionInput {
  date: string;
  reason: string;
  source: 'tap' | 'coach';
  scope: UserRemovalScope;
  originalWorkout: Workout;
  remainingWorkout: Workout | null;
  equivalentExposureMayRelocate?: boolean;
}

export type AthleteDeletionPublishedOutcomeKind =
  | 'relocated'
  | 'stacked'
  | 'substituted'
  | 'already_satisfied'
  | 'reduced';

export type AthleteDeletionAffectedMetric =
  | 'main_strength'
  | 'conditioning_core'
  | 'session';

/** Per-metric quantified shortfall vs the optimal week (authorised reduction). */
export interface AthleteReductionShortfall {
  metric: string;
  originalApprovedTarget: number;
  reducedTarget: number;
}

/** Typed result derived from the accepted, publishable deletion state. */
export interface AthleteDeletionPublishedOutcome {
  kind: AthleteDeletionPublishedOutcomeKind;
  affectedMetric: AthleteDeletionAffectedMetric;
  targetDate: string;
  deletionIdentity: string;
  /** Day the displaced required work relocated to (null when reduced/none). */
  destinationDate: string | null;
  reductionMetrics: string[];
  /**
   * Quantified loss vs the optimal week when the displaced work could not be
   * relocated. Empty for a relocation. Carries the data the ask-before-
   * restructure / quantified-notice UX (preview-gate stage) will surface.
   */
  reductions: AthleteReductionShortfall[];
  removedPatterns: string[];
  /**
   * Every day other than the target the whole-week §18 repair changed
   * (disclosed-repair parity with the addition path's `repairedDates`). Names
   * the residual days a Bin/removal touched beyond `destinationDate` — e.g. an
   * unrelated day the repair emptied — so the confirmation can disclose them.
   */
  repairedDates: string[];
}

export interface AthleteSessionDeletionTransactionResult
  extends AcceptedStateTransactionResult, AthleteMutationPublication {
  deletionOutcome: AthleteDeletionPublishedOutcome;
}

/** A net-new session placed on a previously empty/rest day. */
export interface AthleteSessionAdditionTransactionInput {
  date: string;
  reason: string;
  source: 'tap' | 'coach';
  /** Already materialised (through finaliseWorkoutAfterMutation) new session. */
  addedWorkout: Workout;
}

export type AthleteAdditionPublishedOutcomeKind = 'added' | 'added_with_repair';

/** Typed result derived from the accepted, publishable addition state. */
export interface AthleteAdditionPublishedOutcome {
  kind: AthleteAdditionPublishedOutcomeKind;
  targetDate: string;
  additionIdentity: string;
  /** Days other than the target the whole-week §18 repair touched (disclosed). */
  repairedDates: string[];
}

export interface AthleteSessionAdditionTransactionResult
  extends AcceptedStateTransactionResult, AthleteMutationPublication {
  additionOutcome: AthleteAdditionPublishedOutcome;
}

export interface AthleteSessionMoveTransactionInput {
  sourceDate: string;
  targetDate: string;
  reason: string;
  source: 'tap' | 'coach';
  acceptedSourcePlanEntryId: string | null;
  sourceWorkoutId: string;
  originalSourceWorkout: Workout;
  existingTargetWorkout: Workout | null;
  scope: 'whole_session';
  /**
   * The session that actually LANDS, when it is not the source session verbatim
   * — the G-1 ask-flow's accessories-only and deloaded routes.
   *
   * It must carry the source session's identity (`rules/g1LandingAsk` guarantees
   * this), so the move stays one atomic transaction and the conservation
   * post-condition still sees the athlete's session survive. `originalWorkout`
   * on the constraint is unaffected and remains the FULL accepted session, so
   * Undo restores exactly what was there before the athlete chose a route.
   */
  placedSession?: { route?: G1LandingRouteId; workout: Workout } | null;
  /**
   * The placed session ALREADY CONTAINS the destination's content — a move onto
   * a team night, which lands as a combined day (Sam's doubling law). There is
   * nothing to swap back, and swapping would take the anchor off the day.
   */
  placedSessionAbsorbsTarget?: boolean;
  /**
   * A SESSION-scoped move off a combined day (Sam, 2026-07-30): the gym session
   * leaves, team training stays anchored. Both halves arrive together from one
   * `splitAcceptedSessionForAthleteMove` call so the day that stays and the
   * session that leaves cannot disagree about which rows went where.
   *
   * Absent = the whole-day move every caller meant before scoping existed.
   */
  componentSplit?: { movedWorkout: Workout; remainingWorkout: Workout | null } | null;
}

export interface AthleteMutationTransactionStage {
  proposal: AcceptedStateTransactionProposal | null;
  result: AcceptedStateTransactionResult;
  adjustment: ReversibleAdjustmentRecord | null;
  affectedWeekStarts: string[];
  outcome: RollingHorizonFixtureRepairResult['outcome'] | 'already_applied';
  alreadyApplied: boolean;
  /** Set exactly when `alreadyApplied` — see AthleteMutationNoChange. */
  noChange?: AthleteMutationNoChange | null;
}

/**
 * A stage that published NOTHING, and why.
 *
 * Sam's ruling #6 (2026-07-30). The `already_applied` short-circuits below
 * return before any proposal is built, so the commit functions returned
 * normally and every caller read that as success — the device symptom was
 * "Done. Lower Body Strength is now on <date>" printed over a day holding a
 * Gunshow, with the stored constraint naming a third session. Nothing published
 * is an OUTCOME with a reason; it travels on the result so no caller has to
 * infer it from the absence of a throw. The reason code is the one
 * `rules/programMutationRefusal` maps to athlete-facing copy.
 */
export interface AthleteMutationNoChange {
  reason: 'athlete_mutation_already_applied';
  /** The constraint that already owns this date. */
  constraintId: string;
  date: string;
}

/** Every athlete-mutation commit answers "did anything publish?" the same way. */
export interface AthleteMutationPublication {
  noChange: AthleteMutationNoChange | null;
}

function workoutIdentity(workout: Workout | null | undefined): string | null {
  return workout ? workout.planEntryId ?? workout.id : null;
}

function acceptedWorkoutForDate(args: {
  date: string;
  state: ProgramState;
  context: AcceptedMaterialContext;
  profile: OnboardingData;
}): Workout | null {
  const weekStart = mondayForDate(args.date);
  const accepted = rebaseAcceptedEffectiveWeek({
    surfaces: storedWorldSurfaces(args.state),
    weekStart,
    profile: args.profile,
    markedDays: args.context.markedDays,
  });
  const dayOfWeek = new Date(`${args.date}T12:00:00`).getDay();
  return accepted.visibleWorkouts.find((workout) => workout.dayOfWeek === dayOfWeek) ?? null;
}

function cloneWorkoutForDate(workout: Workout, date: string): Workout {
  return {
    ...JSON.parse(JSON.stringify(workout)) as Workout,
    dayOfWeek: new Date(`${date}T12:00:00`).getDay(),
  };
}

function meaningfulStrengthPatterns(workout: Workout | null | undefined): string[] {
  if (!workout) return [];
  const typed = workout.exercises.flatMap((row) =>
    row.section18Evidence?.role === 'main_strength' &&
      row.section18Evidence.mainStrengthPattern
      ? [row.section18Evidence.mainStrengthPattern]
      : []);
  return Array.from(new Set(typed.length > 0
    ? typed
    : workout.strengthIntent?.effectivePatterns ?? []));
}

function dateForWeekDay(weekStart: string, dayOfWeek: number): string {
  return addDaysISO(weekStart, dayOfWeek === 0 ? 6 : dayOfWeek - 1);
}

/**
 * Visible exercise-content signature for a day — the prescription the athlete
 * actually sees (id + sets/reps/weight), order-independent. Drives disclosed-
 * repair (`repairedDates`): a day counts as repaired only when its visible
 * content changed, not merely its internal fingerprint (which flags metadata-
 * only differences the athlete never sees). Shared by the move conservation gate
 * to prove the moved session's content survives the transaction.
 */
function visibleExerciseSignature(workout: Workout | null | undefined): string {
  return JSON.stringify((workout?.exercises ?? [])
    .map((row) => JSON.stringify({
      exerciseId: row.exerciseId,
      sets: row.prescribedSets,
      repsMin: row.prescribedRepsMin,
      repsMax: row.prescribedRepsMax,
      weight: row.prescribedWeightKg,
    }))
    .sort());
}

function deriveAthleteDeletionPublishedOutcome(args: {
  input: AthleteSessionDeletionTransactionInput;
  before: ReturnType<typeof rebaseAcceptedEffectiveWeek>;
  published: AcceptedStateTransactionResult;
  profile: OnboardingData;
}): AthleteDeletionPublishedOutcome {
  const weekStart = mondayForDate(args.input.date);
  const after = rebaseAcceptedEffectiveWeek({
    surfaces: storedWorldSurfaces(args.published.program),
    weekStart,
    profile: args.profile,
    markedDays: args.published.context.markedDays,
  });
  const targetDay = new Date(`${args.input.date}T12:00:00`).getDay();
  const beforeByDay = new Map(args.before.visibleWorkouts.map((workout) =>
    [workout.dayOfWeek, workout]));
  const afterByDay = new Map(after.visibleWorkouts.map((workout) =>
    [workout.dayOfWeek, workout]));
  // Every day other than the target whose visible content the repair changed —
  // disclosed-repair (invariant #4). Uses the athlete-visible signature, not the
  // internal fingerprint, so metadata-only differences are not over-disclosed.
  const repairedDates = Array.from({ length: 7 }, (_unused, day) => day)
    .filter((day) => day !== targetDay)
    .filter((day) => visibleExerciseSignature(beforeByDay.get(day)) !==
      visibleExerciseSignature(afterByDay.get(day)))
    .map((day) => dateForWeekDay(weekStart, day))
    .sort();
  const removedPatterns = meaningfulStrengthPatterns(args.input.originalWorkout);
  const sourceWasMainStrength = args.input.scope === 'strength_component' || (
    args.input.scope === 'whole_session' &&
    args.before.evaluation.ledger.mainStrength.sessionDays.includes(targetDay)
  );
  const sourceWasCoreConditioning = args.input.scope === 'conditioning_component' || (
    args.input.scope === 'whole_session' &&
    args.before.evaluation.ledger.conditioning.credits.some((credit) =>
      credit.source === 'app' && credit.dayOfWeek === targetDay)
  );
  const affectedMetric: AthleteDeletionAffectedMetric = sourceWasMainStrength
    ? 'main_strength'
    : sourceWasCoreConditioning
      ? 'conditioning_core'
      : 'session';
  const reductionEntries = after.contract.authorisedReductions
    .filter((entry) => entry.reason === 'explicit_user_override' &&
      entry.detail.includes(args.input.date));
  const reductionMetrics = reductionEntries.map((entry) => entry.metric).sort();
  const reductions: AthleteReductionShortfall[] = reductionEntries.map((entry) => ({
    metric: entry.metric,
    originalApprovedTarget: entry.originalApprovedTarget,
    reducedTarget: entry.reducedTarget,
  }));
  const sourceIdentity = args.input.originalWorkout.planEntryId ??
    args.input.originalWorkout.id;
  const componentIdentity = `${sourceIdentity}:strength-component`;
  let destination = after.visibleWorkouts.find((workout) =>
    workout.dayOfWeek !== targetDay && (
      workoutIdentity(workout) === sourceIdentity ||
      workoutIdentity(workout) === componentIdentity
    ));
  if (!destination && affectedMetric === 'main_strength' && removedPatterns.length > 0) {
    destination = after.visibleWorkouts.find((workout) => {
      if (workout.dayOfWeek === targetDay) return false;
      const afterPatterns = meaningfulStrengthPatterns(workout);
      const beforePatterns = meaningfulStrengthPatterns(beforeByDay.get(workout.dayOfWeek));
      return removedPatterns.every((pattern) => afterPatterns.includes(pattern)) &&
        !removedPatterns.every((pattern) => beforePatterns.includes(pattern));
    });
  }
  if (!destination && affectedMetric === 'conditioning_core') {
    const beforeDays = new Set(args.before.evaluation.ledger.conditioning.credits
      .filter((credit) => credit.source === 'app')
      .map((credit) => credit.dayOfWeek));
    const destinationDay = after.evaluation.ledger.conditioning.credits.find((credit) =>
      credit.source === 'app' && credit.dayOfWeek !== targetDay &&
      !beforeDays.has(credit.dayOfWeek))?.dayOfWeek;
    if (destinationDay !== undefined) destination = afterByDay.get(destinationDay);
  }
  const deletionIdentity = userRemovalConstraintId({
    date: args.input.date,
    scope: args.input.scope,
    workout: args.input.originalWorkout,
  });
  if (reductionMetrics.length > 0) {
    return {
      kind: 'reduced', affectedMetric, targetDate: args.input.date,
      deletionIdentity, destinationDate: null, reductionMetrics, reductions, removedPatterns,
      repairedDates,
    };
  }
  if (!destination) {
    return {
      kind: 'already_satisfied', affectedMetric, targetDate: args.input.date,
      deletionIdentity, destinationDate: null, reductionMetrics: [], reductions: [], removedPatterns,
      repairedDates,
    };
  }
  const beforeDestination = beforeByDay.get(destination.dayOfWeek);
  const exactIdentity = workoutIdentity(destination) === sourceIdentity ||
    workoutIdentity(destination) === componentIdentity;
  const stacked = !!beforeDestination &&
    workoutIdentity(beforeDestination) === workoutIdentity(destination);
  return {
    kind: stacked ? 'stacked' : exactIdentity ? 'relocated' : 'substituted',
    affectedMetric,
    targetDate: args.input.date,
    deletionIdentity,
    destinationDate: dateForWeekDay(weekStart, destination.dayOfWeek),
    reductionMetrics: [],
    reductions: [],
    removedPatterns,
    repairedDates,
  };
}

/**
 * Shared pure staging owner for athlete moves and deletions. The typed
 * constraint is applied to the accepted composed horizon before repair, so
 * source and destination are never evaluated or published independently.
 */
function stageAthleteMutationConstraint(args: {
  reason: string;
  source: 'tap' | 'coach';
  mutationIntent: 'athlete_removal' | 'athlete_move' | 'athlete_addition';
  constraint: UserRemovalConstraint;
  affectedDates: readonly string[];
  markedDays: Record<string, CalendarDayType>;
  stagePurpose: 'preview' | 'commit';
  /** Override the derived reversible-ledger kind (e.g. an addition uses the
   *  removal machinery to pin its remainingWorkout, but records `session_add`). */
  adjustmentKind?: ReversibleAdjustmentKind;
  /**
   * Active constraints this mutation SUPERSEDES rather than conflicts with —
   * the re-add restoration (Stage B stage 1, Option C item 3). The conflict
   * filter below would silently DROP an active same-date constraint, erasing
   * the athlete's bin decision while its ledger adjustment still points at it.
   * A restoration instead flips the decision to restored/'explicit_re_add' —
   * the same semantics the retired legacy writer applied as a side effect
   * (`applyProgramOverrideWrite`), now staged in the same typed proposal.
   */
  restoreConstraintIds?: readonly string[];
}): AthleteMutationTransactionStage {
  const state = useProgramStore.getState();
  const profile = useProfileStore.getState().onboardingData;
  if (!state.currentProgram || !profile) {
    throw new Error('Athlete mutation requires an accepted program and profile');
  }
  const prior = materialContext(state);
  const restoreIds = new Set(args.restoreConstraintIds ?? []);
  const restoredAt = new Date().toISOString();
  const priorConstraints = restoreIds.size === 0
    ? state.userRemovalConstraints
    : state.userRemovalConstraints.map((candidate) =>
        restoreIds.has(candidate.id) && candidate.status === 'active'
          ? {
              ...candidate,
              status: 'restored' as const,
              restoredAt,
              restorationReason: 'explicit_re_add' as const,
            }
          : candidate);
  const userRemovalConstraints = [
    ...priorConstraints.filter((candidate) =>
      candidate.id !== args.constraint.id && !(
        candidate.status === 'active' &&
        candidate.targetDate === args.constraint.targetDate &&
        (args.constraint.scope === 'whole_session' || candidate.scope === args.constraint.scope)
      )),
    args.constraint,
  ];
  const dateOverrides = { ...state.dateOverrides };
  const overrideContexts = { ...state.overrideContexts };
  for (const date of args.affectedDates) {
    delete dateOverrides[date];
    delete overrideContexts[date];
  }
  // THE ONE SITE WHERE THE TWO FIELDS DIFFER, and it is stated rather than
  // reached (`docs/REMOVAL_RECORD_SPLIT_RULING_2026-08-06.md`).
  //
  // Deletion repair needs the accepted target still present as a relocation
  // template, so it APPLIES the prior set. A move, by contrast, must enter
  // repair with both athlete-owned halves already staged, so it applies the
  // proposed set. Either way the RECORD is the proposed one: the athlete's
  // decision has been made, and every question about WHY this week looks the
  // way it does must be answered with it — including the repair search's
  // stand-down, which is the reason a delete's search used to relocate over
  // the very decision it was composing around.
  const sourceSurfaces = composeAcceptedEffectiveWeekSurfaces({
    currentProgram: state.currentProgram,
    currentMicrocycle: state.currentMicrocycle,
    dateOverrides,
    weekScopedOverlays: state.weekScopedOverlays,
    removalDecisions: userRemovalConstraints,
    applyOnly: args.mutationIntent === 'athlete_move'
      ? userRemovalConstraints
      : state.userRemovalConstraints,
  });
  const primaryWeekStarts = Array.from(new Set(args.affectedDates.map(mondayForDate))).sort();
  const repair = stageRollingHorizonFixtureRepair({
    program: state.currentProgram,
    profile,
    beforeMarkedDays: prior.markedDays,
    afterMarkedDays: args.markedDays,
    sourceSurfaces,
    activeConstraints: prior.activeConstraints,
    primaryWeekStarts,
    primaryMutationIntent: args.mutationIntent,
    dependentMutationIntent: 'remove_from_date',
    // THE SECOND WORLD, named. The composition surface above deliberately
    // withholds the proposed constraint on a delete so the binned target
    // survives as a relocation template; the week is still JUDGED against the
    // world where the athlete's decision has landed. Two surfaces objects say
    // that; one array could not. Both carry the same RECORD.
    evaluationSurfaces: composeAcceptedEffectiveWeekSurfaces({
      ...sourceSurfaces,
      removalDecisions: userRemovalConstraints,
    }),
  });
  const weekScopedOverlays = { ...state.weekScopedOverlays };
  for (const projection of repair.projections) {
    weekScopedOverlays[projection.weekStart] = projection.overlay;
  }
  const affectedWeekStarts = repair.weekStarts.length > 0
    ? repair.weekStarts
    : primaryWeekStarts;
  const today = todayISOLocal();
  const todayConstraintWorkout = args.constraint.mutationKind === 'move' &&
    args.constraint.moveTargetDate === today
    ? cloneWorkoutForDate(args.constraint.movedWorkout!, today)
    : args.constraint.targetDate === today
      ? args.constraint.remainingWorkout
      : state.todayWorkout;
  const proposal: AcceptedStateTransactionProposal = {
    // Every mutation staged here is an athlete DECISION — a removal, a move or
    // an addition they performed. Forward, and therefore accept-and-reduce:
    // their edit stands and the shortfall is disclosed. Without this the
    // proposal inherited the strict default, which is exactly what it should do
    // when a path says nothing — and is how the newly-retired legacy stack-add
    // deferral surfaced the moment it started using this owner.
    operation: 'forward_decision',
    reason: args.reason,
    program: {
      dateOverrides,
      overrideContexts,
      weekScopedOverlays,
      userRemovalConstraints,
      ...(args.affectedDates.includes(today) ? { todayWorkout: todayConstraintWorkout } : {}),
    },
    markedDays: args.markedDays,
    validateWeekStarts: affectedWeekStarts,
    profile,
  };
  const creation = stageReversibleAdjustmentCreationTransaction({
    kind: args.adjustmentKind ?? (args.mutationIntent === 'athlete_move'
      ? 'session_move'
      : args.constraint.scope === 'whole_session'
        ? 'session_delete'
        : 'session_component_delete'),
    sourceActor: 'athlete',
    sourceSurface: args.source === 'coach' ? 'coach_chat' : 'program_tab',
    sourceActionOrIntentId: `${args.reason}:${args.constraint.id}`,
    proposal,
    affectedDates: args.affectedDates,
    restorationTarget: {
      kind: args.constraint.scope === 'whole_session' ? 'session' : 'session_component',
      dates: args.affectedDates.map((date) => date.slice(0, 10)),
      stableIdentities: [
        args.constraint.targetPlanEntryId ?? args.constraint.targetWorkoutId,
      ],
      componentScope: args.constraint.scope,
    },
    linkedUserRemovalConstraintIds: [args.constraint.id],
    userRemovalConstraint: args.constraint,
  });
  const result = creation.result;
  assertAcceptedVisibleLedgerEquivalence({
    // The athlete binned a session: a decision they stated.
    operation: 'forward_decision',
    surfaces: result.program,
    context: result.context,
    weekStarts: affectedWeekStarts,
    profile,
    trace: currentAthleteActionTrace(),
  });
  emitAthleteActionEvent(currentAthleteActionTrace(), 'mutation_transaction_staged', {
    stagePurpose: args.stagePurpose,
    mutationType: args.mutationIntent,
    dependencyWeeksSelected: affectedWeekStarts,
    selectedOutcome: repair.outcome,
    beforeStateHash: athleteActionDiagnosticHash({
      program: programSurfaces(state),
      context: prior,
    }),
    afterStateHash: athleteActionDiagnosticHash({
      program: result.program,
      context: result.context,
    }),
    boundary: 'stageAthleteMutationConstraint',
  });
  return {
    proposal: creation.proposal,
    result,
    adjustment: creation.adjustment,
    affectedWeekStarts,
    outcome: repair.outcome,
    alreadyApplied: false,
  };
}

export function stageAthleteSessionDeletionTransaction(
  args: AthleteSessionDeletionTransactionInput,
  options: { purpose?: 'preview' | 'commit' } = {},
): AthleteMutationTransactionStage {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date.slice(0, 10)) ||
    !args.originalWorkout?.id) {
    throw new Error('Malformed athlete session-deletion identity');
  }
  const date = args.date.slice(0, 10);
  const state = useProgramStore.getState();
  const prior = materialContext(state);
  const id = userRemovalConstraintId({ date, scope: args.scope, workout: args.originalWorkout });
  const existing = state.userRemovalConstraints.find((constraint) =>
    constraint.id === id && constraint.status === 'active');
  if (existing) {
    return {
      proposal: null,
      result: { program: programSurfaces(state), context: prior },
      adjustment: state.reversibleAdjustmentLedger.adjustments.find((adjustment) =>
        adjustment.linkedUserRemovalConstraintIds.includes(id)) ?? null,
      affectedWeekStarts: [mondayForDate(date)],
      outcome: 'already_applied',
      alreadyApplied: true,
      noChange: {
        reason: 'athlete_mutation_already_applied',
        constraintId: id,
        date: date,
      },
    };
  }
  // A swap rides this deletion with a non-null remainingWorkout (the new
  // session). When content remains on the day it is not a whole-day rest, so
  // rest-ownership and the rest calendar mark follow the surviving content —
  // mirroring the move transaction (wholeDayRestOwned: !swappedWorkout). For
  // every existing Bin case (whole_session ⇒ remainingWorkout null) this is
  // byte-identical to the previous unconditional behaviour.
  const remainingWorkout = args.remainingWorkout && args.remainingWorkout.workoutType !== 'Rest'
    ? JSON.parse(JSON.stringify(args.remainingWorkout)) as Workout
    : null;
  const wholeDayRest = args.scope === 'whole_session' && !remainingWorkout;
  const constraint: UserRemovalConstraint = {
    protocolVersion: 1,
    id,
    authorship: 'user',
    source: args.source,
    mutationKind: 'deletion',
    status: 'active',
    targetDate: date,
    scope: args.scope,
    targetPlanEntryId: args.originalWorkout.planEntryId ?? null,
    targetWorkoutId: args.originalWorkout.id,
    originalWorkout: JSON.parse(JSON.stringify(args.originalWorkout)) as Workout,
    remainingWorkout,
    equivalentExposureMayRelocate: args.equivalentExposureMayRelocate ?? true,
    wholeDayRestOwned: wholeDayRest,
    createdAt: new Date().toISOString(),
    restoredAt: null,
    restorationReason: null,
  };
  emitAthleteActionEvent(currentAthleteActionTrace(), 'mutation_constraint_created', {
    constraintType: 'user_removal',
    constraintId: constraint.id,
    constraintStatus: constraint.status,
    targetDate: constraint.targetDate,
    planEntryId: constraint.targetPlanEntryId,
    workoutId: constraint.targetWorkoutId,
    scope: constraint.scope,
    equivalentExposureMayRelocate: constraint.equivalentExposureMayRelocate,
    wholeDayRestOwned: constraint.wholeDayRestOwned,
    provenanceIdentity: `${constraint.authorship}:${constraint.source}:${constraint.id}`,
  });
  // A DELETION DOOR NEVER WRITES A CALENDAR MARK (Sam, 2026-07-30).
  //
  // This wrote `markedDays[date] = 'rest'` whenever a whole-session bin emptied
  // a day. "There is no session here today" and "this is a rest day" are
  // different claims: the first is what the athlete said, the second is a
  // standing instruction to the planner of the same class as a game mark — and
  // nothing on the athlete's path took it back.
  //
  // The emptiness is still OWNED; it is owned the way placed content is, by the
  // constraint and its stamp (see rules/userRemovalConstraints). The calendar is
  // left to the calendar's own doors.
  const markedDays = { ...prior.markedDays };
  return stageAthleteMutationConstraint({
    reason: args.reason,
    source: args.source,
    mutationIntent: 'athlete_removal',
    constraint,
    affectedDates: [date],
    markedDays,
    stagePurpose: options.purpose ?? 'preview',
  });
}

export function stageAthleteSessionMoveTransaction(
  args: AthleteSessionMoveTransactionInput,
  options: { purpose?: 'preview' | 'commit' } = {},
): AthleteMutationTransactionStage {
  const sourceDate = args.sourceDate.slice(0, 10);
  const targetDate = args.targetDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sourceDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(targetDate) ||
    sourceDate === targetDate ||
    !args.originalSourceWorkout?.id ||
    !args.sourceWorkoutId) {
    throw new Error('Malformed athlete session-move identity');
  }
  const state = useProgramStore.getState();
  const profile = useProfileStore.getState().onboardingData;
  if (!profile) throw new Error('Athlete move requires an accepted profile');
  const prior = materialContext(state);
  // THE MOVE DOOR'S IDENTITY ORACLE, declared red and NOT fixed here.
  //
  // The oracle reads the MATERIALISED week while the athlete acts on the
  // DERIVED one, so under tier-4-at-read a durable move on a re-planned day is
  // refused (`program-control-durable`, 2026-08-05/06 coordinate). Retiring it
  // to the derived basis was built and REFUTED AS SCOPED: the door has TWO
  // caller classes on TWO visible bases — the sheet route resolves
  // `resolveWeekWithConditioning`, the G-1 landing flow captures from
  // `rebaseAcceptedEffectiveWeek` — and either basis breaks the other class.
  // A per-caller fallback would be the compatibility path this repo forbids.
  // The payer is the recorded door-unification debt (one visible basis for
  // every door); see `docs/R53_LANDING_SET_BUILT_2026-08-07.md`.
  const acceptedSource = acceptedWorkoutForDate({ date: sourceDate, state, context: prior, profile });
  const expectedSourceIdentity = args.acceptedSourcePlanEntryId ?? args.sourceWorkoutId;
  if (!acceptedSource || workoutIdentity(acceptedSource) !== expectedSourceIdentity ||
    workoutIdentity(args.originalSourceWorkout) !== expectedSourceIdentity) {
    throw new Error('Accepted athlete move source identity changed');
  }
  const acceptedTarget = acceptedWorkoutForDate({ date: targetDate, state, context: prior, profile });
  if (workoutIdentity(acceptedTarget) !== workoutIdentity(args.existingTargetWorkout)) {
    throw new Error('Accepted athlete move target identity changed');
  }
  const id = userMoveConstraintId({
    sourceDate,
    targetDate,
    workout: acceptedSource,
  });
  const existing = state.userRemovalConstraints.find((constraint) =>
    constraint.id === id && constraint.status === 'active');
  if (existing) {
    return {
      proposal: null,
      result: { program: programSurfaces(state), context: prior },
      adjustment: state.reversibleAdjustmentLedger.adjustments.find((adjustment) =>
        adjustment.linkedUserRemovalConstraintIds.includes(id)) ?? null,
      affectedWeekStarts: Array.from(new Set([mondayForDate(sourceDate), mondayForDate(targetDate)])).sort(),
      outcome: 'already_applied',
      alreadyApplied: true,
      noChange: {
        reason: 'athlete_mutation_already_applied',
        constraintId: id,
        date: sourceDate,
      },
    };
  }
  // The athlete's chosen route decides WHAT lands; the source session decides
  // WHOSE it is. `placedSession` always carries the source identity, so this
  // stays one session moving rather than a delete plus an add.
  //
  // AN ABSORBING PLACEMENT IS ALREADY BOTH HALVES, so it outranks the component.
  // This ordering was written when a scoped move's destination was a free day by
  // construction — the same stale assumption the swap branch below still states
  // in words — so putting the moved component first was safe. Under Sam's
  // doubling law a scoped move may land on a team night, where
  // `stackSessionOntoTeamAnchor` has already combined the anchor WITH the moved
  // component. Taking `componentSplit.movedWorkout` there threw the anchor away,
  // and the conservation post-condition caught it exactly as it should:
  // `athlete_move_content_not_conserved`, "Move would silently destroy session".
  // The athlete was refused a destination his own menu had just offered him.
  //
  // `placedSessionAbsorbsTarget` is the existing typed statement of "this
  // placement contains the destination too", so it is asked rather than
  // re-derived.
  const placed = (args.placedSessionAbsorbsTarget && args.placedSession?.workout)
    ? args.placedSession.workout
    : args.componentSplit?.movedWorkout
      ?? args.placedSession?.workout
      ?? acceptedSource;
  const movedWorkout = cloneWorkoutForDate(placed, targetDate);
  // A game-proximity FILLER on the destination is not a swap partner. It is
  // regenerated every render from the fixture, so relocating it to the source
  // day would materialise resolver-owned content as athlete-owned content and
  // duplicate it the moment the resolver rebuilt the original. Discard it and
  // let the source day become rest, exactly as a move onto an empty day does.
  const acceptedTargetIsSwappable = !isResolverOwnedDerivedSession(acceptedTarget);
  // A scoped move leaves the REMAINDER of the source day behind rather than a
  // swapped-back partner: the destination is a free day by construction, so
  // there is nothing to swap and the day it left is not emptied.
  const swappedWorkout = args.componentSplit
    ? (args.componentSplit.remainingWorkout
        ? cloneWorkoutForDate(args.componentSplit.remainingWorkout, sourceDate)
        : null)
    : acceptedTarget && acceptedTargetIsSwappable && !args.placedSessionAbsorbsTarget
      ? cloneWorkoutForDate(acceptedTarget, sourceDate)
      : null;
  const constraint: UserRemovalConstraint = {
    protocolVersion: 1,
    id,
    authorship: 'user',
    source: args.source,
    mutationKind: 'move',
    status: 'active',
    targetDate: sourceDate,
    scope: 'whole_session',
    targetPlanEntryId: acceptedSource.planEntryId ?? null,
    targetWorkoutId: acceptedSource.id,
    originalWorkout: JSON.parse(JSON.stringify(acceptedSource)) as Workout,
    remainingWorkout: swappedWorkout,
    equivalentExposureMayRelocate: true,
    wholeDayRestOwned: !swappedWorkout,
    moveTargetDate: targetDate,
    moveTargetPlanEntryId: movedWorkout.planEntryId ?? null,
    moveTargetWorkoutId: movedWorkout.id,
    movedWorkout,
    createdAt: new Date().toISOString(),
    restoredAt: null,
    restorationReason: null,
  };
  emitAthleteActionEvent(currentAthleteActionTrace(), 'mutation_constraint_created', {
    constraintType: 'user_move',
    constraintId: constraint.id,
    constraintStatus: constraint.status,
    sourceDate,
    targetDate,
    planEntryId: constraint.targetPlanEntryId,
    workoutId: constraint.targetWorkoutId,
    moveTargetPlanEntryId: constraint.moveTargetPlanEntryId,
    swap: !!swappedWorkout,
    provenanceIdentity: `${constraint.authorship}:${constraint.source}:${constraint.id}`,
  });
  // A MOVE DOOR NEVER WRITES A CALENDAR MARK EITHER (LR-29 undo, 2026-08-09).
  //
  // This wrote `markedDays[sourceDate] = 'rest'`, and it is the SAME write Sam
  // ruled out of the deletion door on 2026-07-30 — the ruling is 160 lines up
  // in this file, and the reasoning transfers verbatim: "there is no session
  // here today" and "this is a rest day" are different claims, and only the
  // first is what the athlete said by dragging a session off Friday.
  //
  // WHAT MADE IT VISIBLE was undo. A calendar mark is not a ledger decision, so
  // annul-and-re-derive could not take it back: the athlete undid the move and
  // the source day stayed empty for a reason nothing on their path could reach
  // (`docs/LR29_UNDO_BUILD_BOUNDARY_2026-08-09.md`).
  //
  // THE EMPTINESS IS ALREADY OWNED, WHICH IS WHY THIS IS A DELETION AND NOT A
  // REPLACEMENT. The constraint built above carries `wholeDayRestOwned:
  // !swappedWorkout`, and `rules/userRemovalConstraints` already pushes the
  // canonical rest stub for exactly that shape — the mechanism the deletion
  // ruling installed after removing the mark ALONE put the derived G-1 session
  // straight back onto the cleared day. A move was carrying both: the stub that
  // owns the emptiness and a standing instruction to the planner beside it.
  //
  // The target-date clear STAYS: moving a session ONTO a day is a reason to
  // stop calling that day rest, and that is a removal of a mark, not an
  // authoring of one.
  const markedDays = { ...prior.markedDays };
  if (markedDays[sourceDate] === 'rest' && swappedWorkout) delete markedDays[sourceDate];
  if (markedDays[targetDate] === 'rest') delete markedDays[targetDate];
  return stageAthleteMutationConstraint({
    reason: args.reason,
    source: args.source,
    mutationIntent: 'athlete_move',
    constraint,
    affectedDates: [sourceDate, targetDate],
    markedDays,
    stagePurpose: options.purpose ?? 'preview',
  });
}

export function commitAthleteSessionDeletionTransaction(
  args: AthleteSessionDeletionTransactionInput,
): AthleteSessionDeletionTransactionResult {
  const state = useProgramStore.getState();
  const profile = useProfileStore.getState().onboardingData;
  if (!profile) throw new Error('Athlete deletion requires an accepted profile');
  const beforeContext = materialContext(state);
  const before = rebaseAcceptedEffectiveWeek({
    surfaces: storedWorldSurfaces(state),
    weekStart: mondayForDate(args.date),
    profile,
    markedDays: beforeContext.markedDays,
  });
  const staged = stageAthleteSessionDeletionTransaction(args, { purpose: 'commit' });
  const published = staged.proposal
    ? commitAcceptedStateTransaction(staged.proposal)
    : staged.result;
  return {
    ...published,
    noChange: staged.noChange ?? null,
    deletionOutcome: deriveAthleteDeletionPublishedOutcome({
      input: args,
      before,
      published,
      profile,
    }),
  };
}

/**
 * Content-conservation post-condition for a pure Move/Swap. Resolves the PUBLISHED
 * week (the reliable, §18-canonicalised result — the same source the deletion
 * outcome reads) and returns a violation code when an athlete-owned session that
 * the move relocated has been silently destroyed or duplicated. Resolver-owned
 * game-proximity fillers (G-1 Gunshow / G+1 Recovery) are excluded — they are
 * regenerated every render and legitimately churn. Survival is by stable identity
 * (planEntryId ?? id), so a legitimate §18 repair that alters a session's
 * prescription is not read as a loss. Returns null when the move conserved
 * content (e.g. a protected-core session preserved on a virtual-game proximity
 * day). Uses the shared visible-content view (`visibleWorkouts`).
 */
function detectAthleteMoveContentLoss(args: {
  moved: Workout;
  displaced: Workout | null | undefined;
  weekStarts: readonly string[];
  profile: OnboardingData;
}): { code: string; message: string } | null {
  const identity = (workout: Workout): string => workout.planEntryId ?? workout.id;
  // Resolve the PUBLISHED week from the live store (commitAcceptedStateTransaction
  // has already applied the move to it) — the same full-surfaces view the read
  // model and tests use, so the moved session's base content is present.
  const publishedState = useProgramStore.getState();
  const publishedMarkedDays = materialContext(publishedState).markedDays;
  const afterIdentities = new Map<string, number>();
  for (const weekStart of Array.from(new Set(args.weekStarts))) {
    const after = rebaseAcceptedEffectiveWeek({
      surfaces: storedWorldSurfaces(publishedState),
      weekStart,
      profile: args.profile,
      markedDays: publishedMarkedDays,
    });
    for (const workout of after.visibleWorkouts) {
      if (isResolverOwnedDerivedSession(workout)) continue;
      const id = identity(workout);
      afterIdentities.set(id, (afterIdentities.get(id) ?? 0) + 1);
    }
  }
  const mustSurvive = [args.moved, args.displaced].filter(
    (workout): workout is Workout => !!workout && !isResolverOwnedDerivedSession(workout),
  );
  for (const workout of mustSurvive) {
    if (!afterIdentities.has(identity(workout))) {
      return {
        code: 'athlete_move_content_not_conserved',
        message: `Move would silently destroy session ${identity(workout)}`,
      };
    }
  }
  const duplicated = [...afterIdentities.entries()].find(([, count]) => count > 1);
  if (duplicated) {
    return {
      code: 'athlete_move_duplicated_session',
      message: `Move would duplicate session ${duplicated[0]} across days`,
    };
  }
  return null;
}

export function commitAthleteSessionMoveTransaction(
  args: AthleteSessionMoveTransactionInput,
): AcceptedStateTransactionResult & AthleteMutationPublication {
  const priorState = { ...useProgramStore.getState() };
  const profile = useProfileStore.getState().onboardingData;
  const staged = stageAthleteSessionMoveTransaction(args, { purpose: 'commit' });
  if (!staged.proposal) return { ...staged.result, noChange: staged.noChange ?? null };
  const published = commitAcceptedStateTransaction(staged.proposal);
  // Conservation post-condition (defense-in-depth behind the producer's
  // not-swappable guard): a relocation must never silently destroy an athlete-
  // owned session. Checked against the PUBLISHED week; on violation the publish
  // is rolled back in-memory (restoring the exact prior surfaces) before the
  // throw, so nothing is left half-applied. Reaches direct-transaction callers
  // (Coach door, hydration) that bypass the producer gate.
  if (profile) {
    const violation = detectAthleteMoveContentLoss({
      // A scoped move conserves the two HALVES of the split, not the combined
      // day identity — that identity no longer names anything after the split.
      //
      // An ABSORBING move is the mirror image: the source session and the team
      // night become one combined day, so it is the COMBINED identity that must
      // survive and the source identity that stops naming anything. Nothing was
      // displaced — the anchor never left — so there is no second survivor to
      // require. Sam's doubling law, and the same reasoning as the split above.
      moved: args.placedSessionAbsorbsTarget
        ? args.placedSession?.workout ?? args.originalSourceWorkout
        : args.componentSplit?.movedWorkout ?? args.originalSourceWorkout,
      displaced: args.placedSessionAbsorbsTarget
        ? null
        : args.componentSplit
          ? args.componentSplit.remainingWorkout
          : args.existingTargetWorkout,
      weekStarts: staged.affectedWeekStarts,
      profile,
    });
    if (violation) {
      useProgramStore.setState(priorState);
      const error = new Error(violation.message) as Error & { code?: string };
      error.code = violation.code;
      throw error;
    }
  }
  return { ...published, noChange: null };
}

/**
 * Dedicated owner for an athlete addition onto an empty/rest day. An add pins its
 * new session the SAME way a swap does — a whole-session constraint whose
 * `remainingWorkout` the §18 gateway must keep (`applyUserRemovalConstraintsToWeek`);
 * this is the single mechanism by which user-authored content survives §18. What
 * makes it an ADD rather than a removal: the pinned-away `originalWorkout` is the
 * day's base **Rest** placeholder — ZERO displaced training, so no relocation and
 * no authorised reduction may attach — and it records a `session_add` reversible
 * adjustment (not `session_delete`). Undo returns the day to that Rest placeholder.
 */
export function stageAthleteSessionAdditionTransaction(
  args: AthleteSessionAdditionTransactionInput,
  options: { purpose?: 'preview' | 'commit' } = {},
): AthleteMutationTransactionStage {
  const date = args.date.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !args.addedWorkout?.id) {
    throw new Error('Malformed athlete session-addition identity');
  }
  const state = useProgramStore.getState();
  const profile = useProfileStore.getState().onboardingData;
  if (!state.currentProgram || !profile) {
    throw new Error('Athlete addition requires an accepted program and profile');
  }
  const prior = materialContext(state);
  const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
  // The base placeholder the athlete is filling (the composed day, which includes
  // Rest days that visibleWorkouts omits). It must have a stable id to pin against
  // and to undo back to.
  const accepted = rebaseAcceptedEffectiveWeek({
    surfaces: storedWorldSurfaces(state),
    weekStart: mondayForDate(date),
    profile,
    markedDays: prior.markedDays,
  });
  const composedPlaceholder = accepted.composedWorkouts.find(
    (workout) => workout.dayOfWeek === dayOfWeek) ?? null;
  // A DAY THE ACCEPTED WEEK LEAVES EMPTY IS STILL A DAY THE ATHLETE CAN FILL.
  //
  // This threw, and the throw became "I couldn't safely make that change" on a
  // day the sheet had just offered to add to. The day after a game is the case:
  // the athlete sees a Recovery Session, but that session is resolver-owned
  // derived filler, so the COMPOSED week has nothing on that date to pin
  // against. The generator never allocated the day; the recovery is rebuilt
  // every render.
  //
  // Adding there is therefore an empty-day add against accepted state, and the
  // right thing to pin is the emptiness itself: a canonical rest stub for that
  // date, deterministic in id so the pin is stable across renders and the undo
  // restores the day to empty — at which point the derived recovery reappears on
  // its own, because deriving it is what the resolver does. It is the same
  // canonical-rest-stub shape `applyUserRemovalConstraintsToWeek` already uses
  // to own a day the athlete emptied.
  const restPlaceholder: Workout = composedPlaceholder?.id
    ? composedPlaceholder
    : {
        ...collapseWorkoutToRest(cloneWorkoutForDate(args.addedWorkout, date)),
        id: `accepted-empty-day:${date}`,
        planEntryId: undefined,
        dayOfWeek,
      };
  const addedWorkout = cloneWorkoutForDate(args.addedWorkout, date);
  // THE RE-ADD RESTORATION (Stage B stage 1, Option C item 3 — the measured
  // LR-3 residual). A whole-session bin with nothing left behind suppresses
  // the day through its active constraint. An add onto that day is a
  // RESTORATION: the emptiness decision is superseded, not deleted — flipped
  // to restored/'explicit_re_add' inside this same staged proposal, exactly
  // the semantics the retired legacy override writer applied as a side
  // effect. Add/swap pins carry a remainingWorkout and are never flipped.
  const restoreConstraintIds = state.userRemovalConstraints
    .filter((candidate) => candidate.status === 'active' &&
      candidate.targetDate === date &&
      candidate.scope === 'whole_session' &&
      !candidate.remainingWorkout)
    .map((candidate) => candidate.id);
  for (const constraintId of restoreConstraintIds) {
    emitAthleteActionEvent(currentAthleteActionTrace(), 'mutation_constraint_created', {
      constraintType: 'restoration_flip',
      constraintId,
      constraintStatus: 'restored',
      restorationReason: 'explicit_re_add',
      targetDate: date,
    });
  }
  const id = userRemovalConstraintId({ date, scope: 'whole_session', workout: restPlaceholder });
  const existing = state.userRemovalConstraints.find((constraint) =>
    constraint.id === id && constraint.status === 'active');
  if (existing) {
    return {
      proposal: null,
      result: { program: programSurfaces(state), context: prior },
      adjustment: state.reversibleAdjustmentLedger.adjustments.find((adjustment) =>
        adjustment.linkedUserRemovalConstraintIds.includes(id)) ?? null,
      affectedWeekStarts: [mondayForDate(date)],
      outcome: 'already_applied',
      alreadyApplied: true,
      noChange: {
        reason: 'athlete_mutation_already_applied',
        constraintId: id,
        date: date,
      },
    };
  }
  const constraint: UserRemovalConstraint = {
    protocolVersion: 1,
    id,
    authorship: 'user',
    source: args.source,
    mutationKind: 'deletion',
    status: 'active',
    targetDate: date,
    scope: 'whole_session',
    targetPlanEntryId: restPlaceholder.planEntryId ?? null,
    targetWorkoutId: restPlaceholder.id,
    originalWorkout: JSON.parse(JSON.stringify(restPlaceholder)) as Workout,
    remainingWorkout: addedWorkout,
    // The "removed" original is Rest → nothing displaced, so this pin must never
    // relocate work or attach an authorised reduction.
    equivalentExposureMayRelocate: false,
    wholeDayRestOwned: false,
    createdAt: new Date().toISOString(),
    restoredAt: null,
    restorationReason: null,
  };
  emitAthleteActionEvent(currentAthleteActionTrace(), 'mutation_constraint_created', {
    constraintType: 'user_addition',
    constraintId: constraint.id,
    constraintStatus: constraint.status,
    targetDate: constraint.targetDate,
    planEntryId: constraint.targetPlanEntryId,
    workoutId: constraint.targetWorkoutId,
    scope: constraint.scope,
    equivalentExposureMayRelocate: constraint.equivalentExposureMayRelocate,
    wholeDayRestOwned: constraint.wholeDayRestOwned,
    provenanceIdentity: `${constraint.authorship}:${constraint.source}:${constraint.id}`,
  });
  const markedDays = { ...prior.markedDays };
  if (markedDays[date] === 'rest') delete markedDays[date];
  return stageAthleteMutationConstraint({
    reason: args.reason,
    source: args.source,
    mutationIntent: 'athlete_addition',
    constraint,
    affectedDates: [date],
    markedDays,
    stagePurpose: options.purpose ?? 'preview',
    adjustmentKind: 'session_add',
    restoreConstraintIds,
  });
}

export function commitAthleteSessionAdditionTransaction(
  args: AthleteSessionAdditionTransactionInput,
): AthleteSessionAdditionTransactionResult {
  const staged = stageAthleteSessionAdditionTransaction(args, { purpose: 'commit' });
  const published = staged.proposal
    ? commitAcceptedStateTransaction(staged.proposal)
    : staged.result;
  const date = args.date.slice(0, 10);
  const repairedDates = Array.from(new Set((staged.adjustment?.affectedDates ?? [])
    .map((entry) => entry.slice(0, 10))))
    .filter((entry) => entry !== date)
    .sort();
  return {
    ...published,
    noChange: staged.noChange ?? null,
    additionOutcome: {
      kind: repairedDates.length > 0 ? 'added_with_repair' : 'added',
      targetDate: date,
      additionIdentity: args.addedWorkout.planEntryId ?? args.addedWorkout.id,
      repairedDates,
    },
  };
}

/**
 * Program-setup rebuild publication. Future weeks come from the newly built
 * program, while the currently accepted effective week is minimally rebased
 * through the same planner so a new availability block relocates compulsory
 * work instead of replacing the athlete's accepted strength structure.
 */
export function commitProgramSetupRebuildTransaction(args: {
  program: TrainingProgram;
  profile: OnboardingData;
  todayISO: string;
}): AcceptedStateTransactionResult {
  const state = useProgramStore.getState();
  const prior = materialContext(state);
  const weekStart = mondayForDate(args.todayISO);
  const selected = args.program.microcycles.find((microcycle) =>
    weekStart >= microcycle.startDate.slice(0, 10) &&
    weekStart <= microcycle.endDate.slice(0, 10)) ?? args.program.microcycles[0] ?? null;
  let overlays: Record<string, WeekScopedWorkoutOverlay> = {};
  const sourceHasWeek = state.currentProgram?.microcycles.some((microcycle) =>
    weekStart >= microcycle.startDate.slice(0, 10) &&
    weekStart <= microcycle.endDate.slice(0, 10));
  const targetHasWeek = args.program.microcycles.some((microcycle) =>
    weekStart >= microcycle.startDate.slice(0, 10) &&
    weekStart <= microcycle.endDate.slice(0, 10));
  if (state.currentProgram && sourceHasWeek && targetHasWeek) {
    overlays = {
      [weekStart]: buildFixtureProjection({
        program: args.program,
        profile: args.profile,
        weekStart,
        markedDays: prior.markedDays,
        sourceSurfaces: storedWorldSurfaces(state),
        sourceMarkedDays: prior.markedDays,
        activeConstraints: prior.activeConstraints,
        mutationIntent: state.userRemovalConstraints.some((constraint) =>
          constraint.status === 'active' && mondayForDate(constraint.targetDate) === weekStart)
          ? 'athlete_removal'
          : 'remove_from_date',
      }).overlay,
    };
  }
  const todayDow = new Date(`${args.todayISO}T12:00:00`).getDay();
  const todayOverlay = overlays[weekStart]?.workoutsByDate[args.todayISO] ?? null;
  return commitAcceptedStateTransaction({
    // Program setup publishes a week built FOR a profile the athlete just
    // gave. If that week cannot meet its contract that is the consequence of
    // their answers, disclosed — not a corrupt snapshot to refuse.
    operation: 'forward_decision',
    reason: 'program_setup:accepted_rebuild',
    program: {
      currentProgram: args.program,
      currentMicrocycle: selected,
      todayWorkout: todayOverlay ??
        selected?.workouts.find((workout) => workout.dayOfWeek === todayDow) ?? null,
      weekScopedOverlays: overlays,
      exposureContractsByWeek: {},
    },
    profile: args.profile,
    acceptedProfileSnapshot: {
      protocolVersion: ACCEPTED_PROFILE_SNAPSHOT_PROTOCOL_VERSION,
      capturedAt: prior.acceptedProfileSnapshot?.capturedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sourceRevision: prior.revision + 1,
      onboardingData: args.profile,
    },
    validateWeekStarts: Array.from(new Set([
      ...args.program.microcycles.map((microcycle) => microcycle.startDate.slice(0, 10)),
      ...Object.keys(overlays),
    ])),
  });
}

function readinessSignal(args: {
  date: string;
  patch: Omit<Partial<ReadinessSignal>, 'date' | 'updatedAt'>;
  previous?: ReadinessSignal;
}): ReadinessSignal {
  return {
    ...args.previous,
    ...args.patch,
    date: args.date,
    source: args.patch.source ?? args.previous?.source ?? 'quick_check',
    updatedAt: new Date().toISOString(),
  };
}

export function commitReadinessSignalTransaction(args: {
  date: string;
  patch: Omit<Partial<ReadinessSignal>, 'date' | 'updatedAt'> | null;
}): AcceptedStateTransactionResult {
  const state = useProgramStore.getState();
  const prior = materialContext(state);
  const readinessSignalsByDate = { ...prior.readinessSignalsByDate };
  if (args.patch) {
    readinessSignalsByDate[args.date] = readinessSignal({
      date: args.date,
      patch: args.patch,
      previous: readinessSignalsByDate[args.date],
    });
  } else {
    delete readinessSignalsByDate[args.date];
  }
  return commitReadinessStateTransaction({
    reason: `readiness:${args.patch ? 'set' : 'clear'}:${args.date}`,
    readinessSignalsByDate,
    affectedDates: [args.date],
  });
}

export function commitReadinessStateTransaction(args: {
  reason: string;
  readinessSignalsByDate: Record<string, ReadinessSignal>;
  affectedDates: readonly string[];
}): AcceptedStateTransactionResult {
  const state = useProgramStore.getState();
  const weekStarts = rollingHorizonDependencyClosure({
    seedWeekStarts: args.affectedDates.map(mondayForDate),
    changedTriggerDates: args.affectedDates,
    surfaces: storedWorldSurfaces(state),
  });
  return commitAcceptedStateTransaction({
    // Answering the readiness sheet is the athlete stating a fact about their
    // body. The gate informs; it does not veto a fact (§18 ownership
    // reassessment D3). Unstated, this door refused the answer outright on a
    // week the athlete's own rest marks had already made short.
    operation: 'forward_decision',
    reason: args.reason,
    readinessSignalsByDate: args.readinessSignalsByDate,
    validateWeekStarts: weekStarts,
  });
}

export function getAcceptedMaterialContext(): AcceptedMaterialContext {
  return materialContext(useProgramStore.getState());
}

export function acceptedProgramSurfaceKeys(): ReadonlyArray<keyof AcceptedProgramSurfaces> {
  return PROGRAM_SURFACE_KEYS;
}

export function currentAcceptedWeekStart(): string {
  return mondayForDate(todayISOLocal());
}
