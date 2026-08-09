# THE MONDAY CARD SLICE — dependency list, measured before a line is written

Next under the standing authorisation (docs/SEAT_INBOX.md item 1). Scope in the
order's words: **Monday card composition (+ local notification)**.

Ruled: docs/JOURNAL_DESIGN_2026-07-23.md §"The Monday card (weekly review)";
docs/JOURNAL_DESIGN_ADDENDUM_2026-07-28.md Group 1; the per-item dependency
table in docs/JOURNAL_UNIT_PLAN_2026-08-09.md, which this document updates
rather than repeats.

## 1. MOST OF THE CARD IS ALREADY BUILT — what actually remains

The unit plan's Monday table was written before any slice landed. Re-measured
today, item by item, with a receipt per claim:

| Card item | State now | Receipt |
| --- | --- | --- |
| 1. Did the work happen | **BUILT** (slice 1) | `JournalWork` in `rules/journalWeek.ts`, rendered by `DidTheWorkHappen` |
| 3. Load vs your normal | **BUILT** (load slice) | `rules/journalLoad.ts`; the comparison is computed and held behind `signedValue` pending Sam's constants |
| 4. How you said you felt — FACTS | **BUILT** (slices 1 + 4) | `JournalFelt`, now counting the body-feel rating and the expectation tap |
| 4. Observation LINES | **PARTLY BUILT** | The region lines exist in `journalLoad` (dark, unsigned). The "facts beside each other" lines the design describes are not built. |
| 5. Note prompt + tags | **BUILT** (slice 2) | `journalNoteStore` + the note box |
| Group 1.5 Week shape strip | **BUILT** (slice 1) | `WeekShapeStrip`; Moderate was ruled by Sam and derived |
| Group 1.6 Post-game wording | **BUILT** (feel slice) | `gameFeel` |
| Group 2.8 "Felt different" | **BUILT** (feel slice) | `expectation` + `expectationReason` |

**What genuinely remains for this slice:**

| Remaining item | Verdict | Owner / receipt |
| --- | --- | --- |
| 2. Strength line — best top sets, arrow vs last week (= Group 2.10 progress markers, same source) | **DERIVE, new pure code** | `SessionFeedback.strength[]` carries `exerciseName` + `weightKg` + `completedSets`/`actualReps` per week; the week-over-week comparison does not exist |
| Group 1.1 Key exposures, not completion counts | **FREE** | `countWeeklyExposures()` — already called by the Journal screen |
| Group 1.2 What changed / what was protected | **FREE-ish, with a measured caveat** | `useDecisionLedgerStore` + `rules/section18ShortfallDisclosure.ts`. **The ledger has no vocabulary for illness/injury/readiness/phase** (LR-29 dependency list), so "no reason recorded" is load-bearing, not politeness |
| Group 1.3 Week status — one calm line | **DERIVE + AUTHORED COPY** | Exposure-contract satisfaction + active facts. Every status is a claim → PROPOSED |
| Group 1.4 This week's job | **DERIVE + AUTHORED COPY** | `rules/seasonPhaseOwner.ts` + `rules/weeklyExposureContract.ts` |

## 2. THE WALL — THERE IS NO NOTIFICATION INFRASTRUCTURE, AT ALL

**Measured, not assumed.** `expo-notifications` is **not a dependency**; the
installed Expo packages are `expo`, `expo-av`, `expo-haptics`,
`expo-linear-gradient`, `expo-secure-store`, `expo-status-bar`. Nothing in `src/`
references a notification API.

So "delivered via local notification Monday morning" is not a code change inside
the app's existing capabilities. It requires:

1. **A new native dependency** (`expo-notifications`), which means a rebuild on
   Sam's device before anything can be verified;
2. **A runtime permission prompt** the athlete sees and can refuse — a new,
   outward-facing interaction, not a screen;
3. **A scheduling policy** — what time Monday, what happens when the athlete has
   no history yet, what happens if they open the Journal before it fires, and
   whether a refused permission degrades silently or is disclosed.

**THIS IS A SAM DECISION, AND IT IS PARKED RATHER THAN GUESSED.** The standing
authorisation says to park questions and continue, and adding a dependency plus a
permission prompt to the athlete's build is exactly the kind of change that is
his call, not a terminal's. It is also the one item in the whole Journal unit
that cannot be verified without a device.

**THE SLICE SPLITS CLEANLY, AND THAT IS WHY THIS IS NOT A STOP:** the Monday
CARD is a composition over facts that already exist and builds in full without
the notification. The notification is a delivery mechanism for a card that does
not exist yet, so building the card first is the correct order regardless of how
Sam rules.

## 3. THE ONE ARCHITECTURAL QUESTION THIS SLICE MUST ANSWER

The Journal screen currently renders "this week" as a set of sections. The Monday
card is **the same facts, composed as a weekly review** — and the trap is
obvious: composing a second set of sentences over the same derivation is a second
representation of the week, which is the defect class this repo names everywhere.

**RULING (mine, veto open): the Monday card is a PROJECTION of `JournalWeek` +
`JournalLoadModel`, not a second reading of the stores.** It adds a composition
layer over the two existing derivations and reads nothing new. If a card line
needs a fact neither derivation carries, the fact is added to the derivation that
owns it — never fetched a second way inside the card.

The strength line is the one genuinely new derivation, and it belongs beside the
load model, not inside the card: it is a fact about the athlete's history
(`rules/journalStrengthTrend.ts`), and the card is one of at least two readers
(the monthly review's anchor-lift charts are the other, already ruled).

## 3b. THE REMAINING THREE ITEMS — measured owners, for whoever builds them next

Read-only measurement done 2026-08-09 after the strength line landed, so the next
session starts from receipts rather than a search.

**Week status ("one calm line") and This week's job.** Both derive from the
week's CONTRACT:

- The contract is built per phase by `rules/weeklyExposureContractBuilders.ts` —
  `buildInSeasonExposureContract`, `buildInSeasonGameWeekExposureContract`,
  `buildEarlyOffseasonExposureContract`, and siblings.
- Its shape (`WeeklyExposureContract`, `weeklyExposureContract.ts:90`) carries
  exactly what "this week's job" is a sentence about: `strength.requiredPatterns`,
  `strength.targetCount`, `conditioning.targetCount`, `sprintCod.targetCount`,
  plus `identity.phase / subphase / mode / weekKind`.
- Satisfaction is `evaluateWeeklyExposureContract(contract, ledger)`
  (`weeklyExposureContract.ts:604`), with the ledger from
  `ledgerFromEffectiveWorkouts`.
- Season phase has ONE owner, `ownSeasonPhase` (`rules/seasonPhaseOwner.ts:114`),
  already used by `useSchedule.ts:153`.

**THE OPEN QUESTION, AND IT IS THE SAME TRAP THIS UNIT KEEPS MEETING:** the
Journal must ASK for the week's contract, not rebuild one. `useResolvedWeek`
returns `{ weekDays, visibleWeek, weekLabel, … }` and **does not expose the
contract or the phase**, so the next builder's first job is to find where the
generation path already resolves the contract for the visible week and read it
from there. **Building a second contract from the same inputs would be a second
answer to "what does this week ask of the athlete"** — which is the defect class
every slice in this unit has had to refuse.

**What changed / what was protected.** `useDecisionLedgerStore` plus
`rules/section18ShortfallDisclosure.ts` — whose `renderSection18Shortfall` is
already Sam's SIGNED sentence, so that half needs no new copy. **Caveat measured
by the LR-29 dependency list and still standing: the ledger has no vocabulary for
illness / injury / readiness / phase**, so "no reason recorded" is load-bearing
here rather than politeness.

**Both status lines are CLAIMS the app makes about the athlete's week**, so every
candidate sentence is PROPOSED copy in its own batch — the same rule the load
slice's band words follow.

## 4. NOT COVERED BY THIS PLAN

- The notification itself (parked, above).
- The monthly review and its charts — the slice after.
- Niggle history + note resurfacing + progress markers — the design groups
  progress markers with the strength line, so item 2 above delivers part of it;
  the rest is its own slice.
- No device evidence; no cell in this repo mounts the Journal screen.
