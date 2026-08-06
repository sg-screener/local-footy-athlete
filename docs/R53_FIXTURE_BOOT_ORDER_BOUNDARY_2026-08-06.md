# FIXTURE BOOT ORDER — BUILT, AND THE NEXT RED NAMED — 2026-08-06

Builds `docs/FIXTURE_BOOT_ORDER_RULING_2026-08-06.md` (option (a)). Both halves
landed; the L16 slice greens UNEDITED. **The bible still cannot reach
`BIBLE_TRUE_EXIT=0`** — a second option-2 red was sitting behind the walker and
is bisected below. Nothing is built for it.

## Convergence (NORTH_STAR)

**TOWARD.** One representation removed, none added. The fixture marks stop being
a restored output that pre-empts their own decision; the decision ledger becomes
the only fixture input at boot, and `markedDays` becomes its projection.

## Condition 1 — the blast radius, measured BEFORE landing

`markedDays` has **273 references across 40 product files**. The census that
matters is not that number — it is who OWNS the value:

| role | count | verdict |
|---|---|---|
| takes `markedDays` as a PARAMETER | 244 | consumers; the caller owns the value |
| reads `useCalendarStore(...).markedDays` directly | 16 | live readers of the store |
| reads `acceptedMaterialContext.markedDays` | 13 | the accepted mirror, republished per commit |
| WRITES the persisted map | **1** | `applyCalendarMarkedDaysWrite` — the one door |

Every write already terminates in one door (armoured 2026-08-03, store-armour
recipe). **This unit adds no writer** — it adds one CALLER of the existing door,
`quiescent_boot`, so the tape names it like every other write.

### Mark producers, by origin

| producer | mark | in the ledger? |
|---|---|---|
| fixture door — add / move / remove | `game`, `noGame` | **YES** (`fixture_add` / `_move` / `_remove`) |
| onboarding recurring seed (`onboardingCompletion.ts:147`) | `game` | **NO** — it is a PROFILE ANSWER (`gameDay`), not a decision |
| coach mark apply / undo (`coachCommandExecutor.ts:4234`, `coachUndoEngine.ts:354`) | `rest`, `game`, `noGame` | coach units, LR-6 STOP |

**This is what the census was for.** Had boot simply dropped the marks and
replayed, every in-season athlete's recurring fixtures would have vanished —
they are seeded from a profile answer and no ledger entry records them. So boot
re-derives them through the SAME pure function onboarding seeds them with
(`computeGameDatesForBlock`), which is a derivation of a persisted INPUT, not a
restoration of a stored consequence. That is why it is not the rejected option
(b): nothing is fed back into generation.

`rest` marks are NOT fixture marks. They are left untouched and declared out of
scope — narrowed deliberately, not silently widened.

### Sites treating `markedDays` as an independent persisted fact

Named, as the condition requires. **All four remain correct and none is routed
away**, because after this unit `markedDays` is still persisted — what changed is
that boot no longer lets the persisted FIXTURE marks pre-empt the ledger:

| site | claim | verdict |
|---|---|---|
| `persistedInputsSchemaTests.ts:91` | `calendar-storage.markedDays: 'fact'` | STANDS. A mark is still a life-fact on disk; the ruling governs BOOT ORDER, not whether the key persists. |
| `legacyReckoningCensus.ts:144` | one door, taped | STANDS, and this unit uses that door. |
| `coachMutationTransaction.ts:145` | accepted-mirror snapshot key | STANDS — rollback restores what it captured. |
| `appHydrationGate.ts:71` | rehydrates the store | STANDS — hydration still loads the key; boot re-derives the fixture half after it. |

The one thing that did NOT stand is the claim in `fixtureMutationTransaction`
that "ONLY the durable door appends" — see condition 2.

### Idempotency is witnessed by the ledger, not by the mirror (R2 precedent)

- Replay cannot append: `appendDecisionEntry` returns before writing while
  `ledgerReplayActive()` (`decisionLedgerStore.ts:269`). That latch is what keeps
  replay out — **not** the choice of door, which is what condition 2 corrects.
- `deriveBootFixtureMarks` is a pure function of (persisted non-fixture marks,
  `profile.gameDay`, the generated block bounds). Running boot twice writes the
  same map.
- Witnessed: `test:quiescent-boot` **4/4**, `test:worn-world-boot` **4/4**.

## Condition 2 — the seam is no longer beneath the decision record

The append moved out of the durable door into `appendLandedFixtureDecision`,
called by BOTH doors at the same point. The in-memory seam is still the seam for
persistence and verification; it is no longer a seam beneath the RECORD.

The old note said replay is kept out by entering the quiet door. It is kept out
by the ledger's own replay latch, which is the honest guard and was already
there. Recording the decision is now a property of the decision LANDING, not of
which door the caller reached.

The walker needed no change: it already enters `executeFixtureMutationInMemory`,
which now appends. **Deviation declared:** the ruling's words were "enters
through the durable door". `performAction` is synchronous and
`executeFixtureMutationTransaction` is `async` by construction, so the walker
cannot call it — the same reason the two schedule doors are walked separately
(`athleteActionWalkerTests.ts:584-591`). The purpose the condition names — both
halves present, the seam retired for this action — is met at the append itself,
which is the thing that was missing.

## Condition 3 — the L16 slice greens UNEDITED

`athleteActionWalkerTests.ts` is untouched by this unit.

```
Action walker totals: 20 passed, 0 failed        EXIT=0
```

Measured green, off printed lines:

| suite | result |
|---|---|
| `test:action-walker` | 20/0 |
| `test:quiescent-boot` | 4/0 |
| `test:worn-world-boot` | 4/0 |
| `test:calendar-ownership` | 7/0 |
| `test:deletion-calendar-ownership` | 4/0 |
| `test:decision-ledger-ownership` | 8/0 |
| `test:door-ledger-append` | 5/0 |
| `test:persisted-inputs-schema` | 8/0 |
| `test:stored-state-writer-audit` | 10/0 |
| `test:legacy-census` | 375/375 |
| `test:work-bill` | 6/0 |
| `test:compile` | 0 |

### One red was mine and is paid, not retuned

`test:legacy-census` went 375/375 → 373/375 on the first cut: LR-4's
`mirrorDecisionReads` detector counted **72 where 71 are declared**. The 72nd was
my own type annotation —
`ReturnType<typeof useProfileStore.getState>['onboardingData']` — which the
detector reads as a profile-mirror consumer. **The number was not retuned.** The
parameter now names the one field the function consumes (`{ gameDay?: string }`),
the hit is gone, and the ceiling is untouched at 375/375.

## THE NEXT RED — bisected, NOT caused here, and NOT fixed here

`test:fixture-identity` is **3 passed, 3 failed** — cells 3, 5 and 6. It has
been red since before this unit and was invisible because **`test:bible` stops at
the first failing suite**: the walker red was in front of it.

| tree | `test:fixture-identity` |
|---|---|
| `feat/stage-b-stage2` (merge target) | **0 failed** (5 cells) |
| `1b6bbd80` (last before option 2) | **6 passed, 0 failed** |
| **`a13bb51a` — option 2 BUILT** | **3 passed, 3 FAILED** |
| `50d58ebc`, `bb2dd6a0`, HEAD | 3 passed, 3 failed |

**Option 2 again, the same commit as the L16 red.** This unit does not move it
(measured identical before and after).

### Why, and why it is the seat's call

Leg (i) originally DELETED the fixture week's overlay. Option 2 changed it to
publish `{...overlay, workoutsByDate: {}}` — an overlay that carries a CONTRACT
and no sessions. Cell 3 drops the published overlay and re-derives from the same
inputs; with a stored declaration in play, the two answers differ:

```
2026-08-10=Lower Hinge|7  ->  2026-08-10=Lower Squat|8
```

**The repo already named this shape.** `fixtureIdentityTests.ts:120` records the
V1/V2/V3 pricing from the branch's own first commit: `V1 = leg (i) only → cell 3
RED`. Option 2 as built is that shape with a declaration attached, and it was
approved on §18 and freed-day measurements without being run against these cells
— the same gap the STOP doc closed for the relaunch law.

Both rulings say option 2's stale-contract correction STANDS, and it is real: a
cancelled game was paying the week's conditioning, sprint and hard-day bills.
So the two live options are:

- **Revoke the declaration** — greens the cells, reopens the stale contract.
- **DERIVE the declaration** — the contract for a fixture-decided week is
  computed from the life-fact plus the profile, not published. Dropping the
  overlay then changes nothing, cell 3 greens, and the stale contract stays
  fixed. This is the same shape as the fix in THIS unit, one layer up: a stored
  output pre-empting its own derivation.

The second is the north-star answer and is what the reconciler leg (ii) deleted
was half-doing. **It is not built here** — it reshapes an approved design, and
proposing it as done is how the last two mechanisms got approved on partial
measurement.

## Status

- Boot-order unit: **COMPLETE and green.**
- `BIBLE_TRUE_EXIT=0`, condition 4, the merge, R5.7: **BLOCKED** behind the
  fixture-identity ruling above.
