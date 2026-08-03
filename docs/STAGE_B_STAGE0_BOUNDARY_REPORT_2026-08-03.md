# Stage B — Stage 0 boundary report, 2026-08-03

Stage 0 only, per the kickoff order: preconditions verified first-hand, the
differential baseline committed, the dateOverrides identity question mapped and
brought for ruling. **No product code changed.** The build begins Wednesday on
the fresh week, after Sam rules.

Base: main `dd9a85f`.

---

## 1. §5 preconditions — verified against current main, not inherited

The 2026-08-03 precondition report existed; per the kickoff order and the
green-gate-is-a-claim rule, every check was re-run here rather than trusted.

1. **Store armour + generation-path writers (PASS).** Zero live
   `.setManualOverride` references in product code — the 15 surviving mentions
   are comments, docstrings and the census detector's own regex (grep receipt
   in this session's log). The generation/rebuild path writes only through
   `commitAcceptedStateTransaction` (`weekRebuild.ts:714/809/822`); neither
   `generateProgram.ts` nor `weekRebuild.ts` calls the override door.
   `athletePreferencesStore` owned (`applyAthletePrefsWrite`,
   census registry) with `test:athlete-prefs-ownership` green inside the
   verified chain below.
2. **Schedule-fact deriving lane (PASS).** `667e3a3` is an ancestor of main
   (`git merge-base --is-ancestor`, verified).
3. **Team-night movability (PASS).** `ce8ad9a` is an ancestor of main
   (verified the same way).
4. **`test:bible` EXIT=0 on main (PASS).** Full chain run this session at
   `dd9a85f`: **EXIT=0**, zero failures across all suite totals, deep walker
   tier green inside the chain (3 walks × 90 actions, ≥4 weeks of clock,
   17/17). The two grep hits for "FAIL" are section headings ("FAIL LOUD"
   cells), not failures.

**Declared reds this stage inherits and Stage B pays** (the §5.4 list):

- The walker containment `generated_conditioning_rows_have_no_authored_name`
  (`athleteActionWalkerTests.ts:1699`) — paid when conditioning selection
  moves onto the 55 signed templates (addendum §1.6).
- The `STAGE_B_DOOMED` pins (`provenancePendingLists.ts`, gated by
  `test:pending-lists`): every pinned conditioning-dose symbol must exist
  until Stage B lands and be gone once it does.
- The route (b)/(c) containments (tests 23/26/28, draft accruals): the
  addendum §3 says partially paid by typed-role work — the classifier stage
  must verify what remains rather than redo it.
- Pre-existing non-bible reds carried, all LR-14's, none this stage's:
  `test:block-state`, `fixtureMutationTransactionTests`,
  `programControlActionsTests`, `devE2EDefaultSeedInstallationTests`.

## 2. The differential baseline — committed

`src/__tests__/stageBGenerationDifferential/` — scenario matrix
(`scenarios.ts`, 14 scenarios), snapshot builder
(`buildGenerationSnapshot.ts`), gate
(`stageBGenerationDifferentialTests.ts`), and the committed golden
(`snapshot.golden.json`, ~2.8 MB). Pattern inherited from the power-counting
differential; projection is the app's own canonical semantic snapshot
(`snapshotSemanticWorkout`), so `diffSemanticPrograms` can classify later
stages' movement.

- **What is pinned per week:** the contract's demand (mode, subphase, week
  kind, numeric policies for main strength / core conditioning / sprint /
  power), every day's full semantic content (exercise names, order, sets,
  reps, weight, rest, prescription type, intensities, durations, components,
  conditioning options, athlete-visible presentation), and the §18 gateway
  verdict with post-gateway counts.
- **What is scrubbed:** generated ids and timestamps — the determinism probe
  (two same-input runs must be byte-identical, asserted before the golden is
  consulted) caught `createdAt`/`updatedAt` leaking through component
  metadata on its first run; the scrub closed it and the probe is permanent.
- **Mode census (recorded in the golden):** 8 of 11 week modes reached —
  `early/mid/late_offseason`, `early/mid/late_preseason`,
  `in_season_game_week`, `practice_match_week`. Deload weeks and subphase
  transitions occur inside scenarios.
- **The acceptance bar is now measured, not anecdotal:** the baseline shows
  median exercises/session of **3.0** for `inseason-game-week`,
  `preseason-team-and-game` and `inseason-poor-conditioning` (off-season
  scenarios sit at 6.0) — Sam's "most days feel thin" against the 5–7
  criterion, pinned as the number every later stage diffs from.
- **Gated:** `test:stage-b-generation-differential` appended to the
  `test:bible` chain, armed through the totals-or-red owner
  (`armTotalsOrRed`/`totalsPrinted`). `test:totals-or-red-law` 4/4,
  `test:legacy-census` 301/301, `test:compile` ratchet PASS after the change.
  A red here during the build means: regenerate the golden in the same commit
  if the movement was predicted, STOP if it wasn't.

## 3. The dateOverrides identity investigation

Delivered as `docs/STAGE_B_STAGE0_DATEOVERRIDES_IDENTITY_2026-08-03.md` —
every writer mapped with file:line receipts, the read/precedence map, the
content classification, three ruling options and a recommendation (Option C:
re-classify as stored-output now; retire the two athlete routes and the
lighter-day trim inside Stage B; leave coach writers to the coach units under
the LR-6 STOP). Headline measurements:

- Every write stores a materialised `Workout`; no write stores a typed
  decision. The decisions live in `userRemovalConstraints`,
  `weekScopedOverlays`, the explicit-load-edit ledger, the preference store —
  or, on the legacy `coach_action` path, nowhere.
- Two athlete routes still write it (occupied-day stack adds, no-template
  swaps — LR-3's residuals), refining LR-1's "no walked tap door" claim.
- Two derivation stacks read it with **different precedence** (live path has
  no `userRemovalConstraints` at all), plus two more hand-rolled copies.
- The multi-date coach revision and the safety projection bypass the LR-1
  door entirely.

## 4. North star statement

**TOWARD.** No new stored runtime state: the golden is a committed test
fixture, and the only product-adjacent change is one npm script line. The
stage's substance is convergence work in its purest form — measuring the
largest remaining stored-output surface, naming it honestly, and bringing the
ruling that decides its retirement path *before* Stage B builds the derivation
over it. The differential harness itself serves the derive-everything rule: it
pins generation as a pure function of profile + clock (the determinism probe
makes hidden inputs a red).

## 5. L12 — what catches the NEXT defect of this class

- **Unpredicted generation movement** (the class Stage B is most exposed to):
  the differential gate fails the bible chain on any byte of unpredicted
  output change across 14 scenarios × 4 weeks. The next silent behaviour
  change in generation cannot pass unnoticed; it must arrive with a golden
  regeneration in the same commit and a prediction in a boundary report.
- **Nondeterminism** (the class that would rot the harness itself): the
  two-run probe is asserted before every golden comparison, so a new hidden
  input (clock, RNG, iteration-order) names itself instead of appearing as a
  flaky diff.
- **Surface-identity drift** (the dateOverrides class): the investigation's
  method is the instrument — a surface's name is not its identity; identity is
  measured by enumerating writers and classifying what each stores. The next
  "decision surface" claim should be checked the same way before anything
  derives over it. The census caveat already records the measured state; the
  ruling will decide who guards it structurally.
- **The coverage lie this stage could have told:** the golden records
  `modesReached`, so the three unreached modes are pinned in the artifact
  itself rather than remembered in prose (no silent caps).

## 6. Depth (L13)

This stage added no walker cells and asserts nothing new about accumulated
state. Depth reached by the verification run: the chain's deep tier (3 walks ×
90 actions, ≥4 weeks of clock). The differential baseline is **depth zero by
construction** — fresh generation from onboarding, no athlete history — and is
declared as such: it pins the engine's output, not the engine's behaviour
under 43 revisions. Stored-program rendering and post-edit derivation are the
walker's jurisdiction, not this harness's.

## 7. NOT COVERED

- **Three week modes unreached** by the matrix: `in_season_bye_build`,
  `in_season_bye_recovery`, `optional_week` — they require fixture facts
  (fixture gaps, the early-off-season all-optional calendar position) that
  `generateProgramLocally` does not take from onboarding alone. They join the
  matrix in the stage that first touches them; until then the baseline is
  silent about them and says so in `modesReached`.
- **The stored-program rendering path is not snapshotted** — the baseline
  covers fresh generation only. The MAS both-paths requirement (draft §Scope
  6) will need a second lens when that stage arrives.
- **No device pass** (L4/L10 stand): everything here is source-and-gate
  evidence.
- **The dateOverrides investigation maps writers and readers, not values:**
  no A/B capture of live override bytes was run; the coach-path
  content-conservation differential remains the stronger uninstalled
  instrument (carried from LR-1's NOT-COVERED).
- **The live/accepted precedence divergence is named, not fixed** — it
  predates this stage and belongs to the ruling's follow-on unit.
- **The bible chain was verified at `dd9a85f` before this stage's commit**;
  the appended differential suite ran green standalone plus the three gates
  its wiring touches (totals-or-red, census, compile). The full chain was not
  re-run end-to-end after the append.

## 8. Stage 1 plan

Contingent on tonight's ruling; shaped by L16 (vertical slice first) either
way.

1. **Rulings in hand before code:** the dateOverrides ruling (this stage's
   deliverable) and the draft's day-one %MAS range-vs-binary question go to
   Sam together. Both change derivation sources; neither is code.
2. **Stage 1 = the vertical slice (L16, addendum §1.5):** the weekly
   assembler's first honest loop — one mode (the athlete's live mode), the
   week derived from the authored contract + declared days + decision
   surfaces (as ruled), through
   load → display → change → repair → approve → persist → relaunch-identical,
   proven by the walker, with the differential golden regenerated against
   written predictions for exactly the scenarios the slice touches.
3. **Its gates from birth:** action tape on any new writer/derivation
   (instrumentation rule), walker vocabulary extended in the same stage
   (L11), `test:action-walker:deep` green, domain purity (L14 — the assembler
   callable from a plain test), and the (placement × domain) matrix extended
   for anything it places.
4. **Not stage 1:** conditioning-template switchover (that stage pays the
   declared red and deletes the `STAGE_B_DOOMED` pins), the classifier
   containments, MAS rendering — each is its own stage with its own predicted
   diff.
