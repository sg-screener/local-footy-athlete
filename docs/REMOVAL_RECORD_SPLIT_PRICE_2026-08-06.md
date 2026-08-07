# REMOVAL-RECORD SPLIT — CONDITIONS 1–2 MET, FINAL PRICING — 2026-08-06

`docs/REMOVAL_RECORD_SPLIT_RULING_2026-08-06.md`, priced.
**Conditions 1 and 2 are MET. Condition 4's set does not green. Nothing was
built into the main build; nothing was merged.**

Split built on `scratch/r53-pricing-5` (`a865f866` … `de059e7d`), on top of the
scaffold (`ae242d43`) on top of the built precondition unit (`dc8e8aef`). The
pre-split comparison tree is preserved on `scratch/r53-pricing-5-before`
(`24cb9620`) — it carries the measurement probe and nothing else, so the two
sides differ by the split alone.

---

## 1. CONDITION 1 IS MET — cells 15 and 16 recover

The second requirement in this unit to be met outright, after the lawfulness
suite's 12/12 at the repair-search migration.

```
                                    BEFORE      AFTER
athlete-session-deletion, all legs   17/24      19/24    ·5/5 ·3/3 unmoved
```

Cells 15 and 16 — *"exact Upper Pull/Push component deletion preserves Team
Training and relocates pull/push"* — pass. They were failing `relocated=
undefined:undefined` since the repair-search migration.

**And they recover the way the condition requires, not merely by going green.**
Cell 15 asserts the relocated session's identity is
`w1:tuesday:none:team:strength-component` — the DELETION class's own relocation,
the one that records the typed ownership making a restore reversible. A
tier-4 candidate greening the week first would carry a `tier4-replan:` identity
and fail that line. The typed relocation runs first, exactly as the
constraint-visibility ruling's ordering law demands.

The mechanism is the one the ruling described, and it is visible at the probe:

```
BEFORE  [PROBE] relocate  constraints=[]                 standDown=false  missing=["pull"]
AFTER   [PROBE] relocate  constraints=[]  decisions=[active:2026-07-14]  standDown=true
```

`constraints` is still `[]` and that is CORRECT — the blanking is signed and
untouched. The search stopped asking it.

## 2. CONDITION 2 IS MET — and it is mutation-witnessed, not declared

The claim under test: the APPLICATION path is behaviour-identical. Measured at
the one site where removals are applied and then blanked
(`resolveFinalVisibleSection18Week`), folding the applied constraint list, the
blanked value and the FULL composed week into one digest per derivation
(`utils/applicationPathProbe.ts`, inert without its flag).

**Every scaffold flag OFF — 9,138 composed weeks, seven suites, byte for byte:**

| suite | composed weeks | BEFORE | AFTER |
|---|---|---|---|
| athlete-session-deletion | 3,606 | `cdc2ca80111a8e45` | `cdc2ca80111a8e45` |
| accepted-state-transactions | 1,423 | `6ce9f1647429619e` | `6ce9f1647429619e` |
| athlete-session-move | 2,335 | `897e52f152395ba6` | `897e52f152395ba6` |
| section18-gateway | 381 | `bbf59405070b3329` | `bbf59405070b3329` |
| fixture-identity | 720 | `a6be24002fd0d7cd` | `a6be24002fd0d7cd` |
| phase-structure | 673 | `6b6bb6e144618d72` | `6b6bb6e144618d72` |
| whole-week-repair | 0 | — | — |

**All legs ON — six of seven identical.** Only `athlete-session-deletion` moves
(`3,865 / 0885b2e5d8bf4064` → `3,680 / cbc9d9aad203ec2d`), which is condition
1's recovery seen from the other side: the search stands down, so 185 fewer
candidate weeks are composed.

**The attribution is WITNESSED, not asserted.** Blind both of the search's
record reads back to the consumed field (`LFA_RECORD_BLIND=1`, scaffold only)
and the split tree reprints the pre-split measurement exactly:

```
AFTER, both record reads blinded   entries=3865  digest=0885b2e5d8bf4064  17/24
BEFORE                             entries=3865  digest=0885b2e5d8bf4064  17/24
```

The entire behavioural difference of the split is the search reading the record.
Nothing else moved.

**The witness caught my own error.** The first blind covered only the stand-down
and printed `4229 / d35066ecd58bccf1` — neither side's number. The `emptied`
day-set is a SECOND record read, and blinding one of two proves nothing. A
mutation witness that only half-mutates is
`gate-passing-on-coordinates-it-never-builds` wearing a proof.

### The split costs nothing on the unit it sits on

Every scaffold flag off, the built precondition unit's own gate reprints
untouched: deletion 24/24 · 5/5 · 3/3, accepted-state 23/23 · 10/10 · 10/10,
gateway 91/0, move 22/22, phase-structure 11/11, whole-week-repair 14/14,
week-identity 9/9, derived-repair 4/0, day-precedence 6/6, fixture-identity 3/3
(the standing red). Typecheck gate **PASSED** — 459 total, no file regressed.

### What was built, and where the two fields cannot drift

`AcceptedEffectiveWeekSurfaces` gains `removalDecisions`, required. ONE composer
(`liveEvaluationSurfaces.composeAcceptedEffectiveWeekSurfaces`) populates both
fields; there is no other constructor, and making the field required surfaced
**24 product doors** that had been passing the store itself as surfaces by
structural typing. Twenty-one of them pass a world whose removals have
not been consumed — record and input are the same list — and say so through
`storedWorldSurfaces`, one line stating that once instead of twenty-one times;
two compose an arriving snapshot through the composer directly.

**The twenty-fourth is the delete-vs-move dual set** (`acceptedStateTransaction.ts`), and
it is the only site where the two fields differ: a delete APPLIES the prior set
so the binned target survives as a relocation template, while the RECORD already
carries the decision. That divergence is named (`applyOnly:`), which is the
difference between a decision and drift.

`ScheduleState` carries `removalDecisions` through the derivation — the gateway
sets it BELOW the `...args.scheduleState` spread, beside `currentProgram` and
`markedDays`, so no caller can substitute its own.

---

## 3. CONDITION 4 — the final pricing, and the STOP

| witness | required | PREVIOUS (`ae242d43`) | NOW (`a865f866`) |
|---|---|---|---|
| `derived-week-lawfulness` | all worlds | 12/12 ✔ | 12/12 ✔ |
| `phase-structure` | 11/11 | 11/11 ✔ | 11/11 ✔ |
| `action-walker` (L16) | 20/20 | 20/0 ✔ | 20/0 ✔ |
| `section18-gateway` | 91/0 | 91/0 ✔ | 91/0 ✔ |
| `whole-week-repair` | 14/14 | — | 14/14 ✔ |
| `derived-repair-ownership` | able to red | 4/0 | 4/0 |
| `action-walker:deep` | 20/20 | 19/1 | 19/1 |
| `fixture-identity` | 6/6 | 3 pass, 3 fail | 3 pass, 3 fail |
| `athlete-session-deletion` | 24/24 · 5/5 · 3/3 | 17/24 · 5/5 · 3/3 | **19/24** · 5/5 · 3/3 |
| `accepted-state-transactions` | full | 22/23 · 8/10 · 10/10 | 22/23 · 8/10 · 10/10 |
| `athlete-session-move` | 22/22 | 21/1 | 21/1 |

**Condition 4 is not met.** Five of eleven witnesses are clean, up from four, and
no row got worse. Per the condition's own instruction: **STOP with the residual
named.**

### The best row this unit has produced — leg (i) withdrawn, with the split

```
athlete-session-deletion      22/24 · 5/5 · 3/3     (was 21/24 pre-split)
accepted-state-transactions   23/23 · 8/10 · 10/10
derived-week-lawfulness       12/12 ✔     phase-structure  11/11 ✔
action-walker  20/0 ✔          action-walker:deep  19/1
fixture-identity  3 pass, 3 fail          athlete-session-move  21/1
```

Two deletion regressions from green, and they are named: **21** (*conditioning
component restoration preserves the stacked strength component*) and **22**
(*Restore removes only its typed reduction and preserves an unrelated
reduction*). Both are RESTORATION cells — the other half of the ownership the
stand-down protects.

---

## 4. THE RESIDUAL — the blocker returns to leg (i), where the seat left it

The split did what it was ruled to do and cost nothing. The remaining reds are
not its. Attributed by flag, not assumed:

- **Withdrawing leg (i) alone** takes deletion 19 → 22, accepted-state
  regressions 22/23 → 23/23. Everything else is unmoved.
- `action-walker:deep`'s one failure prints 20/0 with every flag off, so it
  belongs to the scaffold and not to the split.
- `fixture-identity`'s three cells are unmoved in EVERY variant this unit has
  measured, including this one.

**That is the finding the resolved-authority re-price already recorded, and this
pricing does not disturb it:** the stored §18 contract is an INPUT to pattern
identity, and leg (i) retires it. The seat's own words on that stop —
*"whether the retirement may proceed depends on who owns pattern identity —
which is a ruling, not a build, and it is the seat's."*

Two rows are newly attributable and are offered as evidence for that ruling:

1. **The split moved the leg-(i)-withdrawn deletion row from 21/24 to 22/24.**
   The remaining two cells are both RESTORATION, which is the same ownership
   boundary from the other direction: the stand-down keeps the search from
   greening a week a deletion explains, and 21/22 ask whether a RESTORE removes
   only what it owns. That is one more argument that the boundary is real and
   in the right place.
2. **`accepted-state-transactions` reaches 23/23 regressions** in that variant —
   every regression green, two properties short (*hydration remains
   deterministic and idempotent*, *a fixture MOVE publishes its dependent week
   once*).

---

## 5. Conditions 3 and 4 of the ruling — NOT STARTED, and named as not started

The ruling ordered the two owed pins to land in the main build. **Neither
landed, and neither is inferred from a green suite.** They are debts of the
BUILT precondition unit (`dc8e8aef`), independent of the split, and building
them into the main build during a STOP is the move seven conditions in this unit
forbid by name. Stated so the seat can price them rather than discover them:

- **Condition 3's pin — hydration snapshot-vs-live.** `programStore`'s
  hydration door passes the ARRIVING snapshot, not the live store, and that is
  reasoned and wired. It is measured 88 times in the witness set, every one with
  an empty constraint set: **no cell exercises the distinction**, so it is
  unproven. Unchanged by this unit.
- **Condition 4's clock fix — 172 wall-clock stamps → one injected `todayISO`.**
  Re-measured on this tree, unchanged by the split: **146 stamps (4 distinct)**
  in worlds W2/W2r and **172 (5 distinct)** in W3-fixture-only. The number
  matters more than it did: condition 2's digest was NOT reproducible run to run
  until every `createdAt`/`updatedAt` was normalised out of it, so on this tree
  two runs of the SAME code already disagree byte-for-byte on the composed week.
  That is not a measurement artefact — it is the defect, printing.

---

## 6. Status

- **Condition 1 (the search stands down; cells 15/16 recover):** **MET.** The
  typed relocation runs first, proven by cell 15's own identity assertion.
- **Condition 2 (application path byte-identical):** **MET**, and witnessed by
  mutation rather than declared.
- **Condition 3 (the two owed pins land in the main build):** **NOT STARTED**,
  named above with both numbers re-measured on this tree.
- **Condition 4 (final pricing):** MET as a process, FAILED as a result, for the
  eighth time. **STOP with the residual named.**
- **Built into the main build:** nothing. **Merged:** nothing. **Scaffold:**
  preserved on `scratch/r53-pricing-5`, with the pre-split comparison tree on
  `scratch/r53-pricing-5-before`. Main branch tree clean.
- **The blocker has not moved this time, and that is the report.** It is leg (i)
  and the ownership of pattern identity — a ruling the seat still owes, now with
  two more rows of evidence for it.
