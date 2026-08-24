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
