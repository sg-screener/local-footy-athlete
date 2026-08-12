# STOP — THE HIDDEN SESSION WAS THE SEED, AND MY 0e DIAGNOSIS IS WITHDRAWN

**LOOP CHECK:** *a rename that leaves its references behind* — **sighting 1** as
a named class, but it is the same family as `week-identity-two-owners` and
`fixture-identity`. **Disposition: ITERATE**, and the iteration is that the rule
is now written at the code that renames ("identities may change here, CONTENT may
never") and held by a cell, rather than left as a lesson.

**HEAD:** `0ab0c18d` on `main`. Branch verified immediately before the commit.
**Sam's two instructions were both obeyed:** fix the hidden session, and **do not
drive the simulator** — nothing in this pass touched it.

---

## 1. THE CORRECTION, FIRST AND PLAINLY

**0e reported: "today's card does not draw everything today holds — the athlete
has a conditioning session they cannot see." THAT IS WRONG AND IS WITHDRAWN.**

The card draws everything the day holds. **The day it was drawing was wrong**,
and only in seeded test worlds.

The observation behind the claim was real — on the seeded world, deleting the
strength part revealed a conditioning part that had not been drawn. The inference
from it was not. I attributed to the projection what belonged to the fixture.

## 2. WHAT IS ACTUALLY BROKEN

`stabilizeMicrocycle` (`src/dev/e2e/devE2ESeedRegistry.ts`) rewrites **every**
exercise row id so a dev seed is reproducible:

    cond-2026-07-13-main
      -> dev-e2e-lower-body-deletion-2026-07-13-dow-1-exercise-cond-2026-07-13-main-4

Nothing rewrote the things that **point at** those ids, and there is exactly one
such thing in a workout — measured by walking the whole object and asking which
strings equal a row id:

    workout.conditioningBlock.options[].exerciseIds

So `conditioningIdsFromBlock` matched nothing, `legacyConditioningTailIds` did
not recognise "Brisk Walking" by keyword, and the walk fell into `strengthRows`.
`getSessionComponents` then reported **one** component for a day that has two.

**23 OF 23 SEEDED WORKOUTS CARRYING A CONDITIONING BLOCK WERE AFFECTED. Every
seed, not a sample.**

## 3. WHY NO PRODUCT CODE CHANGED, AND HOW THAT WAS ESTABLISHED

The raw generated program was measured in the same pass, before stabilisation:

| | block ids resolving | components |
| --- | --- | --- |
| **Generator output (what an athlete gets)** | **4 of 4** | `strength, conditioning` |
| **Seeded world (before this fix)** | **0 of 23** | `strength` |
| **Seeded world (after this fix)** | **23 of 23** | `strength, conditioning` |

**No athlete was ever affected.** The defect lived in the instrument, which is
why every source-reading suite passed over it for as long as it existed and only
driving a seeded app could see it.

**AND THE COST IS BIGGER THAN THIS BUG.** Every seeded world was a world no
athlete is in, on exactly the axis `.claude/rules/suites-and-fixtures.md` names:
a fixture whose input could never have existed proves something false. Any suite
or flow that seeded and then reasoned about conditioning was reasoning about a
day the app would never build.

## 4. THE FIX, AND WHY IT IS A MAP AND NOT A FIELD

One `Map<oldRowId, newRowId>` built where the ids are minted, and the block's
references rewritten through it. The rule is stated at that code as a general
one — **identities may change in the stabiliser, CONTENT may never** — because
the next field to point at a row id will arrive exactly the way this one did.

**PROVEN WITHOUT GLASS**, at the surface contract rather than the component:
`projectParts` for that Monday now returns

    2026-07-13:strength      kind strength
    2026-07-13:conditioning  kind conditioning

and returned only the first before the fix. That is the day card's own input.

## 5. WHAT HOLDS IT

`test:dev-e2e-seeds`, three cells, in the chain:

1. **Anti-vacuous** — at least 20 seeded workouts must still carry a conditioning
   block. Without it, "every id resolves" passes on nothing to resolve.
2. **The cause** — every block id resolves to a row on its own workout.
3. **The consequence** — every such workout still reports a `conditioning`
   component. Asserting the id alone would pass on a classifier that had stopped
   reading the block at all.

**MUTATION:** dropping the rewrite while keeping the cells reds 2 and 3 and
leaves 1 green, which is what each is for.

Registry row `LAW-rename-carries-its-references`, born guarded. **101/69 →
102/70; UNENFORCED unmoved at 32.**

## 6. NORTH STAR

**Toward it.** The seed stored a derived classification implicitly — "which rows
are conditioning" survived only as a pointer that the stabiliser silently broke.
The fix keeps the single source (the block) authoritative and makes the pointer
travel with the rename, so the classification stays DERIVED from one owner
instead of half-remembered in two.

## 7. NOT COVERED

- **NO SIMULATOR RUN, BY INSTRUCTION.** Sam, 2026-08-12: *"don't drive the
  simulator, Claude Code owns it."* The `lower-body-deletion.yaml` re-run is
  **OWED** and recorded in `docs/GOLDEN_FLOW_RUN_RECEIPT.md`. Its restored
  assertion matches the measured component list but has not been seen on glass.
- **THE OTHER 22 SEEDED WORKOUTS ARE FIXED BY MEASUREMENT, NOT BY EYE.** The
  count is from the same probe both ways; no seed other than
  `lower-body-deletion` was opened on a screen.
- **`legacyConditioningTailIds` IS UNTOUCHED AND STILL KEYWORD-BASED.** It did
  not recognise "Brisk Walking", which is why the block was the only thing
  standing between the athlete and a misfiled row. That fallback is a
  name-matching heuristic in a repo that has ruled against them; **named, not
  fixed** — it is its own unit.
- **THREE REDS IN THIS TREE ARE NOT MINE**, each measured against HEAD rather
  than assumed: `test:dev-e2e-seeds` and `test:dev-e2e-scenario-session` share a
  pre-existing "manifests add no seed families" failure (identical name at HEAD;
  my change moves that suite 57 → 60 passed with the failing set unchanged);
  `test:compile` is red only on the other agent's untracked
  `fixtureSettleAfterSetupTests.ts`; and the orphan-flow guard now names their
  untracked `.maestro/tmp-gameday-verify.yaml`.
- **NO FULL SWEEP.** Ten seed-consuming suites were run by name and are green;
  the chain was not swept end to end.
