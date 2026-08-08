# BOUNDARY — THE COMPOUND BUCKET NAME (2026-08-08)

Sam's answers to the slice-2 boundary questions, built. One report, as ordered.

**LOOP CHECK: `a-doc-taken-for-the-record` — sighting 2, and this pass is the
compression landing rather than another sighting.** The seat's own item 2
recorded sighting 1 (a status table trusted without reading the code it
described, costing a retracted unit). Sighting 2 is the same shape one layer
down: this unit's plan named `parts[0].bucket` as "the day's name" in a table,
and the day screen's `attached` line — a second answer to the same question —
was three lines below it in the same file, unread. Both are now receipt-bearing.
Secondary, and it is the one worth carrying: **`a-count-taken-for-a-record` in
its ASSERTION form**, below.

---

## WHAT IS ON HIS PHONE

**A day is named by every bucket on it.** The week row and the day title say all
of the day's buckets, joined by Sam's own `" + "`, in timeline order, each word
once. `791979c0`.

His sentence, which is the whole ruling:

> "on weekly view it should say whatever the bucket is that day i.e. Strength or
> strength + conditioning. On the daily it can get more granular and be like
> Upper body push and MAS work or whatever it is i think"

- **ONE FUNCTION, BOTH SURFACES.** `visibleDayLeadHeadline` is what the week row
  and the day title already both called; it is the only thing that changed.
  **No surface composes anything** — the gate forbidding `HomeScreenV2` from
  building a name out of other names stands unchanged and still passes.
- **The variant name did not move.** The timeline still says "Upper Push",
  "Power", the conditioning variant — one per line, exactly as before.
- **Batch 12 is SIGNED** in the same commit: "Today", "Week", "Time", "Away",
  "Sick", "Injured", "Equipment", all seven as proposed ("yep").
- **Chips do not light** (his "a"). Left as built; recorded as closed, not
  forgotten.

---

## THE MEASUREMENT, BEFORE A WORD CHANGED

A tape over the same three real generated weeks slice 2 used, taken in both
worlds and **diffed**:

| | |
|---|---|
| rows changed | **6, and every one of them is a title** |
| TIMELINE | **BYTE-IDENTICAL** |
| parts (kind, bucket, headline) | **BYTE-IDENTICAL** |
| Rest / Practice Match / Gunshow / Accessories | **unchanged** |

**The exhibit Tuesday produced no diff line at all.** It carries a `power` part
AND a `strength` part; both bucket to "Strength", and it still reads
**"Strength"** — the deduplication proving itself on the exact day Sam's power
ruling was written about. Without it that day reads "Strength + Strength", which
is the word he took off the title coming back as a stutter.

---

## THE ONE THING FOR HIS EYE, STATED FIRST BECAUSE IT IS THE RISK

**Four of the six changed rows gained "+ Team Training", not the
"+ Conditioning" of his example.** His exhibit week now reads
**"Strength + Team Training"** on three of five training days. Only two rows took
the shape he actually wrote down.

That is what "ALL the day's buckets" means when measured rather than imagined,
and it is a longer row than anything he has seen at week zoom — the same size
concern parked question 2 of slice 2 raised in the opposite direction. **Built as
ordered and flagged, not quietly narrowed to his example.** If he wants team
training excluded from the compound, that is one row of `PART_BUCKET_KIND`-shaped
work and this section is its receipt.

---

## THE PART THAT GENERALISES: JOINING IS A SHEET OPERATION

A compound name is a **composition**, and composition is the exact defect
`SignedCopy` was built to make impossible. Both obvious ways out were wrong:

- **Widen `FILLED_PLACEHOLDER` to admit words.** That is the one sanctioned hole
  in the type, and the module's own comment names widening it as the loosening to
  avoid. A template taking arbitrary words is a template taking planner scratch.
- **`.join(' + ')` at the call site.** A surface choosing athlete-visible
  punctuation. **And one already was** — `DayWorkoutScreenV2` built its subtitle
  that way, in a screen file, undetected since Task 6.

So: `copy.joiner.plus` is a sheet entry marked `joiner: true` — the first
separator in the sheet. `joinSignedCopy` **refuses any entry that is not one**
(joining with an ordinary entry would paste one sentence between two others and
the result would still type as signed). `isSignedCopyText` splits on separators
and requires **every** piece to be signed.

The property that had to survive, and does: **a compound with one unsigned half
reads UNSIGNED**, and **two signed words joined by a separator nobody signed read
UNSIGNED**. Both are cells. Without them the join is just "contains a plus sign".

---

## `attached` IS RETIRED — THE RULING PAYING FOR ITSELF

Its own definition was *"the parts the lead headline did not already speak for"*.
A compound title speaks for all of them, so **the set is empty by the field's own
definition** — the assertion that it was empty had become a claim about nothing.

Keeping it would have shipped the duplication Sam ruled against that same
morning, one screen over and **worse than before**: a day screen titled
"Strength + Team Training" with "· Team Training" underneath it. That is **parked
question 4 of the slice-2 report**, and it closes here as a **consequence**, not
a scope grab — the compound title is what made the second line redundant. The day
screen's subtitle is date and count now; what the day IS, is the title's job
alone.

---

## THE ICON — A REGRESSION THIS UNIT CAUSED, FOUND BEFORE IT SHIPPED

The row's glyph **and its accent colour** resolve by matching the day's name
against `displayLabelIconKind`, a list of label **EQUALITIES** ('strength',
'upper push', 'gunshow'). `displayLabelKey("Strength + Team Training")` is
`"strength + team training"`, which matches nothing in it — so **every joined day
would have fallen through to the generic grey activity glyph**, which is four of
the six rows this ruling changes.

**`a-ruling-premise-is-a-claim-too`, and the premise was MINE.** The slice-2
report had already read this table and concluded nothing regressed *because
"Strength" resolved in it where "Power" had not*. True at the time; false the
moment a title stopped being one word. **A premise measured against yesterday's
shape is not a measurement.** It was caught only because the NOT-COVERED line
naming it was cheap enough to go and check instead of file.

**THE SPLIT IS THE HONEST ONE:** the TITLE says every bucket, the GLYPH says the
first one. One word cannot depict two kinds of work. `visibleDayLeadBucket` is
**byte-for-byte the rule the title carried before this ruling**, so the icon and
colour receive exactly the input they always have, and a cell asserts that
equality rather than trusting it — no glyph moved on any day.

**NOT DONE, AND NAMED:** keying the glyph off the typed `VisiblePartKind` instead
of off a display string is the real fix for that table. It would move glyphs on
days this ruling never touched — a device-pass change, and it has no business
riding this commit.

---

## THE GATES

**NINE MUTATIONS, NINE REDS**, each against the cell that claims the property:
drop the dedupe (3 red, including the dedicated cell); revert to the leading part
only; reverse the order; make the join accept a partly-unsigned compound; let
`joinSignedCopy` take a non-separator; put a `' + '` literal back in a screen;
let a variant name reach the `bucket` field; feed the compound title back to the icon table; let the icon key become the compound.

**FIVE NEW CELLS**, and the two vocabulary cells were **re-pointed rather than
loosened** — they now check EVERY WORD in the list, so "Strength + Upper Push"
and "Strength + Power" both red where a whole-string membership test would have
had no opinion at all.

**GATE LINE:** full `test:bible` **UNPIPED**, `TRUE_EXIT=1` at
`test:program-control-durable` — main's declared red, same assertion text,
**1 FAIL line in the whole run**. Sweep **2 of 157 = the declared set EXACTLY**.
`test:compile` PASSED, no file regressed.

---

## A RED THAT WAS NOT MINE, AND HOW IT WAS ATTRIBUTED

The first sweep came back **3 of 157** against a declared 2. The third was
`test:decision-ledger-ownership`, a suite nothing in this unit touches. **Any
difference from the declared set is a STOP, not a shrug**, so it was measured.

The cell picks `'2026-08-08'` as an answer value, then asserts that string never
appears in `JSON.stringify(writes)`. Every tape entry carries a **required `at`
UTC timestamp**. Today is 2026-08-08 — so the assertion matched on **the
instrument's own metadata** and reported an answer leak that never happened.

Proven, not argued: moving only that one cell's two dates off today takes the
suite to **8/8 green** with no product change.

**It reds on exactly two days in history — 2026-08-08 and 2026-08-11 — and is
green on the other 363.** That is the worst possible failure schedule: it
presents as a regression in whatever unit is in flight that morning. Slice 2's
sweep "cleared" this suite four hours earlier only because UTC had not yet ticked
past 10:00 AEST.

**This is `a-count-taken-for-a-record` in its ASSERTION form**, and it belongs
beside the source-scan variant already in AGENTS.md. The check's UNIT was *every
character the tape serialises*; its CLAIM was about *the fields that carry an
answer*. Different units, and the gap is exactly one required timestamp wide.
Fixed at that seam (`214ef66c`): `at` excluded **by name and by name only**, so
every other field — including ones nobody has invented yet — is still swept.
**Mutation-proven**: a date planted in any other field still reds it.

The three sibling tape suites (`athlete-prefs`, `coach-prefs`,
`coach-mutation-history`) carry the same "an answer VALUE reached the tape"
shape. **Audited, not assumed: all three green, and none uses a date literal as
an answer value**, so the collision class does not exist there.

---

## THE DOC-TRUTH FIX (inbox item 2)

Two sources were lying and both are corrected with receipts:

- **`DAY_FIRST_UI_UNIT_PLAN_2026-08-07.md` §3** said "later slice" against nine
  of thirteen rulings. **All 13 are BUILT, DELIVERED or MOOT**, re-measured in
  the source, **one line and one receipt each** — `file:line`, a commit, or the
  trace doc. Nothing is OPEN-UNKNOWN.
- **`NOW.md`'s "Rulings 1–12 remain owed"** is struck and replaced, with the
  reason it survived recorded rather than tidied away.

**Standing law, carried into both files:** a status claim about built work
carries a code receipt AT THE CLAIM, or it says OPEN-UNKNOWN. *"Later slice"* is
a plan, not a status, and a plan goes stale in silence.

---

## NORTH STAR

**TOWARD, and a convergence step.** Zero new stored state. Two representations
removed: the day screen's second answer to "what is this day" (`attached`), and
the last surface-side composition of athlete-visible text. The count of places
that can author a word went **down**, not up — the separator moved from a screen
into the sheet, where it has a provenance.

---

## NOT COVERED — first line of it: NO DEVICE EVIDENCE

- **No device evidence.** Nothing here has been seen. How a
  "Strength + Team Training" row wraps at week zoom, whether it truncates, and
  what it does to the day card's title line are **unverified by eye** — and given
  four of six changed rows took that shape, this is the first thing to look at.
  This repo has no render-level test; the gates read projection OUTPUT and source
  SHAPE.
- **~~The row ICON is argued, not rendered.~~ MEASURED, AND IT WAS A REAL
  REGRESSION — FIXED (`b799949d`).** See the section above; it was going to drop
  four of the six changed rows to the generic grey glyph. What remains
  uncovered is that the fix is proven on the PROJECTION and on the SOURCE
  WIRING, not on a rendered pixel — no cell in this repo mounts a row.
- **Three weeks of one athlete's generated program.** Week 3 is all rest, so the
  real evidence is two weeks. No world here produces a three-bucket day, so the
  join is exercised at arity 2 only.
- **`coachNoteDisplayTests` still does not run** — crashes at HEAD on a missing
  `TodayWorkoutCard.tsx`, pre-existing, not in this chain.
- **The separator is not bound by a copy-sheet table row**, deliberately: two
  characters of punctuation would match hundreds of unrelated concatenations and
  bind vacuously. It is bound by the compound cells, which rebuild each expected
  title from `signedCopy('copy.joiner.plus')`. The doc says so at the entry.
- **Parked question 4 closed as a side effect of this ruling, not by a ruling of
  its own.** Sam never ruled the day screen's subtitle; the compound title made
  the line redundant and it went. If he wanted that line, it comes back as its
  own decision.
- **The day-title half of the order is SEAT-RULED, not Sam-ruled** (his veto is
  one line, per the ruling doc §4). If he meant the day title to go granular,
  everything above about the title is superseded and the week row stands alone.
