# SEAT EYE-PASS: THE SHIPPED SCREENS vs THE SIGNED PROTOTYPE

**Sam, 2026-08-11, looking at the three screenshots: *"it didn't do the ui
properly from the looks of it?"*** He is right, and this is the measurement
rather than the impression.

**METHOD (so the next reader can repeat it):** the signed prototype
`docs/design/LFA_UI_PROTOTYPE_2026-08-10.html` was rendered headless at phone
width with its screen radios driven directly (`screenProgram`+`modeDay`,
`modeWeek`, `screenCoachChat`) and put beside the shipped simulator shots in
`artifacts/ui-walk/` (`dropdown-2-expanded.png` 09:30, `walk-2-week.png` 09:35,
`week-row-open.png` 10:22, `walk-4-coach.png` 09:35). **Both sides are pictures;
nothing here is read from code.** So every line below is a LOOK finding and any
"why" attached to it is OPEN-UNKNOWN until someone reads the component.

**THE GOVERNING RULE THIS IS MEASURED AGAINST** is `UI_MERGE_PLAN_2026-08-10.md`
line 11: **"HER STRUCTURE, HIS STYLE."** Colour, font and icon differences are
therefore NOT findings. Structure differences are.

## 1. THE WEEK LIST IS NOT HER STRUCTURE — THE BIGGEST ONE

| Her prototype | What shipped |
| --- | --- |
| Every day is a CARD: big date numeral, day above it, category chip (`CORE` / `OPTIONAL` / `ACCESSORY`), session title, `N exercises`, chevron | Non-today days are thin ROWS: small day + date on the left, title right-aligned, no chip, no exercise count (rows added a count only in the opened shot) |
| Today's card is the same card, outlined, with a `TODAY` pill under the date | Today is a different component entirely — a filled lime hero card carrying `Start Session` and `Want to change something?` |
| No session-start control anywhere in the week list | Start + change link live in the week list |

**Slice 5 is recorded as landed (`226531b2`). Against this comparison it did not
take her structure; it restyled the existing rows.** That is the sentence to
check against the diff first.

## 2. THE DAY SCREEN IS CLOSE BUT SHORT THREE THINGS

- **The modifier banner is missing.** Hers: `2 active modifiers / Currently
  impacting your program` sitting above the session card, tapping through.
  Shipped: nothing. **This is SLICE 4 and NOW.md already says it has not
  started — so this one is EXPECTED, not a defect.**
- **Exercise rows are not numbered and have no dividers.** Hers numbers each row
  (`1 Back Squat  3 × 2–4`) inside a ruled list; shipped is an unnumbered list.
- **The old phase card is still on both shapes** (`You're in In-season mode` +
  `Shift to Off-season mode`, visible in `week-row-open.png`). **Ruling 6 removes
  it. NOW.md is honest that this removal is deliberately held until the coach
  status screen's buttons stop being a NO-OP — so EXPECTED, not a defect**, and
  it is the visible face of slice 3b.

## 3. THE COACH TAB MATCHES ON SHAPE

Opener bubble, context line, one suggestion chip, composer at the bottom. **No
structural finding.**

## THE ONE QUESTION FOR SAM, ASKED ONCE

**Item 1 is the only one that needs him.** Items in section 2 are already
scheduled or deliberately held, and section 3 is clean.

> **The week list: do you want her card shape for every day — big date, chip,
> exercise count, tap to expand — with today just being that same card
> highlighted? Or do you want to keep today as the big lime card with Start
> Session on it, and only the other six days become her cards?**

Both are consistent with ruling 7. The first is her prototype exactly. The
second is what shipped, minus the thin rows.

**NOT COVERED:** no component was read; whether the week rows are a separate
component from the prototype's card or the same one styled down is unmeasured.
Nothing here was seen on Sam's phone — simulator shots only.
