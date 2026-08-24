import type { PlanChangeMoveScopeId } from '../utils/planChangeTypes';
import type { VisibleDay, VisiblePart, VisiblePartKind } from './visibleProjection';

/**
 * ── THE WEEK BOARD — one day, up to two boxes ────────────────────────────────
 *
 * ⚠ **R-218 (Sam, 2026-08-25).** *"the day should be broken into its own thing
 * but in 2 sections if there is already a session or two sessions on that day
 * ... For days where nothing is planned, they can just be one box. Game day is
 * also one box."*
 *
 * ## The rule is about ROOM, and that is Sam's own correction
 *
 * The first draft made the single box a property of REST DAYS. He corrected it:
 * *"if you add a session to rest day or drag a session there, then it would now
 * be that session + an empty box next to it like any other day"*. So there is
 * one rule and no exception —
 *
 *   **boxes = the day's parts, plus ONE empty box while the day holds fewer
 *   than two and is not a game day.**
 *
 * A rest day has zero parts, so its "one box" IS the empty box. Nothing here
 * special-cases rest.
 *
 * ## `speed` IS CONDITIONING, AND IT IS NEVER A THIRD SESSION
 *
 * Sam, 2026-08-25: *"speed is energy system work — which is conditioning ...
 * you should never have strength + speed + conditioning in the same day, that's
 * like having strength + 2 conditionings."*
 *
 * **AND THE GENERATOR ALREADY AGREES**, which the seat established before
 * folding anything: `Workout.speedBlock` carries a `placement` that is either
 * `pre_lift` — sprints INSIDE that day's strength session, chosen when the day
 * already has lifts — or `standalone`, when it does not. So speed is either
 * part of the strength session or it IS the session; it is never a third thing
 * competing for a slot. The fold below is therefore a DISPLAY correction, not a
 * new programming rule.
 *
 * ⚠ **AND IT DOES NOT TOUCH LOAD.** `SpeedBlockCountingFence` says
 * `conditioningCredit: 'none'`, and the registry holds that. Occupying the
 * conditioning SLOT on a day and earning conditioning CREDIT for the week are
 * two different questions; this file answers only the first.
 *
 * ## Why the board is derived here and not in the screen
 *
 * The screen renders boxes and drags them. **What a day HOLDS is a projection
 * question**, and a screen that decomposed the day itself would be the second
 * decomposition this repo has already paid for twice (`week-identity-two-owners`,
 * and the `MOVE_SCOPE_SECTION_KIND` table deleted from `planChangeProducer` on
 * 2026-08-12 for exactly this reason). This reads `VisibleDay.parts` and
 * nothing else.
 */

export type WeekBoardBoxKind =
  /** Movable work — strength, conditioning (speed folded in), recovery, … */
  | 'session'
  /** The club night. A drop TARGET it never is; draggable it is (R-218). */
  | 'team_training'
  /** A fixture. One box, no empty beside it, neither dragged nor dropped on. */
  | 'game'
  /** Room. Carries the `+`, and accepts a drop. */
  | 'empty';

export interface WeekBoardBox {
  readonly id: string;
  readonly kind: WeekBoardBoxKind;
  /** The athlete's word for it. Empty boxes carry none. */
  readonly label: string | null;
  /**
   * The move/bin scope this box IS. **The box and the scope are the same
   * thing** — which is what lets a drag raise `move_session` without the
   * screen deciding anything — and `null` where nothing can travel.
   */
  readonly scope: PlanChangeMoveScopeId | null;
}

export interface WeekBoardDay {
  readonly date: string;
  readonly boxes: readonly WeekBoardBox[];
  /** Sam's cap, answered 2026-08-25: *"Two, and that's the cap"*. */
  readonly isFull: boolean;
}

/** Sam, 2026-08-25, asked before the plan was written: *"Two, and that's the cap"*. */
export const WEEK_BOARD_MAX_BOXES = 2;

/**
 * Which box a projected part becomes.
 *
 * ⚠ **A TABLE, NOT AN `if`** — the same reason `PART_BUCKET_KIND` next door is
 * one. A new `VisiblePartKind` then fails to compile here and has to be
 * answered, rather than falling silently into whichever branch was last.
 */
const BOX_KIND_FOR_PART: Readonly<Record<VisiblePartKind, WeekBoardBoxKind>> = {
  strength: 'session',
  conditioning: 'session',
  // R-218 — energy-system work. See the header: the generator already places it
  // inside the strength session or as the day's own session.
  speed: 'session',
  support: 'session',
  recovery: 'session',
  team_training: 'team_training',
  game: 'game',
};

/**
 * The move scope a part travels under.
 *
 * `null` for `game` (a fixture moves through its own door) and for
 * `team_training` (the club night has its own typed action, `move_team_night`,
 * with a route — never `move_session`).
 */
const SCOPE_FOR_PART: Readonly<Record<VisiblePartKind, PlanChangeMoveScopeId | null>> = {
  strength: 'strength',
  conditioning: 'conditioning',
  // Speed rides the conditioning scope, because that is the slot it occupies.
  speed: 'conditioning',
  support: 'strength',
  recovery: 'recovery',
  team_training: null,
  game: null,
};

function boxForPart(part: VisiblePart, index: number): WeekBoardBox {
  return {
    id: `${part.id || part.kind}-${index}`,
    kind: BOX_KIND_FOR_PART[part.kind],
    label: String(part.bucket ?? part.headline ?? ''),
    scope: SCOPE_FOR_PART[part.kind],
  };
}

/**
 * One day's boxes.
 *
 * ⚠ **A DAY OVER THE CAP IS REPORTED, NEVER TRUNCATED.** Sam ruled a day may
 * never hold three. If a real week ever produces one, hiding the third would
 * make a programming defect invisible at exactly the surface built to show the
 * week's shape — so every part is rendered and `isFull` simply says the day
 * takes no more. Silence here would be the app lying about its own program.
 */
export function buildWeekBoardDay(day: VisibleDay): WeekBoardDay {
  const parts = day.parts ?? [];
  const boxes = parts.map(boxForPart);
  const isGame = boxes.some((box) => box.kind === 'game');
  if (isGame) {
    // A fixture is the whole day. No room, no empty box, nothing to add beside it.
    return { date: day.date, boxes, isFull: true };
  }
  if (boxes.length >= WEEK_BOARD_MAX_BOXES) {
    return { date: day.date, boxes, isFull: true };
  }
  return {
    date: day.date,
    boxes: [...boxes, { id: `empty-${day.date}`, kind: 'empty', label: null, scope: null }],
    isFull: false,
  };
}

export function buildWeekBoard(days: readonly VisibleDay[]): WeekBoardDay[] {
  return days.map(buildWeekBoardDay);
}

/**
 * May `box` on `from` be dropped onto `target` on `to`?
 *
 * ⚠ **THIS ANSWERS THE BOARD'S OWN SHAPE RULES ONLY.** Whether the PROGRAM
 * allows that move — a game the day before, a week already at its budget, a
 * scope with no legal destination — is `planChangeProducer`'s answer and is
 * asked separately. **Two owners, two different questions; this one must never
 * grow into the other**, which is the failure mode `a-legality-probe-is-not-a-
 * change-probe` records.
 */
export function weekBoardDropRefusal(args: {
  box: WeekBoardBox;
  from: WeekBoardDay;
  target: WeekBoardBox;
  to: WeekBoardDay;
}): 'same_day' | 'not_movable' | 'onto_team_training' | 'onto_game' | 'day_full' | null {
  if (args.from.date === args.to.date) return 'same_day';
  // A fixture never travels through this board, and neither does an empty box.
  if (args.box.kind === 'game' || args.box.kind === 'empty') return 'not_movable';
  // Sam: *"you can't move a strength/conditioning/mobility etc session to where
  // a team training box [is]"*.
  if (args.target.kind === 'team_training') return 'onto_team_training';
  if (args.target.kind === 'game') return 'onto_game';
  // An occupied box SWAPS (his answer, 2026-08-25), so a full day is only
  // refused when the drop would have to ADD — that is, onto its empty box.
  if (args.target.kind === 'empty' && args.to.isFull) return 'day_full';
  return null;
}
