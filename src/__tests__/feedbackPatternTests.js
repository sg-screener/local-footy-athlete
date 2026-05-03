/**
 * Feedback Pattern Tests
 *
 * Tests the deterministic feedback pattern recognition layer:
 *   - Flag detection (thresholds, boundary conditions)
 *   - Derived trends (fatigue, completion, confidence)
 *   - Bias application (single-step constraint)
 *   - Hard boundary preservation
 *   - Integration with buildProgressionContext
 */

const {
  analyzeFeedbackPatterns,
  applyPatternBiases,
  biasConditioningReadiness,
  shouldPreferRest,
  detectFlags,
  deriveFatigueTrend,
  deriveCompletionTrend,
  deriveProgressionConfidence,
  FEELING_SCORE,
  READINESS_DOWN,
  FEELING_UP_ONE,
  MIN_SAMPLE,
  WINDOW_SIZE,
} = require('/tmp/lfa-compiled/utils/feedbackPatterns');

const {
  buildProgressionContext,
  DEFAULT_PROGRESSION_CONTEXT,
} = require('/tmp/lfa-compiled/utils/strengthProgressionIntegration');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${label}`);
  }
}

function fb(feeling, completion, dateStr = '2025-06-01') {
  return { dateStr, feeling, completion };
}

// ─────────────────────────────────────────
console.log('\n── 1. Insufficient data ──');

assert(analyzeFeedbackPatterns([]) === null, 'Empty array → null');
assert(analyzeFeedbackPatterns([fb('good', 'full')]) === null, '1 entry → null');
assert(analyzeFeedbackPatterns([fb('good', 'full'), fb('good', 'full')]) === null, '2 entries → null');
assert(analyzeFeedbackPatterns([fb('good', 'full'), fb('good', 'full'), fb('good', 'full')]) !== null, '3 entries → not null');
assert(MIN_SAMPLE === 3, 'MIN_SAMPLE is 3');
assert(WINDOW_SIZE === 4, 'WINDOW_SIZE is 4');

// ─────────────────────────────────────────
console.log('\n── 2. FATIGUE_STREAK detection ──');

{
  // 3/4 hard → flag
  const entries = [fb('hard', 'full', '2025-06-04'), fb('very_hard', 'full', '2025-06-03'), fb('hard', 'full', '2025-06-02'), fb('good', 'full', '2025-06-01')];
  const result = analyzeFeedbackPatterns(entries);
  assert(result.activeFlags.includes('FATIGUE_STREAK'), '3/4 hard/very_hard → FATIGUE_STREAK');
}

{
  // 2/4 hard → no flag
  const entries = [fb('hard', 'full', '2025-06-04'), fb('good', 'full', '2025-06-03'), fb('hard', 'full', '2025-06-02'), fb('good', 'full', '2025-06-01')];
  const result = analyzeFeedbackPatterns(entries);
  assert(!result.activeFlags.includes('FATIGUE_STREAK'), '2/4 hard → no FATIGUE_STREAK');
}

{
  // 4/4 hard → flag
  const entries = [fb('hard', 'full', '2025-06-04'), fb('very_hard', 'full', '2025-06-03'), fb('hard', 'full', '2025-06-02'), fb('very_hard', 'full', '2025-06-01')];
  const result = analyzeFeedbackPatterns(entries);
  assert(result.activeFlags.includes('FATIGUE_STREAK'), '4/4 hard → FATIGUE_STREAK');
}

// ─────────────────────────────────────────
console.log('\n── 3. EASE_STREAK detection ──');

{
  const entries = [fb('very_easy', 'full', '2025-06-04'), fb('easy', 'full', '2025-06-03'), fb('very_easy', 'full', '2025-06-02'), fb('good', 'full', '2025-06-01')];
  const result = analyzeFeedbackPatterns(entries);
  assert(result.activeFlags.includes('EASE_STREAK'), '3/4 easy/very_easy → EASE_STREAK');
}

{
  const entries = [fb('easy', 'full', '2025-06-04'), fb('good', 'full', '2025-06-03'), fb('easy', 'full', '2025-06-02'), fb('good', 'full', '2025-06-01')];
  const result = analyzeFeedbackPatterns(entries);
  assert(!result.activeFlags.includes('EASE_STREAK'), '2/4 easy → no EASE_STREAK');
}

// ─────────────────────────────────────────
console.log('\n── 4. COMPLETION_DROP detection ──');

{
  const entries = [fb('good', 'partial', '2025-06-04'), fb('good', 'skipped', '2025-06-03'), fb('good', 'full', '2025-06-02'), fb('good', 'full', '2025-06-01')];
  const result = analyzeFeedbackPatterns(entries);
  assert(result.activeFlags.includes('COMPLETION_DROP'), '2/4 partial/skipped → COMPLETION_DROP');
}

{
  const entries = [fb('good', 'partial', '2025-06-04'), fb('good', 'full', '2025-06-03'), fb('good', 'full', '2025-06-02'), fb('good', 'full', '2025-06-01')];
  const result = analyzeFeedbackPatterns(entries);
  assert(!result.activeFlags.includes('COMPLETION_DROP'), '1/4 partial → no COMPLETION_DROP');
}

// ─────────────────────────────────────────
console.log('\n── 5. COOKED_REPEAT detection ──');

{
  // 2/3 very_hard → flag
  const entries = [fb('very_hard', 'full', '2025-06-03'), fb('very_hard', 'full', '2025-06-02'), fb('good', 'full', '2025-06-01')];
  const result = analyzeFeedbackPatterns(entries);
  assert(result.activeFlags.includes('COOKED_REPEAT'), '2/3 very_hard → COOKED_REPEAT');
}

{
  // 1/3 very_hard → no flag
  const entries = [fb('very_hard', 'full', '2025-06-03'), fb('hard', 'full', '2025-06-02'), fb('good', 'full', '2025-06-01')];
  const result = analyzeFeedbackPatterns(entries);
  assert(!result.activeFlags.includes('COOKED_REPEAT'), '1/3 very_hard → no COOKED_REPEAT');
}

// ─────────────────────────────────────────
console.log('\n── 6. FULL_COMPLETION_RUN detection ──');

{
  const entries = [fb('good', 'full', '2025-06-04'), fb('good', 'full', '2025-06-03'), fb('good', 'full', '2025-06-02'), fb('good', 'full', '2025-06-01')];
  const result = analyzeFeedbackPatterns(entries);
  assert(result.activeFlags.includes('FULL_COMPLETION_RUN'), '4/4 full → FULL_COMPLETION_RUN');
}

{
  // 3 entries all full — not enough for FULL_COMPLETION_RUN (needs 4)
  const entries = [fb('good', 'full', '2025-06-03'), fb('good', 'full', '2025-06-02'), fb('good', 'full', '2025-06-01')];
  const result = analyzeFeedbackPatterns(entries);
  assert(!result.activeFlags.includes('FULL_COMPLETION_RUN'), '3/3 full → no FULL_COMPLETION_RUN (needs 4)');
}

{
  const entries = [fb('good', 'partial', '2025-06-04'), fb('good', 'full', '2025-06-03'), fb('good', 'full', '2025-06-02'), fb('good', 'full', '2025-06-01')];
  const result = analyzeFeedbackPatterns(entries);
  assert(!result.activeFlags.includes('FULL_COMPLETION_RUN'), '3/4 full + 1 partial → no FULL_COMPLETION_RUN');
}

// ─────────────────────────────────────────
console.log('\n── 7. MIXED_SIGNALS detection ──');

{
  // 2/4 hard feeling + full completion
  const entries = [fb('hard', 'full', '2025-06-04'), fb('very_hard', 'full', '2025-06-03'), fb('good', 'full', '2025-06-02'), fb('good', 'full', '2025-06-01')];
  const result = analyzeFeedbackPatterns(entries);
  assert(result.activeFlags.includes('MIXED_SIGNALS'), '2/4 hard+full → MIXED_SIGNALS');
}

{
  // Hard but partial → not mixed
  const entries = [fb('hard', 'partial', '2025-06-04'), fb('hard', 'partial', '2025-06-03'), fb('good', 'full', '2025-06-02'), fb('good', 'full', '2025-06-01')];
  const result = analyzeFeedbackPatterns(entries);
  assert(!result.activeFlags.includes('MIXED_SIGNALS'), 'hard+partial → no MIXED_SIGNALS');
}

// ─────────────────────────────────────────
console.log('\n── 8. fatigueTrend derivation ──');

{
  const entries = [fb('very_hard', 'full', '4'), fb('hard', 'full', '3'), fb('hard', 'full', '2'), fb('very_hard', 'full', '1')];
  const result = analyzeFeedbackPatterns(entries);
  assert(result.fatigueTrend === 'rising', 'Avg >= 4.0 → rising');
}

{
  const entries = [fb('very_easy', 'full', '4'), fb('easy', 'full', '3'), fb('very_easy', 'full', '2'), fb('easy', 'full', '1')];
  const result = analyzeFeedbackPatterns(entries);
  assert(result.fatigueTrend === 'falling', 'Avg <= 2.0 → falling');
}

{
  const entries = [fb('good', 'full', '4'), fb('good', 'full', '3'), fb('hard', 'full', '2'), fb('easy', 'full', '1')];
  const result = analyzeFeedbackPatterns(entries);
  assert(result.fatigueTrend === 'stable', 'Mixed avg → stable');
}

// ─────────────────────────────────────────
console.log('\n── 9. completionTrend derivation ──');

{
  const entries = [fb('good', 'full', '4'), fb('good', 'full', '3'), fb('good', 'full', '2'), fb('good', 'full', '1')];
  const result = analyzeFeedbackPatterns(entries);
  assert(result.completionTrend === 'consistent', 'All full → consistent');
}

{
  const entries = [fb('good', 'partial', '4'), fb('good', 'skipped', '3'), fb('good', 'partial', '2'), fb('good', 'full', '1')];
  const result = analyzeFeedbackPatterns(entries);
  assert(result.completionTrend === 'declining', '1/4 full → declining');
}

{
  const entries = [fb('good', 'full', '4'), fb('good', 'partial', '3'), fb('good', 'full', '2'), fb('good', 'full', '1')];
  const result = analyzeFeedbackPatterns(entries);
  assert(result.completionTrend === 'sporadic', '3/4 full → sporadic');
}

// ─────────────────────────────────────────
console.log('\n── 10. progressionConfidence derivation ──');

{
  // EASE_STREAK + FULL_COMPLETION_RUN → under_challenged
  const entries = [fb('easy', 'full', '4'), fb('very_easy', 'full', '3'), fb('easy', 'full', '2'), fb('very_easy', 'full', '1')];
  const result = analyzeFeedbackPatterns(entries);
  assert(result.progressionConfidence === 'under_challenged', 'Ease+full → under_challenged');
}

{
  // COOKED_REPEAT → over_reached
  const entries = [fb('very_hard', 'full', '3'), fb('very_hard', 'full', '2'), fb('good', 'full', '1')];
  const result = analyzeFeedbackPatterns(entries);
  assert(result.progressionConfidence === 'over_reached', 'Cooked repeat → over_reached');
}

{
  // FATIGUE_STREAK + COMPLETION_DROP → over_reached
  const entries = [fb('hard', 'partial', '4'), fb('very_hard', 'partial', '3'), fb('hard', 'full', '2'), fb('good', 'full', '1')];
  const result = analyzeFeedbackPatterns(entries);
  assert(result.progressionConfidence === 'over_reached', 'Fatigue+drop → over_reached');
}

{
  // Normal → well_matched
  const entries = [fb('good', 'full', '4'), fb('good', 'full', '3'), fb('hard', 'full', '2'), fb('good', 'full', '1')];
  const result = analyzeFeedbackPatterns(entries);
  assert(result.progressionConfidence === 'well_matched', 'Normal → well_matched');
}

// ─────────────────────────────────────────
console.log('\n── 11. applyPatternBiases — readiness downgrade ──');

{
  // FATIGUE_STREAK → readiness high→medium
  const ctx = { ...DEFAULT_PROGRESSION_CONTEXT, readiness: 'high' };
  const summary = { sampleSize: 4, fatigueTrend: 'rising', completionTrend: 'consistent', progressionConfidence: 'over_reached', activeFlags: ['FATIGUE_STREAK'] };
  const biased = applyPatternBiases(ctx, summary);
  assert(biased.readiness === 'medium', 'FATIGUE_STREAK: high → medium');
}

{
  // FATIGUE_STREAK → readiness medium→low
  const ctx = { ...DEFAULT_PROGRESSION_CONTEXT, readiness: 'medium' };
  const summary = { sampleSize: 4, fatigueTrend: 'rising', completionTrend: 'consistent', progressionConfidence: 'over_reached', activeFlags: ['FATIGUE_STREAK'] };
  const biased = applyPatternBiases(ctx, summary);
  assert(biased.readiness === 'low', 'FATIGUE_STREAK: medium → low');
}

{
  // FATIGUE_STREAK → readiness low stays low (floor)
  const ctx = { ...DEFAULT_PROGRESSION_CONTEXT, readiness: 'low' };
  const summary = { sampleSize: 4, fatigueTrend: 'rising', completionTrend: 'consistent', progressionConfidence: 'over_reached', activeFlags: ['FATIGUE_STREAK'] };
  const biased = applyPatternBiases(ctx, summary);
  assert(biased.readiness === 'low', 'FATIGUE_STREAK: low stays low (floor)');
}

// ─────────────────────────────────────────
console.log('\n── 12. applyPatternBiases — sessionFeeling one-step ──');

{
  // COOKED_REPEAT (without FATIGUE_STREAK) → feeling up one step
  const ctx = { ...DEFAULT_PROGRESSION_CONTEXT, sessionFeeling: 'Good' };
  const summary = { sampleSize: 3, fatigueTrend: 'rising', completionTrend: 'consistent', progressionConfidence: 'over_reached', activeFlags: ['COOKED_REPEAT'] };
  const biased = applyPatternBiases(ctx, summary);
  assert(biased.sessionFeeling === 'Sore', 'COOKED_REPEAT: Good → Sore (one step)');
  assert(biased.sessionFeeling !== 'Cooked', 'COOKED_REPEAT: Good → NOT Cooked (one step only)');
}

{
  // COOKED_REPEAT: Sore → Cooked (one step)
  const ctx = { ...DEFAULT_PROGRESSION_CONTEXT, sessionFeeling: 'Sore' };
  const summary = { sampleSize: 3, fatigueTrend: 'rising', completionTrend: 'consistent', progressionConfidence: 'over_reached', activeFlags: ['COOKED_REPEAT'] };
  const biased = applyPatternBiases(ctx, summary);
  assert(biased.sessionFeeling === 'Cooked', 'COOKED_REPEAT: Sore → Cooked');
}

{
  // COOKED_REPEAT + FATIGUE_STREAK → only readiness moves, NOT feeling
  const ctx = { ...DEFAULT_PROGRESSION_CONTEXT, readiness: 'high', sessionFeeling: 'Good' };
  const summary = { sampleSize: 4, fatigueTrend: 'rising', completionTrend: 'consistent', progressionConfidence: 'over_reached', activeFlags: ['FATIGUE_STREAK', 'COOKED_REPEAT'] };
  const biased = applyPatternBiases(ctx, summary);
  assert(biased.readiness === 'medium', 'FATIGUE+COOKED: readiness moves');
  assert(biased.sessionFeeling === 'Good', 'FATIGUE+COOKED: feeling stays (no double-stack)');
}

// ─────────────────────────────────────────
console.log('\n── 13. applyPatternBiases — consecutiveBuildWeeks boost ──');

{
  const ctx = { ...DEFAULT_PROGRESSION_CONTEXT, consecutiveBuildWeeks: 2 };
  const summary = { sampleSize: 4, fatigueTrend: 'falling', completionTrend: 'consistent', progressionConfidence: 'under_challenged', activeFlags: ['EASE_STREAK', 'FULL_COMPLETION_RUN'] };
  const biased = applyPatternBiases(ctx, summary);
  assert(biased.consecutiveBuildWeeks === 3, 'EASE+FULL_RUN: +1 build week');
}

{
  // EASE_STREAK alone (no FULL_COMPLETION_RUN) → no boost
  const ctx = { ...DEFAULT_PROGRESSION_CONTEXT, consecutiveBuildWeeks: 2 };
  const summary = { sampleSize: 4, fatigueTrend: 'falling', completionTrend: 'sporadic', progressionConfidence: 'well_matched', activeFlags: ['EASE_STREAK'] };
  const biased = applyPatternBiases(ctx, summary);
  assert(biased.consecutiveBuildWeeks === 2, 'EASE_STREAK alone → no boost');
}

// ─────────────────────────────────────────
console.log('\n── 14. applyPatternBiases — COMPLETION_DROP adds missedSessions ──');

{
  const ctx = { ...DEFAULT_PROGRESSION_CONTEXT, missedSessionsThisWeek: 0 };
  const summary = { sampleSize: 4, fatigueTrend: 'stable', completionTrend: 'declining', progressionConfidence: 'over_reached', activeFlags: ['COMPLETION_DROP'] };
  const biased = applyPatternBiases(ctx, summary);
  assert(biased.missedSessionsThisWeek === 1, 'COMPLETION_DROP: +1 missed');
}

// ─────────────────────────────────────────
console.log('\n── 15. applyPatternBiases — MIXED_SIGNALS readiness down ──');

{
  const ctx = { ...DEFAULT_PROGRESSION_CONTEXT, readiness: 'high' };
  const summary = { sampleSize: 4, fatigueTrend: 'stable', completionTrend: 'consistent', progressionConfidence: 'well_matched', activeFlags: ['MIXED_SIGNALS'] };
  const biased = applyPatternBiases(ctx, summary);
  assert(biased.readiness === 'medium', 'MIXED_SIGNALS: high → medium');
}

{
  // MIXED_SIGNALS + FATIGUE_STREAK → only one readiness downgrade (FATIGUE wins, MIXED doesn't double-down)
  const ctx = { ...DEFAULT_PROGRESSION_CONTEXT, readiness: 'high' };
  const summary = { sampleSize: 4, fatigueTrend: 'rising', completionTrend: 'consistent', progressionConfidence: 'over_reached', activeFlags: ['FATIGUE_STREAK', 'MIXED_SIGNALS'] };
  const biased = applyPatternBiases(ctx, summary);
  assert(biased.readiness === 'medium', 'FATIGUE+MIXED: only one step down (not low)');
}

// ─────────────────────────────────────────
console.log('\n── 16. Null summary passthrough ──');

{
  const ctx = { ...DEFAULT_PROGRESSION_CONTEXT, readiness: 'high', sessionFeeling: 'Good' };
  const biased = applyPatternBiases(ctx, null);
  assert(biased.readiness === 'high', 'Null summary: readiness unchanged');
  assert(biased.sessionFeeling === 'Good', 'Null summary: feeling unchanged');
  assert(biased.consecutiveBuildWeeks === ctx.consecutiveBuildWeeks, 'Null summary: buildWeeks unchanged');
}

// ─────────────────────────────────────────
console.log('\n── 17. biasConditioningReadiness ──');

{
  assert(biasConditioningReadiness('high', null) === 'high', 'Null summary → no change');
  const fatigued = { sampleSize: 4, fatigueTrend: 'rising', completionTrend: 'consistent', progressionConfidence: 'over_reached', activeFlags: ['FATIGUE_STREAK'] };
  assert(biasConditioningReadiness('high', fatigued) === 'medium', 'FATIGUE: high → medium');
  assert(biasConditioningReadiness('medium', fatigued) === 'low', 'FATIGUE: medium → low');
  assert(biasConditioningReadiness('low', fatigued) === 'low', 'FATIGUE: low stays low');
  const cooked = { sampleSize: 3, fatigueTrend: 'rising', completionTrend: 'consistent', progressionConfidence: 'over_reached', activeFlags: ['COOKED_REPEAT'] };
  assert(biasConditioningReadiness('high', cooked) === 'medium', 'COOKED: high → medium');
  const mixed = { sampleSize: 4, fatigueTrend: 'stable', completionTrend: 'consistent', progressionConfidence: 'well_matched', activeFlags: ['MIXED_SIGNALS'] };
  assert(biasConditioningReadiness('high', mixed) === 'medium', 'MIXED: high → medium');
  const easy = { sampleSize: 4, fatigueTrend: 'falling', completionTrend: 'consistent', progressionConfidence: 'under_challenged', activeFlags: ['EASE_STREAK'] };
  assert(biasConditioningReadiness('medium', easy) === 'medium', 'EASE: no change');
}

// ─────────────────────────────────────────
console.log('\n── 18. shouldPreferRest ──');

{
  assert(shouldPreferRest(null, 1) === false, 'Null summary → no rest preference');
  const cooked = { sampleSize: 3, fatigueTrend: 'rising', completionTrend: 'consistent', progressionConfidence: 'over_reached', activeFlags: ['COOKED_REPEAT'] };
  assert(shouldPreferRest(cooked, 0) === false, 'COOKED + 0 recovery → false (need at least 1)');
  assert(shouldPreferRest(cooked, 1) === true, 'COOKED + 1 recovery → true');
  assert(shouldPreferRest(cooked, 2) === true, 'COOKED + 2 recovery → true');
  const fatigue = { sampleSize: 4, fatigueTrend: 'rising', completionTrend: 'consistent', progressionConfidence: 'over_reached', activeFlags: ['FATIGUE_STREAK'] };
  assert(shouldPreferRest(fatigue, 1) === false, 'FATIGUE (no COOKED) + 1 recovery → false');
}

// ─────────────────────────────────────────
console.log('\n── 19. Hard boundaries preserved ──');

{
  // Pattern biases should not affect fields used by hard rules
  // Game proximity (daysToGame, daysSinceGame) — untouched
  const ctx = { ...DEFAULT_PROGRESSION_CONTEXT, daysToGame: 1, daysSinceGame: null, injuryAvoidFlag: true, weeksOffTraining: 3 };
  const summary = { sampleSize: 4, fatigueTrend: 'rising', completionTrend: 'declining', progressionConfidence: 'over_reached', activeFlags: ['FATIGUE_STREAK', 'COOKED_REPEAT', 'COMPLETION_DROP'] };
  const biased = applyPatternBiases(ctx, summary);
  assert(biased.daysToGame === 1, 'daysToGame untouched by biases');
  assert(biased.daysSinceGame === null, 'daysSinceGame untouched by biases');
  assert(biased.injuryAvoidFlag === true, 'injuryAvoidFlag untouched by biases');
  assert(biased.weeksOffTraining === 3, 'weeksOffTraining untouched by biases');
  assert(biased.doubleGameWeek === false, 'doubleGameWeek untouched by biases');
  assert(biased.recentDeloadTrigger === null, 'recentDeloadTrigger untouched by biases');
}

// ─────────────────────────────────────────
console.log('\n── 20. Integration with buildProgressionContext ──');

{
  // buildProgressionContext with 4 hard feedback entries → biases applied
  const feedback = [
    { dateStr: '2025-06-04', feeling: 'hard', completion: 'full' },
    { dateStr: '2025-06-03', feeling: 'very_hard', completion: 'full' },
    { dateStr: '2025-06-02', feeling: 'hard', completion: 'full' },
    { dateStr: '2025-06-01', feeling: 'hard', completion: 'full' },
  ];
  const ctx = buildProgressionContext(
    'In-season', 'high', ['2025-06-10'], '2025-06-05',
    [], {}, [], 'hard', feedback,
  );
  // FATIGUE_STREAK active (3/4 hard/very_hard) → readiness high→medium
  assert(ctx.readiness === 'medium', 'Integration: FATIGUE_STREAK biases readiness high→medium');
  // MIXED_SIGNALS also active (hard+full x3), but FATIGUE_STREAK already downgraded
  assert(ctx.readiness !== 'low', 'Integration: readiness not double-downgraded to low');
}

{
  // buildProgressionContext with insufficient feedback → no bias
  const feedback = [
    { dateStr: '2025-06-04', feeling: 'hard', completion: 'full' },
  ];
  const ctx = buildProgressionContext(
    'In-season', 'high', [], '2025-06-05',
    [], {}, [], 'hard', feedback,
  );
  assert(ctx.readiness === 'high', 'Integration: 1 entry → no bias applied');
}

{
  // buildProgressionContext with ease streak → consecutiveBuildWeeks +1
  const feedback = [
    { dateStr: '2025-06-04', feeling: 'easy', completion: 'full' },
    { dateStr: '2025-06-03', feeling: 'very_easy', completion: 'full' },
    { dateStr: '2025-06-02', feeling: 'easy', completion: 'full' },
    { dateStr: '2025-06-01', feeling: 'very_easy', completion: 'full' },
  ];
  const ctx = buildProgressionContext(
    'Off-season', 'high', [], '2025-06-05',
    [], {}, [], null, feedback,
  );
  // EASE_STREAK + FULL_COMPLETION_RUN → consecutiveBuildWeeks 2+1=3
  assert(ctx.consecutiveBuildWeeks === 3, 'Integration: EASE+FULL boosts build weeks');
}

// ─────────────────────────────────────────
console.log('\n── 21. One-step constraint verification ──');

{
  // Verify READINESS_DOWN map only goes one step
  assert(READINESS_DOWN['high'] === 'medium', 'Readiness: high → medium');
  assert(READINESS_DOWN['medium'] === 'low', 'Readiness: medium → low');
  assert(READINESS_DOWN['low'] === 'low', 'Readiness: low → low (floor)');
}

{
  // Verify FEELING_UP_ONE map only goes one step
  assert(FEELING_UP_ONE['Average'] === 'Good', 'Feeling: Average → Good');
  assert(FEELING_UP_ONE['Good'] === 'Sore', 'Feeling: Good → Sore');
  assert(FEELING_UP_ONE['Sore'] === 'Cooked', 'Feeling: Sore → Cooked');
  assert(FEELING_UP_ONE['Cooked'] === 'Cooked', 'Feeling: Cooked → Cooked (ceiling)');
  assert(FEELING_UP_ONE['Strong'] === 'Good', 'Feeling: Strong → Good');
}

{
  // Even with all flags active, readiness can only drop one step
  const ctx = { ...DEFAULT_PROGRESSION_CONTEXT, readiness: 'high', sessionFeeling: 'Good' };
  const summary = { sampleSize: 4, fatigueTrend: 'rising', completionTrend: 'declining', progressionConfidence: 'over_reached',
    activeFlags: ['FATIGUE_STREAK', 'COOKED_REPEAT', 'MIXED_SIGNALS', 'COMPLETION_DROP'] };
  const biased = applyPatternBiases(ctx, summary);
  // FATIGUE_STREAK → readiness high→medium. MIXED_SIGNALS blocked (FATIGUE already ran). COOKED_REPEAT blocked (FATIGUE ran).
  assert(biased.readiness === 'medium', 'All flags: readiness only one step (high→medium, not low)');
  assert(biased.sessionFeeling === 'Good', 'All flags: feeling unchanged (FATIGUE_STREAK took readiness)');
  assert(biased.missedSessionsThisWeek === 1, 'All flags: missed +1 from COMPLETION_DROP');
}

// ─────────────────────────────────────────
console.log('\n── 22. FEELING_SCORE constants ──');

assert(FEELING_SCORE['very_easy'] === 1, 'very_easy = 1');
assert(FEELING_SCORE['easy'] === 2, 'easy = 2');
assert(FEELING_SCORE['good'] === 3, 'good = 3');
assert(FEELING_SCORE['hard'] === 4, 'hard = 4');
assert(FEELING_SCORE['very_hard'] === 5, 'very_hard = 5');

// ═══════════════════════════════════════
console.log('\n═══════════════════════════════════════');
console.log(`FEEDBACK PATTERN TESTS: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════\n');
if (failed > 0) process.exit(1);
