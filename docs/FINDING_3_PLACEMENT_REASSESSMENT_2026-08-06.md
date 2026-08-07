# FINDING 3 — PLACEMENT REASSESSMENT, measured first

The §5 reassessment owed by
`docs/FINDING_3_BUILD_MEASUREMENT_2026-08-06.md`. Nothing is built. The ruled
fix was re-applied UNCOMMITTED to reproduce the §4 world, the pipeline was
instrumented at every boundary that could decide the diff, and the whole
scaffold was reverted before this was written. `git status` clean on
`feat/stage-b-stage2`.

**Question 3's hypothesis is REFUTED, and the §4 doc has one factual
correction.** The measurements also found a SECOND, independent cause that
§4 did not see, and it is the one the Optional Placement Law speaks to
directly.

## 0. Method

Repro exactly as §4: `profile()` off-season, 6 preferred days Mon–Sat,
`activeHamstringConstraint()` (severity 7), `todayISO: 2026-07-13`, healthy
control generated in the same process. The ruled fix re-applied at both sites
§1 of the measurement doc names. Probes, all `LFA_PROBE`-gated:

| probe | boundary |
|---|---|
| `[CONTRACT-BUILD]` | `coachingEngine.ts:776` — what the contract is TOLD about the offer |
| `[ALLOC]` | entry to `applySection18ConditioningAllocation`, with call-site stack |
| `[REPAIR-ENTRY]` | `coachingEngine.ts:6526` — the repair-capacity owner's inputs |
| `[STRENGTH-CANDIDATES]` | the candidate set, its order, and every rejection with its reason |
| `[SURPLUS]` / `[stampFlush]` / `[PLACE-BRANCH]` / `[placeFlush]` | which of the two flush routes fires |

Reproduced on the nose: weeks `2026-07-27` and `2026-08-03` both
`required_exposure_shortfall / full_rest / expected 2 / actual 1`.

---

## Question 3 — is the injured Saturday's Aerobic Flush 1b's offer?

**NO. Measured, and the hypothesis is dead.** It is not placed by
`rules/section18OfferPlacement`, and 1b's placement branch is unreachable in
this world.

| evidence | measurement |
|---|---|
| which route stamped it | `[stampFlush/DEMOTE] day=Saturday cat=aerobic_base` — the DEMOTE loop, `coachingEngine.ts:7070-7083` |
| 1b's placement branch | `[PLACE-BRANCH]` **never fired**, on any pass, in either week |
| what the contract declared | every `[ALLOC]` pass: `declaredFlushIn=0/1` — `declaredOfferCount()` is **0** |
| repair-side placer | not involved: `planEntryId=w3:saturday:none:aerobic-base`, not `offer:<weekStart>:saturday:flush` |

So `selectOfferDays` was never consulted and `presentDeclaredOffer` never ran.
The week is not "presenting an always-present offer that quietly needed a bare
day". The truth is the other way round:

> The injured plan arrives with a **SURPLUS 4th conditioning allocation**, and
> the demote loop **relabels the surplus as the offer instead of clearing it**.

`[ALLOC] requiredApp=3 selectedApp=3`, `existingEligible=Mon,Wed,Fri,Sat`,
`selectedCore=Mon,Wed,Fri` — Saturday is the leftover. The loop at `:7071`
iterates leftovers and either stamps a flush or clears; Saturday is
`aerobic_base` and fixture-safe, so it is stamped.

### The correction to §4

> §4: "**The two contracts are identical**."

True of the v1 numbers it lists (strength 4/3, conditioning 3/3, `fullRest` 2).
**False as stated.** One field differs, and it is the field question 3 is
about:

| | healthy | injured |
|---|---|---|
| `conditioning.optionalFlush.plannerSelectedCount` | **0** | **1** |

And it differs **because of the demotion, not before it**. Final pass:

```
[CONTRACT-BUILD] policyMinDeclared=0 alreadyStampedInPlan=1
                 => plannerSelected.optionalFlush=1
```

`coachingEngine.ts:776` is `Math.max(policy min, count of flushes already in
the plan)`. The allocator stamps Saturday, then the contract **learns its own
declaration from the plan it was supposed to govern**. On the north star that
is a stored output wearing a decision's clothes: `plannerSelectedCount` should
be derived from the mode's authored policy, never counted off the allocator's
output. The comment at `:767` ("DECLARE, THEN PLACE") describes the intent; the
`Math.max` is the loop that defeats it.

---

## Question 2 — what decides stack-vs-bare, and why does it differ?

**Nothing decides it.** There is no stacking policy. `applyCategory`
(`coachingEngine.ts:6896-6897`) sets
`hasCombinedConditioning = hasStrength(session)` — a day is `Mixed` purely
because strength happened to already be on that same allocation. Stacking is an
OUTCOME of placement order, never a decision anyone owns.

Why the two weeks differ, measured at `[REPAIR-ENTRY]`:

| | healthy wk3 | injured wk3 |
|---|---|---|
| `allowCombined` | `true` | `true` |
| strength target | 4 | 4 |
| **achieved by the first-pass allocator** | **4** | **2** |
| shortfall → repair runs? | 0 → **never runs** | 2 → **runs** |
| `freeSlots` | `Tue,Thu` — left alone | `Tue,Thu` — **both consumed** |
| full-rest days | Sun+Tue+Thu = 3 ✓ | Sun = 1 ✗ |

The healthy first-pass plan is four allocations, one legal pattern each
(`Mon push / Wed hinge / Fri pull / Sat squat`), with conditioning attached to
three of them. Nothing is missing, so the repair never runs and the two spare
days stay spare.

With squat and hinge prohibited, the same first pass yields only **two** legal
exposures (`Mon push`, `Wed pull`). The strength repair supplies the other two.
Its candidate set and order:

```
[STRENGTH-CANDIDATES] surplus=0 chosen=Tue(FREE),Thu(FREE),Fri,Sat
  [REJECTED] Mon ... alreadyStrength=true
  [REJECTED] Wed ... alreadyStrength=true
```

**Friday and Saturday ARE eligible.** `allowCombined=true`, so the filter
admits them. They lose on the comparator's third key
(`coachingEngine.ts:6579`):

```js
Number(leftSurplusConditioning) - Number(rightSurplusConditioning)
```

Any day already carrying conditioning sorts **last**. So the repair takes the
two free days, spends both of the week's rest days, and leaves Friday and
Saturday bare.

### The contradiction to name

Ninety-nine lines above that comparator, `coachingEngine.ts:6480` states Sam's
ruled order verbatim:

> "THE FALLBACK ORDER IS RULED: attach the missing work to an existing day
> first; take a free day standalone second; displace only after that."

The **filter** implements it. The **comparator inverts it.** The ruled order
was encoded in eligibility and contradicted in ordering — which is why no gate
caught it: every day the ruling wanted was present in the candidate list.

### Isolation, single variable

Flipping that one key to prefer conditioning days — **a measurement, NOT the
proposed fix** (see question 5) — takes both weeks to `§18 accepted=true`:

```
Mon Mixed  push + aerobic_base (core)      Thu —  (free)
Tue —  (free)                              Fri Mixed  pull + tempo (core)
Wed Mixed  pull + tempo (core)             Sat Mixed  strength + aerobic_base (FLUSH)
```

Four strength, three core conditioning, two spare days kept, and the offer
lands **on a strength day** — Bible `:81`'s authored shape, which the current
code reaches by accident in the healthy week and never in the injured one.

---

## The second cause §4 did not see

Clearing the surplus instead of stamping it — sort key untouched — **also**
takes both weeks green. Saturday becomes `Recovery`, contributes nothing, and
`full_rest` returns to 2.

So there are **two independent sufficient causes**, and each alone flips the
week:

- **A (structural).** The repair prefers a free day over an attach, spending
  Tue and Thu.
- **B (the offer).** A day whose only content is the OFFER counts as a working
  day, so presenting it costs the week a required rest day.

B is the Optional Placement Law breached one layer BELOW the placer, in the
ledger. At both ledger sites the §18 role gates the conditioning count and
**does not gate the active-day count**:

| site | `conditioningDays` / `appCoreConditioningDays` | `activeDays` |
|---|---|---|
| allocation ledger, `weeklyExposureContract.ts:409-415` | role-filtered | **unconditional** |
| effective-week ledger, `weeklyExposureContract.ts:561-576` | role-filtered | **unconditional** |

A flush therefore counts toward **nothing** in the conditioning arithmetic
(correct, and `:127`'s promise) while counting toward **not-a-rest-day**
(which is how an offer buys required structure). One defect, two sites — the
`owner-unreachable-by-shape` shape again.

**This does not license a ledger change.** Under the offer-survival rulings in
force the remedy is at the PLACER: a flush that cannot attach, or cannot fit
without spending a required rest day, is **moved or dropped, not honoured at
that price**. A day the athlete is shown work on is honestly an occupied day;
the ruling says don't offer it there. The measurement matters because it
explains the mechanism and it tells us cause B is not cosmetic.

---

## Question 1 — who owns the week's working-day budget?

**Nobody, measured.** `fullRest` appears **zero** times in
`coachingEngine.ts`. `full_rest` appears **once**: `:6759`, inside a
consolidation loop that is

- **speed-only** — it can move a standalone speed block onto an upper-strength
  day and nothing else, and
- **reactive** — it fires only `while` the validation already reds.

That loop is the precedent and the indictment together: the exact move this
week needs (consolidate rather than occupy another day) is already written, for
one domain, as a post-hoc repair. Meanwhile `freeDayCandidates` (`:6505`) is
built from occupancy alone and `claimSlot` spends free days without ever asking
how many the week may occupy.

Per the repair-capacity ruling in force — **the builder owns the week**; the
allocator satisfies the contract by construction, attach-first — the budget
belongs to that owner as an **INPUT**:

```
occupiable days = 7 − fullRest.required        (anchors already occupied)
```

consulted **before** a free slot is claimed, not after a gate reds. A
post-hoc guard here would be the forbidden shape.

## Question 4 — should Bible `:4688` step 3 be reachable here?

**YES — already ruled, by the Bible itself.** `:4688` step 3, "move or remove
lower-priority optional work to recover space or stress", is the authored
answer to a week that cannot fit, and nothing in this pipeline invokes it.

Measured, this week is exactly its subject: the only lower-priority optional
work present is Saturday's flush, and moving it onto a strength day is
precisely what experiment A produces. The step is not missing because it is
wrong; it is missing because **no layer holds a notion of "the week is over
budget" for it to act on** — which is question 1's answer restated. Build the
budget and step 3 has a trigger; leave the budget unowned and step 3 stays a
path with no subject.

## Question 5 — which layer should own it?

The **repair-capacity owner in `buildWeeklyPlan`** (`:6454-6640`) — the layer
Sam's 2026-07-30 ruling already named — with the working-day budget as a
construction input. Three representations collapse rather than a fourth guard
arriving:

1. **The budget becomes an input, not an outcome.** `fullRest.required` joins
   the candidate decision. The speed-only loop at `:6759` is then a special
   case of one rule, and is a **retirement candidate**, not a sibling.
2. **`plannerSelectedCount` stops being counted off the plan.** Derived from
   the mode's authored policy, `:776`'s `Math.max` goes. That removes the
   loop where the plan declares its own contract, and it is the north-star
   move: the offer count becomes derived, not stored-from-output.
3. **Stacking stops being an accident.** With attach-first honoured in the
   ORDER as well as the filter, `hasCombinedConditioning = hasStrength(...)`
   becomes the consequence of a decision someone made, rather than the record
   of where placement happened to land.

Deliberately NOT proposed: flipping `:6579`'s sort key on its own. It greens
the repro — proven above — and it is still the repair layer doing structural
work, which is the defect the repair-capacity ruling exists to forbid. It is
the isolation of the cause, not the fix.

### CLAUDE.md's remaining escalation questions

- **Source of truth:** the v1 legacy contract for counts, Contract v2 for
  policy — except `optionalFlush.plannerSelectedCount`, which is currently
  sourced from the OUTPUT. That is the one genuine ownership break.
- **Representations of "where does work go":** four — the first-pass allocator,
  the strength repair, the conditioning repair, and the speed consolidation
  loop. Only the last knows `full_rest` exists.
- **Where intent is reinterpreted:** at `:6579` (ruled order inverted) and at
  `:776` (declaration overwritten by observation).
- **Legacy paths to retire, not patch:** the speed-only `full_rest`
  consolidation loop; the `Math.max` at `:776`.

## What the tests must prove

1. A restricted week with a working-day budget occupies **no more days than
   `7 − fullRest.required`**, asserted on the LEDGER, not on session count —
   §4's cell 10 was weaker than its own ruling for exactly this reason.
2. Attach-first is proven by ORDER, not eligibility: a world where a
   conditioning day and a free day are both eligible must take the
   conditioning day. Mutating `:6579`'s key must red it.
3. An offer that cannot fit is **moved or dropped** and never refuses the week
   (`:4688` step 3 reachable, advisory per the offer-survival rulings).
4. `plannerSelectedCount` is proven independent of the plan: stamping a flush
   in the allocation must not change the contract's declaration.

## Coverage gate — the goldens cannot see this unit

Restated from §7 and now a precondition, not an observation. Both differential
matrices carry one injured scenario (`offseason-lower-niggle`) authored as a
**Mild** profile injury; `resolveRestrictedMainStrengthPatterns` restricts
profile injuries only at **Severe**, so neither site is reached and neither
golden moves.

**A restricting-injury scenario joins the differential matrix BEFORE the
finding-3 fix lands.** Otherwise the golden certifies a week the fix never
touched, and the whole unit ships behind a gate passing on coordinates it never
builds — the shape Sam has now named five times.

## Status

Reassessment complete, awaiting review-seat approval. No pipeline code written;
scaffold reverted; cell 10 remains declared red with its declaration pointed at
`docs/FINDING_3_BUILD_MEASUREMENT_2026-08-06.md`.
