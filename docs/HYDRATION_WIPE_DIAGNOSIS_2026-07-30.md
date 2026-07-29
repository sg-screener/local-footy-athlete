# The hydration wipe: refuse, then overwrite

**STATUS: DIAGNOSIS. NO FIX WRITTEN. NO RED CELL YET — and that is why no fix is
written** (Sam, this unit: *red cells before fixes, as always*). Both root causes
are located exactly in code. The reproduction is specified but not achieved; what
blocked it is recorded below because it narrows the target rather than merely
failing.

Tape: `device-export-2026-07-29-hydration-failure.json`, 73 entries,
18:32:06.942 – 18:32:21.288. Final state: `hasProgram: false`,
`microcycleCount: 0`, `acceptedRevision: 3`, `lastTransaction:
temporary_source_fact:hydrate`. Profile (23 answers) and 5 calendar marks
survived; the program did not.

## The chain, from the tape

| time | event |
|---|---|
| 18:32:07.384 | `hydrated_state_checked` **succeeded**, version **43**, 2 overlays, 8 constraints — data intact |
| 18:32:07.4–.7 | gateway re-evaluates each stored week; 2026-08-03 `repair_candidate_rejected` `maximum_breach:conditioning`, `searchExhausted: true`, **outcome impossible**, then `candidatePath: fallback` — a REDUCED candidate is produced |
| 18:32:07.830 | `visible_projection_result` 2026-08-03 `rejectionCodes: ["maximum_breach"]` |
| 18:32:07.830 | `transaction_verification_result` **verified false**, `accepted_state_ledger_mismatch`, boundary `assertAcceptedVisibleLedgerEquivalence` |
| 18:32:07.830 | `accepted_state_publication_result` published false, `atomicRollback: true`, `persistenceResult: not_started` |
| — | **13.4 second gap** — the boot gate's `HYDRATION_TIMEOUT_MS` is 10_000, then the boot error screen's Try Again |
| 18:32:21.245 | `hydrated_state_checked` **succeeded**, version **1**, **0 overlays, 0 constraints** |
| 18:32:21.258 | `persistence_result` operation **write**, program-store, **succeeded** ← the overwrite |
| 18:32:21.288 | `athlete_action_completed` `hydration_accepted` |

## Finding 3 — one transaction, two modes (confirmed exactly)

`assertAcceptedVisibleLedgerEquivalence` (`acceptedStateTransaction.ts:464`)
branches on `args.operation`:

- `restoration` → **throws** `AcceptedStateLedgerMismatchError` on any blocking
  violation;
- otherwise → accept-and-reduce (record the shortfall, publish).

`commitAcceptedStateTransaction` defaults it: `operation: proposal.operation ??
'restoration'` (`:632`, `:740`). The hydration acceptance call
(`programStore.ts:2317`) passes **no `operation`**, so it is strict.

Meanwhile the SAME transaction's staging path —
`canonicaliseAcceptedStateCandidate` → `runSection18AcceptedWeekGateway` — runs
accept-and-reduce unconditionally, which is what produced the reduced candidate
at 18:32:07.7. So the candidate was reduced by one half of the transaction and
then refused by the other. That is Sam's mixed mode, verbatim.

**The ownership question this poses:** old-build state meeting new rules is a
LEGACY SHAPE. It wants a read-ingress lift (the `powerBlock` precedent), after
which a strict restoration is the correct and only mode. It does not want a
re-gating that shrinks (that would merge a defect into accepted state) nor a
strict check that strands (that is this wipe).

## Finding 4 — the refusal has nowhere to put what it refused

`programStore.ts:2367-2380`: the acceptance catch emits `athlete_action_failed`
and **rethrows**. Consequences, all confirmed by reading:

1. `programHydrationAcceptancePromise` rejects; `programHydrationAccepted` stays
   `false`; the wrapped `persist.hasHydrated()` (`:2427`) therefore returns
   false forever.
2. `appHydrationGate.settleStore` polls to `HYDRATION_TIMEOUT_MS` (10s), reports
   `failed`, and the boot error screen offers Try Again →
   `retryAppHydration()` → `persist.rehydrate()` (`appHydrationGate.ts:155-168`).
3. **Nothing quarantines the refused payload.** There is no holding surface: the
   refused v43 state exists only in memory and in whatever the storage envelope
   still happens to contain, and no writer is prevented from overwriting it.
4. **Nothing makes the bare fallback unpersistable.** The second cycle's
   acceptance publishes and persists normally, because it has no way to know a
   refused payload exists.

**The law this unit owes: A REFUSAL MUST NEVER PERSIST THE STATE IT REFUSED
INTO.** This is the profile-mirror wipe law (`docs/PROFILE_MIRROR_OWNERSHIP_
REASSESSMENT_2026-07-24.md`) at a second store — the class's second occurrence,
which is also the L11 stop-rule condition.

## The reproduction: specified, attempted, NOT achieved

Four attempts against a real generated store persisted as an envelope, each with
a declared previous-build transform. **None reproduced the refusal**, and the
reason is itself a finding:

- Lowering `conditioning.core.permittedMaximum` below the delivered count did
  nothing: `evaluateExposure` (`section18EffectiveWeekEvaluator.ts:683-689`)
  charges a maximum only against `split.appPrescribed`, and Sam's profile earns
  most of its conditioning credit from team training, which the app cannot
  un-prescribe.
- With a no-team-days profile (so the exposure is app-prescribed) the gateway
  simply repaired the week — correctly.
- With a contradictory contract (`requiredMinimum` = achieved, `permittedMaximum`
  = achieved − 1) it still did not refuse.

**Why: my envelopes classify as `accepted_canonical`, and that path returns
early.** `programStore.ts:2202` — an `accepted_canonical` ingress takes the
canonical projection branch and **never calls
`commitAcceptedStateTransaction`**, so it cannot reach the boundary that threw.
The revision stayed 43 and `lastTransaction` was unchanged in every attempt,
which is the proof.

**Therefore the reproduction needs an envelope classified `legacy_precanonical`
or `migration_required`** (`programHydrationIngress.ts:303-320` —
`hasAcceptedCanonicalEvidence` must be false while `hasMaterialProgramState` is
true). That is exactly what "a previous-build store" means, and it is the next
step, not a fix.

## What is NOT done

- No red cell. No fix. Neither finding is repaired.
- Walker upgrade-path vocabulary (`hydrate a previous-build store`) not built.
- The L12 audit — every stored-state writer and its failure-state behaviour —
  not started.

`test:bible` is EXIT=0 and untouched by this unit; the wipe is not gated, and
nothing here should be read as saying it is.
