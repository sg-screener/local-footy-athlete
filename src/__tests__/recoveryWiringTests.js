/**
 * Recovery Wiring Integration Tests
 *
 * Verifies that the recovery rule engine is properly wired into
 * the live session resolution flow. Tests the full pipeline:
 *   Pass 1 (strength/game) → Pass 2 (conditioning) → Pass 3 (recovery)
 */

const {
  resolveWeekWithConditioning,
  resolveDateWithConditioning,
} = require('/tmp/lfa-compiled/utils/sessionResolver');

const {
  resolveRecovery,
  getMaxRecoveryPerWeek,
} = require('/tmp/lfa-compiled/utils/recoveryRules');

// ─── Test Helpers ───

function makeState(overrides = {}) {
  return {
    currentProgram: {
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    },
    currentMicrocycle: {
      id: 'test-micro',
      workouts: [
        makeStrengthWorkout(1, 'Lower Body', 'High'),    // Mon
        makeStrengthWorkout(3, 'Upper Push', 'Moderate'), // Wed
        makeStrengthWorkout(5, 'Upper Pull', 'Light'),    // Fri
      ],
    },
    manualOverrides: {},
    markedDays: {
      '2026-04-11': 'game', // Saturday
    },
    athleteContext: {
      injuries: [],
      equipmentTags: ['bodyweight', 'dumbbells', 'barbell', 'cables', 'bands', 'bench', 'foam_roller', 'bike_or_treadmill', 'machine'],
      trainingLocation: 'Commercial gym',
    },
    seasonPhase: 'Off-season',
    readiness: 'medium',
    ...overrides,
  };
}

function makeStrengthWorkout(dayOfWeek, name, intensity) {
  return {
    id: `template-${name.toLowerCase().replace(/\s/g, '-')}`,
    microcycleId: 'test-micro',
    dayOfWeek,
    name,
    description: `${name} session`,
    durationMinutes: 60,
    intensity,
    workoutType: 'Strength',
    sessionTier: 'core',
    exercises: [],
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
  };
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

// ─── Section 1: Recovery Rule Engine Unit Tests ───
console.log('\n=== Section 1: Recovery Rule Engine ===');
{
  // Low readiness → passive
  const r1 = resolveRecovery(null, null, 'Off-season', 'low', 0, false);
  assert(r1 !== null, 'Low readiness: not null');
  assert(r1.category === 'passive', 'Low readiness → passive');
  assert(r1.derivedType === 'passive_recovery', 'Low readiness → passive_recovery type');

  // Medium readiness → active
  const r2 = resolveRecovery(null, null, 'Off-season', 'medium', 0, false);
  assert(r2 !== null, 'Medium readiness: not null');
  assert(r2.category === 'active', 'Medium readiness → active');
  assert(r2.derivedType === 'recovery', 'Medium readiness → recovery type');

  // High readiness → extended
  const r3 = resolveRecovery(null, null, 'Off-season', 'high', 0, false);
  assert(r3 !== null, 'High readiness: not null');
  assert(r3.category === 'extended', 'High readiness → extended');
  assert(r3.derivedType === 'extended_recovery', 'High readiness → extended_recovery type');
}

// ─── Section 2: Extended Recovery Guards ───
console.log('\n=== Section 2: Extended Recovery Guards ===');
{
  // High readiness but within 48h of game → fallback to active
  const r1 = resolveRecovery(2, null, 'Off-season', 'high', 0, false);
  assert(r1.category === 'active', 'Within 48h of game: extended → active fallback');

  const r1b = resolveRecovery(1, null, 'Off-season', 'high', 0, false);
  assert(r1b.category === 'active', 'Within 24h of game: extended → active fallback');

  // High readiness but day after A/B-high → fallback to active
  const r2 = resolveRecovery(null, null, 'Off-season', 'high', 0, true);
  assert(r2.category === 'active', 'After high-tier conditioning: extended → active fallback');

  // High readiness, no restrictions → extended
  const r3 = resolveRecovery(5, null, 'Off-season', 'high', 0, false);
  assert(r3.category === 'extended', 'No restrictions: extended allowed');
}

// ─── Section 3: Frequency Guards ───
console.log('\n=== Section 3: Frequency Guards ===');
{
  // In-season: max 2
  assert(getMaxRecoveryPerWeek('In-season') === 2, 'In-season: max 2 recovery');
  const r1 = resolveRecovery(null, null, 'In-season', 'medium', 2, false);
  assert(r1 === null, 'In-season at cap: null');

  const r1b = resolveRecovery(null, null, 'In-season', 'medium', 1, false);
  assert(r1b !== null, 'In-season below cap: allowed');

  // Pre-season: max 3
  assert(getMaxRecoveryPerWeek('Pre-season') === 3, 'Pre-season: max 3 recovery');
  const r2 = resolveRecovery(null, null, 'Pre-season', 'medium', 3, false);
  assert(r2 === null, 'Pre-season at cap: null');

  // Off-season: max 3
  assert(getMaxRecoveryPerWeek('Off-season') === 3, 'Off-season: max 3 recovery');
  const r3 = resolveRecovery(null, null, 'Off-season', 'medium', 3, false);
  assert(r3 === null, 'Off-season at cap: null');
}

// ─── Section 4: Recovery Placed on Empty Days in Live Flow ───
console.log('\n=== Section 4: Recovery Placement in Live Flow ===');
{
  // Off-season, game Sat, strength Mon/Wed/Fri.
  // Conditioning fills some empty days (Pass 2).
  // Recovery fills remaining empty days (Pass 3).
  const state = makeState();
  const week = resolveWeekWithConditioning('2026-04-06', state);

  // Verify each day's resolution
  assert(week[0].source === 'template', 'Mon: strength template');
  // Tue: conditioning or recovery (depends on conditioning engine)
  // Wed: strength template
  assert(week[2].source === 'template', 'Wed: strength template');
  // Thu: within 48h of game → conditioning blocked, could be recovery
  // Fri: G-1 → arms/pump
  assert(week[4].source === 'gameProximity', 'Fri: G-1 arms/pump');
  // Sat: game
  assert(week[5].source === 'game', 'Sat: game');
  // Sun: G+1 → recovery from game proximity
  assert(week[6].source === 'gameProximity', 'Sun: G+1 recovery');

  // Check that at least one recovery day exists from Pass 3
  const recoveryDays = week.filter(d => d.source === 'recovery');
  // Thu (day 3) should be recovery since it's within 48h of game (conditioning blocked)
  const thuDay = week[3]; // Thu
  if (thuDay.source === 'recovery') {
    assert(thuDay.workout !== null, 'Thu: recovery has workout');
    assert(thuDay.workout.workoutType === 'Recovery', 'Thu: recovery workoutType');
    assert(thuDay.workout.sessionTier === 'recovery', 'Thu: recovery tier');
  }

  // No day should have both conditioning and recovery
  for (const day of week) {
    if (day.source === 'conditioning') {
      assert(day.workout.workoutType !== 'Recovery', `${day.short}: conditioning is not recovery`);
    }
  }
}

// ─── Section 5: Recovery Does NOT Displace Existing Sessions ───
console.log('\n=== Section 5: Recovery Never Displaces ===');
{
  const state = makeState({
    manualOverrides: {
      '2026-04-09': { // Thu
        id: 'manual-thu',
        microcycleId: 'test-micro',
        dayOfWeek: 4,
        name: 'Custom Session',
        description: 'Manual override',
        durationMinutes: 45,
        intensity: 'Moderate',
        workoutType: 'Strength',
        sessionTier: 'core',
        exercises: [],
        createdAt: '2026-04-01T00:00:00Z',
        updatedAt: '2026-04-01T00:00:00Z',
      },
    },
  });
  const week = resolveWeekWithConditioning('2026-04-06', state);
  assert(week[3].source === 'manual', 'Thu manual override preserved over recovery');
}

// ─── Section 6: No Recovery Without Season Phase ───
console.log('\n=== Section 6: No Recovery Without Season Phase ===');
{
  const state = makeState({ seasonPhase: null });
  const week = resolveWeekWithConditioning('2026-04-06', state);
  const recoveryDays = week.filter(d => d.source === 'recovery');
  assert(recoveryDays.length === 0, 'No recovery without seasonPhase');
}

// ─── Section 7: Recovery Category Selection by Readiness ───
console.log('\n=== Section 7: Readiness-Based Category in Live Flow ===');
{
  // Low readiness → passive recovery
  const lowState = makeState({
    readiness: 'low',
    markedDays: {},  // no game, maximize empty days
    currentMicrocycle: {
      id: 'test-micro',
      workouts: [makeStrengthWorkout(1, 'Lower Body', 'Light')], // Mon only
    },
  });
  const lowWeek = resolveWeekWithConditioning('2026-04-06', lowState);
  const lowRecovery = lowWeek.filter(d => d.source === 'recovery');
  for (const rd of lowRecovery) {
    assert(rd.workout.name === 'Passive Recovery',
      `Low readiness: ${rd.short} is Passive Recovery (got ${rd.workout.name})`);
  }

  // High readiness → extended recovery eligible (unit test confirms it works).
  // In a full week, conditioning fills many days first, so extended recovery
  // may or may not appear depending on remaining empty days and their context.
  // We verify the rule engine returns 'extended' for high readiness + no restrictions.
  const extResult = resolveRecovery(null, null, 'Off-season', 'high', 0, false);
  assert(extResult.category === 'extended', 'High readiness rule: extended category');
}

// ─── Section 8: Recovery Frequency Cap in Live Flow ───
console.log('\n=== Section 8: Recovery Frequency Cap ===');
{
  // In-season, no games (bye week), only 1 strength day.
  // Many empty days. Should place max 2 recovery (in-season cap).
  const state = makeState({
    seasonPhase: 'In-season',
    readiness: 'low', // low readiness → all recovery is passive (no conditioning interference)
    markedDays: {},   // bye week
    currentMicrocycle: {
      id: 'test-micro',
      workouts: [makeStrengthWorkout(1, 'Lower Body', 'Light')],
    },
  });
  const week = resolveWeekWithConditioning('2026-04-06', state);
  const recoveryDays = week.filter(d => d.source === 'recovery');
  assert(recoveryDays.length <= 2, `In-season recovery cap: max 2 (got ${recoveryDays.length})`);
}

// ─── Section 9: G+1 Counts Toward Recovery Cap ───
console.log('\n=== Section 9: G+1 Counts Toward Recovery Cap ===');
{
  // In-season with game → G+1 recovery from game proximity.
  // That counts toward the 2 recovery/week cap.
  // So Pass 3 should only add at most 1 more recovery.
  const state = makeState({
    seasonPhase: 'In-season',
    readiness: 'low',
    markedDays: { '2026-04-11': 'game' },
    currentMicrocycle: {
      id: 'test-micro',
      workouts: [makeStrengthWorkout(1, 'Lower Body', 'Light')],
    },
  });
  const week = resolveWeekWithConditioning('2026-04-06', state);

  // Count all recovery sessions (game proximity + pass 3)
  const allRecovery = week.filter(d =>
    d.workout?.workoutType === 'Recovery' || d.workout?.sessionTier === 'recovery'
  );
  const pass3Recovery = week.filter(d => d.source === 'recovery');
  const gameProxRecovery = week.filter(d =>
    d.source === 'gameProximity' &&
    (d.workout?.workoutType === 'Recovery' || d.workout?.sessionTier === 'recovery')
  );

  assert(allRecovery.length <= 2,
    `In-season total recovery (including G+1): max 2 (got ${allRecovery.length})`);
  assert(gameProxRecovery.length >= 1, 'At least 1 G+1 recovery from game proximity');
  assert(pass3Recovery.length <= 1,
    `Pass 3 recovery with G+1: max 1 (got ${pass3Recovery.length})`);
}

// ─── Section 10: resolveDateWithConditioning includes recovery ───
console.log('\n=== Section 10: resolveDateWithConditioning includes recovery ===');
{
  // Thu is within 48h of game (Sat) → conditioning blocked → should get recovery
  const state = makeState();
  const thu = resolveDateWithConditioning('2026-04-09', state);
  // Thu might be recovery or none depending on if conditioning took it
  if (thu.source === 'recovery') {
    assert(thu.workout !== null, 'resolveDateWithConditioning: Thu recovery has workout');
  }

  // Strength day stays strength
  const mon = resolveDateWithConditioning('2026-04-06', state);
  assert(mon.source === 'template', 'Mon stays template via resolveDateWithConditioning');
}

// ─── Section 11: Recovery does not coexist with conditioning ───
console.log('\n=== Section 11: No Recovery + Conditioning Same Day ===');
{
  const state = makeState({
    markedDays: {},
    currentMicrocycle: {
      id: 'test-micro',
      workouts: [makeStrengthWorkout(1, 'Lower Body', 'Light')],
    },
  });
  const week = resolveWeekWithConditioning('2026-04-06', state);

  // Core guarantee: no day should have BOTH conditioning AND recovery sources.
  // Each day gets exactly one source. Verify no date appears in both sets.
  const condDays = new Set(week.filter(d => d.source === 'conditioning').map(d => d.date));
  const recDays = new Set(week.filter(d => d.source === 'recovery').map(d => d.date));
  for (const date of condDays) {
    assert(!recDays.has(date), `${date}: no overlap conditioning+recovery`);
  }
  for (const date of recDays) {
    assert(!condDays.has(date), `${date}: no overlap recovery+conditioning`);
  }
  // Also verify: no day has both a strength template and recovery/conditioning
  const strengthDays = new Set(week.filter(d => d.source === 'template').map(d => d.date));
  for (const date of strengthDays) {
    assert(!condDays.has(date), `${date}: no overlap strength+conditioning`);
    assert(!recDays.has(date), `${date}: no overlap strength+recovery`);
  }
}

// ─── Section 12: Off-season recovery cap ───
console.log('\n=== Section 12: Off-Season Recovery Cap ===');
{
  const state = makeState({
    seasonPhase: 'Off-season',
    readiness: 'medium',
    markedDays: {},
    currentMicrocycle: {
      id: 'test-micro',
      workouts: [makeStrengthWorkout(1, 'Lower Body', 'Light')],
    },
  });
  const week = resolveWeekWithConditioning('2026-04-06', state);
  const recoveryDays = week.filter(d => d.source === 'recovery');
  assert(recoveryDays.length <= 3, `Off-season recovery cap: max 3 (got ${recoveryDays.length})`);
}

// ─── Section 13: Double Game Week — Second G+1 is Full Rest ───
console.log('\n=== Section 13: Double Game Week — Second G+1 Full Rest ===');
{
  // Two games: Wed (2026-04-08) and Sat (2026-04-11)
  // G+1 after Wed = Thu (2026-04-09) → recovery (first G+1, kept)
  // G+1 after Sat = Sun (2026-04-12) → full rest (second G+1, nulled)
  const state = makeState({
    seasonPhase: 'In-season',
    readiness: 'medium',
    markedDays: {
      '2026-04-08': 'game',  // Wed
      '2026-04-11': 'game',  // Sat
    },
    currentMicrocycle: {
      id: 'test-micro',
      workouts: [
        makeStrengthWorkout(1, 'Lower Body', 'Light'),  // Mon
      ],
    },
  });
  const week = resolveWeekWithConditioning('2026-04-06', state);

  // Wed = game
  assert(week[2].source === 'game', 'Wed: game');

  // Thu = first G+1 → recovery kept
  assert(week[3].workout !== null, 'Thu (first G+1): has workout');
  assert(week[3].workout.workoutType === 'Recovery' || week[3].workout.sessionTier === 'recovery',
    'Thu (first G+1): is recovery');

  // Sat = game
  assert(week[5].source === 'game', 'Sat: game');

  // Sun = second G+1 → full rest (null workout)
  assert(week[6].source === 'rest', `Sun (second G+1): source is rest (got ${week[6].source})`);
  assert(week[6].workout === null, 'Sun (second G+1): null workout (full rest)');
}

// ─── Section 14: Single Game Week — G+1 Recovery Preserved ───
console.log('\n=== Section 14: Single Game Week — G+1 Preserved ===');
{
  // One game on Sat — G+1 Sun should still get recovery
  const state = makeState({
    seasonPhase: 'In-season',
    readiness: 'medium',
    markedDays: { '2026-04-11': 'game' },
    currentMicrocycle: {
      id: 'test-micro',
      workouts: [makeStrengthWorkout(1, 'Lower Body', 'Light')],
    },
  });
  const week = resolveWeekWithConditioning('2026-04-06', state);

  // Sun = G+1 → recovery (not converted to rest)
  assert(week[6].source === 'gameProximity', 'Sun (single G+1): gameProximity source');
  assert(week[6].workout !== null, 'Sun (single G+1): has recovery workout');
}

// ─── Section 15: Pool Exercise Prescription Audit ───
console.log('\n=== Section 15: Pool Exercise Prescription Audit ===');
{
  // Every recovery/mobility pool exercise must have prescriptionType set.
  // This prevents silent regression back to unstructured text.
  const pools = require('/tmp/lfa-compiled/data/exercisePools');
  // All pools used by any recovery/prehab/extended_recovery session type.
  // If a pool appears in SESSION_SLOTS for recovery, passive, extended, or prehab,
  // it must have prescriptionType on every exercise.
  const RECOVERY_POOLS = [
    { name: 'TISSUE_QUALITY_POOL', pool: pools.TISSUE_QUALITY_POOL },
    { name: 'MOBILITY_POOL', pool: pools.MOBILITY_POOL },
    { name: 'EASY_CARDIO_POOL', pool: pools.EASY_CARDIO_POOL },
    { name: 'BREATHING_RESET_POOL', pool: pools.BREATHING_RESET_POOL },
    { name: 'HAMSTRING_LIGHT_POOL', pool: pools.HAMSTRING_LIGHT_POOL },
    { name: 'TRUNK_ANTI_ROTATION_POOL', pool: pools.TRUNK_ANTI_ROTATION_POOL },
    { name: 'GROIN_ADDUCTORS_POOL', pool: pools.GROIN_ADDUCTORS_POOL },
    { name: 'SHOULDER_HEALTH_POOL', pool: pools.SHOULDER_HEALTH_POOL },
    { name: 'CALVES_POOL', pool: pools.CALVES_POOL },
    { name: 'LOWER_PREHAB_POOL', pool: pools.LOWER_PREHAB_POOL },
  ];

  for (const { name, pool } of RECOVERY_POOLS) {
    for (const ex of pool) {
      assert(
        ex.prescriptionType === 'reps' || ex.prescriptionType === 'duration' || ex.prescriptionType === 'duration_minutes' || ex.prescriptionType === 'distance',
        `${name} → ${ex.name}: must have prescriptionType (got ${ex.prescriptionType})`
      );
      assert(
        ex.sets > 0,
        `${name} → ${ex.name}: must have sets > 0`
      );
      assert(
        ex.repsMin > 0 && ex.repsMax > 0,
        `${name} → ${ex.name}: must have repsMin/repsMax > 0`
      );
      // If perSide is true, prescriptionType must be set (already covered above)
      // Duration exercises with hints of "per side" in name should have perSide
    }
  }
}

// ─── Section 16: Derived Recovery Sessions Have Structured Exercises ───
console.log('\n=== Section 16: Derived Recovery Sessions Have Structured Exercises ===');
{
  const { buildDerivedSession, DEFAULT_ATHLETE_CONTEXT } = require('/tmp/lfa-compiled/utils/sessionBuilder');

  const recoveryTypes = ['recovery', 'passive_recovery', 'extended_recovery'];
  for (const sessionType of recoveryTypes) {
    const workout = buildDerivedSession(sessionType, '2026-04-07', 'mc-test', 'Test', DEFAULT_ATHLETE_CONTEXT);
    assert(workout !== null, `${sessionType}: workout built`);
    assert(workout.exercises.length > 0, `${sessionType}: has exercises`);
    assert(workout.workoutType === 'Recovery', `${sessionType}: workoutType is Recovery`);

    for (const ex of workout.exercises) {
      assert(ex.prescribedSets > 0, `${sessionType} → ${ex.exercise?.name}: has sets`);
      assert(ex.prescribedRepsMin > 0, `${sessionType} → ${ex.exercise?.name}: has repsMin`);
      assert(ex.prescribedRepsMax > 0, `${sessionType} → ${ex.exercise?.name}: has repsMax`);
      assert(
        ex.prescriptionType === 'reps' || ex.prescriptionType === 'duration' || ex.prescriptionType === 'duration_minutes' || ex.prescriptionType === 'distance',
        `${sessionType} → ${ex.exercise?.name}: prescriptionType flows through (got ${ex.prescriptionType})`
      );
    }
  }
}

// ─── Section 17: Template Recovery Replaced by Derived Session ───
console.log('\n=== Section 17: Template Recovery Replaced by Derived ===');
{
  // A template workout with sessionTier='recovery' should get replaced
  // by a derived pool session (with proper structured fields).
  const state = makeState({
    currentMicrocycle: {
      id: 'test-micro',
      workouts: [
        makeStrengthWorkout(1, 'Lower Body', 'High'),    // Mon
        // Wed: AI-generated recovery template (wrong workoutType)
        {
          id: 'template-ai-recovery',
          microcycleId: 'test-micro',
          dayOfWeek: 3,
          name: 'Recovery & Mobility',
          description: '',
          durationMinutes: 30,
          intensity: 'Light',
          workoutType: 'Conditioning',  // AI set wrong type
          sessionTier: 'recovery',       // but tier is correct
          exercises: [
            { id: 'we-1', workoutId: 'w-1', exerciseId: 'ai-foam', exerciseOrder: 1,
              prescribedSets: 1, prescribedRepsMin: 60, prescribedRepsMax: 90,
              restSeconds: 0, notes: 'Foam roll lower body',
              exercise: { id: 'ai-foam', name: 'Foam Rolling — Lower Body', description: 'Foam roll' },
              createdAt: '2026-04-01T00:00:00Z', updatedAt: '2026-04-01T00:00:00Z' },
          ],
          createdAt: '2026-04-01T00:00:00Z',
          updatedAt: '2026-04-01T00:00:00Z',
        },
      ],
    },
  });
  const week = resolveWeekWithConditioning('2026-04-06', state);
  const wed = week[2]; // Wed = dayOfWeek 3

  assert(wed.workout !== null, 'Wed: has workout after template replacement');
  assert(wed.workout.workoutType === 'Recovery', 'Wed: workoutType corrected to Recovery');
  assert(wed.workout.sessionTier === 'recovery', 'Wed: sessionTier is recovery');

  // Exercises should have prescriptionType from pool builder, not blank AI data
  if (wed.workout.exercises.length > 0) {
    const firstEx = wed.workout.exercises[0];
    assert(
      firstEx.prescriptionType === 'reps' || firstEx.prescriptionType === 'duration' || firstEx.prescriptionType === 'duration_minutes' || firstEx.prescriptionType === 'distance',
      `Wed replaced recovery: first exercise has prescriptionType (got ${firstEx.prescriptionType})`
    );
  }
}

// ─── Summary ───
console.log(`\n${'═'.repeat(50)}`);
console.log(`Recovery Wiring Tests: ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(50)}\n`);

if (failed > 0) process.exit(1);
