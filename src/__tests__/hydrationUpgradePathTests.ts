/**
 * THE UPGRADE PATH: hydrating a PREVIOUS-BUILD store in today's build.
 *
 * Sam's 2026-07-29 wipe (`device-export-2026-07-29-hydration-failure.json`):
 * hydration read v43 intact, the gateway re-evaluated a stored week, the
 * transaction refused with `accepted_state_ledger_mismatch` and rolled back —
 * and then a second hydrate cycle started from an empty baseline and PERSISTED
 * it over the refused data. Profile and calendar marks survived; the program did
 * not.
 *
 * THE FIXTURE IS ACTED, NOT AUTHORED. `previousBuildStore-1e9c822.json` is the
 * payload zustand's persist middleware wrote when the REAL pre-canonical build
 * was driven through its own doors in a worktree. Its provenance block names the
 * commit, every action, and the store state each action left. A hand-written
 * "old store" would be the seed the fixture laws forbid, and a red cell standing
 * on one would prove nothing about his wipe.
 *
 * WHY 1e9c822 AND NOT THE BRANCH POINT. `previousBuildStore-49c8579.json` — also
 * acted, also committed — classifies `accepted_canonical`, and that ingress
 * early-returns without ever calling `commitAcceptedStateTransaction`. Only a
 * `legacy_precanonical` / `migration_required` envelope reaches the boundary that
 * refused on his phone.
 *
 * STATUS, STATED SO GREEN CANNOT BE MISREAD: this suite PASSES today. It proves
 * the upgrade path — a genuine previous-build store classifies as a legacy
 * ingress, reaches `commitAcceptedStateTransaction`, and hydrates without losing
 * the athlete's program. It does NOT yet reproduce Sam's refusal: his
 * 2026-08-03 week breached a CURRENT rule (`maximum_breach:conditioning`,
 * expected 3 actual 4 — an old-build week under new counting) after 43
 * revisions of edits, and this acted sequence (onboard, generate, marks) builds
 * weeks that re-evaluate cleanly. Cell 3 is therefore a GUARD against the wipe,
 * not a PROOF that it is fixed — the wipe is still unreproduced and unfixed.
 *
 * SAM'S RULING, 2026-07-30 — THE ARCHAEOLOGY STOPS HERE. Reproducing his exact
 * refusal would mean working out 1e9c822's plan-change door to act edits that
 * today's evaluator scores differently. That work is not being done, and the
 * reason is that it protects nobody: the entire population of pre-release stores
 * is Sam's own test device, which is being deleted and re-onboarded. These cells
 * stay as a GUARD, both acted fixtures stay as the record of how a previous-build
 * store behaves, and the wipe LAW is proven instead by injecting a refusal at the
 * acceptance boundary — see `hydrationRefusalQuarantineTests`. That injection is
 * not an authored seed: his tape documents the refusal happening in reality, and
 * a law about what must happen AFTER any refusal is rightly proven
 * cause-independently.
 *
 * STANDING LAW GOING FORWARD (same ruling): at every release, capture that
 * release's acted store, and this cell runs HEAD against the PREVIOUS RELEASE's
 * payload. No pre-release archaeology, ever again.
 *
 * Run: npm run test:hydration-upgrade-path
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

/**
 * The durable store, and the ONLY one. Every read and write in this suite goes
 * through this map, so "what is on disk" is answerable at any instant — which is
 * the entire question the wipe poses.
 */
const durable = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => durable.get(key) ?? null,
    setItem: (key: string, value: string) => { durable.set(key, value); },
    removeItem: (key: string) => { durable.delete(key); },
    clear: () => durable.clear(),
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — the upgrade path runs entirely on-device');
};


import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import * as fs from 'fs';
import * as path from 'path';
import { classifyProgramHydrationIngress } from '../store/programHydrationIngress';
import { useProgramStore } from '../store/programStore';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

async function run(name: string, body: () => Promise<void>): Promise<void> {
  try {
    await body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failed += 1;
    failures.push(name);
    console.error(`  FAIL ${name}\n      ${error instanceof Error ? error.message : error}`);
  }
}

const FIXTURE = path.join(__dirname, 'fixtures', 'previousBuildStore-1e9c822.json');

interface CapturedStore {
  __provenance: { capturedFromCommit: string; actions: string[]; newBuildClassification: string };
  envelopes: Record<string, string | null>;
}

function loadFixture(): CapturedStore {
  return JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as CapturedStore;
}

/** Put the previous build's store on disk, exactly as it wrote it. */
function seedDurableFromPreviousBuild(): CapturedStore {
  const fixture = loadFixture();
  durable.clear();
  for (const [key, value] of Object.entries(fixture.envelopes)) {
    if (typeof value === 'string') durable.set(key, value);
  }
  return fixture;
}

function programEnvelope(): { raw: string | null; state: Record<string, unknown> | null } {
  const raw = durable.get('program-store') ?? null;
  if (!raw) return { raw: null, state: null };
  const parsed = JSON.parse(raw) as { state?: Record<string, unknown> };
  return { raw, state: parsed.state ?? null };
}

function envelopeCarriesProgram(): boolean {
  const { state } = programEnvelope();
  const program = state?.currentProgram as { microcycles?: unknown[] } | null | undefined;
  return !!program && (program.microcycles ?? []).length > 0;
}

async function hydrate(): Promise<{ threw: Error | null }> {
  try {
    await useProgramStore.persist.rehydrate();
    return { threw: null };
  } catch (error) {
    return { threw: error instanceof Error ? error : new Error(String(error)) };
  }
}

async function main(): Promise<void> {
  console.log('\n-- Hydration upgrade path --');

  await run('the acted previous-build store reaches the accepted-state transaction', async () => {
    // Non-vacuity for everything below. If this payload classified
    // `accepted_canonical`, hydration would early-return and the two laws after
    // this one would pass without exercising the boundary that refused on his
    // phone. That is exactly what the 49c8579 fixture does, and why it is not
    // the one used here.
    const fixture = seedDurableFromPreviousBuild();
    const { state } = programEnvelope();
    assert(state, 'the fixture carries no program-store envelope');
    const classification = classifyProgramHydrationIngress(state, 0);
    assert(classification.kind === 'migration_required' ||
      classification.kind === 'legacy_precanonical',
      `the acted previous-build store classifies ${classification.kind} — only a `
      + 'legacy ingress reaches `commitAcceptedStateTransaction`, so this suite '
      + 'would be asserting laws about a path it never enters');
    assert(fixture.__provenance.capturedFromCommit === '1e9c822',
      'the fixture is not the pre-canonical capture');
    assert(envelopeCarriesProgram(),
      'the previous-build envelope carries no program — nothing to lose, so '
      + 'nothing to protect');
  });

  await run('hydrating a previous-build store does not refuse it', async () => {
    // FINDING 3 — ONE TRANSACTION, TWO MODES.
    //
    // `assertAcceptedVisibleLedgerEquivalence` throws on any blocking violation
    // when `operation === 'restoration'`, and `commitAcceptedStateTransaction`
    // DEFAULTS to `restoration` while the hydration call passes none. Meanwhile
    // the same transaction's staging path runs the §18 gateway, which
    // accept-and-reduces unconditionally. So one half reduces the week and the
    // other half refuses the reduction.
    //
    // Sam's ruling: old-build state under new rules is a LEGACY SHAPE wanting a
    // read-ingress lift BEFORE the strict boundary — not a re-gating that
    // shrinks, and not a strict check that strands.
    seedDurableFromPreviousBuild();
    const { threw } = await hydrate();
    assert(!threw,
      'hydrating an acted previous-build store REFUSED it: '
      + `${threw?.name} — ${threw?.message}. A previous build's own output is a `
      + 'legacy shape to lift, not a corrupt snapshot to reject.');
    // R1.3 (shell rebuild, docs/SHELL_REBUILD_RULING_2026-08-05.md): boot
    // restores NO outputs — the lift moved to the R2 migration, which reads
    // the envelope this cell proves SURVIVES. The protected property was
    // never "a program appears in memory"; it is "the athlete's only copy is
    // neither refused nor destroyed".
    const state = useProgramStore.getState();
    assert(state.currentProgram === null,
      'an old-shape envelope resurrected outputs through rehydrate — the '
      + 'R1.3 boot law is broken');
    assert(envelopeCarriesProgram(),
      'hydration destroyed the previous-build envelope — R2 has nothing to migrate');
  });

  await run('a refusal never persists the state it refused into', async () => {
    // FINDING 4 — THE WIPE ITSELF, and the law Sam named for this unit.
    //
    // The refused payload must be quarantined UNTOUCHED and the bare fallback
    // must be unpersistable while a refused payload exists. Asserted against the
    // durable envelope rather than the live store, because the wipe is a
    // PERSISTENCE event: his in-memory rollback was clean and the damage landed
    // 13.4 seconds later, when the boot gate timed out and the retry published
    // an empty baseline over the top.
    //
    // The second hydrate is the retry: `appHydrationGate.retryAppHydration()`
    // calls `persist.rehydrate()`, which is what the boot error screen's Try
    // Again does. Whatever the first cycle decided, the athlete's program must
    // still be on disk afterwards.
    seedDurableFromPreviousBuild();
    const before = programEnvelope().raw;
    assert(before && envelopeCarriesProgram(), 'seeding did not put a program on disk');

    await hydrate();
    assert(envelopeCarriesProgram(),
      'the FIRST hydration cycle removed the athlete\'s program from disk');

    // The retry, exactly as the boot error screen performs it.
    await hydrate();
    assert(envelopeCarriesProgram(),
      'THE WIPE: after a hydration refusal and the boot screen\'s retry, the '
      + 'persisted program is gone. A refusal must never persist the state it '
      + 'refused into — the refused payload is quarantined, and a bare fallback '
      + 'is unpersistable while a quarantined payload exists.');
  });

  await run('a stored repeat_week overlay hydrates to an absent overlay and the week still derives', async () => {
    // L15 (HOME_SCREEN_REDESIGN ruling 1, 2026-07-30). The repeat-week writer
    // is retired entirely; a `reason: 'repeat_week'` overlay can only be a
    // prior build's leftover output, never a fresh athlete decision. The read
    // boundary drops it unconditionally — the target week re-derives from its
    // own base/facts, exactly as if the overlay had never been written.
    const fixture = seedDurableFromPreviousBuild();
    const { state: preState } = programEnvelope();
    assert(preState, 'the fixture carries no program-store envelope');
    const overlays = preState.weekScopedOverlays as Record<string, Record<string, unknown>>;
    const templateOverlay = overlays['2026-07-27'];
    assert(templateOverlay, 'fixture lost its template overlay — pick a different source week');
    const retiredWeekStart = '2026-08-10';
    const retiredOverlay = {
      ...templateOverlay,
      id: `week-overlay:${retiredWeekStart}:repeat_week`,
      weekStart: retiredWeekStart,
      weekEnd: '2026-08-16',
      anchorDate: null,
      reason: 'repeat_week',
    };
    const mutatedState = {
      ...preState,
      weekScopedOverlays: { ...overlays, [retiredWeekStart]: retiredOverlay },
    };
    durable.set('program-store', JSON.stringify({
      state: mutatedState,
      version: 0,
    }));
    assert((JSON.parse(durable.get('program-store')!) as { state: { weekScopedOverlays: Record<string, unknown> } })
      .state.weekScopedOverlays[retiredWeekStart], 'seeding the retired overlay onto disk failed');

    const { threw } = await hydrate();
    assert(!threw,
      `hydrating a stored repeat_week overlay REFUSED it: ${threw?.name} — ${threw?.message}. `
      + 'A retired-writer overlay is a legacy shape to drop, not a corrupt snapshot to reject.');

    // R1.3 (shell rebuild): the L15 drop is exercised DIRECTLY against its own
    // owner. The live store holds no outputs at all now, which subsumes "the
    // overlay did not survive".
    const live = useProgramStore.getState();
    assert(!live.weekScopedOverlays[retiredWeekStart],
      'the stored repeat_week overlay survived hydration — L15 requires it dropped');
    // RE-POINTED, NOT WEAKENED (2026-08-14). This called
    // `canonicaliseHydratedState` with `ingressKind: 'legacy_precanonical'` —
    // deleted with the whole legacy structural-migration pipeline, which no
    // launch could reach (`partialize` persists inputs only). The L15 drop was
    // never part of that migration: it ran ABOVE every ingress branch and it
    // still exists, by name, in `dropRetiredWeekOverlaysAtHydration`. So the
    // assertion now names the actual owner instead of a wrapper.
    const { dropRetiredWeekOverlaysAtHydration } = require('../store/programHydrationIngress') as
      typeof import('../store/programHydrationIngress');
    const canonical = dropRetiredWeekOverlaysAtHydration(mutatedState as never) as
      Record<string, unknown>;
    const canonicalOverlays = (canonical.weekScopedOverlays ?? {}) as Record<string, unknown>;
    assert(!canonicalOverlays[retiredWeekStart],
      'the retired overlay survived the read boundary — L15\'s drop is gone');
    // AND THE DROP TAKES NOTHING WITH IT. A drop that reached the program would
    // be the opposite defect — losing the week to remove one retired overlay.
    assert(!!canonical.currentProgram
      && ((canonical.currentProgram as { microcycles?: unknown[] }).microcycles?.length ?? 0) > 0,
      'dropping the retired overlay took the program with it');

    // R1.3: outputs never persist forward, so a NEW-shape envelope carrying
    // ANY overlay would be the drop failing twice over. The untouched
    // OLD-shape envelope keeping its overlay is the non-destruction law —
    // it is the R2 migration's source material, and the canonicaliser above
    // is what drops the overlay when R2 reads it.
    const { raw: persistedRaw } = programEnvelope();
    const persistedState = persistedRaw
      ? (JSON.parse(persistedRaw) as { state?: Record<string, unknown> }).state ?? {}
      : {};
    if ('inputs' in persistedState) {
      assert(!('weekScopedOverlays' in persistedState),
        'a new-shape envelope persists overlays — outputs are back on disk');
    }
    void fixture;
  });

  console.log('\n  NOTE: green here is the upgrade path working, NOT the '
    + '2026-07-29 wipe fixed.\n        This fixture reaches the transaction but '
    + 'does not make it refuse, so the\n        quarantine law is guarded, not '
    + 'proven. See docs/HYDRATION_WIPE_DIAGNOSIS_2026-07-30.md.');
  console.log(`\nHydration upgrade path totals: ${passed} passed, ${failed} failed`);
totalsPrinted(failed);
  if (failed > 0) {
    console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
}

void main();
