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

### ✅ AWAY — CLOSED, `4087d998`

`rules/awaySpans.ts` is the one owner; both halves call it; the constraint
reader's parameter is `ActiveConstraint` instead of `any[]`, so the field names
are compiler-checked. `test:away-span-ownership` 8/0, in `test:bible`.
Mutation-proven three ways, each redding a different cell (field-name drift →
[2]; open-horizon rule dropped → [3]; liveness loosened → [4:expired],
[4:superseded]). Non-vacuity leads, because every other cell is an equality
between two readings and two empty readings are equal.

### ✅ CONDITIONING — THE HALF THAT COULD BE PAID WITHOUT INVENTING LAW, `fd070884`

`conditioningStress` is now a total `Readonly<Record<>>` instead of a switch
with a `default`. **Output-inert — every answer is what the switch already
returned, `cod_decel`'s `'unknown'` included.** The key type is DERIVED from
`Workout['conditioningCategory']` rather than re-typed, so the table cannot
drift from the field it reads.

**MUTATION-PROVEN, AND THE MUTATION EXPOSED AN INSTRUMENT FAULT OF MINE FIRST.**
Deleting the `cod_decel` row produced NO error under `tsconfig.json` — because
that project **does not include the file at all** (`--listFiles`: 0 hits).
Under `tsconfig.compile.json`, the real gate, it reds with `TS2741: Property
'cod_decel' is missing`. **A green compiler run against the wrong project is
not evidence**, and for a few minutes it had me believing my own enforcement
did not work.

### ⚠ WHAT IS DELIBERATELY NOT BUILT, AND WHY NO QUESTION GOES TO SAM

**`cod_decel`'s stress value, and `categoryToFlavour`.** Both are RULINGS, not
wiring:

- **REGISTRY-GREP** — `RULINGS_REGISTRY.md` for *cod*, *cod_decel*, *decel*,
  *change of direction*: **R-003** (the COD window), **R-028**, **R-056**, and
  **R-078** — *"leave it"*, Sam 2026-08-13, asked directly with the number in
  front of him, carrying **"do not re-open without a new ruling from Sam"**
  after FOUR reverted attempts.
- Sam's own authored `TIER_FOR_QUALITY` puts `cod_decel` at tier `A`, which
  would argue `'hard'` — **which is exactly why this seat does not get to pick
  it.**
- **AND IT IS NOT WORTH HIS TIME EITHER WAY.** R-078 establishes COD is placed
  **zero** times by slot arithmetic, so the stress label is currently
  unreachable. Handing him a question about a session that never gets placed is
  the re-ask trap this repo has already paid for. **The gap is named in the code
  and stays open. No question raised.**
- `categoryToFlavour` stays untouched for the reason `arms` already recorded:
  R-4A forbids the category changing under the athlete, so any flavour chosen
  for `cod_decel` invents law.

---

## SHARED-CHECKOUT HAZARDS PAID THIS SESSION

- **`git stash` IS A WHOLE-TREE WRITE, AND I USED IT FOR A CONTROL RUN.** It
  swept six other seats' uncommitted files for the duration. It popped clean and
  nothing was lost — verified against `git log`, they had committed — **but that
  was luck, and the cost was unbounded.** The right control is a
  backup-and-swap of the ONE file (`cp` to scratchpad, restore from my own
  backup), which is what the later two control runs used.
- **`git commit -- <path>` COMMITS THE WORKING TREE, NOT THE INDEX.** With
  another seat's claim sitting uncommitted in `docs/SEAT_INBOX.md`, that would
  have swept their line into my name. Staged the single hunk with
  `git apply --cached` and committed the INDEX instead.
- **`.git/HEAD.lock` stalled every commit twice**, ~10 minutes each, with no git
  process alive. A retry loop is what landed the work; moving the lock aside was
  refused by the sandbox.

### THE OLD CONDITIONING NOTE (superseded by the two sections above)

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

---

## ⚠ 2026-08-13 — I COMMITTED ANOTHER SEAT'S WORK UNDER MY NAME. `a7114ed8`.

**WHAT IT SAYS IT IS:** *"ITEM 13 PERFORMED — 21 UNENFORCED"*.
**WHAT IT ACTUALLY CONTAINS:** ten files, 1,686 insertions, **every one of them
`printer`'s** — `scripts/print-week.ts` (833 lines), `docs/STATUS_PRINTER.md`,
their six `docs/printed-weeks/*.md`, that directory's README, and their
`package.json` script entry. **My own item-13 text is not in it at all.**

**NOTHING IS LOST AND NOTHING IS REVERTED.** Their work is committed and intact;
the only damage is the label on it. **I have not run a revert and will not** — a
revert is a write, and here it would delete a seat's finished unit to fix a
sentence.

**HOW.** I ran a retry loop to get past `.git/HEAD.lock`, and each pass did
`git reset -- <their paths>` then `git add docs/SEAT_INBOX.md` then `git commit`.
Between passes, `printer` staged their unit. My reset named only the paths I had
seen on an earlier pass, so their NEW paths stayed staged; my inbox edit was
meanwhile overwritten by another seat's rewrite of that file, leaving it with
nothing of mine. **On attempt 38 the lock cleared and the commit took whatever
was in the index — which was entirely theirs.**

**THE LESSON, AND IT IS THE THIRD FORM OF THE SAME ONE THIS SESSION:**
[[shared-checkout-stage-and-commit-atomically]] says stage and commit as one
step. **A RETRY LOOP BREAKS THAT ATOMICITY BY CONSTRUCTION** — it holds the gap
between `add` and `commit` open for minutes and re-opens it every pass, which is
the exact window other seats stage into. **Never loop a commit in this
checkout.** If the lock is held, verify the staged set IMMEDIATELY before each
attempt with an exact-match check and abort if it is not exactly your paths —
which my loop did do at first, and which I dropped from the final attempt.

**ITEM 13 IS THEREFORE NOT RECORDED IN THE INBOX.** The measurement itself
stands and is stated here so it is not lost: **`LAW REGISTRY: 125 rows, 104
guarded, 21 UNENFORCED`**, read from `test:law-registry`, not `grep -c`. Down
one from `laws`' 22 without my touching a row. **I flipped none, deliberately:**
of the 21, three are refuted in writing and three unbuilt-by-prescription, and a
guard without a mutation proof and a liveness cell is the cost item 13 warns
about.
