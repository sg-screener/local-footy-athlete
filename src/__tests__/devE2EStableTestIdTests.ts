import fs from 'fs';
import path from 'path';
import {
  dayOfWeekTestIdToken,
  explorerTestId,
  stableTestIdToken,
} from '../utils/stableTestId';

const root = path.resolve(__dirname, '..');
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');
const sources = {
  program: read('screens/home/HomeScreenV2.tsx'),
  plan: read('screens/home/PlanChangeSheet.tsx'),
  injury: read('screens/home/GuidedInjuryFlowSheet.tsx'),
  equipment: read('screens/home/EquipmentLimitationSheet.tsx'),
  workout: read('screens/home/DayWorkoutScreenV2.tsx'),
  feedback: read('components/SessionFeedbackPanel.tsx'),
  completion: read('components/SessionCompleteMoment.tsx'),
  witness: read('components/ExplorerRenderWitness.tsx'),
};

const contracts: Array<[string, string, RegExp]> = [
  ['program root', sources.program, /testID="program-screen"/],
  ['week navigation', sources.program, /program-week-previous[\s\S]*program-week-current[\s\S]*program-week-next/],
  ['day rows use day domains', sources.program, /dayOfWeekTestIdToken\(day\.dayOfWeek\)[\s\S]*`day-row-\$\{dayToken\}`/],
  ['day states are explicit', sources.program, /day-row-\$\{dayToken\}-state-\$\{stateToken\}/],
  ['workout start action', sources.program, /testID="view-workout-button"/],
  ['fixture actions use exact fixture identity', sources.program, /fixtureIngress\('move', fixtureId\)[\s\S]*fixtureIngress\('remove', fixtureId\)/],
  ['fixture cards and lifecycle states use exact fixture identity', sources.program, /fixtureCard\(day\.workout\.id\)[\s\S]*fixtureState\(day\.workout\.id, 'active'\)[\s\S]*fixtureState\(`calendar-game-\$\{day\.date\}`, 'absent'\)/],
  ['plan edit action', sources.plan, /testID="plan-change-edit-session"/],
  ['plan deletion and movement use session identity', sources.plan, /sessionMoveIngress\(selectedWorkout\.id\)[\s\S]*sessionDeleteIngress\(selectedWorkout\.id\)/],
  ['move destinations use dates', sources.plan, /sessionMoveDestination\(destination\.date\)/],
  ['delete scopes use session and scope', sources.plan, /sessionDeleteScope\(selectedWorkout\.id, scope\.id\)/],
  ['injury region IDs', sources.injury, /injury-region-\$\{option\.id\}/],
  ['injury severity IDs', sources.injury, /injury-severity-\$\{option\.severityBand\}/],
  ['injury lifecycle uses episode identity', sources.injury, /injuryIngress\(episodeId \? 'update' : 'set', episodeId\)[\s\S]*injuryDetail\(episodeId\)/],
  ['equipment preset IDs', sources.equipment, /equipmentOption\(preset\.id\)/],
  ['equipment update and clear IDs use fact identity', sources.equipment, /equipmentClear\(activeFactId\)[\s\S]*equipmentUpdate\(activeFactId, preset\.id\)/],
  ['workout exercise identity', sources.workout, /workout-exercise-row-\$\{exerciseToken\}/],
  ['canonical component identity', sources.workout, /componentIdentity\([\s\S]*workout\.id,[\s\S]*exercise\.targetId \?\? exercise\.key/],
  ['component delete scope identity', sources.workout, /componentDeleteScope\([\s\S]*sessionId,[\s\S]*step\.exercise\.targetId \?\? step\.exercise\.key,[\s\S]*'today'/],
  ['prescription identity', sources.workout, /workout-exercise-prescription-\$\{exerciseToken\}/],
  ['set count identity', sources.workout, /exercise-set-count-\$\{exerciseToken\}-\$\{exercise\.prescribedSets\}/],
  ['finish action', sources.workout, /testID="finish-session-action"/],
  ['feedback options', sources.feedback, /feedback-completion-\$\{opt\.key\}[\s\S]*feedback-feeling-\$\{opt\.key\}[\s\S]*feedback-soreness-\$\{opt\.key\}/],
  ['feedback save', sources.feedback, /testID="feedback-save-action"/],
  ['session completion', sources.completion, /testID="session-completion"/],
  ['feedback receipt uses transaction identity', sources.completion, /feedbackReceipt\(receipt\.transactionId\)/],
  ['progression target uses receipt and target session', sources.completion, /feedbackProgressionTarget\([\s\S]*receipt\.transactionId,[\s\S]*progressionTarget\.targetSessionId/],
  ['render witness is accessible and retained', sources.witness, /accessible[\s\S]*accessibilityRole="text"[\s\S]*collapsable=\{false\}[\s\S]*testID=\{testID\}/],
];

const failed = contracts.filter(([, source, pattern]) => !pattern.test(source));
contracts.forEach(([name, source, pattern]) =>
  console.log(`${pattern.test(source) ? '  ✓' : '  ✗'} ${name}`));
if (failed.length > 0) {
  console.log(`\nMissing stable test IDs: ${failed.map(([name]) => name).join(', ')}`);
  process.exit(1);
}
const expectedDayTokens = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
expectedDayTokens.forEach((token, dayOfWeek) => {
  if (dayOfWeekTestIdToken(dayOfWeek) !== token) {
    console.log(`  ✗ domain day ${dayOfWeek} maps to ${token}`);
    process.exit(1);
  }
  console.log(`  ✓ domain day ${dayOfWeek} maps to ${token}`);
});
console.log(`\nStable test ID contracts: ${contracts.length + expectedDayTokens.length} passed`);

const semanticIdentities: Array<[string, string, string]> = [
  ['fixture operation', explorerTestId.fixtureIngress('move', 'fixture:ABC'), 'fixture-move-action-fixture-abc'],
  ['fixture result', explorerTestId.fixtureState('fixture:ABC', 'active'), 'fixture-active-fixture-abc'],
  ['session destination', explorerTestId.sessionMoveDestination('2026-07-20'), 'session-move-destination-2026-07-20'],
  ['delete scope', explorerTestId.sessionDeleteScope('Session:A', 'strength_component'), 'session-delete-scope-session-a-strength-component'],
  ['component delete', explorerTestId.componentDeleteResult('Session:A', 'Exercise:9'), 'component-delete-result-session-a-exercise-9'],
  ['injury lifecycle', explorerTestId.injuryResolved('Episode:1'), 'injury-resolved-episode-1'],
  ['readiness effect', explorerTestId.readinessProgrammingEffect('Fact:2'), 'readiness-programming-effect-fact-2'],
  ['equipment clear', explorerTestId.equipmentCleared('Fact:3'), 'equipment-cleared-fact-3'],
  ['feedback receipt', explorerTestId.feedbackReceipt('Transaction:4'), 'session-feedback-receipt-transaction-4'],
  ['adjustment restore', explorerTestId.adjustmentRestored('Adjustment:5'), 'adjustment-restored-adjustment-5'],
  ['repeat restore', explorerTestId.repeatRestored('Repeat:6'), 'repeat-week-restored-repeat-6'],
];
for (const [name, actual, expected] of semanticIdentities) {
  if (actual !== expected || actual.includes(stableTestIdToken('Mutable display copy'))) {
    console.log(`  ✗ ${name}: expected ${expected}, received ${actual}`);
    process.exit(1);
  }
  console.log(`  ✓ ${name} is canonical (${actual})`);
}
