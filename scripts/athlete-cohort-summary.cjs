'use strict';
// Reads every preset run under a cohort directory and prints the facts Sam
// asked the six athletes to prove, then runs the two generic analyzers per run.
// Usage: node scripts/athlete-cohort-summary.cjs <cohort-dir>
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const repo = path.resolve(__dirname, '..');
const cohort = path.resolve(process.argv[2] ?? '');
const presets = fs.readdirSync(cohort).filter((name) => fs.existsSync(path.join(cohort, name, 'run', 'year-programs.json')));

const summary = {};
for (const preset of presets) {
  const runDir = path.join(cohort, preset, 'run');
  const year = JSON.parse(fs.readFileSync(path.join(runDir, 'year-programs.json'), 'utf8'));
  const athlete = year.athletes[0];
  const weeks = athlete.weeks;
  const strengthRows = (day) => (day.rows ?? []).filter((row) => ['main_lift', 'main_strength', 'accessory', 'strength_accessory'].includes(row.role));
  const mainRows = (day) => (day.rows ?? []).filter((row) => row.role === 'main_lift' || row.section18Evidence?.role === 'main_strength');
  const byYear = {};
  for (const week of weeks) {
    const y = week.year ?? 1;
    const bucket = (byYear[y] ??= { weeks: 0, strengthDays: 0, mainRows: 0, sessionsWithRows: 0, grade: week.acceptedProgrammingInputs?.experienceLevel ?? null, loads: {} });
    bucket.weeks += 1;
    for (const day of week.days) {
      if ((day.rows ?? []).length > 0) bucket.sessionsWithRows += 1;
      if (strengthRows(day).length > 0) bucket.strengthDays += 1;
      for (const row of mainRows(day)) {
        bucket.mainRows += 1;
        if (typeof row.kg === 'number') { (bucket.loads[row.name] ??= []).push(row.kg); }
      }
    }
  }
  const loadArc = {};
  for (const [y, bucket] of Object.entries(byYear)) {
    for (const [name, kgs] of Object.entries(bucket.loads)) {
      (loadArc[name] ??= {})[`year${y}`] = { first: kgs[0], last: kgs[kgs.length - 1], max: Math.max(...kgs) };
    }
  }
  const events = weeks.flatMap((week) => week.events ?? []);
  const eventCounts = {};
  for (const event of events) { const key = String(event.label).replace(/\d+\/10/, 'N/10').replace(/\d{4}-\d{2}-\d{2}/g, ''); eventCounts[key] = (eventCounts[key] ?? 0) + 1; }
  const restarts = athlete.restarts ?? [];
  const failedRestarts = restarts.filter((r) => !r.ok).length;
  const actions = athlete.actions ?? [];
  const failedActions = actions.filter((a) => a.result && a.result.ok === false && a.result.outcome !== 'accepted').length;
  const repeatedIdentityWeeks = [];
  for (const week of weeks) {
    const seen = new Map();
    for (const day of week.days) for (const row of strengthRows(day)) {
      if (!row.catalogueIdentity || row.role === 'team_training') continue;
      seen.set(row.catalogueIdentity, (seen.get(row.catalogueIdentity) ?? 0) + 1);
    }
    const repeats = [...seen.entries()].filter(([, n]) => n > 1).map(([name, n]) => `${name}×${n}`);
    if (repeats.length) repeatedIdentityWeeks.push({ week: week.number, repeats });
  }
  const analyzers = {};
  for (const [key, script] of [['focused', 'scripts/four-confirmed-focused-audit.cjs'], ['budget', 'scripts/weekly-strength-budget-year-audit.cjs']]) {
    try {
      const out = execFileSync('node', [path.join(repo, script), runDir], { cwd: repo, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      const jsonStart = out.indexOf('{');
      const parsed = JSON.parse(out.slice(jsonStart));
      analyzers[key] = key === 'focused'
        ? { checks: parsed.checks, failures: parsed.failures, failedIds: parsed.failedIds }
        : { verdict: parsed.verdict, selectionVerdict: parsed.selectionVerdict, movementPlaneVerdict: parsed.movementPlaneVerdict,
            repeatedExact: parsed.totals?.repeatedExactExerciseBreaches, repeatedFamily: parsed.totals?.repeatedMainFamilyBreaches };
    } catch (error) {
      analyzers[key] = { error: String(error.message).slice(0, 300) };
    }
  }
  summary[preset] = {
    label: athlete.label, gender: athlete.gender, weeksCompleted: weeks.length, weeksRequested: year.assumptions?.weeks,
    loggedDays: athlete.loggedDays, restarts: restarts.length, failedRestarts, actions: actions.length, failedActions,
    byYear: Object.fromEntries(Object.entries(byYear).map(([y, b]) => [y, { weeks: b.weeks, grade: b.grade, strengthDays: b.strengthDays, mainRows: b.mainRows, sessionsWithRows: b.sessionsWithRows }])),
    loadArc: Object.fromEntries(Object.entries(loadArc).filter(([name]) => /Squat|Bench|RDL|Deadlift|Press|Pull-Up|Row/i.test(name)).slice(0, 8)),
    eventCounts, repeatedIdentityWeeks: repeatedIdentityWeeks.slice(0, 10), repeatedIdentityWeekCount: repeatedIdentityWeeks.length,
    analyzers,
  };
}
fs.writeFileSync(path.join(cohort, 'cohort-summary.json'), JSON.stringify(summary, null, 2) + '\n');
for (const [preset, s] of Object.entries(summary)) {
  console.log(`\n## ${preset} — ${s.label} (${s.gender})`);
  console.log(`weeks ${s.weeksCompleted}/${s.weeksRequested}; logged days ${s.loggedDays}; restarts ${s.restarts} (failed ${s.failedRestarts}); actions ${s.actions} (failed ${s.failedActions})`);
  for (const [y, b] of Object.entries(s.byYear)) console.log(`  year ${y}: grade ${b.grade}; ${b.weeks} weeks; ${b.strengthDays} strength days; ${b.mainRows} main-lift rows; ${b.sessionsWithRows} sessions with rows`);
  for (const [name, arc] of Object.entries(s.loadArc)) console.log(`  load ${name}: ${Object.entries(arc).map(([y, v]) => `${y} ${v.first}→${v.last} (max ${v.max})`).join(' | ')}`);
  console.log(`  events: ${Object.entries(s.eventCounts).map(([k, n]) => `${k}×${n}`).join(', ')}`);
  console.log(`  repeated identities in ${s.repeatedIdentityWeekCount} weeks ${s.repeatedIdentityWeekCount ? JSON.stringify(s.repeatedIdentityWeeks.slice(0, 3)) : ''}`);
  console.log(`  focused: ${JSON.stringify(s.analyzers.focused)}; budget: ${JSON.stringify(s.analyzers.budget)}`);
}
