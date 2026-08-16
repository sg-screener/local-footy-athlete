# STATUS — seat `blocktwo`

Owner of `feat/block-two-progression`. Started 2026-08-16 from `8c33df58`.

Mission: BLOCK TWO — FIRST COMPLETE ATHLETE LOOP. Block 1 → athlete history →
adapted Block 2 → persistence → athlete-visible explanation. CAP 3 sessions.

---

## SESSION 1 — STEP 0 CLOSED, THE MACHINE MAPPED, THE GAP NAMED

### Step 0 — the approved onboarding change is SAVED

`8c33df58` on `main`. Exactly five pathspecs, staged list printed before the
commit, `44+/13-`. No `.fuse_hidden*`, no contract doc. Content byte-identical
to a pre-session backup at every check (`shasum -c`, 5/5 OK, before staging and
after committing).

Copy only — the two training-days asks now name GYM ACCESS instead of "LFA
days". Targeted suites: `onboarding-presentation` 54/54,
`onboarding-bounds` 41/41, `copy-rulings-binding` 9/9,
`signed-copy-extraction` 8/8.

⚠ `onboarding-field-influence` is 21/2 red — `ageRange` and `trainingLocation`
have no programming consumer. **Proven pre-existing**: identical 21/2 in a
clean control worktree at `67bbc4bd`, which carries none of the five files.
Not caused by, and not touched by, this commit.

### The isolated seat

`feat/block-two-progression` at `8c33df58`, worktree outside the shared
checkout. The contract doc is copied in and **left untracked**, per Sam:
it commits when the FULL contract is enforced, not when this slice lands.

---

## THE MACHINE THAT ALREADY EXISTS — measured, not assumed

**The block boundary is real and already canonical.** `rolloverProgramBlock`
(`utils/programBlockRollover.ts`) → `rebuildLocalWeek({scope:'block',
blockNumber: next})` → `commitRebuiltProgram`. `WEEKS_PER_BLOCK = 4` in
`utils/programBlockState.ts`. Its own header states the property this mission
depends on: *"Session feedback and performed weight history live outside
`setCurrentProgram`, so the canonical rebuild leaves both intact for the
progression resolver."*

**Progression runs at RESOLVE time, not at generation time.**
`strengthProgressionIntegration.ts` has exactly ONE production importer —
`utils/sessionResolver.ts` (≈1594–1629). `generateProgram.ts` does not read
`sessionFeedback` at all (its only mention is `sessionFeedback: {}`). So Block 2
gets its history-driven loads when the week is RESOLVED for display, not when
the block is generated. **Any guard that asserts on the generator's output
alone will be green and empty.**

**The history the app genuinely records** — this is the contract's "evidence the
app may use", and it is `SessionFeedback` in `store/programStore.ts` (persisted,
`partialize`d, keyed by ISO date):

| contract evidence | field | notes |
| --- | --- | --- |
| completed / skipped | `completion`, `components[]` | |
| athlete-selected loads | `strength[]` → `StrengthExercisePerformanceLog.weightKg` | athlete override first, prescribed snapshot second |
| difficulty | `difficulty` (1-10), `feeling` | |
| readiness / soreness | `soreness`, plus `store/readinessStore.ts` | |

⚠ **`completedSets` and `actualReps` are OPTIONAL** and written only when the
athlete logged per-set detail (`buildStrengthPerformanceLogs`,
`utils/strengthLogging.ts`). The contract's hard line — *never infer completed
reps or sets from a completed-session marker* — is therefore **already
representable**, and the guard must be that absent means absent.

⚠ `store/workoutLogStore.ts` is **in-memory only** — no `persist`. It is not
durable history; it is the live logging session. The durable copy is the
`strength[]` snapshot taken on save.

---

## THE GAP — one live defect, already visible in a red suite

`test:variation` (`variedProgramPersonaTests`) fails today with, verbatim:

```
- mc=2 prescription is Front Squat (got Back Squat)
- Front Squat prescribed 102.5kg within ±10% of sibling-normalised
  baseline 85kg (delta 17.5kg)
- mc=2 anchor rotates to Front Squat
```

Both halves of this mission's subject, in one place: **the anchor is not
rotating at the block boundary**, and where a rotation IS expected the load is
the old exercise's number carried across and increased.

The mechanism is named in `applyStrengthProgression`
(`strengthProgressionIntegration.ts` ≈680): `extractSlotExposureHistory` is
called deliberately *"so rotated pool anchors (e.g. Back Squat → Front Squat)
inherit the prior block's exposure trend with load normalized via the pool's
load ratios."*

**Read the contract before calling this a defect.** Line 32 forbids *"blindly
transferred and increased"* and permits a seed *"informed conservatively where a
valid mapping exists"*. A ratio-mapped seed is legal; a transfer-and-increase is
not. **The guard must assert the rotated lift's load is neither the old load nor
the old load plus an increment** — not merely that it differs.

---

## TWO DOORS MY FIXTURES MUST PASS — found by crashing into them

`test:block-rollover` and `test:block-state` do not fail, they **crash**, and
both crashes are fixture-shape, not subject:

- `ProgramGenError: I still need to know what equipment you can train with` —
  `generationEquipmentInputOrThrow`, `generateProgram.ts:406`. **A full-gym
  athlete needs a real equipment answer or generation refuses outright.**
  Reusable fixture: `src/__tests__/support/equipmentAnswerFixture.ts`.
- `GeneratedWeekRefusedError: main_strength_permitted_maximum:4` — the day-set
  chosen is **one of the 40 refusal worlds**. Sam has parked those. The two
  athletes must be built OUTSIDE that set.

Both are pre-existing members of the 163 baseline and are **not mine to fix**.
They are recorded here because they are the two ways this mission's harness
would otherwise die at setup and read as "no result".

Also reusable: `support/freshInstallStores.ts`, `support/athleteActionWalker.ts`,
and `programBlockRolloverTests.ts` itself, which already drives the real spine
`generateProgramLocally` → `programStore` → `rolloverProgramBlock` →
`resolveWeekWithConditioning`.

---

---

# SESSION 2 — A CORRECTION, THEN THE REAL DEFECT

## ⚠ I WAS WRONG IN SESSION 1. THE AUTHORING-TIME FREEZE ALREADY EXISTS.

Session 1 reported *"progression runs at RESOLVE time, not generation time"*.
**That is wrong, and the way I got it wrong is worth recording:** I grepped the
importers of `strengthProgressionIntegration`, found one production importer
(`sessionResolver`), and concluded generation had no progression pass. The
generation-time pass does exist — it lives at `generateProgram.ts:1460` and is
called `bakeMicrocycleStrengthProgression`, and it reaches the progression code
THROUGH `sessionResolver`, so an importer grep can never see it.

**The importer of a module is not the caller of its behaviour.** Same shape as
`a-suite-can-test-code-nothing-runs`, one level up.

Its own comment already states Sam's requirement as built intent: *"materialise
strength progression into the stored microcycles once. Resolution then merely
projects these loads — it no longer recomputes progression on read."*

## THE ACTUAL DEFECT — four empty arguments

`generateProgram.ts:1470-1474`, verbatim:

```
    sessionFeedback: {},
    weightOverrides: {},
    workoutHistory: [],
    blockState: null,
```

The freeze runs against an athlete with **no history and no block identity**. So
it bakes a history-free load into storage; the resolver then draws the screen
from the LIVE store, re-derives with the real history, and shows a different
number. **Stored ≠ visible, and the cause is four empty arguments — not a
missing layer.** `blockState: null` also means the freeze cannot know which
block it is authoring, which is why nothing retains or rotates deliberately.

This is a much smaller and much better-located fix than session 1 implied, and
it means **Sam's "do not preserve the projection-time rewrite as the new
authority" is mostly a matter of feeding the existing authority and stopping the
second derivation** — not building a new one.

## WHAT LANDED THIS SESSION

`src/rules/blockBoundaryProgression.ts` — the DECISION layer only, deliberately
not a second apply-and-stamp pass beside the existing freeze. It owns:

- **retained + qualifying history → `+2.5 kg`** (`SMALLEST_AUTHORISED_INCREMENT_KG`);
- **rotated → load UNSET, no estimate** (`ROTATED_LOAD_STAYS_UNSET`, Sam's
  option B of 2026-08-16), with the `loadRatio` sibling table deliberately NOT
  consulted this slice even though it is exactly the validated mapping his
  general rule licenses;
- **"is this barbell work" from Sam's own authored equipment sheet**
  (`equipmentRequiredFor`), never from the exercise name. An OR-group such as
  `Romanian Deadlift: [['barbell','dumbbells']]` does NOT earn the barbell
  increment;
- **no inference of reps or sets from a completed marker** — `completedSets` and
  `actualReps` are not read at all, so their absence cannot be misread;
- **silence is not good recovery** — an athlete who ticked sessions off and never
  answered how they felt does not qualify.

**A field I wrote and then removed in the same session:**
`WorkoutExercise.blockBoundaryProgressionResolved`. Once the existing freeze was
found, the stamp had no reader that the freeze did not already provide, and this
repo's law is that a field with no reader is dead weight later code will trust.
Backed out of `types/domain.ts` before any commit.

`scripts/probe-block-two.ts` — diagnostic, not a guard. It is what measured:
generation succeeds for a 3-day full-gym pre-season athlete; **rotation at the
block boundary already happens** (11 rotated in, 4 retained of 15); and
generated loads are `0`, not real estimates — which is what answered the
open question about rotated-lift estimates without needing Sam.

## RECEIPTS

- `test:compile`: 468 errors, 6 files worse — **byte-identical to the clean
  control worktree at `67bbc4bd`**. My module and the reverted field added zero.
- `test:ruling-registry` baseline recorded before any edit: **6 passed, 2 failed,
  95 rulings, 18 question sites.** One failing cell is a RATCHET —
  *"the UNENFORCED ruling count only falls"* — so **Sam's three new rulings must
  NOT be written to the registry until their guards are green and
  mutation-proven**, or registering them reddens the gate further. That ordering
  is forced, not chosen.

## ⚠ A SUITE THAT NOW CONTRADICTS AN APPROVED RULING

`variedProgramPersonaTests` (`test:variation`, already red in the 163) asserts
the OLD authority as correct:

- Front Squat should be `85kg` via *"sibling transfer"* from Back Squat `100kg`;
- *"rotation must never reset an experienced athlete"* — prescribed weight `> 50`.

**Sam's option B rules both of these wrong.** They describe the behaviour he has
just retired. They are not coverage to preserve; they are a conclusion that has
outlived its world. Retiring those specific cells is part of the next slice and
will be reported explicitly, not done quietly.

---

# SESSION 3 — THE FREEZE IS FED, AND THE SCREEN NEVER HAD THE AUTHORITY

## Sam's second instruction was already satisfied — and that is now PROVEN, not assumed

*"Remove the screen's authority to recalculate a different prescription;
projection displays the stored result."*

The read-time progression layer was **already retired** before this mission.
`applyStrengthProgression` has exactly ONE call site in the whole repo
(`sessionResolver.ts:1625`), inside `materialiseWeekStrengthProgression`, which
is reached only from the AUTHORING entry `authorWeekStrengthProgression` →
`bakeMicrocycleStrengthProgression`. `resolveWeekWithConditioning` carries a
standing comment saying so. **Nothing was removed because nothing was left.**

**A green reading of that is a claim, so it was controlled.** The projection was
handed a history that CONTRADICTS the one generation saw — 60 kg instead of
100 kg, `very_hard`, `high` soreness. A projection with authority re-derives and
moves. It did not move:

```
STORED 102.5 | VISIBLE 102.5 | RELOADED stored 102.5 | RELOADED visible 102.5
CONTROL — projection handed a contradictory history → VISIBLE 102.5
```

Without that control, "stored == visible" is equally produced by *"projection
obeys"* and by *"both passes happened to agree"*.

## What actually changed — four arguments

`generateProgram.ts` used to hand the freeze `sessionFeedback: {}`,
`weightOverrides: {}`, `workoutHistory: []`, `blockState: null`. It now passes
the real persisted history, selected loads and block state, via a new
`progressionHistory` option that **defaults to reading the live store** — so the
rollover path (`rebuildLocalWeek` → `generateProgramLocally`, one door for
Block 2) inherits it with no threading, while a caller can still author against
a stated history, which is what makes the boundary testable.

The block-boundary decision then has the last word on a strength row's load,
**from block 2 onward only** — block 1 has no previous block to retain from, and
running it there would blank loads block 1 legitimately produced.

## MEASURED, on two otherwise-identical full-gym athletes

| lift | last recorded | athlete A | athlete B |
| --- | --- | --- | --- |
| **Deadlift** (barbell, retained) | 100 kg | **102.5 kg** | *unset* |
| Goblet Squat (retained, not barbell-required) | 40 kg | 40 kg — held | *unset* |
| 14 rotated rows | — | *unset* | *unset* |

**Athlete B receives no history-driven progression.** Athlete A's retained
barbell lift receives exactly the smallest authorised increment. No rotated main
or secondary lift inherits anything.

⚠ **Three rotated rows still carry a number: `Bosch Hold=0`,
`Copenhagen Plank (Half)=0`, `Bicep Curl (Barbell)=20`.** These are NOT
progression rows — `classifyProgressionEligibility` excludes isolation and
trunk work — so the boundary layer never sees them and they keep generation's
own placeholder. **This is pre-existing and unchanged by this slice**, but it is
recorded here rather than left for someone to discover: a rotated accessory
showing `0` is not the same thing as "unset", and if Sam wants accessories
blanked too that is a NEW coaching decision, not an implementation detail.

## NO NEW FAILING SUITE — before/after against the clean control

Ten suites most likely to be disturbed, each run in BOTH the clean control
worktree at `67bbc4bd` and on this branch:

| suite | control | branch |
| --- | --- | --- |
| `variation` | 7 fail | 7 fail |
| `session-outcome-parity` | 1 fail | 1 fail |
| `composer-b1` | 3 fail | 3 fail |
| `strength-progression-inputs` · `progression-capacity-laundering` · `workout-log-progression-wiring` · `generated-week` · `generated-week-assembly` · `weekly-scheduler` · `block-override` | 0 fail | 0 fail |

`test:compile` — 468 errors, same 6 files worse, **byte-identical to the clean
control**. This slice adds zero type errors.

## Also tightened

`GOOD_RECOVERY_FEELINGS` / `GOOD_RECOVERY_SORENESS` were untyped string sets
written from memory. They are now typed to `FeedbackFeeling` / `FeedbackSoreness`
and verified against the real vocabularies (`FEEDBACK_FEELINGS`,
`FEEDBACK_SORENESS_LEVELS`). Untyped, adding a new soreness level would silently
land outside the good set — an athlete quietly stops progressing and the rule
looks like it is working. A probe fixture using `soreness: 'severe'` — a value
that does not exist — is what surfaced it.

---

## NEXT SESSION STARTS HERE

**SESSION 4 IS THE LAST ONE. Proof only — no new behaviour.**

1. `src/__tests__/blockTwoProgressionTests.ts` + a `test:block-two-progression`
   script, carrying the five guards Sam named:
   retained → smallest authorised progression · rotated → no inherited load ·
   no set/rep completion inferred · stored = visible = reloaded ·
   athlete B without qualifying history receives no progression.
2. **Each guard seen RED under mutation**, receipts recorded. The two probes
   already give the expected values, so a guard that cannot go red is an
   instrument fault, not a pass.
3. Retire the `variedProgramPersonaTests` sibling-transfer cells **in the same
   commit as their replacements**, per Sam's instruction, and name them.
4. Full 394-suite roster + the 180-world run (140 built / 40 refused).
5. **Only then** the registry rows — the gate ratchets on the UNENFORCED count,
   so a ruling registered before its guard reddens it.

**STATE: `blockBoundaryProgression.ts` is WORKING at the behaviour level and
BUILT at the guard level** — the behaviour is measured end to end by two probes
with a control, and NO committed guard fails if it breaks. That distinction is
the whole of what session 4 closes.

**This branch is not merge-ready and must not be merged.** The registry ruling
must not merge without its enforcement guard.

Agent: blocktwo

---

# SESSION 5 — FINAL LOAD AUTHORITY. INTEGRATION, NOT POLICY.

Sam, 2026-08-16 (final): *"DO NOT INVENT OR RE-RULE LOAD BEHAVIOUR... The
missing work is integration, not policy."* Two things this branch had authored
itself are now deleted and replaced by reads of his existing sources.

## The two superseded interpretations, and which one was dangerous

| retired | why it was wrong |
| --- | --- |
| *"rotated exercises are always blank"* | clause 2 gives an UNSEEN MAPPED exercise the authored anchor estimate. Blank is clause 4 only. |
| *"bodyweight has no weight field"* | **the damaging one.** It short-circuited authored-unloaded rows BEFORE reading history, so an athlete's recorded weighted Pull-Up would have been thrown away. |

The second is now a permanent guard AND a mutation (M7): restoring the
short-circuit reddens two cells.

## What replaced this branch's own policy

- **`SMALLEST_AUTHORISED_INCREMENT_KG = 2.5` + a barbell name-check → DELETED.**
  `smallestPracticalIncrementKg` reads `EQUIPMENT` (`data/equipmentLattice.ts`).
  The old constant answered 2.5 for every barbell and NOTHING for anything else,
  so a dumbbell or kettlebell lift would have held its load forever.
- **`null` from the lattice means HOLD, never a default.** Sam: *"if the
  equipment required for an optional external load is unknown, preserve the
  recorded load and leave the next choice editable rather than guessing."*
- **The athlete's recorded number is the base, unrounded.** M8 (rounding it
  through the lattice) reds.

## FINAL VERIFICATION

| run | branch | control @ `67bbc4bd` | verdict |
| --- | --- | --- | --- |
| `test:block-two-progression` | **21/21** | n/a (new) | 10 mutations RED |
| `test:ladder-wide` | **140 built / 40 refused**, 13/14 | **140 built / 40 refused**, 13/14 | **zero lost/gained** |
| `test:compile` | 468, 6 worse | 468, 6 worse | byte-identical |
| `test:ruling-registry` | 6/2, 97 rulings | 6/2, 95 rulings | ratchet unmoved; R-096/097 land ENFORCED |
| `test:variation` | 5 fail | 7 fail | 2 superseded cells retired, no new |
| `test:bible` | **crashes at suite 1** | **crashes at suite 1** | identical — see below |

⚠ **`test:bible` PRODUCED NO SIGNAL.** It dies at its FIRST suite with
`Cannot find module '../support/coachingPlanForTests'` — in the clean control
too. The chain stops at the first failure, so **nothing after suite 1 ran in
either tree.** It is unchanged by this branch and it is a pre-existing member of
the 163 baseline, but it must not be reported as a passing comparison: it is a
crash that compares equal, which is not the same as a baseline that held.

Agent: blocktwo
