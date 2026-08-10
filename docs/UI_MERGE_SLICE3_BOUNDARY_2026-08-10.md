# UI MERGE SLICE 3 — "MY STATUS" — BOUNDARY REPORT, 2026-08-10

**LOOP CHECK: guessing at a selector instead of reading the tree — sighting 3 —
COMPRESS.** Three attempts to tap a row by its visible text failed in a row
before `maestro hierarchy` was run at all. The compression is a rule written into
the flow itself and reusable by every flow after it: **every action row in this
app carries its explorer coordinate as its `accessibilityLabel`, and an
accessibility label REPLACES the visible text for a UI runner — so text selectors
can never match. Use ids.**

**The unit: the coach page grows "my status", so ruling 4's strip has a
destination.**

**STATUS: BUILT AND GREEN ON THE DEVICE, END TO END.**
`.maestro/golden/coach-my-status.yaml` — no strip on a clean week, the athlete
makes a modifier through the equipment door, the strip appears on the day screen,
the same component appears on the coach tab, it opens "my status" with the list,
and it closes back to the conversation. `artifacts/ui-walk/coach-my-status.png`.
**Not on Sam's phone.**

---

## NORTH STAR

**Toward, and the whole slice is one removal of a representation.**
`selectActiveCoachNotes` was already the single selector — what was missing was a
way to REACH it from anywhere but `useHomeScreen`, a 2000-line hook belonging to
one screen. `useActiveModifiers` is that reach. **No new stored state, no second
list, no second count**: the strip is handed `modifiers.length`, so the number and
the list it opens cannot disagree.

---

## WHAT WAS BUILT

| Artefact | What it is |
| --- | --- |
| `hooks/useActiveModifiers.ts` | The one derivation, reachable from any screen. Every input read from the store that owns it; the week passed IN, never re-derived. |
| `components/ModifiersStrip.tsx` | ONE component, THREE mounts — day, week, coach. The seat's words: *"same component as the day screen's, not a second one."* |
| `components/ActiveModifiersSection.tsx` | The coach-notes list, EXTRACTED from `HomeScreenV2` byte-for-byte. Every `testID` unchanged — a rename here is a silent rename of doors Sam has tapped. |
| `screens/coach/CoachStatusScreen.tsx` | "My status". Mounts the extracted list; owns its own close control. |
| `.maestro/golden/coach-my-status.yaml` | The only instrument that proves the doorway opens. |

**THE STRIP IS OUTSIDE THE CONVERSATION SCROLL, AND THAT IS THE ONE REAL DESIGN
DECISION.** `CoachTabScreen` pins to bottom on new content, so a status block
inside it is unreachable after three exchanges. **A door the athlete cannot find
is not a door.** One fixed row costs a strip and never scrolls away; the detail
lives on the screen it opens, which is her prototype's own shape.

---

## TWO DEFECTS THE DEVICE FOUND THAT NO CELL COULD

1. **The close control landed ON the status bar, over the battery.** It was an
   absolutely-positioned sibling in `CoachTabScreen` at `top: 14` — outside the
   safe area of the screen it closes. It now belongs to `CoachStatusScreen`,
   inside its own `SafeAreaView`, so it cannot drift again.
2. **The title rendered as a full-width "MY STATUS" that dwarfed the one card
   under it.** `h1` is the app's front-page size; a detail screen reached from a
   strip is not the front page. `h2`.

**Neither is visible to a source-reading cell.** Both came from looking at the
screenshot, which is the instrument Sam has been saying is the instrument.

---

## WHAT THE FLOW COST, AND WHY THAT IS WORTH RECORDING

Seven runs. **Every failure was true and none of them was the strip:**

- **Three on selectors.** Text can never match a row whose accessibility label is
  its explorer id. Now a rule in the flow's own header.
- **One on the container tap.** Tapping `home-life-fact-chips` "to bring it into
  view" hit whichever chip sat in the CENTRE and opened that sheet — the same
  shape that made the older golden flows tap past their own targets.
- **Two on the precondition.** The readiness door is FOUR steps, and **declining
  its lighter-day offer applies nothing at all**, so no modifier becomes active
  and the strip correctly rendered nothing. Even accepting, a fatigue fact alone
  produced no coach note in that world — the day screen's own section was empty
  beside the strip, which is the app agreeing with itself.
- **One on a rotten seed. `injury-case` CANNOT INSTALL** — *"Seed witness
  validation failed: injury-case:program:dev-e2e-injury-case:2026-07-13"*. **A
  world no flow can use.** This is the seed-rot family Sam warned about and it is
  a NEW named instance, not a known one.

---

## NOT COVERED

- **THE STATUS SCREEN'S ACTIONS ARE NOT WIRED. `onAction` is a no-op.** The
  buttons render — they are the extracted section's own — and they do nothing on
  this surface. **The file says so in as many words and a cell asserts that it
  says so**, because a surface whose buttons do nothing with nothing saying so is
  the dead-affordance law broken in a new place. Wiring them needs
  `handleCoachNoteAction` and its equipment-fact set lifted out of
  `useHomeScreen` into a shared owner — **that is slice 3b and it is the same
  extraction the season-phase control needs.**
- **NOTHING WAS REMOVED FROM THE DAY SCREEN.** The modifiers section and the
  phase-shift card both stay, and a cell asserts they stay. This is
  `LAW-removal-ships-with-its-replacement` HOLDING, not being worked around: the
  replacement cannot yet do their job. **So this slice closes ruling 4's
  DESTINATION, and closes neither ruling 4 nor ruling 6.** The seat's expectation
  that the coach view closes two rulings is not met by this pass, and that is
  said plainly rather than implied.
- **THE WEEK MOUNT IS UNPROVEN ON GLASS.** `surface="week"` renders from the same
  call site as `surface="day"` and no flow switches to the week shape with a
  modifier active. A cell proves one component; a flow proves one mount.
- **`injury-case` IS BROKEN AND NOT FIXED HERE.** Named above, untouched.
- **THE `useHomeScreen` COPY OF THE DERIVATION STILL EXISTS.** `useActiveModifiers`
  is used by the coach tab; `useHomeScreen` still calls `selectActiveCoachNotes`
  directly. **Two callers of one selector is fine; two assemblies of one snapshot
  is the thing to collapse**, and it is not collapsed yet.
- **`test:bible` WAS NOT RUN END TO END** — red on purpose, stops at the first
  failing suite. Eight suites run by name plus the flow.
- **THE WEEKLY VIEW (ruling 7) IS NOT STARTED.** It is the next slice.

---

# ADDENDUM — SLICE 5, THE WEEKLY VIEW (ruling 7), SAME PASS

**STATUS: THE STRUCTURAL HALF IS BUILT AND GREEN ON THE DEVICE.**
`.maestro/golden/standard-program-week.yaml` now asserts a row's count and opens
one in place. `artifacts/ui-walk/week-row-open.png`.

## THE CHANGE IS ONE DELETED CONDITION

`timeline={dayFirst && visibleDay ? …}` became `timeline={visibleDay ? …}`.
**That is the whole of the week's structural change**, and it is why the week
cannot come to disagree with the day card: it is the same `DayTimeline`, the same
`dayTimeline()` read, the same collapsible parts with their exercises and
prescriptions. A cell asserts there is exactly ONE `<DayTimeline` call site.

Sam's parked question — *"when you tap Thursday, does it open in place or take
you to a day screen?"* — **never needed to be asked.** Her signed prototype
expands in place, and the app already did; the rows simply had nothing worth
opening.

## THE COUNT

Each collapsed row carries the day's exercise total, summed from
`visibleDay.parts` — the same list the row opens onto, so the head and the
opened drop-downs are one fact. **It uses the sheet template the day card's
drop-downs already use**, so the two surfaces cannot phrase it differently, and
the singular form is the same one that earned its keep on the strip.

**ZERO RENDERS NOTHING.** A rest day already says Rest; a fixture says Game Day.
Confirmed on the device: SAT (Game Day) and SUN (Rest Day) carry no count line,
THU reads "3 exercises", FRI "6 exercises".

**REST AND GAME DAYS DO NOT EXPAND, AND NOTHING HAD TO SAY SO.** `DayTimeline`
returns null on zero entries. Her prototype's `noExpand` is a property this app
gets by construction rather than a flag it has to carry.

## NOT COVERED BY THE ADDENDUM

- **"Completed" IN PLACE OF THE COUNT ON PAST WEEKS IS NOT BUILT.** The seat's
  spec names it; this pass does the current week only.
- **THE TEAM-TRAINING BADGE ON THE WEEK ROW IS NOT ADDED.** The row already shows
  "Strength + Team Training" as its title, so the badge is duplication until
  someone rules otherwise — **not skipped, deferred with a reason.**
- **THE PREV/NEXT WEEK SETS ARE HELD**, as the seat instructed.
- **THE SELECTED ROW SHOWS NO COUNT LINE.** It renders the day CARD head — eyebrow,
  tier chip, wrapping title — and its counts live on the drop-downs inside it.
  The count line belongs to the six collapsed rows. A flow assertion on Monday
  failed for exactly this reason and the selector was the fix, not the feature.
- **NOTHING IS ON SAM'S PHONE.**
