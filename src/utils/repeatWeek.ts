/**
 * repeatWeek.ts — deterministic "repeat a week" mechanism (Bible §13
 * "When to repeat a week").
 *
 * Bible intent: if the athlete missed too much, was sick/cooked, found the
 * week too hard, or simply needs more time before progressing, the app should
 * be able to REPEAT the current training week instead of forcing progression —
 * "Do not progress just because a week passed."
 *
 * ARCHITECTURE — reuse, don't reinvent
 * ------------------------------------
 * A repeat is expressed with the EXISTING week-scoped overlay mechanism
 * (`WeekScopedWorkoutOverlay`), the same one used for one-off game weeks. The
 * overlay is SPARSE: it only overrides the source week's training days onto the
 * target week's dates. Days it omits fall through to the target week's own base
 * program — which is exactly how the target week's real game / team-training
 * anchors keep winning, and how a stale source-week game is never copied.
 *
 *   • Held progression  — copied source workouts carry the source week's
 *                         prescriptions and (deload) intensity, so load holds
 *                         instead of advancing.
 *   • Target anchors win — game/team DOWs are omitted → base target week shows.
 *   • No stale game copy — source `Game` workouts are skipped.
 *   • Owner / id         — `reason: 'repeat_week'` overlay keyed by target week
 *                         start; cleared with `removeWeekScopedOverlay`.
 *   • Sweep policy       — the store action runs the shared `decideOverrideSweep`
 *                         so manual edits and live constraints are preserved /
 *                         cleared exactly as every other rebuild.
 *   • Block rollover     — untouched: no block-number advance, no block-anchor
 *                         shift. A repeat is an overlay, not a progression.
 *
 * No LLM, no coach chat, no new generation path.
 */

import type {
  DayOfWeek,
  OnboardingData,
  TrainingProgram,
  Workout,
  WeekScopedWorkoutOverlay,
} from '../types/domain';
import type { WeeklyExposureContract } from '../rules/weeklyExposureContract';
import type { WeeklyExposureContractV2 } from '../rules/weeklyExposureContractV2';
import { buildCoachingPlan, onboardingToCoachingInputs } from './coachingEngine';
import { addDays, getMondayForDate } from './sessionResolver';
import { getProgramBlockStateForDate, selectMicrocycleForDate } from './programBlockState';
import { resolveEquipmentCapabilities } from './equipmentAvailability';
import { collectWeekRebuildContext, decideOverrideSweep, type OverrideSweepDecision } from './weekRebuild';
import { useProgramStore } from '../store/programStore';
import { todayISOLocal } from './appDate';
import { logger } from './logger';

const DAY_NAME_TO_NUM: Record<DayOfWeek, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

/** Deterministic owner id for a repeat-week overlay (clearable / sweepable). */
export function repeatWeekOverlayId(targetWeekStart: string): string {
  return `week-overlay:${targetWeekStart}:repeat_week`;
}

export function isRepeatWeekOverlay(overlay: WeekScopedWorkoutOverlay | null | undefined): boolean {
  return overlay?.reason === 'repeat_week';
}

/** ISO date within `weekStart`'s week for a given day-of-week number (0-6). */
function dateForDowInWeek(weekStart: string, dow: number): string {
  const mondayOffset = dow === 0 ? 6 : dow - 1;
  return addDays(weekStart, mondayOffset);
}

function isGameWorkout(workout: Workout): boolean {
  return workout.workoutType === 'Game';
}

function cloneWorkoutForRepeat(workout: Workout, date: string, overlayId: string): Workout {
  const id = `${workout.id}:repeat-week:${date}`;
  const dow = new Date(`${date}T12:00:00`).getDay();
  return {
    ...workout,
    id,
    microcycleId: overlayId,
    dayOfWeek: dow,
    exercises: (workout.exercises ?? []).map((exercise) => ({
      ...exercise,
      workoutId: id,
    })),
  };
}

export interface BuildRepeatWeekOverlayArgs {
  /** The source week's resolved/generated workouts (held-progression content). */
  sourceWorkouts: Workout[];
  /** Monday ISO of the target week the repeat lands on. */
  targetWeekStart: string;
  /**
   * DOWs (0-6) that are TARGET-week anchors — the recurring game day and team
   * training days. These are OMITTED from the overlay so the base target week's
   * real anchors win.
   */
  targetAnchorDows?: number[];
  /**
   * Explicit target-week workouts that must WIN over any copied source content
   * (e.g. a one-off game that exists only in the target week). Keyed by ISO
   * date within the target week.
   */
  targetWinningWorkoutsByDate?: Record<string, Workout>;
  /** Contract resolved for the target week; never copied from the source. */
  targetExposureContract?: WeeklyExposureContract;
  /** Parallel Section 18 target-week contract. */
  targetExposureContractV2?: WeeklyExposureContractV2;
}

/**
 * Build a sparse `repeat_week` overlay for the target week from the source
 * week's workouts. Pure — no store access.
 */
export function buildRepeatWeekOverlay(args: BuildRepeatWeekOverlayArgs): WeekScopedWorkoutOverlay {
  const overlayId = repeatWeekOverlayId(args.targetWeekStart);
  const anchorDows = new Set(args.targetAnchorDows ?? []);
  const now = new Date().toISOString();
  const workoutsByDate: Record<string, Workout | null> = {};

  for (const workout of args.sourceWorkouts ?? []) {
    const dow = workout.dayOfWeek;
    // Never copy a stale game/practice-match from the source week.
    if (isGameWorkout(workout)) continue;
    // Target-week anchors (game/team) win — leave those days to the base week.
    if (anchorDows.has(dow)) continue;
    const date = dateForDowInWeek(args.targetWeekStart, dow);
    workoutsByDate[date] = cloneWorkoutForRepeat(workout, date, overlayId);
  }

  // Any explicit target-week winning workout (one-off game) overrides the copy.
  for (const [date, workout] of Object.entries(args.targetWinningWorkoutsByDate ?? {})) {
    workoutsByDate[date] = workout;
  }

  return {
    id: overlayId,
    weekStart: args.targetWeekStart,
    weekEnd: addDays(args.targetWeekStart, 6),
    anchorDate: null,
    reason: 'repeat_week',
    exposureContract: args.targetExposureContract,
    exposureContractV2: args.targetExposureContractV2,
    workoutsByDate,
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Feedback recommender (Bible §13 "When to repeat a week") ──────────

export interface RepeatWeekFeedbackSummary {
  /** Sessions the week planned. */
  plannedSessions: number;
  /** Sessions actually completed. */
  completedSessions: number;
  /** Athlete reported the week / its sessions as too hard. */
  reportedTooHard?: boolean;
  /** Week disrupted by illness. */
  wasSick?: boolean;
  /** Athlete was very cooked / fatigued. */
  wasCooked?: boolean;
  /** Explicit "repeat this week" request. */
  userRequestedRepeat?: boolean;
}

/**
 * Should the app recommend repeating the week? Deterministic, advisory only —
 * this never forces a repeat, it only signals that one is appropriate per the
 * Bible triggers (missed key sessions, illness, struggled with the dose, needs
 * more time before progressing).
 */
export function shouldRecommendRepeatWeek(summary: RepeatWeekFeedbackSummary): boolean {
  if (summary.userRequestedRepeat) return true;
  if (summary.wasSick || summary.wasCooked || summary.reportedTooHard) return true;
  const planned = Math.max(0, summary.plannedSessions);
  if (planned > 0) {
    const completedRatio = Math.max(0, summary.completedSessions) / planned;
    if (completedRatio < 0.5) return true; // missed too much of the week
  }
  return false;
}

// ─── Store-wired action ───────────────────────────────────────────────

export interface RepeatWeekResult {
  overlay: WeekScopedWorkoutOverlay;
  sweep: OverrideSweepDecision;
  sourceWeekStart: string;
  targetWeekStart: string;
}

function anchorDowsForProfile(profile: OnboardingData): number[] {
  const dows = new Set<number>();
  const gameDay = (profile.usualGameDay || profile.gameDay) as DayOfWeek | undefined;
  if (gameDay && gameDay in DAY_NAME_TO_NUM) dows.add(DAY_NAME_TO_NUM[gameDay]);
  for (const day of profile.teamTrainingDays ?? []) {
    if (day in DAY_NAME_TO_NUM) dows.add(DAY_NAME_TO_NUM[day as DayOfWeek]);
  }
  return Array.from(dows);
}

function gameDowForProfile(profile: OnboardingData): number[] {
  const gameDay = (profile.usualGameDay || profile.gameDay) as DayOfWeek | undefined;
  return gameDay && gameDay in DAY_NAME_TO_NUM ? [DAY_NAME_TO_NUM[gameDay]] : [];
}

function resolveRepeatTargetExposureContracts(args: {
  profile: OnboardingData;
  program: TrainingProgram;
  targetWeekStart: string;
}): { legacy: WeeklyExposureContract; v2: WeeklyExposureContractV2 } {
  const blockState = getProgramBlockStateForDate({
    dateISO: args.targetWeekStart,
    programStartISO: args.program.startDate,
    blockNumber: args.program.microcycles?.[0]?.miniCycleNumber ?? 1,
    seasonPhase: args.profile.seasonPhase,
  });
  const equipment = resolveEquipmentCapabilities(args.profile, [], args.targetWeekStart);
  const inputs = onboardingToCoachingInputs(args.profile, {
    availabilityDateISO: args.targetWeekStart,
    miniCycleNumber: blockState.miniCycleNumber,
    weekInBlock: blockState.weekInBlock,
    weekNumber: blockState.weekNumber,
    weekKind: blockState.weekKind,
    appConditioningFeasible: equipment.conditioningModalities.length > 0,
  });
  const plan = buildCoachingPlan(inputs);
  return {
    legacy: plan.weeklyExposureContract!,
    v2: plan.weeklyExposureContractV2!,
  };
}

/**
 * Repeat the source week into the next week, committed as a `repeat_week`
 * overlay through the shared sweep policy. Synchronous; reads the live stores.
 * Progression / block rollover are left untouched.
 */
export function repeatWeekIntoNextWeek(args: {
  baseProfile: OnboardingData;
  /** Any date inside the source (current) week. */
  sourceWeekDate: string;
  todayISO?: string;
}): RepeatWeekResult {
  const todayISO = args.todayISO ?? todayISOLocal();
  const program: TrainingProgram | null = useProgramStore.getState().currentProgram;
  if (!program) {
    throw new Error('Cannot repeat a week without a current program');
  }

  const sourceWeekStart = getMondayForDate(args.sourceWeekDate.split('T')[0]);
  const targetWeekStart = addDays(sourceWeekStart, 7);

  const sourceMicrocycle = selectMicrocycleForDate(program, null, sourceWeekStart);
  const sourceWorkouts = sourceMicrocycle?.workouts ?? program.microcycles?.[0]?.workouts ?? [];

  // Preserve any existing target-week one-off game so it keeps winning.
  const existingTargetOverlay = useProgramStore.getState().weekScopedOverlays?.[targetWeekStart];
  const targetMicrocycle = selectMicrocycleForDate(program, null, targetWeekStart);
  const targetWinningWorkoutsByDate: Record<string, Workout> = {};
  if (existingTargetOverlay && existingTargetOverlay.reason === 'one_off_game') {
    for (const [date, workout] of Object.entries(existingTargetOverlay.workoutsByDate)) {
      if (workout && workout.workoutType === 'Game') targetWinningWorkoutsByDate[date] = workout;
    }
  }

  const resolvedTargetContracts = (
    !existingTargetOverlay?.exposureContract && !targetMicrocycle?.exposureContract
  ) || (
    !existingTargetOverlay?.exposureContractV2 && !targetMicrocycle?.exposureContractV2
  )
    ? resolveRepeatTargetExposureContracts({
        profile: args.baseProfile,
        program,
        targetWeekStart,
      })
    : null;
  const overlay = buildRepeatWeekOverlay({
    sourceWorkouts,
    targetWeekStart,
    // With an in-program target, its base anchor workouts win. Immediately
    // beyond the current window there is no base team workout to fall through
    // to, so retain the repeated recurring team session and omit only game
    // content (fixture credit is projected by the target contract).
    targetAnchorDows: targetMicrocycle
      ? anchorDowsForProfile(args.baseProfile)
      : gameDowForProfile(args.baseProfile),
    targetWinningWorkoutsByDate,
    targetExposureContract:
      existingTargetOverlay?.exposureContract ?? targetMicrocycle?.exposureContract ??
        resolvedTargetContracts!.legacy,
    targetExposureContractV2:
      existingTargetOverlay?.exposureContractV2 ?? targetMicrocycle?.exposureContractV2 ??
        resolvedTargetContracts?.v2,
  });

  // Shared sweep policy — preserve manual edits / live-constraint overrides,
  // clear system junk and dead-owner leftovers, resolve game-window conflicts.
  const context = collectWeekRebuildContext({
    baseProfile: args.baseProfile,
    newGameDay: undefined,
    program,
    todayISO,
  });
  const sweep = decideOverrideSweep(context);

  const store = useProgramStore.getState();
  store.setWeekScopedOverlay(overlay);
  for (const date of sweep.clear) {
    store.removeManualOverride(date);
  }

  logger.debug('[repeatWeek] committed repeat_week overlay', {
    sourceWeekStart,
    targetWeekStart,
    days: Object.keys(overlay.workoutsByDate),
    cleared: sweep.clear,
  });

  return { overlay, sweep, sourceWeekStart, targetWeekStart };
}

/** Clear a previously-committed repeat-week overlay for the given target week. */
export function clearRepeatWeek(targetWeekStart: string): void {
  useProgramStore.getState().removeWeekScopedOverlay(getMondayForDate(targetWeekStart.split('T')[0]));
}
