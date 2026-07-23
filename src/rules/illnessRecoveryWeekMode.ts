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
import { addDaysISO } from '../utils/programBlockState';

/**
 * True iff an active severe illness fact covers the given week — the sole
 * trigger for the illness_recovery §18 week mode. Existing bye/readiness logic
 * is untouched: a minor illness fact (inert), a severe fatigue/soreness fact, a
 * resolved fact, and a fact scoped to a different week all leave this false.
 */
export function deriveIllnessRecoveryWeekMode(args: {
  temporarySourceFacts: readonly TemporarySourceFact[];
  weekStartISO: string;
}): boolean {
  const weekEnd = addDaysISO(args.weekStartISO, 6);
  return activeTemporarySourceFacts(args.temporarySourceFacts).some((fact) =>
    fact.factKind === 'illness' &&
    fact.severity === 'severe' &&
    // Overlap: the fact's active window intersects [weekStart, weekEnd].
    fact.effectiveFrom <= weekEnd &&
    fact.effectiveUntil >= args.weekStartISO);
}
