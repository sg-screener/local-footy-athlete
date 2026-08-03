# Stage B — Stage 1 CHECKPOINT, 2026-08-04

**Why this document exists.** Stage 1 began in a Fable session that ran out of
credits mid-build. This is the handover: git state, how far the build got, and
— most importantly — **every decision and measurement that existed only in that
session's context and is not otherwise written down anywhere.** Section 5 is
the at-risk part; it is the reason this file is long.

**Status in one line: stage 1 is STARTED, NOT FINISHED, and its branch is RED
on `test:action-walker:deep`. It must not be merged as it stands.**

---

## 1. Git state

- **Branch:** `feat/stage-b-stage1-l16-slice` (cut from `main` at `936bbf7`).
- **HEAD:** `0221d4d`.
- **Commits on the branch:**
  1. `5b1cb4d` — `docs(stage-b/stage-1)`: the stage 1 plan
     (`docs/STAGE_B_STAGE1_PLAN_2026-08-03.md`), including the written
     differential predictions made BEFORE any code.
  2. `0221d4d` — `wip(stage-b/stage-1)`: Task A implementation. Committed
     deliberately while RED, to protect it: this working tree is shared with
     concurrent sessions and AGENTS.md records uncommitted edits being
     destroyed here twice on 2026-07-28. The commit subject says it is red.
- **Working tree: clean.** Nothing uncommitted. Everything below is in
  `0221d4d`.
- **`main` is untouched** and remains at `936bbf7`. Nothing has been merged.
- A scratch worktree of clean `main` exists under the session scratchpad
  (`.../scratchpad/main-worktree`, detached at `936bbf7`) purely to run the
  deep walker on an unmodified baseline. **It should be removed**
  (`git worktree remove`) by whoever picks this up, or it will linger.

## 2. What stage 1 is, and how far it got

The plan (`docs/STAGE_B_STAGE1_PLAN_2026-08-03.md`) splits stage 1 into four
sub-stages, one commit each:

| Task | What | Status |
|---|---|---|
| **A** | Typed re-add restoration; delete the athlete legacy deferral; LR-3 4→2 | **CODE COMPLETE, RED on deep walker** |
| **B** | Lighter-day trim → deriving lane (retire the stored trim) | **NOT STARTED** |
| **C** | Unified precedence — one ordering, one owner | **NOT STARTED — deliberately reserved** |
| **D** | L16 relaunch-identical walker proof + L14 prefs injection + boundary report | **NOT STARTED** |

**Task C is reserved for the next Fable session by Sam's instruction
(2026-08-04): it is the novel core of the slice and must not be split across
two models mid-build.** Do not start it opportunistically.

### What Task A actually changed (all in `0221d4d`)

- `src/store/acceptedStateTransaction.ts`
  - `stageAthleteMutationConstraint` gains `restoreConstraintIds?: readonly
    string[]`. Constraints named there are flipped to
    `status: 'restored', restoredAt, restorationReason: 'explicit_re_add'`
    **before** the existing conflict filter runs.
  - `stageAthleteSessionAdditionTransaction` computes those ids (active,
    same-date, `whole_session`, no `remainingWorkout`) and emits a
    `mutation_constraint_created` tape event per flip
    (`constraintType: 'restoration_flip'`).
- `src/utils/planChangeProducer.ts`
  - `SWAP_DEFERS_TO_LEGACY` / `ADD_DEFERS_TO_LEGACY` **deleted**.
  - The `add_defers_to_legacy_stack` early return **deleted** — the re-add now
    resolves as a normal typed `add_session`.
  - Both `applyCoachRevisionDateOverrides` call sites (preview + commit)
    **deleted**, along with the now-dead helpers `validationPolicyForPlanChange`,
    `rejectedForResult`, `withPreviewWrites`, and four imports.
  - Both legacy tails now return an honest refusal
    (`plan_change_kind_not_owned`).
- `src/data/legacyReckoningCensus.ts` — LR-3 `declared: 4 → 2`,
  `LEGACY_DEBT_BASELINE: 76 → 74`, founding text corrected, sequence records
  the athlete share as PAID. (Ratchet law satisfied: the ceiling drops in the
  same commit.)
- `src/__tests__/athleteActionWalkerTests.ts` — new deterministic cell,
  *a re-add onto a binned day restores through the typed lane, never the
  override surface*. Written FIRST, watched fail, then made to pass.
- `src/__tests__/support/athleteActionWalker.ts` — new diagnostic seam
  `WALKER_LOG_PRESHRINK=1` prints the violation that triggers `shrink()`
  before shrinking begins. Added because the deep walker was dying *inside*
  the shrink loop, so the defect that started it was never reported. Behind an
  env flag; inert on green runs (shrink is only entered on a violation).

### Evidence run this session (all against `0221d4d` unless noted)

| Gate | Result |
|---|---|
| `test:legacy-census` | **301/301 PASS** (with 4→2 and baseline 74) |
| `test:g1-landing-ask-flow` | **29/29 PASS** — incl. test 28, the bin-then-re-add cell, now green *through the typed path* |
| `test:athlete-door-matrix` | **431/431 PASS** (144 cells × 2 attempts, + placement × domain 8×3) |
| `test:athlete-session-deletion` | **PASS** 24 regressions / 5 properties / 3 mutations |
| `test:athlete-session-move` | **22/22 PASS** |
| `test:coach-add-session-ownership` | **4/4 PASS** |
| `test:placement-ownership` | **22/22 PASS** |
| `test:compile` | **PASS** — no file regressed against baseline |
| `test:stage-b-generation-differential` | **3/3 PASS, byte-identical, no `--write`** |
| `test:action-walker` (bounded) | **18/18 PASS** incl. the new cell |
| **`test:action-walker:deep`** | **RED — see §4** |
| `test:action-walker:deep` on clean `main` | **17/17 PASS** (baseline is green) |
| `test:bible` full chain | **NOT RUN** this session |

**The stage-0 differential prediction for Task A ("ZERO golden movement") HELD
— verified byte-identical with no regeneration.**

## 3. Task A's premise correction (measured, and it matters)

Sam's Option C ruling says Stage B retires "the two athlete routes
(occupied-day stack adds, no-template swaps)". **Both halves of that
description were stale.** Measured on `936bbf7` before any edit:

1. **Occupied-day stack adds had already come home** to the typed path in an
   earlier unit — the retirement comment is at `planChangeProducer.ts:1950-1971`
   ("OCCUPIED-DAY STACK ADDS COME HOME"), corroborated at
   `acceptedStateTransaction.ts:2619-2620`.
2. **`no_template_for_category` was a no-op double refusal.** The legacy path
   ran the *identical* `resolveTemplatePlanChange` lookup and refused with the
   same code, never reaching the writer.
   `docs/STACK_PRIMITIVE_RETIREMENT_DIAGNOSIS_2026-07-23.md:344-376` had
   already reached this verdict.
3. **The one real athlete residual was the active-removal re-add.** Binning a
   whole day records an active `whole_session` constraint with no
   `remainingWorkout`; adding back onto that day deferred to the legacy writer
   *because only that writer knew how to un-pin the removal* — as a side
   effect of `applyProgramOverrideWrite`
   (`programStore.ts:2779-2790` flips constraints to
   `restored`/`explicit_re_add`).

So the work was: **build the one missing typed capability (restoration), then
delete the whole deferral mechanism.** Same end state the ruling ordered
(no athlete surface reaches the legacy writer; LR-3 4→2, the two remaining
being coach-owned under LR-6), reached by a sharper diagnosis.

**The ruled identity document was NOT edited** — the submission stays verbatim
as ruled on. The correction lives in the census founding text, the plan doc
§0, and here.

## 4. THE RED — undeclared L-P3 violation on the deep walker

**This is the blocker. Do not merge or build on Task A until it is resolved.**

`npm run test:action-walker:deep` on `0221d4d`:

- Dies with `FATAL ERROR: Reached heap limit` (exit 134). Raising the heap to
  12 GB does not help — it dies later, at `Ineffective mark-compacts`.
- With `WALKER_LOG_PRESHRINK=1`, the violation that starts it is:

```
[walker] pre-shrink violation at step 63: L-P3 TEMPLATE = PROJECTION —
2026-08-19: the session list omits ["conditioning","strength"] and invents
["support"] — template ["support","team_training"] /
projection ["conditioning","strength","team_training"].
```

### Why the OOM is a symptom, not the disease

`shrink()` (`athleteActionWalker.ts:173`) replays up to 200 sub-histories to
minimise a failing walk. On a **deep** walk each replay re-runs generation.
Clean `main` never enters `shrink()` (no violation), which is exactly why main
is green and this branch OOMs. **Fix the violation and the OOM goes with it.**

A measured contributing factor, worth recording independently: a scratch probe
(bin → re-add, repeated) showed `reversibleAdjustmentLedger` growing
**~227 KB per bin/re-add cycle** (2 adjustments, ~113 KB each, because
`displacedOriginalState` carries full before/after workouts), with no cap. 20
cycles ≈ 4.9 MB of store state. That is *legitimate decision recording*, not a
leak — both the bin and the add are real decisions — but under `shrink()`'s 200
replays it is what exhausts the heap. **Whether the ledger should cap or
compress its snapshots is a question for Sam, parked in §6.**

### Is the violation NEW, or newly REACHED? — undetermined, and this is the first job

The offence does not match any of the four declared reds under this law:

| Declared red (`athleteActionWalkerTests.ts`) | Its regex | Matches ours? |
|---|---|---|
| `session_list_drops_conditioning_attached_to_an_appointment` `:1597` | `omits ["conditioning"] and invents [] — template [..."team_training"...]` | No — ours omits two |
| `session_list_calls_a_conditioning_day_recovery` `:1630` | `omits ["conditioning"] and invents ["recovery"]` | No |
| `session_list_badges_a_midline_row…` `:1658` | `omits [] and invents ["support"]` | No — ours omits two |
| `session_list_has_no_representation_for_speed_work` `:1678` | `omits ["speed"] and invents []` | No |

**Read them together and the observed string is plainly a *composition* of
declared #1 (a team night whose conditioning the list drops) and declared #3
(a `support` badge the projection has no part for), co-occurring on one day
that also carries strength.** Each declared regex pins a *single* shape, so a
day exhibiting two at once matches none of them.

**The honest position, which the next session must settle before anything
else:** my diff touches constraint status-flipping and the addition
transaction — **it does not touch any classifier**. `buildSessionTemplate`,
`getSessionComponents`, `getSessionComponentRows` and `classifyExerciseRole`
are untouched. That is strong evidence the projection defect is pre-existing
and merely became *reachable* because the re-add now succeeds where it used to
defer, putting strength onto a team night carrying conditioning. **But that is
inference, not proof, and it must not be treated as a finding.** L13 says
cells go red by the walker walking further, never by asking less — so the
resolution is *not* to widen a regex until it swallows the combination.

Two candidate resolutions, both needing a decision, neither to be taken
unilaterally:

- **(i)** Declared reds become *per-part* rather than per-combination, so a day
  exhibiting two known shapes is still contained by the two entries that own
  them. Honest only if it is genuinely the two known defects and nothing else.
- **(ii)** Fix the underlying owners (the D13/`sessionComponents` classifier
  family), which pays declared reds #1 and #3 outright. Larger, and arguably
  a different unit's work.

**Reproduction:** `WALKER_LOG_PRESHRINK=1 npm run test:action-walker:deep`,
deep tier seeds, violation at step 63, date `2026-08-19`. To iterate without
the OOM, temporarily neuter `shrink()` or cap its `guard`.

## 5. Decisions and measurements that exist ONLY here

Everything in this section was established this session and is written down
nowhere else. It is the reason to read this file rather than re-derive.

### 5a. The precedence map — SIX copies, not four (this is Task C's input)

The identity doc says two stacks disagree plus "two more hand-rolled copies".
Measured: **`postGenerationConstraintValidation.ts` holds THREE separate
compose loops, so there are six.**

| # | Site | Lines | Override vs mark | constraints | §18 | injury filter |
|---|---|---|---|---|---|---|
| 1 | `sessionResolver.ts` `_resolveDateRaw` | `951-1137` | **override > mark** | **absent** | no (is its dependency) | yes, `source==='manual'` exempt (`:930`) |
| 2 | `acceptedEffectiveWeek.ts` `rebaseAcceptedEffectiveWeek` | `89-187` (loop `104-127`) | **mark > override** | yes (twice) | yes (last) | no |
| 3a | `pGCV.ts` `resolveLiveDateMutationExposure` | `700-776` (loop `725-741`) | n/a (no marks) | no | no | no |
| 3b | `pGCV.ts` `finaliseLiveDateCandidateAgainstWeek` | `1475-1560` (loop `1525-1541`) | n/a | no | yes `:1545` | no |
| 3c | `pGCV.ts` `validateLiveWeekOverlayWrite` | `1674-1845` (loop `1711-1723`) | n/a | no | yes `:1740` | no |
| 4 | `devE2ESeedRegistry.ts` `effectiveWorkoutForDate` | `441-456` | n/a | no | no | no |

Also measured, and load-bearing for any unification:

- **Override lookup is inconsistent:** sites 1, 2, 3a-c use a **truthy** check;
  site 4 uses `hasOwnProperty`. Overlay lookup is `hasOwnProperty` everywhere.
  An explicit `null` override therefore means different things per site.
- **The §18 gateway re-enters the live resolver.**
  `section18AcceptedWeekGateway.ts:14` imports `resolveWeekWithConditioning`,
  synthesises a throwaway microcycle from already-composed workouts
  (`:200-226`) and calls it at `:271` with **both override surfaces hard-blanked**
  (`manualOverrides: {}`, `weekScopedOverlays: {}`, `:248-250`). So "one
  ordering, one owner" cannot be done by editing the two top-level stacks
  alone — the gateway's flattening loses the `owner` distinction, documented
  at `acceptedEffectiveWeek.ts:129-143`.
- **`microcycleForWeek` has three copies:** `acceptedEffectiveWeek.ts:67-80`,
  inline at `pGCV.ts:1695-1704`, and `programStore.ts:1096-1105`. Monday
  arithmetic has five.
- **Sam's own record of the divergence** is `programStore.ts:1187-1196`
  (inside `canonicaliseAcceptedBoundaryState`) — it names the device
  consequence: the screen prescribed Lower Squat on a day marked rest while
  the accepted week correctly held nothing, three actions from a fresh
  install, and it cost two further device findings.
- **The existing agreement gate**, which is the natural home for a unification
  proof: `derivedRepairOwnershipTests.ts` `splitDays()` `:159-176` already
  diffs the live week against `rebaseAcceptedEffectiveWeek().visibleWorkouts`
  and asserts zero divergence (`:205, 271, 298`).
- **Tests that pin the OLD live ordering** and will need converting with the
  ruling cited: `coachScreenUAEFlowTests.ts:434-462` section [6] ("injury
  override wins over calendar marks"), `coachInjuryIntegrationTests.ts:405-436`
  (asserts `source === 'manual'`).

### 5b. Why the whole legacy tail went, not just the two defer sites

I deleted `applyCoachRevisionDateOverrides` from `planChangeProducer` entirely.
That is broader than "retire two routes" and rests on a reachability claim I
**verified this session**:

- The six athlete-owned kinds (`move_session`, `remove_session`,
  `swap_category`, `swap_template`, `add_category`, `add_template`) all return
  from the typed branch above the tail.
- **`shutdown_week` has no product constructor at all** — grep finds only the
  type definition (`planChangeTypes.ts:127`), the producer's own two case arms,
  and two comments. Bed-ridden is the `illness_recovery` §18 week mode now.
- **`clear_days` IS constructed in product** (`useHomeScreen.ts:1558`) — but as
  **payload metadata on a `set_schedule_modifier` action**, not as a dispatch.
  `scheduleModifierAwayDates` (`programControlActions.ts:1109-1117`) only reads
  `.dates` off it to compute a fact horizon; the durable lane handles the
  action at `:1398`, and the non-durable `executeProgramControlAction` case
  (`:888-896`) refuses outright with "Temporary schedule changes require the
  durable source-fact transaction." **It never reaches `applyPlanChange`.**
- `move_team_night` previously fell to the tail and got
  `team_night_move_requires_durable_door` from `buildPlanChangeProposal`; it
  now gets `plan_change_kind_not_owned`. **Both are snake_case, so
  `athleteSafeRefusal` collapses both to the identical athlete-facing
  sentence** — no copy change. Only the internal tape code differs.

**Known behaviour delta to declare:** the `internalResultCode` on the tape for
a tail refusal changes from the specific code to `plan_change_kind_not_owned`,
and `firstFailingBoundary` from `'applyCoachRevisionDateOverrides'` /
`'buildPlanChangeProposal'` to `'plan_change_kind_not_owned'`. Diagnostic
only. **If the next session judges the tail deletion to be out of Task A's
scope, it is separable** — restoring the tail is mechanical; the restoration
capability and the defer-set deletion are the parts the ruling actually
ordered.

### 5c. Task B (lighter-day) is fully scouted — do not re-scout it

- **The trim is already pure** (`lighterDayTrim.ts:47-97`, imports only types;
  L14-clean) and is **already used on the other side of the boundary** by the
  short-on-time time-cap at `pGCV.ts:374-378`. The conversion is unusually
  cheap for that reason.
- **The decision is already a fact + ledger entry.**
  `lighterDayTransaction.ts:86-95` records `readiness_lighter_day:<date>`
  linked to `sourceFactId`. **Nothing reads that entry as a lighter-day fact —
  grep returns exactly one hit, the construction site.** The visible effect
  comes entirely from `dateOverrides` via live P1.
- **The lane it should join** is `temporarySourceFactTransaction.ts:573-608`
  ("THE FACT'S RULED EFFECT OWNS ITS COMMIT LANE"); `isRuledDerivingConstraint`
  `:594-601` already admits `type === 'fatigue'`. The **team-night move**
  (`:474-499`) is the precedent for authoring a *sparse overlay* on that lane
  instead of regenerating.
- Target surface: `weekScopedOverlays` with `reason: 'readiness_reduction'`
  (already in the union, `types/domain.ts:981-1007`).
- Undo already cascades generically on `sourceFactId`
  (`programControlActions.ts:1586-1598`), so R12's semantics survive the
  channel change.
- **Tests that will go red and must convert in the same commit:**
  `readinessSourceFactOwnershipTests.ts` R5 (`:401`, comment `:419` names the
  dateOverride channel explicitly) and `programOverrideOwnershipTests.ts:291-325`
  (uses `writer: 'lighter_day'` as its normal-write case — that id retires from
  the closed union at `programStore.ts:2577`).
- **The walker has NO lighter-day vocabulary** (zero hits for `lighter` under
  `src/dev/e2e/`), so L11 obliges adding one in the same stage.

### 5d. Other measurements worth not losing

- **L16's last hop is proven nowhere in the walker.** `freshInstall()` clears
  storage rather than reading it back; there is no `hydrate`/relaunch call in
  `athleteActionWalkerTests.ts`. The precedent to copy is
  `simulateProcessRelaunch` in `onboardingReliabilityTests.ts:188-204`. This is
  Task D's core.
- **`STAGE_B_DOOMED` is a behavioural trap.** `isStageBLanded(srcDir)`
  (`provenancePendingLists.ts:171-183`) flips the moment **any** of
  `utils/sessionBuilder.ts`, `data/defaultProgram.ts`, `utils/conditioningRules.ts`,
  `utils/coachPlan.ts` imports `conditioningTemplates` — and then demands all
  20 pinned symbols be gone. **Stage 1 must not add that import**, or it
  inherits the conditioning-switchover stage's entire payload.
- **Generation is deterministic but not pure (L14).** No injection point exists
  for `athletePrefs` — `generateProgram.ts:855` always reads the store. Other
  impurities: `__DEV__` and `window.localStorage` must be stubbed; four
  `require('../../store/programStore')` sites; `todayISOLocal()` default;
  `new Date().toISOString()` for `createdAt`/`updatedAt`.
- **The %MAS conflict is entirely latent.** Both representations are display
  strings today and `deriveMas` has **zero generation-path consumers** (grep
  outside tests hits only a comment at `reviewRows.ts:194`). `masCopy.ts:97-101`
  declares the conflict against itself. Nothing breaks until MAS becomes a
  number — which is what makes it safe to ask rather than urgent to fix.
- **Differential regeneration is an argv flag, not an env var:**
  `npm run test:stage-b-generation-differential -- --write`
  (`stageBGenerationDifferentialTests.ts:30`).

## 6. Parked for Sam (do not guess these)

1. **The undeclared L-P3 combination (§4)** — widen the declared reds to be
   per-part, or fix the classifier owners? The second pays two declared reds
   but is plausibly a different unit's work.
2. **Should `reversibleAdjustmentLedger` cap or compress?** ~227 KB per
   bin/re-add cycle, uncapped, full workout snapshots per adjustment. Correct
   as *decision recording*; expensive as *stored state*. Touches the north
   star (it stores decisions, so it is legitimate) but the snapshot payload is
   arguably stored output riding along inside a decision record.
3. **Was deleting the producer's whole legacy tail (§5b) in scope**, or should
   it be narrowed to exactly the two ruled routes?
4. **%MAS range-vs-binary** — the decision sheet is still to be drafted.
5. The hydration-repair in-place branch (`programStore.ts:1216-1219`) vs the
   derived-repair ruling — inherited open from stage 0, unchanged.

## 7. NOT COVERED this session

- **`test:bible` was never run end-to-end.** Stage 0's report already owed a
  full-chain run after the differential was appended; that debt now also
  covers Task A. Note the chain is `&&`-joined and the walker sits at link 121
  — **a red deep walker at link 123 means links 124-126 never execute.**
- No device pass (L10 stands open for the whole unit).
- Task A's tape assertions cover the *creation* witness; no assertion yet that
  the restoration flip survives a relaunch.
- The `pickTemplateForCategory` probe confirmed all eight walker categories
  resolve a template, so `no_template_for_category` is unreachable from the
  walker's vocabulary — meaning **its deletion is proven safe by inspection,
  not by a red-then-green test.**
- No mutation testing of the new `restoreConstraintIds` path.

## 8. What the next session must read, in order

1. `docs/NORTH_STAR.md`, `CLAUDE.md`, `AGENTS.md` — standing law (the shared-tree
   rule in AGENTS.md "Environment Facts" bit this session's planning: verify the
   branch before every commit).
2. **This file**, whole.
3. `docs/STAGE_B_STAGE1_PLAN_2026-08-03.md` — the four-task plan and, in §P,
   the differential predictions written before any code.
4. `docs/STAGE_B_STAGE0_BOUNDARY_REPORT_2026-08-03.md` — declared reds
   inherited, the measured density baseline (median 3.0 v the 5–7 bar), the
   modes the differential does *not* reach.
5. `docs/STAGE_B_STAGE0_DATEOVERRIDES_IDENTITY_2026-08-03.md` — the RULED
   header (Option C), then §3 (the precedence divergence) which is Task C's
   subject.
6. `docs/STAGE_B_PROMPT_DRAFT_2026-07-29.md` + `docs/STAGE_B_KICKOFF_ADDENDUM_2026-08-03.md`
   — scope and the rulings that bind the engine.
7. Then `git log --oneline main..feat/stage-b-stage1-l16-slice` and the diff of
   `0221d4d`.

**First action on resume: settle §4.** Everything else in stage 1 is blocked
behind a green deep tier, because every later task's proof is the walker.
