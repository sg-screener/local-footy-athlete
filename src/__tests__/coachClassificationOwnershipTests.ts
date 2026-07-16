/**
 * Permanent invariants for Single Classified Intent Ownership.
 *
 * Run: npm run test:coach-classification-ownership
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { readFileSync } from 'node:fs';
import { useCoachContextStateStore } from '../store/coachContextStateStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { usePendingCoachClarifierStore } from '../store/pendingCoachClarifierStore';
import { useProgramStore } from '../store/programStore';
import {
  athleteActionTraceCoordinator,
  clearAthleteActionDiagnosticEvents,
  configureAthleteActionDiagnosticsForTests,
} from '../utils/athleteActionDiagnostics';
import { buildCoachContextPacket } from '../utils/coachContextPacket';
import { buildLiveDispatchDeps } from '../utils/coachDispatchDeps';
import type {
  CoachClassificationResult,
  CoachIntent,
} from '../utils/coachIntent';
import { dispatchCoachIntent, type DispatchOutcome } from '../utils/coachIntentDispatcher';
import {
  clearDevE2EScenarioActionBridge,
  installDevE2EScenarioActionBridge,
} from '../utils/devE2EScenarioActionBridge';
import {
  COACH_CLASSIFICATION_UNAVAILABLE_REPLY,
  handleCoachTurn,
  type CoachTurnDebug,
  type CoachTurnMessage,
  type LegacyFallbackPolicy,
} from '../utils/coachTurnController';

const TODAY = '2026-07-17';
let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  failed += 1;
  console.log(`  FAIL ${name}${detail === undefined ? '' : `\n    ${JSON.stringify(detail)}`}`);
}

function resetState(): void {
  useProgramStore.getState().clear();
  useCoachUpdatesStore.getState().clearAllCoachUpdates();
  useCoachContextStateStore.getState().clearCoachContext();
  usePendingCoachClarifierStore.getState().clearPending();
}

function programMutationSnapshot(): string {
  const state = useProgramStore.getState();
  return JSON.stringify({
    currentProgram: state.currentProgram,
    currentMicrocycle: state.currentMicrocycle,
    dateOverrides: state.dateOverrides,
    acceptedMaterialContext: state.acceptedMaterialContext,
    sessionFeedback: state.sessionFeedback,
  });
}

async function runController(args: {
  message: string;
  classification: CoachClassificationResult;
  dispatch?: (
    intent: CoachIntent,
    packet: Parameters<typeof dispatchCoachIntent>[1],
    deps: Parameters<typeof dispatchCoachIntent>[2],
    classification?: Extract<CoachClassificationResult, { status: 'classified' }>,
    trace?: Parameters<typeof dispatchCoachIntent>[4],
  ) => Promise<DispatchOutcome>;
  legacyFallbackPolicy?: LegacyFallbackPolicy;
  onSemanticMutationBoundary?: () => void;
}) {
  const messages: CoachTurnMessage[] = [];
  const userMessage: CoachTurnMessage = {
    id: `classification-${Math.random().toString(36).slice(2)}`,
    role: 'user',
    content: args.message,
  };
  let classificationCalls = 0;
  let debug: CoachTurnDebug | null = null;
  const result = await handleCoachTurn({
    userMessage,
    messages,
    todayISO: TODAY,
    classifier: {
      classify: async () => {
        classificationCalls += 1;
        return args.classification;
      },
    },
    legacyFallbackPolicy: args.legacyFallbackPolicy,
    dispatchIntent: args.dispatch,
    pendingCoachProposal: null,
    pendingReadiness: null,
    pendingInjury: null,
    smokeCoachBikeFlow: false,
    isFocused: true,
    smokeWednesdayMissingReason: null,
    smokeWednesdayOpenTarget: null,
    setPendingCoachProposal: () => {},
    setPendingReadiness: () => {},
    appendUser: () => messages.push(userMessage),
    appendAssistant: (message) => messages.push(message),
    appendUserAndAssistant: (message) => messages.push(userMessage, message),
    clearInput: () => {},
    setIsLoading: () => {},
    setCoachProgressLabel: () => {},
    startSetupRebuildProgress: () => {},
    clearSetupRebuildProgress: () => {},
    setLastCoachDebug: (next) => { debug = next; },
    semanticProgramEditDraftMode: args.onSemanticMutationBoundary ? 'active' : 'off',
    semanticProgramEditDraftActiveAllowed: !!args.onSemanticMutationBoundary,
    semanticProgramEditDraftAdapter: args.onSemanticMutationBoundary
      ? {
          buildDraft: () => {
            args.onSemanticMutationBoundary?.();
            throw new Error('semantic mutation boundary must not run');
          },
        }
      : null,
    coachRevisionProposalMode: args.onSemanticMutationBoundary ? 'active' : 'off',
    coachRevisionProposalActiveAllowed: !!args.onSemanticMutationBoundary,
    coachRevisionProposalAdapter: args.onSemanticMutationBoundary
      ? {
          buildProposal: () => {
            args.onSemanticMutationBoundary?.();
            throw new Error('revision mutation boundary must not run');
          },
        }
      : null,
  });
  return { result, messages, classificationCalls, debug: debug as CoachTurnDebug | null };
}

(async () => {
  console.log('\n[1] Unavailable classification is locally handled');
  resetState();
  clearAthleteActionDiagnosticEvents();
  configureAthleteActionDiagnosticsForTests({
    enabled: true,
    production: false,
    now: () => new Date('2026-07-17T04:00:00.000Z'),
  });
  let dispatcherCalls = 0;
  let mutationBoundaryCalls = 0;
  let legacyCalls = 0;
  const before = programMutationSnapshot();
  const unavailable = await runController({
    message: 'private coach text that must never enter TraceV2',
    classification: { status: 'unavailable', reason: 'network_failure' },
    dispatch: async () => {
      dispatcherCalls += 1;
      throw new Error('dispatcher must not run');
    },
    onSemanticMutationBoundary: () => { mutationBoundaryCalls += 1; },
  });
  if (!unavailable.result.handled) legacyCalls += 1;
  const reply = unavailable.messages.find((message) => message.role === 'assistant')?.content;
  check('classification happens exactly once', unavailable.classificationCalls === 1);
  check('unavailable classification is handled', unavailable.result.handled === true);
  check('unavailable is an explicit handled outcome without a fabricated intent',
    unavailable.result.kind === 'handled' &&
      unavailable.result.selectedIntent === null &&
      unavailable.result.legacyFallbackAllowed === false &&
      unavailable.result.resultCode === 'classification_unavailable:network_failure',
    unavailable.result);
  check('service error reply is deterministic', reply === COACH_CLASSIFICATION_UNAVAILABLE_REPLY, reply);
  check('unavailable classification makes zero dispatcher calls', dispatcherCalls === 0);
  check('unavailable classification makes zero legacy calls', legacyCalls === 0);
  check('unavailable classification makes zero mutation-boundary calls', mutationBoundaryCalls === 0);
  check('unavailable classification leaves program state unchanged', before === programMutationSnapshot());
  check('debug records unavailability without a fabricated intent',
    unavailable.debug?.classificationStatus === 'unavailable' &&
      unavailable.debug.classificationUnavailableReason === 'network_failure' &&
      unavailable.debug.classifiedCoachIntent === null &&
      unavailable.debug.legacyCalled === false,
    unavailable.debug);

  const unavailableTrace = athleteActionTraceCoordinator.getRecords()[0];
  const unavailableEvidence = unavailableTrace?.evidence.coachClassification;
  check('TraceV2 records the unavailable reason code',
    unavailableEvidence?.status === 'captured' &&
      unavailableEvidence.value.status === 'unavailable' &&
      unavailableEvidence.value.unavailableReasonCode === 'network_failure' &&
      unavailableEvidence.value.intentKind === null);
  check('TraceV2 records classification-unavailable legacy ownership',
    unavailableTrace?.evidence.legacyFallbackDecision.status === 'captured' &&
      unavailableTrace.evidence.legacyFallbackDecision.value ===
        'forbidden:classification_unavailable');
  check('TraceV2 fabricates no accepted publication or durable mutation success',
    unavailableTrace?.evidence.publication.status === 'missing' &&
      unavailableTrace.evidence.semanticAcceptedAfter.status === 'missing' &&
      unavailableTrace.requestedTerminalOutcome.status === 'missing');
  check('TraceV2 does not claim React UI observation',
    unavailableTrace?.evidence.uiObservation.status === 'missing');
  const unavailableTraceJSON = JSON.stringify(unavailableTrace);
  check('TraceV2 stores no raw Coach text or rationale',
    !unavailableTraceJSON.includes('private coach text') &&
      !unavailableTraceJSON.includes('classifier rationale'));
  configureAthleteActionDiagnosticsForTests(null);
  clearAthleteActionDiagnosticEvents();

  console.log('\n[2] Genuine conversation remains eligible for legacy conversation');
  resetState();
  const conversationalIntent: CoachIntent = {
    intent: 'general_question',
    confidence: 0.93,
    needsClarification: false,
  };
  let conversationalDispatchIntent: CoachIntent | null = null;
  let conversationalClassification: CoachClassificationResult | null = null;
  const conversational = await runController({
    message: 'How should I approach recovery days?',
    classification: {
      status: 'classified',
      intent: conversationalIntent,
      provenance: 'semantic_service',
    },
    dispatch: async (intent, _packet, _deps, classification) => {
      conversationalDispatchIntent = intent;
      conversationalClassification = classification ?? null;
      return { handled: false, reply: '', mutated: false, replyMode: 'fall_through' };
    },
  });
  check('genuine general_question can fall through as conversation', conversational.result.handled === false);
  check('conversation outcome is explicitly legacy-eligible',
    conversational.result.kind === 'conversation' &&
      conversational.result.fallbackReason === 'genuine_conversation' &&
      conversational.result.legacyFallbackAllowed === true &&
      conversational.result.selectedIntent === conversationalIntent,
    conversational.result);
  check('conversation dispatcher receives the exact classified object',
    conversationalDispatchIntent === conversationalIntent);
  check('dispatcher receives the owning classification result',
    conversationalClassification?.status === 'classified' &&
      conversationalClassification.intent === conversationalIntent);
  check('conversation debug retains exact classified object',
    conversational.debug?.classifiedCoachIntent === conversationalIntent);

  console.log('\n[3] Intent identity survives routing and debug ownership');
  const identityCases: Array<{ label: string; intent: CoachIntent; message: string }> = [
    {
      label: 'fatigue',
      message: "I'm cooked today",
      intent: {
        intent: 'fatigue',
        confidence: 0.91,
        needsClarification: false,
        payload: { reportKind: 'cooked' },
      },
    },
    {
      label: 'injury',
      message: 'My hamstring hurts 4 out of 10',
      intent: {
        intent: 'new_injury_report',
        confidence: 0.94,
        needsClarification: false,
        payload: { bodyPart: 'hamstring', severity: 4 },
      },
    },
    {
      label: 'explanation',
      message: 'Why is that session there?',
      intent: {
        intent: 'program_explanation',
        confidence: 0.88,
        needsClarification: false,
      },
    },
    {
      label: 'program edit',
      message: 'Please adjust my program',
      intent: {
        intent: 'request_program_adjustment',
        confidence: 0.86,
        needsClarification: true,
        clarificationQuestion: 'What would you like to change?',
      },
    },
  ];
  for (const identityCase of identityCases) {
    resetState();
    let dispatched: CoachIntent | null = null;
    const result = await runController({
      message: identityCase.message,
      classification: {
        status: 'classified',
        intent: identityCase.intent,
        provenance: 'semantic_service',
      },
      dispatch: async (intent) => {
        dispatched = intent;
        return {
          handled: true,
          reply: 'Handled by identity test.',
          mutated: false,
          replyMode: 'safe_fallback',
        };
      },
    });
    check(`${identityCase.label} classifies once`, result.classificationCalls === 1);
    check(`${identityCase.label} debug retains object identity`,
      result.debug?.classifiedCoachIntent === identityCase.intent,
      result.debug);
    check(`${identityCase.label} routing never substitutes another intent object`,
      dispatched === null || dispatched === identityCase.intent);
  }

  console.log('\n[4] Successful classification is explicit TraceV2 evidence');
  resetState();
  clearAthleteActionDiagnosticEvents();
  configureAthleteActionDiagnosticsForTests({
    enabled: true,
    production: false,
    now: () => new Date('2026-07-17T04:00:00.000Z'),
  });
  const tracedIntent: CoachIntent = {
    intent: 'general_question',
    confidence: 0.84,
    needsClarification: true,
    clarificationQuestion: 'A safe question',
    rationale: 'classifier rationale must not be retained',
  };
  const tracedClassification = {
    status: 'classified' as const,
    intent: tracedIntent,
    provenance: 'semantic_service' as const,
  };
  const packet = buildCoachContextPacket({
    userMessage: 'trace-private successful Coach text',
    recentMessages: [],
    todayISO: TODAY,
  });
  await dispatchCoachIntent(
    tracedIntent,
    packet,
    buildLiveDispatchDeps(TODAY),
    tracedClassification,
  );
  const classifiedTrace = athleteActionTraceCoordinator.getRecords()[0];
  const classifiedEvidence = classifiedTrace?.evidence.coachClassification;
  check('TraceV2 records status, kind, bucket, clarification, and provenance',
    classifiedEvidence?.status === 'captured' &&
      classifiedEvidence.value.status === 'classified' &&
      classifiedEvidence.value.intentKind === 'general_question' &&
      classifiedEvidence.value.confidenceBucket === 'high' &&
      classifiedEvidence.value.clarificationFlag === true &&
      classifiedEvidence.value.provenance === 'semantic_service' &&
      classifiedEvidence.value.unavailableReasonCode === null,
    classifiedEvidence);
  const classifiedTraceJSON = JSON.stringify(classifiedTrace);
  check('successful TraceV2 stores neither raw text nor rationale',
    !classifiedTraceJSON.includes('trace-private') &&
      !classifiedTraceJSON.includes('classifier rationale'));

  const genuineConversationIntent: CoachIntent = {
    intent: 'general_question',
    confidence: 0.96,
    needsClarification: false,
  };
  const genuineConversationClassification: CoachClassificationResult = {
    status: 'classified',
    intent: genuineConversationIntent,
    provenance: 'semantic_service',
  };
  const fallThroughDispatch = async (): Promise<DispatchOutcome> => ({
    handled: false,
    reply: '',
    mutated: false,
    replyMode: 'fall_through',
  });
  const legacyBoundaryCalls = (
    result: Awaited<ReturnType<typeof runController>>['result'],
    policy: LegacyFallbackPolicy,
  ): number => result.kind === 'conversation' &&
    result.legacyFallbackAllowed === true &&
    policy === 'conversation_only'
      ? 1
      : 0;

  console.log('\n[5] Legacy fallback policy is explicit');
  resetState();
  configureAthleteActionDiagnosticsForTests({
    enabled: true,
    production: false,
    sink: () => {},
  });
  clearAthleteActionDiagnosticEvents();
  const conversationOnly = await runController({
    message: 'How should I approach recovery days?',
    classification: genuineConversationClassification,
    legacyFallbackPolicy: 'conversation_only',
    dispatch: fallThroughDispatch,
  });
  check('genuine general_question reaches the legacy boundary under conversation_only',
    legacyBoundaryCalls(conversationOnly.result, 'conversation_only') === 1,
    conversationOnly.result);
  const conversationTrace = conversationOnly.result.traceId
    ? athleteActionTraceCoordinator.getRecord(conversationOnly.result.traceId)
    : undefined;
  check('TraceV2 records allowed:genuine_conversation',
    conversationTrace?.evidence.legacyFallbackDecision.status === 'captured' &&
      conversationTrace.evidence.legacyFallbackDecision.value ===
        'allowed:genuine_conversation');

  resetState();
  clearAthleteActionDiagnosticEvents();
  const forbiddenConversation = await runController({
    message: 'How should I approach recovery days?',
    classification: genuineConversationClassification,
    legacyFallbackPolicy: 'forbid',
    dispatch: fallThroughDispatch,
  });
  check('forbid answers genuine conversation locally',
    forbiddenConversation.result.kind === 'handled' &&
      forbiddenConversation.result.legacyFallbackAllowed === false &&
      forbiddenConversation.messages.some((message) => message.role === 'assistant'),
    forbiddenConversation.result);
  check('forbid makes zero legacy calls',
    legacyBoundaryCalls(forbiddenConversation.result, 'forbid') === 0);
  const forbiddenTrace = forbiddenConversation.result.traceId
    ? athleteActionTraceCoordinator.getRecord(forbiddenConversation.result.traceId)
    : undefined;
  check('TraceV2 records forbidden:policy',
    forbiddenTrace?.evidence.legacyFallbackDecision.status === 'captured' &&
      forbiddenTrace.evidence.legacyFallbackDecision.value === 'forbidden:policy');

  console.log('\n[6] Executor result cannot surrender deterministic ownership');
  const deterministicCases: Array<{
    label: string;
    outcome: DispatchOutcome;
  }> = [
    {
      label: 'clarification',
      outcome: {
        handled: true,
        reply: 'Which session do you mean?',
        mutated: false,
        replyMode: 'program_adjustment_clarifier',
        transaction: {
          route: 'deterministic_clarification',
          pendingProposalBefore: null,
          mutationAttempted: false,
          eventsEmitted: 0,
          eventsApplied: 0,
          visibleDiff: [],
          replyMode: 'program_adjustment_clarifier',
        },
      },
    },
    {
      label: 'rejection',
      outcome: {
        handled: true,
        reply: 'That change is not safe.',
        mutated: false,
        replyMode: 'program_adjustment_failed',
        transaction: {
          route: 'deterministic_rejection',
          pendingProposalBefore: null,
          mutationAttempted: true,
          eventsEmitted: 1,
          eventsApplied: 0,
          visibleDiff: [],
          replyMode: 'program_adjustment_failed',
        },
      },
    },
    {
      label: 'no-change',
      outcome: {
        handled: true,
        reply: 'Your visible plan already matches that request.',
        mutated: false,
        replyMode: 'general_state_grounded',
        transaction: {
          route: 'deterministic_no_change',
          pendingProposalBefore: null,
          mutationAttempted: true,
          eventsEmitted: 1,
          eventsApplied: 0,
          visibleDiff: [],
          replyMode: 'general_state_grounded',
        },
      },
    },
    {
      label: 'revision-conflict',
      outcome: {
        handled: true,
        reply: 'Your plan changed, so I left it as is.',
        mutated: false,
        replyMode: 'program_adjustment_failed',
        transaction: {
          route: 'revision_conflict',
          pendingProposalBefore: null,
          mutationAttempted: true,
          eventsEmitted: 1,
          eventsApplied: 0,
          visibleDiff: [],
          replyMode: 'program_adjustment_failed',
        },
      },
    },
    {
      label: 'persistence-failure',
      outcome: {
        handled: true,
        reply: 'The change could not be saved, so nothing was published.',
        mutated: false,
        replyMode: 'program_adjustment_failed',
        transaction: {
          route: 'persistence_failure',
          pendingProposalBefore: null,
          mutationAttempted: true,
          eventsEmitted: 1,
          eventsApplied: 0,
          visibleDiff: [],
          replyMode: 'program_adjustment_failed',
        },
      },
    },
  ];
  for (const testCase of deterministicCases) {
    resetState();
    clearAthleteActionDiagnosticEvents();
    const deterministic = await runController({
      message: 'Please explain the safest next step.',
      classification: genuineConversationClassification,
      dispatch: async () => testCase.outcome,
    });
    check(`${testCase.label} remains handled`,
      deterministic.result.kind === 'handled' &&
        deterministic.result.legacyFallbackAllowed === false &&
        deterministic.result.resultCode === testCase.outcome.transaction?.route &&
        deterministic.result.reply === testCase.outcome.reply,
      deterministic.result);
    check(`${testCase.label} makes zero legacy calls`,
      legacyBoundaryCalls(deterministic.result, 'conversation_only') === 0);
    const deterministicTrace = deterministic.result.traceId
      ? athleteActionTraceCoordinator.getRecord(deterministic.result.traceId)
      : undefined;
    const expectedDecision = testCase.label === 'persistence-failure'
      ? 'forbidden:deterministic_failure'
      : 'forbidden:deterministic_owner';
    check(`${testCase.label} records the exact TraceV2 legacy decision`,
      deterministicTrace?.evidence.legacyFallbackDecision.status === 'captured' &&
        deterministicTrace.evidence.legacyFallbackDecision.value === expectedDecision);
  }

  resetState();
  clearAthleteActionDiagnosticEvents();
  const asyncException = await runController({
    message: 'Please explain the safest next step.',
    classification: genuineConversationClassification,
    dispatch: async () => {
      await Promise.resolve();
      throw new Error('private executor detail');
    },
  });
  check('unexpected async deterministic exception remains handled',
    asyncException.result.kind === 'handled' &&
      asyncException.result.resultCode === 'deterministic_failure:general_question' &&
      asyncException.result.legacyFallbackAllowed === false &&
      !asyncException.result.reply.includes('private executor detail'),
    asyncException.result);
  check('unexpected async deterministic exception makes zero legacy calls',
    legacyBoundaryCalls(asyncException.result, 'conversation_only') === 0);
  const asyncExceptionTrace = asyncException.result.traceId
    ? athleteActionTraceCoordinator.getRecord(asyncException.result.traceId)
    : undefined;
  check('TraceV2 records forbidden:deterministic_failure',
    asyncExceptionTrace?.evidence.legacyFallbackDecision.status === 'captured' &&
      asyncExceptionTrace.evidence.legacyFallbackDecision.value ===
        'forbidden:deterministic_failure');
  check('exception trace fabricates no publication evidence',
    asyncExceptionTrace?.evidence.publication.status === 'missing' &&
      asyncExceptionTrace.evidence.semanticAcceptedAfter.status === 'missing');

  console.log('\n[7] Classified deterministic domains never delegate');
  const deterministicDomainCases: Array<{ label: string; intent: CoachIntent; message: string }> = [
    {
      label: 'request_program_adjustment',
      message: 'Please adjust my program.',
      intent: {
        intent: 'request_program_adjustment',
        confidence: 0.95,
        needsClarification: true,
        clarificationQuestion: 'What change do you want?',
      },
    },
    {
      label: 'injury',
      message: 'My hamstring hurts.',
      intent: {
        intent: 'new_injury_report',
        confidence: 0.95,
        needsClarification: true,
        clarificationQuestion: 'How bad is it from 1 to 10?',
        payload: { bodyPart: 'hamstring' },
      },
    },
    {
      label: 'source-fact',
      message: 'I feel fatigued today.',
      intent: {
        intent: 'fatigue',
        confidence: 0.95,
        needsClarification: false,
        payload: { factKind: 'fatigue', reportKind: 'fatigue' },
      },
    },
  ];
  for (const testCase of deterministicDomainCases) {
    resetState();
    clearAthleteActionDiagnosticEvents();
    const deterministic = await runController({
      message: testCase.message,
      classification: {
        status: 'classified',
        intent: testCase.intent,
        provenance: 'semantic_service',
      },
    });
    check(`${testCase.label} remains handled and legacy-forbidden`,
      deterministic.result.kind === 'handled' &&
        deterministic.result.selectedIntent === testCase.intent &&
        deterministic.result.legacyFallbackAllowed === false &&
        legacyBoundaryCalls(deterministic.result, 'conversation_only') === 0,
      deterministic.result);
  }

  console.log('\n[8] Success copy and explicit ownership win over phrase diagnostics');
  resetState();
  clearAthleteActionDiagnosticEvents();
  const successfulReply = 'Done - the verified visible session is now shorter.';
  const successfulMutation = await runController({
    message: 'Please explain the safest next step.',
    classification: genuineConversationClassification,
    dispatch: async () => ({
      handled: true,
      reply: successfulReply,
      mutated: true,
      replyMode: 'program_adjustment_applied',
      transaction: {
        route: 'verified_success',
        pendingProposalBefore: null,
        mutationAttempted: true,
        eventsEmitted: 1,
        eventsApplied: 1,
        visibleDiff: ['duration reduced'],
        replyMode: 'program_adjustment_applied',
      },
    }),
  });
  check('successful deterministic reply remains unchanged',
    successfulMutation.result.kind === 'handled' &&
      successfulMutation.result.reply === successfulReply &&
      successfulMutation.messages.at(-1)?.content === successfulReply);

  resetState();
  clearAthleteActionDiagnosticEvents();
  const mutationLikeConversation = await runController({
    message: 'Could you change how you explain recovery?',
    classification: genuineConversationClassification,
    dispatch: fallThroughDispatch,
  });
  check('isMutationLike cannot override classified conversation ownership',
    mutationLikeConversation.result.kind === 'conversation' &&
      mutationLikeConversation.result.selectedIntent === genuineConversationIntent,
    mutationLikeConversation.result);

  console.log('\n[9] Concurrent controller turns retain explicit trace correlation');
  resetState();
  clearAthleteActionDiagnosticEvents();
  let arrivals = 0;
  let releaseExecutors!: () => void;
  let reportBothReached!: () => void;
  const executorsReleased = new Promise<void>((resolve) => {
    releaseExecutors = resolve;
  });
  const bothReached = new Promise<void>((resolve) => {
    reportBothReached = resolve;
  });
  const overlappingDispatch = async (): Promise<DispatchOutcome> => {
    arrivals += 1;
    if (arrivals === 2) reportBothReached();
    await executorsReleased;
    return fallThroughDispatch();
  };
  const firstConcurrent = runController({
    message: 'First recovery question',
    classification: genuineConversationClassification,
    dispatch: overlappingDispatch,
  });
  const secondConcurrent = runController({
    message: 'Second recovery question',
    classification: genuineConversationClassification,
    dispatch: overlappingDispatch,
  });
  await bothReached;
  releaseExecutors();
  const [firstConcurrentResult, secondConcurrentResult] = await Promise.all([
    firstConcurrent,
    secondConcurrent,
  ]);
  check('concurrent turns retain separate trace IDs',
    !!firstConcurrentResult.result.traceId &&
      !!secondConcurrentResult.result.traceId &&
      firstConcurrentResult.result.traceId !== secondConcurrentResult.result.traceId);
  check('each concurrent trace records its own legacy decision',
    [firstConcurrentResult.result.traceId, secondConcurrentResult.result.traceId]
      .every((traceId) => {
        const trace = traceId ? athleteActionTraceCoordinator.getRecord(traceId) : undefined;
        return trace?.evidence.legacyFallbackDecision.status === 'captured' &&
          trace.evidence.legacyFallbackDecision.value === 'allowed:genuine_conversation';
      }));

  console.log('\n[10] Scenario linkage and CoachScreen gate remain explicit');
  resetState();
  clearAthleteActionDiagnosticEvents();
  let priorActionTraceId: string | null = null;
  let scenarioStep = 0;
  installDevE2EScenarioActionBridge({
    claim: (request) => {
      if (request.source !== 'coach' || request.sourceSurface !== 'coach_intent_classification') {
        return null;
      }
      scenarioStep += 1;
      return {
        scenarioId: 'ownership-scenario',
        seedId: 'ownership-seed',
        scenarioStepId: `step-${scenarioStep}`,
        priorActionTraceId,
      };
    },
    registerTrace: (_claim, traceId) => {
      priorActionTraceId = traceId;
    },
  });
  const firstScenario = await runController({
    message: 'First linked question',
    classification: genuineConversationClassification,
    dispatch: fallThroughDispatch,
  });
  const secondScenario = await runController({
    message: 'Second linked question',
    classification: genuineConversationClassification,
    dispatch: fallThroughDispatch,
  });
  clearDevE2EScenarioActionBridge();
  const secondScenarioTrace = secondScenario.result.traceId
    ? athleteActionTraceCoordinator.getRecord(secondScenario.result.traceId)
    : undefined;
  check('scenario-session priorActionTraceId linkage remains intact',
    !!firstScenario.result.traceId &&
      secondScenarioTrace?.root.priorActionTraceId.status === 'captured' &&
      secondScenarioTrace.root.priorActionTraceId.value === firstScenario.result.traceId);

  const screenSource = readFileSync('src/screens/coach/CoachScreen.tsx', 'utf8');
  check('CoachScreen contains only the explicit discriminated legacy gate',
    /controllerResult\.kind !== 'conversation'[\s\S]*controllerResult\.legacyFallbackAllowed !== true[\s\S]*legacyFallbackPolicy !== 'conversation_only'/.test(screenSource) &&
      !/controllerResult\.handled/.test(screenSource) &&
      (screenSource.match(/controllerResult\.kind/g) ?? []).length === 1 &&
      (screenSource.match(/controllerResult\.legacyFallbackAllowed/g) ?? []).length === 1);

  configureAthleteActionDiagnosticsForTests(null);
  clearAthleteActionDiagnosticEvents();
  console.log(`\nCoach classification ownership: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})().catch((error) => {
  configureAthleteActionDiagnosticsForTests(null);
  console.error(error);
  process.exit(1);
});
