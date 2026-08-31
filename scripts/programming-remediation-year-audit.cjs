'use strict';
const fs = require('node:fs'), path = require('node:path');
const repo = path.resolve(__dirname, '..');
const output = path.resolve(process.argv[2]);
const revision = require('node:child_process').execFileSync('git', ['rev-parse', 'HEAD'], {cwd:repo, encoding:'utf8'}).trim();
require(path.join(repo, 'node_modules/sucrase/register'));
const { getExerciseTags } = require(path.join(repo, 'src/data/exerciseTags'));
const { resolveTemplateByName, templateDurationMinutes } = require(path.join(repo, 'src/rules/conditioningSelection'));
const { validateEnergySystemExposureEvidence } = require(path.join(repo, 'src/rules/energySystemExposureEvidence'));
const checks = [], findings = [];
const flat = rows => rows.flatMap(row => row.choices ? row.choices.flatMap(choice =>
  flat(choice.rows).map(r => ({ ...r, modalityLabel: r.modalityLabel ?? choice.modalityLabel }))) : [row]);
for (const world of ['original-partial', 'corrected-commercial']) {
  const data = JSON.parse(fs.readFileSync(path.join(output, world, 'year-programs.json')));
  const driver = JSON.parse(fs.readFileSync(path.join(output, world, 'driver-receipt.json')));
  if (data.revision !== revision || driver.revision !== revision || driver.sourceDiff) throw Error('Non-exact year source');
  for (const athlete of data.athletes) {
    const days = athlete.weeks.flatMap(w => w.days), label = `${world}/${athlete.gender}`;
    const rows = days.flatMap(d => flat([...d.rows, ...(d.speedRows ?? [])]).map(row => ({ date: d.date, row })));
    const errors = days.filter(d => d.projectionError);
    const energySystemEvidenceFindings = athlete.weeks.flatMap(week => week.days.flatMap(day =>
      validateEnergySystemExposureEvidence(day.energySystem).map(finding => ({
        week: week.number, weekStart: week.start, date: day.date, finding,
      }))));
    const weeklyEnergySystemCounts = athlete.weeks.map(week => ({
      week: week.number, weekStart: week.start, phase: week.phase, phaseWeek: week.phaseWeek,
      totalConditioningCredits: week.days.reduce((n, day) => n + (day.energySystem?.conditioningCredits ?? 0), 0),
      appProgrammedEnergySystemDays: week.days.filter(day =>
        (day.energySystem?.appProgrammedConditioningCredits ?? 0) > 0).length,
      qualifyingSpeedDays: week.days.filter(day => day.energySystem?.qualifyingSpeed).length,
    }));
    const painful = rows.filter(({ date, row }) => date >= '2026-11-17' && date <= '2026-11-26' &&
      ['horizontal_push', 'vertical_push'].includes(getExerciseTags(row.name)?.movement) && !row.withheld);
    const corrupt = rows.filter(({ row }) => /Barbell Bike|Chest-Supported DB Bike|Continuous Aerobic Bike/.test(row.name));
    const emptyLifts = rows.filter(({ row }) => ['power', 'main_lift', 'accessory'].includes(row.role) && !row.withheld && !row.dose);
    const missingMode = rows.filter(({ row }) => row.role === 'conditioning' && !row.modalityLabel);
    const wrongMachineRecovery = rows.filter(({ row }) => /off-leg/.test(row.modalityLabel ?? '')
      && /\bwalk(?:ing|-back)?\b|spin\/paddle/i.test(row.notes ?? ''));
    const power = rows.filter(({ row }) => row.role === 'power');
    const flush = rows.filter(({ row }) => resolveTemplateByName(row.name)?.quality === 'flush');
    const badFlush = flush.filter(({ row }) => {
      const t = resolveTemplateByName(row.name);
      return !row.notes?.includes(`Total: ${templateDurationMinutes(t)} min`)
        || !row.notes?.includes('Intensity: Easy, 2–3/10')
        || !row.notes?.includes('including transitions')
        || !row.modalityLabel || /running|unavailable|Mixed modalities/.test(row.modalityLabel);
    });
    const invalidLandmine = rows.filter(({row}) => row.name === 'Explosive Landmine Press' &&
      (row.role !== 'power' || row.domainRole !== 'power' || row.power?.family !== 'upper'
       || row.section18Evidence?.role !== 'power' || row.section18Evidence.mainStrengthPattern !== null));
    const retired = rows.filter(({ row }) => resolveTemplateByName(row.name)?.automaticSelection === 'retired');
    const result = { world, gender: athlete.gender, weeks: athlete.weeks.length, athleteDays: days.length,
      restartChecks: athlete.restarts.length, successfulRestarts: athlete.restarts.filter(r => r.ok).length,
      projectedDays: days.length - errors.length,
      distinctProjectedDates: new Set(days.filter(d => !d.projectionError).map(d => d.date)).size,
      trainablePainfulPressRows: painful.length, corruptDisplayNames: corrupt.length,
      emptyLiftingDoses: emptyLifts.length, missingConditioningModes: missingMode.length,
      wrongMachineRecoveryRows: wrongMachineRecovery.length,
      powerRows: power.length, displayedPowerRestRows: power.filter(({ row }) => row.rest).length,
      flushRowPlacements: flush.length, distinctFlushDates: new Set(flush.map(r => r.date)).size,
      distinctFlushTemplates: [...new Set(flush.map(r => r.row.name))], invalidFlushRows: badFlush.length,
      optionalFlushRows: flush.filter(({ row }) => row.optional === true).length,
      coreFlushRows: flush.filter(({ row }) => row.optional !== true).length,
      invalidLandmineRows: invalidLandmine.length,
      retiredAutomaticRows: retired.length,
      weeklyEnergySystemCounts,
      energySystemEvidenceFindings };
    result.ok = result.weeks === 52 && result.athleteDays === 364 && result.restartChecks === 52 &&
      result.successfulRestarts === 52 && !errors.length && !painful.length && !corrupt.length &&
      !emptyLifts.length && !missingMode.length && !wrongMachineRecovery.length && power.length > 0 && !result.displayedPowerRestRows
      && !invalidLandmine.length && flush.length > 0 && !badFlush.length && !retired.length &&
      result.optionalFlushRows === flush.length && !energySystemEvidenceFindings.length;
    checks.push(result); findings.push({ label, errors, painful, corrupt, emptyLifts, missingMode, wrongMachineRecovery, badFlush, retired, invalidLandmine, energySystemEvidenceFindings });
  }
}
const receipt = { revision,
  unit: 'displayed row occurrences and distinct athlete dates, per athlete/input world; choices expanded; not sets or completions',
  checks, findings, notCovered: ['Rendered HTML layout', 'Physical acceptance', 'Clinical validation', 'Native onboarding taps (separate simulator evidence)'] };
fs.writeFileSync(path.join(output, 'year-audit.json'), JSON.stringify(receipt, null, 2));
console.log(JSON.stringify(checks, null, 2));
process.exitCode = checks.length === 4 && checks.every(c => c.ok) ? 0 : 1;
