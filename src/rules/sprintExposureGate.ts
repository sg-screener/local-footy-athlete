import type { Workout } from '../types/domain';
import {
  BIBLE_WEEKLY_CAPS,
  countWeeklyExposures,
} from './weeklyExposureCounts';

export type SprintExposureGatePhase = 'Off-season' | 'Pre-season' | 'In-season';

export type SprintExposureGateReason =
  | 'preseason_shortfall'
  | 'preseason_target_met'
  | 'preseason_app_topup_already_added'
  | 'readiness_denied'
  | 'injury_denied'
  | 'inseason_extra_sprint_disabled'
  | 'inseason_target_met'
  | 'offseason_no_late_flag';

export interface SprintExposureGateContext {
  phase: SprintExposureGatePhase;
  teamTrainingDays?: readonly number[];
  gameOrPracticeMatchDays?: readonly number[];
  plannedOnFeetSprintExposures?: number;
  readinessAllowsSprint?: boolean;
  injuryAllowsSprint?: boolean;
}

export interface SprintExposureGateDecision {
  phase: SprintExposureGatePhase;
  target: number;
  anchorSprintCodExposures: number;
  plannedOnFeetSprintExposures: number;
  currentSprintCodExposures: number;
  remainingSprintCodExposures: number;
  allowStandaloneSprint: boolean;
  reason: SprintExposureGateReason;
}

const SPRINT_COD_TARGET = BIBLE_WEEKLY_CAPS.sprintCodExposures.min;
const APP_SPRINT_TOPUP_LIMIT = 1;

export function evaluateSprintExposureGate(
  context: SprintExposureGateContext,
): SprintExposureGateDecision {
  const plannedOnFeetSprintExposures = Math.max(0, context.plannedOnFeetSprintExposures ?? 0);
  const anchorSprintCodExposures = countAnchorSprintCodExposures(context);
  const currentSprintCodExposures = anchorSprintCodExposures + plannedOnFeetSprintExposures;
  const remainingSprintCodExposures = Math.max(0, SPRINT_COD_TARGET - currentSprintCodExposures);
  const base = {
    phase: context.phase,
    target: SPRINT_COD_TARGET,
    anchorSprintCodExposures,
    plannedOnFeetSprintExposures,
    currentSprintCodExposures,
    remainingSprintCodExposures,
  };

  if (context.injuryAllowsSprint === false) {
    return { ...base, allowStandaloneSprint: false, reason: 'injury_denied' };
  }
  if (context.readinessAllowsSprint === false) {
    return { ...base, allowStandaloneSprint: false, reason: 'readiness_denied' };
  }
  if (context.phase === 'Off-season') {
    return { ...base, allowStandaloneSprint: false, reason: 'offseason_no_late_flag' };
  }
  if (context.phase === 'In-season') {
    return {
      ...base,
      allowStandaloneSprint: false,
      reason: currentSprintCodExposures >= SPRINT_COD_TARGET
        ? 'inseason_target_met'
        : 'inseason_extra_sprint_disabled',
    };
  }
  if (anchorSprintCodExposures >= SPRINT_COD_TARGET || currentSprintCodExposures >= SPRINT_COD_TARGET) {
    return { ...base, allowStandaloneSprint: false, reason: 'preseason_target_met' };
  }
  if (plannedOnFeetSprintExposures >= APP_SPRINT_TOPUP_LIMIT) {
    return { ...base, allowStandaloneSprint: false, reason: 'preseason_app_topup_already_added' };
  }
  return { ...base, allowStandaloneSprint: true, reason: 'preseason_shortfall' };
}

function countAnchorSprintCodExposures(context: SprintExposureGateContext): number {
  const workouts: Workout[] = [];
  let index = 0;
  for (const dayOfWeek of uniqueDays(context.teamTrainingDays ?? [])) {
    workouts.push(stubWorkout({
      id: `sprint-gate-team-${index++}`,
      dayOfWeek,
      name: 'Team Training',
      workoutType: 'Team Training',
    }));
  }
  for (const dayOfWeek of uniqueDays(context.gameOrPracticeMatchDays ?? [])) {
    workouts.push(stubWorkout({
      id: `sprint-gate-game-${index++}`,
      dayOfWeek,
      name: 'Practice Match / Game',
      workoutType: 'Game',
    }));
  }
  return countWeeklyExposures(workouts.map((workout, dayIndex) => ({
    date: `2026-07-${String(6 + dayIndex).padStart(2, '0')}`,
    workout,
  }))).sprintCodExposures;
}

function uniqueDays(days: readonly number[]): number[] {
  return Array.from(new Set(days.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)));
}

function stubWorkout(args: {
  id: string;
  dayOfWeek: number;
  name: string;
  workoutType: Workout['workoutType'];
}): Workout {
  const now = '2026-07-06T12:00:00.000Z';
  return {
    id: args.id,
    microcycleId: 'sprint-gate',
    dayOfWeek: args.dayOfWeek,
    name: args.name,
    description: args.name,
    durationMinutes: 90,
    intensity: 'High',
    workoutType: args.workoutType,
    sessionTier: 'core',
    exercises: [],
    createdAt: now,
    updatedAt: now,
  };
}
