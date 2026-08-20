import { logger } from '../utils/logger';
import {
  ACCEPTED_COMPOSITION_BASE_PROTOCOL_VERSION,
  acceptedProfileForContext,
  normalizeAcceptedMaterialContext,
  normalizeAcceptedProgramSurfaces,
  type AcceptedCompositionBaseV1,
} from './acceptedStateColdStart';
import { isoDateForWeekday } from '../utils/appDate';
import {
  assertAcceptedVisibleLedgerEquivalence,
  commitAcceptedStateTransaction,
  type AcceptedStateTransactionResult,
} from './acceptedStateTransaction';
import { runCoachMutationTransaction } from './coachMutationTransaction';
import {
  canonicaliseAcceptedStateCandidate,
  getBlockPositionForGeneration,
  statedProgressionInputs,
  useProgramStore,
} from './programStore';
import { useProfileStore } from './profileStore';
import type { WeekScopedWorkoutOverlay } from '../types/domain';
import { generateProgramLocally } from '../services/api/generateProgram';
import { buildWeekScopedWorkoutOverlay } from '../utils/weekRebuild';
import { deriveIllnessRecoveryWeekMode } from '../rules/illnessRecoveryWeekMode';
import {
  factHorizon,
  factHorizonWeeks,
  firstShapedDateInWeek,
} from '../rules/durableFactHorizon';
import { rebaseAcceptedEffectiveWeek } from '../rules/acceptedEffectiveWeek';
import {
  activeUserRemovalConstraintsForWeek,
  applyAthleteRemovalTypedReduction,
} from '../rules/userRemovalConstraints';
import {
  REVERSIBLE_ADJUSTMENT_PROTOCOL_VERSION,
  reversibleAdjustmentId,
  type ReversibleAdjustmentRecord,
} from '../rules/reversibleAdjustmentLedger';
import {
  composeTemporarySourceFactCompatibility,
  expireTemporarySourceFacts,
  isInjurySourceFact,
  isTemporarySourceFactConstraint,
  normalizeTemporarySourceFacts,
  temporarySourceFactId,
  type TemporarySourceFact,
  type TemporarySourceFactActor,
  type TemporarySourceFactStatus,
} from '../rules/temporarySourceFact';
import { semanticFingerprint } from '../utils/programSemanticSnapshot';
import {
  targetWeekFixtures,
  type FixtureAvailabilityKind,
} from '../rules/fixtureConditionedAvailability';
import { ownSeasonPhase } from '../rules/seasonPhaseOwner';
import { liveAthleteContext } from '../utils/liveAthleteContext';
import {
  buildTeamNightMoveWeekOverlay,
  isTeamNightMoveFact,
} from '../rules/teamNightMoveDerivation';
import {
  athleteActionTerminalReasonChain,
  classifyAthleteActionFailure,
  currentAthleteActionTrace,
  emitAthleteActionEvent,
  type AthleteActionTraceContext,
} from '../utils/athleteActionDiagnostics';
import { isAcceptedProfileConstraint } from '../rules/acceptedProfileProjection';

export type TemporarySourceFactOperation =
  | 'create'
  | 'update'
  | 'resolve'
  | 'expire'
  | 'supersede'
  | 'hydrate';
export type TemporarySourceFactTransactionOutcome =
  | 'created_and_recomposed'
  | 'created_no_program_change'
  | 'updated_and_recomposed'
  | 'updated_no_program_change'
  | 'resolved_and_recomposed'
  | 'resolved_no_program_change'
  | 'expired_and_recomposed'
  | 'expired_no_program_change'
  | 'superseded_and_recomposed'
  | 'superseded_no_program_change'
  | 'hydrated_and_recomposed'
  | 'hydrated_no_program_change'
  | 'no_op'
  | 'conflicted'
  | 'safely_rejected';

export interface TemporarySourceFactTransactionTestHooks {
  beforeStage?: () => void;
  beforeEffectiveValidation?: () => void;
  verifyCandidate?: () => boolean;
  verifyAfterPersistence?: () => boolean;
}

export interface TemporarySourceFactTransactionInput {
  operation: TemporarySourceFactOperation;
  /** Full replacement for one exact fact on create/update. */
  fact?: TemporarySourceFact;
  factId?: string;
  todayISO?: string;
  now?: string;
  sourceActor?: TemporarySourceFactActor;
  sourceSurface?: string;
  expectedAcceptedRevision?: number;
  testHooks?: TemporarySourceFactTransactionTestHooks;
}

/**
 * WHY an inert commit changed nothing, typed — so the acknowledgment owner can
 * select its clause from the COMMITTED result, never from the door or the date
 * alone. 'fixture_day' is Sam's §7 answer (2026-08-03): a time-cap fact whose
 * every target date is a fixture day has nothing to shorten, records inert,
 * and the athlete is told the game-day truth.
 */
export type TemporarySourceFactInertReason = 'fixture_day';

export interface TemporarySourceFactTransactionResult {
  outcome: TemporarySourceFactTransactionOutcome;
  factId: string | null;
  changedProgram: boolean;
  message: string;
  reason?: string;
  inertReason?: TemporarySourceFactInertReason;
  /** The fixture's own kind — picks the signed sentence's variant (§10). */
  inertFixtureVariant?: FixtureAvailabilityKind;
}

interface CanonicalFactOwnership {
  context: ReturnType<typeof normalizeAcceptedMaterialContext>;
  compositionBase: AcceptedCompositionBaseV1;
}

export interface CommitTemporarySourceFactSetInput {
  nextFacts: TemporarySourceFact[];
  targetFactId: string;
  todayISO: string;
  reason: string;
  /** Deterministic transaction clock for accepted fixtures and replay tests. */
  now?: string;
  expectedAcceptedRevision?: number;
  testHooks?: TemporarySourceFactTransactionTestHooks;
  /** Explicit TraceV2 correlation for async command executors. */
  trace?: AthleteActionTraceContext;
}

export interface CommitTemporarySourceFactSetResult {
  ok: boolean;
  acceptedStateChanged: boolean;
  visibleProgramChanged: boolean;
  /** @deprecated Compatibility alias for visibleProgramChanged. */
  changedProgram: boolean;
  /** Rider 3: the weeks a scoped-regen authoring actually changed, so the
   *  disclosure copy derives from the committed diff. */
  changedWeekStarts?: string[];
  reason?: string;
  route?: string;
  inertReason?: TemporarySourceFactInertReason;
  /** The fixture's own kind — picks the signed sentence's variant (§10). */
  inertFixtureVariant?: FixtureAvailabilityKind;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function addDays(dateISO: string, count: number): string {
  const date = new Date(`${dateISO.slice(0, 10)}T12:00:00`);
  date.setDate(date.getDate() + count);
  return date.toISOString().slice(0, 10);
}

function mondayFor(dateISO: string): string {
  const date = new Date(`${dateISO.slice(0, 10)}T12:00:00`);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function affectedHorizon(anchorDate: string, facts: readonly TemporarySourceFact[]): {
  weeks: string[];
  dates: string[];
} {
  const state = useProgramStore.getState();
  const weeks = new Set<string>([mondayFor(anchorDate)]);
  for (const microcycle of state.currentProgram?.microcycles ?? []) weeks.add(microcycle.startDate.slice(0, 10));
  if (state.currentMicrocycle) weeks.add(state.currentMicrocycle.startDate.slice(0, 10));
  for (const week of Object.keys(state.weekScopedOverlays ?? {})) weeks.add(week.slice(0, 10));
  for (const date of Object.keys(state.dateOverrides ?? {})) weeks.add(mondayFor(date));
  for (const fact of facts) {
    if (isInjurySourceFact(fact)) {
      for (const week of fact.affectedWeeks) weeks.add(week.slice(0, 10));
      continue;
    }
    // Stage 1: the reached weeks come from the fact's horizon, asked of its
    // owner. An OPEN horizon has no last week of its own, so it reaches every
    // week the athlete actually has — which the program weeks above already
    // enumerate. Reading `effectiveUntil` here was the third of the four
    // duration representations.
    const horizon = factHorizon(fact);
    weeks.add(mondayFor(horizon.startsFrom));
    if (horizon.endsAfter !== null) weeks.add(mondayFor(horizon.endsAfter));
  }
  const sortedWeeks = Array.from(weeks).sort();
  return {
    weeks: sortedWeeks,
    dates: sortedWeeks.flatMap((week) => Array.from({ length: 7 }, (_, offset) => addDays(week, offset)))
      .filter((date) => date >= anchorDate)
      .sort(),
  };
}

export function loadCanonicalTemporarySourceFactOwnership(now: string): CanonicalFactOwnership {
  const state = useProgramStore.getState();
  const rawContext = state.acceptedMaterialContext;
  let context = normalizeAcceptedMaterialContext(rawContext);
  let facts = context.temporarySourceFacts;
  // ⚠ THE UNOWNED-CONSTRAINT BACK-FILL IS DELETED (demolition area 4).
  //
  // It manufactured typed source facts for stored constraints that carried no
  // `injuryEpisodeId` and no `temporarySourceFactIds` — the shape of a world
  // written before typed facts existed. No production users exist, so there is
  // no such world. A constraint's WRITER produces its fact; nothing back-fills
  // one at load, which is also the only way a fact can carry honest provenance.
  facts = normalizeTemporarySourceFacts({ value: [...facts] });
  const surfaces = normalizeAcceptedProgramSurfaces(state);
  const legacyAfterStateOnly = facts.some((fact) =>
    isInjurySourceFact(fact)
      ? fact.legacyMigrationStatus === 'legacy_after_state_only'
      : fact.legacyMigrationStatus === 'legacy_after_state_only');
  const compositionBase = context.acceptedCompositionBase ?? {
    protocolVersion: ACCEPTED_COMPOSITION_BASE_PROTOCOL_VERSION,
    capturedAt: now,
    updatedAt: now,
    sourceRevision: context.revision,
    provenance: legacyAfterStateOnly
      ? 'legacy_after_state_only' as const
      : 'accepted_pre_injury' as const,
    surfaces: clone(surfaces),
  };
  const compatibility = composeTemporarySourceFactCompatibility({
    temporarySourceFacts: facts,
    activeConstraints: context.activeConstraints,
    readinessSignalsByDate: context.readinessSignalsByDate,
  });
  context = normalizeAcceptedMaterialContext({
    ...context,
    temporarySourceFacts: facts,
    injuryEpisodes: compatibility.injuryEpisodes,
    activeConstraints: compatibility.activeConstraints,
    readinessSignalsByDate: compatibility.readinessSignalsByDate,
    acceptedCompositionBase: compositionBase,
  });
  return { context, compositionBase };
}

function validateEffectiveComposition(args: {
  base: AcceptedCompositionBaseV1;
  context: ReturnType<typeof normalizeAcceptedMaterialContext>;
  weekStarts: readonly string[];
}): void {
  const profile = acceptedProfileForContext(
    args.context,
    useProfileStore.getState().onboardingData,
  );
  const projected = canonicaliseAcceptedStateCandidate(args.base.surfaces, {
    activeConstraints: args.context.activeConstraints.filter((constraint) =>
      isTemporarySourceFactConstraint(constraint) ||
      isAcceptedProfileConstraint(constraint)),
    profile,
    markedDays: args.context.markedDays,
    validateWeekStarts: args.weekStarts,
  });
  assertAcceptedVisibleLedgerEquivalence({
    // The athlete declared a life-fact (illness, readiness). Forward.
    operation: 'forward_decision',
    surfaces: normalizeAcceptedProgramSurfaces(projected),
    context: args.context,
    weekStarts: args.weekStarts,
    profile,
  });
}

/**
 * A DERIVING readiness/illness fact is an AUTHORING event: it changes what the
 * athlete is prescribed. Severe illness derives the illness_recovery §18 week
 * mode; cooked fatigue derives a readiness reduction. Neither is delivered by
 * the pure-projection resolvers (mode/reduction live only in generation), so the
 * overlay-preserving inert path is a silent no-op. This authors the reduced week
 * as a scoped regeneration committed as a week overlay + fact-linked reversible
 * adjustment: the base microcycle stays clean, the overlay
 * is the mutation layer, and clearing the fact cascade-reverts byte-exact via the
 * stored prior overlay (R12, keyed on `sourceFactId`).
 */
function buildDerivingSourceFactAdjustment(args: {
  sourceFactId: string;
  weekStart: string;
  beforeOverlay: WeekScopedWorkoutOverlay | null;
  afterOverlay: WeekScopedWorkoutOverlay;
  acceptedRevision: number;
  createdAt: string;
}): ReversibleAdjustmentRecord {
  const sourceActionOrIntentId = `${args.sourceFactId}:${args.weekStart}`;
  const id = reversibleAdjustmentId({
    kind: 'deriving_source_fact',
    sourceActionOrIntentId,
    createdAt: args.createdAt,
  });
  const affectedDates = Array.from({ length: 7 }, (_, offset) => addDays(args.weekStart, offset));
  return {
    protocolVersion: REVERSIBLE_ADJUSTMENT_PROTOCOL_VERSION,
    id,
    kind: 'deriving_source_fact',
    sourceActor: 'athlete',
    sourceSurface: 'program_tab',
    sourceActionOrIntentId,
    sourceProducer: 'tap',
    sourceFactId: args.sourceFactId,
    createdAt: args.createdAt,
    acceptedRevision: args.acceptedRevision,
    status: 'active',
    clearedAt: null,
    supersededById: null,
    supersededReason: null,
    affectedDates,
    affectedWeeks: [args.weekStart],
    rollingDependencyWeeks: [args.weekStart],
    displacedOriginalState: {
      ownedDays: [],
      ownedWeeks: [],
      calendarFacts: [],
      userRemovalConstraint: null,
      weekOverlay: {
        weekStart: args.weekStart,
        before: clone(args.beforeOverlay),
        after: clone(args.afterOverlay),
        beforeFingerprint: semanticFingerprint(args.beforeOverlay),
        afterFingerprint: semanticFingerprint(args.afterOverlay),
      },
      sweptOverrides: [],
      provenanceDeltas: { added: [], removed: [] },
      typedReductionDeltas: { added: [], removed: [] },
    },
    acceptedAfterSemanticFingerprints: [],
    restorationTarget: {
      kind: 'week_overlay',
      dates: affectedDates,
      stableIdentities: [args.afterOverlay.id],
    },
    linkedConstraintIds: [],
    linkedCalendarFacts: [],
    linkedOverrideOwners: [],
    linkedOverlayIds: [args.afterOverlay.id],
    linkedUserRemovalConstraintIds: [],
    linkedProvenanceIds: [],
    linkedTypedReductions: [],
    validity: {
      reversible: true,
      source: 'runtime_exact_delta',
      validWhile: ['target_overlay_matches_deriving_accepted_after'],
      invalidWhen: [
        'newer_overlapping_athlete_intent_exists',
        'unowned_target_overlay_drift',
      ],
    },
    laterIntentPolicy: 'newer_athlete_intent_wins',
  };
}

/** One owner of the Monday-first weekday-to-date rule. */
const dateForWeekday = isoDateForWeekday;

/**
 * Step 3 of the deriving lane, shared by BOTH overlay authors (generation and
 * the team-night relocation): reconcile the overlay's contract with the week
 * the athlete will ACTUALLY have and iterate to a fixpoint, re-authoring any
 * athlete removals against the finalised visible week. Bounded + monotonic,
 * mirroring the accepted-week deletion path (fixtureMinimalReplan).
 */
function reconcileOverlayContract(args: {
  overlay: WeekScopedWorkoutOverlay;
  weekStart: string;
  nextOverlays: Record<string, WeekScopedWorkoutOverlay>;
  state: ReturnType<typeof useProgramStore.getState>;
  profile: ReturnType<typeof acceptedProfileForContext>;
}): WeekScopedWorkoutOverlay {
  let overlay = args.overlay;
  if (!overlay.exposureContractV2) return overlay;
  const activeRemovals = activeUserRemovalConstraintsForWeek(
    args.state.userRemovalConstraints, args.weekStart);
  let contract = overlay.exposureContractV2;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const trial: WeekScopedWorkoutOverlay = { ...overlay, exposureContractV2: contract };
    const rebased = rebaseAcceptedEffectiveWeek({
      surfaces: {
        ...args.state,
        weekScopedOverlays: { ...args.nextOverlays, [args.weekStart]: trial },
      } as never,
      weekStart: args.weekStart,
      profile: args.profile,
      markedDays: args.state.acceptedMaterialContext.markedDays,
    });
    const finalised = rebased.evaluation.contract;
    const stable = semanticFingerprint(finalised) === semanticFingerprint(contract);
    if (rebased.evaluation.blockingViolations.length === 0 && stable) break;
    let next = finalised;
    for (const constraint of activeRemovals) {
      next = applyAthleteRemovalTypedReduction({
        contract: next, workouts: rebased.visibleWorkouts, weekStart: args.weekStart, constraint,
      });
    }
    if (semanticFingerprint(next) === semanticFingerprint(contract)) { contract = finalised; break; }
    contract = next;
  }
  return { ...overlay, exposureContractV2: contract };
}

function commitDerivingSourceFactScopedRegen(args: {
  compositionBase: AcceptedCompositionBaseV1;
  normalizedFacts: TemporarySourceFact[];
  compatibility: ReturnType<typeof composeTemporarySourceFactCompatibility>;
  /** Every week the fact's horizon reaches, ascending. Stage 1: no longer one. */
  weekStarts: readonly string[];
  /** The fact itself — the single owner of which dates it may shape. */
  fact: TemporarySourceFact;
  reason: string;
  sourceFactId: string;
  now: string;
  /** Rider 3: reports which weeks the authoring actually CHANGED (prior
   *  overlay fingerprint vs new), so the disclosure derives from the diff. */
  onWeeksAuthored?: (changedWeekStarts: string[]) => void;
}): AcceptedStateTransactionResult {
  const state = useProgramStore.getState();
  const currentProgram = state.currentProgram;
  if (!currentProgram) throw new Error('deriving_scoped_regen_requires_current_program');
  const profile = acceptedProfileForContext(
    normalizeAcceptedMaterialContext(state.acceptedMaterialContext),
    useProfileStore.getState().onboardingData,
  );

  const nextOverlays: Record<string, WeekScopedWorkoutOverlay> = { ...state.weekScopedOverlays };
  const adjustments: ReversibleAdjustmentRecord[] = [];

  for (const weekStart of args.weekStarts) {
    // TEAM-NIGHT MOVE (Sam, signed 2026-08-02): the fact's ruled effect is an
    // ANCHOR RELOCATION within the week the athlete actually has — not a
    // regeneration. The overlay author is rules/teamNightMoveDerivation
    // (sparse two-date overlay: landing day combined per the doubling law,
    // vacated day re-derived, every other day conserved byte-for-byte by
    // construction). The lane below is unchanged: same contract fixpoint,
    // same fact-linked adjustment, same atomic §18-gated commit — so
    // resolving the fact cascade-reverts exactly like every deriving fact.
    if (isTeamNightMoveFact(args.fact)) {
      const effective = rebaseAcceptedEffectiveWeek({
        surfaces: { ...state, weekScopedOverlays: nextOverlays } as never,
        weekStart,
        profile,
        markedDays: state.acceptedMaterialContext.markedDays,
      });
      const built = buildTeamNightMoveWeekOverlay({
        fact: args.fact,
        weekStart,
        effectiveWorkoutsByDate: new Map(effective.visibleWorkouts.map((workout) =>
          [dateForWeekday(weekStart, workout.dayOfWeek), workout as never])),
        now: args.now,
      });
      if (built.ok === false) throw new Error(`team_night_move_${built.code}`);
      const overlay = built.overlay;
      adjustments.push(buildDerivingSourceFactAdjustment({
        sourceFactId: args.sourceFactId,
        weekStart,
        beforeOverlay: state.weekScopedOverlays[weekStart] ?? null,
        afterOverlay: overlay,
        acceptedRevision: state.acceptedMaterialContext.revision + 1,
        createdAt: args.now,
      }));
      nextOverlays[weekStart] = overlay;
      continue;
    }
    // 0. The governed boundary for THIS week: days before it are history the
    //    fact may not shape (T4/L6 — a session the athlete already did cannot
    //    be re-prescribed retrospectively). When the boundary falls inside the
    //    week, the athlete's actual days are pinned and generation authors the
    //    remainder AS a remainder.
    const governedFromISO = firstShapedDateInWeek(args.fact, weekStart);
    const remainderBoundary = governedFromISO > weekStart
      ? {
          governedFromISO,
          pinnedHistoryWorkouts: rebaseAcceptedEffectiveWeek({
            surfaces: { ...state, weekScopedOverlays: nextOverlays } as never,
            weekStart,
            profile,
            markedDays: state.acceptedMaterialContext.markedDays,
          }).visibleWorkouts.filter((workout) =>
            dateForWeekday(weekStart, workout.dayOfWeek) < governedFromISO),
        }
      : null;
    // 1. Generate the reduced week with the PENDING facts threaded, so the per-week
    //    context mints the illness_recovery mode / readiness reduction (the store is
    //    still fact-empty mid-transaction). Single microcycle — this week only.
    //
    //    THE WEEK'S IDENTITY IS STATED, NOT RE-DERIVED (§18 ownership
    //    reassessment 2026-08-05, D1; approved by Sam). This passed only the
    //    block NUMBER and let generation work the block START back out of
    //    `todayISO` — so re-authoring the second week of a block planned the
    //    FIRST week's strength patterns onto it (the allocator alternates on
    //    `weekNumber % 2`). The composite week then covered two patterns instead
    //    of four, §18 rejected it as `pattern_imbalance`, and the athlete's
    //    stored fact was rolled back. One read of the one owner, position whole.
    const blockPosition = getBlockPositionForGeneration(weekStart);
    const generated = generateProgramLocally(profile, {
      // A TEMPORARY FACT MAY NEVER AUTHOR A PERMANENT SELECTION. This door
      // re-derives the week while a dated fact is live; it does not decide the
      // block. Same defect class as the boot, pointed at a different fact.
      recordSelections: 'replay',
      todayISO: weekStart,
      blockNumber: blockPosition.blockNumber,
      blockStartISO: blockPosition.blockStart,
      previousProgram: currentProgram,
      seasonPhaseClock: currentProgram.seasonPhaseClock,
      /**
       * ⚠ **THE BLOCK'S HISTORY, NOT JUST ITS COORDINATES.**
       *
       * The two lines above already state WHERE in the grid this week sits, and
       * the note beside them records why (stating only the NUMBER let generation
       * work the START back out of `todayISO` and plan the wrong week's
       * patterns). **What they did not state is WHAT THE ATHLETE HAS LIFTED**,
       * so the authoring-time freeze ran on this door with the four empty
       * arguments R-097 is about, and the regenerated week came back at the
       * AUTHORED ESTIMATE.
       *
       * **MEASURED 2026-08-20, block 2, through the real session-equipment
       * door:** ticking *"no barbell today"* took `RDLs` from the athlete's own
       * progressed `82.5 kg` back to `80 kg` and `Incline DB Bench` and
       * `Single-Leg Leg Press` from 4 sets to 3 — for the whole week, not just
       * the day they answered about. **Closing and reopening the app put them
       * back**, because `quiescentBoot` states these inputs and this door did
       * not, so the athlete saw the wrong numbers on the card they were about to
       * train off and the app disagreed with itself until a relaunch.
       *
       * A dated fact still AUTHORS NOTHING — `recordSelections: 'replay'` above
       * is untouched and is the rule that keeps a temporary answer out of the
       * permanent selection record. Reading the history is the opposite of
       * authoring it: it is how this week comes back with the loads the athlete
       * already earned instead of a fresh guess.
       */
      progressionHistory: statedProgressionInputs(state),
      activeConstraints: args.compatibility.activeConstraints.filter((constraint) =>
        isTemporarySourceFactConstraint(constraint)),
      temporarySourceFacts: args.normalizedFacts,
      microcycleLimit: 1,
      // THE FACT IS THE ATHLETE'S; THE WEEK IS THE APP'S PROBLEM (§18 ownership
      // reassessment 2026-08-05, D3; approved by Sam). This lane exists because
      // the athlete stated something true about themselves. If the best week
      // buildable around that statement still cannot meet its contract, that is
      // a shortfall to publish and disclose — the same accept-and-reduce ruling
      // this transaction already commits under (`operation: 'forward_decision'`
      // below) — never grounds for generation to discard the statement.
      weekAcceptance: 'forward_decision',
      remainderBoundary,
    });
    // 2. The regenerated microcycle becomes a sparse week overlay (the mutation
    //    layer). The base microcycle is never touched.
    const built = buildWeekScopedWorkoutOverlay({
      program: generated,
      weekStart,
      anchorDate: null,
      reason: 'readiness_reduction',
    });
    // 2b. History is immutable: dates before the governed boundary are dropped
    //     from the overlay, so both resolvers fall through to the untouched
    //     base on the missing key — byte-exact preservation by construction.
    //     The generated contract carries `governedFromISO` (stamped at
    //     generation) and pre-boundary anchors keep settled participation, so
    //     the preserved week is admissible under the Phase-1 asymmetry.
    let overlay: WeekScopedWorkoutOverlay = {
      ...built,
      workoutsByDate: remainderBoundary
        ? Object.fromEntries(Object.entries(built.workoutsByDate).filter(
            ([date]) => date >= remainderBoundary.governedFromISO))
        : built.workoutsByDate,
      createdAt: args.now,
      updatedAt: args.now,
    };
    // 3. Reconcile the reduced contract with the week the athlete will ACTUALLY
    //    have, and iterate to a fixpoint. Two things can make the generated
    //    contract disagree with that week: preserved athlete pins (a session
    //    removed before the fact stays removed, and the contract must AUTHORISE
    //    the gap or §18 reads it as a shortfall), and — new in Stage 1 —
    //    preserved past days, which the generator never saw. Each pass ADOPTS the
    //    finaliser's contract and re-authors any removals against the finalised
    //    visible week. Bounded + monotonic, mirroring the accepted-week deletion
    //    path (fixtureMinimalReplan).
    if (overlay.exposureContractV2) {
      overlay = reconcileOverlayContract({ overlay, weekStart, nextOverlays, state, profile });
    }
    // 4. Fact-linked reversible adjustment with the byte-exact prior overlay.
    //    One per reached week: `clear_fatigue_status` already reverts EVERY
    //    adjustment carrying this `sourceFactId`, so extending the horizon
    //    extends the cascade with it and no week is left behind (T3).
    adjustments.push(buildDerivingSourceFactAdjustment({
      sourceFactId: args.sourceFactId,
      weekStart,
      beforeOverlay: state.weekScopedOverlays[weekStart] ?? null,
      afterOverlay: overlay,
      acceptedRevision: state.acceptedMaterialContext.revision + 1,
      createdAt: args.now,
    }));
    nextOverlays[weekStart] = overlay;
  }

  args.onWeeksAuthored?.(args.weekStarts.filter((weekStart) =>
    semanticFingerprint(state.weekScopedOverlays[weekStart] ?? null) !==
      semanticFingerprint(nextOverlays[weekStart] ?? null)));

  // 5. One atomic authoring commit for every reached week: overlays + ledger +
  //    fact context. The base stays clean (preserveExactAcceptedWorkouts); each
  //    overlay carries its reduced contract, validated by validateWeekStarts.
  return commitAcceptedStateTransaction({
    reason: args.reason,
    // The athlete declared a life-fact and the reduced week is being authored
    // forward — accept-and-reduce (Sam, 2026-07-29): a pre-existing shortfall
    // elsewhere in the program is recorded and disclosed, never grounds to
    // refuse recording the fact.
    operation: 'forward_decision',
    program: {
      weekScopedOverlays: nextOverlays,
      reversibleAdjustmentLedger: {
        protocolVersion: REVERSIBLE_ADJUSTMENT_PROTOCOL_VERSION,
        adjustments: [...state.reversibleAdjustmentLedger.adjustments, ...adjustments],
      },
    },
    temporarySourceFacts: args.normalizedFacts,
    injuryEpisodes: args.compatibility.injuryEpisodes,
    activeConstraints: args.compatibility.activeConstraints,
    readinessSignalsByDate: args.compatibility.readinessSignalsByDate,
    acceptedCompositionBase: args.compositionBase,
    profile,
    preserveExactAcceptedWorkouts: true,
    skipConstraintProjection: true,
    validateWeekStarts: [...args.weekStarts],
  });
}

/**
 * The one canonical source-fact publication boundary used by injuries and all
 * non-injury facts. It validates a composed candidate from the clean accepted
 * base, then publishes the clean base plus the canonical facts atomically.
 */
export async function commitTemporarySourceFactSet(
  args: CommitTemporarySourceFactSetInput,
): Promise<CommitTemporarySourceFactSetResult> {
  const now = args.now ?? new Date().toISOString();
  const ownership = loadCanonicalTemporarySourceFactOwnership(now);
  if (args.expectedAcceptedRevision !== undefined &&
    args.expectedAcceptedRevision !== ownership.context.revision) {
    return {
      ok: false,
      acceptedStateChanged: false,
      visibleProgramChanged: false,
      changedProgram: false,
      route: 'conflicted',
      reason: 'accepted_revision_changed',
    };
  }
  const normalizedFacts = normalizeTemporarySourceFacts({
    value: expireTemporarySourceFacts(args.nextFacts, args.todayISO, now),
  });
  const compositionBase = normalizedFacts.some((fact) =>
    fact.legacyMigrationStatus === 'legacy_after_state_only')
    ? {
        ...ownership.compositionBase,
        provenance: 'legacy_after_state_only' as const,
      }
    : ownership.compositionBase;
  const compatibility = composeTemporarySourceFactCompatibility({
    temporarySourceFacts: normalizedFacts,
    activeConstraints: ownership.context.activeConstraints,
    readinessSignalsByDate: ownership.context.readinessSignalsByDate,
  });
  // ── THE FACT'S RULED EFFECT OWNS ITS COMMIT LANE ─────────────────────────
  // (Sam approved option 2 of docs/SCHEDULE_FACT_OWNERSHIP_REASSESSMENT_
  // 2026-08-01.md verbatim, 2026-08-02.) Every source fact is either INERT or
  // DERIVING; the third lane — re-canonicalise the accepted base and then have
  // the verifier refuse the change — is RETIRED, not guarded.
  //
  // DERIVING = the composed constraint has a RULED effect that must be
  // re-authored into the week (an AUTHORING event with no projection home):
  //   - 'fatigue'  → readiness reduction / illness_recovery week mode
  //                  (severe illness and cooked fatigue compose here);
  //   - 'injury'   → the restriction (I6: the athlete must SEE the week stop
  //                  prescribing the affected work);
  //   - 'schedule' scheduleKind 'time_cap' → the COMPRESSED session under the
  //                  35-minute owner (Sam's minutes ruling, 2026-08-02: main
  //                  lift kept, cut to essentials — "Short on time today").
  // Everything else a fact composes (busy_week / travel / max_sessions /
  // unavailable_* / equipment) has NO ruled re-authoring effect: it commits
  // INERT — recorded and honest, program byte-unchanged, off the whole-week
  // §18 MUTATION gate (a contextual signal is not a program mutation; Q4/Q5,
  // Sam 2026-07-22) — and delivers, if anywhere, through projection and future
  // generation. See docs/DERIVING_SOURCE_FACT_SCOPED_REGEN_REASSESSMENT_
  // 2026-07-23.md and docs/READINESS_SOURCE_FACT_REASSESSMENT_2026-07-22.md.
  // ── GAME DAY: NOTHING TO SHORTEN (Sam's §7 answer, 2026-08-03) ──────────
  // "It's game day — there's nothing to shorten. Go play." The fact stays a
  // time_cap fact — the athlete's statement is true whatever the day — but the
  // lane follows the fact's RULED EFFECT, and on a fixture day the ruled
  // compression has no purchase: a game day holds no trainable session to
  // compress (anchors are never content-cut, by law). A time_cap constraint
  // whose EVERY target date is a fixture day therefore has no ruled
  // re-authoring effect and takes the INERT lane: recorded, honest, program
  // byte-unchanged, the constraint still visible to the coach and to future
  // generation. Fixture identity is asked of the one fixture owner
  // (`targetWeekFixtures`: marked games, the virtual usual-game-day fixture,
  // bye/rest suppression) over the ACCEPTED context this transaction already
  // holds — the accepted profile snapshot and markedDays — never a raw mirror
  // read (the cold-start fallback goes through `liveAthleteContext`, LR-4's
  // own migration direction) and never a re-derived inline copy of
  // virtual-game logic.
  const acceptedProfile = acceptedProfileForContext(
    ownership.context,
    liveAthleteContext().onboardingData ?? ({} as never),
  );
  const acceptedOwnedPhase = ownSeasonPhase({
    program: compositionBase.surfaces.currentProgram,
    profile: acceptedProfile,
  });
  // The fixture's own KIND travels with its date (Sam's §10 ruling,
  // 2026-08-03): the sentence variant is selected by the SAME
  // `FixtureAvailabilityKind` that picks the day's card label (6-IV-4,
  // `canonicalFixtureKind`) — never by a second phase read here, which would
  // mint the parallel author `fixtureConditionedAvailability`'s header exists
  // to prevent.
  const fixturesByWeek = new Map<string, ReadonlyMap<string, FixtureAvailabilityKind>>();
  const fixtureKindOn = (date: string): FixtureAvailabilityKind | null => {
    const weekStart = mondayFor(date);
    let fixtures = fixturesByWeek.get(weekStart);
    if (!fixtures) {
      fixtures = new Map(targetWeekFixtures({
        profile: acceptedProfile,
        weekStart,
        markedDays: ownership.context.markedDays,
        ownedPhase: acceptedOwnedPhase,
      }).map((fixture) => [fixture.date, fixture.kind] as const));
      fixturesByWeek.set(weekStart, fixtures);
    }
    return fixtures.get(date) ?? null;
  };
  const isFixtureDay = (date: string): boolean => fixtureKindOn(date) !== null;
  const timeCapAllFixtureDays = (constraint: {
    timeCapDates?: readonly string[];
  }): boolean =>
    (constraint.timeCapDates?.length ?? 0) > 0 &&
    (constraint.timeCapDates ?? []).every(isFixtureDay);
  const isRuledDerivingConstraint = (constraint: {
    type?: string;
    scheduleKind?: string;
    timeCapDates?: readonly string[];
  }): boolean =>
    isTemporarySourceFactConstraint(constraint as never) &&
    (constraint.type === 'fatigue' || constraint.type === 'injury' ||
      // ── EQUIPMENT DERIVES, 2026-08-13 (SEAT_INBOX item 28) ──
      // Its effect has been RULED for two weeks and signed as a phrase the
      // athlete reads — *"Exercises substituted"* (item 22(a)) — while the
      // fact itself took the INERT lane, so nothing was substituted in the week
      // he was looking at. A modifier that names an effect and takes the
      // record-only lane is the same green-and-empty shape this flow has now
      // hit twice. The kit the athlete has IS what a session can be built from,
      // so the week has to be re-authored around it.
      constraint.type === 'equipment' ||
      (constraint.type === 'schedule' &&
        // ── A TRIP DOES **NOT** TAKE THIS LANE, AND IT IS NOW REFUTED ON GLASS
        // RATHER THAN FEARED — 2026-08-13, SEAT_INBOX item 28 ──
        //
        // Item 28 ordered this line changed, twice. It has now been changed,
        // run on the simulator against the same seed and the same week, and
        // **PHOTOGRAPHED BOTH WAYS.** The deriving lane is WORSE for the
        // athlete, and the numbers are not close:
        //
        // | Thu 16 (a team night he is away for) | inert: **Strength** | deriving: **Rest Day** |
        // | Tue 14                               | inert: **Strength** | deriving: Strength + Conditioning |
        // | Sat 18 (his game)                    | inert: "Training Day" | deriving: "Training Day" |
        // | the tap                              | inert: instant | deriving: ~1 min, 1,220 workouts generated |
        //
        // **THE DERIVING LANE COSTS HIM A TRAINING DAY AND FIXES NOTHING.**
        // Removing the club anchors makes the week a bye-build whose contract
        // declares more core conditioning than the week carries, so §18 runs
        // `repairCoreConditioningShortfallCandidates` through its 48-candidate
        // search, regenerates Thursday 616 times, and still hands back an empty
        // day. The one defect Sam actually named — Saturday reading *"Training
        // Day"* — is IDENTICAL either way, so it was never this lane's to fix.
        //
        // THE OLD REASON FOR THIS COMMENT IS ALSO WITHDRAWN, and that matters
        // because it is what kept the question open: the refusal (*"That didn't
        // save — your week is unchanged."*) DID NOT REPRODUCE. With
        // `[temporary-source-fact] lane` logging on every commit, the fact
        // committed cleanly and no refusal line was ever printed. **The lane is
        // not refusing. It is simply the wrong tool**, exactly as the north star
        // says: away is a DECISION, and the week it implies is DERIVED
        // (`derivedWeekContract` drops the fixture anchor; `coachingEngine`'s
        // `onboardingToCoachingInputs` drops the club days). Neither stores a
        // thing, and both already work on a week the athlete is looking at.
        //
        // **DO NOT ORDER THIS LINE CHANGED A THIRD TIME WITHOUT A NEW FACT.**
        (
        ((constraint.scheduleKind === 'time_cap' &&
          // Sam's §7 answer: a cap aimed only at fixture days is INERT —
          // there is nothing to shorten. Mixed or plain-day caps keep
          // deriving the compressed session.
          !timeCapAllFixtureDays(constraint)) ||
          // Team-night movability (Sam, signed 2026-08-02): the one-off fact's
          // ruled effect relocates the team anchor within its week — an
          // authoring event, so it derives. See rules/teamNightMoveDerivation.
          constraint.scheduleKind === 'team_night_move'))));
  const derivingSignature = (constraints: readonly unknown[]): string =>
    JSON.stringify((constraints as Array<{ id?: string; type?: string; severity?: number; scheduleKind?: string }>)
      .filter(isRuledDerivingConstraint)
      .map((constraint) => ({ id: constraint.id, type: constraint.type, severity: constraint.severity }))
      .sort((left, right) => String(left.id).localeCompare(String(right.id))));
  // The commit is a deriving one exactly when the RULED-EFFECT constraint set
  // changed. Unruled compositions — however much they change the projection
  // set — are record-only and take the inert lane.
  const derivingCompositionChanged =
    derivingSignature(ownership.context.activeConstraints)
      !== derivingSignature(compatibility.activeConstraints);
  const derivingSourceFactIds = (constraints: readonly unknown[]): Set<string> =>
    new Set((constraints as Array<{ id?: string; type?: string; scheduleKind?: string }>)
      .filter(isRuledDerivingConstraint)
      .map((constraint) => String(constraint.id)));
  const priorDerivingIds = derivingSourceFactIds(ownership.context.activeConstraints);
  // Materialisation needs a program to materialise into; without one (cold
  // start, synthetic bases) the fact still commits — inert, base-preserving.
  const canScopedRegen =
    (useProgramStore.getState().currentProgram?.microcycles?.length ?? 0) > 0;
  const scopedRegen = canScopedRegen &&
    Array.from(derivingSourceFactIds(compatibility.activeConstraints))
      .some((id) => !priorDerivingIds.has(id));
  // ── THE LANE SAYS WHICH LANE IT TOOK ──
  // **SEAT_INBOX item 28's instrument rule, and it is the CONTROL for every
  // absence read off this file.** The refusal line below only speaks when the
  // commit fails, so a silent Metro could mean "it worked", "it never ran", or
  // "you are reading a stale bundle" — and this repo has already published two
  // confidently wrong conclusions from exactly that ambiguity. This line fires
  // on EVERY commit, so a run with no `[temporary-source-fact] lane` in it is a
  // dead instrument, not a result.
  logger.warn('[temporary-source-fact] lane', {
    operation: args.reason,
    factId: args.targetFactId,
    derivingCompositionChanged,
    canScopedRegen,
    scopedRegen,
    derivingIds: Array.from(derivingSourceFactIds(compatibility.activeConstraints)),
  });
  // Stage 1: which weeks a deriving fact re-authors is the FACT's business, not
  // `mondayFor(todayISO)`'s. The candidates are the weeks the athlete actually
  // has (the accepted program's microcycles, plus the current week); the fact's
  // horizon selects from them. An open horizon therefore reaches all of them,
  // and clearing it cascades back over all of them.
  const targetFact = normalizedFacts.find((fact) =>
    temporarySourceFactId(fact) === args.targetFactId) ?? null;
  // WHY nothing changed, typed. When the target fact is an active time-cap
  // whose every target date the fixture owner calls a fixture day, the commit
  // is inert BY THE §7 RULING, and the result says so — so the acknowledgment
  // owner selects the signed game-day sentence from the COMMITTED result,
  // keeping its documented contract (clause by result, never by the door).
  //
  // §10 (Sam, 2026-08-03): the reason is the same — it is a fixture day — and
  // the fixture's own KIND rides with it, so a Pre-season fixture gets the
  // practice-match variant instead of "game day". One selector, two signed
  // sentences; the card label and the sentence can never disagree because
  // both read `canonicalFixtureKind`'s answer.
  const inertFixtureDates = !derivingCompositionChanged && targetFact &&
    !isInjurySourceFact(targetFact) && targetFact.factKind === 'time_cap' &&
    targetFact.status === 'active' &&
    timeCapAllFixtureDays({ timeCapDates: targetFact.dates })
    ? targetFact.dates ?? []
    : [];
  const inertReason: TemporarySourceFactInertReason | undefined =
    inertFixtureDates.length > 0 ? 'fixture_day' : undefined;
  // Every date is a fixture (that is what `timeCapAllFixtureDays` proved); the
  // variant is the first one's kind. A same-day mix cannot exist — one date is
  // one fixture — and a multi-date cap spanning both kinds would be a horizon
  // the time-cap door cannot produce today (today-scoped, ruled).
  const inertFixtureVariant: FixtureAvailabilityKind | undefined =
    inertFixtureDates.length > 0
      ? fixtureKindOn(inertFixtureDates[0]) ?? undefined
      : undefined;
  const candidateRegenWeeks = Array.from(new Set([
    mondayFor(args.todayISO),
    ...(useProgramStore.getState().currentProgram?.microcycles ?? [])
      .map((microcycle) => microcycle.startDate.slice(0, 10)),
  ])).sort();
  const scopedRegenWeeks = targetFact
    ? factHorizonWeeks(targetFact, candidateRegenWeeks)
    : [mondayFor(args.todayISO)];

  // Typed ownership (undo = stored prior state, never re-derive): removing a fact that
  // OWNS a scoped-regen reversible adjustment (sourceFactId-linked) is a stored-prior-state
  // restore, not a re-derivation. The scoped-regen ADD kept the base clean (preserveExact)
  // — its overlay carried the reduction — and the cascade revert has already put the base
  // back. Re-canonicalising here would re-author a base this fact never owned (e.g. null
  // today's workout on a game week), tripping the base-immutability guard: the finding #4
  // half-apply. Preserve the base exactly, symmetric with the ADD. The ownership link is
  // the whole condition — NO fact-kind sniffing. Projection-delivered facts (equipment/
  // schedule/time_cap) own no such adjustment and keep re-projecting on the path below.
  // See docs/ILLNESS_CLEAR_LEDGER_REASSESSMENT_2026-07-23.md.
  const ownsScopedRegenAdjustment = useProgramStore.getState()
    .reversibleAdjustmentLedger.adjustments
    .some((adjustment) => adjustment.kind === 'deriving_source_fact' &&
      adjustment.sourceFactId === args.targetFactId);
  const scopedRegenRestore = derivingCompositionChanged && !scopedRegen && ownsScopedRegenAdjustment;
  const horizon = affectedHorizon(args.todayISO, normalizedFacts);
  const baseFingerprint = semanticFingerprint(compositionBase.surfaces);
  const ledgerFingerprint = semanticFingerprint(compositionBase.surfaces.reversibleAdjustmentLedger);
  const factsFingerprint = semanticFingerprint(normalizedFacts);
  let scopedRegenChangedWeeks: string[] | null = null;
  const transaction = await runCoachMutationTransaction({
    todayISO: args.todayISO,
    extraDates: horizon.dates,
    trace: args.trace,
    allowAcceptedStateOnlyChange: true,
    mutate: () => {
      args.testHooks?.beforeStage?.();
      const nextContext = normalizeAcceptedMaterialContext({
        ...ownership.context,
        temporarySourceFacts: normalizedFacts,
        injuryEpisodes: compatibility.injuryEpisodes,
        activeConstraints: compatibility.activeConstraints,
        readinessSignalsByDate: compatibility.readinessSignalsByDate,
        acceptedCompositionBase: compositionBase,
      });
      // TWO LANES, NO THIRD. A DERIVING change still runs the §18 gate (the
      // fact stays gated — R9/R14): a new deriving constraint re-authors its
      // weeks via scoped regen; a deriving change with no program to regen
      // (cold start, synthetic base) or with no new constraint (an update, a
      // resolve without an owned adjustment) validates the composed candidate
      // and then commits BASE-PRESERVING. A scoped-regen RESTORE re-validates
      // nothing: the cascade revert already restored the stored prior base
      // (re-deriving it here is the finding-#4 half-apply). An INERT commit —
      // which since the 2026-08-03 lanes includes every unruled fact, however
      // it changes the projection set — never touches the gate at all.
      //
      // The commit below is ALWAYS base-preserving. The old third lane —
      // re-canonicalise the base for a "projection-delivered" fact and then
      // have `verifyCandidate` refuse the base change it just made
      // (`accepted_composition_base_changed_by_temporary_fact`, the on-device
      // refusal behind declared red 1) — is retired, not guarded.
      if (derivingCompositionChanged) {
        args.testHooks?.beforeEffectiveValidation?.();
        if (scopedRegen && targetFact) {
          return commitDerivingSourceFactScopedRegen({
            compositionBase,
            normalizedFacts,
            compatibility,
            weekStarts: scopedRegenWeeks,
            fact: targetFact,
            reason: args.reason,
            sourceFactId: args.targetFactId,
            now,
            onWeeksAuthored: (changedWeekStarts) => {
              scopedRegenChangedWeeks = changedWeekStarts;
            },
          });
        }
        if (!scopedRegenRestore) {
          validateEffectiveComposition({
            base: compositionBase,
            context: nextContext,
            weekStarts: horizon.weeks,
          });
        }
      }
      return commitAcceptedStateTransaction({
        reason: args.reason,
        // The athlete declared a life-fact. Forward — the base is preserved
        // byte-exact, so nothing here is a restoration, and a pre-existing
        // shortfall in some week must not refuse a record-only fact.
        operation: 'forward_decision',
        program: compositionBase.surfaces,
        temporarySourceFacts: normalizedFacts,
        injuryEpisodes: compatibility.injuryEpisodes,
        activeConstraints: compatibility.activeConstraints,
        readinessSignalsByDate: compatibility.readinessSignalsByDate,
        acceptedCompositionBase: compositionBase,
        // Off the whole-week §18 re-gate: a deriving change was already gated
        // above (scoped regen validates its own weekStarts), and an inert
        // commit is record-only by ruling.
        validateWeekStarts: [],
        // The exact accepted program surfaces are preserved, always — the one
        // writer that re-authors them is the scoped regen, which returned
        // above with its own base-change authority.
        preserveExactAcceptedWorkouts: true,
        skipConstraintProjection: true,
      });
    },
    didApply: () => true,
    verifyCandidate: () => {
      if (args.testHooks?.verifyCandidate?.() === false) {
        return { ok: false, reason: 'temporary_source_fact_visible_candidate_test_rejection' };
      }
      const accepted = normalizeAcceptedMaterialContext(useProgramStore.getState().acceptedMaterialContext);
      if (args.targetFactId !== 'temporary-source-facts:empty' &&
        !accepted.temporarySourceFacts.some((fact) => temporarySourceFactId(fact) === args.targetFactId)) {
        return { ok: false, reason: 'temporary_source_fact_candidate_missing' };
      }
      if (semanticFingerprint(accepted.temporarySourceFacts) !== factsFingerprint) {
        return { ok: false, reason: 'temporary_source_fact_candidate_mismatch' };
      }
      // A scoped-regen authoring commit LEGITIMATELY re-authors the accepted
      // surfaces (adds the week overlay) and the ledger (the fact-linked
      // adjustment) — the same base-change authority weekRebuild:block uses. The
      // base-immutability and ledger-immutability guards protect the INERT path
      // only; they do not apply to an authorised deriving regen.
      if (!scopedRegen) {
        if (semanticFingerprint(accepted.acceptedCompositionBase?.surfaces ?? null) !== baseFingerprint) {
          return { ok: false, reason: 'accepted_composition_base_changed_by_temporary_fact' };
        }
        if (semanticFingerprint(useProgramStore.getState().reversibleAdjustmentLedger) !== ledgerFingerprint) {
          return { ok: false, reason: 'temporary_source_fact_created_reversible_adjustment' };
        }
      }
      if (accepted.acceptedCompositionBase?.provenance !== compositionBase.provenance) {
        return { ok: false, reason: 'accepted_composition_base_provenance_mismatch' };
      }
      return { ok: true };
    },
    verifyAfterPersistence: () => {
      if (args.testHooks?.verifyAfterPersistence?.() === false) {
        return { ok: false, reason: 'temporary_source_fact_durable_readback_test_rejection' };
      }
      const accepted = normalizeAcceptedMaterialContext(useProgramStore.getState().acceptedMaterialContext);
      if (semanticFingerprint(accepted.temporarySourceFacts) !== factsFingerprint) {
        return { ok: false, reason: 'temporary_source_fact_durable_readback_mismatch' };
      }
      if (!scopedRegen &&
        semanticFingerprint(accepted.acceptedCompositionBase?.surfaces ?? null) !== baseFingerprint) {
        return { ok: false, reason: 'accepted_composition_base_durable_readback_mismatch' };
      }
      if (accepted.acceptedCompositionBase?.provenance !== compositionBase.provenance) {
        return { ok: false, reason: 'accepted_composition_base_provenance_durable_readback_mismatch' };
      }
      return { ok: true };
    },
  });
  if (!('route' in transaction)) {
    return {
      ok: true,
      acceptedStateChanged: true,
      visibleProgramChanged: transaction.diff.hasProgrammingChange,
      changedProgram: transaction.diff.hasProgrammingChange,
      changedWeekStarts: scopedRegenChangedWeeks ?? undefined,
      inertReason,
      inertFixtureVariant,
    };
  }
  return {
    ok: false,
    acceptedStateChanged: false,
    visibleProgramChanged: false,
    changedProgram: false,
    route: transaction.route,
    reason: transaction.reason,
  };
}

function comparableFact(fact: TemporarySourceFact): unknown {
  if (isInjurySourceFact(fact)) return fact;
  const { createdAt: _createdAt, updatedAt: _updatedAt, resolvedAt: _resolvedAt, ...rest } = fact;
  return rest;
}

function exactFactReplacement(
  existing: TemporarySourceFact,
  replacement: TemporarySourceFact,
): TemporarySourceFact {
  if (isInjurySourceFact(existing) || isInjurySourceFact(replacement)) return replacement;
  return {
    ...replacement,
    createdAt: existing.createdAt,
    resolvedAt: replacement.status === 'active' ? null : replacement.resolvedAt,
    transitionHistory: [...existing.transitionHistory],
  };
}

function statusForOperation(operation: TemporarySourceFactOperation): TemporarySourceFactStatus | null {
  if (operation === 'resolve') return 'resolved';
  if (operation === 'expire') return 'expired';
  if (operation === 'supersede') return 'superseded';
  return null;
}

export async function transactTemporarySourceFact(
  input: TemporarySourceFactTransactionInput,
): Promise<TemporarySourceFactTransactionResult> {
  const trace = currentAthleteActionTrace();
  emitAthleteActionEvent(trace, 'athlete_action_parsed', {
    parsedMutationType: `temporary_source_fact:${input.operation}`,
    sourceFactId: input.factId ?? (input.fact ? temporarySourceFactId(input.fact) : null),
    sourceSurface: input.sourceSurface ?? null,
  });
  const result = await transactTemporarySourceFactWithinTrace(input);
  const succeeded = result.outcome !== 'conflicted' && result.outcome !== 'safely_rejected';
  if (succeeded && result.outcome !== 'no_op' && result.factId) {
    emitAthleteActionEvent(trace, 'mutation_constraint_created', {
      constraintType: 'temporary_source_fact',
      constraintId: result.factId,
      constraintStatus: result.outcome.startsWith('resolved')
        ? 'resolved'
        : result.outcome.startsWith('expired') ? 'expired' : 'active',
      factOperation: input.operation,
      changedProgram: result.changedProgram,
      sourceSurface: input.sourceSurface ?? null,
    });
  }
  const internalResultCode = `temporary_source_fact_${result.outcome}`;
  emitAthleteActionEvent(
    trace,
    succeeded ? 'athlete_action_completed' : 'athlete_action_failed',
    succeeded
      ? {
          outcome: result.changedProgram ? 'accepted_changed' : 'accepted_no_change',
          internalResultCode,
          factId: result.factId,
        }
      : {
          outcome: 'rejected',
          internalResultCode,
          originalRejectionCode: result.reason ?? result.outcome,
          rejectionCodes: [result.reason ?? result.outcome],
          firstFailingBoundary: 'temporarySourceFactTransaction',
          failureCategory: classifyAthleteActionFailure(
            result.reason ?? result.outcome,
            'temporarySourceFactTransaction',
          ),
          validCandidateExisted: false,
          previousStateRestored: true,
          terminalReasonChain: trace
            ? athleteActionTerminalReasonChain(trace.traceId)
            : [],
        },
  );
  return result;
}

async function transactTemporarySourceFactWithinTrace(
  input: TemporarySourceFactTransactionInput,
): Promise<TemporarySourceFactTransactionResult> {
  const now = input.now ?? new Date().toISOString();
  const todayISO = (input.todayISO ?? localToday()).slice(0, 10);
  const ownership = loadCanonicalTemporarySourceFactOwnership(now);
  if (input.expectedAcceptedRevision !== undefined &&
    input.expectedAcceptedRevision !== ownership.context.revision) {
    return {
      outcome: 'conflicted', factId: input.factId ?? (input.fact ? temporarySourceFactId(input.fact) : null),
      changedProgram: false, message: 'The accepted program changed before this report could be applied.',
      reason: 'accepted_revision_changed',
    };
  }
  let nextFacts = expireTemporarySourceFacts(ownership.context.temporarySourceFacts, todayISO, now);
  let effectiveOperation = input.operation;
  const dueExpiryChanged = semanticFingerprint(nextFacts) !==
    semanticFingerprint(ownership.context.temporarySourceFacts);
  let targetFactId = input.factId ?? (input.fact ? temporarySourceFactId(input.fact) : null);
  if (input.operation === 'hydrate') {
    // The legacy hydration migration is deleted (demolition area 4): an empty
    // fact list now means the athlete has no temporary facts, not that they
    // have some in a shape this build cannot read.
    targetFactId = targetFactId ?? (nextFacts[0]
      ? temporarySourceFactId(nextFacts[0])
      : 'temporary-source-facts:empty');
  } else if (input.operation === 'create' || input.operation === 'update') {
    if (!input.fact) {
      return { outcome: 'safely_rejected', factId: targetFactId, changedProgram: false, message: 'No exact source fact was supplied.', reason: 'temporary_source_fact_missing' };
    }
    targetFactId = temporarySourceFactId(input.fact);
    const index = nextFacts.findIndex((fact) => temporarySourceFactId(fact) === targetFactId);
    if (input.operation === 'update' && index < 0) {
      return { outcome: 'conflicted', factId: targetFactId, changedProgram: false, message: 'That active report could not be matched.', reason: 'temporary_source_fact_not_found' };
    }
    if (input.operation === 'create' && index >= 0 &&
      semanticFingerprint(comparableFact(nextFacts[index])) === semanticFingerprint(comparableFact(input.fact))) {
      if (semanticFingerprint(nextFacts) === semanticFingerprint(ownership.context.temporarySourceFacts)) {
        return { outcome: 'no_op', factId: targetFactId, changedProgram: false, message: 'That report is already active.' };
      }
    } else if (index >= 0) {
      if (input.operation === 'create') effectiveOperation = 'update';
      nextFacts = nextFacts.map((fact, factIndex) => factIndex === index
        ? exactFactReplacement(fact, input.fact!)
        : fact);
    } else {
      nextFacts = [...nextFacts, input.fact];
    }
  } else {
    if (!targetFactId) {
      return { outcome: 'safely_rejected', factId: null, changedProgram: false, message: 'No exact source fact was selected.', reason: 'temporary_source_fact_id_missing' };
    }
    const status = statusForOperation(input.operation)!;
    const existing = nextFacts.find((fact) => temporarySourceFactId(fact) === targetFactId);
    if (!existing) {
      return { outcome: 'conflicted', factId: targetFactId, changedProgram: false, message: 'That active report could not be matched.', reason: 'temporary_source_fact_not_found' };
    }
    const alreadyInactive = isInjurySourceFact(existing)
      ? existing.status === 'resolved' || existing.status === 'superseded'
      : existing.status !== 'active';
    if (alreadyInactive) {
      if (!isInjurySourceFact(existing) && existing.status === 'expired' && dueExpiryChanged) {
        effectiveOperation = 'expire';
      } else {
        return { outcome: 'no_op', factId: targetFactId, changedProgram: false, message: 'That report is already inactive.' };
      }
    }
    if (isInjurySourceFact(existing)) {
      return { outcome: 'safely_rejected', factId: targetFactId, changedProgram: false, message: 'Injury transitions require the typed injury transition payload.', reason: 'injury_transition_payload_required' };
    }
    if (effectiveOperation !== 'expire') {
      const actor = input.sourceActor ?? existing.sourceActor;
      const surface = input.sourceSurface ?? existing.sourceSurface;
      const replacement: TemporarySourceFact = {
        ...existing,
        status,
        updatedAt: now,
        resolvedAt: now,
        sourceActor: actor,
        sourceSurface: surface,
        transitionHistory: [
          ...existing.transitionHistory,
          {
            at: now,
            from: existing.status,
            to: status,
            actor,
            surface,
            reason: `transaction_${effectiveOperation}`,
          },
        ],
      };
      nextFacts = nextFacts.map((fact) => temporarySourceFactId(fact) === targetFactId
        ? replacement
        : fact);
    }
  }
  nextFacts = normalizeTemporarySourceFacts({ value: nextFacts });
  const persisted = await commitTemporarySourceFactSet({
    nextFacts,
    targetFactId: targetFactId ?? 'temporary-source-facts:empty',
    todayISO,
    reason: `temporary_source_fact:${effectiveOperation}`,
    now,
    expectedAcceptedRevision: input.expectedAcceptedRevision ?? ownership.context.revision,
    testHooks: input.testHooks,
  });
  if (!persisted.ok) {
    // ── A REFUSAL WITH NO REASON ON THE WIRE IS ITS OWN DEFECT ──
    // **SEAT_INBOX item 30, 2026-08-13.** The athlete read *"That didn't save —
    // your week is unchanged."* on a real device and NOTHING said why: two
    // reproduction attempts, an OS-log detour and a second Metro all found the
    // regen succeeding and the commit rejected in silence. **The typed reason
    // existed the whole time and nobody printed it.**
    // It goes to `logger.warn` rather than a diagnostic tape on purpose — the
    // tape is for athlete ACTIONS, and this is the engine explaining a refusal
    // to whoever is watching the bundler when it happens.
    logger.warn('[temporary-source-fact] refused', {
      route: persisted.route,
      reason: persisted.reason,
      operation: effectiveOperation,
      factId: targetFactId,
    });
    return {
      outcome: persisted.route === 'conflicted' ? 'conflicted' : 'safely_rejected',
      factId: targetFactId,
      changedProgram: false,
      message: persisted.route === 'conflicted'
        ? 'The accepted program changed before this report could be applied.'
        : 'The report was not applied because the visible program could not be verified.',
      reason: persisted.reason,
    };
  }
  const prefix = effectiveOperation === 'hydrate' ? 'hydrated' : `${effectiveOperation}d`;
  const target = nextFacts.find((fact) => temporarySourceFactId(fact) === targetFactId);
  const subject = target && !isInjurySourceFact(target)
    ? target.factKind === 'equipment'
      ? 'equipment restriction'
      : target.factKind === 'schedule'
        ? 'schedule restriction'
        : target.factKind === 'time_cap'
          ? 'temporary time cap'
          : 'report'
    : 'report';
  // A severe (bed-ridden) illness derives the illness_recovery week mode: nothing
  // is required this week and the remaining work is optional/reduced. Disclose
  // that specifically when it lands, rather than the generic recompose line.
  const severeIllnessLanding = target && !isInjurySourceFact(target) &&
    target.factKind === 'illness' && 'severity' in target && target.severity === 'severe' &&
    effectiveOperation === 'create';
  // Rider 3: the multi-week half of the disclosure comes from the COMMITTED
  // diff — the weeks the scoped regen actually changed — never from the
  // action kind alone.
  const laterWeeksChanged = (persisted.changedWeekStarts ?? [])
    .some((weekStart) => weekStart > mondayFor(todayISO));
  return {
    outcome: `${prefix}_${persisted.changedProgram ? 'and_recomposed' : 'no_program_change'}` as TemporarySourceFactTransactionOutcome,
    factId: targetFactId,
    changedProgram: persisted.changedProgram,
    inertReason: persisted.inertReason,
    inertFixtureVariant: persisted.inertFixtureVariant,
    message: severeIllnessLanding
      ? "Rest up — nothing's required this week. I've left gentle optional work if you're up to it, at a lighter dose." +
        (laterWeeksChanged
          ? " I've eased the weeks ahead the same way — they stay that way until you tell me you're better."
          : '')
      : persisted.changedProgram
      ? effectiveOperation === 'resolve' || effectiveOperation === 'expire' ||
        effectiveOperation === 'supersede'
        ? `That ${subject} is inactive. The visible program was recomposed from the clean accepted base, restoring only what verification allowed while preserving other active facts and later edits.`
        : `The ${subject} is active and the visible program was safely recomposed.`
      : effectiveOperation === 'resolve' || effectiveOperation === 'expire' ||
        effectiveOperation === 'supersede'
        ? `That ${subject} is inactive. Other active facts and later program edits were preserved.`
        : `The ${subject} is active. No visible session needed changing.`,
  };
}

export async function hydrateTemporarySourceFacts(todayISO?: string): Promise<TemporarySourceFactTransactionResult> {
  return transactTemporarySourceFact({ operation: 'hydrate', todayISO, sourceActor: 'system', sourceSurface: 'hydration_migration' });
}
