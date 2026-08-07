# CONDITION 1 RE-PRICE — THIRD RUN — RESOLVED AUTHORITY — 2026-08-06

Condition 1 of `docs/THREE_LEG_CONFORMANCE_RULING_2026-08-06.md`, restated a
third time by `docs/RESOLVED_AUTHORITY_RULING_2026-08-06.md`: *re-price
everything together against the FULL witness set INCLUDING the deletion suite's
mutation witnesses. Green before building; STOP and report if not.*

**The priced set does not green. Nothing was built. Nothing was merged.** The
tree this document lands on is clean and reprints `3 passed, 3 failed` on
`test:fixture-identity` and `11 passed, 0 failed` on `test:phase-structure`
(verified after the revert).

**But the ruling's own §2 is VINDICATED, and its price is ZERO.** The
resolved-authority bound costs nothing at all — the deletion suite's mutation
witnesses hold at **3/3**, its properties at **5/5**, and `test:phase-structure`
returns to **11/11**. The 12/24 · 0/5 · 0/3 catastrophe the second pricing
reported was the OLD blanket bound, not the ruled one. That section is §3.

**Condition 4, as amended, was honoured.** The scaffold is preserved on
`scratch/r53-pricing-3-scaffold` (`bd6dccb3`, `103bf92c`). The `c45792e9` loss
is not paid a third time.

---

## 1. What was scaffolded

All three legs, the provenance rule and the resolved-authority law, each behind
its own environment flag. **Every flag off reprints the clean-tree baseline byte
for byte on all four suites** (§2 row 2), so nothing below is misattributed to a
scaffold that was never inert.

- **Leg (iii)** — `src/rules/derivedWeekContract.ts` (new).
  `deriveWeekContract` takes the covering week's stored contract as identity
  owner and lets `targetWeekFixtures` decide mode, anchor state and fixture day,
  recovering every other input from the contract. Returns the stored object
  itself when the facts already agree. Installed at **both** sites, per the
  two-site finding adopted by the ruling: `rules/acceptedEffectiveWeek.ts:102`
  AND the deriver's own contract-selection line, `utils/sessionResolver.ts:1677`.
  Measured live: **1,432 derivations**, rebuilding wherever the facts had moved.
- **Leg (ii)** — `utils/sessionResolver.ts:1677`, the Contract v2 branch. §18
  runs as tier 4 through `runSection18AcceptedWeekGateway` with
  `resolveVisibleWorkouts: (w) => [...w]` — the projection IDENTITY the ruling
  specifies, which is also what stops the gateway re-entering the resolver.
  Measured live: **1,149 tier-4 passes**, all with a profile.
- **Leg (i)** — four doors withheld: `programStore.ts` (overlay + both
  base-owned microcycle writes), `postGenerationConstraintValidation.ts`, the
  rolling-horizon republish in `fixtureMinimalReplan` (the week the search
  PROPOSED, both the primary return and the alternatives), and
  `acceptedStateTransaction.ts:1899` (the SOURCE contract).
- **The provenance rule** — `reductionAuthorship` returns a decision id or a
  fact key; `assertReductionProvenance` raises on neither; only decision-backed
  reductions travel through a derivation.
- **Resolved authority** — `powerReductionReason`'s fall-through RETIRED
  (`section18AcceptedWeekGateway.ts`): the owner returns a resolvable reason or
  `null`, never `game_load_protection` by default. Tier 4 BOUNDED: a field-load
  power trim whose reason does not resolve does not happen.

### Scaffold defects carried in

All four from the first two pricings reproduced and their fixes were carried in
from the start: (1) anchor claims resurrected, (2) tier 4 resurrecting a
decision-emptied day, (3) a derived mode with a stale `declaredSubphase`,
(4) leg (iii)'s two install sites. One new one was found and fixed during this
run: a pre-season week with no fixture has anchor state `none`, not `bye` —
`bye` is an IN-SEASON fact (the round exists and this team is not in it), and
deriving `bye` forced a spurious rebuild on every pre-season week.

---

## 2. The measurement — one unedited witness set

Every number is a printed line, taken unpiped.

| variant | fixture-identity | athlete-session-deletion | accepted-state | phase-structure |
|---|---|---|---|---|
| **clean tree** | 3 pass, 3 fail (3,5,6) | 24/24 · 5/5 · 3/3 | 23/23 · 10/10 · 10/10 | 11/11 |
| **scaffold, all flags off** | 3 pass, 3 fail (3,5,6) | 24/24 · 5/5 · 3/3 | 23/23 · 10/10 · 10/10 | 11/11 |
| **all legs + provenance + BOUNDED — as ruled** | 3 pass, 3 fail (3,5,6) | 19/24 · **5/5** · **3/3** | 22/23 · 9/10 · 10/10 | **11/11** |
| ditto, tier 4 UNBOUNDED | 3 pass, 3 fail (3,5,6) | 19/24 · 5/5 · 3/3 | — | — |
| **(ii)+(iii)+provenance+bounded — leg (i) withdrawn** | 3 pass, 3 fail (3,5,6) | **21/24** · 5/5 · 3/3 | **23/23** · 9/10 · 10/10 | 11/11 |
| **(i) alone** | 3 pass, 3 fail — Monday `Lower Hinge\|7` | — | — | — |
| **bounded alone** | 3 pass, 3 fail — baseline, byte for byte | — | — | — |

**Condition 1 is not met.** Three witnesses are red in the best variant.

For comparison, the second pricing's best row was fixture-identity 5/1,
deletion 12/24 · 0/5 · 0/3, accepted-state 18/23 · 9/10 · 10/10, phase 10/11.
This run is better on three of four suites and worse on the fourth.

The walkers were NOT run under the mutation. With three witnesses already red
the verdict cannot change, and a run that adds nothing to a decision is not
evidence. Stated, not implied.

---

## 3. THE RULING'S §2 IS VINDICATED — the bound costs NOTHING

The ruling required a specific, falsifiable outcome:

> Bounded tier 4 performs exactly the authorised set: decision-authorised
> repairs run (the deletion suite's mutation witnesses must detect their
> mutations again — 3/3, not 0/3), unauthorised repairs do not.

**Both halves measured, both hold.**

The bound fires. Instrumented across every fixture-identity world, the field-load
trim is REFUSED in 850 evaluations, and refused in exactly the population the
last pricing named:

```
 600  mode=mid_preseason    anchors=[tt@2,tt@4]                  budget=1  reason=null   REFUSED
 136  mode=late_preseason   anchors=[tt@2,tt@4]                  budget=1  reason=null   REFUSED
 114  mode=early_preseason  anchors=[tt@2,tt@4]                  budget=1  reason=null   REFUSED
 472  mode=practice_match   anchors=[tt@2,tt@4,practice_match@6] budget=0  reason=pm     RUNS
 250  mode=late_preseason   anchors=[tt@2,tt@4]  weekKind=deload budget=1  reason=deload RUNS
```

A repair whose fact key no current fact backs dies; a repair a resolving fact or
a decision authorises runs. That is the discrimination the second pricing said
the bound "cannot yet make", and it is made structurally — the reason resolver
asks the contract's own anchors instead of falling through to a default.

**And it is free.** Bounded and unbounded print the SAME deletion totals
(19/24 · 5/5 · 3/3) and the SAME fixture-identity totals. The mutation witnesses
never drop. The 0/5 · 0/3 collapse the second pricing priced was caused by the
blanket bound it happened to be holding — *"declining any conformance output
resting on an unbacked fact key"* — which refused the shortfall repair the
deletion class depends on. The ruled bound touches only the power trim's own
authority and leaves every decision-authorised repair alone.

`test:phase-structure` returning to 11/11 and the deletion properties to 5/5 are
the same fact from two other angles.

**The correction the last stop called "priced and currently unaffordable" is
affordable. It was the wrong bound, not the wrong ruling.**

---

## 4. THE RESIDUAL HAS MOVED — and it is now LEG (i), not the Monday

Cells 3, 5 and 6 are red in every variant, but they are no longer red for the
reason the last two stops reported, and the ONE ground has changed owner.

**Bounded alone reprints the clean-tree baseline byte for byte** — same three
cells, same `|7 -> |8` and `|8 -> |7` deltas. That is correct and expected: on
the clean tree the contract HAS its fixture, so the trim resolves and the bound
rightly does nothing. The `|8 -> |7` Monday on the baseline is not the power
trim; it is the deriver reading the STORED week, which was published with the
eighth row already gone.

**Leg (ii) and leg (iii) together also reprint the baseline** on
fixture-identity. Tier 4 at read cannot restore a row that was stripped before
it was stored — it conforms a week, it does not regenerate one. So the two legs
that reach the deriver cancel out across both sides of every cell.

**Leg (i) is what makes the deriver stop inheriting the stored week — and leg
(i) ALONE changes which patterns the athlete's week contains:**

```
fixture-identity-5/6   the deriver's Monday   2026-08-10  Lower Squat|8  ->  Lower Hinge|7
                       and the two upper days SWAP
                       2026-08-11  Upper Pull|3  ->  Upper Push|3
                       2026-08-13  Upper Push|3  ->  Upper Pull|3
```

Attributed further: this is the CONTRACT half of leg (i), not the workouts half.
Withholding only doors 1, 2 and 4 — publishing every workout exactly as before
and dropping nothing but the arithmetic — reproduces the swap in full.

**That is a new finding and it is the one that matters.** The retirement's own
premise is that the stored contract is *conformance OUTPUT* — arithmetic a
derivation can recompute. It is not. The stored contract is carrying **pattern
identity**, and the next derivation reads it: refuse to persist it and the week
comes back with a different main lift on Monday and its push/pull days
exchanged. Not a reduced week — a DIFFERENT week.

This is `reduction-masked-a-placement-defect`'s shape again, one layer up: a
ledger everybody described as a record turns out to be an input.

### What leg (i) costs on the other suites

Withdrawing leg (i) and keeping everything else is the best row this unit has
produced on three of four witnesses: deletion **21/24** · 5/5 · 3/3,
accepted-state **23/23** · 9/10 · 10/10, phase-structure 11/11 — one
accepted-state property and three deletion regressions from green.

So leg (i) is now carrying the entire remaining price: **2 deletion
regressions, 1 accepted-state regression, and the pattern swap.**

---

## 5. THE COLLATERAL — under the ruled variant

**`test:athlete-session-deletion` — 19/24 · 5/5 · 3/3 (5 failures)**
7 fixture/practice-match/readiness/injury/equipment rules survive ·
11 impossible relocation records typed reduction · 21 conditioning component
restoration preserves the stacked strength component · 22 Restore removes only
its typed reduction · 23 restoration gateway rejection publishes no partial
accepted state.

Rows 21 and 23 are `conflicted` outcomes — *"accepted-after semantic state
changed"* — which is the withheld contract disagreeing with the republished
content, i.e. §4's finding stated as a transaction conflict.

**`test:accepted-state-transactions` — 22/23 · 9/10 · 10/10 (2 failures)**
25 re-evaluated visible week matches the gateway ledger exactly · [property] a
fixture MOVE publishes its dependent week once.

Both are leg (i): row 25 compares the visible week against a ledger leg (i)
declines to write.

**`test:phase-structure` — 11/11.** Cell 8 (*the offer never survives a fixture
change*) is GREEN under the ruled set for the first time in this unit. The
provenance rule and the resolved-authority bound between them paid it.

**The §6 collateral is materially reduced but not gone.** The first pricing's
finding was that the selected contract TABLE moved (accepted-state rows 1/2/5)
and the shortfall REPAIR no longer landed (deletion rows 7/11/18/22). Rows 1, 2,
5 and 18 are now GREEN. Rows 7, 11 and 22 remain, and they remain for leg (i)'s
reason, not the derivation's.

---

## 6. Status

- **Condition 1 (PRICE FIRST):** MET as a process, FAILED as a result, for the
  third time. Per the condition's own instruction: **STOP, report, do not
  build.**
- **Built:** nothing. **Merged:** nothing. **Scaffold:** preserved on
  `scratch/r53-pricing-3-scaffold`; working tree reverted and clean.
- **Condition 4 (amended):** honoured — the scaffold survives this stop. No
  witness was edited, and none needs to be: cells 5/6's pin is not merely
  standing, it is now *more* right than the last stop showed, because the week
  leg (i) hands the deriver differs from the pin in PATTERN as well as count.
- **The ruling's two rulings are both correct.** The fall-through's retirement
  and the bounded tier 4 are built, measured, and cost nothing. They are the
  cheapest thing this unit has produced.
- **The blocker has moved a layer.** It is no longer "which Monday is right" and
  no longer "the bound cannot tell repairs apart". It is: **the stored §18
  contract is an INPUT to pattern selection, and leg (i) retires it.** Whether
  the retirement may proceed depends on who owns pattern identity — which is a
  ruling, not a build, and it is the seat's.
- **Condition 5** (unpiped bible, condition 4 markedDays proof, merge, post-merge
  bible, R5.7, remaining batches): not started — gated on a build that did not
  happen.
