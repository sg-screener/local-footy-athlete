# CONSTRAINED-WORLD VERIFICATION CORRECTION — 2026-08-14

**Base: `slice-b3-constrained-worlds` @ `2fc793e2`.** Separate worktree; the
shared checkout was never touched. **No production behaviour changed** — this is
a verification correction, and the 180-world sweep is byte-for-byte identical.

**THE STANDING RULE THIS ESTABLISHES:** *a constrained world's result counts only
with a positive LIVENESS RECEIPT — proof its constraint actually entered the
production route. A fixture producing "no change" without a receipt is a broken
fixture, not a green.*

**Three of the previous matrix's ten rows were exactly that.** One of them
described a world that **cannot exist**.

---

## 1. READINESS — CORRECTED, AND THE WINDOW RULE IS PROVEN

**What was wrong.** The fixture invented
`{ soreness: 5, fatigue: 5, sleepQuality: 1, mood: 1, overall: 'cooked' }`.
**Not one of those is a field of `ReadinessSignal`** (`date`, `energy`,
`soreness`, `painFlag`, `source`, `updatedAt`, …), and readiness does not enter
generation as a signal at all: `readinessTierFromConstraint` accepts
`type: 'fatigue'` **only**, tiers on `severity` (≥4 wrecked, ≥8
absolutely-cooked), and carries the window from `startDate`/`expiresAt`.

**Liveness receipt — the production owner's own answer:**

```
readiness recognised .... true
deloaded ................ true
weekDeloaded ............ true
window .................. {"startISO":"2026-07-15","endISO":"2026-07-21"}
```

**The window rule, proven both directions:**

| | |
| --- | ---: |
| main lifts reduced INSIDE the window | **1** (`d4 Bench Press 3 → 2 sets`) |
| main lifts changed OUTSIDE the window | **0** |
| days outside the window byte-identical | **true** |

A Wednesday declaration reduces Thursday and leaves Monday and Tuesday exactly
as they were. That is R-035 holding on composed strength.

## 2. SCHED-CONSTRAINT — CORRECTED, AND THE RECEIPT NAMED THE WRONG OWNER

**What was wrong.** The old row reported "0 dose change" and called it correct.
It was correct *by accident*: the constraint never reached the route it was
being measured on.

**A schedule constraint is DELIBERATELY not a structural generation
constraint** — `readinessTierFromConstraint` takes fatigue only, because *"I have
25 minutes on Wednesday" says nothing about how recovered the athlete is*. It
enters as a **HARD POST-GENERATION constraint** instead. So the receipt had to be
taken at that owner:

```
structural generation constraint ... []     (fatigue-only, BY DESIGN)
HARD post-generation constraint .... true   <- the real owner
```

**Placement change, proven:**

| | |
| --- | --- |
| control Friday | `"Gunshow" [Strength]` — 6 rows |
| constrained Friday | `"Rest" [Rest]` — 0 rows |

Zero dose change is expected and correct: an unavailable day removes the
session, it does not re-dose the surviving ones.

**Other days are NOT identical, and that is the constraint working, not
leaking:** removing Friday changes what the planner allocates across the
remaining days. Reported rather than asserted away.

## 3. DELOAD-SCHED — THE PREVIOUS WORLD COULD NOT EXIST

**This is the significant correction.** `resolveSeasonPhaseWeekKind` mints a
scheduled deload for **Pre-season** (`phaseWeek % 4 === 0`) and **Off-season**
(`phaseWeek > 4`, `(phaseWeek − 4) % 4 === 0`) — and **never for In-season**,
which is D16's own rule: in-season backs off through the readiness and illness
doors, not the block plan.

The old row used the **In-season** profile. Measured now:

```
week 1: weekKind=build
week 2: weekKind=build
week 3: weekKind=build
week 4: weekKind=build      <- no deload anywhere in the block
```

**So the old "DELOAD-SCHED: BUILT" row described a deload world that did not
exist**, and its "control" (WEEK-4) was the same week twice — which is why the
two were fixture-identical.

**Rebuilt on a phase that has one.** Pre-season block, liveness receipt:

```
week 1: build   week 2: build   week 3: build   week 4: DELOAD
```

**Week 4 (deload) vs week 3 (build) — the deload law's arithmetic, visible:**

| day | build | deload |
| --- | --- | --- |
| 1 | main sets `[3,3]`, accessories 3 | main sets `[2,2]`, accessories **1** |
| 2 | main sets `[3]`, accessories 2 | main sets `[2]`, accessories **1** |
| 4 | main sets `[3]`, accessories 2 | main sets `[3]`, accessories **1** |
| total rows | **12** | **8** |

Main sets halved to the floor of 2 on days 1 and 2, accessories trimmed on all
three days, twelve rows down to eight — `DELOAD_LAW`'s signature exactly.

**⚠ HONEST LIMIT ON THIS COMPARISON.** The two weeks share **zero main lifts by
identity**, because rotation changes the lift week to week — so this is a
comparison of dose SHAPE, not of the same lift before and after. Day 4's main
staying at 3 sets is therefore **not explained** by this measurement: it is a
different exercise from week 3's, and it may have been authored at a higher set
count. A same-lift comparison would need the deload suppressed on the same week,
which no production input allows. Stated rather than smoothed over.

---

## 4. REPORT WORDING CORRECTED

The previous report called the `generationConstraints` rebuild *"a real plumbing
asymmetry"* and listed it as something a reviewer should read before merging.
**That overstated a fixture's mistake into a product finding.**

**Measured: no production caller supplies `options.generationConstraints`** —
the only call sites passing it are `generateProgram.ts` itself and a scratch
probe. Production supplies **raw facts**, and the per-week rebuild is deliberate
because a week's constraint context is a function of that week's dates.

Corrected in §4, §5 and the merge recommendation of
`CONSTRAINED_WORLD_ACCEPTANCE_2026-08-14.md`.

**LEDGERED, NOT DELETED:** `options.generationConstraints` is an input nothing
supplies — the same class as the dead code this campaign has been removing. It
is a **deletion candidate for a later slice**, deliberately not deleted here.

---

## 5. GATES

| gate | result |
| --- | --- |
| 180-world sweep | **120 retained · 0 lost · 0 gained · 0 content changed** |
| `test:compile` | PASSED, baseline unchanged |
| `test:generated-week` | 36 / 0 |
| `test:generated-week-assembly` | 30 / 0 |
| `test:composer-severance` | 73 / 0 |
| `test:feature-registry` | 6 / 0 |
| `test:pools` | 473 / 1 — the known pinning red only |

**Boot on the corrected worlds: NOT IDENTICAL, and the reason is structural
rather than a failure.** `partialize` persists **facts**, never
`activeConstraints` — a constraint is a projection of a fact. Readiness and
schedule were driven here as CONSTRAINTS (the only channel that reaches the
route), so they cannot survive a relaunch as such, and the regenerated week is
legitimately the unconstrained one. The fact-driven worlds in the previous
matrix (illness) **did** boot identical, which is the control proving the
mechanism works when the input is a persisted fact.

---

## 6. NOT ESTABLISHED

- ~~An observation I could not isolate…~~ **ANSWERED 2026-08-14 by the final
  boot check** ([`B3_BOOT_CHECK_2026-08-14.md`](B3_BOOT_CHECK_2026-08-14.md)).
  Driven through the real durable door with **nothing seeded**, a persisted
  schedule fact **does** re-derive its constraint across a relaunch
  (`{count:1, kinds:['schedule']}` before and after), and a readiness fact does
  the same. The earlier observation was the seeded probe, exactly as suspected.
  **The persistence-to-generation handoff is proven for both inputs.**
- Why day 4's main lift holds 3 sets in the deload week (§3).

## 7. NOT COVERED

- Off-season scheduled deloads (only Pre-season was used to find a real one).
- Constraint **combinations**; every world still carries one.
- The equipment world was not re-verified in this pass — it already had a
  behavioural receipt (`REFUSED: required_safe_patterns_present:squat`).
- Everything else out of scope by the mission: the 60 refusals including the
  squat cell, Friday capability, session counts, pinning, projection, the B2
  loop, and the `generationConstraints` deletion itself.

---

## 8. MERGE RECOMMENDATION

**Merge.** All three corrected worlds now carry positive liveness receipts, the
readiness window rule and the deload arithmetic are both proven on composed
strength, no production behaviour changed, and every gate holds with the sweep
byte-for-byte identical.

**One thing to carry forward rather than resolve here:** the boot question in §6
— whether a schedule constraint is re-derived from its persisted fact at
relaunch. It is unverified, it is cheap to answer with a fact-only run, and it is
the kind of question this correction exists to stop being answered by assumption.

*Agent: core, 2026-08-14.*
