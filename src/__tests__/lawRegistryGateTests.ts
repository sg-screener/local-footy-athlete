/**
 * THE LAW REGISTRY GATE — `UNENFORCED` IS RED, FROM NOW.
 *
 * ## WHAT THIS SUITE MEANS WHEN IT FAILS, AND NOBODY SHOULD MISREAD IT
 *
 * **Sam, 2026-08-10, verbatim:** *"WHY CAN'T YOU JUST MAKE SURE EVERY FUCKING
 * RULE IS FOLLOWED FROM RIGHT NOW"*.
 *
 * A red here does **NOT** mean the app broke tonight. It means **the app has
 * never been checked against N of its own rules, and from now that counts as
 * failing.** A rule with nothing watching it is a rule not followed. That is
 * the whole semantics of this gate, and it is Sam's ruling in one line.
 *
 * The registry (`src/rules/lawRegistry.ts`) shipped as DATA with 20 of 27 rows
 * `UNENFORCED` and no gate over it. That made `UNENFORCED` a resting state — a
 * backlog with a shrinking count, which is a schedule, and a schedule is the
 * seat rationing a principle Sam had already ruled. **The default is flipped
 * here: the chain is red and stays red until every law has a guard.** No
 * high-water mark, no grandfathering, no dated debt; all three were the seat's
 * softenings and all three are withdrawn.
 *
 * ## WHAT IT CHECKS
 *
 * 1. Every row is well-formed and its id is unique.
 * 2. Every `guarded` row names a script that EXISTS in `package.json`. (The
 *    registry's first mechanical read already caught a row naming
 *    `test:athlete-action-walker`, which does not exist. That is this cell.)
 * 3. Every `guarded` row's declared `chainStatus` matches `package.json`
 *    reality — a row cannot claim `in_chain` for a script the chain never runs.
 * 4. No guard sits outside `test:bible`. A check nobody runs is not a check.
 * 5. **NO ROW IS `UNENFORCED`.** The stop cell.
 *
 * ## PLACEMENT — LAST IN THE CHAIN, DELIBERATELY
 *
 * `test:bible` is an `&&` chain: the first red stops everything behind it. This
 * suite runs LAST so that a red here costs no coverage — every other suite has
 * already run and reported. The chain's verdict is red; its information is
 * intact.
 *
 * ## LIVENESS (`LAW-liveness`: a green gate is a claim)
 *
 * Every checker below is a pure function over rows, and the final cell feeds
 * each one a FABRICATED bad row and asserts it is caught. Without that, this
 * suite could go green by reading nothing at all.
 *
 * Run: npm run test:law-registry
 */

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

import fs from 'fs';
import path from 'path';

import { HUMAN_GUARDABLE_LAW_IDS, LAW_REGISTRY, type LawRow } from '../rules/lawRegistry';

let passed = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

function run(name: string, body: () => void): void {
  try {
    body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`  FAIL ${name}\n      ${error instanceof Error ? error.message : error}`);
  }
}

const repoRoot = path.resolve(__dirname, '..', '..');

// ── THE FACTS THE GATE READS ───────────────────────────────────────────────
// Derived from package.json, never transcribed. A second list is a second
// thing to forget, which is the disease the registry exists to cure.

interface ChainFacts {
  /** Every `test:*` script that exists. */
  readonly scripts: ReadonlySet<string>;
  /** Every `test:*` script the `test:bible` chain actually invokes. */
  readonly inChain: ReadonlySet<string>;
}

function readChainFacts(): ChainFacts {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
  ) as { scripts: Record<string, string> };
  const chain = pkg.scripts['test:bible'];
  assert(chain, 'test:bible is gone from package.json — the chain this gate reports against');
  const inChain = new Set<string>([...chain.matchAll(/npm run (test:[a-zA-Z0-9:-]+)/g)]
    .map((match) => match[1]));
  // `test:bible` names the chain itself; a guard that IS the chain is in it.
  inChain.add('test:bible');
  return { scripts: new Set(Object.keys(pkg.scripts)), inChain };
}

/**
 * The script a guard names. A `by` may qualify itself — `test:coach-tab-slice3
 * section [8]`, `test:bible (bibleConformance/…)` — and the leading token is
 * the runnable thing.
 */
function guardScript(by: string): string {
  const match = /^(test:[a-zA-Z0-9:-]+)/.exec(by.trim());
  return match ? match[1] : '';
}

// ── THE CHECKERS. PURE, SO THE LIVENESS CELL CAN FEED THEM MUTANTS. ────────

/** Rows missing an id, a law, a ruling site, or a complete guard. */
function malformedRows(rows: readonly LawRow[]): string[] {
  const seen = new Set<string>();
  const bad: string[] = [];
  for (const row of rows) {
    const id = row.id || '(no id)';
    if (!row.id) bad.push(`${id}: no id`);
    else if (seen.has(row.id)) bad.push(`${id}: duplicate id — rows are retired, never reused`);
    else seen.add(row.id);
    if (!row.law) bad.push(`${id}: no law sentence`);
    if (!row.ruledAt) bad.push(`${id}: no ruling site`);
    // Read LOOSELY on purpose: the gate must be able to see a state that the
    // type says cannot exist, because a hand-edited row is exactly how a third
    // state would arrive.
    const guard = row.guard as {
      state?: string; by?: string; chainStatus?: string; receipt?: string; wouldTake?: string;
      humanGuard?: string;
    } | undefined;
    if (!guard) {
      bad.push(`${id}: no guard — there is no third state`);
      continue;
    }
    if (guard.state === 'guarded') {
      if (!guard.by) bad.push(`${id}: guarded by nothing named`);
      // THE NAMED HUMAN INSTRUMENT (Sam, 2026-08-10) — allowed ONLY where the
      // SUBJECT of the law is the conversation itself, and the allow-list is
      // what stops it becoming the general escape hatch he warned about. A row
      // reaching for it from outside that set is a re-wording failure, and the
      // reason it is checked HERE is that a hand-edited row is exactly how one
      // would arrive.
      if (guard.humanGuard) {
        if (!HUMAN_GUARDABLE_LAW_IDS.includes(row.id)) {
          bad.push(`${id}: humanGuard on a law whose subject is not the conversation `
            + '— re-word it onto a repo surface instead');
        }
        if (guard.chainStatus !== 'human') {
          bad.push(`${id}: a human guard declares chainStatus 'human', never a chain claim`);
        }
        if (guard.by !== guard.humanGuard) {
          bad.push(`${id}: a human guard is guarded BY the person it names`);
        }
      } else if (guard.chainStatus === 'human') {
        bad.push(`${id}: chainStatus 'human' without a named person is nobody guarding it`);
      } else if (guard.chainStatus !== 'in_chain' && guard.chainStatus !== 'outside_chain') {
        bad.push(`${id}: guarded with no chainStatus`);
      }
      if (!guard.receipt) bad.push(`${id}: guarded with no receipt — a row without one is a belief`);
    } else if (guard.state === 'UNENFORCED') {
      if (!guard.wouldTake) bad.push(`${id}: UNENFORCED with no line on what a guard would take`);
      if (!guard.receipt) bad.push(`${id}: UNENFORCED with no receipt for the absence`);
    } else {
      bad.push(`${id}: state ${String(guard.state)} is not one of the two`);
    }
  }
  return bad;
}

/** Guards naming a script that does not exist. The row-that-caught-itself cell. */
function guardsNamingMissingScripts(rows: readonly LawRow[], facts: ChainFacts): string[] {
  return rows
    .filter((row) => row.guard.state === 'guarded')
    // A named human is not a script and must not be looked for in package.json.
    // Its own well-formedness is checked above, where the allow-list lives.
    .filter((row) => !(row.guard as { humanGuard?: string }).humanGuard)
    .filter((row) => {
      const script = guardScript((row.guard as { by: string }).by);
      return !script || !facts.scripts.has(script);
    })
    .map((row) => `${row.id} names ${(row.guard as { by: string }).by}`);
}

/** Guards whose declared `chainStatus` disagrees with package.json. */
function misdeclaredChainStatus(rows: readonly LawRow[], facts: ChainFacts): string[] {
  return rows
    .filter((row) => row.guard.state === 'guarded')
    .filter((row) => !(row.guard as { humanGuard?: string }).humanGuard)
    .filter((row) => {
      const guard = row.guard as { by: string; chainStatus: string };
      const script = guardScript(guard.by);
      if (!facts.scripts.has(script)) return false; // owned by the cell above
      const actual = facts.inChain.has(script) ? 'in_chain' : 'outside_chain';
      return guard.chainStatus !== actual;
    })
    .map((row) => {
      const guard = row.guard as { by: string; chainStatus: string };
      const actual = facts.inChain.has(guardScript(guard.by)) ? 'in_chain' : 'outside_chain';
      return `${row.id} declares ${guard.chainStatus}, package.json says ${actual}`;
    });
}

/** Guards the chain never runs. A check nobody runs is not a check. */
function guardsOutsideTheChain(rows: readonly LawRow[], facts: ChainFacts): string[] {
  return rows
    .filter((row) => row.guard.state === 'guarded')
    .filter((row) => {
      const script = guardScript((row.guard as { by: string }).by);
      return facts.scripts.has(script) && !facts.inChain.has(script);
    })
    .map((row) => `${row.id} → ${(row.guard as { by: string }).by}`);
}

/** The laws with nothing holding them. THE STOP. */
function unenforcedIds(rows: readonly LawRow[]): string[] {
  return rows.filter((row) => row.guard.state === 'UNENFORCED').map((row) => row.id);
}

// ── THE `ruledAt` RESOLVER ─────────────────────────────────────────────────
//
// SIGHTING 5 IN ONE DAY of `order-cites-a-mechanism-that-is-not-there`:
// `test:athlete-action-walker` (a guard script that does not exist),
// `AGENTS.md "Test Standard"` (a section that does not carry its law),
// "Training Bible, Move rules" (no such section), "the sweep rule" (a law cited
// by its violations and never stated), "the clean-reset path" (a door with zero
// product callers). **A row's `by` was already resolved by this gate; its
// `ruledAt` was not, and every one of those five is a citation that does not
// resolve.** This is the compression.
//
// AND IT HAS A LIVE CONSEQUENCE, not a theoretical one: eleven rows cite
// docs/MASTER_PLAN_2026-07-23.md because Process Law L1–L10 lives there, and a
// concurrent session is moving that file to docs/_to_delete/. Without this
// cell, ten laws would quietly start citing a file that is gone.

/** A row whose law is knowingly NOT written down anywhere in the repo. */
const NOT_IN_REPO_MARKER = 'NOT STATED IN THE REPO';

/** Repo paths named in a citation, in the shapes citations actually use. */
function citedPaths(ruledAt: string): string[] {
  return [...ruledAt.matchAll(/(?:[A-Za-z0-9_.\-/]+\/)?[A-Za-z0-9_.\-]+\.(?:md|ts|tsx|json|sh)\b/g)]
    .map((match) => match[0])
    // A bare `X.md` with no directory is only a path if it sits at the root.
    .filter((candidate) => candidate.includes('/') || fs.existsSync(path.join(repoRoot, candidate)));
}

/** Rows citing a path that does not exist. */
function citationsThatDoNotResolve(rows: readonly LawRow[]): string[] {
  const bad: string[] = [];
  for (const row of rows) {
    for (const cited of citedPaths(row.ruledAt)) {
      const direct = path.join(repoRoot, cited);
      // A citation may name a file by basename under docs/ or src/.
      if (fs.existsSync(direct)) continue;
      bad.push(`${row.id} cites ${cited}`);
    }
  }
  return bad;
}

/** Rows whose citation names no resolvable file and no honest absence marker. */
function citationsWithNoSource(rows: readonly LawRow[]): string[] {
  return rows
    .filter((row) => !row.ruledAt.includes(NOT_IN_REPO_MARKER))
    .filter((row) => citedPaths(row.ruledAt).length === 0)
    .map((row) => `${row.id}: "${row.ruledAt.slice(0, 60)}…"`);
}

// ── THE INVERSE SWEEP: GUARDS WITH NO LAW ──────────────────────────────────
//
// LAW ZERO's BLIND SPOT, found 2026-08-10 by the frozen-coach deletion census.
// This registry finds a LAW WITH NO GUARD. Until now nothing found a GUARD WITH
// NO LAW — and one was a step from vanishing: `LR-6` ("the coach pipeline stays
// frozen") is named in FIFTEEN chain suites and had no row, so retiring its gate
// would have erased a live standing rule with nothing noticing.
//
// So: every rule identifier a chain suite NAMES must resolve to a registry row.
// Measured on the day this landed: **34 distinct identifiers across 175 chain
// suites, 13 with a row and 21 without.** The 21 are carried as a NAMED, DATED
// exception list with a ratchet — an id leaves by gaining a row, and **nothing
// may join it**. Same shape the NOT-COVERED debt uses next door.

/** Rule ids as this repo writes them: LR-29, L-C4, L-P2, L13. */
const RULE_ID_PATTERN = /\b(LR-\d+|L-C\d+|L-[A-Z]\d+|L1[0-6])\b/g;

/**
 * The 21 identifiers chain suites named on 2026-08-10 with no registry row.
 * **THIS LIST MAY ONLY SHRINK.** Each is a rule some suite believes it is
 * enforcing, which nothing in the registry knows about.
 */
const RULE_IDS_WITHOUT_A_ROW: readonly string[] = [
  'L-P0', 'L-P1', 'L-P2', 'L-P3', 'L-P4', 'L-P5', 'L-P7', 'L-P8',
  'LR-1', 'LR-2', 'LR-3', 'LR-4', 'LR-8', 'LR-10', 'LR-13', 'LR-14',
  'LR-23', 'LR-26', 'LR-27', 'LR-29',
];

/** Every rule identifier named by a suite the chain actually runs. */
function ruleIdsNamedByChainSuites(): Map<string, string[]> {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
  ) as { scripts: Record<string, string> };
  const chain = pkg.scripts['test:bible'];
  const suiteFiles = new Set<string>(
    [...chain.matchAll(/sucrase-node (src\/\S+\.ts)/g)].map((m) => m[1]));
  for (const name of [...chain.matchAll(/npm run (test:[a-zA-Z0-9:-]+)/g)].map((m) => m[1])) {
    const match = /(src\/\S+\.ts)/.exec(pkg.scripts[name] ?? '');
    if (match) suiteFiles.add(match[1]);
  }
  // THIS SUITE EXCLUDES ITSELF, AND MUTATION TESTING IS WHAT FOUND OUT WHY.
  // `test:law-registry` is a chain member, so this file was scanning its own
  // source — and `RULE_IDS_WITHOUT_A_ROW` below IS a list of those ids. Every
  // entry therefore named itself, landed in `missing`, and **the ratchet could
  // never fire**: a phantom entry survived. Same shape as the totals-or-red
  // suite reading its own comments. A gate that reads sources must not read the
  // source that lists what it is looking for.
  const found = new Map<string, string[]>();
  for (const file of suiteFiles) {
    const full = path.join(repoRoot, file);
    if (!fs.existsSync(full) || full === __filename) continue;
    for (const match of fs.readFileSync(full, 'utf8').matchAll(RULE_ID_PATTERN)) {
      const list = found.get(match[1]) ?? [];
      if (!list.includes(file)) list.push(file);
      found.set(match[1], list);
    }
  }
  return found;
}

/**
 * Pure: which named ids the registry does not know about.
 * `L-C4` and `LAW-LC4-parity` are the same rule written two ways, so the
 * hyphen-stripped form counts as a resolution.
 */
function ruleIdsWithNoRow(named: Iterable<string>, registrySource: string): string[] {
  return [...named]
    .filter((id) => !registrySource.includes(id) && !registrySource.includes(id.replace(/-/g, '')))
    .sort();
}

// ── THE CELLS ──────────────────────────────────────────────────────────────

const FACTS = readChainFacts();

run('the registry is non-empty and every row is well-formed', () => {
  assert(LAW_REGISTRY.length > 0, 'LAW_REGISTRY is empty — this gate would be vacuous');
  const bad = malformedRows(LAW_REGISTRY);
  assert(bad.length === 0, `malformed row(s):\n      ${bad.join('\n      ')}`);
});

run('every guard names a script that EXISTS', () => {
  const missing = guardsNamingMissingScripts(LAW_REGISTRY, FACTS);
  assert(missing.length === 0,
    `guard(s) naming a script package.json does not have: ${missing.join('; ')}. `
    + 'A law "guarded" by a nonexistent script is an UNENFORCED law wearing a receipt.');
});

run('every guard declares its chain membership truthfully', () => {
  const wrong = misdeclaredChainStatus(LAW_REGISTRY, FACTS);
  assert(wrong.length === 0, `chainStatus disagrees with the chain: ${wrong.join('; ')}`);
});

run('no guard sits outside the bible chain', () => {
  const outside = guardsOutsideTheChain(LAW_REGISTRY, FACTS);
  assert(outside.length === 0,
    `guard(s) the chain never runs: ${outside.join('; ')}. `
    + 'Add the script to test:bible or the row is not guarded.');
});

run('every `ruledAt` names a file that EXISTS', () => {
  const bad = citationsThatDoNotResolve(LAW_REGISTRY);
  assert(bad.length === 0,
    `citation(s) pointing at a file that is not there: ${bad.join('; ')}. `
    + 'A law whose ruling site cannot be opened is a law nobody can check the row against.');
});

run('every `ruledAt` resolves to a repo file, or says plainly that it does not', () => {
  const bad = citationsWithNoSource(LAW_REGISTRY);
  assert(bad.length === 0,
    `citation(s) naming no resolvable file: ${bad.join('; ')}. `
    + `Either cite a path, or write "${NOT_IN_REPO_MARKER}" and say what a ruling site would take. `
    + '"Training Bible, Move rules" was this cell\'s founding case — there is no such section.');
});

run('no chain suite names a rule the registry has never heard of', () => {
  const named = ruleIdsNamedByChainSuites();
  assert(named.size > 10, `only ${named.size} rule ids found across the chain — the scan is not reading the suites`);
  const registrySource = fs.readFileSync(
    path.join(repoRoot, 'src', 'rules', 'lawRegistry.ts'), 'utf8');
  const missing = ruleIdsWithNoRow(named.keys(), registrySource);
  const unexpected = missing.filter((id) => !RULE_IDS_WITHOUT_A_ROW.includes(id));
  assert(unexpected.length === 0,
    `chain suite(s) enforce rule(s) with NO registry row: `
    + `${unexpected.map((id) => `${id} (${named.get(id)?.length} suites)`).join(', ')}. `
    + 'A guard with no law is how a rule disappears when its gate is retired — LR-6 was one step from exactly that.');
  console.log(`      (${named.size} rule ids named by chain suites; `
    + `${named.size - missing.length} have a row, ${missing.length} carried as dated debt)`);
});

run('the guards-with-no-law debt only shrinks', () => {
  // THE RATCHET. Without it the exception list becomes the place a new
  // unregistered rule hides, and the law decays one entry at a time.
  const registrySource = fs.readFileSync(
    path.join(repoRoot, 'src', 'rules', 'lawRegistry.ts'), 'utf8');
  const missing = new Set(ruleIdsWithNoRow(ruleIdsNamedByChainSuites().keys(), registrySource));
  const paid = RULE_IDS_WITHOUT_A_ROW.filter((id) => !missing.has(id));
  assert(paid.length === 0,
    `these rules gained a registry row — delete them from RULE_IDS_WITHOUT_A_ROW: ${paid.join(', ')}`);
});

// ── LAW-count-names-instrument, AND ITS FOUNDING CASE IS IN THIS REPO'S OWN
//    STANDING ORDER ─────────────────────────────────────────────────────────
//
// THE LAW: *"a number names the INSTRUMENT'S unit, not the domain noun — emit
// occurrences AND distinct."*
//
// THE LIVE VIOLATION IT IS BORN ON. `docs/SEAT_INBOX.md` item 13 — a STANDING
// order, re-read at every stop — says **"the truth is `grep -c "state:
// 'UNENFORCED'" src/rules/lawRegistry.ts`"** and adds that the terminal
// miscounted twice, "both times one low". **The grep is one HIGH.** It emits
// OCCURRENCES of a string; the domain noun is DISTINCT LAWS. They differ by
// exactly the `readonly state: 'UNENFORCED';` line in the `LawGuard` union — a
// TYPE DECLARATION, which is not a law and never was. So the two "miscounts"
// were the data-derived instrument being right.
//
// WHAT THIS CELL HOLDS, and it is an IDENTITY rather than an inequality:
//
//     occurrences - distinct === type-declaration lines
//
// An inequality (`occurrences > distinct`) would pass for any wrong reason and
// would red falsely the day the union is renamed. The identity says WHY they
// differ and reds when a NEW non-row occurrence appears — which is the only
// event that could make a future grep wrong in a new way.
run('a count names its instrument: occurrences minus distinct is exactly the type declaration', () => {
  const registrySource = fs.readFileSync(
    path.join(repoRoot, 'src', 'rules', 'lawRegistry.ts'), 'utf8');

  // The DOMAIN answer: rows, from the data.
  const distinct = unenforcedIds(LAW_REGISTRY).length;
  // The INSTRUMENT item 13 names: occurrences of a string in a file.
  const occurrences = registrySource.split(/state: 'UNENFORCED'/).length - 1;
  // The explained difference: the union member, not a law.
  const typeDeclarations =
    registrySource.split(/readonly state: 'UNENFORCED'/).length - 1;

  assert(distinct > 0,
    'no UNENFORCED rows at all — this cell would be vacuous; retire it with the last one');
  assert(occurrences === distinct + typeDeclarations,
    `the two instruments disagree by an UNEXPLAINED amount: grep sees ${occurrences} `
    + `occurrences, the data has ${distinct} laws, and only ${typeDeclarations} type `
    + `declaration(s) account for the gap. A NEW non-row occurrence has appeared, so any `
    + `report quoting a grep count is now wrong in a way nobody has named.`);
  assert(typeDeclarations >= 1,
    'the `readonly state: \'UNENFORCED\'` union member is gone — item 13\'s grep and the '
    + 'data would now agree by accident, and this cell is asserting a difference that no '
    + 'longer has a cause. Re-derive the instruction before deleting this.');

  console.log(`      (instrument check: grep ${occurrences} occurrences = `
    + `${distinct} distinct laws + ${typeDeclarations} type declaration)`);
});

run('NO LAW IS UNENFORCED', () => {
  const unenforced = unenforcedIds(LAW_REGISTRY);
  assert(unenforced.length === 0,
    `${unenforced.length} of ${LAW_REGISTRY.length} laws have NOTHING holding them.\n`
    + '      THIS RED DOES NOT MEAN THE APP BROKE TONIGHT. It means the app has\n'
    + `      never been checked against ${unenforced.length} of its own rules, and from now\n`
    + '      that counts as failing. A rule with nothing watching it is a rule\n'
    + '      not followed (Sam, 2026-08-10).\n'
    + '      The only way to clear this is to build each guard, put it in\n'
    + '      test:bible, and flip its row to `guarded`. There is no other state.\n'
    + `      UNENFORCED: ${unenforced.join(', ')}`);
});

run('LAW ZERO is held by this suite, and says so', () => {
  // Non-vacuity of the registry's own row: the gate exists, so the row that
  // demanded it may no longer read UNENFORCED.
  const zero = LAW_REGISTRY.find((row) => row.id === 'LAW-0-registry');
  assert(zero, 'LAW-0-registry has left the registry — the row this gate holds');
  assert(zero.guard.state === 'guarded',
    'LAW-0-registry still reads UNENFORCED while its guard is running');
  assert(guardScript(zero.guard.by) === 'test:law-registry',
    `LAW-0-registry names ${zero.guard.by}, not the gate that holds it`);
});

run('the checkers red on fabricated bad rows (liveness)', () => {
  // A GREEN GATE IS A CLAIM. Each checker is fed a row it must catch; if the
  // reads above were reduced to no-ops, every cell would still pass and this
  // one would not.
  const receipt = 'fabricated by the liveness cell';
  const guardedBy = (by: string, chainStatus: 'in_chain' | 'outside_chain'): LawRow => ({
    id: 'LAW-mutant', law: 'x', ruledAt: 'x',
    guard: { state: 'guarded', by, chainStatus, receipt },
  });

  const stateless = { id: 'LAW-mutant', law: 'x', ruledAt: 'x', guard: undefined } as unknown as LawRow;
  assert(malformedRows([stateless]).length > 0, 'a row with no guard state passed the shape check');

  const duplicated = guardedBy('test:bible', 'in_chain');
  assert(malformedRows([duplicated, duplicated]).length > 0, 'a duplicate id passed the shape check');

  const ghost = guardedBy('test:athlete-action-walker', 'in_chain');
  assert(guardsNamingMissingScripts([ghost], FACTS).length > 0,
    'the real 2026-08-10 bad row — a guard naming a script that does not exist — passed');

  const lying = guardedBy('test:bible:extended', 'in_chain');
  assert(FACTS.scripts.has('test:bible:extended') && !FACTS.inChain.has('test:bible:extended'),
    'the mutant no longer picks a real out-of-chain script — pick another');
  assert(misdeclaredChainStatus([lying], FACTS).length > 0, 'a false in_chain claim passed');
  assert(guardsOutsideTheChain([lying], FACTS).length > 0, 'an out-of-chain guard passed');

  const unheld: LawRow = {
    id: 'LAW-mutant', law: 'x', ruledAt: 'x',
    guard: { state: 'UNENFORCED', wouldTake: 'x', receipt },
  };
  assert(unenforcedIds([unheld]).length === 1, 'an UNENFORCED row was not counted');
  assert(unenforcedIds([guardedBy('test:bible', 'in_chain')]).length === 0,
    'a guarded row was counted as UNENFORCED — the count would never reach zero');
});

// ── THE ONLY STATUS SAM ASKED FOR ──────────────────────────────────────────

const unenforcedNow = unenforcedIds(LAW_REGISTRY);
console.log(
  `\nLAW REGISTRY: ${LAW_REGISTRY.length} rows, `
  + `${LAW_REGISTRY.length - unenforcedNow.length} guarded, `
  + `${unenforcedNow.length} UNENFORCED`);
/**
 * LAW-doc-truth — A "BUILT"/"FIXED" CLAIM CARRIES A CODE RECEIPT.
 *
 * **THIS FILE ALREADY CHECKED EVERYTHING EXCEPT THE RECEIPTS.** `every guard
 * names a script that EXISTS` and `every 'ruledAt' names a file that EXISTS`
 * hold the two structured fields. The `receipt` field — the one that actually
 * makes the claim *"BUILT `<sha>`"* — was never read by anything.
 *
 * **A COMMIT SHA IS THE ONE CITATION THAT CANNOT BE PROSE.** The first version
 * of this cell also resolved file paths out of receipts and immediately
 * produced a FALSE POSITIVE: `LAW-one-startup-command`'s receipt says *"a
 * FABRICATED `scripts/tmp-rival-start.sh` reds it"* — describing a mutation
 * fixture that was deliberately temporary, not claiming a file exists. **A
 * receipt is free prose and a path inside it may be hypothetical; a sha is
 * always a claim about history.** So the scope is shas, and it is narrow on
 * purpose rather than by accident.
 *
 * FAILURE MODE IT CATCHES: a receipt citing a commit that never landed, was
 * rebased away, or was copied from another branch — a law that reads GUARDED
 * and whose evidence does not exist.
 */
function receiptShasThatDoNotResolve(
  rows: readonly LawRow[],
  resolves: (sha: string) => boolean,
): string[] {
  const bad: string[] = [];
  for (const row of rows) {
    const receipt = String((row.guard as { receipt?: string }).receipt ?? '');
    // 7-40 hex chars standing alone. Bounded by non-hex so a word like
    // "deadbeefcafe" inside a longer token is not pulled in.
    for (const match of receipt.matchAll(/\b([0-9a-f]{7,40})\b/g)) {
      const sha = match[1];
      if (!resolves(sha)) bad.push(`${row.id} cites ${sha}`);
    }
  }
  return bad;
}

run('LAW-doc-truth: every commit a law receipt cites EXISTS', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { execFileSync } = require('child_process') as typeof import('child_process');
  const repoRootDir = path.resolve(__dirname, '../..');
  // execFileSync, not execSync: no shell, so the sha is passed as an argument
  // rather than interpolated into a command string. The regex above already
  // restricts it to hex, but a gate is the wrong place to rely on that.
  const resolves = (sha: string): boolean => {
    try {
      execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], {
        cwd: repoRootDir,
        stdio: 'ignore',
      });
      return true;
    } catch {
      return false;
    }
  };
  // NON-VACUITY FIRST: if no receipt cites a sha, this cell proves nothing and
  // must say so rather than reporting a comfortable zero.
  const cited = LAW_REGISTRY.reduce((n, row) => n
    + [...String((row.guard as { receipt?: string }).receipt ?? '')
      .matchAll(/\b([0-9a-f]{7,40})\b/g)].length, 0);
  assert(cited > 0, 'no law receipt cites a commit at all — this cell is vacuous');

  const bad = receiptShasThatDoNotResolve(LAW_REGISTRY, resolves);
  assert(bad.length === 0,
    `law receipt(s) citing a commit that does not exist: ${bad.join('; ')}. `
    + 'A receipt is the difference between a guarded law and a claim; one that '
    + 'names a commit nobody can open is the second wearing the first.');
  console.log(`      (${cited} commit citation(s) across ${LAW_REGISTRY.length} receipts, all resolve)`);
});

run('LAW-doc-truth: the receipt checker reds on a fabricated sha (liveness)', () => {
  const never = () => false;
  const always = () => true;
  const withSha = [{ id: 'LAW-x', guard: { receipt: 'BUILT abc1234 on a real day.' } }] as never;
  assert(receiptShasThatDoNotResolve(withSha, never).length === 1,
    'a receipt citing an unresolvable commit was not caught — the cell is vacuous');
  assert(receiptShasThatDoNotResolve(withSha, always).length === 0,
    'a receipt citing a REAL commit was flagged — the cell reds on the wrong thing');
  const noSha = [{ id: 'LAW-y', guard: { receipt: 'BUILT 2026-08-13, proven by hand.' } }] as never;
  assert(receiptShasThatDoNotResolve(noSha, never).length === 0,
    'a receipt citing no commit was pulled into scope — a date is not a sha');
  // The false positive that shaped the scope: a PATH inside a receipt is prose
  // and may be hypothetical. It must never be resolved as evidence.
  const fixture = [{
    id: 'LAW-z',
    guard: { receipt: 'a fabricated scripts/tmp-rival-start.sh reds it' },
  }] as never;
  assert(receiptShasThatDoNotResolve(fixture, never).length === 0,
    'a mutation-fixture PATH was treated as a receipt claim — that is the false '
    + 'positive this cell was scoped to avoid');
});

console.log(`law registry gate totals: ${passed} passed, ${failures.length} failed`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
