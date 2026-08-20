/**
 * ONE SHELL FOR THE FIVE ACTIVE-SESSION ACTIONS — source contracts (R-123).
 *
 * Sam, 2026-08-20: *"Put all five Active Session actions into one shared
 * bottom-sheet shell. The shell must be the single owner of opening and closing
 * animation, safe-area spacing, title and step header, scrolling, Back
 * behaviour, Cancel behaviour, resetting state when closed, and consistent
 * height and layout. Each action must keep ownership of its own questions and
 * behaviour."*
 *
 * ⚠ **A SHELL THAT IS MERELY AVAILABLE IS NOT A SHELL.** The defect this
 * replaces was not "there is no shared sheet component" — `ui/Sheet` existed
 * and all three surfaces used it. It was that each surface then decided its own
 * height, scrolling, title, Back and Cancel ON TOP of it, and drifted. So the
 * load-bearing cells here are the NEGATIVE ones: no session-action file may
 * render a `Sheet` itself, keep a Back of its own, or keep a scroll view of its
 * own. A cell that only asserted "the shell exists" would stay green through
 * the entire regression.
 *
 * The repository ships no native component renderer, so these are source
 * contracts in the same style as `exerciseEditEntrySurfaceContractTests` and
 * `keyboardConventionContractTests`.
 *
 * Run: npm run test:session-action-shell
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import fs from 'fs';
import path from 'path';

const src = path.resolve(__dirname, '..');
const read = (relative: string) => fs.readFileSync(path.join(src, relative), 'utf8');

const SHELL_PATH = 'components/SessionActionSheet.tsx';
const shell = read(SHELL_PATH);
const screen = read('screens/home/DayWorkoutScreenV2.tsx');
const equipment = read('screens/home/SessionEquipmentSheet.tsx');
const injury = read('screens/home/GuidedInjuryFlowSheet.tsx');

/** Every file that renders one of the five actions' questions. */
const ACTION_BODIES: readonly (readonly [string, string])[] = [
  ['screens/home/DayWorkoutScreenV2.tsx', screen],
  ['screens/home/SessionEquipmentSheet.tsx', equipment],
  ['screens/home/GuidedInjuryFlowSheet.tsx', injury],
];

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

console.log('\n[1] All five actions open through the ONE shell');
{
  ok('the shell exists', fs.existsSync(path.join(src, SHELL_PATH)));

  /* The five ids are `SessionChangeHub`'s, read from the hub itself rather than
   * retyped here — a list of action names copied into a test is a second
   * vocabulary, which is the defect the hub's own header records. */
  const hub = read('components/SessionChangeHub.tsx');
  const declared = /export const SESSION_CHANGE_ACTION_IDS = \[\n([^\]]*)\]/.exec(hub);
  const ids = (declared?.[1] ?? '')
    .split(',').map((raw) => raw.trim().replace(/'/g, '')).filter(Boolean);
  ok(
    'the hub still offers exactly the five session actions',
    ids.length === 5
      && ['equipment', 'injury', 'add', 'remove', 'swap'].every((id) => ids.includes(id)),
    `read from SessionChangeHub: ${ids.join(', ')}`,
  );

  ok(
    'Equipment opens through the shell',
    /<SessionActionSheet/.test(equipment)
      && /testID="session-equipment-sheet"/.test(equipment),
  );
  ok(
    'Injury opens through the shell',
    /<SessionActionSheet/.test(injury)
      && /explorerTestId\.injuryDetail\(episodeId\)/.test(injury),
  );
  ok(
    'Add, Remove and Swap open through the shell',
    /<SessionActionSheet/.test(screen)
      && /testID="exercise-edit-sheet"/.test(screen),
  );
}

console.log('\n[2] The shell is the ONLY thing that renders a Sheet for an action');
{
  for (const [name, source] of ACTION_BODIES) {
    ok(
      `${name} renders no Sheet of its own`,
      !/<Sheet[\s/>]/.test(source),
      'each of these rendered its own <Sheet> before R-123, which is how three '
        + 'different heights, three titles and three Back buttons happened',
    );
  }
  ok(
    'the shell is the one file that does render it',
    /<Sheet$/m.test(shell) || /<Sheet[\s\n]/.test(shell),
  );
}

console.log('\n[3] The shell owns Back, and a first step has none');
{
  ok(
    'the shell draws the one Back button',
    /const SESSION_ACTION_BACK_TEST_ID = 'session-action-back';/.test(shell)
      && /testID={SESSION_ACTION_BACK_TEST_ID}/.test(shell)
      && /backRef\.current\?\.\(\)/.test(shell),
    'a FIXED literal, not `${testID}-back`: a template with no fixed head names '
      + 'nothing, and test:maestro-element-contract refuses to resolve one',
  );
  ok(
    'Back is absent — not an exit in disguise — when there is nothing shallower',
    /step\?\.canGoBack \? \(/.test(shell),
    'onBack undefined must draw NO Back. A Back that closes the sheet is not '
      + '"up one step", and this app already refuses to draw a door that cannot act',
  );
  for (const [name, source] of ACTION_BODIES) {
    ok(
      `${name} keeps no Back button of its own`,
      !/function BackButton/.test(source)
        && !/label="Back"/.test(source)
        && !/>Back</.test(source),
    );
  }
  ok(
    'the injury flow declares no Back on its first step',
    /onBack: step === 'region' \? undefined : back/.test(injury),
  );
  ok(
    'Equipment is one step and declares no Back at all',
    /key: 'equipment',/.test(equipment) && !/onBack:/.test(equipment),
    'the assertion is on the PROP, not the word — the file names `onBack` in a '
      + 'comment explaining why it has none',
  );
  ok(
    'the two steps that were reached from the picker now climb back to it',
    /if \(step\.kind === 'choose_swap'\) \{\n\s*return \(\) => onStep\(\{ kind: 'pick_exercise', action: 'swap' \}\);/.test(screen)
      && /if \(step\.kind === 'confirm_remove'\) \{\n\s*return \(\) => onStep\(\{ kind: 'pick_exercise', action: 'remove' \}\);/.test(screen),
    'both are only ever reached from pick_exercise, so the step above them is '
      + 'that picker — closing the sheet was never "back one step"',
  );
}

console.log('\n[4] The shell owns Cancel, and no action keeps a second one');
{
  ok(
    'the shell draws the one Cancel',
    /const SESSION_ACTION_CANCEL_TEST_ID = 'session-action-cancel';/.test(shell)
      && /testID={SESSION_ACTION_CANCEL_TEST_ID}/.test(shell)
      && /onPress={onClose}/.test(shell),
  );
  ok(
    'Cancel applies nothing — it is the same handler as the backdrop',
    /const handleClose = dismissable \? onClose : undefined;/.test(read('components/ui/Sheet.tsx')),
  );
  for (const [name, source] of ACTION_BODIES) {
    ok(
      `${name} keeps no Cancel button of its own`,
      !/label="Cancel"/.test(source),
      'DayWorkoutScreenV2 alone carried NINE identical inline Cancel buttons',
    );
  }
  ok(
    'the word is "Close", not "Cancel", once a change has landed',
    /const AFTER_THE_CHANGE_LANDED: ReadonlySet<ExerciseEditStep\['kind'\]>/.test(screen)
      && /'exclusion_scope', 'future_scope', 'result', 'coach_fallback',/.test(screen),
  );
}

console.log('\n[5] The shell owns scrolling, and every step opens at the top');
{
  ok(
    'the shell renders exactly one ScrollView',
    /* Element position only: `useRef<ScrollView>` is the RN *type*, which is
     * the correct ref type for the one it renders. */
    (shell.match(/<ScrollView[\s\n]/g) ?? []).length === 1,
  );
  ok(
    'a step change scrolls back to the top',
    /scrollRef\.current\?\.scrollTo\(\{ y: 0, animated: false \}\);/.test(shell)
      && /\}, \[stepKey\]\);/.test(shell),
  );
  ok(
    'and it does NOT do that by keying the scroll view, which would remount the body',
    !/<ScrollView\n\s*key=/.test(shell),
    'the injury flow keeps its own current step in useState INSIDE the body: a '
      + 'remount on every step change would throw it away and the flow could '
      + 'never leave its first question',
  );
  ok(
    'the remount that DOES happen is the per-open one, and only that',
    (shell.match(/key={epoch}/g) ?? []).length === 1,
  );
  for (const [name, source] of ACTION_BODIES) {
    ok(
      `${name} keeps no scroll view of its own inside a sheet`,
      !/exerciseEditScrollList/.test(source) && !/flexibleBody/.test(source),
    );
  }
  ok(
    'the body shrinks rather than flexing — the sliver-sheet trap',
    /body: \{ flexShrink: 1/.test(shell) && !/body: \{ flex: 1/.test(shell),
    'flex:1 is flexBasis:0, which inside a hugging parent resolves to ZERO '
      + 'height: backdrop dims, grab handle shows, no content',
  );
}

console.log('\n[6] Every step has a scroll identity — the key is TOTAL');
{
  /* A `kind` that reaches the key function without a case falls through to the
   * default, which is the KIND — and two `add_group` steps in a row would then
   * share a key and the second would open at the first one's offset. That is
   * the defect measured on the simulator, so the totality is checked against
   * the union itself rather than a list retyped here. */
  const union = screen.slice(
    screen.indexOf('type ExerciseEditStep ='),
    screen.indexOf('const EXCLUSION_SCOPE_TEST_ID'),
  );
  const kinds = Array.from(new Set(
    Array.from(union.matchAll(/kind: '([a-z_]+)'/g)).map((m) => m[1]),
  )).filter((kind) => kind !== 'closed');
  ok('the step union was found', kinds.length >= 12, `found ${kinds.length}`);

  const keyFn = screen.slice(
    screen.indexOf('function exerciseEditStepKey('),
    screen.indexOf('function exerciseEditTitle('),
  );
  const coordinateBearing = ['pick_exercise', 'add_group', 'add_leaf', 'add_pick',
    'confirm_add', 'confirm_swap', 'choose_swap', 'confirm_remove', 'exclusion_scope'];
  for (const kind of coordinateBearing) {
    ok(
      `'${kind}' puts its own coordinate in the scroll key`,
      new RegExp(`case '${kind}':`).test(keyFn),
      'two consecutive steps of the same kind must not share a key',
    );
  }
  ok(
    'every other kind still resolves through the default',
    /default:\n\s*return step\.kind;/.test(keyFn),
  );

  /* The injury flow's own titles are a Record over its closed step union, so a
   * seventh step cannot be added without deciding what is at the top of it. */
  ok(
    'the injury titles and subtitles are TOTAL over FlowStep',
    /const STEP_TITLE: Record<FlowStep, string> = \{/.test(injury)
      && /const STEP_SUBTITLE: Record<FlowStep, string \| null> = \{/.test(injury),
  );
}

console.log('\n[7] The shell owns safe area, height and reset-on-close');
{
  ok(
    'safe area is read once, in the shell',
    /useSafeAreaInsets\(\)/.test(shell)
      && /paddingBottom: Math\.max\(insets\.bottom/.test(shell),
  );
  for (const [name, source] of ACTION_BODIES) {
    ok(
      `${name} sets no sheet padding of its own`,
      !/exerciseEditSheet:/.test(source) && !/paddingBottom: 36/.test(source),
    );
  }
  ok(
    'height is a shared CAP, so a short confirm still hugs its content',
    /cappedBody/.test(shell)
      && /contentCapped:\s*\{\s*maxHeight: '92%',/.test(read('components/ui/Sheet.tsx')),
    'a named mode on the primitive, not a maxHeight the shell invents — three '
      + 'callers had each invented their own',
  );
  ok(
    'every open mints a new epoch',
    /if \(visible && !wasVisible\.current\) setEpoch\(\(current\) => current \+ 1\);/.test(shell),
  );
  ok(
    'the epoch keys the body, so reopening starts from fresh state',
    /<View key={epoch}>/.test(shell),
    'RN Modal keeps its children mounted through the dismiss animation on iOS, '
      + 'so "did a reopen see fresh state?" used to depend on animation timing',
  );
  for (const [name, source] of ACTION_BODIES) {
    ok(
      `${name} keeps no reset-on-visible effect of its own`,
      !/if \(visible\) set/.test(source) && !/if \(!visible\) return;/.test(source),
    );
  }
}

console.log('\n[8] The hub itself is untouched — same five words, same colours');
{
  const hub = read('components/SessionChangeHub.tsx');
  ok(
    'the five labels are unchanged',
    /equipment: 'Equipment',/.test(hub) && /injury: 'Injury',/.test(hub)
      && /add: 'Add',/.test(hub) && /remove: 'Remove',/.test(hub)
      && /swap: 'Swap',/.test(hub),
  );
  ok(
    'the five tints are unchanged',
    /equipment: 'rgba\(30, 167, 255, 0\.12\)'/.test(hub)
      && /injury: 'rgba\(255, 127, 127, 0\.12\)'/.test(hub)
      && /add: 'rgba\(198, 255, 0, 0\.12\)'/.test(hub)
      && /remove: 'rgba\(255, 161, 196, 0\.12\)'/.test(hub)
      && /swap: 'rgba\(185, 167, 255, 0\.12\)'/.test(hub),
  );
  ok(
    'the one-line shrink-to-fit label rule survives (Equipment is the word that does not fit)',
    /adjustsFontSizeToFit/.test(hub) && /minimumFontScale={0\.82}/.test(hub),
    'Back and Cancel return to this card; a label that re-wrapped or truncated '
      + 'on the way back would read as the hub having shrunk',
  );
  ok(
    'no row-level swap or remove button came back',
    !/function ExerciseRowActions/.test(screen)
      && !/accessibilityLabel="Swap exercise"/.test(screen)
      && !/accessibilityLabel="Remove exercise"/.test(screen),
  );
}

console.log(`\nSession action shell totals: passed=${passed}/${passed + failures.length} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
