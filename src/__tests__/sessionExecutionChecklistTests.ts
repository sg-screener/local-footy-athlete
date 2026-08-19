/** Session execution checklist ownership. Run: npm run test:session-execution */
import * as fs from 'fs';
import * as path from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import {
  buildSessionExecutionPlan,
  buildSessionExecutionSummary,
  deriveChecklistComponentCompletions,
  deriveSessionExecutionCompletion,
} from '../utils/sessionExecutionChecklist';
import { buildSessionTemplate } from '../utils/sessionTemplate';
import { buildSessionFeedbackPayload } from '../utils/sessionFeedbackForm';
import { parseTeamTrainingSessionOutcome } from '../types/sessionOutcome';
import { TEAM_TRAINING_FEEDBACK_COPY } from '../rules/teamNightSize';
import {
  deriveSessionEquipmentRequirements,
  missingSessionEquipmentValues,
} from '../utils/sessionEquipment';

armTotalsOrRed();
let pass = 0;
let fail = 0;
const failures: string[] = [];
function ok(name: string, condition: boolean, detail?: unknown) {
  if (condition) { pass += 1; console.log(`  ✓ ${name}`); }
  else { fail += 1; failures.push(name); console.log(`  ✗ ${name}`, detail ?? ''); }
}
const row = (id: string, name: string, role?: string) => ({
  id, exerciseId: `exercise-${id}`, prescribedSets: 3, prescribedRepsMin: 6,
  prescribedRepsMax: 8, restSeconds: 90, exercise: { id: `library-${id}`, name },
  ...(role ? { role } : {}),
});
const workout: any = {
  id: 'session-1', name: 'Strength + Conditioning', workoutType: 'Strength',
  exercises: [
    row('jump', 'Broad Jump', 'power'),
    row('squat', 'Back Squat'),
    row('curl', 'Hammer Curl'),
    row('pallof', 'Band Pallof Press'),
    row('run', 'Tempo Run'),
  ],
  hasCombinedConditioning: true,
};
const flow: any = {
  dayType: 'lower_squat', movementCount: 2,
  movements: [
    { exercise: { id: 'hips', name: 'Hip 90/90 Stretch' }, category: 'mobility' },
    { exercise: { id: 'ankles', name: 'Ankle Rocks' }, category: 'mobility' },
  ],
};
const plan = buildSessionExecutionPlan({
  workout,
  template: buildSessionTemplate(workout),
  mobilityFlow: flow,
});

console.log('\n[1] One plan groups the existing rows into collapsible components');
ok('mobility is its own section', plan.sections.some((section) => section.id === 'mobility'));
ok('strength is its own section', plan.sections.some((section) => section.id === 'strength'));
ok('accessories and prehab are folded into the Strength disclosure',
  !plan.sections.some((section) => section.id === 'accessories') &&
    plan.sections.find((section) => section.id === 'strength')!.items
      .some((item) => item.label === 'Hammer Curl' || item.label === 'Band Pallof Press'));
ok('conditioning is its own section', plan.sections.some((section) => section.id === 'conditioning'));
ok('every planned item has one stable id', new Set(plan.items.map((item) => item.id)).size === plan.items.length);

console.log('\n[2] Ticks derive component outcomes');
const strengthItems = plan.items.filter((item) => item.componentId === 'strength');
const allStrength = new Set(strengthItems.map((item) => item.id));
const full = deriveChecklistComponentCompletions(plan, allStrength);
ok('all strength rows ticked derives full strength', full.strength === 'full', full);
const oneStrength = new Set(strengthItems.slice(0, 1).map((item) => item.id));
const partial = deriveChecklistComponentCompletions(plan, oneStrength);
ok('some strength rows ticked derives partial strength', partial.strength === 'partial', partial);
const none = deriveChecklistComponentCompletions(plan, new Set());
ok('no strength rows ticked derives skipped strength', none.strength === 'skipped', none);
const sectionSummary = buildSessionExecutionSummary(plan, new Set([
  ...plan.sections.find((section) => section.id === 'mobility')!.items.map((item) => item.id),
  ...plan.sections.find((section) => section.id === 'conditioning')!.items.map((item) => item.id),
]));
ok('mobility completion remains separately visible',
  sectionSummary.sections.find((section) => section.sectionId === 'mobility')?.completion === 'full');
ok('unticked mobility is recorded as skipped',
  buildSessionExecutionSummary(plan, new Set()).sections
    .find((section) => section.sectionId === 'mobility')?.completion === 'skipped');
ok('the merged Strength disclosure keeps its own skipped result',
  sectionSummary.sections.find((section) => section.sectionId === 'strength')?.completion === 'skipped');
const everythingExceptMobility = new Set(plan.items
  .filter((item) => item.sectionId !== 'mobility' && item.sectionId !== 'optional')
  .map((item) => item.id));
ok('skipped mobility makes an otherwise completed prescribed session partial',
  deriveSessionExecutionCompletion(
    buildSessionExecutionSummary(plan, everythingExceptMobility),
  ) === 'partial');
const everyPrescribedItem = new Set(plan.items
  .filter((item) => item.sectionId !== 'optional')
  .map((item) => item.id));
ok('a session is full when mobility and every other prescribed section are full',
  deriveSessionExecutionCompletion(
    buildSessionExecutionSummary(plan, everyPrescribedItem),
  ) === 'full');

console.log('\n[2b] The saved result keeps the item evidence and whole-session RPE');
const checklistPayload = buildSessionFeedbackPayload({
  dateStr: '2026-08-11',
  completion: 'partial',
  components: sectionSummary.components,
  componentCompletions: sectionSummary.componentCompletions,
  componentReasons: {},
  feeling: null,
  soreness: null,
  partialReason: null,
  skipReason: null,
  executionItems: sectionSummary.items,
  difficulty: 4,
});
ok('checklist payload saves without the retired feel/reason questions', checklistPayload !== null);
ok('checklist payload keeps every item result',
  checklistPayload?.executionItems?.length === plan.items.length);
ok('checklist payload keeps session effort for a non-conditioning result', checklistPayload?.difficulty === 4);
ok('checklist payload invents no feeling or soreness',
  !('feeling' in (checklistPayload ?? {})) && !('soreness' in (checklistPayload ?? {})));
ok('performed checklist refuses to save without RPE', buildSessionFeedbackPayload({
  dateStr: '2026-08-11',
  completion: 'partial',
  components: sectionSummary.components,
  componentCompletions: sectionSummary.componentCompletions,
  componentReasons: {},
  feeling: null,
  soreness: null,
  partialReason: null,
  skipReason: null,
  executionItems: sectionSummary.items,
}) === null);
// INVERTED 2026-08-12, NOT DELETED. This asserted that 1-10 was RETIRED and
// that a `difficulty` of 7 must be refused. Sam reversed it — "make it 1-10
// everywhere" — because the 1-5 scale shared one field with the 1-10
// conditioning RPE and `feedbackAdapter`, written for 1-10, read a strength
// session's "very hard" 5 as EASY and increased the athlete's volume for it
// (`docs/EFFORT_SCALE_INVERSION_2026-08-12.md`). So 7 is now legal, and the
// cell keeps its teeth by pinning the NEW boundary instead.
const effortPayload = (difficulty: number) => buildSessionFeedbackPayload({
  dateStr: '2026-08-11',
  completion: 'partial',
  components: sectionSummary.components,
  componentCompletions: sectionSummary.componentCompletions,
  componentReasons: {}, feeling: null, soreness: null, partialReason: null, skipReason: null,
  executionItems: sectionSummary.items,
  difficulty,
});
ok('checklist ACCEPTS the 1-10 scale — 7 is a legal effort', effortPayload(7) !== null);
ok('checklist accepts both ends of 1-10',
  effortPayload(1) !== null && effortPayload(10) !== null);
ok('checklist still refuses a rating outside 1-10',
  effortPayload(0) === null && effortPayload(11) === null);

const teamTrainingMeasurement = { durationMinutes: 95, effort: 4 };
const checklistWithTeamTraining = buildSessionFeedbackPayload({
  dateStr: '2026-08-11',
  completion: 'partial',
  components: sectionSummary.components,
  componentCompletions: sectionSummary.componentCompletions,
  componentReasons: {}, feeling: null, soreness: null, partialReason: null, skipReason: null,
  executionItems: sectionSummary.items,
  difficulty: 4,
  teamTraining: teamTrainingMeasurement,
});
ok('team-training duration and effort ride the same checklist result',
  checklistWithTeamTraining?.teamTraining?.durationMinutes === 95
    && checklistWithTeamTraining.teamTraining.effort === 4);
// MOVED WITH THE SCALE, 2026-08-12. This pinned 6 as out-of-range, which was
// true while the shared scale was 1-5 and is the exact claim Sam's "1-10
// everywhere" ruling reverses. The boundary is what the cell is for, so it
// keeps one — at the new edge.
ok('team-training effort accepts the shared 1-10 scale, and nothing past it',
  parseTeamTrainingSessionOutcome(teamTrainingMeasurement)?.effort === 4
    && parseTeamTrainingSessionOutcome({ ...teamTrainingMeasurement, effort: 6 })?.effort === 6
    && parseTeamTrainingSessionOutcome({ ...teamTrainingMeasurement, effort: 10 })?.effort === 10
    && parseTeamTrainingSessionOutcome({ ...teamTrainingMeasurement, effort: 11 }) === null);

console.log('\n[3] The live screen uses controlled chevrons and checkboxes');
const screen = fs.readFileSync(path.resolve(__dirname, '..', 'screens', 'home', 'DayWorkoutScreenV2.tsx'), 'utf8');
const feedback = fs.readFileSync(path.resolve(__dirname, '..', 'components', 'SessionFeedbackPanel.tsx'), 'utf8');
const outcomeTransaction = fs.readFileSync(
  path.resolve(__dirname, '..', 'store', 'sessionOutcomeTransaction.ts'),
  'utf8',
);
const home = fs.readFileSync(path.resolve(__dirname, '..', 'screens', 'home', 'HomeScreenV2.tsx'), 'utf8');
ok('screen renders the one execution plan', /buildSessionExecutionPlan/.test(screen));
ok('each program component uses a chevron section', /function SessionExecutionSection/.test(screen));
ok('each section has stable toggle and expanded-body identities',
  /session-execution-toggle-\$\{section\.id\}/.test(screen) &&
    /session-execution-items-\$\{section\.id\}/.test(screen));
ok('rows expose a checkbox', /accessibilityRole="checkbox"/.test(screen));
ok('completed rows use a dull treatment', /executionItemComplete/.test(screen));
/* ⚠ **THIS CELL REQUIRED THE OLD PLACEMENT AND IS INVERTED — R-111.**
 *
 * It read *"every checkbox is centred against its complete exercise row"* and
 * demanded `alignItems: 'center'` with NO `marginTop` on the box. Sam ruled the
 * checkbox to the far right on the exercise-name line, which is `flex-start`
 * plus exactly the `marginTop` this cell forbade. Inverted rather than deleted
 * (`gate-must-watch-the-deleted-surface`): the same coordinates are still
 * watched, they now name the ruled placement. */
ok('every checkbox sits on the exercise-name line, not centred against the card',
  /executionItem:\s*\{[^}]*alignItems:\s*'flex-start'/.test(screen)
    && !/executionItem:\s*\{[^}]*alignItems:\s*'center'/.test(screen)
    && /executionCheckbox:\s*\{[^}]*\.\.\.sessionExecutionCheckbox[^}]*marginTop/.test(screen));
ok('mobility movements use the same controlled checklist owner',
  /function MobilityExerciseList/.test(screen)
    && /completedItemIds\.has\(itemId\)/.test(screen)
    && /onToggle=\{onToggleItem\}/.test(screen));
ok('mobility and every other session row use one square checkbox recipe',
  /sessionExecutionCheckbox/.test(screen)
    && /\.\.\.sessionExecutionCheckbox/.test(screen)
    && !/MobilityPrehabFlowSection/.test(screen));
const mobilitySectionAt = screen.indexOf("filter((section) => section.id === 'mobility')");
const mobilityRowsAt = screen.indexOf('<MobilityExerciseList', mobilitySectionAt);
const mobilityRendererAt = screen.indexOf('function MobilityExerciseList');
const sessionListAt = screen.indexOf('function SessionList', mobilityRendererAt);
const mobilityRenderer = mobilityRendererAt >= 0 && sessionListAt > mobilityRendererAt
  ? screen.slice(mobilityRendererAt, sessionListAt)
  : '';
ok('mobility uses the same chevron owner as the other sections',
  mobilitySectionAt >= 0 && mobilityRowsAt > mobilitySectionAt &&
    screen.slice(mobilitySectionAt, mobilityRowsAt).includes('<SessionExecutionSection') &&
    !/chevron-up|chevron-down|useState\(false\)/.test(mobilityRenderer));
ok('mobility reuses the complete Strength exercise presentation',
  /<ExecutionChecklistItem/.test(mobilityRenderer)
    && /<StrengthExerciseCard/.test(mobilityRenderer)
    && /prescriptionLabel=\{mobilityFlowMovementDose\(exercise\)\}/.test(mobilityRenderer)
    && /cueTextOverride=\{exercise\.notes\}/.test(mobilityRenderer)
    && /formatWeight=\{formatWeight\}/.test(mobilityRenderer)
    && /incrementWeight=\{incrementWeight\}/.test(mobilityRenderer)
    && /decrementWeight=\{decrementWeight\}/.test(mobilityRenderer)
    && /onSelectExercise=\{onSelectExercise\}/.test(mobilityRenderer));
ok('Team Training expands as a plain checklist row, not an accent card',
  /function TeamTrainingRow/.test(screen) && /styles\.exerciseCard/.test(screen) &&
    !/function TeamTrainingBanner|teamTrainingCard|teamTrainingBody/.test(screen));
ok('the Team Training checklist row uses the ruled Club session label',
  /function TeamTrainingRow[\s\S]{0,500}signedCopy\('session\.team_training\.row'\)/.test(screen)
  && !/Club\/team field session/.test(screen));
ok('mobility has no optional wording in text or accessibility copy',
  !/\boptional\b/i.test(mobilityRenderer));
ok('the in-progress checklist is a screen draft', /useState<ReadonlySet<string>>/.test(screen) && /setCompletedExerciseIds/.test(screen));
ok('the durable outcome owns the per-item result', /executionItems:\s*executionSummary\?\.items/.test(feedback));

console.log('\n[4] Feedback reads checklist completion and asks one RPE score');
ok('feedback accepts the execution summary', /executionSummary\?:\s*SessionExecutionSummary/.test(feedback));
ok('feedback derives whole-session completion from prescribed execution sections',
  /executionSummary\s*\?\s*deriveSessionExecutionCompletion\(executionSummary\)/.test(feedback));
ok('the accepted transaction derives from the same execution items before publishing',
  /executionAggregate\s*=\s*intent\.executionItems\?\.length[\s\S]{0,180}deriveSessionExecutionItemCompletion\(intent\.executionItems\)[\s\S]{0,120}aggregate\s*=\s*executionAggregate\s*\?\?\s*componentAggregate/.test(outcomeTransaction));
ok('feedback reviews every execution section, including mobility and merged Strength',
  /executionSummary\.sections\.map/.test(feedback));
const checklistBranchStart = feedback.indexOf('executionSummary ? (');
const legacyBranchStart = feedback.indexOf('COMPLETION_OPTIONS.map', checklistBranchStart);
ok('checklist branch found before legacy completion choices', checklistBranchStart >= 0 && legacyBranchStart > checklistBranchStart);
const checklistBranch = checklistBranchStart >= 0 && legacyBranchStart > checklistBranchStart
  ? feedback.slice(checklistBranchStart, legacyBranchStart)
  : '';
ok('checklist branch does not render completion choice chips', !checklistBranch.includes('COMPLETION_OPTIONS.map'));
ok('feedback asks the effort question', /How hard was the session\?/.test(feedback));
// MOVED WITH THE SURFACE, 2026-08-12. This pinned the CHIP implementation —
// ten choices on one non-wrapping row — and Sam replaced the chips with a
// slider in the same pass, for the reason the cell itself was straining at:
// ten tap targets do not fit a row. The claim underneath survives and is now
// stated against the thing that ships.
ok('the session effort input is a slider, not chips',
  /<EffortSlider/.test(feedback)
    && /testID="session-feedback-rpe-grid"/.test(feedback)
    && !/feedback-session-rpe-\$\{value\}/.test(feedback));
ok('the slider is handed a nullable value and a setter, so it can start EMPTY',
  /value=\{sessionRpe\}/.test(feedback) && /onChange=\{setSessionRpe\}/.test(feedback));
ok('an untouched session effort is null, never a number that looks like an answer',
  /const \[sessionRpe, setSessionRpe\] = useState<number \| null>\(\s*isSessionEffortRating\(existing\?\.difficulty\) \? existing\.difficulty : null,/
    .test(feedback));
ok('effort anchors say very easy and very hard on the 1-10 scale',
  /1 = very easy · 10 = very hard/.test(feedback));
// THE RETIRED SCALE MUST NOT COME BACK on any of the three surfaces that moved.
ok('no 1-5 effort anchor survives anywhere in the panel',
  !/1 = very easy · 5 = very hard/.test(feedback));
ok('saved difficulty is the session RPE in checklist mode',
  /difficulty:\s*executionSummary\s*\?\s*sessionRpeValue\s*:\s*conditioningRpeValue/.test(feedback));
ok('performed Team Training asks for duration and its own 1-10 effort',
  TEAM_TRAINING_FEEDBACK_COPY.durationQuestion === 'How long was team training?'
    && TEAM_TRAINING_FEEDBACK_COPY.effortQuestion === 'How hard was team training?'
    && /TEAM_TRAINING_FEEDBACK_COPY\.durationQuestion/.test(feedback)
    && /TEAM_TRAINING_FEEDBACK_COPY\.effortQuestion/.test(feedback)
    && /team-training-feedback-hours/.test(feedback)
    && /team-training-feedback-minutes/.test(feedback)
    && /team-training-feedback-effort-grid/.test(feedback)
    && /<EffortSlider/.test(feedback));
ok('the extra team-training result is required only when that section was performed',
  /const draftIsComplete = baseDraftIsComplete[\s\S]{0,180}!teamTrainingWasPerformed \|\| teamTrainingOutcome !== undefined/.test(feedback));
ok('the accepted transaction validates and republishes the team-training result',
  /parseTeamTrainingSessionOutcome\(intent\.teamTraining\)/.test(outcomeTransaction)
    && /intent\.teamTraining \? \{ teamTraining: intent\.teamTraining \}/.test(outcomeTransaction));

console.log('\n[5] Completed day state says it once');
const dayBadgesStart = home.indexOf('const rowBadges = (');
const dayBadgesEnd = home.indexOf('const selectedTitle', dayBadgesStart);
const dayBadges = dayBadgesStart >= 0 && dayBadgesEnd > dayBadgesStart
  ? home.slice(dayBadgesStart, dayBadgesEnd)
  : '';
ok('day badge region is found', dayBadges.length > 0);
ok('completed day has no redundant Done badge', !dayBadges.includes('label="Done"'));
ok('Session complete uses a tick rather than a pulse',
  /testID=\{`day-complete-\$\{dayToken\}`\}[\s\S]{0,400}name="check"[\s\S]{0,400}Session complete/.test(home) &&
    !/testID=\{`day-complete-\$\{dayToken\}`\}[\s\S]{0,400}kind="pulse"/.test(home));

console.log('\n[6] Temporary equipment changes belong to the opened session');
const equipmentRows: any[] = [
  {
    key: 'rower',
    name: 'Easy Row',
    raw: { exercise: { equipmentRequired: ['Rower'] } },
  },
  {
    key: 'squat',
    name: 'Back Squat',
    raw: { exercise: { equipmentRequired: ['Barbell', 'Rack'] } },
  },
];
const requirements = deriveSessionEquipmentRequirements(equipmentRows);
ok('the session derives the exact row erg requirement',
  requirements.some((requirement) =>
    requirement.key === 'modality:row'
      && requirement.exerciseKeys.includes('rower')));
ok('the exact row erg does not duplicate into vague cardio equipment',
  !requirements.some((requirement) => requirement.key === 'tag:bike_or_treadmill'));
ok('strength equipment is derived from the session row',
  requirements.some((requirement) =>
    requirement.key === 'tag:barbell'
      && requirement.exerciseKeys.includes('squat')));
const strengthRowsNamedRow: any[] = [
  {
    key: 'barbell-row',
    name: 'Barbell Row',
    raw: { exercise: { exerciseType: 'Compound', equipmentRequired: ['Barbell'] } },
  },
  {
    key: 'cable-row',
    name: 'Seated Cable Row',
    raw: { exercise: { exerciseType: 'Compound', equipmentRequired: ['Cable Machine'] } },
  },
];
const strengthRowRequirements = deriveSessionEquipmentRequirements(strengthRowsNamedRow);
ok('strength rows named Row keep their authored barbell and cable requirements',
  strengthRowRequirements.some((requirement) =>
    requirement.key === 'tag:barbell'
      && requirement.exerciseKeys.includes('barbell-row'))
  && strengthRowRequirements.some((requirement) =>
    requirement.key === 'tag:cables'
      && requirement.exerciseKeys.includes('cable-row')));
ok('strength rows named Row never invent a row erg requirement',
  !strengthRowRequirements.some((requirement) => requirement.key === 'modality:row'));
const missingValues = missingSessionEquipmentValues(new Set(['modality:row', 'tag:barbell']));
ok('unticked requirements split into typed machine and strength constraints',
  missingValues.modalities[0] === 'row' && missingValues.tags[0] === 'barbell');
// ⚠ **FOUR CELLS HERE DROVE A SELECTION AUTHORITY THAT NO LONGER EXISTS.**
// `sessionConditioningReplacementName` and `buildSessionEquipmentReplacementPlan`
// were the screen's own replacement chooser. Deleted 2026-08-19 after being
// measured inert across 2,038 real door walks — the dated equipment fact is
// written first and the composer recomposes the day, so the screen never had
// anything left to choose. The cells above, which read the REQUIREMENTS the
// sheet draws, are untouched: that reader is still live and still the sheet's.
//
// Conditioning-modality replacement itself is NOT re-proven anywhere yet and is
// named as NOT COVERED in `docs/STATUS_REBUILD.md`.
const sessionEquipmentSheet = fs.readFileSync(
  path.resolve(__dirname, '..', 'screens', 'home', 'SessionEquipmentSheet.tsx'),
  'utf8',
);
ok('the opened-session icon mounts the one session equipment sheet',
  /testID="day-workout-equipment-concern-action"/.test(screen)
    && /<SessionEquipmentSheet/.test(screen)
    && /requirements=\{sessionEquipmentRequirements\}/.test(screen));
// ⚠ **THIS CELL USED TO MATCH `createsActiveModifier: false` ANYWHERE IN THE
// FILE, and after the planner's swap loop was deleted it would have gone on
// passing on a string belonging to the live Swap door — green on a property it
// had stopped watching.** It reads the equipment handler's own body now.
const equipmentHandlerBody = screen.slice(
  screen.indexOf('const applySessionEquipment'),
  screen.indexOf('const applyExerciseGuidedInjury'));
ok('the session equipment answer is today-only and written as a dated fact',
  /surface: 'session_equipment_sheet'/.test(equipmentHandlerBody)
    && /scope: 'today_only'/.test(equipmentHandlerBody)
    && /kind: 'missing_for_session'/.test(equipmentHandlerBody));
ok('and the equipment handler commits no swap of its own',
  !/type: 'swap_exercise'/.test(equipmentHandlerBody));
ok('the Day screen has no Equipment shortcut',
  !/setEquipmentVisible\(true\)/.test(home)
    && !/home-equipment-limitation-sheet/.test(home));
ok('the sheet lists derived requirements rather than the whole saved kit',
  /requirements\.map/.test(sessionEquipmentSheet)
    && !/ownedEquipmentKit\(\)/.test(sessionEquipmentSheet));
ok('the sheet keeps permanent equipment changes in Profile',
  /Permanent change\? Update your equipment in Profile\./.test(sessionEquipmentSheet));

/* ═══════════════════════════════════════════════════════════════════════════
 * [7] SAM'S TWO SESSION-SCREEN RULINGS, 2026-08-20
 *
 * R-110 — power belongs INSIDE Strength, generally as its first row.
 * R-111 — play beside the name, checkbox at the far right.
 *
 * The membership and ordering cells run the REAL plan builder over the REAL
 * template owner. The placement cells are source-level, because this repo
 * ships no native renderer — so each one names the exact prop or style that
 * moved, and each has its negative half (the old placement must be GONE), so a
 * fix that adds the new arrangement while leaving the old one behind fails.
 * ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[7] Power is a Strength row, and the row controls sit where Sam ruled');

// Sam's acceptance criterion, literally: one power row and four other strength
// rows. Nothing else on the day, so the count under test is unambiguous.
const powerPlusFour: any = {
  id: 'session-power-5', name: 'Lower Strength', workoutType: 'Strength',
  exercises: [
    row('jump', 'Broad Jump', 'power'),
    row('squat', 'Back Squat', 'main_lift'),
    row('rdl', 'Romanian Deadlift', 'accessory'),
    row('lunge', 'Walking Lunge', 'accessory'),
    row('pallof', 'Band Pallof Press', 'midline'),
  ],
};
const withPower = buildSessionExecutionPlan({
  workout: powerPlusFour,
  template: buildSessionTemplate(powerPlusFour),
  mobilityFlow: null,
});
const strengthOf = (p: typeof withPower) => p.sections.find((s) => s.id === 'strength');

// ── NON-VACUITY FIRST. Every cell below is about a power row; if the fixture
//    stopped carrying one they would all pass by saying nothing.
ok('[7] CONTROL — the fixture really does carry a power row',
  powerPlusFour.exercises.filter((r: any) => r.role === 'power').length === 1
    && withPower.items.some((item) => item.label === 'Broad Jump'),
  withPower.items.map((i) => i.label));

ok('[7] there is no Power section left to render',
  !withPower.sections.some((section) => section.id === ('power' as any)),
  withPower.sections.map((s) => s.id));
ok('[7] and no section is labelled Power / Primer anywhere in the plan',
  !withPower.sections.some((section) => /power|primer/i.test(section.label)),
  withPower.sections.map((s) => s.label));
ok('[7] the power row is a member of Strength',
  strengthOf(withPower)!.items.some((item) => item.label === 'Broad Jump'),
  strengthOf(withPower)!.items.map((i) => i.label));
ok('[7] SAM’S CRITERION — one power row + four strength rows reads Strength 0/5',
  strengthOf(withPower)!.items.length === 5,
  strengthOf(withPower)!.items.map((i) => i.label));
/* ⚠ **NARROWED TO STANDALONE PRIMERS — SAM, 2026-08-20.**
 *
 * *"'Power appears first' applies only to a standalone power primer. For valid
 * contrast training, preserve the authored pair at the main slot: heavy lift →
 * paired explosive movement → rest."*
 *
 * These fixtures carry NO `supersetGroup`, so every one of them is a standalone
 * primer and the claim below is exactly the narrowed one. The contrast case —
 * where the explosive row follows its heavy partner instead of leading — is held
 * in `test:power-primer-policy` section [9], over a pairing formed by the real
 * `powerRowAlignment` owner. The cell titles say "standalone" so nobody reads
 * them as the general rule again. */
ok('[7] CONTROL — these fixtures are standalone primers, not contrast pairs',
  withPower.items.every((item) => !(item as any).supersetGroup)
    && !powerPlusFour.exercises.some((r: any) => r.supersetGroup || r.pairType),
  powerPlusFour.exercises.map((r: any) => r.pairType ?? null));
ok('[7] a STANDALONE primer is the FIRST row of Strength',
  strengthOf(withPower)!.items[0]?.label === 'Broad Jump',
  strengthOf(withPower)!.items.map((i) => i.label));
ok('[7] and the main lift follows it',
  strengthOf(withPower)!.items[1]?.label === 'Back Squat',
  strengthOf(withPower)!.items.map((i) => i.label));

// ── POWER'S INTERNAL ROLE IS UNTOUCHED. Sam ruled the PROJECTION, not the
//    programming: the typed power component still exists, still carries its own
//    completion policy, and the row is still attached to it. A "fix" that got
//    the display right by deleting power's identity fails here.
ok('[7] the typed power component survives the move',
  withPower.components.some((component) => component.id === 'power' && component.kind === 'power'),
  withPower.components.map((c) => c.id));
ok('[7] and the power row still belongs to it',
  withPower.items.find((item) => item.label === 'Broad Jump')?.componentId === 'power');

// ── WITHOUT POWER, STRENGTH BEGINS WITH THE MAIN LIFT AS USUAL.
const noPower: any = {
  id: 'session-no-power', name: 'Lower Strength', workoutType: 'Strength',
  exercises: [
    row('squat', 'Back Squat', 'main_lift'),
    row('rdl', 'Romanian Deadlift', 'accessory'),
    row('lunge', 'Walking Lunge', 'accessory'),
    row('pallof', 'Band Pallof Press', 'midline'),
  ],
};
const withoutPower = buildSessionExecutionPlan({
  workout: noPower, template: buildSessionTemplate(noPower), mobilityFlow: null,
});
ok('[7] without power, Strength begins with the main lift',
  strengthOf(withoutPower)!.items[0]?.label === 'Back Squat',
  strengthOf(withoutPower)!.items.map((i) => i.label));
ok('[7] and that session has no power component to account for',
  !withoutPower.components.some((component) => component.kind === 'power')
    && strengthOf(withoutPower)!.items.length === 4,
  strengthOf(withoutPower)!.items.map((i) => i.label));

// ── ORDERING IS ASSERTED END TO END, ON ONE OWNER.
//    `sessionTemplate`'s `d2Rank` is the owner of power-first and the section
//    filter preserves what it emits. A second sort inside the projection was
//    written and DELETED: mutating it to a no-op reddened nothing, so it was a
//    rival authority, not a backstop. This fixture authors power LAST, so the
//    cell asserts the projection's OUTPUT — the owner going wrong reds it.
const powerLast: any = {
  id: 'session-power-last', name: 'Lower Strength', workoutType: 'Strength',
  exercises: [
    row('squat', 'Back Squat', 'main_lift'),
    row('rdl', 'Romanian Deadlift', 'accessory'),
    row('jump', 'Broad Jump', 'power'),
  ],
};
const authoredLast = buildSessionExecutionPlan({
  workout: powerLast, template: buildSessionTemplate(powerLast), mobilityFlow: null,
});
ok('[7] a STANDALONE primer authored LAST is still projected first in Strength',
  strengthOf(authoredLast)!.items[0]?.label === 'Broad Jump',
  strengthOf(authoredLast)!.items.map((i) => i.label));
ok('[7] and moving it re-orders nothing else',
  strengthOf(authoredLast)!.items.slice(1).map((i) => i.label)
    .join(' | ') === 'Back Squat | Romanian Deadlift',
  strengthOf(authoredLast)!.items.map((i) => i.label));

// ── THE PROJECTION OWNS IT, AND THE OWNER SAYS SO.
const checklistOwner = fs.readFileSync(
  path.resolve(__dirname, '..', 'utils', 'sessionExecutionChecklist.ts'), 'utf8');
ok('[7] the projection routes the power ROLE into strength',
  /item\.role === 'power'\) return 'strength'/.test(checklistOwner));
ok('[7] a rowless power COMPONENT lands in strength too',
  /component\.kind === 'power' \? 'strength'/.test(checklistOwner));
// ⚠ AND THE PROJECTION KEEPS NO ORDERING AUTHORITY OF ITS OWN. This is the
// deleted sort's gate: re-introducing one here is what this cell forbids.
ok('[7] the projection sorts nothing — the composition owner still owns order',
  !/\.sort\(/.test(checklistOwner));
// The label and the section id are gone from the DECLARATIONS — not merely
// unused. Read the two structures, never the prose: the comment above them
// names the retired section on purpose, so future readers know what moved.
const sectionIdUnion = checklistOwner.slice(
  checklistOwner.indexOf('export type SessionExecutionSectionId'),
  checklistOwner.indexOf('export interface SessionExecutionItem'));
const sectionLabelMap = checklistOwner.slice(
  checklistOwner.indexOf('const SECTION_LABELS'),
  checklistOwner.indexOf('const SECTION_ORDER'));
const sectionOrderList = checklistOwner.slice(
  checklistOwner.indexOf('const SECTION_ORDER'),
  checklistOwner.indexOf('];', checklistOwner.indexOf('const SECTION_ORDER')));
ok('[7] CONTROL — the three declarations under test were all found',
  sectionIdUnion.includes("| 'strength'") && sectionLabelMap.includes('strength:')
    && sectionOrderList.includes("'strength'"));
ok('[7] the Power / Primer section is gone from the type, the labels and the order',
  !/\|\s*'power'/.test(sectionIdUnion)
    && !/power:/.test(sectionLabelMap)
    && !/'power'/.test(sectionOrderList),
  { sectionIdUnion, sectionLabelMap });

// ── R-111 — CONTROL PLACEMENT, ON THE ONE OWNER EVERY ROW SHARES.
const headerRow = screen.slice(
  screen.indexOf('function ExerciseHeaderRow'),
  screen.indexOf('function PlayButton'));
const checklistItemWhole = screen.slice(
  screen.indexOf('function ExecutionChecklistItem'),
  screen.indexOf('function OptionalWorkHeader'));
const strengthCard = screen.slice(
  screen.indexOf('function StrengthExerciseCard'),
  screen.indexOf('function RecoveryBlock'));
// The JSX only. The explanatory comment above the `return` quotes the very
// props these cells assert on, and a cell that matches its own documentation
// is a cell that cannot fail.
const checklistItem = checklistItemWhole.slice(checklistItemWhole.indexOf('return ('));

ok('[7] CONTROL — the header owner and the checklist owner were both found',
  headerRow.length > 100 && checklistItemWhole.includes('accessibilityRole="checkbox"'),
  { headerRow: headerRow.length, checklistItem: checklistItemWhole.length });

ok('[7] play sits immediately beside the exercise name, inside one group',
  /exerciseNameGroup[\s\S]*?styles\.exerciseName[\s\S]*?<PlayButton/.test(headerRow),
  headerRow);
ok('[7] and the old full-width name — the thing that PUSHED play to the edge — is gone',
  !/exerciseNameWrap/.test(headerRow)
    && (headerRow.match(/<PlayButton/g) ?? []).length === 1,
  headerRow);
ok('[7] the name group takes the width so the pair stays hard left',
  /exerciseNameGroup:\s*\{[^}]*flex:\s*1[^}]*flexDirection:\s*'row'/.test(screen)
    && /exerciseNamePress:\s*\{[^}]*flexShrink:\s*1/.test(screen));

/* ⚠ **SUPERSEDED BY R-116 — SAM, 2026-08-20, IN HIS OWN WORDS.**
 *
 * *"Move the checkbox onto the SAME horizontal control line as the weight
 * stepper, positioned immediately to its right. This supersedes the earlier
 * ruling that placed the checkbox level with the exercise name."*
 *
 * R-111 put the tick at the far right of the NAME line and this cell asserted
 * it was the row's last child. The tick now lives on the CONTROL row, so the
 * claim moves with it — inverted, not deleted, and the replacement is stricter:
 * it pins the checkbox's position RELATIVE TO THE STEPPER rather than to the
 * row, which is what the ruling actually says. Section [10] holds the rest. */
ok('[7] the checkbox is handed to the card, not parked on the name line',
  /children: \(checkbox: React\.ReactNode\) => React\.ReactNode/.test(checklistItemWhole)
    && /\{children\(checkbox\)\}/.test(checklistItemWhole)
    && !/executionItemContent[\s\S]{0,200}accessibilityRole="checkbox"/.test(checklistItemWhole),
  checklistItemWhole.slice(-700));

// ── NOTHING ABOUT COMPLETION OR VIDEO CHANGED, AND THESE SAY SO.
ok('[7] the checkbox keeps its toggle, its state and its identity',
  /onPress=\{\(\) => onToggle\(itemId\)\}/.test(checklistItemWhole)
    && /accessibilityState=\{\{ checked: completed \}\}/.test(checklistItemWhole)
    && /testID=\{`session-execution-check-\$\{stableTestIdToken\(itemId\)\}`\}/.test(checklistItemWhole));
ok('[7] the checkbox keeps its spoken label',
  /accessibilityLabel=\{`\$\{completed \? 'Completed' : 'Mark complete'\}: \$\{label\}`\}/
    .test(checklistItemWhole));
ok('[7] both the name and the play button still speak the exercise, and still play it',
  (headerRow.match(/accessibilityLabel=\{`Play \$\{name\} demo`\}/g) ?? []).length === 2
    && (headerRow.match(/onPress=\{onPlay\}|onPress=\{onPlay\}/g) ?? []).length >= 1
    && /<PlayButton onPress=\{onPlay\}/.test(headerRow));

// ── SETS/REPS LOWER LEFT, WEIGHT LOWER RIGHT — UNMOVED.
ok('[7] sets/reps stay lower-left and the weight control lower-right',
  /statsRow:\s*\{[^}]*flexDirection:\s*'row'[^}]*justifyContent:\s*'space-between'/.test(screen)
    && /<View style=\{styles\.statsRow\}>\s*<Text\s*style=\{styles\.statsPrimary\}/.test(screen)
    && /<View style=\{styles\.weightControl\}>/.test(screen));

// ── ONE OWNER FOR MOBILITY, POWER AND STRENGTH. This is why "apply
//    consistently" needed no per-surface cell: all three reach the SAME two
//    components, and a fourth arrangement cannot appear without a new one.
const mobilityRendererBody = screen.slice(
  screen.indexOf('function MobilityExerciseList'), screen.indexOf('function SessionList'));
const sessionListBody = screen.slice(
  screen.indexOf('function SessionList'), screen.indexOf('function SessionExecutionSection'));
ok('[7] Mobility rows reach the one header and the one checklist owner',
  /<ExecutionChecklistItem/.test(mobilityRendererBody)
    && /<StrengthExerciseCard/.test(mobilityRendererBody));
ok('[7] Power and Strength rows reach the same two',
  /<ExecutionChecklistItem/.test(sessionListBody)
    && /<StrengthExerciseCard/.test(sessionListBody));
ok('[7] and StrengthExerciseCard has exactly one header, so no row can differ',
  (screen.match(/<ExerciseHeaderRow/g) ?? []).length
    === (screen.match(/<ExerciseHeaderRow/g) ?? []).length
    && (screen.match(/function ExerciseHeaderRow/g) ?? []).length === 1
    && (screen.match(/function ExecutionChecklistItem/g) ?? []).length === 1);

/* ═══════════════════════════════════════════════════════════════════════════
 * [10] THE TIGHTENED SESSION ROW — SAM'S MOCK, 2026-08-20 (R-116)
 *
 * *"Keep the existing header, black background and current visual identity …
 * Add the approved calendar icon immediately before the date … a distinct
 * approved icon beside each section heading … Tighten each exercise row …
 * Move the checkbox onto the SAME horizontal control line as the weight
 * stepper, positioned immediately to its right … Power is visually an ordinary
 * Strength row."*
 *
 * Source-level, because this repo ships no native renderer — so each cell names
 * the exact prop or style that carries the layout, and the ordering cells assert
 * POSITION (index within the rendered block), not mere presence.
 * ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[10] the tightened session row — Sam\'s mock, R-116');

// ── PLAY STAYS BESIDE THE NAME (R-111's surviving half).
ok('[10] Play is still immediately beside the exercise name',
  /exerciseNameGroup[\s\S]*?styles\.exerciseName[\s\S]*?<PlayButton/.test(headerRow)
    && /exerciseNameGroup:\s*\{[^}]*flexDirection:\s*'row'/.test(screen),
  headerRow);

// ── THE COMPACT LEFT COLUMN: name/Play, then sets x reps, then Form cues.
const cardOrder = ['<ExerciseHeaderRow', 'styles.statsRow', '<CueDisclosure']
  .map((needle) => strengthCard.indexOf(needle));
ok('[10] CONTROL — all three blocks were found in the card',
  cardOrder.every((index) => index >= 0), cardOrder);
ok('[10] the row reads name+Play, then sets x reps, then Form cues — in that order',
  cardOrder[0] < cardOrder[1] && cardOrder[1] < cardOrder[2], cardOrder);
ok('[10] and the gaps between those three are tightened, not merely present',
  /exerciseHeaderRow:\s*\{[^}]*marginBottom:\s*2\b/.test(screen)
    && /statsRow:\s*\{[^}]*marginTop:\s*2\b/.test(screen)
    && /cueContainer:\s*\{\s*marginTop:\s*1\s*\}/.test(screen),
  'the three intra-row gaps must be small and explicit');
ok('[10] sets/reps is still the LEFT of the control row',
  /<View style=\{styles\.statsRow\}>\s*<Text\s*style=\{styles\.statsPrimary\}/.test(screen));

// ── WEIGHT AND CHECKBOX SHARE ONE CONTROL ROW, TICK IMMEDIATELY RIGHT.
const statsRowBlock = strengthCard.slice(
  strengthCard.indexOf('<View style={styles.statsRow}>'),
  strengthCard.indexOf('{/* ⚠ **POWER SHOWS NO REST LINE'));
ok('[10] CONTROL — the control row block was found',
  statsRowBlock.length > 200, statsRowBlock.length);
ok('[10] the weight stepper and the checkbox are in the SAME control row',
  statsRowBlock.includes('styles.weightControl')
    && statsRowBlock.includes('controlRowCheckboxSlot'),
  statsRowBlock.slice(-400));
ok('[10] and the checkbox comes IMMEDIATELY AFTER the stepper, not before it',
  statsRowBlock.indexOf('styles.weightControl')
    < statsRowBlock.indexOf('controlRowCheckboxSlot'),
  { stepper: statsRowBlock.indexOf('styles.weightControl'),
    checkbox: statsRowBlock.indexOf('controlRowCheckboxSlot') });
ok('[10] a row with NO stepper still reserves the same right-side slot',
  /controlRowCheckboxSlot:\s*\{[^}]*width:\s*32/.test(screen)
    && /recoveryControlRow:/.test(screen) && /addonCheckboxSlot:/.test(screen),
  'the slot is a fixed width so the tick column cannot wander between rows');

// ── THE ICONS.
ok('[10] the calendar icon renders immediately before the date',
  /session-header-calendar-icon[\s\S]{0,400}<Text style=\{styles\.headerSubtitle\}>/.test(screen)
    && /name="calendar-blank-outline"/.test(screen),
  'calendar then date, in that order');
ok('[10] the date row stays ONE accessibility element speaking the date, not the glyph',
  /styles\.headerSubtitleRow[\s\S]{0,200}accessibilityLabel=\{combinedSubtitle\}/.test(screen));
ok('[10] all three ruled section headings carry a distinct icon',
  /SECTION_HEADING_ICON[\s\S]{0,300}mobility:\s*'run'[\s\S]{0,80}strength:\s*'dumbbell'[\s\S]{0,80}conditioning:\s*'fire'/
    .test(screen),
  'Mobility / Strength / Conditioning, three different glyphs');
ok('[10] the icons are keyed on the TYPED section id, never on the label string',
  /SECTION_HEADING_ICON\[section\.id\]/.test(screen)
    && !/SECTION_HEADING_ICON\[section\.label\]/.test(screen));
ok('[10] and they come from the existing icon set — no new graphic asset',
  /SECTION_HEADING_ICON: Partial<Record<SessionExecutionSectionId,\s*\n?\s*React\.ComponentProps<typeof MaterialCommunityIcons>\['name'\]>>/
    .test(screen));

// ── POWER IS AN ORDINARY ROW.
ok('[10] Power shows no rest line — the one format that made it look special',
  /restLabel && exercise\?\.role !== 'power' \?/.test(screen), 'the rest Text is role-gated');
ok('[10] and hiding it DELETES NO DATA — restSeconds is still read, unchanged',
  /const restLabel = exercise\.restSeconds[\s\S]{0,80}formatRest\(exercise\.restSeconds\)/
    .test(strengthCard)
    && !/restSeconds:\s*(null|undefined|0)\b/.test(strengthCard),
  strengthCard.split('\n').filter((l: string) => /restSeconds/.test(l)));
ok('[10] Power has no separate row component and no section of its own',
  (screen.match(/function StrengthExerciseCard/g) ?? []).length === 1
    && !/function PowerRow|function PowerExerciseCard/.test(screen)
    && !withPower.sections.some((section) => String(section.id) === 'power'));

// ── EVERY ROW KIND STILL FUNCTIONS, THROUGH THE ONE OWNER.
ok('[10] Mobility, Strength, Power and contrast rows all reach the one card',
  /<StrengthExerciseCard/.test(mobilityRenderer)
    && (screen.match(/<StrengthExerciseCard/g) ?? []).length >= 2,
  'one card component, every strength-family row');
ok('[10] Conditioning still renders its own choice row, untouched by this slice',
  /function ConditioningChoiceRow/.test(screen) && /conditioning-choice-row/.test(screen));
ok('[10] every checklist call site hands the checkbox down — none dropped it',
  (screen.match(/<ExecutionChecklistItem/g) ?? []).length
    === (screen.match(/\{\(checkbox\) => \(/g) ?? []).length
    && (screen.match(/<ExecutionChecklistItem/g) ?? []).length >= 4,
  { sites: (screen.match(/<ExecutionChecklistItem/g) ?? []).length,
    handlers: (screen.match(/\{\(checkbox\) => \(/g) ?? []).length });

// ── INDEPENDENTLY TAPPABLE, AND NOT OVERLAPPING.
ok('[10] the checkbox and Play are separate Pressables with their own handlers',
  /onPress=\{\(\) => onToggle\(itemId\)\}/.test(checklistItemWhole)
    && /<PlayButton onPress=\{onPlay\}/.test(headerRow)
    && !/onPlay[\s\S]{0,60}onToggle/.test(headerRow));
ok('[10] both keep a practical tap target — neither shrank to fit the tighter row',
  /hitSlop=\{\{ top: 10, bottom: 10, left: 8, right: 10 \}\}/.test(checklistItemWhole)
    && /hitSlop=\{\{ top: 8, bottom: 8, left: 8, right: 8 \}\}/.test(screen),
  'checkbox and PlayButton both carry hitSlop');
ok('[10] a long name wraps instead of pushing the controls off the row',
  /exerciseNamePress:\s*\{[^}]*flexShrink:\s*1/.test(screen)
    && /numberOfLines=\{2\}/.test(headerRow)
    && /exerciseNameGroup:\s*\{[^}]*flex:\s*1/.test(screen),
  'the name shrinks and wraps; the control slot is fixed-width and cannot be squeezed');
ok('[10] and the control row cannot be overrun by larger text',
  /controlRowCheckboxSlot:\s*\{[^}]*width:\s*32[^}]*alignItems:\s*'flex-end'/.test(screen)
    && /statsRow:\s*\{[^}]*justifyContent:\s*'space-between'/.test(screen),
  'a fixed slot plus space-between keeps the tick in its column at any text size');

console.log(`\nsessionExecutionChecklistTests: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
if (fail > 0) { console.log(`Failures: ${failures.join(', ')}`); process.exit(1); }
