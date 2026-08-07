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

## Stage 2 — first commit AFTER the merge

Flip the official gate to the parallel runner, citing its accumulated
agreement runs. One commit, boring by construction.

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
