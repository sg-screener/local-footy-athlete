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

/**
 * R-351 — A FULL-BODY DAY BESIDE DEDICATED DAYS STILL OWNS ONE BIG LIFT.
 *
 * Measured 2026-09-02 (seat `hingecod`): lower + upper + full body, no club.
 * The lower day reserved squat and hinge, the upper day reserved both push
 * planes and both pull planes, and the full-body day — the fallback owner
 * above — was left with nothing it could spend. It composed three unilateral
 * helpers and no main lift, the week-3 (mid Off-season) contract requires
 * three main-strength days, §18 counted two, and the athlete was REFUSED at
 * the end of onboarding. Accepted at the 2026-08-27 census checkpoint;
 * refused from the weekly-budget commit onward.
 *
 * The correction is the smallest one that keeps R-317 (one seat per week):
 * when every seat is reserved and a full-body day owns none, the day whose
 * owner holds BOTH planes of a pattern hands the VERTICAL plane over. The upper
 * day keeps a horizontal press and a horizontal pull as its mains and still
 * composes the vertical rows as supporting work; the full-body day leads with
 * an overhead press and a vertical pull, then fills the week's lower gaps.
 * Nothing moves when any seat is unreserved (the full-body day already has
 * something to spend) or when no full-body day exists.
 */
function handVerticalSeatsToAnUnseatedFullBodyDay(
  days: readonly WeeklyStrengthBudgetDay[],
  reserved: Partial<Record<WeeklyMainStrengthSlot, string>>,
): void {
  const everySeatReserved = WEEKLY_MAIN_STRENGTH_SLOTS.every((slot) => reserved[slot] !== undefined);
  if (!everySeatReserved) return;
  const unseated = days.find((day) => day.strengthIntent.archetype === 'full_body'
    && !WEEKLY_MAIN_STRENGTH_SLOTS.some((slot) => reserved[slot] === day.planEntryId));
  if (!unseated) return;
  const pairs = [
    ['horizontal_push', 'vertical_push'],
    ['horizontal_pull', 'vertical_pull'],
  ] as const;
  for (const [horizontal, vertical] of pairs) {
    if (reserved[horizontal] !== undefined && reserved[horizontal] === reserved[vertical]) {
      reserved[vertical] = unseated.planEntryId;
    }
  }
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
  handVerticalSeatsToAnUnseatedFullBodyDay(days, reserved);
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
