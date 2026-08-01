# Repair capacity — ARCHITECTURE REASSESSMENT (STOP)

**Written because the same class of defect appeared twice.** CLAUDE.md's escalation
rule and Process Law L11's stop-rule both require this before any further fix work
on it: *"the moment two defects differ only by their combination coordinates, ALL
fix work stops until the matrix covers that space."*

**Status: RULED AND IMPLEMENTED.** Sam answered question 4 on 2026-07-30 with the
third option — NEITHER — and the four placement deletions are landed. His ruling and
what it produced are recorded in the section "Sam's ruling, and what it changed" at
the end of this document. The seven questions below are left exactly as they were
written before the ruling, because the reasoning they record is what the ruling
answered.

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

---

## Sam's ruling, and what it changed (2026-07-30)

> **NEITHER, as recommended. THE BUILDER OWNS THE WEEK.** A contract that requires
> three conditioning exposures gets a week ALLOCATED with three — the allocator
> satisfies the contract by construction or reports which requirement it could not
> place. A systematically-missing exposure is a planning bug at the allocator, never
> a repair's job. The repair layer SHRINKS to genuine one-off misses only.
>
> For those genuine misses, the fallback order is: **ATTACH** the missing work to an
> existing day first; **STANDALONE** on an empty day as last resort; and if the
> system truly cannot find room, the standalone may be placed **VISIBLY OPTIONAL** —
> but "you should be able to find room." A week that regularly reaches step 3 is
> evidence of an allocator bug, not a tolerable steady state.
>
> Free days are repair capacity for **ALL** domains. `repairPlaceholders`'
> strength-only scoping and its add-then-remove cleanup are retired with the
> overwrite-based day selection. Repairs select from free days plus a declared,
> ordered displacement list; **nothing reads "what occupies a day" as evidence about
> the day.**
>
> Readiness law intact and restated: capacity changes dose, and in the rare fallback
> it may change attached-vs-standalone packaging of the SAME work — it never changes
> the required work itself.
>
> The question-5 collapse is recorded as the **Stage B destination** — do not build
> it now, but nothing built now may fight it.

### What was built

- **One day-selection owner for every repair.** Free days enter each domain's
  candidate pool as bare allocations held OUT of the week until claimed, so there is
  no add-then-remove pass and no window in which the week holds a session nothing
  asked for. Displacement is `DISPLACEABLE_TIERS`, declared and consulted last.
- **The ruled fallback order**, per domain: attach, then free day, then displace.
  The conditioning repair keeps its capacity rule — when the contract forbids
  combining at this capacity it cannot attach, so it takes a free day, which is the
  packaging change the restated readiness law permits.
- **The four deletions landed:** R2 (G-3 by the day), R3 (spare days), R4 (the bye
  support slot), R5 (the scorer's ACC placement).
- **The (placement × domain) matrix**, in `athleteDoorMatrixTests` as a third
  dimension beside door × day-state × route: 8 scenarios × 3 contract domains,
  asserting both halves together — every domain satisfied (reds when a repair
  starves) AND no optional session that no need justifies (reds when a day-based
  placement returns).
- **The readiness dose sweep re-pointed** to the restated law: every WORK key must be
  byte-identical across capacity with no exception list at all, and
  `prescribedSessions` alone may differ. The two shapes previously pinned as
  known defects are packaging, and the pinned list is deleted rather than grown.

### Step 3 — RECORDED AS LAW, NOT BUILT (Sam's ruling, 2026-07-30)

> **Option (b).** The visibly-optional last resort is RECORDED AS LAW, NOT BUILT. No
> placement path, no fixture — a path nothing can reach is a fixture with no subject.
> **If the deep walker or a real week ever reds with both attach and standalone
> failing, step 3 gets built against that real case, red-first.** Recorded here so it
> cannot be read as missing.

So the fallback order is law in all three of its steps, and the third has no code:

1. **ATTACH** the missing work to an existing day. *Built.*
2. **STANDALONE** on an empty day. *Built.*
3. **VISIBLY OPTIONAL** standalone when there is no room for either. **Law. Not built,
   deliberately, and this is where the trigger for building it is written down:** a red
   from the deep walker or a real week in which steps 1 and 2 both fail. That case gets
   the cell first and the code second.

What exists instead of a placement path is the other half of the ruling — the allocator
reports which requirement it could not place, rather than silently doing less. A week
that reaches step 3 is evidence of an allocator bug, and the report is what makes the
bug visible.

**Why this is not a shortfall.** An unreachable code path is untestable by definition,
and this repo has already paid for both directions of that: a fixture whose input
cannot exhibit the defect proves nothing, and a diagnostic that is dark on the build
the defect lives on is a green gate that lies. Step 3 would have been the one path in
the repair layer with no cell behind it. It is better as a sentence with a trigger than
as code nothing runs.

### What the ruling exposed on its way in

Landing the deletions made two dormant defects reachable, both of them placements that
had survived every sweep because the filler hid them:

1. **The resolver's ninth recovery placement.** `resolveWeekWithConditioning`'s pass 3
   put a derived recovery session on every remaining empty day, under an app-invented
   rule. It had never had an empty day to claim. It fails condition 1 of the Optional
   Placement Law and is deleted.
2. **The top-up could land on G+1.** The signed caps named the game day and G-1 and
   stopped; the Bible reserves G+1 for complete rest or recovery
   (`g_plus_1_rest_or_recovery`). Both defects surfaced through the same cell —
   `athleteSessionDeletionTests` regression 6 — because a derived session cannot be
   deleted: it re-appears on the next read and the door honestly reports that nothing
   changed.

Both are the same shape as the class this document is about: **a placement nobody
authored, kept alive by another placement nobody authored.**

---

## What the mutation test showed, and what it corrects

Sam asked for the (placement × domain) cells to be **red before the deletions, green
after**. Four mutations were run against the landed state to check that claim. Two of
them corrected it.

| Mutation | Result | What it means |
|---|---|---|
| Remove ALL free-day repair capacity | **RED** — `in-season/bye/6d/0tt` fails with `planner_selected_target_miss:main_strength:2` and `required_minimum_shortfall:conditioning:2` | The D-DOMAIN half is genuinely red-before / green-after. This is the starvation, caught by domain, and it is what the dimension exists for. |
| Remove only CONDITIONING's free-day capacity | GREEN | Conditioning's own free-day capacity is currently **redundant in these scenarios**: the strength repair claims a free day first, and the conditioning repair then ATTACHES to the day strength just claimed. It was load-bearing in the hydration / legacy-migration path, which this dimension does not reach. |
| Restore R2 (G-3 accessories by the day) | GREEN | R2 places on the same day the need chooses — G-3 of a Saturday game week is both the Bible's Wednesday and the only spare day — and the need genuinely exists in those weeks. |
| Restore R3 (any spare day) | GREEN | Same coincidence: with one spare day and an optional budget of one, R3 and the need produce the identical week. |

**Two claims are corrected by this.**

1. **The four deletions are behaviour-preserving in the space the matrix covers.** They
   were presented as a behaviour change; in these scenarios the week that comes out is
   byte-identical. What they change is that the placement now has a stated reason
   instead of a day, and that no repair depends on it. That is still the point — the
   starvation is real and cost two device-visible defects — but the weeks did not move,
   and saying they did would have been a stronger claim than the evidence supports.

2. **D-PLACEMENT is a ratchet, not a proof.** It reds when a placement DIVERGES from
   the need — a second session, or a day the need would not choose. It does not red on
   a day-based rule that happens to coincide with the need, which is what the deleted
   rows did here. The half carrying the red-before / green-after property is D-DOMAIN.

The honest summary: **the deletions bought a reason, and the repair rework bought the
week.** Only the second is visible in a generated week, and only the second is what the
matrix can prove.
