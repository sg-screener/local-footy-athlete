/**
 * Session naming regressions.
 *
 * Run: npm run test:session-naming
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { buildWorkoutsFromCoach } from '../data/defaultProgram';
import {
  buildCoachingPlan,
  type CoachingInputs,
  type SessionAllocation,
} from '../utils/coachingEngine';
import {
  inferStrengthMovementPatterns,
  movementPatternsFromStrengthPattern,
  resolveSessionDisplayName,
} from '../utils/sessionNaming';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean, detail?: string) {
  if (condition) {
    pass++;
    console.log(`  PASS ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
  }
}

function eq<T>(name: string, actual: T, expected: T) {
  ok(
    name,
    JSON.stringify(actual) === JSON.stringify(expected),
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

function notEq<T>(name: string, actual: T, unexpected: T) {
  ok(
    name,
    JSON.stringify(actual) !== JSON.stringify(unexpected),
    `did not expect ${JSON.stringify(unexpected)}`,
  );
}

function section(label: string) {
  console.log(`\n${label}`);
}

const DAY_ORDER: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

const lowerHingeWithFinisher =
  'Hip-dominant lower (RDL, hip thrust; optional hamstring accessory: nordic lower) + easy off-feet aerobic finisher (bike/row/ski, 15-20min)';
const lowerSquatWithFinisher =
  'Lower body - squat emphasis (quad-dominant: squat, lunge, leg press; optional quad accessory: leg extension) + easy off-feet aerobic finisher (bike/row/ski, 15-20min)';
const upperPushWithFinisher =
  'Upper body - push emphasis (bench, OHP, dips) + easy off-feet aerobic finisher (bike/row/ski, 15-20min)';
const upperPullWithFinisher =
  'Upper body - pull emphasis (rows, pull-ups, face pulls) + easy off-feet aerobic finisher (bike/row/ski, 15-20min)';
const fullBodyWithFinisher =
  'Full body - moderate load, cover all movement patterns (1 squat/hinge + 1 push + 1 pull) + easy off-feet aerobic finisher (bike/row/ski, 15-20min)';
const conditioningOnly =
  'easy off-feet aerobic finisher (bike/row/ski/erg, 15-20min)';

function display(input: Parameters<typeof resolveSessionDisplayName>[0]): string {
  return resolveSessionDisplayName({
    hasCombinedConditioning: true,
    conditioningFlavour: 'aerobic',
    ...input,
  });
}

function offSeasonFourDayInputs(): CoachingInputs {
  return {
    seasonPhase: 'Off-season',
    availableDays: 4,
    selectedDays: ['Monday', 'Wednesday', 'Friday', 'Saturday'],
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    teamTrainingIntensity: undefined,
    sprintExposure: 'Moderate',
    conditioningLevel: 'Good',
    recentTrainingLoad: 'Pretty consistent',
    injuries: [],
    goals: ['Get stronger'],
    hasGame: false,
    gameDay: undefined,
  };
}

function displayLabelForAllocation(session: SessionAllocation): string {
  return resolveSessionDisplayName({
    focus: session.focus,
    strengthPattern: session.strengthPattern,
    isTeamDay: session.isTeamDay,
    conditioningFlavour: session.conditioningFlavour,
    hasCombinedConditioning: session.hasCombinedConditioning,
    tier: session.tier,
  });
}

section('[1] Strength naming ignores conditioning finisher text');

eq(
  'typed lower hinge + bike/row/ski finisher stays Lower Hinge',
  display({ focus: lowerHingeWithFinisher, strengthPattern: 'lower' }),
  'Lower Hinge',
);
eq(
  'legacy lower hinge + bike/row/ski finisher does not become full body',
  display({ focus: lowerHingeWithFinisher }),
  'Lower Hinge',
);
eq(
  'typed lower squat + bike/row/ski finisher stays Lower Squat',
  display({ focus: lowerSquatWithFinisher, strengthPattern: 'lower' }),
  'Lower Squat',
);
eq(
  'legacy lower squat + bike/row/ski finisher does not become full body',
  display({ focus: lowerSquatWithFinisher }),
  'Lower Squat',
);
eq(
  'upper push + bike/row/ski finisher stays Upper Push',
  display({ focus: upperPushWithFinisher, strengthPattern: 'push' }),
  'Upper Push',
);
eq(
  'legacy upper push + bike/row/ski finisher stays Upper Push',
  display({ focus: upperPushWithFinisher }),
  'Upper Push',
);
eq(
  'upper pull + bike/row/ski finisher stays Upper Pull',
  display({ focus: upperPullWithFinisher, strengthPattern: 'pull' }),
  'Upper Pull',
);
eq(
  'legacy upper pull + bike/row/ski finisher stays Upper Pull',
  display({ focus: upperPullWithFinisher }),
  'Upper Pull',
);
eq(
  'true full body still displays Full Body Strength',
  display({ focus: fullBodyWithFinisher, strengthPattern: 'full_body' }),
  'Full Body Strength',
);
eq(
  'conditioning-only text does not create movement patterns',
  inferStrengthMovementPatterns(conditioningOnly),
  [],
);
notEq(
  'conditioning-only display does not create fake full-body strength',
  resolveSessionDisplayName({ focus: conditioningOnly }),
  'Full Body Strength',
);
notEq(
  'conditioning-only display does not create fake upper pull',
  resolveSessionDisplayName({ focus: conditioningOnly }),
  'Upper Pull',
);
eq(
  'typed lower metadata never imports pull from row finisher',
  movementPatternsFromStrengthPattern('lower', lowerHingeWithFinisher),
  ['hinge'],
);

section('[2] Off-season 4-day display labels match structural plan');

{
  const plan = buildCoachingPlan(offSeasonFourDayInputs()).weeklyPlan;
  const labels = [...plan]
    .filter((session) => session.strengthPattern)
    .sort((a, b) => DAY_ORDER[a.dayOfWeek || ''] - DAY_ORDER[b.dayOfWeek || ''])
    .map(displayLabelForAllocation);

  eq(
    'S6 off-season 4-day no-team-training display labels',
    labels,
    ['Upper Push', 'Lower Hinge', 'Upper Pull', 'Lower Squat'],
  );

  const actualFullBodyCount = plan.filter((session) => session.strengthPattern === 'full_body').length;
  const displayedFullBodyCount = labels.filter((label) => label === 'Full Body Strength').length;
  eq(
    'S6 does not display full body unless the structural type is full_body',
    displayedFullBodyCount,
    actualFullBodyCount,
  );
}

section('[3] Program builder names engine-built sessions from typed metadata');

{
  const plan = buildCoachingPlan(offSeasonFourDayInputs()).weeklyPlan;
  const workouts = buildWorkoutsFromCoach([], 'mc-session-naming', plan);
  const labels = workouts
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
    .map((workout) => workout.name);

  eq(
    'Program-screen workout names for S6',
    labels,
    ['Upper Push', 'Lower Hinge', 'Upper Pull', 'Lower Squat'],
  );
  ok(
    'Program-screen S6 has no false Full Body Strength labels',
    labels.every((label) => label !== 'Full Body Strength'),
    labels.join(' | '),
  );
}

console.log(`\nSession naming tests: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log(`Failures:\n${failures.map((name) => `  - ${name}`).join('\n')}`);
  process.exit(1);
}
