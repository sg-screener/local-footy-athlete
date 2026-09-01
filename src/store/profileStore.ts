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
import { todayISOLocal } from '../utils/appDate';
import { TRACKED_LIFT_PAIRS, type TrackedLiftChoices, type TrackedLiftSlot, type TrackedLiftId } from '../rules/estimatedOneRepMax';
import { canScoreCapacity } from '../data/capacityRubric';
import {
  assessOnboardingCompleteness,
  onboardingIncompleteMessage,
} from '../utils/onboardingCompleteness';
import { asyncStorageCompat, trackDurableWrite } from './asyncStorageCompat';
import {
  decideQuarantinedWrite,
  guardedDurableWrite,
  quarantineRefusedPayload,
  registerQuarantineBoundary,
  releaseQuarantine,
} from './refusedPayloadQuarantine';

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
  /** Progress identity and canonical strength-programming anchor.
   * Writer: Progress; readers: compiler + Progress + feedback; guard: test:estimated-1rm. */
  trackedLiftChoices: TrackedLiftChoices;
  setTrackedLiftChoice: (slot: TrackedLiftSlot, lift: TrackedLiftId) => void;
  onboardingData: OnboardingData;
  isOnboardingComplete: boolean;
  /**
   * ── THE DAY THE ATHLETE SIGNED UP — SAM, 2026-08-22: *"yes it should save
   * sign up day"* ──
   *
   * **WRITER:** `completeOnboarding`, once, on the accepted path only.
   * **READER:** the missed-session history boundary (`useHomeScreen`) — days
   * before this are days the athlete could not have trained, so they are never
   * chased. **TEST:** `test:missed-signup`.
   *
   * ⚠ **IT IS A FACT, NOT A DERIVATION, WHICH IS WHY IT HAS TO BE STORED.**
   * The boundary was read from `currentProgram.createdAt` — and the program is
   * rebuilt on every launch, so that date was always today and the follow-up
   * could never fire. Nothing else in the app remembers when this athlete
   * arrived: the block start is the MONDAY of their first week, so a Wednesday
   * signup would be asked about the Monday before it.
   *
   * A LOCAL CALENDAR DATE, not an instant. A Thursday-morning signup in
   * Melbourne is still Wednesday in UTC, and slicing the raw ISO instant would
   * exempt one day too few — the same trap
   * `programHistoryBoundaryFromCreatedAt` documents.
   *
   * MONOTONIC ONCE SET. Completing onboarding a second time (the capacity
   * repair path reaches it) must not re-date an athlete who has been training
   * for a month. A RESET clears it, because that athlete is starting again.
   */
  signupDateISO: string | null;
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
// Captured synchronously by the persistence wrapper. Zustand calls setItem
// before `setState` returns, so this names the decision that produced the
// exact envelope even though the physical write finishes later.
let activeProfilePersistenceWriter: string | null = null;

export const PROFILE_STORE_PERSISTENCE_KEY = 'profile-store';

/**
 * THE STORE'S WRITER BOUNDARY, declared once (store-armour recipe §3 —
 * the quarantine was the one protection this store still lacked; the door,
 * tape and sweep have existed since the profile-wipe unit). A payload carries
 * the athlete's material when at least one answered field survives in it —
 * the same answered-count semantics the door's refusal already uses.
 * Unreadable bytes prove nothing and answer no.
 */
function profileEnvelopeCarriesMaterial(envelope: string): boolean {
  try {
    const state = (JSON.parse(envelope) as {
      state?: { onboardingData?: OnboardingData };
    }).state;
    return answeredCount(state?.onboardingData) > 0;
  } catch {
    return false;
  }
}

registerQuarantineBoundary(PROFILE_STORE_PERSISTENCE_KEY, {
  carriesMaterial: profileEnvelopeCarriesMaterial,
});

function recordProfilePersistenceRefusal(reason: string, name: string): void {
  emitAthleteActionEvent(beginAthleteActionTrace({
    source: 'system',
    actionType: 'program_change',
    route: 'profileGuardedStorage.setItem',
  }, undefined, { forceRoot: true }), 'persistence_result', {
    persistenceOperation: 'write',
    persistenceStore: name,
    persistenceSucceeded: false,
    originalRejectionCode: reason,
    rejectingBoundary: 'profileGuardedStorage.setItem.quarantine',
    failureCategory: 'persistence_failure',
  });
  logger.error('[profileStore] refused to persist over a quarantined payload.',
    { store: name, reason });
}

/**
 * The single persistence writer. A REFUSAL MUST NEVER PERSIST THE STATE IT
 * REFUSED INTO (Sam, 2026-07-30): while a refused material payload is held,
 * a bare payload does not travel; a material one always passes and releases
 * the hold. Exported for `profileStoreQuarantineTests`, which proves this
 * store's boundary rather than trusting the law's fixture cell.
 */
/**
 * WRITES TO THIS STORE LAND IN THE ORDER THEY WERE ISSUED — Sam's ruling,
 * 2026-08-12: "fix it".
 *
 * THE DEFECT THIS EXISTS FOR. The bare-envelope arm below asks the disk before
 * it writes, and that question is one async hop. The material arm asks nothing
 * and goes straight through. So a WIPE issued FIRST could finish LAST and land
 * on top of the answers issued after it — the guard meant to protect the
 * athlete's answers was what sent the wipe to the back of the queue, where it
 * won.
 *
 * Measured on 2026-08-12, in the walker's L16 relaunch cell. Five writes, in
 * issue order at this boundary: bare 103B, then 1261B, 1260B, 1260B, 1260B —
 * four of them carrying all 40 answers with `isOnboardingComplete: true`. In
 * ARRIVAL order at the durable boundary the bare one came LAST, and the disk
 * kept 103 bytes. The athlete's profile was then empty on disk while memory
 * still held it, so the next launch had no answers to rebuild the program from
 * and `THE L16 SLICE` failed at PERSIST, exactly as it said.
 *
 * THE FIX IS THE REMOVAL OF THE REORDERING, NOT A GUARD OVER IT. Every write to
 * this key is chained onto the one before it, so the disk question happens at
 * the asking write's OWN position in the queue rather than racing ahead of it.
 * Two things follow, and the second is the point:
 *
 *   1. Issue order IS land order. A later write can no longer be overtaken.
 *   2. THE QUARANTINE LAW STARTS WORKING. The bare write now reads a disk that
 *      already holds the answers written before it, so `quarantineRefusedPayload`
 *      holds a MATERIAL payload and `guardedDurableWrite` REFUSES the bare
 *      envelope — which is what the law said all along. Racing ahead meant it
 *      read an empty disk, held nothing, and was allowed through.
 *
 * The chain swallows rejections for SEQUENCING only: one failed write must not
 * strand every later write behind it. The rejection itself still travels to
 * whoever awaits this call, and to `flushPendingStorageWrites` through
 * `trackDurableWrite`.
 */
let profileWriteChain: Promise<unknown> = Promise.resolve();

export const profileGuardedStorage = {
  getItem: (name: string): Promise<string | null> => asyncStorageCompat.getItem(name),
  setItem: (name: string, value: string): Promise<void> => {
    // READ AT ISSUE TIME, NOT AT WRITE TIME. The writer identity belongs to the
    // moment the write was requested; by the time the chain reaches this write
    // the latch has long since been restored to whatever came next.
    const writer = activeProfilePersistenceWriter;
    const queued = profileWriteChain.then(async () => {
      const write = (): Promise<void> => guardedDurableWrite({
        storeKey: name,
        envelope: value,
        base: asyncStorageCompat,
        onRefused: (reason) => recordProfilePersistenceRefusal(reason, name),
      });

      // A RESET is the only decision allowed to replace an answered profile with
      // the bare default. Every other bare envelope first asks the disk itself.
      // This closes the cold-reload window in which memory was still empty, so
      // the in-memory door saw 0 -> 0 and could not know it was overwriting the
      // 28-answer payload hydration was concurrently reading.
      if (writer === 'reset' || profileEnvelopeCarriesMaterial(value)) return write();
      const onDisk = await asyncStorageCompat.getItem(name);
      quarantineRefusedPayload(name, onDisk);
      return write();
    });
    profileWriteChain = queued.catch(() => undefined);
    return trackDurableWrite(queued);
  },
  removeItem: (name: string): Promise<void> => asyncStorageCompat.removeItem(name),
};

/**
 * The DISK copy, not the in-memory one — memory survives a refusal by
 * construction; the envelope on disk is what a later writer can destroy.
 * Best-effort and async: a quarantine that crashed the refusal it protects
 * would be worse than no quarantine.
 */
function quarantineDiskCopyBestEffort(): void {
  void asyncStorageCompat.getItem(PROFILE_STORE_PERSISTENCE_KEY)
    .then((envelope) => quarantineRefusedPayload(PROFILE_STORE_PERSISTENCE_KEY, envelope))
    .catch(() => {});
}

/**
 * WHAT A REHYDRATION MAY AND MAY NOT DO — the profile merge, as a named owner.
 *
 * ## Why it is a function and not an inline callback
 *
 * It was inline until 2026-08-12, which meant the rule it enforces could not be
 * called by any cell — and the rule turned out to be wrong. A behaviour nothing
 * can reach is a behaviour nothing can check.
 *
 * ## THE DEFECT THIS CLOSES (SEAT_INBOX item 2, "NOT PAID, NOT INVESTIGATED")
 *
 * The old body ended `{ ...currentState, ...persisted, onboardingData: merged }`.
 * It took real care over ONE field — `onboardingData` is merged so a missing
 * answer cannot erase a live one — and then let every OTHER field take the
 * disk's word, including `isOnboardingComplete`.
 *
 * So reading back a bare envelope (the 103-byte shell an interrupted wipe
 * leaves) flipped a finished profile to unfinished IN MEMORY. That flag gates
 * the app: a finished athlete is sent to the first-run flow with their program
 * still sitting in the other stores. Nothing throws and nothing logs.
 *
 * **The asymmetry was the whole bug.** Someone saw the danger for the answers
 * and did not see that the flag SAYING those answers exist carries it too.
 *
 * ## THE RULE: COMPLETION IS MONOTONIC WITHIN A PROCESS
 *
 * Onboarding finishing is an EVENT, and reading the disk is not an event. So
 * this may RAISE the flag from a persisted `true` and may never lower a live
 * one. Un-finishing has exactly one door and it is the athlete's own —
 * `resetProfile`, which sets the flag directly and does not come through here.
 *
 * ## WHAT IT DELIBERATELY DOES NOT DO
 *
 * It does not protect every field. Stating the narrow scope is the honest half:
 * a future field whose absence is destructive gets the same treatment and its
 * own cell, and the next reader must not assume this merge is generally safe.
 */
export function mergePersistedProfileState(
  persisted: Partial<ProfileState> | undefined,
  currentState: ProfileState,
): ProfileState {
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
      // The count that would have shown this defect on the tape for a month.
      liveOnboardingComplete: !!currentState.isOnboardingComplete,
    });
  } catch {
    // Rehydration must not fail because a diagnostic did.
  }
  return {
    ...currentState,
    ...persisted,
    onboardingData: merged,
    // MONOTONIC, AND THIS LINE IS THE FIX. `||` and not `??`: the bare envelope
    // carries `false` rather than nothing, so a nullish check would not see it.
    isOnboardingComplete:
      !!currentState.isOnboardingComplete || !!persisted?.isOnboardingComplete,
    // THE EARLIEST ONE WINS, for the same reason completion is monotonic: disk
    // holds the day this athlete actually arrived, and a live store that has
    // just stamped today must not overwrite it.
    signupDateISO: persisted?.signupDateISO ?? currentState.signupDateISO ?? null,
  };
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      trackedLiftChoices: {},
      setTrackedLiftChoice: (slot, lift) => {
        if (!TRACKED_LIFT_PAIRS[slot]?.includes(lift)) return;
        const previous = get().trackedLiftChoices;
        if ((previous[slot] ?? slot) === lift) return;
        set({ trackedLiftChoices: { ...previous, [slot]: lift } });
        if (!get().isOnboardingComplete) return;
        try {
          // The choice changes the visible program now. Boot and later-week
          // generation use this same persisted input, so there is no UI-only
          // selection that the compiler learns about later.
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          require('./quiescentBoot').rebuildDerivedWorldNow();
        } catch (error) {
          set({ trackedLiftChoices: previous });
          throw error;
        }
      },
      onboardingData: initialOnboardingData,
      isOnboardingComplete: false,
      signupDateISO: null,
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
        // ⚠ `??`, NOT AN ASSIGNMENT: this path is reachable twice (the capacity
        // repair card completes onboarding again), and a second stamp would
        // re-date an athlete who has been training for a month — moving the
        // missed-session boundary forward over days they really did train.
        set({
          isOnboardingComplete: true,
          signupDateISO: get().signupDateISO ?? todayISOLocal(),
        });
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
        set({ trackedLiftChoices: {} });
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
        set({ isLoading: false, error: null, trackedLiftChoices: {} });
      },
    }),
    {
      name: PROFILE_STORE_PERSISTENCE_KEY,
      storage: createJSONStorage(() => profileGuardedStorage),
      merge: (persistedState, currentState) => mergePersistedProfileState(
        persistedState as Partial<ProfileState> | undefined,
        currentState,
      ),
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
      quarantineDiskCopyBestEffort();
      record('refused', 'default_over_answered_profile');
      return { ok: false, reason: 'default_over_answered_profile' };
    }
    if (!resetActionsInFlight.has(args.resetActionId)) {
      quarantineDiskCopyBestEffort();
      record('refused', 'reset_action_not_in_flight');
      return { ok: false, reason: 'reset_action_not_in_flight' };
    }
  }

  // A reset that leaves onboarding marked complete is not a reset. Stated on
  // the writer rather than trusted to every caller.
  const isOnboardingComplete = args.writer === 'reset'
    ? false
    : args.isOnboardingComplete;
  /* AND A RESET CLEARS THE SIGNUP DAY, for the same reason and on the same
     line: an athlete starting again signs up again, and a date left behind
     would tell the missed-session prompt to chase days from a program that no
     longer exists. Every other writer leaves it exactly as it is — it is
     stamped once, by `completeOnboarding`. */
  const clearsSignupDate = args.writer === 'reset';
  const silence = args.silenceMirrorFence ?? args.writer !== 'onboarding_step';
  if (silence) acceptedProfileMirrorPublicationInProgress = true;
  const priorPersistenceWriter = activeProfilePersistenceWriter;
  activeProfilePersistenceWriter = args.writer;
  try {
    useProfileStore.setState({
      onboardingData: normalizeOnboardingRole(args.next),
      ...(isOnboardingComplete === undefined
        ? {}
        : { isOnboardingComplete }),
      ...(clearsSignupDate ? { signupDateISO: null } : {}),
    });
  } finally {
    activeProfilePersistenceWriter = priorPersistenceWriter;
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
