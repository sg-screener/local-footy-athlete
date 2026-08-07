# COMBINED DEVICE PASS — TAP LIST — 2026-08-07 (the merge gate)

Seat-authored from R5_BOUNDARY_REPORT_2026-08-07 §5. Install OVER the
existing app (data survives): this pass tests the rebuild against Sam's
accumulated real state.

Build: cd ~/Documents/local-footy-athlete && npx expo run:ios --device --configuration Release

## The taps (expected sight after each)

1. Open the app → your week looks THE SAME as before the rebuild.
   Any session/day that changed content is a FINDING — note it exactly.
2. Look at the bottom tabs → no Coach tab.
3. Home → "Want to change something?" → menu has NO "Ask Coach" entry;
   all other actions present.
4. Open a day you completed earlier this week → it shows what you
   ACTUALLY did (no softened/lightened rewrite of a done day).
5. Trigger the "needs more detail" path from the quick menu → sheet
   explains nothing changed + where to act, then closes. No dead
   buttons anywhere on it. (PROPOSED copy — signing batch below.)
6. If the stale-override banner shows → Review still opens and works.
7. A team-training day → no ask-coach affordance on it.
8. Profile → the old setup fallback entry is gone; normal profile
   edits still work.
9. Kill the app, reopen → same week, same days (hydration).

## Expected-imperfect (seeing these is NOT a fail — they are owned)

- Add a game to a rest Saturday then remove it → the day may not
  restore perfectly. Known red (fixture-identity 3/5/6), owed by the
  LR-29 replay unit, measured as fixed under its parked arm.
- Anything coach-related beyond absence checks: the pipeline is frozen,
  not verified. Absence is the only claim.

## Findings protocol

Anything off: the number of the tap + what you saw. No retries, no
screenshots needed unless asked. One pass.
