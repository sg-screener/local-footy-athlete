# §18 / Program-Mutation Ownership Reassessment — 2026-07-22

**Status:** architecture reassessment required by `CLAUDE.md` (Coach
Architecture Escalation Rule) and `AGENTS.md`. Design document only — no code
changes are proposed here, and none may be written until this is approved.

**Trigger of record:** `docs/SUPPORTED_ATHLETE_ACTIONS.md` Group 6 already names
the three escalation triggers ("wrong-domain mutation with false Done, silent
load drift, §18 preview-gate refusal of a benign edit"). Two of the three were
reproduced with fresh evidence in the 2026-07-21 audits below. Per the rule, the
same class of coach/program-edit bug has appeared more than twice after prior
"general" fixes, and the semantic layer understands the user correctly while a
**later layer reinterprets, blocks, or silently widens** the request. That is
the exact condition that stops implementation and requires this document.

---

## 1. Trigger & scope

Three reproduced bug classes, spanning **both ingress doors** (the visible tap
menus and the coach chat):

| # | Bug | Evidence | Doors affected |
|---|-----|----------|----------------|
| 1 | **§18 preview-gate refusal** — `section18_week_rejected` refuses Swap and Add that the menu itself offered as legal. 5 reproductions across Swap + Add, "today" and non-today days, empty and occupied destinations. Move and Bin are **not** blocked. | `docs/audits/PROGRAM_2026-07-21.md` rows 1.1, 1.2, 1.3, 1.7×2, 1.8; grouped 41–46 | Tap (observed); coach shares the same gate |
| 2 | **Silent load recalculation** — an untouched exercise's load changes during an unrelated mutation. Back Squat→Step Ups swap silently moved **Deadlift 137.5kg → 140kg** in the same response, persisted. | `docs/audits/WORKOUT_2026-07-21.md` swap row; grouped 33–40 | Tap (observed); "same signature appears through the coach chat path too" |
| 3 | **Bin undisclosed side effects** — binning one session re-injected the removed session **type** onto a different day (Wed, was Rest) and silently emptied a third unrelated day (Fri "Gunshow" → Rest), neither disclosed. | `docs/audits/PROGRAM_2026-07-21.md` row 1.6; grouped 53–55 | Tap (observed); coach uses the same resolver |

The escalation rule forbids adding "another resolver, guard, fallback, regex,
compatibility branch, phrase handler, or finaliser patch" before this
reassessment is approved. The rest of this document answers the seven required
questions, explains the two mechanisms the audits demanded be explained, and
compares an incremental fix against a source-of-truth redesign.

All code references below are `file:line` at `main` around `c61aceb`.

---

## 2. Root cause (the spine)

**The week the athlete sees and taps on is a derived read-model
(`ResolvedDay[]`), recomputed from base inputs on every read *and* every write —
it is never stored.** No representation of "the specific change the user
requested" survives as a **bounded diff** to the layer that owns the week.
Instead, every consuming layer re-derives all seven days from scratch:

- `resolveWeekWithConditioning` (`src/utils/sessionResolver.ts:1060`) re-runs a
  whole-week **strength-progression pass** and re-derives every day's **type**
  from relative game proximity, on every resolution.
- The §18 commit gate (`src/rules/section18AcceptedWeekGateway.ts`) re-resolves
  and re-validates the **whole** week before allowing a write.

All three bugs are corollaries of that one fact:

- Re-derivation re-runs load progression over exercises the user never touched →
  **Bug 2**.
- Re-derivation recomputes each day's type from *relative* fixture proximity, so
  removing one session shifts which days count as G−1/G+1 and which slots are
  "freed" → **Bug 3**.
- The gate validates the entire week, so a legal local edit is rejected for a
  **pre-existing** condition on a *different* day → **Bug 1**.

The scope the UI actually captures — "Today only", "this exercise only" — is
discarded the instant resolution re-derives the week. The system has twelve
representations of a change (§Q2) and **not one of them is "the change as a
bounded delta on the visible week."** That missing representation is the whole
problem.

---

## 3. The seven required questions

### Q1 — What is the current source of truth?

**There isn't a single one. There are three competing notions of "the week," and
they can disagree.**

1. **Persisted accepted state** — `AcceptedMaterialContext`
   (`src/store/acceptedStateColdStart.ts:36`) held in the Zustand program store
   (`src/store/programStore.ts`, `ProgramState:1134`), plus the parallel
   channels `dateOverrides: Record<string, Workout>` (`programStore.ts:1163`),
   `weekScopedOverlays` (`:1181`), `userRemovalConstraints` (`:1184`), and the
   base template `currentProgram`/`currentMicrocycle` (`:1135`). This is what
   survives relaunch.
2. **The derived visible week** — `ResolvedDay[]`
   (`src/utils/sessionResolver.ts:167`), produced on demand by
   `resolveWeekWithConditioning` (`:1060`) and projected by
   `src/utils/visibleProgramReadModel.ts`. **This is the thing the athlete
   actually looks at and taps on, and it is never stored** — it is recomputed
   from (1) on every render.
3. **The §18 gateway's re-resolved week** — `resolveFinalVisibleSection18Week`
   (`src/rules/section18AcceptedWeekGateway.ts:140`) builds its *own* resolution
   of the week to validate at commit time.

Because (2) is a pure function of (1) plus non-trivial derivation logic
(progression, game-proximity typing, conditioning fill), and because that logic
is **not idempotent w.r.t. what the user changed**, (1) and (2) drift apart. The
audits show this directly: after a season-phase shift the week (2) rebuilt but
the phase-status card (1) still read "In-season"
(`docs/audits/HOMEV2_2026-07-21.md` row 5.1); submitted session feedback left no
visible trace (`WORKOUT_2026-07-21.md` row 2.1; `HOMEV2` readiness row 3.1).
**The user acts on (2); the system owns (1); §18 judges (3).** No layer owns "the
visible week" as a stored, authoritative artifact.

### Q2 — How many representations of the user request exist?

**Twelve, none of which is a bounded diff on the visible week.** A single "swap
this session" is re-encoded at least five times between tap and store:

| # | Representation | Where |
|---|----------------|-------|
| 1 | UI step state (`ExerciseEditStep`, `Step`) — ephemeral | `src/screens/home/DayWorkoutScreenV2.tsx:163`, `src/screens/home/PlanChangeSheet.tsx:58` |
| 2 | `ProgramControlAction` — exercise-level tap command | `src/utils/programControlActions.ts:151` |
| 3 | `PlanChange` — day/session-level tap command | `src/utils/planChangeTypes.ts:16` |
| 4 | `CoachIntent` — LLM-classified intent (coach door) | `src/utils/coachIntent.ts:268` |
| 5 | `CoachCommand` — deterministic router command | `src/utils/coachCommandRouter.ts` |
| 6 | `ProgramEdit` / `ProgramEditDraft` — semantic edit | `src/utils/coachProgramEdit.ts` |
| 7 | `CoachRevisionProposal` — registry-backed proposal (shared by both doors) | `src/utils/coachRevisionProposal.ts` |
| 8 | `AdjustmentEvent[]` — engine output before writes | `src/utils/applyAdjustmentEvents.ts` |
| 9 | Accepted-state transaction / reversible-ledger entry | `src/store/acceptedStateTransaction.ts:119` |
| 10 | Manual override `Workout` in `dateOverrides` | `src/store/programStore.ts:1163` |
| 11 | `AcceptedMaterialContext` — persisted accepted truth | `src/store/acceptedStateColdStart.ts:36` |
| 12 | `ResolvedDay` — derived visible projection | `src/utils/sessionResolver.ts:167` |

Both doors deliberately converge in the back half at three leaf writers —
`setManualOverride` (`programStore.ts:1238`), the accepted-state transactions,
and `applyCoachRevisionDateOverrides` (`src/utils/coachRevisionOverrideWriter.ts`)
— which is a genuine strength. But the **front half** keeps two door-specific
command families (tap: 2/3; coach: 4/5/6), and no representation anywhere carries
"the set of days/exercises this change is allowed to touch." Scope is implicit,
so scope leaks (Bugs 2 and 3) and scope is misjudged (Bug 1).

### Q3 — Where can intent, domain, date, target, or scope be reinterpreted?

Many places. Ordered from least to most damaging:

- **Coach classification** — `LLMCoachIntentClassifier`
  (`src/utils/llmCoachIntentClassifier.ts`) can misread domain/target into
  `CoachIntent`; `coachReferenceResolver.ts` and `findReferencedVisibleDay`
  (`src/utils/coachIntentDispatcher.ts:289`) pick the target day; the command
  router re-derives a `CoachCommand`; `interpretCoachMessageToProgramEdit`
  re-derives a `ProgramEdit`. Each re-encoding is a target/scope reinterpretation
  point. (This is the classic coach-door risk AGENTS.md already warns about.)
- **Tap menu vs. gate split** — the menu decides "which actions are legal to
  offer" with *no* §18 check (`PlanChangeSheet.tsx:667–698`), while the commit
  path decides legality with the full §18 gate. Two validators, two verdicts, one
  action (see Q10 mechanism).
- **The dominant reinterpretation — whole-week re-derivation on every
  resolution.** `resolveWeekWithConditioning` (`sessionResolver.ts:1060`)
  reinterprets **every day's type** (`resolveDate`/`resolveWeek`, game-proximity
  logic at `:637`, `:657–695`, `:921–955`) and **every exercise's load** (the
  strength-progression pass at `:1093–1254`, `:1219`) each time it runs. A
  request scoped to one session/exercise is silently widened to the whole week.
- **The §18 gate re-validates against other days** — `finaliseLiveDateCandidate­
  AgainstWeek` (`src/utils/postGenerationConstraintValidation.ts:1399`) rebuilds
  all seven days and judges the requested change against pre-existing conditions
  elsewhere.
- **Derived-session expiry deletes unrelated days** —
  `buildDerivedSessionExpiryCandidates` (`src/rules/derivedSessionProvenance.ts:389`)
  can remove a system-derived session (Friday's Gunshow) that no longer
  "qualifies" after an unrelated change.

Scope is nominally captured at the UI ("Today only" / "Future weeks too") but the
resolver and gate ignore that boundary because they re-derive from base inputs
rather than applying a bounded diff.

### Q4 — Which layer should own the decision?

**One visible-week owner, with the change expressed as an explicit bounded diff
against a stored visible snapshot.**

- The **accepted visible snapshot** should be the source of truth — the
  materialized week, with loads and derived session types **frozen into it at
  authoring/acceptance time**, not recomputed on read.
- A mutation (from either door) should be a **bounded, explicit diff** against
  that snapshot: "these day(s)/exercise(s) change, nothing else may." Validated
  once, committed atomically.
- The **accepted-state transaction layer** (`src/store/acceptedStateTransaction.ts`)
  is the correct owner — it already atomically commits Move and Bin and already
  absorbs/repairs §18 rather than leaking it. Swap and Add should join it instead
  of using the legacy single-date override writer.
- **§18 should own "is the proposed week legal, and what repair does it need,"**
  validating the *proposed snapshot* as a preview artifact. It must either repair
  atomically across days (not `maxRepairAttempts:1`) or surface the repair for
  approval — it must **never** reject a legal local change because of an unrelated
  pre-existing condition, and it must **never** apply a repair that isn't shown in
  the diff.
- **Resolution (`sessionResolver`) should become pure projection** of the stored
  snapshot — no write-effect-on-read (no progression pass, no re-typing) for days
  that are already authored/accepted.

This is exactly the ownership the AGENTS.md "AI coach one-off edits" note already
prescribes: *visible program snapshot → user message → proposed revised visible
plan → diff → validation → override → visible verification.*

### Q5 — What simpler architecture removes representations instead of adding guards?

Adopt the AGENTS.md pipeline as the single mutation path for **both** doors:

```
visible snapshot
  → user message / tap
  → proposed revised visible plan (the full next week, materialized)
  → diff (bounded delta vs current visible snapshot)
  → validation (§18 on the proposed plan; any repair folded into the diff)
  → override (advisory + proceed-anyway)
  → visible verification (persist the approved snapshot; visible week = stored)
```

This collapses the twelve representations (Q2) to **three**: the current visible
snapshot, the proposed visible snapshot, and the diff between them. Concretely:

- **Both doors emit the same `{proposedSnapshot, diff}`.** The coach door's job
  ends at producing a proposed snapshot; the tap door produces the same. The
  door-specific command families (2/3 and 4/5/6) become thin front-ends, not
  separate execution pipelines.
- **One executor** validates and commits the snapshot atomically (the existing
  accepted-state transaction).
- **Resolution becomes pure projection** — loads and derived types live *in* the
  stored snapshot, materialized once when a session is authored. Reading the week
  never recomputes them. → **Bug 2 and Bug 3 disappear**, because "re-derive the
  whole week on every read/write" is deleted, not guarded.
- **§18 validates the proposed snapshot and its repairs are part of the diff the
  user approves.** → **no silent side effects** (Bug 3's Wed/Fri changes would be
  in the diff or not happen); **no menu-legal-but-gate-rejected asymmetry**
  (Bug 1), because menu and gate judge the *same* proposed plan.

The redesign removes bug classes by **deleting representations and the read-time
derivation**, which is precisely what the escalation rule asks for ("reduce the
number of representations and ownership boundaries").

### Q6 — Which legacy paths should be bypassed or retired rather than patched?

- **The single-date override writer for Swap/Add.** The chain
  `applyPlanChange` → `buildPlanChangeProposal`
  (`src/utils/planChangeProducer.ts:1514`) →
  `materializeCanonicalPlanChangeCandidate` →
  `validateLiveWorkoutWrite` → `finaliseLiveDateCandidateAgainstWeek`
  (`postGenerationConstraintValidation.ts:1399`) with `maxRepairAttempts:1`
  should be **retired in favour of the accepted-state transaction path** that
  Move and Bin already use. This one asymmetry is the direct cause of Bug 1.
- **`dateOverrides` as a parallel mutation channel** separate from
  `AcceptedMaterialContext` — collapse into the single accepted snapshot so there
  is one write target, not two.
- **The read-time strength-progression pass** (`sessionResolver.ts:1093–1254`) as
  a write-effect-on-read — move progression to **authoring time** and freeze the
  result. Resolution must not mutate loads.
- **Read-time type re-derivation and derived-session expiry** for days that are
  already authored/accepted — make expiry an **explicit, disclosed diff step**,
  not an implicit recompute (`derivedSessionProvenance.ts:389`).
- **The coach-revision-override writer as a second door** with its own §18
  boundary (`coachRevisionOverrideWriter.ts`) — unify with the transaction path.
- **Redundant front-half representations** (7/8 as separate from the transaction;
  `ProgramEditDraft` variants) can be retired once both doors emit the same
  `{proposedSnapshot, diff}`.

### Q7 — What tests prove the new ownership boundary?

Invariant/scenario tests (per the AGENTS.md Test Standard — prove the capability,
not the phrase):

1. **Bounded-diff invariant (kills Bugs 2 & 3):** apply any single-target
   mutation (swap exercise, swap session, add, move, bin) to a seeded week; diff
   the full resolved week before/after; assert the changed-day/exercise set
   **equals** the declared target set. Nothing outside the target changes.
2. **Untouched-load invariant (Bug 2):** the load of any exercise not in the diff
   is byte-identical before and after (Deadlift 137.5 stays 137.5 unless it is the
   target).
3. **Local-legality invariant (Bug 1):** a menu-offered action is never rejected
   for a condition on a day outside the diff. Property test over weeks seeded to
   already carry a §18 violation elsewhere; a legal local Swap/Add must succeed,
   and any §18 rejection may cite **only** the diff's day(s).
4. **Disclosed-repair invariant (Bug 3):** every change a §18 repair makes is
   present in the previewed diff, and the confirmation message names every touched
   day (no silent Wednesday re-injection or Friday emptying).
5. **Cross-door equivalence:** the same logical change via tap and via coach
   produces the same proposed snapshot and diff.
6. **Pure-projection / idempotent-read:** resolving the same accepted state twice
   yields identical loads and types (no read-time drift).
7. **Persistence:** the approved snapshot survives reseed/relaunch and re-resolves
   identically (acknowledging the known white-screen-on-relaunch harness gap noted
   in `QA_RUNBOOK.md`; test at the store/resolver layer where the harness gap
   doesn't apply).

---

## 4. Mechanism deep-dive #1 — why the §18 gate rejects mutations the menu already validated as legal

The audit's core question: how can `section18_week_rejected` refuse a Swap/Add
that the menu itself offered? **Because "the menu offered it" and "§18 accepts
it" are two different validators on two different code paths, and the §18 path
judges the whole pre-existing week, not the requested change.**

1. **The menu never consults §18.** In `src/screens/home/PlanChangeSheet.tsx:667–698`
   the `edit_session` step renders "Swap this session", "Add to this day", "Move
   this session", "Bin this session" unconditionally; the only enable checks are
   trivial (≥2 sessions blocks a second add; duplicate-kind blocks, lines
   453–472). Nothing here evaluates Section 18.

2. **Swap/Add reach §18 only at commit, and re-validate the entire week.**
   `commitPlanChange` (`:285`) → `applyPlanChange` →
   `applyPlanChangeWithinTrace` (`src/utils/planChangeProducer.ts:1430`) →
   `buildPlanChangeProposal:1514` → `materializeCanonicalPlanChangeCandidate`
   (`src/utils/canonicalPlanChangeCandidateMaterializer.ts:222`) →
   `validateLiveWorkoutWrite` (`src/utils/postGenerationConstraintValidation.ts:1505`)
   → `finaliseLiveDateCandidateAgainstWeek:1399`, which **rebuilds all seven
   days** (loop 1448–1466), appends the candidate workout **last** (comment: "an
   explicit edit may not displace already-authorised sessions"), and calls
   `requireSection18AcceptedWeek({ contract, workouts, weekStart, profile,
   maxRepairAttempts: 1 })` (1469–1479).

3. **`section18_week_rejected` is thrown from exactly one place** —
   `requireSection18AcceptedWeek` at `src/rules/section18AcceptedWeekGateway.ts:825`
   (`Section18WeekAcceptanceError`, code const `:99`), when the whole-week
   best-first repair search (`searchWholeWeekRepairCandidates:643`) exhausts its
   candidates and returns `impossible`. "Section 18" is the LFA Programming Bible
   §18 approved exposure policy, implemented as a policy contract
   (`src/rules/weeklyExposureContractV2.ts`), a read-only evaluator
   (`src/rules/section18EffectiveWeekEvaluator.ts`), and this commit gate.

4. **`maxRepairAttempts:1` is the trap.** The single-date write passes it with the
   explicit comment: *"A single-date store primitive cannot atomically persist
   repairs to other dates. Reject cross-day repair needs."* So the gate is told it
   may **not** repair across days. If the **pre-existing** week already needs a
   cross-day repair to satisfy §18 — rest redistribution or cross-day core
   stacking (`localRepairCandidates` 566–585) — a condition that has **nothing to
   do with the requested swap** — the search returns `impossible`, and the
   materializer maps the thrown error to `{ ok:false, code:'section18_week_rejected' }`
   (`canonicalPlanChangeCandidateMaterializer.ts:236`), surfaced verbatim as
   *"That change isn't possible here (section18_week_rejected)."*
   (`planChangeProducer.ts:1521`; preview path identically at `:1234`). **The
   verdict is a property of the whole pre-existing week, not the requested
   change.** The risk assessor that would produce the advisory + "proceed anyway"
   override runs only *after* the proposal build succeeds, so it is never reached
   — which is exactly why the audit saw a flat block with no override option
   (row 1.8), violating the contract's Override Principle.

5. **Why Move and Bin escape.** `commitPlanChange` routes them elsewhere:
   `executeProgramControlActionDurably({move_session|bin_session})`
   (`PlanChangeSheet.tsx:266/276`), and inside `applyPlanChangeWithinTrace` the
   move/remove branch (`planChangeProducer.ts:1434`) resolves via
   `resolveAthleteMutation` → `commitAthleteSessionMoveTransaction` /
   `commitAthleteSessionDeletionTransaction`
   (`src/store/acceptedStateTransaction.ts`). These do **identity-only**
   validation, never invoke the single-date §18 gate, and — critically — the one
   §18 reference in that file is **defensive recovery, not rejection**: at
   `acceptedStateTransaction.ts:1482` a `Section18WeekAcceptanceError` is caught
   and the rejected generator's **repaired** candidate is reused
   (`error.result.canonicalWorkouts`) and fed to the shared rolling repair search.

**So the same underlying §18 condition blocks a Swap but is silently repaired for
a Bin.** This is an ownership asymmetry between the legacy single-date override
writer (Swap/Add) and the typed accepted-state transaction (Move/Bin) — not a
difference in the rules. That is why the fix is *not* "relax §18" or "add a guard
before the gate," but "route Swap/Add through the same transaction owner, and
make §18 a preview-diff validator that repairs atomically or surfaces the repair"
(Q4–Q6).

---

## 5. Mechanism deep-dive #2 — why load recalculation runs during mutations that didn't touch those exercises

The audit's core question: why did an unrelated exercise (Deadlift) change load
during a Back Squat→Step Ups swap? **Because the visible week is a derived
read-model, and re-deriving it re-runs load progression over the entire week —
including exercises the mutation never touched.**

1. **Loads are never frozen; the visible week is derived.** The week the athlete
   sees is `ResolvedDay[]`, produced by `resolveWeekWithConditioning`
   (`src/utils/sessionResolver.ts:1060`) on every render (read path via
   `src/hooks/useSchedule.ts`). Stored state holds base inputs and overrides, not
   a materialized set of final loads.

2. **Every resolution re-runs a whole-week strength-progression pass.** Inside
   `resolveWeekWithConditioning`, the "Strength Progression Pass"
   (`sessionResolver.ts:1093–1254`) loops every day and re-applies
   `applyStrengthProgression` (`src/utils/strengthProgressionIntegration.ts:528`)
   to each strength session (`sessionResolver.ts:1219`), over **all eligible
   exercises in the workout**, not just a changed one.

3. **The swap perturbs a shared reference frame.** The Back Squat→Step Ups swap
   writes only one day via `setManualOverride`, but the subsequent resolution
   re-progresses the entire week from base references. Deadlift and Step Ups
   **share the `squat` anchor** in `EXERCISE_LOAD_MAP`
   (`src/utils/loadEstimation.ts:156` Deadlift → anchor `squat`, ratio 1.00;
   `:165` Step Ups → anchor `squat`, ratio 0.20). Introducing Step Ups changes
   the day's composition and triggers a fresh progression pass;
   `applyDelta` (`strengthProgressionIntegration.ts:484`) computes
   `newWeight = roundToIncrement(weightMultiplier * prescribedWeightKg,
   loadIncrementKg)` — a multiplier bump rounded to the 2.5 kg barbell increment
   — which turns Deadlift **137.5 → 140**. Nothing *decided* to change the
   Deadlift; its load simply fell out of recomputing loads that were never stored.

4. **The coach door shows the identical drift** because it resolves the *same*
   read model — `resolveWeekWithConditioning` is reached from
   `src/screens/coach/CoachScreen.tsx:1499`, `src/utils/coachWeekDiff.ts:245`, and
   `src/utils/applyAdjustmentEvents.ts`. That is why the audit noted "the same
   signature appears through the coach chat path too."

This is the read-time write-effect the redesign removes by materializing loads at
authoring time and making resolution pure projection (Q4–Q6). No guard can safely
suppress it — the moment a resolution re-runs progression, an untouched load is at
risk. It has to stop being recomputed on read.

---

## 6. Recommendation

Per the Elegant Solution Requirement, two options were compared.

### Option A — incremental fix inside the current system
Add scope guards so the progression pass and type re-derivation skip untouched
days; special-case the §18 gate to ignore pre-existing violations off the changed
day; disclose Bin's cascade in the confirmation message.

- **Verdict: reject.** Every item is a guard/branch/finaliser patch of the exact
  kind the escalation rule prohibits after repeated failures. It leaves the
  root — read-time whole-week re-derivation and the twelve representations —
  intact, so new instances of the same classes will keep appearing (a scope guard
  that covers Deadlift won't cover the next shared-anchor pair; a §18 carve-out
  for one repair type won't cover the next). It also cannot fix Bug 1 cleanly,
  because the Swap/Add ownership asymmetry is structural.

### Option B — source-of-truth redesign (recommended)
Make the **accepted visible snapshot** the source of truth, express every mutation
(both doors) as a **bounded diff** against it, validate once, commit atomically
through the accepted-state transaction, and make resolution **pure projection**
with loads and derived types frozen at authoring time (the AGENTS.md pipeline,
Q4–Q5).

- **Verdict: recommend.** It **deletes** the primitive that generates all three
  bug classes — "re-derive the whole week on every read and every write" — rather
  than guarding it. Bug 2 and Bug 3 vanish because untouched days/exercises are
  never recomputed; Bug 1 vanishes because menu and gate judge the same proposed
  plan and §18 repairs are part of the approved diff. It reduces twelve
  representations to three and two ownership models to one, which is the explicit
  goal of the escalation rule.

### Design-level migration path (no code here — for the follow-up implementation plan)
1. **Freeze derivation into the snapshot.** Materialize loads (move the
   progression pass out of `sessionResolver` to authoring/acceptance) and derived
   session types into `AcceptedMaterialContext`; make `resolveWeekWithConditioning`
   a pure projection of stored state.
2. **Unify the writer.** Route Swap/Add through the accepted-state transaction
   (`acceptedStateTransaction.ts`) that Move/Bin already use; retire the
   single-date override writer and `dateOverrides` as a parallel channel.
3. **Turn §18 into a preview-diff validator.** Validate the proposed snapshot;
   fold any repair into the diff the athlete approves; drop `maxRepairAttempts:1`
   for a single atomic commit that can touch multiple days *when disclosed*.
4. **Both doors emit `{proposedSnapshot, diff}`.** Coach and tap become front-ends
   that build the same proposed snapshot; the diff drives preview, override, and
   the confirmation message (which must name every touched day).
5. **Lock it with the Q7 invariants** before removing the legacy paths.

This reassessment proposes no code changes. Implementation is blocked until it is
approved, after which the follow-up plan should be written against the Q7 test
boundary first (TDD), per AGENTS.md.

---

## Appendix — source map

- Audits: `docs/audits/PROGRAM_2026-07-21.md`, `docs/audits/WORKOUT_2026-07-21.md`,
  `docs/audits/HOMEV2_2026-07-21.md`, `docs/audits/PROFILE_2026-07-21.md`.
- Contract & rules: `docs/SUPPORTED_ATHLETE_ACTIONS.md` (Group 6),
  `docs/LFA_PROGRAMMING_BIBLE.md` §18, `docs/LFA_PROGRAMMING_POLICY_DECISIONS.md`.
- §18: `src/rules/section18AcceptedWeekGateway.ts`,
  `src/rules/section18EffectiveWeekEvaluator.ts`,
  `src/rules/weeklyExposureContractV2.ts`,
  `src/rules/derivedSessionProvenance.ts`, `src/rules/wholeWeekRepairEngine.ts`.
- Write path: `src/utils/postGenerationConstraintValidation.ts`,
  `src/utils/planChangeProducer.ts`,
  `src/utils/canonicalPlanChangeCandidateMaterializer.ts`,
  `src/utils/coachRevisionOverrideWriter.ts`, `src/store/acceptedStateTransaction.ts`.
- Resolution & loads: `src/utils/sessionResolver.ts`,
  `src/utils/strengthProgressionIntegration.ts`, `src/utils/loadEstimation.ts`,
  `src/hooks/useSchedule.ts`, `src/utils/visibleProgramReadModel.ts`.
- Doors: `src/screens/home/PlanChangeSheet.tsx`,
  `src/screens/home/DayWorkoutScreenV2.tsx`, `src/utils/programControlActions.ts`,
  `src/screens/coach/CoachScreen.tsx`, `src/utils/coachTurnController.ts`,
  `src/utils/coachIntentDispatcher.ts`, `src/utils/coachCommandRouter.ts`,
  `src/utils/coachCommandExecutor.ts`, `src/utils/coachProgramEdit.ts`.
- State: `src/store/programStore.ts`, `src/store/acceptedStateColdStart.ts`.

---

## Stage 2 diagnosis — the §18 preview-gate refusal (invariant #3), 2026-07-22

Recorded after stage 1 landed (loads frozen at authoring; ownership #1/#2/#6/#7
green). Diagnosis approved as the Q6 route below. **Design only — no stage-2
code yet.**

### Reproduction & failure signature
`applyPlanChange({ kind: 'swap_category', date: MON, category: 'conditioning_light' })`
on the seeded `standard-in-season-week` is refused with
`section18_week_rejected`. Driving the gateway directly
(`runSection18AcceptedWeekGateway`) on the resulting week returns
`status: 'impossible'` with failure signature:

```
pattern_restore_failure:strength_patterns:0
| pattern_restore_failure:strength_patterns:0
| planner_selected_target_miss:main_strength:2
```

Swapping Monday's *only* lower-body strength session to conditioning drops the
week below §18's required main-strength count, and there is no free day to
relocate that strength to (Tue/Thu are Team Training + strength, Wed rest, Fri
optional, Sat game, Sun recovery).

### `maxRepairAttempts` is a red herring
The single-date gate passes `maxRepairAttempts: 1`
(`postGenerationConstraintValidation.ts:1477`, comment: "A single-date store
primitive cannot atomically persist repairs to other dates"). But the failure
is **not** a repair-budget problem: re-running the gateway at
`maxRepairAttempts: 3` still returns `impossible` (outcome attempts = 1). The
week genuinely cannot satisfy the strength minimum by repair — no reachable
week state fixes it. Bumping the budget changes nothing.

### Why Bin passes on the identical shortfall
Binning the same strength session hits the same shortfall, yet succeeds.
Bin routes through the accepted-state transaction
(`commitAthleteSessionDeletionTransaction`), which — when relocation is
impossible — records an **authorised reduction** (`explicit_user_override`:
"you asked for this, so this week's strength target is reduced"). §18 then
accepts the week against the *reduced* target. See
`athleteSessionDeletionTests.ts` regression 11 ("impossible relocation records
typed reduction and keeps deletion"), message: *"Session removed. This week's
strength target has been reduced at your request."*

**The single-date Swap/Add path has no authorised-reduction ownership.** It can
only ask the gateway to accept the full target, and when that's impossible it
rejects. That is the whole of the asymmetry: same §18 shortfall, but Bin owns a
reduction and Swap/Add do not.

### The fix is Q6 — route Swap/Add through the accepted-state transaction
Not a `maxRepairAttempts` bump, and **not** replicating the authorised-reduction
bookkeeping inside the proposal path (that would duplicate ownership — the exact
anti-pattern the escalation rule forbids). Instead:

1. Extend the athlete-mutation resolver + accepted-state transaction
   (`resolveAthleteMutation` in `planChangeProducer.ts`;
   `acceptedStateTransaction.ts`) to **own `swap_category` / `add_category`**.
   Semantically a swap is remove-and-replace and an add is an addition; when the
   change displaces a required session that cannot be relocated, the transaction
   records the same authorised reduction Bin does.
2. Switch `applyPlanChangeWithinTrace` (`planChangeProducer.ts:1434`) to route
   `swap_category` / `add_category` through that transaction (like
   `move_session` / `remove_session` already do), instead of
   `buildPlanChangeProposal` → `applyCoachRevisionDateOverrides` → the
   single-date override writer.
3. Retire the single-date override-writer path for Swap/Add (the
   `deferWeekAcceptance: false` branch of `validateLiveWorkoutWrite` /
   `finaliseLiveDateCandidateAgainstWeek` no longer owns these edits).

Result: a legal Swap/Add is never refused for a pre-existing off-target §18
condition; if the change itself reduces a target, the week is accepted against
the reduction — exactly as Bin behaves.

### Spec addition — disclosure parity (owner: transaction result)
An authorised reduction triggered by a Swap/Add **must be disclosed in the
transaction result**, with the **same ownership as Bin's disclosure** (Bin
surfaces it in the result message, e.g. "…strength target has been reduced at
your request."). A Swap/Add that silently reduces a target — even while
correctly accepting the week — is a defect of the same class as the Bin
undisclosed-side-effect finding (Q7 invariant #4). This is asserted **before
implementation** by an added ownership invariant (#8, "disclosed-reduction"):
the strength-displacing Swap must succeed **and** disclose the reduction in its
result. It is RED until stage 2 lands.

### Stage-2 gate
`test:bible` green; ownership scoreboard monotonic (stage 2 targets #3 and the
new #8 → green; never green→red). Report both.

---

## Stage 2 landed — swap re-route (2026-07-22)

Non-anchor `swap_category` / `swap_template` now route through the accepted-state
transaction (the path Move/Bin use), modelling a swap as a whole-session removal
whose `remainingWorkout` is the materialized new session. `resolveAthleteMutation`
+ `applyPlanChangeWithinTrace` / `previewPlanChangeRisk` gained a `swap_session`
branch; the new content is materialized through the pure
`finaliseWorkoutAfterMutation` boundary (not the rejecting whole-week gate), so
§18 is owned by the transaction. One transaction edit: rest-ownership /
rest-mark are gated on `!remainingWorkout` (mirroring Move), byte-identical for
every existing Bin case.

**Correction to the stage-2 diagnosis above.** The diagnosis claimed MON's
lower-body strength has "no free day to relocate" and that a swap therefore
"records the same authorised reduction Bin does." That was an artefact of driving
the **single-date** gate (`maxRepairAttempts: 1`), which cannot persist cross-day
repairs. The transaction path *can*: on `standard-in-season-week`, both Bin **and**
the swap relocate the displaced strength to Wednesday (a free rest day) and record
**no** reduction. A forced reduction only occurs when the week genuinely has no
free relocation day.

### Product decision (Sam, 2026-07-22)
A strength-displacing swap **relocates the displaced work when the Bible allows
it, discloses where it went, and reduces the target — with disclosure — only when
relocation is genuinely impossible.** Parity with Bin is in reduction
*ownership/disclosure*, not in relocation policy. Future athlete UX (lands with
the **preview-gate stage**, not now): ask-before-restructure ("want me to update
the rest of the week for the optimal program?") and, when relocation is
impossible, a **quantified** notice of what the week loses. To power that later,
the transaction result already carries the data now:
`AthleteDeletionPublishedOutcome.destinationDate` (relocation target day) and
`AthleteDeletionPublishedOutcome.reductions` (per-metric
`originalApprovedTarget` → `reducedTarget` shortfall vs the optimal week).

Invariant #8 was split accordingly and both are green:
- **#8a** (relocatable, standard seed) — the displaced strength lands on the free
  day (Wed) and the result names that day.
- **#8b** (unrelocatable, Pre-season Mon/Wed/Fri, no game/team training) — a real
  `explicit_user_override` reduction is recorded and disclosed.

Shipped scoreboard: **#3, #8a, #8b green**; #1/#2/#6/#7 unchanged; #4/#5 remain
red (out of stage-2 scope). Out-of-gate swap suites updated same commit
(`planChangeProducerTests`, `weekRebuildIntegrationTests` [C] flipped from
"rejected" to "accepted + disclosed").

### Stage 3 — tests-first, mandatory before implementation
Add these two **RED** ownership invariants first; they pin the behaviour the
legacy single-date override writer still owns:
- **(a) Anchor-day swap** — a swap on a Team Training day **preserves the Team
  Training anchor** and replaces only the gym component (no anchor drop/re-add).
  Non-anchor swaps deferred here fall through to the legacy writer today
  (`swap_defers_to_legacy_anchor`).
- **(b) Empty/rest-day add** — `add_category` on an empty day routes through a new
  **athlete-addition transaction primitive** (not the legacy writer), §18 owned
  by the transaction.

**Retirement ledger:** the legacy single-date override writer still owns
anchor-day swaps and **all** adds. It is not fully retired until stage 3 lands
(a) and (b) green. This note is the tracking record so the retirement is not
quietly dropped.

### Stage-3 design correction — the "no constraint" add was wrong (2026-07-22)
The stage-3 plan assumed an empty-day add could be a *constraint-free* transaction:
stage the new session as a `dateOverride`, run the whole-week repair with a
preserve-set intent, and let it survive. **Empirically it does not.** Driving the
§18 gateway on `standard-in-season-week` + a Wednesday conditioning add returns
`status: repaired` and **canonicalises Wednesday straight back to `Rest`** — the
gateway strips the unrequired session. It is not an off-target rejection; the
gateway simply does not keep authored content that nothing *pins*.

**The single mechanism by which user-authored content survives §18 is the
`UserRemovalConstraint.remainingWorkout` pin.** Removals and swaps survive because
their constraint forces `remainingWorkout` onto the day
(`applyUserRemovalConstraintsToWeek`); that is exactly why invariant #9 (anchor
swap) passes. Same correction shape as the stage-2 diagnosis correction: an
assumption about a later layer was wrong, and the fix is to route through the
**one** ownership mechanism, not to add a second.

**Adopted (Sam approved):** keep the dedicated addition primitive
(`commitAthleteSessionAdditionTransaction`, ledger kind `session_add`), but pin the
added session with a constraint whose `originalWorkout` = the day's **base `Rest`
placeholder** (present with a stable id) and `remainingWorkout` = the new session.
Requirements verified with the fix:
1. **Zero displaced work.** The pin's `originalWorkout` is `Rest`, so no
   authorised-reduction / strength-target math counts it as removed training
   (`equivalentExposureMayRelocate: false`, no reduction recorded).
2. **Re-add defer stays honest.** The removal-constraint re-add/restoration defer
   is distinguished from add-pins (add-pins carry `remainingWorkout` and leave the
   day occupied; only a real whole-day removal leaves it empty with
   `remainingWorkout: null`), verified against the athlete-session-deletion re-add
   regression.
3. **Undo round-trips to Rest.** Restoring a `session_add` returns the day to its
   base `Rest` placeholder (add undone = rest day again).

## Stage 3 landed — anchor-day swap + empty-day add (2026-07-22)

Both stage-3 ownership invariants are green (`#9` anchor swap, `#10` empty-day add);
scoreboard `#1,2,3,6,7,8a,8b,9,10` green, `#4/#5` still red (out of scope).
`test:bible` green. The ownership suite stays a standalone target (not appended to
`test:bible` while `#4/#5` are open).

**What now routes through the accepted-state transaction (legacy writer retired for
these):**
- **Anchor-day (Team Training) swaps** — `resolveAthleteMutation` no longer defers
  `team_training`; it rides the deletion transaction's `remainingWorkout` pin
  (`Team Training + <new>`), anchor preserved, gym component replaced.
- **Empty/rest-day adds** — `commitAthleteSessionAdditionTransaction`, a `session_add`
  pinned by a whole-session constraint whose `originalWorkout` is the day's base
  `Rest` placeholder (zero displaced work); §18 repaired cross-day and disclosed
  ("…added on Wednesday. I rebalanced Friday to keep your week balanced.").
- **Game day** is fully locked for swap AND add — plain-language refusal
  ("It's game day — sessions can't be changed or added here."), never a raw code.
  (`SUPPORTED_ATHLETE_ACTIONS.md` contract text to follow in a later change.)

**Retirement ledger — what the legacy single-date override writer STILL owns after
stage 3** (the four residuals amendment 2 enumerated, so none is quietly dropped):
1. **Occupied-day STACK adds** — `add_template`/`add_category` onto a day that
   already has a session (the occupied branch of `resolveAthleteMutation`).
2. **`add_defers_to_legacy_stack`** — the deferral error code that routes (1) and
   (3) to the legacy writer.
3. **`no_template_for_category`** — a category pick (swap or add) with no
   resolvable template.
4. **The removal-constraint re-add / restoration defer** — an add onto a day
   emptied by an active whole-DAY removal (`remainingWorkout: null`); that is the
   restoration path, not a net-new add, so it also defers via
   `add_defers_to_legacy_stack`.

(Distinctly: three *cases* — occupied stack, no-template, re-add restoration —
across two error codes; item 2 is the shared code, listed separately per the
tracking record.) A future stage migrates occupied-day stack adds through a
transaction-owned stack primitive to finish the retirement.
