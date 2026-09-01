/**
 * THE COACH'S SIDE OF THE "HOW MANY SESSIONS A WEEK" CONVERSATION — R-105.
 *
 * Sam, 2026-08-19: *"This should not be popping up on the main page - it should
 * show up in the coaches chat with a notification"*.
 *
 * ## WHAT THIS HOOK IS, AND WHAT IT REFUSES TO BE
 *
 * It is the ONE place that turns stores into the arguments
 * `deriveWeeklyCommitmentConversation` needs, and turns the athlete's tap into a
 * call on the existing doors. **It decides nothing.** Every gate lives in
 * `rules/`; every word is signed; every write goes through
 * `store/weeklyCommitmentAnswer.ts`, which is already the app's only writer for
 * this decision and which rebuilds through
 * `commitProfileProgramTransaction` — the canonical accepted-program
 * transaction, not a second rebuild path.
 *
 * ## ⚠ THE NOTIFICATION IS DERIVED, LIKE THE QUESTION
 *
 * R-099 ruled that the question is derived and only the answer is stored, and
 * the notification is the same object seen from the tab bar: `hasNotification`
 * is `conversation !== null`, computed from the same facts in the same pass.
 * There is no unread flag, no badge counter and no expiry job — so nothing can
 * forget to clear it, and closing and reopening the app cannot resurrect a
 * notification for a question the athlete has already answered.
 *
 * ## ⚠ IT SUPPLIES `acceptedBlocks`, AND THAT CLOSES A LIVE DEFECT
 *
 * MEASURED on `main @ 9f081efa`: `useBlockBoundaryPrompts` read
 * `acceptedBlocks?.[start]?.requiredStrengthSessions ?? 0` and
 * `readBlockHistory` gates on `> 0`, while `useHomeScreen` — the only
 * production caller — never passed `acceptedBlocks` at all. **A reader with no
 * writer, so the extra-session offer could not reach one athlete.** The
 * conversation's input type makes it REQUIRED, and this hook is where it comes
 * from.
 *
 * ## COST — AN ATHLETE WHO WILL NOT BE ASKED PAYS NOTHING
 *
 * The legality probe and the candidate build are CLOSURES. The derivation runs
 * its cheap gates — block number, commitment, attendance, the ledger — and
 * returns before calling either on every athlete who is not being asked. The one
 * generation that a live offer costs happens at most once per block.
 */

import { useCallback, useMemo } from 'react';
import { useProgramStore } from '../../store/programStore';
import { useProfileStore } from '../../store/profileStore';
import { useDecisionLedgerStore } from '../../store/decisionLedgerStore';
import {
  confirmWeeklyCommitment,
  declineWeeklyCommitment,
  EXTRA_SESSION_SOURCE_SURFACE,
  WEEKLY_COMMITMENT_SOURCE_SURFACE,
  type ConfirmWeeklyCommitmentResult,
} from '../../store/weeklyCommitmentAnswer';
import { generateProgramForProfile } from '../../utils/weekRebuild';
import {
  deriveWeeklyCommitmentConversation,
  type CommitmentConversation,
  type CommitmentConversationOutcome,
  type CommitmentConversationRefusal,
} from '../../rules/weeklyCommitmentConversation';
import { commitmentLegalityProbe } from '../../rules/weeklyCommitmentLegality';
import {
  availableTrainingDays,
} from '../../rules/extraSessionOffer';
import { commitmentPatchFor } from '../../rules/weeklyCommitmentQuestion';
import { DAYS_OF_WEEK } from '../../rules/gameAnchor';
import { todayISOLocal } from '../../utils/appDate';

export interface CoachWeeklyCommitment {
  /** The live conversation, or `null` when there is nothing to ask. */
  readonly conversation: CommitmentConversation | null;
  /** Why there is none. Named so a guard can say which gate closed. */
  readonly refusal: CommitmentConversationRefusal | null;
  /** R-105's notification. Derived: true exactly while a conversation is live. */
  readonly hasNotification: boolean;
  /** Say yes to one of the offered counts. Goes through the canonical door. */
  readonly accept: (sessionsPerWeek: number) => Promise<ConfirmWeeklyCommitmentResult | null>;
  /** Say no. One ledger entry; no program write, and no way to make one. */
  readonly decline: () => void;
}

/**
 * The arguments the derivation needs, assembled from the stores.
 *
 * ⚠ **EXPORTED AND PURE OVER ITS INPUTS SO A GUARD CAN DRIVE THE REAL ONE.** A
 * cell that rebuilt these arguments by hand would be testing its own
 * assembly — the `AN UNDER-FED STATE ANSWERS "NO"` shape. Suites call this with
 * the store snapshots they just wrote.
 */
type ProgramState = ReturnType<typeof useProgramStore.getState>;

export function coachWeeklyCommitmentInputs(state: {
  currentProgram: ProgramState['currentProgram'];
  blockNumber: number | null;
  blockStartISO: string | null;
  sessionFeedback: ProgramState['sessionFeedback'];
  acceptedBlocks: ProgramState['acceptedBlocks'];
  onboardingData: ReturnType<typeof useProfileStore.getState>['onboardingData'];
  trackedLiftChoices?: ReturnType<typeof useProfileStore.getState>['trackedLiftChoices'];
  ledgerEntries: ReturnType<typeof useDecisionLedgerStore.getState>['entries'];
  todayISO: string;
  /**
   * THE REST OF WHAT THE BUILD NEEDS, STATED. Defaulted so a caller that only
   * cares about the QUESTION need not assemble a whole world — the preview is
   * the only consumer, and a preview built on an empty override map is a preview
   * that says so rather than one that quietly reads a different world.
   */
  weightOverrides?: ProgramState['weightOverrides'];
  blockState?: ProgramState['blockState'];
  markedDays?: ProgramState['acceptedMaterialContext']['markedDays'];
  activeConstraints?: ProgramState['acceptedMaterialContext']['activeConstraints'];
}) {
  const profile = state.onboardingData;
  /**
   * ⚠ **READ INSIDE THE CLOSURES, NEVER BEFORE THEM, AND A GUARD CAUGHT ME
   * DOING IT THE OTHER WAY.** `test:block-two-extra-session` holds a real cost
   * property — *"an athlete who was never going to be offered anything never
   * pays for the probe"* — and its instrument counts reads of the profile's
   * `preferredTrainingDays`. Computing the free days up here read that field for
   * every athlete on every redraw, including the ones the first gate refuses,
   * and reddened that cell at `preferredTrainingDays` read 2 times. Memoised so
   * the two closures that DO need it still share one computation.
   */
  let availableCache: readonly import('../../types/domain').DayOfWeek[] | null = null;
  const available = (): readonly import('../../types/domain').DayOfWeek[] => {
    if (availableCache === null) {
      availableCache = profile
        ? availableTrainingDays({ profile, weekOrder: DAYS_OF_WEEK })
        : [];
    }
    return availableCache;
  };
  return {
    currentProgram: state.currentProgram,
    blockNumber: state.blockNumber,
    blockStartISO: state.blockStartISO,
    todayISO: state.todayISO,
    sessionFeedback: state.sessionFeedback,
    onboardingData: profile,
    ledgerEntries: state.ledgerEntries,
    weekOrder: DAYS_OF_WEEK,
    acceptedBlocks: state.acceptedBlocks ?? {},
    // GENERATION ANSWERS LEGALITY. A closure — nothing builds until a gate that
    // needs the answer is actually reached.
    isCommitmentLegal: (sessionsPerWeek: number): boolean => {
      if (!profile || !state.blockStartISO || state.blockNumber === null) return false;
      return commitmentLegalityProbe({
        profile,
        blockStartISO: state.blockStartISO,
        blockNumber: state.blockNumber,
        weekOrder: DAYS_OF_WEEK,
        availableDays: available(),
      })(sessionsPerWeek);
    },
    /**
     * ⚠ **THE PREVIEW IS THE PRODUCER THAT ACTUALLY LANDS, RUN AND NOT
     * COMMITTED — AND WHICH PRODUCER THAT IS WAS MEASURED, NOT ASSUMED.**
     *
     * The obvious choice was `commitProfileProgramTransaction`'s own intermediate
     * builder, on the reasoning that the transaction is what commits. **It was
     * wrong, in 40 of 90 prescriptions**, because that builder hands generation
     * **no `progressionHistory`** and the program the athlete is left on is
     * built with it: `Bulgarian Split Squats 3x8-10 @25` previewed against
     * `4x8-10 @25` delivered, and so on for every set count and load in the
     * block. `generateProgramForProfileFromStore` is the step
     * `rebuildLocalWeek` performs, hands generation the store's recorded
     * history, and matched the delivered program EXACTLY.
     *
     * Two things make this a preview rather than a change:
     *
     *  - `recordSelections: false` — `'author'` appends to the block-selection
     *    history, so an authoring preview would write persisted state for a
     *    change nobody agreed to AND rotate the acceptance away from its own
     *    prediction. The output is unaffected; only the write is.
     *  - nothing is committed. This returns a program object; the caller shows
     *    it and throws it away.
     *
     * The rejected `codex/finish-product` candidate predicted the changed day
     * from the CURRENT week instead of building it, and was measured wrong on 11
     * of 20 generated worlds. There is no prediction here at all.
     */
    candidateProgramFor: (sessionsPerWeek: number) => {
      if (!profile) return null;
      const patch = commitmentPatchFor({
        profile,
        sessionsPerWeek,
        weekOrder: DAYS_OF_WEEK,
        availableDays: available(),
      });
      /**
       * ⚠ **ONE PROFILE THROUGH THE WHOLE CONVERSATION — the one every gate
       * above reasoned about, with the same patch on it.**
       *
       * The first cut reached `profileProgramTransaction`'s own first step,
       * which patches the ACCEPTED profile snapshot read from the store. That is
       * what acceptance does, and it was still wrong here for two reasons, one
       * measured and one structural:
       *
       *  - MEASURED: it made the preview read a store the caller had not been
       *    given. `test:block-two-extra-session` drives a world whose profile is
       *    an ARGUMENT, so the accepted snapshot was empty and every candidate
       *    build refused — the offer vanished for an athlete who has one.
       *  - STRUCTURAL: deciding the offer from one profile and previewing it
       *    from another is two athletes in one conversation. If the accepted
       *    snapshot and the live profile ever disagree, that is a defect in its
       *    own right and it must not be discovered as a wrong preview.
       *
       * `test:coach-weekly-reduction` asserts the two agree at the moment the
       * offer is put, so a divergence reds rather than hides here.
       */
      const nextProfile = { ...profile, ...patch };
      try {
        return generateProgramForProfile({
          profile: nextProfile,
          todayISO: state.todayISO,
          blockNumber: state.blockNumber ?? undefined,
          recordSelections: false,
          // ⚠ EVERY INPUT FROM THIS HOOK'S OWN ARGUMENTS, NOT FROM THE STORE.
          // A store-reading build answered about a world nobody was looking at
          // the moment the caller held a program the store had not published —
          // measured, as two suites going red.
          previousProgram: state.currentProgram ?? null,
          markedDays: state.markedDays ?? {},
          activeConstraints: state.activeConstraints ?? [],
          progressionHistory: {
            sessionFeedback: state.sessionFeedback,
            weightOverrides: state.weightOverrides ?? {},
            blockState: state.blockState ?? null,
            acceptedBlocks: state.acceptedBlocks,
          },
          trackedLiftChoices: state.trackedLiftChoices ?? {},
        });
      } catch {
        // ⚠ SWALLOWED, AND ONLY HERE. A refusal means there is no week to show,
        // which the preview reports as `no_candidate_week` and the conversation
        // turns into no offer at all. Nothing else in this app treats a
        // generation refusal as data.
        return null;
      }
    },
  };
}

/**
 * R-105'S NOTIFICATION, AS A FUNCTION OF THE CONVERSATION AND NOTHING ELSE.
 *
 * ⚠ **EXPORTED SO IT CAN BE MUTATED AND SEEN TO DIE.** It was inline in the hook
 * and a mutation to `hasNotification: true` — a stored-flag-shaped notification
 * that never clears — SURVIVED the whole suite, because every cell reached for
 * the conversation directly and nothing read the notification at all. A cell
 * that asserts the same value twice is not two cells.
 *
 * R-099 ruled that the question is DERIVED and only the ANSWER is stored. The
 * notification is that same object seen from the tab bar: there is no unread
 * flag to clear, nothing to expire, and no way for a relaunch to resurrect a
 * notification for a question the athlete has already answered — because there
 * is no second thing to get out of step.
 */
export function coachCommitmentNotification(
  outcome: CommitmentConversationOutcome,
): boolean {
  return outcome.value !== null;
}

export function useCoachWeeklyCommitment(): CoachWeeklyCommitment {
  const currentProgram = useProgramStore((s) => s.currentProgram);
  const sessionFeedback = useProgramStore((s) => s.sessionFeedback);
  const blockState = useProgramStore((s) => s.blockState);
  const acceptedBlocks = useProgramStore((s) => s.acceptedBlocks);
  const weightOverrides = useProgramStore((s) => s.weightOverrides);
  const acceptedMaterialContext = useProgramStore((s) => s.acceptedMaterialContext);
  const onboardingData = useProfileStore((s) => s.onboardingData);
  const trackedLiftChoices = useProfileStore((s) => s.trackedLiftChoices);
  const ledgerEntries = useDecisionLedgerStore((s) => s.entries);
  const todayISO = todayISOLocal();

  const outcome = useMemo(
    () => deriveWeeklyCommitmentConversation(coachWeeklyCommitmentInputs({
      currentProgram,
      blockNumber: blockState?.blockNumber ?? null,
      blockStartISO: blockState?.blockStartDate ?? null,
      sessionFeedback,
      acceptedBlocks,
      onboardingData,
      trackedLiftChoices,
      ledgerEntries,
      todayISO,
      weightOverrides,
      blockState,
      markedDays: acceptedMaterialContext.markedDays,
      activeConstraints: acceptedMaterialContext.activeConstraints,
    })),
    [currentProgram, blockState, sessionFeedback, acceptedBlocks, onboardingData, trackedLiftChoices,
      ledgerEntries, todayISO, weightOverrides, acceptedMaterialContext],
  );

  const conversation = outcome.value;

  const accept = useCallback(async (sessionsPerWeek: number) => {
    if (!conversation || !onboardingData) return null;
    return confirmWeeklyCommitment({
      forBlockNumber: conversation.forBlockNumber,
      sessionsPerWeek,
      profile: onboardingData,
      todayISO,
      weekOrder: DAYS_OF_WEEK,
      // THE GROWING DIRECTION NEEDS THE FREE DAYS; the shrinking one ignores
      // them. Passing them on both is what makes ONE door serve both answers.
      availableDays: availableTrainingDays({
        profile: onboardingData,
        weekOrder: DAYS_OF_WEEK,
      }),
      sourceSurface: conversation.direction === 'extra_session'
        ? EXTRA_SESSION_SOURCE_SURFACE
        : WEEKLY_COMMITMENT_SOURCE_SURFACE,
    });
  }, [conversation, onboardingData, todayISO]);

  const decline = useCallback(() => {
    if (!conversation) return;
    declineWeeklyCommitment({ forBlockNumber: conversation.forBlockNumber });
  }, [conversation]);

  return {
    conversation,
    refusal: outcome.refusal,
    hasNotification: coachCommitmentNotification(outcome),
    accept,
    decline,
  };
}
