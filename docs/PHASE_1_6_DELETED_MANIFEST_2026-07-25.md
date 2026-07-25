# Phase 1.6 purge — deleted-file manifest (2026-07-25)

Derived from `git diff --diff-filter=D` against `main` — what was ACTUALLY
deleted, not what a plan predicted.

Reachability was recomputed for this unit rather than trusting the earlier
inventory: the import graph was walked from `App.tsx` AND from every entry
point `package.json` scripts actually run, plus every `__tests__` file.
**112** product files are unreachable from `App.tsx`; **15** of those are still
reached by a test or dev-harness entry, so only the **97** unreachable from
EVERYTHING were deleted. That 15-file gap is the cross-check Sam asked for —
deleting them would have broken suites inside `test:bible`.

## Deleted (101 paths)

- `src/__tests__/activeCoachNotesTests.ts`
- `src/components/AddExerciseModal.tsx`
- `src/components/coach/ConversationListItem.tsx`
- `src/components/coach/index.ts`
- `src/components/coach/MessageBubble.tsx`
- `src/components/coach/QuickPromptsBar.tsx`
- `src/components/coach/TypingIndicator.tsx`
- `src/components/CoachUpdateCard.tsx`
- `src/components/common/SettingsRow.tsx`
- `src/components/ReadinessQuickCheck.tsx`
- `src/components/SessionExplanationBanner.tsx`
- `src/components/SessionStateBadge.tsx`
- `src/data/exerciseTags.d.ts`
- `src/generated/smokeBootstrapFlag.ts`
- `src/hooks/index.ts`
- `src/hooks/useCoach.ts`
- `src/hooks/useProgram.ts`
- `src/hooks/useSessionExplanation.ts`
- `src/hooks/useWorkoutLog.ts`
- `src/navigation/AuthNavigator.tsx`
- `src/navigation/index.ts`
- `src/navigation/types.ts`
- `src/screens/auth/ForgotPasswordScreen.tsx`
- `src/screens/auth/index.ts`
- `src/screens/auth/SignInScreen.tsx`
- `src/screens/auth/SignUpScreen.tsx`
- `src/screens/coach/ChatScreen.tsx`
- `src/screens/coach/index.ts`
- `src/screens/home/CurrentWeekScreen.tsx`
- `src/screens/home/index.ts`
- `src/screens/home/MakeAChangeScreen.tsx`
- `src/screens/home/QuickStartScreen.tsx`
- `src/screens/home/StatsCard.tsx`
- `src/screens/home/StatsScreen.tsx`
- `src/screens/home/TodayWorkoutCard.tsx`
- `src/screens/home/TrainingOverviewScreen.tsx`
- `src/screens/home/WeekViewCard.tsx`
- `src/screens/journal/ExerciseHistoryScreen.tsx`
- `src/screens/journal/index.ts`
- `src/screens/journal/JournalHomeScreen.tsx`
- `src/screens/journal/LogWorkoutScreen.tsx`
- `src/screens/journal/PersonalRecordsScreen.tsx`
- `src/screens/journal/ProgressChartsScreen.tsx`
- `src/screens/journal/WeeklyReviewScreen.tsx`
- `src/screens/journal/WorkoutHistoryDetailScreen.tsx`
- `src/screens/journal/WorkoutHistoryScreen.tsx`
- `src/screens/onboarding/SessionDurationScreen.tsx`
- `src/screens/profile/AboutScreen.tsx`
- `src/screens/profile/AccountScreen.tsx`
- `src/screens/profile/DeleteAccountScreen.tsx`
- `src/screens/profile/EditProfileScreen.tsx`
- `src/screens/profile/EquipmentSettingsScreen.tsx`
- `src/screens/profile/FeedbackScreen.tsx`
- `src/screens/profile/GoalSettingsScreen.tsx`
- `src/screens/profile/HealthSettingsScreen.tsx`
- `src/screens/profile/HelpScreen.tsx`
- `src/screens/profile/index.ts`
- `src/screens/profile/InjuryManagementScreen.tsx`
- `src/screens/profile/NotificationSettingsScreen.tsx`
- `src/screens/profile/PreferencesScreen.tsx`
- `src/screens/profile/ProfileHomeScreen.tsx`
- `src/screens/profile/SubscriptionScreen.tsx`
- `src/screens/profile/SupportScreen.tsx`
- `src/screens/profile/TrainingPreferencesScreen.tsx`
- `src/screens/program/CustomizeWorkoutScreen.tsx`
- `src/screens/program/ExerciseDetailScreen.tsx`
- `src/screens/program/ExerciseLibraryScreen.tsx`
- `src/screens/program/index.ts`
- `src/screens/program/MicrocycleDetailScreen.tsx`
- `src/screens/program/ProgramCreateScreen.tsx`
- `src/screens/program/ProgramDetailScreen.tsx`
- `src/screens/program/ProgramEditScreen.tsx`
- `src/screens/program/ProgramListScreen.tsx`
- `src/screens/program/WorkoutDetailScreen.tsx`
- `src/screens/workout/CompletionSummary.tsx`
- `src/screens/workout/ExerciseVideoPlayer.tsx`
- `src/screens/workout/index.ts`
- `src/screens/workout/RestTimer.tsx`
- `src/screens/workout/SetLoggerRow.tsx`
- `src/screens/workout/WorkoutLoggerScreen.tsx`
- `src/services/api/coachService.ts`
- `src/services/api/index.ts`
- `src/services/api/programModificationService.ts`
- `src/services/api/programService.ts`
- `src/services/api/scheduleService.ts`
- `src/services/api/supabaseClient.ts`
- `src/services/api/workoutService.ts`
- `src/services/auth/authContext.tsx`
- `src/services/auth/authService.ts`
- `src/services/auth/index.ts`
- `src/services/auth/useAuthHook.ts`
- `src/services/index.ts`
- `src/theme/styles.ts`
- `src/types/api.ts`
- `src/types/domain.d.ts`
- `src/types/index.ts`
- `src/utils/calculations.ts`
- `src/utils/loadEstimation.d.ts`
- `src/utils/rulesEngine.ts`
- `supabase/functions/generate-program/index.ts`
- `supabase/functions/sync-exercises/index.ts`

## Unreachable from `App.tsx` but KEPT — still reached by a test or dev entry

These are the cross-check. Each is dead to the app but alive to the harness;
retiring them means retiring their consumer first, which is a separate call.

- `src/dev/e2e/coachInterpretationReceipt.ts`
- `src/dev/e2e/explorerCapabilityMatrix.ts`
- `src/dev/e2e/explorerChainShrinker.ts`
- `src/dev/e2e/explorerFailureClusterSignature.ts`
- `src/dev/e2e/explorerPairwiseGenerator.ts`
- `src/dev/e2e/explorerSeededChainGenerator.ts`
- `src/rules/exerciseNameLiteralSweep.ts`
- `src/rules/index.ts`
- `src/screens/home/homeGameMutationController.ts`
- `src/store/injuryEpisodeCommand.ts`
- `src/utils/blockAdjuster.ts`
- `src/utils/coachInjuryTargetResolver.ts`
- `src/utils/section18ProgramObservation.ts`
- `src/utils/trainAroundEngine.ts`
- `src/utils/weeklyCoachUpdate.ts`
