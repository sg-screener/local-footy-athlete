/**
 * Conditioning Wiring Integration Tests
 *
 * Verifies that the conditioning rule engine is properly wired into
 * the live session resolution flow. Tests the full pipeline:
 *   ScheduleState → resolveWeekWithConditioning → conditioning placement
 *
 * These tests use the real conditioningRules, sessionBuilder, and
 * weekLogBuilder — no mocks.
 */

// ─── Imports ───

const {
  resolveDate,
  resolveWeek,
  resolveWeekWithConditioning,
  resolveDateWithConditioning,
  resolveMonthIndicatorsWithConditioning,
  getMondayForDate,
  formatDate,
  addDays,
} = require('/tmp/lfa-compiled/utils/sessionResolver');

const { buildWeekLog, conditioningToWeekLogEntry } = require('/tmp/lfa-compiled/utils/weekLogBuilder');

// ─── Test Helpers ───

function makeState(overrides = {}) {
  const monday = '2026-04-06'; // a Monday
  return {
    currentProgram: {
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    },
    currentMicrocycle: {
      id: 'test-micro',
      workouts: [
        // Mon (1), Wed (3), Fri (5) have strength sessions
        makeStrengthWorkout(1, 'Lower Body', 'High'),
        makeStrengthWorkout(3, 'Upper Push', 'Moderate'),
        makeStrengthWorkout(5, 'Upper Pull', 'Light'),
      ],
    },
    manualOverrides: {},
    markedDays: {
      // Saturday game
      '2026-04-11': 'game',
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

// ─── Section 1: WeekLog Builder ───
console.log('\n=== Section 1: WeekLog Builder ===');
{
  const state = makeState();
  const baseDays = resolveWeek('2026-04-06', state);

  const weekLog = buildWeekLog(baseDays, state.markedDays, 'medium', []);

  // Should have strength sessions from Mon, Wed, Fri templates
  assert(weekLog.strengthSessions.length === 3, 'Should find 3 strength sessions');
  assert(weekLog.strengthSessions[0].fatigue === 'high', 'Mon Lower Body → high fatigue');
  assert(weekLog.strengthSessions[1].fatigue === 'moderate', 'Wed Upper Push → moderate fatigue');
  assert(weekLog.strengthSessions[2].fatigue === 'low', 'Fri Upper Pull → low fatigue');

  // Game day detection
  assert(weekLog.byeWeek === false, 'Not a bye week (game on Sat)');
  assert(weekLog.doubleGameWeek === false, 'Not a double game week');

  // Defaults
  assert(weekLog.missedTeamTraining === false, 'missedTeamTraining defaults to false');
  assert(weekLog.weeksOffTraining === 0, 'weeksOffTraining defaults to 0');
  assert(weekLog.readiness === 'medium', 'readiness passed through');
}

// ─── Section 2: Bye Week Detection ───
console.log('\n=== Section 2: Bye Week Detection ===');
{
  // No games this week
  const state = makeState({ markedDays: {} });
  const baseDays = resolveWeek('2026-04-06', state);
  const weekLog = buildWeekLog(baseDays, state.markedDays, 'medium', []);
  assert(weekLog.byeWeek === true, 'No games → bye week');
}
{
  // Double game week
  const state = makeState({
    markedDays: {
      '2026-04-08': 'game',  // Wed
      '2026-04-11': 'game',  // Sat
    },
  });
  const baseDays = resolveWeek('2026-04-06', state);
  const weekLog = buildWeekLog(baseDays, state.markedDays, 'medium', []);
  assert(weekLog.doubleGameWeek === true, '2 games → double game week');
}

// ─── Section 3: conditioningToWeekLogEntry ───
console.log('\n=== Section 3: conditioningToWeekLogEntry ===');
{
  const entry = conditioningToWeekLogEntry('2026-04-07', 'Sprint Intervals');
  assert(entry.tier === 'A', 'Sprint Intervals → Tier A');
  assert(entry.fatigue === 'high', 'Tier A → high fatigue');
  assert(entry.dateStr === '2026-04-07', 'Date preserved');

  const entryC = conditioningToWeekLogEntry('2026-04-07', 'Easy Bike');
  assert(entryC.tier === 'C', 'Easy Bike → Tier C');
  assert(entryC.fatigue === 'low', 'Tier C → low fatigue');

  const entryBlow = conditioningToWeekLogEntry('2026-04-07', 'Tempo Run');
  assert(entryBlow.tier === 'B-low', 'Tempo Run → B-low');
  assert(entryBlow.fatigue === 'moderate', 'B-low → moderate fatigue');
}

// ─── Section 4: resolveWeekWithConditioning places conditioning on empty days ───
console.log('\n=== Section 4: Conditioning Placement on Empty Days ===');
{
  // Off-season, game on Saturday.
  // Template: Mon(strength), Wed(strength), Fri(strength).
  // Empty days in block: Tue(2), Thu(4).
  // Sun(0) is G+1 → recovery (from game proximity).
  // Sat(6) is game.
  const state = makeState();
  const week = resolveWeekWithConditioning('2026-04-06', state);

  // Mon should be strength template
  assert(week[0].source === 'template', 'Mon: strength template');
  assert(week[0].workout?.workoutType === 'Strength', 'Mon: Strength workout');

  // Tue should get conditioning (empty day in block)
  assert(week[1].source === 'conditioning', `Tue: conditioning placed (got ${week[1].source})`);
  assert(week[1].workout !== null, 'Tue: has workout');
  assert(week[1].indicator === 'conditioning', 'Tue: conditioning indicator');

  // Wed should be strength template
  assert(week[2].source === 'template', 'Wed: strength template');

  // Thu should get conditioning (empty day in block)
  // But Thu is G-2 in this setup (game on Sat) → game proximity may moderate it
  // Actually: G-2 only modifies lower-dominant core sessions, doesn't affect empty days
  // And 48h buffer blocks ALL conditioning within 2 days of game
  // Thu to Sat = 2 days → daysToGame=2 → blocked by 48h rule
  assert(week[3].source !== 'conditioning' || week[3].source === 'none',
    `Thu: no conditioning (48h game buffer, got ${week[3].source})`);

  // Fri should be template (but G-1 → arms/pump)
  assert(week[4].source === 'gameProximity', 'Fri: G-1 arms/pump');

  // Sat should be game
  assert(week[5].source === 'game', 'Sat: game');

  // Sun should be G+1 recovery
  assert(week[6].source === 'gameProximity', 'Sun: G+1 recovery');
}

// ─── Section 5: No conditioning without seasonPhase ───
console.log('\n=== Section 5: No Conditioning Without Season Phase ===');
{
  const state = makeState({ seasonPhase: null });
  const week = resolveWeekWithConditioning('2026-04-06', state);

  // Tue should remain empty (no conditioning without season phase)
  assert(week[1].source === 'none', 'Tue: no conditioning without seasonPhase');
  assert(week[1].workout === null, 'Tue: null workout');
}

// ─── Section 6: No conditioning outside block ───
console.log('\n=== Section 6: No Conditioning Outside Block ===');
{
  const state = makeState({
    currentProgram: {
      startDate: '2026-05-01',
      endDate: '2026-05-30',
    },
  });
  // April week is outside the May block
  const week = resolveWeekWithConditioning('2026-04-06', state);

  const condDays = week.filter(d => d.source === 'conditioning');
  assert(condDays.length === 0, 'No conditioning outside active block');
}

// ─── Section 7: In-season caps (no Tier A, max 1 B) ───
console.log('\n=== Section 7: In-Season Conditioning Caps ===');
{
  // In-season, no game this week (bye week, but not fresh because low readiness)
  const state = makeState({
    seasonPhase: 'In-season',
    readiness: 'low',
    markedDays: {},
    currentMicrocycle: {
      id: 'test-micro',
      workouts: [
        makeStrengthWorkout(1, 'Lower Body', 'Light'),
      ],
    },
  });
  const week = resolveWeekWithConditioning('2026-04-06', state);
  const condDays = week.filter(d => d.source === 'conditioning');

  // In-season bye week with low readiness: bLowOnly, max 1 B
  // Should see some conditioning placed (B-low and/or C)
  for (const cd of condDays) {
    const name = cd.workout?.name;
    // Should not see Tier A exercises
    const tierANames = ['Sprint Intervals', 'Hill Sprints', 'Quality Sprints', 'MAS Training', 'Flog Friday'];
    assert(!tierANames.includes(name), `In-season bye (low readiness): no Tier A (got ${name})`);
  }
}

// ─── Section 8: resolveDateWithConditioning ───
console.log('\n=== Section 8: resolveDateWithConditioning ===');
{
  const state = makeState();
  // Tue is an empty day in block → should get conditioning
  const tue = resolveDateWithConditioning('2026-04-07', state);
  assert(tue.source === 'conditioning', `resolveDateWithConditioning: Tue gets conditioning (got ${tue.source})`);

  // Mon has template → should stay template
  const mon = resolveDateWithConditioning('2026-04-06', state);
  assert(mon.source === 'template', 'resolveDateWithConditioning: Mon stays template');

  // Sat is game → should stay game
  const sat = resolveDateWithConditioning('2026-04-11', state);
  assert(sat.source === 'game', 'resolveDateWithConditioning: Sat stays game');
}

// ─── Section 9: getMondayForDate ───
console.log('\n=== Section 9: getMondayForDate ===');
{
  assert(getMondayForDate('2026-04-06') === '2026-04-06', 'Monday → same Monday');
  assert(getMondayForDate('2026-04-07') === '2026-04-06', 'Tuesday → prev Monday');
  assert(getMondayForDate('2026-04-12') === '2026-04-06', 'Sunday → same week Monday');
  assert(getMondayForDate('2026-04-11') === '2026-04-06', 'Saturday → same week Monday');
}

// ─── Section 10: resolveMonthIndicatorsWithConditioning ───
console.log('\n=== Section 10: Month Indicators With Conditioning ===');
{
  const state = makeState({
    currentProgram: {
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    },
  });
  // April 2026: month=3 (0-indexed)
  const indicators = resolveMonthIndicatorsWithConditioning(2026, 3, state);

  // Should have indicators for all 30 days
  assert(Object.keys(indicators).length === 30, 'All 30 April days have indicators');

  // Game day should be 'game'
  assert(indicators['2026-04-11'] === 'game', 'Game day indicator');

  // Check that at least one conditioning indicator exists
  const condCount = Object.values(indicators).filter(i => i === 'conditioning').length;
  assert(condCount > 0, `Month indicators include conditioning (found ${condCount})`);
}

// ─── Section 11: Conditioning does NOT displace templates or overrides ───
console.log('\n=== Section 11: Conditioning Never Displaces Existing Sessions ===');
{
  const state = makeState({
    manualOverrides: {
      '2026-04-07': { // Tue — would normally get conditioning
        id: 'manual-tue',
        microcycleId: 'test-micro',
        dayOfWeek: 2,
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

  // Tue should be manual override, not conditioning
  assert(week[1].source === 'manual', 'Manual override takes priority over conditioning');
  assert(week[1].workout?.name === 'Custom Session', 'Manual workout preserved');
}

// ─── Section 12: Rest days not filled with conditioning ───
console.log('\n=== Section 12: Rest Days Not Filled ===');
{
  const state = makeState({
    markedDays: {
      '2026-04-07': 'rest',   // Tue → rest
      '2026-04-11': 'game',
    },
  });
  const week = resolveWeekWithConditioning('2026-04-06', state);

  // Tue is marked rest → should stay rest, not conditioning
  assert(week[1].source === 'rest', 'Rest day not replaced by conditioning');
  assert(week[1].workout === null, 'Rest day has null workout');
}

// ─── Section 13: Injury filtering flows through wiring ───
console.log('\n=== Section 13: Injury Filtering Integration ===');
{
  const state = makeState({
    athleteContext: {
      injuries: [{ bodyArea: 'hamstring', severity: 'severe', description: 'Grade 2 tear' }],
      equipmentTags: ['bodyweight', 'dumbbells', 'bike_or_treadmill'],
      trainingLocation: 'Commercial gym',
    },
  });
  const week = resolveWeekWithConditioning('2026-04-06', state);
  const condDays = week.filter(d => d.source === 'conditioning');

  for (const cd of condDays) {
    const name = cd.workout?.name || '';
    // With hamstring avoid: no Tier A, no running B
    const blocked = ['Sprint Intervals', 'Hill Sprints', 'Quality Sprints', 'MAS Training', 'Flog Friday',
                     'Tempo Run', 'Long Run', '6x1km', 'MetCon'];
    assert(!blocked.includes(name), `Hamstring injury: ${name} should not be placed`);
  }
}

// ─── Section 14: Stacking guard across week ───
console.log('\n=== Section 14: Progressive Stacking Guard ===');
{
  // Off-season with many empty days (only Mon strength, no game)
  const state = makeState({
    markedDays: {}, // no games
    currentMicrocycle: {
      id: 'test-micro',
      workouts: [
        makeStrengthWorkout(1, 'Lower Body', 'Light'), // Mon only
      ],
    },
  });
  const week = resolveWeekWithConditioning('2026-04-06', state);
  const condDays = week.filter(d => d.source === 'conditioning');

  // Off-season caps: 2A + 2B, total 4-5
  // Should not exceed caps
  let aCount = 0;
  let bCount = 0;
  for (const cd of condDays) {
    const name = cd.workout?.name || '';
    // Quick tier check from known exercise names
    const tierANames = ['Sprint Intervals', 'Hill Sprints', 'Quality Sprints', 'MAS Training', 'Flog Friday'];
    const tierBhighNames = ['MetCon', 'Long Run', '6x1km', 'Hard Row Intervals', 'Hard SkiErg Intervals', 'Hard Assault Bike Intervals'];
    const tierBlowNames = ['Tempo Run', 'Bike Sprints', 'Row Intervals', 'SkiErg Intervals', 'Assault Bike Intervals'];
    if (tierANames.includes(name)) aCount++;
    if (tierBhighNames.includes(name) || tierBlowNames.includes(name)) bCount++;
  }
  assert(aCount <= 2, `Off-season: max 2 Tier A (got ${aCount})`);
  assert(bCount <= 2, `Off-season: max 2 Tier B (got ${bCount})`);
  // Tier C is effectively unlimited — once A+B caps are hit,
  // remaining empty days get Tier C. Total may exceed 5.
  assert(aCount + bCount <= 4, `Off-season: max 4 non-C sessions (got ${aCount + bCount})`);
}

// ─── Summary ───
console.log(`\n${'═'.repeat(50)}`);
console.log(`Conditioning Wiring Tests: ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(50)}\n`);

if (failed > 0) process.exit(1);
