/**
 * THE 77 ARE RULED — ratios, equipment lattices, and the two structural rulings.
 *
 * Sam ruled every load ratio on 2026-07-28. This suite holds the shipped code
 * to that ruling, and holds two rulings that are structure rather than values:
 *
 * 1. THE FLOOR-OUT FOUR ARE A TYPED AUTHORITY. Sam: *"these prescribe the
 *    equipment minimum by default"*. They must NOT be ratios that happen to
 *    floor out. A ratio whose computed value never reaches the athlete is a
 *    decision-shaped object that decides nothing — precisely the defect class
 *    this unit exists to kill, and the reason `LOAD_RULING_PENDING` sitting
 *    empty could read as "everything is ruled" for so long.
 *
 * 2. THE SPELLING TWINS COLLAPSE TO ONE. `Chest Supported DB Row` and
 *    `Chest-Supported DB Row` were two keys in the load map for one movement.
 *    Two keys mean two ratios, and nothing stops them diverging.
 *
 * And one law with teeth in both directions: the equipment lattice bounds the
 * ESTIMATE only. An athlete's own entered weight is never rounded, snapped or
 * corrected — the same law as render-truth, where the app may not substitute
 * its own claim for the athlete's.
 *
 * Run: npm run test:load-ratio-rulings
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import fs from 'fs';
import path from 'path';

import {
  EQUIPMENT,
  EQUIPMENT_LATTICE_RULING,
  MINIMUMS_PENDING,
  prescribableWeight,
  roundDownToLattice,
} from '../data/equipmentLattice';
import {
  EQUIPMENT_MINIMUM_PRESCRIPTIONS,
  EXERCISE_LOAD_MAP,
  resolveExerciseName,
  resolveLoadAuthority,
} from '../utils/loadEstimation';
import { canonicalExerciseName } from '../utils/exerciseCanonicalisation';
import { readSheetRecords } from './support/xlsxReader';

const repoRoot = path.resolve(__dirname, '../..');

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

function okEmpty(name: string, offenders: readonly string[], detail?: string): void {
  ok(name, offenders.length === 0,
    `${detail ? `${detail}\n      ` : ''}${[...offenders].sort().slice(0, 30).join('\n      ')}`);
}

/* ══ Sam's ruling, transcribed once ══ */

const RULED_RATIOS: Record<string, number> = {
  // suspicious tab
  'Deadlift': 0.75, 'Leg Press': 1.0, 'Farmer Carry': 0.4, 'Suitcase Carry': 0.4,
  // plausible tab
  'Back Squat': 0.8, 'Bench Press': 0.8, 'Box Squat': 0.9, 'Bulgarian Split Squats': 0.2,
  'Cable Face Pull': 0.2, 'Chest Supported Row': 0.3, 'Chest-Supported DB Row': 0.2,
  'Concentration Curl': 0.1, 'DB Bench Press': 0.3, 'DB Shoulder Press': 0.2,
  'Dumbbell Kickback': 0.1, 'Dumbbell Skull Crusher': 0.15, 'Face Pull': 0.2,
  'Front Squat': 0.5, 'Half-Kneeling Single-Arm Overhead Press': 0.2, 'Hammer Curl': 0.15,
  'Incline Bench': 0.7, 'Incline DB Bench': 0.3, 'Lateral Raise': 0.1,
  'Neutral-Grip Pulldown': 0.5, 'Overhead Press': 0.6, 'Rear Delt Fly': 0.1,
  'Seated DB Press': 0.2, 'Single-Arm DB Bench Press': 0.3, 'Single-Arm DB Row': 0.3,
  'Single-Arm Shrug': 0.2, 'Single-Leg Squat (to Box)': 0.15, 'Skull Crushers': 0.2,
  'Woodchop (Standing)': 0.15,
  // derived, Sam's explicit ruling: High Box = 1.2 x Box Squat
  'High Box Squat': 1.08,
};

/** The four Sam moved off ratios entirely. */
const EQUIPMENT_MINIMUM_FOUR = [
  'Bicep Curl (Barbell)', 'Bottoms-Up KB Press',
  'Explosive Landmine Press', 'Incline Y Raise',
];

console.log('\n[1] Every ruled ratio ships exactly');
{
  const wrong: string[] = [];
  for (const [name, ratio] of Object.entries(RULED_RATIOS)) {
    const entry = EXERCISE_LOAD_MAP[name];
    if (!entry) { wrong.push(`${name}: MISSING from EXERCISE_LOAD_MAP`); continue; }
    if (entry.ratio !== ratio) wrong.push(`${name}: ruled ${ratio}, shipped ${entry.ratio}`);
  }
  okEmpty('every ruled ratio matches the shipped value', wrong);

  // The derivation Sam stated, asserted as a RELATIONSHIP rather than as two
  // independent numbers — if Box Squat ever moves, this fails until High Box
  // follows it.
  ok('High Box Squat is 1.2 x Box Squat (Sam, 2026-07-25 relationship kept)',
    Math.abs(EXERCISE_LOAD_MAP['High Box Squat'].ratio
      - EXERCISE_LOAD_MAP['Box Squat'].ratio * 1.2) < 1e-9,
    `box=${EXERCISE_LOAD_MAP['Box Squat'].ratio} `
    + `highbox=${EXERCISE_LOAD_MAP['High Box Squat'].ratio}`);
}

console.log('\n[2] THE FLOOR-OUT FOUR are a typed authority, not ratios');
{
  okEmpty('none of the four is still a ratio in EXERCISE_LOAD_MAP',
    EQUIPMENT_MINIMUM_FOUR.filter((n) => Boolean(EXERCISE_LOAD_MAP[n])),
    'a ratio whose value never reaches the athlete is a decision that decides nothing');

  okEmpty('each of the four resolves as an equipment-minimum prescription',
    EQUIPMENT_MINIMUM_FOUR.filter((n) => resolveLoadAuthority(n).kind !== 'equipment_minimum'),
    'they must carry their own authority kind');

  // Sam named two of the numbers explicitly.
  ok('the barbell curl prescribes 20 kg', EQUIPMENT.barbell.minimumKg === 20);
  ok('the bottoms-up KB press prescribes 8 kg', EQUIPMENT.kettlebell.minimumKg === 8);

  okEmpty('every equipment-minimum exercise names its equipment',
    Object.entries(EQUIPMENT_MINIMUM_PRESCRIPTIONS)
      .filter(([, eq]) => !EQUIPMENT[eq as keyof typeof EQUIPMENT])
      .map(([n]) => n));
}

console.log('\n[3] THE TWINS collapse to one exercise');
{
  ok('only the curated spelling is a load-map key',
    !EXERCISE_LOAD_MAP['Chest Supported DB Row']
    && Boolean(EXERCISE_LOAD_MAP['Chest-Supported DB Row']));

  ok('the retired spelling still resolves to the surviving key',
    resolveExerciseName('Chest Supported DB Row') === 'Chest-Supported DB Row',
    `got ${resolveExerciseName('Chest Supported DB Row')}`);

  ok('the retired spelling resolves through the canonicaliser too',
    canonicalExerciseName('Chest Supported DB Row') === 'Chest-Supported DB Row',
    `got ${canonicalExerciseName('Chest Supported DB Row')}`);

  // THE SWEEP, generalised. Two keys that differ only in punctuation or case
  // are one exercise with two ratios waiting to diverge.
  const norm = (n: string): string => n.toLowerCase().replace(/[^a-z0-9]/g, '');
  const byNorm = new Map<string, string[]>();
  for (const key of Object.keys(EXERCISE_LOAD_MAP)) {
    const k = norm(key);
    byNorm.set(k, [...(byNorm.get(k) ?? []), key]);
  }
  okEmpty('no two load-map keys are spelling twins',
    [...byNorm.values()].filter((v) => v.length > 1).map((v) => v.join('  <->  ')));

  // NO DANGLING ALIASES. Collapsing the twin left two aliases pointing at a key
  // that no longer existed, so both spellings silently resolved to nothing —
  // the athlete's stored history under the retired name would have stopped
  // finding a load. Found by hand this time; found by the build from now on.
  const aliasSource = fs.readFileSync(
    path.join(repoRoot, 'src/utils/loadEstimation.ts'), 'utf8');
  const aliasBody = aliasSource.slice(aliasSource.indexOf('const EXERCISE_ALIASES'));
  const aliasPairs = [...aliasBody.slice(0, aliasBody.indexOf('\n};'))
    .matchAll(/'([^']+)':\s*'([^']+)'/g)];
  okEmpty('every alias points at an exercise that still resolves',
    aliasPairs
      .filter(([, , target]) => resolveLoadAuthority(target).kind === 'unauthored')
      .map(([, from, target]) => `${from} -> ${target}`),
    'the alias target was renamed or removed — repoint it, do not delete the alias, '
    + 'or athlete history stored under the old spelling stops resolving');
}

console.log('\n[4] EQUIPMENT LATTICES — always down, to something loadable');
{
  ok('barbell rounds down to 2.5', roundDownToLattice(66.4, 'barbell') === 65);
  ok('cable rounds down to 2.5', roundDownToLattice(34.9, 'cable') === 32.5);
  ok('machine rounds down to 2.5', roundDownToLattice(34.9, 'machine') === 32.5);
  ok('kettlebell rounds down to 4', roundDownToLattice(15.9, 'kettlebell') === 12);

  // The dumbbell lattice is the interesting one: 1 kg steps low down, 2.5 above.
  ok('dumbbell 7.9 -> 7 (1 kg steps below 10)', roundDownToLattice(7.9, 'dumbbell') === 7);
  ok('dumbbell 11.9 -> 10 (no 11 or 12 kg rung)', roundDownToLattice(11.9, 'dumbbell') === 10);
  ok('dumbbell 13.7 -> 12.5 (2.5 kg steps above 10)', roundDownToLattice(13.7, 'dumbbell') === 12.5);
  ok('dumbbell 10 -> 10 exactly', roundDownToLattice(10, 'dumbbell') === 10);

  // Never up. This is the whole ruling in one assertion.
  const roundsUp: string[] = [];
  for (const eq of ['barbell', 'dumbbell', 'cable', 'machine', 'kettlebell'] as const) {
    for (let w = 1; w <= 120; w += 0.1) {
      if (roundDownToLattice(w, eq) > w + 1e-9) roundsUp.push(`${eq} @ ${w.toFixed(1)}`);
    }
  }
  okEmpty('no lattice ever rounds a weight UP', roundsUp.slice(0, 5));

  ok('the minimum still applies after rounding down',
    prescribableWeight(3, 'barbell') === 20, `got ${prescribableWeight(3, 'barbell')}`);
}

console.log('\n[5] ONE OWNER for minimums and increments');
{
  const loadSource = fs.readFileSync(
    path.join(repoRoot, 'src/utils/loadEstimation.ts'), 'utf8');
  const programSource = fs.readFileSync(
    path.join(repoRoot, 'src/data/defaultProgram.ts'), 'utf8');

  ok('loadEstimation no longer defines its own increments',
    !/const ROUND_INCREMENTS/.test(loadSource));
  ok('loadEstimation no longer defines its own minimums',
    !/const MIN_WEIGHTS/.test(loadSource));
  ok('defaultProgram no longer carries a copied minimums table',
    !/MIN_SUBPHASE_LOAD_BY_EQUIPMENT/.test(programSource),
    'this was a byte-identical copy of MIN_WEIGHTS — one fact, three homes');

  // ONE OWNER FOR "WHICH EQUIPMENT". Four modules read
  // `EXERCISE_LOAD_MAP[name]?.equipment` directly, and every one of them treated
  // a missing entry as "no equipment requirement". Moving four exercises off
  // ratios therefore made a barbell curl available to an athlete with no
  // barbell — caught only because a golden differential reordered. Reading the
  // raw map for equipment is now the thing that fails.
  function productFiles(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name === '__tests__') continue; productFiles(p, out); }
      else if (/\.tsx?$/.test(e.name)) out.push(p);
    }
    return out;
  }
  const rawReaders = productFiles(path.join(repoRoot, 'src'))
    .filter((f) => !f.endsWith('utils/loadEstimation.ts'))
    .filter((f) => {
      const code = fs.readFileSync(f, 'utf8')
        .split('\n')
        .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'))
        .join('\n');
      return /EXERCISE_LOAD_MAP\s*\[[^\]]*\]\s*\??\.\s*equipment/.test(code);
    })
    .map((f) => path.relative(repoRoot, f));
  okEmpty('nothing reads equipment off the raw load map', rawReaders,
    'call equipmentClassFor() — a missing map entry is not "no equipment needed"');
}

console.log('\n[6] The lattice bounds the ESTIMATE, never the athlete');
{
  // Sam: "their number is their number". The estimator may only ever offer a
  // loadable weight; the athlete may enter 13.7 kg and keep 13.7 kg.
  const hookSource = fs.readFileSync(
    path.join(repoRoot, 'src/screens/home/useDayWorkout.ts'), 'utf8');
  ok('the display path never snaps a stored or overridden weight',
    !/roundDownToLattice|prescribableWeight|roundToEquipment/.test(hookSource),
    'rounding an athlete\'s own entry substitutes the app\'s number for theirs');
}

console.log('\n[7] PROVENANCE — lattices trace to Sam\'s ruling');
{
  const { ruledOn, where, latticeAnchor, athleteWeightAnchor } = EQUIPMENT_LATTICE_RULING;
  ok('the ruling is dated', /^\d{4}-\d{2}-\d{2}$/.test(ruledOn), ruledOn);

  const doc = fs.readFileSync(path.join(repoRoot, where), 'utf8');
  ok('the lattice anchor appears verbatim in the ruling document',
    doc.includes(latticeAnchor), latticeAnchor.slice(0, 70));
  ok('the athlete-weight anchor appears verbatim in the ruling document',
    doc.includes(athleteWeightAnchor), athleteWeightAnchor.slice(0, 70));

  ok('the anchor states the 2.5 kg step it is cited for',
    /(?<![\d.])2\.5(?![\d])/.test(latticeAnchor));
  ok('the anchor states the 4 kg kettlebell step it is cited for',
    /(?<![\d.])4(?![\d])/.test(latticeAnchor));
}

console.log('\n[8] Unruled minimums are VISIBLE, not blessed by proximity');
{
  // An unruled number inside an authored file reads as authored. Naming them
  // is the difference between a known gap and a silent one.
  console.log(`      (minimums still awaiting a ruling: ${MINIMUMS_PENDING.join(', ') || 'none'})`);
  ok('every pending minimum is genuinely unruled',
    MINIMUMS_PENDING.every((k) => !EQUIPMENT[k].minimumRuled));
  ok('the two Sam named are marked ruled',
    EQUIPMENT.barbell.minimumRuled && EQUIPMENT.kettlebell.minimumRuled);
}

console.log('\n[9] THE PHASE 2 GATE — workbook and code agree, both directions');
{
  // The arrangement that makes the SHEET the source of truth rather than a
  // record of it: Sam edits the workbook, the build fails until the code
  // matches. Same contract as the conditioning templates. One direction alone
  // is not enough — doc→code alone lets code grow entries nobody authored,
  // which is exactly how 29 cues ended up outside the doc their gate reads.
  const SHEET = path.join(repoRoot, 'docs/LOAD_RATIO_REVIEW_2026-07-28.xlsx');
  ok('the authored workbook is present', fs.existsSync(SHEET), SHEET);

  if (fs.existsSync(SHEET)) {
    const sheetRatios = new Map<string, { anchor: string; ratio: number; equipment: string }>();
    for (const record of readSheetRecords(SHEET, '3 Load ratios')) {
      if (!record['Exercise']) continue;
      sheetRatios.set(record['Exercise'], {
        anchor: record['Anchor'],
        ratio: Number(record['Ratio']),
        equipment: record['Equipment'],
      });
    }

    ok('the workbook carries ratios to compare', sheetRatios.size > 60, `${sheetRatios.size}`);

    const mismatched: string[] = [];
    for (const [name, sheet] of sheetRatios) {
      const code = EXERCISE_LOAD_MAP[name];
      if (!code) { mismatched.push(`${name}: in the workbook, absent from the code`); continue; }
      if (code.ratio !== sheet.ratio || code.anchor !== sheet.anchor
        || code.equipment !== sheet.equipment) {
        mismatched.push(
          `${name}: sheet { ${sheet.anchor}, ${sheet.ratio}, ${sheet.equipment} } `
          + `vs code { ${code.anchor}, ${code.ratio}, ${code.equipment} }`);
      }
    }
    okEmpty('every workbook ratio ships exactly (sheet -> code)', mismatched);

    okEmpty('every shipped ratio is in the workbook (code -> sheet)',
      Object.keys(EXERCISE_LOAD_MAP).filter((n) => !sheetRatios.has(n)),
      'a ratio in code that no authored sheet records is unauthored by definition');

    // The equipment-minimum tab, same contract.
    const sheetMinimums = new Set(
      readSheetRecords(SHEET, '4 Equipment minimums')
        .map((r) => r['Exercise']).filter(Boolean));
    okEmpty('the equipment-minimum tab matches the code (both directions)',
      [
        ...[...sheetMinimums].filter((n) => !EQUIPMENT_MINIMUM_PRESCRIPTIONS[n])
          .map((n) => `${n}: in the workbook, not in the code`),
        ...Object.keys(EQUIPMENT_MINIMUM_PRESCRIPTIONS).filter((n) => !sheetMinimums.has(n))
          .map((n) => `${n}: in the code, not in the workbook`),
      ]);
  }
}

const total = passed + failures.length;
console.log(`\nLoad ratio rulings: passed=${passed}/${total} failures=${failures.length}`);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
