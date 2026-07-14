import { buildWorkoutsFromCoach } from '../data/defaultProgram';
import type { OnboardingData, TrainingProgram, Microcycle, WeekKind } from '../types/domain';
import {
  buildCoachingPlan,
  onboardingToCoachingInputs,
} from '../utils/coachingEngine';
import type { GenerationConstraintContext } from '../utils/generationConstraints';
import { DEFAULT_ATHLETE_CONTEXT } from '../utils/sessionBuilder';
import {
  addDays,
  computeGameDatesForBlock,
  resolveWeekWithConditioning,
  type ResolvedDay,
  type ScheduleState,
} from '../utils/sessionResolver';
import {
  deriveWeekValidationFlags,
  validateProgramWeek,
  validatorDaysFromResolvedWeek,
  type WeekValidationReport,
} from '../rules/weekStructureValidator';
import { resolveWeekContext } from '../rules/weekContext';
import { classifyVisibleSession } from '../rules/sessionClassificationAdapter';
import { evaluateEffectiveWeekExposureContract } from '../rules/weeklyExposureContract';
import { buildWeekShapeSnapshot } from './weekPlanQA/weekShapeSummary';

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: unknown) {
  if (condition) {
    pass++;
    console.log(`  PASS ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  FAIL ${name}`);
    if (detail !== undefined) console.log(`       ${JSON.stringify(detail, null, 2)}`);
  }
}

function eq(name: string, actual: unknown, expected: unknown) {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), { expected, actual });
}

const BLOCK_START = '2026-03-23';
const BLOCK_END = '2026-04-19';
const NOW = '2026-07-10T00:00:00.000Z';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const DAY_TO_NUM: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

function baseProfile(overrides: Partial<OnboardingData> = {}): Partial<OnboardingData> {
  return {
    seasonPhase: 'In-season',
    trainingDaysPerWeek: 6,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    teamTrainingIntensity: 'Hard',
    sprintExposure: '2+ times per week',
    conditioningLevel: 'Good',
    recentTrainingLoad: 'Very consistent',
    experienceLevel: '2-5 years',
    injuries: [],
    motivation: 'Get stronger',
    gameDay: undefined,
    usualGameDay: undefined,
    ...overrides,
  };
}

interface GeneratedWeek {
  resolvedWeek: ResolvedDay[];
  report: WeekValidationReport;
  flags: ReturnType<typeof deriveWeekValidationFlags>;
  weeklyPlan: ReturnType<typeof buildCoachingPlan>['weeklyPlan'];
  workouts: Microcycle['workouts'];
  exposureContract: ReturnType<typeof buildCoachingPlan>['weeklyExposureContract'];
}

interface GeneratedWeekOptions {
  gameDayMark?: string;
  weekKind?: WeekKind;
  generationConstraints?: GenerationConstraintContext;
}

function generatedWeek(profile: Partial<OnboardingData>, options: GeneratedWeekOptions = {}): GeneratedWeek {
  const inputs = onboardingToCoachingInputs(profile as OnboardingData, {
    weekKind: options.weekKind,
    generationConstraints: options.generationConstraints,
  });
  const plan = buildCoachingPlan(inputs);
  const workouts = buildWorkoutsFromCoach(
    [],
    'mc-bye-context',
    plan.weeklyPlan,
    profile as OnboardingData,
    options.weekKind ? {
      miniCycleNumber: 1,
      weekStartISO: BLOCK_START,
      weekKind: options.weekKind,
    } : undefined,
  );
  const microcycle: Microcycle = {
    id: 'mc-bye-context',
    programId: 'prog-bye-context',
    weekNumber: 1,
    startDate: BLOCK_START,
    endDate: addDays(BLOCK_START, 6),
    miniCycleNumber: 1,
    intensityMultiplier: 1.0,
    workouts,
    createdAt: NOW,
    updatedAt: NOW,
  };
  const program: TrainingProgram = {
    id: 'prog-bye-context',
    userId: 'user-bye-context',
    name: 'Bye Week Context Test Program',
    description: 'Bye week context test',
    programPhase: 'In-Season',
    startDate: BLOCK_START,
    endDate: BLOCK_END,
    microcycles: [microcycle],
    primaryFocus: 'Strength',
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
  };

  const markedDays: Record<string, 'game' | 'rest'> = {};
  if (options.gameDayMark) {
    for (const date of computeGameDatesForBlock(options.gameDayMark, BLOCK_START, BLOCK_END)) {
      markedDays[date] = 'game';
    }
  }
  const preferred = profile.preferredTrainingDays ?? [];
  const availableDayNumbers = preferred
    .map((day) => DAY_TO_NUM[day])
    .filter((day): day is number => day !== undefined);
  const state: ScheduleState = {
    currentProgram: program,
    currentMicrocycle: microcycle,
    manualOverrides: {},
    markedDays,
    athleteContext: DEFAULT_ATHLETE_CONTEXT,
    seasonPhase: (profile.seasonPhase ?? null) as ScheduleState['seasonPhase'],
    gameDay: profile.gameDay as never,
    usualGameDay: profile.usualGameDay,
    readiness: plan.readiness,
    availableDayNumbers,
  };

  const resolvedWeek = resolveWeekWithConditioning(BLOCK_START, state);
  const days = validatorDaysFromResolvedWeek(resolvedWeek);
  const validatorProfile = {
    seasonPhase: profile.seasonPhase,
    teamTrainingIntensity: profile.teamTrainingIntensity,
    conditioningLevel: profile.conditioningLevel,
    experienceLevel: profile.experienceLevel,
  };
  const flags = deriveWeekValidationFlags({ days, profile: validatorProfile });
  const report = validateProgramWeek({
    days,
    profile: validatorProfile,
    weekFlags: flags,
  });
  return {
    resolvedWeek,
    report,
    flags,
    weeklyPlan: plan.weeklyPlan,
    workouts,
    exposureContract: plan.weeklyExposureContract,
  };
}

function dayLabel(dateISO: string): string {
  return DAY_NAMES[new Date(`${dateISO}T12:00:00Z`).getUTCDay()].slice(0, 3);
}

const APP_CONDITIONING_CATEGORIES = new Set([
  'aerobic_base',
  'tempo_conditioning',
  'hard_conditioning',
]);

function appConditioningDays(week: GeneratedWeek) {
  return week.report.counts.days.filter((day) =>
    day.units.some((unit) => APP_CONDITIONING_CATEGORIES.has(unit.category)),
  );
}

function hasRealConditioningMetadata(week: GeneratedWeek): boolean {
  return appConditioningDays(week).every((classifiedDay) => {
    const workout = week.resolvedWeek.find((day) => day.date === classifiedDay.date)?.workout;
    if (!workout?.conditioningCategory || !workout.conditioningFlavour) return false;
    if (workout.hasCombinedConditioning) {
      return workout.attachedConditioningKind === 'component' &&
        !!workout.conditioningBlock?.options.length &&
        workout.conditioningBlock.options.every((option) =>
          option.exerciseIds.length > 0 &&
          (/\b\d+(?:-\d+)?\s*min/i.test(`${option.title} ${option.description}`) ||
            /\b\d+\s*x\s*\d+s\b/i.test(`${option.title} ${option.description}`)),
        );
    }
    return workout.workoutType === 'Conditioning' && workout.exercises.length > 0;
  });
}

const COOKED_READINESS: GenerationConstraintContext = {
  activeConstraintIds: ['fatigue-cooked'],
  injuries: [],
  activeInjuryKeys: [],
  readiness: {
    id: 'fatigue-cooked',
    sourceType: 'fatigue',
    severity: 6,
    tier: 'moderate_reduction',
    label: 'Cooked',
    avoidSprint: true,
    avoidHardConditioning: true,
    reduceHardExtras: true,
    preferRecovery: false,
    fullPause: false,
  },
};

const RESTRICTED_HAMSTRING: GenerationConstraintContext = {
  activeConstraintIds: ['injury-hamstring'],
  activeInjuryKeys: ['hamstring'],
  injuries: [{
    id: 'injury-hamstring',
    sourceType: 'injury',
    bodyPart: 'Hamstring',
    bucket: 'hamstring',
    region: 'lower_body',
    severity: 6,
    severityBand: 'major',
    onboardingSeverity: 'Severe',
    triggers: ['sprinting', 'hinging'],
    reduceAffectedWork: true,
    removeRiskyWork: true,
    pauseAffectedTraining: false,
    injuryKeys: ['hamstring'],
  }],
};

console.log('byeWeekClassificationTests');

console.log('\n[1] typed week context classification truth table');
{
  eq('in-season no fixture is a bye week', resolveWeekContext({
    seasonPhase: 'In-season',
    hasFixture: false,
    weekKind: 'build',
  }).kind, 'in_season_bye_week');
  ok('bye week does not automatically mean deload', !resolveWeekContext({
    seasonPhase: 'In-season',
    hasFixture: false,
    weekKind: 'build',
  }).isDeloadWeek);
  eq('in-season with game is not bye week', resolveWeekContext({
    seasonPhase: 'In-season',
    hasFixture: true,
  }).kind, 'in_season_game_week');
  eq('pre-season practice match is not bye week', resolveWeekContext({
    seasonPhase: 'Pre-season',
    hasFixture: true,
  }).kind, 'pre_season_practice_match_week');
  ok('pre-season practice match is not bye', !resolveWeekContext({
    seasonPhase: 'Pre-season',
    hasFixture: true,
  }).isByeWeek);
  ok('off-season no game is not bye', !resolveWeekContext({
    seasonPhase: 'Off-season',
    hasFixture: false,
  }).isByeWeek);
}

console.log('\n[2] generated in-season no-game weeks derive bye context at 2TT / 1TT / 0TT');
{
  const cases = [
    { label: '2 team trainings', teamDays: ['Tuesday', 'Thursday'], perWeek: 2 },
    { label: '1 team training', teamDays: ['Tuesday'], perWeek: 1 },
    { label: '0 team trainings', teamDays: [], perWeek: 0 },
  ];

  for (const c of cases) {
    const profile = baseProfile({
      teamTrainingDaysPerWeek: c.perWeek,
      teamTrainingDays: c.teamDays as OnboardingData['teamTrainingDays'],
    });
    const week = generatedWeek(profile);
    ok(`${c.label}: validator derives byeWeek=true`, week.flags.byeWeek === true, week.flags);
    ok(`${c.label}: no game/practice-match anchor`, week.report.anchorsUsed.gameDates.length === 0, week.report.anchorsUsed);
    eq(`${c.label}: team training anchors still count`, week.report.anchorsUsed.teamTrainingDates.map(dayLabel), c.teamDays.map((day) => day.slice(0, 3)));
    eq(`${c.label}: sprint/COD floor comes from anchors or one app exposure`,
      week.report.counts.sprintCodExposures, Math.max(1, c.perWeek));
    if (c.perWeek === 0) {
      ok(`${c.label}: final effective week validates its app sprint exposure`,
        !!week.exposureContract && evaluateEffectiveWeekExposureContract(
          week.exposureContract,
          week.workouts,
          BLOCK_START,
        ).accepted,
        week.workouts);
    }
  }
}

console.log('\n[3] non-bye generated weeks stay non-bye');
{
  const inSeasonGame = generatedWeek(baseProfile({
    gameDay: 'Saturday',
    usualGameDay: 'Saturday',
  }));
  ok('in-season with game = not bye', inSeasonGame.flags.byeWeek === false, inSeasonGame.flags);
  ok('in-season game week has game anchor', inSeasonGame.report.anchorsUsed.gameDates.length > 0, inSeasonGame.report.anchorsUsed);

  const preSeasonPractice = generatedWeek(baseProfile({
    seasonPhase: 'Pre-season',
    gameDay: 'Saturday',
    usualGameDay: 'Saturday',
  }), { gameDayMark: 'Saturday' });
  ok('pre-season practice match = not bye', preSeasonPractice.flags.byeWeek === false, preSeasonPractice.flags);
  ok('pre-season practice match has fixture anchor', preSeasonPractice.report.anchorsUsed.gameDates.length > 0, preSeasonPractice.report.anchorsUsed);

  const offSeasonNoGame = generatedWeek(baseProfile({
    seasonPhase: 'Off-season',
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
  }));
  ok('off-season no game = not bye', offSeasonNoGame.flags.byeWeek === false, offSeasonNoGame.flags);
}

console.log('\n[4] bye-week Saturday metadata and counting stay honest');
{
  const week = generatedWeek(baseProfile());
  const saturdayAllocation = week.weeklyPlan.find((session) => session.dayOfWeek === 'Saturday');
  const saturday = week.resolvedWeek.find((day) => day.dayOfWeek === 6);
  const saturdayText = `${saturday?.workout?.name ?? ''} ${saturday?.workout?.description ?? ''}`;
  const saturdayUnits = week.report.counts.days.find((day) => day.date === saturday?.date)?.units ?? [];
  const saturdayCategories = saturdayUnits.map((unit) => unit.category);
  ok('Saturday allocation is explicitly strength-only',
    saturdayAllocation?.strengthPattern === 'lower_combined' &&
      saturdayAllocation.strengthIntent?.plannedPatterns.includes('squat') &&
      saturdayAllocation.strengthIntent?.plannedPatterns.includes('hinge') &&
      !/conditioning|aerobic|tempo|interval|sprint|finisher/i.test(saturdayAllocation.focus) &&
      !saturdayAllocation.hasCombinedConditioning &&
      !saturdayAllocation.attachedConditioningKind &&
      !saturdayAllocation.conditioningFlavour &&
      !saturdayAllocation.conditioningCategory,
    saturdayAllocation);
  ok('resolved Saturday never shows conditioning wording without conditioning metadata',
    /\blower (?:body strength|squat)\b/i.test(saturdayText) &&
      !/conditioning|aerobic|tempo|interval|sprint|finisher/i.test(saturdayText) &&
      !saturday?.workout?.conditioningCategory &&
      !saturday?.workout?.conditioningFlavour &&
      !saturday?.workout?.hasCombinedConditioning &&
      !saturday?.workout?.conditioningBlock,
    {
      saturday: saturdayText,
      conditioningCategory: saturday?.workout?.conditioningCategory,
      conditioningBlock: saturday?.workout?.conditioningBlock,
    });
  eq('Saturday counts as lower strength only', saturdayCategories, ['lower_strength']);

  const snapshot = buildWeekShapeSnapshot({
    resolvedWeek: week.resolvedWeek,
    validationReport: week.report,
    seasonPhase: 'In-season',
    gameDay: undefined,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    weekKind: 'build',
  });
  ok('QA snapshot makes bye context visible', snapshot?.weekContext === 'In-season bye week | Deload: no', snapshot);
  ok('QA snapshot labels Saturday as lower strength only', snapshot?.days.Sat === 'lower strength', snapshot?.days);
  eq('QA snapshot uses canonical exposure counts', snapshot?.counts, {
    hardDays: week.report.counts.hardDays,
    mainStrength: week.report.counts.mainStrengthExposures,
    conditioning: week.report.counts.conditioningExposures,
    running: week.report.counts.runningExposures,
    sprintCod: week.report.counts.sprintCodExposures,
  });
  const gunshowWorkouts = week.workouts.filter((workout) =>
    classifyVisibleSession(workout).contributions.gunshow > 0);
  ok('optional gunshow/accessory work never counts as main strength when present',
    gunshowWorkouts.every((workout) =>
      classifyVisibleSession(workout).contributions.mainStrength === 0),
    gunshowWorkouts);
  const withoutGunshow = week.workouts.filter((workout) =>
    classifyVisibleSession(workout).contributions.gunshow === 0);
  const withoutGunshowValidation = week.exposureContract
    ? evaluateEffectiveWeekExposureContract(
        week.exposureContract,
        withoutGunshow,
        BLOCK_START,
      )
    : null;
  ok('absence of optional gunshow/accessory work does not invalidate a compliant bye week',
    withoutGunshowValidation?.accepted === true &&
      withoutGunshowValidation.ledger.achieved.main_strength === 3,
    withoutGunshowValidation);

  const gameSaturday = generatedWeek(baseProfile({
    gameDay: 'Saturday',
    usualGameDay: 'Saturday',
  })).resolvedWeek.find((day) => day.dayOfWeek === 6)?.workout;
  const practiceMatchSaturday = generatedWeek(baseProfile({
    seasonPhase: 'Pre-season',
    gameDay: 'Saturday',
    usualGameDay: 'Saturday',
  }), { gameDayMark: 'Saturday' }).resolvedWeek.find((day) => day.dayOfWeek === 6)?.workout;
  ok('game-week Saturday is unaffected', gameSaturday?.workoutType === 'Game', gameSaturday);
  ok('practice-match Saturday is unaffected', practiceMatchSaturday?.workoutType === 'Game', practiceMatchSaturday);
  ok('later game generation does not inherit bye Saturday metadata',
    !/bye-week gym top-up/i.test(`${gameSaturday?.name ?? ''} ${gameSaturday?.description ?? ''}`),
    gameSaturday);
}

console.log('\n[5] healthy bye-build shapes use phase targets and anchor credit');
{
  const twoTeam = generatedWeek(baseProfile());
  eq('2TT bye has the normal three main strength sessions', twoTeam.report.counts.mainStrengthExposures, 3);
  const twoTeamFinal = evaluateEffectiveWeekExposureContract(
    twoTeam.exposureContract!,
    twoTeam.workouts,
    BLOCK_START,
  );
  ok('2TT final validation accepts the planner-selected normal target',
    twoTeamFinal.accepted &&
      twoTeamFinal.ledger.achieved.main_strength === 3 &&
      twoTeam.exposureContract?.strength.targetCount === 3 &&
      twoTeam.exposureContract.strength.preferred.min === 3,
    twoTeamFinal);
  ok('2TT bye stays within the selected hard-day boundary',
    twoTeam.report.counts.hardDays <= (twoTeam.exposureContract?.hardDays.permittedCount ?? 0),
    twoTeam.report.counts);
  eq('2TT bye adds one app conditioning exposure', twoTeam.report.counts.extraConditioningSessions, 1);
  eq('2TT bye sprint/COD comes only from team training', twoTeam.report.counts.sprintCodExposures, 2);

  const oneTeam = generatedWeek(baseProfile({
    teamTrainingDaysPerWeek: 1,
    teamTrainingDays: ['Tuesday'],
  }));
  eq('1TT strong bye may select four main strength sessions', oneTeam.report.counts.mainStrengthExposures, 4);
  eq('1TT bye adds two useful conditioning top-ups', oneTeam.report.counts.extraConditioningSessions, 2);
  ok('1TT bye stays within the selected hard-day boundary',
    oneTeam.report.counts.hardDays <= (oneTeam.exposureContract?.hardDays.permittedCount ?? 0),
    oneTeam.report.counts);
  eq('1TT bye adds no sprint/COD beyond the team anchor', oneTeam.report.counts.sprintCodExposures, 1);
  ok('1TT conditioning top-up has real component metadata', hasRealConditioningMetadata(oneTeam), oneTeam.resolvedWeek);

  const zeroTeam = generatedWeek(baseProfile({
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
  }));
  eq('0TT strong bye may select four main strength sessions', zeroTeam.report.counts.mainStrengthExposures, 4);
  eq('0TT bye adds three core conditioning exposures', zeroTeam.report.counts.extraConditioningSessions, 3);
  ok('0TT bye stays within the selected hard-day boundary',
    zeroTeam.report.counts.hardDays <= (zeroTeam.exposureContract?.hardDays.permittedCount ?? 0),
    zeroTeam.report.counts);
  eq('0TT bye adds one app sprint/COD exposure', zeroTeam.report.counts.sprintCodExposures, 1);
  ok('0TT conditioning top-up has real component metadata', hasRealConditioningMetadata(zeroTeam), zeroTeam.resolvedWeek);
}

console.log('\n[6] recovery and injury-constrained byes retain their typed structure');
{
  const lowReadiness = generatedWeek(baseProfile({
    conditioningLevel: 'Poor',
    recentTrainingLoad: 'Hardly at all',
  }));
  eq('low-readiness bye keeps exactly two lighter main strength sessions',
    lowReadiness.report.counts.mainStrengthExposures, 2);
  eq('low-readiness bye does not add conditioning', lowReadiness.report.counts.extraConditioningSessions, 0);
  ok('low-readiness bye keeps Saturday light',
    lowReadiness.report.counts.days.find((day) => dayLabel(day.date) === 'Sat')?.units.every((unit) =>
      unit.category === 'recovery' || unit.category === 'gunshow_prehab' || unit.category === 'rest'),
    lowReadiness.report.counts.days);

  const cooked = generatedWeek(baseProfile(), { generationConstraints: COOKED_READINESS });
  eq('cooked bye keeps exactly two lighter main strength sessions', cooked.report.counts.mainStrengthExposures, 2);
  eq('cooked bye trims the conditioning top-up', cooked.report.counts.extraConditioningSessions, 0);
  eq('cooked bye preserves team sprint/COD anchors only', cooked.report.counts.sprintCodExposures, 2);

  const injured = generatedWeek(baseProfile(), { generationConstraints: RESTRICTED_HAMSTRING });
  ok('injury-restricted bye keeps safe upper work',
    injured.report.counts.days.some((day) => day.units.some((unit) => unit.category === 'upper_strength')),
    injured.report.counts.days);
  ok('injury-restricted bye does not force lower strength',
    !injured.report.counts.days.some((day) => day.units.some((unit) => unit.category === 'lower_strength')),
    injured.report.counts.days);
  eq('injury-restricted build replaces uncredited modified anchors with three safe app exposures',
    injured.report.counts.extraConditioningSessions, 3);

  const deload = generatedWeek(baseProfile({
    teamTrainingDaysPerWeek: 1,
    teamTrainingDays: ['Tuesday'],
  }), { weekKind: 'deload' });
  eq('deload bye keeps exactly two lighter main strength sessions', deload.report.counts.mainStrengthExposures, 2);
  eq('1TT deload bye allows one optional light aerobic top-up', deload.report.counts.extraConditioningSessions, 1);
  eq('deload bye adds no sprint/COD beyond team training', deload.report.counts.sprintCodExposures, 1);
  ok('deload bye context remains distinct from bye classification', resolveWeekContext({
    seasonPhase: 'In-season',
    hasFixture: false,
    weekKind: 'deload',
  }).isByeWeek && resolveWeekContext({
    seasonPhase: 'In-season',
    hasFixture: false,
    weekKind: 'deload',
  }).isDeloadWeek);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
