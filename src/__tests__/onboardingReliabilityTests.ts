/**
 * Onboarding reliability — durable step commits, hydration gating,
 * interrupted-flow recovery, and honest refusal on missing answers.
 *
 * Diagnosis: docs/ONBOARDING_PERSISTENCE_DIAGNOSIS_2026-07-24.md
 *
 * The confirmed mechanism is a *relaunch* that lands between an in-memory
 * `updateOnboardingData()` and its fire-and-forget AsyncStorage write. These
 * tests reproduce that headlessly by stubbing the AsyncStorage module with a
 * backend whose writes only reach "disk" when the test releases them, so a
 * simulated process kill can discard genuinely in-flight writes.
 *
 * Run: npm run test:onboarding-reliability
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import fs from 'fs';
import path from 'path';

/* ── Controllable AsyncStorage backend (installed before any store import) ── */

const disk = new Map<string, string>();

interface QueuedWrite {
  /** Mutates the simulated disk. Never called for a write lost to a kill. */
  readonly apply: () => void;
  readonly settle: () => void;
}

let queuedWrites: QueuedWrite[] = [];

/** Keys whose writes reject, so failure injection cannot disturb other stores. */
const failingWriteKeys = new Set<string>();

/**
 * When held, writes stay in flight until the test releases (or discards) them —
 * that window is the whole point of these tests. Off by default so setup and
 * teardown settle without hand-pumping every cross-store persist cascade.
 */
let holdWrites = false;

function queueWrite(apply: () => void): Promise<void> {
  if (!holdWrites) {
    apply();
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    queuedWrites.push({ apply, settle: resolve });
  });
}

const controllableAsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    return disk.get(key) ?? null;
  },
  setItem(key: string, value: string): Promise<void> {
    if (failingWriteKeys.has(key)) return Promise.reject(new Error('disk_full'));
    return queueWrite(() => { disk.set(key, value); });
  },
  removeItem(key: string): Promise<void> {
    return queueWrite(() => { disk.delete(key); });
  },
};

const asyncStorageModulePath = require.resolve(
  '@react-native-async-storage/async-storage',
);
require.cache[asyncStorageModulePath] = {
  id: asyncStorageModulePath,
  filename: asyncStorageModulePath,
  loaded: true,
  exports: { __esModule: true, default: controllableAsyncStorage },
} as unknown as NodeJS.Module;

/** Let every queued write reach disk (the device finishing its writes). */
async function releaseWrites(): Promise<void> {
  while (queuedWrites.length > 0) {
    const batch = queuedWrites;
    queuedWrites = [];
    batch.forEach((write) => {
      write.apply();
      write.settle();
    });
    await Promise.resolve();
  }
}

/**
 * Run `body` while continuously releasing writes, so a commit that waits on a
 * cross-store persist cascade still completes. Used where the test cares that
 * the commit *waited*, not about the exact moment each write lands.
 */
async function whileReleasingWrites<T>(body: () => Promise<T>): Promise<T> {
  let finished = false;
  const pump = (async () => {
    while (!finished) {
      await releaseWrites();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  })();
  try {
    return await body();
  } finally {
    finished = true;
    await pump;
  }
}

/**
 * Discard in-flight writes without committing them — iOS killing the process
 * mid-write. The data never reaches disk, which is the loss under test. The
 * promises are settled rather than abandoned only so the *next* test's registry
 * starts clean; in a real kill nobody is left to observe them either way.
 */
function killProcessDiscardingInflightWrites(): number {
  const discarded = queuedWrites.length;
  const abandoned = queuedWrites;
  queuedWrites = [];
  abandoned.forEach((write) => write.settle());
  return discarded;
}

/* ── Imports (after the storage stub is installed) ── */

import type { OnboardingData } from '../types/domain';
import { useProfileStore } from '../store/profileStore';
import { useProgramStore } from '../store/programStore';
import {
  flushPendingStorageWrites,
  pendingStorageWriteCount,
  asyncStorageCompat,
} from '../store/asyncStorageCompat';
import {
  commitOnboardingStep,
  OnboardingStepCommitError,
} from '../utils/onboardingStepCommit';
import {
  ONBOARDING_STEPS,
  visibleOnboardingSteps,
  resolveOnboardingResumeStep,
} from '../utils/onboardingSteps';
import {
  assessOnboardingCompleteness,
  onboardingIncompleteMessage,
} from '../utils/onboardingCompleteness';
import {
  PERSISTED_STORE_HYDRATION_REGISTRY,
  getAppHydrationState,
  awaitAppHydration,
} from '../store/appHydrationGate';
import { generationSeasonPhaseOrThrow } from '../services/api/generateProgram';

/* ── Harness ── */

let passed = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

async function run(name: string, body: () => void | Promise<void>): Promise<void> {
  try {
    await body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`  FAIL ${name}`, error);
  }
}

const src = path.resolve(__dirname, '..');
const read = (relative: string) => fs.readFileSync(path.join(src, relative), 'utf8');

const INITIAL_ONBOARDING_DATA: OnboardingData = {
  trainingLocation: 'Commercial gym',
  equipment: ['barbell', 'dumbbells'],
} as OnboardingData;

/** Reset live memory to a cold-start store without touching disk. */
function simulateProcessRelaunch(): void {
  useProfileStore.setState({
    onboardingData: { ...INITIAL_ONBOARDING_DATA },
    isOnboardingComplete: false,
  });
}

/**
 * Cold disk + cold memory, with the store's own reset write already drained so
 * per-test pending-write counts observe only what the test starts.
 */
async function resetDisk(): Promise<void> {
  holdWrites = false;
  // Settle anything the previous test left held, or the flush below would wait
  // on a promise nobody will ever release.
  killProcessDiscardingInflightWrites();
  simulateProcessRelaunch();
  // Cross-store persist cascades queue further writes on later turns.
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await flushPendingStorageWrites().catch(() => undefined);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    if (pendingStorageWriteCount() === 0) break;
  }
  disk.clear();
  holdWrites = true;
}

const COMPLETE_IN_SEASON_PROFILE: OnboardingData = {
  firstName: 'Sam',
  heightCm: 183,
  weightKg: 84,
  position: 'Midfielder',
  motivation: 'Run out games',
  seasonPhase: 'In-season',
  gameDay: 'Saturday',
  teamTrainingDaysPerWeek: 2,
  teamTrainingDays: ['Tuesday', 'Thursday'],
  teamTrainingDuration: 90,
  teamTrainingIntensity: 'Moderate',
  trainingDaysPerWeek: 3,
  preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
  experienceLevel: 'Intermediate',
  squatStrength: 'Bodyweight x1',
  benchStrength: 'Bodyweight x1',
  conditioningLevel: 'Average',
  sprintExposure: 'Sometimes',
  recentTrainingLoad: 'Pretty consistent',
  injuries: [],
  trainingLocation: 'Commercial gym',
  equipment: ['barbell', 'dumbbells'],
} as unknown as OnboardingData;

async function main(): Promise<void> {
  // Let every store's module-load hydration settle before exercising the
  // storage backend, so background rehydration writes cannot bleed into the
  // per-test pending-write assertions.
  await awaitAppHydration();

  console.log('\n[0] The athlete journey — fresh install, every answer survives');

  await run('0 a fresh-install onboarding walk keeps every answer after hydration completes', async () => {
    // The load-bearing test for this unit. Nothing is killed, nothing races:
    // storage is empty, hydration has fully completed (including programStore's
    // accepted-state acceptance), and the athlete simply answers the questions.
    //
    // Before the mirror ownership fix this failed on the very first answer:
    // hydration minted an acceptedProfileSnapshot from the empty profile, and
    // profileStore's subscribe fence reverted every subsequent answer in memory.
    // See docs/PROFILE_MIRROR_OWNERSHIP_REASSESSMENT_2026-07-24.md.
    await resetDisk();
    holdWrites = false;

    const journey: Array<[string, Partial<OnboardingData>]> = [
      ['Name', { firstName: 'Sam' }],
      ['BodyMeasurements', { heightCm: 183, weightKg: 84 }],
      ['Position', { position: 'Midfielder' } as Partial<OnboardingData>],
      ['Motivation', { motivation: 'Run out games' }],
      ['SeasonPhase', { seasonPhase: 'In-season' } as Partial<OnboardingData>],
      ['GameDay', { gameDay: 'Saturday' } as Partial<OnboardingData>],
      ['TeamTrainingDays', {
        teamTrainingDaysPerWeek: 2,
        teamTrainingDays: ['Tuesday', 'Thursday'],
      } as Partial<OnboardingData>],
      ['TeamTrainingDuration', {
        teamTrainingDuration: 90,
        teamTrainingIntensity: 'Moderate',
      } as Partial<OnboardingData>],
      ['TrainingCommitment', { trainingDaysPerWeek: 3 }],
      ['PreferredTrainingDays', {
        preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
      } as Partial<OnboardingData>],
      ['GymExperience', { experienceLevel: 'Intermediate' } as Partial<OnboardingData>],
      ['SquatStrength', { squatStrength: 'Bodyweight x1' } as Partial<OnboardingData>],
      ['BenchStrength', { benchStrength: 'Bodyweight x1' } as Partial<OnboardingData>],
      ['ConditioningLevel', { conditioningLevel: 'Average' } as Partial<OnboardingData>],
      ['SprintExposure', { sprintExposure: 'Sometimes' } as Partial<OnboardingData>],
      ['RecentTrainingLoad', { recentTrainingLoad: 'Pretty consistent' } as Partial<OnboardingData>],
      ['Injuries', { injuries: [] }],
    ];

    for (const [step, patch] of journey) {
      await commitOnboardingStep(patch);
      const live = useProfileStore.getState().onboardingData as Record<string, unknown>;
      for (const [field, expected] of Object.entries(patch)) {
        if (field === 'position') {
          // `normalizeOnboardingRole` buckets the raw pick — the answer is kept,
          // in its canonical form, which is the property that matters here.
          assert(typeof live.position === 'string' && live.position.length > 0,
            `${step}: position did not survive its own commit — got ${JSON.stringify(live.position)}`);
          continue;
        }
        assert(
          JSON.stringify(live[field]) === JSON.stringify(expected),
          `${step}: ${field} did not survive its own commit — got ${JSON.stringify(live[field])}`,
        );
      }
    }

    // Everything answered earlier is still there at the end of the walk.
    const final = useProfileStore.getState().onboardingData;
    assert(final.firstName === 'Sam', `firstName lost by the end of the walk: ${JSON.stringify(final)}`);
    assert(final.seasonPhase === 'In-season', `seasonPhase lost: ${String(final.seasonPhase)}`);
    assert(final.trainingDaysPerWeek === 3, `trainingDaysPerWeek lost: ${String(final.trainingDaysPerWeek)}`);

    // Review would find nothing missing, and generation keeps the athlete's phase.
    const assessment = assessOnboardingCompleteness(final);
    assert(assessment.complete,
      `Review would refuse a fully answered profile, missing: ${
        assessment.missingSteps.map((s) => s.name).join(', ')}`);
    assert(generationSeasonPhaseOrThrow(final) === 'In-season',
      'generation did not receive the athlete-selected phase');

    // And it is durably on disk, not just in memory.
    const envelope = JSON.parse(disk.get('profile-store') ?? '{}');
    assert(envelope?.state?.onboardingData?.seasonPhase === 'In-season',
      `the completed profile is not durably persisted: ${disk.get('profile-store') ?? 'nothing'}`);
  });

  await run('0b a fresh install records no acceptance nobody made', async () => {
    // Step B of the mirror reassessment. Hydration used to commit an
    // accepted-state transaction on every cold start, so a device with nothing
    // on disk came up at revision 1 holding an `acceptedProfileSnapshot` of the
    // empty profile. An acceptance record for a program no one accepted is a
    // false record — the same class as a false "Done" — and it is what armed
    // the profile mirror against onboarding in the first place.
    const accepted = useProgramStore.getState().acceptedMaterialContext;
    assert(accepted.revision === 0,
      `fresh install came up at acceptance revision ${accepted.revision}`);
    assert(accepted.acceptedProfileSnapshot === null,
      'fresh install manufactured an accepted profile snapshot');
    assert(!useProgramStore.getState().currentProgram,
      'fresh install manufactured a program');
  });

  console.log('\n[A] Durable-write flush owner');

  await run('A1 flushPendingStorageWrites resolves only after the write reaches disk', async () => {
    await resetDisk();
    let flushed = false;
    void asyncStorageCompat.setItem('a1-key', 'a1-value');
    assert(pendingStorageWriteCount() === 1, 'write was not registered as pending');
    const flush = flushPendingStorageWrites().then(() => { flushed = true; });
    await Promise.resolve();
    assert(!flushed, 'flush resolved before the write reached disk');
    assert(disk.get('a1-key') === undefined, 'test backend committed early');
    await releaseWrites();
    await flush;
    assert(flushed, 'flush never resolved after the write landed');
    assert(disk.get('a1-key') === 'a1-value', 'value did not reach disk');
    assert(pendingStorageWriteCount() === 0, 'pending registry did not drain');
  });

  await run('A2 a rejected write surfaces through the flush instead of being swallowed', async () => {
    await resetDisk();
    failingWriteKeys.add('a2-key');
    try {
      void asyncStorageCompat.setItem('a2-key', 'a2-value').catch(() => undefined);
      let surfaced: unknown = null;
      await flushPendingStorageWrites().catch((error) => { surfaced = error; });
      assert(surfaced instanceof Error, 'flush hid a failed durable write');
      assert(/disk_full/.test(String((surfaced as Error).message)),
        `flush lost the underlying cause: ${String(surfaced)}`);
    } finally {
      failingWriteKeys.delete('a2-key');
    }
  });

  await run('A3 writes started during a flush are awaited too', async () => {
    await resetDisk();
    void asyncStorageCompat.setItem('a3-first', '1');
    const flush = flushPendingStorageWrites();
    void asyncStorageCompat.setItem('a3-second', '2');
    await releaseWrites();
    await flush;
    assert(disk.get('a3-first') === '1' && disk.get('a3-second') === '2',
      'flush drained only the first generation of writes');
  });

  console.log('\n[B] commitOnboardingStep — the onboarding write owner');

  await run('B1 commit updates live state and durably persists before resolving', async () => {
    await resetDisk();
    const commit = commitOnboardingStep({ firstName: 'Sam' });
    assert(useProfileStore.getState().onboardingData.firstName === 'Sam',
      'commit did not update live state synchronously');
    let resolved = false;
    void commit.then(() => { resolved = true; });
    await Promise.resolve();
    assert(!resolved, 'commit resolved before the profile write reached disk');
    await releaseWrites();
    await commit;
    const envelope = JSON.parse(disk.get('profile-store') ?? '{}');
    assert(envelope?.state?.onboardingData?.firstName === 'Sam',
      `commit resolved without the answer on disk: ${disk.get('profile-store') ?? 'nothing'}`);
  });

  await run('B2 commit rejects — and never reports success — when the write fails', async () => {
    await resetDisk();
    failingWriteKeys.add('profile-store');
    try {
      let thrown: unknown = null;
      await commitOnboardingStep({ firstName: 'Blocked' }).catch((error) => { thrown = error; });
      assert(thrown instanceof OnboardingStepCommitError,
        `commit resolved successfully on a failed write: ${String(thrown)}`);
    } finally {
      failingWriteKeys.delete('profile-store');
    }
  });

  console.log('\n[C] Interrupted onboarding — relaunch with unflushed writes');

  await run('C1 repro: the legacy fire-and-forget commit loses answers on relaunch', async () => {
    await resetDisk();
    // Legacy shape: update memory, navigate immediately, process dies.
    useProfileStore.getState().updateOnboardingData({ firstName: 'Sam', heightCm: 183 });
    const discarded = killProcessDiscardingInflightWrites();
    assert(discarded > 0, 'the legacy path did not even have an in-flight write to lose');
    simulateProcessRelaunch();
    await useProfileStore.persist.rehydrate();
    const recovered = useProfileStore.getState().onboardingData;
    assert(recovered.firstName === undefined && recovered.heightCm === undefined,
      'the reported mechanism no longer reproduces — re-diagnose before trusting the fix');
  });

  await run('C2 an awaited step commit survives the same relaunch', async () => {
    await resetDisk();
    await whileReleasingWrites(() =>
      commitOnboardingStep({ firstName: 'Sam', heightCm: 183 }));
    killProcessDiscardingInflightWrites();
    simulateProcessRelaunch();
    await useProfileStore.persist.rehydrate();
    const recovered = useProfileStore.getState().onboardingData;
    assert(recovered.firstName === 'Sam' && recovered.heightCm === 183,
      `relaunch lost awaited answers: ${JSON.stringify(recovered)}`);
  });

  await run('C3 relaunch mid-flow resumes at the first unanswered step with answers intact', async () => {
    await resetDisk();
    await whileReleasingWrites(() => commitOnboardingStep({
      firstName: 'Sam',
      heightCm: 183,
      weightKg: 84,
      position: 'Midfielder',
    } as Partial<OnboardingData>));
    killProcessDiscardingInflightWrites();
    simulateProcessRelaunch();
    await useProfileStore.persist.rehydrate();
    const recovered = useProfileStore.getState().onboardingData;
    // `position` is stored in its normalised bucket form, not the raw pick.
    assert(recovered.firstName === 'Sam' && Boolean(recovered.position),
      `relaunch lost saved answers: ${JSON.stringify(recovered)}`);
    assert(resolveOnboardingResumeStep(recovered) === 'Motivation',
      `resume landed on ${resolveOnboardingResumeStep(recovered)} instead of Motivation`);
  });

  await run('C4 every onboarding screen awaits its commit before navigating', () => {
    const screensDir = path.join(src, 'screens/onboarding');
    const offenders: string[] = [];
    for (const file of fs.readdirSync(screensDir).filter((f) => f.endsWith('.tsx'))) {
      const source = fs.readFileSync(path.join(screensDir, file), 'utf8');
      if (!/updateOnboardingData\(/.test(source) && !/commitOnboardingStep\(/.test(source)) continue;
      if (/updateOnboardingData\s*\(/.test(source)) offenders.push(`${file}: still calls updateOnboardingData`);
      if (/commitOnboardingStep\s*\(/.test(source) && !/await\s+commitOnboardingStep\s*\(/.test(source)) {
        offenders.push(`${file}: commitOnboardingStep is not awaited`);
      }
    }
    assert(offenders.length === 0, `unawaited onboarding commits:\n  ${offenders.join('\n  ')}`);
  });

  console.log('\n[D] App boot hydration gate');

  await run('D1 the gate registry covers every persisted store', () => {
    const storeDir = path.join(src, 'store');
    const persistedNames: string[] = [];
    for (const file of fs.readdirSync(storeDir).filter((f) => f.endsWith('.ts'))) {
      const source = fs.readFileSync(path.join(storeDir, file), 'utf8');
      // A persisted store is one that wraps its own creator in persist(...);
      // modules that merely read persist APIs (the gate itself) are not stores.
      if (!/\bcreate</.test(source) || !/\bpersist\(/.test(source)) continue;
      const name = source.match(/name:\s*'([a-z0-9-]+)'/)?.[1]
        ?? source.match(/PERSISTENCE_KEY\s*=\s*'([a-z0-9-]+)'/)?.[1];
      assert(name, `could not read the persist name for ${file}`);
      persistedNames.push(name);
    }
    assert(persistedNames.length >= 12,
      `expected at least 12 persisted stores, found ${persistedNames.length}`);
    const registered = new Set(PERSISTED_STORE_HYDRATION_REGISTRY.map((entry) => entry.key));
    const missing = persistedNames.filter((name) => !registered.has(name));
    assert(missing.length === 0, `stores absent from the boot hydration gate: ${missing.join(', ')}`);
  });

  await run('D2 the gate reports ready only once every store has hydrated', async () => {
    const state = await awaitAppHydration();
    assert(state.status === 'ready', `gate settled as ${state.status}: ${state.failedStores.join(', ')}`);
    assert(PERSISTED_STORE_HYDRATION_REGISTRY.every((entry) => entry.hasHydrated()),
      'gate reported ready with an unhydrated store');
    assert(getAppHydrationState().status === 'ready', 'gate state did not stick after settling');
  });

  await run('D3 app boot readiness is hydration-gated, not timer-gated', () => {
    const hook = read('hooks/useInitializeApp.ts');
    assert(!/setTimeout\s*\(/.test(hook), 'useInitializeApp still boots on a timer');
    assert(!/\b300\b/.test(hook), 'the 300ms boot grace period is still present');
    assert(/appHydrationGate|awaitAppHydration|subscribeToAppHydration/.test(hook),
      'useInitializeApp does not consult the hydration gate');
    const navigator = read('navigation/RootNavigator.tsx');
    assert(/hydrationStatus|hydration/i.test(navigator),
      'RootNavigator does not distinguish hydrating from failed boot');
  });

  console.log('\n[E] Onboarding step registry and resume');

  await run('E1 a cold store resumes at the first step', () => {
    assert(resolveOnboardingResumeStep(INITIAL_ONBOARDING_DATA) === 'Name',
      'an empty profile did not resume at Name');
  });

  await run('E2 a complete profile resumes at Review', () => {
    assert(resolveOnboardingResumeStep(COMPLETE_IN_SEASON_PROFILE) === 'Review',
      `complete profile resumed at ${resolveOnboardingResumeStep(COMPLETE_IN_SEASON_PROFILE)}`);
  });

  await run('E3 conditional steps are skipped when they are not visible', () => {
    const offSeason = {
      ...COMPLETE_IN_SEASON_PROFILE,
      seasonPhase: 'Off-season',
      gameDay: undefined,
      teamTrainingDaysPerWeek: undefined,
      teamTrainingDays: undefined,
      teamTrainingDuration: undefined,
      teamTrainingIntensity: undefined,
    } as unknown as OnboardingData;
    const names = visibleOnboardingSteps(offSeason).map((step) => step.name);
    assert(!names.includes('GameDay') && !names.includes('TeamTrainingDays'),
      `off-season flow still shows team/game steps: ${names.join(', ')}`);
    assert(resolveOnboardingResumeStep(offSeason) === 'Review',
      `off-season complete profile resumed at ${resolveOnboardingResumeStep(offSeason)}`);

    const beginner = {
      ...COMPLETE_IN_SEASON_PROFILE,
      experienceLevel: 'Complete beginner',
      squatStrength: undefined,
      benchStrength: undefined,
    } as unknown as OnboardingData;
    const beginnerNames = visibleOnboardingSteps(beginner).map((step) => step.name);
    assert(!beginnerNames.includes('SquatStrength') && !beginnerNames.includes('BenchStrength'),
      `beginner flow still shows strength steps: ${beginnerNames.join(', ')}`);
  });

  await run('E4 the registry is the single source of onboarding step order', () => {
    const progress = read('hooks/useOnboardingProgress.ts');
    assert(/onboardingSteps/.test(progress),
      'useOnboardingProgress still keeps its own copy of the step list');
    assert(!/ONBOARDING_SCREENS\s*:\s*ScreenEntry\[\]/.test(progress),
      'the duplicate ONBOARDING_SCREENS list still exists');
    const navigator = read('navigation/OnboardingNavigator.tsx');
    assert(/initialRouteName/.test(navigator),
      'OnboardingNavigator does not resume an interrupted flow');
    assert(/resolveOnboardingResumeStep/.test(navigator),
      'OnboardingNavigator does not derive its entry point from the resume owner');
    assert(ONBOARDING_STEPS.length > 0, 'the step registry is empty');
  });

  console.log('\n[F] Refusal on missing required answers');

  await run('F1 a missing answer is reported with the step that owns it', () => {
    const missingPhase = { ...COMPLETE_IN_SEASON_PROFILE, seasonPhase: undefined } as OnboardingData;
    const assessment = assessOnboardingCompleteness(missingPhase);
    assert(!assessment.complete, 'a profile missing seasonPhase was assessed as complete');
    assert(assessment.firstIncompleteStep === 'SeasonPhase',
      `missing seasonPhase pointed at ${assessment.firstIncompleteStep}`);
    assert(assessment.missingSteps.some((step) => step.name === 'SeasonPhase'),
      'the missing step was not listed');
    const message = onboardingIncompleteMessage(assessment);
    assert(/season/i.test(message) && message.trim().length > 0,
      `refusal copy does not name the missing answer: ${message}`);
  });

  await run('F2 a complete profile is assessed as complete', () => {
    const assessment = assessOnboardingCompleteness(COMPLETE_IN_SEASON_PROFILE);
    assert(assessment.complete,
      `complete profile rejected, missing: ${assessment.missingSteps.map((s) => s.name).join(', ')}`);
    assert(assessment.firstIncompleteStep === null, 'a complete profile named an incomplete step');
  });

  await run('F3 generation refuses a missing season phase instead of defaulting to Pre-season', () => {
    const generation = read('services/api/generateProgram.ts');
    assert(!/seasonPhase\s*\?\?\s*'Pre-season'/.test(generation),
      "the silent `seasonPhase ?? 'Pre-season'` fallback is still in generateProgram.ts");
    let thrown: unknown = null;
    try {
      generationSeasonPhaseOrThrow({ ...COMPLETE_IN_SEASON_PROFILE, seasonPhase: undefined } as OnboardingData);
    } catch (error) {
      thrown = error;
    }
    assert(thrown instanceof Error, 'generation accepted a profile with no season phase');
    assert(/season/i.test(String((thrown as Error).message)),
      `generation refusal does not name the missing field: ${String(thrown)}`);
    assert(generationSeasonPhaseOrThrow(COMPLETE_IN_SEASON_PROFILE) === 'In-season',
      'generation lost the athlete-selected phase');
  });

  await run('F4 Review and Complete refuse and redirect instead of generating a default program', () => {
    const review = read('screens/onboarding/ReviewScreen.tsx');
    assert(/assessOnboardingCompleteness/.test(review),
      'ReviewScreen generates without consulting the completeness owner');
    assert(/firstIncompleteStep/.test(review),
      'ReviewScreen does not redirect to the step that owns the missing answer');
    const complete = read('screens/onboarding/CompleteScreen.tsx');
    assert(/assessOnboardingCompleteness/.test(complete),
      'CompleteScreen generates without consulting the completeness owner');
    assert(!/generateProgramFromProfile\(onboardingData/.test(complete)
      || /assessOnboardingCompleteness[\s\S]*generateProgramFromProfile\(onboardingData/.test(complete),
      'CompleteScreen generates before assessing completeness');
  });

  await run('F5 required generation fields are derived from the step registry', () => {
    const generation = read('services/api/generateProgram.ts');
    assert(/onboardingSteps/.test(generation),
      'generateProgram keeps a second, independent list of required profile fields');
  });

  console.log(`\nOnboarding reliability totals: passed=${passed}/23 failures=${failures.length}`);
  if (failures.length > 0) {
    console.error(`Failing: ${failures.join(', ')}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
