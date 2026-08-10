# THE UI MERGE PLAN — Sam's nine rulings, turned into work

**Reads with `docs/UI_MERGE_RULINGS_2026-08-10.md` (his words, signed) and
`docs/UI_SAFETY_NET_BOUNDARY_2026-08-10.md` (the net that unblocks it).**

**THE PRECONDITION IS MET.** Sam's sequencing was *"DO NOT START CHANGING
SCREENS until a flow walks day → week → profile end to end."*
`.maestro/golden/day-week-profile.yaml` does, green, with a screenshot at each
surface. **Screens may now change.**

**THE GOVERNING RULE ABOVE EVERY LINE BELOW: HER STRUCTURE, HIS STYLE.** No
colour token, font or icon changes in any slice. If a slice's diff touches
`colors`, a font size, or an icon component, **it is out of scope and wrong.**
And *"without destroying what i have now"*: **every removal names where the
behaviour went, in the same commit that removes it.**

---

## THE ARCHITECTURE CHECK RULING 4 REQUIRED — DONE, AND IT IS NOT A TENSION

Ruling 4 moves season-phase changing and the modifiers (formerly coach notes)
onto the coach page under "my status". The order was to check that against the
coach architecture reassessment and L-C1/L-C2/L-C4 **before a line is written**,
and to escalate to Sam if the tension is real.

**IT IS NOT A LAW TENSION. It is a REUSE CONSTRAINT, and the constraint is
sharp enough to write down as a rule.**

- **L-C4, THE PARITY LAW** — *"the coach can do exactly what the athlete's own
  buttons can do, through the same doors"* — is about coach ability DERIVED from
  the athlete's action surface. Ruling 4 does not remove or weaken a single
  athlete button; it changes the ADDRESS of two of them. Parity is untouched, and
  in fact gets easier to hold: the doors sit on the tab whose parity is measured.
- **L-C2, THE CHANGE CARD** — *"no coach mutation without the card"* — governs
  changes the COACH proposes. "My status" is the ATHLETE tapping their own
  control. L-C2 does not reach it.
- **L-C1, THE BRAIN LAW**, governs the coach's mouth, not the tab's composition.

**BUT THE COACH TAB WOULD THEN CARRY TWO KINDS OF MUTATION ON ONE SCREEN**, and
that is the real hazard: a coach-proposed change (card required, L-C2) and an
athlete-direct change (no card, same as tapping the control on the day screen
today). **Blur them and one of two defects follows: athlete taps get wrapped in
change cards they never needed, or a coach change slips through without one
because "status changes don't need a card".**

**THE RULE, BINDING ON SLICE 3 AND 4 BELOW:**

> **"My status" MOUNTS THE EXISTING DOORS. It does not build new ones.** The
> season-phase control is the same `handleOpenPhaseShift` path the day screen
> calls today; the modifier controls are the same `handleCoachNoteAction` /
> `handleClearCoachNote` / `handleUpdateCoachNoteStatus` the day screen calls
> today. **A new door on this surface is a second representation of a decision
> that already has one — the exact defect every law in this repo exists to
> kill.** The change card stays what it has always been: the contract for a
> change the COACH proposed.

**Nothing here goes to Sam.** The check was owed, it was done, and it resolved.

---

## THE REMOVAL LEDGER — every removal names where the behaviour went

**Rulings 3, 6 and 7 all remove. This table is the "without destroying what I
have now" audit, and no removal ships without its row.**

| # | Removed | Where it is today | Where the behaviour goes |
| --- | --- | --- | --- |
| 3 | The day strip at the top of the day screen | `WeekStrip` (`HomeScreenV2.tsx:2077`), rendered only in the day shape, `onSelect={handleSelectDay}` | **Weekly view**, his words: *"if they need to view the other days they go to weekly view."* The `Today / Week` toggle stays and is the only way across. **The day screen becomes about TODAY, full stop** — `dayFirstIdx` collapses to `todayIdx`. |
| 6 | The phase-shift card on the day screen | `HomeScreenV2.tsx:1034-1050` — "You're in {phase} mode" + `Shift to {next} mode` | **Coach page, "my status"** (ruling 4). Same `handleOpenPhaseShift`. |
| 6 | The phase-shift card on the week screen | same block — it renders OUTSIDE the shape branch, so one deletion removes it from both | same |
| 7 | The buttons under weekly view | The life-fact chip row `home-life-fact-chips` (`HomeScreenV2.tsx:699`) | **Stays on the DAY screen; removed from the WEEK shape only.** This is his own reasoning applied: *a change for one day is made on that day.* |
| 4 | The coach-notes block on the day screen | `CoachNotesSection` (`HomeScreenV2.tsx:851`, rendered at `2246`) | **Two active modifiers at the top of the day screen**, tapping through to the coach page, where the full list and its controls live. |
| 5 | The "Today" badge | `HomeScreenV2.tsx:1778` | **Into the heading**: "Today's session - Mon 10/8". Nothing is lost; the same fact moves from a badge to words. |

**NOTHING IN THIS TABLE HAS NOWHERE TO LAND, so there is no sheet of orphans for
Sam from the removals.** The one open question is in its own section below.

---

## THE SLICES, IN ORDER, EACH WITH ITS GUARD

**Each slice is a commit, each ends green on
`.maestro/golden/day-week-profile.yaml`, and each takes a fresh screenshot set —
those are Sam's eyes now, by his own ruling on vision agents.**

### SLICE 1 — THE DAY SCREEN LOSES WHAT THE RULINGS TAKE (rulings 3, 6, 7)
Pure removal, no new surface, so it is the cheapest thing to get wrong-free
first. Remove `WeekStrip` from the day shape; remove the phase-shift card from
both shapes; hide the chip row in the week shape.

**GUARD:** the walk asserts `week-strip` today — that assertion **inverts to
`assertNotVisible` in the same commit**, which is the gate-must-watch-the-
deleted-surface law. `day-timeline`, `view-workout-button` and
`make-change-link` must all still be there.

**RISK, NAMED, AND COUNTED RATHER THAN ASSUMED:** `week-strip*` ids disappear
from the tree, and **SIX assertions across TWO flows name them** —
`day-week-profile.yaml` (3, at lines 44/85/120) and `standard-program-week.yaml`
(3: `week-strip`, `week-strip-mon`, `week-strip-sun`). **All six move or invert
in the same commit**, and `test:maestro-element-contract` reddens on any that
does not. The day shape then needs a NEW witness — `day-timeline` is the
candidate, since it exists in the day shape only.

### SLICE 2 — THE DAY CARD AND ITS HEADING (rulings 2, 5, 1)
Her day card shape: simpler, less highlight, optional drop-down overview.
**"Start Session" keeps its existing `onViewWorkout` — ruling 2 is a protection,
and the session screen is out of scope.** Heading becomes "Today's session - Mon
10/8". The chip row gains her framing line above it (ruling 1) with **every
existing chip door untouched**.

**GUARD:** `one-set-feedback.yaml` proves Start Session still reaches the
session screen and drives it to completion. **That flow is RED for an unrelated
stale id and must be fixed BEFORE this slice**, or the slice ships with its
guard blind.

**COPY:** "Today's session - Mon 10/8" is new athlete-facing copy →
copy register, `PROPOSED`, into Sam's next signing batch with "Today"/"Week" and
the five chip labels. **Not signed by this plan.**

### SLICE 3 — THE COACH PAGE GROWS "MY STATUS" (rulings 9, 4-second-half)
Her design for the status screen, his style. It shows the active modifiers and
is where they and the season phase are changed. **Mounts the existing doors per
the rule above — `handleOpenPhaseShift`, `handleCoachNoteAction` and friends
move to a shared owner both screens call, rather than being re-implemented.**

**GUARD:** the walk gains a coach-status assertion; a new tape proves a phase
shift made from the coach page lands on the same decision the day screen used to
write. **The keyboard matrix must still pass — ruling 8 protects the composer,
and disturbing it costs the one guard that already works.**

### SLICE 4 — THE DAY SCREEN'S TWO MODIFIERS (ruling 4, first half)
Two active modifiers at the top of the day screen, replacing the coach-notes
block, tapping through to the coach page.

**GUARD:** a tape that a day with two active modifiers shows exactly two and
navigates; a day with none shows nothing and costs no space (the current
`CoachNotesSection` already renders nothing when empty — that property must
survive).

### SLICE 5 — WEEKLY VIEW TAKES HER STRUCTURE (ruling 7)
Last, because it is the least behaviour and the most layout, and by then the
removals it depends on have landed.

**GUARD:** `standard-program-week.yaml` already asserts all seven rows in the
week shape and both shapes' witnesses.

---

## PROFILE IS IN SCOPE AND NO RULING TOUCHES IT

Sam's scope line says DAY, WEEK, PROFILE. **Nine rulings, none about profile.**
Stated rather than quietly dropped: **there is no profile work in this plan**,
and if he expected some, that is the one thing this plan cannot infer.

---

## THE ONE SHEET FOR SAM — ONE QUESTION, ASKED ONCE

**Only one thing in the nine cannot be settled by reading.**

> **Ruling 3 removes the day strip, and the day screen then only ever shows
> TODAY.** Today it can show any day you picked from the strip. Tapping a day in
> weekly view currently EXPANDS it in place, in the week list — it does not send
> you to a day screen for that day.
>
> **So: when you tap Thursday in weekly view, do you want it to open in place
> the way it does now, or take you to the day screen for Thursday?**
>
> Both are consistent with your ruling. "In place" is what the app does today
> and costs nothing; "take me there" is a new navigation path and a new back
> journey. **Everything else in the nine is decided.**

---

## WHAT STILL BLOCKS, AND IT IS NOT THIS PLAN

- **`one-set-feedback.yaml` is RED** on a stale id and it is slice 2's guard.
- **`fixture-move.yaml` is RED** on the dead `fixture-actions-open`.
- **The reload/durability flows are RED** behind the calendar persistence
  question (4 game days in memory, 1 on disk).
- **`component-deletion-reload.yaml` names a session-screen door the redesign
  removed** — the element-name gate's one declared orphan, and it needs a ruling
  rather than a patch.

**None of these blocks slice 1.** Slice 2 needs the first one fixed.
