'use strict';
// Reads every preset run under a cohort directory and prints the facts Sam
// asked the six athletes to prove, then runs the two generic analyzers per run.
// Usage: node scripts/athlete-cohort-summary.cjs <cohort-dir>
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

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
        (bucket.mainNames ??= {})[row.catalogueIdentity ?? row.name] = ((bucket.mainNames ??= {})[row.catalogueIdentity ?? row.name] ?? 0) + 1;
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
  // A main lift that comes back far lighter than the athlete last lifted it.
  const lastLoad = new Map();
  const loadDrops = [];
  for (const week of weeks) {
    const labels = (week.events ?? []).map((event) => String(event.label).slice(0, 24));
    for (const day of week.days) for (const row of mainRows(day)) {
      if (typeof row.kg !== 'number' || row.kg <= 0) continue;
      const previous = lastLoad.get(row.name);
      if (previous && row.kg < 0.7 * previous.kg) loadDrops.push({ week: week.number, lift: row.name, from: previous.kg, fromWeek: previous.week, to: row.kg, phase: week.phase, events: labels });
      lastLoad.set(row.name, { kg: row.kg, week: week.number });
    }
  }
  const analyzers = {};
  for (const [key, script] of [['focused', 'scripts/four-confirmed-focused-audit.cjs'], ['budget', 'scripts/weekly-strength-budget-year-audit.cjs']]) {
    try {
      const child = spawnSync('node', [path.join(repo, script), runDir], { cwd: repo, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      const out = String(child.stdout ?? '');
      const jsonStart = out.indexOf('{');
      if (jsonStart < 0) throw new Error(`no JSON: ${String(child.stderr ?? '').slice(0, 200)}`);
      const parsed = JSON.parse(out.slice(jsonStart));
      analyzers[key] = key === 'focused'
        ? { checks: parsed.checks, failures: parsed.failures, failedIds: parsed.failedIds }
        : { verdict: parsed.verdict, selectionVerdict: parsed.selectionVerdict, movementPlaneVerdict: parsed.movementPlaneVerdict,
            repeatedExact: (parsed.repeatedExactExerciseBreaches ?? []).length, repeatedFamily: (parsed.repeatedMainFamilyBreaches ?? []).length,
            dedicatedDayOwnership: (parsed.dedicatedDayOwnershipBreaches ?? []).length,
            requiredPlaneWeeks: (parsed.movementPlaneFindings ?? []).filter((f) => f.severity === 'required').map((f) => `${f.week}:${f.kind.replace('missing_', '')}`) };
    } catch (error) {
      analyzers[key] = { error: String(error.message).slice(0, 300) };
    }
  }
  summary[preset] = {
    label: athlete.label, gender: athlete.gender, weeksCompleted: weeks.length, weeksRequested: year.assumptions?.weeks,
    loggedDays: athlete.loggedDays, restarts: restarts.length, failedRestarts, actions: actions.length, failedActions,
    byYear: Object.fromEntries(Object.entries(byYear).map(([y, b]) => [y, { weeks: b.weeks, grade: b.grade, strengthDays: b.strengthDays, mainRows: b.mainRows, sessionsWithRows: b.sessionsWithRows,
      topMains: Object.entries(b.mainNames ?? {}).sort((l, r) => r[1] - l[1]).slice(0, 8).map(([n, c]) => `${n}×${c}`) }])),
    loadArc: Object.fromEntries(Object.entries(loadArc).filter(([name]) => /Squat|Bench|RDL|Deadlift|Press|Pull-Up|Row/i.test(name)).slice(0, 8)),
    eventCounts, repeatedIdentityWeeks: repeatedIdentityWeeks.slice(0, 10), repeatedIdentityWeekCount: repeatedIdentityWeeks.length,
    loadDrops,
    checkFailures: athlete.checkFailures ?? [],
    analyzers,
  };
}
fs.writeFileSync(path.join(cohort, 'cohort-summary.json'), JSON.stringify(summary, null, 2) + '\n');
for (const [preset, s] of Object.entries(summary)) {
  console.log(`\n## ${preset} — ${s.label} (${s.gender})`);
  console.log(`weeks ${s.weeksCompleted}/${s.weeksRequested}; logged days ${s.loggedDays}; restarts ${s.restarts} (failed ${s.failedRestarts}); actions ${s.actions} (failed ${s.failedActions})`);
  for (const [y, b] of Object.entries(s.byYear)) console.log(`  year ${y}: grade ${b.grade}; ${b.weeks} weeks; ${b.strengthDays} strength days; ${b.mainRows} main-lift rows; ${b.sessionsWithRows} sessions with rows; mains ${b.topMains.join(', ')}`);
  for (const [name, arc] of Object.entries(s.loadArc)) console.log(`  load ${name}: ${Object.entries(arc).map(([y, v]) => `${y} ${v.first}→${v.last} (max ${v.max})`).join(' | ')}`);
  console.log(`  events: ${Object.entries(s.eventCounts).map(([k, n]) => `${k}×${n}`).join(', ')}`);
  console.log(`  repeated identities in ${s.repeatedIdentityWeekCount} weeks ${s.repeatedIdentityWeekCount ? JSON.stringify(s.repeatedIdentityWeeks.slice(0, 3)) : ''}`);
  console.log(`  refused steps: ${s.checkFailures.length} ${JSON.stringify(s.checkFailures.map((f) => `wk${f.week} ${f.label}: ${f.detail.slice(0, 160)}`).slice(0, 8))}`);
  console.log(`  load drops >30%: ${s.loadDrops.length} ${JSON.stringify(s.loadDrops.slice(0, 6))}`);
  console.log(`  focused: ${JSON.stringify(s.analyzers.focused)}; budget: ${JSON.stringify(s.analyzers.budget)}`);
}
