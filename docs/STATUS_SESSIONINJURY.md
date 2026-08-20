# STATUS — seat `sessioninjury`

**Branch:** `feat/session-injury-review` (worktree, off `main` `da1dbf89`).
**Owner:** this seat only. Nobody else writes this file.
**Mission (Sam, 2026-08-20):** the Active Session Injury selection-and-review
flow. Ask for the area ONCE, find EVERY affected exercise, walk the approved
ladder, show ONE review, apply together. Injury stays separate from Remove.

---

## THE BASELINE, MEASURED BEFORE ANY CHANGE (worktree at `da1dbf89`)

| suite | baseline |
| --- | --- |
| `test:injury-fallback-journey` | 172 pass / 0 fail |
| `test:session-change-sequence` | 22 pass, ALL GREEN |
| `test:mid-block-restart` | **THROWS** — `validateLiveProgramWrite is not a function`. **RED ON `main` ITSELF, not mine.** |
| `test:session-change-hub` | 65 pass |
| `test:injury-recomposition` | 41 pass |
| `test:tap-swap-hierarchy` | 25 pass |
| `test:exercise-edit-entry-surface` | 46 / 46 |
| `test:plan-change-producer` | **64 failures, RED ON `main`** — failure set captured and diffed |
| `test:compile` | **77 files over baseline, RED ON `main`** — set captured and diffed |

---

## WHAT WAS ALREADY BUILT, AND WHAT WAS ACTUALLY MISSING

**Steps 2, 3 and the honesty rule were already done and signed.**
`unsafeRowsForInjury` finds every affected row; `planInjuryRecomposition` walks
the approved ladder (`rules/injuryFallbackLadder`, six rungs) and records honest
omissions; `injuryRecompositionMessage` derives the sentence from what actually
landed. R-115's `rules/injuryWithheldRows` already keeps an injury omission out
of the Remove list.

**What was missing was the athlete's half of it:**

1. **The flow asked for an EXERCISE first.** The Injury chip opened
   `pick_exercise`, so the athlete had to do the app's job of finding the
   affected work — and then only the row they named was reviewed.
2. **There was no review.** `set_injury_modifier` fired the moment the guided
   flow closed. The session was already recomposed before the athlete saw
   anything, and the `confirm_swap` shown afterwards covered ONE row of however
   many the injury had touched.

## WHAT LANDED

### 1. ONE OWNER FOR THE INJURY PASS'S INPUTS

`resolveInjuryRecompositionInputs` (exported from `utils/programControlActions`)
is now called by BOTH `recomposeSessionForInjury` (the write) and
`buildSessionInjuryReview` (the review). A review is a promise, and the only way
a promise is kept is if the thing that made it and the thing that keeps it ask
the identical question of the identical world.

**The one thing that moves between the two calls is the fact itself** — the
review runs before the constraint is stored, the write after. That is closed by
passing the pending constraint as `primaryInjury`, which
`resolveTapSwapEnvironment` folds into `injurySeverities` and now into
`medicalStop`. **That `medicalStop` clause is not a new opinion** —
`getTapSwapChoices` already computed `medicalStop || primaryInjury?.seriousSymptoms`
privately; `injuryRequiresChange` read the raw field and did not. One question,
one answer, decided at the owner. **MEASURED INERT** for every caller that
existed before it (the guided sheet hard-codes `seriousSymptoms: false`), and
`[1]` carries that as a standing control.

### 2. `utils/sessionInjuryReview.ts` — THE REVIEW, AND NOTHING ELSE

It invents no safety rule and no ladder. Every question it asks already had a
signed owner; it reads the plan and renames its parts for the athlete. A row is
`'substitution'` or `'withheld'` — **there is deliberately no `'removed'` kind**,
so no surface downstream can read a review row as an athlete Remove decision.

### 3. THE SCREEN

`openSessionInjuryFlow` opens the guided sheet from the hub with no row;
`reviewSessionInjury` builds the review and **writes nothing**;
`applySessionInjuryReview` applies all of it through the one durable door on
approval. `'injury'` left `ExercisePickAction` — Swap and Remove still need a
row because they genuinely are about one. **The five-action hub and the Add
hierarchy are untouched.**

---

## THE NUMBERS

`test:session-injury-review` — **43 pass / 0 fail**, on a real generated week
through the real doors, with the injured area chosen BY MEASUREMENT.

**MUTATIONS (all bite):**

| # | mutation | result |
| --- | --- | --- |
| M1 | `nothingChanges` can never be true | reds 2 |
| M2 | withheld rows dropped from the review | liveness reds, 8 cells skipped |
| M3 | pending injury stops feeding `medicalStop` | reds 1 |
| M4 | a withheld row reported as a substitution | liveness reds, 8 cells skipped |
| M5 | the red-flag predicate always answers false | reds 2 |

⚠ **M2 REDDENED NOTHING IN THE FIRST CUT, AND THAT IS THE FINDING.** A sweep of
13 areas x 5 severities x every training day of a real generated fortnight
produced **not one omission** — the approved ladder's rungs 5 and 6 are large
enough that an ordinary injury always has a legal answer. So the `withheld`
cells were green and EMPTY. The world that reaches them is the RED FLAG (8-10
plus serious symptoms), where `getTapSwapChoices` returns rest only: **all 5
rows withheld, 0 substitutions.** Section `[8]` is that world, and it is where
R-115 is re-proved end to end.

## THE THREE ORDERED CHECKS, AFTER

| suite | after | vs baseline |
| --- | --- | --- |
| `test:injury-fallback-journey` | 172 / 0 | identical |
| `test:session-change-sequence` | 22, ALL GREEN | identical |
| `test:mid-block-restart` | throws | identical — **still `main`'s break, not mine** |
| `test:exercise-edit-entry-surface` | 48 / 48 | +2 cells, both stricter |
| `test:plan-change-producer` | 64 failures | **failure set diffed byte-for-byte: IDENTICAL to `main`** |
| `test:compile` | 77 files | **set diffed: IDENTICAL to `main`, zero product files added** |

**THREE CELLS WERE INVERTED, NOT DELETED.** `exercise-edit-entry-surface` pinned
the route Sam's ruling removes (`action === 'injury') onInjuryStart(exercise)`).
The two flow-owner rows are RE-POINTED to the functions that replaced them, and
the doors cell now asserts the OPPOSITE and asserts more: that
`ExercisePickAction` has no `'injury'` member left to route on, and that the
door leads to the review.

---

## THE GLASS PASS — DONE, AND IT IS WHAT MADE THE LAST FINDING

Simulator `LFA Explorer 4c8535f Proof 2`, seed `injury-case`, Metro :8097 from
this worktree. **A separate port and a separate simulator on purpose** — :8081
was held by another seat's in-flight `expo run:ios --device` build and eight
other seats had Metro up; borrowing either would have proved somebody else's
tree. Screenshots in `/tmp/injshots`.

| # | what the athlete did | what they saw |
| --- | --- | --- |
| 03 | opened the session | **the five-action hub, unchanged** — Equipment · Injury · Add · Remove · Swap |
| 04 | tapped Injury | **"Where is the issue?"** — NOT "Which exercise?" |
| 07 | answered knee 7/10 | **ONE review, 5 cards**, `X → Y` each, the untrained disclosure, the untouched list, `Apply these 5 changes` / `Cancel` |
| 10 | approved | all five landed together, each row naming what it replaced, **each at its own load** (25kg / 27.5kg / BW) |
| 30 | wrist/hand 7/10 | one card, and the button says **`Apply this change`** — singular |
| 31 | neck 5/10 | **"Nothing needs changing"**, and the button says **`Save this injury`** |

**`[31]` IS SAM'S LAST SENTENCE ON GLASS.** No success claim, no "recomposed",
and the injury is still saved because it is still true.

## THE ONE FINDING, AND IT IS NOT MINE TO DECIDE

**THE REVIEW AND THE APPLIED ROW USE DIFFERENT NAMES FOR A ROW THAT HAS ALREADY
BEEN SUBSTITUTED ONCE.** Spotted on glass — the review said `Glute Bridge →
Explosive Landmine Press` and the session then read *"Swapped from RDLs"* —
and then reproduced headlessly with two injuries in sequence:

```
after a knee injury   session records  Leg Press -> Chest-Supported DB Row
then a shoulder one   review says      Chest-Supported DB Row -> Easy Bike
                      session says     Leg Press -> Easy Bike
```

**BOTH ARE TRUE AND NEITHER IS THIS UNIT'S DOING.** `substitutedFrom` preserves
the HEAD of the chain — what the athlete originally lost — which is pre-existing
behaviour on `main`. The review names the row that is in front of them, which is
the only name they can act on. **On a session with no prior substitution the two
agree pair-for-pair** (measured, `[9]`); they diverge only on a re-substituted
row, and the divergence is a NAMING one, never a PAIRING one.

Making them agree means either the review naming a row the athlete cannot see,
or the caption losing what was originally displaced. **That is a ruling, so it is
pinned by `[9]` and left for Sam rather than decided here.**

## R-121 — SAM RULED "THE ONE I CAN SEE" (2026-08-20)

*"The review and the applied session must both name the exercise currently
visible to the athlete. Keep older substitution history internally, but do not
show an older exercise as the source of this new Injury change."*

**MY FIRST DIAGNOSIS WAS WRONG AND THE FIX IS NOT THE ONE I DESCRIBED.** I
reported this as the session "preserving the head of the substitution chain".
It preserves nothing: **every injury settle rebuilds the day from the AUTHORED
week and re-applies all active injuries in ONE pass**, so the second injury
genuinely planned against `Leg Press` and had never seen the row the athlete was
looking at. The intermediate view is not stored and is not meant to be.

**SO THE NAME IS DERIVED BACK, NOT REMEMBERED** — the day as it would be with
every active injury EXCEPT the most recently declared one
(`previouslyVisibleInjurySources`). A pure function of stored facts, which is why
it survives a restart; a remembered name would revert to the authored one on the
first relaunch. **Which injury is "the new one" is derived too**
(`mostRecentlyDeclaredInjuryId`), never taken from whichever action is running,
so the live door and boot cannot disagree.

`rules/injurySubstitutionSource.ts` is the shared wording owner Sam asked for,
read by BOTH the row badge and the review. The screen composed that sentence
itself until now — which is exactly how the two came to disagree.
`substitutedFrom.originExerciseName` carries the authored exercise as internal
history and is rendered nowhere; the source resolver refuses to consult it.

**MUTATIONS:** M6 (settle names the authored row again) reds 4 · M7 (the badge
reaches for the older exercise) reds 3 · M8 (history stops being written) reds 1.

### ⚠ THE HALF THAT IS NOT DONE — SAM MUST RULE

R-121 holds for SUBSTITUTED rows. **It does NOT hold for WITHHELD ones.**
Measured, two injuries in sequence:

```
review promises to leave out   Tricep Pushdown, Bicep Curl (Barbell)
session actually withholds     Bulgarian Split Squats, Single-Leg RDL
```

**THIS ONE IS NOT A NAME, IT IS THE ROW.** A substituted row can be relabelled
because the row is whatever the ladder chose. A withheld row is the athlete's
ORIGINAL exercise by R-115's design, and the joint re-derivation reverts it to
the AUTHORED one — the first injury's replacement stops existing rather than
being withheld in place. **The fix is a DERIVATION change** (apply injuries in
declaration order, one on top of another, instead of jointly from the authored
week), **which changes which exercise the athlete gets, not just its name.** Not
taken. Pinned by the `⚠ OPEN` cell in `[9]` — a measurement, not an approval.

## THE SECOND GLASS PASS (R-121)

Same simulator, same seed, Metro :8097.

| # | what happened |
| --- | --- |
| 41 | after ONE injury the row reads **"Swapped from Glute Bridge"** — it read *"Swapped from RDLs"* before R-121, because this seed's session already carried a substitution |
| 42 | the SECOND review names only rows on the session now — Band Pull-Apart, Chest-Supported DB Row, Single-Arm DB Floor Press, Banded Bicep Curl, Tricep Pushdown, Band Pallof Press. **No older exercise anywhere** |
| 43 | applied — and this is the screen that showed the open half: the withheld rows read `Single-Leg RDL`, `Cossack Squat`, `Band Pallof Press`, not the rows the review named |

## R-122 — THE LADDER, THE SECTION BOUNDARY AND THE CLASSIFICATION DEFECT

Sam stopped the merge: *"The resulting session violates the approved Injury
fallback ladder. 'Skip' is the final option only after the app proves there is no
safe alternative."* Then: *"Breathing Reset must never appear inside Strength …
A Strength replacement must remain a legal Strength exercise."*

**THE TRACE HE ASKED FOR.** `Breathing Reset` is not drawn from any pool — it is
a literal minted inside `tapSwapHierarchy.recoveryChoice`, the equipment-free
half of a fallback appended AFTER the ladder has spoken. So it never went through
the ladder's ranking at all, and the ladder had no concept of a section to refuse
it with. That is how a Strength row became a breathing drill.

**THREE DEFECTS, ALL FIXED AT SHARED OWNERS:**

1. **The ladder had no section boundary.** `rules/exerciseSessionFamily` derives
   the family from the SAME maps the Add menu is built from (R-120's total
   pool→leaf→family record). No new table.
2. **Recovery was injected after the ladder.** Fixing only the ladder made this
   WORSE — the pooled recovery option vanished, the "already has recovery"
   guard stopped matching, and `Breathing Reset` was pushed onto a `Bench Press`
   menu that never carried it. Caught by a suite, not by reasoning.
3. **`unknown` meant "unsafe" for a row already on the session.** Two questions
   were sharing one predicate. **70 of 90 pooled and conditioning names are
   unrated**, so every conditioning format was being marked unsafe for every
   injury. `injuryWithholdsExistingRow` splits it.

**AND THE STACKING RULE.** Injuries are applied in declaration order, each
against the result of the one before, with **stage k seeing only the injuries
that existed by stage k**. A full environment at every stage re-derived the first
injury while already knowing the second. **This closes R-121's withheld half**,
which was recorded as OPEN when it was ruled.

### THE NUMBERS — ORDINARY CASES PRODUCE USEFUL WORK

`npm run probe:injury-ladder`, real generated week, real doors:

| world | unsafe rows | replacements | skipped |
| --- | --- | --- | --- |
| knee 7/10 | 4 | **4 Strength** | **0** |
| shoulder 6/10 | 1 | 1 Strength | 0 |
| hamstring 5/10 | 1 | `RDLs -> Glute Bridge` (Sam's own Bible swap) | 0 |

For a genuinely exhausted world — knee 7/10 AND shoulder 7/10 — the probe prints
every rung's candidates and every rejection: rungs 1-4 empty because the sheet
refuses the whole upper body for the shoulder and the whole lower body for the
knee, rung 5 refused 33 as still loading the knee and 15 as heavier than the row.
**That skip is honest and now provable.**

### THE GATE SAM ASKED FOR, AND WHY ITS FIRST VERSION WAS WORTHLESS

`[11]` fails if any Mobility / Warm-up or Conditioning exercise appears as a
Strength replacement. ⚠ **THE FIRST VERSION WAS GREEN AND EMPTY** — with one
injury the ladder almost never runs out, so removing the boundary from the
planner, the ladder AND the recovery fallback reddened NOTHING. It sweeps 13
regions x 4 bands **on top of an already-applied injury** now, and asserts it
reached the state the boundary is about. **M13** (both boundaries off) reds 2 and
reproduces `Chest-Supported DB Row -> Easy Bike` exactly.

⚠ **THE TWO BOUNDARIES ARE BELT-AND-BRACES — either alone holds, which is why
single mutations do not bite. Do not delete one as redundant.**

### THE THIRD GLASS PASS

Knee 7/10 on the `injury-case` seed: the review offers **five real Strength
replacements** (`Back Squat → Chest-Supported DB Row`, `Glute Bridge → Explosive
Landmine Press`, …), and the applied session carries all five at their own loads
(25kg / 20kg / BW / 27.5kg), each naming the row it replaced — **no recovery
work, no breathing drill, nothing skipped.**

## D4 — "DOES MISSING MEAN SAFE?" — SAM'S QUESTION FOUND A REAL HOLE

Two of the three gates already refused an unrated exercise. The ladder only ever
considers rated ones, and the safety assessor refuses an unrated name outright.
**But a hard-coded pair — `Easy Bike` and `Breathing Reset` — skipped BOTH the
unrated refusal and the per-region check.**

MEASURED at knee 9/10 AND shoulder 9/10, the most severe world the app has:

```
Breathing Reset   safe=TRUE   "passes injury, readiness and equipment checks"
                              ...with no injury check performed at all
```

The exemption is deleted. `Easy Bike` is rated and is judged on its ratings;
`Breathing Reset` is unrated and is now refused as *"cannot be verified against
the active injury"*. **I did not invent a rating for it** — rating it is Sam's
matrix to author, and the code's own comment already says to close such gaps in
the data.

⚠ **ASKING `injuryPermitsExerciseAtSeverity` WOULD HAVE PASSED AND PROVED
NOTHING.** That predicate always refused `unknown`. The hole was one layer out,
in the function the ladder actually passes as `isLegal`. **Ask the gate, not the
predicate.** The new cell asks the gate and sweeps every unrated name.

**THE PROOF FOR THE SCREENSHOTS** — every replacement is admitted by an explicit
rating, none by a missing one. For the 7/10 knee: `Band Pull-Apart`,
`Chest-Supported DB Row`, `Explosive Landmine Press`, `Banded Bicep Curl` and
`Single-Arm DB Floor Press` are each rated **`knee: good`** in Sam's ruled matrix.

Re-driven on the simulator after the fix: identical session, same five
replacements, same loads. Ordinary cases unchanged — knee 7/10, shoulder 6/10,
hamstring 5/10, lower back 6/10 and calf 7/10 all still skip nothing.

## LOG

- 2026-08-20 — worktree off `da1dbf89`, baseline measured, defects named.
- 2026-08-20 — the review owner, the screen flow, the suite, the mutations.
- 2026-08-20 — **NOT MERGED. Sam's approval not given and not assumed.**
