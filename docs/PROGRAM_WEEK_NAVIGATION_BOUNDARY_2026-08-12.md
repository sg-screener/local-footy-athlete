LOOP CHECK: navigation reinterprets a presentation choice — sighting 1 — iterate

# PROGRAM WEEK NAVIGATION BOUNDARY — 2026-08-12

## What Sam ordered

The Day/Week toggle must remain available after changing weeks. Previous and
Next may only reach weeks containing the athlete's actual saved program: no week
before its start and no week after its end. The solution must not assume a
two-, three-, four- or six-week block.

## Reachability proved before editing

The Program tab mounts `HomeScreen` through `AppNavigator`. That wrapper has its
version fixed to V2 and returns `HomeScreenV2`; the classic branch is currently
unreachable. The edited toggle and week arrows are therefore on the athlete's
live Program screen. No control was removed: both boundary arrows remain visible
and become disabled only where no adjacent program week exists.

## Options compared before implementation

1. Keep navigation unbounded and hide the toggle only on outlying weeks.
2. Let the saved program dates own one minimum and maximum week, clamp every
   navigation entry point there, and keep the selected Day/Week shape independent
   of the current week.

Option 2 landed. Option 1 would preserve the bug's cause and allow callers other
than the two arrows to select an invented week. The chosen boundary is derived
from the program's real start and end dates and is shared by Previous, Next,
This week and direct date jumps.

## First-run finding

The new guard was run before implementation. Forty-one existing cells passed and
the two new cells failed: the Day view was still conditional on being in this
week, and no program-date bound existed. Those are the two defects Sam described.

## What changed

- Day/Week stays mounted on every normal program week and retains the athlete's
  selected shape.
- Day retains one weekday while browsing allowed program weeks; switching from
  an expanded Week row to Day explicitly chooses that row's weekday.
- The earliest and latest selectable weeks are the Monday-Sunday weeks containing
  the saved program start and end dates.
- Previous and Next are visibly disabled at those edges. All navigation entry
  points clamp to the same range, including This week and direct date jumps.
- A new registry row binds this behavior to the existing in-chain Program-screen
  guard.

## Receipts

- Program-screen guard: 43 named cells run, 43 passed. The new cells execute a
  one-day program, an uneven span crossing six calendar weeks, both rejected
  edges, an accepted interior week and the no-program case. They also prove the
  live wrapper, hook owner and disabled-arrow wiring are present.
- Typecheck baseline gate: passed with 35 product, 51 development-tool and 373
  test diagnostics — 459 total against the recorded baseline, zero new
  diagnostics.

## What catches the next defect of this class

The behavior cell fails if week position hides the toggle or changes the chosen
shape. The range cell executes date-derived bounds and also anchors the live
hook and both visible arrows, so a correct helper left unwired does not count as
a pass. It checks that each source region was actually found before asserting
inside it.

## North Star

Toward it. Program dates are already the accepted source of truth for whether a
date belongs to the program. Navigation now derives from those dates instead of
storing or guessing a second block length.

## NOT COVERED

- Sam's physical iPhone. Athlete-facing acceptance remains open until he checks
  the toggle across the first and final program weeks.
- A simulator tap tape. Reachability was proved through the mounted navigation
  path and guarded source regions, not by driving the rendered controls.
- Programs whose saved start or end date is corrupt. They fail closed to the
  current week; migration or repair of corrupt stored dates is outside this unit.
- The protected season phase sheet, `GameDayScreen` and `PlanChangeSheet`; none
  was read for implementation or changed.
