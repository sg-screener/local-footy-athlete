# THE DECLARATION READER CENSUS — ENTRY GATE — 2026-08-06

Condition 1 of `docs/DERIVED_DECLARATION_RULING_2026-08-06.md`: enumerate every
reader of the published declaration BEFORE reshaping, route or retire each,
measured not assumed. **Nothing is reshaped in this document.**

The gate did its job. It found something the ruling did not know, and it
sharpens (b) rather than refuting it.

## THE FINDING — the published declaration is not merely redundant. It is WRONG.

The published declaration and the covering microcycle's contract were diffed
leaf by leaf inside `fixture-identity-3`'s own world (probe, since reverted):
**38 of 135 leaves differ.** Almost all of them are the fixture doing its job —
a `practice_match-6` anchor appears, `identity.mode` becomes
`practice_match_week`, and conditioning / mainStrength / power / sprint / rest
targets move downstream of it. Those are a pure function of the fixture fact and
are exactly what (b) must reproduce.

Two leaves are not:

| leaf | covering microcycle | PUBLISHED declaration |
|---|---|---|
| `identity.globalWeek` | **2** | **1** |
| `identity.weekInBlock` | **2** | **1** |

The published declaration says the athlete is in week 1 of the block. The
microcycle that covers that very week says week 2. **This is not a second
opinion — it is a default.** `weeklyExposureContractV2.ts:1224` stores
`globalWeek: input.globalWeek ?? null` and
`section18AcceptedWeekGateway.ts:223` reads `args.contract.identity.globalWeek ??
1`. A builder that was never told which week it was building stamps `null`, and
the gateway turns `null` into 1.

**That is the mechanism of cells 3, 5 and 6.** The strength allocator alternates
on the week number (`programBlockState.ts:190-205` — "since the allocator
alternates on `weekNumber % 2`, the mirror week's patterns were planned onto the
real week"). Week 1 patterns get planned onto week 2. It is visible in the cell's
own failure text:

```
2026-08-10=Lower Hinge|7   (published, built as week 1)
2026-08-10=Lower Squat|8   (derived,   built as week 2)
```

And the suite's own header already records which of those is right — the
branch's first commit priced `V3 = both → BOTH GREEN, Monday Lower Squat|8`
(`fixtureIdentityTests.ts:122`). **`Lower Squat|8` is the derived side.**

### A correction the seat should have

Cells 5 and 6 say "a second composer is a second truth **even when neither is
wrong**". In this instance one IS wrong, and it is the published one. Deriving
the declaration does not merely remove a representation — it repairs a
week-identity defect that option 2 has been shipping since `a13bb51a`. This is
the fifth sighting of the class in `week-identity-two-owners`: an identity that
was defaulted rather than derived.

## The census — every reader of the published declaration

**30 read sites across 13 modules.** The controlling fact: there is no owner of
"the week's declared contract". The precedence
`overlay.exposureContractV2 ?? coveringMicrocycle.exposureContractV2` is written
out LONGHAND in nine places. That missing owner is what the ruling asks for, and
routing the readers collapses nine copies onto it.

### Class A — the declaration precedence, longhand (ROUTE to the derivation)

| site | shape |
|---|---|
| `rules/acceptedEffectiveWeek.ts:102` | `overlay ?? base` — the precedence owner for a visible week |
| `store/acceptedStateTransaction.ts:450` | `overlay ?? covering` before `rebaseAcceptedEffectiveWeek` |
| `store/acceptedStateTransaction.ts:1058` | `contractForAcceptedWeek` |
| `store/programStore.ts:1165` | `safetyContractForDate` |
| `store/programStore.ts:1234` | `overlay ?? base` before rebase |
| `utils/postGenerationConstraintValidation.ts:1532` | `overlay ?? microcycle ?? migrate(legacy)` |
| `utils/section18ProgramObservation.ts:44` | `resolveOverlaySection18Contract` |

### Class A′ — EXISTENCE predicates on the same precedence (ROUTE)

Each asks only "does this week have a declaration?", and each will answer the
same once the derivation always answers.

| site | what it gates |
|---|---|
| `utils/visibleProgramReadModel.ts:29` | whether the week has an accepted contract |
| `utils/sessionResolver.ts:1677` | the Contract v2 early return — the accepted week owns composition |
| `utils/postGenerationConstraintValidation.ts:716` | suppresses the legacy exposure ledger |

### Class B — OTHER doors author overlay contracts (NAMED, out of scope)

**This is the class that decides how far (b) reaches.** The overlay contract is
not a fixture artifact alone; two other doors write one, and they carry
REDUCTIONS:

| site | what it authors |
|---|---|
| `store/temporarySourceFactTransaction.ts:400-435, 583` | scoped regen for a source fact (illness/injury) re-resolves the week's contract against active removals |
| `store/reversibleAdjustmentTransaction.ts:549-581` | undo REVERSES owned reductions on the stored contract |
| `utils/postGenerationConstraintValidation.ts:1735` | validates a candidate overlay WRITE — the caller owns the candidate by design |

The ruling scopes (b) to the fixture door: "the fixture door stops publishing a
declaration artifact". These three keep writing, and the derivation owner must
therefore still PREFER a stored overlay contract when one exists — it is a
different door's decision, not the fixture's. **The derivation replaces the
fixture door's publication only.** Stated here because assuming otherwise would
delete illness and undo state, and the gate exists to catch exactly that.

### Class C — persisted-shape validation and legacy migration (NAMED, untouched)

| site | role |
|---|---|
| `store/programHydrationIngress.ts:127, 160` | refuses an envelope whose overlay contracts are not current-protocol |
| `store/programStore.ts:1115, 1124` | migrates a legacy overlay contract at hydration |

These read the SHAPE on disk, not the declaration as a decision. They stay.

### Class D — dev / E2E surfaces (NAMED, follow the readers)

`dev/e2e/devE2ESeedRegistry.ts:473, 1105`, `dev/e2e/explorerCanonicalLiveHost.ts:346`.

## What the build must therefore be

1. **One derivation owner** for the week's declared contract:
   `overlay contract (another door's decision) ?? derive(covering microcycle
   contract, the week's fixture facts, profile)`. The derived branch is the new
   half; it must carry the COVERING microcycle's week identity, which is the
   defect above.
2. **The fixture door stops publishing** its declaration.
3. **Class A + A′ route onto the owner** — nine longhand copies collapse to one.
4. Classes B, C, D are named and unchanged.

The stale-contract correction is subsumed exactly as the ruling says: a
derivation reading the current fixture facts cannot outlive them, so a cancelled
game cannot go on paying the week's bills.

## Status

Entry gate: **COMPLETE.** Nothing reshaped. The build is next and is large — a
new derivation owner plus ten routed readers — and the witness set in condition 2
decides it, unedited.
