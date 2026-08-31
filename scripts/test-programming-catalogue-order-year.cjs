'use strict';

/**
 * Release gate for the finished-program order invariant.
 *
 * Both runs execute the preserved 52-week male/female lived journey through
 * the current compiler. The mutant reverses every automatic strength, power
 * and conditioning catalogue in memory before onboarding. Comparison happens
 * on the finished athlete days, logged history and restart outcomes—not on
 * intermediate selector returns.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repo = path.resolve(__dirname, '..');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lfa-programming-order-year-'));
const authored = path.join(root, 'authored');
const reversed = path.join(root, 'reversed');

function run(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: repo,
    env: { ...process.env, TZ: 'Australia/Melbourne' },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    process.stdout.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    throw new Error(`${args.join(' ')} exited ${result.status}`);
  }
  return result.stdout;
}

run([
  'scripts/run-programming-catalogue-order-year.cjs',
  '--kit=full',
  '--going-away',
  `--output=${authored}`,
]);
run([
  'scripts/run-programming-catalogue-order-year.cjs',
  '--kit=full',
  '--going-away',
  '--reverse-catalogues',
  `--output=${reversed}`,
]);
const comparison = run([
  'scripts/compare-programming-years.cjs',
  path.join(authored, 'year-programs.json'),
  path.join(reversed, 'year-programs.json'),
]);
const receipt = JSON.parse(comparison);
if (receipt.same !== true || receipt.athleteYears !== 2 ||
    receipt.weeksPerAthlete.some((weeks) => weeks !== 52) ||
    receipt.differingAthleteDays !== 0) {
  throw new Error(`finished-year catalogue-order invariant failed: ${comparison}`);
}
const authoredYear = JSON.parse(fs.readFileSync(path.join(authored, 'year-programs.json'), 'utf8'));
const reversedYear = JSON.parse(fs.readFileSync(path.join(reversed, 'year-programs.json'), 'utf8'));
const travelDates = ['2027-02-01', '2027-02-04'];
let directTravelRows = 0;
for (let athleteIndex = 0; athleteIndex < 2; athleteIndex += 1) {
  for (const date of travelDates) {
    const findDay = (year) => year.athletes[athleteIndex].weeks
      .flatMap((week) => week.days).find((day) => day.date === date);
    const before = findDay(authoredYear);
    const after = findDay(reversedYear);
    if (!before || !after) throw new Error(`Going Away liveness missing ${date}`);
    if (!before.rows?.some((row) => !['conditioning', 'power'].includes(row.role))) {
      throw new Error(`Going Away strength-row liveness missing ${date}`);
    }
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      throw new Error(`Going Away catalogue reversal changed ${authoredYear.athletes[athleteIndex].gender} ${date}`);
    }
    directTravelRows += 1;
  }
}
if (directTravelRows !== 4) throw new Error(`expected 4 direct Going Away athlete-date rows, got ${directTravelRows}`);
console.log(`PASS reversing every automatic catalogue changes ${receipt.differingAthleteDays} / 728 athlete-days across 2 athlete-years`);
console.log(`PASS ${directTravelRows} direct Going Away athlete-date rows and every later saved/restarted day are identical`);
console.log('NOT COVERED: physical iPhone, native onboarding taps, athletes outside the audited male/female inputs');
