# STATUS — seat `exclusions`

**Unit:** BLOCK TWO — EXERCISE EXCLUSION SCOPES. One athlete-facing vertical slice.
**Base:** `main` @ `f916a6fc`. **Branch/worktree:** `feat/block-two-exclusion-scopes`
at `/Users/samgeurts/Documents/lfa-worktrees/block-two-exclusions`.
**Contract:** `docs/BLOCK_TWO_PROGRESSION_CONTRACT_APPROVED_2026-08-16.md`,
"Athlete substitutions and exclusions". Lands in the implementation commit.

---

## WHAT THE SURVEY FOUND — the premise, checked before building

The order says "route every existing athlete-facing removal door through" one
owner. There were **two removal meanings and neither could express a scope**:

| where | what it stored | who read it |
| --- | --- | --- |
| `athletePreferencesStore.prefs.excluded: string[]` | a bare name, forever | **generation** (`generateProgram.ts:987` → `composeWeek.injuries.excludedIdentities`) |
| `coachUpdatesStore` `ActivePreferenceConstraint{avoid_exercise}` | a bare name, forever | **Status only** |

**DEFECT 1 — the day screen's "Future weeks too" was inert against generation.**
`DayWorkoutScreenV2.saveFutureExerciseAdjustment` wrote `add_exercise_preference
{ preferenceKind: 'avoid_exercise' }`, which lands on the *constraint* store.
`composeWeek` is fed from `prefs.excluded` and from nothing else. An athlete who
chose "Future weeks too" saw the exercise come straight back the next week.
(Fixed: removal now writes the canonical exclusion, which generation reads.)

**DEFECT 2 — ordinary substitution banned the original, permanently.**
`coachActions.setPreferredAlternative` called `addExclusion(canonicalExercise)`.
Sam's contract: *"An ordinary substitution changes the programmed row without
banning the original exercise."* One swap for one sore shoulder banned a lift
from every future program, with nothing to expire it and nothing telling the
athlete. (Fixed: it pins the alternative and bans nothing. Proof case 6.)

**DEFECT 3 — an exclusion gap blamed the kit.** Every `ComposedGap` was stamped
`cause: 'kit'`, including gaps an *exclusion* emptied — so the athlete was sent
to buy equipment for a hole only they could fill. (Fixed: `cause: 'kit' |
'exclusion'`, attributed by "would the kit ALONE have emptied it".)

**NOT A DEFECT — `selectPoolEntryAvoiding` is dead on the live path.**
`applyPoolRotation`, its only caller, was deleted in the B1/B2 rebuild. Its
exclusion fall-through ("if the pool empties, use the raw pool") reads like a
silent-restore bug and does not execute. Asked "who calls this?" first.

---

## WHAT IS BUILT

| file | role |
| --- | --- |
| `src/rules/exerciseExclusions.ts` | **NEW.** Pure. The decision's shape, the ONE `exclusionIsActiveOn` predicate, both week projections, upsert/restore, labels, legacy migration. |
| `src/utils/exerciseExclusionOwner.ts` | **NEW.** The ONE transaction owner. Stamps the block context, writes, returns typed result. |
| `src/store/athletePreferencesStore.ts` | `exclusions` is the stored fact; `excluded` is DERIVED for a date. Legacy fold at hydration, in `merge` (not `onRehydrateStorage` — boot would read an empty list for a tick). Wipe guard counts the decisions. |
| `src/services/api/generateProgram.ts` | `composerExclusionInput` — week-wide vs dated, resolved against the week being authored. |
| `src/rules/composeWeek.ts` | per-day exclusion sets; `attributeGap` gives the gap its real cause. |
| `src/utils/coachActions.ts` | ban routes through the owner and mints no second Status row; substitution stops banning. |
| `src/utils/activeProgramModifiers.ts` | `athleteExclusionModifier` — one row per active exclusion, everything derived. Two new action kinds. |
| `src/screens/home/DayWorkoutScreenV2.tsx` | removal lands on `exclusion_scope`, Sam's question with three answers. |
| `src/components/CoachNoteSheet.tsx` + `useCoachNoteActions.ts` | "Change scope" sheet and its route; "Restore exercise" reuses the clear route. |

## GATE PARITY — measured, both trees

`npm run test:compile` is **ALREADY RED ON `main`** (control run, same day): 6
`bibleConformance/observations/*` pairs fail on a missing
`src/__tests__/bibleConformance/support/coachingPlanForTests` — a module that
exists in **neither** tree and is not mine. My branch fails the **same 6 pairs
and no others**, TOTAL 468 both sides. **Ledger line, left alone.**

**DEFECT 4 — `composedGaps` had no reader.** The composer's typed disclosure has
been written by `materialiseComposedWeek`, protected as composer-owned by
assembly (2026-08-14) and carried through boot — and **no screen ever rendered
it**, because it was never declared on `Workout` and could only be read through
an `as any`. The "carry" half was built and guarded; the "display" half did not
exist. (Fixed: declared on `Workout` with a named writer/reader/test, rendered
by `ComposedGapNotice`.)

## PROOF

`npm run test:exercise-exclusions` — **51 cells, ALL PASS.** Liveness receipt
printed each run: subject `Single-Leg RDL`, **8 appearances** in the real
generated block, **39 distinct** strength exercises.

**MUTATION: 13 of 13 killed.** One first read as SURVIVING and the fault was the
instrument — its replacement text contained `//`, which terminated perl's own
`s///`, so the file never changed. Re-run with a valid replacement it kills 2
cells. *A half-mutation proves nothing.*

## LEDGER — pre-existing, outside this flow, LEFT ALONE

1. **`test:compile` is already red on `main`.** 6 `bibleConformance/observations/*`
   pairs fail on a missing `src/__tests__/bibleConformance/support/coachingPlanForTests`,
   a module in **neither** tree. Control run on `main` the same day: identical 6
   pairs, TOTAL 468. My branch: identical 6 pairs, TOTAL 468. **Zero delta.**
2. **A stale stored program poisons the NEXT block's authoring.** Generating
   block 3 while `programStore.currentProgram` still holds block 2 refuses with
   `sprint_high_speed_required_minimum:0`. Measured with NO exclusion anywhere:
   `as-is REFUSED / null-program OK / null-anchor REFUSED / null-both OK` — so
   it is the stored PROGRAM, not the anchor.
3. **Generation and post-generation validation disagree about the conditioning
   maximum.** Any active-constraint write re-validates the current program and
   throws `Section18WeekAcceptanceError: maximum_breach:conditioning:6` on a week
   `generateProgramLocally` had just produced and accepted. No exclusion involved.
4. **`test:law-registry` is already red on `main`** — same 2 failures, 21
   UNENFORCED laws, unchanged by this unit (126 → 128 rows, both new rows
   `guarded`).

## OPEN

- wider gates (Block Two suites, boot/persistence, `test:ladder-wide`)
- device pass: the three-option sheet and the gap notice on glass
