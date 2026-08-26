/**
 * Verify docs/INJURY_MATRIX_REVIEW_2026-07-28.xlsx — the AUTHORED FINAL injury
 * matrix, generated from Sam's ruling set (2026-07-28).
 *
 * Run: `npm run verify:injury-matrix-sheet`
 *
 * ── The centrepiece ──
 *
 * This does NOT check the sheet against the JSON it was built from — that would
 * only prove the writer agrees with itself. It parses the RULE GRIDS, EXCEPTIONS
 * and DECLARATION out of the workbook, re-evaluates Sam's resolution model from
 * scratch, and checks the result matches the derived matrix tab cell for cell.
 *
 * It also holds the sheet to `exerciseTags.ts` where the two still overlap: every
 * rating the code authors today must survive into the final matrix, because Sam
 * ruled the exceptions to preserve exactly those judgements.
 *
 * ── Assertion classes ──
 *
 *   STRUCTURAL — must hold for every version. Tab shape, header positions pinned
 *     BY CONTENT (a blank row is invisible to the reader, so "no blank rows" is a
 *     vacuous check — only content-pinned headers catch a row shift), closed
 *     vocabularies, and the invariants Sam's rulings imply.
 *
 *   RULED SNAPSHOT — pins the matrix as Sam ruled it on 2026-07-28. These SHOULD
 *     fail if the ruling set changes, and the fix is to re-run the pipeline, not
 *     to edit the numbers.
 *
 * Not wired into `test:bible`: the workbook is Phase 1 output, and Phase 2 is
 * where code is held equal to it in both directions.
 */
import fs from 'fs';
import path from 'path';

import { readXlsx, readSheetRecords, XlsxSheet } from '../src/__tests__/support/xlsxReader';
import { EXERCISE_TAGS } from '../src/data/exerciseTags';

const REPO_ROOT = path.resolve(__dirname, '..');
const FILE = path.join(REPO_ROOT, 'docs', 'INJURY_MATRIX_REVIEW_2026-07-28.xlsx');
const RULINGS = path.join(REPO_ROOT, 'docs', 'INJURY_MATRIX_RULINGS_2026-07-28.json');
const TAGS_SOURCE = path.join(REPO_ROOT, 'src', 'data', 'exerciseTags.ts');
const MUSCLE_SOURCE = path.join(REPO_ROOT, 'src', 'data', 'muscleExperienceMetadata.ts');

const ruling = JSON.parse(fs.readFileSync(RULINGS, 'utf8'));
const REGIONS: string[] = ruling.regions;
const NEW_REGIONS: string[] = ruling.newRegions;
const OLD_TO_NEW: Record<string, string> = {
  adductor: 'groin', pubalgia: 'groin', lowerBack: 'lowerBack', knee: 'knee',
  hamstring: 'hamstring', calf: 'calf', ankle: 'ankle/foot', shoulder: 'shoulder',
  elbow: 'elbow', wrist: 'wrist/hand',
};
const RANK: Record<string, number> = { good: 0, caution: 1, avoid: 2 };
const strictest = (values: string[]): string => values.reduce((a, b) => (RANK[b] > RANK[a] ? b : a));

let failures = 0;
let snapshotFailures = 0;
function ok(kind: 'structural' | 'snapshot', label: string, condition: boolean, detail = ''): void {
  const tag = kind === 'structural' ? 'struct' : ' ruled';
  if (condition) { console.log(`  ok   [${tag}] ${label}`); return; }
  failures += 1;
  if (kind === 'snapshot') snapshotFailures += 1;
  console.log(`  FAIL [${tag}] ${label}${detail ? ` — ${detail}` : ''}`);
}

/* ── What the CODE holds now ──
 *
 * Post-migration every entry writes all 13 regions explicitly, so this is a
 * straight read: there is no longer an omitted-vs-authored ambiguity to work
 * around, because `inj()` is gone and a partial profile cannot be written.
 *
 * This is the PHASE 2 EQUALITY GATE. The sheet and the code are held equal in
 * BOTH directions — a cell edited in either without the other fails the build.
 */
interface CodeExercise { name: string; movement: string; ratings: Record<string, string>; }

function readCode(): CodeExercise[] {
  const body = fs.readFileSync(TAGS_SOURCE, 'utf8');
  const map = body.slice(body.indexOf('export const EXERCISE_TAGS'));
  const out: CodeExercise[] = [];
  for (const entry of map.matchAll(/^ {2}'([^']+)':\s*\{([\s\S]*?)^ {2}\},/gm)) {
    const [, name, block] = entry;
    const injury = /injury:\s*\{([\s\S]*?)\n {4}\}/.exec(block);
    if (!injury) throw new Error(`no explicit injury profile on "${name}"`);
    const ratings: Record<string, string> = {};
    for (const kv of injury[1].matchAll(/'([^']+)':\s*'(\w+)'/g)) ratings[kv[1]] = kv[2];
    out.push({ name, movement: /movement:\s*'([^']+)'/.exec(block)![1], ratings });
  }
  return out;
}
const code = readCode();
const byName = new Map(code.map((e) => [e.name, e]));

/**
 * The PRE-MIGRATION ratings, from the pinned snapshot.
 *
 * Two claims can only be checked against this, never against the migrated file —
 * which contains the result and would agree with itself trivially:
 *   1. stricter-wins on the conditioning merge, and
 *   2. Sam's LIFT, NEVER RE-DECIDE law: no authored rating may be lost when a
 *      thin rule dies under the n>=2 minimum support.
 */
function readPreMigrationRatings(): Map<string, Record<string, string>> {
  const PRE = path.join(REPO_ROOT, 'docs', 'INJURY_MATRIX_PRE_MIGRATION_RATINGS.ts');
  const text = fs.readFileSync(PRE, 'utf8');
  const map = text.slice(text.indexOf('export const EXERCISE_TAGS'));
  const PRE_TO_NEW: Record<string, string> = {
    adductor: 'groin', pubalgia: 'groin', lowerBack: 'lowerBack', knee: 'knee',
    hamstring: 'hamstring', calf: 'calf', ankle: 'ankle/foot', shoulder: 'shoulder',
    elbow: 'elbow', wrist: 'wrist/hand',
  };
  const out = new Map<string, Record<string, string>>();
  for (const entry of map.matchAll(/^ {2}'([^']+)':\s*\{([\s\S]*?)^ {2}\},/gm)) {
    const injury = /injury:\s*(SAFE|inj\(\{([\s\S]*?)\}\))/.exec(entry[2]);
    const ratings: Record<string, string> = {};
    if (injury && injury[1] !== 'SAFE') {
      for (const kv of injury[2].matchAll(/(\w+):\s*'(\w+)'/g)) {
        const region = PRE_TO_NEW[kv[1]];
        if (!region) continue;
        // adductor + pubalgia both land on groin. Where they DISAGREED, Sam
        // ruled the value by hand — that is a decision, not a loss, so his
        // ruling is what must survive. Where they agreed, keep the value.
        ratings[region] = ratings[region] && RANK[ratings[region]] > RANK[kv[2]]
          ? ratings[region] : kv[2];
      }
    }
    const ruled = ruling.conflictResolutions[entry[1]];
    if (ruled) ratings.groin = ruled;
    out.set(entry[1], ratings);
  }
  return out;
}

/* ── Workbook shape ── */

const sheets = readXlsx(FILE);
console.log(`tabs: ${sheets.map((s) => s.name).join(' | ')}\n`);
const TABS = ['Architecture & Rules', 'Rules — pattern', 'Rules — muscle', 'Exceptions',
  'Conditioning', 'Routing', 'Final matrix'];
ok('structural', '7 tabs in order', sheets.map((s) => s.name).join(',') === TABS.join(','),
  sheets.map((s) => s.name).join(','));

function sheetNamed(tab: string): XlsxSheet | undefined {
  return sheets.find((candidate) => candidate.name === tab);
}
/**
 * Headers are pinned BY CONTENT at their expected reader row. A blank row emits
 * no <row> element, so it is invisible from the read side and "assert no blank
 * rows" can never fail (proven by mutation). Only this catches a row shift.
 */
function assertHeaderAt(tab: string, index: number, expected: readonly string[]): void {
  const sheet = sheetNamed(tab);
  ok('structural', `"${tab}" exists`, sheet !== undefined);
  if (!sheet) return;
  const row = sheet.rows[index - 1] ?? [];
  const actual = expected.map((_, column) => (row[column] ?? '').trim());
  ok('structural', `"${tab}" header intact at reader row ${index}`,
    expected.every((cell, column) => actual[column] === cell), `got [${actual.join(', ')}]`);
}
assertHeaderAt('Rules — pattern', 5, ['Movement pattern', ...REGIONS, 'binds']);
assertHeaderAt('Rules — muscle', 5, ['Primary muscle', ...REGIONS, 'binds']);
assertHeaderAt('Exceptions', 4, ['Exercise', 'Region', 'The rules say', 'RULED', 'Direction']);
assertHeaderAt('Conditioning', 5, ['Exercise', 'Family', ...REGIONS]);
assertHeaderAt('Routing', 5, ['Athlete types…', 'RULED region', 'Status']);
assertHeaderAt('Final matrix', 5, ['Group', 'Exercise', 'Pattern', ...REGIONS]);

ok('structural', '13 regions, in Sam\'s order', REGIONS.length === 13);
ok('structural', 'ribs sits between ankle/foot and lowerBack',
  REGIONS.indexOf('ribs') === REGIONS.indexOf('ankle/foot') + 1
  && REGIONS.indexOf('lowerBack') === REGIONS.indexOf('ribs') + 1);

/* ── Parse the rule grids ── */

const RULE_CELL = /^(good|caution|avoid) ·(Sam|\d+\/\d+)( split)?$|^—$/;
function parseGrid(tab: string, axisLabel: string) {
  const records = readSheetRecords(FILE, tab, 5);
  const rules: Record<string, Record<string, string | null>> = {};
  const malformed: string[] = [];
  let samAuthored = 0;
  let evidence = 0;
  for (const record of records) {
    const key = record[axisLabel];
    if (!key || key.startsWith('DECLARATION')) continue;
    rules[key] = {};
    for (const region of REGIONS) {
      const cell = (record[region] ?? '').trim();
      if (!RULE_CELL.test(cell)) { malformed.push(`${tab} ${key}/${region}: "${cell}"`); continue; }
      if (cell === '—') { rules[key][region] = null; continue; }
      rules[key][region] = cell.split(' ')[0];
      if (cell.includes('·Sam')) samAuthored += 1; else evidence += 1;
    }
  }
  ok('structural', `"${tab}" rule cells use the closed vocabulary`, malformed.length === 0,
    malformed.slice(0, 3).join(' ; '));
  return { rules, samAuthored, evidence };
}
const pattern = parseGrid('Rules — pattern', 'Movement pattern');
const muscle = parseGrid('Rules — muscle', 'Primary muscle');

ok('snapshot', '118 rules in total (n>=2 minimum support, both axes)',
  pattern.samAuthored + pattern.evidence + muscle.samAuthored + muscle.evidence === 118,
  `got ${pattern.samAuthored + pattern.evidence + muscle.samAuthored + muscle.evidence}`);
ok('snapshot', '22 rules authored by Sam for the new regions',
  pattern.samAuthored + muscle.samAuthored === 22,
  `got ${pattern.samAuthored + muscle.samAuthored}`);
ok('structural', 'every new-region rule is Sam-authored, never evidence-derived',
  [pattern.rules, muscle.rules].every((grid) => Object.values(grid).every((byRegion) =>
    NEW_REGIONS.every((region) => byRegion[region] === null || byRegion[region] === 'caution'))));

/* ── Exceptions and declaration ── */

const exceptionRows = readSheetRecords(FILE, 'Exceptions', 4);
const exceptions: Record<string, string> = {};
for (const record of exceptionRows) exceptions[`${record.Exercise}|${record.Region}`] = record.RULED;
// 24 → 27 on 2026-08-26: Sam ruled the rack-position squats (Front/Box/High
// Box) match Back Squat's existing shoulder 'caution' exception — verbatim,
// on Front Squat for a bad shoulder: "remove it from good".
// 27 → 33 on 2026-08-27 (Sam's hamstring over-restriction fix): the Bible's
// hamstring section rules "Usually okay: non-painful quad-dominant lower
// work" and names box squat / controlled squat / step-up as GOOD swaps, so
// Leg Press, Box Squat, High Box Squat, Goblet Squat, Step Ups and Leg
// Extension carry hamstring 'good' — the first LOOSER exceptions, because a
// pattern rule was over-reaching what the Bible authored.
ok('snapshot', '33 exceptions (incl. singletons lifted when their thin rule died)',
  exceptionRows.length === 33, `got ${exceptionRows.length}`);
ok('structural', 'every quad-dominant hamstring exception is ruled good',
  ['Leg Press', 'Box Squat', 'High Box Squat', 'Goblet Squat', 'Step Ups', 'Leg Extension']
    .every((name) => exceptions[`${name}|hamstring`] === 'good'));
ok('structural', 'Shrugs carries the neck exception that replaced the inert Traps rule',
  exceptions['Shrugs|neck'] === 'caution', exceptions['Shrugs|neck'] ?? '(absent)');
// Bench-compressed PULLS: the pressing rule cannot reach them, so Sam named them.
// Bench-compressed exercises no ribs PATTERN rule can reach: the two
// chest-supported rows are pulls, Incline Y Raise is isolation_upper. All three
// are named because the mechanism is the bench, not the movement pattern.
ok('structural', 'every bench-compressed exercise carries the ribs exception',
  ['Chest Supported Row', 'Chest-Supported DB Row', 'Incline Y Raise']
    .every((name) => exceptions[`${name}|ribs`] === 'caution'));
ok('structural', 'every exception names a real exercise and region',
  exceptionRows.every((r) => EXERCISE_TAGS[r.Exercise] !== undefined && REGIONS.includes(r.Region)));

const declarationRow = sheetNamed('Rules — pattern')!.rows
  .find((row) => (row[0] ?? '').startsWith('DECLARATION'));
ok('structural', 'the declaration is present and recorded as SIGNED',
  declarationRow !== undefined && declarationRow[0].includes('signed Sam'));
ok('structural', 'the ruling file records the declaration as signed',
  ruling.declaration.signed === true);

/* ══ CENTREPIECE — sheet <-> code equality, BOTH directions ══ */

const finalRows = readSheetRecords(FILE, 'Final matrix', 5);
ok('snapshot', '149 rows on the final matrix', finalRows.length === 149, `got ${finalRows.length}`);

ok('structural', 'every exercise in CODE appears in the sheet',
  code.every((e) => finalRows.some((r) => r.Exercise === e.name)),
  code.filter((e) => !finalRows.some((r) => r.Exercise === e.name)).map((e) => e.name).join(', '));
ok('structural', 'every exercise in the SHEET appears in code',
  finalRows.every((r) => byName.has(r.Exercise)),
  finalRows.filter((r) => !byName.has(r.Exercise)).map((r) => r.Exercise).join(', '));

const drift: string[] = [];
const distribution: Record<string, number> = {};
let cells = 0;
for (const record of finalRows) {
  const entry = byName.get(record.Exercise);
  if (!entry) continue;
  for (const region of REGIONS) {
    const sheetValue = record[region].replace(/ \((exc|dec)\)$/, '');
    const codeValue = entry.ratings[region];
    distribution[sheetValue] = (distribution[sheetValue] ?? 0) + 1;
    cells += 1;
    if (codeValue === undefined) { drift.push(`${record.Exercise}.${region}: missing in code`); continue; }
    if (sheetValue !== codeValue) {
      drift.push(`${record.Exercise}.${region}: sheet ${sheetValue}, code ${codeValue}`);
    }
  }
}
ok('structural', 'sheet and code agree on every cell, both directions',
  drift.length === 0, drift.slice(0, 5).join(' ; '));
ok('structural', 'every code entry authors all 13 regions — no omissions possible',
  code.every((e) => REGIONS.every((r) => e.ratings[r] !== undefined)),
  code.filter((e) => REGIONS.some((r) => e.ratings[r] === undefined)).map((e) => e.name).join(', '));
ok('structural', '149 x 13 = 1937 cells compared', cells === 1937, `got ${cells}`);
// 872/24/1041 → 875/24/1038 on 2026-08-26: the three rack-squat shoulder
// cells moved good → caution (Sam's ruling above).
// 875/24/1038 → 869/24/1044 on 2026-08-27: the six quad-dominant hamstring
// cells moved caution → good (Sam's hamstring over-restriction fix above).
ok('snapshot', 'final distribution: 869 caution / 24 avoid / 1044 good',
  distribution.caution === 869 && distribution.avoid === 24 && distribution.good === 1044,
  JSON.stringify(distribution));

// inj() and SAFE must never come back — they are the defect itself.
const tagsText = fs.readFileSync(TAGS_SOURCE, 'utf8');
ok('structural', 'the inj() helper is gone and cannot return', !/\binj\(/.test(tagsText));
ok('structural', 'the SAFE all-good constant is gone', !/\bconst SAFE\b/.test(tagsText));
ok('structural', 'no retired key survives in exerciseTags',
  !/'adductor'|'pubalgia'/.test(tagsText));

// LIFT, NEVER RE-DECIDE (Sam, 2026-07-28). When a thin rule dies under the n>=2
// minimum, the cell that fed it must survive as a named exception carrying its
// ORIGINAL authored rating — never silently fall through to the declaration.
const preCheck = readPreMigrationRatings();
const dropped: string[] = [];
for (const record of finalRows) {
  const before = preCheck.get(record.Exercise) ?? {};
  for (const [region, authored] of Object.entries(before)) {
    const now = record[region].replace(/ \((exc|dec)\)$/, '');
    if (now !== authored) dropped.push(`${record.Exercise}.${region}: ${authored} -> ${now}`);
  }
}
ok('structural', 'every pre-migration authored rating survives — lift, never re-decide',
  dropped.length === 0, dropped.slice(0, 5).join(' ; '));
ok('structural', 'Back Squat shoulder and Front Squat wrist survive as exceptions',
  exceptions['Back Squat|shoulder'] === 'caution'
  && exceptions['Front Squat|wrist/hand'] === 'caution');

/* ── Conditioning: hand-ruled, stricter-wins over what code authored ── */

const conditioningRows = readSheetRecords(FILE, 'Conditioning', 5);
ok('snapshot', '21 conditioning rows', conditioningRows.length === 21,
  `got ${conditioningRows.length}`);
const loosened: string[] = [];
for (const record of conditioningRows) {
  const before = preCheck.get(record.Exercise) ?? {};
  for (const [region, authored] of Object.entries(before)) {
    if (RANK[record[region]] < RANK[authored]) {
      loosened.push(`${record.Exercise}.${region}: ${authored} -> ${record[region]}`);
    }
  }
}
ok('structural', 'stricter-wins held — no conditioning rating was loosened',
  loosened.length === 0, loosened.slice(0, 5).join(' ; '));
ok('structural', 'Easy Bike stays good in every region (Sam\'s escape hatch)',
  REGIONS.every((region) =>
    conditioningRows.find((r) => r.Exercise === 'Easy Bike')![region] === 'good'));
ok('snapshot', 'sprint family carries hamstring/calf avoid above the blanket caution',
  ['Sprint Intervals', 'Hill Sprints', 'Quality Sprints', 'MAS Training'].every((name) => {
    const row = conditioningRows.find((r) => r.Exercise === name)!;
    return row.hamstring === 'avoid' && row.calf === 'avoid';
  }));

/* ── Routing, including what is BLOCKED ── */

const singleRoutes = readSheetRecords(FILE, 'Routing', 5)
  .filter((r) => r.Status?.startsWith('ruled'));
ok('snapshot', '11 single-target routes ruled', singleRoutes.length === 11,
  `got ${singleRoutes.length}`);
ok('structural', 'every single route targets one of the 13 regions',
  singleRoutes.every((r) => REGIONS.includes(r['RULED region'])));
ok('structural', 'ribs routes to ribs, superseding the unroutable line',
  singleRoutes.some((r) => r['Athlete types…'].includes('rib') && r['RULED region'] === 'ribs'));

// Sam ruled duals OUT on 2026-07-28. The ruling file must carry none, so that
// nothing can quietly reintroduce a multi-target route the resolver cannot express.
ok('structural', 'no dual routes exist — routing is single-target everywhere',
  Object.keys(ruling.routing.dual).filter((k) => k !== '_').length === 0);
ok('structural', 'the three former duals are now single targets',
  ruling.routing.single['hip flexor'] === 'hip'
  && ruling.routing.single.achilles === 'calf'
  && ruling.routing.single['upper back'] === 'shoulder');
ok('structural', 'no Traps rule survives — an unreachable authored rule is a defect',
  (ruling.newRegionMuscleRules.neck ?? []).length === 0);

/* ── Result ── */

if (failures === 0) { console.log('\nMATRIX VERIFIED — 0 failures'); process.exit(0); }
console.log(`\n${failures} FAILURES (${snapshotFailures} ruled-snapshot pins)`);
process.exit(1);
