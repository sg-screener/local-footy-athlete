/**
 * A REAL DEVICE SHAPE, not a synthetic happy one.
 *
 * Sam's requirement (2026-07-30) after the capacity-repair regression: nothing
 * ships until the loop is proven against a seeded copy of a real device profile.
 *
 * The distinction that matters, and the one every earlier suite missed: a real
 * device has an accepted program, `acceptedMaterialContext.revision > 0` and an
 * `acceptedProfileSnapshot`. Those three facts ARM the profile compatibility
 * mirror. Fixtures built with `revision: 0` and no snapshot leave the mirror
 * inert, so the entire class of defect it can cause is unobservable — which is
 * exactly why a whole-profile wipe passed every gate.
 *
 * `impoverishedSnapshot` reproduces the shape Sam's device was actually in: a
 * stored snapshot carrying almost nothing, against a live profile carrying
 * everything.
 */

import type { OnboardingData, TrainingProgram } from '../../types/domain';
import { generateProgramLocally } from '../../services/api/generateProgram';
import { useProfileStore } from '../../store/profileStore';
import { useProgramStore } from '../../store/programStore';
import { createEmptyReversibleAdjustmentLedger } from '../../rules/reversibleAdjustmentLedger';
import { DEV_E2E_STANDARD_PROFILE } from '../../dev/e2e/devE2EStandardProfile';

export const FIXTURE_TODAY = '2026-07-13';

function quiet<T>(body: () => T): T {
  const warn = console.warn;
  const error = console.error;
  const debug = console.debug;
  console.warn = () => undefined;
  console.error = () => undefined;
  console.debug = () => undefined;
  try {
    return body();
  } finally {
    console.warn = warn;
    console.error = error;
    console.debug = debug;
  }
}

/** Every answerable onboarding step satisfied, including the 2km time trial. */
export function fullyAnsweredProfile(): OnboardingData {
  return {
    ...(DEV_E2E_STANDARD_PROFILE as object),
    twoKmTimeTrial: { seconds: null },
  } as OnboardingData;
}

export interface ArmedMirrorDevice {
  program: TrainingProgram;
  profile: OnboardingData;
}

/**
 * Seed a device with a real generated program and an ARMED mirror.
 *
 * `snapshot` is what the accepted profile snapshot holds — pass a deliberately
 * impoverished object to reproduce Sam's device, or omit it for the healthy
 * case where the snapshot matches the live profile.
 */
export function seedArmedMirrorDevice(options: {
  profile?: OnboardingData;
  snapshot?: Partial<OnboardingData>;
  /**
   * The profile the STORE ends up holding, when it differs from the one the
   * program was built from. This is the realistic shape for a gap: the program
   * was generated back when the answer was present (or when the pre-2026-07-28
   * `catch { return 'medium' }` absorbed its absence), and the answer went
   * missing afterwards. Generating FROM a gapped profile is impossible — the
   * rubric refuses — so a fixture that tried would be testing nothing.
   */
  liveProfile?: OnboardingData;
} = {}): ArmedMirrorDevice {
  const profile = options.profile ?? fullyAnsweredProfile();
  const program = quiet(() => generateProgramLocally(profile, {
    todayISO: FIXTURE_TODAY,
    previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1,
      selectedPhase: profile.seasonPhase!,
      phaseEntryWeekStartISO: FIXTURE_TODAY,
      originProvenance: 'explicit_user_phase_change',
      persistenceProvenance: 'preserved_persisted_state',
    },
  }));

  useProgramStore.setState({
    currentProgram: program,
    currentMicrocycle: program.microcycles[0] ?? null,
    todayWorkout: null,
    isGenerating: false,
    isLoading: false,
    error: null,
    blockState: null,
    acceptedMaterialContext: {
      markedDays: {},
      readinessSignalsByDate: {},
      activeConstraints: [],
      activeInjury: null,
      // revision > 0 AND a snapshot present is what arms the mirror.
      revision: 1,
      lastTransaction: 'armed-mirror-fixture:seed',
      injuryEpisodes: [],
      temporarySourceFacts: [],
      acceptedCompositionBase: null,
      acceptedProfileSnapshot: {
        protocolVersion: 1,
        capturedAt: `${FIXTURE_TODAY}T00:00:00.000Z`,
        updatedAt: `${FIXTURE_TODAY}T00:00:00.000Z`,
        sourceRevision: 1,
        onboardingData: (options.snapshot ?? profile) as OnboardingData,
      },
    },
    dateOverrides: {},
    overrideContexts: {},
    weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {},
    sessionFeedback: {},
    weightOverrides: {},
  } as never);

  // The program store is seeded FIRST, deliberately. `useProfileStore.setState`
  // fires the mirror subscription synchronously, and the mirror reads the
  // CURRENT accepted snapshot — so writing the profile first publishes whatever
  // snapshot the previous fixture left behind, and the seed silently becomes
  // order-dependent. That cost an afternoon here; it is also the boot order.
  useProfileStore.setState({
    onboardingData: options.liveProfile ?? profile,
    isOnboardingComplete: true,
  } as never);

  return { program, profile };
}

/** The snapshot Sam's device was carrying: almost nothing. */
export const IMPOVERISHED_SNAPSHOT: Partial<OnboardingData> = {
  trainingLocation: 'Commercial gym',
  equipment: ['barbell'],
} as Partial<OnboardingData>;

export function liveProfile(): OnboardingData {
  return useProfileStore.getState().onboardingData;
}

export function liveAnswerCount(): number {
  return Object.keys(liveProfile()).length;
}
