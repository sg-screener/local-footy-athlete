/**
 * THE TWENTY-SECOND LAUNCH CANNOT HAPPEN — and this cell is why it stays that
 * way.
 *
 * ## The question, and where it came from
 *
 * `docs/STOP_2026-08-12_ACCEPTED_STATE_TRANSACTIONS_COST.md` §6 closed on an
 * OPEN-UNKNOWN, and it was the most alarming line in the document:
 *
 *   > `canonicaliseHydratedProgram` runs on hydration of a LEGACY program. If a
 *   > real device carrying a pre-Contract-v2 program hits the same 20-second
 *   > canonicalisation, this is a twenty-second LAUNCH, not a slow test.
 *   > **Nothing here measured a device.**
 *
 * `AGENTS.md` makes that question blocking rather than a footnote: *"could an
 * athlete hit this with the program they are already carrying?"*
 *
 * ## THE ANSWER IS NO, AND THE REASON IS THE NORTH STAR ALREADY WORKING
 *
 * The 20-second path is `canonicaliseAcceptedBoundaryState` with
 * `structuralMigrationRequired: true`. Exactly one function sets that flag —
 * `canonicaliseHydratedState` — and **it has no production caller at all**.
 * Only suites call it.
 *
 * It has none because there is nothing for it to migrate. `programStore`'s
 * `partialize` persists **inputs only** — the generation anchor, the season
 * phase clock, session feedback, weight overrides, source facts and injury
 * episodes. **`currentProgram` and `currentMicrocycle` are never written to
 * disk**, so no launch ever reads a stored program back, legacy or otherwise.
 * The week is DERIVED at boot from the decisions, which is
 * `docs/NORTH_STAR.md`'s own sentence — *store only decisions, derive
 * everything else* — and it is what makes the slow path unreachable.
 *
 * ## SO WHY GUARD IT
 *
 * Because the protection is a property of what the store PERSISTS, and that is
 * one line of `partialize` away from changing. The day someone persists
 * `currentProgram` "for a faster cold start", every launch on an older install
 * inherits a migration that measured **20.4 s and 17.9 s** — and it would
 * arrive as a mystery, because nothing else in the repo connects those two
 * facts. This cell connects them.
 *
 * Run: npm run test:legacy-migration-unreachable
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import fs from 'fs';
import path from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import { stripComments } from './support/sourceText';

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

/** Every non-test source file, as code with its own commentary stripped. */
function productionSources(): Array<{ file: string; code: string }> {
  const out: Array<{ file: string; code: string }> = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name)) continue;
      out.push({
        file: path.relative(repoRoot, full),
        code: stripComments(fs.readFileSync(full, 'utf8')),
      });
    }
  };
  walk(path.join(repoRoot, 'src'));
  assert(out.length > 100,
    `only ${out.length} production sources were walked — the walker is not `
    + 'reaching the tree and every assertion below would pass over nothing');
  return out;
}

// ── [1] NOTHING IN PRODUCTION OPENS THE MIGRATION DOOR ─────────────────────

run('no production source calls the legacy migration entry', () => {
  const callers = productionSources()
    .filter(({ file }) => file !== 'src/store/programStore.ts')
    .filter(({ code }) => /\bcanonicaliseHydratedState\s*\(/.test(code))
    .map(({ file }) => file);
  assert(callers.length === 0,
    `${callers.join(', ')} now calls \`canonicaliseHydratedState\`, the ONLY `
    + 'function that sets `structuralMigrationRequired: true`. That path was '
    + 'measured at 20.4s and 17.9s on a single week '
    + '(docs/STOP_2026-08-12_ACCEPTED_STATE_TRANSACTIONS_COST.md). If it is now '
    + 'on a launch path, the athlete waits.');
});

// ── [2] AND THERE IS NOTHING FOR IT TO MIGRATE ─────────────────────────────
//
// The deeper protection, and the one that actually holds: a stored program is
// what a migration migrates. There is no stored program.

run('the program store persists INPUTS only — never a built program', () => {
  const store = stripComments(
    fs.readFileSync(path.join(repoRoot, 'src/store/programStore.ts'), 'utf8'));
  const at = store.indexOf('partialize:');
  assert(at > -1,
    'programStore has no `partialize` — it would then persist its WHOLE state, '
    + 'including the built program, and this cell has lost its anchor '
    + '(anchoring law: prove the anchor was found)');
  const block = store.slice(at, store.indexOf('merge:', at));
  assert(block.length > 40 && block.length < 4000,
    `the partialize block extracted as ${block.length} chars — the slice found `
    + 'the wrong region and the assertions below would be meaningless');
  assert(/inputs\s*:/.test(block),
    'partialize no longer writes under an `inputs` key — the shape this cell '
    + 'reads has changed and it needs re-reading, not silencing');
  for (const derived of ['currentProgram:', 'currentMicrocycle:']) {
    assert(!new RegExp(`\\b${derived}`).test(block),
      `programStore now persists \`${derived.replace(':', '')}\`. A stored `
      + 'program is a program a future launch must MIGRATE, and that migration '
      + 'measured 20.4s on one week. It is also new stored state that is not an '
      + 'input, which docs/NORTH_STAR.md presumes wrong.');
  }
});

// ── [3] NON-VACUITY: THE CELL CAN SEE THE FIELDS IT FORBIDS ────────────────
//
// [2] is satisfied by a `partialize` this cell simply cannot read — a slice
// that missed, an empty block, a renamed key. So it is shown the same test
// against a block that DOES persist a program, and required to object.

run('the checker reds on a partialize that persists a program (liveness)', () => {
  const fabricated = 'partialize: (state) => ({ currentProgram: state.currentProgram }), merge:';
  const at = fabricated.indexOf('partialize:');
  const block = fabricated.slice(at, fabricated.indexOf('merge:', at));
  assert(/\bcurrentProgram:/.test(block),
    'the pattern this cell forbids does not match a block that plainly contains '
    + 'it — cell [2] is green because it cannot see, not because the store is '
    + 'clean');
});

console.log(`\nlegacy migration unreachable at boot: ${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log('\nFAILURES:');
  for (const failure of failures) console.log(`  - ${failure}`);
}
totalsPrinted(failed);
process.exit(failed === 0 ? 0 : 1);
