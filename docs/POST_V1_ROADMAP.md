# Post-v1 Roadmap (drafted 2026-07-23, Sam to reorder at will)

Sequenced from decisions already made. Items marked **[SAM GATE]** need a
product/programming decision or sign-off before code. Nothing here blocks
v1; nothing in v1 blocks on this file.

## v1.0.x — immediately after launch (small, reactive)

1. Launch-feedback triage — whatever TestFlight + first athletes surface.
2. Feedback email-forward trigger (Supabase → hello@) — the form ships in
   v1 (Group D); the auto-forward was explicitly deferred.
3. Apple account email swap to hello@localfootyathlete.app (cosmetic,
   deferred during enrolment window; ten-minute job in a quiet week).
4. Illness constraint-type cleanup — severe illness currently composes a
   fatigue-typed constraint (recorded mislabel). Pure refactor behind
   existing invariants.
5. Coach dead-code deletion (AdjustmentEvent helpers,
   verifyRenderedExerciseSwap) once remaining references retire.

## v1.1 — the Journal release (the headline update)

- Journal per docs/JOURNAL_DESIGN_2026-07-23.md (design APPROVED, do not
  re-litigate): Monday card, ACWR-lite load-vs-normal, deterministic
  observation lines, freeform notes + tags with resurfacing, monthly
  review, post-game feel rating on Log Game (linchpin — do not cut).
- Per-set rep logger (workout-log UI capture wire) — ships with Journal
  per the v1 launch definition.
- All on-device; zero privacy-policy change as designed.

## v1.2 — programming quality pass **[SAM GATE throughout]**

- Programming density: most days generate ~3 exercises — diagnosis FIRST
  (why: lean rules vs downgrade ladder vs stress model), presented to Sam
  before any rule change. Systemic fix in generation/Bible, not padding.
- Anchor-ratio review (deadlift 1.0 starting point, others).
- Full-toggle methodology (top-of-range vs floor reps inference).
- Severity-tier review (minor/severe line for readiness facts, post-v1
  note from the record-only decision).

## Coach optimisation pass (own release, order vs v1.2 = Sam's call)

- Coach model reassessment **[SAM GATE]** — v1 ships OpenAI/gpt-5.5;
  quality knob not safety (output bounded by parser + transaction owner +
  §18). Switch = env flip + coach QA re-run + privacy policy line.
- Stage 5: coach free-text program editing — diagnosis DONE (parallel
  validator/writer door; recommended Option B = route approved
  {proposedSnapshot, diff} through the transaction owner, retire the
  parallel path). Ship only on the transaction owner.
- Coach-readable Journal (opt-in) **[SAM GATE + privacy update]** — parked
  from Journal design; notes would leave device to the LLM → privacy
  policy + App Store label changes required. Design as opt-in.
- Preview-before-approve UX for plan changes (relocate ask-first flow) —
  transaction results already carry destinationDate/shortfall data for
  this. When it ships, the App Store description line may be restored to
  "shows you what will change before you approve it."

## Feature backlog (unsequenced, decided-in-principle)

- 5.4 pick-days-out busy flow; 5.5 missed-session day-card prompt.
- Female-friendly G-1 session variant **[SAM GATE]** — "Gunshow" stays as
  the default (Sam, 2026-07-23: intentional brand voice); future option: an
  alternative session style/name for that slot for female athletes.
- App Store review prompting — native review prompt (StoreKit
  requestReview) at a high-satisfaction moment (e.g. after a completed
  week or a PR), rate-limited per Apple rules. Sam's chosen review
  strategy over in-app star ratings.
- Expansion beyond AU/NZ — requires EU trader status (Business section in
  App Store Connect) before adding EU countries; one-click otherwise.
- Paid/subscription decision **[SAM GATE]** — if/when LFA charges: Apple
  Schedule 2 (Paid Applications Agreement) + banking/tax forms in
  App Store Connect; budget days for the paperwork before the release
  that monetises.
- Android release (adaptive-icon already in place; everything else TBD).

## Standing invariants for ALL future work

- One mutation owner: every program change routes through the
  accepted-state transaction; facts record, constraints derive, the
  visible week is a projection. No new doors, no parallel writers.
- Tests-first invariants for every behavioral change; device pass is the
  arbiter for anything the harness can't faithfully seed.
- Programming/coaching philosophy changes require Sam's explicit sign-off.
