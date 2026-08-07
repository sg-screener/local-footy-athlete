# R5.3 SHARP PROBE — the filler is NAMED, and it is NOT the declaration's reader — 2026-08-07

Answers `docs/R53_SEAT_ANSWER3_CORRECTION_2026-08-07.md` (`a375b49f`,
committed as authored). Both owed items done. **Probe only — nothing
built into the main branch.** Preserved at `1eb65683` and `9d7d8ddc` on
`scratch/r53-pricing-7`, all flag-gated and inert by default.

## Owed first — the cell-19 blocker removal is RE-PROVEN, with the flag live

The earlier "leg (iii) 22/0" run was made on `feat/r53-v3-switchover`,
where `LFA_SCAFFOLD_LEG_III` does not exist. It was **inert and proved
nothing**, as the last report recorded. The shipped fixture fixes
(`6f3a2a7a`, `766fe81a`) are now ported to the scaffold, where the flag
actually reaches `deriveWeekContract`. Controlled, both sides on ONE
worktree:

| seed | flag | result |
|---|---|---|
| scaffold's ORIGINAL | leg (iii) | **21 passed, 1 failed** (cell 19) |
| shipped fix | leg (iii) | **22 passed, 0 failed** |
| shipped fix | flags off | 22 passed, 0 failed |

**The named blocker is retired on the branch that can actually test it.**

## The sharp probe — hypothesis CHECKED, and REFUTED

The correction recorded a hypothesis to check rather than assume: the
filler is a READER of the published declaration — the consuming half of
the reconcile publishing hand-rolls. It is not.

### 1. The suspected reader is never reached

`validateLiveWeekOverlayWrite` (`postGenerationConstraintValidation.ts`)
is the site that matches the hypothesis exactly — it reads
`exposureContractV2`, early-returns when the declaration is absent
(`:1745`), repairs the week against it via `requireSection18AcceptedWeek`,
and writes `workoutsByDate[date]` (`:1812`).

Instrumented at both points, it prints **zero times** on this path. It
reads the declaration precisely as described and is not on the path, so it
cannot be the filler. Reading the code alone would have confirmed the
hypothesis; running it refuted it.

### 2. The filler, NAMED

Stack capture at the only writer that fires:

```
buildWeekScopedWorkoutOverlay   weekRebuild.ts:217  (reason: one_off_no_game)
  <- buildFixtureProjection     acceptedStateTransaction.ts:2029
     <- stageRollingHorizonFixtureRepair <- stageAthleteMutationConstraint
     <- commitProgramSetupRebuildTransaction
```

It builds the week's payload from the **replan's own workouts**
(`alternative.workouts` → `materialiseVisibleSystemWork`), **not** from
the published declaration. That is why `PROPOSED` reads `[]` and
`AFTER-txn` reads two entries: the publication's deliberate
`workoutsByDate: {}` is overwritten afterwards by this rolling-horizon
republish.

### 3. It is not gated on the declaration either

| world | Hard-Conditioning overlays built |
|---|---|
| flags off | 84 |
| leg (v) | 59 |
| legs (iii)+(iv)+(v) | 59 |

The projection still runs under leg (v) — the lower figure is cells
failing earlier, not the projection being skipped — and adding legs
(iii)+(iv) changes nothing. So the declaration does not switch the filler
on or off.

**What leg (v) actually changes is whether that payload SURVIVES the
transaction for the week**: `AFTER-txn` is `[]` there while the projection
still produced content.

### Also excluded on the way

- `additionalOverlays` never collide with the primary week — **zero**
  adjacent overlays on this path, so the "adjacent overwrites the emptied
  entry" mechanism is not it.
- `commitWeekScopedOverlay` replaces wholesale, so clause (c)'s suspected
  merge is innocent (already reported, re-confirmed here).

## STOP — per the correction's own terms

*"If the filler is something else, STOP with it named."* It is something
else, and it is named: **`buildFixtureProjection`'s rolling-horizon
republish**, not a reader of the declaration.

Because the hypothesis is refuted, the correction's "no new ruling needed —
build leg (iii)(+iv) first" branch does **not** apply on its stated
grounds. The convergence order may still be right, but it can no longer be
justified by *"the deriver supplies at read what the filler read from the
declaration"* — the filler never read the declaration. That is the seat's
call, not this terminal's.

**NOT ESTABLISHED, and it is the next question:** why the projection's
payload fails to survive the transaction for that week under leg (v), when
the projection itself still produces it. That is now a question about the
COMMIT path, not the build path.

## NOT COVERED

- Condition 1's re-measure is NOT run — the correction parks it behind
  this probe's answer, and the answer changes the premise.
- No leg (v) re-price. Nothing built into `feat/r53-v3-switchover` this
  pass; its HEAD is unchanged from `a375b49f` apart from this report.
- Why the payload is dropped at commit under leg (v) — named, not opened.
- Only `test:athlete-session-deletion`, `test:athlete-session-move` and
  `test:fixture-identity` were run on the scaffold; no full bible there
  (scaffold branch, probes only).

## L12 — what catches the NEXT one of this class

Twice in two passes a MECHANISM was inferred from a real symptom and was
wrong — first the seat's "leg (v) empties the payload", now the recorded
"the filler reads the declaration". Both readings were plausible, and in
this case the suspected function genuinely does exactly what the
hypothesis described; it simply never runs here.

The catch is cheap and it is the same one both times: **before attributing
behaviour to a function, prove that function EXECUTES on the path** — one
counter at the top of it. A site that matches the description perfectly
and never fires is indistinguishable, on reading, from the real owner.
This is [[owner-unreachable-by-shape]] in its exact form: a suspect probe
that never fires is the cheapest refutation, and it is cheaper than the
reading that precedes it.
