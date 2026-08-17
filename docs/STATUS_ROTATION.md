# STATUS — seat `rotation`

Block Two: exercise rotation and preference pinning.
Base: `dda2747d` (clean `main`). Branch `feat/block-two-rotation`, isolated worktree.

## THE OWNERSHIP ANSWER — BEFORE

**There was no rotation owner. The only enforcer had been deleted.**

`composeWeek.ts:292`, in the repo's own words: *"the rule whose only enforcer,
`applyPoolRotation`, was deleted in the B2 rebuild."*

What replaced it was ONE LINE — `composeWeek.ts:1060`:

```ts
const step = Math.max(0, inputs.phaseClock.weekNumber - 1);
...
const identity = preferred[step % preferred.length];
```

**Selection was keyed by the PHASE WEEK NUMBER. The contract keys it by the
BLOCK.** That single substitution is the whole defect.

### `selectPoolEntry` / `selectPoolEntryAvoiding` HAVE ZERO PRODUCTION CALLERS

`src/data/exercisePoolsStrength.ts` still carries a full rotation implementation:
block/week cadence, pin bias, exclusion filter, injury filter, equipment filter,
`PoolRotationOutcome` refusals. **Every reference to it outside its own file is a
test or a comment.** `test:pools` (~1,175 lines) is green against code nothing
runs — `a-suite-can-test-code-nothing-runs` again, at scale.

`prefs.pinned` had the same shape: stored canonically in
`athletePreferencesStore`, displayed by `activeProgramModifiers`, and its only
selection reader was the dead `applyPrefsToPool`. **A pin changed nothing.**

## MEASURED BEFORE — real `generateProgramLocally`, full kit, Pre-season, 3 days

Blocks 1/2/3, each 3 build weeks + deload. Per pool slot:

```
horizontal_push/anchor  b1: w1 Bench Press  → w2 Incline Bench → w3 Close Grip Bench
horizontal_pull/anchor  b1: w1 Barbell Row  → w2 Chest Supported Row → w3 Single-Arm DB Row
hinge/anchor            b1: w1 Deadlift+RDLs → w2 RDLs
```

**Three different main lifts inside ONE build block.** The contract's *"main and
secondary lifts may remain for a second consecutive block"* was not merely
unimplemented — it was unreachable, because the athlete never met the same lift
twice.

## AFTER — same worlds, same instrument

```
horizontal_push/anchor  b1 Bench Press ×4 wks | b2 Incline Bench ×4 | b3 Close Grip Bench ×4
horizontal_pull/anchor  b1 Barbell Row ×4     | b2 Chest Supported Row ×4 | b3 Single-Arm DB Row ×4
hinge/anchor            b1 Deadlift ×4        | b2 RDLs ×4
```

Stable across all four weeks including the deload; rotates at the build boundary.

## WHAT LANDED

- **`src/rules/exerciseRotation.ts`** — new. `decideRotation()` is the one owner.
  Main lifts advance once per BLOCK, accessories once per WEEK, a deload holds
  the block's last build week. Retention reads the EXISTING progression decision.
- **`blockBoundaryProgression.progressedFromOwnHistory`** — the `history_progressed`
  condition, lifted out and exported so rotation READS it. `decideBlockBoundaryLoads`
  now calls it too: one owner of the predicate, two readers, no drift.
- **`composeWeek`** — `step` DELETED, not wrapped. Block identity, pins and the
  progressed set are now required inputs.
- **`generateProgram`** — threads block number, week-in-block, deload flag, pinned
  identities and the progressed set into the composer.

### The two-block cap stores nothing

NORTH_STAR: store only decisions. A retention is visible in the arithmetic —
the base cadence is a pure function of the block number, so
`retainedLastBlock(b) ⟺ selected(b-1) ≠ baseIdentity(b-1)`. No counter, which
matters because **this app regenerates the program on every boot**.

## GATES

`npm run test:compile` — 6 pre-existing `bibleConformance` failures.
**CONTROL RUN AT `dda2747d` IN A CLEAN WORKTREE: the identical 6.** My change adds
zero. The gate is red on `main` itself.

## STOP CONDITION CHECKED — NOT TRIGGERED

The mission: *"If current product copy promises that a pin overrides the two-block
maximum, STOP."* Swept `src/screens` and `src/components`: the only "pinned"
wording on glass belongs to `ExerciseVideoModal`'s demo videos — video pinning,
which the mission excludes by name. **No copy promises a pin overrides anything.**

## NOT COVERED YET

- Guard suite + mutation proofs (proofs 1-15).
- The four-block tables for the dumbbell/partial-kit athlete.
- Naming every production function that can still rewrite identity AFTER the
  decision (materialise → assemble → finalise → canonicalise chain).
- Whether to delete the dead `selectPoolEntry` family and its suite.
- `hinge/anchor` is absent entirely in block 3 of the traced world — presence, not
  identity. Unexamined; may be day composition, not rotation.
