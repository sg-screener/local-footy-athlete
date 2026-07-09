/**
 * weekRebuild.ts — THE canonical deterministic week-rebuild path.
 *
 * Architecture rule (Sam, 2026-07-08): no rebuild may forget active
 * context. Every tap/edit rebuild must flow through `rebuildLocalWeek`,
 * which assembles ONE canonical context from the real stores:
 *
 *   • base profile + game/no-game overlay        (profile layer)
 *   • every per-date manual override + its
 *     ownership/intent metadata                  (override layer)
 *   • every active Coach Note constraint
 *     (busy/away, readiness, injury, schedule)   (constraint layer)
 *   • the new game anchors for the commit scope  (protection layer)
 *
 * and then, in ONE synchronous commit:
 *
 *   1. builds the candidate program from base programming rules
 *      (generateProgramLocally — no LLM, no network),
 *   2. decides the override sweep with the PURE `decideOverrideSweep`
 *      (preserve modifier-owned + user edits; clear system junk; resolve
 *      game-window conflicts out loud),
 *   3. commits game mark + program (block rebuild) OR week overlay
 *      (one-off game/practice-match rebuild) + sweep together — atomically.
 *      A failure before commit changes NOTHING.
 *
 * Invariant: a user-removed day/session can only come back if the user
 * clears the owning adjustment, or the rebuild explicitly reports that
 * the edit conflicted with game-day protection (`conflictsRemoved`).
 *
 * Constraints (readiness / busy / injury) never need "preserving" here:
 * they live in coachUpdatesStore, which no rebuild path touches, and are
 * re-applied to the fresh template at resolve time.
 *
 * A static architectural test (weekRebuildIntegrationTests) forbids the
 * home screen from calling generateProgramLocally or the store sweep
 * directly — this module is the only door.
 */

import type {
  DayOfWeek,
  OnboardingData,
  OverrideContext,
  TrainingProgram,
  Workout,
  WeekScopedWorkoutOverlay,
} from '../types/domain';
import { generateProgramLocally } from '../services/api/generateProgram';
import { applyGameDayChange } from './profileMutations';
import { addDays, computeGameDatesForBlock, getMondayForDate } from './sessionResolver';
import { getCurrentBlockNumberForGeneration, useProgramStore } from '../store/programStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { classifyDaySessions } from '../rules/sessionTaxonomy';
import { classifySessionStress } from '../rules/stressClassification';
import { todayISOLocal } from './appDate';
import { logger } from './logger';

// ─── Canonical context ───────────────────────────────────────────────

export interface WeekRebuildContext {
  todayISO: string;
  /** Base profile with the game/no-game overlay already applied. */
  profile: OnboardingData;
  /** New game anchors across the candidate block ([] = no-game rebuild). */
  gameDates: string[];
  /** Snapshot of EVERY per-date override at rebuild time. */
  overrides: Record<string, Workout>;
  /** Ownership/intent metadata for each override. */
  overrideContexts: Record<string, OverrideContext>;
  /** Ids of constraints that are live (present + unexpired) right now. */
  activeConstraintIds: Set<string>;
}

export interface OverrideSweepDecision {
  preserve: string[];
  clear: string[];
  conflictsRemoved: Array<{ date: string; name: string }>;
}

export interface WeekRebuildResult {
  program: TrainingProgram;
  context: WeekRebuildContext;
  sweep: OverrideSweepDecision;
  overlay?: WeekScopedWorkoutOverlay;
}

// ─── Pure sweep decision ─────────────────────────────────────────────

function expiresAtOf(c: unknown): string | undefined {
  const value = (c as { expiresAt?: unknown })?.expiresAt;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Live = present and not expired relative to todayISO. */
export function liveConstraintIds(
  constraints: Array<{ id: string }>,
  todayISO: string,
): Set<string> {
  return new Set(
    (constraints ?? [])
      .filter((c) => {
        const end = expiresAtOf(c);
        return !(end && end < todayISO);
      })
      .map((c) => c.id),
  );
}

/** Whole days between two ISO dates (b - a). */
function isoDayDiff(a: string, b: string): number {
  return Math.round(
    (new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86400000,
  );
}

const DAY_NAMES: DayOfWeek[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function dayNameForDate(dateISO: string): DayOfWeek {
  return DAY_NAMES[new Date(`${dateISO}T12:00:00`).getDay()];
}

function hasEffectiveGameAnchor(profile: OnboardingData): boolean {
  const day = profile.usualGameDay || profile.gameDay;
  return day === 'Monday' ||
    day === 'Tuesday' ||
    day === 'Wednesday' ||
    day === 'Thursday' ||
    day === 'Friday' ||
    day === 'Saturday' ||
    day === 'Sunday';
}

function cloneWorkoutForOverlay(
  workout: Workout,
  date: string,
  overlayId: string,
): Workout {
  const id = `${workout.id}:week-overlay:${date}`;
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

export function buildWeekScopedWorkoutOverlay(args: {
  program: TrainingProgram;
  weekStart: string;
  anchorDate: string | null;
  reason: WeekScopedWorkoutOverlay['reason'];
}): WeekScopedWorkoutOverlay {
  const sourceMicrocycle = args.program.microcycles?.[0];
  if (!sourceMicrocycle) {
    throw new Error('Cannot build week overlay without a source microcycle');
  }

  const now = new Date().toISOString();
  const overlayId = `week-overlay:${args.weekStart}:${args.reason}:${args.anchorDate ?? 'no-anchor'}`;
  const byDow = new Map<number, Workout>();
  for (const workout of sourceMicrocycle.workouts ?? []) {
    byDow.set(workout.dayOfWeek, workout);
  }

  const workoutsByDate: Record<string, Workout | null> = {};
  for (let offset = 0; offset < 7; offset++) {
    const date = addDays(args.weekStart, offset);
    const dow = new Date(`${date}T12:00:00`).getDay();
    const workout = byDow.get(dow) ?? null;
    workoutsByDate[date] = workout ? cloneWorkoutForOverlay(workout, date, overlayId) : null;
  }

  return {
    id: overlayId,
    weekStart: args.weekStart,
    weekEnd: addDays(args.weekStart, 6),
    anchorDate: args.anchorDate,
    reason: args.reason,
    workoutsByDate,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Does a preserved USER override collide with the protection window of a
 * game anchor? Deterministic, Bible-stress-model based:
 *   • an override ON a game date always conflicts (manual overrides
 *     outrank the game mark at resolve time — it would hide the game);
 *   • HIGH-stress content on G-1 or G-2 conflicts;
 *   • HIGH-stress content on G+1 conflicts;
 *   • light/medium edits near the game are Bible-legal and survive.
 */
export function overrideConflictsWithGameWindow(
  date: string,
  workout: Workout,
  gameDates: string[],
): boolean {
  for (const g of gameDates) {
    const diff = isoDayDiff(date, g);
    if (diff === 0) return true;
    if (diff === 1 || diff === 2 || diff === -1) {
      const units = classifyDaySessions(workout);
      const hard = units.some(
        (u) =>
          u.category !== 'team_training' &&
          u.category !== 'game' &&
          classifySessionStress(u, workout) === 'high',
      );
      if (hard) return true;
    }
  }
  return false;
}

/**
 * PURE sweep policy — no store access. Given the canonical snapshot,
 * decide the fate of every override:
 *
 *   PRESERVE  owned by a live constraint  (busy/away days, recovery mode,
 *             injury adjustments — the Coach Note's promise)
 *   PRESERVE  user manual edits: intent 'dismissed' (bin / move / swap /
 *             lighten / exercise edits) or 'program_adjustment'
 *             (tap sheet + coach-revision writer)
 *   CLEAR     dead-owner leftovers (their note was cleared/expired)
 *   CLEAR     system artifacts: 'gameProximity' conversions, contextless
 *             legacy overrides
 *   CONFLICT  preserved user edits that violate a NEW game window are
 *             cleared AND reported — resolved out loud, never silently.
 */
export type OverrideSweepInput = Pick<
  WeekRebuildContext,
  'gameDates' | 'overrides' | 'overrideContexts' | 'activeConstraintIds'
>;

export function decideOverrideSweep(ctx: OverrideSweepInput): OverrideSweepDecision {
  const preserve: string[] = [];
  const clear: string[] = [];
  const conflictsRemoved: Array<{ date: string; name: string }> = [];

  for (const date of Object.keys(ctx.overrides ?? {})) {
    const workout = ctx.overrides[date];
    const octx = ctx.overrideContexts?.[date];
    const ownerId = octx?.activeModifierId;
    const ownedByActive = Boolean(ownerId && ctx.activeConstraintIds.has(ownerId));
    const ownedByDead = Boolean(ownerId && !ctx.activeConstraintIds.has(ownerId));
    const isUserEdit = octx?.intent === 'dismissed' || octx?.intent === 'program_adjustment';

    let keep = ownedByActive || (isUserEdit && !ownedByDead);

    if (keep && !ownedByActive && isUserEdit && ctx.gameDates.length > 0) {
      if (overrideConflictsWithGameWindow(date, workout, ctx.gameDates)) {
        conflictsRemoved.push({ date, name: workout?.name ?? 'Custom session' });
        keep = false;
      }
    }

    (keep ? preserve : clear).push(date);
  }

  return { preserve, clear, conflictsRemoved };
}

// ─── Context assembly ────────────────────────────────────────────────

export function collectWeekRebuildContext(args: {
  baseProfile: OnboardingData;
  /** undefined = keep profile's game as-is; null = remove game; day = set game. */
  newGameDay?: DayOfWeek | null;
  program: TrainingProgram;
  todayISO?: string;
  /** Optional selected-week game anchors for one-off overlay rebuilds. */
  gameDatesOverride?: string[];
}): WeekRebuildContext {
  const todayISO = args.todayISO ?? todayISOLocal();
  const profile =
    args.newGameDay === undefined
      ? args.baseProfile
      : applyGameDayChange(args.baseProfile, args.newGameDay);
  const effectiveGameDay = (profile.usualGameDay || profile.gameDay) as DayOfWeek | undefined;
  const gameDates = args.gameDatesOverride ?? (
    effectiveGameDay && ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].includes(effectiveGameDay)
      ? computeGameDatesForBlock(
          effectiveGameDay,
          args.program.startDate.split('T')[0],
          args.program.endDate.split('T')[0],
        )
      : []
  );
  const programState = useProgramStore.getState();
  return {
    todayISO,
    profile,
    gameDates,
    overrides: { ...(programState.dateOverrides ?? {}) },
    overrideContexts: { ...(programState.overrideContexts ?? {}) },
    activeConstraintIds: liveConstraintIds(
      useCoachUpdatesStore.getState().activeConstraints ?? [],
      todayISO,
    ),
  };
}

// ─── The canonical rebuild ───────────────────────────────────────────

export interface RebuildLocalWeekArgs {
  baseProfile: OnboardingData;
  /** undefined = rebuild with profile as-is; null = remove game; day = set game. */
  newGameDay?: DayOfWeek | null;
  todayISO?: string;
  /**
   * block:       replace the shared program template (full rebuild / phase shift)
   * weekOverlay: keep the base template and commit only a selected-week overlay.
   */
  scope?: 'block' | 'weekOverlay';
  /** Any date inside the selected week; for game adds/moves this is the game date. */
  targetDate?: string;
  /** Optional old game date whose overlay should be cleared during a move. */
  clearOverlayDate?: string;
  /**
   * Calendar-mark mutation(s) that belong to this change (setGameDay /
   * removeGameDay + noGame marks). Executed INSIDE the commit, after the
   * candidate build succeeded — never before.
   */
  commitGameMark?: () => void;
}

/**
 * Build + commit a deterministic week rebuild. Synchronous; throws
 * BEFORE any state mutation on failure (atomic by construction).
 */
export function rebuildLocalWeek(args: RebuildLocalWeekArgs): WeekRebuildResult {
  const todayISO = args.todayISO ?? todayISOLocal();
  const scope = args.scope ?? 'block';
  const targetDate = args.targetDate?.split('T')[0];

  if (scope === 'weekOverlay' && !targetDate) {
    throw new Error('Week-scoped rebuild requires targetDate');
  }

  const profile =
    args.newGameDay === undefined
      ? args.baseProfile
      : applyGameDayChange(args.baseProfile, args.newGameDay);

  const targetWeekStart = targetDate ? getMondayForDate(targetDate) : null;
  const gameDatesOverride =
    scope === 'weekOverlay' && args.newGameDay
      ? [targetDate!]
      : scope === 'weekOverlay'
        ? []
        : undefined;

  if (scope === 'weekOverlay' && args.newGameDay && dayNameForDate(targetDate!) !== args.newGameDay) {
    throw new Error(`Week-scoped game rebuild target ${targetDate} does not match ${args.newGameDay}`);
  }

  if (
    scope === 'weekOverlay' &&
    args.newGameDay === null &&
    !hasEffectiveGameAnchor(args.baseProfile)
  ) {
    const currentProgram = useProgramStore.getState().currentProgram;
    if (!currentProgram) {
      throw new Error('Cannot clear week overlay without a current program');
    }
    const context = collectWeekRebuildContext({
      baseProfile: args.baseProfile,
      newGameDay: args.newGameDay,
      program: currentProgram,
      todayISO,
      gameDatesOverride,
    });
    const sweep = decideOverrideSweep(context);

    args.commitGameMark?.();
    commitWeekScopedOverlay(null, sweep, {
      targetWeekStart: targetWeekStart!,
      clearOverlayDate: args.clearOverlayDate,
    });

    logger.debug('[weekRebuild] cleared week-scoped overlay', {
      weekStart: targetWeekStart,
      preserved: sweep.preserve,
      cleared: sweep.clear,
      conflictsRemoved: sweep.conflictsRemoved,
    });
    return { program: currentProgram, context, sweep };
  }

  // 1. Candidate week from base programming rules (throws on failure —
  //    nothing has been committed yet).
  const program = generateProgramLocally(profile, {
    todayISO,
    blockNumber: getCurrentBlockNumberForGeneration(todayISO),
  });

  // 2. Canonical context + pure sweep decision.
  const context = collectWeekRebuildContext({
    baseProfile: args.baseProfile,
    newGameDay: args.newGameDay,
    program,
    todayISO,
    gameDatesOverride,
  });
  const sweep = decideOverrideSweep(context);

  // 3. Atomic commit: game mark + program + sweep together.
  args.commitGameMark?.();
  let overlay: WeekScopedWorkoutOverlay | undefined;
  if (scope === 'weekOverlay') {
    overlay = buildWeekScopedWorkoutOverlay({
      program,
      weekStart: targetWeekStart!,
      anchorDate: args.newGameDay ? targetDate! : null,
      reason: args.newGameDay ? 'one_off_game' : 'one_off_no_game',
    });
    commitWeekScopedOverlay(overlay, sweep, {
      clearOverlayDate: args.clearOverlayDate,
    });
  } else {
    commitRebuiltProgram(program, sweep);
  }

  logger.debug('[weekRebuild] committed', {
    scope,
    gameDates: context.gameDates,
    overlayWeekStart: overlay?.weekStart,
    preserved: sweep.preserve,
    cleared: sweep.clear,
    conflictsRemoved: sweep.conflictsRemoved,
  });
  return { program, context, sweep, overlay };
}

/**
 * Commit a built program + sweep decision to the stores. Shared by the
 * local path (rebuildLocalWeek) and the AI path (onboarding/phase-shift),
 * so every rebuild applies the SAME preservation policy.
 */
export function commitRebuiltProgram(
  program: TrainingProgram,
  sweep: OverrideSweepDecision,
): void {
  const programStore = useProgramStore.getState();
  programStore.setCurrentProgram(program);
  if (program.microcycles && program.microcycles.length > 0) {
    const first = program.microcycles[0];
    programStore.setCurrentMicrocycle(first);
    const dow = new Date().getDay();
    const todayWorkout = first.workouts?.find((w) => w.dayOfWeek === dow);
    if (todayWorkout) programStore.setTodayWorkout(todayWorkout);
  }
  for (const date of sweep.clear) {
    programStore.removeManualOverride(date);
  }
}

function commitWeekScopedOverlay(
  overlay: WeekScopedWorkoutOverlay | null,
  sweep: OverrideSweepDecision,
  options?: {
    targetWeekStart?: string;
    clearOverlayDate?: string;
  },
): void {
  const programStore = useProgramStore.getState();
  if (options?.clearOverlayDate) {
    programStore.removeWeekScopedOverlay(getMondayForDate(options.clearOverlayDate));
  }
  if (overlay) {
    programStore.setWeekScopedOverlay(overlay);
  } else if (options?.targetWeekStart) {
    programStore.removeWeekScopedOverlay(options.targetWeekStart);
  }
  for (const date of sweep.clear) {
    programStore.removeManualOverride(date);
  }
}

export function clearWeekScopedOverlayForDate(args: {
  targetDate: string;
  commitGameMark?: () => void;
}): void {
  args.commitGameMark?.();
  useProgramStore.getState().removeWeekScopedOverlay(getMondayForDate(args.targetDate));
}

/**
 * Sweep decision for the AI rebuild path (no new game anchors): collect
 * the canonical snapshot and decide — used so the AI path shares the
 * exact preservation policy without duplicating it.
 */
export function decideSweepForCurrentStores(
  program: TrainingProgram,
  baseProfile: OnboardingData,
  todayISO: string = todayISOLocal(),
): OverrideSweepDecision {
  const context = collectWeekRebuildContext({
    baseProfile,
    newGameDay: undefined,
    program,
    todayISO,
  });
  return decideOverrideSweep(context);
}
