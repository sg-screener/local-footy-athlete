(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — poor sleep flow must stay deterministic');
};

import type { OnboardingData, Workout } from '../types/domain';
import type { ActiveScheduleConstraint } from '../store/coachUpdatesStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { useReadinessStore } from '../store/readinessStore';
import {
  buildPoorSleepReadinessConstraint,
  constraintAppliesToDate,
  isPoorSleepConstraint,
  poorSleepConstraintId,
} from '../utils/readinessConstraints';
import { buildGenerationConstraintContext } from '../utils/generationConstraints';
import {
  buildCoachingPlan,
  onboardingToCoachingInputs,
  type CoachingPlan,
} from '../utils/coachingEngine';
import { executeProgramControlAction } from '../utils/programControlActions';
import { getActiveProgramModifiers } from '../utils/activeProgramModifiers';
import { selectActiveCoachNotes } from '../utils/activeCoachNotes';
import { applyConstraintsToSession, buildFatigueConstraint } from '../utils/exposureEngine';
import { detectRedFlagSymptoms } from '../utils/injuryClarificationGuard';
import { todayISOLocal } from '../utils/appDate';
import { addDays, getMondayForDate } from '../utils/sessionResolver';

const TODAY = todayISOLocal();
const WEEK_END = addDays(getMondayForDate(TODAY), 6);

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) {
    pass += 1;
    console.log(`  ✓ ${name}`);
  } else {
    fail += 1;
    failures.push(name);
    console.log(`  ✗ ${name}${detail === undefined ? '' : `\n      ${JSON.stringify(detail)}`}`);
  }
}

function eq(name: string, actual: unknown, expected: unknown): void {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), { expected, actual });
}

function resetStores(): void {
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null } as never);
  useReadinessStore.setState({ signalsByDate: {} } as never);
}

function action(pattern: 'single_night' | 'repeated') {
  return executeProgramControlAction({
    type: 'set_poor_sleep_status',
    source: { screen: 'test', surface: 'poor_sleep_tests', initiatedBy: 'test' },
    scope: pattern === 'repeated' ? 'current_week' : 'today_only',
    payload: { date: TODAY, todayISO: TODAY, pattern },
    requiresRebuild: false,
    createsActiveModifier: true,
    oneOffOnly: false,
  }, { todayISO: TODAY });
}

const PROFILE: OnboardingData = {
  seasonPhase: 'Pre-season',
  trainingDaysPerWeek: 5,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Friday', 'Saturday'],
  teamTrainingDaysPerWeek: 0,
  teamTrainingDays: [],
  sessionDurationMinutes: 60,
  trainingLocation: 'Commercial gym',
  equipment: ['Barbell', 'Dumbbells', 'Bench', 'Cable machine'],
  experienceLevel: '2-5 years',
  squatStrength: '1.5x bodyweight',
  benchStrength: '1.25x bodyweight',
  conditioningLevel: 'Good',
  sprintExposure: '2+ times per week',
  recentTrainingLoad: 'Very consistent',
  injuries: [],
  motivation: 'Strength, speed, repeat efforts',
};

function planFor(pattern: 'single_night' | 'repeated'): CoachingPlan {
  const constraint = buildPoorSleepReadinessConstraint({
    date: TODAY,
    pattern,
    nowISO: `${TODAY}T08:00:00.000Z`,
  });
  const generationConstraints = buildGenerationConstraintContext({
    activeConstraints: [constraint],
    todayISO: TODAY,
  });
  return buildCoachingPlan(onboardingToCoachingInputs(PROFILE, {
    availabilityDateISO: TODAY,
    generationConstraints,
  }));
}

function planText(plan: CoachingPlan): string {
  return plan.weeklyPlan.map((session) => [
    session.dayOfWeek,
    session.tier,
    session.focus,
    session.strengthPattern,
    session.conditioningCategory,
    session.speedWorkKind,
  ].filter(Boolean).join(' ')).join(' | ');
}

function workout(name: string, workoutType: Workout['workoutType'], exercises: string[] = []): Workout {
  return {
    id: `poor-sleep-${name}`,
    microcycleId: 'poor-sleep-week',
    dayOfWeek: 3,
    name,
    description: name,
    durationMinutes: 60,
    intensity: 'High',
    workoutType,
    sessionTier: 'core',
    exercises: exercises.map((exerciseName, index) => ({
      id: `row-${index}`,
      workoutId: `poor-sleep-${name}`,
      exerciseId: `exercise-${index}`,
      exercise: { name: exerciseName },
      orderIndex: index,
      prescribedSets: 3,
      prescribedRepsMin: 5,
      prescribedRepsMax: 8,
    })) as any,
    createdAt: `${TODAY}T00:00:00.000Z`,
    updatedAt: `${TODAY}T00:00:00.000Z`,
  };
}

console.log('\nPoor sleep readiness flow');

console.log('\n[1] typed scope and expiry');
{
  const oneNight = buildPoorSleepReadinessConstraint({
    date: TODAY,
    pattern: 'single_night',
    nowISO: `${TODAY}T08:00:00.000Z`,
  });
  eq('one bad sleep has deterministic poor_sleep id', oneNight.id, poorSleepConstraintId(TODAY, 'single_night'));
  eq('one bad sleep is typed poor_sleep', oneNight.readinessKind, 'poor_sleep');
  eq('one bad sleep maps to slight severity', oneNight.severity, 3);
  eq('one bad sleep affects today only', oneNight.modifierAffects, ['current_day']);
  eq('one bad sleep has exact date scope', oneNight.appliesToDate, TODAY);
  eq('one bad sleep expires end of day', oneNight.expiresAt, TODAY);
  ok('one bad sleep trims extras first', oneNight.rules.some((rule) => /finisher|extra/i.test(rule)));
  ok('one bad sleep preserves main work', oneNight.safeFocus.some((focus) => /main strength/i.test(focus)));
  ok('one bad sleep no longer applies tomorrow', !constraintAppliesToDate(oneNight, addDays(TODAY, 1)));

  const repeated = buildPoorSleepReadinessConstraint({
    date: TODAY,
    pattern: 'repeated',
    nowISO: `${TODAY}T08:00:00.000Z`,
  });
  eq('repeated sleep maps to moderate severity', repeated.severity, 5);
  eq('repeated sleep affects current week', repeated.modifierAffects, ['current_week']);
  eq('repeated sleep has no day-only scope', repeated.appliesToDate, undefined);
  eq('repeated sleep expires end of week', repeated.expiresAt, WEEK_END);
  ok('repeated sleep avoids sprint and hard conditioning',
    repeated.rules.some((rule) => /hard conditioning.*sprint/i.test(rule)));
  ok('repeated sleep keeps safe strength', repeated.safeFocus.some((focus) => /safe strength/i.test(focus)));
  ok('repeated sleep applies through Sunday', constraintAppliesToDate(repeated, WEEK_END));
  ok('repeated sleep expires after Sunday', !constraintAppliesToDate(repeated, addDays(WEEK_END, 1)));
}

console.log('\n[2] existing readiness tiers drive generation');
{
  const oneNight = buildPoorSleepReadinessConstraint({ date: TODAY, pattern: 'single_night' });
  const repeated = buildPoorSleepReadinessConstraint({ date: TODAY, pattern: 'repeated' });
  const slight = buildGenerationConstraintContext({ activeConstraints: [oneNight], todayISO: TODAY });
  const moderate = buildGenerationConstraintContext({ activeConstraints: [repeated], todayISO: TODAY });

  eq('single night is a slight generation reduction', slight?.readiness?.tier, 'slight_reduction');
  eq('repeated poor sleep is a moderate generation reduction', moderate?.readiness?.tier, 'moderate_reduction');
  ok('single night blocks extra sprint', slight?.readiness?.avoidSprint === true);
  ok('single night blocks hard conditioning', slight?.readiness?.avoidHardConditioning === true);
  ok('single night does not collapse plan to recovery', slight?.readiness?.preferRecovery === false);
  ok('repeated sleep blocks sprint and hard conditioning',
    moderate?.readiness?.avoidSprint === true && moderate?.readiness?.avoidHardConditioning === true);
  ok('repeated sleep still does not become sickness/recovery mode',
    moderate?.readiness?.preferRecovery === false && moderate?.readiness?.fullPause === false);

  eq('single-night generation effect is gone next day',
    buildGenerationConstraintContext({ activeConstraints: [oneNight], todayISO: addDays(TODAY, 1) }),
    undefined);
  eq('repeated generation effect is gone next week',
    buildGenerationConstraintContext({ activeConstraints: [repeated], todayISO: addDays(WEEK_END, 1) }),
    undefined);
}

console.log('\n[3] hard extras reduce while useful work survives');
{
  const oneNight = planFor('single_night');
  const repeated = planFor('repeated');
  const oneNightText = planText(oneNight);
  const repeatedText = planText(repeated);

  ok('one bad sleep generation keeps strength',
    oneNight.weeklyPlan.some((session) => !!session.strengthPattern), oneNightText);
  ok('one bad sleep generation adds no sprint/VO2/glycolytic category',
    oneNight.weeklyPlan.every((session) =>
      !session.conditioningCategory ||
      session.conditioningCategory === 'aerobic_base' ||
      session.conditioningCategory === 'tempo') &&
      !/true_speed/i.test(oneNightText), oneNightText);
  ok('repeated poor sleep generation preserves useful strength/recovery work',
    repeated.weeklyPlan.some((session) => !!session.strengthPattern || session.tier === 'recovery'),
    repeatedText);
  ok('repeated poor sleep generation adds no sprint/VO2/glycolytic category',
    repeated.weeklyPlan.every((session) =>
      !session.conditioningCategory ||
      session.conditioningCategory === 'aerobic_base' ||
      session.conditioningCategory === 'tempo') &&
      !/true_speed/i.test(repeatedText), repeatedText);

  const projected = applyConstraintsToSession(
    workout('Lower plus hard finisher', 'Strength', ['Back Squat', 'Assault Bike Hard Intervals']),
    [buildFatigueConstraint({ id: 'poor-sleep-visible', severity: 3 })],
  );
  ok('main lower work stays in after one bad sleep',
    projected.workout.exercises.some((row: any) => row.exercise?.name === 'Back Squat'));
  ok('hard add-on is reduced before main work',
    projected.workout.coachNotes?.some((note) => /Caution: Assault Bike Hard Intervals/i.test(note)));
}

// Retired synchronous compatibility-store action. Durable atomic replacement
// and exact clear are covered by temporarySourceFactTransactionTests.
if (false) {
console.log('\n[4] tap action, visibility, and isolated clear');
{
  resetStores();
  const unrelated: ActiveScheduleConstraint = {
    id: 'schedule-busy-unrelated',
    type: 'schedule',
    severity: 5,
    status: 'active',
    startDate: TODAY,
    lastUpdatedAt: TODAY,
    source: 'tap',
    reasonLabel: 'Busy week',
    modifierAffects: ['current_week'],
    rules: ['long optional sessions'],
    safeFocus: ['Short useful work'],
    advice: [],
  };
  useCoachUpdatesStore.getState().upsertActiveConstraint(unrelated);
  const applied = action('single_night');
  const sleep = useCoachUpdatesStore.getState().activeConstraints.find(isPoorSleepConstraint);
  ok('tap action succeeds without Coach/LLM', applied.ok && applied.fallbackToCoach === false);
  ok('tap action creates visible typed modifier', !!sleep && sleep.modifierAffects?.length === 1, sleep);
  ok('poor sleep is stored as an active constraint, not hidden readiness state',
    Object.keys(useReadinessStore.getState().signalsByDate).length === 0);

  const hiddenWithoutEffect = selectActiveCoachNotes({
    activeConstraints: sleep ? [sleep] : [],
    todayISO: TODAY,
    visibleWeekDays: [{ date: TODAY, workout: workout('Normal strength', 'Strength', ['Back Squat']) }],
  });
  eq('poor sleep Coach Note is hidden when no visible programming effect exists', hiddenWithoutEffect, []);

  const visibleWithEffect = selectActiveCoachNotes({
    activeConstraints: sleep ? [sleep] : [],
    todayISO: TODAY,
    visibleWeekDays: [{
      date: TODAY,
      workout: {
        ...workout('Adjusted strength', 'Strength', ['Back Squat']),
        coachNotes: ['Caution: hard conditioning reduced; optional finisher trimmed.'],
      },
    }],
  });
  ok('poor sleep Coach Note appears when programming changed',
    visibleWithEffect.some((note) => note.title === 'Poor sleep adjustment active'),
    visibleWithEffect);

  const modifier = getActiveProgramModifiers(TODAY).find((candidate) => candidate.sourceId === sleep?.id);
  const cleared = executeProgramControlAction({
    type: 'clear_active_modifier',
    source: { screen: 'test', surface: 'poor_sleep_tests', initiatedBy: 'test' },
    scope: 'today_only',
    payload: { modifierId: modifier?.id },
    requiresRebuild: false,
    createsActiveModifier: false,
    oneOffOnly: false,
  }, { todayISO: TODAY });
  ok('clearing poor sleep succeeds', cleared.ok);
  ok('clearing removes only poor sleep',
    !useCoachUpdatesStore.getState().activeConstraints.some(isPoorSleepConstraint) &&
      useCoachUpdatesStore.getState().activeConstraints.some((constraint) => constraint.id === unrelated.id));
}

}

console.log('\n[5] anchors and red flags stay higher priority');
{
  const fatigue = buildFatigueConstraint({ id: 'poor-sleep-anchor-check', severity: 5 });
  const game = workout('Practice Match', 'Game');
  const team = workout('Team Training', 'Team Training');
  const projectedGame = applyConstraintsToSession(game, [fatigue]);
  const projectedTeam = applyConstraintsToSession(team, [fatigue]);
  eq('game/practice-match anchor is unchanged', projectedGame.workout, game);
  eq('team training anchor remains present', projectedTeam.workout.workoutType, 'Team Training');
  eq('team training anchor name remains present', projectedTeam.workout.name, 'Team Training');

  const redFlag = detectRedFlagSymptoms("I barely slept and I'm dizzy and faint");
  ok('dizziness/fainting remains a red-flag hard stop',
    redFlag?.advice === 'urgent_medical' && /dizziness\/fainting/.test(redFlag.reason), redFlag);
}

resetStores();
console.log(`\npoorSleepReadinessTests: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log(`Failures:\n  - ${failures.join('\n  - ')}`);
}
process.exit(fail > 0 ? 1 : 0);
