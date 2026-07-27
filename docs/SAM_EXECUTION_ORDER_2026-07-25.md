# Sam's Execution Order — 2026-07-25 (GOVERNS remaining sequence)

Sam's directive: "I'm in control from now on." This reorders the remaining
MASTER_PLAN phases into Sam's sequence. Process Law L1–L10 unchanged.
Each step: Sam rules, terminals build, Cowork reviews + keeps the record.

## The order

1. **Muscle groups + experience levels SET** — Sam's review of
   MUSCLE_EXPERIENCE_REVIEW sheet → apply-unit → the muscle-block
   mechanism (D11) carries them.
2. **Conditioning properly SET** — the D12 russian-doll grid: Sam fills
   the cell menus (modality × goal × dose variants), prefilled draft
   from Bible/census formats for his edit → grid replaces all scattered
   formats.
3. **Session structure + programming SET** — session composition
   redesign (Sam's ruling): NO separate boxes (trunk/support, optional
   recovery add-on, power block all render INSIDE the one session
   list); optional mobility flow at the TOP; primers where they belong
   (e.g. external rotations on upper days); then generation invariants
   for D1–D11 (warm-ups match session type — the speed-buildup-on-push-
   day class dies here; density bands; ordering; one-main-per-pattern).
4. **Weekly templates SET** — design session with Sam: how a week is
   best built (availability × phase × game), on top of D1/D5.
5. **Buttons fixed** — the four doors done properly: Away · Injured
   (incl. D10 ask-flow + combined-session split: field pauses, gym
   survives) · Sick/Tired · Missing equipment. Obvious per-session
   controls (+ / − / swap / move). REMOVE "Repeat this week into next
   week". Simplify the Program page as much as possible.
6. **Journal** — per approved JOURNAL_DESIGN (tab + Monday card +
   logging + post-game rating).
7. **Coach does everything** — per COACH_ACCEPTANCE_CONTRACT v1
   (strength/recovery add doors, move candidate consumption, full
   utterance table green).
8. **Publish** — screenshots, TestFlight, review, AU/NZ.

## Step 5 queue (items ruled into step 5 after this doc was written)

### Power exercise override — the athlete changing their power pick

Sam's ruling (2026-07-27): this is the SAME athlete affordance as
swap / + / − / move everywhere else, so it gets designed ONCE in step 5,
not as a power-only special. `POWER_EXERCISE_POOL_SPEC_2026-07-23.md`
rule 2 asked for a diagnose-before-build; the diagnose is done and its
findings belong to whoever designs the step-5 controls:

- **There is no tap target today.** Both power renderers are purely
  presentational. `DayWorkoutScreenV2.tsx` `PowerRow` (the live screen)
  and `components/PowerPrimerSection.tsx` (the V1 screen) each render
  `block.options` as a plain `View` — not `Pressable`/`TouchableOpacity`
  — with no callback prop and no state.
- **"Choose one:" is dead copy.** Both renderers show it only when
  `options.length > 1`, and `buildPowerBlock` pushes exactly ONE option,
  so it has never rendered. The current `options` array is
  display-alternates, exactly as the spec suspected.
- **`PowerRow` takes `block: any`.** It is the one untyped row renderer.
- **What an override actually needs**, end to end: a tap target → a
  callback up to the screen → a block-scoped athlete-choice record that
  persists for the training block → routed through the §18 transaction
  owner (spec rule 2: "no new writer") → undo restoring the app pick
  (spec invariant P8).
- The pool + pure selector this would override are BUILT and unwired
  (`src/rules/powerExercisePool.ts`), so step 5 has a deterministic app
  pick to override and does not need to invent one.

### `beginnerDeterministicProgramTests` — wiring + a pre-existing red

Queued for step-5 SCOPE REVIEW (Sam, 2026-07-27), not for silent repair:

- The suite has **no package script and runs in no gate**, so nothing it
  asserts can fail the build.
- It fails **1 of 39** on `main`: "empty coach response does not restore
  advanced adult defaults". Verified pre-existing by stashing across the
  Stage A work — byte-identical before and after. Never misattribute it
  to a later unit.
- Wiring it in will make that red visible in `test:bible`, so the fix and
  the wiring have to land together — which is why it is a scope-review
  item rather than a one-line gate addition.

### NEXT UNIT (queued 2026-07-27) — the provenance lock

Diagnose-first: design brief and report BEFORE building.

Extend the exercise-name code-literal lock pattern to athlete-affecting
NUMERIC constants. Target state:

- every training-law number lives in a Sam-attributed module;
- the build fails on athlete-affecting numeric literals outside them;
- the attribution registry is frozen in BOTH directions, like the content
  exemption kinds.

The design must say how the remaining known-invented values get flagged
`UNAUTHORED-PENDING-SAM` rather than silently blessed — Sam authors their
replacements next. The list this brief was written around is now EMPTY: every value
it named has an authored replacement or a deletion ruling —
`NEW_ATHLETE_POLICY.maxCoreSessions` (deleted with the §18 beginner line),
conditioning `TIER_CAPS` (ruled DELETED), the deload content numbers, the
readiness-tier reductions and the illness severity trigger (all authored by
Sam on 2026-07-27).

That does NOT make the mechanism unnecessary — it makes it cheap to adopt.
The lock still has to exist for what the sweep has not found yet, and the
`UNAUTHORED-PENDING-SAM` marker is what keeps a newly-found invented number
visible instead of silently blessed. Starting from an empty list means the
lock can be strict from day one rather than shipping with a backlog.

### Queued authored-law units (Sam, 2026-07-27)

In order. Each ends with gates green and pins the authored values in tests.

1. **The deload law.** Same week, same days — structure holds, work shrinks.
   Main lifts half the sets, weight same or slightly down, every set RPE 5-6,
   fast and clean, nowhere near failure. Accessories cut to 2-3 or half,
   whichever is less. Power/speed keep a small sharp dose — few reps, full
   recovery, stop the moment speed drops. Conditioning half the total work,
   one quality exposure max, rest easy aerobic. The test: every session ends
   feeling like there was plenty left; fresher by end of week, not detrained
   and not sore. **The conditioning half is NEW LAW** — the old code left
   conditioning untouched on deloads.

2. **The readiness law** (builds on the deload unit, so it follows it). The
   invented readiness-tier system — moderate / major / full_pause caps — DIES.
   Low readiness, whether athlete-declared or app-detected, means the next
   7 days are deloaded: the deload law applied as a ROLLING WINDOW from the
   declaration day, not the remainder of the calendar week. Sick and injured
   remain their own separate doors, unchanged. One owner applies the deload
   transformation across the window, routed through the accepted-state
   transaction like every other mutation. Tests pin the window behaviour —
   declare Friday, the next 7 days deload, not just the weekend.

3. **The illness law** (reuses the deload mechanism, so it ships with that
   family). Three tiers, all riding the deload law, replacing the old
   "recovery mode only on severe" trigger:

   - **Mild** — training unchanged. Logged as a FACT that can lower
     readiness, which may itself trigger the readiness deload. No direct
     program change.
   - **Moderate (flu-level)** — the week is deloaded for as long as the
     illness fact is ACTIVE: open until cleared per the existing illness
     horizon, NOT the readiness law's 7-day window. Clearing returns to
     normal through the existing clear behaviour.
   - **Severe (bed-bound)** — deloaded AND every session becomes optional
     while active.

   Severity decides exactly TWO things: deload or not, optional or not. No
   other illness-specific numbers may exist. Tests pin all three tiers.

4. **Conditioning progression machinery DELETION** — folded into Stage B's
   scope, not a standalone unit. `TIER_CAPS` and its governing code go when
   the templates take over conditioning selection.

## Standing riders

- In-flight generation-gate ladder fix completes first (onboarding
  cannot coin-flip).
- Every step ends with gates green + Sam device acceptance (L10).
- New rulings recorded from run 6: trunk inline; easy add (real picker,
  not one suggestion); open-horizon illness confirmed Sam's rule
  (re-rulable in one line if he changes his mind).
