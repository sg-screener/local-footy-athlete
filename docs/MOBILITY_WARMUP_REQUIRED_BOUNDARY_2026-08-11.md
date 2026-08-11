# MOBILITY / WARM-UP COMPLETION — BOUNDARY — 2026-08-11

## What Sam ruled

Mobility / Warm-up is not optional. It stays in the session and the athlete's
ticks record whether it was completed or skipped, just like Strength. The
optional wording is removed.

## Options compared before implementation

1. Remove the word `optional` from the visual and accessibility copy while
   leaving mobility outside whole-session completion.
2. Remove that wording and include the already-tracked mobility section in the
   prescribed-section completion aggregate, while leaving separately authored
   Optional Work outside it.

Option 2 landed. Option 1 could still say Everything completed when the same
feedback card reported Mobility / Warm-up as skipped.

## What changed

- The mobility header now reads only its movement count.
- Its accessibility label no longer calls the section optional.
- Unticked mobility movements derive a skipped Mobility / Warm-up result.
- If every other prescribed section is completed and mobility is skipped, the
  whole session is partial rather than full.
- Completing mobility and every other prescribed section derives a full session.
- The existing per-movement checkboxes, chevron and durable item evidence remain
  the source of truth.
- The accepted save transaction uses that same item evidence, so it cannot
  recalculate an otherwise complete session back to full after mobility was
  skipped.
- Separately authored Optional Work is unchanged and remains outside the
  prescribed completion aggregate.

## What catches the next defect of this class

The existing in-chain checklist guard now checks both meanings, not only the
word: the mobility component contains no optional copy, unticked movements derive
skipped, skipped mobility prevents a full session result, and completed mobility
allows full only when the other prescribed sections are also full. A transaction
boundary cell pins the exact execution-item input and its precedence over the
legacy component aggregate.

## First-run finding

The reload guard went red because its acted fixture completed Strength, skipped
Mobility / Warm-up, and still expected a full stored session. That expectation
was the superseded rule made executable. It now requires the partial result and
still proves the skipped mobility evidence survives force-quit and relaunch.

## LOOP CHECK

`label-changed-while-behaviour-stays-old` — first named sighting in this surface.
The compression is one prescribed-section aggregate consumed by feedback, not a
copy-only exception.

## NOT COVERED

- Sam's physical iPhone.
- A simulator/glass run of the expanded mobility section and the resulting
  partial feedback summary.
- VoiceOver traversal order between mobility and the following Strength section.
- Any future recommendation logic that interprets repeated skipped warm-ups;
  this unit records the evidence and changes no program automatically.
