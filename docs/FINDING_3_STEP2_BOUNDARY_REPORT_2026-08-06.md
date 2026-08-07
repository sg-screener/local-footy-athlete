# FINDING 3 STEP 2 — BOUNDARY REPORT

## The third consequence — RESOLVED, coverage preserved, no ruling change

Cells 6 and 9 of `test:g1-landing-ask-flow` are green (29/29) without narrowing
attach-first. The review seat rejected bounding the comparator (option b) and
called retirement (option a) premature on the ground that the scan was too
narrow — **that was correct, and my scan was the defect, not the code.**

Widened to off-season, pre-season and in-season seeds at five phase-entry offsets
each, accessory-free conditioning days DO exist:

```
[HIT] offseason+0        early_offseason      2:Aerobic Flush, 4:Aerobic Flush
[HIT] offseason+5/9/13   late_offseason       4:Upper Pull
[HIT] preseason+2        practice_match_week  1:Lower Body Strength, 4:Team Training + Upper Pull
```

The decisive find is the last one: the **practice-match week itself** still
produces one — the seed had removed the thing that shapes it.
`practiceMatchAthlete()` drops team training (`teamTrainingDaysPerWeek: 0`), and
without those anchors that week's composition has no accessory-free conditioning
day in any of its four microcycles. Keep the anchors and it does. So the fixture
now seeds `{...profile(), seasonPhase: 'Pre-season'}` — same practice-match/G-1
context these cells need, minus the anchor removal — and ASKS every week of the
program for a qualifying day rather than pinning `dayOfWeek === 2`.

**Attach-first did not swallow an authored session shape.** The Bible's standalone
conditioning survives in the modes that author it, which is what the review seat
predicted and what the stop condition was watching for. No bound added, and the
regenerated golden stands.

The guard still fails loudly on a miss, now printing every week of the program and
naming the consequence: *"that is attach-first swallowing an authored session
shape, not a fixture to loosen."* If a future change does swallow it, the cell
says so in those words.

<details>
<summary>The stop as it stood before the ruling, kept for the record</summary>

> `test:g1-landing-ask-flow` cells 6 and 9 fail. Their fixture guard did its job
> and named itself rather than passing vacuously: it needs a session carrying
> conditioning WITHOUT accessory rows, and after this unit **no day in the seeded
> practice-match week has one**:
>
> ```
> 1:Full Body Strength[cond=2,acc=2]  2:Lower Squat[cond=1,acc=2]
> 3:Upper Push[cond=1,acc=2]          4:Prehab & Accessories[cond=1,acc=4]
> 5:Gunshow[cond=0,acc=6]             6:Game Day[cond=0,acc=0]
> ```
>
> The fixture previously pinned Tuesday, which was a standalone conditioning
> session; Tuesday is now `Lower Squat`. The guard was widened to ASK the week for
> a matching day instead of hardcoding a coordinate — a correct repair on its own
> terms, and it still fails, which is the useful part: it proves the world has no
> subject rather than that the test looked in the wrong place.
>
> ### Bisected — attach-first again, and the budget is NOT involved
>
> | | budget | attach-first | suite |
> |---|---|---|---|
> | A | ON | ON | 27 passed, **2 failed** |
> | B | OFF | ON | 27 passed, **2 failed** |
> | C | ON | OFF | 29 passed, 0 failed |
> | D | OFF | OFF | 29 passed, 0 failed |
>
> **My own suspicion was wrong and is recorded as wrong:** I expected the budget,
> because accessory rows are involved and the strength repair does not author them.
> Attach-first is the sole cause here too, exactly as in the practice-match golden
> world. So the pre-ruled one-budget-object shape is **not triggered by this
> evidence either** — the budget causes no movement in any world measured so far.
>
> ### The week is within bounds — zero findings, both ways
>
> Measured on the seeded week, attach-first ON and OFF:
> `blockingViolations = 0` and `findings = 0` in **both**. No breach, no boundary
> trade. By the ruled outcomes this is the second case: another correct
> consequence, and the fixture should be re-pinned against the world's own
> structure.
>
> ### But the world no longer CONTAINS the structure — and that needs a ruling
>
> The fixture was widened from `dayOfWeek === 2` to "ask the week for a day
> carrying conditioning with no accessory rows". It still finds none — and neither
> does any other week or seed. Scanned four seeds (`practiceMatch` at phase-entry
> offsets 2 and 0, the base in-season profile at offsets 0 and 9), every microcycle
> of each: **zero hits.**
>
> Conditioning days have not vanished — several carry `c=1` or `c=2`. What has
> vanished is a conditioning day with NO accessory rows, because conditioning is
> now attached to sessions that carry accessories rather than standing alone.
>
> So cells 6 and 9 cannot be re-pinned structurally: their subject — route (b)'s
> no-accessories branch — is no longer reachable from generated worlds. By Sam's
> recorded rule, *"a path nothing can reach is a fixture with no subject"*, which
> makes this a ruling, not a fixture edit:
>
> - **(a)** the no-accessories branch is genuinely unreachable now, and cells 6/9
>   should be retired or declared with the branch recorded as unreachable; or
> - **(b)** attach-first is over-applying, and a standalone conditioning session
>   must survive it — in which case the comparator needs a bound, and that is a
>   change to the ruled order.
>
> I will not choose between those: (a) deletes coverage and (b) narrows an approved
> ruling. Both are review-seat calls. Evidence for either is above.
>
> **Ruled 2026-08-06:** (b) rejected — attach-first is the ruled repair order with
> zero findings everywhere measured. (a) premature — the scan covered four seeds
> from two profiles and missed the modes that author standalone conditioning. The
> widened scan found the subject; see the resolution at the top of this document.

</details>
>
> Everything else: `test:bible` reached this suite, meaning all earlier suites
> pass, including `runSlice1`, `phase-structure` 11/11, `section18-safety` 34/34
> and `section18-gateway` 91/91. The golden IS regenerated in the tree with all six
> movements predicted — if this STOP resolves as a defect, the golden must be
> re-derived, not kept.


The unit approved in `FINDING_3_PLACEMENT_REASSESSMENT_APPROVAL_2026-08-06.md`.
Supersedes both step-2 checkpoints. Every golden movement is explained with
measured evidence and matched to a recorded prediction; nothing was regenerated
through an unexplained diff.

## North star

**Toward it.** No new stored state; one field stops being stored-from-output. The
week's offer count is now DERIVED from the mode's authored policy instead of
counted off the plan the contract is supposed to govern, and the working-day
budget is a derivation from `fullRest.required` consulted at construction rather
than a stored or re-derived second opinion. One representation removed, none
added.

## What changed

| # | change | site |
|---|---|---|
| 1 | working-day budget as a construction INPUT | `coachingEngine` `restBudgetSpare()` gating `freeSlots()` — the single reader all three repair domains share |
| 2 | `plannerSelectedCount` derived from authored policy | `coachingEngine:776`; `optionalFlushSelected` deleted, not merely unused |
| 3 | attach-first in the ORDER, not only eligibility | the strength-repair comparator's third key |
| 4 | speed-only `full_rest` consolidation retired | its `while` narrowed to `hard_day_limit_exceeded` |
| 5 | demote loop obeys `declaredOfferCount`, clears surplus | an undeclared flush is surplus, not an offer |
| 6 | ruled fix at BOTH sites | `section18SafetyPolicy` + `weeklyExposureContractBuilders` |
| 7 | cell 10 paid | `DECLARED_RED` is now `[]` |

Item 4's retirement is **behaviour-neutral, proven by mutation**: restoring the
full-rest arm changed no golden byte.

## The defect this unit nearly shipped

Item 6's first implementation gated on `requiredSafe.length === 0`.
`weeklyExposureContractV2` builds `requiredSafePatterns` as
`policy.balance && policy.strength.required > 0 ? … : []`, so **an all-optional
week has no required safe patterns for reasons that have nothing to do with
safety.** The condition read a MODE fact as a SAFETY fact. Corrected to
`availableSafePatterns.length === 0` — is any main pattern safe, which is the
question the ruling asks. Cell 11 still passes, so the whole-body half is intact.

Found by the step-1 coverage gate. Without that scenario the matrix could not see
this unit at all, and this would have shipped inside the commit that fixes the
same class of error.

## Three safety-boundary cells: which side moved

`P3`, `P6` and `M5` reached their frequency reduction through a PARTIAL
restriction, which the ruling now says must hold its frequency. Their invariants
did not weaken; the FIXTURE moved, so `wholeBodyInjuryContext()` puts them where
`:1913` authors the reduction. `P3` additionally pins the other side — a partial
restriction must author NO ceiling — so the fixture move cannot be mistaken for a
relaxation.

`M5` needed more, and it is a standing consequence of the ruling worth carrying:
**an injury-authored `main_strength_frequency` reduction can never bind
independently again.** It exists only when no pattern is safe, and there the
pattern prohibition already strips every strength row — measured, the mutated
contract still achieved 0. Its old kill criterion could not observe its own
mutant. The criterion moved to the boundary the module's own docstring promises:
a lowered policy must not survive re-projection from the typed constraints.

## Gateway cell 46 / P17: the same question, asked again

The first full `test:bible` run exited **1** (the completion notification claimed
0 — the printed exit line is the only trustworthy one, for the third time this
week). Two failures, both fed by one expression:

`46 severe upper injury produces a valid safe late-off-season S3/C4 week`
asserted `ledger.mainStrength.achievedCount === 3` for a Severe SHOULDER
restriction, which prohibits `push` alone and leaves three patterns safe.

Measured before touching it:

| world | `plannerSelectedTarget` | achieved | meaningful main lifts |
|---|---|---|---|
| healthy late off-season | 4 | **4** | squat 1 / hinge 1 / push 1 / pull 1 |
| Severe shoulder, after this unit | 4 | **4** | squat **2** / hinge 1 / push **0** / pull 1 |

**The literal 3 was the CEILING's number, not the contract's.** The contract
selects 4 in both worlds and the healthy control achieves 4; the old cap lowered
the restricted week to the count of surviving patterns. The cell was the abolished
behaviour written down as an expectation, and every clause that must NOT move
still holds — `push === 0`, `pull > 0`, `coreCount === 4`, zero blocking
violations, mode `late_offseason`.

Re-pinned to the ruling and STRONGER for it: it now reads the target from the
contract rather than a literal AND compares against the healthy control, so it
states `:4755` directly — the restricted week trains as often as the unrestricted
one, and the substitution is visible in the lift counts (squat doubles to cover
the lost push). `P17` shares the same expression and greened with it. Suite:
91 passed, 0 failed.

## Golden movements — all six predicted, two by correction

13 of 15 scenarios byte-identical; `modesReached` and the scenario set unchanged.
Diagnosis by bisection with temporary env toggles, all removed
(`grep -c 'process.env.LFA'` in `src/` is 0).

### `offseason-severe-restriction`, `mid_offseason` wk3/wk4 — predicted as written

`req 2->3`, `sel 2->4`, `ach 2->4`, `mainStrengthExposures 2->4`, status stays
`accepted`. Plus `conditioningExposures`/`extraConditioningSessions 4->3` in wk3
(the surplus flush cleared — cause B) and `runningExposures 1->0`.

### `offseason-severe-restriction`, `early_offseason` wk1/wk2 — CORRECTED

Predicted not to move; moved `mainStrengthExposures 1->0`.

**Mechanism.** Not the budget, not attach-first, not the flush declaration — all
four combinations give 0; restoring the old cap restores the 1. The consumer is
`section18SafetyFinaliser.ts:415-470`: with a non-null
`mainStrengthFrequencyCeiling` it runs a CONSOLIDATION pass that clones a
main-strength row for every `requiredSafePattern` not already represented. With
the old cap the week had ceiling 2 and safe patterns `['push','pull']`, so the
pass manufactured two main lifts:

```
old cap ON :  Tue rows = [main_strength/pull, main_strength/push, trunk_support, strength_accessory, strength_accessory]
old cap OFF:  Tue rows = [trunk_support, strength_accessory, strength_accessory]
```

**Direction.** `:110` — the week is all-optional and its contract requires and
selects zero main strength (`requiredMinimum: 0`, `plannerSelectedTarget: 0`,
`unresolvedMinimumShortfall: 0`, `unresolvedPlannerSelectedShortfall: null`).
`:72`/`:93` speak to keeping work in when work EXISTS; this work never existed in
the plan — a pass whose job is to CAP frequency authored it. A cap that adds main
lifts is a reduction inventing exposure, the shape
intensity-never-feeds-identity forbids. **Correct consequence of the corrected
gate**, and the week's shape is byte-identical either way.

### `preseason-team-and-game`, `practice_match_week` wk1/wk4 — CORRECTED

Predicted not to move; moved `hardExposures`/`hardDays 3->4`, and wk4
`recoverySessions 0->1`.

**Mechanism.** Attach-first alone; the budget is causally uninvolved
(budget × attach-first = 4/4/3/3). Wednesday already carried tempo, and
attach-first put the missing strength there, making it `Mixed`.

**Direction.** Same six days occupied, `restAchieved == fullRestRequired == 1` in
both, strength count 3 in both. `hardPreferred=4`, `hardPermitted=5`,
`isHardMaximum=false`, `hardFindings=[]`. The week landed exactly on its own
preferred hard-day count, one below its maximum, with zero findings — denser on a
day it already used, which is what attach-first is for and the shape `:81`
authors.

### Ruling application — the pre-ruled design question

The review seat ruled in advance: IF the budget were trading a full-rest breach
for a hard-day breach, the correct shape is ONE budget object carrying the week's
boundaries together (rest days AND hard days) as construction inputs to the same
owner, never a second guard.

**The condition is not satisfied**, on two independent measurements: the budget is
causally uninvolved in the only hard-day movement, and there is no hard-day breach
to trade into (4 ≤ permitted 5, zero findings, rest quota untouched). The
redesign is therefore **not triggered by this evidence and is not built** — the
ruling applied, not declined. It stands for the future: if any world shows either
mechanism pushing a week past `hardDays.permittedCount`, the shape is already
decided and needs no further sign-off.

## Filed, not folded

The adjacent question — an all-optional week SELECTS three optional
main-strength sessions with push and pull both safe and offers **none** (healthy
control 3, restricted 0, and the 3→1 half predates this unit) — is ruled out of
scope and filed as its own queue entry,
`docs/QUEUE_ALL_OPTIONAL_RESTRICTED_STRENGTH_OFFER_2026-08-06.md`, pointed at
from the legacy-reckoning census. **It carries no LR id**: the ledger is 30 of 30
against a ratified ceiling, and per that document's own precedent a thirty-first
unit needs Sam's word rather than a bump taken while filing. It does not map
cleanly onto an existing unit's subject, so assigning it is a review-seat call.

## NOT covered

- The four boundary tests are step 3 and are **not in this commit**. Until they
  land, the budget is proven only by the §4 repro and the goldens; nothing yet
  asserts occupancy against `7 − fullRest.required` on the LEDGER, and nothing
  yet pins attach-first by ORDER rather than eligibility.
- `visibleCounts` still has no full-rest-day count, so the golden witnesses the
  budget only through `section18.status`. Stated in step 1 and still true.
- Displacement of an inactive allocation can still turn a rest day active without
  consulting the budget; `freeSlots()` covers free-day claims only. Not reached by
  any measured world, so recorded rather than built, per Sam's ruling that a path
  nothing can reach is a fixture with no subject.
