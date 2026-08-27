/**
 * THE PROGRAM STORE'S PERSISTED-INPUT LIST HAS ONE PROJECTION.
 *
 * Run: npm run test:persisted-input-projection
 *
 * ## WHY THIS SUITE EXISTS — it is a founding case, measured on glass
 *
 * On 2026-08-18 no seeded simulator flow in this repo could start. The refusal
 * came from the app itself, not from Maestro:
 *
 *     Persisted semantic state did not converge: program-store
 *       memory: {… "weightOverrides":{}, "temporarySourceFacts":[] …}
 *       disk:   {… "weightOverrides":{}, "acceptedBlocks":{}, "temporary… }
 *
 * `acceptedBlocks` had been added to BOTH of `programStore`'s own projections
 * on 2026-08-17 and to neither of anything else. There was a third copy of the
 * same list in `src/dev/e2e/devE2EPersistence.ts`, whose docstring said it
 * *"mirrors `partialize` field for field"* and that *"if that list ever grows a
 * key, this one grows with it"* — **a rule written in prose, in another file,
 * with nothing holding it.** The list grew. The copy did not. Every golden
 * flow, every scenario flow and every explorer flow died at the seed step, and
 * the only visible symptom was `assertion is false: id: e2e-seed-ready-… `.
 *
 * The `journey` seat had already paid for the SAME defect one layer in, and
 * left the warning *"THE INPUT LIST IS WRITTEN IN TWO PLACES AND BOTH MUST
 * CARRY A NEW INPUT"* — which was true and named two of the three.
 *
 * ## WHAT IS GUARDED, AND WHY IT IS THE ROUTE AND NOT THE SOURCE
 *
 * A source scan — "all three files call one function" — would pass the moment
 * someone inlined a fourth list somewhere new, which is precisely how this got
 * here. So the cells drive **the exact route that failed**:
 * `captureDevE2EMemoryFingerprints()` against `readDevE2EPersistedFingerprints()`
 * through `waitForDevE2EPersistence`, the three functions the seed installer
 * itself calls. If memory and disk ever disagree about what a program store
 * persists, this reds for the same reason and with the same message the
 * simulator did.
 *
 * ## WHAT IT DOES NOT CLAIM
 *
 * It does not claim the list is CORRECT — that every key on it is an input and
 * no key is an output. That property belongs to `test:persisted-inputs-schema`,
 * which reads the disk and classifies every key. This suite only holds that the
 * app's two views of that list cannot drift apart. Both are needed: one says
 * the right things are stored, this one says everybody agrees what they are.
 */

// ── Headless bootstrap. MUST precede every app import. ────────────────────
const localStorageData = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => localStorageData.get(key) ?? null,
    setItem: (key: string, value: string) => { localStorageData.set(key, value); },
    removeItem: (key: string) => { localStorageData.delete(key); },
    clear: () => { localStorageData.clear(); },
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED');
};
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

import { useProgramStore, projectProgramPersistedInputs, reduceProgramEnvelopeToInputs } from '../store/programStore';
import { resetStoresToFreshInstall } from './support/freshInstallStores';
import {
  captureDevE2EMemoryFingerprints,
  readDevE2EPersistedFingerprints,
  fingerprintMapsMatch,
  waitForDevE2EPersistence,
} from '../dev/e2e/devE2EPersistence';

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/**
 * EVERY INPUT NON-EMPTY, AND THAT IS THE WHOLE POINT.
 *
 * The founding defect was invisible on an EMPTY world in one direction only:
 * `acceptedBlocks` was `{}` in memory-that-omitted-it and `{}` on disk, and the
 * two still hashed differently because one object had the key and the other did
 * not. A world where every value is also DISTINCT means a projection that
 * carries the right key with the wrong value is caught too.
 */
function aWorldWithEveryInputAnswered(): void {
  useProgramStore.setState({
    generationAnchorISO: '2026-07-13',
    sessionFeedback: {
      '2026-07-14': { difficulty: 'just_right' },
    },
    weightOverrides: { '2026-07-14': { 'leg-press': 125 } },
    acceptedBlocks: {
      '2026-07-13': { blockNumber: 1, requiredStrengthSessions: 8 },
    },
  } as never);
  useProgramStore.getState().setBandResistanceOverride(
    '2026-07-14', 'side-plank-row', 'thick',
  );
}

async function run(): Promise<void> {
  console.log('\nTHE PERSISTED-INPUT PROJECTION\n');

  // ── 1. THE ROUTE THAT DIED ────────────────────────────────────────────
  //
  // ⚠ EVERY STORE IS WRITTEN FIRST, AND THAT IS NOT TIDINESS. `waitForDevE2EPersistence`
  // compares ALL of them, and a store nothing has touched has never persisted,
  // so its disk side is genuinely empty while memory holds defaults. Asking the
  // whole-map question of a half-written world reports three stores as drifted
  // when what happened is that they were never written — a harness fault that
  // reads exactly like the defect this suite is for. The real seed installer
  // writes every store before it asks; so does this.
  resetStoresToFreshInstall('persisted input projection guard');
  aWorldWithEveryInputAnswered();

  let convergenceError: string | null = null;
  try {
    await waitForDevE2EPersistence(captureDevE2EMemoryFingerprints(), 4_000);
  } catch (error) {
    convergenceError = error instanceof Error ? error.message : String(error);
  }
  check(
    'memory and disk agree about what the program store persists — the seed route',
    convergenceError === null,
    convergenceError ?? '',
  );

  const memory = captureDevE2EMemoryFingerprints();
  const disk = await readDevE2EPersistedFingerprints();
  check(
    'the program-store fingerprints are equal, not merely both present',
    memory['program-store'] === disk['program-store'],
    `memory=${memory['program-store']} disk=${disk['program-store']}`,
  );
  check(
    'no OTHER store drifted while this one was being fixed',
    fingerprintMapsMatch(memory, disk),
    Object.keys(memory).filter((k) => memory[k] !== disk[k]).join(', '),
  );

  // ── 2. THE ACCEPTED BLOCK IS ON BOTH SIDES, BY NAME ───────────────────
  //
  // Asserted by NAME and not only by hash. The hash cell above goes red for any
  // disagreement; this one says WHICH key, because the founding case cost a
  // hand-read of the simulator's accessibility tree to find that out.
  const live = projectProgramPersistedInputs(
    useProgramStore.getState() as unknown as Record<string, unknown>,
  );
  check(
    "the athlete's accepted block is in the projection of the LIVE store",
    JSON.stringify(live.acceptedBlocks) === '{"2026-07-13":{"blockNumber":1,"requiredStrengthSessions":8}}',
    JSON.stringify(live.acceptedBlocks),
  );
  check(
    "the athlete's chosen band thickness is in the LIVE input projection",
    JSON.stringify(live.bandResistanceOverrides)
      === '{"2026-07-14":{"side-plank-row":"thick"}}',
    JSON.stringify(live.bandResistanceOverrides),
  );

  const raw = localStorageData.get('program-store');
  const onDisk = raw
    ? ((JSON.parse(raw) as { state?: { inputs?: Record<string, unknown> } }).state?.inputs ?? null)
    : null;
  check(
    "the athlete's accepted block reached DISK down the persist route",
    onDisk !== null
      && JSON.stringify(onDisk.acceptedBlocks)
        === '{"2026-07-13":{"blockNumber":1,"requiredStrengthSessions":8}}',
    JSON.stringify(onDisk?.acceptedBlocks),
  );
  check(
    "the athlete's chosen band thickness reached DISK down the persist route",
    onDisk !== null
      && JSON.stringify(onDisk.bandResistanceOverrides)
        === '{"2026-07-14":{"side-plank-row":"thick"}}',
    JSON.stringify(onDisk?.bandResistanceOverrides),
  );
  check(
    'the two sides carry the SAME KEYS — a new input cannot reach one route only',
    onDisk !== null
      && JSON.stringify(Object.keys(live).sort()) === JSON.stringify(Object.keys(onDisk).sort()),
    `live=${Object.keys(live).sort().join(',')} disk=${Object.keys(onDisk ?? {}).sort().join(',')}`,
  );
  check('current saves have no second derived injury-history field',
    !('injuryEpisodes' in live) && onDisk !== null && !('injuryEpisodes' in onDisk));
  const reducedAgain = JSON.parse(reduceProgramEnvelopeToInputs(JSON.stringify({
    state: { inputs: { ...live, injuryEpisodes: [] } }, version: 1,
  })));
  check('already-reduced outgoing envelopes also drop the retired duplicate',
    !('injuryEpisodes' in reducedAgain.state.inputs)
      && JSON.stringify(reducedAgain.state.inputs.temporarySourceFacts) === '[]');

  // ── 3. THE RESTORED CLOCK SURVIVES A WRITE MADE BEFORE BOOT ───────────
  //
  // THE SECOND DRIFT IN THE SAME LIST, and it was silent. `merge` restores the
  // persisted clock into `hydratedSeasonPhaseClock` while `currentProgram` is
  // still null — boot has not regenerated yet. The storage-adapter copy always
  // fell back to that field; `partialize`'s copy did not, so a middleware write
  // in that window wrote `null` over a clock restored one tick earlier.
  const restoredClock = { phase: 'in_season', asOfISO: '2026-07-13' };
  useProgramStore.setState({
    currentProgram: null,
    hydratedSeasonPhaseClock: restoredClock,
  } as never);

  const afterHydration = projectProgramPersistedInputs(
    useProgramStore.getState() as unknown as Record<string, unknown>,
  );
  check(
    'a clock restored by merge is NOT overwritten with null by a pre-boot write',
    JSON.stringify(afterHydration.seasonPhaseClock) === JSON.stringify(restoredClock),
    JSON.stringify(afterHydration.seasonPhaseClock),
  );

  let secondConvergence: string | null = null;
  try {
    await waitForDevE2EPersistence(captureDevE2EMemoryFingerprints(), 4_000);
  } catch (error) {
    secondConvergence = error instanceof Error ? error.message : String(error);
  }
  check(
    'and memory and disk still agree afterwards',
    secondConvergence === null,
    secondConvergence ?? '',
  );

  console.log(`\nPersisted input projection totals: ${passed} passed, ${failed} failed`);
  totalsPrinted(failed);
  if (failed > 0) process.exitCode = 1;
}

void run();
