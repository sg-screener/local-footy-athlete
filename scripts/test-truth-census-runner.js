#!/usr/bin/env node
'use strict';

const { execFileSync, spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = process.env.TEST_TRUTH_CENSUS_REPO
  ? path.resolve(process.env.TEST_TRUTH_CENSUS_REPO)
  : path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = { failures: null, out: null, jobs: 4, timeoutMs: 180000 };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--failures') args.failures = argv[++i];
    else if (argv[i] === '--out') args.out = argv[++i];
    else if (argv[i] === '--jobs') args.jobs = Number(argv[++i]);
    else if (argv[i] === '--timeout-ms') args.timeoutMs = Number(argv[++i]);
    else throw new Error(`unknown argument ${argv[i]}`);
  }
  if (!args.failures || !args.out) throw new Error('--failures and --out are required');
  if (!Number.isInteger(args.jobs) || args.jobs < 1) throw new Error('--jobs must be positive');
  if (!Number.isInteger(args.timeoutMs) || args.timeoutMs < 1000) {
    throw new Error('--timeout-ms must be at least 1000');
  }
  return args;
}

function gitValue(args) {
  try {
    return execFileSync('git', args, { cwd: REPO, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function world() {
  return {
    cwd: REPO,
    head: gitValue(['rev-parse', '--short', 'HEAD']),
    tree: gitValue(['status', '--porcelain']) ? 'dirty' : 'clean',
  };
}

function classifyLog(exit, timedOut, source) {
  if (timedOut) return 'timed_out';
  if (exit === 0) return 'green_now';
  const printedAssertion = /(?:^|\n)\s*(?:PASS|FAIL)\b|passed,\s*\d+ failed|failures?=\d+/i.test(source);
  const startupSignature = /Cannot find module|MODULE_NOT_FOUND|ERR_MODULE_NOT_FOUND|is not a function|Cannot read propert(?:y|ies)|undefined.*(?:call|filter|map|prohibits)|ENOENT/i.test(source);
  if (!printedAssertion && startupSignature) return 'startup_failure';
  if (printedAssertion) return 'assertion_or_late_runtime_failure';
  return 'runtime_failure';
}

function runSuite(label, command, logDir, timeoutMs) {
  return new Promise((resolve) => {
    const started = Date.now();
    const logPath = path.join(logDir, `${label.replace(/[:/]/g, '_')}.log`);
    const output = fs.createWriteStream(logPath);
    const child = spawn('npm', ['run', label], {
      cwd: REPO,
      env: { ...process.env, TZ: 'Australia/Melbourne' },
    });
    let timedOut = false;
    let closed = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => { if (!closed) child.kill('SIGKILL'); }, 3000);
    }, timeoutMs);
    child.stdout.pipe(output);
    child.stderr.pipe(output);
    child.on('error', (error) => output.write(`\nCENSUS RUNNER: ${error.message}\n`));
    child.on('close', (code, signal) => {
      closed = true;
      clearTimeout(timer);
      output.end(() => {
        const source = fs.readFileSync(logPath, 'utf8');
        const exit = code === null ? 128 : code;
        resolve({
          label,
          command,
          exit,
          signal: signal || null,
          timedOut,
          ms: Date.now() - started,
          evidenceKind: classifyLog(exit, timedOut, source),
          log: path.relative(REPO, logPath),
          tail: source.split(/\r?\n/).filter(Boolean).slice(-12),
        });
      });
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
  const labels = [...new Set(fs.readFileSync(path.resolve(args.failures), 'utf8')
    .split(/\r?\n/).map((line) => line.trim()).filter(Boolean))];
  const aggregate = new Set(labels.filter((label) =>
    /(?:^|\s)node\s+scripts\/bible-runner\.js\b/.test(pkg.scripts[label] || '')));
  const missing = labels.filter((label) => !pkg.scripts[label]);
  const runnable = labels.filter((label) => pkg.scripts[label] && !aggregate.has(label));
  const outPath = path.resolve(args.out);
  const logDir = path.join(path.dirname(outPath), `${path.basename(outPath, '.json')}-logs`);
  fs.mkdirSync(logDir, { recursive: true });
  const startedWorld = world();
  const results = [
    ...missing.map((label) => ({ label, evidenceKind: 'missing_command', exit: null, ms: 0 })),
    ...[...aggregate].map((label) => ({ label, evidenceKind: 'aggregate', exit: null, ms: 0 })),
  ];

  console.log(`CENSUS WORLD: head=${startedWorld.head} tree=${startedWorld.tree} cwd=${startedWorld.cwd}`);
  console.log(`CENSUS INPUT: ${labels.length} distinct failure labels; ${runnable.length} runnable; ${missing.length} missing; ${aggregate.size} aggregate`);
  console.log(`CENSUS WORKERS: ${args.jobs} of ${os.cpus().length} cores; timeout=${args.timeoutMs}ms per suite`);

  const queue = runnable.slice();
  let completed = 0;
  async function worker() {
    while (queue.length) {
      const label = queue.shift();
      const result = await runSuite(label, pkg.scripts[label], logDir, args.timeoutMs);
      results.push(result);
      completed += 1;
      console.log(`  ${completed}/${runnable.length} ${result.evidenceKind} ${label} ${(result.ms / 1000).toFixed(1)}s`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(args.jobs, runnable.length) }, () => worker()));

  results.sort((a, b) => labels.indexOf(a.label) - labels.indexOf(b.label));
  const finishedWorld = world();
  const counts = results.reduce((memo, result) => {
    memo[result.evidenceKind] = (memo[result.evidenceKind] || 0) + 1;
    return memo;
  }, {});
  const payload = {
    schemaVersion: 1,
    input: path.resolve(args.failures),
    startedWorld,
    finishedWorld,
    stableWorld: startedWorld.head === finishedWorld.head,
    jobs: args.jobs,
    timeoutMs: args.timeoutMs,
    counts,
    results,
  };
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`CENSUS RESULT: ${JSON.stringify(counts)} stableWorld=${payload.stableWorld}`);
  console.log(`CENSUS OUTPUT: ${outPath}`);
  process.exitCode = payload.stableWorld ? 0 : 2;
}

main().catch((error) => {
  console.error(`CENSUS ABORT: ${error.message}`);
  process.exitCode = 2;
});
