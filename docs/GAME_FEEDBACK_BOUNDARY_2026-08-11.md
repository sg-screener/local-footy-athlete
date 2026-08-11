# GAME FEEDBACK — BOUNDARY — 2026-08-11

**LOOP CHECK: `later-layer-drops-valid-intent` — first named sighting in this
surface.**

The old form already collected how the athlete felt after a game, but its save
adapter omitted that answer before the accepted transaction. The screen appeared
to understand the athlete while the durable record did not. Implementation
stopped for an ownership reassessment before adding the other match questions.

## Options compared before implementation

1. Add four independent fields and copy each through the form, adapter,
   normalizer, durable record and every reader. This is the smallest local edit,
   but preserves the omission class that dropped the existing answer.
2. Define one complete typed game result, validate it once at the accepted
   transaction boundary, and carry that value unchanged in the same dated
   feedback record used by strength and conditioning sessions.

Option 2 was chosen. It removes four parallel field-copy contracts and does not
create a game-only store or practice-match-only write path.

## What changed

- Scheduled games and pre-season practice matches open the same dedicated
  feedback form through the existing session taxonomy.
- The form records whole game / part of game, rough time on ground in hours and
  minutes, body RPE from 1–10, and Flying / Good / Normal / Bad / Heavy.
- All four answers are required before Save game appears.
- The complete result is stored on the same date-keyed session feedback record
  and through the same accepted transaction as the regular S&C form.
- New writes use the complete game result. The Journal reads that result first
  and lifts the old standalone feeling only as a legacy fallback.
- Saving match feedback does not create a modifier, injury or program edit.
  Sam explicitly removed automatic adaptation from this unit.

## First-run finding — reported before repair

The existing game-feel answer was present in the form draft but disappeared when
the adapter rebuilt the transaction intent from a hand-maintained field subset.
The new complete result is now pinned across the adapter, normalization and
durable publication boundary as one value.

## Verification

- 15 focused transaction cells passed: exact five-point wording; one shared
  taxonomy-selected form; all four questions present; complete payload preserved
  across the tap adapter, normalization, durable envelope, hydration and dated
  record; scheduled and practice fixtures share the classification; no legacy
  field on new writes; no program, modifier or injury change; non-game and
  invalid payloads refused.
- 58 Journal cells passed, including canonical game-feel readback with the legacy
  field only as fallback.
- 39 practice-match shape cells passed, confirming practice fixtures keep their
  established Game identity.
- Athlete-visible copy extraction and ruling binding passed.
- Product typechecking added zero diagnostics against the repository baseline.

The older full session-outcome sweep still has one legacy hydration mismatch
after 91 cells pass. A separate coach-note display check cannot start because it
points to a screen file that no longer exists. These are existing failures and
are not reported as passes for this unit.

The repository-wide law audit remains red on **32 unguarded law rows out of 92
registry rows**. The new law row is well formed, names a real in-chain guard and
does not add to that debt.

## What catches the next defect of this class

The focused guard sends a real game-classified workout and complete result through
the accepted transaction, then compares the value at each seam and in the durable
record. Removing any part of the result from the adapter, normalizer or publisher
breaks the round trip. The same guard refuses incomplete values and values attached
to a non-game workout, while its state comparison catches a future save path that
starts changing the program.

## North Star

Toward it. The screen records one athlete result, the accepted transaction owns
validation and publication, and the dated feedback record remains the only source
of truth. Practice matches share the established Game identity rather than adding
another representation.

## NOT COVERED

- Sam's physical iPhone. Athlete-facing acceptance remains open until he checks
  the form there.
- A simulator/glass run of the completed form. The numeric keyboard, scrolling,
  smallest-phone fit and ten-chip RPE wrapping have not been observed.
- Historical game records containing only the old feeling answer cannot recover
  whole-game participation, time on ground or RPE; those values remain absent.
- Automatic program adjustment from match feedback. Sam explicitly ruled it out
  of this unit.
- Full repository conformance while the 32-row law-enforcement backlog remains
  red.
