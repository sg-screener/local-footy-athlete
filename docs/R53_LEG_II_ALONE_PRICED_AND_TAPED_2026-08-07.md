# R5.3 LEG (ii) — priced ALONE (7, not 5), and the tape says its gates never run — 2026-08-07

Answers the seat's sweep order: **(c)** price leg (ii) alone in the same
sweep, and **(b)** diagnose by tape rather than serially, fact-horizon
first. **Attribution only — nothing built.**

## (c) Leg (ii) ALONE costs SEVEN, and legs (iii)+(iv) MASK two of them

All 154 `test:bible` suites, control and arms measured the same way, diffed
as **sets**:

| arm | failures | new vs control |
|---|---|---|
| control (flags off) | 6 | — |
| (iii)+(iv)+`basis=visible` | 6 | **0** |
| **(ii) ALONE** | **13** | **7** |
| (ii)+(iii)+(iv)+basis | 11 | 5 |

Leg (ii) alone's seven: `accepted-state-transactions`, `action-walker:deep`,
`device-pass-2026-08-05-evening`, `fact-horizon`,
`program-control-durable`, `session-list-combinations`, `work-bill`.

**Legs (iii)+(iv) MASK two of leg (ii)'s failures** —
`device-pass-2026-08-05-evening` and `session-list-combinations` are red
under (ii) alone and green under (ii)+(iii)+(iv). Nothing goes the other
way.

Two consequences for the build order:

1. **The previously reported price of 5 understated leg (ii)'s own cost.**
   Its price is 7; the combined arm only ever showed the residue.
2. **The legs INTERACT.** "Leg (iii)+(iv) are free" and "leg (ii) costs 7"
   are both true, and the combination is not their sum. Any future ordering
   argument has to be made against measured combinations, not against
   per-leg prices added together.

### A measurement that lied, and how it was caught

The first attempt at this run reported **1 failure** — a clean-looking
number that was wrong. `git worktree add` refuses a second checkout of the
same branch, so the worktree was never created, the `cd` failed silently,
and the sweep measured the **branch**, where `LFA_SCAFFOLD_LEG_II` does not
exist and the flag is inert.

Caught by the result being implausible (it "fixed" five scaffold-only
reds). The rerun asserts its own preconditions before measuring: `cwd`
checked, `HEAD` printed, and the flag's presence in the source grepped. A
sweep that cannot prove which tree it ran in is not a measurement — the
harness-lies class again, third sighting in this unit.

## (b) The tape: leg (ii)'s gates NEVER EXECUTE in fact-horizon

Ordered worst-first, `fact-horizon` — completed days are FACTS, and a layer
rewriting them is the named destroy-class.

**The failure is real and deterministic**, repeated twice each way in one
worktree:

| | result |
|---|---|
| flags off | 14 passed, 0 failed |
| `LEG_II=1` | 12 passed, **2 failed** |

The two are `T4 illness_severe` and `T4 cooked_week`, both:
`rewrote 2 completed day(s): 2026-07-20 "Mixed/core/High/4ex" →
"Mixed/core/Moderate/5ex"; 2026-07-21 "Team Training/core/High/3ex" →
"Team Training/core/Moderate/3ex"`.

**And yet every leg (ii) code path is dark.** `SCAFFOLD.legII` is read in
exactly four places in `src` (verified by grep across the tree). All four
were taped, and in `fact-horizon` under `LEG_II=1` they record:

| site | hits in fact-horizon |
|---|---|
| `sessionResolver` tier-4 host (entry) | **0** |
| `withDisplacedCapacityReduction` | **0** |
| `repairDisplacedStrengthCandidates` | **0** |
| `selectedShortfall` | **0** |

**The instrument is proven sound, not assumed.** The same tape in
`test:athlete-session-deletion` records 1205 / 1205 / 532 hits. A zero from
an instrument that fires 2,942 times elsewhere is evidence.

The tier-4 write tape (every day tier 4 changes, with that day's Done
status from `sessionFeedback`) also recorded zero — because its host is
never entered.

### What that means, stated as the open question

Leg (ii) changes `fact-horizon`'s outcome deterministically **without any
of its four gates executing**. So the effect is not flowing through the
gates. Candidates, none tested:

- a module-initialisation or import-order effect of evaluating `SCAFFOLD`;
- a fifth reader that grep does not match (dynamic access, destructuring);
- the flag changing a value that is captured once at load time.

**This is the STOP.** Per the standing rule that killed three earlier
hypotheses, none of the above is worth anything until it is measured, and
this terminal is not going to name a mechanism it has not seen execute.

## NOT COVERED

- The other six of leg (ii)'s seven were NOT taped — only `fact-horizon`,
  as ordered (worst first).
- No root cause found. The one-root hypothesis from the previous pass is
  neither confirmed nor refuted; the tape says only that whatever the cause
  is, it is not the four gates in `fact-horizon`'s world.
- The masking mechanism (why (iii)+(iv) green two of leg (ii)'s reds) was
  NOT investigated.
- Nothing built; `feat/r53-v3-switchover` unchanged except this report.
  Tapes live on `scratch/r53-pricing-7` only, all `LFA_T4TAPE`-gated.

## L12 — what catches the NEXT one of this class

Two catches, both earned this pass.

**A sweep must prove which tree it ran in.** The invalid run produced a
plausible number from the wrong directory because every failure was
silenced (`>/dev/null`, `cd ... || true` semantics). Any measurement script
should assert `cwd`, `HEAD`, and the presence of the thing being toggled
*before* it measures — three lines that would have made the lie impossible
rather than merely detectable.

**Price legs in COMBINATION, not just alone.** Per-leg prices do not add:
(iii)+(iv) are free alone and mask two of leg (ii)'s seven. A build order
chosen from per-leg numbers is choosing from numbers that do not describe
any state the build will pass through.
