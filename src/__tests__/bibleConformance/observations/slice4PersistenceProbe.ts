import type { Workout } from '../../../types/domain';
import { finaliseWorkoutAfterMutation } from '../../../utils/workoutCanonicalisation';
import {
  canonicalWeekLedger,
  pathExercise,
  pathMicrocycle,
  pathPowerBlock,
  pathProgram,
  pathWorkout,
  PATH_PROFILE,
} from './buildCanonicalPathLedger';

const RESULT_MARKER = 'BIBLE_SLICE4_PERSISTENCE_RESULT ';

function modernWorkouts(): Workout[] {
  const lowerId = 'persist-modern-lower';
  const lower = pathWorkout({
    id: lowerId, dayOfWeek: 1, name: 'Stale Upper Label',
    patterns: ['squat', 'hinge'], primary: 'squat', workoutType: 'Conditioning',
    exercises: [
      pathExercise(lowerId, 0, 'Back Squat', { weight: 100, reps: 5 }),
      pathExercise(lowerId, 1, 'Romanian Deadlift', { weight: 90, reps: 6 }),
      pathExercise(lowerId, 2, 'Pallof Press', { reps: 10 }),
    ],
    conditioning: [{ title: 'Bike Zone 2 25min', modality: 'bike' }],
    powerBlock: pathPowerBlock('primer'), recoveryAddon: 'Calf and adductor reset',
  });
  const teamId = 'persist-modern-team';
  const team = pathWorkout({
    id: teamId, dayOfWeek: 2, name: 'Team Training + Upper Pull',
    patterns: ['pull'], primary: 'pull', workoutType: 'Team Training', team: true,
    exercises: [pathExercise(teamId, 0, 'Pull-Ups'), pathExercise(teamId, 1, 'Chest Supported Row')],
  });
  const canonicalLower = finaliseWorkoutAfterMutation(lower, {
    phase: 'In-season', planIntentValid: true, referenceWorkout: lower,
  }).workout;
  const standaloneId = 'persist-modern-standalone-tempo';
  const warmup = pathExercise(standaloneId, 0, 'SkiErg warm-up');
  const work = pathExercise(standaloneId, 1, 'Tempo Intervals 5 x 2min SkiErg');
  const cooldown = pathExercise(standaloneId, 2, 'SkiErg cool-down');
  const standalone = finaliseWorkoutAfterMutation({
    ...pathWorkout({
      id: standaloneId,
      dayOfWeek: 3,
      name: 'Bike/Row/Ski Tempo Intervals',
      exercises: [warmup, work, cooldown],
      workoutType: 'Strength',
    }),
    conditioningCategory: 'tempo',
    conditioningFlavour: 'tempo',
  }, {
    phase: 'Off-season', offseasonSubphase: 'mid_offseason', planIntentValid: true,
  }).workout;
  return [
    {
      ...canonicalLower,
      name: 'Stale Upper Label', workoutType: 'Strength',
      ...({ strengthPattern: 'push', focus: 'Upper Push' } as any),
    },
    finaliseWorkoutAfterMutation(team, { phase: 'In-season', planIntentValid: true, referenceWorkout: team }).workout,
    standalone,
  ];
}

function legacyWorkouts(): Workout[] {
  const id = 'persist-legacy-lower';
  const workout = pathWorkout({
    id, dayOfWeek: 1, name: 'Upper Push From Old Copy',
    patterns: ['squat', 'hinge'], primary: 'squat', workoutType: 'Strength',
    exercises: [
      pathExercise(id, 0, 'Back Squat', { weight: 100 }),
      pathExercise(id, 1, 'Romanian Deadlift', { weight: 90 }),
    ],
    conditioning: [{ title: 'Bike Zone 2 25min', modality: 'bike' }],
  });
  return [{
    ...workout,
    strengthIntent: undefined,
    // Explicit old contribution ownership must beat the misleading name/type.
    strengthPatternContributions: ['squat', 'hinge'],
    workoutType: 'Strength',
    ...({ strengthPattern: 'lower', focus: 'Upper Push' } as any),
  }];
}

async function run(scenarioId: string) {
  const asyncModule = require('@react-native-async-storage/async-storage');
  const storage = asyncModule.default ?? asyncModule;
  const memory = new Map<string, string>();
  storage.getItem = async (key: string) => memory.get(key) ?? null;
  storage.setItem = async (key: string, value: string) => { memory.set(key, value); };
  storage.removeItem = async (key: string) => { memory.delete(key); };
  storage.clear = async () => { memory.clear(); };

  const legacy = scenarioId === 'legacy-program-rehydrate';
  const workouts = legacy ? legacyWorkouts() : modernWorkouts();
  const program = pathProgram(workouts);
  const microcycle = pathMicrocycle(workouts);
  const envelope = {
    state: {
      currentProgram: program, currentMicrocycle: microcycle, todayWorkout: workouts[0],
      isGenerating: false, isLoading: false, error: null, blockState: null,
      dateOverrides: {}, overrideContexts: {}, weekScopedOverlays: {},
      sessionFeedback: {}, weightOverrides: {},
    },
    version: 0,
  };
  await storage.setItem('program-store', JSON.stringify(envelope));

  // Import only after the in-memory native storage shim and real persisted
  // Zustand envelope are installed.
  const { useProgramStore } = require('../../../store/programStore');
  let mergeRuns = 0;
  const unsubscribe = useProgramStore.persist.onFinishHydration(() => { mergeRuns++; });
  await useProgramStore.persist.rehydrate();
  const hydratedWorkouts = useProgramStore.getState().currentProgram?.microcycles?.[0]?.workouts ?? [];
  const first = canonicalWeekLedger(hydratedWorkouts);
  await useProgramStore.persist.rehydrate();
  const hydratedTwiceWorkouts = useProgramStore.getState().currentProgram?.microcycles?.[0]?.workouts ?? [];
  const twice = canonicalWeekLedger(hydratedTwiceWorkouts);

  const result: any = {
    stored: canonicalWeekLedger(workouts), hydrated: first, hydratedTwice: twice,
    persistence: { key: 'program-store', version: 0, mergeRuns, legacy },
  };

  if (scenarioId === 'post-rehydrate-edit-rebuild') {
    const addBike = (source: Workout) => {
      const bike = pathExercise(source.id, source.exercises.length, 'Bike Zone 2 25min');
      return finaliseWorkoutAfterMutation({
        ...source,
        exercises: [...source.exercises, bike],
        conditioningCategory: 'aerobic_base', conditioningFlavour: 'aerobic',
        conditioningBlock: {
          intent: 'aerobic', attachedKind: 'component',
          options: [{ title: 'Bike Zone 2 25min', description: 'Bike Zone 2 25min', exerciseIds: [bike.id], ...({ modality: 'bike' } as any) }],
        },
        hasCombinedConditioning: true, attachedConditioningKind: 'component',
      }, { phase: 'In-season', planIntentValid: true, referenceWorkout: source }).workout;
    };
    result.liveEdit = canonicalWeekLedger([addBike(modernWorkouts()[0])]);
    result.rehydratedEdit = canonicalWeekLedger([addBike(hydratedTwiceWorkouts[0])]);

    const { rebuildLocalWeek } = require('../../../utils/weekRebuild');
    rebuildLocalWeek({ baseProfile: PATH_PROFILE, todayISO: '2026-03-23', scope: 'block' });
    const rebuildOnce = useProgramStore.getState().currentProgram?.microcycles?.[0]?.workouts ?? [];
    result.liveRebuild = canonicalWeekLedger(rebuildOnce);
    rebuildLocalWeek({ baseProfile: PATH_PROFILE, todayISO: '2026-03-23', scope: 'block' });
    const rebuildTwice = useProgramStore.getState().currentProgram?.microcycles?.[0]?.workouts ?? [];
    result.rehydratedRebuild = canonicalWeekLedger(rebuildTwice);
  }
  unsubscribe();
  return result;
}

if (require.main === module) {
  run(process.argv[2]).then((result) => {
    process.stdout.write(`${RESULT_MARKER}${JSON.stringify(result)}\n`);
  }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exit(1);
  });
}
