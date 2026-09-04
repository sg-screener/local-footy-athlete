'use strict';
/**
 * WHAT DID THIS CHANGE DO TO THE ATHLETE? — `npm run year:diff`.
 *
 * Generates a year through the preserved driver, summarises what the athlete
 * ends up with, and prints the DIFFERENCE against the committed baseline in
 * `docs/YEAR_BASELINE.json`.
 *
 * ⚠ **IT IS NOT A GATE AND MUST NOT BECOME ONE.** It answers "what did I do",
 * not "am I allowed". A test can only fail on what somebody predicted; every
 * signal that mattered on 2026-09-04 was a difference nobody had predicted:
 *
 *   - *"182 rows read as a total for a one-sided movement -> 0"*
 *   - *"the year came back BYTE-IDENTICAL, so the fix reached nothing"*
 *   - *"main lifts 16 -> 32"*
 *   - *"`Kettlebell Swings` appeared as a main lift"* — a lift that may never
 *     lead a day, which no assertion existed to catch
 *   - *"`Leg Press` went from 51 weeks to 1"*
 *
 * A NO-CHANGE RESULT IS A REAL RESULT AND IS PRINTED LOUDLY. The most expensive
 * hour of that day was spent believing a per-side fix had landed; the year said
 * "identical" and that was the whole finding.
 *
 * Run it before committing a programming change. Update the baseline with
 * `npm run year:baseline` ONLY once you have read the diff and meant it.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { summariseYearDirectory } = require('./year-summary.cjs');

const repo = path.resolve(__dirname, '..');
const BASELINE = path.join(repo, 'docs', 'YEAR_BASELINE.json');
const DRIVER = path.join(repo, 'scripts', 'run-programming-selection-trace-year.cjs');

function generate(outDir) {
  fs.rmSync(outDir, { recursive: true, force: true });
  execFileSync('node', [DRIVER, `--output=${outDir}`], { cwd: repo, stdio: 'inherit' });
  return summariseYearDirectory(outDir);
}

/** Count maps differ by ADDED, REMOVED and MOVED keys — never by key order. */
function diffCounts(before, after) {
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].sort();
  const rows = [];
  for (const key of keys) {
    const was = (before ?? {})[key];
    const now = (after ?? {})[key];
    if (was === now) continue;
    rows.push({ key, was: was ?? 0, now: now ?? 0 });
  }
  return rows;
}

function diffAthlete(before, after) {
  const out = {};
  for (const field of ['weeks', 'totalRows']) {
    if (before?.[field] !== after?.[field]) out[field] = { was: before?.[field], now: after?.[field] };
  }
  for (const field of ['dayTypes', 'rowsByRole', 'exerciseRole', 'doses']) {
    const rows = diffCounts(before?.[field], after?.[field]);
    if (rows.length > 0) out[field] = rows;
  }
  return out;
}

function render(diff) {
  const lines = [];
  for (const [gender, fields] of Object.entries(diff)) {
    if (Object.keys(fields).length === 0) continue;
    lines.push(`\n═══ ${gender.toUpperCase()} ═══`);
    for (const [field, value] of Object.entries(fields)) {
      if (!Array.isArray(value)) {
        lines.push(`  ${field}: ${value.was} -> ${value.now}`);
        continue;
      }
      lines.push(`  ${field} — ${value.length} changed`);
      // Biggest movements first: the athlete notices a lift that appeared or
      // vanished long before they notice one that shifted by a week.
      const sorted = value.slice().sort((a, b) =>
        Math.abs(b.now - b.was) - Math.abs(a.now - a.was));
      for (const row of sorted.slice(0, 25)) {
        const tag = row.was === 0 ? 'NEW    ' : row.now === 0 ? 'GONE   ' : '       ';
        lines.push(`    ${tag}${row.key}: ${row.was} -> ${row.now}`);
      }
      if (sorted.length > 25) lines.push(`    … and ${sorted.length - 25} more`);
    }
  }
  return lines.join('\n');
}

module.exports = { diffCounts, diffAthlete, render };

if (require.main === module) {
  const writeBaseline = process.argv.includes('--baseline');
  const outDir = path.join(repo, 'outputs', 'year-diff');
  const summary = generate(outDir);

  if (writeBaseline) {
    fs.writeFileSync(BASELINE, `${JSON.stringify(summary, null, 2)}\n`);
    console.log(`\nBASELINE UPDATED — ${path.relative(repo, BASELINE)}`);
    console.log('Commit it with the change it describes, or the next diff lies about what moved.');
    process.exit(0);
  }

  if (!fs.existsSync(BASELINE)) {
    console.error(`\nNO BASELINE at ${path.relative(repo, BASELINE)} — run: npm run year:baseline`);
    process.exit(1);
  }

  const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  const diff = {};
  for (const gender of [...new Set([...Object.keys(baseline), ...Object.keys(summary)])]) {
    diff[gender] = diffAthlete(baseline[gender], summary[gender]);
  }
  const changed = Object.values(diff).some((fields) => Object.keys(fields).length > 0);

  if (!changed) {
    // ⚠ THE LOUD NO-OP. A change that reaches nothing looks exactly like a
    // change that works, and only this line tells them apart.
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('  NOTHING CHANGED FOR THE ATHLETE.');
    console.log('  Identical to the baseline in every counted respect.');
    console.log('  If you expected a change, your edit did not reach them.');
    console.log('════════════════════════════════════════════════════════════');
    process.exit(0);
  }
  console.log('\n════════ WHAT THIS CHANGE DID TO THE ATHLETE ════════');
  console.log(render(diff));
  console.log('\nRead it. If it is what you meant, `npm run year:baseline` and commit both.');
}
