# Local Footy Athlete — Product Architecture

This document is the canonical reference for what Local Footy Athlete (LFA) is, how it must behave for a real athlete, and the architectural rules every change must respect.

If implementation drifts from this document, **update this document**. It is the source of truth, not the code.

---

## 1. What LFA is

LFA is a strength & conditioning app for **local Australian rules footballers** — amateur athletes who play one game a week on the weekend and train around it.

The athlete should feel like they have a smart S&C coach in their pocket: it builds their week, adjusts for what comes up, explains itself, and never overreaches on injury.

### 1.1 Core athlete loop

LFA is S&C-first. The athlete opens the app to know what to train, why that session fits their football week, and how to adjust when real life gets messy.

The core loop is:

1. **Program the week** — build a practical strength and conditioning week around game day, team training, availability, equipment, season phase, and training history.
2. **Check today's state lightly** — capture only the minimum readiness signal needed to coach today: energy, soreness / pain flags, time available, and whether the athlete feels unusually flat.
3. **Adapt today's session** — keep the planned S&C session when possible; adjust dose, modality, exercise selection, or timing only when the readiness signal or coach conversation justifies it.
4. **Train and finish** — the athlete completes the session and gives quick feedback.
5. **Learn forward** — completed / partial / skipped sessions, soreness, fatigue, and coach conversations feed the next visible session and the next week.

Readiness is **complementary**, not the product. It should feel like a 10-second coaching check, not a daily wellness survey. The app must never make the athlete feel blocked from seeing or doing the S&C work because they skipped a readiness input.

Readiness answers: "Do we keep, trim, swap, move, or recover today?" It does not replace the training program, the coach chat, or the session details.

**Out of scope:**

- Rehab protocols
- Medical advice / diagnosis
- Elite/AFL-list periodisation
- Group/team programming
- Wearable integrations
- Detailed analytics

The AI coach is **not a doctor or physio**. For significant pain, it trains around the issue and tells the athlete to get assessed.

---

## 2. MVP scope

The MVP is shippable when:

1. Onboarding reliably produces a sensible AFL S&C week
2. Program tab and the day-workout screen agree on what's happening today
3. Game day, recovery, and team-training rules are correct
4. The AI coach can handle these real-world athlete messages:
   - injury (with severity)
   - soreness
   - fatigue
   - missed session
   - busy week
   - exercise swap / preference
5. Lightweight readiness can influence today's recommendation without taking over the app
6. Program changes are visibly reflected
7. Coach Update card explains active constraints concisely
8. Multiple active constraints can coexist
9. Reset / debug controls exist on the live UI
10. App does not hallucinate program changes
11. App feels practical and trustworthy for an amateur athlete

Anything that doesn't move one of these criteria forward is post-MVP polish.

---

## 3. Onboarding model

Onboarding lives in `src/screens/onboarding/`. The completion handler is `CompleteScreen.tsx`, which calls `generateProgramFromProfile(...)` and then seeds the program / microcycle / first-day workout / game-day calendar.

Onboarding captures the athlete's training context:

| Field                  | Source screen                       | Purpose                                                         |
|------------------------|-------------------------------------|-----------------------------------------------------------------|
| Name                   | NameScreen                          | Greeting / personalisation                                      |
| Position               | PositionScreen                      | Conditioning bias (mid vs forward vs ruck etc.)                 |
| Season phase           | SeasonPhaseScreen                   | Pre-season / in-season / off-season template selection          |
| Game day               | GameDayScreen                       | The fixed weekly anchor — recovery and peak revolve around it   |
| Preferred training days| PreferredTrainingDaysScreen         | Athlete-controlled session days                                 |
| Team training days     | TeamTrainingDaysScreen              | Hard anchors — unioned into selectedDays at engine boundary     |
| Team training duration | TeamTrainingDurationScreen          | Field-load budgeting                                            |
| Team training intensity| TeamTrainingIntensityScreen         | Field-load budgeting                                            |
| Training commitment    | TrainingCommitmentScreen            | Total weekly load                                               |
| Session duration       | SessionDurationScreen               | Time available per session                                      |
| Sprint exposure        | SprintExposureScreen                | Sprint-readiness baseline                                       |
| Conditioning level     | ConditioningLevelScreen             | Initial aerobic / glycolytic distribution                       |
| Squat strength         | SquatStrengthScreen                 | Strength baseline                                               |
| Bench strength         | BenchStrengthScreen                 | Strength baseline                                               |
| Body measurements      | BodyMeasurementsScreen              | Load estimation                                                 |
| Recent training load   | RecentTrainingLoadScreen            | Ramp-up calibration                                             |
| Gym experience         | GymExperienceScreen                 | Movement complexity ceiling                                     |
| Injuries               | InjuriesScreen                      | Initial active constraints                                      |
| Motivation / goals     | MotivationScreen                    | Tone / framing                                                  |

Onboarding output flows into `useProfileStore` and is read by every downstream system.

**Persistence:** Zustand + AsyncStorage. Onboarding survives app restart.

---

## 4. Program generation model

The program is generated by `generateProgramFromProfile` (engine entry point in `src/utils/coachingEngine.ts` / `src/utils/sessionBuilder.ts` and friends). The engine produces:

- One `Program` (the macro container)
- One or more `Microcycle`s (typically a week)
- A `Workout` per training day, with a typed `sessionTier`, `workoutType`, `intensity`, ordered `exercises`, and a `coachNotes` bucket for downstream attribution

**Architectural rule:** the engine is the single authority for structural fields. AI never invents structural metadata — it only enriches descriptions / explanations. (See memory: `feedback_ai_enriches_engine_defines.md`.)

**Coach LLM boundary:** OpenAI/GPT is the preferred coach language and reasoning provider at the Supabase edge-function layer. It may classify intent, explain training, and request typed tool actions, but the deterministic S&C engine, resolver, and validator remain the source of truth for what changes.

Strength-pool selection rotates across cycles deterministically (`project_crosscycle_variation.md`); conditioning rotates by `(category, miniCycleNumber)` (`project_conditioning_template_rotation.md`).

---

## 5. Resolver priority model

The visible week is computed in two layers:

### Layer A — sessionResolver (`src/utils/sessionResolver.ts`)

Takes the program, calendar, manual date overrides, coach overrides, and active injury, and resolves what each calendar day should be. Override priority (highest to lowest):

1. Calendar override (`game`, `rest`, `noGame`) — scoped by day-of-week for one-off marks (`project_oneoff_game_scoping.md`)
2. Manual user override (athlete dragged or edited a day)
3. Coach override (UAE-applied adjustment)
4. Template (microcycle's planned content)

The resolver applies an **injury filter** (`applyInjuryFilterToWorkout`) on the way out — future weeks reflect an active injury automatically without needing per-day overrides written.

### Layer B — visibleProgramProjection (`src/utils/visibleProgramProjection.ts`)

The single UI gate. Takes a resolved day and runs three passes:

1. **Pass 1:** legacy tag-based injury filter
2. **Pass 2:** universal exposure engine (`scoreExerciseAgainstConstraints`) — the primary decision layer
3. **Pass 3:** validator sweep (`validateWorkoutAgainstConstraints`)

**Architectural rule:** every UI surface that shows a workout MUST go through `projectAndLog` / `projectVisibleDay`. The hook `useResolvedDay` enforces this. HomeScreenV2 and DayWorkoutScreenV2 both consume it. The two surfaces cannot disagree.

Passing extra constraints (fatigue / soreness / schedule / missed session) into projection is supported via `extraConstraints?: Constraint[]`. Non-injury producers exist, but future changes must prove the live user path writes those constraints before claiming the coach is adaptive.

---

## 6. Calendar / game / training-day rules

### Game day

The athlete picks a usual game day in onboarding. In-season, the game renders **virtually** from `profile.usualGameDay`; the calendar store only holds *overrides* (e.g. moved game, bye, pre-season fixture). See `project_virtual_games_architecture.md`.

One-off `'game'` marks on a different DOW are window-scoped to the centerDate's week (`project_oneoff_game_scoping.md`) — moving a game does NOT trigger a microcycle rebuild.

### Team training

Team training days are hard anchors. They:

- Are unioned into `selectedDays` at the engine input boundary (`project_team_day_hard_anchor_reconciliation.md`)
- Carry "Team training" as the lead session focus across all phases (`project_preseason_team_day_and_core_streak.md`)
- G−1 team day is rebadged as "Captain's run"
- Bare team days render a "Finish workout" CTA that lands directly on `SessionFeedbackPanel` (`project_team_training_card_ux.md`)

### Phase rules

| Phase       | Strength balance | Conditioning bias                          |
|-------------|------------------|--------------------------------------------|
| Off-season  | Volume + variety | Aerobic base + sprint development          |
| Pre-season  | 2L + 2U at core=4 (`project_preseason_4exposure_priority.md`); region sequencing prefers Lower on standalone days (`project_preseason_sequence_priority.md`) | Phase-specific category priority (`project_conditioning_category_system.md`) |
| In-season   | core=3 → Lower + Push + Pull (`project_inseason_3exposure_priority.md`); push/pull balance enforced as final pass (`project_inseason_pushpull_balance.md`) | Conditioning floor: 1 core + optional supplementary aerobic_base (`project_inseason_conditioning_floor.md`) |

### Phase transitions

Onboarding, phase shifts, and game-state changes all funnel through `generateProgramFromProfile`. Calendar overrides are display-only — never structural (`project_unified_program_rebuild.md`).

UI terminology is canonical: `Pre-season` / `In-season` / `Off-season` + verb `Shift to…` / `Shifting to…` + lowercase `mode` suffix. Never "Switch / Change / Enter" (`project_season_transition_terminology.md`).

---

## 7. Override rules

There are three override surfaces. They are not interchangeable.

### Manual (user) overrides — `programStore.dateOverrides`

Athlete-driven. The athlete dragged/edited the day. These are protected — coach actions skip them as a no-op and are surgical (`project_athlete_overrides_seam`-style behaviour).

### Coach overrides — `coachUpdatesStore` / programStore via `applyAdjustmentEvents`

Created by the deterministic adjustment engines (`applyInjuryAdjustment`, `applyProgramAdjustment`). Each event is validated, applied, and logged. The engine writes a `coachNotes` line on the touched workout so the change is visible to the athlete.

### Calendar overrides — `calendarStore`

Display-only marks: `game`, `rest`, `noGame`. They never reshape the program. The resolver consumes them at priority #1.

---

## 8. AI coach role

The coach lives in `src/screens/coach/CoachScreen.tsx`. The send pipeline (`handleSend`) runs in this order:

1. **Client-side injury clarification guard** — bare "I'm injured" / "I'm sore" / "Busy week" return ONE clarifying question, never auto-fire (`feedback_coach_ambiguity_triage.md`)
2. **Pending-injury resolver** — if the previous turn stashed a body part awaiting severity, a bare `6/10` reply consumes it (10-min TTL) (`project_pending_injury_resolver.md`)
3. **Active-injury follow-up** — "better" / "worse" / "pain gone" classify against the active injury and loosen / escalate / clear (`project_uae_progression_loop.md`)
4. **Severity-known UAE** — `applyProgramAdjustment` → `applyAdjustmentEvents` mutates the program deterministically (`project_uae_stage3_wiring.md`)
5. **Coach intent classifier** — LLM classifies the message into a `CoachIntent` JSON, the dispatcher (`coachIntentDispatcher.ts`) routes to the right deterministic handler (`project_coach_intent_architecture.md`)
6. **Legacy `/coach-chat` fallback** — fenced: skip when `activeInjury` exists OR intent is structured. Cannot claim unverified program changes.

**Architectural rule:** the LLM never directly mutates injury / fatigue / missed-session flows. It classifies intent; deterministic engines own the mutation.

### Coach tone

- Concise, direct, calm, practical
- Acknowledge context, ask only one useful question if needed, never re-ask what was already answered
- Explain what changed and why
- Tell the athlete what to do next
- Suggest physio for significant pain
- Never diagnose, never rehab-prescribe, never wall-of-text

---

## 9. Deterministic program mutation rules

Program mutation must go through one of the deterministic engines:

| Concern                       | Owner                                                        |
|-------------------------------|--------------------------------------------------------------|
| Injury (severity ≥ 5)         | `applyInjuryAdjustment` → `applyAdjustmentEvents`            |
| Generic adjustment events     | `applyAdjustmentEvents`                                      |
| Visible-program shaping       | `visibleProgramProjection` (`projectVisibleDay`)             |
| Constraint validation         | `validateVisibleProgramAgainstConstraints` (engine)          |
| Plan derivation               | `buildConstraintPlans` → `ConstraintPlan` shared layer       |
| Visible-diff invariant        | `snapshotVisibleWorkout` + `computeVisibleDiff`              |

The coach reply is gated on `apply.applied.length > 0` AND the diff actually showed change (`project_uae_visible_coach_notes.md`). If nothing visibly changed, the reply does not claim a change.

---

## 10. Active constraints model

`ActiveConstraint` is a discriminated union on `type`:

```ts
type ActiveConstraint =
  | ActiveInjuryConstraint
  | ActiveFatigueConstraint
  | ActiveSorenessConstraint
  | ActiveScheduleConstraint
  | ActiveMissedSessionConstraint;
```

Common fields: `id`, `type`, `status` (`active` | `improving` | `resolved`), `startDate`, `lastUpdatedAt`. Injury adds `bodyPart`, `bucket`, `severity`, `rules[]`, `safeFocus[]`, `advice[]`.

`activeConstraints[]` lives in `coachUpdatesStore`. Legacy `activeInjury` is a write-through alias on the most-recently-touched injury — kept for compatibility with older selectors. New code reads `activeConstraints`.

Preferences are not active constraints today. They live in `coachPreferencesStore` / mutation history unless we deliberately promote preference conflicts into the constraint layer later.

### Readiness signal model

Readiness should become a small daily signal that can be derived from either a quick check-in or natural coach language. It should not be a required form.

Minimum useful shape:

```ts
type ReadinessSignal = {
  date: string;
  bodyPart?: string;
  energy?: 'low' | 'okay' | 'good';
  soreness?: 'none' | 'mild' | 'moderate' | 'high';
  painFlag?: boolean;
  timeAvailableMinutes?: number;
  flatToday?: boolean;
  source: 'quick_check' | 'coach_message' | 'session_feedback';
  updatedAt: string;
};
```

Resolver impact should be conservative and S&C-specific:

- **Good / normal:** keep the planned session.
- **Low energy or flat:** reduce volume / intensity before changing session identity.
- **High soreness:** constrain the relevant exposures and prefer lower-risk substitutions.
- **Time limited:** preserve the main lift / main conditioning stimulus and trim accessories.
- **Pain flag:** route through injury / soreness clarification, train around if needed, and avoid medical claims.

The athlete must always be able to open the session without checking in. Missing readiness data means "use the plan", not "ask another question".

Quick chips and coach-chat phrases must share this same signal path:

- `Flat` / "I'm cooked" → low-energy readiness signal for today
- `Short time` / "I only have 25 mins" → time-limited readiness signal for today
- `Sore` / "I'm sore" → ask one body-part question if needed
- "My calves are cooked" → body-part soreness signal for today, unless pain / injury / severity language is present

Multi-constraint behaviour: the visible projection layer obeys ALL active constraints. Most conservative rule wins. The Coach Update card, the reply composer, and the validator all derive from the **same** `ConstraintPlan[]` (`project_constraint_plan_layer.md`).

---

## 11. Exposure engine rules

`src/utils/exposureEngine.ts` replaces per-body-part blacklists with universal S&C exposure decisions (`project_universal_exposure_engine.md`).

Exposure taxonomy (~46 exposures), grouped:

- **Lower / running:** sprint, high_speed_running, acceleration, change_of_direction, plyometric, explosive_lower, heavy_lower_strength, heavy_squat, heavy_hinge, knee_dominant, hip_dominant, posterior_chain, hamstring_dominant, calf_achilles, adductor_groin, axial_loading, loaded_carry
- **Upper:** horizontal_press, vertical_press, overhead_loading, explosive_push, shoulder_isolation, horizontal_pull, vertical_pull, heavy_pull, grip_heavy, elbow_loading, wrist_loading
- **General:** trunk, anti_rotation, mobility, recovery, easy_erg, hard_erg, low_load_accessory, machine_supported, isometric, contact_risk

Decision shape:

```ts
scoreExerciseAgainstConstraints(exercise, constraints) → {
  decision: 'keep' | 'limit' | 'remove';
  matchedExposures: Exposure[];
  reason: string;
}
```

Rules:

1. Exposure on a constraint's `blockedExposures[]` → `remove`
2. Exposure on `limitedExposures[]` → `limit` (or `remove` based on severity)
3. No matched exposure → `keep`
4. Multiple constraints → most conservative decision wins
5. Recovery sessions are never modified (`project_uae_relevance_filter.md`)

---

## 12. Coach Update card rules

Source: `src/components/CoachUpdateCard.tsx`. Derived per render in `HomeScreenV2` from `buildWeeklyCoachUpdateFromConstraints({ weekStartISO, visibleWeek, baselineWeek, activeConstraints })`. The card MUST be derived live, not read from stale stored text.

### Format (concise, plan-driven)

```
Coach Update
Active issues:
  • Hammy pain — 7/10
  • Shoulder pain — 6/10

Avoid:
  Sprinting / max-speed running
  Heavy hinge / nordics / RDLs
  Pressing / overhead loading

Sub in:
  Easy bike / rower
  Lower body
  Trunk

Keep:
  Trunk, mobility, easy bike if pain-free.

Get this assessed by a physio.   [italic]

CTA: Update coach
```

### Rules

- Show on **every week affected** by active constraints (current AND future), not just current
- Long per-session "Sessions changed" / "Next week" lists live behind a **Show details** toggle (testID `coach-update-toggle-details`)
- Disappears when all constraints resolve
- Avoid-label semantic dedup: e.g. drop `Running` when `Sprinting / max-speed running` is present
- Region-aware substitution suggestions: hamstring → quad-dominant lower; shoulder → lower body strength; back → supported upper body

---

## 13. Coach reply style

Replies are produced by **one** central composer: `composeCoachAdjustmentReply` (`src/utils/coachReplyComposer.ts`). It accepts either the new plan-driven shape `{ plans, currentWeekAffected, futureWeekAffected, majorChangesSummary, headline? }` or the legacy `{ constraints, currentWeekChanges, nextWeekChanges, ... }` shape (the legacy shim derives plans on the fly). One reply, one composer — no stitching.

### Reply shape (max 2–4 short sections + closing)

1. **Headline** — main issue / severity ("Hammy 7/10 is too high for sprinting or heavy lower work.")
2. **Avoid + Sub in** (one block, two lines)
3. **Keep** ("Keep upper body, trunk, and easy bike.")
4. **Visible-program sentence** (one line, e.g. "This week is now adjusted." or "Nothing major left to change this week, but next week is now adjusted.")
5. **Closing** — physio nudge + "Hit Update coach when it improves, worsens, or clears." (same line, never a dangling appendix)

Forbidden:

- Walls of text
- Repeated sections / double headlines
- Long per-session bullet lists (those live on the card behind Show details)
- "Program unchanged" if the future projection actually changed
- Tacked-on future-week paragraph at the end

---

## 14. UI / state source-of-truth rules

| Concern                              | Single source of truth                                                |
|--------------------------------------|------------------------------------------------------------------------|
| Visible workout for any UI surface   | `projectVisibleDay` (via `useResolvedDay`)                            |
| Active constraints                   | `coachUpdatesStore.activeConstraints[]`                                |
| Coach Update card content            | `buildWeeklyCoachUpdateFromConstraints` → `ConstraintPlan[]`           |
| Coach reply text                     | `composeCoachAdjustmentReply`                                          |
| Per-session attribution              | `Workout.coachNotes[]`                                                 |
| Athlete-facing session names         | `resolveSessionDisplayName` (`project_canonical_naming_system.md`)     |
| Reset behaviour                      | `src/utils/resetCoach.ts` (`project_reset_coach_controls.md`)          |

UI variants share a single orchestration hook (`feedback_ui_variant_shared_hook.md`) — render files are presentation-only consumers.

**Glow** is reserved for completion / success only (`feedback_glow_for_completion_only.md`).

---

## 15. Known failure modes / things to watch

These are the ways this app has historically broken. Treat as failure modes to actively prevent:

1. **AI invents structural fields** — e.g. AI emits a `strengthPattern` rather than the engine. Always derive from the engine.
2. **Resolver renaming used as primary correction** — band-aid. Fix the planning logic.
3. **Stale `.js` siblings shadow `.ts`** — Metro and sucrase-node both prefer `.js` (`reference_stale_js_gotcha.md`).
4. **HomeScreen and DayWorkout disagree** — both must go through projection, never raw template.
5. **Card reads stored text instead of deriving live** — card must rebuild from constraints + visible vs baseline week.
6. **Coach claims "program updated" when nothing changed** — gated on `apply.applied.length > 0` + visible diff.
7. **LLM mutates injury flow** — must be deterministic. LLM only classifies intent.
8. **Legacy `/coach-chat` fires alongside structured handlers** — fenced; only conversational fallback.
9. **`pendingInjury` binds severity to wrong body part** — pendingInjury wins over activeInjury for severity-only replies (`project_pending_injury_priority.md`).
10. **State.rules undefined when constructing InjuryState from a test fixture** — use `Array.isArray(rules) ? [...rules] : []` defensively.
11. **Dormant screens ship as live** — `CurrentWeekScreen` + `CustomizeWorkoutScreen` are unreachable with broken behaviour; do not wire them without fixing.

---

## 16. App Store MVP checklist

Ship blockers — every item must be true:

- [x] Onboarding produces a usable week
- [x] HomeScreenV2 + DayWorkoutScreenV2 both go through `projectVisibleDay`
- [x] Universal exposure engine handles injury (sprint / heavy_hinge / pressing / etc.)
- [x] Pending-injury two-turn handshake works
- [x] Coach Update card derived live from `activeConstraints[]`
- [x] Reply composer single source of truth
- [x] ConstraintPlan layer shared by card / reply / validator
- [x] Reset controls (clear adjustments / clear chat / full reset) wired in Profile screen
- [x] Visible-diff invariant gates coach replies
- [ ] **Readiness MVP** — lightweight, optional signal that influences today's recommendation without blocking S&C flow
- [ ] **`coachNotes` rendered on HomeScreenV2 + DayWorkoutScreenV2** (V1 renders them; V2 does not)
- [ ] **Non-injury constraint live path** — producers exist; prove fatigue / soreness / busy week / missed session reach `activeConstraints[]` from real coach turns
- [ ] **Onboarding edit / re-run from Profile** — phase shift exists; broader edit surface unverified
- [ ] **App Store metadata** (icon, screenshots, name, description, privacy policy)
- [ ] **EAS build + submission pipeline**
- [ ] **Real-device shake-out** (iPhone + Android, real onboarding → full week)

---

## 17. Acceptance criteria for future changes

Every task — engineer, AI, or otherwise — must satisfy this **before being called done**:

1. **Live-path proof.** The user action in the actual app exercises the new logic. No isolated-helper pass-throughs.
2. **Files changed are listed.** Exact paths.
3. **Live screen wired.** Name the screen / component / hook that consumes the change.
4. **Runtime logs added or observed.** `[coach-flow]`, `[constraint-plan]`, `[exposure]`, `[visible-program]`, `[coach-update]`, `[reset]` — whichever is relevant.
5. **Tests cover the closest possible live path.** Helper tests are fine, but at least one test must hit the path the user takes. Memory: the QA harness is the canonical validation gate (`feedback_harness_is_source_of_truth.md`).
6. **Known limitations stated.** If something is a stub or only partial, say so.
7. **If the visible app would not change, say so explicitly.** Do not call a task complete based only on helper tests.

When an exercise is added / removed / renamed: 6-surface propagation (tags, pools, aliases, video, cues, load estimation) — never patch the video map alone (`feedback_exercise_registry_all_surfaces.md`).

---

## 18. File / module reference

| Concern                          | File                                                       |
|----------------------------------|------------------------------------------------------------|
| Live home screen                 | `src/screens/home/HomeScreen.tsx` (wraps `HomeScreenV2`)   |
| Live day workout                 | `src/screens/home/DayWorkoutScreen.tsx` (wraps `V2`)       |
| Live coach screen                | `src/screens/coach/CoachScreen.tsx`                        |
| Live profile screen              | `src/screens/profile/ProfileScreen.tsx`                    |
| Onboarding completion            | `src/screens/onboarding/CompleteScreen.tsx`                |
| Resolver                         | `src/utils/sessionResolver.ts`                             |
| Visible projection               | `src/utils/visibleProgramProjection.ts`                    |
| Exposure engine                  | `src/utils/exposureEngine.ts`                              |
| Train-around (injury) engine     | `src/utils/trainAroundEngine.ts`                           |
| Adjustment engine                | `src/utils/programAdjustmentEngine.ts`                     |
| Injury adjustment                | `src/utils/injuryAdjustmentEngine.ts`                      |
| Coach intent dispatcher          | `src/utils/coachIntentDispatcher.ts`                       |
| LLM intent classifier            | `src/utils/llmCoachIntentClassifier.ts`                    |
| Coach context packet             | `src/utils/coachContextPacket.ts`                          |
| Constraint plan layer            | `src/utils/constraintPlan.ts`                              |
| Reply composer                   | `src/utils/coachReplyComposer.ts`                          |
| Weekly coach update derivation   | `src/utils/weeklyCoachUpdate.ts`                           |
| Coach Update card                | `src/components/CoachUpdateCard.tsx`                       |
| Constraint store                 | `src/store/coachUpdatesStore.ts`                           |
| Profile / onboarding store       | `src/store/profileStore.ts`                                |
| Program store                    | `src/store/programStore.ts`                                |
| Calendar store                   | `src/store/calendarStore.ts`                               |
| Reset module                     | `src/utils/resetCoach.ts`                                  |
| Visible-diff invariant           | `src/utils/visibleWorkoutDiff.ts`                          |

---

## 19. Glossary

- **Bucket** — coarse body region used by the injury engine (`hamstring`, `shoulder`, `back`, etc.)
- **Exposure** — the universal S&C primitive (sprint, heavy_hinge, vertical_press, …) that constraints block / limit / allow
- **Constraint** — engine-side typed object (`Constraint` discriminated union) consumed by the exposure engine
- **ConstraintPlan** — UI-side derived layer; one per active constraint; carries `avoid / substituteWith / keep / advice` + the underlying engine `constraint` for validation
- **Visible projection** — the function that turns a resolved day into the day the athlete actually sees
- **Visible diff** — the snapshot+compare that proves the visible program actually changed before the coach claims it did
- **UAE** — Universal Adjustment Engine (legacy name for the apply-events pipeline)
