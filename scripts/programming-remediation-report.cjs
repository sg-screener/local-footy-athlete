'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(process.argv[2] ?? 'outputs/programming-remedy-2026-08-28');
const baselinePath = '/Users/samgeurts/.codex/visualizations/2026/08/26/01a03b69-9022-7041-b909-ca28d5e0d275/year-programs.json';
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const flatten = rows => rows.flatMap(row => row.choices ? row.choices.flatMap(choice => flatten(choice.rows)) : [row]);
const daysOf = athlete => athlete.weeks.flatMap(week => week.days);
const frequency = athlete => {
  const counts = new Map();
  for (const day of daysOf(athlete)) for (const row of flatten(day.rows)) {
    const tally = counts.get(row.name) ?? { placements: 0, dates: new Set() };
    tally.placements++; tally.dates.add(day.date); counts.set(row.name, tally);
  }
  return Object.fromEntries([...counts].sort().map(([name, t]) => [name,
    { displayedRowPlacements: t.placements, distinctAthleteDays: t.dates.size }]));
};
const spacing = athlete => {
  const days = daysOf(athlete);
  const families = day => new Set((day.parts ?? []).flatMap(part => {
    if (part.kind === 'conditioning') return ['conditioning'];
    if (part.kind === 'strength' && /upper/i.test(part.name)) return ['upper'];
    if (part.kind === 'strength' && /lower/i.test(part.name)) return ['lower'];
    return [];
  }));
  const pairs = [];
  for (let i = 1; i < days.length; i++) for (const kind of families(days[i])) {
    if (families(days[i - 1]).has(kind)) pairs.push({ kind, from: days[i - 1].date, to: days[i].date });
  }
  return { adjacentCalendarDayPairs: pairs.length,
    distinctAthleteDaysInPairs: new Set(pairs.flatMap(pair => [pair.from, pair.to])).size, pairs };
};
const rowHTML = row => row.withheld
  ? `<li class="red"><b>${esc(row.name)} — Skip</b><p>${esc(row.withheld.explanation)}</p></li>`
  : `<li><b>${esc(row.name)}</b> ${esc(row.dose)} ${esc(row.load)}${row.optional ? ' <small>Optional</small>' : ''}${row.role === 'power' ? ' <small>Power</small>' : ''}${row.modalityLabel ? `<p class="mode">${esc(row.modalityLabel)}</p>` : ''}${row.rest ? ` · ${esc(row.rest)}` : ''}${row.notes ? `<pre>${esc(row.notes)}</pre>` : ''}${row.choices ? row.choices.map(c => `<p>${esc(c.name)} — ${esc(c.modalityLabel)} ${esc(c.description)}</p><ul>${c.rows.map(rowHTML).join('')}</ul>`).join('') : ''}</li>`;
const style = 'body{font:15px system-ui;background:#10151a;color:#e8edf0;margin:32px;line-height:1.5}h1,h2{color:#ccf56f}summary{cursor:pointer;padding:12px;background:#23303a;margin:4px 0}.week{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}article{padding:16px;background:#192229;border-radius:12px}ul{padding-left:20px}li{margin:12px 0}pre{white-space:pre-wrap;font:inherit;color:#bac9d4}small,.note,.mode{color:#a6cae3}.mode{font-weight:650}.red{color:#ff9999}section{margin-bottom:60px}a{color:#ccf56f}';
const page = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${style}</style></head><body><h1>${esc(title)}</h1>${body}</body></html>`;
const totals = [], comparisons = [], links = [], content = [];
for (const world of ['original-partial', 'corrected-commercial']) {
  const data = JSON.parse(fs.readFileSync(path.join(root, world, 'year-programs.json'), 'utf8'));
  for (const athlete of data.athletes) {
    const title = `${athlete.gender === 'male' ? 'Male' : 'Female'} year · ${world === 'original-partial' ? 'original partial kit' : 'corrected commercial gym'}`;
    const days = daysOf(athlete), rows = days.flatMap(d => flatten([...d.rows, ...(d.speedRows ?? [])]));
    const warmup = days.flatMap(d => d.warmup ?? []);
    const total = { world, gender: athlete.gender, revision: data.revision, weeks: athlete.weeks.length, athleteDays: days.length,
      displayedRowPlacements: rows.length, distinctExerciseDisplayNames: new Set(rows.map(r => r.name)).size,
      withheldRowPlacements: rows.filter(r => r.withheld).length,
      distinctWithheldAthleteDays: days.filter(d => flatten(d.rows).some(r => r.withheld)).length,
      trainableRowPlacements: rows.filter(r => !r.withheld).length,
      warmupRowPlacements: warmup.length, distinctWarmupDisplayNames: new Set(warmup.map(r => r.name)).size,
      speedRowPlacements: days.reduce((n, d) => n + (d.speedRows?.length ?? 0), 0),
      distinctSpeedAthleteDays: days.filter(d => d.speedRows?.length).length,
      restartChecks: athlete.restarts.length,
      projectionErrors: days.filter(d => d.projectionError).map(d => ({ date: d.date, error: d.projectionError })) };
    totals.push(total);
    const before = baseline.athletes.find(a => a.gender === athlete.gender);
    comparisons.push({ world, gender: athlete.gender, beforeRevision: baseline.revision, afterRevision: data.revision,
      beforeFrequency: frequency(before), afterFrequency: frequency(athlete), beforeSpacing: spacing(before), afterSpacing: spacing(athlete),
      weeks3and4: [2, 3].map(i => ({ week: i + 1, before: before.weeks[i].days.map(d => ({ date: d.date, parts: d.parts })),
        after: athlete.weeks[i].days.map(d => ({ date: d.date, parts: d.parts })) })) });
    const body = `<p>Revision ${esc(data.revision)} · ${data.start}–${data.end} · ${athlete.weeks.length} weeks</p><p>${rows.length} displayed row placements across ${days.length} athlete-days (${total.withheldRowPlacements} unavailable/Skip; ${total.trainableRowPlacements} trainable); ${total.distinctExerciseDisplayNames} distinct displayed names. Warm-ups are separate. Optional work is labelled; power rest remains in the domain prescription but is not displayed.</p>${athlete.weeks.map(w => `<details><summary>Week ${w.number} · ${w.start} · ${esc(w.phase)} ${w.phaseWeek}</summary><div class="week">${w.days.map(d => `<article><h3>${d.date}</h3><h4>${esc(d.parts?.map(p => p.name).join(' + ') || d.name || 'Rest')}</h4><p>${esc(d.type)} · ${esc(d.tier)}${['optional', 'recovery'].includes(d.tier) ? ' · Optional' : ''}</p>${d.projectionError ? `<p class="red">${esc(d.projectionError)}</p>` : ''}${d.modifiers.map(m => `<p class="note">${esc(m.title)} — ${esc(m.body)}</p>`).join('')}${d.speedRows?.length ? `<h4>Speed</h4><ul>${d.speedRows.map(rowHTML).join('')}</ul>` : ''}<ul>${d.rows.map(rowHTML).join('')}</ul>${d.warmup?.length ? `<details><summary>Warm-up</summary><ul>${d.warmup.map(r => `<li>${esc(r.name)} ${esc(r.dose)}</li>`).join('')}</ul></details>` : ''}</article>`).join('')}</div></details>`).join('')}`;
    const filename = `${world}-${athlete.gender}-year.html`;
    fs.writeFileSync(path.join(root, filename), page(title, body));
    links.push(`<li><a href="${filename}">${esc(title)}</a></li>`);
    content.push(`<section><h2>${esc(title)}</h2>${body}</section>`);
  }
}
const units = 'Frequency: one displayed row (choices expanded), including unavailable/Skip rows, NOT active prescriptions, sets, minutes, completions or selector calls. The original export omitted withholding, so before/after compares displayed rows only. Revised trainable and withheld counts are separate in year-summary.json. Warm-ups and newly exported Speed are excluded from before/after frequency because the original omitted Speed. Names are displayed names, not catalogue IDs. Spacing: adjacent calendar-day pairs sharing an Upper, Lower or Conditioning part, including forced adjacency; this is not an avoidability verdict.';
fs.writeFileSync(path.join(root, 'year-comparison.html'), page('Programming remediation · four year reports', `<ul>${links.join('')}</ul>${content.join('')}`));
fs.writeFileSync(path.join(root, 'year-summary.json'), JSON.stringify(totals, null, 2));
fs.writeFileSync(path.join(root, 'before-after-frequency-spacing.json'), JSON.stringify({ baselinePath, units, comparisons }, null, 2));
const count = f => Object.values(f).reduce((n, v) => n + v.displayedRowPlacements, 0);
const lines = comparisons.map(c => `| ${c.world} | ${c.gender} | ${count(c.beforeFrequency)} → ${count(c.afterFrequency)} | ${Object.keys(c.beforeFrequency).length} → ${Object.keys(c.afterFrequency).length} | ${c.beforeSpacing.adjacentCalendarDayPairs} → ${c.afterSpacing.adjacentCalendarDayPairs} |`);
fs.writeFileSync(path.join(root, 'before-after-summary.md'), `# Before/after programming evidence\n\nOriginal ${baseline.revision}; revised ${totals[0].revision}. Original evidence is unchanged.\n\n${units}\n\n| World | Athlete | Displayed rows (incl. Skip) | Distinct names | Adjacent same-part pairs |\n| --- | --- | --- | --- | --- |\n${lines.join('\n')}\n\nEach world contains 364 athlete-days. Full per-name placements and distinct athlete-days, every adjacency pair and week 3/4 layouts are in before-after-frequency-spacing.json. Corrected commercial kit is a separate input world, not a source-only comparison.\n\n## NOT COVERED\n\nPhysical-device acceptance; original Speed frequency; clinical validation; proof that every adjacent pair is avoidable; onboarding 2 km skip-tap consistency.\n`);
console.log(JSON.stringify(totals, null, 2));
if (totals.length !== 4 || totals.some(t => t.weeks !== 52 || t.projectionErrors.length)) process.exitCode = 1;
