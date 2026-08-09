# LR-29 ITEM 1 — THE BOOT REPLAY TAPE (2026-08-09)

**The replay unit is OPEN.** Its opening law is the dependency list's, and the
list's own item 1 blocks everything else:

> **Does the boot replay reconstruct `authorisedReductions`?** One tape at
> `rebuildDerivedWorld`. **Blocks everything** — if it already does, the unit is
> far smaller than priced.

**Instrument:** `npm run tape:lr29-boot-replay` (`src/__tests__/lr29BootReplayTape.ts`).
Deliberately NOT in `test:bible`: it asserts nothing and passes nothing. It
prints a measurement.

**World:** Sam's 2026-08-05 pass fixture, generated 2026-08-05, four weeks
(`2026-07-27` … `2026-08-17`). State reached by ACTING through the real
program-control door — no hand-built accumulator, per the standing ruling that
a seeded array would only prove an array survives a rebuild.

---

## THE HEADLINE — **ITEM 1 IS NOT ANSWERED, AND THE PROBE IS WHY**

```
did the ACT accumulate anything?   NO (6 → 6)
ACTED → BOOTED, total              : 6 → 6
ACTED → BOOTED, row-for-row        : IDENTICAL
ACTED → BOOTED, answering rung     : DIFFERENT
ACTED → BOOTED, removal constraints: 1 → 1
```

A whole-day delete — the decision the kickoff names when it says *"Restore
cannot find the reduction it owns"* — **put nothing into the accumulator.** So
"the boot reconstructed it" and "there was nothing to reconstruct" are the same
reading of an identical total, and the run cannot separate them.

**That is a result about the instrument, and it is the honest one to report.**
The alternative was to read 6 → 6 as "the boot keeps the accumulator" and open
the unit on it — a green reading of a vacuous comparison, which is the shape
this repo has a law about.

## WHAT THE RUN DID ESTABLISH

**1. EVERY REDUCTION IN THIS WORLD IS GENERATION-AUTHORED POLICY, NOT A
DECISION.** All six rows carry `provenance: live_typed_reduction` and a policy
reason:

| week | rows | reason |
|---|---:|---|
| 2026-07-27 | 1 | `game_load_protection` (power primer budget 2→1) |
| 2026-08-03 | 1 | `game_load_protection` |
| 2026-08-10 | 1 | `game_load_protection` |
| 2026-08-17 | 3 | `deload_policy` (intensity 100→90, conditioning 4→3, primer 2→1) |

They survive a boot because **the boot re-generates**, not because anything is
replayed. No ledger entry is involved in keeping them.

**2. THE ATHLETE'S DELETE LANDED SOMEWHERE ELSE.** `userRemovalConstraints`
went 0 → 1 and the week gained an overlay; the declaration's
`authorisedReductions` did not move. **The boot reconstructed the removal
constraint (1 → 1) and rebuilt the overlay.** So the decision half of the world
replays; the accumulator half was never exercised.

**3. THE ANSWERING RUNG MOVED WHILE THE ANSWER DID NOT — and this is the find
worth carrying into the build.**

| week | ACTED | BOOTED |
|---|---|---|
| 2026-07-27 | **overlay** | **covering_microcycle** |
| 2026-08-03 | overlay | overlay |
| 2026-08-10 | covering_microcycle | covering_microcycle |
| 2026-08-17 | covering_microcycle | covering_microcycle |

The past week's overlay **did not survive the boot**, and the door answered from
the microcycle instead. Row-for-row the contract was identical, so nothing
visible changed — **which is exactly why it would never be noticed.** The moment
the two rungs can carry different content, that silent substitution is a defect
with no gate on it. It is also a live warning for the unit's own design: a
measurement that watches only the door's ANSWER cannot see the door's SOURCE
changing underneath it, and §2 of the dependency list is built entirely on
source counts.

## THE INSTRUMENT'S OWN DEFECT, FOUND AND FIXED MID-RUN

The first version photographed `programStore.exposureContractsByWeek` and
reported **zero contracts in all three worlds**. That map is empty in this world
— the declaration lives on the week's **overlay** or on the **microcycle that
covers it**, and `selectStoredWeekDeclaration` owns that precedence.

Reading the store map directly is asking a different question and getting a
confident answer to it. **A tape that had been believed would have reported "the
accumulator is always empty" about a world holding six rows.** The photograph now
goes through the door every reader uses.

## WHY THE DELETE PUT NOTHING THERE — READ, AND IT IS A CONDITION, NOT A GAP

`userRemovalConstraints.addFrequencyReduction` (`:156`) is the join between the
delete this tape acted and the accumulator it did not move. It writes a row with
`reason: 'explicit_user_override'`, and its own detail line states the
condition:

> *"Athlete removed {scope} from {date}; **relocation and substitution were
> exhausted**."*

Its owner `applyAthleteRemovalTypedReduction` is documented as the
*"last-resort Section 18 projection for a valid athlete deletion — the candidate
has already exhausted relocation/substitution search"*, and it returns early
whenever `reduced >= original`.

**So a typed reduction is not what a delete produces. It is what a delete
produces when the week cannot absorb it.** The tape deleted the last future
non-team session in a week with room to spare; §18 relocated or substituted, and
there was nothing to authorise. **The world was reached correctly and the probe
was too easy.**

## WHAT ITEM 1 NEEDS NEXT — one named probe, not a search

**A delete the week CANNOT absorb**, so `applyAthleteRemovalTypedReduction`
reaches `addFrequencyReduction`. Concretely: delete enough of a pattern that
relocation and substitution are exhausted, then photograph. That is one more act
in the same tape, not a new instrument.

Two other writers exist if that one proves awkward to reach, and both are
readiness/injury-shaped rather than decision-shaped —
`section18AcceptedWeekGateway.ts:437/1080` and `section18SafetyPolicy.ts:78`.
Prefer the delete: it is the kind the kickoff's symptom sentence names, and it
is the only one of the three with a ledger entry behind it.

Until a reduction lands in the ACTED photograph, item 1 stays open and the unit
stays unpriced. **It is one act away, not one investigation away** — which is
the difference this tape bought.

## AN EXISTING LAW CAUGHT THE INSTRUMENT ON ITS FIRST FULL CHAIN

`profileMirrorNarrowingTests` — *"the one-door law reaches TEST sources, and the
census is exact"* — failed on the tape:

> *1 test source(s) assign `onboardingData` around the write owner without being
> declared: `lr29BootReplayTape.ts`. Fixtures reach state by ACTING — route the
> write through the owned door, or declare it as debt with a reason.*

The line was copied from `quiescentBootTests`, which is on the declared-debt
list. **The debt was PAID rather than declared:** the direct clear was
unnecessary — the tape runs one world per process, and the two profile doors
author the whole profile on their own. The census is exact in both directions,
so declaring it would also have been a permanent entry for a temporary
instrument.

Worth naming because it is the second instrument-caught-by-a-standing-law event
in one session: **a brand-new file inherits every app-wide law the moment it
enters the chain, including the ones its template was exempt from.**

## THE GATE

Full **unpiped** `npm run test:bible`: **`GATE_EXIT=1` at
`test:program-control-durable`, 1 FAIL line** — main's declared red, unchanged.
`test:compile` PASSED. **Sweep 2 of 169** (`scripts/sweep.sh lr29-tape`,
`head=81b59585`) — the declared set exactly. The tape itself is not in the
chain; the sweep is what proves adding it moved nothing.

## NOT COVERED

- **ONE decision kind, ONE week, ONE world, DEPTH 1** (one act after
  generation). L13's accumulated state is not reached; a world 43 revisions deep
  may accumulate differently, and the kickoff's symptom is a worn-world symptom.
- **Illness, injury, readiness and phase are not measured and cannot be** — §3 of
  the dependency list measured that the ledger has no vocabulary for them. That
  fork needs a ruling before any tape can cover it.
- **No device evidence.** Harness measurement only.
- **The tape asserts nothing.** It is not a gate and a green run of it means
  nothing; only the printed numbers are the result.
