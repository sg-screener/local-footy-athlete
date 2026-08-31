/**
 * Conditioning templates — doc<->code equality.
 *
 *   docs/CONDITIONING_TEMPLATES_FINAL_2026-07-25.xlsx   (Sam, AUTHORED FINAL)
 *
 * The workbook is the SOURCE OF TRUTH for all 55 conditioning doses. This suite
 * parses it directly and holds `src/data/conditioningTemplates.ts` to it field
 * for field, in both directions. If Sam edits a dose, adds a row, bins a row or
 * changes a property, this suite fails until the typed module matches.
 *
 * It is a DRIFT DETECTOR, not a transcription checker: the module is generated
 * from the sheet, so it starts in agreement by construction. Its whole value is
 * what happens on the next authored edit.
 *
 * Read the sheet, never a derived extract — see support/xlsxReader.ts.
 *
 * Run: npm run test:conditioning-templates
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import path from 'path';

import {
  CONDITIONING_TEMPLATES,
  CONDITIONING_QUALITY_TABS,
  GOVERNING_QUALITY_TABLE,
  MODALITY_RENDERING_RULES,
  EFFORT_LENGTH_ASSUMPTIONS,
  TEMPLATE_PROPERTY_SOURCE_TEXT,
  QUALITY_FRAMEWORK_MAPPING,
  LEGACY_CONDITIONING_FORMAT_MAP,
  type ConditioningQuality,
  type ConditioningTemplate,
  type TemplateProperty,
} from '../data/conditioningTemplates';
import { readSheetRecords, readXlsx } from './support/xlsxReader';
// The signed flush replacement fixture is read alongside the original workbook.
import fs from 'fs';
import { conditioningCategoryTruth } from './support/conditioningCategoryTruth';

const repoRoot = path.resolve(__dirname, '../..');
const SHEET = path.join(repoRoot, 'docs/CONDITIONING_TEMPLATES_FINAL_2026-07-25.xlsx');

import {
  REQUESTABLE_CATEGORIES_FOR_QUALITY,
  UNREQUESTABLE_AUTHORED_QUALITIES,
  poolForCategoryPublic,
  renderableModalities,
  longestWorkIntervalMinutes,
  blockLengthMinutes,
  composeConditioningRows,
  selectConditioningTemplate,
  codDecelPermitted,
} from '../rules/conditioningSelection';
import {
  conditioningCardPresentation,
  conditioningCardPresentationFromText,
  conditioningDisplayLines,
  conditioningDisplayTitleForName,
} from '../rules/conditioningDisplay';

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

/* ── The sheet, as authored ── */

/** Tab name in the workbook -> the typed quality it maps to. */
const TAB_TO_QUALITY: ReadonlyArray<readonly [string, ConditioningQuality]> = [
  ['Acceleration', 'acceleration'],
  ['Top End Speed', 'top_end_speed'],
  ['Repeat Sprint', 'repeat_sprint'],
  ['Change of Direction-Decel', 'cod_decel'],
  ['Anaerobic', 'anaerobic'],
  ['Aerobic Power', 'aerobic_power'],
  ['Aerobic Capacity', 'aerobic_capacity'],
  ['Flush', 'flush'],
];

/** Sam's stated per-tab breakdown, from the FINAL doc's "Final numbers". */
const AUTHORED_TAB_COUNTS: Readonly<Record<string, number>> = {
  Acceleration: 7,
  'Top End Speed': 4,
  'Repeat Sprint': 5,
  'Change of Direction-Decel': 4,
  Anaerobic: 9,
  'Aerobic Power': 9,
  'Aerobic Capacity': 10,
  Flush: 7,
};

interface SheetRow {
  readonly quality: ConditioningQuality;
  readonly tab: string;
  readonly record: Record<string, string>;
}

const sheetRows: SheetRow[] = [];
for (const [tab, quality] of TAB_TO_QUALITY) {
  for (const record of readSheetRecords(SHEET, tab)) {
    sheetRows.push({ quality, tab, record });
  }
}

console.log('\n[1] THE SHEET — the workbook still reads as Sam signed it');

ok(
  'the workbook still carries all 8 quality tabs',
  TAB_TO_QUALITY.every(([tab]) => readXlsx(SHEET).some((sheet) => sheet.name === tab)),
);

ok(
  'the sheet holds exactly 55 templates',
  sheetRows.length === 55,
  `sheet has ${sheetRows.length}`,
);

for (const [tab] of TAB_TO_QUALITY) {
  const expected = AUTHORED_TAB_COUNTS[tab];
  const actual = sheetRows.filter((row) => row.tab === tab).length;
  ok(`${tab} holds Sam's ${expected} rows`, actual === expected, `found ${actual}`);
}

// Sam signed off at zero flags. `Change Mark` and `Framework Check` narrate
// flags being CLEARED and legitimately contain "⚑", so the check is scoped to
// the columns where a live flag would actually sit: the dose itself.
const FLAGGABLE_COLUMNS = [
  'Work period',
  'Rest period',
  'Sets / rounds (reps)',
  'Intensity',
  'W:R',
  'Total session time',
  'Properties',
] as const;

const flaggedRows = sheetRows.filter(({ record }) =>
  FLAGGABLE_COLUMNS.some((column) => (record[column] ?? '').includes('⚑')),
);

ok(
  'no dose carries a residual flag (Sam signed off at zero)',
  flaggedRows.length === 0,
  flaggedRows.map((row) => row.record.Name).join(', '),
);

ok(
  'the Skim List still declares itself EMPTY',
  readSheetRecords(SHEET, 'Skim List').some((record) =>
    Object.values(record).some((cell) => cell.trim() === 'EMPTY'),
  ),
);

/* ── Code matches the sheet, both directions ── */

console.log('\n[2] EQUALITY — every authored row ships exactly, and nothing else does');

ok(
  'the module ships exactly 55 templates',
  CONDITIONING_TEMPLATES.length === 55,
  `module has ${CONDITIONING_TEMPLATES.length}`,
);

const byKey = new Map<string, ConditioningTemplate>(
  CONDITIONING_TEMPLATES.map((template) => [`${template.quality}::${template.name}`, template]),
);

ok(
  'no two templates share a quality and name',
  byKey.size === CONDITIONING_TEMPLATES.length,
  `${CONDITIONING_TEMPLATES.length - byKey.size} collision(s)`,
);

/** Sheet column -> the module field that must equal it verbatim. */
const FIELD_EQUALITY: ReadonlyArray<readonly [string, keyof ConditioningTemplate]> = [
  ['Work period', 'workPeriod'],
  ['Rest period', 'restPeriod'],
  ['Sets / rounds (reps)', 'setsRounds'],
  ['Intensity', 'intensity'],
  ['W:R', 'workToRest'],
  ['Total session time', 'totalSessionTime'],
  ['Framework Check', 'frameworkCheck'],
  ['Effort Cue', 'effortCue'],
  ['Modality Notes', 'modalityNotes'],
  ['Source', 'source'],
  ['Change Mark', 'changeMark'],
];

/**
 * ── FIELDS SAM RE-AUTHORED AFTER THE SNAPSHOT ─────────────────────────────
 *
 * The sheet mirror is `conditioning_templates_sam_state_2026-07-25.json` — his
 * spreadsheet ON THAT DAY. When he re-authors a field in chat afterwards, the
 * module must move and the snapshot must NOT: editing a file whose name is a
 * date would make it a record of nothing.
 *
 * ⚠ **THIS IS AN OVERRIDE, NOT AN EXEMPTION.** Each row states the new text in
 * full and cites the ruling that carries it, and the cell below asserts the
 * module equals THAT string. A field listed here is held exactly as tightly as
 * one held by the sheet — what changes is which authority it answers to. An
 * empty override list is the normal state; a growing one means the snapshot is
 * stale and wants retaking.
 */
const RE_AUTHORED: ReadonlyArray<{
  readonly name: string;
  readonly column: string;
  readonly ruling: string;
  readonly text: string;
}> = [
  // R-266 supersedes ONLY the seven flush doses. Keep the old workbook intact
  // and assert exact reviewed replacement text, never exempt these fields.
  ...JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/flush-prescriptions-sam-2026-08-28.json'), 'utf8'))
    .flatMap((row: Record<string, string>) => FIELD_EQUALITY.filter(([, field]) => field in row)
      .map(([column, field]) => ({ name: row.name, column, text: row[field], ruling: 'R-266, Sam 2026-08-28' }))),
  {
    name: 'Classic 4×4',
    column: 'Effort Cue',
    ruling: 'R-240, Sam 2026-08-26 — simplify the 4×4 card description',
    text: 'Choose a pace you can repeat across all 4 rounds.',
  },
  {
    name: 'Classic 4×4',
    column: 'Rest period',
    ruling: 'R-239, Sam 2026-08-26 — the 4×4 VO₂ Max session has complete rest, not jogging',
    text: '3 min complete rest',
  },
];

const reAuthored = new Map(RE_AUTHORED.map((r) => [`${r.name}::${r.column}`, r]));

const missingFromCode: string[] = [];
const fieldMismatches: string[] = [];

for (const { quality, record } of sheetRows) {
  const template = byKey.get(`${quality}::${record.Name}`);
  if (!template) {
    missingFromCode.push(`${quality}::${record.Name}`);
    continue;
  }
  for (const [column, field] of FIELD_EQUALITY) {
    const override = reAuthored.get(`${record.Name}::${column}`);
    const authored = override ? override.text : (record[column] ?? '');
    const shipped = String(template[field] ?? '');
    if (authored !== shipped) {
      fieldMismatches.push(
        `${record.Name} · ${column}\n        sheet: ${JSON.stringify(authored)}\n        code:  ${JSON.stringify(shipped)}`,
      );
    }
  }
}

ok(
  'every authored row is present in the module',
  missingFromCode.length === 0,
  missingFromCode.join('\n      '),
);

ok(
  'every authored field ships verbatim — no rewording, no rounding',
  fieldMismatches.length === 0,
  fieldMismatches.slice(0, 5).join('\n      '),
);

/* ⚠ NON-VACUITY FOR THE OVERRIDE ITSELF. An override whose text already equals
 * the snapshot is asserting nothing, and an override naming a row or column that
 * does not exist silently exempts a field forever. Both red here. */
ok(
  'every re-authored override actually overrides a real, differing field',
  RE_AUTHORED.every((r) => {
    const row = sheetRows.find((s2) => s2.record.Name === r.name);
    if (!row) return false;
    if (!FIELD_EQUALITY.some(([column]) => column === r.column)) return false;
    return (row.record[r.column] ?? '') !== r.text;
  }),
  RE_AUTHORED.map((r) => `${r.name} · ${r.column} · ${r.ruling}`).join(' | '),
);

const sheetKeys = new Set(sheetRows.map(({ quality, record }) => `${quality}::${record.Name}`));
const invented = CONDITIONING_TEMPLATES.filter(
  (template) => !sheetKeys.has(`${template.quality}::${template.name}`),
);

ok(
  'the module invents no template Sam did not author',
  invented.length === 0,
  invented.map((template) => `${template.quality}::${template.name}`).join(', '),
);

/* ── The Bible's shippability rule ── */

console.log('\n[3] SCHEMA — "a template missing any of these is not shippable"');

const SCHEMA_FIELDS: ReadonlyArray<keyof ConditioningTemplate> = [
  'workPeriod',
  'restPeriod',
  'setsRounds',
  'intensity',
  'workToRest',
  'totalSessionTime',
];

const incomplete = CONDITIONING_TEMPLATES.filter((template) =>
  SCHEMA_FIELDS.some((field) => String(template[field] ?? '').trim() === ''),
);

ok(
  'every template carries all six schema values',
  incomplete.length === 0,
  incomplete.map((template) => template.name).join(', '),
);

ok(
  'every template carries an effort cue',
  CONDITIONING_TEMPLATES.every((template) => template.effortCue.trim() !== ''),
  CONDITIONING_TEMPLATES.filter((t) => t.effortCue.trim() === '').map((t) => t.name).join(', '),
);

ok(
  'every template declares a base unit',
  CONDITIONING_TEMPLATES.every((template) =>
    ['time', 'distance', 'reps', 'time_or_calories'].includes(template.baseUnit),
  ),
);

/* ── The six selection properties ── */

console.log('\n[4] PROPERTIES — six typed selection rules, bound to the authored rows');

/** Property kind -> the authored row count carrying it, per the FINAL doc. */
const AUTHORED_PROPERTY_COUNTS: Readonly<Record<TemplateProperty, number>> = {
  set_length_max_4_5_min: 3,
  finisher_role_only: 1,
  fallback_only: 1,
  availability_gate_no_team_training: 4,
  mid_session_mixing_flush_only: 3,
  no_ski_row_flywheel: 4,
  // Sam's ruling 5, 2026-08-05 (docs/SWITCHOVER_PARKED_RULINGS_2026-08-05.md):
  // authored onto the Acceleration tab so the gate is the SHEET's, not a code
  // filter. One row — 'Team-Training Warm-Up Dose'.
  warmup_rider_only: 1,
};

for (const [property, expected] of Object.entries(AUTHORED_PROPERTY_COUNTS)) {
  const actual = CONDITIONING_TEMPLATES.filter((template) =>
    template.properties.includes(property as TemplateProperty),
  ).length;
  ok(`${property} binds to ${expected} row(s)`, actual === expected, `found ${actual}`);
}

ok(
  // SEVEN since Sam's ruling 5, 2026-08-05 — the warm-up rider gate. The
  // count is pinned, not the number: an EIGHTH appearing untyped is the
  // defect this cell exists to catch.
  'exactly seven property kinds exist — no eighth appears untyped',
  Object.keys(TEMPLATE_PROPERTY_SOURCE_TEXT).length === 7,
  `found ${Object.keys(TEMPLATE_PROPERTY_SOURCE_TEXT).length}`,
);

// Every non-empty Properties cell must have been recognised. An unrecognised
// cell silently dropping to [] is the failure mode this catches.
const unrecognised: string[] = [];
for (const { quality, record } of sheetRows) {
  const cell = record.Properties ?? '';
  const template = byKey.get(`${quality}::${record.Name}`);
  if (!template) continue;
  if (cell.trim() === '' && template.properties.length > 0) {
    unrecognised.push(`${record.Name}: code claims a property the sheet does not`);
  }
  if (cell.trim() !== '' && template.properties.length === 0) {
    unrecognised.push(`${record.Name}: authored property dropped -> ${JSON.stringify(cell)}`);
  }
}
ok(
  'no authored property is silently dropped or invented',
  unrecognised.length === 0,
  unrecognised.join('\n      '),
);

ok(
  "every property's source text is the authored wording from the sheet",
  Object.values(TEMPLATE_PROPERTY_SOURCE_TEXT).every((text) =>
    sheetRows.some(({ record }) => (record.Properties ?? '').includes(text)),
  ),
  Object.entries(TEMPLATE_PROPERTY_SOURCE_TEXT)
    .filter(([, text]) => !sheetRows.some(({ record }) => (record.Properties ?? '').includes(text)))
    .map(([kind, text]) => `${kind} -> ${JSON.stringify(text)}`)
    .join('\n      '),
);

ok(
  'the availability gate covers the whole COD/Decel tab',
  CONDITIONING_TEMPLATES.filter((template) => template.quality === 'cod_decel').every((template) =>
    template.properties.includes('availability_gate_no_team_training'),
  ),
);

ok(
  'mid-session mixing is flush-only',
  CONDITIONING_TEMPLATES.filter((template) =>
    template.properties.includes('mid_session_mixing_flush_only'),
  ).every((template) => template.quality === 'flush'),
);

ok(
  'the finisher-role template is never a session in its own right',
  CONDITIONING_TEMPLATES.filter((template) =>
    template.properties.includes('finisher_role_only'),
  ).every((template) => template.name === 'Tabata Finisher'),
);

/* ── Modality rendering + governing table ── */

console.log('\n[5] RENDERING RULES — the standing modality law as typed data');

// The sheet's Architecture tab NUMBERS seven standing rules. The sub-10-second
// flywheel exclusion is an eighth standing rule from a different authority —
// Sam's FINAL ruling 21, carried into the Bible's Section 6 modality rules —
// and is additionally bound per row as the `no_ski_row_flywheel` property.
// Asserting the exact ID set rather than a count keeps both facts checked.
const SHEET_NUMBERED_RULE_IDS = [
  'time_first',
  'shared_distance',
  'erg_interval_cap',
  'sprint_family_run_only',
  'no_sleds',
  'mid_session_mixing_flush_only',
  'classification_law',
] as const;

ok(
  "all 7 of the sheet's numbered standing rules are encoded",
  SHEET_NUMBERED_RULE_IDS.every((id) =>
    MODALITY_RENDERING_RULES.some((rule) => rule.id === id),
  ),
  SHEET_NUMBERED_RULE_IDS.filter(
    (id) => !MODALITY_RENDERING_RULES.some((rule) => rule.id === id),
  ).join(', '),
);

ok(
  "ruling 21's flywheel exclusion is encoded as an eighth standing rule",
  MODALITY_RENDERING_RULES.some((rule) => rule.id === 'no_ski_row_sub_10s'),
);

ok(
  'no unnumbered rendering rule has crept in beyond those eight',
  MODALITY_RENDERING_RULES.length === SHEET_NUMBERED_RULE_IDS.length + 1,
  `found ${MODALITY_RENDERING_RULES.length}: ${MODALITY_RENDERING_RULES.map((r) => r.id).join(', ')}`,
);

ok(
  'Run/Ski/Row share the nominal distance',
  MODALITY_RENDERING_RULES.some(
    (rule) => rule.id === 'shared_distance' && rule.sharedDistance?.join(',') === 'run,ski,row',
  ),
);

ok('Bike renders at double distance', MODALITY_RENDERING_RULES.some(
  (rule) => rule.id === 'shared_distance' && rule.bikeDistanceMultiplier === 2));

ok(
  'Air Bike is time-based at 250 m ≈ 1 min',
  MODALITY_RENDERING_RULES.some(
    (rule) =>
      rule.id === 'shared_distance' &&
      rule.airBikeMetresPerMinute === 250,
  ),
);

ok(
  'work intervals over 8 min are Run/Bike only, ergs cap at 8 and prefer 6',
  MODALITY_RENDERING_RULES.some(
    (rule) =>
      rule.id === 'erg_interval_cap' &&
      rule.ergCapMinutes === 8 &&
      rule.ergPreferredMinutes === 6 &&
      rule.uncappedModalities?.join(',') === 'run,bike',
  ),
);

ok(
  'Ski and Row are excluded from every sub-10-second template',
  MODALITY_RENDERING_RULES.some(
    (rule) =>
      rule.id === 'no_ski_row_sub_10s' &&
      rule.excludedModalities?.join(',') === 'ski,row' &&
      rule.appliesAtOrBelowSeconds === 10 &&
      rule.carriers?.join(',') === 'air_bike,bike,run',
  ),
);

ok(
  'sprint-family work is run-only with exactly three named exceptions',
  MODALITY_RENDERING_RULES.some(
    (rule) => rule.id === 'sprint_family_run_only' && rule.namedExceptions?.length === 3,
  ),
);

ok('NO SLEDS is encoded as a standing rule', MODALITY_RENDERING_RULES.some(
  (rule) => rule.id === 'no_sleds'));

ok(
  'every sub-10-second machine-admitting row carries the NO SKI/ROW property',
  CONDITIONING_TEMPLATES.filter((template) =>
    template.properties.includes('no_ski_row_flywheel'),
  ).length === 4,
);

console.log('\n[6] GOVERNING TABLE + framework mapping');

ok('the governing table carries Sam\'s five quality rows', GOVERNING_QUALITY_TABLE.length === 5,
  `found ${GOVERNING_QUALITY_TABLE.length}`);

ok(
  'the sprint-family exemption lifts the alactic ceiling but keeps the 1:6 floor',
  GOVERNING_QUALITY_TABLE.some(
    (row) =>
      row.id === 'anaerobic_power_alactic' &&
      row.sprintFamilyExemption === true &&
      row.workToRestFloor === 6,
  ),
);

ok(
  'all 8 quality tabs are mapped to a framework row or explicitly unbanded',
  CONDITIONING_QUALITY_TABS.every((quality) => quality in QUALITY_FRAMEWORK_MAPPING),
);

ok(
  'COD/Decel and Flush are the two explicitly unbanded qualities',
  CONDITIONING_QUALITY_TABS.filter(
    (quality) => QUALITY_FRAMEWORK_MAPPING[quality].frameworkRow === null,
  ).join(',') === 'cod_decel,flush',
);

ok(
  'the effort-length assumptions used to compute distance rows are recorded',
  EFFORT_LENGTH_ASSUMPTIONS.length >= 10 &&
    EFFORT_LENGTH_ASSUMPTIONS.some((entry) => entry.label === '10 m'),
);

/* ── Old-format mapping ── */

console.log('\n[7] LEGACY MAP — every old conditioning format resolves or is retired');

ok(
  'the legacy map is non-empty',
  LEGACY_CONDITIONING_FORMAT_MAP.length > 0,
  `found ${LEGACY_CONDITIONING_FORMAT_MAP.length}`,
);

const shippedNames = new Set(CONDITIONING_TEMPLATES.map((template) => template.name));

// Bind the resolution to a local before the inner predicate: narrowing a
// discriminated union does not survive a property re-read inside a callback.
const danglingTargets = LEGACY_CONDITIONING_FORMAT_MAP.flatMap((entry) => {
  const { resolution } = entry;
  if (resolution.kind !== 'template') return [];
  return shippedNames.has(resolution.templateName)
    ? []
    : [`${entry.legacyName} -> ${resolution.templateName}`];
});

ok(
  'every legacy entry mapped to a template names a template that ships',
  danglingTargets.length === 0,
  danglingTargets.join('\n      '),
);

ok(
  'every retirement records the ruling that retired it',
  LEGACY_CONDITIONING_FORMAT_MAP.every(
    (entry) => entry.resolution.kind !== 'retired' || entry.resolution.ruling.trim() !== '',
  ),
);

/* ── Result ── */

// ── THE WAIST: 8 QUALITIES -> 6 CATEGORIES -> 5 STORED (item 28-C1) ────────
//
// Sam authors EIGHT conditioning qualities; the selector offers SIX categories;
// the stored domain object offers FIVE. Narrowed at two joints, and nothing
// reported the loss — a quality with no category cannot be REQUESTED, so its
// templates are unreachable however many `case` branches exist. An attempt on
// 2026-08-13 wired all four links and the athlete still received ZERO COD
// sessions, which is what proved the blocker was the waist and not the selector.
{
  const quality = REQUESTABLE_CATEGORIES_FOR_QUALITY;
  const qualities = Object.keys(quality) as (keyof typeof quality)[];

  ok('every authored quality declares whether it can be requested',
    qualities.length === 8 && new Set(CONDITIONING_TEMPLATES.map((t) => t.quality)).size <= 8
      && [...new Set(CONDITIONING_TEMPLATES.map((t) => t.quality))].every((q) => q in quality),
    `map has ${qualities.length}; sheet uses ${[...new Set(CONDITIONING_TEMPLATES.map((t) => t.quality))].length}`);

  // EVERY TEMPLATE MUST BE REACHABLE FROM ITS DECLARED CATEGORY. This is the
  // cell that would have caught the original defect: a mapping that points at a
  // category whose pool does not actually contain the template is the same
  // silent loss one joint further along.
  const unreachable: string[] = [];
  for (const template of CONDITIONING_TEMPLATES) {
    if (template.automaticSelection === 'retired') {
      ok('R-266: retired circuit remains readable but cannot enter an automatic pool',
        template.name === 'Bodyweight Circuit (no-equipment fallback)' && template.permittedModalities.length === 0
        && !poolForCategoryPublic('glycolytic').includes(template));
      continue;
    }
    const categories = quality[template.quality];
    if (categories.length === 0) continue;
    const reachable = categories.some((category) =>
      poolForCategoryPublic(category).some((t) => t.name === template.name));
    if (!reachable) {
      unreachable.push(`${template.name} (${template.quality} -> ${categories.join('|')})`);
    }
  }
  ok('every requestable template is actually in its category\'s pool',
    unreachable.length === 0, unreachable.join('; '));

  // THE LOSS IS NAMED, NOT SILENT. This cell is expected to list cod_decel
  // today; it exists so the number can only FALL, and so nobody re-discovers it.
  // THE WAIST NO LONGER LOSES ANYTHING — cod_decel gained a category on
  // 2026-08-13, so this set is empty and must stay empty. It reds if a future
  // authored quality arrives with nowhere to be requested from, which is the
  // silent narrowing this whole unit exists to end.
  ok('no authored quality is unreachable through the vocabulary waist',
    UNREQUESTABLE_AUTHORED_QUALITIES.length === 0,
    `unreachable = ${UNREQUESTABLE_AUTHORED_QUALITIES.join(', ')}`);

  // ⚠ AND THE WAIST BEING FIXED IS NOT THE SAME AS COD REACHING AN ATHLETE.
  // Measured 2026-08-13 after the category landed: cod_decel is REQUESTED 12
  // times in a six-day no-team-training week and the athlete still receives
  // ZERO, because `finisherEligibility` treats every non-aerobic_base category
  // as "hard" and DOWNGRADES it. That is a SECOND narrowing, one joint further
  // on, and it is not this map's to fix. Recorded here so a green waist cannot
  // be mistaken for a delivered session.
  ok('cod_decel is requestable through the waist (its category exists)',
    REQUESTABLE_CATEGORIES_FOR_QUALITY.cod_decel.length === 1,
    'cod_decel lost its category again');

  // AND THE COUNT SAM CARES ABOUT, stated every run rather than inferred.
  const codTemplates = CONDITIONING_TEMPLATES.filter((t) => t.quality === 'cod_decel');
  ok('the four signed COD/decel templates still exist on the sheet',
    codTemplates.length === 4, String(codTemplates.length));
}

// ── C3: THE ERG CAP IS ENFORCED, NOT JUST ENCODED ─────────────────────────
//
// Sam, Bible :1297 and repeated per machine at :1401 (Rower) and :1402 (Ski):
// "Work intervals longer than 8 minutes are Run or Bike only. Ski, Row and Air
// Bike have a HARD CAP of 8 minutes IN ANY ONE WORK INTERVAL... Anything longer
// than 8 minutes must be Run or Bike."
//
// It was fully encoded as data and read by NOTHING but a test, while
// renderableModalities decided Ski/Row from a prose regex that could not see it.
{
  const over = CONDITIONING_TEMPLATES.filter((t) => {
    const n = longestWorkIntervalMinutes(t);
    return n !== null && n > 8;
  });
  ok('some authored rows DO exceed 8 minutes — the cell is not vacuous',
    over.length > 0, String(over.length));

  const leaking = over.filter((t) =>
    renderableModalities(t).some((m) => m === 'ski' || m === 'row' || m === 'air_bike'));
  ok('no row over 8 minutes offers Ski, Row or Air Bike',
    leaking.length === 0,
    leaking.map((t) => `${t.name} (${longestWorkIntervalMinutes(t)}min)`).join('; '));

  // AT the cap is legal — his number is a ceiling, not a limbo.
  const atCap = CONDITIONING_TEMPLATES.filter((t) => longestWorkIntervalMinutes(t) === 8);
  ok('a row AT exactly 8 minutes is untouched — 8 is legal, 9 is not',
    atCap.every((t) => renderableModalities(t).length > 0), String(atCap.length));

  // THE RANGE IS READ AT ITS TOP, because the top is what can ship.
  ok('an authored range is read at its TOP, not its bottom',
    longestWorkIntervalMinutes({
      workPeriod: '8 min easy (or one continuous 8–10 min block on Ski/Row)',
    } as never) === 10);

  // Second-scale rows are out of reach of a minutes cap.
  ok('a seconds-based row yields no minute figure',
    longestWorkIntervalMinutes({ workPeriod: '10 s hard' } as never) === null);

  // ── THE ENFORCER READS THE AUTHORED RULE, IT DOES NOT AGREE WITH IT ───────
  //
  // C3's own complaint was that `ergCapMinutes` and `excludedModalities` were
  // "read by nothing but a test". The first enforcer re-typed both as literals,
  // which satisfied the behaviour and left the complaint TRUE — two owners for
  // one of Sam's numbers, free to drift apart silently.
  //
  // Asserting `ERG_CAP_MINUTES === 8` would be worthless: a hardcoded 8 passes
  // it. So this MOVES THE AUTHORED NUMBER and requires the behaviour to follow.
  // A row at exactly 8 minutes is legal under the real cap; drop the ceiling to
  // 7 and that same row must lose its ergs. Only a reader can do that.
  {
    const capRule = MODALITY_RENDERING_RULES.find((r) => r.id === 'erg_interval_cap');
    ok('the erg cap rule is authored in the sheet, with both fields',
      capRule?.ergCapMinutes === 8 && capRule?.excludedModalities?.join(',') === 'ski,row,air_bike',
      JSON.stringify(capRule ?? null));

    // The resolved Steady Blocks branch is six minutes now, not its unused
    // eight-minute alternative. Mutate an actual hard template to the boundary.
    const eightMinuteErgRow = { ...CONDITIONING_TEMPLATES.find(t => t.name === 'Three-Minute Intervals')!, workPeriod: '8 min hard' };
    ok('an 8-minute boundary probe DOES offer an erg — the mutation below is not vacuous',
      longestWorkIntervalMinutes(eightMinuteErgRow) === 8 && renderableModalities(eightMinuteErgRow).includes('row'));

    // The probe: re-read the module with the authored ceiling lowered to 7.
    let lowered: string[] = [];
    let probeRan = false;
    if (eightMinuteErgRow) {
      const original = capRule!.ergCapMinutes;
      try {
        (capRule as { ergCapMinutes?: number }).ergCapMinutes = 7;
        delete require.cache[require.resolve('../rules/conditioningSelection')];
        const reloaded = require('../rules/conditioningSelection');
        lowered = reloaded.renderableModalities(eightMinuteErgRow);
        probeRan = true;
      } finally {
        (capRule as { ergCapMinutes?: number }).ergCapMinutes = original;
        delete require.cache[require.resolve('../rules/conditioningSelection')];
      }
    }
    ok('lowering the AUTHORED cap to 7 strips the ergs off an 8-minute row',
      probeRan && !lowered.some((m) => m === 'ski' || m === 'row' || m === 'air_bike'),
      `probeRan=${probeRan} modalities=${lowered.join(',')}`);

    // EVERY BRANCH, NOT THE OUTPUT. The probe above found the "all 5
    // modalities" branch returning BEFORE the cap was applied — the first exit
    // of five, and the only uncapped one. It survived because the cap was only
    // ever asserted over the authored rows, and no authored row today combines
    // that phrase with a >8 min interval. These are SYNTHETIC, so the guard
    // does not depend on which rows happen to exist.
    for (const phrase of ['All 5 modalities.', 'Any modality.']) {
      ok(`a synthetic 10-minute "${phrase}" row is still capped`,
        !renderableModalities({
          ...eightMinuteErgRow, modalityNotes: phrase, workPeriod: '10 min continuous',
        } as never).some((m) => m === 'ski' || m === 'row' || m === 'air_bike'),
        renderableModalities({
          ...eightMinuteErgRow, modalityNotes: phrase, workPeriod: '10 min continuous',
        } as never).join(','));
    }
    // ...and the same row at 8 minutes keeps all five, so the cell above is
    // asserting the CAP and not simply that the branch returns nothing.
    ok('a synthetic 8-minute "All 5 modalities" row keeps all five',
      renderableModalities({
        ...eightMinuteErgRow, modalityNotes: 'All 5 modalities.', workPeriod: '8 min continuous',
      } as never).length === 5);
  }
}

// ── SAM'S COD WINDOW, RULED 2026-08-13 (item 31) ────────────────────────────
//
// "So the athlete can only do COD work in late off season (after first 4 weeks
// of off season), in christmas break or during pre season if no team trainings
// ... No COD required in season for anyone."
//
// He asked for ONE RULE rather than three phase branches, so these assert the
// rule and then assert his three named cases FALL OUT of it.
{
  const permitted = (
    weekHasTeamTraining: boolean,
    seasonPhase: string | null | undefined,
    offseasonSubphase: string | null | undefined,
  ) => codDecelPermitted({ weekHasTeamTraining, seasonPhase, offseasonSubphase });

  ok('[COD] late off-season with no team training is PERMITTED',
    permitted(false, 'Off-season', 'late_offseason') === true);
  ok('[COD] pre-season with no team training is PERMITTED — "some people play for cash"',
    permitted(false, 'Pre-season', null) === true);
  // The Christmas break needs no case of its own: it IS pre-season with the
  // week's team training cleared. That is the whole reason the rule beats a
  // phase list, so it is asserted rather than assumed.
  ok('[COD] the Christmas break falls out — pre-season, team training cleared for the week',
    permitted(false, 'Pre-season', null) === true
      && permitted(true, 'Pre-season', null) === false);

  // NEVER IN SEASON, FOR ANYONE — including a week with no team training, which
  // is exactly the case a "no team training" gate alone would have let through.
  ok('[COD] in season is REFUSED even when the week has no team training',
    permitted(false, 'In-season', null) === false);

  // THE FIRST FOUR WEEKS ARE RECOVERY. early = weeks 1-2, mid = 3-4.
  ok('[COD] early off-season is REFUSED', permitted(false, 'Off-season', 'early_offseason') === false);
  ok('[COD] mid off-season is REFUSED', permitted(false, 'Off-season', 'mid_offseason') === false);

  // TEAM TRAINING SHUTS IT IN EVERY PHASE — the club does the change of
  // direction. Without this the phase half could pass while the week half rots.
  ok('[COD] team training this week REFUSES in every phase',
    permitted(true, 'Off-season', 'late_offseason') === false
      && permitted(true, 'Pre-season', null) === false
      && permitted(true, 'In-season', null) === false);

  // CLOSED WHEN THE PHASE IS UNKNOWN. COD is the "cut first" category; the
  // least-informed state must not be the most permissive one.
  ok('[COD] an unknown phase is REFUSED, not assumed permissive',
    permitted(false, undefined, null) === false && permitted(false, null, null) === false);

  // NON-VACUITY: the rule must say YES to something, or every cell above passes
  // on a function that returns false forever.
  ok('[COD] the rule is not a constant false',
    permitted(false, 'Off-season', 'late_offseason') === true);
}

// ── C11: THE SET/BLOCK CAP IS ENFORCED, NOT JUST DECLARED ──────────────────
//
// Sam: short-intermittent high-%MAS work keeps the set/block to ~4-5 min,
// "enforced at selection time, not written into the dose". He confirmed it
// needed building — "okay it needs to be checked". `set_length_max_4_5_min`
// appeared five times in the data and NOTHING read it.
{
  const capped = CONDITIONING_TEMPLATES.filter((t) =>
    t.properties.includes('set_length_max_4_5_min'));
  ok('[C11] templates DO carry the set-cap property — the cell is not vacuous',
    capped.length === 3, String(capped.length));

  // ⚠ THE UNIT IS THE BLOCK, NOT THE WORK INTERVAL. Every one of these uses
  // second-scale intervals, so a filter built on longestWorkIntervalMinutes
  // would be permanently inert — that was my first attempt.
  ok('[C11] the work-interval reader is BLIND to these templates — wrong unit',
    capped.every((t) => longestWorkIntervalMinutes(t) === null));

  ok('[C11] every authored capped template is within the 5 min block cap',
    capped.every((t) => (blockLengthMinutes(t) ?? 0) <= 5),
    capped.map((t) => `${t.name}=${blockLengthMinutes(t)}`).join('; '));

  // The derivation, and the stated number winning over it.
  ok('[C11] a block is rounds x (work + rest) — 8 x (15s+15s) = 4 min',
    blockLengthMinutes({
      setsRounds: '8 rounds × 2–3 blocks, 2 min between blocks',
      workPeriod: '15 s hard', restPeriod: '15 s easy',
    } as never) === 4);
  ok('[C11] an authored "(N min per block)" WINS over the derivation — his words rule',
    blockLengthMinutes({
      setsRounds: '2 blocks × 5 rounds (5 min per block)',
      workPeriod: '30 s hard', restPeriod: '30 s easy',
    } as never) === 5);

  // THE BREACH, SYNTHETIC ON PURPOSE: no authored row breaches the cap today, so
  // a cell waiting for one would certify the sheet rather than the rule.
  const overCap = {
    name: 'Synthetic Over-Cap', quality: 'aerobic_power',
    setsRounds: '12 rounds', workPeriod: '30 s hard', restPeriod: '30 s easy',
    totalSessionTime: '≈20 min', intensity: '110% MAS', workToRest: '1:1',
    properties: ['set_length_max_4_5_min'], modalityNotes: 'All 5 modalities.',
    baseUnit: 'time', effortCue: 'x',
  } as never;
  // 12 x (30s + 30s) = 720s = TWELVE minutes. My first draft of this cell said
  // six — the code was right and my arithmetic was not, which is the correct
  // direction for a cell to fail in.
  ok('[C11] a 12-round 30:30 block is TWELVE minutes — well over his cap',
    blockLengthMinutes(overCap) === 12, String(blockLengthMinutes(overCap)));
  // And a template WITHOUT the property is untouched by the cap.
  // ── THE SELECTION CLAUSE ITSELF, DRIVEN THROUGH THE REAL SELECTOR ───────
  //
  // The item's order: "delete the clause and a cell must red on a block that
  // runs past five minutes." MY FIRST DRAFT RE-IMPLEMENTED THE FILTER INLINE
  // and the mutation SURVIVED — it was testing my copy of the rule, not the
  // rule. This one pushes a breaching template into the real pool and asks
  // `selectConditioningTemplate` for that category, so only the real clause can
  // keep it out.
  {
    const overCapTemplate = {
      ...overCap as unknown as typeof CONDITIONING_TEMPLATES[number],
      name: 'ZZZ Synthetic Over-Cap Block',
      quality: 'aerobic_power',
    } as typeof CONDITIONING_TEMPLATES[number];
    const pool = CONDITIONING_TEMPLATES as unknown as Array<typeof CONDITIONING_TEMPLATES[number]>;
    pool.push(overCapTemplate);
    let everSelected = false;
    let selectedSomething = false;
    try {
      for (let day = 1; day <= 40; day++) {
        const picked = selectConditioningTemplate({
          category: 'vo2' as never,
          dateStr: `2026-03-${String(day % 28 + 1).padStart(2, '0')}`,
        } as never);
        selectedSomething = true;
        if (picked.name === overCapTemplate.name) everSelected = true;
      }
    } finally {
      const at = pool.indexOf(overCapTemplate);
      if (at >= 0) pool.splice(at, 1);
    }
    // NON-VACUITY FIRST: if the selector never returned anything, "never chose
    // the bad one" would be trivially true.
    ok('[C11] the selector actually ran and returned templates',
      selectedSomething);
    ok('[C11] the real selector NEVER chooses an over-cap template that declares the cap',
      !everSelected);
    ok('[C11] and the synthetic template was removed from the shared pool',
      !CONDITIONING_TEMPLATES.some((tpl) => tpl.name === overCapTemplate.name));
  }

  // The reader measures any template; the CAP only binds the ones declaring it.
  ok('[C11] the reader measures a template that does not declare the cap',
    blockLengthMinutes({ setsRounds: '12 rounds', workPeriod: '30 s hard',
      restPeriod: '30 s easy' } as never) === 12);
}

// ── C13: ONE CLEAR ATHLETE PRESCRIPTION, NEVER THE INTERNAL RATIO ──────────
//
// Sam, audit item 3 (2026-08-26): `30:30` means 30 seconds on / 30 seconds
// off, while `1:1` reads as one minute on / one minute off. The workbook's
// `workToRest` ratio is useful internal physiology, but putting ratio-looking
// shorthand in the title beside explicit durations makes one dose look like
// two. He also rejected prescriptions that hand the athlete alternatives such
// as "3 x 8 min, or 4 x 6 min" instead of deciding what to do.
{
  const projected = CONDITIONING_TEMPLATES.map((template) => ({
    template,
    title: conditioningDisplayTitleForName(template.name),
    lines: conditioningDisplayLines({ template }),
  }));

  ok('[C13] every authored conditioning row was projected — the sweep is live',
    projected.length === CONDITIONING_TEMPLATES.length && projected.length === 55,
    `${projected.length}/${CONDITIONING_TEMPLATES.length}`);

  const ratioTitles = projected.filter(({ title }) => /\b\d+\s*:\s*\d+\b/.test(title));
  ok('[C13] titles name the session in plain words, never ratio-looking shorthand',
    ratioTitles.length === 0,
    ratioTitles.map(({ template, title }) => `${template.name} -> ${title}`).join(' | '));

  const prescriptionAlternatives = projected.flatMap(({ template, lines }) =>
    lines
      .filter((line) => line.label === 'Work' || line.label === 'Recovery'
        || line.label === 'Rounds' || line.label === 'Reps' || line.label === 'Blocks')
      .filter((line) => /\b(?:or|variant|alternative)\b/i.test(line.text))
      .map((line) => `${template.name} :: ${line.label}: ${line.text}`));
  ok('[C13] Work, Recovery and count lines prescribe one answer, not a menu',
    prescriptionAlternatives.length === 0,
    prescriptionAlternatives.join(' | '));

  const heartRateLines = projected.flatMap(({ template, lines }) =>
    lines
      .filter((line) => line.label === 'Heart rate' || /\bHR(?:max)?\b/i.test(line.text))
      .map((line) => `${template.name} :: ${line.label}: ${line.text}`));
  ok('[C13] no conditioning card carries a heart-rate line',
    heartRateLines.length === 0,
    heartRateLines.join(' | '));

  const controlledThirty = projected.find(({ template }) =>
    template.name === '30:30 Controlled Tempo Blocks');
  ok('[C13] the controlled 30-second session still says exactly 30 s work / 30 s recovery',
    controlledThirty?.lines.some((line) => line.label === 'Work' && line.text === '30 s on')
      && controlledThirty.lines.some((line) =>
        line.label === 'Recovery' && line.text === '30 s easy')
      && controlledThirty.lines.some((line) =>
        line.label === 'Rounds' && line.text === '13'),
    JSON.stringify(controlledThirty?.lines ?? []));

  const controlledThirtyRow = controlledThirty
    ? composeConditioningRows(controlledThirty.template, '2026-08-26', { omitWarmup: true })[0]
    : null;
  ok('[C13] the generated 30-second row stores and shows the same concrete round count',
    controlledThirtyRow?.prescribedSets === 13
      && controlledThirtyRow.notes?.split('\n').includes('Rounds: 13'),
    JSON.stringify(controlledThirtyRow ?? null));

  const fourByFour = projected.find(({ template }) => template.name === 'Classic 4×4');
  ok('[C13] the 4×4 VO₂ Max session uses its proper athlete title and complete rest',
    fourByFour?.title === '4×4 VO₂ Max'
      && fourByFour.lines.some((line) =>
        line.label === 'Recovery' && line.text === '3 min complete rest')
      && fourByFour.lines.some((line) =>
        line.label === null && line.text === 'Choose a pace you can repeat across all 4 rounds.')
      && !fourByFour.lines.some((line) => /jog/i.test(line.text)),
    `${fourByFour?.title} :: ${JSON.stringify(fourByFour?.lines ?? [])}`);

  const oneMinuteFlush = projected.find(({ template }) =>
    template.name === 'Flush Intervals 1:1 (1 min / 1 min)');
  ok('[C13] the one-minute flush has one plain title and explicit one-minute work / recovery',
    oneMinuteFlush?.title === 'One-Minute Flush Intervals'
      && oneMinuteFlush.lines.some((line) => line.label === 'Work' && line.text === '1 min easy')
      && oneMinuteFlush.lines.some((line) =>
        line.label === 'Recovery' && line.text === '1 min complete rest, including transitions; after every round, including the last')
      && oneMinuteFlush.lines.some((line) =>
        line.label === 'Rounds' && line.text === '6'),
    `${oneMinuteFlush?.title} :: ${JSON.stringify(oneMinuteFlush?.lines ?? [])}`);

  const hardThirty = projected.find(({ template }) =>
    template.name === '30:30 Hard Intermittent');
  const hardThirtyCard = hardThirty
    ? conditioningCardPresentationFromText(
      hardThirty.lines.map((line) => line.label ? `${line.label}: ${line.text}` : line.text).join('\n'),
      'Bike',
    )
    : null;
  ok('[C13] the universal card projection matches the approved athlete hierarchy',
    JSON.stringify(hardThirtyCard) === JSON.stringify({
      modality: 'Bike',
      structure: '2 blocks × 5 rounds',
      workRecovery: '30s hard / 30s easy',
      recoveryDetail: '2–3 min between blocks',
      intensity: '100–110% MAS',
      cue: 'Repeat the same effort throughout each block; do not sprint.',
      total: null,
      supportsPersonalTarget: false,
    }),
    JSON.stringify(hardThirtyCard));
  ok('[C13] a min/km personal target is relevant only to a pure Run modality',
    hardThirty !== undefined
      && JSON.stringify([
        'Run', 'Bike', 'Air Bike', 'RowErg', 'SkiErg', 'Bike → RowErg', 'Run / Walk', null,
      ].map((modality) => conditioningCardPresentation(
        hardThirty.lines,
        modality,
      ).supportsPersonalTarget)) === JSON.stringify([
        true, false, false, false, false, false, false, false,
      ]));

  const continuous = projected.find(({ template }) =>
    template.name === 'Continuous Aerobic Run');
  const continuousCard = continuous
    ? conditioningCardPresentation(continuous.lines, 'Run')
    : null;
  ok('[C13] a continuous session promotes its duration instead of showing a fake one-block interval',
    continuousCard?.structure === '30–50 min continuous'
      && continuousCard.workRecovery === null
      && continuousCard.supportsPersonalTarget,
    JSON.stringify(continuousCard));

  const incompleteCards = projected.filter(({ lines }) => {
    const card = conditioningCardPresentation(lines, 'Bike');
    return !card.structure || !card.intensity || !card.cue;
  });
  ok('[C13] all 55 templates reach the same structure-intensity-cue hierarchy',
    incompleteCards.length === 0,
    incompleteCards.map(({ template }) => template.name).join(' | '));
}

// ── C14: ROTATE THE ELIGIBLE POOL — NEVER RESTART AT THE FIRST ROW ─────────
//
// Sam, simulator review (2026-08-26): conditioning must not repeat strength's
// old "take the top eligible entry" failure. The selector is intentionally
// stable inside one mini-cycle, then advances at the block boundary. Exercise
// every requestable category through that real owner; this is about behaviour,
// not the order of an array literal.
{
  const categories = [
    'aerobic_base', 'tempo', 'sprint', 'vo2', 'glycolytic',
    'recovery_flush', 'cod_decel',
  ] as const;
  const stuck: string[] = [];
  const unstable: string[] = [];
  for (const category of categories) {
    const picks = Array.from({ length: 12 }, (_, index) =>
      selectConditioningTemplate({
        category,
        dateStr: '2026-08-26',
        miniCycleNumber: index + 1,
        noTeamTrainingWeek: true,
      }).name);
    if (new Set(picks).size < 2 || picks[0] === picks[1]) {
      stuck.push(`${category}: ${picks.join(' | ')}`);
    }
    const repeat = selectConditioningTemplate({
      category,
      dateStr: '2030-01-01',
      miniCycleNumber: 2,
      noTeamTrainingWeek: true,
    }).name;
    if (repeat !== picks[1]) unstable.push(`${category}: ${picks[1]} / ${repeat}`);
  }
  ok('[C14] every conditioning category advances beyond its first eligible template',
    stuck.length === 0,
    stuck.join(' || '));
  ok('[C14] the chosen template stays stable inside its mini-cycle',
    unstable.length === 0,
    unstable.join(' || '));
}

{
  const picked = new Set(Array.from({ length: 20 }, (_, i) => selectConditioningTemplate({
    category: 'aerobic_base', dateStr: '2026-08-26', miniCycleNumber: i + 1,
    offFeet: true, availableMachines: ['bike', 'air_bike', 'row', 'ski'], role: 'standalone',
  }).name));
  ok('P14: all five legal off-leg aerobic templates remain reachable; machine count is not a rank',
    ['Continuous Aerobic Run', 'Steady Blocks (3×8 min or 4×6 min)', 'Long Aerobic Intervals',
      'Controlled 10–20 min Blocks', 'Steady 5 min Blocks'].every(name => picked.has(name)), JSON.stringify([...picked]));
}

// [C12] The old planner's categoryToFlavour closure was removed in 3417731e.
// Retire its four cascading source-anchor failures, not category protection.
// The replacement runs the current owner here AND in the release compiler witness.
// Classification and mutation evidence: docs/PROGRAMMING_GAP_CLOSURE_2026-08-28.md.
conditioningCategoryTruth(ok);

console.log(
  `\nConditioning template equality: passed=${passed}/${passed + failures.length} failures=${failures.length}`,
);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
