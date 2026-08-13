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

### AWAY — LOCATED, AND MY FIRST TWO CANDIDATES WERE BOTH WRONG

**CANDIDATE 1, REFUTED: the two action payloads.** `awaySpan { from, until }` on
`set_schedule_modifier` and `missing_for_span { from, until, tags, … }` on the
equipment action DO both carry the trip's dates — but `HomeScreenV2` computes
`span` ONCE and hands the same object to both doors
(`setAwayEquipmentSpan(span)`). **Already derived. Not the sighting.**

### ✅ THE SIGHTING, FOUND: ONE TRIP READ THROUGH TWO WORD-LISTS

Two functions answer *"which trips are live over this week"*, and they share
**not one field name**:

| | `awaySpansFromFacts` | `awaySpansFromConstraints` |
| --- | --- | --- |
| lives in | `rules/derivedWeekContract.ts:84` | `services/api/generateProgram.ts:452` |
| reads | `TemporarySourceFact` | an active constraint |
| discriminator | `factKind === 'schedule'` | `type === 'schedule'` |
| start | **`effectiveFrom`** | **`startDate`** |
| end | **`effectiveUntil`** | **`expiresAt`** |
| liveness | **`status === 'active'`** | **`status !== 'resolved'`** |
| input typing | typed | **`readonly any[]`** |

**Each half of the app understands only one.** The derived-week contract decides
whether a game anchors the week; generation decides whether the club comes off
the calendar. One trip, two vocabularies, and the translation between them is a
projection nobody type-checks.

### ⚠ AND THE LIVE-DEFECT ALARM I ALMOST SENT IS REFUTED BY THE PIPELINE

`TemporarySourceFactStatus` is `active | resolved | expired | superseded`. So on
their faces the two liveness tests DISAGREE — `=== 'active'` drops `expired` and
`superseded`; `!== 'resolved'` keeps them. An expired trip would then leave the
derived week saying *"he is home, the game anchors"* while generation says
*"he is away, strip the club"*.

**I ran the seam before writing that up, and it does not happen.**
`activeTemporarySourceFacts` (`rules/temporarySourceFact.ts:620`) rejects every
fact whose `status !== 'active'` BEFORE `scheduleProjection` sees it, and the
projection then hard-codes `status: 'active'` on every constraint it emits. **The
constraint side is therefore incapable of holding a non-active travel span, and
the two predicates agree in practice.**

**THE DIVERGENCE IS LATENT, NOT LIVE — and that is still the finding.** The two
halves agree *by luck of an upstream filter*, not by construction: nothing ties
`expiresAt` to `effectiveUntil`, and the constraint side is `any[]`, so a rename
on the projection breaks exactly one half, silently, with no compiler and no
cell. That is item 61's sentence with the damage still in front of it rather
than behind it.

**The fix in the worked example's shape:** ONE function answering "the live away
spans", with the constraint reading DERIVED from the fact vocabulary rather than
re-authored beside it — not two hand-written filters kept in agreement.

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
