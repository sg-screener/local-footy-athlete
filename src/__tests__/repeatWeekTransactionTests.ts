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
import { rebaseAcceptedEffectiveWeek } from '../rules/acceptedEffectiveWeek';
import { normalizeAcceptedMaterialContext } from '../store/acceptedStateColdStart';
import {
  createTemporaryEquipmentFact,
  createTemporaryPoorSleepFact,
  createTemporaryScheduleFact,
  temporaryFactScope,
} from '../rules/temporarySourceFact';
import { migrateLegacyInjuryEpisodes } from '../rules/injuryEpisode';
import type { InjuryState } from '../utils/injuryProgression';
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
  const junkWorkout = (program.microcycles[0].workouts.find((workout) =>
    workout.dayOfWeek === 2) ?? program.microcycles[0].workouts[0]) as Workout;
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
  await useProgramStore.persist.rehydrate();
  console.log('\n-- Durable Reversible Target-Overlay Transaction --');

  {
    const { athlete } = seed();
    const before = serializeProgramStoreEnvelope(useProgramStore.getState());
    const staged = stageRepeatWeekTransaction({
      snapshot: useProgramStore.getState(),
      baseProfile: athlete,
      sourceWeekDate: SOURCE,
      todayISO: SOURCE,
      expectedAcceptedRevision: 1,
    });
    check('pure staging does not publish live state',
      serializeProgramStoreEnvelope(useProgramStore.getState()) === before);
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
    const targetAnchors = rebaseAcceptedEffectiveWeek({
      surfaces: useProgramStore.getState(),
      weekStart: TARGET,
      profile: athlete,
      markedDays: useProgramStore.getState().acceptedMaterialContext.markedDays,
    }).visibleWorkouts.filter((workout) =>
      workout.workoutType === 'Game' || workout.workoutType === 'Team Training');
    const result = await repeatWeekIntoNextWeek({
      baseProfile: athlete,
      sourceWeekDate: SOURCE,
      todayISO: SOURCE,
      expectedAcceptedRevision: 1,
    });
    const visibleTarget = rebaseAcceptedEffectiveWeek({
      surfaces: useProgramStore.getState(),
      weekStart: TARGET,
      profile: athlete,
      markedDays: useProgramStore.getState().acceptedMaterialContext.markedDays,
    }).visibleWorkouts;
    check('target fixtures and Team Training retain one canonical owner',
      targetAnchors.some((workout) => workout.workoutType === 'Game') &&
      targetAnchors.some((workout) => workout.workoutType === 'Team Training') &&
      targetAnchors.every((workout) => {
        const date = new Date(`${TARGET}T12:00:00`);
        date.setDate(date.getDate() + (workout.dayOfWeek === 0 ? 6 : workout.dayOfWeek - 1));
        const iso = date.toISOString().slice(0, 10);
        return !Object.prototype.hasOwnProperty.call(result.overlay.workoutsByDate, iso) &&
          visibleTarget.filter((candidate) =>
            candidate.dayOfWeek === workout.dayOfWeek &&
            candidate.workoutType === workout.workoutType).length === 1;
      }), {
        targetAnchors: targetAnchors.map((workout) => ({
          id: workout.id,
          dayOfWeek: workout.dayOfWeek,
          workoutType: workout.workoutType,
        })),
        overlay: Object.entries(result.overlay.workoutsByDate).map(([date, workout]) => ({
          date,
          id: workout?.id,
          workoutType: workout?.workoutType,
        })),
        visible: visibleTarget.map((workout) => ({
          id: workout.id,
          dayOfWeek: workout.dayOfWeek,
          workoutType: workout.workoutType,
        })),
      });
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
    await Promise.resolve();
    const durableBefore = await readDurableProgramStoreEnvelope();
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
    }) === before && await readDurableProgramStoreEnvelope() === durableBefore);
  }

  {
    const { athlete } = seed();
    await Promise.resolve();
    const durableBefore = await readDurableProgramStoreEnvelope();
    const originalGetItem = asyncStorageCompat.getItem;
    let programReads = 0;
    asyncStorageCompat.getItem = async (name) => {
      const value = await originalGetItem(name);
      if (name === PROGRAM_STORE_PERSISTENCE_KEY && ++programReads === 2 && value) {
        return `${value} `;
      }
      return value;
    };
    let publishes = 0;
    const stop = useProgramStore.subscribe((state) => {
      if (state.weekScopedOverlays[TARGET]?.reason === 'repeat_week') publishes += 1;
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
      asyncStorageCompat.getItem = originalGetItem;
      stop();
    }
    check('acknowledged readback mismatch publishes nothing and restores durable state',
      rejected && publishes === 0 &&
      !useProgramStore.getState().weekScopedOverlays[TARGET] &&
      await readDurableProgramStoreEnvelope() === durableBefore);
  }

  {
    const { athlete } = seed();
    await Promise.resolve();
    const durableBefore = await readDurableProgramStoreEnvelope();
    const originalGetItem = asyncStorageCompat.getItem;
    let injected = false;
    asyncStorageCompat.getItem = async (name) => {
      const value = await originalGetItem(name);
      if (name === PROGRAM_STORE_PERSISTENCE_KEY && !injected) {
        injected = true;
        const context = useProgramStore.getState().acceptedMaterialContext;
        useProgramStore.setState({
          acceptedMaterialContext: {
            ...context,
            revision: context.revision + 1,
            lastTransaction: 'repeat-week-test:concurrent-intent',
          },
        });
      }
      return value;
    };
    let repeatPublications = 0;
    const stop = useProgramStore.subscribe((state) => {
      if (state.weekScopedOverlays[TARGET]?.reason === 'repeat_week') repeatPublications += 1;
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
      asyncStorageCompat.getItem = originalGetItem;
      stop();
    }
    check('revision drift publishes no Repeat Week state and preserves newer intent',
      rejected && repeatPublications === 0 &&
      !useProgramStore.getState().weekScopedOverlays[TARGET] &&
      useProgramStore.getState().acceptedMaterialContext.lastTransaction ===
        'repeat-week-test:concurrent-intent' &&
      await readDurableProgramStoreEnvelope() === durableBefore);
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
      JSON.stringify(useProgramStore.getState().weekScopedOverlays[TARGET]) === displacedFingerprint,
      restored);
    const restoredOverlay = useProgramStore.getState().weekScopedOverlays[TARGET];
    check('restore reinstates exact provenance and typed reductions',
      JSON.stringify(Object.values(restoredOverlay?.workoutsByDate ?? {}).flatMap((workout) =>
        workout?.derivedSessionProvenance ?? [])) ===
        JSON.stringify(Object.values(displaced?.workoutsByDate ?? {}).flatMap((workout) =>
          workout?.derivedSessionProvenance ?? [])) &&
      JSON.stringify(restoredOverlay?.exposureContractV2?.authorisedReductions ?? []) ===
        JSON.stringify(displaced?.exposureContractV2?.authorisedReductions ?? []),
      restored);
    check('restore reinstates the exact swept override and context',
      useProgramStore.getState().dateOverrides[junkDate]?.id === junkWorkout.id &&
      useProgramStore.getState().overrideContexts[junkDate]?.intent === 'gameProximity',
      restored);
    const again = await clearReversibleAdjustment(
      result.adjustmentId,
      useProgramStore.getState().acceptedMaterialContext.revision,
    );
    check('repeated restore is idempotent', again.outcome === 'already-cleared', again);
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

  for (const kind of ['session_delete', 'game_fixture_move'] as const) {
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
    const futureDate = '2026-09-01';
    const futureScope = temporaryFactScope({ kind: 'date', date: futureDate });
    const equipment = createTemporaryEquipmentFact({
      observedDate: futureDate,
      scope: futureScope,
      mode: 'only',
      equipmentTags: ['bodyweight', 'dumbbells'],
      sourceSurface: 'test',
      now: '2026-07-18T00:00:00.000Z',
    });
    const schedule = createTemporaryScheduleFact({
      observedDate: futureDate,
      scope: futureScope,
      scheduleKind: 'travel',
      unavailableDates: [futureDate],
      sourceSurface: 'test',
      now: '2026-07-18T00:00:00.000Z',
    });
    const readinessFact = createTemporaryPoorSleepFact({
      observedDate: futureDate,
      scope: futureScope,
      pattern: 'single_night',
      sourceSurface: 'test',
      now: '2026-07-18T00:00:00.000Z',
    });
    const injury: InjuryState = {
      bodyPart: 'calf',
      bucket: 'calf',
      severity: 4,
      initialSeverity: 4,
      status: 'active',
      rules: ['Avoid painful calf loading'],
      safeFocus: ['Pain-free upper body work'],
      advice: [],
      startDate: `${futureDate}T00:00:00.000Z`,
      lastUpdatedAt: `${futureDate}T00:00:00.000Z`,
      createdAt: `${futureDate}T00:00:00.000Z`,
      history: [],
    };
    const injuryEpisodes = migrateLegacyInjuryEpisodes({
      activeConstraints: [],
      activeInjury: injury,
      sourceSurface: 'repeat_week_restoration_test',
    });
    const currentContext = useProgramStore.getState().acceptedMaterialContext;
    const laterContext = normalizeAcceptedMaterialContext({
      ...currentContext,
      readinessSignalsByDate: {
        ...currentContext.readinessSignalsByDate,
        [futureDate]: {
          date: futureDate,
          energy: 'low',
          flatToday: true,
          source: 'quick_check',
          updatedAt: '2026-07-18T00:00:00.000Z',
          temporarySourceFactIds: [readinessFact.factId],
        },
      },
      activeInjury: injury,
      injuryEpisodes,
      temporarySourceFacts: [readinessFact, equipment, schedule, ...injuryEpisodes],
      revision: currentContext.revision + 1,
      lastTransaction: 'repeat-week-test:later-facts',
    });
    useProgramStore.setState({ acceptedMaterialContext: laterContext });
    const laterFactsFingerprint = JSON.stringify({
      readiness: laterContext.readinessSignalsByDate,
      injury: laterContext.injuryEpisodes,
      equipment: laterContext.temporarySourceFacts.filter((fact) =>
        'factKind' in fact && fact.factKind === 'equipment'),
      schedule: laterContext.temporarySourceFacts.filter((fact) =>
        'factKind' in fact && fact.factKind === 'schedule'),
    });
    const restored = await clearReversibleAdjustment(
      result.adjustmentId,
      useProgramStore.getState().acceptedMaterialContext.revision,
    );
    const restoredContext = useProgramStore.getState().acceptedMaterialContext;
    check('later readiness, injury, equipment and schedule facts survive restoration',
      (restored.outcome === 'restored' || restored.outcome === 'recomposed') &&
      JSON.stringify({
        readiness: restoredContext.readinessSignalsByDate,
        injury: restoredContext.injuryEpisodes,
        equipment: restoredContext.temporarySourceFacts.filter((fact) =>
          'factKind' in fact && fact.factKind === 'equipment'),
        schedule: restoredContext.temporarySourceFacts.filter((fact) =>
          'factKind' in fact && fact.factKind === 'schedule'),
      }) === laterFactsFingerprint,
      restored);
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
