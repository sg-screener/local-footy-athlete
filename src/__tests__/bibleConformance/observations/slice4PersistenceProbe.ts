import type { Workout } from '../../../types/domain';

type AsyncStorageShim = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
  clear: () => Promise<void>;
};

type ProbeDependencies = {
  buildSection18WeeklyExposureContractV2:
    typeof import('../../../rules/weeklyExposureContractV2').buildSection18WeeklyExposureContractV2;
  finaliseWorkoutAfterMutation:
    typeof import('../../../utils/workoutCanonicalisation').finaliseWorkoutAfterMutation;
  canonicalWeekLedger:
    typeof import('./buildCanonicalPathLedger').canonicalWeekLedger;
  pathExercise: typeof import('./buildCanonicalPathLedger').pathExercise;
  pathMicrocycle: typeof import('./buildCanonicalPathLedger').pathMicrocycle;
  pathPowerRow: typeof import('./buildCanonicalPathLedger').pathPowerRow;
  pathProgram: typeof import('./buildCanonicalPathLedger').pathProgram;
  pathWorkout: typeof import('./buildCanonicalPathLedger').pathWorkout;
  PATH_PROFILE: typeof import('./buildCanonicalPathLedger').PATH_PROFILE;
};

const RESULT_MARKER = 'BIBLE_SLICE4_PERSISTENCE_RESULT ';

function installDeterministicStorageShim(): AsyncStorageShim {
  const asyncModule = require('@react-native-async-storage/async-storage');
  const storage = (asyncModule.default ?? asyncModule) as AsyncStorageShim;
  const memory = new Map<string, string>();
  storage.getItem = async (key: string) => memory.get(key) ?? null;
  storage.setItem = async (key: string, value: string) => { memory.set(key, value); };
  storage.removeItem = async (key: string) => { memory.delete(key); };
  storage.clear = async () => { memory.clear(); };
  return storage;
}

function loadProbeDependencies(): ProbeDependencies {
  const exposure = require('../../../rules/weeklyExposureContractV2') as
    typeof import('../../../rules/weeklyExposureContractV2');
  const canonicalisation = require('../../../utils/workoutCanonicalisation') as
    typeof import('../../../utils/workoutCanonicalisation');
  const ledger = require('./buildCanonicalPathLedger') as
    typeof import('./buildCanonicalPathLedger');
  return {
    buildSection18WeeklyExposureContractV2: exposure.buildSection18WeeklyExposureContractV2,
    finaliseWorkoutAfterMutation: canonicalisation.finaliseWorkoutAfterMutation,
    canonicalWeekLedger: ledger.canonicalWeekLedger,
    pathExercise: ledger.pathExercise,
    pathMicrocycle: ledger.pathMicrocycle,
    pathPowerRow: ledger.pathPowerRow,
    pathProgram: ledger.pathProgram,
    pathWorkout: ledger.pathWorkout,
    PATH_PROFILE: ledger.PATH_PROFILE,
  };
}

function modernWorkouts(dependencies: ProbeDependencies): Workout[] {
  const {
    finaliseWorkoutAfterMutation, pathExercise, pathPowerRow, pathWorkout,
  } = dependencies;
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
    powerRow: pathPowerRow('primer'), recoveryAddon: 'Calf and adductor reset',
  });
  const teamId = 'persist-modern-team';
  const team = pathWorkout({
    id: teamId, dayOfWeek: 2, name: 'Team Training',
    workoutType: 'Team Training', team: true,
  });
  const canonicalLower = finaliseWorkoutAfterMutation(lower, {
    offseasonSubphase: 'not_off_season',
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
  const upperId = 'persist-modern-z-upper';
  const upper = finaliseWorkoutAfterMutation({
    ...pathWorkout({
      id: upperId, dayOfWeek: 4, name: 'Upper Strength + Tempo',
      patterns: ['push', 'pull'], primary: 'push',
      exercises: [
        pathExercise(upperId, 0, 'Bench Press'),
        pathExercise(upperId, 1, 'Chest Supported Row'),
      ],
      conditioning: [{ title: 'Row Tempo 5 x 3min', modality: 'row', intent: 'tempo' }],
    }),
    speedBlock: {
      id: `${upperId}:speed`, title: 'Acceleration Exposure', label: 'Acceleration',
      kind: 'true_speed', placement: 'pre_lift', durationMinutes: 10,
      prescription: '4–6 × 10–20 m controlled accelerations, full recovery',
      counting: {
        hardExposure: true, mainStrength: false, conditioningCredit: 'none',
        createsHardDay: true, sprintCodExposure: true,
      },
    },
  }, { offseasonSubphase: 'not_off_season', phase: 'In-season', planIntentValid: true }).workout;
  const fullId = 'persist-modern-z-full';
  const full = finaliseWorkoutAfterMutation(pathWorkout({
    id: fullId, dayOfWeek: 5, name: 'Full Body Strength',
    patterns: ['squat', 'hinge', 'push', 'pull'], primary: 'hinge',
    exercises: [
      pathExercise(fullId, 0, 'Front Squat'),
      pathExercise(fullId, 1, 'Romanian Deadlift'),
      pathExercise(fullId, 2, 'Incline Dumbbell Press'),
      pathExercise(fullId, 3, 'Pull-Ups'),
    ],
  }), { offseasonSubphase: 'not_off_season', phase: 'In-season', planIntentValid: true }).workout;
  return [
    {
      ...canonicalLower,
      name: 'Stale Upper Label', workoutType: 'Strength',
      ...({ strengthPattern: 'push', focus: 'Upper Push' } as any),
    },
    finaliseWorkoutAfterMutation(team, { offseasonSubphase: 'not_off_season', phase: 'In-season', planIntentValid: true, referenceWorkout: team }).workout,
    standalone,
    upper,
    full,
  ];
}

function legacyWorkouts(dependencies: ProbeDependencies): Workout[] {
  const { finaliseWorkoutAfterMutation, pathExercise, pathWorkout } = dependencies;
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
  const legacyLower: Workout = {
    ...workout,
    strengthIntent: undefined,
    // Explicit old contribution ownership must beat the misleading name/type.
    strengthPatternContributions: ['squat', 'hinge'],
    workoutType: 'Strength',
    ...({ strengthPattern: 'lower', focus: 'Upper Push' } as any),
  };
  const upperId = 'persist-legacy-z-upper';
  const upper = finaliseWorkoutAfterMutation(pathWorkout({
    id: upperId, dayOfWeek: 2, name: 'Upper Strength + Tempo',
    patterns: ['push', 'pull'], primary: 'push',
    exercises: [
      pathExercise(upperId, 0, 'Bench Press'),
      pathExercise(upperId, 1, 'Chest Supported Row'),
    ],
    conditioning: [{ title: 'Row Tempo 5 x 3min', modality: 'row', intent: 'tempo' }],
  }), { offseasonSubphase: 'not_off_season', phase: 'In-season', planIntentValid: true }).workout;
  const fullId = 'persist-legacy-z-full';
  const full = finaliseWorkoutAfterMutation({
    ...pathWorkout({
      id: fullId, dayOfWeek: 3, name: 'Full Body Strength + Tempo',
      patterns: ['squat', 'hinge', 'push', 'pull'], primary: 'hinge',
      exercises: [
        pathExercise(fullId, 0, 'Front Squat'),
        pathExercise(fullId, 1, 'Romanian Deadlift'),
        pathExercise(fullId, 2, 'Incline Dumbbell Press'),
        pathExercise(fullId, 3, 'Pull-Ups'),
      ],
      conditioning: [{ title: 'Bike Tempo 4 x 4min', modality: 'bike', intent: 'tempo' }],
    }),
    speedBlock: {
      id: `${fullId}:speed`, title: 'Acceleration Exposure', label: 'Acceleration',
      kind: 'true_speed', placement: 'pre_lift', durationMinutes: 10,
      prescription: '4–6 × 10–20 m controlled accelerations, full recovery',
      counting: {
        hardExposure: true, mainStrength: false, conditioningCredit: 'none',
        createsHardDay: true, sprintCodExposure: true,
      },
    },
  }, { offseasonSubphase: 'not_off_season', phase: 'In-season', planIntentValid: true }).workout;
  const conditioningId = 'persist-legacy-z-conditioning';
  const conditioning = finaliseWorkoutAfterMutation(pathWorkout({
    id: conditioningId, dayOfWeek: 4, name: 'Tempo Conditioning',
    conditioning: [{ title: 'SkiErg Tempo 6 x 2min', modality: 'ski', intent: 'tempo' }],
  }), { offseasonSubphase: 'not_off_season', phase: 'In-season', planIntentValid: true }).workout;
  return [legacyLower, upper, full, conditioning];
}

function modernContract(dependencies: ProbeDependencies) {
  const { buildSection18WeeklyExposureContractV2 } = dependencies;
  return buildSection18WeeklyExposureContractV2({
    seasonPhase: 'In-season', declaredSubphase: 'bye_build',
    mode: 'in_season_bye_build', weekKind: 'build', anchorState: 'bye',
    teamTrainingDays: [2], capacity: 'medium',
    participationProvenance: 'legacy_unknown',
    currentProductionClaimsAnchorCredit: false,
    plannerSelected: {
      mainStrength: 3, coreConditioning: 3, sprintHighSpeed: 1,
      powerPrimers: 1,
    },
    prohibitedPatternProvenance: 'legacy_missing',
  });
}

async function run(scenarioId: string) {
  const storage = installDeterministicStorageShim();
  await storage.clear();

  const programStorePath = require.resolve('../../../store/programStore');
  if (require.cache[programStorePath]) {
    throw new Error('ProgramStore initialized before the deterministic Slice 4 storage shim');
  }

  // These deferred runtime imports can transitively initialize ProgramStore.
  // Keep them after the AsyncStorage shim and use a fresh child process per probe.
  const dependencies = loadProbeDependencies();
  const {
    canonicalWeekLedger, finaliseWorkoutAfterMutation, pathExercise, pathMicrocycle,
    pathProgram, PATH_PROFILE,
  } = dependencies;
  const { useProgramStore } = require('../../../store/programStore') as
    typeof import('../../../store/programStore');

  // Quiesce the automatic empty hydration triggered by module initialization
  // before installing this probe's persisted envelope.
  await useProgramStore.persist.rehydrate();
  if (useProgramStore.getState().currentProgram !== null) {
    throw new Error('Slice 4 probe did not start from an empty ProgramStore');
  }

  const legacy = scenarioId === 'legacy-program-rehydrate';
  const workouts = legacy ? legacyWorkouts(dependencies) : modernWorkouts(dependencies);
  const contract = legacy ? undefined : modernContract(dependencies);
  const baseProgram = pathProgram(workouts);
  const program = {
    ...baseProgram,
    microcycles: baseProgram.microcycles.map((entry) => ({
      ...entry,
      exposureContractV2: contract,
    })),
  };
  const microcycle = { ...pathMicrocycle(workouts), exposureContractV2: contract };
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

  // R1.3 (shell rebuild, ruling docs/SHELL_REBUILD_RULING_2026-08-05.md):
  // rehydration restores NO outputs — an old-shape envelope parks for the R2
  // migration and the world derives from inputs. The Bible-anchored
  // semantics these scenarios hold (typed intent wins, one-shot legacy
  // migration, scalar non-authority, merge idempotence) are properties of
  // the CANONICALISER — exactly what the R2 migration reads an old envelope
  // through — so the scenarios exercise it directly now, and additionally
  // pin the new boot law.
  let mergeRuns = 0;
  const unsubscribe = useProgramStore.persist.onFinishHydration(() => { mergeRuns++; });
  await useProgramStore.persist.rehydrate();
  if (useProgramStore.getState().currentProgram !== null) {
    throw new Error('R1.3 boot law broken: an old envelope resurrected outputs through rehydrate');
  }
  // RE-POINTED (2026-08-14), and it is the SAME CODE, not a lighter one.
  // `canonicaliseHydratedState` was deleted with the legacy structural
  // migration. On the `accepted_canonical` ingress — the only classification a
  // program can now arrive under, because nothing reads a stored program back
  // at all (`partialize` persists inputs only) — that function's ENTIRE body
  // was these two calls, in this order, and then an early return. So the probe
  // observes exactly what it observed before, with the unreachable branch gone.
  const { dropRetiredWeekOverlaysAtHydration } =
    require('../../../store/programHydrationIngress') as
      typeof import('../../../store/programHydrationIngress');
  const { projectHydratedStateDerivedFields } =
    require('../../../store/programHydrationProjection') as
      typeof import('../../../store/programHydrationProjection');
  const canonicaliseAtReadBoundary = (state: Record<string, unknown>) =>
    projectHydratedStateDerivedFields(
      dropRetiredWeekOverlaysAtHydration(state as never) as Record<string, unknown>,
    ) as { currentProgram?: { microcycles?: { workouts?: Workout[] }[] } };
  void legacy;
  const canonicalOnce = canonicaliseAtReadBoundary(envelope.state as never);
  const hydratedWorkouts =
    (canonicalOnce.currentProgram?.microcycles?.[0]?.workouts ?? []) as Workout[];
  const first = canonicalWeekLedger(hydratedWorkouts);
  await useProgramStore.persist.rehydrate();
  // The first pass canonicalises; its output IS canonical, which is what the
  // old second rehydrate reclassified it as. Idempotence means pass two
  // changes nothing.
  const canonicalTwice = canonicaliseAtReadBoundary(canonicalOnce as never);
  const hydratedTwiceWorkouts =
    (canonicalTwice.currentProgram?.microcycles?.[0]?.workouts ?? []) as Workout[];
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
      }, { offseasonSubphase: 'not_off_season', phase: 'In-season', planIntentValid: true, referenceWorkout: source }).workout;
    };
    result.liveEdit = canonicalWeekLedger([addBike(modernWorkouts(dependencies)[0])]);
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
  await storage.clear();
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
