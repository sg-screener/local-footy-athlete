# STATUS — `template`

**Seat opened 2026-08-27.** Sam is rebuilding the live screens toward the
prototype template he holds, **one piece at a time**, judging each piece on the
simulator himself. This file is the running record of those pieces.

## Working rule for this seat

Sam's instruction, 2026-08-27: *"don't fucking need you to take screenshots or
anything, just change it and i will decide if its good or not"* — and, when the
app stopped responding, *"you need to refresh the app yourself"*. So: **make the
change, reload the app, hand it back. No screenshot ceremony, no asking him to
verify what I could have verified.**

## Pieces

### 1. MY STATUS header pill — the glow is gone — WORKING

`src/components/ModifiersStrip.tsx`, `coachStrip`. The Program header doorway
carried `borderColor: rgba(200,255,0,0.42)` over `backgroundColor: '#11150D'` —
a lime edge on a green-tinted fill, which read as a glow above the day card.
Both values now match the `strip` style directly above them (`#1F1F1F` on
`#101010`). **No new token; no test bound either old value** (grepped `src/`,
`.maestro/`, `docs/` for both literals — zero hits outside the component).

### 2. Onboarding build screen, ready state — cards leave, tick centres — WORKING

`src/screens/onboarding/CompleteScreen.tsx`. Sam: the three education cards go
when the build finishes, and the tick + "Your program is ready / Time to get to
work" **slides down to sit centred on screen.**

- The cards belong to the WAIT: they now render only in `phase === 'generating'`
  and fade out on the same `loadingOpacity` as the spinner, so they leave with
  it rather than popping.
- The ready group drops in on `readyTranslateY` (`READY_SLIDE_FROM = -44` → 0,
  420ms) alongside the existing opacity fade.
- **Centring is measured, not assumed.** First attempt centred inside the
  ScrollView and landed low — Sam: *"needs to be centred more - maybe equal
  padding between top of screen and top of 'start your program' button"*. Two
  reasons it sat low: the scroll view starts BELOW the top safe-area inset, and
  the footer is `position: 'absolute'`, so the scroll view runs underneath it.
  The ready content now pays both back:
  `paddingBottom = insets.top + (measuredFooterHeight − FOOTER_TOP_PADDING)`,
  with the footer height read from its own `onLayout` and `FOOTER_TOP_PADDING`
  shared with the footer style so the two cannot drift.

**Proof:** Sam judged it on the simulator — *"yep thats good"*. Compile gate
(`npm run test:compile`) reports no error against either file; the gate's other
reds are pre-existing on this branch and belong to the test-truth seat.

### 3. Day screen spacing — WORKING (Sam: *"tighter"*, then accepted)

`topBar` 16/16 → 6/0, `dayFirst.marginTop` → 4, and the date row's own controls
40 → 32 (`hitSlop={8}` keeps the 48pt target). **The first pass halved only the
two margins, moved 16pt, and Sam read it as "you didn't refresh the app".** The
lesson is in R-258(c): most of the air around that date was INSIDE the row.

### 4. Day card row glyphs 13 → 26 — WORKING

`DAY_ROW_ICON_SIZE` / `DAY_ROW_CHECK_SIZE` in `HomeScreenV2`, one number for the
three rows that each carried their own literal, plus `timelineIconMarker` 18 →
32. **`RowIcon`'s `team` branch ignored its `size` prop and always drew 16** —
found because Team Training would not grow with the others; fixed.

### 5. A mobility day wore the battery — WORKING, seen on glass 08:35

A composed optional session has no part kind of its own, so a Mobility day
projects as `recovery` and asked `PART_ICON_KIND` for its glyph. The typed
`composedOptionalKind` was already being read — from a one-row `{ primer }`
table that existed **TWICE**, once in `rules/dayTimeline` and once in
`utils/sessionExecutionChecklist`, each commented as mirroring the other. ONE
total table now (`COMPOSED_OPTIONAL_ICON_KIND` in `rules/sectionIconKinds`), and
prehab — the identical defect one kind over — is fixed with it.

### 6. Bigger one-line title + the lime TODAY'S FOCUS eyebrow — WORKING

26pt, `numberOfLines={1}` + `adjustsFontSizeToFit` so a long name shrinks rather
than wraps or truncates. **Sam re-asked for an eyebrow he himself withdrew on
2026-08-22** — so the words are new ("TODAY'S FOCUS", not batch 32's "TODAY'S
SESSION", which stays withdrawn and asserted absent) and it branches on
`day.isToday`, because announcing today on a day the athlete walked to is the
exact defect that retired the last one.

**FOUR GUARD CELLS PINNED THE SUPERSEDED STATE AND WERE REWRITTEN IN THE SAME
TASK** (`dayFirstTimelineTests`): the ban on an eyebrow style, the 19pt title,
the 40pt nav proportions and the equal `spacing.md` topBar. Each rewrite states
Sam's words and keeps the INTENT the old cell was protecting — the nav cell now
pins the 48pt tap target rather than the number 40.

**Left red, and NOT this seat's:** `dayFirstTimelineTests` still fails two cells
whose regexes describe a source shape somebody refactored —
`mobilityFlow={...}` moved from a JSX prop into an object literal, and a comment
now sits between `setPreferredProgramView(option)` and
`handleClearWeekPresentation()`, pushing them outside the cell's 120-character
window. `copy-rulings-binding` fails one pre-existing cell on two batch-6
strings with no renderer.

## ⚠ THE APP REFUSED TO BOOT AT 08:27 AND IT IS NOT THIS SEAT'S WORK

**Symptom on glass:** *"The app did not start — dev_e2e_app_hydration_failed:
derived-world"*. Underneath it, from the device log:

```
[boot][hydration] the derived-world rebuild failed
  { error: [ReferenceError: Property 'scheduleWeek' doesn't exist] }
```

**`src/rules/canonicalWeeklyCompiler.ts` IS UNTRACKED** — a new file another
seat is mid-way through writing — and it is the only importer of `scheduleWeek`
besides the scheduler itself. `src/services/api/generateProgram.ts` imports it,
which puts a half-finished file on the BOOT PATH. `scheduleWeek` is exported
normally at `weeklyScheduler.ts:590`, so this is a module-resolution failure at
that new seam, not a missing export.

**The same binding is the reason `test:day-first-timeline` shows 19 failures:
16 of them are one error, `scheduleWeek is not defined`.** A seat measuring that
suite today is measuring somebody else's in-flight file, not its own work.

**The separate crash report Sam pasted is a red herring** — a native
`RCTHost _reloadWithShouldRestartSurfaces` segfault, i.e. React Native being
reloaded while mid-mount. It came from terminate/launch cycles landing on top of
a reload command. It is not a JS defect and not a defect in this seat's files.

**Not this seat's:** none of `sectionIconKinds`, `dayTimeline`,
`sessionExecutionChecklist`, `SectionIcon` or `HomeScreenV2` is in that module
graph, and none of them was touched by the icon or spacing work in a way the
generator reads.

### 7. The Profile tab rebuilt itself four times in one morning — WORKING

R-259 has the shape. The lesson worth carrying: **each pass was me building the
thing he described rather than the thing he wanted, and the gap was always a
STEP HE HAD TO TAKE FIRST.** Group edit → per-row pen → one pen + a menu page →
one pen + in-place rows → no pen at all, just the FAQ chevron. Every round he
removed a tap. **When he says "just" — *"just a fucking pop up"*, *"it's really
just cutting out the pen icon tap first"* — count the taps in what you built.**

### 8. Equipment: an untick is an answer — WORKING

Onboarding writes an entry ONLY for ticked kit, so an untick leaves NO entry and
is byte-identical to never having been asked. I merged the location preset
per-item over the saved answer and put back everything he had unticked. **A
saved answer is the whole answer.** The preset seeds only when there is no
answer at all. (R-260(b).)

### 9. The conditioning checkbox was never missing from the model

`ExecutionChecklistItem` already built a checkbox for every execution item and
handed it to `renderItem`; the two conditioning branches dropped the argument.
The section's `0/1`, Select all and the saved receipt were all counting a row
the athlete could not tick. **Look for the argument being dropped before
building the thing you think is absent.**

⚠ **AND `styles.controlsRow` IS COUNTED BY A LAW** — the strength card must have
exactly ONE. Reusing it for the conditioning tick reds `test:session-execution`.
`addonCheckboxSlot` is the shape for a tick with no stepper beside it.

## Notes for whoever holds this next

- **Four orphaned Maestro runs were driving this simulator** on 2026-08-27
  morning (two from 7:08PM the night before), which is why Sam's taps stopped
  landing. Killed all four. `ps aux | grep maestro.cli` before blaming the app.
- The branch in the shared checkout is `codex/failure-only-state-export` and
  another seat is live in it (test-truth files). **Commit with an explicit
  pathspec only.**
