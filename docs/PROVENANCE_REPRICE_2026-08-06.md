# CONDITION 1 RE-PRICE — THREE LEGS + THE PROVENANCE RULE — 2026-08-06

Condition 1 of `docs/THREE_LEG_CONFORMANCE_RULING_2026-08-06.md`, restated by
`docs/REDUCTION_PROVENANCE_RULING_2026-08-06.md`: *re-price all legs plus the
provenance rule against the FULL witness set. Green before building. STOP and
report if not.*

**The priced set does not green. Nothing was built. The scaffold is reverted**
— `git status` is clean and the tree this document lands on reprints
`3 passed, 3 failed` on `test:fixture-identity`, `11 passed, 0 failed` on
`test:phase-structure`, and green on both transaction suites.

But the residual the last stop handed the seat **is resolved, by measurement,
and it resolves the second way.** The pin stands unedited. That section is §3
and it is the point of this document.

The scaffold from `c45792e9` was not recoverable — condition 4 reverted it and
no stash, dangling commit or working copy survived — so all three legs were
rebuilt from the price doc's own site list before anything could be measured.

---

## 1. What was scaffolded

All three legs plus the provenance rule, each behind its own environment flag.
Every flag off reprints the clean-tree baseline byte for byte (§2 row 2), so
nothing below is misattributed to a scaffold that was never inert.

- **Leg (iii)** — `src/rules/derivedWeekContract.ts` (new). `deriveWeekContract`
  takes the covering week's stored contract as identity owner and lets
  `targetWeekFixtures` decide mode, anchor state and fixture day, recovering
  every other input from the contract. Returns the stored object itself when
  the facts already agree. Installed at **both** sites (see defect 4).
- **Leg (ii)** — `utils/sessionResolver.ts:1677`, the Contract v2 branch. §18
  runs as tier 4 through `runSection18AcceptedWeekGateway` with
  `resolveVisibleWorkouts: (w) => [...w]` — the projection IDENTITY the ruling
  specifies, which is also what stops the gateway re-entering the resolver.
- **Leg (i)** — all four doors withheld: `programStore.ts:1366-1418`,
  `postGenerationConstraintValidation.ts:1773-1810`, and the rolling-horizon
  republish (`fixtureMinimalReplan` publishes the PROPOSED candidate,
  `acceptedStateTransaction.ts:1899` publishes the SOURCE contract).
- **The provenance rule** — reduction reasons split into fact-derived and
  decision-backed sets; `reductionAuthorship` returns a decision id or a fact
  key; `assertReductionProvenance` raises on neither; only decision-backed
  reductions travel through a derivation.

### Two scaffold defects, found and fixed DURING this re-price

Recorded so nobody reads the numbers as measuring a broken scaffold. These are
in addition to the two the first pricing recorded (both of which reproduced and
both of whose fixes were carried in from the start).

3. **A derived mode with a stale declaration.** `declaredSubphase` is part of
   the same fixture-authored identity as `mode`. Deriving one and carrying the
   other makes the contract disagree with ITSELF, and the evaluator rightly
   raised `phase_subphase_policy_mismatch` on every derived week whose facts
   had moved (`expected practice_match_week, actual early_preseason`). Fixed by
   letting the declaration follow the builder's own expected subphase. Worth
   two deletion cells and one property.
4. **Leg (iii) has TWO install sites, and only one is the contract-selection
   line.** Installed at `acceptedEffectiveWeek.ts:102` alone, tier 4 still
   conformed against the **stored** contract, because the deriver reads
   `overlay.exposureContractV2 ?? microcycle.exposureContractV2` itself. A
   fixture's REMOVAL therefore never reached the conformance pass. Installing
   the derivation at the deriver as well greened `fixture-identity-5` outright
   and moved cell 1's attribution — see §3.

---

## 2. The measurement — four variants, one unedited witness set

Every number is a printed line, taken unpiped.

| variant | fixture-identity | athlete-session-deletion | accepted-state | phase-structure |
|---|---|---|---|---|
| **clean tree** | 3 pass, 3 fail (3,5,6) | 24/24 · 5/5 · 3/3 | 23/23 · 10/10 · 10/10 | 11/11 |
| **scaffold, all flags off** | 3 pass, 3 fail | 24/24 · 5/5 · 3/3 | 23/23 · 10/10 · 10/10 | 11/11 |
| **all legs + provenance** | 4 pass, 2 fail (**1**,6) | 17/24 · 4/5 · 3/3 → **18/24 · 5/5 · 3/3** | **18/23** · 9/10 · 10/10 | 10/11 |
| **ditto, tier 4 BOUNDED** | **5 pass, 1 fail (6)** | **12/24 · 0/5 · 0/3** | 18/23 · 9/10 · 10/10 | 10/11 |

**Condition 1 is not met.** Three witnesses are red in the best variant.

The provenance rule and the two new scaffold fixes do buy something real
against the first pricing: deletion 17→18 with properties restored to 5/5, and
accepted-state 16→18. It is not close to green.

The walkers were NOT run under the mutation. With three witnesses already red
the verdict cannot change, and a run that adds nothing to a decision is not
evidence. Stated, not implied.

---

## 3. THE RESIDUAL IS RESOLVED — the pin STANDS, and leg (ii) is corrected

The ruling gave a mechanical test rather than an argument:

> Measure the |8 → |7 delta's provenance. If the reduction performing it is
> authored by facts PRESENT at that read, the pin is STALE. If it traces to
> anything not backed by current facts or a decision, the deriver must return
> |8, leg (ii) is corrected, and the pin stands unedited.

**Measured.** Instrumenting tier 4 across every fixture-identity world, the
Monday moves `Lower Squat|8 → |7` in exactly two populations:

```
 30 worlds  mode=practice_match_week  marks=["2026-08-15:game"]  anchors=[tt@2,tt@4,practice_match@6]
            repairs=["weekly_power_budget"]  reductions=[]
 13 worlds  mode=mid_preseason        marks=[]                   anchors=[tt@2,tt@4]
            repairs=["weekly_power_budget"]  reductions=[]
```

The second population is the answer. **The fixture is GONE** — no mark, no
fixture anchor, the derived contract correctly reads `mid_preseason`, and the
contract authorises **no reduction at all**. Tier 4 trims the Monday anyway,
through a repair the gateway names `weekly_power_budget`.

What authorises that repair is `withPowerReduction`, and the reason it stamps
comes from `powerReductionReason` (`section18AcceptedWeekGateway.ts:315-326`),
whose **fall-through at line 325 returns `game_load_protection`** after every
guard above it fails. On a week with no game.

So the delta traces to a reduction whose fact key **no current fact backs**.
That is the ruling's second branch, and it decides:

- **The pin is NOT stale. Cells 5/6 stand unedited.** No witness was touched.
- **Leg (ii) is corrected**, as the ruling provides for.
- `fixture-identity-5` was never a Monday question at all. It was decision LOSS
  caused by scaffold defect 4, and it greens once the derivation reaches the
  deriver.

### A THIRD provenance case the rule has no branch for

The ruling splits reductions three ways: decision-backed, fact-derived, or
neither (a build error). This is a fourth thing — **fact-derived, and the fact
is absent**. The provenance is present and FALSE, so `assertReductionProvenance`
passes it and the reduction rides at read carrying a fixture's authority into a
week that has no fixture. `powerReductionReason` mints it structurally: its last
line has no "nothing authorises a cut here" branch.

This is the same shape as the fourth door, one layer down. The fourth door was
a reduction that could not be told from a decision; this is a reduction that
cannot be told from a fact it does not have.

### The correction was PRICED, and it is worse

Tier 4 bounded — declining any conformance output resting on an unbacked fact
key — **greens cell 1** and takes fixture-identity to 5/1, its best in this
unit. It costs the deletion suite `12/24 · 0/5 · 0/3`: twenty failures, and
**the mutation witnesses drop to 0/3**, meaning the deletion suite stops
detecting its own mutations. The shortfall repair the deletion class depends on
is exactly what the bound refuses.

The correction the ruling authorises is therefore real, aimed correctly, and
not yet safe to build. It needs to distinguish "a repair nothing authorises"
from "the repair a deletion authorises", and the current bound cannot.

---

## 4. THE COLLATERAL — unchanged in shape, and the provenance rule does not touch it

Under the best variant:

**`test:athlete-session-deletion` — 18/24 · 5/5 · 3/3 (6 failures)**
1 Sunday CORE deletion relocates to Saturday · 6 phase matrix keeps deletion
authoritative · 7 fixture/practice-match/readiness/injury/equipment rules
survive · 11 impossible relocation records typed reduction · 18 CORE
conditioning stacks before reduction · 22 Restore removes only its typed
reduction.

**`test:accepted-state-transactions` — 18/23 · 9/10 · 10/10 (6 failures)**
1 adding a game mark gates the target game week · 2 removing a game mark
resolves bye policy · 5 practice-match calendar changes use the approved PM
table · 21 invalid restored overlay regenerated in one rollover commit · 25
re-evaluated visible week matches the gateway ledger · [property] a fixture
MOVE publishes its dependent week once.

**`test:phase-structure` — 10/11.** Cell 8, the offer never survives a fixture
change: the flush survived the rebuild.

Read together this is the first pricing's §6 finding, undiminished: rows 1/2/5
of the accepted-state suite say the SELECTED CONTRACT TABLE moved, and the
deletion rows say the shortfall REPAIR no longer lands. **The provenance rule
was never aimed at either.** It rules who owns a reduction; it says nothing
about which table a derivation selects or where a repair lands. The app still
has two §18 authorities and the ruled design still adds a third at read.

---

## 5. Status

- **Condition 1 (PRICE FIRST):** MET as a process, FAILED as a result, for the
  second time. Per the condition's own instruction: **STOP, report, do not
  build.**
- **Built:** nothing. **Merged:** nothing. **Scaffold:** reverted; tree clean.
- **Condition 4:** no witness was edited, and after §3 none needs to be. The
  pinned Monday is CORRECT and the cells that assert it stand.
- **The residual is no longer a ruling about which Monday is right.** It is a
  named defect (`powerReductionReason:325`) and a correction whose price is
  measured and currently unaffordable.
- **Condition 5** (bible, markedDays proof, merge, R5.7, remaining batches):
  not started — gated on a build that did not happen.
