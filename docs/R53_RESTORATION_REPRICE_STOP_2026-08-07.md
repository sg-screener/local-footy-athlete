# R5.3 RE-PRICE UNDER THE RESTORATION BOUNDARY — STOP — 2026-08-07

Prices `docs/PATTERN_IDENTITY_RESTORATION_RULING_2026-08-06.md`
(committed as authored at `e5d8f806`). Leg (i) active, full witness
set. **NOT GREEN — nothing built into the main build, nothing merged.**

Scaffold: `scratch/r53-pricing-6` (`2d617a56`), branched from
`scratch/r53-pricing-5`. `scratch/r53-pricing-5` and
`scratch/r53-pricing-5-before` preserved unchanged, per condition 4 as
amended.

## What paid — SCAFFOLD DEFECT 4, and the pricing had misattributed it

The provenance rule shipped its first half without its second.
`decisionBackedReductions` dropped **every** fact-derived reduction
unconditionally, and `authorshipResolves` — the resolution half stated
by RESOLVED_AUTHORITY_RULING §1 — sat in the same file, **called by
nothing**. Both rulings say a fact-derived reduction DERIVES from
current facts; neither says it dies.

The probe named it in one line: week `2026-08-03` is a **deload** week
carrying two `deload_policy` reductions, `carried:[]`. That reduction
names `week.weekKind.deload`, which resolves. Dropping it strips the
deload week's reduced target, and the evaluator rightly raises
`required_minimum_shortfall` on `2026-08-03` — which is *verbatim*
deletion cell 21's failure message.

Fixed at `2d617a56`: the resolution law gets one owner
(`authorshipResolvesAgainst` over `ResolvableWeekFacts`), askable about
a contract that does not exist yet, which is the derivation's actual
question. `authorshipResolves` delegates to it. The derivation asks it
about the week being DERIVED — a game-load reduction on a week whose
game is gone still dies; a deload week's `deload_policy` reduction
travels.

**This was being charged to leg (i).** It is not leg (i)'s.

| configuration | before | after |
|---|---|---|
| leg (iii) + provenance | 22/24 | **24/24** |
| all legs | 19/24 | **21/24** (cells 11, 21 green) |

## The measurement caught its own harness first

Three "this pair is free" readings were taken with `env $var npm run …`.
In this shell an unquoted parameter expansion is **not** word-split, so
`env "A=1 B=2"` sets one variable named `A` to `"1 B=2"` — every one of
those runs was a clean-tree run wearing a pair's label. It produced the
false conclusion that leg (i) alone owned cells 21/22. Re-run with
literal prefixes, the owning pair is **leg (iii) + provenance**, and
leg (i) never owned cell 21 at all.

Shape: [[half-mutation-proves-nothing]], one layer lower than usual —
the defect was in the measurement harness, not the witness.

## The priced row — 6 of 12 clean, no row worse

All legs on (`LEG_I`, `LEG_II`, `LEG_III`, `PROVENANCE`):

| witness | pricing-5 | pricing-6 | |
|---|---|---|---|
| derived-week lawfulness | 12/12 | 12/12 | clean |
| section18 gateway | 91/0 | 91/0 | clean |
| whole-week repair | 14/14 | 14/14 | clean |
| phase structure | 11/11 | 11/11 | clean |
| action walker | 20/0 | 20/0 | clean |
| day-precedence ownership | — | 6/0 | clean |
| typecheck gate | 459, none regressed | 459, none regressed | clean |
| **athlete-session deletion** | 19/24 | **21/24** | red |
| accepted-state | 22/23 · 8/10 · 10/10 | 22/23 · 8/10 · 10/10 | red |
| athlete-session move | 21/1 | 21/1 | red |
| action walker deep | 19/1 | 19/1 | red |
| fixture-identity | 3 red | 3 red | red |
| derived-repair-ownership | 4/0 | 4/0 | named vacuity |

Flags OFF, the tree reprints the clean baseline on every suite —
deletion 24/24 · 5/5 · 3/3, accepted 23/23 · 10/10 · 10/10, move 22/0,
gateway 91/0, phase 11/11. Lawfulness is 6/12 flags-off and 12/12 with
the legs, which is the legs' whole point.

**fixture-identity is 3 red with the flags OFF as well** — it is this
branch's pre-existing blocker, not a cost of any leg. Condition 1's
`fixture-identity 6/6` is therefore unmet for a reason the legs cannot
move.

## The residual, named — and it is an OWNERSHIP question, not a door

Three deletion cells remain: 7, 22, 23.

**Cell 22 is the one that matters, and the ruling does not settle it.**
`linkedTypedReductions` is computed as a **stored-contract diff** —
`acceptedLinkedReductions(after) − acceptedLinkedReductions(before)`
at `acceptedStateTransaction.ts:1224-1231`, reading
`contractForAcceptedWeek`. Measured on the clean tree, the deletion
authors three `explicit_user_override` reductions carrying
`deletionIdentity = user-removal:2026-07-13:whole_session:w1:monday:none:strength`.
Under leg (i) the after-contract gains **nothing**, so the link is
empty and the undo cannot name its own reduction.

A door census was run and **refutes the easy explanation**: doors 1 and
4 both fire during cell 22. This is not a fifth door leg (i) missed.
Leg (i) retires exactly the stored arithmetic the link is derived from,
by design.

An attempt to graft the decision-backed reductions onto the published
source contract was built and **REFUTED by measurement** — cell 22
stayed red and cell 11 *regressed* (21/24 → 20/24). The reason is
structural, and it is the finding: **a typed reduction is not a list
entry, it is contract arithmetic.** `applyAthleteRemovalTypedReduction`
returns a whole contract with the reduction folded into its targets.
Grafting the entry alone yields a contract that disagrees with itself.
The attempt was reverted; nothing of it survives on the branch.

So the question the seat owns:

> The restoration ruling says the removal DECISION owns the identity of
> what it removed. The reversible-adjustment ledger's link to that
> decision's typed reduction is currently derived from **stored
> conformance arithmetic** — the very thing leg (i) retires. Should the
> link be computed FROM the decision (the constraint, plus the
> reduction the deriver re-applies at read via `withRemovalLedger`),
> rather than from a stored before/after diff?

If yes, that is a fourth leg with its own install sites and its own
price, and it should be ruled before it is built. Cell 23 ("gateway
failure owned contract missing", where `game_load_protection` vanishes
from the after-contract) reads as the same root from the other side.
Cell 7 is not yet diagnosed.

## Standing

Per the ruling's own terms — not green, so **STOP with the residual
named**. Nothing built. The two tracked debts (hydration
snapshot-vs-live pin; the 146/172-stamp `todayISO` clock fix) remain
owed and NOT started. The queued snapshot-to-reference unit remains
queued, entry gate intact. The run home is not begun. STOP at R5 close.
