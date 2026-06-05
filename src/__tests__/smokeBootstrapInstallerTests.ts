/**
 * smokeBootstrapInstaller unit tests.
 *
 * These tests prove the deep-link receiver race fix: the Linking
 * listener stays out of the normal runtime unless an explicit smoke flag is
 * active. When active, it must attach SYNCHRONOUSLY (before any await);
 * smoke URLs are logged + bootstrapped, non-smoke URLs are ignored silently,
 * and multi-channel delivery is idempotent.
 *
 * Run: npm run test:smoke-bootstrap-installer
 */

// IMPORTANT: stub react-native's Linking BEFORE importing the
// installer, since the installer subscribes at module-load time via
// the installSmokeBootstrapListener() function call (not at import).

type UrlListener = (event: { url: string }) => void;

interface LinkingShim {
  initialUrl: string | null;
  listeners: UrlListener[];
  addCalls: number;
  getInitialURL: () => Promise<string | null>;
  addEventListener: (
    type: 'url',
    cb: UrlListener,
  ) => { remove: () => void };
  emit: (url: string) => void;
}

function makeLinkingShim(initialUrl: string | null = null): LinkingShim {
  const shim: LinkingShim = {
    initialUrl,
    listeners: [],
    addCalls: 0,
    getInitialURL: async () => shim.initialUrl,
    addEventListener: (_type, cb) => {
      shim.addCalls += 1;
      shim.listeners.push(cb);
      return {
        remove: () => {
          const i = shim.listeners.indexOf(cb);
          if (i >= 0) shim.listeners.splice(i, 1);
        },
      };
    },
    emit: (url) => {
      for (const cb of shim.listeners.slice()) cb({ url });
    },
  };
  return shim;
}

const linkingShim = makeLinkingShim();

require.cache[require.resolve('react-native')] = {
  id: 'react-native',
  filename: 'react-native',
  loaded: true,
  exports: { Linking: linkingShim },
} as any;

// Shim AsyncStorage too — Zustand persist middleware will call setItem/getItem
// from the moment any store is touched. The real module reaches for
// window.localStorage and explodes in Node. We give it a tiny in-memory map so
// stores can hydrate + write without crashing.
const memoryStore = new Map<string, string>();
const asyncStorageShim = {
  getItem: async (key: string) => memoryStore.get(key) ?? null,
  setItem: async (key: string, value: string) => {
    memoryStore.set(key, value);
  },
  removeItem: async (key: string) => {
    memoryStore.delete(key);
  },
  clear: async () => {
    memoryStore.clear();
  },
  getAllKeys: async () => Array.from(memoryStore.keys()),
  multiGet: async (keys: string[]) =>
    keys.map((k) => [k, memoryStore.get(k) ?? null] as [string, string | null]),
  multiSet: async (pairs: [string, string][]) => {
    for (const [k, v] of pairs) memoryStore.set(k, v);
  },
  multiRemove: async (keys: string[]) => {
    for (const k of keys) memoryStore.delete(k);
  },
};
const asyncStoragePath = require.resolve(
  '@react-native-async-storage/async-storage',
);
require.cache[asyncStoragePath] = {
  id: asyncStoragePath,
  filename: asyncStoragePath,
  loaded: true,
  exports: { __esModule: true, default: asyncStorageShim, ...asyncStorageShim },
} as any;

import { __resetSmokeBootstrapForTest } from '../utils/smokeBootstrap';
import {
  __isSmokeBootstrapInstalledForTest,
  __resetSmokeBootstrapInstallerForTest,
  handleIncomingSmokeUrl,
  installSmokeBootstrapListener,
} from '../utils/smokeBootstrapInstaller';
import { useProfileStore } from '../store/profileStore';
import { useProgramStore } from '../store/programStore';
import { useCalendarStore } from '../store/calendarStore';

let pass = 0;
let fail = 0;
const failures: string[] = [];
const originalSmokeBootstrapEnv = process.env.EXPO_PUBLIC_SMOKE_BOOTSTRAP;

function ok(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    failures.push(name + (detail ? `\n      ${detail}` : ''));
    console.log(`  ✗ ${name}${detail ? '\n      ' + detail : ''}`);
  }
}

function section(label: string) {
  console.log(`\n${label}`);
}

function resetAll() {
  delete process.env.EXPO_PUBLIC_SMOKE_BOOTSTRAP;
  __resetSmokeBootstrapInstallerForTest();
  __resetSmokeBootstrapForTest();
  linkingShim.listeners = [];
  linkingShim.addCalls = 0;
  linkingShim.initialUrl = null;
  try {
    useProfileStore.getState().clear();
  } catch {}
  try {
    useCalendarStore.getState().clearAllGames();
  } catch {}
}

function enableSmokeRuntimeFlag() {
  process.env.EXPO_PUBLIC_SMOKE_BOOTSTRAP = 'coach-bike-flow';
}

function restoreSmokeBootstrapEnv() {
  if (originalSmokeBootstrapEnv === undefined) {
    delete process.env.EXPO_PUBLIC_SMOKE_BOOTSTRAP;
  } else {
    process.env.EXPO_PUBLIC_SMOKE_BOOTSTRAP = originalSmokeBootstrapEnv;
  }
}

// ────────────────────────────────────────────────────────────────────
// [1] Runtime gate + race fix — listener must attach synchronously when active
// ────────────────────────────────────────────────────────────────────
section('[1] Installer is gated, then attaches BEFORE returning when active');
{
  resetAll();
  ok(
    'precondition: installer not yet installed',
    !__isSmokeBootstrapInstalledForTest(),
  );
  ok('precondition: 0 listeners', linkingShim.listeners.length === 0);
  installSmokeBootstrapListener();
  ok(
    'normal runtime: listener is not attached',
    linkingShim.listeners.length === 0,
    `listeners=${linkingShim.listeners.length} addCalls=${linkingShim.addCalls}`,
  );
  ok(
    'normal runtime: installer does not mark itself installed',
    !__isSmokeBootstrapInstalledForTest(),
  );

  resetAll();
  enableSmokeRuntimeFlag();
  const teardown = installSmokeBootstrapListener();
  ok(
    'smoke runtime: listener attached synchronously',
    linkingShim.listeners.length === 1,
    `listeners=${linkingShim.listeners.length} addCalls=${linkingShim.addCalls}`,
  );
  ok(
    'smoke runtime: installer marks itself installed',
    __isSmokeBootstrapInstalledForTest(),
  );
  teardown();
}

// ────────────────────────────────────────────────────────────────────
// [2] Idempotency — double install does not double-subscribe
// ────────────────────────────────────────────────────────────────────
section('[2] installSmokeBootstrapListener is idempotent');
{
  resetAll();
  enableSmokeRuntimeFlag();
  installSmokeBootstrapListener();
  installSmokeBootstrapListener();
  installSmokeBootstrapListener();
  ok(
    'still only one Linking subscription after 3 install calls',
    linkingShim.addCalls === 1,
    `addCalls=${linkingShim.addCalls}`,
  );
}

// ────────────────────────────────────────────────────────────────────
// [3] Warm URL delivered after install → bootstrap fires
// ────────────────────────────────────────────────────────────────────
async function main() {
  section('[3] Warm URL (Maestro openLink path) triggers bootstrap');
  {
    resetAll();
    enableSmokeRuntimeFlag();
    installSmokeBootstrapListener();
    // Maestro fires openLink → react-native dispatches "url" event.
    linkingShim.emit('localfootyathlete://smoke/coach-bike-flow');
    // Give the async bootstrap a tick.
    await new Promise((r) => setTimeout(r, 30));
    ok(
      'profile onboarding complete after warm URL',
      useProfileStore.getState().isOnboardingComplete === true,
    );
    ok(
      'profile seeded with Sam',
      useProfileStore.getState().onboardingData?.firstName === 'Sam',
    );
    ok(
      'program installed',
      !!useProgramStore.getState().currentProgram?.microcycles?.length,
    );
  }

  // ──────────────────────────────────────────────────────────────────
  // [4] Cold-start URL (getInitialURL path) triggers bootstrap
  // ──────────────────────────────────────────────────────────────────
  section('[4] Cold-start URL via getInitialURL triggers bootstrap');
  {
    resetAll();
    enableSmokeRuntimeFlag();
    linkingShim.initialUrl = 'localfootyathlete://smoke/coach-bike-flow';
    installSmokeBootstrapListener();
    // getInitialURL is awaited inside the installer; tick a few times.
    await new Promise((r) => setTimeout(r, 50));
    ok(
      'cold-start URL triggers bootstrap',
      useProfileStore.getState().isOnboardingComplete === true,
    );
  }

  // ──────────────────────────────────────────────────────────────────
  // [5] Non-smoke URLs are ignored silently
  // ──────────────────────────────────────────────────────────────────
  section('[5] Non-smoke URLs are ignored silently');
  {
    resetAll();
    const logs: string[] = [];
    const origConsoleLog = console.log;
    // Intercept logger output (logger.info routes through console.log
    // in the project's logger.ts shim).
    console.log = (...args: any[]) => {
      logs.push(args.map((a) => String(a)).join(' '));
    };
    let rawLog: string | undefined;
    let ignoredLog: string | undefined;
    let seededProfile = false;
    try {
      // Non-smoke URL — should still log raw URL, but not fire bootstrap.
      await handleIncomingSmokeUrl(
        'com.localfootyathlete.app://expo-development-client/?url=http://x',
        'event',
      );
      rawLog = logs.find((l) =>
        /\[smoke-bootstrap\] url received raw=com\.localfootyathlete\.app:/.test(
          l,
        ),
      );
      ignoredLog = logs.find((l) =>
        /\[smoke-bootstrap\] ignored: not a recognised smoke URL/.test(l),
      );
      seededProfile =
        useProfileStore.getState().isOnboardingComplete === true;
    } finally {
      console.log = origConsoleLog;
    }
    // Restore console.log FIRST, then assert — otherwise the ok() output
    // gets captured into `logs` and nothing prints to stdout.
    ok('raw URL log does not fire for non-smoke URLs', !rawLog);
    ok('ignored log does not fire for non-smoke URLs', !ignoredLog);
    ok('non-smoke URL did NOT seed profile', !seededProfile);
  }

  // ──────────────────────────────────────────────────────────────────
  // [6] Multi-channel delivery is idempotent (no double-seed)
  // ──────────────────────────────────────────────────────────────────
  section('[6] Multi-channel delivery is idempotent');
  {
    resetAll();
    enableSmokeRuntimeFlag();
    let updateCalls = 0;
    // Patch profile store with a counter — we want to prove that even
    // if the URL arrives via BOTH getInitialURL and event, the second
    // bootstrap short-circuits via lastBootstrapForFlow.
    const orig = useProfileStore.getState().updateOnboardingData;
    useProfileStore.setState({
      updateOnboardingData: (data) => {
        updateCalls++;
        orig(data);
      },
    } as any);

    linkingShim.initialUrl = 'localfootyathlete://smoke/coach-bike-flow';
    installSmokeBootstrapListener();
    linkingShim.emit('localfootyathlete://smoke/coach-bike-flow');
    await new Promise((r) => setTimeout(r, 80));
    ok(
      'updateOnboardingData invoked exactly once despite 2 channels',
      updateCalls === 1,
      `updateCalls=${updateCalls}`,
    );

    // Restore
    useProfileStore.setState({ updateOnboardingData: orig } as any);
  }

  // ──────────────────────────────────────────────────────────────────
  // [7] Null / undefined / unknown URLs return null without crashing
  // ──────────────────────────────────────────────────────────────────
  section('[7] handleIncomingSmokeUrl tolerates null + unknown URLs');
  {
    resetAll();
    const a = await handleIncomingSmokeUrl(null, 'event');
    const b = await handleIncomingSmokeUrl(undefined, 'getInitialURL');
    const c = await handleIncomingSmokeUrl('', 'getInitialURL.poll');
    const d = await handleIncomingSmokeUrl('https://example.com', 'event');
    const e = await handleIncomingSmokeUrl(
      'localfootyathlete://smoke/not-a-real-flow',
      'event',
    );
    ok('null URL → null', a === null);
    ok('undefined URL → null', b === null);
    ok('empty URL → null', c === null);
    ok('non-smoke URL → null', d === null);
    ok('unknown smoke flow → null', e === null);
    ok(
      'no profile mutation from any of these',
      useProfileStore.getState().isOnboardingComplete !== true,
    );
  }

  console.log(`\n— Summary —`);
  console.log(`  Pass: ${pass}`);
  console.log(`  Fail: ${fail}`);
  if (fail > 0) {
    console.log(`\n— Failures —`);
    for (const f of failures) console.log(`  • ${f}`);
    restoreSmokeBootstrapEnv();
    process.exit(1);
  }
  restoreSmokeBootstrapEnv();
  process.exit(0);
}

main().catch((err) => {
  restoreSmokeBootstrapEnv();
  console.error(err);
  process.exit(1);
});
