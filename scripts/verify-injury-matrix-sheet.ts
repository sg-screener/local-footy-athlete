/**
 * Verify docs/INJURY_MATRIX_REVIEW_2026-07-28.xlsx against the code it mirrors.
 *
 * WHY THIS IS COMMITTED: it is the seed of the Phase 2 equality gate. The sheet
 * is Sam's ruling surface for the injury matrix; a sheet the gate cannot READ
 * would be decoration, and re-authoring this proof from prose later is a
 * pointless risk. Run it with `npm run verify:injury-matrix-sheet`.
 *
 * ── READ THIS BEFORE "FIXING" A FAILURE ──
 *
 * Assertions come in two classes and they fail for opposite reasons:
 *
 *   STRUCTURAL — must hold for EVERY version of this sheet, before and after
 *     Sam rules. Tab and column shape, the closed cell vocabulary, no blank rows,
 *     flag-state consistency, merge traceability. A structural failure is a real
 *     defect in the sheet or the generator.
 *
 *   PRE-RULING SNAPSHOT — pins the sheet as GENERATED, with nothing ruled yet:
 *     280 authored / 1,503 unruled / 5 conflicts / 250 flagged, and every
 *     straight-through cell still equal to today's code.
 *     THESE ARE *EXPECTED* TO FAIL THE MOMENT SAM RULES A CELL. That failure is
 *     not a bug — it is the signal to promote this script into the real Phase 2
 *     equality gate (sheet leads, code follows, both directions) and drop the
 *     snapshot pins. Do NOT "fix" them by editing the numbers to match a ruled
 *     sheet; that would silently convert a review artifact into a fake gate.
 *
 * This is deliberately NOT wired into `test:bible` for that reason.
 */
import fs from 'fs';
import path from 'path';

import { readXlsx, readSheetRecords } from '../src/__tests__/support/xlsxReader';
import { EXERCISE_TAGS, InjuryProfile } from '../src/data/exerciseTags';

const REPO_ROOT = path.resolve(__dirname, '..');
const FILE = path.join(REPO_ROOT, 'docs', 'INJURY_MATRIX_REVIEW_2026-07-28.xlsx');
const TAGS_SOURCE = path.join(REPO_ROOT, 'src', 'data', 'exerciseTags.ts');

/** Sam's final region list, ruled 2026-07-28, in his order and his labels. */
const REGIONS = ['groin', 'hip', 'quad', 'hamstring', 'knee', 'calf',
  'ankle/foot', 'lowerBack', 'neck', 'shoulder', 'elbow', 'wrist/hand'];
/** Regions with no predecessor in the old 10-key vocabulary. */
const NEW_REGIONS = ['hip', 'quad', 'neck'];
/** New region -> the single old key it came from. groin merges two, handled apart. */
const FROM_OLD: Record<string, keyof InjuryProfile> = {
  lowerBack: 'lowerBack', knee: 'knee', hamstring: 'hamstring', calf: 'calf',
  'ankle/foot': 'ankle', shoulder: 'shoulder', elbow: 'elbow', 'wrist/hand': 'wrist',
};

let failures = 0;
let snapshotFailures = 0;
function ok(kind: 'structural' | 'snapshot', label: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`  ok   [${kind === 'structural' ? 'struct' : 'snapshot'}] ${label}`);
    return;
  }
  failures += 1;
  if (kind === 'snapshot') snapshotFailures += 1;
  console.log(`  FAIL [${kind === 'structural' ? 'struct' : 'snapshot'}] ${label}${detail ? ` — ${detail}` : ''}`);
}

/**
 * Which injury keys does the SOURCE actually author?
 *
 * Read from the file text, not from EXERCISE_TAGS: by the time `inj()` has run,
 * an omitted key and an authored 'good' are indistinguishable — which is the
 * whole defect this sheet exists to kill. Entries written as `injury: SAFE`
 * author nothing at all.
 */
function authoredKeysByExercise(): Map<string, Set<string>> {
  const source = fs.readFileSync(TAGS_SOURCE, 'utf8');
  const body = source.slice(source.indexOf('export const EXERCISE_TAGS'));
  const out = new Map<string, Set<string>>();
  for (const entry of body.matchAll(/^ {2}'([^']+)':\s*\{([\s\S]*?)^ {2}\},/gm)) {
    const injury = /injury:\s*(SAFE|inj\(\{([\s\S]*?)\}\))/.exec(entry[2]);
    if (!injury) throw new Error(`no injury profile on "${entry[1]}"`);
    out.set(entry[1], new Set(
      injury[1] === 'SAFE'
        ? []
        : [...injury[2].matchAll(/(\w+):\s*'(\w+)'/g)].map((m) => m[1]),
    ));
  }
  return out;
}

const authoredKeys = authoredKeysByExercise();

/* ── Workbook shape ── */

const sheets = readXlsx(FILE);
console.log(`tabs: ${sheets.map((s) => s.name).join(' | ')}\n`);
ok('structural', '5 tabs', sheets.length === 5);
ok('structural', 'tab names and order', sheets.map((s) => s.name).join(',')
  === 'README,Injury matrix,Group sign-off,Flag rules,Conflicts & routing');

/**
 * THE BLANK-ROW TRAP, and how it must actually be caught.
 *
 * A blank row emits no <row> element at all, and xlsxReader indexes the rows it
 * actually READS. So inserting a blank row above a header shifts every reader
 * index below it — silently, while still passing a naive row count. This ate a
 * sign-off group on the first build of this sheet.
 *
 * CRUCIALLY: you cannot detect it by looking for blank rows. They are invisible
 * from the read side by construction — `sheet.rows` never contains one, so an
 * assertion like "no blank row exists" is VACUOUS and can never fail. (Proven by
 * mutation: inserting a blank row passed such a check.)
 *
 * The only real protection is to pin each header by CONTENT at its expected
 * index. If anything shifts the rows, the header is no longer there and this
 * fails loudly — which is the behaviour the vacuous check only appeared to have.
 */
function assertHeaderAt(tab: string, index: number, expected: readonly string[]): void {
  const sheet = sheets.find((candidate) => candidate.name === tab);
  ok('structural', `"${tab}" exists`, sheet !== undefined);
  if (!sheet) return;
  const row = sheet.rows[index - 1] ?? [];
  const actual = expected.map((_, column) => (row[column] ?? '').trim());
  ok('structural',
    `"${tab}" header is intact at reader row ${index} (catches a row shift)`,
    expected.every((cell, column) => actual[column] === cell),
    `expected [${expected.join(', ')}] got [${actual.join(', ')}]`);
}

assertHeaderAt('Group sign-off', 6, [
  'Group', 'Exercises', 'Unruled cells', 'of which new-region',
  'Flagged cells', 'Conflicts', 'Flag coverage',
  'SAM: remaining unruled are…', 'SAM: notes',
]);
assertHeaderAt('Conflicts & routing', 5, [
  'Exercise', 'Group', 'adductor said', 'pubalgia said', 'SAM: groin =', 'SAM: notes',
]);
assertHeaderAt('Conflicts & routing', 13, [
  'Athlete types…', 'Routes to TODAY', 'Status', 'SAM: routes to', 'SAM: notes',
]);

const matrix = readSheetRecords(FILE, 'Injury matrix');
ok('structural', '149 matrix records', matrix.length === 149, `got ${matrix.length}`);
ok('structural', "all 12 regions present, in Sam's order",
  REGIONS.every((region) => region in matrix[0]),
  REGIONS.filter((region) => !(region in matrix[0])).join(', '));
ok('structural', 'the retired keys are gone as columns',
  !('adductor' in matrix[0]) && !('pubalgia' in matrix[0])
  && !('ankle' in matrix[0]) && !('wrist' in matrix[0]));

const codeNames = Object.keys(EXERCISE_TAGS);
ok('structural', 'every code exercise appears',
  codeNames.every((name) => matrix.some((row) => row.Exercise === name)),
  codeNames.filter((name) => !matrix.some((row) => row.Exercise === name)).join(', '));
ok('structural', 'the sheet invents no exercise',
  matrix.every((row) => codeNames.includes(row.Exercise)));

/* ── Cell vocabulary and mirroring ── */

const VOCABULARY = /^(good|caution|avoid|good \(defaulted( — CHECK)?\)|unruled \(new region( — CHECK)?\)|CONFLICT — adductor=\w+ vs pubalgia=\w+)$/;
ok('structural', 'cell vocabulary is closed',
  matrix.every((row) => REGIONS.every((region) => VOCABULARY.test(row[region]))),
  matrix.flatMap((row) => REGIONS.map((region) => row[region]))
    .filter((value) => !VOCABULARY.test(value)).slice(0, 3).join(' | '));

const mismatches: string[] = [];
let authoredCells = 0;
let unruledCells = 0;
let newCells = 0;
let conflictCells = 0;
let checkCells = 0;

for (const record of matrix) {
  const tag = EXERCISE_TAGS[record.Exercise];
  const authored = authoredKeys.get(record.Exercise);
  if (!authored) { mismatches.push(`${record.Exercise}: not found in source`); continue; }

  for (const region of REGIONS) {
    const cell = record[region];
    if (cell.includes('CHECK')) checkCells += 1;

    if (cell.startsWith('CONFLICT')) { conflictCells += 1; continue; }
    if (cell.startsWith('unruled (new region')) {
      newCells += 1;
      if (!NEW_REGIONS.includes(region)) {
        mismatches.push(`${record.Exercise}.${region}: new-region cell on an old region`);
      }
      continue;
    }
    if (cell.startsWith('good (defaulted')) {
      unruledCells += 1;
      if (NEW_REGIONS.includes(region)) {
        mismatches.push(`${record.Exercise}.${region}: new region shown as defaulted`);
      }
      continue;
    }

    authoredCells += 1;
    if (region === 'groin') continue;            // merged; verified separately
    const oldKey = FROM_OLD[region];
    if (!authored.has(oldKey)) {
      mismatches.push(`${record.Exercise}.${region}: authored in sheet, defaulted in code`);
    } else if (cell !== tag.injury[oldKey]) {
      mismatches.push(`${record.Exercise}.${region}: sheet "${cell}" vs code "${tag.injury[oldKey]}"`);
    }
  }
}
ok('snapshot', 'every straight-through cell mirrors code exactly', mismatches.length === 0,
  mismatches.slice(0, 5).join(' ; '));
ok('structural', '149 x 12 = 1788 cells accounted for',
  authoredCells + unruledCells + newCells + conflictCells === 1788,
  `${authoredCells}+${unruledCells}+${newCells}+${conflictCells}`);
ok('snapshot', '280 authored cells', authoredCells === 280, `got ${authoredCells}`);
ok('snapshot', '1503 unruled cells', unruledCells + newCells === 1503,
  `got ${unruledCells + newCells}`);
ok('snapshot', '447 new-region cells', newCells === 447, `got ${newCells}`);
ok('snapshot', '250 CHECK-flagged cells', checkCells === 250, `got ${checkCells}`);

/* ── The adductor + pubalgia -> groin merge ──
 *
 * Sam's ruling, 2026-07-28: agreeing overlaps and single-label ratings carry over
 * as authored; conflicts are NEVER auto-picked — they go to him showing every
 * prior value. Verified per exercise, not by totals.
 */
const mergeErrors: string[] = [];
let agreed = 0;
let pubalgiaOnly = 0;
let adductorOnly = 0;
let conflicted = 0;

for (const record of matrix) {
  const tag = EXERCISE_TAGS[record.Exercise];
  const authored = authoredKeys.get(record.Exercise);
  if (!authored) continue;
  const adductor = authored.has('adductor') ? tag.injury.adductor : null;
  const pubalgia = authored.has('pubalgia') ? tag.injury.pubalgia : null;
  const cell = record.groin;

  if (adductor && pubalgia && adductor !== pubalgia) {
    conflicted += 1;
    if (!cell.startsWith('CONFLICT')) {
      mergeErrors.push(`${record.Exercise}: conflict auto-picked as "${cell}"`);
    } else if (!cell.includes(`adductor=${adductor}`) || !cell.includes(`pubalgia=${pubalgia}`)) {
      mergeErrors.push(`${record.Exercise}: conflict cell hides a prior value — "${cell}"`);
    }
  } else if (adductor && pubalgia) {
    agreed += 1;
    if (cell !== adductor) mergeErrors.push(`${record.Exercise}: agreed ${adductor} became "${cell}"`);
  } else if (pubalgia) {
    pubalgiaOnly += 1;
    if (cell !== pubalgia) mergeErrors.push(`${record.Exercise}: pubalgia-only ${pubalgia} became "${cell}"`);
  } else if (adductor) {
    adductorOnly += 1;
    if (cell !== adductor) mergeErrors.push(`${record.Exercise}: adductor-only ${adductor} became "${cell}"`);
  } else if (!cell.startsWith('good (defaulted')) {
    mergeErrors.push(`${record.Exercise}: groin authored from nothing — "${cell}"`);
  }
}
ok('structural', "the merge carried every value per Sam's rule", mergeErrors.length === 0,
  mergeErrors.slice(0, 5).join(' ; '));
ok('structural', 'every merged groin cell records which prior label it came from',
  matrix.every((row) => row.groin.startsWith('good (defaulted')
    || (row['groin — prior labels'] ?? '') !== '—'));
ok('snapshot', '16 agreed pairs carried', agreed === 16, `got ${agreed}`);
ok('snapshot', '13 pubalgia-only carried', pubalgiaOnly === 13, `got ${pubalgiaOnly}`);
ok('snapshot', '5 adductor-only carried', adductorOnly === 5, `got ${adductorOnly}`);
ok('snapshot', '5 conflicts left unruled', conflicted === 5, `got ${conflicted}`);

/* ── Flag states stay three-way distinguishable ──
 *
 * flag-clean BY ANALYSIS and flag-clean BY BLINDNESS must never look alike: the
 * conditioning rows have no muscle signal and no pattern rule, so no rule ran on
 * them at all. Reading that as a quiet all-clear is the failure mode.
 */
const blind = matrix.filter((row) => row.Flags === 'no flag rule — unreviewed by flags');
const clean = matrix.filter((row) => row.Flags.startsWith('no flag —'));
const flagged = matrix.filter((row) => row.Flags.startsWith('CHECK:'));
ok('structural', 'every row carries exactly one flag state',
  blind.length + clean.length + flagged.length === 149,
  `${blind.length}+${clean.length}+${flagged.length}`);
ok('structural', 'CHECK cells and the Flags column agree on every row',
  matrix.every((row) => REGIONS.some((region) => row[region].includes('CHECK'))
    === row.Flags.startsWith('CHECK:')));
ok('structural', 'no unreviewed-by-flags row carries a CHECK cell',
  blind.every((row) => REGIONS.every((region) => !row[region].includes('CHECK'))));
ok('snapshot', '21 rows unreviewed-by-flags', blind.length === 21, `got ${blind.length}`);
ok('structural', 'all unreviewed-by-flags rows are conditioning',
  blind.every((row) => row.Group === 'CONDITIONING'));

/* ── Group sign-off ── */

const signoff = readSheetRecords(FILE, 'Group sign-off', 6);
ok('structural', '15 sign-off group rows', signoff.length === 15, `got ${signoff.length}`);
ok('structural', 'every sign-off decision cell starts empty',
  signoff.every((row) => (row['SAM: remaining unruled are…'] ?? '') === ''));
ok('snapshot', 'sign-off unruled counts sum to 1503',
  signoff.reduce((total, row) => total + Number(row['Unruled cells']), 0) === 1503);
ok('snapshot', 'sign-off new-region counts sum to 447',
  signoff.reduce((total, row) => total + Number(row['of which new-region']), 0) === 447);
ok('snapshot', 'sign-off conflicts sum to 5',
  signoff.reduce((total, row) => total + Number(row.Conflicts), 0) === 5);
ok('structural', 'sign-off exercise counts sum to 149',
  signoff.reduce((total, row) => total + Number(row.Exercises), 0) === 149);

/* ── Conflicts tab ── */

const conflictRows = readSheetRecords(FILE, 'Conflicts & routing', 5)
  .filter((row) => row['adductor said'] === 'caution' || row['adductor said'] === 'avoid');
const EXPECTED_CONFLICTS = ['Back Squat', 'Front Squat', 'Bulgarian Split Squats',
  'Walking Lunges', 'Nordic Lower'];
ok('snapshot', '5 conflict rows listed', conflictRows.length === 5, `got ${conflictRows.length}`);
ok('snapshot', 'the 5 conflicts are exactly the ones Sam was told about',
  EXPECTED_CONFLICTS.every((name) => conflictRows.some((row) => row.Exercise === name)),
  conflictRows.map((row) => row.Exercise).join(', '));
ok('structural', 'each conflict row shows BOTH prior values',
  conflictRows.every((row) => row['adductor said'] && row['pubalgia said']));
ok('structural', 'no conflict row has a pre-filled answer',
  conflictRows.every((row) => (row['SAM: groin ='] ?? '') === ''));

/* ── Result ── */

if (failures === 0) {
  console.log('\nSHEET VERIFIED — 0 failures');
  process.exit(0);
}
console.log(`\n${failures} FAILURES (${snapshotFailures} of them pre-ruling snapshot pins)`);
if (snapshotFailures === failures) {
  console.log(
    'ALL failures are snapshot pins. If Sam has ruled the sheet, this is EXPECTED:\n'
    + 'promote this script into the Phase 2 equality gate and drop the pins.\n'
    + 'Do NOT edit the numbers to match a ruled sheet.',
  );
}
process.exit(1);
