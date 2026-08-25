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


import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
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
    'the dismiss affordance is a custom flush bar, NOT the OS floating toolbar',
    !/<KeyboardToolbar/.test(accessory) &&
      /KeyboardStickyView/.test(accessory) &&
      /from 'react-native-keyboard-controller'/.test(accessory),
    "Sam ruling (L10 run 2): no floating pill — a flush, full-width Done bar on "
      + 'every iOS version. KeyboardToolbar floats on iOS 26+, which read as a gap.',
  );
  ok(
    'the bar dismisses the keyboard',
    /KeyboardController\.dismiss\(\)/.test(accessory),
  );
  ok(
    'the bar offers an explicit Done label',
    /doneText\s*=\s*'Done'|>Done</.test(accessory) || /'Done'/.test(accessory),
  );
  ok(
    'the bar only mounts while the keyboard is visible (never at rest)',
    /useKeyboardState/.test(accessory) && /isVisible/.test(accessory),
  );
  ok(
    'the bar sits flush at the keyboard top (no opened-offset gap)',
    /opened:\s*0/.test(accessory),
    'a full-width bar with zero opened offset attaches to the keypad with no gap',
  );

  const input = fs.existsSync(path.join(src, CONVENTION_OWNERS[0]))
    ? read(CONVENTION_OWNERS[0])
    : '';
  ok(
    'AppTextInput gives single-line, non-keypad inputs a submit key',
    /returnKeyType=\{props\.returnKeyType \?\? defaultReturnKeyType\}/.test(input) &&
      /props\.multiline \|\| isKeypad \? undefined : 'done'/.test(input),
    'E4: text keyboards keep their Done submit key; the inconsistent per-screen '
      + 'submit config is what differed between the name and height/weight screens',
  );
  ok(
    'AppTextInput requests NO returnKeyType on keyless keypad keyboards (run-4 pill)',
    /const isKeypad =/.test(input) &&
      /keyboardType/.test(input) &&
      /'number-pad'/.test(input) &&
      /'numeric'/.test(input) &&
      /'decimal-pad'/.test(input) &&
      /'phone-pad'/.test(input),
    'iOS 26 floats a rounded "Done" pill above the keypad whenever a returnKeyType '
      + 'is set on a keyboard with no return key (verified: bare number-pad shows no '
      + 'pill; +returnKeyType=done shows it). Keypad types must default to none — the '
      + 'same float KeyboardDoneAccessory was hand-rolled to avoid',
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
    // RE-ANCHORED 2026-08-26: the background tap-to-dismiss is DELETED —
    // measured fatal twice (permanent wrapper killed scroll; conditional
    // wrapper reparented the focused input and locked Sam's phone in a
    // keyboard loop on the first Release build). Dismissal's two owners are
    // the scroll view's interactive drag and the Done accessory; this cell
    // now holds the drag half.
    'KeyboardSafeArea dismisses via the scroll view\'s interactive drag',
    /keyboardDismissMode="interactive"/.test(safeArea),
  );
  ok(
    'KeyboardSafeArea renders the dismiss affordance itself',
    /<KeyboardDoneAccessory \/>/.test(safeArea),
    'one owner renders it once — screens must not have to remember',
  );
  ok(
    'the Done bar and a footer CTA never contend for the same strip',
    /\{footer \|\| !hasTextInput \? null : <KeyboardDoneAccessory \/>\}/.test(safeArea),
    'rendering both put the toolbar on top of Continue (simulator pass, '
      + '2026-07-24). Where there is a CTA above the keypad, it is the exit. '
      + 'A screen with no text input also falls through to null (L10).',
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
  ];
  for (const screen of inputScreens) {
    const source = read(screen);
    ok(`${path.basename(screen)} uses AppTextInput`, /<AppTextInput[\s>]/.test(source));
    ok(
      `${path.basename(screen)} renders no raw TextInput`,
      !/(?<![\w.])<TextInput[\s/>]/.test(source),
    );
  }
  const injurySetup = read('screens/onboarding/InjuriesScreen.tsx');
  ok('InjuriesScreen is selection-only and renders no text input',
    !/<AppTextInput[\s>]/.test(injurySetup)
      && !/(?<![\w.])<TextInput[\s/>]/.test(injurySetup));
}

console.log('\n[5] The Done bar only mounts where a keyboard can be raised (L10)');
{
  // L10 device finding, 2026-07-24: the "Done" bar appeared on a selection-only
  // step (an auto-advance question with no text input). A screen with no input
  // never raises a keyboard, so it must never mount the dismiss affordance.
  const safeArea = read('components/keyboard/KeyboardSafeArea.tsx');
  ok(
    'KeyboardSafeArea takes a hasTextInput signal',
    /hasTextInput/.test(safeArea),
    'the owner cannot introspect its children for inputs, so the caller declares it',
  );
  ok(
    'the Done accessory is gated on both no-footer AND hasTextInput',
    /\{footer \|\| !hasTextInput \? null : <KeyboardDoneAccessory \/>\}/.test(safeArea),
    'a selection-only screen (no input, no footer) must fall through to null, not the toolbar',
  );

  const layout = read('components/onboarding/OnboardingLayout.tsx');
  ok(
    'OnboardingLayout tells the owner an auto-advance step has no text input',
    /hasTextInput=\{!hideFooter\}/.test(layout),
    'auto-advance (hideFooter) steps are selection-only — no keypad, so no Done bar',
  );
}

console.log('\n[6] The Continue footer rides flush on the keypad (run-3 device finding)');
{
  // Run-3 device truth: the Continue CTA sat ~1 bottom-safe-area-inset ABOVE the
  // keypad. Cause (verified in source): OnboardingLayout's outer SafeAreaView had
  // no `edges` prop, so it applied the bottom inset as STATIC padding; the footer
  // rides KeyboardStickyView, whose transform lifts it by the FULL keyboard height
  // measured from the true screen bottom. Resting already one inset up, it overshot
  // the keypad top by exactly that inset. Sam ruling (run 3): the CTA rides flush on
  // the keypad, zero gap. The inset must be owned by the footer and COLLAPSE while
  // the keyboard is up (the keypad then covers the home-indicator zone anyway), so
  // opened:0 on the sticky footer is genuinely flush because the footer now rests at
  // the true screen bottom. Keyboard-LIFT stays owned by KeyboardSafeArea; the
  // safe-area INSET is owned by the onboarding shell — two different concerns.
  const layout = read('components/onboarding/OnboardingLayout.tsx');
  ok(
    'OnboardingLayout SafeAreaView drops the bottom edge so the footer reaches the keypad',
    /edges=\{\['top', 'left', 'right'\]\}/.test(layout),
    'a static bottom inset on the outer SafeAreaView is exactly what the sticky '
      + 'footer overshot — the footer, not the shell, must own the bottom inset',
  );
  ok(
    'the Continue footer owns the bottom safe-area inset',
    /useSafeAreaInsets/.test(layout) &&
      /Math\.max\(insets\.bottom/.test(layout),
    'rest: the CTA clears the home indicator (paddingBottom = insets.bottom); '
      + 'keyboard up: the inset collapses to 0 so the CTA rides flush on the keypad',
  );
}

console.log(
  '\n[6b] The footer inset collapses on the SAME animated keyboard clock as the ' +
    'sticky lift (run-4 device finding — no overshoot/bounce)',
);
{
  // Run-4 device truth: on keyboard APPEAR the Continue CTA overshoots ABOVE the
  // keypad, then settles. Cause (verified in source + on iOS 26.3 sim): the inset
  // collapse was driven by a BOOLEAN keyboard-visible flag (useKeyboardState), so
  // paddingBottom snapped insets.bottom -> 0 in a single discrete step, while the
  // footer's KeyboardStickyView transform lifts CONTINUOUSLY over the open
  // animation. A discrete padding change racing a continuous lift is the bounce.
  // Fix: drive the inset from the SAME reanimated keyboard progress the sticky
  // view rides, so the CTA collapses its inset and lifts as one motion.
  const layout = read('components/onboarding/OnboardingLayout.tsx');
  ok(
    'the footer inset is driven by the reanimated keyboard progress, not a boolean',
    /useReanimatedKeyboardAnimation/.test(layout) &&
      /useAnimatedStyle/.test(layout) &&
      /paddingBottom:[^\n]*keyboardProgress\.value/.test(layout),
    'the inset must interpolate on the continuous keyboard progress (0..1) that '
      + 'KeyboardStickyView also rides, so it collapses in lockstep with the lift',
  );
  ok(
    'the footer inset is NOT snapped by a discrete keyboard-visible boolean',
    !/paddingBottom:[^\n]*keyboardVisible/.test(layout) &&
      !/keyboardVisible \? 0 :/.test(layout),
    'a boolean-gated paddingBottom snaps in one step and races the continuous '
      + 'sticky lift — exactly the run-4 overshoot; it must not reappear',
  );
}

console.log(
  '\n[6c] The CTA keeps a small breathing gap above the keypad (run-5 Sam polish)',
);
{
  // Run-5 device truth: fully flush read TOO TIGHT — the Continue button and the
  // keypad became one undifferentiated slab. Sam ruling: keep a small fixed
  // breathing gap between the CTA and the keypad. It is a floor on the SAME
  // animated inset, not a second offset: the footer still interpolates on the
  // reanimated keyboard progress ([6b]), it just lands on the gap instead of 0.
  // Zero would be flush again; a resting-inset-sized value is the run-3 bug.
  const layout = read('components/onboarding/OnboardingLayout.tsx');
  ok(
    'the breathing gap is a named constant, not an inline magic number',
    /KEYBOARD_BREATHING_GAP\s*=\s*8\b/.test(layout),
    'Sam asked for ~8px; naming it keeps the CTA/keypad relationship reviewable',
  );
  ok(
    'the keyboard-open inset lands on the breathing gap, not flush on 0',
    /paddingBottom:[^\n]*KEYBOARD_BREATHING_GAP/.test(layout),
    'the gap must be the keyboard-up terminus of the animated paddingBottom',
  );
  ok(
    'the gap still rides the same reanimated keyboard progress (no new clock)',
    /paddingBottom:[^\n]*keyboardProgress\.value/.test(layout),
    'a separately-clocked gap would reintroduce the run-4 overshoot',
  );
  ok(
    'at rest the CTA still clears the home indicator by the full safe-area inset',
    /restingBottomInset/.test(layout) && /Math\.max\(insets\.bottom/.test(layout),
    'the gap is a keyboard-up floor; it must not shrink the resting clearance',
  );
}

const total = passed + failures.length;
console.log(`\nKeyboard convention totals: passed=${passed}/${total} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
