/** Accepted fixture edits translated from the decision ledger once. */
import type { CalendarDayType } from '../types/calendar';
import type { DecisionLedgerEntry } from '../types/decisionLedger';
import type {
  FixtureMutationAction,
  FixtureMutationKind,
  FixtureMutationSourceMetadata,
} from '../types/fixtureMutation';
import type { DayOfWeek } from '../types/domain';
import { replayableEntries } from './decisionLedgerReplay';

export interface CanonicalAcceptedFixtureEditEffect {
  readonly action: FixtureMutationAction;
  readonly fixtureKind: FixtureMutationKind;
  readonly sourceDate: string | null;
  readonly targetDate: string;
  readonly acceptedAt: string;
  readonly affectedDates: readonly string[];
  readonly markedDayChanges: readonly {
    dateISO: string;
    value: CalendarDayType | null;
  }[];
  readonly source: FixtureMutationSourceMetadata;
}

export interface CanonicalWeeklyFixtureEditState {
  readonly kind: 'weekly_fixture_edits';
  readonly weekStartISO: string | null;
  readonly effects: readonly CanonicalAcceptedFixtureEditEffect[];
}

const DAY_NAMES: DayOfWeek[] = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

function mondayOf(dateISO: string): string {
  const date = new Date(`${dateISO.slice(0, 10)}T12:00:00`);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    + `-${String(date.getDate()).padStart(2, '0')}`;
}

function addDays(dateISO: string, amount: number): string {
  const date = new Date(`${dateISO.slice(0, 10)}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    + `-${String(date.getDate()).padStart(2, '0')}`;
}

function datesInWeek(dateISO: string): string[] {
  const monday = mondayOf(dateISO);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

function dayNameForDate(dateISO: string): DayOfWeek {
  return DAY_NAMES[new Date(`${dateISO.slice(0, 10)}T12:00:00`).getDay()]!;
}

/**
 * Resolve one accepted fixture intent into its exact calendar delta. This is
 * the only place Add, Move and Remove decide game/no-game marks. The live door
 * records the result; boot folds that recorded result without deciding again.
 */
export function canonicalAcceptedFixtureEditEffectFromIntent(args: {
  action: FixtureMutationAction;
  fixtureKind: FixtureMutationKind;
  sourceDate?: string;
  targetDate: string;
  acceptedAt: string;
  source: FixtureMutationSourceMetadata;
  beforeMarkedDays: Readonly<Record<string, CalendarDayType>>;
  recurringGameDay: DayOfWeek | null;
}): CanonicalAcceptedFixtureEditEffect {
  const sourceDate = args.sourceDate?.slice(0, 10) ?? null;
  const targetDate = args.targetDate.slice(0, 10);
  const after = { ...args.beforeMarkedDays };
  // Materialise the implicit standing fixture before changing one date. Once
  // any explicit game exists, calendar semantics use the explicit set instead.
  const weekDates = datesInWeek(targetDate);
  const hasExplicitFixtureAnswer = weekDates.some((date) =>
    after[date] === 'game' || after[date] === 'noGame');
  if (!hasExplicitFixtureAnswer && args.recurringGameDay) {
    const recurringDate = weekDates.find((date) =>
      dayNameForDate(date) === args.recurringGameDay);
    if (recurringDate && after[recurringDate] !== 'rest') after[recurringDate] = 'game';
  }
  if (sourceDate) delete after[sourceDate];
  if (args.action === 'remove') {
    delete after[targetDate];
    if (args.recurringGameDay && !weekDates.some((date) => after[date] === 'game')) {
      const recurringDate = datesInWeek(targetDate)
        .find((date) => dayNameForDate(date) === args.recurringGameDay);
      if (recurringDate) after[recurringDate] = 'noGame';
    }
  } else {
    for (const date of weekDates) {
      if (after[date] === 'noGame') delete after[date];
    }
    after[targetDate] = 'game';
  }

  // Store the complete fixture layer for the accepted week, not only a diff
  // against today's material projection. A fresh boot may seed the recurring
  // profile fixture before folding this effect even when the live accepted
  // context held no material mark for it. Seven explicit cells make the
  // effect portable across that representation boundary without storing any
  // repaired workout output.
  return {
    action: args.action,
    fixtureKind: args.fixtureKind,
    sourceDate,
    targetDate,
    acceptedAt: args.acceptedAt,
    affectedDates: [...new Set([sourceDate, targetDate]
      .filter((date): date is string => !!date))],
    markedDayChanges: weekDates.map((dateISO) => ({
      dateISO,
      value: after[dateISO] === 'game' || after[dateISO] === 'noGame'
        ? after[dateISO]
        : null,
    })),
    source: { ...args.source },
  };
}

function effectTouchesWeek(
  effect: CanonicalAcceptedFixtureEditEffect,
  weekStartISO: string,
): boolean {
  const start = weekStartISO.slice(0, 10);
  const end = addDays(start, 6);
  return effect.affectedDates.some((date) => date >= start && date <= end);
}

export function canonicalWeeklyFixtureEditStateFrom(args: {
  entries: readonly DecisionLedgerEntry[];
  weekStartISO?: string | null;
}): CanonicalWeeklyFixtureEditState {
  const weekStartISO = args.weekStartISO?.slice(0, 10) ?? null;
  const upgrades = new Map(args.entries.flatMap((entry) =>
    entry.decision.kind === 'legacy_fixture_effect_upgrade'
      ? [[entry.decision.sourceEntryId, entry.decision.acceptedEffect] as const]
      : []));
  const effects: CanonicalAcceptedFixtureEditEffect[] = [];
  for (const entry of replayableEntries(args.entries)) {
    if (entry.decision.kind !== 'fixture_add' &&
      entry.decision.kind !== 'fixture_move' &&
      entry.decision.kind !== 'fixture_remove') continue;
    const effect = entry.decision.acceptedEffect ?? upgrades.get(entry.id);
    if (!effect || (weekStartISO && !effectTouchesWeek(effect, weekStartISO))) continue;
    effects.push(effect);
  }
  return { kind: 'weekly_fixture_edits', weekStartISO, effects };
}
