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

---

## RESOLVED AND BUILT — 2026-08-11

**Sam answered:** *"Use her card design for all 7 days."* Today is the same week
card as the other six — date column, category chip, title, exercise count and
chevron — with the existing lime treatment and a TODAY pill. Opening a card
reveals its component details underneath without changing the card head. The
week list carries no Start Session or change controls; those live on the day
screen.

**THE TWO OPTIONS COMPARED BEFORE CODING:** (1) keep the selected/unselected
branches and restyle both to look alike, or (2) give the week screen one named
card-head owner independent of selection. Option 2 landed. It removes the branch
that turned today into a different component instead of asking two branches to
remain visually equal forever.

**RECEIPTS:**

- `test:day-first-timeline`: 30 named cells run, 30 passed. The two new cells
  guard the single card-head owner and the week/day control boundary.
- `.maestro/golden/standard-program-week.yaml`: completed on the booted iOS
  simulator through the Metro-aware runner. It reached all seven day rows,
  proved today's uniform card head and count, opened Wednesday in place, proved
  the head remained, and proved the day-screen controls were absent.
- `artifacts/ui-walk/week-row-open.png`: looked at after the run. Its first run
  exposed TODAY wrapping inside a narrow date column; the column was widened and
  the complete flow was rerun before this receipt was written.
- `test:compile`: passed its baseline-regression gate.

**WHAT CATCHES THE NEXT DEFECT OF THIS CLASS:** the source cell fails if a
selected/today branch can choose another week-card head; the simulator tape
executes both coordinates that caused the miss — today/selected and another day
opened — and checks the day-only controls did not follow them into the week.

**NORTH STAR:** toward it. No state or second program read was added. Every card
head and every opened detail still reads the same visible-day projection; only
the screen structure changed.

**NOT COVERED:** Sam's physical iPhone; the already-open active-modifier strip;
the already-held season-phase removal; the prior/next-week "Completed" treatment;
the separately deferred team-training badge. The last two are not claimed fixed
by this current-week screen tape, so this is gates-green simulator evidence, not
Sam device acceptance.

---

## SAM EYE PASS 2 — THE STRUCTURE WAS RIGHT AND THE PROPORTIONS WERE NOT

**Sam, with the reference and the build side by side:** *"still doesn't quite
look the same. The badges are far too big on mine, the numbers look too small
compared to here - there's no active modifiers at the top".* All three were
correct. The first checkpoint took the card's parts but did not yet take their
visual hierarchy, and its zero-modifier tape could not show the modifier line at
all.

**MEASURED CAUSES:**

- The date reused the day-card title style: 18pt. The signed prototype's week
  date is 27pt. The number was structurally present and visually wrong.
- The category and Today badges set small font sizes but inherited the shared
  Text component's 24pt body line-height. Padding was not the main inflation;
  the hidden line box was. The week card also invented a separate GAME badge
  which the prototype does not carry.
- `ModifiersStrip` correctly renders nothing when the active list is empty, but
  the visual tape created no modifier before taking its screenshot. Worse, if it
  had appeared, the week surface would have used the larger two-line day/coach
  card rather than the prototype's compact lime line. The zero world hid both
  the feature and the wrong treatment.

**THE TWO OPTIONS COMPARED:** (1) override padding and type locally in the week
card while leaving the shared badge's line box wrong, or (2) make each badge size
own its font AND line-height, then select the compact size at the week-card
boundary. Option 2 landed. It fixes the size abstraction instead of compensating
for it with card margins. The one shared modifier component now has a week
presentation selected by its existing `surface` input; no second count or second
list was introduced.

**RECEIPTS:**

- `test:day-first-timeline`: 32 named cells run, 32 passed. The new cells pin the
  27pt date, compact badges including their line-height, absence of the invented
  GAME badge, the compact week modifier treatment, and a tape that reaches the
  modifier by acting.
- `test:signed-copy-extraction`, `test:copy-rulings-binding`,
  `test:coach-tab-slice3`, `test:maestro-element-contract` and `test:compile`:
  green. The exact one-line week wording is registered rather than assembled on
  the surface; the day and coach versions of the shared component remain held.
- `.maestro/golden/standard-program-week.yaml`: completed on the iOS simulator.
  It starts in a clean zero-modifier world, creates a real equipment modifier
  through the athlete's existing door, reaches the week, proves the line and its
  singular wording, compares the collapsed cards, opens Wednesday, and reaches
  Saturday and Sunday.
- `artifacts/ui-walk/week-prototype-parity.png`: looked at after the final run.
  The badges are compact, the dates carry the left column, and the active
  modifier line is visible above the same seven-card list.

**FIRST-RUN FINDINGS, NOT FIXED QUIETLY:** both new source cells first failed on
the old build. The first device attempt died before app evidence when XCUITest
lost its UI element; the retry completed. The first resulting screenshot showed
the badge font had shrunk while its inherited 24pt line box had not; the badge
primitive was corrected and the complete tape reran. The next screenshot showed
the acted world had left Monday open; the comparison tap was re-anchored on the
card head, its collapsed state was asserted, and the full tape reran again.

**NORTH STAR:** toward it. No stored state and no second modifier derivation were
added. The visual tape reaches a modifier by a real athlete action; the strip's
number is still the length of the one list it opens.

**NOT COVERED:** Sam's physical iPhone; a rendered plural line with two active
modifiers (the registered plural copy is source-held, the device tape reaches
one); prior/next-week Completed treatment; the separately deferred team-training
badge; the already-held season-phase removal. This is simulator acceptance, not
phone acceptance.

---

## SAM EYE PASS 3 — ONE CHEVRON OPENS THE WHOLE SESSION

**Sam, with both open states side by side:** *"when you tap the chevron on the
template - the whole session pops down very basically - that's what i want ours
to do instead of being like it currently is".* Correct. The built week card
opened onto the day screen's second layer of component accordions; the template
opens once, then shows section headings and every exercise row immediately.

**THE TWO OPTIONS COMPARED:** (1) initialise every existing inner accordion as
open in Week mode, leaving its rails, icons, counts and inner chevrons visible,
or (2) keep one `DayTimeline` and its one projected entry list, with an explicit
presentation input: interactive on Today, flat on Week. Option 2 landed. It
removes the nested interaction rather than merely pre-opening it, without
building a second session reader.

**WHAT THE FLAT PRESENTATION IS:** one section heading followed by every row in
projection order. Each row carries its derived number, exercise name and signed
prescription. There are no inner buttons, chevrons, timeline rails or icons. The
outer day card remains the only open/close control. Today mode is unchanged.

**RECEIPTS:**

- `test:day-first-timeline`: 33 named cells run, 33 passed. The new cell pins one
  `DayTimeline` call site, the explicit Today/Week presentation choice, every row
  rendered without an `openParts` gate, row numbers, and the absence of the
  nested interaction furniture.
- `.maestro/golden/standard-program-week.yaml`: completed on the iOS simulator.
  After reaching the acted modifier world and the collapsed seven-card list, it
  opens Wednesday once, proves the flat strength rows exist, proves the inner
  strength button does not, keeps the card head, then reaches the bottom days.
- `artifacts/ui-walk/week-row-open.png`: looked at. Wednesday opens as one plain
  ACCESSORIES section with five numbered rows and prescriptions, matching the
  template's interaction shape.
- `test:compile` and `test:maestro-element-contract`: green.

**FIRST-RUN FINDINGS, NOT FIXED QUIETLY:** the new source cell failed on the old
nested build. The first device assertion guessed `accessory` from the visible
headline; the actual projected component identity was `strength`, even though
the signed headline reads Accessories. The screenshot already showed the flat
session was correct, but the guessed selector stopped the tape. The hierarchy
named the real id; the check was re-anchored and the complete flow passed. Visual
inspection then found two top dividers — the week expansion and the first
section both drew one — so the section stopped duplicating the owner's divider.

**NORTH STAR:** toward it. There is still one projected session list and one
timeline component. `presentation` changes only how that list is read; it stores
nothing and derives no second version of the workout.

**NOT COVERED:** Sam's physical iPhone; a multi-section flat week session on the
device tape (the source cell holds every entry and the prior Monday screenshot
showed two sections under the old presentation, but the final device coordinate
is Wednesday's one-section session); prior/next-week Completed treatment; the
deferred team-training badge; the held season-phase removal. This is simulator
acceptance, not phone acceptance.
