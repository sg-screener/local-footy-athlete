/**
 * ONE keyboard convention — source-level contracts.
 *
 * Dogfood findings E3 (keyboard covers Continue), E4 (dismiss inconsistency:
 * the name keypad has a tick, the numeric keypad does not), and E7 (the "Done"
 * overlay covering the weight field) are one class of bug, not three screens.
 * The fix is a single owner — avoidance + accessory + dismiss — that every
 * input screen routes through. These tests pin that ownership so the class
 * cannot be reintroduced one screen at a time.
 *
 * The repository ships no native component renderer, so these are source
 * contracts in the same style as accessibilityWrapperContractTests.
 *
 * Run: npm run test:keyboard-convention
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import fs from 'fs';
import path from 'path';

const src = path.resolve(__dirname, '..');
const read = (relative: string) => fs.readFileSync(path.join(src, relative), 'utf8');

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

/** Every .tsx under src, so a new input screen cannot quietly opt out. */
function allComponentFiles(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
        walk(full);
        continue;
      }
      if (entry.name.endsWith('.tsx')) found.push(path.relative(src, full));
    }
  };
  walk(src);
  return found.sort();
}

/** The only files allowed to touch raw keyboard primitives. */
const CONVENTION_OWNERS = [
  'components/keyboard/AppTextInput.tsx',
  'components/keyboard/KeyboardDoneAccessory.tsx',
  'components/keyboard/KeyboardSafeArea.tsx',
];

console.log('\n[1] The convention exists and owns the primitives');
{
  for (const owner of CONVENTION_OWNERS) {
    ok(`${owner} exists`, fs.existsSync(path.join(src, owner)));
  }

  const accessory = fs.existsSync(path.join(src, CONVENTION_OWNERS[1]))
    ? read(CONVENTION_OWNERS[1])
    : '';
  ok(
    'the dismiss affordance is a keyboard-controller toolbar, not a per-input accessory',
    /<KeyboardToolbar/.test(accessory) &&
      /from 'react-native-keyboard-controller'/.test(accessory),
    'E4: the toolbar attaches itself to the focused input on BOTH platforms, so '
      + 'no input needs per-call wiring and none can be forgotten',
  );
  ok(
    'the toolbar offers an explicit Done',
    /doneText="Done"/.test(accessory),
  );

  const input = fs.existsSync(path.join(src, CONVENTION_OWNERS[0]))
    ? read(CONVENTION_OWNERS[0])
    : '';
  ok(
    'AppTextInput gives single-line inputs a submit key',
    /returnKeyType=\{props\.returnKeyType \?\? \(props\.multiline \? undefined : 'done'\)\}/
      .test(input),
    'E4: the inconsistent per-screen submit config is what differed between the '
      + 'name and height/weight screens',
  );
  ok(
    'AppTextInput forwards refs so it is a true drop-in',
    /forwardRef<TextInput, TextInputProps>/.test(input),
  );

  const safeArea = fs.existsSync(path.join(src, CONVENTION_OWNERS[2]))
    ? read(CONVENTION_OWNERS[2])
    : '';
  ok(
    'KeyboardSafeArea owns keyboard avoidance',
    /KeyboardStickyView/.test(safeArea) &&
      /from 'react-native-keyboard-controller'/.test(safeArea),
    'E3: the CTA footer must ride above the keypad. KeyboardStickyView moves it '
      + 'on the UI thread; RN\'s own KeyboardAvoidingView cannot track the '
      + 'keyboard frame reliably on Android',
  );
  ok(
    'KeyboardSafeArea does not stack two avoidance primitives',
    !/<KeyboardAvoidingView[\s>]/.test(safeArea),
    'nesting KeyboardAwareScrollView inside a KeyboardAvoidingView shifted the '
      + 'same content twice and rendered a second, floating Done bar over the '
      + 'screen title (simulator pass, 2026-07-24)',
  );
  ok(
    'KeyboardSafeArea keeps taps working while the keyboard is up',
    /keyboardShouldPersistTaps="handled"/.test(safeArea),
    'E4: tapping Continue must work without first tapping blank space',
  );
  ok(
    'KeyboardSafeArea scrolls the focused input clear of the keypad and the Done bar',
    /KeyboardAwareScrollView/.test(safeArea) && /bottomOffset=/.test(safeArea),
    'E7: the field must stay visible above the keypad AND the bar above it',
  );
  ok(
    'KeyboardSafeArea provides tap-to-dismiss',
    /Keyboard\.dismiss/.test(safeArea),
  );
  ok(
    'KeyboardSafeArea renders the dismiss affordance itself',
    /<KeyboardDoneAccessory \/>/.test(safeArea),
    'one owner renders it once — screens must not have to remember',
  );
  ok(
    'the Done bar and a footer CTA never contend for the same strip',
    /\{footer \? null : <KeyboardDoneAccessory \/>\}/.test(safeArea),
    'rendering both put the toolbar on top of Continue (simulator pass, '
      + '2026-07-24). Where there is a CTA above the keypad, it is the exit.',
  );
}

console.log('\n[2] No screen keeps its own keyboard handling');
{
  const files = allComponentFiles();
  const rawInputOffenders: string[] = [];
  const rawAvoidanceOffenders: string[] = [];
  const rawAccessoryOffenders: string[] = [];

  for (const file of files) {
    if (CONVENTION_OWNERS.includes(file)) continue;
    const source = read(file);
    // Element position only: `useRef<TextInput>` is the RN *type*, which is
    // still the correct ref type for AppTextInput.
    if (/(?<![\w.])<TextInput[\s/>]/.test(source)) rawInputOffenders.push(file);
    if (/<KeyboardAvoidingView[\s>]/.test(source)) rawAvoidanceOffenders.push(file);
    if (/<KeyboardAwareScrollView[\s>]/.test(source)) rawAvoidanceOffenders.push(file);
    // KeyboardStickyView is intentionally NOT scanned: CoachScreen's message
    // composer uses one directly and predates this convention. It is a narrower
    // primitive than an avoidance container, and migrating that composer is out
    // of this unit's scope — recorded in the unit report's NOT-COVERED.
    if (/<InputAccessoryView[\s>]/.test(source) || /<KeyboardToolbar[\s>]/.test(source)) {
      rawAccessoryOffenders.push(file);
    }
  }

  ok(
    'no screen renders a raw TextInput',
    rawInputOffenders.length === 0,
    `raw <TextInput> outside the convention: ${rawInputOffenders.join(', ')}`,
  );
  ok(
    'no screen renders its own KeyboardAvoidingView',
    rawAvoidanceOffenders.length === 0,
    `per-screen avoidance still present: ${rawAvoidanceOffenders.join(', ')}`,
  );
  ok(
    'no screen renders its own dismiss affordance',
    rawAccessoryOffenders.length === 0,
    `per-screen accessory/toolbar still present: ${rawAccessoryOffenders.join(', ')}`,
  );
}

console.log('\n[3] The onboarding shell is keyboard-safe by default (E3)');
{
  const layout = read('components/onboarding/OnboardingLayout.tsx');
  ok(
    'OnboardingLayout has no opt-in keyboard flag',
    !/keyboardAvoiding/.test(layout),
    'E3 happened because Name and BodyMeasurements never opted in — remove the opt-in',
  );
  ok(
    'OnboardingLayout routes through the shared keyboard owner',
    /KeyboardSafeArea/.test(layout),
  );
  ok(
    'the Continue footer rides above the keyboard',
    /KeyboardSafeArea[\s\S]*footer/.test(layout),
    'E3: the CTA must be inside the avoided region, not below it',
  );
}

console.log('\n[4] Every onboarding text step uses the convention');
{
  const inputScreens = [
    'screens/onboarding/NameScreen.tsx',
    'screens/onboarding/BodyMeasurementsScreen.tsx',
    'screens/onboarding/MotivationScreen.tsx',
    'screens/onboarding/InjuriesScreen.tsx',
  ];
  for (const screen of inputScreens) {
    const source = read(screen);
    ok(`${path.basename(screen)} uses AppTextInput`, /<AppTextInput[\s>]/.test(source));
    ok(
      `${path.basename(screen)} renders no raw TextInput`,
      !/(?<![\w.])<TextInput[\s/>]/.test(source),
    );
  }
}

const total = passed + failures.length;
console.log(`\nKeyboard convention totals: passed=${passed}/${total} failures=${failures.length}`);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
