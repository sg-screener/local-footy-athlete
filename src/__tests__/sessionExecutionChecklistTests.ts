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
  buildSessionEquipmentReplacementPlan,
  deriveSessionEquipmentRequirements,
  missingSessionEquipmentValues,
  sessionConditioningReplacementName,
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
ok('every checkbox is centred against its complete exercise row',
  /executionItem:\s*\{[^}]*alignItems:\s*'center'/.test(screen)
    && /executionCheckbox:\s*\{[^}]*\.\.\.sessionExecutionCheckbox[^}]*\}/.test(screen)
    && !/executionCheckbox:\s*\{[^}]*marginTop/.test(screen));
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
ok('a missing rower becomes same-tier bike work when the saved kit still has a bike',
  sessionConditioningReplacementName({
    exerciseName: 'Easy Row',
    availableModalities: ['bike_erg', 'row'],
    missingModalities: new Set(['row']),
  }) === 'Easy Bike');
ok('a missing rower is not invented into a bike when no machine remains',
  sessionConditioningReplacementName({
    exerciseName: 'Easy Row',
    availableModalities: ['row'],
    missingModalities: new Set(['row']),
  }) === null);
const replacementPlan = buildSessionEquipmentReplacementPlan({
  exercises: equipmentRows,
  requirements,
  missingKeys: new Set(['modality:row']),
  capabilities: {
    tags: ['bodyweight', 'barbell', 'bike_or_treadmill'],
    conditioningModalities: ['bike_erg', 'row'],
    selectionCompleteness: 'complete',
    source: 'athlete_answer',
  },
  environment: {
    activeInjuries: {},
    primaryInjury: null,
    availableEquipment: ['bodyweight', 'barbell'],
    availableEquipmentTags: ['bodyweight', 'barbell', 'bike_or_treadmill'],
    readiness: 'high',
    hasEquipmentConstraint: false,
    medicalStop: false,
  },
});
ok('the pure whole-session planner turns the affected row into Easy Bike',
  replacementPlan.ok
    && replacementPlan.replacements.length === 1
    && replacementPlan.replacements[0].fromExercise === 'Easy Row'
    && replacementPlan.replacements[0].toExercise.name === 'Easy Bike');
const sessionEquipmentSheet = fs.readFileSync(
  path.resolve(__dirname, '..', 'screens', 'home', 'SessionEquipmentSheet.tsx'),
  'utf8',
);
ok('the opened-session icon mounts the one session equipment sheet',
  /testID="day-workout-equipment-concern-action"/.test(screen)
    && /<SessionEquipmentSheet/.test(screen)
    && /requirements=\{sessionEquipmentRequirements\}/.test(screen));
ok('temporary swaps are today-only and create no active modifier',
  /surface: 'session_equipment_sheet'/.test(screen)
    && /scope: 'today_only'/.test(screen)
    && /createsActiveModifier: false/.test(screen));
ok('the Day screen has no Equipment shortcut',
  !/setEquipmentVisible\(true\)/.test(home)
    && !/home-equipment-limitation-sheet/.test(home));
ok('the sheet lists derived requirements rather than the whole saved kit',
  /requirements\.map/.test(sessionEquipmentSheet)
    && !/ownedEquipmentKit\(\)/.test(sessionEquipmentSheet));
ok('the sheet keeps permanent equipment changes in Profile',
  /Permanent change\? Update your equipment in Profile\./.test(sessionEquipmentSheet));

console.log(`\nsessionExecutionChecklistTests: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
if (fail > 0) { console.log(`Failures: ${failures.join(', ')}`); process.exit(1); }
