/**
 * Conditioning Rotation — Mini-cycle-level template stability tests.
 *
 * Run: npm run test:conditioning-rotation
 *
 * Asserts the Option-B contract:
 *   Template selection is stable within a mini-cycle and rotates across
 *   blocks — `template = f(category, miniCycleNumber)`. Within-block
 *   variety comes from feel + erg modality (rotating independently,
 *   out of scope here). No conditioning progression system.
 *
 * Contract surface:
 *   1. `conditioningCategoryToExerciseName(cat, dateStr, mc)` is
 *      deterministic in `mc`: same (cat, mc) → same template regardless
 *      of dateStr.
 *   2. Consecutive mini-cycles produce different templates for categories
 *      whose template pool has ≥ 2 entries.
 *   3. Full pool walk within N mini-cycles (N = pool length).
 *   4. `aerobic_base` is 1:1 (Long Nasal Run) — modality variation lives
 *      inside the template itself.
 *   5. Backward-compat: `miniCycleNumber` omitted → falls back to
 *      date-hash (legacy path still works for callers without context).
 *   6. Builder integration: `buildWorkoutsFromCoach` with
 *      `rotationContext.miniCycleNumber` threads the mini-cycle down to
 *      template selection. mc=1 vs mc=2 on the same synthetic week
 *      produce different templates for vo2 / sprint / glycolytic.
 */

import {
  conditioningCategoryToExerciseName,
  conditioningDateHash,
} from '../utils/sessionBuilder';
import { buildWorkoutsFromCoach } from '../data/defaultProgram';
import type { RotationContext } from '../data/exercisePoolsStrength';
import type { SessionAllocation } from '../utils/coachingEngine';

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

// Mirror the builder's knowledge of each category's template pool.
// If these arrays drift from sessionBuilder.ts the tests fail loudly,
// which is intentional — the rotation contract depends on the pool
// shape staying in sync.
type Cat = 'aerobic_base' | 'sprint' | 'vo2' | 'glycolytic';
const POOL: Record<Cat, string[]> = {
  aerobic_base: ['Long Nasal Run'],
  sprint: [
    'Free Sprint Session',
    'Flying Sprints',
    'Max Effort Sprint Accumulation',
  ],
  vo2: ['4x4 VO2', '1km Repeat Intervals'],
  glycolytic: [
    'MAS 15:15 Blocks',
    '200m/400m Repeat Runs',
    'Tabata Intervals',
    'Inverse Tabata',
    'Footy Fartlek',
  ],
};

// A small set of spread-out dateStrs — stability assertions must hold
// regardless of which date feeds in, because the mc-path ignores it.
const DATES = [
  '2026-04-20',
  '2026-04-23',
  '2026-05-04',
  '2026-05-11',
  '2026-06-01',
];

// ─────────────────────────────────────────────────────────────────
// Section 1: Template stable within a mini-cycle (ignores dateStr)
// ─────────────────────────────────────────────────────────────────
section('1. Template stable within a mini-cycle');
{
  for (const cat of Object.keys(POOL) as Cat[]) {
    for (let mc = 1; mc <= 4; mc++) {
      const seen = new Set<string>();
      for (const d of DATES) {
        seen.add(conditioningCategoryToExerciseName(cat, d, mc));
      }
      assert(
        seen.size === 1,
        `[${cat}] mc=${mc} → single template across ${DATES.length} dates (got ${seen.size}: ${Array.from(seen).join(', ')})`,
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// Section 2: Template rotates across consecutive mini-cycles
// (only for categories with pool ≥ 2 — aerobic_base is 1:1)
// ─────────────────────────────────────────────────────────────────
section('2. Template rotates across consecutive mini-cycles');
{
  for (const cat of Object.keys(POOL) as Cat[]) {
    if (POOL[cat].length < 2) continue;
    for (let mc = 1; mc <= POOL[cat].length; mc++) {
      const prev = conditioningCategoryToExerciseName(cat, DATES[0], mc);
      const next = conditioningCategoryToExerciseName(cat, DATES[0], mc + 1);
      assert(
        prev !== next,
        `[${cat}] mc=${mc} (${prev}) ≠ mc=${mc + 1} (${next})`,
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// Section 3: Full pool walk within N mini-cycles
// ─────────────────────────────────────────────────────────────────
section('3. Full pool walk within N mini-cycles (N = pool length)');
{
  for (const cat of Object.keys(POOL) as Cat[]) {
    const seen = new Set<string>();
    for (let mc = 1; mc <= POOL[cat].length; mc++) {
      seen.add(conditioningCategoryToExerciseName(cat, DATES[0], mc));
    }
    assert(
      seen.size === POOL[cat].length,
      `[${cat}] walks full pool of ${POOL[cat].length} in ${POOL[cat].length} mini-cycles (saw ${seen.size}: ${Array.from(seen).join(', ')})`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────
// Section 4: Index ordering matches pool ordering (sanity check)
//
// mc=1 → entries[0], mc=2 → entries[1], ... with `(mc - 1) mod n`.
// Pins the exact rotation order so pool reordering shows up as a
// deliberate code change, not a silent rotation drift.
// ─────────────────────────────────────────────────────────────────
section('4. Rotation picks entries in pool order');
{
  for (const cat of Object.keys(POOL) as Cat[]) {
    for (let mc = 1; mc <= POOL[cat].length * 2 + 1; mc++) {
      const expected = POOL[cat][(mc - 1) % POOL[cat].length];
      const actual = conditioningCategoryToExerciseName(cat, DATES[0], mc);
      assert(
        actual === expected,
        `[${cat}] mc=${mc} → ${actual} (expected ${expected})`,
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// Section 5: aerobic_base always Long Nasal Run
// ─────────────────────────────────────────────────────────────────
section('5. aerobic_base is 1:1');
{
  for (let mc = 1; mc <= 6; mc++) {
    for (const d of DATES) {
      const name = conditioningCategoryToExerciseName('aerobic_base', d, mc);
      assert(
        name === 'Long Nasal Run',
        `aerobic_base mc=${mc} date=${d} → ${name} (expected Long Nasal Run)`,
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// Section 6: Backward-compat — miniCycleNumber omitted falls back to
// the date-hash path. Same date → same template (legacy determinism).
// ─────────────────────────────────────────────────────────────────
section('6. Backward-compat: omitted miniCycleNumber falls back to date-hash');
{
  for (const cat of Object.keys(POOL) as Cat[]) {
    for (const d of DATES) {
      const picked = conditioningCategoryToExerciseName(cat, d);
      const hash = conditioningDateHash(d);
      const expected = POOL[cat][hash % POOL[cat].length];
      assert(
        picked === expected,
        `[${cat}] date=${d} legacy path → ${picked} (expected ${expected} via hash ${hash})`,
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// Section 7: Builder integration — rotationContext threads mc through
// to the template pick. Same synthetic week at mc=1 vs mc=2 produces
// different templates for categories with pool ≥ 2.
// ─────────────────────────────────────────────────────────────────
section('7. buildWorkoutsFromCoach threads miniCycleNumber into template pick');
{
  // A minimal weekly plan: three standalone conditioning days, one per
  // category with a rotating pool (vo2, sprint, glycolytic). We drive the
  // builder with rotationContext={mc, w=1} and read the resolved
  // exercise name off each workout's first non-warm-up exercise.
  type CatSlot = { dayOfWeek: number; dayName: string; category: Cat; flavour: 'tempo' | 'high-intensity' };
  const catSlots: CatSlot[] = [
    { dayOfWeek: 2, dayName: 'Tuesday',   category: 'vo2',        flavour: 'tempo' },
    { dayOfWeek: 3, dayName: 'Wednesday', category: 'sprint',     flavour: 'high-intensity' },
    { dayOfWeek: 4, dayName: 'Thursday',  category: 'glycolytic', flavour: 'high-intensity' },
  ];

  const coachWorkouts = catSlots.map((s) => ({
    dayOfWeek: s.dayOfWeek,
    name: `${s.category} session`,
    workoutType: 'Conditioning',
    sessionTier: 'core' as const,
    exercises: [] as Array<{ name: string; sets: number; repsMin: number; repsMax: number; weight?: number }>,
  }));

  const weeklyPlan: SessionAllocation[] = catSlots.map((s) => ({
    tier: 'core',
    focus: `${s.category} conditioning`,
    dayOfWeek: s.dayName,
    isHardExposure: s.category !== 'aerobic_base',
    conditioningFlavour: s.flavour,
    conditioningCategory: s.category,
  }));

  function buildAt(mc: number): Record<Cat, string> {
    const ctx: RotationContext = { miniCycleNumber: mc, weekInBlock: 1 };
    const out = buildWorkoutsFromCoach(
      coachWorkouts, `mc-${mc}-w1`, weeklyPlan, undefined, ctx,
    );
    const result = {} as Record<Cat, string>;
    for (const slot of catSlots) {
      const wk = out.find((w) => w.dayOfWeek === slot.dayOfWeek);
      if (!wk) continue;
      // First non-warm-up / non-cooldown exercise is the template anchor;
      // fall back to the workout.name if the block starts with a warm-up.
      const primary = wk.exercises.find((ex) => {
        const n = (ex.exercise?.name || '').toLowerCase();
        return !n.includes('warm-up') && !n.includes('cool-down') && !n.includes('cooldown');
      });
      result[slot.category] = primary?.exercise?.name ?? wk.name;
    }
    return result;
  }

  const mc1 = buildAt(1);
  const mc2 = buildAt(2);

  // Log for human-readable trace
  for (const slot of catSlots) {
    console.log(`  [${slot.category}] mc=1 → ${mc1[slot.category]} | mc=2 → ${mc2[slot.category]}`);
  }

  // vo2 and sprint have pool ≥ 2 → mc=1 and mc=2 must differ
  for (const cat of ['vo2', 'sprint', 'glycolytic'] as Cat[]) {
    assert(
      mc1[cat] !== undefined && mc2[cat] !== undefined,
      `[${cat}] builder produced a template for both mc=1 and mc=2`,
    );
    assert(
      mc1[cat] !== mc2[cat],
      `[${cat}] mc=1 (${mc1[cat]}) ≠ mc=2 (${mc2[cat]})`,
    );
  }

  // Stability within mc across weeks: mc=1/w=1 vs mc=1/w=4 must be
  // identical for every rotating category.
  function buildAtWeek(mc: number, w: number): Record<Cat, string> {
    const ctx: RotationContext = { miniCycleNumber: mc, weekInBlock: w };
    const out = buildWorkoutsFromCoach(
      coachWorkouts, `mc-${mc}-w${w}`, weeklyPlan, undefined, ctx,
    );
    const result = {} as Record<Cat, string>;
    for (const slot of catSlots) {
      const wk = out.find((ww) => ww.dayOfWeek === slot.dayOfWeek);
      if (!wk) continue;
      const primary = wk.exercises.find((ex) => {
        const n = (ex.exercise?.name || '').toLowerCase();
        return !n.includes('warm-up') && !n.includes('cool-down') && !n.includes('cooldown');
      });
      result[slot.category] = primary?.exercise?.name ?? wk.name;
    }
    return result;
  }
  const mc1w1 = buildAtWeek(1, 1);
  const mc1w4 = buildAtWeek(1, 4);
  for (const cat of ['vo2', 'sprint', 'glycolytic'] as Cat[]) {
    assert(
      mc1w1[cat] === mc1w4[cat],
      `[${cat}] template stable across weeks within mc=1 (w1=${mc1w1[cat]} / w4=${mc1w4[cat]})`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────
console.log(`\n${'='.repeat(60)}`);
console.log(`Results: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log(`\nFailures:`);
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
console.log('All conditioningRotation tests passed.');
