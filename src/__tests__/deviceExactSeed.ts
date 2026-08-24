/**
 * Canonical device-exact seed fixture (shared test helper).
 *
 * One install path that bundles EVERY fidelity dimension the device boots into, so no
 * suite can silently seed a half-faithful week (the seed-fidelity class that lied three
 * times — null composition base, epoch-0 capturedAt, dropped game fixture; see
 * docs/ILLNESS_CLEAR_LEDGER_REASSESSMENT_2026-07-23.md §5):
 *   1. REAL composition base — seedOnboardingProgram + commitAcceptedStateTransaction with
 *      preserveExactAcceptedWorkouts (R11), not the R1-style null base.
 *   2. WITNESSED fixtures — the seed's calendar marks (e.g. the Saturday game the dev-reset
 *      coordinator installs for standard-in-season-week), applied device-exactly. This is
 *      the dimension the deriving suite dropped (it reset markedDays + stubbed setGameDay),
 *      which hid finding #4's game-week clear failure.
 * Plus a WITNESS SELF-CHECK: after install it asserts the accepted state carries the seed's
 * witnessed calendar marks, and throws loudly if a fidelity dimension was dropped — a
 * harness that cannot silently omit the game mark cannot lie the way finding #4's did.
 *
 * Runs in Release-faithful mode (`__DEV__ = false`, as the device ships): it does NOT freeze
 * the clock, because DevE2EClock requires `__DEV__ = true`, which itself diverges from Release
 * (it changed the visible resolver in the deriving suite). The residual consequence is the
 * QA_RUNBOOK epoch-0 `capturedAt` mask on the durable ROLLBACK path (re-canonicalising fact
 * commits) — a known harness limitation, documented; assertions that can hit it are written
 * to tolerate it. The `src/dev/e2e/` seed registry stays frozen: this is a test-only helper
 * that consumes it. Callers set `(global).__DEV__ = false` and provide a window.localStorage
 * mock.
 */

import type { DevE2ESeedId } from '../dev/e2e/devE2ESeedIds';
import { buildDevE2ESeed, witnessesForDevE2ESeed } from '../dev/e2e/devE2ESeedRegistry';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { normalizeAcceptedMaterialContext } from '../store/acceptedStateColdStart';
import { createEmptyReversibleAdjustmentLedger } from '../rules/reversibleAdjustmentLedger';
import { commitAcceptedStateTransaction } from '../store/acceptedStateTransaction';
import { seedOnboardingProgram } from '../utils/onboardingCompletion';
import { deriveStoredBlockStateFromProgram } from '../utils/programBlockState';
import { executeProgramControlActionDurably } from '../utils/programControlActions';

export interface DeviceExactSeedResult {
  anchor: string;
  gameDate: string | null;
}

// The FIRST scoped-regen COMMIT in a headless process is "cold": lazy pool/tag/projection
// initialisation makes the in-commit projection differ from the post-persistence readback,
// so a first severe-illness/fatigue commit is rejected with
// `semantic_projection_changed_after_persistence` — a harness cold-cache artifact (on device
// generation is always warm, and the illness commit is device-verified). Priming a bare
// generateProgramLocally is NOT enough; the full commit path must run once. We do that on a
// throwaway install; the real install below then resets every store, so no warmup state leaks.
let generationPrimed = false;
/** Prime the cold generation/projection cache ONCE per process by running a full
 *  scoped-regen commit on a throwaway install, so device-exact suites are order-independent
 *  (no reliance on an incidental earlier commit). Call once, awaited, before the first
 *  installDeviceExactSeed assertion. Idempotent. */
export async function primeDeviceExactGeneration(seedId: DevE2ESeedId = 'standard-in-season-week'): Promise<void> {
  if (generationPrimed) return;
  generationPrimed = true;
  const d = buildDevE2ESeed(seedId);
  installBase(d);
  await executeProgramControlActionDurably({
    type: 'set_illness_status',
    source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
    scope: 'current_week',
    payload: { date: d.anchorDate, todayISO: d.anchorDate, severity: 'severe' },
    requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
  } as never, { todayISO: d.anchorDate }).catch(() => undefined);
}

/** Store reset + seedOnboardingProgram (the composition base). No witnessed fixtures. */
function installBase(d: ReturnType<typeof buildDevE2ESeed>): void {
  useCalendarStore.setState({ markedDays: {}, selectedDate: null } as never);
  useReadinessStore.setState({ signalsByDate: {} } as never);
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null } as never);
  useProgramStore.setState({
    weekScopedOverlays: {}, dateOverrides: {}, overrideContexts: {},
    userRemovalConstraints: [], reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {}, sessionFeedback: {}, weightOverrides: {},
    acceptedMaterialContext: normalizeAcceptedMaterialContext({ revision: 0 }),
  } as never);
  const vws = d.program.microcycles.map((m: { startDate: string }) => m.startDate.slice(0, 10));
  quiet(() => seedOnboardingProgram({
    onboardingData: d.profile, program: d.program, todayISO: d.anchorDate,
    programStore: {
      setCurrentProgram: (program: unknown) => { commitAcceptedStateTransaction({
        // Harness seed: installs a world, never restores one.
        operation: 'forward_decision',
        reason: 'device-exact-seed:install',
        program: { currentProgram: program, currentMicrocycle: null, todayWorkout: null,
          blockState: deriveStoredBlockStateFromProgram(program as never) },
        profile: d.profile, preserveExactAcceptedWorkouts: true, validateWeekStarts: vws } as never); },
      setCurrentMicrocycle: (m: { startDate: string } | null) => commitAcceptedStateTransaction({
        // Harness seed: installs a world, never restores one.
        operation: 'forward_decision',
        reason: 'device-exact-seed:mc', program: { currentMicrocycle: m },
        profile: d.profile, preserveExactAcceptedWorkouts: true,
        validateWeekStarts: m ? [m.startDate.slice(0, 10)] : [] } as never),
      setTodayWorkout: (w: unknown) => commitAcceptedStateTransaction({
        // Harness seed: installs a world, never restores one.
        operation: 'forward_decision',
        reason: 'device-exact-seed:today', program: { todayWorkout: w },
        profile: d.profile, preserveExactAcceptedWorkouts: true, validateWeekStarts: [d.anchorDate] } as never),
    },
    fixtureMarkInstaller: { setGameDay: () => undefined },
  } as never));
  useProfileStore.setState({ onboardingData: d.profile, isOnboardingComplete: true });
}

/** No-op kept for callers that want an explicit teardown symbol; there is no frozen
 *  clock or other global to unwind in Release-faithful mode. */
export function teardownDeviceExactSeed(): void {
  /* nothing to unwind */
}

function quiet<T>(body: () => T): T {
  const warn = console.warn; const error = console.error; const log = console.log;
  console.warn = () => undefined; console.error = () => undefined; console.log = () => undefined;
  try { return body(); } finally { console.warn = warn; console.error = error; console.log = log; }
}

/**
 * Install `seedId` device-exactly. `withWitnessedFixtures` (default true) applies the
 * seed's witnessed calendar marks — the game the device has. Pass false ONLY to build the
 * deliberate no-fixture control that proves a fidelity dimension is load-bearing.
 */
export function installDeviceExactSeed(opts?: {
  seedId?: DevE2ESeedId;
  withWitnessedFixtures?: boolean;
}): DeviceExactSeedResult {
  const seedId: DevE2ESeedId = opts?.seedId ?? 'standard-in-season-week';
  const withFixtures = opts?.withWitnessedFixtures ?? true;

  const d = buildDevE2ESeed(seedId);
  installBase(d);
  const vws = d.program.microcycles.map((m: { startDate: string }) => m.startDate.slice(0, 10));

  // Apply the seed's witnessed calendar marks device-exactly (the dev-reset coordinator's
  // installAcceptedCalendarGame equivalent). This is the fidelity dimension the deriving
  // suite dropped.
  const calendarWitnesses = witnessesForDevE2ESeed(seedId, d.program, d.profile)
    .filter((w): w is { kind: 'calendar_mark'; date: string; mark: string } =>
      (w as { kind?: string }).kind === 'calendar_mark');
  let gameDate: string | null = null;
  if (withFixtures && calendarWitnesses.length > 0) {
    const md: Record<string, string> = { ...useProgramStore.getState().acceptedMaterialContext.markedDays };
    for (const w of calendarWitnesses) {
      md[w.date] = w.mark;
      if (w.mark === 'game') gameDate = w.date;
    }
    quiet(() => { commitAcceptedStateTransaction({
      // Harness seed: installs a world, never restores one.
      operation: 'forward_decision',
      reason: 'device-exact-seed:calendar_witnesses',
      markedDays: md, profile: d.profile, preserveExactAcceptedWorkouts: true, validateWeekStarts: vws } as never); });
  }

  // WITNESS SELF-CHECK — fail loudly if a fidelity dimension was dropped.
  const accepted = useProgramStore.getState().acceptedMaterialContext;
  if (withFixtures) {
    for (const w of calendarWitnesses) {
      if (accepted.markedDays[w.date] !== w.mark) {
        throw new Error(`device-exact seed fidelity check failed: witnessed ${w.mark} on ${w.date} ` +
          `was not installed into accepted markedDays (got ${accepted.markedDays[w.date] ?? 'none'}). ` +
          'A fidelity dimension was silently dropped.');
      }
    }
  }
  if (!accepted.acceptedCompositionBase && !useProgramStore.getState().currentProgram) {
    throw new Error('device-exact seed fidelity check failed: no composition base / program installed.');
  }

  return { anchor: d.anchorDate, gameDate };
}
