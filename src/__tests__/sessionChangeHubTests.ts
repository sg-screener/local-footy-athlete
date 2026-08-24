/**
 * ONE PLACE TO CHANGE THE SESSION, AND EVERY BUTTON IN IT GOES SOMEWHERE.
 *
 * Sam, 2026-08-24: the Day card keeps Tired · Sick · Injured as direct status
 * controls, then owns one separate Edit day doorway into Add · Move · Remove.
 * The old "Want to change something?" link and dedicated session Swap action
 * are gone. The open-session card keeps only Equipment · Injury · Add because
 * Quick Swap and Quick Remove live on each exercise row.
 *
 * ## WHY THIS SUITE READS SOURCE
 *
 * The claim is about what the screen MOUNTS — which affordances exist and which
 * are gone — and this repo already answers that class of question by reading
 * the screen (`exerciseEditEntrySurfaceContractTests`). The BEHAVIOUR behind
 * each door is gated separately and by scenario:
 * `test:exercise-removal-owner`, `test:exercise-swap-choices`,
 * `test:exercise-add-candidates`, `test:injury-recomposition`, and the combined
 * walk in `test:session-change-sequence`.
 *
 * ## THE HALF THAT IS EASY TO FORGET
 *
 * A deletion suite that only checks absences passes on an empty file. Half the
 * cells here assert what SURVIVED — the play button, the checkboxes, the load
 * controls, the form cues — because Sam named those in the same breath.
 *
 * Run: npm run test:session-change-hub
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const SCREEN = join(__dirname, '..', 'screens', 'home', 'DayWorkoutScreenV2.tsx');
const source = readFileSync(SCREEN, 'utf8');
const DAY_SCREEN = join(__dirname, '..', 'screens', 'home', 'HomeScreenV2.tsx');
const daySource = readFileSync(DAY_SCREEN, 'utf8');
const HUB = join(__dirname, '..', 'components', 'SessionChangeHub.tsx');
const hubSource = readFileSync(HUB, 'utf8');
const PLAN_SHEET = join(__dirname, '..', 'screens', 'home', 'PlanChangeSheet.tsx');
const planSheetSource = readFileSync(PLAN_SHEET, 'utf8');

let passed = 0;
const failures: string[] = [];
function ok(label: string, condition: boolean, detail?: string): void {
  if (condition) { passed++; console.log(`  PASS ${label}`); return; }
  failures.push(detail ? `${label} — ${detail}` : label);
  console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

/** Source with every block comment stripped, so a NAME in prose is not a mount. */
const live = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('\n[0] THE INSTRUMENT CAN SEE A MOUNT AT ALL');
{
  // ⚠ CONTROL. Every absence cell below is a `!includes`, and `!includes` is
  // true of an empty string. If the comment stripper ate the file, all of them
  // would pass and the suite would report a screen that no longer exists.
  ok('the stripped source still holds the screen',
    live.includes('function DayWorkoutScreenV2') && live.length > 20000,
    `${live.length} chars`);
}

console.log('\n[1] The unlabelled header icons are gone');
{
  for (const testId of [
    'day-workout-add-exercise-action',
    'day-workout-equipment-concern-action',
    'day-workout-injury-concern-action',
  ]) {
    ok(`'${testId}' is not mounted`, !live.includes(testId));
  }
  ok('the icon row style is not used', !live.includes('styles.exerciseActionsRow'));
}

console.log('\n[2] The always-visible row Swap/Remove icons are gone');
{
  ok('`ExerciseRowActions` is not mounted', !live.includes('<ExerciseRowActions'));
  ok('and is not defined', !live.includes('function ExerciseRowActions'));
  ok('no row passes an `onSwap` prop', !/onSwap=\{/.test(live));
  ok('no row passes an `onRemove` prop', !/onRemove=\{/.test(live));
}

console.log('\n[3] There is exactly ONE change section, and it is labelled');
{
  ok('the hub is mounted', live.includes('<SessionChangeHub'));
  /* THE WORDS MOVED TO THE SHARED OWNER (2026-08-19) and are asserted THERE.
   * Leaving this cell pointed at the screen would have failed for the right
   * reason — the screen no longer draws the panel — while sounding like the
   * question had been deleted. */
  ok('and the shared owner carries Sam’s question, verbatim',
    hubSource.includes('Need to make a change?'));
  ok('the hub has a stable id', live.includes('day-workout-change-hub'));
  ok('there is only one of it',
    (live.match(/<SessionChangeHub/g) ?? []).length === 1,
    `${(live.match(/<SessionChangeHub/g) ?? []).length} mounts`);
}

console.log('\n[4] The open-session hub keeps its three session-wide doors');
{
  /* ⚠ **THE LABELS ARE THE SHARED OWNER'S NOW.** The screen names the actions by
   * ID; the words live once, in `components/SessionChangeHub`, which is what
   * stops the two surfaces saying different things for the same door. So the
   * ORDER is asserted on the screen (it composes the list) and the WORDS on the
   * component (it draws them). */
  const order = ['equipment', 'injury', 'add'];
  const labels = ['Equipment', 'Injury', 'Add'];
  const hub = live.slice(live.indexOf('<SessionChangeHub'), live.indexOf('/>', live.indexOf('<SessionChangeHub')));
  let cursor = -1;
  let ordered = true;
  for (let i = 0; i < order.length; i++) {
    ok(`'${labels[i]}' is a labelled door`,
      hub.includes(`id: '${order[i]}' as const`)
        && hubSource.includes(`${order[i]}: '${labels[i]}'`),
      hub.slice(0, 200));
    const at = hub.indexOf(`id: '${order[i]}' as const`);
    if (at <= cursor) ordered = false;
    cursor = at;
  }
  ok('and they appear in the order Sam wrote them', ordered);
}

console.log('\n[5] NO DEAD BUTTONS — every open-session door names a real opener');
{
  const hub = live.slice(live.indexOf('<SessionChangeHub'), live.indexOf('/>', live.indexOf('<SessionChangeHub')));
  const openers = [...hub.matchAll(/onPress: (\w+)/g)].map((match) => match[1]!);
  ok('CONTROL — the hub really wires three openers', openers.length === 3,
    JSON.stringify(openers));
  for (const opener of openers) {
    ok(`'${opener}' is a real callback on this screen`,
      new RegExp(`const ${opener} = React\\.useCallback`).test(live));
  }
  ok('no door is rendered disabled instead of omitted',
    !/disabled=\{/.test(hub), hub);
  // Equipment is the ONE door that comes and goes, and it goes by ABSENCE.
  ok('Equipment is conditional on the session actually having requirements',
    /sessionEquipmentRequirements\.length > 0[\s\S]{0,120}id: 'equipment' as const/.test(live));
}

console.log('\n[6] What Sam said to KEEP is still here');
{
  ok('the play/demo button survives', live.includes('<PlayButton'));
  ok('the checkboxes survive', /Checkbox|checkbox/.test(live));
  // The real names, read off the screen rather than guessed: the first cut
  // looked for `LoadControl`/`onWeightChange` and found neither, which is a
  // fixture claim, not a finding.
  ok('the load controls survive',
    live.includes('styles.weightControl') && live.includes('styles.weightInput'));
  ok('the form cues survive', /cue/i.test(live));
  ok('the video modal the play button opens survives', live.includes('<ExerciseVideoModal'));
}

console.log('\n[7] The deleted surface’s gate still watches — the ingress ids moved with it');
{
  ok('`componentSwapIngress` is still mounted somewhere',
    live.includes('explorerTestId.componentSwapIngress('));
  ok('`componentDeleteIngress` is still mounted somewhere',
    live.includes('explorerTestId.componentDeleteIngress('));
  ok('and they are on the picker, which is the ingress now',
    /action === 'swap'[\s\S]{0,200}componentSwapIngress/.test(live));
}

console.log('\n[8] PARITY — one hub component, rendered by BOTH surfaces');
{
  /* ⚠ **TWO IMPLEMENTATIONS OF THE SAME PANEL IS THE DEFECT THIS SECTION EXISTS
   * TO STOP COMING BACK.**
   *
   * Sam, 2026-08-19: *"The Need to make a change? section inside an active
   * session must use the same shared UI component and visual design as the Day
   * screen — not a separate row of plain text pills … Do not keep separate Day
   * and Session implementations. Both must render one shared hub and enter the
   * same canonical action doors."*
   *
   * The session screen had grown its own row of bordered text pills beside the
   * Day screen's signed card of tinted icon chips: same heading, same five
   * doors, two visual languages, and every future change to make twice.
   *
   * A cell that only checked "both mention a hub" would pass on two copies, so
   * these assert the SHARED MODULE is imported by each screen AND that neither
   * still declares one of its own. */
  const dayLive = daySource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const hubLive = hubSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  ok('the session screen imports the SHARED hub',
    /import \{ SessionChangeHub \} from '\.\.\/\.\.\/components\/SessionChangeHub'/.test(live));
  ok('the Day screen imports the SAME shared hub',
    /import \{ SessionChangeHub \} from '\.\.\/\.\.\/components\/SessionChangeHub'/.test(dayLive));
  ok('the session screen no longer declares a hub of its own',
    !/function SessionChangeHub\(/.test(live), 'a local copy is the duplication itself');
  ok('the Day screen declares no hub of its own either',
    !/function SessionChangeHub\(/.test(dayLive));
  ok('the session screen no longer carries the plain-pill styles',
    !/changeHubButton|changeHubButtonText|changeHubRow/.test(live),
    'the pill row is deleted, not merely unmounted');
  ok('both surfaces mount the component',
    /<SessionChangeHub/.test(live) && /<SessionChangeHub/.test(dayLive));

  /* THE VOCABULARY IS THE COMPONENT'S, NOT EACH SCREEN'S. */
  ok('the shared owner names the three open-session actions',
    /'equipment', 'injury', 'add'/.test(hubLive));
  ok('and it names the three Day status actions beside them',
    /'tired', 'sick', 'injured'/.test(hubLive));
  ok('and it owns the LABELS, so the two surfaces cannot say different words',
    /CHANGE_ACTION_LABEL/.test(hubLive)
      && !/label: 'Equipment'/.test(live) && !/label: 'Equipment'/.test(dayLive));
  ok('and it owns the ICONS and tints, so they cannot look different',
    /ACTION_TINT/.test(hubLive) && /function glyph\(/.test(hubLive));

  for (const id of ['equipment', 'injury', 'add']) {
    ok(`the session surface offers '${id}'`,
      new RegExp(`id: '${id}' as const`).test(live));
  }

  /* ⚠ **THE `openChange` DEEP LINK IS GONE, AND THAT IS THE OTHER HALF OF THE
   * CORRECTION.** It existed only so the Day hub's Equipment/Add/Swap chips
   * could open the session screen on a door. The Day hub no longer offers those
   * three, so nothing navigated with the param any more: a route field with no
   * writer is exactly the dead weight later code trusts. Sender
   * (`useHomeScreen.handleOpenSessionChange`), param
   * (`types/navigation`, `AppNavigator`) and receiver (this screen's effect)
   * were deleted together — a half-deletion leaves a door that answers to
   * nobody. */
  ok('the dead openChange deep link is gone from the session screen',
    !/openChange/.test(live), 'the receiver outlived its only sender');
  ok('and from the Day screen',
    !/handleOpenSessionChange/.test(dayLive));
}

console.log('\n[9] EACH SURFACE OFFERS ITS OWN EXACT SET');
{
  /* ⚠ **THIS SECTION IS THE ONE THAT WAS MISSING, AND ITS ABSENCE SHIPPED THE
   * DEFECT.**
   *
   * Sam, 2026-08-19: *"DAY PAGE: exactly Tired, Sick and Injured, together
   * inside the original 'Need to make a change?' card … NO Remove, Equipment,
   * Add or Swap. No separate readiness row. ACTIVE SESSION SCREEN: Equipment,
   * Injury, Add, Remove and Swap … It may share a configurable visual component
   * with Day, but never a hard-coded action list."*
   *
   * Section [8] proves the two surfaces draw the SAME CARD. On its own that is
   * satisfied by both drawing the same five chips — which is precisely what
   * shipped, and it evicted Tired and Sick into a bare row and deleted the
   * Injured chip outright. **Sameness of component and sameness of contents are
   * different claims, and only one of them is true.**
   *
   * So: each surface's set is asserted EXACTLY (nothing missing, nothing
   * extra), and the two are asserted DISJOINT. A future hand that hard-codes
   * one list into the shared component reddens here even if section [8] stays
   * green. */
  const dayLive = daySource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const hubLive = hubSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  const DAY = ['tired', 'sick', 'injured'];
  const SESSION = ['equipment', 'injury', 'add'];

  /** The ids a surface actually hands the hub, read off its own `actions` list. */
  const offered = (surface: string): string[] => {
    const at = surface.indexOf('<SessionChangeHub');
    if (at < 0) return [];
    const end = surface.indexOf('/>', at);
    if (end < 0) return [];
    return [...surface.slice(at, end).matchAll(/id: '(\w+)' as const/g)]
      .map((match) => match[1]!);
  };

  // ⚠ CONTROL. Every "does not offer" cell below is a negation, and a negation
  // is true of an empty list. If the reader stopped finding the mount at all,
  // both surfaces would look perfectly compliant.
  const dayOffered = offered(dayLive);
  const sessionOffered = offered(live);
  ok('CONTROL — the reader finds a non-empty list on each surface',
    dayOffered.length > 0 && sessionOffered.length > 0,
    `day ${JSON.stringify(dayOffered)} session ${JSON.stringify(sessionOffered)}`);

  ok('the Day surface offers EXACTLY the three direct status controls',
    JSON.stringify(dayOffered) === JSON.stringify(DAY),
    JSON.stringify(dayOffered));
  ok('the session surface offers EXACTLY its three session-wide actions',
    JSON.stringify(sessionOffered) === JSON.stringify(SESSION),
    JSON.stringify(sessionOffered));
  ok('the direct Day and open-session action sets are disjoint',
    dayOffered.filter((id) => sessionOffered.includes(id)).length === 0);

  ok('the Day status row has no plan edit, Equipment, Injury or Swap action',
    !dayOffered.includes('equipment') && !dayOffered.includes('injury')
      && !dayOffered.includes('swap') && !dayOffered.includes('add')
      && !dayOffered.includes('move') && !dayOffered.includes('remove'));

  /* THE SEPARATE ROW IS GONE — the other half of "no separate readiness row".
   * Deleting the five from the Day hub while leaving Tired and Sick outside it
   * would satisfy every cell above and still be the wrong screen. */
  ok('the three sit INSIDE the card, not in a row beside it',
    /testID="home-change-card"[\s\S]{0,600}rowTestID="home-life-fact-chips"/.test(dayLive),
    'the status row must be the change card’s own row');
  ok('and the Day screen has no second chip row of its own',
    !/<View style=\{styles\.lifeFactChips\}/.test(dayLive)
      && !/<LifeFactChip/.test(dayLive),
    'the bare readiness row Sam ruled out has come back');

  ok('the old separate change link is deleted from the Day card',
    !/Want to change something\?/.test(dayLive)
      && !/testID="make-change-link"/.test(dayLive));
  ok('one clear Edit day doorway opens the existing three-action menu',
    /editAction=\{[\s\S]{0,500}testID: 'home-edit-day'/.test(dayLive)
      && /setChangeSheetEntry\(\{\s*date: dayFirstDay\.date\s*\}\)/.test(dayLive)
      && planSheetSource.includes('testID="plan-change-add"')
      && planSheetSource.includes('sessionMoveIngress(selectedWorkout.id)')
      && /label="Remove this session"/.test(planSheetSource));
  ok('Edit day cannot silently default to Add instead of showing that menu',
    !/initialAction\s*=\s*'add'/.test(planSheetSource)
      && /!initialAction\) return;/.test(planSheetSource));
  ok('the shared owner renders Edit day separately from the status-chip row',
    /editAction\?: SessionChangeEditAction/.test(hubLive)
      && /testID=\{editAction\.testID\}/.test(hubLive)
      && /styles\.editDoor/.test(hubLive));
  ok('there is no dedicated whole-session Swap entry on Day or Week',
    !/Swap this session|Swap a session|plan-change-swap|edit-week-action-swap/.test(
      `${dayLive}\n${planSheetSource}`,
    ));

  /* THE COMPONENT IS CONFIGURABLE, NOT TWO HARD-CODED LISTS. */
  ok('the hub renders the list it is handed and picks no list of its own',
    /actions\.map\(/.test(hubLive) && !/DAY_STATUS_ACTION_IDS\.map\(/.test(hubLive)
      && !/SESSION_CHANGE_ACTION_IDS\.map\(/.test(hubLive));
  ok('each surface may name its own testIDs, so no door is silently renamed',
    /action\.testID \?\?/.test(hubLive)
      && /testID: 'home-tired-entry'/.test(dayLive)
      && /testID: 'home-injured-entry'/.test(dayLive));
}

console.log(`\n${'─'.repeat(72)}`);
if (failures.length === 0) {
  console.log(`ALL GREEN — ${passed} passed`);
} else {
  console.log(`FAILURES — ${passed} passed, ${failures.length} failed`);
  for (const failure of failures) console.log(`  ✗ ${failure}`);
  process.exitCode = 1;
}
