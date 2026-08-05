# SHELL REBUILD — R1 checkpoint, 2026-08-05

Branch `feat/stage-b-stage2`. Plan approved as written with A fold / B none /
C hidden (`docs/SHELL_REBUILD_PLAN_APPROVAL_2026-08-05.md`, `c81d576`).
**R1 CODE COMPLETE: units 1–4 (including R1.4a/R1.4b) and the work-bill cell
are committed on a genuinely green chain. R1 now waits on exactly one thing —
Sam's fresh-install device pass — and STOPS there.** Totals-or-red applies
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

**R1.4a — every landed decision reaches the ledger (`c0a9ae0`).** Additive,
before the boot flip: `applyPlanChange` appends the typed plan-change on ok;
`executeFixtureMutationTransaction` appends the typed fixture decision (the
durable door only — the in-memory twin is the parity/replay seam and never
writes). Refusals never reach the ledger (`doorLedgerAppendTests`).

**R1.3 — the quiescent boot (`03318c0`).** The product flip, landed exactly
as coordinated: persisted program state is INPUTS ONLY (`partialize`/`merge`
flipped; `reduceProgramEnvelopeToInputs` converges every writer at the
boundary; an old-shape envelope is PARKED byte-identical under
`program-store.pre-rebuild-envelope` for R2 and restores nothing); boot =
`runQuiescentBoot` (park → clean-slate derive at the recorded
`generationAnchorISO` under the persisted phase clock → replay the decision
ledger through the recording interpreters, under `ledgerReplayLatch` — no
durable writes, no ring flood). `quiescentBootTests` holds the laws.
Full triage record: `docs/SHELL_REBUILD_R13_HANDOVER_2026-08-05.md` (the L16
root cause — the fresh-install reset never reset the R1.1 ledger — plus the
two product defects the walker's light found and this commit fixed: a landed
fixture add crashing on its own acknowledgement note, and the weekRebuild
publications inheriting the equivalence gate's `restoration` default so a
disclosed shortfall REFUSED an athlete's game add). evening-0/1/2/3 went
green structurally and their declared-red entries are deleted; LR-4 paid
72→71, census baseline 74→73.

**R1.4b — the revision handshake retired (this commit).** Both `conflicted`
branches in `fixtureMutationTransaction` are gone; `expectedAcceptedRevision`
stays typed as render-provenance only. Pins: `doorLedgerAppendTests` ("a
stale render revision still lands and appends"), `fixtureMutationTransaction-
Tests` cell 7 (reversed to the retirement). The refusal-factory cell moved to
a genuinely impossible request.

**The work-bill cell (this commit).** `workBillTests` (chained) generalises
evening-4 across the door vocabulary — delete / move / add / fixture-add /
fixture-remove — in the law's RATCHET form: closed per-door write sets
(decision stores + the DECLARED mirror bill), shrink-only mirror debt (an
untouched entry is stale and fails), split byte ceilings (non-log ≤ 32 KB —
measured 2–8 KB per door against the old ~1.1 MB pipeline; the 200-entry log
ring bounded separately at 1 MB). R5's mirror deletion drains the declared
set and leaves the strict law standing. evening-4's declared red stays in the
evening suite on the original device coordinate until that bill empties.

## Known residuals (declared, not hidden)

- `fixtureMutationTransactionTests` is NOT in the bible chain; 11/14 after
  this session's world fix (the profile now answers the equipment step).
  The 3 pre-existing fails are recorded so they are never misattributed:
  cell 4 (practice-match add answers `fixture_already_present` on this
  world), cell 9 (restoration reads `markedDays` off the retired envelope
  shape), cell 11 (TraceV2 roots=16). They predate R1.4b and belong to the
  suite's own unit.
- The `?? 'restoration'` DEFAULT at the two accepted-commit assert sites
  contradicts the assert interface's "no default here" comment. R1.3
  classified the weekRebuild owners explicitly; whether the default itself
  should die is a ruling for Sam.
- The durable door does not AWAIT the decision-ledger flush before returning
  success (the persistence barrier predates the ledger). Small data-loss
  window on process death in the same tick; work-bill/R2 candidate.
- An undo has no durable record until the reversal producer lands (LR-29's
  heir) — pinned in `athleteSessionMoveTests` cell 21 so the producer's
  arrival forces the durability assertion.

## Standing gates for whoever continues

Full chain (`npm run test:bible`) EXIT 0 before every commit — run it bare in
the background and read the true exit. Branch-verify before every commit
(shared tree). Commit BEFORE mutation-testing. A declared red that stops
redding owes its entry's deletion in the greening commit. R1 ends at Sam's
fresh-install device pass — STOP there; that involvement is his only one.
