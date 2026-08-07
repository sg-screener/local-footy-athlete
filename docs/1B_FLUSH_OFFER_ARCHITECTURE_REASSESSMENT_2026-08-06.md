# 1b — architecture reassessment before any more offer code

**Why this document exists.** CLAUDE.md's escalation rule: for plan-adjustment
work, stop implementing when "the AI/semantic layer understands the user
correctly, but a later layer changes, blocks, downgrades, or reinterprets that
intent". 1b has now failed that way once — an offer pass was written on
2026-08-05 against `coachingEngine` ~7000 and **did not take effect**. The rule
says do not add another resolver, guard, fallback or placement pass until the
reassessment is approved. Nothing in this document is implemented.

Sam's ruling INTENT is not in question and is not being relitigated: the flush is
**always offered in-season, it is the athlete's choice, and it never counts
toward `:127`'s arithmetic** (`docs/FLUSH_OFFER_RULING_2026-08-05.md`).

## Two premises that were wrong, both now measured

1. **The parked doc's guess that "the in-season week is composed by a different
   pass" is BACKWARDS.** The 1b cells read
   `resolveWeekWithConditioning(...)`, and that function **returns early at
   `sessionResolver.ts:1677` whenever the week has a Contract v2** — which every
   accepted in-season week has. Its Pass 2 (conditioning) and Pass 3 (recovery)
   never run; empty days are converted to typed rest and returned. Its own
   comment says so: "the legacy gap-fill passes below must not invent a new
   conditioning or recovery session after the accepted-week gateway."
   **So the previous session was editing roughly the RIGHT layer.** The accepted
   v2 week genuinely owns this; there is no other composing pass to move to.

2. **`optionalFlush.min` is inert** — the earlier finding stands. Only `.max` is
   read (`permitted: max > 0`, and the placement cap).

## Why nothing is offered today — the full chain, measured

In-season with 2 team trainings + a game:

```
creditedAnchors = anchors claiming conditioning            → 3
requiredApp     = max(0, requiredMinimum - creditedAnchors) → 0
selectedApp     = max(requiredApp, plannerSelectedTarget - creditedAnchors) → 0
selectedCore    = existingEligible.slice(0, 0)              → []
missing         = 0                                          (no candidates sought)
```

Then the flush loop iterates `plan.filter(hasConditioning && !isTeamDay)` — no
session carries conditioning, so **the loop body never executes**. It can only
ever DEMOTE an existing candidate. It has no ability to CREATE the offer.

Measured derived week (both cells still red, correctly contained):

```
Mon Team Training + Upper Pull | Tue Lower Body Strength | Wed Team Training +
Upper Push | Thu Prehab & Accessories | Fri Gunshow | Sat Game Day | Sun —
```

## The ordering defect — the likely reason the 2026-08-05 offer vanished

`coachingEngine.ts:719`:

```
const optionalFlushSelected = weeklyPlan.filter((a) =>
  a.section18ConditioningRole === 'optional_flush').length;
```

That count is fed into `buildSection18WeeklyExposureContractV2` as
`plannerSelected`. **But `applySection18ConditioningAllocation` — where the
offer would be stamped — runs at 1317 / 6175 / 6799, all AFTER the contract is
built.** So an offer placed in the flush pass is invisible to the contract that
subsequently judges the week: the planner declares zero flushes, then produces
one.

**This is the reassessment's central finding: the offer is not a placement
problem, it is a DECLARATION-ORDER problem.** Any pass that stamps the role
after the contract is built is asking a later layer to accept work the contract
was never told about — the same shape as the `:6936` comment's own recorded
failure ("authored an app session to cover a gap that did not exist — which then
breached the week's conditioning maximum").

## The seven questions

1. **Current source of truth?** The Contract v2 accepted week. The resolver
   defers to it; the projection renders it.
2. **How many representations of "the week wants an optional flush"?** Three,
   and they disagree: the authored Bible structures (`:81`), the contract's
   `optionalFlush` range (whose `.min` is inert), and the allocation's
   `section18ConditioningRole` stamp. Only the third has any effect, and it is
   applied after the first two are consulted.
3. **Where can the intent be reinterpreted?** At contract build (the flush is
   not in `plannerSelected`), at the demote loop (`clearConditioning` on
   anything not selected and not flush-eligible), and at the acceptance gateway.
4. **Which layer should own the decision?** The **contract**. "In-season always
   offers a flush" is a statement about the week's authored shape, which is what
   the contract represents. The allocation should SATISFY that declaration, not
   invent it afterwards.
5. **What simpler architecture removes representations?** Declare the flush as
   part of `plannerSelected` BEFORE the contract is built, so one number flows
   forward and the allocation's job is to place what was declared. That deletes
   the "place then hope acceptance agrees" path rather than adding a guard to
   it. It also makes `optionalFlush.min` MEANINGFUL for the first time — the
   ruling's own instrument stops being inert.
6. **Which legacy paths retire?** The demote-only branch stops being the sole
   producer of `optional_flush`; the resolver's dead Pass 2/Pass 3 for v2 weeks
   are already unreachable and should be recorded as such rather than re-entered.
7. **What tests prove the ownership boundary?** `phaseStructureConformanceTests`
   cell 5 (declared red today) plus a new cell asserting the offer does NOT move
   `coreCount` — i.e. the `:127` arithmetic is untouched, which is the half of
   Sam's ruling that must not regress.

## Recommendation

**Declare, then place.** Add the flush to the contract's `plannerSelected` input
for in-season weeks and let the existing allocation machinery place what the
contract declares. Do NOT write a second offer pass after the contract is built —
that is the move that already failed once, and question 3 says why it will keep
failing.

## Cell 6 is probably NOT part of this unit

Cell 6 ("Sunday came back EMPTY") is declared `paidBy: 'finding 1b'`, but Bible
`:81` says "sunday rest **or** recovery" and the resolver's early return already
emits a **typed rest day**. The cell fails only because a rest day contributes no
name to the suite's `componentsOf` (which reads `workout.name` + attached
activity names). So the real question is whether Sunday must be an OFFERED
RECOVERY or may be typed REST — a copy/surface question, not a conditioning one.

**Recommend splitting cell 6 out of 1b.** Building it into the flush offer would
be building the wrong thing, and Sam's flush ruling says nothing about Sunday.

## Question for Sam

Approve the "declare, then place" ownership above (question 4/5), and rule on
cell 6: **is an in-season Sunday required to OFFER recovery, or is a typed rest
day conformant with `:81`?**
