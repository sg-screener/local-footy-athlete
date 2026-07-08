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

const classic = source('DayWorkoutScreen.tsx');
const v2 = source('DayWorkoutScreenV2.tsx');
const feedbackPanel = fs.readFileSync(
  path.resolve(__dirname, '..', 'components', 'SessionFeedbackPanel.tsx'),
  'utf8',
);

console.log('\n=== 1. Main finish CTA is not gated by team training ===');
assert(!/!isFinished\s*&&\s*!hasTeamTraining/.test(classic), 'Classic finish CTA is not hidden by team training');
assert(!/!isFinished\s*&&\s*!hasTeamTraining/.test(v2), 'V2 finish CTA is not hidden by team training');
assert(/title="Finish Session"/.test(classic), 'Classic renders Finish Session');
assert(/<FinishMoment onPress=\{handleFinishWorkout\}/.test(v2), 'V2 renders FinishMoment from shared finish handler');

console.log('\n=== 2. Team Training card does not replace logging path ===');
assert(!/Log Team Training/.test(classic), 'Classic Team Training card has no replacement log button');
assert(!/Log Team Training/.test(v2), 'V2 Team Training card has no replacement log button');
assert(/teamTrainingCard/.test(classic), 'Classic still renders team training card styling');
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

console.log(`\nSummary: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`- ${f}`);
  process.exit(1);
}
