/**
 * Permanent P0 mutation-truth invariants.
 * Run: sucrase-node src/__tests__/coachSemanticMutationTruthTests.ts
 */
import type { Workout } from '../types/domain';

const memory = new Map<string, string>();
(globalThis as any).window = (globalThis as any).window ?? {
  localStorage: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value); },
    removeItem: (key: string) => { memory.delete(key); },
  },
};

const AsyncStorage = require('@react-native-async-storage/async-storage').default;
const {
  asyncStorageDurable,
} = require('../store/asyncStorageCompat') as typeof import('../store/asyncStorageCompat');
const {
  useProgramStore,
  readDurableProgramStoreEnvelope,
  PROGRAM_STORE_PERSISTENCE_KEY,
} = require('../store/programStore') as typeof import('../store/programStore');
const {
  runCoachMutationTransaction,
  acceptedStateFingerprint,
  completeAcceptedStateFingerprint,
} = require('../store/coachMutationTransaction') as typeof import('../store/coachMutationTransaction');
const {
  useCoachMutationHistoryStore,
} = require('../store/coachMutationHistoryStore') as typeof import('../store/coachMutationHistoryStore');
const {
  useCoachPreferencesStore,
} = require('../store/coachPreferencesStore') as typeof import('../store/coachPreferencesStore');
const {
  buildSemanticProgramSnapshot,
  diffSemanticPrograms,
  firstSemanticDoseChange,
  semanticDiffHasMaterialReductionForLever,
  semanticDiffChangesLever,
  semanticFingerprint,
} = require('../utils/programSemanticSnapshot') as typeof import('../utils/programSemanticSnapshot');
const {
  extractVisibleProgramItemsFromWorkout,
} = require('../utils/visibleProgramReadModel') as typeof import('../utils/visibleProgramReadModel');

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    pass++;
    console.log(`  PASS ${name}`);
  } else {
    fail++;
    failures.push(`${name}${detail === undefined ? '' : `: ${JSON.stringify(detail)}`}`);
    console.log(`  FAIL ${name}`);
  }
}

function workout(args: {
  id?: string;
  sets?: number;
  intensity?: Workout['intensity'];
  duration?: number;
  itemDuration?: number;
  title?: string;
  exerciseId?: string;
} = {}): Workout {
  const id = args.id ?? 'semantic-workout';
  const exerciseId = args.exerciseId ?? 'assault-bike';
  const itemDuration = args.itemDuration ?? 30;
  return {
    id,
    microcycleId: 'semantic-week',
    dayOfWeek: 1,
    name: args.title ?? 'Assault Bike Sprints',
    description: 'Exact semantic test workout',
    durationMinutes: args.duration ?? itemDuration,
    intensity: args.intensity ?? 'Hard',
    workoutType: 'Conditioning',
    conditioningFlavour: 'high-intensity',
    conditioningCategory: 'glycolytic',
    conditioningBlock: {
      intent: 'high-intensity',
      options: [{
        title: args.title ?? 'Assault Bike Sprints',
        description: `${itemDuration}min assault bike`,
        exerciseIds: [exerciseId],
        durationMinutes: itemDuration,
      }],
    },
    exercises: [{
      id: exerciseId,
      workoutId: id,
      exerciseId,
      exerciseOrder: 0,
      prescribedSets: args.sets ?? 4,
      prescribedRepsMin: itemDuration,
      prescribedRepsMax: itemDuration,
      prescriptionType: 'duration_minutes',
      restSeconds: 60,
      exercise: {
        id: exerciseId,
        name: 'Assault Bike',
        description: 'Assault bike',
        muscleGroups: ['Full Body'],
        exerciseType: 'Cardio',
        equipmentRequired: ['Assault Bike'],
        difficultyLevel: 'Intermediate',
        createdAt: '',
        updatedAt: '',
      },
      createdAt: '',
      updatedAt: '',
    }],
    createdAt: '',
    updatedAt: '',
  };
}

function day(date: string, value: Workout | null): any {
  return {
    date,
    dayOfWeek: 1,
    short: 'MON',
    isToday: false,
    workout: value,
    source: value ? 'manual' : 'rest',
    indicator: value ? 'conditioning' : 'rest',
  };
}

function diff(before: Workout, after: Workout) {
  return diffSemanticPrograms(
    buildSemanticProgramSnapshot([day('2026-07-20', before)]),
    buildSemanticProgramSnapshot([day('2026-07-20', after)]),
  );
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

async function main(): Promise<void> {
  await useProgramStore.persist.rehydrate();

  console.log('\n[1] strict strength/set reduction truth');
  for (const [from, to, accepted] of [
    [4, 2, true],
    [3, 2, true],
    [2, 1, true],
    [1, 1, false],
  ] as const) {
    const result = diff(workout({ sets: from }), workout({ sets: to }));
    check(
      `${from} -> ${to} ${accepted ? 'is' : 'is not'} a material set reduction`,
      semanticDiffHasMaterialReductionForLever(result, 'sets') === accepted,
      result.changes,
    );
  }

  console.log('\n[2] presentation-only lighter cannot prove programming change');
  const titleOnly = diff(
    workout({ title: 'Hard Assault Bike Sprints' }),
    workout({ title: 'Light Assault Bike Sprints' }),
  );
  check('title-only diff is observable', titleOnly.hasSemanticChange);
  check('title-only diff is not programming', !titleOnly.hasProgrammingChange, titleOnly.changes);
  check('title-only diff is not a reduction', !titleOnly.hasMaterialDoseReduction);

  console.log('\n[3] intensity-only and duration-only exactness');
  const intensityOnly = diff(
    workout({ intensity: 'Hard', duration: 30, itemDuration: 30 }),
    workout({ intensity: 'Light', duration: 30, itemDuration: 30 }),
  );
  check('intensity changes', semanticDiffChangesLever(intensityOnly, 'intensity'));
  check('duration remains unchanged', !semanticDiffChangesLever(intensityOnly, 'duration'));
  check('identity remains unchanged', !semanticDiffChangesLever(intensityOnly, 'identity'));

  const durationOnly = diff(
    workout({ duration: 30, itemDuration: 30 }),
    workout({ duration: 20, itemDuration: 20 }),
  );
  check('item/session duration changes', semanticDiffChangesLever(durationOnly, 'duration'));
  check('intensity remains unchanged', !semanticDiffChangesLever(durationOnly, 'intensity'));
  check(
    'weekly conditioning minutes agree with 20min accepted dose',
    durationOnly.after.weeklyExposure[0].conditioningMinutes === 20,
    durationOnly.after.weeklyExposure[0],
  );
  const acceptedDuration = durationOnly.after.days[0].workout!;
  check('session duration is 20', acceptedDuration.durationMinutes === 20);
  check(
    'detail item duration is 20',
    acceptedDuration.exercises[0].itemDurationMinutes === 20,
  );
  const durationCardItem = extractVisibleProgramItemsFromWorkout(
    workout({ duration: 20, itemDuration: 20 }),
  )[0];
  check(
    'weekly card copy and typed duration agree at 20min',
    durationCardItem?.durationMinutes === 20 && /20/.test(durationCardItem?.doseLabel ?? ''),
    durationCardItem,
  );
  check(
    'equipment metadata is fingerprinted',
    acceptedDuration.exercises[0].equipment[0] === 'Assault Bike',
  );

  console.log('\n[4] forced post-apply verifier failures restore exact accepted state');
  const date = '2026-07-20';
  const base = workout({ id: 'rollback-base' });
  useProgramStore.setState({
    currentProgram: null,
    currentMicrocycle: null,
    todayWorkout: null,
    dateOverrides: { [date]: base },
    overrideContexts: {},
    weekScopedOverlays: {},
    userRemovalConstraints: [],
    exposureContractsByWeek: {},
  });
  await Promise.resolve();
  const destination = '2026-07-21';
  const rollbackScenarios = [
    ['exercise replacement', () => {
      const state = useProgramStore.getState();
      const candidate = clone(state.dateOverrides[date]);
      candidate.exercises[0].exerciseId = 'replacement-candidate';
      candidate.exercises[0].exercise!.id = 'replacement-candidate';
      useProgramStore.setState({ dateOverrides: { ...state.dateOverrides, [date]: candidate } });
    }],
    ['move', () => {
      const state = useProgramStore.getState();
      const overrides = { ...state.dateOverrides, [destination]: clone(state.dateOverrides[date]) };
      delete overrides[date];
      useProgramStore.setState({ dateOverrides: overrides });
    }],
    ['revision', () => {
      const state = useProgramStore.getState();
      const candidate = clone(state.dateOverrides[date]);
      candidate.exercises[0].prescribedSets = 2;
      useProgramStore.setState({ dateOverrides: { ...state.dateOverrides, [date]: candidate } });
    }],
    ['conditioning edit', () => {
      const state = useProgramStore.getState();
      useProgramStore.setState({
        dateOverrides: {
          ...state.dateOverrides,
          [date]: workout({ id: 'conditioning-edit-candidate', duration: 24, itemDuration: 24 }),
        },
      });
    }],
    ['duration edit', () => {
      const state = useProgramStore.getState();
      const candidate = clone(state.dateOverrides[date]);
      candidate.durationMinutes = 18;
      candidate.conditioningBlock!.options[0].durationMinutes = 18;
      candidate.exercises[0].prescribedRepsMin = 18;
      candidate.exercises[0].prescribedRepsMax = 18;
      useProgramStore.setState({ dateOverrides: { ...state.dateOverrides, [date]: candidate } });
    }],
    ['strength edit', () => {
      const state = useProgramStore.getState();
      const candidate = clone(state.dateOverrides[date]);
      candidate.workoutType = 'Strength';
      candidate.conditioningBlock = undefined;
      candidate.exercises[0].prescribedSets = 1;
      useProgramStore.setState({ dateOverrides: { ...state.dateOverrides, [date]: candidate } });
    }],
    ['session addition', () => {
      const state = useProgramStore.getState();
      useProgramStore.setState({
        dateOverrides: {
          ...state.dateOverrides,
          [destination]: workout({ id: 'added-session' }),
        },
      });
    }],
    ['session removal', () => {
      const state = useProgramStore.getState();
      const overrides = { ...state.dateOverrides };
      delete overrides[date];
      useProgramStore.setState({ dateOverrides: overrides });
    }],
  ] as const;
  for (const [operation, mutate] of rollbackScenarios) {
    const before = completeAcceptedStateFingerprint();
    const result = await runCoachMutationTransaction({
      todayISO: date,
      extraDates: [date, destination],
      mutate: () => {
        mutate();
        return { applied: true };
      },
      didApply: (value) => value.applied,
      verifyAfterPersistence: () => ({ ok: false, reason: `forced_${operation}` }),
    });
    check(`${operation} fails closed`, result.ok === false && result.rollbackVerified);
    check(`${operation} exact accepted rollback`, completeAcceptedStateFingerprint() === before);
  }

  const beforeUnexpected = completeAcceptedStateFingerprint();
  const unexpected = await runCoachMutationTransaction({
    todayISO: date,
    extraDates: [date],
    mutate: () => {
      const state = useProgramStore.getState();
      useProgramStore.setState({
        dateOverrides: {
          ...state.dateOverrides,
          [date]: workout({ id: 'unexpected-exception-candidate', duration: 17, itemDuration: 17 }),
        },
      });
      useCoachMutationHistoryStore.setState({
        entries: [{ id: 'unexpected-stale-history' } as any,
          ...useCoachMutationHistoryStore.getState().entries],
      });
      useCoachPreferencesStore.setState({
        modalityPreferences: {
          ...useCoachPreferencesStore.getState().modalityPreferences,
          'unexpected-stale-preference': {
            from: 'row',
            to: 'bike',
            createdAt: 1,
          },
        },
      });
      return { applied: true };
    },
    didApply: (value) => value.applied,
    verifyAfterPersistence: () => { throw new Error('unexpected_exception_after_commit'); },
  });
  check('unexpected post-commit exception fails closed', unexpected.ok === false && unexpected.rollbackVerified);
  check('unexpected exception exact accepted rollback', completeAcceptedStateFingerprint() === beforeUnexpected);

  console.log('\n[5] persistence rejection and fresh reload truth');
  const preRejectState = acceptedStateFingerprint();
  const preRejectEnvelope = await readDurableProgramStoreEnvelope();
  const originalSetItem = AsyncStorage.setItem.bind(AsyncStorage);
  let rejectOnce = true;
  AsyncStorage.setItem = async (key: string, value: string) => {
    if (key === PROGRAM_STORE_PERSISTENCE_KEY && rejectOnce) {
      rejectOnce = false;
      throw new Error('injected_program_persistence_rejection');
    }
    return originalSetItem(key, value);
  };
  const rejected = await runCoachMutationTransaction({
    todayISO: date,
    extraDates: [date],
    mutate: () => {
      const state = useProgramStore.getState();
      useProgramStore.setState({
        dateOverrides: {
          ...state.dateOverrides,
          [date]: workout({ id: 'rejected-candidate', duration: 18, itemDuration: 18 }),
        },
      });
      return { applied: true };
    },
    didApply: (value) => value.applied,
  });
  AsyncStorage.setItem = originalSetItem;
  check('rejected persistence returns no accepted success', rejected.ok === false);
  check('rejected persistence restores exact in-memory state', acceptedStateFingerprint() === preRejectState);
  check(
    'fresh reload envelope equals pre-command state',
    (await readDurableProgramStoreEnvelope()) === preRejectEnvelope,
  );

  console.log('\n[5b] compatibility-mirror persistence rejection also fails closed');
  const preMirrorRejectState = completeAcceptedStateFingerprint();
  const preMirrorProgramEnvelope = await readDurableProgramStoreEnvelope();
  const preCalendarEnvelope = await asyncStorageDurable.getItem('calendar-storage');
  let rejectMirrorOnce = true;
  AsyncStorage.setItem = async (key: string, value: string) => {
    if (key === 'calendar-storage' && rejectMirrorOnce) {
      rejectMirrorOnce = false;
      throw new Error('injected_calendar_mirror_persistence_rejection');
    }
    return originalSetItem(key, value);
  };
  const mirrorRejected = await runCoachMutationTransaction({
    todayISO: date,
    extraDates: [date],
    mutate: () => {
      const state = useProgramStore.getState();
      useProgramStore.setState({
        dateOverrides: {
          ...state.dateOverrides,
          [date]: workout({ id: 'mirror-rejected-candidate', duration: 19, itemDuration: 19 }),
        },
      });
      return { applied: true };
    },
    didApply: (value) => value.applied,
  });
  AsyncStorage.setItem = originalSetItem;
  check('mirror persistence rejection returns no success', mirrorRejected.ok === false);
  check('mirror rejection restores every accepted surface',
    completeAcceptedStateFingerprint() === preMirrorRejectState);
  check('mirror rejection restores program reload envelope',
    (await readDurableProgramStoreEnvelope()) === preMirrorProgramEnvelope);
  check('mirror rejection restores compatibility reload envelope',
    (await asyncStorageDurable.getItem('calendar-storage')) === preCalendarEnvelope);

  console.log('\n[6] success is durable before return');
  const committed = await runCoachMutationTransaction({
    todayISO: date,
    extraDates: [date],
    mutate: () => {
      const state = useProgramStore.getState();
      const candidate = workout({ id: 'durable-candidate', duration: 22, itemDuration: 22 });
      candidate.coachNotes = ['Duration updated to 22 min'];
      useProgramStore.setState({
        dateOverrides: {
          ...state.dateOverrides,
          [date]: candidate,
        },
      });
      return { applied: true };
    },
    didApply: (value) => value.applied,
  });
  check('transaction succeeds', committed.ok === true, committed);
  const durableEnvelope = await readDurableProgramStoreEnvelope();
  check(
    'returned envelope was already acknowledged',
    committed.ok && durableEnvelope === committed.persistedEnvelope,
  );
  const freshState = durableEnvelope ? JSON.parse(durableEnvelope).state : null;
  check(
    'fresh persisted state equals committed accepted state',
    !!freshState && semanticFingerprint(freshState.dateOverrides) ===
      semanticFingerprint(useProgramStore.getState().dateOverrides),
  );
  if (committed.ok) {
    const dose = firstSemanticDoseChange(committed.diff);
    const accepted = useProgramStore.getState().dateOverrides[date];
    const card = extractVisibleProgramItemsFromWorkout(accepted)[0];
    const semantic = committed.diff.after.days.find((entry) => entry.date === date)?.workout;
    check(
      'success fact, card, detail and Coach Note agree with committed diff',
      dose?.after === 22 &&
        card?.durationMinutes === 22 &&
        /22/.test(card?.doseLabel ?? '') &&
        accepted.exercises[0].prescribedRepsMax === 22 &&
        semantic?.presentation.coachNotes.includes('Duration updated to 22 min') === true,
      { dose, card, detail: accepted.exercises[0], notes: semantic?.presentation.coachNotes },
    );
  }

  console.log(`\ncoachSemanticMutationTruthTests: ${pass} passed, ${fail} failed`);
  if (fail > 0) {
    console.error(failures.join('\n'));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
