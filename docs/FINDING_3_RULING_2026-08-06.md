# FINDING 3 RULING — 2026-08-06

Ruling on the single question in
`docs/FINDING_3_SUBSTITUTE_BEFORE_REDUCE_2026-08-06.md`.

Per RULE-DON'T-ASK (`docs/COWORK_SEAT_HANDOFF_2026-08-06_REBUILD_ERA.md`
§1), ruled by the review seat from the Bible, Sam holding a veto.

## Ruling — frequency holds; substitution fills the week

A restricted week HOLDS its selected strength frequency and fills the
freed days with safe work. `main_strength_frequency` reduces only when
no safe pattern remains (whole-body restriction).

Governing Bible lines, checked before ruling:

- `:4755` "Substitute before reducing frequency."
- `:1913-1917` (6-7/10): "Moderately reduce AFFECTED work … Keep
  unaffected work in where possible. Use off-feet conditioning if lower
  limb is affected." Every authored reduction at this severity is
  through the affected area; none caps the week's session count.
- `:72` "Continue to do work on unaffected areas." / `:93` "Get as much
  work as you can in around the injury."
- `:1417` "If the athlete is cooked, sick, sore or injured, reduce
  conditioning first before smashing strength."

A sweep for any load-based reason to run fewer sessions while injured
found none at 6-7/10: reductions are authored per-area, per-movement
(`:871`, `:923`, `:942`, `:955`, `:1050`, `:2134`), not per-week. The
8-10/10 band ("pause affected training … clearly unaffected training
only") is the whole-body case, where reducing frequency IS correct.

## Approved fix (question 5 of the finding doc)

- `strength_pattern_count` keeps its reduction to `requiredSafe.length`.
- `main_strength_frequency` reduces only when no safe pattern remains.
- Balance over meaningful main-lift counts already tolerates repetition.

## Tests

- Cell 10 paid, declared-red entry deleted in the greening commit: 6/10
  hamstring keeps session count, no empty day, squat+hinge stay
  prohibited, week stays §18-conformant.
- New whole-body cell: no safe pattern ⇒ frequency reduction stands.
- Golden movements enumerated in full, not read by first line.
