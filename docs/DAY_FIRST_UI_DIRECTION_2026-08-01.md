# Day-first UI direction — Sam's design notes, 2026-08-01 (via Cowork)

**Status: PARKED BY SAM'S OWN TIMING.** "Doesn't have to be now or even before
stage 5 programming." A future UI unit, post-Stage-B. Captured so it isn't
lost. No commission implied.

## Sam's direction (from a reference screenshot of a day-planner app)

- **Today-first main view:** the regular Program view leads with TODAY — days
  and dates of the week as a strip at the top; the selected day shows what's
  scheduled. A tab/top control zooms out to weekly or monthly view.
- **Icon shortcut row with labels underneath** (like the reference's
  "Stay Hydrated / Water Plants" chips): quick life-fact entries — missing
  equipment, short on time, injured, etc. (Consolidates the current bottom
  button stack; labels under icons also answer Sam's device-pass note that
  icon meanings weren't obvious.)
- **The day's session as a tappable component timeline:** e.g. Mobility flow
  warm-up → tap to open · Strength/Power component → tap to open ·
  Conditioning or Team Training component → tap to open. Check off components
  as done.
- **Audience rationale (Sam):** most athletes "don't really care too much
  about the next day, they just want to look and be like okay what's on for
  today."

## Review notes (Cowork, agreed with Sam in conversation)

- Cheap under the one-projection architecture: every surface is a window onto
  project(); this is a new window, not new narrators. That is the payoff of
  the 2026-07 migration and the reason this parks safely.
- The component timeline maps 1:1 onto ProjectedDayParts; per-component
  check-off maps onto SessionFeedback's existing per-component completion.
  No new stored state implied.
- NO clock times on components — the app does not schedule times of day;
  ordered steps, not timestamps. (The reference app's 7:00-7:15 pattern does
  not apply.)
- Week strip stays visible in the today view — the game-day anchor is how a
  footballer orients their week.

## When it wakes up

After Stage B (the engine), as its own UI unit: design pass with Sam
(including the icon-picking session already queued), copy through the signed
sheet, built on project(), walker surface laws apply as to any surface.
