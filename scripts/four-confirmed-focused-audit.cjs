'use strict';

/** Read-only acceptance guard over the actual accumulated annual generator. */
const fs = require('node:fs');
const path = require('node:path');
require('sucrase/register');

const repo = path.resolve(__dirname, '..');
const artifact = path.resolve(repo, process.argv[2] ?? '');
const year = JSON.parse(fs.readFileSync(path.join(artifact, 'year-programs.json'), 'utf8'));
const {
  auditFinalAutomaticSession,
  auditFinalAutomaticWeek,
  automaticExerciseRouteForIdentity,
  MAX_AUTOMATIC_COMPOUNDS_PER_STRENGTH_SESSION,
} = require('../src/rules/automaticWeeklyExerciseSelection');
const { exerciseSuppliesLowerBodyFrontal } = require('../src/rules/movementPlaneProgramming');
const { upperAccessoryAffinity } = require('../src/data/exerciseTags');
const {
  MINIMUM_USEFUL_STRENGTH_EXERCISES,
} = require('../src/rules/minimumUsefulStrengthSession');

const checks = [];
const record = (id, ok, detail) => checks.push({ id, ok, detail });
const identity = (row) => String(row.catalogueIdentity ?? row.name ?? '');
const automaticRow = (row) => row.automaticSelection === true
  || row.section18Evidence?.provenance === 'composer_declaration';
const conditioningRow = (row) => row.role === 'conditioning'
  || row.section18Evidence?.role === 'conditioning';
const affectedWeeks = [22, 23, 29, 35, 40, 41, 42];
const frontalWeeks = [22, 23, 35, 42];
const codDrills = [
  'Low-Intensity Deceleration Drills',
  '45-Degree Cut Reps',
  'Up-Back Shuttle',
];

for (const athlete of year.athletes ?? []) {
  const label = athlete.gender;
  const weeks = athlete.weeks ?? [];
  const repeatBreaches = [];
  const familyBreaches = [];
  const compoundBreaches = [];
  for (const week of weeks) {
    const finalDays = (week.days ?? []).map((day) => ({
      dayKind: day.composedDayShape ?? null,
      exercises: (day.rows ?? []).filter((row) => automaticRow(row) && !conditioningRow(row)
        && !['mobility', 'prehab'].includes(automaticExerciseRouteForIdentity(identity(row))))
        .map((row) => ({
          identity: identity(row),
          authorship: 'automatic',
          route: row.role === 'power' ? 'power' : automaticExerciseRouteForIdentity(identity(row)),
          requestedAsMain: row.section18Evidence?.role === 'main_strength',
          requestedSlot: row.section18Evidence?.slot ?? undefined,
        })),
    }));
    const audited = auditFinalAutomaticWeek(finalDays);
    repeatBreaches.push(...audited.repeatedExact.map((item) => ({ week: week.number, ...item })));
    familyBreaches.push(...audited.repeatedMainFamilies.map((item) => ({ week: week.number, ...item })));
    finalDays.forEach((day, index) => {
      const session = auditFinalAutomaticSession(day.exercises);
      if (session.compoundCount > MAX_AUTOMATIC_COMPOUNDS_PER_STRENGTH_SESSION) {
        compoundBreaches.push({ week: week.number, date: week.days[index]?.date, ...session });
      }
    });
  }
  record(`${label}_automatic_weekly_repeats`, repeatBreaches.length === 0, repeatBreaches);
  record(`${label}_automatic_main_family_repeats`, familyBreaches.length === 0, familyBreaches);
  record(`${label}_automatic_compound_ceiling`, compoundBreaches.length === 0, compoundBreaches);

  const ordinaryShapes = new Set([
    'lower_squat', 'lower_hinge', 'upper_split_push', 'upper_split_pull',
  ]);
  const usefulFindings = [];
  const directionFindings = [];
  for (const week of weeks) for (const day of week.days ?? []) {
    if (!ordinaryShapes.has(day.composedDayShape)) continue;
    // R-342: a prehab drill is not one of the four — the same route test the
    // app's `usefulStrengthIdentityCounts` applies, so this checker reads the
    // receipt against the app's own rule rather than a second copy of it.
    const useful = (day.rows ?? []).filter((row) => {
      const evidence = row.section18Evidence;
      return ['main_strength', 'strength_accessory'].includes(evidence?.role)
        && !['core', 'midline'].includes(evidence?.slot)
        && automaticExerciseRouteForIdentity(identity(row)) !== 'prehab';
    }).length;
    const receipt = day.usefulStrengthSessionContract;
    const validReduction = useful >= MINIMUM_USEFUL_STRENGTH_EXERCISES
      ? receipt?.status === 'met'
      : receipt?.status === 'reduced_for_typed_reason'
        && (receipt.reductionReasons ?? []).length > 0;
    if (!validReduction || receipt?.delivered !== useful) {
      usefulFindings.push({ week: week.number, date: day.date, shape: day.composedDayShape,
        useful, receipt });
    }
    const direction = day.composedDayShape === 'upper_split_push' ? 'push'
      : day.composedDayShape === 'upper_split_pull' ? 'pull' : null;
    if (direction) for (const row of day.rows ?? []) {
      const slot = row.section18Evidence?.slot ?? '';
      if (!slot.includes('accessory') || !automaticRow(row)) continue;
      const affinity = upperAccessoryAffinity(identity(row));
      if (affinity !== direction && affinity !== 'both') {
        directionFindings.push({ week: week.number, date: day.date, shape: day.composedDayShape,
          exercise: identity(row), affinity });
      }
    }
  }
  record(`${label}_minimum_useful_strength_contract`, usefulFindings.length === 0, usefulFindings);
  record(`${label}_split_upper_directional_ownership`, directionFindings.length === 0,
    directionFindings);

  const november12 = weeks.flatMap((week) => week.days ?? [])
    .find((day) => day.date === '2026-11-12');
  const novemberUseful = (november12?.rows ?? []).filter((row) =>
    ['main_strength', 'strength_accessory'].includes(row.section18Evidence?.role)
    && !['core', 'midline'].includes(row.section18Evidence?.slot)).length;
  record(`${label}_november_12_lower_hinge_is_useful`,
    november12?.composedDayShape === 'lower_hinge'
      && (novemberUseful >= MINIMUM_USEFUL_STRENGTH_EXERCISES
        || (november12.usefulStrengthSessionContract?.reductionReasons ?? []).length > 0),
    { shape: november12?.composedDayShape, useful: novemberUseful,
      receipt: november12?.usefulStrengthSessionContract });

  const gunshowBreaches = [];
  for (const number of [29, 41, 42]) {
    const week = weeks[number - 1];
    if (!week) continue;
    const gunshow = week.days.find((day) => day.composedOptionalKind === 'gunshow'
      || day.name === 'Gunshow');
    const gunshowNames = new Set((gunshow?.rows ?? []).filter(automaticRow).map(identity));
    const earlier = new Set(week.days.filter((day) => day !== gunshow)
      .flatMap((day) => day.rows ?? []).filter(automaticRow).map(identity));
    for (const name of gunshowNames) if (earlier.has(name)) gunshowBreaches.push({ number, name });
  }
  record(`${label}_gunshow_uses_weekly_history`, gunshowBreaches.length === 0, gunshowBreaches);

  const frontalResults = frontalWeeks.flatMap((number) => {
    const week = weeks[number - 1];
    if (!week) return [];
    const supplied = week.days.flatMap((day) => day.rows ?? []).some((row) =>
      automaticRow(row) && exerciseSuppliesLowerBodyFrontal(
        identity(row), row.role === 'power' ? 'power' : 'strength',
      ));
    const exceptions = week.days.flatMap((day) => day.weeklyMovementPlaneExceptions ?? [])
      .filter((item) => item.kind === 'lower_body_frontal_unavailable');
    const honestException = exceptions.length === 1
      && exceptions[0].weekStartISO === week.start
      && exceptions[0].consideredDates.every((date) => date.safeExercises.length === 0);
    return [{ week: number, supplied, honestException, exceptions }];
  });
  record(`${label}_affected_frontal_weeks`, frontalResults.every((item) =>
    item.supplied || item.honestException), frontalResults);

  const codResults = [];
  for (const week of weeks) for (const day of week.days ?? []) {
    const names = (day.rows ?? []).map((row) => row.name);
    if (!codDrills.some((drill) => names.includes(drill))) continue;
    const warmup = names.indexOf('Warm-Up');
    const drillIndexes = codDrills.map((drill) => names.indexOf(drill));
    codResults.push({ week: week.number, date: day.date, warmup, drillIndexes,
      ordered: warmup >= 0 && warmup < drillIndexes[0]
        && drillIndexes.every((index, position) => index >= 0
          && (position === 0 || drillIndexes[position - 1] < index)) });
  }
  record(`${label}_cod_complete_order`, codResults.length > 0
    && codResults.every((item) => item.ordered), codResults);

  const week40 = weeks[39];
  const nested = week40?.days.find((day) =>
    (day.rows ?? []).some((row) => row.name === 'Nasal-Paced Easy'));
  const nasal = nested?.rows.find((row) => row.name === 'Nasal-Paced Easy');
  const notes = String(nasal?.notes ?? '');
  const partNames = (nested?.parts ?? []).map((part) => part.name);
  const sharesMobility = (nested?.parts ?? []).some((part) =>
    part.kind === 'recovery' || part.kind === 'mobility');
  const nestedStructureOk = !sharesMobility || (nested?.name === 'Mobility + Conditioning'
    && partNames.includes('Mobility') && partNames.includes('Conditioning'));
  const nestedOk = nestedStructureOk && nasal?.modalityLabel === 'Bike'
    && /Work:/.test(notes) && /Recovery:/.test(notes)
    && /(?:Rounds|Reps|Total):/.test(notes) && /(?:Effort|Intensity):\s*\d+\/10/.test(notes)
    && notes.trim().split('\n').length >= 5;
  record(`${label}_week40_nested_conditioning`, nestedOk, { day: nested?.date,
    title: nested?.name, partNames, modality: nasal?.modalityLabel, notes });

  const affectedPresent = affectedWeeks.filter((number) => weeks[number - 1]).length;
  record(`${label}_affected_weeks_generated`, affectedPresent === Math.min(affectedWeeks.length,
    affectedWeeks.filter((number) => number <= weeks.length).length), { affectedPresent, generatedWeeks: weeks.length });
  record(`${label}_save_restart`, athlete.restarts?.length === weeks.length
    && athlete.restarts.every((restart) => restart.ok), {
      generatedWeeks: weeks.length,
      matchingRestarts: athlete.restarts?.filter((restart) => restart.ok).length ?? 0,
    });
}

const result = {
  schemaVersion: 1,
  generatedRevision: year.revision,
  athleteCount: year.athletes?.length ?? 0,
  checks,
  failures: checks.filter((check) => !check.ok),
};
fs.writeFileSync(path.join(artifact, 'four-confirmed-focused-audit.json'),
  JSON.stringify(result, null, 2));
console.log(JSON.stringify({ checks: checks.length, failures: result.failures.length,
  failedIds: result.failures.map((failure) => failure.id) }));
if (result.failures.length > 0) process.exitCode = 1;
