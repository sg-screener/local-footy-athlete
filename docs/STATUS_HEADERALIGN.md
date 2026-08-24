# STATUS — HEADERALIGN

## 2026-08-25 — Day-card header alignment

Sam asked for the plan-options dots to be slightly larger and for the dots,
CORE badge and Strength title to share one vertical middle.

Two options compared: change the shared tier badge alignment everywhere, or
override it only in the selected Day-card header. The local override landed so
week rows and every other badge consumer keep their existing geometry. The dots
grow from 18 to 22 while the existing 24-point visible button and 10-point hit
slop preserve its physical target.

Focused guard: `test:session-change-hub`.

NOT COVERED: screenshots, broad audits, physical iPhone and other badge surfaces.

## 2026-08-25 — Session-options heading

The popup opened from the programmed-session dots now reads **Session options**
instead of **Plan change**. The heading moved from a local literal into signed
copy beside the menu's existing signed action labels.

Focused guard: `test:accessibility-contracts` — the new signed-heading cell is
green. The run reported 45 passed / 2 failed; both inherited failures name
untouched popup counts in `SeasonPhaseShiftSheet` / `HomeScreenV2`.

NOT COVERED: screenshots, broad audits, physical iPhone and other popup routes.

## 2026-08-25 — Today-only status wording

The Not feeling 100% card now says **Tell us what’s changed and we’ll adjust
today.** The signed copy row changed; the card still reads that one owner.

Focused guard: `test:session-change-hub`.

NOT COVERED: screenshots, broad audits, physical iPhone and other status flows.

## 2026-08-25 — Week adjustment wording

The sheet opened by Edit this week now reads **Adjust week** and **What do you
want to change?** Sam corrected the second line from **What changed this week?**
Both lines use signed copy; its actions and nested session step are unchanged.

Focused guard: `test:day-first-timeline` — the new exact-copy cell is green at
the inherited 54 passed / 2 failed baseline. The two existing reds remain the
mobility review wiring and missing generated Gunshow fixture.

NOT COVERED: screenshots, simulator interaction, physical iPhone and translated copy.

## 2026-08-25 — Week options move into the range row

The large Edit this week bar is gone. A compact dots control now sits at the
right of the week date row and opens the same Adjust week sheet. The date range
stays centred, the dots keep a 44-point tap target, and Monday moves up by the
removed bar and gap.

Focused guard: `test:day-first-timeline` — the new layout cells are green at the
inherited 54 passed / 2 failed baseline.

NOT COVERED: screenshots, simulator interaction, physical iPhone and dynamic type.

## 2026-08-25 — Week session-action explanations

The nested Manage sessions step now gives Add, Move and Remove one explanatory
line each. The labels, icons, order and action routes are unchanged; all six
label/subline values now use signed copy.

Focused guard: `test:day-first-timeline` — the new nested-copy cell is green at
the inherited 54 passed / 2 failed baseline.

NOT COVERED: screenshots, simulator interaction, physical iPhone and completing a session edit.

## 2026-08-25 — Week Add-session explanation

The nested Add a session row now says **Choose a day to add it to**. The label
and Add route are unchanged.

Focused guard: `test:day-first-timeline` — the corrected Add subline cell is
green at the inherited 54 passed / 2 failed baseline.

NOT COVERED: screenshots, simulator interaction, physical iPhone and completing a session edit.

## 2026-08-25 — Week adjustment heading correction

The Week dots sheet now reads **Adjust this week** instead of **Adjust week**.
Only the signed heading changed; its question, grouped rows and actions are
unchanged.

Focused guard: `test:day-first-timeline` — the corrected heading cell is green
at the inherited 54 passed / 2 failed baseline.

NOT COVERED: screenshots, simulator interaction, physical iPhone and dynamic type.

## 2026-08-25 — Week option wording

The first Adjust week screen now uses Sam's four label/subline pairs for Bye,
Game, Away and Manage sessions. All eight lines use signed copy. The Game row
uses **Add a game** in both competitive phases while its underlying picker stays
phase-aware.

Focused guard: `test:day-first-timeline`.

NOT COVERED: screenshots, simulator interaction, physical iPhone and translated copy.

## 2026-08-25 — Week options grouped by purpose

The first Adjust week screen now separates Schedule changes from Training.
Bye, Add a game and Away remain together; a quiet divider and gap introduce
Manage sessions as the only Training row. The three requested explanations now
read Add another game to this week, Adjust around travel or time away, and Add,
move or remove training.

Two options compared: leave four equal rows and change only their spacing, or
give the two kinds of edit named sections while keeping the existing action
doors. The named sections landed because they create the hierarchy Sam asked
for without adding another navigation step or mutation path.

Focused guard: `test:day-first-timeline` — the grouped-sheet cells are green at
the inherited 54 passed / 2 failed baseline.

NOT COVERED: screenshots, simulator interaction, physical iPhone and dynamic type.

## 2026-08-25 — Week-card hierarchy and hit area

The current-day Week card keeps its TODAY pill but now uses a faint one-point
olive border and subtler dark-olive tint instead of the full lime outline. The
exercise-count grey is slightly brighter, and the Week dots retain their small
circle-free appearance while their invisible target grows from 44 to 48 points.

Two options compared: soften the shared selected Card primitive everywhere, or
override only the Week current-day coordinate. The local treatment landed so
Day selection and other selected cards do not change with this Week-only request.

Focused guard: `test:day-first-timeline` — the new hierarchy, contrast and
target-size cells are green at the inherited 54 passed / 2 failed baseline.

NOT COVERED: screenshots, simulator interaction, physical iPhone and pressed-state pixels.
