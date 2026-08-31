'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');
const [leftArg, rightArg] = process.argv.slice(2);
if (!leftArg || !rightArg) throw Error('usage: node scripts/compare-programming-years.cjs <left year-programs.json> <right year-programs.json>');
const leftPath = path.resolve(leftArg);
const rightPath = path.resolve(rightArg);
const left = JSON.parse(fs.readFileSync(leftPath, 'utf8'));
const right = JSON.parse(fs.readFileSync(rightPath, 'utf8'));
const comparable = (year) => ({
  start: year.start,
  end: year.end,
  assumptions: year.assumptions,
  athletes: year.athletes.map((athlete) => ({
    gender: athlete.gender,
    profile: athlete.profile,
    weeks: athlete.weeks,
    loggedDays: athlete.loggedDays,
    restarts: athlete.restarts.map((restart) => ({ date: restart.date, ok: restart.ok, error: restart.error })),
  })),
});
const same = isDeepStrictEqual(comparable(left), comparable(right));
const differingDays = [];
for (let athlete = 0; athlete < Math.min(left.athletes.length, right.athletes.length); athlete += 1) {
  for (let week = 0; week < Math.min(left.athletes[athlete].weeks.length, right.athletes[athlete].weeks.length); week += 1) {
    const before = left.athletes[athlete].weeks[week];
    const after = right.athletes[athlete].weeks[week];
    for (let day = 0; day < Math.min(before.days.length, after.days.length); day += 1) {
      if (!isDeepStrictEqual(before.days[day], after.days[day])) differingDays.push({
        athlete: left.athletes[athlete].gender, week: week + 1, date: before.days[day].date,
      });
    }
  }
}
console.log(JSON.stringify({ same, athleteYears: left.athletes.length, weeksPerAthlete: left.athletes.map((athlete) => athlete.weeks.length), differingAthleteDays: differingDays.length, firstDifferences: differingDays.slice(0, 10) }, null, 2));
if (!same) process.exitCode = 1;
