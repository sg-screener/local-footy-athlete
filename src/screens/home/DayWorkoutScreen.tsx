import React from 'react';
import DayWorkoutScreenV2 from './DayWorkoutScreenV2';

/**
 * The day-workout route.
 *
 * ## The Classic render layer is DELETED (Task 6, buttons/UI unit, 2026-07-31)
 *
 * This file used to hold `DayWorkoutScreenClassic` — a full second render layer
 * behind a `DESIGN_VERSION` constant hardcoded to `'v2'`, so unreachable at
 * runtime since the V2 rollout. It is gone, and the deletion is the point rather
 * than tidying:
 *
 * Classic was the last consumer of `useDayWorkout`'s composition half — the five
 * booleans and three row buckets `composeDayDetail` returns. The one-projection
 * ruling retires that composition (reassessment §5, deletion 3 of nine) and
 * `dayDetailCompositionOwnershipTests` pins the consequence: exactly ONE
 * production caller composes the day detail, and it is the projection. Keeping a
 * dead screen alive would have meant either leaving the hook composing for
 * nobody, or re-deriving the same five booleans under a new name for a screen
 * that never renders — a second composition wearing a helpful label, which is
 * the move the reassessment names and refuses.
 *
 * What the deletion removed from the gates: `sessionLoggingUITests` asserted the
 * Classic markup for the finish CTA, the team-training card, power-primer
 * ordering, the trunk/support section and the conditioning renderer. Every one of
 * those assertions had a V2 counterpart in the same file, and the V2 half is
 * untouched — the surface being deleted stops being watched, the surface that
 * ships does not (`gate-must-watch-the-deleted-surface`).
 *
 * The named export is preserved for `AppNavigator` and `screens/home/index.ts`.
 */
export const DayWorkoutScreen = () => <DayWorkoutScreenV2 />;
