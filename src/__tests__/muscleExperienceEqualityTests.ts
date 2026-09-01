/**
 * Muscle + experience metadata and the D17 session flow — doc<->code equality.
 *
 *   docs/EXERCISE_MASTER_SHEET_2026-07-28.xlsx          (Sam, AUTHORED FINAL)
 *   docs/PROGRAMMING_DESIGN_SESSION_2026-07-23.md  §D17   (Sam, AUTHORED)
 *
 * Both are sources of truth. This suite parses them directly and holds the
 * typed modules to them, so a Sam edit fails the build until code matches.
 *
 * Run: npm run test:muscle-experience
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import fs from 'fs';
import path from 'path';

import {
  EXERCISE_MUSCLE_METADATA,
  MUSCLE_GROUPS,
  MUSCLE_METADATA_POOLS,
  EXPERIENCE_GATES,
  EXPERIENCE_GATE_SOURCE_TEXT,
  EXPERIENCE_LADDER,
  REGRESSION_CONVENTION,
  SELECTABLE_WITHOUT_METADATA,
  METADATA_WITHOUT_SELECTABLE_EXERCISE,
  CORRECTED_SPELLING_VARIANTS,
  EXPERIENCE_CROSSWALK,
  ONBOARDING_EXPERIENCE_ANSWERS,
  visibleGatesForOnboardingAnswer,
  ladderLevelForOnboardingAnswer,
  muscleMetadataFor,
  type ExperienceGate,
  type TrainingAgeLevel,
  type MuscleGroup,
} from '../data/muscleExperienceMetadata';
import {
  SESSION_FLOW_MENUS,
  FLOW_RESOLUTION_ORDER,
  FLOW_DOSING,
  FLOW_CATEGORY_MUSCLE_MAPPING,
  FLOW_IS_NEVER_LOAD_BEARING,
  DAY_KINDS_WITHOUT_FLOW,
  type FlowDayType,
} from '../data/sessionFlowMenus';
import {
  selectableExerciseNames,
  selectableVocabularyGroups,
} from '../data/selectableExerciseVocabulary';
import { resolveTrainingAgePolicy, TRAINING_AGE_LEVELS } from '../rules/trainingAgePolicy';
import { resolveExerciseName } from '../utils/loadEstimation';
import { readSheetRecords, parseXlsxWorksheet } from './support/xlsxReader';

const repoRoot = path.resolve(__dirname, '../..');
const SHEET = path.join(repoRoot, 'docs/EXERCISE_MASTER_SHEET_2026-07-28.xlsx');
const DESIGN_DOC = path.join(repoRoot, 'docs/PROGRAMMING_DESIGN_SESSION_2026-07-23.md');
const SHEET_TAB = 'Exercise Master';
/**
 * Five authored preamble rows sit above the header: sign-off, vocabulary legend,
 * regression note, terminology, and the change-log row Sam's 2026-07-27
 * reconciliation added.
 */
const SHEET_HEADER_ROW = 6;

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

const sheetRows = readSheetRecords(SHEET, SHEET_TAB, SHEET_HEADER_ROW);
const namespacedSheet = '<x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:sheetData><x:row r="1"><x:c r="A1" t="s"><x:v>1</x:v></x:c><x:c r="B1" t="str"/><x:c r="C1" t="inlineStr"><x:is><x:t>Hold &amp; </x:t><x:t>lift</x:t></x:is></x:c></x:row></x:sheetData></x:worksheet>';
ok('XLSX reads namespace prefixes, shared strings, rich text and self-closing blank cells',
  JSON.stringify(parseXlsxWorksheet(namespacedSheet, ['unused', 'Pike lift'])) === JSON.stringify([['Pike lift', '', 'Hold & lift']]));
let rejectedBadString = false;
try { parseXlsxWorksheet(namespacedSheet, []); } catch { rejectedBadString = true; }
ok('XLSX missing shared string is red, not an empty equality pass', rejectedBadString);

/* ── The sheet ── */

console.log('\n[1] THE SHEET — still reads as Sam signed it');

/* 199 -> 198 on 2026-08-21: `Light Skipping` was deleted from the master sheet
   itself, on Sam's order — *"It can leave, just delete it from everywhere"* —
   together with its pool entry, cue, tags, load list and vocabulary entry. The
   number moves with the sheet; that is what makes this cell a ratchet rather
   than a decoration. */
ok('the sheet holds 214 canonical exercise rows after both legacy identity merges and the September exercise additions',
  sheetRows.length === 214, `found ${sheetRows.length}`);

ok(
  'every row names an exercise and a pool',
  sheetRows.every((row) => row.Exercise.trim() !== '' && row.Pool.trim() !== ''),
);

ok(
  'every row declares at least one primary muscle group',
  sheetRows.every((row) => row['Primary Muscle Group(s)'].trim() !== ''),
);

ok(
  'every row declares an experience level',
  sheetRows.every((row) => row['Experience Level'].trim() !== ''),
);

/* ── Equality, both directions ── */

console.log('\n[2] EQUALITY — every authored row ships exactly, and nothing else does');

ok(
  'the module ships one entry per authored row',
  EXERCISE_MUSCLE_METADATA.length === sheetRows.length,
  `module ${EXERCISE_MUSCLE_METADATA.length} vs sheet ${sheetRows.length}`,
);

const byExercise = new Map(EXERCISE_MUSCLE_METADATA.map((entry) => [entry.exercise, entry]));

ok(
  'no exercise appears twice',
  byExercise.size === EXERCISE_MUSCLE_METADATA.length,
  `${EXERCISE_MUSCLE_METADATA.length - byExercise.size} duplicate(s)`,
);

/**
 * Split an authored muscle cell into groups.
 *
 * "—" is the sheet's placeholder for "no secondary muscle", not a muscle, and
 * casing is normalised because the sheet carries a small number of authored
 * spelling variants (see AUTHORED_SPELLING_VARIANTS).
 */
function parseMuscleCell(cell: string): string[] {
  return cell
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '' && part !== '—')
    .map((part) => part.toLowerCase());
}

const mismatches: string[] = [];
for (const row of sheetRows) {
  const entry = byExercise.get(row.Exercise);
  if (!entry) {
    mismatches.push(`${row.Exercise}: absent from the module`);
    continue;
  }
  if (entry.pool !== row.Pool) {
    mismatches.push(`${row.Exercise} · pool: sheet ${row.Pool} vs code ${entry.pool}`);
  }
  const sheetPrimary = parseMuscleCell(row['Primary Muscle Group(s)']);
  const codePrimary = entry.primary.map((muscle) => muscle.toLowerCase());
  if (sheetPrimary.join('|') !== codePrimary.join('|')) {
    mismatches.push(
      `${row.Exercise} · primary: sheet [${sheetPrimary.join(', ')}] vs code [${codePrimary.join(', ')}]`,
    );
  }
  const sheetSecondary = parseMuscleCell(row['Secondary Muscle Group(s)']);
  const codeSecondary = entry.secondary.map((muscle) => muscle.toLowerCase());
  if (sheetSecondary.join('|') !== codeSecondary.join('|')) {
    mismatches.push(
      `${row.Exercise} · secondary: sheet [${sheetSecondary.join(', ')}] vs code [${codeSecondary.join(', ')}]`,
    );
  }
  const authoredGate = row['Experience Level'].trim().toLowerCase();
  if (EXPERIENCE_GATE_SOURCE_TEXT[entry.experienceGate].toLowerCase() !== authoredGate) {
    mismatches.push(
      `${row.Exercise} · gate: sheet "${authoredGate}" vs code ${entry.experienceGate}`,
    );
  }
  if (entry.note !== row.Notes) {
    mismatches.push(`${row.Exercise} · note drifted`);
  }
}

ok(
  'every authored field ships verbatim',
  mismatches.length === 0,
  mismatches.slice(0, 6).join('\n      '),
);

const sheetNames = new Set(sheetRows.map((row) => row.Exercise));
const invented = EXERCISE_MUSCLE_METADATA.filter((entry) => !sheetNames.has(entry.exercise));
ok(
  'the module invents no exercise Sam did not author',
  invented.length === 0,
  invented.map((entry) => entry.exercise).join(', '),
);

const sheetPools = [...new Set(sheetRows.map((row) => row.Pool))];
ok(
  'every authored pool is recorded exactly once',
  MUSCLE_METADATA_POOLS.length === sheetPools.length
    && MUSCLE_METADATA_POOLS.every((pool) => sheetPools.includes(pool)),
  `sheet [${sheetPools.join(', ')}] vs code [${MUSCLE_METADATA_POOLS.join(', ')}]`,
);

ok(
  'every entry sits in a recorded pool',
  EXERCISE_MUSCLE_METADATA.every((entry) => MUSCLE_METADATA_POOLS.includes(entry.pool)),
);

ok('the lookup resolves an authored exercise', muscleMetadataFor('Back Squat')?.pool === 'Lower squat');
ok('the lookup returns null for an unknown name', muscleMetadataFor('Sled Push') === null);
ok(
  'hamstring prehab uses the one Lower prehab pool',
  ['SL 45° Back Extension Hold', 'Swiss Ball Hamstring Curl']
    .every((name) => muscleMetadataFor(name)?.pool === 'Lower prehab')
    && !MUSCLE_METADATA_POOLS.includes('Hamstring (light)'),
);
const vocabularyGroups = selectableVocabularyGroups();
const lowerPrehabGroup = vocabularyGroups.find((group) => group.id === 'lower_prehab');
ok(
  'the selectable catalogue shows both exercises under Lower prehab only',
  ['SL 45° Back Extension Hold', 'Swiss Ball Hamstring Curl']
    .every((name) => lowerPrehabGroup?.names.includes(name))
    && !vocabularyGroups.some((group) => group.label === 'Hamstring (light)'),
);

/* ── Muscle vocabulary ── */

console.log('\n[3] MUSCLE VOCABULARY — Midline terminology, no untyped group');

const authoredMuscles = new Set<string>();
for (const row of sheetRows) {
  for (const column of ['Primary Muscle Group(s)', 'Secondary Muscle Group(s)'] as const) {
    for (const muscle of parseMuscleCell(row[column])) authoredMuscles.add(muscle);
  }
}

ok(
  'every authored muscle group is a typed group',
  [...authoredMuscles].every((muscle) =>
    MUSCLE_GROUPS.some((group) => group.toLowerCase() === muscle),
  ),
  [...authoredMuscles]
    .filter((muscle) => !MUSCLE_GROUPS.some((group) => group.toLowerCase() === muscle))
    .join(', '),
);

ok(
  'no typed group is unused by the sheet',
  MUSCLE_GROUPS.every((group) => authoredMuscles.has(group.toLowerCase())),
  MUSCLE_GROUPS.filter((group) => !authoredMuscles.has(group.toLowerCase())).join(', '),
);

ok(
  'Midline is the trunk vocabulary — "Core" and "Trunk" are retired',
  MUSCLE_GROUPS.includes('Midline' as MuscleGroup) &&
    !MUSCLE_GROUPS.some((group) => /^(core|trunk)$/i.test(group)),
);

// The type system already makes "—" unrepresentable as a MuscleGroup, so
// asserting that is a tautology the compiler rejects. The real risk is the
// placeholder surviving the PARSE and being counted as a muscle, so check the
// observable consequence: a row the sheet marks "—" must ship no secondary tags.
const emDashRows = sheetRows.filter((row) => row['Secondary Muscle Group(s)'].trim() === '—');

ok(
  'the em-dash placeholder appears in the sheet (the check below is live)',
  emDashRows.length > 0,
  'no row uses "—" — has the sheet changed its placeholder?',
);

ok(
  'a row marked "—" ships no secondary muscle groups',
  emDashRows.every((row) => (byExercise.get(row.Exercise)?.secondary.length ?? -1) === 0),
  emDashRows
    .filter((row) => (byExercise.get(row.Exercise)?.secondary.length ?? -1) !== 0)
    .map((row) => row.Exercise)
    .join(', '),
);

/* ── Experience gates ── */

console.log('\n[4] EXPERIENCE — five authored gates on the one ladder');

ok('exactly five experience gates exist', EXPERIENCE_GATES.length === 5,
  `found ${EXPERIENCE_GATES.length}`);

// The sheet's own legend row declares the five permitted values. Parsed rather
// than restated so a Sam edit to the legend is caught.
const legend = readSheetRecords(SHEET, SHEET_TAB, 1)
  .map((record) => Object.values(record).join(' '))
  .find((text) => text.includes('EXPERIENCE VALUES'));

ok('the sheet still declares its five experience values', legend !== undefined);

if (legend) {
  const missingFromLegend = EXPERIENCE_GATES.filter(
    (gate) => !legend.toLowerCase().includes(EXPERIENCE_GATE_SOURCE_TEXT[gate].toLowerCase()),
  );
  ok(
    "every typed gate appears in the sheet's own legend",
    missingFromLegend.length === 0,
    missingFromLegend.join(', '),
  );
}

const gateCounts = new Map<ExperienceGate, number>();
for (const entry of EXERCISE_MUSCLE_METADATA) {
  gateCounts.set(entry.experienceGate, (gateCounts.get(entry.experienceGate) ?? 0) + 1);
}

// Counts from the authored sheet after Sam's 2026-07-27 reconciliation:
// Single-Arm Pulldown added as `everyone` (130 -> 131) and MetCon deleted, which
// was a `1+ years` row (33 -> 32). Total unchanged at 193.
//
// Sam's 2026-07-28 mobility additions — Butterfly Stretch, Pissing Dog Against
// Wall, Jefferson Curl — are all `everyone` and not regressions (131 -> 134).
// Total 193 -> 196.
//
// Dumbbell Pullovers followed the same day, also `everyone` and not a
// regression (134 -> 135). Total 196 -> 197.
//
// Scap Pull Ups closed the same day — the first of these into a PREHAB pool
// (Shoulder health, beside its Scap Push-Up sibling) rather than Mobility.
// Also `everyone` and not a regression (135 -> 136). Total 197 -> 198.
//
// 2km Time Trial (Stage C / D14, 2026-07-29) is the first CONDITIONING row
// added since the reconciliation. Sam ruled it a TEST rather than a dose, so it
// takes no conditioning-templates row — but it still needs its sheet row, since
// that is the enforced source for the cue and the muscle/experience gate.
// `everyone` and not a regression (136 -> 137). Total 198 -> 199.
// Then 137 -> 136 and 199 -> 198 on 2026-08-21 with the Light Skipping deletion.
// The eleven-exercise intake adds Horse Stance Hold as `everyone` (141 -> 142).
// The 2026-09-01 identity merge removes the duplicate one-arm pulldown row
// while preserving it as a read alias, so the canonical count returns to 141.
// R-316 then merges the 1+ years barbell Seated Good Morning row into the
// everyone canonical identity; the detailed variant gate lives beside the
// selected implement, so one_plus_years loses one row without everyone gaining
// a duplicate identity.
// Bench Thoracic Extension is one new everyone identity (141 -> 142).
// Sleeper Stretch is one new everyone identity (142 -> 143).
// Foam Roller Thoracic Extension is one new everyone identity (143 -> 144).
// Band-Assisted Pull-Up is one new everyone-regression identity (11 -> 12).
// Incline Push-Up is one new everyone-regression identity (12 -> 13).
// Single-Leg Hop and Stick is one new two-plus-years identity (17 -> 18).
const AUTHORED_GATE_COUNTS: Readonly<Record<ExperienceGate, number>> = {
  everyone: 144,
  everyone_regression: 13,
  one_plus_years: 37,
  two_plus_years: 18,
  advanced_only: 2,
};

for (const [gate, expected] of Object.entries(AUTHORED_GATE_COUNTS)) {
  ok(
    `${gate} gates ${expected} exercise(s)`,
    gateCounts.get(gate as ExperienceGate) === expected,
    `found ${gateCounts.get(gate as ExperienceGate) ?? 0}`,
  );
}

ok(
  'the one ladder is new -> developing -> consistent -> advanced',
  EXPERIENCE_LADDER.join(' -> ') === 'new -> developing -> consistent -> advanced',
  EXPERIENCE_LADDER.join(' -> '),
);

ok(
  'the regression convention is auto-programmed for new athletes only',
  REGRESSION_CONVENTION.autoProgrammedFor.join(',') === 'new' &&
    REGRESSION_CONVENTION.reachableByOthersVia.length === 3,
);

ok(
  'the regression gate binds to the authored rows',
  EXERCISE_MUSCLE_METADATA.filter((entry) => entry.experienceGate === 'everyone_regression')
    .length === 13,
);

// Sam corrected these in the workbook (2026-07-27) rather than leaving them
// normalised on read. Assert the corrections actually landed in the SHEET, so
// the record cannot decay back into a tolerated-variants list.
ok(
  'the corrected spelling variants are recorded',
  CORRECTED_SPELLING_VARIANTS.length === 3 &&
    CORRECTED_SPELLING_VARIANTS.every((v) => v.was !== '' && v.now !== '' && v.where !== ''),
);

ok(
  'no capitalised "Everyone" remains in the sheet',
  !sheetRows.some((row) => row['Experience Level'] === 'Everyone'),
  sheetRows.filter((row) => row['Experience Level'] === 'Everyone').map((r) => r.Exercise).join(', '),
);

ok(
  'no lowercase "midline" remains in the sheet',
  !sheetRows.some((row) =>
    ['Primary Muscle Group(s)', 'Secondary Muscle Group(s)'].some((column) =>
      /\bmidline\b/.test(row[column]),
    ),
  ),
);

ok(
  "the sheet's own change-log row records Sam's reconciliation",
  (() => {
    const preamble = readSheetRecords(SHEET, SHEET_TAB, 1)
      .map((record) => Object.values(record).join(' '))
      .join('\n');
    return /CHANGE LOG — Sam 2026-07-27/.test(preamble);
  })(),
);

ok(
  'MetCon is gone from the sheet (conditioning ruling 20 wins)',
  !sheetRows.some((row) => row.Exercise === 'MetCon'),
);

ok(
  'Single-Arm Lat Pulldown owns the one merged authored row',
  (() => {
    const entry = muscleMetadataFor('Single-Arm Lat Pulldown');
    return (
      entry !== null &&
      entry.pool === 'Upper pull vertical' &&
      entry.primary.join(',') === 'Lats' &&
      entry.secondary.join(',') === 'Biceps,Upper back,Midline' &&
      entry.experienceGate === 'everyone'
    );
  })(),
  JSON.stringify(muscleMetadataFor('Single-Arm Lat Pulldown')),
);
ok('the retired spelling is absent from current sheet/code but resolves at legacy ingress',
  !sheetRows.some((row) => row.Exercise === 'Single-Arm Pulldown')
    && !EXERCISE_MUSCLE_METADATA.some((entry) => entry.exercise === 'Single-Arm Pulldown')
    && resolveExerciseName('Single-Arm Pulldown') === 'Single-Arm Lat Pulldown');
ok('Seated Good Morning owns one authored row and the retired barbell name is ingress only',
  sheetRows.filter((row) => row.Exercise === 'Seated Good Morning').length === 1
    && !sheetRows.some((row) => row.Exercise === 'Seated Good Morning (Barbell)')
    && !EXERCISE_MUSCLE_METADATA.some((entry) =>
      entry.exercise === 'Seated Good Morning (Barbell)')
    && resolveExerciseName('Seated Good Morning (Barbell)') === 'Seated Good Morning');

/* ── The experience crosswalk ── */

console.log('\n[4b] CROSSWALK — Sam\'s single authored bridge between the three vocabularies');

const bible = fs.readFileSync(path.join(repoRoot, 'docs/LFA_PROGRAMMING_BIBLE.md'), 'utf8');

ok(
  'the crosswalk is authored law in the Bible',
  bible.includes('THE EXPERIENCE CROSSWALK (Sam, 2026-07-27)'),
);

ok(
  'the Bible states the crosswalk is the only mapping',
  /No other crosswalk may exist/.test(bible),
);

ok(
  'all four onboarding answers are bridged',
  EXPERIENCE_CROSSWALK.length === 4,
  `found ${EXPERIENCE_CROSSWALK.length}`,
);

/** Sam's authored table, row for row. */
const AUTHORED_CROSSWALK: ReadonlyArray<
  readonly [string, TrainingAgeLevel, readonly ExperienceGate[]]
> = [
  ['Complete beginner', 'new', ['everyone', 'everyone_regression']],
  ['1-2 years', 'developing', ['everyone', 'one_plus_years']],
  ['2-5 years', 'consistent', ['everyone', 'one_plus_years', 'two_plus_years']],
  ['5+ years', 'advanced', ['everyone', 'one_plus_years', 'two_plus_years', 'advanced_only']],
];

for (const [answer, level, gates] of AUTHORED_CROSSWALK) {
  const row = EXPERIENCE_CROSSWALK.find((candidate) => candidate.onboardingAnswer === answer);
  if (!row) {
    ok(`"${answer}" is bridged`, false);
    continue;
  }
  ok(`"${answer}" maps to ${level}`, row.ladderLevel === level, `found ${row.ladderLevel}`);
  ok(
    `"${answer}" sees ${gates.join(' + ')}`,
    row.visibleGates.slice().sort().join(',') === gates.slice().sort().join(','),
    `found ${row.visibleGates.join(', ')}`,
  );
  // The Bible's own table row must still say this, so an edit there fails here.
  ok(
    `"${answer}" still reads that way in the Bible`,
    bible.includes(`| ${answer} | ${level} |`),
  );
}

ok(
  'BOUNDARY 1 — regressions are visible to complete beginners ONLY',
  EXPERIENCE_CROSSWALK.filter((row) => row.visibleGates.includes('everyone_regression')).map(
    (row) => row.onboardingAnswer,
  ).join(',') === 'Complete beginner',
  EXPERIENCE_CROSSWALK.filter((row) => row.visibleGates.includes('everyone_regression'))
    .map((row) => row.onboardingAnswer)
    .join(','),
);

ok(
  'BOUNDARY 1 — a "1-2 years" athlete never sees a regression',
  !(
    EXPERIENCE_CROSSWALK.find((row) => row.onboardingAnswer === '1-2 years')?.visibleGates.includes(
      'everyone_regression',
    ) ?? true
  ),
);

ok(
  'BOUNDARY 1 — advanced sees everything EXCEPT regressions',
  (() => {
    const advanced = EXPERIENCE_CROSSWALK.find((row) => row.ladderLevel === 'advanced');
    if (!advanced) return false;
    const expected = EXPERIENCE_GATES.filter((gate) => gate !== 'everyone_regression');
    return (
      advanced.visibleGates.slice().sort().join(',') === expected.slice().sort().join(',')
    );
  })(),
);

ok(
  'BOUNDARY 2 — "2+ years" includes the "2-5 years" answer',
  EXPERIENCE_CROSSWALK.find(
    (row) => row.onboardingAnswer === '2-5 years',
  )?.visibleGates.includes('two_plus_years') === true,
);

ok(
  'both boundary rulings are recorded as law in the Bible',
  /Regressions are visible to complete beginners ONLY/.test(bible) &&
    /"2\+ years" includes the "2-5 years" onboarding answer/.test(bible),
);

ok(
  'the crosswalk covers every onboarding answer the app can produce',
  ONBOARDING_EXPERIENCE_ANSWERS.every((answer) =>
    EXPERIENCE_CROSSWALK.some((row) => row.onboardingAnswer === answer),
  ),
  ONBOARDING_EXPERIENCE_ANSWERS.filter(
    (answer) => !EXPERIENCE_CROSSWALK.some((row) => row.onboardingAnswer === answer),
  ).join(', '),
);

ok(
  'every ladder level is reachable from some onboarding answer',
  EXPERIENCE_LADDER.every((level) =>
    EXPERIENCE_CROSSWALK.some((row) => row.ladderLevel === level),
  ),
);

ok(
  'the resolver agrees with the table for every answer',
  EXPERIENCE_CROSSWALK.every(
    (row) =>
      visibleGatesForOnboardingAnswer(row.onboardingAnswer).slice().sort().join(',') ===
      row.visibleGates.slice().sort().join(','),
  ),
);

ok(
  'the resolver admits an authored exercise at the right level',
  visibleGatesForOnboardingAnswer('Complete beginner').includes('everyone_regression') &&
    !visibleGatesForOnboardingAnswer('5+ years').includes('everyone_regression') &&
    visibleGatesForOnboardingAnswer('2-5 years').includes('two_plus_years') &&
    !visibleGatesForOnboardingAnswer('1-2 years').includes('two_plus_years'),
);

// A gate no answer can ever see would silently orphan every exercise carrying
// it — the failure mode this catches.
ok(
  'no authored gate is unreachable by every athlete',
  EXPERIENCE_GATES.every((gate) =>
    EXPERIENCE_CROSSWALK.some((row) => row.visibleGates.includes(gate)),
  ),
  EXPERIENCE_GATES.filter(
    (gate) => !EXPERIENCE_CROSSWALK.some((row) => row.visibleGates.includes(gate)),
  ).join(', '),
);

/* ── One crosswalk, one ladder ── */

console.log('\n[4c] SINGLE OWNER — "No other crosswalk may exist"');

// resolveTrainingAgePolicy has mapped onboarding answers to ladder levels since
// long before the crosswalk was authored, and it agreed with Sam's table. Two
// agreeing copies are still two copies: the Bible law forbids the second, so the
// policy must DERIVE its level rather than restate the mapping.
for (const answer of ONBOARDING_EXPERIENCE_ANSWERS) {
  ok(
    `resolveTrainingAgePolicy('${answer}') derives its level from the crosswalk`,
    resolveTrainingAgePolicy(answer).level === ladderLevelForOnboardingAnswer(answer),
    `policy says ${resolveTrainingAgePolicy(answer).level}, crosswalk says ${ladderLevelForOnboardingAnswer(answer)}`,
  );
}

// Shipped behaviour that must NOT change: an athlete with no recorded answer is
// treated as `consistent`. The crosswalk resolver throws on an unmapped answer,
// so the default has to stay explicit at this boundary.
ok(
  'a missing experience level still resolves to consistent',
  resolveTrainingAgePolicy(null).level === 'consistent' &&
    resolveTrainingAgePolicy(undefined).level === 'consistent',
  `null -> ${resolveTrainingAgePolicy(null).level}, undefined -> ${resolveTrainingAgePolicy(undefined).level}`,
);

// Discriminates on an AUTHORED §11 dose value. `maxCoreSessions` used to serve
// here, but Sam abolished every beginner-only structural limit (2026-07-27), so
// structural fields no longer distinguish the two bodies — by design.
ok(
  'the beginner policy body still rides on the new level',
  resolveTrainingAgePolicy('Complete beginner').initialLoadMultiplier === 0.5 &&
    resolveTrainingAgePolicy('2-5 years').initialLoadMultiplier === 1 &&
    Object.keys(resolveTrainingAgePolicy('Complete beginner').exercisePriority).length > 0 &&
    Object.keys(resolveTrainingAgePolicy('2-5 years').exercisePriority).length === 0,
);

// Structural: the second crosswalk is GONE, not merely in agreement. A switch on
// onboarding literals inside the policy is exactly the duplicate representation
// Section 11 forbids, and an agreeing copy is the kind that rots silently.
const policySource = fs.readFileSync(
  path.join(repoRoot, 'src/rules/trainingAgePolicy.ts'),
  'utf8',
);

const onboardingLiteralsInPolicy = ONBOARDING_EXPERIENCE_ANSWERS.filter((answer) =>
  policySource.includes(`'${answer}'`),
);

ok(
  'trainingAgePolicy no longer maps onboarding answers itself',
  onboardingLiteralsInPolicy.length === 0,
  `still switches on: ${onboardingLiteralsInPolicy.join(', ')}`,
);

ok(
  'the ladder has ONE type — the crosswalk reuses TrainingAgeLevel',
  EXPERIENCE_LADDER.join(',') === TRAINING_AGE_LEVELS.join(','),
  `crosswalk [${EXPERIENCE_LADDER.join(', ')}] vs policy [${TRAINING_AGE_LEVELS.join(', ')}]`,
);

/* ── Vocabulary reconciliation ── */

console.log('\n[5] RECONCILIATION — metadata against the selectable vocabulary');

const selectable = new Set(selectableExerciseNames());
const metadataNames = new Set(EXERCISE_MUSCLE_METADATA.map((entry) => entry.exercise));

// ASKED OF THE OWNER, NOT OF ONE ARRAY (2026-08-05). Two signed sheets now
// carry authored metadata — this workbook for lifts, Sam's conditioning
// workbook for the 53 templates — and `muscleMetadataFor` is the one place
// that answers "is this exercise covered". Re-implementing the lookup against
// `EXERCISE_MUSCLE_METADATA` alone would give this suite a different answer
// from the app's, which is the two-answers defect the owner exists to remove.
// The cells below that ask about THIS sheet's own rows still read the array.
const unlistedGaps = [...selectable].filter((name) => !muscleMetadataFor(name));
ok(
  'every selectable exercise without metadata is a recorded gap',
  unlistedGaps.every((name) => SELECTABLE_WITHOUT_METADATA.includes(name)),
  unlistedGaps.filter((name) => !SELECTABLE_WITHOUT_METADATA.includes(name)).join(', '),
);

ok(
  'no recorded gap has quietly been closed',
  SELECTABLE_WITHOUT_METADATA.every((name) => !metadataNames.has(name)),
  SELECTABLE_WITHOUT_METADATA.filter((name) => metadataNames.has(name)).join(', '),
);

const notSelectable = [...metadataNames].filter((name) => !selectable.has(name));
ok(
  'every metadata entry that is not yet selectable is recorded',
  notSelectable.every((name) =>
    METADATA_WITHOUT_SELECTABLE_EXERCISE.some((record) => record.exercise === name),
  ),
  notSelectable
    .filter(
      (name) => !METADATA_WITHOUT_SELECTABLE_EXERCISE.some((record) => record.exercise === name),
    )
    .join(', '),
);

ok(
  'every not-yet-selectable entry names why',
  METADATA_WITHOUT_SELECTABLE_EXERCISE.every((record) => record.reason.trim() !== ''),
);

/* ── D17 flow menus ── */

console.log('\n[6] D17 FLOW — Sam\'s authored menus, counts and dosing');

const designDoc = fs.readFileSync(DESIGN_DOC, 'utf8');
const d17 = /### D17 —[\s\S]*?(?=\n### )/.exec(designDoc);

ok('the D17 section is still in the design doc', d17 !== null);
const d17Text = d17 ? d17[0] : '';

ok('D17 is still marked AUTHORED', /AUTHORED/.test(d17Text));

ok(
  'all five day-type menus are encoded',
  SESSION_FLOW_MENUS.length === 5,
  `found ${SESSION_FLOW_MENUS.length}: ${SESSION_FLOW_MENUS.map((menu) => menu.dayType).join(', ')}`,
);

/** Sam's authored counts, keyed by day type. Every count is law. */
const AUTHORED_MENUS: ReadonlyArray<readonly [FlowDayType, Readonly<Record<string, number>>]> = [
  ['lower_general', { hip_mobility: 2, hip_prehab: 2 }],
  ['lower_squat', { hip_mobility: 2, hip_prehab: 1, knee_prehab: 1 }],
  [
    'lower_hinge',
    { hip_mobility: 1, hamstring_or_low_back_mobility: 1, hip_prehab: 1, hamstring_prehab: 1 },
  ],
  ['upper', { shoulder_mobility: 1, upper_body_mobility: 1, shoulder_prehab: 2 }],
  ['full_body', { hip_mobility: 1, shoulder_mobility: 1, hip_prehab: 1, shoulder_prehab: 1 }],
];

for (const [dayType, expected] of AUTHORED_MENUS) {
  const menu = SESSION_FLOW_MENUS.find((candidate) => candidate.dayType === dayType);
  if (!menu) {
    ok(`${dayType} menu exists`, false);
    continue;
  }
  const actual: Record<string, number> = {};
  for (const slot of menu.slots) actual[slot.category] = slot.count;
  ok(
    `${dayType} = ${Object.entries(expected).map(([k, v]) => `${v} ${k}`).join(' + ')}`,
    JSON.stringify(actual) === JSON.stringify(expected),
    `found ${JSON.stringify(actual)}`,
  );
}

ok(
  'total flow items per day is 4 on every menu',
  SESSION_FLOW_MENUS.every(
    (menu) => menu.slots.reduce((sum, slot) => sum + slot.count, 0) === 4,
  ),
  SESSION_FLOW_MENUS.map(
    (menu) => `${menu.dayType}=${menu.slots.reduce((sum, slot) => sum + slot.count, 0)}`,
  ).join(', '),
);

ok(
  'resolution order is hinge > squat > general lower',
  FLOW_RESOLUTION_ORDER.join(' > ') === 'lower_hinge > lower_squat > lower_general',
  FLOW_RESOLUTION_ORDER.join(' > '),
);

ok(
  'mobility dosing is 2 sets x 30-60 sec',
  FLOW_DOSING.mobility.sets === 2 &&
    FLOW_DOSING.mobility.secondsLow === 30 &&
    FLOW_DOSING.mobility.secondsHigh === 60,
);

ok(
  'prehab dosing is 2 sets x 10-20 reps',
  FLOW_DOSING.prehab.sets === 2 &&
    FLOW_DOSING.prehab.repsLow === 10 &&
    FLOW_DOSING.prehab.repsHigh === 20,
);

ok('a curated dose overrides the universal flow dose', FLOW_DOSING.curatedDoseWins === true);

ok(
  'the dosing numbers still match the authored D17 text',
  /2 sets ×\s*\n?\s*30–60 sec/.test(d17Text) && /2 sets ×\s*\n?\s*10–20 reps/.test(d17Text),
);

ok('the flow is never load-bearing (D13)', FLOW_IS_NEVER_LOAD_BEARING === true);

ok(
  'conditioning-only and recovery days have no flow',
  DAY_KINDS_WITHOUT_FLOW.slice().sort().join(',') === 'conditioning_only,recovery',
  DAY_KINDS_WITHOUT_FLOW.join(','),
);

ok(
  'every menu category has a muscle-metadata mapping',
  SESSION_FLOW_MENUS.every((menu) =>
    menu.slots.every((slot) => slot.category in FLOW_CATEGORY_MUSCLE_MAPPING),
  ),
);

ok(
  'every category mapping names at least one metadata pool or muscle group',
  Object.values(FLOW_CATEGORY_MUSCLE_MAPPING).every(
    (mapping) => mapping.pools.length > 0 || mapping.muscleGroups.length > 0,
  ),
);

ok(
  'every mapped pool is a real authored pool',
  Object.values(FLOW_CATEGORY_MUSCLE_MAPPING).every((mapping) =>
    mapping.pools.every((pool) => MUSCLE_METADATA_POOLS.includes(pool)),
  ),
  Object.entries(FLOW_CATEGORY_MUSCLE_MAPPING)
    .flatMap(([category, mapping]) =>
      mapping.pools
        .filter((pool) => !MUSCLE_METADATA_POOLS.includes(pool))
        .map((pool) => `${category} -> ${pool}`),
    )
    .join(', '),
);

ok(
  'every mapped muscle group is a typed group',
  Object.values(FLOW_CATEGORY_MUSCLE_MAPPING).every((mapping) =>
    mapping.muscleGroups.every((muscle) => MUSCLE_GROUPS.includes(muscle)),
  ),
);

/* ── Result ── */

console.log(
  `\nMuscle + experience equality: passed=${passed}/${passed + failures.length} failures=${failures.length}`,
);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
