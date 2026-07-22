# V1 Launch Definition — drafted 2026-07-22

Owner: Sam. This is the checklist that turns "is it ready?" into a yes/no.
Edit ruthlessly — anything not listed under IN is OUT by default.

## What v1 IS

A footy athlete gets a generated program and manages their week through the
app, with a coach that acts through safe, disclosed, reversible edits:

- Program generation (role/goal bias, phase clock, injury staging, §18
  Bible-conformant weeks) — shipped.
- Week editing via tap menus: swap / add / move / bin, one mutation owner,
  disclosed multi-day repairs, undo, game day locked — shipped (fix group A,
  merged `7795ac4`).
- Coach chat for **deterministic** actions (e.g. exercise swaps) — shipped;
  free-text program editing stays dev-gated OFF.
- Session flow: start → finish → feedback, with completed state visible and
  logged weight feeding progression — group B items 1/3/4 shipped.
- Readiness signal visibly acknowledged + opt-in lighter-day offer —
  group B item 2, in diagnosis.

## V1 blockers (the actual to-do list)

1. Group B item 2 — readiness root cause + fix (in flight, terminal 1).
2. Group C — accessibility labels (internal ids exposed on visible surface).
3. Group D — small sweep: dead "Leave Feedback" / "Ask a Human" buttons,
   ISO dates in athlete copy (incl. past-date refusal), raw error codes,
   missing swap-to-Rest.
4. Stack-primitive stage — occupied-day adds still ride the legacy
   single-date writer (4 residuals in the §18 retirement ledger).
5. Anchor-day swap relocate-first bug — shipped in group B item 4 ✓ (listed
   for the record; verify in final regression pass).
6. `SUPPORTED_ATHLETE_ACTIONS.md` contract text for the game-day lock.
7. **Auth decision** — is v1 single-user-on-own-phone (no accounts) or
   multi-user with Supabase auth? Blocks TestFlight scope. Sam to decide.
8. Ship logistics — TestFlight setup, app icon/screenshots, privacy policy,
   Supabase production config, App Store review.
9. Final full QA pass — re-run the screen audits + Maestro smoke on the
   release candidate; test:bible green is a merge gate for every item above.

## Explicitly OUT of v1 (post-launch backlog)

- Journal (weekly numbers / fatigue / free-note sections) — planned v1.x;
  per-set rep logger lands with it.
- Coach free-text program editing (stage 5 — diagnosis done, pipeline
  dev-gated off; ship when redesigned onto the transaction owner).
- 5.4 pick-days-out busy flow; 5.5 missed-session day-card prompt.
- Methodology reviews: anchor ratios (deadlift 1.0), full-toggle
  top-of-range vs floor reps inference.
- Coach dead-code deletion candidates (AdjustmentEvent helpers,
  verifyRenderedExerciseSwap) — tidy-up, not athlete-facing.

## Definition of done for v1

Every blocker above checked off, `test:bible` green on the release
candidate, final Maestro smoke pass clean, and a TestFlight build on a
phone that isn't Sam's.
