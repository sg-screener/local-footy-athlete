#!/usr/bin/env node
/**
 * AFL S&C Scenario Test Harness
 *
 * USAGE:
 *   # First compile from project root:
 *   npx tsc --outDir /tmp/lfa-compiled --skipLibCheck --esModuleInterop \
 *     --moduleResolution node --module commonjs --target es2020 --resolveJsonModule --allowJs \
 *     src/utils/sessionResolver.ts src/utils/sessionBuilder.ts src/utils/coachingEngine.ts \
 *     src/types/domain.ts src/data/exercisePools.ts
 *
 *   # Then run:
 *   node src/__tests__/scenarioHarness.js
 *
 * STRUCTURE:
 *   1. Fixture factories — build ScheduleState for any scenario
 *   2. Assertion helpers — invariant checks (freshness, proximity, consistency)
 *   3. Golden scenarios — hand-written high-value tests
 *   4. Combinational matrix — generated broad-coverage scenarios
 *   5. Reporter — clear pass/fail output with root causes
 *
 * EXTENDING: Add new scenarios to GOLDEN_SCENARIOS or new invariants to INVARIANTS.
 */

const path = require('path');

// Run directly against the TypeScript sources via sucrase-node (the same
// runner every maintained suite uses) — no separate tsc compile step and no
// /tmp/lfa-compiled artifacts. `COMPILED` now points at src/ so the existing
// path.join(COMPILED, 'utils/...') requires resolve to the .ts modules.
const COMPILED = path.join(__dirname, '..');

// Test-time global: app modules reference the RN __DEV__ flag at import time.
(global).__DEV__ = false;

// ─── Load source modules (via sucrase-node) ───
const { resolveDate, resolveWeek, addDays, formatDate } = require(path.join(COMPILED, 'utils/sessionResolver'));
const { buildDerivedSession, DEFAULT_ATHLETE_CONTEXT } = require(path.join(COMPILED, 'utils/sessionBuilder'));
const { buildCoachingPlan, onboardingToCoachingInputs } = require(path.join(COMPILED, 'utils/coachingEngine'));

// ═══════════════════════════════════════════════════════════════
// SECTION 1: FIXTURE FACTORIES
// ═══════════════════════════════════════════════════════════════

const DAY_MAP = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Create a minimal workout fixture for a given day.
 */
function makeWorkout(opts) {
  const now = new Date().toISOString();
  return {
    id: opts.id || `wk-${opts.dayOfWeek}-${opts.name || 'workout'}`,
    microcycleId: opts.microcycleId || 'mc-test',
    dayOfWeek: opts.dayOfWeek,
    name: opts.name || 'Test Workout',
    description: opts.description || '',
    durationMinutes: opts.durationMinutes || 60,
    intensity: opts.intensity || 'High',
    workoutType: opts.workoutType || 'Strength',
    sessionTier: opts.sessionTier || 'core',
    exercises: opts.exercises || [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create a full ScheduleState for testing.
 *
 * @param {Object} opts
 * @param {string} opts.gameDay — 'Saturday', 'Sunday', etc.
 * @param {number} opts.gymDays — how many gym days (2-6)
 * @param {number[]} opts.gymDayNumbers — explicit dayOfWeek numbers for gym days
 * @param {Object} opts.calendarMarks — { 'YYYY-MM-DD': 'game' | 'rest' }
 * @param {Object} opts.manualOverrides — { 'YYYY-MM-DD': Workout }
 * @param {string} opts.blockStart — ISO date
 * @param {string} opts.blockEnd — ISO date
 * @param {Object[]} opts.templateWorkouts — custom workout array
 * @param {Object} opts.athleteContext — override athlete context
 */
function makeState(opts = {}) {
  const blockStart = opts.blockStart || '2026-03-01';
  const blockEnd = opts.blockEnd || '2026-06-30';
  const gameDayNum = opts.gameDay ? DAY_MAP[opts.gameDay] : 6; // default Saturday

  // Generate template workouts based on gym days
  let templateWorkouts = opts.templateWorkouts;
  if (!templateWorkouts) {
    const gymDayNums = opts.gymDayNumbers || getDefaultGymDays(opts.gymDays || 3, gameDayNum);
    templateWorkouts = buildTemplateWorkouts(gymDayNums, gameDayNum);
  }

  // Build calendar marks
  const calendarMarks = opts.calendarMarks || {};

  return {
    currentProgram: {
      id: 'prog-test',
      userId: 'user-test',
      name: 'Test Program',
      description: 'Test',
      programPhase: 'In-Season',
      startDate: blockStart,
      endDate: blockEnd,
      microcycles: [],
      primaryFocus: 'Strength',
      isActive: true,
      createdAt: blockStart,
      updatedAt: blockStart,
    },
    currentMicrocycle: {
      id: 'mc-test',
      programId: 'prog-test',
      weekNumber: 1,
      startDate: blockStart,
      endDate: blockEnd,
      miniCycleNumber: 1,
      intensityMultiplier: 1.0,
      workouts: templateWorkouts,
      createdAt: blockStart,
      updatedAt: blockStart,
    },
    manualOverrides: opts.manualOverrides || {},
    markedDays: calendarMarks,
    athleteContext: opts.athleteContext || DEFAULT_ATHLETE_CONTEXT,
  };
}

/**
 * Return default gym day numbers for a given frequency, avoiding game day.
 */
function getDefaultGymDays(count, gameDayNum) {
  // Typical in-season layout: anchor around game day
  const allDays = [1, 2, 3, 4, 5]; // Mon-Fri (weekdays)
  const available = allDays.filter(d => d !== gameDayNum && d !== (gameDayNum + 1) % 7);
  return available.slice(0, Math.min(count, available.length));
}

/**
 * Build a realistic in-season template: Lower, Upper Pull, Upper Push + optional.
 */
function buildTemplateWorkouts(gymDayNums, gameDayNum) {
  const workouts = [];
  const focuses = [
    { name: 'Lower Strength', type: 'Strength', tier: 'core', intensity: 'High' },
    { name: 'Upper Pull', type: 'Strength', tier: 'core', intensity: 'High' },
    { name: 'Upper Push', type: 'Strength', tier: 'core', intensity: 'Moderate' },
    { name: 'Gunshow', type: 'Strength', tier: 'optional', intensity: 'Light' },
    { name: 'Prehab & Accessories', type: 'Strength', tier: 'optional', intensity: 'Light' },
    { name: 'Recovery Session', type: 'Recovery', tier: 'recovery', intensity: 'Light' },
  ];

  for (let i = 0; i < gymDayNums.length; i++) {
    const focus = focuses[i] || focuses[focuses.length - 1];
    workouts.push(makeWorkout({
      dayOfWeek: gymDayNums[i],
      name: focus.name,
      workoutType: focus.type,
      sessionTier: focus.tier,
      intensity: focus.intensity,
      exercises: makeExercisesForFocus(focus.name, gymDayNums[i]),
    }));
  }

  // Add game day template
  workouts.push(makeWorkout({
    dayOfWeek: gameDayNum,
    name: 'Game Day',
    workoutType: 'Game',
    sessionTier: 'core',
    intensity: 'High',
  }));

  return workouts;
}

function makeExercisesForFocus(focusName, dayOfWeek) {
  const now = new Date().toISOString();
  const lower = focusName.toLowerCase();
  let names = [];

  if (lower.includes('lower')) {
    names = ['Back Squat', 'RDLs', 'Bulgarian Split Squats', 'Farmer Carry'];
  } else if (lower.includes('pull')) {
    names = ['Pull-Ups', 'Barbell Row', 'Seated Cable Row', 'Single-Arm DB Row'];
  } else if (lower.includes('push')) {
    names = ['Bench Press', 'Overhead Press', 'Dips', 'Lateral Raise'];
  } else if (lower.includes('arms')) {
    names = ['Bicep Curl (Barbell)', 'Skull Crushers', 'Lateral Raise', 'Seated Cable Row'];
  } else {
    names = ['Foam Rolling', 'Hip Mobility', 'Band Pull-Apart'];
  }

  return names.map((name, i) => ({
    id: `ex-${dayOfWeek}-${i}`,
    workoutId: `wk-${dayOfWeek}`,
    exerciseId: `ex-${name.toLowerCase().replace(/\s/g, '-')}`,
    exerciseOrder: i + 1,
    prescribedSets: 3,
    prescribedRepsMin: 5,
    prescribedRepsMax: 8,
    restSeconds: 120,
    notes: '',
    exercise: { id: `ex-${name.toLowerCase().replace(/\s/g, '-')}`, name, description: name },
    createdAt: now,
    updatedAt: now,
  }));
}

/**
 * Seed game days on every occurrence of gameDayNum within the block.
 */
function seedGameDays(state, gameDayName) {
  const marks = { ...state.markedDays };
  const gameDow = DAY_MAP[gameDayName];
  let current = state.currentProgram.startDate.split('T')[0];
  const end = state.currentProgram.endDate.split('T')[0];

  for (let i = 0; i < 200; i++) {
    if (current > end) break;
    const [y, m, d] = current.split('-').map(Number);
    const dow = new Date(y, m - 1, d, 12).getDay();
    if (dow === gameDow) {
      marks[current] = 'game';
    }
    current = addDays(current, 1);
  }

  return { ...state, markedDays: marks };
}

// ═══════════════════════════════════════════════════════════════
// SECTION 2: ASSERTION HELPERS (INVARIANT CHECKS)
// ═══════════════════════════════════════════════════════════════

class AssertionError {
  constructor(invariant, message, details = {}) {
    this.invariant = invariant;
    this.message = message;
    this.details = details;
  }
  toString() {
    return `[${this.invariant}] ${this.message}`;
  }
}

/**
 * Check: G+1 must be recovery or rest (no heavy training day after game).
 */
function assertGPlus1IsRecovery(week, gameDates) {
  const errors = [];
  for (const day of week) {
    const yesterday = addDays(day.date, -1);
    if (gameDates.has(yesterday)) {
      // This is G+1
      if (day.workout && day.workout.workoutType !== 'Recovery' && day.workout.sessionTier !== 'recovery' && day.source !== 'rest') {
        errors.push(new AssertionError(
          'G+1_RECOVERY',
          `G+1 (${day.date}) is NOT recovery: "${day.workout.name}" (type=${day.workout.workoutType}, tier=${day.workout.sessionTier}, source=${day.source})`,
          { date: day.date, workout: day.workout.name }
        ));
      }
    }
  }
  return errors;
}

/**
 * Check: G-1 must be arms/pump only (upper body, low fatigue, optional).
 */
function assertGMinus1IsArmsPump(week, gameDates) {
  const errors = [];
  for (const day of week) {
    const tomorrow = addDays(day.date, 1);
    if (gameDates.has(tomorrow)) {
      // This is G-1
      if (!day.workout) continue; // rest is fine
      if (day.workout.sessionTier === 'recovery' || day.workout.workoutType === 'Recovery') continue; // recovery OK
      const name = day.workout.name.toLowerCase();
      const isArmsPump = name.includes('arm') || name.includes('pump') || name.includes('bicep') || name.includes('tricep') || name.includes('gunshow');
      const isLower = name.includes('lower') || name.includes('squat') || name.includes('hinge') || name.includes('leg');
      const isConditioning = name.includes('conditioning') || name.includes('sprint') || name.includes('metcon');

      if (isLower || isConditioning) {
        errors.push(new AssertionError(
          'G-1_ARMS_PUMP_ONLY',
          `G-1 (${day.date}) has forbidden content: "${day.workout.name}" (lower/conditioning on pre-game day)`,
          { date: day.date, workout: day.workout.name }
        ));
      }
      if (!isArmsPump && day.source === 'template') {
        // Template wasn't overridden to arms/pump — the resolver should have handled this
        errors.push(new AssertionError(
          'G-1_NOT_OVERRIDDEN',
          `G-1 (${day.date}) template not overridden to arms/pump: "${day.workout.name}" (source=${day.source})`,
          { date: day.date, workout: day.workout.name, source: day.source }
        ));
      }
    }
  }
  return errors;
}

/**
 * Check: No heavy lower within 72h (3 days) before game.
 */
function assertNoHeavyLowerNearGame(week, gameDates) {
  const errors = [];
  for (const gameDate of gameDates) {
    for (let offset = 1; offset <= 2; offset++) {
      // G-1 and G-2 (within 72h including game day)
      const checkDate = addDays(gameDate, -offset);
      const day = week.find(d => d.date === checkDate);
      if (!day || !day.workout) continue;

      const name = day.workout.name.toLowerCase();
      const isHeavyLower = (name.includes('lower') || name.includes('squat') || name.includes('hinge'))
        && day.workout.intensity === 'High';

      if (isHeavyLower) {
        errors.push(new AssertionError(
          'NO_HEAVY_LOWER_72H',
          `Heavy lower "${day.workout.name}" (intensity=${day.workout.intensity}) on G-${offset} (${day.date}), game on ${gameDate}`,
          { date: day.date, gameDate, workout: day.workout.name }
        ));
      }
    }
  }
  return errors;
}

/**
 * Check: No conditioning within 48h (2 days) before game.
 */
function assertNoConditioningNearGame(week, gameDates) {
  const errors = [];
  for (const gameDate of gameDates) {
    for (let offset = 1; offset <= 1; offset++) {
      const checkDate = addDays(gameDate, -offset);
      const day = week.find(d => d.date === checkDate);
      if (!day || !day.workout) continue;

      const type = (day.workout.workoutType || '').toLowerCase();
      const name = (day.workout.name || '').toLowerCase();
      const isConditioning = type.includes('conditioning') || type.includes('sprint')
        || name.includes('conditioning') || name.includes('sprint') || name.includes('metcon')
        || name.includes('interval') || name.includes('flog') || name.includes('hill');

      if (isConditioning) {
        errors.push(new AssertionError(
          'NO_CONDITIONING_48H',
          `Conditioning "${day.workout.name}" on G-${offset} (${day.date}), game on ${gameDate}`,
          { date: day.date, gameDate, workout: day.workout.name }
        ));
      }
    }
  }
  return errors;
}

/**
 * Check: Stale overrides are DETECTED (not blocked) — verifies the detection system works.
 *
 * The resolver intentionally preserves manual overrides as Priority 1.
 * This invariant now verifies that stale overrides are:
 *   1. Correctly returned by the resolver (source='manual')
 *   2. Correctly flagged by the stale-override detection system
 *
 * If a manual override looks game-proximity-related and no game is nearby,
 * the detection system should produce a warning (tested in dedicated scenarios).
 * The resolver invariant here just checks that manual overrides aren't silently dropped.
 */
function assertManualOverridesPreserved(week, state) {
  const errors = [];
  for (const [date, workout] of Object.entries(state.manualOverrides || {})) {
    const day = week.find(d => d.date === date);
    if (day && day.source !== 'manual') {
      errors.push(new AssertionError(
        'MANUAL_OVERRIDE_DROPPED',
        `Manual override on ${date} ("${workout.name}") was overridden by source="${day.source}" — Priority 1 violated`,
        { date, workout: workout.name }
      ));
    }
  }
  return errors;
}

/**
 * Check: All views agree — resolveDate should return the same result regardless of call site.
 * (Tests that resolveWeek is consistent with resolveDate called individually)
 */
function assertViewConsistency(mondayStr, state) {
  const errors = [];
  const week = resolveWeek(mondayStr, state);
  for (let i = 0; i < 7; i++) {
    const dateStr = addDays(mondayStr, i);
    const individual = resolveDate(dateStr, state);
    const fromWeek = week[i];

    if (individual.workout?.id !== fromWeek.workout?.id) {
      errors.push(new AssertionError(
        'VIEW_CONSISTENCY',
        `resolveDate("${dateStr}") workout.id="${individual.workout?.id}" ≠ resolveWeek[${i}] workout.id="${fromWeek.workout?.id}"`,
        { date: dateStr }
      ));
    }
    if (individual.source !== fromWeek.source) {
      errors.push(new AssertionError(
        'VIEW_CONSISTENCY',
        `resolveDate("${dateStr}") source="${individual.source}" ≠ resolveWeek[${i}] source="${fromWeek.source}"`,
        { date: dateStr }
      ));
    }
  }
  return errors;
}

/**
 * Check: Optional sessions should not create high fatigue.
 */
function assertOptionalSessionsLowFatigue(week) {
  const errors = [];
  for (const day of week) {
    if (!day.workout) continue;
    if (day.workout.sessionTier === 'optional') {
      if (day.workout.intensity === 'High' || day.workout.intensity === 'Maximal') {
        errors.push(new AssertionError(
          'OPTIONAL_HIGH_FATIGUE',
          `Optional session "${day.workout.name}" on ${day.date} has intensity=${day.workout.intensity}`,
          { date: day.date, workout: day.workout.name }
        ));
      }
    }
  }
  return errors;
}

/**
 * Run ALL invariant checks on a resolved week.
 */
function runInvariantChecks(week, state, gameDates) {
  const gameDateSet = gameDates instanceof Set ? gameDates : new Set(gameDates);
  const gameArray = Array.from(gameDateSet);
  const mondayStr = week.length > 0 ? week[0].date : null;

  return [
    ...assertGPlus1IsRecovery(week, gameDateSet),
    ...assertGMinus1IsArmsPump(week, gameDateSet),
    ...assertNoHeavyLowerNearGame(week, gameDateSet),
    ...assertNoConditioningNearGame(week, gameDateSet),
    ...assertManualOverridesPreserved(week, state),
    ...(mondayStr ? assertViewConsistency(mondayStr, state) : []),
    ...assertOptionalSessionsLowFatigue(week),
  ];
}

// ═══════════════════════════════════════════════════════════════
// SECTION 3: GOLDEN SCENARIOS
// ═══════════════════════════════════════════════════════════════

const GOLDEN_SCENARIOS = [
  // ── Category 1: Game Day Variations ──
  {
    id: 'GAME-SAT-3DAY',
    name: 'Saturday game, 3 gym days (Mon/Tue/Thu)',
    category: 'game-proximity',
    setup: () => {
      const state = makeState({ gameDay: 'Saturday', gymDays: 3, gymDayNumbers: [1, 2, 4] });
      return seedGameDays(state, 'Saturday');
    },
    testWeek: '2026-03-16', // Mon of a week with Sat game
  },
  {
    id: 'GAME-SUN-3DAY',
    name: 'Sunday game, 3 gym days (Mon/Wed/Fri)',
    category: 'game-proximity',
    setup: () => {
      const state = makeState({ gameDay: 'Sunday', gymDays: 3, gymDayNumbers: [1, 3, 5] });
      return seedGameDays(state, 'Sunday');
    },
    testWeek: '2026-03-16',
  },
  {
    id: 'GAME-FRI-3DAY',
    name: 'Friday game, 3 gym days (Mon/Tue/Wed)',
    category: 'game-proximity',
    setup: () => {
      const state = makeState({ gameDay: 'Friday', gymDays: 3, gymDayNumbers: [1, 2, 3] });
      return seedGameDays(state, 'Friday');
    },
    testWeek: '2026-03-16',
  },
  {
    id: 'GAME-SAT-4DAY',
    name: 'Saturday game, 4 gym days (Mon/Tue/Thu/Fri)',
    category: 'game-proximity',
    setup: () => {
      const state = makeState({ gameDay: 'Saturday', gymDays: 4, gymDayNumbers: [1, 2, 4, 5] });
      return seedGameDays(state, 'Saturday');
    },
    testWeek: '2026-03-16',
  },
  {
    id: 'GAME-SAT-5DAY',
    name: 'Saturday game, 5 gym days (Mon-Fri)',
    category: 'game-proximity',
    setup: () => {
      const state = makeState({ gameDay: 'Saturday', gymDays: 5, gymDayNumbers: [1, 2, 3, 4, 5] });
      return seedGameDays(state, 'Saturday');
    },
    testWeek: '2026-03-16',
  },
  {
    id: 'GAME-SAT-2DAY',
    name: 'Saturday game, 2 gym days only (Tue/Thu)',
    category: 'game-proximity',
    setup: () => {
      const state = makeState({ gameDay: 'Saturday', gymDays: 2, gymDayNumbers: [2, 4] });
      return seedGameDays(state, 'Saturday');
    },
    testWeek: '2026-03-16',
  },
  {
    id: 'GAME-SUN-5DAY',
    name: 'Sunday game, 5 gym days (Mon-Fri)',
    category: 'game-proximity',
    setup: () => {
      const state = makeState({ gameDay: 'Sunday', gymDays: 5, gymDayNumbers: [1, 2, 3, 4, 5] });
      return seedGameDays(state, 'Sunday');
    },
    testWeek: '2026-03-16',
  },

  // ── Category 2: Game Day Moves ──
  {
    id: 'GAME-MOVE-SAT-TO-FRI',
    name: 'Game moves from Saturday to Friday mid-block',
    category: 'calendar-change',
    setup: () => {
      const state = makeState({ gameDay: 'Saturday', gymDays: 4, gymDayNumbers: [1, 2, 3, 4] });
      // Original: game on Sat. Now moved to Fri for this week
      const marks = {};
      marks['2026-03-20'] = 'game'; // Friday
      // No Saturday game mark — it moved
      return { ...state, markedDays: marks };
    },
    testWeek: '2026-03-16',
  },
  {
    id: 'GAME-MOVE-SAT-TO-SUN',
    name: 'Game moves from Saturday to Sunday',
    category: 'calendar-change',
    setup: () => {
      const state = makeState({ gameDay: 'Saturday', gymDays: 3, gymDayNumbers: [1, 2, 4] });
      const marks = {};
      marks['2026-03-22'] = 'game'; // Sunday instead of Saturday
      return { ...state, markedDays: marks };
    },
    testWeek: '2026-03-16',
  },

  // ── Category 3: Manual Overrides ──
  {
    id: 'MANUAL-OVERRIDE-TUESDAY',
    name: 'Manual override on Tuesday (coach swap)',
    category: 'manual-override',
    setup: () => {
      const state = makeState({ gameDay: 'Saturday', gymDays: 3, gymDayNumbers: [1, 2, 4] });
      const stateWithGames = seedGameDays(state, 'Saturday');
      const override = makeWorkout({
        dayOfWeek: 2,
        name: 'Custom Upper Session',
        workoutType: 'Strength',
        sessionTier: 'core',
        intensity: 'High',
      });
      return { ...stateWithGames, manualOverrides: { '2026-03-17': override } };
    },
    testWeek: '2026-03-16',
  },
  {
    id: 'STALE-OVERRIDE-GAME-MOVED',
    name: 'Override references game proximity but game moved — resolver preserves, detector flags',
    category: 'stale-data',
    setup: () => {
      const state = makeState({ gameDay: 'Saturday', gymDays: 3, gymDayNumbers: [1, 2, 4] });
      // Override on Friday says "pre-game arms" but no game on Saturday anymore
      const override = makeWorkout({
        dayOfWeek: 5,
        name: 'Pre-game Gunshow',
        workoutType: 'Strength',
        sessionTier: 'optional',
        intensity: 'Light',
      });
      // Game is on Sunday now, not Saturday
      const marks = { '2026-03-22': 'game' }; // Sunday
      return { ...state, manualOverrides: { '2026-03-20': override }, markedDays: marks };
    },
    testWeek: '2026-03-16',
    extraAssert: (week, _, state) => {
      const errors = [];
      const friday = week.find(d => d.date === '2026-03-20');

      // 1) Resolver MUST preserve manual override (Priority 1)
      if (!friday || friday.source !== 'manual') {
        errors.push(new AssertionError(
          'STALE_OVERRIDE_PRESERVED',
          `Friday override should be source="manual", got "${friday?.source || 'missing'}"`,
          { date: '2026-03-20' }
        ));
      }

      // 2) Detection system MUST flag it as stale (heuristic path)
      const { detectStaleOverrides } = require(path.join(COMPILED, 'utils/staleOverrideDetector'));
      const warnings = detectStaleOverrides(
        state.manualOverrides || {},
        {},  // no override contexts (testing heuristic path)
        state.markedDays || {},
      );
      if (warnings.length === 0) {
        errors.push(new AssertionError(
          'STALE_OVERRIDE_UNDETECTED',
          'detectStaleOverrides() did not flag "Pre-game Gunshow" as stale when game moved to Sunday',
          { date: '2026-03-20' }
        ));
      }
      if (warnings.length > 0 && warnings[0].detectedBy !== 'heuristic') {
        errors.push(new AssertionError(
          'STALE_DETECTION_METHOD',
          `Expected heuristic detection, got "${warnings[0].detectedBy}"`,
          { date: '2026-03-20' }
        ));
      }

      return errors;
    },
  },

  // ── Category 4: G-1 Edge Cases ──
  {
    id: 'G-1-LOWER-TEMPLATE',
    name: 'G-1 has Lower Strength template — should be overridden to arms/pump',
    category: 'game-proximity',
    setup: () => {
      // Lower Strength on Friday, game on Saturday → resolver must override
      const state = makeState({
        gameDay: 'Saturday',
        gymDays: 3,
        templateWorkouts: [
          makeWorkout({ dayOfWeek: 1, name: 'Upper Pull', sessionTier: 'core', intensity: 'High' }),
          makeWorkout({ dayOfWeek: 3, name: 'Upper Push', sessionTier: 'core', intensity: 'Moderate' }),
          makeWorkout({ dayOfWeek: 5, name: 'Lower Strength', sessionTier: 'core', intensity: 'High' }),
          makeWorkout({ dayOfWeek: 6, name: 'Game Day', workoutType: 'Game', sessionTier: 'core', intensity: 'High' }),
        ],
      });
      return seedGameDays(state, 'Saturday');
    },
    testWeek: '2026-03-16',
    extraAssert: (week) => {
      const friday = week.find(d => d.dayOfWeek === 5);
      const errors = [];
      if (friday && friday.workout) {
        const name = friday.workout.name.toLowerCase();
        if (name.includes('lower')) {
          errors.push(new AssertionError(
            'G-1_LOWER_OVERRIDE',
            `Friday (G-1) still has Lower session: "${friday.workout.name}" — resolver should have overridden to Gunshow`,
            { date: friday.date }
          ));
        }
      }
      return errors;
    },
  },
  {
    id: 'G-1-CONDITIONING-TEMPLATE',
    name: 'G-1 has Conditioning template — should be overridden',
    category: 'game-proximity',
    setup: () => {
      const state = makeState({
        gameDay: 'Saturday',
        templateWorkouts: [
          makeWorkout({ dayOfWeek: 1, name: 'Lower Strength', sessionTier: 'core', intensity: 'High' }),
          makeWorkout({ dayOfWeek: 3, name: 'Upper Pull', sessionTier: 'core', intensity: 'High' }),
          makeWorkout({ dayOfWeek: 5, name: 'Conditioning Session', workoutType: 'Conditioning', sessionTier: 'core', intensity: 'High' }),
          makeWorkout({ dayOfWeek: 6, name: 'Game Day', workoutType: 'Game', sessionTier: 'core', intensity: 'High' }),
        ],
      });
      return seedGameDays(state, 'Saturday');
    },
    testWeek: '2026-03-16',
  },

  // ── Category 5: G+1 Edge Cases ──
  {
    id: 'G+1-HEAVY-TEMPLATE',
    name: 'G+1 has Heavy Lower template — should become recovery',
    category: 'game-proximity',
    setup: () => {
      const state = makeState({
        gameDay: 'Saturday',
        templateWorkouts: [
          makeWorkout({ dayOfWeek: 0, name: 'Lower Strength', sessionTier: 'core', intensity: 'High' }),
          makeWorkout({ dayOfWeek: 2, name: 'Upper Pull', sessionTier: 'core', intensity: 'High' }),
          makeWorkout({ dayOfWeek: 4, name: 'Upper Push', sessionTier: 'core', intensity: 'Moderate' }),
          makeWorkout({ dayOfWeek: 6, name: 'Game Day', workoutType: 'Game', sessionTier: 'core', intensity: 'High' }),
        ],
      });
      return seedGameDays(state, 'Saturday');
    },
    testWeek: '2026-03-16',
    extraAssert: (week) => {
      const sunday = week.find(d => d.dayOfWeek === 0);
      const errors = [];
      if (sunday && sunday.workout && sunday.workout.workoutType !== 'Recovery' && sunday.workout.sessionTier !== 'recovery') {
        errors.push(new AssertionError(
          'G+1_NOT_RECOVERY',
          `Sunday (G+1) is "${sunday.workout.name}" (type=${sunday.workout.workoutType}) — should be Recovery`,
          { date: sunday.date }
        ));
      }
      return errors;
    },
  },

  // ── Category 6: G-2 Moderation ──
  {
    id: 'G-2-HEAVY-LOWER',
    name: 'G-2 has Heavy Lower — should be moderated to Moderate intensity',
    category: 'game-proximity',
    setup: () => {
      const state = makeState({
        gameDay: 'Saturday',
        templateWorkouts: [
          makeWorkout({ dayOfWeek: 1, name: 'Upper Pull', sessionTier: 'core', intensity: 'High' }),
          makeWorkout({ dayOfWeek: 3, name: 'Upper Push', sessionTier: 'core', intensity: 'Moderate' }),
          makeWorkout({ dayOfWeek: 4, name: 'Lower Strength', sessionTier: 'core', intensity: 'High' }),
          makeWorkout({ dayOfWeek: 6, name: 'Game Day', workoutType: 'Game', sessionTier: 'core', intensity: 'High' }),
        ],
      });
      return seedGameDays(state, 'Saturday');
    },
    testWeek: '2026-03-16',
    extraAssert: (week) => {
      const thursday = week.find(d => d.dayOfWeek === 4);
      const errors = [];
      if (thursday && thursday.workout && thursday.workout.intensity === 'High') {
        const name = thursday.workout.name.toLowerCase();
        if (name.includes('lower')) {
          errors.push(new AssertionError(
            'G-2_NOT_MODERATED',
            `Thursday (G-2) Lower session still High intensity — should be Moderate`,
            { date: thursday.date, intensity: thursday.workout.intensity }
          ));
        }
      }
      return errors;
    },
  },

  // ── Category 7: Injury Context ──
  {
    id: 'INJURY-SHOULDER-RECOVERY',
    name: 'Shoulder injury — recovery sessions should exclude shoulder exercises',
    category: 'injury',
    setup: () => {
      const athlete = {
        ...DEFAULT_ATHLETE_CONTEXT,
        injuries: [{ bodyArea: 'Shoulder', description: 'Impingement', severity: 'Moderate' }],
      };
      const state = makeState({ gameDay: 'Saturday', gymDays: 3, gymDayNumbers: [1, 2, 4], athleteContext: athlete });
      return seedGameDays(state, 'Saturday');
    },
    testWeek: '2026-03-16',
    extraAssert: (week) => {
      const errors = [];
      for (const day of week) {
        if (!day.workout || day.source !== 'gameProximity') continue;
        for (const ex of day.workout.exercises || []) {
          const name = (ex.exercise?.name || '').toLowerCase();
          if (name.includes('overhead') || name.includes('shoulder press') || name.includes('lateral raise')) {
            errors.push(new AssertionError(
              'INJURY_EXERCISE_FILTER',
              `Shoulder injury: derived session on ${day.date} includes "${ex.exercise?.name}"`,
              { date: day.date, exercise: ex.exercise?.name }
            ));
          }
        }
      }
      return errors;
    },
  },

  // ── Category 8: View Consistency ──
  {
    id: 'VIEW-CONSISTENCY-SAT-GAME',
    name: 'View consistency: resolveDate vs resolveWeek (Saturday game)',
    category: 'view-consistency',
    setup: () => {
      const state = makeState({ gameDay: 'Saturday', gymDays: 4, gymDayNumbers: [1, 2, 4, 5] });
      return seedGameDays(state, 'Saturday');
    },
    testWeek: '2026-03-16',
  },

  // ── Category 9: Rest Day Marks ──
  {
    id: 'REST-MARK-OVERRIDES-TEMPLATE',
    name: 'Calendar rest mark overrides template workout',
    category: 'calendar-change',
    setup: () => {
      const state = makeState({ gameDay: 'Saturday', gymDays: 3, gymDayNumbers: [1, 2, 4] });
      const stateWithGames = seedGameDays(state, 'Saturday');
      return { ...stateWithGames, markedDays: { ...stateWithGames.markedDays, '2026-03-17': 'rest' } };
    },
    testWeek: '2026-03-16',
    extraAssert: (week) => {
      const tuesday = week.find(d => d.date === '2026-03-17');
      const errors = [];
      if (tuesday && tuesday.workout !== null) {
        errors.push(new AssertionError(
          'REST_MARK_OVERRIDE',
          `Rest-marked date 2026-03-17 still has workout: "${tuesday.workout.name}"`,
          { date: '2026-03-17' }
        ));
      }
      if (tuesday && tuesday.source !== 'rest') {
        errors.push(new AssertionError(
          'REST_MARK_SOURCE',
          `Rest-marked date 2026-03-17 source="${tuesday.source}" (expected "rest")`,
          { date: '2026-03-17' }
        ));
      }
      return errors;
    },
  },

  // ── Category 10: Out-of-Block Date ──
  {
    id: 'OUT-OF-BLOCK',
    name: 'Date outside block returns no workout',
    category: 'edge-case',
    setup: () => makeState({ blockStart: '2026-04-01', blockEnd: '2026-06-30' }),
    testWeek: '2026-03-16', // before block starts
    extraAssert: (week) => {
      const errors = [];
      for (const day of week) {
        if (day.workout !== null && day.source !== 'game' && day.source !== 'rest') {
          errors.push(new AssertionError(
            'OUT_OF_BLOCK',
            `Date ${day.date} is outside block but has workout: "${day.workout.name}" (source=${day.source})`,
            { date: day.date }
          ));
        }
      }
      return errors;
    },
  },

  // ── Category 11: 6-Day Athlete ──
  {
    id: 'GAME-SAT-6DAY',
    name: 'Saturday game, 6 gym days (Mon-Sat minus game)',
    category: 'game-proximity',
    setup: () => {
      const state = makeState({
        gameDay: 'Saturday',
        gymDays: 6,
        gymDayNumbers: [0, 1, 2, 3, 4, 5],
      });
      return seedGameDays(state, 'Saturday');
    },
    testWeek: '2026-03-16',
  },

  // ── Category 12: Coaching Engine ──
  {
    id: 'COACHING-INSEASON-3DAY',
    name: 'Coaching engine: in-season 3-day produces valid constraints',
    category: 'coaching-engine',
    setup: () => ({
      seasonPhase: 'In-season',
      availableDays: 3,
      selectedDays: ['Monday', 'Tuesday', 'Thursday'],
      teamTrainingDaysPerWeek: 2,
      teamTrainingDays: ['Tuesday', 'Thursday'],
      teamTrainingIntensity: 'Hard',
      sprintExposure: 'Occasionally',
      conditioningLevel: 'Good',
      recentTrainingLoad: 'Pretty consistent',
      injuries: [],
      goals: ['Get stronger'],
      hasGame: true,
      gameDay: 'Saturday',
    }),
    testWeek: null, // not a resolver test — coaching engine test
    extraAssert: (_, inputs) => {
      const plan = buildCoachingPlan(inputs);
      const errors = [];
      if (plan.constraints.sprintLoading !== 'do-not-add') {
        errors.push(new AssertionError(
          'COACHING_SPRINT_INSEASON',
          `In-season sprint loading should be "do-not-add", got "${plan.constraints.sprintLoading}"`,
        ));
      }
      if (plan.constraints.conditioningLoading !== 'light-only') {
        errors.push(new AssertionError(
          'COACHING_CONDITIONING_INSEASON',
          `In-season conditioning should be "light-only", got "${plan.constraints.conditioningLoading}"`,
        ));
      }
      if (plan.coreSessions > 3) {
        errors.push(new AssertionError(
          'COACHING_CORE_CAP',
          `In-season core sessions should be ≤3, got ${plan.coreSessions}`,
        ));
      }
      return errors;
    },
  },
  {
    id: 'COACHING-INJURY-MODERATE',
    name: 'Coaching engine: moderate injury reduces but does not eliminate training',
    category: 'coaching-engine',
    setup: () => ({
      seasonPhase: 'In-season',
      availableDays: 4,
      selectedDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
      teamTrainingDaysPerWeek: 2,
      teamTrainingDays: ['Tuesday', 'Thursday'],
      teamTrainingIntensity: 'Hard',
      sprintExposure: 'Occasionally',
      conditioningLevel: 'Good',
      recentTrainingLoad: 'Pretty consistent',
      injuries: [{ bodyArea: 'Knee', description: 'Patella tendon soreness', severity: 'Moderate', whenItHurts: 'Lifting' }],
      goals: ['Get stronger'],
      hasGame: true,
      gameDay: 'Saturday',
    }),
    testWeek: null,
    extraAssert: (_, inputs) => {
      const plan = buildCoachingPlan(inputs);
      const errors = [];
      if (plan.coreSessions < 1) {
        errors.push(new AssertionError(
          'COACHING_INJURY_ELIMINATED',
          `Moderate knee injury eliminated all core sessions (got ${plan.coreSessions})`,
        ));
      }
      if (plan.constraints.lowerBodyLoading === 'avoid') {
        errors.push(new AssertionError(
          'COACHING_INJURY_OVERREACT',
          `Moderate injury set lowerBodyLoading to "avoid" — should be "conservative"`,
        ));
      }
      return errors;
    },
  },

  // ── Category 13: Stale Override Detection System ──
  {
    id: 'STALE-DETECT-CONTEXT-GAME-REMOVED',
    name: 'Structured context: game removed entirely → stale detected',
    category: 'stale-detection',
    setup: () => {
      const state = makeState({ gameDay: 'Saturday', gymDays: 3, gymDayNumbers: [1, 2, 4] });
      const override = makeWorkout({
        dayOfWeek: 5,
        name: 'Gunshow',
        workoutType: 'Strength',
        sessionTier: 'optional',
        intensity: 'Light',
      });
      // No game marks at all — game was removed
      return {
        ...state,
        manualOverrides: { '2026-03-20': override },
        markedDays: {},
        // Structured context says this was for the Saturday game
        _overrideContexts: {
          '2026-03-20': { intent: 'gameProximity', relatedGameDate: '2026-03-21', label: 'pre-game Gunshow' },
        },
      };
    },
    testWeek: '2026-03-16',
    extraAssert: (week, _, state) => {
      const errors = [];
      const { detectStaleOverrides } = require(path.join(COMPILED, 'utils/staleOverrideDetector'));
      const warnings = detectStaleOverrides(
        state.manualOverrides || {},
        state._overrideContexts || {},
        state.markedDays || {},
      );
      if (warnings.length === 0) {
        errors.push(new AssertionError(
          'STALE_CONTEXT_UNDETECTED',
          'Structured context: game removed but detectStaleOverrides returned no warnings',
        ));
      }
      if (warnings.length > 0 && warnings[0].detectedBy !== 'context') {
        errors.push(new AssertionError(
          'STALE_CONTEXT_METHOD',
          `Expected context detection, got "${warnings[0].detectedBy}"`,
        ));
      }
      return errors;
    },
  },
  {
    id: 'STALE-DETECT-CONTEXT-GAME-MOVED-FAR',
    name: 'Structured context: game moved far away → stale detected',
    category: 'stale-detection',
    setup: () => {
      const state = makeState({ gameDay: 'Saturday', gymDays: 3, gymDayNumbers: [1, 2, 4] });
      const override = makeWorkout({
        dayOfWeek: 5,
        name: 'Recovery',
        workoutType: 'Recovery',
        sessionTier: 'recovery',
        intensity: 'Light',
        description: 'Post-game recovery flush',
      });
      // Game still exists, but it moved from Saturday to Wednesday — far from Friday
      return {
        ...state,
        manualOverrides: { '2026-03-20': override },
        markedDays: { '2026-03-18': 'game' },
        _overrideContexts: {
          '2026-03-20': { intent: 'gameProximity', relatedGameDate: '2026-03-21', label: 'post-game recovery' },
        },
      };
    },
    testWeek: '2026-03-16',
    extraAssert: (week, _, state) => {
      const errors = [];
      const { detectStaleOverrides } = require(path.join(COMPILED, 'utils/staleOverrideDetector'));
      const warnings = detectStaleOverrides(
        state.manualOverrides || {},
        state._overrideContexts || {},
        state.markedDays || {},
      );
      if (warnings.length === 0) {
        errors.push(new AssertionError(
          'STALE_CONTEXT_MOVED_FAR',
          'Game moved far from override but detection did not flag it',
        ));
      }
      return errors;
    },
  },
  {
    id: 'STALE-DETECT-NOT-STALE',
    name: 'Override IS near a game — should NOT be flagged as stale',
    category: 'stale-detection',
    setup: () => {
      const state = makeState({ gameDay: 'Saturday', gymDays: 3, gymDayNumbers: [1, 2, 4] });
      const override = makeWorkout({
        dayOfWeek: 5,
        name: 'Pre-game Gunshow',
        workoutType: 'Strength',
        sessionTier: 'optional',
        intensity: 'Light',
      });
      // Game is still on Saturday — override on Friday is valid
      return {
        ...state,
        manualOverrides: { '2026-03-20': override },
        markedDays: { '2026-03-21': 'game' },
      };
    },
    testWeek: '2026-03-16',
    extraAssert: (week, _, state) => {
      const errors = [];
      const { detectStaleOverrides } = require(path.join(COMPILED, 'utils/staleOverrideDetector'));
      const warnings = detectStaleOverrides(
        state.manualOverrides || {},
        {},
        state.markedDays || {},
      );
      if (warnings.length > 0) {
        errors.push(new AssertionError(
          'STALE_FALSE_POSITIVE',
          `Override on Friday near Saturday game was incorrectly flagged as stale: "${warnings[0].reason}"`,
        ));
      }
      return errors;
    },
  },
  {
    id: 'STALE-DETECT-CUSTOM-NOT-FLAGGED',
    name: 'Custom override (non-game-related) should NOT be flagged',
    category: 'stale-detection',
    setup: () => {
      const state = makeState({ gameDay: 'Saturday', gymDays: 3, gymDayNumbers: [1, 2, 4] });
      const override = makeWorkout({
        dayOfWeek: 2,
        name: 'Upper Pull (Modified)',
        workoutType: 'Strength',
        sessionTier: 'core',
        intensity: 'High',
        description: 'Coach adjusted for shoulder rehab',
      });
      // No game near Tuesday — but this is a custom override, not game-related
      return {
        ...state,
        manualOverrides: { '2026-03-17': override },
        markedDays: { '2026-03-21': 'game' },
      };
    },
    testWeek: '2026-03-16',
    extraAssert: (week, _, state) => {
      const errors = [];
      const { detectStaleOverrides } = require(path.join(COMPILED, 'utils/staleOverrideDetector'));
      const warnings = detectStaleOverrides(
        state.manualOverrides || {},
        {},
        state.markedDays || {},
      );
      if (warnings.length > 0) {
        errors.push(new AssertionError(
          'STALE_CUSTOM_FALSE_POSITIVE',
          `Non-game-related override "Upper Pull (Modified)" on Tuesday was incorrectly flagged as stale`,
        ));
      }
      return errors;
    },
  },
  {
    id: 'STALE-DETECT-DISMISSED-NOT-FLAGGED',
    name: 'Dismissed override (user chose Keep) should NOT be flagged again',
    category: 'stale-detection',
    setup: () => {
      const state = makeState({ gameDay: 'Saturday', gymDays: 3, gymDayNumbers: [1, 2, 4] });
      const override = makeWorkout({
        dayOfWeek: 5,
        name: 'Pre-game Gunshow',
        workoutType: 'Strength',
        sessionTier: 'optional',
        intensity: 'Light',
      });
      // Game moved to Sunday, but user dismissed the warning
      return {
        ...state,
        manualOverrides: { '2026-03-20': override },
        markedDays: { '2026-03-22': 'game' },
        _overrideContexts: {
          '2026-03-20': { intent: 'dismissed' },
        },
      };
    },
    testWeek: '2026-03-16',
    extraAssert: (week, _, state) => {
      const errors = [];
      const { detectStaleOverrides } = require(path.join(COMPILED, 'utils/staleOverrideDetector'));
      const warnings = detectStaleOverrides(
        state.manualOverrides || {},
        state._overrideContexts || {},
        state.markedDays || {},
      );
      if (warnings.length > 0) {
        errors.push(new AssertionError(
          'STALE_DISMISSED_REFLAGGED',
          `Dismissed override was flagged again: "${warnings[0].reason}"`,
        ));
      }
      return errors;
    },
  },
  {
    id: 'STALE-DETECT-RECOVERY-NO-GAME-WORD',
    name: 'Plain "Recovery" session (no game keyword) should NOT be flagged',
    category: 'stale-detection',
    setup: () => {
      const state = makeState({ gameDay: 'Saturday', gymDays: 3, gymDayNumbers: [1, 2, 4] });
      const override = makeWorkout({
        dayOfWeek: 3,
        name: 'Recovery Session',
        workoutType: 'Recovery',
        sessionTier: 'recovery',
        intensity: 'Light',
        description: 'Easy flush and mobility work',
      });
      // No game nearby Wednesday, but this is NOT game-related recovery
      return {
        ...state,
        manualOverrides: { '2026-03-18': override },
        markedDays: { '2026-03-21': 'game' },
      };
    },
    testWeek: '2026-03-16',
    extraAssert: (week, _, state) => {
      const errors = [];
      const { detectStaleOverrides } = require(path.join(COMPILED, 'utils/staleOverrideDetector'));
      const warnings = detectStaleOverrides(
        state.manualOverrides || {},
        {},
        state.markedDays || {},
      );
      if (warnings.length > 0) {
        errors.push(new AssertionError(
          'STALE_RECOVERY_FALSE_POSITIVE',
          `Plain "Recovery Session" (no game keyword) was incorrectly flagged: "${warnings[0].reason}"`,
        ));
      }
      return errors;
    },
  },
  {
    id: 'STALE-DETECT-POST-GAME-CORRECT',
    name: 'Post-game recovery on G+1 with game the day before — NOT stale',
    category: 'stale-detection',
    setup: () => {
      const state = makeState({ gameDay: 'Saturday', gymDays: 3, gymDayNumbers: [0, 1, 4] });
      const override = makeWorkout({
        dayOfWeek: 0,
        name: 'Post-game Recovery',
        workoutType: 'Recovery',
        sessionTier: 'recovery',
        intensity: 'Light',
        description: 'Post-game flush and mobilise',
      });
      // Game on Saturday, override on Sunday (G+1) — should NOT be stale
      return {
        ...state,
        manualOverrides: { '2026-03-22': override },
        markedDays: { '2026-03-21': 'game' },
      };
    },
    testWeek: '2026-03-16',
    extraAssert: (week, _, state) => {
      const errors = [];
      const { detectStaleOverrides } = require(path.join(COMPILED, 'utils/staleOverrideDetector'));
      const warnings = detectStaleOverrides(
        state.manualOverrides || {},
        {},
        state.markedDays || {},
      );
      if (warnings.length > 0) {
        errors.push(new AssertionError(
          'STALE_POST_GAME_FALSE_POSITIVE',
          `Post-game recovery on Sunday with Saturday game was incorrectly flagged`,
        ));
      }
      return errors;
    },
  },
];

// ═══════════════════════════════════════════════════════════════
// SECTION 4: COMBINATIONAL SCENARIO MATRIX
// ═══════════════════════════════════════════════════════════════

function generateCombinationalScenarios() {
  const scenarios = [];
  const gameDays = ['Friday', 'Saturday', 'Sunday'];
  const gymCounts = [2, 3, 4, 5];
  const testWeeks = ['2026-03-16', '2026-04-06', '2026-05-04']; // different weeks

  for (const gameDay of gameDays) {
    for (const gymCount of gymCounts) {
      for (const testWeek of testWeeks) {
        const gameDow = DAY_MAP[gameDay];
        const gymDayNums = getDefaultGymDays(gymCount, gameDow);

        scenarios.push({
          id: `COMBO-${gameDay.toUpperCase()}-${gymCount}DAY-W${testWeek.slice(8)}`,
          name: `${gameDay} game, ${gymCount} gym days, week of ${testWeek}`,
          category: 'combinational',
          setup: () => {
            const state = makeState({ gameDay, gymDays: gymCount, gymDayNumbers: gymDayNums });
            return seedGameDays(state, gameDay);
          },
          testWeek,
        });
      }
    }
  }

  return scenarios;
}

// ═══════════════════════════════════════════════════════════════
// SECTION 5: TEST RUNNER & REPORTER
// ═══════════════════════════════════════════════════════════════

function runScenario(scenario) {
  const result = {
    id: scenario.id,
    name: scenario.name,
    category: scenario.category,
    passed: true,
    errors: [],
    weekSummary: null,
  };

  try {
    const setupResult = scenario.setup();

    // Coaching engine scenarios (no resolver test)
    if (scenario.testWeek === null) {
      if (scenario.extraAssert) {
        const errors = scenario.extraAssert(null, setupResult);
        result.errors.push(...errors);
      }
      result.passed = result.errors.length === 0;
      return result;
    }

    const state = setupResult;
    const week = resolveWeek(scenario.testWeek, state);

    // Build week summary for reporting
    result.weekSummary = week.map(d => ({
      day: d.short,
      date: d.date,
      workout: d.workout?.name || '—',
      source: d.source,
      tier: d.workout?.sessionTier || '—',
      intensity: d.workout?.intensity || '—',
    }));

    // Collect game dates in this week
    const gameDates = new Set();
    for (const d of week) {
      if (d.workout?.workoutType === 'Game' || state.markedDays[d.date] === 'game') {
        gameDates.add(d.date);
      }
    }

    // Run invariant checks
    const invariantErrors = runInvariantChecks(week, state, gameDates);
    result.errors.push(...invariantErrors);

    // Run scenario-specific assertions
    // Pass (week, inputs, state) — some scenarios need state for detection tests
    if (scenario.extraAssert) {
      const extraErrors = scenario.extraAssert(week, null, state);
      result.errors.push(...extraErrors);
    }

    result.passed = result.errors.length === 0;
  } catch (e) {
    result.passed = false;
    result.errors.push(new AssertionError('RUNTIME_ERROR', `${e.message}\n${e.stack}`));
  }

  return result;
}

function runAllScenarios(options = {}) {
  const { includeCombo = true, verbose = false, filter = null } = options;

  const allScenarios = [...GOLDEN_SCENARIOS];
  if (includeCombo) {
    allScenarios.push(...generateCombinationalScenarios());
  }

  const filtered = filter
    ? allScenarios.filter(s => s.id.includes(filter) || s.category.includes(filter))
    : allScenarios;

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  AFL S&C SCENARIO TEST HARNESS`);
  console.log(`  Running ${filtered.length} scenarios (${GOLDEN_SCENARIOS.length} golden + ${filtered.length - GOLDEN_SCENARIOS.length} combinational)`);
  console.log(`${'═'.repeat(70)}\n`);

  const results = [];
  const failures = [];
  const byCategory = {};

  for (const scenario of filtered) {
    const result = runScenario(scenario);
    results.push(result);

    if (!byCategory[scenario.category]) byCategory[scenario.category] = { pass: 0, fail: 0 };

    if (result.passed) {
      byCategory[scenario.category].pass++;
      if (verbose) console.log(`  ✅ ${result.id}`);
    } else {
      byCategory[scenario.category].fail++;
      failures.push(result);
      console.log(`  ❌ ${result.id}: ${result.name}`);
      for (const err of result.errors) {
        console.log(`     └─ ${err.toString()}`);
      }
      if (verbose && result.weekSummary) {
        console.log(`     Week:`);
        for (const d of result.weekSummary) {
          console.log(`       ${d.day} ${d.date}: ${d.workout} (${d.source}, ${d.tier}, ${d.intensity})`);
        }
      }
    }
  }

  // ─── Summary ───
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`\n${'─'.repeat(70)}`);
  console.log(`  RESULTS: ${passed} passed, ${failed} failed out of ${results.length} total`);
  console.log(`${'─'.repeat(70)}`);

  console.log(`\n  By category:`);
  for (const [cat, counts] of Object.entries(byCategory)) {
    const icon = counts.fail > 0 ? '❌' : '✅';
    console.log(`    ${icon} ${cat}: ${counts.pass} pass, ${counts.fail} fail`);
  }

  if (failures.length > 0) {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`  FAILURE DETAILS`);
    console.log(`${'═'.repeat(70)}`);

    // Group failures by invariant
    const byInvariant = {};
    for (const f of failures) {
      for (const err of f.errors) {
        if (!byInvariant[err.invariant]) byInvariant[err.invariant] = [];
        byInvariant[err.invariant].push({ scenario: f.id, ...err });
      }
    }

    for (const [invariant, errors] of Object.entries(byInvariant)) {
      console.log(`\n  [${invariant}] — ${errors.length} violation(s):`);
      for (const err of errors) {
        console.log(`    • ${err.scenario}: ${err.message}`);
      }
    }
  }

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  ${failed === 0 ? '✅ ALL SCENARIOS PASSED' : `❌ ${failed} SCENARIOS FAILED`}`);
  console.log(`${'═'.repeat(70)}\n`);

  return { results, failures, passed, failed, byCategory };
}

// ─── CLI ───
const args = process.argv.slice(2);
const verbose = args.includes('--verbose') || args.includes('-v');
const goldenOnly = args.includes('--golden');
const filter = args.find(a => a.startsWith('--filter='))?.split('=')[1];

runAllScenarios({
  includeCombo: !goldenOnly,
  verbose,
  filter,
});
