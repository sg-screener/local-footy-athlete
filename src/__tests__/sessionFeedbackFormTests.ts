/**
 * Session feedback form flow tests.
 *
 * Run: npx sucrase-node src/__tests__/sessionFeedbackFormTests.ts
 */

import {
  buildSessionFeedbackPayload,
  canSaveFeedbackDraft,
  componentReasonsFromFeedback,
  deriveAggregateCompletion,
  getVisibleFeedbackSections,
  sanitizeFeedbackDraftForCompletion,
  sanitizeFeedbackDraftForComponents,
} from '../utils/sessionFeedbackForm';
import { deriveAdaptation } from '../utils/feedbackAdapter';
import { findMatchingFeedback } from '../utils/feedbackAdapter';
import { analyzeFeedbackPatterns } from '../utils/feedbackPatterns';
import { missedSessionFeedback } from '../utils/missedSessions';
import { getSessionComponents } from '../utils/sessionComponents';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function assert(condition: boolean, msg: string): void {
  if (condition) {
    pass++;
  } else {
    fail++;
    failures.push(msg);
    console.error(`  FAIL: ${msg}`);
  }
}

function section(title: string): void {
  console.log(`\n=== ${title} ===`);
}

function ids(completion: Parameters<typeof getVisibleFeedbackSections>[0]): string[] {
  return getVisibleFeedbackSections(completion).map((section) => section.id);
}

function labels(completion: Parameters<typeof getVisibleFeedbackSections>[0]): string[] {
  return getVisibleFeedbackSections(completion).map((section) => section.label);
}

section('1. Initial form asks completion first');
{
  const initialIds = ids(null);
  const initialLabels = labels(null);
  assert(initialIds.length === 1, 'initial form shows only one section');
  assert(initialIds[0] === 'completion', 'initial section is completion');
  assert(initialLabels[0] === 'Did you complete it?', 'initial label asks completion first');
}

section('2. Fully completed flow');
{
  const fullIds = ids('full');
  assert(
    fullIds.join(',') === 'completion,feeling,soreness,notes',
    `full flow expands feel, soreness, note (${fullIds.join(',')})`,
  );
  assert(labels('full').includes('How did the session feel?'), 'full uses session feel copy');
  assert(labels('full').includes('How sore are you?'), 'full includes soreness');
}

section('3. Partially completed flow');
{
  const partialIds = ids('partial');
  assert(
    partialIds.join(',') === 'completion,partialReason,feeling,soreness,notes',
    `partial flow puts reason directly after completion (${partialIds.join(',')})`,
  );
  assert(
    labels('partial').includes('How did the completed part feel?'),
    'partial uses completed-part feel copy',
  );
  assert(
    labels('partial').includes('Why did you only complete part of it?'),
    'partial asks a specific completion reason',
  );
  assert(
    getVisibleFeedbackSections('partial').find((entry) => entry.id === 'partialReason')?.required === true,
    'partial reason is required',
  );
}

section('4. Skipped flow');
{
  const skippedIds = ids('skipped');
  assert(
    skippedIds.join(',') === 'completion,skipReason,notes',
    `skipped flow expands skip reason and note only (${skippedIds.join(',')})`,
  );
  assert(!skippedIds.includes('feeling'), 'skipped hides feeling');
  assert(!skippedIds.includes('soreness'), 'skipped hides soreness');
  assert(labels('skipped').includes('Why did you skip it?'), 'skipped asks why');
}

section('5. Hidden fields are not submitted');
{
  const skipped = buildSessionFeedbackPayload({
    dateStr: '2026-07-08',
    completion: 'skipped',
    feeling: 'very_hard',
    soreness: 'high',
    partialReason: 'too_hard_today',
    skipReason: 'sore_tight',
    notes: '  had to pull the pin  ',
    difficulty: 9,
    conditioning: { sessionName: 'Intervals', rpe: 9 },
    strength: [
      {
        exerciseId: 'ex-1',
        workoutExerciseId: 'we-1',
        exerciseName: 'Back Squat',
        prescribedSets: 3,
        prescribedRepsMin: 5,
        prescribedRepsMax: 5,
        completion: 'skipped',
      },
    ],
  });
  assert(!!skipped, 'skipped payload builds when skip reason is present');
  assert(skipped?.completion === 'skipped', 'skipped payload keeps completion');
  assert(skipped?.skipReason === 'sore_tight', 'skipped payload keeps explicit skip reason');
  assert(skipped?.notes === 'had to pull the pin', 'skipped payload trims notes');
  assert(!('feeling' in (skipped || {})), 'skipped payload omits stale feeling');
  assert(!('soreness' in (skipped || {})), 'skipped payload omits stale soreness');
  assert(!('partialReason' in (skipped || {})), 'skipped payload omits partial reason');
  assert(!('difficulty' in (skipped || {})), 'skipped payload omits difficulty');
  assert(!('conditioning' in (skipped || {})), 'skipped payload omits conditioning');
  assert(!('strength' in (skipped || {})), 'skipped payload omits strength logs');

  const full = buildSessionFeedbackPayload({
    dateStr: '2026-07-08',
    completion: 'full',
    feeling: 'good',
    soreness: 'none',
    partialReason: 'ran_out_of_time',
    skipReason: 'busy_no_time',
    notes: 'done',
    difficulty: 6,
  });
  assert(full?.feeling === 'good', 'full payload keeps feeling');
  assert(full?.soreness === 'none', 'full payload keeps soreness');
  assert(!('partialReason' in (full || {})), 'full payload omits stale partial reason');
  assert(!('skipReason' in (full || {})), 'full payload omits stale skip reason');
  assert(full?.difficulty === 6, 'full payload keeps existing difficulty save');
}

section('6. Switching clears invalid stale values');
{
  const fullToSkipped = sanitizeFeedbackDraftForCompletion(
    {
      completion: 'full',
      feeling: 'hard',
      soreness: 'moderate',
      partialReason: null,
      skipReason: null,
    },
    'skipped',
  );
  assert(fullToSkipped.feeling === null, 'full to skipped clears feeling');
  assert(fullToSkipped.soreness === null, 'full to skipped clears soreness');
  assert(fullToSkipped.partialReason === null, 'full to skipped clears partial reason');

  const skippedToFull = sanitizeFeedbackDraftForCompletion(
    {
      completion: 'skipped',
      feeling: null,
      soreness: null,
      partialReason: null,
      skipReason: 'sick_low_energy',
    },
    'full',
  );
  assert(skippedToFull.skipReason === null, 'skipped to full clears skip reason');
  assert(skippedToFull.feeling === null, 'skipped to full requires a fresh feeling answer');
  assert(skippedToFull.soreness === null, 'skipped to full requires fresh soreness answer');

  const partialToFull = sanitizeFeedbackDraftForCompletion(
    {
      completion: 'partial',
      feeling: 'easy',
      soreness: 'mild',
      partialReason: 'ran_out_of_time',
      skipReason: null,
    },
    'full',
  );
  assert(partialToFull.partialReason === null, 'partial to full clears partial reason');
  assert(partialToFull.feeling === 'easy', 'partial to full keeps valid feeling');
  assert(partialToFull.soreness === 'mild', 'partial to full keeps valid soreness');
}

section('7. Save requirements');
{
  assert(
    !canSaveFeedbackDraft({
      completion: null,
      feeling: null,
      soreness: null,
      partialReason: null,
      skipReason: null,
    }),
    'initial state cannot save',
  );
  assert(
    canSaveFeedbackDraft({
      completion: 'full',
      feeling: 'good',
      soreness: 'none',
      partialReason: null,
      skipReason: null,
    }),
    'full can save with feel and soreness',
  );
  assert(
    !canSaveFeedbackDraft({
      completion: 'partial',
      feeling: 'hard',
      soreness: 'mild',
      partialReason: null,
      skipReason: null,
    }),
    'partial cannot save before a reason is selected',
  );
  assert(
    canSaveFeedbackDraft({
      completion: 'partial',
      feeling: 'hard',
      soreness: 'mild',
      partialReason: 'too_hard_today',
      skipReason: null,
    }),
    'partial can save with reason, feel and soreness',
  );
  assert(
    !canSaveFeedbackDraft({
      completion: 'skipped',
      feeling: null,
      soreness: null,
      partialReason: null,
      skipReason: null,
    }),
    'skipped requires a reason before saving',
  );
}

section('8. Skipped feedback does not invent effort downstream');
{
  const missed = missedSessionFeedback('2026-07-06', 'missed_it');
  assert(missed.completion === 'skipped', 'missed session helper records skipped completion');
  assert(!('feeling' in missed), 'missed session helper omits fake feeling');
  assert(!('soreness' in missed), 'missed session helper omits fake soreness');

  const adaptation = deriveAdaptation({ dateStr: '2026-07-06', completion: 'skipped' });
  assert(adaptation.blockProgression, 'skipped adaptation still blocks progression');
  assert(adaptation.volumeAdjustment === -1, 'skipped adaptation still holds load back');

  const pattern = analyzeFeedbackPatterns([
    { dateStr: '2026-07-08', completion: 'skipped' },
    { dateStr: '2026-07-07', completion: 'partial', feeling: 'good' },
    { dateStr: '2026-07-06', completion: 'skipped' },
  ]);
  assert(!!pattern, 'pattern analysis accepts skipped entries without feeling');
  assert(
    pattern?.activeFlags.includes('COMPLETION_DROP') === true,
    'skipped entries still contribute to completion drops',
  );
  assert(pattern?.fatigueTrend === 'stable', 'skipped entries do not create fake fatigue trend');
}

section('9. Component-aware payloads do not imply other components');
{
  const teamAndStrength = getSessionComponents({
    name: 'Team Training + Upper Push',
    workoutType: 'Strength',
    exercises: [
      {
        id: 'we-bench',
        exerciseId: 'ex-bench',
        exercise: { id: 'ex-bench', name: 'Bench Press' },
      },
    ],
  } as any);
  const mixed = buildSessionFeedbackPayload({
    dateStr: '2026-07-08',
    completion: 'partial',
    components: teamAndStrength,
    componentCompletions: {
      strength: 'skipped',
      team_training: 'full',
    },
    componentReasons: {
      strength: { partialReason: null, skipReason: 'busy_no_time' },
      team_training: { partialReason: null, skipReason: null },
    },
    feeling: 'good',
    soreness: 'mild',
    partialReason: null,
    skipReason: 'busy_no_time',
    notes: '',
    strength: [
      {
        exerciseId: 'ex-bench',
        workoutExerciseId: 'we-bench',
        exerciseName: 'Bench Press',
        prescribedSets: 3,
        prescribedRepsMin: 8,
        prescribedRepsMax: 10,
        completion: 'partial',
      },
    ],
  });
  assert(mixed?.completion === 'partial', 'mixed component completion aggregates to partial');
  assert(mixed?.components?.length === 2, 'mixed payload stores both component answers');
  assert(
    mixed?.components?.find((entry) => entry.kind === 'strength')?.completion === 'skipped',
    'mixed payload records strength skipped',
  );
  assert(
    mixed?.components?.find((entry) => entry.kind === 'strength')?.skipReason === 'busy_no_time',
    'mixed payload records strength skip reason on the component',
  );
  assert(
    mixed?.components?.find((entry) => entry.kind === 'team_training')?.completion === 'full',
    'mixed payload records team training full',
  );
  assert(!('skipReason' in (mixed || {})), 'mixed performed payload omits stale all-skipped reason');
  assert(!('strength' in (mixed || {})), 'strength logs are omitted when strength component is skipped');

  const scComponents = getSessionComponents({
    name: 'Lower Body Strength + Hard Conditioning',
    workoutType: 'Strength',
    hasCombinedConditioning: true,
    exercises: [
      { id: 'we-squat', exerciseId: 'ex-squat', exercise: { name: 'Back Squat' } },
      { id: 'we-bike', exerciseId: 'ex-bike', exercise: { name: 'Assault Bike Intervals' } },
    ],
    conditioningBlock: { options: [{ title: 'Hard Conditioning', exerciseIds: ['we-bike'] }] },
  } as any);
  const noConditioning = buildSessionFeedbackPayload({
    dateStr: '2026-07-09',
    completion: 'partial',
    components: scComponents,
    componentCompletions: {
      strength: 'full',
      conditioning: 'skipped',
    },
    componentReasons: {
      strength: { partialReason: null, skipReason: null },
      conditioning: { partialReason: null, skipReason: 'equipment_unavailable' },
    },
    feeling: 'good',
    soreness: 'none',
    partialReason: null,
    skipReason: null,
    conditioning: { sessionName: 'Hard Conditioning', rpe: 9 },
    difficulty: 9,
  });
  assert(noConditioning?.completion === 'partial', 'strength-only done on S+C aggregates to partial');
  assert(
    noConditioning?.components?.find((entry) => entry.kind === 'conditioning')?.completion === 'skipped',
    'conditioning skipped is explicit',
  );
  assert(
    noConditioning?.components?.find((entry) => entry.kind === 'conditioning')?.skipReason === 'equipment_unavailable',
    'conditioning skip reason is stored on the conditioning component',
  );
  assert(
    !('conditioning' in (noConditioning || {})),
    'conditioning logs are omitted when conditioning component is skipped',
  );
  assert(
    !('difficulty' in (noConditioning || {})),
    'conditioning RPE is omitted when conditioning component is skipped',
  );

  const cleaned = sanitizeFeedbackDraftForComponents(
    {
      completion: 'partial',
      componentCompletions: {
        strength: 'full',
        conditioning: 'skipped',
      },
      componentReasons: {
        strength: { partialReason: null, skipReason: 'sore_tight' },
        conditioning: { partialReason: null, skipReason: 'busy_no_time' },
      },
      feeling: 'hard',
      soreness: 'moderate',
      partialReason: null,
      skipReason: null,
    },
    scComponents.filter((component) => component.kind === 'strength'),
  );
  assert(cleaned.componentCompletions?.conditioning === undefined, 'removed conditioning is cleared');
  assert(cleaned.componentReasons?.conditioning === undefined, 'removed conditioning reason is cleared');
  assert(cleaned.componentReasons?.strength?.skipReason === null, 'fully completed strength clears stale skip reason');
  assert(cleaned.completion === 'full', 'removed conditioning recomputes aggregate from remaining strength');

  const partialStrength = sanitizeFeedbackDraftForComponents(
    {
      completion: 'partial',
      componentCompletions: {
        strength: 'partial',
        team_training: 'full',
      },
      componentReasons: {
        strength: { partialReason: 'too_hard_today', skipReason: 'sick_low_energy' },
        team_training: { partialReason: null, skipReason: 'busy_no_time' },
      },
      feeling: 'hard',
      soreness: 'mild',
      partialReason: null,
      skipReason: null,
    },
    teamAndStrength,
  );
  assert(
    partialStrength.componentReasons?.strength?.partialReason === 'too_hard_today',
    'partial strength keeps its partial reason',
  );
  assert(
    partialStrength.componentReasons?.strength?.skipReason === null,
    'partial strength clears stale skip reason',
  );
  assert(
    partialStrength.componentReasons?.team_training?.skipReason === null,
    'full team training clears stale skip reason',
  );

  assert(
    !canSaveFeedbackDraft({
      completion: 'partial',
      componentCompletions: { strength: 'skipped', team_training: 'full' },
      componentReasons: {
        strength: { partialReason: null, skipReason: null },
        team_training: { partialReason: null, skipReason: null },
      },
      feeling: 'good',
      soreness: 'none',
      partialReason: null,
      skipReason: null,
    }),
    'component skipped status requires its own reason',
  );
  assert(
    canSaveFeedbackDraft({
      completion: 'partial',
      componentCompletions: { strength: 'skipped', team_training: 'full' },
      componentReasons: {
        strength: { partialReason: null, skipReason: 'sore_tight' },
        team_training: { partialReason: null, skipReason: null },
      },
      feeling: 'good',
      soreness: 'none',
      partialReason: null,
      skipReason: null,
    }),
    'one completed and one skipped can save with component skip reason plus feel/soreness',
  );

  const allSkippedSections = getVisibleFeedbackSections('skipped').map((section) => section.id);
  assert(!allSkippedSections.includes('feeling'), 'all skipped hides feeling');
  assert(!allSkippedSections.includes('soreness'), 'all skipped hides soreness');
}

section('10. Existing component reasons rehydrate per visible component');
{
  const components = getSessionComponents({
    name: 'Team Training + Upper Pull',
    workoutType: 'Strength',
    exercises: [{ id: 'we-row', exerciseId: 'ex-row', exercise: { name: 'Seated Row' } }],
  } as any);
  const reasons = componentReasonsFromFeedback(
    {
      dateStr: '2026-07-08',
      completion: 'partial',
      components: [
        {
          componentId: 'strength',
          kind: 'strength',
          label: 'strength work',
          completion: 'partial',
          partialReason: 'ran_out_of_time',
        },
        {
          componentId: 'team_training',
          kind: 'team_training',
          label: 'team training',
          completion: 'skipped',
          skipReason: 'sick_low_energy',
        },
      ],
      feeling: 'good',
      soreness: 'mild',
    },
    components,
  );
  assert(reasons.strength.partialReason === 'ran_out_of_time', 'strength partial reason rehydrates');
  assert(reasons.strength.skipReason === null, 'strength stale skip reason stays clear');
  assert(reasons.team_training.skipReason === 'sick_low_energy', 'team skip reason rehydrates');
}

section('11. Component feedback projects to matching future session type');
{
  const feedback = {
    '2026-07-01': {
      dateStr: '2026-07-01',
      completion: 'partial',
      components: [
        {
          componentId: 'strength',
          kind: 'strength',
          label: 'strength work',
          completion: 'skipped',
        },
        {
          componentId: 'team_training',
          kind: 'team_training',
          label: 'team training',
          completion: 'full',
        },
      ],
      feeling: 'good',
      soreness: 'none',
    },
  } as const;
  const match = findMatchingFeedback(
    'Strength',
    feedback as any,
    { '2026-07-01': 'Strength' },
    '2026-07-08',
  );
  assert(match?.completion === 'skipped', 'future strength adaptation sees strength skipped');
  assert(!('feeling' in (match || {})), 'skipped strength projection omits team-training feel');
  assert(deriveAdaptation(match).volumeAdjustment === -1, 'strength skipped holds progression back');
}

section('12. Optional components save without penalising the main session');
{
  const finisherComponents = getSessionComponents({
    name: 'Upper Pull + Aerobic Finisher',
    workoutType: 'Strength',
    hasCombinedConditioning: true,
    attachedConditioningKind: 'finisher',
    exercises: [
      { id: 'we-row', exerciseId: 'ex-row', exercise: { name: 'Chest Supported Row' } },
      { id: 'we-bike', exerciseId: 'ex-bike', exercise: { name: 'Easy Bike Finisher' } },
    ],
    conditioningBlock: { options: [{ title: 'Finisher', exerciseIds: ['we-bike'] }] },
  } as any);
  const finisherCompletions = { strength: 'full', finisher: 'skipped' } as const;
  assert(
    deriveAggregateCompletion(finisherComponents, finisherCompletions, null) === 'full',
    'skipped finisher does not mark the whole session partial or missed',
  );
  const finisherPayload = buildSessionFeedbackPayload({
    dateStr: '2026-07-10',
    completion: 'full',
    components: finisherComponents,
    componentCompletions: finisherCompletions,
    componentReasons: {
      strength: { partialReason: null, skipReason: null },
      finisher: { partialReason: null, skipReason: 'busy_no_time' },
    },
    feeling: 'good',
    soreness: 'none',
    partialReason: null,
    skipReason: null,
  });
  assert(finisherPayload?.completion === 'full', 'finisher-skipped payload keeps main session complete');
  assert(
    finisherPayload?.components?.find((entry) => entry.kind === 'finisher')?.completion === 'skipped',
    'finisher skip is still stored honestly',
  );

  const addonComponents = getSessionComponents({
    name: 'Lower Body Strength',
    workoutType: 'Strength',
    exercises: [{ id: 'we-squat', exerciseId: 'ex-squat', exercise: { name: 'Back Squat' } }],
    recoveryAddons: [{
      id: 'addon-1',
      exercises: [{ id: 'bird-dog', name: 'Bird Dog', prescription: '2 x 6/side' }],
    }],
  } as any);
  const addonCompletions = { strength: 'full', recovery_addon: 'skipped' } as const;
  const addonPayload = buildSessionFeedbackPayload({
    dateStr: '2026-07-10',
    completion: deriveAggregateCompletion(addonComponents, addonCompletions, null),
    components: addonComponents,
    componentCompletions: addonCompletions,
    componentReasons: {
      strength: { partialReason: null, skipReason: null },
      recovery_addon: { partialReason: null, skipReason: 'busy_no_time' },
    },
    feeling: 'good',
    soreness: 'none',
    partialReason: null,
    skipReason: null,
  });
  assert(addonPayload?.completion === 'full', 'skipped recovery add-on has no session completion penalty');
  assert(
    addonPayload?.components?.find((entry) => entry.kind === 'recovery_addon')?.completion === 'skipped',
    'recovery add-on skip is still stored honestly',
  );

  const cleaned = sanitizeFeedbackDraftForComponents(
    {
      completion: 'partial',
      componentCompletions: { strength: 'full', speed: 'skipped', recovery_addon: 'partial' },
      componentReasons: {
        strength: { partialReason: null, skipReason: null },
        speed: { partialReason: null, skipReason: 'sore_tight' },
        recovery_addon: { partialReason: 'ran_out_of_time', skipReason: null },
      },
      feeling: 'good',
      soreness: 'none',
      partialReason: null,
      skipReason: null,
    },
    addonComponents.filter((component) => component.kind === 'strength'),
  );
  assert(cleaned.componentCompletions?.speed === undefined, 'removed speed answer is cleared');
  assert(cleaned.componentReasons?.speed === undefined, 'removed speed reason is cleared');
  assert(cleaned.componentCompletions?.recovery_addon === undefined, 'removed add-on answer is cleared');
  assert(cleaned.componentReasons?.recovery_addon === undefined, 'removed add-on reason is cleared');
}

console.log(`\nSummary: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`- ${f}`);
  process.exit(1);
}
