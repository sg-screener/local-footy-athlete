# Readiness / Source-Fact Write-Path Ownership Reassessment — item 2

**Branch:** `readiness-source-fact-ownership` (off `main` @ `26de647`). **Status:
APPROVED (Sam, 2026-07-22) — implementation underway, tests-first.** This is the
reassessment of record; the tests-first fix follows the plan in the final two
sections.

This is the Group-B item-2 follow-up. Items 1/3/4 merged (`26de647`); item 2
(readiness) was deferred to its own scoped Q1–Q7 reassessment per the CLAUDE.md /
AGENTS.md Coach Architecture Escalation Rule, because **the semantic layer
understands "I'm tired" correctly, but later layers block, mis-read, or discard
that intent** — the exact escalation condition. It reuses the spine established in
`docs/SECTION18_OWNERSHIP_REASSESSMENT_2026-07-22.md` (one transaction owner,
representations collapsed, pure projection).

All `file:line` at branch HEAD.

---

## Context — why this change

The athlete taps **"I'm not 100%" → "Just a bit tired today"** on the Program
screen. The sheet closes with **no confirmation**, the card **stays "I'm not
100%"**, and (per the on-device reaudit) **no per-fact readiness witness renders
at all**. The athlete has no evidence the app heard them. Readiness is a V1
blocker (`docs/V1_LAUNCH_DEFINITION.md`: "Readiness signal visibly acknowledged +
opt-in lighter-day offer"). This document finds the root cause and defines the
tests-first fix for the three requested parts: **(a)** unconditional
acknowledgment, **(b)** card read-alignment, **(c)** inline reversible lighter-day
offer through the transaction owner.

## Evidence

**On-device** (iPhone 17 Pro, seed `standard-in-season-week`, anchor Mon
2026-07-13; `docs/audits/GROUPB_REAUDIT_2026-07-22.md` finding 2): "I'm not 100%"
→ "Just a bit tired today" closes the sheet with no toast; `readiness-clear-state`
persists in the hierarchy; the card stays "I'm not 100%"; **no per-fact witness
renders** → the fatigue fact never reaches `temporarySourceFacts`, i.e. it is
**absorbed at the write path**, not persisted-but-mis-rendered.

**Probe** (headless `executeProgramControlActionDurably` → `transactTemporarySourceFact`
→ `commitTemporarySourceFactSet`): returns `ok:false` with the generic message
*"The report was not applied because the visible program could not be verified."*
— an accepted-state verify/rollback mismatch. Headless seed fidelity was
imperfect, so whether the bare fact is truly *rejected* on the standard seed vs
merely *unacknowledged* is the first thing the tests-first phase pins (RED
characterization test, below).

## Root cause — the spine

"Tired today" is **understood correctly** and turned into a durable
`TemporaryFatigueFact` — but three independent layers between that fact and the
athlete's eyes each drop or mis-handle it, because **the one fact is re-encoded
into four disagreeing representations and forced through a gate built for program
mutations**:

1. **The acknowledgment is gated on `requiresRebuild`.**
   `handleProgramControlResult` (`src/screens/home/useHomeScreen.ts:1230`) early-
   returns `if (!result.requiresRebuild) return;`. The fatigue action is
   `requiresRebuild:false` (`useHomeScreen.ts:1427`), so **success and failure
   alike produce no acknowledgment** — the whole point of a contextual signal is
   that it doesn't rebuild, so it is precisely the case that gets no feedback.
   `result.message` (success text *or* the generic "could not be verified") is
   discarded. `registerSourceFactRenderObservation` additionally bails on
   `!result.ok` (`:1260`), so a failed write registers no witness either — exactly
   the reaudit's "no witness renders."

2. **The card label reads a representation the write never produces.**
   `weekReadiness` (`src/screens/home/HomeScreenV2.tsx:205-243`) matches
   `activeConstraints` against **legacy tap-modifier ids**
   (`recoveryModeModifierIdForDate` / `loadReductionModifierIdForDate` /
   `poorSleepConstraintId`, `:207-211`; ids from `tapProgramModifiers.ts:19-24`,
   `readinessConstraints.ts:15`). The fatigue fact projects `source-fact:global:
   <from>:<until>` (`src/rules/temporarySourceFact.ts:547`) + a date-keyed
   `ReadinessSignal` — **neither is in that id set**, so the primary match always
   misses. The only escape is the `todayReadinessModifier` fallback (`:236-242`),
   gated on `isThisWeek && signalsByDate[todayISO]`, so even a *successful* write
   can't flip "I'm not 100%" in the general case.

3. **The contextual fact is forced through the program-mutation visible-verify
   engine.** `transactTemporarySourceFact` →`commitTemporarySourceFactSet` runs
   `runCoachMutationTransaction({ allowAcceptedStateOnlyChange:true })`
   (`src/store/temporarySourceFactTransaction.ts:283-358`). That engine's
   `validateEffectiveComposition` → `assertAcceptedVisibleLedgerEquivalence`
   (`src/store/acceptedStateTransaction.ts:316-397`) re-runs the **§18
   exposure-contract ledger equivalence over every affected week** — even for a
   fact that moves no visible session. A perturbation of the re-evaluated
   effective-week signature throws → `coach_mutation_post_apply_verification_failed`
   → collapsed by `temporarySourceFactTransaction.ts:567-576` into **one generic
   string** that names the "visible program" for a signal that was never supposed
   to touch it. This is the probe's `ok:false`.

Same shape as the §18 findings: a signal understood at the top is silently
reinterpreted (Defect 2), blocked (Defect 3), or dropped (Defect 1) by a later
layer that owns a different representation.

## The seven required questions

### Q1 — current source of truth for readiness facts
The durable `AcceptedMaterialContext.temporarySourceFacts` array
(`acceptedStateColdStart.ts:44`, inside `programStore`) **is** the canonical owner
— the transaction layer treats it as such. But **three derived mirrors + one
foreign scheme compete as the truth the UI actually reads**, and they disagree:
the `source-fact:global:*` compatibility constraint (mirrored to
`coachUpdatesStore.activeConstraints`), the date-keyed `readinessSignalsByDate`
(mirrored to `useReadinessStore.signalsByDate`), and the **legacy
`tap-*`-modifier constraint ids** that the label's primary match expects but the
`tired_today` write never emits. A **separate standalone readiness transaction**
also exists (`commitReadinessSignalTransaction` /
`commitReadinessStateTransaction`, `acceptedStateTransaction.ts:2873-2912`),
distinct from the fact path.

### Q2 — how many representations of "the athlete is tired today"
**Four durable/mirror representations that disagree**, plus transient UI state:
(1) canonical `TemporaryFatigueFact` (`factId: temporary-source-fact:v1:fatigue:…`,
the write + the per-fact witness); (2) `ActiveFatigueConstraint`
`id:source-fact:global:*` (mirrored to `activeConstraints` — what the label
*searches*, by the wrong scheme); (3) `ReadinessSignal{energy:'low'}` keyed by
date (what `todayReadinessModifier` reads); (4) legacy `tap-load-reduction` /
`tap-recovery-mode` / `poor-sleep` ids (what the label's primary match set
*expects*, never produced here). The **read matches on the one representation the
write never creates** — that is the whole of Defect 2.

### Q3 — where can it be reinterpreted, blocked, or dropped
- **Acknowledgment drop** — `handleProgramControlResult:1230` (`requiresRebuild`
  gate) and `registerSourceFactRenderObservation:1260` (`!ok` bail).
- **Label mis-read** — `weekReadiness` (`HomeScreenV2:207-216`) matches the wrong
  id scheme; the fallback (`:236`) adds an `isThisWeek` + today-signal gate.
- **Write-path block** — `assertAcceptedVisibleLedgerEquivalence`
  (`acceptedStateTransaction.ts:365-385`) rejects a contextual fact for a
  whole-week exposure-signature perturbation it didn't cause; the reason is then
  **collapsed into a generic "visible program" string**
  (`temporarySourceFactTransaction.ts:567-576`).

### Q4 — which layer should own the decision
- **`temporarySourceFacts` is the single source of truth.** The card label and the
  witness must both derive from **that same canonical projection**, not from the
  legacy `tap-*` ids or a second mirror store.
- **Acknowledgment is owned by the handler, unconditionally** — separate
  "acknowledge the athlete" from "did the program rebuild." Write outcome ≠
  acknowledgment.
- **A contextual signal must not be judged by the program-mutation visible-verify
  gate.** Ownership of "is this a legal *program change*" belongs to the mutation
  path; a fatigue fact that changes no visible session should commit on a boundary
  that verifies **fact integrity**, not whole-week §18 exposure equivalence.
- **The lighter-day offer is a program mutation** and belongs to the **accepted-
  state transaction** (the owner Move/Bin/Swap already use) — reversible,
  disclosed — not a bespoke readiness writer.

### Q5 — simpler architecture that removes representations
Collapse "tired today" onto one spine: **fact → one canonical readiness
projection → one read**, mirroring the AGENTS.md pipeline.
- **One projection feeds both label and witness**, derived from
  `temporarySourceFacts`. Delete the legacy-`tap-*`-id primary match for the fact
  path; stop the label reading a second mirror store.
- **Acknowledgment unconditional**, driven by `result` (surfacing `result.message`
  / an explicit "Got it — logged you as tired today"), independent of
  `requiresRebuild`.
- **Contextual-fact commit boundary** that verifies the fact landed and the
  visible base is unchanged — *without* re-running §18 whole-week exposure
  equivalence (that check exists to protect program mutations, which this isn't).
- **Lighter-day offer = a reversible adjustment through the accepted-state
  transaction**, so it is disclosed and undoable by the same machinery as every
  other edit.

This deletes representations (4 → 1 canonical read) and gates (contextual facts
leave the mutation gate), rather than adding guards.

### Q6 — legacy paths to retire, not patch
- The **legacy `tap-*`-modifier-id primary match** in `weekReadiness` for the
  fatigue-fact path (`HomeScreenV2:207-216`).
- The **`useReadinessStore.signalsByDate` fallback read** as an independent label
  source (`todayReadinessModifier`) — make the label a pure projection of the
  canonical facts.
- The **generic "visible program could not be verified" collapse** for contextual
  facts (`temporarySourceFactTransaction.ts:567-576`) — a fatigue signal must not
  report a program-verification failure.
- The **standalone `commitReadinessSignalTransaction`/`…StateTransaction`** as a
  second readiness door, if the fact path already owns `readinessSignalsByDate`.

### Q7 — tests that prove the new ownership boundary
Invariant/characterization tests (per AGENTS.md — prove the capability, not the
phrase), written **RED first**:
1. **Characterization (resolves the open question):** drive the *standard*
   `standard-in-season-week` seed through the real `set_fatigue_status`
   (`today_only`, `low_energy`) durable path; assert the actual outcome
   (`ok`/`changedProgram`/`message`). This decides whether Defect 3 is a live
   rejection on the standard seed or only reproduces off-seed.
2. **Unconditional-acknowledgment:** after `set_fatigue_status`, the handler
   surfaces an acknowledgment **regardless of `requiresRebuild` and regardless of
   `ok`** — the sheet never closes silently on a contextual fact.
3. **Read/write alignment:** after a committed fatigue fact, `weekReadiness` / the
   card label reflects "tired today" **derived from the canonical fact**, for
   `today_only` *and* `current_week` scope — not only when `observedDate===today`.
4. **Witness/label parity:** the human-visible label and the per-fact witness
   reflect the **same** state (today they diverge — witness reads `factId`, label
   reads legacy ids).
5. **Contextual-fact-not-blocked** (if Defect 3 reproduces): a purely contextual
   fatigue fact commits `ok:true` on a seed carrying a pre-existing off-target §18
   condition — it must not be rejected for a whole-week exposure perturbation it
   did not cause (parallels the §18 "local-legality" invariant).
6. **Single-owner lighter-day:** accepting the offer records a **reversible
   adjustment through the accepted-state transaction** (reversible-ledger entry,
   disclosed), and **declining still persists the fatigue fact + acknowledgment**;
   undo round-trips the program to its pre-offer state.

---

## Recommendation (Elegant Solution Requirement — two options compared)

**Option A — incremental patches.** Make the fatigue fact *also* emit a legacy
`tap-*` id so the label matches; add a toast in the sheet's own `onApply`; add a
guard in `assertAcceptedVisibleLedgerEquivalence` to skip contextual facts.
**Reject** — every item adds a representation or a guard to a shared gate (the
exact escalation-rule anti-pattern), leaves four disagreeing representations
intact, and re-couples the label to a scheme it should stop reading.

**Option B — align reads to the single source of truth + move the contextual fact
off the mutation gate + own the offer in the transaction (recommend).** Deletes
representations and gates rather than guarding them; matches the §18 reassessment
endpoint and the AGENTS.md snapshot→ack→diff→validate→verify pipeline.

## The fix — tests-first, Option B, in three parts

Write the Q7 tests RED first (test #1 characterization first — it may narrow part
(c)'s scope). Then:

- **(a) Unconditional acknowledgment.** Separate acknowledgment from rebuild:
  `handleApplyWeekReadiness` (or `handleProgramControlResult`) surfaces an explicit
  athlete-visible acknowledgment from `result` for the fatigue path even when
  `requiresRebuild:false` and even when `ok:false` (an honest "couldn't log that"
  rather than silence). Never gate the ack on `requiresRebuild`.
- **(b) Card read-alignment.** Derive `weekReadiness`'s "tired today" state from the
  canonical `temporarySourceFacts` projection (the same source `readinessFacts` /
  the per-fact witness already use, `useHomeScreen.ts:371-377`), retiring the
  legacy `tap-*`-id primary match and the second-mirror fallback for this path.
- **(c) Inline reversible lighter-day offer through the transaction owner.** After
  acknowledgment, offer an opt-in lighter day inline; **accept** applies a
  disclosed, reversible adjustment via the accepted-state transaction
  (`resolveAthleteMutation` / `commitAthleteSession*Transaction`), **decline**
  leaves the program unchanged but keeps the fact + acknowledgment. If test #1
  shows the bare fact is itself blocked on the standard seed, part (c) also moves
  the contextual-fact commit onto a fact-integrity boundary (Q4/Q5) so the signal
  is never reported as a program-verification failure.

## Retirement ledger (what stops being owned by the old paths)
- `weekReadiness` legacy `tap-*`-id primary match + `readinessStore` fallback read
  → retired for the fatigue-fact path.
- Generic "visible program could not be verified" for contextual facts → retired.
- Standalone readiness transaction as a second door → retired if redundant.
Anything still owned elsewhere after this change is recorded here so it is not
quietly dropped (same discipline as the §18 stage ledgers).

## Verification
- `test:bible` green; **§18 ownership scoreboard monotonic** (report before/after;
  never green→red) — same gate every prior stage used.
- New readiness invariants (Q7 #2–#6) green; #1 recorded as the characterization
  baseline.
- **On-device replay** of the exact reaudit repro (seed `standard-in-season-week`,
  iPhone 17 Pro): "I'm not 100%" → "Just a bit tired today" now (a) shows an
  acknowledgment, (b) flips the card off "I'm not 100%", (c) offers an
  inline reversible lighter day; per-fact witness renders. Screenshot each,
  alongside the original reaudit finding-2 shot.

## Gate
No code until this reassessment is approved. Then: RED tests first (characterization
#1 first), then parts (a)→(b)→(c), `test:bible` + ownership scoreboard reported at
each step. Relates to `docs/SECTION18_OWNERSHIP_REASSESSMENT_2026-07-22.md`.

---

## Characterization correction — Defect 3 was a seed-fidelity artifact (2026-07-22)

Recorded after the tests-first characterization (Q7 #1) ran the *real*
`set_fatigue_status` (`today_only`, `low_energy`) durable path on the standard
`standard-in-season-week` seed. **Same shape as the §18 stage-2/3/4 corrections: an
assumption about a later layer was wrong.**

**Finding: the write path is NOT the problem.** On a *faithful* accepted context
(normalized via `normalizeAcceptedMaterialContext` + a production
`commitAcceptedStateTransaction` acceptance, matching `programStore`'s
`program:hydration_acceptance`), the contextual fatigue fact commits cleanly:
`ok:true`, `changedProgram:false`, message *"The report is active. No visible
session needed changing."*, and it **persists** — `temporarySourceFacts` count 1,
`activeConstraints:[source-fact:global:2026-07-13:2026-07-13]`,
`readinessSignalsByDate:{2026-07-13}`.

The earlier `ok:false` / *"visible program could not be verified"* (the memory's
headless probe **and** the reaudit's "absorbed at the write path" inference) was a
**test-seed artifact**: an *un-normalized* seed context made
`runCoachMutationTransaction`'s rollback-fidelity check throw
`accepted_state_rollback_mismatch` (pre-state capture normalized the context, the
raw seed did not, so restore ≠ capture). It is **not** the §18-ledger-equivalence
rejection Defect 3 hypothesised, and it does **not** reproduce in production.

**Consequences for the plan:**
- **Defect 3 is withdrawn.** No contextual-fact commit-boundary rework. Q6's
  "generic-message collapse for contextual facts" and the standalone readiness
  transaction remain *code-hygiene* retirements, not correctness fixes; deferred
  unless they fall out of the Defect-1/2 work.
- **Q7 #5 (contextual-fact-not-blocked)** becomes the **characterization baseline
  that asserts `ok:true`** (the write must stay unblocked), not a RED-first
  behaviour change.
- **Part (c)** shrinks to the net-new lighter-day offer through the transaction
  owner — the "move the commit onto a fact-integrity boundary" clause is dropped.

**Defects 1 and 2 are confirmed REAL and empirically reproduced (faithful seed):**
- **Defect 2 (card read-alignment) — confirmed even in the happy path.** With
  `today_only`, today = anchor, `isThisWeek` true, and today's readiness signal
  present, `weekReadiness` still resolves **null** → card stays "I'm not 100%":
  the primary match misses (fact creates `source-fact:global:*`, the read expects
  `tap-recovery-mode:*` / `tap-load-reduction:*` / `poor-sleep:*`), **and** the
  `todayReadinessModifier` fallback also misses because
  `getActiveProgramModifiers(today)` yields **no `source:'readiness_signal'`
  modifier** for a fatigue fact. So the label cannot flip for *any* scope — this
  is the primary athlete-facing defect.
- **Defect 1 (no acknowledgment) — confirmed by code.** The write returns a good
  message, which `handleProgramControlResult` discards via the `!requiresRebuild`
  early-return (`useHomeScreen.ts:1230`).

**On-device note:** the reaudit's "no per-fact witness renders → fact absorbed"
was an *inference*; the fact does persist. The fix's on-device verification must
directly confirm the witness renders and the label flips (not infer from absence).

---

## Landed — parts (a)/(b)/(c), tests-first (2026-07-22)

Suite `src/__tests__/readinessSourceFactOwnershipTests.ts` (`npm run
test:readiness-ownership`, appended to `test:bible`). Faithful-seed harness
(normalized context + real acceptance commit). **6/6 green; `test:bible` exit 0;
§18 ownership scoreboard 12/12 unchanged; `test:weekly-readiness` 14/14.**

- **R1** characterization baseline — a tired-today fatigue fact commits `ok:true`
  and persists (pins the withdrawn Defect 3; no write regression).
- **R2 (part b)** card read-alignment — new pure `src/utils/visibleReadinessState.ts`
  `resolveVisibleReadinessState`, a projection of canonical `temporarySourceFacts`
  (+ preserved legacy recovery-mode path). `HomeScreenV2` `weekReadiness` rewired
  to it; the `tap-*`-id primary match + second-mirror fallback retired for the
  fatigue path. Card now flips off "I'm not 100%".
- **R3 (part a)** unconditional acknowledgment — new pure
  `src/utils/readinessAcknowledgment.ts` `buildReadinessAcknowledgment`; the sheet
  surfaces a success/error banner from `result` and no longer closes in silence
  (retires the `requiresRebuild`-gated feedback for this path).
- **R4 (part c transform)** — new pure `src/utils/lighterDayTrim.ts`
  `applyLighterDayTrim`: Bible §9 `slight` verbatim — main lift byte-identical
  (sets AND weight), accessory volume halved (`ceil(n/2)`, the existing go-lighter
  rule), hard finisher removed, hard conditioning eased, session stays intact.
- **R5 (part c guard)** progression baseline — applying the trim as a
  `dateOverride` leaves `weightOverrides` (the sole baseline channel via
  `buildLastPerformedWeights`) untouched and next week's strength prescription
  byte-identical. The reduced day is planned, not a performance signal.
- **R6 (part c ownership)** — new `src/utils/lighterDayTransaction.ts`
  `applyLighterDayForToday`: reuses the `explicit_load_edit` reversible idiom
  (`captureAcceptedLoadEditLedgerBaseline` → `setManualOverride` →
  `commitExplicitLoadEditLedgerFromBaseline`) so the offer is transaction-owned,
  discloses exactly what changed, and undo (`clearReversibleAdjustment`) restores
  today; the tired-today fact survives the undo. UI: inline opt-in offer in
  `WeekReadinessSheet` after a today-scoped report (accept/decline/undo).

**Retirement ledger:** the legacy `tap-*`-id primary match + `readinessStore`
fallback read are retired *for the fatigue-fact label path* (recovery-mode's
`tap-recovery-mode` path preserved). The generic "visible program could not be
verified" collapse and the standalone readiness transaction were NOT changed —
Defect 3's withdrawal made them code-hygiene, not correctness, deferred.

**Remaining:** on-device replay of the reaudit finding-2 repro (seed
`standard-in-season-week`, iPhone 17 Pro) — confirm the acknowledgment shows, the
card flips, the witness renders, and the inline lighter-day offer applies +
undoes. Not yet run.

---

## On-device replay REVERSES the characterization correction — Defect 3 is REAL (2026-07-22)

Ran the on-device pass (iPhone 17 Pro, iOS 26.3, seed
`standard-in-season-week`, dev bundle carrying this branch). **The write fails on
device**, which reverses the "Characterization correction" above:

- **Part (a) acknowledgment — VALIDATED on device.** Tapping "Just a bit tired
  today" no longer closes in silence; it shows the honest error banner
  (`home-week-readiness-ack-error`): *"Couldn't log that just now — give it
  another go in a moment."* (verbatim `readinessAcknowledgment.ts`, confirming the
  device runs this branch). The unconditional-ack fix does exactly its job.
- **Defect 3 is REAL, not an artifact.** The Metro log shows the fatigue write
  rejected by the §18 final-week gate:
  `Section 18 final-week rejection (pattern_restore_failure:strength_patterns |
  required_minimum_shortfall:conditioning | required_minimum_shortfall:main_strength)`.
  The contextual fatigue fact, composed into the accepted context, perturbs the
  re-evaluated effective-week exposure signature (the fatigue constraint
  limits/blocks max-effort + heavy work), and `assertAcceptedVisibleLedgerEquivalence`
  rejects the commit for a main_strength/conditioning shortfall vs the stored
  ledger. **This is the exact mechanism Defect 3 named.**
- **Why the headless "faithful" seed missed it.** The normalized-context +
  `commitAcceptedStateTransaction` acceptance used in R1/R5/R6 does NOT reproduce
  the device seed's stored exposure-contract ledger, so the fatigue composition
  did not trip the equivalence check in-test. R1's `ok:true` is a **harness
  fidelity gap**, not production truth. The reassessment's Defect-3 withdrawal is
  **rescinded**; the generic "visible program could not be verified" collapse and
  the contextual-fact commit boundary are back in scope.
- **Consequence for parts (b)/(c):** correctly implemented and unit-green, but
  **unreachable on device** while the write is rejected — the card cannot flip and
  the offer is gated on `ok`. They cannot be validated until Defect 3 is fixed.

**STOPPED per instruction (device pass not clean → no merge, no patching in the
merge path).** Next: fix Defect 3 — the contextual fatigue fact must commit on a
boundary that does not re-run the whole-week §18 exposure-equivalence gate (Q4/Q5:
a contextual signal is not a program mutation). Then re-run the on-device pass to
validate (a)+(b)+(c) end-to-end. The R1/R5/R6 harness must be upgraded to load the
real device exposure ledger so it reproduces this rejection before the fix.

---

## Defect 3 fix — part 1 landed (inert), part 2 STILL REQUIRED; device unverified (2026-07-22)

Product decision (Sam): **minor-tier (severity < 4) fatigue/readiness facts are
RECORD-ONLY** — witness/card state, zero derivation effect; program change strictly
opt-in via the lighter-day offer. Severe tiers (cooked=8, sore 5-7, repeated poor
sleep=5) keep their existing auto-protect behaviour **unchanged this branch**
(disclosed + reversible as today). Injury rides a separate owned channel
(`composeInjuryCompatibility` → `buildInjuryConstraint`), unaffected. Post-v1
product review logged: whether severe reports become ask-first with a pre-selected
recommendation, informed by Journal fatigue data.

**Part 1 — LANDED (inert fact).** `globalConstraint` (`temporarySourceFact.ts`)
returns record-only (no `ActiveFatigueConstraint`) when `severity < 4`, so a slight
"tired today" / single-night poor-sleep fact composes nothing into
`activeConstraints`; the `readinessProjection` witness is untouched, so the card
still reflects it. Pinned by **R7** (compose seam: minor-tier composes no
constraint, witness preserved, severe unchanged) and **R8** (a committed minor-tier
fact leaves the resolved week byte-identical). `test:bible` green;
`test:temporary-source-facts` 45/45; §18 ownership 12/12; readiness suite 8/8.

**Part 2 — STILL REQUIRED (non-mutation boundary).** Part 1 alone does NOT resolve
the device rejection. The device fatigue commit is rejected by the WHOLE-WEEK §18
gateway (`validateEffectiveComposition` → `canonicaliseAcceptedStateCandidate` →
`requireSection18AcceptedWeek`) with the signature
`pattern_restore_failure:strength_patterns ×4 | required_minimum_shortfall:{conditioning,main_strength}`
— the **same gateway-repair-search fragility the §18 stage-2 diagnosis found on
`standard-in-season-week` with NO fatigue at all**. So the commit re-runs a
whole-week §18 mutation gate that a *contextual* fact should never trigger. Per the
Q4/Q5 ownership and Sam's directive, the fact must commit on a boundary that does
not re-run that gate. **Not yet implemented.**

**Verification impasse (documented honestly).**
- On-device (post part-1, iPhone 17 Pro): the sheet still shows the honest error
  banner (part (a) working) — the write is still `ok:false`. Could not capture the
  exact post-fix reason: the device has two Metro instances and the file log
  capture went dead after relaunch; the Maestro driver was crashing mid-flow.
- Headless CANNOT reproduce the rejection: `canonicaliseAcceptedStateCandidate` on
  the device-exact-installed `standard-in-season-week` accepted week PASSES §18
  re-validation both with and without the slight fatigue constraint, with and
  without the game day marked. The device-exact durable commit instead trips a
  `new Date()`-driven `accepted_state_rollback_mismatch` (profile-snapshot
  `capturedAt`: real-time vs epoch-0) that masks the real path. The standard seed
  simply does not fail §18 re-validation in-harness where the device does.

**Recommended next steps (for approval):**
1. Restore a clean single-Metro device environment (one `expo start` logging to a
   file) so the exact post-part-1 rejection reason is capturable, confirming part 2
   is the cause vs a bundle-staleness artifact; AND
2. Implement part 2 tests-first against a **constructed** §18-violating accepted
   week (since the standard seed passes re-validation in-harness): a contextual
   (inert) fact commit must succeed even when the whole-week §18 gate would reject
   the week — proving it commits off the mutation gate. Then re-run the full
   on-device pass before any merge.

---

## Part 2 LANDED in-harness + clock determinism fix (2026-07-22)

Sam approved (a): implement part 2 now, tests-first; the invariant is the ownership
boundary itself — *a contextual/inert fact commits off the whole-week §18 mutation
gate, full stop* — justified under any diagnosis (the captured device error already
shows the whole-week gateway firing on a fact commit with fatigue-independent repair
failures). **Not merged — device pass remains the gate; Sam runs it.**

**Part 2 — the non-mutation boundary (`commitTemporarySourceFactSet`).** A fact
commit whose composition does NOT change the exposure-affecting (source-fact)
constraint set is **INERT**: it changes no visible program, so it skips BOTH the
explicit whole-week §18 gate (`validateEffectiveComposition`) AND the commit-time
week re-validation (`commitAcceptedStateTransaction({ validateWeekStarts: [] })`).
Detection: `sourceFactConstraintSignature(before) === (after)` over constraints
matched by `isTemporarySourceFactConstraint`. Deriving facts (severe fatigue add/
remove, injury — all source-fact-owned constraints) change the signature → stay
gated. This removes a whole-week program-mutation gate from a record-only signal —
deleting a boundary, not adding a guard.

Pinned by:
- **R9** — an inert fact commits even when whole-week §18 validation would reject
  (a throwing `beforeEffectiveValidation` hook stands in for the gate rejecting);
  a severe (cooked) fact with the same hook stays `safely_rejected`.
- **R10** — an injury constraint is `isTemporarySourceFactConstraint`, so an injury
  delta always changes the signature and can never be misclassified as inert; the
  injury channel is unaffected.

**Clock determinism fix (`acceptedStateTransaction.ts`).** The accepted-profile
snapshot used raw `new Date()` (lines 455/462) while the rest of the accepted-state
path uses the controllable `appDateNow()` (DevE2E clock, else `new Date()`). Under
a frozen test clock this drift produced a false `accepted_state_rollback_mismatch`
(profile-snapshot `capturedAt`: real-time vs the rollback-captured pre-state),
masking the real path in every device-exact repro. Both now use `appDateNow()`.
Verified: with a frozen clock the install-side `capturedAt` is deterministic. (A
residual epoch-0 on the durable *restore* side of the device-exact repro is a
separate localStorage-mock persistence-fidelity artifact — NOT `new Date()`-driven
— and does not affect the R1-style suite seed, which carries no profile snapshot.)

**Gates:** readiness ownership **10/10** (R1–R10); `test:bible` exit 0;
`test:temporary-source-facts` 45/45; `test:accepted-state-transactions`
25/25+10/10+10/10; `test:weekly-readiness` 14/14; §18 ownership 12/12; typecheck
clean on touched files.

**STOPPED before merge, per Sam.** Next: Sam kills the interactive Expo, we run one
clean `expo start` logging to a file, re-run the device flow (tired-today →
success ack + card flip + witness + lighter-day offer applies/undoes), and capture
the exact post-fix result. Nothing merges on harness evidence alone.
