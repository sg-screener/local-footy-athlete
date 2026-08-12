/**
 * COMPUTED, THEN NOT CONSUMED — the gate `HOW_TO_BUILD_THIS_APP` §4 asked for.
 *
 * > **`LAW-computed-must-be-consumed`: a value the app computes on every
 * > assessment and no code reads is not a feature, it is a rule that was
 * > SWITCHED OFF. Either wire it or delete it.**
 *
 * SEAT_INBOX item 10. §4 listed nine findings from a single day, all the same
 * shape, and proposed *"a `noUnusedWrites`-style gate over `contract.*`
 * assignments"*. This is that gate.
 *
 * ## WHY `contract.*` AND NOT EVERYTHING
 *
 * Because that family is mechanically decidable and the rest is not. A contract
 * field is assigned by name and read by name; "is this exported function ever
 * called" needs a call graph, and a gate that guesses would either miss the
 * class or drown it. **Six of §4's nine are not `contract.*` at all** — a Set
 * indexed `[0]` one line later, a decision list, a collapsed N-list — and this
 * gate does not claim them. That limit is stated rather than implied, because a
 * gate believed to be general is worse than one known to be narrow.
 *
 * ## THE FIRST RUN FOUND SIXTEEN, NOT TWO
 *
 * §4 named two `contract.*` offenders (`unavoidableAnchorCausedExcess`,
 * `achievedModerateDayCount`). Measured 2026-08-12 across 42 assigned
 * `contract.*` fields: **sixteen are written on every assessment and read by
 * nothing.** The doc's nine was a sample, not a census — which is
 * `a-count-names-instrument` again, and exactly why the gate had to measure
 * rather than encode the list it was given.
 *
 * ## HOW IT COUNTS, AND WHAT THE NUMBER MEANS
 *
 * A **write** is `contract[.path].field =` (never `==`). A **read** is any
 * `.field` occurrence that is not itself the left side of an assignment,
 * anywhere in production source. So the unit is *"textual reads of this member
 * name"*, and it is DELIBERATELY GENEROUS: a field read once, anywhere, by any
 * object, passes. A field this gate calls unconsumed is one nothing mentions at
 * all — the strongest form of the claim, and the one that cannot be argued with.
 *
 * ## THE RATCHET
 *
 * The sixteen are DECLARED below as dated debt. The gate fails when the set
 * GROWS — a new rule switched off — and it fails when a declared field gains a
 * reader without being removed from the list, so the debt cannot quietly read
 * as bigger than it is.
 *
 * Run: npm run test:computed-must-be-consumed
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import fs from 'fs';
import path from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

const repoRoot = path.join(__dirname, '..', '..');

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

function run(name: string, body: () => void): void {
  try {
    body();
    passed += 1;
  } catch (error) {
    failed += 1;
    failures.push(`${name}: ${(error as Error)?.message ?? String(error)}`);
  }
}

/**
 * KNOWN DEBT, MEASURED 2026-08-12 — every one of these is a rule switched off.
 *
 * **THIS LIST MAY ONLY SHRINK.** Each entry is a value the engine computes on
 * every assessment and no code reads. Wiring one means deleting its line here;
 * deleting the value means the same. Adding a line means a new rule was
 * switched off the day it was written, and that is what the gate is for.
 */
const UNCONSUMED_CONTRACT_FIELDS: readonly string[] = [
  // ── section18EffectiveWeekEvaluator.ts — the whole achieved-ledger family ──
  // Fourteen of the sixteen come from one module writing a rich record of what
  // the week ACHIEVED, which nothing downstream opens.
  'achievedActiveRecoveryCount',
  'achievedByStress',
  'achievedHardDayCount',
  'achievedMeaningfulMainLifts',
  // §4 named this one. Item 4 (`70eb0125`) gave the MODERATE DAY a finding, but
  // it reads `ledger.restStress.moderateDays.length` directly — this contract
  // field is still unread, which is worth knowing before someone assumes the
  // moderate-day unit closed it.
  'achievedModerateDayCount',
  'achievedSources',
  'achievedTrueFullRestCount',
  'advisoryOverSelection',
  'anchorCredit',
  'appAuthoredCoreCredit',
  'hardDayMaximumBreach',
  'legacyUnknownAchievedCount',
  'optionalNonCoreAchievedCount',
  // §4 named this one too.
  'unavoidableAnchorCausedExcess',
  // ── elsewhere ──
  'missingParticipationRemainsUnknown', // section18SafetyPolicy.ts
  'laterSessionRestorationRequired',    // userRemovalConstraints.ts
];

interface Source { readonly file: string; readonly code: string }

function productionSources(): Source[] {
  const out: Source[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name)) continue;
      out.push({ file: path.relative(repoRoot, full), code: fs.readFileSync(full, 'utf8') });
    }
  };
  walk(path.join(repoRoot, 'src'));
  return out;
}

/** Every `contract[.path].field =` assignment, and where it was first seen. */
export function assignedContractFields(sources: readonly Source[]): Map<string, string> {
  const assigned = new Map<string, string>();
  for (const { file, code } of sources) {
    for (const match of code.matchAll(
      /\bcontract(?:\.[A-Za-z_$][\w$]*)*\.([A-Za-z_$][\w$]*)\s*=(?!=)/g,
    )) {
      if (!assigned.has(match[1])) assigned.set(match[1], file);
    }
  }
  return assigned;
}

/**
 * How many times `.field` is READ across production.
 *
 * An occurrence followed by `=` (and not `==`) is the assignment itself, not a
 * read. Everything else counts, including a read of a same-named member on a
 * different object — see the header: generous on purpose.
 */
export function readCount(field: string, sources: readonly Source[]): number {
  let reads = 0;
  const pattern = new RegExp(`\\.${field}\\b`, 'g');
  for (const { code } of sources) {
    for (const match of code.matchAll(pattern)) {
      const after = code.slice(match.index! + match[0].length, match.index! + match[0].length + 4);
      if (/^\s*=(?!=)/.test(after)) continue;
      reads += 1;
    }
  }
  return reads;
}

const sources = productionSources();
const assigned = assignedContractFields(sources);
const measuredUnconsumed = Array.from(assigned.keys())
  .filter((field) => readCount(field, sources) === 0)
  .sort();

// ── [1] THE INSTRUMENT REACHED THE TREE ────────────────────────────────────

run('the scan found the contract family at all', () => {
  assert(sources.length > 100,
    `only ${sources.length} production sources walked — the walker is not `
    + 'reaching the tree and every count below is over nothing');
  assert(assigned.size > 20,
    `only ${assigned.size} \`contract.*\` assignments found. The shape this gate `
    + 'matches has changed, and a gate that matches nothing passes forever '
    + '(anchoring law: prove the anchor was found)');
});

// ── [2] NO NEW RULE MAY BE SWITCHED OFF ────────────────────────────────────

run('no contract value is computed and left unread', () => {
  const undeclared = measuredUnconsumed
    .filter((field) => !UNCONSUMED_CONTRACT_FIELDS.includes(field));
  assert(undeclared.length === 0,
    `NEW computed-and-unread contract value(s): ${undeclared.map((field) =>
      `${field} (assigned in ${assigned.get(field)})`).join(', ')}. `
    + 'A value the app computes on every assessment and no code reads is not a '
    + 'feature, it is a rule that was switched off. Either wire it or delete it '
    + '— adding it to UNCONSUMED_CONTRACT_FIELDS is not a third option.');
});

// ── [3] AND THE DEBT LIST MAY NOT OVERSTATE ITSELF ────────────────────────
//
// The other direction, and it is not pedantry: a list carrying fields that are
// now read makes the debt look bigger than it is, and the next reader prices
// work against a number that is wrong. The same ratchet every debt list here
// carries.

run('the declared debt only shrinks — a wired field leaves the list', () => {
  const stale = UNCONSUMED_CONTRACT_FIELDS
    .filter((field) => !measuredUnconsumed.includes(field));
  assert(stale.length === 0,
    `${stale.join(', ')} now has a reader (or is no longer assigned on `
    + '`contract.*`) but is still declared as unread. Delete the line: a debt '
    + 'list that overstates itself is a number the next reader will price '
    + 'against.');
});

// ── [4] THE DETECTOR REDS ON A FABRICATED OFFENDER (liveness) ──────────────
//
// Cells [2] and [3] are both satisfied by a detector that finds nothing — a
// changed assignment shape, a regex that stopped matching. This feeds it a
// value that is plainly written and plainly never read.

run('the checker reds on a fabricated switched-off rule (liveness)', () => {
  const fabricated: Source[] = [{
    file: 'src/rules/__fabricated.ts',
    code: 'contract.restStress.aRuleNobodyReads = ledger.count;\n',
  }];
  const found = assignedContractFields(fabricated);
  assert(found.get('aRuleNobodyReads') === 'src/rules/__fabricated.ts',
    'the assignment matcher did not see a plain `contract.x.y =` write — cells '
    + '[2] and [3] are green because the detector is blind, not because the '
    + 'code is clean');
  assert(readCount('aRuleNobodyReads', fabricated) === 0,
    'the read counter counted the ASSIGNMENT as a read, so every written field '
    + 'would look consumed and this gate could never fail');
  // And the opposite arm: a genuine read must be counted, or cell [3] would
  // report the whole codebase as debt.
  const withReader: Source[] = [...fabricated, {
    file: 'src/rules/__reader.ts',
    code: 'if (contract.restStress.aRuleNobodyReads > 0) { act(); }\n',
  }];
  assert(readCount('aRuleNobodyReads', withReader) === 1,
    'a plain read of the field was not counted, so wiring a value would never '
    + 'clear its debt');
});

console.log(
  `\ncomputed must be consumed: ${passed} passed, ${failed} failed`
  + ` (${assigned.size} contract.* fields assigned, ${measuredUnconsumed.length} unread)`,
);
if (failures.length) {
  console.log('\nFAILURES:');
  for (const failure of failures) console.log(`  - ${failure}`);
}
totalsPrinted(failed);
process.exit(failed === 0 ? 0 : 1);
