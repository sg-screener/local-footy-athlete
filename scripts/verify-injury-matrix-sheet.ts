/**
 * Verify docs/INJURY_MATRIX_REVIEW_2026-07-28.xlsx — Sam's rules-first ruling
 * package for the injury matrix.
 *
 * WHY THIS IS COMMITTED: it is the seed of the Phase 2 equality gate. The sheet
 * is Sam's ruling surface; a sheet the gate cannot READ would be decoration.
 * Run it with `npm run verify:injury-matrix-sheet`.
 *
 * ── The centrepiece ──
 *
 * This does NOT check the sheet against the JSON it was built from — that would
 * only prove the writer agrees with itself. It parses the RULE GRIDS AND
 * EXCEPTIONS OUT OF THE WORKBOOK, evaluates Sam's resolution model, and checks
 * the result reproduces every injury rating authored in `exerciseTags.ts`.
 *
 * If that holds, the rule table is a faithful compression of Sam's own decisions
 * rather than a plausible-looking summary of them.
 *
 * ── Two classes of assertion, failing for opposite reasons ──
 *
 *   STRUCTURAL — must hold for EVERY version of this sheet, before and after Sam
 *     rules. Tab shape, header positions, closed vocabularies, nothing pre-filled
 *     where he must decide.
 *
 *   PRE-RULING SNAPSHOT — pins the sheet AS GENERATED, nothing ruled yet: the
 *     evidence counts, the 18 exceptions, and the fidelity check above.
 *     THESE ARE *EXPECTED* TO FAIL THE MOMENT SAM RULES. That is not a bug — it
 *     is the signal to promote this into the real Phase 2 equality gate (sheet
 *     leads, code follows, both directions) and drop the snapshot pins. Do NOT
 *     edit the numbers to match a ruled sheet; that silently turns a review
 *     artifact into a fake gate.
 *
 * Deliberately NOT wired into `test:bible` for that reason.
 */
import fs from 'fs';
import path from 'path';

import { readXlsx, readSheetRecords, XlsxSheet } from '../src/__tests__/support/xlsxReader';
import { EXERCISE_TAGS, InjuryProfile } from '../src/data/exerciseTags';

const REPO_ROOT = path.resolve(__dirname, '..');
const FILE = path.join(REPO_ROOT, 'docs', 'INJURY_MATRIX_REVIEW_2026-07-28.xlsx');
const TAGS_SOURCE = path.join(REPO_ROOT, 'src', 'data', 'exerciseTags.ts');
const MUSCLE_SOURCE = path.join(REPO_ROOT, 'src', 'data', 'muscleExperienceMetadata.ts');

const REGIONS = ['groin', 'hip', 'quad', 'hamstring', 'knee', 'calf',
  'ankle/foot', 'lowerBack', 'neck', 'shoulder', 'elbow', 'wrist/hand'];
const NEW_REGIONS = ['hip', 'quad', 'neck'];
const OLD_TO_NEW: Record<string, string> = {
  adductor: 'groin', pubalgia: 'groin', lowerBack: 'lowerBack', knee: 'knee',
  hamstring: 'hamstring', calf: 'calf', ankle: 'ankle/foot', shoulder: 'shoulder',
  elbow: 'elbow', wrist: 'wrist/hand',
};
const RANK: Record<string, number> = { good: 0, caution: 1, avoid: 2 };
const strictest = (values: string[]): string =>
  values.reduce((a, b) => (RANK[b] > RANK[a] ? b : a));

let failures = 0;
let snapshotFailures = 0;
function ok(kind: 'structural' | 'snapshot', label: string, condition: boolean, detail = ''): void {
  const tag = kind === 'structural' ? 'struct' : 'snapshot';
  if (condition) { console.log(`  ok   [${tag}] ${label}`); return; }
  failures += 1;
  if (kind === 'snapshot') snapshotFailures += 1;
  console.log(`  FAIL [${tag}] ${label}${detail ? ` — ${detail}` : ''}`);
}

/* ── Source of truth: what does the CODE actually author? ──
 *
 * Read from file text, not from EXERCISE_TAGS. Once `inj()` has run, an omitted
 * key and an authored 'good' are indistinguishable — which is the entire defect
 * this sheet exists to kill. Entries written `injury: SAFE` author nothing.
 */
interface CodeExercise {
  name: string;
  movement: string;
  authored: Record<string, string>;   // region -> rating (12-region vocabulary)
  conflict: { adductor: string; pubalgia: string } | null;
  primary: string[];
}

function readCode(): CodeExercise[] {
  const source = fs.readFileSync(TAGS_SOURCE, 'utf8');
  const body = source.slice(source.indexOf('export const EXERCISE_TAGS'));

  const muscleSource = fs.readFileSync(MUSCLE_SOURCE, 'utf8');
  const primaryByName = new Map<string, string[]>();
  for (const m of muscleSource.matchAll(
    /exercise:\s*'([^']+)',\s*\n\s*pool:\s*'[^']*',\s*\n\s*primary:\s*\[([^\]]*)\]/g)) {
    primaryByName.set(m[1], (m[2].match(/'([^']+)'/g) ?? []).map((s) => s.slice(1, -1)));
  }

  const out: CodeExercise[] = [];
  for (const entry of body.matchAll(/^ {2}'([^']+)':\s*\{([\s\S]*?)^ {2}\},/gm)) {
    const [, name, block] = entry;
    const injury = /injury:\s*(SAFE|inj\(\{([\s\S]*?)\}\))/.exec(block);
    if (!injury) throw new Error(`no injury profile on "${name}"`);
    const raw: Record<string, string> = {};
    if (injury[1] !== 'SAFE') {
      for (const kv of injury[2].matchAll(/(\w+):\s*'(\w+)'/g)) raw[kv[1]] = kv[2];
    }

    const authored: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (key === 'adductor' || key === 'pubalgia') continue;
      authored[OLD_TO_NEW[key]] = value;
    }
    let conflict: CodeExercise['conflict'] = null;
    const add = raw.adductor;
    const pub = raw.pubalgia;
    if (add && pub) {
      if (add === pub) authored.groin = add;
      else conflict = { adductor: add, pubalgia: pub };
    } else if (add) authored.groin = add;
    else if (pub) authored.groin = pub;

    out.push({
      name,
      movement: /movement:\s*'([^']+)'/.exec(block)![1],
      authored,
      conflict,
      primary: primaryByName.get(name) ?? [],
    });
  }
  return out;
}

const code = readCode();
const strengthCode = code.filter((e) => e.movement !== 'conditioning');

/* ── Workbook shape ── */

const sheets = readXlsx(FILE);
console.log(`tabs: ${sheets.map((s) => s.name).join(' | ')}\n`);
const TAB_NAMES = ['README', 'Rules — pattern', 'Rules — muscle', 'Exceptions',
  'Conditioning', 'Conflicts & routing', 'Reference'];
ok('structural', '7 tabs in order', sheets.map((s) => s.name).join(',') === TAB_NAMES.join(','),
  sheets.map((s) => s.name).join(','));

/**
 * THE ROW-SHIFT TRAP. A blank row emits no <row> element, and xlsxReader indexes
 * the rows it actually READS. You cannot detect a blank row from the read side —
 * `sheet.rows` never contains one, so "assert no blank rows" is VACUOUS and can
 * never fail (proven by mutation). The real hazard is a generator counting a
 * blank row and computing a header position in spreadsheet coordinates while the
 * reader works in emitted-row coordinates. The only real protection is to pin
 * each header BY CONTENT at its expected reader row.
 */
function sheetNamed(tab: string): XlsxSheet | undefined {
  return sheets.find((candidate) => candidate.name === tab);
}
function assertHeaderAt(tab: string, index: number, expected: readonly string[]): void {
  const sheet = sheetNamed(tab);
  ok('structural', `"${tab}" exists`, sheet !== undefined);
  if (!sheet) return;
  const row = sheet.rows[index - 1] ?? [];
  const actual = expected.map((_, column) => (row[column] ?? '').trim());
  ok('structural', `"${tab}" header intact at reader row ${index} (catches a row shift)`,
    expected.every((cell, column) => actual[column] === cell),
    `got [${actual.join(', ')}]`);
}

assertHeaderAt('Rules — pattern', 5, ['Movement pattern', ...REGIONS, 'SAM: notes']);
assertHeaderAt('Rules — muscle', 5, ['Primary muscle', ...REGIONS, 'SAM: notes']);
assertHeaderAt('Exceptions', 6, ['Exercise', 'Region', 'The rules say', 'Authored today',
  'Direction', 'SAM: rating', 'SAM: notes']);
assertHeaderAt('Conditioning', 8, ['Exercise', ...REGIONS, 'SAM: notes']);
assertHeaderAt('Conflicts & routing', 5, ['Exercise', 'Group', 'adductor said',
  'pubalgia said', 'SAM: groin =', 'SAM: notes']);
assertHeaderAt('Conflicts & routing', 13, ['Athlete types…', 'Routes to TODAY', 'Status',
  'SAM: routes to', 'SAM: notes']);
assertHeaderAt('Reference', 6, ['Group', 'Exercise', 'Pattern', 'Primary muscles', ...REGIONS]);

/* ── Parse the rule grids out of the workbook ── */

const RULE_CELL = /^(good|caution|avoid) ·(\d+)\/(\d+)( split)?$|^—( new region)?$/;

function parseRuleGrid(tab: string, headerRow: number, axisLabel: string) {
  const records = readSheetRecords(FILE, tab, headerRow);
  const rules: Record<string, Record<string, string | null>> = {};
  let evidence = 0;
  let malformed: string[] = [];
  for (const record of records) {
    const key = record[axisLabel];
    // The declaration line sits under the pattern grid on a titled row.
    if (!key || key.startsWith('DECLARATION')) continue;
    rules[key] = {};
    for (const region of REGIONS) {
      const cell = (record[region] ?? '').trim();
      if (!RULE_CELL.test(cell)) { malformed.push(`${tab} ${key}/${region}: "${cell}"`); continue; }
      if (cell.startsWith('—')) { rules[key][region] = null; continue; }
      rules[key][region] = cell.split(' ')[0];
      evidence += 1;
    }
  }
  ok('structural', `"${tab}" rule cells all use the closed vocabulary`, malformed.length === 0,
    malformed.slice(0, 3).join(' ; '));
  return { rules, evidence, count: Object.keys(rules).length };
}

const pattern = parseRuleGrid('Rules — pattern', 5, 'Movement pattern');
const muscle = parseRuleGrid('Rules — muscle', 5, 'Primary muscle');

ok('snapshot', '12 movement patterns', pattern.count === 12, `got ${pattern.count}`);
ok('snapshot', '16 primary muscles', muscle.count === 16, `got ${muscle.count}`);
ok('snapshot', '59 pattern-axis rules carry evidence', pattern.evidence === 59,
  `got ${pattern.evidence}`);
ok('snapshot', '78 muscle-axis rules carry evidence', muscle.evidence === 78,
  `got ${muscle.evidence}`);
ok('structural', 'no new region carries a pattern rule',
  Object.values(pattern.rules).every((byRegion) =>
    NEW_REGIONS.every((region) => byRegion[region] === null)));
ok('structural', 'no new region carries a muscle rule',
  Object.values(muscle.rules).every((byRegion) =>
    NEW_REGIONS.every((region) => byRegion[region] === null)));

/* ── Parse the exceptions ── */

const exceptionRecords = readSheetRecords(FILE, 'Exceptions', 6)
  .filter((record) => !record.Exercise.startsWith('(spare'));
const exceptions: Record<string, string> = {};
for (const record of exceptionRecords) {
  exceptions[`${record.Exercise}|${record.Region}`] = record['Authored today'];
}
ok('snapshot', '18 named exceptions', exceptionRecords.length === 18,
  `got ${exceptionRecords.length}`);
ok('structural', 'every exception names a real exercise and a real region',
  exceptionRecords.every((record) => EXERCISE_TAGS[record.Exercise] !== undefined
    && REGIONS.includes(record.Region)));
ok('structural', 'no exception has a pre-filled answer',
  exceptionRecords.every((record) => (record['SAM: rating'] ?? '') === ''));
ok('structural', 'spare exception rows exist so Sam never inserts a row',
  readSheetRecords(FILE, 'Exceptions', 6).some((r) => r.Exercise.startsWith('(spare')));

/* ══ THE CENTREPIECE — do the sheet's OWN rules reproduce the code? ══ */

function evaluate(exercise: CodeExercise, region: string): string | null {
  const override = exceptions[`${exercise.name}|${region}`];
  if (override) return override;
  const candidates: string[] = [];
  const byPattern = pattern.rules[exercise.movement]?.[region];
  if (byPattern) candidates.push(byPattern);
  for (const m of exercise.primary) {
    const byMuscle = muscle.rules[m]?.[region];
    if (byMuscle) candidates.push(byMuscle);
  }
  return candidates.length > 0 ? strictest(candidates) : null;
}

const divergences: string[] = [];
let reproduced = 0;
for (const exercise of strengthCode) {
  for (const region of REGIONS) {
    const authored = exercise.authored[region];
    if (!authored) continue;
    const derived = evaluate(exercise, region);
    if (derived === authored) reproduced += 1;
    else divergences.push(`${exercise.name}.${region}: rules give ${derived ?? '(none)'}, code has ${authored}`);
  }
}
ok('snapshot',
  `the sheet's own rules reproduce every authored strength rating (${reproduced} cells)`,
  divergences.length === 0, divergences.slice(0, 5).join(' ; '));
// 237 strength + 43 conditioning = the 280 ratings authored across the map.
// Conditioning is excluded here by design: it is ruled by hand, not by rules.
ok('snapshot', '237 strength ratings reproduced', reproduced === 237, `got ${reproduced}`);
const conditioningAuthored = code.filter((e) => e.movement === 'conditioning')
  .reduce((n, e) => n + Object.keys(e.authored).length, 0);
ok('snapshot', '280 ratings authored map-wide (237 strength + 43 conditioning)',
  reproduced + conditioningAuthored === 280, `got ${reproduced} + ${conditioningAuthored}`);

/* ── How many of the sheet's rules actually BIND? ──
 *
 * Recomputed here from the sheet's own grids rather than trusted from the
 * builder. The two axes are derived from the same authored cells so they mostly
 * agree, which leaves most rules redundant: loosening one changes nothing
 * because the other still returns the same answer. Sam is told this in the
 * README and it is shown in bold on the grids, so the count is pinned.
 */
function bindsAnything(axis: 'pattern' | 'muscle', key: string, region: string): boolean {
  for (const exercise of strengthCode) {
    if (axis === 'pattern' && exercise.movement !== key) continue;
    if (axis === 'muscle' && !exercise.primary.includes(key)) continue;
    if (exceptions[`${exercise.name}|${region}`]) continue;

    const candidates: string[] = [];
    const byPattern = pattern.rules[exercise.movement]?.[region];
    if (byPattern && !(axis === 'pattern' && key === exercise.movement)) candidates.push(byPattern);
    for (const m of exercise.primary) {
      const byMuscle = muscle.rules[m]?.[region];
      if (byMuscle && !(axis === 'muscle' && key === m)) candidates.push(byMuscle);
    }
    const without = candidates.length > 0 ? strictest(candidates) : null;
    if (without !== evaluate(exercise, region)) return true;
  }
  return false;
}

let binding = 0;
for (const [axis, rules] of [['pattern', pattern.rules], ['muscle', muscle.rules]] as const) {
  for (const [key, byRegion] of Object.entries(rules)) {
    for (const [region, value] of Object.entries(byRegion)) {
      if (value !== null && bindsAnything(axis, key, region)) binding += 1;
    }
  }
}
ok('snapshot', '31 of the 137 rules currently bind', binding === 31, `got ${binding}`);

/* ── Conditioning is ruled by hand, and must NOT be rule-driven ── */

const conditioningRows = readSheetRecords(FILE, 'Conditioning', 8);
ok('snapshot', '21 conditioning rows', conditioningRows.length === 21,
  `got ${conditioningRows.length}`);
ok('structural', 'no conditioning row is reachable by a pattern rule',
  pattern.rules.conditioning === undefined);
const conditioningCode = new Map(code.filter((e) => e.movement === 'conditioning')
  .map((e) => [e.name, e]));
const conditioningMismatch = conditioningRows.filter((record) => {
  const entry = conditioningCode.get(record.Exercise);
  if (!entry) return true;
  return REGIONS.some((region) => {
    const cell = record[region];
    const authored = entry.authored[region];
    if (authored) return cell !== authored;
    return cell !== (NEW_REGIONS.includes(region) ? 'unruled (new region)' : 'unruled');
  });
});
ok('snapshot', 'every conditioning cell mirrors code or is marked unruled',
  conditioningMismatch.length === 0,
  conditioningMismatch.map((r) => r.Exercise).slice(0, 3).join(', '));

/* ── Conflicts ── */

const conflictRows = readSheetRecords(FILE, 'Conflicts & routing', 5)
  .filter((record) => ['caution', 'avoid', 'good'].includes(record['adductor said']));
const EXPECTED_CONFLICTS = ['Back Squat', 'Front Squat', 'Bulgarian Split Squats',
  'Walking Lunges', 'Nordic Lower'];
ok('snapshot', '5 conflict rows', conflictRows.length === 5, `got ${conflictRows.length}`);
ok('snapshot', 'the 5 conflicts are exactly the expected ones',
  EXPECTED_CONFLICTS.every((name) => conflictRows.some((r) => r.Exercise === name)),
  conflictRows.map((r) => r.Exercise).join(', '));
ok('structural', 'each conflict shows BOTH prior values, unresolved',
  conflictRows.every((r) => r['adductor said'] && r['pubalgia said']
    && (r['SAM: groin ='] ?? '') === ''));
ok('structural', 'every code conflict reaches the sheet',
  code.filter((e) => e.conflict).length === conflictRows.length);

/* ── Routing ── */

const routingRows = readSheetRecords(FILE, 'Conflicts & routing', 13)
  .filter((record) => record['Athlete types…'] && record['Routes to TODAY']);
ok('snapshot', '11 routing rules to author', routingRows.length === 11,
  `got ${routingRows.length}`);
ok('structural', 'no routing rule has a pre-filled answer',
  routingRows.every((record) => (record['SAM: routes to'] ?? '') === ''));

/* ── The completeness declaration must start unsigned ── */

const patternSheet = sheetNamed('Rules — pattern');
const declarationRow = patternSheet?.rows.find((row) => (row[0] ?? '').startsWith('DECLARATION'));
ok('structural', 'the completeness declaration is present', declarationRow !== undefined);
ok('structural', 'the completeness declaration starts UNSIGNED',
  declarationRow !== undefined && (declarationRow[1] ?? '').trim() === '');

/* ── Reference tab is derived, never a ruling surface ── */

const referenceRows = readSheetRecords(FILE, 'Reference', 6);
ok('snapshot', '128 strength rows on the reference tab', referenceRows.length === 128,
  `got ${referenceRows.length}`);
ok('structural', 'the reference tab carries no SAM column',
  Object.keys(referenceRows[0]).every((column) => !column.startsWith('SAM')));

/* ── Result ── */

if (failures === 0) {
  console.log('\nSHEET VERIFIED — 0 failures');
  process.exit(0);
}
console.log(`\n${failures} FAILURES (${snapshotFailures} of them pre-ruling snapshot pins)`);
if (snapshotFailures === failures) {
  console.log(
    'ALL failures are snapshot pins. If Sam has ruled the sheet this is EXPECTED:\n'
    + 'promote this into the Phase 2 equality gate and drop the pins.\n'
    + 'Do NOT edit the numbers to match a ruled sheet.',
  );
}
process.exit(1);
