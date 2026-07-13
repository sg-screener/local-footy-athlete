/**
 * Fatigue Stacking Guard Tests
 *
 * Verifies that the pre-game fatigue guard protects G-1 while retaining
 * Bible-supported controlled upper-body work at G-2.
 *
 * Key scenario: Game on Sunday → G-1 = Saturday (Gunshow)
 *   Friday (G-2) upper work may remain: the Bible explicitly treats upper
 *   body there as medium stress while prohibiting heavy lower/speed extras.
 */

// ─── Imports ───

const {
  resolveWeekWithConditioning,
  addDays,
} = require('/tmp/lfa-compiled/utils/sessionResolver');

// ─── Test Helpers ───

function makeStrengthWorkout(dayOfWeek, name, intensity = 'Moderate') {
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

function makeGameWorkout(dayOfWeek) {
  return {
    id: `template-game-${dayOfWeek}`,
    microcycleId: 'test-micro',
    dayOfWeek,
    name: 'Game Day',
    description: 'Match day',
    durationMinutes: 120,
    intensity: 'High',
    workoutType: 'Game',
    sessionTier: 'core',
    exercises: [],
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
  };
}

function makeState(overrides = {}) {
  return {
    currentProgram: {
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    },
    currentMicrocycle: {
      id: 'test-micro',
      workouts: [
        makeStrengthWorkout(1, 'Lower Body', 'High'),
        makeStrengthWorkout(3, 'Upper Push', 'Moderate'),
        makeStrengthWorkout(5, 'Upper Pull', 'Light'),
        makeGameWorkout(6), // Template game on Saturday
      ],
    },
    manualOverrides: {},
    markedDays: {},
    athleteContext: {
      injuries: [],
      equipmentTags: ['bodyweight', 'dumbbells', 'barbell', 'cables', 'bands', 'bench', 'foam_roller', 'bike_or_treadmill', 'machine'],
      trainingLocation: 'Commercial gym',
    },
    seasonPhase: 'In-season',
    readiness: 'medium',
    ...overrides,
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

function dayByDow(week, dow) {
  return week.find(d => d.dayOfWeek === dow);
}

// ─── Test 1: Game on Sunday — G-1 is Saturday, G-2 is Friday (Upper Pull) ───
console.log('\n=== Test 1: Game moved to Sunday — controlled Friday Upper Pull may remain ===');
{
  // Game moved from Saturday to Sunday:
  // Template still has Game on Saturday (dow=6), but calendar mark is on Sunday
  const state = makeState({
    markedDays: {
      '2026-04-12': 'game', // Sunday game
    },
  });
  const week = resolveWeekWithConditioning('2026-04-06', state);

  const fri = dayByDow(week, 5); // Friday = G-2
  const sat = dayByDow(week, 6); // Saturday = G-1
  const sun = dayByDow(week, 0); // Sunday = Game

  console.log(`  FRI: ${fri.source} → ${fri.workout?.name}`);
  console.log(`  SAT: ${sat.source} → ${sat.workout?.name}`);
  console.log(`  SUN: ${sun.source} → ${sun.workout?.name}`);

  // Sunday should be game
  assert(sun.source === 'game', `Sunday should be game (got ${sun.source})`);

  // Saturday (G-1) should be Gunshow
  assert(
    sat.workout?.name === 'Gunshow',
    `Saturday (G-1) should be Gunshow (got ${sat.workout?.name})`
  );

  // Friday (G-2) controlled upper work is Bible-supported.
  assert(
    fri.workout?.name === 'Upper Pull',
    `Friday (G-2) controlled Upper Pull should remain (got ${fri.workout?.name})`
  );
}

// ─── Test 2: Game on Saturday (normal) — G-1 is Friday, G-2 is Thursday ───
console.log('\n=== Test 2: Normal Saturday game — Friday (G-1) Arms, Thursday Lower is OK ===');
{
  const state = makeState({
    markedDays: {
      '2026-04-11': 'game', // Saturday game
    },
    currentMicrocycle: {
      id: 'test-micro',
      workouts: [
        makeStrengthWorkout(1, 'Lower Body', 'High'),
        makeStrengthWorkout(3, 'Upper Push', 'Moderate'),
        makeStrengthWorkout(4, 'Lower Body B', 'Light'), // Thursday = lower
        makeStrengthWorkout(5, 'Upper Pull', 'Light'),    // Friday = upper
        makeGameWorkout(6),
      ],
    },
  });
  const week = resolveWeekWithConditioning('2026-04-06', state);

  const thu = dayByDow(week, 4);
  const fri = dayByDow(week, 5);

  console.log(`  THU: ${thu.source} → ${thu.workout?.name}`);
  console.log(`  FRI: ${fri.source} → ${fri.workout?.name}`);

  // Friday (G-1) should be Gunshow
  assert(
    fri.workout?.name === 'Gunshow',
    `Friday (G-1) should be Gunshow (got ${fri.workout?.name})`
  );

  // Thursday (G-2) is Lower Body B — not upper-dominant, should NOT be downgraded
  assert(
    thu.workout?.name === 'Lower Body B' || thu.workout?.name === 'Prehab & Accessories',
    `Thursday (G-2): Lower Body B should be kept or moderated, not arms conflict (got ${thu.workout?.name})`
  );
  // Specifically, it should NOT be Prehab because there's no upper stacking
  const thuIsLower = thu.workout?.name?.toLowerCase().includes('lower');
  assert(
    thuIsLower,
    `Thursday (G-2) should remain lower-body (got ${thu.workout?.name})`
  );
}

// ─── Test 3: Game on Saturday — controlled G-2 Upper Push may remain ───
console.log('\n=== Test 3: Saturday game, controlled Thursday Upper Push may remain ===');
{
  const state = makeState({
    markedDays: {
      '2026-04-11': 'game', // Saturday game
    },
    currentMicrocycle: {
      id: 'test-micro',
      workouts: [
        makeStrengthWorkout(1, 'Lower Body', 'High'),
        makeStrengthWorkout(3, 'Upper Push', 'Moderate'),
        makeStrengthWorkout(4, 'Upper Push B', 'Light'), // Thursday = upper
        makeStrengthWorkout(5, 'Upper Pull', 'Light'),   // Friday = upper
        makeGameWorkout(6),
      ],
    },
  });
  const week = resolveWeekWithConditioning('2026-04-06', state);

  const thu = dayByDow(week, 4);
  const fri = dayByDow(week, 5);

  console.log(`  THU: ${thu.source} → ${thu.workout?.name}`);
  console.log(`  FRI: ${fri.source} → ${fri.workout?.name}`);

  // Friday (G-1) = Gunshow
  assert(
    fri.workout?.name === 'Gunshow',
    `Friday (G-1) should be Gunshow (got ${fri.workout?.name})`
  );

  // G-2 upper work is medium/light and may sit alongside the normal club load.
  assert(
    thu.workout?.name === 'Upper Push B',
    `Thursday (G-2) controlled Upper Push B should remain (got ${thu.workout?.name})`
  );
}

// ─── Test 4: No game — no stacking guard needed ───
console.log('\n=== Test 4: No game this week — no stacking guard applies ===');
{
  const state = makeState({
    markedDays: {}, // no game
  });
  const week = resolveWeekWithConditioning('2026-04-06', state);

  const fri = dayByDow(week, 5);
  console.log(`  FRI: ${fri.source} → ${fri.workout?.name}`);

  // Friday should keep its template (Upper Pull) since no game proximity
  // (template Game on Saturday has no calendar mark, so freed-game logic applies,
  //  but that doesn't affect Friday)
  assert(
    fri.source === 'template' || fri.source === 'gameProximity',
    `Friday should be template or proximity without game (got ${fri.source} → ${fri.workout?.name})`
  );
}

// ─── Test 5: Game on Sunday, G-2 is Lower Body — no conflict ───
console.log('\n=== Test 5: Game on Sunday, Friday is Lower Body — no conflict ===');
{
  const state = makeState({
    markedDays: {
      '2026-04-12': 'game', // Sunday game
    },
    currentMicrocycle: {
      id: 'test-micro',
      workouts: [
        makeStrengthWorkout(1, 'Lower Body', 'High'),
        makeStrengthWorkout(3, 'Upper Push', 'Moderate'),
        makeStrengthWorkout(5, 'Lower Body B', 'Light'), // Friday = lower
        makeGameWorkout(6),
      ],
    },
  });
  const week = resolveWeekWithConditioning('2026-04-06', state);

  const fri = dayByDow(week, 5);
  const sat = dayByDow(week, 6);

  console.log(`  FRI: ${fri.source} → ${fri.workout?.name}`);
  console.log(`  SAT: ${sat.source} → ${sat.workout?.name}`);

  // Saturday (G-1) = Gunshow
  assert(
    sat.workout?.name === 'Gunshow',
    `Saturday (G-1) should be Gunshow (got ${sat.workout?.name})`
  );

  // Friday (G-2) is Lower Body B — no upper conflict, should NOT downgrade
  // G-2 moderate rule may apply (moderate intensity) but should not become prehab
  assert(
    fri.workout?.name !== 'Prehab & Accessories',
    `Friday (G-2) Lower Body B should not be Prehab (got ${fri.workout?.name})`
  );
}

// ─── Test 6: Controlled shoulder day on G-2 may remain ───
console.log('\n=== Test 6: Controlled shoulder session on G-2 may remain ===');
{
  const state = makeState({
    markedDays: {
      '2026-04-12': 'game', // Sunday game
    },
    currentMicrocycle: {
      id: 'test-micro',
      workouts: [
        makeStrengthWorkout(1, 'Lower Body', 'High'),
        makeStrengthWorkout(3, 'Upper Push', 'Moderate'),
        makeStrengthWorkout(5, 'Shoulders & Press', 'Light'), // Friday = shoulder
        makeGameWorkout(6),
      ],
    },
  });
  const week = resolveWeekWithConditioning('2026-04-06', state);

  const fri = dayByDow(week, 5);
  console.log(`  FRI: ${fri.source} → ${fri.workout?.name}`);

  assert(
    fri.workout?.name === 'Shoulders & Press',
    `Friday G-2 controlled shoulders should remain (got ${fri.workout?.name})`
  );
}

// ─── Summary ───
console.log(`\n${'═'.repeat(50)}`);
console.log(`Fatigue Stacking Tests: ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(50)}`);

if (failed > 0) process.exit(1);
