# L10 Acceptance — Run 2 (Sam's phone, 2026-07-24)

**Unit type:** diagnosis-first. Two STOP-for-review diagnoses (no code), five
mechanical fixes shipped tests-first.

**Process note (L10):** nothing here is claimed as PASS. Every code change below
has green source/unit tests and the typecheck ratchet still passes, but device
acceptance on Sam's phone is the merge gate and has not happened.

**Confirmed fixed from Run 1:** onboarding persistence — all answers survived,
correct phase, real program. (Root cause was the profile mirror; merged `e292904`.)

---

## PART A — STOP-FOR-REVIEW DIAGNOSES (no fixes)

### A1. "Properly sick" commit fails → honest "Couldn't log that just now"

**Symptom.** Athlete taps the readiness door "Properly sick" (severe /
`illness_recovery`, subtitle "nothing required this week"). Commit is rejected;
the honest error banner "Couldn't log that just now" shows.

**Repro preconditions.** Real generated **in-season** program, signup Friday
2026-07-24, **game Saturday**, current week Mon 2026-07-21 carrying a live
Saturday game anchor.

**Failing predicate.** `assertAcceptedVisibleLedgerEquivalence`
(`src/store/acceptedStateTransaction.ts`), one of two throw sites:
- `:349-366` — `evaluation.blockingViolations.length > 0` (§18 blocking finding), or
- `:368-388` — accepted-ledger signature divergence.

**Causal chain.**
1. `HomeScreenV2.tsx:800` `handleApplyWeekReadiness('sick_week', …)`
2. `useHomeScreen.ts:1399` → `executeProgramControlActionDurably(readinessActionForKind('sick_week', …))`
3. `weekReadinessActions.ts:51-60` → `set_illness_status`, severity `severe`, scope `current_week`
4. `programControlActions.ts:1209-1231` → `createTemporaryIllnessFact` → `transactTemporarySourceFact({operation:'create'})`
5. Severe illness composes a `type:'fatigue'` constraint (`temporarySourceFact.ts:557-607`) → a **new** fatigue constraint id → `scopedRegen = true` (`temporarySourceFactTransaction.ts:521-530`)
6. `commitDerivingSourceFactScopedRegen` (`:571`): `generateProgramLocally({microcycleLimit:1, todayISO: weekStart})` mints the illness_recovery week → `buildWeekScopedWorkoutOverlay` → `commitAcceptedStateTransaction({preserveExactAcceptedWorkouts:true, validateWeekStarts:[weekStart]})`
7. The preserve-exact branch (`acceptedStateTransaction.ts:483-509`) re-resolves the week via `rebaseAcceptedEffectiveWeek` → `resolveFinalVisibleSection18Week` (`acceptedEffectiveWeek.ts:134-142`), which **re-applies fixture replacement, G-1 protection, G+1 recovery and conditioning/recovery fill around the live Saturday anchor**, then re-evaluates §18.

**Why this state trips it.** An illness_recovery week is authored as an *empty*
week ("nothing required, minimums lifted"). But the current week still has a
**real Saturday game one day out**. The equivalence re-resolve reintroduces
anchor + G-1/G+1 protection + fill sessions the reduced contract never stamped,
so the re-resolved visible week either diverges in ledger signature (`:368`) or
raises a §18 blocking violation the reduced contract never authorised (`:349`).
The Saturday game is the specific aggravator. **Not** an elapsed-day artifact —
`rebaseAcceptedEffectiveWeek` is timeline-agnostic, resolving all 7 days.

**Verdict:** genuine domain rejection — the reduced week is *invalid* given the
live fixture. The banner is behaving correctly (honest, no leak); the outcome is
wrong because the illness_recovery week mode does not yet reconcile with a
protected game anchor inside the same week. **This is ownership work on the
`illness_recovery` week mode, not a copy or guard fix** — see
`[[illness-recovery-mode-boundary]]` / `[[move-conservation-readiness-unify]]`.
Deferred to the R16 door-unification / illness_recovery week-mode workstream,
not patched here.

**Confidence: Medium.** Rejecting function is High-confidence (sole gate in the
preserve-exact path, two reachable throws). *Which* predicate fires and the exact
§18 finding code need on-device evidence.

**Probe to confirm on device (not applied).** The gate already emits
`emitAthleteActionEvent(trace, 'visible_projection_result', { rejectionCodes,
rejectingBoundary:'assertAcceptedVisibleLedgerEquivalence' })`
(`acceptedStateTransaction.ts:350-361`) — enable `athleteActionDiagnostics` on
the device run to capture it. Raw-log alternative, matching the existing
`[coach-mutation-transaction]` tag style: a
`logger.warn('[deriving-scoped-regen] §18 equivalence rejected', { weekStart,
blockingViolations, persisted, visible })` immediately before both throws.

### A2. Raw "The deterministic executor did not apply a candidate." on a Wednesday day-flow

**Symptom.** A Wednesday session day-flow surfaced the literal internal string
"The deterministic executor did not apply a candidate." to the athlete.

**Mechanism.**
1. `PlanChangeSheet.tsx:205-224` → a Wednesday `move_session`/`bin_session` → `executeProgramControlActionDurably`
2. `programControlActions.ts:1362-1379` durable-session branch: `runCoachMutationTransaction({ …, didApply: (r) => r.ok && r.changedProgram })`
3. A legitimate **no-op** move/bin returns `changedProgram:false` → `didApply` returns false
4. `coachMutationTransaction.ts:222-247`: `changed` is false (no accepted-state change) → route `coach_mutation_not_applied`, `reason` = the **line-244 diagnostic string**
5. **Leak:** `programControlActions.ts:1385-1387` returned `transaction.reason` **verbatim** as the user-facing `message` → `PlanChangeSheet.tsx:273-277` rendered it as the result step.

**Verdict:** two distinct issues folded into one symptom — (i) a no-op day-flow
that should say something friendly, and (ii) an internal diagnostic leaking to
the UI. The leak (ii) is a copy-safety defect and is **fixed mechanically below
(fix e)**. The underlying *why the move was a no-op* is data-dependent (moving a
session to a target that resolves to the same week, or binning a day the
resolver already treats as rest) and is not itself a bug — it correctly changed
nothing. **Confidence: High** for the mechanism and the leak path.

### A3. Related-or-not verdict: **INDEPENDENT**

Both pass through `runCoachMutationTransaction`, but hit different branches for
different reasons:

| | A1 "Properly sick" | A2 Wednesday day-flow |
|---|---|---|
| `didApply` | hardcoded `() => true` | `r.ok && r.changedProgram` → **false** |
| Branch | catch after a **thrown** §18 verification error (`coachMutationTransaction.ts:383`) | the **`!didApply`** early-return (`:222`), no exception |
| Route | `coach_mutation_post_apply_verification_failed` | `coach_mutation_not_applied` (line-244 string) |
| Root cause | reduced illness week can't reconcile with a live Saturday game anchor | executor legitimately made no material change |
| Surface | honest banner (correct behaviour, wrong outcome) | **raw string leaked** (copy defect) |

**Evidence they are not the same bug:** the line-244 string is reachable only
when `didApply` returns false; A1's `didApply` is hardcoded true, so A1 can never
produce it, and A2 never enters the §18 equivalence gate (its executor returned
before any commit). Fixing one does not fix the other.

---

## PART B — CONTENT OWNERSHIP TRACE (STOP-for-review, no fix)

### B1. Two-author picture

- **CURATED (Sam):** `src/data/exerciseCues.ts` (form cues, keyed by exact name)
  + `src/data/exerciseTags.ts` (movement family) + the load anchors in
  `src/utils/loadEstimation.ts` (`EXERCISE_LOAD_MAP`, `EXERCISE_ALIASES`).
  Provenance banner: `exerciseCues.ts:11`.
- **GENERATOR:** produces the workout object — `exercise.exercise.name`,
  `exercise.notes` (the "Heavy but crisp…" prose), sets/reps, weight,
  `workoutType`, `coachNotes`.

**The intended model (curated owns all athlete-visible words; generation
provides structure only) is NOT how the screen is wired.**

### B2. String → source map (DayWorkoutScreenV2.tsx; Classic mirrors it)

| String | Rendered at | Author |
|---|---|---|
| Header title / subtitle | `:1049-1078` ← `deriveVisibleWorkoutIdentity` / `workoutType` | GENERATOR |
| Coach update banner + bullets | `CoachNoteBanner:1350-1385` ← `workout.coachNotes` | GENERATOR |
| Session description | `:1128-1135` ← `workout.description` | GENERATOR |
| **Exercise NAME** | `:1580-1581` ← `exercise.exercise.name` (`displayExerciseName` cosmetic only) | **GENERATOR** |
| Sets × Reps / Weight | `:1620` / `:1655` | GENERATOR (weight computed from a curated anchor at build time — see B3) |
| **Per-exercise note ("Heavy but crisp…")** | `:1670-1677` ← `cleanNotes(exercise.notes)` | **GENERATOR** |
| **Form cues (primary+secondary)** | `:1680-1688` → `CueToggle:2030-2048` ← `buildCueText` | **CURATED** |
| Video modal title | `ExerciseVideoModal:59,119` | GENERATOR name (cosmetic) |

### B3. The alias-map bypass — "Farmers Carry" → generic cue + wrong load

The canonical resolver is `resolveExerciseName` (`loadEstimation.ts:657-671`),
backed by `EXERCISE_ALIASES`. Two independent misses:

- **The cue path never calls it.** `dayWorkoutHelpers.ts:12-14` looks up
  `EXERCISE_TAGS[name]` and `getExerciseCue(name, movement)` on the **raw
  generator string** — no canonicalisation. For `"Farmers Carry"`: tags miss
  (curated key is `'Farmer Carry'`), exact + case-insensitive cue miss, family
  fallback skipped → falls to the generic branch `exerciseCues.ts:128-131`
  ("Control the movement." / "Stay tight through the full range."). Sam's
  authored `'Farmer Carry'` cue ("Shoulders packed, walk tall." / "Weight shown
  is per hand.") is never reached.
- **The resolver couldn't rescue it anyway.** `resolveExerciseName("Farmers
  Carry")` misses (`EXERCISE_ALIASES` has no `farmers carry`; the trailing-`s`
  strip doesn't fire on a `y` ending) → the load anchor `'Farmer Carry' →
  {anchor:'bench', ratio:0.355}` is bypassed, so the per-hand load is wrong.

The un-curated spelling literal `'Farmers Carry'` also lives at
`AddExerciseModal.tsx:38` (a quick-pick chip). **Root cause: the generator may
emit an exercise name that is not a curated key, and no layer canonicalises it
back onto the curated vocabulary before cue/tag/load lookup.**

### B4. Lead-vs-cues inversion

Generated note leads unconditionally (`:1670-1677`); the curated cue is wrapped
in a disclosure that starts **collapsed whenever a note exists**
(`:1680-1688`, `expanded={displayNotes ? !!expandedCues[id] : true}`;
`expandedCues` defaults `{}`). So generator prose owns the lead and curated words
are demoted behind "▸ Form cues", gated on the generator's own output.

### B5. Verdict — this IS the 7-question ownership case (escalation, do NOT phrase-patch)

The AI/semantic layer is not even involved; a later render/lookup layer keys off
generator strings instead of the curated vocabulary. That is the escalation
trigger. **Do not add a `'farmers carry'` alias as the fix** — it treats one
symptom of an unbounded class.

1. **Source of truth?** Split. Curated truth is keyed by canonical name; the
   runtime truth on screen is the generator's free-text `exercise.name` /
   `exercise.notes`, free to diverge from every curated key.
2. **How many name representations?** ≥4 — generator name, `EXERCISE_CUES` key,
   `EXERCISE_TAGS` key, `EXERCISE_ALIASES`/`EXERCISE_LOAD_MAP` key — plus the
   cosmetic `formatExerciseDisplayName`. Cue: two competing prose slots per card
   (generator `notes` vs curated cue).
3. **Where reinterpreted?** generator emits off-vocabulary name →
   `dayWorkoutHelpers.ts:12-14` looks up on raw name (no canonicalisation) →
   `getExerciseCue` degrades to generic → `resolveExerciseName` drops the anchor
   → render layer lets `notes` outrank the cue.
4. **Who should own it?** The **curated layer**. Every athlete-visible word
   resolves through one canonicalisation boundary onto Sam's vocabulary; the
   generator references a canonical key, not free text. No curated entry ⇒
   build-time failure, not a silent generic.
5. **Simpler architecture?** Canonicalise the generator name **once at ingress**
   into the workout object (or force the generator to select a canonical key), so
   downstream only ever sees canonical keys and the generic branch becomes
   unreachable. Make the curated cue primary; demote generator notes to a clearly
   subordinate slot. 4 name representations → 1; 2 cue slots → 1 curated-owned.
6. **Retire vs patch?** *Retire:* the raw-string cue/tag lookup at
   `dayWorkoutHelpers.ts:12-14`; the free `AddExerciseModal.tsx:38` literal; any
   generator name emission that isn't a canonical key. *Do NOT* add an alias, a
   `getExerciseCue` special-case, or a phrase handler.
7. **Tests that prove the boundary?** (a) vocabulary-closure: every emittable
   generator name ∈ `keys(EXERCISE_CUES) ∪ EXERCISE_ALIASES` or build fails;
   (b) no-generic-in-product: `getExerciseCue(canonicalName)` never returns the
   generic pair; (c) anchor-resolves: `resolveExerciseName(generatorName)` ∈
   `EXERCISE_LOAD_MAP` (or explicit BW); (d) ordering: curated cue renders and
   is not collapsed behind a note-gated disclosure. A `"Farmers Carry"` fixture
   is the regression case for all four.

**Recommendation:** open this as an ownership unit before writing code; it
requires the 7-question reassessment approval per AGENTS.md, exactly as
`[[l10-findings-a1-a6]]` A3a demanded. Not started here.

---

## PART C — MECHANICAL FIXES SHIPPED (tests-first, this unit)

All five were requested as mechanical. Four are shipped with green tests; **(b)
turned out NOT to be mechanical** and is escalated below rather than faked.

### (c) Cue primary/secondary joining punctuation — SHIPPED
New pure `joinCueClauses` in `dayWorkoutHelpers.ts`; `buildCueText` routes
through it. A primary without terminal punctuation (or with a dangling
`,`/`;`/`:`) is promoted to a full stop before the secondary, so the two authored
clauses never concatenate mid-sentence. Test: `npm run test:cue-join` (6/6).

### (e) Raw internal reason must never reach the athlete — SHIPPED
New `athleteSafeRefusal(reason)` in `planChangeRefusalCopy.ts` (the existing
single owner of athlete-facing refusal copy). Athlete-framed domain sentences
pass through unchanged; a missing reason, a snake_case route code, or any
internal diagnostic (executor / candidate / fingerprint / accepted-state /
transaction / "requires the durable … transaction") collapses to one honest
fallback. Wired at the A2 leak site (`programControlActions.ts:1385-1387`). Test:
`npm run test:athlete-safe-refusal` (10/10). No test asserted on the old raw
string, so nothing regressed.

### (a) "Done" bar must never render on selection-only screens — SHIPPED
Root cause: `KeyboardSafeArea` used "no footer ⇒ show Done bar" as a proxy for
"has an input to dismiss". That proxy is wrong for auto-advance selection steps
(`OnboardingLayout hideFooter`), which have no text input. Added an explicit
`hasTextInput` signal (default `true`, so every existing input screen keeps its
exit); the accessory now renders only when `!footer && hasTextInput`.
`OnboardingLayout` passes `hasTextInput={!hideFooter}`. Contract: `npm run
test:keyboard-convention` (31/31, new section [5]).

### (d) Demo video fills its modal frame — SHIPPED
Root cause: `playerFrame` pinned `width:'100%'` **and** `aspectRatio:9/16` **and**
`maxHeight:560`. When `maxHeight` binds on a shorter phone the explicit width
wins, the box stops being 9:16 (400×560), and the 9:16 Short letterboxes inside
it. Replaced with an aspect-locked box (`height:560` + `aspectRatio:9/16` +
`alignSelf:'center'`) so the WebView box always equals the video. Contract:
`npm run test:video-modal-fill` (7/7). *Device note:* on the shortest phones the
560 height may want trimming, and the centred portrait player sits in the 400
modal with modest side margin — final visual polish is part of Sam's device pass.

### (b) Accessory flush to the keypad, no gap — NOT MECHANICAL → escalated
The gap is **`react-native-keyboard-controller`'s deliberate iOS-26
floating-pill toolbar**: `KEYBOARD_HAS_ROUNDED_CORNERS` (`Platform.OS==='ios' &&
Version>=26`) switches the toolbar to `styles.floating` (rounded pill,
`alignSelf:center`, side margins of `insets+16`) with `OPENED_OFFSET = -11`. On
older iOS / Android it is already flush (`OPENED_OFFSET = 0`, full-width). The
float is keyed on `Platform.Version`, **not on any `KeyboardToolbar` prop**, so
"flush, no gap" cannot be reached through the shared accessory's props. Making it
flush means either (i) accepting the OS-native floating look, or (ii) replacing
`KeyboardDoneAccessory`'s `KeyboardToolbar` with a custom flush accessory — which
is a design decision and would introduce a new keyboard primitive the convention
deliberately forbids outside the owner files. **Not shipped as a blind native
offset hack.** Needs a product decision from Sam:
- **Option 1:** accept the iOS-26 floating pill (Apple-native direction).
- **Option 2:** custom full-width flush accessory inside
  `KeyboardDoneAccessory.tsx` (contained to the one owner, but net-new UI).

Recommend Option 1 unless Sam specifically wants the flush full-width bar.

---

## PART D — SCHEDULED, NOT NEW

Recorded so they are not re-diagnosed as fresh defects:

- **Pre-signup catch-up prompt = E6** — owned by the parked *delivered-vs-remaining
  Phase 3* workstream.
- **Refusal copy tone** — a **Group D** pass item (tone, not correctness). Fix (e)
  handles the *safety* leak; the *tone* polish stays with Group D.
- **Add/swap UX** — **Phase 5** preview work.

---

## PART E — NOT COVERED (L2 mandatory)

- **A1 illness_recovery ↔ live game-anchor reconciliation** — diagnosed only.
  It is ownership work on the illness_recovery week mode (the reduced week can't
  survive the §18 equivalence re-resolve around a Saturday game). Belongs to the
  R16 door-unification / week-mode workstream; needs the abstraction decided
  before code. See `[[r16-door-routing-design]]`,
  `[[move-conservation-readiness-unify]]`.
- **Part B content ownership** — diagnosed only; requires the 7-question
  reassessment + approval before any code. No alias/phrase patch applied.
- **(b) keyboard flushness** — escalated to a product decision (above); no code.
- **Device acceptance** — none of the shipped fixes (a/c/d/e) is claimed as PASS;
  Sam's phone is the gate.
- **The A2 no-op root cause** — *why* that specific Wednesday move resolved to no
  change was not chased to the exact athlete action (data-dependent; the no-op is
  correct behaviour, only the leak was a defect). Probe suggested in A2, not run.
- **Classic `DayWorkoutScreen.tsx`** — the cue-join fix (c) flows through the
  shared helper so both renderers benefit, but the Part B ownership/ordering
  defects in Classic are untouched (same as V2 — deferred with Part B).
- **`CoachScreen` message composer** `KeyboardStickyView` — still outside the
  keyboard convention (pre-existing NOT-COVERED, unchanged).

## PART F — PRE-EXISTING FAILURES (do not misattribute)

`npm run test:plan-change-producer` → **238 passed, 23 failed** on clean `main`
(verified by stashing this unit's changes and re-running — identical count). All
23 are `[19] Team Training`-preserving-replacement failures, unrelated to this
unit. The typecheck ratchet (`test:compile`) still PASSES with no regressed file.

## New tests added this unit
- `test:cue-join` — cue join punctuation (6)
- `test:athlete-safe-refusal` — internal-reason display gate (10)
- `test:video-modal-fill` — player-frame aspect-lock contract (7)
- `test:keyboard-convention` — new section [5], Done-bar gating (now 31)
