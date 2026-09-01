'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const repo = path.resolve(__dirname, '..');
const artifact = path.resolve(process.argv[2]);
const revision = childProcess.execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: repo,
  encoding: 'utf8',
}).trim();

require(path.join(repo, 'node_modules/sucrase/register'));
const {
  consecutiveEnergySystemTriples,
  summarizeWeeklyEnergySystemAudit,
  validateEnergySystemExposureEvidence,
  validateWeeklyEnergySystemDensity,
} = require(path.join(repo, 'src/rules/energySystemExposureEvidence'));
const {
  finalAthleteFacingAuditRows,
  programmingAuditProjectionFindings,
  summarizeProgrammingAuditConditioningVocabulary,
} = require(path.join(repo, 'src/rules/programmingYearAuditProjection'));
const { summarizeProgrammingYearRows } = require(path.join(repo, 'src/rules/programmingYearRowSummary'));
const { trackedLiftProgrammingEvidence } = require(path.join(repo, 'src/rules/trackedLiftProgrammingEvidence'));
const { resolveTemplateByName } = require(path.join(repo, 'src/rules/conditioningSelection'));

const year = JSON.parse(fs.readFileSync(path.join(artifact, 'year-programs.json'), 'utf8'));
const driver = JSON.parse(fs.readFileSync(path.join(artifact, 'driver-receipt.json'), 'utf8'));
const trace = JSON.parse(fs.readFileSync(path.join(artifact, 'programming-selection-traces.json'), 'utf8'));
const findings = [];
const checks = [];
const record = (id, ok, detail) => {
  checks.push({ id, ok, detail });
  if (!ok) findings.push({ id, detail });
};
const same = (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected);
const weekday = (dateISO) => new Intl.DateTimeFormat('en-AU', {
  weekday: 'long', timeZone: 'Australia/Melbourne',
}).format(new Date(`${dateISO}T12:00:00+10:00`));
const daysBetween = (earlierISO, laterISO) =>
  (Date.parse(`${laterISO}T12:00:00Z`) - Date.parse(`${earlierISO}T12:00:00Z`)) / 86_400_000;

record('exact_source_revision', year.revision === revision && driver.revision === revision
  && trace.revision === revision && driver.sourceDiff === '', {
  current: revision, year: year.revision, driver: driver.revision, trace: trace.revision,
  sourceDiff: driver.sourceDiff,
});
record('two_athletes', year.athletes.length === 2
  && same(year.athletes.map((athlete) => athlete.gender).sort(), ['female', 'male']),
{ genders: year.athletes.map((athlete) => athlete.gender) });

const requiredEquipmentTags = ['rack', 'barbell', 'trap_bar', 'medicine_ball', 'back_extension_bench'];
const requiredModalities = ['bike_erg', 'air_bike', 'row', 'ski', 'treadmill'];
const athleteReceipts = [];

for (const athlete of year.athletes) {
  const label = athlete.gender;
  const days = athlete.weeks.flatMap((week) => week.days);
  const dates = new Set(days.map((day) => day.date));
  const rowProjectionFindings = days.flatMap(programmingAuditProjectionFindings);
  const rowSummary = summarizeProgrammingYearRows(days);
  const conditioningVocabulary = summarizeProgrammingAuditConditioningVocabulary(days);
  const evidenceFindings = athlete.weeks.flatMap((week) => week.days.flatMap((day) =>
    validateEnergySystemExposureEvidence(day.energySystem).map((finding) => ({
      week: week.number, date: day.date, finding,
    }))));
  const densityFindings = [
    ...athlete.weeks.flatMap((week) => validateWeeklyEnergySystemDensity({
      phase: week.phase,
      phaseWeek: week.phaseWeek,
      days: week.days.map((day) => ({ date: day.date, energySystem: day.energySystem })),
    }).map((finding) => ({ week: week.number, finding }))),
    ...consecutiveEnergySystemTriples(days.map((day) => ({
      date: day.date, energySystem: day.energySystem,
    }))).map((datesInRun) => ({ finding: 'three_consecutive_app_programmed_energy_system_days', dates: datesInRun })),
  ];
  const weeklyEnergySystemCounts = athlete.weeks.map((week) => ({
    week: week.number,
    phase: week.phase,
    ...summarizeWeeklyEnergySystemAudit(week.days),
  }));

  record(`${label}_calendar_restart_projection`, athlete.weeks.length === 52 && days.length === 364
    && dates.size === 364 && athlete.restarts.length === 52
    && athlete.restarts.every((restart) => restart.ok) && days.every((day) => !day.projectionError)
    && rowProjectionFindings.length === 0, {
    weeks: athlete.weeks.length, dayOccurrences: days.length, distinctDates: dates.size,
    restartOccurrences: athlete.restarts.length,
    successfulRestarts: athlete.restarts.filter((restart) => restart.ok).length,
    projectionErrors: days.filter((day) => day.projectionError).length,
    rowProjectionFindings,
  });

  const inputMismatches = athlete.weeks.flatMap((week) => {
    const expectedPreferred = week.phase === 'In-season'
      ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
      : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const expectedTeam = week.phase === 'Off-season' ? [] : ['Tuesday', 'Thursday'];
    const expectedGame = week.phase === 'In-season' ? 'Saturday' : null;
    return same(week.acceptedProgrammingInputs?.preferredTrainingDays, expectedPreferred)
      && same(week.acceptedProgrammingInputs?.teamTrainingDays, expectedTeam)
      && week.acceptedProgrammingInputs?.usualGameDay === expectedGame
      ? [] : [{ week: week.number, phase: week.phase, actual: week.acceptedProgrammingInputs,
        expected: { preferredTrainingDays: expectedPreferred, teamTrainingDays: expectedTeam,
          usualGameDay: expectedGame } }];
  });
  record(`${label}_accepted_programming_inputs`, inputMismatches.length === 0, inputMismatches);

  const equipmentAnswer = athlete.profile.equipmentAnswer;
  const missingTags = requiredEquipmentTags.filter((tag) => equipmentAnswer?.tags?.[tag] !== 'have');
  const missingModalities = requiredModalities.filter((modality) => equipmentAnswer?.modalities?.[modality] !== 'have');
  const travelWeek = athlete.weeks.find((week) => week.number === 19);
  const restrictedDates = travelWeek.days.filter((day) => day.date <= '2027-02-05');
  const restoredDates = travelWeek.days.filter((day) => day.date >= '2027-02-06');
  const restrictedExpected = ['bodyweight', 'dumbbells', 'bands', 'bench'];
  const restrictedOk = restrictedDates.every((day) => same(day.resolvedEquipment?.tags, restrictedExpected)
    && same(day.resolvedEquipment?.conditioningModalities, []));
  const restoredOk = restoredDates.every((day) => requiredEquipmentTags.every((tag) =>
    day.resolvedEquipment?.tags?.includes(tag)) && requiredModalities.every((modality) =>
    day.resolvedEquipment?.conditioningModalities?.includes(modality)));
  record(`${label}_full_equipment_travel_restore`, missingTags.length === 0
    && missingModalities.length === 0 && restrictedOk && restoredOk, {
    missingTags, missingModalities, restrictedDates: restrictedDates.map((day) => day.date),
    restoredDates: restoredDates.map((day) => day.date), restrictedOk, restoredOk,
  });

  const actionFailures = athlete.actions.filter((action) =>
    action.result?.outcome ? action.result.outcome !== 'accepted' : action.result?.ok !== true);
  const eventLabels = athlete.weeks.flatMap((week) => week.events.map((event) => event.label));
  const eventKinds = {
    tired: eventLabels.filter((item) => item === 'Tired today').length,
    veryTired: eventLabels.filter((item) => item.startsWith('Very tired')).length,
    sick: eventLabels.filter((item) => item === 'Sick').length,
    injuries: eventLabels.filter((item) => item.includes('injury')).length,
    goingAway: eventLabels.filter((item) => item.startsWith('Going Away')).length,
  };
  record(`${label}_accepted_actions_and_events`, actionFailures.length === 0
    && Object.values(eventKinds).every((count) => count > 0), { actionFailures, eventKinds });

  const teamDays = days.filter((day) => day.type === 'Team Training');
  const teamByWeekday = Object.fromEntries(['Tuesday', 'Thursday'].map((name) => [name,
    teamDays.filter((day) => weekday(day.date) === name).length]));
  const invalidTeamDays = teamDays.filter((day) => !['Tuesday', 'Thursday'].includes(weekday(day.date)));
  record(`${label}_team_training_anchors`, teamByWeekday.Tuesday === 39
    && teamByWeekday.Thursday === 39 && invalidTeamDays.length === 0, {
    unit: 'final team-training athlete-dates', teamByWeekday,
    intentionalTravelWeekWithheldPerNight: 1, invalidTeamDays: invalidTeamDays.map((day) => day.date),
  });

  const fixtures = days.filter((day) => day.kind === 'game');
  const fixtureByWeekday = Object.fromEntries(['Saturday', 'Sunday'].map((name) => [name,
    fixtures.filter((day) => weekday(day.date) === name).length]));
  const gamesByWeek = athlete.weeks.map((week) => ({ week: week.number,
    count: week.days.filter((day) => day.kind === 'game').length }));
  record(`${label}_fixture_journey`, fixtures.length === 21 && fixtureByWeekday.Saturday === 17
    && fixtureByWeekday.Sunday === 4 && gamesByWeek.every((week) => week.count <= 1), {
    unit: 'final explicit fixture athlete-dates', total: fixtures.length, fixtureByWeekday,
    byeWeeks: athlete.weeks.filter((week) => week.events.some((event) => event.label === 'Bye week')).map((week) => week.number),
    maximumFixturesInOneWeek: Math.max(...gamesByWeek.map((week) => week.count)),
  });

  const expectedOptional = label === 'male' ? 'Gunshow' : 'Primer';
  const otherGenderOptional = label === 'male' ? 'Primer' : 'Gunshow';
  const optionalWeekFindings = athlete.weeks.flatMap((week) => {
    const weekFixtures = week.days.filter((day) => day.kind === 'game');
    return week.days.flatMap((day) => {
      if (day.name !== expectedOptional && day.name !== otherGenderOptional) return [];
      const fixture = weekFixtures[0];
      const valid = day.name === expectedOptional
        && ['Pre-season', 'In-season'].includes(week.phase)
        && weekFixtures.length === 1
        && fixture != null
        && daysBetween(day.date, fixture.date) === 1;
      return valid ? [] : [{
        week: week.number,
        phase: week.phase,
        optionalDate: day.date,
        optionalName: day.name,
        fixtureDates: weekFixtures.map((item) => item.date),
        events: week.events.map((event) => event.label),
      }];
    });
  });
  record(`${label}_gendered_optional_fixture_rule`, optionalWeekFindings.length === 0, {
    expectedOptional,
    unit: 'final gendered optional athlete-dates',
    occurrences: days.filter((day) => day.name === expectedOptional).length,
    findings: optionalWeekFindings,
  });

  record(`${label}_energy_system_semantics`, evidenceFindings.length === 0
    && densityFindings.length === 0
    && weeklyEnergySystemCounts.filter((week) => week.phase === 'Off-season')
      .every((week) => week.appProgrammedExposureDays <= 4), {
    evidenceFindings, densityFindings,
    weeklyEnergySystemCounts,
    maximumOffSeasonAppProgrammedExposureDays: Math.max(...weeklyEnergySystemCounts
      .filter((week) => week.phase === 'Off-season').map((week) => week.appProgrammedExposureDays)),
  });

  const traces = trace.traceBatches.filter((batch) => batch.athlete === label)
    .flatMap((batch) => batch.traces);
  const tracked = trackedLiftProgrammingEvidence(traces);
  record(`${label}_tracked_lift_anchors`, tracked.length === 4
    && tracked.every((item) => item.eligibleDates.length === item.deliveredDates.length
      && item.deliveredDates.length >= 2), tracked.map((item) => ({
    liftId: item.liftId, eligibleDistinctDates: item.eligibleDates.length,
    deliveredDistinctDates: item.deliveredDates.length, withheld: item.withheld,
  })));

  const redundantPullDays = days.flatMap((day) => {
    if (!/Upper Body Pull|upper_pull/i.test(day.name ?? '')) return [];
    const majorPulls = finalAthleteFacingAuditRows(day).filter((row) =>
      ['horizontal_pull', 'vertical_pull'].includes(row.section18Evidence?.mainStrengthPattern));
    return majorPulls.length <= 2 ? [] : [{ date: day.date, rows: majorPulls.map((row) => row.name) }];
  });
  record(`${label}_no_third_major_pull`, redundantPullDays.length === 0, redundantPullDays);

  const conditioningRows = days.flatMap((day) => finalAthleteFacingAuditRows(day)
    .filter((row) => resolveTemplateByName(row.catalogueIdentity ?? row.name))
    .map((row) => ({ date: day.date, row })));
  const badConditioningCopy = conditioningRows.filter(({ row }) => {
    const copy = `${row.dose ?? ''} ${row.notes ?? ''}`;
    const modality = row.modalityLabel ?? '';
    return /\bBlocks?:/i.test(copy) || /\b\d+\s*[–-]\s*\d+\s*(?:min|sec|s)\b/i.test(copy)
      || !/\bWork:/i.test(copy) || !/\bRecovery:/i.test(copy)
      || (!/^(?:run|running|on-leg)$/i.test(modality)
        && (!/Effort:\s*\d+(?:–\d+)?\/10/i.test(copy) || /\bMAS\b/i.test(copy)));
  });
  record(`${label}_conditioning_copy`, conditioningRows.length > 0
    && badConditioningCopy.length === 0, {
    templateRowPlacements: conditioningRows.length,
    badRows: badConditioningCopy.map(({ date, row }) => ({ date, name: row.name,
      modalityLabel: row.modalityLabel, dose: row.dose, notes: row.notes })),
  });

  athleteReceipts.push({
    gender: label,
    rowSummary,
    conditioningVocabulary,
    weeklyEnergySystemCounts,
    trackedLiftEvidence: tracked,
    exerciseFrequency: Object.entries(days.flatMap(finalAthleteFacingAuditRows)
      .reduce((counts, row) => ({ ...counts, [row.name]: (counts[row.name] ?? 0) + 1 }), {}))
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    injuryModifierOutcomes: athlete.actions.filter((action) =>
      /injury|recovered|sick|illness|tired|cooked|away|home/i.test(action.label))
      .map((action) => ({ date: action.date, label: action.label,
        accepted: action.result?.outcome === 'accepted' || action.result?.ok === true,
        message: action.result?.message ?? action.result?.result?.message ?? null })),
  });
}

const receipt = {
  schemaVersion: 1,
  revision,
  artifact,
  generatedAt: new Date().toISOString(),
  verdict: findings.length === 0 ? 'PASS' : 'FAIL',
  units: {
    dates: 'distinct athlete-date unless a field explicitly says occurrences',
    rows: 'final day.rows athlete-visible placements; choices expanded; Movement Prep reported separately and included in total',
    energySystems: 'athlete-days and semantic credits from day.energySystem; Speed evidence is not appended to display rows',
    fixtures: 'explicit final fixture athlete-dates, not generic hard-day occurrences',
  },
  checks,
  findings,
  athletes: athleteReceipts,
  mutationWitnesses: [
    'canonical compiler-year gate rejects exclusion of qualifying Speed and double-crediting a combined session',
    'programming audit projection gate rejects duplicated final Speed, missing Speed, and Air Bike-to-Running modality reconstruction',
    'year-row summary gate rejects omitting Movement Prep from athlete-visible totals',
    'weekly energy-system audit gate keeps fixtures, generated conditioning, Running Speed, team credit and total credits in separate typed units',
    'remainder scheduler mutation that ignores delivered history restores the exact Saturday catch-up exposure and fails the R-303 remainder cell',
  ],
  notCovered: [
    'Physical iPhone acceptance and clean Release installation',
    'Native onboarding taps (separate simulator evidence)',
    'Clinical validation of exercise prescriptions',
    'Competition/team metadata beyond distinct accepted fixture date and kind',
  ],
};
fs.writeFileSync(path.join(artifact, 'final-year-acceptance.json'), JSON.stringify(receipt, null, 2));
console.log(JSON.stringify({ revision, verdict: receipt.verdict,
  checks: checks.length, passed: checks.filter((check) => check.ok).length,
  findings, athleteSummaries: athleteReceipts.map((athlete) => ({
    gender: athlete.gender, rowSummary: athlete.rowSummary,
    conditioningVocabulary: athlete.conditioningVocabulary,
    trackedLiftEvidence: athlete.trackedLiftEvidence.map((item) => ({
      liftId: item.liftId, eligibleDistinctDates: item.eligibleDates.length,
      deliveredDistinctDates: item.deliveredDates.length, withheldOccurrences: item.withheld.length,
    })),
  })) }, null, 2));
process.exitCode = findings.length === 0 ? 0 : 1;
