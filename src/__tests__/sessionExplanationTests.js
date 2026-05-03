/**
 * Session Explanation Tests
 *
 * Verifies reason code collection, assembly logic, state labels,
 * and template output for all session types.
 */

const {
  collectReasonCodes,
  assembleExplanation,
  deriveStateLabel,
  explainSession,
  REASON_TEMPLATES,
} = require('/tmp/lfa-compiled/utils/sessionExplanation');

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

// ─── Helpers ───

function makeDay(overrides = {}) {
  return {
    date: '2026-04-06',
    dayOfWeek: 1,
    short: 'MON',
    isToday: false,
    workout: null,
    source: 'none',
    indicator: null,
    ...overrides,
  };
}

function makeWorkout(overrides = {}) {
  return {
    id: 'w1',
    microcycleId: 'micro-1',
    dayOfWeek: 1,
    name: 'Lower Body',
    description: 'Lower session',
    durationMinutes: 60,
    intensity: 'High',
    workoutType: 'Strength',
    sessionTier: 'core',
    exercises: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const DEFAULT_CTX = {
  seasonPhase: 'Off-season',
  readiness: 'medium',
  doubleGameWeek: false,
  injuryAvoidFlag: false,
};

// ═══════════════════════════════════════════════════════════════
// SECTION 1: Template completeness
// ═══════════════════════════════════════════════════════════════

section('1. Template Completeness');

const allCodes = [
  'GP_PLUS_1', 'GP_MINUS_1', 'GP_MINUS_2', 'GP_GAME_DAY', 'GP_FREED_SLOT',
  'SAFE_DGW', 'SAFE_DGW_REST', 'SAFE_INJURY', 'SAFE_LOW_READINESS',
  'SAFE_HIGH_RPE', 'SAFE_MISSED', 'SAFE_POST_OVERREACH', 'SAFE_RETURN',
  'PROG_BUILD', 'PROG_MAINTAIN', 'PROG_HOLD', 'PROG_DELOAD',
  'PROG_OVERREACH', 'PROG_MICRO_UP',
  'COND_PLACED', 'COND_BUILD', 'COND_HOLD', 'COND_DELOAD',
  'COND_BLOCKED_GAME', 'COND_BLOCKED_STACK', 'COND_BLOCKED_INSEASON', 'COND_LOAD_GUARD',
  'REC_PLACED', 'REC_PASSIVE', 'REC_ACTIVE', 'REC_EXTENDED',
  'REC_FULL_REST', 'NO_SESSION_OPTIMAL',
];

for (const code of allCodes) {
  assert(
    typeof REASON_TEMPLATES[code] === 'string' && REASON_TEMPLATES[code].length > 0,
    `Template exists for ${code}`
  );
}

// ═══════════════════════════════════════════════════════════════
// SECTION 2: Game Proximity Codes
// ═══════════════════════════════════════════════════════════════

section('2. Game Proximity');

// G+1
const gPlus1Day = makeDay({
  source: 'gameProximity',
  workout: makeWorkout({
    workoutType: 'Recovery',
    description: 'Post-game recovery',
  }),
});
const gPlus1Codes = collectReasonCodes(gPlus1Day, DEFAULT_CTX);
assert(gPlus1Codes.includes('GP_PLUS_1'), 'G+1 produces GP_PLUS_1');

// G-1
const gMinus1Day = makeDay({
  source: 'gameProximity',
  workout: makeWorkout({
    name: 'Arms + Pump',
    description: 'Pre-game day',
    workoutType: 'Strength',
    sessionTier: 'optional',
  }),
});
const gMinus1Codes = collectReasonCodes(gMinus1Day, DEFAULT_CTX);
assert(gMinus1Codes.includes('GP_MINUS_1'), 'G-1 produces GP_MINUS_1');

// G-2
const gMinus2Day = makeDay({
  source: 'gameProximity',
  workout: makeWorkout({
    description: 'Lower Body (48h to game — moderate load)',
    intensity: 'Moderate',
  }),
});
const gMinus2Codes = collectReasonCodes(gMinus2Day, DEFAULT_CTX);
assert(gMinus2Codes.includes('GP_MINUS_2'), 'G-2 produces GP_MINUS_2');

// Game day
const gameDay = makeDay({ source: 'game', workout: makeWorkout({ workoutType: 'Game' }) });
const gameCodes = collectReasonCodes(gameDay, DEFAULT_CTX);
assert(gameCodes.includes('GP_GAME_DAY'), 'Game day produces GP_GAME_DAY');
assert(gameCodes.length === 1, 'Game day only produces 1 code');

// ═══════════════════════════════════════════════════════════════
// SECTION 3: Tier 1 Exclusivity
// ═══════════════════════════════════════════════════════════════

section('3. Tier 1 Exclusivity');

// G+1 with DGW context — should only show G+1 template
const dgwGPlus1 = assembleExplanation(['GP_PLUS_1', 'SAFE_DGW']);
assert(
  dgwGPlus1 === REASON_TEMPLATES['GP_PLUS_1'],
  'Tier 1 exclusivity: only GP_PLUS_1 shown with DGW'
);
assert(
  !dgwGPlus1.includes('Two games'),
  'DGW message not appended when tier 1 present'
);

// ═══════════════════════════════════════════════════════════════
// SECTION 4: Safety Codes
// ═══════════════════════════════════════════════════════════════

section('4. Safety Codes');

// DGW
const dgwDay = makeDay({
  source: 'template',
  workout: makeWorkout(),
});
const dgwCodes = collectReasonCodes(dgwDay, { ...DEFAULT_CTX, doubleGameWeek: true });
assert(dgwCodes.includes('SAFE_DGW'), 'DGW context produces SAFE_DGW');

// DGW + rest = SAFE_DGW_REST
const dgwRestDay = makeDay({ source: 'rest' });
const dgwRestCodes = collectReasonCodes(dgwRestDay, { ...DEFAULT_CTX, doubleGameWeek: true });
assert(dgwRestCodes.includes('SAFE_DGW_REST'), 'DGW rest day produces SAFE_DGW_REST');

// Injury
const injuryDay = makeDay({ source: 'template', workout: makeWorkout() });
const injuryCodes = collectReasonCodes(injuryDay, { ...DEFAULT_CTX, injuryAvoidFlag: true });
assert(injuryCodes.includes('SAFE_INJURY'), 'Injury flag produces SAFE_INJURY');

// ═══════════════════════════════════════════════════════════════
// SECTION 5: Progression Codes
// ═══════════════════════════════════════════════════════════════

section('5. Progression Codes');

// Build
const buildWorkout = makeWorkout({
  _progressionResults: {
    'Back Squat': { state: 'build', loadDelta: 'up', setsDelta: 'none', rpeDelta: 'none', note: '' },
  },
});
const buildDay = makeDay({ source: 'template', workout: buildWorkout });
const buildCodes = collectReasonCodes(buildDay, DEFAULT_CTX);
assert(buildCodes.includes('PROG_BUILD'), 'Build state produces PROG_BUILD');

// Micro up
const microUpWorkout = makeWorkout({
  _progressionResults: {
    'Back Squat': { state: 'build', loadDelta: 'micro_up', setsDelta: 'none', rpeDelta: 'none', note: '' },
  },
});
const microUpDay = makeDay({ source: 'template', workout: microUpWorkout });
const microUpCodes = collectReasonCodes(microUpDay, DEFAULT_CTX);
assert(microUpCodes.includes('PROG_MICRO_UP'), 'Micro up produces PROG_MICRO_UP');

// Deload
const deloadWorkout = makeWorkout({
  _progressionResults: {
    'Back Squat': { state: 'deload', loadDelta: 'big_down', setsDelta: 'drop_two', rpeDelta: 'pull', note: 'Scheduled deload' },
  },
});
const deloadDay = makeDay({ source: 'template', workout: deloadWorkout });
const deloadCodes = collectReasonCodes(deloadDay, DEFAULT_CTX);
assert(deloadCodes.includes('PROG_DELOAD'), 'Deload state produces PROG_DELOAD');

// Hold
const holdWorkout = makeWorkout({
  _progressionResults: {
    'Back Squat': { state: 'hold', loadDelta: 'none', setsDelta: 'none', rpeDelta: 'none', note: '' },
  },
});
const holdDay = makeDay({ source: 'template', workout: holdWorkout });
const holdCodes = collectReasonCodes(holdDay, DEFAULT_CTX);
assert(holdCodes.includes('PROG_HOLD'), 'Hold state produces PROG_HOLD');

// Maintain
const maintainWorkout = makeWorkout({
  _progressionResults: {
    'Back Squat': { state: 'maintain', loadDelta: 'none', setsDelta: 'none', rpeDelta: 'none', note: '' },
  },
});
const maintainDay = makeDay({ source: 'template', workout: maintainWorkout });
const maintainCodes = collectReasonCodes(maintainDay, DEFAULT_CTX);
assert(maintainCodes.includes('PROG_MAINTAIN'), 'Maintain state produces PROG_MAINTAIN');

// Overreach
const overreachWorkout = makeWorkout({
  _progressionResults: {
    'Back Squat': { state: 'overreach', loadDelta: 'up', setsDelta: 'add_one', rpeDelta: 'push', note: '' },
  },
});
const overreachDay = makeDay({ source: 'template', workout: overreachWorkout });
const overreachCodes = collectReasonCodes(overreachDay, DEFAULT_CTX);
assert(overreachCodes.includes('PROG_OVERREACH'), 'Overreach produces PROG_OVERREACH');

// Return
const returnWorkout = makeWorkout({
  _progressionResults: {
    'Back Squat': { state: 'return', loadDelta: 'down', setsDelta: 'drop_one', rpeDelta: 'none', note: '' },
  },
});
const returnDay = makeDay({ source: 'template', workout: returnWorkout });
const returnCodes = collectReasonCodes(returnDay, DEFAULT_CTX);
assert(returnCodes.includes('SAFE_RETURN'), 'Return state produces SAFE_RETURN');

// ═══════════════════════════════════════════════════════════════
// SECTION 6: Conditioning Codes
// ═══════════════════════════════════════════════════════════════

section('6. Conditioning Codes');

const condBuildDay = makeDay({
  source: 'conditioning',
  workout: makeWorkout({
    workoutType: 'Conditioning',
    _progressionState: 'build',
  }),
});
const condBuildCodes = collectReasonCodes(condBuildDay, DEFAULT_CTX);
assert(condBuildCodes.includes('COND_PLACED'), 'Conditioning source produces COND_PLACED');
assert(condBuildCodes.includes('COND_BUILD'), 'Conditioning build produces COND_BUILD');

const condDeloadDay = makeDay({
  source: 'conditioning',
  workout: makeWorkout({
    workoutType: 'Conditioning',
    _progressionState: 'deload',
  }),
});
const condDeloadCodes = collectReasonCodes(condDeloadDay, DEFAULT_CTX);
assert(condDeloadCodes.includes('COND_DELOAD'), 'Conditioning deload produces COND_DELOAD');

// ═══════════════════════════════════════════════════════════════
// SECTION 7: Recovery Codes
// ═══════════════════════════════════════════════════════════════

section('7. Recovery Codes');

const recActiveDay = makeDay({
  source: 'recovery',
  workout: makeWorkout({
    workoutType: 'Recovery',
    description: 'Scheduled recovery — active',
  }),
});
const recActiveCodes = collectReasonCodes(recActiveDay, DEFAULT_CTX);
assert(recActiveCodes.includes('REC_PLACED'), 'Recovery placement produces REC_PLACED');
assert(recActiveCodes.includes('REC_ACTIVE'), 'Active recovery produces REC_ACTIVE');

const recPassiveDay = makeDay({
  source: 'recovery',
  workout: makeWorkout({
    workoutType: 'Recovery',
    description: 'Scheduled recovery — passive',
  }),
});
const recPassiveCodes = collectReasonCodes(recPassiveDay, DEFAULT_CTX);
assert(recPassiveCodes.includes('REC_PASSIVE'), 'Passive recovery produces REC_PASSIVE');

// ═══════════════════════════════════════════════════════════════
// SECTION 8: Rest / No Session
// ═══════════════════════════════════════════════════════════════

section('8. Rest / No Session');

const restDay = makeDay({ source: 'rest' });
const restCodes = collectReasonCodes(restDay, DEFAULT_CTX);
assert(restCodes.includes('REC_FULL_REST'), 'Rest day produces REC_FULL_REST');

const noSessionDay = makeDay({ source: 'none' });
const noSessionCodes = collectReasonCodes(noSessionDay, DEFAULT_CTX);
assert(noSessionCodes.includes('NO_SESSION_OPTIMAL'), 'Empty day produces NO_SESSION_OPTIMAL');

// ═══════════════════════════════════════════════════════════════
// SECTION 9: Assembly — Dedup + Top 2
// ═══════════════════════════════════════════════════════════════

section('9. Assembly Logic');

// Two same-tier codes → deduplicate
const condDedupResult = assembleExplanation(['COND_PLACED', 'COND_BUILD']);
assert(
  condDedupResult === REASON_TEMPLATES['COND_BUILD'],
  'Dedup: COND_BUILD wins over COND_PLACED'
);

// Two different tiers → show both
const twoTierResult = assembleExplanation(['SAFE_LOW_READINESS', 'PROG_DELOAD']);
assert(
  twoTierResult.includes('Pulling back') && twoTierResult.includes('recover and reload'),
  'Two different tiers: both templates shown'
);

// Empty → empty string
assert(assembleExplanation([]) === '', 'Empty reasons → empty string');

// Single reason
const singleResult = assembleExplanation(['PROG_BUILD']);
assert(singleResult === REASON_TEMPLATES['PROG_BUILD'], 'Single reason → single template');

// ═══════════════════════════════════════════════════════════════
// SECTION 10: State Labels
// ═══════════════════════════════════════════════════════════════

section('10. State Labels');

assert(deriveStateLabel(buildDay) === 'Build', 'Build workout → Build label');
assert(deriveStateLabel(deloadDay) === 'Deload', 'Deload workout → Deload label');
assert(deriveStateLabel(holdDay) === 'Hold', 'Hold workout → Hold label');
assert(deriveStateLabel(maintainDay) === 'Maintain', 'Maintain workout → Maintain label');
assert(deriveStateLabel(overreachDay) === 'Overreach', 'Overreach workout → Overreach label');
assert(deriveStateLabel(returnDay) === 'Return', 'Return workout → Return label');
assert(deriveStateLabel(restDay) === null, 'Rest day → null label');
assert(deriveStateLabel(gameDay) === null, 'Game day → null label');

// Conditioning state
assert(deriveStateLabel(condBuildDay) === 'Build', 'Conditioning build → Build label');
assert(deriveStateLabel(condDeloadDay) === 'Deload', 'Conditioning deload → Deload label');

// ═══════════════════════════════════════════════════════════════
// SECTION 11: Full explainSession
// ═══════════════════════════════════════════════════════════════

section('11. Full explainSession');

const fullBuild = explainSession(buildDay, DEFAULT_CTX);
assert(fullBuild.stateLabel === 'Build', 'explainSession: build label');
assert(fullBuild.explanation.length > 0, 'explainSession: has explanation');
assert(fullBuild.primaryReason === 'PROG_BUILD', 'explainSession: primary reason is PROG_BUILD');

const fullRest = explainSession(restDay, DEFAULT_CTX);
assert(fullRest.stateLabel === null, 'explainSession: rest has no state label');
assert(fullRest.explanation.includes('rest'), 'explainSession: rest explanation mentions rest');

const fullGame = explainSession(gameDay, DEFAULT_CTX);
assert(fullGame.explanation === 'Game day.', 'explainSession: game day text');

// ═══════════════════════════════════════════════════════════════
// SECTION 12: Manual Override — No Explanation
// ═══════════════════════════════════════════════════════════════

section('12. Manual Override');

const manualDay = makeDay({ source: 'manual', workout: makeWorkout() });
const manualCodes = collectReasonCodes(manualDay, DEFAULT_CTX);
assert(manualCodes.length === 0, 'Manual override produces no reason codes');

const manualExplanation = explainSession(manualDay, DEFAULT_CTX);
assert(manualExplanation.explanation === '', 'Manual override has empty explanation');
assert(manualExplanation.stateLabel === null, 'Manual override has no state label');

// ═══════════════════════════════════════════════════════════════
// SECTION 13: Post-overreach → Safety code, not progression
// ═══════════════════════════════════════════════════════════════

section('13. Post-overreach safety');

const postOverreachWorkout = makeWorkout({
  _progressionResults: {
    'Back Squat': { state: 'deload', loadDelta: 'big_down', setsDelta: 'drop_two', rpeDelta: 'pull',
      note: 'Post-overreach mandatory deload' },
  },
});
const postOverreachDay = makeDay({ source: 'template', workout: postOverreachWorkout });
const postOverreachCodes = collectReasonCodes(postOverreachDay, DEFAULT_CTX);
assert(postOverreachCodes.includes('SAFE_POST_OVERREACH'), 'Post-overreach produces SAFE_POST_OVERREACH');
assert(!postOverreachCodes.includes('PROG_DELOAD'), 'Post-overreach does NOT produce PROG_DELOAD (safety takes precedence)');

// ═══════════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════════

console.log(`\n${'═'.repeat(55)}`);
console.log(`SESSION EXPLANATION TESTS: ${passed} passed, ${failed} failed`);
console.log('═'.repeat(55));

if (failures.length > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
