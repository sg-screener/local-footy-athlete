#!/usr/bin/env node
/**
 * bible-agreement.js — THE AGREEMENT LAW.
 *
 * Stage 1 item 3 of docs/PARALLEL_GATE_SHADOW_UNIT_2026-08-07.md:
 *
 *   "the parallel runner is trusted for nothing until it prints suite-for-suite
 *    identical totals to a serial run on the same tree, and the agreement
 *    harness itself is mutation-checked (drop one suite from the parallel set
 *    -> the agreement check must red)."
 *
 * WHY THE HARNESS IS ITSELF GATED. The vacuous-gate class has seven sightings
 * in this repo: a check that cannot fail reads exactly like a check that
 * passes. An agreement check is unusually exposed to it, because the cheapest
 * wrong implementation — compare two numbers that happen to be equal — is
 * green on the day it ships and green forever after. So this file carries a
 * MUTATION CHECK with both directions represented:
 *
 *   cell 1  identical results                 -> must AGREE   (non-vacuity)
 *   cell 2  a unit dropped from the parallel  -> must DISAGREE (the ruled cell)
 *   cell 3  one exit code flipped             -> must DISAGREE
 *   cell 4  same set, different finish ORDER  -> must AGREE   (non-vacuity:
 *           without this, "always DISAGREE" would pass cells 2 and 3)
 *   cell 5  a REAL runner pair over a short --only list, one arm run with
 *           --drop -> must DISAGREE. Cells 1-4 mutate recorded artefacts and so
 *           only test the comparator; cell 5 spends three suite runs to prove
 *           the same law through the real runner, which is the thing that would
 *           actually lose a suite.
 *
 *   node scripts/bible-agreement.js --mutation-check
 *   node scripts/bible-agreement.js --compare <serial.json> <parallel.json>
 *   node scripts/bible-agreement.js --run [--jobs N]     (runs both arms)
 *
 * Exits 0 only on agreement. Read the printed AGREEMENT_EXIT line.
 */
'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const RUNNER = path.join(__dirname, 'bible-runner.js');
const OUT_DIR = process.env.BIBLE_RUNNER_OUT || path.join(REPO, '.bible-parallel');

/**
 * The comparison. Suite-for-suite, not totals-for-totals: two runs can agree on
 * a failure COUNT while disagreeing about which suites failed, and this repo
 * has already paid for that mistake once ("a red count is a claim too" — diff
 * the failure text, never the totals).
 */
function compare(serial, parallel) {
  const problems = [];

  const serialLabels = serial.units.map((u) => u.label);
  const parallelLabels = parallel.units.map((u) => u.label);
  const serialSet = new Set(serialLabels);
  const parallelSet = new Set(parallelLabels);

  for (const label of serialLabels) {
    if (!parallelSet.has(label)) problems.push(`MISSING FROM PARALLEL: ${label}`);
  }
  for (const label of parallelLabels) {
    if (!serialSet.has(label)) problems.push(`MISSING FROM SERIAL: ${label}`);
  }

  const serialByLabel = new Map(serial.units.map((u) => [u.label, u]));
  for (const unit of parallel.units) {
    const reference = serialByLabel.get(unit.label);
    if (!reference) continue; // already reported as a set difference
    if (reference.exit !== unit.exit) {
      problems.push(`EXIT DIFFERS: ${unit.label} serial=${reference.exit} parallel=${unit.exit}`);
    }
  }

  // The chain verdict. The official gate is an `&&` chain, so what it reports
  // is the FIRST failure in chain order — the runners must agree on that too,
  // or the fast lane could agree about the set and still mislead about the gate.
  const firstFailure = (run) => {
    const failed = run.units.filter((u) => u.exit !== 0).sort((a, b) => a.index - b.index);
    return failed.length ? failed[0].label : null;
  };
  const serialFirst = firstFailure(serial);
  const parallelFirst = firstFailure(parallel);
  if (serialFirst !== parallelFirst) {
    problems.push(`FIRST_FAILURE DIFFERS: serial=${serialFirst || '(none)'} parallel=${parallelFirst || '(none)'}`);
  }

  // A run that dropped units on purpose is never an agreement, whatever it
  // otherwise matched.
  for (const run of [serial, parallel]) {
    if (run.dropped && run.dropped.length) {
      problems.push(`RUN DECLARES DROPPED UNITS: ${run.mode} dropped ${run.dropped.join(', ')}`);
    }
  }

  return {
    agree: problems.length === 0,
    problems,
    counted: serialLabels.length,
    serialFailures: serial.units.filter((u) => u.exit !== 0).map((u) => u.label),
    parallelFailures: parallel.units.filter((u) => u.exit !== 0).map((u) => u.label),
    serialFirst,
    parallelFirst,
  };
}

function report(result, serial, parallel) {
  console.log(`AGREEMENT WORLD: serial head=${serial.world.head} tree=${serial.world.tree} `
    + `| parallel head=${parallel.world.head} tree=${parallel.world.tree} jobs=${parallel.jobs}`);
  console.log(`AGREEMENT UNITS: ${result.counted} compared suite-for-suite`);
  console.log(`AGREEMENT SERIAL FAILURES  (${result.serialFailures.length}): ${result.serialFailures.join(' ') || '(none)'}`);
  console.log(`AGREEMENT PARALLEL FAILURES(${result.parallelFailures.length}): ${result.parallelFailures.join(' ') || '(none)'}`);
  console.log(`AGREEMENT FIRST_FAILURE: serial=${result.serialFirst || '(none)'} parallel=${result.parallelFirst || '(none)'}`);
  if (serial.world.head !== parallel.world.head) {
    console.log('AGREEMENT NOTE: the two arms ran at DIFFERENT HEADs — this is not an agreement on the same tree');
  }
  for (const problem of result.problems) console.log(`  DISAGREE ${problem}`);
  const speedup = serial.wallMs && parallel.wallMs
    ? (serial.wallMs / parallel.wallMs).toFixed(2) : 'n/a';
  console.log(`AGREEMENT WALL: serial=${(serial.wallMs / 1000).toFixed(1)}s parallel=${(parallel.wallMs / 1000).toFixed(1)}s speedup=${speedup}x`);
  console.log(`AGREEMENT_EXIT=${result.agree ? 0 : 1} verdict=${result.agree ? 'AGREE' : 'DISAGREE'}`);
}

function readRun(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function clone(run) {
  return JSON.parse(JSON.stringify(run));
}

/** A synthetic pair used only by the mutation cells. */
function syntheticRun(mode, jobs, units) {
  return {
    mode,
    jobs,
    world: { label: mode, cwd: REPO, head: 'mutationcheck', tree: 'clean' },
    derivedTotal: units.length,
    dropped: [],
    wallMs: 1000,
    units,
  };
}

function mutationCheck() {
  const cells = [];
  const record = (name, expected, actual, detail) => {
    const ok = expected === actual;
    cells.push({ name, expected, actual, ok, detail });
    console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name} — expected ${expected}, got ${actual}${detail ? ` (${detail})` : ''}`);
  };
  const verdict = (result) => (result.agree ? 'AGREE' : 'DISAGREE');

  const base = [
    { label: 'test:alpha', exit: 0, ms: 10, index: 0 },
    { label: 'test:beta', exit: 1, ms: 20, index: 1 },
    { label: 'test:gamma', exit: 0, ms: 30, index: 2 },
  ];

  console.log('MUTATION CHECK: the agreement harness gated against itself');

  // cell 1 — non-vacuity in the green direction.
  {
    const serial = syntheticRun('serial', 1, clone(base));
    const parallel = syntheticRun('parallel', 8, clone(base));
    record('cell 1 identical results', 'AGREE', verdict(compare(serial, parallel)));
  }

  // cell 2 — THE RULED CELL: a unit dropped from the parallel set must red.
  {
    const serial = syntheticRun('serial', 1, clone(base));
    const parallel = syntheticRun('parallel', 8, clone(base).filter((u) => u.label !== 'test:gamma'));
    const result = compare(serial, parallel);
    record('cell 2 unit dropped from parallel', 'DISAGREE', verdict(result),
      result.problems.join('; '));
  }

  // cell 3 — a verdict that differs while the set matches.
  {
    const serial = syntheticRun('serial', 1, clone(base));
    const mutated = clone(base);
    mutated[2].exit = 1;
    const parallel = syntheticRun('parallel', 8, mutated);
    const result = compare(serial, parallel);
    record('cell 3 one exit code flipped', 'DISAGREE', verdict(result), result.problems.join('; '));
  }

  // cell 4 — non-vacuity in the other direction: parallel finishes units in a
  // different ORDER by construction, and that alone must never be a
  // disagreement, or the check reds always and cells 2-3 prove nothing.
  {
    const serial = syntheticRun('serial', 1, clone(base));
    const reordered = [clone(base)[2], clone(base)[0], clone(base)[1]];
    const parallel = syntheticRun('parallel', 8, reordered);
    record('cell 4 same set, different finish order', 'AGREE', verdict(compare(serial, parallel)));
  }

  // cell 5 — the same law through the REAL runner. Cells 1-4 mutate artefacts
  // and so only exercise the comparator; this one spends three real suite runs
  // so that a runner which silently loses a unit is caught by the harness that
  // is supposed to catch it.
  {
    const only = 'test:phase-clock test:week-identity test:severity-scale';
    const dir = path.join(OUT_DIR, 'mutation');
    fs.mkdirSync(dir, { recursive: true });
    const serialOut = path.join(dir, 'serial.json');
    const parallelOut = path.join(dir, 'parallel-dropped.json');
    const run = (args) => spawnSync(process.execPath, [RUNNER, ...args], { cwd: REPO, encoding: 'utf8' });

    const a = run(['--jobs', '1', '--only', only, '--out', serialOut]);
    const b = run(['--jobs', '3', '--only', only, '--drop', 'test:severity-scale', '--out', parallelOut]);
    if (!fs.existsSync(serialOut) || !fs.existsSync(parallelOut)) {
      record('cell 5 real runner, one suite dropped', 'DISAGREE', 'NO RESULT',
        `runner did not produce both artefacts (serial exit ${a.status}, parallel exit ${b.status})`);
    } else {
      const result = compare(readRun(serialOut), readRun(parallelOut));
      record('cell 5 real runner, one suite dropped', 'DISAGREE', verdict(result),
        result.problems.join('; '));
    }
  }

  // cell 6 — the runner's own configuration gates, proven non-vacuous. The
  // wall-clock detector is what stops a future timing-asserting suite from
  // silently joining the pool; a detector that cannot fire protects nothing.
  {
    const out = spawnSync(process.execPath, [RUNNER, '--self-check'], { cwd: REPO, encoding: 'utf8' });
    record('cell 6 runner self-check (wall-clock detector fires)', 'EXIT 0',
      `EXIT ${out.status}`, (out.stdout || '').trim().split('\n').pop());
  }

  const failed = cells.filter((c) => !c.ok);
  console.log(`MUTATION RESULT: ${cells.length - failed.length} of ${cells.length} cells pass`);
  console.log(`MUTATION_EXIT=${failed.length ? 1 : 0}`);
  return failed.length ? 1 : 0;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--mutation-check')) return mutationCheck();

  const compareIndex = argv.indexOf('--compare');
  if (compareIndex !== -1) {
    const serialFile = argv[compareIndex + 1];
    const parallelFile = argv[compareIndex + 2];
    if (!serialFile || !parallelFile) throw new Error('--compare needs <serial.json> <parallel.json>');
    const serial = readRun(serialFile);
    const parallel = readRun(parallelFile);
    const result = compare(serial, parallel);
    report(result, serial, parallel);
    return result.agree ? 0 : 1;
  }

  if (argv.includes('--run')) {
    const jobsIndex = argv.indexOf('--jobs');
    const jobs = jobsIndex === -1 ? Math.max(2, os.cpus().length - 2) : Number(argv[jobsIndex + 1]);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const serialOut = path.join(OUT_DIR, 'agreement-serial.json');
    const parallelOut = path.join(OUT_DIR, 'agreement-parallel.json');
    const run = (args) => spawnSync(process.execPath, [RUNNER, ...args], { cwd: REPO, stdio: 'inherit' });
    console.log('AGREEMENT ARM 1/2: serial reference (--jobs 1)');
    run(['--jobs', '1', '--out', serialOut]);
    console.log(`AGREEMENT ARM 2/2: parallel (--jobs ${jobs})`);
    run(['--jobs', String(jobs), '--out', parallelOut]);
    const result = compare(readRun(serialOut), readRun(parallelOut));
    report(result, readRun(serialOut), readRun(parallelOut));
    return result.agree ? 0 : 1;
  }

  console.error('usage: bible-agreement.js --mutation-check | --compare <a> <b> | --run [--jobs N]');
  return 2;
}

try {
  process.exit(main());
} catch (error) {
  console.error(`AGREEMENT ABORT: ${error.message}`);
  process.exit(2);
}
