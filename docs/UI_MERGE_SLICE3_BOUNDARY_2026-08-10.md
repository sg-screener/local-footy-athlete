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

---

# ADDENDUM 2 — THE NOT-YET CONTROLS, AND THE INJURY SEED DIAGNOSED

## ORDER 1's HEDGE IS TAKEN, AND THE KNOT IS PRICED RATHER THAN FORCED

**The seat's own instruction: *"if the untangling runs long, make the dead
buttons visibly not-yet rather than leaving them looking ready."*** It runs long.

**THE PRICE, MEASURED BY READING IT.** `handleClearCoachNote` alone closes over
`handleProgramControlResult`, `clearCoachNoteAction`,
`registerSourceFactRenderObservation`, `temporarySourceFacts`, the pending
restoration/observation setters and two `Alert` paths; `handleCoachNoteAction` and
`handleUpdateCoachNoteStatus` sit on top of it, and the phase-shift machine is
fifteen more pieces of state driving a multi-step sheet. **This is a genuine
ownership extraction, not a move**, and the Coach Architecture Escalation Rule
says price it before forcing it.

**SO THE CONTROLS SAY WHAT THEY ARE.** On the status screen every action renders
**dimmed, `disabled`, and captioned** — *"Change this on your program screen for
now."* All three, because any one alone fails: dimming alone reads as "broken",
a caption alone leaves a live-looking button that lies, and disabling alone is
silent. **Proven on the device**, not just in source: the flow asserts
`coach-note-actions-not-yet`.

**The day screen still mounts the list LIVE and a cell asserts it does** — its
controls are the working ones and nothing has replaced them.

## ORDER 2 — `injury-case` IS DIAGNOSED, NOT FIXED

**MEASURED with `scripts/probe-injury-seed.ts`, which is committed so the next
pass does not re-derive it:**

```
=== injury-case ===
program.id       : dev-e2e-injury-case      <- matches
witness programId: dev-e2e-injury-case
microcycle starts: 2026-07-13               <- matches
witness weekStart: 2026-07-13
```

**THE SEED BUILDS CORRECTLY. The witness that fails on the device
(`injury-case:program:dev-e2e-injury-case:2026-07-13`) cannot be failing at
BUILD time — so it fails at INSTALL time, after the auxiliary state is applied.**
The auxiliary state for this seed is a severity-5 canonical injury episode, and
applying an injury of that severity **rebuilds the program** — which replaces the
program the `program` witness was captured against.

**THE LEAD, NOT YET PROVEN:** the program witness is about the seed's program
INSTALL, and it is being validated after a subsequent mutation has legitimately
replaced that program. If that is right the fix is ordering — validate the base
witness before auxiliary state is applied — **not loosening the witness**, which
would blind it to the rot it exists to catch.

**NOT FIXED. NOT RETIRED. The order asked "fix or retire it, and say which" and
the honest answer is "neither yet, and here is exactly where to look."**

## NOT COVERED — ORDERS 3 TO 7 ARE NOT STARTED

Said plainly rather than left to be inferred:

- **ORDER 3, THE 21 SUITES** on the impossible athlete — not run against a legal
  profile.
- **ORDER 4, THE DRIFT CHECK** — not built.
- **ORDER 5, THE SEEDED WORLD'S DURABILITY** — not priced this pass.
- **ORDER 6, THE UNENFORCED COUNT** — 35 of 74; three rows were ADDED guarded
  today (`LAW-hot-file-budget`, `LAW-diagnostic-refuses-never-crashes`,
  `LAW-removal-ships-with-its-replacement`, plus `LAW-no-silent-blank-screen`),
  so the count fell, but `LAW-instrumentation-alive` is untouched.
- **ORDER 7, THE LAYOUT-BLINDNESS FINDING** — the registry row is NOT written.
  **The finding itself is recorded above** (two real defects, neither visible to
  any assertion) and the answer it points at is: **if only an eye can catch that
  class, the screenshots are load-bearing and every flow must photograph every
  state it touches.** That is a rule worth having and it is not yet a row.

**THE STOPPING REASON IS CONTEXT, NOT JUDGEMENT.** Each remaining order is a real
unit and none is blocked on Sam.
