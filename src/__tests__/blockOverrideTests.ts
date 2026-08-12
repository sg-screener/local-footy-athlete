/**
 * THE ATHLETE'S WILL — `canOverride` finally has a reader, and this holds it.
 *
 * **Sam, 2026-08-12:** *"should give warnings but allow them to do whatever they
 * want"*. SEAT_INBOX item 9, layer 3.
 *
 * The field has been WRITTEN IN NINE PLACES AND READ IN NONE. Every block screen
 * showed one button labelled `OK` while the finding underneath it already said
 * whether the athlete was allowed to proceed. `mayOverrideBlock` is the reader;
 * these cells are what stop it drifting back into an inline `every(...)` in a
 * screen, which is the fifth-competing-answer shape item 9 exists to end.
 *
 * Run: npm run test:block-override
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import fs from 'fs';
import path from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import { stripComments } from './support/sourceText';
import {
  mayOverrideBlock,
  BLOCK_OVERRIDE_LABEL,
  BLOCK_KEEP_LABEL,
} from '../rules/blockOverride';

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

// ── [1] SAM'S RULING, BOTH DIRECTIONS ──────────────────────────────────────

run('a block whose every reason is overridable lets the athlete through', () => {
  assert(mayOverrideBlock([{ canOverride: true }]) === true,
    'a single overridable reason still refuses. Sam: "should give warnings but '
    + 'allow them to do whatever they want".');
  assert(mayOverrideBlock([{ canOverride: true }, { canOverride: true }]) === true,
    'two overridable reasons refuse where one allows — the rule is counting, '
    + 'not reading the field');
});

run('one physically-impossible reason still stops it', () => {
  assert(mayOverrideBlock([{ canOverride: true }, { canOverride: false }]) === false,
    'a list containing a hard stop offered a way through. One impossible reason '
    + 'among five is still impossible, and offering to proceed would promise '
    + 'something the app cannot deliver — a worse lie than the refusal.');
  assert(mayOverrideBlock([{ canOverride: false }]) === false,
    'a hard stop alone offered a way through');
});

// ── [2] THE BRANCH THAT MADE THIS A FUNCTION ──────────────────────────────
//
// `[].every(...)` is `true`. An inline check would have turned "we could not
// say why" into "go ahead" — silently, and only on the path where the app
// already failed to explain itself.

run('a block with NO stated reason is not an override', () => {
  assert(mayOverrideBlock([]) === false,
    'an empty finding list was treated as overridable. `every` on an empty '
    + 'array is TRUE, so this is the exact branch that makes the rule a named '
    + 'function instead of an inline expression.');
  assert(mayOverrideBlock(null) === false, 'null findings were treated as overridable');
  assert(mayOverrideBlock(undefined) === false, 'absent findings were treated as overridable');
});

// ── [3] THE FIELD NOW HAS A PRODUCTION READER ─────────────────────────────
//
// The debt this closes, asserted so it cannot silently reopen: `CLAUDE.md` —
// *"A field with no reader is not half-built, it is dead weight that later code
// will trust."* `canOverride` was written nine times and read zero.

run('canOverride is read in production, not only written', () => {
  const readers: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name)) continue;
      const code = stripComments(fs.readFileSync(full, 'utf8'));
      // A READ, not a write: `canOverride:` with a colon is an object literal
      // assigning it. `finding.canOverride` / `mayOverrideBlock` consume it.
      if (/mayOverrideBlock\s*\(/.test(code)) {
        readers.push(path.relative(repoRoot, full));
      }
    }
  };
  walk(path.join(repoRoot, 'src'));
  assert(readers.length >= 2,
    `only ${readers.length} production file(s) call mayOverrideBlock `
    + `(${readers.join(', ') || 'none'}). The rule needs its own module and at `
    + 'least one screen reading it, or `canOverride` is back to nine writes and '
    + 'no readers.');
  assert(readers.some((file) => /PlanChangeSheet/.test(file)),
    `the plan-change sheet does not read the rule (${readers.join(', ')}) — that `
    + 'is the screen that showed one button labelled OK, and it is the whole '
    + 'point of the reader');
});

// ── [3b] AND IT READS IT LIVE, NOT BEHIND A DISABLED GUARD ────────────────
//
// CELL [3] WAS VACUOUS AND A MUTATION CAUGHT IT. Changing the sheet to
// `override: false && mayOverrideBlock(...)` — which turns the way through OFF
// for every athlete — left [3] green, because the call still APPEARS in the
// source. A source scan asks "is this word here", and "here" is not "running".

run('the sheet assigns the way through DIRECTLY from the rule', () => {
  const sheet = stripComments(fs.readFileSync(
    path.join(repoRoot, 'src/screens/home/PlanChangeSheet.tsx'), 'utf8'));
  const at = sheet.indexOf('override:');
  assert(at > -1,
    'the `override:` assignment is gone from PlanChangeSheet — this cell has '
    + 'lost its anchor and everything below would pass over nothing');
  const assignment = sheet.slice(at, at + 120);
  assert(/^override:\s*mayOverrideBlock\s*\(/.test(assignment),
    `the way through is assigned as \`${assignment.split('\n')[0].trim()}\`. It `
    + 'must come STRAIGHT from the rule: anything between them — a `false &&`, a '
    + 'feature flag, a second condition — is a fifth answer to "is this the '
    + "athlete's will\", which is the exact shape item 9 exists to collapse.");
});

// ── [4] THE WAY THROUGH SAYS WHAT IT IS ────────────────────────────────────

run('the two controls are plainly worded and distinct', () => {
  assert(BLOCK_OVERRIDE_LABEL.trim().length > 0 && BLOCK_KEEP_LABEL.trim().length > 0,
    'a control label is empty');
  // Compared as strings: both are `const`, so TypeScript narrows them to their
  // literal types and calls a direct `!==` unintentional. The claim is about
  // the VALUES an athlete reads, which is exactly what a widened compare tests.
  assert(String(BLOCK_OVERRIDE_LABEL) !== String(BLOCK_KEEP_LABEL),
    'both controls carry the same words');
  assert(!/^ok$/i.test(BLOCK_OVERRIDE_LABEL) && !/^ok$/i.test(BLOCK_KEEP_LABEL),
    'a control is back to "OK" — the label that made a refusal look like an '
    + 'acknowledgement, which is what Sam asked to be rid of');
});

console.log(`\nblock override: ${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log('\nFAILURES:');
  for (const failure of failures) console.log(`  - ${failure}`);
}
totalsPrinted(failed);
process.exit(failed === 0 ? 0 : 1);
