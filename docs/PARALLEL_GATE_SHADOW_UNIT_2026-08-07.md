# PARALLEL GATE — SHADOW UNIT, 2026-08-07 (Sam: "when can we fix this one?")

Sam pulled this forward from post-merge. Two stages, ruled by the
review seat; Sam holds a veto.

## Stage 1 — NOW, at the next checkpoint (one session, harness-only)

1. gate.sh: runs any command, tees output, writes the literal exit
   line to a file. Retires reliance on the completion notification
   (5+ recorded lies). Five lines, zero risk, lands first.
2. test:bible:parallel: the ~156 suites sharded across cores in
   dependency-safe groups. The serial test:bible is NOT touched and
   remains the ONLY official commit gate.
3. AGREEMENT LAW: the parallel runner is trusted for nothing until it
   prints suite-for-suite identical totals to a serial run on the
   same tree, and the agreement harness itself is mutation-checked
   (drop one suite from the parallel set → the agreement check must
   red). The vacuous-gate class has seven sightings; the gate that
   guards everything gets the strictest gate of all.
4. Once agreement is shown: inner-loop pricing/scaffold rounds MAY use
   the fast lane (they gate no merge). Every commit still pays the
   serial chain unpiped.

### Stage 1 — DELIVERED 2026-08-07 (items 1-4)

Item 1 (`scripts/gate.sh`) already existed. Items 2-4 landed with this entry.

- **`scripts/bible-runner.js`** — ONE runner, and **concurrency is its only
  variable**: `--jobs 1` is the serial reference, `--jobs N` the fast lane,
  same derived list, same literal command strings. Two programs would have made
  a disagreement unattributable.
- **ONE SUITE LIST (guardrail 5) is derived and ASSERTED**, never transcribed:
  the chain is split on `&&` into **158 units** (157 `npm run` + the leading
  `runSlice1` slice — the serial sweep's 156 is that set minus `test:compile`
  and minus the slice). If the parser recognises fewer `npm run` calls than the
  chain contains, it **refuses to measure**.
- **`scripts/bible-agreement.js`** — suite-for-suite, never totals-for-totals,
  and it compares `FIRST_FAILURE` (the unit the `&&` chain would stop at) as
  well as the failure SET.

**THE AGREEMENT LAW IS MET: 4 runs, all AGREE** — jobs 8, 4, 10, 8 against the
same serial reference on the same tree (`9f15e011`). Every arm: **2 failures of
158**, `program-control-durable` + `fixture-identity`, same `FIRST_FAILURE`.
**That is the branch's declared set exactly.**

**MUTATION CHECK: 6 of 6.** Both directions are represented on purpose — cells
2/3 (dropped unit, flipped exit) must red, but cells 1/4 (identical results;
same set in a **different finish order**) must stay green, or an always-red
comparator would pass the ruled cell vacuously. Cell 5 spends three real suite
runs proving the law through the actual runner; cell 6 proves the wall-clock
detector fires when `EXCLUSIVE` is emptied.

**WHAT THE AGREEMENT LAW CAUGHT ON ITS FIRST REAL RUN — and it was real.**
`chain:runSlice1` passed serially in 21.2s and FAILED under `--jobs 8` in
43.5s: *"Bible harness runtime 43514.4ms exceeds hard ceiling 30000ms"*
(`runSlice1.ts:63`). **Not shared state — a WALL-CLOCK SELF-ASSERTION**, which
measures the machine's load rather than the app and so cannot be pooled by
construction. A lane does not save it either, because a lane still runs beside
the pool. It now runs **EXCLUSIVE** (nothing else in flight), and a detector
refuses to measure if any other unit's entry file declares a runtime ceiling
without being declared exclusive. **The ceiling was NOT raised** — the side
that moved was the runner, not the app.

**TWO DEFECTS IN THE RUNNER ITSELF, caught by its own output before it measured
anything:** `chain:runSlice1` exited **127** (the one non-`npm run` unit missed
npm's `node_modules/.bin` PATH) — and both arms would have reproduced it
identically, so the check would have called it a match: a vacuous agreement on
an instrument fault. And a spawn that never starts crashed the runner instead
of being recorded. Exit 127 is now an **ABORT with no results file**, because
"command not found" is never a suite's verdict about the app.

**THE UNIT'S OWN PREMISE IS REFUTED, and it bears on stage 2.** The roadmap
scoped this as "target 20 min → ~3-5 min". **Measured: the full 158-unit serial
set is 257.7s (4.3 min); parallel is 111-128s (2.0-2.1 min); speedup
2.0-2.3x.** So the fast lane saves roughly **2 minutes, not 16**. The 20-minute
figure is not supported by any measurement taken here, and I did not find its
source. **The official chain as Sam feels it today is 115s** — it short-circuits
at the declared red around unit 92 of 158; on a green tree it would pay the full
~4.3 min. Two honest contributors to the modest ratio: the exclusive phase
un-parallelises 21s up front, and `test:compile` + the deep walker dominate the
tail. **Stage 2's cost/benefit changes with this number — it is Sam's call, not
the terminal's.**

**ALSO WORTH SAM'S EYE, independent of this unit:** serial `runSlice1` at 21.2s
is **already past its own 18s warning** and inside 30s of its hard ceiling. The
official gate is closer to that wall than anyone has been reading.

**ITEM 4 IS NOW LIVE:** inner-loop pricing/scaffold rounds MAY use
`npm run test:bible:parallel`. **Every commit still pays the serial chain
unpiped** — `test:bible` is untouched and remains the only official gate
(verified byte-identical when the new scripts were added).

## Stage 2 — REFUSED 2026-08-07 (seat ruling, thirty-third pass)

~~Flip the official gate to the parallel runner, citing its accumulated
agreement runs. One commit, boring by construction.~~

**REFUSED, ruled from the measurement:** ~2 minutes does not buy a
timing-sensitive failure mode on the gate that guards everything.

**The parallel runner is kept as a NON-OFFICIAL fast pre-check.** Agents may
use it mid-work; **no official verdict ever cites it.** The agreement law and
its mutation proof stay in the chain, guarding the shadow. **The unit CLOSES
here, delivered.**

Roadmap Phase 1.5 updated by reference to this doc.

## Risk guardrails (ruled with Sam, 2026-08-07)

5. ONE SUITE LIST: the parallel runner DERIVES its suite set from the
   same chain definition the serial gate uses (the totals-or-red
   precedent) — a suite can never exist in one and not the other.
6. LANES: heavy/shared-state suites (deep walker and kin) pin to their
   own lane or stay serial inside the runner; a mostly-parallel gate
   with a serial tail is still the win.
7. DECISION-GRADE PRICES GO SERIAL: any measurement about to justify a
   STOP, a ruling request, or a build is confirmed by one serial run.
   Fast lane for iteration, slow lane for conclusions.
8. THE SERIAL CHAIN IS NEVER DELETED: it remains the on-demand audit —
   re-run agreement after any change to the runner, and whenever a
   result smells wrong.
