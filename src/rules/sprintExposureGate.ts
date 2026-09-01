import type { SprintExposure, WeekKind, Workout } from '../types/domain';
import {
  BIBLE_WEEKLY_CAPS,
  countWeeklyExposures,
} from './weeklyExposureCounts';
import type { OffseasonSubphase } from './offseasonSubphase';
import type { PreseasonSubphase } from './preseasonSubphase';
import { getPreseasonSubphasePolicy } from './preseasonSubphasePolicy';

export type SprintExposureGatePhase = 'Off-season' | 'Pre-season' | 'In-season';

export type RequestedSpeedQuality = 'acceleration' | 'top_end_speed';

/**
 * Qualities the app still has to programme as real running Speed.
 *
 * A team night may supply acceleration under the existing anchor-credit rule,
 * but its frequency-only onboarding answer never proves maximum velocity. An
 * Off-season week has no team anchor, so the phase progression owns the ask.
 */
export function requiredRunningSpeedQualities(args: {
  readonly phase: SprintExposureGatePhase;
  readonly offseasonBlock?: 'early_optional' | 'transition' | 'normal_build' | null;
  readonly teamTrainingDays?: readonly number[];
  readonly sprintExposure?: SprintExposure;
}): readonly RequestedSpeedQuality[] {
  const reportedMissing = reportedMissingSpeedQualities(args.sprintExposure);
  if (reportedMissing !== null) return reportedMissing;
  if (args.phase === 'Off-season') {
    return args.offseasonBlock === 'normal_build'
      ? ['acceleration', 'top_end_speed']
      : ['acceleration'];
  }
  return (args.teamTrainingDays?.length ?? 0) > 0
    ? ['top_end_speed']
    : ['acceleration', 'top_end_speed'];
}

/** P15: a reported missing quality is not satisfied by a generic club-night count.
 * Frequency-only answers make no per-quality claim. Null retains that uncertainty
 * and the existing floor policy rather than inventing what happened at training.
 */
export function reportedMissingSpeedQualities(answer?: SprintExposure): readonly RequestedSpeedQuality[] | null {
  if (answer === 'No sprint training') return ['acceleration', 'top_end_speed'];
  if (answer === 'Acceleration only') return ['top_end_speed'];
  if (answer === 'Top-speed only') return ['acceleration'];
  return null;
}

export type SprintExposureGateReason =
  | 'preseason_shortfall'
  | 'preseason_target_met'
  | 'preseason_app_topup_already_added'
  | 'injury_denied'
  | 'inseason_shortfall'
  | 'inseason_target_met'
  | 'inseason_app_topup_already_added'
  | 'offseason_shortfall'
  | 'offseason_target_met'
  | 'offseason_app_topup_already_added'
  | 'early_offseason';

export interface SprintExposureGateContext {
  phase: SprintExposureGatePhase;
  teamTrainingDays?: readonly number[];
  gameOrPracticeMatchDays?: readonly number[];
  plannedOnFeetSprintExposures?: number;
  // NO readiness input (Sam's readiness law, 2026-07-28). `readinessAllowsSprint`
  // was set from `readiness === 'high'`, so anything below high denied the
  // standalone sprint outright — a BLOCK on the one exposure Bible Section 2
  // floors year-round at 1 and permits below that only for an explicit typed
  // authorised reason. Low capacity was never one of those reasons. The field is
  // deleted rather than defaulted so no caller can reintroduce the block.
  injuryAllowsSprint?: boolean;
  offseasonSubphase?: OffseasonSubphase | null;
  preseasonSubphase?: PreseasonSubphase | null;
  weekKind?: WeekKind | null;
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
  const preseasonPolicy = context.phase === 'Pre-season' && context.preseasonSubphase
    ? getPreseasonSubphasePolicy(context.preseasonSubphase, {
        teamTrainingExposures: uniqueDays(context.teamTrainingDays ?? []).length,
        hasPracticeMatch: uniqueDays(context.gameOrPracticeMatchDays ?? []).length > 0,
      })
    : null;
  const target = context.phase === 'Off-season'
    ? context.offseasonSubphase === 'early_offseason' || context.offseasonSubphase === null ||
      context.offseasonSubphase === undefined
      ? 0
      : SPRINT_COD_TARGET
    : preseasonPolicy?.speedSprint.targetExposures ?? SPRINT_COD_TARGET;
  const currentSprintCodExposures = anchorSprintCodExposures + plannedOnFeetSprintExposures;
  const remainingSprintCodExposures = Math.max(0, target - currentSprintCodExposures);
  const base = {
    phase: context.phase,
    target,
    anchorSprintCodExposures,
    plannedOnFeetSprintExposures,
    currentSprintCodExposures,
    remainingSprintCodExposures,
  };

  if (context.injuryAllowsSprint === false) {
    return { ...base, allowStandaloneSprint: false, reason: 'injury_denied' };
  }
  if (context.phase === 'Off-season') {
    if (target === 0) {
      return { ...base, allowStandaloneSprint: false, reason: 'early_offseason' };
    }
    if (anchorSprintCodExposures >= target || currentSprintCodExposures >= target) {
      return { ...base, allowStandaloneSprint: false, reason: 'offseason_target_met' };
    }
    if (plannedOnFeetSprintExposures >= APP_SPRINT_TOPUP_LIMIT) {
      return { ...base, allowStandaloneSprint: false, reason: 'offseason_app_topup_already_added' };
    }
    return { ...base, allowStandaloneSprint: true, reason: 'offseason_shortfall' };
  }
  if (context.phase === 'In-season') {
    if (currentSprintCodExposures >= target) {
      return { ...base, allowStandaloneSprint: false, reason: 'inseason_target_met' };
    }
    if (plannedOnFeetSprintExposures >= APP_SPRINT_TOPUP_LIMIT) {
      return { ...base, allowStandaloneSprint: false, reason: 'inseason_app_topup_already_added' };
    }
    return { ...base, allowStandaloneSprint: true, reason: 'inseason_shortfall' };
  }
  if (
    preseasonPolicy?.speedSprint.practiceMatchSatisfiesTarget &&
    uniqueDays(context.gameOrPracticeMatchDays ?? []).length > 0
  ) {
    return { ...base, allowStandaloneSprint: false, reason: 'preseason_target_met' };
  }
  if (anchorSprintCodExposures >= target || currentSprintCodExposures >= target) {
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
