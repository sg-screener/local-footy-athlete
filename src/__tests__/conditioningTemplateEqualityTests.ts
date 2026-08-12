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

const repoRoot = path.resolve(__dirname, '../..');
const SHEET = path.join(repoRoot, 'docs/CONDITIONING_TEMPLATES_FINAL_2026-07-25.xlsx');

import {
  REQUESTABLE_CATEGORIES_FOR_QUALITY,
  UNREQUESTABLE_AUTHORED_QUALITIES,
  poolForCategoryPublic,
} from '../rules/conditioningSelection';

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

const missingFromCode: string[] = [];
const fieldMismatches: string[] = [];

for (const { quality, record } of sheetRows) {
  const template = byKey.get(`${quality}::${record.Name}`);
  if (!template) {
    missingFromCode.push(`${quality}::${record.Name}`);
    continue;
  }
  for (const [column, field] of FIELD_EQUALITY) {
    const authored = record[column] ?? '';
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

console.log(
  `\nConditioning template equality: passed=${passed}/${passed + failures.length} failures=${failures.length}`,
);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
