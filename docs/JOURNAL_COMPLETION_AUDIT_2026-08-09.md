# THE JOURNAL UNIT — COMPLETION AUDIT (2026-08-09)

The standing authorisation's slice list is finished. **That is not the same as
the unit being finished**, and the difference is what this document measures:
every item in the design and the addendum, against what is actually on the
screen, with a receipt per claim.

Written because "the list is done" is a status claim, and this repo has a
standing law that a status claim carries a code receipt at the claim or says
OPEN-UNKNOWN.

## MONDAY CARD (base design)

| # | Item | State | Receipt |
| --- | --- | --- | --- |
| 1 | Did the work happen, with reasons | **BUILT** | `JournalWork`, `DidTheWorkHappen` |
| 2 | Strength line, arrow vs last week | **BUILT** | `rules/journalStrengthTrend.ts`, `64d142d7` |
| 3 | Load vs your normal | **BUILT, DARK** | `rules/journalLoad.ts`; behind `signedValue` pending Sam's constants |
| 4 | How you said you felt — FACTS | **BUILT** | `JournalFelt`, extended by the feel slice |
| 4 | Observation LINES | **PARTLY** | region lines exist (dark); the "facts beside each other" lines are NOT built |
| 5 | Note prompt + tags | **BUILT** | `journalNoteStore`, slice 2 |

## ADDENDUM GROUP 1

| # | Item | State | Receipt |
| --- | --- | --- | --- |
| 1 | Key exposures, not completion counts | **NOT SURFACED** | `countWeeklyExposures` is called by the screen for hardness only; no section shows exposures |
| 2 | What changed / what was protected | **NOT BUILT** | owners measured: `useDecisionLedgerStore` + `section18ShortfallDisclosure` |
| 3 | Week status — one calm line | **NOT BUILT, AND DELIBERATELY** | needs a freshly-derived ledger; the stored-tally route was refused by a gate (`67f80e0b`) |
| 4 | This week's job | **BUILT** | `rules/journalWeekJob.ts`, `67f80e0b` |
| 5 | Week shape strip | **BUILT** | `WeekShapeStrip`, slice 1 |
| 6 | Post-game wording (physical 1-5) | **BUILT** | `gameFeel`, `41d847d7` |
| 7 | Extra tags (sleep, illness, travel) | **BUILT** | `JOURNAL_NOTE_TAGS`, slice 2 |

## ADDENDUM GROUP 2

| # | Item | State | Receipt |
| --- | --- | --- | --- |
| 8 | "Session felt different" exception | **BUILT** | `expectation` + `expectationReason`, `41d847d7` |
| 9 | Niggle history | **BUILT** | `rules/journalNiggleHistory.ts`, `b75cc63f` |
| 9 | Note resurfacing | **BUILT, route (a)** | by TIME; route (b) needs a region on a note — Sam's |
| 10 | Progress markers | **BUILT** | week-over-week arrow + the monthly gain line |
| 11 | Progressive data states | **BUILT** | `deriveJournalDataState`; enforced in `journalMonth` |

## MONTHLY REVIEW (base design)

| Item | State | Receipt |
| --- | --- | --- |
| Anchor-lift trend chart | **BUILT** | `journalMonth` + `TrendChart`, `a04f2cb6` |
| Conditioning progression | **BUILT** | same |
| Load continuum over time (ruling layer 5) | **NOT BUILT** | downstream of unsigned band constants — would be dark anyway |
| The balance picture (ruling layer 5) | **NOT BUILT** | `patternSharesDone` exists and is SIGNED — buildable now |
| Consistency % + total sessions banked | **NOT BUILT** | `JournalWork` per week is already derived |
| "Your month in flags" | **NOT BUILT** | soreness/feeling counts exist; illness/readiness facts need reading |
| One satisfaction line | **BUILT** | `journalMonth.gains`, `a04f2cb6` |

## THE HONEST SUMMARY

**FINAL: 22 of 22 items built or measured-and-named.** After the four buildable
items (`a440136c`, `8e46b7d9`, `c8a349a6`, week kinds), week status (`ff12921f`)
and what-changed landed, nothing in the design or the addendum is unaccounted
for. What remains is Sam's, and one half-item whose FACT does not exist:

- **"What was protected"** — the app's answer is a disclosure at the DOOR, not a
  stored record. Re-deriving it for a past week would be a reconstruction rather
  than a record. **Recording it is an engine-side change to the decision doors**,
  named as owed with the reason (batch 25-d).
- **The "facts beside each other" observation lines** (Monday item 4) — the
  region lines exist and are dark; the wider set is downstream of the same
  unsigned constants.

*Original count when this audit was written: 16 of 22, six remaining in three
kinds — kept below so the correction above is legible rather than tidied away.*

**(a) BUILDABLE NOW, no ruling needed** — consistency % + sessions banked, the
balance picture, "your month in flags", key exposures. All four are readers of
derivations that already exist. **These are the unit's remaining work.**

**(b) BLOCKED ON A DERIVATION THAT MUST BE BUILT PROPERLY** — week status, and
"what changed / what was protected".

**CORRECTION, SAME DAY: week status is NOT blocked, and I called it too early.**
Re-measured after the audit was written: `evaluateSection18EffectiveWeek`
(`rules/section18EffectiveWeekEvaluator.ts:1083`) takes
`{ contract: WeeklyExposureContractV2, workouts, weekStart }` — all three of
which the Journal already holds — and **BUILDS A FRESH LEDGER internally**
(`buildLedger(input)`), returning a freshly-assessed contract and its blocking
findings. That is precisely the "freshly-derived ledger" the shortfall gate
demanded, and it is the V2 owner rather than the superseded V1 path.

The lesson is worth more than the item: **"blocked" was my inference from the
gate's refusal, not a measurement.** The gate refused a STALE READ; it never said
the derivation was unreachable. An honest "blocked" needs the same receipt as an
honest "built".

"What changed / what was protected" IS still blocked — it needs the decision
ledger, whose vocabulary gap (no illness/injury/readiness/phase) is already
measured by the LR-29 dependency list.

**(c) WAITING ON SAM** — the load continuum chart (unsigned constants), the
notification (native dependency + permission), resurfacing route (b) (reopens a
closed vocabulary).

**Nothing in (a) is waiting on anything.** The unit is not at its end.
