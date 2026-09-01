/**
 * R-312 — realistic typed Nordic Curl prescriptions.
 *
 * Reads final generated sessions, then drives a real athlete Add through the
 * durable action door. Pool eligibility by itself is not a delivered dose and
 * a hand-built override is not persistence evidence.
 */
(global as unknown as { __DEV__: boolean }).__DEV__ = false;
const localStorageData = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => localStorageData.get(key) ?? null,
    setItem: (key: string, value: string) => { localStorageData.set(key, value); },
    removeItem: (key: string) => { localStorageData.delete(key); },
    clear: () => { localStorageData.clear(); },
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — Nordic prescription boundary is local');
};
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import { generateProgramLocally } from '../services/api/generateProgram';
import type { OnboardingData, SeasonPhase, TrainingProgram, WorkoutExercise } from '../types/domain';
import { getExerciseTags } from '../data/exerciseTags';
import {
  automaticNordicPrescriptionForIdentity,
  automaticNordicPrescriptionForVariant,
} from '../rules/nordicPrescription';
import { exerciseProgrammingAllows } from '../utils/exerciseFilter';
import { athleteAnswers, ARCHETYPES } from './compilerYear/catalog';
import {
  coldStartThroughOnboarding,
  quiet,
  quietAsync,
  relaunchApp,
} from './support/athleteJourney';
import { deriveVisibleWeekLive } from '../utils/deriveVisibleWeek';
import { legalAddCandidates, legalAddFamilies } from '../utils/addExerciseCandidates';
import { resolveTapSwapEnvironment } from '../utils/tapSwapHierarchy';
import { useProfileStore } from '../store/profileStore';
import { executeProgramControlActionDurably } from '../utils/programControlActions';
import { undoLastDecision } from '../store/undoLastDecision';

let passed = 0;
const failures: string[] = [];
function ok(name: string, value: unknown, detail?: unknown): void {
  if (value) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}`, detail ?? '');
}

const MONDAY = '2026-09-28';
const nordicRows = (program: TrainingProgram | null): WorkoutExercise[] =>
  (program?.microcycles ?? []).flatMap(cycle => cycle.workouts)
    .flatMap(workout => workout.exercises)
    .filter(row => row.exercise?.name === 'Nordic Lower');

function phaseClockAt(phase: SeasonPhase, phaseWeek: number) {
  const entry = new Date(`${MONDAY}T12:00:00`);
  entry.setDate(entry.getDate() - ((phaseWeek - 1) * 7));
  return {
    protocolVersion: 1,
    selectedPhase: phase,
    phaseEntryWeekStartISO: entry.toISOString().slice(0, 10),
    originProvenance: 'explicit_user_phase_change',
    persistenceProvenance: 'preserved_persisted_state',
  } as const;
}

function build(args: {
  gender: 'male' | 'female';
  phase: SeasonPhase;
  phaseWeek: number;
  team?: readonly string[];
  gameDay?: string;
}): TrainingProgram | null {
  const team = [...(args.team ?? [])];
  const previousWarn = console.warn;
  const previousLog = console.log;
  console.warn = () => undefined;
  console.log = () => undefined;
  try {
    return generateProgramLocally({
      firstName: 'NordicWitness',
      gender: args.gender,
      seasonPhase: args.phase,
      trainingDaysPerWeek: 6,
      preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      teamTrainingDaysPerWeek: team.length,
      teamTrainingDays: team,
      trainingLocation: 'Commercial gym',
      equipment: ['Full Gym'],
      equipmentSelectionCompleteness: 'complete',
      experienceLevel: '2-5 years',
      conditioningLevel: 'Average',
      recentTrainingLoad: 'Pretty consistent',
      injuries: [],
      ...(args.gameDay ? { usualGameDay: args.gameDay, gameDay: args.gameDay } : {}),
    } as never, {
      todayISO: MONDAY,
      blockNumber: Math.max(1, Math.ceil(args.phaseWeek / 4)),
      microcycleLimit: 1,
      seasonPhaseClock: phaseClockAt(args.phase, args.phaseWeek),
    } as never);
  } catch {
    return null;
  } finally {
    console.warn = previousWarn;
    console.log = previousLog;
  }
}

function exactDose(row: WorkoutExercise): string {
  return `${row.prescribedSets}x${row.prescribedRepsMin}-${row.prescribedRepsMax}`;
}

async function main(): Promise<void> {
  armTotalsOrRed();
  console.log('\nR-312 — typed realistic Nordic Curl prescriptions\n');

  const tag = getExerciseTags('Nordic Lower');
  const reverseTag = getExerciseTags('Reverse Nordic Curl');
  ok('full hamstring Nordic lowers declare the unassisted eccentric variant in typed data',
    tag?.nordicCurlVariant === 'full_unassisted_eccentric');
  ok('Reverse Nordic Curl remains a separate quad movement, not a name-matched hamstring Nordic',
    reverseTag?.nordicCurlVariant === undefined
      && automaticNordicPrescriptionForIdentity('Reverse Nordic Curl') === null);
  const assisted = automaticNordicPrescriptionForVariant('assisted_or_substantially_regressed');
  ok('an assisted or substantially regressed Nordic owns 2 x 6-8',
    assisted.sets === 2 && assisted.repsMin === 6 && assisted.repsMax === 8,
    assisted);

  const generated = (['male', 'female'] as const).flatMap(gender =>
    (['Off-season', 'Pre-season', 'In-season'] as const).flatMap(phase =>
      [1, 5, 9, 13].map(phaseWeek => ({ gender, phase, phaseWeek,
        program: build({ gender, phase, phaseWeek }) }))));
  const delivered = generated.flatMap(sample => nordicRows(sample.program)
    .map(row => ({ ...sample, row })));
  ok('[non-vacuity] final generated sessions reach automatic Nordics in both sexes and all phases',
    delivered.length > 0
      && (['male', 'female'] as const).every(gender => delivered.some(row => row.gender === gender))
      && (['Off-season', 'Pre-season', 'In-season'] as const)
        .every(phase => delivered.some(row => row.phase === phase)),
    generated.map(sample => [sample.gender, sample.phase, sample.phaseWeek,
      nordicRows(sample.program).map(exactDose)]));
  ok('every delivered full unassisted Nordic is 2 x 4-6',
    delivered.every(({ row }) => exactDose(row) === '2x4-6'),
    [...new Set(delivered.map(({ row }) => exactDose(row)))]);
  ok('no automatic final session contains 2x15 or 3x10 unassisted lowers',
    delivered.every(({ row }) => !(row.prescribedSets === 2 && row.prescribedRepsMax === 15)
      && !(row.prescribedSets === 3 && row.prescribedRepsMax === 10)));

  ok('automatic full Nordics are excluded at G-2, G-1 and game day while manual choice remains legal',
    [2, 1, 0].every(daysToGame =>
      !exerciseProgrammingAllows('Nordic Lower', {
        experienceLevel: '2-5 years', daysToGame, route: 'automatic',
      })
      && exerciseProgrammingAllows('Nordic Lower', {
        experienceLevel: '2-5 years', daysToGame, route: 'manual',
      })));
  const congested = (['male', 'female'] as const).map(gender => ({
    gender,
    program: build({ gender, phase: 'In-season', phaseWeek: 5,
      team: ['Tuesday', 'Thursday'], gameDay: 'Saturday' }),
  }));
  ok('final congested game weeks contain no automatic Nordic prescription above the low-volume band',
    congested.every(sample => nordicRows(sample.program).every(row =>
      row.prescribedSets <= 2 && row.prescribedRepsMax <= 6)),
    congested.map(sample => [sample.gender, nordicRows(sample.program).map(exactDose)]));

  // The athlete's custom dose is deliberately outside the automatic band. If
  // any automatic finaliser touches manual rows, this exact witness changes.
  localStorageData.clear();
  const base = athleteAnswers(ARCHETYPES.find(entry =>
    entry.id === 'male-3-experienced-gym')!) as OnboardingData;
  const profile = {
    ...base,
    seasonPhase: 'Pre-season' as const,
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    usualGameDay: undefined,
    gameDay: undefined,
    recentTrainingLoad: 'Very consistent' as const,
  };
  const install = await coldStartThroughOnboarding({ profile, installDayISO: MONDAY });
  const visible = () => quiet(() => deriveVisibleWeekLive(install.blockOneStart, MONDAY));
  let target: ReturnType<typeof visible>[number] | undefined;
  let candidate: ReturnType<typeof legalAddCandidates>[number] | undefined;
  for (const day of visible()) {
    if (!day.workout || day.workout.exercises.some(row => row.exercise?.name === 'Nordic Lower')) continue;
    const environment = quiet(() => resolveTapSwapEnvironment({
      date: day.date,
      profile: useProfileStore.getState().onboardingData,
      activeConstraints: [],
      readinessSignal: null,
    }));
    const args = {
      environment,
      profile: useProfileStore.getState().onboardingData,
      existingExerciseNames: day.workout.exercises.map(row => row.exercise?.name ?? ''),
    };
    const choices = quiet(() => legalAddFamilies(args)
      .flatMap(family => family.groups.flatMap(group => group.leaves.flatMap(leaf =>
        legalAddCandidates({ ...args, leaf: leaf.id })))));
    const found = choices.find(choice => choice.name === 'Nordic Lower');
    if (found) { target = day; candidate = found; break; }
  }
  ok('[manual non-vacuity] a real safe Add route reaches Nordic Lower',
    Boolean(target && candidate), { target: target?.date, candidate });
  const custom = candidate && target ? { ...candidate, sets: 3, repsMin: 10, repsMax: 10 } : null;
  const add = custom && target
    ? await quietAsync(() => executeProgramControlActionDurably({
        type: 'add_exercise',
        source: { screen: 'session_detail', surface: 'nordic_boundary', initiatedBy: 'tap' },
        scope: 'today_only',
        payload: { date: target!.date, exercise: custom },
        requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true,
      }, { todayISO: MONDAY }))
    : null;
  const manualRow = () => visible().find(day => day.date === target?.date)?.workout?.exercises
    .find(row => row.exercise?.name === 'Nordic Lower');
  ok('the durable Add door preserves the athlete-entered 3x10 instead of applying automatic 2x4-6',
    add?.ok === true && exactDose(manualRow()!) === '3x10-10',
    { add, row: manualRow() });
  const beforeRestart = JSON.stringify(manualRow());
  const restart = await quietAsync(() => relaunchApp({
    storage: localStorageData, todayISO: MONDAY,
  }));
  ok('restart preserves the exact athlete-entered Nordic row',
    restart.ok && JSON.stringify(manualRow()) === beforeRestart,
    { restart, beforeRestart, after: manualRow() });
  const undo = await quietAsync(() => undoLastDecision());
  ok('Undo reverses the athlete Add rather than leaving an automatically redosed Nordic behind',
    undo.outcome === 'undone' && manualRow() === undefined,
    { undo, row: manualRow() });

  const total = passed + failures.length;
  console.log(`\nNordic prescription boundary: passed=${passed}/${total} failures=${failures.length}`);
  totalsPrinted(failures.length);
  if (failures.length > 0) {
    console.error('\nFAILURES:');
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
}

void main().catch(error => {
  console.error(error);
  process.exit(1);
});
