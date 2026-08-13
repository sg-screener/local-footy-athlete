/**
 * THE LIVE AWAY SPANS — ONE OWNER FOR A TRIP THAT WAS READ TWO WAYS.
 *
 * SEAT_INBOX item 61, sighting 3 ("away"), seat `vocab`, 2026-08-13.
 *
 * ## THE DEFECT THIS CLOSES
 *
 * The item's class is *"one concept, two word-lists, no total mapping, and the
 * gap is SILENT"*. Away was the third sighting, and it was the purest: two
 * functions answered *"which trips are live over this week"* and **shared not
 * one field name between them.**
 *
 * | | the derived week asked | generation asked |
 * | --- | --- | --- |
 * | discriminator | `factKind === 'schedule'` | `type === 'schedule'` |
 * | start | `effectiveFrom` | `startDate` |
 * | end | `effectiveUntil` | `expiresAt` |
 * | liveness | `status === 'active'` | `status !== 'resolved'` |
 * | input typing | typed `TemporarySourceFact` | **`readonly any[]`** |
 *
 * One decides whether a game still anchors the week; the other decides whether
 * the club comes off the calendar. **Each half understood only its own list.**
 *
 * ## WHAT WAS *NOT* WRONG, BECAUSE A COUNT IS NOT A VERDICT
 *
 * On their faces those two liveness tests disagree —
 * `TemporarySourceFactStatus` is `active | resolved | expired | superseded`, so
 * `=== 'active'` drops two members that `!== 'resolved'` keeps, and an expired
 * trip would leave the derived week saying *"he is home, the game anchors"*
 * while generation said *"he is away, strip the club"*.
 *
 * **THE SEAM WAS RUN BEFORE THAT WAS WRITTEN UP, AND IT REFUTES IT.**
 * `activeTemporarySourceFacts` rejects every fact whose `status !== 'active'`
 * BEFORE `scheduleProjection` sees it, and the projection then hard-codes
 * `status: 'active'` on what it emits. The constraint side is incapable of
 * holding a non-active travel span, so the two predicates agree in practice.
 *
 * **THE DIVERGENCE WAS LATENT, NOT LIVE — AND THAT IS STILL WHY THIS EXISTS.**
 * The two halves agreed by luck of an upstream filter rather than by
 * construction. Nothing tied `expiresAt` to `effectiveUntil`; the constraint
 * side was `any[]`, so **a rename on the projection would have broken exactly
 * one half, silently, with no compiler and no cell to catch it.** This module
 * is the fix applied before the damage, not after it.
 *
 * ## THE COMPRESSION, AND IT IS THE ONE THE EQUIPMENT SIGHTING ALREADY PROVED
 *
 * Item 61's worked example (`9c0d1776`) closed equipment by DERIVING one list
 * from the other's demand rather than syncing two authored lists. The same
 * shape here:
 *
 *   - **ONE span type** (`AwaySpan`) and **one open-horizon rule**, stated once.
 *   - **The constraint reader is TYPED**, so the field names it reads are the
 *     ones `ActiveScheduleConstraint` actually declares. A rename is now a
 *     COMPILER error in the half that used to fail silently.
 *   - **The two readers are pinned to each other by a round trip through the
 *     REAL projection** (`test:away-span-ownership`), so "they mean the same
 *     thing" is asserted, never trusted.
 *
 * **WHAT THIS DOES NOT DO, DELIBERATELY:** it does not merge the two INPUTS.
 * A fact and its compatibility projection are genuinely two shapes with two
 * lifetimes, and collapsing them is a much larger unit than item 61 ordered.
 * What is merged is the QUESTION — there is now one answer to "is he away", in
 * one vocabulary, however you arrived at it.
 */
import type { ActiveConstraint, ActiveScheduleConstraint } from '../store/coachUpdatesStore';
import type { TemporarySourceFact } from './temporarySourceFact';

/**
 * THE TRIP, IN ONE VOCABULARY. `until` is the LAST DAY AWAY — the athlete is
 * home on the day they return, which is the off-by-one the away door already
 * states when it writes the fact (`HomeScreenV2`, `addDaysISO(returnISO, -1)`).
 */
export interface AwaySpan {
  readonly from: string;
  readonly until: string;
}

/**
 * AN OPEN HORIZON IS NOT A TRIP, and this is the rule both halves already had
 * separately — stated once here so it cannot be changed in one of them.
 *
 * A travel span with no end would take the athlete's fixtures off the calendar
 * for ever. Both former readers skipped it; neither said so where the other
 * could see.
 */
const isClosedSpan = (from: unknown, until: unknown): boolean =>
  typeof from === 'string' && from.length > 0
  && typeof until === 'string' && until.length > 0;

const asDate = (value: string): string => value.slice(0, 10);

/**
 * THE FACT VOCABULARY — `factKind` / `effectiveFrom` / `effectiveUntil`.
 *
 * Read by the derived-week contract, where the question is whether a fixture
 * inside the trip may still anchor the week. Sam, 2026-08-13: *"If you're away,
 * you're not playing … the game on the 15th should be removed … but the next
 * saturday the 22nd game is still alive"*.
 */
export function awaySpansFromFacts(
  facts: readonly TemporarySourceFact[] | undefined,
): AwaySpan[] {
  return (facts ?? [])
    .filter((fact): fact is Extract<TemporarySourceFact, { factKind: 'schedule' }> =>
      'factKind' in fact && fact.factKind === 'schedule'
      && (fact as { scheduleKind?: string }).scheduleKind === 'travel'
      && fact.status === 'active'
      && isClosedSpan(fact.effectiveFrom, fact.effectiveUntil))
    .map((fact) => ({
      from: asDate(String(fact.effectiveFrom)),
      until: asDate(String(fact.effectiveUntil)),
    }));
}

/**
 * THE CONSTRAINT VOCABULARY — `type` / `startDate` / `expiresAt`.
 *
 * Read by generation, where the question is whether club-bound work comes off.
 *
 * **THE PARAMETER IS TYPED AND THAT IS THE POINT OF THE UNIT.** It was
 * `readonly any[]`, which is cause #1 of item 61's census — *"the input side is
 * untyped `string`/`any`, so there is no word-list to check against"*. With
 * `ActiveConstraint` here, `startDate`, `expiresAt`, `scheduleKind` and
 * `status` are all checked against what the store actually declares.
 *
 * `status !== 'resolved'` is KEPT rather than narrowed to `=== 'active'`:
 * `ActiveScheduleConstraint.status` is `InjuryStatus`
 * (`active | improving | resolved`), a DIFFERENT word-list from the fact's, and
 * silently dropping `improving` here would be inventing a rule under the guise
 * of tidying one. The round-trip cell is what proves the two agree.
 */
export function awaySpansFromConstraints(
  constraints: readonly ActiveConstraint[] | undefined,
): AwaySpan[] {
  return (constraints ?? [])
    .filter((constraint): constraint is ActiveScheduleConstraint =>
      constraint?.type === 'schedule'
      && (constraint as ActiveScheduleConstraint).scheduleKind === 'travel'
      && constraint.status !== 'resolved'
      && isClosedSpan(
        (constraint as ActiveScheduleConstraint).startDate,
        (constraint as ActiveScheduleConstraint).expiresAt,
      ))
    .map((constraint) => ({
      from: asDate(String(constraint.startDate)),
      until: asDate(String(constraint.expiresAt)),
    }));
}

/** Is `dateISO` inside any live trip? The one predicate both halves may use. */
export function dateIsInsideAwaySpan(
  dateISO: string,
  spans: readonly AwaySpan[],
): boolean {
  const date = asDate(dateISO);
  return spans.some((span) => date >= span.from && date <= span.until);
}
