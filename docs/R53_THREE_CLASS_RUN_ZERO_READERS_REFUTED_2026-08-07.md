# R5.3 — the three-class run REFUTES "zero readers": my tape was lying across a process boundary — 2026-08-07

Answers the seat's compression order (instrument all three candidate classes
in ONE run). **Attribution only — nothing built.** Instrument at `271a7be4`
on `scratch/r53-pricing-7-probe`, inert unless `PROBE_OUT` is set.

**The previous pass's headline finding is WITHDRAWN.** It was wrong, and the
seat's own ordered instrument is what caught it.

## What was instrumented, all in one run

1. **Load-time capture** — the recorder moved *into* the `SCAFFOLD`
   definition, so `legII` is a getter from the object literal onward and
   nothing can read it before the instrument exists.
2. **Reader outside `src`** — a `Proxy` on `process.env` recording every
   `LFA_*` get / has / ownKeys with stack, installed via
   `NODE_OPTIONS --require` before any module loads.
3. **Init-order** — every `Module._load` recorded in sequence.

All three write to **one file**, not stdout. That single change is what
broke the case open.

## The result: there are readers, thousands of them

| measure | flags off | `LEG_II=1` |
|---|---|---|
| `scaffoldSection18TierFour` reads `SCAFFOLD.legII` | **6,947** | **13,894** |
| env reads of `LFA_SCAFFOLD_LEG_II` | 30 | 46 |
| module loads | 34,510 | 48,404 |
| suite result | 14 / 0 | 12 / 2 |

The read stack is unambiguous:
`get legII ← scaffoldSection18TierFour ← resolveWeekWithConditioning`.

**Leg (ii)'s gate is live in `fact-horizon` and reads the flag on every week
resolve.** The ordinary explanation was available the whole time.

## Why the previous instrument said ZERO

`durableFactHorizonTests.ts:675` — `runAllForked()` — `spawnSync`s its cases
into **child processes**.

The earlier four-site tape and the earlier reader-getter both wrote to
`process.stdout`, and I read them back through `npm run … | grep`. Everything
the children wrote was never in the stream being grepped. **Both zeros were
artifacts of the instrument, not facts about the code.** The same cause
invalidates this unit's earlier "the tier-4 write tape recorded zero" line.

### The specific reasoning error, named

Last pass I wrote that the instrument was *"proven sound, not assumed"*
because the same tape fired 1205 / 1205 / 532 times in
`test:athlete-session-deletion`. That was a real observation and a false
proof: firing in suite X is not evidence of surviving suite Y's **process
model**. The soundness check has to run in the same world as the
measurement, or it is measuring a different instrument.

This is harness-lies **sighting 4**, and it is mine.

## What this means for the open question

The question *"how does the flag's value reach behaviour with no reader?"*
**dissolves — it was never true.** Nothing exotic is happening: no
module-init effect, no artifact cache, no hidden fifth reader. Leg (ii)'s
tier-4 host runs in `fact-horizon`, reads the flag, and the two arms differ
because tier 4 does more work (13,894 reads vs 6,947).

The seat's stated escape hatch — *"if all three come back identical/empty
while the outcome still differs, STOP; that would impugn the runner"* — does
**not** fire. The three classes did not come back empty; class (1) came back
loud, and the runner is not impugned. The instrument was.

## The next step, on solid ground again

Re-run the **tier-4 write tape** (every day tier 4 changes, with that day's
Done status) **writing to a file**, and name the write that rewrites
`2026-07-20` and `2026-07-21`. That measurement was attempted last pass and
returned a false zero for exactly the reason above; it is now a
straightforward re-run, not a mystery.

## NOT COVERED

- **The completed-day rewrite is still not attributed to a line.** This pass
  restored the ability to see it; it did not do it.
- The module-load-order diff was captured (34,510 vs 48,404 records) but
  **not analysed** — the class (1) result made it unnecessary for this
  question, and analysing it now would be answering a question that no
  longer needs asking.
- Only `fact-horizon` was instrumented (worst-first, as ordered).
- No compiled-artifact caches exist in the tree (`.qa-compiled`,
  `.sucrase-cache`, `*.tsbuildinfo` — none present), so class (3)'s artifact
  half had nothing to hash.
- Nothing built; `feat/r53-v3-switchover` unchanged except this report.

## L12 — what catches the NEXT one of this class

**A cross-process instrument writes to a file, never to stdout.** Any suite
that forks (this repo has at least one, and `runAllForked` is a named
helper) will silently swallow a stdout tape, and the swallow is
indistinguishable from a true zero.

**And a soundness check must run in the SAME world as the measurement.**
"It fires in another suite" proves the code is reachable; it proves nothing
about the process model, the stream, or the harness of the suite under test.
The correct check is a **positive control inside the same run** — instrument
something known to fire in *that* suite, and require it to appear before any
zero elsewhere in the same tape is believed.

That second rule is the general form of the one this unit has now hit four
times: **a zero is a claim, and it needs its own evidence.**
