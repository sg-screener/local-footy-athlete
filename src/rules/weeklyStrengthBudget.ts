/**
 * The automatic weekly MAIN-strength allowance, decided before exercises.
 *
 * A slot is a weekly seat, not a request repeated by every compatible session.
 * Dedicated sessions reserve their own seat. Full-body sessions spend whatever
 * unreserved seats their authored shape can actually reach. Later compatible
 * rows are supporting work and never become a second weekly main seat.
 */

import type { StrengthIntent } from './strengthPatternContributions';
import type { SessionSlot } from './sessionSlotCoverage';
import { AUTOMATIC_WEEKLY_MAIN_SEAT_ALLOWANCE } from './weeklyProgrammingContract';

export const WEEKLY_MAIN_STRENGTH_SLOTS = [
  'squat', 'hinge',
  'horizontal_push', 'vertical_push',
  'horizontal_pull', 'vertical_pull',
] as const satisfies readonly SessionSlot[];

export type WeeklyMainStrengthSlot = typeof WEEKLY_MAIN_STRENGTH_SLOTS[number];

export { AUTOMATIC_WEEKLY_MAIN_SEAT_ALLOWANCE };

const WEEKLY_MAIN_SET: ReadonlySet<SessionSlot> = new Set(WEEKLY_MAIN_STRENGTH_SLOTS);

export function isWeeklyMainStrengthSlot(slot: SessionSlot | string | null | undefined):
slot is WeeklyMainStrengthSlot {
  return !!slot && WEEKLY_MAIN_SET.has(slot as SessionSlot);
}

export interface WeeklyStrengthBudgetDay {
  readonly planEntryId: string;
  readonly strengthIntent: StrengthIntent;
}

export interface WeeklyStrengthBudget {
  readonly reservedOwnerBySlot: Readonly<Partial<Record<WeeklyMainStrengthSlot, string>>>;
  canSpend(slot: SessionSlot, planEntryId: string): boolean;
  spend(slot: SessionSlot, planEntryId: string): boolean;
  spentSlots(): readonly WeeklyMainStrengthSlot[];
}

function explicitlyOwnedSlots(intent: StrengthIntent): readonly WeeklyMainStrengthSlot[] {
  // A general full-body day is the fallback owner: its actual authored shape,
  // and the rest of the week, decide what it spends. Reserving every seat here
  // would let an early full-body day steal the dedicated session's purpose.
  if (intent.archetype === 'full_body') return [];
  const patterns = new Set(intent.plannedPatterns ?? []);
  const slots: WeeklyMainStrengthSlot[] = [];
  if (patterns.has('squat')) slots.push('squat');
  if (patterns.has('hinge')) slots.push('hinge');
  if (patterns.has('push')) slots.push('horizontal_push', 'vertical_push');
  if (patterns.has('pull')) slots.push('horizontal_pull', 'vertical_pull');
  return slots;
}

export function createWeeklyStrengthBudget(
  days: readonly WeeklyStrengthBudgetDay[],
): WeeklyStrengthBudget {
  const reserved: Partial<Record<WeeklyMainStrengthSlot, string>> = {};
  for (const day of days) {
    for (const slot of explicitlyOwnedSlots(day.strengthIntent)) {
      reserved[slot] ??= day.planEntryId;
    }
  }
  const spent = new Set<WeeklyMainStrengthSlot>();

  const canSpend = (slot: SessionSlot, planEntryId: string): boolean => {
    if (!isWeeklyMainStrengthSlot(slot) || spent.has(slot)) return false;
    const owner = reserved[slot];
    return owner === undefined || owner === planEntryId;
  };

  return {
    reservedOwnerBySlot: reserved,
    canSpend,
    spend(slot, planEntryId) {
      if (!isWeeklyMainStrengthSlot(slot) || !canSpend(slot, planEntryId)) return false;
      spent.add(slot);
      return true;
    },
    spentSlots: () => [...spent],
  };
}
