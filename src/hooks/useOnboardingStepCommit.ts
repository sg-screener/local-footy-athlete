import { useCallback, useState } from 'react';
import type { OnboardingData } from '../types/domain';
import { commitOnboardingStep } from '../utils/onboardingStepCommit';

const SAVE_FAILED_MESSAGE =
  "I couldn't save that answer. Check your device has storage free and try again.";

interface UseOnboardingStepCommitReturn {
  /**
   * Save the step's answer, then advance. `advance` runs only if the answer is
   * durably on disk — the flow can never move past an answer that was not saved.
   */
  commitAndAdvance: (
    patch: Partial<OnboardingData>,
    advance: () => void,
  ) => Promise<void>;
  /** True while the write is in flight; screens disable Continue on it. */
  saving: boolean;
  /** Athlete-facing copy when the write failed, or null. */
  saveError: string | null;
}

/**
 * The onboarding screens' single commit door.
 *
 * Every step used to call `updateOnboardingData()` and navigate on the next
 * line — an in-memory write plus a fire-and-forget disk write nothing waited
 * on. This hook owns the awaited shape, the in-flight state, and the failure
 * copy in one place, so no screen has to remember any of it and none can
 * quietly reintroduce the unawaited commit.
 */
export function useOnboardingStepCommit(): UseOnboardingStepCommitReturn {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const commitAndAdvance = useCallback(async (
    patch: Partial<OnboardingData>,
    advance: () => void,
  ) => {
    setSaving(true);
    setSaveError(null);
    try {
      await commitOnboardingStep(patch);
      advance();
    } catch {
      // commitOnboardingStep has already logged the cause with its fields.
      setSaveError(SAVE_FAILED_MESSAGE);
    } finally {
      setSaving(false);
    }
  }, []);

  return { commitAndAdvance, saving, saveError };
}
