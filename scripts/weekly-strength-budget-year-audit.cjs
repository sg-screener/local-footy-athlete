'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const repo = path.resolve(__dirname, '..');
const artifactArg = process.argv[2];
if (!artifactArg) {
  throw new Error('usage: node scripts/weekly-strength-budget-year-audit.cjs <annual-artifact>');
}
const artifact = path.resolve(repo, artifactArg);
const yearPath = path.join(artifact, 'year-programs.json');
const year = JSON.parse(fs.readFileSync(yearPath, 'utf8'));
const revision = childProcess.execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: repo,
  encoding: 'utf8',
}).trim();

const MAIN_SLOTS = new Set([
  'squat', 'hinge',
  'horizontal_push', 'vertical_push',
  'horizontal_pull', 'vertical_pull',
]);
const TRACKED = new Set(['Back Squat', 'RDLs', 'Bench Press', 'Pull-Ups']);
const EXACT_SKELETON_REPEAT_CEILING = 5;
const RECURRING_PURPOSE_MINIMUM_DISTINCT_SKELETONS = 6;

const evidence = (row) => row.section18Evidence ?? {};
const isAutomaticStrengthRow = (row) =>
  evidence(row).provenance === 'composer_declaration'
  && (evidence(row).role === 'main_strength' || evidence(row).role === 'strength_accessory');
const identity = (row) => String(row.catalogueIdentity ?? row.name ?? '');

const weeklyMainSeatBreaches = [];
const dedicatedLowerBreaches = [];
const trackedLiftRepeatBreaches = [];
const skeletonCounts = new Map();
const purposeTotals = new Map();
const purposeSkeletons = new Map();
const athleteSummaries = [];

for (const athlete of year.athletes ?? []) {
  for (const week of athlete.weeks ?? []) {
    const mainCounts = new Map();
    const trackedCounts = new Map();
    for (const day of week.days ?? []) {
      const automaticRows = (day.rows ?? []).filter(isAutomaticStrengthRow);
      for (const row of automaticRows) {
        const slot = evidence(row).slot;
        if (evidence(row).role === 'main_strength' && MAIN_SLOTS.has(slot)) {
          mainCounts.set(slot, (mainCounts.get(slot) ?? 0) + 1);
        }
        const name = identity(row);
        if (TRACKED.has(name)) trackedCounts.set(name, (trackedCounts.get(name) ?? 0) + 1);
      }

      if (day.name === 'lower_squat') {
        const rows = automaticRows.filter((row) => evidence(row).slot === 'hinge');
        if (rows.length > 0) dedicatedLowerBreaches.push({
          gender: athlete.gender, week: week.number, date: day.date,
          purpose: day.name, forbiddenSlot: 'hinge', rows: rows.map(identity),
        });
      }
      if (day.name === 'lower_hinge') {
        const rows = automaticRows.filter((row) => evidence(row).slot === 'squat');
        if (rows.length > 0) dedicatedLowerBreaches.push({
          gender: athlete.gender, week: week.number, date: day.date,
          purpose: day.name, forbiddenSlot: 'squat', rows: rows.map(identity),
        });
      }

      // One-row primers are not strength-session skeletons. A skeleton is the
      // ordered automatic strength prescription the athlete actually sees.
      if (automaticRows.length >= 2) {
        const purposeKey = `${athlete.gender}\t${day.name}`;
        const signature = automaticRows.map(identity).join(' > ');
        const skeletonKey = `${purposeKey}\t${signature}`;
        skeletonCounts.set(skeletonKey, (skeletonCounts.get(skeletonKey) ?? 0) + 1);
        purposeTotals.set(purposeKey, (purposeTotals.get(purposeKey) ?? 0) + 1);
        const signatures = purposeSkeletons.get(purposeKey) ?? new Set();
        signatures.add(signature);
        purposeSkeletons.set(purposeKey, signatures);
      }
    }
    for (const [slot, count] of mainCounts) {
      if (count > 1) weeklyMainSeatBreaches.push({
        gender: athlete.gender, week: week.number, slot, count,
      });
    }
    for (const [name, count] of trackedCounts) {
      if (count > 1) trackedLiftRepeatBreaches.push({
        gender: athlete.gender, week: week.number, name, count,
      });
    }
  }

  athleteSummaries.push({
    gender: athlete.gender,
    weeks: athlete.weeks?.length ?? 0,
    athleteDays: (athlete.weeks ?? []).reduce((count, week) => count + (week.days?.length ?? 0), 0),
    restartChecks: athlete.restarts?.length ?? 0,
    successfulRestarts: (athlete.restarts ?? []).filter((entry) => entry.ok).length,
  });
}

const excessiveSkeletons = [...skeletonCounts.entries()]
  .filter(([, count]) => count > EXACT_SKELETON_REPEAT_CEILING)
  .map(([key, count]) => {
    const [gender, purpose, signature] = key.split('\t');
    return { gender, purpose, signature, count };
  });
const recurringPurposeVarietyBreaches = [...purposeTotals.entries()]
  .filter(([, sessions]) => sessions >= 10)
  .flatMap(([key, sessions]) => {
    const distinctSkeletons = purposeSkeletons.get(key)?.size ?? 0;
    if (distinctSkeletons >= RECURRING_PURPOSE_MINIMUM_DISTINCT_SKELETONS) return [];
    const [gender, purpose] = key.split('\t');
    return [{ gender, purpose, sessions, distinctSkeletons }];
  });
const topRepeatedSkeletons = [...skeletonCounts.entries()]
  .sort((left, right) => right[1] - left[1])
  .slice(0, 20)
  .map(([key, count]) => {
    const [gender, purpose, signature] = key.split('\t');
    return { gender, purpose, signature, count };
  });

const exactSource = year.revision === revision;
const completeAthletes = athleteSummaries.length === 2 && athleteSummaries.every((summary) =>
  summary.weeks === 52 && summary.athleteDays === 364
  && summary.restartChecks === 52 && summary.successfulRestarts === 52);
const verdict = exactSource && completeAthletes
  && weeklyMainSeatBreaches.length === 0
  && dedicatedLowerBreaches.length === 0
  && trackedLiftRepeatBreaches.length === 0
  && excessiveSkeletons.length === 0
  && recurringPurposeVarietyBreaches.length === 0 ? 'PASS' : 'FAIL';

const receipt = {
  revision,
  sourceRevision: year.revision,
  verdict,
  units: {
    weeklyMainSeatBreaches: 'automatic composer-declared main-row occurrences per athlete-week and exact typed slot',
    dedicatedLowerBreaches: 'automatic composer-declared row occurrences on typed lower_squat/lower_hinge athlete-days',
    trackedLiftRepeatBreaches: 'automatic composer-declared tracked identity occurrences per athlete-week',
    skeletons: 'ordered automatic composer-declared strength-row identity signatures per athlete session purpose',
  },
  thresholds: {
    weeklyMainSeatMaximum: 1,
    trackedLiftIdentityMaximumPerWeek: 1,
    exactSkeletonRepeatCeiling: EXACT_SKELETON_REPEAT_CEILING,
    recurringPurposeSessionMinimum: 10,
    recurringPurposeMinimumDistinctSkeletons: RECURRING_PURPOSE_MINIMUM_DISTINCT_SKELETONS,
  },
  athleteSummaries,
  counts: {
    weeklyMainSeatBreaches: weeklyMainSeatBreaches.length,
    dedicatedLowerBreaches: dedicatedLowerBreaches.length,
    trackedLiftRepeatBreaches: trackedLiftRepeatBreaches.length,
    excessiveSkeletons: excessiveSkeletons.length,
    recurringPurposeVarietyBreaches: recurringPurposeVarietyBreaches.length,
  },
  weeklyMainSeatBreaches,
  dedicatedLowerBreaches,
  trackedLiftRepeatBreaches,
  excessiveSkeletons,
  recurringPurposeVarietyBreaches,
  topRepeatedSkeletons,
  notCovered: [
    'Physical iPhone acceptance',
    'Native onboarding taps',
    'Remote persistence and true OS process death',
    'Every possible injury, illness, fatigue, fixture and availability combination across a full year',
  ],
};

fs.writeFileSync(
  path.join(artifact, 'weekly-strength-budget-audit.json'),
  JSON.stringify(receipt, null, 2),
);
console.log(JSON.stringify(receipt, null, 2));
process.exitCode = verdict === 'PASS' ? 0 : 1;
