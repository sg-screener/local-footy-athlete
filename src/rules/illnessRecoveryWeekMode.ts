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

import {
  activeTemporarySourceFacts,
  reportedLevelMakesSessionsOptional,
} from './temporarySourceFact';
import type { TemporarySourceFact } from './temporarySourceFact';
import { factHorizonCoversDate, factHorizonCoversWeek } from './durableFactHorizon';
import {
  ILLNESS_SEVERITY_TIERS,
  resolveIllnessDirective,
  type IllnessDirective,
  type IllnessSeverityTier,
} from './readinessIllnessLaw';

/**
 * The strongest active illness tier covering the week, or null if none.
 *
 * Coverage is asked of `durableFactHorizon` and never recomputed here, so this
 * function has no opinion about duration and cannot disagree with the fact.
 * "Strongest" matters because two facts can overlap — a lingering flu and a bad
 * day — and the athlete gets the more protective answer.
 */
export function deriveActiveIllnessTier(args: {
  temporarySourceFacts: readonly TemporarySourceFact[];
  weekStartISO: string;
}): IllnessSeverityTier | null {
  const covering = activeTemporarySourceFacts(args.temporarySourceFacts)
    .filter((fact) =>
      fact.factKind === 'illness' && factHorizonCoversWeek(fact, args.weekStartISO))
    .map((fact) => (fact as { severity: IllnessSeverityTier }).severity);
  if (covering.length === 0) return null;
  // ILLNESS_SEVERITY_TIERS is authored mild -> moderate -> severe, so the
  // highest index is the strongest. The order is the law's, not this file's.
  return covering.reduce((strongest, tier) =>
    ILLNESS_SEVERITY_TIERS.indexOf(tier) > ILLNESS_SEVERITY_TIERS.indexOf(strongest)
      ? tier
      : strongest);
}

/**
 * What the illness does to this week: THE ILLNESS LAW's two answers, and nothing
 * else.
 *
 * This is the week-mode subsystem's whole job now. It used to answer a single
 * different question — "is this a severe-illness week?" — and everything the
 * mode then did to the program was written beside the law rather than by it.
 * The law decides; this only reads the facts and asks.
 */
export function deriveIllnessWeekDirective(args: {
  temporarySourceFacts: readonly TemporarySourceFact[];
  weekStartISO: string;
}): IllnessDirective {
  const tier = deriveActiveIllnessTier(args);
  return tier
    ? resolveIllnessDirective(tier)
    : { deloaded: false, sessionsOptional: false };
}

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
  // DERIVED from the law's second flag, not decided here. The mode means "every
  // session is optional" and nothing more, so it is exactly `sessionsOptional`.
  // Reading the tier directly (`severity === 'severe'`) is how this file became a
  // second illness implementation; the tier is the law's business now.
  //
  // Note the pair coming apart: MODERATE deloads WITHOUT minting this mode. That
  // is authored — "severity decides exactly TWO things" — and it is the reason a
  // single boolean could never have carried the law.
  return deriveIllnessWeekDirective(args).sessionsOptional;
}

/**
 * ── EVERY SESSION OPTIONAL ON THIS DATE? — the per-DATE read of the law's
 * second flag, for the VIEW doors. ─────────────────────────────────────────
 *
 * Sam's laws give two producers of "nothing is required today": a SEVERE
 * illness while active ("deloaded AND every session becomes optional"), and an
 * "Absolutely cooked" readiness declaration inside its 7-day rolling window.
 * Both flags existed and were consumed at GENERATION time only, so a week that
 * was never regenerated after the declaration — most visibly the NEXT week —
 * kept rendering its sessions as required. Measured 2026-08-26
 * (durableFactHorizonTests A3a): a severe illness reported Friday left next
 * Monday's lower session and both club nights showing `core` on the program
 * screen.
 *
 * This is the read-side owner: coverage is asked of `durableFactHorizon`,
 * tier consequences of the law (`resolveIllnessDirective`,
 * `reportedLevelMakesSessionsOptional`) — nothing here re-derives a horizon
 * or a threshold. Callers are the VIEW doors (facts travel on the view
 * state only), so the decoration is derived on every read and never persisted.
 */
export function sessionsOptionalOnDate(args: {
  temporarySourceFacts: readonly TemporarySourceFact[] | null | undefined;
  dateISO: string;
}): boolean {
  const facts = activeTemporarySourceFacts(args.temporarySourceFacts ?? []);
  for (const fact of facts) {
    if (!('factKind' in fact)) continue;
    if (fact.factKind === 'illness'
      && factHorizonCoversDate(fact, args.dateISO)
      && resolveIllnessDirective(
        (fact as { severity: IllnessSeverityTier }).severity).sessionsOptional) {
      return true;
    }
    if (fact.factKind === 'fatigue'
      && factHorizonCoversDate(fact, args.dateISO)
      && reportedLevelMakesSessionsOptional(
        (fact as { athleteReportedLevel: Parameters<
          typeof reportedLevelMakesSessionsOptional>[0] }).athleteReportedLevel)) {
      return true;
    }
  }
  return false;
}
