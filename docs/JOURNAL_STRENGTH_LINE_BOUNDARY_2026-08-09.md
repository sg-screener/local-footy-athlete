# THE STRENGTH LINE — boundary report (2026-08-09)

Monday card item 2 (and the addendum's progress markers — the design gives them
the same source). Built under the standing authorisation; dependency list
measured first in docs/JOURNAL_MONDAY_CARD_PLAN_2026-08-09.md.

Commit: `64d142d7`.

## ONE LINE

**"Back Squat — 120kg, up on last week." The first number the Journal ships to an
athlete — and it ships because it waits on nothing.**

## NORTH STAR: TOWARD

Zero new stored state. `SessionFeedback.strength[]` has been recorded since long
before the Journal existed — its own type comment says the snapshot was captured
*"for future progression/diary use"* — and this is that use. The whole line is a
pure derivation on read.

## WHY THIS NUMBER CAN SHIP WHEN THE LOAD HEADLINE CANNOT

Every load-model headline sits behind `signedValue` because it is downstream of a
constant Sam has not signed. This module has **no constants at all**: "10kg
heavier than last week" is a comparison of two recorded weights, not a judgement
against a threshold. `flat` is exact equality — a fact, not a tolerance.

**The moment a tolerance appears — "within 2.5kg counts as flat" — it becomes a
constant and joins the load model's signing table**, rather than being decided
quietly inside a surface. A cell asserts the module declares no threshold
constant, and a mutation that inserts a 2.5kg tolerance reds it.

## THREE ABSENCES ARE FIRST-CLASS ANSWERS

Each alternative would be a **record of work nobody did**, which is worse than a
wrong number because it is believable:

1. **A skipped lift is excluded.** `weightKg` on a skipped row is the weight that
   was PRESCRIBED and not lifted. Counting it reports a personal best for a
   session the athlete told us they did not do. (A `partial` lift still counts —
   it was performed.)
2. **A lift with no previous CALENDAR week is `new`, never `flat`.** An arrow is a
   claim that a comparison happened; `flat` would assert the athlete matched a
   week that does not exist.
3. **Reps are null when no per-set detail was logged** — never the prescribed
   range, which is what was asked for rather than what was done.

## "ANCHOR LIFT" HAS NO OWNER, AND I DID NOT INVENT ONE

The design says "one line per anchor lift". **Measured: the app has no anchor-lift
concept.** `isAnchor` in `sessionClassificationAdapter` and
`workoutCanonicalisation` means a game or team-training anchor **DAY** — a
different noun entirely.

What exists is `strengthLogging.isMainStrengthExercise`, which already filters
`SessionFeedback.strength[]` to main lifts. So this module reads "anchor lift" as
"the main lifts the app already records" and adds no rival predicate. **A narrower
authored set is a Sam ruling, not a guess for this file** — named in the suite's
NOT-COVERED line rather than silently decided.

## WEEK IDENTITY COMES FROM THE ONE OWNER

`journalWeekStartOf` and `calendarWeeksBefore`, both from `journalLoad`. The
arrow says "vs last week" out loud, and the load slice already paid once for
confusing the calendar week with the last week the athlete happened to log. A
cell asserts this module contains no date arithmetic of its own; the mutation
that swaps in "the most recent recorded week" reds it against a fixture where
the two disagree.

## SIX MUTATIONS, SIX REDS — AND ONE FALSE GREEN THAT IS THE REAL LESSON

A mutation reported as SURVIVING: substituting the prescription in for unlogged
reps. My first reading was that the cell was weak.

**It was not. The `perl` substitution had silently matched nothing, so the
mutation never applied.** Re-applied with the replacement verified present in the
file, the cell went red immediately.

**A mutation that fails to apply reports identically to one that survives — and
it points the author at their test instead of at their tooling.** That is the
same shape as `a fixture is a claim too` and `instrumentation must be alive where
the defects are`, at a third address. **Practical rule: assert the mutation is
PRESENT in the file before reading its result.** A `grep -c` on the replacement
costs nothing; believing a false survivor costs a weakened cell, or a rewritten
one that was already correct.

The other five: a skipped lift becoming a top set; a first-time lift claiming
`flat`; an unsigned 2.5kg tolerance; "last week" becoming "the last week I
trained"; and the tie-break dropped so the order wobbles.

## THE GATE

- **Full `test:bible`, UNPIPED: `GATE_EXIT=1` at `test:program-control-durable`,
  1 FAIL line** — main's declared red, same assertion text.
- **Sweep: `failures=2 of 162` = the declared set EXACTLY** —
  `test:program-control-durable`, `test:fixture-identity`, at head `64d142d7`.
- `test:compile` PASSED — no file regressed.
- New suite `test:journal-strength-trend` registered in `test:bible`: **23
  passed, 0 failed.**
- Copy batch 19 PROPOSED. Extraction ceiling **566 → 568**, attributed to the two
  sentences the extractor can see ("Your lifts", the honest empty state).

## NOT COVERED

- **NO DEVICE EVIDENCE.** The kg figure, the line length and how several lift
  rows stack are unverified by eye.
- **DEPTH (L13): 0.** Hand-built session records; no walked athlete.
- **The four arrow words are invisible to the extraction gate** — they live in a
  keyed object, one of the two shapes named as owed when the ceiling last rose.
  Listed in batch 19 anyway.
- **The rest of the Monday card is not built**: week status, this week's job,
  what changed / what was protected. Measured in the plan doc.
- **The notification is parked** — `expo-notifications` is not a dependency, and
  adding one plus a permission prompt is Sam's call.

## SAM'S QUESTIONS (parked, not waited on)

1. **Should "anchor lift" be a narrower authored set** than "the main lifts the
   app records"? Built as the latter because the former does not exist.
2. **Is `flat` right as exact equality?** A half-kilo more currently reads "up".
   A tolerance is a constant and would join your signing batch.
3. The four arrow words and the two new sentences of batch 19.
