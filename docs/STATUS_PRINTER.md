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

## The seam item 66 asked for

`renderWeekAsPlainEnglish({ projected, heading, intro?, noCopyIds?, equipmentTags? })`
is EXPORTED, and so is `projectWithGapsMarked`. Seat `sim` produces a projected
week out of lived-in accepted state and renders it through the same function, so
there is one renderer and one [NO COPY] count. Item 66's order required this
("reuse its printer, do not write a second one").

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
