/**
 * G+1 ACROSS THE WEEK BOUNDARY — the dependent week's repair honors the
 * fixture law directly.
 *
 * Bible: G+1 is rest or recovery only, and a Sunday fixture protects the
 * FOLLOWING Monday. Launch audit 2026-08-25/26, measured on glass twice: an
 * athlete moved their game to Sunday and the following Monday kept its full
 * CORE strength session.
 *
 * WHY, precisely: read-time game proximity (`applyGameProximity`) was deleted
 * in the 2026-08-19 demolition — correctly, reads must not author — but
 * `fixtureMinimalReplan.displacedStrengthTemplates` inferred displacement FROM
 * THE PROJECTION ("for example Monday strength after a one-off Sunday game",
 * its own founding comment), so the deletion orphaned its trigger: the
 * projection no longer hides that Monday, so the replan never saw it as
 * displaced, so nothing relocated it. The fix computes the G+1 collision from
 * the FIXTURE LAW in `fixtureNeutralSource`, date-exact against the real
 * fixture set (this week's + the adjacent weeks' via
 * `availability.adjacentFixtureDates` + any caller-supplied
 * `activeFixtureDates`), and the existing displacement/relocation machinery
 * takes over from there.
 *
 * Run: npm run test:g-plus1-dependent-week
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
const memory = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value); },
    removeItem: (key: string) => { memory.delete(key); },
    clear: () => { memory.clear(); },
  },
};
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
armTotalsOrRed();
import type { OnboardingData, Workout } from '../types/domain';
import { generateProgramLocally } from '../services/api/generateProgram';
import { buildFixtureMinimalReplan } from '../utils/fixtureMinimalReplan';
import {
  resolveProfileTargetWeekAvailability,
  targetWeekFixtures,
} from '../rules/fixtureConditionedAvailability';
import { ownSeasonPhaseForGeneration } from '../rules/seasonPhaseOwner';
import { composeAcceptedEffectiveWeekSurfaces } from '../utils/liveEvaluationSurfaces';

const WEEK = '2026-08-31';           // Monday
const PREVIOUS_SUNDAY = '2026-08-30'; // the moved game, one day before WEEK

let passes = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

function run(name: string, body: () => void): void {
  try {
    body();
    passes += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`  FAIL ${name}: ${(error as Error).message}`);
  }
}

function quiet<T>(body: () => T): T {
  const warn = console.warn;
  const error = console.error;
  const log = console.log;
  console.warn = () => undefined;
  console.error = () => undefined;
  console.log = () => undefined;
  try {
    return body();
  } finally {
    console.warn = warn;
    console.error = error;
    console.log = log;
  }
}

function profile(): OnboardingData {
  return {
    seasonPhase: 'In-season',
    gender: 'male',
    position: 'inside_mid',
    motivation: 'Build strength and football fitness',
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    teamTrainingDuration: '60-90 minutes',
    trainingLocation: 'Commercial gym',
    equipment: ['Full Gym'],
    equipmentSelectionCompleteness: 'complete',
    experienceLevel: 'Advanced',
    squatStrength: '1.5x bodyweight',
    benchStrength: '1.25x bodyweight',
    conditioningLevel: 'Good',
    sprintExposure: '2+ times per week',
    recentTrainingLoad: 'Very consistent',
    injuries: [],
    usualGameDay: 'Saturday',
    gameDay: 'Saturday',
  } as unknown as OnboardingData;
}

function hasMainStrength(workout: Workout): boolean {
  return (workout.strengthIntent?.effectivePatterns?.length ?? 0) > 0;
}

function replanWeek(markedDays: Record<string, 'game'>): {
  workouts: Workout[];
  status: string;
} {
  const athlete = profile();
  const program = quiet(() => generateProgramLocally(athlete, {
    todayISO: WEEK,
    previousProgram: null,
    activeConstraints: [],
    seasonPhaseClock: {
      protocolVersion: 1,
      selectedPhase: 'In-season',
      phaseEntryWeekStartISO: WEEK,
      originProvenance: 'explicit_user_phase_change',
    },
    microcycleLimit: 1,
  } as never));
  const microcycle = program.microcycles[0];
  assert(microcycle, 'generation produced no microcycle');
  const ownedPhase = ownSeasonPhaseForGeneration(athlete);
  const availability = resolveProfileTargetWeekAvailability({
    profile: athlete,
    weekStart: WEEK,
    markedDays,
    ownedPhase,
  });
  const fixtures = targetWeekFixtures({
    profile: athlete,
    weekStart: WEEK,
    markedDays,
    ownedPhase,
  });
  const result = quiet(() => buildFixtureMinimalReplan({
    profile: athlete,
    weekStart: WEEK,
    sourceWorkouts: microcycle.workouts,
    targetMicrocycle: microcycle,
    availability,
    proposedMarkedDays: markedDays,
    priorFixtures: fixtures,
    proposedFixtures: fixtures,
    surfaces: composeAcceptedEffectiveWeekSurfaces({
      currentProgram: program,
      currentMicrocycle: microcycle,
      dateOverrides: {},
      weekScopedOverlays: {},
      removalDecisions: [],
    }),
    mutationIntent: 'remove_from_date',
  } as never));
  return { workouts: result.workouts, status: result.gateway.status };
}

// [1] LIVENESS ARM: with no adjacent fixture, Monday legitimately holds its
//     strength session — cell 2's force comes from the mark alone.
run('control: without an adjacent game, Monday keeps its strength session', () => {
  const { workouts } = replanWeek({});
  const monday = workouts.filter((workout) =>
    workout.dayOfWeek === 1 && hasMainStrength(workout));
  assert(monday.length > 0,
    'the control week has no Monday strength — the forcing shape is gone and cell 2 proves nothing');
});

// [2] THE LAW: with the real game one day before the week, Monday carries no
//     main-strength session. This is the audit's exact journey (game moved to
//     Sunday, next Monday still said "lift heavy").
run('a game the previous Sunday displaces Monday strength (G+1)', () => {
  const { workouts, status } = replanWeek({ [PREVIOUS_SUNDAY]: 'game' });
  const monday = workouts.filter((workout) =>
    workout.dayOfWeek === 1 && hasMainStrength(workout));
  assert(monday.length === 0,
    `Monday after a Sunday game still carries main strength: `
    + monday.map((workout) => workout.name).join(', '));
  assert(status === 'accepted',
    `the replanned week did not gate accepted: ${status}`);
});

// [3] THE SQUEEZE IS LEGAL AND DISCLOSED, NOT AN ERROR. This week is
//     sandwiched — a game the previous Sunday AND its own Saturday game — so
//     every candidate landing day is Team Training, G-1 or the game itself,
//     and relocation is genuinely impossible. The Bible's answer is the
//     reduced week ("next week is never mortgaged"), which must publish as
//     accepted with the surviving strength day intact — never a refusal, and
//     never a quiet loss of the day that IS legal.
run('the sandwiched week publishes accepted with its legal strength day intact', () => {
  const { workouts, status } = replanWeek({ [PREVIOUS_SUNDAY]: 'game' });
  assert(status === 'accepted', `the squeezed week did not gate accepted: ${status}`);
  const strengthDays = [...new Set(workouts
    .filter((workout) => hasMainStrength(workout))
    .map((workout) => workout.dayOfWeek))];
  assert(strengthDays.length >= 1,
    'the squeeze deleted every strength day — the legal one must survive');
  assert(!strengthDays.includes(1),
    `Monday is among the surviving strength days: ${strengthDays.join(',')}`);
});

console.log(`\n${passes} passed, ${failures.length} failed`);
totalsPrinted(failures.length);
if (failures.length > 0) process.exit(1);
process.exit(0);
