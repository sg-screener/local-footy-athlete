import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  Animated,
  Pressable,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { Text } from '../../components/common/Text';
import { useProgramStore } from '../../store/programStore';
import { useProfileStore } from '../../store/profileStore';
import { generateProgramFromProfile } from '../../services/api/generateProgram';
import { useCoachStore } from '../../store/coachStore';
import { useCoachMemoryStore } from '../../store/coachMemoryStore';
import {
  snapshotCurrentWeek,
  diffWeekSnapshots,
  summarizeDiffBullets,
  filterDiffFromDate,
} from '../../utils/coachWeekDiff';
import {
  applyCoachActions,
  type CoachAction,
  type CoachActionKind,
  type ScopeKind,
} from '../../utils/coachActions';
import {
  checkInjuryClarificationGuard,
  type GuardMessage,
} from '../../utils/injuryClarificationGuard';
import { extractBodyPart } from '../../utils/injuryAdjustmentEngine';
import {
  applyProgramAdjustment,
  buildInjuryPolicy,
  resolveInjuryBucket,
  eventToBullet,
} from '../../utils/programAdjustmentEngine';
import {
  applyAdjustmentEvents,
  removeInjuryOverridesForWeek,
} from '../../utils/applyAdjustmentEvents';
import { buildScheduleStateImperative } from '../../utils/coachWeekDiff';
import {
  buildDayWorkoutProjectedDay,
} from '../../utils/visibleProgramReadModel';
import { explainSession } from '../../utils/sessionExplanation';
import {
  resolveInjuryFromMessage,
  shouldBindSeverityToPending,
  isDifferentBodyPartInjuryReport,
  type PendingInjury,
} from '../../utils/pendingInjuryResolver';
import {
  snapshotVisibleWorkout,
  computeVisibleDiff,
} from '../../utils/visibleWorkoutDiff';
import { useCoachUpdatesStore } from '../../store/coachUpdatesStore';
import {
  classifyInjuryUpdate,
  shouldSuggestPhysio,
  type InjuryState,
} from '../../utils/injuryProgression';
import type { CoachIntentClassifier, PendingCoachProposal } from '../../utils/coachIntent';
import { LLMCoachIntentClassifier } from '../../utils/llmCoachIntentClassifier';
import {
  type PendingReadinessClarifier,
} from '../../utils/coachReadinessAdapter';
import {
  getPendingClarifierSnapshot,
} from '../../store/pendingCoachClarifierStore';
import { filterLegacyCoachActions } from '../../utils/legacyCoachActionFilter';
import { logCoachBuildFingerprint, COACH_BUILD_INFO } from '../../utils/coachBuildInfo';
import { insertProgramSummaryBeforeFinalClose } from '../../utils/coachReplyComposer';
import { formatExerciseDisplayName } from '../../utils/exerciseDisplay';
import {
  handleCoachTurn,
  type CoachTurnDebug,
} from '../../utils/coachTurnController';
import { LLMSemanticProgramEditDraftAdapter } from '../../utils/llmSemanticProgramEditDraftAdapter';
import { LLMSemanticCoachRevisionProposalAdapter } from '../../utils/llmSemanticCoachRevisionProposalAdapter';
import {
  SETUP_REBUILD_PROGRESS_INTERVAL_MS,
  setupRebuildProgressMessageForTick,
} from '../../utils/coachLongRunningProgress';
import {
  getClientEnvConfig,
  logMissingClientEnv,
  shouldCreateCoachRevisionProposalAdapter,
  shouldCreateSemanticProgramEditDraftAdapter,
} from '../../config/env';
import { logger } from '../../utils/logger';
import { setCoachReady } from '../../navigation/smokeNavState';
import { getSmokeInitialRoute } from '../../utils/smokeBootstrap';
import { navigationRef } from '../../navigation/navigationRef';
import { CommonActions } from '@react-navigation/native';
import type { CoachMessage } from '../../types/domain';
import { useResolvedWeek } from '../../hooks/useSchedule';
import {
  deriveSmokeWednesdayOpenTarget,
  type SmokeWednesdayOpenTarget,
} from '../../components/dev/smokeVisibleWeekHarnessState';
// NOTE: SMOKE_WEDNESDAY_* fixture constants are now consumed exclusively by
// SmokeCoachBikeHarness (src/components/dev/SmokeCoachBikeHarness.tsx).
// CoachScreen no longer owns the visible-week preflight markers — they
// previously lived here but rendered inconsistently because they were
// gated on getSmokeInitialRoute() (non-reactive) and isFocused (race-prone
// on tab mount). The harness mounts at AppNavigator level and reads the
// authoritative smoke nav state machine; CoachScreen is purely the coach
// chat UI again.

/** Singleton classifier — instantiated at module load.
 *
 *  This is the LIVE LLM-backed wiring. Failure paths inside the
 *  classifier (network, HTTP error, JSON parse, schema mismatch) all
 *  resolve to a safe `general_question` fallback so the dispatcher
 *  always receives a valid intent. */
const clientEnv = getClientEnvConfig();
if (!clientEnv.isReady) {
  logMissingClientEnv('CoachScreen', clientEnv);
}

const disabledCoachIntentClassifier: CoachIntentClassifier = {
  async classify() {
    return {
      intent: 'general_question',
      confidence: 0,
      needsClarification: false,
      rationale: 'missing_client_env',
    };
  },
};
const liveCoachIntentClassifier: CoachIntentClassifier = clientEnv.isReady
  ? new LLMCoachIntentClassifier({
      endpoint: clientEnv.coachIntentEndpoint,
      authToken: clientEnv.supabaseAnonKey,
    })
  : disabledCoachIntentClassifier;
const liveSemanticProgramEditDraftAdapter = clientEnv.isReady &&
  shouldCreateSemanticProgramEditDraftAdapter(clientEnv.semanticProgramEditDraftMode)
  ? new LLMSemanticProgramEditDraftAdapter({
      endpoint: clientEnv.coachSemanticProgramEditDraftEndpoint,
      authToken: clientEnv.supabaseAnonKey,
    })
  : null;
const liveCoachRevisionProposalAdapter = clientEnv.isReady &&
  shouldCreateCoachRevisionProposalAdapter(clientEnv.coachRevisionProposalMode)
  ? new LLMSemanticCoachRevisionProposalAdapter({
      endpoint: clientEnv.coachRevisionProposalEndpoint,
      authToken: clientEnv.supabaseAnonKey,
      // Full-state echo on a strong model regularly exceeds the 12s default
      // (observed live: gpt-5.5 aborted mid-generation). Reliability over
      // latency while in dev-active; production latency budget is a Stage 4
      // tuning question, not a truncation knob.
      timeoutMs: 45000,
    })
  : null;

// Warm the revision edge function as soon as the app loads this screen's
// module: a fire-and-forget CORS preflight spins up the isolate so the
// athlete's FIRST edit doesn't pay the cold-start tax. No auth, no body,
// no behavior — pure latency.
if (liveCoachRevisionProposalAdapter && clientEnv.coachRevisionProposalEndpoint) {
  fetch(clientEnv.coachRevisionProposalEndpoint, { method: 'OPTIONS' })
    .then(() => logger.debug('[coach-revision-proposal] warmed'))
    .catch(() => {});
}

if (__DEV__ && shouldCreateSemanticProgramEditDraftAdapter(clientEnv.semanticProgramEditDraftMode)) {
  logger.warn('[coach-semantic-program-edit-draft-endpoint]', {
    resolvedMode: clientEnv.semanticProgramEditDraftMode,
    rawMode: clientEnv.semanticProgramEditDraftRawMode,
    activeAllowed: clientEnv.semanticProgramEditDraftActiveAllowed,
    adapterPresent: !!liveSemanticProgramEditDraftAdapter,
    functionName: clientEnv.coachSemanticProgramEditDraftFunctionName,
    endpoint: clientEnv.coachSemanticProgramEditDraftEndpoint,
  });
}

if (__DEV__ && shouldCreateCoachRevisionProposalAdapter(clientEnv.coachRevisionProposalMode)) {
  logger.warn('[coach-revision-proposal-endpoint]', {
    resolvedMode: clientEnv.coachRevisionProposalMode,
    rawMode: clientEnv.coachRevisionProposalRawMode,
    activeAllowed: clientEnv.coachRevisionProposalActiveAllowed,
    adapterPresent: !!liveCoachRevisionProposalAdapter,
    functionName: clientEnv.coachRevisionProposalFunctionName,
    endpoint: clientEnv.coachRevisionProposalEndpoint,
  });
  if (
    clientEnv.coachRevisionProposalMode === 'active' &&
    (!liveCoachRevisionProposalAdapter || !clientEnv.coachRevisionProposalEndpoint)
  ) {
    // Error level so a broken active-mode setup is impossible to miss in
    // Metro output. The controller independently refuses legacy fallback.
    logger.error('[coach-revision-proposal] ACTIVE MODE MISCONFIGURED', {
      adapterPresent: !!liveCoachRevisionProposalAdapter,
      endpoint: clientEnv.coachRevisionProposalEndpoint || '(empty)',
      envReady: clientEnv.isReady,
      missing: clientEnv.missing,
    });
  }
}

/** Local-clock today as YYYY-MM-DD. The UAE is deterministic — it never
 *  reads the clock itself; the caller supplies todayISO. */
function todayISOLocal(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function isTodaySessionQuestion(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    /\btoday(?:'s)?\b/.test(lower) &&
    /\b(session|workout|training|program)\b/.test(lower) &&
    /\b(what|why|show|tell|explain|on)\b/.test(lower)
  );
}

function getTodayProjectedDay(todayISO = todayISOLocal()) {
  const state = buildScheduleStateImperative();
  const overrideContext = useProgramStore.getState().overrideContexts?.[todayISO];
  const day = buildDayWorkoutProjectedDay({
    date: todayISO,
    todayISO,
    state,
    overrideContext,
  });
  return { day, state };
}

function formatCoachDate(day: { short?: string; date: string }): string {
  const label = day.short || new Date(`${day.date}T12:00:00`).toLocaleDateString('en-AU', {
    weekday: 'short',
  });
  return `${label} ${day.date}`;
}

function exerciseNamesForReply(workout: any): string {
  const names = (workout?.exercises ?? [])
    .map((ex: any) => ex?.exercise?.name || ex?.name || ex?.exerciseId)
    .filter(Boolean)
    .map((name: string) => formatExerciseDisplayName(name) || name);
  if (names.length === 0) return '';
  const shown = names.slice(0, 6);
  const suffix = names.length > shown.length ? `, +${names.length - shown.length} more` : '';
  return `${shown.join(', ')}${suffix}`;
}

function conditioningForReply(workout: any): string {
  const optionTitles = (workout?.conditioningBlock?.options ?? [])
    .map((o: any) => o?.title)
    .filter(Boolean);
  if (optionTitles.length > 0) return optionTitles.join(', ');

  const conditioningNames = (workout?.exercises ?? [])
    .map((ex: any) => ex?.exercise?.name || ex?.name || '')
    .filter((name: string) => /\b(conditioning|interval|bike|row|run|sprint|erg|aerobic)\b/i.test(name))
    .map((name: string) => formatExerciseDisplayName(name) || name);
  return Array.from(new Set(conditioningNames)).join(', ');
}

function buildTodaySessionReply(): string {
  try {
    const todayISO = todayISOLocal();
    const { day, state } = getTodayProjectedDay(todayISO);
    if (!day?.workout) {
      return [
        'Today',
        formatCoachDate({ short: day?.short, date: todayISO }),
        '',
        'No S&C session is scheduled today.',
        'Use it as recovery unless you want me to move or add something.',
      ].join('\n');
    }

    const explanation = explainSession(day, {
      daysToGame: null,
      seasonPhase: (state as any).seasonPhase ?? undefined,
      hasGameThisWeek: true,
    });
    const mainWork = exerciseNamesForReply(day.workout);
    const conditioning = conditioningForReply(day.workout);

    return [
      'Today',
      formatCoachDate(day),
      day.workout.name,
      '',
      'Why it fits',
      explanation.body,
      '',
      'Main work',
      mainWork || 'Open Program for the full exercise list.',
      conditioning ? '' : null,
      conditioning ? 'Conditioning' : null,
      conditioning || null,
    ].filter((line): line is string => line !== null).join('\n');
  } catch (err) {
    logger.warn('[coach-today-reply] failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return "I couldn't read today's program cleanly. Open the Program tab and I can still help adjust what you see there.";
  }
}

function renderMessageContent(content: string, isUserMessage: boolean): React.ReactNode {
  if (isUserMessage || !content.includes('**')) return content.replace(/\*\*/g, '');

  const nodes: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    if (match.index > last) {
      nodes.push(content.slice(last, match.index).replace(/\*\*/g, ''));
    }
    nodes.push(
      <Text key={`bold-${match.index}`} style={styles.messageTextBold}>
        {match[1]}
      </Text>,
    );
    last = re.lastIndex;
  }
  if (last < content.length) {
    nodes.push(content.slice(last).replace(/\*\*/g, ''));
  }
  return nodes;
}

/**
 * Honest fallback when the engine emitted events but the override
 * helper rejected all of them (no resolved day, exercise not present,
 * recovery-blocked etc). Tells the athlete the truth — we did NOT
 * change the program — instead of repeating the engine's optimistic
 * "Program updated" line.
 */
function buildNoOverrideFallbackReply(
  bodyPart: string,
  severity: number,
  rejectedCount: number,
): string {
  const head =
    bodyPart === 'unknown'
      ? `Got it - ${severity}/10.`
      : `Got it - ${bodyPart} ${severity}/10.`;
  // The engine emitted events but applyAdjustmentEvents wrote zero
  // overrides. Surface the failure mode by name so the bug is loud
  // instead of silent.
  const body =
    rejectedCount > 0
      ? `Planned changes could not be applied - I lined up adjustments for your week, but they didn't land on real sessions. Investigate event targeting (likely date / session mismatch).`
      : `Nothing in your remaining week loads that area, so I left the program unchanged.`;
  return `${head}\n\n${body}\n\nKeep things easy and let me know if it gets worse.`;
}

/**
 * Hard-invariant fallback: events applied to the store but the
 * user-visible surface (name / exercise list / coachNotes) didn't
 * actually move. Tells the truth instead of claiming an update.
 */
function buildNoVisibleDiffFallbackReply(
  bodyPart: string,
  severity: number,
): string {
  const head =
    bodyPart === 'unknown'
      ? `Got it - ${severity}/10.`
      : `Got it - ${bodyPart} ${severity}/10.`;
  return (
    `${head}\n\nNo changes applied - I tried to adjust the program but the user-visible surface didn't move (no exercise / note / name change). Investigate the apply layer or visible-diff verifier.`
  );
}

function capitalize(s: string): string {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}

function safeLogError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message
      .split('\n')[0]
      .slice(0, 160)
      .replace(/[A-Za-z0-9_-]{24,}/g, '[redacted]')}`;
  }
  return String(error).slice(0, 160).replace(/[A-Za-z0-9_-]{24,}/g, '[redacted]');
}

/**
 * Run the progression flow for a follow-up message classified as
 * resolved / improving / worsening / unchanged.
 *
 * Mutation rules:
 *   resolved   → wipe all injury overrides for the week, deactivate
 *                the Coach Update card, clear activeInjury.
 *   improving  → wipe overrides, re-run the engine at the lower
 *                severity (gentler restrictions). If new severity
 *                drops below 5 the engine declines and the program
 *                naturally returns to template.
 *   worsening  → wipe overrides, re-run the engine at the higher
 *                severity (stricter restrictions, recovery escalations).
 *   unchanged  → no mutation; optionally append a "see a physio" note
 *                if the injury has been active 3+ days.
 *
 * Returns the assistant reply string. Side effects: programStore
 * mutations + coachUpdatesStore writes.
 */
function handleInjuryProgression(
  outcome: ReturnType<typeof classifyInjuryUpdate>,
  current: InjuryState,
  userMessageContent: string,
): string {
  if (outcome.kind === 'no_match') return ''; // caller guarded
  const sessionResolverMod =
    require('../../utils/sessionResolver') as typeof import('../../utils/sessionResolver');
  const monday = sessionResolverMod.getMondayStr(0);
  const todayISO = todayISOLocal();
  const nowISO = new Date().toISOString();

  // Common header used by every reply.
  const partTitle = capitalize(current.bodyPart);

  // ── (a) RESOLVED ──────────────────────────────────────────────────
  if (outcome.kind === 'resolved') {
    const cleared = removeInjuryOverridesForWeek(monday);
    useCoachUpdatesStore.getState().deactivateCoachUpdate(monday);
    useCoachUpdatesStore.getState().transitionInjuryStatus({
      toStatus: 'resolved',
      severity: 0,
      note: userMessageContent,
      timestamp: nowISO,
    });
    useCoachUpdatesStore.getState().setActiveInjury(null);
    logger.debug('[pipeline] progression resolved', {
      bodyPart: current.bodyPart,
      clearedDates: cleared,
    });
    return (
      `Great news - clearing the ${current.bodyPart} restrictions and getting your week back to normal. ` +
      `Your sessions are restored to the original plan.`
    );
  }

  // ── (b) UNCHANGED ─────────────────────────────────────────────────
  if (outcome.kind === 'unchanged') {
    useCoachUpdatesStore.getState().transitionInjuryStatus({
      toStatus: 'active',
      severity: current.severity,
      note: userMessageContent,
      timestamp: nowISO,
    });
    const physioState = useCoachUpdatesStore.getState().activeInjury;
    const nudgePhysio = physioState ? shouldSuggestPhysio(physioState, nowISO, 3) : false;
    const physioLine = nudgePhysio
      ? `\n\nIt's been a few days now - worth getting a physio to look at it.`
      : '';
    logger.debug('[pipeline] progression unchanged', {
      bodyPart: current.bodyPart,
      nudgePhysio,
    });
    return `Got it - keeping the ${current.bodyPart} restrictions in place for now.${physioLine}`;
  }

  // ── (c) IMPROVING / WORSENING — wipe + re-apply at new severity ────
  const newSeverity = outcome.newSeverity;
  removeInjuryOverridesForWeek(monday);

  // Re-snapshot so visible-diff has a clean BEFORE.
  const beforeWeek = sessionResolverMod.resolveWeekWithConditioning(
    monday,
    buildScheduleStateImperative(),
  );
  const beforeByDate: Record<string, ReturnType<typeof snapshotVisibleWorkout>> = {};
  for (const d of beforeWeek) beforeByDate[d.date] = snapshotVisibleWorkout(d.workout);

  let appliedCount = 0;
  let visibleDiffDetected = false;
  let newRules: string[] = [];
  let newChanges: string[] = [];

  // Severity ≥ 5 still drives the engine; below that the engine
  // declines (sub-threshold) and we just leave the template intact.
  if (newSeverity >= 5) {
    const result = applyProgramAdjustment(
      {
        intent: 'injury',
        todayISO,
        message: userMessageContent,
        payload: { bodyPart: current.bodyPart, severity: newSeverity },
        source: 'client_guard',
      } as any,
      buildScheduleStateImperative(),
    );
    const apply = applyAdjustmentEvents(result.events, { todayISO });
    appliedCount = apply.applied.length;

    const afterWeek = sessionResolverMod.resolveWeekWithConditioning(
      monday,
      buildScheduleStateImperative(),
    );
    const afterByDate: Record<string, ReturnType<typeof snapshotVisibleWorkout>> = {};
    for (const d of afterWeek) afterByDate[d.date] = snapshotVisibleWorkout(d.workout);
    const datesToCheck = Array.from(new Set([
      ...apply.applied.map((a) => a.date),
      ...result.events.map((e) => e.date),
    ]));
    const diff = computeVisibleDiff(datesToCheck, beforeByDate, afterByDate);
    visibleDiffDetected = diff.length > 0;

    const cardBucket =
      current.bucket ??
      (current.bodyPart && current.bodyPart !== 'unknown'
        ? resolveInjuryBucket(current.bodyPart)
        : null);
    const policy = buildInjuryPolicy(cardBucket, newSeverity);
    newRules = [...policy.globalRules];
    newChanges = result.events.map((e) => eventToBullet(e));
  }

  // ── card refresh ──
  const trendWord = outcome.kind === 'improving' ? 'improving' : 'worse';
  const reason = `${partTitle} ${trendWord} - ${newSeverity}/10`;

  if (newSeverity < 5) {
    // The engine declines below severity 5 — restrictions go away
    // entirely. Keep the activeInjury alive at the lower severity so
    // the next follow-up still classifies, but deactivate the card and
    // tell the truth in the reply.
    useCoachUpdatesStore.getState().deactivateCoachUpdate(monday);
  } else if (appliedCount > 0 && visibleDiffDetected) {
    useCoachUpdatesStore.getState().upsertCoachUpdate(monday, {
      source: 'uae',
      reason,
      rules: newRules,
      changes: newChanges,
    });
  }

  // Update activeInjury (status + severity).
  useCoachUpdatesStore.getState().transitionInjuryStatus({
    toStatus: outcome.kind === 'improving' ? 'improving' : 'active',
    severity: newSeverity,
    note: userMessageContent,
    timestamp: nowISO,
  });

  logger.debug('[pipeline] progression', outcome.kind, {
    bodyPart: current.bodyPart,
    fromSeverity: current.severity,
    newSeverity,
    appliedCount,
    visibleDiffDetected,
  });

  // ── reply ──
  if (outcome.kind === 'improving') {
    if (newSeverity < 5) {
      return (
        `Good - ${current.bodyPart} ${newSeverity}/10 is light enough to train through. ` +
        `Easing the restrictions off this week. Keep it honest if it flares back up.`
      );
    }
    return (
      `Good - ${current.bodyPart} easing to ${newSeverity}/10. ` +
      `Pulling back some of the load restrictions while keeping the high-risk stuff out.`
    );
  }
  // worsening
  if (newSeverity >= 8) {
    return (
      `Sorry to hear - ${current.bodyPart} ${newSeverity}/10 is serious. ` +
      `Pulling things back hard and converting heavy days to recovery. Get a physio to look at it.`
    );
  }
  return (
    `Sorry to hear - ${current.bodyPart} worse at ${newSeverity}/10. ` +
    `Tightening the restrictions and reducing load further this week.`
  );
}

// Edge function returns actions in this exact shape (see
// supabase/functions/coach-chat/index.ts CoachActionPayload). We re-shape
// to CoachAction (the local dispatcher's input) before applying.
interface ServerCoachAction {
  kind: CoachActionKind;
  scope: ScopeKind;
  payload: Record<string, any>;
  reason?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const WELCOME_MESSAGE: Message = {
  id: '0',
  role: 'assistant',
  content:
    "G'day mate! I'm your S&C coach. Tell me what's changed and I'll adjust your plan.\n" +
    "Missed sessions, soreness, schedule changes - we'll sort it out.",
};

let coachScreenMessageCache: Message[] | null = null;

const COACH_SCREEN_CONVERSATION_ID = 'coach-screen';

function messageCreatedAt(id: string): string {
  const numericPart = Number(String(id).split('-')[0]);
  if (Number.isFinite(numericPart) && numericPart > 0) {
    return new Date(numericPart).toISOString();
  }
  return new Date().toISOString();
}

function toStoredCoachMessages(messages: Message[]): CoachMessage[] {
  return messages
    .filter((message) => message.id !== WELCOME_MESSAGE.id)
    .filter((message): message is Message & { role: 'user' | 'assistant' } =>
      message.role === 'user' || message.role === 'assistant',
    )
    .map((message) => ({
      id: message.id,
      conversationId: COACH_SCREEN_CONVERSATION_ID,
      role: message.role,
      content: message.content,
      createdAt: messageCreatedAt(message.id),
    }));
}

function fromStoredCoachMessages(messages: CoachMessage[]): Message[] {
  const restored = messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
    }));
  return restored.length > 0 ? [WELCOME_MESSAGE, ...restored] : [WELCOME_MESSAGE];
}

function initialCoachScreenMessages(storedMessages?: CoachMessage[]): Message[] {
  if (coachScreenMessageCache) return coachScreenMessageCache;
  const persisted = storedMessages ?? useCoachStore.getState().messages;
  return fromStoredCoachMessages(persisted);
}

interface QuickAction {
  label: string;
  prefill: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'I missed a session',       prefill: "I missed yesterday's session - " },
  { label: "I'm sore",                  prefill: "I'm pretty sore today, especially in my " },
  { label: 'Feeling cooked this week',  prefill: "I'm feeling cooked this week - can we lighten the load?" },
  { label: 'Game day changed',          prefill: "My game day's changed - " },
  { label: 'Swap an exercise',          prefill: 'Can you swap ' },
  { label: 'Busy week',                 prefill: "I've got a busy week ahead - " },
  { label: "I'm injured",                prefill: "I've picked up a niggle - " },
];

function isGenericReadinessWithoutInjuryTarget(message: string): boolean {
  if (extractBodyPart(message)) return false;
  if (/\b\d{1,2}\s*(?:\/\s*10|out\s+of\s+10)\b/i.test(message)) return false;
  if (/\b(?:pain|painful|hurt|hurts|hurting|injur(?:y|ed)|tweak(?:ed)?|strain(?:ed)?|pulled|pinged|pop|popped|snap|snapped|tear|tore)\b/i.test(message)) {
    return false;
  }
  return /\b(?:sore|soreness|tight|tightness|stiff|aching|ache|cooked|flat|exhausted|fatigued|drained|knackered|low\s+energy|no\s+energy)\b/i.test(message);
}

export default function CoachScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  // smokeCoachBikeFlow only gates the smoke-only "open Wednesday workout"
  // control rendered later in this file. The visible-week preflight
  // markers (ready/pending/missing/inactive/debug) are owned by
  // SmokeCoachBikeHarness, which mounts at AppNavigator level. CoachScreen
  // intentionally does not subscribe to activeSmokeInitialRoute — the
  // smoke runtime flag is sufficient for the wednesday-workout control
  // because by the time CoachScreen is focused the smoke route is
  // already resolved.
  const smokeCoachBikeFlow = __DEV__ && getSmokeInitialRoute() === 'Coach';

  // Smoke state machine: CoachScreen being focused is the canonical
  // "coach UI is interactive" signal. The state-machine flag is the
  // source-of-truth for the smoke-coach-ready marker rendered by
  // AppNavigator. The existing testID="coach-ready" view (gated on
  // __DEV__ && isFocused) remains untouched as a second proof.
  React.useEffect(() => {
    setCoachReady(isFocused);
  }, [isFocused]);
  const storedCoachMessages = useCoachStore((s) => s.messages);
  const persistCoachMessages = useCoachStore((s) => s.setMessages);
  const [messages, setMessagesState] = useState<Message[]>(() =>
    initialCoachScreenMessages(storedCoachMessages),
  );
  const setMessages = React.useCallback<React.Dispatch<React.SetStateAction<Message[]>>>(
    (updater) => {
      setMessagesState((prev) => {
        const next = typeof updater === 'function'
          ? (updater as (prev: Message[]) => Message[])(prev)
          : updater;
        coachScreenMessageCache = next;
        return next;
      });
    },
    [],
  );
  React.useEffect(() => {
    if (coachScreenMessageCache !== null) return;
    if (messages.length > 1) return;
    if (storedCoachMessages.length === 0) return;
    const restored = fromStoredCoachMessages(storedCoachMessages);
    coachScreenMessageCache = restored;
    setMessagesState(restored);
  }, [messages.length, storedCoachMessages]);
  const didPersistMessagesAfterMountRef = useRef(false);
  React.useEffect(() => {
    if (!didPersistMessagesAfterMountRef.current) {
      didPersistMessagesAfterMountRef.current = true;
      return;
    }
    persistCoachMessages(toStoredCoachMessages(messages));
  }, [messages, persistCoachMessages]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const [lastPrefill, setLastPrefill] = useState('');
  // Phase 3 — dev-only debug snapshot. Rendered as a small overlay
  // when EXPO_PUBLIC_ENABLE_DEBUG_LOGS=true so the live app makes the
  // gate decision visible (intent / route / referenceResolution /
  // mutationLike / legacyCalled / replySource) without needing to
  // pull adb logs. Production builds ignore this state.
  const [lastCoachDebug, setLastCoachDebug] = useState<CoachTurnDebug | null>(null);

  // Pending-injury context — body part captured when the clarifier asks
  // for severity, so a bare "6/10" follow-up can still route through the
  // UAE. Lives in a ref (not state) because we never need to re-render on
  // change and we want the latest value inside async handleSend without
  // closure pinning.
  const pendingInjuryRef = useRef<PendingInjury | null>(null);
  const pendingReadinessRef = useRef<PendingReadinessClarifier | null>(null);
  const pendingCoachProposalRef = useRef<PendingCoachProposal | null>(null);
  const lastBlockedSendNoticeAtRef = useRef(0);

  // Phase G runtime audit — log the build fingerprint on every
  // CoachScreen mount. Pairs with the `app_launch` log to give us TWO
  // independent vantage points to confirm we're running Phase-G code.
  // If the device shows stale fingerprints, the bundle is older than
  // the source on disk and the symptoms aren't logic bugs. See
  // src/utils/coachBuildInfo.ts.
  useEffect(() => {
    logCoachBuildFingerprint('coach_screen_mount');
    logger.info('[coach-screen] mounted');
    return () => {
      logger.info('[coach-screen] unmounted');
    };
  }, []);

  useEffect(() => {
    if (isFocused) {
      logger.info('[nav-route] currentRoute=Coach');
    }
  }, [isFocused]);

  // Subscribe to global reset signal — when Profile triggers a reset
  // we MUST drop the pending ref AND return the chat to the welcome-only
  // baseline, otherwise stale
  // hammy context can survive a "Clear coach adjustments" click and
  // hijack the next severity reply (the live bug). The signal is
  // fired by `clearCoachAdjustments` / `clearCoachChat` /
  // `resetProgramAndOnboarding` from utils/resetCoach.ts.
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { subscribeResetSignal } = require('../../utils/resetSignals');
    return subscribeResetSignal(() => {
      pendingInjuryRef.current = null;
      pendingReadinessRef.current = null;
      pendingCoachProposalRef.current = null;
      setMessages([WELCOME_MESSAGE]);
      logger.debug('[reset] coach_screen_pending_cleared');
    });
  }, []);

  // Handle prefill from quick actions
  useEffect(() => {
    const prefill = route.params?.prefill;
    if (prefill && prefill !== lastPrefill) {
      setLastPrefill(prefill);
      setInputValue(prefill);
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [route.params?.prefill]);

  // Inline quick action — prefill the input WITHOUT auto-sending
  // so the athlete can edit before firing.
  const handleQuickAction = (prefill: string) => {
    setInputValue(prefill);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // ── Smoke-only direct DayWorkout navigation ────────────────────────
  //
  // The coach-bike-flow smoke is fundamentally a contract test on the
  // VISIBLE DayWorkout text after the three-message coach mutation. It is
  // NOT a navigation smoke. Routing through Program/Home and tapping a
  // second smoke control there made the harness brittle without adding
  // any coverage — every failure mode in that second hop was orthogonal
  // to what we are trying to assert.
  //
  // This control reads the resolved program week from the SAME source of
  // truth HomeScreen uses (useResolvedWeek → buildProgramTabProjectedWeek
  // → projectVisibleDay), finds the Wednesday entry, and dispatches
  // directly to the real DayWorkoutScreen via the root navigationRef.
  //
  // Render gates:
  //   - smokeCoachBikeFlow              (__DEV__ + coach-bike-flow flow)
  //   - isFocused                       (Coach is the current leaf)
  //   - post-coach Wednesday open target exists (otherwise → missing marker)
  // Missing reasons include no-visible-week-data, no-Wednesday-date-in-week,
  // Wednesday-day-has-no-workout, Wednesday-not-easy-aerobic-flush, and
  // DayWorkout-route-params-unavailable.
  //
  // When the Wednesday target cannot be resolved we render a negative
  // marker (`smoke-wednesday-workout-missing`) with a categorical reason
  // so the wrapper can diagnose the exact failure mode instead of
  // guessing.
  const resolvedWeek = useResolvedWeek();
  const [smokeWednesdayStableTarget, setSmokeWednesdayStableTarget] =
    useState<SmokeWednesdayOpenTarget | null>(null);
  const smokeWednesdayTargetResult = React.useMemo(
    () => deriveSmokeWednesdayOpenTarget({ weekDays: resolvedWeek.weekDays }),
    [resolvedWeek.weekDays],
  );
  const smokeWednesdayCurrentTarget = smokeWednesdayTargetResult.target;
  React.useEffect(() => {
    if (
      !smokeCoachBikeFlow ||
      !isFocused ||
      smokeWednesdayStableTarget ||
      !smokeWednesdayCurrentTarget
    ) {
      return;
    }
    setSmokeWednesdayStableTarget(smokeWednesdayCurrentTarget);
    logger.info(
      `[smoke-open-wednesday-workout] stable target captured date=${smokeWednesdayCurrentTarget.date} workoutId=${smokeWednesdayCurrentTarget.workoutId} title=${smokeWednesdayCurrentTarget.title}`,
    );
  }, [
    smokeCoachBikeFlow,
    isFocused,
    smokeWednesdayStableTarget,
    smokeWednesdayCurrentTarget,
  ]);
  const smokeWednesdayOpenTarget =
    smokeWednesdayTargetResult.state === 'ready'
      ? smokeWednesdayStableTarget ?? smokeWednesdayCurrentTarget
      : null;
  const smokeWednesdayMissingReason: string | null = React.useMemo(() => {
    return smokeWednesdayTargetResult.state === 'ready'
      ? null
      : smokeWednesdayTargetResult.reason;
  }, [smokeWednesdayTargetResult]);

  // ─── smoke-precoach-week-ready gate ─────────────────────────────────
  //
  // Hard preflight rendered into the live tree only when:
  //   • smokeCoachBikeFlow + isFocused (otherwise the marker can't leak
  //     out of the smoke harness)
  //   • resolvedWeek has data
  //   • Wednesday day exists
  //   • Wednesday has a workout
  //   • That workout's name === SMOKE_WEDNESDAY_WORKOUT_NAME ("Easy
  //     Aerobic Flush") — the canonical pre-mutation session the coach
  //     pipeline expects to find
  //   • At least one visible field still mentions "Rower" so the row→bike
  //     mutation has something to flip (otherwise the first coach turn
  //     fails with "I can't see the row session in the visible week")
  //
  // Maestro asserts smoke-precoach-week-ready BEFORE typing any coach
  // message. If smoke-visible-week-missing is visible instead, the wrapper
  // reports the categorical reason without firing the coach turns.
  // NOTE: The visible-week state machine + markers used to live here.
  // They moved to SmokeCoachBikeHarness so they render at AppNavigator
  // level (outside any ScrollView/FlatList/keyboard area) and are
  // driven by the canonical smoke nav state machine instead of
  // CoachScreen-local props. The Wednesday-workout-resolution helpers
  // below (stable target + missingReason) are
  // still owned by CoachScreen because they drive a tappable Pressable
  // in the chat surface — that one is correctly inside CoachScreen.
  React.useEffect(() => {
    if (!smokeCoachBikeFlow || !isFocused) return;
    if (smokeWednesdayMissingReason) {
      logger.info(
        `[smoke-open-wednesday-workout] missing reason=${smokeWednesdayMissingReason} wedText=${smokeWednesdayTargetResult.wedText || '(none)'}`,
      );
    } else {
      logger.info(
        `[smoke-open-wednesday-workout] rendered source=CoachScreen date=${smokeWednesdayOpenTarget?.date ?? '-'} workoutId=${smokeWednesdayOpenTarget?.workoutId ?? '-'} title=${smokeWednesdayOpenTarget?.title ?? '-'} stable=${smokeWednesdayStableTarget ? 'yes' : 'no'}`,
      );
    }
  }, [
    smokeCoachBikeFlow,
    isFocused,
    smokeWednesdayMissingReason,
    smokeWednesdayOpenTarget?.date,
    smokeWednesdayOpenTarget?.workoutId,
    smokeWednesdayOpenTarget?.title,
    smokeWednesdayStableTarget,
    smokeWednesdayTargetResult.wedText,
  ]);

  // ─── Smoke-only forbidden-clarifier detector ────────────────────────
  //
  // The pipeline test (smokeCoachBikeFlowTests.ts, 33/33) proves the
  // deterministic resolver auto-binds turns 2 + 3 to Wednesday's Easy
  // Aerobic Flush when the upstream `lastDiscussedWorkout` /
  // `lastExplainedSession` snapshot is populated. The live CoachScreen
  // has historically diverged from that snapshot (race between
  // dispatcher.referencedSession write and the next handleSend's
  // packet build) and the user sees a clarifier instead of a mutation.
  //
  // This marker fires when the latest assistant message matches any
  // string the router / resolver / dispatcher emits as a "Which session?
  // Which day?" clarifier. The smoke YAML asserts NOT visible after
  // each coach turn so any clarifier leakage fails the smoke at the
  // exact turn it leaked, surfacing wrapper label:
  //   "Live Coach target binding failed: unexpected clarifier."
  //
  // It is intentionally narrow — it only matches the literal clarifier
  // sentences the existing code paths emit. False positives on
  // legitimate disambiguation outside coach-bike-flow are not possible
  // because the marker is gated on smokeCoachBikeFlow && isFocused.
  const FORBIDDEN_CLARIFIER_RE =
    /which\s+session\s+should\s+i\s+switch|which\s+session\s+should\s+the\s+bike\s+change\s+apply\s+to|which\s+day\s+are\s+you\s+looking\s+at|which\s+session\s+do\s+you\s+mean|i\s+see\s+multiple\s+\S+\s+sessions\s+this\s+week|i\s+can'?t\s+see\s+the\s+row\s+session\s+in\s+the\s+visible\s+week|i\s+don'?t\s+see\s+a\s+\S+\s+in\s+this\s+week/i;
  const latestAssistantMessage = React.useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === 'assistant') return m.content;
    }
    return null;
  }, [messages]);
  const smokeForbiddenClarifierVisible = React.useMemo(() => {
    if (!latestAssistantMessage) return false;
    return FORBIDDEN_CLARIFIER_RE.test(latestAssistantMessage);
  }, [latestAssistantMessage]);
  React.useEffect(() => {
    if (!smokeCoachBikeFlow || !isFocused) return;
    if (smokeForbiddenClarifierVisible) {
      logger.warn(
        `[smoke-coach-unexpected-clarifier] reply="${(latestAssistantMessage ?? '').slice(0, 200)}"`,
      );
    }
  }, [smokeCoachBikeFlow, isFocused, smokeForbiddenClarifierVisible, latestAssistantMessage]);

  const handleSmokeOpenWednesdayWorkout = () => {
    logger.info('[smoke-open-wednesday-workout] pressed');
    const latestSmokeWednesdayOpenTarget =
      smokeWednesdayTargetResult.state === 'ready'
        ? smokeWednesdayTargetResult.target
        : null;
    const target = latestSmokeWednesdayOpenTarget ?? smokeWednesdayOpenTarget;
    if (!target) {
      logger.warn(
        `[smoke-open-wednesday-workout] no target reason=${smokeWednesdayMissingReason ?? 'unknown'}`,
      );
      return;
    }
    if (!navigationRef.isReady()) {
      logger.warn(
        '[smoke-open-wednesday-workout] navigationRef not ready — skipping dispatch',
      );
      return;
    }
    logger.info(
      `[smoke-open-wednesday-workout] navigating DayWorkout date=${target.date} workoutId=${target.workoutId} title=${target.title} source=${latestSmokeWednesdayOpenTarget ? 'latest' : 'stable'}`,
    );
    // Use the same DayWorkout route + params HomeScreen.handleViewWorkout
    // uses. We dispatch through the root navigationRef rather than the
    // Coach-stack navigation prop: DayWorkout lives in the ProgramStack,
    // so the nested navigate target needs to be ('ProgramTab', { screen:
    // 'DayWorkout' }) at the root. navigation.getParent() from inside
    // the Coach stack would return the bottom-tab navigator, which works,
    // but the root ref is the canonical singleton and avoids races during
    // nested-stack mount.
    navigationRef.dispatch(
      CommonActions.navigate('ProgramTab', {
        screen: 'DayWorkout',
        params: {
          workoutId: target.workoutId,
          date: target.date,
        },
      }),
    );
  };
  // currentMicrocycle drives the program-context summary sent to the AI.
  // All program mutations now flow through scoped actions (coachActions.ts);
  // we never call setCurrentMicrocycle / setTodayWorkout / replaceExerciseInWorkout
  // from here directly.
  const currentMicrocycle = useProgramStore((s) => s.currentMicrocycle);
  const onboardingData = useProfileStore((s) => s.onboardingData);
  const coachNotes = useCoachMemoryStore((s) => s.notes);
  const addCoachNote = useCoachMemoryStore((s) => s.addNote);
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  // Visible-progress label for deterministic mutation flows. The router/
  // executor ticks `checking_program → applying_change → verifying_update
  // → composing_reply` and we surface the human label so the athlete sees
  // the work happening instead of a generic "Thinking..." spinner.
  const [coachProgressLabel, setCoachProgressLabel] = useState<string | null>(null);
  const [setupRebuildLoadingMessage, setSetupRebuildLoadingMessage] = useState<string | null>(null);
  const setupRebuildProgressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  const clearSetupRebuildProgress = () => {
    if (setupRebuildProgressTimerRef.current) {
      clearInterval(setupRebuildProgressTimerRef.current);
      setupRebuildProgressTimerRef.current = null;
    }
    setSetupRebuildLoadingMessage(null);
  };

  const startSetupRebuildProgress = () => {
    clearSetupRebuildProgress();
    let tick = 0;
    setSetupRebuildLoadingMessage(setupRebuildProgressMessageForTick(tick));
    setupRebuildProgressTimerRef.current = setInterval(() => {
      tick += 1;
      setSetupRebuildLoadingMessage(setupRebuildProgressMessageForTick(tick));
    }, SETUP_REBUILD_PROGRESS_INTERVAL_MS);
  };

  useEffect(() => {
    return () => {
      if (setupRebuildProgressTimerRef.current) {
        clearInterval(setupRebuildProgressTimerRef.current);
        setupRebuildProgressTimerRef.current = null;
      }
    };
  }, []);

  // Animate dots when loading
  useEffect(() => {
    if (!isLoading) return;
    const animateDot = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ])
      );
    const a1 = animateDot(dot1, 0);
    const a2 = animateDot(dot2, 200);
    const a3 = animateDot(dot3, 400);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); dot1.setValue(0.3); dot2.setValue(0.3); dot3.setValue(0.3); };
  }, [isLoading]);

  // Loading timer
  useEffect(() => {
    if (!isLoading) { setLoadingSeconds(0); return; }
    const interval = setInterval(() => setLoadingSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isLoading]);

  useEffect(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const handleSend = async () => {
    const rawInputValue = inputValue;
    const trimmedInput = rawInputValue.trim();
    logger.debug('[coach-send] tapped', {
      inputLength: rawInputValue.length,
      trimmedLength: trimmedInput.length,
      isLoading,
      disabled: isLoading || trimmedInput.length === 0,
      messageCount: messages.length,
    });

    if (!trimmedInput) {
      logger.debug('[coach-send] early_return', {
        reason: 'empty_input',
        messageAppended: false,
      });
      return;
    }

    if (isLoading) {
      logger.warn('[coach-send] early_return', {
        reason: 'isLoading',
        messageAppended: false,
      });
      const now = Date.now();
      if (now - lastBlockedSendNoticeAtRef.current > 5000) {
        lastBlockedSendNoticeAtRef.current = now;
        const assistantMessage: Message = {
          id: `${now}-send-busy`,
          role: 'assistant',
          content: "I'm still working on the previous request. Give me a moment, then try again.",
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmedInput,
    };

    if (isTodaySessionQuestion(userMessage.content)) {
      const assistantMessage: Message = {
        id: `${Date.now()}-today-session`,
        role: 'assistant',
        content: buildTodaySessionReply(),
      };
      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setInputValue('');
      return;
    }

    // ───────────── INJURY PROGRESSION FOLLOW-UP ─────────────
    // If we have an active injury on file, see whether THIS message is
    // a follow-up update ("better", "pain gone", "4/10", "worse"...).
    // When yes, branch into the progression handler — it wipes the
    // existing injury overrides for the week, re-runs the engine at
    // the new severity, and refreshes the Coach Update card.
    //
    // CRITICAL GATES (preventing the live "shoulder severity reply
    // applied to hammy" bug):
    //   (a) If pendingInjuryRef has a fresh entry AND the message is
    //       a severity-only reply, the severity MUST bind to pending
    //       (a NEW injury whose clarifier we just asked) — NOT to
    //       the active injury. We skip this block entirely.
    //   (b) If the message names a DIFFERENT body part than the
    //       active injury, it's a new injury report — skip and let
    //       the client guard ask severity for the new region.
    //
    // The new-injury flow below is unchanged; it still owns first
    // reports + the pending-injury two-turn handshake.
    {
      const activeInjury =
        useCoachUpdatesStore.getState().activeInjury;
      const pending = pendingInjuryRef.current;
      const bindToPending = shouldBindSeverityToPending(
        userMessage.content,
        pending,
      );
      const isDifferentBodyPart = isDifferentBodyPartInjuryReport(
        userMessage.content,
        activeInjury,
      );
      if (bindToPending) {
        logger.debug('[injury-context] severity_bound_to_pending', {
          pendingBodyPart: pending?.bodyPart ?? null,
          activeInjuryBodyPart: activeInjury?.bodyPart ?? null,
          reason: 'fresh pending + severity-only reply',
        });
      }
      if (isDifferentBodyPart) {
        logger.debug('[injury-context] new_body_part_detected', {
          activeInjuryBodyPart: activeInjury?.bodyPart ?? null,
          messageBodyPart: extractBodyPart(userMessage.content),
        });
      }
      if (
        activeInjury &&
        activeInjury.status !== 'resolved' &&
        !bindToPending &&
        !isDifferentBodyPart
      ) {
        const outcome = classifyInjuryUpdate(userMessage.content, activeInjury);
        logger.debug('[pipeline] injury_followup_classification', {
          kind: outcome.kind,
          reason: 'reason' in outcome ? outcome.reason : undefined,
          newSeverity: 'newSeverity' in outcome ? outcome.newSeverity : undefined,
          currentSeverity: activeInjury.severity,
        });
        if (outcome.kind !== 'no_match') {
          logger.debug('[injury-context] active_injury_followup', {
            bodyPart: activeInjury.bodyPart,
            outcomeKind: outcome.kind,
          });
          const reply = handleInjuryProgression(
            outcome,
            activeInjury,
            userMessage.content,
          );
          const assistantMessage: Message = {
            id: `${Date.now()}-progression`,
            role: 'assistant',
            content: reply,
          };
          setMessages((prev) => [...prev, userMessage, assistantMessage]);
          setInputValue('');
          return;
        }
      }
    }

    // ───────────── CLIENT-SIDE INJURY CLARIFICATION GUARD ─────────────
    // Primary runtime protection. Runs BEFORE the network call so we can
    // never reach the LLM with an injury-clarification turn — which means
    // multi-question violations are literally impossible from the client.
    //
    // Source of truth: src/utils/injuryClarificationGuard.ts (same util the
    // edge function mirrors). Decision tree (in priority order):
    //   1. Red-flag symptom                                      → FIRE hard-stop locally, no API call
    //   2. Severity already present (e.g. "6/10")                → pass through (LLM adjusts program)
    //   3. Body part + negative descriptor (e.g. "hammy cooked") → FIRE locally, no API call
    //   4. Injury kw/phrase + body part / kw alone               → FIRE locally
    //   5. Anything else                                         → pass through
    //
    // The edge-function guard remains in place as a backup. This is the
    // primary defense.
    const guardHistory: GuardMessage[] = [...messages, userMessage]
      .filter((m) => m.id !== '0' && m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    const guardResult = checkInjuryClarificationGuard(guardHistory);

    // ── Skip the clarifier when activeInjury already exists for this
    // body part (or no body part is named). The user has already told
    // us the severity — re-asking would be the robotic behaviour we're
    // trying to eliminate. A DIFFERENT body part still falls through
    // to the clarifier so genuinely new injuries get the right flow.
    {
      const activeInjury =
        useCoachUpdatesStore.getState().activeInjury;
      if (
        guardResult.fired &&
        activeInjury &&
        activeInjury.status !== 'resolved'
      ) {
        const messageBodyPart = extractBodyPart(userMessage.content);
        const sameBodyPart =
          !messageBodyPart ||
          messageBodyPart.toLowerCase() === activeInjury.bodyPart.toLowerCase();
        if (sameBodyPart) {
          logger.debug('[injury-client-guard] suppressed', {
            reason: 'active_injury_same_body_part',
            activeBodyPart: activeInjury.bodyPart,
            messageBodyPart: messageBodyPart ?? null,
          });
          // Fall through — let the existing progression / UAE flow
          // handle this turn instead of asking severity again.
          guardResult.fired = false;
        }
      }
    }

    if (
      guardResult.fired &&
      isGenericReadinessWithoutInjuryTarget(userMessage.content)
    ) {
      logger.debug('[injury-client-guard] suppressed', {
        reason: 'generic_readiness_program_edit_priority',
        guardReason: guardResult.reason,
      });
      guardResult.fired = false;
    }

    if (guardResult.fired && guardResult.reply) {
      // FIRED: append user msg + canonical assistant reply locally. No
      // fetch, no typing indicator, no isLoading flip — the network call
      // never happens.
      logger.debug('[injury-client-guard] fired', { reason: guardResult.reason });

      // Capture the body part NOW so the next severity reply can route
      // through the UAE without losing context. If the current message
      // doesn't name a body part (e.g. "I'm sore"), we leave any prior
      // pending alone — the latest body part wins, but a body-partless
      // clarifier turn shouldn't erase one we already have.
      //
      // CRITICAL: when overwriting an existing pending with a DIFFERENT
      // body part, we log [pending-injury] replaced so the live-bug
      // signature ("9" applied to old hammy instead of new shoulder)
      // is provable from logs. The latest pending always wins.
      const bodyPart = guardResult.kind === 'red_flag_hard_stop'
        ? null
        : extractBodyPart(userMessage.content);
      if (bodyPart) {
        const prior = pendingInjuryRef.current;
        const isReplacement =
          prior && prior.bodyPart.toLowerCase() !== bodyPart.toLowerCase();
        pendingInjuryRef.current = {
          bodyPart,
          originalMessage: userMessage.content,
          timestamp: Date.now(),
        };
        if (isReplacement) {
          logger.debug('[pending-injury] replaced', {
            from: prior!.bodyPart,
            to: bodyPart,
            source: 'new_injury_report',
          });
        } else {
          logger.debug('[pending-injury] stored', {
            bodyPart,
            source: 'new_injury_report',
          });
        }
      }

      const assistantMessage: Message = {
        id: `${Date.now()}-guard`,
        role: 'assistant',
        content: guardResult.reply,
      };
      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setInputValue('');
      return;
    }

    logger.debug('[injury-client-guard] passed', { reason: guardResult.reason });
    // ───────────────────── END CLIENT GUARD ─────────────────────

    // ───────────── UNIVERSAL ADJUSTMENT ENGINE — INJURY PATH ─────────────
    // When the message is an injury report WITH a numeric severity, the
    // deterministic UAE owns the turn end-to-end:
    //   1. extractInjuryContext     — message → { bodyPart, severity }
    //   2. applyProgramAdjustment   — emits AdjustmentEvent[] (pure)
    //   3. applyAdjustmentEvents    — translates events into setManualOverride
    //                                  writes (one write per touched date)
    //   4. result.reply             — single reply string built from the
    //                                  events the engine actually emitted
    //
    // The LLM never sees a severity-known injury turn. This eliminates
    // "I removed deadlifts" hallucinations where no override was written,
    // and removes the duplication that previously lived between
    // injuryAdjustmentEngine.ts and the LLM tool layer.
    //
    // Severity-unknown injuries are caught earlier by the clarification
    // guard. Non-injury messages skip this block (extractInjuryContext
    // returns null) and flow through to the LLM as before.
    //
    // Two routes into the UAE:
    //   (a) The current message has body part + severity (full context)
    //   (b) The current message has severity only AND we have a fresh
    //       pendingInjuryRef from a prior clarifier turn (e.g. user said
    //       "hammy cooked", coach asked severity, user replied "6/10")
    // Both branches collapse into resolveInjuryFromMessage — see
    // utils/pendingInjuryResolver.ts for the decision table.
    const resolution = resolveInjuryFromMessage(
      userMessage.content,
      pendingInjuryRef.current,
    );

    // The resolver always tells us what the ref should look like next.
    // Honor that here so the screen never re-uses a stale entry.
    if (resolution.kind === 'stale_cleared') {
      pendingInjuryRef.current = null;
      logger.debug('[pending-injury] cleared', { reason: 'stale' });
    }

    if (resolution.kind === 'resolved') {
      const { bodyPart, severity, bucket, source } = resolution.resolved;
      const todayISO = todayISOLocal();

      // ── BEFORE SNAPSHOT — capture what the user sees right now ─────
      const sessionResolverMod =
        require('../../utils/sessionResolver') as typeof import('../../utils/sessionResolver');
      const monday = sessionResolverMod.getMondayStr(0);
      const beforeWeek = sessionResolverMod.resolveWeekWithConditioning(
        monday,
        buildScheduleStateImperative(),
      );
      const beforeByDate: Record<string, ReturnType<typeof snapshotVisibleWorkout>> = {};
      for (const d of beforeWeek) beforeByDate[d.date] = snapshotVisibleWorkout(d.workout);

      const result = applyProgramAdjustment(
        {
          intent: 'injury',
          todayISO,
          message: userMessage.content,
          payload: { bodyPart, severity },
          source: 'client_guard',
        },
        buildScheduleStateImperative(),
      );

      // [pipeline] step 1 — engine output BEFORE store writes.
      logger.debug('[pipeline] uae result', {
        applied: result.applied,
        eventCount: result.events.length,
        eventKinds: result.events.map((e) => `${e.kind}@${e.date}`),
        rejected: result.rejected.map((r) => r.kind),
      });

      // Translate events → real overrides. The helper rejects past-date
      // events and dates outside the resolved week.
      const apply = applyAdjustmentEvents(result.events, { todayISO });

      // [pipeline] step 2 — apply outcome from applyAdjustmentEvents.
      logger.debug('[pipeline] applyAdjustmentEvents result', {
        appliedCount: apply.applied.length,
        appliedDates: apply.applied.map((a) => `${a.date}:${a.workoutName}`),
        rejected: apply.rejected.map((r) => `${r.kind}@${r.date ?? '-'} (${r.reason})`),
      });

      // Consume the pending context — whether or not the engine applied
      // changes, we've handled the turn deterministically.
      if (source === 'pending') {
        logger.debug('[pending-injury] consumed', { bodyPart, severity });
      }
      pendingInjuryRef.current = null;

      // ── AFTER SNAPSHOT + visible-diff verification ─────────────────
      const afterWeek = sessionResolverMod.resolveWeekWithConditioning(
        monday,
        buildScheduleStateImperative(),
      );
      const afterByDate: Record<string, ReturnType<typeof snapshotVisibleWorkout>> = {};
      for (const d of afterWeek) afterByDate[d.date] = snapshotVisibleWorkout(d.workout);

      const datesToCheck = Array.from(
        new Set([
          ...apply.applied.map((a) => a.date),
          ...result.events.map((e) => e.date),
        ]),
      );
      const visibleDiff = computeVisibleDiff(datesToCheck, beforeByDate, afterByDate);
      const visibleDiffDetected = visibleDiff.length > 0;

      // [pipeline] step 3 — resolver post-write (per applied date)
      for (const a of apply.applied) {
        const day = afterWeek.find((d) => d.date === a.date);
        logger.debug('[pipeline] resolver post-write', {
          date: a.date,
          resolverReturnsName: day?.workout?.name ?? null,
          resolverCoachNotes: day?.workout?.coachNotes ?? [],
          resolverSource: (day as any)?.source ?? null,
        });
      }

      // [pipeline] step 4 — visible diff verdict (the hard invariant).
      logger.debug('[pipeline] visible_diff_detected:', visibleDiffDetected, {
        changedDates: visibleDiff.map((v) => `${v.date}[${v.changedFields.join(',')}]`),
      });

      // ── BUCKET CANONICALISATION (single source of truth) ──────────
      // Always derive cardBucket from bodyPart — even when the
      // resolution carries a bucket (it may be null for the pending
      // severity-only follow-up). This is the line that fixes the
      // live "future weeks not filtered" bug: if bodyPart is a known
      // alias ('hammy', 'lower back', etc.) the activeInjury MUST get
      // a real bucket, else the resolver-level filter has nothing to
      // act on for next week.
      const cardBucket =
        (bucket as ReturnType<typeof resolveInjuryBucket>) ??
        (bodyPart && bodyPart !== 'unknown' ? resolveInjuryBucket(bodyPart) : null);
      if (!cardBucket && bodyPart && bodyPart !== 'unknown') {
        logger.warn('[injury-context] canonicalization_failed', {
          rawBodyPart: bodyPart,
          source,
          reason: 'unknown alias — add to BODY_PART_TO_BUCKET',
        });
      }
      logger.debug('[injury-context] canonicalized', {
        rawBodyPart: bodyPart,
        canonicalBucket: cardBucket,
        severity,
        source,
      });
      const policy = buildInjuryPolicy(cardBucket, severity);
      const seedRules = [...policy.globalRules];

      // ── ACTIVE INJURY SEED (UNCONDITIONAL when severity ≥ 5) ──────
      // The activeInjury is the persistent constraint that drives the
      // resolver-level filter for ALL future weeks. We MUST seed it
      // whenever the user reports a real injury — even if the current
      // week had nothing to mutate (e.g. only Recovery + already-passed
      // sessions remaining). Previously this was gated on
      // apply.applied.length > 0 && visibleDiffDetected, which meant
      // an end-of-week injury report never seeded activeInjury and
      // next week stayed unfiltered.
      if (severity >= 5) {
        const nowISO = new Date().toISOString();
        const existing = useCoachUpdatesStore.getState().activeInjury;
        const newState: InjuryState = existing && existing.bodyPart.toLowerCase() === bodyPart.toLowerCase()
          ? {
              ...existing,
              bucket: cardBucket,           // refresh in case alias was added
              severity,
              status: 'active',
              rules: seedRules,
              lastUpdatedAt: nowISO,
              history: [
                ...existing.history,
                {
                  timestamp: nowISO,
                  fromStatus: existing.status,
                  toStatus: 'active',
                  severity,
                  note: userMessage.content,
                },
              ],
            }
          : {
              bodyPart,
              bucket: cardBucket,
              severity,
              initialSeverity: severity,
              status: 'active',
              rules: seedRules,
              startDate: nowISO,
              createdAt: nowISO,
              lastUpdatedAt: nowISO,
              history: [{
                timestamp: nowISO,
                fromStatus: 'new',
                toStatus: 'active',
                severity,
                note: userMessage.content,
              }],
            };
        useCoachUpdatesStore.getState().setActiveInjury(newState);
        logger.debug('[active-injury] set', {
          bodyPart: newState.bodyPart,
          bucket: newState.bucket,
          severity: newState.severity,
          status: newState.status,
          rules: newState.rules,
          historyCount: newState.history.length,
        });
      }

      // ── CONSTRAINT-PROJECTION DIFF (current + next week) ────────────
      // The UAE only emits events for the current week. activeInjury +
      // the exposure engine reshape future weeks silently via the
      // visible-program projection. Without this block the coach reply
      // would say "I left the program unchanged" even when next Monday
      // was just rebuilt by the constraint. We compute the next-week
      // diff explicitly so reply + card can describe both weeks.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const constraintSummaryMod =
        require('../../utils/constraintSummary') as typeof import('../../utils/constraintSummary');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const exposureEngineMod =
        require('../../utils/exposureEngine') as typeof import('../../utils/exposureEngine');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const projectionMod =
        require('../../utils/visibleProgramProjection') as typeof import('../../utils/visibleProgramProjection');

      const nextMonday = sessionResolverMod.addDays(monday, 7);
      // Baseline next week: resolve as if there were NO active injury,
      // so the constraint diff is computed against the unfiltered template.
      const stateNoInjury = {
        ...buildScheduleStateImperative(),
        activeInjury: null,
        activeConstraints: [],
      };
      const stateWithInjury = buildScheduleStateImperative();
      const nextWeekRaw = sessionResolverMod.resolveWeekWithConditioning(
        nextMonday,
        stateNoInjury,
      );
      const nextWeekResolved = sessionResolverMod.resolveWeekWithConditioning(
        nextMonday,
        stateWithInjury,
      );
      const nextWeekProjected = nextWeekResolved.map((d) => {
        const ai = stateWithInjury.activeInjury;
        return projectionMod.projectVisibleDay({
          day: d,
          activeInjury: ai
            ? {
                bodyPart: ai.bodyPart,
                bucket: ai.bucket as any,
                severity: ai.severity,
                status: ai.status,
                rules: ai.rules ?? [],
              }
            : null,
          todayISO,
        }).day;
      });

      // Region resolution mirrors visibleProgramProjection's bucket map
      // — only used to label the constraint in logs.
      const REGION_BY_BUCKET: Record<string, any> = {
        shoulder: 'shoulder', elbow: 'elbow', wrist: 'wrist', knee: 'knee',
        ankle: 'ankle', calf: 'calf', hamstring: 'hamstring',
        adductor: 'groin', pubalgia: 'groin', lowerBack: 'back',
      };
      const constraintForLabel = cardBucket
        ? exposureEngineMod.buildInjuryConstraint({
            id: `injury-${cardBucket}`,
            region: REGION_BY_BUCKET[cardBucket as string] ?? 'global',
            severity,
          })
        : null;

      const constraintSummary = constraintSummaryMod.summariseConstraintProjectionEffects({
        activeConstraint: constraintForLabel,
        currentWeekRaw: beforeWeek,
        currentWeekProjected: afterWeek,
        nextWeekRaw,
        nextWeekProjected,
      });

      // ── COACH UPDATE CARD WRITE ─────────────────────────────────────
      // The card was previously gated on `apply.applied + visible-diff`.
      // That gate is wrong now: when the current week has no relevant
      // session but next week IS reshaped by the projection, the card
      // never wrote — and the user lost the only UI surface that
      // explains why next Monday only has 3 exercises. Open the gate
      // when EITHER current-week applied (event diff) OR next-week
      // changed (projection diff).
      const hasNextWeekChanges = constraintSummary.nextWeekChanges.length > 0;
      const shouldWriteCard =
        (apply.applied.length > 0 && visibleDiffDetected) || hasNextWeekChanges;
      if (shouldWriteCard) {
        const reasonBodyPart =
          bodyPart === 'unknown' ? 'Injury' : capitalize(bodyPart);
        const reason = `${reasonBodyPart} pain - ${severity}/10`;
        const changes = result.events.map((e) => eventToBullet(e));
        const update = useCoachUpdatesStore.getState().upsertCoachUpdate(monday, {
          source: 'uae',
          reason,
          rules: seedRules,
          changes,
          nextWeekChanges: constraintSummary.nextWeekChanges,
        });
        logger.debug('[pipeline] coach_update written', {
          weekStartISO: update.weekStartISO,
          reason: update.reason,
          ruleCount: update.rules.length,
          changeCount: update.changes.length,
          nextWeekChangeCount: (update.nextWeekChanges ?? []).length,
        });
      } else {
        logger.debug('[pipeline] coach_update skipped', {
          appliedCount: apply.applied.length,
          visibleDiffDetected,
          hasNextWeekChanges,
          note: 'no current-week events AND no next-week projection diff',
        });
      }

      logger.debug('[uae-injury] fired', {
        applied: result.applied,
        eventCount: result.events.length,
        appliedDates: apply.applied.map((a) => a.date),
        rejected: apply.rejected.map((r) => `${r.kind}@${r.date ?? '-'}`),
        bucket,
        severity,
        source,
      });

      // ── REPLY GATE ──────────────────────────────────────────────────
      // Hard invariant: a reply that implies "Program updated" is only
      // permitted when the user will actually see something different.
      //
      // Three branches:
      //   (a) engine emitted no events → engine reply is honest already
      //       (no "Program updated" claim).
      //   (b) engine emitted events but applyAdjustmentEvents rejected
      //       all of them → no-override fallback reply.
      //   (c) events applied but the user-visible surface didn't move
      //       (mutated only fields the UI doesn't render) → "tried but
      //       nothing actually changed" fallback.
      //   (d) visible diff confirmed → engine reply (with its
      //       "Program updated" footer) is honest.
      let replyContent: string;
      let replyMode: 'engine' | 'no_override' | 'no_visible_diff' | 'future_constraint_applied';
      if (result.events.length === 0) {
        replyContent = result.reply;
        replyMode = 'engine';
      } else if (apply.applied.length === 0) {
        replyContent = buildNoOverrideFallbackReply(
          bodyPart,
          severity,
          apply.rejected.length,
        );
        replyMode = 'no_override';
      } else if (!visibleDiffDetected) {
        replyContent = buildNoVisibleDiffFallbackReply(bodyPart, severity);
        replyMode = 'no_visible_diff';
      } else {
        replyContent = result.reply;
        replyMode = 'engine';
      }

      // ── Future-constraint splice ───────────────────────────────────
      // If current-week wording would imply "unchanged" (no_override /
      // no_visible_diff / engine "no relevant sessions"), but the
      // projection just reshaped next week, append the next-week
      // bullets so the user is told.
      if (constraintSummary.nextWeekChanges.length > 0) {
        const futureBlock = constraintSummaryMod.renderFutureConstraintBlock(constraintSummary);
        if (futureBlock) {
          const looksUnchanged =
            /left the program unchanged|no future sessions this week|aren't any future sessions/i.test(
              replyContent,
            );
          if (looksUnchanged) {
            // REPLACE the misleading "unchanged" sentence with the
            // future-constraint block so the user gets accurate
            // signal instead of contradictory ones.
            replyContent = replyContent.replace(
              /(?:But )?[Tt]here aren't any future sessions this week.*?(?:program unchanged|to adjust)\.?\s*/m,
              '',
            );
            replyContent = insertProgramSummaryBeforeFinalClose(replyContent, futureBlock);
            replyMode = 'future_constraint_applied';
          } else {
            // Current-week changes ARE accurate; next-week is
            // additional program info. Insert before final advice so
            // physio / update-coach remains the close.
            replyContent = insertProgramSummaryBeforeFinalClose(replyContent, futureBlock);
          }
        }
      }

      logger.debug('[pipeline] reply chosen', {
        engineEventCount: result.events.length,
        appliedCount: apply.applied.length,
        visibleDiffDetected,
        replyMode,
      });

      const assistantMessage: Message = {
        id: `${Date.now()}-uae-injury`,
        role: 'assistant',
        content: replyContent,
      };
      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setInputValue('');
      return;
    }
    logger.debug('[uae-injury] passed', { reason: 'no_injury_context' });

    // Reaching the dispatcher means the athlete has moved on from any
    // prior injury clarifier — drop pending so a later "6/10"
    // answering an unrelated question doesn't accidentally trigger an
    // injury flow.
    if (pendingInjuryRef.current) {
      logger.debug('[pending-injury] cleared', { reason: 'fell_through_to_dispatcher' });
      pendingInjuryRef.current = null;
    }
    // ───────────────────── END INJURY UAE ─────────────────────

    // ──────────────── COACH TURN CONTROLLER ────────────────
    // Stage 1 architecture cleanup: non-injury coach turn orchestration
    // now has one front door. The controller owns packet build, pending
    // clarifier/transaction resume, ProgramEdit interpretation, deterministic
    // execution, truth gates, and the decision to continue to legacy text chat.
    //
    // Send feedback is IMMEDIATE and screen-owned: the user's bubble, cleared
    // input, and the thinking indicator appear before any network wait, for
    // every path. The controller's append callbacks below therefore only add
    // assistant messages — appending the user message there again would
    // double it.
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    let controllerResult!: Awaited<ReturnType<typeof handleCoachTurn>>;
    try {
    controllerResult = await handleCoachTurn({
      userMessage,
      messages,
      todayISO: todayISOLocal(),
      classifier: liveCoachIntentClassifier,
      semanticProgramEditDraftMode: clientEnv.semanticProgramEditDraftMode,
      semanticProgramEditDraftRawMode: clientEnv.semanticProgramEditDraftRawMode,
      semanticProgramEditDraftActiveAllowed: clientEnv.semanticProgramEditDraftActiveAllowed,
      semanticProgramEditDraftAdapter: liveSemanticProgramEditDraftAdapter,
      coachRevisionProposalMode: clientEnv.coachRevisionProposalMode,
      coachRevisionProposalRawMode: clientEnv.coachRevisionProposalRawMode,
      coachRevisionProposalActiveAllowed: clientEnv.coachRevisionProposalActiveAllowed,
      coachRevisionProposalAdapter: liveCoachRevisionProposalAdapter,
      pendingCoachProposal: pendingCoachProposalRef.current,
      pendingReadiness: pendingReadinessRef.current,
      pendingInjury: pendingInjuryRef.current
        ? {
            bodyPart: pendingInjuryRef.current.bodyPart,
            timestamp: pendingInjuryRef.current.timestamp,
          }
        : null,
      smokeCoachBikeFlow,
      isFocused,
      smokeWednesdayMissingReason,
      smokeWednesdayOpenTarget,
      setPendingCoachProposal: (proposal) => {
        pendingCoachProposalRef.current = proposal;
      },
      setPendingReadiness: (pending) => {
        pendingReadinessRef.current = pending;
      },
      // User message is already appended above (immediate send feedback);
      // these callbacks now only ever add assistant content.
      appendUser: () => {},
      appendAssistant: (assistantMessage) => {
        setMessages((prev) => [...prev, assistantMessage]);
      },
      appendUserAndAssistant: (assistantMessage) => {
        setMessages((prev) => [...prev, assistantMessage]);
      },
      clearInput: () => setInputValue(''),
      setIsLoading,
      setCoachProgressLabel,
      startSetupRebuildProgress,
      clearSetupRebuildProgress,
      setLastCoachDebug,
    });
    } catch (err) {
      // With isLoading now flipped before the controller runs, an uncaught
      // controller exception would freeze the input forever. Recover honestly.
      logger.error('[coach-send] controller_exception', {
        detail: err instanceof Error ? err.message : String(err),
      });
      setIsLoading(false);
      setMessages((prev) => [...prev, {
        id: `${Date.now()}-controller-error`,
        role: 'assistant',
        content: 'Something went wrong handling that - nothing was changed. Please try again.',
      }]);
      return;
    }

    if (controllerResult.handled) {
      setIsLoading(false);
      return;
    }
    // ──────────────── END COACH TURN CONTROLLER ────────────────
    // User message/input/loading already handled above; legacy path continues
    // with isLoading still true and clears it in its own finally.

    try {
      const env = getClientEnvConfig();
      if (!env.isReady) {
        logMissingClientEnv('CoachScreen legacy coach-chat', env);
        throw new Error('Coach service is not configured for this build.');
      }

      // Build current program summary so the AI knows what exercises to swap
      // AND the actual session prescription. The real MAS / interval / intensity
      // text lives in the EXERCISE NOTES (built by sessionBuilder), not in the
      // workout-level description (which is empty) nor the conditioning block
      // description (hardcoded to a generic line). So we surface exercise notes
      // for any conditioning / interval / running exercise.
      const todayISOForCoach = todayISOLocal();
      let programContext =
        `\n\nLOCAL APP CONTEXT:\n` +
        `- The athlete's local date is ${todayISOForCoach} (Australia/Melbourne app time).\n` +
        `- When the athlete says "today", use ${todayISOForCoach}. Do not infer today from server or model timezone.\n` +
        `- Do not use markdown bold markers like **text**. Use short plain headings on their own lines.`;
      try {
        const { day } = getTodayProjectedDay(todayISOForCoach);
        programContext += day?.workout
          ? `\n- Today's visible session is: ${day.short} ${day.date} - ${day.workout.name}.`
          : `\n- Today has no visible S&C session scheduled.`;
      } catch {
        // The deterministic local today reply handles state questions; this
        // context is only a fallback hint for the server conversation path.
      }
      if (currentMicrocycle?.workouts?.length) {
        const jsDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const programDayNames = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const labelWorkoutDay = (dayOfWeek: number) =>
          programDayNames[dayOfWeek] || jsDayNames[dayOfWeek] || `Day ${dayOfWeek}`;
        const NOTE_PATTERN = /(MAS|interval|tempo|sprint|run|bike|row|ski|fartlek|tabata|110%|100%|min on|sec on|km|on \/|tt|time trial)/i;

        const lines = currentMicrocycle.workouts.map((w) => {
          const exNames = w.exercises
            .map((ex) => ex.exercise?.name || ex.exerciseId)
            .join(', ');
          const parts: string[] = [`${labelWorkoutDay(w.dayOfWeek)}: ${w.name} [${exNames}]`];

          // Workout-level description (currently empty for generated programs,
          // but include if non-empty in case future templates set it).
          if (w.description && w.description.trim().length > 0) {
            const desc = w.description.replace(/\s+/g, ' ').trim().slice(0, 400);
            parts.push(`  Description: ${desc}`);
          }

          // Conditioning block headline (intent + option title — useful even
          // though the description field is generic).
          if (w.conditioningBlock?.options?.length) {
            const titles = w.conditioningBlock.options.map((o) => o.title).join(' | ');
            parts.push(`  Conditioning (${w.conditioningBlock.intent}): ${titles}`);
          }

          // EXERCISE NOTES — this is where the real prescription lives for
          // conditioning sessions (e.g. "15s on / 15s off × 4min block.
          // 3 rounds total. Target pace: 110% MAS on each 15s work rep.
          // Intensity: 9/10..."). Filter to exercises whose name OR notes
          // mention conditioning / interval keywords so we don't dump every
          // strength accessory note into the prompt.
          for (const ex of w.exercises) {
            const note = ex.notes?.replace(/\s+/g, ' ').trim();
            if (!note || note.length < 5) continue;
            const exName = ex.exercise?.name || '';
            if (NOTE_PATTERN.test(exName) || NOTE_PATTERN.test(note)) {
              parts.push(`    • ${exName || 'exercise'} — ${note.slice(0, 500)}`);
            }
          }

          return parts.join('\n');
        });
        programContext +=
          `\n\nCURRENT PROGRAM (this is what the athlete is doing right now — read the bulleted prescription notes for MAS %, work intervals, target paces, and intensity rating):\n` +
          lines.join('\n') +
          `\n\nWhen the user asks to swap an exercise on a specific day, use replace_exercise (LOCAL scope) with an ISO date. For a permanent substitution, use set_preferred_alternative (PERMANENT scope) — and ask first if it's not unambiguously permanent. Match exercise names from the list above. ` +
          `When the user asks anything about a MAS / interval / distance-per-rep question, READ the bulleted prescription notes above (they contain the work-interval length and the prescribed % MAS) and follow the MAS PRESCRIPTION RULES — never default to 100% MAS for short reps.`;
      }

      const messagesForAPI = messages
        .filter((m) => m.id !== '0' && m.role !== 'system')
        .concat(userMessage)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const response = await fetch(
        env.coachChatEndpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.supabaseAnonKey}`,
          },
          body: JSON.stringify({
            messages: messagesForAPI,
            coachNotes: coachNotes.map((n) => n.note),
            currentProgramContext: programContext || undefined,
            athleteProfile: {
              ageRange: onboardingData.ageRange,
              position: onboardingData.position,
              motivation: onboardingData.motivation,
              heightCm: onboardingData.heightCm,
              weightKg: onboardingData.weightKg,
              seasonPhase: onboardingData.seasonPhase,
              gameDay: onboardingData.gameDay,
              teamTrainingDaysPerWeek: onboardingData.teamTrainingDaysPerWeek,
              teamTrainingDays: onboardingData.teamTrainingDays,
              teamTrainingDuration: onboardingData.teamTrainingDuration,
              teamTrainingIntensity: onboardingData.teamTrainingIntensity,
              trainingDaysPerWeek: onboardingData.trainingDaysPerWeek,
              preferredTrainingDays: onboardingData.preferredTrainingDays,
              sessionDurationMinutes: onboardingData.sessionDurationMinutes,
              trainingLocation: onboardingData.trainingLocation,
              equipment: onboardingData.equipment,
              experienceLevel: onboardingData.experienceLevel,
              squatStrength: onboardingData.squatStrength,
              benchStrength: onboardingData.benchStrength,
              conditioningLevel: onboardingData.conditioningLevel,
              sprintExposure: onboardingData.sprintExposure,
              recentTrainingLoad: onboardingData.recentTrainingLoad,
              injuries: onboardingData.injuries,
              goals: onboardingData.goals,
              biggestLimitation: onboardingData.biggestLimitation,
              biggestFrustration: onboardingData.biggestFrustration,
              successVision: onboardingData.successVision,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      // Handle application-level errors (edge function returns 200 with error in body)
      if (data.error) {
        if (typeof data.error === 'string' && data.error.includes('[OVERLOADED]')) {
          const err = new Error('The AI service is under heavy load right now. Please try again in a minute.');
          err.name = 'OverloadError';
          throw err;
        }
        throw new Error(`Coach API error: ${data.error}`);
      }

      // Diagnostic logging for coach action pipeline
      const rawIncomingActions: ServerCoachAction[] = Array.isArray(data.actions) ? data.actions : [];
      logger.debug('[CoachScreen] Response received:', {
        hasReply: !!data.reply,
        rawActionCount: rawIncomingActions.length,
        rawActionKinds: rawIncomingActions.map((a) => `${a.kind}(${a.scope})`),
        hasNewNotes: !!data.newNotes,
      });

      // ─── LEGACY ACTION HARD-BLOCK ─────────────────────────────────────
      // The legacy /coach-chat endpoint is CONVERSATION-ONLY. The
      // deterministic CoachCommandRouter owns every program change —
      // structural OR permanent-preference. If legacy emits any action
      // other than `save_note`, the model has either ignored its
      // instructions or hallucinated — we drop the offender on the floor
      // and log it so the regression is observable.
      const { kept, blocked } = filterLegacyCoachActions(rawIncomingActions);
      if (blocked.length > 0) {
        logger.warn('[legacy-action-blocked]', {
          count: blocked.length,
          kinds: blocked.map((b) => `${b.action?.kind ?? 'unknown'}(${b.action?.scope ?? '?'})`),
          reasons: blocked.map((b) => b.reason),
          message: userMessage.content,
          replyPreview: typeof data.reply === 'string' ? data.reply.slice(0, 120) : null,
        });
      }
      const incomingActions: ServerCoachAction[] = kept as ServerCoachAction[];

      // ─── REPLY-TEXT TRUTH GATE (Phase G hardened) ───────────────────
      // Legacy /coach-chat is conversation-only — it has no path to
      // verify a program change. ANY "Done"-shaped phrasing it emits is
      // therefore a lie, regardless of whether actions came along for
      // the ride. The previous gate only fired when actions had been
      // blocked; that left a hole open when legacy emitted a "Done"
      // reply with NO actions (and the user then thought their request
      // had been honoured).
      //
      // If legacy returns a "Done"-shaped reply without deterministic
      // verification, replace it with a plain clarification. Do not expose
      // internal router / verification language to the athlete.
      //
      // Allowed exception: pure save_note results legitimately use
      // "noted" — but the user-facing reply for a save_note isn't where
      // we want "Done — I swapped your bike" either, so we still
      // sanitize when the dangerous verbs are present.
      const legacyReplyText = typeof data.reply === 'string' ? data.reply : '';
      const replyImpliesDone =
        /\b(done|sorted|saved|swapped|swap|changed|change|pinned|locked\s*in|got\s*it|noted|i'?ll\s+use|from\s+now\s+on)\b/i.test(legacyReplyText);
      const sanitizedLegacyReply = replyImpliesDone
        ? 'I can help, but I need a specific change before I edit the program. Tell me what you want: lighter, shorter, swap an exercise, move the session, or add conditioning.'
        : legacyReplyText;
      if (replyImpliesDone) {
        logger.warn('[legacy-reply-sanitized]', {
          reason: 'reply_implies_done_without_router_verification',
          blockedActionCount: blocked.length,
          keptActionCount: kept.length,
          originalPreview: legacyReplyText.slice(0, 200),
          message: userMessage.content.length > 200
            ? `${userMessage.content.slice(0, 200)}…`
            : userMessage.content,
        });
      }
      // ─── DEV GUARD: pending-command leak to legacy ─────────────────
      // If a pending clarifier existed when this turn started, the
      // resume path should have handled it. Reaching legacy with a
      // sanitized clarification reply means the resume failed — log an
      // error so the smoke and dev overlay surface it.
      if (
        replyImpliesDone &&
        getPendingClarifierSnapshot()
      ) {
        logger.error('[pending-command-legacy-leak]', {
          reason: 'pending_clarifier_active_but_legacy_sanitized',
          pendingOp: getPendingClarifierSnapshot()?.operation ?? null,
          message: userMessage.content.slice(0, 200),
          originalReply: legacyReplyText.slice(0, 200),
        });
      }

      // ─── GROUNDING GUARD ──────────────────────────────────────────────
      // Whatever the AI text says, we never claim "Program updated" unless
      // the athlete-facing resolved week (the same view the Program tab
      // renders) actually changed. Snapshot → apply → snapshot → diff.
      //
      // `aiClaimedChange` flags "the model emitted at least one action, even
      // if applying it was a no-op (silent failure)" so we can show the
      // no-op fallback instead of staying silent.
      //
      // CRITICAL: when actions are emitted we SUPPRESS the LLM's free-text
      // reply entirely and build a single canonical assistant message from
      // the actual filtered diff. The model has been observed to hallucinate
      // changes ("removed deadlifts, swapped to bike") that never wrote an
      // override; if we render its text we're lying to the athlete. The diff
      // is the source of truth.
      const aiClaimedChange = incomingActions.length > 0;
      const beforeSnapshot = snapshotCurrentWeek();

      // Pure-chat turn (no actions) → relay the (possibly-sanitized) reply.
      if (!aiClaimedChange) {
        const coachMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: sanitizedLegacyReply || 'Got it. What else can I help with?',
        };
        setMessages((prev) => [...prev, coachMessage]);
      }

      // Apply each scoped action through the local dispatcher. Every action
      // is a date- or week-scoped store mutation (or a permanent preference
      // write); the dispatcher owns the actual store calls so this screen
      // stays presentation-only.
      const actionResults: { kind: CoachActionKind; success: boolean; reason?: string; ambiguous?: { candidates: string[] } }[] = [];
      for (const incoming of incomingActions) {
        if (incoming.kind === 'save_note' as any) continue; // notes handled below
        try {
          const action: CoachAction = {
            kind: incoming.kind,
            scope: incoming.scope,
            payload: incoming.payload || {},
          };
          const result = applyCoachActions([action])[0];
          actionResults.push({ kind: incoming.kind, ...result });
          if (result.success) {
            logger.debug(`[CoachScreen] Applied ${incoming.kind} (${incoming.scope})`);
          } else if (result.ambiguous) {
            logger.warn(`[CoachScreen] Action ambiguous: ${incoming.kind} — candidates: ${result.ambiguous.candidates.join(', ')}`);
          } else {
            logger.warn(`[CoachScreen] Action no-op: ${incoming.kind} — ${result.reason}`);
          }
        } catch (e: any) {
          logger.error(`[CoachScreen] Action threw: ${incoming.kind}`, safeLogError(e));
          actionResults.push({
            kind: incoming.kind,
            success: false,
            reason: e?.message || 'unexpected error',
          });
        }
      }

      // ─── Diff + grounded system message ──────────────────────────────
      // Single emit point for every adjustment flow (typed message AND
      // every quick action). Gates "Program updated" on actual state
      // change; falls back to "no changes were applied" when the AI
      // claimed an update but nothing actually landed in the resolved week.
      // PERMANENT actions (ban_exercise_globally / set_preferred_alternative)
      // legitimately don't change the current week — they affect future
      // generation. We surface those with a permanent-preference message
      // instead of the no-op fallback.
      if (aiClaimedChange) {
        const afterSnapshot = snapshotCurrentWeek();
        const rawDiff = diffWeekSnapshots(beforeSnapshot, afterSnapshot);
        // Today-forward only. Past sessions are immutable from the athlete's
        // perspective; we never advertise changes to days that have already
        // passed even if a tool wrote an override there.
        const diff = filterDiffFromDate(rawDiff);
        const successfulPermanent = actionResults.filter(
          (r) => r.success && (r.kind === 'ban_exercise_globally' || r.kind === 'set_preferred_alternative'),
        );

        // Surface ambiguous matches first — they're the most actionable
        // signal the athlete can give us. The AI was supposed to ask before
        // firing the tool; this fallback catches the case where it didn't.
        const ambiguousResults = actionResults.filter((r) => !r.success && r.ambiguous);

        let groundedContent: string;
        if (diff.hasChanges) {
          const bullets = summarizeDiffBullets(diff);
          groundedContent = `Program changes:\n${bullets}\n\nProgram updated - check your Program tab.`;
        } else if (successfulPermanent.length > 0) {
          groundedContent = 'Saved as a permanent preference - applies to next week onwards.';
        } else if (ambiguousResults.length > 0) {
          const candidates = ambiguousResults[0].ambiguous!.candidates.join(', ');
          groundedContent = `That could mean a few exercises - ${candidates}. Tell me which one and I'll swap it.`;
        } else {
          // Action(s) were emitted but nothing changed in the resolved week
          // and no permanent prefs were saved either — the AI's "I changed X"
          // claim was a hallucination. Don't render its text; tell the athlete
          // truthfully that nothing landed.
          groundedContent =
            'I tried to adjust it, but no program changes were applied. Check the Program tab and try again.';
        }

        const groundedMsg: Message = {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: groundedContent,
        };
        setMessages((prev) => [...prev, groundedMsg]);
      }

      if (data.newNotes && Array.isArray(data.newNotes)) {
        for (const note of data.newNotes) {
          addCoachNote(note);
        }
      }
    } catch (error: any) {
      logger.error('Failed to get coach response:', safeLogError(error));

      const isOverload = error?.name === 'OverloadError';
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: isOverload
          ? 'The AI service is under heavy load right now. Please try again in a minute.'
          : "Couldn't reach the coach right now. Try again in a sec.",
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setCoachProgressLabel(null);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUserMessage = item.role === 'user';
    const isSystemMessage = item.role === 'system';

    if (isSystemMessage) {
      return (
        <View style={styles.systemMessageContainer}>
          <Text style={styles.systemMessageText}>{item.content}</Text>
        </View>
      );
    }

    return (
      <View
        style={[
          styles.messageContainer,
          isUserMessage && styles.userMessageContainer,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isUserMessage && styles.userBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isUserMessage && styles.userMessageText,
            ]}
          >
            {renderMessageContent(item.content, isUserMessage)}
          </Text>
        </View>
      </View>
    );
  };

  // Phase 3 — render the debug overlay only when the live env var
  // EXPO_PUBLIC_ENABLE_DEBUG_LOGS=true. Production never sees this.
  const debugOverlayEnabled =
    typeof process !== 'undefined' &&
    process.env?.EXPO_PUBLIC_ENABLE_DEBUG_LOGS === 'true';

  return (
    <View
      style={[styles.container, { paddingTop: insets.top }]}
      testID="coach-screen-root"
      accessibilityLabel="Coach screen"
    >
      {__DEV__ && isFocused ? (
        <View
          accessible={false}
          pointerEvents="none"
          style={styles.coachReadyMarker}
          testID="coach-ready"
          accessibilityLabel="coach-ready"
          onLayout={() => {
            logger.info('[coach-ready] rendered');
          }}
        />
      ) : null}
      {smokeCoachBikeFlow &&
      isFocused &&
      !smokeWednesdayMissingReason &&
      smokeWednesdayOpenTarget ? (
        <View
          accessible={true}
          collapsable={false}
          pointerEvents="none"
          style={[styles.smokeMarker, styles.smokeReadyMarker]}
          testID="smoke-wednesday-workout-ready"
          accessibilityLabel="smoke-wednesday-workout-ready"
        />
      ) : null}
      {smokeCoachBikeFlow &&
      isFocused &&
      !smokeWednesdayMissingReason &&
      smokeWednesdayOpenTarget ? (
        <Pressable
          accessible={true}
          accessibilityLabel="smoke-open-wednesday-workout"
          accessibilityRole="button"
          collapsable={false}
          onPress={handleSmokeOpenWednesdayWorkout}
          style={styles.smokeControl}
          testID="smoke-open-wednesday-workout"
        />
      ) : null}
      {smokeCoachBikeFlow && isFocused && smokeWednesdayMissingReason ? (
        <View
          accessible={true}
          collapsable={false}
          pointerEvents="none"
          style={[styles.smokeMarker, styles.smokeMissingMarker]}
          testID="smoke-wednesday-workout-missing"
          accessibilityLabel="smoke-wednesday-workout-missing"
        />
      ) : null}
      {/* Forbidden-clarifier guard. Rendered ONLY when the latest
          assistant reply matches one of the canonical "Which session?
          / Which day?" clarifier strings AND the smoke flag is on.
          The Maestro YAML asserts NOT visible after every coach turn
          so any clarifier leakage fails the smoke immediately. */}
      {smokeCoachBikeFlow && isFocused && smokeForbiddenClarifierVisible ? (
        <View
          accessible={true}
          collapsable={false}
          pointerEvents="none"
          style={[styles.smokeMarker, styles.smokeClarifierMarker]}
          testID="smoke-coach-unexpected-clarifier"
          accessibilityLabel="smoke-coach-unexpected-clarifier"
        />
      ) : null}
      {/*
        Visible-week preflight markers (ready/pending/missing/inactive/
        debug) moved to SmokeCoachBikeHarness — mounted at AppNavigator
        level so they survive CoachScreen mount-order races and never
        sit behind the keyboard or inside ScrollView/FlatList.
      */}
      {/* Phase 3 dev debug overlay — surface intent / route /
          referenceResolution / mutationLike / legacyCalled /
          replySource so the user can verify the gate fired correctly
          without grepping logs. Hidden in production builds. */}
      {debugOverlayEnabled && lastCoachDebug ? (
        <View
          style={{
            backgroundColor: '#0008',
            padding: 6,
            marginHorizontal: 8,
            marginTop: 4,
            borderRadius: 4,
          }}
          accessibilityLabel="coach debug overlay"
        >
          <Text style={{ color: '#9F9', fontSize: 10 }}>
            intent={lastCoachDebug.intent} {' | '} route={lastCoachDebug.route}
          </Text>
          <Text style={{ color: '#9F9', fontSize: 10 }}>
            ref={lastCoachDebug.referenceStatus ?? '-'}{' '}
            target={lastCoachDebug.referenceTargetDate ?? '-'}{' '}
            ({lastCoachDebug.referenceTargetName ?? '-'})
          </Text>
          <Text style={{ color: '#9F9', fontSize: 10 }}>
            mutationLike={String(lastCoachDebug.mutationLike)} {' | '}
            legacyCalled={String(lastCoachDebug.legacyCalled)} {' | '}
            replySource={lastCoachDebug.replySource}
          </Text>
          {lastCoachDebug.toModality !== undefined ? (
            <Text style={{ color: '#9F9', fontSize: 10 }}>
              swap={String(lastCoachDebug.fromModality ?? '-')}→
              {String(lastCoachDebug.toModality ?? '-')} {' | '}
              applied={String(lastCoachDebug.applied)} {' | '}
              showsTo={String(lastCoachDebug.projectionShowsTo)} {' | '}
              showsFrom={String(lastCoachDebug.projectionShowsFrom)}
            </Text>
          ) : null}
        </View>
      ) : null}
      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.messageListContent, { paddingBottom: 70 }]}
        style={styles.list}
        testID="coach-message-list"
        accessibilityLabel="Coach conversation"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
        ListFooterComponent={
          messages.length === 1 ? (
            <View style={styles.quickActionsContainer}>
              {QUICK_ACTIONS.map((action) => (
                <Pressable
                  key={action.label}
                  style={({ pressed }) => [
                    styles.quickActionChip,
                    pressed && styles.quickActionChipPressed,
                  ]}
                  onPress={() => handleQuickAction(action.prefill)}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                >
                  <Text style={styles.quickActionText}>{action.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null
        }
      />

      {/* KeyboardStickyView: native UI-thread component that moves with keyboard */}
      <KeyboardStickyView offset={{ closed: 0, opened: tabBarHeight }}>
        {/* Typing indicator */}
        {isLoading && (
          <View style={styles.typingContainer}>
            <View style={styles.typingBubble}>
              <View style={styles.typingIndicator}>
                <Animated.View style={[styles.typingDot, { opacity: dot1 }]} />
                <Animated.View style={[styles.typingDot, { opacity: dot2 }]} />
                <Animated.View style={[styles.typingDot, { opacity: dot3 }]} />
              </View>
              <Text style={styles.typingText}>
                {setupRebuildLoadingMessage
                  ? setupRebuildLoadingMessage
                  : coachProgressLabel
                  ? coachProgressLabel
                  : loadingSeconds < 5
                  ? 'Coach is thinking...'
                  : loadingSeconds < 12
                  ? 'Working on it...'
                  : 'Updating your program...'}
              </Text>
            </View>
          </View>
        )}

        {/* Input bar */}
        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={styles.textInput}
            placeholder="Ask the coach..."
            placeholderTextColor={colors.text.secondary}
            value={inputValue}
            onChangeText={setInputValue}
            editable={!isLoading}
            multiline
            maxLength={500}
            testID="coach-input"
            accessibilityLabel="Coach message input"
          />
          <Pressable
            style={({ pressed }) => [
              styles.sendButton,
              pressed && { opacity: 0.7 },
              (isLoading || !inputValue.trim()) && { opacity: 0.5 },
            ]}
            onPress={handleSend}
            accessibilityState={{
              disabled: isLoading || !inputValue.trim(),
              busy: isLoading,
            }}
            testID="coach-send-button"
            accessibilityLabel="Send message"
          >
            <Text style={styles.sendButtonText}>{'↑'}</Text>
          </Pressable>
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0C0C',
  },
  coachReadyMarker: {
    width: 1,
    height: 1,
    minWidth: 1,
    minHeight: 1,
    backgroundColor: '#0C0C0C',
  },
  smokeControl: {
    position: 'absolute',
    top: 48,
    left: 4,
    width: 44,
    height: 44,
    backgroundColor: '#1DE9B6',
    zIndex: 2147483647,
    elevation: 2147483647,
  },
  smokeMarker: {
    position: 'absolute',
    top: 48,
    left: 56,
    width: 30,
    height: 30,
    zIndex: 2147483647,
    elevation: 2147483647,
  },
  smokeReadyMarker: {
    backgroundColor: '#00C853',
  },
  smokeMissingMarker: {
    backgroundColor: '#FF1744',
  },
  smokeClarifierMarker: {
    // Positioned just below the ready/missing marker so the two never
    // stack on top of each other in a screenshot. Vivid magenta so
    // failure screenshots make the leakage visible at a glance.
    top: 84,
    backgroundColor: '#FF00C8',
  },
  list: {
    flex: 1,
  },
  messageListContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    justifyContent: 'flex-start',
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: '#161616',
  },
  userBubble: {
    backgroundColor: '#C8FF00',
  },
  messageText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
  },
  messageTextBold: {
    fontWeight: '800',
  },
  userMessageText: {
    color: '#0C0C0C',
  },
  typingContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    justifyContent: 'flex-start',
    backgroundColor: '#0C0C0C',
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: '#161616',
    gap: spacing.sm,
  },
  typingIndicator: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#C8FF00',
  },
  typingText: {
    color: '#888888',
    fontSize: 13,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    paddingBottom: 10,
    gap: spacing.sm,
    alignItems: 'flex-end',
    backgroundColor: '#0C0C0C',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1E1E1E',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#161616',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    color: '#FFFFFF',
    maxHeight: 100,
    fontSize: 15,
    lineHeight: 20,
  },
  sendButton: {
    width: 40,
    height: 40,
    backgroundColor: '#C8FF00',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonText: {
    color: '#0C0C0C',
    fontWeight: '700',
    fontSize: 16,
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
  },
  systemMessageText: {
    color: '#C8FF00',
    fontSize: 12,
    fontWeight: '600',
  },
  quickActionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  quickActionChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: '#1B1B1B',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#2A2A2A',
  },
  quickActionChipPressed: {
    backgroundColor: '#262626',
    borderColor: '#C8FF00',
  },
  quickActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
});
