# STATUS — seat `printer`

Owner of SEAT_INBOX item 65 (THE PAPER PHONE). Claimed 2026-08-13.

## What I am building

`scripts/print-week.ts` — runs the REAL generator offline and writes six
plain-English markdown files Sam can read on a phone. Read-only: no app file is
edited by this seat.

## The chain I am printing through, and why it is the app's own

The app's read path is `useSchedule.ts:projectWeekFor` —
`buildProgramTabProjectedWeek` then `project()`. The printer mirrors it exactly:

1. `generateProgramLocally` (`services/api/generateProgram.ts:961`) — the
   deterministic, no-network generator the app itself uses for every rebuild.
2. `buildProgramTabProjectedWeek` (`utils/visibleProgramReadModel.ts:149`).
3. `project()` (`rules/projectVisibleWeek.ts:663`) — THE ONE CANONICAL
   PROJECTION. Every athlete-visible word it returns is `SignedCopy`.

**Nothing is composed by the printer.** Words come out of `project()` or they do
not exist, and where they do not, `signedCopy` throws `UnsignedCopyError` and the
printer writes `[NO COPY — the app has no words here]` and counts it. That is the
SignedCopy law doing exactly its job, and the count is the deliverable.

## ⚠ WHERE THIS WORK ACTUALLY LANDED, AND TWO COLLISIONS

**THE COMMIT IS `a7114ed8`, WHOSE MESSAGE IS ABOUT THE LAW REGISTRY.** I staged
`scripts/print-week.ts`, `docs/printed-weeks/`, this file and the `print:week`
script by pathspec; before my own `git commit -- <paths>` ran, another seat's
bare commit swept my index into theirs. **The history therefore says the paper
phone was part of "ITEM 13 PERFORMED".** Nothing was lost and nothing of theirs
was taken — but sighting 6 of the shared-index hazard, and the first one I have
seen run in THIS direction: the rule protects the other seat from me, and it did
not protect me from them. Recorded here so the next reader can find the work.

**AND I OVERWROTE ANOTHER SEAT'S SCRIPT AT THE SAME PATH.** An unregistered seat
had already written a `scripts/print-week.ts` and its output to
`docs/paper-phone/` at 22:13 (six files + README, untracked, claimed by no
`STATUS_*.md`, and `sim` had checked at F2 and found nothing). I wrote the same
path at ~22:21. **Their script is unrecoverable — it was untracked, so git never
had a copy.** Their OUTPUT survives untouched in `docs/paper-phone/` and I have
not deleted or edited it. Two directories now answer item 65; that is Sam's call
to collapse, not mine.

**WHAT THE TWO OUTPUTS DIFFER ON, since somebody will have to choose.**
`docs/paper-phone/` prints the raw microcycle workouts — so it has no dates, no
day names (22 `[NO COPY]`, all of them the day name), no game day, no rest days,
and 3 sessions on the bodyweight week. It does carry the conditioning session's
work/rest/intensity text, which mine loses. `docs/printed-weeks/` goes through
the app's real read path, so it has real days, the fixture, rest days and team
training — and it is the one that caught the seven impossible exercises, which
`docs/paper-phone/` lists unflagged while reporting "0 an athlete would not say".

## The seam item 66 asked for

`renderWeekAsPlainEnglish({ projected, heading, intro?, noCopyIds?, equipmentTags? })`
is EXPORTED, and so is `projectWithGapsMarked`. Seat `sim` produces a projected
week out of lived-in accepted state and renders it through the same function, so
there is one renderer and one [NO COPY] count. Item 66's order required this
("reuse its printer, do not write a second one").

## THE SEAM WAS HALF-BUILT TWICE, AND SEAT `sim` CAUGHT BOTH

Recorded against myself, because I reported the seam as delivered twice and it
was not, and both defects have the same shape: **the export compiled, so nothing
told me the other half was missing.**

1. **`601339fc` — `projectWithGapsMarked` had no `export`.** I told `sim` to
   import it. Only `renderWeekAsPlainEnglish` was exported, so what I handed over
   was a renderer whose gap loop was private — and hand-copying the loop is the
   duplicate count both items exist to prevent.
2. **`d9c91fdb` — the file ended in a bare `main()`.** Importing it generated six
   weeks and rewrote `docs/printed-weeks/`. `sim` tried the import, saw it
   republish this seat's output, and backed out. **A module that does its work on
   import is not a seam, it is a script wearing one.** Guarded with
   `require.main === module`, and BOTH arms measured rather than assumed: the run
   still writes six files / 0 [NO COPY] / 18 findings, and a bare require prints
   nothing and exposes exactly the two exports.

## ITEM 66's MEASUREMENT CHANGES HOW THESE SIX WEEKS SHOULD BE READ

`sim`, five profiles × five weeks, driven through the real completion path
(`308da432`): **week 5 is BYTE-IDENTICAL across all five** — does-everything,
misses-every-Friday, away-week-3, sore-week-2, and one that logged 67 loads
across 23 days through `useWorkoutLogStore.logSet` + `setWeightOverride`. The
logging arm is the anti-no-op control: it landed, and it changed nothing. Week 5
is regenerated at block rollover, so nothing the athlete did across four weeks
reaches it.

**MY SIX WEEKS CANNOT SEE THIS AND THAT IS THEIR HONEST LIMIT.** Every week I
print is a FRESH generation with no history at all, so none of my output passes
through progression, feedback or load-logging. The paper phone answers *"is this
week any good?"*; it cannot answer *"does the app respond to the athlete?"*.
Item 66 is the instrument for the second question and the two are complementary,
not overlapping.

**AND THE TRAFFIC RAN BOTH WAYS.** `sim` was about to report an athlete-visible
0kg on a week-5 Back Squat; my in-season page shows the plain-English surface
prints no weights at all ("Back Squat — 3 × 2-4"), so that number sits below the
glass and the report was corrected before it was written. Independently, their
structural dump reads the same Monday row I flag as `Short Flush — 1 × 1` as
`1 sets × 1` — **two different readers, two different paths, same defect, so it
is in generation and in neither renderer.**

## TWO HARNESS BUGS, CAUGHT BEFORE THEY WERE REPORTED AS APP DEFECTS

**Both would have been filed against the app. Both were mine.** Recording them
because the shape repeats: **an under-fed `ScheduleState` does not fail, it
answers "no".**

1. **The missing game.** First run passed only `currentProgram` +
   `currentMicrocycle`. An in-season athlete whose answer was "Saturday" printed
   an EMPTY Saturday. The recurring fixture is derived by
   `effectiveGameDatesAround` from `state.gameDay` / `usualGameDay` /
   `seasonPhase` — none of which I had set. Fixed by assembling the state the way
   `useScheduleState` does, from the app's own owners.
2. **The bye that still showed a Game Day.** Passing `targetFixtureDay: null` to
   generation is only half a bye. The projection re-derives the virtual fixture
   unless the day carries `markedDays[date] === 'noGame'` (or `'rest'`)
   — `sessionResolver.ts:707`. Generation planned a bye; the screen drew a game.
   Fixed by setting the mark, so both halves agree.

## FINDINGS — 18 across six weeks, 0 [NO COPY]

**The [NO COPY] count is ZERO.** Every athlete-facing word on all six pages
resolved through the signed-copy sheet. That is a real result and it is better
than expected: the sheet covers every headline, bucket, exercise name, cue and
prescription template a generated week reaches.

**1. SEVEN IMPOSSIBLE EXERCISES FOR A BODYWEIGHT-ONLY ATHLETE — the ugliest
thing here.** Profile answers `equipmentAnswer: { tags: {}, modalities: {} }`,
which `resolveEquipmentCapabilities` resolves to exactly `['bodyweight']`,
`source: 'athlete_answer'`, `completeness: 'complete'`. The app then prescribes
Pull-Ups, Barbell Row, Face Pull, Overhead Press, Lateral Raise, Band Pallof
Press and RDLs. **The app's OWN `exerciseIsAvailableWith` says NO to all seven.**
The mechanism is in the generation log, not inferred:
`[pool-override-fallback] slot=vertical_pull filtered=0 → using raw pool
(excluded=0, injury=0, equipment=2)` — when the equipment filter empties a slot,
the code falls back to the UNFILTERED pool and ships the exercise anyway.

**2. THE PROJECTION BREAKS THE PRESCRIPTION-DISPLAY LAW; THE DAY SCREEN KEEPS
IT.** `project()` emits `row.prescription.sets_reps_range` — `3 × 2-4`.
`DayWorkoutScreenV2:2213` renders `formatStrengthSetsReps`, which routes through
`displayReps` and shows `3 × 3`. Sam's law (`rules/prescriptionDisplay.ts`,
Bible `:4936`): *"the athlete sees a single middle number"*. **~15-21 rows per
week, every week.** Two surfaces, two numbers, on the one field the ONE
PROJECTION exists to make unwritable.

**3. `1 × 1` AS A CONDITIONING PRESCRIPTION — 8 sightings.** "Short Flush —
1 × 1", "Warm-up — 1 × 1", "Continuous Aerobic Run — 1 × 1", "Bodyweight
Conditioning Circuit — 1 × 1". `formatConditioningRowPrescription` suppresses
this deliberately for rep-based conditioning rows (*"showing '1 reps' would be
confusing filler"*); `prescriptionCopy` in the projection prints it. Same class
as finding 2 — the projection and the screen disagree.

**4. NAMED BLOCKS WITH NOTHING IN THEM.** A "Power" part appears on the deep
pre-season Tuesday and the bye Monday carrying no rows. Team Training and Game
Day legitimately carry none (the club runs them); Power does not.

**5. THE BYE LEAVES A HOLE.** With the game off, Friday, Saturday AND Sunday are
all Rest. The athlete's free Saturday gets nothing. Also: Monday's "Lower Body
Strength" and Wednesday's "Lower Squat" are nearly the same session two days
apart (Back Squat, Deadlift, Walking Lunges, Single-Leg RDL on both).

**6. AWAY WORKS, AND COSTS TWO DAYS.** The club night and the fixture DO come
off — measured, not assumed, by diffing file 5 against file 3. But the away
week's Wednesday and Saturday each hold nothing but "Warm-up — 1 × 1".
⚠ The away week is a fresh generation with `awaySpans` as an input, not file 3
with days removed, so this is a statement about what the away week CONTAINS —
not a claim that a specific session was deleted.

**7. DEEP PRE-SEASON'S CONDITIONING IS ONE LINE.** Six weeks in, three club
nights, and the app's own conditioning for the week is a single "Continuous
Aerobic Run — 1 × 1" on Tuesday.
