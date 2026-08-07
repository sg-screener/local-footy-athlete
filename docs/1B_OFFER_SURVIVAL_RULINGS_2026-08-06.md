# 1B OFFER SURVIVAL RULINGS — 2026-08-06

Rulings on the two questions in
`docs/1B_OFFER_SURVIVAL_REASSESSMENT_2026-08-06.md`.

Per RULE-DON'T-ASK (`docs/COWORK_SEAT_HANDOFF_2026-08-06_REBUILD_ERA.md`
§1), these were RULED BY THE REVIEW SEAT from Sam's recorded law, with
Sam holding a veto. Governing law, verbatim from
`docs/FLUSH_OFFER_RULING_2026-08-05.md` (Sam, 2026-08-05, "a"):

> "the app always presents it; doing it is the athlete's choice"

## Ruling 1 — the offer IS repairable

"Always presents" is a property of the WEEK at all times, not of the
moment of generation. A week that stops offering — via repair, deletion,
relocation, or a fixture move within a mode that still declares an offer
— is out of conformance with Sam's ruling and Bible `:81`, and the
existing repair owner restores it. The alternative reading (placed once,
an edit may cost it) contradicts the ruling and is rejected.

## Ruling 2 — advisory, never blocking

"Doing it is the athlete's choice." A missing offer is a repairable
finding (`offer_not_presented` when `optionalFlushCount <
plannerSelectedCount`), surfaced and repaired like any other shortfall —
but it never refuses or blocks an athlete's week.

## Architecture approved

The reassessment's question-5 design: the evaluator makes the unplaced
offer VISIBLE (nothing new stored — ledger `optionalFlushCount` vs
contract `plannerSelectedCount`); the whole-week repair owner gains ONE
placement rule reusing the placer's existing eligibility
(`flushFixtureSafe`, strength day preferred, never a team day), so
generation and repair place the offer identically. No fourth site learns
about flushes; the placement rule moves out of
`applySection18ConditioningAllocation`'s tail into the shared owner.

Copy note: no new athlete-visible words. The declared-red tests must go
green with their ORIGINAL signed sentences (the "rebalanced Monday"
clause disappears because nothing needs rebalancing).

## Tests that prove the boundary

- `athleteSessionDeletionTests` regressions 15 and 17 green, declared-red
  entries deleted in the greening commit, original signed sentences
  intact.
- New cell: a fixture MOVE inside a mode that still declares an offer
  comes back still offering one (the unmeasured second face).
