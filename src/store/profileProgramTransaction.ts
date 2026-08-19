import type {
  DayOfWeek,
  OnboardingData,
  ProgramAvailabilityConstraint,
} from '../types/domain';
import {
  ACCEPTED_COMPOSITION_BASE_PROTOCOL_VERSION,
  ACCEPTED_PROFILE_SNAPSHOT_PROTOCOL_VERSION,
  acceptedProfileForContext,
  normalizeAcceptedMaterialContext,
  normalizeAcceptedProgramSurfaces,
  type AcceptedCompositionBaseV1,
  type AcceptedProfileSnapshotV1,
} from './acceptedStateColdStart';
import { commitAcceptedStateTransaction } from './acceptedStateTransaction';
import { runCoachMutationTransaction } from './coachMutationTransaction';
import { statedProgressionInputs, useProgramStore } from './programStore';
import { useProfileStore } from './profileStore';
import { composeTemporarySourceFactCompatibility } from '../rules/temporarySourceFact';
import { generateProgramLocally } from '../services/api/generateProgram';
import {
  buildRebuiltProgramSurfaces,
  collectWeekRebuildContext,
  decideOverrideSweep,
} from '../utils/weekRebuild';
import { semanticFingerprint } from '../utils/programSemanticSnapshot';
import {
  composeAcceptedProfileConstraints,
  isAcceptedProfileConstraint,
} from '../rules/acceptedProfileProjection';
import { ownSeasonPhase } from '../rules/seasonPhaseOwner';

export type ProfileProgramChange =
  | {
      /**
       * LEGACY SHAPE — the coach chat's producer still speaks it (LR-6 is a
       * standing STOP on that pipeline). Reads lift 'complete' selections as
       * answers; every NEW surface commits `equipment_answer` instead.
       */
      kind: 'baseline_equipment';
      equipment: string[];
    }
  | {
      /** The canonical equipment write (L15): the typed athlete decision. */
      kind: 'equipment_answer';
      answer: NonNullable<OnboardingData['equipmentAnswer']>;
    }
  | {
      kind: 'preferred_training_weekdays';
      weekdays: DayOfWeek[];
    }
  | {
      kind: 'permanent_unavailable_weekdays';
      weekdays: DayOfWeek[];
    }
  | {
      kind: 'permanent_session_time_cap';
      maxSessionMinutes: number | null;
      weekdays?: DayOfWeek[];
    }
  | {
      kind: 'profile_setup';
      patch: Partial<OnboardingData>;
    };

export interface ProfileProgramTransactionInput {
  change: ProfileProgramChange;
  todayISO: string;
  sourceSurface: string;
  expectedAcceptedRevision?: number;
  testHooks?: {
    verifyCandidate?: () => boolean;
    verifyAfterPersistence?: () => boolean;
  };
}

export interface ProfileProgramTransactionResult {
  ok: boolean;
  changedProgram: boolean;
  message: string;
  reason?: string;
  acceptedRevision?: number;
}

const DAY_ORDER: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const PERMANENT_UNAVAILABLE_PREFIX = 'accepted-profile:permanent-unavailable:';
const PERMANENT_TIME_CAP_PREFIX = 'accepted-profile:permanent-time-cap:';

function orderedWeekdays(days: readonly DayOfWeek[]): DayOfWeek[] {
  const unique = new Set(days);
  return DAY_ORDER.filter((day) => unique.has(day));
}

function applyProfileChange(
  profile: OnboardingData,
  change: ProfileProgramChange,
  now: string,
): OnboardingData {
  if (change.kind === 'profile_setup') {
    if ((change.patch.availabilityConstraints ?? [])
      .some((constraint) => constraint.scope === 'temporary')) {
      throw new Error('temporary_profile_constraints_require_source_facts');
    }
    return {
      ...profile,
      ...change.patch,
    };
  }
  if (change.kind === 'baseline_equipment') {
    return {
      ...profile,
      equipment: [...change.equipment],
      equipmentSelectionCompleteness: 'complete',
    };
  }
  if (change.kind === 'equipment_answer') {
    return {
      ...profile,
      equipmentAnswer: change.answer,
    };
  }
  if (change.kind === 'preferred_training_weekdays') {
    const preferredTrainingDays = orderedWeekdays(change.weekdays);
    return {
      ...profile,
      preferredTrainingDays,
      trainingDaysPerWeek: preferredTrainingDays.length,
    };
  }
  if (change.kind === 'permanent_unavailable_weekdays') {
    const retained = (profile.availabilityConstraints ?? []).filter((constraint) =>
      !(constraint.scope === 'permanent' && constraint.kind === 'unavailable_day') &&
      !constraint.id.startsWith(PERMANENT_UNAVAILABLE_PREFIX));
    const owned = orderedWeekdays(change.weekdays).map((day): ProgramAvailabilityConstraint => ({
      id: `${PERMANENT_UNAVAILABLE_PREFIX}${day.toLowerCase()}`,
      kind: 'unavailable_day',
      scope: 'permanent',
      dayOfWeek: day,
      active: true,
      reason: 'Permanent athlete availability',
      createdAt: now,
      updatedAt: now,
    }));
    return {
      ...profile,
      availabilityConstraints: [...retained, ...owned],
    };
  }
  const targetedDays = change.weekdays?.length
    ? orderedWeekdays(change.weekdays)
    : DAY_ORDER;
  const targetedIds = new Set(targetedDays.map((day) =>
    `${PERMANENT_TIME_CAP_PREFIX}${day.toLowerCase()}`));
  const retained = (profile.availabilityConstraints ?? [])
    .filter((constraint) =>
      !targetedIds.has(constraint.id) &&
      !(constraint.scope === 'permanent' &&
        constraint.kind === 'time_limit' &&
        !!constraint.dayOfWeek &&
        targetedDays.includes(constraint.dayOfWeek)));
  if (change.maxSessionMinutes === null) {
    return { ...profile, availabilityConstraints: retained };
  }
  const minutes = Math.trunc(change.maxSessionMinutes);
  if (!Number.isFinite(minutes) || minutes < 10 || minutes > 240) {
    throw new Error('permanent_session_time_cap_invalid');
  }
  const owned = targetedDays.map((day): ProgramAvailabilityConstraint => ({
    id: `${PERMANENT_TIME_CAP_PREFIX}${day.toLowerCase()}`,
    kind: 'time_limit',
    scope: 'permanent',
    dayOfWeek: day,
    maxSessionMinutes: minutes,
    active: true,
    reason: 'Permanent athlete session time cap',
    createdAt: now,
    updatedAt: now,
  }));
  return {
    ...profile,
    availabilityConstraints: [...retained, ...owned],
  };
}

/**
 * ⚠ **A TYPED REFUSAL IS CARRIED BY ITS CODE, NEVER BY ITS SENTENCE.**
 *
 * This transaction returns a `reason` STRING and the surfaces hand that string
 * to `classifyProgramMutationRefusal`, whose whole job is to turn a typed reason
 * into the athlete's account of it. Every reason the door emits deliberately is
 * a stable code (`accepted_revision_changed`, `no_change`, …) — but this catch
 * used `error.message`, so an error that already KNEW what it was arrived as
 * free prose and the classifier could only answer `unknown`.
 *
 * **MEASURED 2026-08-20 through the real Profile setup door.** An In-season
 * athlete with two club nights and a Saturday game cut their gym days to one.
 * The scheduler refused correctly and the whole change rolled back correctly —
 * and the athlete was told *"Something went wrong. Please try again."* while the
 * app was holding `Weekly schedule refused (not_enough_legal_gym_days: WC-142)`.
 * That sentence is the exact one `rules/programMutationRefusal`'s header names
 * as the disease it was written to cure; it survived here because the cure was
 * applied to the reasons this door RETURNS and not to the errors it CATCHES.
 *
 * **IT READS `code`, NOT A LIST OF ERROR CLASSES**, so the next typed refusal
 * thrown under this door is carried the same way without anybody remembering to
 * add it. A code with no row in `REASON_KINDS` still lands in `unknown` — which
 * is the honest answer, and `phaseShiftAtomicityTests`' fall-through cell is
 * where a shipped code without copy is supposed to go red.
 */
function typedRefusalReason(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && code.length > 0) return code;
  return error instanceof Error ? error.message : String(error);
}

function factFreeBase(args: {
  profile: OnboardingData;
  todayISO: string;
  now: string;
  sourceRevision: number;
}): AcceptedCompositionBaseV1 {
  const state = useProgramStore.getState();
  let surfaces = normalizeAcceptedProgramSurfaces(state);
  if (state.currentProgram) {
    /**
     * ⚠ **WHICH BLOCK THE ATHLETE IS IN, AND WHAT THEY HAVE LIFTED — STATED, NOT
     * LEFT FOR GENERATION TO GUESS.**
     *
     * **THE DEFECT THIS CLOSES, MEASURED 2026-08-20 THROUGH THE REAL DOORS.** An
     * athlete four weeks into block 1, who had recorded nineteen days, typed their
     * own loads and crossed a REAL rollover into block 2, changed their usual game
     * day from Saturday to Sunday. Afterwards:
     *
     *     acceptedBlocks  {2026-07-13:1, 2026-08-10:2} -> {2026-07-13:1, 2026-08-10:1}
     *     blockState      blockNumber 2 -> 1
     *     Leg Press       113.5 kg -> 110 kg      (their own recorded 111 -> gone)
     *     RDLs             82.5 kg ->  80 kg
     *
     * **and it survived the relaunch, so it was permanent.** Sam's ruling of
     * 2026-08-18 — *"Once Block 2 is accepted, restart must never infer or reset
     * them to Block 1"* — was held at boot and broken here, by the one door the
     * athlete uses to change their setup.
     *
     * **THE CAUSE IS FOUR MISSING ARGUMENTS, WHICH IS R-097's SHAPE EXACTLY.** This
     * call stated `previousProgram` and nothing else, so generation authored a
     * BLOCK 1 with no history; `commitAcceptedStateTransaction` then derived
     * `blockState` from that program and `recordAcceptedBlock` stamped
     * `blockNumber: 1` over the athlete's own block-2 record — the only copy.
     *
     * **THE FIX IS THE PATTERN THE OTHER TWO REGENERATING DOORS ALREADY USE, NOT A
     * NEW ONE.** `weekRebuild.ts:649` (the rollover) and `quiescentBoot.ts:566`
     * (a relaunch) both say the same thing in their own comments: *"the caller
     * that owns the grid STATES the inputs"*. This door owns the grid too — it is
     * the third caller of `generateProgramLocally` that regenerates an accepted
     * athlete's block — and it was the only one not saying so. Nothing is
     * re-derived and no compatibility layer is added; the same four recorded facts
     * are handed over, so a profile change, a rollover and a relaunch author the
     * same block from the same inputs BY CONSTRUCTION.
     *
     * `statedProgressionInputs` is that shared owner — see its header in
     * `programStore.ts` for why the list is a function and not a habit, and for
     * why `blockState ?? currentAcceptedBlock` is two readings of ONE recorded
     * fact rather than a fallback to a guess.
     */
    const progressionHistory = statedProgressionInputs(state);
    const program = generateProgramLocally(args.profile, {
      // ONBOARDING / A PROFILE CHANGE AUTHORS THE BLOCK — the athlete just
      // restated who they are, and this door decides what that block selects.
      recordSelections: 'author',
      // The athlete just changed their season phase / profile. Generation may
      // not veto that fact: unstated, this inherited `restoration` and THREW,
      // and the transaction reported "The profile change could not build a
      // valid accepted base, so nothing changed" for a week the athlete's own
      // marks had made short. (Sam, 2026-07-29 accept-and-reduce; §18 D3.)
      weekAcceptance: 'forward_decision',
      todayISO: args.todayISO,
      previousProgram: state.currentProgram,
      activeConstraints: [],
      readinessSignal: null,
      // ABSENT BLOCK STATE MEANS BLOCK 1 — the pre-existing default, and the
      // truthful answer for an athlete who has not crossed a boundary yet.
      ...(progressionHistory.blockState
        ? { blockNumber: progressionHistory.blockState.blockNumber }
        : {}),
      progressionHistory,
    });
    const context = collectWeekRebuildContext({
      baseProfile: args.profile,
      program,
      todayISO: args.todayISO,
    });
    const sweep = decideOverrideSweep(context);
    surfaces = normalizeAcceptedProgramSurfaces({
      ...surfaces,
      ...buildRebuiltProgramSurfaces(program, sweep, {
        selectedDate: args.todayISO,
      }),
    });
  }
  return {
    protocolVersion: ACCEPTED_COMPOSITION_BASE_PROTOCOL_VERSION,
    capturedAt: args.now,
    updatedAt: args.now,
    sourceRevision: args.sourceRevision,
    provenance: 'accepted_pre_injury',
    surfaces,
  };
}

export async function commitProfileProgramTransaction(
  input: ProfileProgramTransactionInput,
): Promise<ProfileProgramTransactionResult> {
  const now = new Date().toISOString();
  const before = normalizeAcceptedMaterialContext(
    useProgramStore.getState().acceptedMaterialContext,
  );
  if (input.expectedAcceptedRevision !== undefined &&
    input.expectedAcceptedRevision !== before.revision) {
    return {
      ok: false,
      changedProgram: false,
      message: 'The accepted profile changed before this update could be applied.',
      reason: 'accepted_revision_changed',
    };
  }
  const currentProfile = acceptedProfileForContext(
    before,
    useProfileStore.getState().onboardingData,
  );
  let nextProfile: OnboardingData;
  try {
    nextProfile = applyProfileChange(currentProfile, input.change, now);
  } catch (error) {
    return {
      ok: false,
      changedProgram: false,
      message: 'That profile change could not be applied safely.',
      reason: error instanceof Error ? error.message : String(error),
    };
  }
  // "Nothing to do" means THE ACCEPTED STATE ALREADY SATISFIES THIS REQUEST —
  // not "the profile object is byte-identical".
  //
  // Those are different claims, and treating the profile as a proxy for the
  // whole accepted state is what made three separate controls dead on a
  // phase-skewed device. On such a device the profile ALREADY holds the
  // athlete's selection (that is what skew means), so any request to re-own
  // the program under it produces an identical profile — and was discarded as
  // `no_change` while the program stayed built for the phase they left. The
  // skew-repair button, the Profile setup-sheet Save, and the phase-shift
  // sheet all short-circuited here.
  //
  // The transaction publishes the profile AND the program, so its
  // already-satisfied test has to span both. Deliberately NOT a `force` flag
  // or a repair-specific branch: either would let the next caller bypass the
  // check entirely, and neither states what "no change" actually means.
  const profileUnchanged =
    semanticFingerprint(nextProfile) === semanticFingerprint(currentProfile);
  const requestedPhase = nextProfile.seasonPhase ?? null;
  const acceptedOwnedPhase = ownSeasonPhase({
    program: useProgramStore.getState().currentProgram,
    profile: currentProfile,
  }).phase;
  // With no program yet there is nothing to be out of step with, and the
  // owner falls back to the profile selection — so this reads `true` and a
  // genuine no-op stays a no-op.
  const programAlreadyOwnsRequestedPhase =
    requestedPhase === null || acceptedOwnedPhase === requestedPhase;

  if (profileUnchanged && programAlreadyOwnsRequestedPhase) {
    // `no_change` is an OUTCOME with a reason, not bare success. Returning it
    // reason-less is what let a Save button that did nothing look identical to
    // one that worked — see rules/programMutationRefusal.
    return {
      ok: true,
      changedProgram: false,
      message: 'Those profile settings are already active.',
      reason: 'no_change',
      acceptedRevision: before.revision,
    };
  }
  let base: AcceptedCompositionBaseV1;
  try {
    base = factFreeBase({
      profile: nextProfile,
      todayISO: input.todayISO,
      now,
      sourceRevision: before.revision + 1,
    });
  } catch (error) {
    return {
      ok: false,
      changedProgram: false,
      message: 'The profile change could not build a valid accepted base, so nothing changed.',
      reason: typedRefusalReason(error),
    };
  }
  const compatibility = composeTemporarySourceFactCompatibility({
    temporarySourceFacts: before.temporarySourceFacts,
    activeConstraints: [
      ...before.activeConstraints.filter((constraint) =>
        !isAcceptedProfileConstraint(constraint)),
      ...composeAcceptedProfileConstraints(nextProfile, now),
    ],
    readinessSignalsByDate: before.readinessSignalsByDate,
  });
  const acceptedProfileSnapshot: AcceptedProfileSnapshotV1 = {
    protocolVersion: ACCEPTED_PROFILE_SNAPSHOT_PROTOCOL_VERSION,
    capturedAt: before.acceptedProfileSnapshot?.capturedAt ?? now,
    updatedAt: now,
    sourceRevision: before.revision + 1,
    onboardingData: nextProfile,
  };
  const weeks = Array.from(new Set([
    ...(base.surfaces.currentProgram?.microcycles ?? [])
      .map((microcycle) => microcycle.startDate.slice(0, 10)),
    ...(base.surfaces.currentMicrocycle
      ? [base.surfaces.currentMicrocycle.startDate.slice(0, 10)]
      : []),
    ...Object.keys(base.surfaces.weekScopedOverlays),
  ])).sort();
  // THE FIXTURE MARKS ARE NOT CARRIED BY THIS TRANSACTION ANY MORE
  // (Sam's ruling, 2026-08-12, option A of
  // `docs/FIXTURE_STALENESS_OWNERSHIP_REASSESSMENT_2026-08-12.md`).
  //
  // They are a PROJECTION of the profile answer plus the ledger — boot proves
  // it by DROPPING every stored `game`/`noGame` mark and rebuilding them
  // (`quiescentBoot.deriveBootFixtureMarks`, `FIXTURE_BOOT_ORDER_RULING`). This
  // door used to carry `before.markedDays` forward whenever the athlete STAYED
  // In-season, so the one door that had just changed the answer was the one
  // door that did not consult it: game day Saturday -> Wednesday committed,
  // reached disk, and left the athlete's fixtures on Saturday until they killed
  // the app and reopened it.
  //
  // A `leavingInSeason` branch used to live here and is DELETED rather than
  // extended. It was a second author of the same projection, correct only about
  // the case it was written for; the settle below re-derives BOTH cases from
  // the answer, so retiring the marks on a phase exit is now a consequence of
  // the derivation rather than a rule this door remembers. `cell 4` of
  // `fixtureSettleAfterSetupTests` holds that behaviour so the deletion cannot
  // silently regress it.
  //
  // The publication still DECLARES the marks — absent would inherit the prior
  // context and re-open the same staleness one layer down — so it declares the
  // marks it inherited, and the settle re-derives them the moment the decision
  // has landed.
  const nextMarkedDays = before.markedDays;
  const factFingerprint = semanticFingerprint(before.temporarySourceFacts);
  const profileFingerprint = semanticFingerprint(nextProfile);
  let committedBaseFingerprint: string | null = null;
  const transaction = await runCoachMutationTransaction({
    todayISO: input.todayISO,
    allowAcceptedStateOnlyChange: true,
    mutate: () => {
      const result = commitAcceptedStateTransaction({
        // THE EVENING-1 SEASON-CHANGE FAILURE'S LAYER. A phase shift, an
        // equipment answer, a training-day change — every one of them is the
        // athlete stating something new. Unstated, this publication inherited
        // `restoration`, and the equivalence gate threw on a shortfall the
        // athlete had already caused, been told about, and accepted; the
        // transaction rolled back with "the accepted result could not be
        // verified". Pinned by publicationOperationOwnershipTests cell 1.
        operation: 'forward_decision',
        reason: `profile_program:${input.change.kind}:${input.sourceSurface}`,
        program: base.surfaces,
        profile: nextProfile,
        markedDays: nextMarkedDays,
        activeConstraints: compatibility.activeConstraints,
        injuryEpisodes: compatibility.injuryEpisodes,
        temporarySourceFacts: before.temporarySourceFacts,
        readinessSignalsByDate: compatibility.readinessSignalsByDate,
        acceptedCompositionBase: base,
        acceptedProfileSnapshot,
        validateWeekStarts: weeks,
        skipConstraintProjection: true,
      });
      committedBaseFingerprint = semanticFingerprint(
        result.context.acceptedCompositionBase?.surfaces ?? null,
      );
      return result;
    },
    didApply: () => true,
    verifyCandidate: () => {
      if (input.testHooks?.verifyCandidate?.() === false) {
        return { ok: false, reason: 'profile_program_candidate_test_rejection' };
      }
      const accepted = normalizeAcceptedMaterialContext(
        useProgramStore.getState().acceptedMaterialContext,
      );
      if (semanticFingerprint(accepted.acceptedProfileSnapshot?.onboardingData ?? null) !==
        profileFingerprint) {
        return { ok: false, reason: 'accepted_profile_candidate_mismatch' };
      }
      if (semanticFingerprint(accepted.acceptedCompositionBase?.surfaces ?? null) !==
        committedBaseFingerprint) {
        return { ok: false, reason: 'accepted_composition_base_candidate_mismatch' };
      }
      if (semanticFingerprint(accepted.temporarySourceFacts) !== factFingerprint) {
        return { ok: false, reason: 'profile_program_changed_temporary_facts' };
      }
      return { ok: true };
    },
    verifyAfterPersistence: () => {
      if (input.testHooks?.verifyAfterPersistence?.() === false) {
        return { ok: false, reason: 'profile_program_readback_test_rejection' };
      }
      const accepted = normalizeAcceptedMaterialContext(
        useProgramStore.getState().acceptedMaterialContext,
      );
      if (semanticFingerprint(accepted.acceptedProfileSnapshot?.onboardingData ?? null) !==
        profileFingerprint ||
        semanticFingerprint(useProfileStore.getState().onboardingData) !== profileFingerprint) {
        return { ok: false, reason: 'accepted_profile_durable_readback_mismatch' };
      }
      if (semanticFingerprint(accepted.acceptedCompositionBase?.surfaces ?? null) !==
        committedBaseFingerprint ||
        semanticFingerprint(accepted.temporarySourceFacts) !== factFingerprint) {
        return { ok: false, reason: 'profile_program_durable_readback_mismatch' };
      }
      return { ok: true };
    },
  });
  if (!transaction.ok) {
    return {
      ok: false,
      changedProgram: false,
      message: 'The profile and program were rolled back because the accepted result could not be verified.',
      reason: transaction.reason,
    };
  }
  // THE DECISION HAS LANDED, SO THE WORLD SETTLES BY RE-DERIVING — R5.1's
  // switchover, and the same call the injury door and the undo door already
  // make (`injuryEpisodeTransaction.ts`, `undoLastDecision.ts`). It IS
  // `rebuildDerivedWorld` under the replay latch, so the week the athlete sees
  // after changing their setup is the week they see after a relaunch BY
  // CONSTRUCTION rather than by two engines happening to agree.
  //
  // This is what makes the fixture marks above safe to stop hand-carrying: the
  // projection is rebuilt from the answer that just changed. Deliberately AFTER
  // the rollback check — a refused transaction has nothing to settle, and
  // re-deriving over a rolled-back world would publish the very state the
  // refusal protected the athlete from.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { settleDerivedWorldAfterDecision } = require('./quiescentBoot');
  await settleDerivedWorldAfterDecision();
  const accepted = normalizeAcceptedMaterialContext(
    useProgramStore.getState().acceptedMaterialContext,
  );
  return {
    ok: true,
    changedProgram: transaction.diff.hasProgrammingChange,
    message: transaction.diff.hasProgrammingChange
      ? 'Profile updated. The accepted program was rebuilt and verified.'
      : 'Profile updated and durably verified.',
    acceptedRevision: accepted.revision,
  };
}
