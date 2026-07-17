/**
 * Source-level React render-boundary contracts. This repository intentionally
 * has no native component renderer; these assertions pin the post-commit
 * effects that wait for accepted state and the semantic native leaf before
 * recording TraceV2 UI proof.
 */
import fs from 'fs';
import path from 'path';
import {
  __resetDevE2EStateForTest,
  devE2EMarkers,
  getDevE2EStateSnapshot,
  setDevE2ETraceUIObserved,
} from '../dev/e2e/devE2EState';

const root = path.resolve(__dirname, '..');
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');
const hook = read('screens/home/useHomeScreen.ts');
const plan = read('screens/home/PlanChangeSheet.tsx');
const workout = read('screens/home/DayWorkoutScreenV2.tsx');
const feedback = read('components/SessionFeedbackPanel.tsx');
const completion = read('components/SessionCompleteMoment.tsx');
const witness = read('components/ExplorerRenderWitness.tsx');
const state = read('dev/e2e/devE2EState.ts');

let passed = 0;
let failed = 0;
function check(name: string, condition: boolean): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}`);
  }
}

console.log('\n-- Explorer rendered observation boundary --');
check('render witness is a retained accessible native node',
  /accessible[\s\S]*accessibilityRole="text"[\s\S]*collapsable=\{false\}[\s\S]*testID=\{testID\}/.test(witness));
check('fixture observation waits for the target and released source in a React effect',
  /useEffect\(\(\) => \{[\s\S]*pendingFixtureObservation[\s\S]*targetHasFixture[\s\S]*sourceReleased[\s\S]*observeRenderedAthleteActionOutcome/.test(hook));
check('readiness and equipment observation waits for accepted fact plus constraint state',
  /useEffect\(\(\) => \{[\s\S]*pendingSourceFactObservation[\s\S]*activeConstraintExists[\s\S]*renderedStatus[\s\S]*observeRenderedAthleteActionOutcome/.test(hook));
check('injury observation waits for the accepted episode lifecycle state',
  /useEffect\(\(\) => \{[\s\S]*pendingInjuryObservation[\s\S]*episode\?\.status[\s\S]*observeRenderedAthleteActionOutcome/.test(hook));
check('repeat and restoration observations wait for accepted revision and adjustment identity',
  /pendingRepeatObservation\.acceptedRevision[\s\S]*activeRepeatWeekAdjustment\?\.id[\s\S]*observeRenderedAthleteActionOutcome/.test(hook) &&
  /pendingRestorationObservation\.acceptedRevisionAfter[\s\S]*observeRenderedAthleteActionOutcome/.test(hook));
check('session move/delete observation waits for visible source, target and component state',
  /sourceReleased[\s\S]*targetSessionId[\s\S]*deletedScopeStillRendered[\s\S]*renderedStateMatches[\s\S]*observeRenderedAthleteActionOutcome/.test(plan));
check('component delete observation waits until the canonical component is absent',
  /targetStillRendered[\s\S]*if \(targetStillRendered\) return;[\s\S]*observeRenderedAthleteActionOutcome/.test(workout));
check('feedback registers only the transaction result, then observes from completion render effect',
  /registerAthleteActionUIOutcome\([\s\S]*feedbackReceipt\(result\.receipt\.transactionId\)/.test(feedback) &&
  /useEffect\(\(\) => \{[\s\S]*feedbackReceipt\(receipt\.transactionId\)[\s\S]*observeRenderedAthleteActionOutcome/.test(completion));
check('observation marker contains control, trace and observation identity',
  /markerToken\(controlId\)[\s\S]*'trace'[\s\S]*markerToken\(traceId\)[\s\S]*'observation'[\s\S]*markerToken\(observationId\)/.test(state));

__resetDevE2EStateForTest();
setDevE2ETraceUIObserved(
  'session-move-result-session-a-2026-07-20',
  'trace:ABC',
  'plan-change-result:trace:ABC',
);
const markers = devE2EMarkers(getDevE2EStateSnapshot());
check('legacy deterministic control marker remains available',
  markers.includes('e2e-trace-ui-observed-session-move-result-session-a-2026-07-20'));
check('exact trace-correlated deterministic marker is emitted',
  markers.includes(
    'e2e-trace-ui-observed-session-move-result-session-a-2026-07-20-trace-trace-abc-observation-plan-change-result-trace-abc',
  ));
__resetDevE2EStateForTest();

console.log(`\nExplorer rendered observation UI: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
