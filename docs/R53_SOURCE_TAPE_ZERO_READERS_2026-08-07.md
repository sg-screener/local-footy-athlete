# R5.3 — the SOURCE tape: ZERO readers, and the flag still decides — 2026-08-07

Answers the seat's order on the `58c40414` STOP: **(a)** instrument the
SOURCE rather than the enumerated readers, **(b)** compress the harness-lies
class into the sweep runner. **Attribution only — nothing built.**
Instruments at `4b846988` on `scratch/r53-pricing-7-probe`, all inert by
default.

## (a) The getter finds ALL readers by construction — and there are none

Grep finds the readers it matches. A recording getter on `SCAFFOLD.legII`
finds every reader — including spreads, `JSON.stringify`, destructuring and
anything captured at module-load — or proves there are none. A separate
module-load line tapes the env read itself, so a value captured once at load
still leaves evidence.

**The result, one run per arm:**

| arm | result | `SCAFFOLD.legII` reads |
|---|---|---|
| flags off | 14 passed, 0 failed | 0 |
| `LEG_II=1` | **12 passed, 2 failed** | **0** |
| `LEG_II=1` **with the getter installed** | **12 passed, 2 failed** | **0** |

Only the module-load env line ever prints, in either arm.

**Controls, so "the flag matters" is not itself an assumption:**

| control | result |
|---|---|
| `LEG_II=0` (variable set, value not `'1'`) | 14 passed, 0 failed |
| unrelated env var set | 14 passed, 0 failed |

So it is specifically the **value `'1'`** — not the variable being present,
not any environment change — and **nothing reads the property**.

Repo-wide, `LFA_SCAFFOLD_LEG_II` appears in exactly one place, and there is
no dynamic environment access anywhere in `src` (`process.env[...]`,
`Object.keys(process.env)`, or any `LFA_` prefix scan).

### Which branch of the ruling this lands on

The order named the consequences in advance:

> *hits found → the hidden reader is the mechanism candidate; zero hits both
> arms → the flag's VALUE is not the cause; the difference is environmental
> (world identity), and the next diff is the two arms' module-load lists +
> compiled-artifact state — harness territory, fourth-sighting watch.*

**Zero hits, both arms.** With one qualification worth stating precisely
rather than glossing: the value demonstrably *does* decide the outcome
(`LEG_II=0` → 14/0, `LEG_II=1` → 12/2), so the finding is not "the value is
irrelevant" but the sharper and stranger **"the value decides the outcome
without any reader consuming it."**

Both readings point at the same next step, which is the one the seat
already named: **diff the two arms' module-load lists and compiled-artifact
state.** Harness territory. **This is the fourth-sighting watch.**

**No mechanism is named here.** Three hypotheses died in this unit by being
plausible and unexecuted, and the standing rule is that nothing counts until
it is seen to run. Module-init ordering, a compiled-artifact cache keyed on
the environment, and a load-time capture are all *candidates*, and all are
untested.

## (b) The sweep runner cannot lie about its world — third-sighting compression

`scripts/sweep.sh`. The `cwd` / `HEAD` / symbol-in-source assertions are now
a **mandatory preamble inside the runner**, printed before any suite runs,
and the runner **exits non-zero without measuring** if it cannot establish
them. Same discipline as `gate.sh`'s exit line: trust only printed evidence.

Proven in both directions, not asserted:

- **Run from the branch, where the flag is inert** — the exact condition
  that produced a clean, wrong "1 failure" on 2026-08-07:
  ```
  SWEEP ABORT: 'LFA_SCAFFOLD_LEG_II' does not exist in src/ at …/local-footy-athlete
    the arm under test would be INERT here — this is the 2026-08-07 lie
    exit=3
  ```
- **Run from the scaffold** — prints its world and proceeds:
  ```
  SWEEP WORLD: label=… cwd=…/wt-getter head=f91ea404 symbol=LFA_SCAFFOLD_LEG_II
               files_with_symbol=1 arm=[LFA_SCAFFOLD_LEG_II=1]
  SWEEP SUITES: 154
  ```

The suite list is read from the `test:bible` chain itself, so it cannot
drift from what the gate actually runs.

## (c) Accepted and recorded

Per-leg prices do not add. Legs (iii)+(iv) are free alone and **mask two of
leg (ii)'s seven**; the five-vs-seven correction stands. Every future
ordering or build argument in this unit cites **measured combinations only**.

## NOT COVERED

- **No root cause.** The mechanism by which the value reaches behaviour is
  not found, and deliberately not guessed.
- The module-load-list / compiled-artifact diff — the ordered next step — is
  NOT run.
- Only `fact-horizon` was taped (worst-first, as ordered). The other six of
  leg (ii)'s seven are untouched.
- The masking mechanism was not investigated.
- Nothing built; `feat/r53-v3-switchover` unchanged except this report.

## L12 — what catches the NEXT one of this class

Two, both now instruments rather than intentions.

**Instrument the source, not the enumerated readers.** A grep census answers
"which readers can I find?"; a recording getter answers "which readers are
there?" — and only the second can return a trustworthy zero. The census
found four readers and all four were dark; the getter proved the set of
readers in that world is empty, which is a different and much stronger
claim. Where a symbol's consumers matter, tape the symbol.

**A measurement asserts its world before it measures.** Not after, and not
in the report — in the runner, printed, with a non-zero exit when it cannot.
The 2026-08-07 lie was silent because every failure on the path to it was
silenced; the preamble converts that silence into an abort.
