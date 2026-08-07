# THE MECHANISM IS PINNED — 2026-08-06

Answers question 3 of `docs/R53_OPTION2_STOP_L16_RELAUNCH_2026-08-06.md` under
the order set by `docs/R53_OPTION2_STOP_RULING_2026-08-06.md`: measure first,
name the diverging input, propose nothing until it is named.

**The hypothesis in the STOP doc was WRONG.** It guessed "the replan's source is
path-dependent". The divergence is not in the replan at all.

## The diverging input, named

**A week is composed against `currentMicrocycle` — which boot selects from
TODAY — instead of against the microcycle whose date range covers the week being
composed.**

`quiescentBoot.ts` rebuilds the program anchored to the recorded
`generationAnchorISO` (correctly — the anchor is a decision and is read, never
guessed), then commits it with:

```
commitRebuiltProgram(program, …, { selectedDate: todayISOLocal(), … })
```

so the SELECTED microcycle follows today. The week the athlete is looking at
does not have to be today's week, and in this world it is not.

## The measurement

Inputs snapshotted either side of the relaunch. Everything the derivation reads
is byte-identical except the selection:

| input | before | after |
|---|---|---|
| `allMicrocycles` (all 4, ids/ranges/kinds/modes) | SAME | SAME |
| `generationAnchorISO`, `seasonPhaseClock`, `blockState` | SAME | SAME |
| `markedDays` / calendar marks | `{"2026-07-25":"game"}` | SAME |
| removal constraints, `dateOverrides`, overlay keys | SAME | SAME |
| **`currentMicrocycle`** | **mc-ai-2** `2026-07-20..07-26` wk2 **build** | **mc-ai-4** `2026-08-03..08-09` wk4 **deload** |
| **overlay `exposureContractV2.identity.mode`** | **`practice_match_week`** | **`mid_preseason`** |
| composed volumes | `Lower Squat:8`, `Lower Hinge:7`, team days `:3` | `:4`, `:4`, `:2` — deload halving |

Nothing is missing from disk. `mc-ai-2` is present in `allMicrocycles` on both
sides, with the week start the athlete is viewing. It is simply not the one the
composition uses.

## Why today is 2026-08-06 inside a 2026-07-20 world

`todayISOLocal()` returns **2026-08-06**, the real machine date, while the
walker's world sits at 2026-07-20/07-23. `2026-08-06` falls inside mc-ai-4,
which is why boot selects the deload week.

The L16 slice calls `setWorldClock()` and its comment claims "the slice pins the
app clock to the world's day". **It does not.** `appDate.devE2EClockSnapshot()`
returns null unless `runtimeIsDev()`, and the walker sets `__DEV__ = false` at
`athleteActionWalkerTests.ts:39`. The receipt is written and never read.

This makes the cell DATE-SENSITIVE, and it is why the red surfaced today rather
than when option 2 landed: the real date had to walk into a microcycle other
than the world's own week. It is a second, separable defect and is not fixed
here.

## What option 2 did, and did not, do

**The defect is PRE-EXISTING on both branches.** Measured on
`feat/stage-b-stage2` with the identical probe: same real clock (2026-08-06),
same `currentMc=mc-ai-2@2026-07-20`, same `overlayMode=practice_match_week`
before the relaunch — and the L16 slice **PASSES** there.

It passes because the fixture overlay carried CONTENT, which boot's ledger
replay re-published for `2026-07-20`, so the displayed week never had to be
composed and the wrong `currentMicrocycle` could not reach it. Option 2 publishes
the declaration and an empty `workoutsByDate`, so the week is composed — and the
mis-selection becomes visible.

**Option 2 did not create this defect. It removed the stored output that was
hiding it** — which is the direction `docs/NORTH_STAR.md` asks for, and the
reason the fix belongs where the composition is, not in a restored overlay.

## What this means for question 4

**Neither ruled branch applies, and that is the useful result.**

- It is NOT a missing persisted input. Every input is present and identical; the
  week's own microcycle is already on disk and already derivable from the
  program plus the week start.
- It is NOT irrecoverable. The correct answer is a pure function of inputs that
  already survive.

So nothing new is stored and nothing is re-stored. The composition selects the
microcycle covering the week it is composing. That keeps option 2's
stale-contract correction intact — a cancelled game still never pays the week's
bills — and it does not resurrect the stored-week class.

**Still not built.** This document only pins the mechanism, per the ruling's
order. The owner of the selection, the blast radius across every week-composing
caller, and the two-directional cell come next.

## Declared, not fixed here

1. **The L16 slice's world clock is inert** (`__DEV__ = false` vs
   `runtimeIsDev()`), so the cell is date-sensitive and its comment overstates
   what it controls. Fixing it would change WHEN this class reds, not whether
   the class exists — and it must not be fixed in a way that re-masks the
   defect above.
2. **Backward weeks are the general case.** An athlete opening the app on any
   day and looking at a week other than today's hits the same composition path.
   Nothing measured here bounds it to a test harness.
