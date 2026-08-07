# CONDITION 1 — REPAIR-SEARCH MIGRATION — 2026-08-06

Condition 5 of `docs/DERIVER_ACQUIRES_REPAIR_SEARCH_RULING_2026-08-06.md`:
*price the full witness set. Green → build. Not green → STOP with the residual
named.*

**The priced set does not green. Nothing was built. Nothing was merged.** Tree
clean; scaffold preserved on `scratch/r53-pricing-3-scaffold`
(`bd6dccb3` … `2eedd2d4`).

**But the ruling's own headline requirement is MET, and it is the first thing
in this unit to be met outright: the lawfulness suite passes 12/12 in ALL its
worlds, including cell 3's.** The derived week is now lawful where it was not.
That is §1.

**The residual is a CENSUS, and it is one line: five of the twelve gateway
callers never pass `userRemovalConstraints`, so the search cannot resolve the
authority condition 3 requires it to resolve.** That is §4.

---

## 1. WHAT THE MIGRATION BOUGHT — the derived week is lawful

`npm run test:derived-week-lawfulness`, with the stored contract retired:

```
  PASS W2               lawful-1 / lawful-2 / lawful-3      ledger {squat:1,hinge:0,push:1,pull:1}
  PASS W2r              lawful-1 / lawful-2 / lawful-3      ledger {squat:1,hinge:0,push:1,pull:1}
  PASS W3-fixture-only  lawful-1 / lawful-2 / lawful-3      ledger {squat:1,hinge:1,push:1,pull:1}

  Derived-week lawfulness totals: 12 passed, 0 failed
```

W3 is the world the last stop died in — a fixture and nothing else, so no
decision authorises an imbalance. `hinge:1` is the whole ruling in one field:
the fixture consumes the Saturday, G-1 demotes the Friday that carried the
week's only hinge, and **the deriver now relocates it** instead of losing it.

`test:fixture-identity` cell 3 records the same thing from the other side. It
was four disagreeing days; it is now **one**:

```
  before the migration   Lower Hinge|7 -> Lower Squat|8, Upper Push|3 -> Upper Pull|3,
                         Prehab|6 -> Prehab|5, Upper Pull|3 -> Upper Push|3
  after                  Lower Squat|7 -> Lower Squat|8
```

The pattern disagreement between the published week and the derived week is
gone. What is left is a row count on one day.

### What was migrated, in the :4688 order

All of it inside the gateway, so the deriver and the publisher run ONE search —
the ruling's "migrates, not duplicates".

1. **RELOCATE** — `repairDisplacedStrengthCandidates`. Templates come from the
   week's AUTHORED plan, passed in by tier 4 as `strengthTemplates`: a displaced
   session is gone from the candidate by definition, so the week cannot supply
   its own template. Fires only on a strength/pattern violation (condition 1).
2. **SUBSTITUTE / MOVE OPTIONAL** — `repairCoreConditioningShortfallCandidates`
   widened. It already knew how to place required core conditioning; it was only
   ever ASKED when the week missed its FLOOR. A relocation landing on a day that
   was paying a conditioning bill leaves the week short against the
   PLANNER-SELECTED target instead — same gap, one rung up, same answer.
3. **TYPED REDUCTION LAST** — `withDisplacedCapacityReduction`. It fires only
   when a fact displaced the capacity and it NAMES that fact, so it cannot
   become the fall-through the resolved-authority ruling retired. The floor is
   never reduced, only the selected target.

**ONE OWNER, NOT TWO:** `stripConditioningComponent` moved out of
`fixtureMinimalReplan` into `rules/sessionRowCounting`; the publisher imports it
from there.

### Three defects the measurement found in my own migration

Recorded so the numbers are not read as measuring a clean scaffold.

1. **The :4688 order is not decoration.** The typed reduction was first written
   as a normalisation beside the power budget — which put it BEFORE the search.
   A reduction taken before relocation ran deleted the shortfall the relocation
   existed to answer, and the deletion class's own relocation stopped happening
   (`relocated=undefined`). It now runs as a second pass after the search has
   exhausted, which is the only way a contract-level repair can take its turn:
   `assess` re-clones the contract from the base every candidate.
2. **Only the lift travels, and power counts as luggage.** A relocation template
   carrying its power rows put the week over its own authorised reduction
   (`reduction_contradiction:power`) — a repair breaking the arithmetic of the
   repair before it. Ruling 4a is why: the weekly budget decides what competes
   for a primer slot, and that decision is taken before the relocation exists.
3. **The proof was measuring a contract no surface uses.** Tier 4's output is
   never stored, so rebuilding a contract beside the deriver measured one
   nothing reads. `lastTierFourDerivation` (diagnostic-only, written by the
   deriver, read only by the proof) is what the proof reads now.

---

## 2. The measurement

| witness | required | measured |
|---|---|---|
| `test:derived-week-lawfulness` | all worlds | **12/12** ✔ |
| `test:phase-structure` | 11/11 | **11/11** ✔ |
| `test:action-walker` (L16) | 20/20 | **20/0** ✔ |
| `test:fixture-identity` | 6/6 | 3 passed, **3 failed** |
| `test:athlete-session-deletion` | 24/24 · 5/5 · 3/3 | **17/24** · 5/5 · **3/3** |
| `test:accepted-state-transactions` | full | **22/23** · **8/10** · 10/10 |
| `test:action-walker:deep` | 20/20 | **19/1** |
| `test:derived-repair-ownership` | able to red | 4/0 — **not able to red** |

**Condition 1 is not met.** Three of eight witnesses are clean, up from two.

The mutation witnesses hold at **3/3** and the deletion properties at **5/5** —
the resolved-authority bound remains free through a third structural change.

Attributed, not assumed: `test:action-walker:deep` prints **20/0** with every
flag off, so its `L-P3 TEMPLATE = PROJECTION` failure belongs to this scaffold.

**Deletion went 19/24 → 17/24**, and the two new reds are cells 15 and 16
(*"exact Upper Pull/Push component deletion preserves Team Training and
relocates pull/push"*, failing `relocated=undefined`). Attributed by flag:
disabling the relocation generator alone restores 19/24. That is §4.

---

## 3. Conditions 2 and 4

- **Condition 4 (the two lawfulness corrections are keepers):** carried, and
  they are load-bearing — the derived contract reading the DECISION ledger is
  what makes W2/W2r lawful at all.
- **Condition 2 (determinism; the 146 wall-clock stamps paid, `todayISO` as one
  injected input):** **NOT STARTED.** Determinism is proven on the WEEK — two
  consecutive derivations and a relaunch are byte-identical once stamps are
  normalised — but the stamps themselves are still minted from the wall clock
  (176 per derivation under the migration, 4 distinct). Condition 1 says price
  before building, and the priced set does not green, so the clock injection was
  not started rather than half-done. Stated plainly rather than left to be
  inferred.

---

## 4. THE RESIDUAL — the search cannot resolve authority it is never given

Condition 3 requires that *"every relocation or substitution the search performs
names the fact or decision that authorises it"*. Instrumented on the deletion
suite, the search sees this:

```
[PROBE] relocate {"wk":"2026-07-13","constraints":[],"standDown":false,"missing":["push"],"templates":5}
```

**`constraints: []`.** On that path the gateway is called without
`userRemovalConstraints` at all, so the search cannot tell that a DECISION
explains the missing pattern. It relocates, its candidate greens the week first,
and the deletion class's own relocation — the one that records the typed
ownership making a restore reversible — never runs. Hence
`relocated=undefined` on cells 15 and 16.

The stand-down is written and correct; it simply cannot fire on an empty list.

**The census, counted rather than assumed — 5 of 12 gateway callers pass no
removal constraints:**

| caller | passes `userRemovalConstraints`? |
|---|---|
| `fixtureMinimalReplan.ts` :1186, :1362, :1396, :1510 | yes (4) |
| `programStore.ts` :1286 | yes |
| `sessionResolver.ts` :955 (tier 4) | yes |
| `postGenerationConstraintValidation.ts` :1267, :1358, :1574, :1774 | **no (4)** |
| `programStore.ts` :903 | **no** |

This gap is PRE-EXISTING and was harmless until now: no candidate generator
asked about removals, so nothing noticed. **The moment the search acquires a
repair that must defer to a decision, the omission becomes load-bearing** — and
condition 3 cannot be satisfied without closing it.

That is `LR-1`'s shape at a different seam and the fourth-door shape again: a
census that enumerated the CALLERS never enumerated what they CARRY.

### What the seat has to rule

The migration is right and the lawfulness proof says so. The question is scope:

> Closing the census means five call sites gain an input they have never had,
> two of them inside `postGenerationConstraintValidation`'s generation path
> where removal constraints may not exist yet. Is that this unit's work, or is
> it a precondition unit of its own — "the gateway is told about decisions at
> every door" — priced and landed before the migration?

My reading, offered not assumed: it is a **precondition unit**. It is a
single-purpose, independently-gateable change with its own witness (the search
standing down where a decision owns the repair), and threading it through five
doors inside an already-red pricing is how the last four stops happened.

---

## 5. Status

- **Condition 1 (final pricing):** MET as a process, FAILED as a result. Per the
  condition's own instruction: **STOP with the residual named.**
- **Built:** nothing. **Merged:** nothing. **Scaffold:** preserved on
  `scratch/r53-pricing-3-scaffold`; working tree reverted and clean.
- **The ruling is confirmed by its own headline test.** Lawfulness 12/12 in all
  worlds, cell 3's disagreement down from four days to one, and the mutation
  witnesses never moved.
- **Condition 2 not started**, and named as not started.
- **The blocker is now a supply problem, not a design one**: the search is
  correct and cannot see what it needs to be correct WITH.
- **Condition 6** (unpiped bible, condition 4 markedDays proof, merge, post-merge
  bible, R5.7, remaining batches): not started — gated on a build that did not
  happen.
