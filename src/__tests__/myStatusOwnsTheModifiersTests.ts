/**
 * MY STATUS OFFERS NO DEAD CONTROLS — SEAT_INBOX item 8 (a) + (b).
 *
 * ## The claim, and why it needed a cell of its own
 *
 * Sam ruled the Program-side modifier sheets obsolete: *"we don't need this
 * anymore - it shows up in the status bar and on the a simple thing shows on day
 * screen and week screen"*. Day and Week become READ-ONLY indicators; Coach /
 * My Status owns the detail.
 *
 * Until 2026-08-12 exactly ONE of the eight modifier actions worked there
 * (`dismiss_note`), and the other seven were dimmed under a caption reading
 * *"Change this on your program screen for now."* **That caption was already
 * false when it shipped** — `HomeScreenV2` stopped rendering the modifier list,
 * so the screen it pointed at had nothing on it. An athlete who followed it
 * found nothing and had nowhere else to go.
 *
 * ## WHAT THIS FILE HOLDS THAT A SOURCE SCAN COULD NOT
 *
 * The order's suggested cell read `CoachStatusScreen.tsx` as text and looked for
 * a `LIVE_ACTION_KINDS` list. Two problems, both named in `AGENTS.md`:
 *
 * - **A count is never the whole assertion.** A list containing eight strings
 *   says nothing about whether tapping those controls reaches a door. Dead code
 *   satisfies a source scan perfectly.
 * - **Once nothing is inert, the list itself is deleted** — so a cell anchored
 *   on it would be asserting over a string that no longer exists, which every
 *   anchoring failure in this repo has looked exactly like.
 *
 * So the subject here is the ROUTER: `coachNoteActionRoute` is total over the
 * eight kinds `ActiveProgramModifierActionKind` declares, and the eight are read
 * from the type's own exported list rather than retyped here. A ninth kind added
 * without a route reds this file on the day it is added.
 *
 * Run: npm run test:my-status-modifiers
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

const durable = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => durable.get(key) ?? null,
    setItem: (key: string, value: string) => { durable.set(key, value); },
    removeItem: (key: string) => { durable.delete(key); },
    clear: () => durable.clear(),
  },
};

import fs from 'fs';
import path from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import { stripComments } from './support/sourceText';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

import { ACTIVE_PROGRAM_MODIFIER_ACTION_KINDS } from '../utils/activeProgramModifiers';
import { coachNoteActionRoute } from '../screens/coach/useCoachNoteActions';

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
  } catch (error) {
    failed += 1;
    failures.push(`${name}: ${(error as Error)?.message ?? String(error)}`);
  }
}

/**
 * THE SOURCE, WITH ITS OWN EXPLANATION STRIPPED OUT.
 *
 * `a-comment-is-not-a-shipped-string`, and this cell walked straight into it on
 * its first green run: a well-written module NAMES what it retired, so
 * `ActiveModifiersSection` opens with a paragraph containing the words
 * `actionsNotYet` and `liveActionKinds` — and a bare `includes` read that
 * explanation as the offence. Strip at the READER; the repo's own helper
 * exists because this has now happened three times.
 */
function read(relative: string): string {
  const full = path.join(repoRoot, relative);
  assert(fs.existsSync(full), `${relative} is gone — this cell reads nothing`);
  const source = fs.readFileSync(full, 'utf8');
  const code = stripComments(source);
  assert(code.trim().length > 0,
    `${relative} is nothing but comments after stripping — the assertions below `
    + 'would pass over an empty string (anchoring law: prove the anchor was found)');
  return code;
}

// ── [1] EVERY KIND REACHES A DOOR ──────────────────────────────────────────

run('My Status offers no dead controls — every modifier action has a route', () => {
  assert(ACTIVE_PROGRAM_MODIFIER_ACTION_KINDS.length === 8,
    `the action vocabulary is ${ACTIVE_PROGRAM_MODIFIER_ACTION_KINDS.length} kinds, not 8 — `
    + 'a kind was added or removed and this cell has not been re-read');
  const dead: string[] = [];
  for (const kind of ACTIVE_PROGRAM_MODIFIER_ACTION_KINDS) {
    if (!coachNoteActionRoute({ kind, label: kind })) dead.push(kind);
  }
  assert(dead.length === 0,
    `${dead.join(', ')} reach no door on the screen that OWNS the modifiers. `
    + 'A control that looks live and does nothing is the dead-affordance law '
    + 'broken in its original direction.');
});

// ── [2] THE ROUTES ARE THE ONES THE PROGRAM TAB ALWAYS USED ────────────────
//
// Non-vacuity for [1]: a router returning one constant for everything passes
// [1] perfectly. These are the exact branches `HomeScreenV2.handleCoachNoteAction`
// has always taken, so "My Status mounts the existing doors" is a checkable
// sentence rather than a claim in a header.

run('the routes are the day screen\'s own, not a second opinion', () => {
  const expected: Record<string, string> = {
    update_injury: 'injury_flow',
    dismiss_note: 'dismiss',
    clear_injury: 'clear_sheet',
    clear_status: 'clear_sheet',
    clear_adjustment: 'clear_sheet',
    restore_adjustment: 'clear_sheet',
    update_status: 'update_sheet',
    update_adjustment: 'update_sheet',
  };
  for (const kind of ACTIVE_PROGRAM_MODIFIER_ACTION_KINDS) {
    const actual = coachNoteActionRoute({ kind, label: kind });
    assert(actual === expected[kind],
      `${kind} routes to '${actual}', but the day screen sent it to `
      + `'${expected[kind]}'. My Status would be a SECOND door with a different `
      + 'opinion about what the athlete asked for.');
  }
});

// ── [3] THE NOT-YET MACHINERY IS GONE, WITH ITS CAPTION ────────────────────
//
// (b), and it is in this same commit by ruling — finishing (a) without it
// leaves a caption pointing athletes at a screen that no longer shows modifiers.

run('nothing on the modifier list is dimmed or captioned any more', () => {
  const section = read('src/components/ActiveModifiersSection.tsx');
  const leftovers: string[] = [];
  if (/actionsNotYet/.test(section)) leftovers.push('actionsNotYet');
  if (/liveActionKinds/.test(section)) leftovers.push('liveActionKinds');
  if (/coach-note-actions-not-yet/.test(section)) leftovers.push('the not-yet caption testID');
  assert(leftovers.length === 0,
    `ActiveModifiersSection still carries ${leftovers.join(', ')} — with every `
    + 'action live, that machinery can only dim a control that works, which is '
    + 'LAW-never-disable-a-set-for-part-of-it pointing the other way.');
});

run('the caption that sent athletes to the program screen is retired', () => {
  const copy = read('src/rules/projectionCopy.ts');
  assert(!/coach\.status\.actions_not_yet/.test(copy),
    "the signed string 'coach.status.actions_not_yet' is still registered. It "
    + 'reads "Change this on your program screen for now." — and the Program '
    + 'screen has not rendered the modifier list since the UI merge, so it was '
    + 'already sending athletes to an empty room.');
});

// ── [4] THE EQUIPMENT IDS ARE REAL ─────────────────────────────────────────
//
// `EMPTY_EQUIPMENT_FACT_IDS` was not a stub with a TODO — it silently gave two
// of the eight controls the WRONG testIDs, so every flow that resolved them on
// this screen was looking for coordinates that could not exist.

run('the coach tab passes real equipment fact ids, not an empty set', () => {
  const screen = read('src/screens/coach/CoachTabScreen.tsx');
  assert(!/EMPTY_EQUIPMENT_FACT_IDS/.test(screen),
    'CoachTabScreen still hands ActiveModifiersSection an empty equipment set, '
    + 'so `equipmentClear` and `equipmentUpdate` resolve to fallback ids on the '
    + 'one screen that owns those controls');
  const anchor = screen.indexOf('equipmentFactIds=');
  assert(anchor > -1,
    'the `equipmentFactIds` prop is gone from CoachTabScreen — this assertion '
    + 'has lost its anchor and is measuring nothing (anchoring law)');
  const passed_ = screen.slice(anchor, anchor + 80);
  assert(/equipmentFactIds=\{(?!\s*new Set)/.test(passed_),
    `CoachTabScreen passes \`${passed_.split('\n')[0].trim()}\` — a set built at `
    + 'the call site is a second derivation of the athlete\'s equipment facts');
});

// ── [5] THE CHECKER ITSELF REDS ON A FABRICATED VIOLATION ──────────────────
//
// LIVENESS, moved here with the law it now holds. Cell [1] passes when every
// kind has a route — and it would ALSO pass if `coachNoteActionRoute` simply
// never returned null, which is the shape a `default:` arm would create. So the
// checker is fed a kind that does not exist and required to say so.

run('the router reds on a kind it does not know (liveness)', () => {
  const unknown = coachNoteActionRoute(
    { kind: 'a_kind_that_does_not_exist', label: 'x' } as never,
  );
  assert(unknown === null,
    `an unknown action kind routed to '${unknown}' instead of null. Cell [1] `
    + 'would then be green for every kind forever, including one nobody wired — '
    + 'a fallback that always answers cannot report what it does not know.');
});

console.log(`\nmy status owns the modifiers: ${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log('\nFAILURES:');
  for (const failure of failures) console.log(`  - ${failure}`);
}
totalsPrinted(failed);
process.exit(failed === 0 ? 0 : 1);
