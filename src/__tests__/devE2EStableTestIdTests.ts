import fs from 'fs';
import path from 'path';
import { dayOfWeekTestIdToken } from '../utils/stableTestId';

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
};

const contracts: Array<[string, string, RegExp]> = [
  ['program root', sources.program, /testID="program-screen"/],
  ['week navigation', sources.program, /program-week-previous[\s\S]*program-week-current[\s\S]*program-week-next/],
  ['day rows use day domains', sources.program, /dayOfWeekTestIdToken\(day\.dayOfWeek\)[\s\S]*testID=\{`day-row-\$\{dayToken\}`\}/],
  ['day states are explicit', sources.program, /day-row-\$\{dayToken\}-state-\$\{stateToken\}/],
  ['workout start action', sources.program, /testID="view-workout-button"/],
  ['fixture actions', sources.program, /fixture-move-action[\s\S]*fixture-remove-action/],
  ['plan edit action', sources.plan, /testID="plan-change-edit-session"/],
  ['plan deletion and movement', sources.plan, /plan-change-move-session[\s\S]*plan-change-delete-session[\s\S]*plan-change-delete-confirm/],
  ['injury region IDs', sources.injury, /injury-region-\$\{option\.id\}/],
  ['injury severity IDs', sources.injury, /injury-severity-\$\{option\.severityBand\}/],
  ['equipment preset IDs', sources.equipment, /equipment-preset-\$\{presetId\}/],
  ['workout exercise identity', sources.workout, /workout-exercise-row-\$\{exerciseToken\}/],
  ['prescription identity', sources.workout, /workout-exercise-prescription-\$\{exerciseToken\}/],
  ['set count identity', sources.workout, /exercise-set-count-\$\{exerciseToken\}-\$\{exercise\.prescribedSets\}/],
  ['finish action', sources.workout, /testID="finish-session-action"/],
  ['feedback options', sources.feedback, /feedback-completion-\$\{opt\.key\}[\s\S]*feedback-feeling-\$\{opt\.key\}[\s\S]*feedback-soreness-\$\{opt\.key\}/],
  ['feedback save', sources.feedback, /testID="feedback-save-action"/],
  ['session completion', sources.completion, /testID="session-completion"/],
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
