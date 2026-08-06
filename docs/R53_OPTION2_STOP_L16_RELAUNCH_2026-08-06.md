# STOP — OPTION 2 BREAKS THE RELAUNCH LAW, 2026-08-06

Measured on `feat/r53-v3-switchover` after the two ruled items landed. This is
a STOP under CLAUDE.md's escalation rule: the decision layer understood the
athlete correctly and a later layer re-derives a different week from it.

Nothing further is built on this branch until the review seat rules. Condition
4 (retire the fixture replay interpreter) and the merge to
`feat/stage-b-stage2` are both BLOCKED behind it.

## The measurement

Full `test:bible` on the branch, off the printed line:

```
BIBLE_TRUE_EXIT=1
```

It stops at `test:action-walker` — `19 passed, 1 failed`:

```
FAIL THE L16 SLICE: load, display, change, repair, approve, persist, relaunch-identical
  in-season game week (Saturday fixture marked through the calendar door):
  the athlete sees a different week after relaunch.
  before: 07-20=REST|0; 07-21=Team Training + Upper Push|3; 07-22=Lower Hinge|7;
          07-23=Team Training + Upper Pull|3; 07-24=Gunshow|6; 07-25=Game Day|0; 07-26=REST|0
  after:  07-20=REST|0; 07-21=Team Training + Upper Pull|3; 07-22=Prehab & Accessories|5;
          07-23=Team Training + Upper Push|3; 07-24=Gunshow|6; 07-25=Game Day|0; 07-26=REST|0
```

The athlete closes the app having accepted a week with a **Lower Hinge** on
Tuesday and re-opens it holding **Prehab & Accessories**, with Monday's and
Wednesday's strength halves swapped. This is law 2 of `quiescentBootTests` —
THE WORLD IS ITS INPUTS — failing on the athlete-visible surface.

## Attribution — bisected, not guessed

| tree | `test:action-walker` |
|---|---|
| `feat/stage-b-stage2` (merge target) | **TRUE_EXIT=0**, 20/20 |
| `1b6bbd80` (last commit before option 2) | **TRUE_EXIT=0**, 20/20 |
| `a13bb51a` — **option 2 BUILT** | *(the only code commit in the gap)* |
| `50d58ebc` | TRUE_EXIT=1 |
| `61a89757` (the core placer) | TRUE_EXIT=1 |
| HEAD (`bb2dd6a0`) | TRUE_EXIT=1 |

**Option 2 is the cause.** It is not the core placer, and it is not any of the
three commits landed today — the red is already there at `50d58ebc`, before
them. Today's commits took `test:athlete-session-deletion` from 17 failures to
**TRUE_EXIT=0, 24/24 5/5 3/3**, and `test:phase-structure` stands at 11/11.

## What the failure is, and what it is not

**It is deterministic.** Two consecutive runs produce a byte-identical `after`
week. The re-derivation is not random — it is a pure function of the inputs
that survive, and those inputs no longer determine the week the athlete
accepted. An input is MISSING; generation has not become unstable.

**It is the same mechanism as regression 1, one level up.** Option 2 made the
fixture door publish its DECLARATION and never its content
(`weekRebuild.ts`, `workoutsByDate: {}`), so the decided week is DERIVED at
every subsequent read instead of read back. Regression 1 saw the harmless face
of that change — an id namespacing rename with byte-identical content. This is
the harmful face: the derived week is not the accepted week.

**Option 2 is still right about the thing it was built for.** The stale
contract it corrects is real and is measured in
`docs/R53_OPTION2_MEASUREMENT_2026-08-06.md`: a cancelled game went on paying
the week's conditioning, sprint and hard-day bills. Nothing here revokes that
finding. What the approval priced was "cheap and it works" against §18 and the
freed-day contract; it was never run against the relaunch law, and that is the
gap this doc closes.

## The reassessment, as far as measurement can answer it

1. **Source of truth.** Intended: the persisted inputs (life-facts, ledger
   decisions, the published declaration). Actual: for a fixture-decided week,
   the accepted SESSIONS existed only in the overlay option 2 emptied.
2. **How many representations.** Two — the week the decision produced, and the
   week a later read re-derives from the declaration. Option 2 removed the
   first without proving the second reproduces it.
3. **Where intent can be reinterpreted.** At every read of a fixture-decided
   week: the replan's source is whatever the week currently is, so deriving
   from the original microcycle and deriving from the athlete's accepted week
   are different computations. **This is a hypothesis consistent with the
   evidence, not a measured mechanism — it is the first thing the next unit
   must pin.**
4. **Which layer should own it.** Unresolved, and the actual question for the
   seat: either the declaration must carry enough to re-derive the accepted
   week deterministically, or the accepted sessions are a decision OUTPUT that
   is legitimately stored. The north star presumes the former; the measurement
   does not yet say it is reachable.
5. **Simpler architecture.** Not proposed here on purpose. Proposing one
   before question 3 is pinned is how the last cut got approved on a partial
   measurement.
6. **Legacy paths.** Unchanged — leg (i)'s remaining deletions stay parked.
7. **Tests that prove the boundary.** `test:action-walker`'s L16 slice already
   is one, and it is two-directional by construction: it passes on the merge
   target and fails here. It must go green WITHOUT being edited.

## Also recorded

The background-task completion notification for this bible run reported
**exit code 0** for a run whose own printed line said `BIBLE_TRUE_EXIT=1`. That
is the second recorded sighting. Only the printed line was trusted, which is
the standing rule and is why the red was seen at all.
