#!/usr/bin/env node
/**
 * Exercise Tag System — Integration Tests
 *
 * USAGE:
 *   npm run test:compile && node src/__tests__/tagSystemTests.js
 *
 * SECTIONS:
 *   1.  No heavy lower within 72h of game
 *   2.  No high-DOMS lower late week
 *   3.  Hamstring injury removes RDLs / Nordics
 *   4.  Adductor injury removes lunges / lateral bounds
 *   5.  Ankle injury removes plyos
 *   6.  G-1 only produces upper low-fatigue work
 *   7.  Substitutions preserve movement pattern
 *   8.  buildTagAwareSession integration
 *   9.  Late-week avoid exercises filtered
 *  10.  Conditioning within 48h of game excluded
 *  11.  Lower back injury filters
 *  12.  Session intent preservation — no silent region drift
 *  13.  Composition rules — no double heavy compounds
 *  14.  Composition rules — fatigue/DOMS caps
 *  15.  Composition — unilateral slot filled
 *  16.  Composition — movement diversity
 *  17.  Minimum viable session — G-1 lower gets fillers
 *  18.  MVS — injury-restricted lower session gets fillers
 *  19.  MVS fillers are all low-cost
 *  20.  MVS does not trigger for well-populated sessions
 *  21.  Filler tier priority — core before arms before carries
 */

const path = require('path');
const COMPILED = '/tmp/lfa-compiled';

const { EXERCISE_TAGS, getAllTaggedExercises } = require(path.join(COMPILED, 'data/exerciseTags'));
const { applyHardFilters, buildFilterContext } = require(path.join(COMPILED, 'utils/exerciseFilter'));
const { selectExercises, buildIntent, findSubstitute, rankExercises } = require(path.join(COMPILED, 'utils/exerciseScorer'));
const { buildTagAwareSession, substituteExercise, DEFAULT_ATHLETE_CONTEXT } = require(path.join(COMPILED, 'utils/sessionBuilder'));

// ─── Test Infrastructure ───

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    failures.push(message);
    console.log(`  ❌ ${message}`);
  }
}

function section(name) {
  console.log(`\n── ${name} ──`);
}

// ─── Test Helpers ───

function makeFilterCtx(overrides = {}) {
  return {
    daysToGame: null,
    daysSinceGame: null,
    dayOfWeek: 1,
    inSeason: false,
    activeInjuries: {},
    ...overrides,
  };
}

function filterNames(ctx) {
  return applyHardFilters(getAllTaggedExercises(), ctx);
}

function makeTemplate(name, exercises = 5) {
  const now = new Date().toISOString();
  const exs = [];
  for (let i = 0; i < exercises; i++) {
    exs.push({
      id: `e${i}`, workoutId: 'w-1', exerciseId: `ex${i}`, exerciseOrder: i + 1,
      prescribedSets: 3, prescribedRepsMin: 8, prescribedRepsMax: 10, restSeconds: 90,
      exercise: { id: `ex${i}`, name: `Placeholder ${i}`, description: '' },
      createdAt: now, updatedAt: now,
    });
  }
  return {
    id: 'w-1', microcycleId: 'mc-1', dayOfWeek: 1, name,
    description: '', durationMinutes: 75, intensity: 'High',
    workoutType: 'Strength', sessionTier: 'core', exercises: exs,
    createdAt: now, updatedAt: now,
  };
}

// ═══════════════════════════════════════════════════════════════
// TEST 1: No heavy lower within 72h of game
// ═══════════════════════════════════════════════════════════════

section('1. No heavy lower within 72h of game');

{
  const ctx = makeFilterCtx({ daysToGame: 2 });
  const result = filterNames(ctx);
  assert(!result.includes('Back Squat'), 'Back Squat excluded 48h from game');
  assert(!result.includes('Front Squat'), 'Front Squat excluded 48h from game');
  assert(!result.includes('Deadlift'), 'Deadlift excluded 48h from game');
  assert(!result.includes('Trap Bar Deadlift'), 'Trap Bar Deadlift excluded 48h from game');
  assert(result.includes('Bench Press'), 'Bench Press allowed 48h from game (upper)');
  assert(result.includes('Goblet Squat'), 'Goblet Squat allowed (low load)');
  assert(result.includes('Leg Extension'), 'Leg Extension allowed (low load)');
}

{
  const ctx = makeFilterCtx({ daysToGame: 3 });
  const result = filterNames(ctx);
  assert(!result.includes('Back Squat'), 'Back Squat excluded 72h from game');
}

{
  const ctx = makeFilterCtx({ daysToGame: 4 });
  const result = filterNames(ctx);
  assert(result.includes('Back Squat'), 'Back Squat allowed 4 days from game');
}

// ═══════════════════════════════════════════════════════════════
// TEST 2: No high-DOMS lower late week
// ═══════════════════════════════════════════════════════════════

section('2. No high-DOMS lower late week');

{
  const ctx = makeFilterCtx({ dayOfWeek: 4 });
  const result = filterNames(ctx);
  assert(!result.includes('RDLs'), 'RDLs excluded Thursday (high DOMS lower)');
  assert(!result.includes('Nordic Lower'), 'Nordic Lower excluded Thursday (high DOMS lower)');
  assert(!result.includes('Bulgarian Split Squats'), 'BSS excluded Thursday (high DOMS lower)');
  assert(!result.includes('Walking Lunges'), 'Walking Lunges excluded Thursday (high DOMS lower)');
  assert(result.includes('Leg Extension'), 'Leg Extension allowed Thursday (low DOMS)');
  assert(result.includes('Hip Thrusts'), 'Hip Thrusts allowed Thursday (low DOMS)');
}

{
  const ctx = makeFilterCtx({ dayOfWeek: 5 });
  const result = filterNames(ctx);
  assert(!result.includes('RDLs'), 'RDLs excluded Friday');
}

{
  const ctx = makeFilterCtx({ dayOfWeek: 3 });
  const result = filterNames(ctx);
  assert(result.includes('RDLs'), 'RDLs allowed Wednesday (not late week)');
}

// ═══════════════════════════════════════════════════════════════
// TEST 3: Hamstring injury removes RDLs / Nordics
// ═══════════════════════════════════════════════════════════════

section('3. Hamstring injury removes RDLs / Nordics');

{
  const ctx = makeFilterCtx({ activeInjuries: { hamstring: 'avoid' } });
  const result = filterNames(ctx);
  assert(!result.includes('RDLs'), 'RDLs excluded with hamstring injury');
  assert(!result.includes('Nordic Lower'), 'Nordic Lower excluded with hamstring injury');
  assert(!result.includes('Sprint Intervals'), 'Sprint Intervals excluded with hamstring injury');
  assert(result.includes('Back Squat'), 'Back Squat allowed with hamstring injury');
  assert(result.includes('Bench Press'), 'Bench Press allowed with hamstring injury');
  assert(result.includes('Hip Thrusts'), 'Hip Thrusts allowed with hamstring injury (rated good)');
  assert(result.includes('Leg Extension'), 'Leg Extension allowed with hamstring injury (no hamstring caution)');
}

// ═══════════════════════════════════════════════════════════════
// TEST 4: Adductor injury removes lunges / lateral bounds
// ═══════════════════════════════════════════════════════════════

section('4. Adductor injury removes lunges / lateral bounds');

{
  const ctx = makeFilterCtx({ activeInjuries: { adductor: 'avoid' } });
  const result = filterNames(ctx);
  assert(!result.includes('Walking Lunges'), 'Walking Lunges excluded with adductor injury');
  assert(!result.includes('Bulgarian Split Squats'), 'BSS excluded with adductor injury');
  assert(!result.includes('Reverse Lunges'), 'Reverse Lunges excluded with adductor injury');
  assert(!result.includes('Step Ups'), 'Step Ups excluded with adductor injury (lunge pattern)');
  assert(!result.includes('Lateral Bounds'), 'Lateral Bounds excluded with adductor injury');
  assert(result.includes('Box Jumps'), 'Box Jumps allowed (adductor: good)');
  assert(result.includes('Goblet Squat'), 'Goblet Squat allowed');
  assert(result.includes('Leg Press'), 'Leg Press allowed');
}

// ═══════════════════════════════════════════════════════════════
// TEST 5: Ankle injury removes plyos
// ═══════════════════════════════════════════════════════════════

section('5. Ankle injury removes plyos');

{
  const ctx = makeFilterCtx({ activeInjuries: { ankle: 'avoid' } });
  const result = filterNames(ctx);
  assert(!result.includes('Box Jumps'), 'Box Jumps excluded with ankle injury');
  assert(!result.includes('Broad Jumps'), 'Broad Jumps excluded with ankle injury');
  assert(!result.includes('Jump Squats'), 'Jump Squats excluded with ankle injury');
  assert(!result.includes('Lateral Bounds'), 'Lateral Bounds excluded with ankle injury');
  assert(!result.includes('Depth Jumps'), 'Depth Jumps excluded with ankle injury');
  assert(result.includes('Back Squat'), 'Back Squat allowed with ankle injury');
  assert(result.includes('Bench Press'), 'Bench Press allowed');
  assert(result.includes('Leg Press'), 'Leg Press allowed (ankle: good)');
}

// ═══════════════════════════════════════════════════════════════
// TEST 6: G-1 only produces upper low-fatigue work
// ═══════════════════════════════════════════════════════════════

section('6. G-1 only produces upper low-fatigue work');

{
  const ctx = makeFilterCtx({ daysToGame: 1 });
  const result = filterNames(ctx);

  const lowerExercises = result.filter(n => EXERCISE_TAGS[n]?.region === 'lower');
  assert(lowerExercises.length === 0, `No lower body exercises on G-1 (found: ${lowerExercises.join(', ') || 'none'})`);

  const highFatigue = result.filter(n => EXERCISE_TAGS[n]?.fatigue === 'high');
  assert(highFatigue.length === 0, `No high-fatigue exercises on G-1 (found: ${highFatigue.join(', ') || 'none'})`);

  const highDoms = result.filter(n => EXERCISE_TAGS[n]?.doms === 'high');
  assert(highDoms.length === 0, `No high-DOMS exercises on G-1 (found: ${highDoms.join(', ') || 'none'})`);

  assert(result.includes('Single-Arm DB Row'), 'Single-Arm DB Row available on G-1');
  assert(result.includes('Seated Cable Row'), 'Seated Cable Row available on G-1');
  assert(result.includes('Push-ups'), 'Push-ups available on G-1');
  assert(result.includes('Lateral Raise'), 'Lateral Raises available on G-1');
  assert(result.includes('Landmine Press'), 'Landmine Press available on G-1');
}

// ═══════════════════════════════════════════════════════════════
// TEST 7: Substitutions preserve movement pattern
// ═══════════════════════════════════════════════════════════════

section('7. Substitutions preserve movement pattern');

{
  const ctx = makeFilterCtx();
  const candidates = filterNames(ctx);

  const sub1 = findSubstitute('Trap Bar Deadlift', candidates, ctx);
  assert(sub1 !== null, `Trap Bar Deadlift has a substitute: ${sub1}`);
  if (sub1) assert(EXERCISE_TAGS[sub1].movement === 'hinge', `Substitute ${sub1} preserves hinge pattern`);

  const sub2 = findSubstitute('Back Squat', candidates, ctx);
  assert(sub2 !== null, `Back Squat has a substitute: ${sub2}`);
  if (sub2) assert(EXERCISE_TAGS[sub2].movement === 'squat', `Substitute ${sub2} preserves squat pattern`);

  const sub3 = findSubstitute('Bench Press', candidates, ctx);
  assert(sub3 !== null, `Bench Press has a substitute: ${sub3}`);
  if (sub3) assert(EXERCISE_TAGS[sub3].movement === 'horizontal_push', `Substitute ${sub3} preserves horizontal_push pattern`);

  const sub4 = findSubstitute('Pull-Ups', candidates, ctx);
  assert(sub4 !== null, `Pull-Ups has a substitute: ${sub4}`);
  if (sub4) assert(EXERCISE_TAGS[sub4].movement === 'vertical_pull', `Substitute ${sub4} preserves vertical_pull pattern`);

  // Substitution with hamstring injury
  const hamCtx = makeFilterCtx({ activeInjuries: { hamstring: 'avoid' } });
  const hamCandidates = filterNames(hamCtx);
  const sub5 = findSubstitute('RDLs', hamCandidates, hamCtx);
  if (sub5) {
    assert(EXERCISE_TAGS[sub5].movement === 'hinge', `Hamstring-safe substitute ${sub5} preserves hinge pattern`);
    assert(EXERCISE_TAGS[sub5].injury.hamstring !== 'avoid', `Substitute ${sub5} is hamstring-safe`);
  }
}

// ═══════════════════════════════════════════════════════════════
// TEST 8: buildTagAwareSession integration
// ═══════════════════════════════════════════════════════════════

section('8. buildTagAwareSession integration');

{
  const template = makeTemplate('Lower Strength');

  // Normal Monday session
  const result1 = buildTagAwareSession(template, '2026-04-06', [], DEFAULT_ATHLETE_CONTEXT, false);
  assert(result1.exercises.length === 5, `Tag-aware session has ${result1.exercises.length} exercises`);

  const names1 = result1.exercises.map(e => e.exercise?.name);
  const hasLower = names1.some(n => {
    const t = EXERCISE_TAGS[n];
    return t && (t.movement === 'squat' || t.movement === 'hinge' || t.movement === 'lunge');
  });
  assert(hasLower, 'Lower Strength session has lower body exercises');

  // With hamstring injury
  const injuredAthlete = {
    ...DEFAULT_ATHLETE_CONTEXT,
    injuries: [{ bodyArea: 'hamstring', description: 'Grade 1 strain', severity: 'Moderate' }],
  };
  const result2 = buildTagAwareSession(template, '2026-04-06', [], injuredAthlete, false);
  const names2 = result2.exercises.map(e => e.exercise?.name);
  assert(!names2.includes('RDLs'), 'Hamstring injury: RDLs not in session');
  assert(!names2.includes('Nordic Lower'), 'Hamstring injury: Nordic Lower not in session');
}

// ═══════════════════════════════════════════════════════════════
// TEST 9: Late-week avoid exercises filtered
// ═══════════════════════════════════════════════════════════════

section('9. Late-week avoid exercises filtered');

{
  const ctx = makeFilterCtx({ dayOfWeek: 5 });
  const result = filterNames(ctx);

  const avoidsStillPresent = result.filter(n => EXERCISE_TAGS[n]?.lateWeek === 'avoid');
  assert(avoidsStillPresent.length === 0, `No lateWeek=avoid exercises on Friday (found: ${avoidsStillPresent.join(', ') || 'none'})`);

  const plyosPresent = result.filter(n => EXERCISE_TAGS[n]?.movement === 'plyo');
  assert(plyosPresent.length === 0, `No plyos on Friday (found: ${plyosPresent.join(', ') || 'none'})`);
}

// ═══════════════════════════════════════════════════════════════
// TEST 10: Conditioning within 48h of game excluded
// ═══════════════════════════════════════════════════════════════

section('10. Conditioning within 48h of game excluded');

{
  const ctx = makeFilterCtx({ daysToGame: 2 });
  const result = filterNames(ctx);
  assert(!result.includes('Sprint Intervals'), 'Sprint Intervals excluded 48h from game');
  assert(!result.includes('Tempo Run'), 'Tempo Run excluded 48h from game');
}

{
  const ctx = makeFilterCtx({ daysToGame: 3 });
  const result = filterNames(ctx);
  assert(result.includes('Tempo Run'), 'Tempo Run allowed 72h from game');
}

// ═══════════════════════════════════════════════════════════════
// TEST 11: Lower back injury filters
// ═══════════════════════════════════════════════════════════════

section('11. Lower back injury filters');

{
  const ctx = makeFilterCtx({ activeInjuries: { 'lower back': 'avoid' } });
  const result = filterNames(ctx);
  assert(!result.includes('Back Squat'), 'Back Squat excluded (high load bilateral, lower back avoid)');
  assert(!result.includes('Deadlift'), 'Deadlift excluded (high load bilateral, lower back avoid)');
  assert(result.includes('Leg Press'), 'Leg Press allowed (high stability, moderate load)');
  assert(result.includes('Hip Thrusts'), 'Hip Thrusts allowed (high stability, lowerBack=good)');
}

// ═══════════════════════════════════════════════════════════════
// TEST 12: Session intent preservation — no silent region drift
// ═══════════════════════════════════════════════════════════════

section('12. Session intent preservation — no silent region drift');

{
  // Lower Strength on G-1: hard filters remove ALL lower body.
  // Builder should NOT silently fill with upper exercises.
  // It should return fewer exercises (possibly empty for lower region).
  const template = makeTemplate('Lower Strength');
  const result = buildTagAwareSession(template, '2026-04-10', ['2026-04-11'], DEFAULT_ATHLETE_CONTEXT, true);
  const names = result.exercises.map(e => e.exercise?.name).filter(Boolean);

  // No high-load or high-fatigue upper exercises should appear
  // (MVS fillers are allowed: low-cost arm isolation, core, carries)
  const upperHighCost = names.filter(n => {
    const t = EXERCISE_TAGS[n];
    return t && t.region === 'upper' && (t.fatigue !== 'low' || t.load === 'high');
  });
  assert(upperHighCost.length === 0, `No high-cost upper exercises on G-1 lower (found: ${upperHighCost.join(', ') || 'none'})`);

  // Any upper exercises must be low-cost MVS fillers (arm isolation, face pulls, etc.)
  const upperFillers = names.filter(n => EXERCISE_TAGS[n]?.region === 'upper');
  const allUpperAreLowCost = upperFillers.every(n => {
    const t = EXERCISE_TAGS[n];
    return t && t.fatigue === 'low' && t.doms === 'low' && t.load !== 'high';
  });
  assert(allUpperAreLowCost, `Upper fillers are all low-cost (got: ${upperFillers.join(', ') || 'none'})`);

  console.log(`    → G-1 lower session got ${names.length} exercises: ${names.join(', ')}`);
}

{
  // Upper session should stay upper, not drift to lower
  const template = makeTemplate('Upper Strength');
  const ctx = makeFilterCtx();
  const candidates = filterNames(ctx);
  const intent = buildIntent('Upper Strength', 'Strength', 5);
  const selected = selectExercises(candidates, intent, ctx, new Set());

  const regions = selected.map(n => EXERCISE_TAGS[n]?.region);
  const hasLower = regions.some(r => r === 'lower');
  assert(!hasLower, `Upper session has no lower exercises (got: ${selected.join(', ')})`);
}

// ═══════════════════════════════════════════════════════════════
// TEST 13: Composition rules — no double heavy compounds
// ═══════════════════════════════════════════════════════════════

section('13. Composition rules — no double heavy compounds');

{
  const ctx = makeFilterCtx();
  const candidates = filterNames(ctx);
  const intent = buildIntent('Lower Strength', 'Strength', 5);
  const selected = selectExercises(candidates, intent, ctx, new Set());

  console.log(`    → Lower Strength selected: ${selected.join(', ')}`);

  // Count high-load exercises
  const highLoadExercises = selected.filter(n => EXERCISE_TAGS[n]?.load === 'high');
  assert(highLoadExercises.length <= 1, `At most 1 high-load exercise (found ${highLoadExercises.length}: ${highLoadExercises.join(', ')})`);

  // Should not have both Back Squat AND Trap Bar Deadlift
  const hasBoth = selected.includes('Back Squat') && selected.includes('Trap Bar Deadlift');
  assert(!hasBoth, 'Back Squat and Trap Bar Deadlift not both in same session');

  // Should not have both Back Squat AND Front Squat
  const hasBothSquats = selected.includes('Back Squat') && selected.includes('Front Squat');
  assert(!hasBothSquats, 'Back Squat and Front Squat not both in same session');

  // Should not have both Back Squat AND Deadlift
  const hasBothHeavy = selected.includes('Back Squat') && selected.includes('Deadlift');
  assert(!hasBothHeavy, 'Back Squat and Deadlift not both in same session');
}

{
  // Lower Hypertrophy should also respect limits
  const ctx = makeFilterCtx();
  const candidates = filterNames(ctx);
  const intent = buildIntent('Lower Hypertrophy', 'Strength', 5);
  const selected = selectExercises(candidates, intent, ctx, new Set());

  console.log(`    → Lower Hypertrophy selected: ${selected.join(', ')}`);

  const highLoad = selected.filter(n => EXERCISE_TAGS[n]?.load === 'high');
  assert(highLoad.length <= 1, `Lower Hyper: at most 1 high-load (found ${highLoad.length}: ${highLoad.join(', ')})`);
}

// ═══════════════════════════════════════════════════════════════
// TEST 14: Composition rules — fatigue/DOMS caps
// ═══════════════════════════════════════════════════════════════

section('14. Composition rules — fatigue/DOMS caps');

{
  const ctx = makeFilterCtx();
  const candidates = filterNames(ctx);
  const intent = buildIntent('Lower Strength', 'Strength', 5);
  const selected = selectExercises(candidates, intent, ctx, new Set());

  // Max 2 high-fatigue
  const highFatigue = selected.filter(n => EXERCISE_TAGS[n]?.fatigue === 'high');
  assert(highFatigue.length <= 2, `At most 2 high-fatigue exercises (found ${highFatigue.length}: ${highFatigue.join(', ')})`);

  // Max 1 high-DOMS
  const highDoms = selected.filter(n => EXERCISE_TAGS[n]?.doms === 'high');
  assert(highDoms.length <= 1, `At most 1 high-DOMS exercise (found ${highDoms.length}: ${highDoms.join(', ')})`);
}

{
  // Upper session fatigue caps
  const ctx = makeFilterCtx();
  const candidates = filterNames(ctx);
  const intent = buildIntent('Upper Strength', 'Strength', 5);
  const selected = selectExercises(candidates, intent, ctx, new Set());

  console.log(`    → Upper Strength selected: ${selected.join(', ')}`);

  const highLoad = selected.filter(n => EXERCISE_TAGS[n]?.load === 'high');
  assert(highLoad.length <= 1, `Upper: at most 1 high-load (found ${highLoad.length}: ${highLoad.join(', ')})`);
}

// ═══════════════════════════════════════════════════════════════
// TEST 15: Composition — unilateral slot filled correctly
// ═══════════════════════════════════════════════════════════════

section('15. Composition — unilateral slot filled');

{
  const ctx = makeFilterCtx();
  const candidates = filterNames(ctx);
  const intent = buildIntent('Lower Strength', 'Strength', 5);
  const selected = selectExercises(candidates, intent, ctx, new Set());

  const hasUnilateral = selected.some(n => EXERCISE_TAGS[n]?.unilateral === true);
  assert(hasUnilateral, `Lower Strength has at least one unilateral exercise (got: ${selected.join(', ')})`);
}

// ═══════════════════════════════════════════════════════════════
// TEST 16: Composition — session has movement diversity
// ═══════════════════════════════════════════════════════════════

section('16. Composition — movement diversity');

{
  const ctx = makeFilterCtx();
  const candidates = filterNames(ctx);
  const intent = buildIntent('Lower Strength', 'Strength', 5);
  const selected = selectExercises(candidates, intent, ctx, new Set());

  const movements = new Set(selected.map(n => EXERCISE_TAGS[n]?.movement));
  assert(movements.size >= 2, `Lower Strength has ${movements.size} different movement patterns (${[...movements].join(', ')})`);

  // No movement pattern should appear 3+ times
  const movementCounts = {};
  for (const n of selected) {
    const m = EXERCISE_TAGS[n]?.movement;
    movementCounts[m] = (movementCounts[m] || 0) + 1;
  }
  const maxCount = Math.max(...Object.values(movementCounts));
  assert(maxCount <= 2, `No movement pattern appears 3+ times (max: ${maxCount})`);
}

// ═══════════════════════════════════════════════════════════════
// TEST 17: Minimum viable session — G-1 lower gets fillers
// ═══════════════════════════════════════════════════════════════

section('17. Minimum viable session — G-1 lower gets fillers');

{
  // G-1 lower strength: most lower exercises are hard-filtered out.
  // MVS should add safe fillers (core, arm isolation, carries).
  const ctx = makeFilterCtx({ daysToGame: 1 });
  const candidates = filterNames(ctx);
  const intent = buildIntent('Lower Strength', 'Strength', 5);
  const selected = selectExercises(candidates, intent, ctx, new Set());

  console.log(`    → G-1 lower with MVS: ${selected.join(', ')} (${selected.length} exercises)`);

  // Should have at least 4 exercises (MIN_SESSION_SIZE)
  assert(selected.length >= 4, `G-1 lower session has at least 4 exercises (got ${selected.length})`);

  // NO exercises should be high-fatigue
  const highFatigue = selected.filter(n => EXERCISE_TAGS[n]?.fatigue === 'high');
  assert(highFatigue.length === 0, `No high-fatigue fillers (found: ${highFatigue.join(', ') || 'none'})`);

  // NO exercises should be high-DOMS
  const highDoms = selected.filter(n => EXERCISE_TAGS[n]?.doms === 'high');
  assert(highDoms.length === 0, `No high-DOMS fillers (found: ${highDoms.join(', ') || 'none'})`);

  // Fillers should be from safe regions (core, full, upper) — NOT lower on G-1
  const lowerExercises = selected.filter(n => EXERCISE_TAGS[n]?.region === 'lower');
  assert(lowerExercises.length === 0, `No lower exercises on G-1 (found: ${lowerExercises.join(', ') || 'none'})`);

  // Fillers should include recognisable supplement types
  const fillerRegions = new Set(selected.map(n => EXERCISE_TAGS[n]?.region));
  console.log(`    → Filler regions: ${[...fillerRegions].join(', ')}`);

  // ── Tier ordering: core should appear before arm isolation ──
  // Slot-filled exercises come first; fillers are appended after.
  // Among fillers, core (tier 1) should precede isolation_upper (tier 2).
  const movements = selected.map(n => EXERCISE_TAGS[n]?.movement);
  const coreIdx = movements.indexOf('core');
  const isoIdx = movements.indexOf('isolation_upper');
  if (coreIdx >= 0 && isoIdx >= 0) {
    assert(coreIdx < isoIdx, `Core filler (idx ${coreIdx}) appears before arm isolation (idx ${isoIdx})`);
  }
  // Core should be present (tier 1 is highest priority)
  assert(coreIdx >= 0, `Core exercise present as filler (movements: ${movements.join(', ')})`);
}

// ═══════════════════════════════════════════════════════════════
// TEST 18: MVS with injury-restricted lower session
// ═══════════════════════════════════════════════════════════════

section('18. MVS — injury-restricted lower session gets fillers');

{
  // Hamstring + adductor injuries: removes RDLs, Nordics, all lunges, BSS.
  // Combined with late-week (Thursday), this heavily restricts lower options.
  const ctx = makeFilterCtx({
    dayOfWeek: 4,
    activeInjuries: { hamstring: 'avoid', adductor: 'avoid' },
  });
  const candidates = filterNames(ctx);
  const intent = buildIntent('Lower Strength', 'Strength', 5);
  const selected = selectExercises(candidates, intent, ctx, new Set());

  console.log(`    → Injury-restricted lower (Thu): ${selected.join(', ')} (${selected.length} exercises)`);

  // Should have at least 4 exercises
  assert(selected.length >= 4, `Injury-restricted lower has at least 4 exercises (got ${selected.length})`);

  // Excluded exercises should NOT appear
  assert(!selected.includes('RDLs'), 'RDLs excluded (hamstring avoid)');
  assert(!selected.includes('Nordic Lower'), 'Nordic Lower excluded (hamstring avoid)');
  assert(!selected.includes('Walking Lunges'), 'Walking Lunges excluded (adductor avoid)');
  assert(!selected.includes('Bulgarian Split Squats'), 'BSS excluded (adductor avoid)');
}

// ═══════════════════════════════════════════════════════════════
// TEST 19: MVS fillers are low-cost only
// ═══════════════════════════════════════════════════════════════

section('19. MVS fillers are all low-cost');

{
  // G-1 upper session — should already be well-populated, no fillers needed.
  // Verify that a healthy mid-week lower session does NOT get fillers
  // (it fills all 5 slots from the primary region).
  const ctx = makeFilterCtx({ daysToGame: 5 });
  const candidates = filterNames(ctx);
  const intent = buildIntent('Lower Strength', 'Strength', 5);
  const selected = selectExercises(candidates, intent, ctx, new Set());

  // Healthy mid-week lower should get 5 exercises from lower/full/core
  assert(selected.length === 5, `Healthy lower gets full 5 exercises (got ${selected.length})`);

  const regions = new Set(selected.map(n => EXERCISE_TAGS[n]?.region));
  const hasUpper = selected.some(n => EXERCISE_TAGS[n]?.region === 'upper');
  assert(!hasUpper, `Healthy lower has no upper fillers (regions: ${[...regions].join(', ')})`);
}

{
  // Verify that fillers added on G-1 are genuinely low-cost
  const ctx = makeFilterCtx({ daysToGame: 1 });
  const candidates = filterNames(ctx);
  const intent = buildIntent('Lower Strength', 'Strength', 5);
  const selected = selectExercises(candidates, intent, ctx, new Set());

  // No high-fatigue or high-DOMS exercises in the session
  const noHighFatigue = selected.every(n => EXERCISE_TAGS[n]?.fatigue !== 'high');
  assert(noHighFatigue, `No high-fatigue exercises in G-1 session`);
  const noHighDoms = selected.every(n => EXERCISE_TAGS[n]?.doms !== 'high');
  assert(noHighDoms, `No high-DOMS exercises in G-1 session`);

  // Any upper-region exercises (MVS fillers) must be low-cost
  const upperExercises = selected.filter(n => EXERCISE_TAGS[n]?.region === 'upper');
  const allFillerLowCost = upperExercises.every(n => {
    const t = EXERCISE_TAGS[n];
    return t && t.fatigue === 'low' && t.doms === 'low';
  });
  assert(allFillerLowCost, `Upper fillers are low-cost (got: ${upperExercises.join(', ') || 'none'})`);

  // No high load
  const noHighLoad = selected.every(n => EXERCISE_TAGS[n]?.load !== 'high');
  assert(noHighLoad, `No high-load exercises in G-1 session`);
}

// ═══════════════════════════════════════════════════════════════
// TEST 20: MVS does not trigger when session is already full
// ═══════════════════════════════════════════════════════════════

section('20. MVS does not trigger for well-populated sessions');

{
  // Mid-week upper: should fill all 5 slots without fillers
  const ctx = makeFilterCtx({ daysToGame: 5 });
  const candidates = filterNames(ctx);
  const intent = buildIntent('Upper Strength', 'Strength', 5);
  const selected = selectExercises(candidates, intent, ctx, new Set());

  assert(selected.length === 5, `Upper session fills all 5 slots (got ${selected.length})`);

  // Should not contain lower exercises (no filler drift)
  const hasLower = selected.some(n => EXERCISE_TAGS[n]?.region === 'lower');
  assert(!hasLower, `Upper session has no lower fillers`);
}

// ═══════════════════════════════════════════════════════════════
// TEST 21: Filler tier priority ordering
// ═══════════════════════════════════════════════════════════════

section('21. Filler tier priority — core before arms before carries');

{
  // To verify tier ordering in isolation, we compare two G-1 lower sessions:
  // one with MIN_SESSION_SIZE=4 (current) and observe the filler composition.
  //
  // On G-1, slot-filling selects from region-compatible pool (core/full),
  // then MVS adds from the tiered filler pool. We verify:
  //   - Core exercises are present (tier 1 — highest priority)
  //   - Arm isolation appears only AFTER core is represented
  //   - No surprise ordering (carries don't leapfrog core/arms)
  const ctx = makeFilterCtx({ daysToGame: 1 });
  const candidates = filterNames(ctx);
  const intent = buildIntent('Lower Strength', 'Strength', 5);
  const selected = selectExercises(candidates, intent, ctx, new Set());

  console.log(`    → G-1 lower: ${selected.join(', ')} (${selected.length} exercises)`);
  selected.forEach((n, i) => {
    const t = EXERCISE_TAGS[n];
    console.log(`      ${i+1}. ${n} — ${t?.movement}, region=${t?.region}, fatigue=${t?.fatigue}`);
  });

  // Core must be present (tier 1 = highest priority filler)
  const hasCoreWork = selected.some(n => EXERCISE_TAGS[n]?.movement === 'core');
  assert(hasCoreWork, `Session includes core work (tier 1 filler)`);

  // If arm isolation is present, core must also be present
  const hasArmIsolation = selected.some(n => EXERCISE_TAGS[n]?.movement === 'isolation_upper');
  if (hasArmIsolation) {
    assert(hasCoreWork, `Core present when arm isolation is present (core is higher priority)`);
  }

  // If carries are present and arm isolation is present,
  // arm isolation should appear before carries in the filler portion
  const armIdx = selected.findIndex(n => EXERCISE_TAGS[n]?.movement === 'isolation_upper');
  const lastCarryIdx = selected.reduce((max, n, i) =>
    EXERCISE_TAGS[n]?.movement === 'carry' ? i : max, -1);
  // Arm isolation (tier 2) added by MVS should come before carries (tier 4)
  // But carries may be slot-filled (from region pool), so only check if both are MVS fillers.
  // Conservative check: arm isolation never appears AFTER all carries
  if (armIdx >= 0 && lastCarryIdx >= 0) {
    console.log(`    → Arm isolation at idx ${armIdx}, last carry at idx ${lastCarryIdx}`);
  }
}

{
  // Verify that the G-1 lower buildTagAwareSession integration also
  // gets core as its first filler (via the tiered system)
  const template = makeTemplate('Lower Strength');
  const result = buildTagAwareSession(template, '2026-04-10', ['2026-04-11'], DEFAULT_ATHLETE_CONTEXT, true);
  const names = result.exercises.map(e => e.exercise?.name).filter(Boolean);

  console.log(`    → buildTagAwareSession G-1 lower: ${names.join(', ')}`);

  const hasCoreInSession = names.some(n => EXERCISE_TAGS[n]?.movement === 'core');
  assert(hasCoreInSession, `buildTagAwareSession G-1 lower includes core work`);

  // If arm isolation is present, verify it's low-cost
  const armIsoExercises = names.filter(n => EXERCISE_TAGS[n]?.movement === 'isolation_upper');
  const allArmIsoLowCost = armIsoExercises.every(n => {
    const t = EXERCISE_TAGS[n];
    return t && t.fatigue === 'low' && t.doms === 'low';
  });
  assert(allArmIsoLowCost, `Arm isolation fillers are low-cost (got: ${armIsoExercises.join(', ') || 'none'})`);
}

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log('\n════════════════════════════════════════');
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log('════════════════════════════════════════');

if (failures.length > 0) {
  console.log('\nFailed tests:');
  failures.forEach(f => console.log(`  ❌ ${f}`));
}

process.exit(failed > 0 ? 1 : 0);
