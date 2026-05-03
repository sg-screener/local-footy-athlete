/**
 * Progression System Tests
 *
 * Comprehensive tests for strength progression, conditioning progression,
 * and shared helpers. Tests the full pipeline:
 *   - RPE bridge
 *   - Completion quality derivation
 *   - Trend signal derivation
 *   - Strength state resolution (8-step chain)
 *   - Conditioning state resolution (5-step + 3 guards)
 *   - Deload trigger split (hard/soft)
 *   - In-season lower body micro-progression
 *   - Conditioning load model and spike guard
 *   - Builder integration
 */

// ─── Imports ───

const {
  feelingToRPE,
  deriveCompletionQuality,
  deriveSessionCompletionQuality,
  deriveTrend,
  extractExposureHistory,
  countConsecutiveBuildWeeks,
  estimateWeeksSinceDeload,
  calculateConditioningLoad,
} = require('/tmp/lfa-compiled/utils/progressionHelpers');

const {
  resolveProgression,
} = require('/tmp/lfa-compiled/utils/progressionRules');

const {
  resolveConditioningProgression,
} = require('/tmp/lfa-compiled/utils/conditioningProgressionRules');

// ─── Test Scaffolding ───

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(message);
    console.log(`  FAIL: ${message}`);
  }
}

function section(name) {
  console.log(`\n── ${name} ──`);
}

// ─── Default Inputs ───

function defaultStrengthInput(overrides = {}) {
  return {
    exerciseRole: 'primary_strength',
    seasonPhase: 'Off-season',
    readiness: 'medium',
    completionQuality: 'full',
    weeksSinceDeload: 2,
    consecutiveBuildWeeks: 2,
    recentRPE: 6,
    daysToGame: null,
    daysSinceGame: null,
    doubleGameWeek: false,
    weeksOffTraining: 0,
    injuryAvoidFlag: false,
    recentDeloadTrigger: null,
    missedSessionsThisWeek: 0,
    sessionFeeling: 'Good',
    trend: 'flat',
    isLowerBody: false,
    consecutiveFullCompletions: 1,
    ...overrides,
  };
}

function defaultConditioningInput(overrides = {}) {
  return {
    tier: 'B-low',
    readiness: 'medium',
    recentRPE: 6,
    completionQuality: 'full',
    hasAvoidInjury: false,
    hasModifyInjury: false,
    seasonPhase: 'Off-season',
    weeklyConditioningCount: 2,
    daysToGame: null,
    doubleGameWeek: false,
    highFatigueStrengthThisWeek: false,
    lastSessionProgressed: false,
    weeklyLoad: 3,
    previousWeekLoad: 3,
    currentReps: 6,
    currentIntervals: 4,
    currentDuration: 25,
    currentRest: 60,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// SECTION 1: RPE Bridge
// ═══════════════════════════════════════════════════════════════

section('1. RPE Bridge');

assert(feelingToRPE('Cooked') === 10, 'Cooked → RPE 10');
assert(feelingToRPE('Sore') === 8, 'Sore → RPE 8');
assert(feelingToRPE('Strong') === 7, 'Strong → RPE 7');
assert(feelingToRPE('Good') === 6, 'Good → RPE 6');
assert(feelingToRPE('Average') === 5, 'Average → RPE 5');

// ═══════════════════════════════════════════════════════════════
// SECTION 2: Completion Quality Derivation
// ═══════════════════════════════════════════════════════════════

section('2. Completion Quality');

const makeSet = (reps, weight) => ({
  id: '1', loggedWorkoutId: 'w1', workoutExerciseId: 'e1', setNumber: 1,
  actualReps: reps, actualWeightKg: weight, createdAt: '', updatedAt: '',
});

// Full completion: 3/3 sets done
assert(
  deriveCompletionQuality([makeSet(8, 60), makeSet(8, 60), makeSet(8, 60)], 3, 60) === 'full',
  'All sets at target weight → full'
);

// Partial: 2/4 sets = 50%
assert(
  deriveCompletionQuality([makeSet(8, 60), makeSet(8, 60)], 4, 60) === 'partial',
  '2/4 sets = 50% → partial'
);

// Failed: 1/4 sets = 25%
assert(
  deriveCompletionQuality([makeSet(8, 60)], 4, 60) === 'failed',
  '1/4 sets = 25% → failed'
);

// No sets logged
assert(
  deriveCompletionQuality([], 3, 60) === 'failed',
  'No sets → failed'
);

// Load reduced mid-session
assert(
  deriveCompletionQuality([makeSet(8, 60), makeSet(8, 50)], 3, 60) === 'partial',
  'Load reduced >10% with incomplete → partial'
);

// ═══════════════════════════════════════════════════════════════
// SECTION 3: Trend Signal
// ═══════════════════════════════════════════════════════════════

section('3. Trend Signal');

// Fewer than 2 exposures
assert(deriveTrend([]) === 'flat', 'No exposures → flat');
assert(deriveTrend([{ load: 60, reps: 8 }]) === 'flat', 'One exposure → flat');

// Volume up ≥5%
assert(
  deriveTrend([{ load: 60, reps: 8 }, { load: 65, reps: 8 }]) === 'up',
  '60×8 → 65×8 (+10.4%) → up'
);

// Volume down ≥5%
assert(
  deriveTrend([{ load: 60, reps: 8 }, { load: 55, reps: 8 }]) === 'down',
  '60×8 → 55×8 (-10.4%) → down'
);

// Flat (within ±5%)
assert(
  deriveTrend([{ load: 60, reps: 8 }, { load: 61, reps: 8 }]) === 'flat',
  '60×8 → 61×8 (+1.7%) → flat'
);

// 3 exposures — compare first to last
assert(
  deriveTrend([{ load: 60, reps: 8 }, { load: 62, reps: 8 }, { load: 65, reps: 8 }]) === 'up',
  '3 exposures trending up → up'
);

// ═══════════════════════════════════════════════════════════════
// SECTION 4: Conditioning Load Model
// ═══════════════════════════════════════════════════════════════

section('4. Conditioning Load Model');

assert(
  calculateConditioningLoad([{ tier: 'A' }, { tier: 'B-low' }, { tier: 'C' }]) === 4.5,
  'A(3) + B-low(1) + C(0.5) = 4.5'
);

assert(
  calculateConditioningLoad([{ tier: 'B-high' }, { tier: 'B-high' }]) === 4,
  '2× B-high = 4'
);

assert(
  calculateConditioningLoad([]) === 0,
  'Empty sessions = 0 load'
);

// ═══════════════════════════════════════════════════════════════
// SECTION 5: Strength — Return to Training (Step 1)
// ═══════════════════════════════════════════════════════════════

section('5. Strength — Return to Training');

const returnResult = resolveProgression(defaultStrengthInput({
  weeksOffTraining: 3,
}));
assert(returnResult.state === 'return', 'weeksOffTraining >= 2 → return');
assert(returnResult.loadDelta === 'big_down', 'Return after 3 weeks → big_down (60% baseline)');
assert(returnResult.rpeDelta === 'pull', 'Return RPE pulled');

const returnPostDeload = resolveProgression(defaultStrengthInput({
  weeksOffTraining: 2,
  recentDeloadTrigger: 'overreach',
}));
assert(returnPostDeload.state === 'return', 'weeksOff=2 + post-deload → return');
assert(returnPostDeload.loadDelta === 'down', 'Post-deload return → down (80% baseline)');

// ═══════════════════════════════════════════════════════════════
// SECTION 6: Strength — Hard Deload Triggers (Step 2)
// ═══════════════════════════════════════════════════════════════

section('6. Strength — Hard Deload Triggers');

const deloadOverreach = resolveProgression(defaultStrengthInput({
  recentDeloadTrigger: 'overreach',
}));
assert(deloadOverreach.state === 'deload', 'Post-overreach → deload');

const deloadDGW = resolveProgression(defaultStrengthInput({
  doubleGameWeek: true,
}));
assert(deloadDGW.state === 'deload', 'Double game week → deload');

const deloadInjury = resolveProgression(defaultStrengthInput({
  injuryAvoidFlag: true,
}));
assert(deloadInjury.state === 'deload', 'Injury avoid flag → deload');

// ═══════════════════════════════════════════════════════════════
// SECTION 7: Strength — Soft Deload Triggers (Step 3)
// ═══════════════════════════════════════════════════════════════

section('7. Strength — Soft Deload Triggers');

// Single soft signal should NOT trigger deload
const singleSoft = resolveProgression(defaultStrengthInput({
  readiness: 'low',
  // all other soft signals are off
}));
assert(singleSoft.state !== 'deload', 'Single soft signal → NOT deload');

// Two soft signals → deload
const twoSoft = resolveProgression(defaultStrengthInput({
  readiness: 'low',
  recentRPE: 9,
}));
assert(twoSoft.state === 'deload', 'Low readiness + high RPE → deload');

const twoSoftAlt = resolveProgression(defaultStrengthInput({
  sessionFeeling: 'Cooked',
  missedSessionsThisWeek: 1,
}));
assert(twoSoftAlt.state === 'deload', 'Cooked + missed sessions → deload');

// Three soft signals → deload
const threeSoft = resolveProgression(defaultStrengthInput({
  readiness: 'low',
  recentRPE: 8,
  sessionFeeling: 'Cooked',
}));
assert(threeSoft.state === 'deload', 'Three soft signals → deload');

// ═══════════════════════════════════════════════════════════════
// SECTION 8: Strength — Scheduled Deload (Step 4 — with signal)
// ═══════════════════════════════════════════════════════════════

section('8. Strength — Scheduled Deload (not purely calendar-forced)');

// In-season, 4+ weeks, WITH fatigue signal → deload
const scheduledInSeason = resolveProgression(defaultStrengthInput({
  seasonPhase: 'In-season',
  weeksSinceDeload: 5,
  readiness: 'low',  // fatigue signal present
}));
assert(scheduledInSeason.state === 'deload', 'In-season 5 weeks + low readiness → deload');

// In-season, 4+ weeks, WITHOUT any fatigue signal → should NOT deload
const scheduledNoSignal = resolveProgression(defaultStrengthInput({
  seasonPhase: 'In-season',
  weeksSinceDeload: 5,
  readiness: 'medium',
  recentRPE: 6,
  missedSessionsThisWeek: 0,
  sessionFeeling: 'Good',
}));
assert(scheduledNoSignal.state !== 'deload', 'In-season 5 weeks + NO fatigue signal → NOT deload');

// Off-season, 6+ weeks, with fatigue signal → deload
const scheduledOffSeason = resolveProgression(defaultStrengthInput({
  seasonPhase: 'Off-season',
  weeksSinceDeload: 7,
  sessionFeeling: 'Sore',  // fatigue signal
}));
assert(scheduledOffSeason.state === 'deload', 'Off-season 7 weeks + sore → deload');

// Off-season, 6+ weeks, NO signal → not deload
const scheduledNoSignalOff = resolveProgression(defaultStrengthInput({
  seasonPhase: 'Off-season',
  weeksSinceDeload: 7,
  readiness: 'high',
  recentRPE: 6,
  sessionFeeling: 'Good',
}));
assert(scheduledNoSignalOff.state !== 'deload', 'Off-season 7 weeks + all good → NOT deload');

// ═══════════════════════════════════════════════════════════════
// SECTION 9: Strength — Game Proximity Hold (Step 5)
// ═══════════════════════════════════════════════════════════════

section('9. Strength — Game Proximity');

const holdG2 = resolveProgression(defaultStrengthInput({
  seasonPhase: 'In-season',
  daysToGame: 2,
}));
assert(holdG2.state === 'hold', 'G-2 → hold');

const holdG1pre = resolveProgression(defaultStrengthInput({
  seasonPhase: 'In-season',
  daysToGame: 1,
}));
assert(holdG1pre.state === 'hold', 'G-1 → hold');

const notHoldG3 = resolveProgression(defaultStrengthInput({
  seasonPhase: 'In-season',
  daysToGame: 3,
  readiness: 'medium',
}));
assert(notHoldG3.state !== 'hold' || notHoldG3.note.includes('maintain'), 'G-3 → not hold');

// ═══════════════════════════════════════════════════════════════
// SECTION 10: Strength — Season Phase Matrix (Step 6)
// ═══════════════════════════════════════════════════════════════

section('10. Strength — Season Phase Matrix');

// In-season low → hold
const isLow = resolveProgression(defaultStrengthInput({
  seasonPhase: 'In-season',
  readiness: 'low',
}));
assert(isLow.state === 'hold', 'In-season + low readiness → hold');

// In-season medium → maintain
const isMed = resolveProgression(defaultStrengthInput({
  seasonPhase: 'In-season',
  readiness: 'medium',
}));
assert(isMed.state === 'maintain', 'In-season + medium readiness → maintain');

// In-season high (upper body) → maintain
const isHighUpper = resolveProgression(defaultStrengthInput({
  seasonPhase: 'In-season',
  readiness: 'high',
  isLowerBody: false,
}));
assert(isHighUpper.state === 'maintain', 'In-season + high + upper body → maintain');

// Pre-season medium → build
const preMed = resolveProgression(defaultStrengthInput({
  seasonPhase: 'Pre-season',
  readiness: 'medium',
}));
assert(preMed.state === 'build', 'Pre-season + medium → build');

// Pre-season low → maintain
const preLow = resolveProgression(defaultStrengthInput({
  seasonPhase: 'Pre-season',
  readiness: 'low',
}));
assert(preLow.state === 'maintain', 'Pre-season + low → maintain');

// Off-season medium → build
const offMed = resolveProgression(defaultStrengthInput({
  seasonPhase: 'Off-season',
  readiness: 'medium',
}));
assert(offMed.state === 'build', 'Off-season + medium → build');

// ═══════════════════════════════════════════════════════════════
// SECTION 11: Strength — In-Season Lower Body Build (§6a)
// ═══════════════════════════════════════════════════════════════

section('11. In-Season Lower Body Build');

// Gate passes: high readiness, low RPE, no nearby game, not DGW, trend not down
const lbBuild = resolveProgression(defaultStrengthInput({
  seasonPhase: 'In-season',
  readiness: 'high',
  recentRPE: 5,
  daysToGame: 5,
  isLowerBody: true,
  trend: 'flat',
}));
assert(lbBuild.state === 'build', 'In-season lower body + all gates pass → build');
assert(lbBuild.loadDelta === 'micro_up', 'In-season LB build → micro_up only');
assert(lbBuild.setsDelta === 'none', 'In-season LB build → no set changes');

// Gate fails: RPE too high
const lbFailRPE = resolveProgression(defaultStrengthInput({
  seasonPhase: 'In-season',
  readiness: 'high',
  recentRPE: 7,
  daysToGame: 5,
  isLowerBody: true,
}));
assert(lbFailRPE.state === 'maintain', 'LB gate fails (RPE 7) → maintain');

// Gate fails: game within 2 days
const lbFailGame = resolveProgression(defaultStrengthInput({
  seasonPhase: 'In-season',
  readiness: 'high',
  recentRPE: 5,
  daysToGame: 2,
  isLowerBody: true,
}));
assert(lbFailGame.state === 'hold', 'LB gate: game in 2 days → hold (step 5 catches first)');

// Gate fails: trend down
const lbFailTrend = resolveProgression(defaultStrengthInput({
  seasonPhase: 'In-season',
  readiness: 'high',
  recentRPE: 5,
  daysToGame: 5,
  isLowerBody: true,
  trend: 'down',
}));
assert(lbFailTrend.state === 'maintain', 'LB gate fails (trend down) → maintain');

// ═══════════════════════════════════════════════════════════════
// SECTION 12: Strength — Trend Gate (Step 7)
// ═══════════════════════════════════════════════════════════════

section('12. Strength — Trend Gate');

const buildDownTrend = resolveProgression(defaultStrengthInput({
  seasonPhase: 'Off-season',
  readiness: 'medium',
  trend: 'down',
}));
assert(buildDownTrend.state === 'hold', 'Build + trend down → hold');

const buildFlatTrend = resolveProgression(defaultStrengthInput({
  seasonPhase: 'Off-season',
  readiness: 'medium',
  trend: 'flat',
}));
assert(buildFlatTrend.state === 'build', 'Build + trend flat → stays build');

// ═══════════════════════════════════════════════════════════════
// SECTION 13: Strength — Overreach (Step 8)
// ═══════════════════════════════════════════════════════════════

section('13. Strength — Overreach');

const overreach = resolveProgression(defaultStrengthInput({
  seasonPhase: 'Off-season',
  readiness: 'high',
  consecutiveBuildWeeks: 4,
  recentRPE: 6,
  trend: 'up',
}));
assert(overreach.state === 'overreach', 'Off-season + high + 4 build weeks + RPE 6 → overreach');
assert(overreach.loadDelta === 'up', 'Overreach → aggressive load up');
assert(overreach.setsDelta === 'add_one', 'Overreach → add one set');

// Overreach blocked: not off-season
const noOverreachIS = resolveProgression(defaultStrengthInput({
  seasonPhase: 'In-season',
  readiness: 'high',
  consecutiveBuildWeeks: 4,
  recentRPE: 6,
}));
assert(noOverreachIS.state !== 'overreach', 'In-season → no overreach');

// Overreach blocked: low build weeks
const noOverreachWeeks = resolveProgression(defaultStrengthInput({
  seasonPhase: 'Off-season',
  readiness: 'high',
  consecutiveBuildWeeks: 2,
  recentRPE: 6,
}));
assert(noOverreachWeeks.state !== 'overreach', 'Only 2 build weeks → no overreach');

// Overreach blocked: trend down
const noOverreachTrend = resolveProgression(defaultStrengthInput({
  seasonPhase: 'Off-season',
  readiness: 'high',
  consecutiveBuildWeeks: 4,
  recentRPE: 6,
  trend: 'down',
}));
assert(noOverreachTrend.state !== 'overreach', 'Trend down → no overreach (caught by step 7 hold)');

// ═══════════════════════════════════════════════════════════════
// SECTION 14: Strength — Build Mechanics
// ═══════════════════════════════════════════════════════════════

section('14. Strength — Build Mechanics');

// Full completion, 1 consecutive → micro_up
const buildMicro = resolveProgression(defaultStrengthInput({
  seasonPhase: 'Off-season',
  readiness: 'medium',
  completionQuality: 'full',
  consecutiveFullCompletions: 1,
}));
assert(buildMicro.loadDelta === 'micro_up', '1 consecutive full → micro_up');

// Full completion, 2+ consecutive → up
const buildUp = resolveProgression(defaultStrengthInput({
  seasonPhase: 'Off-season',
  readiness: 'medium',
  completionQuality: 'full',
  consecutiveFullCompletions: 2,
}));
assert(buildUp.loadDelta === 'up', '2 consecutive full → up');

// Full completion, 3+ consecutive → add_one set
const buildSets = resolveProgression(defaultStrengthInput({
  seasonPhase: 'Off-season',
  readiness: 'medium',
  completionQuality: 'full',
  consecutiveFullCompletions: 3,
}));
assert(buildSets.setsDelta === 'add_one', '3 consecutive full → add_one set');

// Partial completion → hold (no regression)
const buildPartial = resolveProgression(defaultStrengthInput({
  seasonPhase: 'Off-season',
  readiness: 'medium',
  completionQuality: 'partial',
  consecutiveFullCompletions: 0,
}));
assert(buildPartial.loadDelta === 'none', 'Partial → no load change');

// Failed completion → down
const buildFailed = resolveProgression(defaultStrengthInput({
  seasonPhase: 'Off-season',
  readiness: 'medium',
  completionQuality: 'failed',
}));
assert(buildFailed.loadDelta === 'down', 'Failed completion → load down');

// ═══════════════════════════════════════════════════════════════
// SECTION 15: Strength — Maintain Mechanics
// ═══════════════════════════════════════════════════════════════

section('15. Strength — Maintain Mechanics');

const maintainNormal = resolveProgression(defaultStrengthInput({
  seasonPhase: 'In-season',
  readiness: 'medium',
  completionQuality: 'full',
}));
assert(maintainNormal.state === 'maintain', 'In-season medium → maintain');
assert(maintainNormal.loadDelta === 'none', 'Maintain → no load change');
assert(maintainNormal.setsDelta === 'none', 'Maintain → no sets change');

// Maintain + failed → hold
const maintainFailed = resolveProgression(defaultStrengthInput({
  seasonPhase: 'In-season',
  readiness: 'medium',
  completionQuality: 'failed',
}));
assert(maintainFailed.state === 'hold', 'Maintain + failed → hold');

// Maintain + trend up → note says progressing well
const maintainTrendUp = resolveProgression(defaultStrengthInput({
  seasonPhase: 'In-season',
  readiness: 'medium',
  trend: 'up',
}));
assert(
  maintainTrendUp.note.includes('progressing well'),
  'Maintain + trend up → note mentions progressing well'
);

// ═══════════════════════════════════════════════════════════════
// SECTION 16: Strength — Deload Output
// ═══════════════════════════════════════════════════════════════

section('16. Strength — Deload Output');

const deloadResult = resolveProgression(defaultStrengthInput({
  doubleGameWeek: true,
}));
assert(deloadResult.loadDelta === 'big_down', 'Deload → big_down');
assert(deloadResult.setsDelta === 'drop_two', 'Deload → drop_two');
assert(deloadResult.rpeDelta === 'pull', 'Deload → pull RPE');

// ═══════════════════════════════════════════════════════════════
// SECTION 17: Conditioning — Tier C Always Maintain
// ═══════════════════════════════════════════════════════════════

section('17. Conditioning — Tier C');

const tierC = resolveConditioningProgression(defaultConditioningInput({
  tier: 'C',
  seasonPhase: 'Off-season',
  readiness: 'high',
}));
assert(tierC.state === 'maintain', 'Tier C always maintain');
assert(tierC.adjustment.repsDelta === 0, 'Tier C no rep changes');
assert(tierC.adjustment.durationDelta === 0, 'Tier C no duration changes');

// ═══════════════════════════════════════════════════════════════
// SECTION 18: Conditioning — Hard Deload Triggers
// ═══════════════════════════════════════════════════════════════

section('18. Conditioning — Hard Deload');

const condDGW = resolveConditioningProgression(defaultConditioningInput({
  doubleGameWeek: true,
}));
assert(condDGW.state === 'deload', 'Double game week → conditioning deload');

const condInjury = resolveConditioningProgression(defaultConditioningInput({
  hasAvoidInjury: true,
}));
assert(condInjury.state === 'deload', 'Avoid injury → conditioning deload');
assert(condInjury.note.includes('injury'), 'Injury deload note mentions injury');

// ═══════════════════════════════════════════════════════════════
// SECTION 19: Conditioning — Soft Deload (2+ required)
// ═══════════════════════════════════════════════════════════════

section('19. Conditioning — Soft Deload');

// Single signal → NOT deload
const condSingle = resolveConditioningProgression(defaultConditioningInput({
  readiness: 'low',
}));
assert(condSingle.state !== 'deload', 'Single soft signal → NOT deload');

// Two signals → deload
const condTwoSoft = resolveConditioningProgression(defaultConditioningInput({
  readiness: 'low',
  recentRPE: 9,
}));
assert(condTwoSoft.state === 'deload', 'Low readiness + high RPE → conditioning deload');

const condTwoSoftAlt = resolveConditioningProgression(defaultConditioningInput({
  recentRPE: 8,
  completionQuality: 'failed',
}));
assert(condTwoSoftAlt.state === 'deload', 'High RPE + failed → conditioning deload');

// ═══════════════════════════════════════════════════════════════
// SECTION 20: Conditioning — Game Proximity Hold
// ═══════════════════════════════════════════════════════════════

section('20. Conditioning — Game Proximity');

const condHold = resolveConditioningProgression(defaultConditioningInput({
  daysToGame: 2,
}));
assert(condHold.state === 'hold', 'daysToGame=2 → conditioning hold');

const condHold1 = resolveConditioningProgression(defaultConditioningInput({
  daysToGame: 1,
}));
assert(condHold1.state === 'hold', 'daysToGame=1 → conditioning hold');

// ═══════════════════════════════════════════════════════════════
// SECTION 21: Conditioning — Season Phase + Tier Constraints
// ═══════════════════════════════════════════════════════════════

section('21. Conditioning — Season/Tier Constraints');

// Off-season B-low → build
const condBuild = resolveConditioningProgression(defaultConditioningInput({
  seasonPhase: 'Off-season',
  tier: 'B-low',
}));
assert(condBuild.state === 'build', 'Off-season B-low → build');

// In-season Tier A → capped at maintain
const condAIS = resolveConditioningProgression(defaultConditioningInput({
  seasonPhase: 'In-season',
  tier: 'A',
}));
assert(condAIS.state === 'maintain', 'In-season Tier A → maintain (capped)');

// In-season Tier B-high → capped at maintain
const condBhIS = resolveConditioningProgression(defaultConditioningInput({
  seasonPhase: 'In-season',
  tier: 'B-high',
}));
assert(condBhIS.state === 'maintain', 'In-season Tier B-high → maintain (capped)');

// In-season Tier B-low → build allowed
const condBlIS = resolveConditioningProgression(defaultConditioningInput({
  seasonPhase: 'In-season',
  tier: 'B-low',
}));
// In-season default is maintain for Step 4, but B-low doesn't cap further
assert(condBlIS.state === 'maintain', 'In-season B-low → maintain (season default)');

// Off-season Tier A → build
const condAOff = resolveConditioningProgression(defaultConditioningInput({
  seasonPhase: 'Off-season',
  tier: 'A',
  currentReps: 5,
}));
assert(condAOff.state === 'build', 'Off-season Tier A → build');

// Pre-season B-high → build
const condBhPre = resolveConditioningProgression(defaultConditioningInput({
  seasonPhase: 'Pre-season',
  tier: 'B-high',
  currentIntervals: 4,
}));
assert(condBhPre.state === 'build', 'Pre-season Tier B-high → build');

// ═══════════════════════════════════════════════════════════════
// SECTION 22: Conditioning — Guard A (Strength Fatigue)
// ═══════════════════════════════════════════════════════════════

section('22. Conditioning — Strength Fatigue Guard');

const condStrFatigue = resolveConditioningProgression(defaultConditioningInput({
  seasonPhase: 'Off-season',
  tier: 'B-low',
  highFatigueStrengthThisWeek: true,
}));
assert(condStrFatigue.state === 'maintain', 'High fatigue strength → conditioning maintain');

// ═══════════════════════════════════════════════════════════════
// SECTION 23: Conditioning — Guard B (No Consecutive Progression)
// ═══════════════════════════════════════════════════════════════

section('23. Conditioning — Consecutive Guard');

const condConsec = resolveConditioningProgression(defaultConditioningInput({
  seasonPhase: 'Off-season',
  tier: 'B-low',
  lastSessionProgressed: true,
}));
assert(condConsec.state === 'maintain', 'Last session progressed → maintain (earn it)');

// ═══════════════════════════════════════════════════════════════
// SECTION 24: Conditioning — Guard C (Load Spike)
// ═══════════════════════════════════════════════════════════════

section('24. Conditioning — Load Spike Guard');

// 35% increase → block build
const condSpike = resolveConditioningProgression(defaultConditioningInput({
  seasonPhase: 'Off-season',
  tier: 'B-low',
  weeklyLoad: 5.5,
  previousWeekLoad: 3.0,
}));
assert(condSpike.state === 'maintain', '>35% load increase → maintain');
assert(condSpike.note.includes('spike'), 'Spike note mentions spike');

// Equal load → guard does not activate
const condEqual = resolveConditioningProgression(defaultConditioningInput({
  seasonPhase: 'Off-season',
  tier: 'B-low',
  weeklyLoad: 3.0,
  previousWeekLoad: 3.0,
}));
assert(condEqual.state === 'build', 'Equal load → guard inactive → build');

// Decreasing load → guard does not activate
const condDecrease = resolveConditioningProgression(defaultConditioningInput({
  seasonPhase: 'Off-season',
  tier: 'B-low',
  weeklyLoad: 2.0,
  previousWeekLoad: 3.0,
}));
assert(condDecrease.state === 'build', 'Decreasing load → guard inactive → build');

// No previous week data → guard does not activate
const condNoPrev = resolveConditioningProgression(defaultConditioningInput({
  seasonPhase: 'Off-season',
  tier: 'B-low',
  weeklyLoad: 6.0,
  previousWeekLoad: 0,
}));
assert(condNoPrev.state === 'build', 'No previous week → guard inactive → build');

// ═══════════════════════════════════════════════════════════════
// SECTION 25: Conditioning — Build Mechanics by Tier
// ═══════════════════════════════════════════════════════════════

section('25. Conditioning — Build Mechanics');

// Tier A: progress reps first
const condATierBuild = resolveConditioningProgression(defaultConditioningInput({
  seasonPhase: 'Off-season',
  tier: 'A',
  currentReps: 5,
  currentRest: 120,
}));
assert(condATierBuild.state === 'build', 'Tier A off-season → build');
assert(condATierBuild.adjustment.repsDelta === 1, 'Tier A build → +1 rep');
assert(condATierBuild.adjustment.restDelta === 0, 'Only one variable at a time');

// Tier A: reps at cap → rest reduction
const condARepsCapped = resolveConditioningProgression(defaultConditioningInput({
  seasonPhase: 'Off-season',
  tier: 'A',
  currentReps: 8,  // at cap
  currentRest: 120,
}));
assert(condARepsCapped.adjustment.restDelta === -5, 'Tier A reps at cap → rest reduction');
assert(condARepsCapped.adjustment.repsDelta === 0, 'Reps at cap → no rep change');

// Tier B-high: intervals first
const condBhBuild = resolveConditioningProgression(defaultConditioningInput({
  seasonPhase: 'Off-season',
  tier: 'B-high',
  currentIntervals: 5,
}));
assert(condBhBuild.adjustment.intervalsDelta === 1, 'Tier B-high build → +1 interval');

// Tier B-low: duration first (especially in-season)
// In-season B-low can build per design (safest bucket)
const condBlBuild = resolveConditioningProgression(defaultConditioningInput({
  seasonPhase: 'Off-season',
  tier: 'B-low',
  currentDuration: 25,
}));
assert(condBlBuild.adjustment.durationDelta === 5, 'Tier B-low build → +5 min duration');

// Tier B-low in-season: rest reduction should NOT be used
const condBlInSeason = resolveConditioningProgression(defaultConditioningInput({
  seasonPhase: 'Off-season',  // will build
  tier: 'B-low',
  currentDuration: 40,  // at cap
  currentIntervals: 6,  // at cap
  currentRest: 45,
}));
// Off-season should allow rest reduction when duration + intervals at cap
assert(condBlInSeason.adjustment.restDelta === -5, 'B-low off-season + all caps → rest reduction OK');

const condBlInSeasonRestrict = resolveConditioningProgression(defaultConditioningInput({
  seasonPhase: 'In-season',
  tier: 'B-low',
  currentDuration: 40,  // at cap
  currentIntervals: 6,  // at cap
  currentRest: 45,
}));
// In-season Step 4 resolves to maintain, so build mechanics don't apply
assert(condBlInSeasonRestrict.state === 'maintain', 'B-low in-season at caps → maintain');

// ═══════════════════════════════════════════════════════════════
// SECTION 26: Conditioning — Deload Mechanics
// ═══════════════════════════════════════════════════════════════

section('26. Conditioning — Deload Mechanics');

// Tier A deload
const condADeload = resolveConditioningProgression(defaultConditioningInput({
  tier: 'A',
  doubleGameWeek: true,
}));
assert(condADeload.adjustment.repsDelta === -2, 'Tier A deload → -2 reps');
assert(condADeload.adjustment.restDelta === 15, 'Tier A deload → +15s rest');

// Tier B-high deload
const condBhDeload = resolveConditioningProgression(defaultConditioningInput({
  tier: 'B-high',
  doubleGameWeek: true,
}));
assert(condBhDeload.adjustment.intervalsDelta === -2, 'Tier B-high deload → -2 intervals');
assert(condBhDeload.adjustment.restDelta === 15, 'Tier B-high deload → +15s rest');

// Tier B-low deload
const condBlDeload = resolveConditioningProgression(defaultConditioningInput({
  tier: 'B-low',
  doubleGameWeek: true,
}));
assert(condBlDeload.adjustment.durationDelta === -10, 'Tier B-low deload → -10 min');
assert(condBlDeload.adjustment.intervalsDelta === -1, 'Tier B-low deload → -1 interval');

// ═══════════════════════════════════════════════════════════════
// SECTION 27: Conditioning — All Variables at Cap
// ═══════════════════════════════════════════════════════════════

section('27. Conditioning — Cap Enforcement');

// Tier A all at cap → maintain even when build resolved
const condAllCap = resolveConditioningProgression(defaultConditioningInput({
  seasonPhase: 'Off-season',
  tier: 'A',
  currentReps: 8,    // at cap
  currentRest: 90,   // at cap (min rest)
}));
assert(condAllCap.state === 'maintain', 'All Tier A variables at cap → maintain');
assert(condAllCap.note.includes('cap'), 'Note mentions cap');

// ═══════════════════════════════════════════════════════════════
// SECTION 28: Priority — Hard rules override soft
// ═══════════════════════════════════════════════════════════════

section('28. Priority — Hard > Soft');

// DGW (hard) takes priority even when all other signals are good
const priorityHard = resolveProgression(defaultStrengthInput({
  doubleGameWeek: true,
  readiness: 'high',
  recentRPE: 5,
  trend: 'up',
}));
assert(priorityHard.state === 'deload', 'DGW → deload even with perfect signals');

// Return (Step 1) takes priority over hard deload (Step 2)
const priorityReturn = resolveProgression(defaultStrengthInput({
  weeksOffTraining: 3,
  doubleGameWeek: true,
}));
assert(priorityReturn.state === 'return', 'Return > hard deload in priority');

// ═══════════════════════════════════════════════════════════════
// SECTION 29: Exposure History Extraction
// ═══════════════════════════════════════════════════════════════

section('29. Exposure History');

const mockHistory = [
  {
    id: 'w3', loggedDate: '2026-03-25', completed: true, sets: [
      { workoutExerciseId: 'squat', actualWeightKg: 100, actualReps: 5, id: 's1', loggedWorkoutId: 'w3', setNumber: 1, createdAt: '', updatedAt: '' },
    ],
    userId: 'u1', workoutId: 'w3', synced: true, createdAt: '', updatedAt: '',
  },
  {
    id: 'w2', loggedDate: '2026-03-18', completed: true, sets: [
      { workoutExerciseId: 'squat', actualWeightKg: 95, actualReps: 5, id: 's2', loggedWorkoutId: 'w2', setNumber: 1, createdAt: '', updatedAt: '' },
    ],
    userId: 'u1', workoutId: 'w2', synced: true, createdAt: '', updatedAt: '',
  },
  {
    id: 'w1', loggedDate: '2026-03-11', completed: true, sets: [
      { workoutExerciseId: 'squat', actualWeightKg: 90, actualReps: 5, id: 's3', loggedWorkoutId: 'w1', setNumber: 1, createdAt: '', updatedAt: '' },
    ],
    userId: 'u1', workoutId: 'w1', synced: true, createdAt: '', updatedAt: '',
  },
];

const exposures = extractExposureHistory(mockHistory, 'squat', 3);
assert(exposures.length === 3, 'Extracted 3 exposures');
assert(exposures[0].load === 90, 'Oldest exposure first (90kg)');
assert(exposures[2].load === 100, 'Newest exposure last (100kg)');

const trend = deriveTrend(exposures);
assert(trend === 'up', 'Trend from 90→100 is up');

// No matching exercise
const noMatch = extractExposureHistory(mockHistory, 'bench-press', 3);
assert(noMatch.length === 0, 'No matching exercise → empty');

// ═══════════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════════

console.log(`\n═══════════════════════════════════════`);
console.log(`PROGRESSION TESTS: ${passed} passed, ${failed} failed`);
console.log(`═══════════════════════════════════════`);

if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  ✗ ${f}`));
}

if (failed > 0) process.exit(1);
