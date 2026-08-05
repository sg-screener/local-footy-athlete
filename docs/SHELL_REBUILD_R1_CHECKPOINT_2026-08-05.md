# SHELL REBUILD — R1 checkpoint, 2026-08-05

Branch `feat/stage-b-stage2`. Plan approved as written with A fold / B none /
C hidden (`docs/SHELL_REBUILD_PLAN_APPROVAL_2026-08-05.md`, `c81d576`).
R1 units 1 and 2 are COMPLETE and committed on a genuinely green chain;
units 3 and 4 are designed, surveyed, and NOT STARTED. Totals-or-red applies
to this document: what is not listed as done is not done.

## Done

**R1.1 — the decision ledger (`52e0e0c`).** `src/store/decisionLedgerStore.ts`
+ `src/types/decisionLedger.ts`: one new persisted input store, born armoured
(door `applyDecisionLedgerWrite`, tape event `decision_ledger_write` in
`DECISION_EVENTS` and the typed union, quarantine boundary, 8-cell ownership
suite chained into the bible). The ledger's own law beyond the recipe:
APPEND-ONLY — a rewrite that drops or edits an entry refuses
(`ledger_rewrite_without_reset`); undo appends a reversal (LR-29 by
construction). Four post-commit mutations each turned exactly the cell built
to see them. The D1 hydration-gate pin and the census unowned-store detector
both caught the store before registration — the gate estate priced its own
extension.

**R1.2 — derive() under one owner (`fe7e299`).**
`src/utils/deriveVisibleWeek.ts`: `gatherDeriveInputs()` (the one sanctioned
ambient read), `assembleScheduleState()` (the one assembly; the
`revision > 0` accepted-precedence switch stated ONCE), `deriveVisibleWeek()`
(the proven resolver over the assembly). `buildScheduleStateImperative`
(coachWeekDiff) is now a pure delegation — the KEEP-IN-SYNC twins are dead as
a class. `useScheduleState` (hooks/useSchedule.ts) is the DECLARED rival
until R5 deletes it at switchover (LR-13); the sweep cell fails on any third
home. Five cells: purity, input-independence, delegation, one-owner sweep,
composition.

## Process notes paid for this session

- **Never `; echo EXIT $?` after a gate.** It makes the shell exit 0 and the
  background notification reports success over a red chain. The R1.2 commit
  initially crossed a red census gate exactly this way; caught by reading the
  log tail, fixed forward, amended. Run the gate bare; the notification
  carries the true exit code.
- The census `mirrorDecisionReads` regex counts a TYPE expression
  (`ReturnType<typeof useProfileStore.getState>['onboardingData']`) as a
  mirror read. Use the real domain type in new code; do not bump the
  declaration for a type-level mention.

## R1.3 — quiescent boot (NEXT, not started)

The product flip. Coordinates (all surveyed this session):

- `programStore.ts`: `onRehydrateStorage` :2216-2487 runs the boot mint chain
  (accepted transaction + fact set + mirror republication + canonical
  readback rewrite); `merge` :2077-2213 is the in-memory lift; the
  `hasHydrated` monkeypatch :2535-2559 gates render on acceptance.
  `temporarySourceFactTransaction.ts` :224-275 re-mints `busy_week` on EVERY
  ownership load. Boot writes disk four ways (retired-key delete stays; the
  other three go).
- NEW BOOT: hydrate input stores → derive in memory → render. No
  transactions, no revision mint, no readback rewrite. Persist `partialize`
  stops carrying output surfaces; in memory they remain exactly as today so
  screens and doors work unchanged. Fresh-install world only (R1's device
  pass is fresh-install; an old envelope at boot is R2's migration).
- RED FIRST: the boot-appends-nothing cell — relaunch, flush, byte-compare
  every persisted key (evening-0's successor, permanent).
- Suites that act through the persist envelope (`hydration-upgrade-path`,
  `hydration-refusal-quarantine`, `program-control-durable`, both device-pass
  suites) get the world-follows-product treatment: WORLD-BUILDING moves to
  the new boot; ASSERTIONS DO NOT MOVE (the expectation-edited lesson).
  evening-0's declared-red entry is deleted by the commit that greens it.
- dev/e2e seed coordinators drive accepted transactions — keep them working
  against the in-memory machinery or declare NOT-COVERED in the boundary
  report.

## R1.4 — doors append + re-derive (after R1.3)

- Doors stay behaviourally identical (the proven interpreters); with outputs
  no longer persisted, a door's only disk write is ONE ledger append (+ log).
  The `conflicted` refusal dies with the revision check
  (`fixtureMutationTransaction.ts:176-187`); `expectedAcceptedRevision`
  callers: `useHomeScreen.ts:309→:1055` (render-captured — the failing
  shape), `homeGameMutationController.ts:117` (fresh read),
  `coachFixtureChange.ts:106` (out of beta, LR-6).
- Every door body ends by appending its typed decision
  (`appendDecisionEntry`, writers `program_control` / `fixture_door`).
- The work-bill cell generalises evening-4 across the door vocabulary;
  evening-1/2/3/4 declared-red entries are deleted by the commits that green
  them.

## Standing gates for whoever continues

Full chain (`npm run test:bible`) EXIT 0 before every commit — run it bare in
the background and read the true exit. Branch-verify before every commit
(shared tree). Commit BEFORE mutation-testing. A declared red that stops
redding owes its entry's deletion in the greening commit. R1 ends at Sam's
fresh-install device pass — STOP there; that involvement is his only one.
