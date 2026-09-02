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
  workoutExerciseWasAutomaticallySelected,
} = require(path.join(repo, 'src/rules/automaticWeeklyExerciseSelection'));
const {
  auditMovementPlaneCoverage,
  exerciseSuppliesTrunkTransverse,
} = require(path.join(repo, 'src/rules/movementPlaneProgramming'));
const { muscleMetadataFor } = require(path.join(repo, 'src/data/muscleExperienceMetadata'));
const {
  athleticPlaneExposuresForAuditDay,
} = require(path.join(repo, 'src/rules/programmingYearAuditProjection'));

const evidence = (row) => row.section18Evidence ?? {};
const isAutomaticStrengthRow = (row) => workoutExerciseWasAutomaticallySelected(row)
  && (evidence(row).role === 'main_strength' || evidence(row).role === 'strength_accessory'
    || row.role === 'power');
const identity = (row) => String(row.catalogueIdentity ?? row.name ?? '');

const repeatedExactExerciseBreaches = [];
const repeatedMainFamilyBreaches = [];
const dedicatedDayOwnershipBreaches = [];
const movementPlaneFindings = [];
const acceptedMovementPlaneExceptions = [];
const athleteSummaries = [];

for (const athlete of year.athletes ?? []) {
  let lastTrunkTransverseDate = null;
  const athleticExposureHistory = [];
  const athleticSafetyHistory = [];
  for (const week of athlete.weeks ?? []) {
    const weekDays = week.days ?? [];
    const finalAudit = auditFinalAutomaticWeek(weekDays.map((day) => ({
      dayKind: day.name === 'lower_squat' || day.name === 'lower_hinge'
        ? day.name : null,
      exercises: (day.rows ?? []).filter(isAutomaticStrengthRow).map((row) => ({
        identity: identity(row),
        authorship: 'automatic',
        route: row.role === 'power' ? 'power' : automaticExerciseRouteForIdentity(identity(row)),
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

    const finalRows = weekDays.flatMap((day) => day.rows ?? []);
    const exerciseRows = finalRows.flatMap((row) => {
      const catalogueIdentity = identity(row);
      if (!catalogueIdentity) return [];
      const pool = muscleMetadataFor(catalogueIdentity)?.pool;
      const contribution = pool === 'Lower prehab' ? 'prehab'
        : pool === 'Lower plyometric' || pool === 'Power' ? 'power'
        : pool === 'Midline' ? 'trunk'
        : pool === 'Mobility' ? 'mobility'
        : pool === 'Tissue quality' ? 'tissue'
        : pool === 'Breathing reset' ? 'breathing'
        : 'strength';
      return [{ identity: catalogueIdentity, contribution }];
    });
    // Typed credit only: the club anchor by role, a conditioning session by the
    // authored quality reached through its template or its typed section rows
    // (the combined Change of Direction session), a power row by its pool.
    for (const day of weekDays) {
      for (const exposure of athleticPlaneExposuresForAuditDay(day)) {
        athleticExposureHistory.push({ date: day.date, exposure });
      }
    }
    for (const event of week.events ?? []) {
      const label = String(event.label ?? '');
      if (/injury/i.test(label)) athleticSafetyHistory.push({ date: event.date, reason: 'injury' });
      if (/^Sick$/i.test(label)) athleticSafetyHistory.push({ date: event.date, reason: 'illness' });
      if (/^Going Away/i.test(label)) athleticSafetyHistory.push({ date: event.date, reason: 'travel' });
      if (/^Very tired/i.test(label)) athleticSafetyHistory.push({ date: event.date, reason: 'deload' });
    }
    for (const day of weekDays) {
      if (day.kind === 'game') {
        athleticSafetyHistory.push({ date: day.date, reason: 'game_proximity' });
      }
    }
    const firstDate = weekDays[0]?.date;
    const lastDate = weekDays[weekDays.length - 1]?.date;
    const rollingWindowStart = lastDate
      ? new Date(Date.parse(`${lastDate}T12:00:00Z`) - 13 * 86_400_000).toISOString().slice(0, 10)
      : null;
    const athleticExposures = rollingWindowStart === null ? []
      : athleticExposureHistory.filter((entry) => entry.date >= rollingWindowStart
        && entry.date <= lastDate).map((entry) => entry.exposure);
    const safetyConstraints = rollingWindowStart === null ? []
      : Array.from(new Set(athleticSafetyHistory.filter((entry) => entry.date >= rollingWindowStart
        && entry.date <= lastDate).map((entry) => entry.reason)));
    const daysSinceLastTrunkTransverse = firstDate && lastTrunkTransverseDate
      ? Math.floor((Date.parse(firstDate) - Date.parse(lastTrunkTransverseDate)) / 86_400_000)
      : null;
    const planeAudit = auditMovementPlaneCoverage({
      exerciseRows,
      athleticExposures,
      daysSinceLastTrunkTransverse,
      athleticTransverseRuleContext: {
        phase: week.phase,
        offseasonBlock: week.phase === 'Off-season' && week.phaseWeek >= 5
          ? 'normal_build' : null,
        phaseWeekNumber: week.phaseWeek ?? null,
        christmasBreakWeekNumber: null,
        rollingWindowComplete: week.phase !== 'Off-season' || week.phaseWeek >= 6,
        safetyConstraints,
      },
    });
    const planeExceptions = weekDays.flatMap((day) => day.weeklyMovementPlaneExceptions ?? [])
      .filter((exception) => exception.kind === 'lower_body_frontal_unavailable'
        && exception.weekStartISO === week.start);
    const honestLowerFrontalException = planeExceptions.length === 1
      && planeExceptions[0].consideredDates.every((entry) => entry.safeExercises.length === 0);
    if (honestLowerFrontalException) acceptedMovementPlaneExceptions.push({
      gender: athlete.gender,
      week: week.number,
      ...planeExceptions[0],
    });
    movementPlaneFindings.push(...planeAudit.findings.filter((finding) =>
      finding.kind !== 'missing_lower_body_frontal' || !honestLowerFrontalException).map((finding) => ({
      gender: athlete.gender, week: week.number, ...finding,
    })));
    for (const day of weekDays) {
      if ((day.rows ?? []).some((row) => exerciseSuppliesTrunkTransverse(identity(row)))) {
        lastTrunkTransverseDate = day.date;
      }
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

const exactSource = year.revision === revision;
const completeAthletes = athleteSummaries.length === 2 && athleteSummaries.every((summary) =>
  summary.weeks === 52 && summary.athleteDays === 364
  && summary.restartChecks === 52 && summary.successfulRestarts === 52);
const selectionVerdict = exactSource && completeAthletes
  && repeatedExactExerciseBreaches.length === 0
  && repeatedMainFamilyBreaches.length === 0
  && dedicatedDayOwnershipBreaches.length === 0 ? 'PASS' : 'FAIL';
const requiredMovementPlaneFindings = movementPlaneFindings
  .filter((finding) => finding.severity === 'required');
const movementPlaneVerdict = exactSource && completeAthletes
  && requiredMovementPlaneFindings.length === 0 ? 'PASS' : 'FAIL';
const verdict = selectionVerdict === 'PASS' && movementPlaneVerdict === 'PASS' ? 'PASS' : 'FAIL';

const receipt = {
  revision,
  sourceRevision: year.revision,
  verdict,
  selectionVerdict,
  movementPlaneVerdict,
  units: {
    repeatedExactExerciseBreaches: 'distinct canonical non-Mobility/non-Prehab automatic exercise identities occurring more than once per athlete-week; each finding includes delivered occurrence count',
    repeatedMainFamilyBreaches: 'distinct real catalogue-owned anchor families occurring more than once per athlete-week; each finding includes delivered identities',
    dedicatedDayOwnershipBreaches: 'automatic strength/prehab exercise occurrences whose typed movement or signed primary muscle conflicts with dedicated lower_squat/lower_hinge purpose; each finding names the typed conflict',
    movementPlaneFindings: 'distinct athlete-week plane-coverage findings; lower frontal and athletic transverse are required, while trunk transverse is a soft 7–14 day check. Athletic credit is typed per exported day: team_training role, authored conditioning quality via template or typed section identity, power pool exposure',
  },
  thresholds: {
    automaticExerciseIdentityMaximumPerWeek: 1,
    automaticRealMainFamilyMaximumPerWeek: 1,
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
    movementPlaneRequiredFindings: requiredMovementPlaneFindings.length,
    movementPlaneSoftFindings: movementPlaneFindings.length - requiredMovementPlaneFindings.length,
    acceptedMovementPlaneExceptions: acceptedMovementPlaneExceptions.length,
  },
  repeatedExactExerciseBreaches,
  repeatedMainFamilyBreaches,
  dedicatedDayOwnershipBreaches,
  movementPlaneFindings,
  acceptedMovementPlaneExceptions,
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
