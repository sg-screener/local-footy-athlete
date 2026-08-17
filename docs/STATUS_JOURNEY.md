# STATUS — seat `journey`

Claimed 2026-08-17. Name checked against `ls docs/STATUS_*.md` at claim time —
`JOURNEY` was free (30 other status files exist; none is this name).

Mission: **COMPLETE ATHLETE JOURNEY** — cold start → onboarding → Block 1 →
athlete actions and feedback → program adjustment → Block 2 → restart/rebuild,
proven on ONE real athlete through production doors. Base `main @ a4ef85be`,
branch `feat/complete-athlete-journey`, worktree `scratchpad/wt-journey`.
CAP 4 sessions.

## THE CONTRACT THIS MISSION ANSWERS TO

`docs/BLOCK_TWO_PROGRESSION_CONTRACT_APPROVED_2026-08-16.md` (approved by Sam
2026-08-16) is the authority for six of the seven proofs the mission names —
progression order, rotation at block boundaries, the three exclusion scopes,
substitution-without-banning, missed-session handling, and the
difficult/readiness reduction order. **Where a historical assertion contradicts
that document, the document wins.** Its own §"Implementation boundary" says its
typed rules, registry entries and mutation-proven guards land together, which is
this mission.

## INSTRUMENTS THAT ALREADY EXIST — reused, not rebuilt

| instrument | what it already does | why it is not enough alone |
| --- | --- | --- |
| `scripts/simulate-changeover.ts` (`sim:changeover`) | fresh install → onboarding → generate → walk the clock a day at a time → real rollover → real completion writer | its install path is a SECOND COPY of boot's job and drops `recordSelections` (below) |
| `scripts/print-week.ts` (`print:week`) | the real read chain offline, plain-English athlete words, exports `runScenario` / `scheduleStateFor` | prints a week, does not walk a life |
| `src/__tests__/blockTwoExplanationDeliveryTests.ts` | block 1 accepted → 12 recorded sessions → block 2 → the ATHLETE-FACING read chain | rolls the block with `acceptBlock`, not through `rolloverProgramBlock` |

**The doors, confirmed by reading production callers (not recalled):**

- onboarding: `useProfileStore.updateOnboardingData` + `completeOnboarding`
- **block 1 generation IS BOOT.** `appHydrationGate.ts:189` calls
  `runQuiescentBoot()`; `quiescentBoot.ts:532` is the `generateProgramLocally`
  call, with `recordSelections: true`. The program is never persisted — boot
  regenerates and replays the ledger.
- rollover: `getProgramBlockRolloverStatus` → `rolloverProgramBlock`, which
  delegates to `rebuildLocalWeek(scope:'block')` — `weekRebuild.ts:649` records
  selections and `:665` threads `progressionHistory` from the store.
- session outcome: `commitSessionOutcomeTransaction` (the one live writer)
- exclusions: `applyExerciseExclusionDecision` (`utils/exerciseExclusionOwner.ts`
  — its own header says three doors call it and no fourth exists)
- program edits: `executeProgramControlActionDurably` over
  `ProgramControlActionType` (`swap_exercise`, `remove_exercise`, readiness
  setters, …)

## MEASURED AT BASE — `feat/complete-athlete-journey` @ a4ef85be

### 1. `npm run sim:changeover -- --profile logs_every_weight`

20 sessions recorded, 0 refused, 0 threw, 0 rollover problems, 2.5s.

| census | value |
| --- | --- |
| days of feedback stored | 20 |
| of those, carrying a per-exercise strength log | 5 |
| days the athlete typed in a load | 15 (40 loads) |
| entries the progression reader SEES | 4 |

**Verdict printed by the script: `NOTHING MOVED`.** All 7 weekdays identical
between its week 1 and week 5 — same session names, same exercise names, same
sets, same reps, **same loads**.

### 2. `scripts/tmp-probe-journey.ts` (temporary; deleted before commit)

The rollover DOES happen and is not the missing piece:

```
microcycles: 2026-07-13 2026-07-20 2026-07-27 2026-08-03
blockState after commit: {"blockStartDate":"2026-07-13","blockNumber":1}
week 4 (2026-08-10): needsRollover=true current=1 next=2 nextStart=2026-08-10
   -> rolledOver=true refusal=null
      newWeeks=2026-08-10 2026-08-17 2026-08-24 2026-08-31
      explanationRows=20
   blockState now: {"blockStartDate":"2026-08-10","blockNumber":2}
```

Two facts worth carrying forward:

- **The sim's "week 5" is block 2 WEEK 2, and its "week 1" is block 1 WEEK 2.**
  Its `firstWeekStart` is `microcycles[1]`, so the labels are offset by one
  block week. Any conclusion drawn from that pair must say so.
- **20 explanation rows were stored with NO history recorded at all** in this
  probe. A block boundary that explains twenty things to an athlete who has
  logged nothing is worth a look; not yet diagnosed.

### 3. THE FIRST NAMED DEFECT — and it is in the HARNESS, not the product

`simulate-changeover.ts:513` generates the first program with
`generateProgramLocally(...)` directly and **never passes
`recordSelections`**, so it defaults false and **block 1's selections are never
recorded**. Production does not do this: every committing caller
(`quiescentBoot.ts:535`, `acceptedStateTransaction.ts:1953`,
`profileProgramTransaction.ts:205`, `weekRebuild.ts:649`,
`temporarySourceFactTransaction.ts:534`) sets it true.

**So block 2 rotation had no block-1 history to rotate away from.** That is a
candidate explanation for `NOTHING MOVED` and it is NOT yet established as the
whole of it — progression and rotation are two claims and this measurement
separates neither. Recorded here so the next reader does not bank it.

**⚠ THE STANDING TRAP THIS SITS ON:** `a-conclusion-outlives-the-world-it-was-
measured-in`. Every number above came from this worktree at this HEAD.

## WHAT I HAVE NOT TOUCHED

No production file yet. `git status` before every commit; `git commit --
<pathspec>` only.
