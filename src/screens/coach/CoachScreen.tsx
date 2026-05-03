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
import { useRoute } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { Text } from '../../components/common/Text';
import { useProgramStore } from '../../store/programStore';
import { useProfileStore } from '../../store/profileStore';
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
import {
  buildCoachContextPacket,
} from '../../utils/coachContextPacket';
import { dispatchCoachIntent } from '../../utils/coachIntentDispatcher';
import type { CoachIntentClassifier } from '../../utils/coachIntent';
import { LLMCoachIntentClassifier } from '../../utils/llmCoachIntentClassifier';
import { buildLiveDispatchDeps } from '../../utils/coachDispatchDeps';
import { insertProgramSummaryBeforeFinalClose } from '../../utils/coachReplyComposer';
import {
  getClientEnvConfig,
  logMissingClientEnv,
} from '../../config/env';
import { logger } from '../../utils/logger';

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

/** Local-clock today as YYYY-MM-DD. The UAE is deterministic — it never
 *  reads the clock itself; the caller supplies todayISO. */
function todayISOLocal(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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
      ? `Got it — ${severity}/10.`
      : `Got it — ${bodyPart} ${severity}/10.`;
  // The engine emitted events but applyAdjustmentEvents wrote zero
  // overrides. Surface the failure mode by name so the bug is loud
  // instead of silent.
  const body =
    rejectedCount > 0
      ? `Planned changes could not be applied — I lined up adjustments for your week, but they didn't land on real sessions. Investigate event targeting (likely date / session mismatch).`
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
      ? `Got it — ${severity}/10.`
      : `Got it — ${bodyPart} ${severity}/10.`;
  return (
    `${head}\n\nNo changes applied — I tried to adjust the program but the user-visible surface didn't move (no exercise / note / name change). Investigate the apply layer or visible-diff verifier.`
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
      `Great news — clearing the ${current.bodyPart} restrictions and getting your week back to normal. ` +
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
      ? `\n\nIt's been a few days now — worth getting a physio to look at it.`
      : '';
    logger.debug('[pipeline] progression unchanged', {
      bodyPart: current.bodyPart,
      nudgePhysio,
    });
    return `Got it — keeping the ${current.bodyPart} restrictions in place for now.${physioLine}`;
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
  const reason = `${partTitle} ${trendWord} — ${newSeverity}/10`;

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
        `Good — ${current.bodyPart} ${newSeverity}/10 is light enough to train through. ` +
        `Easing the restrictions off this week. Keep it honest if it flares back up.`
      );
    }
    return (
      `Good — ${current.bodyPart} easing to ${newSeverity}/10. ` +
      `Pulling back some of the load restrictions while keeping the high-risk stuff out.`
    );
  }
  // worsening
  if (newSeverity >= 8) {
    return (
      `Sorry to hear — ${current.bodyPart} ${newSeverity}/10 is serious. ` +
      `Pulling things back hard and converting heavy days to recovery. Get a physio to look at it.`
    );
  }
  return (
    `Sorry to hear — ${current.bodyPart} worse at ${newSeverity}/10. ` +
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
    "Missed sessions, soreness, schedule changes — we'll sort it out.",
};

interface QuickAction {
  label: string;
  prefill: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'I missed a session',       prefill: "I missed yesterday's session — " },
  { label: "I'm sore",                  prefill: "I'm pretty sore today, especially in my " },
  { label: 'Feeling cooked this week',  prefill: "I'm feeling cooked this week — can we lighten the load?" },
  { label: 'Game day changed',          prefill: "My game day's changed — " },
  { label: 'Swap an exercise',          prefill: 'Can you swap ' },
  { label: 'Busy week',                 prefill: "I've got a busy week ahead — " },
  { label: "I'm injured",                prefill: "I've picked up a niggle — " },
];

export default function CoachScreen() {
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const [lastPrefill, setLastPrefill] = useState('');

  // Pending-injury context — body part captured when the clarifier asks
  // for severity, so a bare "6/10" follow-up can still route through the
  // UAE. Lives in a ref (not state) because we never need to re-render on
  // change and we want the latest value inside async handleSend without
  // closure pinning.
  const pendingInjuryRef = useRef<PendingInjury | null>(null);

  // Subscribe to global reset signal — when Profile triggers a reset
  // we MUST drop the pending ref AND clear the chat, otherwise stale
  // hammy context can survive a "Clear coach adjustments" click and
  // hijack the next severity reply (the live bug). The signal is
  // fired by `clearCoachAdjustments` / `clearCoachChat` /
  // `resetProgramAndOnboarding` from utils/resetCoach.ts.
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { subscribeResetSignal } = require('../../utils/resetSignals');
    return subscribeResetSignal(() => {
      pendingInjuryRef.current = null;
      setMessages([]);
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
  // currentMicrocycle drives the program-context summary sent to the AI.
  // All program mutations now flow through scoped actions (coachActions.ts);
  // we never call setCurrentMicrocycle / setTodayWorkout / replaceExerciseInWorkout
  // from here directly.
  const currentMicrocycle = useProgramStore((s) => s.currentMicrocycle);
  const onboardingData = useProfileStore((s) => s.onboardingData);
  const coachNotes = useCoachMemoryStore((s) => s.notes);
  const addCoachNote = useCoachMemoryStore((s) => s.addNote);
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

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
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
    };

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
    //   1. Severity already present (e.g. "6/10")              → pass through (LLM adjusts program)
    //   2. Body part + negative descriptor (e.g. "hammy cooked") → FIRE locally, no API call
    //   3. Injury kw/phrase + body part / kw alone             → FIRE locally
    //   4. Anything else                                       → pass through
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
      const bodyPart = extractBodyPart(userMessage.content);
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
        content: guardResult.reply, // exactly SEVERITY_QUESTION
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
      const stateNoInjury = { ...buildScheduleStateImperative(), activeInjury: null };
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
        const reason = `${reasonBodyPart} pain — ${severity}/10`;
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

    // ──────────────── COACH INTENT DISPATCHER ────────────────
    // Production wiring: build the rich context packet, ask the LLM
    // intent classifier to label the turn, then dispatch
    // deterministically. The dispatcher returns `handled: true` for
    // every injury / state-introspection turn — when it does, we
    // SKIP the legacy /coach-chat fetch so old action tools can't
    // compete with the UAE.
    try {
      const recentMessages = messages
        .filter((m) => m.id !== '0' && m.role !== 'system')
        .slice(-8)
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));
      const packet = buildCoachContextPacket({
        userMessage: userMessage.content,
        recentMessages,
        todayISO: todayISOLocal(),
        pendingInjury: pendingInjuryRef.current
          ? {
              bodyPart: pendingInjuryRef.current.bodyPart,
              timestamp: pendingInjuryRef.current.timestamp,
            }
          : null,
      });

      // Ask the LLM. Network failure / malformed JSON / schema
      // mismatch all resolve to a safe `general_question` fallback —
      // the dispatcher then falls through to legacy.
      const intent = await liveCoachIntentClassifier.classify(packet);
      logger.debug('[coach-flow] intent', {
        kind: intent.intent,
        confidence: intent.confidence,
        needsClarification: intent.needsClarification,
      });

      const deps = buildLiveDispatchDeps(todayISOLocal());
      const outcome = dispatchCoachIntent(intent, packet, deps);

      if (outcome.handled) {
        logger.debug('[coach-flow] dispatcher_handled', {
          replyMode: outcome.replyMode,
          mutated: outcome.mutated,
        });
        const assistantMessage: Message = {
          id: `${Date.now()}-dispatch`,
          role: 'assistant',
          content: outcome.reply,
        };
        setMessages((prev) => [...prev, userMessage, assistantMessage]);
        setInputValue('');
        return;
      }
      logger.debug('[coach-flow] dispatcher_passed', {
        replyMode: outcome.replyMode,
        intent: intent.intent,
      });
    } catch (err) {
      // Defensive: if the dispatcher itself throws (shouldn't), fall
      // through to legacy rather than crashing the chat.
      logger.warn('[coach-flow] dispatcher_error', {
        detail: err instanceof Error ? err.message : String(err),
      });
    }
    logger.debug('[coach-flow] legacy_fallback', {
      reason: 'dispatcher_did_not_handle',
    });
    // ──────────────── END COACH INTENT DISPATCHER ────────────────

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

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
      let programContext = '';
      if (currentMicrocycle?.workouts?.length) {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const NOTE_PATTERN = /(MAS|interval|tempo|sprint|run|bike|row|ski|fartlek|tabata|110%|100%|min on|sec on|km|on \/|tt|time trial)/i;

        const lines = currentMicrocycle.workouts.map((w) => {
          const exNames = w.exercises
            .map((ex) => ex.exercise?.name || ex.exerciseId)
            .join(', ');
          const parts: string[] = [`${dayNames[w.dayOfWeek]}: ${w.name} [${exNames}]`];

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
        programContext =
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
      const incomingActions: ServerCoachAction[] = Array.isArray(data.actions) ? data.actions : [];
      logger.debug('[CoachScreen] Response received:', {
        hasReply: !!data.reply,
        actionCount: incomingActions.length,
        actionKinds: incomingActions.map((a) => `${a.kind}(${a.scope})`),
        hasNewNotes: !!data.newNotes,
      });

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

      // Pure-chat turn (no actions) → just relay the LLM's reply.
      if (!aiClaimedChange) {
        const coachMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.reply || 'Got it. What else can I help with?',
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
          groundedContent = `Program changes:\n${bullets}\n\nProgram updated — check your Program tab.`;
        } else if (successfulPermanent.length > 0) {
          groundedContent = 'Saved as a permanent preference — applies to next week onwards.';
        } else if (ambiguousResults.length > 0) {
          const candidates = ambiguousResults[0].ambiguous!.candidates.join(', ');
          groundedContent = `That could mean a few exercises — ${candidates}. Tell me which one and I'll swap it.`;
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
            {item.content}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.messageListContent, { paddingBottom: 70 }]}
        style={styles.list}
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
                {loadingSeconds < 5
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
          />
          <Pressable
            style={({ pressed }) => [
              styles.sendButton,
              pressed && { opacity: 0.7 },
              isLoading && { opacity: 0.5 },
            ]}
            onPress={handleSend}
            disabled={isLoading || !inputValue.trim()}
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
