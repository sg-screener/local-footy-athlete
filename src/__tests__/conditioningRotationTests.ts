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
  buildConditioningTemplate,
  conditioningCategoryToExerciseName,
  conditioningDateHash,
  DEFAULT_ATHLETE_CONTEXT,
  selectDefaultAerobicErgModalityFromHash,
} from '../utils/sessionBuilder';
import {
  resolveWeekWithConditioning,
  type ScheduleState,
} from '../utils/sessionResolver';
import { buildWorkoutsFromCoach } from '../data/defaultProgram';
import type { RotationContext } from '../data/exercisePoolsStrength';
import type { SessionAllocation } from '../utils/coachingEngine';
import { countWeeklyExposures } from '../rules/weeklyExposureCounts';
import type { DayOfWeek, Workout } from '../types/domain';

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
// Section 5b: default aerobic modality is a deterministic weighted
// 10-bucket policy. Explicit modalities are tested again at the program
// builder boundary below so this remains fallback-only.
// ─────────────────────────────────────────────────────────────────
section('5b. aerobic modality defaults are weighted and deterministic');
{
  const picks = Array.from(
    { length: 10 },
    (_, hash) => selectDefaultAerobicErgModalityFromHash(hash),
  );
  const count = (modality: string): number =>
    picks.filter((pick) => pick === modality).length;

  assert(count('bike') === 4, `weighted buckets contain 40% bike (got ${picks.join(', ')})`);
  assert(count('mixed') === 4, `weighted buckets contain 40% mixed (got ${picks.join(', ')})`);
  assert(count('row') === 1, `weighted buckets contain 10% row (got ${picks.join(', ')})`);
  assert(count('ski') === 1, `weighted buckets contain 10% ski (got ${picks.join(', ')})`);
  assert(
    selectDefaultAerobicErgModalityFromHash(37) ===
      selectDefaultAerobicErgModalityFromHash(37),
    'same hash always returns the same aerobic modality',
  );

  const firstSeedFor = (wanted: 'bike' | 'mixed' | 'row' | 'ski'): string => {
    for (let i = 0; i < 100; i++) {
      const seed = `aerobic-default-${i}`;
      if (selectDefaultAerobicErgModalityFromHash(conditioningDateHash(seed)) === wanted) {
        return seed;
      }
    }
    throw new Error(`No deterministic seed found for ${wanted}`);
  };
  const textOf = (rows: ReturnType<typeof buildConditioningTemplate>): string =>
    rows.map((row) => `${row.exercise?.name ?? ''}\n${row.notes ?? ''}`).join('\n');

  const bikeText = textOf(buildConditioningTemplate('Long Nasal Run', firstSeedFor('bike')));
  const mixedSeed = firstSeedFor('mixed');
  const mixedText = textOf(buildConditioningTemplate('Long Nasal Run', mixedSeed));
  const rowText = textOf(buildConditioningTemplate('Long Nasal Run', firstSeedFor('row')));
  const skiText = textOf(buildConditioningTemplate('Long Nasal Run', firstSeedFor('ski')));
  assert(/Assault Bike/i.test(bikeText), `bike bucket builds bike zone 2 (got "${bikeText}")`);
  assert(
    /Mixed Erg Block/i.test(mixedText) && /Bike and Rower\/SkiErg/i.test(mixedText),
    `mixed bucket builds bike + row/ski blocks (got "${mixedText}")`,
  );
  assert(/Rower/i.test(rowText), `row bucket builds RowErg intervals (got "${rowText}")`);
  assert(/SkiErg/i.test(skiText), `ski bucket builds SkiErg intervals (got "${skiText}")`);
  assert(
    mixedText === textOf(buildConditioningTemplate('Long Nasal Run', mixedSeed)),
    'same aerobic template inputs produce identical modality and prescription',
  );

  for (const [label, text] of [
    ['mixed', mixedText],
    ['row', rowText],
    ['ski', skiText],
  ] as const) {
    assert(
      !/\b(?:1[1-9]|[2-9]\d)min zone 2 on (?:Rower|SkiErg)/i.test(text),
      `${label} default has no continuous Row/Ski block longer than 10min`,
    );
    assert(
      /2min complete rest between blocks/i.test(text),
      `${label} default uses complete rest between aerobic blocks (got "${text}")`,
    );
    assert(
      !/easy between blocks/i.test(text),
      `${label} default does not prescribe easy work during between-block rest`,
    );
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
// Section 8: Combined lower + aerobic-base copy is concise and
// athlete-facing. This is copy-only: duration, zone, intensity, and
// modality flexibility stay on the same builder path.
// ─────────────────────────────────────────────────────────────────
section('8. combined lower + aerobic-base copy');
{
  const out = buildConditioningTemplate('Long Nasal Run', '2026-06-01', {
    combined: true,
    strengthRegion: 'lower',
    ergModality: 'bike',
  });
  const primary = out.find((ex) => ex.exercise?.name?.includes('zone 2'));
  const title = primary?.exercise?.name ?? '';
  const notes = primary?.notes ?? '';

  assert(
    title === '25min zone 2 bike',
    `combined aerobic title is concise (got "${title}")`,
  );
  assert(
    notes.includes('Machine options: Bike or Assault Bike can be continuous; Rower or SkiErg should be 3 x 8min with 2min complete rest.'),
    'combined aerobic notes mention machine options clearly',
  );
  assert(
    !/\b(?:1[1-9]|[2-9]\d)min zone 2 on (?:Rower|SkiErg)/i.test(notes),
    `combined aerobic notes do not prescribe long continuous row/ski (got "${notes}")`,
  );
  assert(
    notes.includes('5-6/10 effort'),
    'combined aerobic notes keep the existing intensity prescription',
  );
  assert(
    notes.includes('Machine-based conditioning keeps running load down today.'),
    'combined aerobic notes give the short lower-day reason',
  );
  assert(
    !/Combined S\+C day|abbreviated conditioning dose|Can also be completed|Intensity:/i.test(notes),
    `combined aerobic notes avoid technical/duplicate copy (got "${notes}")`,
  );
}

// ─────────────────────────────────────────────────────────────────
// Section 8b: explicit plan modality wins before weighted defaults.
// ─────────────────────────────────────────────────────────────────
section('8b. explicit aerobic modality remains authoritative');
{
  const explicitPlan: SessionAllocation[] = [{
    tier: 'core',
    focus: 'Lower strength + easy aerobic finisher',
    dayOfWeek: 'Monday',
    isHardExposure: false,
    strengthPattern: 'lower',
    hasCombinedConditioning: true,
    attachedConditioningKind: 'finisher',
    conditioningFlavour: 'aerobic',
    conditioningCategory: 'aerobic_base',
    ergModality: 'ski',
  }];
  const [workout] = buildWorkoutsFromCoach([], 'mc-explicit-aerobic-modality', explicitPlan, undefined, {
    miniCycleNumber: 1,
    weekInBlock: 1,
    weekStartISO: '2026-06-01',
  });
  const text = workout.exercises
    .map((row) => `${row.exercise?.name ?? ''}\n${row.notes ?? ''}`)
    .join('\n');
  assert(/SkiErg/i.test(text), `explicit SkiErg survives weekly default selection (got "${text}")`);
  assert(
    !/\b(?:1[1-9]|[2-9]\d)min zone 2 on SkiErg/i.test(text),
    'explicit SkiErg remains intervalised for longer zone-2 work',
  );
  assert(/2min complete rest between blocks/i.test(text), 'explicit SkiErg uses complete rest');
}

// ─────────────────────────────────────────────────────────────────
// Section 9: Conditioning prescriptions stay glanceable across
// interval and sprint templates.
// ─────────────────────────────────────────────────────────────────
section('9. conditioning card copy stays terse globally');
{
  const banned = /Complete all phases|Keep this block|Can also be completed|Intensity:|Purpose:|Rules:|quality > volume|Must feel/i;
  const primaryNotes = (out: ReturnType<typeof buildConditioningTemplate>): string => {
    const primary = out.find((ex) => {
      const n = ex.exercise?.name?.toLowerCase() ?? '';
      return !n.includes('warm-up') && !n.includes('cool-down') && !n.includes('cooldown');
    });
    return primary?.notes ?? '';
  };
  const nonEmptyLineCount = (text: string): number =>
    text.split('\n').map((line) => line.trim()).filter(Boolean).length;

  const vo2Notes = primaryNotes(buildConditioningTemplate('4x4 VO2', '2026-06-01', {
    combined: true,
    strengthRegion: 'upper',
    ergModality: 'bike',
    feel: 'grindy',
  }));
  assert(/3 x 3min hard on Assault Bike/i.test(vo2Notes), `VO2 notes show prescription (got "${vo2Notes}")`);
  assert(/90s easy between reps/i.test(vo2Notes), `VO2 notes show rest (got "${vo2Notes}")`);
  assert(/8-9\/10 effort/i.test(vo2Notes), `VO2 notes show effort (got "${vo2Notes}")`);

  const sprintNotes = primaryNotes(buildConditioningTemplate('Max Effort Sprint Accumulation', '2026-06-01', {
    combined: true,
    strengthRegion: 'lower',
    ergModality: 'mixed',
    feel: 'sharp',
  }));
  assert(/hard on Row \+ SkiErg/i.test(sprintNotes), `sprint notes use canonical mixed modality (got "${sprintNotes}")`);
  assert(/90s easy between reps/i.test(sprintNotes), `sprint notes show rest (got "${sprintNotes}")`);
  assert(/Full quality/i.test(sprintNotes), `sprint notes show quality cue (got "${sprintNotes}")`);
  assert(/Machine-based conditioning keeps running load down today/i.test(sprintNotes), `sprint notes keep one lower-day note (got "${sprintNotes}")`);

  const skiHardNotes = primaryNotes(buildConditioningTemplate('Tabata Intervals', '2026-06-01', {
    combined: true,
    strengthRegion: 'upper',
    ergModality: 'ski',
    feel: 'grindy',
  }));
  assert(/4 x 2min hard on SkiErg/i.test(skiHardNotes), `SkiErg hard notes show prescription (got "${skiHardNotes}")`);
  assert(/2min easy between reps/i.test(skiHardNotes), `SkiErg hard notes show rest (got "${skiHardNotes}")`);
  assert(/8-9\/10 effort/i.test(skiHardNotes), `SkiErg hard notes show effort (got "${skiHardNotes}")`);
  assert(/Use Bike, Rower, SkiErg, or Assault Bike/i.test(skiHardNotes), `upper flexible notes keep one machine-options line (got "${skiHardNotes}")`);

  for (const [label, notes] of [
    ['vo2', vo2Notes],
    ['sprint', sprintNotes],
    ['ski hard', skiHardNotes],
  ] as const) {
    assert(!banned.test(notes), `${label} notes avoid verbose/system copy (got "${notes}")`);
    assert(nonEmptyLineCount(notes) <= 4, `${label} notes stay within four short lines (got "${notes}")`);
  }
}

// ─────────────────────────────────────────────────────────────────
// Section 10: Machine sprint duration follows modality mechanics.
// Assault Bike can use short all-out bursts; Rower, SkiErg, BikeErg,
// and mixed erg sessions use longer hard efforts.
// ─────────────────────────────────────────────────────────────────
section('10. machine sprint duration is modality-aware');
{
  const primary = (out: ReturnType<typeof buildConditioningTemplate>) => {
    const ex = out.find((row) => {
      const n = row.exercise?.name?.toLowerCase() ?? '';
      return !n.includes('warm-up') && !n.includes('cool-down') && !n.includes('cooldown');
    });
    return {
      name: ex?.exercise?.name ?? '',
      notes: ex?.notes ?? '',
    };
  };
  const workSeconds = (notes: string): number | null => {
    const match = notes.match(/\b\d+\s+x\s+(\d+)s\s+(?:all-out|hard)\s+on/i);
    return match ? Number(match[1]) : null;
  };

  const assaultSharp = primary(buildConditioningTemplate('Max Effort Sprint Accumulation', '2026-06-01', {
    ergModality: 'bike',
    feel: 'sharp',
  }));
  const assaultGrindy = primary(buildConditioningTemplate('Max Effort Sprint Accumulation', '2026-06-01', {
    ergModality: 'bike',
    feel: 'grindy',
  }));
  assert(/10s all-out on Assault Bike/i.test(assaultSharp.notes), `Assault Bike sharp sprint can be 10s (got "${assaultSharp.notes}")`);
  assert(/15s all-out on Assault Bike/i.test(assaultGrindy.notes), `Assault Bike grindy sprint can be 15s (got "${assaultGrindy.notes}")`);

  const ski = primary(buildConditioningTemplate('Max Effort Sprint Accumulation', '2026-06-01', {
    ergModality: 'ski',
    feel: 'sharp',
  }));
  assert(/SkiErg/i.test(`${ski.name}\n${ski.notes}`), `SkiErg sprint is labelled (got "${ski.name}" / "${ski.notes}")`);
  assert(workSeconds(ski.notes)! >= 20, `SkiErg sprint is at least 20s (got "${ski.notes}")`);
  assert(!/\b10s\s+(?:all-out|hard)\s+on SkiErg/i.test(ski.notes), `SkiErg sprint is not 10s (got "${ski.notes}")`);

  const rower = primary(buildConditioningTemplate('Max Effort Sprint Accumulation', '2026-06-01', {
    ergModality: 'row',
    feel: 'sharp',
  }));
  assert(/Rower/i.test(`${rower.name}\n${rower.notes}`), `Rower sprint is labelled (got "${rower.name}" / "${rower.notes}")`);
  assert(workSeconds(rower.notes)! >= 20, `Rower sprint is at least 20s (got "${rower.notes}")`);
  assert(!/\b10s\s+(?:all-out|hard)\s+on Rower/i.test(rower.notes), `Rower sprint is not 10s (got "${rower.notes}")`);

  const bikeErg = primary(buildConditioningTemplate('Max Effort Sprint Accumulation', '2026-06-01', {
    ergModality: 'bike_erg',
    feel: 'sharp',
  }));
  assert(/BikeErg/i.test(`${bikeErg.name}\n${bikeErg.notes}`), `BikeErg sprint is labelled (got "${bikeErg.name}" / "${bikeErg.notes}")`);
  assert(workSeconds(bikeErg.notes)! >= 20, `BikeErg sprint is at least 20s (got "${bikeErg.notes}")`);
  assert(!/\b10s\s+(?:all-out|hard)\s+on BikeErg/i.test(bikeErg.notes), `BikeErg sprint is not 10s (got "${bikeErg.notes}")`);

  const mixed = primary(buildConditioningTemplate('Max Effort Sprint Accumulation', '2026-06-01', {
    combined: true,
    strengthRegion: 'lower',
    ergModality: 'mixed',
    feel: 'sharp',
  }));
  assert(/Row \+ SkiErg/i.test(`${mixed.name}\n${mixed.notes}`), `mixed sprint is labelled (got "${mixed.name}" / "${mixed.notes}")`);
  assert(workSeconds(mixed.notes)! >= 20, `mixed erg sprint is at least 20s (got "${mixed.notes}")`);
  assert(!/\b10s\s+(?:all-out|hard)\s+on Row \+ SkiErg/i.test(mixed.notes), `mixed erg sprint is not 10s (got "${mixed.notes}")`);
}

// ─────────────────────────────────────────────────────────────────
// Section 11: Running exposure caps seed from anchors before app
// conditioning is placed. Team training and games/practice matches
// already count toward the Bible cap.
// ─────────────────────────────────────────────────────────────────
section('11. running cap seeds from team training and games');
{
  const weekStart = '2026-06-01';
  const dayNum: Record<DayOfWeek, number> = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };
  const dateForDay: Record<DayOfWeek, string> = {
    Monday: '2026-06-01',
    Tuesday: '2026-06-02',
    Wednesday: '2026-06-03',
    Thursday: '2026-06-04',
    Friday: '2026-06-05',
    Saturday: '2026-06-06',
    Sunday: '2026-06-07',
  };

  const teamTraining = (day: DayOfWeek): Workout => ({
    id: `team-training-${day.toLowerCase()}`,
    microcycleId: 'mc-running-cap',
    dayOfWeek: dayNum[day],
    name: 'Team Training',
    description: 'Club field session',
    durationMinutes: 90,
    intensity: 'High',
    workoutType: 'Team Training',
    sessionTier: 'core',
    exercises: [],
    createdAt: '',
    updatedAt: '',
  });

  const stateForTeamDays = (teamDays: DayOfWeek[]): ScheduleState => {
    const workouts = teamDays.map(teamTraining);
    const microcycle = {
      id: 'mc-running-cap',
      programId: 'program-running-cap',
      weekNumber: 1,
      startDate: weekStart,
      endDate: '2026-06-07',
      miniCycleNumber: 1,
      intensityMultiplier: 1,
      workouts,
      createdAt: '',
      updatedAt: '',
    };
    return {
      currentProgram: {
        id: 'program-running-cap',
        userId: 'test-user',
        name: 'Running cap test',
        description: '',
        programPhase: 'Pre-Season-Skills',
        startDate: weekStart,
        endDate: '2026-06-07',
        microcycles: [microcycle],
        primaryFocus: 'Conditioning',
        isActive: true,
        createdAt: '',
        updatedAt: '',
      },
      currentMicrocycle: microcycle,
      manualOverrides: {},
      markedDays: { '2026-06-07': 'game' },
      athleteContext: {
        ...DEFAULT_ATHLETE_CONTEXT,
        onboardingData: {
          seasonPhase: 'In-season',
          teamTrainingDays: teamDays,
          teamTrainingDaysPerWeek: teamDays.length,
        },
      },
      seasonPhase: 'In-season',
      readiness: 'high',
      sessionFeedback: {},
      availableDayNumbers: [1, 2, 3, 4, 5, 6, 0],
    };
  };

  const appRunningUnits = (week: ReturnType<typeof resolveWeekWithConditioning>) => {
    const counts = countWeeklyExposures(week.map((day) => ({ date: day.date, workout: day.workout })));
    return counts.days.flatMap((day) =>
      day.units
        .filter((unit) =>
          unit.category !== 'team_training' &&
          unit.category !== 'game' &&
          (unit.modality === 'running' || unit.modality === 'mixed'))
        .map((unit) => ({ date: day.date, category: unit.category, modality: unit.modality })),
    );
  };

  const twoTeamWeek = resolveWeekWithConditioning(
    weekStart,
    stateForTeamDays(['Tuesday', 'Thursday']),
  );
  const twoTeamCounts = countWeeklyExposures(
    twoTeamWeek.map((day) => ({ date: day.date, workout: day.workout })),
  );
  assert(twoTeamCounts.teamTrainingSessions === 2, `2TT week counts team anchors (got ${twoTeamCounts.teamTrainingSessions})`);
  assert(twoTeamCounts.games === 1, `2TT week counts game/practice-match anchor (got ${twoTeamCounts.games})`);
  assert(twoTeamCounts.runningExposures >= 3, `2TT+game week seeds running exposure count from anchors (got ${twoTeamCounts.runningExposures})`);
  assert(twoTeamCounts.runningExposures <= 4, `2TT+game week stays within running cap (got ${twoTeamCounts.runningExposures})`);

  const cappedWeek = resolveWeekWithConditioning(
    weekStart,
    stateForTeamDays(['Monday', 'Tuesday', 'Thursday']),
  );
  const cappedCounts = countWeeklyExposures(
    cappedWeek.map((day) => ({ date: day.date, workout: day.workout })),
  );
  assert(cappedCounts.teamTrainingSessions === 3, `3TT week counts team anchors (got ${cappedCounts.teamTrainingSessions})`);
  assert(cappedCounts.games === 1, `3TT week counts game/practice-match anchor (got ${cappedCounts.games})`);
  assert(cappedCounts.runningExposures <= 4, `3TT+game week does not add extra running above cap (got ${cappedCounts.runningExposures})`);
  assert(appRunningUnits(cappedWeek).length === 0, `app-added conditioning is off-feet once anchors hit cap (got ${JSON.stringify(appRunningUnits(cappedWeek))})`);
  assert(dateForDay.Sunday === cappedWeek[6]?.date, 'Sunday game date stays inside the resolved test week');
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
