/**
 * Power counting differential — Stage 1 of the power-row redesign.
 *
 *   docs/POWER_ROW_OWNERSHIP_REASSESSMENT_2026-07-27.md §7 and its staging table
 *
 * ## What this suite is for
 *
 * Sam's power-row redesign moves power out of `workout.powerBlock` and into
 * `workout.exercises[]` as a typed `role: 'power'` row. That is a counting
 * change disguised as a rendering change: today power's fence — not a hard
 * exposure, not main strength, no conditioning credit, not a finisher — is
 * enforced BY ABSENCE from the list every counter iterates. Put power in the
 * list and the guarantee is gone unless something else re-establishes it.
 *
 * The bar Sam set is byte-equivalence, and the reassessment's own words are
 * that assertions are not enough: "the strongest available proof is a
 * differential test … that converts 'we think the fence survived' into
 * evidence, and it is the only way to cover the counters this sweep did not
 * find."
 *
 * So this suite records every count the production code produces for a fixed
 * scenario matrix into a committed golden, and later stages must reproduce it
 * exactly. It is a RATCHET, not a description: regenerate the golden only when
 * a diff has been read and understood, and never as a way to make a stage pass.
 *
 * ## The one seam
 *
 * `powerCountingDifferential/powerProjection.ts` is the only file here that
 * knows where power is stored. It changes at Stage 3; nothing else does. The
 * snapshot records the projection's OUTPUT, so an identical golden across
 * Stage 2 and Stage 4 means the athlete's power work is unchanged even though
 * its home is not.
 *
 * Run:    npm run test:power-counting
 * Update: npm run test:power-counting -- --update
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(global as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  },
};
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import fs from 'node:fs';
import path from 'node:path';

import type { Workout, WorkoutExercise } from '../types/domain';
import { classifyDaySessions } from '../rules/sessionTaxonomy';
import { countWeeklyExposures } from '../rules/weeklyExposureCounts';
import { POWER_EXERCISE_POOL } from '../rules/powerExercisePool';
import {
  buildCountSnapshot,
  serialiseSnapshot,
  type CountSnapshot,
} from './powerCountingDifferential/buildCountSnapshot';
import { projectPower } from './powerCountingDifferential/powerProjection';

const GOLDEN_PATH = path.join(
  __dirname,
  'powerCountingDifferential',
  'snapshot.golden.json',
);

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

/* ── Build ────────────────────────────────────────────────────────── */

console.log('\nPower counting differential\n');

/**
 * Generation logs a canonicalisation trail per workout. Across eight scenarios
 * and four weeks each that is thousands of lines, and it would bury the one
 * line that matters — the count diff. Silenced around the build only; anything
 * this suite prints itself goes through `ok`, after the mute is lifted.
 */
function quietly<T>(build: () => T): T {
  const real = { log: console.log, info: console.info, warn: console.warn };
  console.log = () => undefined;
  console.info = () => undefined;
  console.warn = () => undefined;
  try {
    return build();
  } finally {
    console.log = real.log;
    console.info = real.info;
    console.warn = real.warn;
  }
}

const snapshot = quietly(buildCountSnapshot);
const serialised = serialiseSnapshot(snapshot);

/* ── 1. The harness reproduces itself ─────────────────────────────── */
//
// The reassessment's Stage 1 gate. A snapshot that is not deterministic proves
// nothing about Stage 2-4 — every later diff would be noise. Generation reaches
// a date-seeded clock and a hash-seeded selector, so this is a real risk and
// not a formality.

const second = serialiseSnapshot(quietly(buildCountSnapshot));
ok(
  'the snapshot is deterministic — two builds are byte-identical',
  second === serialised,
  firstDifference(serialised, second),
);

/* ── 2. The snapshot is not vacuous ───────────────────────────────── */
//
// A harness that recorded nothing would pass every later stage. Pin the floor:
// power must actually appear, on more than one day, and at least one scenario
// must record the §18 selector stripping it — otherwise the keep/strip half of
// the fence is untested and nobody would know.

const allDays = snapshot.scenarios.flatMap((scenario) =>
  scenario.weeks.flatMap((week) => week.days));
const powerDayCount = allDays.filter((day) => day.power !== null).length;
ok(
  'the matrix produces power work to compare',
  powerDayCount >= 5,
  `power appeared on ${powerDayCount} day(s)`,
);

// Generation never over-fills the budget, so the selector's STRIP path only
// runs under the over-budget probe. If that probe ever stops stripping, the
// nine field-delete sites Stage 3 replaces are no longer covered by anything.
const probes = snapshot.scenarios
  .map((scenario) => scenario.overBudgetProbe)
  .filter(Boolean);
ok(
  'the over-budget probe reaches the §18 weekly power strip',
  probes.some((probe) => probe!.powerDaysStripped.length > 0),
  `probes=${probes.length}, stripped=${probes.map((probe) => probe!.powerDaysStripped.length).join(',')}`,
);
ok(
  'the §18 selector never keeps more power days than the budget',
  probes.every((probe) =>
    probe!.budget === null || probe!.powerDaysKept.length <= probe!.budget),
  probes.map((probe) => `budget=${probe!.budget} kept=${probe!.powerDaysKept.length}`).join('; '),
);

const powerNames = new Set(allDays.flatMap((day) =>
  day.power?.items.map((item) => item.exercise) ?? []));
ok(
  'every recorded power exercise is a pool entry',
  [...powerNames].every((name) =>
    POWER_EXERCISE_POOL.some((entry) => entry.name === name)),
  `recorded: ${[...powerNames].sort().join(', ') || '(none)'}`,
);

/* ── 3. The fence, as recorded ────────────────────────────────────── */
//
// Sam named four fence fields and required them byte-equivalent. Recording them
// is not enough on its own — a stage could drop the fence and rewrite the
// golden. Assert the values directly so the fence has a statement of its own
// that no regeneration can quietly satisfy.

// STAGE 3: the fence is measured, not copied. It used to be a stored object on
// the block, which could say `false` while the counters said otherwise. Now it
// is the production choke point's own verdict plus the §18 evidence the row
// carries, so a power row that started earning credit would fail here rather
// than quietly ship with an honest-looking object attached.
const fences = allDays.map((day) => day.power?.fence).filter(Boolean);
ok(
  'every power row is authored role:power and counted by nothing',
  fences.every((fence) =>
    fence!.role === 'power' &&
    fence!.countedByAnything === false &&
    fence!.section18Role === 'power'),
  JSON.stringify(fences.find((fence) =>
    fence!.role !== 'power' || fence!.countedByAnything !== false ||
    fence!.section18Role !== 'power')),
);
// Power is pre-lift work, and its position in the one list is what tells the
// athlete that without any renderer knowing power is special.
ok(
  'every power row leads its session',
  allDays.every((day) => (day.power?.items ?? []).every((item) => item.order === 0)),
  JSON.stringify(allDays.find((day) =>
    (day.power?.items ?? []).some((item) => item.order !== 0))?.power?.items),
);

// A power day must never be the reason a day counts as main strength or as a
// hard exposure. Stated over the recorded taxonomy rather than the fence
// object, because the fence object is documentation and the taxonomy is what
// actually feeds the caps.
const powerOnlyMisclassified = allDays.filter((day) =>
  day.power !== null &&
  day.countedRows.strength === 0 &&
  day.taxonomy.some((unit) =>
    unit.category === 'lower_strength' ||
    unit.category === 'upper_strength' ||
    unit.category === 'full_body_strength'));
ok(
  'power alone never supplies a main-strength classification',
  powerOnlyMisclassified.length === 0,
  powerOnlyMisclassified.map((day) => `${day.name} (day ${day.dayOfWeek})`).join('; '),
);

/* ── 4. The Explosive Push-up trap, stated directly ───────────────── */
//
// The reassessment's most dangerous finding: `Explosive Push-up` is the ONE
// pool entry that matches `MAIN_LIFT_EXERCISE_RX`, and it is also a
// `horizontal_press` exposure. As a row it would hand `hasMainLiftExercises`
// main-lift proof — turning an accessory-named session into `upper_strength`
// and flowing into `mainStrengthExposures`, the 4-session cap and hard-day
// grading. Six of seven entries are harmless; that asymmetry is exactly why it
// would survive most tests and most device passes.
//
// The generation matrix cannot be relied on to produce an upper-power day, so
// the trap is stated here against a hand-built session. Today it passes by
// absence. After Stage 3 it must pass because the choke point role-filters
// BEFORE any name probe runs.

function row(name: string, index: number): WorkoutExercise {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return {
    id: `trap:row:${index}`,
    workoutId: 'trap',
    exerciseId: `${slug}:${index}`,
    exerciseOrder: index,
    prescribedSets: 3,
    prescribedRepsMin: 8,
    prescribedRepsMax: 12,
    restSeconds: 60,
    exercise: {
      id: `${slug}:${index}`,
      name,
      description: name,
      muscleGroups: [],
      exerciseType: 'Isolation',
      equipmentRequired: [],
      difficultyLevel: 'Beginner',
      createdAt: '2026-07-13T00:00:00.000Z',
      updatedAt: '2026-07-13T00:00:00.000Z',
    },
    createdAt: '2026-07-13T00:00:00.000Z',
    updatedAt: '2026-07-13T00:00:00.000Z',
  };
}

/** A gunshow/prehab-named session whose only rows are light arm work. */
function gunshowSession(extraRows: WorkoutExercise[] = []): Workout {
  return {
    id: 'trap',
    microcycleId: 'trap-week',
    dayOfWeek: 3,
    name: 'Gunshow & Prehab',
    description: '',
    intensity: 'Moderate',
    workoutType: 'Strength',
    durationMinutes: 40,
    exercises: [row('Cable Curl', 0), row('Triceps Pushdown', 1), ...extraRows],
    createdAt: '2026-07-13T00:00:00.000Z',
    updatedAt: '2026-07-13T00:00:00.000Z',
  } as unknown as Workout;
}

const withoutPower = gunshowSession();
const withPowerRow: Workout = gunshowSession([{
  ...row('Explosive Push-up', 2),
  exerciseOrder: 0,
  prescribedSets: 3,
  prescribedRepsMin: 3,
  prescribedRepsMax: 3,
  notes: 'Do this fresh, early in the session — before the main lifts.',
  role: 'power',
  power: { family: 'upper', kind: 'primer' },
  section18Evidence: {
    protocolVersion: 1,
    role: 'power',
    strengthPattern: null,
    mainStrengthPattern: null,
    provenance: 'canonical_row_classifier',
  },
}]);

const baseUnits = classifyDaySessions(withoutPower).map((unit) => unit.category);
const powerUnits = classifyDaySessions(withPowerRow).map((unit) => unit.category);

ok(
  'the trap baseline classifies as gunshow, not strength',
  baseUnits.includes('gunshow') &&
    !baseUnits.some((category) => category.endsWith('_strength')),
  baseUnits.join(', '),
);
ok(
  'adding Explosive Push-up power does not change the taxonomy',
  JSON.stringify(baseUnits) === JSON.stringify(powerUnits),
  `without=${baseUnits.join(', ')} with=${powerUnits.join(', ')}`,
);

const trapDays = (workout: Workout) => [{ date: '2026-07-15', workout }];
const baseCounts = countWeeklyExposures(trapDays(withoutPower));
const powerCounts = countWeeklyExposures(trapDays(withPowerRow));
ok(
  'adding Explosive Push-up power changes no weekly count',
  baseCounts.mainStrengthExposures === powerCounts.mainStrengthExposures &&
    baseCounts.hardExposures === powerCounts.hardExposures &&
    baseCounts.hardDays === powerCounts.hardDays &&
    baseCounts.conditioningExposures === powerCounts.conditioningExposures,
  `main ${baseCounts.mainStrengthExposures}→${powerCounts.mainStrengthExposures}, ` +
  `hardExp ${baseCounts.hardExposures}→${powerCounts.hardExposures}, ` +
  `hardDays ${baseCounts.hardDays}→${powerCounts.hardDays}, ` +
  `cond ${baseCounts.conditioningExposures}→${powerCounts.conditioningExposures}`,
);

// The projection must see the power work either way — otherwise the two
// assertions above would pass trivially on a day that has no power at all.
ok(
  'the trap session really does carry projected power',
  projectPower(withPowerRow)?.items[0]?.exercise === 'Explosive Push-up' &&
    projectPower(withoutPower) === null,
);

/* ── 5. Golden comparison ─────────────────────────────────────────── */

const shouldUpdate = process.argv.includes('--update');

if (shouldUpdate) {
  fs.writeFileSync(GOLDEN_PATH, serialised, 'utf8');
  console.log(`\n  WROTE golden: ${path.relative(process.cwd(), GOLDEN_PATH)}`);
  console.log('  Read the diff before committing it. This file is a ratchet.');
} else if (!fs.existsSync(GOLDEN_PATH)) {
  failures.push('golden snapshot missing');
  console.error(
    `  FAIL golden snapshot missing at ${path.relative(process.cwd(), GOLDEN_PATH)}\n` +
    '      Run: npm run test:power-counting -- --update',
  );
} else {
  const golden = fs.readFileSync(GOLDEN_PATH, 'utf8');
  ok(
    'every recorded count reproduces the committed golden byte for byte',
    golden === serialised,
    golden === serialised ? undefined : explainDiff(golden, serialised),
  );
}

/* ── Diff reporting ───────────────────────────────────────────────── */

function firstDifference(left: string, right: string): string | undefined {
  if (left === right) return undefined;
  const leftLines = left.split('\n');
  const rightLines = right.split('\n');
  for (let index = 0; index < Math.max(leftLines.length, rightLines.length); index += 1) {
    if (leftLines[index] !== rightLines[index]) {
      return `line ${index + 1}:\n        - ${leftLines[index] ?? '(end)'}\n        + ${rightLines[index] ?? '(end)'}`;
    }
  }
  return undefined;
}

/**
 * A count diff is only useful if it says WHICH count moved. Report the changed
 * lines with their JSON path, capped, so the failure reads as "hardDays went
 * 4→5 in offseason-solo-consistent week 2" rather than as a wall of JSON.
 */
function explainDiff(golden: string, current: string): string {
  const goldenSnapshot = JSON.parse(golden) as CountSnapshot;
  const currentSnapshot = JSON.parse(current) as CountSnapshot;
  const diffs: string[] = [];
  walk(goldenSnapshot, currentSnapshot, '', diffs);
  const shown = diffs.slice(0, 25);
  const suffix = diffs.length > shown.length
    ? `\n        … and ${diffs.length - shown.length} more`
    : '';
  return `${shown.join('\n        ')}${suffix}\n\n      If the diff is CORRECT, regenerate with --update and say so in the commit.`;
}

function walk(left: unknown, right: unknown, at: string, out: string[]): void {
  if (out.length > 200) return;
  if (JSON.stringify(left) === JSON.stringify(right)) return;
  if (
    left === null || right === null ||
    typeof left !== 'object' || typeof right !== 'object'
  ) {
    out.push(`${at}: ${JSON.stringify(left)} → ${JSON.stringify(right)}`);
    return;
  }
  if (Array.isArray(left) !== Array.isArray(right)) {
    out.push(`${at}: shape changed`);
    return;
  }
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    walk(
      (left as Record<string, unknown>)[key],
      (right as Record<string, unknown>)[key],
      at ? `${at}.${key}` : key,
      out,
    );
  }
}

/* ── Result ───────────────────────────────────────────────────────── */

console.log(
  `\nPower counting differential: passed=${passed}/${passed + failures.length} failures=${failures.length}`,
);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
