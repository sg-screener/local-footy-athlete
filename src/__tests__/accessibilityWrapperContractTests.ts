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
const injury = read('screens/home/GuidedInjuryFlowSheet.tsx');
const equipment = read('screens/home/EquipmentLimitationSheet.tsx');
const witness = read('components/ExplorerRenderWitness.tsx');
const popupHeaderConsumers: Record<string, number> = {
  'components/CoachNoteSheet.tsx': 1,
  'components/ModifiersSheet.tsx': 1,
  'components/RebuildSheet.tsx': 2,
  'components/SeasonPhaseShiftSheet.tsx': 4,
  'components/SessionActionSheet.tsx': 1,
  'components/StaleOverrideBanner.tsx': 2,
  'screens/home/EquipmentLimitationSheet.tsx': 1,
  'screens/home/HomeQuickActionSheet.tsx': 4,
  'screens/home/HomeScreenV2.tsx': 10,
  'screens/home/PlanChangeSheet.tsx': 1,
  'screens/profile/EquipmentEditorSheet.tsx': 1,
  'screens/profile/ProfileScreen.tsx': 11,
};
const popupDescriptionConsumers: Record<string, number> = {
  'components/CoachNoteSheet.tsx': 1,
  'components/ModifiersSheet.tsx': 1,
  'components/RebuildSheet.tsx': 1,
  'components/SeasonPhaseShiftSheet.tsx': 4,
  'components/SessionActionSheet.tsx': 1,
  'components/StaleOverrideBanner.tsx': 2,
  'screens/home/EquipmentLimitationSheet.tsx': 1,
  'screens/home/GuidedInjuryFlowSheet.tsx': 1,
  'screens/home/HomeQuickActionSheet.tsx': 1,
  'screens/home/HomeScreenV2.tsx': 7,
  'screens/home/SessionEquipmentSheet.tsx': 1,
  'screens/profile/EquipmentEditorSheet.tsx': 1,
  'screens/profile/ProfileScreen.tsx': 6,
};

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
  const sheetComponent = sheet.slice(sheet.indexOf('export function Sheet('));
  const rootTag = openingTag(sheetComponent, 'View', 'testID={testID}');
  const backdropTag = openingTag(sheetComponent, 'Pressable', 'onPress={handleClose}');
  const contentTag = openingTag(sheetComponent, 'View', 'accessibilityViewIsModal');

  ok('sheet testID remains on a native container', /testID=\{testID\}/.test(rootTag));
  ok('sheet container does not group descendants', /accessible=\{false\}/.test(rootTag));
  ok('sheet container leaves descendants important', /importantForAccessibility="no"/.test(rootTag));
  ok('sheet container is retained in the native hierarchy', /collapsable=\{false\}/.test(rootTag));
  ok('sheet identifier is not owned by a parent Pressable', !/<Pressable[\s\S]*testID=\{testID\}/.test(sheet));
  ok('backdrop alone retains the close press', /onPress=\{handleClose\}/.test(backdropTag));
  ok('backdrop is excluded from accessibility focus', /accessible=\{false\}/.test(backdropTag));
  ok('sheet content is not a grouping accessibility node', /accessible=\{false\}/.test(contentTag));
  ok('sheet content retains modal VoiceOver scope', /accessibilityViewIsModal/.test(contentTag));
  ok('every shared bottom sheet receives the lime popup accent',
    /handle:\s*\{[^}]*backgroundColor:\s*colors\.accent\.lime/.test(sheet));
  ok('the shared popup header keeps the title lime and subtitle white',
    /function SheetHeader\([\s\S]*styles\.headerTitle[\s\S]*styles\.headerSubtitle/.test(sheet)
      && /headerTitle:\s*\{[^}]*color:\s*colors\.accent\.lime/.test(sheet)
      && /headerSubtitle:\s*\{[^}]*color:\s*colors\.text\.primary/.test(sheet));

  // Unit: SheetHeader opening tags. Denominator: all 39 popup-header sites in
  // the 12 current Sheet consumers. Pinning each file's count catches a caller
  // that quietly falls back to an unstructured one-line heading.
  const popupHeaderMismatches = Object.entries(popupHeaderConsumers).filter(([file, expected]) => {
    const actual = read(file).match(/<SheetHeader\b/g)?.length ?? 0;
    return actual !== expected;
  });
  ok('all 39 shared-sheet popups use the two-line header',
    popupHeaderMismatches.length === 0,
    popupHeaderMismatches.map(([file, expected]) => `${file}: expected ${expected}`).join(', '));

  ok('shared popup explanations use 14px above and 18px below',
    /header:\s*\{[^}]*marginBottom:\s*14/.test(sheet)
      && /description:\s*\{[^}]*marginBottom:\s*18/.test(sheet));
  // Unit: SheetDescription opening tags. Denominator: the 28 explanatory-text
  // sites in the current popup surfaces.
  const popupDescriptionMismatches = Object.entries(popupDescriptionConsumers)
    .filter(([file, expected]) => (read(file).match(/<SheetDescription\b/g)?.length ?? 0) !== expected);
  ok('all 28 popup explanations use the shared spacing treatment',
    popupDescriptionMismatches.length === 0,
    popupDescriptionMismatches.map(([file, expected]) => `${file}: expected ${expected}`).join(', '));

  ok('injury keeps INJURY lime above the white question',
    /title=\{step\?\.eyebrow \?\? 'Session'\}[\s\S]*subtitle=\{step\?\.title \?\? ''\}/.test(read('components/SessionActionSheet.tsx'))
      && /eyebrow: titlePrefix \?\? 'Injury'/.test(injury)
      && /region: 'Where is the issue\?'/.test(injury));

  ok('the standalone demo popup keeps DEMO lime and its exercise title white',
    /eyebrow:\s*\{[^}]*color:\s*colors\.accent\.lime/.test(read('components/ExerciseVideoModal.tsx'))
      && /title:\s*\{[^}]*color:\s*'#FFFFFF'/.test(read('components/ExerciseVideoModal.tsx')));
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
  ok('day row identifier remains canonical in normal mode', /`day-row-\$\{dayToken\}`/.test(dayCardTag));
  ok('day row press behavior remains attached', /onPress=\{onPress\}/.test(dayCardTag));
}

section('[4] Required sheet titles and child controls remain independently exposed');
{
  ok(
    'Plan Change title remains visible accessibility text inside Sheet',
    /<Sheet[^>]*testID="plan-change-sheet">[\s\S]*?<SheetHeader title="Plan change" subtitle=\{weekdayLabel\(date\)\}/.test(planChangeSheet),
  );
  ok(
    'Plan Change actions keep their identifiers on MenuOption',
    /<MenuOption[\s\S]*?testID="plan-change-swap"[\s\S]*?onPress=/.test(planChangeSheet)
      && /<MenuOption[\s\S]*?testID="plan-change-add"[\s\S]*?onPress=/.test(planChangeSheet),
  );
  ok(
    'MenuOption forwards identifier and press to the same Pressable',
    // `onPress` is now gated on `disabled` — a row rendered OFF must not fire.
    // The contract is unchanged: ONE Pressable carries both the id and the press.
    /function MenuOption[\s\S]*?<Pressable[\s\S]*?onPress=\{disabled \? undefined : onPress\}[\s\S]*?testID=\{testID\}/.test(planChangeSheet),
  );
  ok(
    'a disabled MenuOption tells accessibility it is disabled',
    /function MenuOption[\s\S]*?disabled=\{disabled\}[\s\S]*?accessibilityState=\{\{ disabled: !!disabled \}\}/.test(planChangeSheet),
  );
  ok(
    'Fixture sheet title remains visible accessibility text inside Sheet',
    /<Sheet[\s\S]*?testID=\{explorerTestId\.fixtureActions\(fixtureId\)\}[\s\S]*?<SheetHeader title="Game day" subtitle=\{label\}/.test(home),
  );
  ok(
    'Fixture move action keeps its identifier on SheetOption',
    /<SheetOption[\s\S]*?testID=\{explorerTestId\.fixtureIngress\('move', fixtureId\)\}[\s\S]*?onPress=\{onMove\}/.test(home),
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

section('[5] Explorer semantic leaves and lifecycle controls are accessible');
{
  ok('render witness is an accessibility-visible retained native leaf',
    /<View[\s\S]*?accessible[\s\S]*?accessibilityLabel=\{accessibilityLabel\}[\s\S]*?accessibilityRole="text"[\s\S]*?collapsable=\{false\}/.test(witness));
  /* ⚠ **THESE THREE CELLS REQUIRED THE DEFECT, AND ARE INVERTED — R-109.**
   *
   * Sam, 2026-08-20: *"fix the six accessibility labels so athletes hear
   * exercise names, not internal IDs."*
   *
   * They read `accessibilityLabel={testID}` and were titled *"expose their
   * stable identity to accessibility"* — so the design was deliberate and
   * guarded, not an oversight. **What it cost was the athlete:** each row is one
   * accessibility leaf (`accessibilityRole="button"`), so its label is the whole
   * of what a screen-reader user hears, and on the Remove picker that was
   * `component-delete-action-dev-e2e-standard-in-season-week-2026-07-13-dow-1-…-
   * ex-squat-1` where the screen plainly reads "Back Squat".
   *
   * ⚠ **NOTHING LOSES ITS ADDRESS, AND THAT IS ASSERTED BELOW RATHER THAN
   * ASSUMED.** `testID` sets `accessibilityIdentifier`, which is what Maestro's
   * `id:` and the explorer match on; only the SPOKEN name changes. Measured on
   * glass the same day: `id: "session-change-remove"` resolves while that
   * component's label is the word "Remove". */
  ok('SheetOption speaks its LABEL, not its test id',
    /function SheetOption[\s\S]*?accessibilityRole="button"[\s\S]*?accessibilityLabel=\{label\}/.test(home));
  ok('injury options speak their label',
    /function FlowOption[\s\S]*?accessibilityRole="button"[\s\S]*?accessibilityLabel=\{label\}/.test(injury));
  /* ⚠ **`EquipmentOption` HAS NOT EXISTED FOR SOME TIME.** This cell was one of
   * five already red at HEAD, reading a function name the component was renamed
   * away from — `MissingToggle`. A guard that cannot find its subject is not
   * guarding it, and its red said nothing about accessibility. Re-aimed. */
  ok('equipment options speak their label',
    /function MissingToggle[\s\S]*?accessibilityRole="button"[\s\S]*?accessibilityLabel=\{label\}/.test(equipment));
  // ⚠ AND THE IDENTITY IS STILL THERE. Without this, a fix that deleted the
  // testID outright would satisfy all three cells above and break every flow.
  ok('and all three still carry testID, so nothing loses its address',
    /function SheetOption[\s\S]*?testID=\{testID\}/.test(home)
      && /function FlowOption[\s\S]*?testID=\{testID\}/.test(injury)
      && /function MissingToggle[\s\S]*?testID=\{testID\}/.test(equipment));
  // The sixth site, the one the census found on glass: the exercise picker row.
  ok('the exercise picker row speaks the exercise NAME',
    // ⚠ NOT MY SLICE, AND IT KILLED THE WHOLE SUITE. This line shipped with
    // R-109 calling `readFileSync`/`join`, neither of which this file imports —
    // it uses the `read()` helper at the top. The suite THREW here on every run
    // since, so the four reds above it were the last thing anybody saw and
    // sections after it never executed at all. Repaired in place because this
    // slice's own accessible-label guards live in it.
    /function ExerciseSheetOption[\s\S]*?accessibilityLabel=\{label\}/.test(
      read('screens/home/DayWorkoutScreenV2.tsx')));
  ok('fixture expanded action exposes the canonical fixture identity',
    /fixtureIngress\('move', day\.workout\.id\)[\s\S]*?accessibilityRole="button"[\s\S]*?accessibilityLabel=\{explorerTestId\.fixtureIngress\('move', day\.workout\.id\)\}/.test(home));
}

console.log(`\nAccessibility wrapper contracts: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log(`\nFailures:\n${failures.map((name) => `  - ${name}`).join('\n')}`);
  process.exit(1);
}
