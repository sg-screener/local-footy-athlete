/**
 * Conditioning muscle + experience — doc<->code equality, BOTH directions.
 *
 *   docs/MUSCLE_EXPERIENCE_CONDITIONING_PROPOSED_2026-08-05.xlsx
 *   (Sam, SIGNED IN FULL 2026-08-05; docs/MUSCLE_SHEET_SIGNING_2026-08-05.md)
 *
 * The workbook is the source of truth for conditioning muscle/experience
 * metadata and for the modality map. This suite parses it directly and holds
 * `src/data/conditioningMuscleMetadata.ts` to it field for field, both ways:
 * a Sam edit to a muscle, a gate or a note fails the build until the typed
 * module matches, and a value invented in code fails it too.
 *
 * IT ALSO GATES THE ARCHITECTURE, not just the values. Sam's ruling was that a
 * machine session carries the MACHINE's muscles, derived once per modality —
 * so a "— from map —" row storing muscles of its own, or a machine missing
 * from the map, is the two-answers defect the architecture exists to prevent,
 * and each has its own cell below.
 *
 * Run: npm run test:conditioning-muscle
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import path from 'path';

import {
  CONDITIONING_MUSCLE_METADATA,
  MODALITY_MUSCLE_MAP,
  MODALITY_MAP_RUN_DEFERS_TEXT,
  conditioningSessionMuscles,
} from '../data/conditioningMuscleMetadata';
import { MUSCLE_GROUPS } from '../data/muscleExperienceMetadata';
import { CONDITIONING_TEMPLATES } from '../data/conditioningTemplates';
import { EXPERIENCE_GATES } from '../rules/experienceCrosswalk';
import type { ConditioningOption } from '../types/domain';
import { readSheetRecords, readXlsx } from './support/xlsxReader';

const repoRoot = path.resolve(__dirname, '../..');
const SHEET = path.join(
  repoRoot, 'docs/MUSCLE_EXPERIENCE_CONDITIONING_PROPOSED_2026-08-05.xlsx');
const TEMPLATE_TAB = 'Conditioning 53 PROPOSED';
const MAP_TAB = 'Modality Muscle Map';

/** The two rows Sam signed earlier, on the exercise master sheet. */
const SIGNED_ELSEWHERE = ['MAS 15:15 Blocks', 'Erg EMOM'];

/** The sheet's placeholder for "the map owns these". */
const FROM_MAP = '— from map —';

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

function okEmpty(name: string, offenders: readonly string[], detail?: string): void {
  ok(name, offenders.length === 0,
    `${detail ? `${detail}\n      ` : ''}${[...offenders].sort().join('\n      ')}`);
}

function splitMuscles(cell: string): string[] {
  if (!cell || cell.startsWith('—')) return [];
  return cell.split(',').map((part) => part.trim()).filter(Boolean);
}

const templateRows = readSheetRecords(SHEET, TEMPLATE_TAB);
const mapRows = readSheetRecords(SHEET, MAP_TAB);

console.log('\n[1] THE SHEET — it still reads as Sam signed it');
{
  ok('the workbook carries both authored tabs',
    [TEMPLATE_TAB, MAP_TAB].every((tab) =>
      readXlsx(SHEET).some((sheet) => sheet.name === tab)));

  ok('the sheet holds exactly 53 conditioning rows',
    templateRows.length === 53, `found ${templateRows.length}`);

  // SIGNED IN FULL is the whole premise of this suite. A row that lost its
  // status cell is a row nobody signed, and it must not ship as authored.
  okEmpty('every conditioning row is SIGNED',
    templateRows.filter((row) => !/^SIGNED/.test(row.Status ?? ''))
      .map((row) => `${row.Exercise}: status "${row.Status ?? ''}"`));

  okEmpty('every muscle-carrying row in the modality map is SIGNED',
    mapRows.filter((row) => row.Modality !== 'Run')
      .filter((row) => !/^SIGNED/.test(row.Status ?? ''))
      .map((row) => `${row.Modality}: status "${row.Status ?? ''}"`));
}

console.log('\n[2] THE MODALITY MAP — four machines + Sam\'s rotating row, and Run still defers');
{
  // Four machines, plus `Mixed — rotating` (Sam's ruling 2026-08-05, "3a
  // whole-body"). The rotating row is authored for exactly the reason the
  // machines are: a session that rotates has ONE answer, and it is his, not a
  // caller's union of two machine rows.
  ok('the map ships the four machines and the rotating row',
    MODALITY_MUSCLE_MAP.length === 5, `found ${MODALITY_MUSCLE_MAP.length}`);

  ok('the rotating row is keyed `mixed`, the word a generated option uses',
    MODALITY_MUSCLE_MAP.some((entry) =>
      entry.modality === 'mixed' && entry.label === 'Mixed — rotating'));

  const sheetMuscleRows = mapRows.filter((row) => row.Modality !== 'Run');
  ok('the sheet carries the same rows',
    sheetMuscleRows.length === MODALITY_MUSCLE_MAP.length,
    `sheet ${sheetMuscleRows.length} vs module ${MODALITY_MUSCLE_MAP.length}`);

  const mismatches: string[] = [];
  for (const row of sheetMuscleRows) {
    const entry = MODALITY_MUSCLE_MAP.find((candidate) => candidate.label === row.Modality);
    if (!entry) { mismatches.push(`${row.Modality}: missing from the module`); continue; }
    const pairs: Array<[string, readonly string[], string]> = [
      ['primary', entry.primary, row['Primary muscle groups'] ?? ''],
      ['secondary', entry.secondary, row['Secondary muscle groups'] ?? ''],
    ];
    for (const [field, shipped, authored] of pairs) {
      const want = splitMuscles(authored);
      if (want.join('|') !== [...shipped].join('|')) {
        mismatches.push(`${row.Modality} · ${field}: sheet ${JSON.stringify(want)} `
          + `vs code ${JSON.stringify([...shipped])}`);
      }
    }
    if ((row.Note ?? '') !== entry.note) {
      mismatches.push(`${row.Modality} · note differs`);
    }
  }
  okEmpty('every map row ships its authored muscles and note verbatim', mismatches);

  // RUN IS NOT A MACHINE ROW, and the sheet says so in words. If Run ever
  // gained muscles here it would be a SECOND answer beside the 26 run
  // templates' own rows — the exact shape this architecture removes.
  const runRow = mapRows.find((row) => row.Modality === 'Run');
  ok('the sheet still defers Run to the per-template rows',
    !!runRow && (runRow['Primary muscle groups'] ?? '') === MODALITY_MAP_RUN_DEFERS_TEXT,
    JSON.stringify(runRow?.['Primary muscle groups'] ?? null));

  ok('the module ships no Run entry in the machine map',
    !MODALITY_MUSCLE_MAP.some((entry) => String(entry.modality) === 'run'));
}

console.log('\n[3] EQUALITY — every authored row ships exactly, and nothing else does');
{
  ok('the module ships exactly 53 rows',
    CONDITIONING_MUSCLE_METADATA.length === 53,
    `found ${CONDITIONING_MUSCLE_METADATA.length}`);

  const byName = new Map(CONDITIONING_MUSCLE_METADATA.map((entry) => [entry.exercise, entry]));
  ok('no two rows share an exercise name',
    byName.size === CONDITIONING_MUSCLE_METADATA.length);

  const missing: string[] = [];
  const mismatches: string[] = [];
  for (const row of templateRows) {
    const entry = byName.get(row.Exercise);
    if (!entry) { missing.push(row.Exercise); continue; }
    const derives = (row['Primary muscle groups'] ?? '') === FROM_MAP;
    if (entry.derivesFromModality !== derives) {
      mismatches.push(`${row.Exercise}: derivesFromModality ${entry.derivesFromModality} `
        + `but the sheet says ${JSON.stringify(row['Primary muscle groups'])}`);
    }
    const wantPrimary = derives ? [] : splitMuscles(row['Primary muscle groups'] ?? '');
    const wantSecondary = derives ? [] : splitMuscles(row['Secondary muscle groups'] ?? '');
    if (wantPrimary.join('|') !== [...entry.primary].join('|')) {
      mismatches.push(`${row.Exercise} · primary: sheet ${JSON.stringify(wantPrimary)} `
        + `vs code ${JSON.stringify([...entry.primary])}`);
    }
    if (wantSecondary.join('|') !== [...entry.secondary].join('|')) {
      mismatches.push(`${row.Exercise} · secondary: sheet ${JSON.stringify(wantSecondary)} `
        + `vs code ${JSON.stringify([...entry.secondary])}`);
    }
    if ((row['Experience gate'] ?? '') !== entry.experienceGate) {
      mismatches.push(`${row.Exercise} · gate: sheet "${row['Experience gate']}" `
        + `vs code "${entry.experienceGate}"`);
    }
    if ((row.Note ?? '') !== entry.note) {
      mismatches.push(`${row.Exercise} · note differs`);
    }
    const flagged = (row['⚑'] ?? '').trim().length > 0;
    if (flagged !== entry.flagged) {
      mismatches.push(`${row.Exercise} · flagged ${entry.flagged} vs sheet ${flagged}`);
    }
  }
  okEmpty('every authored row is present in the module', missing);
  okEmpty('every authored field ships verbatim — no rewording, no re-tagging',
    mismatches.slice(0, 8));

  const sheetNames = new Set(templateRows.map((row) => row.Exercise));
  okEmpty('the module invents no row Sam did not sign',
    CONDITIONING_MUSCLE_METADATA
      .filter((entry) => !sheetNames.has(entry.exercise))
      .map((entry) => entry.exercise));
}

console.log('\n[4] ARCHITECTURE — one answer per question');
{
  // The whole point of the map. A "— from map —" row that also stored muscles
  // would be two answers to "what does this session load", which is what Sam's
  // direction removed.
  okEmpty('no map-derived row also stores muscles of its own',
    CONDITIONING_MUSCLE_METADATA
      .filter((entry) => entry.derivesFromModality)
      .filter((entry) => entry.primary.length > 0 || entry.secondary.length > 0)
      .map((entry) => entry.exercise));

  okEmpty('every run-based row carries its own muscles',
    CONDITIONING_MUSCLE_METADATA
      .filter((entry) => !entry.derivesFromModality)
      .filter((entry) => entry.primary.length === 0)
      .map((entry) => entry.exercise));

  ok('the split is Sam\'s 26 run rows and 27 map-derived rows',
    CONDITIONING_MUSCLE_METADATA.filter((entry) => entry.derivesFromModality).length === 27
      && CONDITIONING_MUSCLE_METADATA.filter((entry) => !entry.derivesFromModality).length === 26,
    `${CONDITIONING_MUSCLE_METADATA.filter((e) => e.derivesFromModality).length} derived / `
      + `${CONDITIONING_MUSCLE_METADATA.filter((e) => !e.derivesFromModality).length} stored`);

  // The owner answers, and answers from the right surface.
  const runRow = CONDITIONING_MUSCLE_METADATA.find((entry) => !entry.derivesFromModality)!;
  const derivedRow = CONDITIONING_MUSCLE_METADATA.find((entry) => entry.derivesFromModality)!;
  ok('a run template answers from its own row',
    conditioningSessionMuscles({ exercise: runRow.exercise })?.source === 'template_row');
  ok('a machine-agnostic template answers from the map when a modality is known',
    conditioningSessionMuscles({ exercise: derivedRow.exercise, modality: 'row' })?.source
      === 'modality_map');
  // Not knowable without one — and the owner says so rather than guessing.
  ok('a machine-agnostic template asked with NO modality returns null, not a guess',
    conditioningSessionMuscles({ exercise: derivedRow.exercise }) === null);
  ok('an unknown session returns null',
    conditioningSessionMuscles({ exercise: 'Not A Session', modality: 'bike' }) === null);

  // THE SEAM TO THE GENERATOR. A generated session carries a typed
  // `ConditioningOption.modality`, whose vocabulary spells two things
  // differently from the sheet's: 'running' for run, and no 'air_bike' (an air
  // bike stamps as 'bike'). The owner takes both spellings, so these cells pass
  // the generator's OWN words — no cast, which is what made the old pin here
  // possible to write while nothing could actually call it.
  const RENDERED: ReadonlyArray<NonNullable<ConditioningOption['modality']>> =
    ['bike', 'row', 'ski', 'mixed'];
  okEmpty('every rendering a generated option can name resolves in the map',
    RENDERED.filter((modality) =>
      conditioningSessionMuscles({
        exercise: derivedRow.exercise, modality,
      })?.source !== 'modality_map'));

  // SAM'S RULING 2026-08-05 ("3a whole-body") CLOSED THIS GAP BY AUTHORSHIP.
  // The old pin here said a rotating session derives NO muscles, because four
  // machine rows had no answer for one. The answer is now a fifth AUTHORED row
  // — not a union, not a first-machine pick, not a fallback — so the cell that
  // pinned the gap becomes the cell that holds the ruling.
  const mixed = conditioningSessionMuscles({
    exercise: derivedRow.exercise, modality: 'mixed',
  });
  ok('a rotating session answers from Sam\'s authored whole-body row',
    mixed?.source === 'modality_map'
      && [...(mixed?.primary ?? [])].join('|') === 'Quads|Glutes|Midline',
    JSON.stringify(mixed));

  // The other half of the ruling: it closed by AUTHORSHIP. If the code ever
  // starts composing the rotating answer out of the machine rows, this catches
  // it — the whole-body row is not any union of them.
  const machineUnion = new Set(
    MODALITY_MUSCLE_MAP.filter((entry) => entry.modality !== 'mixed')
      .flatMap((entry) => [...entry.primary]));
  ok('the rotating row is authored, not composed from the machines',
    [...(mixed?.primary ?? [])].some((muscle) => !machineUnion.has(muscle))
      || [...machineUnion].some((muscle) => !(mixed?.primary ?? []).includes(muscle)),
    `mixed primary ${JSON.stringify(mixed?.primary)} vs machine-primary union `
      + `${JSON.stringify([...machineUnion])}`);

  // A RUN rendering still defers. The sheet says "(per template row)" and the
  // owner must not answer from the map for it, in either spelling.
  okEmpty('a run rendering defers to the per-template rows, in either spelling',
    (['run', 'running'] as const).filter((modality) =>
      conditioningSessionMuscles({ exercise: derivedRow.exercise, modality }) !== null));
}

console.log('\n[5] VOCABULARY — the sheet uses only signed words');
{
  const allowed = new Set<string>(MUSCLE_GROUPS as readonly string[]);
  const unknown = new Set<string>();
  for (const row of [...templateRows, ...mapRows]) {
    if (row.Modality === 'Run') continue;
    for (const column of ['Primary muscle groups', 'Secondary muscle groups']) {
      for (const muscle of splitMuscles(row[column] ?? '')) {
        if (!allowed.has(muscle)) unknown.add(muscle);
      }
    }
  }
  // "Wrist" is the live example: Sam's words for Row were "... shoulders,
  // wrist", the vocabulary has no such word, and `Grip` is the signed stand-in.
  // Adding Wrist is Sam's to rule — this cell is what stops it arriving by hand.
  okEmpty('no muscle outside the signed vocabulary appears on either tab', [...unknown],
    'add the word to MuscleGroup only on a Sam ruling — Grip is the signed '
    + 'stand-in for wrist/forearm work');

  const gates = new Set<string>(EXPERIENCE_GATES as readonly string[]);
  okEmpty('every experience gate is one of the authored ladder\'s',
    templateRows.filter((row) => !gates.has(row['Experience gate'] ?? ''))
      .map((row) => `${row.Exercise}: "${row['Experience gate']}"`));
}

console.log('\n[6] COVERAGE — the sheet and the template vocabulary agree');
{
  const templateNames = new Set(CONDITIONING_TEMPLATES.map((template) => template.name));
  const covered = new Set(CONDITIONING_MUSCLE_METADATA.map((entry) => entry.exercise));

  okEmpty('every row names a template that ships',
    [...covered].filter((name) => !templateNames.has(name)));

  // 53 + the 2 Sam signed earlier = the 55. A 56th template arriving with no
  // muscle row would land here, which is the gap this cell exists to catch.
  okEmpty('every signed template has muscle metadata somewhere',
    [...templateNames].filter((name) =>
      !covered.has(name) && !SIGNED_ELSEWHERE.includes(name)));

  okEmpty('the two master-sheet rows are NOT re-derived here',
    SIGNED_ELSEWHERE.filter((name) => covered.has(name)),
    'these are signed on docs/EXERCISE_MASTER_SHEET_2026-07-28.xlsx and must '
    + 'keep exactly one home');
}

console.log(
  `\nConditioning muscle equality: passed=${passed}/${passed + failures.length} `
  + `failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
