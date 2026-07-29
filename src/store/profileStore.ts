import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { OnboardingData } from '../types/domain';
import { normalizeOnboardingRole } from '../utils/roleBuckets';
import {
  profileMirrorPublicationRefusal,
  recordProfileMirrorRefusal,
} from '../rules/profileMirrorNarrowing';
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

const initialOnboardingData: OnboardingData = {
  trainingLocation: 'Commercial gym',
  equipment: [
    'barbell',
    'dumbbells',
    'squat_rack',
    'pullup_bar',
    'cable_machine',
    'hamstring_curl',
    'knee_extension',
    'bands',
  ],
};

let acceptedProfileMirrorPublicationInProgress = false;

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      onboardingData: initialOnboardingData,
      isOnboardingComplete: false,
      isLoading: false,
      error: null,

      updateOnboardingData: (data) =>
        set((state) => ({
          onboardingData: normalizeOnboardingRole({
            ...state.onboardingData,
            ...data,
          }),
        })),

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
        const completeness = assessOnboardingCompleteness(profile);
        if (!completeness.complete) {
          return {
            ok: false,
            missingAnswers: completeness.missingSteps.map((step) => step.answerLabel),
            message: onboardingIncompleteMessage(completeness),
          };
        }
        if (!canScoreCapacity(profile)) {
          return {
            ok: false,
            missingAnswers: ['your conditioning', 'how much you have been training lately'],
            message: "I still need your conditioning and recent training before I can build your program.",
          };
        }
        set({ isOnboardingComplete: true });
        return { ok: true, missingAnswers: [], message: '' };
      },


      resetOnboarding: () => {
        set({
          onboardingData: initialOnboardingData,
          isOnboardingComplete: false,
        });
      },

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),

      clear: () => {
        set({
          onboardingData: initialOnboardingData,
          isOnboardingComplete: false,
          isLoading: false,
          error: null,
        });
      },
    }),
    {
      name: 'profile-store',
      storage: createJSONStorage(() => asyncStorageCompat),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<ProfileState> | undefined;
        return {
          ...currentState,
          ...persisted,
          onboardingData: normalizeOnboardingRole({
            ...currentState.onboardingData,
            ...(persisted?.onboardingData ?? {}),
          }),
        };
      },
    },
  ),
);

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

/** ProgramStore's accepted profile is authoritative; ProfileStore is a read mirror. */
export function publishAcceptedProfileCompatibilityMirror(
  onboardingData: OnboardingData,
): void {
  acceptedProfileMirrorPublicationInProgress = true;
  try {
    useProfileStore.setState({
      onboardingData: normalizeOnboardingRole(onboardingData),
    });
  } finally {
    acceptedProfileMirrorPublicationInProgress = false;
  }
}

/** Restore the complete downstream profile mirror without triggering upstream fencing. */
export function restoreAcceptedProfileCompatibilityMirror(snapshot: {
  onboardingData: OnboardingData;
  isOnboardingComplete: boolean;
}): void {
  acceptedProfileMirrorPublicationInProgress = true;
  try {
    useProfileStore.setState({
      onboardingData: normalizeOnboardingRole(snapshot.onboardingData),
      isOnboardingComplete: snapshot.isOnboardingComplete,
    });
  } finally {
    acceptedProfileMirrorPublicationInProgress = false;
  }
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
  acceptedProfileMirrorPublicationInProgress = true;
  try {
    useProfileStore.setState({
      onboardingData: normalizeOnboardingRole(canonical),
    });
  } finally {
    acceptedProfileMirrorPublicationInProgress = false;
  }
});
