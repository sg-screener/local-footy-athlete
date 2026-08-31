'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
require('sucrase/register');

const repo = path.resolve(__dirname, '..');
const arg = (name, fallback) => {
  const found = process.argv.find((value) => value.startsWith(`--${name}=`));
  return path.resolve(repo, found ? found.slice(name.length + 3) : fallback);
};
const auditPath = arg('audit-csv', 'output/lived-full-year-audit-b2f927ee/catalogue_reachability.csv');
const tracePath = arg('trace-json', 'output/programming-selection-trace-year-step2/programming-selection-traces.json');
const markdownPath = arg('markdown', 'docs/PROGRAMMING_ZERO_PLACEMENT_CLASSIFICATION_2026-08-31.md');
const jsonPath = arg('json', 'output/programming-selection-trace-year-step2/zero-placement-classification.json');

const { classifyZeroPlacement } = require('../src/rules/catalogueReachabilityClassification');
const { selectableVocabularyGroups, POWER_POOL_PENDING } = require('../src/data/selectableExerciseVocabulary');
const { CONDITIONING_META } = require('../src/data/exerciseTags');

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

const auditRows = readCsv(auditPath);
const zeros = auditRows.filter((row) => Number(row.selectedOccurrences) === 0);
const traceFile = JSON.parse(fs.readFileSync(tracePath, 'utf8'));
const distinctDecisions = new Map();
for (const batch of traceFile.traceBatches) {
  for (const trace of batch.traces) distinctDecisions.set(`${batch.athlete}|${trace.decisionId}`, trace);
}
const summaries = new Map();
for (const trace of distinctDecisions.values()) {
  for (const candidate of trace.candidates) {
    const summary = summaries.get(candidate.name) ?? {
      candidateDecisions: 0, eligibleDecisions: 0, selectedDecisions: 0,
      kinds: new Set(), rejectionReasons: new Set(),
    };
    summary.candidateDecisions += 1;
    if (candidate.eligible) summary.eligibleDecisions += 1;
    if (trace.selected === candidate.name) summary.selectedDecisions += 1;
    summary.kinds.add(trace.kind);
    for (const reason of candidate.rejectedBy) summary.rejectionReasons.add(reason);
    summaries.set(candidate.name, summary);
  }
}

const groups = selectableVocabularyGroups();
function routeFor(row) {
  const ids = groups.filter((group) => group.names.includes(row.name)).map((group) => group.id);
  const summary = summaries.get(row.name);
  if (summary) {
    return row.catalogue === 'conditioning_templates'
      ? 'automatic_conditioning_template'
      : summary.kinds.has('mobility_exercise')
        ? 'automatic_mobility_top_up'
        : 'automatic_strength_or_power';
  }
  if (POWER_POOL_PENDING.has(row.name)) return 'explicit_pending_power_placement';
  if (row.catalogue === 'exercise_tags' && CONDITIONING_META[row.name]) {
    return 'retired_or_legacy_manual_conditioning';
  }
  if (row.name === 'MetCon') return 'special_session_identity';
  if (ids.includes('mobility')) return 'automatic_mobility_top_up';
  return 'no_route';
}

const rows = zeros.map((row) => {
  const raw = summaries.get(row.name);
  const trace = raw ? {
    candidateDecisions: raw.candidateDecisions,
    eligibleDecisions: raw.eligibleDecisions,
    selectedDecisions: raw.selectedDecisions,
  } : { candidateDecisions: 0, eligibleDecisions: 0, selectedDecisions: 0 };
  const route = routeFor(row);
  const result = classifyZeroPlacement(trace, route);
  return {
    catalogue: row.catalogue,
    name: row.name,
    ...result,
    route,
    ...trace,
    rejectionReasons: raw ? [...raw.rejectionReasons].sort() : [],
  };
});
if (rows.length !== 96) throw Error(`Expected the completed audit's 96 zero rows, found ${rows.length}`);
if (rows.some((row) => !row.classification)) throw Error('Every zero row must be classified');

const counts = Object.fromEntries([...new Set(rows.map((row) => row.classification))]
  .sort().map((kind) => [kind, rows.filter((row) => row.classification === kind).length]));
const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const payload = {
  schemaVersion: 1,
  inputs: {
    auditCsv: path.relative(repo, auditPath), auditCsvSha256: sha(auditPath),
    traceJson: path.relative(repo, tracePath), traceJsonSha256: sha(tracePath),
  },
  units: {
    zeroRows: 'distinct catalogue identities with selectedOccurrences=0 in the completed audit',
    candidateDecisions: 'distinct athlete + compiler decisionId pairs after restart/rebuild de-duplication',
  },
  denominators: { auditCatalogueRows: auditRows.length, zeroRows: rows.length, distinctCompilerDecisions: distinctDecisions.size },
  counts,
  rows,
};
fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));

const lines = [
  '# Programming zero-placement classification — 2026-08-31', '',
  'Checkpoint input: completed full-year audit at `b2f927ee1b5f67dde3790b65fe7205c0697ec446` plus the typed selection trace emitted by the current canonical compiler while the preserved male/female lived-year driver ran.', '',
  `Unit and denominator: **${rows.length} distinct zero-placement catalogue identities / ${auditRows.length} total catalogue identities**. Compiler counts below are **distinct athlete + decisionId pairs / ${distinctDecisions.size} distinct compiler decisions**, after repeated rebuild and restart observations were de-duplicated.`, '',
  '## Classification totals', '',
  '| Classification | Distinct catalogue identities |', '|---|---:|',
  ...Object.entries(counts).map(([kind, count]) => `| ${kind} | ${count} |`), '',
  '## Exhaustive classification', '',
  '| Catalogue | Identity | Classification | Candidate decisions | Eligible | Selected | Evidence |',
  '|---|---|---|---:|---:|---:|---|',
  ...rows.map((row) => `| ${row.catalogue} | ${row.name.replaceAll('|', '\\|')} | ${row.classification} | ${row.candidateDecisions} | ${row.eligibleDecisions} | ${row.selectedDecisions} | ${row.reason} Route: ${row.route}. Rejections: ${row.rejectionReasons.join(', ') || 'none observed'}. |`), '',
  '## Reproduction', '',
  '```sh',
  'node scripts/run-programming-selection-trace-year.cjs --output=output/programming-selection-trace-year-step2',
  'node scripts/classify-zero-placement-catalogue.cjs',
  'npm run test:catalogue-reachability-classification',
  '```', '',
  '## NOT COVERED', '',
  '- This classification does not fix the selection, route, catalogue, or downstream-survival defects it names; later numbered steps own those changes.',
  '- A compiler selection observed during a rebuild is evidence that an automatic route exists, but the lived driver does not label whether every observed rebuild became the finally accepted block. The mismatch class therefore says selection and final delivery disagree; it does not claim which downstream stage dropped the identity.',
  '- Physical iPhone and simulator interaction are excluded by the remediation brief.', '',
];
fs.writeFileSync(markdownPath, lines.join('\n'));
console.log(JSON.stringify({ rows: rows.length, counts, markdown: path.relative(repo, markdownPath), json: path.relative(repo, jsonPath) }, null, 2));
