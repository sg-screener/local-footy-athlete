/**
 * The routes offered when an athlete puts a session on the day before a game.
 * Declared HERE, in the dependency-free type module, so `PlanChange` does not
 * have to import the rules module that owns the behaviour — that cycle made
 * TypeScript give up narrowing `PlanChange` at two call sites.
 * Behaviour and copy live in `rules/g1LandingAsk.ts`.
 */
export type G1LandingRouteId =
  /**
   * Take the session the day was BUILT for. Offered only when G-1 is empty —
   * on an occupied day route (a) already keeps what is there (Sam, 2026-07-30).
   */
  | 'take_the_gunshow'
  /** Place the authored pre-game Primer, regardless of athlete gender. */
  | 'take_the_primer'
  /** Keep the derived Gunshow. The move is ABANDONED — no transaction at all. */
  | 'keep_the_day'
  /** Accessories only: pump and prehab, nothing heavy. */
  | 'accessories_only'
  /** The same session under the one reduction mechanism, DELOAD_LAW. */
  | 'deloaded';

/**
 * THE ATHLETE'S ADD/SWAP VOCABULARY — one declaration, so the runtime list and
 * the type can never disagree.
 *
 * It was a bare union. The session type charter has to ask "which doors exist?"
 * at runtime and answer it EXHAUSTIVELY, and a type union cannot be enumerated,
 * so the census would have been a hand-maintained second copy — one more
 * representation of a decision, which is the shape the north star forbids.
 * Deriving the union from the list makes a new door a compile error everywhere
 * that switches on it AND a charter failure until Sam has ruled its four
 * answers.
 */
export const PLAN_CHANGE_CATEGORY_IDS = [
  'conditioning_light',
  'conditioning_hard',
  'recovery',
  // MOBILITY (Sam's charter, stage 4). The Bible grants it outright at :122 —
  // "you can always add a recovery or mobility flow to any day as optional" —
  // and ten authored templates existed for months, reachable only as an add-on
  // INSIDE recovery. The athlete's vocabulary was five wide where Sam's is seven.
  'mobility',
  'strength_upper',
  'strength_lower',
  'strength_full',
  // SPLIT (Sam, 2026-07-30): 'accessories' was ONE door for TWO of Sam's seven
  // session types, and the charter recorded both of their placement answers as
  // unattributable because of it — a single door cannot say who may place a Gunshow
  // as distinct from who may place Prehab. They are different sessions from different
  // signed pools: Gunshow is 2 biceps + 2 triceps + 2 pump delts (Bible 20.3), Prehab
  // draws the six prehab pools.
  'gunshow',
  'prehab',
  // PRIMER (R-129, Sam 2026-08-23). Its own door because it is its own session
  // type: *"it's only available to be added by player or swapped by a player"*,
  // which makes the door the ONLY way it reaches a day. A category that shared
  // the Gunshow's row would be the accessories mistake again — one door for two
  // of Sam's types, and neither able to answer who may place it.
  'primer',
] as const;

export type PlanChangeCategoryId = (typeof PLAN_CHANGE_CATEGORY_IDS)[number];

/**
 * What a Move takes off the day (Sam, 2026-07-30 — session-scoped Move).
 *
 * Deliberately Bin's scope vocabulary MINUS `team`: team training is a
 * protected anchor and never travels. `whole_day` is offered only on days that
 * carry no anchor, because on a combined day it would take the anchor with it.
 */
export type PlanChangeMoveScopeId =
  | 'whole_day'
  | 'strength'
  | 'conditioning'
  | 'recovery'
  /**
   * The team night itself (Sam's team-night movability ruling, 2026-08-01;
   * signed 2026-08-02). Offered ONLY on a day whose projection carries a
   * `team_training` anchor, and it never commits directly: picking a
   * destination raises the typed team-night ask ("just this once, or
   * permanent?") and the answer travels as `move_team_night.teamNightRoute`.
   */
  | 'team';

/**
 * The two committing answers to the team-night ask. ABSENT on the change means
 * the athlete has not been asked yet, and the producer answers with the ask
 * instead of applying anything — the same absence-raises-the-ask shape as
 * `g1Route`. Behaviour and the seven signed strings live in
 * `rules/teamNightMoveAsk.ts`.
 */
export type TeamNightMoveRouteId = 'this_week_only' | 'permanent';

export type PlanChangeBinScopeId =
  | 'whole_day'
  | 'strength'
  | 'conditioning'
  | 'recovery'
  | 'team';

/**
 * The route the athlete picked when the day they are putting content on is the
 * day before a game. ABSENT means they have not been asked yet, and the producer
 * answers with the ask instead of applying anything — that is what makes a
 * silent substitution unreachable. See rules/g1LandingAsk.ts.
 *
 * Carried by EVERY door that can land content on a day, not by Move alone. The
 * ask is a property of the destination and of what lands on it; a swap that
 * could not carry an answer was a swap that never got asked, and on Sam's
 * device it reported "Done." over a day that had not changed.
 */
export interface G1RoutedPlanChange {
  g1Route?: G1LandingRouteId;
}

export type PlanChange =
  | { kind: 'remove_session'; date: string; scope?: PlanChangeBinScopeId }
  | ({ kind: 'swap_template'; date: string; templateId: string } & G1RoutedPlanChange)
  | ({ kind: 'add_template'; date: string; templateId: string } & G1RoutedPlanChange)
  | ({ kind: 'swap_category'; date: string; category: PlanChangeCategoryId }
      & G1RoutedPlanChange)
  | ({ kind: 'add_category'; date: string; category: PlanChangeCategoryId }
      & G1RoutedPlanChange)
  | ({
      kind: 'move_session';
      fromDate: string;
      toDate: string;
      /**
       * Which part of the source day moves. Absent means `whole_day`, which is
       * what every caller meant before session-scoped Move existed.
       */
      scope?: PlanChangeMoveScopeId;
      /**
       * R-226: the athlete's answer when the moved content carries Bible :156
       * team-night-flagged lifts and the destination is a team night. Absent
       * means "not asked yet" — the producer answers with the ask instead of
       * applying anything, the same shape as `g1Route` above.
       */
      teamNightContentRoute?: 'swap_safe' | 'keep_regular';
    } & G1RoutedPlanChange)
  | { kind: 'shutdown_week'; date: string }
  | { kind: 'clear_days'; dates: string[] }
  /**
   * A team night leaving its day (movability ruling, signed 2026-08-02).
   * NOT a `move_session`: the one-off route is a dated schedule fact through
   * the deriving lane, the permanent route is a `teamTrainingDays` answer
   * through the program-setup owner — neither is an accepted-state move.
   */
  | {
      kind: 'move_team_night';
      fromDate: string;
      toDate: string;
      teamNightRoute?: TeamNightMoveRouteId;
    };

export type TemplatePlanChange = Extract<
  PlanChange,
  { kind: 'swap_template' | 'add_template' }
>;

/**
 * The changes that put content ON a day, and can therefore carry the athlete's
 * answer to the G-1 ask. Bin and the week-level changes take content away, so
 * there is nothing to ask them about.
 */
export type G1RoutedChange = Extract<
  PlanChange,
  { kind: 'move_session' | 'swap_category' | 'swap_template' | 'add_category' | 'add_template' }
>;

export function isG1RoutedChange(change: PlanChange): change is G1RoutedChange {
  return change.kind === 'move_session' ||
    change.kind === 'swap_category' || change.kind === 'swap_template' ||
    change.kind === 'add_category' || change.kind === 'add_template';
}
