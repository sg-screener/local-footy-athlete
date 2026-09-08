/** Mutation witnesses for R-380/R-381. Changes exist only inside child-process loaders. */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const mutations = {
  injury_pattern_pause_missing: {
    file: 'src/utils/injurySessionRecomposition.ts',
    before: 'if (prohibitedMainRows.has(name)) {',
    after: 'if (false) {',
    test: 'src/__tests__/sessionInjuryReviewTests.ts',
    // Week-three aerobic offers change the measured injury pairing in [2].
    // The week-one full-stop journey still requires every prohibited main row
    // to be paused, so bypassing the pattern guard must fail that exact cell.
    failure: /FAIL \[fully paused\] reaches an actual fully paused second injury/,
  },
  injury_stale_paused_summary: {
    file: 'src/utils/injurySessionAdjustment.ts',
    before: 'const fullyPaused = kept.length === 0 && adjustment.added.length === 0;',
    after: 'if (kept.length === 0 && adjustment.added.length === 0) return workout; const fullyPaused = false;',
    test: 'src/__tests__/sessionInjuryReviewTests.ts',
    failure: /FAIL \[fully paused\] current summary replaces the previous injury summary/,
  },
  injury_missing_edit_continuation: {
    file: 'src/store/quiescentBoot.ts',
    before: 'compileAcceptedSourceFacts(sourceFacts, deferredExerciseEdits);',
    after: 'compileAcceptedSourceFacts(sourceFacts, []);',
    test: 'src/__tests__/injuryCompilerPreviewTests.ts',
    failure: /FAIL female-5-home\/2026-07-13 accepts edit while injury is active/,
  },
  injury_strength_edit_claims_conditioning: {
    file: 'src/store/quiescentBoot.ts',
    before: "edit.kind === 'swap' && activeInjuryFactsOn(sourceFacts, edit.dateISO)",
    after: "false && activeInjuryFactsOn(sourceFacts, edit.dateISO)",
    test: 'src/__tests__/injuryCompilerPreviewTests.ts',
    failure: /FAIL male-3-experienced-gym\/2026-07-13 strength-only edit preserves injury-adjusted conditioning/,
  },
  preparation_power_returns: {
    file: 'src/rules/offseasonSubphasePolicy.ts',
    before: "return subphase === 'early_offseason' || subphase === 'mid_offseason';",
    after: "return subphase === 'early_offseason';",
    test: 'src/__tests__/offseasonPreparationJourneyTests.ts',
    failure: /FAIL preparation policy vetoes power: mid_offseason/,
  },
  preparation_aerobic_offers_disappear: {
    file: 'src/rules/weeklyScheduler.ts',
    before: ".slice(0, OFFSEASON_PREPARATION.exposureConditioning.preferred.max)",
    after: '.slice(0, 0)',
    test: 'src/__tests__/offseasonPreparationJourneyTests.ts',
    failure: /FAIL week [34]: actual aerobic offer exists/,
  },
  preparation_optional_display_disappears: {
    file: 'src/utils/sessionTemplate.ts',
    before: "const optionalConditioning = workout.attachedConditioningKind === 'finisher';",
    after: 'const optionalConditioning = false;',
    test: 'src/__tests__/offseasonPreparationJourneyTests.ts',
    failure: /FAIL week [34]: aerobic rows are visibly optional/,
  },
  preparation_optional_completion_becomes_required: {
    file: 'src/utils/sessionExecutionChecklist.ts',
    before: "if ((item.kind === 'exercise' || item.kind === 'conditioning_choice') && item.optional) return 'optional';",
    after: "if (false) return 'optional';",
    test: 'src/__tests__/offseasonPreparationJourneyTests.ts',
    failure: /FAIL week [34]: skipping the aerobic offer still completes prescribed lifting/,
  },
  conditioning_fixture_fallback_ignores_access: {
    file: 'src/data/defaultProgram.ts',
    before: 'onboardingData && conditioningEquipmentOnDate(onboardingData, syntheticDateStr(day), equipmentCapabilities)\n      .conditioningModalities.length === 0',
    after: 'false',
    test: 'src/__tests__/conditioningDatedAccessTests.ts',
    failure: /Fixture adapter without a machine map must not resurrect Saturday machines/,
  },
  conditioning_shared_preference_drift: {
    file: 'src/rules/offseasonSubphasePolicy.ts',
    before: 'exposureConditioning: { required: 0, defaultTarget: 0, preferred: { min: 1, max: 2 }, max: 3,',
    after: 'exposureConditioning: { required: 0, defaultTarget: 0, preferred: { min: 1, max: 3 }, max: 3,',
    test: 'scripts/verify-exposure-contract-sheet.ts',
    failure: /mid_offseason\|conditioning\|preferredMax: sheet 2 vs source 3/,
  },
  conditioning_dated_machine_access_disappears: {
    file: 'src/rules/canonicalWeeklyAvailabilityState.ts',
    before: 'return hasGymAccess ? equipment : {',
    after: 'return true ? equipment : {',
    test: 'src/__tests__/conditioningDatedAccessTests.ts',
    failure: /dated helper/,
  },
  conditioning_cod_takes_first_base: {
    file: 'src/rules/weeklyScheduler.ts',
    before: "withFlush.find(entry => isReceiver(entry) && entry.conditioningCategory === 'tempo')",
    after: 'withFlush.find(isReceiver)',
    test: 'src/__tests__/fortnightlyCodDoseTests.ts',
    failure: /FAIL.*aerobic-base receiver/,
  },
  preparation_conditioning_returns: {
    file: 'src/rules/offseasonSubphasePolicy.ts',
    before: 'conditioningTarget: { min: 0, max: 3 },',
    after: 'conditioningTarget: { min: 3, max: 3 },',
    test: 'src/__tests__/offseasonPreparationJourneyTests.ts',
    failure: /FAIL preparation scheduler owes no conditioning: transition/,
  },
  preparation_rep_bridge_returns: {
    file: 'src/rules/offseasonSubphasePolicy.ts',
    before: "repBias: 'body_armour_8_12' as const, repsMin: 8, repsMax: 12",
    after: "repBias: 'body_armour_8_12' as const, repsMin: 6, repsMax: 10",
    test: 'src/__tests__/offseasonPreparationJourneyTests.ts',
    failure: /FAIL week [34]: body-armour main reps/,
  },
  preparation_running_returns: {
    file: 'src/rules/offseasonSubphasePolicy.ts',
    before: "running: { allowedBySubphase: false, enabledByDefault: false, policy: 'blocked_by_default' as const },",
    after: "running: { allowedBySubphase: true, enabledByDefault: true, policy: 'blocked_by_default' as const },",
    test: 'src/__tests__/offseasonPreparationJourneyTests.ts',
    failure: /FAIL preparation scheduler owes no conditioning: transition/,
  },
  preparation_hard_conditioning_returns: {
    file: 'src/rules/offseasonSubphasePolicy.ts',
    before: "defaultCategory: 'aerobic_base' as const,\n    hardSessionCap: 0,",
    after: "defaultCategory: 'aerobic_base' as const,\n    hardSessionCap: 1,",
    test: 'src/__tests__/offseasonPreparationJourneyTests.ts',
    failure: /FAIL preparation permits only light off-feet aerobic work/,
  },
  soreness_prompt_returns: {
    file: 'src/components/SessionFeedbackPanel.tsx',
    before: '<View testID="session-feedback-panel">',
    after: '<View testID="session-feedback-panel"><Text>How sore are you?</Text>',
    test: 'src/__tests__/sessionFeedbackScreenJourney.cjs',
    failure: /Error: rendered form has no soreness question or choice/,
  },
  expired_notice_returns: {
    file: 'src/rules/blockBoundaryProgression.ts',
    before: 'return horizonCoversWeek({ startsFrom: start, endsAfter: end }, weekStartISO);',
    after: 'return true;',
    test: 'src/__tests__/blockTwoScreenDeliveryTests.ts',
    failure: /FAIL expired reduction notice is absent after reload/,
  },
  repeated_reduction: {
    file: 'src/rules/canonicalWeeklyProgressionCompiler.ts',
    before: 'reduces: !!recoveryWindow && weekStart >= recoveryWindow.startISO && weekStart <= recoveryWindow.endISO && microcycle.weekKind !== \'deload\'',
    after: 'reduces: history.reduces && microcycle.weekKind !== \'deload\'',
    failure: /FAIL week [67]: actual reduced lifts return to their normal dose/,
  },
  double_bodyweight_progression: {
    file: 'src/rules/blockBoundaryProgression.ts',
    before: "return decision.kind === 'history_progressed' || decision.kind === 'bodyweight_progressed';",
    after: "return decision.kind === 'history_progressed';",
    failure: /FAIL Pull-Ups: no added load plus added set/,
  },
  hard_becomes_fatigue: {
    file: 'src/rules/effortScale.ts',
    before: "case 'hard': return 7;",
    after: "case 'hard': return 8;",
    failure: /FAIL historical hard means seven, never inferred soreness\/eight/,
  },
};
if (process.env.LFA_DOSE_MUTATION) {
  require('sucrase/register');
  const mutation = mutations[process.env.LFA_DOSE_MUTATION];
  if (!mutation) throw Error('Unknown mutation');
  const target = path.join(root, mutation.file);
  const extension = path.extname(target);
  const original = require.extensions[extension];
  require.extensions[extension] = (module, filename) => {
    if (filename !== target) return original(module, filename);
    const source = fs.readFileSync(filename, 'utf8');
    if (source.split(mutation.before).length !== 2) throw Error('Mutation anchor must occur exactly once');
    const changed = source.replace(mutation.before, mutation.after);
    console.log('MUTATION_APPLIED', process.env.LFA_DOSE_MUTATION);
    module._compile(require('sucrase').transform(changed, {transforms:['typescript','imports','jsx']}).code, filename);
  };
} else {
  let failed = 0;
  for (const [name, mutation] of Object.entries(mutations)) {
    const group = process.argv.includes('--conditioning') ? 'conditioning' : process.argv.includes('--injury-integration') ? 'injury'
      : process.argv.includes('--preparation') ? 'preparation' : 'dose';
    const mutationGroup = name.startsWith('conditioning_') ? 'conditioning' : name.startsWith('injury_') ? 'injury'
      : name.startsWith('preparation_') ? 'preparation' : 'dose';
    if (mutationGroup !== group) continue;
    const run = spawnSync(process.execPath, ['-r', __filename, path.join(root, mutation.test ?? 'src/__tests__/progressionDoseOwnershipTests.ts')], {
      cwd: root, env: {...process.env, TZ:'Australia/Melbourne', LFA_DOSE_MUTATION:name},
      encoding:'utf8', maxBuffer: 16 * 1024 * 1024,
    });
    const output = run.stdout + run.stderr;
    const caught = run.status === 1 && output.includes('MUTATION_APPLIED '+name) && mutation.failure.test(output);
    console.log(`${caught ? 'PASS' : 'FAIL'} mutation ${name}: ${caught ? 'applied and caught by its behaviour assertion' : output.slice(-5000)}`);
    if (!caught) failed++;
  }
  process.exitCode = failed ? 1 : 0;
}
