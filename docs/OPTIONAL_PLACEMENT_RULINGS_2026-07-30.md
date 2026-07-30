# Optional placement — SAM'S RULINGS

**Signed 2026-07-30.** All eight rows of
`OPTIONAL_PLACEMENT_SHEET_2026-07-30.md` are resolved. That sheet is left exactly
as sent; this is the answer to it.

---

## The governing principle

> **No defaults.** Build the program; if anything is lacking, add a spare
> optional session to make up for it. Strength and conditioning is the 90% —
> accessories, mobility etc. is the final 10%.

Optional placement is a **need-based top-up pass** that runs **after** the core
week is built, computes what the week **lacks**, and places **at most what fills
the lack**. No day-based or default placement of optional work exists anywhere.

This is a stronger rule than the sheet asked about. The sheet asked eight
questions; the answer collapses them into one mechanism plus two authored
exceptions.

---

## The eight rows

| Row | Ruling |
|---|---|
| **R1** G-1 Gunshow | **CONFIRMED as authored.** Bible-anchored and fixture-relative — an authored rule, not a default. |
| **R2** G-3 accessories | **NEED-BASED.** The trigger is the LACK, not the day. Prefer G-3 / Wednesday **when placing**. The day-based version is retired. |
| **R3** spare-day accessories | **KILLED.** Empty days stay empty; the athlete has the add menu. |
| **R4** bye 1-slot default | **KILLED as a default.** Bye weeks get the same need-based top-up as any week, nothing more. |
| **R5** scorer ACC candidate | **Real composed session only** (see below). |
| **R6** early off-season all-optional | **CONFIRMED.** The standing precedent. |
| **R7** rest-slot conditioning | **Real composed session only.** |
| **R8** adjacency-repair replacement | **Real composed session only.** Its authored adjacency trigger stands. |

### The class ruling that covers R5, R7, R8 and every other focus string

> **REAL COMPOSED SESSIONS ONLY** — Accessories from the prehab pools, Mobility
> from the mobility pool, per the signed structures. **A sentence on a day is
> invented composition; that class is dead.**

This is the sheet's own largest finding answered in one line. Four of the eight
rows placed a focus STRING describing accessory work rather than a session drawn
from the pools — the same invented composition that killed recovery, one step
less obvious because the sentence was plausible.

### Carried to the census

**R1 is placed by two owners** — the generator (`tier: 'optional'`) and the
resolver's `applyGameProximity`, for the same reason, agreeing today. Noted for
the census as flagged; not a defect now, and a change to the rule would have to
be made twice.

---

## §3 — Mobility, signed

- **The region table: SIGNED as presented, 20/20.** Now in
  `rules/mobilitySessionComposition.ts`, gated equal to the pool in both
  directions.
- **The 6-movement target inside the 5-8 window: SIGNED.**

---

## What this unblocks, and what it does not

**Unblocked and applied:** the mobility region table and target are signed and
carried into the code as signed.

**NOT unblocked:** the need-based top-up pass itself. Sam's instruction is
explicit — *"the need-computation is itself athlete-affecting logic: draft its
definition — which volumes are measured, thresholds, and caps — for Sam's signing
before wiring it."*

So **nothing is wired in this pass**, including the kills. R2, R3, R4, R5, R7 and
R8 are all entangled with the replacement mechanism: deleting them before the
top-up pass exists would leave weeks with core work and nothing else, which is
not what any of the eight rulings asked for. The draft is
`NEED_COMPUTATION_SHEET_2026-07-30.md`; the deletions land with the pass, in one
commit, when it is signed.
