# THE JOURNAL UNIT — END-OF-UNIT BOUNDARY REPORT (2026-08-09)

The standing authorisation (docs/SEAT_INBOX.md item 1, Sam: *"i just want to get
it all on there then we can worry about how it looks"*) is **complete**. Every
item in the design and the addendum is built, or measured and named with the
reason it is not.

**This is the unit's end, not a wall.** Everything remaining is Sam's to rule.

## ONE LINE

**The Journal is on the phone: what the week asked, what kind of work it held,
whether the work happened, how it felt, what the athlete changed, their lifts
with a real number, their load evidence, their niggles and what they wrote last
time, their month in charts — all of it derived, none of it stored.**

## THE SLICES, IN ORDER

| Slice | Commits | Sweep |
| --- | --- | --- |
| Load model | `d0651fc3` … `12da456f` | 2 of 160 |
| Feel (post-game rating + tap) | `41d847d7`, `528e5c67` | 2 of 161 |
| Strength line | `64d142d7` | 2 of 162 |
| This week's job | `67f80e0b` | 2 of 163 |
| Niggles + resurfacing | `b75cc63f` | 2 of 164 |
| Monthly review | `a04f2cb6` | 2 of 165 |
| Consistency / balance / flags | `a440136c`, `8e46b7d9`, `c8a349a6` | 2 of 165 |
| Week kinds | `7395f565` | 2 of 165 |
| Week status | `ff12921f` | 2 of 165 |
| What you changed | `e9bec76e` | **2 of 166** |

**Every slice: full unpiped `test:bible`, `GATE_EXIT=1` at
`test:program-control-durable`, 1 FAIL line — main's declared red — and a sweep
equal to the declared set exactly. `test:compile` PASSED throughout.**

Nine new suites, all registered in `test:bible`: `journal-load`, `journal-feel`,
`journal-strength-trend`, `journal-week-job`, `journal-niggle-history`,
`journal-month`, `journal-changes`, plus the extended `journal-week` and
`journal-note-ownership`.

## NORTH STAR: TOWARD, AND BY A LARGE MARGIN

**The entire unit added TWO pieces of stored state**, both INPUTS on a door that
already existed: `gameFeel` and `expectation`/`expectationReason` on
`SessionFeedback`. Everything else — the load model, the strength trend, the
month, the niggle history, the week's job, the week's status, what changed — is
**derived on read from facts the app already persists**.

Nothing stores a derived output. No exception was requested, and none was needed.

## THE IDEA THAT PAID FOR ITSELF

**Provenance travels with the number.** One constants table, each entry marked
`signed` or `proposed`; every derived value carrying the combined provenance of
what fed it; `signedValue()` the only door a surface may read through.

Built in the first slice to satisfy one order ("no athlete-facing number from an
unsigned constant"), it then decided — with no further thought required — that
the strength line could ship, that the balance picture could ship, and that the
load headline could not. **Four slices later a surface asked for a value and got
the right answer about whether it was safe to show, because the value arrived
already knowing.**

## WHAT THE UNIT ACTUALLY TAUGHT

Five findings, each with a receipt, each worth more than the feature it came from:

1. **An assumption is invisible to the suite its author wrote.** Three real
   defects in the load model were caught by reading the finished module back
   AFTER it went green. Twenty-four mutations could not have surfaced any of
   them, because every fixture was built in the geometry where the assumption
   holds.
2. **A mutation that never applied reports as a survivor.** A silently-unmatched
   regex pointed me at my test instead of my tooling. The harness now asserts the
   replacement is present before reading any result — and that assertion has been
   load-bearing three times since.
3. **A filter is only tested by a fixture that would fail without it.** Three
   surviving mutations across the unit were all this shape: a condition no
   fixture had ever created the state to distinguish.
4. **A green gate can be watching nothing** (third sighting). Both copy gates
   scope to `screens`/`components`/`navigation`, so a whole slice's words were
   invisible. Closed for one module; **~150 label strings across 20+ modules
   remain invisible and are SIZED and filed as their own unit.**
5. **"Blocked" needs the same receipt as "built".** I recorded week status as
   blocked from a gate's refusal rather than a measurement. The gate refused a
   stale READ; the derivation was reachable the whole time.

## THE ONE PROCESS SLIP, OWNED

`git stash` was used once — forbidden in this shared worktree by AGENTS.md.
Caught immediately, popped, every file verified restored and compiling; the
scratchpad-copy method used for the rest of the session. Recorded rather than
quietly repaired.

## NOT COVERED — the first line, and it is the important one

**NO DEVICE EVIDENCE FOR ANY OF IT.** No cell in this repo mounts the Journal
screen or the feedback panel; there is no render-level test. Everything above is
argued from derivations and source shape.

**That matters most for the monthly charts**, which are the first thing in this
unit whose defects are visual rather than testable — line weight, how 6–12 points
read at 64px, whether two stacked charts feel like the wall Sam ruled against.
**Sam's eye is the instrument for that**, and the order already reserved one
appearance pass at the end. This is it.

Also not covered:
- **DEPTH (L13): 0 everywhere.** Hand-built records, not a walked athlete life.
- **All journal copy is PROPOSED** — batches 15 through 25, none signed.
- The load continuum chart, and every banded line, are **built and DARK**.
- Illness is absent from the month-in-flags line (named, batch 22-h).
- "What was protected" — the fact does not exist (named, batch 25-d).

## SAM'S QUEUE — one signing session, as the order asked

**COPY: batches 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25.**

**CONSTANTS: 7 unsigned of 9** in `JOURNAL_LOAD_CONSTANTS` — `streamWeighting`
(50/50), `sweetSpotBand` (0.8–1.3), `tonnageModulatedByEffort` (OFF),
`regionNormalWindowWeeks` (4), `regionSecondaryShare` (0.5),
`patternDriftThreshold` (0.25), `minimumWeekCoverage` (0.5). **The last is mine
and not in your ruling** — the honesty floor that decides when a week is too
thinly logged to compare. Flagged rather than slipped in.

**RULINGS, none blocking:**
1. Should the 2/1/0 rung ever enter ratio space? It cannot today without storing
   a session's SHAPE as a fact.
2. The five body-feel words — Empty / Heavy / Okay / Good / Flying — are entirely
   mine.
3. Should the expectation tap be REQUIRED rather than optional?
4. Should a power block be separately completable? (unblocks a red ungated suite)
5. Should "anchor lift" be a narrower authored set than the main lifts the app
   records?
6. Is `flat` right as exact equality on the strength line?
7. Should a note carry a REGION (resurfacing route b)? It reopens a vocabulary
   you closed.
8. "since {date}" is a week start, not a month name.
9. Two charts and one lift — right amount, or still a wall?
10. **The notification**: a native dependency (`expo-notifications` is absent), a
    permission prompt the athlete can refuse, and a scheduling policy.

## WHAT REMAINS FOR ANOTHER UNIT

- The copy-gate scope widening (~150 strings, sized).
- `test:session-feedback-form` — ungated, 4 pre-existing failures about a power
  component `getSessionComponents` no longer emits.
- "What was protected" — an engine-side change to the decision doors.
- The ledger's missing vocabulary for illness/injury/readiness/phase (LR-29).
- LR-18 (`workoutLogStore` deletion), and the four rival "is this a game"
  predicates.
