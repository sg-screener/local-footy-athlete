/**
 * WHAT THE ATHLETE SEES, HELD IN THE CHAIN.
 *
 * Run: npm run test:visible-surfaces
 *
 * Two properties, both found by DRIVING THE REAL SCREENS on a simulator on
 * 2026-08-18 and neither visible to any existing suite:
 *
 *   1. the day card and the opened session present ONE exercise order;
 *   2. a swapped-in exercise never wears the outgoing exercise's load.
 *
 * ## WHY THESE CELLS EXIST WHEN MAESTRO FLOWS ALREADY PROVE BOTH
 *
 * The flows (`.maestro/visible/one-order.yaml`, `.maestro/visible/swap-load.yaml`)
 * are the acceptance — they tap the real controls and read the real glass, and
 * both were seen RED under mutation. But they need a booted simulator, so they
 * are not in `test:bible` and nothing runs them on an ordinary change. **A guard
 * outside the chain is a guard nothing runs.** These cells are the chain's half:
 * same properties, same owners, no pixels.
 *
 * **NEITHER HALF IS SUFFICIENT AND THAT IS SAID PLAINLY.** These cells cannot
 * see a screen that stops calling these owners — that is exactly the failure the
 * swap defect WAS (the writer was right; the screen talked over it), and only
 * the flow catches it. The flow cannot run here. Both, or the property is half
 * held.
 */

// ── Headless bootstrap. MUST precede every app import. ────────────────────
(global as unknown as { __DEV__: boolean }).__DEV__ = true;
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

import { profileForDevE2ESeed } from '../dev/e2e/devE2ESeedRegistry';
import { devE2EWeekStartForSeed } from '../dev/e2e/devE2ESeedIds';
import { generateProgramLocally } from '../services/api/generateProgram';
import { composeDayDetail } from '../utils/dayDetailComposition';
import { buildSessionTemplate } from '../utils/sessionTemplate';
import { buildSwapSuggestionPayload } from '../utils/swapSuggestionPayload';
import { loadForReplacementExercise } from '../rules/blockBoundaryProgression';

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) { passed += 1; console.log(`  PASS ${name}`); }
  else { failed += 1; console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
}

const SEED = 'standard-in-season-week' as const;

function mondayOfTheSeedWeek(): any {
  const profile = profileForDevE2ESeed(SEED);
  const weekStart = devE2EWeekStartForSeed(SEED);
  const program: any = generateProgramLocally(profile as any, {
    todayISO: weekStart, blockStartISO: weekStart,
  } as any);
  const micro = program.microcycles.find(
    (m: any) => String(m.startDate).slice(0, 10) === weekStart);
  return micro?.workouts.find((w: any) => w.dayOfWeek === 1) ?? null;
}

function rowNames(rows: readonly any[]): string[] {
  return rows.map((r) => String(r?.exercise?.name ?? r?.name ?? ''));
}

function run(): void {
  console.log('\nWHAT THE ATHLETE SEES\n');

  // ── PROPERTY 1: ONE ORDER ─────────────────────────────────────────────
  const monday = mondayOfTheSeedWeek();
  check('the seed world still produces a Monday strength session (non-vacuity)',
    !!monday && (monday.exercises ?? []).length >= 3,
    `rows=${(monday?.exercises ?? []).length}`);

  const card = rowNames(composeDayDetail(monday, monday).strengthExercises);
  const session = rowNames(
    buildSessionTemplate(monday).items
      .filter((item: any) => item.kind === 'exercise' && item.role !== 'conditioning')
      .map((item: any) => item.row));

  check('the day card lists more than two exercises (non-vacuity — an order needs rows)',
    card.length > 2, card.join(' | '));

  // Compare only the rows BOTH surfaces carry. The session's list can legitimately
  // hold rows the strength part does not (add-ons, team training); the claim is
  // about the ORDER of what they share, not about membership.
  const shared = new Set(card.filter((n) => session.includes(n)));
  const cardOrder = card.filter((n) => shared.has(n));
  const sessionOrder = session.filter((n) => shared.has(n));

  check('the shared rows are a real overlap, not one row (non-vacuity)',
    cardOrder.length >= 3, `${cardOrder.length} shared`);
  check('THE DAY CARD AND THE OPENED SESSION READ ONE ORDER',
    JSON.stringify(cardOrder) === JSON.stringify(sessionOrder),
    `card=[${cardOrder.join(' | ')}]  session=[${sessionOrder.join(' | ')}]`);

  // ── PROPERTY 2: THE REPLACEMENT'S OWN LOAD ────────────────────────────
  //
  // The exact world measured on glass: `Single-Leg RDL` at 20 kg is replaced by
  // `Glute Bridge`, which this athlete has never loaded.
  const outgoing = (monday?.exercises ?? []).find(
    (r: any) => String(r?.exercise?.name ?? r?.name) === 'Single-Leg RDL');
  check('the outgoing row exists and carries a load (non-vacuity — nothing to inherit otherwise)',
    !!outgoing && Number(outgoing.prescribedWeightKg) > 0,
    `prescribedWeightKg=${outgoing?.prescribedWeightKg}`);

  const replacementOwnLoad = loadForReplacementExercise({
    exerciseName: 'Glute Bridge',
    onboardingData: profileForDevE2ESeed(SEED) as any,
    recordedLoadByExercise: {},
  });
  check('the load owner says the replacement has NO load of its own (the world this is about)',
    replacementOwnLoad === undefined, String(replacementOwnLoad));

  const payload = buildSwapSuggestionPayload('Glute Bridge', outgoing, {});
  check('THE SWAP PAYLOAD CARRIES NO LOAD — the owner decides, not the screen',
    payload.weight === undefined, String(payload.weight));
  check('and it is not merely blanking everything: the DOSE still carries over',
    payload.sets === Number(outgoing?.prescribedSets)
      && payload.repsMin === Number(outgoing?.prescribedRepsMin),
    `sets=${payload.sets} repsMin=${payload.repsMin} vs row sets=${outgoing?.prescribedSets} repsMin=${outgoing?.prescribedRepsMin}`);

  // A choice that PRESCRIBES a load is stating one, not inheriting one — the
  // recovery fallbacks send 0 to mean unloaded and must keep winning.
  const prescribed = buildSwapSuggestionPayload('Easy Bike', outgoing, { weight: 0 });
  check('a prescribed load still wins (0 means unloaded, and it is the choice\'s to say)',
    prescribed.weight === 0, String(prescribed.weight));

  console.log(`\nVisible surface totals: ${passed} passed, ${failed} failed`);
  totalsPrinted(failed);
  if (failed > 0) process.exitCode = 1;
}

run();
