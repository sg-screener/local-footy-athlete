/**
 * Conditioning Rules — Test Suite
 *
 * Tests the conditioning rule engine: tier selection, placement,
 * weekly caps, stacking guard, strength interaction, injury filtering,
 * bye week logic, missed training, double game week, return from break.
 *
 * Run: node src/__tests__/conditioningTests.js
 * Requires: npx tsc ... --outDir /tmp/lfa-compiled (see tagSystemTests.js)
 */

const {
  resolveConditioning,
  getAllowedTiersForDate,
  getStackingBlockedTiers,
  getStrengthBlockedTiers,
  getWeeklyCaps,
  filterConditioningByInjury,
  hasLowerLimbInjury,
  hasRunningInjury,
  getEligibleTiers,
  countByTier,
  getWeeklyConditioningSummary,
  inferFresh,
} = require('/tmp/lfa-compiled/utils/conditioningRules');

const {
  CONDITIONING_META,
  EXERCISE_TAGS,
} = require('/tmp/lfa-compiled/data/exerciseTags');

// ─── Test Framework ───

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    console.log(`  ✅ ${msg}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${msg}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n── ${title} ──`);
}

// ─── Helper: Default WeekLog ───

function emptyWeekLog(overrides = {}) {
  return {
    sessions: [],
    strengthSessions: [],
    teamTrainingSessions: 0,
    byeWeek: false,
    missedTeamTraining: false,
    doubleGameWeek: false,
    weeksOffTraining: 0,
    readiness: 'high',
    ...overrides,
  };
}

function baseCtx(overrides = {}) {
  return {
    dateStr: '2026-04-06', // Monday
    daysToGame: 5,
    daysSinceGame: 2,
    dayOfWeek: 1,
    seasonPhase: 'Off-season',
    activeInjuries: {},
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// 1. CONDITIONING METADATA
// ═══════════════════════════════════════════════════════════════

section('1. Conditioning Metadata — Tier Assignments');

// Tier A
const tierA = ['Sprint Intervals', 'Hill Sprints', 'Quality Sprints', 'MAS Training', 'Flog Friday'];
for (const name of tierA) {
  assert(CONDITIONING_META[name]?.tier === 'A', `${name} is Tier A`);
}

// Tier B-high
const tierBHigh = ['MetCon', 'Long Run', '6x1km', 'Hard Row Intervals', 'Hard SkiErg Intervals', 'Hard Assault Bike Intervals'];
for (const name of tierBHigh) {
  assert(CONDITIONING_META[name]?.tier === 'B-high', `${name} is Tier B-high`);
}

// Tier B-low
const tierBLow = ['Tempo Run', 'Bike Sprints', 'Row Intervals', 'SkiErg Intervals', 'Assault Bike Intervals'];
for (const name of tierBLow) {
  assert(CONDITIONING_META[name]?.tier === 'B-low', `${name} is Tier B-low`);
}

// Tier C
const tierC = ['Flush Run', 'Easy Bike', 'Easy Row', 'Easy Ski', 'Easy Swim', 'Light Circuits'];
for (const name of tierC) {
  assert(CONDITIONING_META[name]?.tier === 'C', `${name} is Tier C`);
}

section('1b. Conditioning Metadata — Modality & Impact');

assert(CONDITIONING_META['Flog Friday'].modality === 'mixed', 'Flog Friday is mixed modality');
assert(CONDITIONING_META['MetCon'].modality === 'mixed', 'MetCon is mixed modality');
assert(CONDITIONING_META['Sprint Intervals'].modality === 'run', 'Sprint Intervals is run modality');
assert(CONDITIONING_META['Bike Sprints'].modality === 'bike', 'Bike Sprints is bike modality');
assert(CONDITIONING_META['Row Intervals'].modality === 'row', 'Row Intervals is row modality');
assert(CONDITIONING_META['Easy Swim'].modality === 'swim', 'Easy Swim is swim modality');
assert(CONDITIONING_META['SkiErg Intervals'].modality === 'ski', 'SkiErg Intervals is ski modality');

// All Tier A are high impact
for (const name of tierA) {
  assert(CONDITIONING_META[name].impact === 'high', `${name} has high impact`);
}

// Low-impact machines
assert(CONDITIONING_META['Bike Sprints'].impact === 'low', 'Bike Sprints is low impact');
assert(CONDITIONING_META['Easy Bike'].impact === 'low', 'Easy Bike is low impact');
assert(CONDITIONING_META['Easy Swim'].impact === 'low', 'Easy Swim is low impact');

section('1c. All conditioning exercises have EXERCISE_TAGS');
const allCond = Object.keys(CONDITIONING_META);
for (const name of allCond) {
  assert(EXERCISE_TAGS[name] !== undefined, `${name} has exercise tags`);
  assert(EXERCISE_TAGS[name]?.movement === 'conditioning', `${name} movement = conditioning`);
}

// ═══════════════════════════════════════════════════════════════
// 2. HARD RULES — 48h Game Buffer
// ═══════════════════════════════════════════════════════════════

section('2. Hard Rules — 48h Game Buffer');

const gameDay = baseCtx({ daysToGame: 0, daysSinceGame: null });
assert(getAllowedTiersForDate(gameDay).size === 0, 'Game day: all tiers blocked');

const gMinus1 = baseCtx({ daysToGame: 1 });
assert(getAllowedTiersForDate(gMinus1).size === 0, 'G-1: all tiers blocked');

const gMinus2 = baseCtx({ daysToGame: 2 });
assert(getAllowedTiersForDate(gMinus2).size === 0, 'G-2: all tiers blocked');

const gMinus3 = baseCtx({ daysToGame: 3 });
assert(getAllowedTiersForDate(gMinus3).size > 0, 'G-3: some tiers allowed');

// ═══════════════════════════════════════════════════════════════
// 3. G+1 Recovery Only
// ═══════════════════════════════════════════════════════════════

section('3. G+1 — Recovery Only');

const gPlus1 = baseCtx({ daysSinceGame: 1, daysToGame: 6 });
const gPlus1Tiers = getAllowedTiersForDate(gPlus1);
assert(!gPlus1Tiers.has('A'), 'G+1: Tier A blocked');
assert(!gPlus1Tiers.has('B-high'), 'G+1: Tier B-high blocked');
assert(!gPlus1Tiers.has('B-low'), 'G+1: Tier B-low blocked');
assert(gPlus1Tiers.has('C'), 'G+1: Tier C allowed');

const gPlus1Result = resolveConditioning(gPlus1, emptyWeekLog());
assert(gPlus1Result === null || gPlus1Result.tier === 'C', 'G+1: only Tier C result');

// ═══════════════════════════════════════════════════════════════
// 4. In-Season — No Tier A
// ═══════════════════════════════════════════════════════════════

section('4. In-Season — No Tier A');

const inSeason = baseCtx({ seasonPhase: 'In-season', daysToGame: 5, daysSinceGame: 2 });
const inSeasonResult = resolveConditioning(inSeason, emptyWeekLog());
assert(inSeasonResult === null || inSeasonResult.tier !== 'A', 'In-season: no Tier A');

section('4b. In-Season — Max 1 Tier B per week');

const weekWith1B = emptyWeekLog({
  sessions: [{ dateStr: '2026-04-05', tier: 'B-low', exerciseName: 'Tempo Run', fatigue: 'moderate' }],
});
const inSeason2ndB = resolveConditioning(
  baseCtx({ seasonPhase: 'In-season', daysToGame: 5, daysSinceGame: 3, dateStr: '2026-04-08' }),
  weekWith1B,
);
assert(inSeason2ndB === null || inSeason2ndB.tier === 'C', 'In-season: 2nd B blocked, only C allowed');

// ═══════════════════════════════════════════════════════════════
// 5. Offseason Caps
// ═══════════════════════════════════════════════════════════════

section('5. Offseason Caps');

const offseason = baseCtx({ seasonPhase: 'Off-season', daysToGame: null, daysSinceGame: null });
const offResult = resolveConditioning(offseason, emptyWeekLog());
assert(offResult !== null, 'Offseason: conditioning available');

// Max 2 Tier A
const weekWith2A = emptyWeekLog({
  sessions: [
    { dateStr: '2026-04-05', tier: 'A', exerciseName: 'Sprint Intervals', fatigue: 'high' },
    { dateStr: '2026-04-03', tier: 'A', exerciseName: 'Hill Sprints', fatigue: 'high' },
  ],
});
const off3rdA = resolveConditioning(
  baseCtx({ seasonPhase: 'Off-season', dateStr: '2026-04-08', daysToGame: null, daysSinceGame: null }),
  weekWith2A,
);
assert(off3rdA === null || off3rdA.tier !== 'A', 'Offseason: 3rd Tier A blocked');

// ═══════════════════════════════════════════════════════════════
// 6. Stacking Guard
// ═══════════════════════════════════════════════════════════════

section('6. Stacking Guard');

// A yesterday blocks A and B-high today
const weekWithA = emptyWeekLog({
  sessions: [{ dateStr: '2026-04-05', tier: 'A', exerciseName: 'Sprint Intervals', fatigue: 'high' }],
});
const stackBlocked = getStackingBlockedTiers('2026-04-06', weekWithA);
assert(stackBlocked.has('A'), 'A yesterday blocks A today');
assert(stackBlocked.has('B-high'), 'A yesterday blocks B-high today');

// B-low yesterday does NOT block anything
const weekWithBLow = emptyWeekLog({
  sessions: [{ dateStr: '2026-04-05', tier: 'B-low', exerciseName: 'Tempo Run', fatigue: 'moderate' }],
});
const stackBLow = getStackingBlockedTiers('2026-04-06', weekWithBLow);
assert(stackBLow.size === 0, 'B-low yesterday blocks nothing');

// C yesterday blocks nothing
const weekWithC = emptyWeekLog({
  sessions: [{ dateStr: '2026-04-05', tier: 'C', exerciseName: 'Easy Bike', fatigue: 'low' }],
});
const stackC = getStackingBlockedTiers('2026-04-06', weekWithC);
assert(stackC.size === 0, 'C yesterday blocks nothing');

// B-high yesterday blocks A and B-high
const weekWithBHigh = emptyWeekLog({
  sessions: [{ dateStr: '2026-04-05', tier: 'B-high', exerciseName: 'MetCon', fatigue: 'high' }],
});
const stackBHigh = getStackingBlockedTiers('2026-04-06', weekWithBHigh);
assert(stackBHigh.has('A'), 'B-high yesterday blocks A');
assert(stackBHigh.has('B-high'), 'B-high yesterday blocks B-high');

// ═══════════════════════════════════════════════════════════════
// 7. Strength Interaction
// ═══════════════════════════════════════════════════════════════

section('7. Strength Interaction');

// High-fatigue strength blocks A + B-high
const highStr = emptyWeekLog({
  strengthSessions: [{ dateStr: '2026-04-06', fatigue: 'high' }],
});
const highBlocked = getStrengthBlockedTiers('2026-04-06', highStr);
assert(highBlocked.has('A'), 'High-fatigue strength blocks A');
assert(highBlocked.has('B-high'), 'High-fatigue strength blocks B-high');
assert(!highBlocked.has('B-low'), 'High-fatigue strength allows B-low');
assert(!highBlocked.has('C'), 'High-fatigue strength allows C');

// Moderate-fatigue strength blocks A only
const modStr = emptyWeekLog({
  strengthSessions: [{ dateStr: '2026-04-06', fatigue: 'moderate' }],
});
const modBlocked = getStrengthBlockedTiers('2026-04-06', modStr);
assert(modBlocked.has('A'), 'Moderate-fatigue strength blocks A');
assert(!modBlocked.has('B-high'), 'Moderate-fatigue strength allows B-high');

// Low-fatigue strength blocks nothing
const lowStr = emptyWeekLog({
  strengthSessions: [{ dateStr: '2026-04-06', fatigue: 'low' }],
});
const lowBlocked = getStrengthBlockedTiers('2026-04-06', lowStr);
assert(lowBlocked.size === 0, 'Low-fatigue strength blocks nothing');

// ═══════════════════════════════════════════════════════════════
// 8. Injury Filtering
// ═══════════════════════════════════════════════════════════════

section('8. Injury Filtering — Lower Limb Blocks Tier A');

assert(hasLowerLimbInjury({ hamstring: 'caution' }), 'hamstring caution = lower limb');
assert(hasLowerLimbInjury({ calf: 'avoid' }), 'calf avoid = lower limb');
assert(!hasLowerLimbInjury({ shoulder: 'avoid' }), 'shoulder avoid != lower limb');

const allCondNames = Object.keys(CONDITIONING_META);

// Hamstring avoid: blocks all Tier A + running B
const hamAvoid = filterConditioningByInjury(allCondNames, { hamstring: 'avoid' });
const hamAvoidTierA = hamAvoid.filter(n => CONDITIONING_META[n].tier === 'A');
assert(hamAvoidTierA.length === 0, 'Hamstring avoid: all Tier A blocked');

// Hamstring avoid: running B exercises blocked, bike/row/ski B allowed
const hamAvoidRunningB = hamAvoid.filter(n => {
  const m = CONDITIONING_META[n];
  return (m.tier === 'B-high' || m.tier === 'B-low') && (m.modality === 'run' || m.modality === 'mixed');
});
assert(hamAvoidRunningB.length === 0, 'Hamstring avoid: running B exercises blocked');

const hamAvoidBikeB = hamAvoid.filter(n => {
  const m = CONDITIONING_META[n];
  return (m.tier === 'B-high' || m.tier === 'B-low') && m.modality === 'bike';
});
assert(hamAvoidBikeB.length > 0, 'Hamstring avoid: bike B exercises allowed');

section('8b. Injury Filtering — Ankle Avoid');

const ankleAvoid = filterConditioningByInjury(allCondNames, { ankle: 'avoid' });
const ankleTierA = ankleAvoid.filter(n => CONDITIONING_META[n].tier === 'A');
assert(ankleTierA.length === 0, 'Ankle avoid: all Tier A blocked');

// Ankle avoid Tier C: only non-running allowed (bike, row, ski — no swim)
const ankleTierC = ankleAvoid.filter(n => CONDITIONING_META[n].tier === 'C');
const ankleCRunning = ankleTierC.filter(n => CONDITIONING_META[n].modality === 'run');
assert(ankleCRunning.length === 0, 'Ankle avoid: running Tier C blocked');
assert(ankleTierC.length > 0, 'Ankle avoid: some Tier C available (bike/row/ski)');

section('8c. Injury Filtering — Pubalgia Avoid');

const pubAvoid = filterConditioningByInjury(allCondNames, { pubalgia: 'avoid' });
const pubTierA = pubAvoid.filter(n => CONDITIONING_META[n].tier === 'A');
assert(pubTierA.length === 0, 'Pubalgia avoid: all Tier A blocked');
const pubRunningB = pubAvoid.filter(n => {
  const m = CONDITIONING_META[n];
  return (m.tier === 'B-high' || m.tier === 'B-low') && (m.modality === 'run' || m.modality === 'mixed');
});
assert(pubRunningB.length === 0, 'Pubalgia avoid: running B blocked');

section('8d. Injury — Low-Impact Alternatives Preferred');

const hamCtx = baseCtx({ seasonPhase: 'Off-season', activeInjuries: { hamstring: 'caution' }, daysToGame: null, daysSinceGame: null });
const hamResult = resolveConditioning(hamCtx, emptyWeekLog());
// With hamstring caution, Tier A blocked. If a B is selected, prefer low-impact.
if (hamResult && (hamResult.tier === 'B-high' || hamResult.tier === 'B-low')) {
  assert(hasRunningInjury({ hamstring: 'caution' }), 'Hamstring caution triggers running injury flag');
}

// ═══════════════════════════════════════════════════════════════
// 9. Bye Week Logic
// ═══════════════════════════════════════════════════════════════

section('9a. inferFresh — freshness derivation');

assert(inferFresh({}, 'high') === true, 'No injuries + high readiness = fresh');
assert(inferFresh({}, 'medium') === true, 'No injuries + medium readiness = fresh');
assert(inferFresh({}, 'low') === false, 'No injuries + low readiness = not fresh');
assert(inferFresh({ hamstring: 'avoid' }, 'high') === false, 'Avoid injury + high readiness = not fresh');
assert(inferFresh({ hamstring: 'caution' }, 'high') === true, 'Caution injury + high readiness = fresh');
assert(inferFresh({ hamstring: 'avoid', shoulder: 'caution' }, 'medium') === false, 'Any avoid = not fresh');

section('9b. Bye Week — Fresh');

// Fresh: no avoid injuries + readiness high → inferred fresh
const byeFresh = resolveConditioning(
  baseCtx({ seasonPhase: 'In-season', daysToGame: null, daysSinceGame: 8, dayOfWeek: 2, activeInjuries: {} }),
  emptyWeekLog({ byeWeek: true, readiness: 'high' }),
);
assert(byeFresh !== null, 'Bye week fresh: conditioning available');

section('9b. Bye Week — Fatigued/Injured');

// Fatigued: readiness low → inferred not fresh
const byeFatiguedLowReadiness = resolveConditioning(
  baseCtx({ seasonPhase: 'In-season', daysToGame: null, daysSinceGame: 8, dayOfWeek: 2, activeInjuries: {} }),
  emptyWeekLog({ byeWeek: true, readiness: 'low' }),
);
assert(byeFatiguedLowReadiness === null || byeFatiguedLowReadiness.tier === 'B-low' || byeFatiguedLowReadiness.tier === 'C',
  'Bye week low readiness: only B-low or C');

// Injured: avoid-level injury → inferred not fresh even with high readiness
const byeInjured = resolveConditioning(
  baseCtx({ seasonPhase: 'In-season', daysToGame: null, daysSinceGame: 8, dayOfWeek: 2, activeInjuries: { hamstring: 'avoid' } }),
  emptyWeekLog({ byeWeek: true, readiness: 'high' }),
);
assert(byeInjured === null || byeInjured.tier === 'B-low' || byeInjured.tier === 'C',
  'Bye week with avoid injury: only B-low or C');

// ═══════════════════════════════════════════════════════════════
// 10. Missed Team Training
// ═══════════════════════════════════════════════════════════════

section('10. Missed Team Training');

const missedWith1B = emptyWeekLog({
  missedTeamTraining: true,
  sessions: [{ dateStr: '2026-04-05', tier: 'B-low', exerciseName: 'Tempo Run', fatigue: 'moderate' }],
});
const missedResult = resolveConditioning(
  baseCtx({ seasonPhase: 'In-season', daysToGame: 5, daysSinceGame: 3, dateStr: '2026-04-08' }),
  missedWith1B,
);
// With missed training, B cap goes from 1 to 2 — 2nd B should be allowed
assert(missedResult !== null && (missedResult.tier === 'B-high' || missedResult.tier === 'B-low' || missedResult.tier === 'C'),
  'Missed training: 2nd B session allowed');

// ═══════════════════════════════════════════════════════════════
// 11. Double Game Week
// ═══════════════════════════════════════════════════════════════

section('11. Double Game Week');

const doubleResult = resolveConditioning(
  baseCtx({ seasonPhase: 'In-season', daysToGame: 3, daysSinceGame: 3, dayOfWeek: 3 }),
  emptyWeekLog({ doubleGameWeek: true }),
);
assert(doubleResult === null || doubleResult.tier === 'C', 'Double game week: only Tier C');

// ═══════════════════════════════════════════════════════════════
// 12. Return From Break
// ═══════════════════════════════════════════════════════════════

section('12. Return From Break');

const returnWeek1 = resolveConditioning(
  baseCtx({ seasonPhase: 'Off-season', daysToGame: null, daysSinceGame: null }),
  emptyWeekLog({ weeksOffTraining: 2 }),
);
assert(returnWeek1 === null || returnWeek1.tier === 'C', 'Return week 1 (2+ weeks off): Tier C only');

const returnWeek2 = resolveConditioning(
  baseCtx({ seasonPhase: 'Off-season', daysToGame: null, daysSinceGame: null }),
  emptyWeekLog({ weeksOffTraining: 1 }),
);
assert(returnWeek2 !== null, 'Return week 2 (1 week off): conditioning available');
assert(returnWeek2.tier !== 'A', 'Return week 2: Tier A still blocked');

// ═══════════════════════════════════════════════════════════════
// 13. Non-Forcing Rule
// ═══════════════════════════════════════════════════════════════

section('13. Non-Forcing Rule');

// G-2 should return null (48h buffer)
const gm2 = resolveConditioning(
  baseCtx({ daysToGame: 2 }),
  emptyWeekLog(),
);
assert(gm2 === null, 'G-2: returns null (non-forcing)');

// Game day should return null
const gd = resolveConditioning(
  baseCtx({ daysToGame: 0 }),
  emptyWeekLog(),
);
assert(gd === null, 'Game day: returns null (non-forcing)');

// ═══════════════════════════════════════════════════════════════
// 14. Preseason — Team Training Counts
// ═══════════════════════════════════════════════════════════════

section('14. Preseason — Team Training Counts Toward Total');

const preseason5 = emptyWeekLog({
  teamTrainingSessions: 3,
  sessions: [
    { dateStr: '2026-04-03', tier: 'B-low', exerciseName: 'Tempo Run', fatigue: 'moderate' },
    { dateStr: '2026-04-04', tier: 'C', exerciseName: 'Easy Bike', fatigue: 'low' },
  ],
});
// 3 team + 2 cond = 5 total, at cap
const pre5thResult = resolveConditioning(
  baseCtx({ seasonPhase: 'Pre-season', daysToGame: 5, dateStr: '2026-04-08', daysSinceGame: 3 }),
  preseason5,
);
assert(pre5thResult === null || pre5thResult.tier === 'C', 'Preseason at cap 5: only C allowed');

// ═══════════════════════════════════════════════════════════════
// 15. Modality Available in Selection
// ═══════════════════════════════════════════════════════════════

section('15. Modality-Based Selection');

// With hamstring avoid in offseason, should get a low-impact option
const hamAvoidCtx = baseCtx({
  seasonPhase: 'Off-season',
  activeInjuries: { hamstring: 'avoid' },
  daysToGame: null,
  daysSinceGame: null,
});
const hamAvoidResult = resolveConditioning(hamAvoidCtx, emptyWeekLog());
if (hamAvoidResult) {
  const meta = CONDITIONING_META[hamAvoidResult.exerciseName];
  // Should be low-impact since running is restricted
  assert(
    meta.impact === 'low' || meta.tier === 'C',
    `Hamstring avoid: selected ${hamAvoidResult.exerciseName} (impact=${meta.impact}, tier=${meta.tier})`
  );
}

// ═══════════════════════════════════════════════════════════════
// 16. Offseason Total Cap Logic
// ═══════════════════════════════════════════════════════════════

section('16. Offseason Total Cap — 5 if Tier C present, else 4');

const off4NonC = emptyWeekLog({
  sessions: [
    { dateStr: '2026-04-01', tier: 'A', exerciseName: 'Sprint Intervals', fatigue: 'high' },
    { dateStr: '2026-04-02', tier: 'A', exerciseName: 'Hill Sprints', fatigue: 'high' },
    { dateStr: '2026-04-03', tier: 'B-high', exerciseName: '6x1km', fatigue: 'high' },
    { dateStr: '2026-04-04', tier: 'B-low', exerciseName: 'Tempo Run', fatigue: 'moderate' },
  ],
});
const off5thNonC = resolveConditioning(
  baseCtx({ seasonPhase: 'Off-season', daysToGame: null, daysSinceGame: null, dateStr: '2026-04-08' }),
  off4NonC,
);
assert(off5thNonC === null || off5thNonC.tier === 'C', 'Offseason 4 non-C: 5th must be C or null');

// ═══════════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════════

console.log(`\n════════════════════════════════════════`);
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log(`════════════════════════════════════════`);

if (failed > 0) process.exit(1);
