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
  const pairs = [
    ['horizontal_push', 'vertical_push'],
    ['horizontal_pull', 'vertical_pull'],
  ] as const;
  const owns = (day: WeeklyStrengthBudgetDay): boolean =>
    WEEKLY_MAIN_STRENGTH_SLOTS.some((slot) => reserved[slot] === day.planEntryId);
  // Fix 2 (Sam, 2026-09-02): TWO dedicated upper days claim the same four
  // seats and "first claim wins" left the second with none — a fixture rebuild
  // of a five-day week packed four upper mains into Wednesday and composed
  // Friday's upper day with no main lift, so the week counted two main-strength
  // days of three. The second upper day takes the vertical planes.
  for (const day of days) {
    if (owns(day)) continue;
    const patterns = new Set(day.strengthIntent.plannedPatterns ?? []);
    if (day.strengthIntent.archetype === 'full_body' || !(patterns.has('push') || patterns.has('pull'))) continue;
    for (const [horizontal, vertical] of pairs) {
      const pattern = horizontal === 'horizontal_push' ? 'push' : 'pull';
      if (patterns.has(pattern) && reserved[horizontal] !== undefined && reserved[horizontal] === reserved[vertical]) {
        reserved[vertical] = day.planEntryId;
      }
    }
  }
  const everySeatReserved = WEEKLY_MAIN_STRENGTH_SLOTS.every((slot) => reserved[slot] !== undefined);
  if (!everySeatReserved) return;
  const unseated = days.find((day) => day.strengthIntent.archetype === 'full_body' && !owns(day));
  if (!unseated) return;
  for (const [horizontal, vertical] of pairs) {
    if (reserved[horizontal] !== undefined && reserved[horizontal] === reserved[vertical]) {
      reserved[vertical] = unseated.planEntryId;
    }
  }
}

export function createWeeklyStrengthBudget(
  days: readonly WeeklyStrengthBudgetDay[],
  slotAvailable?: (slot: WeeklyMainStrengthSlot, day: WeeklyStrengthBudgetDay) => boolean,
): WeeklyStrengthBudget {
  const reserved: Partial<Record<WeeklyMainStrengthSlot, string>> = {};
  // R-390: the six main lifts belong to three useful sessions before any
  // exercise is selected. The third day keeps both vertical upper mains and
  // receives its lower work through the existing unilateral/support slots.
  if (days.length === 3 && days.every((day) => day.strengthIntent.archetype === 'full_body')) {
    const pairs: readonly (readonly WeeklyMainStrengthSlot[])[] = [
      ['squat', 'horizontal_push'], ['hinge', 'horizontal_pull'], ['vertical_push', 'vertical_pull'],
    ];
    days.forEach((day, index) => pairs[index].forEach((slot) => { reserved[slot] = day.planEntryId; }));
  }
  for (const day of days) {
    for (const slot of explicitlyOwnedSlots(day.strengthIntent)) {
      reserved[slot] ??= day.planEntryId;
    }
  }
  handVerticalSeatsToAnUnseatedFullBodyDay(days, reserved);
  // A full-body day must receive a usable main seat even when its reserved
  // vertical lifts need unavailable kit. Reserve before selecting exercises;
  // the donor retains at least one usable main and the target is not reduced.
  if (slotAvailable) {
    const usable = (day: WeeklyStrengthBudgetDay) => WEEKLY_MAIN_STRENGTH_SLOTS
      .filter(slot => reserved[slot] === day.planEntryId && slotAvailable(slot, day));
    for (const receiver of days) {
      if (receiver.strengthIntent.archetype !== 'full_body' || usable(receiver).length > 0) continue;
      for (const donor of days) {
        const donorSlots = usable(donor);
        if (donorSlots.length < 2) continue;
        const transfer = [...donorSlots].reverse().find(slot => slotAvailable(slot, receiver));
        if (!transfer) continue;
        reserved[transfer] = receiver.planEntryId;
        break;
      }
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
