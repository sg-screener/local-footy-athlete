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

## SAM EYE PASS 8 — THE DAY REVIEW FINISHES THE MATCH

**Sam, comparing the two Day screens:** *"there is no yellow left highlight on
renees screen on the day page"*; *"she also includes the mobility / warm up on
the front review screen (and conditioning when it's there)"*; the Strength
headline was too small and the change link too prominent. He then reversed the
earlier style ruling for type: *"i like her fonts better"*, clarified *"on all
pages everywhere"* and *"match font and size for everything she has done"*.

**THE TWO OPTIONS COMPARED:** (1) restyle only the photographed Day-card labels
and manufacture a warm-up row in that component, or (2) adopt the prototype's
measured system-face scale at the shared Text/Input owners and ask the existing
mobility-flow selector for the same optional flow the session screen shows.
Option 2 landed. It removes a second typography interpretation and avoids a
second warm-up prescription.

**THE REVIEW BOUNDARY:** projected strength, conditioning, power and other
load-bearing parts remain the projection's entries. The optional mobility flow
does not pretend to be one of those parts; it is derived by the same owner and
with the same athlete/date/phase/game-week inputs as the session screen, then
shown first. Its movement doses now have one formatter shared by both surfaces.

**FIRST-RUN FINDINGS:** the new Day cells red on the 8pt eyebrow, 16pt title,
lime rail and link, and absent mobility selector. The app-wide typography guard
red on the old 36pt heading scale and found that shared Text discarded its own
declared font family while text inputs declared none. Its bypass census found
zero athlete-facing screens importing React Native Text directly, which is why
the owner redesign can cover the whole surface instead of spawning a file-by-
file patch list.

**RECEIPTS:**

- `test:prototype-typography`: 3 named cells run, 3 passed. The cells pin the
  measured shared scale, require the System face at both Text and TextInput,
  and census every athlete-facing screen for a bypass of that owner.
- `test:day-first-timeline`: 39 named cells run, 39 passed. The Day cells pin
  the larger session title, quiet change link, absent accent rail, one gray
  mobility icon, owned warm-up flow first and every projected component after
  it — including conditioning when the projection carries it.
- `.maestro/golden/day-card-dropdowns.yaml`: completed on the iOS simulator.
  The compact card opens Mobility / Warm-up onto its four real movements and
  doses, closes it, then opens Strength without leaving the Day screen.
- `.maestro/golden/day-week-profile.yaml`: completed on the iOS simulator after
  the global scale changed. Day, all seven Week cards, Profile and Coach mount,
  remain reachable and were visually inspected without clipping.
- `.maestro/golden/coach-my-status.yaml`: completed on the iOS simulator. Both
  empty and populated My Status states, the season review sheet and its setup
  questions remain reachable under the same type owner.

**WHAT CATCHES THE NEXT DEFECT OF THIS CLASS:** a local font-family fork or a
screen bypassing shared Text reds the app-wide typography cell; a Day rail,
missing mobility row, wrong icon, manufactured conditioning row or regressed
hierarchy reds the Day cell; the two complete simulator walks catch a scale
that is source-correct but clips or costs a prototype-covered route.

**NOT COVERED:** Sam's physical iPhone; third-party native controls and the OS
status bar; the classic Program template. This is simulator acceptance, not
phone acceptance.

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

---

## SAM EYE PASS 4 — TODAY IS HIGHLIGHTED, NOT OPEN

**Sam, comparing the initial week states:** *"the current day always starts open
- i don't want that, it can be highlighted a bit more than the others but i dont
want it to start with the box open".* Correct. `useHomeScreen` selects today so
the Today screen has a subject; the Week screen was reading that same selection
as expansion state. One value had acquired two meanings.

**THE TWO OPTIONS COMPARED:** (1) add a second `weekExpandedIdx` beside the
existing selected day, or (2) clear the transient selection when the athlete
switches into Week and keep today's visual emphasis derived from `day.isToday`.
Option 2 landed. It adds no new state or second identity. Other weeks already
start with no selected day, and picker mode does not expose normal expansion, so
the transition is the one boundary that needed to separate the meanings.

**RECEIPTS:**

- `test:day-first-timeline`: 34 named cells run, 34 passed. The new cell pins
  both halves: Week selection clears at the toggle, while the card's highlight
  continues to read date identity rather than open state.
- `.maestro/golden/standard-program-week.yaml`: completed on the iOS simulator.
  Immediately after switching to Week in an acted modifier world, it proves no
  timeline is visible; only then does it compare the seven collapsed cards and
  open Wednesday into the full flat session.
- `artifacts/ui-walk/week-prototype-parity.png`: looked at. Today has the lime
  border, lime date treatment and TODAY marker, its chevron points down, and no
  session rows are open.
- `test:compile` and `test:maestro-element-contract`: green.

**FIRST-RUN FINDING:** the new cell failed on the old toggle because it only set
the preferred view. The transition now clears the open coordinate and the full
device tape passed without the manual collapse gesture the prior tape required.

**NORTH STAR:** toward it. No second expansion store was added. Today identity
is derived from the date; open state remains temporary screen state and is reset
at the screen-shape boundary.

**NOT COVERED:** Sam's physical iPhone; a device tape of Week → open a day →
Today → Week again (the same transition handler is source-held); prior/next-week
Completed treatment; the deferred team-training badge; the held season-phase
removal. This is simulator acceptance, not phone acceptance.

---

## SAM EYE PASS 5 — REST AND GAME DAY ARE STATUS CARDS

**Sam, on the collapsed seven-card week:** *"the game day and rest cards now
look a bit silly - can you please make the boxes a bit smaller like renee's and
centre the text on those days?"* Correct. The one-card-shape pass gave Rest and
Game Day the training card's minimum height and, more importantly, always
mounted the category row. On those two states that row had no content, but it
still reserved 17 points above the title.

**THE TWO OPTIONS COMPARED:** (1) make separate Rest and Game card components,
or (2) keep the one week-card head and give its two status states one compact
layout input. Option 2 landed. The status input removes the empty category
reservation, shortens the outer card and inner padding, and vertically centres
the existing title block. Training, selected-today, expanded-session and picker
states keep their existing layout.

**RECEIPTS:**

- `test:day-first-timeline`: 35 named cells run, 35 passed. The new cell pins
  the one Rest/Game compact decision, its use by both outer and inner card
  spacing, the centred main block, and the absence of an empty category row.
- `.maestro/golden/standard-program-week.yaml`: completed on the iOS simulator.
  It still reaches the acted modifier world, collapsed entry, flat session and
  all seven cards, and now captures the two bottom status cards together.
- `artifacts/ui-walk/week-status-cards.png`: looked at. Saturday Game Day and
  Sunday Rest Day are both materially shorter than Thursday/Friday training
  cards, with their labels centred vertically beside the unchanged date column.
- `test:compile` and `test:maestro-element-contract`: green.

**FIRST-RUN FINDING:** the new cell failed on the old build because there was no
shared compact status decision at all. It went green after that decision owned
the card, inner padding, header, date column and title block together.

**NORTH STAR:** toward it. This is one presentation input on the existing card,
derived from the day's already-projected state. No new component, stored flag or
second account of the day was added.

**NOT COVERED:** Sam's physical iPhone; today itself being a Rest or Game Day
(the same status layout is source-held, but the device coordinate has Monday as
a session); prior/next-week Completed treatment; the deferred team-training
badge; the held season-phase removal. This is simulator acceptance, not phone
acceptance.

---

## SAM EYE PASS 6 — WEEK NAVIGATION BELONGS TO WEEK

**Sam, comparing the accepted day and week templates:** *"there is no weekly
swiping anymore on the new template but there still is on the old template - we
need to remove that for the day screen, and for the weekly screen it needs to be
dropped to below the day week toggle and simplified a bit".* Correct. The large
previous/range/next bar was mounted before the shape toggle, so Today and Week
both inherited it. Its circular buttons and relative-week badge also carried
more visual weight than the Week list needed.

**THE TWO OPTIONS COMPARED:** (1) condition and reposition the existing large
bar, or (2) make navigation a Week-shape-only compact row: plain small chevrons,
one uppercase date range, no relative badge, directly below the Day/Week toggle.
Option 2 landed. The three existing handlers, accessibility labels and stable
doors remain; only their shape ownership and presentation changed.

**THE LIVE ROUTE REOPENED THE OWNERSHIP QUESTION:** after previous → return and
next → return, Monday opened itself. Pass 4's chosen fix had only cleared the
shared selection at Week entry; `useHomeScreen` correctly repopulated that
shared selection when the visible week returned to now, and Week still read it
as expansion. Two further options were compared: add three more clears around
navigation timing, or stop using the shared day/picker selection as the new
template's expansion state. The second landed. `expandedWeekIdx` is local,
transient presentation state; Today reads `todayIdx` directly; every shape and
date transition clears expansion before it moves. This **supersedes Pass 4's
claim that no separate expansion owner was needed** — the live adjacent-week
coordinate proved that claim too narrow.

**RECEIPTS:**

- `test:day-first-timeline`: 36 named cells run, 36 passed. The new cells pin
  toggle → compact navigator → content order; Week-only mounting; the absence
  of large buttons/badge; all three preserved doors; compact proportions; a
  template-local expansion owner; direct Today ownership; and collapse in all
  three date-navigation handlers.
- `.maestro/golden/standard-program-week.yaml`: completed on the iOS simulator.
  It proves all four navigation ids absent on Today and present on Week, acts
  through previous → this week and next → this week, proves the list is still
  collapsed after both returns, then opens one flat session and reaches Sunday.
- `artifacts/ui-walk/day-no-week-navigation.png` and
  `artifacts/ui-walk/week-prototype-parity.png`: looked at. Today begins with the
  toggle and card; Week adds only the small date-and-chevron row below the
  toggle, before its active-modifier line and cards.
- `test:compile` and `test:maestro-element-contract`: green.
- `test:dev-e2e-testids` is RED on two pre-existing equipment selectors. Its
  week-navigation cell is green; the two unrelated failures were reported and
  not changed in this UI checkpoint.

**FIRST-RUN FINDINGS, NOT FIXED QUIETLY:** the source cell failed on the old
before-toggle shared bar. Its first region boundary used a source comment, which
the suite deliberately strips; that made the scan run to end-of-file and see an
unrelated badge. The cell now proves a live picker-expression anchor exists
before slicing. One attempted wider script name did not exist; the correctly
named script produced the pre-existing equipment red above. The first full
rerun lost XCUITest's accessibility hierarchy before its first assertion and
was rerun unchanged. The next run exercised both new doors and then caught the
real selected/open collision by finding Monday's full timeline after return.
The expansion owner was separated, and the complete route then passed.

**NORTH STAR:** toward it. The date row changes only which already-derived
visible week is read. Today, Week expansion and picker selection now each have
one meaning instead of sharing a coordinate; no program fact or derived workout
is stored by this presentation.

**NOT COVERED:** Sam's physical iPhone; the old/classic template (the shared
navigation handlers are unchanged, but this ruling is for the accepted new
template); adjacent-week Completed styling; the deferred team-training badge;
the held season-phase removal. This is simulator acceptance, not phone
acceptance.

---

## SAM EYE PASS 7 — THE SESSION ICON IS THE MARKER

**Sam, comparing the day cards:** *"the day screen also doesn't have the dot
points it has the icon for the session as the dot point can you please change
mine to be like renee's as well as trying to match the text up a bit better on
hers vs mine".* Correct. The interactive day timeline drew a hollow node and
connector rail, then drew the component icon beside them. One row had two
markers, and that duplicate column pushed the already-larger heading and count
further right than the accepted card.

**THE TWO OPTIONS COMPARED:** (1) restyle the hollow node to resemble each icon,
leaving the rail and separate icon layer in place, or (2) delete the marker
layer and let the existing typed component icon own the one marker column.
Option 2 landed. Saved completion colour now reaches that same icon, so removing
the dot does not remove the fact it used to colour. The main day headline also
stops repeating a session icon above those icon-led rows.

**THE PROPORTION PASS:** the eyebrow moved to 8/11, the main session title to
16/20, component headings to 10/13 bold caps, counts to 9/12, and the category
badge uses the compact treatment. The component rows gain Renee's quiet
hairline separators, their exercise rows align under the new single marker,
and Start Session uses the small shared button rather than the hero height.
Words, counts, prescriptions, chevrons and doors are unchanged.

**RECEIPTS:**

- `test:day-first-timeline`: 37 named cells run, 37 passed. The new cell forbids
  the rail/node/connector in the interactive branch, requires one icon marker
  carrying completion colour, forbids the duplicate headline icon, and pins
  the accepted type, badge, divider and button proportions.
- `.maestro/golden/standard-program-week.yaml`: completed on the iOS simulator;
  its default-day screenshot was inspected with the single icon column and new
  collapsed typography in place, before the same route reached the full Week.
- `.maestro/golden/day-card-dropdowns.yaml`: completed on the iOS simulator. A
  strength section opened in place, showed all names and prescriptions, kept
  Start Session on the same screen, then closed again.
- `artifacts/ui-walk/day-no-week-navigation.png` and
  `artifacts/ui-walk/dropdown-2-expanded.png`: looked at. The hollow dots and
  vertical rail are absent; strength and conditioning icons align the rows;
  headings/counts sit on the same left edge; the tighter button and badge keep
  the full card above the separate change card.
- `test:compile` and `test:maestro-element-contract`: green.

**FIRST-RUN FINDING:** the new cell failed on the old interactive branch at the
first forbidden marker (`timelineRail`). After the marker layer was deleted and
completion colour moved to the icon, the cell and both complete device routes
passed. Nothing was fixed outside the finding.

**NORTH STAR:** toward it. The component kind already derived the icon and the
saved outcome already derived completion. One existing icon now presents both;
no second component identity, stored display flag or rewritten session word was
introduced.

**NOT COVERED:** Sam's physical iPhone; VoiceOver reading order after the visual
column removal (the row keeps its existing single accessibility label and
button role, source-read but not device-spoken); exceptionally long translated
headings; the old/classic template. This is simulator acceptance, not phone
acceptance.
