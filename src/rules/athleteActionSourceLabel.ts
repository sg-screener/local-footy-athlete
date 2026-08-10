/**
 * WHICH DOOR DID THIS? — the one owner of the diagnostic source label.
 *
 * ## Sam's question, and it is the whole specification
 *
 * 2026-08-10, verbatim: *"well shouldn't it be labelled differently to prevent
 * this issue from happening again? so we can diagnose whether the issue happened
 * via tap or coach?"*
 *
 * ## The defect, which cost a full pass before he asked
 *
 * `source` was derived from `initiatedBy`, whose values are
 * `'tap' | 'system' | 'test'` — a field about **WHO acted** (a human, or the
 * app on its own). The DOOR lived somewhere else entirely, in `screen`. So a
 * coach change card and the Program tab's own sheet both emitted
 * `source: 'tap'`, and `lastTransaction` was minted from the same value.
 *
 * The seat read `lastTransaction: "tap:move_session:..."` in Sam's export and
 * told him his move had come through the Program tab. **It had not** —
 * `route` said `program_control:coach_tab:coach_change_card`. The
 * investigation went down the wrong path for a pass on the strength of a field
 * that could not tell the two apart.
 *
 * **`LAW-count-names-instrument`, in its LABEL form: a value names the axis its
 * own field measures, not the thing the reader wanted to know.** `'tap'` was
 * never wrong — it correctly said "a human confirmed this". It simply does not
 * answer "which door", and nothing at the field said so.
 *
 * ## Why derived, and why HERE
 *
 * Sam's fix, in the seat's words: *"derive the label from the route rather than
 * passing a second opinion in beside it: one owner."* A second field for the
 * door, set at each call site, is a field a call site can forget or disagree
 * with — and the two-opinions shape is what this repo keeps paying for. The
 * screen ALREADY names the door on every action, because `route` is built from
 * it. So the label is a function of the screen, computed in one place, and
 * there is nothing to keep in sync.
 *
 * ## What did NOT change, deliberately
 *
 * `ProgramControlActionSource.initiatedBy` still reads `'tap'` for the coach
 * card, and its comment defending that is right: the athlete taps Confirm, a
 * human decided, and a coach stamping `'system'` would claim autonomy the
 * change card exists to deny it. **That field was never the bug.** The bug was
 * a diagnostic that read one axis and reported it as another.
 */

import type { AthleteActionSource } from '../utils/athleteActionDiagnostics';
import type { ProgramControlActionSource } from '../types/programControlAction';

/**
 * The label for a door, from the door.
 *
 * Order matters and is stated rather than left to fall out:
 *
 *   1. **`system` wins over everything.** An action the app initiated is a
 *      system action whichever screen it nominally belongs to — that is the
 *      question `initiatedBy` exists to answer and it outranks the door.
 *   2. **Then the screen names the door.** `coach_tab` is the coach.
 *   3. **Everything else is `tap`** — an athlete-confirmed action on one of
 *      their own surfaces.
 *
 * `coach_tab` and not `coach_notes`: one word between them is what stops a
 * census of coach-authored decisions from counting the FROZEN beta pipeline's
 * writes as the rebuild's (LR-6). `coach_notes` is the old surface and stays
 * `tap` here, because nothing new goes through it.
 */
export function athleteActionSourceForDoor(
  source: ProgramControlActionSource | null | undefined,
): AthleteActionSource {
  if (!source) return 'tap';
  if (source.initiatedBy === 'system' || source.screen === 'system') return 'system';
  if (source.screen === 'coach_tab') return 'coach';
  return 'tap';
}

/**
 * The same label, narrowed to what the plan-change producer accepts.
 *
 * The producer mints `lastTransaction`'s prefix from its own `source`, so it
 * must be THE SAME VALUE or the summary export and the event log disagree about
 * one action — which is the defect one axis over. `system` narrows to `tap`
 * there because that producer only ever runs behind an athlete-owned change;
 * the narrowing is stated here rather than happening silently at a call site.
 */
export function planChangeSourceForDoor(
  source: ProgramControlActionSource | null | undefined,
): 'tap' | 'coach' {
  return athleteActionSourceForDoor(source) === 'coach' ? 'coach' : 'tap';
}
