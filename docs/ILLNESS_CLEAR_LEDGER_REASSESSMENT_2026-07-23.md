# Illness-Clear Ledger Reassessment — 2026-07-23

**Status:** architecture reassessment required by `CLAUDE.md` (Coach Architecture
Escalation Rule) and `AGENTS.md`. **Design document only — no fix here, and none may be
written until this is approved.** Trigger: finding #4 in
`docs/audits/UNIT02_DOOR_ROUTING_REPORT_2026-07-23.md` — the readiness-card **clear** of a
severe illness reverts the week but leaves the illness fact **active** on device. This is
the textbook escalation case ("the intent is understood correctly but a later layer blocks
it") and the **third recurrence of the seed-fidelity class** (§5), so it stops here for an
ownership reassessment rather than a guess-patch.

All `file:line` at branch `diagnose/move-occupied-content-loss` HEAD (89d4536).

---

## IMPLEMENTATION UPDATE (2026-07-23, post-approval) — read this first; it corrects the headline

Reviewer approved Option (a)-scoping + Q6 (surgical, typed ownership; §3). Building it
tests-first **corrected the headline**: the resolve-time failure is **not** the ledger-
equivalence guard the 0.2 report cited, and Option (a)'s restStress restamp is a **verified
no-op** on the reproduced case. What actually ships and why:

- **Verified mechanism (faithful repro `illnessClearGameWeekResolveTests.ts`, 8/8 green
  post-fix).** On the game week the resolve's re-canonicalisation drifts the base by
  **nulling `todayWorkout`** (+ a `hasCombinedConditioning` normalisation), tripping
  `verifyCandidate`'s base-immutability guard → `accepted_composition_base_changed_by_
  temporary_fact`; the cascade revert had already committed → **half-apply** (week reverted,
  fact active). It is **not** the `assertAcceptedVisibleLedgerEquivalence` `activeRecovery/
  moderateDays` divergence the report named (that came from the non-faithful commit-time
  ad-hoc repro).
- **G1 is already GREEN.** Invariant G1 (authored restStress == visible restStress on the
  illness game week) passes *before* any change — so **Option (a) (restamp restStress post-
  resolve) is a no-op for the reproduced fresh case** and was **NOT built**. It targets only
  the *chained/ledger-mismatch* signature, which was never reproduced (deferred; trigger
  below).
- **The fix that ships = Q6, surgically scoped by TYPED OWNERSHIP.** In
  `temporarySourceFactTransaction.ts`, a REMOVE (`resolve`/`expire`/`supersede`) of a fact
  that OWNS a scoped-regen `deriving_source_fact` reversible adjustment (matched by
  `sourceFactId`, **no fact-kind strings**) is a stored-prior-state restore → committed
  base-preserving (`preserveExactAcceptedWorkouts: true`, `validateEffectiveComposition`
  skipped), symmetric with the scoped-regen ADD. The re-canonicalising branch stays for
  projection-delivered facts (equipment/schedule/time_cap). Δ = +28/−6 lines, one file.
- **Regression pinned, not just avoided (rider).** `F5` proves the ownership generalises to
  severe FATIGUE (cooked) — not an illness special-case. `P1` proves a projection-delivered
  (schedule/time_cap) fact is **not** captured by the base-preserve even with an illness
  scoped-regen adjustment present (its sourceFactId owns none; it re-projects, never a silent
  ok-no-op). Fact-path gates unchanged: `deriving-device-commit` 9/9, `readiness-ownership`
  19/19, `illness-recovery-mode` 5/5, `section18-ownership` 12/12, `accepted-state-
  transactions` 25/10/10, `section18-gateway` 91/91, `move-occupied` 2/2.
- **G2 reframed** (rider) to "resolving an overlay-owned fact removal leaves the authored
  week surfaces byte-identical" — Q6 satisfies it; the ledger legitimately retains the
  cleared adjustment as history.
- **Canonical device-exact fixture** `src/__tests__/deviceExactSeed.ts` (rider): bundles the
  fidelity dimensions (real composition base + witnessed game mark) with a **witness self-
  check** that throws if a dimension is dropped, plus a one-time generation-cache prime.
  Release-faithful (`__DEV__ = false`; see the deferral on `__DEV__`/frozen-clock below).

### Logged debt (deferred; do NOT drop — each with its trigger)

1. **Option (a) restStress-restamp — deferred.** No-op on every reproduced case (G1 green).
   **Trigger → new diagnosis unit:** if the ledger-equivalence signature `persisted
   activeRecovery/moderateDays ≠ visible` ever appears on device OR in a faithful repro (the
   *chained* case: a pre-existing overlay survives the cascade revert), STOP and open a new
   unit — do NOT widen this fix in place (rider).
2. **`todayWorkout→null` re-canonicalise non-idempotence — deferred.** A real latent
   generation/canonicalise bug (Sam-gated) that Q6 side-steps rather than fixes.
   **Trigger:** any *other* path that re-canonicalises a game week (block rollover, phase
   shift, game-day rebuild, profile change) surfacing a base drift or ledger reject.
3. **`semantic_projection_changed_after_persistence` on the FIRST game-week scoped-regen
   commit — headless artifact.** The first generation in a process is "cold"; the fixture's
   one-time prime resolves it (device generation is always warm; the illness commit is
   device-verified). **Trigger:** if it reproduces on device.
4. **D-suite fidelity migration — deferred.** Restoring the game mark to
   `derivingSourceFactDeviceCommitTests.ts` is confounded by the headless generation
   artifacts above (cold-cache + variation-rotation): the prime that fixes D1 shifts
   exercise-variation state and breaks D6's *content-specific* visible-optional assertion
   (finding #3). Game-week fidelity for finding #4 is instead carried by
   `illnessClearGameWeekResolveTests.ts` + the canonical fixture. **Finding #3's visible-
   optional check on a game week is confounded headlessly and belongs to the DEVICE merge-
   gate pass** (device generation is warm; device is arbiter). **Trigger:** device merge-gate
   pass — if the bed-ridden week does not render sessions visibly optional on a game week on
   device, that is a live finding-#3 defect → STOP.
5. **Frozen-clock / `__DEV__ = true` rejected for the fixture.** It would defeat the QA_RUNBOOK
   epoch-0 mask, but `__DEV__ = true` diverges from Release (it changed the visible resolver),
   so the fixture stays `__DEV__ = false`; the epoch-0 mask remains a known limitation on the
   durable ROLLBACK path only, and assertions that can hit it (P1) tolerate it.

The sections below are the AS-APPROVED reassessment; §1's "spine" and §3's option (a)/(b)
framing are preserved for the record but are superseded by this update where they differ.

---

## 0. Trigger, faithful repro, and the corrected rejection signature

### What breaks (device)
After tapping **Sick → Properly sick** (severe illness → `illness_recovery` week) and then
**clearing** it from the readiness card: the week visibly reverts (the adjustment-restored
toast fires) but the illness fact stays active ("Recovery mode active" coach note + the
`readiness-active-…illness…` witness persist). The clear is **half-applied**.

### The corrected rejection signature (this is not what the 0.2 report assumed)
The 0.2 report attributed the failure to `assertAcceptedVisibleLedgerEquivalence` throwing
`"persisted and visible ledgers differ"` with `activeRecovery:1/moderateDays:1` (persisted)
vs `activeRecovery:2/moderateDays:0` (visible). Those **counts are real** (they are the
illness vs. healthy week signatures — confirmed step-by-step below), but that *guard* is not
what fires on the faithful resolve-time path. The report itself flagged that its capture came
from a repro that **threw at commit-time, "a different point than the device resolve-failure"**
(UNIT02 report, lines 63-68) — i.e. the cited signature came from a non-faithful harness.

A faithful headless reproduction (built for this reassessment; see §0.1) shows the
resolve-time failure is `verifyCandidate` rejecting with
**`accepted_composition_base_changed_by_temporary_fact`** (route
`coach_mutation_semantic_verification_failed`), captured via temporary `LFA_DIAG`
instrumentation (reverted; product code is byte-clean). Both the ledger-equivalence guard and
the base-immutability guard are **downstream of the same root cause** (§1): a **game week**'s
re-canonicalisation is non-idempotent, because §18 achieved-counts are baked *before*
`resolveWeekWithConditioning`'s game-proximity re-tiering and re-derived *after* it. Which
guard trips first depends only on ordering; the count divergence the report named is the
observable fingerprint of the same divergence.

### 0.1 Faithful repro (requirement a) — RED, standalone, NOT in `test:bible`
`src/__tests__/illnessClearGameWeekResolveTests.ts`. Device-exact base (R11 pattern:
`seedOnboardingProgram` + `commitAcceptedStateTransaction`, `preserveExactAcceptedWorkouts`),
two seeds identical except the Saturday game mark:

- **C1 control (no game)** — `set_illness_status severe` then `clear_fatigue_status`: the fact
  resolves (`activeFactCount === 0`). **GREEN.** This is exactly the existing D-suite path
  (`derivingSourceFactDeviceCommitTests.ts` D3/D8), and it is green for the wrong reason.
- **F4 device-exact (game week)** — same steps + the `standard-in-season-week` Saturday game
  (`devE2ESeedRegistry.ts:729`, installed the way the move harness does at
  `athleteMoveOccupiedContentLossTests.ts:139-148`): the illness commit lands, but after the
  clear the fact is **still active**. **RED** — the faithful reproduction of finding #4.

Per-week counts observed across the F4 run (instrumented): seed `ar:2 mod:0` == visible
`ar:2 mod:0`; after illness commit `illness_recovery` `ar:1 mod:1` == visible `ar:1 mod:1`
(the commit's own equivalence PASSES); the clear's resolve is then rejected at
`verifyCandidate` (base drift on the base **microcycle** surfaces — overlays empty on both
sides), the cascade-revert having already committed. Run:
`TZ=Australia/Melbourne npx sucrase-node src/__tests__/illnessClearGameWeekResolveTests.ts`.

**Why the existing harness lied (fidelity, not logic).** `derivingSourceFactDeviceCommitTests.ts`
resets `markedDays: {}` and stubs `setGameDay: () => undefined` (lines 96, 128), silently
dropping the seed's witnessed Saturday game. Without the fixture there is no game-proximity
re-tiering → base re-canonicalisation is idempotent → the clear succeeds headlessly while it
fails on device. The move-occupied harness already re-learned that this exact game mark is
load-bearing ("without the real composition base OR the explicit game mark the loss does not
reproduce", `athleteMoveOccupiedContentLossTests.ts:95-98`); the deriving suite never
inherited it. That non-propagation is the systemic defect in §5.

---

## 1. Root cause (the spine)

**Two derivations of the same week's §18 achieved-counts run over two different workout sets,
and a game week makes them disagree. The illness clear is a two-commit sequence whose second
commit (the fact-resolve) re-canonicalises the base through that non-idempotent path and is
rejected, after the first commit (the cascade revert) has already reverted the week —
so the week reverts and the fact stays active.**

Three facts compose the bug:

1. **The count is derived twice, from two different workout sets.**
   - *Authoring pass*: the illness_recovery `exposureContractV2` is generated
     (`commitDerivingSourceFactScopedRegen`, `temporarySourceFactTransaction.ts:367-385`) and
     its `restStress.achievedActiveRecoveryCount` / `achievedModerateDayCount` are stamped by
     `assessContract` (`section18EffectiveWeekEvaluator.ts:596-599`) over the
     generation/safety-finalised workouts — which have **not** been through
     `resolveWeekWithConditioning`.
   - *Visible pass*: `rebaseAcceptedEffectiveWeek` reads the **stored** contract
     (`acceptedEffectiveWeek.ts:98`), runs `resolveFinalVisibleSection18Week` →
     `resolveWeekWithConditioning` (mode-aware game-proximity re-tiering,
     `sessionResolver.ts:623-707`: G+1→recovery, G-2→moderate…), **then** re-evaluates with
     `buildLedger` (`acceptedEffectiveWeek.ts:134-146`).
   - `buildLedger` is **mode-blind** — `Section18EffectiveWeekInput` has no mode field
     (`section18EffectiveWeekEvaluator.ts:143-149`); a day is `moderate` vs `activeRecovery`
     purely from the per-session tier/evidence (branches at `:367-371` and `:409-414`). On a
     game week the visible re-tier moves one day from `moderate`→`recovery`, so the two passes
     disagree (`ar:1 mod:1` authoring vs `ar:2 mod:0` visible). On a non-game week they agree,
     which is why the control is green.

2. **The clear's resolve routes through the re-canonicalising deriving path — the scoped-regen
   fix only covered the ADD, not the REMOVE.** `clear_fatigue_status`
   (`programControlActions.ts:1301-1361`) resolves via `transactTemporarySourceFact('resolve')`
   → `commitTemporarySourceFactSet`. Removing a fact is non-inert, but `scopedRegen` fires
   **only when a NEW fatigue id appears** (`temporarySourceFactTransaction.ts:521-530`), which
   a *removal* never does. So the resolve takes the non-inert / non-scopedRegen branch
   (`:566-589`): `commitAcceptedStateTransaction` with **`preserveExactAcceptedWorkouts:
   undefined`** and `skipConstraintProjection: true`, which **re-canonicalises** the base over
   `validateWeekStarts: horizon.weeks` (the game week is always in horizon). Re-canonicalising
   the game week bakes the re-tiered workouts into `acceptedCompositionBase.surfaces`, drifting
   its fingerprint; `verifyCandidate` rejects it as
   `accepted_composition_base_changed_by_temporary_fact` (`:609-616`). The scoped-regen
   authoring commit avoids this by using `preserveExactAcceptedWorkouts: true` (`:456`); the
   resolve path was never given the same treatment.

3. **The two-commit ordering makes the failure a half-apply, not a clean rollback.** The clear
   first cascade-reverts (`clearReversibleAdjustment`, `programControlActions.ts:1332-1341`) —
   a wholesale overlay delete for a fresh illness (`weekOverlay.before === null`, confirmed in
   the repro; `reversibleAdjustmentTransaction.ts:437-527`) that **commits successfully** — and
   only then resolves the fact, which **rolls back**. Net: week reverted, fact still active.
   No repair path can help here: `reverseOwnedReductions` reverses strength/conditioning/sprint
   frequencies only and **never** `restStress.achieved*` counts
   (`reversibleAdjustmentTransaction.ts:557-629`), which is precisely the dimension
   illness_recovery moves.

The semantic layer is correct throughout (the mode is derived once and preserved on the
contract identity via `postGenerationConstraintValidation.ts:615-621`). The defect is that the
**achieved-count is authored from a pre-re-tier workout set and validated against a post-re-tier
one**, and the clear path re-canonicalises through that gap instead of preserving the base.

---

## 2. The seven required questions

### Q1 — What is the current source of truth?
The **authored accepted week** (composition base surfaces + the fact overlay), with the §18
`exposureContractV2` — including its `restStress.achieved*` counts — **baked at authoring**
(Stage-1 settled law: bake at authoring, resolver is pure projection). The visible week is a
projection produced by `rebaseAcceptedEffectiveWeek` → `resolveWeekWithConditioning` →
`buildLedger`.

### Q2 — How many representations of the derived week mode / the count exist?
The **mode** has one representation (`contract.identity.mode`, minted once at
`illnessRecoveryWeekMode.ts:24` / `generationConstraints.ts:124-130`, preserved on
re-derivation). The **count** has **two**: (a) the stamped `restStress.achieved*` on the
authored contract (from `assessContract` over generation/safety-finalised workouts), and (b)
the count `buildLedger` re-derives over the `resolveWeekWithConditioning`-re-tiered visible
workouts. These are two derivations of the same quantity over two different workout sets. They
are forced equal at authoring only when nothing re-tiers (or, for pinned weeks, by the fixpoint
loop at `temporarySourceFactTransaction.ts:401-425 `that adopts the visible contract) — never
guaranteed equal by construction.

**Direct answer to the reassessment's question:** the persisted and visible ledgers count
`activeRecovery`/`moderateDays` differently for an `illness_recovery` game week because the
count is derived twice — once before and once after `resolveWeekWithConditioning`'s
game-proximity re-tiering — and `buildLedger` classifies days purely from the (re-tiered)
per-session tier, not from the mode. It is **not** a lost-mode bug in the evaluator; the mode is
preserved. It is a **two-representations-of-the-count** bug.

### Q3 — Where can the count / base be reinterpreted?
- At every read: `resolveWeekWithConditioning` re-tiers by game proximity
  (`sessionResolver.ts:623-707`), which can move a day between `moderate` and `recovery` after
  the authored contract was stamped.
- At the clear's resolve: the non-scopedRegen deriving branch
  (`temporarySourceFactTransaction.ts:566-589`) re-canonicalises the base — the sole producer of
  the base-surfaces drift that `verifyCandidate` rejects.

### Q4 — Which layer should own the count?
**The single projection owner (`resolveWeekWithConditioning` / `resolveFinalVisibleSection18Week`)
should be the one place the achieved-counts are computed, and the authored contract's
`restStress.achieved*` must be stamped from *that* resolved-visible workout set** — the same one
the read pass later evaluates. Today authoring stamps from a pre-re-tier set and the read stamps
from a post-re-tier set, so the "visible == accepted" invariant can never hold for a week whose
proximity re-tiering is non-trivial. Owning the count in one place (post-resolve) makes authoring
and read agree by construction and makes re-canonicalisation idempotent. (This is an **ownership**
statement; the two mechanical directions that could implement it are weighed in §3 without
pre-committing.)

### Q5 — What simpler architecture removes representations instead of adding guards?
Collapse the count to **one derivation**: the authored contract carries the counts computed by
the *visible* resolver, not by a separate pre-re-tier evaluate pass. Then (a) authoring and read
agree, so `assertAcceptedVisibleLedgerEquivalence` holds without special cases; (b)
re-canonicalising a game week is idempotent, so the resolve's base-immutability check passes; (c)
no repair path needs to learn `restStress` (the frequency-only `reverseOwnedReductions` gap
becomes moot). This is strictly fewer representations than today, per the escalation rule. **Do
NOT** "fix" this by relaxing `verifyCandidate` for the resolve, nor by widening
`reverseOwnedReductions` to patch `restStress` counts — both add guards around the duplicated
representation instead of removing it.

### Q6 — Which legacy paths should be bypassed or retired?
- The **resolve/remove branch's re-canonicalisation** (`temporarySourceFactTransaction.ts:566-589`,
  `preserveExactAcceptedWorkouts: undefined`): removing a deriving fact should not silently
  re-author the base of an unrelated game week. Either it preserves the base
  (`preserveExactAcceptedWorkouts: true`, symmetric with the scoped-regen ADD at `:456`) **or** it
  routes through an explicit authoring transaction like the ADD does — not the incidental
  re-canonicalising path.
- The **assumption that authoring-time and read-time §18 evaluation see the same workouts**. They
  do not, once `resolveWeekWithConditioning` re-tiers; the achieved-count must be owned on one side
  of that boundary.

### Q7 — What tests prove the new ownership boundary?
See §4. Load-bearing: F4 (the faithful game-week clear) goes GREEN; the control C1 stays GREEN; a
new invariant that **authoring and visible §18 signatures are byte-equal on a game week**
(pinning Q4/Q5 directly, so the class cannot regress on any re-tiered week); and idempotence of a
no-op deriving re-canonicalise on a game week.

---

## 3. Options weighed (do NOT pre-commit — Sam/review decides)

The 0.2 report floated two directions; neither is adopted here. Both are downstream of Q4.

- **(a) Own the count post-resolve (recommend for review).** Stamp the authored
  `restStress.achieved*` from the `resolveWeekWithConditioning`-resolved visible workouts, so
  authoring == read by construction. Removes a representation (Q5); fixes the whole re-tiered-week
  class (not just illness, not just clear), including the latent risk on any game week. Cost: it
  touches the §18 authoring/finaliser boundary (Sam-gated territory) and must be proven not to
  perturb non-game weeks (D7-style guard).
- **(b) Make the clear's resolve base-preserving.** Give the remove/resolve branch
  `preserveExactAcceptedWorkouts: true` (symmetric with the scoped-regen ADD) so it stops
  re-canonicalising the base. Smaller and local. Cost: it removes the *symptom* on the clear but
  leaves the **two-count divergence latent** — any other path that re-canonicalises a game week
  (block rollover, phase shift, game-day rebuild, profile change) can still surface it, and the
  `assertAcceptedVisibleLedgerEquivalence` guard (the report's original signature) remains
  reachable. It is a narrower ownership move than (a).
- **(c) Relax a guard** (widen `reverseOwnedReductions` to restStress, or exempt the resolve from
  base-immutability). **Reject.** This is the "just add a guard / one more compatibility branch"
  anti-pattern; it keeps the duplicated representation and reopens the base-immutability hole the
  deriving reassessment closed.

**Recommendation to frame for Sam:** (a) is the doctrine-aligned single-owner fix; (b) is the
cheap unblock that leaves debt. The choice is his (programming-adjacent, L7). This doc does not
build either.

---

## 4. Proposed invariants (tests-first — RED first, then STOP)

`illnessClearGameWeekResolveTests.ts` (device-exact base). C1 + F4 written; C1 GREEN, F4 RED.
Proposed additions (author on approval, before any fix):

1. **F4 clear resolves on a game week** *(written, RED)* — after `clear_fatigue_status` on the
   game-week seed, `activeFactCount === 0` and the week is restored.
2. **G1 authoring == visible §18 signature on a game week** — the authored illness_recovery
   `exposureContractV2` restStress signature equals `rebaseAcceptedEffectiveWeek(...).evaluation`
   restStress on a game week (pins Q4 directly; fails today for either fix that leaves the count
   duplicated).
3. **G2 re-canonicalise idempotence** — a no-op deriving re-canonicalise of a game week does not
   drift `acceptedCompositionBase.surfaces` (pins Q6).
4. **G3 cascade + resolve atomicity** — if the resolve is refused, the cascade revert does not
   commit alone (no half-apply); the clear is all-or-nothing.
5. **C1 control** *(written, GREEN)* — non-game clear still resolves (monotonic).
6. **D-suite fidelity** — the deriving-device-commit `seedDeviceExact` gains the witnessed game
   mark (or defers to the shared fixture in §5) so D3/D8 exercise the real week, not a
   fixture-stripped one.

Gate on approval: F4 + G1-G3 green; `test:deriving-device-commit` 9/9 (with the fidelity fix,
still green); `test:section18-ownership` 12/12 (monotonic); `test:readiness-ownership` green;
`test:illness-recovery-mode` green; `test:bible` exit 0; tsc clean. **Then** fold the game-week
clear into `test:bible`, **then** re-run the bed-ridden device pass (commit → reduced+optional
week → clear → week restored AND fact cleared, on the game week Sam's seed actually has).

---

## 5. Systemic: the third seed-fidelity recurrence — stop harnesses lying

This is the third time a "device-exact" harness passed while the device failed, each time from a
**different missing fidelity dimension**:

1. **Null composition base** (M6 / R1-style `seed()`): the whole source-fact class was invisible.
   Fixed piecemeal by R11 (real base).
2. **Restore-side epoch-0 `capturedAt`** (`QA_RUNBOOK.md:67-82`): masks the real rejection on the
   rollback path.
3. **Dropped fixture / game mark** (this finding): the device-exact seed resets `markedDays: {}`
   and stubs `setGameDay`, so the game-proximity re-tiering that *is* the trigger never occurs.

The pattern is not "we forgot one thing." It is that **"device-exact seed" is re-implemented by
copy-paste per suite** (`seedDeviceExact` exists independently in
`derivingSourceFactDeviceCommitTests.ts`, `readinessSourceFactOwnershipTests.ts`,
`athleteMoveOccupiedContentLossTests.ts`), and each copy captures only the fidelity dimensions its
author happened to need. The move-occupied author discovered the game mark was load-bearing and
added it **to their copy only**; the deriving copy never inherited it. Every new repro therefore
starts fidelity-partial and re-discovers a missing dimension the hard way (device red, harness
green).

**Systemic change to propose (design only — not built here):** one canonical device-exact
install fixture that reproduces the **dev-reset coordinator's full install** — composition base
**and** the seed's *witnessed* calendar marks/fixtures (`witnessesForDevE2ESeed`) **and** the
frozen clock — the same state the real device boots into, shared by every device-exact suite. Plus
a **fidelity self-check**: the fixture asserts the installed accepted state matches the seed's
witnesses (e.g. the Saturday game is present in `acceptedMaterialContext.markedDays`) and fails
loudly if any dimension is dropped. A harness that cannot silently omit the game mark cannot lie
this way again. (`src/dev/e2e/` is frozen per QA_RUNBOOK, so this is a `src/__tests__` shared
helper, not a dev-harness change — to be scoped with the fix, gated by Sam.)

---

## 6. NOT COVERED (L2)

- **The fix.** Diagnosed only. No implementation; §3 options are un-chosen and un-built.
- **The chained trigger.** This diagnosis covers the *fresh* severe-illness clear
  (`weekOverlay.before === null`, confirmed). The alternative path agent-flagged during tracing —
  a **pre-existing overlay** on the week making `delta.before` non-null, which would surface the
  ledger-equivalence guard (`assertAcceptedVisibleLedgerEquivalence`) rather than the base guard —
  was NOT reproduced. It is consistent with the report's original ledger numbers and should be
  probed if the chosen fix does not also cover it. `athleteMoveOccupiedContentLossTests`' own
  chain-required trigger is a separate finding.
- **Cooked (severe fatigue) clear.** The class is shared (fatigue also derives via scoped-regen),
  but only the illness clear was reproduced. The fatigue clear on a game week is untested.
- **Device confirmation of the exact internal reason.** The `accepted_composition_base_changed_by_
  temporary_fact` reason is proven in the *faithful headless* repro; it was not re-captured on the
  physical device (the device shows the observable half-apply, which the repro matches exactly).
  L10 device acceptance of any fix remains required.
- **Feeling-flat / sniffle / injury tiers, and non-game weeks other than the control.** Out of
  scope; only the severe-illness game-week clear and its no-game control were driven.
- **Full `test:bible` / project gates re-run for the fix.** Only `test:deriving-device-commit`
  (9/9 green, unchanged), the new `illnessClearGameWeekResolveTests` (C1 green / F4 red as
  designed), and `npm run typecheck` (exit 0) were run for this diagnosis. The new suite is
  standalone and intentionally NOT wired into `test:bible` while red.
- **The systemic fixture (§5).** Proposed, not built; `src/dev/e2e/` frozen per QA_RUNBOOK.

**No fix, no harness rewrite, no guard until this reassessment is reviewed and approved.**
