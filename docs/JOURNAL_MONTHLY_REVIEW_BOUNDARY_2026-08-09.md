# THE MONTHLY REVIEW — boundary report (2026-08-09)

The last slice in the standing authorisation's list, plus the three items a
completion audit found still unbuilt after that list finished.

Commits: `a04f2cb6` (the review and its charts), `a440136c` (consistency),
`8e46b7d9` (the balance picture), `c8a349a6` (the month in flags).
Plan: docs/JOURNAL_MONTHLY_REVIEW_PLAN_2026-08-09.md.
Audit: docs/JOURNAL_COMPLETION_AUDIT_2026-08-09.md.

## ONE LINE

**The Journal's first drawn surface — two charts, a consistency figure that
carries its own denominator, the balance picture, and a month in flags that
counts what the athlete said and claims no direction from it.**

## NORTH STAR: TOWARD

Zero new stored state. The month is **a second TIME SCALE over derivations that
already exist**, never a second reading of the stores. `buildJournalMonth` takes
already-derived weekly records as input; a monthly module that regrouped
`sessionFeedback` would be a second answer to "what happened in week N", and the
two would drift the first time a rule about which sessions count changed.

## THERE WAS NO CHART WALL, AND IT WAS MEASURED

`react-native-svg` is a dependency **and genuinely wired** — `AppNavigator`,
`PlanChangeSheet` and `GuidedInjuryFlowSheet` render it today, so drawing works
on the build Sam already runs.

`victory-native` and `@shopify/react-native-skia` are also dependencies and are
**imported nowhere in `src/`**. A dependency nobody imports is unproven on the
device. Reaching for one to draw a line between six points would put a
rebuild risk between the athlete and a chart, and would bring axis/legend/theme
defaults that fight the design language every other surface here was hand-built
to. **Recommended against by default, with the reason recorded** — if a later
chart needs something genuinely hard, `victory-native` is adopted with an
argument rather than by reflex.

## SAM'S GUARDS ARE ENFORCED WHERE THEY CANNOT BE FORGOTTEN

- **"Never one floating dot"** lives in the DERIVATION. `journalMonth` returns
  null for a series with too few points, so the surface is never handed a
  one-dot chart — a guard in the component would be one refactor from being lost.
- **The threshold is BORROWED, not invented.** `MIN_POINTS_FOR_A_TREND` IS
  `journalWeek.TREND_MIN_WEEKS`, the data-state schedule's own answer to "when
  may the app claim a direction". A second threshold would let a chart appear
  while the words beside it still said "your Journal is building".
- **"No chart walls"** — at most two charts render, and one lift rather than
  five, chosen deterministically by history length.
- **"The weekly card stays words"** — a cell asserts every `<TrendChart` in the
  whole app sits inside the monthly section.

## THREE WAYS A CHART LIES BY GEOMETRY, EACH GATED

A chart's defects are not wrong numbers; they are wrong pictures drawn from right
numbers.

1. **An untrained week plotted at 0** draws a collapse that never happened.
   Absent weeks are excluded from the series.
2. **A flat series divided by a zero range** lands on the floor and reads as
   collapse — for an athlete who was perfectly consistent. It sits mid-height.
3. **SVG's y-axis grows downward**, so without a flip a heavier lift is drawn
   LOWER and the whole story inverts.

## THE THREE AUDIT ITEMS

**Consistency (`a440136c`).** A percentage without its denominator is a claim
without its evidence — "80%" over five sessions and over fifty are different
facts wearing one number — so the count travels with the rate and the line says
how many WEEKS it counted. **Today that is one week**, because `JournalWork`
derives from the projection and only this week is projectable; the line states
that rather than hiding it. A month with no plan yields NULL, never 0%; a week
with no plan is excluded, because a bye is not a week they missed. Partials count
as done, the same ruling `DidTheWorkHappen` already applies one screen up.

**The balance picture (`8e46b7d9`).** Load-ruling layer 4, and it ships where the
continuum cannot — structurally. `patternSharesDone` is derived from no constant,
so it carries SIGNED provenance and passes `signedValue`; the plan-vs-done
VERDICT is the half that waits on Sam's threshold. **What the athlete DID is a
measurement; whether it is out of balance is a judgement.** This is the
provenance mechanism paying for itself on a surface built four slices after it:
nothing here had to decide what was safe to show.

**The month in flags (`c8a349a6`), and a deliberate narrowing of the design.**
The base design calls this a "fatigue/soreness/illness trend". What the app can
honestly produce is **how many times the athlete said each thing** — turning three
soreness answers into "your soreness is rising" claims a DIRECTION from a COUNT,
which the load ruling forbids by name. A cell sweeps the module for direction
vocabulary and requires none of it. A month where nothing was answered shows
NOTHING rather than a row of zeroes.

## MUTATIONS

**Fourteen across the four commits, each VERIFIED APPLIED before its result was
read** — the strength line's lesson, now built into the runner as an assertion
that the replacement matched exactly once.

**Twelve red immediately. Two genuine survivors, both the same shape:** a filter
no fixture had exercised, because no fixture built the state that distinguishes
it. The no-plan week filter (no fixture mixed a planned week with an unplanned
one) and — in the niggle slice the same day — the region tie-break. Both got
discriminating cells; both red on revert.

**That is now the third time this shape has cost a survivor**, and it is worth
carrying as a rule: *a filter is only tested by a fixture that would fail without
it.* Asserting the happy path exercises the code, not the condition.

## THE GATE

- **Full `test:bible`, UNPIPED: `GATE_EXIT=1` at `test:program-control-durable`,
  1 FAIL line** — main's declared red, same assertion text.
- **Sweep at `a04f2cb6`: `failures=2 of 165` = the declared set EXACTLY**, and
  again at `c8a349a6` after the three audit commits: `failures=2 of 165`, the
  same set (`program-control-durable`, `fixture-identity`).
- `test:compile` PASSED throughout.
- New suite `test:journal-month` registered in `test:bible`: **48 passed, 0
  failed.**
- Copy batch 22 PROPOSED (a–h). Extraction ceiling **572 → 576**, attributed.

## NOT COVERED — and it matters more here than anywhere else in this unit

- **NO DEVICE EVIDENCE, and this is the first slice whose defects are mostly
  VISUAL.** Line weight, how 6–12 points read at 64px tall, whether the
  last-point dot is visible, whether two stacked charts feel like the wall Sam
  ruled against — all unverified. **Sam's eye is the instrument for this slice**,
  and the suite's own NOT-COVERED line says so rather than only this report.
- **Nothing renders an SVG in any test.** No cell mounts a component, so the
  geometry is argued from the scaling code rather than measured from a drawn
  frame.
- **The load continuum chart (ruling layer 5) is NOT built** — downstream of the
  unsigned band constants, so it would be dark anyway.
- **Illness is not in the flags line** — it lives in the readiness /
  temporary-fact stores rather than `JournalFelt`. Named as owed in batch 22-h.
- **Consistency counts ONE week today**, and says so.
- **DEPTH (L13): 0.**

## SAM'S QUESTIONS (parked, not waited on)

1. **"since {date}" is a week start, not a month name.** The design's example
   reads "since March"; the app knows the week the series begins, and converting
   one to the other is a presentation guess dressed as a fact. Either is
   supported by the data.
2. **Two charts, one lift** — is that the right amount, or still a wall?
3. Batch 22's words, including the flags sentence.
