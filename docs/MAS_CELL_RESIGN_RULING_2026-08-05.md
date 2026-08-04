# The 15:15 Blocks intensity cell — Sam's re-signing, 2026-08-05

Context: `%MAS` ruling 4 (2026-08-06 kickoff batch) marked the
`≤30s → 110%` binary ACCRETED. Git archaeology (review seat, 2026-08-05)
showed the function citation is not a projection artifact: the string
`110% MAS (15 s work per masIntensityForWorkSeconds, src/utils/masCopy.ts)`
is present in the workbook lineage back to
`CONDITIONING_TEMPLATES_SAM_STATE_2026-07-25.xlsx` — the accreted rule
leaked into one signed cell during the July authoring push.

**RULING (Sam, 2026-08-05): the cell re-signs as plain `110% MAS`.**
No function citation. A point value, not a range — deliberately, because a
single percentage derives an exact per-athlete distance
(MAS × 1.10 × work seconds) while a range would need a new picker rule,
i.e. a new invented decision authority.

Sam's product intent, recorded for the MAS-wiring unit: the athlete's
screen shows the derived distance per effort ("cover ~X m each 15 s"),
derived at render from the athlete's own MAS. The prescription (`110% MAS`)
stays the stored decision; the distance is never stored.

Build notes:
- The workbook cell edit (docs/CONDITIONING_TEMPLATES_FINAL_2026-07-25.xlsx,
  Aerobic Power tab) and its equality-gated code cell
  (src/data/conditioningTemplates.ts:902) ship together inside the
  switchover unit, cited to this doc.
- The accreted binary (`masIntensityForWorkSeconds`) still dies when MAS
  wiring lands, per ruling 4; nothing here revives it.
