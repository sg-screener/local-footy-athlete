# UI MERGE SLICE 3 — "MY STATUS" ON THE COACH PAGE (rulings 4 and 9)

**LOOP CHECK: a question put to Sam that the repo had already answered —
sighting 2 — ITERATE.** The first was the week-view expand question, answered by
reading her signed prototype. This is the second, and the practice paid again:
the seat flagged the coach-architecture question *"twice, and it has never been
answered"*. **It was answered — in `docs/UI_MERGE_PLAN_2026-08-10.md`, before a
line was written — and the half that genuinely was open is settled below by
reading her prototype rather than by spending one of his decisions.**

**COACH FIRST, BECAUSE IT CLOSES TWO HELD RULINGS.** Ruling 4's modifiers strip
on the day screen has no destination; ruling 6's season-phase box is still on the
day screen only because its new home does not exist, and
`LAW-removal-ships-with-its-replacement` says the removal is legal the same pass
the home lands. **The weekly view closes one ruling; this closes two.**

---

## THE ARCHITECTURE CHECK — DONE TWICE, AND NEITHER HALF GOES TO SAM

### THE LAW HALF WAS ALREADY SETTLED, AND THE RULING IS BINDING HERE

`docs/UI_MERGE_PLAN_2026-08-10.md` answered it before slice 1:

> **"My status" MOUNTS THE EXISTING DOORS. It does not build new ones.** The
> season-phase control is the same `handleOpenPhaseShift` path the day screen
> calls today; the modifier controls are the same `handleCoachNoteAction` /
> `handleClearCoachNote` / `handleUpdateCoachNoteStatus`.

L-C4 (parity) is untouched — ruling 4 changes the ADDRESS of two athlete
controls, not the controls. L-C2 (no coach mutation without the change card)
does not reach an athlete tapping their own control. **The hazard named there is
still the one to hold: two kinds of mutation on one screen must not blur.**

### THE LAYOUT HALF IS REAL, AND HER PROTOTYPE ANSWERS IT

**Measured from the code, not assumed.** `CoachTabScreen` is a header, a
`ScrollView` that **pins to the bottom on new content**, and a composer pinned as
a keyboard-safe footer.

- **A status block INSIDE that ScrollView scrolls away**, and the pin-to-bottom
  guarantees it: after three exchanges "my status" is unreachable without
  scrolling up past the conversation. **A door the athlete cannot find is not a
  door.**
- **A full status panel OUTSIDE it costs permanent vertical space** on the one
  surface where the keyboard already competes — and ruling 8 protects the
  composer, which is the guard that already works.

**HER PROTOTYPE RESOLVES IT AND IT IS THE SAME SHAPE AS THE DAY SCREEN'S:** the
modifiers strip is a **compact row that taps THROUGH to a status screen**. The
strip is a doorway, not the content. So:

> **A COMPACT `my status` ROW SITS UNDER THE "Coach" HEADER, OUTSIDE THE
> CONVERSATION SCROLL, AND OPENS A STATUS SCREEN.** It is one row, it never
> scrolls away, and the detail — the full modifier list, their controls, and the
> season-phase control — lives on the screen it opens.

**NOTHING HERE GOES TO SAM.** The check was owed, it was done twice, and both
halves resolved by reading.

---

## THE WORK, IN ORDER

1. **The strip component, ONE of them, used by three surfaces.** The day screen
   (ruling 4, slice 4), the week view (the seat's note: *"same component as the
   day screen's, not a second one"*) and the coach header. **Two implementations
   of one row is the defect every law here exists to kill.**
2. **The status screen.** Active modifiers with their existing controls, and the
   season-phase control — **all mounting the existing handlers**, which today
   live in `useHomeScreen`. Those move to a shared owner both screens call; they
   are not re-implemented.
3. **The removal, SAME PASS:** the phase-shift card leaves the day and week
   screens. Its ledger row already names this destination.
4. **Copy:** the strip's two lines ("2 active modifiers" / "Currently impacting
   your program") and every word on the status screen are NEW and PROPOSED —
   batch 34, joining batch 33's four unsigned strings in one signing.

## THE GUARDS THIS SLICE OWES

- The walk gains a coach-status assertion.
- A tape proving a phase shift made from the status screen lands on the **same
  decision** the day screen used to write — the ownership boundary, not the pixel.
- **The keyboard matrix must still pass.** Ruling 8 protects the composer and
  disturbing it costs the one guard that already works.
- A cell that the strip is ONE component, not two.

## NOT COVERED BY THIS PLAN

- **The weekly view (ruling 7)** is the slice after, and it is mostly
  subtraction; the prev/next week sets are held.
- **What "in more detail" means on the status screen** is her design read at the
  structure level. If Sam's eye wants more or less there, that is an eye-pass
  correction, not a plan defect.
- **No estimate of whether the status screen needs its own scroll** — that is a
  build-time finding, not a plan-time one.
