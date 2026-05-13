/**
 * legacyCoachActionFilter.ts — hard block on the legacy /coach-chat
 * endpoint emitting program mutations of any kind.
 *
 * THE PROBLEM
 *
 * Live bugs that motivated this filter:
 *
 *   1. /coach-chat returned `replace_exercise(local_adjustment)` for
 *      "The Wednesday one" (a clarifier answer). The hallucinated date
 *      was six months in the past.
 *
 *   2. /coach-chat returned `set_preferred_alternative(permanent_preference)`
 *      for "Yes" (a confirmation answer to a clarifier). The pref was
 *      written even though the user never asked for one — it claimed
 *      "Done" without any verification path.
 *
 * THE RULE
 *
 * Every program change — STRUCTURAL or PERMANENT-PREFERENCE — now flows
 * through the deterministic CoachCommandRouter + executor + verifier
 * path. The legacy path is conversation-only: grounded answers about the
 * visible program. The ONLY action it may emit is `save_note`
 * (coach-memory write that never touches the program).
 *
 * Why permanent prefs are now blocked too: an LLM extracting
 * `set_preferred_alternative` from a single-word "Yes" reply has no
 * grounding context — it's guessing. The router knows whether the user
 * just answered a clarifier and what command was pending; the legacy
 * path does not. Closing this gap eliminates the entire "Done — I'll use
 * X" reply class without verification.
 *
 * USAGE
 *
 *   const { kept, blocked } = filterLegacyCoachActions(actions);
 *   if (blocked.length) logger.warn('[legacy-action-blocked]', { ... });
 *   for (const a of kept) applyCoachActions([a]);
 */

import type { CoachActionKind } from './coachActions';

/**
 * Action kinds that the legacy path is FORBIDDEN to apply. These reach
 * into the rendered program and write date-scoped overrides — they MUST
 * flow through the CoachCommandRouter so the visible-diff verifier can
 * enforce honesty.
 */
const STRUCTURAL_ACTION_KINDS: ReadonlySet<CoachActionKind> = new Set([
  'lighten_session',
  'move_session',
  'make_session_optional',
  'replace_exercise',
  'remove_exercise',
  'add_weekly_override',
]);

/**
 * Action kinds that historically rode through legacy as
 * "permanent preferences" but are STILL forbidden — the same hallucination
 * surface applies (the LLM has no grounding context to know whether the
 * user actually wants the pref written). Drop them; force the router.
 */
const PERMANENT_PREF_FORBIDDEN_ACTION_KINDS: ReadonlySet<CoachActionKind> = new Set([
  'ban_exercise_globally',
  'set_preferred_alternative',
]);

/**
 * The only legacy action kind allowed through. `save_note` is a
 * coach-memory write — it never claims to change the visible program or
 * write a future-affecting preference, so it can't manifest as
 * "I changed your bike" without verification.
 */
const ALLOWED_ACTION_KINDS: ReadonlySet<CoachActionKind> = new Set([
  'save_note',
]);

/**
 * Scopes that imply a program-state mutation. If a legacy action carries
 * one of these, even on an otherwise-allowed `save_note` kind, we block
 * it — `save_note` should never claim to be a local week adjustment.
 *
 * `permanent_preference` is the legitimate scope for `save_note` (a
 * coach-memory write with no week-effect), so it's NOT forbidden here.
 */
const FORBIDDEN_SCOPES: ReadonlySet<string> = new Set([
  'local_adjustment',
]);

export interface LegacyAction {
  kind: CoachActionKind;
  scope: string;
  payload?: any;
  [extra: string]: any;
}

export type LegacyBlockReason =
  | 'structural_action_blocked'
  | 'permanent_pref_blocked'
  | 'forbidden_scope_blocked'
  | 'unknown_action_kind';

export interface FilterLegacyActionsResult {
  /** Actions that survived the filter and may be applied. */
  kept: LegacyAction[];
  /** Actions blocked because they claimed program changes. */
  blocked: Array<{
    action: LegacyAction;
    reason: LegacyBlockReason;
  }>;
}

/**
 * Drop any structural OR permanent-preference action emitted by the
 * legacy /coach-chat endpoint. Returns the kept set + a parallel
 * `blocked` list the caller should log so the hallucination surface
 * stays observable.
 *
 * Pure — no side effects, no logger calls.
 */
export function filterLegacyCoachActions(
  actions: LegacyAction[] | null | undefined,
): FilterLegacyActionsResult {
  const kept: LegacyAction[] = [];
  const blocked: FilterLegacyActionsResult['blocked'] = [];
  if (!Array.isArray(actions) || actions.length === 0) {
    return { kept, blocked };
  }
  for (const a of actions) {
    if (!a || typeof a.kind !== 'string') {
      blocked.push({ action: a as any, reason: 'unknown_action_kind' });
      continue;
    }
    if (STRUCTURAL_ACTION_KINDS.has(a.kind)) {
      blocked.push({ action: a, reason: 'structural_action_blocked' });
      continue;
    }
    if (PERMANENT_PREF_FORBIDDEN_ACTION_KINDS.has(a.kind)) {
      blocked.push({ action: a, reason: 'permanent_pref_blocked' });
      continue;
    }
    if (typeof a.scope === 'string' && FORBIDDEN_SCOPES.has(a.scope)) {
      blocked.push({ action: a, reason: 'forbidden_scope_blocked' });
      continue;
    }
    if (ALLOWED_ACTION_KINDS.has(a.kind)) {
      kept.push(a);
      continue;
    }
    // Unknown / future kind — be conservative and block.
    blocked.push({ action: a, reason: 'unknown_action_kind' });
  }
  return { kept, blocked };
}
