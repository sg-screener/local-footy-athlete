# COMPOSER COMPLETION — boundary report, 2026-08-14, seat `core`

Branch `slice-composer-completion`. **Base commit `459d6bf9`** (`git merge-base`
against `main`). Two commits: `55af1e65` (R-089) and `32f408b2` (the refusal
families). Worktree-isolated throughout; the shared checkout was never edited.

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
selected. That line was 22 of the 60 refusals.

---

## 1. BASELINE → FINAL

Every baseline figure was taken in a **separate clean worktree at `459b6bf9`**
(`scratchpad/wt-base`), not recalled and not read off the live tree — a control
run must see the same tree.

| instrument | baseline @ `459b6bf9` | final @ `32f408b2` | |
| --- | --- | --- | --- |
| worlds built (of 180) | **120** | **142** | +22 |
| worlds refused | **60** | **38** | −22 |
| deficient laddered days | **28** of 294 | **0** of 338 | see §4 — partly circular |
| laddered days (breadth) | **294** | **338** | floor 300 now **PASSES** |
| R-089 unmatched squat (slot arm) | **6** | **0** | |
| R-089 unmatched squat (content arm) | *did not exist* | **0** | new, non-circular |
| R-089 unmatched single-leg knee | 0 | **0** | |
| `test:ladder-wide` cells | 7/11 | **13/14** | |
| `test:composer-severance` | 73 / 0 fail | **88 / 0 fail** | +15 = exactly the new cells |
| `test:generated-week` | 36 / 0 fail | **36 / 0 fail** | unchanged |
| `test:qa` | 168 pass, 10 allowed, 1 policy fail | **identical** | |
| `test:scenarios` | 1 failed (`G+1_RECOVERY`) | **identical** | |
| `test:compile` | PASSED, 459 total | **PASSED, 459 total** | no file regressed |
| `test:bible:parallel` (253 suites) | **71 red** | **70 red** | **no new red**, 1 newly green |

**The one newly-green suite is attributable, not luck.** `test:week-identity`
cell `W6` failed at base with
`Section 18 final-week rejection (pattern_restore_failure:strength_patterns:0)` —
a week with no strength patterns at all. The `full_body → lower` fix gives that
week its patterns. 8 pass/1 fail → **9 pass/0 fail**, verified by running the
suite in both trees.

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

## 5. THE ONE GROUPED COMPOSER BOUNDARY — AND IT NEEDS NO RULING

**REGISTRY-GREP: R-087, R-089, R-093, R-094.**

**14 occurrences / 10 distinct worlds still refuse for one cause: the LONE
(odd-count) full-body day.**

| typed finding | occ | worlds |
| --- | --- | --- |
| `required_safe_patterns_present:pull` + `pattern_balance` | 12 | Off-season/3d/{club,noclub}/{Full Gym,Dumbbells}/w2 · Pre-season/{5d,6d}/noclub/{Full Gym,Dumbbells}/w1 w2 |
| `required_safe_patterns_present:push` | 2 | Pre-season/{5d,6d}/noclub/Bodyweight Only/w2 |

Both rows are the same cause, proved by `scripts/probe-validator-input.ts`: the
week as judged carries three `shape=lower` days and **no push day at all**.

### ⚠ I ALMOST SENT SAM A QUESTION HE ANSWERED ON 2026-08-13

I had written the question — *"what does a lone full-body day owe?"* — with two
candidate answers. **The registry grep killed it. R-087 rules exactly this:**

> *"depends what's in the rest of the week / each week should contain all the main
> lifts i.e. squat, hinge, single leg knee, single leg hip, push pull in both
> horizontal and vertical then accessories for uppers and lowers and some core"*
> · **THE WEEK IS THE UNIT OF COVERAGE, NOT THE DAY. A FULL BODY DAY HAS NO FIXED
> TEMPLATE.**
> … *"The composer's job is not to add two rows to a template. It is to make a full
> body day ASK the week what is still open."*
> … *"Any fix that hardcodes a full-body row list, however carefully chosen,
> contradicts this ruling on the day it lands."*
> · **`UNENFORCED` — no reader asks the week what is open before composing a full
> body day.**

**So the fix is specified and there is NOTHING for Sam to decide.** It also rules
against extending my own A/B assignment to the general case: R-093's A/B is the
SPECIFIC answer for the all-club-nights athlete; R-087 is the GENERAL rule, and
fixed shapes are a template.

**The ordered work, in one sentence:** a full-body day's required slots are the
slots the WEEK has not yet covered, taken in Sam's fill order and sized to Bible
`:122`'s seven, rather than any fixed list.

**Traced by hand against `Pre-season/5d/noclub/Full Gym/w1`:** day 1 is the week's
first strength day, so all eleven slots are open; the first seven in Sam's order
are squat · hinge · single-leg knee · single-leg hip · horizontal push ·
horizontal pull · vertical push. That week then trains push and pull (refusal
resolved) and is `sq1/hi1 slk1/slh1` before day 2 adds one of each (R-089 whole).

**WHY I DID NOT BUILD IT.** It moves a full-body day from 5 rows to 7, which is a
**volume change** touching `doseFor`, the exercise cap and §18 counting. Shipping
that inside the remaining budget without a full scenario and QA re-verification
would be exactly the confident-wrong claim this repo punishes. R-087 itself says
the honest interim answer: *"Where a week's structure cannot pay it, that is a
real deficiency to report, not a template to pad."* **These 14 are that report.**

R-087 also records the seam that has to move with it: **`MainStrengthPattern` is
still `squat|hinge|push|pull` and cannot say the single-leg slots.**

---

## 6. THE GROUPED NON-COMPOSER BATCH — ONE FAMILY

Per the mission's binding boundary, this was **diagnosed and not touched.** No
follow-up job was dispatched, no session-count policy changed, no planner capacity
edited, and nothing was patched around inside the composer.

| family | owner | occ | distinct worlds | exact capability required |
| --- | --- | --- | --- | --- |
| **Kit-blind planner session-pattern selection** | the planner / `coachingEngine` session allocator — **not** the composer | **24** | **15**, every one `Bodyweight Only` | the planner must not select a session whose ONLY planned pattern is one the athlete's kit cannot train |

**Worlds:** In-season/{4d,5d,6d}/{club,noclub}/Bodyweight Only w1 w2 ·
Off-season/{4d,5d,6d}/{club,noclub}/Bodyweight Only w2 ·
Pre-season/{4d,5d,6d}/club/Bodyweight Only w1 w2.

**Executed receipt**, `In-season/4d/club/Bodyweight Only/w1`:

```
planner day 2  archetype=upper  plannedPatterns=["pull"]   "Team training + Upper body - pull emphasis"
composer       kind=upper_split_pull  slots=["arm_or_shoulder"]
                    Explosive Push-up [arm_or_shoulder] pattern=-        <- accessory, no main lift
GAPS  day 2 horizontal_pull cause=kit wouldNeed=barbell
      day 2 vertical_pull   cause=kit wouldNeed=pullup_bar
REFUSED  main_strength_planner_selected_target  (expected 3, actual 2)
```

**Why this is NOT the composer's.** `kitUnachievablePatterns` correctly reports
`["pull"]`; R-083 removes an untrainable pattern rather than substituting one, and
Sam's fallback ruling (*"yes repeat achievable pull plane"*) is about PLANES
WITHIN a pattern, not about swapping the pattern the planner chose. Changing the
day from pull to push is **re-planning, not composing** — the composer's own
contract says it never renames or re-tasks a day. The planner picked a pull
session for an athlete with nothing to pull on, and the count shortfall is the
honest consequence.

---

## 7. SCORECARD STATUS

| score | value | action |
| --- | --- | --- |
| built-world floor **150** | **142** — honestly RED | **NOT lowered.** The one remaining `test:ladder-wide` failure. |
| laddered-day breadth floor **300** | **338** — now PASSES | not moved |
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
| no previously built world lost | **0 lost**, 22 gained, label-by-label over 180 | census set-compare, §4c |
| all content changes attributed | yes — per world, per commit | §4c, commit bodies |
| composer-owned refusal families resolved or honestly red with the exact blocker | 22 resolved; **14 honestly red**, blocker named (R-087) | §5 |
| non-composer families unchanged, one grouped report section | **24 occ / 15 worlds, untouched** | §6 |
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
| 4 | Pre-season/5d/noclub/Full Gym — the §5 boundary | **no** | typed refusal printed |
| 5 | In-season/4d/club/Full Gym | yes | 1 |
| 6 | Off-season/4d/noclub/Full Gym | yes | 0 |
| 7 | In-season/4d/club/Bodyweight Only — the §6 batch | **no** | typed refusal printed |

**0 `[NO COPY]` across all five built weeks** — every athlete-facing word came out
of the app. File 1 is the proof of §2 in plain English: **Back Squat on Tuesday,
Deadlift on Thursday.**

---

## 9. NOT COVERED

- **The 38 remaining refusals are not fixed.** §5 (14) and §6 (24), grouped.
- **R-087 is not implemented.** Named, ruled, receipted `UNENFORCED`, and left.
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
- **R-093 and R-094 remain `UNENFORCED` in the registry.** This mission did not
  claim either row, and no registry row was edited.
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

---

## 11. MERGE RECOMMENDATION

**MERGE.**

- **No new red** across the complete 253-suite roster; one suite newly green with
  an attributable cause verified in both trees.
- `test:compile` PASSED, 459 errors, **no file regressed**.
- `test:qa` and `test:scenarios` byte-identical to baseline.
- +22 worlds build; **no previously built world lost**; R-089 clean on two
  independent counters; breadth floor earned.
- Zero repair, regenerate, fallback or legacy path added or restored.
- The two preserved reds are the built-world floor (142 < 150) and the two
  refusal families, all three stated with their exact blockers.

**One caveat for the merger, and it is not a blocker:** `DEFICIENT_CEILING` is
banked at 0 and is **circular for composed days**. The constant, the commit
message and §7 all say so. If that trade is unacceptable, the alternative is to
delete the ceiling cell and keep only the `[CONTENT]` arms — but do not leave it
at 88, which would be a gate knowingly measuring nothing.

**Composer Completion is closed on R-089 and on the composer-owned refusal
family. It identifies exactly one grouped composer boundary (R-087, already
ruled, no question outstanding) and one grouped non-composer batch.**

Agent: core
