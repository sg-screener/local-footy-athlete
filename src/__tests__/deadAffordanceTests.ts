/**
 * `LAW-L5-no-dead-affordances` — *"Every visible control either works or does
 * not ship."*
 *
 * SEAT_INBOX item 13 names this one of the FOUR unenforced laws that change what
 * the athlete SEES, and this session is why it is worth holding: My Status shipped
 * **seven controls that looked live and did nothing**, under a caption pointing
 * at a screen that no longer showed them; and a refused plan change shipped one
 * button labelled `OK` while the finding underneath already said the athlete was
 * allowed to proceed. Both are fixed. Neither was caught by anything.
 *
 * ## WHAT THIS GATE HOLDS, AND IT IS ONE SHAPE OF THE LAW, NOT THE LAW
 *
 * The registry's `wouldTake` for L5 asks for *"a walker pass that taps every
 * reachable control and asserts a state change or an explicit refusal"*. That is
 * the full instrument and it is not built.
 *
 * This is the DECIDABLE shape: **a control whose press provably does nothing,
 * and a control that is permanently disabled.** No intent, no heuristics — an
 * empty arrow body is empty in every world.
 *
 * ## WHY AN ALLOW-LIST AND NOT A BAN
 *
 * Measured 2026-08-12: two `onPress={() => {}}` exist and **both are correct**.
 * A `Pressable` wrapping a modal's content with an empty press is the standard
 * way to stop a tap reaching the dismiss layer behind it — it is not an
 * affordance at all, it is a shield. Banning the shape outright would force a
 * worse workaround; so the rule is that a no-op press must **DECLARE ITSELF**,
 * with a reason, here. A new one appears as a red with a question attached.
 *
 * Run: npm run test:dead-affordances
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import fs from 'fs';
import path from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

const repoRoot = path.join(__dirname, '..', '..');

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

function run(name: string, body: () => void): void {
  try {
    body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failed += 1;
    failures.push(name);
    console.error(`  FAIL ${name}\n      ${(error as Error)?.message ?? String(error)}`);
  }
}

/**
 * THE ONLY PRESSES ALLOWED TO DO NOTHING, EACH WITH ITS REASON.
 *
 * **This list may only shrink by deletion, never grow by habit.** Adding a line
 * is a claim that a visible control doing nothing is correct, and that claim has
 * to survive being written down next to the law it is an exception to.
 */
const DECLARED_INERT_PRESSES: readonly { file: string; why: string }[] = [
  {
    file: 'src/components/ExerciseVideoModal.tsx',
    why: 'A SHIELD, NOT A CONTROL. The outer Pressable is the dismiss layer; this '
      + 'inner one wraps the modal content so a tap on the video does not reach '
      + 'it and close the modal. Nothing here looks tappable to an athlete.',
  },
  {
    file: 'src/components/dev/ScheduleDebugPanel.tsx',
    why: 'A DEV SURFACE. Never mounted on an athlete-facing screen; L5 governs '
      + 'what SHIPS to an athlete. If this panel ever becomes reachable in a '
      + 'release build, this line is the thing that should stop it.',
  },
];

interface Source { readonly file: string; readonly code: string }

function screenSources(): Source[] {
  const out: Source[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
        walk(full);
        continue;
      }
      // `.tsx` only: a control is rendered, and a control lives in JSX.
      if (!/\.tsx$/.test(entry.name)) continue;
      out.push({ file: path.relative(repoRoot, full), code: fs.readFileSync(full, 'utf8') });
    }
  };
  walk(path.join(repoRoot, 'src'));
  return out;
}

/** Pure: presses in this source that provably do nothing. */
export function inertPresses(code: string): string[] {
  const found: string[] = [];
  for (const match of code.matchAll(/onPress=\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}/g)) {
    found.push(match[0]);
  }
  for (const match of code.matchAll(/onPress=\{\s*undefined\s*\}/g)) found.push(match[0]);
  return found;
}

/** Pure: controls disabled by a literal, which no state can ever re-enable. */
export function permanentlyDisabled(code: string): string[] {
  return Array.from(code.matchAll(/disabled=\{\s*true\s*\}/g)).map((match) => match[0]);
}

const sources = screenSources();

// ── [0] THE INSTRUMENT REACHED THE SCREENS ────────────────────────────────

run('the scan reached the screen tree', () => {
  assert(sources.length > 30,
    `only ${sources.length} .tsx sources walked — the walker is not reaching the `
    + 'screens and every assertion below is over nothing');
  const withPress = sources.filter((source) => /onPress=/.test(source.code)).length;
  assert(withPress > 10,
    `only ${withPress} sources contain an \`onPress=\` at all. The shape this `
    + 'gate matches has changed, and a gate that matches nothing passes forever.');
});

// ── [1] A PRESS THAT DOES NOTHING MUST SAY SO ─────────────────────────────

run('no undeclared control does nothing when pressed', () => {
  const declared = new Set(DECLARED_INERT_PRESSES.map((entry) => entry.file));
  const undeclared = sources
    .filter((source) => inertPresses(source.code).length > 0)
    .filter((source) => !declared.has(source.file))
    .map((source) => source.file);
  assert(undeclared.length === 0,
    `${undeclared.join(', ')} renders a control whose press provably does `
    + 'nothing. L5: every visible control either works or does not ship. If it '
    + 'is a SHIELD rather than a control — a tap-swallow over a dismiss layer — '
    + 'declare it in DECLARED_INERT_PRESSES with that reason; if it is a real '
    + 'control, wire it or delete it. Adding a line to that list is a claim, '
    + 'and it has to survive being written next to the law.');
});

// ── [2] AND THE DECLARED LIST MAY NOT OVERSTATE ITSELF ────────────────────
//
// The other direction: a declaration for a file that no longer has an inert
// press makes the exception list look bigger than it is, and the next reader
// treats a stale exemption as precedent.

run('every declared exception still exists', () => {
  const stale = DECLARED_INERT_PRESSES
    .filter((entry) => {
      const source = sources.find((candidate) => candidate.file === entry.file);
      return !source || inertPresses(source.code).length === 0;
    })
    .map((entry) => entry.file);
  assert(stale.length === 0,
    `${stale.join(', ')} is declared as having an inert press and no longer `
    + 'does. Delete the line — a stale exemption reads as precedent.');
});

run('every declared exception gives a real reason', () => {
  const thin = DECLARED_INERT_PRESSES
    .filter((entry) => entry.why.trim().length < 60)
    .map((entry) => entry.file);
  assert(thin.length === 0,
    `${thin.join(', ')} is exempted without a reason anyone could check. "It is `
    + 'fine" is not a reason; name what the control actually is.');
});

// ── [3] NOTHING SHIPS PERMANENTLY DISABLED ────────────────────────────────
//
// The other half of the founding case. My Status dimmed seven controls with
// `disabled={notYet}` — a VARIABLE, which is why it was legitimate while the
// caption explained it. `disabled={true}` is a control that no state can ever
// re-enable, which is the law's own words: it does not ship.

run('no control ships permanently disabled', () => {
  const offenders = sources
    .filter((source) => permanentlyDisabled(source.code).length > 0)
    .map((source) => source.file);
  assert(offenders.length === 0,
    `${offenders.join(', ')} renders a control with \`disabled={true}\` — a `
    + 'literal no state can ever change. A control that can never be enabled is '
    + 'a control that does not ship.');
});

// ── [4] THE CHECKERS RED ON FABRICATED INPUT (liveness) ───────────────────

run('the checkers red on a fabricated dead control (liveness)', () => {
  assert(inertPresses('<Pressable onPress={() => {}} />').length === 1,
    'an empty press body was not detected — cells [1] and [2] would pass over '
    + 'exactly the shape they exist for');
  assert(inertPresses('<Pressable onPress={ () => {} } />').length === 1,
    'whitespace defeated the detector');
  assert(inertPresses('<Pressable onPress={() => onClose()} />').length === 0,
    'a real handler was reported as inert, which would make the exception list '
    + 'grow until it meant nothing');
  assert(permanentlyDisabled('<Button disabled={true} />').length === 1,
    'a literal-disabled control was not detected');
  assert(permanentlyDisabled('<Button disabled={notYet} />').length === 0,
    'a VARIABLE disabled prop was reported as permanent — that is the legitimate '
    + 'shape My Status used while its caption explained it');
});

console.log(
  `\ndead affordances: ${sources.length} screen sources, `
  + `${DECLARED_INERT_PRESSES.length} declared shields`,
);
console.log(`dead affordance totals: ${passed} passed, ${failed} failed`);
if (failures.length) console.log(`Failing: ${failures.join(', ')}`);
totalsPrinted(failed);
process.exit(failed === 0 ? 0 : 1);
