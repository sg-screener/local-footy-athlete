import { useCoachUpdatesStore, type ActiveFatigueConstraint } from '../store/coachUpdatesStore';
import type { OverrideContext } from '../types/domain';
import { getMondayForDate } from './sessionResolver';

export type TapRecoveryModifierScope = 'day' | 'week';

function addDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days, 12);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

function uniqueDates(dates: readonly string[]): string[] {
  return Array.from(new Set(dates.filter(Boolean))).sort();
}

export function recoveryModeModifierIdForDate(dateISO: string): string {
  return `tap-recovery-mode:${getMondayForDate(dateISO)}`;
}

export function loadReductionModifierIdForDate(dateISO: string): string {
  return `tap-load-reduction:${getMondayForDate(dateISO)}`;
}

export function withActiveProgramModifierContext(
  context: OverrideContext | undefined,
  activeModifierId: string | null,
): OverrideContext | undefined {
  if (!context || !activeModifierId) return context;
  return { ...context, activeModifierId };
}

export function upsertTapRecoveryModeModifier(args: {
  date: string;
  todayISO: string;
  appliedDates: readonly string[];
  scope: TapRecoveryModifierScope;
}): string {
  const now = new Date().toISOString();
  const weekStart = getMondayForDate(args.date);
  const id = recoveryModeModifierIdForDate(args.date);
  const appliesToDate = args.scope === 'day' ? args.date : undefined;
  const constraint: ActiveFatigueConstraint = {
    id,
    type: 'fatigue',
    severity: args.scope === 'week' ? 8 : 6,
    status: 'active',
    startDate: args.todayISO,
    lastUpdatedAt: now,
    reasonLabel: 'Recovery mode',
    source: 'tap',
    appliesToDate,
    weekStartISO: args.scope === 'week' ? weekStart : undefined,
    expiresAt: args.scope === 'week' ? addDaysISO(weekStart, 6) : args.date,
    modifierTitle: 'Recovery mode active',
    modifierBody: 'Your training load is reduced while you recover.',
    modifierAffects: [args.scope === 'week' ? 'current_week' : 'current_day'],
    linkedOverrideDates: uniqueDates(args.appliedDates),
    rules: ['hard conditioning + sprints', 'max-effort lifts'],
    safeFocus: ['Recovery + mobility', 'Easy aerobic conditioning', 'Light technique work'],
    advice: [],
  };
  useCoachUpdatesStore.getState().upsertActiveConstraint(constraint);
  return id;
}

export function upsertTapLoadReductionModifier(args: {
  date: string;
  todayISO: string;
}): string {
  const now = new Date().toISOString();
  const weekStart = getMondayForDate(args.date);
  const id = loadReductionModifierIdForDate(args.date);
  const constraint: ActiveFatigueConstraint = {
    id,
    type: 'fatigue',
    severity: 7,
    status: 'active',
    startDate: args.todayISO,
    lastUpdatedAt: now,
    reasonLabel: 'Load reduced',
    source: 'tap',
    weekStartISO: weekStart,
    expiresAt: addDaysISO(weekStart, 6),
    modifierTitle: 'Load reduced this week',
    modifierBody: 'Your week has been adjusted because you said you were cooked.',
    modifierAffects: ['current_week'],
    linkedOverrideDates: [],
    rules: ['max-effort lifts', 'hard conditioning + sprints', 'extra optional work'],
    safeFocus: ['Recovery + mobility', 'Easy aerobic conditioning', 'Light technique work'],
    advice: [],
  };
  useCoachUpdatesStore.getState().upsertActiveConstraint(constraint);
  return id;
}
