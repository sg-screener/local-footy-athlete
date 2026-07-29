import type { OnboardingData } from '../types/domain';
import { useProfileStore } from '../store/profileStore';
import { flushPendingStorageWrites } from '../store/asyncStorageCompat';
import {
  beginAthleteActionTrace,
  emitAthleteActionEvent,
} from './athleteActionDiagnostics';
import { logger } from './logger';

/**
 * How many answers the profile holds right now.
 *
 * The one number that would have shown Sam's wipe the moment it happened: 21
 * answers in, 2 answers out, with the step in between named. Counted, never
 * listed — the log leaves the device.
 */
function answeredFieldCount(): number {
  const data = useProfileStore.getState().onboardingData as Record<string, unknown> | null;
  if (!data) return 0;
  return Object.keys(data).filter((key) => {
    const value = data[key];
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }).length;
}

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
  const answerCountBefore = answeredFieldCount();
  // ON THE TAPE, EVERY STEP (Sam, 2026-07-30). His export carried five log
  // entries, all of them one launch's hydration, and nothing at all from the
  // onboarding that lost twenty-one answers — because this door, the only
  // writer of onboarding answers, never emitted. FIELD NAMES AND COUNTS ONLY.
  const trace = beginAthleteActionTrace({
    source: 'tap',
    actionType: 'program_change',
    route: 'commitOnboardingStep',
  }, undefined, { forceRoot: true });
  useProfileStore.getState().updateOnboardingData(patch);
  emitAthleteActionEvent(trace, 'onboarding_step_committed', {
    fields,
    answerCountBefore,
    answerCountAfter: answeredFieldCount(),
    isOnboardingComplete: useProfileStore.getState().isOnboardingComplete,
  });
  try {
    await flushPendingStorageWrites();
  } catch (cause) {
    const error = new OnboardingStepCommitError(fields, cause);
    logger.error('[Onboarding][commit] durable write failed', {
      fields,
      message: error.message,
    });
    emitAthleteActionEvent(trace, 'athlete_action_failed', {
      internalResultCode: 'onboarding_step_write_failed',
      fields,
    });
    throw error;
  }
}
