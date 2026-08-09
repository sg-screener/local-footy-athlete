# THE MONTHLY REVIEW — dependency list, measured before a line is written

The LAST slice in the standing authorisation's list (docs/SEAT_INBOX.md item 1):
**"monthly review incl. the ruled charts."**

Ruled: docs/JOURNAL_DESIGN_2026-07-23.md §"Monthly review";
docs/JOURNAL_LOAD_MODEL_RULING_2026-08-08.md layer 5 and its guards.

## 1. THERE IS NO CHART WALL TO CLIMB — measured

Unlike the notification, **the app can already draw**. `react-native-svg` is a
dependency AND is genuinely wired — `AppNavigator.tsx:5`, `PlanChangeSheet.tsx:3`
and `GuidedInjuryFlowSheet.tsx:3` all import and render `Svg`/`Path`/`Circle`
today, so the native module is linked and working on the build Sam already runs.

`victory-native` and `@shopify/react-native-skia` are also dependencies but are
**imported nowhere in `src/`**. That is worth stating rather than discovering
later: a dependency nobody imports is unproven on the device, and reaching for
one would put an unverified native module between the athlete and a chart.

**RULING (mine, veto open): draw with `react-native-svg` directly.** It is the
only one of the three with a receipt on this build, the charts Sam ruled are
simple (a line over weeks, a band, a couple of bars), and a charting library
brings axis/legend/theme defaults that would fight the design language every
other surface in this app was hand-built to. If a chart later needs something
genuinely hard, `victory-native` is still there — but it should be adopted with a
reason, not by default.

## 2. THE DATA IS ALREADY DERIVED — every chart's series exists

| Ruled chart | Series | Owner, already built |
| --- | --- | --- |
| Anchor-lift trend (top set over time) | weekly best top set per lift | `rules/journalStrengthTrend.ts` — needs a multi-week variant, see §3 |
| Conditioning progression | weekly sRPE AU | `rules/journalLoad.ts` — `JournalLoadWeekTotals.conditioningSRPE`, already computed per week in `history` |
| Load continuum over time (ruling layer 5) | weekly ratio vs the signed band | `rules/journalLoad.ts` — the ratio exists and is DARK behind `signedValue` |
| The balance picture | pattern shares + upper/lower | `rules/journalLoad.ts` — `patternSharesDone` is SIGNED already |
| Consistency + sessions banked | completed vs planned per week | `rules/journalWeek.ts` `JournalWork`, per week |
| "Your month in flags" | soreness / feeling / illness counts | `JournalFelt` + the readiness and illness facts |

**Almost nothing new needs deriving.** `buildJournalLoadModel` already returns a
`history` array of per-week totals — the monthly review is largely a READER of
what the load slice built, which is why the load slice came first.

## 3. THE ONE GENUINELY NEW DERIVATION

`journalStrengthTrend` answers "this week vs last week" and nothing else. The
design's satisfaction line — *"you've added 12.5kg to your trap bar since
March"* — and the anchor-lift trend chart both need **the same lift's best top
set across many weeks**, which that module does not expose.

That is a small, honest extension of an existing owner (a multi-week series
beside the week-over-week arrow), **not a second module**. The strength line's
boundary report already named it as belonging here.

## 4. SAM'S GUARDS, WHICH ARE THE HARD PART

His own words in the ruling, and each is a gate rather than a preference:

- **NO CHART WALLS** — few charts, each telling one story. A screen of six
  charts is the failure mode, and it is easy to reach by building one per
  available series.
- **PROGRESSIVE DATA STATES HOLD** — *"no chart renders until its history is
  honest (never one floating dot; 'builds as you train' copy until then)"*. The
  data-state schedule already exists (`deriveJournalDataState`,
  `TREND_MIN_WEEKS = 6`), so this is a wiring job, not a new concept.
- **PLACEMENT** — monthly review first; *"anything on the weekly card stays a
  line of words, not a graph"*. The Journal's weekly sections must gain no chart.
- **NO RAW AU, OBSERVATION NEVER DIAGNOSIS** — the load ruling's laws bind the
  chart labels exactly as they bind the sentences.

**The load continuum chart is downstream of UNSIGNED constants** (the band edges,
the stream weighting), so it is subject to the same `signedValue` refusal as the
headline: **buildable, testable, and DARK until Sam signs.** The conditioning
progression and the balance picture are not — they need no band.

## 5. THE ARCHITECTURAL QUESTION

The monthly review is a second TIME SCALE, not a second model. It must read
`JournalLoadModel.history`, `JournalWeek` and the strength series — never
re-group `sessionFeedback` itself. A monthly module that regrouped the raw store
would be a second answer to "what happened in week N", and the two would drift
the first time a rule about which sessions count changed.

**RULING (mine, veto open): `rules/journalMonth.ts` takes the already-derived
weekly records as input and composes months from them.** Same discipline as the
Monday card: a projection over derivations, never a second reading of the stores.

## 6. NOT COVERED / STILL PARKED

- The notification (Sam's, unchanged).
- Week status from a freshly-derived ledger.
- Whether `victory-native` should be adopted after all — named above, not assumed.
- No device evidence; and a CHART is the first thing in this unit whose defects
  are mostly visual, which makes the absence of device evidence matter more here
  than anywhere else so far. **Sam's eye is the instrument for this slice.**
