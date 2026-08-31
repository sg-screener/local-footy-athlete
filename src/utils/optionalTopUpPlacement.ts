/**
 * THE NEED-BASED TOP-UP, APPLIED.
 *
 * `rules/optionalTopUp.ts` DECIDES — what the week lacks, and at most what fills
 * the lack, every threshold signed in `docs/NEED_COMPUTATION_SHEET_2026-07-30.md`.
 * This module MATERIALISES that decision into real composed sessions and places
 * them into the accepted week (replacing an empty Rest shell when present). The split is deliberate: the decision is logic Sam
 * signs and must be readable in one place without a generator, and the
 * materialisation is plumbing that must never be able to change the decision.
 *
 * ## Where it runs, and why the seam IS the argument
 *
 * After `requireSection18AcceptedWeek` has accepted the week. A top-up session is
 * therefore INCAPABLE of affecting compliance — not "checked not to", incapable,
 * because the contract was satisfied before the session existed and is never
 * re-evaluated against it. Two of Sam's five conditions ("never counted toward
 * compliance", "never counted toward load") are structural at this seam rather
 * than asserted, which is worth more than any test of them.
 *
 * The other three are properties of what is placed: `sessionTier` is `optional` or
 * `recovery`, never `core`; the composition comes from Sam's pools; and the day it
 * lands on carried no meaningful content, so binning it in one tap returns the day to empty.
 *
 * ## Composition has ONE owner per session type
 *
 *   accessories -> buildDerivedSession('prehab_accessories')  — the six signed
 *                  prehab pools, the same session the athlete's Accessories door
 *                  builds.
 *   mobility    -> buildDerivedSession('mobility')             — Sam's twenty
 *                  mobility movements, 5-8 across the four signed regions, the
 *                  same session the Mobility door builds.
 *
 * Both are the DOOR'S builder. That is the point: R1 is the live example of what
 * two composers of one session type costs — the resolver builds the G-1 Gunshow
 * from the signed pools while the generator's plan entry built it from a hardcoded
 * five-row fallback, for the same day, under the same name.
 */

import type { SeasonPhase, Workout } from '../types/domain';
import {
  computeOptionalTopUps,
  type OptionalTopUpPlacement,
  type OptionalTopUpType,
} from '../rules/optionalTopUp';
import { buildDerivedSession, type AthleteContext } from './sessionBuilder';
import { isoDateForWeekday } from './appDate';
import type { WeakPointFocus } from '../rules/weakPointFocus';
import { isExplicitRestStub } from './workoutContent';

/**
 * The words a placed session carries as its reason — they land in its description.
 *
 * Athlete-facing, so it is copy: PROPOSED, NOT SIGNED, recorded in
 * `docs/COPY_SHEET_RULINGS_2026-07-30.md` batch 6. It says what the session
 * IS rather than which need produced it, because "your week was short on groin
 * work" is a diagnosis and this is a sentence on a card.
 */
const TOP_UP_REASON = 'Optional top-up';

/** Which derived session each need places. One line, and it is the whole mapping. */
const DERIVED_TYPE: Readonly<Record<OptionalTopUpType, 'prehab_accessories' | 'mobility'>> = {
  accessories: 'prehab_accessories',
  mobility: 'mobility',
};

export interface ApplyOptionalTopUpsArgs {
  daysToGameByDay?: Readonly<Partial<Record<number, number | null>>>;
  /** The ACCEPTED week. Never mutated. */
  readonly workouts: readonly Workout[];
  readonly seasonPhase: SeasonPhase | null | undefined;
  readonly athlete: AthleteContext;
  readonly microcycleId: string;
  /** Monday of the week, ISO. */
  readonly weekStartISO: string;
  /** The game's day-of-week this week, or null. */
  readonly gameDayOfWeek: number | null;
  /**
   * Days the pass may place on. The caller owns this because only it knows which
   * days are the athlete's to train and which are already spoken for by history —
   * a top-up on a pinned past day would be the app editing a day that has been.
   */
  readonly candidateDays: readonly number[];
  /** Every still-governable day; Mobility is deliberately equipment-free. */
  readonly equipmentFreeCandidateDays?: readonly number[];
  /** The athlete's stated weakness as a `:105` focus, or null. Leans the needs only. */
  readonly weakPointFocus?: WeakPointFocus | null;
  /** Exact automatic-choice evidence owned by the canonical compiler. */
  readonly selectionTracesOut?: import('../rules/programmingSelectionTrace').AutomaticProgrammingSelectionTrace[];
}

export interface OptionalTopUpResult {
  readonly workouts: Workout[];
  readonly placements: readonly OptionalTopUpPlacement[];
}

/**
 * Compute the week's needs and place at most what fills them.
 *
 * Returns the week unchanged when nothing is lacking, which is the common case and
 * the whole distinction between a top-up and a default.
 */
// BIBLE_ANCHOR: optional_placement_five_conditions
export function applyOptionalTopUps(args: ApplyOptionalTopUpsArgs): OptionalTopUpResult {
  const placements = computeOptionalTopUps({
    workouts: args.workouts,
    seasonPhase: args.seasonPhase,
    candidateDays: args.candidateDays,
    equipmentFreeCandidateDays: args.equipmentFreeCandidateDays,
    gameDayOfWeek: args.gameDayOfWeek,
    weakPointFocus: args.weakPointFocus ?? null,
  });
  if (placements.length === 0) {
    return { workouts: [...args.workouts], placements: [] };
  }

  const placed: Workout[] = [];
  for (const placement of placements) {
    const date = isoDateForWeekday(args.weekStartISO, placement.dayOfWeek);
    const athlete = placement.type === 'mobility'
      ? { ...args.athlete, equipmentTags: ['bodyweight' as const] }
      : args.athlete;
    const session = buildDerivedSession(
      DERIVED_TYPE[placement.type],
      date,
      args.microcycleId,
      TOP_UP_REASON,
      {
        ...athlete,
        daysToGame: args.daysToGameByDay?.[placement.dayOfWeek],
        selectionTracesOut: args.selectionTracesOut,
        selectionWeekStartISO: args.weekStartISO,
      },
    );
    // An empty composition is no session rather than an empty card: equipment and
    // injury filtering can thin a pool, and the app shrinks rather than padding.
    if ((session.exercises ?? []).length === 0) continue;
    placed.push({
      ...session,
      // `buildDerivedSession` derives the day from the DATE; the placement already
      // decided the day, and disagreeing with it here would put the session on a
      // day the caps never checked.
      dayOfWeek: placement.dayOfWeek,
      // VISIBLY OPTIONAL — one of Sam's five conditions, and `optional` is the
      // app's own word for it. The Mobility door builds its session at
      // `sessionTier: 'recovery'`, which is right for a session the ATHLETE chose:
      // they did not need it offered. A session the app places must say it is an
      // offer. Caught by the bible's absolutely-cooked-week cell on the first run
      // after wiring — that week requires every session to read as optional, and a
      // recovery-tier top-up did not.
      sessionTier: 'optional',
    });
  }

  const placedDays = new Set(placed.map((workout) => workout.dayOfWeek));
  return {
    workouts: [
      ...args.workouts.filter((workout) =>
        !placedDays.has(workout.dayOfWeek) || !isExplicitRestStub(workout)),
      ...placed,
    ],
    placements,
  };
}

/**
 * WHICH NEED PLACED IT IS NOT STORED, and that is the convergent choice.
 *
 * It would be useful provenance and it is genuinely tempting. But the need is a
 * DERIVATION over the week's own rows — `computeOptionalTopUps` recomputes it from
 * the week at any time — and the north star presumes new stored state wrong unless
 * it is an input. So the decision travels to the CALLER in `placements`, where a
 * gate or a log can use it, and nothing about it is written into the week.
 */
