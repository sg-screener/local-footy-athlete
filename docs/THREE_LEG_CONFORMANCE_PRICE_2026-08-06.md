# THREE-LEG CONFORMANCE — CONDITION 1 PRICE — 2026-08-06

Condition 1 of `docs/THREE_LEG_CONFORMANCE_RULING_2026-08-06.md`: *scaffold all
three legs as mutations and measure the FULL witness set green before the real
build begins. If the priced set does not green, STOP and report — do not build.*

**The priced set does not green. Nothing was built. The scaffold is reverted**
— `git status` is clean and the tree this document lands on reprints
`3 passed, 3 failed` on `test:fixture-identity` and `11 passed, 0 failed` on
`test:phase-structure`.

But the answer is not "no" the way the last two entry gates were "no". **Leg
(iii) is real and the ruling's mechanism is CONFIRMED: cell 3 greens for the
first time.** What the price buys and what it costs are two different sentences,
and both are below.

---

## 1. What was scaffolded

All three legs, behaviourally complete, each behind its own environment flag so
combinations could be attributed. Every flag off reprints the clean-tree
baseline byte for byte (measured, §2 row 2), so nothing here is misattributed to
a scaffold that was never inert.

- **Leg (iii)** — `src/rules/derivedWeekContract.ts` (new). `deriveWeekContract`
  takes the covering week's contract as the identity owner and lets the FIXTURE
  FACTS (`targetWeekFixtures` — the one owner of "is there a game or practice
  match in this week") decide mode, anchor state and fixture day. It rebuilds
  through `buildSection18WeeklyExposureContractV2` with every non-identity input
  recovered from the contract itself, and returns the stored contract
  BYTE-IDENTICAL when the facts already agree with it. Installed at
  `rules/acceptedEffectiveWeek.ts:102` — the app's single contract-selection
  line — and at the deriver.
- **Leg (ii)** — `utils/sessionResolver.ts:1677`, the Contract v2 branch. §18
  runs there as tier 4 (`rules/dayPrecedence.ts:19`), projection IDENTITY,
  output never persisted.
- **Leg (i)** — all three doors withheld: `programStore.ts:1366-1418` (content
  only, contract ledger untouched), `postGenerationConstraintValidation.ts
  :1773-1810`, and the rolling-horizon republish
  (`fixtureMinimalReplan` publishes the candidate the search PROPOSED instead of
  the one the gateway REPAIRED; `acceptedStateTransaction.ts:1899` publishes the
  source contract instead of the gateway's).

### Two scaffold defects, found and fixed DURING pricing

Recorded so nobody reads the numbers as measuring a broken scaffold.

1. **Anchor claims resurrected.** `anchorsFor` builds all three of an anchor's
   production claims from one boolean and the safety finaliser then DEMOTES the
   ones participation cannot justify. Rebuilding from that boolean resurrected
   settled claims, the evaluator raised `unjustified_anchor_credit`, and the
   finaliser THROWS on it: `test:phase-structure` went 11/11 → **0/11**, every
   cell on the same contradiction. Fixed by making only the anchor SET derived —
   participation and production claim are facts about the anchor and travel.
2. **Tier 4 resurrecting a decision-emptied day.** The conformance pass installed
   a typed `Rest` workout onto a Wednesday the athlete had CLEARED, and cells 5/6
   red on decision LOSS. Tier 4 runs last; last is not highest. Tier 1 — the
   emptying decision — outranks it, so a day already emptied by decision is left
   alone.

---

## 2. The measurement — seven variants, one unedited witness set

Every number is a printed line, `TRUE_EXIT` taken unpiped.

| variant | fixture-identity | athlete-session-deletion | accepted-state | phase-structure |
|---|---|---|---|---|
| **clean tree** | 3 pass, 3 fail (3,5,6) | 24/24 · 5/5 · 3/3 | 23/23 · 10/10 · 10/10 | 11/11 |
| **scaffold, all flags off** | 3 pass, 3 fail | 24/24 · 5/5 · 3/3 | 23/23 · 10/10 · 10/10 | 11/11 |
| **(iii) alone** | 3 pass, 3 fail | 19/24 · 4/5 · 3/3 | 22/23 · 10/10 · 10/10 | 11/11 |
| **(ii) alone** | 3 pass, 3 fail (3,5,6) | — | — | 11/11 |
| **(ii)+(iii)** | 3 pass, 3 fail | 17/24 · 4/5 · 3/3 | 21/23 · 9/10 · 10/10 | 10/11 |
| **(i)+(ii)+(iii) — as ruled** | 3 pass, 3 fail (**1**,5,6) | 17/24 · 4/5 · 3/3 | 16/23 · 9/10 · 10/10 | 10/11 |
| **ditto, reduction ledger not grafted** | **4 pass, 2 fail (5,6)** | 17/24 · 4/5 · 3/3 | 16/23 · 9/10 · 10/10 | 10/11 |

**Condition 1 is not met.** Four witnesses are red in the priced variant.

The walkers (`test:action-walker`, `:deep`, both 20/0 at baseline) were NOT run
under the mutation. With four witnesses already red the verdict cannot change,
and a run that adds nothing to a decision is not evidence. Stated, not implied.

---

## 3. WHAT THE PRICE BUYS — cell 3 greens, and the mechanism is confirmed

`fixture-identity-3` is the general law: *a published week equals the week
derived from the same inputs.* It has been red through every variant of this
unit, including both halves of the two-legged design.

**Under all three legs it PASSES.** The entry gate's §3 diagnosis — that the two
sides were conforming against DIFFERENT contracts because dropping the published
output dropped the fixture-aware contract with it — was right, and leg (iii) is
the leg that fixes it. That is the first thing in this unit that has moved the
cell it was aimed at.

Leg (iii) alone moves nothing and COSTS five deletion regressions, exactly as the
entry gate predicted ("a contract derivation moves nothing alone because nothing
consults the contract for content at read"). The legs do belong together.

---

## 4. THE FINDING — a gateway reduction is conformance output wearing a decision's clothes

Condition 2 says decision-carrying overlay state stays: *"illness reductions,
undo, athlete removals as DECISIONS"*. The scaffold honoured it — the surface's
typed reduction ledger was unioned onto the derived contract rather than dropped
with the rest of the stored output.

**That single carve-out re-admits the retired write through the front door.**

| | fixture-identity |
|---|---|
| three legs, reduction ledger grafted as Class B | 3 pass, 3 fail — cell **1** newly red |
| three legs, reduction ledger NOT grafted | **4 pass, 2 fail** — cell 1 and cell 3 both green |

Cell 1 is *add a fixture to a rest Saturday and remove it — the week is what it
was*. With the ledger grafted, the practice-match reduction the GATEWAY authored
(`mainStrength` 4→3, `power` 1→0) lives in the overlay contract's
`authorisedReductions`, travels forward as a "decision", and survives the
fixture's removal **permanently**. Add-then-remove stops being identity, and it
stops being identity forever.

An illness reduction is a decision. A gateway repair's reduction is CONFORMANCE
OUTPUT with the same type. Nothing in the ledger distinguishes them, and the
retirement cannot tell them apart.

**The retirement therefore has FOUR doors, not three, and the fourth is not a
workouts writer.** The entry gate's writer census (§5) enumerated every site that
runs the §18 gateway and persists its WORKOUTS. This one persists its
ARITHMETIC, into a field condition 2 explicitly protects. `reduction-masked-a-
placement-defect`'s law — "doc named 1 site, there were 2" — for the third time
in a week, and this time the miscount is in the ruling's own conditions.

---

## 5. THE RESIDUAL — the pinned literal, and it is the seat's question

With the fourth door closed, two cells remain, and they fail on ONE ground:

```
fixture-identity-5  W2   the DERIVER's own Monday reads "2026-08-10=Lower Squat|7",
fixture-identity-6  W2r  not the pinned "2026-08-10=Lower Squat|8".
                         The truth every other surface is measured against has moved.
```

Not a disagreement between surfaces. **Every surface now agrees.** What moved is
the value they agree ON, and the witness holds it as a LITERAL for exactly this
reason, in its own words:

> A cell that only asks its surfaces to agree with each other greens when they
> agree on the WRONG week, which is exactly what V1 was priced doing. This is
> the value they must agree ON.

Leg (ii) is why. Running §18 as tier 4 at read makes THE DERIVER perform the
practice-match reduction, so the deriver's own Monday becomes the reduced one.
Cells 5/6 are the assertion that it must not.

**This is the trade `R53_DERIVATION_OWNER_STOP` §6 named and declined to rule:**

> the deriver (`resolveWeekWithConditioning`) does not consult the declared
> contract for content. Stop storing the repair and a practice-match week keeps
> its fourth main-strength session while its contract declares three. […] That
> trade is exactly what cells 5 and 6 assert one way — "one composer, and it is
> the deriver" — and it is not mine to rule.

The three-legged design answers it the other way: the deriver conforms, so the
week loses its fourth session at READ instead of keeping it. The witness says NO
to that answer, and **condition 4 forbids editing the witness**. So this is not
a build decision that more scaffolding reaches. It is a ruling about **which
Monday is right** — and the answer decides what §18 MEANS at read.

Two readings, both coherent, and the seat holds neither yet:

- **The pin is right.** §18 at read may REPORT a shortfall and must not silently
  reduce the athlete's week. Then leg (ii) is wrong as specified, tier 4 at read
  is an evaluation and not a repair, and `dayPrecedence.ts:19` needs re-reading
  rather than implementing.
- **The pin is stale.** It was authored against a tree with no tier 4 at read; a
  week whose contract declares three main-strength sessions SHOULD show three.
  Then cells 5/6 are asserting the pre-conformance week and must be re-ruled
  before any build — never edited to match, per
  `expectation-edited-to-match-regression`.

---

## 6. THE COLLATERAL — leg (ii) is a THIRD §18 authority

Under the priced set, with the fourth door closed:

**`test:athlete-session-deletion` — 17/24 · 4/5 · 3/3 (8 failures)**

- 1 exact Sunday CORE conditioning deletion relocates to Saturday (`Saturday=Gunshow`)
- 6 phase matrix keeps deletion authoritative (`required_minimum_shortfall`, conditioning 2→1)
- 7 fixture/practice-match/readiness/injury/equipment rules survive (`phase_subphase_policy_mismatch`, two `planner_selected_target_miss`, `pattern_restore_failure`)
- 11 impossible relocation records typed reduction (`required_minimum_shortfall` ×2, `pattern_restore_failure`)
- 18 CORE conditioning stacks onto compatible strength before reduction
- 22 Restore removes only its typed reduction (`owned typed reduction was not linked`)
- 23 restoration gateway rejection publishes no partial accepted state
- [property] explicit re-add restores typed ownership (`Section18WeekAcceptanceError`)

**`test:accepted-state-transactions` — 16/23 · 9/10 · 10/10 (8 failures)**

- 1 adding a game mark gates the target game week (`Wednesday game anchor missing`)
- 2 removing a game mark resolves bye policy (`bye table was not selected`)
- 5 practice-match calendar changes use the approved PM table (`practice-match table not selected`)
- 7 low readiness commits fact and reduced program together
- 8 a failed readiness projection commits neither surface
- 21 an invalid restored overlay is regenerated inside one rollover commit
- 25 re-evaluated visible week matches the gateway ledger exactly
- [property] a fixture MOVE publishes its dependent week once and leaves a DECLARATION

**`test:phase-structure` — 10/11.** Cell 8, *the offer never re-roles, and never
survives a fixture change*: the flush survived the rebuild.

Read together these are one shape. Rows 1/2/5 of the accepted-state suite say the
SELECTED CONTRACT TABLE moved — leg (iii) is choosing a different table from the
one the transaction owner chose. Rows 7/11/18/22 of the deletion suite say the
shortfall REPAIR no longer lands — leg (i) withheld it and tier 4 at read did not
replace it where a deletion needs it to. The app currently has two §18
authorities (the store's and the replan's); the ruled design adds a third at read
without retiring either, and the three do not agree.

---

## 7. Status

- **Condition 1 (PRICE FIRST):** MET as a process, FAILED as a result. The full
  witness set is not green. Per the condition's own instruction: **STOP, report,
  do not build.**
- **Built:** nothing. **Merged:** nothing. **Scaffold:** reverted; tree clean.
- **Condition 2:** needs a FOURTH door — the typed reduction ledger — and needs
  to say how a gateway-authored reduction is told from an athlete's.
- **Condition 4:** the witnesses were not edited and must not be. Cells 5/6 are
  the residual, and they are a RULING, not a build.
- **`derived-repair-ownership`:** printed **4 passed, 0 failed** on a tree with
  16 witness cells red. A seventh sighting of
  `gate-passing-on-coordinates-it-never-builds`. It is not a witness and
  condition 1 was right to hold it out.
- **Condition 5 (bible, condition 4 markedDays proof, merge to
  `feat/stage-b-stage2`, R5.7, remaining R5 batches):** not started — gated on a
  build that did not happen.
