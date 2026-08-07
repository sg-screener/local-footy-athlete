# R5.3 — ACCEPTED-STATE-TRANSACTIONS: BOTH ROOTS NAMED (2026-08-07)

LOOP CHECK: authority-carried-on-the-write-path-only-while-a-new-read-path-
re-derives-without-it — sighting 2 (`governedFromISO` was sighting 1, fixed by
the one-owner boundary; `activeFixtureDates` is this one) — COMPRESS proposed,
not built: a census gate over the gateway's authority inputs BY CALL SITE, so
the next authority the read path silently drops is caught by enumeration, not
by a suite three layers downstream.

Sixteenth pass. Executes the seat's worst-first order, root #1:
`accepted-state-transactions`' two failures under leg (ii). Instruments at
`a1f27f9c` on scratch/r53-pricing-7-probe (all tape-/env-gated, inert by
default). **NOTHING BUILT.** Method as ruled: file-backed tape, positive
controls in-world (per-phase and per-window markers that fire regardless of
outcome), both arms in the same worktree and process model, attribution on
executing records only.

Arm note: diagnosed under `LEG_II=1 BOUNDARY=1` (the unit as it will land,
per (a) of the ruling); both failures' text is byte-identical with and
without the boundary, and the flags-off control ran 43/43 green in the same
worktree before instrumenting.

## ROOT 1 — "Pre-season hydration drifted" is ORDER WITHOUT AN OWNER

**What the dump proves:** the two hydration passes commit the SAME SEVEN
SESSIONS for week 2026-08-03 (same planEntryIds, same content). Pass 1
APPENDS the two repair-placed conditioning sessions after the strength days;
pass 2 emerges day-sorted. `canonicaliseHydratedProgram` then assigns ids
POSITIONALLY (`w-coach-N`, exercise ids from array order), so identical weeks
in different orders are different bytes, and the test's
`JSON.stringify(once) === JSON.stringify(twice)` fails. No session content
drifts; the ORDER of the workout array has no single owner — the placer
appends, the composer day-orders, and the canonicaliser mints identity from
position.

**Why leg (ii) exposed it (taped, both arms):** flags-off, the week's
`planner_selected_target_miss` has NO repair generator — the resolve goes
`impossible` and REGENERATION composes the week (day-ordered by construction,
idempotent; flags-off pass 2 resolves once, `accepted`, zero repairs). Under
leg (ii) the widened shortfall question (`selectedShortfall`,
gateway `repairCoreConditioningShortfallCandidates`) answers it IN PLACE by
appending sessions — the ruled :4688 design working as ordered. The placement
is correct; the order-identity it produces is unowned.

- Tape: `core-shortfall-question` records show `sel=1 /
  planner_selected_target_miss` firing in BOTH passes; `gateway-selected`
  records show pass 1 and pass 2 CONVERGE to identical day signatures.
- The drift is only in array order + positionally-derived ids (full listing
  in the report's instrument run, `.probe14/hyd-legii.{once,twice}.json`).

**Fix shape (offered, unpriced, not built):** give workout order ONE owner —
a canonical order (day, then a content-derived key) applied at the one
composer or inside `canonicaliseHydratedProgram` before id assignment; or
derive ids from content instead of position. Enforcement-shaped; no signed
sentence involved. Whether the placed-vs-regenerated week difference itself
is lawful is a separate, already-ruled question (it is the :4688 design).

## ROOT 2 — "following-week dependency was not committed in the same
snapshot" is A CROSS-WEEK AUTHORITY THE READ PATH NEVER RECEIVES

**The chain, every hop taped or read at source:**

1. The fixture MOVE's dependent week (2026-07-20) arrives at the gateway
   WITH Monday's G+1 recovery (`fixture_recovery`, trigger
   `fixture:2026-07-19:g_plus_1`, carrying `dependency.source.date =
   2026-07-19` — the exact record the test pins).
2. Under leg (ii), **21/21** such resolves expire it at stage 2
   (`buildDerivedSessionExpiryCandidates`, the gateway's pre-score expiry):
   candidate `Recovery/recovery/Light/6ex` → post-expiry
   `Mixed/core/High/5ex`. Flags-off, **0/3** such resolves expire it and the
   committed Monday is `Mixed/recovery/Light/7ex`.
3. The caller stacks name the path: all 21 expiring resolves come from
   **`scaffoldSection18TierFour` (`sessionResolver.ts:984`) with
   `hasActiveFixtureDates=false`**. Every resolve that carried the authority
   (`fixtureMinimalReplan:1195`, `stageAcceptedStateTransaction:678`,
   `hasActiveFixtureDates=true`) is downstream of the tier-4 projection and
   never sees the recovery — staging composes the dependent week FROM the
   projection that already expired it. That is how the loss reaches the
   STORE, which is what the test reads.
4. The mechanism at source: the record's guard is `invalidWhen:
   fixture_absent 2026-07-19` (exact date). `expiryReason` →
   `exactFixtureDatePresent` honours the exact date ONLY when the caller
   supplies `activeFixtureDates`; otherwise it falls back to
   `fixtureDatePresent` — day-of-week membership in THIS week's contract
   anchors. A cross-week dependency's fixture lives in the PREVIOUS week's
   contract, so the fallback is structurally false for exactly the class of
   sessions built to survive across weeks. `sessionResolver.ts` contains
   ZERO occurrences of `activeFixtureDates`; the write/staging owners thread
   it everywhere (`acceptedStateTransaction.ts:1849 → :1997`).

**Named in one sentence:** tier 4 at read lacks the exact-date fixture
authority the write path always carried, so the expiry guard degrades to a
single-week check that kills every cross-week fixture-linked derived session
— the G+1 recovery and its dependency record with it.

**Fix shape (offered, unpriced, not built):** thread the fixture-date
authority to tier 4 the same way the boundary ruling handled
`governedFromISO` — as an input the projection assembly owns, not a per-guard
special case. The expiry guard itself is behaving as designed given its
inputs. STOP note: the G+1 recovery implements the Bible's fixture-release
law and the provenance/expiry machinery implements the derived-session
rulings — the fix as shaped touches neither's signed sentences, but the
pricing run decides, as always.

## THE COMPRESSION, PROPOSED (sighting 2)

`governedFromISO` (fourteenth/fifteenth pass) and `activeFixtureDates` (this
pass) are the same shape: an authority input threaded by write/staging
callers and silently absent at tier-4-at-read, discovered each time by a
downstream suite. The compression is the `369af59d` census-gate shape aimed
at the GATEWAY INPUT SURFACE: enumerate `Section18AcceptedWeekGatewayInput`'s
authority-bearing fields, and for every call site assert each field is either
supplied or carries a declared exemption. Both directions, like the
profile-door gate. Proposed for the seat; belongs to the build unit.

## NOT COVERED

- Roots #2–#6 of the seat's order (`program-control-durable` next) are not
  instrumented; nothing here is assumed to transfer.
- Flags-off's 3 keeping resolves predate the `hasActiveFixtureDates` tape
  field; their authority is inferred from source (the callers that thread
  it), not from a tape record.
- The hydration pass-2 intermediate "Mixed" signatures (composition-layer
  input to the gateway) were observed, not chased — the order attribution
  did not need them.
- Neither fix is designed beyond shape; neither is priced; nothing landed.
- The MOVE window's 2026-07-13 (decided-week) resolves were not analysed —
  the decided week's declaration assertions PASS in both arms.
