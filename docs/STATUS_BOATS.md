# STATUS — seat `boats`

**Mission (Sam, 2026-08-21):** the FINAL Burn the Boats cleanup, from current
`main`. Remove genuinely dead legacy code without changing current app
behaviour. Sam is using the app separately; his product notes are explicitly
NOT this mission, and the physical-phone acceptance pass is deferred.

**Branch:** `demolition/final-boats`, cut from `main` @ `01306539`.
**Control:** `scratchpad/wt-ctl`, detached at `01306539`, never edited. Every
number below is a comparison against it.
**Uncommitted work in the shared checkout** (`docs/printed-weeks/*.md`, two
`.fuse_hidden*`, `docs/STATUS_PHONEPASS.md`) was never touched — the work is
worktree-isolated and every commit was made BY PATH.

---

## THE INSTRUMENT, AND WHY THE OLD ONE WAS NOT ENOUGH

`scratchpad/tools/graph.js` + `runtime.js` — ABSOLUTE root only, and every run
carries positive controls (`composeWeek`, `programStore`, `DayWorkoutScreenV2`,
`SessionActionSheet`, `injurySessionAdjustment`). The first run reported
`DayWorkoutScreenV2` UNREACHABLE; the file is at `screens/home/`, not
`screens/`. **A control that had not been checked would have made the whole
census a confident lie.** 0 unresolved specifiers.

**THE MEASUREMENT THAT FOUND EVERYTHING: RUNTIME reachability, not import
reachability.** A module reached from `App.tsx` only through `import type` is
ERASED AT COMPILE TIME — it has a production importer, it survives a caller
census, and it never executes on a device.

    src files                                   1148
    reachable from App.tsx (type-inclusive)      559
    RUNTIME-reachable (value imports only)       552
    reached ONLY by type-only imports              7

Of those 7, four are type modules by design (`types/decisionLedger`,
`types/fixtureMutation`, `types/programControlAction`, `utils/injuryProgression`).
**The other three were whole authorities that had not run in production for
however long.** Three of the four families below are exactly those three.

---

## WHAT WAS DELETED — 4 FAMILIES, 2,399 LINES, 116 BACK

| # | family | evidence it was dead | surviving owner |
| --- | --- | --- | --- |
| 1 | `utils/recoveryRules.ts`, DELETED WHOLE (121) | ZERO importers in `src/`, `scripts/`, `App.tsx`. Its only call site — the resolver's ninth recovery-placement pass — was removed earlier under the optional-placement law; `sessionResolver.ts:1561` still carries that pass's headstone naming `resolveRecovery` | empty days stay empty; the athlete's own recovery door |
| 2 | `rules/recoveryAddonCoverage.ts`, 714 → 29 | type-only reachable, so zero runtime execution. 13 of 15 exports had no consumer of any kind outside the file; its `RecoveryAddonCountingFence` was a DUPLICATE of the one production reads from `types/domain.ts` | `types/domain.ts` (shape + fence), `rules/testingBias.ts` + `rules/programmingBias.ts` (which focus area), `utils/sessionComponents.ts` → `DayWorkoutScreenV2` (what the athlete sees) |
| 3 | `utils/coachReadinessAdapter.ts`, 219 → 35 | type-only reachable. Both production importers take `PendingReadinessClarifier` as a TYPE and nothing else | `utils/coachCommandRouter.ts` → `utils/coachTurnController.ts` decide what a turn is; `store/readinessStore.ts` + `commitReadinessStateTransaction` own the state |
| 4 | `utils/constraintPlan.ts`, 637 → 63 | type-only reachable, AND the single production site that supplies the list (`utils/coachDispatchDeps.ts:113`) passes `plans: []` | `utils/exposureEngine.ts` (what a constraint blocks + week validation), `utils/coachConstraintProducers.ts` (producing them), `utils/verifiedCoachCommunication.ts` (what may be claimed) |

Every kept symbol is named in a docblock at the head of the file it stayed in,
with what went and who owns it now.

### ⚠ THE MUTATION THAT SAVED FAMILY 3 FROM BEING KEPT ON A FALSE COST

`test:coach-live-readiness-priority` — 152 green cells, in the bible chain —
imports `routeCoachReadinessMessage`. On its face, deleting the router costs
152 cells, which is a good reason to walk away. **So it was measured instead of
assumed:** the router was neutered to always return `{ kind: 'pass' }` and the
suite re-run. **It reddened NOT ONE CELL.** The suite calls it from a `route()`
helper of its own and asserts nothing about the answer. The cost was zero, and
believing the import would have preserved 130 lines of dead phrase-regex.

### TESTS DISPOSED — BY SUBJECT, NEVER BY CONVENIENCE

- `recoveryAddonCoverageTests.ts` (317 cells) — subject was ONLY the deleted
  recommender. Suite + `test:recovery-addon-coverage` off the bible chain.
- `constraintPlanTests.ts` (480 lines) — subject was ONLY the deleted builder,
  **and it was already dead**: on `main` it throws at its own line 340 and
  reports no totals. Suite + `test:constraint-plan` off the chain.
- `coachTruthGateTests.ts` — pointed at the empty plan list production actually
  passes. 61/0 → 59/0. FOUR cells whose subject was the deleted builder went,
  including one CONDITIONAL cell (`bike/row mention sits after the "Optional"
  framing`) that would otherwise have gone **silently vacuous rather than red**.
  TWO cells stating the production truth arrived in their place. The live half
  of that section — what may be CLAIMED as applied, and the fabricated-reply
  rejection — is untouched.
- `data/readinessStructureCensus.ts` — two rows retired under that file's own
  rule that *"a census must also be able to die"*. Both were verdict `dose`, so
  the structure-debt baseline is untouched. 100/100 → 88/88, 0 failures.

---

## CHECKS — CANDIDATE vs THE CONTROL TREE AT `01306539`

| instrument | control | candidate | verdict |
| --- | --- | --- | --- |
| RUNTIME-reachable src files | 552 | **552** | unchanged |
| `test:compile` `[product]` | 30 | **30** | identical |
| `test:compile` `[devtools]` | 50 | **50** | identical |
| `test:compile` `[tests]` | 593 | 595 | +2, both in suites ALREADY dead at import |
| `test:compile` worse file/scope pairs | 77 | **76** | improved |
| `test:scenarios` | 12 failed | 12 failed | **output byte-identical, paths normalised** |
| `test:coach-truth-gate` | 61/0 | 59/0 | 4 subject cells out, 2 truth cells in |
| `test:readiness-structure-law` | 100/100 | 88/88 | 2 dead census rows retired |
| `test:coach-live-readiness-priority` | 152/0 | **152/0** | parity |
| `test:ladder-wide` | 14/14 | **14/14** | parity |
| `test:readiness-dose-sweep` | 105/0 | **105/0** | parity |
| `test:law-registry` | 12/2 | 12/2 | **identical failure TEXT** |
| `test:repo-law-guards` | 54/9 | 54/9 | **identical failure TEXT** |
| `test:ruling-registry` | 6/2 | 6/2 | **identical failure TEXT** |

The three mandatory repository guards were diffed by failure TEXT, not by
totals. Four suites die at import on BOTH trees and are not this branch's blast
radius: `test:readiness`, `test:injury-severity-bands`, `test:midline`,
`test:severity-scale`.

**THE +2 COMPILE ERRORS, STATED PLAINLY.** `readinessSignalTests.ts` and
`injurySeverityBandTests.ts` already carried dangling imports to modules the
PREVIOUS burn deleted (`weeklyCoachUpdate`, `trainAroundEngine`,
`injuryWorkoutFilter`), and already reported nothing. They now carry one and two
more of the same kind. They were NOT deleted: their subject includes live
`utils/readiness`/`readinessConstraints` and `rules/injurySeverityBands`, so
they are not "a test that protects only an implementation being deleted", and
seat `demolition` recorded 34 such suites as preserved on purpose for a rebuild
phase.

---

## REMAINING LEGACY THAT COULD NOT BE PROVEN DEAD

1. **The plan-line rendering inside two LIVE coach composers.**
   `utils/coachReplyComposer.ts` and `utils/verifiedCoachCommunication.ts` draw
   Avoid / Sub-in / Keep / physio lines from `plan.avoid` etc. With no producer
   left, those branches are unreachable — but they are branches inside a live
   reply path, and cutting them is a behaviour edit at a live owner, not a
   deletion. **Owner: whoever next owns the coach reply.**
2. **~220 individually-unreferenced value exports inside otherwise-live
   modules** (measured: `prod=0, dev=0, self<=1`). Each is a helper or constant,
   not a family; deleting them one at a time is churn against live files for no
   behavioural gain. The list is reproducible from the instruments.
3. **The census / ratchet data modules** — `data/legacyReckoningCensus.ts`
   (1,355 lines), `data/bibleThresholdAnchors.ts`, `data/provenancePendingLists.ts`,
   `rules/featureRegistry.ts`, `rules/onboardingFieldInfluence.ts`,
   `rules/exerciseNameLiteralSweep.ts`, `utils/weekLogBuilder.ts`. Unreachable
   from `App.tsx` and read only by their own guards **because that is what they
   are** — they hold ratchets that only fall. Deleting one deletes a ratchet.
4. **Sam's built-but-never-wired work — DO NOT DELETE, restated from seat
   `demolition`'s FINDING 0**: `rules/mobilityPairing.ts`,
   `rules/weeklyCompleteness.ts`, `rules/weekPreferenceShape.ts`,
   `rules/sessionTypeCharter.ts`, `data/timeTrialSession.ts`, `utils/masCopy.ts`,
   `rules/lawRegistry.ts`. A reachability-keyed pass deletes the mobility work
   Sam is angry is still missing.
5. **The suites dead at import from the previous burn.** Four were met here;
   seat `demolition` recorded 34. They are dark, not deleted, on purpose.

## MIGRATIONS — THERE WAS NOTHING LEFT TO DECIDE

Grepped for every migration the previous seat left open
(`migrateLegacyTemporarySourceFacts`, `migrateLegacyWeeklyExposureContractV2`,
`migrateLegacyExcludedNames`, `migrateLegacyInjuryEpisodes`,
`migrateLegacyReductionV2`, `migrateLegacyUserRemovalConstraint`,
`deriveLegacyInjuryFromEpisodes`, `composeCoachAdjustmentReplyLegacy`): **zero
matches in production on current `main`.** They are already gone. **No migration
was touched by this branch**, which matters because Sam has the app installed
with real persisted data right now — a read-ingress migration deleted this week
would be deleted against a live install.

## THE TWO OPTIONS WEIGHED

**(a) sweep every unreferenced export** — ~220 symbols, ~2,000 more lines, but
each one is a hand-edit inside a live module, the proof is per-symbol rather
than per-family, and the blast radius is every suite that touches those files.
**(b) whole families with a single, checkable proof** — take only what an
independent measurement (RUNTIME reachability) shows never executes, one family
at a time, each with a named surviving owner. **(b) was taken**: the same lines
come out with one proof per family instead of 220, and nothing live is edited
except four test cells whose subject was deleted.

## NOT COVERED

- **No simulator, no device, no rebuild, no relaunch.** Ordered deferred; every
  claim here is headless. **NOT-VISIBLE: nothing on this branch changes what the
  athlete sees** — the scenario harness output is byte-identical to the control.
- **No full 405-suite sweep** and no release matrix. Only the blast-radius set,
  the mandatory repository guards and `test:compile` were run, as ordered.
- **The four suites already dead at import were not investigated or restored.**
- **Sam's product notes were not read, investigated or acted on.**
- **Nothing merged.** The candidate waits for Sam.

Agent: boats
