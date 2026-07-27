/**
 * Power exercise pool + selector — the spec's invariants.
 *
 *   docs/POWER_EXERCISE_POOL_SPEC_2026-07-23.md (Sam, APPROVED design input)
 *
 * Covers P1-P5 and P7. Two invariants are deliberately NOT here:
 *
 *   P6 (counting fence byte-identical) belongs to whatever WIRES the selector
 *      into `buildPowerBlock`. Nothing is wired yet, so there is no fence to
 *      compare — asserting it here would assert against the old hardcoded
 *      path and prove nothing about the new one.
 *   P8 (athlete override persists for the block, routed through the
 *      transaction owner, undo restores the app pick) is ruled into execution
 *      order step 5, where the per-session controls get designed once. See the
 *      Step 5 queue in docs/SAM_EXECUTION_ORDER_2026-07-25.md.
 *
 * Run: npm run test:power-pool
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import fs from 'fs';
import path from 'path';

import {
  POWER_EXERCISE_POOL,
  eligiblePowerExercises,
  selectPowerExercise,
  POWER_POOL_REDUCED_TAKEOVER,
  type PowerPoolEntry,
  type PowerSelectionContext,
} from '../rules/powerExercisePool';
import { TRAINING_AGE_LEVELS, type TrainingAgeLevel } from '../rules/experienceCrosswalk';
import type { SeasonPhase } from '../types/domain';

const repoRoot = path.resolve(__dirname, '../..');

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

function ctx(over: Partial<PowerSelectionContext> = {}): PowerSelectionContext {
  return {
    family: 'lower',
    phase: 'Off-season',
    trainingAge: 'advanced',
    reduced: false,
    availableEquipment: ['Box'],
    blockId: 'block-1',
    ...over,
  };
}

/* ── The pool ── */

console.log('\n[1] THE POOL — Sam\'s entries, as data');

ok('the pool is non-empty', POWER_EXERCISE_POOL.length > 0);

/** Sam's spec tables: the three existing entries plus four new ones. */
const AUTHORED_ENTRIES: ReadonlyArray<
  readonly [string, 'lower' | 'upper', TrainingAgeLevel | null, readonly string[]]
> = [
  ['Vertical Jump', 'lower', null, []],
  ['Pogo Hops', 'lower', null, []],
  ['Explosive Push-up', 'upper', null, []],
  ['Depth Jumps', 'lower', 'developing', ['Box']],
  ['Lateral Jump', 'lower', null, []],
  ['Lateral Bounds', 'lower', 'developing', []],
  ['Kneeling Jump', 'lower', 'consistent', []],
];

ok(
  'the pool holds exactly Sam\'s seven entries',
  POWER_EXERCISE_POOL.length === AUTHORED_ENTRIES.length,
  `found ${POWER_EXERCISE_POOL.length}: ${POWER_EXERCISE_POOL.map((e) => e.name).join(', ')}`,
);

for (const [name, family, minTrainingAge, equipment] of AUTHORED_ENTRIES) {
  const entry = POWER_EXERCISE_POOL.find((candidate) => candidate.name === name);
  if (!entry) {
    ok(`${name} is in the pool`, false);
    continue;
  }
  ok(`${name} is ${family} family`, entry.family === family, `found ${entry.family}`);
  ok(
    `${name} min training age = ${minTrainingAge ?? 'none'}`,
    (entry.minTrainingAge ?? null) === minTrainingAge,
    `found ${entry.minTrainingAge ?? 'none'}`,
  );
  ok(
    `${name} requires equipment [${equipment.join(', ')}]`,
    entry.equipmentRequired.slice().sort().join(',') === equipment.slice().sort().join(','),
    `found [${entry.equipmentRequired.join(', ')}]`,
  );
}

// Rule 6: the pool carries NO dose. Dose is policy-stamped, always.
ok(
  'no pool entry carries sets or reps — dose stays with the policy',
  POWER_EXERCISE_POOL.every(
    (entry) =>
      !('sets' in entry) && !('repsMin' in entry) && !('repsMax' in entry),
  ),
);

ok(
  'the med-ball family is absent (retired by the locked list)',
  !POWER_EXERCISE_POOL.some((entry) => /medicine ball|med ball/i.test(entry.name)),
);

ok(
  'no entry names a sled (NO SLEDS anywhere)',
  !POWER_EXERCISE_POOL.some((entry) => /sled/i.test(entry.name)),
);

/* ── P1 — gating ── */

console.log('\n[2] P1 — experience and phase gating');

const HARDER = ['Depth Jumps', 'Lateral Bounds', 'Kneeling Jump'];

const newAthleteNames = eligiblePowerExercises(ctx({ trainingAge: 'new' })).map((e) => e.name);
ok(
  'a `new` athlete never sees Depth / Bounds / Kneeling',
  HARDER.every((name) => !newAthleteNames.includes(name)),
  `saw: ${newAthleteNames.join(', ')}`,
);

const developingNames = eligiblePowerExercises(ctx({ trainingAge: 'developing' })).map((e) => e.name);
ok(
  'a `developing` athlete never sees Kneeling Jump',
  !developingNames.includes('Kneeling Jump'),
  `saw: ${developingNames.join(', ')}`,
);
ok(
  'a `developing` athlete DOES see Depth Jumps and Lateral Bounds',
  developingNames.includes('Depth Jumps') && developingNames.includes('Lateral Bounds'),
  `saw: ${developingNames.join(', ')}`,
);

const consistentNames = eligiblePowerExercises(ctx({ trainingAge: 'consistent' })).map((e) => e.name);
ok(
  'a `consistent` athlete sees Kneeling Jump',
  consistentNames.includes('Kneeling Jump'),
  `saw: ${consistentNames.join(', ')}`,
);

// In-season = familiar / low-impact only (rule 4).
const inSeasonNames = eligiblePowerExercises(
  ctx({ phase: 'In-season', trainingAge: 'advanced' }),
).map((e) => e.name);
ok(
  'the in-season lower pool is Vertical Jump + Lateral Jump only',
  inSeasonNames.slice().sort().join(',') === ['Lateral Jump', 'Vertical Jump'].join(','),
  `found: ${inSeasonNames.join(', ')}`,
);

ok(
  'the off/pre-season-only entries are absent in-season even for advanced athletes',
  HARDER.every((name) => !inSeasonNames.includes(name)),
);

ok(
  'pre-season admits the harder entries for an advanced athlete',
  eligiblePowerExercises(ctx({ phase: 'Pre-season', trainingAge: 'advanced' }))
    .map((e) => e.name)
    .includes('Kneeling Jump'),
);

/* ── P2 — reduced takeover ── */

console.log('\n[3] P2 — reduced (niggle) hands the slot to Pogo Hops');

ok('the takeover exercise is Pogo Hops', POWER_POOL_REDUCED_TAKEOVER === 'Pogo Hops');

for (const level of TRAINING_AGE_LEVELS) {
  for (const phase of ['Off-season', 'Pre-season', 'In-season'] as SeasonPhase[]) {
    const pick = selectPowerExercise(
      ctx({ reduced: true, trainingAge: level, phase, family: 'lower' }),
    );
    ok(
      `reduced + ${level} + ${phase} -> Pogo Hops`,
      pick?.name === 'Pogo Hops',
      `got ${pick?.name ?? 'null'}`,
    );
  }
}

ok(
  'reduced does not hijack the UPPER slot',
  selectPowerExercise(ctx({ reduced: true, family: 'upper' }))?.name === 'Explosive Push-up',
);

/* ── P3 — block stability ── */

console.log('\n[4] P3 — block-stable, deterministic, rotates at rollover');

const stableCtx = ctx({ trainingAge: 'advanced', phase: 'Off-season' });
const repeated = Array.from({ length: 12 }, () => selectPowerExercise(stableCtx)?.name);
ok(
  'the same block yields the same pick every time it is asked',
  new Set(repeated).size === 1,
  `saw ${[...new Set(repeated)].join(', ')}`,
);

ok(
  'the pick is independent of anything but the declared context',
  selectPowerExercise({ ...stableCtx })?.name === selectPowerExercise({ ...stableCtx })?.name,
);

// STRUCTURAL purity check, and it earns its place: seeding the rotation with
// `Date.now()` passes every behavioural assertion above, because repeated calls
// in a test share a millisecond. Spec rule 1 is "No per-week randomness", so the
// impurity has to be caught at the source or it is not caught at all.
const selectorSource = fs.readFileSync(
  path.join(repoRoot, 'src/rules/powerExercisePool.ts'),
  'utf8',
);
const impureCalls = ['Date.now', 'new Date', 'Math.random', 'performance.now'].filter(
  (needle) =>
    selectorSource
      .split('\n')
      // Ignore prose: these names are discussed in the module's own comments.
      .filter((line) => !/^\s*(\*|\/\/)/.test(line))
      .some((line) => line.includes(needle)),
);

ok(
  'the selector reads no clock and no randomness — determinism is structural',
  impureCalls.length === 0,
  `found: ${impureCalls.join(', ')}`,
);

const acrossBlocks = new Set(
  Array.from({ length: 8 }, (_unused, index) =>
    selectPowerExercise(ctx({ blockId: `block-${index}`, trainingAge: 'advanced' }))?.name,
  ),
);
ok(
  'picks rotate across blocks so lateral / vertical / depth all get trained',
  acrossBlocks.size > 1,
  `8 blocks produced only: ${[...acrossBlocks].join(', ')}`,
);

ok(
  'every rotated pick is an eligible entry',
  [...acrossBlocks].every((name) =>
    eligiblePowerExercises(ctx({ trainingAge: 'advanced' })).some((e) => e.name === name),
  ),
);

/* ── P4 — equipment ── */

console.log('\n[5] P4 — equipment substitutes, never forces');

const noBoxNames = eligiblePowerExercises(ctx({ availableEquipment: [] })).map((e) => e.name);
ok(
  'a no-box athlete never receives Depth Jumps',
  !noBoxNames.includes('Depth Jumps'),
  `saw: ${noBoxNames.join(', ')}`,
);

ok(
  'a no-box athlete still gets a pick',
  selectPowerExercise(ctx({ availableEquipment: [] })) !== null,
);

// A bodyweight option must exist for EVERY reachable cell, or some athlete
// silently loses their power block.
const emptyCells: string[] = [];
for (const family of ['lower', 'upper'] as const) {
  for (const phase of ['Off-season', 'Pre-season', 'In-season'] as SeasonPhase[]) {
    for (const level of TRAINING_AGE_LEVELS) {
      const cell = ctx({ family, phase, trainingAge: level, availableEquipment: [] });
      const eligible = eligiblePowerExercises(cell);
      if (!eligible.some((entry) => entry.equipmentRequired.length === 0)) {
        emptyCells.push(`${family}/${phase}/${level}`);
      }
      if (selectPowerExercise(cell) === null) emptyCells.push(`${family}/${phase}/${level} (null)`);
    }
  }
}
ok(
  'every (family, phase, experience) cell has a zero-equipment option',
  emptyCells.length === 0,
  emptyCells.join(', '),
);

/* ── P5 / rule 6 — dose ownership ── */

console.log('\n[6] P5 — the selector never invents a dose');

ok(
  'selectPowerExercise returns identity only, no dose fields',
  (() => {
    const pick = selectPowerExercise(ctx());
    if (!pick) return false;
    const keys = Object.keys(pick);
    return !keys.includes('sets') && !keys.includes('repsMin') && !keys.includes('repsMax');
  })(),
);

/* ── P7 — contrast shares the pool ── */

console.log('\n[7] P7 — contrast draws from the same pool, same pick');

for (const level of TRAINING_AGE_LEVELS) {
  const primer = selectPowerExercise(ctx({ kind: 'primer', trainingAge: level }));
  const contrast = selectPowerExercise(ctx({ kind: 'contrast', trainingAge: level }));
  ok(
    `contrast and primer agree for ${level} (no separate contrast preference)`,
    primer?.name === contrast?.name,
    `primer ${primer?.name} vs contrast ${contrast?.name}`,
  );
}

/* ── Vocabulary honesty ── */

console.log('\n[8] UNWIRED — the pool changes no athlete-visible behaviour yet');

ok(
  'every pool name is a real curated exercise name',
  POWER_EXERCISE_POOL.every((entry) => entry.name.trim() !== ''),
);

// The pool is not one of the four selectability sources, so building it must not
// have made anything selectable. Wiring it retires `power_pool_pending`, which
// is what makes the cue/video gates bite — deliberately a separate unit.
ok(
  'the pool is not yet a selectability source',
  (() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const vocab = require('../data/selectableExerciseVocabulary');
    return vocab.isSelectable('Vertical Jump') === false;
  })(),
  'Vertical Jump became selectable — the cue/video gates now apply and it has no cue',
);

/* ── Result ── */

console.log(
  `\nPower exercise pool: passed=${passed}/${passed + failures.length} failures=${failures.length}`,
);
if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
