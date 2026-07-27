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

import type { SeasonPhase, Workout } from '../types/domain';
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
  /**
   * THE HARD MAX — the validator's ceiling, in EVERY phase (§17.B, Sam
   * 2026-07-27): "2 days minimum per week, 3 preferred, 4 hard max."
   *
   * A 4th running day is VALID everywhere and merely unusual. Only a 5th
   * breaches the law. This is NOT what the app programs — see
   * `preferredRunningExposures` and `programmedRunningDayAllowance`.
   *
   * Sam's device pass corrected the Bible Amendment Pass here: that pass read
   * one number as doing all three jobs and set the ceiling to 3, which made a
   * perfectly legal athlete-added 4th day look like a breach.
   */
  maxRunningExposures: 4,
  /**
   * THE PREFERRED COUNT — what the app PROGRAMS by default. A generation
   * target, not a limit; exceeding it is not a validation finding.
   *
   * Anchors count toward it: 2 team trainings plus a game is already 3, which
   * is why in-season rarely needs any added app running.
   */
  preferredRunningExposures: 3,
  /**
   * THE FLOOR. Scoped OFF in the two cases named by RUNNING_FLOOR_EXEMPTIONS;
   * everywhere else a healthy week programming fewer than 2 running days needs
   * an authorised typed reduction reason. Unchanged by the 2026-07-27 law.
   */
  minRunningExposures: 2,
  /** One genuine weekly exposure from mid off-season onward; 2-3 remains the usual maximum. */
  sprintCodExposures: { min: 1, max: 3 },
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

/**
 * The two cases where the 2-day running floor does not apply (amended §17.B):
 * "The 2-day floor does not apply in early off-season (weeks 1-2), where
 * running is not required at all, or in bye recovery, where the reduced
 * structure governs."
 *
 * A TYPED reason rather than a boolean, so a caller has to say WHICH authored
 * case it is claiming and the build can check the reason still exists.
 */
export type RunningFloorExemption = 'early_off_season_weeks_1_2' | 'bye_recovery';

export const RUNNING_FLOOR_EXEMPTIONS: readonly RunningFloorExemption[] = [
  'early_off_season_weeks_1_2',
  'bye_recovery',
];

/**
 * The two authored conditions under which the APP may program a 4th running day
 * (§17.B, Sam 2026-07-27). Typed reasons rather than a boolean, so a caller has
 * to say WHICH case it is claiming and the build can check the reason still
 * exists.
 *
 *   no_equipment — off-leg conditioning is not available to absorb the work.
 *   pre_season   — team training may itself be 1-3 of the running days, so the
 *                  programmed extra may be just one session.
 *
 * In off-season and in-season the app never programs a 4th. An athlete-added
 * 4th remains valid in every phase — that is the VALIDATOR's business
 * (`maxRunningExposures`), not this function's.
 */
export type FourthRunningDayReason = 'no_equipment' | 'pre_season';

export const FOURTH_RUNNING_DAY_REASONS: readonly FourthRunningDayReason[] = [
  'no_equipment',
  'pre_season',
];

export interface ProgrammedRunningAllowance {
  /** How many running days the app may PROGRAM for this athlete this week. */
  readonly days: number;
  /** Why a 4th was unlocked, or null when the default 3 applies. */
  readonly reason: FourthRunningDayReason | null;
}

/**
 * How many running days the APP may program — the generation-side half of the
 * running law. Deliberately separate from `auditWeekAgainstCaps`, because
 * "what the app chooses" and "what is legal" are different questions and
 * collapsing them is exactly the defect Sam's device pass caught.
 */
export function programmedRunningDayAllowance(context: {
  readonly phase: SeasonPhase;
  /** False when the athlete has no equipment, so off-leg work is unavailable. */
  readonly hasEquipment: boolean;
}): ProgrammedRunningAllowance {
  // (a) No equipment — there is no off-feet option to absorb the extra work.
  if (!context.hasEquipment) {
    return { days: BIBLE_WEEKLY_CAPS.maxRunningExposures, reason: 'no_equipment' };
  }
  // (b) Pre-season — team training may already be 1-3 of these days.
  if (context.phase === 'Pre-season') {
    return { days: BIBLE_WEEKLY_CAPS.maxRunningExposures, reason: 'pre_season' };
  }
  return { days: BIBLE_WEEKLY_CAPS.preferredRunningExposures, reason: null };
}

/** Context a caller may supply so the audit can scope the running floor. */
export interface CapAuditContext {
  /**
   * The authored case exempting this week from the running floor, when one
   * applies. Absent means the floor is enforced.
   */
  runningFloorExemption?: RunningFloorExemption | null;
}

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
export function auditWeekAgainstCaps(
  counts: WeeklyExposureCounts,
  context: CapAuditContext = {},
): CapFinding[] {
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
      detail: `${counts.runningExposures} running days (Bible hard max ${caps.maxRunningExposures}; the app programs ${caps.preferredRunningExposures} by default)`,
    });
  }
  // The floor is scoped, so it is checked only when no authored exemption is
  // claimed. An exemption never touches the OVER-cap check above: early
  // off-season not requiring running does not license four running days.
  if (
    !context.runningFloorExemption &&
    counts.runningExposures < caps.minRunningExposures
  ) {
    findings.push({
      cap: 'maxRunningExposures', kind: 'under',
      observed: counts.runningExposures, limit: caps.minRunningExposures,
      detail: `${counts.runningExposures} running days (Bible floor ${caps.minRunningExposures}; lifted in early off-season weeks 1-2 and bye recovery, otherwise needs an authorised typed reduction reason)`,
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
      detail: `${counts.sprintCodExposures} sprint/COD exposures (Bible target ≥ ${caps.sprintCodExposures.min}; zero is valid only in early off-season or with an authorised reduction)`,
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
