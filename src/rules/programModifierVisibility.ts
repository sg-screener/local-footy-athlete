/**
 * WHICH MODIFIERS THE PROGRAM TAB SHOWS — AND THEREFORE WHICH IT COUNTS.
 *
 * **Sam, 2026-08-13 (SEAT_INBOX 22b):** *"hide time caps from the Program count
 * and the popup together, keep them on My Status."*
 *
 * ONE RULE, ONE HOME, TWO READERS. The notice's number and the sheet's rows are
 * derived from the same filtered array, so they cannot disagree — which was the
 * entire risk in hiding a row. A time cap is still ACTIVE and still real; it is
 * withdrawn from this surface, not from the athlete's program.
 *
 * WHY IT LIVES IN `rules/` AND NOT BESIDE THE SHEET THAT USES IT. It first
 * shipped inside `ModifiersSheet.tsx`, which imports `react-native` — and the
 * node test harness cannot parse that, so the behavioural cell could not import
 * the rule it was meant to be checking. A law that only a rendering surface can
 * reach is a law with no test. This module imports nothing but a type.
 *
 * MY STATUS DOES NOT APPLY THIS. That screen holds the only control that clears
 * a time cap, so filtering there would strand an active constraint with no door
 * — the `equipment has no door` shape, which this repo has paid for once.
 */
import type { ActiveProgramModifierEffect } from '../utils/activeProgramModifiers';

/** Effects the Program tab neither draws nor counts. */
export const PROGRAM_HIDDEN_EFFECTS: readonly ActiveProgramModifierEffect[] = ['not_shown'];

/** True when the Program tab should draw AND count this modifier. */
export function isShownOnProgram(note: { effect: ActiveProgramModifierEffect }): boolean {
  return !PROGRAM_HIDDEN_EFFECTS.includes(note.effect);
}
