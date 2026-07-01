/**
 * coachSemanticProgramEditDraftControllerTests — Stage 3D-3A controller
 * wiring for semantic ProgramEditDraft parsing.
 *
 * This test stops at routing/finalisation boundaries. The semantic parser may
 * propose a draft, but execution still has to pass the existing ProgramEditDraft
 * front door and visible verifier.
 *
 * Run: ./node_modules/.bin/sucrase-node src/__tests__/coachSemanticProgramEditDraftControllerTests.ts
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { readFileSync } from 'fs';
import { buildSmokeCoachBikeFlowProgram } from '../data/smokeCoachBikeFlowProgram';
import { useCoachContextStateStore } from '../store/coachContextStateStore';
import { usePendingCoachClarifierStore } from '../store/pendingCoachClarifierStore';
import { useProgramStore } from '../store/programStore';
import type { CoachResolvedTarget } from '../utils/coachTargetFrame';
import {
  handleCoachTurn,
  type CoachTurnDebug,
  type CoachTurnMessage,
  type SemanticProgramEditDraftControllerDiagnostic,
  type SemanticProgramEditDraftMode,
} from '../utils/coachTurnController';
import type {
  ProgramEditDraft,
  ProgramEditDraftAction,
  ProgramEditDraftActionScope,
  ProgramEditDraftIntent,
  ProgramEditDraftTargetDomain,
  ProgramEditVerifierExpectation,
} from '../utils/coachProgramEditDraft';
import {
  SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA_VERSION,
  type SemanticProgramEditDraftAdapter,
  type SemanticProgramEditDraftAdapterInput,
} from '../utils/semanticProgramEditDraft';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import {
  extractVisibleProgramItemsFromWorkout,
  getResolvedVisibleProgramForDate,
} from '../utils/visibleProgramReadModel';

const TODAY = '2026-06-24';
const MONDAY = '2026-06-22';
const TUESDAY = '2026-06-23';
const WEDNESDAY = '2026-06-24';
const THURSDAY = '2026-06-25';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    pass++;
    console.log(`  PASS ${name}`);
  } else {
    fail++;
    const suffix = detail == null ? '' : `\n    ${typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2)}`;
    failures.push(`${name}${suffix}`);
    console.log(`  FAIL ${name}${suffix}`);
  }
}

function eq<T>(name: string, actual: T, expected: T) {
  ok(name, actual === expected, `expected ${String(expected)}, got ${String(actual)}`);
}

class RecordingSemanticAdapter implements SemanticProgramEditDraftAdapter {
  calls: SemanticProgramEditDraftAdapterInput[] = [];

  constructor(private readonly output: unknown | ((input: SemanticProgramEditDraftAdapterInput) => unknown)) {}

  buildDraft(input: SemanticProgramEditDraftAdapterInput): unknown {
    this.calls.push(input);
    if (this.output instanceof Function) return this.output(input);
    return this.output;
  }
}

class ThrowingSemanticAdapter implements SemanticProgramEditDraftAdapter {
  calls = 0;

  buildDraft(): unknown {
    this.calls++;
    throw new Error('semantic adapter unavailable');
  }
}

function seedSmokeProgram(todayISO = TODAY) {
  const program = buildSmokeCoachBikeFlowProgram(new Date(`${todayISO}T12:00:00`)) as any;
  const microcycle = program.microcycles[0];
  useProgramStore.getState().clear();
  useProgramStore.getState().setCurrentProgram(program);
  useProgramStore.getState().setCurrentMicrocycle(microcycle);
  useCoachContextStateStore.getState().clearCoachContext();
  usePendingCoachClarifierStore.getState().clearPending();
}

function sessionTarget(args: {
  date: string;
  sessionName: string;
  itemId: string;
  kind?: CoachResolvedTarget['kind'];
  itemTitle?: string;
  domain?: CoachResolvedTarget['domain'];
}): CoachResolvedTarget {
  return {
    kind: args.kind ?? 'session',
    date: args.date,
    sessionName: args.sessionName,
    itemId: args.itemId,
    itemTitle: args.itemTitle,
    domain: args.domain ?? 'session',
    stillVisible: true,
  };
}

function executableIntent(intent: ProgramEditDraftIntent): ProgramEditDraftAction['intent'] | null {
  if (intent === 'ask_question' || intent === 'explain') return null;
  if (intent === 'reduce') return 'edit';
  return intent;
}

function expectationsFor(
  actions: ProgramEditDraftAction[],
  protectedTargets: ProgramEditDraft['protectedTargets'],
): ProgramEditVerifierExpectation[] {
  return [
    ...actions.map((action): ProgramEditVerifierExpectation => ({
      kind: action.targetDomain === 'session' ? 'session_removed' : 'domain_changed',
      targetDomain: action.targetDomain,
      actionScope: action.actionScope,
      targetDate: action.targetDate,
      reason: action.reason,
    })),
    ...protectedTargets.map((target): ProgramEditVerifierExpectation => ({
      kind: 'domain_unchanged',
      targetDomain: target.targetDomain,
      actionScope: target.actionScope,
      targetDate: target.targetDate,
      reason: target.reason,
    })),
  ];
}

function draft(args: {
  wording: string;
  intent: ProgramEditDraftIntent;
  targetDomain: ProgramEditDraftTargetDomain;
  actionScope: ProgramEditDraftActionScope;
  targetDate: string | null;
  targetSessionId: string | null;
  targetItemId?: string | null;
  sourceTarget?: CoachResolvedTarget | null;
  protectedTargets?: ProgramEditDraft['protectedTargets'];
  isCompound?: boolean;
  proposedActions?: ProgramEditDraftAction[];
  missingFields?: string[];
  confidence?: number;
  reason?: string;
}): ProgramEditDraft {
  const sourceTarget = args.sourceTarget ?? null;
  const baseActionIntent = executableIntent(args.intent);
  const proposedActions = args.proposedActions ?? (baseActionIntent
    ? [{
        intent: baseActionIntent,
        targetDomain: args.targetDomain,
        actionScope: args.actionScope,
        targetDate: args.targetDate,
        targetSessionId: args.targetSessionId,
        targetItemId: args.targetItemId ?? null,
        sourceTarget,
        reason: args.reason ?? 'semantic_controller_action',
      }]
    : []);
  const protectedTargets = args.protectedTargets ?? [];
  return {
    intent: args.intent,
    targetDomain: args.targetDomain,
    actionScope: args.actionScope,
    targetDate: args.targetDate,
    targetSessionId: args.targetSessionId,
    targetItemId: args.targetItemId ?? null,
    sourceTarget,
    explicitDateRole: 'referent',
    explicitUserWording: args.wording,
    missingFields: args.missingFields ?? [],
    confidence: args.confidence ?? 0.88,
    protectedTargets,
    constraints: protectedTargets.map((target) => `keep ${target.targetDomain}:${target.actionScope ?? 'unknown'}`),
    proposedActions,
    verifierExpectations: expectationsFor(proposedActions, protectedTargets),
    isCompound: !!args.isCompound,
    reason: args.reason ?? 'semantic_controller_draft',
  };
}

function responseForDraft(value: ProgramEditDraft) {
  return {
    schemaVersion: SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA_VERSION,
    status: 'draft' as const,
    confidence: value.confidence,
    draft: value,
    reason: value.reason,
  };
}

function strengthBlockDraft(wording: string, targetDate = THURSDAY): ProgramEditDraft {
  return draft({
    wording,
    intent: wording.includes('easier') || wording.includes('lighter') ? 'reduce' : 'remove',
    targetDomain: 'strength',
    actionScope: 'strength_block',
    targetDate,
    targetSessionId: targetDate === MONDAY ? 'wk-smoke-dow-1' : 'wk-smoke-dow-4',
    sourceTarget: sessionTarget({
      date: targetDate,
      sessionName: targetDate === MONDAY ? 'Lower Body Strength' : 'Team Training',
      itemId: targetDate === MONDAY ? 'wk-smoke-dow-1' : 'wk-smoke-dow-4',
    }),
    protectedTargets: wording.includes('flush')
      ? [{
          targetDomain: 'conditioning',
          actionScope: 'conditioning_block',
          targetDate: WEDNESDAY,
          targetItemId: 'we-wk-smoke-wed-easy-flush',
          title: 'Easy Aerobic Flush',
          reason: 'semantic_keep_conditioning',
        }]
      : [],
    reason: 'semantic_controller_strength_block',
  });
}

function compoundTeamTrainingDraft(wording: string): ProgramEditDraft {
  const teamTarget = sessionTarget({
    date: TUESDAY,
    sessionName: 'Team Training',
    itemId: 'wk-smoke-dow-2',
  });
  const removeTeam: ProgramEditDraftAction = {
    intent: 'remove',
    targetDomain: 'session',
    actionScope: 'whole_session',
    targetDate: TUESDAY,
    targetSessionId: 'wk-smoke-dow-2',
    targetItemId: null,
    sourceTarget: teamTarget,
    reason: 'remove_team_training',
  };
  const addConditioning: ProgramEditDraftAction = {
    intent: 'add',
    targetDomain: 'conditioning',
    actionScope: 'conditioning_block',
    targetDate: TUESDAY,
    targetSessionId: null,
    targetItemId: null,
    sourceTarget: null,
    reason: 'add_easy_conditioning',
  };
  return draft({
    wording,
    intent: 'replace',
    targetDomain: 'session',
    actionScope: 'whole_session',
    targetDate: TUESDAY,
    targetSessionId: 'wk-smoke-dow-2',
    sourceTarget: teamTarget,
    isCompound: true,
    proposedActions: [removeTeam, addConditioning],
    reason: 'semantic_controller_compound_replace',
  });
}

function visibleSessionTarget(
  input: SemanticProgramEditDraftAdapterInput,
  sessionNamePart: string,
  fallbackDate = THURSDAY,
): CoachResolvedTarget {
  const day = input.visibleWeek.find((candidate) =>
    (candidate.workout?.name ?? '').toLowerCase().includes(sessionNamePart.toLowerCase()),
  );
  if (!day?.workout) {
    return sessionTarget({
      date: fallbackDate,
      sessionName: sessionNamePart,
      itemId: `missing-${sessionNamePart}`,
    });
  }
  return sessionTarget({
    date: day.date,
    sessionName: day.workout.name,
    itemId: (day.workout as any).id ?? day.workout.name,
  });
}

function visibleConditioningProtection(
  input: SemanticProgramEditDraftAdapterInput,
): ProgramEditDraft['protectedTargets'][number] | null {
  for (const day of input.visibleWeek) {
    const item = extractVisibleProgramItemsFromWorkout(day.workout)
      .find((candidate) => candidate.domain === 'conditioning');
    if (!item) continue;
    return {
      targetDomain: 'conditioning',
      actionScope: 'conditioning_block',
      targetDate: day.date,
      targetItemId: item.id,
      title: item.title,
      reason: 'semantic_keep_conditioning',
    };
  }
  return null;
}

function visibleItemsForDate(date: string) {
  const state = buildScheduleStateImperative();
  const programState = useProgramStore.getState();
  return getResolvedVisibleProgramForDate({
    date,
    todayISO: TODAY,
    state,
    overrideContext: programState.overrideContexts?.[date],
    overrideContexts: programState.overrideContexts,
  }).items;
}

function strengthBlockDraftFromVisibleContext(
  wording: string,
  input: SemanticProgramEditDraftAdapterInput,
): ProgramEditDraft {
  const sourceTarget = visibleSessionTarget(input, 'Lower Body Strength');
  const protectedTarget = visibleConditioningProtection(input);
  return draft({
    wording,
    intent: wording.includes('easier') || wording.includes('lighter') ? 'reduce' : 'remove',
    targetDomain: 'strength',
    actionScope: 'strength_block',
    targetDate: sourceTarget.date,
    targetSessionId: sourceTarget.itemId,
    sourceTarget,
    protectedTargets: wording.includes('flush') && protectedTarget ? [protectedTarget] : [],
    reason: 'semantic_controller_strength_block',
  });
}

function compoundTeamTrainingDraftFromVisibleContext(
  wording: string,
  input: SemanticProgramEditDraftAdapterInput,
): ProgramEditDraft {
  const teamTarget = visibleSessionTarget(input, 'Team Training');
  const removeTeam: ProgramEditDraftAction = {
    intent: 'remove',
    targetDomain: 'session',
    actionScope: 'whole_session',
    targetDate: teamTarget.date,
    targetSessionId: teamTarget.itemId,
    targetItemId: null,
    sourceTarget: teamTarget,
    reason: 'remove_team_training',
  };
  const addConditioning: ProgramEditDraftAction = {
    intent: 'add',
    targetDomain: 'conditioning',
    actionScope: 'conditioning_block',
    targetDate: teamTarget.date,
    targetSessionId: null,
    targetItemId: null,
    sourceTarget: null,
    reason: 'add_easy_conditioning',
  };
  return draft({
    wording,
    intent: 'replace',
    targetDomain: 'session',
    actionScope: 'whole_session',
    targetDate: teamTarget.date,
    targetSessionId: teamTarget.itemId,
    sourceTarget: teamTarget,
    isCompound: true,
    proposedActions: [removeTeam, addConditioning],
    reason: 'semantic_controller_compound_replace',
  });
}

async function runControllerTurn(args: {
  message: string;
  semanticEnabled?: boolean;
  semanticMode?: SemanticProgramEditDraftMode;
  semanticAdapter?: SemanticProgramEditDraftAdapter | null;
  seedPendingDuration?: boolean;
  seedPendingItem?: boolean;
}) {
  seedSmokeProgram();
  if (args.seedPendingDuration) {
    usePendingCoachClarifierStore.getState().setPending({
      operation: 'add_conditioning',
      partialPayload: { operation: 'add_conditioning', modality: null },
      scope: 'one_off',
      missingFields: ['duration'],
      originalMessage: 'Can you add conditioning?',
      askedQuestion: 'How long should it be?',
      pendingClarification: {
        originalIntent: 'add:conditioning:duration',
        missingField: 'duration',
        expectedAnswerType: 'duration',
        reason: 'test_pending_duration',
      },
    });
  }
  if (args.seedPendingItem) {
    usePendingCoachClarifierStore.getState().setPending({
      operation: 'remove_conditioning',
      partialPayload: { operation: 'remove_conditioning', modality: null },
      scope: 'one_off',
      missingFields: ['targetItemId'],
      originalMessage: 'Remove conditioning',
      askedQuestion: 'Which visible item should I change?',
      pendingClarification: {
        originalIntent: 'remove:conditioning:conditioning_block',
        missingField: 'targetItemId',
        expectedAnswerType: 'item',
        reason: 'test_pending_item',
      },
    });
  }

  const messages: CoachTurnMessage[] = [];
  let debug: CoachTurnDebug | null = null;
  let classifierCalls = 0;
  const diagnostics: SemanticProgramEditDraftControllerDiagnostic[] = [];
  const userMessage: CoachTurnMessage = {
    id: `turn-${Math.random().toString(36).slice(2)}`,
    role: 'user',
    content: args.message,
  };
  const handled = await handleCoachTurn({
    userMessage,
    messages,
    todayISO: TODAY,
    classifier: {
      classify: async () => {
        classifierCalls++;
        return {
          intent: 'conversation',
          confidence: 0,
          needsClarification: false,
        } as any;
      },
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
    appendUser: () => messages.push(userMessage),
    appendAssistant: (message) => messages.push(message),
    appendUserAndAssistant: (message) => messages.push(userMessage, message),
    clearInput: () => {},
    setIsLoading: () => {},
    setCoachProgressLabel: () => {},
    startSetupRebuildProgress: () => {},
    clearSetupRebuildProgress: () => {},
    setLastCoachDebug: (nextDebug) => {
      debug = nextDebug;
    },
    semanticProgramEditDraftMode: args.semanticMode,
    enableSemanticProgramEditDraft: args.semanticEnabled,
    semanticProgramEditDraftAdapter: args.semanticAdapter ?? null,
    semanticProgramEditDraftNowISO: `${TODAY}T12:00:00.000Z`,
    semanticProgramEditDraftTimezone: 'Australia/Melbourne',
    onSemanticProgramEditDraftDiagnostic: (diagnostic) => {
      diagnostics.push(diagnostic);
    },
  });

  return {
    handled,
    messages,
    reply: messages.filter((message) => message.role === 'assistant').at(-1)?.content ?? '',
    debug,
    classifierCalls,
    diagnostics,
    dateOverrides: useProgramStore.getState().dateOverrides,
  };
}

async function run() {
  console.log('coachSemanticProgramEditDraftControllerTests');

  {
    const adapter = new RecordingSemanticAdapter(responseForDraft(strengthBlockDraft("I'm cooked, bin the leg stuff tomorrow")));
    const offResult = await runControllerTurn({
      message: "I'm cooked, bin the leg stuff tomorrow",
      semanticEnabled: false,
      semanticAdapter: adapter,
    });
    eq('[1] semantic disabled does not call adapter', adapter.calls.length, 0);
    ok('[1] disabled path still completes without semantic routing',
      offResult.handled.handled === true || offResult.handled.handled === false,
      offResult);
  }

  {
    const adapter = new RecordingSemanticAdapter(responseForDraft(strengthBlockDraft("I'm cooked, bin the leg stuff tomorrow")));
    const result = await runControllerTurn({
      message: "I'm cooked, bin the leg stuff tomorrow",
      semanticEnabled: true,
      semanticAdapter: adapter,
    });
    eq('[2] semantic enabled calls adapter once', adapter.calls.length, 1);
    eq('[2] semantic front door returns before LLM legacy classifier', result.classifierCalls, 0);
    ok('[2] messy command is handled as a typed strength-block draft, not generic fallback',
      /strength-block edit/i.test(result.reply) &&
        /team training|game content/i.test(result.reply) &&
        !/\bdone\b|not sure|generic|I can help/i.test(result.reply),
      result.reply);
  }

  {
    const adapter = new RecordingSemanticAdapter((input) =>
      responseForDraft(strengthBlockDraftFromVisibleContext('Drop the lower work but keep the flush', input)),
    );
    const result = await runControllerTurn({
      message: 'Drop the lower work but keep the flush',
      semanticEnabled: true,
      semanticAdapter: adapter,
    });
    const targetDate = adapter.calls[0]?.visibleWeek.find((day) =>
      (day.workout?.name ?? '').toLowerCase().includes('lower body strength'),
    )?.date;
    const targetVisibleItems = targetDate ? visibleItemsForDate(targetDate) : [];
    const protectedDate = adapter.calls[0]?.visibleWeek.find((day) =>
      extractVisibleProgramItemsFromWorkout(day.workout)
        .some((item) => item.domain === 'conditioning'),
    )?.date;
    const protectedVisibleItems = protectedDate ? visibleItemsForDate(protectedDate) : [];
    ok('[3] semantic draft can carry protected conditioning target',
      adapter.calls.length === 1 &&
        /conditioning alone/i.test(result.reply) &&
        !targetVisibleItems.some((item) => item.domain === 'strength') &&
        protectedVisibleItems.some((item) => item.domain === 'conditioning'),
      { reply: result.reply, targetDate, targetVisibleItems, protectedDate, protectedVisibleItems });
  }

  {
    const adapter = new RecordingSemanticAdapter((input) =>
      responseForDraft(compoundTeamTrainingDraftFromVisibleContext("Can't make team training tonight, swap it for easy conditioning", input)),
    );
    const result = await runControllerTurn({
      message: "Can't make team training tonight, swap it for easy conditioning",
      semanticEnabled: true,
      semanticAdapter: adapter,
    });
    eq('[4] compound semantic draft returns before legacy classifier', result.classifierCalls, 0);
    ok('[4] compound draft is safely deferred, not generic fallback',
      /more than one program edit/i.test(result.reply) &&
        /remove-and-add compound edit/i.test(result.reply),
      result.reply);
  }

  {
    const needsDate = draft({
      wording: 'Bin the leg stuff',
      intent: 'remove',
      targetDomain: 'strength',
      actionScope: 'strength_block',
      targetDate: null,
      targetSessionId: 'wk-smoke-dow-4',
      missingFields: ['targetDate'],
      reason: 'semantic_controller_missing_date',
    });
    const adapter = new RecordingSemanticAdapter({
      schemaVersion: SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA_VERSION,
      status: 'clarify' as const,
      confidence: 0.84,
      draft: needsDate,
      clarificationQuestion: 'Which day should I apply that to?',
      candidateOptions: ['Today', 'Tomorrow'],
      reason: 'semantic_controller_clarify',
    });
    const result = await runControllerTurn({
      message: 'Bin the leg stuff',
      semanticEnabled: true,
      semanticAdapter: adapter,
    });
    const pending = usePendingCoachClarifierStore.getState().pending;
    ok('[5] semantic clarify stores typed pending slot',
      /which day/i.test(result.reply) &&
        pending?.pendingClarification?.missingField === 'targetDate' &&
        pending.pendingClarification.expectedAnswerType === 'date',
      { reply: result.reply, pending });
  }

  {
    const adapter = new RecordingSemanticAdapter(responseForDraft(strengthBlockDraft('yeah')));
    const result = await runControllerTurn({
      message: 'yeah',
      semanticEnabled: true,
      semanticAdapter: adapter,
      seedPendingDuration: true,
    });
    eq('[6] active pending clarification wins before semantic parser', adapter.calls.length, 0);
    ok('[6] pending answer gets interpreted relative to pending question',
      /how long/i.test(result.reply) || /time like/i.test(result.reply),
      result.reply);
  }

  {
    const adapter = new RecordingSemanticAdapter((input) =>
      responseForDraft(strengthBlockDraftFromVisibleContext('Drop the lower work but keep the flush', input)),
    );
    const result = await runControllerTurn({
      message: 'Drop the lower work but keep the flush',
      semanticEnabled: true,
      semanticAdapter: adapter,
      seedPendingItem: true,
    });
    eq('[6b] new mutation supersedes stale pending item question', adapter.calls.length, 1);
    ok('[6b] superseded pending item question does not trap new command',
      !/which visible item/i.test(result.reply) &&
        /strength work|strength-block edit/i.test(result.reply),
      result.reply);
    ok('[6b] stale pending item slot is cleared after new command',
      usePendingCoachClarifierStore.getState().pending == null,
      usePendingCoachClarifierStore.getState().pending);
  }

  {
    const adapter = new ThrowingSemanticAdapter();
    const result = await runControllerTurn({
      message: 'How are we looking today?',
      semanticEnabled: true,
      semanticAdapter: adapter,
    });
    eq('[7] adapter failure is contained', adapter.calls, 1);
    ok('[7] adapter failure does not claim success or mutate',
      !/\bdone\b/i.test(result.reply) && !/removed|added|moved/i.test(result.reply),
      result.reply);
  }

  {
    const adapter = new RecordingSemanticAdapter('{ this is not json }');
    const result = await runControllerTurn({
      message: 'Go on then',
      semanticEnabled: true,
      semanticAdapter: adapter,
    });
    eq('[8] malformed semantic JSON is attempted once', adapter.calls.length, 1);
    ok('[8] malformed semantic JSON falls back without success claim',
      !/\bdone\b/i.test(result.reply),
      result.reply);
  }

  {
    const message = "I'm cooked, bin the leg stuff tomorrow";
    const offAdapter = new RecordingSemanticAdapter(responseForDraft(strengthBlockDraft(message)));
    const offResult = await runControllerTurn({
      message,
      semanticMode: 'off',
      semanticAdapter: offAdapter,
    });
    const shadowAdapter = new RecordingSemanticAdapter(responseForDraft(strengthBlockDraft(message)));
    const shadowResult = await runControllerTurn({
      message,
      semanticMode: 'shadow',
      semanticAdapter: shadowAdapter,
    });
    eq('[9] shadow mode calls semantic adapter once for messy mutation-like message', shadowAdapter.calls.length, 1);
    eq('[9] off mode does not call semantic adapter even when adapter is injected', offAdapter.calls.length, 0);
    eq('[9] shadow mode does not change user-facing reply', shadowResult.reply, offResult.reply);
    ok('[9] shadow mode records draft diagnostics only',
      shadowResult.diagnostics.length === 1 &&
        shadowResult.diagnostics[0].mode === 'shadow' &&
        shadowResult.diagnostics[0].kind === 'draft' &&
        shadowResult.diagnostics[0].draft?.targetDomain === 'strength',
      shadowResult.diagnostics);
    ok('[9] shadow adapter receives grounded time and visible context',
      shadowAdapter.calls[0]?.todayISO === TODAY &&
        shadowAdapter.calls[0]?.nowISO === `${TODAY}T12:00:00.000Z` &&
        shadowAdapter.calls[0]?.timezone === 'Australia/Melbourne' &&
        (shadowAdapter.calls[0]?.visibleWeek.length ?? 0) > 0,
      shadowAdapter.calls[0]);
    ok('[9] shadow mode does not mutate through semantic draft',
      Object.keys(shadowResult.dateOverrides ?? {}).length === Object.keys(offResult.dateOverrides ?? {}).length,
      { off: offResult.dateOverrides, shadow: shadowResult.dateOverrides });
  }

  {
    const message = 'Drop the lower work but keep the flush';
    const offResult = await runControllerTurn({
      message,
      semanticMode: 'off',
      semanticAdapter: new RecordingSemanticAdapter((input) =>
        responseForDraft(strengthBlockDraftFromVisibleContext(message, input)),
      ),
    });
    const adapter = new RecordingSemanticAdapter((input) =>
      responseForDraft(strengthBlockDraftFromVisibleContext(message, input)),
    );
    const shadowResult = await runControllerTurn({
      message,
      semanticMode: 'shadow',
      semanticAdapter: adapter,
    });
    eq('[10] shadow protected-target draft does not change reply', shadowResult.reply, offResult.reply);
    ok('[10] shadow diagnostics expose protected conditioning without executing',
      shadowResult.diagnostics[0]?.draft?.targetDomain === 'strength' &&
        adapter.calls.length === 1 &&
        !/leaving conditioning alone/i.test(shadowResult.reply),
      { diagnostics: shadowResult.diagnostics, reply: shadowResult.reply });
  }

  {
    const message = "Can't make team training tonight, swap it for easy conditioning";
    const offResult = await runControllerTurn({
      message,
      semanticMode: 'off',
      semanticAdapter: new RecordingSemanticAdapter((input) =>
        responseForDraft(compoundTeamTrainingDraftFromVisibleContext(message, input)),
      ),
    });
    const adapter = new RecordingSemanticAdapter((input) =>
      responseForDraft(compoundTeamTrainingDraftFromVisibleContext(message, input)),
    );
    const shadowResult = await runControllerTurn({
      message,
      semanticMode: 'shadow',
      semanticAdapter: adapter,
    });
    eq('[11] shadow compound draft does not change reply', shadowResult.reply, offResult.reply);
    ok('[11] shadow compound draft is diagnostics-only',
      adapter.calls.length === 1 &&
        shadowResult.diagnostics[0]?.draft?.isCompound === true,
      shadowResult.diagnostics);
  }

  {
    const message = 'yeah';
    const adapter = new RecordingSemanticAdapter(responseForDraft(strengthBlockDraft(message)));
    const result = await runControllerTurn({
      message,
      semanticMode: 'shadow',
      semanticAdapter: adapter,
      seedPendingDuration: true,
    });
    eq('[12] active pending clarification resolves before shadow semantic parser', adapter.calls.length, 0);
    eq('[12] no shadow diagnostics emitted for pending answer', result.diagnostics.length, 0);
  }

  {
    const message = 'remove conditioning today';
    const offResult = await runControllerTurn({
      message,
      semanticMode: 'off',
      semanticAdapter: new RecordingSemanticAdapter('{ this is not json }'),
    });
    const adapter = new RecordingSemanticAdapter('{ this is not json }');
    const shadowResult = await runControllerTurn({
      message,
      semanticMode: 'shadow',
      semanticAdapter: adapter,
    });
    eq('[13] shadow malformed JSON does not change reply', shadowResult.reply, offResult.reply);
    ok('[13] shadow malformed JSON is captured as invalid diagnostic',
      shadowResult.diagnostics.length === 1 &&
        shadowResult.diagnostics[0].kind === 'invalid',
      shadowResult.diagnostics);
  }

  {
    const message = 'How are we looking today?';
    const offResult = await runControllerTurn({
      message,
      semanticMode: 'off',
      semanticAdapter: new ThrowingSemanticAdapter(),
    });
    const adapter = new ThrowingSemanticAdapter();
    const shadowResult = await runControllerTurn({
      message,
      semanticMode: 'shadow',
      semanticAdapter: adapter,
    });
    eq('[14] shadow mode skips non-mutation conversation messages', adapter.calls, 0);
    eq('[14] non-mutation shadow reply matches off reply', shadowResult.reply, offResult.reply);
  }

  {
    const invalidDraft = responseForDraft(draft({
      wording: 'remove that',
      intent: 'remove',
      targetDomain: 'conditioning',
      actionScope: 'conditioning_block',
      targetDate: WEDNESDAY,
      targetSessionId: 'invented-session',
      targetItemId: 'invented-item',
      reason: 'semantic_invented_target',
    }));
    const adapter = new RecordingSemanticAdapter(invalidDraft);
    const result = await runControllerTurn({
      message: 'remove that',
      semanticMode: 'shadow',
      semanticAdapter: adapter,
    });
    ok('[15] shadow semantic output cannot bypass target/id validation',
      adapter.calls.length === 1 &&
        result.diagnostics[0]?.kind === 'invalid' &&
        result.diagnostics[0].issues?.some((issue) => /not present in the target frame or visible week/i.test(issue)),
      result.diagnostics);
    ok('[15] invalid shadow semantic output does not claim success',
      !/\bdone\b/i.test(result.reply),
      result.reply);
  }

  {
    const controllerSource = readFileSync('src/utils/coachTurnController.ts', 'utf8');
    const semanticIndex = controllerSource.indexOf('const semanticDraftResult = await buildSemanticProgramEditDraftForController');
    const routedIndex = controllerSource.indexOf('const routedProgramEdit = semanticProgramEditForExecution ?? interpretCoachMessageToProgramEdit');
    const guardIndex = controllerSource.indexOf('executeProgramEditWithVisibleGuard({', routedIndex);
    ok('[16] semantic draft is built before legacy router compatibility',
      semanticIndex > -1 && routedIndex > semanticIndex,
      { semanticIndex, routedIndex });
    ok('[16] semantic draft execution still goes through visible verifier',
      guardIndex > routedIndex &&
        /executeProgramEditWithVisibleGuard\(\{[\s\S]*draft: packet\.programEditDraft/.test(controllerSource.slice(guardIndex, guardIndex + 500)),
      controllerSource.slice(guardIndex, guardIndex + 500));
  }
}

run()
  .then(() => {
    console.log(`\n— Summary —`);
    console.log(`  Pass: ${pass}`);
    console.log(`  Fail: ${fail}`);
    if (fail > 0) {
      console.log(`\n— Failures —`);
      for (const f of failures) console.log(`  • ${f}`);
      process.exit(1);
    }
    process.exit(0);
  })
  .catch((err) => {
    fail++;
    const detail = err instanceof Error ? err.stack ?? err.message : String(err);
    failures.push(`test runner threw\n      ${detail}`);
    console.log(`\n— Summary —`);
    console.log(`  Pass: ${pass}`);
    console.log(`  Fail: ${fail}`);
    console.log(`\n— Failures —`);
    for (const f of failures) console.log(`  • ${f}`);
    process.exit(1);
  });
