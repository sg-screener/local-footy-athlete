/**
 * weeklyExposureCounts.ts — Bible weekly exposure counters + cap audit.
 *
 * Phase 1 rules kernel (READ-ONLY).
 *   • Counts a week's exposures the way the Programming Bible counts them
 *     (Section 17.A definitions, Section 17.B caps).
 *   • `auditWeekAgainstCaps` reports findings — it NEVER mutates, blocks,
 *     or reschedules anything. Enforcement is a later phase behind its own
 *     approved plan.
 *
 * Counting rules (Bible Section 17.B):
 *   hard exposure   = one high-stress unit (game, hard TT, lower strength,
 *                     sprint/COD, hard conditioning, …). Context shifts via
 *                     stressClassification.
 *   hard day        = calendar day containing ≥1 hard exposure.
 *   main strength   = lower/upper/full-body strength units. Gunshow,
 *                     accessories, mobility, recovery do NOT count.
 *   running exposure= game, team training, sprint session (on feet), and
 *                     any conditioning unit performed on feet.
 *                     Bike/ski/rower/assault-bike/walking do NOT count.
 *   sprint/COD      = game, team training, on-feet sprint sessions.
 *                     Off-feet "sprint" work (assault-bike repeats) counts
 *                     as conditioning, not sprint/COD (Section 7 treats erg
 *                     repeat sprints as conditioning-leaning work).
 *   conditioning    = aerobic/tempo/hard conditioning units + team training
 *                     + games ("Team training and games count as
 *                     conditioning load") + off-feet sprint work.
 */

import type { Workout } from '../types/domain';
import { logger } from '../utils/logger';
import {
  classifyVisibleSession,
  type ClassifiedVisibleSessionUnit,
} from './sessionClassificationAdapter';
import type { SessionCategory } from './sessionTaxonomy';
import type { StressContext } from './stressClassification';

// ─── Bible default weekly caps (Section 17.B) ────────────────────────

export const BIBLE_WEEKLY_CAPS = {
  /** "The app should not normally program more than 4 main strength sessions per week." */
  maxMainStrengthSessions: 4,
  /** "3-5 conditioning exposures per week" (TT + games count in-season). */
  conditioningExposures: { min: 3, max: 5 },
  /** "No more than 4 running exposures per week programmed by the app." */
  maxRunningExposures: 4,
  /** "2-3 sprint/COD exposures per week max." */
  sprintCodExposures: { min: 2, max: 3 },
  /**
   * Hard days (Sam's clarified intent, 2026-07-08):
   *   4 = clean programming target (audit flags above this),
   *   5 = absolute maximum / acceptable upper edge,
   *   6+ = too much — week is too spread out or too loaded.
   * The audit reports `over` when > maxHardDays (the target); severity
   * grading (info/soft/strong by count + season context) lives in
   * weekStructureValidator, not here.
   */
  maxHardDays: 4,
  hardDaysAbsoluteMax: 5,
} as const;

// ─── Types ───────────────────────────────────────────────────────────

export interface WeekDayInput {
  /** ISO date YYYY-MM-DD. */
  date: string;
  workout?: Workout | null;
  /**
   * All visible workouts for the date (double days / add-on-top stacking).
   * When present this takes precedence over `workout`. Single-workout
   * callers may keep using `workout`.
   */
  workouts?: Array<Workout | null>;
}

/** Normalise a day input to its workout list. */
export function dayWorkouts(day: WeekDayInput): Workout[] {
  const list = day.workouts ?? [day.workout ?? null];
  return list.filter((w): w is Workout => !!w);
}

/** Backward-compatible name for consumers of the weekly report. */
export type ClassifiedUnit = ClassifiedVisibleSessionUnit;

export interface ClassifiedDay {
  date: string;
  /** First workout's name (back-compat); see workoutNames for double days. */
  workoutName: string | null;
  workoutNames: string[];
  units: ClassifiedUnit[];
  isHardDay: boolean;
}

export interface WeeklyExposureCounts {
  hardExposures: number;
  hardDays: number;
  mainStrengthExposures: number;
  /** All conditioning load, INCLUDING team training + games. */
  conditioningExposures: number;
  /** Conditioning the app itself added — excludes team training + games. */
  extraConditioningSessions: number;
  runningExposures: number;
  sprintCodExposures: number;
  gunshowSessions: number;
  recoverySessions: number;
  teamTrainingSessions: number;
  games: number;
  byCategory: Partial<Record<SessionCategory, number>>;
  days: ClassifiedDay[];
}

export interface CapFinding {
  cap: keyof typeof BIBLE_WEEKLY_CAPS;
  kind: 'over' | 'under';
  observed: number;
  limit: number;
  detail: string;
}

// ─── Counters ────────────────────────────────────────────────────────

export function countWeeklyExposures(
  days: WeekDayInput[],
  ctx: StressContext = {},
): WeeklyExposureCounts {
  const classifiedDays: ClassifiedDay[] = [];
  const byCategory: Partial<Record<SessionCategory, number>> = {};

  let hardExposures = 0;
  let mainStrength = 0;
  let conditioning = 0;
  let extraConditioning = 0;
  let running = 0;
  let sprintCod = 0;
  let gunshow = 0;
  let recovery = 0;
  let teamTraining = 0;
  let games = 0;

  for (const day of days) {
    const workoutsForDay = dayWorkouts(day);
    const units: ClassifiedUnit[] = [];
    for (const w of workoutsForDay) {
      const classification = classifyVisibleSession(w, ctx);
      units.push(...classification.units);

      hardExposures += classification.contributions.hardExposures;
      mainStrength += classification.contributions.mainStrength;
      conditioning += classification.contributions.conditioning;
      extraConditioning += classification.contributions.extraConditioning;
      running += classification.contributions.running;
      sprintCod += classification.contributions.sprintCod;
      gunshow += classification.contributions.gunshow;
      recovery += classification.contributions.recovery;
      teamTraining += classification.contributions.teamAnchors;
      games += classification.contributions.gameAnchors;
    }

    for (const u of units) {
      byCategory[u.category] = (byCategory[u.category] ?? 0) + 1;
    }

    classifiedDays.push({
      date: day.date,
      workoutName: workoutsForDay[0]?.name ?? null,
      workoutNames: workoutsForDay.map((w) => w.name),
      units,
      isHardDay: units.some((u) => u.stress === 'high'),
    });
  }

  return {
    hardExposures,
    hardDays: classifiedDays.filter((d) => d.isHardDay).length,
    mainStrengthExposures: mainStrength,
    conditioningExposures: conditioning,
    extraConditioningSessions: extraConditioning,
    runningExposures: running,
    sprintCodExposures: sprintCod,
    gunshowSessions: gunshow,
    recoverySessions: recovery,
    teamTrainingSessions: teamTraining,
    games,
    byCategory,
    days: classifiedDays,
  };
}

// ─── Cap audit (read-only findings) ──────────────────────────────────

/**
 * Compare counts against the Bible's default weekly caps.
 *
 * Findings are observability output ONLY. 'under' findings on the ranged
 * caps are informational (a deload / away week legitimately sits under
 * range) — callers must not treat them as errors.
 */
export function auditWeekAgainstCaps(counts: WeeklyExposureCounts): CapFinding[] {
  const findings: CapFinding[] = [];
  const caps = BIBLE_WEEKLY_CAPS;

  if (counts.mainStrengthExposures > caps.maxMainStrengthSessions) {
    findings.push({
      cap: 'maxMainStrengthSessions', kind: 'over',
      observed: counts.mainStrengthExposures, limit: caps.maxMainStrengthSessions,
      detail: `${counts.mainStrengthExposures} main strength sessions (Bible max ${caps.maxMainStrengthSessions})`,
    });
  }
  if (counts.runningExposures > caps.maxRunningExposures) {
    findings.push({
      cap: 'maxRunningExposures', kind: 'over',
      observed: counts.runningExposures, limit: caps.maxRunningExposures,
      detail: `${counts.runningExposures} running exposures (Bible max ${caps.maxRunningExposures})`,
    });
  }
  if (counts.hardDays > caps.maxHardDays) {
    findings.push({
      cap: 'maxHardDays', kind: 'over',
      observed: counts.hardDays, limit: caps.maxHardDays,
      detail: `${counts.hardDays} hard days (Bible max ${caps.maxHardDays})`,
    });
  }
  if (counts.sprintCodExposures > caps.sprintCodExposures.max) {
    findings.push({
      cap: 'sprintCodExposures', kind: 'over',
      observed: counts.sprintCodExposures, limit: caps.sprintCodExposures.max,
      detail: `${counts.sprintCodExposures} sprint/COD exposures (Bible max ${caps.sprintCodExposures.max})`,
    });
  }
  if (counts.conditioningExposures > caps.conditioningExposures.max) {
    findings.push({
      cap: 'conditioningExposures', kind: 'over',
      observed: counts.conditioningExposures, limit: caps.conditioningExposures.max,
      detail: `${counts.conditioningExposures} conditioning exposures (Bible max ${caps.conditioningExposures.max})`,
    });
  }
  if (counts.conditioningExposures < caps.conditioningExposures.min) {
    findings.push({
      cap: 'conditioningExposures', kind: 'under',
      observed: counts.conditioningExposures, limit: caps.conditioningExposures.min,
      detail: `${counts.conditioningExposures} conditioning exposures (Bible target ≥ ${caps.conditioningExposures.min}; fine for deload/away weeks)`,
    });
  }
  if (counts.sprintCodExposures < caps.sprintCodExposures.min) {
    findings.push({
      cap: 'sprintCodExposures', kind: 'under',
      observed: counts.sprintCodExposures, limit: caps.sprintCodExposures.min,
      detail: `${counts.sprintCodExposures} sprint/COD exposures (Bible target ≥ ${caps.sprintCodExposures.min}; expected off-season early)`,
    });
  }

  return findings;
}

/**
 * Debug convenience — classify, count, audit, and log one week.
 * Log-only; safe to call from anywhere without behavioural effect.
 */
export function logWeeklyExposureAudit(
  days: WeekDayInput[],
  ctx: StressContext = {},
  label = 'week',
): { counts: WeeklyExposureCounts; findings: CapFinding[] } {
  const counts = countWeeklyExposures(days, ctx);
  const findings = auditWeekAgainstCaps(counts);
  logger.debug('[rules] weekly_exposure_audit', {
    label,
    hardExposures: counts.hardExposures,
    hardDays: counts.hardDays,
    mainStrength: counts.mainStrengthExposures,
    conditioning: counts.conditioningExposures,
    extraConditioning: counts.extraConditioningSessions,
    running: counts.runningExposures,
    sprintCod: counts.sprintCodExposures,
    byCategory: counts.byCategory,
    findings: findings.map((f) => `${f.kind}:${f.detail}`),
  });
  return { counts, findings };
}
