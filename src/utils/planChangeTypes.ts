/**
 * The routes offered when an athlete puts a session on the day before a game.
 * Declared HERE, in the dependency-free type module, so `PlanChange` does not
 * have to import the rules module that owns the behaviour — that cycle made
 * TypeScript give up narrowing `PlanChange` at two call sites.
 * Behaviour and copy live in `rules/g1MoveAsk.ts`.
 */
export type G1MoveRouteId =
  /** Keep the derived Gunshow. The move is ABANDONED — no transaction at all. */
  | 'keep_gunshow'
  /** Accessories only: pump and prehab, nothing heavy. */
  | 'accessories_only'
  /** The same session under the one reduction mechanism, DELOAD_LAW. */
  | 'deloaded';

export type PlanChangeCategoryId =
  | 'conditioning_light'
  | 'conditioning_hard'
  | 'recovery'
  | 'strength_upper'
  | 'strength_lower'
  | 'strength_full'
  | 'accessories';

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
  | 'recovery';

export type PlanChangeBinScopeId =
  | 'whole_day'
  | 'strength'
  | 'conditioning'
  | 'recovery'
  | 'team';

export type PlanChange =
  | { kind: 'remove_session'; date: string; scope?: PlanChangeBinScopeId }
  | { kind: 'swap_template'; date: string; templateId: string }
  | { kind: 'add_template'; date: string; templateId: string }
  | { kind: 'swap_category'; date: string; category: PlanChangeCategoryId }
  | { kind: 'add_category'; date: string; category: PlanChangeCategoryId }
  | {
      kind: 'move_session';
      fromDate: string;
      toDate: string;
      /**
       * Which part of the source day moves. Absent means `whole_day`, which is
       * what every caller meant before session-scoped Move existed.
       */
      scope?: PlanChangeMoveScopeId;
      /**
       * The route the athlete picked when the destination is the day before a
       * game. ABSENT means the athlete has not been asked yet, and the producer
       * answers with the ask instead of applying anything — that is what makes
       * a silent substitution unreachable. See rules/g1MoveAsk.ts.
       */
      g1Route?: G1MoveRouteId;
    }
  | { kind: 'shutdown_week'; date: string }
  | { kind: 'clear_days'; dates: string[] };

export type TemplatePlanChange = Extract<
  PlanChange,
  { kind: 'swap_template' | 'add_template' }
>;
