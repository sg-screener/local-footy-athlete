# COMPOSER COMPLETION — boundary report, 2026-08-14, seat `core`

Branch `slice-composer-completion`. **Base commit `459d6bf9`** (`git merge-base`
against `main`). Worktree-isolated throughout; the shared checkout was never edited.

**COMMITS THAT CHANGED BEHAVIOUR OR EVIDENCE**

| | |
| --- | --- |
| `55af1e65` | R-089 — the declared shape is carried instead of guessed |
| `32f408b2` | the `full_body -> lower` collapse — **the 142-world checkpoint** |
| `75fc0c4e` | the first issue of this report and the printed weeks |
| `06b21b98` | the two acceptance criteria, measured ← *branch head at Sam's first review* |
| `27776930` | R-087 built — **the version that printed the week Sam rejected** |
| `3e5667e4` | R-087's hash recorded |
| `ea0c8d42` | **R-014 correction — the week-wide gap, the gate, the honest refusal** |

**THE COUNT IS NOT STATED AS A NUMBER HERE, DELIBERATELY.** A commit cannot state
its own hash, so every attempt to fix a total in this file creates one more commit
and a fresh under-count — which is exactly the mistake Sam corrected once already.
**`git log 459d6bf9..HEAD` is the authority; this table is the map of what each
one did.**

### ⚠ RECEIPT CORRECTIONS, ORDERED BY SAM 2026-08-14

Four inaccuracies in the first issue of this report, corrected here and named
rather than quietly overwritten:

1. **`459b6bf9` was never a commit in this repo.** The base is **`459d6bf9`**.
   A transposed digit, repeated in the header and the baseline table.
2. **"Two commits" undercounted.** It was **four** at the moment Sam reviewed,
   head `06b21b98`; the R-087 commit and this correction make **six**. The original line was
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
ordered, resolved 22 of them and took the corpus **120/180 → 142/180**. The other
14 are an honest refusal, blocked on the scheduling capability — §5.

---

## 1. BASELINE → FINAL

Every baseline figure was taken in a **separate clean worktree at `459d6bf9`**
(`scratchpad/wt-base`), not recalled and not read off the live tree — a control
run must see the same tree.

| instrument | baseline @ `459d6bf9` | over-filling R-087 *(rejected)* | **FINAL — corrected** | |
| --- | --- | --- | --- | --- |
| worlds built (of 180) | **120** | 156 | **142** | **+22** |
| worlds refused | **60** | 24 | **38** | −22 |
| deficient laddered days | **28** of 294 | 0 of 376 | **0** of 338 | see §7 — circular for composed days |
| laddered days (breadth) | **294** | 376 | **338** | floor 300 **PASSES** |
| R-089 unmatched squat — slot arm | **6** | 0 | **0** | |
| R-089 unmatched squat — content arm | *did not exist* | 0 | **0** | non-circular |
| R-089 unmatched single-leg knee — content | *did not exist* | **2** | **0** | the rejected build's regression is gone |
| `test:ladder-wide` cells | 7/11 | 13/14 | **13/14** | |
| `test:composer-severance` | 73 / 0 fail | 88 / 0 fail | **96 / 0 fail** | +23 cells, all new |
| `test:generated-week` | 36 / 0 fail | 36 / 0 | **36 / 0 fail** | unchanged |
| `test:qa` | 168 pass, 10 allowed, 1 policy fail | identical | **identical** | |
| `test:scenarios` | 1 failed (`G+1_RECOVERY`) | identical | **identical** | |
| `test:compile` | PASSED, 459 total | PASSED | **PASSED, 459 total** | no file regressed |
| composed rows legal for kit | — | 1626 / 0 illegal | **1422 / 0 illegal** | 202 typed gaps / 84 worlds |
| `test:bible:parallel` (253 suites) | **71 red** | 65 red | **70 red** | **no new red**, 1 newly green |

**`test:week-identity` is the newly-green suite, and it is attributable.** Cell
`W6` failed at base with
`Section 18 final-week rejection (pattern_restore_failure:strength_patterns:0)` —
a week with no strength patterns at all — which the `full_body` fix supplies.
8 pass/1 fail → 9 pass/0 fail, verified in both trees.

### ⚠ ONE SUITE FLAKED, AND IT IS NOT COUNTED AS A RESULT

The first roster run after this correction reported `test:census-hook` red. It is
green **3/3 standalone**, was green in both earlier full rosters, and came back
green on a clean re-run of the complete roster. The suite shells out to `git` in a
temporary repo, and the parallel runner runs many git-invoking suites at once.
**Recorded rather than quietly dropped** — but a one-off under a parallel runner is
not a result, and the settled comparison above is the clean re-run.

### THE CELL-LEVEL REGRESSION FROM THE PREVIOUS ISSUE IS RESOLVED

### ⚠ ONE CELL REGRESSED, AND THE SUITE TOTAL HIDES IT

The previous issue reported `R-089 [CONTENT] single-leg knee` going PASS → FAIL
(0 → 2) inside an already-red suite, where no suite total would show it. **It is
back to 0.** The two worlds now refuse honestly rather than publishing a week whose
top-up pass added a third knee — the same correction that answered Sam's rejection.
The cells are still diffed rather than the totals, which is how it was caught.

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

## 5. R-087 — CORRECTED AFTER SAM REJECTED THE WEEK IT PRINTED

**REGISTRY-GREP: R-087, R-089, R-080, R-014, R-093, R-094.**

### What he said

> *"that's a terrible program — there's no spacing and the volume is way too big
> on Monday."*

**He was right, and the bug was one word of his own ruling.** R-087 says a
full-body day depends on *"the rest of the week"*. I implemented "the rest of the
week" as **the days before it**. The full-body day was MONDAY, so the
accumulated-so-far set was EMPTY, every slot read as missing, and the day greedily
took the first seven of the weekly ladder — the night before Tuesday's full lower
session, which supplies most of them.

**R-014 governs the size and I had it backwards:** *"the number of exercises is not
important the total work being done evenly across the body is."* Bible `:122`'s
seven is an EXAMPLE of a full-body day, never a quota to fill regardless of
neighbours.

### The correction, in three parts

1. **The whole planned week is costed before any day is built.** `suppliedByDay`
   maps every OTHER strength day — before AND after — to the slots it will
   achievably supply (kit-filtered: a slot the kit cannot train is not supplied,
   so it stays a genuine gap).
2. **The top-up pass is gone.** It walked the ladder a second time to pad the day
   out to seven. That is exactly what put a squat, a deadlift and both single-leg
   compounds on Monday. `FULL_BODY_DAY_SIZE` is now a ceiling, never a target.
3. **A gate, definitional and not a count** (Sam forbade inventing a cap, R-014
   forbids counting exercises): `coverageGapsMakeAFullBodySession` asks the only
   question the name answers — **does this gap set train the lower body AND the
   upper body?** An upper-only gap set is not a small full-body day; it is not one.

### THE DISTRIBUTION, BEFORE AND AFTER — `Pre-season/5d/noclub/Full Gym/w1`

| | Mon | Tue | Wed | Thu–Sun |
| --- | --- | --- | --- | --- |
| **BEFORE — the week Sam rejected** | **7 lifts + conditioning** — Back Squat, Deadlift, Bulgarian Split Squats, Single-Leg RDL, Bench Press, Barbell Row, DB Shoulder Press | 5 — full lower again | 3 — push | empty |
| **AFTER — week-wide gaps** | **2** — Barbell Row, Lat Pulldown | 5 — full lower | 3 — push | empty |
| **SHIPPED** | *(no week — honest refusal)* | | | |

The corrected day asks for the week's genuine gap, which is **pull and nothing
else**: Tuesday supplies the entire lower ladder and Wednesday the presses. Sam's
point 4 is satisfied — squat, deadlift and both single-leg compounds no longer sit
the night before a full lower session.

### ⚠ AND THEN THE CORRECTED ANSWER WAS ALSO NOT SHIPPABLE

A two-row day under a heading that reads *"Full body — cover all movement
patterns"* is a different bad week, not a fix. **Measured across the corpus: 10
such days — 8 of two rows, 2 of a single `Push-ups`.** And it cost four worlds
against the checkpoint while gaining none.

So the gate declines them, and Sam's own instruction is what it obeys:

> *"If this week cannot become acceptable without that capability, restore its
> honest refusal rather than publishing a bad week. State that plainly and preserve
> the earlier 142-world checkpoint."*

**STATED PLAINLY: across all 180 worlds, ZERO `full_body_coverage` days are
composed.** Every general full-body day this planner places sits beside a lower day
and an upper day that between them already supply the ladder. **R-087's premise —
that such a day has genuine week-wide gaps worth a session — does not hold for any
week this planner builds.** The missing Thursday–Sunday spacing that would make
these weeks work belongs to the session-count/scheduling capability, which this
mission does not own.

**THE 142-WORLD CHECKPOINT IS PRESERVED AND RESTORED**: `142 built / 38 refused`,
`0 deficient of 338`, identical to `32f408b2`, and the refusal families are the
same three rows.

### The dormant branch has a guard, because dead weight is trusted later

An unreachable branch with no test is exactly what later code believes. Both
functions are therefore called DIRECTLY in `composerSeveranceTests`
(`[R-087]`, 8 cells, suite 88 → 96): the wide-open case returns Sam's fill order
capped at seven and is R-089-balanced; **the case Sam rejected returns pull-only and
is asserted NOT to re-take a slot the rest of the week already trains**; and the
gate is proved both ways (upper-only rejected, lower-only rejected, spanning
accepted).

### What this correction also fixed for free

**The R-089 single-leg-knee regression is GONE — 2 → 0 unmatched weeks, both arms
clean.** The two offending worlds (`Pre-season/{5d,6d}/noclub/Full Gym/w2`) now
refuse honestly instead of publishing a week whose top-up added a third knee. The
cell-level regression reported in the previous issue no longer exists.

## 6. THE REMAINING REFUSALS — BY OCCURRENCE AND BY DISTINCT PROFILE

**38 occurrences across 25 distinct profiles, in two families.** Every figure from
`scripts/probe-refusal-census.ts` → `scratchpad/census-gated.json`.

### Family A — the lone full-body day. 14 occ / 10 distinct profiles. HONEST REFUSAL.

| occ | distinct profile | typed finding |
| --- | --- | --- |
| 2 | Pre-season / 5d / noclub / Full Gym | `pattern_balance` + `required_safe_patterns_present:pull` |
| 2 | Pre-season / 5d / noclub / Dumbbells | same |
| 2 | Pre-season / 6d / noclub / Full Gym | same |
| 2 | Pre-season / 6d / noclub / Dumbbells | same |
| 1 | Off-season / 3d / club / Full Gym | same |
| 1 | Off-season / 3d / club / Dumbbells | same |
| 1 | Off-season / 3d / noclub / Full Gym | same |
| 1 | Off-season / 3d / noclub / Dumbbells | same |
| 1 | Pre-season / 5d / noclub / Bodyweight Only | `required_safe_patterns_present:push` |
| 1 | Pre-season / 6d / noclub / Bodyweight Only | `required_safe_patterns_present:push` |
| **14** | **10 distinct profiles** | |

**These are the weeks §5 declines to publish.** The composer CAN compose their
full-body day; what it composes is a two-row session under a full-body heading, and
the honest answer is the typed refusal. **Blocked on the session-count/scheduling
capability** — the Thursday–Sunday spacing — which this mission does not own.

### Family B — kit-blind planner session selection. 24 occ / 15 distinct profiles. UNTOUCHED.

| occ | distinct profile |
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
| **24** | **15 distinct profiles — every one Bodyweight Only** |

**Occurrences are profile × week**, which is why the units differ: an Off-season
profile refuses in week 2 only, an In-season one in both. By week: w1 9, w2 15.

**Typed finding, identical on all 24:** `main_strength_planner_selected_target —
the planner's own selected main-strength target is not met` (expected 3, actual 2).

**Owner: the planner's session-pattern selection.** Executed receipt,
`In-season/4d/club/Bodyweight Only/w1`:

```
planner day 2  archetype=upper  plannedPatterns=["pull"]   "Team training + Upper body - pull emphasis"
composer       kind=upper_split_pull  slots=["arm_or_shoulder"]
                    Explosive Push-up [arm_or_shoulder] pattern=-        <- accessory, no main lift
GAPS  day 2 horizontal_pull cause=kit wouldNeed=barbell
      day 2 vertical_pull   cause=kit wouldNeed=pullup_bar
REFUSED  main_strength_planner_selected_target  (expected 3, actual 2)
```

`kitUnachievablePatterns` correctly reports `["pull"]`. R-083 REMOVES an
untrainable pattern rather than substituting one, and R-093's fallback is about
PLANES WITHIN a pattern. Turning that day from pull into push is **re-planning, not
composing**. **The exact capability required:** the planner must not select a
session whose ONLY planned pattern is one the athlete's kit cannot train.
**Untouched, per Sam. Not queued.**

## 7. SCORECARD STATUS

| score | value | action |
| --- | --- | --- |
| built-world floor **150** | **142** — honestly RED | **NOT lowered.** The one remaining `test:ladder-wide` failure. |
| laddered-day breadth floor **300** | **338** — PASSES | not moved |
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
| R-089 single-leg knee | **0 unmatched** — the rejected build's regression is resolved | `test:ladder-wide` content arm |
| no previously built world lost | **0 lost**, **22 gained**, label-by-label over 180 | census set-compare |
| all content changes attributed | yes — per world, per commit | §4c, commit bodies |
| composer-owned refusal families resolved or honestly red with the exact blocker | 22 resolved; **14 honestly red**, blocker named (scheduling capability) | §5, §6A |
| non-composer families unchanged, one grouped report section | **24 occ / 15 distinct profiles, untouched** | §6 |
| **zero** repair / regenerate / fallback execution | none added, restored or called — diff over `src/` contains no such symbol on an added line, only a comment | `git diff 459d6bf9..HEAD -- src/`, `test:composer-severance` 88/0 |
| **every composed row legal for its kit** | **1422 rows checked, 0 illegal** | `scripts/probe-kit-legality.ts`, asked of `exerciseIsAvailableWith` |
| typed equipment gaps survive storage | **202 gaps across 84 worlds** survive onto the workout | same probe |
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
week this report's counts describe. **5 of 7 built, 2 print their typed refusal
instead of an invented week.**

| file | world | built | problems |
| --- | --- | --- | --- |
| 1 | In-season/2d/club/Full Gym — **the former R-089 family** | yes | 0 |
| 2 | In-season/2d/club/Dumbbells | yes | 0 |
| 3 | Pre-season/2d/club/Full Gym — **refused at base, builds now** | yes | 0 |
| 4 | Pre-season/5d/noclub/Full Gym — **the week Sam rejected; now REFUSES** | **no** | typed refusal printed |
| 5 | In-season/4d/club/Full Gym | yes | 1 |
| 6 | Off-season/4d/noclub/Full Gym | yes | 0 |
| 7 | In-season/4d/club/Bodyweight Only — the §6 batch | **no** | typed refusal printed |

**0 `[NO COPY]` across all five built weeks** — every athlete-facing word came out
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

- **No new red** across the complete 253-suite roster: **71 → 70**, one suite newly
  green with a traced cause. (`test:census-hook` flaked once under the parallel
  runner and came back green on a clean re-run — recorded in §1, not counted.)
- `test:compile` PASSED, 459 errors, **no file regressed**.
- `test:qa` and `test:scenarios` byte-identical to baseline.
- **+22 worlds build (120 → 142); ZERO previously built world lost.**
- **R-089 clean on two independent counters, both rules.** The single-leg-knee
  regression the previous issue reported is resolved.
- 1422 composed rows checked, **0 illegal for their athlete's kit**; 202 typed
  equipment gaps still disclosed.
- Zero repair, regenerate, fallback or legacy path added, restored or called.
- **Sam's approved two-day week is byte-identical** across every round of this work.

### What a merger is agreeing to, stated plainly

1. **The corpus is 142, not 156.** The 156 came from a full-body day that
   over-filled; Sam rejected the week it printed. **142 is the honest number** and
   it is the checkpoint he asked to have preserved.
2. **R-087's compose branch is currently unreachable — zero coverage days across
   180 worlds.** It is correct, directly guarded (8 cells), and dormant. Its
   premise does not hold for any week this planner builds, and the blocker is the
   **session-count/scheduling capability**, not the composer.
3. **`DEFICIENT_CEILING` is banked at 0 and is CIRCULAR for composed days.** The
   honest measure is the `[CONTENT]` R-089 arms, which consult no ladder.
4. **The built-world floor (150) stays honestly RED at 142.** Not lowered.

**Composer Completion is closed on everything the composer owns.** What remains is
**38 occurrences across 25 distinct profiles in two families** — 14 blocked on
scheduling, 24 planner-owned — each with an executed receipt and neither queued.

Agent: core
