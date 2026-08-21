# STATUS — seat `boats`

**Mission (Sam, 2026-08-21):** the FINAL Burn the Boats cleanup, from current
`main`. Remove genuinely dead legacy code without changing current app
behaviour. Sam is using the app separately; his product notes are explicitly
NOT this mission, and the physical-phone acceptance pass is deferred.

**Branch:** `demolition/final-boats`, cut from `main` @ `01306539`.

## MERGED — `f7f732d8`, 2026-08-21. Rollback tag `pre-final-boats-2026-08-21` @ `01306539`.

Sam approved on the second report, with two conditions: leave `test:midline` and
`test:severity-scale` alone (done — both untouched, both still dead on the
PREVIOUS burn's `blockAdjuster` / `trainAroundEngine`), and preserve every
unrelated change (done — all 14 dirty files in the shared checkout, 11 modified
and 3 untracked, verified BYTE-IDENTICAL by sha256 taken before and after the
merge). No rebuild, no simulator, no release matrix.

**VERIFIED ON MERGED `main`, not on the branch:**

    files deleted           4 gone, 4 trimmed files at their intended length
    executable references   ZERO anywhere to anything this branch deleted
    runtime-reachable       552 — unchanged
    test:compile [product]  30, [devtools] 50 — identical to pre-merge
    test:compile [tests]    593 -> 588, worse pairs 77 -> 74
    test:scenarios          output byte-identical to pre-merge
    the three repo guards   identical failure TEXT to pre-merge
    test:readiness          33 / 0     (was DEAD at import)
    test:injury-severity-bands 31 / 0  (was DEAD at import)
    coach-truth-gate 59/0 · readiness-structure-law 88/88 ·
    coach-live-readiness-priority 152/0 · ladder-wide 14/14 ·
    readiness-dose-sweep 105/0

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
| `test:compile` `[tests]` | 593 | **588** | **5 fewer — zero added** |
| `test:compile` worse file/scope pairs | 77 | **74** | 3 files LEAVE the list, none joins |
| `test:readiness` | **DEAD at import** | **33 / 0** | was reporting nothing on `main` |
| `test:injury-severity-bands` | **DEAD at import** | **31 / 0** | was reporting nothing on `main` |
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

## SECOND PASS — THE TWO SUITES THAT GAINED DIAGNOSTICS, NAMED AND SETTLED

The first pass left `readinessSignalTests.ts` and `injurySeverityBandTests.ts`
carrying two more dangling imports and called it acceptable because both were
ALREADY dead at import from the 2026-08-19 burn. Sam refused that: name them,
decide per file, repair or delete, leave nothing dark. **Both hold live
behaviour, both were repaired, and BOTH NOW RUN for the first time since that
earlier burn.**

| file | verdict | what happened |
| --- | --- | --- |
| `readinessSignalTests.ts` | **holds live behaviour** | sections [1]-[6] are `utils/readiness` + `utils/readinessConstraints`. [8] (17 cells against the deleted readiness router) deleted with its subject. [7] SPLIT: the label cell re-sited onto the live owner that writes it (`readinessConstraints.ts:105`), the two weekly-card cells removed and **not** re-sited. **DEAD → 33 / 0** |
| `injurySeverityBandTests.ts` | **holds live behaviour** | the five severity doors that still exist are kept and asserted; three that do not (`injuryProgression.severityToTier`, `trainAroundEngine.severityToTier`, `buildConstraintPlans`) removed with their rows; the `injuryWorkoutFilter` pair removed and **not** re-sited. **DEAD → 31 / 0** |
| `recoveryWiringTests.js` | **only the deleted implementation** | DELETED WHOLE (539 lines). All 17 sections verify "Pass 3 (recovery)" in the resolver — the pass that no longer exists — through `resolveRecovery`. It `require`s from a `/tmp/lfa-compiled/` build directory and **no npm script runs it** |

**⚠ AND THE DARKNESS WAS HIDING A CELL THAT WAS SIMPLY WRONG.**
`readinessSignalTests` asserted `missing profile falls back medium`.
`utils/readiness.ts:43` says in its own docblock that a missing capacity answer
**THROWS**, and that *"that is the contract, not an accident"* — the fail-loud
law that deleted `DEFAULT_BODYWEIGHT_KG`. The cell encoded the behaviour that
law replaced and had been unreadable since the burn. **The CELL was corrected to
the live contract. The PRODUCT was not changed to suit the cell.**

**TWO THINGS WERE DELIBERATELY NOT RE-SITED, AND THEY ARE UNCOVERED, NOT
COVERED ELSEWHERE:** the weekly CoachUpdate card (`utils/weeklyCoachUpdate.ts`,
no successor) and the read-time injury filter
(`utils/injuryWorkoutFilter.applyInjuryFilterToWorkout`, no successor). Both are
on the 2026-08-19 burn's rebuild list.

**NO EXECUTABLE REFERENCE to anything this branch deleted remains anywhere in
`src/`, `scripts/` or `App.tsx`.** Every remaining mention is a headstone
comment. The last stale production claim — a docblock arrow in
`utils/coachConstraintProducers.ts` still ending `-> buildConstraintPlans ->
CoachUpdate card` — was corrected in the same commit.

**STILL DEAD AT IMPORT ON BOTH TREES, AND NOT THIS BRANCH'S DOING:**
`test:midline` (on `utils/blockAdjuster.ts`) and `test:severity-scale` (on
`utils/trainAroundEngine.ts`) — both modules removed by the 2026-08-19 burn.
Verified to fail with the identical ENOENT on the control tree.

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
5. **The suites still dead at import from the PREVIOUS burn.** Two of the four
   met here were repaired and now run; `test:midline` and `test:severity-scale`
   remain dark on `blockAdjuster` and `trainAroundEngine`. Seat `demolition`
   recorded 34 such suites in total — the rest were not surveyed.

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
- **`test:midline` and `test:severity-scale` are still dead at import** — on modules the PREVIOUS burn removed. Named, verified identical on the control tree, not repaired: their subjects belong to that burn's rebuild list, not to this deletion pass.
- **Sam's product notes were not read, investigated or acted on.**
- **Nothing merged.** The candidate waits for Sam.

Agent: boats

---

---

# SESSION 3 — SAM'S CORRECTION, AND WHAT IT CHANGED

**Sam, 2026-08-21: *"You have mixed current contracts with old-app
expectations."* He was right on every count.** Session 2's report carried three
"findings"; **one was real, one was a defect that does not exist, and one was
scored against a deleted authority as if it were a standard.**

| session 2 said | session 3, after Sam's correction |
| --- | --- |
| a live violation of the severity ruling, DECLARED as a debt | **the debt entry is DELETED.** It pinned a line on the COACH's live time-cap path under a DEAD feature's section. Gating live code under a retired feature was the error |
| a safety gap: "the app cautions max-effort work it still prescribes" | **WITHDRAWN. The defect does not exist.** It came from a legacy dispatcher inside a suite fixture. Through the real Tired button the week is RECOMPOSED |
| a gap: staged injury return is missing | **REFRAMED as an OPEN Sam decision.** The deleted filter's behaviour is not a standard |

## 1. SHORT ON TIME — PROVEN DEAD, THEN DELETED (R-126)

`npm run test:short-on-time-absent`, **8 cells, 0 failures**: the fact was gated
on `today_only`; **all three athlete dispatches use `current_week`**; and
`buildReadinessSignalPatch` has zero production callers.

**⚠ THE REPO ALREADY KNEW, IN TWO PLACES I SHOULD HAVE READ FIRST.**
`LAW-day-readiness-doors-are-direct` says "the dead Time action ... do not
exist", and `programControlDurableOwnershipTests` carried **two PASSING cells
asserting the Time door stays absent** — while nine cells beside them drove that
door through a `today_only` helper the suite built itself. **A suite was testing
a door its own neighbours said was gone, and I repaired it instead of reading
them.**

Deleted: `rules/timeAvailabilityPolicy.ts` whole, the readiness quick option, the
readiness constraint, the control-action branch, the helper and nine cells
(**18/2 → 11/0**, two of the nine already failing), and my debt entry.
**Kept:** the coach's time-cap fact — a different, live feature that shared only
a type.

## 2. "TOTALLY COOKED" — RE-MEASURED THROUGH THE REAL BUTTON (R-127)

`npm run probe:totally-cooked` drives the Tired sheet's third option through the
real durable executor on a real generated in-season week:

| day | sets before → after | rows dropped |
| --- | --- | --- |
| Mon | `2,3,3,3,3,2,1` → `1,2,2,2,1` | Single-Leg RDL, Band Pallof Press |
| Tue | `2,3,3,2,13` → `1,3,2,13` | Band Pull-Apart |
| Wed | `3,3,2` → `2,2` | Banded External Rotation |

`ok=true`, `changedProgram=true`, **warnings on every day: 0.** The week is
recomposed, not annotated. **No defect. Nothing asks for the deleted rewrite
system back.**

## 3. STAGED INJURY RETURN — OPEN, AND NOT A GAP (R-128)

What is simply true: 9/10 then 4/10 and a fresh 4/10 give the same five rows,
withheld 0; and `rules/injuryReintroduction.ts` has zero production callers.
**Whether a return should be staged is Sam's to rule.** The staging cells stay so
either ruling has a specification. No product code changed.

## CHECKS — CANDIDATE vs CONTROL @ `3821af21`

| instrument | control | candidate |
| --- | --- | --- |
| `test:compile` `[product]` | 30 | **30 — identical** |
| `test:compile` `[devtools]` | 50 | **50 — identical** |
| `test:compile` `[tests]` | 588 | **575 — 13 fewer, zero added** |
| worse file/scope pairs | 74 | **71** — three files LEAVE, none joins |
| runtime-reachable src files | 552 | **551** — exactly the one deleted module |
| `test:scenarios` | — | **byte-identical** |
| `test:midline` | DEAD | **23 / 0** |
| `test:severity-scale` | DEAD | **35 / 0** |
| `test:coach-live-path-v2` | DEAD | **58 / 0** |
| `test:injury-canonicalisation` | DEAD | **36 / 0** |
| `test:injury-reintroduction` | DEAD | **31 / 0** |
| `test:program-control-durable` | 18 / **2 failed** | **11 / 0** |
| `test:readiness` | 33 / 0 | 28 / 0 (5 short_time cells deleted) |
| `test:accepted-state-transactions`, `test:weekly-readiness`, `test:injury-severity-bands`, `test:coach-truth-gate`, `test:readiness-structure-law` | — | **unchanged** |
| the three repo guards | 12/2, 53/10, 6/2 | **identical failure TEXT** |

## STILL DARK — NAMED, NOT HIDDEN, NOT THIS BRANCH'S SUBJECT

`test:coach-orchestration` and `test:coach-live-wiring`
(`useCoachUpdatesStore.setActiveInjury`, removed with the single-slot API),
`test:strength-intent` (`blockAdjuster.recomputeWeekOverrides`, no successor),
`test:coach-note-display` (`screens/home/TodayWorkoutCard.tsx`, deleted screen).
Each has a live subject behind a deleted vehicle.

## THE LESSON, WRITTEN DOWN

**A repaired test is a CLAIM about a current contract.** Session 2 revived five
suites and then reported what those suites' OLD expectations implied, as if the
old app were the standard. Two of three findings did not survive being measured
at a control the athlete can actually press. **Measure at the athlete's door, or
do not report it as a defect.**

## NOT COVERED

- No rebuild, no simulator, no device, no release matrix. Headless only.
  **NOT-VISIBLE: nothing here changes what the athlete sees** — scenario output
  is byte-identical and the only deleted production module was unreachable.
- **No product code was changed** beyond deleting the proven-dead short-on-time
  implementation.
- **Nothing merged.**

## THE TWO OPTIONS WEIGHED

**(a) keep the short-on-time implementation and gate its severity line**, which
is what session 2 did — cheap, and it keeps a guard. **(b) prove the feature has
no athlete route and delete it whole.** **(b), on Sam's instruction and on the
census**: a gate over a door nobody can open is a gate that will be maintained
forever for nothing, and the line it was guarding turned out to belong to a
different, live feature.

Agent: boats

---

# SESSION 2 — MIDLINE, SEVERITY-SCALE, THE CARD, AND THE FILTER MEASUREMENT

**Branch `cleanup/midline-severity-card`, cut from `main` @ `3821af21`. Control
`wt2-ctl`, detached at the same commit, never edited. NOT MERGED.**

## FIVE SUITES WERE DEAD AT IMPORT AND ARE NOW GREEN

| suite | before | after | what it took |
| --- | --- | --- | --- |
| `test:midline` | DEAD | **23 / 0** | `blockAdjuster` off the copy sweep; the `label: 'Midline'` cell re-sited onto `SESSION_ROLE_ORDER` + `classifyExerciseRole`; a missing file now REDS by name instead of throwing ENOENT |
| `test:severity-scale` | DEAD | **47 / 0** | `assertReadersExist` for every reader list; impact-band readers measured down to the one that remains; the minutes list re-measured, ADDING `rules/temporarySourceFact.ts` |
| `test:coach-live-path-v2` | DEAD | **60 / 0** | the weekly card retired out of it — 23 blocks across 9 sections |
| `test:injury-canonicalisation` | DEAD | **36 / 0** | the filter's sections [5]-[9] deleted with their subject |
| `test:injury-reintroduction` | DEAD | **31 / 0** | the filter section deleted; section 5 re-sited onto `deriveInjuryConstraintFromEpisode` |

## THREE FINDINGS THE DARKNESS WAS HIDING

**1. A LIVE VIOLATION OF SAM'S OWN SEVERITY RULING.**
`rules/temporarySourceFact.ts:1070` — `severity: fact.maxSessionMinutes < 20 ? 7 : 5`.
Minutes converted into a severity, which the 2026-07-28 Batch 4 ruling killed,
and `7` is a stray cut point the same ruling said moves to `6`. The gate had
never read this file. **DECLARED as an exact count, mutation-proven both ways;
no product code changed.**

**2. A SAFETY GAP: THE APP CAUTIONS WORK IT STILL PRESCRIBES.**
At fatigue 7/10, Friday's `Flying 30m Sprints` and `Box Jumps` are still on the
session, with `Caution:` notes naming them. The post-composer safety rewrite that
removed them is on the 2026-08-19 rebuild list. **PINNED, not fixed.**

**3. THE STAGED INJURY RETURN IS NOT WIRED.**
9/10 then 4/10 gives byte-identically the same session as a fresh 4/10.
`rules/injuryReintroduction.ts` is written and correct and has **zero production
callers**. **REPORTED, not fixed** — Sam asked for exactly this before any
product change.

## CHECKS — CANDIDATE vs CONTROL @ `3821af21`

| instrument | control | candidate |
| --- | --- | --- |
| `test:compile` `[product]` | 30 | **30 — identical** |
| `test:compile` `[devtools]` | 50 | **50 — identical** |
| `test:compile` `[tests]` | 588 | **576 — 12 fewer, zero added** |
| worse file/scope pairs | 74 | **72** — two files LEAVE, none joins |
| `test:scenarios` | — | **byte-identical** |
| `test:law-registry` / `test:repo-law-guards` / `test:ruling-registry` | 12/2, 53/10, 6/2 | **identical failure TEXT** |
| `test:readiness`, `test:injury-severity-bands`, `test:coach-truth-gate`, `test:readiness-structure-law` | 33/0, 31/0, 59/0, 88/88 | **unchanged** |

## STILL DARK — NAMED, NOT HIDDEN, AND NOT THIS BRANCH'S SUBJECT

| suite | cause | subject |
| --- | --- | --- |
| `test:coach-orchestration` | `useCoachUpdatesStore.setActiveInjury` removed with the single-slot API — 8 call sites | coach orchestration |
| `test:coach-live-wiring` | same, 6 call sites | coach live wiring |
| `test:strength-intent` | `blockAdjuster.recomputeWeekOverrides` deleted, no drop-in successor; ONE call site | G-2 moderation, which IS live in `sessionResolver`'s game-proximity rules |

Each has a LIVE subject and a deleted vehicle — the same shape as the five
repaired above, and ready for the same treatment on the word.

## NOT COVERED

- **No rebuild, no simulator, no device, no release matrix.** Headless only.
  **NOT-VISIBLE: nothing on this branch changes what the athlete sees** — the
  scenario harness output is byte-identical to the control.
- **No product code was changed anywhere**, which is why all three findings above
  are reported rather than closed.
- **Nothing merged.** The candidate waits for Sam.

## THE TWO OPTIONS WEIGHED

**(a) delete the dark suites** — they report nothing, so deleting them costs no
signal today and clears the compile debt fastest. **(b) repair each against the
owner that holds its claim now.** **(b) was taken**: every one of the five had a
LIVE subject behind a deleted vehicle, and (a) would have thrown away 197 working
cells — and all three findings above, which only exist because the suites started
speaking again.

Agent: boats

---

# SESSION 4 — SAM RULES: THE LATEST NUMBER IS THE AUTHORITY (R-128)

**Sam, 2026-08-21: *"Trust the athlete's latest reported injury number
immediately. Do not stage the return."*** Ruled and built. **NOT MERGED.**

## ⚠ I WAS WRONG ABOUT THE ONE FACT THAT MADE THIS A PRODUCT CHANGE

Session 3 reported that `rules/injuryReintroduction.ts` had **zero production
callers**. **It had one.** `utils/generationConstraints.ts:331` called
`stageReintroductionSeverity` on every injury constraint it built. I had grepped
for `isReintroducing` and `peakSeverity` — **two of the module's three exports** —
and generalised to the module.

**So the staging was LIVE, and this is a behaviour change, not a dead-code
deletion.** Stated plainly: an athlete who reported 8 and now reports 4 is
restricted as a **4**. Before this commit they were restricted as a **6**.

## WHAT WENT

| deleted | why |
| --- | --- |
| `rules/injuryReintroduction.ts` | the one-band-per-step lever, whole file |
| `effectiveSeverity` on the generation constraint | it existed ONLY to carry the staged answer; with staging gone it was an exact alias of `severity` — a second severity with no reason to differ |
| **`priorSeverity`, everywhere** | written in FIVE places, consumed in exactly ONE — the staging call. With that gone it had no reader at all. Removed from the episode, the transaction, the store type and `injuryProgression` |
| `rules/index.ts` barrel export, `injuryReintroductionTests` | with their subject |

## THE GUARD — `test:injury-latest-severity`, 48 cells, in the bible chain

It holds the **behaviour**, not the absence of a file: nine severities each get
exactly the gates that number earns; a reported 4 after a 9 is identical to a
fresh 4 across five buckets and **on every gate at once**; the one-band steps
8→6, 6→4, 4→2, 10→8 each match their fresh equivalent; improvement AND worsening
land immediately; and a stored constraint still carrying the retired
`priorSeverity` is **ignored rather than honoured**.

**⚠ MUTATION-PROVEN, AFTER A HALF-MUTATION PROVED NOTHING.** Restoring the
staging alone reddened **ZERO** cells — the caller no longer forwards the input,
so the restored lever had nothing to read. Restoring **both** halves kills **16**.
And the headline cell's first cut compared `status: 'improving'` against
`'active'`; staging never keyed on status, so it was **unkillable**. The stepped
side now carries the peak.

**⚠ AND ONE CELL I WROTE COULD NEVER FAIL** — `severityBand === injurySeverityRemovesRiskyWork(2)`
compared a band string to a boolean. It now asserts the band from the band owner.

## CHECKS — CANDIDATE vs CONTROL @ `3821af21`

| instrument | control | candidate |
| --- | --- | --- |
| `test:compile` `[product]` | 30 | **30 — identical** |
| `test:compile` `[devtools]` | 50 | **50 — identical** |
| `test:compile` `[tests]` | 588 | **574 — 14 fewer, zero added** |
| worse file/scope pairs | 74 | **70** — four files LEAVE, none joins |
| runtime-reachable src files | 552 | **550** — the two deleted modules, exactly |
| `test:scenarios` | — | **byte-identical** |
| `test:injury-authority` | 5/20 | **5/20 — identical** |
| `test:preseason-exposure` | 88/22 | **88/22 — identical** |
| `test:exposure-engine` | 150 | **150 — identical** |
| `test:rules-kernel` | 121/1 | **121/1 — identical** |
| `test:fatigue-abolition`, `test:injury-severity-bands`, `test:conditioning-templates`, `test:coach-truth-gate`, `test:readiness-structure-law` | — | **unchanged** |
| the three repo guards | 12/2, 53/10, 6/2 | **identical failure TEXT** |

**Green on this branch that were dead or failing on main:**
`injury-latest-severity` 48/0 (new), `short-on-time-absent` 8/0 (new),
`midline` 23/0, `severity-scale` 35/0, `coach-live-path-v2` 58/0,
`injury-canonicalisation` 36/0, `program-control-durable` **11/0** (was 18/**2**).

## NOT COVERED

- No rebuild, no simulator, no device, no release matrix. Headless only.
- **NOT-VISIBLE on the generated week:** `test:scenarios` is byte-identical, so
  no scenario in the harness exercises an injury that had a recorded peak. **The
  behaviour change is real and is proven by the guard, not by the harness** — an
  athlete whose injury improves is the case that moves, and no scenario walks
  one.
- **Nothing merged.**

## THE TWO OPTIONS WEIGHED

**(a) keep `effectiveSeverity` and set it equal to `severity`** — a one-line
change, no readers touched, and the field is there if staging ever returns.
**(b) delete the field and point every gate at `severity`.** **(b)**: a second
severity that can never differ is a duplicate authority waiting to drift, and
Sam's ruling names the reported number as *the* authority — one number, one
owner. The same argument retired `priorSeverity`.

Agent: boats
