'use strict';
/**
 * WHAT THE ATHLETE ENDS UP WITH, AS A COMPACT FACT — the input to `year:diff`.
 *
 * ## WHY THIS EXISTS (Sam, 2026-09-04)
 *
 * *"i need to fix things so problems are easier to find in the future."*
 *
 * MEASURED that day: fifteen defects landed. **About eight were found by
 * generating a year and reading the athlete's program. ZERO were found by the
 * unit suites covering the code that was changed** — those stayed green
 * throughout. One fix changed literally nothing and looked correct; only the
 * year showed it, because the year came back byte-identical.
 *
 * The tests in this repo are attached to FUNCTIONS. Nothing standard is attached
 * to WHAT THE ATHLETE ENDS UP WITH, so a change can be right at the function and
 * wrong at the athlete and nothing says so. The full release gate does read
 * athlete output, but it takes 30-40 minutes and STOPS AT THE FIRST RED UNIT, so
 * it shows one problem at a time — three separate runs on 2026-09-04, each
 * revealing the next.
 *
 * ## WHAT THIS IS NOT
 *
 * **Not a gate, and deliberately not pass/fail.** Every signal that mattered
 * that day was a DIFFERENCE, not an assertion: "182 rows wrong -> 0", "the year
 * came back identical so my fix did nothing", "main lifts 16 -> 32", "a lift
 * appeared that should never lead a day". A test can only fail on what someone
 * predicted; a diff shows what you actually did, including what you were not
 * looking for.
 *
 * ## WHAT IT SUMMARISES, AND WHY EACH FIELD IS HERE
 *
 * Every field below is one that MOVED on a real defect that day. Nothing is
 * included because it seemed interesting.
 *
 *   rowsByRole        the main-lift badge defect: 108 rows moved accessory ->
 *                     main_lift, and 14 of 14 squat days had shown no main lift.
 *   exerciseRole      an ungraded lift leading a day (`Kettlebell Swings` x3),
 *                     and `Leg Press` going from 51 weeks to 1.
 *   doses             per-side: 200 rows read as a total for a one-sided
 *                     movement, and the total-load change (DB Bench 30 -> 60).
 *   dayTypes          two `Accessories` sessions becoming rest.
 *   weeks/totalRows   a week being refused, or the driver stopping early.
 */
const fs = require('node:fs');
const path = require('node:path');

const repo = path.resolve(__dirname, '..');

/** Sorted plain objects only — a diff must never report key order as a change. */
function sortedCounts(map) {
  return Object.fromEntries([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function summariseAthlete(year) {
  const rowsByRole = new Map();
  const exerciseRole = new Map();
  const doses = new Map();
  const dayTypes = new Map();
  let totalRows = 0;

  for (const week of year.weeks ?? []) {
    for (const day of week.days ?? []) {
      const type = String(day.type ?? 'none');
      dayTypes.set(type, (dayTypes.get(type) ?? 0) + 1);
      for (const row of day.rows ?? []) {
        totalRows += 1;
        const role = String(row.role ?? 'none');
        rowsByRole.set(role, (rowsByRole.get(role) ?? 0) + 1);
        const key = `${row.name} [${role}]`;
        exerciseRole.set(key, (exerciseRole.get(key) ?? 0) + 1);
        // The DOSE STRING is the athlete's own words for the prescription, so it
        // carries per-side, sets, reps and units in the exact form they read.
        if (row.dose) {
          const doseKey = `${row.name} :: ${row.dose}`;
          doses.set(doseKey, (doses.get(doseKey) ?? 0) + 1);
        }
      }
    }
  }
  return {
    weeks: (year.weeks ?? []).length,
    totalRows,
    dayTypes: sortedCounts(dayTypes),
    rowsByRole: sortedCounts(rowsByRole),
    exerciseRole: sortedCounts(exerciseRole),
    doses: sortedCounts(doses),
  };
}

/** Build the summary from a driver output directory (male-year.json + female-year.json). */
function summariseYearDirectory(dir) {
  const out = {};
  for (const gender of ['male', 'female']) {
    const file = path.join(dir, `${gender}-year.json`);
    if (!fs.existsSync(file)) continue;
    out[gender] = summariseAthlete(JSON.parse(fs.readFileSync(file, 'utf8')));
  }
  if (Object.keys(out).length === 0) {
    throw new Error(`no year output found in ${dir} — the driver did not finish`);
  }
  return out;
}

module.exports = { summariseAthlete, summariseYearDirectory, repo };

if (require.main === module) {
  const dir = process.argv[2];
  if (!dir) throw new Error('usage: year-summary.cjs <driver-output-dir> [outFile]');
  const summary = summariseYearDirectory(path.resolve(repo, dir));
  const outFile = process.argv[3];
  const text = `${JSON.stringify(summary, null, 2)}\n`;
  if (outFile) { fs.writeFileSync(path.resolve(repo, outFile), text); console.log(`wrote ${outFile}`); }
  else process.stdout.write(text);
}
