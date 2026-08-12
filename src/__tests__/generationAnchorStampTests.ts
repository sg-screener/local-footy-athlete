/**
 * EVERY GENERATION PATH STAMPS THE ANCHOR — the coordinate the onboarding
 * athlete actually walks.
 *
 * Sam's ruling, 2026-08-06: the generation anchor is a DECISION with ONE home,
 * written at generation onto the program it anchors, and boot READS it and
 * never guesses today (`quiescentBoot.MissingGenerationAnchorError`).
 *
 * WHAT WENT WRONG, and it is the SAME ownership shape as the install-door
 * defect `wornWorldBootTests` was written for — one layer earlier.
 *
 * R1.3 (`03318c05`, 2026-08-05) introduced the anchor and stamped it on ONE of
 * the two program producers in `generateProgram.ts`:
 *
 *   - `generateProgramLocally`  (boot, rebuild, every edit door) — STAMPED.
 *   - `generateProgramFromProfile` (the network path the ONBOARDING SCREEN
 *     calls, `CompleteScreen.tsx:302`) — its program literal had no
 *     `generationAnchorISO` key at all.
 *
 * So a freshly onboarded athlete's program carried no anchor, the store mirror
 * persisted `null`, and the NEXT LAUNCH refused to boot: "The app did not
 * start", `dev_e2e_app_hydration_failed:derived-world`. Measured on the
 * simulator 2026-08-12: onboard -> generate -> quit -> relaunch = bricked, and
 * planting an anchor into the same saved bytes booted it perfectly.
 *
 * WHY THE EXISTING SUITES MISSED IT. `wornWorldBootTests` and
 * `quiescentBootTests` both build their world with `generateProgramLocally` —
 * the producer that stamps — so the anchor was present for free and the
 * onboarding producer's silence was invisible. Same lesson as the worn-world
 * suite's own docstring: a gate passing on coordinates it never builds.
 *
 * WHY THIS ASSERTS THE CLASS AND NOT THE LINE. A cell that only checked
 * `generateProgramFromProfile` would be satisfied by the one-line fix and
 * silent about a THIRD producer added later. Both public entry points are
 * driven here, so "a generation path forgot the anchor" cannot come back
 * through a new door.
 *
 * Run: npm run test:generation-anchor-stamp
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

const localStorageData = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => localStorageData.get(key) ?? null,
    setItem: (key: string, value: string) => { localStorageData.set(key, value); },
    removeItem: (key: string) => { localStorageData.delete(key); },
    clear: () => { localStorageData.clear(); },
  },
};

import type { TrainingProgram } from '../types/domain';
import {
  generateProgramFromProfile,
  generateProgramLocally,
} from '../services/api/generateProgram';
import { DEV_TEST_ONBOARDING_DATA } from '../utils/devOnboardingSkip';

const GENERATION_DAY = '2026-07-13';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

function quiet<T>(body: () => T): T {
  const log = console.log; const warn = console.warn; const error = console.error;
  const debug = console.debug; const info = console.info;
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  console.debug = () => {}; console.info = () => {};
  try { return body(); } finally {
    console.log = log; console.warn = warn; console.error = error;
    console.debug = debug; console.info = info;
  }
}

async function quietAsync<T>(body: () => Promise<T>): Promise<T> {
  const log = console.log; const warn = console.warn; const error = console.error;
  const debug = console.debug; const info = console.info;
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  console.debug = () => {}; console.info = () => {};
  try { return await body(); } finally {
    console.log = log; console.warn = warn; console.error = error;
    console.debug = debug; console.info = info;
  }
}

async function run(name: string, body: () => void | Promise<void>): Promise<void> {
  try {
    await body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failed += 1;
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`${name}: ${message}`);
    console.log(`  FAIL ${name}`);
    console.log(`      ${message}`);
  }
}

function fakeCoachResponse(): Response {
  return new Response(JSON.stringify({
    _v: 'anchor-stamp-test',
    reply: 'Generated test program',
    programUpdate: {
      workouts: [
        {
          dayOfWeek: 1,
          name: 'Lower Strength',
          workoutType: 'core',
          sessionTier: 'core',
          exercises: [{ name: 'Back Squat', sets: 4, repsMin: 4, repsMax: 6 }],
        },
        {
          dayOfWeek: 2,
          name: 'Team Training',
          workoutType: 'team',
          sessionTier: 'core',
          exercises: [],
        },
        {
          dayOfWeek: 3,
          name: 'Recovery',
          workoutType: 'recovery',
          sessionTier: 'recovery',
          exercises: [],
        },
        {
          dayOfWeek: 4,
          name: 'Team Training',
          workoutType: 'team',
          sessionTier: 'core',
          exercises: [],
        },
        {
          dayOfWeek: 5,
          name: 'Optional Upper',
          workoutType: 'optional',
          sessionTier: 'optional',
          exercises: [{ name: 'DB Bench Press', sets: 3, repsMin: 6, repsMax: 8 }],
        },
      ],
    },
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function anchorOf(program: TrainingProgram): string | undefined {
  return (program as { generationAnchorISO?: string }).generationAnchorISO;
}

async function main(): Promise<void> {
  // THE ONBOARDING PRODUCER. This is the one that was silent, and the one an
  // athlete's very first program comes from.
  await run(
    'generateProgramFromProfile stamps the generation anchor (the onboarding path)',
    async () => {
      const originalFetch = global.fetch;
      (global as unknown as { fetch: typeof fetch }).fetch = async () => fakeCoachResponse();
      try {
        const program = await quietAsync(() => generateProgramFromProfile(
          DEV_TEST_ONBOARDING_DATA,
          { weekAcceptance: 'restoration', todayISO: GENERATION_DAY },
        ));
        assert(
          anchorOf(program) === GENERATION_DAY,
          'the onboarding generation path returned a program with '
          + `generationAnchorISO=${String(anchorOf(program))}; boot cannot rebuild `
          + 'a world that cannot say WHEN it was generated, so the next launch '
          + 'refuses with MissingGenerationAnchorError',
        );
      } finally {
        (global as unknown as { fetch: typeof fetch }).fetch = originalFetch;
      }
    },
  );

  // THE PRODUCER THAT ALREADY STAMPED. Kept so the pair is asserted as ONE
  // property rather than two unrelated cells — this is the non-vacuity side.
  await run(
    'generateProgramLocally stamps the generation anchor (boot and every edit door)',
    () => {
      const program = quiet(() => generateProgramLocally(DEV_TEST_ONBOARDING_DATA, {
        weekAcceptance: 'restoration',
        todayISO: GENERATION_DAY,
        previousProgram: null,
      })) as TrainingProgram;
      assert(
        anchorOf(program) === GENERATION_DAY,
        `the local generation path returned generationAnchorISO=${String(anchorOf(program))}`,
      );
    },
  );

  console.log(`\nGeneration anchor stamp totals: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exitCode = 1;
  }
}

void main();
