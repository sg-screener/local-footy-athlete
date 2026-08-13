/**
 * ONE TRIP, ONE ANSWER — SEAT_INBOX item 61, sighting 3 ("away").
 * Seat `vocab`, 2026-08-13.
 *
 * ## WHAT THIS HOLDS
 *
 * Two halves of the app ask *"which trips are live over this week"*. The
 * derived-week contract asks it to decide whether a fixture inside the trip may
 * still anchor the week; generation asks it to decide whether club-bound work
 * comes off. **They used to ask it in two vocabularies sharing not one field
 * name** — `factKind`/`effectiveFrom`/`effectiveUntil`/`status === 'active'`
 * against `type`/`startDate`/`expiresAt`/`status !== 'resolved'`, the second
 * over a `readonly any[]`.
 *
 * `rules/awaySpans.ts` is now the one owner. **This suite is the proof that its
 * two readers MEAN THE SAME THING**, and it gets that proof the only way it can
 * be had: by running a real travel fact through the REAL compatibility
 * projection and asserting the two readings match. Asserting the map rather
 * than trusting it is what found the third conditioning narrowing on the same
 * item, and it is what is done here.
 *
 * ## WHY A ROUND TRIP AND NOT TWO UNIT CELLS
 *
 * Two cells, each checking one reader against a hand-built input, would both
 * stay green while the halves drifted apart — that is exactly the state the app
 * was already in. **The defect lives in the JOIN**, so the cell must span it.
 *
 * DEPTH (L13): 1 — one projection hop over authored facts. It does not generate
 * a week; what it asserts is that the two READINGS of a trip agree, which is
 * the item's claim. Whether a week then places the right sessions is
 * `test:away-flow`'s subject and is not restated here.
 *
 * Run: npm run test:away-span-ownership
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  awaySpansFromConstraints,
  awaySpansFromFacts,
  dateIsInsideAwaySpan,
} from '../rules/awaySpans';
import {
  composeTemporarySourceFactCompatibility,
  TEMPORARY_SOURCE_FACT_PROTOCOL_VERSION,
  type TemporaryScheduleFact,
  type TemporarySourceFactStatus,
} from '../rules/temporarySourceFact';
import { armTotalsOrRed } from './support/totalsOrRed';

armTotalsOrRed();

let passed = 0; let failed = 0;
function run(name: string, condition: unknown, detail?: unknown): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failed += 1;
  console.log(`  FAIL ${name}${detail === undefined ? '' : `\n      ${
    typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
}

/** A real `travel` fact, in the shape the away door writes. */
function travelFact(args: {
  from: string;
  until: string | null;
  status?: TemporarySourceFactStatus;
  factId?: string;
}): TemporaryScheduleFact {
  return {
    protocolVersion: TEMPORARY_SOURCE_FACT_PROTOCOL_VERSION,
    factId: args.factId ?? 'fact-travel-1',
    factKind: 'schedule',
    scheduleKind: 'travel',
    status: args.status ?? 'active',
    observedDate: args.from,
    effectiveFrom: args.from,
    effectiveUntil: args.until,
    // THE SCOPE IS THE REAL SHAPE, NOT A CAST. A fixture is a claim too: a
    // `{ kind: 'span' }` invented here compiled only behind an `as`, and a
    // scope the app cannot produce would prove nothing about the app.
    scope: { kind: 'window', from: args.from, until: args.until },
    athleteReportedLevel: 'moderate',
    createdAt: `${args.from}T09:00:00.000Z`,
    updatedAt: `${args.from}T09:00:00.000Z`,
    resolvedAt: null,
    sourceActor: 'athlete',
    sourceSurface: 'program_tab',
    legacyMigrationStatus: 'native_v1',
    transitionHistory: [],
    unavailableDates: [],
    unavailableWeekdays: [],
    maxSessions: null,
    teamNightFromDate: null,
    teamNightToDate: null,
  };
}

const constraintsFor = (facts: readonly TemporaryScheduleFact[], onDate: string) =>
  composeTemporarySourceFactCompatibility({
    temporarySourceFacts: facts,
    onDate,
  }).activeConstraints;

console.log('\n-- One trip, one answer (SEAT_INBOX item 61, sighting 3) --');

// ── 1. NON-VACUITY FIRST ────────────────────────────────────────────────────
//
// EVERY CELL BELOW IS AN EQUALITY BETWEEN TWO READINGS, and two readings that
// both return NOTHING are equal. That is the shape this repo has paid for
// repeatedly — a green gate over an empty world. So the fixture must first be
// shown to produce a span AT ALL, on both sides, before agreement means a thing.
const TRIP = travelFact({ from: '2026-08-10', until: '2026-08-20' });
const factSpans = awaySpansFromFacts([TRIP]);
const constraintSpans = awaySpansFromConstraints(constraintsFor([TRIP], '2026-08-12'));

run('[1] NON-VACUITY — the FACT reader returns a real span',
  factSpans.length === 1 && factSpans[0].from === '2026-08-10'
  && factSpans[0].until === '2026-08-20', factSpans);

run('[1b] NON-VACUITY — the projection publishes a travel constraint the '
  + 'CONSTRAINT reader can see',
  constraintSpans.length === 1, {
    constraintSpans,
    scheduleConstraints: constraintsFor([TRIP], '2026-08-12')
      .filter((c) => c.type === 'schedule').length,
  });

// ── 2. THE JOIN — THE CELL THE WHOLE UNIT EXISTS FOR ────────────────────────
//
// The derived-week contract reads the FACT; generation reads the CONSTRAINT the
// projection built FROM that fact. If those two ever disagree about the same
// trip, one half of the app thinks the athlete is home while the other thinks
// he is away — and before this unit there was nothing that could notice.
run('[2] THE TWO HALVES READ THE SAME TRIP IDENTICALLY',
  JSON.stringify(factSpans) === JSON.stringify(constraintSpans),
  { fromFacts: factSpans, fromConstraints: constraintSpans });

// ── 3. THE OPEN HORIZON, STATED ONCE ───────────────────────────────────────
//
// An endless trip would take the club off the calendar for ever. BOTH former
// readers skipped it and neither said so where the other could see; the rule
// now lives in one place, so this asserts both halves inherit it.
const OPEN = travelFact({ from: '2026-08-10', until: null, factId: 'fact-open' });
run('[3] an OPEN-ended trip is not a trip — on BOTH sides',
  awaySpansFromFacts([OPEN]).length === 0
  && awaySpansFromConstraints(constraintsFor([OPEN], '2026-08-12')).length === 0, {
    fromFacts: awaySpansFromFacts([OPEN]),
    fromConstraints: awaySpansFromConstraints(constraintsFor([OPEN], '2026-08-12')),
  });

// ── 4. THE LATENT DIVERGENCE, PINNED WHERE IT WAS ──────────────────────────
//
// ⚠ READ THIS BEFORE "SIMPLIFYING" EITHER PREDICATE. The two liveness tests are
// written over DIFFERENT word-lists and are NOT the same sentence:
//   fact:       `TemporarySourceFactStatus` = active | resolved | expired | superseded
//   constraint: `InjuryStatus`              = active | improving | resolved
// so `=== 'active'` and `!== 'resolved'` disagree on `expired`/`superseded`.
//
// THEY AGREE IN PRACTICE ONLY BECAUSE OF AN UPSTREAM FILTER:
// `activeTemporarySourceFacts` drops every non-active fact BEFORE
// `scheduleProjection` runs, and the projection hard-codes `status: 'active'`.
// **That is luck, not construction** — and this cell is what turns it into
// something that reds if the upstream filter is ever loosened.
for (const status of ['expired', 'superseded', 'resolved'] as const) {
  const stale = travelFact({
    from: '2026-08-10', until: '2026-08-20', status, factId: `fact-${status}`,
  });
  run(`[4:${status}] a ${status} trip is live on NEITHER side`,
    awaySpansFromFacts([stale]).length === 0
    && awaySpansFromConstraints(constraintsFor([stale], '2026-08-12')).length === 0, {
      fromFacts: awaySpansFromFacts([stale]),
      fromConstraints: awaySpansFromConstraints(constraintsFor([stale], '2026-08-12')),
    });
}

// ── 5. THE SHARED PREDICATE ────────────────────────────────────────────────
//
// `until` IS THE LAST DAY AWAY — the athlete is home on the day they return,
// which is the off-by-one the away door states when it writes the fact. Both
// edges are INSIDE; the return day is OUT.
run('[5] the span is inclusive of both edges and excludes the return day',
  dateIsInsideAwaySpan('2026-08-10', factSpans)
  && dateIsInsideAwaySpan('2026-08-20', factSpans)
  && !dateIsInsideAwaySpan('2026-08-21', factSpans)
  && !dateIsInsideAwaySpan('2026-08-09', factSpans));

console.log(`\nAway span ownership: ${passed} passed, ${failed} failed`);
console.log('  DEPTH (L13): 1 — one projection hop over authored facts.');
if (failed > 0) process.exit(1);
