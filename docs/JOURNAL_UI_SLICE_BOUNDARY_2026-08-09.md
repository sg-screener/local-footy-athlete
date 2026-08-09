# JOURNAL UI POLISH SLICE — BOUNDARY REPORT (2026-08-09)

**Order:** SEAT_INBOX item 1, against Sam's
docs/JOURNAL_UI_DIRECTION_RULING_2026-08-09.md and the v2 mock.
**Plan measured first:** docs/JOURNAL_UI_SLICE_PLAN_2026-08-09.md
**Commits:** `fca3ef77` (ruling + mock as authored) · `73232293` (the slice) ·
`b6509f02` (one renderer per dark fact)

---

## ONE LINE

The Journal's front page is exception-based — hero, stat strip, week bars,
earned cards, lifts, month drawer, note — **and building it revealed that most
of it is behind Sam's signature, including two thresholds that turn out never to
have been read by any code at all.**

---

## THE GATE

- Full `test:bible` **UNPIPED, `GATE_EXIT=1` at `test:program-control-durable`,
  1 FAIL line** — main's declared red, same assertion text
  (*"a move committed durably reaches the visible week"*).
- **Sweep 2 of 167 = the declared set EXACTLY** (`program-control-durable`,
  `fixture-identity`), at head `73232293` and again after `b6509f02`.
- `test:compile` **PASSED**, no file regressed against the baseline.
- New gated suite `test:journal-ui` — **58 passed, 0 failed**, registered in
  `test:bible`.
- **22 mutations, 21 red.** The one survivor was MY BAD MUTATION, not a weak
  cell — I "withdrew" a string that had never been in the app, which the cell
  correctly passes. Re-aimed at a string still on a surface, it reds.
- One mutation was a **deliberate self-check that failed to apply**, and the
  harness refused to read its result. That is the strength-line slice's lesson
  built into the tooling rather than remembered: *a mutation that never applied
  and a mutation that survived are indistinguishable in the output, and the
  first one points you at your test instead of your tooling.*

---

## WHAT IS ON THE SCREEN

In Sam's order, and nothing else:

1. **HERO** — the week status as the headline in the app's display face, the
   week's job under it, the what-changed credit line on weeks a change happened,
   and the load band.
2. **STAT STRIP** — sessions done / load vs normal / game feel.
3. **WEEK BARS** — tall, mid, short, flat dot, outlined game. **The letters are
   dead.**
4. **EARNED CARDS**, above the lifts — region hot, balance drifting, niggles.
5. **LIFTS** — name, kg × reps, arrow.
6. **YOUR MONTH** — the one permanent drawer.
7. **THE NOTE BOX**, quiet, at the bottom.

---

## THE FINDING: HALF THE FRONT PAGE WAITS ON ONE SIGNATURE

| Element | Renders today |
|---|---|
| Hero headline, job, credit line | **YES** |
| The load band + marker | **NO — proposed** |
| Sessions tile · Game feel tile | **YES** |
| Load tile (arrow + %) | **NO — proposed** |
| Week bars · Lifts · Month drawer · Note | **YES** |
| "Ran hot" card · "Balance drifting" card | **NO — proposed** |
| Niggle cards | **YES** |

This is the provenance mechanism doing exactly what the load slice built it to
do, and the ruling itself says these thresholds ship PROPOSED. **It is not a gap
and it is not a reason to wait.** But the honest sentence is: *the exception-based
front page is built in full, and one signing session turns half of it on with no
code change.*

**AND TWO OF THOSE THRESHOLDS HAD NEVER BEEN READ.** `patternDriftThreshold` has
sat in the signing table since the load slice; `patternBalance` carried its
PROVENANCE but no code ever compared anything to `0.25`. **Signing it would have
changed nothing on any screen.** A constant listed for signature that nobody
reads is worse than an omission, because the table asserts it matters. It has a
reader now, and cells that prove it is a threshold in both directions.

---

## THE THREE FINDINGS WORTH MORE THAN THE FEATURE

**1. BUILDING BEHIND A SIGNATURE HIDES YOUR OWN DUPLICATES.** (`b6509f02`.)
I shipped the region observation with TWO renderers — a faint line in the load
band and the earned card — and caught it only by reading the finished screen
back. Both are downstream of proposed constants, so **both were dark**: the
screen looked correct, every cell passed, and **the duplication would have
appeared for the first time on the day Sam signed, in a commit that touched no
code.** Every other duplication this repo has caught was visible to somebody.
This class is not, because the mechanism that keeps unsigned numbers off the
screen keeps their defects off it too. *What catches the next one: the count is
asserted, not the absence — exactly ONE renderer per dark fact.*

**2. `a count taken for a record`, AGAIN, INSIDE A GATE I HAD JUST WRITTEN, ON
ITS FIRST RUN.** My style-law cell swept the file for `'[HMEG]'` to prove the
shape letters were dead, and went red on **`'M'` — Monday's initial in
`WEEKDAY_INITIALS`**, which labels the bars and has nothing to do with shape
abbreviations. The instrument's unit was "a quoted capital letter anywhere in
the file"; the domain noun is "a shape abbreviation". Scoped to the presentation
table it means what it says, and a second cell now protects the weekday initials
so the over-broad sweep can never be "fixed" by deleting them. **This is the
seventh sighting of that shape and the third inside a brand-new gate on its
first mutation test.**

**3. A GATE THAT READS SOURCE CANNOT TELL A COMMENT FROM A SHIPPED STRING — and
it fired three times in one slice.** Three separate cells went red on comments
that DOCUMENT a retirement by quoting the retired sentence. Each was stripped to
code before asserting, with the reason recorded at the cell. **Noted and not
fixed: the binder's existing RETIRED cell reads its sources raw and carries the
identical latent gap** — a wording Sam replaced could survive in a comment. It
has not fired; changing it is not this slice's business; it is filed rather than
ridden silently.

---

## THE STYLE LAW IS A GATE NOW, NOT PROSE

Sam's rider — *"it needs to match the style of the rest of the app too"* — was
unenforceable text. **It degrades one hex at a time, never by a redesign**: one
colour that no token quite matched, which the next screen copies because it is
now precedent.

So the Journal screen may declare **no raw colour literal, no `rgb()`/`rgba()`,
and no bare `padding`/`margin`/`gap` number**, and must read the tokens (≥20
reads) and mount the shared `Card`. It caught two on its first run — a `-9`
marker offset and a `gap: 2` — and the first one was worth catching for a second
reason: the `-9` was half of an `18` written three lines away, two numbers that
had to agree with nobody watching. They are one named constant now.

**Scope stated: this sweep is ONE FILE.** It says nothing about the rest of the
app, where raw literals may well exist. Widening it is a unit of its own, not a
line to slip into this commit.

---

## TWO NEW DERIVATIONS, ZERO NEW STORED STATE

- **The game-feel tile needed a RATING where the model had only a COUNT.** The
  value was already stored per session by the feel slice and simply never
  aggregated — so this is a read. **It is the LATEST game, never a mean**: two
  games rated 2 and 5 average to 3.5, a number no game earned, shown as though
  one had. A cell holds it.
- **`regionHotRatio`, PROPOSED, one genuinely new constant.** Before it, ANY
  exceedance of a region's previous best was an observation — an attention card
  for an athlete who trained a kilogram harder, every week, which is the exact
  opposite of the ruling's point. **It is applied to the EXISTING derived value
  rather than minted beside it**, so there is one representation of "ran hot".

**North star: TOWARD, or at worst neutral.** An appearance pass that added no
stored field, no writer and no door. A cell sweeps for six writer idioms and
requires zero; the one write door is still the note.

---

## THREE EMPTY STATES RETIRED, THEIR CELLS RE-POINTED NOT DELETED

Two of the three by Sam's own words. Each cell now asserts the **stronger** law —
the block renders nothing — instead of asserting a string exists. And the niggle
predicate **moved out of the JSX into `flaggedNiggleRegions`**, so *"a healed
single episode is not shown"* is a cell that RUNS rather than a regex that
matches a `.filter(` with any predicate at all.

**ONE OF THE THREE COSTS SOMETHING, AND IT GOES BACK TO SAM** (copy batch 26-e):
"No lifts recorded with a weight this week." is gone, so **an athlete who lifted
but logged no weights now sees no lifts card and no reason** — indistinguishable
from an athlete who did no lifting. Built as ruled, flagged not narrowed. If he
wants it back, the smallest honest form is one quiet line where the card would
be, and it is a one-line change.

---

## COPY

**Batch 26 PROPOSED**, and it is the first batch whose subtractions outweigh its
additions: **nine withdrawals**, six of them section headings that name boxes
which no longer exist.

**The binder grew a `WITHDRAWN:` form**, because the sheet could record a string
that CHANGED (`REPLACED:`) and had no way to record one that STOPPED. In a table
a withdrawal read as a fresh proposal — the batch retiring a string proposed it
again in the same breath, which is what happened on the first run. In prose it
was watched by nothing. The new form asserts the **stronger** thing: a withdrawn
string must be **ABSENT** from every surface. Mutation-proven both directions.

**Extraction ceiling 580 → 572, DROPPED in the commit that earned it**,
attributed **−6 headings / −3 empty states / −1 replaced / +2 new**.

---

## NOT COVERED

**FIRST LINE: NO DEVICE EVIDENCE, AND THIS IS THE SLICE WHERE THAT HURTS MOST.**
Every earlier journal slice could argue its correctness from a derivation. An
appearance slice's defects are **VISUAL**. No cell mounts this screen, this repo
has no render-level test, and every assertion in `journalUiLawsTests` is about
the SHAPE of the code. **It cannot prove the result looks right** — that a
three-tile strip is legible, that the bars scan as a week, that the hero fits on
a phone, or that Bebas uppercase suits a sentence like "STILL OUTSTANDING:
STRENGTH, CONDITIONING." **Sam's eye is the only instrument, and this slice has
not had it. DEPTH (L13): 0.**

- **Week navigation is NOT built.** The mock draws ‹ › arrows; `useResolvedWeek`
  resolves this week only, so browsing history is a feature rather than an
  appearance and a chevron that does nothing is worse than no chevron. The label
  ships without them.
- **The hero headline reuses batch 24's sentences at heading size.** The SIZE
  changed and the COPY did not — a headline written fresh would have been a
  second answer to a question batch 24 already ruled. But "The week is on track."
  was written as a calm line, not as big type, and whether it carries a hero is
  Sam's eye.
- **Nine strings this slice authored are invisible to the extractor** (template
  literals and keyed objects) and are listed in batch 26-c/26-d anyway.
- **The `Card` component gained a `testID` passthrough** — a shared component
  changed by a Journal slice. Justified (a card an on-device explorer cannot
  find is invisible to L11's matrix, and the alternative is wrapping every card
  in a bare `View`, which this repo has already paid for), but it is a change
  outside this screen and is named as one.
- **The binder's RETIRED cell has the comment gap named in finding 3.** Not
  fixed here.

---

## PARKED FOR SAM

1. **THE SIGNING SESSION IS NOW THE BOTTLENECK** — 8 proposed constants of 10,
   and they hold the load band, the load tile and both attention cards. One
   sitting turns them on.
2. **The lifts empty state** (batch 26-e) — put it back, or leave it out?
3. **`regionHotRatio` at 1.15 and `patternDriftThreshold` at 0.25** are the
   terminal's numbers. The second one has never been read by any code until
   today, so signing it has consequences it did not have last week.
4. **Batch 26's words**, including the nine withdrawals.
5. **The bar colours** stayed the app's intensity tokens (red/orange/green)
   rather than the mock's single-accent ramp, under the style law. That is a
   judgement his eye should confirm — the mock looked deliberately calmer.
