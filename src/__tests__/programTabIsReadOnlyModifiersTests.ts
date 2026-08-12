/**
 * DAY AND WEEK ARE READ-ONLY INDICATORS — SEAT_INBOX item 8 (c).
 *
 * ## Sam's design, and what (c) actually removes
 *
 * *"we don't need this anymore - it shows up in the status bar and on the a
 * simple thing shows on day screen and week screen"*. Day and Week SHOW that
 * something is modifying the program; Coach / My Status owns the detail and the
 * controls.
 *
 * The UI merge already stopped `HomeScreenV2` rendering the modifier list. What
 * it left behind was the whole machinery underneath: a coach-note action router
 * with no caller, its sheet state, and a SECOND `GuidedInjuryFlowSheet` mount
 * wired to it.
 *
 * ## WHY THE ORDER PUTS THIS LAST, AND WHY THAT ORDER IS NOT NEGOTIABLE
 *
 * **(c) before (a)+(b) strands athletes.** The caption on My Status used to read
 * "Change this on your program screen for now" — so deleting the Program side
 * first would have removed the only thing seven controls pointed at, leaving
 * every one of them dead with nowhere to send anyone. (a) and (b) landed in
 * `8de98d3f`; this file may only be green after that.
 *
 * ## THE ONE THAT IS NOT A LEFTOVER
 *
 * `HomeScreenV2` mounts `GuidedInjuryFlowSheet` TWICE. One is the Injured chip
 * — a live athlete door on the day screen, and it stays. The other was opened
 * only by `handleCoachNoteAction`, which nothing calls. Deleting the wrong one
 * would silently remove the athlete's way to report an injury, and no existing
 * cell counts the mounts — which is why this one does.
 *
 * Run: npm run test:program-tab-read-only-modifiers
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import fs from 'fs';
import path from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import { stripComments } from './support/sourceText';

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

/** Source with its own explanation stripped — `a-comment-is-not-a-shipped-string`. */
function read(relative: string): string {
  const full = path.join(repoRoot, relative);
  assert(fs.existsSync(full), `${relative} is gone — this cell reads nothing`);
  const code = stripComments(fs.readFileSync(full, 'utf8'));
  assert(code.trim().length > 0,
    `${relative} is all comment after stripping — every assertion below would `
    + 'pass over an empty string');
  return code;
}

const HOME = 'src/screens/home/HomeScreenV2.tsx';

// ── [1] THE INJURY SHEET IS MOUNTED EXACTLY ONCE ───────────────────────────
//
// A COUNT WITH A WORD BOUNDARY, and a count is not the whole assertion — cell
// [2] names WHICH mount survived. `<GuidedInjuryFlowSheet` without `\b` would
// also match a renamed `<GuidedInjuryFlowSheetV2`.

run('the day screen mounts the guided injury flow exactly once', () => {
  const home = read(HOME);
  const mounts = home.match(/<GuidedInjuryFlowSheet\b/g) ?? [];
  assert(mounts.length === 1,
    `the day screen mounts GuidedInjuryFlowSheet ${mounts.length} times, not 1. `
    + 'Two mounts means two sheets over one decision; zero means the Injured '
    + 'chip has nothing to open.');
});

// ── [2] AND IT IS THE ATHLETE'S CHIP THAT KEPT IT ──────────────────────────
//
// Non-vacuity for [1]: deleting the WRONG mount also leaves exactly one. The
// surviving mount must be the one driven by `readinessInjuryVisible` — the
// Injured chip — not the coach-note one.

run('the surviving mount is the Injured chip, not the coach-note one', () => {
  const home = read(HOME);
  const anchor = home.indexOf('<GuidedInjuryFlowSheet');
  assert(anchor > -1,
    'no GuidedInjuryFlowSheet mount found at all — this cell has lost its '
    + 'anchor and the comparison below would be meaningless (anchoring law)');
  const mount = home.slice(anchor, anchor + 600);
  assert(/readinessInjuryVisible/.test(mount),
    'the mount that survived is not driven by `readinessInjuryVisible` — the '
    + "deletion took the Injured chip's sheet and kept the dead one, so an "
    + 'athlete can no longer report an injury from the day screen');
});

// ── [3] NO COACH-NOTE MACHINERY IS LEFT ON THE DAY SCREEN ──────────────────

run('the day screen defines no coach-note handler or sheet state', () => {
  const home = read(HOME);
  const leftovers: string[] = [];
  if (/handleCoachNoteAction/.test(home)) leftovers.push('handleCoachNoteAction');
  if (/setCoachNoteSheet/.test(home)) leftovers.push('the coachNoteSheet state');
  if (/handleConfirmCoachNoteClear/.test(home)) leftovers.push('handleConfirmCoachNoteClear');
  if (/handleCoachNoteStatusUpdate/.test(home)) leftovers.push('handleCoachNoteStatusUpdate');
  if (/setInjuryFlowNote/.test(home)) leftovers.push('the injuryFlowNote state');
  if (/<CoachNoteSheet\b/.test(home)) leftovers.push('the CoachNoteSheet mount');
  assert(leftovers.length === 0,
    `the day screen still carries ${leftovers.join(', ')}. Nothing calls any of `
    + 'it — the modifier list moved to My Status at the UI merge — and unread '
    + 'machinery is not half-built, it is weight the next reader will trust.');
});

// ── [4] THE COMPONENT ITSELF SURVIVED THE DELETION ─────────────────────────
//
// The counterweight. Cells [1]-[3] are all satisfied by deleting the sheet
// outright, which would take My Status's confirmation flow with it — five of
// its eight controls open exactly this component.

run('the shared confirmation sheet still exists and Coach still mounts it', () => {
  const sheet = read('src/components/CoachNoteSheet.tsx');
  assert(/export function CoachNoteSheet\b/.test(sheet),
    'components/CoachNoteSheet no longer exports the component — (c) deleted '
    + 'the thing (a) made five controls depend on');
  const coachTab = read('src/screens/coach/CoachTabScreen.tsx');
  assert(/<CoachNoteSheet\b/.test(coachTab),
    'the Coach tab no longer mounts the confirmation sheet, so every clear and '
    + 'update control on My Status opens nothing');
});

// ── [5] THE CONTROLS HAVE ONE HOME, AND PROGRAM IS NOT IT ─────────────────
//
// The half of Sam's design this commit is responsible for. The OTHER half —
// *"a simple thing shows on day screen and week screen"* — is NOT BUILT, and
// this cell says so rather than asserting it into existence:
//
//   `ModifiersStrip`'s own header describes three mounts (day, week, coach).
//   Measured 2026-08-12: it is mounted ONCE, on `CoachTabScreen`. Program has
//   no modifier indicator at all, and `.maestro/golden/coach-my-status.yaml`
//   encodes that absence with `assertNotVisible: modifiers-strip-day`.
//
// That is a MISSING SURFACE, not a leftover, so (c) does not touch it — but it
// is written here because the next reader of this file would otherwise conclude
// from cells [1]-[4] that Sam's design is complete. It is not; it is reported.

run('the modifier list and its controls have exactly one home', () => {
  const home = read(HOME);
  assert(!/<ActiveModifiersSection\b/.test(home),
    'the day screen renders the full modifier list with its controls again — '
    + 'that list has one home, and it is My Status');
  const status = read('src/screens/coach/CoachStatusScreen.tsx');
  assert(/<ActiveModifiersSection\b/.test(status),
    'My Status stopped rendering the modifier list, so the controls (c) just '
    + 'removed from Program now exist nowhere at all');
});

run('the day/week indicator is still MISSING, and this cell is the record', () => {
  const home = read(HOME);
  const strip = /<ModifiersStrip\b/.test(home);
  assert(!strip,
    "the day screen now mounts ModifiersStrip — Sam's second half is BUILT, "
    + 'which is good news and makes this cell wrong. Invert it, and update '
    + '.maestro/golden/coach-my-status.yaml, which asserts `modifiers-strip-day` '
    + 'is NOT visible.');
});

console.log(`\nprogram tab read-only modifiers: ${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log('\nFAILURES:');
  for (const failure of failures) console.log(`  - ${failure}`);
}
totalsPrinted(failed);
process.exit(failed === 0 ? 0 : 1);
