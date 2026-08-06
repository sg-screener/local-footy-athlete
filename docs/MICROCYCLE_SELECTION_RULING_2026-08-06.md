# MICROCYCLE SELECTION RULING — 2026-08-06

Rules the mechanism pinned at 24e55110 (question 3 of the option-2
stop). Ruled by the review seat per RULE-DON'T-ASK; Sam holds a veto.

## Ruling — a week composes against the microcycle that COVERS it

Composition selects the microcycle whose range covers the week being
composed — never currentMicrocycle-as-of-today. Today's date selects
nothing about another week's composition. Grounds: THE WORLD IS ITS
INPUTS (quiescent boot law 2); the anchor ruling (a re-derivation
never consults the wall clock as a decision); the pin itself — every
persisted input is present and identical, so the right answer is a
pure function of inputs that already survive. Nothing is stored,
nothing re-stored; question 4's rejected branches stay rejected.

## Conditions

1. ONE owner for the selection (a covering-selector keyed by the week
   being composed); every week-composing caller routes through it.
   Blast radius measured across those callers BEFORE landing —
   backward weeks are the general case (any athlete viewing a week
   other than today's), so the fix is app-wide by construction, not
   walker-scoped.
2. The two-directional cell proves select-by-coverage INDEPENDENT of
   the wall clock: a world where currentMicrocycle differs from the
   covering microcycle must compose correctly regardless of the
   machine date. This guarantees the inert-clock-seam repair (next
   item) cannot re-mask the defect.
3. The inert setWorldClock() seam (devE2EClockSnapshot null under
   __DEV__=false — the receipt written, never read) is its OWN small
   unit, fixed only AFTER condition 2's cell lands, so harness time
   becomes honest without hiding anything.
4. Option 2's stale-contract correction stands. The L16 slice greens
   unedited. Condition 4 and the merge stay blocked until the branch
   prints BIBLE_TRUE_EXIT=0.
