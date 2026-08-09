# THE LOAD SLICE — dependency list, measured before a line was written

Seat order 2026-08-09 (docs/SEAT_INBOX.md item 1). Builds the model ruled in
docs/JOURNAL_LOAD_MODEL_RULING_2026-08-08.md. The V3 law requires the
dependencies be MEASURED, not assumed, before the build opens — this is that
measurement, and two of its findings changed the design.

## 1. WHAT IS ALREADY STORED — the whole model's input set

Every layer's input already exists as a persisted athlete INPUT. **This slice
adds no stored state at all**, which is the north-star answer for the unit:
TOWARD.

| Layer | Input | Where it lives | Receipt |
| --- | --- | --- | --- |
| 1 strength stream | prescribed sets / rep range / kg, plus real logged sets when the athlete logged them | `SessionFeedback.strength[]` | `src/utils/strengthLogging.ts:6-25`, written at `src/components/SessionFeedbackPanel.tsx:517` |
| 1 conditioning stream | `rpe` and `totalTimeMinutes` | `SessionFeedback.conditioning` | `src/utils/conditioningLogging.ts:26-36`, written at `SessionFeedbackPanel.tsx:534` |
| 2 the normal | four weeks of the above | `programStore.sessionFeedback`, keyed by ISO date, persisted, never pruned | `src/store/programStore.ts:1693` |
| 3 region | 193 signed exercise rows; 53 signed conditioning rows + the modality map | `muscleMetadataFor(name)`, `conditioningSessionMuscles({exercise, modality})` | `src/data/muscleExperienceMetadata.ts:2085`, `src/data/conditioningMuscleMetadata.ts:803` |
| 4 pattern | movement → squat/hinge/push/pull; upper/lower region | `mainPatternForExerciseMovement()`, `getExerciseTags(name).region` | `src/rules/strengthPatternContributions.ts:364`, `src/data/exerciseTags.ts:3439` |
| fallback rung | the day's shape | derived by `rules/journalWeek.ts` from the projection | `journalWeek.ts:189` |

**No new mapping is authored by this slice.** Every name → pattern, name →
muscle and modality → muscle answer comes from the existing owner. That was
checked rather than assumed: a movement → main-pattern map already exists at
`strengthPatternContributions.ts:364`, and writing a second one is the
`one-predicate-grows-copies-in-other-modules` shape.

## 2. TWO MEASURED FINDINGS THAT CHANGED THE DESIGN

### (a) A strength session carries NO effort rating, and that is by construction

`SessionFeedback.difficulty` is written from exactly one source —
`difficulty: conditioningRpeValue` (`SessionFeedbackPanel.tsx:533`) — so a
strength-only session stores no rating at all. This is why Sam's ruling
approved extending the effort tap to strength.

**It does not ride this slice, and the reason is the ruling's own:**
`tonnage-modulated-by-effort` is a PROPOSED constant that defaults **OFF**, and
tonnage is a native measurement that needs no rating. With the constant off, the
tap would change no number the athlete can see. The order's own fallback applies
— it lands with the "felt different" slice. Named as owed, not silently dropped.

### (b) THE FALLBACK RUNG CANNOT ENTER RATIO SPACE — and refusing to make it is a ruling, not an omission

The 2/1/0 rung is keyed on a day's SHAPE. A shape is derived from the projection
plus `countWeeklyExposures`' hardness answer. **Past weeks are not projectable**
— slice 1 already recorded this ("those no longer exist to project",
`journalWeek.ts:286`). So a past week has no derivable day shape, and therefore
no derivable fallback weight to be the denominator of a fallback ratio.

The available shortcut is to re-derive hardness from `SessionFeedback.components[].kind`.
**That is refused.** Hardness has one owner by law, and a second one inside the
Journal is exactly the class this repo has paid for twice
(`intensity-never-feeds-identity`, phase skew) — `journalWeek.ts:13-19` is the
standing statement of it.

So the rung keeps the ruling's job — "the number never has a hole" — at the
place where it can honestly do it: **it describes the CURRENT week when nothing
was measured.** It is not a term inside a ratio. The consequence is reported
rather than papered over: a week whose sessions carry no logged detail has a
session-count load and NO comparison, and the surface says so.

**This is the slice's one open question for Sam** (boundary report carries it).

### (c) Coverage, not silence, is what makes a ratio honest

A well-logged week compared against thinly-logged history reads as a spike that
never happened. So every week in the model carries its **coverage** — measured
sessions over total sessions — and the comparison is REFUSED when coverage is
too thin, rather than returned as a confident number.

## 3. THE ARCHITECTURE — provenance travels with the number

The order requires the constants in ONE place, shipped PROPOSED, and that no
athlete-facing number be derived from an unsigned constant. Written as a rule
for the surface to obey, that is a promise. Written this way it is a mechanism:

- every constant is an entry in ONE table carrying `provenance: 'signed' | 'proposed'`
  and its source;
- every derived value carries the COMBINED provenance of every constant that fed
  it — signed only if all of them were;
- the surface renders a value only when its provenance is `signed`.

Two consequences worth the design:

1. **Sam's signature alone turns the lines on.** Flipping a constant's
   provenance to `signed` makes its line appear with no code change — which is
   also how the gate mutation-proves the mechanism in both directions.
2. **A new constant cannot leak.** Adding one without provenance fails the
   compiler; adding one marked proposed makes every value downstream of it
   proposed automatically, so nobody has to remember which lines to hide.

## 4. WHAT SHIPS ATHLETE-VISIBLE

The order: "the Load section stops saying 'coming next' wherever honesty
allows", and "the athlete-facing card line shows NO number derived from unsigned
constants".

Measured against the constants table, that means:

- the headline continuum, the sweet-spot band, the per-stream direction words
  and the region "biggest week in a month" line are all downstream of PROPOSED
  constants → **built, tested, and dark**;
- what is constant-free is what the section can honestly say now: **what load is
  being measured from, and how much of this week it actually has** — coverage is
  an ordering-free, threshold-free fact.

So the visible change is that the Load section stops promising a future feature
and starts stating its own evidence. Everything else is one signature away.

## 5. NOT COVERED BY THIS PLAN

- Charts (layer 5) — deferred to the monthly-review slice by the ruling's own
  placement rule.
- Region stress influencing program PLACEMENT — the ruling's named parked engine
  unit.
- Resurfacing old notes — still owed from slice 2.
- No device evidence; no cell in this repo mounts the Journal screen.
