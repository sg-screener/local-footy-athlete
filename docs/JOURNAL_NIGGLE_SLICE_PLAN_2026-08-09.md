# THE NIGGLE + RESURFACING SLICE — dependency list, measured before a line is written

Next under the standing authorisation after the Monday card: **niggle history +
note resurfacing + progress markers** (docs/SEAT_INBOX.md item 1).

Ruled: docs/JOURNAL_DESIGN_2026-07-23.md; addendum Group 2 items 9 and 10; the
unit plan's per-item table.

## 1. NIGGLE HISTORY IS FREE — the input already exists and is already an INPUT

`InjuryEpisodeV1` (`rules/injuryEpisode.ts:35`) is persisted in the accepted
material context (`programStore.ts:367`, `:2377`) and carries everything the
history needs:

| Needed | Field |
| --- | --- |
| Which body region | `region`, `bodyPart` |
| When it started | `onsetOrReportedDate` |
| Whether it is over | `status`, `resolvedAt` |
| How bad | `severity`, `bucket` |
| How it moved | `transitionHistory[]` |
| Which weeks it touched | `affectedWeeks[]`, `affectedDates[]` |

**Zero new stored state.** The history is a pure derivation: group episodes by
region, order by onset, and report each one's span and outcome.

**The region vocabulary has ONE owner already** — `data/injuryRegions.ts`, whose
own header records that five divergent copies of that mapping used to exist and
disagree. The Journal asks it; it does not classify body parts itself.

## 2. RESURFACING HAS A MEASURED GAP, AND IT CHANGES THE FEATURE

The design's example is *"a knee-tagged note resurfaces when a knee niggle is
flagged"*. **Measured: a note cannot be knee-tagged.** `JOURNAL_NOTE_TAGS` is a
CLOSED vocabulary of eight — recovery, mobility, injury, diet, work_stress,
sleep, illness, travel — deliberately closed (slice 2's boundary: "a free-text
tag set would be an unauthored vocabulary growing on the athlete's device"). No
region is among them, and a note carries `weekStart`, `text`, `tags`,
`createdAt` and nothing else.

So resurfacing **by tag region is not buildable today**. Two honest routes:

**(a) RESURFACE BY TIME, WHICH IS BUILDABLE NOW AND NEEDS NOTHING NEW.** When a
niggle in region R is active, show the athlete what they wrote during the weeks
an EARLIER episode in region R was active — found by intersecting the note's
`weekStart` with the episode's `affectedWeeks`, filtered to `injury`-tagged
notes. That reads: *"Last time your hamstring flared (March), you wrote: …"* It
is a real feature, it uses only inputs that exist, and the link it claims — same
region, same weeks — is a fact rather than an inference.

**(b) ADD A REGION TO A NOTE.** A ninth tag dimension, a new stored field, and a
change to a closed vocabulary Sam ruled. That is his call, not a terminal's.

**RECOMMENDATION (mine, veto open): build (a).** It delivers the design's intent
— old notes surfacing at the relevant moment — without reopening a vocabulary Sam
deliberately closed, and without asking athletes to tag a body part they have
already described in free text. If (a) proves too coarse in use, (b) is still
open and will then be a decision with evidence behind it.

**THE HONESTY BOUNDARY TO HOLD:** a resurfaced note is shown BESIDE the episode,
never as a cause of it. The load ruling's "observation, never diagnosis" applies
verbatim — "you wrote this the last time this happened" is a fact; "this is why
it happened" is a claim the app must never make.

## 3. PROGRESS MARKERS ARE PARTLY DELIVERED

Addendum item 10 shares the strength line's source, and the strength line
shipped (`rules/journalStrengthTrend.ts`, commit `64d142d7`). What that module
does NOT yet do is look further back than one week — the design's marker is
"you've added 12.5kg to your trap bar since March", which is a span, not a
week-over-week arrow.

**That extension belongs to the monthly review**, where the ruling already puts
anchor-lift trend charts, and building it here would put the same derivation in
two slices. Named, deferred, not forgotten.

## 4. WHAT THIS SLICE WOULD ADD

- `rules/journalNiggleHistory.ts` — pure derivation over `injuryEpisodes`,
  region-keyed via the existing region owner.
- Resurfacing route (a) — a pure join between episodes and notes, no new state.
- A Journal section, and a copy batch for its words (every line is a claim).
- **Zero new stored state**, on route (a). North star: TOWARD.

## 5. NOT COVERED

- Route (b) — a region on a note — is Sam's ruling and is NOT assumed.
- The multi-month progress marker (monthly review's).
- The monthly review and its charts.
- No device evidence; no cell in this repo mounts the Journal screen.
