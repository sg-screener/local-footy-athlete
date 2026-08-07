# REPAIR WRITE-BACK RETIREMENT — ENTRY GATE — 2026-08-06

Condition 1 of `docs/REPAIR_WRITEBACK_RETIREMENT_RULING_2026-08-06.md`:
enumerate every read path of the accepted week and prove each re-derives —
*measured, not assumed, **before** the write is removed.*

**The write was not removed. Nothing was built.** The gate measured, and it
refutes the ruling's stated mechanism: readers do NOT re-derive, and the
compensating half the ruling relies on does not compensate.

Every number below is a printed line. All four instruments were reverted; the
tree this document lands on reprints `3 passed, 3 failed` and
`test:fixture-identity` exits 1.

## 1. The measurement — four variants, one witness set

Halves, as the ruling names them:

- **(i) retire the write** — `programStore.ts:1366-1418` stops applying the §18
  repair's output. The contract ledger and every Class B decision write are
  untouched; only the repair's CONTENT is withheld. This is a *stronger*
  mutation than `R53_DERIVATION_OWNER_STOP`'s, which withheld it only when the
  caller "declared no content" — the proxy that document said must not ship.
- **(ii) conform at read** — §18 runs as tier 4 inside
  `resolveWeekWithConditioning`'s Contract v2 branch (`sessionResolver.ts:1677`)
  and its output is never persisted. Projection is IDENTITY: at that point the
  candidate already IS the derived week, and re-deriving would both recurse
  (`resolveFinalVisibleSection18Week` calls this same function) and re-run the
  gap-fill the branch exists to suppress.

| variant | fixture-identity | athlete-session-deletion | accepted-state | phase-structure |
|---|---|---|---|---|
| **clean tree** | 3 pass, 3 fail | 24/24 · 5/5 · 3/3 | 23/23 · 10/10 · 10/10 | 11/11 |
| **(i) alone** | **5 pass, 1 fail** | **16/24 · 0/5 · 0/3** | 22/23 | 10/11 |
| **(ii) alone** | 3 pass, 3 fail | 20/24 · 5/5 · 3/3 | — | 11/11 |
| **(i)+(ii) — as ruled** | **3 pass, 3 fail** | 20/24 · 5/5 · 3/3 | 21/23 · 9/10 · 10/10 | 11/11 |

Every clean-tree baseline is fully green, so nothing here is misattributed.

Three readings, none of them the ruling's:

- **The ruled design does not green the cells it was ruled to green.** (i)+(ii)
  leaves fixture-identity exactly where the clean tree leaves it, and it is
  **worse than its own first half** — under (i) alone the suite reads 5/1.
- **The two halves do belong together.** (i) alone destroys all five deletion
  properties and all three mutations and reds phase-structure; adding (ii)
  restores every one of them. The ruling's instinct — a withheld repair must be
  re-derived somewhere — is right.
- **Neither half, nor both, satisfies condition 4.** The witness set is red in
  all three variants.

## 2. The entry gate's own question, answered: NO

> no reader may see the unrepaired week

Measured false. Under (i) the deletion witness — the surface the ruling names as
"the one that already charged 14 regressions once" — charges **eight
regressions, five properties and three mutations**. Those are readers seeing the
unrepaired week. The read-path census below says which shapes can, and the run
says they do.

And the code comment above the write predicted this exactly: *"a fix that simply
deleted the write would pass the ownership assertions and lose every edit in the
app; `derivedRepairOwnershipTests` holds that cell open."* Under (i),
`test:derived-repair-ownership` prints **4 passed, 0 failed**. The ownership gate
is green on a tree where the app has lost sixteen cells' worth of edits — a
sixth sighting of `gate-passing-on-coordinates-it-never-builds`, and this time
the code called it in advance.

## 3. Why it cannot work — the two sides conform against different contracts

Probed inside `fixture-identity-3`'s own world, at the conformance site, both
sides of the cell's own comparison:

```
[R53_C] weekStart=2026-08-10 from=OVERLAY     mode=practice_match_week
        powerBudget=0  anchors=[team_training@2, team_training@4, practice_match@6]
[R53_C] weekStart=2026-08-10 from=MICROCYCLE  mode=mid_preseason
        powerBudget=1  anchors=[team_training@2, team_training@4]
```

Cell 3 drops the published OUTPUT and re-derives from the same inputs. Dropping
the overlay drops the **fixture-aware contract with it** — the covering
microcycle never learned the fixture. So the published side is judged as a
practice-match week and the derived side as a mid-pre-season week, and a
conformance pass makes the gap *wider*, not narrower: under (i)+(ii) cell 3
diverges on a **third** day (`2026-08-14 Gunshow|6 -> Lower Hinge|7`) that
neither the clean tree nor (i) alone disagreed about.

No choice of projection fixes this. The disagreement is upstream of content, in
**which contract the week is judged by**.

**The design is three-legged, not two.** (iii) is the derivation owner for the
week's declared contract — option (b) of
`DERIVED_DECLARATION_RULING_2026-08-06.md`, which `R53_DERIVATION_OWNER_STOP`
correctly measured as moving nothing *on its own* (§1: dropping only the
contract leaves the visible week byte-identical). That measurement is not
refuted; it is re-read. A contract derivation moves nothing alone because
nothing consults the contract for content at read — and nothing consults it
because there is no tier 4 at read. Leg (ii) is what gives leg (iii) a consumer.

**Unproven, and stated as unproven:** that (i)+(ii)+(iii) greens 3/5/6. It is
where the mechanism points and it is the only combination not yet refuted, but
building (iii) is a separate ruled unit and no number here measures it.

## 4. Cell 6's second route — measured, and NOT what the ruling assumed

Condition 3 requires cell 6's second route measured and owned, "same defect,
second door; no proxy left standing". The proxy is gone — the mutation above
withholds the write unconditionally — and cell 6 **still reds**. So the ruling's
account of it (the athlete's removal writes overlay content first, so the repair
composes onto it) is refuted: with the repair writing nothing at all, the
divergence survives.

Traced at the publish site, the two orders print different last publications:

```
cell 5  W2  removal→fixture   id=week-overlay:2026-08-10:one_off_no_game:no-anchor
                              2026-08-10=Lower Squat|8   ← agrees with the deriver
cell 6  W2r fixture→removal   id=week-overlay:2026-08-10:one_off_game:2026-08-15
                              2026-08-10=Lower Squat|7   ← disagrees
```

The route, by instrumented stack: `stageRollingHorizonFixtureRepair`
(`acceptedStateTransaction.ts:2133`) → `buildFixtureProjection` →
`buildFixtureMinimalReplan` (`fixtureMinimalReplan.ts:1181/1346/1494`) → the §18
gateway → `acceptedStateTransaction.ts:2806-2808`, which writes
`projection.overlay` straight into `weekScopedOverlays`.

**Cell 6's residual is the ATHLETE'S REMOVAL republishing the whole week as a
§18-conformant replan.** The athlete cleared one Wednesday; the door re-planned
seven days and published content the deriver never produces. That is the same
CLASS the fixture door's leg (i) addresses — a door publishing content — but it
is a different door, and it is not the repair write-back this ruling retires.

## 5. Condition 2 — the false census line, corrected

`R53_DECLARATION_READER_CENSUS_2026-08-06.md`, Class B, third row:

> `utils/postGenerationConstraintValidation.ts:1735` — validates a candidate
> overlay WRITE — **the caller owns the candidate by design**

Both halves are wrong, and independently re-measured here.

1. `validateLiveWeekOverlayWrite` fires **zero times** across the whole
   fixture-identity suite. It is not on this path.
2. It does not leave the candidate to its caller. At `:1773-1810` it runs
   `requireSection18AcceptedWeek`, diffs the result day by day, writes the
   repaired days into `workoutsByDate` and overwrites `exposureContractV2` with
   the gateway's contract.

**It is a SECOND §18 repair write-back**, structurally identical to the one this
ruling retires, reached from `programStore.ts:2088` (`setWeekScopedOverlay`) via
`postValidateWeekOverlay`. The retirement therefore has two doors, not one —
`reduction-masked-a-placement-defect`'s law ("doc named 1 site, there were 2")
for the second time in a week. A retirement that closes only
`programStore.ts:1404-1418` leaves "the §18 repair is never persisted" false.

### The writer census the reader census did not do

Every site that runs the §18 gateway and persists its output, by enclosing
function:

| site | enclosing | persists into | class |
|---|---|---|---|
| `programStore.ts:1285` | `canonicaliseAcceptedBoundaryState` | overlay `workoutsByDate` + `dateOverrides` + contract | **the ruling's target** |
| `postGenerationConstraintValidation.ts:1773` | `validateLiveWeekOverlayWrite` | the overlay being written | **second door, same class** |
| `postGenerationConstraintValidation.ts:1266` | `validateMicrocycleAgainstActiveConstraints` | the microcycle | constraint validation |
| `postGenerationConstraintValidation.ts:1357` | `validateWeekOverlayAgainstActiveConstraints` | the overlay | constraint validation |
| `postGenerationConstraintValidation.ts:1573` | `finaliseLiveDateCandidateAgainstWeek` | one date | single-date write |
| `programStore.ts:902` | `canonicaliseHydratedMicrocycle` | the microcycle | structural migration |
| `generateProgram.ts:715` | `buildGeneratedMicrocycles` | the authored week | **authoring — legitimate** |
| `fixtureMinimalReplan.ts:1181/1346/1494` | `buildFixtureMinimalReplan` | the published projection | **§4 above** |

## 6. The read-path census

**The deriver family** — would carry tier 4 if leg (ii) landed at
`sessionResolver.ts:1677`. 18 call sites: `visibleProgramReadModel`,
`deriveVisibleWeek` (the R1.2 derive owner), `coachDispatchDeps` (4),
`coachCommandExecutor` (3), `planChangeProducer` (2), `CoachScreen` (2),
`programAdjustmentEngine`, `injuryAdjustmentEngine`, `coachWeekDiff`,
`coachModalitySwapOrchestrator`, `quiescentBoot`,
`section18AcceptedWeekGateway` (its own projection — the identity case),
plus `resolveDateWithConditioning` (`visibleProgramReadModel`,
`lighterDayTransaction`, `coachActions`) and
`resolveMonthIndicatorsWithConditioning` (`useSchedule`).

**The raw family** — no conditioning, no §18, would NOT re-derive:
`applyAdjustmentEvents:1536`, `applyAdjustmentEvents:2023`,
`coachModalitySwapOrchestrator:527`.

**The composer, no tier 4** — `rebaseAcceptedEffectiveWeek`, 19 call sites
across `acceptedStateTransaction` (10), `planChangeProducer` (3),
`temporarySourceFactTransaction` (3), `programStore`, `coachCommandExecutor`,
`fixtureMutationTransaction`, `reversibleAdjustmentTransaction`.

**Direct stored-content readers** — bypass every resolver:
`gameChangeCoachNotes:279`, `section18ProgramObservation:67`,
`rollingHorizonRepair:139`, `acceptedStateTransaction:3481` (`todayWorkout`),
`dayPrecedence:154` and `sessionResolver:937` (tier 2, by design).

The ordering owner already declares the answer — `rules/dayPrecedence.ts:19`
states tier 4 as *"§18 — the accepted week's conformance pass, last."* The live
deriver does not run it. The store runs it and persists the result instead. That
is the whole defect in one line, and it is why leg (ii) is not optional.

## Status

- **Entry gate:** COMPLETE. Its answer is **NO** — readers do not re-derive.
- **The write:** NOT removed. **Nothing built, nothing merged.**
- **The ruling's mechanism:** refuted as a two-legged design. (i)+(ii) does not
  green 3/5/6 and is worse than (i) alone; the missing leg is the contract
  derivation, and the reason is printed in §3.
- **Condition 2:** the false census line is corrected in §5, and it found a
  second write-back door the retirement would have to close.
- **Condition 3:** cell 6's route is measured in §4 with no proxy standing, and
  it is a different door from the one the ruling assumed.
- **Condition 4:** NOT met in any variant.
- **Condition 5 (bible, merge, R5.7, remaining batches):** not started — it is
  gated on a build that did not happen.
- **Tree:** clean, `test:fixture-identity` reprints `3 passed, 3 failed`,
  unpiped exit 1.
