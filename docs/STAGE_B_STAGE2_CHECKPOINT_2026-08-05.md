# Stage B — Stage 2 CHECKPOINT, 2026-08-05

**Branch `feat/stage-b-stage2`, cut from stage 1's tip `8dc35a2`. `main`
untouched at `936bbf7`. UNMERGED — L10 stands open for stages 1+2 together
(one combined device pass, per the kickoff).**

Priorities A and B(part) are done and green. `test:bible` **EXIT 0 end to end,
zero FAIL lines, last link reached**, with the LR-27 fix in.

---

## 1. The convergence question, answered first

> **Does this move the app toward "store decisions, derive everything"?**

**Toward, and on the load-bearing one it is the north star's own sentence.**

| Work | What moved | Direction |
|---|---|---|
| **A** — the blind spot | No production code changed. A coordinate system gained the axis that names a defect, and a gate gained a non-vacuity contract | neutral on storage, **toward** on honesty: a declared red now states what it IS |
| **B** — LR-27 | A workout snapshot that existed only because a derived filler was re-read as its own displaced predecessor is **gone**. Recursion is now unrepresentable, not capped | **toward** — stored output deleted at its root |

**Nothing stored was added.** One field (`restorationSource`) was threaded
through a pure function as a parameter, not persisted.

---

## 2. Priority A — the blind spot has true coordinates (`31e0d79`)

The stage 1 report carried this honestly: `team_night × [conditioning,strength]`
**agrees in all 6 matrix observations while the deep walker reds on it.** The
declared red's coordinates did not characterise the defect. Sam's priority A:
instrument first, then fix or declare with true coordinates.

**Instrumented, then measured — not inferred.**

- `sessionListKinds` gained the **third axis**, `rowComposition` /
  `rowCompositionCoordinate`: the roles the template badges its rows with, the
  component-owner buckets that are non-empty, and how the day's conditioning is
  **wired** (`flagged` / `block_no_flag` / `rows_no_wiring`). One owner, so the
  walker and the matrix cannot drift into two coordinate vocabularies.
- The walker gained `WALKER_LOG_LP3=1`, printing that coordinate for every
  `L-P3 TEMPLATE = PROJECTION` disagreement **before** declared-red filtering.

**The measurement (deep tier, step 63, 2026-08-19).** The failing day is:

```
roles=[midline] buckets=[conditioning,strength] cond=block_no_flag
rows: "Dragon Flag" (no authored role), "Erg EMOM - 10-15 cal"
workoutType: "Team Training"
```

Two mechanisms on one day, both **pre-existing composition code**:

1. **The conditioning is wired `block_no_flag`** — a `conditioningBlock` names
   the rows but `hasCombinedConditioning` is off. That is the shape
   `stackTemplate` builds when a session stacks onto a team anchor with **no
   strength owner** (`canonicalPlanChangeCandidateMaterializer.ts:198`). The
   template emits conditioning off the **flag** (`sessionTemplate.ts:257`); the
   component owner reads the **block ids**. So the list drops it.
2. **The sole trunk row is not sole content** beside conditioning
   (`sessionComponents.ts:658`), so it buckets `strength` for the projection
   while the template's name classifier badges it `midline` → `support`. Being
   the only gym row, `strength` vanishes from the template entirely.

**Why the six agreeing observations agree:** they are all
`roles=[accessory,main_lift] cond=flagged` — real strength rows, flagged
conditioning. The matrix never builds the failing composition. That is the
whole blind spot, and it is now stated as a measurement rather than a suspicion.

**L12 — what catches the next one.** The report's cheapest proposal is
implemented: matrix cell **[6]**, the non-vacuity contract. A blind spot now
declares the composition its defect lives at, and:

- reached **and disagreeing** → cell [5] fails: promote it to `CONTAINED`;
- reached **and agreeing** → cell [6] fails: the characterisation is falsified,
  re-measure it;
- not reached → it stays an honest blind spot, and the census **prints the
  compositions reached instead**.

**Not fixed, deliberately.** No classifier changed, no regex widened. The
payment is still the D13 / `sessionComponents` owners, and it is still Sam's —
declaring a combination is containment, not payment.

---

## 3. Priority B — LR-27 paid at its root (`ba7f12a`, `92484f3`)

### 3a. The receipts came first, and they reshaped the unit

Sam's ruling 3: *delete the nested snapshot, keep the reference, re-derive at
read — builder verifies with receipts that no consumer needs the snapshot over
the reference before deleting.*

Three receipts, in order:

1. **Reader sweep.** `displacedSession.workout` has **zero** product readers.
   `restoration.workout` has exactly **one**: `withoutDerivedScope` at
   `scope === 'session'`. Everything else reads `sourcePlanEntryId` /
   `targetDate` — references, not content.
2. **Whole-bible mutation.** With the reader made to ignore the snapshot
   entirely, the entire bible reds **exactly one cell**:
   `wholeWeekRepairEngineTests` *"expired G+1 recovery restores the exact
   displaced Monday"*.
3. **`LR27_PROBE=1` on the deep walker — the one that changed the design.**
   In **every acted-world invocation**, the snapshot was a copy of **the very
   workout carrying it**: carrier and snapshot shared one id
   (`derived-arms_pump-…:week-overlay:…`), and the record carried **no
   `sourcePlanEntryId` at all**.

### 3b. What the doubling actually was

**Never a restoration.** `applyGameProximity` derives a G-1 Gunshow / G+1
flush, `materialiseVisibleSystemWork` persists it into the week overlay, and
the next resolve reads that stored filler back as its own *displaced template* —
because `resolverMayDisplace` asks only whether the **athlete** placed it, which
of a filler is true. So the filler was snapshotted into its own successor:
depth +1, payload ×2, every launch, **on disk**.

### 3c. The fix, and why it is not another guard

It asks the predicate that **already owns the question** —
`isResolverOwnedDerivedSession` (system-authored game-proximity provenance plus
no backing plan entry, whose own doc says *"a filler has no backing plan
entry"*). A filler is not an accepted session; there is nothing underneath it to
give back. So the dependency records the reference and **no snapshot**.

**Recursion becomes structurally unrepresentable rather than bounded.** Sam
rejected cap-and-compress on the twin precisely because they accept the premise
that the snapshot belongs there.

**Measured after:** 6 invocations with 2 self-copies → **2 invocations, both
`snapshot=null`**. The L16 relaunch pin is **reversed in the same commit as the
census entry**, per the ratchet: it required growth of exactly one level, it now
requires **zero**.

---

## 4. PARKED FOR SAM — two premise corrections, neither guessed at

### 4a. LR-27's residue — the only thing defending it is a fixture nothing reaches

`restoration.workout` **still** stores a full `Workout` when a genuine
**accepted** session is displaced (the G+1-over-accepted-Monday shape). That is
still stored output by the north star's definition. Two receipts bound it and
they disagree:

- the whole-bible mutation reds **exactly one** cell;
- **that cell's world is HAND-BUILT**, and no acted world the deep walker
  reaches produces it.

So the only thing standing between this field and deletion is a fixture nothing
reaches by acting — **the mirror image of the class named on 2026-08-04**, and
the reason it was not deleted here. Deleting on that evidence would be guessing;
keeping it silently would be the debt the census exists to stop.

**Question for Sam:** does the accepted-session restoration have a real
production path (in which case the fixture is modelling something true and the
snapshot stays until the reference can be resolved), or is it dead machinery
kept alive by its own test?

### 4b. LR-26's ruling rests on a premise the code contradicts — STOP before implementing

Sam ruled LR-26 on the basis that **nothing reads the ledger snapshots back**.
Measured 2026-08-05, that is **half wrong**, and the half matters:

| Field | Read? | Evidence |
|---|---|---|
| `beforeWorkout`, `beforeSurfaceWorkout`, `beforeDateOverride`, `beforeOverrideContext` | **YES — in full, to restore** | `reversibleAdjustmentTransaction.ts:511-553` writes them straight back onto `dateOverrides` / `weekScopedOverlays` on undo |
| `afterWorkout`, `afterSurfaceWorkout` | **Content never read** | only `.planEntryId ?? .id` (`acceptedStateTransaction.ts:1193, 1458`) — an identity |
| `afterDateOverride`, `afterOverrideContext` | only as a fingerprint | `semanticFingerprint(...)` comparison, `:205-211` |
| `afterFingerprint` | yes | already stored beside the snapshot it duplicates |

**So the after-side is the deletable half** — its content is never consumed, and
a fingerprint plus an identity already sit next to it. The **before-side is the
undo's restoration data**, read in full.

**This is Task A's shape again** ("the ruling's premise was stale, and the
diagnosis got sharper"), so it is parked rather than built. **The twins did NOT
ship together, and that is a deliberate stop, not an omission.**

**Question for Sam:** (a) delete the after-side snapshots only, keeping the
identity + fingerprint that already exist — a real payload cut with no
behaviour change; and (b) is the before-side "stored output" at all, or is it
the decision's own content? The north star would say the before-state is
derivable by replaying decisions; the undo path today is not built that way, and
rebuilding it is a much larger unit than the ruling's sentence implies.

---

## 5. Gates at this checkpoint

```
test:bible                             EXIT 0 END-TO-END, 0 FAIL, last link reached
test:action-walker                     20/20
test:action-walker:deep                20/20 (LR-27 pin REVERSED: growth must be zero)
test:session-list-combinations         6/6   (cell [6] NEW — the non-vacuity contract)
test:legacy-census                     331/331
test:compile                           PASS — no file regressed
test:stage-b-generation-differential   3/3 byte-identical, no --write
```

**The differential prediction held**: zero golden movement for both A and B,
byte-identical with no regeneration.

---

## 6. NOT COVERED

- **No device pass.** L10 stands open for stages 1+2 together.
- **LR-26 not implemented** — §4b, deliberately stopped on a premise correction.
- **LR-27's residue not deleted** — §4a, Sam's to rule.
- **The classifier owners (D13 / `sessionComponents`) are still unpaid.** Priority
  A named the defect; it did not fix it. Declared reds #1 and #3 stand.
- **Priorities C and D not started** — the conditioning slice from the 55
  templates, and the survey-first opens (v1 `exposureContract` vs L15, the
  hydration-repair in-place branch, the two-facts tie-break).
- **No mutation testing of the LR-27 fix itself** (the fix was *derived* from a
  mutation experiment, which is not the same thing).
- **The matrix still does not reach the failing composition.** It now says so
  precisely instead of vaguely, which is the improvement; building a world that
  reaches it is the matrix's own next unit.
- **`WALKER_LOG_LP3` and `LR27_PROBE` are instruments, not gates.** They print
  when asked and are inert otherwise.

---

## 7. Where the next session picks up

1. **Sam's two questions in §4** — they gate the rest of LR-26/LR-27.
2. **Priority C**: conditioning from the 55 signed templates — the third
   vocabulary dies, %MAS per ruling 4 (the ranges own intensity; the accreted
   `≤30s → 110%` binary dies when MAS wiring lands; anything athlete-visible
   returns through the copy sheet), one typed dose-string parse at one ingress,
   building outward from the L16 slice mode by mode.
3. **Priority D**: survey-first on the carried opens, receipts then rulings.

**Environment law:** this working tree is shared. Verify
`git branch --show-current` before every commit. This session found **222 stale
zero-byte `.git` lock files** from a crashed process and removed them after
confirming no git process was live — worth knowing if git suddenly refuses to
commit.
