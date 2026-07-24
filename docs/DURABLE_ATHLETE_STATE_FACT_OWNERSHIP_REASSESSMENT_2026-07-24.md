# Reassessment — who owns the effect window and authority of a durable athlete-state fact?

**Status: APPROVED (Option B) with four review riders, then AMENDED.** Rider 0
was executed before any code and its evidence **contradicted §1c of this
document**. See **Addendum A (2026-07-24)** at the end, which corrects the A3b
mechanism, widens its scope, eliminates one proposed retirement, restates B4,
adds a fourth divergence, and records Sam's D10 ruling. **Read Addendum A before
acting on §1c, Q3 step 5, Q5/B4, Q6 or Q7's T6-T10** — the addendum supersedes
them where they conflict.

**Trigger.** Two L10 device findings from 2026-07-24, diagnosed in
`docs/investigations/L10_DEVICE_FINDINGS_A1_A6_DIAGNOSIS_2026-07-24.md`:

- **A3a** — a severe illness reported on Friday does not shape next week. Three
  representations bound its duration and the first silently truncates the others.
- **A3b** — an upper-body 8/10 injury is rejected by the §18 minimums gate and
  rolled back, recording no fact, no episode, no `activeInjury`.

They look like different bugs. They are the same question asked twice:

> **When an athlete tells the app something durable about their body, which
> layer owns how long that is true, and which layer owns whether the program
> must yield to it?**

Today the answer is "several layers, none of them decisively". A3a is what
happens when the duration answer is fragmented; A3b is what happens when the
authority answer is fragmented.

**Explicitly out of scope: coaching design.** The Bible's injury severity bands
are settled and are not being reopened. This document is about which layer
consumes them as typed authorised reductions instead of a gate silently rolling
the fact back.

---

## 0. The settled semantics this must serve

From `docs/LFA_PROGRAMMING_BIBLE.md`, per body area (shoulder at :2131-2134,
groin/adductor at :1937-1940, and the same shape at :2007, :2070, :2202, :2268,
:2329, :2392, :2456):

- 1-3/10 — keep safe work, swap the painful movement
- 4-5/10 — reduce volume/load on the affected pattern
- 6-7/10 — recommend advice, avoid the painful pattern; remove sprint/COD
- **8-10/10 — pause affected work and recommend physio/medical advice**
- and the recovery direction: "8-10 -> 6-7: move from paused affected work to
  cautious alternatives" (:2466)

The load-bearing word is **affected**. The Bible never says "pause all
training". For an upper-body 8/10 the intended week is: no pressing/pulling,
**but lower-body strength, conditioning and running all remain**. Such a week
comfortably clears the §18 minimums. Nothing in the programming model requires
the outcome we observe.

This matters for scoping the fix: we are not being asked to invent a policy for
severe injury. We are being asked to make an existing, written policy reach the
layer that decides whether a week is admissible.

---

## 1. Evidence

All figures below are executable output against the `spent-week-friday`
canonical seed (today Friday 2026-07-24, week starting Monday 2026-07-20,
MON/TUE/THU Done). Probes are session scratch; each is reproducible by
re-running the same calls. **Re-seed in a fresh process** — re-seeding twice in
one process trips the known epoch-0 `accepted_state_rollback_mismatch` artifact.

### 1a. Illness — the duration fragmentation (A3a)

```
action  set_illness_status  scope=current_week
        payload={date: 2026-07-20, todayISO: 2026-07-24, severity: severe}
result  ok=true  changedProgram=true
        "Rest up — nothing's required this week…"

fact    illness / status=active / severity=severe
        effectiveFrom=2026-07-20   effectiveUntil=2026-07-26

deriveIllnessRecoveryWeekMode(2026-07-20) → true
deriveIllnessRecoveryWeekMode(2026-07-27) → false

this week   in_season_game_week → illness_recovery      (correct; the 0.2 fix works)
next week   in_season_game_week → in_season_game_week   (byte-identical)
overlays    ["2026-07-20"]
```

Three places bound the duration, and they are not the same place:

| # | Representation | Where | Value |
|---|---|---|---|
| 1 | the fact's own window | `temporarySourceFact.ts:912-915` via `weekReadinessActions.ts:55` → `programControlActions.ts:1217` | `Mon..Sun` of the report week |
| 2 | the mode's overlap test | `illnessRecoveryWeekMode.ts:33-34` | `effectiveUntil >= weekStart` |
| 3 | the authored overlay's key set | `temporarySourceFactTransaction.ts:527,571-579` | exactly one week |

(1) truncates (2) and (3) without either of them being wrong. `status` stays
`'active'` while the fact expires by calendar, so **"active until cleared" is
not expressible in the current type** — an open-ended window has no
representation.

### 1b. The sibling check — confirmed, and it found more than expected

Run for `cooked_week` and `poor_sleep_week` in fresh processes. Both share A3a's
mechanism, as predicted:

| tier | fact window | mode derived | next week | overlays |
|---|---|---|---|---|
| `sick_week` | 07-20 → 07-26 | `illness_recovery` this / none next | unchanged | `["2026-07-20"]` |
| `cooked_week` | 07-20 → 07-26 | none (by design) | unchanged | `["2026-07-20"]` |
| `poor_sleep_week` | 07-20 → 07-26 | none (by design) | unchanged | `["2026-07-20"]` |

**A3a is week-scope-wide, not illness-specific.** Any fix must be posed at the
fact level, not inside `deriveIllnessRecoveryWeekMode`.

Two findings the sibling check surfaced that were **not** predicted, both new:

**(i) The effect window is back-dated over completed days.** Reported on
**Friday**, the illness week rewrites **Monday, Tuesday and Thursday** — all
three already committed Done through the real session-outcome transaction:

```
after marking MON/TUE/THU Done:
  20:Strength/core  21:Team Training/core  22:Rest/-  23:Team Training/core  …
after reporting Properly sick:
  20:Mixed/optional 21:Team Training/optional 22:Rest/- 23:Team Training/optional  24:Rest/-  …
```

Done-ness provides no protection. So the fragmentation is not only at the
**end** of the window (truncated to Sunday) but at the **start** (back-dated to
Monday, over sessions that already happened). Marking a completed session
"optional" is meaningless at best and erodes the athlete's record at worst.
`poor_sleep_week` does the same thing, rewriting the Done Monday from
`Strength/core` to `Mixed/core`.

**(ii) `cooked_week` produced no visible change at all this week** while
reporting `changedProgram: true` and *"The report is active and the visible
program was safely recomposed."* An overlay was authored for `2026-07-20`, but
the resulting week is byte-identical to the base. On a Friday there is almost
nothing left to reduce — which is the correct outcome, reported dishonestly.

**Caveat: this does not contradict Sam's device confirmation that cooked
"works".** Sam tested from a different point in the week. The finding is
specifically that *on a spent week* cooked claims a recomposition it did not
perform. It is logged here as an observation for the review, **not** as a
diagnosed finding — it has not been traced.

### 1c. Injury — the authority fragmentation (A3b)

Fresh install, then the exact action `handleApplyGuidedInjury` commits
(`useHomeScreen.ts:1569-1581`) for an upper-body 8/10:

```
[coach-mutation-transaction] candidate rejected and rolled back
  error: 'Section 18 final-week rejection
          (required_minimum_shortfall:conditioning:0
          |required_minimum_shortfall:main_strength:1
          |required_minimum_shortfall:sprint_high_speed:0)'
  candidatePersisted: false

result          ok=false  changedProgram=false
                "The injury command was not applied because the accepted
                 program could not be verified."
activeInjury    null
injuryEpisodes  0
overlays        []
this / next week  byte-identical
```

The fact and the week are committed in **one** transaction, so a week the gate
dislikes takes the fact down with it. The athlete's statement about their own
body is discarded because the program derived from it was inadmissible.

There is a plausible contributing path in the constraint builder that the
reassessment should confirm or eliminate:
`trainingPaused = injurySeverityPausesAffectedTraining(severity) || seriousSymptoms`
(`guidedInjuryControl.ts:207`), and then `safeFocusFor(region, serious=true)`
(`:181-188`) returns `['Stop affected training', 'Seek medical or physio advice']`
— **dropping the region-scoped safe-work list** (`['Lower body training where
suitable', 'Easy conditioning', 'Unaffected core work']`) that the non-serious
branch returns for an upper-body injury. If the Bible's "pause **affected**
work, keep safe work" is flattened to "stop training" at this layer, the
downstream week cannot satisfy minimums and the gate is behaving correctly on
bad input.

**Not established** — flagged as the first thing the reassessment must settle,
not assumed: whether the `injury_restriction` authorised reductions
(`section18SafetyPolicy.ts:206-231`) were present in the contract at evaluation
time. If they were, the gate ignored an authorised reduction. If they were not,
the authority never reached the gate at all. These are different fixes.

**Correction to the standing record.** `docs/audits/DEAD_AFFORDANCE_INVENTORY_2026-07-23.md`
item 3 diagnoses F6 as "a real, persisted mutation that just never triggers a
re-render", with `requiresRebuild:false` as the cause. That does not hold for
the paused band on this seed: `requiresRebuild:false` is real but downstream of
a transaction that never commits. **Also not established:** whether a moderate
(severity 5, non-paused) injury persists — that probe run was masked by the
epoch-0 artifact and must be re-run in a fresh process before anyone concludes
the whole injury path is broken rather than only the paused band.

---

## 2. The seven questions

### Q1 — What is the current source of truth?

Nominally `acceptedMaterialContext.temporarySourceFacts` plus
`acceptedCompositionBase`, published through the accepted-state transaction.
That holds for *content*.

For the two properties in question it does not hold:

- **Duration** is owned by whatever `temporaryFactScope()` stamped at creation
  time. It is a value frozen from the reporting surface's `scope` string
  (`'current_week'` / `'today_only'`), not a property the fact or any owner can
  re-evaluate. `status: 'active'` and `effectiveUntil` can disagree and nothing
  reconciles them.
- **Authority** is owned by the §18 evaluator via the transaction's
  all-or-nothing verify. The fact has no standing of its own: it exists only if
  a week derived from it passes.

So the truthful answer is that the fact store owns *what was reported*, and two
other layers own *how long it counts* and *whether it counts at all* — which is
most of what "a durable fact" means.

### Q2 — How many representations of the user request exist?

For "I am properly sick" (A3a), **four**:

1. the `ProgramControlAction`'s `scope: 'current_week'` string
2. the fact's `effectiveFrom`/`effectiveUntil` window
3. the week-mode derivation's overlap predicate
4. the authored `weekScopedOverlays` key set

Plus a fifth for the visible surface: the projection
(`buildProgramTabProjectedWeek` over `useScheduleState()`) carries
`activeConstraints` and `activeInjury` but **not** `temporarySourceFacts`
(`useSchedule.ts:173-191`). A future week can therefore only ever be shaped by
a fact if something pre-authored an overlay for it, which nothing does.

For "my shoulder is 8/10" (A3b), **three**: the `ActiveInjuryConstraint`, the
derived `InjuryEpisodeV1`, and the `Section18AuthorisedReduction[]` the safety
policy may or may not have authored — with the §18 evaluator holding a veto over
all three.

### Q3 — Where can intent, domain, date, target, or scope be reinterpreted?

Ordered by distance from the athlete's statement:

1. **Reporting surface → action.** The tier picks a `scope` string. "Properly
   sick" becomes `'current_week'` here, and this is the only place duration is
   ever decided. It is decided by a UI tier constant.
2. **Action → fact.** `temporaryFactScope({kind:'week'})` expands that to
   `mondayFor(anchor) .. +6`. **Both bounds are invented here**: the end is
   truncated to Sunday, and the start is back-dated to Monday over days that
   have already happened (evidence 1b(i)).
3. **Fact → mode.** The overlap test reads the invented window as though it were
   clinical fact.
4. **Fact → authored week.** `mondayFor(todayISO)` picks exactly one week.
5. **Constraint → safety policy.** Region-scoped Bible semantics may be
   flattened to a whole-week pause (`safeFocusFor` serious branch).
6. **Candidate week → gate.** The evaluator can reject, and rejection destroys
   the fact rather than the week.

Steps 2, 5 and 6 are where the athlete's meaning is changed, not merely
transported.

### Q4 — Which layer should own the decision?

Proposed answer, for review:

- **The fact owns its own effect window**, expressed as a horizon rather than a
  calendar window — an explicit start (`from now`, not from Monday) and an
  explicit end that can be *open* ("until cleared"). Every consumer reads that
  one window. `deriveIllnessRecoveryWeekMode`'s overlap test becomes correct by
  construction because there is nothing left to disagree with.
- **The fact owns its authority.** Recording that the athlete is sick or hurt is
  not conditional on producing an admissible week. The fact commits; the week is
  derived from it. If the derived week cannot satisfy §18, that is a fact about
  the *week*, to be surfaced honestly — never a reason to forget what the
  athlete said.
- **§18 keeps its veto over programs, and loses it over facts.** The gate's job
  is "is this week safe and admissible", which is exactly right for a week. It
  should never be the thing that decides whether the app remembers an injury.
- **The Bible's severity bands are consumed once**, at the point that translates
  a fact into typed `Section18AuthorisedReduction[]` with `reason:
  'injury_restriction'`, region-scoped. The gate then evaluates a week it has
  already been told is legitimately reduced.

### Q5 — What simpler architecture would remove representations instead of adding more guards?

Per the Elegant Solution Requirement, two options compared.

**Option A — incremental, inside the current system.** Widen the illness fact's
scope to a multi-week window; loop the scoped-regen commit across the weeks it
covers; add a rebuild trigger on the injury path; special-case the minimums gate
for `pauseAffectedTraining`.

Removes nothing. It leaves all four duration representations in place and adds
synchronisation between them, plus a fifth rule (which weeks to loop). It also
does not answer "until cleared" — a wider window is still a fixed window. The
`8/10 → rejected` case would be fixed by a gate exception, which is the
"just add a guard" move the stop-patching trigger names.

**Option B — the fact owns its horizon and its authority.**

1. **One duration representation.** Replace the frozen `effectiveFrom/Until`
   pair for durable state facts with a horizon: `startsFrom` (the report
   instant, never back-dated over completed days) and an end that is either a
   date or the explicit sentinel "open — until resolved". `status: 'active'`
   and the window can no longer disagree because the window *is* derived from
   status. Representations 2, 3 and 4 from Q2 collapse into reads of one value.
2. **Projection reads facts.** Give the visible-week projection the fact store,
   so any week — this one, next one, week 3 — derives its mode from the same
   horizon. This deletes the "pre-author an overlay per affected week" problem
   rather than scaling it: overlays go back to meaning *authored edits*, not
   *the only way a fact can reach a week*.
3. **Split the transaction.** Commit the fact first and unconditionally; derive
   and gate the week second. A §18 rejection then downgrades the *week* (and
   says so), leaving the fact recorded. This is the change that fixes A3b at the
   root and removes the gate's accidental veto over athlete state.
4. **Bands in, typed reductions out.** One consumer of the Bible severity bands,
   emitting region-scoped `Section18AuthorisedReduction[]`. An upper-body 8/10
   authorises removal of push/pull and nothing else; squat/hinge, conditioning
   and running remain, so the week clears minimums *without* a gate exception.

Option B removes three of the four duration representations and removes the
gate's authority over facts entirely. Recommended, subject to review.

### Q6 — Which legacy paths should be bypassed or retired rather than patched?

- **`temporaryFactScope({kind:'week'})` for durable state facts.** It is the
  origin of both the truncation and the back-dating. Keep it for genuinely
  week-shaped things; retire it as the duration source for illness/injury.
- **`scopedRegenWeekStart = mondayFor(todayISO)` as the sole materialisation.**
  If the projection reads facts (B2), the single-week overlay stops being the
  only path to a reduced week and becomes an optimisation.
- **The `safeFocusFor(region, serious)` collapse.** The serious branch discards
  region scoping the Bible explicitly preserves. Retire the branch, not patch
  its output.
- **The `activeConstraints`/`activeInjury` mirror as a projection input.** Q2's
  fifth representation exists only because the projection reads mirrors instead
  of facts. This is the same residual class already tracked in the §18 ownership
  migration and the same one that makes A5's Profile clear ineffective — worth
  sequencing together.
- **Do NOT retire** `illness_recovery` as a mode, the scoped-regen authoring
  commit, or the `sourceFactId` cascade. See prior art.

### Q7 — What tests prove the new ownership boundary?

Written against `spent-week-friday`, which is where all of this was observed.

**Duration ownership**

- T1 — a severe illness reported Friday derives `illness_recovery` for **next**
  week's Monday and every week until it is cleared. The current code returns
  false; this is the A3a red test.
- T2 — the same holds for `cooked_week` and `poor_sleep_week` reductions
  (sibling invariant — pins the fix at the fact level, so a fix that only
  touches `deriveIllnessRecoveryWeekMode` fails).
- T3 — clearing the fact restores every week it reached, through the existing
  `sourceFactId` cascade, with no residue.
- T4 — **no retroactive rewrite**: a fact reported Friday leaves Monday,
  Tuesday and Thursday byte-identical, whether or not they are Done. Currently
  red (evidence 1b(i)).
- T5 — there is exactly one duration representation: a static invariant that
  no consumer computes an effect window from anything but the fact's horizon.

**Authority ownership**

- T6 — an upper-body 8/10 commits the fact, the episode and `activeInjury`
  **unconditionally**. Currently red (A3b).
- T7 — the derived week for that injury contains no push/pull and **still
  satisfies** §18 main-strength minimums via squat/hinge, with no gate
  exception — i.e. the Bible's region scoping survives to the contract.
- T8 — if a derived week genuinely cannot satisfy §18, the fact survives and the
  athlete is told what the app could not do. Nothing is silently rolled back.
- T9 — severity 5 and severity 8 both persist, differing only in the typed
  reductions they authorise (closes the unestablished moderate-band question).
- T10 — the §18 gate has no code path that can delete or fail a source fact:
  a static invariant on the transaction boundary.

---

## 3. Prior art to reuse, not re-derive

- **`illness_recovery` as a first-class §18 week mode** — the proof that a fact
  can legitimately lift minimums instead of fighting them. `policyFor` lifts
  minimums while `buildSafetyPolicy` keeps the recovery-tier envelope
  (`weeklyExposureContractV2.ts:440-441`, `:692-703`). **This is the template
  for injury**, and it is why "give injury a mode / a typed authorised
  reduction" is a smaller change than it looks.
- **`Section18AuthorisedReduction`** (`weeklyExposureContractV2.ts:151-165`) —
  the typed vocabulary already exists, and
  `WeeklyExposureReductionReason` already includes `'injury_restriction'` and
  `'full_pause'` (`weeklyExposureContract.ts:31-44`). `refreshSection18SafetyPolicy`
  already authors region-scoped `injury_restriction` reductions from prohibited
  patterns (`section18SafetyPolicy.ts:206-231`). **Nothing new needs
  inventing** — the question is why that authority did not reach the gate in the
  A3b run (Q3 step 5/6).
- **Scoped-regen authoring commit** (`commitDerivingSourceFactScopedRegen`) —
  the mechanism that makes a fact re-author a week rather than no-op. Keep;
  generalise its week selection.
- **`sourceFactId`-linked reversible adjustments and the cascade undo** — typed
  ownership where undo is stored prior state, never re-derivation
  (`temporarySourceFactTransaction.ts:531-545`). This already solves the
  hardest part of multi-week reach: clean reversal. Extending the horizon must
  extend the cascade, and T3 is what proves it.
- **The base-preserving seam** (`preserveExactAcceptedWorkouts`) and the
  `inertComposition` path — the existing precedent for "commit a fact without
  re-canonicalising the base", which is most of the shape B3 needs.

---

## 4. What this document does not propose

- No change to the Bible's severity bands or to any coaching semantics (L7 —
  Sam's gate; nothing here asks for it).
- No new resolver, guard, fallback, regex, compatibility branch or finaliser
  patch (CLAUDE.md stop-patching trigger).
- No change to the contained findings A2/A4/A6, or A5 pending Sam's ruling.
  Those are a **separate small fix unit after this review** and are deliberately
  not folded in. A6 is adjacent to the move/edit pipeline and should land after
  this reassessment is settled.

---

## NOT COVERED (Process Law L2)

- **No device pass, no simulator run.** Every figure is from direct calls into
  the real store/transaction/projection code on one seed. L4 still applies:
  the device is the arbiter, and nothing here has been seen on a phone.
- **The A3b mechanism is diagnosed to the transaction boundary, not through it.**
  Whether the `injury_restriction` authorised reductions were present at
  evaluation time is **not established** (Q3 step 5/6) and is the first thing
  the review must settle. The `safeFocusFor` collapse is a plausible
  contributing path, traced in source but **not proven** to be the trigger.
- **Severity-5 injury persistence remains unestablished** (epoch-0 artifact).
  T9 exists to close it; do not assume either answer.
- **`cooked_week`'s "recomposed but identical" behaviour is an observation, not
  a diagnosis.** It has not been traced and does not contradict Sam's device
  confirmation, which was from a different point in the week.
- **Only week+1 was probed.** Weeks +2/+3 are untested in every scenario. T1
  says "every week until cleared"; that is a specification, not a measurement.
- **Equipment, schedule and `time_cap` facts were not run against next week.**
  They are described in the code as projection-delivered and may have a
  different shape; they are neither included nor excluded from this reassessment
  by evidence.
- **Season transitions, block rollover and bye weeks** were not considered. An
  open-ended fact horizon crossing a block or phase boundary is unexamined and
  may be the hardest case in Option B.
- **No estimate of implementation size** is offered for either option, and no
  gate suite was run for this document — it changes no code.

---
---

# Addendum A (2026-07-24) — rider 0 executed; §1c corrected; D10 ruled

Full evidence: `docs/investigations/RIDER0_INJURY_AUTHORITY_AT_THE_GATE_2026-07-24.md`.
Probe: `spent-week-friday`, device-exact install, one fresh process per cell,
`evaluateSection18EffectiveWeek` patched to record the contract it was actually
handed. This addendum records only what changed.

## A1. Rider 0's binary was false

§1c posed: either the gate ignored an authorised reduction, or the authority
never reached the gate. **Neither.** The `injury_restriction` reductions were in
the contract at evaluation time and the gate honoured every one of them. They
were **authored incompletely**, by the same owner that withdrew the credit they
were meant to cover.

The gate's fidelity is proven by contrast, not by inspection: for a lower-body
injury `applyGenerationSafetyToSection18Contract` *does* author
`sprint_high_speed_frequency<=0`, and the sprint minimum duly drops to 0 and the
sprint shortfall disappears. Where a reduction is authored, it is applied.

**Mechanism.** Any prohibited main-strength pattern sets `hasFieldRestriction`
(`section18SafetyPolicy.ts:199-204`), demoting **every** anchor to `modified`,
which zeroes `currentProductionClaim.conditioning` and `.sprintHighSpeed`. On
this seed all conditioning (3) and all sprint (3) exposure is anchor credit from
two team trainings and the game — zero app-authored. The same function authors
reductions for `strength_pattern_count`, `main_strength_frequency` and
(lower-body only) `sprint_high_speed_frequency`. It **never** authors a
conditioning reduction, in any branch, for any injury. The contract handed to the
gate therefore asserts both *"these anchors no longer produce conditioning"* and
*"this week requires 3 conditioning exposures"* — unsatisfiable before the gate
runs. One transaction then takes the athlete's injury report down with the week.

## A2. Q3 step 5 / Q6 — the `safeFocusFor` collapse is ELIMINATED

Not the trigger, on two independent grounds:

1. Region scoping survived intact to the contract — `prohibitedPatterns` is
   exactly `["push","pull"]`, `requiredSafe` exactly `["squat","hinge"]`.
   `safeFocus` and `rules` are display copy and reach no contract field.
2. Severity 7 never takes the serious branch (`trainingPaused` is false) and is
   rejected identically.

**Q6's "retire the `safeFocusFor(region, serious)` collapse" is struck** from
scope unless re-justified as a copy fix on its own merits.

## A3. Scope is much wider than §1c and than the L10 diagnosis

The trigger is neither the severity band nor `pauseAffectedTraining`. It is
**any injury that prohibits at least one main-strength pattern** — severity
**≥ 6 in any region** (`weeklyExposureContractBuilders.ts:231-232`), plus
anything with `pauseAffectedTraining`.

| region | severity | commit | fact recorded |
|---|---|---|---|
| upper | 2, 5 | ok | yes |
| upper | **7, 9** | **REJECTED** | **no** |
| lower | 5 | ok | yes |
| lower | **7, 9** | **REJECTED** | **no** |

Severity 5 persists cleanly — the moderate band is fine, closing T9's open
question in the direction the reassessment did not assume. But **the app cannot
record any injury from 6/10 upward**, the 6-7 "limiting" band included. This
widens the F6 correction in
`docs/audits/DEAD_AFFORDANCE_INVENTORY_2026-07-23.md` beyond the paused band.

## A4. Fourth divergence — the injury week has no materialisation owner

Not identified anywhere in the original document. In **every** rejected cell the
candidate week is byte-identical to the healthy week. The injury path validates
the *existing base* against a stricter contract and never regenerates content.
So even with a perfectly consistent contract the shoulder-injured athlete's
Monday pressing session stays on screen: the week would stop *failing* without
ever *changing*.

**B4 alone does not make an injury visible.** The injury path needs a visible
materialisation owner exactly as illness got one
(`commitDerivingSourceFactScopedRegen`). This is rider 1's question arriving
early and it is now in rider 1's scope, not optional.

## A5. What survives, and B4 restated

- **B3 (split the transaction) — confirmed harder than argued.** The fact dies
  with the week in four of seven cells. Unchanged, and still the root fix.
- **B1/B2 (fact owns its horizon; projection reads facts) — untouched.** Nothing
  here revisits A3a; every A3a figure stands.
- **B4 — restated.** Not "the translation from Bible bands to typed reductions
  is missing"; it is *partial*. The correct and stronger statement:
  **withdrawing production credit and authorising the matching typed reduction
  are ONE atomic decision with ONE owner.** No contract may reach the gate
  claiming both "this no longer produces X" and "this week requires X". That is
  a static invariant, and it is what T7/T10 must pin.

## A6. Sam's ruling — D10, ask the athlete

> **Principle.** This is a dialogue between an S&C coach and an athlete. It is
> not rehab — that is the physio's job. The job is to figure out what the
> athlete can and cannot do, and prescribe that.

Do not assume on the athlete's behalf. Ruled in two stages:

**Stage 2a — build now.** Default to region-scoped anchor participation (the
mechanics of option 1). An injury **never silently withdraws** team-training or
game conditioning/sprint credit. Affected-region work pauses per the Bible
bands. Outcome: injuries become recordable at **every** severity.

**Stage 2b — design and build after 2a is green** (same unit if it fits, else
the next). When severity or region genuinely threatens anchor participation
(≥6/10, or region-relevant), the injury flow **asks**:

1. "Can you still train and play?" → if no:
2. "Will you be doing any work on those days?" → if yes:
3. "Want me to prescribe a session that fits?"

Sam's wording above is the base copy. Each answer is a **recorded typed fact**.
Credit withdrawal and the matching typed requirement reduction are **one atomic
authored decision with one owner** (B4 as restated in A5, adopted). Any
prescribed replacement session comes from generation respecting the injury, is
transaction-owned, disclosed, and undoable through the existing cascade.
Materialisation ownership (A4 / rider 1) must be answered in the same design.

**Sequence ruled:** this addendum → Stage 1 (duration ownership, T1-T5) →
Stage 2a. No further approval gate between those steps unless evidence diverges
again, in which case M8 applies as it did here.

## NOT COVERED by this addendum (L2)

- **No device pass and no code.** Same standing as the parent document; L4
  unchanged.
- **One seed, one profile.** `spent-week-friday` carries zero app-authored
  conditioning. A profile that *does* carry app conditioning may clear the
  minimum and mask the defect — untested, and possibly why this survived. The
  on-device failure may therefore be profile-dependent; not established.
- **`back_midline` and `other` regions untested**; expected to behave as lower
  body, not measured.
- **Only the report/create operation was probed.** Injury update, refresh,
  resolve, and severity-lowering recovery (8-10 → 6-7) are untested.
- **Stage 2b is a ruling, not a design.** No copy beyond Sam's base wording, no
  typed-fact shape, no flow states, no undo semantics have been designed.
- **A4 asserts the absence of re-authoring, not what should replace it.** Which
  owner materialises an injury week is rider 1's open question.
