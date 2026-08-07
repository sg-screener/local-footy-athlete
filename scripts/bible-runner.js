#!/usr/bin/env node
/**
 * bible-runner.js — runs the test:bible chain's units, serially or in
 * parallel, and reports a SET of per-unit exit codes.
 *
 * Stage 1 item 2 of docs/PARALLEL_GATE_SHADOW_UNIT_2026-08-07.md.
 *
 * WHY ONE RUNNER AND NOT TWO. The agreement law (stage 1 item 3) says the
 * parallel runner is trusted for nothing until it prints suite-for-suite
 * identical results to a serial run on the same tree. If serial and parallel
 * were two different programs, an agreement run would be comparing two
 * instruments as well as two concurrencies, and a disagreement could not be
 * attributed. So there is ONE runner and CONCURRENCY IS ITS ONLY VARIABLE:
 * `--jobs 1` is the serial reference, `--jobs N` is the fast lane, same list,
 * same command strings, same verdict rule.
 *
 * ONE SUITE LIST (guardrail 5). The unit list is DERIVED from
 * package.json scripts["test:bible"] by splitting the chain on `&&`. Nothing
 * is transcribed, so a suite cannot exist in one gate and not the other. Each
 * unit is executed as the chain's own literal command string — the parallel
 * runner does not resolve `npm run test:x` into its inner script, because that
 * would change the executed world and the agreement claim with it.
 *
 * WHAT THIS IS NOT. The serial `test:bible` chain short-circuits: `&&` stops
 * at the first red, so it reports ONE failure and says nothing about the
 * suites behind it. This runner runs every unit and reports the whole set,
 * like scripts/sweep.sh. It therefore prints TWO verdicts: the failure SET,
 * and FIRST_FAILURE — the unit the `&&` chain would have stopped at, which is
 * the only one directly comparable to an official gate run.
 *
 *   node scripts/bible-runner.js [--jobs N] [--out FILE] [--only "a b"] [--drop LABEL]
 *
 * Exits 0 only when every unit exited 0. Read the printed RUNNER_EXIT line;
 * nothing else in this repo is evidence of a verdict (scripts/gate.sh).
 */
'use strict';

const { spawn, execSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const OUT_DIR = process.env.BIBLE_RUNNER_OUT || path.join(REPO, '.bible-parallel');

/**
 * LANES (guardrail 6). A unit named here never runs beside another lane unit;
 * the lane is one worker that works its list in chain order. Each entry states
 * the measured reason it is here — a lane entry with no reason is a guess, and
 * guesses are what the agreement law exists to catch.
 */
const SERIAL_LANE = [
  // Spawns one CHILD PROCESS PER CASE (durableFactHorizonTests.ts:688
  // runAllForked). Its own fan-out already oversubscribes the box; pooling it
  // would multiply two concurrencies together.
  'test:fact-horizon',
  // Same shape via spentWeekFridayTestSupport.ts:235 (spawnSync per case).
  'test:injury-authority',
  'test:profile-mirror-narrowing',
  // The deep walker tier — the longest single unit in the chain by a wide
  // margin, and the one the sweep record repeatedly names as heavy.
  'test:action-walker:deep',
  // `node scripts/typecheck-gate.js` runs the TypeScript compiler over three
  // scopes; it is memory-heavy rather than merely slow.
  'test:compile',
];

/**
 * EXCLUSIVE — units that run with NOTHING ELSE IN FLIGHT.
 *
 * MEASURED, not assumed. The first full agreement run disagreed on exactly one
 * unit: chain:runSlice1 passed serially in 21.2s and FAILED under --jobs 8 in
 * 43.5s, with its own message — "Bible harness runtime 43514.4ms exceeds hard
 * ceiling 30000ms" (runSlice1.ts:63, HARD_RUNTIME_MS).
 *
 * A suite that asserts on its own WALL-CLOCK RUNTIME is measuring the machine's
 * load, not the app, so it cannot be pooled by construction — and a lane does
 * not save it either, because a lane still runs beside the pool. It needs the
 * box to itself.
 *
 * NOT FIXED BY RAISING THE CEILING. The side that moved is this runner, not the
 * app; editing a gate's expectation to match a harness change is the recorded
 * expectation-edited-to-match-the-regression defect. The ceiling is left
 * exactly where its author put it and the runner works around it.
 */
const EXCLUSIVE = [
  'chain:runSlice1',
];

/**
 * The marker that identifies the class above. A suite whose source declares a
 * runtime ceiling must be EXCLUSIVE or the runner refuses to measure — so the
 * next one to appear cannot silently join the pool and fail intermittently,
 * which is the worst possible failure mode for a commit gate.
 *
 * LIMIT, stated: this scans each unit's ENTRY file only, not its transitive
 * imports. A ceiling asserted inside a shared helper would not be caught here.
 */
const WALL_CLOCK_MARKER = /RUNTIME_MS|hard ceiling|harness runtime/;

function parseArgs(argv) {
  const args = { jobs: 1, out: null, only: null, drop: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--jobs') {
      const raw = argv[++i];
      // 'auto' leaves two cores for the OS and this process, matching the
      // concurrency every recorded agreement run was measured at or around.
      args.jobs = raw === 'auto' ? Math.max(2, os.cpus().length - 2) : Number(raw);
    }
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--only') args.only = argv[++i];
    else if (a === '--drop') args.drop.push(argv[++i]);
    else if (a === '--list') args.list = true;
    else if (a === '--self-check') args.selfCheck = true;
    else throw new Error(`bible-runner: unknown argument ${a}`);
  }
  if (!Number.isInteger(args.jobs) || args.jobs < 1) {
    throw new Error(`bible-runner: --jobs must be a positive integer, got ${args.jobs}`);
  }
  return args;
}

/**
 * Derive the chain's units. Every `&&`-separated segment is one unit — that is
 * the chain's own definition of a step, so the derivation cannot drift from it.
 */
function deriveUnits(exclusiveList = EXCLUSIVE) {
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
  const chain = pkg.scripts['test:bible'];
  if (!chain) throw new Error('bible-runner: package.json has no test:bible script');

  const segments = chain.split('&&').map((s) => s.trim()).filter(Boolean);
  const units = segments.map((command, index) => {
    const npmRun = command.match(/^npm run (test:[A-Za-z0-9:_-]+)$/);
    if (npmRun) return { label: npmRun[1], command, index, scripted: true };
    // The chain's leading command is not an `npm run` — label it by its entry
    // file rather than inventing a name, so the label follows the source.
    const file = command.match(/([A-Za-z0-9_.-]+)\.ts\b/);
    return {
      label: file ? `chain:${file[1]}` : `chain:${index}`,
      command,
      index,
      scripted: false,
    };
  });

  // ONE SUITE LIST, asserted rather than assumed: every scripted unit must name
  // a real package.json script, and no two units may share a label.
  const seen = new Set();
  for (const unit of units) {
    if (seen.has(unit.label)) {
      throw new Error(`bible-runner: duplicate unit label ${unit.label} — the chain lists it twice`);
    }
    seen.add(unit.label);
    if (unit.scripted && !pkg.scripts[unit.label]) {
      throw new Error(`bible-runner: chain runs ${unit.label} but package.json has no such script`);
    }
  }
  // A `npm run` this parser failed to recognise would silently vanish from the
  // parallel gate while still running in the serial one. Refuse to measure.
  const npmRuns = (chain.match(/npm run /g) || []).length;
  const scripted = units.filter((u) => u.scripted).length;
  if (npmRuns !== scripted) {
    throw new Error(
      `bible-runner: the chain contains ${npmRuns} 'npm run' calls but only ${scripted} `
      + 'were parsed into units — the derivation is incomplete, refusing to measure',
    );
  }
  // A lane or exclusive label that matches nothing is a policy that silently
  // does not apply — the vacuous-gate class again, this time in the runner's
  // own configuration. Refuse to measure rather than lane an empty set.
  const labels = new Set(units.map((u) => u.label));
  for (const [name, list] of [['SERIAL_LANE', SERIAL_LANE], ['EXCLUSIVE', exclusiveList]]) {
    for (const label of list) {
      if (!labels.has(label)) {
        throw new Error(`bible-runner: ${name} names '${label}', which is not a unit of the chain`);
      }
    }
  }

  // Detect the wall-clock class rather than trusting the hand-written list.
  const entryFile = (unit) => {
    const source = unit.scripted ? (pkg.scripts[unit.label] || '') : unit.command;
    const match = source.match(/(src\/[^\s'"]+\.ts)/);
    return match ? match[1] : null;
  };
  for (const unit of units) {
    if (exclusiveList.includes(unit.label)) continue;
    const file = entryFile(unit);
    if (!file) continue;
    const full = path.join(REPO, file);
    if (!fs.existsSync(full)) continue;
    if (WALL_CLOCK_MARKER.test(fs.readFileSync(full, 'utf8'))) {
      throw new Error(
        `bible-runner: ${unit.label} (${file}) asserts on its own wall-clock runtime but is not `
        + 'declared EXCLUSIVE. Under concurrency it would measure machine load, not the app, and '
        + 'fail intermittently. Add it to EXCLUSIVE with its measured reason.',
      );
    }
  }

  return units;
}

function worldLine(label) {
  let head = 'unknown';
  try {
    head = execSync('git rev-parse --short HEAD', { cwd: REPO }).toString().trim();
  } catch { /* not a git tree — reported as unknown, never guessed */ }
  let dirty = 'unknown';
  try {
    dirty = execSync('git status --porcelain', { cwd: REPO }).toString().trim() ? 'dirty' : 'clean';
  } catch { /* as above */ }
  return { label, cwd: REPO, head, tree: dirty };
}

/**
 * The chain's units are executed by npm in the official gate, and npm prepends
 * node_modules/.bin to PATH before running a script. Every `npm run test:x`
 * unit therefore gets that PATH for free — but the chain's LEADING command is a
 * bare `sucrase-node …`, and running it through a plain shell gave exit 127,
 * "command not found", in 0.0s. Both arms produced it identically, so the
 * agreement check would have called that a match: a vacuous agreement on an
 * instrument artifact, which is the exact class this unit exists to prevent.
 * So the runner reproduces npm's PATH, and treats 127 as an ABORT below.
 */
const CHILD_ENV = {
  ...process.env,
  PATH: `${path.join(REPO, 'node_modules', '.bin')}:${process.env.PATH || ''}`,
};

function runUnit(unit, logDir) {
  return new Promise((resolve) => {
    const started = Date.now();
    const logPath = path.join(logDir, `${unit.label.replace(/[:/]/g, '_')}.log`);
    const log = fs.createWriteStream(logPath);
    const child = spawn('sh', ['-c', unit.command], { cwd: REPO, env: CHILD_ENV });
    child.stdout.pipe(log);
    child.stderr.pipe(log);
    // A spawn that never starts emits 'error' and no 'close'. Unhandled, it
    // takes the whole runner down mid-measurement — which is a crash report,
    // not a result, and leaves no artefact to compare. Record it as 127 so it
    // reaches the same abort as a shell's "command not found".
    let spawnFailed = false;
    child.on('error', (error) => {
      spawnFailed = true;
      log.write(`\nRUNNER: spawn failed — ${error.message}\n`);
      log.end();
      resolve({
        label: unit.label,
        index: unit.index,
        command: unit.command,
        exit: 127,
        signal: null,
        ms: Date.now() - started,
        log: path.relative(REPO, logPath),
      });
    });
    child.on('close', (code, signal) => {
      if (spawnFailed) return;
      log.end();
      resolve({
        label: unit.label,
        index: unit.index,
        command: unit.command,
        exit: code === null ? 128 : code,
        signal: signal || null,
        ms: Date.now() - started,
        log: path.relative(REPO, logPath),
      });
    });
  });
}

/**
 * Prove the wall-clock detector FIRES. A detector that never fires is
 * indistinguishable from one that passes — the vacuous-gate class, which this
 * repo has now sighted seven times. So the detector is run once with EXCLUSIVE
 * emptied, where it must refuse, and once as configured, where it must not.
 */
function selfCheck() {
  const cells = [];
  const record = (name, ok, detail) => {
    cells.push(ok);
    console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  };

  console.log('SELF CHECK: the runner\'s own configuration gates');

  try {
    deriveUnits([]);
    record('wall-clock detector fires when EXCLUSIVE is emptied', false,
      'deriveUnits([]) returned without refusing — the detector is VACUOUS');
  } catch (error) {
    const names = /asserts on its own wall-clock runtime/.test(error.message);
    record('wall-clock detector fires when EXCLUSIVE is emptied', names, error.message.split('\n')[0]);
  }

  try {
    deriveUnits();
    record('derivation passes as configured', true, `${deriveUnits().length} units`);
  } catch (error) {
    record('derivation passes as configured', false, error.message);
  }

  const failed = cells.filter((ok) => !ok).length;
  console.log(`SELF CHECK RESULT: ${cells.length - failed} of ${cells.length} cells pass`);
  console.log(`SELF_CHECK_EXIT=${failed ? 1 : 0}`);
  return failed ? 1 : 0;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.selfCheck) return selfCheck();
  let units = deriveUnits();
  const derivedTotal = units.length;

  if (args.only) {
    const wanted = new Set(args.only.split(/\s+/).filter(Boolean));
    units = units.filter((u) => wanted.has(u.label));
    const missing = [...wanted].filter((w) => !units.some((u) => u.label === w));
    if (missing.length) throw new Error(`bible-runner: --only names units not in the chain: ${missing.join(', ')}`);
  }
  // --drop exists for the agreement harness's mutation check: a runner that
  // loses a unit must be VISIBLE as a disagreement, not absorbed.
  const dropped = [];
  if (args.drop.length) {
    for (const label of args.drop) {
      if (!units.some((u) => u.label === label)) {
        throw new Error(`bible-runner: --drop names a unit not in this run: ${label}`);
      }
      dropped.push(label);
    }
    units = units.filter((u) => !dropped.includes(u.label));
  }

  if (args.list) {
    for (const unit of units) console.log(`${unit.label}\t${unit.command}`);
    return 0;
  }

  const mode = args.jobs === 1 ? 'serial' : 'parallel';
  const world = worldLine(mode);
  const logDir = path.join(OUT_DIR, `logs-${mode}-${args.jobs}`);
  fs.mkdirSync(logDir, { recursive: true });

  console.log(
    `RUNNER WORLD: mode=${mode} jobs=${args.jobs} cwd=${world.cwd} head=${world.head} `
    + `tree=${world.tree} cores=${os.cpus().length}`,
  );
  console.log(
    `RUNNER UNITS: ${units.length} of ${derivedTotal} derived from package.json test:bible`
    + `${dropped.length ? ` (DROPPED ${dropped.join(', ')} — mutation arm)` : ''}`,
  );

  const exclusiveLabels = new Set(EXCLUSIVE);
  const laneLabels = new Set(SERIAL_LANE);
  const exclusive = units.filter((u) => exclusiveLabels.has(u.label));
  const lane = units.filter((u) => !exclusiveLabels.has(u.label) && laneLabels.has(u.label));
  const pool = units.filter((u) => !exclusiveLabels.has(u.label) && !laneLabels.has(u.label));
  if (args.jobs > 1) {
    console.log(`RUNNER EXCLUSIVE: ${exclusive.length} [${exclusive.map((u) => u.label).join(' ')}] — run alone, nothing else in flight`);
    console.log(`RUNNER LANES: serial-lane=${lane.length} [${lane.map((u) => u.label).join(' ')}] pool=${pool.length}`);
  }

  const results = [];
  const record = (r) => {
    results.push(r);
    const verdict = r.exit === 0 ? 'PASS' : `FAIL(${r.exit}${r.signal ? `/${r.signal}` : ''})`;
    console.log(`  ${verdict} ${r.label} ${(r.ms / 1000).toFixed(1)}s`);
  };

  const started = Date.now();
  if (args.jobs === 1) {
    // Serial mode ignores lanes entirely — it is the reference, and it must run
    // the chain's own order so that FIRST_FAILURE means what the `&&` chain
    // would have reported.
    for (const unit of units) record(await runUnit(unit, logDir));
  } else {
    // The exclusive phase comes FIRST and alone. It is un-parallelised wall
    // time by design — the price of keeping a wall-clock assertion meaningful.
    for (const unit of exclusive) record(await runUnit(unit, logDir));

    const queue = pool.slice();
    const laneQueue = lane.slice();
    const laneWorker = async () => {
      while (laneQueue.length) record(await runUnit(laneQueue.shift(), logDir));
    };
    const poolWorker = async () => {
      while (queue.length) record(await runUnit(queue.shift(), logDir));
    };
    const workers = [];
    if (laneQueue.length) workers.push(laneWorker());
    const poolWorkers = Math.max(1, args.jobs - (laneQueue.length ? 1 : 0));
    for (let i = 0; i < poolWorkers; i += 1) workers.push(poolWorker());
    await Promise.all(workers);
  }
  const wallMs = Date.now() - started;

  results.sort((a, b) => a.index - b.index);

  // 127 is the shell's "command not found". It is never a suite's verdict about
  // the app, so recording it as a red would put an instrument fault into a
  // measurement — and a fault reproduced in both arms reads as agreement. The
  // runner refuses to report a result at all when one appears.
  const notFound = results.filter((r) => r.exit === 127);
  if (notFound.length) {
    console.error(`RUNNER ABORT: ${notFound.length} unit(s) exited 127 (command not found), which is an`);
    console.error('  instrument fault, not a verdict. No result file written.');
    for (const r of notFound) console.error(`  ${r.label}: ${r.command} (log ${r.log})`);
    return 2;
  }

  const failures = results.filter((r) => r.exit !== 0);
  const firstFailure = failures.length ? failures[0].label : null;

  const payload = {
    mode,
    jobs: args.jobs,
    world,
    derivedTotal,
    dropped,
    wallMs,
    cpuCount: os.cpus().length,
    serialLane: SERIAL_LANE,
    units: results.map((r) => ({ label: r.label, exit: r.exit, ms: r.ms, index: r.index })),
  };
  const outPath = args.out || path.join(OUT_DIR, `results-${mode}-${args.jobs}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);

  console.log(`RUNNER RESULT: mode=${mode} jobs=${args.jobs} failures=${failures.length} of ${results.length}`);
  for (const f of failures) console.log(`  FAIL ${f.label} (log ${f.log})`);
  console.log(`RUNNER FIRST_FAILURE: ${firstFailure || '(none)'}`);
  console.log(`RUNNER WALL: ${(wallMs / 1000).toFixed(1)}s`);
  console.log(`RUNNER RESULTS_FILE: ${path.relative(REPO, outPath)}`);
  console.log(`RUNNER_EXIT=${failures.length ? 1 : 0} mode=${mode} jobs=${args.jobs}`);
  return failures.length ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (error) => { console.error(`RUNNER ABORT: ${error.message}`); process.exit(2); },
);
