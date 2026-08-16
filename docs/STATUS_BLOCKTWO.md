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

## NEXT SESSION STARTS HERE

1. **Feed the existing freeze.** Thread the real `sessionFeedback`,
   `weightOverrides` and `blockState` into `bakeMicrocycleStrengthProgression`
   at `generateProgram.ts:1460`, with `decideBlockBoundaryLoads` deciding
   retain/rotate/increment. The athlete fixture is already proven
   (`scripts/probe-block-two.ts`).
2. **Stop the second derivation** so the resolver does not re-write what the
   freeze decided — this is Sam's *"do not preserve the projection-time rewrite
   as the new authority"*.
3. Drive the real spine end to end, recording A's history through the real
   session-outcome door rather than writing `sessionFeedback` directly.
4. Guards, each seen red under mutation. **Then** the registry rows.
5. Retire the two `variedProgramPersonaTests` cells that assert the retired
   sibling-transfer behaviour, and say so in the report.

**Nothing is claimed WORKING. `blockBoundaryProgression.ts` is BUILT — the code
exists and compiles clean; no guard checks it yet and nothing calls it.** The
end-to-end proof, the mutation receipts and the 180-world run are all unrun.
**This branch is not merge-ready and must not be merged.**

Agent: blocktwo
