# Horse Stance Hold — desktop seat

## Scope

Add Sam's 2026-08-31 Horse Stance Hold intake through the existing authored
exercise catalogue. This seat owns only the Horse Stance files named in its
checkpoint; concurrent programming and release-remediation files remain owned
by their existing seats.

## Implemented

- One canonical Mobility catalogue entry, with no duplicate prehab catalogue.
- Exact supplied video destination and both supplied cues.
- Bilateral timed prescription: 2 sets of 60 seconds, not per side.
- Bodyweight availability with optional logged dumbbell load; depth, stance
  width and duration remain the authored progression before load.
- Everyone eligibility, including the higher/narrower beginner regression.
- Automatic lower-body warm-up, Mobility and Recovery routes.
- Manual Add and Swap through the existing Mobility & stretching chooser.
- Explicit exclusion from Primer and every G-1 route.
- All thirteen submitted injury ratings and the submitted painful-movement
  restrictions are preserved in the intake record.
- Canonical exercise master workbook extended by one styled row.

## Verification measured on 2026-08-31

- `exerciseIntakeTests.ts`: 634 assertions passed, 0 failed, covering 11
  distinct submitted exercises. Horse Stance is reached automatically through
  lower-body warm-up, Mobility and Recovery under suitable conditions. The
  same-seed G-1 checks remove it from all three routes.
- The same intake suite drives real onboarding, accepted Add/Swap, completion
  logging, weight override persistence and relaunch persistence. Mutation arms
  proved the Horse Stance cue, video, timed unit and G-1 checks turn red when
  their subjects are broken.
- Equipment vocabulary: 101 passed, 0 failed.
- Primer session: 27 passed, 0 failed; Horse Stance is not Primer eligible.
- Muscle/experience equality: 93 passed, 0 failed.
- Authored cues: 55 passed, 0 failed.
- Workbook formula scan: 0 formula-error matches; rendered tail row inspected.
- `git diff --check`: passed.

## Integrated gate finding

`npm run test:release` stopped in the test-truth bootstrap before any of its 27
product units ran. The current shared generator could not build the existing
`exercise-removal-restart` seed because week 1 contained no Back Squat. The
files producing that state (`defaultProgram.ts` and related compiler work) are
concurrently modified outside this seat and were not changed or rolled back.

The broader `test:exercise-intake` chain reached its power/Primer delivery
unit after all Horse Stance checks passed, then found the same concurrent
programming state changed the deload power exercise from Vertical Jump to Broad
Jumps. That failure is recorded rather than hidden or repaired from this seat.

## Verification strategy for the next defect

Keep the route matrix in `exerciseIntakeTests.ts`: automatic/manual route ×
experience × equipment × injury × G-1/G-2, plus real Add/Swap and persisted
completion. New exercises in this intake must enter the same matrix and its
mutation arms rather than receiving a catalogue-only assertion.

## NOT COVERED

- Physical iPhone rendering, tapping or YouTube playback; no phone was installed
  or wiped.
- A fully green integrated release gate while the shared generator work above
  remains incomplete.
- External dumbbell prescription automation; the authorised movement is
  bodyweight and only athlete-entered optional load is preserved.
