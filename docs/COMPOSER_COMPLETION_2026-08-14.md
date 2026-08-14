# COMPOSER COMPLETION — boundary report, 2026-08-14, seat `core`

Branch `slice-composer-completion`. **Base commit `459d6bf9`** (`git merge-base`
against `main`). Worktree-isolated throughout; the shared checkout was never edited.

**COMMITS — FIVE.**

| | | |
| --- | --- | --- |
| `55af1e65` | R-089 — the declared shape is carried instead of guessed | |
| `32f408b2` | the `full_body -> lower` collapse | |
| `75fc0c4e` | this report and the printed weeks | |
| `06b21b98` | the two acceptance criteria, measured | ← **branch head when Sam reviewed** |
| *(this one)* | **R-087 — a general full-body day asks the week what is open** | ordered by Sam after that review |

### ⚠ RECEIPT CORRECTIONS, ORDERED BY SAM 2026-08-14

Four inaccuracies in the first issue of this report, corrected here and named
rather than quietly overwritten:

1. **`459b6bf9` was never a commit in this repo.** The base is **`459d6bf9`**.
   A transposed digit, repeated in the header and the baseline table.
2. **"Two commits" undercounted.** It was **four** at the moment Sam reviewed,
   head `06b21b98`; the R-087 commit above makes **five**. The original line was
   written before the last three existed and was never re-checked.
3. **"44 of the 60 refusals" was a number no run produced.** It appeared in a code
   comment in `composeWeek.ts`. The measured figure, in the units the census
   reports, is **36 OCCURRENCES across 24 DISTINCT PROFILES.** Occurrences and
   distinct profiles are different units and both are now stated everywhere the
   claim appears.
4. **The gained-worlds list in §4c had been reconstructed by hand** and was wrong.
   Replaced with the set-compared result (already corrected in `06b21b98`).

---

## 0. THE HEADLINE, BEFORE ANY NUMBER

**THE ORDERED PREMISE WAS FALSE.** The order said six built In-season/2d/club
worlds ship *"a squat exposure with no hinge"* and told me to add a hinge.
**All six already train a hinge.** It is on the second night. Adding one would
have shipped a second hinge into a week that was already balanced.

What was actually broken is that the composer **computed the day's shape and threw
it away**, so every instrument that later asked "which of Sam's ladders does this
day owe" re-derived it from the planner's session title — and for Sam's full-body
shape that is unrecoverable from prose in principle.

The second finding is larger: **one line mapped the planner's `full_body`
archetype to `'lower'`**, so a day explicitly asked to cover squat, hinge, push
AND pull got the five-slot lower ladder and its push and pull were never
selected. **That line's refusal family was 36 OCCURRENCES across 24 DISTINCT
PROFILES of the 60 baseline refusals.** Fixing it, and then building R-087 as Sam
ordered, resolved all 36 and took the corpus **120/180 → 156/180**.

---

## 1. BASELINE → FINAL

Every baseline figure was taken in a **separate clean worktree at `459d6bf9`**
(`scratchpad/wt-base`), not recalled and not read off the live tree — a control
run must see the same tree.

| instrument | baseline @ `459d6bf9` | after R-089 + refusals | **FINAL, after R-087** | |
| --- | --- | --- | --- | --- |
| worlds built (of 180) | **120** | 142 | **156** | **+36** |
| worlds refused | **60** | 38 | **24** | −36 |
| deficient laddered days | **28** of 294 | 0 of 338 | **0** of 376 | see §7 — circular for composed days |
| laddered days (breadth) | **294** | 338 | **376** | floor 300 **PASSES** |
| R-089 unmatched squat (slot arm) | **6** | 0 | **0** | |
| R-089 unmatched squat (content arm) | *did not exist* | 0 | **0** | new, non-circular |
| R-089 unmatched single-leg knee (content) | *did not exist* | 0 | **2** | ⚠ **the one cell-level regression — §5** |
| `test:ladder-wide` cells | 7/11 | 13/14 | **13/14** | |
| `test:composer-severance` | 73 / 0 fail | 88 / 0 fail | **88 / 0 fail** | +15 = exactly the new cells |
| `test:generated-week` | 36 / 0 fail | 36 / 0 fail | **36 / 0 fail** | unchanged |
| `test:qa` | 168 pass, 10 allowed, 1 policy fail | identical | **identical** | |
| `test:scenarios` | 1 failed (`G+1_RECOVERY`) | identical | **identical** | |
| `test:compile` | PASSED, 459 total | PASSED | **PASSED, 459 total** | no file regressed |
| `test:bible:parallel` (253 suites) | **71 red** | 70 red | **65 red** | **no new red**, **6 newly green** |

**The six newly-green suites** — `week-identity`, `work-bill`, `projection-ownership`,
`door-ledger-append`, `g1-landing-ask-flow`, `device-pass-2026-08-05-evening` —
all assert real cells (6, 13, 29, 5 … passes respectively; checked, because a
suite that goes green by asserting nothing is this repo's oldest trap).
`week-identity`'s cause was traced: cell `W6` failed at base with
`Section 18 final-week rejection (pattern_restore_failure:strength_patterns:0)`,
a week with no strength patterns at all, which the `full_body` fix supplies.

### ⚠ ONE CELL REGRESSED, AND THE SUITE TOTAL HIDES IT

`test:ladder-wide` is red at baseline and red now, so **no suite-level comparison
would ever show this** — which is why the cells are diffed and not the totals.
**`R-089 [CONTENT]: no week has more single-leg knee than single-leg hip` went
PASS → FAIL: 0 → 2 unmatched weeks.** Fully attributed in §5. It is not a
composer defect and it is not silently absorbed.

---

## 2. THE R-089 SIX-WORLD RECEIPT

**Counted three independent ways** over the real 180-world corpus
(`scripts/probe-r089-from-rows.ts`), at base:

| counted from | unmatched-squat weeks |
| --- | --- |
| the day's NAME → ladder → `coverage.filled` — what the census did | **6** |
| the COMPOSER'S declared row slots | **0** |
| the MATERIALISED rows, day names ignored entirely | **0** |

All six worlds — In-season/2d/club × {Full Gym, Bodyweight Only, Dumbbells} × w{1,2}
— are **`sq1/hi1 slk1/slh1`**. Balanced weeks.

**Why the census could not see it.** `sessionSlotCoverage` computes `filled` by
assignment against `SLOTS_FOR_KIND[kind]`. `kind` came from
`slotDayKindFor(workout.name)`. The composer built `full_body_a` on Tuesday and
`full_body_b` on Thursday; the planner's titles still said *"Lower body strength
(squat + hinge)"* and *"Upper body – balanced push + pull"*. Judged as
`upper_full`, **`hinge` is not a member of that ladder**, so the Thursday deadlift
was never assigned and `weekPairs.hinge` never incremented.

**Executed receipt** (`scripts/probe-world-detail.ts "In-season/2d/club/Full Gym/w1"`):

```
day 2 kind=full_body_a  MAIN Back Squat [squat]  MAIN Single-Leg RDL [single_leg_hip]
                        MAIN Bench Press [horizontal_push]  MAIN Pull-Ups [vertical_pull]
day 4 kind=full_body_b  MAIN Deadlift [hinge]    MAIN Bulgarian Split Squats [single_leg_knee]
                        MAIN Overhead Press [vertical_push]  MAIN Barbell Row [horizontal_pull]
```

**And the athlete's day title was never the liar.** `dayHeadline` is a signed
lookup by KIND (`day.headline.<kind>`), and `slotDayKindFor` has **no production
reader** — only censuses and tests call it. `workout.name` still reaches
`cleanVisibleTitle` fallbacks and the coach LLM's context, which is reported in
§9 and deliberately not renamed.

### The fix, at the owner

1. **The full-body ladder MOVED from `composeWeek` to `sessionSlotCoverage`.** It
   was declared privately in the composer, so the COMPOSER knew a ladder the
   LADDER OWNER did not — two representations of one decision. `composeWeek` now
   imports it, and its three-arm conditional collapses to `SLOTS_FOR_KIND[kind]`.
   This closes that file's **own declared gap**, which said `Full Body Strength`
   was unjudged because *"he has never ruled a full-body one"*. R-093 ruled one on
   2026-08-14; it is quoted verbatim at the new home.
2. **`composedDayShape` is carried onto the materialised workout.** WRITER
   `materialiseComposedWeek`. READERS `ladderCoverageWideCensus` and the new
   `[shape]` block in `composerSeveranceTests`. All three landed in `55af1e65`.
   It is a **decision, not a derivation** — the composer decided full body where
   the planner said upper-only — on the precedent `section18Evidence.role` set.

**Guard, all three kits, seen RED once.** `[shape]` block, 15 cells (3 worlds × 5).
Mutation: dropping `hinge` from `FULL_BODY_B_SLOTS` — which moves the composer and
the judge **together**, so a circular cell would stay green — turned both R-089
arms RED and took content pair-exposures 640 → 610. Restored from my own
scratchpad backup, never `git checkout`.

---

## 3. REFUSAL-FAMILY CENSUS

`scripts/probe-refusal-census.ts` runs the real 180-world corpus and reads the
throw instead of swallowing it. The 60 baseline refusals were **three typed clause
sets, which reduce to two root causes.**

| # | typed finding | occ | worlds | class | root cause |
| --- | --- | --- | --- | --- | --- |
| F1 | `required_safe_patterns_present:push` and/or `:pull`, usually with `pattern_balance` | **36** | 24 | **A — COMPOSER** | `composedDayKind` mapped `archetype:'full_body'` → `'lower'` |
| F2 | `main_strength_planner_selected_target` | **24** | 15 | **B — NON-COMPOSER** | planner selects a pull-emphasis session for a kit that cannot pull |

F1's `pattern_balance` never occurred alone — it is a consequence of the same
missing push/pull, not a third family.

**Executed owner for F1**, `Pre-season/3d/club/Full Gym/w1`: two planner days,
both `archetype=full_body plannedPatterns=[squat,hinge,push,pull]`, both composed
`kind=lower`, refused
`required_safe_patterns_present:push|required_safe_patterns_present:pull|pattern_balance:2`
**on a FULL GYM** — Bench Press and Pull-Ups legal, in the pool, and unselected.
Owner: `src/rules/composeWeek.ts:473` (as it stood at base).

---

## 4. COMPOSER-OWNED FIXES

### 4a. `full_body` is no longer collapsed to `lower`

`composedDayKind` returns null for `full_body` (A-vs-B is a WEEK decision, not a
day's) and `composeWeek` owns the choice. **Three sites were asking about the DAY
and testing the WEEK** — `plannedPatterns`, `resolvePlane` and the shape choice all
read the week-level `fullBody` flag, so a planner-declared full-body day in an
ordinary week took the else arm: its lower rows came out **accessories** and its
planes never fell back on the kit. All three now read `isFullBodyDay`.

`composedDayIsStrength` splits a question `composedDayKind !== null` had been
answering for two different things — *is this a strength day* and *which ladder* —
which is why `sessionCount.requested` had to change with it.

### 4b. Bible `:94` was never read

`composedWeekIsFullBodyOnClubNights` enforced one of the two rulings behind it:

- **enforced** — every strength night is a club night (R-093, 2026-08-14);
- **not enforced** — Bible `:94`, verbatim: *"if can only do 2 strength sessions
  should be 2 x full body and those sessions should be pretty solid"*.

`:94` is **not conditional on the club**. A two-session athlete with two FREE
nights got whatever split the planner happened to name. Now the **union**, so a
three-session all-club-night week (covered by R-093 alone) does not regress.

### 4c. Worlds gained, by identity — 22, and ZERO LOST

**Set-compared label by label** across the two census runs (180 worlds, identical
label set). **Built-at-base-and-now-refused: 0. Refused-at-base-and-now-built: 22.**

```
Off-season/2d/club/{Full Gym, Dumbbells, Bodyweight Only}/w2
Off-season/2d/noclub/{Full Gym, Dumbbells, Bodyweight Only}/w2
Pre-season/2d/noclub/{Full Gym, Dumbbells}/w1 w2
Pre-season/3d/club/{Full Gym, Dumbbells, Bodyweight Only}/w1 w2
Pre-season/3d/noclub/{Full Gym, Dumbbells, Bodyweight Only}/w1 w2
```

The Off-season/2d gains are w2 only because those worlds' w1 already built at
base. **This list is the measured set, not a hand-derived one** — an earlier draft
of this section reconstructed it by hand from the family table and got it wrong.

**Zero post-composition repair executed.** No repair, regenerate, fallback or
legacy-builder path was added, restored or called. `test:composer-severance`'s
existing severance cells (88, 0 failures) hold across the change.

### 4d. ⚠ THE FIX CAUSED A REGRESSION AND THE NEW CONTENT ARM CAUGHT IT

Honouring a planner-declared full-body day took R-089 from 0 to **10 unmatched
squats** (`Off-season/4d`: one lower day `sq1/hi1` plus ONE full-body day, which
took shape A and made the week `sq2/hi1`). Starting odd weeks on B instead gave
**22 unmatched single-leg knees**.

**It is structural, and enumerated rather than assumed.** A adds
`squat + single_leg_hip`; B adds `hinge + single_leg_knee` — Sam's shapes **cross**
R-089's two pairs. Over lower-day counts 0–2 and full-body counts 1–3, every odd
full-body count violates under **both** starting shapes, and ordinary lower days
cannot absorb it because each contributes one of all four.

So the full-body shape is applied only where the week's full-body days **pair up**.
An unpaired one keeps the planner's ordinary ladder and refuses with its exact
typed blocker. **Not worked around, not padded.**

This regression was found by the `[CONTENT]` R-089 arm added in `55af1e65` — the
arm that reads only the rows, added precisely because the slot arm had gone
circular. It earned its keep inside one commit.

---

## 5. R-087 — BUILT. A FULL-BODY DAY NOW ASKS THE WEEK WHAT IS OPEN

**REGISTRY-GREP: R-087, R-089, R-080, R-093, R-094.**

The first issue of this report left 14 occurrences refusing and named R-087 as the
specified-but-unbuilt fix. **Sam ordered it built. It is built.**

> R-087, verbatim: *"depends what's in the rest of the week / each week should
> contain all the main lifts i.e. squat, hinge, single leg knee, single leg hip,
> push pull in both horizontal and vertical then accessories for uppers and lowers
> and some core"* · **THE WEEK IS THE UNIT OF COVERAGE, NOT THE DAY. A FULL BODY
> DAY HAS NO FIXED TEMPLATE.** … *"The composer's job is not to add two rows to a
> template. It is to make a full body day ASK the week what is still open."*

### What was built

`coverageSlotsForFullBodyDay` takes the slots the week has already filled and
returns this day's ladder: **uncovered slots first, in Sam's own enumeration
order, sized to Bible `:122`'s seven**, then — R-089's *"squatting and hinging
again is fine"* — walking the same order again for whatever rows remain.

**IT IS ORDER-DEPENDENT ON PURPOSE**, which is R-087's own example: a full-body day
placed after a lower day is a different seven from one that opens the week. The
accumulator is fed from `requiredSlots` (what the day FILLED), never from what it
declared — crediting a kit-emptied slot as covered would let a bodyweight week talk
itself out of ever training a pattern it could reach on a later day.

**R-093's TWO FIXED SHAPES STAY, AND ONLY FOR THEIR CASE.** A and B remain the
answer for the athlete whose every gym night is a club night, or who has two
strength sessions (Bible `:94`). R-087 governs every other full-body day. This is
also what let the parity gate go: A and B CROSS R-089's two pairs, so an odd number
of them cannot satisfy it — coverage selection walks a PAIRED order and so cannot
end a pattern unmatched, which is the one guard the function needs.

**Sam's approved two-day week is byte-identical** — files 1, 2, 3, 5 and 7 of the
printed set are unchanged by R-087, verified by `git diff`.

### Measured

    worlds built    142 -> 156      refused 38 -> 24
    laddered days   338 -> 376      deficient 0 -> 0
    R-089 squat       0 -> 0        both arms

All 14 previously-blocked occurrences build. The printed week 4 shows the day the
athlete gets: **Back Squat · Deadlift · Bulgarian Split Squats · Single-Leg RDL ·
Bench Press · Barbell Row · DB Shoulder Press** — Sam's fill order, seven rows.

### TWO THINGS THE BUILD BROKE, BOTH CAUGHT BY GUARDS, ONE FIXED

**(a) R-080, FIXED.** `[R-080] the muscle-group narrowing still holds` went RED: 2
days took two rows from one slot AND one muscle group —
`isolation_upper: Band Pull-Apart | Rear Delt Fly`. Cause: R-087's coverage day is
the FIRST day that can owe the same slot twice (R-093's *"repeat achievable pull
plane"* on a kit that cannot train vertical pull), and *"you cannot collide with
yourself"* had been true while every slot took exactly one row.
`applyPoolRotation` — R-080's only enforcer — was deleted in the B2 rebuild, so
nothing was left holding it. The composer now reads `PoolEntry.group` and prefers a
different group for a repeated slot. Preference, not veto: if every remaining
candidate shares the group the row is still authored, because a silently empty
declared slot is worse than a group repeat. `test:composer-severance` back to 88/0.

**(b) THE JUDGE COULD NOT SEE THE RULED REPEAT — FIXED.** 8 laddered days across 4
worlds scored `dup: [horizontal_push]` / `dup: [horizontal_pull]` **for obeying
R-093**. Two fixes, together: the day now declares the RESOLVED plane (so a repeat
is declared twice, which is the truth — a bodyweight full-body day owes two
horizontal pushes because its vertical push cannot be trained), and
`sessionSlotCoverage` compares row counts against **declared multiplicity** instead
of a flat `> 1`. Deficient back to 0 of 376.

### ⚠ (c) THE ONE THING STILL RED, AND IT IS NOT THE COMPOSER'S

**`R-089 [CONTENT]: single-leg knee` — 2 occurrences, 2 distinct profiles:**
`Pre-season/5d/noclub/Full Gym/w2` and `Pre-season/6d/noclub/Full Gym/w2`, both
`sq2/hi2 slk3/slh2`.

**The composer's own rows are balanced.** Every pair row, with its writer:

```
day 1  Front Squat        -> squat            prov=composer_declaration
day 1  Trap Bar Deadlift  -> hinge            prov=composer_declaration
day 1  Cossack Squat      -> single_leg_knee  prov=composer_declaration
day 1  Single-Leg RDL     -> single_leg_hip   prov=composer_declaration
day 2  Box Squat          -> squat            prov=composer_declaration
day 2  Kettlebell Swings  -> hinge            prov=composer_declaration
day 2  Lateral Lunge      -> single_leg_knee  prov=composer_declaration
day 2  Single-Leg RDL     -> single_leg_hip   prov=composer_declaration
day 4  Lateral Lunge      -> single_leg_knee  prov=canonical_row_classifier   <- THE THIRD KNEE
```

**The third knee is authored by `canonical_row_classifier` — the optional top-up
pass — on a day the composer does not own.** Composer rows are `slk2/slh2`.

**AND BOTH WORLDS REFUSED AT BASELINE**, so this is not behaviour this mission
created: it is pre-existing top-up behaviour that was invisible while the world
produced no week at all. The same shape as this mission's opening finding — a
refusing world contributes nothing to a census, so its defects read as zero.

**NOT FIXED, deliberately.** The owner is the top-up pass, not the composer, and
the standing boundary is that non-composer families are diagnosed and reported. It
is stated as a cell-level regression in §1 rather than hidden behind a suite total.

## 6. THE REMAINING REFUSALS — BY OCCURRENCE AND BY DISTINCT PROFILE

**24 occurrences across 15 distinct profiles. One family. Every one Bodyweight
Only.** Diagnosed and, per the standing boundary and Sam's explicit instruction,
**not touched.** No follow-up job was dispatched, no session-count policy changed,
no planner capacity edited, and nothing was patched around inside the composer.

`scripts/probe-refusal-census.ts` → `scratchpad/census-final.json`.

| occ | distinct profile (phase / days / club / kit) |
| --- | --- |
| 2 | In-season / 4d / club / Bodyweight Only |
| 2 | In-season / 4d / noclub / Bodyweight Only |
| 2 | In-season / 5d / club / Bodyweight Only |
| 2 | In-season / 5d / noclub / Bodyweight Only |
| 2 | In-season / 6d / club / Bodyweight Only |
| 2 | In-season / 6d / noclub / Bodyweight Only |
| 1 | Off-season / 4d / club / Bodyweight Only |
| 1 | Off-season / 4d / noclub / Bodyweight Only |
| 1 | Off-season / 5d / club / Bodyweight Only |
| 1 | Off-season / 5d / noclub / Bodyweight Only |
| 1 | Off-season / 6d / club / Bodyweight Only |
| 1 | Off-season / 6d / noclub / Bodyweight Only |
| 2 | Pre-season / 4d / club / Bodyweight Only |
| 2 | Pre-season / 5d / club / Bodyweight Only |
| 2 | Pre-season / 6d / club / Bodyweight Only |
| **24** | **15 distinct profiles** |

**Occurrences are profile × week**, which is why the two units differ: an
Off-season profile refuses in week 2 only, while an In-season one refuses in both.
By week: **w1 9, w2 15.** By training days: **4d 8, 5d 8, 6d 8** — flat. By phase:
In-season 12, Pre-season 6, Off-season 6. By kit: **Bodyweight Only 24, Full Gym 0,
Dumbbells 0.**

### The single cause, and its owner

**Typed finding, identical on all 24:**
`main_strength_planner_selected_target — the planner's own selected main-strength
target is not met` (expected 3, actual 2).

**Owner: the planner's session-pattern selection, not the composer.** Executed
receipt, `In-season/4d/club/Bodyweight Only/w1`:

```
planner day 2  archetype=upper  plannedPatterns=["pull"]   "Team training + Upper body - pull emphasis"
composer       kind=upper_split_pull  slots=["arm_or_shoulder"]
                    Explosive Push-up [arm_or_shoulder] pattern=-        <- accessory, no main lift
GAPS  day 2 horizontal_pull cause=kit wouldNeed=barbell
      day 2 vertical_pull   cause=kit wouldNeed=pullup_bar
REFUSED  main_strength_planner_selected_target  (expected 3, actual 2)
```

**Why it is not the composer's.** `kitUnachievablePatterns` correctly reports
`["pull"]`. R-083 REMOVES a pattern the kit cannot train rather than substituting
one, and R-093's fallback (*"yes repeat achievable pull plane"*) is about PLANES
WITHIN a pattern, not about swapping the pattern the planner chose. Turning that
day from pull into push is **re-planning, not composing** — the composer's contract
is that it never renames or re-tasks a day.

**The exact capability required:** the planner must not select a session whose ONLY
planned pattern is one the athlete's kit cannot train. It is a planner-side
kit-awareness gap, and it is stated here as the boundary — not queued.

## 7. SCORECARD STATUS

| score | value | action |
| --- | --- | --- |
| built-world floor **150** | **156** — now **PASSES** | not moved; earned, not lowered |
| laddered-day breadth floor **300** | **376** — now PASSES | not moved |
| deficient ceiling, was **88** | **0** | **banked to 0 in `55af1e65`, the commit that earned it** |

### ⚠ THE DEFICIENT CEILING IS NOW CIRCULAR AND THE CONSTANT SAYS SO IN FULL

`composeWeek` fills `SLOTS_FOR_KIND[kind]`; the census now judges the same day
against `SLOTS_FOR_KIND[kind]`. For a composed day those are the **same list**, so
`missing` is empty **by construction**. A ceiling that can only read zero has
stopped being a measurement. It is banked because the mission requires a measured
improvement to be banked where it was earned, and because it still guards two
things that are not tautological: **days nobody composed** (still title-judged),
and **the kit and injury interactions** (a kit-trainable slot the composer left
unfilled still reports `missing`).

**The replacement denominator, per the mission's §4 instruction:** the honest
measure of composer correctness is the **`[CONTENT]` R-089 arms** — 616 pair-slot
exposures read from rows, 0 unmatched, no ladder and no declaration consulted, and
mutation-proved to red under a change that keeps composer and judge in agreement.
**A future reader must not read "0 deficient" as health. The number that means
something is 338.**

---

## 7b. FINAL ACCEPTANCE, ITEM BY ITEM

Every row is an executed measurement, not an inspection of the diff.

| required | result | instrument |
| --- | --- | --- |
| R-089 `sq1/hi0`: **0** | **0**, on two independent counters | `test:ladder-wide`, both arms |
| R-089 single-leg knee | **2 unmatched**, both non-composer (§5c) | `test:ladder-wide` content arm |
| no previously built world lost | **0 lost**, **36 gained**, label-by-label over 180 | census set-compare |
| all content changes attributed | yes — per world, per commit | §4c, commit bodies |
| composer-owned refusal families resolved | **all 36 occurrences resolved** — R-087 built | §5 |
| non-composer families unchanged, one grouped report section | **24 occ / 15 distinct profiles, untouched** | §6 |
| **zero** repair / regenerate / fallback execution | none added, restored or called — diff over `src/` contains no such symbol on an added line, only a comment | `git diff 459d6bf9..HEAD -- src/`, `test:composer-severance` 88/0 |
| **every composed row legal for its kit** | **1626 rows checked, 0 illegal** | `scripts/probe-kit-legality.ts`, asked of `exerciseIsAvailableWith` |
| typed equipment gaps survive storage | **232 gaps across 92 worlds** survive onto the workout | same probe |
| no legacy generation path restored | none | same diff scan |

**The kit-legality probe carries its own non-vacuity arm**: it exits non-zero if it
checks zero rows, because "0 illegal" over nothing is the confident-zero shape this
repo has already paid for.

**Typed gaps survive STORAGE; BOOT was not re-tested.** The program is regenerated
at boot rather than persisted whole, so the gaps are recomputed each launch —
but no relaunch tape was run for `composedDayShape` or for `composedGaps` in this
mission. Stated again in §9.

---

## 8. REPRESENTATIVE WEEKS, IN PLAIN ENGLISH

`scripts/print-composer-completion-weeks.ts` → `docs/printed-weeks-composer-completion/`.
It **reuses `print-week.ts`'s renderer** rather than writing a second one (two
renderers give two `[NO COPY]` counts and neither is worth reading), and builds
every world from the **census's own profile shape**, so a printed week is the same
week this report's counts describe. **6 of 7 built, 1 prints its typed refusal
instead of an invented week.**

| file | world | built | problems |
| --- | --- | --- | --- |
| 1 | In-season/2d/club/Full Gym — **the former R-089 family** | yes | 0 |
| 2 | In-season/2d/club/Dumbbells | yes | 0 |
| 3 | Pre-season/2d/club/Full Gym — **refused at base, builds now** | yes | 0 |
| 4 | Pre-season/5d/noclub/Full Gym — **the R-087 day; refused before this work** | yes | 1 |
| 5 | In-season/4d/club/Full Gym | yes | 1 |
| 6 | Off-season/4d/noclub/Full Gym | yes | 0 |
| 7 | In-season/4d/club/Bodyweight Only — the §6 batch | **no** | typed refusal printed |

**0 `[NO COPY]` across all six built weeks** — every athlete-facing word came out
of the app. File 1 is the proof of §2 in plain English: **Back Squat on Tuesday,
Deadlift on Thursday.**

---

## 9. NOT COVERED

- **The 24 remaining refusals are not fixed** — one non-composer family, §6.
- **`R-089 [CONTENT] single-leg knee` is red, 2 occurrences.** Non-composer owner
  (§5c), left to it. Named as a cell-level regression in §1.
- **The registry row for R-087 was NOT edited**, and this report does not mark it
  built. No registry row was touched by this mission; whether the row may now
  claim a guard is the registry's own owner's call, not this seat's.
- **`workout.name` still describes a session the composer replaced.** Not the
  athlete's day title (`dayHeadline` is signed by kind) and `slotDayKindFor` has
  no production reader — but it reaches `cleanVisibleTitle` fallbacks and
  `CoachScreen`'s LLM context, so **the coach is told a day is "Lower body
  strength (squat + hinge)" while it holds a bench press and pull-ups.**
  Reported, deliberately not renamed: the authored label is Sam's to sign.
- **No simulator and no phone.** Every claim here is headless. No UI change is
  made or claimed. `test:compile` PASSED but a running build was not launched.
- **Persistence/boot was not re-verified for `composedDayShape`.** The program is
  regenerated at boot rather than persisted whole, so the field is recomputed
  every launch — but no relaunch tape was run for it in this mission.
- **R-093, R-094 and R-087 remain `UNENFORCED` in the registry.** This mission did
  not claim any row, and no registry row was edited.
- **R-080's re-homing is a PREFERENCE, not a veto.** If every remaining candidate
  for a repeated slot shares a muscle group, the row is still authored. Measured to
  be sufficient across the 180-world corpus; not proved sufficient in general.
- **The R-083 kit-blocked census fell 128 → 30** once the day began declaring the
  RESOLVED plane rather than the preferred one: a slot that falls back is no longer
  counted as blocked, because the day does train that pattern. The removal is still
  disclosed through `composedGaps` (232 across 92 worlds). The number means
  something different than it did and is not comparable across that change.
- **`test:slot-coverage` dies at import** on `applyPoolRotation`, deleted in the
  base merge. Pre-existing, in the baseline red set, not mine, not fixed.
- **Bodyweight pools repeat.** `Bodyweight Squat` and `Glute Bridge` recur across
  days once `usedThisWeek` is exhausted. Honest kit-limited behaviour, observed,
  not addressed.
- **`declaredKitGaps` is never passed** to `validateGeneratedWeek` at its
  production call site, though the input type declares it and the contract is
  built with `kitUnachievablePatterns`. It did not affect any finding measured
  here (the clause it would excuse is pattern presence, not the count shortfall),
  but it is an unread input on a live seam. Noted, not changed.

---

## 10. WHAT FOUGHT ME, VERBATIM

- **The order's own premise.** *"SIX BUILT BUT ILLEGAL WEEKS … Every squat
  exposure must be paired with a hinge."* They were paired. Building what was
  asked would have added a second hinge to a balanced week. Three independent
  counters were needed before I trusted it.
- **My own first comparison of the gate roster was garbage.** I diffed lines that
  carried per-suite TIMINGS, so all 71 baseline reds read as "newly green" and all
  69 as "new red" simultaneously — a nonsense that only looked wrong because both
  lists were implausibly total. Re-extracted on suite NAME. *A red count is a
  claim too.*
- **The suite that reported `passed=88` before and after my 15 new cells.** The
  pre-edit run had already included them, with `[undefined]` labels, because
  sucrase does not typecheck and `target.label` (the field is `id`) silently
  yielded undefined. Only a clean control worktree at base gave the true 73.
- **`slotDayKindFor`'s docstring was honest and out of date.** It said
  `Full Body Strength` stays unjudged because *"Sam has ruled a lower ladder and an
  upper ladder; he has never ruled a full-body one"*. He ruled one the next day
  (R-093), in a file the oracle does not import. **A declared gap outlives the
  world it was declared in.**
- **My own fix caused a fresh R-089 regression twice** — 10 unmatched squats one
  way, 22 unmatched single-leg knees the other — before the parity argument
  explained why neither direction could work.
- **I had a question typed out for Sam and R-087 had already answered it**, on
  2026-08-13, in as many words, including a pre-emptive refusal of the shape I was
  about to propose. The registry grep is the only reason it did not reach him.
- **BUILDING R-087 THEN BROKE TWO OTHER RULINGS AT ONCE.** R-080's muscle-group
  narrowing had been safe only because no slot was ever filled twice — *"you cannot
  collide with yourself"* — and R-087's coverage day is the first thing in the app
  that can owe a slot twice. Its enforcer `applyPoolRotation` had been deleted in
  the B2 rebuild, so nothing was holding it. And the judge scored 8 days deficient
  for obeying R-093's ruled plane-repeat. **Neither was visible in the refusal
  count, which had gone exactly where I wanted it.** A number moving the right way
  is not evidence that nothing else moved.
- **THREE OF MY OWN PROBES DISAGREED WITH EACH OTHER AND WITH THE CENSUS.**
  `probe-world-detail` indexes composer calls by `week - 1`, which is not
  `microcycles[week - 1]`, so its `w2` output is week 1's composition wearing a w2
  label; `probe-validator-input` prints the LAST validator call, a third week again.
  I diagnosed one world off the wrong one before noticing. `probe-census-offenders`
  was written to replicate the census exactly, and its header says why it exists.

---

## 11. MERGE RECOMMENDATION

**MERGE.**

- **No new red** across the complete 253-suite roster: **71 → 65**, and **six
  suites newly green**, each verified to assert real cells.
- `test:compile` PASSED, 459 errors, **no file regressed**.
- `test:qa` and `test:scenarios` byte-identical to baseline.
- **+36 worlds build (120 → 156); ZERO previously built world lost.** Both floors
  the mission forbade lowering — built-world 150 and breadth 300 — are now **met by
  the product** at 156 and 376, not by moving them.
- 1626 composed rows checked, **0 illegal for their athlete's kit**; 232 typed
  equipment gaps still disclosed.
- Zero repair, regenerate, fallback or legacy path added, restored or called.
- Sam's approved two-day week is **byte-identical** after R-087.

### Two things a merger must read, not skim

1. **`DEFICIENT_CEILING` is banked at 0 and is CIRCULAR for composed days.** The
   constant, the commit message and §7 all say so. The honest measure is the
   `[CONTENT]` R-089 arms, which consult no ladder and no declaration.
2. **One cell regressed and no suite total shows it.** `R-089 [CONTENT]
   single-leg knee` went 0 → 2 unmatched weeks, inside a suite that was already
   red. Both are `Pre-season/{5d,6d}/noclub/Full Gym/w2`, **both worlds refused at
   baseline**, and the offending third knee is written by
   `canonical_row_classifier` — the optional top-up pass — on a day the composer
   does not own. Composer rows are `slk2/slh2`. It is pre-existing behaviour made
   visible by those worlds building at all, and it is left to its owner.

**Composer Completion is closed.** R-089, the `full_body → lower` collapse and
R-087 are all built and guarded. What remains is **one non-composer family: 24
occurrences across 15 distinct profiles, every one Bodyweight Only**, diagnosed
with an executed receipt and deliberately untouched.

Agent: core
