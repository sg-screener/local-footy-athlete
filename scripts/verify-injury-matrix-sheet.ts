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

/* ── What the CODE authors today ──
 *
 * Read from source text, not EXERCISE_TAGS: once `inj()` has run, an omitted key
 * and an authored 'good' are indistinguishable, which is the defect this whole
 * unit exists to kill.
 */
interface CodeExercise {
  name: string; movement: string; primary: string[];
  authored: Record<string, string>;
}
function readCode(): CodeExercise[] {
  const body = fs.readFileSync(TAGS_SOURCE, 'utf8');
  const map = body.slice(body.indexOf('export const EXERCISE_TAGS'));
  const muscleText = fs.readFileSync(MUSCLE_SOURCE, 'utf8');
  const primaryByName = new Map<string, string[]>();
  for (const m of muscleText.matchAll(
    /exercise:\s*'([^']+)',\s*\n\s*pool:\s*'[^']*',\s*\n\s*primary:\s*\[([^\]]*)\]/g)) {
    primaryByName.set(m[1], (m[2].match(/'([^']+)'/g) ?? []).map((s) => s.slice(1, -1)));
  }
  const out: CodeExercise[] = [];
  for (const entry of map.matchAll(/^ {2}'([^']+)':\s*\{([\s\S]*?)^ {2}\},/gm)) {
    const [, name, block] = entry;
    const injury = /injury:\s*(SAFE|inj\(\{([\s\S]*?)\}\))/.exec(block)!;
    const raw: Record<string, string> = {};
    if (injury[1] !== 'SAFE') {
      for (const kv of injury[2].matchAll(/(\w+):\s*'(\w+)'/g)) raw[kv[1]] = kv[2];
    }
    const authored: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (key === 'adductor' || key === 'pubalgia') continue;
      authored[OLD_TO_NEW[key]] = value;
    }
    const add = raw.adductor;
    const pub = raw.pubalgia;
    if (add && pub) {
      if (add === pub) authored.groin = add;
      else authored.groin = ruling.conflictResolutions[name];   // Sam's ruling 1
    } else if (add) authored.groin = add;
    else if (pub) authored.groin = pub;

    out.push({
      name, movement: /movement:\s*'([^']+)'/.exec(block)![1],
      primary: primaryByName.get(name) ?? [], authored,
    });
  }
  return out;
}
const code = readCode();
const byName = new Map(code.map((e) => [e.name, e]));

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

ok('snapshot', '157 rules in total',
  pattern.samAuthored + pattern.evidence + muscle.samAuthored + muscle.evidence === 157,
  `got ${pattern.samAuthored + pattern.evidence + muscle.samAuthored + muscle.evidence}`);
ok('snapshot', '20 rules authored by Sam for the new regions',
  pattern.samAuthored + muscle.samAuthored === 20,
  `got ${pattern.samAuthored + muscle.samAuthored}`);
ok('structural', 'every new-region rule is Sam-authored, never evidence-derived',
  [pattern.rules, muscle.rules].every((grid) => Object.values(grid).every((byRegion) =>
    NEW_REGIONS.every((region) => byRegion[region] === null || byRegion[region] === 'caution'))));

/* ── Exceptions and declaration ── */

const exceptionRows = readSheetRecords(FILE, 'Exceptions', 4);
const exceptions: Record<string, string> = {};
for (const record of exceptionRows) exceptions[`${record.Exercise}|${record.Region}`] = record.RULED;
ok('snapshot', '19 exceptions (18 reverse-engineered + Shrugs/neck, Sam-authored)',
  exceptionRows.length === 19, `got ${exceptionRows.length}`);
ok('structural', 'Shrugs carries the neck exception that replaced the inert Traps rule',
  exceptions['Shrugs|neck'] === 'caution', exceptions['Shrugs|neck'] ?? '(absent)');
ok('structural', 'every exception names a real exercise and region',
  exceptionRows.every((r) => EXERCISE_TAGS[r.Exercise] !== undefined && REGIONS.includes(r.Region)));

const declarationRow = sheetNamed('Rules — pattern')!.rows
  .find((row) => (row[0] ?? '').startsWith('DECLARATION'));
ok('structural', 'the declaration is present and recorded as SIGNED',
  declarationRow !== undefined && declarationRow[0].includes('signed Sam'));
ok('structural', 'the ruling file records the declaration as signed',
  ruling.declaration.signed === true);

/* ══ CENTREPIECE — re-derive the matrix from the sheet's own rules ══ */

function evaluate(exercise: CodeExercise, region: string): string {
  const override = exceptions[`${exercise.name}|${region}`];
  if (override) return override;
  const candidates: string[] = [];
  const byPattern = pattern.rules[exercise.movement]?.[region];
  if (byPattern) candidates.push(byPattern);
  for (const m of exercise.primary) {
    const byMuscle = muscle.rules[m]?.[region];
    if (byMuscle) candidates.push(byMuscle);
  }
  return candidates.length > 0 ? strictest(candidates) : 'good';   // declaration
}

const finalRows = readSheetRecords(FILE, 'Final matrix', 5);
ok('snapshot', '149 rows on the final matrix', finalRows.length === 149, `got ${finalRows.length}`);

const strengthRows = finalRows.filter((r) => r.Pattern !== 'conditioning');
const rederivationErrors: string[] = [];
const distribution: Record<string, number> = {};
for (const record of finalRows) {
  for (const region of REGIONS) {
    const raw = record[region];
    const value = raw.replace(/ \((exc|dec)\)$/, '');
    distribution[value] = (distribution[value] ?? 0) + 1;
    if (record.Pattern === 'conditioning') continue;   // hand-ruled, checked below
    const expected = evaluate(byName.get(record.Exercise)!, region);
    if (value !== expected) {
      rederivationErrors.push(`${record.Exercise}.${region}: sheet ${value}, rules give ${expected}`);
    }
  }
}
ok('snapshot', "the sheet's own rules re-derive every strength cell",
  rederivationErrors.length === 0, rederivationErrors.slice(0, 5).join(' ; '));
ok('snapshot', 'final distribution: 925 caution / 24 avoid / 988 good',
  distribution.caution === 925 && distribution.avoid === 24 && distribution.good === 988,
  JSON.stringify(distribution));
ok('structural', '149 x 13 = 1937 cells, all authored',
  Object.values(distribution).reduce((a, b) => a + b, 0) === 1937);

/* ── Nothing the code authored may be silently lost ──
 *
 * Sam ruled the exceptions precisely to preserve judgements the general rules
 * cannot express. If a rating authored in code today does not survive into the
 * final matrix, an exception was dropped.
 */
const lost: string[] = [];
for (const record of strengthRows) {
  const entry = byName.get(record.Exercise)!;
  for (const [region, authored] of Object.entries(entry.authored)) {
    const value = record[region].replace(/ \((exc|dec)\)$/, '');
    if (value !== authored) lost.push(`${record.Exercise}.${region}: code ${authored}, sheet ${value}`);
  }
}
ok('snapshot', 'every rating the code authors survives into the final matrix',
  lost.length === 0, lost.slice(0, 5).join(' ; '));

/* ── Conditioning: hand-ruled, stricter-wins over what code authored ── */

const conditioningRows = readSheetRecords(FILE, 'Conditioning', 5);
ok('snapshot', '21 conditioning rows', conditioningRows.length === 21,
  `got ${conditioningRows.length}`);
const loosened: string[] = [];
for (const record of conditioningRows) {
  const entry = byName.get(record.Exercise)!;
  for (const [region, authored] of Object.entries(entry.authored)) {
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
