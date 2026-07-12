/** Canonical planned/effective strength-intent ownership regressions. */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import type { Microcycle, TrainingProgram, Workout, WorkoutExercise } from '../types/domain';
import {
  buildCoachingPlan,
  classifyGenerationAdjacencyRegion,
  type CoachingInputs,
} from '../utils/coachingEngine';
import {
  createStrengthIntent,
  normalizeStrengthIntent,
  resolveLegacyStrengthIntent,
  strengthIntentsEqual,
  strengthPatternLedger,
} from '../rules/strengthPatternContributions';
import { finaliseWorkoutAfterMutation } from '../utils/workoutCanonicalisation';
import { resolveSessionDisplayName } from '../utils/sessionNaming';
import { buildWeekLog } from '../utils/weekLogBuilder';
import { findMatchingFeedback } from '../utils/feedbackAdapter';
import { recomputeWeekOverrides } from '../utils/blockAdjuster';
import { inseason_3exposurePriority } from './scenarioQA/invariants';
import { buildIntent } from '../utils/exerciseScorer';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) {
    passed++;
    console.log(`  PASS ${name}`);
    return;
  }
  failed++;
  failures.push(name);
  console.log(`  FAIL ${name}${detail === undefined ? '' : ` ${JSON.stringify(detail)}`}`);
}

function eq(name: string, actual: unknown, expected: unknown): void {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), { expected, actual });
}

function exercise(name: string, index: number): WorkoutExercise {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return {
    id: `row-${slug}-${index}`,
    workoutId: 'strength-intent-workout',
    exerciseId: `ex-${slug}`,
    exerciseOrder: index + 1,
    prescribedSets: 3,
    prescribedRepsMin: 5,
    prescribedRepsMax: 8,
    prescribedWeightKg: 50,
    restSeconds: 90,
    exercise: {
      id: `ex-${slug}`,
      name,
      description: name,
      exerciseType: 'Compound',
      muscleGroups: [],
      equipmentRequired: [],
      difficultyLevel: 'Intermediate',
      createdAt: '',
      updatedAt: '',
    },
    createdAt: '',
    updatedAt: '',
  };
}

function workout(
  name: string,
  patterns: Array<'squat' | 'hinge' | 'push' | 'pull'>,
  rows: string[],
  overrides: Partial<Workout> = {},
): Workout {
  const lower = patterns.some((pattern) => pattern === 'squat' || pattern === 'hinge');
  const upper = patterns.some((pattern) => pattern === 'push' || pattern === 'pull');
  return {
    id: `workout-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    microcycleId: 'mc-strength-intent',
    dayOfWeek: 1,
    name,
    description: name,
    durationMinutes: 55,
    intensity: 'Moderate',
    workoutType: 'Strength',
    sessionTier: 'core',
    strengthIntent: patterns.length > 0
      ? createStrengthIntent({
          archetype: lower && upper ? 'full_body' : lower ? 'lower' : 'upper',
          primaryPattern: patterns[0],
          plannedPatterns: patterns,
        })
      : undefined,
    exercises: rows.map(exercise),
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function healthyInSeason(weekNumber: number, lowReadiness = false): CoachingInputs {
  return {
    seasonPhase: 'In-season',
    availableDays: 5,
    selectedDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    teamTrainingIntensity: lowReadiness ? 'Moderate' : 'Hard',
    sprintExposure: lowReadiness ? 'No sprint training' : 'Regular sprint training',
    conditioningLevel: lowReadiness ? 'Poor' : 'Good',
    recentTrainingLoad: lowReadiness ? 'Hardly at all' : 'Pretty consistent',
    experienceLevel: '2-5 years',
    injuries: [],
    goals: [],
    hasGame: true,
    gameDay: 'Saturday',
    weekNumber,
  };
}

console.log('strengthIntentContractTests');

console.log('\n[1] Normalisation and legacy ingress');
const ordered = createStrengthIntent({
  archetype: 'lower', primaryPattern: 'squat', plannedPatterns: ['squat', 'hinge'],
});
const reordered = createStrengthIntent({
  archetype: 'lower', primaryPattern: 'squat', plannedPatterns: ['hinge', 'squat', 'hinge'],
});
ok('pattern arrays are deduplicated, deterministically ordered and equality is order-insensitive',
  strengthIntentsEqual(ordered, reordered));
eq('normalisation uses canonical order', reordered.plannedPatterns, ['squat', 'hinge']);
eq('JSON round trip preserves the full contract',
  normalizeStrengthIntent(JSON.parse(JSON.stringify(ordered))), ordered);

const typedWins = resolveLegacyStrengthIntent({
  strengthIntent: ordered,
  strengthPatternContributions: ['push'],
  strengthPattern: 'pull',
  focus: 'Upper pull',
});
eq('existing typed intent cannot be overwritten by legacy/display fields',
  typedWins.intent, ordered);
const ambiguousFullBody = resolveLegacyStrengthIntent({ strengthPattern: 'full_body', name: 'Full Body' });
eq('generic legacy full-body does not invent all four patterns', ambiguousFullBody.intent, null);
ok('ambiguous legacy full-body emits a diagnostic', ambiguousFullBody.diagnostics.length > 0);
eq('legacy full-body derives exact patterns from real main content',
  resolveLegacyStrengthIntent({
    strengthPattern: 'full_body',
    contentPatterns: ['hinge', 'push', 'pull'],
  }).intent?.plannedPatterns,
  ['hinge', 'push', 'pull']);

console.log('\n[2] Allocation and four-microcycle ledgers');
for (let week = 1; week <= 4; week++) {
  const plan = buildCoachingPlan(healthyInSeason(week)).weeklyPlan;
  const ledger = strengthPatternLedger(plan, 'planned');
  ok(`healthy in-season week ${week} owns squat+hinge+push+pull`,
    ledger.squat >= 1 && ledger.hinge >= 1 && ledger.push >= 1 && ledger.pull >= 1,
    ledger);
  const lower = plan.find((session) =>
    session.strengthIntent?.archetype === 'lower' &&
    session.strengthIntent.plannedPatterns.includes('squat') &&
    session.strengthIntent.plannedPatterns.includes('hinge'));
  ok(`healthy in-season week ${week} lower is explicitly combined`, !!lower, plan);
  ok(`healthy in-season week ${week} plan identity does not encode pattern tokens`,
    plan.every((session) => !/:(?:squat|hinge|push|pull)(?:-|:)/.test(session.planEntryId ?? '')),
    plan.map((session) => session.planEntryId));
}

const lowPlan = buildCoachingPlan(healthyInSeason(1, true)).weeklyPlan;
ok('two-core structure carries a typed balanced upper contract', lowPlan.some((session) =>
  session.strengthIntent?.archetype === 'upper' &&
  session.strengthIntent.plannedPatterns.includes('push') &&
  session.strengthIntent.plannedPatterns.includes('pull')),
lowPlan);
ok('normal full-body allocations never gain both lower patterns implicitly',
  [1, 2, 3, 4].every((week) =>
    buildCoachingPlan({ ...healthyInSeason(week, true), availableDays: 3 }).weeklyPlan
      .filter((session) => session.strengthIntent?.archetype === 'full_body')
      .every((session) => !(
        session.strengthIntent!.plannedPatterns.includes('squat') &&
        session.strengthIntent!.plannedPatterns.includes('hinge')
      ))));

const goodInputs = healthyInSeason(1);
const goodPlan = buildCoachingPlan(goodInputs);
const missingSquatPlan = {
  ...goodPlan,
  weeklyPlan: goodPlan.weeklyPlan.map((session) =>
    session.strengthIntent?.archetype === 'lower'
      ? {
          ...session,
          strengthIntent: createStrengthIntent({
            archetype: 'lower', primaryPattern: 'hinge', plannedPatterns: ['hinge'],
          }),
          strengthPatternContributions: ['hinge'] as const,
        }
      : session),
};
ok('weekly H-IS QA fails a healthy week whose lower intent lost squat',
  inseason_3exposurePriority({
    profile: { seasonPhase: 'In-season', injuries: [] } as any,
    inputs: goodInputs,
    plan: missingSquatPlan,
  })?.passed === false);
const hingeOnlyBlockLedger = strengthPatternLedger(
  [1, 2, 3, 4].flatMap(() => missingSquatPlan.weeklyPlan),
  'planned',
);
ok('block ledger exposes four hinge-only weeks with no squat',
  hingeOnlyBlockLedger.hinge >= 4 && hingeOnlyBlockLedger.squat === 0,
  hingeOnlyBlockLedger);

console.log('\n[3] Planned versus effective content and visible identity');
const combined = workout(
  'misleading renamed session',
  ['squat', 'hinge'],
  ['Back Squat', 'Romanian Deadlift', 'Bench Press'],
  { planEntryId: 'w1:monday:strength', strengthPatternContributions: ['hinge', 'squat'] },
);
const canonicalCombined = finaliseWorkoutAfterMutation(combined, { planIntentValid: true });
eq('combined lower preserves both valid main rows and removes unrelated drift',
  canonicalCombined.workout.strengthIntent?.effectivePatterns, ['squat', 'hinge']);
ok('combined lower removes unrelated meaningful push drift',
  !canonicalCombined.workout.exercises.some((row) => row.exercise?.name === 'Bench Press'));
eq('renaming/focus text cannot alter typed pattern ownership',
  resolveSessionDisplayName({
    name: 'Upper Push according to stale copy',
    focus: 'Hinge first, squat second',
    strengthIntent: canonicalCombined.workout.strengthIntent,
  }),
  'Lower Body Strength');

const safetyRemoved = finaliseWorkoutAfterMutation({
  ...canonicalCombined.workout,
  exercises: canonicalCombined.workout.exercises.filter(
    (row) => row.exercise?.name !== 'Back Squat',
  ),
}, {
  planIntentValid: true,
  restoreMissingPlanPatterns: false,
});
eq('safety removal preserves planned intent',
  safetyRemoved.workout.strengthIntent?.plannedPatterns, ['squat', 'hinge']);
eq('safety removal recalculates only surviving effective intent',
  safetyRemoved.workout.strengthIntent?.effectivePatterns, ['hinge']);
eq('visible identity follows effective content after safety removal',
  safetyRemoved.workout.name, 'Lower Hinge');
ok('missing planned pattern records an exact diagnostic',
  safetyRemoved.workout.strengthIntentDiagnostics?.some(
    (entry) => entry.pattern === 'squat' && entry.change === 'removed'));

const fullBody = workout(
  'anything',
  ['squat', 'push', 'pull'],
  ['Back Squat', 'Bench Press', 'Pull-Ups'],
  { planEntryId: 'w1:monday:strength' },
);
const canonicalFullBody = finaliseWorkoutAfterMutation(fullBody, { planIntentValid: true });
eq('full body credits one lower plus push and pull, not all four',
  canonicalFullBody.workout.strengthIntent?.effectivePatterns, ['squat', 'push', 'pull']);
eq('full-body visible identity remains an archetype label', canonicalFullBody.workout.name, 'Full Body Strength');
const scorerIntent = buildIntent(
  'misleading Upper Push name',
  'Strength',
  5,
  ordered,
);
ok('tag-aware fallback composition consumes typed squat+hinge rather than the misleading name',
  scorerIntent.targetMovements.includes('squat') &&
  scorerIntent.targetMovements.includes('hinge') &&
  !scorerIntent.targetMovements.includes('horizontal_push'));

console.log('\n[4] Component-aware fatigue, feedback and adjacency');
const mixedLower = workout('arbitrary mixed', ['squat'], ['Back Squat'], {
  workoutType: 'Mixed',
  hasCombinedConditioning: true,
});
const teamUpper = workout('Team Training + renamed work', ['push'], ['Bench Press'], {
  dayOfWeek: 2,
  workoutType: 'Team Training',
  ...({ isTeamDay: true } as Partial<Workout>),
});
const conditioningOnly = workout('Bike Zone 2', [], [], {
  dayOfWeek: 3,
  workoutType: 'Conditioning',
  conditioningFlavour: 'aerobic',
});
const weekLog = buildWeekLog([
  { date: '2026-04-06', dayOfWeek: 1, short: 'MON', isToday: false, workout: mixedLower, source: 'template', indicator: 'core' },
  { date: '2026-04-07', dayOfWeek: 2, short: 'TUE', isToday: false, workout: teamUpper, source: 'template', indicator: 'core' },
  { date: '2026-04-08', dayOfWeek: 3, short: 'WED', isToday: false, workout: conditioningOnly, source: 'template', indicator: 'conditioning' },
], {}, 'high');
eq('Mixed and Team Training + Strength both contribute strength fatigue',
  weekLog.strengthSessions.map((session) => session.dateStr),
  ['2026-04-06', '2026-04-07']);
ok('conditioning-only does not contribute strength fatigue',
  !weekLog.strengthSessions.some((session) => session.dateStr === '2026-04-08'));

const upperPush = workout('same scalar type', ['push'], ['Bench Press']);
const lowerSquat = workout('same scalar type', ['squat'], ['Back Squat']);
const lowerHinge = workout('same scalar type', ['hinge'], ['Romanian Deadlift']);
const feedback = {
  '2026-04-09': { dateStr: '2026-04-09', completion: 'completed' as const, difficulty: 9 },
  '2026-04-08': { dateStr: '2026-04-08', completion: 'completed' as const, difficulty: 5 },
};
eq('feedback does not match broad Strength scalar across different patterns',
  findMatchingFeedback(lowerSquat, feedback, {
    '2026-04-09': upperPush,
    '2026-04-08': lowerSquat,
  }, '2026-04-10')?.dateStr,
  '2026-04-08');
eq('feedback distinguishes squat from hinge',
  findMatchingFeedback(lowerHinge, feedback, {
    '2026-04-09': upperPush,
    '2026-04-08': lowerSquat,
  }, '2026-04-10'),
  null);

eq('full-body adjacency overlaps both regions instead of becoming neutral',
  classifyGenerationAdjacencyRegion({
    focus: 'renamed',
    tier: 'core',
    isHardExposure: false,
    strengthIntent: createStrengthIntent({
      archetype: 'full_body', primaryPattern: 'hinge', plannedPatterns: ['hinge', 'push', 'pull'],
    }),
  }),
  'full_body');

const g2FullBody = workout('Completely renamed session', ['hinge', 'push', 'pull'], [
  'Romanian Deadlift', 'Bench Press', 'Pull-Ups',
], { dayOfWeek: 4, intensity: 'High' });
const microcycle: Microcycle = {
  id: 'mc-g2-typed',
  programId: 'program-g2-typed',
  weekNumber: 1,
  startDate: '2026-04-06',
  endDate: '2026-04-12',
  miniCycleNumber: 1,
  intensityMultiplier: 1,
  workouts: [g2FullBody],
  createdAt: '',
  updatedAt: '',
};
const program: TrainingProgram = {
  id: 'program-g2-typed',
  userId: 'user',
  name: 'Typed G-2',
  description: '',
  programPhase: 'In-Season',
  startDate: '2026-04-06',
  endDate: '2026-04-12',
  microcycles: [microcycle],
  primaryFocus: 'Strength',
  isActive: true,
  createdAt: '',
  updatedAt: '',
};
const g2Overrides = recomputeWeekOverrides(
  program,
  microcycle,
  '2026-04-11',
  ['2026-04-11'],
);
eq('G-2 moderation detects lower contribution regardless of workout name',
  g2Overrides.dateOverrides['2026-04-09']?.intensity,
  'Moderate');

console.log(`\nstrengthIntentContractTests: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`Failures:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
