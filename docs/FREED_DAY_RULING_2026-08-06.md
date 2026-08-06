# FREED-DAY RULING — 2026-08-06

Ruled by the review seat per RULE-DON'T-ASK during the V3 build; Sam
holds a veto. Recorded here because it was issued in-session and cell
8's rewrite must cite a dated doc, not a chat message.

## Ruling — the deriver's empty freed day is CORRECT

After a fixture is removed, the freed day returns to whatever the
athlete's pattern and the mode's authored rules derive — including
empty. Filling it was the fixture-identity-1 bug generalised (the
replan engine's opinion). Grounds: fixture-identity-1 (Sam's Saturday
catch); §18 passing with ZERO shortfall on the derived week (the
required work is present, attach-first having stacked it); 90/10 (a
free day is never owed work by default). Where a mode's authored
policy genuinely demands work on that day — the bye-build world — the
deriver builds it, and the cell pinning that stays green.

## Supersession

This PARTIALLY SUPERSEDES the baseline half of
docs/1B_FLUSH_OFFER_RULINGS_2026-08-06.md ruling 2: the sentence
"Rebuilt bye week must equal the no-1b baseline: Saturday hard
conditioning built" described the replan engine's output. The surviving
law is the ruling's substance — the flush never survives a fixture
change — asserted against the DERIVER's week. Cell 8's fixture-change
half is rewritten to: no flush anywhere after the rebuild, and the
week's contract totals hold (§18 green, zero shortfall) — totals
ASSERTED, never mirrored from output.

## Consequence already identified (the next unit)

Ruling 2's implementation lives inside fixtureMinimalReplan (:294) —
the layer V3 stops publishing. It re-homes in the deriver (the same
one-owner law as 1b ruling 1), never patched at the door. The rebuilt
deletion seeds likewise assert contract totals rather than mirroring
deriver output.
