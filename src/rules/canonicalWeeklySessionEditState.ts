/** Accepted session edits translated from the decision ledger once. */
import type { UserRemovalConstraint } from '../types/domain';
import type { CalendarDayType } from '../store/calendarStore';
import type { DecisionLedgerEntry } from '../types/decisionLedger';
import type { PlanChange } from '../utils/planChangeTypes';
import { replayableEntries } from './decisionLedgerReplay';

export type CanonicalSessionMutationIntent =
  | 'athlete_removal'
  | 'athlete_move'
  | 'athlete_addition';

export interface CanonicalAcceptedSessionEditEffect {
  readonly mutationIntent: CanonicalSessionMutationIntent;
  readonly acceptedAt: string;
  readonly affectedDates: readonly string[];
  readonly removedConstraintIds: readonly string[];
  readonly restoredConstraints: readonly {
    id: string;
    restoredAt: string;
  }[];
  readonly upsertedConstraints: readonly UserRemovalConstraint[];
  readonly markedDayChanges: readonly {
    dateISO: string;
    value: CalendarDayType | null;
  }[];
}

export interface CanonicalWeeklySessionEditState {
  readonly kind: 'weekly_session_edits';
  /** Null means the caller is compiling every affected week in ledger order. */
  readonly weekStartISO: string | null;
  readonly effects: readonly CanonicalAcceptedSessionEditEffect[];
}

export function canonicalSessionMutationIntentForPlanChange(
  change: PlanChange,
): CanonicalSessionMutationIntent | null {
  if (change.kind === 'move_session') return 'athlete_move';
  if (change.kind === 'add_category' || change.kind === 'add_template') {
    return 'athlete_addition';
  }
  if (change.kind === 'remove_session' || change.kind === 'swap_category' ||
    change.kind === 'swap_template') return 'athlete_removal';
  return null;
}

function addDays(dateISO: string, amount: number): string {
  const date = new Date(`${dateISO.slice(0, 10)}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    + `-${String(date.getDate()).padStart(2, '0')}`;
}

function effectTouchesWeek(
  effect: CanonicalAcceptedSessionEditEffect,
  weekStartISO: string,
): boolean {
  const start = weekStartISO.slice(0, 10);
  const end = addDays(start, 6);
  return effect.affectedDates.some((date) => {
    const iso = date.slice(0, 10);
    return iso >= start && iso <= end;
  });
}

export function canonicalWeeklySessionEditStateFrom(args: {
  readonly entries: readonly DecisionLedgerEntry[];
  readonly weekStartISO?: string | null;
}): CanonicalWeeklySessionEditState {
  const weekStartISO = args.weekStartISO?.slice(0, 10) ?? null;
  const effects: CanonicalAcceptedSessionEditEffect[] = [];
  const legacyUpgrades = new Map(args.entries.flatMap((entry) =>
    entry.decision.kind === 'legacy_plan_change_effect_upgrade'
      ? [[entry.decision.sourceEntryId, entry.decision.acceptedEffect] as const]
      : []));
  for (const entry of replayableEntries(args.entries)) {
    if (entry.decision.kind !== 'plan_change') continue;
    const effect = entry.decision.acceptedEffect ?? legacyUpgrades.get(entry.id);
    if (!effect || (weekStartISO && !effectTouchesWeek(effect, weekStartISO))) continue;
    effects.push(effect);
  }
  return { kind: 'weekly_session_edits', weekStartISO, effects };
}
