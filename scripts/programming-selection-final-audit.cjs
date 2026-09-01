'use strict';

/**
 * Step 9 evidence report. Reads one completed corrected male/female year, the
 * actual compiler trace captured during that run, and the order mutant receipt.
 * Counts always name their unit: displayed row placements plus distinct dates.
 */
const fs = require('node:fs');
const path = require('node:path');
require('sucrase/register');

const repo = path.resolve(__dirname, '..');
const option = (name, fallback) => {
  const value = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return path.resolve(repo, value ? value.slice(name.length + 3) : fallback);
};
const yearPath = option('year', 'output/programming-selection-final/year-programs.json');
const tracePath = option('trace', 'output/programming-selection-final/programming-selection-traces.json');
const cataloguePath = option('catalogue', 'output/lived-full-year-audit-b2f927ee/catalogue_reachability.csv');
const orderPath = option('order', 'output/programming-selection-final/catalogue-order-comparison.json');
const output = option('output', 'output/programming-selection-final/report');

const { classifyZeroPlacement } = require('../src/rules/catalogueReachabilityClassification');
const { selectableVocabularyGroups, POWER_POOL_PENDING } = require('../src/data/selectableExerciseVocabulary');
const { CONDITIONING_META, getExerciseTags } = require('../src/data/exerciseTags');
const { resolveTemplateByName } = require('../src/rules/conditioningSelection');
const {
  programmingAuditCatalogueIdentity,
  programmingAuditRowIsConditioning,
} = require('../src/rules/programmingAuditIdentity');
const {
  consecutiveEnergySystemTriples,
  validateEnergySystemExposureEvidence,
  validateWeeklyEnergySystemDensity,
} = require('../src/rules/energySystemExposureEvidence');

function parseCsvLine(line) {
  const cells = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) { cells.push(cell); cell = ''; }
    else cell += char;
  }
  cells.push(cell);
  return cells;
}

function readCsv(file) {
  const lines = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/);
  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => Object.fromEntries(
    parseCsvLine(line).map((value, index) => [header[index], value]),
  ));
}

function flattenRows(rows, inheritedModality) {
  return rows.flatMap((row) => row.choices
    ? row.choices.flatMap((choice) => flattenRows(choice.rows, choice.modalityLabel ?? inheritedModality))
    : [{ ...row, modalityLabel: row.modalityLabel ?? inheritedModality }]);
}

function addTally(map, key, occurrence) {
  const tally = map.get(key) ?? { placements: 0, dates: new Set(), weeks: new Set(), genders: new Set() };
  tally.placements += 1;
  tally.dates.add(`${occurrence.gender}|${occurrence.day.date}`);
  tally.weeks.add(`${occurrence.gender}|${occurrence.weekStart}`);
  tally.genders.add(occurrence.gender);
  map.set(key, tally);
}

function serialiseTallies(map) {
  return [...map].map(([name, tally]) => ({
    name,
    displayedRowPlacements: tally.placements,
    distinctAthleteDates: tally.dates.size,
    distinctAthleteWeeks: tally.weeks.size,
    genders: [...tally.genders].sort(),
  })).sort((left, right) => right.displayedRowPlacements - left.displayedRowPlacements || left.name.localeCompare(right.name));
}

const year = JSON.parse(fs.readFileSync(yearPath, 'utf8'));
const traceFile = JSON.parse(fs.readFileSync(tracePath, 'utf8'));
const orderComparison = JSON.parse(fs.readFileSync(orderPath, 'utf8'));
if (year.revision !== traceFile.revision) throw Error('Year and trace revisions differ');
if (year.athletes.length !== 2 || year.athletes.some((athlete) => athlete.weeks.length !== 52)) {
  throw Error('Step 9 requires two complete 52-week athlete-years');
}

const occurrences = [];
const dayRecords = [];
for (const athlete of year.athletes) {
  for (const week of athlete.weeks) {
    for (const day of week.days) {
      const rows = [
        ...(day.warmup ?? []).map((row) => ({
          ...row, role: 'warmup_mobility', auditSurface: 'mobility_preparation',
        })),
        ...flattenRows(day.rows ?? []).map((row) => ({ ...row, auditSurface: 'session_template' })),
        ...flattenRows(day.speedRows ?? []).map((row) => ({ ...row, auditSurface: 'speed_component' })),
      ];
      const record = { athlete, gender: athlete.gender, week, weekStart: week.start, day, rows };
      dayRecords.push(record);
      for (const row of rows) occurrences.push({ ...record, row });
    }
  }
}

const exerciseTallies = new Map();
const conditioningTallies = new Map();
const catalogueTallies = new Map();
const acceptedIdentitiesByAthleteDate = new Map();
for (const occurrence of occurrences) {
  const catalogueIdentity = programmingAuditCatalogueIdentity(occurrence.row);
  const template = resolveTemplateByName(catalogueIdentity);
  addTally(template ? conditioningTallies : exerciseTallies, occurrence.row.name, occurrence);
  addTally(catalogueTallies, catalogueIdentity, occurrence);
  const dateKey = `${occurrence.gender}|${occurrence.day.date}`;
  const accepted = acceptedIdentitiesByAthleteDate.get(dateKey) ?? new Set();
  accepted.add(catalogueIdentity);
  acceptedIdentitiesByAthleteDate.set(dateKey, accepted);
}

const distinctDecisions = new Map();
for (const batch of traceFile.traceBatches) {
  for (const trace of batch.traces) {
    distinctDecisions.set(`${batch.athlete}|${trace.decisionId}`, {
      athlete: batch.athlete, trace,
    });
  }
}
const traceSummaries = new Map();
for (const { athlete, trace } of distinctDecisions.values()) {
  for (const candidate of trace.candidates) {
    const summary = traceSummaries.get(candidate.name) ?? {
      candidateDecisions: 0, eligibleDecisions: 0,
      attemptSelectedDecisions: 0, selectedDecisions: 0,
      kinds: new Set(), rejectionReasons: new Set(), nonfinalSelectionExamples: [],
    };
    summary.candidateDecisions += 1;
    if (candidate.eligible) summary.eligibleDecisions += 1;
    if (trace.selected === candidate.name) {
      summary.attemptSelectedDecisions += 1;
      const acceptedIdentities = acceptedIdentitiesByAthleteDate
        .get(`${athlete}|${trace.need.dateISO}`) ?? new Set();
      if (acceptedIdentities.has(candidate.name)) {
        summary.selectedDecisions += 1;
      } else {
        summary.nonfinalSelectionExamples.push({
          athlete,
          date: trace.need.dateISO,
          decisionId: trace.decisionId,
          owner: trace.owner,
          acceptedFinalIdentities: [...acceptedIdentities].sort(),
        });
      }
    }
    summary.kinds.add(trace.kind);
    for (const reason of candidate.rejectedBy) summary.rejectionReasons.add(reason);
    traceSummaries.set(candidate.name, summary);
  }
}

const vocabularyGroups = selectableVocabularyGroups();
function routeFor(row) {
  const groupIds = vocabularyGroups.filter((group) => group.names.includes(row.name)).map((group) => group.id);
  const summary = traceSummaries.get(row.name);
  if (summary) return row.catalogue === 'conditioning_templates'
    ? 'automatic_conditioning_template'
    : summary.kinds.has('mobility_exercise')
      ? 'automatic_mobility_top_up'
      : 'automatic_strength_or_power';
  if (POWER_POOL_PENDING.has(row.name)) return 'explicit_pending_power_placement';
  if (row.catalogue === 'exercise_tags' && CONDITIONING_META[row.name]) return 'retired_or_legacy_manual_conditioning';
  if (row.name === 'MetCon') return 'special_session_identity';
  if (groupIds.includes('mobility')) return 'automatic_mobility_top_up';
  return 'no_route';
}

const catalogue = readCsv(cataloguePath);
const zeroPlacements = catalogue.filter((row) => !catalogueTallies.has(row.name)).map((row) => {
  const summary = traceSummaries.get(row.name);
  const trace = summary ? {
    candidateDecisions: summary.candidateDecisions,
    eligibleDecisions: summary.eligibleDecisions,
    attemptSelectedDecisions: summary.attemptSelectedDecisions,
    selectedDecisions: summary.selectedDecisions,
  } : {
    candidateDecisions: 0, eligibleDecisions: 0,
    attemptSelectedDecisions: 0, selectedDecisions: 0,
  };
  const route = routeFor(row);
  return {
    catalogue: row.catalogue,
    name: row.name,
    ...classifyZeroPlacement(trace, route),
    ...trace,
    route,
    rejectionReasons: summary ? [...summary.rejectionReasons].sort() : [],
    nonfinalSelectionExamples: summary ? summary.nonfinalSelectionExamples : [],
  };
});
const zeroClassificationCounts = Object.fromEntries(
  [...new Set(zeroPlacements.map((row) => row.classification))].sort()
    .map((classification) => [classification, zeroPlacements.filter((row) => row.classification === classification).length]),
);

function concentration(labelOf, filter) {
  const families = new Map();
  for (const occurrence of occurrences.filter(filter)) {
    const family = labelOf(occurrence);
    const row = families.get(family) ?? { placements: 0, dates: new Set(), identities: new Map() };
    row.placements += 1;
    row.dates.add(`${occurrence.gender}|${occurrence.day.date}`);
    row.identities.set(occurrence.row.name, (row.identities.get(occurrence.row.name) ?? 0) + 1);
    families.set(family, row);
  }
  return [...families].map(([family, row]) => {
    const identities = [...row.identities].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return {
      family,
      displayedRowPlacements: row.placements,
      distinctAthleteDates: row.dates.size,
      distinctDisplayNames: row.identities.size,
      leadingIdentity: identities[0]?.[0] ?? null,
      leadingIdentityPlacements: identities[0]?.[1] ?? 0,
      leadingIdentityShare: row.placements ? Number(((identities[0][1] / row.placements) * 100).toFixed(1)) : 0,
    };
  }).sort((left, right) => right.displayedRowPlacements - left.displayedRowPlacements || left.family.localeCompare(right.family));
}

const exerciseConcentration = concentration(
  ({ row }) => getExerciseTags(programmingAuditCatalogueIdentity(row))?.movement
    ?? row.domainRole ?? row.role ?? 'unclassified',
  ({ row }) => !programmingAuditRowIsConditioning(row) && !row.withheld,
);
const conditioningConcentration = concentration(
  ({ row }) => resolveTemplateByName(programmingAuditCatalogueIdentity(row))?.quality ?? 'unclassified',
  ({ row }) => programmingAuditRowIsConditioning(row) && !row.withheld,
);

const projectionErrors = dayRecords.filter(({ day }) => day.projectionError)
  .map(({ gender, day }) => ({ gender, date: day.date, error: day.projectionError }));
const restartFailures = year.athletes.flatMap((athlete) => athlete.restarts
  .filter((restart) => !restart.ok).map((restart) => ({ gender: athlete.gender, ...restart })));
const energySystemEvidenceFindings = dayRecords.flatMap(({ gender, weekStart, day }) =>
  validateEnergySystemExposureEvidence(day.energySystem).map((finding) => ({
    gender, weekStart, date: day.date, finding, evidence: day.energySystem ?? null,
  })));
const weeklyEnergySystemCounts = year.athletes.flatMap((athlete) => athlete.weeks.map((week) => ({
  gender: athlete.gender,
  week: week.number,
  weekStart: week.start,
  phase: week.phase,
  phaseWeek: week.phaseWeek,
  totalConditioningCredits: week.days.reduce((total, day) =>
    total + (day.energySystem?.conditioningCredits ?? 0), 0),
  appProgrammedEnergySystemDays: week.days.filter((day) =>
    (day.energySystem?.appProgrammedConditioningCredits ?? 0) > 0).length,
  qualifyingSpeedDays: week.days.filter((day) => day.energySystem?.qualifyingSpeed).length,
})));
const energySystemDensityFindings = year.athletes.flatMap((athlete) => [
  ...athlete.weeks.flatMap((week) => validateWeeklyEnergySystemDensity({
    phase: week.phase, phaseWeek: week.phaseWeek,
    days: week.days.map((day) => ({ date: day.date, energySystem: day.energySystem })),
  }).map((finding) => ({
    gender: athlete.gender, week: week.number, weekStart: week.start, finding,
  }))),
  ...consecutiveEnergySystemTriples(athlete.weeks.flatMap((week) =>
    week.days.map((day) => ({ date: day.date, energySystem: day.energySystem }))))
    .map((dates) => ({
      gender: athlete.gender, finding: 'three_consecutive_app_programmed_energy_system_days', dates,
    })),
]);
const missingConditioningModalities = occurrences.filter(({ row }) =>
  row.auditSurface === 'session_template' && programmingAuditRowIsConditioning(row) && !row.modalityLabel)
  .map(({ gender, day, row }) => ({
    gender, date: day.date, template: programmingAuditCatalogueIdentity(row),
  }));
const squatlessLowerSessions = dayRecords.filter(({ day, rows }) =>
  (day.parts ?? []).some((part) => part.kind === 'strength' && /lower squat/i.test(part.name)) &&
  !rows.some((row) => !row.withheld
    && getExerciseTags(programmingAuditCatalogueIdentity(row))?.movement === 'squat' &&
    ['main_lift', 'main_strength'].includes(row.domainRole ?? row.role)))
  .map(({ gender, day, rows }) => ({
    gender, date: day.date, parts: day.parts, rows: rows.map((row) => row.name),
    modifiers: day.modifiers ?? [],
  }));
const silentTeamGymSessions = dayRecords.filter(({ day, rows }) => day.type === 'Team Training' &&
  rows.some((row) => ['power', 'main_lift', 'accessory', 'main_strength', 'strength_accessory'].includes(row.domainRole ?? row.role)) &&
  !(day.parts ?? []).some((part) => part.kind === 'strength'))
  .map(({ gender, day, rows }) => ({ gender, date: day.date, parts: day.parts, rows: rows.map((row) => row.name) }));
const shoulderInjuryRows = occurrences.filter(({ day, row }) => day.date >= '2026-11-17' && day.date < '2026-11-27' && !row.withheld);
const shoulderTricepsRows = shoulderInjuryRows.filter(({ row }) => /triceps/i.test(row.name));
const bottomsUpRows = occurrences.filter(({ row }) => /Bottoms-Up KB Press/i.test(row.name));
const bottomsUpMax = bottomsUpRows.reduce((best, occurrence) => {
  const kg = Number(occurrence.row.kg ?? String(occurrence.row.load ?? '').match(/[\d.]+/)?.[0] ?? 0);
  return !best || kg > best.kg ? { gender: occurrence.gender, date: occurrence.day.date, kg, dose: occurrence.row.dose } : best;
}, null);
const primers = dayRecords.filter(({ day }) => (day.parts ?? []).some((part) => /primer/i.test(part.name)))
  .map(({ gender, day, rows }) => ({
    gender, date: day.date,
    checkedRows: rows.filter((row) => !row.optional).length,
    optionalRows: rows.filter((row) => row.optional).length,
    rows: rows.map((row) => ({ name: row.name, optional: !!row.optional })),
  }));
const implausibleConditioningDoses = dayRecords.flatMap(({ gender, day }) => {
  const label = day.conditioningIdentity?.doseLabel ?? '';
  const match = label.match(/(\d+)\s*×\s*(\d+)\s*min/i);
  return match && Number(match[1]) * Number(match[2]) > 120
    ? [{ gender, date: day.date, doseLabel: label, impliedMinutes: Number(match[1]) * Number(match[2]) }] : [];
});
const qualityOwnershipRows = occurrences.filter(({ row }) => /week(?:'|’)s one quality exposure/i.test(row.notes ?? ''));
const qualityOwnershipByWeek = new Map();
for (const occurrence of qualityOwnershipRows) {
  const key = `${occurrence.gender}|${occurrence.weekStart}`;
  qualityOwnershipByWeek.set(key, (qualityOwnershipByWeek.get(key) ?? 0) + 1);
}
const duplicateQualityOwnershipWeeks = [...qualityOwnershipByWeek].filter(([, count]) => count > 1)
  .map(([key, count]) => ({ athleteWeek: key, ownershipSentenceOccurrences: count }));

const report = {
  schemaVersion: 1,
  auditedRevision: year.revision,
  units: {
    frequency: 'visible row placements across mobility preparation, session template and speed components, with choices expanded; distinct athlete dates and weeks include gender in the key; not sets, minutes, completions or selector calls',
    trace: 'distinct athlete + compiler decisionId pairs after rebuild/restart de-duplication',
    acceptedSelection: 'an attempt-selected identity counted as selected only when the accepted final rows contain that raw catalogue identity on the same athlete-date',
    concentration: 'trainable displayed row placements grouped by exercise movement or conditioning quality; withheld rows excluded',
    energySystem: 'canonical classifier credits plus distinct app-programmed athlete-days; proper Speed counts once, anchors retain their existing separate credit',
  },
  denominators: {
    athleteYears: year.athletes.length,
    weeksPerAthlete: year.athletes.map((athlete) => athlete.weeks.length),
    athleteDays: dayRecords.length,
    displayedRowPlacements: occurrences.length,
    catalogueIdentities: catalogue.length,
    distinctCompilerDecisions: distinctDecisions.size,
  },
  catalogueIdentityFrequency: serialiseTallies(catalogueTallies),
  exerciseFrequency: serialiseTallies(exerciseTallies),
  conditioningFrequency: serialiseTallies(conditioningTallies),
  zeroPlacements: { count: zeroPlacements.length, classificationCounts: zeroClassificationCounts, rows: zeroPlacements },
  concentration: { exerciseMovement: exerciseConcentration, conditioningQuality: conditioningConcentration },
  energySystem: { weeklyCounts: weeklyEnergySystemCounts,
    evidenceFindings: energySystemEvidenceFindings,
    densityFindings: energySystemDensityFindings },
  catalogueOrderMutation: orderComparison,
  remainingStrangeFinalSessions: {
    projectionErrors,
    restartFailures,
    missingConditioningModalities,
    squatlessLowerSessions,
    silentTeamGymSessions,
    shoulderInjuryTrainableRows: shoulderInjuryRows.length,
    shoulderInjuryTricepsRows: shoulderTricepsRows.length,
    shoulderInjuryTricepsShare: shoulderInjuryRows.length
      ? Number(((shoulderTricepsRows.length / shoulderInjuryRows.length) * 100).toFixed(1)) : 0,
    bottomsUpKbPressMaximum: bottomsUpMax,
    primers,
    implausibleConditioningDoses,
    duplicateQualityOwnershipWeeks,
  },
  notCovered: [
    'Physical iPhone execution or acceptance',
    'Native onboarding taps',
    'Athlete profiles beyond the preserved male/female lived-year inputs',
    'Clinical validation of injury programming',
  ],
};

const zeroLines = zeroPlacements.map((row) =>
  `| ${row.catalogue} | ${row.name.replaceAll('|', '\\|')} | ${row.classification} | ${row.candidateDecisions} | ${row.eligibleDecisions} | ${row.attemptSelectedDecisions} | ${row.selectedDecisions} | ${row.reason} |`);
const frequencyLines = (rows) => rows.map((row) =>
  `| ${row.name.replaceAll('|', '\\|')} | ${row.displayedRowPlacements} | ${row.distinctAthleteDates} | ${row.distinctAthleteWeeks} |`);
const concentrationLines = (rows) => rows.map((row) =>
  `| ${row.family} | ${row.displayedRowPlacements} | ${row.distinctDisplayNames} | ${row.leadingIdentity} | ${row.leadingIdentityShare}% |`);
const strange = report.remainingStrangeFinalSessions;
const markdown = [
  '# Corrected programming-selection lived-year audit', '',
  `Audited checkpoint: \`${year.revision}\`. Two athlete-years, 52 weeks and 364 athlete-days each; ${occurrences.length} displayed row placements.`, '',
  `Count unit: ${report.units.frequency}.`, '',
  '## Exercise frequency', '',
  '| Display name | Row placements | Distinct athlete-dates | Distinct athlete-weeks |', '|---|---:|---:|---:|',
  ...frequencyLines(report.exerciseFrequency), '',
  '## Conditioning frequency', '',
  '| Display name | Row placements | Distinct athlete-dates | Distinct athlete-weeks |', '|---|---:|---:|---:|',
  ...frequencyLines(report.conditioningFrequency), '',
  '## Every zero-placement catalogue identity', '',
  `${zeroPlacements.length} / ${catalogue.length} catalogue identities have zero final displayed placements. Classification totals: ${Object.entries(zeroClassificationCounts).map(([kind, count]) => `${kind}=${count}`).join(', ')}.`, '',
  '| Catalogue | Identity | Classification | Considered | Eligible | Attempt-selected | Accepted-final selected | Evidence |', '|---|---|---|---:|---:|---:|---:|---|',
  ...zeroLines, '',
  '## Concentration by family', '',
  'Trainable displayed rows only; each share is the leading identity within that family, not a share of the whole program.', '',
  '### Exercise movement', '',
  '| Movement | Placements | Distinct names | Leading identity | Leading share |', '|---|---:|---:|---|---:|',
  ...concentrationLines(exerciseConcentration), '',
  '### Conditioning quality', '',
  '| Quality | Placements | Distinct names | Leading identity | Leading share |', '|---|---:|---:|---|---:|',
  ...concentrationLines(conditioningConcentration), '',
  '## Catalogue-order mutation', '',
  `Reversing every automatic strength, power and conditioning catalogue changed **${orderComparison.differingAthleteDays} / 728 final athlete-days**; same=${orderComparison.same}.`, '',
  '## Remaining strange final sessions', '',
  `- Projection errors: ${strange.projectionErrors.length}; failed restart checks: ${strange.restartFailures.length}.`,
  `- Conditioning rows missing an explicit modality: ${strange.missingConditioningModalities.length}.`,
  `- Lower Squat sessions without a trainable squat main movement: ${strange.squatlessLowerSessions.length}.`,
  `- Team Training days with gym rows but no explicit Strength part: ${strange.silentTeamGymSessions.length}.`,
  `- Shoulder-injury window: ${strange.shoulderInjuryTricepsRows} triceps-named rows / ${strange.shoulderInjuryTrainableRows} trainable rows (${strange.shoulderInjuryTricepsShare}%).`,
  `- Bottoms-Up KB Press maximum: ${strange.bottomsUpKbPressMaximum ? `${strange.bottomsUpKbPressMaximum.kg} kg for ${strange.bottomsUpKbPressMaximum.dose} on ${strange.bottomsUpKbPressMaximum.date}` : 'not placed'}.`,
  `- Primer sessions: ${strange.primers.length}; optional rows: ${strange.primers.reduce((total, primer) => total + primer.optionalRows, 0)}. Full composition is listed in the JSON receipt.`,
  `- Conditioning identity dose labels implying over 120 minutes: ${strange.implausibleConditioningDoses.length}.`,
  `- Athlete-weeks with more than one “one quality exposure” sentence: ${strange.duplicateQualityOwnershipWeeks.length}.`, '',
  '## Weekly energy-system counts', '',
  'These counts consume the canonical compiler evidence. Speed keeps its Speed identity and contributes once to the weekly conditioning total.', '',
  '| Athlete | Week | Start | Phase | Total conditioning credits | App-programmed exposure days | Qualifying Speed days |',
  '|---|---:|---|---|---:|---:|---:|',
  ...weeklyEnergySystemCounts.map((row) => `| ${row.gender} | ${row.week} | ${row.weekStart} | ${row.phase} | ${row.totalConditioningCredits} | ${row.appProgrammedEnergySystemDays} | ${row.qualifyingSpeedDays} |`), '',
  `Energy-system evidence findings: ${energySystemEvidenceFindings.length}; density/spacing findings: ${energySystemDensityFindings.length}.`, '',
  'Full dated rows for every non-zero finding are in `programming-selection-final-audit.json`.', '',
  '## Exact commands', '', '```sh',
  'node scripts/programming-remediation-year.cjs --kit=full --output=<audit>/authored',
  'node scripts/run-programming-catalogue-order-year.cjs --kit=full --output=<audit>/order-authored',
  'node scripts/run-programming-catalogue-order-year.cjs --kit=full --reverse-catalogues --output=<audit>/order-reversed',
  'node scripts/compare-programming-years.cjs <audit>/order-authored/year-programs.json <audit>/order-reversed/year-programs.json > <audit>/catalogue-order-comparison.json',
  'node scripts/programming-selection-final-audit.cjs --year=<audit>/authored/year-programs.json --trace=<audit>/authored/programming-selection-traces.json --order=<audit>/catalogue-order-comparison.json --output=<audit>/report',
  'npm run test:programming-selection-release', '```', '',
  '## NOT COVERED', '', ...report.notCovered.map((item) => `- ${item}`), '',
].join('\n');

fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'programming-selection-final-audit.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(output, 'PROGRAMMING_SELECTION_FINAL_AUDIT.md'), markdown);
console.log(JSON.stringify({
  auditedRevision: year.revision,
  exerciseNames: report.exerciseFrequency.length,
  conditioningNames: report.conditioningFrequency.length,
  zeroPlacements: zeroPlacements.length,
  zeroClassificationCounts,
  differingAthleteDays: orderComparison.differingAthleteDays,
  remainingStrangeCounts: Object.fromEntries(Object.entries(strange).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, value.length])),
  output,
}, null, 2));
if (!orderComparison.same || orderComparison.differingAthleteDays !== 0 || projectionErrors.length ||
    restartFailures.length || missingConditioningModalities.length || squatlessLowerSessions.length ||
    silentTeamGymSessions.length || duplicateQualityOwnershipWeeks.length ||
    energySystemEvidenceFindings.length || energySystemDensityFindings.length) process.exitCode = 1;
