import type { OnboardingData } from '../types/domain';
import { useProfileStore } from '../store/profileStore';
import { flushPendingStorageWrites } from '../store/asyncStorageCompat';
import { logger } from './logger';

/**
 * The onboarding write owner.
 *
 * Every onboarding step used to call `updateOnboardingData()` and navigate on
 * the next line. That updates memory synchronously and fires an AsyncStorage
 * write nothing waits on, so a relaunch between the two loses the answer with
 * no trace — the confirmed data-loss mechanism in
 * docs/ONBOARDING_PERSISTENCE_DIAGNOSIS_2026-07-24.md §3.2/§4.
 *
 * `commitOnboardingStep` is the single door: it updates live state, then
 * resolves only once the answer is durably on disk. Screens `await` it before
 * navigating, so the flow can never advance past an answer that was not saved.
 * A failed write throws instead of being swallowed — an athlete who cannot be
 * saved must be told, not silently advanced.
 */
export class OnboardingStepCommitError extends Error {
  readonly fields: readonly string[];

  constructor(fields: readonly string[], cause: unknown) {
    super(
      `Onboarding answer could not be saved (${fields.join(', ')}): ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    );
    this.name = 'OnboardingStepCommitError';
    this.fields = fields;
    if (cause instanceof Error && cause.stack) this.stack = cause.stack;
  }
}

export async function commitOnboardingStep(
  patch: Partial<OnboardingData>,
): Promise<void> {
  const fields = Object.keys(patch);
  useProfileStore.getState().updateOnboardingData(patch);
  try {
    await flushPendingStorageWrites();
  } catch (cause) {
    const error = new OnboardingStepCommitError(fields, cause);
    logger.error('[Onboarding][commit] durable write failed', {
      fields,
      message: error.message,
    });
    throw error;
  }
}
