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

run('the shared confirmation sheet still exists and My Status still mounts it', () => {
  const sheet = read('src/components/CoachNoteSheet.tsx');
  assert(/export function CoachNoteSheet\b/.test(sheet),
    'components/CoachNoteSheet no longer exports the component — (c) deleted '
    + 'the thing (a) made five controls depend on');
  const myStatus = read('src/screens/home/MyStatusScreen.tsx');
  assert(/<CoachNoteSheet\b/.test(myStatus),
    'the My Status page no longer mounts the confirmation sheet, so every clear and '
    + 'update control on My Status opens nothing');
});

// ── [5] THE CONTROLS HAVE ONE HOME, AND PROGRAM IS NOT IT ─────────────────
//
// The half of Sam's design this commit was responsible for. The OTHER half —
// *"a simple thing shows on day screen and week screen"* — WAS NOT BUILT, and
// cell [6] below recorded its absence rather than asserting it into existence.
//
// **THAT ABSENCE ENDED 2026-08-13 (SEAT_INBOX item 16).** Sam answered the
// question the old comment here was waiting on: *"yes — one line on week, small
// card on day, read-only both"*. `HomeScreenV2` now mounts `ModifiersStrip`
// twice, `surface="day"` above the day card and `surface="week"` above the
// seven rows, and cell [6] is INVERTED — it holds the mounts up rather than
// holding their absence down.
//
// **THE TWO CELLS DIVIDE LIKE THIS, AND THE DIVISION IS THE WHOLE POINT.**
// [5] says the modifier LIST and its CONTROLS live only on My Status. [6] says
// the read-only NOTICE lives on Program. Building [6] is not permission to
// weaken [5]: a notice that grew a control would satisfy neither, which is why
// `ActiveModifiersSection` is still named below and still forbidden here.

run('Program has no modifier popup between its doorway and My Status', () => {
  const home = read(HOME);
  assert(!/import \{ ModifiersSheet \}/.test(home) && !/<ModifiersSheet\b/.test(home),
    'Program still mounts the old modifier popup, so tapping My Status does not '
    + 'go straight to the page');
  assert(!/modifiersSheetOpen|setModifiersSheetOpen/.test(home),
    'the popup mount is gone but its private open state survived on Program');
});

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

// ── [6] THE DAY/WEEK INDICATOR IS BUILT, READ-ONLY, AND SHARES ONE COUNT ──
//
// INVERTED 2026-08-13. This cell used to assert `!<ModifiersStrip` in
// `HomeScreenV2` and its failure message said, in as many words, to invert it
// the day the mount landed. That day is today, so it is inverted rather than
// deleted: a surface Sam asked for twice needs a cell that reds when it goes
// away again, and an assertion that only ever recorded a hole cannot do that.
// EVERY CELL BELOW READS THE MOUNTS ONE BY ONE, AND THAT IS A CORRECTION.
//
// These three cells first shipped asking whether the file CONTAINED
// `count={modifierCount}` and `onPress={handleOpenMyStatus}`. Both passed a
// mutation run that broke ONE of the two mounts — the surviving mount kept the
// string in the file, so the search found it and the cell stayed green while
// the day screen was wired wrong. That is `a bind can be green and empty`, and
// it is the same shape as first-match-wins hiding an ordering: one satisfied
// instance answering for a set.
//
// So the mounts are EXTRACTED and asserted over individually. A cell about two
// mounts has to look at two mounts.
const stripMounts = (source: string): readonly string[] =>
  source.match(/<ModifiersStrip[\s\S]*?\/>/g) ?? [];

run('the day and week screens both mount their notice and permanent My Status doorway', () => {
  const home = read(HOME);
  assert(/import \{ ModifiersStrip \}/.test(home),
    'Program no longer imports ModifiersStrip, so the day/week notice Sam asked '
    + 'for ("one line on week, small card on day") is gone from the screen again');
  const mounts = stripMounts(home);
  const surfaces = mounts
    .map((mount) => mount.match(/surface="([\w-]+)"/)?.[1])
    .filter((surface): surface is string => !!surface)
    .sort();
  assert(surfaces.length === mounts.length,
    `a ModifiersStrip on Program is mounted without a surface prop, so its `
    + `testID collapses to \`modifiers-strip-undefined\` and no flow can say `
    + `which screen it asserted (${mounts.length} mounts, ${surfaces.length} surfaced)`);
  assert(surfaces.includes('day'),
    'the DAY screen no longer mounts the notice — half of Sam\'s answer is '
    + 'missing, and the half that is left will look deliberate to the next reader');
  assert(surfaces.includes('week'),
    'the WEEK screen no longer mounts the notice — the week is the shape that '
    + 'shows all seven days, so it is the shape most able to hide a change');
  assert(surfaces.includes('day-header') && surfaces.includes('week-header'),
    'My Status is not permanently available from both Program shapes');
  assert(!surfaces.includes('coach'),
    'Program mounts a retired Coach surface instead of its own Day/Week doorway');
});

// THE COUNT IS THE LIST'S OWN LENGTH, ON PROGRAM TOO.
//
// Item 16 rule (d): "The count comes from `useActiveModifiers`, never a
// separate count." A second tally is `a count taken for a record` — sighting 14
// in this repo — and the copies agree right up until one of them is taught a
// filter the other never hears about. `useHomeScreen` therefore DELEGATES to
// the hook instead of re-running the selector beside it, which is why the
// number on the day screen cannot disagree with the list it opens.
run('Program counts modifiers through the one hook, not beside it', () => {
  const hook = read('src/screens/home/useHomeScreen.ts');
  assert(/useActiveModifiers\(/.test(hook),
    'the Program hook stopped using useActiveModifiers, so its count is now '
    + 'derived somewhere else than My Status\'s list');
  assert(!/selectActiveCoachNotes\(/.test(hook),
    'the Program hook runs selectActiveCoachNotes directly again — that is a '
    + 'SECOND derivation of the same list beside useActiveModifiers, and two '
    + 'copies of one selector is two places for the count to drift');
  const home = read(HOME);
  const mounts = stripMounts(home);
  assert(mounts.length > 0, 'Program mounts no ModifiersStrip at all');
  for (const mount of mounts) {
    const surface = mount.match(/surface="([\w-]+)"/)?.[1] ?? 'unknown';
    assert(/count=\{modifierCount\}/.test(mount),
      `the ${surface} notice is no longer fed the hook-derived count; a literal, `
      + 'a second selector call or a locally recomputed number here is the exact '
      + 'defect rule (d) forbids — and it only has to be wrong on ONE surface for '
      + 'the day and the week to disagree about the same week');
  }
});

// READ-ONLY MEANS THE NOTICE OPENS A DOOR AND OWNS NOTHING BEHIND IT.
run('every Program status doorway opens My Status directly', () => {
  const home = read(HOME);
  const mounts = stripMounts(home);
  assert(mounts.length > 0, 'Program mounts no ModifiersStrip at all');
  for (const mount of mounts) {
    const surface = mount.match(/surface="([\w-]+)"/)?.[1] ?? 'unknown';
    assert(/onPress=\{handleOpenMyStatus\}/.test(mount),
      `the ${surface} doorway does not open My Status directly`);
  }
  const hook = read('src/screens/home/useHomeScreen.ts');
  assert(/navigation\.navigate\('MyStatus', \{ weekStartISO: visibleWeekStart \}\)/.test(hook),
    'Program still changes tabs or opens an intermediate surface instead of '
    + 'navigating straight to its My Status page');
});

run('Day and Week headers carry the same permanent My Status doorway', () => {
  const home = read(HOME);
  assert(/surface="day-header"/.test(home) && /surface="week-header"/.test(home),
    'the permanent My Status doorway is missing from Day or Week');
  const strip = read('src/components/ModifiersStrip.tsx');
  assert(/surface === 'day-header' \|\| surface === 'week-header'/.test(strip),
    'Day and Week headers no longer share the permanent doorway treatment');
  assert(!/surface === 'coach'/.test(strip),
    'the shared strip still carries the retired Coach doorway variant');
});

console.log(`\nprogram tab read-only modifiers: ${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log('\nFAILURES:');
  for (const failure of failures) console.log(`  - ${failure}`);
}
totalsPrinted(failed);
process.exit(failed === 0 ? 0 : 1);
