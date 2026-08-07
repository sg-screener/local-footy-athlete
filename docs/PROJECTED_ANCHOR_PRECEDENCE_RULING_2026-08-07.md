# PROJECTED-ANCHOR PRECEDENCE RULING — 2026-08-07

Answers docs/R53_TWO_DIAGNOSES_2026-08-07.md (`ed75aeac`). Ruled by the
review seat per RULE-DON'T-ASK — every clause below is an existing law
applied, not a new product decision. Sam holds a veto.

## (a) MOVE CELL 19 — the projection stands, the overwrite dies

1. **The projection itself STANDS.** Bible §2: "Game day is the main
   anchor of the week" (the onboarding influence map carries the same
   line: the week is built around `usualGameDay`). Bible :4670: "a
   KNOWN in-season bye conditionally releases the athlete's usual game
   day" — release requires a KNOWN bye; a silent calendar is not a
   declared bye. So planning a markless future in-season week around
   the usual game day is Bible-backed behaviour, and leg (iii)
   deriving `game` from the profile on a markless week is NOT itself
   the defect. Nothing about what `usualGameDay` means changes. The
   blast radius the diagnosis feared does not exist.

2. **The overwrite DIES.** The ratified precedence ordering
   (2026-08-06: the athlete's mark outranks stored output —
   dayPrecedence.ts is law) already decides this. The athlete's moved
   session is a DECISION; a materialised projected game is DERIVED
   output. Derived output never outranks a decision's placement.
   Bible :4698 confirms the same law from the fixture side: even a
   REAL fixture displaces an accepted session only with a recorded
   displacement and a restoration target — nothing displaces
   silently. A projection, which names no calendar fact on that day,
   has strictly less authority than the real fixture that must
   record its displacements.

   **Fix shape (systemic, per the no-edge-case-fixes project law):**
   the projected anchor keeps setting the week's SHAPE (bye
   resolution, spacing, G-1/G-2 geometry), but day occupancy in
   `resolveFinalVisibleSection18Week` composes under dayPrecedence
   like every other surface: an athlete-placed session on the
   projected day wins the day. `detectAthleteMoveContentLoss` stays
   exactly as it is — it was right.

3. **The residual CLOSES FIRST.** One probe: attribute
   `profilePhase: In-season` vs `storedMode: early_offseason`
   (shared-store carry-over across cells vs genuine divergence).
   This is NOT either/or with the fix above: the precedence rule is
   systemic and builds regardless; the probe only decides whether the
   cell-19 witness ALSO needs seed isolation. If it is store
   carry-over, that is a witness defect and gets its own fix under
   the fixture-fidelity laws.

4. **Order unchanged:** condition 1 stands — re-measure the priced
   configs with the precedence-obeying projection BEFORE building;
   the basis fix (`LFA_BASIS=visible`) ships WITH leg (iii) as
   already settled.

## (b) THE FREED DAY — STOP stands, next probe ordered

The producer is still unnamed, so the diagnosis STOP stands on its own
terms. Next probe, as the diagnosis itself located it: start at
`commitWeekScopedOverlay`'s merge behaviour when a published field is
explicitly `undefined` — the seed probe shows `contractSource: overlay`
in BOTH worlds, so that merge is where the two worlds stop agreeing.
Attribution before any build. If the producer is still unnamed after
that probe, STOP back to the seat with what was excluded.

## Standing

Nothing else moves. Cell 22 re-pin waits for leg (i); cell 23 remains
diagnosed-before-ruled; both tracked debts still owed; parallel-gate
stage 1 remainder at the next natural boundary; STOP at R5 close.
