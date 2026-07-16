/**
 * Source-level rendered-prop contracts for the shared React Native
 * accessibility wrappers. The repository does not ship a native component
 * renderer, so these tests pin the props that determine the iOS/Android
 * accessibility hierarchy without requiring Expo or a simulator.
 *
 * Run: npm run test:accessibility-contracts
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '..');
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

const sheet = read('components/ui/Sheet.tsx');
const button = read('components/ui/Button.tsx');
const card = read('components/ui/Card.tsx');
const planChangeSheet = read('screens/home/PlanChangeSheet.tsx');
const home = read('screens/home/HomeScreenV2.tsx');

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean, detail?: string) {
  if (condition) {
    pass++;
    console.log(`  \u2713 ${name}`);
    return;
  }
  fail++;
  failures.push(name);
  console.log(`  \u2717 ${name}${detail ? `\n      ${detail}` : ''}`);
}

function section(name: string) {
  console.log(`\n${name}`);
}

function openingTag(source: string, element: string, marker: string): string {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) return '';
  const start = source.lastIndexOf(`<${element}`, markerIndex);
  const end = source.indexOf('>', markerIndex);
  return start >= 0 && end >= 0 ? source.slice(start, end + 1) : '';
}

section('[1] Sheet keeps its identifier without becoming an accessible parent');
{
  const rootTag = openingTag(sheet, 'View', 'testID={testID}');
  const backdropTag = openingTag(sheet, 'Pressable', 'onPress={handleClose}');
  const contentTag = openingTag(sheet, 'View', 'accessibilityViewIsModal');

  ok('sheet testID remains on a native container', /testID=\{testID\}/.test(rootTag));
  ok('sheet container does not group descendants', /accessible=\{false\}/.test(rootTag));
  ok('sheet container leaves descendants important', /importantForAccessibility="no"/.test(rootTag));
  ok('sheet container is retained in the native hierarchy', /collapsable=\{false\}/.test(rootTag));
  ok('sheet identifier is not owned by a parent Pressable', !/<Pressable[\s\S]*testID=\{testID\}/.test(sheet));
  ok('backdrop alone retains the close press', /onPress=\{handleClose\}/.test(backdropTag));
  ok('backdrop is excluded from accessibility focus', /accessible=\{false\}/.test(backdropTag));
  ok('sheet content is not a grouping accessibility node', /accessible=\{false\}/.test(contentTag));
  ok('sheet content retains modal VoiceOver scope', /accessibilityViewIsModal/.test(contentTag));
}

section('[2] Button exposes one stable actionable leaf');
{
  const wrapperTag = openingTag(button, 'Animated.View', 'importantForAccessibility="no"');
  const pressableTag = openingTag(button, 'Pressable', 'testID={testID}');

  ok('animated wrapper cannot swallow the button', /accessible=\{false\}/.test(wrapperTag));
  ok('button Pressable is explicitly accessible', /\saccessible(?:\s|\n)/.test(pressableTag));
  ok('button is explicitly important to Android accessibility', /importantForAccessibility="yes"/.test(pressableTag));
  ok('button keeps its role', /accessibilityRole="button"/.test(pressableTag));
  ok('button keeps custom-label fallback behavior', /accessibilityLabel=\{accessibilityLabel \?\? label\}/.test(pressableTag));
  ok('button keeps its native identifier', /testID=\{testID\}/.test(pressableTag));
  ok('button identifier stays on the element owning onPress', /onPress=\{onPress\}/.test(pressableTag));
  ok(
    'disabled and loading buttons remain represented as disabled',
    /accessibilityState=\{\{ disabled: disabled \|\| loading \}\}/.test(pressableTag),
  );
  ok(
    'disabled and loading buttons cannot be pressed',
    /disabled=\{disabled \|\| loading\}/.test(pressableTag),
  );
}

section('[3] Interactive Card supports nested controls without swallowing them');
{
  const cardPressableTag = openingTag(card, 'Pressable', 'importantForAccessibility={exposesAsAccessibilityElement');
  const dayCardTag = openingTag(home, 'Card', 'accessible={!exposesExpandedActions}');

  ok('Card has a shared accessibility-container option', /accessible\?: boolean/.test(card));
  ok('interactive cards remain one element by default', /accessible \?\? true/.test(card));
  ok(
    'Card maps container mode to native accessibility importance',
    /importantForAccessibility=\{exposesAsAccessibilityElement \? 'yes' : 'no'\}/.test(cardPressableTag),
  );
  ok(
    'expanded day rows use container mode only while nested controls render',
    /const exposesExpandedActions = isSelected && normal/.test(home),
  );
  ok('expanded day row disables parent accessibility grouping', /accessible=\{!exposesExpandedActions\}/.test(dayCardTag));
  ok('day row identifier remains unchanged', /testID=\{`day-row-\$\{dayToken\}`\}/.test(dayCardTag));
  ok('day row press behavior remains attached', /onPress=\{onPress\}/.test(dayCardTag));
}

section('[4] Required sheet titles and child controls remain independently exposed');
{
  ok(
    'Plan Change title remains visible accessibility text inside Sheet',
    /<Sheet[^>]*testID="plan-change-sheet">[\s\S]*?<Text style=\{styles\.title\}>/.test(planChangeSheet),
  );
  ok(
    'Plan Change edit action keeps its identifier on MenuOption',
    /<MenuOption[\s\S]*?testID="plan-change-edit-session"[\s\S]*?onPress=/.test(planChangeSheet),
  );
  ok(
    'MenuOption forwards identifier and press to the same Pressable',
    /function MenuOption[\s\S]*?<Pressable[\s\S]*?onPress=\{onPress\}[\s\S]*?testID=\{testID\}/.test(planChangeSheet),
  );
  ok(
    'Fixture sheet title remains visible accessibility text inside Sheet',
    /<Sheet[^>]*testID="fixture-actions-sheet">[\s\S]*?<Text style=\{styles\.sheetTitle\}>/.test(home),
  );
  ok(
    'Fixture move action keeps its identifier on SheetOption',
    /<SheetOption[\s\S]*?testID="fixture-move-action"[\s\S]*?onPress=\{onMove\}/.test(home),
  );
  ok(
    'SheetOption forwards identifier and press to the same Pressable',
    /function SheetOption[\s\S]*?<Pressable[\s\S]*?onPress=\{onPress\}[\s\S]*?testID=\{testID\}/.test(home),
  );
  ok(
    'Start Session keeps view-workout-button on shared Button',
    /<Button label="Start Session"[^>]*onPress=\{onViewWorkout\}[^>]*testID="view-workout-button"/.test(home),
  );
}

console.log(`\nAccessibility wrapper contracts: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log(`\nFailures:\n${failures.map((name) => `  - ${name}`).join('\n')}`);
  process.exit(1);
}
