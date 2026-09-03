import type {
  ActiveScheduleConstraint,
} from '../store/coachUpdatesStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import type {
  DayOfWeek,
  SeasonPhase,
  TrainingProgram,
  WeekScopedWorkoutOverlay,
  Workout,
} from '../types/domain';
import type { FixtureMutationSourceMetadata } from '../types/fixtureMutation';
import type { OnboardingData } from '../types/domain';
import type { CanonicalAcceptedFixtureEditEffect } from '../rules/canonicalWeeklyFixtureEditState';
import {
  addDays,
  getMondayForDate,
  type ResolvedDay,
} from './sessionResolver';
import type { WeekRebuildResult } from './weekRebuild';

export type GameChangeAction = 'added' | 'removed' | 'moved';
export type GameChangeFixtureKind = 'game' | 'practice_match';

export interface GameChangeVisibleDay {
  date: string;
  dayOfWeek: number;
  workoutName: string | null;
  workoutType: string | null;
  sessionTier?: string | null;
}

export interface GameChangeCoachNoteInput {
  action: GameChangeAction;
  fixtureKind: GameChangeFixtureKind;
  targetDate: string;
  previousDate?: string | null;
  weekStartISO: string;
  before: readonly GameChangeVisibleDay[];
  after: readonly GameChangeVisibleDay[];
  todayISO?: string;
  adjustmentId?: string | null;
  source?: FixtureMutationSourceMetadata;
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

function dayName(dateISO: string): string {
  return DAY_NAMES[new Date(`${dateISO}T12:00:00`).getDay()] ?? 'That day';
}

function weekEnd(weekStartISO: string): string {
  return addDays(weekStartISO, 6);
}

function lower(value: string | null | undefined): string {
  return String(value ?? '').toLowerCase();
}

function visibleLabel(day: GameChangeVisibleDay | undefined): string {
  if (!day) return 'Off';
  if (day.workoutType === 'Game') return 'Game Day';
  return day.workoutName?.trim() || 'Off';
}

function rowChanged(
  before: GameChangeVisibleDay | undefined,
  after: GameChangeVisibleDay | undefined,
): boolean {
  return visibleLabel(before) !== visibleLabel(after);
}

function isLightPreGame(day: GameChangeVisibleDay | undefined): boolean {
  const text = `${day?.workoutName ?? ''} ${day?.workoutType ?? ''} ${day?.sessionTier ?? ''}`.toLowerCase();
  return /\b(recovery|rest|gunshow|arms|pump|mobility|optional|light)\b/.test(text);
}

function isRecoveryOrGunshow(day: GameChangeVisibleDay | undefined): boolean {
  const text = `${day?.workoutName ?? ''} ${day?.workoutType ?? ''} ${day?.sessionTier ?? ''}`.toLowerCase();
  return /\b(recovery|gunshow|arms|pump)\b/.test(text);
}

function hasSprintOrConditioning(day: GameChangeVisibleDay | undefined): boolean {
  const text = `${day?.workoutName ?? ''} ${day?.workoutType ?? ''}`.toLowerCase();
  return /\b(sprint|speed|cod|conditioning|interval|metcon|running)\b/.test(text);
}

function hardLowerOrConditioning(day: GameChangeVisibleDay | undefined): boolean {
  const text = `${day?.workoutName ?? ''} ${day?.workoutType ?? ''} ${day?.sessionTier ?? ''}`.toLowerCase();
  return /\b(lower|hinge|squat|deadlift|conditioning|interval|sprint|speed|cod)\b/.test(text) &&
    !/\b(recovery|rest|gunshow|arms|pump|optional|light)\b/.test(text);
}

function sameDateRows(rows: readonly GameChangeVisibleDay[]): Map<string, GameChangeVisibleDay> {
  return new Map(rows.map((row) => [row.date, row]));
}

function unique(lines: string[]): string[] {
  return Array.from(new Set(lines.map((line) => line.trim()).filter(Boolean)));
}

function resolveChangedDates(input: GameChangeCoachNoteInput): string[] {
  const beforeByDate = sameDateRows(input.before);
  const afterByDate = sameDateRows(input.after);
  return Array.from(new Set([
    ...input.before.map((row) => row.date),
    ...input.after.map((row) => row.date),
  ])).filter((date) => rowChanged(beforeByDate.get(date), afterByDate.get(date)));
}

function actionSentence(input: GameChangeCoachNoteInput): string {
  const fixture = input.fixtureKind === 'practice_match' ? 'practice match' : 'game';
  if (input.action === 'added') {
    return `Added ${dayName(input.targetDate)} ${fixture}.`;
  }
  if (input.action === 'removed') {
    return `Removed ${dayName(input.targetDate)} ${fixture}.`;
  }
  const from = input.previousDate ? `${dayName(input.previousDate)} ` : '';
  return `${fixture === 'game' ? 'Game' : 'Practice match'} moved from ${from.trim() || 'its old day'} to ${dayName(input.targetDate)}.`;
}

function concreteEffects(input: GameChangeCoachNoteInput): string[] {
  const beforeByDate = sameDateRows(input.before);
  const afterByDate = sameDateRows(input.after);
  const changedDates = resolveChangedDates(input);
  if (changedDates.length === 0) return [];

  const lines: string[] = [];
  const gMinus1 = input.action === 'removed' ? null : addDays(input.targetDate, -1);
  if (gMinus1 && changedDates.includes(gMinus1) && isLightPreGame(afterByDate.get(gMinus1))) {
    lines.push(`${dayName(gMinus1)} was kept light to protect game day.`);
  }

  for (const date of changedDates) {
    const before = beforeByDate.get(date);
    const after = afterByDate.get(date);
    if (date === input.targetDate && input.action !== 'removed') continue;
    if (input.previousDate && date === input.previousDate && input.action === 'moved') continue;

    if (hasSprintOrConditioning(before) && !hasSprintOrConditioning(after)) {
      const fixture = input.fixtureKind === 'practice_match' ? 'practice match' : 'game';
      lines.push(`Extra sprint/conditioning was removed because the ${fixture} covers that exposure.`);
      continue;
    }

    if (isRecoveryOrGunshow(after)) {
      lines.push(`${dayName(date)} was changed to ${visibleLabel(after)}.`);
      continue;
    }

    if (hardLowerOrConditioning(before) && isLightPreGame(after)) {
      lines.push(`${dayName(date)} was changed to a lighter day.`);
      continue;
    }

    lines.push(`${dayName(date)} changed from ${visibleLabel(before)} to ${visibleLabel(after)}.`);
  }

  return unique(lines).slice(0, 3);
}

export function buildGameChangeCoachNoteConstraint(
  input: GameChangeCoachNoteInput,
): ActiveScheduleConstraint | null {
  const effects = concreteEffects(input);
  if (effects.length === 0) return null;
  const changed = resolveChangedDates(input);

  const nowISO = input.todayISO ?? new Date().toISOString();
  const title = input.fixtureKind === 'practice_match'
    ? `Practice match ${input.action}`
    : `Game ${input.action}`;
  const id = input.adjustmentId
    ? `game-change:${input.adjustmentId}`
    : `game-change-${input.weekStartISO}`;
  const source = input.source?.producer === 'coach'
    ? 'coach'
    : input.source?.producer === 'system'
      ? 'system'
      : 'tap';
  return {
    id,
    type: 'schedule',
    severity: 0,
    status: 'active',
    startDate: nowISO,
    lastUpdatedAt: nowISO,
    reasonLabel: title,
    source,
    ...(input.source ? { fixtureMutationSource: { ...input.source } } : {}),
    weekStartISO: input.weekStartISO,
    rules: effects,
    safeFocus: [],
    advice: [],
    modifierTitle: title,
    modifierBody: [actionSentence(input), ...effects].join(' '),
    modifierAffects: ['current_week'],
    expiresAt: weekEnd(input.weekStartISO),
    reversibleAdjustmentId: input.adjustmentId ?? undefined,
    presentationOnlyDismiss: !input.adjustmentId,
    noteProof: {
      kind: 'game_change',
      lifecycleKey: input.adjustmentId
        ? `game-change:${input.adjustmentId}`
        : `legacy-game-change:${input.weekStartISO}`,
      changedDates: changed,
      after: input.after
        .filter((row) => changed.includes(row.date))
        .map((row) => ({
          date: row.date,
          workoutName: row.workoutName,
          workoutType: row.workoutType,
          sessionTier: row.sessionTier ?? null,
        })),
    },
  };
}

export function upsertGameChangeCoachNoteFromDiff(input: GameChangeCoachNoteInput): string | null {
  const constraint = buildGameChangeCoachNoteConstraint(input);
  const store = useCoachUpdatesStore.getState();
  if (!constraint) {
    const staleId = input.adjustmentId
      ? `game-change:${input.adjustmentId}`
      : `game-change-${input.weekStartISO}`;
    if (store.activeConstraints.some((candidate) =>
      candidate.id === staleId && (!('reversibleAdjustmentId' in candidate) ||
        !candidate.reversibleAdjustmentId))) {
      store.removeActiveConstraint(staleId);
    }
    return null;
  }
  store.upsertActiveConstraint(constraint);
  return constraint.id;
}

/**
 * The rows the athlete sees for the given weeks, read from the accepted world
 * as it stands right now. Read once BEFORE and once AFTER a fixture effect
 * lands so the note describes the real difference. Lived privately in the
 * fixture transaction until 2026-09-03; boot replay reads the same rows.
 */
export function acceptedVisibleRowsForWeeks(
  profile: OnboardingData,
  weekStarts: readonly string[],
): GameChangeVisibleDay[] {
  /* eslint-disable @typescript-eslint/no-var-requires */
  const { useProgramStore } = require('../store/programStore');
  const { rebaseAcceptedEffectiveWeek } = require('../rules/acceptedEffectiveWeek');
  const { storedWorldSurfaces } = require('./liveEvaluationSurfaces');
  /* eslint-enable @typescript-eslint/no-var-requires */
  const state = useProgramStore.getState();
  const markedDays = state.acceptedMaterialContext.markedDays;
  return weekStarts.flatMap((weekStart) => {
    const accepted = rebaseAcceptedEffectiveWeek({
      surfaces: storedWorldSurfaces(state),
      weekStart,
      profile,
      markedDays,
    });
    const byDay = new Map<number, Workout>(accepted.visibleWorkouts.map((workout: Workout) =>
      [workout.dayOfWeek, workout]));
    return Array.from({ length: 7 }, (_, offset): GameChangeVisibleDay => {
      const date = addDays(weekStart, offset);
      const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
      const workout = byDay.get(dayOfWeek);
      return {
        date,
        dayOfWeek,
        workoutName: workout?.name ?? null,
        workoutType: (workout as { workoutType?: string } | undefined)?.workoutType ?? null,
        sessionTier: (workout as { sessionTier?: string | null } | undefined)?.sessionTier ?? null,
      };
    });
  });
}

/**
 * THE NOTE IS PART OF THE DECISION'S REPLAY. Boot re-lands every accepted
 * fixture effect from the decision ledger and the athlete's week comes back
 * right — but until 2026-09-03 the "Game moved" note was never re-derived, so
 * after a relaunch memory held no note while disk still did: the undo card was
 * gone and the dev persistence gate refused the relaunch as non-convergent.
 * This derives from the accepted effect exactly what the live transaction
 * derives from the request. Held by `test:move-game-relaunch`.
 */
export function upsertGameChangeCoachNoteForAcceptedEffect(args: {
  effect: CanonicalAcceptedFixtureEditEffect;
  adjustmentId: string | undefined;
  before: readonly GameChangeVisibleDay[];
  after: readonly GameChangeVisibleDay[];
}): string | null {
  const action: GameChangeAction = args.effect.action === 'remove'
    ? 'removed'
    : args.effect.action === 'move' ? 'moved' : 'added';
  return upsertGameChangeCoachNoteFromDiff({
    action,
    fixtureKind: args.effect.fixtureKind,
    targetDate: args.effect.targetDate,
    previousDate: args.effect.sourceDate,
    weekStartISO: getMondayForDate(args.effect.targetDate),
    before: args.before,
    after: args.after,
    todayISO: args.effect.acceptedAt.slice(0, 10),
    adjustmentId: args.adjustmentId,
    source: args.effect.source,
  });
}

export function resolvedDaysToGameChangeRows(
  days: readonly ResolvedDay[],
): GameChangeVisibleDay[] {
  return days.map((day) => ({
    date: day.date,
    dayOfWeek: day.dayOfWeek,
    workoutName: day.workout?.name ?? null,
    workoutType: (day.workout as any)?.workoutType ?? null,
    sessionTier: (day.workout as any)?.sessionTier ?? null,
  }));
}

function workoutForDate(program: TrainingProgram, date: string): Workout | null {
  const dow = new Date(`${date}T12:00:00`).getDay();
  const workout = program.microcycles?.[0]?.workouts?.find((candidate) => candidate.dayOfWeek === dow);
  return workout ?? null;
}

function rowFromWorkout(date: string, workout: Workout | null): GameChangeVisibleDay {
  return {
    date,
    dayOfWeek: new Date(`${date}T12:00:00`).getDay(),
    workoutName: workout?.name ?? null,
    workoutType: (workout as any)?.workoutType ?? null,
    sessionTier: (workout as any)?.sessionTier ?? null,
  };
}

function overlayWorkout(
  overlay: WeekScopedWorkoutOverlay | undefined,
  date: string,
): Workout | null | undefined {
  if (!overlay) return undefined;
  return overlay.workoutsByDate[date] ?? null;
}

export function weekRebuildResultToGameChangeRows(args: {
  result: WeekRebuildResult;
  targetDate: string;
  newGameDay: DayOfWeek | null;
}): GameChangeVisibleDay[] {
  const weekStartISO = args.result.overlay?.weekStart ?? getMondayForDate(args.targetDate);
  return Array.from({ length: 7 }, (_, offset) => {
    const date = addDays(weekStartISO, offset);
    if (args.newGameDay && date === args.targetDate) {
      return {
        date,
        dayOfWeek: new Date(`${date}T12:00:00`).getDay(),
        workoutName: 'Game Day',
        workoutType: 'Game',
        sessionTier: 'game',
      };
    }
    const overlay = overlayWorkout(args.result.overlay, date);
    const workout = overlay !== undefined ? overlay : workoutForDate(args.result.program, date);
    return rowFromWorkout(date, workout);
  });
}

export function gameChangeActionFromRebuild(args: {
  newGameDay: DayOfWeek | null;
  clearOverlayDate?: string | null;
}): GameChangeAction {
  if (args.newGameDay === null) return 'removed';
  return args.clearOverlayDate ? 'moved' : 'added';
}

// `fixtureKindForPhase` lived here — a second, unreferenced copy of the
// phase→fixture-kind decision. It is deleted rather than delegated: an
// exported duplicate is a door the next caller walks through.
// `canonicalFixtureKind` in rules/fixtureConditionedAvailability owns it.
