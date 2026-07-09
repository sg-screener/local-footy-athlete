import { buildWorkoutsFromCoach } from '../data/defaultProgram';
import type { OnboardingData, TrainingProgram, Microcycle, WeekKind } from '../types/domain';
import {
  buildCoachingPlan,
  onboardingToCoachingInputs,
} from '../utils/coachingEngine';
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
}

function generatedWeek(profile: Partial<OnboardingData>, options: { gameDayMark?: string; weekKind?: WeekKind } = {}): GeneratedWeek {
  const inputs = onboardingToCoachingInputs(profile as OnboardingData, { weekKind: options.weekKind });
  const plan = buildCoachingPlan(inputs);
  const workouts = buildWorkoutsFromCoach(
    [],
    'mc-bye-context',
    plan.weeklyPlan,
    profile as OnboardingData,
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
  return { resolvedWeek, report, flags };
}

function dayLabel(dateISO: string): string {
  return DAY_NAMES[new Date(`${dateISO}T12:00:00Z`).getUTCDay()].slice(0, 3);
}

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
    eq(`${c.label}: sprint/COD exposure comes from team anchors`, week.report.counts.sprintCodExposures, c.perWeek);
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

console.log('\n[4] current bye-week shape audit baseline');
{
  const week = generatedWeek(baseProfile());
  const saturday = week.resolvedWeek.find((day) => day.dayOfWeek === 6);
  const saturdayText = `${saturday?.workout?.name ?? ''} ${saturday?.workout?.description ?? ''}`;
  const saturdayUnits = week.report.counts.days.find((day) => day.date === saturday?.date)?.units ?? [];
  const saturdayCategories = saturdayUnits.map((unit) => unit.category);
  ok('audit gap: Saturday currently resolves as lower strength without conditioning metadata',
    /lower body strength/i.test(saturdayText) &&
      !saturday?.workout?.conditioningCategory &&
      !saturday?.workout?.hasCombinedConditioning,
    { saturday: saturdayText, conditioningCategory: saturday?.workout?.conditioningCategory });
  ok('audit gap: Saturday is not currently a real conditioning unit',
    !saturdayCategories.some((category) =>
      category === 'hard_conditioning' ||
      category === 'tempo_conditioning' ||
      category === 'aerobic_base' ||
      category === 'sprint'
    ),
    saturdayCategories);

  const snapshot = buildWeekShapeSnapshot({
    resolvedWeek: week.resolvedWeek,
    validationReport: week.report,
    seasonPhase: 'In-season',
    gameDay: undefined,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    weekKind: 'build',
  });
  ok('QA snapshot makes bye context visible', snapshot?.weekContext === 'In-season bye week | Deload: no', snapshot);
  ok('S4/E1-style accessory/gunshow does not inflate main strength',
    week.report.counts.gunshowSessions >= 1,
    {
      mainStrength: week.report.counts.mainStrengthExposures,
      gunshow: week.report.counts.gunshowSessions,
    });
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
