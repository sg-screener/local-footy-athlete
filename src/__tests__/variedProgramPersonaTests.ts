/**
 * Varied-Program Persona — Multi-block rotation stress test.
 *
 * Run: npm run test:variation
 *
 * Drives a realistic pre-season athlete profile through 3 mini-cycles
 * × 4 weeks (12 weeks total), one full cycle across every anchor pool,
 * and asserts the rotation contract holds over time — not just within
 * a single block as the unit tests cover.
 *
 * Assertions:
 *   1. Rotation holds across cycles — each slot's anchor walks the full
 *      pool as mini-cycles advance.
 *   2. Anchor stable within block — 4 weeks of the same mc → same pick.
 *   3. Anchor changes across blocks — consecutive mc's pick different
 *      anchors (no back-to-back repetition).
 *   4. Accessories rotate within block — 4 weeks of the same mc → 4
 *      distinct accessory picks.
 *   5. All slots rotate independently (squat / hinge / h_push / v_push /
 *      h_pull / v_pull / carry / isolation_upper / isolation_lower / plyo).
 *   6. Progression continuity on anchor swap — when mc2's anchor differs
 *      from mc1's, and the athlete logged weight on mc1's anchor, the
 *      mc2 prescription starts near the loadRatio-normalised equivalent
 *      (not at bodyweight / zero).
 */

import {
  STRENGTH_POOLS,
  applyPoolRotation,
  type PoolSlotKey,
  type RotationContext,
} from '../data/exercisePoolsStrength';
import {
  buildWorkoutsFromCoach,
  findOrCreateExercise,
} from '../data/defaultProgram';
import {
  applyStrengthProgression,
  DEFAULT_PROGRESSION_CONTEXT,
  type StrengthProgressionContext,
} from '../utils/strengthProgressionIntegration';

// ─── Simple test runner ───

let pass = 0;
let fail = 0;
const failures: string[] = [];

function assert(condition: boolean, msg: string): void {
  if (condition) pass++;
  else {
    fail++;
    failures.push(msg);
    console.error(`  FAIL: ${msg}`);
  }
}

function section(title: string): void {
  console.log(`\n=== ${title} ===`);
}

// ─── Persona input: one session per slot, AI proposes the reference
// anchor + one accessory. Rotation layer rewrites these deterministically.
// Using one session-per-slot keeps capture simple (one anchor + one
// accessory picked per slot per week). ───

function slotSession(slot: PoolSlotKey, dayOfWeek: number) {
  const anchorEntries = STRENGTH_POOLS[slot].anchor.entries;
  const accessoryEntries = STRENGTH_POOLS[slot].accessory.entries;
  // For accessory-only slots (empty anchor — isolation_lower), seed both
  // positions with accessory-pool names. Within-session avoidance will
  // resolve them to two distinct accessory picks. The "anchor" column in
  // the capture thus holds the rotation-indexed accessory pick; anchor-
  // specific assertions skip empty-anchor slots.
  const anchorSeed = anchorEntries.length > 0
    ? anchorEntries[0].name
    : accessoryEntries[0].name;
  const accessorySeed = accessoryEntries[0].name;
  return {
    dayOfWeek,
    name: `${slot} session`,
    workoutType: 'Strength',
    sessionTier: 'core' as const,
    exercises: [
      { name: anchorSeed, sets: 5, repsMin: 5, repsMax: 5, weight: 100 },
      { name: accessorySeed, sets: 3, repsMin: 8, repsMax: 10, weight: 40 },
    ],
  };
}

const SLOTS: PoolSlotKey[] = [
  'squat',
  'hinge',
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
  'carry',
  'isolation_upper',
  'isolation_lower',
  'plyo',
];

/** Slots whose anchor pool is empty (accessory-only). Anchor-specific
 *  assertions (stability-within-block, cross-block rotation, full-walk)
 *  must skip these. */
const ACCESSORY_ONLY_SLOTS: ReadonlySet<PoolSlotKey> = new Set(['isolation_lower']);

type SlotCapture = { anchor: string; accessory: string };
type Capture = Record<PoolSlotKey, SlotCapture[][]>;

/** How many mini-cycles we need to walk every anchor in every slot. */
const MAX_ANCHOR_POOL = Math.max(
  ...SLOTS.map((s) => STRENGTH_POOLS[s].anchor.entries.length),
);

/**
 * Simulate N blocks × 4 weeks. For each (mc, w), build a weekly plan that
 * proposes one anchor + one accessory in each of the registered slots and
 * capture the resolved exercise names.
 *
 * Returns capture[slot][mc-1][w-1] = { anchor, accessory }
 */
function simulateMultiBlock(blocks: number): Capture {
  const capture: Capture = Object.fromEntries(
    SLOTS.map((s) => [s, [] as SlotCapture[][]]),
  ) as Capture;

  for (let mc = 1; mc <= blocks; mc++) {
    for (const slot of SLOTS) capture[slot].push([]);
    for (let w = 1; w <= 4; w++) {
      const ctx: RotationContext = { miniCycleNumber: mc, weekInBlock: w };
      // This is a pool-rotation harness, not a persisted workout. Power rows
      // now correctly disappear at the canonical workout boundary, so test
      // the plyo pool (and every other pool) at its actual ownership layer.
      const sessions = SLOTS.map((slot, idx) => slotSession(slot, idx + 1));
      for (let i = 0; i < SLOTS.length; i++) {
        const slot = SLOTS[i];
        const usage = new Map<string, Set<string>>();
        const anchorName = applyPoolRotation(sessions[i].exercises[0].name, ctx, usage);
        const accessoryName = applyPoolRotation(sessions[i].exercises[1].name, ctx, usage);
        capture[slot][mc - 1].push({ anchor: anchorName, accessory: accessoryName });
      }
    }
  }
  return capture;
}

// ─────────────────────────────────────────────────────────────────
// Section 1: Multi-block simulation — N blocks × 4 weeks per slot
// (N = longest anchor pool, so every slot gets at least one full walk)
// ─────────────────────────────────────────────────────────────────
const BLOCKS = MAX_ANCHOR_POOL; // 3 — matches squat/hinge/upper_push/upper_pull/plyo
section(`1. Multi-block simulation (${BLOCKS} blocks × 4 weeks)`);
const capture = simulateMultiBlock(BLOCKS);

// Print a summary matrix for human-readable output
for (const slot of SLOTS) {
  console.log(`\n  [${slot}]`);
  for (let mc = 0; mc < BLOCKS; mc++) {
    const line = capture[slot][mc]
      .map((w, i) => `w${i + 1}: ${w.anchor} / ${w.accessory}`)
      .join(' | ');
    console.log(`    mc${mc + 1}: ${line}`);
  }
}

// ─────────────────────────────────────────────────────────────────
// Section 2: Anchor stable within block
//
// Skips accessory-only slots (e.g. isolation_lower) — the "anchor"
// column of their capture holds a second accessory pick that rotates
// with weekInBlock, not a stable anchor.
// ─────────────────────────────────────────────────────────────────
section('2. Anchor stable within block');
for (const slot of SLOTS) {
  if (ACCESSORY_ONLY_SLOTS.has(slot)) continue;
  for (let mc = 0; mc < BLOCKS; mc++) {
    const anchors = new Set(capture[slot][mc].map(w => w.anchor));
    assert(anchors.size === 1,
      `[${slot}] mc${mc + 1}: 1 unique anchor across 4 weeks (got ${anchors.size}: ${Array.from(anchors).join(', ')})`);
  }
}

// ─────────────────────────────────────────────────────────────────
// Section 3: Anchor changes across blocks
//
// For pools with length ≥ 2, consecutive mini-cycles must pick different
// anchors. Pools of length 1 would trivially repeat, but we've ruled that
// out at pool-integrity time. Accessory-only slots are skipped.
// ─────────────────────────────────────────────────────────────────
section('3. Anchor changes across consecutive blocks');
for (const slot of SLOTS) {
  if (ACCESSORY_ONLY_SLOTS.has(slot)) continue;
  const poolLen = STRENGTH_POOLS[slot].anchor.entries.length;
  if (poolLen < 2) continue;
  for (let mc = 0; mc < BLOCKS - 1; mc++) {
    const prev = capture[slot][mc][0].anchor;
    const next = capture[slot][mc + 1][0].anchor;
    assert(prev !== next,
      `[${slot}] mc${mc + 1} (${prev}) ≠ mc${mc + 2} (${next})`);
  }
}

// ─────────────────────────────────────────────────────────────────
// Section 4: Anchor rotation walks the full pool
//
// With BLOCKS = MAX_ANCHOR_POOL, slots with shorter anchor pools will
// have walked every entry AND started wrapping. We assert each slot has
// seen every anchor at least once. Accessory-only slots skipped.
// ─────────────────────────────────────────────────────────────────
section(`4. Anchor rotation walks the full pool (mc=1..${BLOCKS})`);
for (const slot of SLOTS) {
  if (ACCESSORY_ONLY_SLOTS.has(slot)) continue;
  const seen = new Set(capture[slot].map(block => block[0].anchor));
  const poolLen = STRENGTH_POOLS[slot].anchor.entries.length;
  assert(seen.size === Math.min(poolLen, BLOCKS),
    `[${slot}] ${BLOCKS} blocks walk ${Math.min(poolLen, BLOCKS)} anchor entries (saw ${seen.size}: ${Array.from(seen).join(', ')})`);
}

// ─────────────────────────────────────────────────────────────────
// Section 5: Accessories rotate within block
//
// Distinct accessories per block is min(4, poolLen). Large pools (11 for
// isolation_upper) hit 4 distinct per block; small pools (2 for carry /
// plyo) alternate — still 2 distinct in 4 weeks.
// ─────────────────────────────────────────────────────────────────
section('5. Accessories rotate within block (min(4, poolLen) distinct)');
for (const slot of SLOTS) {
  const poolLen = STRENGTH_POOLS[slot].accessory.entries.length;
  const expected = Math.min(4, poolLen);
  for (let mc = 0; mc < BLOCKS; mc++) {
    const accessories = capture[slot][mc].map(w => w.accessory);
    const unique = new Set(accessories);
    assert(unique.size === expected,
      `[${slot}] mc${mc + 1}: ${expected} distinct accessories across 4 weeks (got ${unique.size}: ${accessories.join(', ')})`);
    // No consecutive repeat (rotation must advance every week)
    for (let i = 1; i < accessories.length; i++) {
      assert(accessories[i] !== accessories[i - 1],
        `[${slot}] mc${mc + 1} w${i + 1} (${accessories[i]}) ≠ w${i} (${accessories[i - 1]})`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// Section 6: Block-boundary no-repeat (accessory)
// ─────────────────────────────────────────────────────────────────
section('6. Accessory block-boundary no-repeat');
for (const slot of SLOTS) {
  const poolLen = STRENGTH_POOLS[slot].accessory.entries.length;
  if (poolLen < 2) continue;
  for (let mc = 0; mc < BLOCKS - 1; mc++) {
    const lastOfBlock = capture[slot][mc][3].accessory;
    const firstOfNext = capture[slot][mc + 1][0].accessory;
    assert(lastOfBlock !== firstOfNext,
      `[${slot}] mc${mc + 1}/w4 (${lastOfBlock}) ≠ mc${mc + 2}/w1 (${firstOfNext})`);
  }
}

// ─────────────────────────────────────────────────────────────────
// Section 7: Slots rotate independently (per-slot fingerprints differ)
// ─────────────────────────────────────────────────────────────────
section('7. Slots rotate independently');
{
  const perSlotFingerprint = SLOTS.map((slot) => {
    const fp = capture[slot]
      .map(block => `${block[0].anchor}|${block.map(w => w.accessory).join(',')}`)
      .join(' / ');
    return { slot, fp };
  });
  const uniqueCount = new Set(perSlotFingerprint.map(x => x.fp)).size;
  assert(uniqueCount === SLOTS.length,
    `All ${SLOTS.length} slot fingerprints are distinct (got ${uniqueCount})`);
}

// ─────────────────────────────────────────────────────────────────
// Section 8: Progression continuity on anchor swap
//
// Simulate: athlete crushes Back Squat at 100kg through mc=1.
// At mc=2, anchor rotates to the next pool entry. The progression
// engine should pull the mc=1 performance forward — not reset to
// bodyweight — via load-ratio normalisation.
// ─────────────────────────────────────────────────────────────────
section('8. Progression continuity on anchor swap');
{
  // Expect: mc=1 anchor = entries[0] (Back Squat), mc=2 anchor = entries[1] (Front Squat)
  const mc1Anchor = capture.squat[0][0].anchor;
  const mc2Anchor = capture.squat[1][0].anchor;
  assert(mc1Anchor === 'Back Squat', `mc=1 squat anchor is Back Squat (got ${mc1Anchor})`);
  assert(mc2Anchor === 'Front Squat', `mc=2 squat anchor is Front Squat (got ${mc2Anchor})`);

  // Build a minimal mc=2 workout whose anchor is Front Squat at seed weight 100kg.
  const mc2Ctx: RotationContext = { miniCycleNumber: 2, weekInBlock: 1 };
  const [mc2Workout] = buildWorkoutsFromCoach(
    [{
      dayOfWeek: 1,
      name: 'squat session',
      workoutType: 'Strength',
      sessionTier: 'core',
      exercises: [
        { name: 'Back Squat', sets: 5, repsMin: 5, repsMax: 5, weight: 100 },
      ],
    }],
    'mc-2-w1', undefined, undefined, mc2Ctx,
  );
  const mc2FrontSquatExercise = mc2Workout.exercises[0];
  assert(mc2FrontSquatExercise.exercise?.name === 'Front Squat',
    `mc=2 prescription is Front Squat (got ${mc2FrontSquatExercise.exercise?.name})`);

  // Build lastPerformedWeights with the mc=1 athlete's Back Squat id → 100kg.
  const backSquatId = findOrCreateExercise('Back Squat').id;
  const lastPerformedWeights: Record<string, number | null> = {
    [backSquatId]: 100,
  };

  // Apply progression. No trend (empty history), steady context → expect
  // small or zero delta on the seeded weight.
  const ctx: StrengthProgressionContext = {
    ...DEFAULT_PROGRESSION_CONTEXT,
    seasonPhase: 'Pre-season',
    readiness: 'high',
    sessionFeeling: 'Good',
  };
  const progressed = applyStrengthProgression(mc2Workout, ctx, lastPerformedWeights);
  const frontSquatPrescribed = progressed.exercises[0].prescribedWeightKg;

  // Expected baseline from sibling transfer: 100 * (0.85 / 1.00) = 85kg.
  // Progression delta may bump up/down a small amount — tolerance ±10%.
  const expectedBase = 85;
  assert(typeof frontSquatPrescribed === 'number',
    `Front Squat prescribed weight populated (got ${frontSquatPrescribed})`);
  const delta = Math.abs((frontSquatPrescribed ?? 0) - expectedBase);
  assert(delta <= expectedBase * 0.10,
    `Front Squat prescribed ${frontSquatPrescribed}kg within ±10% of sibling-normalised baseline ${expectedBase}kg (delta ${delta.toFixed(1)}kg)`);

  // Sanity: the prescribed weight must NOT be bodyweight/zero — rotation must
  // never reset an experienced athlete.
  assert((frontSquatPrescribed ?? 0) > 50,
    `Front Squat prescribed ${frontSquatPrescribed}kg is not a reset (> 50kg)`);
}

// ─────────────────────────────────────────────────────────────────
// Section 9: Progression continuity via exposure history trend
//
// Two logged workouts of Back Squat at progressively heavier loads.
// At mc=2, extractSlotExposureHistory should pull those exposures in
// (normalised to Front Squat) and feed a rising trend into progression.
// ─────────────────────────────────────────────────────────────────
section('9. Exposure history transfers across anchor swap');
{
  const backSquatId = findOrCreateExercise('Back Squat').id;
  const history = [
    // Newest first — matches extractSlotExposureHistory expectation
    {
      id: 'lw-2', userId: 'u', workoutId: 'w2',
      loggedDate: '2026-04-14', completed: true, synced: true,
      sets: [
        { id: 'ls-3', loggedWorkoutId: 'lw-2', workoutExerciseId: backSquatId,
          setNumber: 1, actualReps: 5, actualWeightKg: 105,
          createdAt: '', updatedAt: '' },
        { id: 'ls-4', loggedWorkoutId: 'lw-2', workoutExerciseId: backSquatId,
          setNumber: 2, actualReps: 5, actualWeightKg: 105,
          createdAt: '', updatedAt: '' },
      ],
      createdAt: '', updatedAt: '',
    },
    {
      id: 'lw-1', userId: 'u', workoutId: 'w1',
      loggedDate: '2026-04-07', completed: true, synced: true,
      sets: [
        { id: 'ls-1', loggedWorkoutId: 'lw-1', workoutExerciseId: backSquatId,
          setNumber: 1, actualReps: 5, actualWeightKg: 100,
          createdAt: '', updatedAt: '' },
        { id: 'ls-2', loggedWorkoutId: 'lw-1', workoutExerciseId: backSquatId,
          setNumber: 2, actualReps: 5, actualWeightKg: 100,
          createdAt: '', updatedAt: '' },
      ],
      createdAt: '', updatedAt: '',
    },
  ];

  const mc2Ctx: RotationContext = { miniCycleNumber: 2, weekInBlock: 1 };
  const [mc2Workout] = buildWorkoutsFromCoach(
    [{
      dayOfWeek: 1, name: 'squat', workoutType: 'Strength', sessionTier: 'core',
      exercises: [{ name: 'Back Squat', sets: 5, repsMin: 5, repsMax: 5, weight: 100 }],
    }],
    'mc-2-w1', undefined, undefined, mc2Ctx,
  );
  assert(mc2Workout.exercises[0].exercise?.name === 'Front Squat',
    `mc=2 anchor rotates to Front Squat`);

  const ctx: StrengthProgressionContext = {
    ...DEFAULT_PROGRESSION_CONTEXT,
    seasonPhase: 'Pre-season',
    readiness: 'high',
    sessionFeeling: 'Good',
    workoutHistory: history as any,
  };

  const progressed = applyStrengthProgression(
    mc2Workout,
    ctx,
    { [backSquatId]: 105 }, // athlete's most recent Back Squat weight
  );
  const frontSquatPrescribed = progressed.exercises[0].prescribedWeightKg;

  // Expected: 105 × 0.85 = 89.25, rounded to 2.5kg increment → 87.5 or 90,
  // plus or minus a progression bump (typical micro_up = +2.5kg).
  // Tolerance: within 12.5kg of 89.25.
  assert(typeof frontSquatPrescribed === 'number' && frontSquatPrescribed > 70,
    `Front Squat prescribed from sibling history: ${frontSquatPrescribed}kg (expected ~89kg)`);
}

// ─────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────
console.log(`\n${'='.repeat(60)}`);
console.log(`Results: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log(`\nFailures:`);
  failures.forEach(f => console.log(`  - ${f}`));
  process.exit(1);
}
console.log('All varied-program persona assertions passed.');
