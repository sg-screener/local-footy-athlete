# THE RULED MECHANISM IS REFUTED — 2026-08-06

STOP under CLAUDE.md's escalation rule, raised BEFORE any code was written.

`docs/MICROCYCLE_SELECTION_RULING_2026-08-06.md` rules that the L16 red is a
week composed against `currentMicrocycle`-as-of-today instead of against the
microcycle whose range covers it, and orders a covering-selector owner plus a
two-directional cell. **Measurement refutes the mechanism.** Selection is
already by coverage at every site that composes the failing week, and the cell
condition 2 asks for would pass on both sides of the switchover on day one.

The pin at `24e55110` retracted its predecessor's hypothesis. This document
retracts the pin's, on the same terms and with the same method: measure, name
the diverging input, propose nothing until it is named. **The real mechanism is
named and proven two-directionally below. Nothing is built.**

## 1. The ruled mechanism, refuted

`selectMicrocycleForDate` (`programBlockState.ts:432`) was instrumented to log
how each selection resolved. Across a full `test:action-walker` run:

| resolution | calls |
|---|---|
| `exact` — a microcycle whose range COVERS the date | **2,538** |
| `fallback` — the caller's `currentMicrocycle` | **0** |
| `single` — the one-microcycle shortcut | **0** |

The fallback arm never fires. In the failing world the covering selector is
handed `fallback=mc-ai-4@2026-08-03` and returns `mc-ai-2@2026-07-20` anyway.

The four inline copies of the same predicate (`acceptedEffectiveWeek.ts:74`,
`postGenerationConstraintValidation.ts:1722`, `acceptedStateTransaction.ts:444`
and `:1064`) are coverage-guarded by construction: each returns
`currentMicrocycle` ONLY if it covers the week asked for.

`currentMicrocycle` does move `mc-ai-2 → mc-ai-4` across the relaunch — the pin
observed that correctly. **No site composing week `2026-07-20` reads it.** The
week composes against `mc-ai-2` on both sides:

```
[REBASE] week=2026-07-20 base=mc-ai-2/build ... current=mc-ai-4
```

Select-by-coverage is already the behaviour. Building it as a "fix" and landing
condition 2's cell green would be a gate passing on coordinates it never
builds — the shape Sam named after four sightings.

## 2. What actually moves

Not the microcycle. The week's CONTRACT IDENTITY:

| probe | loop 1 (no fixture) | loop 2 (Saturday fixture) |
|---|---|---|
| overlay mode BEFORE relaunch | `mid_preseason` | **`practice_match_week`** |
| overlay mode AFTER relaunch | `mid_preseason` | **`mid_preseason`** |
| result | PASS | **FAIL** |

`mid_preseason` is `mc-ai-2`'s OWN mode. Byte-identical either side of the
relaunch, and identical in both loops:

```
mcs=mc-ai-1@2026-07-13/build/early_preseason,
    mc-ai-2@2026-07-20/build/mid_preseason,      <- the covering week, both sides
    mc-ai-3@2026-07-27/build/mid_preseason,
    mc-ai-4@2026-08-03/deload/late_preseason
markedDays={"2026-07-25":"game"}                  <- survives, both sides
```

So the base microcycle was never a practice-match week, before OR after. The
practice-match identity existed only in the OVERLAY — the stored output option
2 correctly stopped storing. Only the loop that has a fixture reds, which is
why this is invisible in loop 1.

## 3. The diverging input, named

**The fixture fact has two representations, and boot restores the wrong one
first.**

1. `markedDays` — the calendar mark, persisted and rehydrated at boot.
2. The `fixture_add` entry in the decision ledger — the athlete's decision.

`rebuildDerivedWorld` restores the mark (`quiescentBoot.ts:304`,
`markedDays: useCalendarStore.getState().markedDays`) BEFORE it replays the
ledger. The replayed decision then finds the fixture already on the calendar
and refuses as a no-op:

```
[REPLAY-FIXTURE] kind=fixture_add action=add todayISO=2026-07-20 outcome=no_change
```

`fixtureMutationTransaction.ts:263-272` — *"The requested fixture is already
present."* The mark is restored; the WEEK the mark implies is never composed.

Generation cannot supply it either: `generateProgramLocally` takes no marked
days, so the anchored rebuild produces an ordinary `mid_preseason` week. There
is no reader anywhere in the boot path that turns the surviving mark back into
a practice-match week.

**The mark restores. Its consequences do not.**

## 4. The proof, two-directional

Two controlled runs of the full walker, differing only in whether the restored
mark is allowed to pre-empt the replayed decision:

| world | L16 slice | walker totals |
|---|---|---|
| mark restored before replay (shipped) | **FAIL** | 19 passed, 1 failed, `EXIT=1` |
| mark left to the ledger to re-establish | **PASS** | **20 passed, 0 failed, `EXIT=0`** |

In the green run the replayed decision is no longer a no-op —
`outcome=regenerated` — and the overlay comes back `practice_match_week`,
matching what the athlete accepted. Restore the mark first and it reds again.
This is a measured mechanism, not a hypothesis consistent with the evidence.

## 5. A second, separable defect — the harness enters below the door

The L16 world contains **no fixture decision at all**. Its ledger is
`plan_change` only.

`mark_calendar` (`athleteActionWalkerTests.ts:542`) enters
`executeFixtureMutationInMemory`. That function is documented as a *"screen-neutral
in-memory compatibility seam"*; only the durable
`executeFixtureMutationTransaction` appends, and says so at
`fixtureMutationTransaction.ts:802` — *"ONLY the durable door appends."*
Production enters the durable door (`useHomeScreen.ts:1053`,
`homeGameMutationController.ts:127`).

The walker's comment claims it walks the fixture door. It walks the seam
beneath the door's ledger append. **Sixth sighting** of
`harness-enters-below-the-door`.

**It is not the cause.** Adding the missing entry and changing nothing else
leaves the slice red — the replayed decision still answers `no_change`. Both
changes are required for the green in §4: the harness must record the decision,
and boot must stop pre-empting it. The product defect in §3 stands on its own
and is not a harness artefact.

`b alone` was not measured and cannot be, in this world: with no entry to
replay, withholding the mark deletes the fixture outright.

## 6. The reassessment (CLAUDE.md), as far as measurement answers it

1. **Source of truth.** Intended: the decision ledger plus the life-facts.
   Actual: for a fixture, TWO inputs claim the same fact, and the derived one
   (`markedDays`) is restored ahead of the deciding one.
2. **How many representations.** Two, and they are not reconciled — they race,
   and the mark wins by arriving first.
3. **Where intent is reinterpreted.** At `resolveFixtureMutation`: a decision
   being REPLAYED is judged by whether its effect is already visible, so a
   faithful replay is indistinguishable from a duplicate tap.
4. **Which layer should own it.** THE QUESTION FOR THE SEAT. Either the ledger
   is the only fixture input at boot and `markedDays` is derived from it (what
   §4's green run does, and what `NORTH_STAR.md` presumes), or generation reads
   the fixture facts so the base microcycle IS the practice-match week and no
   overlay is needed. Both are one-representation designs.
5. **Simpler architecture.** Not proposed here on purpose — proposing one
   before the mechanism is ruled is how the last two hypotheses got approved.
6. **Legacy paths.** Unchanged; leg (i)'s remaining deletions stay parked.
7. **Tests that prove the boundary.** The L16 slice already is one, and §4
   shows it is two-directional on the REAL mechanism.

## 7. What of the ruling stands

- **Condition 4 stands unchanged.** Option 2's stale-contract correction is
  still right, the L16 slice still greens unedited (§4 greens it without
  touching the cell), and the merge stays blocked on `BIBLE_TRUE_EXIT=0`.
- **Condition 3 stands.** The inert `setWorldClock()` seam is still inert and
  still its own unit. It is now known to be unrelated to this red: the covering
  selector is date-independent in fact, not just in principle.
- **Conditions 1 and 2 are refuted as this fix** and are NOT built. The
  covering predicate genuinely is written five times and collapsing it is a
  real convergence — but it is a tidy-up, and it would green nothing.

## 8. Also recorded

The background-task completion notification for the first walker run reported
**exit code 0** for a run whose own totals line said `19 passed, 1 failed`;
a direct `echo $?` on the same command returned **1**. Third recorded sighting.
Only the printed line was trusted.
