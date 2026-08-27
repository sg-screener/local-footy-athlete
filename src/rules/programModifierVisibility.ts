/** R-262: Program and My Status list every active program-affecting modifier.
 * Kept as a shared compatibility predicate for existing display consumers.
 */
import type { ActiveProgramModifierEffect } from '../utils/activeProgramModifiers';

/** Effects the Program tab neither draws nor counts. */
export const PROGRAM_HIDDEN_EFFECTS: readonly ActiveProgramModifierEffect[] = [];

/** True when the Program tab should draw AND count this modifier. */
export function isShownOnProgram(note: { effect: ActiveProgramModifierEffect }): boolean {
  return !PROGRAM_HIDDEN_EFFECTS.includes(note.effect);
}
