# Repair capacity — ARCHITECTURE REASSESSMENT (STOP)

**Written because the same class of defect appeared twice.** CLAUDE.md's escalation
rule and Process Law L11's stop-rule both require this before any further fix work
on it: *"the moment two defects differ only by their combination coordinates, ALL
fix work stops until the matrix covers that space."*

**Status: BLOCKED, awaiting Sam's ruling on question 4.** The four placement
deletions Sam ruled on 2026-07-30 — R2 (G-3 accessories become need-based), R3
(spare-day accessories killed), R4 (bye support slot killed as a default), R5
(scorer ACC folded into the pass) — are **not landed**. Their COMPOSITION rulings
are landed. Nothing else in the placement unit is held back.

---

## The two defects

| | Recovery deletion (2026-07-30, earlier) | This unit |
|---|---|---|
| What was deleted | eight uninvited Recovery placements | four uninvited Accessory placements |
| Which repair starved | **main strength** | **conditioning** |
| Symptom | an `in_season_bye_recovery` week came out with ONE main strength exposure where the contract required two | a hydrated in-season week could not reach its third core conditioning exposure; `acceptedStateTransactions` regression 10 threw `required_minimum_shortfall:conditioning:2` |
| Mechanism | the repair reaches its day through an EXISTING allocation it can overwrite (`tier === 'recovery' \|\| 'optional'`). The deleted placement WAS that allocation. | identical |

**They differ only by which domain's repair starved.** That is a coordinate in a
space nothing enumerates, which is exactly what L11 names.

The first one was found on a device round trip and fixed by giving the STRENGTH
repair blank placeholders for free days (`repairPlaceholders` in
`coachingEngine.ts`, under the heading "A FREE DAY IS REPAIR CAPACITY (Sam's
charter, 2026-07-30)"). **The fix was deliberately scoped to strength**, and the
code says why:

> Leaving them in for the conditioning repair let it build a standalone
> conditioning day on a free slot where it would otherwise have attached a combined
> component — and because `allowCombinedStrengthConditioning` moves with capacity,
> the week's shape then moved with capacity too. `readinessDoseSweepTests` caught it
> as `prescribedSessions 3 -> 4 @low`, which is Sam's readiness law ("capacity never
> changes the shape of the week") breaking by side effect.

So the general fix was BUILT and then RESTRICTED, and the restriction is what this
unit walked into. That is why this is a reassessment and not a second fix.

---

## The seven questions

### 1. What is the current source of truth?

For the week's SHAPE, three things in sequence, and no single one of them owns it:

1. **The allocator** (`buildCoachingPlan`) decides which days carry what.
2. **The shortfall repairs** (inside the same function, after allocation) mutate
   that decision until the typed contract is satisfiable.
3. **`requireSection18AcceptedWeek`** accepts, regenerates, or falls back.

The contract is the source of truth for what the week must CONTAIN. Nothing is the
source of truth for which DAY carries it — the allocator proposes and the repairs
overwrite.

### 2. How many representations of "this day is available" exist?

**Four**, and they disagree:

- `daySlots` — the athlete's declared training days, the allocator's input.
- the presence of an allocation in `plan` — what the allocator produced.
- `isSafeRepairDay(session)` + `tier === 'recovery' || 'optional'` — what a repair
  may overwrite. **A day with no allocation is invisible to this**, which is the
  whole defect.
- `repairPlaceholders` — blank allocations synthesised for free days, visible to
  the strength repair only, removed again before any other repair runs.

The third is the one that is wrong: it reads "available" off the presence of
something the app already put there. An empty day is MORE available than an
occupied one, and this representation says the opposite.

### 3. Where can availability be reinterpreted?

At every repair. Each one re-derives "can I use this day" from the allocation it
finds, so each has its own answer, and a placement deleted anywhere changes the
answer for all of them at once — invisibly, because a starved repair does not
fail. It quietly does less, and the week is short by one session.

That is the property that makes this class expensive: **deleting an unauthored
placement silently reduces authored work.** There is no gate between the two.

### 4. Which layer should own the decision? — **THE QUESTION FOR SAM**

The candidate answer: **the repair layer owns "which day", and its capacity is the
week's FREE DAYS, not its overwritable allocations.** `repairPlaceholders` already
implements this for strength; the question is whether it extends to conditioning.

Sam's charter already says the words — "A FREE DAY IS REPAIR CAPACITY" — so the
principle is not in dispute. What is in dispute is its collision with his readiness
law, and that collision is genuinely his to resolve:

> **When a week is short of conditioning and the only day available is empty, does
> the app add a session — even though at higher capacity it would have attached the
> same conditioning to an existing strength day?**
>
> - **YES** → the week's session COUNT moves with capacity (3 → 4 at low
>   readiness). Reads as a violation of "capacity never changes the shape of the
>   week", but the WORK is identical either way: the same conditioning exposure,
>   attached in one case and standalone in the other.
> - **NO** → the conditioning repair keeps needing an overwritable allocation, and
>   therefore the four placement deletions cannot land. Optional accessory
>   placements stay as repair raw material, which means the app keeps placing
>   accessory work by DAY for a reason that has nothing to do with accessories.

There is a third possibility and it may be the real answer:

> - **NEITHER** → the shortfall should not exist. A week whose contract needs three
>   conditioning exposures should be ALLOCATED three, and a repair that has to
>   invent the third is evidence the allocator under-planned. The repair layer would
>   then shrink rather than grow: it exists to fix contract misses, and a
>   systematically-missing exposure is not a miss, it is a planning bug.

I recommend NEITHER, then YES as the fallback for genuine one-off misses. I have not
implemented either, because both re-shape weeks Sam has not seen.

### 5. What simpler architecture removes representations instead of adding guards?

Collapse questions 2's four representations to **two**: the athlete's declared days
(an input), and the contract (an authored requirement). "Which day carries what" is
then a single derivation over those two, run once, with no repair phase to reach
into — the allocator either satisfies the contract or reports which requirement it
could not place.

Under that shape this defect class is unrepresentable: there is no "overwrite an
existing allocation" step to starve, because no step reads what the app has already
put on a day as evidence about the day.

That is a bigger pivot than this unit, and it is the same convergence the north star
already names — store decisions, derive everything. Recorded here so the small fix
is not mistaken for the destination.

### 6. Which legacy paths should be bypassed or retired rather than patched?

- **The overwrite-based repairs.** Every one of them (`strengthCandidates`,
  `conditioningShortfall`, the adjacency neutralisation) selects a day by inspecting
  what occupies it. They should select from free days plus a declared, ordered list
  of what may be displaced.
- **`repairPlaceholders`' scoping and cleanup.** A mechanism that adds capacity and
  then removes it before the next consumer runs is a guard, not an owner. Either
  free days are capacity for all repairs or for none.

### 7. What tests prove the new ownership boundary?

Not the ones that exist. Both defects were found by suites that could only see the
symptom, one domain at a time — `bibleConformance` for strength, then
`acceptedStateTransactions` for conditioning. What the class needs is a matrix cell
per **(deleted placement × repair domain)**:

> For every day-based optional placement the generator can make, delete it and
> assert that every contract requirement is still satisfiable.

That is enumerable today — the placements are the eight rows of the placement sheet
and the domains are the contract's — and it is what would have caught the second
instance before it was written. It belongs in the athlete-door matrix beside the
door × day-state × route dimensions, as a third: **placement × domain**.

---

## A second finding, from writing R7's cell

R7 (rest-slot conditioning) was recorded as needing **no code change**: the
placement sheet lists its composition as "the 55 signed conditioning templates", so
the class ruling was already satisfied. Writing the cell that proves it showed the
claim is **false**.

What the generator actually puts on a rest-slot conditioning day is a synthesised
prescription string — `"5 x 8min zone 2 Rower"` — assembled from a flavour, a dose
and an erg modality. It is not one of the 55 signed `CONDITIONING_TEMPLATES`, and it
is not one of the ~20 names in `TEMPLATE_CATEGORY` either, which is a **third**
conditioning vocabulary.

This is the conditioning-composition debt the session-type charter already declares
for the athlete's DOORS ("none of the 55 signed conditioning templates is
consulted") turning out to hold for the GENERATOR as well. It is pinned as-is in
`optionalTopUpTests` §C so the answer cannot change silently, and it owes Sam a
ruling of its own. **No conditioning composition was changed in this commit** — the
finding is reported, not acted on.

The lesson is worth recording next to the repair-capacity one: **"no change needed"
is a claim like any other.** R7 was going to ship as a ruling satisfied in prose. It
took writing the assertion to discover it was not, and the assertion took ten
minutes.

---

## What is landed, and what is not

**Landed** (none of it touches repair capacity):

- the need-based top-up pass, WIRED after `requireSection18AcceptedWeek`;
- the class ruling on composition — every optional session the generator places is
  composed from Sam's signed pools, including the G-1 Gunshow (R1), the accessory
  days (R2/R3/R4/R5) and the adjacency repair's neutralised day (R8);
- the flow bundles retired everywhere, with the in-session flow composing from D17.

**Not landed, and blocked on question 4:** the four placement deletions.

**The one-commit condition, honestly:** Sam bound the pass and the six rows into one
commit so that neither shipped alone. That condition is met for R1, R7 and R8 and
for the composition half of R2–R5. It is NOT met for their placement half, and the
reason is a defect class the commit would otherwise re-introduce. Landing the
deletions on schedule would have meant shipping a week that is quietly one
conditioning exposure short — which is the cost the condition exists to prevent.
