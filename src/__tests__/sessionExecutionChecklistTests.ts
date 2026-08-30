/** Session execution checklist ownership. Run: npm run test:session-execution */
import * as fs from 'fs';
import * as path from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import {
  PART_ICON_KIND,
  SESSION_SECTION_ICON_KIND,
} from '../rules/sectionIconKinds';
import {
  buildSessionExecutionPlan,
  buildSessionExecutionSummary,
  deriveChecklistComponentCompletions,
  deriveSessionExecutionCompletion,
  reconcileRecordedSessionExecution,
  recordedCompletedSessionExecutionItemIds,
  recordedExecutionSectionCompletion,
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
ok('the saved item evidence returns full Mobility to the day view',
  recordedExecutionSectionCompletion(plan, {
    completion: 'full',
    executionItems: buildSessionExecutionSummary(plan, everyPrescribedItem).items,
  }, 'mobility') === 'full');
ok('partial Mobility remains a completed partial result for the day-view tick',
  recordedExecutionSectionCompletion(plan, {
    completion: 'partial',
    executionItems: buildSessionExecutionSummary(
      plan,
      new Set(plan.items.filter((item) => item.sectionId === 'mobility').slice(0, 1)
        .map((item) => item.id)),
    ).items,
  }, 'mobility') === 'partial');
ok('legacy full completion restores the Mobility tick without inventing a partial result',
  recordedExecutionSectionCompletion(plan, { completion: 'full' }, 'mobility') === 'full'
    && recordedExecutionSectionCompletion(plan, { completion: 'partial' }, 'mobility') === null);

const recordedPartial = buildSessionExecutionSummary(plan, new Set([
  plan.items.find((item) => item.sectionId === 'mobility')!.id,
  plan.items.find((item) => item.sectionId === 'strength')!.id,
]));
const restoredPartialIds = recordedCompletedSessionExecutionItemIds(plan, {
  completion: 'partial',
  executionItems: [
    ...recordedPartial.items,
    { itemId: 'exercise:no-longer-in-plan', sectionId: 'strength', componentId: 'strength', completed: true },
  ],
});
ok('reopening restores the exact completed checklist items by stable id',
  restoredPartialIds.size === 2
    && recordedPartial.items.every((item) => restoredPartialIds.has(item.itemId) === item.completed),
  { restored: [...restoredPartialIds], saved: recordedPartial.items });
ok('reopening ignores saved item ids that are no longer in the visible plan',
  !restoredPartialIds.has('exercise:no-longer-in-plan'));
const replacedMobilityId = plan.items.find((item) => item.sectionId === 'mobility')!.id;
const changedMobilityPlan = {
  ...plan,
  items: plan.items.map((item) => item.id === replacedMobilityId
    ? { ...item, id: `replacement:${item.id}` }
    : item),
  sections: plan.sections.map((section) => ({
    ...section,
    items: section.items.map((item) => item.id === replacedMobilityId
      ? { ...item, id: `replacement:${item.id}` }
      : item),
  })),
};
const oldFullFeedback = {
  completion: 'full' as const,
  executionItems: buildSessionExecutionSummary(plan, everyPrescribedItem).items,
};
const changedReconciliation = reconcileRecordedSessionExecution(
  changedMobilityPlan,
  oldFullFeedback,
);
ok('a replaced Mobility plan cannot keep the old day-card tick while reopening unticked',
  recordedExecutionSectionCompletion(changedMobilityPlan, oldFullFeedback, 'mobility') === null
    && [...recordedCompletedSessionExecutionItemIds(changedMobilityPlan, oldFullFeedback)]
      .every((id) => !id.startsWith('replacement:'))
    && changedReconciliation.source === 'exact_items'
    && changedReconciliation.orphanedItems.length === 1);
const gameOnlyFull = {
  completion: 'full' as const,
  game: { playedWholeGame: true, timeOnGroundMinutes: 80, bodyRpe: 7, feel: 3 as const },
};
ok('a game-only full result never fabricates programmed-session checklist evidence',
  recordedCompletedSessionExecutionItemIds(plan, gameOnlyFull).size === 0
    && recordedExecutionSectionCompletion(plan, gameOnlyFull, 'mobility') === null);
ok('rebuilding after reopen reproduces the saved item evidence',
  JSON.stringify(buildSessionExecutionSummary(plan, restoredPartialIds).items)
    === JSON.stringify(recordedPartial.items));
const restoredLegacyFullIds = recordedCompletedSessionExecutionItemIds(plan, {
  completion: 'full',
});
ok('a legacy full result restores prescribed work without inventing optional completion',
  plan.items.every((item) => restoredLegacyFullIds.has(item.id) === (item.sectionId !== 'optional')));

const teamWorkout: any = {
  id: 'team-session',
  name: 'Strength + Team Training',
  workoutType: 'Team Training',
  exercises: [
    row('press', 'Bench Press'),
    {
      id: 'club', exerciseId: 'exercise-club', workoutType: 'Team Training',
      exercise: { id: 'library-club', name: 'Team Training' },
    },
  ],
};
const teamPlan = buildSessionExecutionPlan({
  workout: teamWorkout,
  template: buildSessionTemplate(teamWorkout),
  mobilityFlow: null,
});
/**
 * ⚠ **RE-AIMED 2026-08-22 — THE CLUB TICK IS GONE ON PURPOSE.** Sam: *"inside
 * the session view - we no longer need reference to team training so remove the
 * box with the chevron drop down saying team training ... and remove the team
 * training area of the session feedback form"*. Club training has its own card
 * and its own feedback form on the day view; this plan is the GYM session's
 * checklist and must not offer a second place to answer the same question.
 *
 * The cell now holds the ABSENCE, so a club item creeping back into the gym
 * checklist reds rather than passing quietly.
 */
const clubItem = teamPlan.items.find((item) => item.sectionId === 'team_training');
ok('the gym checklist carries no Club session item — club training has its own form',
  clubItem === undefined);
ok('and a club night still has its programmed work to tick',
  teamPlan.items.some((item) => item.sectionId !== 'team_training'));

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
/* ⚠ SUPERSEDED A SECOND TIME — R-116 third pass. This asserted the tick sat on
 * the NAME line via `alignItems: 'flex-start'` + a `marginTop` on the box. Sam
 * has moved it onto the control row beside the stepper, and that `marginTop` was
 * the drift he then rejected. The wrapper now adds NO geometry at all, which is
 * what this cell watches — the coordinates are the same, the claim is current. */
ok('the checklist wrapper imposes no geometry on the row',
  /executionItem:\s*\{\}/.test(screen)
    && !/executionCheckbox:\s*\{[^}]*marginTop/.test(screen));
ok('mobility movements use the same controlled checklist owner',
  /function MobilityExerciseList/.test(screen)
    && /completedItemIds\.has\(itemId\)/.test(screen)
    && /onToggle=\{onToggleItem\}/.test(screen));
ok('the day card reads Mobility completion from that saved checklist owner',
  /reconcileRecordedSessionExecution\(executionPlan, sessionFeedback\[day\.date\]\)/.test(home)
    && /dayTimeline\(visibleDay, sessionFeedback\[day\.date\], projectedWorkout, recordedExecution\)/.test(home)
    && /mobilityCompletion=\{recordedExecution\?\.sectionCompletions\.mobility \?\? null\}/.test(home)
    && /day-timeline-complete-mobility-warmup-\$\{mobilityCompletion\}/.test(home)
    && /mobilityCompletion === 'full' \|\| mobilityCompletion === 'partial'/.test(home));
ok('mobility and every other session row use one square checkbox recipe',
  /sessionExecutionCheckbox/.test(screen)
    && /\.\.\.sessionExecutionCheckbox/.test(screen)
    && !/MobilityPrehabFlowSection/.test(screen));
const mobilityRendererAt = screen.indexOf('function MobilityExerciseList');
const sessionListAt = screen.indexOf('function SessionList', mobilityRendererAt);
const mobilityRenderer = mobilityRendererAt >= 0 && sessionListAt > mobilityRendererAt
  ? screen.slice(mobilityRendererAt, sessionListAt)
  : '';
ok('mobility uses the shared section mapper, including mixed derived and added rows',
  sessionListAt >= 0 && /const sections = executionPlan.sections;/.test(screen.slice(sessionListAt))
    && /section.items.some\(\(item\) => item.source === 'mobility'\) \? mobilityContent/.test(screen.slice(sessionListAt))
    && /mobilityContent=\{/.test(screen)
    && !/chevron-up|chevron-down|useState\(false\)/.test(mobilityRenderer));
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
const teamTrainingRowStart = screen.indexOf('function TeamTrainingRow');
const teamTrainingRowEnd = screen.indexOf('/**\n * Common exercise header', teamTrainingRowStart);
const teamTrainingRow = teamTrainingRowStart >= 0 && teamTrainingRowEnd > teamTrainingRowStart
  ? screen.slice(teamTrainingRowStart, teamTrainingRowEnd)
  : '';
ok('the Team Training row receives and renders its existing checklist checkbox',
  teamTrainingRow.length > 0
    && /<TeamTrainingRow key=\{key\} checkbox=\{checkbox\}/.test(screen)
    && /checkbox\?: React\.ReactNode/.test(teamTrainingRow)
    && /\{checkbox\}/.test(teamTrainingRow));
ok('mobility has no optional wording in text or accessibility copy',
  !/\boptional\b/i.test(mobilityRenderer));
ok('the in-progress checklist is a screen draft', /useState<ReadonlySet<string>>/.test(screen) && /setCompletedExerciseIds/.test(screen));
ok('the durable outcome owns the per-item result', /executionItems:\s*executionSummary\?\.items/.test(feedback));
ok('saving game feedback carries prior checklist evidence instead of erasing it',
  /const feedback: SessionFeedback = \{\s*\.\.\.\(existing \?\? \{\}\),[\s\S]{0,180}?game,/.test(feedback)
    && /bodyRpe,\s*canSave,\s*date,\s*existing,\s*gameFeel,/.test(feedback));
ok('the reopened screen hydrates from the same durable item evidence',
  /persistedFeedback/.test(screen)
    && /recordedCompletedSessionExecutionItemIds\(executionPlan, persistedFeedback\)/.test(screen)
    && /setCompletedExerciseIds/.test(screen));

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
  TEAM_TRAINING_FEEDBACK_COPY.durationQuestion === 'Time spent training (estimate)'
    && TEAM_TRAINING_FEEDBACK_COPY.effortQuestion === 'How hard was team training?'
    && /TEAM_TRAINING_FEEDBACK_COPY\.durationQuestion/.test(feedback)
    && /TEAM_TRAINING_FEEDBACK_COPY\.effortQuestion/.test(feedback)
    && !/club-training-feedback-hours/.test(feedback)
    && /club-training-feedback-minutes/.test(feedback)
    && /club-training-feedback-effort-grid/.test(feedback)
    && /<EffortSlider/.test(feedback));
ok('separate gym feedback never waits on the later club-training answer',
  /const draftIsComplete = baseDraftIsComplete;/.test(feedback));
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
  /testID="session-options-equipment"/.test(screen)
    && /<SessionEquipmentSheet/.test(screen)
    && /requirements=\{sessionEquipmentRequirements\}/.test(screen));
// ⚠ **THIS CELL USED TO MATCH `createsActiveModifier: false` ANYWHERE IN THE
// FILE, and after the planner's swap loop was deleted it would have gone on
// passing on a string belonging to the live Swap door — green on a property it
// had stopped watching.** It reads the equipment handler's own body now.
const equipmentStart = screen.indexOf('const applySessionEquipment');
const equipmentEnd = screen.indexOf('const reviewSessionInjury', equipmentStart);
ok('equipment handler anchors are found in order', equipmentStart >= 0 && equipmentEnd > equipmentStart);
const equipmentHandlerBody = screen.slice(equipmentStart, equipmentEnd)
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
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
const cueDisclosure = screen.slice(
  screen.indexOf('function CueDisclosure'),
  screen.indexOf('function FinishMoment'));
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

ok('[7] the name line no longer carries the play button',
  !/<PlayButton/.test(headerRow) && /numberOfLines=\{2\}/.test(headerRow),
  headerRow);
ok('[7] play sits beside Form cues in the shared cue row',
  /styles\.cueActionRow[\s\S]*?styles\.cueToggleRow[\s\S]*?<PlayButton/.test(cueDisclosure)
    && /cueActionRow:\s*\{[^}]*flexDirection:\s*'row'[^}]*alignItems:\s*'center'/.test(screen),
  cueDisclosure);
ok('[7] moving play gives the exercise name the full header width',
  /<View style=\{styles\.exerciseNameWrap\}>/.test(headerRow)
    && /exerciseNameWrap:\s*\{[^}]*flex:\s*1/.test(screen)
    && /exerciseNamePress:\s*\{[^}]*flexShrink:\s*1/.test(screen)
    && !/<PlayButton/.test(headerRow));

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
    && /accessibilityState=\{\{ checked: completed, disabled: readOnly \}\}/.test(checklistItemWhole) && /disabled=\{readOnly\}/.test(checklistItemWhole)
    && /testID=\{`session-execution-check-\$\{stableTestIdToken\(itemId\)\}`\}/.test(checklistItemWhole));
ok('[7] the checkbox keeps its spoken label',
  /accessibilityLabel=\{`\$\{completed \? 'Completed' : 'Mark complete'\}: \$\{label\}`\}/
    .test(checklistItemWhole));
ok('[7] both the name and the moved play button still speak the exercise and play it',
  /accessibilityLabel=\{`Play \$\{name\} demo`\}/.test(headerRow)
    && /onPress=\{onPlay\}/.test(headerRow)
    && /<PlayButton onPress=\{onPlay\}/.test(cueDisclosure)
    && /accessibilityLabel=\{playAccessibilityLabel\}/.test(cueDisclosure));

// ── SETS/REPS LOWER LEFT, WEIGHT LOWER RIGHT — UNMOVED.
/* ⚠ `space-between` WAS REJECTED — SAM, 2026-08-20, second pass on R-116:
  * *"Do not use `space-between` or separate screen columns."* It spread the row
  * edge to edge, leaving the tick at the screen margin with a gulf between it
  * and the stepper it belongs to. The claim survives in its true form — the
  * dose reads on the left, the controls on the right — but it is now a LEFT
  * COLUMN that takes the free width and a control GROUP that does not. */
ok('[7] sets/reps stay lower-left and the controls lower-right, WITHOUT space-between',
  /statsRow:\s*\{[^}]*flexDirection:\s*'row'/.test(screen)
    && !/statsRow:\s*\{[^}]*justifyContent:\s*'space-between'/.test(screen)
    && /statsLeftColumn:\s*\{\s*flex:\s*1/.test(screen)
    && /<View style=\{styles\.statsLeftColumn\}>\s*<Text/.test(screen)
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

// ── PLAY MOVES TO THE FIXED CUE LINE, SO LONG TITLES CANNOT MOVE IT.
ok('[10] Play is aligned beside Form cues, not attached to the exercise title',
  !/<PlayButton/.test(headerRow)
    && /styles\.cueActionRow[\s\S]*?<PlayButton/.test(cueDisclosure),
  { headerRow, cueDisclosure });

// ── THE COMPACT LEFT COLUMN: name/Play, then sets x reps, then Form cues.
const cardOrder = ['<ExerciseHeaderRow', 'styles.statsRow', '<CueDisclosure']
  .map((needle) => strengthCard.indexOf(needle));
ok('[10] CONTROL — all three blocks were found in the card',
  cardOrder.every((index) => index >= 0), cardOrder);
ok('[10] the row reads name, then sets x reps, then Form cues + Play — in that order',
  cardOrder[0] < cardOrder[1] && cardOrder[1] < cardOrder[2], cardOrder);
/* SECOND PASS: *"compress … MATERIALLY … so these read as one compact unit,
  * not three separate rows."* Gaps alone were not enough — the ROW PADDING is
  * asserted too, which is what the first cut missed. */
ok('[10] the three lines are compressed materially — gaps AND row padding',
  /exerciseHeaderRow:\s*\{[^}]*marginBottom:\s*0\b/.test(screen)
    && /statsRow:\s*\{[^}]*marginTop:\s*[234]\b/.test(screen)
    && /cueContainer:\s*\{\s*marginTop:\s*[234]\s*\}/.test(screen)
    && /cueToggleRow:\s*\{[^}]*paddingVertical:\s*1\b/.test(screen)
    // The card's padding is the CONTAINER's now (asserted in its own cell); what
    // this one still owns is that the three LINES sit tight inside it.
    && /exerciseHeaderRow:\s*\{[^}]*marginBottom:\s*0\b/.test(screen),
  'the three lines must sit tight inside whatever padding the container has');
ok('[10] and the separation BETWEEN exercises stays larger than the gaps inside one',
  /exerciseList:\s*\{\s*gap:\s*8\s*\}/.test(screen),
  '~8px between cards; 2-4px between the lines inside one');
ok('[10] sets/reps is still the LEFT of the control row',
  /<View style=\{styles\.statsRow\}>\s*<View style=\{styles\.statsLeftColumn\}>\s*<Text/.test(screen));

// ── WEIGHT AND CHECKBOX SHARE ONE CONTROL ROW, TICK IMMEDIATELY RIGHT.
const statsRowBlock = strengthCard.slice(
  strengthCard.indexOf('<View style={styles.statsRow}>'),
  strengthCard.indexOf('{/* ⚠ **POWER SHOWS NO REST LINE'));
ok('[10] CONTROL — the control row block was found',
  statsRowBlock.length > 200, statsRowBlock.length);
/* ══ THE ROW GRID AND THE ONE CONTROL ROW — SAM, THIRD PASS ══════════════════
 *
 * *"one fixed-width number gutter; one left content column; … all three content
 * lines must share the exact same left edge"* and *"The weight stepper and
 * checkbox must be sibling children of one `controlsRow`."*
 *
 * ⚠ **HOW THE CENTRE-Y CLAIM IS PROVEN WITHOUT A RENDERER, SAID PLAINLY.**
 * This repo ships no native renderer, so nothing here MEASURES pixels. What it
 * does instead is check the PRECONDITIONS of the alignment theorem: in a flex
 * row with `alignItems: 'center'`, two siblings' centre-Y coincide EXACTLY —
 * unless one carries an independent offset. So the cells assert (a) the row is
 * that row, (b) the two controls are siblings inside it with nothing between
 * them, and (c) NEITHER carries a margin, top, position or transform that could
 * move one without the other. Those three together make drift impossible by
 * construction. The rendered proof is the screenshot with guides; this is what
 * stops it regressing.
 */
const cardSource = strengthCard;
const styleBlock = (name: string): string => {
  const m = new RegExp(`\\n  ${name}: \\{[\\s\\S]*?\\n  \\},`).exec(screen);
  return m ? m[0] : '';
};
const controlsRowStyle = styleBlock('controlsRow');
const checkboxStyle = styleBlock('executionCheckbox');
const weightStyle = styleBlock('weightControl');
const controlsRowStart = cardSource.indexOf('<View style={styles.controlsRow}>');
const controlsRowCheckbox = cardSource.indexOf('{checkbox}', controlsRowStart);
const controlsRowSource = controlsRowStart >= 0 && controlsRowCheckbox > controlsRowStart
  ? cardSource.slice(controlsRowStart, controlsRowCheckbox + '{checkbox}'.length)
  : '';

ok('[10] CONTROL — the three style blocks under test were all found',
  !!controlsRowStyle && !!checkboxStyle && !!weightStyle,
  { controlsRow: controlsRowStyle.length, checkbox: checkboxStyle.length,
    weight: weightStyle.length });

ok('[10] the stepper and the checkbox are SIBLINGS in one controlsRow',
  controlsRowSource.length > 0
    && /styles\.weightControl/.test(controlsRowSource)
    && /\{checkbox\}$/.test(controlsRowSource.trim())
    && !/<View[^>]*>[\s\S]*\{checkbox\}[\s\S]*<\/View>/.test(
      controlsRowSource.slice(controlsRowSource.indexOf('styles.weightControl'))),
  controlsRowSource.slice(0, 500));
ok('[10] that row is flexDirection row + alignItems center — the only thing aligning them',
  /flexDirection:\s*'row'/.test(controlsRowStyle)
    && /alignItems:\s*'center'/.test(controlsRowStyle),
  controlsRowStyle);
ok('[10] with the ruled 8-10px fixed gap and no shrink',
  /gap:\s*(8|9|10)\b/.test(controlsRowStyle) && /flexShrink:\s*0/.test(controlsRowStyle),
  controlsRowStyle);

/* ⚠ THE DRIFT ITSELF: any independent offset on either control. */
const OFFSETS = /(marginTop|marginBottom|marginVertical|top:|bottom:|transform|position:\s*'absolute'|alignSelf)/;
/* COMMENTS STRIPPED: the style blocks NAME the properties they forbid, so a raw
 * grep reads the documentation as the offset. Same trap the projection cell hit. */
const codeOnly = (block: string): string => block
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
ok('[10] CONTROL — stripping comments leaves the real declarations behind',
  /borderRadius/.test(codeOnly(weightStyle))
    && /sessionExecutionCheckbox/.test(codeOnly(checkboxStyle)));
const liveLoadControlSource = codeOnly(controlsRowSource);
ok('[10] CONTROL — all live load-label routes were found before sizing is asserted',
  liveLoadControlSource.length > 500
    && /loadControlMode === 'bodyweight'/.test(liveLoadControlSource)
    && /loadControlMode === 'band'/.test(liveLoadControlSource)
    && /Edit weight, \$\{displayedWeight\}/.test(liveLoadControlSource),
  liveLoadControlSource.slice(0, 500));
ok('[10] live load labels keep the authored readable size after a stepper update',
  !/adjustsFontSizeToFit|minimumFontScale/.test(liveLoadControlSource),
  'native iOS auto-fit can collapse a transiently measured label to its 4pt floor');
ok('[10] NEITHER control carries an independent vertical offset',
  !OFFSETS.test(codeOnly(checkboxStyle)) && !OFFSETS.test(codeOnly(weightStyle)),
  { checkbox: codeOnly(checkboxStyle), weight: codeOnly(weightStyle) });
ok('[10] and the old `marginTop: 3` that caused the drift is gone for good',
  !/executionCheckbox:\s*\{[^}]*marginTop/.test(screen),
  'it nudged the tick onto the NAME line under R-111 and was never removed');
ok('[10] nor does the shared checkbox recipe carry one',
  !OFFSETS.test(fs.readFileSync(
    path.resolve(__dirname, '..', 'theme', 'sessionExecutionCheckbox.ts'), 'utf8')),
  'the recipe every surface shares must not offset it either');
ok('[10] and the checklist wrapper adds no competing geometry',
  /executionItem:\s*\{\}/.test(screen),
  'a direction or gap here would fight the card for the row');

/* SIX DIFFERENTLY SHAPED ROWS — every one reaches the SAME controlsRow, so the
 * alignment cannot depend on the row's shape. The shapes are the ones that
 * differ in height: they are what "drift down the list" was made of. */
const ROW_SHAPES: Array<[string, boolean]> = [
  ['bodyweight (BW, no editable load)', !/carriesExternalLoad \?[\s\S]{0,200}controlsRow/.test(cardSource)],
  ['three-digit kilograms', /weightValueWrap/.test(cardSource)],
  ['a long name that wraps to two lines', /numberOfLines=\{2\}/.test(headerRow)],
  ['a row carrying an affected-row notice', /affectedRowNotice \?/.test(cardSource)],
  ['a row with an expanded Form-cue', /<CueDisclosure/.test(cardSource)],
  ['a superset member', /isGrouped && styles\.exerciseCardGrouped/.test(cardSource)],
];
for (const [shape, reached] of ROW_SHAPES) {
  ok(`[10] ${shape} renders through the one controlsRow`, reached, shape);
}
ok('[10] and there is exactly ONE controlsRow in the card — no shape gets its own',
  (cardSource.match(/styles\.controlsRow/g) ?? []).length === 1,
  (cardSource.match(/styles\.controlsRow/g) ?? []).length);
ok('[10] a row with no editable load keeps the column WITHOUT a fake stepper',
  !/controlGroupNoStepper/.test(screen)
    && /addonCheckboxSlot:\s*\{\s*flexDirection:\s*'row',\s*alignItems:\s*'center'\s*\}/.test(screen)
    && !/position:\s*'absolute'/.test(styleBlock('addonCheckboxSlot')),
  'no invented weight control, and no absolute positioning');
ok('[10] band rows use the same stepper for thinner and thicker resistance',
  /loadControlMode === 'band'[\s\S]{0,180}decrementBandResistance/.test(cardSource)
    && /loadControlMode === 'band'[\s\S]{0,180}incrementBandResistance/.test(cardSource)
    && /Band resistance, \$\{displayedWeight\}/.test(cardSource));
ok('[10] unloaded rows cannot accidentally gain a kilogram control',
  /loadControlMode === 'none' \? null/.test(cardSource)
    && /loadControlMode === 'bodyweight'[\s\S]{0,500}\sBW\s[\s\S]{0,80}<\/Text>/.test(cardSource));

/* THE GRID: one gutter, one content column, three lines sharing one left edge. */
ok('[10] the row is a grid: fixed gutter, then one content column',
  /exerciseRowGrid:\s*\{[^}]*flexDirection:\s*'row'/.test(screen)
    && /exerciseNumberGutter:\s*\{[^}]*width:\s*32/.test(screen)
    && /exerciseNumberGutter:\s*\{[^}]*marginLeft:\s*-13/.test(screen)
    && /exerciseNumberGutter:\s*\{[^}]*marginRight:\s*13/.test(screen)
    && /exerciseContentColumn:\s*\{[^}]*flex:\s*1[^}]*minWidth:\s*0/.test(screen));
ok('[10] the NUMBER lives in the gutter, not beside the name',
  /<View style=\{styles\.exerciseNumberGutter\}>[\s\S]{0,160}exerciseLabelText/.test(cardSource)
    && !/exerciseLabelBadge/.test(headerRow),
  'the number as a sibling of the name is what put lines 2 and 3 under it');
ok('[10] the number is centred beside a subtle lime separator',
  /exerciseNumberGutter:\s*\{[^}]*alignItems:\s*'center'[^}]*justifyContent:\s*'center'[^}]*alignSelf:\s*'stretch'/.test(screen)
    && /exerciseNumberGutter:\s*\{[^}]*borderRightWidth:\s*StyleSheet\.hairlineWidth/.test(screen)
    && /exerciseNumberGutter:\s*\{[^}]*borderRightColor:\s*'rgba\(200, 255, 0, 0\.35\)'/.test(screen)
    && /exerciseLabelText:\s*\{[^}]*width:\s*'100%'[^}]*textAlign:\s*'center'/.test(screen),
  'the gutter includes the card padding, so the number centres between the visible edge and divider');
ok('[10] ALL THREE text lines are children of the ONE content column',
  (() => {
    const col = cardSource.indexOf('styles.exerciseContentColumn');
    const close = cardSource.indexOf('</View>\n      </View>\n    </Card>');
    const inside = cardSource.slice(col, close > col ? close : undefined);
    return inside.indexOf('<ExerciseHeaderRow') > 0
      && inside.indexOf('styles.statsRow') > inside.indexOf('<ExerciseHeaderRow')
      && inside.indexOf('<CueDisclosure') > inside.indexOf('styles.statsRow');
  })(),
  'name line, dose line and cues must all sit inside the content column');
ok('[10] the affected-row notice shares that content column left edge',
  /implementBadge:\s*\{[^}]*marginTop:\s*2[^}]*\}/.test(screen)
    && !/implementBadge:\s*\{[^}]*marginLeft/.test(screen)
    && !/implementBadge:\s*\{[^}]*paddingLeft/.test(screen),
  'the swapped-from line is context for the exercise, not a nested child');
ok('[10] a wrapping name cannot push the lower lines back into the gutter',
  /exerciseContentColumn:\s*\{\s*flex:\s*1,\s*minWidth:\s*0/.test(screen)
    && /exerciseNamePress:\s*\{[^}]*flexShrink:\s*1/.test(screen));

/* THE VERTICAL RHYTHM — 1-3px between the three lines, and no more. */
const gapOf = (re: RegExp): number => {
  const m = re.exec(screen);
  return m ? Number(m[1]) : NaN;
};
const RHYTHM = [
  ['name -> dose', gapOf(/statsRow:\s*\{[^}]*marginTop:\s*(\d+)/)],
  ['dose -> cues', gapOf(/cueContainer:\s*\{\s*marginTop:\s*(\d+)/)],
] as const;
for (const [label, value] of RHYTHM) {
  ok(`[10] the ${label} gap is a compact 1-3px, not padding pretending to be one`,
    value >= 1 && value <= 3, value);
}
/* ⚠ **THE CONTROLS ARE BUILT ONCE AND RENDERED IN ONE OF TWO SLOTS** since
   2026-08-27 — Sam: *"when you tap form cues … [they] cover and glitch with the
   weight toggle … you can drop the weight toggle below the last line"*. Pinned
   bottom-right while the row is COLLAPSED (his 2026-08-20 geometry), and moved
   into the flow below the cue when it is OPEN, because an absolute control and
   an expanding text stack share the same corner.
   The law this cell holds is unchanged and is NOT about where they sit: the
   controls must never live inside the DOSE line, where the 34pt stepper would
   set that line's height. So it asserts the two slots exist, that both draw the
   same one `controls`, and that neither is inside `statsRow`. */
ok('[10] the CONTROLS do not determine the text stack\'s height',
  (() => {
    const built = /const controls = \(/.test(cardSource);
    const collapsedSlot = /\{cueOpen \? null : controls\}/.test(cardSource);
    const openSlot = /\{cueOpen \? \([\s\S]{0,600}?stackedControlsSlot\}>\{controls\}<\/View>/.test(cardSource);
    const statsBlock = /<View style=\{styles\.statsRow\}>([\s\S]*?)<\/View>/.exec(cardSource);
    const notInDoseLine = !!statsBlock && !/controls|styles\.controlsRow/.test(statsBlock[1]);
    return built && collapsedSlot && openSlot && notInDoseLine;
  })(),
  'the stepper is ~34px tall; inside the dose line it forced that line to 34px');
ok('[10] and the grid centres them against the whole row',
  /exerciseRowGrid:\s*\{[^}]*alignItems:\s*'center'/.test(screen)
    && /exerciseNumberGutter:\s*\{[^}]*alignSelf:\s*'stretch'/.test(screen),
  'controls centre on the row; the gutter stretches so its number can centre vertically');
/* ══ THE SUBTLE CONTAINER — R-116 FINAL ═════════════════════════════════════
 * *"each exercise should sit inside a subtle compact container … 1px
 * low-contrast neutral border; extremely subtle background tint; 10-12px
 * radius; ~6px vertical and 8px horizontal internal padding; ~5-6px between
 * cards; no shadow."* */
/* ⚠ SAM SUPERSEDED "SIX ON ONE SCREEN" — the card is COMFORTABLE now, and this
 * cell moved with the ruling: ~16px vertical, 12-14 horizontal, ~8 between. */
ok('[10] every exercise sits in one comfortable container, to spec',
  /exerciseCard:\s*\{[^}]*borderWidth:\s*StyleSheet\.hairlineWidth/.test(screen)
    && /exerciseCard:\s*\{[^}]*borderRadius:\s*1[012]\b/.test(screen)
    && /exerciseCard:\s*\{[^}]*paddingTop:\s*16[^}]*paddingBottom:\s*16/.test(screen)
    /* The inset is a NAMED CONSTANT since 2026-08-22 — the "Select all" row has
       to land on exactly the same line as an exercise's checkbox, and two
       literals that happen to agree are two literals that stop agreeing. The
       spec is still pinned: the constant's own value must be 12-14, and the
       card must read it rather than carry its own number. */
    && /const EXERCISE_CARD_INSET = 1[234];/.test(screen)
    && /exerciseCard:\s*\{[^}]*paddingLeft:\s*EXERCISE_CARD_INSET[^}]*paddingRight:\s*EXERCISE_CARD_INSET/.test(screen)
    && /selectAllRow:\s*\{[^}]*paddingLeft:\s*EXERCISE_CARD_INSET[^}]*paddingRight:\s*EXERCISE_CARD_INSET/.test(screen)
    && /exerciseList:\s*\{\s*gap:\s*8\s*\}/.test(screen)
    && /exerciseHeaderRow:\s*\{[^}]*marginBottom:\s*0\b/.test(screen));

/* ── TYPOGRAPHY — current review: upright names; dose matches Form cues. ── */
ok('[10] exercise names are upright in every shared session row',
  /exerciseName:\s*\{[^}]*fontSize:\s*15\b[^}]*fontWeight:\s*'600'/.test(screen)
    && !/exerciseName:\s*\{[^}]*fontStyle/.test(screen));
ok('[10] sets x reps matches the Form cues type size, weight and line height',
  /statsPrimary:\s*\{[^}]*fontSize:\s*12\.5\b[^}]*fontWeight:\s*'400'[^}]*lineHeight:\s*16/.test(screen)
    && !/statsPrimary:\s*\{[^}]*fontStyle/.test(screen)
    && /cueToggleText:\s*\{[^}]*fontSize:\s*12\.5\b[^}]*fontWeight:\s*'400'[^}]*lineHeight:\s*16/.test(screen));
ok('[10] Form cues is 12-13px, REGULAR and muted — not italic, not bold',
  /cueToggleText:\s*\{[^}]*fontSize:\s*12(\.5)?\b[^}]*fontWeight:\s*'400'/.test(screen)
    && !/cueToggleText:\s*\{[^}]*fontStyle/.test(screen));
/* ⚠ **THE ITALIC ACTUALLY RENDERS, AND THIS IS WHY IT DID NOT — R-116.**
 *
 * Proven on glass with three identical strings at `fontSize: 15, fontWeight:
 * '600', fontStyle: 'italic'`: a raw `<Text>` came out ITALIC, the same raw
 * `<Text>` plus `fontFamily: 'System'` came out UPRIGHT, and so did this app's
 * shared `Text`. The family alone kills it — `'System'` resolves to a concrete
 * face before the italic trait is applied.
 *
 * The shared component was NOT overwriting `fontStyle` and the screen was NOT
 * failing to pass it; both were always correct. So the repair is in `Text` and
 * is the narrowest one possible: the VARIANT's `fontFamily` is dropped for
 * exactly the text that asks for italic and names no family itself. Every
 * upright string in the app keeps `'System'`, because the condition is false
 * for all of it. */
const sharedText = fs.readFileSync(
  path.resolve(__dirname, '..', 'components', 'common', 'Text.tsx'), 'utf8');
ok('[10] the shared Text drops the family ONLY for italic that names no family',
  /wantsItalic && typography\.fontFamily === 'System' && !callerStyle\.fontFamily/
    .test(sharedText)
    && /delete typography\.fontFamily/.test(sharedText));
ok('[10] and it still NEVER overwrites the caller\'s fontStyle',
  /style=\{\[styles\.default, textStyles, style, resolvedLineBox\]\}/.test(sharedText),
  'the caller style is applied after the variant, as it always was');
ok('[10] CONTROL — upright text is untouched: the family is still applied to it',
  /fontFamily: typo\.fontFamily/.test(sharedText)
    && !/delete typography\.fontFamily;\s*\n\s*\}\s*\n\s*delete/.test(sharedText),
  'only the italic branch deletes it; every other variant keeps System');
ok('[10] and the app-wide family was not removed or changed',
  /fontFamily: 'System'/.test(fs.readFileSync(
    path.resolve(__dirname, '..', 'theme', 'typography.ts'), 'utf8')),
  'the theme still names System; only italic callers bypass it');

ok('[10] and no new typeface was introduced for the upright session rows',
  !/fontFamily/.test(strengthCard) && !/fontFamily:/.test(
    screen.slice(screen.indexOf('  exerciseName: {'), screen.indexOf('  exerciseName: {') + 300)),
  'the session rows keep the app\'s existing face');

ok('[10] Play is visually the same scale as the Form cues line',
  /playBtn:\s*\{[^}]*width:\s*16[^}]*height:\s*16[^}]*borderRadius:\s*8/.test(screen)
    && /<Svg width=\{7\} height=\{7\}/.test(screen),
  '16px ring with a 7px triangle beside a 16px text line');
ok('[10] the three lines stay 2-4px apart inside that comfortable card',
  /statsRow:\s*\{[^}]*marginTop:\s*[234]\b/.test(screen)
    && /cueContainer:\s*\{\s*marginTop:\s*[234]\s*\}/.test(screen),
  'generous space AROUND the exercise, tight grouping WITHIN it');
ok('[10] the reduced checkbox is drawn 18px but stays a 44x44 tap target',
  /width:\s*18/.test(fs.readFileSync(
    path.resolve(__dirname, '..', 'theme', 'sessionExecutionCheckbox.ts'), 'utf8'))
    && /hitSlop=\{\{ top: 13, bottom: 13, left: 13, right: 13 \}\}/.test(checklistItemWhole),
  '18 + 13 + 13 = 44 on both axes, symmetric so the tappable centre is the drawn centre');
ok('[10] the weight control matches the sets/reps type scale',
  /weightControl:\s*\{[^}]*height:\s*22/.test(screen)
    && /weightValueText:\s*\{[^}]*fontSize:\s*12\.5[^}]*lineHeight:\s*16/.test(screen)
    && /weightBtnLeft:\s*\{[^}]*width:\s*22/.test(screen)
    && /weightBtnRight:\s*\{[^}]*width:\s*22/.test(screen));
ok('[10] every weight value slot is Medium-width and centres shorter labels',
  /weightValueWrap:\s*\{[^}]*width:\s*60[^}]*alignItems:\s*'center'/.test(screen)
    && /weightInput:\s*\{[^}]*width:\s*60[^}]*textAlign:\s*'center'/.test(screen)
    && /weightValueText:\s*\{[^}]*width:\s*'100%'[^}]*textAlign:\s*'center'/.test(screen)
    && /staticLoadControl:\s*\{[^}]*width:\s*60/.test(screen));
ok('[10] the border is NEUTRAL and the tint subtle — not an accent, not a panel',
  /exerciseCard:\s*\{[^}]*backgroundColor:\s*'rgba\(255, 255, 255, 0\.0[123]\d*\)'/.test(screen)
    && /exerciseCard:\s*\{[^}]*borderColor:\s*'rgba\(255, 255, 255, 0\.0\d+\)'/.test(screen)
    && /exerciseCard:\s*\{[^}]*\.\.\.shadows\.none/.test(screen),
  'a lime edge would read as selected; a shadow would read as a panel');
ok('[10] and the container is NOT a button — no press on the card itself',
  !/<Card[^>]*onPress/.test(cardSource),
  'only the name/Play, the stepper and the tick are pressable');
ok('[10] the container does not disturb the alignment it wraps',
  /exerciseRowGrid:\s*\{[^}]*alignItems:\s*'center'/.test(screen)
    && /exerciseContentColumn:\s*\{[^}]*flex:\s*1[^}]*minWidth:\s*0/.test(screen),
  'padding is on the container; the grid keeps its own geometry');

// ── THE ICONS.
/* ══ THE DATE LINE IS DELETED, AND THESE CELLS NOW WATCH ITS ABSENCE ═════════
 *
 * ⚠ **SAM, 2026-08-25 (R-214): *"can we remove the calendar icon, the Tue 25/8
 * - 8 exercises, then put the start session button in its place?"*** This
 * SUPERSEDES R-116, four passes of which aligned that calendar glyph's optical
 * centre against that date text.
 *
 * ⚠ **THE GUARDS ARE INVERTED, NOT DELETED** (`gate-must-watch-the-deleted-
 * surface`). Six cells demanded the component exist, demanded the screen mount
 * it, and demanded its two boxes share one height. Deleting them would leave
 * the header unwatched at exactly the place it was just rewritten; they now
 * require the removal to STAY removed and the ruled replacement to be there. */
const dateComponentPath = path.resolve(__dirname, '..', 'components', 'SessionDateLine.tsx');
ok('[10] the date component is gone, not merely unmounted',
  !fs.existsSync(dateComponentPath),
  'an unmounted component is a second header waiting to be remounted');
ok('[10] and no screen builds the date line back by hand',
  !/SessionDateLine|CalendarGlyph|session-header-calendar-icon/.test(screen)
    && !/calendar-blank-outline/.test(screen),
  'the glyph must not return as an icon-font name either');
ok('[10] the session header no longer prints a date or an exercise count',
  // Comments stripped: the screen still EXPLAINS the removal, and a cell that
  // reddened on its own explanation would force the reason to be deleted too.
  !/combinedSubtitle|countFragment|dateFragment|metaCount/.test(
    screen.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, ''),
  ),
  'the count read the template only, so it said 8 for 8 strength rows + a 4-movement warm-up');
ok('[10] START SESSION TOOK ITS PLACE — first on the row, before the options dots',
  (() => {
    const row = screen.indexOf('<View style={styles.headerSubtitleRow}>');
    const stopwatch = screen.indexOf('<SessionStopwatchControl', row);
    const dots = screen.indexOf('session-options-button', row);
    return row > 0 && stopwatch > row && dots > stopwatch;
  })(),
  'R-132 put the stopwatch at the right of this line; R-214 moves it to the left');
ok('[10] the row is gated on the DATE, so deleting the words cannot delete the controls',
  /\{date \? \(\s*\n\s*<View style=\{styles\.headerSubtitleRow\}>/.test(screen),
  'it was gated on combinedSubtitle, which Start session would have died with');
ok('[10] the gap ABOVE Start session is the same three terms as the gap below it',
  /headerSubtitleRow: \{[\s\S]{0,900}?marginTop: spacing\.sm \+ spacing\.xs \+ spacing\.sm/.test(screen)
    && /header: \{[\s\S]{0,200}?paddingBottom: spacing\.sm/.test(screen)
    && /scrollContent: \{[\s\S]{0,300}?paddingTop: spacing\.xs/.test(screen)
    && /executionSectionHeader: \{[\s\S]{0,200}?paddingVertical: spacing\.sm/.test(screen),
  'R-214a: written as the SUM, a later spacing pass moves both sides together');
ok('[10] and the retired date caption took its text style with it',
  !/headerSubtitle: \{/.test(screen),
  'a style whose only consumer is deleted is dead weight the next screen will trust');
ok('[10] the stopwatch owns the line height its only remaining consumer needs',
  (() => {
    const stopwatch = fs.readFileSync(
      path.resolve(__dirname, '..', 'components', 'SessionStopwatchControl.tsx'), 'utf8');
    return /export const SESSION_HEADER_LINE_HEIGHT = \d+/.test(stopwatch)
      && /lineHeight: SESSION_HEADER_LINE_HEIGHT/.test(stopwatch)
      && !/SessionDateLine/.test(stopwatch.replace(/\/\*[\s\S]*?\*\//g, ''));
  })(),
  'the measurement moved to its consumer rather than outliving its component');
/* ⚠ **THE ICON GUARDS ARE NOW ABOUT ONE OWNER, NOT THREE NAMES — SAM,
 * 2026-08-20, second pass.** The first cut asserted that three glyphs existed
 * and said nothing about whether they were the DAY SCREEN'S glyphs. They were
 * not: Mobility drew a different icon on each surface and Team Training drew
 * none. These cells run the real maps and compare them kind by kind. */
const iconOwner = fs.readFileSync(
  path.resolve(__dirname, '..', 'components', 'icons', 'SectionIcon.tsx'), 'utf8');
const iconMaps = fs.readFileSync(
  path.resolve(__dirname, '..', 'rules', 'sectionIconKinds.ts'), 'utf8');
/* `home` is already read at the top of this file for section [3]; re-declaring
 * it here is what a second reader of the same source looks like. Reuse it. */

ok('[10] CONTROL — both maps are real and non-empty',
  Object.keys(SESSION_SECTION_ICON_KIND).length >= 8
    && Object.keys(PART_ICON_KIND).length >= 7,
  { sections: Object.keys(SESSION_SECTION_ICON_KIND).length,
    parts: Object.keys(PART_ICON_KIND).length });

/* EVERY SECTION KIND THAT HAS A DAY-SCREEN TWIN DRAWS THE DAY SCREEN'S ICON.
 * The pairs are spelled out rather than derived, because deriving them from the
 * maps under test would make this cell agree with whatever they say. */
const SHARED_KINDS: Array<[keyof typeof SESSION_SECTION_ICON_KIND,
  keyof typeof PART_ICON_KIND]> = [
  ['strength', 'strength'],
  ['conditioning', 'conditioning'],
  ['team_training', 'team_training'],
  ['recovery', 'recovery'],
  ['accessories', 'support'],
];
for (const [sectionId, partKind] of SHARED_KINDS) {
  ok(`[10] the Session and Day screens draw ONE icon for ${sectionId}`,
    SESSION_SECTION_ICON_KIND[sectionId] === PART_ICON_KIND[partKind],
    { session: SESSION_SECTION_ICON_KIND[sectionId], day: PART_ICON_KIND[partKind] });
}
ok('[10] Team Training has an icon at all — it had none, which is what Sam saw',
  !!SESSION_SECTION_ICON_KIND.team_training
    && SESSION_SECTION_ICON_KIND.team_training === 'team');
ok('[10] Mobility draws the Day screen\'s mobility glyph, not a lookalike',
  SESSION_SECTION_ICON_KIND.mobility === 'mobility'
    && /kind === 'mobility'[\s\S]{0,160}LfaIcon name="mobility"/.test(iconOwner));
ok('[10] POWER draws the STRENGTH icon, because power IS strength work (R-110)',
  SESSION_SECTION_ICON_KIND.strength === 'strength'
    && !('power' in (SESSION_SECTION_ICON_KIND as Record<string, unknown>))
    && !('power' in (PART_ICON_KIND as Record<string, unknown>)));

/* AN UNKNOWN SECTION KIND MUST FAIL, NOT RENDER BLANK. A total `Record` is the
 * guard: the compiler refuses a missing member. This cell proves the map really
 * is total by walking the live section-id union through it. */
const EVERY_SECTION_ID = Object.keys(SESSION_SECTION_ICON_KIND);
ok('[10] EVERY section kind the app can emit has an icon — none renders blank',
  EVERY_SECTION_ID.every((id) =>
    !!SESSION_SECTION_ICON_KIND[id as keyof typeof SESSION_SECTION_ICON_KIND]),
  EVERY_SECTION_ID.filter((id) =>
    !SESSION_SECTION_ICON_KIND[id as keyof typeof SESSION_SECTION_ICON_KIND]));
ok('[10] and both maps are TOTAL, so a new kind stops the build',
  /Readonly<Record<SessionExecutionSectionId,\s*RowIconKind>>/.test(iconMaps)
    && /Readonly<Record<VisiblePartKind,\s*RowIconKind>>/.test(iconMaps)
    && !/Partial<Record<(SessionExecutionSectionId|VisiblePartKind)/.test(iconMaps),
  'a Partial here is how Team Training lost its glyph');

ok('[10] there is exactly ONE icon owner — neither screen keeps its own table',
  !/SECTION_HEADING_ICON/.test(screen)
    && !/const PART_ICON_KIND/.test(home)
    && !/function RowIcon\(/.test(home)
    && /import \{[\s\S]{0,120}RowIcon[\s\S]{0,120}\} from '\.\.\/\.\.\/components\/icons\/SectionIcon'/
      .test(home),
  'HomeScreenV2 must import the icons, not define them');
/* ── AMENDED 2026-08-23 (R-129): THE SECTION MAY CARRY ITS OWN GLYPH. ────────
 *
 * The gate's subject is unchanged and is the sentence above it — *"neither
 * screen keeps its own table"*. It is still true: `section.iconKind` is decided
 * in `utils/sessionExecutionChecklist`, which reads `SESSION_SECTION_ICON_KIND`,
 * the one owner. No table moved to the screen and none was copied.
 *
 * WHY IT IS ADMITTED. A Primer's main section is a `strength` section with its
 * own identity, so the id alone cannot distinguish it — the day card drew Sam's
 * lightning bolt and this screen drew a dumbbell for the SAME work. Deciding it
 * where the workout is readable is the same move `rules/dayTimeline` makes for
 * the card, and it is what keeps the two surfaces agreeing.
 *
 * THE FALLBACK IS PINNED TOO, so a section that carries no glyph still resolves
 * through the one owner rather than rendering iconless. */
ok('[10] and the Session screen renders through that same owner',
  /<RowIcon kind=\{section\.iconKind \?\? SESSION_SECTION_ICON_KIND\[section\.id\]\}/.test(screen)
    && !/SESSION_SECTION_ICON_KIND\[section\.label\]/.test(screen));
ok('[10] the colours moved with the glyphs — one table, not a second palette',
  /export function rowIconColor/.test(iconOwner)
    && !/function rowIconColor/.test(home)
    && !/rowIconColor/.test(screen),
  'the Session screen takes RowIcon\'s own colour and never overrides it');

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
    && (screen.match(/<ExecutionChecklistItem/g) ?? []).length >= 2,
  { sites: (screen.match(/<ExecutionChecklistItem/g) ?? []).length,
    handlers: (screen.match(/\{\(checkbox\) => \(/g) ?? []).length });

// ── INDEPENDENTLY TAPPABLE, AND NOT OVERLAPPING.
ok('[10] the checkbox and Play are separate Pressables with their own handlers',
  /onPress=\{\(\) => onToggle\(itemId\)\}/.test(checklistItemWhole)
    && /<PlayButton onPress=\{onPlay\}/.test(cueDisclosure)
    && !/onPlay[\s\S]{0,60}onToggle/.test(cueDisclosure));
ok('[10] both keep a practical tap target — neither shrank to fit the tighter row',
  /hitSlop=\{\{ top: 13, bottom: 13, left: 13, right: 13 \}\}/.test(checklistItemWhole)
    && /hitSlop=\{\{ top: 14, bottom: 14, left: 14, right: 14 \}\}/.test(screen),
  'both controls keep a 44x44 tap target even though Play is drawn smaller');
ok('[10] a long name wraps instead of pushing the controls off the row',
  /exerciseNamePress:\s*\{[^}]*flexShrink:\s*1/.test(screen)
    && /numberOfLines=\{2\}/.test(headerRow)
    && /exerciseNameWrap:\s*\{[^}]*flex:\s*1/.test(screen),
  'the name shrinks and wraps; the control slot is fixed-width and cannot be squeezed');
ok('[10] and larger text cannot overrun the control row',
  /statsLeftColumn:\s*\{\s*flex:\s*1,\s*minWidth:\s*0\s*\}/.test(screen)
    && /controlsRow:\s*\{[^}]*flexShrink:\s*0/.test(screen),
  'the left column shrinks to zero before the controls give up a pixel');

console.log(`\nsessionExecutionChecklistTests: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
if (fail > 0) { console.log(`Failures: ${failures.join(', ')}`); process.exit(1); }
