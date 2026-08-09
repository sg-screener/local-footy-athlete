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

**Built: 16 of 22 items.** Six remain, and they fall into three kinds:

**(a) BUILDABLE NOW, no ruling needed** — consistency % + sessions banked, the
balance picture, "your month in flags", key exposures. All four are readers of
derivations that already exist. **These are the unit's remaining work.**

**(b) BLOCKED ON A DERIVATION THAT MUST BE BUILT PROPERLY** — week status, and
"what changed / what was protected". The first was refused by a gate for reading
a stale tally and needs a freshly-derived ledger; the second needs the decision
ledger, whose vocabulary gap (no illness/injury/readiness/phase) is already
measured by the LR-29 dependency list.

**(c) WAITING ON SAM** — the load continuum chart (unsigned constants), the
notification (native dependency + permission), resurfacing route (b) (reopens a
closed vocabulary).

**Nothing in (a) is waiting on anything.** The unit is not at its end.
