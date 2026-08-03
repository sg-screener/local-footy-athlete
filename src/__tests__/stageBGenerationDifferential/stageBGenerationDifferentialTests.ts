/**
 * Stage B generation differential — the golden gate.
 *
 * Run:        npm run test:stage-b-generation-differential
 * Regenerate: npm run test:stage-b-generation-differential -- --write
 *
 * The committed golden is the baseline every Stage B stage diffs against
 * (docs/STAGE_B_KICKOFF_ADDENDUM_2026-08-03.md §6). A red here during the
 * build is not a failure to silence — it is the harness doing its job: the
 * stage regenerates the golden IN THE SAME COMMIT, and its boundary report
 * states the prediction each diff answers to. Unpredicted movement is a stop
 * (draft §Discipline).
 *
 * Two runs are compared before the golden is consulted: a generation that is
 * not deterministic under a pinned clock cannot be differentially tested at
 * all, and that failure must name itself rather than masquerade as a diff.
 */

import { armTotalsOrRed, totalsPrinted } from '../support/totalsOrRed';

armTotalsOrRed();

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import * as fs from 'fs';
import * as path from 'path';
import { buildGenerationSnapshot, serialiseSnapshot } from './buildGenerationSnapshot';

const GOLDEN_PATH = path.join(__dirname, 'snapshot.golden.json');
const WRITE = process.argv.includes('--write');

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    pass += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  fail += 1;
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n${detail}` : ''}`);
}

function firstDivergence(left: string, right: string): string {
  const leftLines = left.split('\n');
  const rightLines = right.split('\n');
  const max = Math.max(leftLines.length, rightLines.length);
  for (let index = 0; index < max; index += 1) {
    if (leftLines[index] !== rightLines[index]) {
      return [
        `  first divergence at line ${index + 1}:`,
        `    golden:  ${leftLines[index] ?? '<absent>'}`,
        `    current: ${rightLines[index] ?? '<absent>'}`,
      ].join('\n');
    }
  }
  return '  (no line divergence — lengths differ?)';
}

console.log('-- Stage B generation differential (baseline: current main) --');

const first = serialiseSnapshot(buildGenerationSnapshot());
const second = serialiseSnapshot(buildGenerationSnapshot());

check(
  'generation is deterministic under the pinned clock (two runs byte-identical)',
  first === second,
  firstDivergence(first, second),
);

if (WRITE) {
  fs.writeFileSync(GOLDEN_PATH, first);
  console.log(`  golden written: ${GOLDEN_PATH} (${first.length} bytes)`);
  check('golden regenerated (write mode)', true);
} else {
  const goldenExists = fs.existsSync(GOLDEN_PATH);
  check('committed golden exists', goldenExists);
  if (goldenExists) {
    const golden = fs.readFileSync(GOLDEN_PATH, 'utf8');
    const identical = golden === first;
    const changedLines = identical
      ? 0
      : golden.split('\n').filter((line, index) => line !== first.split('\n')[index]).length;
    check(
      'current generation output matches the committed baseline byte for byte',
      identical,
      identical
        ? undefined
        : `  ~${changedLines} differing lines.\n${firstDivergence(golden, first)}\n`
          + '  If this movement was PREDICTED by the stage in flight: regenerate with\n'
          + '  --write in the same commit and record the prediction in the boundary\n'
          + '  report. If it was not predicted: STOP — that is the harness firing.',
    );
  }
}

console.log(`\nStage B generation differential totals: ${pass} passed, ${fail} failed`);
if (fail > 0) failures.forEach((name) => console.error(`  FAILED: ${name}`));
totalsPrinted(fail);
