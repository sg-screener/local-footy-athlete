(global as unknown as { __DEV__: boolean }).__DEV__ = true;
process.env.TZ = 'Australia/Melbourne';

const storage = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
    removeItem: (key: string) => { storage.delete(key); },
    clear: () => storage.clear(),
  },
};

import type { OnboardingData, TrainingProgram, Workout } from '../types/domain';
import { generateProgramLocally } from '../services/api/generateProgram';
import {
  PROGRAM_STORE_PERSISTENCE_KEY,
  readDurableProgramStoreEnvelope,
  serializeProgramStoreEnvelope,
  useProgramStore,
} from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import {
  createEmptyReversibleAdjustmentLedger,
  normalizeReversibleAdjustmentLedger,
} from '../rules/reversibleAdjustmentLedger';
import { buildWeekScopedWorkoutOverlay } from '../utils/weekRebuild';
import {
  repeatWeekIntoNextWeek,
  stageRepeatWeekTransaction,
} from '../utils/repeatWeek';
import { clearReversibleAdjustment } from '../store/reversibleAdjustmentTransaction';
import { asyncStorageCompat } from '../store/asyncStorageCompat';
import { rolloverProgramBlock } from '../utils/programBlockRollover';
import {
  clearAthleteActionDiagnosticEvents,
  configureAthleteActionDiagnosticsForTests,
  getAthleteActionTraceV2,
  getAthleteActionTracesV2,
} from '../utils/athleteActionDiagnostics';
import {
  observeRenderedAthleteActionOutcome,
  registerAthleteActionUIOutcome,
} from '../dev/e2e/athleteActionUIObservation';

const SOURCE = '2026-07-06';
const TARGET = '2026-07-13';

let passed = 0;
let failed = 0;
function check(name: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${name}`, detail ?? '');
  }
}

function quiet<T>(body: () => T): T {
  const warn = console.warn;
  const error = console.error;
  console.warn = () => undefined;
  console.error = () => undefined;
  try { return body(); } finally { console.warn = warn; console.error = error; }
}

function profile(): OnboardingData {
  return {
    seasonPhase: 'Off-season',
    position: 'inside_mid',
    motivation: 'Build strength and football fitness',
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    teamTrainingIntensity: 'Hard',
    sessionDurationMinutes: 60,
    trainingLocation: 'Commercial gym',
    equipment: ['Full Gym'],
    equipmentSelectionCompleteness: 'complete',
    experienceLevel: '2-5 years',
    squatStrength: '1.5x bodyweight',
    benchStrength: '1.25x bodyweight',
    conditioningLevel: 'Good',
    sprintExposure: '2+ times per week',
    recentTrainingLoad: 'Very consistent',
    injuries: [],
  };
}

function generate(athlete: OnboardingData): TrainingProgram {
  return quiet(() => generateProgramLocally(athlete, {
    todayISO: SOURCE,
    previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1,
      selectedPhase: athlete.seasonPhase!,
      phaseEntryWeekStartISO: SOURCE,
      originProvenance: 'explicit_user_phase_change',
    },
  }));
}

function seed(options: {
  targetOverlay?: boolean;
  junkOverride?: boolean;
  athlete?: OnboardingData;
} = {}) {
  const athlete = options.athlete ?? profile();
  const program = generate(athlete);
  const target = program.microcycles.find((week) => week.startDate.slice(0, 10) === TARGET)!;
  const overlay = options.targetOverlay
    ? buildWeekScopedWorkoutOverlay({
        program: { ...program, microcycles: [target] },
        weekStart: TARGET,
        anchorDate: null,
        reason: 'one_off_no_game',
      })
    : null;
  const junkDate = '2026-07-07';
  const junkWorkout = program.microcycles[0].workouts[0] as Workout;
  useProfileStore.setState({ onboardingData: athlete, isOnboardingComplete: true });
  useCalendarStore.setState({ markedDays: {}, selectedDate: null });
  useReadinessStore.setState({ signalsByDate: {} });
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null } as never);
  useProgramStore.setState({
    currentProgram: program,
    currentMicrocycle: program.microcycles[0] ?? null,
    todayWorkout: null,
    blockState: null,
    acceptedMaterialContext: {
      markedDays: {}, readinessSignalsByDate: {}, activeConstraints: [], activeInjury: null,
      revision: 1, lastTransaction: 'repeat-week-transaction-test:seed',
    },
    dateOverrides: options.junkOverride ? { [junkDate]: junkWorkout } : {},
    overrideContexts: options.junkOverride ? { [junkDate]: { intent: 'gameProximity' } } : {},
    weekScopedOverlays: overlay ? { [TARGET]: overlay } : {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {},
    sessionFeedback: {},
    weightOverrides: {},
  });
  return { athlete, program, overlay, junkDate, junkWorkout };
}

async function main(): Promise<void> {
  console.log('\n-- Durable Reversible Target-Overlay Transaction --');

  {
    const { athlete } = seed();
    const before = JSON.stringify(useProgramStore.getState().weekScopedOverlays);
    const staged = stageRepeatWeekTransaction({
      snapshot: useProgramStore.getState(),
      baseProfile: athlete,
      sourceWeekDate: SOURCE,
      todayISO: SOURCE,
      expectedAcceptedRevision: 1,
    });
    check('pure staging does not publish live state',
      JSON.stringify(useProgramStore.getState().weekScopedOverlays) === before);
    check('staging owns an exact repeat_week ledger record',
      staged.accepted.program.reversibleAdjustmentLedger.adjustments[0]?.kind === 'repeat_week' &&
      staged.accepted.program.reversibleAdjustmentLedger.adjustments[0]
        ?.restorationTarget.kind === 'week_overlay');
  }

  {
    const anchoredProfile: OnboardingData = {
      ...profile(),
      seasonPhase: 'In-season',
      usualGameDay: 'Saturday',
      teamTrainingDaysPerWeek: 2,
      teamTrainingDays: ['Tuesday', 'Thursday'],
    };
    const { athlete, program } = seed({ athlete: anchoredProfile });
    const target = program.microcycles.find((week) =>
      week.startDate.slice(0, 10) === TARGET)!;
    const targetAnchors = target.workouts.filter((workout) =>
      workout.workoutType === 'Game' || workout.workoutType === 'Team Training');
    const result = await repeatWeekIntoNextWeek({
      baseProfile: athlete,
      sourceWeekDate: SOURCE,
      todayISO: SOURCE,
      expectedAcceptedRevision: 1,
    });
    check('target fixtures and Team Training retain target authority',
      targetAnchors.some((workout) => workout.workoutType === 'Game') &&
      targetAnchors.some((workout) => workout.workoutType === 'Team Training') &&
      targetAnchors.every((workout) => {
        const date = new Date(`${TARGET}T12:00:00`);
        date.setDate(date.getDate() + (workout.dayOfWeek === 0 ? 6 : workout.dayOfWeek - 1));
        const iso = date.toISOString().slice(0, 10);
        return result.overlay.workoutsByDate[iso]?.id === workout.id;
      }));
  }

  {
    const { athlete } = seed();
    let publishes = 0;
    let exactEnvelopeWasDurableAtPublication = false;
    let acknowledgedEnvelope: string | null = null;
    const originalSetItem = asyncStorageCompat.setItem;
    asyncStorageCompat.setItem = async (name, value) => {
      await originalSetItem(name, value);
      if (name === PROGRAM_STORE_PERSISTENCE_KEY) acknowledgedEnvelope = value;
    };
    const stop = useProgramStore.subscribe((state) => {
      publishes += 1;
      exactEnvelopeWasDurableAtPublication =
        acknowledgedEnvelope === serializeProgramStoreEnvelope(state);
    });
    const result = await repeatWeekIntoNextWeek({
      baseProfile: athlete,
      sourceWeekDate: SOURCE,
      todayISO: SOURCE,
      expectedAcceptedRevision: 1,
    }).finally(() => {
      asyncStorageCompat.setItem = originalSetItem;
      stop();
    });
    const durable = await readDurableProgramStoreEnvelope();
    const persisted = durable ? JSON.parse(durable).state : null;
    check('durable readback precedes exactly one live publication',
      publishes === 1 && exactEnvelopeWasDurableAtPublication,
      { publishes, exactEnvelopeWasDurableAtPublication });
    check('the exact staged ledger and overlay are durable',
      persisted?.acceptedMaterialContext?.revision === result.acceptedRevision &&
      persisted?.weekScopedOverlays?.[TARGET]?.id === result.overlay.id &&
      persisted?.reversibleAdjustmentLedger?.adjustments?.some(
        (entry: { id: string }) => entry.id === result.adjustmentId));
  }

  {
    const { athlete } = seed();
    const before = JSON.stringify({
      overlays: useProgramStore.getState().weekScopedOverlays,
      revision: useProgramStore.getState().acceptedMaterialContext.revision,
    });
    const originalSetItem = asyncStorageCompat.setItem;
    asyncStorageCompat.setItem = async (name, value) => {
      if (name === PROGRAM_STORE_PERSISTENCE_KEY) throw new Error('repeat_week_test_write_failed');
      return originalSetItem(name, value);
    };
    let publishes = 0;
    const stop = useProgramStore.subscribe(() => { publishes += 1; });
    let rejected = false;
    try {
      await repeatWeekIntoNextWeek({
        baseProfile: athlete,
        sourceWeekDate: SOURCE,
        todayISO: SOURCE,
        expectedAcceptedRevision: 1,
      });
    } catch {
      rejected = true;
    } finally {
      asyncStorageCompat.setItem = originalSetItem;
      stop();
    }
    check('persistence failure has zero live publication', rejected && publishes === 0, publishes);
    check('persistence failure leaves exact live state', JSON.stringify({
      overlays: useProgramStore.getState().weekScopedOverlays,
      revision: useProgramStore.getState().acceptedMaterialContext.revision,
    }) === before);
  }

  {
    const { athlete } = seed();
    await Promise.resolve();
    const liveBefore = serializeProgramStoreEnvelope(useProgramStore.getState());
    const durableBefore = await readDurableProgramStoreEnvelope();
    let injected = false;
    const stop = useProgramStore.subscribe((state) => {
      if (injected || !state.weekScopedOverlays[TARGET]) return;
      injected = true;
      useProgramStore.setState({ error: 'forced post-publication verification drift' });
    });
    let rejected = false;
    try {
      await repeatWeekIntoNextWeek({
        baseProfile: athlete,
        sourceWeekDate: SOURCE,
        todayISO: SOURCE,
        expectedAcceptedRevision: 1,
      });
    } catch {
      rejected = true;
    } finally {
      stop();
    }
    check('post-publication verification failure restores exact memory and durable envelope',
      rejected &&
      serializeProgramStoreEnvelope(useProgramStore.getState()) === liveBefore &&
      await readDurableProgramStoreEnvelope() === durableBefore);
  }

  {
    const { athlete, overlay: displaced, junkDate, junkWorkout } = seed({
      targetOverlay: true,
      junkOverride: true,
    });
    const displacedFingerprint = JSON.stringify(displaced);
    const result = await repeatWeekIntoNextWeek({
      baseProfile: athlete,
      sourceWeekDate: SOURCE,
      todayISO: SOURCE,
      expectedAcceptedRevision: 1,
    });
    const record = useProgramStore.getState().reversibleAdjustmentLedger.adjustments
      .find((entry) => entry.id === result.adjustmentId)!;
    check('ledger stores exact target overlay before and after',
      JSON.stringify(record.displacedOriginalState.weekOverlay?.before) === displacedFingerprint &&
      record.displacedOriginalState.weekOverlay?.after?.id === result.overlay.id);
    check('ledger stores exact swept override/context rows',
      record.displacedOriginalState.sweptOverrides?.some((entry) =>
        entry.date === junkDate && entry.beforeWorkout?.id === junkWorkout.id &&
        entry.beforeContext?.intent === 'gameProximity') === true);
    check('ledger stores provenance and typed-reduction deltas',
      !!record.displacedOriginalState.provenanceDeltas &&
      !!record.displacedOriginalState.typedReductionDeltas);
    const legacyRecord = JSON.parse(JSON.stringify(record));
    delete legacyRecord.displacedOriginalState.weekOverlay;
    delete legacyRecord.displacedOriginalState.sweptOverrides;
    delete legacyRecord.displacedOriginalState.provenanceDeltas;
    delete legacyRecord.displacedOriginalState.typedReductionDeltas;
    const migrated = normalizeReversibleAdjustmentLedger({
      value: { protocolVersion: 1, adjustments: [legacyRecord] },
    }).adjustments[0];
    check('existing ledger records migrate losslessly with empty new deltas',
      migrated.id === legacyRecord.id &&
      JSON.stringify(migrated.displacedOriginalState.ownedDays) ===
        JSON.stringify(legacyRecord.displacedOriginalState.ownedDays) &&
      migrated.displacedOriginalState.sweptOverrides?.length === 0);
    const restored = await clearReversibleAdjustment(
      result.adjustmentId,
      useProgramStore.getState().acceptedMaterialContext.revision,
    );
    check('restore reinstates the exact displaced overlay',
      (restored.outcome === 'restored' || restored.outcome === 'recomposed') &&
      JSON.stringify(useProgramStore.getState().weekScopedOverlays[TARGET]) === displacedFingerprint);
    const restoredOverlay = useProgramStore.getState().weekScopedOverlays[TARGET];
    check('restore reinstates exact provenance and typed reductions',
      JSON.stringify(Object.values(restoredOverlay?.workoutsByDate ?? {}).flatMap((workout) =>
        workout?.derivedSessionProvenance ?? [])) ===
        JSON.stringify(Object.values(displaced?.workoutsByDate ?? {}).flatMap((workout) =>
          workout?.derivedSessionProvenance ?? [])) &&
      JSON.stringify(restoredOverlay?.exposureContractV2?.authorisedReductions ?? []) ===
        JSON.stringify(displaced?.exposureContractV2?.authorisedReductions ?? []));
    check('restore reinstates the exact swept override and context',
      useProgramStore.getState().dateOverrides[junkDate]?.id === junkWorkout.id &&
      useProgramStore.getState().overrideContexts[junkDate]?.intent === 'gameProximity');
    const again = await clearReversibleAdjustment(
      result.adjustmentId,
      useProgramStore.getState().acceptedMaterialContext.revision,
    );
    check('repeated restore is idempotent', again.outcome === 'already-cleared');
  }

  {
    configureAthleteActionDiagnosticsForTests({
      enabled: true,
      production: false,
      now: () => new Date('2026-07-17T12:00:00.000Z'),
      sink: () => undefined,
    });
    clearAthleteActionDiagnosticEvents();
    const { athlete } = seed();
    const result = await repeatWeekIntoNextWeek({
      baseProfile: athlete,
      sourceWeekDate: SOURCE,
      todayISO: SOURCE,
      expectedAcceptedRevision: 1,
    });
    registerAthleteActionUIOutcome({
      traceId: result.traceId,
      observationId: result.observationId!,
      domainReturn: { targetWeekStart: result.targetWeekStart },
      controlId: 'home-visible-week-after-repeat',
    });
    observeRenderedAthleteActionOutcome({
      traceId: result.traceId!,
      observationId: result.observationId!,
      renderedText: { targetWeekStart: result.targetWeekStart },
      controlId: 'home-visible-week-after-repeat',
      accessibilityNode: { testID: 'repeat-week-active-card' },
    });
    const trace = getAthleteActionTraceV2(result.traceId!);
    check('Repeat Week owns one TraceV2 root',
      getAthleteActionTracesV2().length === 1 &&
      trace?.spans.filter((span) => span.parentSpanId === null).length === 1);
    check('TraceV2 carries the three ordered Repeat Week spans',
      ['repeat_week_stage', 'repeat_week_persist_before_publish', 'repeat_week_publish_and_verify']
        .every((name) => trace?.spans.some((span) => span.name === name)));
    check('trace has actual rendered UI proof and remains unfinished before reload',
      trace?.evidence.uiObservation.status === 'captured' &&
      trace.evidence.uiObservation.value.actualRenderedText.status === 'captured' &&
      trace.status === 'unfinished');
    configureAthleteActionDiagnosticsForTests(null);
  }

  for (const kind of ['session_move', 'session_delete'] as const) {
    const { athlete } = seed();
    const result = await repeatWeekIntoNextWeek({
      baseProfile: athlete,
      sourceWeekDate: SOURCE,
      todayISO: SOURCE,
      expectedAcceptedRevision: 1,
    });
    const repeat = useProgramStore.getState().reversibleAdjustmentLedger.adjustments
      .find((entry) => entry.id === result.adjustmentId)!;
    const newer = {
      ...JSON.parse(JSON.stringify(repeat)),
      id: `later-${kind}`,
      kind,
      createdAt: '2026-07-18T00:00:00.000Z',
      acceptedRevision: repeat.acceptedRevision + 1,
      affectedDates: [TARGET],
      affectedWeeks: [TARGET],
      rollingDependencyWeeks: [TARGET],
      restorationTarget: { kind: 'session', dates: [TARGET], stableIdentities: [`later-${kind}`] },
    };
    useProgramStore.setState({
      reversibleAdjustmentLedger: {
        protocolVersion: 1,
        adjustments: [repeat, newer],
      },
    });
    const restored = await clearReversibleAdjustment(
      repeat.id,
      useProgramStore.getState().acceptedMaterialContext.revision,
    );
    check(`later ${kind} supersedes Repeat Week restoration`,
      restored.outcome === 'superseded' &&
      useProgramStore.getState().weekScopedOverlays[TARGET]?.id === result.overlay.id);
  }

  {
    const { athlete } = seed();
    const result = await repeatWeekIntoNextWeek({
      baseProfile: athlete,
      sourceWeekDate: SOURCE,
      todayISO: SOURCE,
      expectedAcceptedRevision: 1,
    });
    const overlay = cloneObject(useProgramStore.getState().weekScopedOverlays[TARGET]);
    const changedDate = Object.keys(overlay.workoutsByDate).find((date) =>
      !!overlay.workoutsByDate[date])!;
    overlay.workoutsByDate[changedDate] = {
      ...overlay.workoutsByDate[changedDate]!,
      name: 'Unowned drift',
    };
    useProgramStore.setState({
      weekScopedOverlays: {
        ...useProgramStore.getState().weekScopedOverlays,
        [TARGET]: overlay,
      },
    });
    const restored = await clearReversibleAdjustment(
      result.adjustmentId,
      useProgramStore.getState().acceptedMaterialContext.revision,
    );
    check('unowned target-overlay drift conflicts without overwriting it',
      restored.outcome === 'conflicted' &&
      useProgramStore.getState().weekScopedOverlays[TARGET]
        .workoutsByDate[changedDate]?.name === 'Unowned drift');
  }

  {
    const { athlete } = seed();
    const result = await repeatWeekIntoNextWeek({
      baseProfile: athlete,
      sourceWeekDate: SOURCE,
      todayISO: SOURCE,
      expectedAcceptedRevision: 1,
    });
    const repeat = useProgramStore.getState().reversibleAdjustmentLedger.adjustments
      .find((entry) => entry.id === result.adjustmentId)!;
    const unrelated = {
      ...JSON.parse(JSON.stringify(repeat)),
      id: 'later-unrelated-intent',
      kind: 'session_delete',
      createdAt: '2026-07-18T00:00:00.000Z',
      acceptedRevision: repeat.acceptedRevision + 1,
      affectedDates: ['2026-09-01'],
      affectedWeeks: ['2026-08-31'],
      rollingDependencyWeeks: ['2026-08-31'],
      restorationTarget: {
        kind: 'session', dates: ['2026-09-01'], stableIdentities: ['unrelated-session'],
      },
    };
    useProgramStore.setState({
      reversibleAdjustmentLedger: { protocolVersion: 1, adjustments: [repeat, unrelated] },
    });
    const restored = await clearReversibleAdjustment(
      repeat.id,
      useProgramStore.getState().acceptedMaterialContext.revision,
    );
    check('unrelated later intent survives Repeat Week restoration',
      (restored.outcome === 'restored' || restored.outcome === 'recomposed') &&
      useProgramStore.getState().reversibleAdjustmentLedger.adjustments.some((entry) =>
        entry.id === unrelated.id && entry.status === 'active'));
  }

  {
    const { athlete, program } = seed();
    const lastWeek = program.microcycles.at(-1)!.startDate.slice(0, 10);
    const result = await repeatWeekIntoNextWeek({
      baseProfile: athlete,
      sourceWeekDate: lastWeek,
      todayISO: SOURCE,
      expectedAcceptedRevision: 1,
    });
    const rollover = rolloverProgramBlock({
      baseProfile: athlete,
      targetDateISO: result.targetWeekStart,
    });
    check('rollover preserves an active Repeat Week overlay',
      rollover.rolledOver &&
      useProgramStore.getState().weekScopedOverlays[result.targetWeekStart]?.id === result.overlay.id &&
      useProgramStore.getState().reversibleAdjustmentLedger.adjustments.some((entry) =>
        entry.id === result.adjustmentId && entry.status === 'active'));
  }

  console.log(`\nRepeat Week transaction: ${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

void main();

function cloneObject<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
