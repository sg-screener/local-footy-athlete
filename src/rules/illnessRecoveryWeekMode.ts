/**
 * illness_recovery week-mode derivation — the SINGLE pure composition-boundary
 * function that mints the mode from the fact store.
 *
 * Doctrine (Sam sign-off 2026-07-23): a first-class Section18WeekMode is derived
 * ONLY from an active SEVERE illness source fact covering the week. This is the
 * one place that inspects facts to decide the mode; its OUTPUT (the mode) is
 * passed into the contract input, and the gateway/contract consumes the mode and
 * never re-reads facts. The illness fact is NOT smuggled onto the fatigue
 * constraint, and raw facts are not threaded into the contract input — only the
 * derived mode is.
 */

import { activeTemporarySourceFacts } from './temporarySourceFact';
import type { TemporarySourceFact } from './temporarySourceFact';
import { factHorizonCoversWeek } from './durableFactHorizon';

/**
 * True iff an active severe illness fact covers the given week — the sole
 * trigger for the illness_recovery §18 week mode. Existing bye/readiness logic
 * is untouched: a minor illness fact (inert), a severe fatigue/soreness fact, a
 * resolved fact, and a fact whose horizon does not reach this week all leave
 * this false.
 *
 * Stage 1: coverage is asked of `durableFactHorizon`, never recomputed here.
 * This function used to carry its own overlap predicate — one of the four
 * competing duration representations — and it returned false for every week
 * after the report week because the fact's window had been truncated upstream.
 * It has no opinion about duration now, so it cannot disagree with the fact.
 */
export function deriveIllnessRecoveryWeekMode(args: {
  temporarySourceFacts: readonly TemporarySourceFact[];
  weekStartISO: string;
}): boolean {
  return activeTemporarySourceFacts(args.temporarySourceFacts).some((fact) =>
    fact.factKind === 'illness' &&
    fact.severity === 'severe' &&
    factHorizonCoversWeek(fact, args.weekStartISO));
}
