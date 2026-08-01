/**
 * THE LEGACY RECKONING RATCHET — pre-law surface is declared debt, and it only
 * goes down.
 *
 * THE RULING (Sam, 2026-07-30, docs/LEGACY_RECKONING_CENSUS_2026-07-30.md):
 * the census is approved; LR-1 + LR-2 run together as the next major unit after
 * the G-1 branch merges and before Stage B; LR-14 runs in parallel; LR-6 is a
 * standing STOP on all coach-pipeline work until its reassessment is approved;
 * everything else holds its census rank, and the ratchet keeps the surface from
 * growing meanwhile.
 *
 * WHY A CENSUS AND NOT A BAN. 24 units of pre-law surface. A gate that failed on
 * all of them the day it landed would be switched off by the first person it
 * blocked — the same reasoning that shaped the readiness census and the
 * load-ratio gate, both of which grew one cluster at a time. So the debt is
 * DECLARED, and the gate ratchets in FOUR directions:
 *
 *   1. a unit's actual detector count must equal its declared count, so a new
 *      violation anywhere fails until someone classifies it;
 *   2. total debt may never exceed LEGACY_DEBT_BASELINE, so it only shrinks;
 *   3. LEGACY_DEBT_BASELINE must equal the current total, so paying debt down
 *      tightens the ratchet instead of leaving re-spendable slack;
 *   4. LEGACY_DEBT_BASELINE may never exceed LEGACY_DEBT_FOUNDING_BASELINE —
 *      the number frozen the day the census landed. THIS is what stops new code
 *      joining the list. Directions 2 and 3 alone are circular: a newcomer could
 *      raise the declared count and the baseline together and stay green.
 *      Direction 4 closes that, because accommodating a new violation means
 *      exceeding a constant that carries the founding date in its name.
 *
 * OLD SURFACE MAY BE DECLARED. NEW SURFACE MAY ONLY BE FIXED.
 *
 * WHAT THIS GATE DOES NOT DO. It pays nothing. Every unit still needs its own
 * ruling and its own build; the ratchet only stops the surface growing while
 * they are scheduled. And it ratchets ONLY the units a mechanical detector can
 * count — the rest are recorded as `tracked_only` and must say why, so the
 * census never reads as more enforcement than it has.
 *
 * Run: npm run test:legacy-census
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import fs from 'fs';
import path from 'path';

import {
  LEGACY_RECKONING_RULING,
  LEGACY_UNIT_CENSUS,
  LEGACY_DEBT_BASELINE,
  LEGACY_DEBT_FOUNDING_BASELINE,
  LEGACY_CENSUS_FOUNDING_UNIT_COUNT,
  LEGACY_LAW_IDS,
  DETECTORS,
  detectorScopeExempts,
  type LegacyDetectorId,
} from '../data/legacyReckoningCensus';

const repoRoot = path.resolve(__dirname, '../..');
const src = path.resolve(__dirname, '..');

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

/** Every product file under src/, tests and node_modules excluded. */
function productFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
        walk(full);
        continue;
      }
      if (/\.tsx?$/.test(entry.name)) out.push(path.relative(src, full));
    }
  };
  walk(src);
  return out;
}

/** Sum a detector across every product file it is not exempt in. */
function detectorTotal(id: LegacyDetectorId): number {
  const detect = DETECTORS[id];
  const exempt = new Set(detectorScopeExempts(id));
  let total = 0;
  for (const rel of productFiles()) {
    if (exempt.has(rel)) continue;
    total += detect(fs.readFileSync(path.join(src, rel), 'utf8'), rel);
  }
  return total;
}

console.log('\n[1] The ruling is attributed and still says what the census enforces');
{
  ok('the ruling is dated', /^\d{4}-\d{2}-\d{2}$/.test(LEGACY_RECKONING_RULING.ruledOn),
    LEGACY_RECKONING_RULING.ruledOn);

  const wherePath = path.join(repoRoot, LEGACY_RECKONING_RULING.where);
  ok('the attributed document exists', fs.existsSync(wherePath), LEGACY_RECKONING_RULING.where);

  if (fs.existsSync(wherePath)) {
    const doc = fs.readFileSync(wherePath, 'utf8');
    ok('the ruling appears verbatim in the attributed document',
      doc.includes(LEGACY_RECKONING_RULING.quote),
      `not found: ${LEGACY_RECKONING_RULING.quote.slice(0, 80)}...`);
  }

  // The two halves the ratchet turns on. A ruling paraphrased into a gate drifts
  // from the ruling; these pin the words the directions rest on.
  ok('the ruling states that old surface may be declared',
    /declared/i.test(LEGACY_RECKONING_RULING.quote));
  ok('the ruling states that new surface may only be fixed',
    /only be fixed/i.test(LEGACY_RECKONING_RULING.quote));
}

console.log('\n[2] Every unit is typed: id, laws, blast radius, founding evidence, size');
{
  const seen = new Set<string>();
  const knownLaws = new Set<string>(LEGACY_LAW_IDS);

  for (const unit of LEGACY_UNIT_CENSUS) {
    ok(`${unit.id}: has a well-formed id`, /^LR-\d+$/.test(unit.id), unit.id);
    ok(`${unit.id}: is declared once`, !seen.has(unit.id));
    seen.add(unit.id);

    ok(`${unit.id}: has a title`, unit.title.length > 0);
    ok(`${unit.id}: names at least one law it must land under`, unit.laws.length > 0);

    const unknown = unit.laws.filter((l) => !knownLaws.has(l));
    ok(`${unit.id}: every law it names exists in the law book`, unknown.length === 0,
      `unknown: ${unknown.join(', ')}`);

    ok(`${unit.id}: carries founding evidence`, unit.founding.length > 0,
      'a unit with no founding evidence is a suspicion, not a census entry');
    ok(`${unit.id}: is sized`, ['S', 'M', 'L', 'XL'].includes(unit.size), unit.size);
    ok(`${unit.id}: has a status`,
      ['scheduled', 'in_flight', 'stop', 'retired'].includes(unit.status), unit.status);
    ok(`${unit.id}: is in a tier`, [1, 2, 3].includes(unit.tier), String(unit.tier));
  }

  ok('the census is not empty', LEGACY_UNIT_CENSUS.length > 0);
}

console.log('\n[3] DIRECTION 1 — every detector-backed unit declares its actual count');
{
  for (const unit of LEGACY_UNIT_CENSUS) {
    if (unit.detector === null) continue;

    ok(`${unit.id}: declares a count`, typeof unit.declared === 'number',
      'a detector-backed unit must declare the number it is holding the line at');
    if (typeof unit.declared !== 'number') continue;

    const actual = detectorTotal(unit.detector);
    ok(`${unit.id}: declared count matches the detector (${actual})`,
      actual === unit.declared,
      `declared ${unit.declared}, found ${actual} — fix the violation or, if it is `
      + 'genuinely pre-existing surface that moved, reclassify it. Do not retune the number.');

    // A DETECTOR-BACKED UNIT DOES NOT DIE AT ZERO — IT BECOMES A BAN.
    //
    // The readiness census deletes an entry when its count reaches zero, because
    // a list that keeps naming solved problems reads as approval. That is right
    // for a classification census and wrong for a RETIREMENT one: deleting the
    // entry deletes the detector, and nothing then stops the retired surface
    // coming back. Found by testing the shrink path — the gate went red when a
    // paid-off unit was deleted, which would have forced people to keep dead
    // entries alive. So paid units are marked `retired` and the detector is held
    // at zero forever.
    //
    // `tracked_only` units still die the ordinary way: they are deleted when
    // their work lands, because nothing counts them.
    if (unit.status === 'retired') {
      ok(`${unit.id}: retired — the surface stays gone (${actual})`, actual === 0,
        'a retired legacy surface came back. This is not new debt to declare; the unit '
        + 'was paid off and the ban is what remains of it.');
      ok(`${unit.id}: retired units declare zero`, unit.declared === 0,
        'a retired unit holds the line at zero, not at what it used to be');
    } else {
      ok(`${unit.id}: still has something to count`, actual > 0,
        'the detector reached zero — mark this unit `retired` with `declared: 0` and '
        + 'lower both baselines. Do NOT delete it: deleting the entry deletes the '
        + 'detector, and the surface can then return unobserved.');
    }
  }
}

console.log('\n[4] THE RATCHET — four directions');
{
  const total = LEGACY_UNIT_CENSUS
    .filter((u) => u.detector !== null)
    .reduce((n, u) => n + (u.declared ?? 0), 0);

  // Direction 2 — debt may shrink, never grow.
  ok(`total declared debt (${total}) is at or below the baseline (${LEGACY_DEBT_BASELINE})`,
    total <= LEGACY_DEBT_BASELINE,
    'new pre-law surface was added; the census forbids it');

  // Direction 3 — paying debt down tightens the ratchet.
  ok(`the baseline is tightened to the current debt (${total})`,
    total === LEGACY_DEBT_BASELINE,
    `debt fell to ${total} — lower LEGACY_DEBT_BASELINE to match, `
    + 'or the slack is re-spendable');

  // Direction 4 — new code cannot join the list. Without this, 2 and 3 are
  // circular: raise `declared` and the baseline together and the gate stays
  // green. The founding numbers are the non-circular ceiling.
  ok(`the baseline (${LEGACY_DEBT_BASELINE}) never exceeds the founding baseline `
    + `(${LEGACY_DEBT_FOUNDING_BASELINE})`,
    LEGACY_DEBT_BASELINE <= LEGACY_DEBT_FOUNDING_BASELINE,
    'raising the founding baseline admits new surface to the census. Old surface may '
    + 'be declared; new surface may only be fixed. This needs a ruling, not an edit.');

  // 4a — THE SLACK IS BOUND TO ITS OWN UNIT.
  //
  // A single global ceiling is not enough, and this was demonstrated rather than
  // reasoned: on 2026-07-30 one unit of LR-2 debt was genuinely paid (uiStore
  // given an owner) and the freed unit was spent on brand-new LR-1 surface. The
  // suite passed 289/289 while admitting a violation that did not exist when the
  // census landed. Paid debt must retire, not become a budget.
  for (const unit of LEGACY_UNIT_CENSUS) {
    if (unit.detector === null) continue;
    ok(`${unit.id}: declares a founding count`, typeof unit.foundingCount === 'number',
      'a detector-backed unit must record what it measured on census day');
    if (typeof unit.foundingCount !== 'number') continue;

    ok(`${unit.id}: declared (${unit.declared}) never exceeds its founding count `
      + `(${unit.foundingCount})`,
      (unit.declared ?? 0) <= unit.foundingCount,
      'this unit grew. Debt paid on ANOTHER unit cannot fund it — slack retires where '
      + 'it was earned.');
  }

  // 4b — the global ceiling is the sum of the per-unit ones, so it cannot be
  // edited on its own to create headroom nothing accounts for.
  const founding = LEGACY_UNIT_CENSUS
    .filter((u) => u.detector !== null)
    .reduce((n, u) => n + (u.foundingCount ?? 0), 0);
  ok(`the founding baseline (${LEGACY_DEBT_FOUNDING_BASELINE}) is the sum of the `
    + `per-unit founding counts (${founding})`,
    LEGACY_DEBT_FOUNDING_BASELINE === founding,
    'the ceiling must be accounted for unit by unit, not asserted as a total');

  // 4c — a new unit is the last way to manufacture headroom. The census may
  // shrink as units are paid and deleted; it may not grow without a ruling.
  ok(`the census holds no more units than it was founded with `
    + `(${LEGACY_UNIT_CENSUS.length} of ${LEGACY_CENSUS_FOUNDING_UNIT_COUNT})`,
    LEGACY_UNIT_CENSUS.length <= LEGACY_CENSUS_FOUNDING_UNIT_COUNT,
    'a unit was added. If a genuine pre-law surface was missed by the founding sweep, '
    + 'name the sweep that missed it and get it ruled — do not file it in quietly.');
}

console.log('\n[5] COMPLETENESS — no detector hit is outside a declared unit');
{
  // Direction 1 only bites if the detector sees the whole repo. A violation in a
  // file nobody thought of must land in some unit's total, or the census is
  // measuring its own examples.
  const byDetector = new Map<LegacyDetectorId, number>();
  for (const unit of LEGACY_UNIT_CENSUS) {
    if (unit.detector === null) continue;
    byDetector.set(unit.detector, (byDetector.get(unit.detector) ?? 0) + (unit.declared ?? 0));
  }

  for (const [id, declared] of byDetector) {
    const actual = detectorTotal(id);
    ok(`detector '${id}': every hit in src/ is declared (${actual})`,
      actual === declared,
      `${actual} hits across src/, ${declared} declared — an undeclared hit means a new `
      + 'violation, not a miscount');
  }

  // Every detector the census ships must be in use. An unused detector is a
  // claim of coverage that counts nothing.
  const used = new Set(byDetector.keys());
  const unused = (Object.keys(DETECTORS) as LegacyDetectorId[]).filter((d) => !used.has(d));
  ok('every shipped detector is claimed by a unit', unused.length === 0,
    `unused: ${unused.join(', ')}`);
}

console.log('\n[6] HONEST COVERAGE — a unit with no detector says why');
{
  for (const unit of LEGACY_UNIT_CENSUS) {
    if (unit.detector !== null) continue;
    ok(`${unit.id}: explains why it cannot be counted`,
      typeof unit.whyNotDetectable === 'string' && unit.whyNotDetectable.length > 0,
      'a tracked-only unit must say why a detector cannot hold it, or the census '
      + 'reads as more enforcement than it has');
  }

  const ratcheted = LEGACY_UNIT_CENSUS.filter((u) => u.detector !== null).length;
  ok('at least one unit is actually ratcheted', ratcheted > 0,
    'a census where nothing is counted is a document, not a gate');
}

console.log("\n[7] The detectors count what they claim to count");
{
  // A census built on a detector nobody checked is a census of whatever the
  // regex happened to match. Pin every one from both sides.

  // The idiom is a PROPERTY ACCESS on the store — `.setManualOverride`. That is
  // what reaching the raw write door looks like in every real call site,
  // including the capture form (`const x = store.getState().setManualOverride`)
  // where the bare left-hand binding is a local name, not a second reference.
  const rawWrite = DETECTORS.rawProgramWriteRefs;
  ok('rawProgramWriteRefs: counts a direct call',
    rawWrite('useProgramStore.getState().setManualOverride(d, w, c);', 'x.ts') === 1);
  ok('rawProgramWriteRefs: counts a captured reference once, not twice (the coachActions shape)',
    rawWrite('const setManualOverride = useProgramStore.getState().setManualOverride;', 'x.ts') === 1);
  ok('rawProgramWriteRefs: counts the reference inside an injected callback',
    rawWrite('applyPlanChange({ setManualOverride: (d, w) => store.setManualOverride(d, w) });',
      'x.ts') === 1);
  ok('rawProgramWriteRefs: does not count a parameter of the same name',
    rawWrite('function apply(args: { setManualOverride: Fn }) { return args; }', 'x.ts') === 0,
    'an injection seam declares a parameter; it does not reach the store');
  ok('rawProgramWriteRefs: ignores comments',
    rawWrite('// store.setManualOverride used to be called here\nconst x = 1;', 'x.ts') === 0);
  ok('rawProgramWriteRefs: ignores a longer identifier that contains it',
    rawWrite('store.setManualOverrideLegacy(1);', 'x.ts') === 0);
  ok('rawProgramWriteRefs: ignores an unrelated write',
    rawWrite('store.setWeightOverride(d, e, 100);', 'x.ts') === 0);

  const mirror = DETECTORS.mirrorDecisionReads;
  ok('mirrorDecisionReads: counts a getState read',
    mirror('const d = useProfileStore.getState().onboardingData;', 'x.ts') === 1);
  ok('mirrorDecisionReads: counts a selector read',
    mirror('const d = useProfileStore((s) => s.onboardingData);', 'x.ts') === 1);
  ok('mirrorDecisionReads: ignores comments',
    mirror('// useProfileStore.getState().onboardingData was read here\n', 'x.ts') === 0);
  ok('mirrorDecisionReads: ignores an onboardingData field on something else',
    mirror('const d = snapshot.onboardingData;', 'x.ts') === 0);
  ok('mirrorDecisionReads: ignores a profile-store read of another field',
    mirror('const c = useProfileStore.getState().isOnboardingComplete;', 'x.ts') === 0);
  // A DECLARED LIMIT, pinned so it is a known hole rather than a silent one:
  // the detector sees a single-expression read. A two-step read through a local
  // is invisible to it, and LR-4's declared number is therefore a floor.
  ok('mirrorDecisionReads: does NOT see a two-step read (declared limitation)',
    mirror('const p = useProfileStore.getState();\nconst d = p.onboardingData;', 'x.ts') === 0);

  const legacyWriter = DETECTORS.legacyOverrideWriterRefs;
  ok('legacyOverrideWriterRefs: counts a call',
    legacyWriter('const p = applyCoachRevisionDateOverrides({ a: 1 });', 'x.ts') === 1);
  ok('legacyOverrideWriterRefs: does not count the writer defining itself',
    legacyWriter('export function applyCoachRevisionDateOverrides(a) { return a; }',
      'utils/coachRevisionOverrideWriter.ts') === 0);
  ok('legacyOverrideWriterRefs: ignores comments',
    legacyWriter('// applyCoachRevisionDateOverrides is the legacy path\n', 'x.ts') === 0);
  ok('legacyOverrideWriterRefs: ignores an import',
    legacyWriter("import { applyCoachRevisionDateOverrides } from './x';", 'x.ts') === 0);

  // The owner is declared in PERSISTED_STORE_OWNERSHIP, not in the store file —
  // so a store the registry has never heard of counts as unowned by default.
  // That is what makes a NEW persisted store fail the gate rather than join it.
  const unowned = DETECTORS.unownedPersistedStores;
  ok('unownedPersistedStores: an undeclared persisted store counts as unowned',
    unowned('export const useThingStore = create()(persist((set) => ({}), { name: "t" }));',
      'store/thingStore.ts') === 1);
  ok('unownedPersistedStores: a store the registry gives an owner does not count',
    unowned('export const useProfileStore = create()(persist((set) => ({}), { name: "p" }));',
      'store/profileStore.ts') === 0);
  ok('unownedPersistedStores: ignores a store with no persistence',
    unowned('export const useThingStore = create()((set) => ({}));',
      'store/thingStore.ts') === 0);
  ok('unownedPersistedStores: ignores files outside src/store',
    unowned('persist((set) => ({}), { name: "t" })', 'utils/thing.ts') === 0);
}

console.log('\n[8] The census records the sequencing Sam ruled');
{
  const byId = new Map(LEGACY_UNIT_CENSUS.map((u) => [u.id, u]));

  const lr1 = byId.get('LR-1');
  const lr2 = byId.get('LR-2');
  ok('LR-1 and LR-2 are both present', !!lr1 && !!lr2);
  ok('LR-1 and LR-2 carry the same sequencing note',
    !!lr1?.sequence && lr1.sequence === lr2?.sequence,
    'Sam ruled they run together; a census that lets them drift apart loses the ruling');

  const lr6 = byId.get('LR-6');
  ok('LR-6 is a standing STOP', lr6?.status === 'stop',
    'no coach-pipeline work before its reassessment is written and approved');
  ok('LR-6 says what the stop blocks', !!lr6?.sequence && lr6.sequence.length > 0);

  const inFlight = LEGACY_UNIT_CENSUS.filter((u) => u.status === 'in_flight');
  ok('in-flight units are marked so they are not double-scheduled', inFlight.length > 0,
    'LR-10 was in the concurrent lane when the census landed');
}

const total = passed + failures.length;
console.log(`\nLegacy reckoning census: passed=${passed}/${total} failures=${failures.length}`);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
