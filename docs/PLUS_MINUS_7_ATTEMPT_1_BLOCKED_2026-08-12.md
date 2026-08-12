# ±7 — ATTEMPT 1, BUILT AND REVERTED. THE DEFECT IS CONFIRMED REAL; THE FIX IS BLOCKED ON ONE INPUT

**2026-08-12, unattended session.** Inbox item 3. **Nothing from this attempt is
in the tree** — `git checkout` reverted all three files, and the suites are back
at their baselines (`test:craft-tier` 36/36, `test:accepted-state-transactions`
23/23 + 10/10 + 10/10). This file is the receipt so attempt 2 does not re-derive
any of it.

---

## §1 THE DEFECT IS REAL, AND IT IS NOW REPRODUCED BY CELLS

`docs/PLUS_MINUS_7_MEASUREMENT_2026-08-12.md` predicted this from arithmetic and
said so ("written as a prediction, not a result"). **It is now observed.** Two
cells, written against `assessWeekCraft` with the fixture anchor moved:

```
P1  a Sunday-fixture week judges its MONDAY as the day after a game
    -> g_plus1_hard_work@2026-07-13   (RED before the fix, GREEN after)
P2  a Monday-fixture week judges its SUNDAY as the day before a game
    -> g1_not_light@2026-07-19        (RED before the fix, GREEN after)
```

**Both were VACUOUS on first writing and the vacuity was caught, not shipped.**
Two separate faults in the cells themselves, each worth keeping:

1. They read `finding.date`. The field is `finding.dates: string[]`. Every
   comparison was against `undefined`, so both cells PASSED against the defect.
2. The helper that moved the hardest session onto a named day filtered that day
   out FIRST and then mapped the moved session — so when the session already
   lived there it was removed and never restored, and the day under test was
   EMPTY. `a-bind-can-be-green-and-empty`. Fixed by asserting the day carries a
   judgeable unit (`P1a`/`P2a`) before asserting anything about findings.

**Attempt 2 should re-write these cells; they are the deliverable's guard.**

## §2 THE FIX THAT WORKED, AND EXACTLY WHY IT WAS REVERTED

The change: delete the `±7` synthesis in `section18CraftTier.craftValidatorInput`,
read the neighbouring fixtures from `activeFixtureDates` (the exact-date
authority, `previousGameDate` = latest fixture before the week, `nextGameDate` =
earliest after it), collapse the `.find()` to the anchor LIST, and forward
`activeFixtureDates` from the one production call site
(`section18AcceptedWeekGateway:1531`).

**It worked.** `test:craft-tier` 42/42 with P1/P2/P3 green, and the mutation
(restore `±7`) reddened P1 and P2 and nothing else.

**IT WAS REVERTED FOR ONE NEW RED IN THE SWEEP:** `11 of 190`, and the new entry
is `test:accepted-state-transactions` —

> `[property] a fixture MOVE publishes its dependent week once and leaves the
> week it decided a DECLARATION with no content`
> — *"following-week dependency was not committed in the same snapshot"*

**The ±7 invention was doing real work there.** An In-season athlete moves the
Saturday fixture to Sunday; the FOLLOWING week's Monday is G+1 of that Sunday.
`previousGameDate = fixture − 7` supplied that link by accident — accidentally
CORRECT, because the fixture genuinely repeats weekly. Removing the invention
removed the link on that path, and the dependency record was never written.

## §3 THE ACTUAL BLOCKER — one input, four different answers for one week

`activeFixtureDates` is not consistently supplied. Instrumented
`craftValidatorInput` and printed every call for the week the property drives:

```
week=2026-07-20  authority=["2026-07-18","2026-07-25","2026-08-01","2026-08-08"]  prev=2026-07-18
week=2026-07-20  authority=["2026-07-19","2026-07-25","2026-08-01"]               prev=2026-07-19
week=2026-07-20  authority=["2026-07-19","2026-07-25"]                            prev=2026-07-19
week=2026-07-20  authority=["2026-07-25","2026-07-18","2026-08-01"]               prev=2026-07-18
week=2026-07-20  authority=UNDEFINED                                              prev=null
week=2026-07-20  authority=[]                                                     prev=null
```

**Six calls, one week, four different answers to "when is the neighbouring
game" — including UNDEFINED, and including `2026-07-18`, the fixture the move
had already CANCELLED.** The old code could not see this because it never asked;
it computed the same wrong answer every time, which at least made it consistent.

**This is the real finding of the attempt.** The ±7 is a symptom. The disease is
that the exact-date fixture authority is optional, is threaded through at least
three gateway call paths, and disagrees with itself within a single operation.

## §4 WHAT ATTEMPT 2 MUST DO FIRST — and it is NOT the craft tier

**Make `activeFixtureDates` a REQUIRED input on the craft path and reconcile the
paths that disagree.** `WeekCraftInput.governableDates` already carries the
precedent, in its own words: *"supplied, never re-derived, and REQUIRED so it
cannot be forgotten."* The same sentence is owed here.

Order for attempt 2:

1. **Census the callers.** Three production gateway call sites pass it
   (`fixtureMinimalReplan`, `sessionResolver`, `programStore`); the UNDEFINED
   and stale-date variants observed above must each be traced to which one, and
   whether the stale `2026-07-18` is a pre-move snapshot legitimately in flight
   or a genuine staleness defect. **That question is worth answering on its own
   merits — a cancelled fixture answering "when is the game" is the same class
   of defect as the phantom.**
2. **Then** make it required, and only then delete the `±7`.
3. Re-write §1's cells, including `P3` (a REAL neighbouring fixture must still
   protect the day before it), which is what stops the fix becoming "never
   protect a neighbour".

**DO NOT re-attempt in the other order.** Deleting the invention while the
authority is inconsistent trades a phantom fixture for a missing one, and the
sweep says so.

## §5 STATUS OF EVERY CLAIM HERE

- **MEASURED** — §1's two reds (observed, non-vacuity asserted), §2's sweep
  result `11 of 190` with the single new entry named, §3's six authority values.
- **WORKING** — nothing. The tree is unchanged.
- **NOT INVESTIGATED** — why the stale `2026-07-18` appears; which call path
  each authority value comes from; whether the same inconsistency affects
  `derivedSessionProvenance`'s `exactFixtureDatePresent`, which reads the same
  optional set (`derivedSessionProvenance.ts:417-425`) and falls back to a
  contract-shape check when it is absent.
- **NORTH STAR: toward, and not taken.** The fix removes a representation; it
  is held only because the input it depends on is not yet trustworthy.
