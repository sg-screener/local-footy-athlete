# Dead Affordance Inventory — 2026-07-23

Read-only, no code changes. Feeds Master Plan Phase 1.6 (X1: "sweep the whole
app for any control that does nothing... every visible control either works
or is removed/hidden"). Per Process Law L1, scope is the whole reachable app
as a new athlete experiences it — onboarding, Program, Workout, Profile,
Coach — not just the week-editing contract.

**Method:** static source trace, not a device sweep. Every `onPress`/
`TouchableOpacity`/`Pressable`/menu-option/sheet-option in every reachable
screen was enumerated, then its handler traced through at least one level of
called functions to determine whether it mutates real, persisted state, only
navigates, or is a no-op. This is necessary but not sufficient evidence per
Process Law L4 ("device is arbiter") — see NOT COVERED at the end for
exactly what a device pass would need to confirm or refute.

**Live navigator ground truth** (re-confirmed this session directly from
`src/navigation/AppNavigator.tsx`, `RootNavigator.tsx`, `OnboardingNavigator.tsx`):
three tabs — Program (`Home` → `HomeScreenV2`, `DayWorkout` →
`DayWorkoutScreenV2`, both via a hardcoded `DESIGN_VERSION='v2'` flag),
Coach (`CoachScreen`), Profile (`Profile`, `FAQ`, `Privacy`, `Terms`) — plus
the 21-screen onboarding stack shown before `isOnboardingComplete`. No other
screen in the repository is reachable from these roots.

---

## Executive summary — headline findings

1. **G7/G8/G9 (busy-week, away-days, equipment-change all "do nothing") share
   one root cause, not three.** `handleApplyBusyWeekReduce`,
   `handleApplyAwayDays`, and `handleApplyEquipmentPreset`
   (`src/screens/home/useHomeScreen.ts:1364,1449,1321`) all route through
   `commitTemporarySourceFactSet` (`src/store/temporarySourceFactTransaction.ts:467-589`),
   which unconditionally passes `skipConstraintProjection: true` into the
   accepted-state transaction — so `canonicaliseAcceptedStateCandidate`'s
   constraint-projection branch (`src/store/programStore.ts:747,776`) never
   fires. A Coach Note/badge is recorded, but the already-generated visible
   week is never re-validated or rewritten. This is corroborated by an
   explicit test assertion (`src/__tests__/equipmentScheduleFactTransactionTests.ts:288-301`:
   "temporary facts never modify composition-base fingerprint... away writes
   no date overrides") — i.e. this is designed to matter only on a future
   full rebuild, and nothing today triggers that rebuild. One fix (make
   these three flows either trigger a real rebuild or stop pretending to)
   closes all three dogfood findings at once.
2. **F5 (game-day "Save and finish" unresponsive) is a silent-swallow bug,
   not a game-day-specific code path.** `SessionFeedbackPanel.tsx:520`:
   `if (!result.ok) return;` — ANY failure from
   `commitSessionOutcomeTransaction` is silently dropped with zero visible
   feedback, on any day type. Game day is simply the most likely day type to
   trigger one of several identity-mismatch throws (`component_identity_mismatch`,
   `incomplete_component_outcomes`, `workout_identity_mismatch`,
   `weekly_card_detail_semantic_mismatch` — `src/store/sessionOutcomeTransaction.ts`,
   `src/store/coachMutationTransaction.ts:348,647-654`) because fixture-linked
   identity fields are more likely to diverge between UI-time and commit-time
   re-derivation. The fix is the missing failure UI at line 520, not
   day-type branching — that would only patch the symptom on game day and
   leave the same silent-swallow live for gym/TT days too.
3. **F6 (mid-session "pause affected training" — "no visible effect") is a
   real, persisted mutation that just never triggers a re-render of the
   already-rendered session.** `GuidedInjuryFlowSheet`'s "Pause affected
   training"/"Apply training adjustment" buttons DO call a genuine durable
   transaction (`executeProgramControlActionDurably({type:'set_injury_modifier'})`
   → `createOrUpdateInjuryEpisode`, `src/store/injuryEpisodeTransaction.ts:613-673`)
   that persists an injury episode. But every branch of `set_injury_modifier`
   hardcodes `requiresRebuild: false` (`src/utils/programControlActions.ts:1032,746-753`),
   and the injury-episode transaction contains no rebuild/invalidate call at
   all — so today's already-rendered exercise list never regenerates to
   reflect the new constraint. Data is recorded; nothing visible changes.
   This is a different, more precise diagnosis than "does nothing" — the fix
   is wiring a rebuild trigger, not building the mutation from scratch. This
   same `set_injury_modifier` path (and its `requiresRebuild:false` gap) is
   shared by three separate entry points: the mid-session injury flow
   (`DayWorkoutScreenV2.tsx:618-662`), the week-level readiness→injury entry
   (`useHomeScreen.ts:1563-1605`), and the Coach Notes "Update injury" action
   — fixing the shared function fixes all three.
4. **F1 (catch-up prompt — "every option marks Done") does not reproduce in
   current source.** Each option ("Did it" / "Missed it" / "Move it
   forward" / "Skip it", `HomeScreenV2.tsx:2024-2027`) now maps to a
   distinct real transaction (`completion:'full'`, `completion:'skipped'`,
   `move_session`, `bin_session` respectively) — not a uniform Done. This
   contradicts the dogfood observation. Flagging as a genuine discrepancy,
   not resolving it in either direction: either the dogfood run predates a
   fix, or the *rendering* of "done" status downstream (in
   `useResolvedWeek`/`useSchedule`, not traced by this sweep) still shows
   "Done" regardless of which transaction actually committed. Needs a fresh
   device pass before this item is closed or reopened.
5. **A previously-unknown orphaned required field: `SessionDurationScreen`
   is unreachable, and `sessionDurationMinutes` is still a required program-
   generation field.** Same class of bug as the already-known
   `TeamTrainingIntensityScreen` orphan (registered in the onboarding stack,
   never navigated to — `PreferredTrainingDaysScreen` skips straight to
   `GymExperience`), but higher severity: `sessionDurationMinutes` is listed
   in `REQUIRED_PROGRAM_GEN_PROFILE_FIELDS`
   (`src/services/api/generateProgram.ts:751-770`), and the only other place
   that could set it (`ReviewScreen`'s "Session Length" edit row) is itself
   gated on the field already being truthy — so it never renders either.
   Every real onboarding completion today generates a program with this
   "required" field silently `undefined`. The diagnostic
   (`getProgramGenerationProfileFieldDiagnostics`,
   `generateProgram.ts:1165-1173`) only logs a dev-build warning — nothing
   surfaces to a production user or blocks generation. This is not a control
   that "does nothing when tapped" (the usual X1 shape) — it's a control
   nobody can ever tap. Recommend flagging to Sam as its own item, not
   folding it silently into the generic hide/fix sweep, since "hide it" isn't
   a valid option here (the data is still needed) and "fix it" means
   restoring a reachable entry point, not deleting a dead button.
6. **A second, larger unreachable surface: the entire Classic-design
   component tree.** `HomeScreen.tsx`/`DayWorkoutScreen.tsx` hardcode
   `DESIGN_VERSION: DesignVersion = 'v2'` (not a runtime toggle currently),
   so `HomeScreenClassic()` (~1450 lines) and `DayWorkoutScreenClassic()`
   (~1050 lines) — and everything only reachable through them, including
   `HomeQuickActionSheet.tsx` and its "injury"/"missing_equipment" quick-
   action entries — never render in the live app. `GuidedInjuryFlowSheet`
   and `EquipmentLimitationSheet` are NOT dead overall (HomeScreenV2 opens
   them directly through its own live entry points), only this one
   Classic-only path to them is. Not individually inventoried below (control-
   by-control tracing of genuinely unreachable code isn't useful — same
   reasoning applied to the legacy Program/Workout/Journal screens in this
   session's earlier copy audit) but flagged here since it's a large amount
   of dead code, not a rounding error.

---

## Unreachable screens / dead-code component trees (not enumerated per-control)

| Item | Status | Why | Note |
|---|---|---|---|
| `src/screens/home/HomeScreenClassic()` (in `HomeScreen.tsx`) | UNREACHABLE | `DESIGN_VERSION` hardcoded `'v2'` (`HomeScreen.tsx:52-57`) | Large (~1450-line) fully-built alternate implementation; every control in it is unreachable |
| `src/screens/home/DayWorkoutScreenClassic()` (in `DayWorkoutScreen.tsx`) | UNREACHABLE | Same hardcoded flag | ~1050-line alternate implementation |
| `src/screens/home/HomeQuickActionSheet.tsx` | UNREACHABLE | Only mounted from `HomeScreenClassic()` (`HomeScreen.tsx:456`) | Its "injury" and "missing_equipment" quick-actions render `GuidedInjuryFlowSheet`/`EquipmentLimitationSheet` — those components are separately live via other entry points, only this path is dead |
| `src/screens/profile/FeedbackScreen.tsx` | UNREACHABLE | Never imported/registered in `AppNavigator.tsx`; exported from `profile/index.ts:18` but orphaned | Already tracked — Group D item D1 (`docs/GROUPD_EXECUTION_PLAN_2026-07-23.md`) rewires this screen rather than building new |
| `src/screens/onboarding/TeamTrainingIntensityScreen.tsx` | UNREACHABLE | Registered in `OnboardingNavigator.tsx:57`; `TeamTrainingDaysScreen.tsx:51` navigates to `'TeamTrainingDuration'`, never `'TeamTrainingIntensity'`; no other caller exists | Low severity — `TeamTrainingDurationScreen` absorbed both duration AND intensity questions onto one screen (confirmed by its own code comment), so nothing is missing functionally, just dead-code cleanup |
| `src/screens/onboarding/SessionDurationScreen.tsx` | UNREACHABLE | Registered in `OnboardingNavigator.tsx:60`; zero callers navigate to `'SessionDuration'` anywhere in `src` | **Elevated severity — see Executive Summary #5.** `sessionDurationMinutes` is a required generation field silently never collected |
| `src/screens/program/*.tsx` (9 files: ProgramListScreen, ProgramDetailScreen, ProgramCreateScreen, ProgramEditScreen, WorkoutDetailScreen, CustomizeWorkoutScreen, MicrocycleDetailScreen, ExerciseLibraryScreen, ExerciseDetailScreen) | UNREACHABLE | Not referenced by any navigator (confirmed this session and in the 2026-07-23 copy audit) | Legacy pre-V2 screen set |
| `src/screens/workout/*.tsx` (6 files: WorkoutLoggerScreen, CompletionSummary, RestTimer, SetLoggerRow, ExerciseVideoPlayer) | UNREACHABLE | Same | Legacy pre-V2 screen set |
| `src/screens/journal/*.tsx` (8 files: JournalHomeScreen, LogWorkoutScreen, WorkoutHistoryScreen, WorkoutHistoryDetailScreen, PersonalRecordsScreen, ProgressChartsScreen, WeeklyReviewScreen, ExerciseHistoryScreen) | UNREACHABLE | Same | Superseded by the approved `docs/JOURNAL_DESIGN_2026-07-23.md` rebuild, Master Plan Phase 5C |

---

## Control inventory — reachable screens

Verdict legend: **WORKS** (traced to a real state mutation or genuine
effect) · **WORKS-NAVIGATION-ONLY** (opens a screen/sheet — real, but the
terminal action is a separate row) · **NO-OP-DEAD** (handler runs but
produces no persisted or visible effect) · **PARTIAL** (some branches work,
some don't, or data is recorded but nothing visible changes) ·
**UNCLEAR-NEEDS-DEVICE-CHECK** (source trace is ambiguous or contradicts a
prior device observation) · **UNREACHABLE** (the control/screen itself can't
be reached).

### Onboarding (21 screens registered; 19 reachable, 2 unreachable — see table above for the 2)

| Screen | Control | File:line | Expected | Actual wiring | Verdict |
|---|---|---|---|---|---|
| Welcome | "Build My Program →" | WelcomeScreen.tsx:219-230 (handler 119) | Advance to Name | `navigation.navigate('Name')` | WORKS |
| Welcome | "Skip onboarding (dev)" | WelcomeScreen.tsx:255-275 (handler 128) | Dev escape hatch | Gated by `isDevOnboardingSkipEnabled()` (`__DEV__`/non-production check) — doesn't render in Release/TestFlight | WORKS (correctly gated, not a production concern) |
| Name | Name input + Continue | NameScreen.tsx:65-77, 30-36 | Save name, advance | `updateOnboardingData({firstName})` + `navigate('BodyMeasurements')` | WORKS |
| BodyMeasurements | Height/Weight inputs + Continue | BodyMeasurementsScreen.tsx:102-148, 44-52 | Save, advance | `updateOnboardingData({heightCm,weightKg})` + `navigate('Position')` | WORKS |
| Position | Role tiles | PositionScreen.tsx:78-92 (handler 41) | Save role, auto-advance | `updateOnboardingData({position})` + `navigate('Motivation')` | WORKS |
| Motivation | Goal tiles (max 3), Other input, Continue | MotivationScreen.tsx:122-153, 68-78 | Save goals, advance | `updateOnboardingData({motivation})` + `navigate('SeasonPhase')` | WORKS |
| SeasonPhase | Phase tiles | SeasonPhaseScreen.tsx:159-198 (handler 116) | Save phase, branch correctly | `updateOnboardingData({seasonPhase})`; branches Off-season→TrainingCommitment, Pre-season→TeamTrainingDays, else→GameDay (121-127) — all three legs verified sound | WORKS |
| GameDay | Day tiles | GameDayScreen.tsx:71-85 (handler 41) | Save, advance | `updateOnboardingData({gameDay})` + `navigate('TeamTrainingDays')` | WORKS |
| TeamTrainingDays | Day grid, Continue | TeamTrainingDaysScreen.tsx:80, 45-53 | Save, advance to Duration | `updateOnboardingData({...})` + `navigate('TeamTrainingDuration')` | WORKS |
| TeamTrainingDuration | Duration chips, Intensity chips, Continue | TeamTrainingDurationScreen.tsx:110-150, 72-79 | Save both, advance | `updateOnboardingData({teamTrainingDuration, teamTrainingIntensity})` + `navigate('TrainingCommitment')` — this screen absorbed the orphaned Intensity screen's job | WORKS |
| TrainingCommitment | Day-count tiles, "Not sure?" pill, Continue | TrainingCommitmentScreen.tsx:96-126, 62-66 | Save days/week or distinct unsure-default | `updateOnboardingData({trainingDaysPerWeek, trainingDaysUnsure})` — "Not sure" sets a genuinely distinct value (3, unsure:true), not decorative | WORKS |
| PreferredTrainingDays | Day grid (capped), Continue | PreferredTrainingDaysScreen.tsx:128, 80-94 | Save, advance | `updateOnboardingData(...)` + `navigate('GymExperience')` (skips SessionDuration — see unreachable table) | WORKS |
| GymExperience | Experience tiles | GymExperienceScreen.tsx:94-118 (handler 60) | Save, branch | 'Complete beginner'→ConditioningLevel, else→SquatStrength — both legs reconverge at SprintExposure | WORKS |
| SquatStrength | Strength tiles | SquatStrengthScreen.tsx:84-98 (handler 47) | Save, advance | `updateOnboardingData({squatStrength})` + `navigate('BenchStrength')` | WORKS |
| BenchStrength | Strength tiles | BenchStrengthScreen.tsx:79-93 (handler 42) | Save, advance | `navigate('ConditioningLevel')` | WORKS |
| ConditioningLevel | Conditioning tiles | ConditioningLevelScreen.tsx:99-111 (handler 62) | Save, advance | `navigate('SprintExposure')` | WORKS |
| SprintExposure | Sprint tiles | SprintExposureScreen.tsx:88-110 (handler 51) | Save, advance | `navigate('RecentTrainingLoad')` | WORKS |
| RecentTrainingLoad | Load tiles | RecentTrainingLoadScreen.tsx:92-104 (handler 55) | Save, advance | `navigate('Injuries')` | WORKS |
| Injuries | Yes/No, area chips, custom input, severity, triggers (max 3), notes, "No issues after all", Next/Continue | InjuriesScreen.tsx:319-614, 244-269 | Capture per-injury detail, advance | All wired to local `injuryDetails` map correctly keyed per area; "No issues after all" is a distinct bail-out (`injuries:[]`), not decorative | WORKS |
| Review | Per-row "Edit" links (~15 fields), "Generate My Program" | ReviewScreen.tsx:398-410, 364-369 | Jump to source screen (values preserved), advance to generation | `navigate(screen)` pops back to the existing mounted instance (values preserved); `navigate('Complete')` | WORKS |
| Complete | Auto-generation, "Start your program →", "Try Again" | CompleteScreen.tsx:253-347, 561-563, 452 | Generate program, finish onboarding, retry on error | `generateProgramFromProfile`→fallback to `DEFAULT_PROGRAM`; `completeOnboarding()` flips `isOnboardingComplete`, `RootNavigator` swaps to `AppNavigator`; retry re-invokes generation | WORKS |

### Program tab — `HomeScreenV2.tsx`

| Control | File:line | Expected | Actual wiring | Verdict |
|---|---|---|---|---|
| Previous/Next week chevrons | HomeScreenV2.tsx:358-402 | Navigate weeks | `goToPrev()`/`goToNext()` (useHomeScreen.ts:1072,1076) | WORKS |
| Week badge / "THIS WEEK" tap | HomeScreenV2.tsx:368-391 | Jump to current week | `goToThisWeek()`; correctly no-ops when already there | WORKS |
| Rebuild icon → "Rebuild week" | HomeScreenV2.tsx:403-416, 2420-2424 | Regenerate the week | `runRebuild()` → `generateProgramFromProfile` + `commitRebuiltProgram` | WORKS |
| Missed-session: "Did it" / "Missed it" / "Move it forward" / "Skip it" | HomeScreenV2.tsx:2024-2027 | Distinct outcomes per option | Distinct transactions: `completion:'full'`, `completion:'skipped'`, `move_session`, `bin_session` — see Executive Summary #4 for the F1 discrepancy | WORKS (source) / UNCLEAR-NEEDS-DEVICE-CHECK (rendered "done" status downstream not traced) |
| "Repeat this week into next week" / "Restore previous target week" | HomeScreenV2.tsx:608-616, 583-590 | Copy week forward / undo | `repeatWeekIntoNextWeek` real overlay transaction; `clearReversibleAdjustment` | WORKS (product-prominence question is a separate Sam-gate item, F7, not brokenness) |
| "No game this week — add one" | HomeScreenV2.tsx:620-638 | Add a game day | `rebuildForGameChange` real fixture-mutation transaction | WORKS |
| "Busy or away this week?" card → "Busy week — keep me training, go lighter" | HomeScreenV2.tsx:642-658, 2324-2328 | Session load reduced this week | Creates a `busy_week` fact with no `unavailableDates`/`maxSessions`; `skipConstraintProjection:true` means the visible week is never re-validated | **NO-OP-DEAD** — matches dogfood G7; see Executive Summary #1 |
| → "Away some days — clear them" / "Clear N days" | HomeScreenV2.tsx:2330-2333, 2372-2377 | Selected days become Rest | Real `unavailableDates` fact recorded, but same `skipConstraintProjection:true` gap — already-materialized week never re-validated | **NO-OP-DEAD** — matches dogfood G8; see Executive Summary #1 |
| "I'm not 100%" card → readiness leaf options (tired/sore/sleep/cooked/sniffle/sick) | HomeScreenV2.tsx:662-693, 2216-2281 | Apply readiness adjustment | `executeProgramControlActionDurably` — real, per shipped illness/readiness work | WORKS |
| → "Clear adjustment — I'm good now" | HomeScreenV2.tsx:2170-2180 | Clear active readiness fact | `clear_fatigue_status` durable action | WORKS |
| → "Yes — make today lighter" / "No thanks" | HomeScreenV2.tsx:2141-2153 | Trim today / decline | `applyLighterDayForToday` real immediate trim; decline correctly no-ops (nothing should change) | WORKS |
| → "Something hurts" (readiness → injury) | HomeScreenV2.tsx:2202-2208 | Open injury flow | Opens `GuidedInjuryFlowSheet` | WORKS-NAVIGATION-ONLY (terminal action — see injury-sheet table below) |
| "Missing equipment?" card → preset apply | HomeScreenV2.tsx:695-716, 857-860 | Sessions adapt to equipment | Same `skipConstraintProjection:true` gap as busy/away | **NO-OP-DEAD** — matches dogfood G9; see Executive Summary #1 |
| Practice-match / "Add a pre-season practice match" | HomeScreenV2.tsx:718-741 | Open game-day action or add flow | Real fixture-mutation transaction | WORKS |
| "Shift to {Phase} mode" → phase-shift sheet terminal buttons | HomeScreenV2.tsx:752-757, 2521-2660 | Regenerate program for new phase | `executePhaseShift` + `runRebuild` — real regeneration attempted (known runtime failure mode G6 is a separate, already-tracked bug, not a dead affordance — the button does try the real thing) | WORKS |
| Coach Note action buttons (dynamic, approve/dismiss/restore/update) | HomeScreenV2.tsx:1698-1719, 1823-1911 | Clear/restore/update per note kind | Real branch per kind: `clear_injury_modifier`, `clearReversibleAdjustment`, `clear_fatigue_status`/`clear_active_modifier`, `set_recovery_mode`/`set_fatigue_status`, `dismissActiveCoachNote` | WORKS |
| Game day: "Log Game" | HomeScreenV2.tsx:1608-1614 | Open game logging | `navigation.navigate('DayWorkout', {startFinished:true})` | WORKS-NAVIGATION-ONLY |
| Game day: "Move or remove game day" → GameDaySheet "Move"/"Remove" | HomeScreenV2.tsx:1615-1623, 1946-1959 | Move/remove the game | Real fixture-mutation transactions | WORKS |
| Day row: "Start Session" / "Log Session" / "View summary" | HomeScreenV2.tsx:1574-1588 | Open session detail | `navigation.navigate('DayWorkout', ...)` | WORKS-NAVIGATION-ONLY |
| "Want to change something?" / "Add optional session?" links | HomeScreenV2.tsx:1591-1635 | Open plan-change sheet | Opens `PlanChangeSheet` | WORKS-NAVIGATION-ONLY (see PlanChangeSheet table) |
| Day row tap (expand/collapse/select), tap-outside dismiss | HomeScreenV2.tsx:1379, 351-353 | Expand/collapse, picker-mode select | Real mode/selection state; picker modes trigger real `rebuildForGameChange` | WORKS |

### Program tab — day-tap sheets (`PlanChangeSheet.tsx`, `GuidedInjuryFlowSheet.tsx`, `EquipmentLimitationSheet.tsx`)

| Control | File:line | Expected | Actual wiring | Verdict |
|---|---|---|---|---|
| "Edit this session" / "Add optional session" | PlanChangeSheet.tsx:477-489 | Open edit/add sub-menu | Real step transitions; add correctly blocks at 2-session cap | WORKS-NAVIGATION-ONLY |
| "I'm not 100%" | PlanChangeSheet.tsx:490-496 | Hand off to readiness flow | `onOpenReadiness()` → HomeScreenV2's single week-level readiness sheet — confirmed no duplicate wellbeing UI exists in this file (correctly delegates) | WORKS-NAVIGATION-ONLY |
| "Something else - ask the coach" | PlanChangeSheet.tsx:497-501 | Route to Coach with prefill | `navigation.navigate('CoachTab', {prefill})` | WORKS |
| "Swap this session" / "Add to this day" / "Move this session" / "Bin this session" | PlanChangeSheet.tsx:507-533 | Open respective picker | Real step transitions | WORKS-NAVIGATION-ONLY |
| Category picks (Conditioning/Strength/Recovery, all levels) | PlanChangeSheet.tsx:612-689 | Apply session content change | `commitPlanChange` → `applyPlanChange` (planChangeProducer.ts:1546) — real mutation | WORKS |
| Move-destination option | PlanChangeSheet.tsx:730-741 | Move/swap to that day | `executeProgramControlActionDurably({type:'move_session'})` — real, wired; note this is the exact mutation implicated in the still-open move-to-occupied-day content-loss bug tracked separately on this branch (a correctness defect, not a dead affordance) | WORKS |
| Bin-scope option / "Yes, bin it" / "No, keep it" | PlanChangeSheet.tsx:752-796 | Remove session/component | `remove_session`/`bin_session` real durable mutation | WORKS |
| confirm_warning / block_warning "Continue"/"Cancel"/"OK" | PlanChangeSheet.tsx:699-724 | Proceed/cancel/acknowledge | Real step transitions | WORKS |
| Add-blocked "Remove a session" / "Swap this session" reroutes | PlanChangeSheet.tsx:555-595 | Route around a 2-session block | Real step transitions | WORKS-NAVIGATION-ONLY |
| Result "Done" | PlanChangeSheet.tsx:812-818 | Close | `onClose` | WORKS |
| Region/area/severity/trigger option taps, custom-area input, Back | GuidedInjuryFlowSheet.tsx:141-370 | Step through guided flow | Pure local step-machine state | WORKS |
| **"Pause affected training"** (severity 8-10/10 branch) | GuidedInjuryFlowSheet.tsx:225-230 | Warn and pause affected training | Real durable `set_injury_modifier` write via `createOrUpdateInjuryEpisode`, but `requiresRebuild:false` hardcoded — no rebuild of the visible session. See Executive Summary #3 | **PARTIAL** |
| "Apply training adjustment" (non-severe branch) | GuidedInjuryFlowSheet.tsx:298-304 | Apply lighter constraint | Same durable path, same rebuild gap | **PARTIAL** |
| Equipment preset option (each row) | EquipmentLimitationSheet.tsx:44-58 | Apply/clear a temporary equipment restriction | Real durable fact write via `transactTemporarySourceFact`, but same `skipConstraintProjection:true` gap as HomeScreenV2's G9 finding — the fact is recorded, an already-generated week's exercises aren't retroactively changed | **PARTIAL** (write is real; visible effect on an already-materialized week is the G9 gap) |

### Workout tab — `DayWorkoutScreenV2.tsx` (+ `SessionFeedbackPanel.tsx`, `ExerciseVideoModal.tsx`, `StaleOverrideBanner.tsx`)

`PowerPrimerSection`, `TrunkSupportSection`, `SessionCompleteMoment` contain
zero interactive controls (display-only, confirmed).

| Control | File:line | Expected | Actual wiring | Verdict |
|---|---|---|---|---|
| Back chevron | DayWorkoutScreenV2.tsx:965,1041 | Leave screen | `navigation.goBack()` | WORKS-NAVIGATION-ONLY |
| "Edit exercises" link | DayWorkoutScreenV2.tsx:1086-1095 | Open exercise edit sheet | Real step transition; correctly hidden when no editable exercises exist (Game/TT-only days) | WORKS |
| **"Finish Session"** | DayWorkoutScreenV2.tsx:2062-2072 | Move to feedback step | `setIsFinished(true)` — identical for every workout type; this button itself is NOT the F5 defect | WORKS |
| Weight −/+ / tap-to-edit | DayWorkoutScreenV2.tsx:1627-1665 | Adjust/enter load | `incrementWeight`/`decrementWeight`/`commitWeightEdit` → `setWeightOverride` | WORKS |
| Exercise name / Play button → video modal | DayWorkoutScreenV2.tsx:1961-2017 | Show demo video | Opens `ExerciseVideoModal`; inline player + "Open in YouTube" fallback + close all real | WORKS |
| "Change" exercise action | DayWorkoutScreenV2.tsx:1977-1992 | Open per-exercise edit menu | Real step transition | WORKS |
| Cue toggle ("Form cues") | DayWorkoutScreenV2.tsx:2030-2048 | Expand/collapse cue text | Local state + LayoutAnimation | WORKS |
| Sheet: Swap/Add/Remove/Concern menu | DayWorkoutScreenV2.tsx:2208-2227 | Open respective sub-flow | Real step transitions | WORKS |
| Swap-reason chips (6) | DayWorkoutScreenV2.tsx:2264-2270 | Suggest a substitute | Non-injury reasons → real swap suggestion; "Injury/pain" → opens `GuidedInjuryFlowSheet` (see PARTIAL verdict above) | WORKS (non-injury) |
| Add-kind chips (7) | DayWorkoutScreenV2.tsx:2276-2282 | Suggest an addition | Real suggestion; correctly routes to `coach_fallback` step (not silent nothing) when none available | WORKS |
| "Apply change" (confirm_swap) / "Add exercise" (confirm_add) / "Remove exercise" (confirm_remove) | DayWorkoutScreenV2.tsx:2291-2365 | Commit the exercise change | `executeProgramControlAction`/`executeProgramControlActionDurably` — real mutations (`replaceExerciseAtDate`, `addExerciseAtDate`, `removeExerciseAtDate`) | WORKS |
| Cancel buttons (all confirm/fallback steps) | DayWorkoutScreenV2.tsx:2301-2372, 2467-2474 | Dismiss without change | `onClose` | WORKS |
| future_scope "Today only" / "Future weeks too" | DayWorkoutScreenV2.tsx:2390-2413 | Keep one-off / persist ongoing preference | Real; "Future weeks too" calls `setPreferredAlternative`/`pinExerciseGlobally`/`banExerciseGlobally` | WORKS |
| concern_reason: "No equipment" / "Too hard-too easy" | DayWorkoutScreenV2.tsx:2423-2430 | Suggest a substitute | Same real swap path as reason chips | WORKS |
| Sheet "Back" | DayWorkoutScreenV2.tsx:2501-2508 | Step backward | Full state-machine back-map | WORKS |
| coach_fallback / "Ask Coach" (empty exercise list) | DayWorkoutScreenV2.tsx:2175-2180, 2461-2466 | Route to Coach with prefill | `navigation.navigate('CoachTab', {prefill})` — confirmed `CoachScreen.tsx:745-751` consumes it | WORKS |
| Result "Done" | DayWorkoutScreenV2.tsx:2480-2485 | Close | `onClose` | WORKS |
| StaleOverrideBanner "Keep" / "Review" | StaleOverrideBanner.tsx:89-102 | Keep override / go review with coach | "Review" → same coach-nav path | WORKS (shared component, only spot-checked here — see NOT COVERED) |
| SessionFeedbackPanel: completion/reason/feeling/soreness chips, notes | SessionFeedbackPanel.tsx:632-864 | Build feedback draft | Local state, type-agnostic | WORKS |
| **SessionFeedbackPanel "Save & Finish"** | SessionFeedbackPanel.tsx:867-878 (handler 476-552, silent-return at line 520) | Persist feedback, show completion | Confirmed WORKS on gym/TT days; **on ANY commit failure, silently no-ops** (`if (!result.ok) return;`) with zero visible feedback | **PARTIAL — this is F5.** Exact game-day throw site needs a device trace; the silent-swallow mechanism itself is confirmed |

### Profile tab — `ProfileScreen.tsx` (+ SetupUpdateSheet), `FAQScreen.tsx`, `PrivacyScreen.tsx`, `TermsScreen.tsx`

| Control | File:line | Expected | Actual wiring | Verdict |
|---|---|---|---|---|
| "Something changed? Tell the coach" | ProfileScreen.tsx:582 | Open setup-update sheet | Real step transition | WORKS-NAVIGATION-ONLY |
| "Clear active changes" | ProfileScreen.tsx:636 | Clear restrictions/coach edits | `clearCoachAdjustments()` — real mutations across 5 stores | WORKS |
| "Clear coach chat" | ProfileScreen.tsx:653 | Clear chat only | `clearCoachChat()` — real | WORKS |
| "Frequently Asked Questions" / "Privacy Policy" / "Terms of Use" rows | ProfileScreen.tsx:675,736,751 | Navigate to real content screens | `navigation.navigate(...)` — all three are real static screens with real content | WORKS-NAVIGATION-ONLY |
| "Reset to post-onboarding state" (dev) | ProfileScreen.tsx:692 | Reseed clean program | `resetToDevPostOnboardingState()` — real, clears ~10 stores + regenerates | WORKS |
| "Leave Feedback" / "Ask a Human" | ProfileScreen.tsx:717,722 | Open mail composer | `Linking.openURL(buildMailto(...))`, no guard — silently fails with no Mail account configured | **PARTIAL — already tracked, Group D item D1**, not re-diagnosed here |
| "Full reset" | ProfileScreen.tsx:778 | Wipe everything, return to onboarding | `resetProgramAndOnboarding()` — real, clears all 6 stores | WORKS |
| SetupUpdateSheet: every step's option tiles, day-chip toggles, Continue/Cancel/Back | ProfileScreen.tsx:1005-1326 | Advance/select/save at each step | All real (local draft state setters, or `savePlayerDetails`/`saveProgramDetails` staging functions) | WORKS |
| **SetupUpdateSheet: "Continue"/"Try again" (confirm step)** | ProfileScreen.tsx:1217 | Commit the update, rebuild program | `executeSetupUpdate` → `commitProfileProgramTransaction` — genuine terminal transaction: rebuilds via `generateProgramLocally`, commits through `runCoachMutationTransaction`, verifies candidate + durable readback, rolls back on failure | **WORKS** — confirmed genuine terminal mutation |
| "Need to explain something? Message the coach" | ProfileScreen.tsx:1305 | Route to Coach with prefill | `navigation.navigate('CoachTab', {prefill})` | WORKS |
| FAQ accordion rows | FAQScreen.tsx:84-114 | Expand/collapse answer | Local state, by design | WORKS |
| FAQ/Privacy/Terms back buttons | FAQScreen.tsx:73, PrivacyScreen.tsx:23, TermsScreen.tsx:23 | Navigate back | `navigation.goBack()` | WORKS |

### Coach tab — `CoachScreen.tsx`

| Control | File:line | Expected | Actual wiring | Verdict |
|---|---|---|---|---|
| Quick-reply chips (7: "I missed a session", "I'm sore", "Feeling cooked this week", "Game day changed", "Swap an exercise", "Busy week", "I'm injured") | CoachScreen.tsx:606-614, 2287-2298 | Prefill the message input | `handleQuickAction` sets `inputValue` + focuses input (does not auto-send, by design) | WORKS — chip itself is real; downstream coach handling of "busy week" semantics specifically is Phase 5B territory, not a dead-chip finding |
| Send button | CoachScreen.tsx:2346-2361 | Send message through coach pipeline | `handleSend` → real guards → `handleCoachTurn` → real mutation transactions | WORKS |
| Message text input | CoachScreen.tsx:2333-2345 | Accept typed text | `onChangeText={setInputValue}` | WORKS |
| Inline per-message action buttons (approve/dismiss/undo on coach cards) | — | — | **None found.** Full render tree confirms coach cards render text only (`CoachConversationBubble`); the free-text proposal/approval flow is handled through subsequent chat replies, not dedicated buttons — consistent with Phase 5B (stage-5 free-text) being pre-launch, in-flight work | N/A — no such control exists to be dead |
| Dev-only smoke-test control | CoachScreen.tsx:2188-2196 | Maestro smoke aid | `__DEV__`+smoke-flow gated, real navigation, never visible to athletes | WORKS (not athlete-facing) |

---

## Cross-reference to dogfood findings (Group X1 disposition)

| Dogfood ID | Original finding | This sweep's disposition |
|---|---|---|
| G7 | "Busy week — keep me training, go lighter" changes nothing | **CONFIRMED, root cause pinpointed** — `skipConstraintProjection:true`, shared with G8/G9 |
| G8 | "Away two days this week" changes nothing | **CONFIRMED, same root cause as G7** |
| G9 | Equipment change does nothing | **CONFIRMED, same root cause as G7/G8** |
| F5 | Game day "Save and finish" unresponsive | **CONFIRMED, exact silent-swallow line pinpointed** (`SessionFeedbackPanel.tsx:520`); exact game-day throw site still needs a device trace |
| F6 | Mid-session "pause affected training" changes nothing | **REFINED, not confirmed as originally stated** — a real durable write occurs; the gap is a missing rebuild trigger, not a no-op mutation |
| F1 | Catch-up prompt marks every option "Done" | **NOT REPRODUCED in current source** — each option maps to a distinct real transaction; flagged UNCLEAR-NEEDS-DEVICE-CHECK, not closed |
| (new) | `SessionDurationScreen` unreachable, required field silently unset | **NEW finding**, not in the original dogfood doc |
| (new) | `HomeScreenClassic`/`DayWorkoutScreenClassic`/`HomeQuickActionSheet` entirely dead | **NEW finding**, large volume of unreachable code beyond the specific dogfood items |

---

## NOT COVERED (per Process Law L2)

- **No device or Maestro run was performed for this document.** Every
  verdict above is a static source trace (reachability + call-graph tracing
  to a real store/transaction call), not a runtime observation. Per L4
  ("device is arbiter"), every WORKS verdict here still needs on-device
  confirmation before being treated as closed, and every
  UNCLEAR-NEEDS-DEVICE-CHECK / PARTIAL item needs one before a fix is
  designed.
- **The exact runtime throw site for F5's game-day failure** (which of
  `component_identity_mismatch` / `incomplete_component_outcomes` /
  `workout_identity_mismatch` / `weekly_card_detail_semantic_mismatch`
  actually fires) was not determined — needs a device run with the existing
  `emitAthleteActionEvent` diagnostics read out.
- **`createOrUpdateInjuryEpisode`'s own success/conflict/rollback paths**
  were confirmed to lack a rebuild trigger but not traced exhaustively
  beyond that.
- **`StaleOverrideBanner.tsx`** was only spot-checked for its two buttons —
  it's a shared component reachable from screens outside this sweep's scope
  too.
- **How "done"/"missed" status is rendered on a day row after a
  transaction commits** (`useResolvedWeek`/`useSchedule`/session-resolver
  logic) was not traced — this is the missing piece needed to fully close or
  reopen F1.
- **Cold-start / non-seeded generation quality** (Group G items: density,
  exercise ordering, swap-candidate correctness, off-season shape,
  pre-season parse failure) — explicitly out of scope for this sweep, which
  targets dead controls, not generation quality.
- **Group E presentation/layout bugs** (keyboard covering Continue,
  input-dismiss inconsistency, layout gaps) — a different bug class from
  dead affordances, out of scope here.
- **Accessibility** (VoiceOver labels, Dynamic Type, focus order) on any
  control — not evaluated; tracked separately under Group C.
- **Any screen/flow this sweep's five research passes didn't cover directly
  beyond what's listed above** — the full reachable surface (all three tabs
  + onboarding) was covered per the navigator ground-truth at the top of
  this document, but depth of tracing varies (e.g. `injuryEpisodeTransaction.ts`
  internals, `sessionOutcomeTransaction.ts`'s full re-derivation logic, and
  `programControlActions.ts`'s full action-type surface were traced only as
  far as needed to reach a verdict on the controls above, not exhaustively
  read end to end).
