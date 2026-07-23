# Journal — Design Doc (approved by Sam 2026-07-23)

Status: **DESIGN APPROVED — builds PRE-LAUNCH (Master Plan Phase 5C, Sam
2026-07-23).** This doc is the source of truth for the Journal build;
decisions below were made by Sam in design review and should not be
re-litigated at build time.

Structural clarification (Sam, 2026-07-23): the **Journal TAB** is the
permanent home and ships in the launch build; the **Monday card is a
pop-up** (local notification → card) whose results persist into the tab.
Progressive data states are designed deliberately: day one shows notes +
logged sessions; trend surfaces (ACWR load-vs-normal, progressions,
observation lines, monthly review) appear automatically as weeks of data
accrue, with honest "builds as you train" copy until then.

## The one-line vision

The athlete's deepest question isn't "what did I lift" — it's **"is this
working, and why did Saturday feel the way it did?"** Every element of the
Journal ladders up to that.

## Architectural stance (non-negotiable)

- The Journal is a **reading surface (projection) plus record-only notes**.
  It is NOT a new mutation door. Notes and ratings record; they never mutate
  the program. Anything that should influence the program routes through the
  existing owners (readiness offers, accepted-state transaction).
- Almost all data already exists: logged weights/reps, session feedback,
  completions, readiness/illness facts, reversible adjustments + disclosures.
  The Journal reads these; it does not duplicate them.
- Everything stays **on-device**. Weekly insight lines are deterministic
  rules, not LLM calls → **zero privacy-policy or App Store label changes**
  for this feature as designed.
- New data points introduced (all record-only): free-note entries (freeform
  text + optional tags), post-game feel rating (1–5, one tap).

## The Monday card (weekly review)

Delivered via **local notification Monday morning**, opens the Journal tab.
Timing rationale: lands the morning after the game while the week is fresh.

Contents, in order:

1. **Did the work happen** — sessions completed vs planned, phrased kindly.
   Where the app knows why a session didn't happen (binned, sick, lightened),
   say so: a missed session with a reason is information, not failure.
2. **Strength line** — best top sets this week; one line per anchor lift
   with up/flat/down arrow vs last week.
3. **Load vs your normal (ACWR-lite)** — this week's volume vs the rolling
   4-week average, in plain language: "a big week — about 30% over your
   recent normal" / "a light week." Sam: acute-to-chronic workload spikes
   are key to progression and injury risk. Keep the maths simple and the
   language honest; no pseudo-precision.
4. **How you said you felt** — readiness/illness flags count, lightened
   sessions, session feedback summary. Plus deterministic **observation
   lines** that place facts next to each other WITHOUT causal claims, e.g.
   "Both weeks you flagged poor sleep twice, your game rating was a 2."
   Observations, never conclusions.
5. **Note prompt** — one freeform box: "anything worth remembering about
   this week?" with optional tags (recovery, mobility, injury, diet, work
   stress). Old notes resurface at relevant moments (e.g. a knee-tagged note
   from four weeks ago resurfaces when a knee niggle is flagged).

## Post-game feel rating (the linchpin)

Extend Log Game with one tap: "How were your legs / energy?" (1–5).
This single data point connects the training week to footy performance and
powers the observation lines. Cheapest feature with the highest insight
yield — do not cut it.

## Monthly review

Where progression lives (weekly strength is noisy; monthly is a story):

- Anchor-lift trend charts (top-set over time)
- Conditioning progression
- Consistency percentage + total sessions banked
- "Your month in flags" — fatigue/soreness/illness trend across the month
- One satisfaction line, e.g. "you've added 12.5kg to your trap bar since
  March" — visible progress is the retention mechanism, not badges.

## Deliberately excluded (Sam agreed)

- **Streaks, badges, gamification** — the athletes are adults balancing
  work and footy; the app deliberately legitimises missing sessions, and
  shame mechanics fight that.
- **AI-written weekly summaries** — deterministic observation lines are
  honest, free, and on-device.

## Parked (revisit when optimising the coach chatbot)

- **Coach-readable journal (opt-in)**: letting coach chat read notes would
  make the coach dramatically smarter, but notes would then leave the
  device to the LLM → privacy policy + App Store label changes required.
  Park until the coach-chat optimisation pass; design as opt-in when it
  comes.

## Dependencies / build notes

- Logging model (Sam, 2026-07-23 — REPLACES "per-set logger"):
  **assume-prescribed, edit-by-exception.** Completing an exercise assumes
  the prescribed sets×reps at the shown weight (e.g. 3×10 done = 3×10);
  the athlete only edits the weight, or overrides reps in the exception
  case. NO per-set data entry — 6 exercises must never mean 18–36 inputs.
  Open programming question for the Phase 4 design session: drop rep
  ranges (3×8–12 → 3×10) so the assumption is unambiguous.
- Weekly card notification = local notification only (no APN/push infra).
- Free-note entries should be a record-only fact/store consistent with the
  temporary-source-fact patterns (typed, dated, taggable), but with no
  constraint composition whatsoever — notes can never derive program state.
- Observation-line rules live in one pure module with tests-first examples;
  they must never claim causation in copy.
