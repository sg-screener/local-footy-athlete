import fs from 'fs';
import path from 'path';
import { explorerTestId } from '../utils/stableTestId';

const root = path.resolve(__dirname, '..');
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');
const home = read('screens/home/HomeScreenV2.tsx');
const workout = read('screens/home/DayWorkoutScreenV2.tsx');
const plan = read('screens/home/PlanChangeSheet.tsx');
const injury = read('screens/home/GuidedInjuryFlowSheet.tsx');
const equipment = read('screens/home/EquipmentLimitationSheet.tsx');
const completion = read('components/SessionCompleteMoment.tsx');

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

console.log('\n-- Explorer lifecycle and reload witnesses --');
check('fixture add/move/remove ingress and exact active/absent state exist',
  /fixtureIngress\('add', weekAnchorISO\)/.test(home) &&
  /fixtureIngress\('move', fixtureId\)/.test(home) &&
  /fixtureIngress\('remove', fixtureId\)/.test(home) &&
  /fixtureState\(day\.workout\.id, 'active'\)/.test(home) &&
  /fixtureState\(`calendar-game-\$\{day\.date\}`, 'absent'\)/.test(home));
check('session card and detail share the same canonical workout ID',
  /sessionCard\(day\.workout\.id\)/.test(home) &&
  /sessionDetail\(workout\.id\)/.test(workout));
check('move destination and delete scope never use an array position',
  /sessionMoveDestination\(destination\.date\)/.test(plan) &&
  /sessionDeleteScope\(selectedWorkout\.id, scope\.id\)/.test(plan) &&
  !/sessionMoveDestination\([^)]*index/.test(plan) &&
  !/sessionDeleteScope\([^)]*index/.test(plan));
check('component detail and delete controls share session plus component identity',
  /componentIdentity\([\s\S]*workout\.id[\s\S]*exercise\.targetId \?\? exercise\.key/.test(workout) &&
  /componentDeleteIngress\([\s\S]*sessionId[\s\S]*exercise\.targetId \?\? exercise\.key/.test(workout) &&
  /componentDeleteScope\([\s\S]*sessionId[\s\S]*step\.exercise\.targetId \?\? step\.exercise\.key/.test(workout));
check('accepted adjustment ledger recreates move/delete/component result IDs after reload',
  /adjustmentResultWitnesses[\s\S]*userRemovalConstraint[\s\S]*sessionMutationResult[\s\S]*componentDeleteResult/.test(home) &&
  /adjustmentResultWitnesses\.map\(\(testID\)[\s\S]*ExplorerRenderWitness/.test(home));
check('injury card/detail/resolve use episode identity',
  /injuryActive\(note\.injuryEpisodeId\)/.test(home) &&
  /injuryDetail\(episodeId\)/.test(injury) &&
  /injuryResolveAction\(note\.injuryEpisodeId\)/.test(home) &&
  /injuryResolved\(episode\.episodeId\)/.test(home));
check('readiness active, clear and programming-effect leaves survive from facts',
  /readinessActive\(fact\.factId\)/.test(home) &&
  /readinessClear\(fact\.factId\)/.test(home) &&
  /readinessProgrammingEffect\(fact\.factId\)/.test(home));
check('equipment active and cleared leaves survive and controls can clear/reapply',
  /equipmentActive\(fact\.factId\)/.test(home) &&
  /equipmentCleared\(fact\.factId\)/.test(home) &&
  /equipmentClear\(activeFactId\)/.test(equipment) &&
  /equipmentOption\(preset\.id\)/.test(equipment));
check('feedback receipt and future progression target render immediately and from persisted feedback',
  /feedbackReceipt\(receipt\.transactionId\)/.test(completion) &&
  /feedbackProgressionTarget\([\s\S]*receipt\.transactionId[\s\S]*progressionTarget\.targetSessionId/.test(completion) &&
  /feedbackRenderWitnesses[\s\S]*Object\.values\(sessionFeedback\)[\s\S]*outcomeReceipt/.test(home));
check('adjustment and Repeat Week active/restored leaves use ledger IDs',
  /adjustmentActive\(adjustment\.id\)[\s\S]*adjustmentRestored\(adjustment\.id\)/.test(home) &&
  /repeatActive\(adjustment\.id\)[\s\S]*repeatRestored\(adjustment\.id\)/.test(home));

const identityPairs: Array<[string, string, string]> = [
  ['session card/detail', explorerTestId.sessionCard('session:A'), explorerTestId.sessionDetail('session:A')],
  ['injury card/detail', explorerTestId.injuryActive('episode:A'), explorerTestId.injuryDetail('episode:A')],
];
for (const [name, card, detail] of identityPairs) {
  const cardIdentity = card.replace(/^(session-card|injury-active)-/, '');
  const detailIdentity = detail.replace(/^(session-detail|injury-detail)-/, '');
  check(`${name} retain equal canonical identity`, cardIdentity === detailIdentity);
}

console.log(`\nExplorer lifecycle witness UI: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
