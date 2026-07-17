/**
 * Permanent invariants for the canonical Coach InjuryEpisodeCommand boundary.
 * Run: npm run test:injury-episode-commands
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
const memory = new Map<string, string>();
(globalThis as any).window = {
  localStorage: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value); },
    removeItem: (key: string) => { memory.delete(key); },
    clear: () => { memory.clear(); },
  },
};

import type { Workout } from '../types/domain';
import type { ActiveInjuryConstraint } from '../store/coachUpdatesStore';
import type {
  InjuryEpisodeCommand,
  InjuryEpisodeCommandResult,
} from '../store/injuryEpisodeCommand';

const {
  createEmptyAcceptedMaterialContext,
  normalizeAcceptedMaterialContext,
} = require('../store/acceptedStateColdStart') as typeof import('../store/acceptedStateColdStart');
const {
  createEmptyReversibleAdjustmentLedger,
} = require('../rules/reversibleAdjustmentLedger') as typeof import('../rules/reversibleAdjustmentLedger');
const {
  useProgramStore,
  readDurableProgramStoreEnvelope,
  PROGRAM_STORE_PERSISTENCE_KEY,
} = require('../store/programStore') as typeof import('../store/programStore');
const {
  useCoachUpdatesStore,
} = require('../store/coachUpdatesStore') as typeof import('../store/coachUpdatesStore');
const {
  asyncStorageDurable,
  asyncStorageCompat,
} = require('../store/asyncStorageCompat') as typeof import('../store/asyncStorageCompat');
const {
  executeInjuryEpisodeCommand,
} = require('../store/injuryEpisodeCommand') as typeof import('../store/injuryEpisodeCommand');
const {
  acceptedStateFingerprint,
} = require('../store/coachMutationTransaction') as typeof import('../store/coachMutationTransaction');
const {
  buildDayWorkoutProjectedDay,
} = require('../utils/visibleProgramReadModel') as typeof import('../utils/visibleProgramReadModel');
const {
  buildScheduleStateImperative,
} = require('../utils/coachWeekDiff') as typeof import('../utils/coachWeekDiff');
const {
  semanticFingerprint,
} = require('../utils/programSemanticSnapshot') as typeof import('../utils/programSemanticSnapshot');
const {
  buildInjuryPolicy,
} = require('../utils/programAdjustmentEngine') as typeof import('../utils/programAdjustmentEngine');
const {
  executeProgramControlActionDurably,
} = require('../utils/programControlActions') as typeof import('../utils/programControlActions');
const {
  beginAthleteActionTrace,
  clearAthleteActionDiagnosticEvents,
  configureAthleteActionDiagnosticsForTests,
  getAthleteActionTraceV2,
  getAthleteActionTracesV2,
} = require('../utils/athleteActionDiagnostics') as typeof import('../utils/athleteActionDiagnostics');

const TODAY = '2026-07-20';
let passed = 0;
const failures: string[] = [];

function check(name: string, condition: unknown, detail?: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  failures.push(`${name}${detail === undefined ? '' : `: ${JSON.stringify(detail)}`}`);
  console.error(`  FAIL ${name}`, detail ?? '');
}

function exercise(name: string, index: number): Workout['exercises'][number] {
  const id = name.toLowerCase().replace(/\s+/g, '-');
  const pattern = name.includes('Deadlift') ? 'hinge' : name.includes('Press') ? 'push' : 'squat';
  return {
    id: `row-${id}`,
    workoutId: 'command-base-workout',
    exerciseId: id,
    exerciseOrder: index,
    prescribedSets: 3,
    prescribedRepsMin: 6,
    prescribedRepsMax: 8,
    restSeconds: 90,
    section18Evidence: {
      protocolVersion: 1,
      role: 'main_strength',
      strengthPattern: pattern,
      mainStrengthPattern: pattern,
      provenance: 'canonical_row_classifier',
    },
    exercise: {
      id,
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

function baseWorkout(): Workout {
  return {
    id: 'command-base-workout',
    microcycleId: 'command-base-week',
    planEntryId: 'command-base-entry',
    dayOfWeek: 1,
    name: 'Full Body Strength',
    description: 'Command transaction test session',
    durationMinutes: 60,
    intensity: 'Moderate',
    workoutType: 'Strength',
    sessionTier: 'core',
    hasCombinedConditioning: false,
    strengthIntent: {
      archetype: 'full_body',
      primaryPattern: 'hinge',
      plannedPatterns: ['hinge', 'push'],
      effectivePatterns: ['hinge', 'push'],
    },
    strengthPatternContributions: ['hinge', 'push'],
    section18Evidence: {
      protocolVersion: 1,
      conditioningRole: 'none',
      conditioningStress: 'unknown',
      provenance: 'planner_and_canonical_content',
    },
    exercises: [
      exercise('Romanian Deadlift', 0),
      exercise('Barbell Overhead Press', 1),
      exercise('Goblet Squat', 2),
    ],
    createdAt: '',
    updatedAt: '',
  };
}

function reset(): void {
  useProgramStore.setState({
    currentProgram: null,
    currentMicrocycle: null,
    todayWorkout: null,
    blockState: { blockNumber: 1, blockStartDate: '2026-07-13' },
    acceptedMaterialContext: {
      ...createEmptyAcceptedMaterialContext(),
      revision: 1,
      lastTransaction: 'test:seed',
    },
    dateOverrides: { [TODAY]: baseWorkout() },
    overrideContexts: {},
    weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {},
    sessionFeedback: {},
    weightOverrides: {},
  });
  useCoachUpdatesStore.setState({
    updatesByWeek: {},
    activeConstraints: [],
    activeInjury: null,
    dismissedCoachNoteIds: [],
  });
}

function context() {
  return normalizeAcceptedMaterialContext(useProgramStore.getState().acceptedMaterialContext);
}

function revision(): number {
  return context().revision;
}

function visibleNames(): string[] {
  return buildDayWorkoutProjectedDay({
    date: TODAY,
    todayISO: TODAY,
    state: buildScheduleStateImperative(),
    overrideContext: useProgramStore.getState().overrideContexts[TODAY],
  }).workout?.exercises.map((row) => row.exercise?.name ?? row.exerciseId) ?? [];
}

function report(args: {
  turnId: string;
  bodyPart: string;
  severity: number;
  occurredAtISO: string;
  expectedAcceptedRevision?: number;
  note?: string;
  redFlag?: boolean;
}): InjuryEpisodeCommand {
  return {
    operation: 'report',
    commandId: `coach-injury:${args.turnId}`,
    turnId: args.turnId,
    expectedAcceptedRevision: args.expectedAcceptedRevision ?? revision(),
    todayISO: TODAY,
    occurredAtISO: args.occurredAtISO,
    sourceActor: 'athlete',
    sourceSurface: 'coach_chat',
    note: args.note ?? `${args.bodyPart} report`,
    safety: args.redFlag
      ? { kind: 'red_flag', advice: 'urgent_medical', reason: 'head_or_concussion' }
      : { kind: 'standard' },
    bodyPart: args.bodyPart,
    severity: args.severity,
  };
}

function exact(args: {
  turnId: string;
  operation: 'update' | 'refresh' | 'resolve';
  episodeId: string;
  occurredAtISO: string;
  expectedAcceptedRevision?: number;
  severity?: number;
  status?: 'active' | 'improving';
  change?: 'severity_reply' | 'improving' | 'worsening';
}): InjuryEpisodeCommand {
  const common = {
    commandId: `coach-injury:${args.turnId}` as const,
    turnId: args.turnId,
    expectedAcceptedRevision: args.expectedAcceptedRevision ?? revision(),
    todayISO: TODAY,
    occurredAtISO: args.occurredAtISO,
    sourceActor: 'athlete' as const,
    sourceSurface: 'coach_chat' as const,
    note: `${args.operation} exact episode`,
    safety: { kind: 'standard' as const },
    episodeId: args.episodeId,
  };
  return args.operation === 'update'
    ? {
        ...common,
        operation: 'update',
        severity: args.severity!,
        status: args.status!,
        change: args.change!,
      }
    : { ...common, operation: args.operation };
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 10));
}

async function main(): Promise<void> {
  await Promise.all([
    useProgramStore.persist.rehydrate(),
    useCoachUpdatesStore.persist.rehydrate(),
  ]);

  console.log('\n[1] report is durable at every severity and always force-creates');
  reset();
  const low = await executeInjuryEpisodeCommand(report({
    turnId: 'low', bodyPart: 'ear', severity: 1, occurredAtISO: '2026-07-20T08:00:00.000Z',
  }));
  check('low-severity report changes accepted state without inventing a visible change',
    low.outcome === 'created_no_program_change' && low.acceptedStateChanged &&
      !low.visibleProgramChanged && low.changedProgram === low.visibleProgramChanged, low);
  check('low-severity report creates a durable canonical episode',
    context().injuryEpisodes.some((episode) => episode.episodeId === low.episodeId &&
      episode.severity === 1) &&
      ((await readDurableProgramStoreEnvelope()) ?? '').includes(low.episodeId!), low);

  reset();
  const first = await executeInjuryEpisodeCommand(report({
    turnId: 'similar-1', bodyPart: 'hamstring', severity: 6,
    occurredAtISO: '2026-07-20T09:00:00.000Z',
  }));
  const firstRevision = revision();
  const second = await executeInjuryEpisodeCommand(report({
    turnId: 'similar-2', bodyPart: 'hamstring', severity: 6,
    occurredAtISO: '2026-07-20T09:01:00.000Z', expectedAcceptedRevision: firstRevision,
  }));
  check('report force-creates despite a similar active episode',
    first.episodeId !== second.episodeId && context().injuryEpisodes.filter((episode) =>
      episode.bodyPart === 'hamstring' && episode.status === 'active').length === 2,
    context().injuryEpisodes);
  check('first report visibly recomposes risky work',
    first.outcome === 'created_and_recomposed' && first.visibleProgramChanged &&
      !visibleNames().includes('Romanian Deadlift'), { first, names: visibleNames() });

  console.log('\n[2] update, refresh, and resolve target only the exact episode');
  const secondBefore = semanticFingerprint(context().injuryEpisodes.find((episode) =>
    episode.episodeId === second.episodeId));
  const severityReply = await executeInjuryEpisodeCommand(exact({
    turnId: 'severity-reply', operation: 'update', episodeId: first.episodeId!,
    occurredAtISO: '2026-07-20T09:30:00.000Z', severity: 5,
    status: 'active', change: 'severity_reply',
  }));
  check('severity reply updates only the supplied exact episode ID',
    severityReply.acceptedStateChanged &&
      context().injuryEpisodes.find((episode) => episode.episodeId === first.episodeId)?.severity === 5 &&
      semanticFingerprint(context().injuryEpisodes.find((episode) =>
        episode.episodeId === second.episodeId)) === secondBefore, severityReply);
  const improvedAt = '2026-07-20T10:00:00.000Z';
  const improved = await executeInjuryEpisodeCommand(exact({
    turnId: 'improve', operation: 'update', episodeId: first.episodeId!,
    occurredAtISO: improvedAt, severity: 3, status: 'improving', change: 'improving',
  }));
  check('improving updates the exact ID and leaves its sibling byte-stable',
    improved.acceptedStateChanged &&
      context().injuryEpisodes.find((episode) => episode.episodeId === first.episodeId)?.status === 'improving' &&
      semanticFingerprint(context().injuryEpisodes.find((episode) =>
        episode.episodeId === second.episodeId)) === secondBefore, improved);
  const worsenedAt = '2026-07-20T11:00:00.000Z';
  const worsened = await executeInjuryEpisodeCommand(exact({
    turnId: 'worsen', operation: 'update', episodeId: first.episodeId!,
    occurredAtISO: worsenedAt, severity: 7, status: 'active', change: 'worsening',
  }));
  check('worsening records the requested severity and active status',
    worsened.acceptedStateChanged &&
      context().injuryEpisodes.find((episode) => episode.episodeId === first.episodeId)?.severity === 7 &&
      context().injuryEpisodes.find((episode) => episode.episodeId === first.episodeId)?.status === 'active',
    worsened);
  const beforeRefresh = context().injuryEpisodes.find((episode) =>
    episode.episodeId === first.episodeId)!;
  const policyBeforeRefresh = semanticFingerprint(beforeRefresh.currentRestrictionPolicy);
  const refreshedAt = '2026-07-20T12:00:00.000Z';
  const refreshed = await executeInjuryEpisodeCommand(exact({
    turnId: 'refresh', operation: 'refresh', episodeId: first.episodeId!, occurredAtISO: refreshedAt,
  }));
  const afterRefresh = context().injuryEpisodes.find((episode) =>
    episode.episodeId === first.episodeId)!;
  const refreshTransition = afterRefresh.transitionHistory.at(-1)!;
  check('refresh reapplies the current policy and records a same-status transition',
    refreshed.outcome.startsWith('refreshed_') && refreshed.acceptedStateChanged &&
      semanticFingerprint(afterRefresh.currentRestrictionPolicy) === policyBeforeRefresh &&
      refreshTransition.fromStatus === 'active' && refreshTransition.toStatus === 'active' &&
      refreshTransition.timestamp === refreshedAt, refreshed);
  const resolvedAt = '2026-07-20T13:00:00.000Z';
  const resolved = await executeInjuryEpisodeCommand(exact({
    turnId: 'resolve', operation: 'resolve', episodeId: first.episodeId!, occurredAtISO: resolvedAt,
  }));
  check('resolve changes only the exact episode and preserves the other active episode',
    resolved.outcome.startsWith('resolved_') &&
      context().injuryEpisodes.find((episode) => episode.episodeId === first.episodeId)?.status === 'resolved' &&
      context().injuryEpisodes.find((episode) => episode.episodeId === second.episodeId)?.status === 'active',
    resolved);
  const revisionAfterResolve = revision();
  const already = await executeInjuryEpisodeCommand(exact({
    turnId: 'resolve-again', operation: 'resolve', episodeId: first.episodeId!,
    occurredAtISO: '2026-07-20T13:01:00.000Z',
  }));
  check('already-resolved resolve is idempotent',
    already.outcome === 'already_resolved' && !already.acceptedStateChanged &&
      !already.visibleProgramChanged && revision() === revisionAfterResolve, already);
  check('transition history is exact and uses only occurredAtISO',
    context().injuryEpisodes.find((episode) => episode.episodeId === first.episodeId)
      ?.transitionHistory.map((entry) => [entry.timestamp, entry.fromStatus, entry.toStatus, entry.severity])
      .slice(-5).map(JSON.stringify).join('|') === [
        ['2026-07-20T09:30:00.000Z', 'active', 'active', 5],
        ['2026-07-20T10:00:00.000Z', 'active', 'improving', 3],
        ['2026-07-20T11:00:00.000Z', 'improving', 'active', 7],
        ['2026-07-20T12:00:00.000Z', 'active', 'active', 7],
        ['2026-07-20T13:00:00.000Z', 'active', 'resolved', 0],
      ].map(JSON.stringify).join('|'), context().injuryEpisodes);

  console.log('\n[3] expected revision conflicts every operation before mutation');
  reset();
  const conflictSeed = await executeInjuryEpisodeCommand(report({
    turnId: 'conflict-seed', bodyPart: 'shoulder', severity: 6,
    occurredAtISO: '2026-07-20T14:00:00.000Z',
  }));
  const currentRevision = revision();
  const conflictCommands: InjuryEpisodeCommand[] = [
    report({
      turnId: 'conflict-report', bodyPart: 'calf', severity: 4,
      occurredAtISO: '2026-07-20T14:01:00.000Z', expectedAcceptedRevision: currentRevision - 1,
    }),
    exact({
      turnId: 'conflict-update', operation: 'update', episodeId: conflictSeed.episodeId!,
      occurredAtISO: '2026-07-20T14:02:00.000Z', expectedAcceptedRevision: currentRevision - 1,
      severity: 5, status: 'active', change: 'severity_reply',
    }),
    exact({
      turnId: 'conflict-refresh', operation: 'refresh', episodeId: conflictSeed.episodeId!,
      occurredAtISO: '2026-07-20T14:03:00.000Z', expectedAcceptedRevision: currentRevision - 1,
    }),
    exact({
      turnId: 'conflict-resolve', operation: 'resolve', episodeId: conflictSeed.episodeId!,
      occurredAtISO: '2026-07-20T14:04:00.000Z', expectedAcceptedRevision: currentRevision - 1,
    }),
  ];
  for (const command of conflictCommands) {
    const before = acceptedStateFingerprint();
    const result = await executeInjuryEpisodeCommand(command);
    check(`${command.operation} returns an expected-revision conflict`,
      result.outcome === 'conflicted' && !result.acceptedStateChanged &&
        acceptedStateFingerprint() === before, result);
  }
  const absent = await executeInjuryEpisodeCommand(exact({
    turnId: 'absent', operation: 'refresh', episodeId: 'missing-exact-id',
    occurredAtISO: '2026-07-20T14:05:00.000Z',
  }));
  check('absent exact target is a typed handled-safe failure',
    absent.outcome === 'safely_rejected' && absent.reason === 'injury_episode_not_found' &&
      !absent.acceptedStateChanged, absent);

  console.log('\n[4] red flags and multiple active episodes compose canonically');
  reset();
  const ledgerBefore = semanticFingerprint(useProgramStore.getState().reversibleAdjustmentLedger);
  const hamstring = await executeInjuryEpisodeCommand(report({
    turnId: 'compose-hamstring', bodyPart: 'hamstring', severity: 6,
    occurredAtISO: '2026-07-20T15:00:00.000Z',
  }));
  await executeInjuryEpisodeCommand(report({
    turnId: 'compose-shoulder', bodyPart: 'shoulder', severity: 6,
    occurredAtISO: '2026-07-20T15:01:00.000Z',
  }));
  check('all active episodes remain composed simultaneously',
    context().injuryEpisodes.filter((episode) => episode.status === 'active').length === 2 &&
      !visibleNames().includes('Romanian Deadlift') &&
      !visibleNames().includes('Barbell Overhead Press'), visibleNames());
  check('commands never corrupt or create reversible adjustments',
    semanticFingerprint(useProgramStore.getState().reversibleAdjustmentLedger) === ledgerBefore);
  check('deterministic report timestamp is persisted exactly',
    context().injuryEpisodes.find((episode) => episode.episodeId === hamstring.episodeId)?.createdAt ===
      '2026-07-20T15:00:00.000Z');

  reset();
  const redFlag = await executeInjuryEpisodeCommand(report({
    turnId: 'red-flag', bodyPart: 'head', severity: 3,
    occurredAtISO: '2026-07-20T16:00:00.000Z', redFlag: true,
  }));
  const redFlagEpisode = context().injuryEpisodes.find((episode) =>
    episode.episodeId === redFlag.episodeId);
  const redFlagVisible = buildDayWorkoutProjectedDay({
    date: TODAY, todayISO: TODAY, state: buildScheduleStateImperative(),
  }).workout;
  check('typed red-flag evidence creates a durable paused policy atomically',
    redFlag.acceptedStateChanged && redFlag.visibleProgramChanged &&
      redFlagEpisode?.seriousSymptoms === true &&
      redFlagEpisode.seriousSymptom === 'head_or_concussion' &&
      redFlagEpisode.currentRestrictionPolicy.adjustmentLevel === 'training_paused' &&
      (redFlagVisible === null || redFlagVisible.workoutType === 'Recovery'),
    { redFlag, redFlagEpisode, redFlagVisible });

  console.log('\n[5] persistence, readback, and post-publication failures roll back exactly');
  const rollbackCase = async (
    name: string,
    execute: () => Promise<InjuryEpisodeCommandResult>,
  ): Promise<void> => {
    const beforeMemory = acceptedStateFingerprint();
    const beforeDurable = await readDurableProgramStoreEnvelope();
    const result = await execute();
    check(`${name}: fails safely with explicit unchanged semantics`,
      result.outcome === 'safely_rejected' && !result.acceptedStateChanged &&
        !result.visibleProgramChanged, result);
    check(`${name}: restores exact accepted memory`, acceptedStateFingerprint() === beforeMemory);
    check(`${name}: restores exact durable state`,
      (await readDurableProgramStoreEnvelope()) === beforeDurable);
    check(`${name}: publishes no episode`, context().injuryEpisodes.length === 0);
  };

  reset();
  await settle();
  const originalSetItem = asyncStorageDurable.setItem;
  let writeFailed = false;
  asyncStorageDurable.setItem = async (name: string, value: string): Promise<void> => {
    if (name === PROGRAM_STORE_PERSISTENCE_KEY && !writeFailed) {
      writeFailed = true;
      throw new Error('forced_program_write_failure');
    }
    await originalSetItem(name, value);
  };
  try {
    await rollbackCase('persistence write failure', () => executeInjuryEpisodeCommand(report({
      turnId: 'write-failure', bodyPart: 'hamstring', severity: 6,
      occurredAtISO: '2026-07-20T17:00:00.000Z',
    })));
  } finally {
    asyncStorageDurable.setItem = originalSetItem;
  }

  reset();
  await settle();
  const originalGetItem = asyncStorageCompat.getItem;
  let programReads = 0;
  asyncStorageCompat.getItem = async (name: string): Promise<string | null> => {
    const value = await originalGetItem(name);
    if (name === PROGRAM_STORE_PERSISTENCE_KEY && ++programReads === 3) return 'readback-mismatch';
    return value;
  };
  try {
    await rollbackCase('acknowledged readback mismatch', () => executeInjuryEpisodeCommand(report({
      turnId: 'readback-failure', bodyPart: 'hamstring', severity: 6,
      occurredAtISO: '2026-07-20T17:01:00.000Z',
    })));
  } finally {
    asyncStorageCompat.getItem = originalGetItem;
  }

  reset();
  await settle();
  await rollbackCase('post-publication verification failure', () =>
    executeInjuryEpisodeCommand(report({
      turnId: 'post-publication-failure', bodyPart: 'hamstring', severity: 6,
      occurredAtISO: '2026-07-20T17:02:00.000Z',
    }), { testHooks: { verifyAfterPersistence: () => false } }));

  console.log('\n[6] one supplied TraceV2 root owns command and transaction evidence');
  reset();
  clearAthleteActionDiagnosticEvents();
  configureAthleteActionDiagnosticsForTests({
    enabled: true,
    production: false,
    now: () => new Date('2026-07-20T18:00:00.000Z'),
  });
  const root = beginAthleteActionTrace({
    source: 'coach',
    actionType: 'coach_command',
    route: 'test_coach_turn_root',
    sourceDate: TODAY,
    sessionDate: TODAY,
    scope: 'coach_turn',
    controlId: 'turn-trace',
  });
  const secret = 'SECRET RAW HEALTH NOTE';
  const traced = await executeInjuryEpisodeCommand(report({
    turnId: 'trace', bodyPart: 'calf', severity: 5,
    occurredAtISO: '2026-07-20T18:00:00.000Z', note: secret,
  }), { trace: root });
  const traceRecord = getAthleteActionTraceV2(root.traceId);
  check('executor reuses exactly one supplied TraceV2 root',
    traced.acceptedStateChanged && getAthleteActionTracesV2().length === 1 &&
      traceRecord?.traceId === root.traceId && traceRecord.spans.length >= 3,
    traceRecord?.spans);
  check('child evidence records operation, revision, accepted/visible change, persistence and target',
    traceRecord?.events.some((event) =>
      event.fields.commandOperation === 'report' &&
      event.fields.commandTarget === 'new_report' &&
      event.fields.expectedAcceptedRevision === 1) &&
      traceRecord.evidence.persistence.status === 'captured', traceRecord);
  check('TraceV2 diagnostics never store raw injury wording or health notes',
    !JSON.stringify(traceRecord).includes(secret));
  configureAthleteActionDiagnosticsForTests(null);
  clearAthleteActionDiagnosticEvents();

  console.log('\n[7] compatibility tap/API facade retains observable parity');
  reset();
  const commandResult = await executeInjuryEpisodeCommand(report({
    turnId: 'parity-command', bodyPart: 'hamstring', severity: 6,
    occurredAtISO: '2026-07-20T19:00:00.000Z',
  }));
  const commandVisible = visibleNames();
  const commandEpisode = context().injuryEpisodes[0];

  reset();
  const policy = buildInjuryPolicy('hamstring', 6);
  const tapConstraint: ActiveInjuryConstraint = {
    id: 'tap-hamstring',
    type: 'injury',
    bodyPart: 'hamstring',
    bucket: 'hamstring',
    severity: 6,
    status: 'active',
    startDate: TODAY,
    lastUpdatedAt: '2026-07-20T19:00:00.000Z',
    source: 'tap',
    severityBand: 'moderate',
    adjustmentLevel: 'moderate',
    seriousSymptoms: false,
    rules: [...policy.globalRules],
    safeFocus: [...policy.replacements, ...policy.preserveText],
    advice: policy.closingAdvice ? [policy.closingAdvice] : [],
    modifierAffects: ['current_week', 'future_generation'],
    presentationOnlyDismiss: true,
  };
  const tapResult = await executeProgramControlActionDurably({
    type: 'set_injury_modifier',
    source: { screen: 'test', surface: 'guided_injury_flow', initiatedBy: 'tap' },
    payload: { constraint: tapConstraint },
    scope: 'current_and_future',
    requiresRebuild: false,
    createsActiveModifier: true,
    oneOffOnly: false,
  }, { todayISO: TODAY });
  const tapEpisode = context().injuryEpisodes[0];
  check('tap facade and command report expose the same visible success behavior',
    tapResult.ok && tapResult.changedProgram === commandResult.visibleProgramChanged &&
      semanticFingerprint(visibleNames()) === semanticFingerprint(commandVisible),
    { tapResult, commandResult, tap: visibleNames(), command: commandVisible });
  check('tap facade and command produce equivalent canonical episode policy',
    semanticFingerprint({
      bodyPart: tapEpisode.bodyPart,
      bucket: tapEpisode.bucket,
      severity: tapEpisode.severity,
      status: tapEpisode.status,
      seriousSymptoms: tapEpisode.seriousSymptoms,
      policy: tapEpisode.currentRestrictionPolicy,
    }) === semanticFingerprint({
      bodyPart: commandEpisode.bodyPart,
      bucket: commandEpisode.bucket,
      severity: commandEpisode.severity,
      status: commandEpisode.status,
      seriousSymptoms: commandEpisode.seriousSymptoms,
      policy: commandEpisode.currentRestrictionPolicy,
    }), { tapEpisode, commandEpisode });

  if (failures.length > 0) {
    console.error(`\n${failures.length} failure(s):\n${failures.join('\n')}`);
    process.exit(1);
  }
  console.log(`\n[injuryEpisodeCommand] ${passed} passed, 0 failed`);
}

main().catch((error) => {
  configureAthleteActionDiagnosticsForTests(null);
  console.error(error);
  process.exit(1);
});
