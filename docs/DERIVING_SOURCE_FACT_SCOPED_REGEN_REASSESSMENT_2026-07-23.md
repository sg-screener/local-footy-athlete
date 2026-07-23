# Deriving Source-Fact → Scoped-Regen Reassessment (CORRECTED) — 2026-07-23

**Status:** architecture reassessment (`CLAUDE.md` escalation). **Design only — no
fix, none may be written until approved.**

**Supersedes** the *proposed fix* in
`docs/DERIVING_SOURCE_FACT_DEVICE_COMMIT_REASSESSMENT_2026-07-23.md` (that doc's
"Option B — base-preserving deriving commit" was built on a wrong mechanism model and
is **withdrawn**). The faithful repro/harness stands and is **strengthened** here. The
bed-ridden device smoke that triggered this remains the trigger of record.

All `file:line` at branch `diagnose/move-occupied-content-loss` HEAD.

---

## 0. The correction (why the first cut was wrong)

The first diagnosis said: "the reduction lives in a constraint overlay applied at
projection; the base stays clean; fix = route deriving facts through the
base-preserving path." Building it tests-first proved every clause false:

1. **No projection applies the source-fact reduction.** `rebaseAcceptedEffectiveWeek`
   reads the **stored** contract (`acceptedEffectiveWeek.ts:98`); `resolveWeek­
   WithConditioning` reads the **stored** contract (`sessionResolver.ts:1432-1433`)
   and takes readiness from **`deriveProfileReadiness(onboardingData)`**
   (`coachWeekDiff.ts:163`) — *not* from the active fatigue/illness constraint.
   Neither re-derives the mode.
2. **The mode is generation-only.** `illness_recovery` is minted solely at
   `generationConstraints.ts:124-130` (`deriveIllnessRecoveryWeekMode` →
   `weekMode`) → `buildWeeklyExposureContract(weekModeOverride)` in
   `coachingEngine.ts:1049`. The source-fact commit never runs generation.
3. **So the deriving commit is a SILENT NO-OP even when it "succeeds."** Empirically,
   on the R1-style seed a `set_fatigue_status:cooked` commit returns `ok:true,
   changedProgram:true` yet leaves **both** the accepted effective week **and** the
   visible resolver **byte-identical `in_season_game_week`** (same days, tiers,
   intensities). Base-preserving it would have made the *device* commit succeed — as
   the same silent no-op. That is why Option B is withdrawn: it fixes the reject and
   ships a lie ("nothing's required this week" over an untouched full-load week).

The device rejection was only the surface symptom (see §1).

### Honest record — what `cooked_week` (severe fatigue "auto-protect") ever delivered
**Nothing visible, through the tap door.** A severe-fatigue commit records the fact +
a `coachUpdatesStore` fatigue constraint (readiness *witness* flips), but because the
read-resolver's readiness is profile-derived and the mode is generation-only, the
prescribed week does not change until a full regeneration is otherwise triggered
(phase shift, block rollover, game-day rebuild). This is the generation-vs-projection
duplication the §18 reassessment already flagged. Group B item 2's device passes
covered only the **minor/inert** tier + lighter-day offer; the **severe tiers were
never device-verified**, which is how this shipped unseen.

### Faithful repro (requirement a) — strengthened, still RED
`src/__tests__/derivingSourceFactDeviceCommitTests.ts` (device-exact base; standalone,
**not in `test:bible`**). Now pins the CORRECT behaviour, so a no-op fix cannot pass:
- **D1** severe illness → the accepted week is re-authored `illness_recovery`.
- **D2** severe fatigue → the accepted week is actually reduced (≠ before).
- **D3** clear the fact → accepted week restored byte-identical (non-vacuous: requires
  the commit to have reduced first).
All three RED. The runbook epoch-0 `capturedAt` mask is downstream of the reject and
does not gate these outcome assertions. Run: `npm run test:deriving-device-commit`.

---

## 1. Root cause (the corrected spine)

**A severe (deriving) readiness fact is an AUTHORING event — it changes what the
athlete is prescribed — but it is routed through the source-fact OVERLAY path, which
is (correctly) forbidden from re-authoring the base. So it can neither bake the mode
(blocked) nor project it (the resolvers don't derive modes). The reduction has no
home.**

- The deriving branch of `commitTemporarySourceFactSet` dispatches with
  `preserveExactAcceptedWorkouts: undefined` + `skipConstraintProjection: true`
  (`temporarySourceFactTransaction.ts:335-337`). With `skipConstraintProjection` the
  canonicalisation applies **no** constraints — it merely re-canonicalises (normalises)
  the workouts. Diagnosed field-diff: `currentMicrocycle.workouts` change but the
  contract mode stays `in_season_game_week` (no reduction baked).
- That normalisation drift trips the base-immutability guard on a real composition
  base: `verifyCandidate` → `accepted_composition_base_changed_by_temporary_fact`
  (`temporarySourceFactTransaction.ts:353-354`). On a null base it's unguarded → the
  no-op "succeeds."
- The mode that WOULD reduce the week exists only in generation and is never invoked.

The semantic layer (`deriveIllnessRecoveryWeekMode`) is correct; the **delivery** layer
between the fact and the athlete is missing.

---

## 2. The seven required questions

### Q1 — Source of truth?
The **authored accepted week** (composition base), with loads and derived
mode/contract **baked at authoring** (Stage-1 settled law), plus the **fact overlay**
in context. Resolvers are **pure projection** of the stored contract — by design, they
re-derive nothing.

### Q2 — Representations of the report?
Fact → constraint → *(missing: authored reduced week)* → projection. The bug is the
missing middle: the reduction must be an **authored week** (baked), but the deriving
commit produces neither a re-authored base nor a projected reduction.

### Q3 — Where is it reinterpreted / lost?
Between generation and the commit/read paths. The deriving commit re-canonicalises with
`skipConstraintProjection` (drift, no mode); the read-resolver substitutes
profile-readiness for the active constraint (`coachWeekDiff.ts:163`). The mode dies in
the gap.

### Q4 — Which layer should own it?
A deriving source fact should own a **scoped regeneration committed as authored accepted
state** — the same base-change authority `weekRebuild:block` / block-rollover / profile
changes use (`commitAcceptedStateTransaction` **without** `preserveExactAcceptedWorkouts`,
which re-canonicalises and replaces `acceptedCompositionBase.surfaces`,
`acceptedStateTransaction.ts:511-543`). The fact remains the **sole derivation gate**
(invariant 1 unchanged); generation bakes the mode; the resolver stays pure projection.

### Q5 — Simpler architecture (fewer representations)?
Route the deriving fact through the **existing** `rebuildLocalWeek({scope:'block'})`
scoped-regen (`weekRebuild.ts:610/564`): it reads the active facts/constraints itself
(`collectWeekRebuildContext`, `weekRebuild.ts:310-342`), calls `generateProgramLocally`
(fresh microcycles + exposure contracts — the mode is derived here), preserves athlete
pins via `decideOverrideSweep` (`weekRebuild.ts:280-306`; `userRemovalConstraints`
re-applied at resolve), and commits the re-authored base via `commitRebuiltProgram` →
`commitAcceptedStateTransaction` (`weekRebuild.ts:702`). This **collapses** the
fact-commit and the authored week into one authoring transaction. No new representation,
no new resolver logic, no read-time derivation.

### Q6 — Legacy paths to retire?
- The **deriving branch of `commitTemporarySourceFactSet`** — the
  `inertComposition ? … : …` split (`temporarySourceFactTransaction.ts:335-337`) that
  sends an authoring-grade change through the overlay path. Deriving facts should
  hand off to the scoped-regen authoring transaction; the overlay path keeps owning
  **inert** facts only.
- The **fiction that read-resolver readiness reflects active facts** — it is
  profile-derived (`coachWeekDiff.ts:163`); nothing should rely on it to deliver a
  severe-tier reduction.

### Q7 — Tests?
§6 (D1–D7). Load-bearing: the commit re-authors a reduced mode week (D1/D2), clearing
restores byte-identical via stored prior state (D3), §18 validates the *effective*
authored week (D4), the authoring base-change is authorised and undo-tracked (D5),
sessions render visibly optional + disclosed (D6), and an unaffected week is
byte-unchanged with no read-time regression (D7).

---

## 3. Options weighed against doctrine

- **(a) Read-resolver derives the mode from active facts.** **Reject.** This is a
  read-time whole-week derivation — the exact silent-drift anti-pattern Stage 1
  *removed* ("bake at authoring; resolver is pure projection" is settled law). It would
  re-introduce read-time recomputation over untouched days.
- **(c) Materialise the reduced week into an overlay.** **Reject.** It adds another
  representation of the week (the materialised reduced overlay) — Q5 forbids adding
  representations. `repeatWeek`'s overlay *copies* held workouts; it does not regenerate
  under a mode, so the overlay's reduced contract would still need generation to author —
  i.e. (c) is (b) plus an extra artifact.
- **(b) Scoped regeneration committed as authored state.** **Recommend.** Prior art:
  `weekRebuild:block`. Fact stays the sole gate (invariant 1 unchanged); the week is
  authored under the mode (R15 proves generation derives it; illness-recovery invariant
  4 proves it validates); one transaction carries §18 + disclosure + undo; pins are
  preserved by the existing sweep; and — bonus — `optionalOnlyMode`/`applyOptionalRecovery`
  run **in generation** (`coachingEngine.ts:6851/6865`), so the "sessions visibly
  optional" requirement (D6) is satisfied by the same regen, no extra work.

  **One design constraint for (b):** *undo must restore stored prior authored state*
  (reversible-adjustment ledger / captured prior surfaces, as `repeatWeek`'s
  `displacedOriginalState` does), **not** re-regenerate — generation is nondeterministic
  (exercise-variation rotation), so byte-identical restore (D3) requires the stored
  pre-fact week, not a fresh generation.

---

## 4. `optionalOnlyMode` finding — resolved by (b)

The prior doc flagged that `optionalOnlyMode`/`applyOptionalRecovery` live only in the
generation path (`coachingEngine.ts:6851/6865`), absent from projection. Under (b) that
is a **feature, not a gap**: the scoped regen goes through generation, so the recovery
sessions are marked optional/reduced at authoring and rendered by pure projection. No
projection change is needed. Pinned by D6.

---

## 5. Proposed invariants (tests-first — RED first, then STOP)

`derivingSourceFactDeviceCommitTests.ts` (device-exact base). D1–D3 written + RED.
D4–D7 to author on approval, before any fix.

1. **D1 illness re-authors illness_recovery** *(RED)* — accepted week mode ==
   `illness_recovery` after the commit.
2. **D2 fatigue actually reduces** *(RED)* — accepted week signature ≠ pre-commit
   (class-wide, not illness-specific).
3. **D3 cascade byte-identical** *(RED)* — clear the fact → accepted week restored to
   the pre-fact signature (via stored prior state).
4. **D4 §18 validates the EFFECTIVE authored week** *(rider 1)* — a genuinely
   §18-impossible deriving change is still refused (fact stays gated, R9/R14 preserved);
   a valid one is accepted against the re-authored reduced week.
5. **D5 authorised base-change + undo** — the commit routes through the authoring
   transaction (base legitimately re-authored) and records a reversible adjustment /
   prior state; it does **not** trip `accepted_composition_base_changed_by_temporary_fact`
   because it is an authoring commit, not an overlay commit.
6. **D6 visibly optional + disclosed** *(Sam's semantics)* — the re-authored bed-ridden
   week marks remaining sessions optional/reduced (from generation's `optionalOnlyMode`)
   and the result discloses "nothing's required this week…".
7. **D7 no read-time regression** *(doctrine guard)* — a normal week (no active severe
   fact) is byte-unchanged in accepted projection and §18; the scoped regen fires ONLY
   on the deriving-fact commit, resolvers stay pure projection.

Gate on approval: D1–D7 green; `test:section18-ownership` 12/12 (monotonic);
`test:readiness-ownership` green (R15 re-pointed to assert the *committed* week is
illness_recovery, not a separate regeneration); `illness_recovery` suite green;
`test:bible` exit 0; tsc clean. **Then** fold `test:deriving-device-commit` into
`test:bible` (rider 3). **Then** the whole-severe-class device pass (rider 4): bed-ridden
(reduced + visibly optional + disclosure + clear-restores) AND `cooked_week` (the
shipped-but-never-verified tier). **Then** door-routing (R16, rider 5). At merge, update
`docs/SUPPORTED_ATHLETE_ACTIONS.md:47` (bed-ridden optional/reduced semantics + sniffle +
single door, rider 6).

Note: **R15 is currently misleading** — it asserts a *separate* `generateProgramLocally`
call derives `illness_recovery`, not that the *committed* accepted week does. It must be
re-pointed at the committed week as part of this work.

---

## 6. Recommendation

**Option (b) — scoped regeneration through the accepted-state transaction.** It is the
only option consistent with Stage-1 authoring doctrine, Q5's no-new-representations rule,
and the existing base-change authority boundary. No fix, no door-routing until this is
reviewed.
