# R5.3 FOUR-LEG PRICING — STOP — 2026-08-07

Prices `docs/LEDGER_LINK_DERIVATION_RULING_2026-08-07.md` (leg iv) with
legs (i), (ii), (iii) and the provenance rule. Discharges the same
ruling's three ordered items, and applies
`docs/STANDING_DERIVATION_RULING_2026-08-07.md` for the first time.

**NOT GREEN — nothing built into the main build, nothing merged.**

Scaffold: `scratch/r53-pricing-7` (`901ba9b9`), branched from
`scratch/r53-pricing-6`, which is preserved unchanged along with
`-5` and `-5-before`.

## Ordered item 1 — THE BISECT. Cause named: `a13bb51a`, one file, one field

`fixture-identity` was 6/6 green at `bd5a0abb` and 3 red at `a13bb51a`,
unchanged red at every one of the seven code commits since. Only 8 of
the 48 commits after `0d913c1e` touch code, so the bisect ran them all
rather than halving.

Reverting `a13bb51a` file by file names the owner outright:

| file reverted to `a13bb51a^` | fixture-identity |
|---|---|
| `section18AcceptedWeekGateway.ts` | 3 red |
| `section18OfferPlacement.ts` | **6 red** (worse) |
| `weekRebuild.ts` | **6/6 GREEN** |

The field, not just the file: publishing the overlay with
`exposureContract`/`exposureContractV2` set to `undefined` — everything
else in `a13bb51a` intact — reprints **6 passed, 0 failed**.

So the cause is one sentence. `weekRebuild.ts:562` publishes the fixture
decision's week DECLARATION into `weekScopedOverlays`. Cell 3 asks
whether the published week equals the week derived from the same inputs;
it does not, because the published contract is itself one of the inputs.
**A stored contract is a second truth, and this is the one that predates
every leg.**

It is not a regression anyone hid. `a13bb51a` published the contract for
a measured reason — deleting the overlay outright left the decided week
judged against the microcycle's STALE contract, so a cancelled game went
on paying the week's bills. That commit's message reports its residual
honestly (phase-structure cell 8) and simply never re-ran this suite.

## Ordered item 2 — CELL 7. Named cause, and it is a BASIS mismatch

Cell 7 is green flags-off and green under leg (iii)+provenance; it is
red under **leg (i)**, alone (5 blocking violations) and with all four
(3). Leg (ii) alone is 24/24. So cell 7 is leg (i)'s cost.

Two hypotheses were built and REFUTED by measurement before the cause
was found — `withRemovalLedger`'s idempotence guard, and the rebuild
path's carried reductions. Neither moved a cell. The third measurement
found it, and it is not a guard at all:

`rebaseAcceptedEffectiveWeek` derives the contract with
`workouts: composedWorkouts`, then evaluates conformance against
`visibleWorkouts` — and `resolveFinalVisibleSection18Week` sits between
them. In cell 7's practice-match world those are different weeks:

```
composed: 1:Rest  2:Mixed 3:Mixed 4:Strength        6:Mixed
visible:         2:Mixed 3:Mixed 4:Strength 5:Strength 6:Game
composedLedger (main strength achieved) = 3
visibleLedger  (main strength achieved) = 2
```

`applyAthleteRemovalTypedReduction` lowers by `Math.min(target, actual)`
with `actual` read off the composed week. `min(3, 3)` lowers nothing, so
the contract still demands 3 while the week that gets judged has 2 —
`planner_selected_target_miss`, `required_minimum_shortfall`,
`pattern_restore_failure`. The reduction ENTRIES are all present and
correctly linked; **only their arithmetic is measured against the wrong
week.**

The install site's own comment says the derivation sits after
composition "deliberately… measured against the composed week". That
ordering is the defect, and it cannot be fixed by moving the call
earlier: the resolver needs the contract the derivation produces.

**Declared payer: leg (iii)'s install site 1**, as an ordering question
the four-leg design has not yet answered. Diagnosed, not fixed, as
ordered.

## Ordered item 3 — THE MEASUREMENT-METHOD LAW, and its second sighting

**Env assignments are always written literally, never through a single
expanded variable.** In this shell an unquoted parameter expansion is
not word-split, so `env $pair npm run …` sets ONE variable whose name is
the first assignment and whose value is the rest — a clean-tree run
wearing a pair's label. Every measurement in this report uses literal
`LFA_SCAFFOLD_LEG_I=1 LFA_SCAFFOLD_LEG_II=1 … npm run …` prefixes.

SECOND SIGHTING, same unit, one layer out: `npm run test:x 2>&1 | tail`
reports the exit status of `tail`, not of npm. A first pass of this
pricing printed `TRUE_EXIT=0` on eleven suites of which five were red.
Fix used here and from now on: run the suite REDIRECTED to a file,
capture `$?` on the next line, then read the file.

Both are the same shape as `[[half-mutation-proves-nothing]]`, in the
harness rather than the witness. Loop-audit counter: **2 of 3.** At the
third the compression is `gate.sh` writing the exit line to a file,
already queued as roadmap phase 1.5.

## Leg (iv) — BUILT, FREE, and it moves both cells

Two install sites in `stageReversibleAdjustmentCreationTransaction`:

1. `linkedTypedReductions` derives from the DECISION — the constraint
   ids the adjustment already carries, read off the contract the week
   derives to via `rebaseAcceptedEffectiveWeek` (the reader's own owner,
   not a restatement of it) — never `acceptedLinkedReductions(after) −
   acceptedLinkedReductions(before)`.
2. `ownedWeeks` compares DERIVED contracts. Under leg (i) the stored
   fingerprint never moves, so a decision that changed what the athlete
   trains reported "nothing changed" and the undo had no contract to
   restore, nor any basis to refuse a corrupted one against.

**Leg (iv) ALONE is free**: deletion 24/24 · 5/5 · 3/3, accepted-state
23/23 · 10/10 · 10/10 — the clean baseline, byte for byte.

Both target cells advance past their first assertion:

- Cell 22: `owned typed reduction was not linked` → **the link
  populates**; it now fails one assertion later, on `owned reduction
  missing from accepted contract`.
- Cell 23: `gateway failure owned contract missing` → **the owned week
  exists**; it now runs the restore to completion and returns
  `conflicted` where the cell pins `safely-rejected`.

## The priced row — all four legs, no row worse

`LEG_I`, `LEG_II`, `LEG_III`, `PROVENANCE`, `LEG_IV`:

| witness | pricing-6 | pricing-7 | |
|---|---|---|---|
| derived-week lawfulness | 12/12 | 12/12 | clean |
| section18 gateway | 91/0 | 91/0 | clean |
| whole-week repair | 14/14 | 14/14 | clean |
| phase structure | 11/11 | 11/11 | clean |
| action walker | 20/0 | 20/0 | clean |
| day-precedence ownership | 6/0 | 6/0 | clean |
| typecheck gate | 459, none regressed | 459, none regressed | clean |
| athlete-session deletion | 21/24 | 21/24 (7, 22, 23) | red, both advanced |
| accepted-state | 22/23 · 8/10 · 10/10 | same | red |
| athlete-session move | 21/1 | 21/1 | red |
| fixture-identity | 3 red | 3 red | red |
| derived-repair-ownership | 4/0 | 4/0 | named vacuity |

Flags OFF the scaffold reprints the clean baseline on every suite —
deletion 24/24 · 5/5 · 3/3, accepted 23/23 · 10/10 · 10/10, move 22/0,
phase 11/11, walker 20/0.

### A finding the RED COUNT was hiding

`fixture-identity` reads "3 red" both flags-off and all-legs, and the
last two pricings recorded it that way. The cells moved in BOTH
directions underneath that identical number:

| cell | flags off | all legs |
|---|---|---|
| 3 | 2 of 7 days differ | **1 of 7** (improved) |
| 5 | 1 of 7 days differ | **3 of 7** (regressed) |
| 6 | 1 of 7 days differ | **3 of 7** (regressed) |

And the regression is not a count: cells 5/6 flags-off disagree only
about `Lower Squat|8` vs `|7`; under the legs they disagree about
PATTERN IDENTITY — `Lower Squat` vs `Lower Hinge`, `Upper Pull` vs
`Upper Push` on two more days.

`[[a-green-gate-is-a-claim]]` has a twin: **a RED count is a claim too.**
A suite total that does not move is not evidence that nothing moved.

## Leg (v) — the standing ruling APPLIED, and REFUTED by its own price

The bisect names a stored representation feeding a computation, so
`docs/STANDING_DERIVATION_RULING_2026-08-07.md` pre-gives the ruling: it
derives and retires, no seat round-trip. Built as leg (v) — the fixture
door publishes no contract; legs (iii)+(iv) reconcile at read, which is
the reconciling job publishing was hand-rolling.

Priced, and it does not survive:

| witness | four legs | + leg (v) |
|---|---|---|
| fixture-identity | 3 red | **1 red** (only cell 6) |
| athlete-session deletion | 21/24 · 5/5 · 3/3 | **13/24 · 0/5 · 0/3** |
| phase structure | 11/11 | **10/11** |
| action walker | 20/0 | **19/1** |

It buys condition 1 almost outright and costs eight deletion
regressions, every deletion property and every deletion mutation. That
is STOP condition 3 of the standing ruling — *the witnesses disagree
after the derivation is priced, so the mechanism is not what it seemed*.
Leg (v) is kept on the scaffold, flag-gated and inert, as the evidence
rather than deleted and re-derived by the next seat.

What it proves, and this is the useful half: **the published declaration
IS the whole of the flags-off fixture-identity red, and retiring it is
not free.** Something in the deletion path is reading that stored
contract for more than identity. Condition 1 is now a priced question
with a named owner instead of an unexplained baseline.

## The residual, named

1. **Cell 22's second assertion** requires the STORED overlay contract to
   carry the typed reduction (`overlay.exposureContractV2
   .authorisedReductions.find(deletionIdentity === …)`). That is the
   representation leg (i) retires. The link now derives correctly; the
   witness pins the retired copy one line later. This is a witness/design
   collision, not a build defect, and per the discipline the witness was
   NOT edited.
2. **Cell 23** reaches the restore and returns `conflicted` (accepted-
   after semantic state changed on 2026-07-15) where it pins
   `safely-rejected`. Two refusals, different words; not yet attributed.
3. **Cell 7** — diagnosed above, payer declared, not fixed.
4. **Condition 1** — `fixture-identity` 6/6 still unmet. Leg (v) shows
   the cause is reachable and the price is not yet payable.

## Standing

Not green, so **STOP with the residual named**. Nothing built into the
main build, nothing merged. The two tracked debts (hydration
snapshot-vs-live pin; the 146/172-stamp `todayISO` clock fix) remain
owed and NOT started. The queued snapshot-to-reference unit remains
queued, entry gate intact. The run home is not begun. STOP at R5 close.
