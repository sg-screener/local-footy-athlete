# R5.3 — STOP: THE SECOND HALF IS AIMED AT THE WRONG REPRESENTATION — 2026-08-06

The derived-declaration ruling's second half (`DERIVED_DECLARATION_RULING_2026-08-06.md`,
option (b)) was taken up for build: a derivation owner for the week's declared
CONTRACT, with the census's ten Class A/A′ readers routed onto it.

**Nothing was built.** Measurement before reshaping — the ruling's own condition
1 discipline — refutes the premise that this greens `fixture-identity` 3/5/6.
The residual is not in the contract. It is in stored week CONTENT, written by a
door the census did not enumerate as a writer.

Every number below is off a printed line on a clean tree at `fbeb6a5c`. All
instrumentation and both mutations were reverted; the suite reprints
`3 passed, 3 failed` on the tree this document lands on.

## 1. The residual is not the declaration

Cells 3/5/6 compare `resolveWeekWithConditioning` — the deriver — on two sides.
Probed inside `fixture-identity-3`'s own world after the fixture add:

| surface | Monday 2026-08-10 | Wednesday 2026-08-12 |
|---|---|---|
| published overlay content | `Lower Squat|7` | `Prehab & Accessories|6` |
| covering microcycle content | `Lower Squat|8` | `Prehab & Accessories|5` |

Then the decisive split — **keep the overlay's workouts, drop only its
contract**:

```
===== OVERLAY WORKOUTS KEPT, CONTRACT DROPPED =====
  overlay.contract identity = ABSENT
  VISIBLE = 2026-08-10=Lower Squat|7 ... 2026-08-12=Prehab & Accessories|6
```

**Byte-identical to the published side.** Removing the declaration entirely
changes nothing the cells measure. A derivation owner for the declared contract
— however correct it is on its own terms — cannot move a single one of these
days.

The week identity itself is now correct on BOTH sides (`globalWeek: 2,
weekInBlock: 2`), which is `fbeb6a5c` working exactly as it claimed. The
identity half of the entry gate's finding is paid. The count half is a different
defect.

## 2. Leg (i) IS built, and it is silently undone

`weekRebuild.ts:564` already publishes the fixture door's declaration with
`workoutsByDate: {}`. Traced at the commit boundary:

```
[R53] leg(i) publishing EMPTY content for 2026-08-10;
      incoming keys=[08-10,08-11,08-12,08-13,08-14,08-15,08-16]
[R53] commit reason="week_rebuild:overlay" overlays={"2026-08-10":0}
[R53] after commit, store overlay keys=[08-10,08-11,08-12,08-13,08-14]
```

**Zero entries go in; five come out of the same commit.** Leg (i) is not
failing to be correct — it is being reverted, inside the transaction it
publishes through, by a writer downstream of it.

## 3. The writer, named

`store/programStore.ts:1404-1418`, inside `canonicaliseAcceptedStateCandidate`'s
accepted-week repair loop. For each validated week it runs the §18 gateway,
diffs the result against the effective week day by day, and writes the repaired
days back:

```js
} else {
  overlayWorkouts[date] = after;          // :1398
  if (!overlay) repairedBaseOwnedWeek = true;
}
...
weekScopedOverlays[weekStart] = {          // :1406
  ...(overlay ?? { /* mints accepted-week-repair */ }),
  workoutsByDate: overlayWorkouts,
  exposureContractV2: accepted.contract,
};
```

That is a **third composer of the athlete's week**, and it is neither of the two
the residual attribution named (`R53_RESIDUAL_ATTRIBUTION_2026-08-06.md` and
`fixtureIdentityTests.ts:475-483` both say TWO producers, both reached through
`buildFixtureProjection`). This one is reached through neither. It composes on
**every accepted commit that validates a week**, which is most of them.

`Lower Squat|7` is this writer's output: the gateway reducing Monday to satisfy
the practice-match contract it was handed (`mainStrength.plannerSelectedTarget`
4→3, `power.plannerSelectedWeeklyBudget` 1→0).

## 4. The census line that is wrong

Class B, third row:

> `utils/postGenerationConstraintValidation.ts:1735` — validates a candidate
> overlay WRITE — **the caller owns the candidate by design**

Measured false, twice over. `validateLiveWeekOverlayWrite` **never fires on this
path at all** (traced: zero invocations across the whole cell). And the function
that does fire does not leave the candidate to its caller — it overwrites it.
The census enumerated 30 READERS faithfully; the defect is a WRITER, and the one
line where the census touched writers assigned this one away.

## 5. Priced by mutation

Under `R53_MUTATION=1`, the repair loop skips materialising into an overlay
whose caller declared no content — i.e. leg (i) actually taking effect:

| | cell 3 | cell 5 | cell 6 | totals |
|---|---|---|---|---|
| clean tree | FAIL | FAIL | FAIL | 3 passed, 3 failed |
| mutation on | **PASS** | **PASS** | FAIL | **5 passed, 1 failed** |

Two of the three cells are this writer, alone, and nothing else. Cell 6
(`fixture THEN removal`) survives because the athlete's removal writes overlay
content of its own first, so the "declared no content" proxy no longer holds and
the repair composes onto it — which is the same defect reached by a second
route, not a different one.

The mutation is a PRICE, not a proposal: "declared no content" is a proxy for
the real question and must not ship as one.

## 6. What this actually asks, and why it is the seat's call

The question is not "who owns the declaration" — it is **who EXPRESSES it**.

A §18 gateway repair is derived content. Today it is STORED, into the same
overlay the fixture door was told to stop storing into. Under the north star it
should be derived at read like every other derived thing, and
`derived-repair-ownership` already ruled the adjacent half of this ("a §18
repair never lands on `dateOverrides`; the stored repair may be redundant
entirely"). Retiring the stored repair is the convergent answer and it is a
LARGER cut than the one the ruling authorised — it touches every accepted commit,
not the fixture door.

The cost is real and must be priced before, not after: the deriver
(`resolveWeekWithConditioning`) does not consult the declared contract for
content. Stop storing the repair and a practice-match week keeps its
fourth main-strength session while its contract declares three. Cells 3/5/6
would green (measured above) and §18 shortfall reporting would have to answer
for the gap. That trade is exactly what cells 5 and 6 assert one way — "one
composer, and it is the deriver" — and it is not mine to rule.

`derivedRepairOwnershipTests` holds a cell open at this exact site and the
comment above the loop records what a naive deletion costs ("a fix that simply
deleted the write would pass the ownership assertions and lose every edit in the
app"). Any cut here is gated on that suite and on
`athlete-session-deletion`, which has already charged 14 regressions once on
this surface.

## Status

- **Entry gate:** complete, and it now has a correction — the writer census it
  did not do is where the defect was.
- **Second half as ruled (derivation owner + ten routed readers):** NOT BUILT.
  It does not green 3/5/6; proven by the contract-only drop in §1.
- **Blocked behind this:** the merge-gating bible, condition 4, the merge to
  `feat/stage-b-stage2`, R5.7, remaining R5 batches. Nothing was merged.
- **Tree:** clean at `fbeb6a5c`, suite reprints `3 passed, 3 failed`.
