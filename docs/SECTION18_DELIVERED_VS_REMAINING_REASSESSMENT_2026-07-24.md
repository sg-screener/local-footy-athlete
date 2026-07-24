# Reassessment — what does a §18 week contract actually govern?

**Status: DRAFT, awaiting review. No code. STOP after this doc** (CLAUDE.md
escalation rule; MASTER_PLAN L9). Includes rider 1's materialisation table.

**Trigger.** Four blocked findings from the Stage 1 and Stage 2a builds, plus one
standing dogfood finding, all of which turn out to be the same question:

- **T4** — a fact reported on Friday rewrites Monday, Tuesday and Thursday.
  Preventing it makes the landing week fail its own reduced contract
  (`maximum_breach`, `reduction_contradiction`).
- **L6 defect (acute symptom of T4)** — the rewrite does not merely mark
  completed sessions "optional", it **empties them**: `cooked_week` turns a Done
  Team Training from `3ex` to `0ex`. A false record of what the athlete did. Live
  on `main`. Recorded here as T4's symptom; **its fix rides T4, no separate
  patch.**
- **I3 / I4 (lower_body, back_midline, ≥6/10)** — still unrecordable, because
  freeing anchor participation contradicts a contract that authorises sprint ≤ 0.
- **I6** — an injury is now recorded but the week is never re-authored, so the
  athlete still sees the session they cannot do.
- **E6** (`docs/DOGFOOD_FINDINGS_2026-07-23.md`) — on a Thursday signup the app
  asks about Monday–Wednesday sessions the athlete could never have done, and
  counts them missed.

They look like five bugs in four subsystems. They are one question:

> **What does a §18 week contract govern — everything that happens in a calendar
> week, or what the app is prescribing?**

Today the answer is the former, uniformly and implicitly, and every finding above
is a place where that is false.

**Sam's ruling (settled, not reopened here).** The contract gains a concept of
**delivered vs remaining** exposure:

1. completed days count toward the week's requirements **as history**;
2. evaluation and any fact-driven adjustment apply to the **remainder only**;
3. **history is immutable.**

This document works out the ownership and the materialisation boundary that
ruling implies. It does not re-litigate the semantics.

---

## 1. Evidence

All executable, from the Stage 1 / Stage 2a builds on `spent-week-friday` (today
Friday 2026-07-24, MON/TUE/THU Done). Full detail in
`docs/STAGE1_DURABLE_FACT_HORIZON_REPORT_2026-07-24.md` and
`docs/STAGE2A_INJURY_AUTHORITY_REPORT_2026-07-24.md`.

**1a. The spent week cannot satisfy a reduced contract.** Preserve the three Done
days and commit a severe illness:

```
Accepted-state ledger mismatch for 2026-07-20:
  re-evaluation produced blockers maximum_breach, reduction_contradiction
```

Both findings are *correct*. The week really does contain more work than the
illness policy permits. It contains it because the athlete already did it.
Isolated: with preservation on, T1/T2/T3 fail at the commit; with it off, only T4
fails. The blocker is the preservation, not the horizon work.

**1b. §18 has no vocabulary for it.** Grepped across
`section18EffectiveWeekEvaluator.ts` and `weeklyExposureContractV2.ts`: no
`spent`, `elapsed`, `completed` or `delivered`; no `Section18ReductionScope` for a
partial week; `Section18AuthorisedReduction` expresses only *"we permit less"*.
`generateProgramLocally` has no pinned-days input, so the generator cannot author
a week whose first days are fixed.

**1c. The same conflation on a second axis.** `sprint_high_speed_frequency`
counts app-prescribed sprint work **and** the athlete's own team-training and game
exposure in one number. So "the app prescribes none, the athlete's own stays
theirs" is inexpressible — which is why freeing anchor participation for a
lower-body injury produced `reduction_contradiction` (authorised 0, actual 3), and
why four successive attempts to decouple it each moved the failure elsewhere,
including a real safety regression (the finaliser stopping stripping speed blocks
for an 8/10 knee).

**1d. The injury path re-authors nothing.** In every Stage 2a run the candidate
week is byte-identical to the healthy week. The injury path validates the
existing base against a stricter contract; no owner regenerates content.

---

## 2. The seven questions

### Q1 — Current source of truth?

The authored accepted week (composition base + overlays), with mode, loads and
contract **baked at authoring**; resolvers are pure projection. That law is
settled and this document keeps it.

What is *not* owned: the contract has no notion of *when* within the week it
applies. It is stamped once for a calendar week and evaluated against every day
in it, including days that elapsed before it existed.

### Q2 — How many representations of "what this week requires"?

Three, and they are not reconciled:

1. the contract's `requiredMinimum` / `permittedMaximum` / authorised reductions —
   whole-week, timeless;
2. the evaluator's ledger, counted from whatever workouts are visible — which
   silently mixes delivered and prescribed;
3. the session-outcome record (`sessionFeedback`, outcome receipts) — the only
   representation that knows a day is *done*, and the evaluator never reads it.

(3) exists and is authoritative, and (1) and (2) are blind to it.

### Q3 — Where is it reinterpreted?

1. **Contract stamping.** A week mode and its envelope are minted for
   `[weekStart, weekStart+6]` with no start boundary.
2. **Ledger counting.** `buildLedger` counts achieved exposure across all seven
   days without distinguishing delivered from prescribed.
3. **Reduction evaluation.** `reduction_contradiction` compares the authorised
   target against that undifferentiated total.
4. **Anchor credit.** `sprint_high_speed_frequency` merges app-authored and
   athlete-brought exposure (1c).
5. **Materialisation.** The scoped regen regenerates whole weeks, so preserving
   history is not expressible without desynchronising the contract.
6. **Pre-program days.** Nothing distinguishes "before this athlete had a
   program" from "a day they skipped" (E6).

Steps 1–4 are where a true week becomes an inadmissible one.

### Q4 — Which layer should own it?

**One principle, replacing five special cases:**

> §18 governs **what the app prescribes for the remainder of the week**.
> Everything else — days already delivered, exposure the athlete brings from
> their own team and game commitments, days before the program existed — is
> **history**: it counts toward the week's requirements and is never governed,
> never re-prescribed, never rewritten.

Concretely:

- **The contract owns a remainder boundary.** One field, e.g.
  `governedFromISO`. Before it: history. From it: prescription. It is set at
  authoring time by whoever authors the week.
- **The ledger owns the split.** `delivered` versus `prescribed`, each counted
  separately, from the session-outcome record — the representation that already
  knows.
- **The evaluator applies them asymmetrically.** *Minimums* are satisfied by
  `delivered + prescribed` (history counts — the athlete did the work).
  *Maximums and authorised reductions* apply to `prescribed` only (the app cannot
  un-prescribe the past).
- **Anchor exposure is athlete-brought, not app-prescribed** — the same
  asymmetry on the second axis. It counts toward minimums; it is not subject to
  the app's own reductions.
- **History is immutable by construction**, not by convention: no authoring owner
  may write a workout for a date before `governedFromISO`.

Every blocked finding falls out of that one principle:

| Finding | Resolution |
|---|---|
| T4 + the L6 empties-Done defect | preserved days are history; the reduced contract governs Fri/Sat/Sun only, so no `maximum_breach` / `reduction_contradiction` |
| E6 | `governedFromISO = signup date`; earlier days display for context, exempt from accounting |
| I3 / I4 lower-body, back | anchor exposure counts toward minimums but is not reducible by the app; the sprint reduction governs prescribed work only |
| I6 | the injury path gains the materialisation owner in §3 |

### Q5 — Simpler architecture (two options, per the Elegant Solution Requirement)

**Option A — incremental.** Special-case the spent week in the scoped regen; add
a "delivered" exemption to `reduction_contradiction`; add a signup-date filter to
the catch-up prompt; add a lower-body exception to the sprint reduction.

Four unrelated guards in four subsystems, none of which makes the next case
easier, and each of which is a place the two representations can drift again.
This is the "just add a guard" / "special-case this route" move the stop-patching
trigger names, four times over.

**Option B — one boundary, one asymmetry. Recommended.** Add `governedFromISO` to
the contract and a `delivered` / `prescribed` split to the ledger; apply minimums
to the sum and maximums/reductions to `prescribed`. This *removes* representation
(2)'s ambiguity by making it read (3), and replaces four special cases with one
rule. It also makes `sprint_high_speed_frequency`'s conflation expressible rather
than needing a fifth workaround.

Cost is honest: it touches the evaluator's ledger, the contract type, and every
authoring owner (each must stamp the boundary). It is a §18 change, which is why
it is a reassessment and not a patch.

### Q6 — Legacy paths to retire

- **The whole-calendar-week contract assumption.** Not a module — an implicit
  invariant threaded through the evaluator. Replaced by `governedFromISO`.
- **Reassessment B2 ("the projection reads facts") is WITHDRAWN.** It contradicts
  the settled bake-at-authoring law and would reintroduce read-time whole-week
  derivation. Stage 1 shipped the baking alternative (multi-week authoring +
  cascade) and it works; B2 should not be revived.
- **`prohibitedSprintHighSpeed` as a total-ceiling forcer**
  (`weeklyExposureContractV2.ts:455`). Keep its real meaning — "the app must not
  prescribe high-speed content", which the finaliser correctly acts on — and stop
  it also asserting the athlete's own exposure is zero.
- **Do NOT retire** the scoped-regen authoring commit, the `sourceFactId`
  cascade, `preserveExactAcceptedWorkouts`, or `durableFactHorizon`. All are
  load-bearing and Stage 1 proved them.

### Q7 — Tests proving the boundary

- **H1** — T4, green: a fact reported Friday leaves Monday/Tuesday/Thursday
  byte-identical, Done or not, and the commit succeeds.
- **H2** — the delivered work counts: the spent week's minimums are satisfied by
  `delivered + prescribed`, not by prescribed alone.
- **H3** — the reduction applies to the remainder: a severe illness on a spent
  week authorises reductions that the delivered days do not contradict.
- **H4** — history is immutable: a static invariant that no authoring owner
  writes a workout for a date before `governedFromISO`.
- **H5** — E6: with `governedFromISO` at the signup date, pre-signup sessions
  display but are never counted missed or skipped.
- **H6** — I6: an upper-body 8-10/10 re-authors the remainder with no push/pull.
- **H7** — I3/I4: lower-body and back injuries at 7 and 9 are recorded, with
  anchor exposure counting toward minimums and app sprint prescribed at zero.
- **H8** — the L6 symptom: a Done session's exercise count is never reduced by
  any fact commit (the acute check, riding H1).
- **H9** — no dual path: the static materialisation invariant from §3.

---

## 3. Rider 1 — the materialisation table

**One owner per effect per week class.** Columns are week classes *relative to the
report*; cells name the single owner permitted to write workouts there.

| Effect | Delivered / pre-program days | Remainder of the landing week | Later authored weeks | Beyond the program horizon |
|---|---|---|---|---|
| Severe illness (`illness_recovery` mode) | **no owner** (history) | scoped-regen authoring commit | scoped-regen authoring commit | generation, at creation |
| Cooked fatigue / repeated poor sleep | **no owner** (history) | scoped-regen authoring commit | scoped-regen authoring commit | generation |
| Injury restriction | **no owner** (history) | ⚠️ **NONE TODAY (I6)** → scoped-regen | ⚠️ **NONE TODAY** → scoped-regen | generation |
| Equipment / schedule / time cap | **no owner** (history) | projection at resolve | projection at resolve | generation |
| Athlete edits (move/bin/swap/add) | **no owner** (history) | §18 accepted-state transaction owner | n/a | n/a |
| Profile / block change | **no owner** (history) | `weekRebuild:block` → `commitRebuiltProgram` | `weekRebuild:block` | generation |
| Fixture change | **no owner** (history) | fixture replan | fixture replan | generation |

Two things the table makes visible that prose did not:

1. **The first column is empty by design.** That is the ruling — history is
   immutable — expressed as an ownership fact rather than a guard. H4 is the
   static invariant that proves it.
2. **The injury row is the only one missing an owner.** That is I6 and rider 0's
   divergence 3, and the table says exactly what it should be: the same
   scoped-regen authoring commit the deriving facts already use. Injury is not a
   special case; it was simply never given the owner its siblings have.

**Reconciliation with bake-at-authoring.** Every owner in the table *bakes*: it
authors workouts and a contract into accepted state. No cell is served by
read-time derivation, and resolvers stay pure projection. The table is therefore
consistent with the settled law, and B2's "projection reads facts" is the one
proposal that would have violated it (Q6).

**The static invariant (H9).** For each (effect, week class) cell, exactly one
module may write workouts; no module outside the named owner may write for that
cell; and no module may write into the first column at all. Enforceable the way
T5 is — a source-level ownership scan — which has already proven it catches real
defects rather than merely documenting intent.

---

## 4. What this document does not propose

- No change to Bible coaching semantics (L7 — Sam's gate).
- No new resolver, guard, fallback, regex or compatibility branch.
- No change to Stage 2b's ask-flow design, which is separate and unstarted.
- No revival of B2.

---

## NOT COVERED (Process Law L2)

- **No device pass, no code, no gate suite run.** This document changes nothing.
  L4 stands.
- **No implementation estimate**, and no sequencing against Stage 2b. Which of
  the two runs first is not proposed here.
- **`governedFromISO` is a shape, not a design.** Its persistence, migration of
  existing contracts, hydration behaviour, and interaction with
  `acceptedCompositionBase` are unexamined.
- **The delivered/prescribed split is specified for frequency metrics only.**
  Whether `session_intensity_percent`, `session_volume`, `full_rest_frequency`
  and `power_primer_budget` split the same way is not worked out; `full_rest` in
  particular may not.
- **Anchor exposure as "athlete-brought" is asserted, not modelled.** How it
  interacts with explicit `modified` participation — which Stage 2b's answers
  will produce, and which today withdraws credit with no matching reduction (the
  gap `section18SafetyBoundaryTests` M3 depends on) — is unresolved.
- **E6 is folded in by argument, not by measurement.** No probe was run against a
  mid-week signup, and the catch-up prompt's own accounting path was not read.
- **Rider 2 (season/block boundaries) and rider 3 (diff-derived disclosure)
  remain owed and are untouched here.**
- **The materialisation table is asserted from code reading**, not verified by
  execution. Cells other than the illness/fatigue and injury rows were not probed
  in this unit, and the equipment/schedule "projection at resolve" row is
  described in the code as projection-delivered but was never measured against a
  spent week.

---
---

# Addendum B (2026-07-24) — Phase 1 shipped; the blocker moved to generation

Recorded from the implementation. Approved and stopped at this point; the branch
parks here.

## B1. Phase 1 is built and green

`governedFromISO` on the contract, `Section18ExposureSplit`
(delivered / prescribed / appPrescribed) in the evaluator ledger, and the
asymmetry exactly as ruled, including Sam's maximum rider:

- **minimums** — satisfied by `delivered + prescribed`;
- **maximums** — bind the TOTAL week, enforced by capping the prescribed
  remainder at `max(0, maximum − delivered)`. Never a contradiction raised over
  history; never a fresh full allowance on top of delivered work;
- **authorised reductions** — measured against APP-AUTHORED prescribed exposure
  only, via `metricGovernedActual`.

Suite `test:section18-delivered-remaining` (D1–D6), wired into `test:bible`.
Whole gate sweep green.

## B2. THE BLOCKER MOVED: §18 is closed, generation is now the constraint

**This is the finding this addendum exists to record.**

With the boundary built, re-enabling T4's history preservation made **severe
illness and cooked green** — Done days byte-identical, commit accepted. The
milder readiness tiers broke: `required_minimum_shortfall` for poor sleep, plus
two `acceptedStateTransactionTests` regressions.

The cause is no longer a §18 concept gap. §18 now has the vocabulary. Two things
at a different layer remain:

1. **`generateProgramLocally` authors WHOLE weeks.** The scoped regen generates a
   full week and then discards the pre-boundary days, so it can discard the very
   sessions that satisfied the week's remaining minimums. **The remainder must be
   authored AS a remainder** — generation needs the boundary, rather than having
   it applied to its output afterwards.

2. **A readiness demotion withdraws credit from anchors the athlete has ALREADY
   COMPLETED.** Participation is a statement about what the athlete *will* do; it
   must not retroactively decide that Tuesday's finished team training produced
   nothing. That is a contradiction raised over history, which §4's ruling
   forbids.

Both must move together. Attempting (2) alone — delivered anchors keep their
credit, plus a `strength_pattern_count` history split — regressed **every**
scenario, because a pattern the athlete already trained then contradicted a
reduction authored later. Three attempts, no recovery; reverted per the
stop-patching rule rather than a fourth.

## B3. Quarantine state

`test:fact-horizon` T4 (×3) and `test:injury-authority` I3/I4 (lower-body and
back ≥6/10) and I6 stay **RED and quarantined**, out of `test:bible`, with B2 as
the reason. They are pinned, not hidden: each names exactly which fact kind,
region and severity the app still cannot handle. `firstShapedDateInWeek(fact,
weekStart)` is the boundary the fix will stamp, and the quarantine point in
`temporarySourceFactTransaction.ts` carries the same note in code.

## NOT COVERED by this addendum (L2)

- **Phases 2–6 are not built.** E6, rider 2 (season/block boundaries), rider 3
  (diff-derived disclosure) and the materialisation row for injury are untouched.
- **No simulator pass was run and nothing was merged.** The dual-seed merge gate
  has not been attempted; L4 stands.
- **"Author the remainder as a remainder" is a direction, not a design.** No
  generation-side API, no decision on whether the boundary is an input to
  `generateProgramLocally` or a new caller, and no estimate.
