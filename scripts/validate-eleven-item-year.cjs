'use strict';

const fs = require('node:fs');
const path = require('node:path');
require('sucrase/register');

const input = path.resolve(process.argv[2] ?? '');
if (!fs.existsSync(input)) throw new Error(`Missing annual JSON: ${input}`);
const data = JSON.parse(fs.readFileSync(input, 'utf8'));
const failures = [];
const checks = [];
const check = (label, condition, detail) => {
  checks.push({ label, passed: Boolean(condition), ...(condition ? {} : { detail }) });
  if (!condition) failures.push(`${label}: ${JSON.stringify(detail)}`);
};
const app = relative => require(path.resolve(__dirname, '..', relative));
const { sessionHasExerciseVariationCollision } = app('src/rules/exerciseVariationFamily');

for (const athlete of data.athletes ?? []) {
  const who = athlete.gender;
  const weeks = athlete.weeks ?? [];
  check(`${who}: exactly 52 compiled weeks`, weeks.length === 52, weeks.length);
  const phaseCounts = Object.fromEntries(['Off-season', 'Pre-season', 'In-season']
    .map(phase => [phase, weeks.filter(week => week.phase === phase).length]));
  check(`${who}: phase calendar is 7/19/26`,
    phaseCounts['Off-season'] === 7 && phaseCounts['Pre-season'] === 19
      && phaseCounts['In-season'] === 26, phaseCounts);
  check(`${who}: pre-season and season start on the canonical Mondays`,
    weeks[7]?.start === '2026-11-16' && weeks[26]?.start === '2027-03-29',
    { pre: weeks[7]?.start, season: weeks[26]?.start });

  for (const week of weeks) {
    const expectedTeamDays = week.phase === 'Pre-season'
      ? ['Monday', 'Wednesday'] : week.phase === 'In-season'
        ? ['Tuesday', 'Thursday'] : [];
    check(`${who} week ${week.number}: accepted team schedule matches ${week.phase}`,
      JSON.stringify(week.acceptedProgrammingInputs?.teamTrainingDays ?? [])
        === JSON.stringify(expectedTeamDays),
      week.acceptedProgrammingInputs?.teamTrainingDays);

    const familySequence = [];
    for (const day of week.days ?? []) {
      const rows = day.rows ?? [];
      const speedRows = day.speedRows ?? [];
      if (week.number <= 4) {
        check(`${who} week ${week.number} ${day.date}: no opening Speed rows`,
          speedRows.length === 0, speedRows.map(row => row.catalogueIdentity ?? row.name));
      }
      for (const row of [...rows, ...(day.warmup ?? []), ...speedRows]) {
        check(`${who} ${day.date} ${row.name}: Main muscles field is exported`,
          Array.isArray(row.mainMuscles), row.mainMuscles);
        check(`${who} ${day.date} ${row.name}: approved capitals survive export`,
          !/\b(?:Sl|Ql|Db|Rdl|Iso)\b/.test(String(row.name ?? '')), row.name);
        if ((row.catalogueIdentity ?? row.name) === 'Crab Hold') {
          check(`${who} ${day.date}: Crab Hold never displays BW`,
            !/\bBW\b/.test(String(row.load ?? '')), row.load);
        }
        check(`${who} ${day.date}: advanced automatic year excludes Swiss Ball Hamstring Curl`,
          (row.catalogueIdentity ?? row.name) !== 'Swiss Ball Hamstring Curl', row.name);
        if (week.phase === 'In-season' && (row.catalogueIdentity ?? row.name) === 'RDLs') {
          const afterTimes = String(row.dose ?? '').split('×')[1] ?? '';
          const reps = (afterTimes.match(/\d+/g) ?? []).map(Number);
          check(`${who} ${day.date}: in-season RDL is at most four reps`,
            reps.length > 0 && Math.max(...reps) <= 4, row.dose);
        }
      }

      if (/upper/i.test(String(day.name ?? ''))) {
        const slots = rows.map(row => row.section18Evidence?.slot).filter(Boolean);
        check(`${who} ${day.date}: upper session has push and pull accessories`,
          slots.includes('push_accessory_1') && slots.includes('pull_accessory_1'),
          { name: day.name, slots });
        check(`${who} ${day.date}: upper session repeats no variation family`,
          !sessionHasExerciseVariationCollision(rows.map(row => row.catalogueIdentity ?? row.name)),
          rows.map(row => row.catalogueIdentity ?? row.name));
      }

      const mainSlots = rows.filter(row => row.section18Evidence?.role === 'main_strength')
        .map(row => row.section18Evidence?.slot);
      const lower = mainSlots.some(slot => slot === 'squat' || slot === 'hinge'
        || slot === 'single_leg_knee' || slot === 'single_leg_hip');
      const upper = mainSlots.some(slot => /push|pull/.test(String(slot)));
      if (lower !== upper) familySequence.push(lower ? 'Lower' : 'Upper');
    }
    if (familySequence.length === 4
      && familySequence.filter(value => value === 'Lower').length === 2) {
      check(`${who} week ${week.number}: four-way final order is L-U-L-U`,
        familySequence.join('-') === 'Lower-Upper-Lower-Upper', familySequence);
    }
  }
}

const summary = {
  schemaVersion: 1,
  source: input,
  checkOccurrences: checks.length,
  passedOccurrences: checks.filter(item => item.passed).length,
  failedOccurrences: failures.length,
  failures,
};
const receipt = path.join(path.dirname(input), 'eleven-item-year-validation.json');
fs.writeFileSync(receipt, `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
if (failures.length) process.exit(1);
