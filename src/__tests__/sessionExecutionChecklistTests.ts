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
ok('checklist rejects the retired 1-10 scale', buildSessionFeedbackPayload({
  dateStr: '2026-08-11',
  completion: 'partial',
  components: sectionSummary.components,
  componentCompletions: sectionSummary.componentCompletions,
  componentReasons: {}, feeling: null, soreness: null, partialReason: null, skipReason: null,
  executionItems: sectionSummary.items,
  difficulty: 7,
}) === null);

console.log('\n[3] The live screen uses controlled chevrons and checkboxes');
const screen = fs.readFileSync(path.resolve(__dirname, '..', 'screens', 'home', 'DayWorkoutScreenV2.tsx'), 'utf8');
const mobility = fs.readFileSync(path.resolve(__dirname, '..', 'components', 'MobilityPrehabFlowSection.tsx'), 'utf8');
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
ok('mobility movements use the same controlled tick owner', /completedItemIds/.test(mobility) && /onToggleItem/.test(mobility));
const mobilitySectionAt = screen.indexOf("filter((section) => section.id === 'mobility')");
const mobilityRowsAt = screen.indexOf('<MobilityPrehabFlowSection', mobilitySectionAt);
ok('mobility uses the same chevron owner as the other sections',
  mobilitySectionAt >= 0 && mobilityRowsAt > mobilitySectionAt &&
    screen.slice(mobilitySectionAt, mobilityRowsAt).includes('<SessionExecutionSection') &&
    !/chevron-up|chevron-down|useState\(false\)/.test(mobility));
ok('Team Training expands as a plain checklist row, not an accent card',
  /function TeamTrainingRow/.test(screen) && /styles\.exerciseCard/.test(screen) &&
    !/function TeamTrainingBanner|teamTrainingCard|teamTrainingBody/.test(screen));
ok('mobility has no optional wording in text or accessibility copy',
  !/\boptional\b/i.test(mobility));
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
ok('feedback asks the 1-5 effort question', /How hard was the session\?/.test(feedback));
ok('all five choices are generated on one non-wrapping row',
  /Array\.from\(\{ length: 5 \}/.test(feedback) && /fillRow/.test(feedback) &&
    !/rpeGrid:\s*\{[\s\S]{0,120}flexWrap/.test(feedback));
ok('effort anchors say very easy and very hard', /1 = very easy · 5 = very hard/.test(feedback));
ok('saved difficulty is the session RPE in checklist mode',
  /difficulty:\s*executionSummary\s*\?\s*sessionRpeValue\s*:\s*conditioningRpeValue/.test(feedback));

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
