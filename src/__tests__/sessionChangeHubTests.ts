/**
 * ONE PLACE TO CHANGE THE SESSION, AND EVERY BUTTON IN IT GOES SOMEWHERE.
 *
 * Sam, 2026-08-24: the Day card keeps Tired · Sick · Injured as direct status
 * controls; Add · Move · Remove enter from the programmed session card.
 * The old "Want to change something?" link and dedicated session Swap action
 * are gone. The open session now puts Injury · Equipment · Add behind one
 * compact header menu because Quick Swap and Quick Remove live on each row.
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
const COPY = join(__dirname, '..', 'rules', 'projectionCopy.ts');
const copySource = readFileSync(COPY, 'utf8');

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

console.log('\n[3] The active session has one compact options doorway and one labelled sheet');
{
  ok('the old open-session hub is removed', !live.includes('<SessionChangeHub'));
  ok('the Day card carries Sam’s new status question and explanation verbatim',
    /id: 'day\.change_card\.heading'[\s\S]{0,300}text: 'Not feeling 100%\?'/.test(copySource)
      && /id: 'day\.change_card\.subline'[\s\S]{0,300}text: 'Tell us what’s changed and we’ll adjust today\.'/.test(copySource));
  ok('the open-session sheet asks the signed change-session question',
    /subtitle=\{signedCopy\('session\.change_card\.heading'\)\}/.test(live)
      && /id: 'session\.change_card\.heading'[\s\S]{0,300}text: 'What do you want to change\?'/.test(copySource));
  ok('the dots and sheet have stable ids',
    live.includes('testID="session-options-button"')
      && live.includes('testID="session-options-sheet"'));
  ok('the visible dots stay compact while the invisible target is 48 points',
    /sessionOptionsButton:\s*\{[\s\S]{0,160}width:\s*24[\s\S]{0,80}height:\s*24/.test(live)
      && /testID="session-options-button"[\s\S]{0,260}hitSlop=\{12\}/.test(live)
      && /name="dots-horizontal" size=\{22\}/.test(live));
}

console.log('\n[4] The open-session sheet uses the three signed rows in Sam’s order');
{
  const sheetAt = live.indexOf('testID="session-options-sheet"');
  const sheetEnd = live.indexOf('testID="session-feedback-sheet"', sheetAt);
  const sheet = live.slice(sheetAt, sheetEnd);
  ok('CONTROL — the session-options sheet can be bounded',
    sheetAt > 0 && sheetEnd > sheetAt && sheet.length > 1000,
    `${sheetAt}..${sheetEnd}`);
  /* ⚠ **THE ADD ROW LEFT THIS MENU — SAM, 2026-08-25 (R-217): *"it will replace
   * the 'add an exercise' option in the 3 dot menu in the top right corner"*.**
   * Add is now the plus at the foot of each section, which knows WHICH section
   * it adds to; this row could only ever have asked that same question as its
   * first step. The cells are narrowed to the two rows that remain and joined
   * by [6] below, which requires the row's ABSENCE and the plus's presence —
   * inverted, not deleted (`gate-must-watch-the-deleted-surface`). */
  const order = ['injury', 'equipment'];
  const labels = ['Something hurts', 'Equipment changed'];
  const sublines = [
    'Adjust around pain or a niggle',
    'Tell us what’s missing',
  ];
  let cursor = -1;
  let ordered = true;
  for (let i = 0; i < order.length; i++) {
    const labelId = `session.options.${order[i]}.label`;
    const sublineId = `session.options.${order[i]}.subline`;
    ok(`'${labels[i]}' and its explanation are signed and rendered`,
      sheet.includes(`signedCopy('${labelId}')`)
        && sheet.includes(`signedCopy('${sublineId}')`)
        && new RegExp(`id: '${labelId.replace(/\./g, '\\.')}'[\\s\\S]{0,220}text: '${labels[i]}'`).test(copySource)
        && new RegExp(`id: '${sublineId.replace(/\./g, '\\.')}'[\\s\\S]{0,260}text: '${sublines[i]}'`).test(copySource));
    const at = sheet.indexOf(`signedCopy('${labelId}')`);
    if (at <= cursor) ordered = false;
    cursor = at;
  }
  ok('and they appear in the order Sam wrote them', ordered);
  ok('the popup uses the same flat row and divider treatment as Day plan options',
    sheet.includes('<SessionOptionsRow')
      && !sheet.includes('<ExerciseSheetOption')
      && /sessionOptionsRow:\s*\{[\s\S]{0,220}borderBottomWidth: StyleSheet\.hairlineWidth[\s\S]{0,120}borderBottomColor: 'rgba\(255,255,255,0\.08\)'/.test(live)
      && /sessionOptionsIcon:\s*\{[\s\S]{0,120}width:\s*38[\s\S]{0,80}height:\s*38[\s\S]{0,80}borderRadius:\s*19/.test(live));
  ok('the popup restores the original dumbbell and medical-cross glyphs',
    /import \{ ACTION_TINT, glyph as sessionChangeGlyph \}/.test(live)
      && sheet.includes("icon={sessionChangeGlyph('injury')}")
      && sheet.includes("icon={sessionChangeGlyph('equipment')}")
      && hubSource.includes('d="M6.5 7v10M4 9v6M17.5 7v10M20 9v6M6.5 12h11"')
      && hubSource.includes('d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z"'));
  /* The hub KEEPS its plus path — the Day plan dots still open Add ([7] below),
   * and that is a different door from the one the session menu lost. */
  ok('the shared plus glyph survives for the Day plan door that still uses it',
    hubSource.includes('d="M12 5v14M5 12h14"'));
  ok('the original icon tints remain attached to those same two actions',
    sheet.includes('iconTint={ACTION_TINT.injury}')
      && sheet.includes('iconTint={ACTION_TINT.equipment}')
      && /injury: 'rgba\(255, 127, 127, 0\.12\)'/.test(hubSource)
      && /equipment: 'rgba\(30, 167, 255, 0\.12\)'/.test(hubSource)
      && /add: 'rgba\(198, 255, 0, 0\.12\)'/.test(hubSource));
  ok('the popup ends with the same centred ghost Back treatment as Day plan options',
    /<Button[\s\S]{0,180}label="Back"[\s\S]{0,180}variant="ghost"[\s\S]{0,220}setSessionOptionsVisible\(false\)/.test(sheet));
}

console.log('\n[5] NO DEAD BUTTONS — every open-session door names a real opener');
{
  const sheetAt = live.indexOf('testID="session-options-sheet"');
  const sheet = live.slice(sheetAt, live.indexOf('testID="session-feedback-sheet"', sheetAt));
  const openers = ['openSessionInjuryFlow', 'openSessionEquipment'];
  for (const opener of openers) {
    ok(`'${opener}' is a real callback on this screen`,
      new RegExp(`const ${opener} = React\\.useCallback`).test(live)
        && sheet.includes(`${opener}();`));
  }
  ok('each choice closes the menu before entering its established flow',
    (sheet.match(/setSessionOptionsVisible\(false\);/g) ?? []).length === 2);
  /* R-217 — the level-1 opener went with the row it served. `openExerciseAdd`
   * asked "Strength / Conditioning / Mobility?", which is the one question the
   * section plus has already answered by where it was tapped. Comments
   * stripped: the screen still EXPLAINS the deletion by name. */
  ok('the retired level-1 add opener is deleted, not left callable',
    !/const openExerciseAdd = React\.useCallback/.test(live)
      && !/openExerciseAdd\(\)/.test(
        live.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, ''),
      ),
    'a handler with no door is the next screen\'s dead affordance');
  // Equipment is the ONE door that comes and goes, and it goes by ABSENCE.
  ok('Equipment is conditional on the session actually having requirements',
    /sessionEquipmentRequirements\.length > 0[\s\S]{0,260}session\.options\.equipment\.label/.test(sheet));
}

/* ══ THE ADD DOOR MOVED — it is a plus at the foot of each section ══ */
console.log('\n[5b] Quick add: one plus per section, in the one section owner');
{
  ok('the plus is mounted in the SHARED section component, not per render route',
    /function SessionExecutionSection\(\{ section, completedItemIds, onQuickAdd, children \}/.test(live)
      && /testID=\{`session-quick-add-\$\{section\.id\}`\}/.test(live),
    'both the Mobility route and SessionList render through this one owner');
  ok('and BOTH render routes hand it the section\'s own tap',
    (live.match(/onQuickAdd=\{quickAddFor\(section\.id\)\}/g) ?? []).length === 2,
    'a route that omitted it would silently lose the plus for its sections');
  ok('it sits AFTER the section\'s rows, under the last card',
    (() => {
      const at = live.indexOf('testID={`session-execution-items-${section.id}`}');
      const children = live.indexOf('{children}', at);
      const plus = live.indexOf('session-quick-add-', children);
      return at > 0 && children > at && plus > children;
    })());
  ok('a collapsed section shows no plus',
    (() => {
      const expanded = live.indexOf('{expanded ? (');
      const plus = live.indexOf('session-quick-add-', expanded);
      const close = live.indexOf(') : null}', plus);
      return expanded > 0 && plus > expanded && close > plus;
    })(),
    'a plus with no visible list to join is an instruction to guess');
  ok('the plus starts flush with the last card, cancelling the body\'s own flex gap',
    /executionSectionBody: \{ paddingBottom: spacing\.md, gap: spacing\.sm \}/.test(live)
      && /quickAddRow: \{[^}]*marginTop: -spacing\.sm/.test(live),
    'the plus is a CHILD of that body, so its gap applied to the plus too');
  ok('the tap enters the EXISTING hierarchy one level down, at the section\'s family',
    /const quickAddFor = React\.useCallback\([\s\S]{0,900}openAddFamily\(family\)/.test(live),
    'same legality owner, same rungs — only the first question is skipped');
  ok('legality is the same legalAddFamilies pass the retired row ran',
    /const quickAddFamilies = React\.useMemo\([\s\S]{0,700}legalAddFamilies\(addCandidateArgs\(\)\)/.test(live));
  ok('a finished, already-saved or team-only session offers no plus',
    /const quickAddFamilies = React\.useMemo\(\(\) => \{[\s\S]{0,320}isTeamOnly \|\| isFinished \|\| isAlreadyComplete/.test(live));
  ok('a section outside the three add families gets none either',
    /quickAddFamilies\.has\(family\)/.test(live)
      && /ADD_FAMILY_ORDER: readonly AddFamilyId\[\] = \['strength', 'conditioning', 'mobility'\]/
        .test(readFileSync(
          join(__dirname, '..', 'utils', 'addExerciseCandidates.ts'), 'utf8',
        )),
    'AddFamilyId is an Extract of SessionExecutionSectionId — one identity, no table');
  ok('the spoken label names the section, since the control is a bare glyph',
    /accessibilityLabel=\{`\$\{signedCopy\('session\.quick_add\.label'\)\}: \$\{section\.label\}`\}/.test(live)
      && /id: 'session\.quick_add\.label'[\s\S]{0,500}text: 'Quick add'/.test(copySource));
  ok('and the menu row\'s two signed strings are deregistered, not left signed for nobody',
    !/id: 'session\.options\.add\.(label|subline)'/.test(copySource),
    'a signed string with no surface is copy the next build finds and uses');
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

console.log('\n[8] The Day status card and active-session menu stay separate');
{
  const dayLive = daySource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const hubLive = hubSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  ok('the Day screen still imports and mounts its shared status hub',
    /import \{ SessionChangeHub \} from '\.\.\/\.\.\/components\/SessionChangeHub'/.test(dayLive)
      && /<SessionChangeHub/.test(dayLive));
  ok('the active session neither imports nor mounts that status card',
    !/import \{ SessionChangeHub \}/.test(live) && !/<SessionChangeHub/.test(live));
  ok('the Day card still offers exactly Tired, Sick and Injured',
    /id: 'tired' as const[\s\S]*id: 'sick' as const[\s\S]*id: 'injured' as const/.test(dayLive));
  ok('the status-card owner contains no session-options doorway',
    !/session-options-button|session-options-sheet/.test(hubLive));
  ok('the old openChange deep link stays gone from both screens',
    !/openChange/.test(live) && !/handleOpenSessionChange/.test(dayLive));
}

console.log('\n[9] Scheduling and in-session options keep distinct menus');
{
  const dayLive = daySource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  ok('Day plan dots still open Add / Move / Remove',
    /testID="home-plan-options"/.test(dayLive)
      && /onPlanOptions=\{\(\) => setChangeSheetEntry\(\{ date: day\.date \}\)\}/.test(dayLive)
      && planSheetSource.includes('testID="plan-change-add"')
      && planSheetSource.includes('sessionMoveIngress(selectedWorkout.id)')
      && /label=\{signedCopy\('plan_change\.remove_session'\)\}/.test(planSheetSource));
  ok('active-session dots do not offer Move, Remove or whole-session Swap',
    !/session-options-(move|remove|swap)/.test(live)
      && !/Swap this session|Swap a session/.test(live));
  ok('row-level Quick Swap and Quick Remove remain available',
    live.includes('onQuickSwap={quickSwapExercise}')
      && live.includes('onQuickRemove={requestExerciseRemoval}'));
  ok('the session menu is gated by the same editable active-session conditions',
    /const sessionOptionsAvailable = Boolean\([\s\S]{0,220}date && !isTeamOnly && editableExercises\.length > 0[\s\S]{0,120}!isFinished && !isAlreadyComplete/.test(live));
}

console.log(`\n${'─'.repeat(72)}`);
if (failures.length === 0) {
  console.log(`ALL GREEN — ${passed} passed`);
} else {
  console.log(`FAILURES — ${passed} passed, ${failures.length} failed`);
  for (const failure of failures) console.log(`  ✗ ${failure}`);
  process.exitCode = 1;
}
