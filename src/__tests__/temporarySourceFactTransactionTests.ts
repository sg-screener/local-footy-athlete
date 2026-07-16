/**
 * TemporarySourceFact + AcceptedCompositionBase permanent invariants.
 * Run: npm run test:temporary-source-facts
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

const {
  createEmptyAcceptedMaterialContext,
  normalizeAcceptedMaterialContext,
} = require('../store/acceptedStateColdStart') as typeof import('../store/acceptedStateColdStart');
const {
  createEmptyReversibleAdjustmentLedger,
  normalizeReversibleAdjustmentLedger,
} = require('../rules/reversibleAdjustmentLedger') as typeof import('../rules/reversibleAdjustmentLedger');
const {
  createTemporaryFatigueFact,
  createTemporaryPoorSleepFact,
  createTemporarySorenessFact,
  composeTemporarySourceFactCompatibility,
  expireTemporarySourceFacts,
  isInjurySourceFact,
  migrateLegacyTemporarySourceFacts,
  temporaryFactScope,
  temporarySourceFactId,
} = require('../rules/temporarySourceFact') as typeof import('../rules/temporarySourceFact');
const {
  transactTemporarySourceFact,
} = require('../store/temporarySourceFactTransaction') as typeof import('../store/temporarySourceFactTransaction');
const {
  captureAcceptedLoadEditLedgerBaseline,
  commitAcceptedStateTransaction,
  commitExplicitLoadEditLedgerFromBaseline,
} = require('../store/acceptedStateTransaction') as typeof import('../store/acceptedStateTransaction');
const {
  useProgramStore,
} = require('../store/programStore') as typeof import('../store/programStore');
const {
  useCoachUpdatesStore,
} = require('../store/coachUpdatesStore') as typeof import('../store/coachUpdatesStore');
const {
  useReadinessStore,
} = require('../store/readinessStore') as typeof import('../store/readinessStore');
const {
  parseCoachIntent,
} = require('../utils/coachIntent') as typeof import('../utils/coachIntent');
const {
  handleCoachTurn,
} = require('../utils/coachTurnController') as typeof import('../utils/coachTurnController');
const {
  executeProgramControlActionDurably,
} = require('../utils/programControlActions') as typeof import('../utils/programControlActions');
const {
  clearAthleteActionDiagnosticEvents,
  configureAthleteActionDiagnosticsForTests,
  getAthleteActionTraceV2,
} = require('../utils/athleteActionDiagnostics') as typeof import('../utils/athleteActionDiagnostics');
const {
  semanticFingerprint,
} = require('../utils/programSemanticSnapshot') as typeof import('../utils/programSemanticSnapshot');
const {
  buildSection18WeeklyExposureContractV2,
} = require('../rules/weeklyExposureContractV2') as typeof import('../rules/weeklyExposureContractV2');

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

function reset(): void {
  const context = {
    ...createEmptyAcceptedMaterialContext(),
    revision: 1,
    lastTransaction: 'test:seed',
  };
  useProgramStore.setState({
    currentProgram: null,
    currentMicrocycle: null,
    todayWorkout: null,
    blockState: null,
    acceptedMaterialContext: context,
    dateOverrides: {},
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
  useReadinessStore.setState({ signalsByDate: {} });
}

function activeFacts() {
  return normalizeAcceptedMaterialContext(useProgramStore.getState().acceptedMaterialContext)
    .temporarySourceFacts.filter((fact) => isInjurySourceFact(fact) || fact.status === 'active');
}

async function main(): Promise<void> {
  await Promise.all([
    useProgramStore.persist.rehydrate(),
    useCoachUpdatesStore.persist.rehydrate(),
    useReadinessStore.persist.rehydrate(),
  ]);
  reset();
  const date = '2026-07-20';
  const now = '2026-07-20T09:00:00.000Z';
  const dayScope = temporaryFactScope({ kind: 'date', date });
  const weekScope = temporaryFactScope({ kind: 'week', date });

  console.log('\n[1] typed intent boundary');
  const factual = parseCoachIntent({
    intent: 'fatigue', confidence: 1, needsClarification: false,
    payload: { severity: 5, scope: 'one_off', reportKind: 'fatigue' },
  });
  const command = parseCoachIntent({
    intent: 'request_program_adjustment', confidence: 1, needsClarification: false,
    payload: { operation: 'reduce_strength_block', scope: 'this_week' },
  });
  const mixed = parseCoachIntent({
    intent: 'mixed_fact_and_program_adjustment', confidence: 1, needsClarification: false,
    payload: { factKind: 'fatigue', reportKind: 'cooked', operation: 'reduce_strength_block' },
  });
  check('factual report is not an explicit program edit', factual?.intent === 'fatigue');
  check('explicit lighter command is a program adjustment', command?.intent === 'request_program_adjustment');
  check('mixed intent preserves both typed owners', mixed?.intent === 'mixed_fact_and_program_adjustment' &&
    mixed.payload?.factKind === 'fatigue' && mixed.payload?.operation === 'reduce_strength_block');

  console.log('\n[1b] Coach typed front door owns factual cooked reports');
  const cookedMessages: import('../utils/coachTurnController').CoachTurnMessage[] = [];
  const cookedUser: import('../utils/coachTurnController').CoachTurnMessage = {
    id: 'temporary-source-fact-cooked-user',
    role: 'user',
    content: "I'm cooked",
  };
  const cookedTurn = await handleCoachTurn({
    userMessage: cookedUser,
    messages: cookedMessages,
    todayISO: date,
    classifier: {
      classify: async () => ({
        intent: 'fatigue',
        confidence: 1,
        needsClarification: false,
        payload: {
          reportKind: 'cooked',
          scope: 'this_week',
        },
      }),
    },
    pendingCoachProposal: null,
    pendingReadiness: null,
    pendingInjury: null,
    smokeCoachBikeFlow: false,
    isFocused: true,
    smokeWednesdayMissingReason: null,
    smokeWednesdayOpenTarget: null,
    setPendingCoachProposal: () => {},
    setPendingReadiness: () => {},
    appendUser: () => cookedMessages.push(cookedUser),
    appendAssistant: (message) => cookedMessages.push(message),
    appendUserAndAssistant: (message) => cookedMessages.push(cookedUser, message),
    clearInput: () => {},
    setIsLoading: () => {},
    setCoachProgressLabel: () => {},
    startSetupRebuildProgress: () => {},
    clearSetupRebuildProgress: () => {},
    setLastCoachDebug: () => {},
    semanticProgramEditDraftMode: 'off',
    coachRevisionProposalMode: 'off',
  });
  const cookedFact = activeFacts().find((fact) =>
    !isInjurySourceFact(fact) && fact.factKind === 'fatigue');
  const cookedReply = cookedMessages.find((message) => message.role === 'assistant')?.content ?? '';
  check('factual “I’m cooked” commits a canonical fatigue fact',
    cookedTurn.handled && cookedFact?.reportKind === 'cooked');
  check('factual “I’m cooked” does not create an explicit load edit',
    useProgramStore.getState().reversibleAdjustmentLedger.adjustments.every((entry) =>
      entry.kind !== 'explicit_load_edit'));
  check('factual “I’m cooked” does not fall into a vague load clarification',
    /report is active/i.test(cookedReply) &&
    !/strength|conditioning|whole session/i.test(cookedReply));
  reset();

  console.log('\n[2] Coach/tap equivalence and strongest global tier once');
  const coachFatigue = createTemporaryFatigueFact({
    observedDate: date, scope: weekScope, athleteReportedLevel: 'cooked',
    sourceSurface: 'coach_chat', now,
  });
  const tapFatigue = createTemporaryFatigueFact({
    observedDate: date, scope: weekScope, athleteReportedLevel: 'cooked',
    sourceSurface: 'program_tab', now,
  });
  const coachProjection = composeTemporarySourceFactCompatibility({ temporarySourceFacts: [coachFatigue] });
  const tapProjection = composeTemporarySourceFactCompatibility({ temporarySourceFacts: [tapFatigue] });
  check('Coach and tap facts have the same stable identity', coachFatigue.factId === tapFatigue.factId);
  check('Coach and tap facts produce equivalent safety', semanticFingerprint(coachProjection.activeConstraints) ===
    semanticFingerprint(tapProjection.activeConstraints));
  const poorSleep = createTemporaryPoorSleepFact({
    observedDate: date, scope: weekScope, pattern: 'repeated', sourceSurface: 'test', now,
  });
  const globalProjection = composeTemporarySourceFactCompatibility({
    temporarySourceFacts: [coachFatigue, poorSleep],
  });
  const globalConstraints = globalProjection.activeConstraints.filter((constraint) =>
    constraint.type === 'fatigue');
  check('fatigue and poor sleep compose one global tier', globalConstraints.length === 1, globalConstraints);
  check('one global tier carries both fact owners', globalConstraints[0]?.temporarySourceFactIds?.length === 2);
  check('strongest global level wins once', globalConstraints[0]?.severity === 8);

  console.log('\n[2b] TraceV2 follows the canonical tap source-fact owner');
  reset();
  configureAthleteActionDiagnosticsForTests({
    enabled: true,
    production: false,
    now: () => new Date('2026-07-20T09:00:00.000Z'),
    sink: () => undefined,
  });
  clearAthleteActionDiagnosticEvents();
  const tracedCreate = await executeProgramControlActionDurably({
    type: 'set_fatigue_status',
    source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
    scope: 'current_week',
    payload: { date, todayISO: date, level: 'cooked' },
    requiresRebuild: false,
    createsActiveModifier: true,
    oneOffOnly: false,
  }, { todayISO: date });
  const createTrace = tracedCreate.traceId
    ? getAthleteActionTraceV2(tracedCreate.traceId)
    : null;
  check('tap fact creation retains one TraceV2 identity',
    tracedCreate.ok && !!tracedCreate.traceId && createTrace?.traceId === tracedCreate.traceId);
  check('TraceV2 records the exact canonical fact creation',
    createTrace?.evidence.factsCreated.status === 'captured' &&
    createTrace.evidence.factsCreated.value.some((entry: any) =>
      entry.id === tracedCreate.createdModifierIds?.[0] &&
      entry.type === 'temporary_source_fact' &&
      entry.status === 'active'));
  check('TraceV2 records acknowledged durable readback',
    createTrace?.evidence.persistence.status === 'captured' &&
    createTrace.evidence.persistence.value.some((entry) =>
      entry.operation === 'readback' && entry.acknowledged));
  check('TraceV2 records canonical source-fact and visible after-state',
    createTrace?.evidence.semanticAcceptedBefore.status === 'captured' &&
    createTrace.evidence.semanticAcceptedAfter.status === 'captured' &&
    createTrace.evidence.semanticAcceptedBefore.value.componentFingerprints.temporarySourceFacts !==
      createTrace.evidence.semanticAcceptedAfter.value.componentFingerprints.temporarySourceFacts &&
    createTrace.evidence.visibleCardAfter.status === 'captured');
  check('TraceV2 requests terminal success from the source-fact owner',
    createTrace?.requestedTerminalOutcome.status === 'captured' &&
    createTrace.requestedTerminalOutcome.value === 'success');

  const tracedResolve = await executeProgramControlActionDurably({
    type: 'clear_fatigue_status',
    source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
    scope: 'current_week',
    payload: { modifierId: tracedCreate.createdModifierIds?.[0], date },
    requiresRebuild: false,
    createsActiveModifier: false,
    oneOffOnly: false,
  }, { todayISO: date });
  const resolveTrace = tracedResolve.traceId
    ? getAthleteActionTraceV2(tracedResolve.traceId)
    : null;
  check('TraceV2 records exact canonical fact resolution',
    tracedResolve.ok &&
    resolveTrace?.evidence.factsExpired.status === 'captured' &&
    resolveTrace.evidence.factsExpired.value.some((entry: any) =>
      entry.id === tracedResolve.clearedModifierIds?.[0] &&
      entry.type === 'temporary_source_fact' &&
      entry.status === 'resolved'));
  configureAthleteActionDiagnosticsForTests(null);
  clearAthleteActionDiagnosticEvents();
  reset();

  console.log('\n[3] idempotence and exact replacement');
  const first = await transactTemporarySourceFact({
    operation: 'create', fact: coachFatigue, todayISO: date, now,
  });
  const repeated = await transactTemporarySourceFact({
    operation: 'create', fact: { ...coachFatigue, createdAt: '2026-07-20T10:00:00.000Z', updatedAt: '2026-07-20T10:00:00.000Z' },
    todayISO: date,
  });
  check('first factual report is accepted', first.outcome.startsWith('created_'));
  check('changed wording describes the verified active fact', /report is active/i.test(first.message));
  check('repeated report is idempotent', repeated.outcome === 'no_op' && activeFacts().length === 1);
  check('no-op wording does not claim a new change', /already active/i.test(repeated.message));

  const calf = createTemporarySorenessFact({
    observedDate: date, scope: dayScope, athleteReportedLevel: 6,
    distribution: 'localized', reportedBodyPartLanguage: 'my calves',
    canonicalBodyPartBucket: 'calf', sourceSurface: 'coach_chat', now,
  });
  await transactTemporarySourceFact({ operation: 'create', fact: calf, todayISO: date });
  const fatigueReplacement = createTemporaryFatigueFact({
    observedDate: date, scope: dayScope, athleteReportedLevel: 5,
    sourceSurface: 'coach_chat', factId: calf.factId, now: '2026-07-20T10:00:00.000Z',
  });
  await transactTemporarySourceFact({ operation: 'update', fact: fatigueReplacement, todayISO: date });
  const replaced = activeFacts().find((fact) => temporarySourceFactId(fact) === calf.factId)!;
  check('cross-kind exact update replaces the fact', !isInjurySourceFact(replaced) && replaced.factKind === 'fatigue');
  check('fatigue update retains no stale soreness fields',
    !('reportedBodyPartLanguage' in replaced) && !('canonicalBodyPartBucket' in replaced));

  console.log('\n[4] atomic poor-sleep replacement');
  const singleSleep = createTemporaryPoorSleepFact({
    observedDate: date, scope: dayScope, pattern: 'single_night', sourceSurface: 'program_tab', now,
  });
  await transactTemporarySourceFact({ operation: 'create', fact: singleSleep, todayISO: date });
  const repeatedSleep = createTemporaryPoorSleepFact({
    observedDate: date, scope: weekScope, pattern: 'repeated', sourceSurface: 'program_tab',
    factId: singleSleep.factId, now: '2026-07-20T11:00:00.000Z',
  });
  await transactTemporarySourceFact({ operation: 'update', fact: repeatedSleep, todayISO: date });
  const sleepFacts = activeFacts().filter(
    (fact): fact is import('../rules/temporarySourceFact').TemporaryPoorSleepFact =>
      !isInjurySourceFact(fact) && fact.factKind === 'poor_sleep',
  );
  check('poor sleep replaces one exact fact atomically', sleepFacts.length === 1 && sleepFacts[0].pattern === 'repeated');
  check('poor-sleep replacement preserves the stable creation timestamp',
    sleepFacts.length === 1 && sleepFacts[0].createdAt === singleSleep.createdAt);

  console.log('\n[5] localized soreness accumulation and independent resolution');
  const calfAgain = createTemporarySorenessFact({
    observedDate: date, scope: dayScope, athleteReportedLevel: 5,
    distribution: 'localized', reportedBodyPartLanguage: 'calves',
    canonicalBodyPartBucket: 'calf', sourceSurface: 'test', factId: 'test:soreness:calf', now,
  });
  const shoulder = createTemporarySorenessFact({
    observedDate: date, scope: dayScope, athleteReportedLevel: 7,
    distribution: 'localized', reportedBodyPartLanguage: 'right shoulder',
    canonicalBodyPartBucket: 'shoulder', sourceSurface: 'test', factId: 'test:soreness:shoulder', now,
  });
  await transactTemporarySourceFact({ operation: 'create', fact: calfAgain, todayISO: date });
  await transactTemporarySourceFact({ operation: 'create', fact: shoulder, todayISO: date });
  let context = normalizeAcceptedMaterialContext(useProgramStore.getState().acceptedMaterialContext);
  check('localized soreness accumulates by body-part bucket', context.activeConstraints.filter((constraint) =>
    constraint.type === 'soreness').length === 2);
  const beforeResolveOtherIds = activeFacts().filter((fact) => temporarySourceFactId(fact) !== calfAgain.factId)
    .map(temporarySourceFactId).sort();
  const resolution = await transactTemporarySourceFact({
    operation: 'resolve', factId: calfAgain.factId, todayISO: date,
  });
  const afterResolveOtherIds = activeFacts().map(temporarySourceFactId).sort();
  check('resolving one fact preserves every other active fact', semanticFingerprint(beforeResolveOtherIds) ===
    semanticFingerprint(afterResolveOtherIds));
  check('resolution wording is verified and non-generic',
    /other active facts|restoring only/i.test(resolution.message));

  console.log('\n[6] expiry, hydration ordering, history and rollback');
  const due = createTemporaryFatigueFact({
    observedDate: '2026-07-19', scope: temporaryFactScope({ kind: 'date', date: '2026-07-19' }),
    athleteReportedLevel: 5, sourceSurface: 'test', factId: 'test:due', now: '2026-07-19T09:00:00.000Z',
  });
  const expired = expireTemporarySourceFacts([due, shoulder], date, '2026-07-20T09:00:00.000Z');
  const explicitlyResolved = [{ ...due, status: 'resolved' as const, resolvedAt: now, updatedAt: now }, shoulder];
  check('expiry equals explicit resolution in visible composition', semanticFingerprint(
    composeTemporarySourceFactCompatibility({ temporarySourceFacts: expired }).activeConstraints) === semanticFingerprint(
    composeTemporarySourceFactCompatibility({ temporarySourceFacts: explicitlyResolved }).activeConstraints));

  const staleConstraint = {
    id: 'stale-fatigue', type: 'fatigue' as const, severity: 10, status: 'active' as const,
    startDate: now, lastUpdatedAt: now, rules: ['stale'], safeFocus: [], advice: [],
  };
  const staleSignal = {
    date, energy: 'low' as const, flatToday: true, source: 'quick_check' as const, updatedAt: now,
  };
  const orderA = normalizeAcceptedMaterialContext({
    temporarySourceFacts: [coachFatigue], activeConstraints: [staleConstraint],
    readinessSignalsByDate: { [date]: staleSignal },
  });
  const orderB = normalizeAcceptedMaterialContext({
    temporarySourceFacts: orderA.temporarySourceFacts,
    activeConstraints: orderA.activeConstraints,
    readinessSignalsByDate: orderA.readinessSignalsByDate,
  });
  check('hydration order cannot let stale compatibility overwrite facts',
    semanticFingerprint(orderA.activeConstraints) === semanticFingerprint(orderB.activeConstraints) &&
    !orderA.activeConstraints.some((constraint) => constraint.id === 'stale-fatigue'));

  const beforeCompatibilityWrite = semanticFingerprint(
    useProgramStore.getState().acceptedMaterialContext,
  );
  useReadinessStore.getState().setReadinessSignal(date, staleSignal);
  useCoachUpdatesStore.getState().upsertActiveConstraint(staleConstraint);
  check('readiness compatibility stores cannot publish upstream at runtime',
    semanticFingerprint(useProgramStore.getState().acceptedMaterialContext) ===
      beforeCompatibilityWrite);

  const historical = migrateLegacyTemporarySourceFacts({
    activeConstraints: [], activeInjury: null,
    readinessSignalsByDate: { [date]: { ...staleSignal, source: 'session_feedback' } },
  });
  check('historical SessionFeedback never creates a current fact', historical.length === 0);
  const beforeDismiss = semanticFingerprint(useProgramStore.getState().acceptedMaterialContext);
  useCoachUpdatesStore.getState().dismissCoachNote('coach-note:presentation-only-test');
  check('note dismissal changes no fact/program state',
    semanticFingerprint(useProgramStore.getState().acceptedMaterialContext) === beforeDismiss);

  const beforeFailure = semanticFingerprint({
    program: useProgramStore.getState().dateOverrides,
    context: useProgramStore.getState().acceptedMaterialContext,
  });
  const rejected = await transactTemporarySourceFact({
    operation: 'create',
    fact: createTemporaryFatigueFact({
      observedDate: date, scope: dayScope, athleteReportedLevel: 4,
      sourceSurface: 'test', factId: 'test:rollback', now,
    }),
    todayISO: date,
    testHooks: { verifyCandidate: () => false },
  });
  check('failed visible verification reports failure', rejected.outcome === 'safely_rejected');
  check('failure wording does not claim a mutation', /not applied|could not be verified/i.test(rejected.message));
  check('failed transaction rolls back memory', semanticFingerprint({
    program: useProgramStore.getState().dateOverrides,
    context: useProgramStore.getState().acceptedMaterialContext,
  }) === beforeFailure);

  console.log('\n[7] legacy migration never fabricates restoration');
  const legacyMigrated = migrateLegacyTemporarySourceFacts({
    activeConstraints: [staleConstraint], activeInjury: null, readinessSignalsByDate: {},
  });
  const migratedLedger = normalizeReversibleAdjustmentLedger({
    value: createEmptyReversibleAdjustmentLedger(),
    userRemovalConstraints: [],
  });
  check('legacy after-state becomes a fact with explicit provenance',
    legacyMigrated.length === 1 && !isInjurySourceFact(legacyMigrated[0]) &&
    legacyMigrated[0].legacyMigrationStatus === 'legacy_after_state_only');
  check('legacy health reduction fabricates no reversible record', migratedLedger.adjustments.length === 0);
  check('fact transactions create no explicit load-edit record',
    useProgramStore.getState().reversibleAdjustmentLedger.adjustments.every((entry) =>
      entry.kind !== 'explicit_load_edit'));

  console.log('\n[8] later intent and exact load-edit ownership survive fact resolution');
  reset();
  const originalWorkout = {
    id: 'later-intent-workout', microcycleId: 'later-intent-week', planEntryId: 'later-intent-entry',
    dayOfWeek: 1, name: 'Strength', description: '', durationMinutes: 50,
    intensity: 'Moderate', workoutType: 'Strength', sessionTier: 'core',
    hasCombinedConditioning: false, exercises: [], createdAt: '', updatedAt: '',
  } as any;
  const contract = buildSection18WeeklyExposureContractV2({
    seasonPhase: 'Off-season',
    declaredSubphase: 'early_offseason',
    mode: 'early_offseason',
    anchorState: 'none',
    teamTrainingDays: [],
    readiness: 'medium',
    plannerSelected: {
      mainStrength: 1,
      coreConditioning: 0,
      sprintHighSpeed: 0,
      powerPrimers: 0,
    },
  });
  useProgramStore.setState({
    currentMicrocycle: {
      id: 'later-intent-week',
      trainingProgramId: 'later-intent-program',
      weekNumber: 1,
      startDate: date,
      endDate: '2026-07-26',
      phase: 'Off-season',
      workouts: [originalWorkout],
      exposureContractV2: contract,
    } as any,
    dateOverrides: { [date]: originalWorkout },
  });
  const movableFact = createTemporaryFatigueFact({
    observedDate: date, scope: weekScope, athleteReportedLevel: 'cooked',
    sourceSurface: 'test', factId: 'test:later-intent-fatigue', now,
  });
  await transactTemporarySourceFact({ operation: 'create', fact: movableFact, todayISO: date });
  const movedDate = '2026-07-21';
  commitAcceptedStateTransaction({
    reason: 'test:move_while_fact_active',
    program: { dateOverrides: { [movedDate]: { ...originalWorkout, dayOfWeek: 2 } } },
    validateWeekStarts: [],
  });
  await transactTemporarySourceFact({ operation: 'resolve', factId: movableFact.factId, todayISO: date });
  check('later move survives fact resolution',
    !useProgramStore.getState().dateOverrides[date] && !!useProgramStore.getState().dateOverrides[movedDate]);

  const undoFact = createTemporaryFatigueFact({
    observedDate: date, scope: weekScope, athleteReportedLevel: 'moderate',
    sourceSurface: 'test', factId: 'test:undo-fatigue', now,
  });
  await transactTemporarySourceFact({ operation: 'create', fact: undoFact, todayISO: date });
  commitAcceptedStateTransaction({
    reason: 'test:undo_move_while_fact_active',
    program: { dateOverrides: { [date]: originalWorkout } },
    validateWeekStarts: [],
  });
  context = normalizeAcceptedMaterialContext(useProgramStore.getState().acceptedMaterialContext);
  check('undoing a move reapplies the still-active fact safety projection',
    context.activeConstraints.some((constraint) =>
      constraint.type === 'fatigue' && constraint.temporarySourceFactIds?.includes(undoFact.factId)));
  commitAcceptedStateTransaction({
    reason: 'test:delete_while_fact_active',
    program: { dateOverrides: {} },
    validateWeekStarts: [],
  });
  commitAcceptedStateTransaction({
    reason: 'test:undo_delete_while_fact_active',
    program: { dateOverrides: { [date]: originalWorkout } },
    validateWeekStarts: [],
  });
  context = normalizeAcceptedMaterialContext(useProgramStore.getState().acceptedMaterialContext);
  check('undoing a delete reapplies the still-active fact safety projection',
    context.activeConstraints.some((constraint) =>
      constraint.type === 'fatigue' && constraint.temporarySourceFactIds?.includes(undoFact.factId)));
  commitAcceptedStateTransaction({
    reason: 'test:delete_again_while_fact_active',
    program: { dateOverrides: {} },
    validateWeekStarts: [],
  });
  await transactTemporarySourceFact({ operation: 'resolve', factId: undoFact.factId, todayISO: date });
  check('later delete survives fact resolution', Object.keys(useProgramStore.getState().dateOverrides).length === 0);

  reset();
  useProgramStore.setState({
    currentMicrocycle: {
      id: 'later-intent-week',
      trainingProgramId: 'later-intent-program',
      weekNumber: 1,
      startDate: date,
      endDate: '2026-07-26',
      phase: 'Off-season',
      workouts: [originalWorkout],
      exposureContractV2: contract,
    } as any,
  });
  commitAcceptedStateTransaction({
    reason: 'test:seed_explicit_load_edit',
    program: { dateOverrides: { [date]: originalWorkout } },
    validateWeekStarts: [],
  });
  const loadEditBaseline = captureAcceptedLoadEditLedgerBaseline();
  commitAcceptedStateTransaction({
    reason: 'test:apply_explicit_load_edit',
    program: {
      dateOverrides: {
        [date]: { ...originalWorkout, durationMinutes: 30, name: 'Lighter Strength' },
      },
    },
    validateWeekStarts: [],
  });
  const explicitLedgerRecord = commitExplicitLoadEditLedgerFromBaseline({
    baseline: loadEditBaseline,
    sourceActionOrIntentId: 'test:lighter-week',
    affectedDates: [date],
    sourceActor: 'athlete',
    sourceSurface: 'coach_chat',
  });
  check('explicit go-lighter edit owns one exact reversible day delta',
    explicitLedgerRecord?.kind === 'explicit_load_edit' &&
    explicitLedgerRecord.displacedOriginalState.ownedDays.length === 1 &&
    explicitLedgerRecord.displacedOriginalState.ownedDays[0].beforeWorkout?.durationMinutes === 50 &&
    explicitLedgerRecord.displacedOriginalState.ownedDays[0].afterWorkout?.durationMinutes === 30);
  const independentFatigue = createTemporaryFatigueFact({
    observedDate: date, scope: weekScope, athleteReportedLevel: 'moderate',
    sourceSurface: 'test', factId: 'test:independent-fatigue', now,
  });
  await transactTemporarySourceFact({ operation: 'create', fact: independentFatigue, todayISO: date });
  await transactTemporarySourceFact({ operation: 'resolve', factId: independentFatigue.factId, todayISO: date });
  check('resolving fatigue preserves independent explicit lighter-week edit',
    useProgramStore.getState().reversibleAdjustmentLedger.adjustments.some((entry) =>
      entry.id === explicitLedgerRecord?.id && entry.status === 'active'));

  console.log(`\nTemporary source-fact transaction tests: ${passed} passed`);
  if (failures.length > 0) {
    console.error(`\n${failures.length} failure(s):\n${failures.join('\n')}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
