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

## NEXT SESSION STARTS HERE

1. Build athletes A and B on `equipmentAnswerFixture` + a non-refusing day-set;
   prove generation succeeds for both BEFORE asserting anything.
2. Drive the real spine end to end; record A's history through the real session
   outcome door, not by writing `sessionFeedback` directly.
3. Resolve Block 2 — **resolve, do not just generate** — and diff against Block 1.
4. Guards last, each seen red under mutation.

**Nothing is claimed WORKING yet. Nothing beyond the onboarding commit has been
written.**

Agent: blocktwo
