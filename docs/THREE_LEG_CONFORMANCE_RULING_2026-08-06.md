# THREE-LEG CONFORMANCE RULING — 2026-08-06

Rules the entry-gate stop at b6f55c2c. Supersedes the two-legged shape
of docs/REPAIR_WRITEBACK_RETIREMENT_RULING_2026-08-06.md (refuted by
its own condition 1 — the doc stands as history). Ruled by the review
seat per RULE-DON'T-ASK; Sam holds a veto.

## Ruling — the three-legged unit is AUTHORISED

The deriver implements dayPrecedence tier 4 in full, and nothing
persists conformance output:

- Leg (iii), the missing leg FIRST in the design: the fixture-aware
  contract derives at read (the covering week's identity + the fixture
  facts decide the mode — practice_match_week where the facts say so).
  This re-reads the earlier "byte-identical" measurement, which was
  taken while the write-backs still masked it.
- Leg (ii): §18 conformance runs in the deriver (tier 4, as
  dayPrecedence.ts:19 has declared all along), output never stored.
- Leg (i): ALL conformance write-backs retire — three doors, measured:
  programStore.ts:1404-1418, postGenerationConstraintValidation.ts
  :1773-1810 (the door the false census line hid), and the rolling-
  horizon republish route (stageRollingHorizonFixtureRepair →
  buildFixtureMinimalReplan → acceptedStateTransaction.ts:2806 — cell
  6's actual door).

## Binding conditions

1. PRICE FIRST: scaffold all three legs as mutations and measure the
   FULL witness set green before the real build begins —
   fixture-identity 6/6, deletion 24/24+5/5+3/3, accepted-state
   23/23+10/10+10/10, phase-structure 11/11, L16 20/20 both walkers,
   derived-repair-ownership HONEST (its 4/0 on a broken tree is a
   named vacuity — it joins the witness set only after it can red).
   If the priced set does not green, STOP and report — do not build.
2. Class B untouchable: decision-carrying overlay writes (illness
   reductions, undo, athlete removals as DECISIONS) stay. The
   retirement is conformance output only.
3. The read-path proof (every accepted-week reader re-derives) carries
   over from the superseded ruling, per leg.
4. Witnesses are never edited. Scaffold reverted before the real build
   lands commit by commit.
5. Then the run home unchanged: unpiped bible with the literal
   BIBLE_TRUE_EXIT line, condition 4 (markedDays proof), merge,
   post-merge unpiped bible, R5.7 whole-or-none, remaining batches.
   STOP at R5 close.
