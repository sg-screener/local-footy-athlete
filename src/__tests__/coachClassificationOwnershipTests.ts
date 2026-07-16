/**
 * Permanent invariants for Single Classified Intent Ownership.
 *
 * Run: npm run test:coach-classification-ownership
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

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
  COACH_CLASSIFICATION_UNAVAILABLE_REPLY,
  handleCoachTurn,
  type CoachTurnDebug,
  type CoachTurnMessage,
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
  ) => Promise<DispatchOutcome>;
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

  configureAthleteActionDiagnosticsForTests(null);
  clearAthleteActionDiagnosticEvents();
  console.log(`\nCoach classification ownership: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})().catch((error) => {
  configureAthleteActionDiagnosticsForTests(null);
  console.error(error);
  process.exit(1);
});
