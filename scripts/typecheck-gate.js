#!/usr/bin/env node
/**
 * Typecheck gate.
 *
 * `npm run typecheck` used to check `App.tsx` and nothing else — `tsconfig.json`
 * sets `"files": ["App.tsx"]`, which overrides `include` entirely, so the bulk
 * of `src/` was never type-checked and a 136-error backlog accumulated
 * silently. `test:compile` ran the same weak config under a second name.
 * See docs/TYPECHECK_BASELINE_TRIAGE_2026-07-24.md.
 *
 * This gate checks ALL of src across three scopes, and enforces a ratchet
 * against a checked-in baseline: a file may improve, but it may never get
 * worse, and a file with no baseline entry may have no errors at all. That
 * stops new drift immediately without demanding the whole backlog be fixed
 * first — and every remaining error is documented in the baseline with the
 * unit that owns fixing it.
 *
 * Run:  npm run test:compile
 * Update the baseline after a genuine improvement:  npm run test:compile -- --update
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const baselinePath = path.join(__dirname, 'typecheck-baseline.json');

const SCOPES = [
  { key: 'product', config: 'tsconfig.compile.json', label: 'product src (ships to athletes)' },
  { key: 'devtools', config: 'tsconfig.devtools.json', label: 'dev/E2E harness (never ships; gates device acceptance)' },
  { key: 'tests', config: 'tsconfig.tests.json', label: 'test harness (runs untyped via sucrase-node)' },
];

/** Run tsc for one scope and return a { [file]: errorCount } map. */
function collect(config) {
  let output = '';
  let failed = false;
  try {
    output = execFileSync(
      'npx',
      ['tsc', '--noEmit', '-p', config],
      { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 },
    );
  } catch (error) {
    // tsc exits non-zero whenever there are errors; that is the normal path here.
    failed = true;
    output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
  }
  const counts = {};
  for (const line of output.split('\n')) {
    const match = line.match(/^(.+?)\((\d+),(\d+)\): error TS/);
    if (!match) continue;
    counts[match[1]] = (counts[match[1]] ?? 0) + 1;
  }
  // A missing compiler, malformed project or global diagnostic is not a clean
  // source tree. Never turn an unparseable failure into an empty green count.
  if ((failed && Object.keys(counts).length === 0) ||
      output.split('\n').some((line) => /error TS\d+/.test(line) && !/^.+?\(\d+,\d+\): error TS/.test(line))) {
    throw new Error(`Typecheck did not produce a complete file-level result for ${config}:\n${output}`);
  }
  return counts;
}

const updating = process.argv.includes('--update');
const baseline = fs.existsSync(baselinePath)
  ? JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
  : {};

const regressions = [];
const improvements = [];
const next = { ...baseline };
let total = 0;

for (const scope of SCOPES) {
  const counts = collect(scope.config);
  const scopeTotal = Object.values(counts).reduce((sum, n) => sum + n, 0);
  total += scopeTotal;
  const known = baseline.scopes?.[scope.key]?.files ?? {};

  for (const [file, count] of Object.entries(counts)) {
    const allowed = known[file] ?? 0;
    if (count > allowed) {
      regressions.push(
        `  [${scope.key}] ${file}: ${count} error(s), baseline allows ${allowed}` +
        (allowed === 0 ? '  ← NEW file with errors' : ''),
      );
    } else if (count < allowed) {
      improvements.push(`  [${scope.key}] ${file}: ${allowed} → ${count}`);
    }
  }
  for (const [file, allowed] of Object.entries(known)) {
    if (!counts[file]) improvements.push(`  [${scope.key}] ${file}: ${allowed} → 0 (clean)`);
  }

  next.scopes = next.scopes ?? {};
  next.scopes[scope.key] = {
    ...(baseline.scopes?.[scope.key] ?? {}),
    label: scope.label,
    config: scope.config,
    total: scopeTotal,
    files: counts,
  };
  console.log(`${scope.key.padEnd(9)} ${String(scopeTotal).padStart(4)} error(s)  — ${scope.label}`);
}

console.log(`${'TOTAL'.padEnd(9)} ${String(total).padStart(4)} error(s) against baseline\n`);

if (updating && regressions.length === 0) {
  next.generatedAt = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(baselinePath, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`Baseline written to ${path.relative(repoRoot, baselinePath)}`);
  process.exit(0);
}

if (updating) console.error('Baseline update refused: existing regressions must not become new allowances. No baseline was written.');

if (improvements.length > 0) {
  console.log(`${improvements.length} file(s) improved since the baseline:`);
  console.log(improvements.slice(0, 20).join('\n'));
  if (improvements.length > 20) console.log(`  …and ${improvements.length - 20} more`);
  console.log('\nRun `npm run test:compile -- --update` to lock the improvement in.\n');
}

if (regressions.length > 0) {
  console.error(
    `TYPECHECK GATE FAILED — ${regressions.length} file/scope pair(s) got worse.` +
    '\nA file imported by more than one scope is reported once per scope it breaks in.\n',
  );
  console.error(regressions.join('\n'));
  console.error(
    '\nFix the new errors, or — if this is a deliberate, documented exception —' +
    '\nadd it to scripts/typecheck-baseline.json with the unit that owns the fix.',
  );
  process.exit(1);
}

console.log('Typecheck gate PASSED — no file regressed against the baseline.');
