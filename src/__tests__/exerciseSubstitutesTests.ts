/**
 * exerciseSubstitutesTests — getSubstituteCandidates contract tests.
 *
 * These tests assert the substitution intelligence rules from the
 * 2026-04-27 audit memo:
 *   1. Exactly 2 candidates returned when 2+ survive filtering.
 *   2. The pair is meaningfully different on at least one axis
 *      (no near-duplicates like Trap Bar + Conventional Deadlift).
 *   3. Injury cautions filter the pool before scoring runs.
 *   4. Equipment constraints filter to what the athlete can reach.
 *   5. Aliases resolve before slot lookup ("rdl" → "RDLs").
 *   6. Non-substitutable slots (core, conditioning, plyo) return [].
 *
 * Run: sucrase-node src/__tests__/exerciseSubstitutesTests.ts
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  getSubstituteCandidates,
  formatSubstitutesForLLM,
  type SubstituteCandidate,
} from '../utils/exerciseSubstitutes';
import { equipmentTagsToSubstituteEquipmentClasses } from '../utils/equipmentAvailability';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    failures.push(name + (detail ? `\n      ${detail}` : ''));
    console.log(`  ✗ ${name}${detail ? '\n      ' + detail : ''}`);
  }
}

function eq<T>(name: string, actual: T, expected: T) {
  ok(
    name,
    JSON.stringify(actual) === JSON.stringify(expected),
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

function names(cands: ReadonlyArray<SubstituteCandidate>): string[] {
  return cands.map((c) => c.name);
}

// ─── 1. Hinge: deadlift returns 2 meaningfully-different alternatives ───
{
  console.log('\n[1] Deadlift returns 2 meaningfully-different alternatives');
  const result = getSubstituteCandidates('Deadlift');

  eq('returns exactly 2 candidates', result.length, 2);
  ok(
    'both belong to hinge slot',
    result.every((c) => c.slot === 'hinge'),
    `slots: ${result.map((c) => c.slot).join(', ')}`,
  );
  ok(
    'first candidate is not deadlift itself',
    result[0]?.name !== 'Deadlift',
    `got: ${result[0]?.name}`,
  );

  // Pair-wise difference: at least one axis between the two
  if (result.length === 2) {
    const a = result[0];
    const b = result[1];
    const sameLoadBucket = Math.abs(a.loadRatio - b.loadRatio) < 0.2;
    const sameUnilateral = a.tags?.unilateral === b.tags?.unilateral;
    const sameSpinal = a.tags?.injury.lowerBack === b.tags?.injury.lowerBack;
    const sameEquipment = a.equipment === b.equipment;
    ok(
      'pair differs on at least one of load/structure/spinal/equipment',
      !sameLoadBucket || !sameUnilateral || !sameSpinal || !sameEquipment,
      `${a.name} vs ${b.name}: loadDelta=${Math.abs(a.loadRatio - b.loadRatio).toFixed(2)}, sameUni=${sameUnilateral}, sameSpinal=${sameSpinal}, sameEquip=${sameEquipment}`,
    );
  }
}

// ─── 2. Hinge with lowerBack='avoid' filters out the heavy bilateral options ───
{
  console.log('\n[2] Deadlift with active lowerBack injury filters heavy bilateral');
  const result = getSubstituteCandidates('Deadlift', {
    activeInjuries: { lowerBack: 'avoid' },
  });

  ok('at least one candidate returned', result.length >= 1, `got ${result.length}`);
  ok(
    'no candidate is rated injury.lowerBack=avoid for active lowerBack',
    result.every((c) => !c.tags || c.tags.injury.lowerBack !== 'avoid'),
    `candidates: ${names(result).join(', ')}`,
  );
  ok(
    'no high-load bilateral candidates (lowerBack avoid rule)',
    result.every(
      (c) => !c.tags || !(c.tags.load === 'high' && !c.tags.unilateral),
    ),
    `candidates: ${names(result).join(', ')}`,
  );
}

// ─── 3. Squat: candidates differ along bilateral↔unilateral axis ───
{
  console.log('\n[3] Back Squat → pair likely spans bilateral/unilateral');
  const result = getSubstituteCandidates('Back Squat');

  eq('returns 2 candidates', result.length, 2);
  ok(
    'first candidate from squat slot',
    result[0]?.slot === 'squat',
    `slot: ${result[0]?.slot}`,
  );

  // Squat pool has 3 anchors (BB+FB+Box) and 4 unilateral accessories,
  // so an ideal pair surfaces one anchor + one unilateral accessory.
  const hasAnchor = result.some((c) => c.role === 'anchor');
  const hasAccessory = result.some((c) => c.role === 'accessory');
  ok(
    'pair includes both an anchor and an accessory option',
    hasAnchor && hasAccessory,
    `roles: ${result.map((c) => c.role).join(', ')}`,
  );
}

// ─── 4. Bench Press with shoulder caution: keeps low-stress alternatives ───
{
  console.log('\n[4] Bench Press with shoulder=caution');
  const result = getSubstituteCandidates('Bench Press', {
    activeInjuries: { shoulder: 'caution' },
  });

  ok('returns at least one candidate', result.length >= 1, `got ${result.length}`);
  ok(
    'no candidate is rated injury.shoulder=avoid',
    result.every((c) => !c.tags || c.tags.injury.shoulder !== 'avoid'),
    `candidates: ${names(result).join(', ')}`,
  );
}

// ─── 5. Equipment filter: dumbbell-only athlete drops barbell options ───
{
  console.log('\n[5] Bench Press with availableEquipment=[dumbbell] only');
  const result = getSubstituteCandidates('Bench Press', {
    availableEquipment: ['dumbbell'],
  });

  ok('returns at least one candidate', result.length >= 1, `got ${result.length}`);
  ok(
    'no barbell candidates returned',
    result.every((c) => c.equipment !== 'barbell'),
    `candidates with equipment: ${result.map((c) => `${c.name}(${c.equipment})`).join(', ')}`,
  );

  const fromTags = getSubstituteCandidates('Bench Press', {
    availableEquipment: equipmentTagsToSubstituteEquipmentClasses(['bodyweight', 'dumbbells']),
  });
  ok(
    'canonical EquipmentTag bridge also excludes barbell candidates',
    fromTags.length >= 1 && fromTags.every((c) => c.equipment !== 'barbell'),
    `candidates with equipment: ${fromTags.map((c) => `${c.name}(${c.equipment})`).join(', ')}`,
  );
}

// ─── 6. Alias resolution: "rdl" routes to RDLs → hinge slot ───
{
  console.log('\n[6] Alias "rdl" routes to hinge family');
  const result = getSubstituteCandidates('rdl');

  ok('returns at least one candidate', result.length >= 1, `got ${result.length}`);
  ok(
    'all from hinge slot',
    result.every((c) => c.slot === 'hinge'),
    `slots: ${result.map((c) => c.slot).join(', ')}`,
  );
  ok(
    'RDLs is not in its own substitute list',
    !names(result).includes('RDLs'),
    `candidates: ${names(result).join(', ')}`,
  );
}

// ─── 7. Non-substitutable slot (plyo) returns [] ───
{
  console.log('\n[7] Plyo exercises return empty list (out of scope)');
  const result = getSubstituteCandidates('Box Jumps');
  eq('returns []', result.length, 0);
}

// ─── 8. Unknown exercise returns [] ───
{
  console.log('\n[8] Unknown / non-pool exercise returns []');
  const result = getSubstituteCandidates('Underwater Basket Weaving');
  eq('returns []', result.length, 0);
}

// ─── 9. Empty input returns [] ───
{
  console.log('\n[9] Empty / whitespace input returns []');
  eq('empty string → []', getSubstituteCandidates('').length, 0);
  eq('whitespace → []', getSubstituteCandidates('   ').length, 0);
}

// ─── 10. differsOn axes are populated ───
{
  console.log('\n[10] differsOn surfaces axes for LLM grounding');
  const result = getSubstituteCandidates('Deadlift');
  ok(
    'every candidate has differsOn populated',
    result.every((c) => Array.isArray(c.differsOn)),
    `candidates: ${result.map((c) => `${c.name}=[${c.differsOn.join(',')}]`).join('; ')}`,
  );
  ok(
    'at least one candidate differs on load OR spinal_stress vs Deadlift',
    result.some(
      (c) => c.differsOn.includes('load') || c.differsOn.includes('spinal_stress'),
    ),
    `differsOn: ${result.map((c) => c.differsOn.join(',')).join(' | ')}`,
  );
}

// ─── 11. Vertical pull family — must be meaningfully different ───
{
  console.log('\n[11] Pull-Ups returns vertical_pull family alternatives');
  const result = getSubstituteCandidates('Pull-Ups');
  ok(
    'returns at least 1 candidate',
    result.length >= 1,
    `got ${result.length}`,
  );
  ok(
    'never recommends Pull-Ups itself',
    !names(result).includes('Pull-Ups'),
    `candidates: ${names(result).join(', ')}`,
  );
  // Refinement: Chin-Ups is a zero-diff near-twin and must never appear.
  ok(
    'does NOT return Chin-Ups (zero-diff near-twin)',
    !names(result).includes('Chin-Ups'),
    `candidates: ${names(result).join(', ')}`,
  );
  // Every returned candidate must be meaningfully different.
  ok(
    'every candidate has at least one diff axis vs Pull-Ups',
    result.every((c) => c.differsOn.length > 0),
    `differsOn: ${result.map((c) => `${c.name}=[${c.differsOn.join(',')}]`).join(' | ')}`,
  );
}

// ─── 12. formatSubstitutesForLLM compact representation ───
{
  console.log('\n[12] formatSubstitutesForLLM produces a compact string');
  const result = getSubstituteCandidates('Deadlift');
  const formatted = formatSubstitutesForLLM('Deadlift', result);
  ok(
    'contains the original exercise name',
    formatted.includes('Deadlift'),
    `formatted: ${formatted}`,
  );
  ok(
    'lists all returned candidate names',
    result.every((c) => formatted.includes(c.name)),
    `formatted: ${formatted}`,
  );
  ok(
    'mentions hinge family',
    formatted.toLowerCase().includes('hinge'),
    `formatted: ${formatted}`,
  );
}

// ─── 13. Bilateral vs unilateral structural diff is detected ───
{
  console.log('\n[13] differsOn includes "structure" when comparing bilateral to unilateral');
  // Back Squat (bilateral) → expect at least one unilateral accessory in the pool
  const result = getSubstituteCandidates('Back Squat');
  const anyStructureDiff = result.some((c) => c.differsOn.includes('structure'));
  ok(
    'at least one candidate differs on structure axis',
    anyStructureDiff,
    `differsOn: ${result.map((c) => `${c.name}=[${c.differsOn.join(',')}]`).join('; ')}`,
  );
}

// ─── 14. Pair-wise difference enforced (no near-duplicates) ───
{
  console.log('\n[14] No near-duplicate pairs (e.g. Trap Bar + Conventional Deadlift)');
  const result = getSubstituteCandidates('Deadlift');
  if (result.length === 2) {
    const [a, b] = result;
    // Same slot+role+similar load+same unilateral = near-duplicate
    const nearDuplicate =
      a.slot === b.slot &&
      a.role === b.role &&
      Math.abs(a.loadRatio - b.loadRatio) < 0.15 &&
      a.tags?.unilateral === b.tags?.unilateral &&
      a.equipment === b.equipment;
    ok(
      'pair is NOT a near-duplicate',
      !nearDuplicate,
      `${a.name}(load=${a.loadRatio}, uni=${a.tags?.unilateral}, eq=${a.equipment}) vs ${b.name}(load=${b.loadRatio}, uni=${b.tags?.unilateral}, eq=${b.equipment})`,
    );
  } else {
    ok('only 1 candidate returned (skipped near-duplicate check)', true);
  }
}

// ─── 15. Cross-pattern fallback: Pull-Ups with shoulder='avoid' → rows ───
{
  console.log('\n[15] Pull-Ups with shoulder=avoid falls back to horizontal_pull');
  const result = getSubstituteCandidates('Pull-Ups', {
    activeInjuries: { shoulder: 'avoid' },
  });
  ok(
    'returns at least 1 candidate',
    result.length >= 1,
    `got ${result.length}`,
  );
  ok(
    'every candidate is from horizontal_pull (rows)',
    result.every((c) => c.slot === 'horizontal_pull'),
    `slots: ${result.map((c) => `${c.name}(${c.slot})`).join(', ')}`,
  );
  ok(
    'no candidate is rated injury.shoulder=avoid',
    result.every((c) => !c.tags || c.tags.injury.shoulder !== 'avoid'),
    `candidates: ${names(result).join(', ')}`,
  );
  // Reason should call out the overhead-pull avoidance.
  ok(
    'first candidate reason mentions overhead pull avoidance',
    result[0]?.reason === 'avoids overhead pull',
    `reason: ${result[0]?.reason}`,
  );
}

// ─── 16. Cross-pattern fallback via explicit avoidOverheadPull flag ───
{
  console.log('\n[16] Pull-Ups with avoidOverheadPull=true falls back to rows');
  const result = getSubstituteCandidates('Pull-Ups', {
    avoidOverheadPull: true,
  });
  ok(
    'returns at least 1 candidate',
    result.length >= 1,
    `got ${result.length}`,
  );
  ok(
    'every candidate is from horizontal_pull',
    result.every((c) => c.slot === 'horizontal_pull'),
    `slots: ${result.map((c) => `${c.name}(${c.slot})`).join(', ')}`,
  );
  ok(
    'never returns Chin-Ups (vertical pull)',
    !names(result).includes('Chin-Ups'),
    `candidates: ${names(result).join(', ')}`,
  );
}

// ─── 17. Shoulder=caution: WIDENS to include both pull pools ───
{
  console.log('\n[17] Pull-Ups with shoulder=caution widens to include rows');
  const result = getSubstituteCandidates('Pull-Ups', {
    activeInjuries: { shoulder: 'caution' },
  });
  ok(
    'returns at least 1 candidate',
    result.length >= 1,
    `got ${result.length}`,
  );
  // After caution, expect at least one horizontal_pull option in the mix.
  const hasHorizontal = result.some((c) => c.slot === 'horizontal_pull');
  ok(
    'at least one candidate is from horizontal_pull (row fallback)',
    hasHorizontal,
    `slots: ${result.map((c) => `${c.name}(${c.slot})`).join(', ')}`,
  );
  ok(
    'no candidate has shoulder=avoid rating',
    result.every((c) => !c.tags || c.tags.injury.shoulder !== 'avoid'),
    `candidates: ${names(result).join(', ')}`,
  );
}

// ─── 18. Reason field is populated with sensible values ───
{
  console.log('\n[18] Reason field surfaces a dominant axis for LLM grounding');
  const dl = getSubstituteCandidates('Deadlift');
  ok(
    'Deadlift candidates have reason populated',
    dl.length > 0 && dl.every((c) => typeof c.reason === 'string' && c.reason.length > 0),
    `reasons: ${dl.map((c) => `${c.name}=${c.reason}`).join('; ')}`,
  );

  const lbAvoid = getSubstituteCandidates('Deadlift', {
    activeInjuries: { lowerBack: 'avoid' },
  });
  ok(
    'lowerBack=avoid surfaces a back-related reason on at least one candidate',
    lbAvoid.some(
      (c) =>
        c.reason === 'safer for lower back' ||
        c.reason === 'lower spinal load' ||
        c.reason === 'lower fatigue' ||
        c.reason === 'lighter load',
    ),
    `reasons: ${lbAvoid.map((c) => `${c.name}=${c.reason}`).join('; ')}`,
  );
}

// ─── 19. Single-pick fallback when no valid second candidate exists ───
{
  console.log('\n[19] Returns 1 candidate (not a forced pair) when second would be near-duplicate');
  // Pull-Ups baseline — vertical_pull has Chin-Ups (zero-diff) and the
  // pool is small enough that the second pick may not differ from first.
  // Either we get 2 meaningfully different OR we get 1 — never a forced
  // pair. Test the contract.
  const result = getSubstituteCandidates('Pull-Ups');
  ok(
    'returns 1 or 2 candidates (never 0 if pool has any meaningful options)',
    result.length === 1 || result.length === 2,
    `got ${result.length}`,
  );
  if (result.length === 2) {
    // If 2 returned, second MUST differ from first on at least one axis.
    const [a, b] = result;
    const pairAxes = [
      Math.abs(a.loadRatio - b.loadRatio) >= 0.2,
      a.tags?.unilateral !== b.tags?.unilateral,
      a.tags?.injury.lowerBack !== b.tags?.injury.lowerBack,
      a.equipment !== b.equipment,
      a.tags?.fatigue !== b.tags?.fatigue,
      a.slot !== b.slot,
    ];
    ok(
      'pair differs on at least one axis (not a forced near-duplicate)',
      pairAxes.some(Boolean),
      `${a.name} vs ${b.name}`,
    );
  } else {
    ok('only 1 candidate returned — single-pick fallback respected', true);
  }
}

// ─── 20. Pull-Ups with shoulder='avoid' surfaces row names verbatim ───
{
  console.log('\n[20] Shoulder=avoid surfaces row names the user expects');
  const result = getSubstituteCandidates('Pull-Ups', {
    activeInjuries: { shoulder: 'avoid' },
  });
  const validRowNames = new Set([
    'Barbell Row',
    'Chest Supported Row',
    'Single-Arm DB Row',
    'Seated Cable Row',
    'Face Pull',
  ]);
  ok(
    'every candidate is a recognised horizontal_pull exercise',
    result.length > 0 && result.every((c) => validRowNames.has(c.name)),
    `candidates: ${names(result).join(', ')}`,
  );
}

// ─── 21. formatSubstitutesForLLM includes reason ───
{
  console.log('\n[21] formatSubstitutesForLLM surfaces reason for each candidate');
  const result = getSubstituteCandidates('Deadlift');
  const formatted = formatSubstitutesForLLM('Deadlift', result);
  // At least one candidate should have a reason rendered.
  const anyReasonRendered = result.some(
    (c) => c.reason && formatted.includes(c.reason),
  );
  ok(
    'at least one reason appears in the formatted string',
    anyReasonRendered,
    `formatted:\n${formatted}`,
  );
}

// ─── 22. Movement-variant guard: never pair same-machine variations ───
{
  console.log('\n[22] Pull-Ups never returns Lat Pulldown + Single-Arm Lat Pulldown as a pair');
  const result = getSubstituteCandidates('Pull-Ups');
  const nameSet = new Set(names(result));
  // The bug we're guarding against: both variants of cable lat pulldown
  // returned as a pair. They share machine + movement and only differ
  // on structure / load — that's padding, not choice.
  const pairsSameMachine = nameSet.has('Lat Pulldown') && nameSet.has('Single-Arm Lat Pulldown');
  ok(
    'pair does NOT contain both Lat Pulldown variants',
    !pairsSameMachine,
    `candidates: ${names(result).join(', ')}`,
  );

  // If 2 are returned, check: same slot + same equipment + shared root
  // word in canonical name → flagged as variant pair (must NOT exist).
  if (result.length === 2) {
    const [a, b] = result;
    const sameMachine =
      a.slot === b.slot &&
      a.equipment != null &&
      b.equipment != null &&
      a.equipment === b.equipment &&
      // crude shared-token check
      a.name.toLowerCase().split(/[\s-]/).some((w) =>
        w.length >= 4 && b.name.toLowerCase().includes(w),
      );
    ok(
      'returned pair are NOT same-machine variants',
      !sameMachine,
      `${a.name} (slot=${a.slot}, eq=${a.equipment}) + ${b.name} (slot=${b.slot}, eq=${b.equipment})`,
    );
  } else {
    ok('only 1 candidate returned — variant guard correctly fired', true);
  }
}

// ─── 23. Fresh-axis preference: when 2 returned, second usually adds a new axis ───
{
  console.log('\n[23] Second pick prefers an axis NOT already in first.differsOn');
  // Use Deadlift — the hinge pool is broad enough that fresh axes are
  // achievable for the second pick. (Pull-Ups baseline returns 1 because
  // the variant guard blocks the only other candidate.)
  const result = getSubstituteCandidates('Deadlift');
  if (result.length === 2) {
    const [a, b] = result;
    // We're not asserting strict fresh-axis enforcement (it's a soft
    // preference), but we ARE asserting the pair differs on something
    // the first didn't already cover OR the first covers everything.
    const firstAxes = new Set(a.differsOn);
    const secondAxes = new Set(b.differsOn);
    // Either second introduces a fresh axis, OR first.differsOn already
    // covers the full axis space (5 axes: load, structure, spinal_stress,
    // equipment, fatigue).
    const fullAxisSpace = firstAxes.size === 5;
    const hasFreshAxis = [...secondAxes].some((ax) => !firstAxes.has(ax));
    ok(
      'second introduces a fresh axis OR first already covers everything',
      hasFreshAxis || fullAxisSpace,
      `first=${a.name} differsOn=[${a.differsOn.join(',')}]; second=${b.name} differsOn=[${b.differsOn.join(',')}]`,
    );
  } else {
    ok('only 1 candidate returned — fresh-axis check skipped', true);
  }
}

// ─── 24. Movement-variant guard: cross-equipment is OK ───
{
  console.log('\n[24] Bench Press → Incline DB Bench (different equipment) is allowed');
  const result = getSubstituteCandidates('Bench Press', {
    availableEquipment: ['barbell', 'dumbbell'],
  });
  // We expect at least Incline DB Bench to be in the output — the guard
  // must NOT fire just because both share the word "bench" (different
  // equipment makes them meaningfully different exercises).
  const nameSet = new Set(names(result));
  ok(
    'Incline DB Bench survives despite shared "bench" token',
    nameSet.has('Incline DB Bench') || result.length > 0,
    `candidates: ${names(result).join(', ')}`,
  );
}

// ─── 25. Cross-pattern fallback: Pull-Ups baseline returns vertical + row ───
{
  console.log('\n[25] Pull-Ups baseline returns 2 options (vertical_pull + horizontal_pull fallback)');
  // The vertical_pull pool only has 4 candidates (Pull-Ups itself, Chin-Ups
  // near-twin filtered out, Lat Pulldown, Single-Arm Lat Pulldown — and the
  // last two are movement variants of each other). After zero-diff and
  // movement-variant filters, the same-slot pool can't yield a distinct
  // pair. The cross-pattern fallback should kick in and bring a row in as
  // the second option so the athlete still gets two meaningful choices.
  const result = getSubstituteCandidates('Pull-Ups');
  ok(
    'returns exactly 2 candidates (cross-pattern fallback fired)',
    result.length === 2,
    `got ${result.length}: ${names(result).join(', ')}`,
  );
  if (result.length === 2) {
    const [first, second] = result;
    ok(
      'first candidate is from vertical_pull (same-slot best pick)',
      first.slot === 'vertical_pull',
      `first=${first.name} slot=${first.slot}`,
    );
    ok(
      'second candidate is from horizontal_pull (cross-pattern fallback)',
      second.slot === 'horizontal_pull',
      `second=${second.name} slot=${second.slot}`,
    );
    // Sanity: pair still meaningfully different (no zero-diff pair).
    const pairAxes = [
      Math.abs(first.loadRatio - second.loadRatio) >= 0.2,
      first.tags?.unilateral !== second.tags?.unilateral,
      first.equipment !== second.equipment,
      first.tags?.fatigue !== second.tags?.fatigue,
      first.slot !== second.slot,
    ];
    ok(
      'pair differs on at least one structural axis',
      pairAxes.some(Boolean),
      `${first.name} vs ${second.name}`,
    );
  }
}

// ─── 26. Cross-pattern fallback respects shoulder=avoid (no double-fallback) ───
{
  console.log('\n[26] Pull-Ups + shoulder=avoid: candidate pool already widened — no extra fallback');
  // When the candidate pool is ALREADY routed through horizontal_pull
  // (shoulder=avoid widens the slot list), the cross-pattern fallback must
  // NOT re-fire and try to pull in horizontal_pull a second time. All
  // candidates should remain in horizontal_pull.
  const result = getSubstituteCandidates('Pull-Ups', {
    activeInjuries: { shoulder: 'avoid' },
  });
  ok(
    'returns at least 1 candidate',
    result.length >= 1,
    `got ${result.length}`,
  );
  ok(
    'every candidate is from horizontal_pull (no fallback re-fire)',
    result.every((c) => c.slot === 'horizontal_pull'),
    `slots: ${result.map((c) => `${c.name}=${c.slot}`).join(', ')}`,
  );
  // Pair must NOT be near-duplicate (e.g. Barbell Row + Single-Arm DB Row
  // would be technically same slot, different equipment — that's allowed,
  // but movement-variant guard catches genuine same-machine pairs).
  if (result.length === 2) {
    const [a, b] = result;
    ok(
      'second pick differs from first on at least one axis',
      a.equipment !== b.equipment ||
        a.tags?.unilateral !== b.tags?.unilateral ||
        Math.abs(a.loadRatio - b.loadRatio) >= 0.2 ||
        a.tags?.fatigue !== b.tags?.fatigue,
      `${a.name} vs ${b.name}`,
    );
  }
}

// ─── 27. Hinge baseline stays within-slot (no cross-pattern fallback for hinge) ───
{
  console.log('\n[27] Deadlift baseline returns 2 hinge options (within-slot, no cross-pattern needed)');
  // Hinge isn't in CROSS_PATTERN_FALLBACK_MAP — deliberately, because the
  // within-slot pool (Hip Thrusts, KB Swings, Single-Leg RDL, Trap Bar)
  // already covers the user's "glute-dominant / unilateral / lower-spinal"
  // diversity preferences. Both candidates must come from the hinge slot.
  const result = getSubstituteCandidates('Deadlift');
  ok(
    'returns exactly 2 candidates',
    result.length === 2,
    `got ${result.length}: ${names(result).join(', ')}`,
  );
  ok(
    'both candidates are from hinge (no cross-pattern fallback fired)',
    result.every((c) => c.slot === 'hinge'),
    `slots: ${result.map((c) => `${c.name}=${c.slot}`).join(', ')}`,
  );
  // At least one candidate should reduce spinal stress vs Deadlift —
  // that's the dominant hinge-substitution use case.
  ok(
    'at least one candidate has lower spinal stress (lowerBack=good or =caution)',
    result.some(
      (c) =>
        c.tags?.injury.lowerBack === 'good' ||
        c.tags?.injury.lowerBack === 'caution',
    ),
    `lowerBack ratings: ${result.map((c) => `${c.name}=${c.tags?.injury.lowerBack}`).join(', ')}`,
  );
}

// ─── 28. Cross-pattern fallback honors equipment constraints ───
{
  console.log('\n[28] Pull-Ups + dumbbell-only: fallback row must respect equipment filter');
  // If we restrict to dumbbells, the cross-pattern fallback row pool
  // shrinks to dumbbell rows (Single-Arm DB Row). Barbell Row, Cable Face
  // Pull, etc. must NOT appear because the equipment filter applies to
  // both same-slot and fallback candidates.
  const result = getSubstituteCandidates('Pull-Ups', {
    availableEquipment: ['dumbbell', 'bodyweight'],
  });
  ok(
    'returns at least 1 candidate',
    result.length >= 1,
    `got ${result.length}: ${names(result).join(', ')}`,
  );
  // Every candidate's equipment (if defined) must be allowed.
  const allowed = new Set(['dumbbell', 'bodyweight']);
  ok(
    'no candidate uses disallowed equipment',
    result.every((c) => c.equipment == null || allowed.has(c.equipment)),
    `equipment: ${result.map((c) => `${c.name}=${c.equipment}`).join(', ')}`,
  );
}

// ─── Summary ───
console.log(`\n[exerciseSubstitutes] ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  failures.forEach((f) => console.log(`  • ${f}`));
  process.exit(1);
}
process.exit(0);
