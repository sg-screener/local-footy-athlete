/**
 * Session logging UI source contract tests.
 *
 * Run: npx sucrase-node src/__tests__/sessionLoggingUITests.ts
 */

import * as fs from 'fs';
import * as path from 'path';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function assert(condition: boolean, msg: string): void {
  if (condition) {
    pass++;
  } else {
    fail++;
    failures.push(msg);
    console.error(`  FAIL: ${msg}`);
  }
}

function source(file: string): string {
  return fs.readFileSync(path.resolve(__dirname, '..', 'screens', 'home', file), 'utf8');
}

// TASK 6 (buttons/UI unit, 2026-07-31): `DayWorkoutScreen.tsx`'s Classic render
// layer is DELETED — it was unreachable behind a hardcoded `DESIGN_VERSION` and
// was the last consumer of the day-detail composition the one-projection ruling
// retires (see that file's header). Every assertion below that read `classic`
// had a V2 counterpart asserting the same behaviour on the surface that ships;
// those counterparts are untouched, so nothing this suite proved about the
// LIVE screen stopped being proved. What went with the code is the code's own
// markup.
const v2 = source('DayWorkoutScreenV2.tsx');
const feedbackPanel = fs.readFileSync(
  path.resolve(__dirname, '..', 'components', 'SessionFeedbackPanel.tsx'),
  'utf8',
);
const feedbackForm = fs.readFileSync(
  path.resolve(__dirname, '..', 'utils', 'sessionFeedbackForm.ts'),
  'utf8',
);
const sessionComponents = fs.readFileSync(
  path.resolve(__dirname, '..', 'utils', 'sessionComponents.ts'),
  'utf8',
);

console.log('\n=== 1. Main finish CTA is not gated by team training ===');
assert(!/!isFinished\s*&&\s*!hasTeamTraining/.test(v2), 'V2 finish CTA is not hidden by team training');
assert(/<FinishMoment onPress=\{handleFinishWorkout\}/.test(v2), 'V2 renders FinishMoment from shared finish handler');

console.log('\n=== 2. Team Training card does not replace logging path ===');
assert(!/Log Team Training/.test(v2), 'V2 Team Training card has no replacement log button');
assert(/testID="team-training-section"/.test(v2), 'V2 still renders team training information block');

console.log('\n=== 3. Component reasons render under component questions ===');
assert(
  /componentQuestionLabel\(component, sessionComponents\.length\)[\s\S]{0,900}renderComponentReasonGroup\(component\)/.test(
    feedbackPanel,
  ),
  'component reason group renders immediately inside component map',
);
assert(
  /componentSkipReasonLabel\(component\)/.test(feedbackPanel),
  'skip reason label is component-specific',
);
assert(
  /componentPartialReasonLabel\(component\)/.test(feedbackPanel),
  'partial reason label is component-specific',
);
assert(
  /!hasComponentFlow && hasSection\('partialReason'\)/.test(feedbackPanel),
  'generic partial reason is not shown in component flow',
);
assert(
  /!hasComponentFlow && hasSection\('skipReason'\)/.test(feedbackPanel),
  'generic skip reason is not shown in component flow',
);

console.log('\n=== 4. Generic reasons sit directly below completion ===');
const completionIndex = feedbackPanel.indexOf('{hasComponentFlow ? (');
const partialReasonIndex = feedbackPanel.indexOf("!hasComponentFlow && hasSection('partialReason')");
const skipReasonIndex = feedbackPanel.indexOf("!hasComponentFlow && hasSection('skipReason')");
const feelingIndex = feedbackPanel.indexOf("hasSection('feeling')");
const skippedTransitionStart = feedbackForm.indexOf("if (nextCompletion === 'skipped')");
const skippedTransition = feedbackForm.slice(skippedTransitionStart, skippedTransitionStart + 300);
assert(
  completionIndex >= 0 && partialReasonIndex > completionIndex && partialReasonIndex < feelingIndex,
  'generic partial reason renders before effort follow-ups',
);
assert(
  completionIndex >= 0 && skipReasonIndex > completionIndex && skipReasonIndex < feelingIndex,
  'generic skip reason renders before any performed-session follow-ups',
);
assert(
  skippedTransitionStart >= 0 &&
    skippedTransition.includes('feeling: null') &&
    !skippedTransition.includes('soreness:'),
  'skipped transition clears effort without writing retired soreness',
);

console.log('\n=== 5. Combined sessions expose only resolved component questions ===');
assert(
  /sessionComponents\.map\(\(component\)/.test(feedbackPanel),
  'feedback panel renders one completion group per resolved component',
);
assert(
  /Did you complete the speed work\?/.test(sessionComponents),
  'speed block has a dedicated completion question',
);
assert(
  /Did you complete the finisher\?/.test(sessionComponents),
  'finisher has a dedicated completion question',
);
assert(
  /Did you complete the recovery add-on\?/.test(sessionComponents),
  'recovery add-on has a dedicated completion question',
);
assert(
  /Did you complete the power work\?/.test(sessionComponents),
  'power block has a dedicated completion question',
);
assert(
  /completionPolicy: 'optional_no_penalty'/.test(sessionComponents),
  'optional add-ons use the no-penalty completion policy',
);

console.log('\n=== 6. Power follows the ordinary execution-row path ===');
// The ordering and content proof lives at the template owner in
// sessionTemplateOneListTests. This screen guard now protects the ownership
// boundary instead of opening the deleted PowerPrimerSection and claiming to
// cover a component the live screen cannot render.
assert(
  /buildSessionTemplate/.test(v2) && /<StrengthExerciseCard/.test(v2),
  'V2 renders template exercises through the ordinary exercise row',
);
assert(
  !/PowerPrimerSection|PowerRow|item\.kind === 'power'/.test(v2),
  'V2 has no second power-specific render path',
);

console.log('\n=== 7. Trunk/support is visible and explanation UI is removed ===');
// V2 took the D13 one-list template (2026-07-25): trunk rows are no longer a
// section, they are Midline-badged rows inside the single list. That the rows
// still REACH the athlete is proved by sessionTemplateOneListTests §2/§7.
assert(
  !/<TrunkSupportSection/.test(v2) && /buildSessionTemplate/.test(v2),
  'V2 renders trunk rows as ordinary rows of the one list, not as a Trunk / Support box',
);
assert(
  !/TrunkSupportSection/.test(v2) && /<StrengthExerciseCard/.test(v2),
  'trunk/support rows reach the same ordinary exercise renderer as other Strength work',
);
assert(
  !/SessionExplanationBanner|Why this session/i.test(v2),
  'V2 has no Why this session link or explanation panel',
);
// V2 took the D13 one-list template (2026-07-25): conditioning rows arrive as
// template items whose rows the composition owner resolved from
// getSessionComponentRows — the screen never re-derives them by scanning names.
assert(
  /<ConditioningPhaseRow[\s\S]{0,80}exercise=\{item\.row\}/.test(v2),
  'V2 conditioning phases render only the rows the composition owner resolved',
);
const v2ConditioningRenderer = v2.slice(
  v2.indexOf('function ConditioningRow('),
  v2.indexOf('function TeamTrainingRow', v2.indexOf('function ConditioningRow(')),
);
assert(
  !/weightControl|prescribedWeightKg|formatWeight/.test(v2ConditioningRenderer),
  'V2 conditioning rows never render kilogram controls',
);

console.log(`\nSummary: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`- ${f}`);
  process.exit(1);
}
