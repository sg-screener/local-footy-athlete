import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { OnboardingData } from '../types/domain';
import { normalizeOnboardingRole } from '../utils/roleBuckets';
import {
  profileMirrorPublicationRefusal,
  recordProfileMirrorRefusal,
} from '../rules/profileMirrorNarrowing';
import {
  beginAthleteActionTrace,
  emitAthleteActionEvent,
} from '../utils/athleteActionDiagnostics';
import { logger } from '../utils/logger';
import { canScoreCapacity } from '../data/capacityRubric';
import {
  assessOnboardingCompleteness,
  onboardingIncompleteMessage,
} from '../utils/onboardingCompleteness';
import { asyncStorageCompat } from './asyncStorageCompat';

/**
 * Completion is an outcome with a reason, never a bare flag flip (ruling #3).
 */
export interface OnboardingCompletionOutcome {
  ok: boolean;
  /** Athlete-facing labels from the step registry. Empty iff `ok`. */
  missingAnswers: string[];
  /** Athlete-facing sentence. Empty iff `ok`. */
  message: string;
}

interface ProfileState {
  onboardingData: OnboardingData;
  isOnboardingComplete: boolean;
  isLoading: boolean;
  error: string | null;
  updateOnboardingData: (data: Partial<OnboardingData>) => void;
  completeOnboarding: () => OnboardingCompletionOutcome;
  resetOnboarding: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

/**
 * HONESTLY EMPTY (Sam's ruling 4, 2026-07-31). This used to hand every new
 * athlete a 'Commercial gym' location and an 8-tag kit nobody authored —
 * "can never be missing" was true only because nothing could ever set them.
 * Equipment is now a REQUIRED onboarding answer (`equipmentAnswer`), and a
 * profile with no answer is unanswered, not silently full.
 */
const initialOnboardingData: OnboardingData = {};

let acceptedProfileMirrorPublicationInProgress = false;

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      onboardingData: initialOnboardingData,
      isOnboardingComplete: false,
      isLoading: false,
      error: null,

      // Through the owner like every other writer: the door records the
      // INTENT (`onboarding_step_committed`), the owner records the WRITE.
      // Sam's tape had the first and not the second, so a write that no door
      // issued was invisible by construction.
      updateOnboardingData: (data) => {
        applyProfileOnboardingWrite({
          next: { ...get().onboardingData, ...data } as OnboardingData,
          writer: 'onboarding_step',
        });
      },

      /**
       * Close onboarding — but only over a profile the app can actually build on.
       *
       * Sam's ruling #3 (2026-07-30). Completion used to be an unconditional
       * flag flip, safe only by ACCIDENT of sequencing: `CompleteScreen`
       * generates immediately before calling this, so a fresh accepted snapshot
       * exists and the mirror's equality check short-circuits. The capacity
       * repair card reproduced completion WITHOUT that precondition and the
       * mirror replaced the athlete's whole profile with a stale snapshot.
       *
       * The precondition is now explicit and lives on the action, so it holds
       * for every caller — including ones that do not exist yet. Two owners are
       * asked because they answer different questions: the step registry knows
       * whether a question was ANSWERED, the rubric knows whether the answer can
       * be READ. A profile can pass one and fail the other.
       */
      completeOnboarding: () => {
        const profile = get().onboardingData;
        // The guard's verdict goes on the tape either way. When Sam's refused,
        // the screenshot said "one more answer needed" and listed sixteen — and
        // nothing recorded that the profile it judged held two keys, so the
        // question "was the guard wrong, or was the profile already gone?" took
        // a whole round trip to answer. COUNTS AND LABELS, never answers.
        const record = (outcome: 'accepted' | 'refused', missingAnswers: string[]) => {
          emitAthleteActionEvent(beginAthleteActionTrace({
            source: 'tap',
            actionType: 'program_change',
            route: 'completeOnboarding',
          }, undefined, { forceRoot: true }), 'onboarding_completion_result', {
            outcome,
            missingAnswerCount: missingAnswers.length,
            answeredFieldCount: Object.keys(profile ?? {}).filter((key) => {
              const value = (profile as Record<string, unknown>)[key];
              if (value === undefined || value === null) return false;
              if (typeof value === 'string') return value.trim().length > 0;
              if (Array.isArray(value)) return value.length > 0;
              return true;
            }).length,
          });
        };
        const completeness = assessOnboardingCompleteness(profile);
        if (!completeness.complete) {
          const missingAnswers = completeness.missingSteps.map((step) => step.answerLabel);
          record('refused', missingAnswers);
          return {
            ok: false,
            missingAnswers,
            message: onboardingIncompleteMessage(completeness),
          };
        }
        if (!canScoreCapacity(profile)) {
          const missingAnswers = [
            'your conditioning',
            'how much you have been training lately',
          ];
          record('refused', missingAnswers);
          return {
            ok: false,
            missingAnswers,
            message: "I still need your conditioning and recent training before I can build your program.",
          };
        }
        set({ isOnboardingComplete: true });
        record('accepted', []);
        return { ok: true, missingAnswers: [], message: '' };
      },


      resetOnboarding: () => {
        const resetActionId = beginProfileResetAction('reset_onboarding');
        try {
          applyProfileOnboardingWrite({
            next: initialOnboardingData,
            writer: 'reset',
            resetActionId,
            isOnboardingComplete: false,
          });
        } finally {
          endProfileResetAction(resetActionId);
        }
      },

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),

      clear: () => {
        // A reset is the one write that may erase answers, and it says so.
        // Synchronous, and on the tape either way — see applyProfileOnboardingWrite.
        const resetActionId = beginProfileResetAction('profile_store_clear');
        try {
          applyProfileOnboardingWrite({
            next: initialOnboardingData,
            writer: 'reset',
            resetActionId,
            isOnboardingComplete: false,
          });
        } finally {
          endProfileResetAction(resetActionId);
        }
        set({ isLoading: false, error: null });
      },
    }),
    {
      name: 'profile-store',
      storage: createJSONStorage(() => asyncStorageCompat),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<ProfileState> | undefined;
        const merged = normalizeOnboardingRole({
          ...currentState.onboardingData,
          ...(persisted?.onboardingData ?? {}),
        });
        // THE ONE WRITER THAT CANNOT GO THROUGH THE OWNER — zustand calls this
        // itself, and it returns state rather than setting it. It merges, so it
        // cannot produce the wipe; but a LATE rehydration inside a suspicious
        // window is exactly the kind of thing four reconstructions could not
        // rule in or out, so it goes on the tape with its three counts.
        try {
          emitAthleteActionEvent(beginAthleteActionTrace({
            source: 'system',
            actionType: 'hydration',
            route: 'profile_store_rehydrate',
          }, undefined, { forceRoot: true }), 'profile_rehydrated', {
            persistedAnswerCount: Object.keys(persisted?.onboardingData ?? {}).length,
            liveAnswerCount: Object.keys(currentState.onboardingData ?? {}).length,
            mergedAnswerCount: Object.keys(merged ?? {}).length,
            persistedOnboardingComplete: !!persisted?.isOnboardingComplete,
          });
        } catch {
          // Rehydration must not fail because a diagnostic did.
        }
        return {
          ...currentState,
          ...persisted,
          onboardingData: merged,
        };
      },
    },
  ),
);

/* ══ THE PROFILE WRITE OWNER ══
 *
 * Export 5, and the reason this exists at all. The tape recorded all 22 of
 * Sam's answers going in, one step at a time, 04:54:05 to 04:54:53. At 04:55:24
 * the completion guard judged a profile of TWO. Thirty-one seconds, no log
 * entry, no mirror refusal, and the surviving bytes were exactly
 * `initialOnboardingData`.
 *
 * Four attempts to name that writer by reading code have failed. So the law
 * stops being a rule about one caller and becomes the shape of the store:
 *
 *   1. ONE DOOR. Every write of `onboardingData` goes through here.
 *   2. THE DEFAULT IS NOT A VALUE. Writing the built-in default over a profile
 *      that has real answers is refused, unless the write carries a reset
 *      action that is IN FLIGHT — because that is the only time erasing
 *      answers is what the athlete asked for.
 *   3. AN IN-FLIGHT RESET, NOT A RESET THAT HAPPENED. A stale id — a deferred
 *      write belonging to a reset that finished before the athlete started
 *      answering — is refused. That is the suspected shape of Sam's loss, and
 *      it is refused whether or not it turns out to be the culprit.
 *   4. EVERYTHING IS ON THE TAPE. Applied or refused, every write names its
 *      writer and the answer counts either side of it. A writer the tape
 *      cannot see is a build failure — `profileMirrorNarrowingTests` fails on
 *      any assignment to `onboardingData` outside this function.
 *
 * Counts and field names only, never answers: the tape leaves the device.
 */

export type ProfileWriterId =
  | 'onboarding_step'
  | 'reset'
  | 'compatibility_mirror'
  | 'accepted_transaction'
  | 'coach_rollback_restore';

export interface ProfileWriteOutcome {
  ok: boolean;
  reason?: 'default_over_answered_profile' | 'reset_action_not_in_flight';
}

/** The store's built-in default, exported so writers can be compared against it. */
export const INITIAL_ONBOARDING_DATA: OnboardingData = initialOnboardingData;

/**
 * The saved equipment answer, read at the store's own door.
 *
 * The Equipment screen seeds its edit state from this once on mount. It lives
 * HERE rather than as a selector in the screen so the read is a named door on
 * the owner (the LR-1 direction) instead of one more scattered live-profile
 * read for LR-4 to hunt — when LR-4 migrates readers, this is one site.
 */
export function savedEquipmentAnswer(): OnboardingData['equipmentAnswer'] {
  return useProfileStore.getState().onboardingData?.equipmentAnswer;
}

/**
 * The athlete's OWN kit, resolved — what the temporary "missing equipment this
 * week" flow offers to mark missing (Sam's ruling 5, 2026-07-31: the flow is
 * expressed against the athlete's kit, never a preset menu). Baseline only —
 * deliberately ignores active temporary constraints, or an item already
 * missing this week would vanish from the sheet that manages it.
 */
export function ownedEquipmentKit(): {
  tags: import('../data/exercisePools').EquipmentTag[];
  conditioningModalities: import('../types/domain').ConditioningEquipmentModality[];
} {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { resolveEquipmentCapabilities } = require('../utils/equipmentAvailability');
  const resolved = resolveEquipmentCapabilities(useProfileStore.getState().onboardingData, null);
  return {
    tags: resolved.tags.filter(
      (tag: string) => tag !== 'bodyweight' && tag !== 'bike_or_treadmill'),
    conditioningModalities: resolved.conditioningModalities,
  };
}

const resetActionsInFlight = new Set<string>();
let nextResetActionId = 1;

/**
 * Open a reset. The id is only good while the reset is running, which is what
 * makes a deferred write belonging to a finished reset refusable.
 */
export function beginProfileResetAction(source: string): string {
  const id = `profile-reset:${source}:${nextResetActionId++}`;
  resetActionsInFlight.add(id);
  return id;
}

export function endProfileResetAction(id: string): void {
  resetActionsInFlight.delete(id);
}

function answeredCount(profile: OnboardingData | null | undefined): number {
  if (!profile) return 0;
  const data = profile as Record<string, unknown>;
  return Object.keys(data).filter((key) => {
    const value = data[key];
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }).length;
}

function isTheBuiltInDefault(profile: OnboardingData): boolean {
  return JSON.stringify(profile) === JSON.stringify(initialOnboardingData);
}

export function applyProfileOnboardingWrite(args: {
  next: OnboardingData;
  writer: ProfileWriterId;
  resetActionId?: string;
  isOnboardingComplete?: boolean;
  /** Suppresses the mirror fence for writes that ARE the accepted truth. */
  silenceMirrorFence?: boolean;
}): ProfileWriteOutcome {
  const before = useProfileStore.getState().onboardingData;
  const answerCountBefore = answeredCount(before);
  const record = (outcome: 'applied' | 'refused', reason?: string) => {
    emitAthleteActionEvent(beginAthleteActionTrace({
      source: args.writer === 'onboarding_step' ? 'tap' : 'system',
      actionType: 'program_change',
      route: 'applyProfileOnboardingWrite',
    }, undefined, { forceRoot: true }), 'profile_write', {
      writer: args.writer,
      outcome,
      answerCountBefore,
      answerCountAfter: answeredCount(useProfileStore.getState().onboardingData),
      ...(reason ? { internalResultCode: reason } : {}),
      ...(args.resetActionId ? { resetActionId: args.resetActionId } : {}),
    });
  };

  if (isTheBuiltInDefault(args.next) && answerCountBefore > answeredCount(initialOnboardingData)) {
    if (!args.resetActionId) {
      record('refused', 'default_over_answered_profile');
      return { ok: false, reason: 'default_over_answered_profile' };
    }
    if (!resetActionsInFlight.has(args.resetActionId)) {
      record('refused', 'reset_action_not_in_flight');
      return { ok: false, reason: 'reset_action_not_in_flight' };
    }
  }

  // A reset that leaves onboarding marked complete is not a reset. Stated on
  // the writer rather than trusted to every caller.
  const isOnboardingComplete = args.writer === 'reset'
    ? false
    : args.isOnboardingComplete;
  const silence = args.silenceMirrorFence ?? args.writer !== 'onboarding_step';
  if (silence) acceptedProfileMirrorPublicationInProgress = true;
  try {
    useProfileStore.setState({
      onboardingData: normalizeOnboardingRole(args.next),
      ...(isOnboardingComplete === undefined
        ? {}
        : { isOnboardingComplete }),
    });
  } finally {
    if (silence) acceptedProfileMirrorPublicationInProgress = false;
  }
  record('applied');
  return { ok: true };
}

function canonicalAcceptedProfile(): OnboardingData | null {
  try {
    const accepted = require('./programStore').useProgramStore.getState().acceptedMaterialContext;
    return accepted.revision > 0 && accepted.acceptedProfileSnapshot
      ? accepted.acceptedProfileSnapshot.onboardingData
      : null;
  } catch {
    return null;
  }
}

/**
 * ProgramStore's accepted profile is authoritative; ProfileStore is a read
 * mirror — but the mirror may only NARROW toward it, never widen a gap.
 *
 * THE LAW LIVES HERE, not in the subscriber below (Sam's device, export 4,
 * 2026-07-29). It was written into the subscribe fence, and hydration does not
 * go through the subscribe fence: `hydration_accepted_canonical_projection`
 * calls this function directly, which sets the in-progress flag and therefore
 * bypasses the very guard by design. His export showed the result exactly —
 * a profile wiped to the store's 2-key default next to an EMPTY refusal log,
 * because the guarded path never ran.
 *
 * A guard that only one of two callers passes through is not a guard. Every
 * publication is checked at the one place publication happens.
 *
 * TWO KINDS OF PUBLICATION, and only one of them can un-answer a question:
 *
 *   - `accepted_transaction` — the athlete just changed their profile and this
 *     IS the change. Leaving In-season clears the game day; that is an answer
 *     being removed on purpose, by them, and refusing it would strand the
 *     transaction that made it.
 *   - `stored_snapshot_projection` — a snapshot recorded earlier is being
 *     replayed over whatever is live now. It is a RECORD, it can be stale or
 *     fabricated, and it never outranks a live answer.
 *
 * The caller says which; the default is the guarded reading, so a new caller
 * that says nothing is treated as a projection rather than trusted.
 */
export function publishAcceptedProfileCompatibilityMirror(
  onboardingData: OnboardingData,
  options: { origin?: 'accepted_transaction' | 'stored_snapshot_projection' } = {},
): void {
  const refusal = options.origin === 'accepted_transaction'
    ? null
    : profileMirrorPublicationRefusal({
      live: useProfileStore.getState().onboardingData,
      canonical: onboardingData,
    });
  if (refusal) {
    recordProfileMirrorRefusal(refusal);
    // Also onto the durable tape. The in-memory record dies with the process,
    // and Sam relaunched before exporting — an empty refusal log next to a
    // wiped profile is exactly what that looks like.
    emitAthleteActionEvent(beginAthleteActionTrace({
      source: 'system',
      actionType: 'program_change',
      route: 'publishAcceptedProfileCompatibilityMirror',
    }, undefined, { forceRoot: true }), 'profile_mirror_publication_refused', {
      internalResultCode: refusal.reason,
      droppedAnswers: refusal.droppedAnswers,
    });
    return;
  }
  applyProfileOnboardingWrite({
    next: onboardingData,
    writer: options.origin === 'accepted_transaction'
      ? 'accepted_transaction'
      : 'compatibility_mirror',
  });
}

/** Restore the complete downstream profile mirror without triggering upstream fencing. */
export function restoreAcceptedProfileCompatibilityMirror(snapshot: {
  onboardingData: OnboardingData;
  isOnboardingComplete: boolean;
}): void {
  applyProfileOnboardingWrite({
    next: snapshot.onboardingData,
    writer: 'coach_rollback_restore',
    isOnboardingComplete: snapshot.isOnboardingComplete,
  });
}

useProfileStore.subscribe((state) => {
  if (acceptedProfileMirrorPublicationInProgress) return;
  // Post-acceptance mirror only.
  //
  // The contract this fence enforces is that ProgramStore's *accepted* profile
  // is authoritative. Before onboarding completes there is no accepted program,
  // so there is nothing to mirror — any snapshot present at that point records
  // an acceptance no athlete ever made. Letting the fence run anyway reverted
  // every onboarding answer in memory on a fresh install, which is the confirmed
  // root cause of the 2026-07-24 device report.
  //
  // Reassessment: docs/PROFILE_MIRROR_OWNERSHIP_REASSESSMENT_2026-07-24.md
  // Proof: onboardingReliabilityTests case 0 (whole-journey fresh install).
  if (!state.isOnboardingComplete) return;
  const canonical = canonicalAcceptedProfile();
  if (!canonical ||
    JSON.stringify(state.onboardingData) === JSON.stringify(canonical)) return;
  // NARROW ONLY, NEVER WIDEN (Sam, 2026-07-30).
  //
  // The 2026-07-24 fix scoped WHEN this fence runs. It never constrained WHAT
  // it replaces: the publication below is a whole-object swap, so a snapshot
  // missing answers un-answers them. On Sam's device an ordinary edit against
  // an impoverished snapshot took the profile from 28 answers to 2, seasonPhase
  // among them, and generation then refused an answer he had given months
  // earlier. The athlete's live answers outrank any stored snapshot — the same
  // ownership law as athlete-placed content vs derived filler.
  //
  // Refuse-and-report rather than merge: merging papers over a corrupt snapshot
  // and lets the two representations diverge further every edit. See
  // rules/profileMirrorNarrowing.ts.
  const refusal = profileMirrorPublicationRefusal({
    live: state.onboardingData,
    canonical,
  });
  if (refusal) {
    recordProfileMirrorRefusal(refusal);
    logger.warn('[profile-mirror] publication refused — snapshot would un-answer', {
      droppedAnswers: refusal.droppedAnswers,
    });
    return;
  }
  applyProfileOnboardingWrite({ next: canonical, writer: 'compatibility_mirror' });
});
