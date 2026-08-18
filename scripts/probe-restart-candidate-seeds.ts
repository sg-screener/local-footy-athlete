/**
 * ONE SEED PER PROCESS, ON PURPOSE.
 *
 * `devE2EDefaultSeedInstallationTests` loops the candidates in one process and
 * THROWS on the first, so `coach-production-replay` had never been assessed
 * through any door — session 10 recorded it as "untested" for exactly that
 * reason. A shared process also shares singleton stores, so a throw leaves the
 * next seed reading a dirty world. Both hazards go away by taking the seed id
 * from argv and running the process once per candidate.
 *
 *   npx sucrase-node scripts/probe-restart-candidate-seeds.ts <seed-id>
 */
type AsyncStorageEntry = readonly [string, string];

async function main(): Promise<void> {
  const seedId = process.argv[2];
  if (!seedId) throw new Error('usage: probe-restart-candidate-seeds.ts <seed-id>');

  (globalThis as typeof globalThis & { __DEV__: boolean }).__DEV__ = true;

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const storageModule = require('@react-native-async-storage/async-storage') as {
    default: Record<string, unknown>;
  };
  const values = new Map<string, string>();
  Object.assign(storageModule.default, {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => { values.set(key, value); },
    removeItem: async (key: string) => { values.delete(key); },
    clear: async () => { values.clear(); },
    getAllKeys: async () => Array.from(values.keys()),
    multiGet: async (keys: readonly string[]) =>
      keys.map((key) => [key, values.get(key) ?? null] as const),
    multiSet: async (entries: readonly AsyncStorageEntry[]) => {
      for (const [key, value] of entries) values.set(key, value);
    },
    multiRemove: async (keys: readonly string[]) => {
      for (const key of keys) values.delete(key);
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createDefaultDevE2ESeedCoordinator } = require(
    '../src/dev/e2e/defaultDevE2ESeedCoordinator'
  ) as typeof import('../src/dev/e2e/defaultDevE2ESeedCoordinator');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useProgramStore } = require('../src/store/programStore') as
    typeof import('../src/store/programStore');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { todayISOLocal } = require('../src/utils/appDate') as
    typeof import('../src/utils/appDate');

  const coordinator = createDefaultDevE2ESeedCoordinator(true);

  let installed: boolean | null = null;
  let threw: string | null = null;
  try {
    installed = await coordinator.reset(seedId);
  } catch (error) {
    threw = error instanceof Error ? error.message : String(error);
  }

  console.log(`SEED           : ${seedId}`);
  console.log(`INSTALLED      : ${installed}`);
  console.log(`THREW          : ${threw ?? 'no'}`);
  if (installed !== true) { process.exitCode = 1; return; }

  const state = useProgramStore.getState();
  const program = state.currentProgram;
  const blocks = state.acceptedBlocks ?? {};
  const blockKeys = Object.keys(blocks).sort();

  console.log(`TODAY (clock)  : ${todayISOLocal()}`);
  console.log(`PROGRAM START  : ${program?.startDate?.slice(0, 10) ?? 'NONE'}`);
  console.log(`MICROCYCLES    : ${program?.microcycles.length ?? 0}`);
  console.log(`ACCEPTED BLOCKS: ${blockKeys.length === 0 ? '{} (none)' : ''}`);
  for (const key of blockKeys) {
    const block = blocks[key] as { blockNumber: number; requiredStrengthSessions: number };
    console.log(
      `  ${key} -> blockNumber=${block.blockNumber} requiredStrengthSessions=${block.requiredStrengthSessions}`,
    );
  }

  // The identity lives at `exercise.exercise.name`, and a `Workout` carries
  // `dayOfWeek`, not a date — session 10 paid for both of these with a silent
  // NONE on every seed.
  (program?.microcycles ?? []).forEach((microcycle, weekIndex) => {
    const hits: string[] = [];
    for (const workout of microcycle.workouts ?? []) {
      for (const entry of (workout as { exercises?: unknown[] }).exercises ?? []) {
        const name = (entry as { exercise?: { name?: string } })?.exercise?.name;
        if (typeof name === 'string' && /back squat/i.test(name)) {
          hits.push(`dow${(workout as { dayOfWeek?: number }).dayOfWeek}`);
        }
      }
    }
    console.log(
      `WEEK ${weekIndex + 1} start=${microcycle.startDate?.slice(0, 10)} backSquat=${hits.length ? hits.join(',') : 'NONE'}`,
    );
  });

  const prefs = (state as unknown as { athletePrefs?: { exclusions?: unknown[] } }).athletePrefs;
  console.log(`EXCLUSIONS     : ${prefs?.exclusions?.length ?? 0}`);
}

void main().catch((error) => { console.error(error); process.exit(1); });
