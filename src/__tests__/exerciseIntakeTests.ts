(global as any).__DEV__ = false;
const storage = new Map<string, string>();
(globalThis as any).window = { localStorage: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key), clear: () => storage.clear(),
} };
import { EXERCISE_TAGS } from '../data/exerciseTags';
import { selectableVocabularyGroups } from '../data/selectableExerciseVocabulary';
import { EXERCISE_CUES } from '../data/exerciseCues';
import { EXERCISE_DEMO_VIDEOS } from '../services/exerciseVideoService';
import { EXERCISE_MUSCLE_METADATA } from '../data/muscleExperienceMetadata';
import { equipmentRequiredFor, EXERCISE_EQUIPMENT_REQUIREMENT } from '../data/exerciseEquipmentRequirement';
import { exerciseIsAvailableWith } from '../data/exerciseEquipmentRequirement';
import { derivedEquipmentChecklistTags } from '../rules/equipmentVocabulary';
import { resolveEquipmentAvailability } from '../utils/equipmentAvailability';
import { exerciseProgrammingAllows } from '../utils/exerciseFilter';
import { buildDerivedSession, filterPoolForAthlete } from '../utils/sessionBuilder';
import { buildPowerRow } from '../data/defaultProgram';
import { legalAddCandidates, legalAddFamilies, legalAddAlternativesForExercise } from '../utils/addExerciseCandidates';
import { resolveTapSwapEnvironment, assessTapSwapCandidateSafety, getTapSwapChoices, groupTapSwapChoices } from '../utils/tapSwapHierarchy';
import { FLOW_CATEGORY_MUSCLE_MAPPING } from '../data/sessionFlowMenus';
import { flowSlotCandidates, selectMobilityPrehabFlow } from '../utils/mobilityPrehabFlow';
import { coldStartThroughOnboarding, quiet, quietAsync, relaunchApp } from './support/athleteJourney';
import { ARCHETYPES, athleteAnswers, plusDays } from './compilerYear/catalog';
import { useProgramStore } from '../store/programStore';
import { ATHLETE_CHOSEN_LOAD_EXERCISES, BAND_RESISTANCE_EXERCISES, TRUE_BODYWEIGHT_EXERCISES, resolveLoadAuthority, resolveLoadControlMode, estimateStartingWeight, equipmentClassFor, formatLoadLabel } from '../utils/loadEstimation';
import { getAthleteExclusions } from '../store/athletePreferencesStore';
import { SECTION_LABELS } from '../utils/sessionExecutionChecklist';
import { walkInjuryFallbackLadder } from '../rules/injuryFallbackLadder';
import { slotsForExerciseName } from '../rules/sessionSlotCoverage';
import { buildGuidedInjuryConstraint } from '../utils/guidedInjuryControl';
import { getCoachRevisionTemplateContext } from '../utils/coachRevisionTemplateContext';
import { usefulStrengthIdentityCounts } from '../rules/minimumUsefulStrengthSession';
import { composeWeek } from '../rules/composeWeek';
import { materialiseComposedWeek } from '../rules/materialiseComposedWeek';
import { compileCanonicalStrengthTemplate } from '../rules/canonicalWeeklyRowCompiler';
import { deriveVisibleWeekLive } from '../utils/deriveVisibleWeek';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { visibleSignature } from './compilerYear/invariants';
import { composedIdentityFor } from '../rules/composedRowLegality';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { spawnSync } from 'child_process';
import { executeProgramControlActionDurably } from '../utils/programControlActions';
import { coachRevisionExistingExerciseNames } from '../utils/coachRevisionTemplateContext';
import { recordDay, setJourneyClock } from './support/athleteJourney';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import { exerciseVariationFamily } from '../rules/exerciseVariationFamily';
import { buildSwapSuggestionPayload } from '../utils/swapSuggestionPayload';
import { compileCanonicalExerciseEditOnWorkout } from '../rules/canonicalWeeklyExerciseEditCompiler';
import { BAND_ASSISTED_PULL_UP_ELIGIBILITY, SOURCE_BOUND_EXERCISE_REGRESSIONS, sourceBoundAutomaticIdentityFor } from '../rules/sourceBoundExerciseRegression';
import { POWER_EXERCISE_POOL } from '../rules/powerExercisePool';
armTotalsOrRed();
// Mutations run in isolated child processes: no shared checkout is edited.
const mutation = process.env.LFA_INTAKE_MUTATION;
if (mutation === 'experience') EXERCISE_TAGS['Reverse Nordic Curl'].programming!.automaticMinimum = 'new';
if (mutation === 'fixture') EXERCISE_TAGS['Reverse Nordic Curl'].programming!.excludeWithinDaysOfGame = undefined;
if (mutation === 'horse_fixture') EXERCISE_TAGS['Horse Stance Hold'].programming!.excludeWithinDaysOfGame = undefined;
if (mutation === 'equipment') (EXERCISE_EQUIPMENT_REQUIREMENT as Record<string, unknown>)['Rotational Medicine-Ball Throw'] = [];
if (mutation === 'cue') EXERCISE_CUES['Horse Stance Hold'].primaryCue = 'incorrect cue';
if (mutation === 'video') EXERCISE_DEMO_VIDEOS['Horse Stance Hold'] = 'https://example.invalid';
if (mutation === 'duration') EXERCISE_TAGS['Horse Stance Hold'].prescription!.prescriptionType = 'reps';
if (mutation === 'bench_dose') EXERCISE_TAGS['Bench Thoracic Extension'].prescription!.repsMax = 6;
if (mutation === 'bench_equipment') (EXERCISE_EQUIPMENT_REQUIREMENT as Record<string, unknown>)['Bench Thoracic Extension'] = [];
if (mutation === 'bench_route') EXERCISE_TAGS['Bench Thoracic Extension'].programming!.warmup = false;
if (mutation === 'sleeper_dose') EXERCISE_TAGS['Sleeper Stretch'].prescription!.repsMax = 45;
if (mutation === 'sleeper_equipment') (EXERCISE_EQUIPMENT_REQUIREMENT as Record<string, unknown>)['Sleeper Stretch'] = ['bands'];
if (mutation === 'sleeper_primer') EXERCISE_TAGS['Sleeper Stretch'].programming!.primer = true;
if (mutation === 'foam_dose') EXERCISE_TAGS['Foam Roller Thoracic Extension'].prescription!.repsMax = 6;
if (mutation === 'foam_equipment') (EXERCISE_EQUIPMENT_REQUIREMENT as Record<string, unknown>)['Foam Roller Thoracic Extension'] = ['foam_roller'];
if (mutation === 'foam_load') ATHLETE_CHOSEN_LOAD_EXERCISES.delete('Foam Roller Thoracic Extension');
if (mutation === 'foam_primer') EXERCISE_TAGS['Foam Roller Thoracic Extension'].programming!.primer = true;
if (mutation === 'band_source') (SOURCE_BOUND_EXERCISE_REGRESSIONS as any)[0].source = 'Chin-Ups';
if (mutation === 'band_eligibility') (BAND_ASSISTED_PULL_UP_ELIGIBILITY as any).developingFemale = false;
if (mutation === 'band_equipment') (EXERCISE_EQUIPMENT_REQUIREMENT as Record<string, unknown>)['Band-Assisted Pull-Up'] = ['bands'];
if (mutation === 'band_load') BAND_RESISTANCE_EXERCISES.delete('Band-Assisted Pull-Up');
if (mutation === 'incline_source') {
  const row = SOURCE_BOUND_EXERCISE_REGRESSIONS.find(entry => entry.target === 'Incline Push-Up') as any;
  if (row) row.source = 'Bench Press';
}
if (mutation === 'incline_eligibility') {
  const row = SOURCE_BOUND_EXERCISE_REGRESSIONS.find(entry => entry.target === 'Incline Push-Up') as any;
  if (row?.eligibility) row.eligibility.developingFemale = false;
}
if (mutation === 'incline_equipment') (EXERCISE_EQUIPMENT_REQUIREMENT as Record<string, unknown>)['Incline Push-Up'] = [];
if (mutation === 'incline_load') TRUE_BODYWEIGHT_EXERCISES.delete('Incline Push-Up');
if (mutation === 'hop_experience') {
  const row = POWER_EXERCISE_POOL.find(entry => entry.name === 'Single-Leg Hop and Stick') as any;
  if (row) row.minTrainingAge = 'developing';
}
if (mutation === 'hop_inseason') {
  const row = POWER_EXERCISE_POOL.find(entry => entry.name === 'Single-Leg Hop and Stick') as any;
  if (row) row.inSeasonSafe = false;
}
if (mutation === 'hop_dose') EXERCISE_TAGS['Single-Leg Hop and Stick']!.prescription!.repsMax = 6;
if (mutation === 'hop_load') TRUE_BODYWEIGHT_EXERCISES.delete('Single-Leg Hop and Stick');
let passed = 0;
let failed = 0;
function check(label: string, value: unknown) {
  if (value) passed++;
  else { failed++; console.error(`FAIL ${label}`); }
}
const submitted = [
  ['Seated Single-Leg Pike Lift', '1v-h-JQBKEY'],
  ['Standing Knee Extension', 'iJkCwL7Jivg'],
  ['Crab Hold', 'm7-7YKIt_wM'],
  ['Seated Good Morning', 'GycVtINbX9M'],
  ['SL 45° Back Extension', 'RpYJ3hc54eI'],
  ['SL 45° Back Extension Hold', 'ZlAy-WUGzDA'],
  ['Reverse Nordic Curl', 'Dd3SX08tZV4'],
  ['Rotational Medicine-Ball Throw', '02c2YLgF8iE'],
  ['Medicine-Ball Slam', 'fGLHGiYFIqc'],
  ['Rotational Medicine-Ball Slam', 'M9ryqecCLf0'],
  ['Horse Stance Hold', '4P9w2Kvgl0A'],
  ['Bench Thoracic Extension', 'xE5ZaEKAx1g'],
  ['Sleeper Stretch', 'clqjaMIRWfM'],
  ['Foam Roller Thoracic Extension', '9Hfy7ojEt18'],
  ['Single-Leg Hop and Stick', 'ml-8WNXFJxw'],
];
const vocabulary = new Set(selectableVocabularyGroups().flatMap(group => group.names));
// Independent dose expectations transcribed from the signed intake, including
// the selected lower bound where Sam supplied a sets/rest range.
const doses = [
  [2, 6, 10, 30, 'reps', true], [2, 5, 5, 30, 'reps', true],
  [2, 15, 30, 30, 'duration', false], [2, 5, 5, 60, 'reps', false],
  [3, 10, 10, 60, 'reps', true], [2, 30, 30, 45, 'duration', true],
  [2, 5, 5, 60, 'reps', false], [3, 3, 5, 60, 'reps', true],
  [3, 4, 6, 60, 'reps', false], [3, 4, 6, 60, 'reps', true],
  [2, 60, 60, 30, 'duration', false],
  [2, 5, 5, 30, 'reps', false],
  [2, 30, 30, 15, 'duration', true],
  [2, 5, 5, 30, 'reps', false],
  [2, 5, 5, 120, 'reps', true],
];
const powerSubmitted = submitted.filter(([name]) => !!EXERCISE_TAGS[name]?.power);
submitted.forEach(([name], index) => {
  const p = EXERCISE_TAGS[name]?.prescription;
  check(`${name}: signed dose, rest, unit and side`, !!p && JSON.stringify([
    p.sets, p.repsMin, p.repsMax, p.restSeconds, p.prescriptionType, p.perSide,
  ]) === JSON.stringify(doses[index]));
});
const intake = [
  readFileSync(resolve(__dirname, '../../docs/EXERCISE_INTAKE_2026-08-28.md'), 'utf8'),
  readFileSync(resolve(__dirname, '../../docs/EXERCISE_INTAKE_BENCH_THORACIC_EXTENSION_2026-09-02.md'), 'utf8'),
  readFileSync(resolve(__dirname, '../../docs/EXERCISE_INTAKE_SLEEPER_STRETCH_2026-09-02.md'), 'utf8'),
  readFileSync(resolve(__dirname, '../../docs/EXERCISE_INTAKE_FOAM_ROLLER_THORACIC_EXTENSION_2026-09-02.md'), 'utf8'),
  readFileSync(resolve(__dirname, '../../docs/EXERCISE_INTAKE_BAND_ASSISTED_PULL_UP_2026-09-02.md'), 'utf8'),
  readFileSync(resolve(__dirname, '../../docs/EXERCISE_INTAKE_INCLINE_PUSH_UP_2026-09-02.md'), 'utf8'),
  readFileSync(resolve(__dirname, '../../docs/EXERCISE_INTAKE_SINGLE_LEG_HOP_AND_STICK_2026-09-02.md'), 'utf8'),
].join('\n');
for (const [name, video] of submitted) {
  check(`${name}: selectable`, vocabulary.has(name));
  check(`${name}: full thirteen-region ratings`, Object.keys(EXERCISE_TAGS[name]?.injury ?? {}).length === 13);
  check(`${name}: authored muscles and experience`, EXERCISE_MUSCLE_METADATA.filter(row => row.exercise === name).length === 1);
  check(`${name}: authored equipment`, equipmentRequiredFor(name) !== null);
  check(`${name}: primary cue`, EXERCISE_CUES[name]?.primaryCue);
  check(`${name}: confirmed destination`, EXERCISE_DEMO_VIDEOS[name]?.includes(video));
  const section = intake.split(/^## \d+\. /m).find(section => section.startsWith(name + '\n'));
  check(`${name}: exact confirmed video URL`, EXERCISE_DEMO_VIDEOS[name] === section?.match(/^\- \*\*Video:\*\* (\S+)/m)?.[1]);
  check(`${name}: exact supplied primary cue`, EXERCISE_CUES[name]?.primaryCue === section?.match(/^\- \*\*Primary cue:\*\* (.+)$/m)?.[1]);
  const ratings = [...(section ?? '').matchAll(/^\| ([^|]+) \| (Good|Caution|Avoid) \|$/gm)];
  check(`${name}: intake rating table found`, ratings.length === 13);
  for (const [, region, rating] of ratings) {
    const key = region === 'Lower back' ? 'lowerBack' : region.toLowerCase();
    check(`${name}: supplied ${region} rating`, EXERCISE_TAGS[name]?.injury[key] === rating.toLowerCase());
  }
}
check('Bird Dogs stay deferred', !vocabulary.has('Band-Resisted Bird Dogs'));
async function main() {
  const date = '2026-08-31';
  const profile = athleteAnswers({ ...ARCHETYPES[6], initialPhase: 'Pre-season', extraGame: false });
  profile.seasonFinishedOn = '2026-08-30';
  profile.equipmentAnswer = { tags: Object.fromEntries(derivedEquipmentChecklistTags().map(tag => [tag, 'have'])),
    modalities: profile.equipmentAnswer!.modalities, answeredOn: date };
  const kit = resolveEquipmentAvailability(profile, [], date);
  const athlete = { injuries: [], equipmentTags: kit, onboardingData: profile, daysToGame: null };
  const environment = resolveTapSwapEnvironment({ date, profile, gameDates: [], activeConstraints: [], readinessSignal: null });
  const args = { environment, profile, existingExerciseNames: [] };
  const tree = legalAddFamilies(args);
  const choices = tree.flatMap(f => f.groups.flatMap(g => g.leaves.flatMap(l => legalAddCandidates({ ...args, leaf: l.id }))));
  // Unique menu protections retained from the retired Add/Swap suites. The
  // durable action/restart checks below replace their duplicate setup and flow.
  check('Add families use the current section labels and order',
    tree.map(f => f.id).join('|') === 'strength|conditioning|mobility'
    && tree.every(f => f.label === SECTION_LABELS[f.id]));
  const strength = tree.find(f => f.id === 'strength')!;
  check('Add strength headings preserve the approved order', strength.groups.map(g => g.label).join('|') ===
    'Power & Jumps|Lower body|Upper body|Midline & Carries');
  const leaves = tree.flatMap(f => f.groups.flatMap(g => g.leaves));
  check('only lower and upper body need an extra menu step',
    tree.flatMap(f => f.groups).filter(g => g.leaves.length > 1).map(g => g.id).join('|') === 'lower_body|upper_body');
  check('Add leaves partition identities without duplicates', new Set(choices.map(c => c.name)).size === choices.length);
  check('Add menu counts equal the actual lists at every level',
    leaves.every(l => l.count > 0 && l.count === legalAddCandidates({ ...args, leaf: l.id }).length)
    && tree.every(f => f.count === f.groups.reduce((n, g) => n + g.count, 0))
    && tree.flatMap(f => f.groups).every(g => g.count === g.leaves.reduce((n, l) => n + l.count, 0)));
  check('straight-through list titles and Accessories wording remain approved',
    tree.flatMap(f => f.groups).every(g => g.leaves.length !== 1 || g.label === g.leaves[0].label)
    && leaves.filter(l => l.id === 'lower_accessories' || l.id === 'upper_accessories')
      .map(l => l.label).join('|') === 'Accessories|Accessories');
  const inLeaf = (leaf: string) => legalAddCandidates({ ...args, leaf: leaf as any }).map(c => c.name);
  check('single-leg menu retains unilateral lower work outside bilateral lists',
    inLeaf('lower_single_leg').includes('Bulgarian Split Squats')
    && inLeaf('lower_single_leg').includes('Single-Leg RDL')
    && !inLeaf('lower_squat').includes('Bulgarian Split Squats')
    && !inLeaf('lower_hinge').includes('Single-Leg RDL'));
  const allNames = choices.map(c => c.name);
  const bandAssistedPullUp = 'Band-Assisted Pull-Up';
  const bandAssistedProfiles = [
    ['beginner male', { ...profile, experienceLevel: 'Complete beginner' as const, gender: 'male' as const }, true],
    ['beginner female', { ...profile, experienceLevel: 'Complete beginner' as const, gender: 'female' as const }, true],
    ['1-2 years female', { ...profile, experienceLevel: '1-2 years' as const, gender: 'female' as const }, true],
    ['1-2 years male', { ...profile, experienceLevel: '1-2 years' as const, gender: 'male' as const }, false],
    ['2-5 years female', { ...profile, experienceLevel: '2-5 years' as const, gender: 'female' as const }, false],
  ] as const;
  for (const [label, bandProfile, eligible] of bandAssistedProfiles) {
    const bandEnvironment = resolveTapSwapEnvironment({
      date, profile: bandProfile, gameDates: [], activeConstraints: [], readinessSignal: null,
    });
    const fromPullUp = getTapSwapChoices({
      originalExercise: 'Pull-Ups', reason: 'preference', environment: bandEnvironment,
      existingExerciseNames: [],
    });
    check(`Band-Assisted Pull-Up: ${label} Pull-Up-only Swap eligibility`,
      fromPullUp.some(choice => choice.name === bandAssistedPullUp) === eligible);
    check(`Band-Assisted Pull-Up: ${label} write-time eligibility`,
      assessTapSwapCandidateSafety(bandAssistedPullUp, bandEnvironment,
        { sourceExercise: 'Pull-Ups' } as any).safe === eligible);
    check(`Band-Assisted Pull-Up: ${label} never appears in Add`,
      legalAddFamilies({ ...args, profile: bandProfile, environment: bandEnvironment })
        .flatMap(f => f.groups.flatMap(g => g.leaves.flatMap(l =>
          legalAddCandidates({ ...args, profile: bandProfile, environment: bandEnvironment, leaf: l.id }))))
        .every(candidate => candidate.name !== bandAssistedPullUp));
  }
  const eligibleBandEnvironment = resolveTapSwapEnvironment({
    date, profile: { ...profile, experienceLevel: 'Complete beginner', gender: 'female' },
    gameDates: [], activeConstraints: [], readinessSignal: null,
  });
  check('Band-Assisted Pull-Up: only Pull-Ups may be the Swap source',
    !getTapSwapChoices({ originalExercise: 'Chin-Ups', reason: 'preference',
      environment: eligibleBandEnvironment, existingExerciseNames: [] })
      .some(choice => choice.name === bandAssistedPullUp)
    && !assessTapSwapCandidateSafety(bandAssistedPullUp, eligibleBandEnvironment,
      { sourceExercise: 'Chin-Ups' } as any).safe
    && !assessTapSwapCandidateSafety(bandAssistedPullUp, eligibleBandEnvironment).safe);
  check('Band-Assisted Pull-Up: exact existing equipment rule',
    exerciseIsAvailableWith(bandAssistedPullUp, ['bodyweight', 'bands', 'rack'])
    && exerciseIsAvailableWith(bandAssistedPullUp, ['bodyweight', 'bands', 'pullup_bar'])
    && !exerciseIsAvailableWith(bandAssistedPullUp, ['bodyweight', 'rack'])
    && !exerciseIsAvailableWith(bandAssistedPullUp, ['bodyweight', 'bands']));
  check('Band-Assisted Pull-Up: band strength/colour is the load control',
    resolveLoadControlMode(bandAssistedPullUp) === 'band');
  check('Band-Assisted Pull-Up: dose is inherited rather than separately authored',
    EXERCISE_TAGS[bandAssistedPullUp]?.prescription === undefined);
  const bandIntake = intake.split(/^## \d+\. /m)
    .find(section => section.startsWith('Band-Assisted Pull-Up\n')) ?? '';
  const bandMetadata = EXERCISE_MUSCLE_METADATA.find(row => row.exercise === bandAssistedPullUp);
  check('Band-Assisted Pull-Up: vertical-pull catalogue and mapped muscles',
    vocabulary.has(bandAssistedPullUp)
    && bandMetadata?.pool === 'Upper pull vertical'
    && JSON.stringify(bandMetadata.primary) === JSON.stringify(['Lats', 'Biceps', 'Upper back'])
    && JSON.stringify(bandMetadata.secondary) === JSON.stringify(['Shoulders', 'Grip', 'Midline'])
    && bandMetadata.experienceGate === 'everyone_regression');
  check('Band-Assisted Pull-Up: exact supplied cues and video',
    EXERCISE_CUES[bandAssistedPullUp]?.primaryCue
      === 'Stand firmly on the band and pull your chest toward the bar.'
    && EXERCISE_CUES[bandAssistedPullUp]?.secondaryCue
      === 'Lower under control until your elbows fully straighten.'
    && EXERCISE_DEMO_VIDEOS[bandAssistedPullUp]
      === 'https://youtube.com/shorts/pZozI1iaW0k?si=khFTBdN6N3PVZMi3'
    && bandIntake.includes(EXERCISE_CUES[bandAssistedPullUp].primaryCue));
  const bandRatings = [...bandIntake.matchAll(/^\| ([^|]+) \| (Good|Caution|Avoid) \|$/gm)];
  check('Band-Assisted Pull-Up: all thirteen supplied injury ratings',
    bandRatings.length === 13 && bandRatings.every(([, region, rating]) => {
      const key = region === 'Lower back' ? 'lowerBack' : region.toLowerCase();
      return EXERCISE_TAGS[bandAssistedPullUp]?.injury[key] === rating.toLowerCase();
    }));
  check('Band-Assisted Pull-Up: same-session Pull-Up family prevents duplicates',
    exerciseVariationFamily(bandAssistedPullUp) === exerciseVariationFamily('Pull-Ups'));
  const outgoingPullUp = {
    id: 'pull-up-row', exerciseId: 'pull-ups', prescribedSets: 4,
    prescribedRepsMin: 5, prescribedRepsMax: 7, restSeconds: 90,
    prescriptionType: 'reps', perSide: false, role: 'main_lift',
    sessionSection: 'strength', prescribedWeightKg: 12,
    exercise: { id: 'pull-ups', name: 'Pull-Ups' },
  } as any;
  const inheritedBandPayload = buildSwapSuggestionPayload(
    bandAssistedPullUp, outgoingPullUp,
  );
  const swappedBandWorkout = compileCanonicalExerciseEditOnWorkout({
    id: 'pull-day', exercises: [outgoingPullUp],
  } as any, {
    kind: 'swap', decisionId: 'band-regression', occurredAt: `${date}T09:00:00.000Z`,
    dateISO: date, targetName: 'Pull-Ups', targetComponentId: 'pull-up-row',
    replacement: inheritedBandPayload,
  });
  const swappedBandRow = swappedBandWorkout.exercises[0];
  check('Band-Assisted Pull-Up: Pull-Up dose and role survive the real swap compiler',
    swappedBandRow.exercise.name === bandAssistedPullUp
    && swappedBandRow.prescribedSets === 4
    && swappedBandRow.prescribedRepsMin === 5
    && swappedBandRow.prescribedRepsMax === 7
    && swappedBandRow.restSeconds === 90
    && swappedBandRow.role === 'main_lift'
    && swappedBandRow.sessionSection === 'strength'
    && swappedBandRow.prescribedWeightKg === undefined);

  const inclinePushUp = 'Incline Push-Up';
  for (const [label, inclineProfile, eligible] of bandAssistedProfiles) {
    const inclineEnvironment = resolveTapSwapEnvironment({
      date, profile: inclineProfile, gameDates: [], activeConstraints: [], readinessSignal: null,
    });
    const fromPushUp = getTapSwapChoices({
      originalExercise: 'Push-ups', reason: 'preference', environment: inclineEnvironment,
      existingExerciseNames: [],
    });
    check(`Incline Push-Up: ${label} Push-ups-only Swap eligibility`,
      fromPushUp.some(choice => choice.name === inclinePushUp) === eligible);
    check(`Incline Push-Up: ${label} write-time eligibility`,
      assessTapSwapCandidateSafety(inclinePushUp, inclineEnvironment,
        { sourceExercise: 'Push-ups' } as any).safe === eligible);
    check(`Incline Push-Up: ${label} never appears in Add`,
      legalAddFamilies({ ...args, profile: inclineProfile, environment: inclineEnvironment })
        .flatMap(f => f.groups.flatMap(g => g.leaves.flatMap(l =>
          legalAddCandidates({ ...args, profile: inclineProfile, environment: inclineEnvironment, leaf: l.id }))))
        .every(candidate => candidate.name !== inclinePushUp));
  }
  check('Incline Push-Up: only Push-ups may be the Swap source',
    !getTapSwapChoices({ originalExercise: 'Bench Press', reason: 'preference',
      environment: eligibleBandEnvironment, existingExerciseNames: [] })
      .some(choice => choice.name === inclinePushUp)
    && !assessTapSwapCandidateSafety(inclinePushUp, eligibleBandEnvironment,
      { sourceExercise: 'Bench Press' } as any).safe
    && !assessTapSwapCandidateSafety(inclinePushUp, eligibleBandEnvironment).safe);
  check('Incline Push-Up: exact existing equipment rule',
    exerciseIsAvailableWith(inclinePushUp, ['bodyweight', 'bench'])
    && exerciseIsAvailableWith(inclinePushUp, ['bodyweight', 'plyo_box'])
    && !exerciseIsAvailableWith(inclinePushUp, ['bodyweight']));
  check('Incline Push-Up: bodyweight-only load control records no kilograms',
    resolveLoadControlMode(inclinePushUp) === 'bodyweight'
    && resolveLoadAuthority(inclinePushUp).kind === 'bodyweight');
  check('Incline Push-Up: dose is inherited rather than separately authored',
    EXERCISE_TAGS[inclinePushUp]?.prescription === undefined);
  const inclineIntake = intake.split(/^## \d+\. /m)
    .find(section => section.startsWith('Incline Push-Up\n')) ?? '';
  const inclineMetadata = EXERCISE_MUSCLE_METADATA.find(row => row.exercise === inclinePushUp);
  check('Incline Push-Up: horizontal-push catalogue and mapped muscles',
    vocabulary.has(inclinePushUp)
    && inclineMetadata?.pool === 'Upper push horizontal'
    && JSON.stringify(inclineMetadata.primary) === JSON.stringify(['Chest', 'Triceps', 'Shoulders'])
    && JSON.stringify(inclineMetadata.secondary) === JSON.stringify(['Midline', 'Glutes'])
    && inclineMetadata.experienceGate === 'everyone_regression');
  check('Incline Push-Up: exact supplied cues and video',
    EXERCISE_CUES[inclinePushUp]?.primaryCue
      === 'Keep a straight body line and lower your chest to the support.'
    && EXERCISE_CUES[inclinePushUp]?.secondaryCue
      === 'Press away without letting your hips sag or shoulders shrug.'
    && EXERCISE_DEMO_VIDEOS[inclinePushUp]
      === 'https://youtube.com/shorts/7f8JOu0i1cQ?si=5yAE7LhP43eJR7nX'
    && inclineIntake.includes(EXERCISE_CUES[inclinePushUp].primaryCue));
  const inclineRatings = [...inclineIntake.matchAll(/^\| ([^|]+) \| (Good|Caution|Avoid) \|$/gm)];
  check('Incline Push-Up: all thirteen supplied injury ratings',
    inclineRatings.length === 13 && inclineRatings.every(([, region, rating]) => {
      const key = region === 'Lower back' ? 'lowerBack' : region.toLowerCase();
      return EXERCISE_TAGS[inclinePushUp]?.injury[key] === rating.toLowerCase();
    }));
  check('Incline Push-Up: same-session Push-Up family prevents duplicates',
    exerciseVariationFamily(inclinePushUp) === exerciseVariationFamily('Push-ups')
    && exerciseVariationFamily(inclinePushUp) !== null);
  const outgoingPushUp = {
    id: 'push-up-row', exerciseId: 'push-ups', prescribedSets: 3,
    prescribedRepsMin: 8, prescribedRepsMax: 12, restSeconds: 60,
    prescriptionType: 'reps', perSide: false, role: 'accessory',
    sessionSection: 'strength', exercise: { id: 'push-ups', name: 'Push-ups' },
  } as any;
  const inheritedInclinePayload = buildSwapSuggestionPayload(inclinePushUp, outgoingPushUp);
  const swappedInclineWorkout = compileCanonicalExerciseEditOnWorkout({
    id: 'push-day', exercises: [outgoingPushUp],
  } as any, {
    kind: 'swap', decisionId: 'incline-regression', occurredAt: `${date}T09:00:00.000Z`,
    dateISO: date, targetName: 'Push-ups', targetComponentId: 'push-up-row',
    replacement: inheritedInclinePayload,
  });
  const swappedInclineRow = swappedInclineWorkout.exercises[0];
  check('Incline Push-Up: Push-Up dose and role survive the real swap compiler',
    swappedInclineRow.exercise.name === inclinePushUp
    && swappedInclineRow.prescribedSets === 3
    && swappedInclineRow.prescribedRepsMin === 8
    && swappedInclineRow.prescribedRepsMax === 12
    && swappedInclineRow.restSeconds === 60
    && swappedInclineRow.role === 'accessory'
    && swappedInclineRow.sessionSection === 'strength'
    && swappedInclineRow.prescribedWeightKg === undefined);

  const hop = 'Single-Leg Hop and Stick';
  const hopPoolEntry = POWER_EXERCISE_POOL.find(row => row.name === hop);
  const hopMetadata = EXERCISE_MUSCLE_METADATA.find(row => row.exercise === hop);
  check('Single-Leg Hop and Stick: ordinary lower-power pool entry with exact gates',
    hopPoolEntry?.family === 'lower'
    && hopPoolEntry.minTrainingAge === 'consistent'
    && hopPoolEntry.phaseGate === 'all_phases'
    && hopPoolEntry.inSeasonSafe
    && hopPoolEntry.equipmentRequired.length === 0);
  check('Single-Leg Hop and Stick: manual and automatic experience boundary is 2+ years',
    !exerciseProgrammingAllows(hop, { route: 'manual', experienceLevel: 'Complete beginner', daysToGame: null })
    && !exerciseProgrammingAllows(hop, { route: 'manual', experienceLevel: '1-2 years', daysToGame: null })
    && exerciseProgrammingAllows(hop, { route: 'manual', experienceLevel: '2-5 years', daysToGame: null })
    && exerciseProgrammingAllows(hop, { route: 'automatic', experienceLevel: '5+ years', daysToGame: null })
    && !exerciseProgrammingAllows(hop, { route: 'automatic', experienceLevel: '2-5 years', daysToGame: 1 }));
  check('Single-Leg Hop and Stick: exact power catalogue muscles and bodyweight loading',
    hopMetadata?.pool === 'Power'
    && JSON.stringify(hopMetadata.primary) === JSON.stringify(['Glutes', 'Quads', 'Calves'])
    && JSON.stringify(hopMetadata.secondary) === JSON.stringify(['Hamstrings', 'Groin', 'Midline', 'Feet'])
    && hopMetadata.experienceGate === 'two_plus_years'
    && resolveLoadControlMode(hop) === 'bodyweight');
  check('Horse Stance Hold: manual Add is filed only under Mobility & stretching',
    inLeaf('mobility_drills').includes('Horse Stance Hold')
    && leaves.filter(leaf => leaf.id !== 'mobility_drills').every(leaf =>
      !legalAddCandidates({ ...args, leaf: leaf.id }).some(candidate => candidate.name === 'Horse Stance Hold')));
  check('Add does not offer any existing session identity', legalAddFamilies({ ...args, existingExerciseNames: allNames }).length === 0);
  const upperWithBenchAndOverhead = legalAddCandidates({
    ...args,
    leaf: 'upper_push',
    existingExerciseNames: ['Bench Press', 'Overhead Press'],
  });
  check('Add blocks every occupied bench/overhead variation family while retaining Dips',
    upperWithBenchAndOverhead.every((candidate) => ![
      exerciseVariationFamily('Bench Press'), exerciseVariationFamily('Overhead Press'),
    ].includes(exerciseVariationFamily(candidate.name)))
    && upperWithBenchAndOverhead.some((candidate) => candidate.name === 'Dips'));
  const pullWithPulldown = legalAddCandidates({
    ...args,
    leaf: 'upper_pull',
    existingExerciseNames: ['Lat Pulldown'],
  });
  check('Add never offers another member of an occupied pulldown family',
    pullWithPulldown.every((candidate) =>
      exerciseVariationFamily(candidate.name) !== exerciseVariationFamily('Lat Pulldown')));
  check('the retired Single-Arm Pulldown identity is absent from every Add choice',
    !choices.some((candidate) => candidate.name === 'Single-Arm Pulldown'));
  for (const originalExercise of ['Back Squat', 'Bench Press', 'RDLs']) {
    const options = getTapSwapChoices({ originalExercise, reason: 'preference', environment, existingExerciseNames: [] });
    const groups = groupTapSwapChoices(options);
    check(`${originalExercise}: useful loaded Swap options, no rest or unneeded regression`, options.length > 0
      && options.every(c => c.name && c.kind !== 'rest' && equipmentClassFor(c.name) !== 'bodyweight')
      && groups.every(g => g.choices.length > 0 && g.choices.length <= 2));
  }
  const tiers = ['same_movement_pattern', 'similar_muscle_group', 'unaffected_body_area'] as const;
  const grouped = groupTapSwapChoices(tiers.flatMap(hierarchyTier => [0, 1, 2].map(i => ({
    kind: 'exercise' as const, name: `${hierarchyTier}-${i}`, hierarchyTier,
  }))) as any);
  check('Swap grouping caps each populated tier, preserving labels and order',
    grouped.map(g => g.label).join('|') === 'Closest matches|Similar options|Other useful options'
    && grouped.length === 3 && grouped.every(g => g.choices.length === 2));
  // A shared isolation tag must never stand in for actual primary muscles.
  for (const exercise of ['Hamstring Curl', 'Calf Raises', 'Leg Extension']) {
    const result = walkInjuryFallbackLadder({ exercise, region: 'knee', family: 'strength', isLegal: () => true });
    check(`${exercise}: Pike is not a same-action or adjacent isolation replacement`,
      !result.options.some(o => o.name === 'Seated Single-Leg Pike Lift'
        && ['same_movement_safer_variation', 'nearest_safe_secondary_compound', 'safe_adjacent_pattern'].includes(o.rung)));
  }
  for (const [name] of submitted) {
    const choice = choices.find(c => c.name === name);
    const authored = EXERCISE_TAGS[name]?.prescription;
    check(`${name}: actual Add menu`, !!choice);
    check(`${name}: manual dose and unit`, !!choice && !!authored && choice.sets === authored.sets &&
      choice.repsMin === authored.repsMin && choice.repsMax === authored.repsMax &&
      choice.prescriptionType === authored.prescriptionType && !!choice.perSide === authored.perSide);
    check(`${name}: swap menu uses same legality`, legalAddAlternativesForExercise({ ...args,
      originalExercise: name }).some(c => c.name === name));
    check(`${name}: explicit kit allows`, exerciseIsAvailableWith(name, kit));
  }
  for (const name of ['Crab Hold', 'Horse Stance Hold', 'Seated Good Morning', 'Bench Thoracic Extension', 'Sleeper Stretch', 'Foam Roller Thoracic Extension']) {
    check(`${name}: not a main strength seat`, slotsForExerciseName(name).length === 0);
  }
  check('Horse Stance Hold: bodyweight loading and no equipment gate',
    resolveLoadAuthority('Horse Stance Hold').kind === 'bodyweight'
    && equipmentRequiredFor('Horse Stance Hold')?.length === 0
    && exerciseIsAvailableWith('Horse Stance Hold', ['bodyweight'])
    && formatLoadLabel(resolveLoadAuthority('Horse Stance Hold'), 4) === 'BW + 4kg');
  check('Bench Thoracic Extension: bodyweight-only loading has no load control',
    resolveLoadAuthority('Bench Thoracic Extension').kind === 'unloaded');
  check('Sleeper Stretch: bodyweight-only loading has no load control',
    resolveLoadAuthority('Sleeper Stretch').kind === 'unloaded');
  check('Foam Roller Thoracic Extension: athlete chooses and records total held load',
    resolveLoadAuthority('Foam Roller Thoracic Extension').kind === 'athlete_chosen'
    && estimateStartingWeight('Foam Roller Thoracic Extension', profile) === null
    && formatLoadLabel(resolveLoadAuthority('Foam Roller Thoracic Extension'), 4) === '4kg');
  for (const name of ['Rotational Medicine-Ball Throw', 'Medicine-Ball Slam', 'Rotational Medicine-Ball Slam']) {
    check(`${name}: athlete chooses total ball load`, resolveLoadAuthority(name).kind === 'athlete_chosen' && estimateStartingWeight(name, profile) === null);
  }
  check('legacy barbell Seated Good Morning resolves without authoring a second automatic load',
    estimateStartingWeight('Seated Good Morning (Barbell)', profile) === null);
  for (const [name, missing] of [
    ['Rotational Medicine-Ball Throw', 'medicine_ball'],
    ['Medicine-Ball Slam', 'medicine_ball'],
    ['Rotational Medicine-Ball Slam', 'medicine_ball'],
    ['SL 45° Back Extension', 'back_extension_bench'], ['SL 45° Back Extension Hold', 'back_extension_bench'],
  ]) {
    const without = kit.filter(tag => tag !== missing);
    check(`${name}: blocked without ${missing}`, !exerciseIsAvailableWith(name, without));
    check(`${name}: manual blocked without ${missing}`, !assessTapSwapCandidateSafety(name, { ...environment, availableEquipmentTags: without }).safe);
  }
  check('one medicine-ball answer permits every approved throw and slam',
    ['Rotational Medicine-Ball Throw', 'Medicine-Ball Slam', 'Rotational Medicine-Ball Slam']
      .every(name => exerciseIsAvailableWith(name, ['bodyweight', 'medicine_ball'])));
  check('box can support bodyweight Seated Good Morning', exerciseIsAvailableWith('Seated Good Morning', ['bodyweight', 'plyo_box']));
  check('Bench Thoracic Extension accepts either support and refuses neither',
    exerciseIsAvailableWith('Bench Thoracic Extension', ['bodyweight', 'bench'])
    && exerciseIsAvailableWith('Bench Thoracic Extension', ['bodyweight', 'plyo_box'])
    && !exerciseIsAvailableWith('Bench Thoracic Extension', ['bodyweight']));
  check('Bench Thoracic Extension manual Add/Swap uses the same support rule',
    assessTapSwapCandidateSafety('Bench Thoracic Extension', {
      ...environment, availableEquipmentTags: ['bodyweight', 'bench'],
    }).safe
    && assessTapSwapCandidateSafety('Bench Thoracic Extension', {
      ...environment, availableEquipmentTags: ['bodyweight', 'plyo_box'],
    }).safe
    && !assessTapSwapCandidateSafety('Bench Thoracic Extension', {
      ...environment, availableEquipmentTags: ['bodyweight'],
    }).safe);
  check('Sleeper Stretch needs no equipment and manual Add/Swap agrees',
    JSON.stringify(equipmentRequiredFor('Sleeper Stretch')) === '[]'
    && exerciseIsAvailableWith('Sleeper Stretch', ['bodyweight'])
    && assessTapSwapCandidateSafety('Sleeper Stretch', {
      ...environment, availableEquipmentTags: ['bodyweight'],
    }).safe);
  check('Foam Roller Thoracic Extension keeps the roller mandatory and accepts either loading implement',
    JSON.stringify(equipmentRequiredFor('Foam Roller Thoracic Extension'))
      === JSON.stringify(['foam_roller', ['dumbbells', 'barbell']])
    && exerciseIsAvailableWith('Foam Roller Thoracic Extension', ['bodyweight', 'foam_roller', 'dumbbells'])
    && exerciseIsAvailableWith('Foam Roller Thoracic Extension', ['bodyweight', 'foam_roller', 'barbell'])
    && exerciseIsAvailableWith('Foam Roller Thoracic Extension', ['bodyweight', 'foam_roller'])
    && !exerciseIsAvailableWith('Foam Roller Thoracic Extension', ['bodyweight', 'dumbbells']));
  check('Foam Roller Thoracic Extension manual Add/Swap uses the same support and regression rule',
    assessTapSwapCandidateSafety('Foam Roller Thoracic Extension', {
      ...environment, availableEquipmentTags: ['bodyweight', 'foam_roller', 'dumbbells'],
    }).safe
    && assessTapSwapCandidateSafety('Foam Roller Thoracic Extension', {
      ...environment, availableEquipmentTags: ['bodyweight', 'foam_roller'],
    }).safe
    && !assessTapSwapCandidateSafety('Foam Roller Thoracic Extension', {
      ...environment, availableEquipmentTags: ['bodyweight', 'dumbbells'],
    }).safe);
  for (const [name] of submitted) {
    const policy = EXERCISE_TAGS[name]?.programming;
    const novice = { ...athlete, onboardingData: { ...profile, experienceLevel: 'Complete beginner' as const } };
    check(`${name}: automatic novice boundary`, exerciseProgrammingAllows(name, { route: 'automatic', experienceLevel: novice.onboardingData.experienceLevel, daysToGame: null }) === [
      'Seated Single-Leg Pike Lift', 'Standing Knee Extension', 'Crab Hold', 'Seated Good Morning', 'Medicine-Ball Slam',
      'Horse Stance Hold', 'Bench Thoracic Extension', 'Sleeper Stretch',
      'Foam Roller Thoracic Extension',
    ].includes(name));
    for (const daysToGame of [1, 2, 3, null]) {
      if (!policy) {
        check(`${name}: automatic fixture ${daysToGame}`, false);
        continue;
      }
      const limit = Math.max(policy.excludeWithinDaysOfGame ?? -1, policy.automaticExcludeWithinDaysOfGame ?? -1);
      check(`${name}: automatic fixture ${daysToGame}`, exerciseProgrammingAllows(name, { route: 'automatic', experienceLevel: profile.experienceLevel, daysToGame }) === (daysToGame === null || daysToGame > limit));
    }
  }
  check('Horse Stance Hold: manual and automatic routes both exclude G-1 but allow G-2',
    !exerciseProgrammingAllows('Horse Stance Hold', { route: 'manual', experienceLevel: 'Complete beginner', daysToGame: 1 })
    && exerciseProgrammingAllows('Horse Stance Hold', { route: 'manual', experienceLevel: 'Complete beginner', daysToGame: 2 })
    && !exerciseProgrammingAllows('Horse Stance Hold', { route: 'automatic', experienceLevel: 'Complete beginner', daysToGame: 1 })
    && exerciseProgrammingAllows('Horse Stance Hold', { route: 'automatic', experienceLevel: 'Complete beginner', daysToGame: 2 })
    && !exerciseProgrammingAllows('Horse Stance Hold', { route: 'primer', experienceLevel: 'Complete beginner', daysToGame: 2 }));
  for (const name of ['Seated Good Morning']) {
    check(`${name}: no-game automatic route is unrestricted when daysToGame is absent`,
      exerciseProgrammingAllows(name, {
        route: 'automatic', experienceLevel: '5+ years', daysToGame: undefined,
      }));
    check(`${name}: no-game warm-up route is unrestricted when daysToGame is absent`,
      exerciseProgrammingAllows(name, {
        route: 'warmup', experienceLevel: '5+ years', daysToGame: undefined,
      }));
  }
  check('Sleeper Stretch is allowed at G-1 but never automatically selected for Primer',
    exerciseProgrammingAllows('Sleeper Stretch', { route: 'automatic', experienceLevel: 'Complete beginner', daysToGame: 1 })
    && exerciseProgrammingAllows('Sleeper Stretch', { route: 'warmup', experienceLevel: 'Complete beginner', daysToGame: 1 })
    && !exerciseProgrammingAllows('Sleeper Stretch', { route: 'primer', experienceLevel: 'Complete beginner', daysToGame: 1 }));
  check('Foam Roller Thoracic Extension is allowed lightly at G-1 but never automatically selected for Primer',
    exerciseProgrammingAllows('Foam Roller Thoracic Extension', { route: 'automatic', experienceLevel: 'Complete beginner', daysToGame: 1 })
    && exerciseProgrammingAllows('Foam Roller Thoracic Extension', { route: 'warmup', experienceLevel: 'Complete beginner', daysToGame: 1 })
    && !exerciseProgrammingAllows('Foam Roller Thoracic Extension', { route: 'primer', experienceLevel: 'Complete beginner', daysToGame: 1 }));
  for (const [name, bodyArea, suppliedSeverity] of [['Crab Hold', 'Shoulder'], ['Horse Stance Hold', 'Groin', 6], ['Bench Thoracic Extension', 'Shoulder', 6], ['Sleeper Stretch', 'Shoulder', 6], ['Foam Roller Thoracic Extension', 'Shoulder', 6], ['Reverse Nordic Curl', 'Knee'],
    ['Rotational Medicine-Ball Throw', 'Lower back'], ['Medicine-Ball Slam', 'Shoulder'], ['Rotational Medicine-Ball Slam', 'Wrist/hand']] as const) {
    const severity = suppliedSeverity ?? 5;
    const constraint = buildGuidedInjuryConstraint({ area: bodyArea, region: 'upper_body', severity,
      severityBand: 'moderate', adjustmentLevel: 'moderate', triggers: [], seriousSymptoms: false }, { todayISO: date });
    const injured = resolveTapSwapEnvironment({ date, profile, gameDates: [], activeConstraints: [constraint], readinessSignal: null });
    check(`${name}: actual injury blocks manual choice`, !assessTapSwapCandidateSafety(name, injured).safe);
    const injuredAthlete = { ...athlete, injuries: [{ bodyArea, description: '', severityScore: severity }] };
    if (name === 'Reverse Nordic Curl') {
      check(`${name}: healthy lower-prehab pool admits it`, filterPoolForAthlete('lower_prehab', athlete).some(row => row.name === name));
      check(`${name}: injury excludes it from the actual lower-prehab pool`, !filterPoolForAthlete('lower_prehab', injuredAthlete).some(row => row.name === name));
      continue;
    }
    const type = ['Crab Hold', 'Horse Stance Hold', 'Bench Thoracic Extension', 'Sleeper Stretch', 'Foam Roller Thoracic Extension'].includes(name) ? 'mobility' : 'primer';
    let healthySeed: string | undefined;
    for (let seed = 0; seed < 120 && !healthySeed; seed++) {
      const seedDate = plusDays(date, seed);
      const built = quiet(() => buildDerivedSession(type, seedDate, 'intake', 'injury control', athlete));
      if (built.exercises.some(row => row.exercise.name === name)) healthySeed = seedDate;
    }
    check(`${name}: healthy control reaches the automatic ${type} route`, !!healthySeed);
    if (healthySeed) {
      const built = quiet(() => buildDerivedSession(type, healthySeed!, 'intake', 'injury exclusion', injuredAthlete));
      check(`${name}: actual injury excludes an otherwise selected automatic row`, !built.exercises.some(row => row.exercise.name === name));
    }
  }
  const reached = new Set<string>();
  const warmupsReached = new Set<string>();
  const powerReached = new Set<string>();
  const mobilityReached = new Set<string>();
  const recoveryReached = new Set<string>();
  const primerReached = new Set<string>();
  const horseRouteSeed: Partial<Record<'mobility' | 'recovery', string>> = {};
  for (const family of ['upper', 'lower'] as const) for (let block = 1; block <= 80; block++) {
    const row = buildPowerRow({ family, kind: 'primer', reduced: false,
      sets: 3, repsMin: 3, repsMax: 5, reason: 'intake power reachability' }, `power-${family}-${block}`, {
      availableEquipment: kit, phase: 'Pre-season', experienceLevel: profile.experienceLevel,
      blockId: `block-${family}-${block}`,
    });
    powerReached.add(row.exercise.name);
    const index = submitted.findIndex(([name]) => name === row.exercise.name);
    if (index >= 0 && EXERCISE_TAGS[row.exercise.name]?.power) check(`${row.exercise.name}: automatic power row carries its signed dose`,
      JSON.stringify([row.prescribedSets, row.prescribedRepsMin, row.prescribedRepsMax, row.restSeconds,
        row.prescriptionType, row.perSide]) === JSON.stringify(doses[index]));
  }
  for (const [name] of powerSubmitted) check(`${name}: ordinary automatic power is reachable`, powerReached.has(name));
  for (let day = 0; day < 120; day++) {
    for (const type of ['mobility', 'recovery', 'prehab_accessories', 'primer'] as const) {
      const built = quiet(() => buildDerivedSession(type, plusDays(date, day), 'intake', 'reachability', athlete));
      for (const row of built.exercises) {
        reached.add(row.exercise.name);
        if (type === 'mobility') mobilityReached.add(row.exercise.name);
        if (type === 'recovery') recoveryReached.add(row.exercise.name);
        if (type === 'primer') primerReached.add(row.exercise.name);
        if (row.exercise.name === 'Horse Stance Hold' && (type === 'mobility' || type === 'recovery')) {
          horseRouteSeed[type] ??= plusDays(date, day);
        }
      }
    }
  }
  check('Horse Stance Hold: automatic Mobility and Recovery routes are both reachable',
    mobilityReached.has('Horse Stance Hold') && recoveryReached.has('Horse Stance Hold'));
  for (const type of ['mobility', 'recovery'] as const) {
    const seedDate = horseRouteSeed[type];
    check(`Horse Stance Hold: actual ${type} route removes the otherwise selected row at G-1`, !!seedDate
      && !quiet(() => buildDerivedSession(type, seedDate!, 'intake', 'G-1 exclusion', { ...athlete, daysToGame: 1 }))
        .exercises.some(row => row.exercise.name === 'Horse Stance Hold'));
  }
  for (const category of Object.keys(FLOW_CATEGORY_MUSCLE_MAPPING)) {
    const eligible = flowSlotCandidates(category as keyof typeof FLOW_CATEGORY_MUSCLE_MAPPING, athlete);
    if (category === 'hip_prehab') check('lower warm-up can select both hip-flexor submissions',
      ['Seated Single-Leg Pike Lift', 'Standing Knee Extension'].every(name => eligible.some(row => row.name === name)));
    if (category === 'hip_mobility') check('lower warm-up admits Horse Stance Hold through the authored hip-mobility slot',
      eligible.some(row => row.name === 'Horse Stance Hold'));
  }
  const installed = await quietAsync(() => coldStartThroughOnboarding({ profile, installDayISO: date }));
  check('real onboarding accepts explicit ball and fixture-free profile', !installed.onboardingRefusal);
  const acceptedEnvironment = resolveTapSwapEnvironment({ date, profile, gameDates: [],
    scheduleState: buildScheduleStateImperative(), activeConstraints: [], readinessSignal: null });
  check('manual eligibility reads the accepted preseason power policy', acceptedEnvironment.weeklyContract?.power.eligible === true);
  for (const [name] of powerSubmitted) {
    check(`${name}: offered under the actual accepted power contract`, assessTapSwapCandidateSafety(name, acceptedEnvironment).safe);
  }
  const program = useProgramStore.getState().currentProgram!;
  let horseWarmupCase: { workout: (typeof program.microcycles)[number]['workouts'][number]; date: string } | null = null;
  for (const week of program.microcycles) for (const workout of week.workouts) {
    for (const row of workout.exercises) reached.add(row.exercise.name);
    for (let seed = 0; seed < 40; seed++) {
      const flow = selectMobilityPrehabFlow({ workout, date: plusDays(date, seed), athlete, performedMovementIds: [], seasonPhase: profile.seasonPhase!, isGameWeek: false });
      for (const row of flow?.movements ?? []) {
        reached.add(row.exercise.name);
        warmupsReached.add(row.exercise.name);
        if (row.exercise.name === 'Horse Stance Hold') horseWarmupCase ??= { workout, date: plusDays(date, seed) };
      }
    }
  }
  for (const name of ['Seated Single-Leg Pike Lift', 'Standing Knee Extension', 'Crab Hold', 'Horse Stance Hold', 'SL 45° Back Extension Hold', 'Bench Thoracic Extension', 'Sleeper Stretch', 'Foam Roller Thoracic Extension']) {
    check(`${name}: approved warm-up route actually selects it`, warmupsReached.has(name));
  }
  for (const name of ['Seated Good Morning']) {
    check(`${name}: approved in-session mobility route actually selects it`, warmupsReached.has(name));
  }
  check('Horse Stance Hold: the actual lower warm-up removes its otherwise selected row at G-1',
    !!horseWarmupCase && !selectMobilityPrehabFlow({ workout: horseWarmupCase.workout,
      date: horseWarmupCase.date, athlete: { ...athlete, daysToGame: 1 }, performedMovementIds: [],
      seasonPhase: profile.seasonPhase!, isGameWeek: true })?.movements.some(row => row.exercise.name === 'Horse Stance Hold'));
  check('the one canonical Seated Good Morning is selected by automatic mobility',
    reached.has('Seated Good Morning') && !reached.has('Seated Good Morning (Barbell)'));
  check('Bench Thoracic Extension reaches both automatic Mobility and Recovery sessions',
    mobilityReached.has('Bench Thoracic Extension') && recoveryReached.has('Bench Thoracic Extension'));
  check('Sleeper Stretch reaches both automatic Mobility and Recovery sessions',
    mobilityReached.has('Sleeper Stretch') && recoveryReached.has('Sleeper Stretch'));
  check('Foam Roller Thoracic Extension reaches both automatic Mobility and Recovery sessions',
    mobilityReached.has('Foam Roller Thoracic Extension') && recoveryReached.has('Foam Roller Thoracic Extension'));
  check('Foam Roller Thoracic Extension never enters an automatically composed Primer',
    !primerReached.has('Foam Roller Thoracic Extension'));
  check('Sleeper Stretch never enters an automatically composed Primer',
    !primerReached.has('Sleeper Stretch'));
  const context = getCoachRevisionTemplateContext(date);
  check('reachability crosses actual generated strength sessions', program.microcycles[0].workouts.some(w => !!w.strengthIntent));
  const pullDays = program.microcycles[0].workouts.filter(w =>
    w.strengthIntent?.plannedPatterns.includes('pull'));
  check('Band-Assisted Pull-Up: fixture matrix has a real pull session', pullDays.length > 0);
  for (const [label, bandProfile, eligible] of bandAssistedProfiles) {
    const names = pullDays.flatMap((pullDay, index) => {
      const buildBandDay = () => compileCanonicalStrengthTemplate({ composition: {
        ...context.strengthComposition!, profile: bandProfile,
        blockNumber: 40 + index, blockStartISO: plusDays(date, 280 + index * 28),
        selectionHistory: [],
      }, plannedDay: {
        planEntryId: pullDay.planEntryId!, isTeamDay: false,
        dayOfWeek: pullDay.dayOfWeek, name: pullDay.name,
        workoutType: pullDay.workoutType, sessionTier: pullDay.sessionTier!,
        strengthIntent: pullDay.strengthIntent, daysToGame: null,
      } });
      const built = quiet(buildBandDay);
      return built?.exercises.map(row => row.exercise.name) ?? [];
    });
    check(`Band-Assisted Pull-Up: ${label} automatic Pull-Up regression`,
      names.includes(bandAssistedPullUp) === eligible
      && (!eligible || !names.includes('Pull-Ups')));
  }
  const pushDays = program.microcycles[0].workouts.filter(w =>
    w.strengthIntent?.plannedPatterns.includes('push'));
  check('Incline Push-Up: fixture matrix has a real push session', pushDays.length > 0);
  for (const [label, inclineProfile, eligible] of bandAssistedProfiles) {
    const names = pushDays.flatMap((pushDay, dayIndex) => Array.from({ length: 12 }, (_, blockIndex) => {
      const built = quiet(() => compileCanonicalStrengthTemplate({ composition: {
        ...context.strengthComposition!, profile: inclineProfile,
        blockNumber: 80 + blockIndex, blockStartISO: plusDays(date, 560 + blockIndex * 28),
        selectionHistory: [], pinnedIdentities: [composedIdentityFor('Push-ups')],
      }, plannedDay: {
        planEntryId: pushDay.planEntryId!, isTeamDay: false,
        dayOfWeek: pushDay.dayOfWeek, name: pushDay.name,
        workoutType: pushDay.workoutType, sessionTier: pushDay.sessionTier!,
        strengthIntent: pushDay.strengthIntent, daysToGame: null,
      } }));
      return built?.exercises.map(row => row.exercise.name) ?? [];
    }).flat());
    const automaticIdentity = sourceBoundAutomaticIdentityFor(
      'Push-ups', ['Push-ups', inclinePushUp], inclineProfile,
    );
    check(`Incline Push-Up: ${label} automatic Push-ups regression`,
      automaticIdentity === (eligible ? inclinePushUp : 'Push-ups')
      && (!eligible || !names.includes('Push-ups'))
      && (inclineProfile.experienceLevel === '1-2 years'
        || names.includes(inclinePushUp) === eligible));
  }
  const lowerDays = program.microcycles[0].workouts.filter(w => w.strengthIntent?.plannedPatterns.some(p => p === 'hinge' || p === 'squat'));
  check('fixture matrix has real generated lower sessions', lowerDays.length > 0);
  const firstLower = lowerDays[0];
  const composed = composeWeek({ ...context.strengthComposition!, plannedDays: [{
    planEntryId: firstLower.planEntryId!, isTeamDay: false, dayOfWeek: firstLower.dayOfWeek,
    name: firstLower.name, workoutType: firstLower.workoutType, sessionTier: firstLower.sessionTier!,
    strengthIntent: firstLower.strengthIntent, daysToGame: null,
  }] });
  const spec = { kind: 'primer' as const, family: 'upper' as const, sets: 2, repsMin: 3, repsMax: 5, reduced: false, reason: 'collision control' };
  const powerContext = { phase: 'Pre-season' as const, experienceLevel: '2-5 years' as const, availableEquipment: ['bodyweight'] as any, blockId: 'collision-proof' };
  const proposed = buildPowerRow(spec, 'collision-proof', powerContext);
  const materialiseContext = { microcycleId: 'collision-proof', weekStartISO: date,
    power: { ...powerContext, allowance: 1, primerByDay: { [firstLower.dayOfWeek]: spec } } };
  const control = materialiseComposedWeek(composed, materialiseContext)[0];
  check('power collision control has actual composed strength and a delivered primer',
    composed.days[0].rows.length > 0 && control.exercises.some(r => r.role === 'power'));
  const colliding = { ...composed, days: composed.days.map(d => ({ ...d,
    rows: d.rows.map((r, i) => i === 0 ? { ...r, identity: composedIdentityFor(proposed.exercise.name) } : r),
  })) };
  const collision = materialiseComposedWeek(colliding, materialiseContext)[0];
  check('R-118 collision suppresses only power, preserving the actual strength rows',
    !collision.exercises.some(r => r.role === 'power')
    && collision.exercises.length === composed.days[0].rows.length
    && collision.exercises.some(r => r.exercise.name === proposed.exercise.name));
  for (const experienceLevel of ['Complete beginner', '1-2 years', '5+ years'] as const) for (const daysToGame of [1, 2, 4, null]) {
    const names = lowerDays.flatMap(lower => {
    const built = quiet(() => compileCanonicalStrengthTemplate({ composition: {
      ...context.strengthComposition!, profile: { ...profile, experienceLevel },
      blockNumber: 2, blockStartISO: plusDays(date, 28),
      pinnedIdentities: ['SL 45° Back Extension', 'Reverse Nordic Curl'].map(composedIdentityFor),
    }, plannedDay: { planEntryId: lower.planEntryId!, isTeamDay: false, dayOfWeek: lower.dayOfWeek,
      name: lower.name, workoutType: lower.workoutType, sessionTier: lower.sessionTier!,
      strengthIntent: lower.strengthIntent, daysToGame } }));
      return built?.exercises.map(row => row.exercise.name) ?? [];
    });
    check(`${experienceLevel}/G-${daysToGame}: compiler honors Reverse Nordic boundary`,
      names.includes('Reverse Nordic Curl') === (experienceLevel !== 'Complete beginner' && (daysToGame === null || daysToGame > 2)));
    check(`${experienceLevel}/G-${daysToGame}: compiler honors unilateral extension boundary`,
      names.includes('SL 45° Back Extension') === (experienceLevel !== 'Complete beginner' && (daysToGame === null || daysToGame > 1)));
    // R-352 CONTROL: the pinned drill wins the LAST seat, never a loaded one —
    // wherever Reverse Nordic Curl lands, four loaded rows already stand
    // before it on that day (R-342 is not narrowed by the pin).
    const pinnedAfterFourLoaded = lowerDays.every(lower => {
      const built = quiet(() => compileCanonicalStrengthTemplate({ composition: {
        ...context.strengthComposition!, profile: { ...profile, experienceLevel },
        blockNumber: 2, blockStartISO: plusDays(date, 28),
        pinnedIdentities: ['SL 45° Back Extension', 'Reverse Nordic Curl'].map(composedIdentityFor),
      }, plannedDay: { planEntryId: lower.planEntryId!, isTeamDay: false, dayOfWeek: lower.dayOfWeek,
        name: lower.name, workoutType: lower.workoutType, sessionTier: lower.sessionTier!,
        strengthIntent: lower.strengthIntent, daysToGame } }));
      const rows = built?.exercises.map(row => row.exercise.name) ?? [];
      const at = rows.indexOf('Reverse Nordic Curl');
      if (at === -1) return true;
      return rows.slice(0, at).filter(name => usefulStrengthIdentityCounts(composedIdentityFor(name))).length >= 4;
    });
    check(`${experienceLevel}/G-${daysToGame}: a pinned drill never displaces one of the four loaded rows (R-352)`, pinnedAfterFourLoaded);
  }
  for (let block = 1; block <= 3; block++) for (const workout of program.microcycles[0].workouts.filter(w => !!w.strengthIntent)) {
    const built = quiet(() => compileCanonicalStrengthTemplate({ composition: {
      ...context.strengthComposition!, blockNumber: block, blockStartISO: plusDays(date, block * 28),
      pinnedIdentities: ['SL 45° Back Extension', 'Reverse Nordic Curl'].map(composedIdentityFor),
    }, plannedDay: { planEntryId: workout.planEntryId!, isTeamDay: false, dayOfWeek: workout.dayOfWeek,
      name: workout.name, workoutType: workout.workoutType, sessionTier: workout.sessionTier!,
      strengthIntent: workout.strengthIntent, daysToGame: null } }));
    for (const row of built!.exercises) reached.add(row.exercise.name);
  }
  const hopSpec = { kind: 'primer' as const, family: 'lower' as const, sets: 3,
    repsMin: 3, repsMax: 5, reduced: false, reason: 'intake reachability' };
  for (let block = 1; block <= 80; block++) {
    const built = buildPowerRow(hopSpec, `hop-reach-${block}`, {
      phase: 'In-season', experienceLevel: '2-5 years', availableEquipment: kit,
      blockId: `hop-reach-${block}`,
    });
    reached.add(built.exercise.name);
  }
  check('Single-Leg Hop and Stick: actual power selector reaches it in-season for 2+ years',
    reached.has('Single-Leg Hop and Stick'));
  console.log('AUTOMATIC REACHED', submitted.filter(([name]) => reached.has(name)).map(([name]) => name));
  for (const [name] of submitted) check(`${name}: selected by a real automatic builder`, reached.has(name));
  const saved = visibleSignature(quiet(() => deriveVisibleWeekLive(date, date)));
  const boot = await quietAsync(() => relaunchApp({ storage, todayISO: date }));
  check('restart reconstructs identical visible program', boot.ok && visibleSignature(quiet(() => deriveVisibleWeekLive(date, date))) === saved);
  const addedDates = new Set<string>();
  for (const [name] of submitted) {
    const view = quiet(() => deriveVisibleWeekLive(date, date));
    const day = view.find(day => day.workout?.strengthIntent && !coachRevisionExistingExerciseNames(day.workout, day.date).includes(name));
    check(`${name}: a real session can receive the manual addition`, !!day);
    if (!day) continue;
    const candidate = choices.find(c => c.name === name)!;
    const result = await quietAsync(() => executeProgramControlActionDurably({ type: 'add_exercise',
      source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' }, scope: 'today_only',
      payload: { date: day.date, exercise: candidate }, requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true,
    }, { todayISO: date }));
    const current = quiet(() => deriveVisibleWeekLive(date, date)).find(d => d.date === day.date)!;
    check(`${name}: manual Add reaches the visible session`, result.ok && coachRevisionExistingExerciseNames(current.workout!, day.date).includes(name));
    const row = current.workout!.exercises.find(row => row.exercise.name === name);
    check(`${name}: added row retains its authored dose`, !!row && row.prescribedSets === candidate.sets &&
      row.prescribedRepsMin === candidate.repsMin && row.prescribedRepsMax === candidate.repsMax &&
      row.prescriptionType === candidate.prescriptionType && !!row.perSide === !!candidate.perSide
      && row.restSeconds === candidate.restSeconds && row.notes?.includes(candidate.notes ?? ''));
    check(`${name}: Add preserves all existing rows and adds exactly one`,
      current.workout!.exercises.length === day.workout!.exercises.length + 1
      && day.workout!.exercises.every(old => current.workout!.exercises.some(r => r.id === old.id)));
    if (EXERCISE_TAGS[name]?.power) check(`${name}: manual Add retains typed power role for hidden rest and counting`,
      row?.role === 'power'
      && row.power?.family === (EXERCISE_TAGS[name]?.region === 'lower' ? 'lower' : 'upper')
      && row.power.kind === 'primer');
    const alternative = legalAddAlternativesForExercise({ ...args, originalExercise: name,
      existingExerciseNames: coachRevisionExistingExerciseNames(current.workout!, day.date) }).find(c => !EXERCISE_TAGS[c.name]?.power);
    check(`${name}: a real Swap alternative exists`, !!alternative);
    if (alternative) {
      const swap = async (fromExercise: string, toExercise: typeof candidate) => quietAsync(() => executeProgramControlActionDurably({
        type: 'swap_exercise', source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' }, scope: 'today_only',
        payload: { date: day.date, fromExercise, toExercise }, requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true,
      }, { todayISO: date }));
      const away = await swap(name, alternative);
      const awayRow = quiet(() => deriveVisibleWeekLive(date, date)).find(d => d.date === day.date)!.workout!.exercises.find(r => r.exercise.name === alternative.name);
      if (EXERCISE_TAGS[name]?.power) check(`${name}: Swap to non-power clears inherited power metadata`,
        !!awayRow && awayRow.role !== 'power' && !awayRow.power && !awayRow.supersetGroup);
      const back = away.ok ? await swap(alternative.name, candidate) : away;
      const restored = quiet(() => deriveVisibleWeekLive(date, date)).find(d => d.date === day.date)!.workout!.exercises.find(row => row.exercise.name === name);
      check(`${name}: actual Swap round-trip`, away.ok && back.ok && !!restored);
      if (EXERCISE_TAGS[name]?.power) check(`${name}: Swap-back retains typed power role`,
        restored?.role === 'power'
        && restored.power?.family === (EXERCISE_TAGS[name]?.region === 'lower' ? 'lower' : 'upper')
        && restored.power.kind === 'primer');
      check(`${name}: Swap preserves prescribed units and sides`, !!restored && restored.prescriptionType === candidate.prescriptionType &&
        !!restored.perSide === !!candidate.perSide && restored.prescribedRepsMin === candidate.repsMin && restored.prescribedRepsMax === candidate.repsMax);
    }
    addedDates.add(day.date);
  }
  check('manual additions exceed the planner cap without creating exclusions',
    quiet(() => deriveVisibleWeekLive(date, date)).some(d => (d.workout?.exercises.length ?? 0) > 7)
    && getAthleteExclusions().length === 0);
  const added = visibleSignature(quiet(() => deriveVisibleWeekLive(date, date)));
  const addedBoot = await quietAsync(() => relaunchApp({ storage, todayISO: date }));
  check('all accumulated manual additions survive restart', addedBoot.ok && visibleSignature(quiet(() => deriveVisibleWeekLive(date, date))) === added);
  for (const day of addedDates) {
    setJourneyClock(day);
    const workout = quiet(() => deriveVisibleWeekLive(date, day)).find(d => d.date === day)!.workout!;
    const loadable = workout.exercises.filter(row => [
      'Rotational Medicine-Ball Throw', 'Medicine-Ball Slam', 'Rotational Medicine-Ball Slam',
      'SL 45° Back Extension', 'SL 45° Back Extension Hold', 'Horse Stance Hold',
      'Foam Roller Thoracic Extension',
    ].includes(row.exercise.name));
    for (const row of loadable) useProgramStore.getState().setWeightOverride(day, row.exerciseId, 4);
    const logged = await quietAsync(() => recordDay(day, { record: true, completion: 'full', feeling: 'good', soreness: 'none', difficulty: 6, logWeights: true }));
    check(`logging ${day}: modified session saves through the real outcome door`, logged.result === 'recorded');
    const feedback = JSON.stringify(useProgramStore.getState().sessionFeedback[day]);
    const loggedBoot = await quietAsync(() => relaunchApp({ storage, todayISO: day }));
    check(`logging ${day}: accepted record survives restart`, loggedBoot.ok && JSON.stringify(useProgramStore.getState().sessionFeedback[day]) === feedback);
    for (const row of loadable) check(`${row.exercise.name}: athlete-entered total kg survives restart`,
      useProgramStore.getState().weightOverrides[day]?.[row.exerciseId] === 4);
  }
  if (!mutation) for (const [name, expectedFailure] of [
    ['experience', /Reverse Nordic Curl: automatic novice boundary/],
    ['fixture', /G-(1|2): compiler honors Reverse Nordic boundary/],
    ['horse_fixture', /Horse Stance Hold: manual and automatic routes both exclude G-1/],
    ['equipment', /Rotational Medicine-Ball Throw: blocked without/],
    ['duration', /Horse Stance Hold: signed dose, rest, unit and side/],
    ['cue', /Horse Stance Hold: exact supplied primary cue/],
    ['video', /Horse Stance Hold: exact confirmed video URL/],
    ['bench_dose', /Bench Thoracic Extension: signed dose, rest, unit and side/],
    ['bench_equipment', /Bench Thoracic Extension accepts either support and refuses neither/],
    ['bench_route', /Bench Thoracic Extension: approved warm-up route actually selects it/],
    ['sleeper_dose', /Sleeper Stretch: signed dose, rest, unit and side/],
    ['sleeper_equipment', /Sleeper Stretch needs no equipment and manual Add\/Swap agrees/],
    ['sleeper_primer', /Sleeper Stretch is allowed at G-1 but never automatically selected for Primer/],
    ['foam_dose', /Foam Roller Thoracic Extension: signed dose, rest, unit and side/],
    ['foam_equipment', /Foam Roller Thoracic Extension keeps the roller mandatory and accepts either loading implement/],
    ['foam_load', /Foam Roller Thoracic Extension: athlete chooses and records total held load/],
    ['foam_primer', /Foam Roller Thoracic Extension is allowed lightly at G-1 but never automatically selected for Primer/],
    ['band_source', /Band-Assisted Pull-Up: (beginner male Pull-Up-only Swap eligibility|only Pull-Ups may be the Swap source)/],
    ['band_eligibility', /Band-Assisted Pull-Up: 1-2 years female Pull-Up-only Swap eligibility/],
    ['band_equipment', /Band-Assisted Pull-Up: exact existing equipment rule/],
    ['band_load', /Band-Assisted Pull-Up: band strength\/colour is the load control/],
    ['incline_source', /Incline Push-Up: (beginner male Push-ups-only Swap eligibility|only Push-ups may be the Swap source)/],
    ['incline_eligibility', /Incline Push-Up: 1-2 years female Push-ups-only Swap eligibility/],
    ['incline_equipment', /Incline Push-Up: exact existing equipment rule/],
    ['incline_load', /Incline Push-Up: bodyweight-only load control records no kilograms/],
    ['hop_experience', /Single-Leg Hop and Stick: (manual and automatic experience boundary is 2\+ years|ordinary lower-power pool entry with exact gates)/],
    ['hop_inseason', /Single-Leg Hop and Stick: ordinary lower-power pool entry with exact gates/],
    ['hop_dose', /Single-Leg Hop and Stick: signed dose, rest, unit and side/],
    ['hop_load', /Single-Leg Hop and Stick: exact power catalogue muscles and bodyweight loading/],
  ] as const) {
    const child = spawnSync(resolve(__dirname, '../../node_modules/.bin/sucrase-node'), [__filename], {
      encoding: 'utf8', env: { ...process.env, LFA_INTAKE_MUTATION: name }, timeout: 120000,
    });
    check(`mutation ${name}: guard fails for the intended broken contract`, child.status === 1 && expectedFailure.test(child.stderr));
  }
  console.log(`Exercise intake: ${passed} passed / ${failed} failed; ${submitted.length} distinct submitted exercises`);
  totalsPrinted(failed);
  if (failed) process.exitCode = 1;
}
main().catch(error => { console.error(error); totalsPrinted(1); process.exitCode = 1; });
