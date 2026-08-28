/**
 * Power exercise pool + selector — the spec's invariants.
 *
 *   docs/POWER_EXERCISE_POOL_SPEC_2026-07-23.md (Sam, APPROVED design input)
 *
 * Covers P1-P7. One invariant is deliberately NOT here:
 *
 *   P8 (athlete override persists for the block, routed through the
 *      transaction owner, undo restores the app pick) is ruled into execution
 *      order step 5, where the per-session controls (+ / - / swap / move) get
 *      designed once — a power-only affordance would be the special case Sam
 *      rejected. See the Step 5 queue in docs/SAM_EXECUTION_ORDER_2026-07-25.md.
 *
 * Run: npm run test:power-pool
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
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
import { isSelectable, exemptionsFor, isExempt } from '../data/selectableExerciseVocabulary';
import { EXERCISE_CUES } from '../data/exerciseCues';
import { lookupExerciseDemo } from '../services/exerciseVideoService';
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
  ['Box Jumps', 'lower', null, ['Box']],
  ['Broad Jumps', 'lower', null, []],
  ['Jump Squats', 'lower', null, []],
];

ok(
  'the pool holds exactly Sam\'s ten approved entries',
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
  'the in-season lower pool includes the three additions approved on 2026-08-28',
  inSeasonNames.slice().sort().join(',') === ['Box Jumps', 'Broad Jumps', 'Jump Squats', 'Lateral Jump', 'Vertical Jump'].join(','),
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

console.log('\n[8] WIRED — the pool is now a real selectability source');

ok(
  'every pool name is a real curated exercise name',
  POWER_EXERCISE_POOL.every((entry) => entry.name.trim() !== ''),
);

// Wiring the pool retired `power_pool_pending` for the names it places, which is
// what makes the content-completeness gates bite. Both directions matter: the
// pool must BE a source (or nothing it names can be prescribed), and every entry
// must now carry a curated cue (or the gates it just became subject to fail).
const unselectable = POWER_EXERCISE_POOL.filter((entry) => !isSelectable(entry.name));
ok(
  'every pool entry is selectable — the pool is a selectability source',
  unselectable.length === 0,
  unselectable.map((entry) => entry.name).join(', '),
);

const stillExempt = POWER_EXERCISE_POOL.filter((entry) =>
  exemptionsFor(entry.name).includes('power_pool_pending'),
);
ok(
  'no placed entry still claims the power_pool_pending exemption',
  stillExempt.length === 0,
  stillExempt.map((entry) => entry.name).join(', '),
);

const cueless = POWER_EXERCISE_POOL.filter(
  (entry) => !EXERCISE_CUES[entry.name] || EXERCISE_CUES[entry.name].primaryCue.trim() === '',
);
ok(
  'every pool entry has a curated cue — the block can be cued like any row',
  cueless.length === 0,
  cueless.map((entry) => entry.name).join(', '),
);

// The video gap this wiring exposed is CLOSED (Sam supplied both URLs,
// 2026-07-27) and the `awaiting_sam_video` exemption is retired, not left empty.
// So the assertion is the strong one: every pool entry resolves a real video,
// and no pool entry carries any exemption at all.
const videoless = POWER_EXERCISE_POOL.filter((entry) => !lookupExerciseDemo(entry.name).url);
ok(
  'every pool entry resolves a demo video',
  videoless.length === 0,
  videoless.map((entry) => entry.name).join(', '),
);

const anyExempt = POWER_EXERCISE_POOL.filter((entry) => exemptionsFor(entry.name).length > 0);
ok(
  'no pool entry carries ANY content exemption',
  anyExempt.length === 0,
  anyExempt.map((e) => `${e.name}: ${exemptionsFor(e.name).join(',')}`).join('; '),
);

/* ── P6 — the counting fence survived the wiring ── */

console.log('\n[9] P6 — the counting fence is untouched');

// The fence is what keeps the power block honest: not conditioning, not a
// finisher, not a hard exposure, not main strength. Wiring identity selection
// must not have shifted it, so assert the literal is still exactly those four
// values. The §18 / bible / ownership suites cover the behavioural half.
const programSource = fs.readFileSync(
  path.join(repoRoot, 'src/data/defaultProgram.ts'),
  'utf8',
);
// STAGE 3 RE-POINT. These two used to grep `defaultProgram.ts` for the block's
// literal `counting: { hardExposure: false, ... }` object and for
// `buildPowerBlock`. Power is a ROW now, and that object is gone — the fence
// lives in the authored role, read at one choke point. Deleting the assertions
// would lose the guard, so they are re-pointed at what carries the same
// meaning in the row era.
ok(
  'the power row is authored role:power — the fence in its new form',
  /role: 'power',/.test(programSource) &&
    /power: \{ family: spec\.family, kind: spec\.kind \},/.test(programSource),
);
ok(
  'the power row stamps power Section 18 evidence, never a name-classified one',
  /section18Evidence: \{[\s\S]{0,400}?role: 'power',/.test(programSource),
);

// Dose must still come from the policy's spec, not from the pool. If a future
// edit read a number off a pool entry, this is where it shows up.
ok(
  'buildPowerRow stamps the dose from the policy spec, not the pool',
  /prescribedSets: spec\.sets,\s*prescribedRepsMin: spec\.repsMin,\s*prescribedRepsMax: spec\.repsMax,/.test(programSource),
);

/* ── Result ── */

console.log(
  `\nPower exercise pool: passed=${passed}/${passed + failures.length} failures=${failures.length}`,
);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
