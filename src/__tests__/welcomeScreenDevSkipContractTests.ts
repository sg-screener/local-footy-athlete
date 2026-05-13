/**
 * Welcome screen dev-skip Pressable contract tests.
 *
 * The earlier failure mode: Maestro's `tapOn: id: onboarding-dev-skip-button`
 * reported COMPLETED but `runDevOnboardingSkip` never fired — no
 * `[dev-skip] started` log. Root cause: subtle disconnects between the
 * testID-bearing element and the element actually owning onPress.
 *
 * This test reads the WelcomeScreen source and asserts the wiring is
 * exactly right at the syntactic level so the contract cannot regress
 * without the test screaming.
 *
 * It's a deliberately *static* test — no React renderer needed, so it
 * runs in sucrase-node like the rest of our test suite. The dev-skip
 * Pressable is small enough that string assertions reliably prove the
 * shape we want.
 *
 * Run: npm run test:welcome-dev-skip-contract
 */

import fs from 'fs';
import path from 'path';

const WELCOME_SRC = path.resolve(
  __dirname,
  '..',
  'screens',
  'onboarding',
  'WelcomeScreen.tsx',
);

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    failures.push(name + (detail ? `\n      ${detail}` : ''));
    console.log(`  ✗ ${name}${detail ? '\n      ' + detail : ''}`);
  }
}

function section(label: string) {
  console.log(`\n${label}`);
}

const src = fs.readFileSync(WELCOME_SRC, 'utf8');

// Helper: extract the JSX block for the dev-skip Pressable. We slice from
// `testID="onboarding-dev-skip-button"` outward to the closing `</Pressable>`
// so subsequent regex assertions only look at the relevant element.
function getDevSkipPressableBlock(): string {
  const testIdIdx = src.indexOf('testID="onboarding-dev-skip-button"');
  if (testIdIdx < 0) return '';
  // Walk backward to the opening `<Pressable`
  const openIdx = src.lastIndexOf('<Pressable', testIdIdx);
  if (openIdx < 0) return '';
  // Walk forward to the matching closing `</Pressable>`.
  const closeIdx = src.indexOf('</Pressable>', testIdIdx);
  if (closeIdx < 0) return '';
  return src.slice(openIdx, closeIdx + '</Pressable>'.length);
}

section('[1] WelcomeScreen imports runDevOnboardingSkip directly');
{
  ok(
    'imports runDevOnboardingSkip from utils/devOnboardingSkip',
    /from\s+['"][^'"]*utils\/devOnboardingSkip['"]/.test(src) &&
      /runDevOnboardingSkip/.test(src),
    'expected an import of runDevOnboardingSkip from utils/devOnboardingSkip',
  );
}

section('[2] dev-skip Pressable contract');
{
  const block = getDevSkipPressableBlock();
  ok(
    'a <Pressable> with testID="onboarding-dev-skip-button" exists',
    block.length > 0,
    'could not locate the dev-skip Pressable in WelcomeScreen.tsx',
  );

  if (block.length > 0) {
    ok(
      'testID is on the Pressable, not a child',
      /<Pressable[\s\S]*?testID="onboarding-dev-skip-button"/.test(block),
      'testID must appear inside the opening <Pressable …> attributes block',
    );

    ok(
      'accessibilityLabel matches testID (Maestro a11y fallback)',
      /accessibilityLabel="onboarding-dev-skip-button"/.test(block),
      'accessibilityLabel must equal "onboarding-dev-skip-button" — Maestro can fall back to the a11y label, and identical strings make both finders converge.',
    );

    ok(
      'accessibilityRole="button"',
      /accessibilityRole="button"/.test(block),
      'role makes the element discoverable in the a11y tree',
    );

    ok(
      'onPress is bound to handleDevSkipSetup',
      /onPress=\{handleDevSkipSetup\}/.test(block),
      'onPress must reference the handler that calls runDevOnboardingSkip — no inline wrappers or no-op shims',
    );

    ok(
      'no disabled prop gates the press',
      !/\sdisabled=\{/.test(block),
      'A `disabled` prop turns onPress into a silent no-op while Maestro still sees the element and reports COMPLETED. Style the in-flight state via style only, not via disabled.',
    );

    ok(
      'visible static text contains "Skip onboarding (dev)"',
      /Skip onboarding \(dev\)/.test(block),
      'Maestro can fall back to text matching; the static, non-conditional label must contain this string verbatim.',
    );
  }
}

section('[3] handler calls runDevOnboardingSkip and logs first');
{
  // We isolate the body of handleDevSkipSetup to keep assertions tight.
  const handlerStart = src.indexOf('const handleDevSkipSetup');
  ok(
    'handleDevSkipSetup is declared',
    handlerStart >= 0,
    'expected `const handleDevSkipSetup = async () => { … }` in WelcomeScreen',
  );

  if (handlerStart >= 0) {
    // Find the matching closing brace. Heuristic: the next top-level "};"
    // after the declaration that sits at column 0–2 spaces (function-scope
    // body). Fall back to the next 800 chars if heuristic misses — that's
    // plenty to cover the handler and never wide enough to pull in another
    // top-level fn.
    const fenceIdx = src.indexOf('\n  };', handlerStart);
    const body = src.slice(
      handlerStart,
      fenceIdx > 0 ? fenceIdx + 4 : handlerStart + 800,
    );

    ok(
      'handler logs press at top BEFORE any guard returns',
      /logger\.info\(['"]\[dev-skip\] press handler invoked['"]\)/.test(body) &&
        body.indexOf("logger.info('[dev-skip] press handler invoked')") <
          body.indexOf('return'),
      'A top-of-handler `logger.info("[dev-skip] press handler invoked")` is required so we can prove from the simulator log that the press actually fired — even if a state guard short-circuits later.',
    );

    ok(
      'handler awaits runDevOnboardingSkip',
      /await\s+runDevOnboardingSkip\s*\(/.test(body),
      'handler body must call runDevOnboardingSkip directly, not via an intermediary',
    );
  }
}

console.log(`\n— Summary —`);
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);
if (fail > 0) {
  console.log(`\n— Failures —`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
process.exit(0);
