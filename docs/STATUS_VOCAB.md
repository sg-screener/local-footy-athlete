# STATUS — seat `vocab`

Opened 2026-08-13. This seat took **item 61** (the two-vocabularies census) at
Sam's direct order after `arms` went quiet and the `terminal` seat was retired.
`ls docs/STATUS_*.md` before opening this file: `vocab` was not taken.

---

## 2026-08-13 — TAKEOVER, AND THE FIRST JOB IS VERIFYING SOMEONE ELSE'S NUMBER

**Item 61 head line restamped `OWNED BY vocab`.** The body's own owner line
(`OWNED BY audit`) and every word below the head is untouched — the item is not
re-scoped, only re-owned. Sam's order named the restamp and named saying so in
the first commit.

### WHERE `arms` LEFT IT

- **Item 2 of the three (equipment) is CLOSED** — `9c0d1776`. Not re-measured
  here, by order. It is the worked example: the checklist is DERIVED from
  library demand instead of authored beside it, so the two lists cannot drift.
- **The census and the count landed** — `27d4be3f`, `test:vocabulary-census`.
- **`arms` built no crosswalk** — its own "NOT DONE, DELIBERATELY" section says
  no crosswalk was made total. **Conditioning and away are both still open.**

### THE NUMBER, RE-RUN

`VOCABULARY CROSSWALK CENSUS: 93 unchecked of 123 crosswalks (ceiling 93) across
59 concepts, from 459 vocabularies` — **reproduces at the working tree,
12 passed / 0 failed.** By cause: 80 untyped-`string` input, 6 `| null`,
5 `Partial<Record<>>`, 1 `| undefined`, 1 declares itself total and is not.

**BUT A RE-RUN OF A PARSER IS NOT A VERIFICATION OF ITS NUMBER** — it is the
same instrument answering the same way, and this instrument has a written record
of four versions that missed all three known sightings. Verification is below.

---

## THE VERDICT ON 93: IT REPRODUCES, AND IT IS A **LOWER BOUND**

**The ratchet is sound and nothing below asks for it to be raised.** `[4]`/`[4b]`
pin a number that can only fall, and that is worth keeping. What follows is about
what the number MEANS, which is what Sam asked to be checked.

### FINDING 1 — THREE STRUCTURAL BLIND SPOTS, AND I VERIFIED EACH BY HAND

The census's function matcher demands, literally,
`(function NAME | const NAME =) ( FIRSTPARAM : TYPE … ) : RET {`. So by
construction it cannot see:

| shape | sites found | example |
| --- | --- | --- |
| arrow function (`): T =>`) | 1 | `preferred` (`utils/exerciseScorer.ts`) `MainStrengthPattern -> MovementPattern` |
| the vocabulary is not the FIRST parameter | 3 | `conditioningStress`, `detectModality`, `demandCategoryFor` |
| the first parameter is an object literal | 2 | `inferConditioningEditScope`, `computeDiffAxes` |

**At least six real crosswalk sites are invisible to the instrument.** This is a
floor, not a total: each probe was deliberately narrow so every hit could be read
by eye.

### ⚠ FINDING 2 — THE DEFINITION OF "TOTAL" ADMITS THE ITEM'S OWN DEFECT

The classifier calls a crosswalk NOT total only when
`cases.size > 0 && !hasDefault && cases.size < inputMembers.length`. **Any
`default:` therefore makes a switch TOTAL, whatever it actually covers.**

Item 61 defines the defect as *"the gap is SILENT — an unmapped value becomes an
empty result **or a plausible neighbour** instead of an error."* `default: return
'unknown'` is that sentence exactly. **So the shape the item names is the shape
the census scores as healthy.**

Re-running the census's own parser: of the 20 fn-sites it calls total, **4 are
switches with a `default` covering fewer members than their input vocabulary.**

**AND A COUNT IS NOT A VERDICT — I READ ALL FOUR, AND TWO ARE CORRECT BY
DESIGN:** `unitRegion`'s `default: 'none'` is the honest answer for a
non-strength category, and `workoutTypeForCategory`'s `default: 'Conditioning'`
is a genuinely coarser output vocabulary, not a gap. **The finding is the RULE,
not the 4.**

### ⚠ FINDING 3 — A SECOND LIVE COD WALL, INVISIBLE ON BOTH GROUNDS AT ONCE

`conditioningStress` (`rules/section18WorkoutEvidence.ts:93`) switches on
`workout.conditioningCategory` and covers **5 of 6 — `cod_decel` falls to
`default: return 'unknown'`.** It is the same defect as `categoryToFlavour`, in
the same vocabulary, and **the census cannot see it for two independent reasons**:
its first parameter is `Workout`, and it has a `default`. Unlike the two above,
`'unknown'` is not a coarser answer — it is an absence, and Section 18 makes
decisions on it.

### FINDING 4 — "80 SHARE ONE CAUSE" IS ALREADY NARROWED, UNCOMMITTED, IN THE TREE

Seat `composer` has added cell `[6]` to the same suite (**uncommitted**): of the
80 `string`-input sites, **24 have a word-list that ALREADY EXISTS; 56 are
free-text parsers, which are not this class at all.** The headline "80 of the 93
are one cause" should be read as **24**. This is `composer`'s measurement, not
mine — named here because item 61's count is what I was asked to verify, and it
has already moved in the working tree.

---

## THE TWO REMAINING SIGHTINGS

### AWAY — LOCATED. ONE TRIP, TWO SPANS, TWO DOORS

`src/types/programControlAction.ts`. The same trip is written twice:

- `set_schedule_modifier` carries **`awaySpan: { from, until }`** — `until` is the
  last day away.
- the equipment action carries **`missing_for_span: { from, until, tags,
  conditioningModalities }`** — the same trip's dates, authored separately.

Each half of the app reads one. **Nothing derives either from the other**, so an
athlete's single "I'm away 10th–20th" becomes two independently-authored spans
that can disagree — the item's shape exactly. A third format (`planChange:
{ kind: 'clear_days', dates }`) is the superseded door the comments describe.

**The fix in the worked example's shape:** one away decision, with the equipment
fact's span DERIVED from it, so the two cannot drift. NOT two authored spans kept
in sync.

### CONDITIONING — the wall is `categoryToFlavour`, and finding 3 adds a second

Not yet built. `arms` correctly did not touch `categoryToFlavour`: R-4A forbids
the category changing under the athlete, so any flavour chosen for `cod_decel`
invents law. **`conditioningStress` has no such ruling attached** and is the
tractable half.

---

## BLOCKED — A STALE GIT LOCK, AND IT BLOCKS EVERY SEAT, NOT JUST ME

`.git/HEAD.lock` is **0 bytes, 8+ minutes old, with no git process alive** —
left by a crashed process. No commit can land in this checkout until it is
removed. My takeover commit is staged and verified (`docs/SEAT_INBOX.md` hunk +
`docs/STATUS_VOCAB.md`, with the other seat's item-62 claim deliberately NOT
staged) and is waiting on it.
