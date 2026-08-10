# CUT (d) CENSUS — THE TREE IS ALREADY DEAD, AND NINE SUITES ARE STANDING ON IT

**LOOP CHECK:** `deleting-a-composer-deleted-the-reconciler` — **sighting 2** (the
2026-07 branch that held when a composer deletion took its reconciler with it; this).
**COMPRESS: the census that matters before a deletion is not of the module's
IMPORTERS but of everything that READS IT — including suites that read it as SOURCE,
which no import graph can see.** Nine such readers here, and an import-graph census
would have reported zero.

Seat inbox item 1(d), 2026-08-10. Sam: *"delete all the old coach shit then?
obviously!!!"*. Censused before removal per `LAW-census-before-retirement`.
**No code was cut.**

## FINDING 1 — THE TREE IS ALREADY UNREACHABLE, SO THE SAVING IS LINES, NOT BEHAVIOUR

`CoachStackNavigator` is **defined at `AppNavigator.tsx:94` and never mounted** —
grep over the file returns the definition and two comments, no `<CoachStack…>` inside
any navigator. `CoachScreen` is imported by **exactly one product file**
(`AppNavigator.tsx:10`) and used only by that unmounted navigator.

So nothing routes to it today. Deleting it removes ~6,000 lines and one import; it
changes no athlete-visible behaviour. **Good news for the risk, and worth saying
plainly: this cut cannot break the app by removing a path the athlete uses, because
there is no such path.**

## FINDING 2 — THE BLOCKER: NINE SUITES READ THE FROZEN SCREEN'S SOURCE

Deleting `src/screens/coach/CoachScreen.tsx` makes every suite that reads it by path
crash on load. **This is the exact defect retired hours ago** —
`test:coach-update-card-ui` read a component deleted in `2df51650`, crashed ENOENT,
and sat in two release checklists for twelve days.

Readers found:

`athleteActionTraceV2Tests` · `coachClassificationOwnershipTests` ·
`coachEntrySurfaceContractTests` · `coachFailureCopyContractTests` ·
`coachFixtureReplyObservationTests` · `coachProgramSetupEditTests` ·
`envConfigTests` · `motivationGoalsTests` · `onboardingColdStartTests`

**At least three are `test:bible` chain members** (`test:coach-entry-surface`,
`test:coach-failure-copy`, `test:motivation-goals`). **An import-graph census would
have reported ZERO dependents** — these read the file as text, not as a module, which
is why the shape of the census matters more than its size.

## FINDING 3 — LR-6 SAYS THE OPPOSITE, AND IT HAS NO REGISTRY ROW

`AppNavigator.tsx:206` states it as a standing rule: *"LR-6 HOLDS:
`CoachStackNavigator`, `CoachScreen` and the pipeline stay."*
`coachEntrySurfaceContractTests` §3 encodes it as a contract — it asserts **every
pipeline symbol CoachScreen owned is still named there**, so the suite's whole job is
to fail if this cut happens.

**Sam's *"obviously!!!"* supersedes LR-6, and that is taken as ruled, not asked.**
But the retirement has to be DELIBERATE and recorded, because:

> **`grep LR-6 src/rules/lawRegistry.ts` returns ZERO.** LR-6 is a live standing
> rule with a chain gate encoding it and **no registry row**. Deleting its guard
> would be invisible to the registry — a law disappearing without anything noticing,
> which is the precise failure the registry exists to prevent, arriving from the
> deletion side rather than the drafting side.

**This is also a gap in LAW ZERO's coverage worth naming:** the registry catches a
law with no guard. **It does not catch a guard whose law was never registered.** The
sweep found laws with no rows; nothing yet finds GUARDS with no rows.

## WHAT THE CUT ACTUALLY IS, IN ORDER

1. Give LR-6 a registry row, then **retire it in the same commit** citing Sam's
   ruling — so the supersession is a recorded event rather than a silent deletion.
2. Re-aim or retire the nine source-readers. Each needs a decision: does the cell
   still have a subject after the file is gone, or is it vacuous?
3. Cut `AppNavigator.tsx:10`, the `CoachStackParamList` type, `CoachStack`, and
   `CoachStackNavigator`.
4. Delete the module set, then sweep and compare FAILURE SETS against the 4-of-177
   baseline.

**`coachBuildInfo` is a non-issue** — the order says `App.tsx:7` imports it "from
that set at module scope" and to move it first. It imports only `./logger` and roots
nothing in the coach tree. No move needed.

## NOT COVERED

**The 13-module / 6,081-line list in the order is NOT verified here** — this pass
censused the ENTRY and the READERS, not the tree's membership. The nine readers were
found by a source-text grep for the screen's path; **other frozen-tree files may have
their own readers and were not swept.** Cut (c), the V1 home screen, is not
censused. No code was deleted and no suite was run against a cut.
