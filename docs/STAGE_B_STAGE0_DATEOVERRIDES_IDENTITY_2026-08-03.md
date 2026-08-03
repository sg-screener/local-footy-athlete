# The dateOverrides identity question — Stage B stage 0 deliverable, 2026-08-03

**For Sam's ruling tonight.** Addendum §4 NEW: LR-1's walker cell proved no
walked athlete tap door writes `dateOverrides`; the census still calls it "the
athlete's decision surface"; Stage B derives over these surfaces, so the answer
changes what the assembler derives FROM. This document maps every writer with
receipts, states what the surface actually holds, and brings the ruling
options. Everything here is measured on main `dd9a85f`; no code was changed.

---

## 1. The verdict of the measurement, in one paragraph

`dateOverrides` is not a decision ledger. Every write into it, from every
writer, stores a **full materialised `Workout`** — never a typed decision. The
typed decisions, where they are recorded at all, live somewhere else: athlete
removals/moves in `userRemovalConstraints`, athlete adds/swaps in
`weekScopedOverlays` envelopes, the lighter-day choice in the explicit-load-edit
ledger, the modality preference in `coachPreferencesStore`, coach turns in
`coachMutationHistoryStore` (and on one legacy path, nowhere). What
`dateOverrides` holds is the **output** each of those decisions materialised.
It is the surviving member of the north star's "five publication shapes"
problem, wearing a decision surface's name.

## 2. Who still writes it — the complete map, with receipts

### 2a. Athlete-driven writes (the "no athlete tap" claim, refined)

LR-1's claim is true of the **walked** vocabulary and false of two unwalked
routes. `applyPlanChange` commits move/remove/add/swap through typed
transactions and returns — but two resolution errors fall through to the legacy
registry writer, which writes `dateOverrides` under the athlete's own writer id:

- **Occupied-day stack adds** — `add_defers_to_legacy_stack`
  (`planChangeProducer.ts:1739-1742`, fall-through at `:2750-2752`, write via
  `applyCoachRevisionDateOverrides` at `:3006-3016`).
- **No-template category swaps/adds** — `no_template_for_category`
  (`planChangeProducer.ts:1729-1731`).

Reached from two athlete surfaces: `PlanChangeSheet.tsx:272-278` (writer
`athlete_tap`) and the program-control tap path `programControlActions.ts:579`
/ `:764` (writer `program_control`; action kinds `swap_session`, `add_to_day`,
`move_session`, `bin_session`, `set_recovery_mode` — all hard-coded
`initiatedBy: 'tap'` at `:492-499`). These are the same underlying writer LR-3
counts (`applyCoachRevisionDateOverrides`, declared 4).

- **The lighter-day transaction** (`lighterDayTransaction.ts:79-84`, writer
  `lighter_day`): the athlete's decision — "make today lighter" — is recorded
  in the reversible ledger (`readiness_lighter_day:<date>`, linked to the
  readiness fact, `:86-95`). What lands in `dateOverrides` is the **derived
  trimmed workout** (`applyLighterDayTrim` output). Decision recorded once,
  output stored beside it.

### 2b. Coach-pipeline writes — new decisions

- `adjustment_events` (`applyAdjustmentEvents.ts:333`): coach-chat mutation
  turns; a working copy of the resolved day transformed per event; decision on
  the action tape (`:1825-1856`) and, on the executor chain, in mutation
  history (`coachCommandExecutor.ts:1038-1054`).
- `coach_action` (`coachActions.ts:246`): the legacy backend coach turn
  (`CoachScreen.tsx:2042`); full cloned-and-transformed workouts. **No decision
  record at all at this site** — no tape event, no undo `RevertPlan`, no
  ledger (verified by grep; the only record is the door's counts-only tape).
- `coach_turn_controller` (`coachTurnController.ts:2443`): the LLM revision
  proposal, single-date. **The multi-date case bypasses the door entirely**,
  merging into `dateOverrides` via a direct `commitAcceptedStateTransaction`
  (`coachTurnController.ts:2452-2466`).
- `coach_modality_swap` (`coachModalitySwapOrchestrator.ts:721`): materialises
  a stored preference across the resolved week — the decision lives in
  `coachPreferencesStore` (`:508`); the overrides are **derived mirrors of it**
  for this week only (`:517-521`).

### 2c. Coach-pipeline writes — restores (rollback/undo)

`coach_undo` (`coachUndoEngine.ts:345`), `coach_program_edit`
(`coachProgramEdit.ts:2393`), `coach_executor` (`coachCommandExecutor.ts:4221`)
— all write back a snapshot of prior state after a failed verification or an
undo. Restores, not decisions.

### 2d. The store's own builders, and non-product

`store_action`/`reset` (`programStore.ts:1789/:1814`); `dev_seed` and
`harness` (declared, swept out of product).

### 2e. Writes that do not go through the door at all

- `coachTurnController.ts:2455` — the multi-date revision (above).
- `postGenerationConstraintValidation.ts:1887-1899` — safety projection
  re-canonicalises the whole existing map and commits it.
- `programStore.ts:1211-1224` — **hydration repair writes its own §18-repaired
  output back into an athlete-authored override in place** (deliberate:
  `:1204-1208`). Sits in tension with the derived-repair ruling ("a §18 repair
  never lands on dateOverrides") — the comment distinguishes updating an
  athlete-authored entry from creating one; flagged, not adjudicated.
- Subtractive/pass-through only: `weekRebuild.ts:736-752/:784-799`,
  `profileProgramTransaction.ts:217→366`,
  `reversibleAdjustmentTransaction.ts:547-553/:755` (legacy fallback restore).

**Generation itself writes nothing here** — `generateProgram.ts` has zero
occurrences; `weekRebuild` only filters existing entries (verified).

## 3. Who reads it — and the fact that raises the stakes

Two derivation stacks read it **with different precedence**:

- **Live render** (`sessionResolver.ts:951-1019`): override → calendar mark →
  overlay → base. `userRemovalConstraints` is absent from this chain entirely,
  and override content is exempt from the injury filter (`:930`).
- **Accepted state** (`acceptedEffectiveWeek.ts:97-166`): base < overlay <
  override < **userRemovalConstraints** < marks < §18. A removal constraint
  beats an override here and cannot beat one on the live path.

Plus two more hand-rolled copies of the precedence
(`postGenerationConstraintValidation.ts:735/:1535/:1717`,
`devE2ESeedRegistry.ts:448-455`). The §18 gateway itself never reads the
surface (`section18AcceptedWeekGateway.ts:249-251` blanks it). Four copies of
one precedence, two of them disagreeing about the athlete's strongest
decision surface, is exactly the representation-count problem the escalation
rule exists for — and Stage B's assembler is about to become the fifth reader
unless the ruling fixes what it reads.

## 4. The ruling options

### Option A — RETIRE toward decisions (full convergence now)

Declare `dateOverrides` a legacy publication shape. Migrate every writer to
the typed pair (`weekScopedOverlays` + `userRemovalConstraints`) or to typed
decision records; the surface becomes read-ingress-only (L15), then deletes.

- **For:** the north star verbatim — the five shapes converge to one; the
  precedence divergence dies with the surface.
- **Against:** the coach pipeline owns most surviving writes and is under the
  LR-6 STOP — migrating them changes what coach paths write, which is exactly
  what the STOP holds. Full retirement cannot land inside Stage B without
  re-opening LR-6, and Stage B would wait on coach-unit work it doesn't own.

### Option B — RE-CLASSIFY as a stored-output surface (rename, keep)

Accept it as the materialised-override surface; fix the census language;
Stage B derives over it as an input with pinned precedence; no migration.

- **For:** zero new work; Wednesday start unaffected.
- **Against:** ratifies a stored-output store the north star presumes wrong
  (which demands an explicit exception plus a retirement plan anyway — so B
  quietly becomes C without the plan); the assembler inherits a surface whose
  entries mean different things per writer, forever.

### Option C — RECOMMENDED: re-classify now, retire by ownership lane

Rule the identity honestly and split the retirement along the ownership
boundaries that already exist:

1. **Identity:** `dateOverrides` is a stored-output surface, not a decision
   ledger. Census caveat and north-star language updated; new writers refused
   by default (the closed union already enforces this).
2. **Stage B's assembler** treats it as read-ingress input, ordered by the
   accepted stack's precedence (base < overlay < override < constraints), and
   never writes it — generation already doesn't.
3. **The two athlete routes still writing it** (occupied-day stack adds,
   no-template swaps — LR-3's residuals) convert to typed transactions as part
   of Stage B's placement work. This is assembler scope, it pays LR-3, and it
   makes "no athlete path writes stored output" TRUE rather than
   almost-true.
4. **Lighter-day** converts to a derived effect of its recorded readiness fact
   through the ruled deriving lane (the decision is already in the ledger; the
   stored trim becomes a derivation). Small, and it is derivation work.
5. **The coach pipeline writers stay**, declared as the surface's only
   remaining writers, retirement owned by the coach units (LR-6/5B) — outside
   Stage B, consistent with the STOP.

End state after Stage B under Option C: every writer of `dateOverrides` is
coach-owned, the athlete's whole vocabulary publishes decisions, and the
surface has a named retirement owner. The assembler derives from decision
surfaces plus one declared, shrinking legacy input.

## 5. Incidental findings surfaced by the mapping (not for tonight's ruling)

1. The multi-date coach revision bypasses the LR-1 door
   (`coachTurnController.ts:2452-2466`) — the door's writer discipline does
   not cover the merged-map commit path.
2. `coach_action` writes carry no decision record on the legacy backend path.
3. The live/accepted precedence divergence (§3) — documented in-repo at
   `programStore.ts:1188-1196` but still live.
4. The hydration-repair in-place write (§2e) vs the derived-repair ruling.
5. Writer id `coach_revision_writer` is in the closed union with zero product
   uses (`programStore.ts:2587`).
