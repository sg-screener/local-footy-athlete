import type { ResolvedDay } from './sessionResolver';
import type {
  CoachResolvedTarget,
  CoachTargetFrame,
  CoachExplicitDateRole,
} from './coachTargetFrame';
import type { PendingScheduleTransaction } from '../store/pendingCoachClarifierStore';

export type ProgramEditDraftIntent =
  | 'add'
  | 'edit'
  | 'remove'
  | 'replace'
  | 'move'
  | 'reduce'
  | 'explain'
  | 'ask_question';

export type ProgramEditDraftTargetDomain =
  | 'strength'
  | 'conditioning'
  | 'session'
  | 'recovery'
  | 'setup'
  | 'schedule';

export type ProgramEditDraftActionScope =
  | 'whole_session'
  | 'strength_block'
  | 'conditioning_block'
  | 'exercise'
  | 'duration'
  | 'intensity'
  | 'modality'
  | 'setup';

export interface ProgramEditDraftProtectedTarget {
  targetDomain: ProgramEditDraftTargetDomain;
  actionScope?: ProgramEditDraftActionScope;
  targetDate?: string | null;
  targetItemId?: string | null;
  title?: string | null;
  reason: string;
}

export interface ProgramEditDraftAction {
  intent: Exclude<ProgramEditDraftIntent, 'ask_question' | 'explain'>;
  targetDomain: ProgramEditDraftTargetDomain;
  actionScope: ProgramEditDraftActionScope;
  targetDate: string | null;
  targetSessionId: string | null;
  targetItemId: string | null;
  sourceTarget: CoachResolvedTarget | null;
  reason: string;
}

export type ProgramEditVerifierExpectationKind =
  | 'domain_changed'
  | 'domain_unchanged'
  | 'session_removed'
  | 'item_added'
  | 'ask_before_execution';

export interface ProgramEditVerifierExpectation {
  kind: ProgramEditVerifierExpectationKind;
  targetDomain?: ProgramEditDraftTargetDomain;
  actionScope?: ProgramEditDraftActionScope;
  targetDate?: string | null;
  reason: string;
}

export interface ProgramEditDraft {
  intent: ProgramEditDraftIntent;
  targetDomain: ProgramEditDraftTargetDomain;
  actionScope: ProgramEditDraftActionScope;
  targetDate: string | null;
  targetSessionId: string | null;
  targetItemId: string | null;
  sourceTarget: CoachResolvedTarget | null;
  explicitDateRole: CoachExplicitDateRole;
  explicitUserWording: string;
  missingFields: string[];
  confidence: number;
  protectedTargets: ProgramEditDraftProtectedTarget[];
  constraints: string[];
  proposedActions: ProgramEditDraftAction[];
  verifierExpectations: ProgramEditVerifierExpectation[];
  isCompound: boolean;
  reason: string;
}

export interface BuildProgramEditDraftInput {
  userMessage: string;
  targetFrame?: CoachTargetFrame | null;
  visibleWeek?: ResolvedDay[];
  currentProgramContext?: unknown;
  pendingTransaction?: PendingScheduleTransaction | null;
}

export type ProgramEditDraftFrontDoorDecision =
  | {
      kind: 'allow_conversation';
      route: 'program_edit_draft_conversation';
    }
  | {
      kind: 'allow_compatibility';
      route: 'program_edit_draft_compatibility';
    }
  | {
      kind: 'ask_clarification';
      route: string;
      reply: string;
      options?: string[];
    }
  | {
      kind: 'unsupported';
      route: string;
      reply: string;
      options?: string[];
    };

type DomainSignal = {
  domain: ProgramEditDraftTargetDomain;
  scope: ProgramEditDraftActionScope;
  reason: string;
};

const REMOVE_RE =
  /\b(?:remove|drop|ditch|scrap|skip|cancel|cut|delete|take\s+out|get\s+rid\s+of|don'?t\s+do)\b/i;
const ADD_RE =
  /\b(?:add|include|put\s+in|slot\s+in|chuck|throw\s+in|tack\s+on)\b/i;
const MOVE_RE =
  /\b(?:move|shift|push|bump|reschedule|switch|put)\b/i;
const REPLACE_RE =
  /\b(?:replace|swap|instead|rather\s+than|substitute)\b/i;
const REDUCE_RE =
  /\b(?:reduce|easier|lighter|lower[-\s]*load|back\s+(?:it\s+)?off|deload|less|cooked|fried|flat|sore|tired)\b/i;
const EXPLAIN_RE =
  /\b(?:why|what|explain|show|tell\s+me)\b/i;

const WHOLE_SESSION_RE =
  /\b(?:whole|full|entire|all\s+of\s+(?:today'?s\s+)?(?:session|workout)|session|workout)\b/i;
const STRENGTH_RE =
  /\b(?:strength|lower[-\s]*body|upper[-\s]*body|lower\s+strength|upper\s+strength|leg(?:s)?(?:\s+work)?|gym|lifting|weights?)\b/i;
const CONDITIONING_RE =
  /\b(?:conditioning|cardio|aerobic|flush|row(?:er|ing)?|bike|run(?:ning)?|sprint(?:s|ing)?|tempo|intervals?|hiit|ski\s*erg|erg)\b/i;
const RECOVERY_RE =
  /\b(?:recovery|mobility|stretch|yoga|pilates)\b/i;
const SETUP_RE =
  /\b(?:setup|availability|available|can\s+(?:now\s+)?train|training\s+days?|days?\s+(?:a|per)\s+week)\b/i;

export function buildProgramEditDraft(
  input: BuildProgramEditDraftInput,
): ProgramEditDraft {
  const explicitUserWording = String(input.userMessage ?? '').trim();
  const message = explicitUserWording.toLowerCase();
  const sourceTarget = input.targetFrame?.resolvedTarget ?? null;
  const explicitDateRole = input.targetFrame?.explicitDateRole ?? 'none';
  const targetFrameAmbiguous = input.targetFrame?.targetSource === 'ambiguous';
  const targetDate = targetFrameAmbiguous
    ? null
    : sourceTarget?.date ?? inferTodayFromVisibleWeek(input.visibleWeek ?? []);
  const targetSessionId = inferTargetSessionId({
    sourceTarget,
    targetDate,
    visibleWeek: input.visibleWeek ?? [],
  });
  const targetItemId = sourceTarget?.itemId ?? null;

  const intent = classifyIntent(message);
  const signals = classifyDomainSignals(message, sourceTarget);
  const protectedTargets = buildProtectedTargets({
    message,
    targetDate,
    primary: signals[0],
  });
  const isCompound = shouldBuildCompoundDraft(message, signals, intent);
  const proposedActions = buildProposedActions({
    message,
    intent,
    signals,
    isCompound,
    targetDate,
    targetSessionId,
    targetItemId,
    sourceTarget,
  });
  const primary = signals[0] ?? fallbackSignalForIntent(intent, sourceTarget);
  const missingFields = missingFieldsForDraft({
    intent,
    targetDate,
    sourceTarget,
    targetFrameAmbiguous,
    proposedActions,
  });

  return {
    intent,
    targetDomain: primary.domain,
    actionScope: primary.scope,
    targetDate,
    targetSessionId,
    targetItemId,
    sourceTarget,
    explicitDateRole,
    explicitUserWording,
    missingFields,
    confidence: confidenceForDraft({
      intent,
      signals,
      sourceTarget,
      missingFields,
      isCompound,
    }),
    protectedTargets,
    constraints: constraintsFromProtectedTargets(protectedTargets),
    proposedActions,
    verifierExpectations: buildVerifierExpectations({
      proposedActions,
      protectedTargets,
      intent,
      targetDate,
    }),
    isCompound,
    reason: reasonForDraft({ intent, primary, isCompound, sourceTarget }),
  };
}

export function decideProgramEditDraftFrontDoor(
  draft: ProgramEditDraft | null | undefined,
): ProgramEditDraftFrontDoorDecision {
  if (!draft) {
    return { kind: 'allow_compatibility', route: 'program_edit_draft_compatibility' };
  }

  if (draft.intent === 'ask_question' || draft.intent === 'explain') {
    return { kind: 'allow_conversation', route: 'program_edit_draft_conversation' };
  }

  if (draft.missingFields.length > 0) {
    return {
      kind: 'ask_clarification',
      route: `program_edit_draft_missing:${draft.missingFields.join(',')}`,
      reply: clarificationForDraftMissingFields(draft),
      options: clarificationOptionsForDraft(draft),
    };
  }

  if (draft.isCompound) {
    return {
      kind: 'unsupported',
      route: 'program_edit_draft_compound_deferred',
      reply:
        "I understood that as more than one program edit. I can't safely apply a remove-and-add compound edit in one turn yet. Pick one change first: remove the source session, add conditioning, or leave it unchanged.",
      options: ['Remove source session', 'Add conditioning', 'Leave unchanged'],
    };
  }

  if (
    draft.targetDomain === 'strength' &&
    draft.actionScope === 'strength_block' &&
    (draft.intent === 'remove' || draft.intent === 'reduce')
  ) {
    const verb = draft.intent === 'remove' ? 'remove' : 'reduce';
    return {
      kind: 'unsupported',
      route: `program_edit_draft_strength_block_${draft.intent}_deferred`,
      reply:
        `I understood that as a request to ${verb} the strength block while leaving conditioning alone. ` +
        "I can't safely apply that block-level strength edit yet. Choose a specific exercise, remove the whole session, or leave it unchanged.",
      options: ['Choose an exercise', 'Remove whole session', 'Leave unchanged'],
    };
  }

  return { kind: 'allow_compatibility', route: 'program_edit_draft_compatibility' };
}

function classifyIntent(message: string): ProgramEditDraftIntent {
  const hasRemove = REMOVE_RE.test(message);
  const hasAdd = ADD_RE.test(message);
  if (hasRemove && hasAdd) return 'replace';
  if (hasRemove) return 'remove';
  if (REPLACE_RE.test(message)) return 'replace';
  if (MOVE_RE.test(message)) return 'move';
  if (hasAdd) return 'add';
  if (REDUCE_RE.test(message)) return 'reduce';
  if (/\b(?:make|change|adjust|set)\b/i.test(message)) return 'edit';
  if (EXPLAIN_RE.test(message)) return 'explain';
  return 'ask_question';
}

function classifyDomainSignals(
  message: string,
  sourceTarget: CoachResolvedTarget | null,
): DomainSignal[] {
  const signals: DomainSignal[] = [];

  if (sourceTarget && REMOVE_RE.test(message) && ADD_RE.test(message)) {
    signals.push(signalFromSourceTarget(sourceTarget));
  }

  if (SETUP_RE.test(message)) {
    signals.push({ domain: 'setup', scope: 'setup', reason: 'explicit_setup_language' });
  }

  const sessionExplicit =
    WHOLE_SESSION_RE.test(message) &&
    !/\b(?:strength|conditioning|lower[-\s]*body|upper[-\s]*body)\b/i.test(message);
  if (sessionExplicit) {
    signals.push({ domain: 'session', scope: 'whole_session', reason: 'explicit_whole_session' });
  }

  if (STRENGTH_RE.test(message)) {
    signals.push({ domain: 'strength', scope: 'strength_block', reason: 'explicit_strength_language' });
  }

  if (CONDITIONING_RE.test(message)) {
    signals.push({ domain: 'conditioning', scope: 'conditioning_block', reason: 'explicit_conditioning_language' });
  }

  if (RECOVERY_RE.test(message) && !signals.some((s) => s.domain === 'conditioning')) {
    signals.push({ domain: 'recovery', scope: 'conditioning_block', reason: 'explicit_recovery_language' });
  }

  if (signals.length === 0 && sourceTarget) {
    signals.push(signalFromSourceTarget(sourceTarget));
  }

  return dedupeSignals(signals);
}

function fallbackSignalForIntent(
  intent: ProgramEditDraftIntent,
  sourceTarget: CoachResolvedTarget | null,
): DomainSignal {
  if (sourceTarget) return signalFromSourceTarget(sourceTarget);
  if (intent === 'move') {
    return { domain: 'schedule', scope: 'whole_session', reason: 'move_without_domain' };
  }
  return { domain: 'session', scope: 'whole_session', reason: 'fallback_session' };
}

function signalFromSourceTarget(target: CoachResolvedTarget): DomainSignal {
  if (target.domain === 'conditioning' || target.kind === 'conditioning_item') {
    return { domain: 'conditioning', scope: 'conditioning_block', reason: 'source_target_conditioning' };
  }
  if (target.domain === 'strength' || target.kind === 'exercise') {
    return { domain: 'strength', scope: 'exercise', reason: 'source_target_strength' };
  }
  if (target.domain === 'schedule') {
    return { domain: 'schedule', scope: 'whole_session', reason: 'source_target_schedule' };
  }
  return { domain: 'session', scope: 'whole_session', reason: 'source_target_session' };
}

function buildProtectedTargets(args: {
  message: string;
  targetDate: string | null;
  primary?: DomainSignal;
}): ProgramEditDraftProtectedTarget[] {
  const out: ProgramEditDraftProtectedTarget[] = [];
  const addProtected = (
    targetDomain: ProgramEditDraftTargetDomain,
    reason: string,
    actionScope?: ProgramEditDraftActionScope,
  ) => {
    if (out.some((target) => target.targetDomain === targetDomain && target.reason === reason)) return;
    out.push({
      targetDomain,
      actionScope,
      targetDate: args.targetDate,
      targetItemId: null,
      title: null,
      reason,
    });
  };

  if (/\b(?:keep|leave|preserve)\b[^.?!,;]*(?:conditioning|cardio|aerobic|row|bike|run|flush)/i.test(args.message)) {
    addProtected('conditioning', 'explicit_keep_conditioning', 'conditioning_block');
  }

  if (
    args.primary?.domain === 'strength' &&
    (REMOVE_RE.test(args.message) || REDUCE_RE.test(args.message)) &&
    !CONDITIONING_RE.test(args.message)
  ) {
    addProtected('conditioning', 'strength_edit_preserves_conditioning_by_default', 'conditioning_block');
  }

  return out;
}

function shouldBuildCompoundDraft(
  message: string,
  signals: DomainSignal[],
  intent: ProgramEditDraftIntent,
): boolean {
  if (signals.length > 1 && (/\band\b/i.test(message) || intent === 'replace')) return true;
  return intent === 'replace' && REMOVE_RE.test(message) && ADD_RE.test(message);
}

function buildProposedActions(args: {
  message: string;
  intent: ProgramEditDraftIntent;
  signals: DomainSignal[];
  isCompound: boolean;
  targetDate: string | null;
  targetSessionId: string | null;
  targetItemId: string | null;
  sourceTarget: CoachResolvedTarget | null;
}): ProgramEditDraftAction[] {
  const executableIntent = executableIntentFromDraftIntent(args.intent);
  if (!executableIntent) return [];

  const actionSignals =
    args.signals.length > 0
      ? args.signals
      : [fallbackSignalForIntent(args.intent, args.sourceTarget)];
  const selectedSignals = args.isCompound ? actionSignals : [actionSignals[0]];

  const removeThenAdd =
    args.intent === 'replace' && REMOVE_RE.test(args.message) && ADD_RE.test(args.message);
  const actions = selectedSignals.map((signal): ProgramEditDraftAction => {
    const actionIntent: ProgramEditDraftAction['intent'] =
      removeThenAdd && signal.domain === 'conditioning'
        ? 'add'
        : removeThenAdd
          ? 'remove'
          : executableIntent;
    return {
      intent: actionIntent,
      targetDomain: signal.domain,
      actionScope: signal.scope,
      targetDate: args.targetDate,
      targetSessionId: args.targetSessionId,
      targetItemId: actionIntent === 'add' ? null : args.targetItemId,
      sourceTarget: args.sourceTarget,
      reason: signal.reason,
    };
  });

  if (
    removeThenAdd &&
    !actions.some((action) => action.targetDomain === 'conditioning') &&
    CONDITIONING_RE.test(args.message)
  ) {
    actions.push({
      intent: 'add',
      targetDomain: 'conditioning',
      actionScope: 'conditioning_block',
      targetDate: args.targetDate,
      targetSessionId: args.targetSessionId,
      targetItemId: null,
      sourceTarget: args.sourceTarget,
      reason: 'compound_replacement_conditioning',
    });
  }

  return actions;
}

function executableIntentFromDraftIntent(
  intent: ProgramEditDraftIntent,
): ProgramEditDraftAction['intent'] | null {
  if (intent === 'ask_question' || intent === 'explain') return null;
  if (intent === 'reduce') return 'edit';
  return intent;
}

function missingFieldsForDraft(args: {
  intent: ProgramEditDraftIntent;
  targetDate: string | null;
  sourceTarget: CoachResolvedTarget | null;
  targetFrameAmbiguous: boolean;
  proposedActions: ProgramEditDraftAction[];
}): string[] {
  if (args.intent === 'ask_question' || args.intent === 'explain') return [];
  const missing: string[] = [];
  if (args.targetFrameAmbiguous) missing.push('target');
  if (!args.targetDate) missing.push('targetDate');
  if (args.intent === 'move' && !args.sourceTarget) missing.push('sourceTarget');
  if (args.proposedActions.length === 0) missing.push('action');
  return missing;
}

function clarificationForDraftMissingFields(draft: ProgramEditDraft): string {
  if (draft.missingFields.includes('target')) {
    return 'Which session or day should I apply that edit to?';
  }
  if (draft.missingFields.includes('targetDate')) {
    return 'Which day should I apply that edit to?';
  }
  if (draft.missingFields.includes('sourceTarget')) {
    return 'Which session should I move?';
  }
  return 'What exactly should I change?';
}

function clarificationOptionsForDraft(draft: ProgramEditDraft): string[] | undefined {
  if (draft.missingFields.includes('sourceTarget')) {
    return ['Today', 'Tomorrow', 'Choose another day'];
  }
  if (draft.missingFields.includes('target') || draft.missingFields.includes('targetDate')) {
    return ['Today', 'Tomorrow', 'Choose another day'];
  }
  return undefined;
}

function confidenceForDraft(args: {
  intent: ProgramEditDraftIntent;
  signals: DomainSignal[];
  sourceTarget: CoachResolvedTarget | null;
  missingFields: string[];
  isCompound: boolean;
}): number {
  if (args.missingFields.length > 0) return 0.45;
  if (args.intent === 'ask_question') return 0.3;
  if (args.signals.length > 0 && args.sourceTarget) return args.isCompound ? 0.82 : 0.88;
  if (args.signals.length > 0) return args.isCompound ? 0.76 : 0.82;
  if (args.sourceTarget) return 0.72;
  return 0.55;
}

function constraintsFromProtectedTargets(
  protectedTargets: ProgramEditDraftProtectedTarget[],
): string[] {
  return protectedTargets.map((target) =>
    `keep ${target.targetDomain}${target.actionScope ? `:${target.actionScope}` : ''}`,
  );
}

function buildVerifierExpectations(args: {
  proposedActions: ProgramEditDraftAction[];
  protectedTargets: ProgramEditDraftProtectedTarget[];
  intent: ProgramEditDraftIntent;
  targetDate: string | null;
}): ProgramEditVerifierExpectation[] {
  const expectations: ProgramEditVerifierExpectation[] = [];
  for (const action of args.proposedActions) {
    expectations.push({
      kind: action.targetDomain === 'session' && action.actionScope === 'whole_session'
        ? 'session_removed'
        : 'domain_changed',
      targetDomain: action.targetDomain,
      actionScope: action.actionScope,
      targetDate: action.targetDate,
      reason: `${action.intent}_${action.targetDomain}_${action.actionScope}`,
    });
  }
  for (const target of args.protectedTargets) {
    expectations.push({
      kind: 'domain_unchanged',
      targetDomain: target.targetDomain,
      actionScope: target.actionScope,
      targetDate: target.targetDate ?? args.targetDate,
      reason: target.reason,
    });
  }
  if (args.intent === 'ask_question') {
    expectations.push({
      kind: 'ask_before_execution',
      targetDate: args.targetDate,
      reason: 'draft_needs_clarification',
    });
  }
  return expectations;
}

function reasonForDraft(args: {
  intent: ProgramEditDraftIntent;
  primary: DomainSignal;
  isCompound: boolean;
  sourceTarget: CoachResolvedTarget | null;
}): string {
  return [
    args.intent,
    args.primary.domain,
    args.primary.scope,
    args.isCompound ? 'compound' : 'single_action',
    args.sourceTarget ? 'with_source_target' : 'without_source_target',
  ].join(':');
}

function inferTodayFromVisibleWeek(visibleWeek: ResolvedDay[]): string | null {
  return visibleWeek.find((day) => day.isToday)?.date ?? null;
}

function inferTargetSessionId(args: {
  sourceTarget: CoachResolvedTarget | null;
  targetDate: string | null;
  visibleWeek: ResolvedDay[];
}): string | null {
  if (args.sourceTarget?.kind === 'session' && args.sourceTarget.itemId) {
    return args.sourceTarget.itemId;
  }
  if (!args.targetDate) return null;
  const day = args.visibleWeek.find((candidate) => candidate.date === args.targetDate);
  return day?.workout ? String((day.workout as any).id ?? '') || null : null;
}

function dedupeSignals(signals: DomainSignal[]): DomainSignal[] {
  const out: DomainSignal[] = [];
  const seen = new Set<string>();
  for (const signal of signals) {
    const key = `${signal.domain}:${signal.scope}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(signal);
  }
  return out;
}
