/**
 * WHY `visible_card_detail_equality` REFUSES THE FOUR-WEEK SEEDS.
 *
 * The witness asserts the Program-tab CARD and the Day-detail for one date
 * project to the same fingerprint and name the same workout id. It fails on
 * `multi-reload-fixture-chain` (2026-07-19) and `coach-production-replay`
 * (2026-07-19, 2026-07-20), which is what makes both four-week candidates
 * unreachable through the real seed door.
 *
 * This prints the two sides so the disagreement can be READ rather than
 * guessed. `reset()`'s catch clears the clock, so the clock is re-installed
 * before projecting — otherwise `todayISOLocal()` is the wall clock and both
 * sides are projected against the wrong "today".
 *
 *   npx sucrase-node scripts/probe-card-detail-disagreement.ts <seed-id> <iso-date>...
 */
type AsyncStorageEntry = readonly [string, string];

async function main(): Promise<void> {
  const [seedId, ...dates] = process.argv.slice(2);
  if (!seedId || dates.length === 0) {
    throw new Error('usage: probe-card-detail-disagreement.ts <seed-id> <iso-date>...');
  }
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

  /* eslint-disable @typescript-eslint/no-var-requires */
  const { createDefaultDevE2ESeedCoordinator } =
    require('../src/dev/e2e/defaultDevE2ESeedCoordinator');
  const { replacePersistedDevE2EClockForSeed } =
    require('../src/dev/e2e/devE2EClockPersistence');
  const { buildScheduleStateImperative } = require('../src/utils/coachWeekDiff');
  const { buildDayWorkoutProjectedDay, buildProgramTabProjectedWeek } =
    require('../src/utils/visibleProgramReadModel');
  const { useProgramStore } = require('../src/store/programStore');
  const { todayISOLocal } = require('../src/utils/appDate');
  /* eslint-enable @typescript-eslint/no-var-requires */

  const coordinator = createDefaultDevE2ESeedCoordinator(true);
  try {
    await coordinator.reset(seedId);
    console.log('INSTALL: succeeded (no witness failure to diagnose)');
  } catch (error) {
    console.log(`INSTALL THREW: ${error instanceof Error ? error.message : String(error)}`);
  }

  // The catch cleared the clock. Put the seed's own "today" back before
  // projecting, or both sides are built against the wall clock.
  await replacePersistedDevE2EClockForSeed(seedId);
  const todayISO = todayISOLocal();
  console.log(`TODAY (restored): ${todayISO}`);

  const program = useProgramStore.getState();
  const schedule = buildScheduleStateImperative();

  for (const date of dates) {
    const mondayISO = (program.currentProgram?.microcycles ?? [])
      .map((m: { startDate: string }) => m.startDate.slice(0, 10))
      .find((start: string) => {
        const d = new Date(`${date}T12:00:00.000Z`).getTime();
        const s = new Date(`${start}T12:00:00.000Z`).getTime();
        return d >= s && d < s + 7 * 864e5;
      });
    console.log(`\n════════ ${date}  (week of ${mondayISO ?? 'NOT IN PROGRAM'}) ════════`);
    if (!mondayISO) continue;

    const week = buildProgramTabProjectedWeek({
      mondayISO,
      todayISO,
      state: schedule,
      overrideContexts: program.overrideContexts,
    });
    const card = week.find((d: { date: string }) => d.date === date);
    const detail = buildDayWorkoutProjectedDay({
      date,
      todayISO,
      state: schedule,
      overrideContext: program.overrideContexts[date],
    });

    const cardWorkout = card?.workout ?? null;
    const detailWorkout = detail?.workout ?? null;
    console.log(`CARD   present=${card !== undefined} workoutId=${cardWorkout?.id ?? 'null'} type=${cardWorkout?.type ?? '-'} exercises=${cardWorkout?.exercises?.length ?? 0}`);
    console.log(`DETAIL present=${detail !== undefined} workoutId=${detailWorkout?.id ?? 'null'} type=${detailWorkout?.type ?? '-'} exercises=${detailWorkout?.exercises?.length ?? 0}`);

    // Field-by-field, so the disagreeing key is named rather than inferred.
    const strip = (v: unknown): unknown => {
      if (Array.isArray(v)) return v.map(strip);
      if (!v || typeof v !== 'object') return v;
      return Object.fromEntries(Object.entries(v as Record<string, unknown>)
        .filter(([k]) => k !== 'createdAt' && k !== 'updatedAt')
        .map(([k, e]) => [k, strip(e)]));
    };
    const a = strip(card) as Record<string, unknown> | undefined;
    const b = strip(detail) as Record<string, unknown> | undefined;
    const keys = Array.from(new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])).sort();
    for (const key of keys) {
      const av = JSON.stringify(a?.[key]);
      const bv = JSON.stringify(b?.[key]);
      if (av === bv) continue;
      const trim = (s: string | undefined) => (s ?? 'undefined').slice(0, 260);
      console.log(`  ✗ ${key}\n      card  : ${trim(av)}\n      detail: ${trim(bv)}`);
    }
  }
}

void main().catch((error) => { console.error(error); process.exit(1); });
