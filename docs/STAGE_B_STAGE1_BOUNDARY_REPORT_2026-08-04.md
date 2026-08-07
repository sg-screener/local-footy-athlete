# Stage B — Stage 1 BOUNDARY REPORT (the L16 vertical slice), 2026-08-04

**Status: all four tasks COMPLETE. `test:bible` EXIT 0 end-to-end. Branch
`feat/stage-b-stage1-l16-slice` at `c78d1d0`, base `main` `936bbf7` untouched,
UNMERGED pending Sam's read and the device pass (L10).**

---

## 1. The convergence question, answered first

> **Does this move the app toward "store decisions, derive everything", or away
> from it?**

**Toward, on every task, and the measurement says so rather than the intent.**

| Task | What moved | Direction |
|---|---|---|
| A (prior session) | The athlete re-add restoration became a typed constraint flip instead of a side effect of the legacy override writer | toward — a decision recorded, not an output stored |
| **B** | The lighter-day trim stopped being STORED on the athlete's decision surface and became a DERIVED effect of the readiness fact already in the ledger | toward — this is the north star's sentence, executed |
| **C** | Six hand-rolled copies of one ordering collapsed to one owner; the live path stopped needing an exception to agree with the accepted path | toward — fewer representations, not more guards |
| **D** | The loop is proven to close through persistence, and the proof found two stored-output defects nobody could see before | toward — and the instrument is now permanent |

**Nothing stored was added.** One field was added to an in-memory type
(`ScheduleState.userRemovalConstraints`) and it is a *read* of state that
already existed; one option was added to a function signature
(`athletePrefs?`) and it defaults to the read it replaced.

**Two stored-output defects were found and neither was hidden**: LR-27 (a full
workout snapshot nested inside a provenance record, growing on every launch)
and a legacy v1 contract materialising into a stored overlay on hydrate. Both
are declared, both are Sam's to rule.

---

## 2. What each task actually did

### Task C — one precedence ordering, one owner (`c3639fe`)

**The measurement changed the design, and that is the headline.**

The map said two derivation stacks "order the same two inputs oppositely".
**They do not. They run the same ordering code.** `rebaseAcceptedEffectiveWeek`
composes surfaces into a flat workout list and hands it to
`resolveFinalVisibleSection18Week`, which synthesises a throwaway microcycle and
calls `resolveWeekWithConditioning` — *the live resolver* — with
`manualOverrides: {}` and `weekScopedOverlays: {}`
(`section18AcceptedWeekGateway.ts:248-250`).

So "marks last" was never a second ordering. It is the live ordering run against
a blanked override surface: Priority 1 finds nothing, the mark fires, the day
comes back empty. **Flattening is what demoted the override, and Priority 1 was
the only thing in the app that ever let an override outrank a mark.**

Two consequences:

- **The blanking is not a defect to retire.** The map called it "the genuine
  unknown" that might force a unit larger than the ruling's sentence. Once the
  ordering is named it stops being a question — the composed content has already
  absorbed the override, and an emptying decision legitimately outranks it.
  **Task C's scope SHRANK once the ordering was chosen.**
- **Convergence is one-sided.** The accepted stack did not move; the live path
  stopped making an exception. Every accepted-state suite stayed green
  *untouched*, which is the evidence that it did not move.

The second divergence is not an ordering question at all:
`userRemovalConstraints` was not a field on `ScheduleState` and appeared nowhere
in `sessionResolver.ts`. The live path could not order what it could not see.

**Direction chosen, and why it was not mine to invent:** Sam recorded the device
consequence himself (`programStore.ts:1187-1196`) — the screen prescribed Lower
Squat on a day he had marked rest "while the accepted week **correctly** held
nothing". His own note calls the accepted answer correct.

### Task B — the lighter-day trim derives from its fact (`b7a968e`)

Channel changed, experience unchanged: same trim, same refusal, same disclosure
copy, same reversible adjustment, same cascade-undo. The trim now authors a
sparse `readiness_reduction` week overlay — the surface `programStore.ts:1179-1190`
already declares to be "derived content authored by a fact, not by the athlete".
`'lighter_day'` is deleted from `ProgramOverrideWriterId`, so a future
lighter-day override write is a **compile error**.

**What it completes:** recipe lesson 16 named the `dateOverrides` residuals as
the coach pipeline, the lighter-day transaction, and LR-3's leftovers. Task A
paid LR-3's. **This was the last non-coach writer. The surface is now
coach-pipeline-only, by construction rather than convention — the writer union
is closed and every surviving id is a coach id, frozen under LR-6.** The census
entry and the walker's LR-1 claim both narrowed to say exactly that, in the same
commit.

### Task D — the L16 slice, and the L14 payment (`c78d1d0`)

The loop closes: load → display → change → repair → approve → persist →
**relaunch-identical**, for two named modes. Both walker tiers run both loops.

`athletePrefs` injection paid L14 at the generation boundary; the store read
survives only as the default, which is why the golden stayed byte-identical.

---

## 3. Every red, declared

### 3a. Reds this stage OWNS

**None.** No suite in `test:bible` fails. Chain exit 0, zero FAIL lines, last
link (`test:stage-b-generation-differential`) reached.

### 3b. Reds this stage FOUND and declared rather than fixed

1. **LR-27 — `derivedSessionProvenance` nests a full displaced-session snapshot,
   and it GROWS on every relaunch.** Filed in the census. Measured across ONE
   relaunch of the in-season Friday Gunshow: chain depth **3 → 4**, projected day
   payload **66,947 → 139,331 bytes**, 3,056 differing leaves of which only 404
   were timestamps. **It is written to disk** — the same growth appears in the
   persisted `weekScopedOverlays`, so it compounds durably on the phone.
   It is LR-26's twin; Sam ruled the principle for LR-26 (delete the snapshot,
   keep the reference, re-derive at read) but **not for this record**, and the
   two have different readers. Pinned by the L16 cell so it cannot get worse,
   spread, or be silently fixed while the declaration still claims it.

2. **A stored overlay gains a legacy v1 `exposureContract` on hydrate** it did
   not have in memory — 38 leaves, every one `undefined → <value>`.
   `validateLiveWeekOverlayWrite` attaches it and hydration runs that path.
   **A superseded format written on every launch is L15's subject.** Belongs
   with the hydration-repair in-place branch already parked from stage 0
   (`programStore.ts:1216-1219`). Reported, not adjudicated inside a slice proof.

3. **A harness defect, FIXED because it was the harness:**
   `resetStoresToFreshInstall` cleared `coachUpdatesStore.activeConstraints`
   *before* resetting the program store — but that field is a **projection** of
   the accepted material context, and its mirror is subscribed to the store's
   own writes, so clearing it re-published the stale fact **inside the very
   `setState` meant to clear it** (0 → 1 before the next line ran). Nothing had
   failed for it because every synchronous cell runs before the async tail, so
   the *first* async cell always got a clean world and a *second* had never
   existed. This is the profile-mirror defect one store over: a mirror is not
   state you clear, it is state you clear the SOURCE of. Now ordered correctly
   **and it throws if it ever fails to hold again.**

### 3c. Reds INHERITED and re-verified as pre-existing on `main`

Verified on a detached worktree of `main` `936bbf7` (recipe lesson 8's method).
**None is in `test:bible`.**

| Suite | main | this branch |
|---|---|---|
| `test:uae-flow` | 51 pass / 10 fail | identical (failure sets diffed, byte-equal) |
| `test:coach-injury-integration` | 34 / 1 | identical |
| `test:dev-e2e-clock` | 18 / 1 | identical |
| `test:chained-mutation-continuity` | 2 / 31 (equipment `ProgramGenError`) | identical |

### 3d. The carried BLIND SPOT — unchanged, and built over knowingly

`team_night × [conditioning, strength]` **agrees in all 6 matrix observations
while the deep walker reds on it.** The declared combination red's coordinates
do NOT characterise the defect; row-level composition probably does, and the
third axis (row roles carried) is unbuilt. **Stage 1 is built over an unnamed
defect.** No regex was widened to make it go away (L13). The classifier owners
(D13 / `sessionComponents`) are still unpaid.

**And the resolution that contained it was chosen by the review seat, not ruled
by Sam** — corrected into the checkpoint's §9f this session. Declaring a
combination is containment, not payment.

---

## 4. L12 — what catches the NEXT defect of each class

### 4a. THE CLASS THIS SESSION NAMED: *a gate passing on coordinates its own fixture never builds*

**Three instances in two days**, which is what makes it a class and not an
anecdote:

1. The declared red's *"DEEP ONLY, by survey"* note described the **walker's
   reach**, not the **defect's** — a bounded suite hit it trivially once one
   existed (26 observations on plain strength days).
2. The combination matrix's axes **agree** on `team_night × [conditioning,
   strength]` where the deep walker **reds** — the axes are necessary but not
   sufficient, filed as the blind spot above.
3. **`derivedRepairOwnershipTests` has been green throughout while the
   live/accepted precedence split stood.** It already diffs the live week
   against the accepted week and asserts zero divergence. Its combination cell
   authors the override on `aDayWithASession()` and marks rest on a **hardcoded
   different date** — so the two surfaces never land on one day, and the one
   world where they disagree was the one world it never built.

**The common shape:** the gate's *assertion* was right and its *fixture* was
narrower than its claim. Every one of the three reads as coverage.

**What would catch the next one — three proposals, in increasing cost:**

1. **A fixture must not choose its own coordinates by convenience.** Where a
   cell asserts a property about the interaction of N surfaces, the N surfaces
   must be placed on the SAME subject (day, week, session) by construction, and
   a cell that cannot state which coordinate it collided should say so. The new
   `dayPrecedenceOwnershipTests` cell 4 is the shape: it takes the first three
   occupied days and deliberately collides two of them, rather than taking a
   date literal.
2. **Non-vacuity assertions on the FIXTURE, not just the outcome.** `derivedRepair`'s
   `splitDays()` could have asserted "at least one day carries two surfaces"
   as a precondition. A property test over a world that cannot exhibit the
   property is the fixture-fidelity law (AGENTS.md) restated at the coordinate
   level: *a fixture whose input cannot exhibit the defect proves nothing.*
   **This is the cheapest of the three and it generalises**: every agreement or
   interaction gate should declare the collision it requires and fail if the
   world it built does not contain one.
3. **The third axis for the session-list matrix** (row roles carried), which is
   what would name the blind spot in 3d. Larger; it is the matrix's own next unit.

**A reviewer applying L12 should reject any future agreement-property gate that
does not state, in the cell, which coordinates it collides and assert that its
world actually contains them.**

### 4b. Per-class, for the defects this stage paid

| Class | What catches the next one |
|---|---|
| Two stacks disagreeing about one day | `dayPrecedenceOwnershipTests` cells 1-4: the two collisions *plus* the agreement property over a world carrying every surface at once, asserted as a count of divergent days rather than named dates |
| A seventh copy of the ordering appearing | cell 5 — a source-text cell that fails if any of the four consumer files stops referencing `dayPrecedence`, and that asserts the owner does not import the stacks that import it (the cycle is real) |
| A writer returning to a retired surface | the **closed writer union**. `'lighter_day'` is gone from `ProgramOverrideWriterId`, so it is a compile error, not a review comment. Same mechanism that paid LR-1 |
| An athlete door quietly re-acquiring `dateOverrides` | the walker's lighter-day cell asserts `dateOverrides` is EMPTY over a walked world, and the LR-1 cell's claim now says coach-only |
| State that does not survive a relaunch | the L16 cell, on **both tiers**. It is the only thing in the repo that observes a process boundary in the walker's vocabulary, and it found two defects on its first run |
| A "fresh install" that is not total | `resetStoresToFreshInstall` now **throws** if the coach-updates reset does not hold |
| Stored derived output growing without bound | the LR-27 pin: growth > 1 level per relaunch reds, and so does the defect *disappearing* without the census entry being paid |

---

## 5. L13 — the depth reached, stated

- **Bounded tier:** `test:action-walker` — 20/20.
- **Deep tier:** `test:action-walker:deep` — 20/20, exit 0, **no pre-shrink
  violation**, and "every declared red still reds" passes (so the combination
  red is still reproducing; it was not accidentally hidden).
- **The L16 slice cell is SHALLOW on purpose and says so**: onboarding →
  generation → accept boundary → one real door change → 10 days crossed →
  relaunch. It proves the loop CLOSES; the deep tier proves it closes in a worn
  world, and **both tiers run it**.
- **The precedence suite is not walked** — it composes worlds through the real
  generation and the real override door but reaches state by seeding the
  override surface via the declared `harness` writer id. Declared debt under the
  fixture law, not silent.

---

## 6. NOT COVERED

- **No device pass. L10 stands open for the whole unit.** The matrix came before
  the phone (L11); the phone has not been asked yet.
- **Five week modes unreached by the L16 slice:** bye, bye_recovery, deload,
  optional, illness_recovery/full-pause. Two modes are proven, not seven.
- **Stage 1 places nothing new**, so the placement × domain matrix was NOT
  extended (D3). Stated rather than padded with a vacuous cell.
- **The §18 gateway's flattening is unchanged.** Task C concluded the blanking
  is correct under the chosen ordering; that is an argument, and the flattening's
  loss of `owner` remains a real property of the code even if nothing currently
  depends on it.
- **The injury-filter manual-exemption interaction is unmeasured.**
  `sessionResolver.ts:930` skips `source === 'manual'` days. Constraints are now
  visible to the live path and the lighter-day trim has left that surface; how
  those interact was NOT changed and NOT measured (map §8 left it open, and it
  is still open).
- **Coach writers untouched** per the LR-6 STOP. The walker still has no coach
  vocabulary, so the coach share of `dateOverrides` is declared, not walked.
- **No mutation testing** of the new precedence owner or the lighter-day overlay
  path.
- **`microcycleForWeek` still has three copies and Monday arithmetic five.** Only
  the sites this stage touched moved onto `dayPrecedence.mondayForDate`;
  collapsing the rest was not done, because a de-duplication that no gate watches
  is the AGENTS.md hazard, and no gate watches those yet.
- **The declared-red combination and its classifier owners are unpaid** (3d).

---

## 7. Predictions vs measurement (§P of the plan)

| Sub-stage | Predicted | Measured |
|---|---|---|
| A | ZERO golden movement | ZERO, byte-identical, no `--write` |
| B | ZERO | ZERO |
| C | ZERO | ZERO |
| D | ZERO | ZERO |

**The differential gate stayed green at every sub-stage with no regeneration.**

**One predicted red did NOT materialise, and the reason is measurable.** §P
predicted `coachScreenUAEFlowTests` [6] *"injury override wins over calendar
marks"* would flip. It did not: **that cell exercises a resolver MOCK**, not the
real resolver — its own comment says the mock "mirrors" Priority 1. It never
pinned the ordering it is named for, and it fails identically on `main`. That is
a fourth sighting of §4a's class, in its sharpest form: **a gate testing a
stand-in for the thing it claims to test.**

---

## 8. Parked for Sam — the whole list

**New this session:**

1. **LR-27** — does the displaced-session snapshot get LR-26's ruling (delete,
   re-derive at read), or does it have a reader the ledger snapshot does not?
   It grows on disk every launch.
2. **The legacy v1 `exposureContract` materialising into stored overlays on
   hydrate** (§3b.2). L15 says a writer of a retired shape is a red-gate defect.
   Is it one, or is the overlay's v1 field still load-bearing?
3. **The injury-filter exemption delta from Task B** — a stored override was
   skipped by the injury filter (`source === 'manual'`); an overlay is not. **A
   lighter day is now re-filterable by a later injury.** That is a behaviour
   question, surfaced rather than decided inside a conversion.
4. **Which ordering wins was decided from your own device note**, not from a
   ruling. Task C converged the live path onto the accepted answer because
   `programStore.ts:1187-1196` calls the accepted answer "correct". If that
   reading is wrong, the flip is the thing to revisit — it is contained in one
   module and two adapters.

**Carried, unchanged:**

5. **%MAS range-vs-binary** — the sheet awaits the load-bearing answer first:
   *was the ≤30s → 110% rule authored as programming law, or is it code that
   accreted?* Nothing breaks until MAS becomes a number.
6. **LR-25** — does the producer's legacy-tail deletion stay, revert, or land as
   its own unit? The code is currently IN `0221d4d`; reverting is mechanical.
7. **LR-26** — ruled, unimplemented, unscheduled.
8. **The declared L-P3 combination and the classifier owners** (§3d) — narrowed,
   not closed, and the containment was the review seat's call.
9. **The hydration-repair in-place branch** (`programStore.ts:1216-1219`) —
   inherited open from stage 0, and §3b.2 is new evidence about what it does.
10. **The two-facts tie-break** in `activeReadinessFactIdForDate`.

---

## 9. Gates at the boundary

```
test:bible                             EXIT 0 END-TO-END, 0 FAIL lines,
                                       last link reached
test:action-walker                     20/20
test:action-walker:deep                20/20, no pre-shrink violation
test:day-precedence-ownership          6/6   (NEW, chained)
test:derived-repair-ownership          4/4
test:readiness-ownership               22/22
test:program-override-ownership        7/7
test:athlete-door-matrix               431/431
test:session-list-combinations         5/5
test:section18-gateway                 91/91
test:legacy-census                     331/331
test:compile                           PASS — no file regressed
test:stage-b-generation-differential   3/3 byte-identical, no --write
```

**`test:bible` end-to-end was the debt stage 0 AND stage 1 both owed. It is
paid.** It had never run on this branch, and the chain is `&&`-joined with the
walker at link 121 — so it could only ever have been paid by a green walker.

---

## 10. Merge state

`main` is untouched at `936bbf7`. The branch is **UNMERGED by design**: stage 1
is not the unit's end, and L10 (Sam's device) remains open for the whole unit.
