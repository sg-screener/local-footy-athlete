# DAY-FIRST SLICE 2 — BOUNDARY REPORT (2026-08-08)

Two orders, one build: the layout + chip row, and the bucket vocabulary that
arrived mid-build. Two commits.

- `e8d227ac` — slice 2: the layout Sam ruled, and five bars became one chip row
- `c140a2d0` — buckets name the day, the timeline names the parts

---

## WHAT IS ON THE SCREEN

**The Program tab, top to bottom, in the order Sam wrote it out:** the week nav,
the Today/Week control, **the seven-day strip directly under it**, today's card
with its component timeline, **the life-fact chip row**, then Coach Notes. The
missed-session prompt and the season-phase skew disclosure moved below the card
with it. The picker banners stayed above the days they instruct about — a picker
forces the week shape, so nothing was gained by moving them and a "tap the day to
move the game to" banner under the days would be wrong.

**The chip row.** Five stacked full-width bars — *Short on time today*, *Away
this week?*, the readiness door, *I'm injured*, *Missing equipment?* — are now
one row of round icon chips with a tiny label under each, always visible, under
the day's card. Same icons Sam picked on 2026-08-03. **Every door went with them
unchanged**: same handler, same testID, same accessibility label, including the
two whose testID changes when a fact is already active. The sentence each bar
showed is now the chip's spoken name — no words were deleted, they moved to the
position a five-across row can carry them in.

**The day says its name once.** The card title used to read "Upper Push" with
"+ Conditioning" under it, and the timeline inside the same card then listed both
again. Now the title is the day's **bucket** — Strength, Conditioning, Rest,
Mobility, Accessories, Gunshow, Speed — and the timeline is the one enumeration.

**"Power" is gone from the week view.** The exhibit was a Tuesday whose power
component held one exercise and whose card therefore read "Power". It reads
"Strength". The word still names that component on the timeline.

**The spacing pass:** the top bar's 32pt gap → 16 (a control and the thing it
controls are not two screens), the phase section's 48 → 24, Coach Notes' 24 → 16,
the remaining cards' 16 → 8. No design system was invented; five stacked bars
becoming one row is most of the answer to "too many UI gaps" on its own.

---

## MEASURED, BOTH WORLDS

A tape over **three real generated weeks (21 days)**, run before a word was
changed and again after, and diffed:

| | before | after |
| --- | --- | --- |
| training day, week row + day title | "Upper Push", "Lower Squat", "Lower Hinge" | **"Strength"** |
| the exhibit (2026-08-04) | **"Power"** | **"Strength"** |
| Gunshow day | "Gunshow" | **"Gunshow"** — unchanged |
| Rest / Practice Match / Game / Team Training | unchanged | unchanged |
| **the timeline** | | **BYTE-IDENTICAL** |

The timeline line is the important one: **the variant names were not lost, they
were relocated.** And the Gunshow line was not a special case — that day carries
a charter `composedOptionalKind`, so it takes the Add-menu door's word through
the same branch `partHeadline` already used. Measured, not assumed.

---

## OWNERSHIP

**The projection owns the word, as the order required.** `VisiblePart` now
carries a `bucket` beside its `headline` — two questions about one part, both
answered where the words live. A card that mapped a headline back to a category
would be a second naming authority and they would disagree the first time a
variant was added.

`PART_BUCKET_KIND` is a **table the type system forces to be complete**, not an
`if`. Power maps to strength; speed is its own bucket, which is Sam's ruling too
and is why it is written down rather than assumed. The next question of this
shape is answered by editing a row.

`bucket` sits on the WORDS half of the projection, like `headline` — so a missing
copy entry still cannot disarm the structural laws, which is the hazard
`ProjectedDayParts` was shaped around in the first place.

**One chip shape, five call sites** (`LifeFactChip`) — the same argument that
gave the day-first view one `renderDayRow`. What differs between chips arrives as
props; a chip that minted its own testID from its label would have silently
renamed five doors Sam has tapped on a device.

---

## THE GATES

**Eight new cells. Twelve mutations, twelve reds** — each against the cell that
claims the property.

The order cell also refuses anything re-inserted **between the toggle and the
strip**, because "directly under it" is the half of the ruling an ordering
assertion cannot see: three cards used to queue up in that gap, and putting one
back would satisfy the sequence and still break what he asked for.

**Two pins inverted out loud**, both the legitimate case — the RULING moved, on a
date, from the owner:

- `weeklyReadinessCardTests` A4 rider (a) put Coach Notes ABOVE the week it
  explains. Sam's layout ruling puts it under the day. The cell still asserts a
  POSITION, not mere presence — an inverted pin that only checked existence would
  pass on any layout at all.
- `coachNoteDisplayTests` asked whether V2 still calls the helper that hides a
  duplicated context line. The duplication is now **impossible rather than
  suppressed**, so the cell asserts the structural form, which is stronger.

**A third pin MOVED with the element it was about:** the readiness entry's button
role is declared once inside the chip now, so the role is asserted at its owner
and the identity at the call site — which is where each of them actually lives.

---

## FOUR CORRECTIONS THE GATES MADE, THREE ON THEIR FIRST RUN

1. **`a count taken for a record`, again.** The leftover-bar cell counted a door
   FILE-wide, found two, and called the second a leftover. It is the readiness
   sheet's own "Something hurts" row — the documented second door to one owner,
   older than this unit. **The number named the FILE while the claim was about
   the SCREEN.** Scoped to the scroll body.
2. The same cell banned the old bar treatment outright; the practice-match CTA
   legitimately borrows it. **The survivor is pinned BY NAME**, so a second one
   still reds.
3. **The copy sheet's own table quoted the wrong column.** The binding gate reads
   quoted strings in table rows — it had bound the five OLD sentences and was
   watching none of the new labels, while reporting green. Both columns are
   quoted now: 29 → 41 strings bound, mutation-proven. The same defect had
   silently swallowed slice 1's "Today"/"Week", which were "parked" in a bullet
   list no gate reads.
4. **A MUTATION SURVIVED, and that is the one worth reading.** Deleting the
   charter-optional branch from `partBucket` left every cell green — a Gunshow
   day quietly reading "Strength" is a *legal bucket word*, so the vocabulary
   cell could not see it. A cell of its own now holds it.

---

## NORTH STAR

**TOWARD, and this time not only neutrally.** Zero new stored state. One derived
field was added to the read model (`bucket`), which is derivation, not storage —
and it **removed** a composition: nothing on the Program screen joins names into
new names any more. The screen went from two answers about what a day is called
(a title and a list that restated it) to one. That is a convergence step, not
just a new window.

---

## NOT COVERED

- **NO DEVICE EVIDENCE.** Chip sizing, label lengths, every tightened gap, and
  the way a one-word row reads at a glance are all unverified by eye. This repo
  has no render-level test, so the new gates read source SHAPE and projection
  OUTPUT, never pixels.
- **A zoomed-out week row now shows one word and nothing else.** A real loss of
  information at that size. Parked question 2 — Sam's eye is the judge.
- **The day SCREEN still double-labels**: a bucket title, a subtitle that lists
  attached parts, and sections that list them again. Outside the order, parked.
- **The row icon still comes from a title-STRING table.** "Strength" resolves in
  it and "Power" did not, so nothing regressed and one case improved — but that
  is argued from the table, not rendered.
- **`coachNoteDisplayTests` does not run.** It crashes at HEAD on a missing
  `TodayWorkoutCard.tsx` — pre-existing, not in the bible chain. Its pin was
  updated anyway rather than left as a trap.
- **Seven questions are parked, not answered**
  (`docs/PARKED_QUESTIONS/DAY_FIRST_SLICE2_2026-08-08.md`).
- The five chip labels are **PROPOSED and unsigned**.

---

## GATE LINE

Full `test:bible` **UNPIPED**, both commits: `TRUE_EXIT=1` at
`test:program-control-durable` — the declared red, same assertion text, **1 FAIL
line in the whole run**. Sweep **2 of 157** = `program-control-durable` +
`fixture-identity`, **the declared set exactly**, no new reds and none fixed.
`test:compile` EXIT 0, no file regressed. Branch verified `main` before every
commit.
