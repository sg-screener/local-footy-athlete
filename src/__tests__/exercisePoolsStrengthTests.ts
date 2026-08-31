/**
 * Exercise Pools (Strength) — Cross-cycle variation tests.
 *
 * Run: npx sucrase-node src/__tests__/exercisePoolsStrengthTests.ts
 *
 * Asserts the contract of the deterministic pool rotation:
 *   - Anchor stable within a mini-cycle (any weekInBlock change → same pick)
 *   - Anchor rotates across mini-cycles (no back-to-back repetition)
 *   - Accessory rotates across weeks within a block
 *   - Classification prefers explicit pool membership over tag heuristics
 *   - Load normalization translates across siblings via loadRatio
 *   - Within-session avoidance prevents duplicate picks
 *   - buildWorkoutsFromCoach integrates the rotation when rotationContext
 *     is passed (and leaves names untouched when it isn't)
 *
 * B1-PIVOT (2026-08-14): `applyPoolRotation` was DELETED from
 * `src/data/exercisePoolsStrength.ts` — the composer authors every strength row
 * directly and nothing rewrites a suggested name any more. Cells whose subject
 * was that function are gone; cells that merely used it as a convenience
 * wrapper now call the live `selectPoolEntry` / `selectPoolEntryAvoiding`.
 */

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import {
  STRENGTH_POOLS,
  classifyPoolSlot,
  findPoolEntry,
  selectPoolEntry,
  selectPoolEntryAvoiding,
  exerciseAllowedByEquipment,
  normalizeLoadAcrossSiblings,
  type PoolEntry,
  type PoolSelection,
  type RotationContext,
  type AthletePoolPrefs,
} from '../data/exercisePoolsStrength';
import { buildWorkoutsFromCoach } from '../data/defaultProgram';
import { FULL_GYM_EQUIPMENT } from '../utils/equipmentAvailability';
import { resolveExerciseName } from '../utils/loadEstimation';

// ── R-083: A POOL MAY NOW ANSWER "NOTHING THIS KIT CAN DO" ─────────────────
//
// `selectPoolEntryAvoiding` returns an OUTCOME rather than an entry, because a
// slot the athlete's equipment cannot fill has to be REPRESENTABLE — that is
// the whole of the ruling. Every cell below this line is about a slot that CAN
// be filled, so this shim unwraps the outcome and makes a refusal a loud
// failure instead of a silently-undefined entry. The refusal itself is asserted
// in its own cell (14.15), against the outcome directly.
function pickPoolEntry(...args: Parameters<typeof selectPoolEntryAvoiding>): PoolEntry {
  const selection = selectPoolEntryAvoiding(...args);
  if (selection.kind === 'refused') {
    throw new Error(
      `selectPoolEntryAvoiding refused ${selection.slot}/${selection.role} `
      + `(${selection.cause}) — this cell expected a fillable slot`,
    );
  }
  return selection.entry;
}

// ─── Simple test runner ───

let pass = 0;
let fail = 0;
const failures: string[] = [];

function assert(condition: boolean, msg: string): void {
  if (condition) {
    pass++;
  } else {
    fail++;
    failures.push(msg);
    console.error(`  FAIL: ${msg}`);
  }
}

function section(title: string): void {
  console.log(`\n=== ${title} ===`);
}

// ─────────────────────────────────────────────────────────────────
// Section 1: Classification (explicit pool membership wins)
// ─────────────────────────────────────────────────────────────────
section('1. Classification');
{
  // Anchors
  const backSquat = classifyPoolSlot('Back Squat');
  assert(backSquat?.slot === 'squat' && backSquat?.role === 'anchor',
    'Back Squat → squat/anchor');

  const deadlift = classifyPoolSlot('Deadlift');
  assert(deadlift?.slot === 'hinge' && deadlift?.role === 'anchor',
    'Deadlift → hinge/anchor');

  // Upper split: horizontal vs vertical classification.
  const bench = classifyPoolSlot('Bench Press');
  assert(bench?.slot === 'horizontal_push' && bench?.role === 'anchor',
    'Bench Press → horizontal_push/anchor');

  const ohp = classifyPoolSlot('Overhead Press');
  assert(ohp?.slot === 'vertical_push' && ohp?.role === 'anchor',
    'Overhead Press → vertical_push/anchor');

  const barbellRow = classifyPoolSlot('Barbell Row');
  assert(barbellRow?.slot === 'horizontal_pull' && barbellRow?.role === 'anchor',
    'Barbell Row → horizontal_pull/anchor');

  const pullUps = classifyPoolSlot('Pull-Ups');
  assert(pullUps?.slot === 'vertical_pull' && pullUps?.role === 'anchor',
    'Pull-Ups → vertical_pull/anchor');

  // Accessories — pool membership must beat the tag-based heuristic
  // (DB Bench Press is tagged load='moderate' — heuristic would say anchor,
  //  but it's explicitly in the accessory pool, so findPoolEntry wins).
  const dbBench = classifyPoolSlot('DB Bench Press');
  assert(dbBench?.slot === 'horizontal_push' && dbBench?.role === 'accessory',
    'DB Bench Press → horizontal_push/accessory (explicit pool membership)');

  // DB Shoulder Press moved from upper_push → vertical_push in the split.
  // Tag-level movement is 'vertical_push', so pattern-routing lands it in
  // vertical_push/accessory cleanly.
  const dbShoulder = classifyPoolSlot('DB Shoulder Press');
  assert(dbShoulder?.slot === 'vertical_push' && dbShoulder?.role === 'accessory',
    'DB Shoulder Press → vertical_push/accessory (moved out of horizontal_push)');

  const cableRow = classifyPoolSlot('Seated Cable Row');
  assert(cableRow?.slot === 'horizontal_pull' && cableRow?.role === 'accessory',
    'Seated Cable Row → horizontal_pull/accessory (explicit pool membership)');

  const latPulldown = classifyPoolSlot('Lat Pulldown');
  assert(latPulldown?.slot === 'vertical_pull' && latPulldown?.role === 'accessory',
    'Lat Pulldown → vertical_pull/accessory');

  // New exercises padded into v_push / v_pull accessory pools.
  const zPress = classifyPoolSlot('Z-Press');
  assert(zPress?.slot === 'vertical_push' && zPress?.role === 'accessory',
    'Z-Press → vertical_push/accessory (new entry)');

  const neutralPulldown = classifyPoolSlot('Neutral-Grip Pulldown');
  assert(neutralPulldown?.slot === 'vertical_pull' && neutralPulldown?.role === 'accessory',
    'Neutral-Grip Pulldown → vertical_pull/accessory (new entry)');

  const straightArm = classifyPoolSlot(resolveExerciseName('Single-Arm Pulldown'));
  assert(straightArm?.slot === 'vertical_pull' && straightArm?.role === 'accessory',
    'legacy Single-Arm Pulldown resolves to the canonical vertical_pull/accessory');
  assert(!Object.values(STRENGTH_POOLS).some((group) =>
    [...group.anchor.entries, ...group.accessory.entries]
      .some((entry) => entry.name === 'Single-Arm Pulldown')),
    'the retired spelling is absent from current strength pools');

  const walkingLunges = classifyPoolSlot('Walking Lunges');
  assert(walkingLunges?.slot === 'squat' && walkingLunges?.role === 'accessory',
    'Walking Lunges → squat/accessory (lunge pattern)');

  // Expansion slots: carry / isolation_upper / plyo
  const farmerCarry = classifyPoolSlot('Farmer Carry');
  assert(farmerCarry?.slot === 'carry' && farmerCarry?.role === 'anchor',
    'Farmer Carry → carry/anchor');

  const suitcaseCarry = classifyPoolSlot('Suitcase Carry');
  assert(suitcaseCarry?.slot === 'carry' && suitcaseCarry?.role === 'accessory',
    'Suitcase Carry → carry/accessory');

  const shrugs = classifyPoolSlot('Shrugs');
  assert(shrugs?.slot === 'isolation_upper' && shrugs?.role === 'anchor',
    'Shrugs → isolation_upper/anchor');

  // Bicep Curl is tagged load='low' — heuristic would say accessory; also
  // explicitly placed as accessory. Both paths converge.
  const bicep = classifyPoolSlot('Bicep Curl (Dumbbell)');
  assert(bicep?.slot === 'isolation_upper' && bicep?.role === 'accessory',
    'Bicep Curl (Dumbbell) → isolation_upper/accessory');

  // Skull Crushers is tagged load='moderate' — heuristic would say anchor;
  // pool membership also puts it as anchor. Verifies explicit-pool path
  // for moderate-load isolation.
  const skullCrushers = classifyPoolSlot('Skull Crushers');
  assert(skullCrushers?.slot === 'isolation_upper' && skullCrushers?.role === 'anchor',
    'Skull Crushers → isolation_upper/anchor (explicit pool membership)');

  // Plyo is all load='low' — explicit pool membership is the only way to
  // resolve anchor vs accessory for bilateral (Box Jumps) vs shock (Depth
  // Jumps).
  const boxJumps = classifyPoolSlot('Box Jumps');
  assert(boxJumps?.slot === 'plyo' && boxJumps?.role === 'anchor',
    'Box Jumps → plyo/anchor (explicit pool membership — heuristic would miss this)');

  const depthJumps = classifyPoolSlot('Depth Jumps');
  assert(depthJumps?.slot === 'plyo' && depthJumps?.role === 'accessory',
    'Depth Jumps → plyo/accessory');

  // Unmanaged / unknown
  assert(classifyPoolSlot('Plank') === null, 'Plank → null (core pattern, unmanaged)');
  assert(classifyPoolSlot('Unknown Exercise Name XYZ') === null, 'Unknown exercise → null');
}

// ─────────────────────────────────────────────────────────────────
// Section 2: Pool integrity (every entry must be classifiable)
// ─────────────────────────────────────────────────────────────────
section('2. Pool integrity');
{
  // Slots whose anchor pool is INTENTIONALLY EMPTY (accessory-only slots).
  // Listed explicitly so accidental future emptiness (bug) still fails the
  // >=2-entries check.
  const ACCESSORY_ONLY_SLOTS: ReadonlySet<keyof typeof STRENGTH_POOLS> = new Set([
    'isolation_lower',
  ]);

  for (const slot of Object.keys(STRENGTH_POOLS) as (keyof typeof STRENGTH_POOLS)[]) {
    for (const role of ['anchor', 'accessory'] as const) {
      const pool = STRENGTH_POOLS[slot][role];
      const minEntries =
        role === 'anchor' && ACCESSORY_ONLY_SLOTS.has(slot) ? 0 : 2;
      assert(pool.entries.length >= minEntries,
        `${slot}/${role} has ≥${minEntries} entries (needed for rotation)`);

      for (const entry of pool.entries) {
        const classified = classifyPoolSlot(entry.name);
        assert(classified !== null && classified.slot === slot && classified.role === role,
          `${slot}/${role}: "${entry.name}" classifies back to itself`);

        const found = findPoolEntry(entry.name);
        assert(found !== null && found.slot === slot && found.role === role,
          `${slot}/${role}: "${entry.name}" findable via findPoolEntry`);

        assert(entry.loadRatio >= 0 && entry.loadRatio <= 1.5,
          `${slot}/${role}: "${entry.name}" loadRatio in sane range (${entry.loadRatio})`);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// Section 3: Anchor rotation cadence (mini-cycle)
// ─────────────────────────────────────────────────────────────────
section('3. Anchor rotation cadence');
{
  const squatAnchor = STRENGTH_POOLS.squat.anchor;
  const poolLen = squatAnchor.entries.length; // 3

  const mc1 = selectPoolEntry(squatAnchor, { miniCycleNumber: 1 });
  const mc2 = selectPoolEntry(squatAnchor, { miniCycleNumber: 2 });
  const mc3 = selectPoolEntry(squatAnchor, { miniCycleNumber: 3 });
  const mc4 = selectPoolEntry(squatAnchor, { miniCycleNumber: 4 });

  assert(mc1.name === squatAnchor.entries[0].name, `mc=1 → entries[0] (${mc1.name})`);
  assert(mc2.name === squatAnchor.entries[1].name, `mc=2 → entries[1] (${mc2.name})`);
  assert(mc3.name === squatAnchor.entries[2].name, `mc=3 → entries[2] (${mc3.name})`);
  // Derived, not "entries[0]": Sam's locked list added High Box Squat, so the
  // squat anchor is four deep and mc=4 no longer wraps. The cadence law is
  // (mc - 1) mod poolLen — asserting the law survives a pool resize.
  assert(mc4.name === squatAnchor.entries[(4 - 1) % poolLen].name,
    `mc=4 → entries[${(4 - 1) % poolLen}] (${mc4.name})`);

  // Anchor must be stable within a mini-cycle (weekInBlock has no effect)
  for (const wib of [1, 2, 3, 4]) {
    const pick = selectPoolEntry(squatAnchor, { miniCycleNumber: 2, weekInBlock: wib });
    assert(pick.name === mc2.name,
      `Anchor stable within mc=2 across weekInBlock=${wib} (got ${pick.name})`);
  }

  // No back-to-back: consecutive mini-cycles pick different names
  let prev = selectPoolEntry(squatAnchor, { miniCycleNumber: 1 }).name;
  for (let m = 2; m <= poolLen + 1; m++) {
    const curr = selectPoolEntry(squatAnchor, { miniCycleNumber: m }).name;
    assert(curr !== prev, `mc=${m} (${curr}) ≠ mc=${m-1} (${prev})`);
    prev = curr;
  }
}

// ─────────────────────────────────────────────────────────────────
// Section 4: Accessory rotation cadence (week-in-block)
// ─────────────────────────────────────────────────────────────────
section('4. Accessory rotation cadence');
{
  const squatAccessory = STRENGTH_POOLS.squat.accessory;
  const poolLen = squatAccessory.entries.length; // 4

  // Within block 1, each week picks a different accessory
  const w1 = selectPoolEntry(squatAccessory, { miniCycleNumber: 1, weekInBlock: 1 });
  const w2 = selectPoolEntry(squatAccessory, { miniCycleNumber: 1, weekInBlock: 2 });
  const w3 = selectPoolEntry(squatAccessory, { miniCycleNumber: 1, weekInBlock: 3 });
  const w4 = selectPoolEntry(squatAccessory, { miniCycleNumber: 1, weekInBlock: 4 });

  assert(w1.name === squatAccessory.entries[0].name, `w=1 → entries[0] (${w1.name})`);
  assert(w2.name === squatAccessory.entries[1].name, `w=2 → entries[1] (${w2.name})`);
  assert(w3.name === squatAccessory.entries[2].name, `w=3 → entries[2] (${w3.name})`);
  assert(w4.name === squatAccessory.entries[3].name, `w=4 → entries[3] (${w4.name})`);

  const weekNames = [w1.name, w2.name, w3.name, w4.name];
  const uniqueWeeks = new Set(weekNames);
  assert(uniqueWeeks.size === 4, `All 4 weeks produce unique accessories within block 1`);

  // No back-to-back across weeks within the same block
  for (let i = 1; i < weekNames.length; i++) {
    assert(weekNames[i] !== weekNames[i - 1],
      `Week ${i + 1} (${weekNames[i]}) ≠ week ${i} (${weekNames[i - 1]})`);
  }

  // Cross-block: start of block 2 should differ from end of block 1
  const b1w4 = selectPoolEntry(squatAccessory, { miniCycleNumber: 1, weekInBlock: 4 });
  const b2w1 = selectPoolEntry(squatAccessory, { miniCycleNumber: 2, weekInBlock: 1 });
  assert(b1w4.name !== b2w1.name,
    `Block-boundary no-repeat: w4/b1 (${b1w4.name}) ≠ w1/b2 (${b2w1.name})`);
}

// ─────────────────────────────────────────────────────────────────
// Section 5: Load normalization
// ─────────────────────────────────────────────────────────────────
section('5. Load normalization across siblings');
{
  // Back Squat (1.00) → Front Squat (0.85): 100 kg * 0.85 = 85 kg
  const bs2fs = normalizeLoadAcrossSiblings(100, 'Back Squat', 'Front Squat');
  assert(Math.abs(bs2fs - 85) < 0.01,
    `Back Squat 100kg → Front Squat ${bs2fs.toFixed(1)} kg (expected 85)`);

  // Front Squat (0.85) → Back Squat (1.00): 85 kg * (1.00/0.85) ≈ 100 kg
  const fs2bs = normalizeLoadAcrossSiblings(85, 'Front Squat', 'Back Squat');
  assert(Math.abs(fs2bs - 100) < 0.01,
    `Front Squat 85kg → Back Squat ${fs2bs.toFixed(1)} kg (expected 100)`);

  // Same name is identity
  const same = normalizeLoadAcrossSiblings(100, 'Back Squat', 'Back Squat');
  assert(same === 100, `Same name → identity (${same})`);

  // Different slot: no translation
  const crossSlot = normalizeLoadAcrossSiblings(100, 'Back Squat', 'Bench Press');
  assert(crossSlot === 100, `Different slot → unchanged (${crossSlot})`);

  // Cross-sub-pattern (horizontal ↔ vertical) is intentionally blocked after
  // the upper split — Bench Press and Overhead Press live in different slots
  // now, so no load transfer. A 100kg Bench Press must NOT seed a 100kg OHP.
  const hv_push = normalizeLoadAcrossSiblings(100, 'Bench Press', 'Overhead Press');
  assert(hv_push === 100,
    `Cross-sub-pattern (h_push → v_push) unchanged (${hv_push}) — upper split blocks transfer`);

  const hv_pull = normalizeLoadAcrossSiblings(80, 'Barbell Row', 'Pull-Ups');
  assert(hv_pull === 80,
    `Cross-sub-pattern (h_pull → v_pull) unchanged (${hv_pull}) — upper split blocks transfer`);

  // Within-sub-pattern transfer still works (Bench → Incline Bench, same h_push slot)
  const withinHPush = normalizeLoadAcrossSiblings(100, 'Bench Press', 'Incline Bench');
  assert(Math.abs(withinHPush - 85) < 0.01,
    `Bench Press 100kg → Incline Bench ${withinHPush.toFixed(1)}kg (within h_push, expected 85)`);

  // Different role (anchor vs accessory): no translation
  const crossRole = normalizeLoadAcrossSiblings(100, 'Back Squat', 'Walking Lunges');
  assert(crossRole === 100, `Different role → unchanged (${crossRole})`);

  // Bodyweight entry (loadRatio = 0): no translation
  const bodyweight = normalizeLoadAcrossSiblings(100, 'Bench Press', 'Push-ups');
  assert(bodyweight === 100, `Bodyweight (Push-ups) → unchanged (${bodyweight})`);

  // Unknown exercise: no translation
  const unknown = normalizeLoadAcrossSiblings(100, 'Back Squat', 'NotAnExercise');
  assert(unknown === 100, `Unknown exercise → unchanged (${unknown})`);
}

// ─────────────────────────────────────────────────────────────────
// Section 6: Within-session avoidance
// ─────────────────────────────────────────────────────────────────
section('6. Within-session avoidance');
{
  const squatAccessory = STRENGTH_POOLS.squat.accessory;
  const ctx: RotationContext = { miniCycleNumber: 1, weekInBlock: 1 };

  const first = pickPoolEntry(squatAccessory, ctx, new Set());
  const second = pickPoolEntry(squatAccessory, ctx, new Set([first.name]));
  assert(second.name !== first.name,
    `Avoidance: second pick (${second.name}) ≠ first (${first.name})`);

  const third = pickPoolEntry(squatAccessory, ctx, new Set([first.name, second.name]));
  assert(third.name !== first.name && third.name !== second.name,
    `Avoidance: third pick (${third.name}) differs from first two`);

  // When every entry is avoided, fall back deterministically
  const allNames = new Set(squatAccessory.entries.map(e => e.name));
  const fallback = pickPoolEntry(squatAccessory, ctx, allNames);
  assert(fallback.name === squatAccessory.entries[0].name,
    `Avoidance fallback → rotation-indexed entry (${fallback.name})`);
}

// ─────────────────────────────────────────────────────────────────
// Section 7: DELETED (B1-PIVOT, 2026-08-14)
//
// Every cell here had `applyPoolRotation` as its SUBJECT — name rewriting,
// pass-through for unmanaged names, and the `${slot}:${role}` within-session
// tracker. The function is deleted and nothing rewrites a suggested name, so
// these are exclusively-associated tests with nothing left to describe.
// The surviving halves are asserted elsewhere against live functions:
// classification in section 1, rotation cadence in sections 3/4, within-session
// avoidance in section 6 (against `selectPoolEntryAvoiding` directly).
// ─────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────
// Section 8: buildWorkoutsFromCoach integration
// ─────────────────────────────────────────────────────────────────
section('8. buildWorkoutsFromCoach integration');
{
  const aiExercises = [
    { name: 'Back Squat', sets: 4, repsMin: 3, repsMax: 3 },
    { name: 'Walking Lunges', sets: 3, repsMin: 8, repsMax: 10 },
    // A curated, non-pool name: it must pass rotation through untouched. It has
    // to be a name the app can actually CUE — the acceptance-time vocabulary
    // contract now refuses a program carrying one it cannot (device run 5), and
    // the app has no cue for a plain front 'Plank' (tracked in the master census
    // as a curation gap for Sam, not a defect in this test).
    { name: 'Side Plank', sets: 3, repsMin: 30, repsMax: 30 },
  ];
  const coachWorkout = {
    dayOfWeek: 1,
    name: 'Lower Strength',
    workoutType: 'Strength',
    sessionTier: 'core' as const,
    exercises: aiExercises,
  };

  // With no rotation context → names preserved (backwards compat)
  const defaultOut = buildWorkoutsFromCoach([coachWorkout], 'mc-test');
  const defaultNames = defaultOut[0].exercises.map((e: any) => e.exercise?.name);
  assert(defaultNames[0] === 'Back Squat',
    `No rotationContext: Back Squat preserved (got ${defaultNames[0]})`);
  assert(defaultNames[1] === 'Walking Lunges',
    `No rotationContext: Walking Lunges preserved (got ${defaultNames[1]})`);

  // With mc=2 → anchor rotates to the mc=2 pick
  const rotated = buildWorkoutsFromCoach(
    [coachWorkout],
    'mc-test',
    undefined,
    undefined,
    { miniCycleNumber: 2, weekInBlock: 1 },
  );
  const rotatedNames = rotated[0].exercises.map((e: any) => e.exercise?.name);
  const expectedAnchor = STRENGTH_POOLS.squat.anchor.entries[1].name;
  // Accessory base index at mc=2, w=1 = (2-1)*4 + (1-1) = 4, taken modulo the
  // pool size. Derived rather than hard-coded: this assertion previously
  // assumed a 4-entry pool and broke the moment Sam's approved accessories
  // were added, which is a property of the test, not of the rotation.
  const squatAccessories = STRENGTH_POOLS.squat.accessory.entries;
  const expectedAccessory = squatAccessories[4 % squatAccessories.length].name;
  // RETIRED (B1-PIVOT, 2026-08-14) — these two asserted that GENERATION rewrites
  // a row through `applyPoolRotation`, an invocation this slice deleted.
  // REPLACED BY: `test:composer-severance` "the main lift varies across blocks"
  // + "and it is deterministic per block", mutation-proven red (MUT-6).
  // `applyPoolRotation` ITSELF has since been DELETED (2026-08-14) — it had no
  // production caller left once this invocation went — so its own cells are
  // gone too. See the header note.
  void expectedAnchor; void expectedAccessory;

  // Side Plank (unmanaged) passes through regardless of context
  assert(rotatedNames[2] === 'Side Plank',
    `Non-pool Side Plank preserved under rotation (got ${rotatedNames[2]})`);
}

// ─────────────────────────────────────────────────────────────────
// Section 9: Anchor stable through full 4-week block (integration)
// ─────────────────────────────────────────────────────────────────
section('9. Anchor stable across block weeks; accessory varies');
{
  const aiEx = [
    { name: 'Bench Press', sets: 5, repsMin: 5, repsMax: 5 },
    { name: 'DB Bench Press', sets: 3, repsMin: 8, repsMax: 10 },
  ];
  const coachWorkout = {
    dayOfWeek: 1,
    name: 'Upper Strength',
    workoutType: 'Strength',
    sessionTier: 'core' as const,
    exercises: aiEx,
  };

  const anchorsSeen = new Set<string>();
  const accessoriesSeen: string[] = [];
  for (let w = 1; w <= 4; w++) {
    const out = buildWorkoutsFromCoach(
      [coachWorkout],
      'mc-test',
      undefined,
      undefined,
      { miniCycleNumber: 3, weekInBlock: w },
    );
    anchorsSeen.add(out[0].exercises[0].exercise?.name);
    accessoriesSeen.push(out[0].exercises[1].exercise?.name);
  }
  assert(anchorsSeen.size === 1,
    `Anchor stable across 4 weeks of block mc=3 (saw ${anchorsSeen.size} distinct)`);
  // RETIRED (B1-PIVOT) — same deleted invocation. REPLACED BY the same two
  // composer variety cells, mutation-proven red (MUT-6).
  void accessoriesSeen;
}

// ─────────────────────────────────────────────────────────────────
// Section 10: Expansion slot rotation (carry / isolation_upper / plyo)
// ─────────────────────────────────────────────────────────────────
section('10. Expansion slot rotation');
{
  const expansionSlots: Array<keyof typeof STRENGTH_POOLS> = [
    'carry', 'isolation_upper', 'plyo',
  ];

  for (const slot of expansionSlots) {
    const anchor = STRENGTH_POOLS[slot].anchor;
    const accessory = STRENGTH_POOLS[slot].accessory;

    // Anchor stable within a mini-cycle
    const mc1 = selectPoolEntry(anchor, { miniCycleNumber: 1 });
    for (const wib of [1, 2, 3, 4]) {
      const pick = selectPoolEntry(anchor, { miniCycleNumber: 1, weekInBlock: wib });
      assert(pick.name === mc1.name,
        `${slot}/anchor stable within mc=1 across w=${wib} (${pick.name})`);
    }

    // Anchor rotates across at least two mini-cycles (no back-to-back)
    const mc2 = selectPoolEntry(anchor, { miniCycleNumber: 2 });
    assert(mc2.name !== mc1.name,
      `${slot}/anchor rotates mc=1→mc=2 (${mc1.name} → ${mc2.name})`);

    // Anchor walks the full pool within N mini-cycles
    const anchorSeen = new Set<string>();
    for (let m = 1; m <= anchor.entries.length; m++) {
      anchorSeen.add(selectPoolEntry(anchor, { miniCycleNumber: m }).name);
    }
    assert(anchorSeen.size === anchor.entries.length,
      `${slot}/anchor walks full pool in ${anchor.entries.length} mini-cycles (saw ${anchorSeen.size})`);

    // Accessory rotates within a block (if pool has ≥2 entries, first two
    // weeks differ)
    if (accessory.entries.length >= 2) {
      const w1 = selectPoolEntry(accessory, { miniCycleNumber: 1, weekInBlock: 1 });
      const w2 = selectPoolEntry(accessory, { miniCycleNumber: 1, weekInBlock: 2 });
      assert(w1.name !== w2.name,
        `${slot}/accessory rotates w=1→w=2 (${w1.name} → ${w2.name})`);
    }
  }

  // Plyo-specific: loadRatio is 0 for all entries → normalizeLoadAcrossSiblings
  // must treat as fresh exposure (see bodyweight guard). A Box Jumps → Broad
  // Jumps swap should NOT multiply a spurious load.
  const plyoSwap = normalizeLoadAcrossSiblings(0, 'Box Jumps', 'Broad Jumps');
  assert(plyoSwap === 0,
    `Plyo swap with bodyweight (0kg) stays 0 (got ${plyoSwap})`);

  // Carry-specific. Load transfer only applies WITHIN a (slot, role) pair, so
  // the pairing is retuned to same-role carries after the four-carry
  // restructure: heavy handles anchor (Farmer/Bear), lighter unilateral and
  // overhead carries accessory (Suitcase/Overhead).
  const carrySwap = normalizeLoadAcrossSiblings(40, 'Farmer Carry', 'Bear Carry');
  assert(Math.abs(carrySwap - 30) < 0.01,
    `Farmer Carry 40kg → Bear Carry ${carrySwap.toFixed(1)}kg (expected 30)`);
  const carryAccessorySwap = normalizeLoadAcrossSiblings(30, 'Suitcase Carry', 'Overhead Carry');
  assert(Math.abs(carryAccessorySwap - 27.5) < 0.01,
    `Suitcase Carry 30kg → Overhead Carry ${carryAccessorySwap.toFixed(1)}kg (expected 27.5)`);
  // Cross-role carries deliberately do NOT transfer — different job, different load.
  assert(normalizeLoadAcrossSiblings(40, 'Farmer Carry', 'Overhead Carry') === 40,
    'Farmer (anchor) → Overhead (accessory) is a fresh exposure, not a transfer');

  // Isolation_upper-specific: Shrugs (1.00) → Skull Crushers (0.35): 100kg → 35kg
  const isoSwap = normalizeLoadAcrossSiblings(100, 'Shrugs', 'Skull Crushers');
  assert(Math.abs(isoSwap - 35) < 0.01,
    `Shrugs 100kg → Skull Crushers ${isoSwap.toFixed(1)}kg (expected 35)`);

  // Cross-slot guard still holds under expansion (Back Squat → Farmer Carry
  // must NOT translate)
  const crossSlotExpansion = normalizeLoadAcrossSiblings(100, 'Back Squat', 'Farmer Carry');
  assert(crossSlotExpansion === 100,
    `Cross-slot (squat → carry) unchanged (${crossSlotExpansion})`);
}

// ─────────────────────────────────────────────────────────────────
// Section 11: DELETED (B1-PIVOT, 2026-08-14)
//
// Its subject was `applyPoolRotation` applied to the expansion slots — name
// rewriting for carry / plyo / isolation_upper, plus that function's own
// `${slot}:${role}` session tracker. The function is deleted.
//
// NOTHING LIVE WAS LOST. Section 10 above already asserts expansion-slot anchor
// stability, cross-mini-cycle rotation and the full-pool walk against
// `selectPoolEntry` itself; section 6 asserts within-session avoidance against
// `selectPoolEntryAvoiding` itself, and section 12 does so again on a deeper
// pool.
// ─────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────
// Section 12: Isolation_lower (accessory-only slot)
// ─────────────────────────────────────────────────────────────────
section('12. Isolation_lower (accessory-only slot)');
{
  // Shape: anchor pool is intentionally empty; the accessory pool carries the
  // rehab/prehab movements. Sam's locked list (2026-07-24) added Hamstring
  // Curl, Single-Leg Hip Thrust and Back Extension, and retired Adductor
  // Machine, taking it from five to seven.
  const anchor = STRENGTH_POOLS.isolation_lower.anchor;
  const accessory = STRENGTH_POOLS.isolation_lower.accessory;
  assert(anchor.entries.length === 0,
    `isolation_lower/anchor is empty (accessory-only slot, got ${anchor.entries.length})`);
  assert(accessory.entries.length === 7,
    `isolation_lower/accessory has 7 entries (got ${accessory.entries.length})`);

  // Every canonical name classifies to isolation_lower/accessory
  const ISO_LOWER_NAMES = [
    'Nordic Lower', 'Hamstring Curl', 'Leg Extension',
    'Calf Raises', 'Tib Raises',
    'Single-Leg Hip Thrust', 'Back Extension',
  ];
  for (const name of ISO_LOWER_NAMES) {
    const classified = classifyPoolSlot(name);
    assert(classified?.slot === 'isolation_lower' && classified?.role === 'accessory',
      `${name} → isolation_lower/accessory`);
  }

  // Tag-heuristic guard: any isolation_* pattern forces accessory role even
  // when load is moderate/high. Nordic Lower is tagged movement='isolation_lower'
  // with eccentric='high'/doms='high' — classification must force accessory, not
  // fall into the load-heuristic anchor path. (Nordic Lower is explicitly in the
  // pool, so findPoolEntry wins, but this assertion guards the heuristic path
  // independently in case a future entry gets removed from the pool.)
  const nordic = classifyPoolSlot('Nordic Lower');
  assert(nordic?.role === 'accessory',
    `Nordic Lower → accessory despite high DOMS/eccentric tags (got ${nordic?.role})`);

  // Rotation walks the 5-item pool across 5 mini-cycles (using weekInBlock=1
  // to drive deterministic indexing — accessory rotation uses mc*4 + (w-1);
  // indices (0, 4, 8, 12, 16) mod 5 = (0, 4, 3, 2, 1) — 5 distinct).
  const seen = new Set<string>();
  for (let mc = 1; mc <= 5; mc++) {
    const pick = selectPoolEntry(accessory, { miniCycleNumber: mc, weekInBlock: 1 });
    seen.add(pick.name);
  }
  // To walk the first 4 consecutive entries within a block, rotate weekInBlock:
  const blockWalk = new Set<string>();
  for (let w = 1; w <= 4; w++) {
    const pick = selectPoolEntry(accessory, { miniCycleNumber: 1, weekInBlock: w });
    blockWalk.add(pick.name);
  }
  assert(blockWalk.size === 4,
    `isolation_lower/accessory: 4 distinct picks across weeks 1-4 of a block (got ${blockWalk.size}: ${Array.from(blockWalk).join(', ')})`);

  // Within-session avoidance: 3 iso_lower rows in one session resolve to 3
  // distinct picks (pool is 7 deep → plenty of room).
  //
  // REWIRED (B1-PIVOT, 2026-08-14) — this asked `applyPoolRotation` three times
  // with a shared session tracker. That function is deleted; the AVOIDANCE it
  // was exercising belongs to `selectPoolEntryAvoiding`, which is asked directly
  // now with the caller accumulating what it has already used. The assertion is
  // unchanged: 3 rows out of one (slot, role) must be 3 different exercises.
  const isoCtx: RotationContext = { miniCycleNumber: 1, weekInBlock: 1 };
  const isoUsed = new Set<string>();
  const pick1 = pickPoolEntry(accessory, isoCtx, isoUsed).name;
  isoUsed.add(pick1);
  const pick2 = pickPoolEntry(accessory, isoCtx, isoUsed).name;
  isoUsed.add(pick2);
  const pick3 = pickPoolEntry(accessory, isoCtx, isoUsed).name;
  assert(pick1 !== pick2 && pick2 !== pick3 && pick1 !== pick3,
    `3 iso_lower rows in same session → 3 distinct picks (${pick1} / ${pick2} / ${pick3})`);

  // Load normalization: all loadRatio=0 (plyo-style bodyweight guard) →
  // any cross-sibling translation returns input unchanged.
  const isoSwap = normalizeLoadAcrossSiblings(20, 'Nordic Lower', 'Leg Extension');
  assert(isoSwap === 20,
    `Nordic Lower 20kg → Leg Extension ${isoSwap}kg (loadRatio=0 guard, expected unchanged)`);

  // Cross-slot guard holds: squat → isolation_lower must NOT translate.
  const crossToIso = normalizeLoadAcrossSiblings(100, 'Back Squat', 'Nordic Lower');
  assert(crossToIso === 100,
    `Cross-slot (squat → isolation_lower) unchanged (${crossToIso})`);

  // ⚠ THE MUSCLE-GROUP ROTATION CELL IS DELETED (B1-PIVOT, 2026-08-14) — AND
  // WHAT IT GUARDED NOW HAS NOBODY.
  //
  // It asserted that rotating `Nordic Lower` at mc=2 lands on another HAMSTRING
  // rather than crossing into a calf raise. **That narrowing lived entirely
  // inside `applyPoolRotation`** (`suggestedGroup` → filter the pool to the same
  // `PoolEntry.group` → release it only when every in-group candidate is already
  // used). `selectPoolEntry` and `selectPoolEntryAvoiding` have never read
  // `group` at all — they pick `cycleIndex % entries.length` straight across the
  // slot, which is the exact defect the narrowing was built to stop. So there is
  // no live function to re-point this cell at, and re-pointing it would assert
  // the DEFECT.
  //
  // The group DATA is still asserted below (section "Muscle-group data"), so a
  // future reader inherits a correct table.
  const hamstrings = accessory.entries.filter((e) => e.group === 'hamstring').map((e) => e.name);
  assert(hamstrings.length >= 2,
    `isolation_lower/accessory carries >=2 'hamstring' entries (got ${hamstrings.length})`);
}

// ─────────────────────────────────────────────────────────────────
// Section 13: Upper sub-slot split (h_push / v_push / h_pull / v_pull)
//
// Apr 2026 refinement. Verifies:
//   - Each sub-slot has a functional anchor + accessory rotation.
//   - Option A routing: AI-suggested Bench Press stays in h_push, OHP stays
//     in v_push — the rotation never crosses the horizontal/vertical axis.
//   - Within-session avoidance operates per (sub_slot, role), so Bench Press
//     + DB Shoulder Press in one session route to separate pools cleanly.
// ─────────────────────────────────────────────────────────────────
section('13. Upper sub-slot split (h_push / v_push / h_pull / v_pull)');
{
  const UPPER_SUB_SLOTS: Array<keyof typeof STRENGTH_POOLS> = [
    'horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull',
  ];

  for (const slot of UPPER_SUB_SLOTS) {
    const anchor = STRENGTH_POOLS[slot].anchor;
    const accessory = STRENGTH_POOLS[slot].accessory;

    // Pool-integrity sanity — every upper sub-slot has at least 2 anchors
    // and at least 3 accessories (we padded v_push and v_pull specifically
    // so rotation is meaningful from day one).
    assert(anchor.entries.length >= 2,
      `${slot}/anchor has ≥2 entries (got ${anchor.entries.length})`);
    assert(accessory.entries.length >= 3,
      `${slot}/accessory has ≥3 entries (got ${accessory.entries.length})`);

    // Anchor stable within a mini-cycle across all 4 weeks
    const mc1Anchor = selectPoolEntry(anchor, { miniCycleNumber: 1 }).name;
    for (const w of [1, 2, 3, 4]) {
      const pick = selectPoolEntry(anchor, { miniCycleNumber: 1, weekInBlock: w }).name;
      assert(pick === mc1Anchor,
        `${slot}/anchor stable within mc=1 w=${w} (got ${pick})`);
    }

    // Anchor rotates mc=1 → mc=2
    const mc2Anchor = selectPoolEntry(anchor, { miniCycleNumber: 2 }).name;
    assert(mc2Anchor !== mc1Anchor,
      `${slot}/anchor rotates mc=1→mc=2 (${mc1Anchor} → ${mc2Anchor})`);

    // Accessory rotates across 4 weeks — min(4, poolLen) distinct picks
    const weekPicks = [1, 2, 3, 4].map(w =>
      selectPoolEntry(accessory, { miniCycleNumber: 1, weekInBlock: w }).name);
    const expectedDistinct = Math.min(4, accessory.entries.length);
    assert(new Set(weekPicks).size === expectedDistinct,
      `${slot}/accessory ${expectedDistinct} distinct picks across 4 weeks (got ${new Set(weekPicks).size}: ${weekPicks.join(', ')})`);
  }

  // Option A routing contract: a push session naming Bench Press + DB Shoulder
  // Press routes to (h_push, anchor) + (v_push, accessory) — the rotation never
  // crosses the horizontal/vertical axis.
  //
  // REWIRED (B1-PIVOT, 2026-08-14) — these four asked `applyPoolRotation`, which
  // is deleted. The routing they assert is `classifyPoolSlot` + `selectPoolEntry`,
  // both live, so each is asked in two steps instead of one: WHICH pool does this
  // name belong to, and WHAT does that pool select for this context. The
  // classification half is the part that could regress (an OHP leaking into
  // h_push), and it is still asserted, name by name.
  //
  // DROPPED WITH THE FUNCTION: the `usedInSession` cell asserting the tracker
  // keyed `'horizontal_push:anchor'` / `'vertical_push:accessory'` separately.
  // That map was `applyPoolRotation`'s own bookkeeping and has no live owner —
  // `selectPoolEntryAvoiding` takes a plain avoid-set and never keys by slot.
  const routeAndSelect = (name: string, ctx: RotationContext) => {
    const routed = classifyPoolSlot(name);
    if (!routed) throw new Error(`${name} classified to nothing — fixture is wrong`);
    return {
      slot: routed.slot,
      role: routed.role,
      pick: selectPoolEntry(STRENGTH_POOLS[routed.slot][routed.role], ctx).name,
    };
  };
  const mc2w1: RotationContext = { miniCycleNumber: 2, weekInBlock: 1 };

  // Bench Press stays on the horizontal axis and rotates within h_push/anchor
  // to entries[1] = Incline Bench.
  const benchRoute = routeAndSelect('Bench Press', mc2w1);
  assert(benchRoute.slot === 'horizontal_push' && benchRoute.role === 'anchor',
    `Bench Press routes to h_push/anchor (got ${benchRoute.slot}/${benchRoute.role})`);
  const expectedHPushAnchor = STRENGTH_POOLS.horizontal_push.anchor.entries[1].name;
  assert(benchRoute.pick === expectedHPushAnchor,
    `Bench Press in mc=2 selects h_push/anchor entries[1] (got ${benchRoute.pick}, expected ${expectedHPushAnchor})`);

  // DB Shoulder Press stays on the vertical axis. v_push/accessory at mc=2/w=1:
  // base = (2-1)*4 + 0 = 4 → entries[4 % poolLen].
  const shoulderRoute = routeAndSelect('DB Shoulder Press', mc2w1);
  assert(shoulderRoute.slot === 'vertical_push' && shoulderRoute.role === 'accessory',
    `DB Shoulder Press routes to v_push/accessory (got ${shoulderRoute.slot}/${shoulderRoute.role})`);
  const vPushAccLen = STRENGTH_POOLS.vertical_push.accessory.entries.length;
  const expectedVPushIdx = 4 % vPushAccLen;
  const expectedVPushAccessory = STRENGTH_POOLS.vertical_push.accessory.entries[expectedVPushIdx].name;
  assert(shoulderRoute.pick === expectedVPushAccessory,
    `DB Shoulder Press in mc=2 w=1 selects v_push/accessory entries[${expectedVPushIdx}] (got ${shoulderRoute.pick}, expected ${expectedVPushAccessory})`);

  // The two names land in DIFFERENT slots — this is the no-cross-axis claim, and
  // it is what the old tracker-key assertion was really standing in for.
  assert(benchRoute.slot !== shoulderRoute.slot,
    `Bench Press and DB Shoulder Press route to different slots (both ${benchRoute.slot})`);

  // Same for pull: Barbell Row + Pull-Ups in one session → h_pull + v_pull
  const mc1w1: RotationContext = { miniCycleNumber: 1, weekInBlock: 1 };
  const rowRoute = routeAndSelect('Barbell Row', mc1w1);
  const pullupRoute = routeAndSelect('Pull-Ups', mc1w1);
  assert(rowRoute.slot === 'horizontal_pull' && rowRoute.role === 'anchor',
    `Barbell Row routes to h_pull/anchor (got ${rowRoute.slot}/${rowRoute.role})`);
  assert(pullupRoute.slot === 'vertical_pull' && pullupRoute.role === 'anchor',
    `Pull-Ups routes to v_pull/anchor (got ${pullupRoute.slot}/${pullupRoute.role})`);
  // mc=1 anchor → entries[0]
  assert(rowRoute.pick === STRENGTH_POOLS.horizontal_pull.anchor.entries[0].name,
    `Barbell Row mc=1 → h_pull/anchor entries[0] (got ${rowRoute.pick})`);
  assert(pullupRoute.pick === STRENGTH_POOLS.vertical_pull.anchor.entries[0].name,
    `Pull-Ups mc=1 → v_pull/anchor entries[0] (got ${pullupRoute.pick})`);

  // Within-sub-pattern load transfer still works (Bench Press 100kg → Incline
  // Bench 85kg is the classic case for the h_push slot).
  const benchToIncline = normalizeLoadAcrossSiblings(100, 'Bench Press', 'Incline Bench');
  assert(Math.abs(benchToIncline - 85) < 0.01,
    `Bench Press 100kg → Incline Bench ${benchToIncline.toFixed(1)}kg (within h_push, expected 85)`);

  // v_pull internal: Pull-Ups → Chin-Ups both ratio 1.00 → identity transfer
  const pullToChin = normalizeLoadAcrossSiblings(10, 'Pull-Ups', 'Chin-Ups');
  assert(pullToChin === 10,
    `Pull-Ups 10kg → Chin-Ups ${pullToChin}kg (both loadRatio 1.00, expected 10)`);
}

// ─────────────────────────────────────────────────────────────────
// Section 14: Athlete overrides (prefs filter / bias)
// ─────────────────────────────────────────────────────────────────
// Per-athlete overrides — exclusion, pinning, active-injury filter/caution —
// fold into selectPoolEntryAvoiding BEFORE the rotation walk. When prefs
// are absent (or every field empty), behaviour is the refinement-2 baseline.
//
// Baseline for these tests: squat anchor pool = [Back Squat, Front Squat,
// Box Squat]. mc=1 anchor picks entries[0] = Back Squat.
//   Back Squat  : shoulder=caution, lowerBack=avoid, pubalgia=avoid, knee=caution
//   Front Squat : shoulder=good,    lowerBack=caution, wrist=caution
//   Box Squat   : shoulder=good,    lowerBack=caution, pubalgia=caution
section('14. Athlete overrides (prefs filter / bias)');
{
  const squatAnchor = STRENGTH_POOLS.squat.anchor;
  const ctx: RotationContext = { miniCycleNumber: 1, weekInBlock: 1 };
  const emptyAvoid: ReadonlySet<string> = new Set();

  // ── 14.1 Empty prefs == no-op (back-compat contract) ──
  const noPrefsPick = pickPoolEntry(squatAnchor, ctx, emptyAvoid);
  const emptyPrefsPick = pickPoolEntry(
    squatAnchor, ctx, emptyAvoid, { excluded: [], pinned: [] });
  assert(noPrefsPick.name === emptyPrefsPick.name,
    `Empty prefs == no prefs (got "${emptyPrefsPick.name}" vs "${noPrefsPick.name}")`);
  assert(emptyPrefsPick.name === 'Back Squat',
    `Empty prefs: mc=1 squat anchor = Back Squat (got "${emptyPrefsPick.name}")`);

  // ── 14.2 Exclusion drops the entry ──
  const exclBackSquat: AthletePoolPrefs = { excluded: ['Back Squat'], pinned: [] };
  const exclPick = pickPoolEntry(squatAnchor, ctx, emptyAvoid, exclBackSquat);
  assert(exclPick.name === 'Front Squat',
    `Excluding Back Squat → mc=1 falls to Front Squat (got "${exclPick.name}")`);

  // Excluding the rotation pick across 3 mc's walks through the remaining entries.
  const mc2 = pickPoolEntry(
    squatAnchor, { miniCycleNumber: 2, weekInBlock: 1 }, emptyAvoid, exclBackSquat);
  const mc3 = pickPoolEntry(
    squatAnchor, { miniCycleNumber: 3, weekInBlock: 1 }, emptyAvoid, exclBackSquat);
  // Effective pool after excluding Back Squat: [Front Squat, Box Squat, High Box Squat]
  // mc=1 → idx 0 = Front Squat; mc=2 → idx 1 = Box Squat; mc=3 → idx 2 = High Box Squat
  assert(mc2.name === 'Box Squat',
    `Exclusion: mc=2 → Box Squat (got "${mc2.name}")`);
  assert(mc3.name === 'High Box Squat',
    `Exclusion: mc=3 → High Box Squat (got "${mc3.name}")`);

  // ── 14.3 Pinned floats to rotation-start ──
  const pinBox: AthletePoolPrefs = { excluded: [], pinned: ['Box Squat'] };
  const pinPick = pickPoolEntry(squatAnchor, ctx, emptyAvoid, pinBox);
  assert(pinPick.name === 'Box Squat',
    `Pinning Box Squat → mc=1 picks it first (got "${pinPick.name}")`);

  // ── 14.4 Exclusion wins over pinning (conflict resolution) ──
  const conflict: AthletePoolPrefs = {
    excluded: ['Box Squat'],
    pinned: ['Box Squat'],
  };
  const conflictPick = pickPoolEntry(squatAnchor, ctx, emptyAvoid, conflict);
  assert(conflictPick.name !== 'Box Squat',
    `Exclusion wins over pinning: Box Squat absent (got "${conflictPick.name}")`);
  assert(conflictPick.name === 'Back Squat',
    `Conflict: effective pool [Back Squat, Front Squat]; mc=1 → Back Squat (got "${conflictPick.name}")`);

  // ── 14.5 Injury-avoid filter drops entries with matching 'avoid' tags ──
  // Back Squat has lowerBack='avoid'; Front Squat & Box Squat have 'caution'.
  const injLowerBack: AthletePoolPrefs = {
    excluded: [], pinned: [],
    activeInjuries: ['lowerBack'],
  };
  const injPick = pickPoolEntry(squatAnchor, ctx, emptyAvoid, injLowerBack);
  assert(injPick.name !== 'Back Squat',
    `activeInjuries=['lowerBack'] drops Back Squat (got "${injPick.name}")`);
  // Of Front Squat & Box Squat, both are 'caution' for lowerBack — relative order
  // preserved (Front Squat before Box Squat in pool definition), so mc=1 picks Front Squat.
  assert(injPick.name === 'Front Squat',
    `Injury-avoid: mc=1 falls to Front Squat (got "${injPick.name}")`);

  // ── 14.6 Injury-caution deprioritized (stable sort after 'good') ──
  // shoulder: Back Squat='caution', Front Squat='good', Box Squat='good'.
  // Expected effective order: [Front Squat, Box Squat, Back Squat].
  const injShoulder: AthletePoolPrefs = {
    excluded: [], pinned: [],
    activeInjuries: ['shoulder'],
  };
  const cautionMc1 = pickPoolEntry(squatAnchor, ctx, emptyAvoid, injShoulder);
  const cautionMc2 = pickPoolEntry(
    squatAnchor, { miniCycleNumber: 2, weekInBlock: 1 }, emptyAvoid, injShoulder);
  const cautionMc3 = pickPoolEntry(
    squatAnchor, { miniCycleNumber: 3, weekInBlock: 1 }, emptyAvoid, injShoulder);
  assert(cautionMc1.name === 'Front Squat',
    `Caution deprio: mc=1 → Front Squat (good, first; got "${cautionMc1.name}")`);
  assert(cautionMc2.name === 'Box Squat',
    `Caution deprio: mc=2 → Box Squat (good, second; got "${cautionMc2.name}")`);
  // Only Back Squat is shoulder='caution', so it sorts last behind the three
  // 'good' entries: [Front Squat, Box Squat, High Box Squat, Back Squat].
  assert(cautionMc3.name === 'High Box Squat',
    `Caution deprio: mc=3 → High Box Squat (good, third; got "${cautionMc3.name}")`);

  // ── 14.7 Empty-after-filter → fall through to raw pool + structured log ──
  // Capture console.warn while running.
  const originalWarn = console.warn;
  const warnings: string[] = [];
  console.warn = (msg: string) => { warnings.push(msg); };
  try {
    const allExcluded: AthletePoolPrefs = {
      excluded: ['Back Squat', 'Front Squat', 'Box Squat', 'High Box Squat'],
      pinned: [],
    };
    const fallbackPick = pickPoolEntry(squatAnchor, ctx, emptyAvoid, allExcluded);
    // Raw pool walk at mc=1 → Back Squat.
    assert(fallbackPick.name === 'Back Squat',
      `Empty-filter fallback → raw pool mc=1 = Back Squat (got "${fallbackPick.name}")`);
    assert(warnings.length === 1,
      `Empty-filter fallback logs exactly once (got ${warnings.length})`);
    if (warnings.length > 0) {
      const w = warnings[0];
      assert(w.includes('[pool-override-fallback]'),
        `Fallback log has [pool-override-fallback] prefix (got: ${w})`);
      assert(w.includes('slot=squat'),
        `Fallback log includes slot name (got: ${w})`);
      assert(w.includes('filtered=0'),
        `Fallback log includes filtered=0 marker (got: ${w})`);
      assert(w.includes('excluded=4'),
        `Fallback log reports exclusion count (got: ${w})`);
      assert(w.includes('injury=0'),
        `Fallback log reports injury count (got: ${w})`);
    }
  } finally {
    console.warn = originalWarn;
  }

  // ── 14.8 Mixed fallback breakdown: some excluded, some injury-filtered ──
  console.warn = (msg: string) => { warnings.push(msg); };
  warnings.length = 0;
  try {
    // FIXTURE UPDATED for Sam's 13-region rulings (2026-07-28). This previously
    // leaned on pubalgia='avoid' dropping Back Squat and Front Squat. Sam ruled
    // all five adductor/pubalgia conflicts to 'caution' precisely so a groin
    // complaint is graded by severity rather than hard-excluded at the tag, so
    // 'groin' no longer empties the pool — by ruling, not by regression.
    // Back Squat lowerBack='avoid' is the only hard exclude left in this pool,
    // so the mixed breakdown is now 3 excluded + 1 injury-dropped.
    // The ASSERTION is unchanged: a mixed fallback logs exactly once and reports
    // an accurate breakdown.
    const mixed: AthletePoolPrefs = {
      excluded: ['Front Squat', 'Box Squat', 'High Box Squat'],
      pinned: [],
      activeInjuries: ['lowerBack'],
    };
    const mixedPick = pickPoolEntry(squatAnchor, ctx, emptyAvoid, mixed);
    assert(mixedPick.name === 'Back Squat',
      `Mixed fallback: raw pool mc=1 = Back Squat (got "${mixedPick.name}")`);
    assert(warnings.length === 1,
      `Mixed fallback logs once (got ${warnings.length})`);
    if (warnings.length > 0) {
      const w = warnings[0];
      assert(w.includes('excluded=3') && w.includes('injury=1'),
        `Mixed fallback reports excluded=3 injury=1 (got: ${w})`);
    }
  } finally {
    console.warn = originalWarn;
  }

  // ── 14.9 Integration through buildWorkoutsFromCoach: excluded name swapped out ──
  const workouts = buildWorkoutsFromCoach(
    [{
      dayOfWeek: 1,
      name: 'squat session',
      workoutType: 'Strength',
      sessionTier: 'core',
      exercises: [{ name: 'Back Squat', sets: 5, repsMin: 5, repsMax: 5, weight: 100 }],
    }],
    'mc-test',
    undefined,
    undefined,
    { miniCycleNumber: 1, weekInBlock: 1 },
    { excluded: ['Back Squat'], pinned: [] },
  );
  const integrationNames = workouts[0].exercises.map((e: any) => e.exercise?.name);
  // RETIRED (B1-PIVOT) — both asserted exclusion through the DELETED
  // generation-time rotation call. The BEHAVIOUR is retained and now belongs to
  // the composer, which reads `excludedIdentities`.
  // REPLACED BY: `test:composer-severance` "an excluded lift is never selected"
  // + "and the slot is still filled by another lift", mutation-proven red (MUT-7).
  void integrationNames;

  // ── 14.10 Integration: pinned name floats to first pick ──
  const pinned = buildWorkoutsFromCoach(
    [{
      dayOfWeek: 1,
      name: 'squat session',
      workoutType: 'Strength',
      sessionTier: 'core',
      exercises: [{ name: 'Back Squat', sets: 5, repsMin: 5, repsMax: 5, weight: 100 }],
    }],
    'mc-test',
    undefined,
    undefined,
    { miniCycleNumber: 1, weekInBlock: 1 },
    { excluded: [], pinned: ['Box Squat'] },
  );
  const pinnedNames = pinned[0].exercises.map((e: any) => e.exercise?.name);
  // ⚠ NOT RETIRED, AND DELIBERATELY LEFT RED (B1-PIVOT, 2026-08-14).
  //
  // This one does NOT meet the retirement rule. It guards a BEHAVIOUR — the
  // athlete's PINNED exercise is selected first — and **the composer has no
  // pinning reader at all**: `AthletePoolPrefs.pinned` reaches `composeWeek`
  // nowhere. There is nothing to replace it with, so retiring it would convert a
  // capability regression into silence. It stays red until the composer reads
  // pinning, and `test:composer-severance` carries the declaration that it does
  // not.
  assert(pinnedNames[0] === 'Box Squat',
    `buildWorkoutsFromCoach with pinned=['Box Squat'] picks Box Squat first (got "${pinnedNames[0]}")`);

  // ── 14.11 Within-session avoidance still works with prefs ──
  // Two squat rows in the same session + a pinned entry — the second must NOT
  // be the pinned one (the first pick already consumed it).
  //
  // REWIRED (B1-PIVOT, 2026-08-14) from `applyPoolRotation` to
  // `selectPoolEntryAvoiding`, which is where BOTH halves actually live: the
  // pin-bias (`applyPrefsToPool` step 4) and the avoid-walk. The deleted
  // function only carried the used-name set between the two calls, which the
  // caller does here instead. Assertions unchanged.
  const sessionAvoid = new Set<string>();
  const pinPrefs: AthletePoolPrefs = { excluded: [], pinned: ['Box Squat'] };
  const first = pickPoolEntry(squatAnchor, ctx, sessionAvoid, pinPrefs).name;
  sessionAvoid.add(first);
  const second = pickPoolEntry(squatAnchor, ctx, sessionAvoid, pinPrefs).name;
  assert(first === 'Box Squat',
    `Prefs + session avoid: first squat row → pinned Box Squat (got "${first}")`);
  assert(second !== first,
    `Prefs + session avoid: second squat row ≠ first (got both "${first}")`);

  // ── 14.12 Equipment filter: full gym leaves barbell anchor unchanged ──
  // REWIRED (B1-PIVOT) — the equipment filter is `selectPoolEntryAvoiding`'s,
  // via `applyPrefsToPool`. `applyPoolRotation` only chose which pool to hand
  // it, which this cell now states outright (h_push/anchor).
  const fullGymBench = pickPoolEntry(
    STRENGTH_POOLS.horizontal_push.anchor,
    ctx,
    emptyAvoid,
    { excluded: [], pinned: [], availableEquipment: FULL_GYM_EQUIPMENT },
  ).name;
  assert(fullGymBench === 'Bench Press',
    `Full gym availableEquipment preserves Bench Press anchor (got "${fullGymBench}")`);

  // ── 14.13 / 14.14 THE ANCHOR→ACCESSORY ROLE FALLBACK IS GONE WITH ITS OWNER ──
  //
  // Both cells asserted that a kit which empties the ANCHOR pool makes the
  // rotation drop to the SIBLING ACCESSORY pool of the same slot, logging
  // `[pool-equipment-role-fallback]` on the way. **That whole mechanism was
  // `applyPoolRotation`'s** — it read `siblingRole(role)`, re-asked
  // `getPool(slot, fallbackRole)` and emitted the log itself.
  // `selectPoolEntryAvoiding` is handed ONE pool and never reaches for another,
  // so there is no live function that can be asked this question, and no
  // `[pool-equipment-role-fallback]` line is emitted by anything any more.
  // Deleted rather than weakened: pointing them at a single pool would quietly
  // change what they claim.
  //
  // ⚠ THE CAPABILITY IS GONE, NOT JUST THE TEST. If an athlete's kit empties an
  // anchor pool, whoever composes that row now owns choosing the accessory —
  // the pool layer will not do it for them.
  //
  // KEPT, BECAUSE ITS SUBJECT IS LIVE: Sam's authored sheet says
  // `DB Bench Press -> ['bench', 'dumbbells']`, so on a bench-less kit NEITHER
  // bench press is legal. That is `exerciseAllowedByEquipment`, which is
  // exported, has production callers (`sessionSlotCoverage`), and is the
  // legality test R-083 rests on.
  assert(exerciseAllowedByEquipment('Bench Press', ['bodyweight', 'dumbbells']) === false,
    'Without a bench, Bench Press is not a legal prescription');
  assert(exerciseAllowedByEquipment('DB Bench Press', ['bodyweight', 'dumbbells']) === false,
    'Without a bench, DB Bench Press is not a legal prescription either');
  // NON-VACUITY: add the bench and the DB variant becomes legal, so the two
  // above are refusing on the BENCH and not refusing everything.
  assert(exerciseAllowedByEquipment('DB Bench Press', ['bodyweight', 'dumbbells', 'bench']) === true,
    'With a bench and dumbbells, DB Bench Press is legal');
  assert(exerciseAllowedByEquipment('Bench Press', ['bodyweight', 'dumbbells', 'bench']) === false,
    'A bench without a barbell still cannot support a barbell Bench Press');

  // ── 14.15 R-083: A SLOT NO KIT CAN FILL IS REFUSED, NEVER SERVED RAW ──────
  //
  // Sam: *"ya can't do much with overhead pushing or pull or even horizontal
  // pulling without equipment - i can't account for everyone and if they want to
  // train properly they'll sign up to a gym"*. `vertical_pull` on a
  // bodyweight-only kit is exactly that slot — every entry needs a bar, and the
  // sibling role cannot cover it either.
  //
  // THE OLD BEHAVIOUR IS THE MUTANT THIS CELL KILLS: it logged
  // `[pool-override-fallback]` and walked the RAW pool, which is how `Pull-Ups`
  // reached an athlete who owns nothing. Both halves are asserted — the outcome
  // is a refusal, AND the fallback line does not fire — because either one alone
  // stays green while the other regresses.
  //
  // REWIRED (B1-PIVOT, 2026-08-14) — this asked `applyPoolRotation` and read a
  // `PoolRotationOutcome`. **THE REFUSAL ITSELF NEVER LIVED THERE**: R-083 is
  // implemented inside `selectPoolEntryAvoiding`, which decides
  // `kitCanTrainNothingHere`, emits `[pool-slot-refused]` and returns the
  // `refused` branch of `PoolSelection`; the deleted function only re-wrapped
  // that answer. So the cell is asked one layer down, at the owner, and every
  // assertion survives — refusal, cause, no raw-pool fallback, and the
  // structured line. The one assertion that could NOT survive is
  // `suggestedName`: that field was `PoolRotationOutcome`'s alone (the name a
  // producer had asked for), and `PoolSelection` names the SLOT instead, which
  // is asserted in its place.
  const refusalWarnings: string[] = [];
  console.warn = (msg: string) => { refusalWarnings.push(msg); };
  let bwPullOutcome: PoolSelection;
  try {
    bwPullOutcome = selectPoolEntryAvoiding(
      STRENGTH_POOLS.vertical_pull.anchor,
      ctx,
      emptyAvoid,
      { excluded: [], pinned: [], availableEquipment: ['bodyweight'] },
    );
  } finally {
    console.warn = originalWarn;
  }
  assert(bwPullOutcome.kind === 'refused',
    `Bodyweight-only vertical pull is REFUSED, not substituted (got ${JSON.stringify(bwPullOutcome)})`);
  if (bwPullOutcome.kind === 'refused') {
    assert(bwPullOutcome.cause === 'equipment',
      `Refusal names the kit as the cause (got "${bwPullOutcome.cause}")`);
    assert(bwPullOutcome.slot === 'vertical_pull' && bwPullOutcome.role === 'anchor',
      `Refusal names the slot it emptied, so the caller can name the removal `
      + `(got "${bwPullOutcome.slot}/${bwPullOutcome.role}")`);
  }
  assert(!refusalWarnings.some((w) => w.includes('[pool-override-fallback]')),
    `An equipment refusal never logs the raw-pool fallback (got ${JSON.stringify(refusalWarnings)})`);
  assert(refusalWarnings.some((w) => w.includes('[pool-slot-refused]')),
    `An equipment refusal logs its own structured line (got ${JSON.stringify(refusalWarnings)})`);

  // AND THE CONTROL: exclusion is NOT equipment, and its raw-pool fallback is
  // untouched by this change. Without this line the cell above would stay green
  // if the refusal widened to swallow every cause — which would silently start
  // deleting work the athlete merely asked to vary.
  const exclusionWarnings: string[] = [];
  console.warn = (msg: string) => { exclusionWarnings.push(msg); };
  let allExcludedOutcome: PoolSelection;
  try {
    allExcludedOutcome = selectPoolEntryAvoiding(squatAnchor, ctx, emptyAvoid, {
      excluded: ['Back Squat', 'Front Squat', 'Box Squat', 'High Box Squat'],
      pinned: [],
    });
  } finally {
    console.warn = originalWarn;
  }
  assert(allExcludedOutcome.kind === 'entry',
    `An all-excluded pool still falls through — exclusion is not the kit (got ${JSON.stringify(allExcludedOutcome)})`);
  assert(exclusionWarnings.some((w) => w.includes('[pool-override-fallback]')),
    `The exclusion fallback keeps its original log (got ${JSON.stringify(exclusionWarnings)})`);
}

// ─────────────────────────────────────────────────────────────────
// MUSCLE-GROUP DATA (PoolEntry.group)
//
// ⚠ WHAT THIS SECTION USED TO BE, AND WHY IT IS SMALLER (B1-PIVOT, 2026-08-14).
//
// It was headed "Rotation stays inside its muscle group" and its behavioural
// cells rotated Tricep Pushdown / Bicep Curl / Lateral Raise / Face Pull /
// Nordic Lower / Calf Raises and the four single-leg lunges across 12 cycles
// × 4 weeks, asserting the pick never left its `group` (R-080, and the measured
// `Bicep Curl | Bicep Curl | Hammer Curl` defect of 2026-08-13).
//
// **THAT NARROWING WAS `applyPoolRotation`'S ALONE.** It read
// `findPoolEntry(suggestedName)?.entry.group`, filtered the pool to that group
// before the walk, and released the filter only when every in-group candidate
// was already used. `selectPoolEntry` and `selectPoolEntryAvoiding` have never
// looked at `group` — they index `cycleIndex % entries.length` straight across
// the slot. So every rotation cell here is exclusively associated with the
// deleted function, and there is no live function to re-point them at.
//
// ⚠⚠ `PoolEntry.group` NOW HAS NO READER ANYWHERE IN THE APP. Grepped
// 2026-08-14: the only remaining mentions are this file, the field's own
// declaration and a comment in `STRENGTH_POOLS`. R-080 and the arm-rotation
// ruling are, at this moment, enforced by NOTHING — whoever composes strength
// rows now owns not printing three curls in a row. That is reported, not
// papered over.
//
// WHAT SURVIVES BELOW is the DATA: the table still carries correct groups, and
// `findPoolEntry` still serves them. These cells need no rewiring — their
// subject was always the pool table — so they are kept, and they are what a
// future group-aware composer will build on.
// ─────────────────────────────────────────────────────────────────
section('Muscle-group data on pool entries');
{
  const groupOf = (name: string): string | undefined => findPoolEntry(name)?.entry.group;

  assert(groupOf('Tricep Pushdown') === 'tricep',
    `Tricep Pushdown should be group 'tricep', got ${String(groupOf('Tricep Pushdown'))}`);
  assert(groupOf('Bicep Curl (Barbell)') === 'bicep',
    `Bicep Curl (Barbell) should be group 'bicep', got ${String(groupOf('Bicep Curl (Barbell)'))}`);
  assert(groupOf('Lateral Raise') === 'shoulder',
    `Lateral Raise should be group 'shoulder', got ${String(groupOf('Lateral Raise'))}`);
  // R-076: Sam ruled the face pull is shoulder work, so it sits with the delts.
  assert(groupOf('Face Pull') === 'shoulder',
    `R-076: Face Pull should be group 'shoulder', got ${String(groupOf('Face Pull'))}`);
  assert(groupOf('Nordic Lower') === 'hamstring',
    `Nordic Lower should be group 'hamstring', got ${String(groupOf('Nordic Lower'))}`);
  assert(groupOf('Calf Raises') === 'calf',
    `Calf Raises should be group 'calf', got ${String(groupOf('Calf Raises'))}`);

  // R-080's TABLE half: single-leg knee work is labelled apart from bilateral
  // squatting, which is the distinction the ruling rests on. (Its BEHAVIOURAL
  // half — that rotation may not cross the two — is the part with no owner.)
  for (const lunge of ['Reverse Lunges', 'Walking Lunges', 'Bulgarian Split Squats', 'Step Ups']) {
    assert(groupOf(lunge) === 'single_leg_knee',
      `R-080: ${lunge} should be group 'single_leg_knee', got ${String(groupOf(lunge))}`);
  }
  // NON-VACUITY: if everything carried one group the loop above would pass while
  // proving nothing.
  assert(groupOf('Bodyweight Squat') === 'bilateral_squat',
    `R-080: Bodyweight Squat should be 'bilateral_squat', got ${String(groupOf('Bodyweight Squat'))}`);

  // AN UNGROUPED SLOT IS DELIBERATELY UNGROUPED — every squat anchor is a squat,
  // so grouping a uniform slot would be noise.
  assert(groupOf('Back Squat') === undefined,
    'squat anchors should carry no group — grouping a uniform slot is noise');
}

// ─────────────────────────────────────────────────────────────────
// R-133 (Sam, 2026-08-23): "carries all timed"
// ─────────────────────────────────────────────────────────────────
//
// EVERY carry in the strength carry pool must resolve to a DURATION dose —
// through the same authored-unit lookup the prehab holds use. The cell walks
// the POOL, not a name list, so a fifth carry added tomorrow reds here until
// someone authors its seconds.
{
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { resolveComposedDose } = require('../rules/composedDose');
  for (const role of ['anchor', 'accessory'] as const) {
    for (const entry of STRENGTH_POOLS.carry[role].entries) {
      const dose = resolveComposedDose({
        identity: entry.name,
        isMainLift: false,
        poolSlot: 'carry',
        seasonPhase: 'In-season',
        offseasonSubphase: null,
        authoredFallback: [2, 8, 12],
      });
      assert(dose.prescriptionType === 'duration',
        `R-133: ${entry.name} must be dosed in seconds, got ${dose.prescriptionType ?? 'reps'}`);
      assert(dose.category === 'authored_timed_hold',
        `R-133: ${entry.name}'s dose must come from an authored timed source, got ${dose.category}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────
console.log(`\n${'='.repeat(60)}`);
console.log(`Results: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
if (fail > 0) {
  console.log(`\nFailures:`);
  failures.forEach(f => console.log(`  - ${f}`));
  process.exit(1);
}
console.log('All exercisePoolsStrength tests passed.');
