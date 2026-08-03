/**
 * THE HARNESS'S OWN WRITER — LR-1, 2026-08-03.
 *
 * `programStore.setManualOverride` is retired: a single-date override write
 * now goes through `applyProgramOverrideWrite`, which requires the writer to
 * name itself (`ProgramOverrideWriterId`). Suites that seed override state
 * were the largest population of the retired primitive's callers, and they are
 * not product writers — so they write under the one id no product file may
 * wear, `harness`.
 *
 * That is deliberate, and it is a DECLARATION rather than an escape hatch:
 *
 * - `programOverrideOwnershipTests` cell 5 sweeps `src/` outside `__tests__`
 *   for the `harness` id and fails on any product hit. The harness writer
 *   cannot leak into the app it is testing.
 * - Every seeded override still lands on the tape, named `harness`, so a
 *   SEEDED world is distinguishable from a LIVED one in the action log. Under
 *   the fixture law (AGENTS.md, "Hand-built state fixtures are deprecated for
 *   athlete-facing suites") that visibility is the point: seeding is declared
 *   debt whose conversion to walked state is the walker's arc, not silence.
 *
 * Positional on purpose — it is the retired primitive's own signature, so a
 * suite's call sites are unchanged apart from the name. New athlete-facing
 * assertions should reach state by ACTING through `athleteActionWalker`, not
 * by seeding here.
 */
import { applyProgramOverrideWrite } from '../../store/programStore';
import type { OverrideContext, Workout } from '../../types/domain';

export function seedManualOverride(
  date: string,
  workout: Workout,
  context?: OverrideContext,
): void {
  applyProgramOverrideWrite({ date, workout, context, writer: 'harness' });
}
