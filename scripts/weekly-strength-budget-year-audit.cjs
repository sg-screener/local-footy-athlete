'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');
require('sucrase/register');

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

const {
  auditFinalAutomaticWeek,
  automaticExerciseRouteForIdentity,
} = require(path.join(repo, 'src/rules/automaticWeeklyExerciseSelection'));
const EXACT_SKELETON_REPEAT_CEILING = 5;
const RECURRING_PURPOSE_MINIMUM_DISTINCT_SKELETONS = 6;

const evidence = (row) => row.section18Evidence ?? {};
const isAutomaticStrengthRow = (row) =>
  evidence(row).provenance === 'composer_declaration'
  && (evidence(row).role === 'main_strength' || evidence(row).role === 'strength_accessory');
const identity = (row) => String(row.catalogueIdentity ?? row.name ?? '');

const repeatedExactExerciseBreaches = [];
const repeatedMainFamilyBreaches = [];
const dedicatedDayOwnershipBreaches = [];
const skeletonCounts = new Map();
const purposeTotals = new Map();
const purposeSkeletons = new Map();
const athleteSummaries = [];

for (const athlete of year.athletes ?? []) {
  for (const week of athlete.weeks ?? []) {
    for (const day of week.days ?? []) {
      const automaticRows = (day.rows ?? []).filter(isAutomaticStrengthRow);

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
    const finalAudit = auditFinalAutomaticWeek((week.days ?? []).map((day) => ({
      dayKind: day.name === 'lower_squat' || day.name === 'lower_hinge'
        ? day.name : null,
      exercises: (day.rows ?? []).filter(isAutomaticStrengthRow).map((row) => ({
        identity: identity(row),
        authorship: 'automatic',
        route: automaticExerciseRouteForIdentity(identity(row)),
        requestedAsMain: false,
      })),
    })));
    repeatedExactExerciseBreaches.push(...finalAudit.repeatedExact.map((finding) => ({
      gender: athlete.gender, week: week.number, ...finding,
    })));
    repeatedMainFamilyBreaches.push(...finalAudit.repeatedMainFamilies.map((finding) => ({
      gender: athlete.gender, week: week.number, ...finding,
    })));
    dedicatedDayOwnershipBreaches.push(...finalAudit.dedicatedDayOwnership.map((finding) => ({
      gender: athlete.gender, week: week.number, ...finding,
    })));
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
const selectionVerdict = exactSource && completeAthletes
  && repeatedExactExerciseBreaches.length === 0
  && repeatedMainFamilyBreaches.length === 0
  && dedicatedDayOwnershipBreaches.length === 0 ? 'PASS' : 'FAIL';
const legacyVarietyVerdict = excessiveSkeletons.length === 0
  && recurringPurposeVarietyBreaches.length === 0 ? 'PASS' : 'FAIL';
const verdict = selectionVerdict === 'PASS' && legacyVarietyVerdict === 'PASS'
  ? 'PASS' : 'FAIL';

const receipt = {
  revision,
  sourceRevision: year.revision,
  verdict,
  selectionVerdict,
  legacyVarietyVerdict,
  units: {
    repeatedExactExerciseBreaches: 'distinct canonical non-Mobility/non-Prehab automatic exercise identities occurring more than once per athlete-week; each finding includes delivered occurrence count',
    repeatedMainFamilyBreaches: 'distinct real catalogue-owned anchor families occurring more than once per athlete-week; each finding includes delivered identities',
    dedicatedDayOwnershipBreaches: 'automatic exercise occurrences whose real catalogue classification crosses dedicated lower_squat/lower_hinge ownership',
    skeletons: 'ordered automatic composer-declared strength-row identity signatures per athlete session purpose',
  },
  thresholds: {
    automaticExerciseIdentityMaximumPerWeek: 1,
    automaticRealMainFamilyMaximumPerWeek: 1,
    exactSkeletonRepeatCeiling: EXACT_SKELETON_REPEAT_CEILING,
    recurringPurposeSessionMinimum: 10,
    recurringPurposeMinimumDistinctSkeletons: RECURRING_PURPOSE_MINIMUM_DISTINCT_SKELETONS,
  },
  athleteSummaries,
  counts: {
    repeatedExactExerciseBreaches: repeatedExactExerciseBreaches.length,
    repeatedExactExerciseOccurrences: repeatedExactExerciseBreaches
      .reduce((total, finding) => total + finding.count, 0),
    repeatedMainFamilyBreaches: repeatedMainFamilyBreaches.length,
    repeatedMainFamilyOccurrences: repeatedMainFamilyBreaches
      .reduce((total, finding) => total + finding.identities.length, 0),
    dedicatedDayOwnershipBreaches: dedicatedDayOwnershipBreaches.length,
    excessiveSkeletons: excessiveSkeletons.length,
    recurringPurposeVarietyBreaches: recurringPurposeVarietyBreaches.length,
  },
  repeatedExactExerciseBreaches,
  repeatedMainFamilyBreaches,
  dedicatedDayOwnershipBreaches,
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
