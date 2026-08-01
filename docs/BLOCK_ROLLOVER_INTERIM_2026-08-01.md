# Block-rollover interim — boundary report (2026-08-01)

Unit 1 of the day shift. Branch `feat/block-rollover-interim` from merged
main (`ea2dba3`). Pays Sam's interim ruling (2026-07-31, TOP of the
post-merge queue): **the existing rollover must SUCCEED, or REFUSE HONESTLY
with a sentence — the silent stop IS the defect, not the failure.** The
Stage B end state (a rolling ~two-block horizon derived on demand, no
rollover event at all) remains queued and is NOT this payment.

## What changed

- **The boundary refuses typed** (`programBlockRollover.ts`): the catch that
  rethrew now returns `refusal: { code }` on the unchanged store (the rebuild
  candidate is validated whole by `commitRebuiltProgram` and never committed
  on failure, so "your current weeks are unchanged" is a fact, not a hope).
  The tape gains `athlete_action_failed` (outcome `refused`) and an
  `athlete_ui_outcome_shown` witness.
- **The sentence has the one owner** (`readinessAcknowledgment.ts`,
  `buildRolloverAcknowledgment`): null when there is nothing to say, never
  null for a refusal, never forwards the engine code. Copy sheet Batch 8
  (PROPOSED; signatures parked — `docs/PARKED_QUESTIONS_2026-08-01.md` §1).
- **The screen tells and retries** (`useHomeScreen` + `HomeScreenV2`): the
  silent catch-and-log is gone; the refusal renders as a persistent card on
  the week screen (not gated on `isNormal` — a stopped program says so in any
  mode) with "Try again", which clears the attempt key and runs the same
  boundary once more. A retry nonce joins the attempt key so retrying is a
  state change, not a ref hack. The belt catch remains: if the no-throw
  contract ever breaks, the athlete is STILL told.
- **L6 re-pointed to the ruling's exact terms** (walker, both tiers): an
  honest typed refusal is L6-LEGAL; what offends is a THROW, a refusal the
  ack owner answers with nothing, or a raw code reaching the athlete.
  Declared red 6 (`block_rollover_fails_silently_and_the_program_stops`) is
  DELETED AS PAID — its tombstone names this unit.

## Depth reached (L13)

Deep tier green at FULL depth on default heap: seeds reached 81 / 53 / 94
days (11.6 / 7.6 / 13.4 weeks), final weeks LIVE — the walks now roll
through multiple blocks, which no previous run of this harness ever did
(the silent stop capped every earlier walk at the first spent block).

## L12 — what catches the next defect of this class

The clock door drives the REAL `rolloverProgramBlock` after every
advance_time and holds L6's three offence shapes in both tiers, after every
action. A future lifecycle boundary that starts throwing again, or a
refusal path that loses its sentence, reds in `test:bible` before a phone
sees it. The render half is a source-visible card fed by the ack owner —
the same split the schedule-ack unit uses, with the same recorded
limitation (no mounted-render harness; the tape witness rides beside it).

## NOT-COVERED

- **Retry is manual.** No backoff, no auto-retry: the ruling asked for
  honesty, not resilience. If the blockers are permanent (ledger mismatch),
  retry honestly fails again and the sentence stands.
- **`test:block-state` is RED on clean merged main, standalone, NOT in
  `test:bible`** — pre-existing non-bible rot (its fixture profile predates
  the equipment unit's required `equipmentAnswer`; `ProgramGenError:
  missing_required_profile` at suite scope). Verified on a clean worktree at
  `ea2dba3` before this unit changed anything. Recorded so it is never
  misattributed to this unit; it belongs to the non-bible-test-rot sweep.
- **Batch 8 signatures pending** (parked §1) — shipped PROPOSED per the copy
  sheet's transitional rule.

## CONVERGENCE

Toward. No stored state added; one representation removed (the throw-shaped
failure channel every caller had to guess about — the boundary now answers
in one typed shape). The refusal sentence has one owner beside its siblings.
