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

/**
 * THE SNAPSHOT SAM'S DEVICE WAS ACTUALLY CARRYING, from his export of
 * 2026-07-29 (`acceptedProfileSnapshot`, `sourceRevision: 1`, captured
 * 2026-07-28T23:59:37Z, while the accepted context had since reached revision
 * 13 without ever refreshing it).
 *
 * These are the real bytes, not a reconstruction — and they carry no personal
 * data precisely BECAUSE of the defect: the object is byte-identical to
 * `profileStore`'s `initialOnboardingData`. That identity is the provenance
 * proof. The snapshot was not built from anything Sam ever answered; it was
 * built from the in-memory default, at a hydration where the persisted profile
 * blob was not readable and a program WAS present.
 *
 * `profileMirrorNarrowingTests` pins the identity — the cell *"the fixture is the
 * HISTORICAL default, and the live default is honestly empty"* — so if
 * `initialOnboardingData` changes and this fixture stops matching it, the drift
 * is visible rather than quietly making the fixture a fiction again.
 * (This line cited `profileMirrorProvenanceTests` until 2026-08-13, a suite that
 * does not exist. The pin is real; the name was not.)
 */
export const IMPOVERISHED_SNAPSHOT: Partial<OnboardingData> = {
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
} as Partial<OnboardingData>;

/** The accepted-context metadata his export carried, for shape-faithful seeds. */
export const SAMS_DEVICE_ACCEPTED_CONTEXT = {
  snapshotSourceRevision: 1,
  snapshotCapturedAt: '2026-07-28T23:59:37.203Z',
  /** Twelve further acceptances never refreshed the snapshot. */
  revisionAtExport: 13,
  liveAnswerCountAtExport: 2,
} as const;

export function liveProfile(): OnboardingData {
  return useProfileStore.getState().onboardingData;
}

export function liveAnswerCount(): number {
  return Object.keys(liveProfile()).length;
}
