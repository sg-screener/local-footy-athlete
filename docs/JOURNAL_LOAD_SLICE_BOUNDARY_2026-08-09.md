# THE LOAD SLICE — boundary report (2026-08-09)

Seat order: docs/SEAT_INBOX.md item "BUILD THE LOAD SLICE". Ruling built:
docs/JOURNAL_LOAD_MODEL_RULING_2026-08-08.md. Dependency list measured first:
docs/JOURNAL_LOAD_SLICE_PLAN_2026-08-09.md.

Commits: `d0651fc3` (the slice), `285c5a20` (the cell a surviving mutation
demanded), `61b7d74f` (the four-week normal is four CALENDAR weeks), `d44476c9`
(the rung is not this model's to own), `12da456f` (the coverage line cannot read
"6 of 5").

## ONE LINE

**Sam's five-layer load model is built as a pure derivation over facts the app
already stores — and no athlete-facing number can be derived from an unsigned
constant, because provenance now travels with the number rather than with a
promise.**

## NORTH STAR: TOWARD, and by the widest margin of any slice in this unit

**ZERO new stored state.** Every number — tonnage, sRPE, the four-week normal,
the region series, the pattern ledger — derives on read from `SessionFeedback`,
an input the app already persists and never prunes. There was no temptation to
store a rolling average and no exception to request. The measurement that made
that possible is §1 of the plan doc: the whole input set already existed.

## WHAT THE ATHLETE SEES

The Load section stops promising a feature and starts stating its own evidence:

> Load is measured from the sessions you log — 3 of 5 this week have detail
> recorded.

That line ships because it is derived from **no constant at all** — a count of
what was logged needs no signature to be true. Beside it, when it applies: "Some
lifts had no weight recorded, so they sit outside that."

**IT HAS A SECOND FORM, AND THE REASON IS THE THIRD LATE CATCH.** `sessionsPlanned`
counts the days the projection asks work of; `sessionsMeasured` counts the dates
the athlete actually logged detail on. Those answer different questions, so
measured *can* exceed planned — log a session, then have the week change under
it — and **"6 of 5" on the one line that actually ships would cost trust in every
other number on the screen.** The denominator is DROPPED in that case, never
clamped: clamping states a falsehood quietly instead of loudly. The mutation that
clamps instead reds the cell.

Everything else is **built, tested and dark**: the headline continuum, the
sweet-spot band and the region observation lines are all downstream of PROPOSED
constants. Their words are written, wired and listed (batch 17-b) so Sam can
review them BEFORE they can appear.

## THE ARCHITECTURAL IDEA, AND WHY IT IS A MECHANISM

The order requires that no athlete-facing number be derived from an unsigned
constant. Written as a rule for the surface to obey, that is a promise somebody
must keep every time they add a line. Built this way it is structural:

- every constant is one entry in `JOURNAL_LOAD_CONSTANTS` carrying its
  provenance and its source;
- every derived value carries the COMBINED provenance of the constants that fed
  it — `signed` only if all of them were;
- `signedValue()` is the only door a surface may read through, and it returns
  null for anything proposed.

Two properties fall out, and both are gated:

1. **SAM'S SIGNATURE ALONE TURNS THE LINES ON.** Flipping a constant to `signed`
   makes its line appear with no code change. Mutation-proven in that direction:
   marking the sweet-spot band signed reds cell [2].
2. **A NEW CONSTANT CANNOT LEAK.** One without provenance fails the compiler; one
   marked proposed makes everything downstream proposed automatically.

`combineProvenance()` with zero contributors is `signed`, and that is
load-bearing rather than a convenience: it is what lets a pure count ship while a
banded ratio waits.

## FOUR THINGS THAT SHAPED THE BUILD — two measured up front, two caught in read-back

### 1. A strength session stores no effort rating at all

`SessionFeedback.difficulty` is written from exactly one source —
`difficulty: conditioningRpeValue` (`SessionFeedbackPanel.tsx:533`). So the
effort tap genuinely does need extending, as Sam ruled.

**It does not ride this slice, on the order's own fallback.**
`tonnageModulatedByEffort` is PROPOSED and defaults **OFF**, and tonnage is a
native measurement needing no rating — with the constant off the tap would change
no number the athlete can see. It lands with the "felt different" slice. Named as
owed, not dropped.

### 2. THE FALLBACK RUNG IS NOT THIS MODEL'S AT ALL — and I built it twice before seeing that

The 2/1/0 rung is keyed on a day's SHAPE; a shape needs the projection plus the
hardness owner; **past weeks are not projectable** (slice 1 already recorded
this). The available shortcut is to re-derive hardness from the stored component
kinds. **Refused** — a second hardness authority inside the Journal is the exact
class `journalWeek.ts` opens by refusing.

That much was measured up front and is right. **What I then built was still
wrong.** The load model took a per-session rung weight at its door and summed
one — which made it a SECOND OWNER of a number `journalWeek` already derives
(`JournalWeek.load.thisWeek`), over a different input set: recorded sessions
instead of the week's days. The two disagreed for any week the athlete had not
finished logging, and a week with nothing recorded summed to a rung of **zero**
— the "small week" lie in its most direct form, produced by a vacuous `every` on
an empty list.

**The rung is now absent from the input, the session shape and the model.** The
claim "the rung never enters ratio space" stops being something a cell checks and
becomes something this module *cannot express* — it has no access to the rung at
all. That is the north star's own move: remove the representation rather than
guard it, and it is strictly stronger than the test it replaces.

The signed VALUE stays listed in the constants table, because a signing table
that omits the signed constants is a worse record than none — and it now POINTS
AT `journalWeek`'s object rather than restating the numbers. **Identity, not
equality:** two literals that happen to match is the shape nothing notices until
they stop matching. Both halves mutation-proven.

**THE PATTERN IN ALL THREE LATE CATCHES** — this one, the calendar window below,
and the "6 of 5" line — **is that each was a wrong ASSUMPTION rather than a wrong
line, and an assumption is invisible to a suite written by the same person who
made it.** Here I had measured the ownership question correctly in the plan doc
and then wrote a module that violated it anyway, because "the rung is not
derivable for history" and "the rung is not mine to hold" are different
sentences and I had only checked the first. **A dependency list answers what the
inputs are; it does not answer who owns the output.**

What actually found all three was reading the finished module back with the
question "what does this quietly assume?", after the gate had already gone green
on it. That read is now the thing worth repeating, and it is cheap: three
defects, none of which any of the twenty-four mutations could have surfaced,
because a mutation tests the code that exists against the cells that exist.

**THE OPEN QUESTION FOR SAM SURVIVES ALL OF THIS** — see below.

### 3. THE FOUR-WEEK NORMAL WAS FOUR WEEKS I LOGGED IN, AND THAT IS NOT THE SAME SET

Caught in a read-back of my own module after the first full gate had already
passed on it. `compareStream` took the four most recently **RECORDED** weeks. The
moment an athlete stops logging, that is a different set: weeks -1, -2, -3 and
-20 is not a four-week normal, it is four scattered weeks wearing that name, and
every ratio computed against it would have been **confidently false**. The same
bug sat in the region layer — where the athlete-facing line says a number of
weeks *out loud*.

The window is now calendar weeks before this one. A week with no record resolves
to ABSENT, is excluded from the normal, and leaves the window short — which is
the refusal that already existed. **A gap is a gap, not something to reach back
and fill.**

**WHY NOTHING CAUGHT IT, WHICH IS THE PART WORTH CARRYING:** every fixture in the
suite logged contiguously, and contiguous logging is exactly the condition under
which the two readings agree. Nineteen mutations and eighty-four cells could not
see it because none of them ever created the state that distinguishes them. The
new cell is the discriminating one — three recent weeks plus one from four months
ago — and it is the only cell that reds when the window reverts.

The shape, stated generally: **a fixture set built to exercise a mechanism tends
to be built in the mechanism's happy geometry, and the assumption that geometry
encodes is invisible from inside the suite.** Ask what state the fixtures never
construct, not only what assertions they never make.

### 4. Coverage, not silence, is what makes a ratio honest

A well-logged week held against thinly-logged history reads as a spike that never
happened: the number would be right and the story false. So history weeks with no
measurement are EXCLUDED from the normal rather than averaged in as zeroes, and a
week too thinly logged gets NO comparison. Both gated; both mutation-proven.

## NO NEW MAPPING WAS AUTHORED

Checked before building rather than assumed. Patterns come from
`mainPatternForExerciseMovement` (`strengthPatternContributions.ts:364`), muscles
from the two signed sheets, upper/lower from `getExerciseTags`. Cell [4] sweeps
this module's source and requires it declares no rival table — the cell that
would catch the next `one-predicate-grows-copies-in-other-modules`.

The one vocabulary translation this module DOES own — the logger says
`assault_bike` and `rower` where the sheet says `air_bike` and `row` — is done
once, at the boundary, and the gate asserts it exists exactly once.

## A DEFECT FOUND IN AN EXISTING GATE, NOT PAPERED OVER

The extraction gate's line-spanning canary was pinned to one literal sentence —
"Your Journal is building…" — which this slice rewrote. It went RED, which is the
gate working.

**But re-pointing it exposed that it was weaker than it read.** The cell existed
to prove the extractor spans lines; it asserted only that a sentence was found,
and a sentence found by the single-line ternary pattern would have satisfied it
just as well. It is now **stronger than before**: it requires the match to come
from the `jsx_text` pattern, which is the one that actually spans lines.

The general shape, worth carrying: **a non-vacuity canary pinned to one literal
is paid for by whichever unit next edits that line — and the payment is the
moment to ask whether the canary ever proved what it claimed.**

## COUNTS, IN THE UNIT THE INSTRUMENT COUNTS IN

- `strengthMainLiftTonnageKg` is named for its unit on purpose:
  `SessionFeedback.strength` holds MAIN LIFTS ONLY
  (`strengthLogging.isMainStrengthExercise`). Calling it "tonnage" would be
  `a-count-taken-for-a-record` in a brand-new instrument.
- The signing batch is **7 PROPOSED of 9 constants**, printed by the suite rather
  than hand-counted, so the batch and the report cannot drift.
- Region loads are **never summed across regions** — the primary/secondary
  distribution deliberately does not conserve a total, because a region series is
  only ever compared with its own history. Gated.

## THE GATE

- **Full `test:bible`, UNPIPED: `GATE_EXIT=1` at `test:program-control-durable`,
  1 FAIL line** — main's declared red, same assertion text.
- **Sweep: `failures=2 of 160` = the declared set EXACTLY** —
  `test:program-control-durable`, `test:fixture-identity`, at head `12da456f`,
  world identity printed by the runner's mandatory preamble.
- `test:compile` PASSED — no file regressed against the baseline.
- New suite `test:journal-load` registered in `test:bible`: **91 passed, 0
  failed.**
- Copy extraction ceiling **565 → 566, attributed four-in / two-out** by name.

## TWENTY-FOUR MUTATIONS, TWENTY-FOUR REDS — TWO SURVIVED THEIR FIRST RUN

**Survivor 1 — the window did not exist.** Deleting the four-week slice from
`compareStream` left every comparison cell green, because no fixture ever
supplied more history than the window holds. A suite that only ever feeds the
window exactly what it can take cannot tell whether the window is there. Fixed by
a cell that supplies a fifth week deliberately unlike the other four
(`285c5a20`); re-run against the same mutation: RED. That cell is also what made
the calendar-vs-recorded defect above findable.

**Survivor 2 — right red, wrong gate.** "An athlete-visible sentence ships
unlisted" survived `signed-copy-extraction` and reds on `copy-rulings-binding`.
The ceiling is a COUNT, and swapping one sentence for another keeps it at 566;
the binder catches it because the replaced string was PROPOSED. A genuinely ADDED
sentence does raise the count and the ceiling does catch that. **Both halves are
covered and neither covers the other** — writing "the extraction gate catches
unlisted strings" would have been the false version of this line. No new cell
was needed; the attribution was what was wrong.

The other twenty-two, each against the cell claiming the property: provenance
combination inverted; `signedValue` ignoring provenance; a partial lift scaled by
a guess; a skipped lift becoming a hole; sRPE dropping its minutes; blank history
weeks averaged in as zeroes; the coverage refusal removed; the rung summing
partially; secondary muscles carrying full load; a region observed without
beating its window; every exercise resolving to one pattern; the sweet-spot band
marked SIGNED without Sam; an empty strength array reading as unknown; the week
boundary off by one; the screen reading `.value` around the door; the building
line ceasing to be bare JSX text; a PROPOSED string drifting out of the app; and
the calendar window reverting to a recorded-week window — which reds exactly one
cell, the discriminating one, and nothing else; the rung constant restated as a
literal copy instead of pointing at its owner; and a rung field reintroduced on
the session shape; and the coverage count clamped with `Math.min` instead of
reframed.

## WHAT WOULD CATCH THE NEXT DEFECT OF THIS CLASS (L12)

The class this slice can fail in is **a number reaching the athlete that nobody
signed**. Fix-by-fix verification would be a cell per line. What is built instead
is a cell per MECHANISM:

- provenance propagation is asserted at the combinator, at the door, and on the
  real model's outputs by name — so the next unsigned number is hidden by the
  same machinery without anyone remembering to hide it;
- the both-directions cell names which outputs are signed TODAY, so marking a
  constant signed without Sam reds rather than lighting a line on his phone;
- the honesty cells assert the NULL cases as first-class answers, which is what
  catches the next "invents precision" rather than the next wrong number.

## NOT COVERED

- **NO DEVICE EVIDENCE.** No cell mounts the Journal screen; this repo has no
  render-level test. Spacing, wrapping and how the evidence line scans on a phone
  are unverified by eye.
- **DEPTH (L13): 0.** Hand-built session records, not a walked athlete life. A
  five-week history is constructed, never lived — so nothing here proves the
  model behaves on real accumulated `sessionFeedback`.
- **The effort tap on strength is NOT built** (reason above).
- **Charts are layer 5 and deferred** to the monthly-review slice by the ruling's
  own placement rule.
- **The extractor cannot see keyed copy objects or template literals.** The
  headline band's three sentences live in `HEADLINE_COPY` and the two counted
  lines are template literals; none is visible to the extraction gate. They are
  listed in batch 17 anyway — being invisible to the instrument is not a reason
  to be invisible to Sam. **Widening the extractor to keyed copy objects is named
  here as owed.**
- **Resurfacing old notes** is still owed from slice 2.
- All journal copy remains PROPOSED. Batches 15, 16 and 17 await Sam.

## SAM'S QUESTIONS

1. **THE ONE THAT BLOCKS NOTHING BUT MATTERS: should the 2/1/0 rung ever enter
   ratio space?** It cannot today. A past week has no derivable day shape, and
   re-deriving hardness inside the Journal would be a second authority. So the
   rung stays exactly where it already was — `journalWeek` derives it for the
   current week from the week's days — and the comparison waits for measured
   streams. If you want the rung inside the comparison, the honest route is (a)
   record a session's SHAPE as a fact at save time: new stored state, but an
   input, so the north star allows it. Built as (b): leave it alone.

2. **THE SIGNING BATCH — 7 constants.** `streamWeighting` (50/50),
   `sweetSpotBand` (0.8–1.3), `tonnageModulatedByEffort` (OFF),
   `regionNormalWindowWeeks` (4), `regionSecondaryShare` (0.5),
   `patternDriftThreshold` (0.25), `minimumWeekCoverage` (0.5). The last is
   **mine and not in your ruling** — it is the honesty floor that decides when a
   week is too thinly logged to compare. Flagged rather than slipped in.

3. **The words of batch 17**, particularly the two that ship today.
