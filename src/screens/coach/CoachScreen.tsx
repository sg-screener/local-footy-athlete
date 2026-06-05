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
  getResolvedVisibleProgramForDate,
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
import { useCoachMutationHistoryStore } from '../../store/coachMutationHistoryStore';
import { useReadinessStore } from '../../store/readinessStore';
import {
  classifyInjuryUpdate,
  shouldSuggestPhysio,
  type InjuryState,
} from '../../utils/injuryProgression';
import {
  buildCoachContextPacket,
} from '../../utils/coachContextPacket';
import { dispatchCoachIntent } from '../../utils/coachIntentDispatcher';
import type { CoachIntent, CoachIntentClassifier, PendingCoachProposal } from '../../utils/coachIntent';
import { LLMCoachIntentClassifier } from '../../utils/llmCoachIntentClassifier';
import { buildLiveDispatchDeps } from '../../utils/coachDispatchDeps';
import { useCoachContextStateStore } from '../../store/coachContextStateStore';
import { extractModalitiesFromSession, isMutationLike } from '../../utils/coachReferenceResolver';
import { orchestrateModalitySwap } from '../../utils/coachModalitySwapOrchestrator';
import { autoBindUniqueModalityTarget } from '../../utils/coachVisibleWeekAutoBind';
import { parseModalitySwapRequest } from '../../utils/coachModalitySwap';
import {
  canFallbackToLegacy,
  isMutateCommand,
  type CoachCommand,
} from '../../utils/coachCommandRouter';
import {
  coachCommandFromLLMIntent,
  shouldTryLLMCoachCommand,
} from '../../utils/coachLLMCommandAdapter';
import {
  routeCoachReadinessMessage,
  type CoachReadinessAction,
  type PendingReadinessClarifier,
} from '../../utils/coachReadinessAdapter';
import {
  describeStage,
  type ExecutionResult,
  type ProgressStage,
} from '../../utils/coachCommandExecutor';
import {
  interpretCoachMessageToProgramEdit,
  executeProgramEdit,
  resolvePendingProgramEditAnswer,
  type ProgramEdit,
} from '../../utils/coachProgramEdit';
import {
  usePendingCoachClarifierStore,
  getPendingClarifierSnapshot,
  isCancelClarifierMessage,
  isAffirmativeClarifierMessage,
  isNegativeClarifierMessage,
  type PendingCoachClarifier,
} from '../../store/pendingCoachClarifierStore';
import {
  captureFromExecutorClarify,
  resumeFromPending,
  resolvePendingGameDayReadinessAnswer,
} from '../../utils/coachClarifierResume';
import { buildReadinessSignalPatch } from '../../utils/readiness';
import { filterLegacyCoachActions } from '../../utils/legacyCoachActionFilter';
import { logCoachBuildFingerprint, COACH_BUILD_INFO } from '../../utils/coachBuildInfo';
import { isPendingProgramProposalExpired } from '../../utils/programAdjustmentRequests';
import { insertProgramSummaryBeforeFinalClose } from '../../utils/coachReplyComposer';
import {
  getClientEnvConfig,
  logMissingClientEnv,
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

function resolveLiveVisibleProgramForDate(date: string, todayISO = todayISOLocal()) {
  const programState = useProgramStore.getState();
  return getResolvedVisibleProgramForDate({
    date,
    todayISO,
    state: buildScheduleStateImperative(),
    overrideContexts: programState.overrideContexts ?? {},
  });
}

function recordVerifiedProgramEditMutationFocus(
  edit: ProgramEdit,
  result: ExecutionResult,
  todayISO = todayISOLocal(),
) {
  if (result.kind !== 'mutated' || !result.applied) return;
  const targetDate =
    edit.targetDate ??
    result.modalityOutcome?.targetDate ??
    null;
  if (!targetDate) return;

  const visible = resolveLiveVisibleProgramForDate(targetDate, todayISO);
  const workout = visible.day.workout ?? null;
  const sessionName =
    workout?.name ??
    edit.targetItemTitle ??
    (edit.targetDomain === 'session' ? 'Rest' : 'session');
  const modalities = workout
    ? extractModalitiesFromSession({
        name: workout.name,
        exercises: workout.exercises,
      })
    : undefined;

  useCoachContextStateStore.getState().setLastExplainedSession({
    date: targetDate,
    sessionName,
    modalities,
    source: 'coach_mutation',
  });
  if (getPendingClarifierSnapshot()) {
    usePendingCoachClarifierStore.getState().clearPending();
    logger.debug('[pending-clarifier] cleared_after_verified_mutation', {
      targetDate,
      route: result.route,
    });
  }
  logger.debug('[coach-flow] mutation_focus_set', {
    targetDate,
    sessionName,
    route: result.route,
  });
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
    .filter(Boolean);
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
    .filter((name: string) => /\b(conditioning|interval|bike|row|run|sprint|erg|aerobic)\b/i.test(name));
  return Array.from(new Set(conditioningNames)).join(', ');
}

type AppliedReadinessAction = Extract<CoachReadinessAction, { kind: 'apply_signal' }>;

function isRecoveryWorkoutForCoach(workout: any): boolean {
  return (
    workout?.workoutType === 'Recovery' ||
    workout?.sessionTier === 'recovery'
  );
}

function buildSessionAwareReadinessReply(
  readinessAction: AppliedReadinessAction,
  todayISO: string,
): string {
  const signal = readinessAction.signal ?? {};
  const isFlat = signal.flatToday || signal.energy === 'low';
  const isSore = signal.soreness === 'moderate' || signal.soreness === 'high';
  const isShortTime =
    typeof signal.timeAvailableMinutes === 'number' &&
    signal.timeAvailableMinutes < 45;
  const bodyPart =
    typeof signal.bodyPart === 'string' && signal.bodyPart.trim()
      ? signal.bodyPart.trim()
      : 'that area';

  let workout: any = null;
  try {
    workout = getTodayProjectedDay(todayISO).day?.workout ?? null;
  } catch (err) {
    logger.warn('[coach-readiness-reply] failed to read today workout', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  if (!workout) {
    if (isFlat) {
      return 'Got it — no S&C session is scheduled today, so keep it as recovery. Easy movement is fine if it makes you feel better.';
    }
    if (isSore) {
      return `Got it — no S&C session is scheduled today, so keep ${bodyPart} calm and pain-free. If it feels like pain, tell me a rough score out of 10.`;
    }
    if (isShortTime) {
      return 'Got it — no S&C session is scheduled today, so there is nothing we need to squeeze in.';
    }
  }

  if (isRecoveryWorkoutForCoach(workout)) {
    if (isFlat) {
      return 'Got it — today is already a recovery session, so we’ll keep it recovery-led. Aim to finish fresher than you started: easy pace, relaxed mobility, and no extra work added.';
    }
    if (isSore) {
      return `Got it — today is already recovery, so keep it gentle around ${bodyPart}. Stay pain-free, use the flush and mobility work, and tell me a pain score if it feels sharper than soreness.`;
    }
    if (isShortTime) {
      return 'Got it — today is already recovery, so keep the essentials only. Do the main mobility or flush work, then call it.';
    }
  }

  if (isFlat) {
    const sessionName = workout?.name ? `For ${workout.name}, ` : '';
    return (
      `Yep — that’s a low-readiness flag. ${sessionName}` +
      `we’ll pull today back: keep the main work crisp, cap effort around 6–7/10, and skip anything that turns into a grind. ` +
      `If you still feel worse after warming up, make it recovery only.`
    );
  }

  if (isSore) {
    return (
      `Got it — sore ${bodyPart} today. ` +
      `Keep that area pain-free, avoid pushing through sharpness, and I’ll bias the plan away from anything that hammers it.`
    );
  }

  if (isShortTime) {
    return 'Got it — short-time day. Main stimulus first, then leave the accessories unless you’ve genuinely got room.';
  }

  return readinessAction.reply;
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

function describeTodayReadinessImpact(todayISO: string): string {
  try {
    const { day } = getTodayProjectedDay(todayISO);
    const workout = day?.workout;
    if (!workout) {
      return 'Program update\nToday is already a no-session day, so there was nothing to trim.';
    }

    const notes = workout.coachNotes ?? [];
    const removed = notes
      .filter((n: string) => /^Removed:\s*/i.test(n))
      .map((n: string) => n.replace(/^Removed:\s*/i, '').trim());
    const cautions = notes
      .filter((n: string) => /^Caution:\s*/i.test(n))
      .map((n: string) => n.replace(/^Caution:\s*/i, '').trim());
    const focus = notes
      .filter((n: string) => /^Focus:\s*/i.test(n))
      .map((n: string) => n.replace(/^Focus:\s*/i, '').trim())
      .slice(0, 2);

    const lines: string[] = ['Program update'];
    if (removed.length > 0) lines.push(`Removed today: ${removed.join(', ')}`);
    if (cautions.length > 0) lines.push(`Treat as caution: ${cautions.join(', ')}`);
    if (focus.length > 0) lines.push(`Focus: ${focus.join(', ')}`);

    if (lines.length > 1) return lines.join('\n');

    if (isRecoveryWorkoutForCoach(workout)) {
      return [
        'Program update',
        `${workout.name} is already the low-cost option, so I left the structure alone.`,
        'Keep it easy and finish feeling better than you started.',
      ].join('\n');
    }

    return [
      'Program update',
      `${workout.name} was already low-cost enough that I did not need to remove exercises.`,
      'Keep it controlled and do not add extras today.',
    ].join('\n');
  } catch (err) {
    logger.warn('[coach-readiness-impact] failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return 'Program update\nI flagged today, but could not verify the visible session change in chat. Check the Program tab before training.';
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
  { label: 'I missed a session',       prefill: "I missed yesterday's session — " },
  { label: "I'm sore",                  prefill: "I'm pretty sore today, especially in my " },
  { label: 'Feeling cooked this week',  prefill: "I'm feeling cooked this week — can we lighten the load?" },
  { label: 'Game day changed',          prefill: "My game day's changed — " },
  { label: 'Swap an exercise',          prefill: 'Can you swap ' },
  { label: 'Busy week',                 prefill: "I've got a busy week ahead — " },
  { label: "I'm injured",                prefill: "I've picked up a niggle — " },
];

function pendingClarifierNeedsDuration(pending: PendingCoachClarifier): boolean {
  return pending.operation === 'add_conditioning' &&
    pending.missingFields.some((field) =>
      /^(?:duration|durationMinutes|minutes|time)$/.test(field),
    );
}

function shouldHoldDurationClarifier(
  pending: PendingCoachClarifier,
  message: string,
): boolean {
  if (!pendingClarifierNeedsDuration(pending)) return false;
  const text = message.trim();
  if (!text) return false;
  const startsFreshEdit =
    /\b(?:add|remove|drop|skip|swap|replace|move|reschedule|instead\s+of|rather\s+than)\b/i.test(text) ||
    /\b(?:bike|row(?:er|ing)?|ski\s*erg|skierg|run(?:ning)?|walk(?:ing)?|pilates|yoga|mobility|hiit|sprints?|intervals?)\b/i.test(text) ||
    /\b(?:harder|lighter|easier|shorter)\b/i.test(text);
  return !startsFreshEdit;
}

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
  const [lastCoachDebug, setLastCoachDebug] = useState<{
    intent: string;
    route: string;
    referenceStatus: string | null;
    referenceTargetDate: string | null;
    referenceTargetName: string | null;
    mutationLike: boolean;
    legacyCalled: boolean;
    replySource: 'deterministic' | 'legacy';
    applied?: boolean;
    fromModality?: string | null;
    toModality?: string | null;
    projectionShowsTo?: boolean | null;
    projectionShowsFrom?: boolean | null;
  } | null>(null);

  // Pending-injury context — body part captured when the clarifier asks
  // for severity, so a bare "6/10" follow-up can still route through the
  // UAE. Lives in a ref (not state) because we never need to re-render on
  // change and we want the latest value inside async handleSend without
  // closure pinning.
  const pendingInjuryRef = useRef<PendingInjury | null>(null);
  const pendingReadinessRef = useRef<PendingReadinessClarifier | null>(null);
  const pendingCoachProposalRef = useRef<PendingCoachProposal | null>(null);

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
      pendingReadinessRef.current = null;
      pendingCoachProposalRef.current = null;
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
    let classifiedCoachIntent: CoachIntent | null = null;
    try {
      const recentMessages = messages
        .filter((m) => m.id !== '0' && m.role !== 'system')
        .slice(-8)
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));
      // Note: `let` rather than `const` — the visible-week unique-
      // modality auto-bind below may reassign packet with a synthesised
      // referenceResolution.
      let packet = buildCoachContextPacket({
        userMessage: userMessage.content,
        recentMessages,
        todayISO: todayISOLocal(),
        pendingInjury: pendingInjuryRef.current
          ? {
              bodyPart: pendingInjuryRef.current.bodyPart,
              timestamp: pendingInjuryRef.current.timestamp,
          }
          : null,
        pendingCoachProposal: pendingCoachProposalRef.current,
      });

      // ─── PENDING CLARIFIER RESUME ───────────────────────────────
      // If the previous coach turn returned mutate-mode clarify (e.g.
      // "Which session should I switch?"), the athlete's reply might be
      // an answer to that question. Try to splice their answer into the
      // stashed partial command BEFORE the general router runs.
      //
      //   Coach: "Which session should I switch?" (clarifier)
      //   User:  "The Wednesday one" (binds Wednesday → resume command)
      //
      // Cancel verbs ("never mind", "forget it") drop the slot without
      // applying. If the new message can't be interpreted as an answer,
      // fall through to the normal router and leave the pending entry
      // for the next turn (TTL-bounded).
      {
        const pendingClarifier = getPendingClarifierSnapshot();
        if (pendingClarifier) {
          if (isCancelClarifierMessage(userMessage.content)) {
            usePendingCoachClarifierStore.getState().clearPending();
            logger.debug('[pending-clarifier] cancelled', {
              operation: pendingClarifier.operation,
              ageMs: Date.now() - pendingClarifier.createdAt,
            });
            const cancelMsg: Message = {
              id: `${Date.now()}-clarifier-cancelled`,
              role: 'assistant',
              content: 'No worries — leaving things as they are.',
            };
            setMessages((prev) => [...prev, userMessage, cancelMsg]);
            setInputValue('');
            return;
          }
          const pendingGameDayAnswer = resolvePendingGameDayReadinessAnswer(
            pendingClarifier,
            userMessage.content,
          );
          if (pendingGameDayAnswer) {
            usePendingCoachClarifierStore.getState().clearPending();
            logger.debug('[pending-clarifier] game_day_readiness_answer', {
              operation: pendingClarifier.operation,
              answerKind: pendingGameDayAnswer.kind,
              ageMs: Date.now() - pendingClarifier.createdAt,
            });
            if (pendingGameDayAnswer.kind === 'mark_limited') {
              const todayISO = todayISOLocal();
              useReadinessStore.getState().setReadinessSignal(todayISO, {
                ...buildReadinessSignalPatch('flat'),
                source: 'coach_message',
              });
            }
            const replyMsg: Message = {
              id: `${Date.now()}-game-day-readiness-answer`,
              role: 'assistant',
              content: pendingGameDayAnswer.reply,
            };
            setMessages((prev) => [...prev, userMessage, replyMsg]);
            setInputValue('');
            return;
          }
          const pendingProgramEditAnswer = resolvePendingProgramEditAnswer({
            pending: pendingClarifier,
            userMessage: userMessage.content,
            currentWeek: (packet.currentWeek ?? []).map((day) => ({
              date: day.date,
              sessionName: day.workout?.name ?? 'session',
              workout: day.workout,
            })),
            resolveVisibleProgramForDate: (date) =>
              resolveLiveVisibleProgramForDate(date, todayISOLocal()),
          });
          if (pendingProgramEditAnswer.kind === 'complete') {
            logger.warn('[pending-program-edit-resume]', {
              missingFields: pendingClarifier.programEdit?.missingFields ?? pendingClarifier.missingFields,
              targetDate: pendingProgramEditAnswer.programEdit.targetDate,
              targetItemId: pendingProgramEditAnswer.programEdit.targetItemId,
              targetItemTitle: pendingProgramEditAnswer.programEdit.targetItemTitle,
              legacyBlocked: true,
              ageMs: Date.now() - pendingClarifier.createdAt,
            });
            const onProgress = (stage: ProgressStage) => {
              setCoachProgressLabel(describeStage(stage));
            };
            const result = executeProgramEdit({
              programEdit: pendingProgramEditAnswer.programEdit,
              todayISO: todayISOLocal(),
              referenceResolution: packet.referenceResolution ?? null,
              userMessage: pendingClarifier.originalMessage,
              onProgress,
            });
            setCoachProgressLabel(null);
            recordVerifiedProgramEditMutationFocus(
              pendingProgramEditAnswer.programEdit,
              result,
              todayISOLocal(),
            );
            if (result.kind === 'mutated' && result.applied) {
              usePendingCoachClarifierStore.getState().clearPending();
            }
            logger.debug('[coach-flow] router_executed', {
              route: result.route,
              executorKind: result.kind,
              applied: result.applied,
              progress: result.progress,
              source: 'pending_program_edit_resume',
            });
            const assistantMessage: Message = {
              id: `${Date.now()}-program-edit-resumed`,
              role: 'assistant',
              content: result.reply,
            };
            setMessages((prev) => [...prev, userMessage, assistantMessage]);
            setInputValue('');
            return;
          }
          if (pendingProgramEditAnswer.kind === 'clarify') {
            usePendingCoachClarifierStore.getState().setPending({
              ...pendingClarifier,
              askedQuestion: pendingProgramEditAnswer.reply,
              programEdit: pendingProgramEditAnswer.programEdit,
              candidateItems: pendingProgramEditAnswer.programEdit.candidateItems,
              createdAt: pendingClarifier.createdAt,
            });
            logger.debug('[pending-program-edit] answer_needs_better_clarifier', {
              missingFields: pendingClarifier.programEdit?.missingFields ?? pendingClarifier.missingFields,
              options: pendingProgramEditAnswer.options,
              ageMs: Date.now() - pendingClarifier.createdAt,
            });
            const clarifyMsg: Message = {
              id: `${Date.now()}-program-edit-clarify`,
              role: 'assistant',
              content: pendingProgramEditAnswer.reply,
            };
            setMessages((prev) => [...prev, userMessage, clarifyMsg]);
            setInputValue('');
            return;
          }
          const resumed = resumeFromPending({
            pending: pendingClarifier,
            newMessage: userMessage.content,
            newResolution: packet.referenceResolution ?? null,
          });
          if (resumed && resumed.mode === 'mutate') {
            // Phase G runtime audit — explicit `[pending-clarifier-resume]`
            // tag so live logs prove the resume path fired and legacy was
            // not consulted. Sam's spec — `legacyBlocked: true` is hard-
            // coded because reaching this branch means we run the
            // executor directly, never legacy /coach-chat.
            logger.warn('[pending-clarifier-resume]', {
              operation: pendingClarifier.operation,
              filledTarget:
                resumed.target.kind === 'date' || resumed.target.kind === 'exercise'
                  ? {
                      kind: resumed.target.kind,
                      date: resumed.target.date,
                      sessionName: resumed.target.kind === 'date'
                        ? resumed.target.sessionName
                        : resumed.target.exerciseName,
                    }
                  : { kind: resumed.target.kind },
              legacyBlocked: true,
              ageMs: Date.now() - pendingClarifier.createdAt,
              newMessage: userMessage.content.length > 200
                ? `${userMessage.content.slice(0, 200)}…`
                : userMessage.content,
            });
            usePendingCoachClarifierStore.getState().clearPending();
            const onProgress = (stage: ProgressStage) => {
              setCoachProgressLabel(describeStage(stage));
            };
            const resumedProgramEdit = interpretCoachMessageToProgramEdit({
              userMessage: userMessage.content,
              todayISO: todayISOLocal(),
              referenceResolution: packet.referenceResolution ?? null,
              currentWeek: (packet.currentWeek ?? []).map((day) => ({
                date: day.date,
                sessionName: day.workout?.name ?? 'session',
                workout: day.workout,
              })),
              resolveVisibleProgramForDate: (date) =>
                resolveLiveVisibleProgramForDate(date, todayISOLocal()),
              recentMessages,
              candidateCommand: resumed,
              source: 'pending_clarifier',
            });
            const result = executeProgramEdit({
              programEdit: resumedProgramEdit,
              todayISO: todayISOLocal(),
              referenceResolution: packet.referenceResolution ?? null,
              userMessage: pendingClarifier.originalMessage,
              onProgress,
            });
            setCoachProgressLabel(null);
            recordVerifiedProgramEditMutationFocus(
              resumedProgramEdit,
              result,
              todayISOLocal(),
            );
            logger.debug('[coach-flow] router_executed', {
              route: result.route,
              executorKind: result.kind,
              applied: result.applied,
              progress: result.progress,
              source: 'pending_clarifier_resume',
            });
            const assistantMessage: Message = {
              id: `${Date.now()}-resumed`,
              role: 'assistant',
              content: result.reply,
            };
            setMessages((prev) => [...prev, userMessage, assistantMessage]);
            setInputValue('');
            return;
          }
          if (shouldHoldDurationClarifier(pendingClarifier, userMessage.content)) {
            logger.debug('[pending-clarifier] duration_answer_unparseable', {
              operation: pendingClarifier.operation,
              missingFields: pendingClarifier.missingFields,
              ageMs: Date.now() - pendingClarifier.createdAt,
            });
            const restateMsg: Message = {
              id: `${Date.now()}-clarifier-duration-restate`,
              role: 'assistant',
              content:
                pendingClarifier.askedQuestion
                  ? `${pendingClarifier.askedQuestion} A time like "45 min" or "1 hour" works.`
                  : 'How long should it be? A time like "45 min" or "1 hour" works.',
            };
            setMessages((prev) => [...prev, userMessage, restateMsg]);
            setInputValue('');
            return;
          }
          // ─── BARE YES / NO HANDLING ─────────────────────────────────
          // The athlete answered "Yes" / "Yeah" / "No" to a pending
          // clarifier without giving a concrete target. We MUST NOT fall
          // through to legacy — the legacy LLM has been observed to
          // hallucinate a structural action ("set_preferred_alternative")
          // for a single-word "Yes" reply.
          //
          //   • "No" / "Nope" → drop the pending slot, soft acknowledge.
          //   • "Yes" / "Yeah" → restate the original clarifier so the
          //     athlete can give a concrete answer (a day name, an
          //     exercise name, etc.).
          if (isNegativeClarifierMessage(userMessage.content)) {
            usePendingCoachClarifierStore.getState().clearPending();
            logger.debug('[pending-clarifier] negative_dismiss', {
              operation: pendingClarifier.operation,
              ageMs: Date.now() - pendingClarifier.createdAt,
            });
            const cancelMsg: Message = {
              id: `${Date.now()}-clarifier-no`,
              role: 'assistant',
              content: 'Got it — leaving things as they are.',
            };
            setMessages((prev) => [...prev, userMessage, cancelMsg]);
            setInputValue('');
            return;
          }
          if (isAffirmativeClarifierMessage(userMessage.content)) {
            logger.debug('[pending-clarifier] affirmative_no_target', {
              operation: pendingClarifier.operation,
              ageMs: Date.now() - pendingClarifier.createdAt,
            });
            // Pending entry stays — TTL still in force — so a follow-up
            // concrete answer can resume.
            const restateMsg: Message = {
              id: `${Date.now()}-clarifier-restate`,
              role: 'assistant',
              content:
                pendingClarifier.askedQuestion
                  ? `${pendingClarifier.askedQuestion} (a day name like "Wednesday" works.)`
                  : 'Which session do you mean? A day name like "Wednesday" works.',
            };
            setMessages((prev) => [...prev, userMessage, restateMsg]);
            setInputValue('');
            return;
          }
          // Couldn't bind a target — fall through to normal routing.
          // The pending entry stays put; if the new turn itself emits
          // a clarify, capture will overwrite it below.
        }
      }

      // ─── LIVE SEND CONTEXT INSTRUMENTATION ──────────────────────────
      // [coach-live-send] is the single tag we grep for when the live
      // smoke leaks an "unexpected clarifier" we don't see in
      // smokeCoachBikeFlowTests. Every field here is something the
      // router consumes one frame later; if the live run produces
      // `needsClarification: true` while these logs show a usable
      // target candidate, the bug is between this point and
      // `routedCommand` — nowhere else.
      const liveSendSwapParse = parseModalitySwapRequest(userMessage.content);
      const liveSendPendingClarifierBefore = getPendingClarifierSnapshot();
      const liveSendVisibleWeekTargetCount = (packet.currentWeek ?? []).filter(
        (d) => !!d?.workout,
      ).length;
      logger.debug('[coach-live-send] input', {
        text: userMessage.content.length > 200
          ? `${userMessage.content.slice(0, 200)}…`
          : userMessage.content,
        smokeCoachBikeFlow,
        isFocused,
        wednesdayWorkoutReady: !smokeWednesdayMissingReason,
        wednesdayMissingReason: smokeWednesdayMissingReason ?? null,
      });
      logger.debug('[coach-live-send] visible_week_target_count', {
        count: liveSendVisibleWeekTargetCount,
      });
      logger.debug('[coach-live-send] smoke_target_date_workout', {
        date: smokeWednesdayOpenTarget?.date ?? null,
        workoutId: smokeWednesdayOpenTarget?.workoutId ?? null,
        title: smokeWednesdayOpenTarget?.title ?? null,
      });
      logger.debug('[coach-live-send] pending_clarifier_state', {
        present: liveSendPendingClarifierBefore != null,
        operation: liveSendPendingClarifierBefore?.operation ?? null,
        ageMs: liveSendPendingClarifierBefore
          ? Date.now() - liveSendPendingClarifierBefore.createdAt
          : null,
      });
      logger.debug('[coach-live-send] injury_guard_state', {
        activeInjury: !!useCoachUpdatesStore.getState().activeInjury,
        pendingInjuryPresent: !!pendingInjuryRef.current,
        pendingInjuryBodyPart: pendingInjuryRef.current?.bodyPart ?? null,
      });

      // ─── STALE-PENDING-CLARIFIER PRUNE (smoke critical path) ────────
      // When the live smoke harness is on (smokeCoachBikeFlow + isFocused
      // + Wednesday workout is ready) and the user's message parses as
      // a direct modality swap, a leftover pendingClarifier from a
      // previous unrelated turn would intercept the message and re-ask
      // "Which session do you mean?". That's the wrong answer when the
      // visible week contains exactly one rower session. Clear it.
      const smokePrecoachReady =
        smokeCoachBikeFlow && isFocused && !smokeWednesdayMissingReason;
      if (
        smokePrecoachReady &&
        liveSendSwapParse != null &&
        liveSendPendingClarifierBefore != null
      ) {
        usePendingCoachClarifierStore.getState().clearPending();
        logger.warn('[coach-live-send] stale_pending_cleared', {
          operation: liveSendPendingClarifierBefore.operation,
          ageMs: Date.now() - liveSendPendingClarifierBefore.createdAt,
          reason: 'smoke_precoach_ready_with_direct_modality_swap',
        });
      }

      // ─── VISIBLE-WEEK UNIQUE-MODALITY AUTO-BIND ────────────────────
      // The deterministic resolver only binds "it" / "the row" when the
      // durable coachContextStateStore already carries a fresh
      // lastDiscussedWorkout (or lastExplained / lastOpened). Live turn
      // 2 ("Can you change to a bike?") fires BEFORE turn 1's dispatcher
      // has had a chance to write that entry — so the resolver returns
      // target=null and the router emits "Which session should I
      // switch?" at coachCommandRouter.ts:760.
      //
      // The durable rule: when the message is a modality swap AND the
      // visible week contains exactly one session matching the source
      // modality, we bind that session automatically. Source pure
      // (no Zustand reads, no mutations), gated on target=null so we
      // never override a stronger explicit_day / pronoun match.
      const autoBind = autoBindUniqueModalityTarget(packet, userMessage.content);
      if (autoBind.bound && autoBind.boundTarget) {
        packet = autoBind.packet;
        logger.warn('[coach-live-send] reference_synthesised', {
          method: autoBind.boundTarget.method,
          date: autoBind.boundTarget.date,
          sessionName: autoBind.boundTarget.sessionName,
          candidateCount: autoBind.candidateCount,
          previousStatus: 'no_target_or_unresolved',
        });
      } else {
        logger.debug('[coach-live-send] reference_not_auto_bound', {
          reason: autoBind.reason,
          candidateCount: autoBind.candidateCount,
          existingStatus: packet.referenceResolution?.status ?? null,
          existingTarget: !!packet.referenceResolution?.target,
        });
      }

      // ─── PRE-LLM CoachCommandRouter gate ─────────────────────────
      // Replaces the previous "isMutationLike + orchestrateModalitySwap"
      // pair. The router is a single typed entry point that ALWAYS
      // emits one of: mutate / clarify / reject / explain / inspect_state.
      // Anything other than 'explain' / 'inspect_state' is locally
      // executed; the legacy /coach-chat fetch is hard-blocked for
      // every mutate or clarify outcome — see canFallbackToLegacy.
      logger.debug('[coach-live-send] router_reached', { reached: true });
      const lastUndoableMutation = useCoachMutationHistoryStore
        .getState()
        .getLastUndoableMutation();
      const lastChange = lastUndoableMutation?.affectedDates?.[0]
        ? {
            operation: lastUndoableMutation.operation,
            target: {
              kind: 'date' as const,
              date: lastUndoableMutation.affectedDates[0],
            },
            appliedAt: lastUndoableMutation.timestamp,
            userMessage: lastUndoableMutation.userMessage,
            appliedReply: lastUndoableMutation.appliedReply,
            touchedActivities: lastUndoableMutation.touchedActivities,
          }
        : null;
      const routedProgramEdit = interpretCoachMessageToProgramEdit({
        userMessage: userMessage.content,
        todayISO: todayISOLocal(),
        referenceResolution: packet.referenceResolution ?? null,
        currentWeek: (packet.currentWeek ?? []).map((day) => ({
          date: day.date,
          sessionName: day.workout?.name ?? 'session',
          workout: day.workout,
        })),
        resolveVisibleProgramForDate: (date) =>
          resolveLiveVisibleProgramForDate(date, todayISOLocal()),
        lastChange,
        recentMessages,
      });
      const routedCommand: CoachCommand = routedProgramEdit.command as CoachCommand;
      logger.debug('[coach-live-send] router_emitted', {
        mode: routedCommand.mode,
        reason: 'reason' in routedCommand ? routedCommand.reason : null,
        needsClarification:
          routedCommand.mode === 'mutate' ? routedCommand.needsClarification : null,
        targetKind:
          routedCommand.mode === 'mutate' ? routedCommand.target?.kind ?? null : null,
      });

      logger.debug('[coach-router] command', {
        mode: routedCommand.mode,
        operation: routedCommand.mode === 'mutate' ? routedCommand.operation : null,
        scope: routedCommand.mode === 'mutate' ? routedCommand.scope : null,
        confidence: routedCommand.mode === 'mutate' ? routedCommand.confidence : null,
        needsClarification: routedCommand.mode === 'mutate' ? routedCommand.needsClarification : null,
        reason: 'reason' in routedCommand ? routedCommand.reason : null,
        legacyAllowed: canFallbackToLegacy(routedCommand),
      });

      let commandForExecution: CoachCommand = routedCommand;
      let programEditForExecution = routedProgramEdit;
      if (shouldTryLLMCoachCommand(routedCommand, userMessage.content)) {
        const llmIntent = await liveCoachIntentClassifier.classify(packet);
        classifiedCoachIntent = llmIntent;
        const adapted = coachCommandFromLLMIntent(llmIntent, packet);
        logger.debug('[coach-llm-command]', {
          intent: llmIntent.intent,
          confidence: llmIntent.confidence,
          needsClarification: llmIntent.needsClarification,
          adapterKind: adapted.kind,
          reason: adapted.kind === 'ignored' ? adapted.reason : adapted.command.reason,
        });
        if (adapted.kind === 'command') {
          programEditForExecution = interpretCoachMessageToProgramEdit({
            userMessage: userMessage.content,
            todayISO: todayISOLocal(),
            referenceResolution: packet.referenceResolution ?? null,
            currentWeek: (packet.currentWeek ?? []).map((day) => ({
              date: day.date,
              sessionName: day.workout?.name ?? 'session',
              workout: day.workout,
            })),
            resolveVisibleProgramForDate: (date) =>
              resolveLiveVisibleProgramForDate(date, todayISOLocal()),
            lastChange,
            recentMessages,
            candidateCommand: adapted.command,
            source: 'llm_adapter',
          });
          commandForExecution = programEditForExecution.command as CoachCommand;
        } else if (adapted.kind === 'clarify') {
          const clarifyCommand = adapted.command;
          const captured = captureFromExecutorClarify({
            routedCommand: clarifyCommand,
            askedQuestion: clarifyCommand.question,
            originalMessage: userMessage.content,
            todayISO: todayISOLocal(),
            referenceResolution: packet.referenceResolution,
            candidateItems: programEditForExecution.candidateItems,
          });
          if (captured) {
            usePendingCoachClarifierStore.getState().setPending(captured);
            logger.warn('[pending-clarifier-set]', {
              operation: captured.operation,
              scope: captured.scope,
              missingFields: captured.missingFields,
              partialPayload: captured.partialPayload,
              targetStatus: packet.referenceResolution?.target ? 'resolved' : 'absent',
              askedQuestion: captured.askedQuestion?.length > 200
                ? `${captured.askedQuestion.slice(0, 200)}…`
                : captured.askedQuestion,
              source: 'llm_command_adapter',
            });
          }
          const assistantMessage: Message = {
            id: `${Date.now()}-llm-command-clarify`,
            role: 'assistant',
            content: clarifyCommand.question,
          };
          setMessages((prev) => [...prev, userMessage, assistantMessage]);
          setInputValue('');
          return;
        }
      }

      if (isMutateCommand(commandForExecution)) {
        // Show visible progress while the executor runs.
        const onProgress = (stage: ProgressStage) => {
          setCoachProgressLabel(describeStage(stage));
        };
        const result = executeProgramEdit({
          programEdit: programEditForExecution,
          todayISO: todayISOLocal(),
          referenceResolution: packet.referenceResolution ?? null,
          userMessage: userMessage.content,
          onProgress,
        });
        setCoachProgressLabel(null);
        recordVerifiedProgramEditMutationFocus(
          programEditForExecution,
          result,
          todayISOLocal(),
        );

        // ─── PENDING CLARIFIER CAPTURE ────────────────────────────
        // If the executor returned `clarify`, stash the partial command
        // so the next user reply can answer it. captureFromExecutorClarify
        // handles both mode='mutate' (operation-specific clarifiers like
        // "Which session should I switch?") and mode='clarify' (generic
        // "What change would you like?" with a resolved target). Returns
        // null for ops/modes that aren't resumable.
        if (result.kind === 'clarify') {
          const captured = captureFromExecutorClarify({
            routedCommand: commandForExecution,
            askedQuestion: result.reply,
            originalMessage: userMessage.content,
            todayISO: todayISOLocal(),
            missingFields:
              programEditForExecution.missingFields.length > 0
                ? programEditForExecution.missingFields
                : commandForExecution.mode === 'mutate'
                  ? commandForExecution.missingFields
                  : undefined,
            referenceResolution: packet.referenceResolution,
            programEdit: programEditForExecution,
            candidateItems: programEditForExecution.candidateItems,
          });
          if (captured) {
            usePendingCoachClarifierStore.getState().setPending(captured);
            // Phase G runtime audit — explicit `[pending-clarifier-set]`
            // tag with partialPayload + targetStatus so the next turn's
            // `[pending-clarifier-resume]` can be cross-checked against
            // the captured slot. Sam's spec.
            logger.warn('[pending-clarifier-set]', {
              operation: captured.operation,
              scope: captured.scope,
              missingFields: captured.missingFields,
              partialPayload: captured.partialPayload,
              targetStatus: (commandForExecution as any).target?.kind ?? 'absent',
              askedQuestion: captured.askedQuestion?.length > 200
                ? `${captured.askedQuestion.slice(0, 200)}…`
                : captured.askedQuestion,
            });
          }
        } else if (result.kind === 'mutated' || result.kind === 'rejected'
                || result.kind === 'rejected_with_alternatives') {
          // A successful or hard-rejected mutation supersedes any
          // outstanding clarifier — drop the slot so a stale "Which
          // session?" answer doesn't bind to a different op tomorrow.
          if (getPendingClarifierSnapshot()) {
            usePendingCoachClarifierStore.getState().clearPending();
            logger.debug('[pending-clarifier] superseded', {
              by: result.kind,
            });
          }
        }

        const debugSnapshot = {
          intent: 'coach_command_router',
          route: result.route,
          referenceStatus: packet.referenceResolution?.status ?? null,
          referenceTargetDate: result.modalityOutcome?.targetDate
            ?? packet.referenceResolution?.target?.date
            ?? null,
          referenceTargetName: result.modalityOutcome?.targetSessionName
            ?? packet.referenceResolution?.target?.sessionName
            ?? null,
          mutationLike: true,
          legacyCalled: false,
          replySource: 'deterministic' as const,
          applied: result.applied,
          fromModality: result.modalityOutcome?.fromModality ?? null,
          toModality: result.modalityOutcome?.toModality ?? null,
          projectionShowsTo: result.modalityOutcome?.projectionShowsTo ?? null,
          projectionShowsFrom: result.modalityOutcome?.projectionShowsFrom ?? null,
        };
        setLastCoachDebug(debugSnapshot);
        logger.debug('[coach-flow] router_executed', {
          ...debugSnapshot,
          executorKind: result.kind,
          progress: result.progress,
        });
        logger.debug('[coach-transaction]', {
          message: userMessage.content,
          intent: 'coach_command_router',
          route: result.route,
          pendingProposalBefore: pendingCoachProposalRef.current,
          mutationAttempted: true,
          eventsEmitted: result.applied ? 1 : 0,
          eventsApplied: result.applied ? 1 : 0,
          visibleDiff: result.applied
            ? [{ date: result.modalityOutcome?.targetDate, kind: 'router_command' }]
            : [],
          replyMode: result.applied
            ? 'program_adjustment_applied'
            : 'program_adjustment_failed',
        });
        const assistantMessage: Message = {
          id: `${Date.now()}-router`,
          role: 'assistant',
          content: result.reply,
        };
        setMessages((prev) => [...prev, userMessage, assistantMessage]);
        setInputValue('');
        return;
      }

      // ─── ROUTER CLARIFY MODE — capture placeholder pending ─────────
      // Slice 1: when the router emits mode='clarify' (e.g. "What change
      // would you like — different exercise, different day, lighter
      // session, or skip it?" with reason='mutation_like_no_payload')
      // we MUST capture a placeholder pending clarifier here. Otherwise
      // the follow-up answer ("longer session", "lighter", "skip") has
      // no pending state to resume from, falls through to the legacy
      // /coach-chat LLM, and gets rewritten to the generic fallback.
      //
      // The capture path inside the `isMutateCommand` block above never
      // fires for clarify-mode because `isMutateCommand` returns false.
      // Mirror it here for clarify-mode + return the question directly,
      // bypassing the dispatcher / legacy entirely.
      if (routedCommand.mode === 'clarify') {
        const captured = captureFromExecutorClarify({
          routedCommand,
          askedQuestion: routedCommand.question,
          originalMessage: userMessage.content,
          todayISO: todayISOLocal(),
          missingFields: routedProgramEdit.missingFields,
          referenceResolution: packet.referenceResolution,
          programEdit: routedProgramEdit,
          candidateItems: routedProgramEdit.candidateItems,
        });
        if (captured) {
          usePendingCoachClarifierStore.getState().setPending(captured);
          logger.warn('[pending-clarifier-set]', {
            operation: captured.operation,
            scope: captured.scope,
            missingFields: captured.missingFields,
            partialPayload: captured.partialPayload,
            targetStatus: packet.referenceResolution?.target ? 'resolved' : 'absent',
            askedQuestion: captured.askedQuestion?.length > 200
              ? `${captured.askedQuestion.slice(0, 200)}…`
              : captured.askedQuestion,
            source: 'router_clarify_mode',
          });
        } else {
          logger.debug('[pending-clarifier] not_captured_for_clarify', {
            reason: routedCommand.reason ?? 'unknown',
            hasReferenceTarget: !!packet.referenceResolution?.target,
          });
        }
        const assistantMessage: Message = {
          id: `${Date.now()}-clarify`,
          role: 'assistant',
          content: routedCommand.question,
        };
        setMessages((prev) => [...prev, userMessage, assistantMessage]);
        setInputValue('');
        return;
      }

      // ───────────── READINESS / ADAPTATION CHAT PATH ─────────────
      // ProgramEdit gets first refusal. A bare "I'm cooked" or "legs are
      // cooked" is an ambiguous program-edit request and must ask which
      // scope to adjust, not silently write a low-readiness constraint.
      // Only turns the typed router leaves as non-mutating check-ins can
      // reach this lightweight readiness signal path.
      const readinessAction = routeCoachReadinessMessage({
        message: userMessage.content,
        pending: pendingReadinessRef.current,
      });
      if ('clearPending' in readinessAction && readinessAction.clearPending) {
        pendingReadinessRef.current = null;
      }
      if (readinessAction.kind === 'clarify') {
        pendingReadinessRef.current = readinessAction.pending;
        logger.debug('[coach-readiness] clarify', {
          reason: readinessAction.reason,
        });
        const assistantMessage: Message = {
          id: `${Date.now()}-readiness-clarify`,
          role: 'assistant',
          content: readinessAction.reply,
        };
        setMessages((prev) => [...prev, userMessage, assistantMessage]);
        setInputValue('');
        return;
      }
      if (readinessAction.kind === 'apply_signal') {
        const todayISO = todayISOLocal();
        useReadinessStore.getState().setReadinessSignal(todayISO, {
          ...readinessAction.signal,
          source: 'coach_message',
        });
        logger.debug('[coach-readiness] applied', {
          reason: readinessAction.reason,
          todayISO,
          signal: readinessAction.signal,
        });
        const assistantMessage: Message = {
          id: `${Date.now()}-readiness`,
          role: 'assistant',
          content: [
            buildSessionAwareReadinessReply(readinessAction, todayISO),
            describeTodayReadinessImpact(todayISO),
          ].join('\n\n'),
        };
        setMessages((prev) => [...prev, userMessage, assistantMessage]);
        setInputValue('');
        return;
      }

      // routedCommand.mode is 'conversation' (or legacy 'explain') /
      // 'inspect_state' — fall through to the dispatcher for a grounded
      // non-mutating reply.
      // The legacy /coach-chat path is now CONVERSATION-ONLY: the
      // mutation router has already classified mutations and routed
      // them locally, so the legacy text fallback can never apply
      // structural changes.

      // We already tried the LLM edit parser above for mutation-like
      // turns the router could not structure. For read-only conversation
      // and inspect-state paths, skip the intent classifier and synthesize
      // the same safe fallback shape locally; the legacy /coach-chat path
      // below is conversation-only and cannot mutate state.
      const intent: CoachIntent = {
        intent: 'general_question',
        confidence: 0,
        needsClarification: false,
        rationale: `router_mode_${routedCommand.mode}_bypass`,
      };
      classifiedCoachIntent = intent;
      logger.debug('[coach-flow] intent', {
        kind: intent.intent,
        confidence: intent.confidence,
        needsClarification: intent.needsClarification,
        source: 'router_bypass',
      });

      const deps = buildLiveDispatchDeps(todayISOLocal());
      const outcome = dispatchCoachIntent(intent, packet, deps);

      if (outcome.handled) {
        if (outcome.pendingCoachProposal !== undefined) {
          pendingCoachProposalRef.current = outcome.pendingCoachProposal;
        }
        // Phase 2 — when the dispatcher tied its reply to a specific
        // session (program_explanation / session_mismatch_question
        // outcomes carry a `referencedSession`), write it into the
        // durable coach context store so a follow-up like "change it
        // to a bike" knows what "it" refers to. Modality stamps are
        // re-derived from the visible day so "the row" matches.
        if (outcome.referencedSession) {
          const day = packet.currentWeek.find(
            (d) => d.date === outcome.referencedSession!.date,
          );
          const modalities = day?.workout
            ? extractModalitiesFromSession({
                name: day.workout.name,
                exercises: day.workout.exercises,
              })
            : undefined;
          useCoachContextStateStore.getState().setLastExplainedSession({
            date: outcome.referencedSession.date,
            sessionName: outcome.referencedSession.sessionName,
            modalities,
            source: 'coach_explanation',
          });
          logger.debug('[coach-flow] last_explained_set', {
            date: outcome.referencedSession.date,
            sessionName: outcome.referencedSession.sessionName,
            replyMode: outcome.replyMode,
          });
        }
        logger.debug('[coach-transaction]', {
          message: userMessage.content,
          intent: intent.intent,
          route: outcome.transaction?.route ?? outcome.replyMode,
          pendingProposalBefore: outcome.transaction?.pendingProposalBefore ?? null,
          mutationAttempted: outcome.transaction?.mutationAttempted ?? outcome.mutated,
          eventsEmitted: outcome.transaction?.eventsEmitted ?? 0,
          eventsApplied: outcome.transaction?.eventsApplied ?? 0,
          visibleDiff: outcome.transaction?.visibleDiff ?? [],
          replyMode: outcome.replyMode,
        });
        logger.debug('[coach-flow] dispatcher_handled', {
          replyMode: outcome.replyMode,
          mutated: outcome.mutated,
        });
        setLastCoachDebug({
          intent: intent.intent,
          route: outcome.transaction?.route ?? outcome.replyMode,
          referenceStatus: packet.referenceResolution?.status ?? null,
          referenceTargetDate: outcome.referencedSession?.date
            ?? packet.referenceResolution?.target?.date
            ?? null,
          referenceTargetName: outcome.referencedSession?.sessionName
            ?? packet.referenceResolution?.target?.sessionName
            ?? null,
          mutationLike: false,
          legacyCalled: false,
          replySource: 'deterministic' as const,
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
      if (isPendingProgramProposalExpired(pendingCoachProposalRef.current)) {
        pendingCoachProposalRef.current = null;
      }

      // ─── Phase 2 truth gate ───────────────────────────────────────
      // Mutation-like messages must NEVER reach the legacy
      // /coach-chat text fallback. If the deterministic dispatcher
      // chose not to handle the turn, we either ask a clarifier (no
      // resolved target) or fail honestly (target resolved but no
      // deterministic modality swap route exists yet — Phase 4
      // territory). The legacy path can still answer pure
      // explanations and chit-chat.
      const mutationLike = isMutationLike(userMessage.content);
      if (mutationLike) {
        const refRes = packet.referenceResolution ?? null;
        let reply: string;
        let gateReason: string;
        if (refRes?.status === 'resolved' && refRes.target) {
          gateReason = 'mutation_unsupported_target_resolved';
          const dayLabel = (() => {
            try {
              return new Date(`${refRes.target.date}T12:00:00`)
                .toLocaleDateString(undefined, { weekday: 'long' });
            } catch {
              return refRes.target.date;
            }
          })();
          reply =
            `I can see you mean ${dayLabel}'s ${refRes.target.sessionName}, ` +
            `but I can't apply that change automatically yet. ` +
            `I'm not going to pretend it's done.`;
        } else if (refRes?.clarifierQuestion) {
          gateReason = `mutation_clarifier_${refRes.status}`;
          reply = refRes.clarifierQuestion;
        } else {
          gateReason = 'mutation_no_target';
          reply = 'Which session do you mean?';
        }
        logger.debug('[coach-flow] mutation_truth_gate', {
          reason: gateReason,
          referenceStatus: refRes?.status ?? null,
          referenceTarget: refRes?.target ?? null,
        });
        logger.debug('[coach-transaction]', {
          message: userMessage.content,
          intent: classifiedCoachIntent?.intent ?? 'mutation_truth_gate',
          route: 'mutation_truth_gate',
          pendingProposalBefore: pendingCoachProposalRef.current,
          mutationAttempted: false,
          eventsEmitted: 0,
          eventsApplied: 0,
          visibleDiff: [],
          replyMode: 'program_adjustment_failed',
        });
        const assistantMessage: Message = {
          id: `${Date.now()}-truth-gate`,
          role: 'assistant',
          content: reply,
        };
        setMessages((prev) => [...prev, userMessage, assistantMessage]);
        setInputValue('');
        return;
      }
    } catch (err) {
      // Defensive: if the dispatcher itself throws (shouldn't), fail
      // closed for program-adjustment turns; other turns can still
      // use legacy rather than crashing the chat.
      logger.warn('[coach-flow] dispatcher_error', {
        detail: err instanceof Error ? err.message : String(err),
      });
      if (
        pendingCoachProposalRef.current ||
        classifiedCoachIntent?.intent === 'request_program_adjustment'
      ) {
        const assistantMessage: Message = {
          id: `${Date.now()}-program-adjustment-error`,
          role: 'assistant',
          content:
            "I tried to handle that program adjustment, but it didn't land in the visible program. I'm not going to pretend it changed.",
        };
        pendingCoachProposalRef.current = null;
        logger.debug('[coach-transaction]', {
          message: userMessage.content,
          intent: classifiedCoachIntent?.intent ?? 'dispatcher_error',
          route: 'program_adjustment_dispatcher_error',
          pendingProposalBefore: null,
          mutationAttempted: false,
          eventsEmitted: 0,
          eventsApplied: 0,
          visibleDiff: [],
          replyMode: 'program_adjustment_failed',
        });
        setMessages((prev) => [...prev, userMessage, assistantMessage]);
        setInputValue('');
        return;
      }
    }
    logger.debug('[coach-flow] legacy_fallback', {
      reason: 'dispatcher_did_not_handle',
    });
    logger.debug('[coach-transaction]', {
      message: userMessage.content,
      intent: 'legacy_fallback',
      route: 'legacy_fallback',
      pendingProposalBefore: pendingCoachProposalRef.current,
      mutationAttempted: false,
      eventsEmitted: 0,
      eventsApplied: 0,
      visibleDiff: [],
      replyMode: 'fall_through',
    });
    setLastCoachDebug({
      intent: classifiedCoachIntent?.intent ?? 'legacy_fallback',
      route: 'legacy_fallback',
      referenceStatus: null,
      referenceTargetDate: null,
      referenceTargetName: null,
      mutationLike: false,
      legacyCalled: true,
      replySource: 'legacy' as const,
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
            ref={lastCoachDebug.referenceStatus ?? '–'}{' '}
            target={lastCoachDebug.referenceTargetDate ?? '–'}{' '}
            ({lastCoachDebug.referenceTargetName ?? '–'})
          </Text>
          <Text style={{ color: '#9F9', fontSize: 10 }}>
            mutationLike={String(lastCoachDebug.mutationLike)} {' | '}
            legacyCalled={String(lastCoachDebug.legacyCalled)} {' | '}
            replySource={lastCoachDebug.replySource}
          </Text>
          {lastCoachDebug.toModality !== undefined ? (
            <Text style={{ color: '#9F9', fontSize: 10 }}>
              swap={String(lastCoachDebug.fromModality ?? '–')}→
              {String(lastCoachDebug.toModality ?? '–')} {' | '}
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
                {coachProgressLabel
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
              isLoading && { opacity: 0.5 },
            ]}
            onPress={handleSend}
            disabled={isLoading || !inputValue.trim()}
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
