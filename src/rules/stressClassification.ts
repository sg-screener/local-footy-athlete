/**
 * stressClassification.ts — Bible high/medium/low session-stress buckets.
 *
 * Phase 1 rules kernel (READ-ONLY). Pure classification — no scheduling,
 * no enforcement, no mutation.
 *
 * Bible source: Section 3 (Hard exposure rules) and Section 17.A
 * (High / medium / low stress), including the context shifts:
 *   "Upper strength for a beginner may be high stress.
 *    Tempo for a poor runner may be high stress.
 *    Tempo for a very fit athlete may be medium stress."
 */

import type {
  Workout,
  ExperienceLevel,
  ConditioningLevel,
  TeamTrainingIntensity,
} from '../types/domain';
import type { SessionUnit } from './sessionTaxonomy';

export type StressLevel = 'high' | 'medium' | 'low';

/**
 * Athlete context that shifts a session's stress bucket up or down
 * (Section 17.A: "a session can move up or down depending on the athlete").
 */
export interface StressContext {
  experienceLevel?: ExperienceLevel;
  conditioningLevel?: ConditioningLevel;
  /**
   * RETIRED FROM STRESS (Sam, 2026-07-30): a team night is a hard day unconditionally,
   * so this answer no longer decides stress. The field is gone rather than left unread —
   * an input a classifier accepts and ignores is the shape that made this defect
   * invisible. The answer itself survives as coach context and as the estimate-seed for
   * team-night SIZE; see `docs/TEAM_NIGHT_SIZE_SHEET_2026-07-30.md`.
   */
}

const isBeginner = (ctx: StressContext): boolean =>
  ctx.experienceLevel === 'Complete beginner';

const isPoorConditioning = (ctx: StressContext): boolean =>
  ctx.conditioningLevel === 'Poor';

/**
 * Classify one session unit's stress level.
 *
 * `workout` is optional extra signal (intensity, name) for the buckets
 * whose Bible placement is intensity-dependent (aerobic work, power).
 */
export function classifySessionStress(
  unit: SessionUnit,
  workout?: Workout | null,
  ctx: StressContext = {},
): StressLevel {
  switch (unit.category) {
    // ── Always high (Section 17.A high-stress list) ──
    case 'game':
      return 'high';
    case 'team_training':
      // A TEAM NIGHT IS A HARD DAY, UNCONDITIONALLY (Sam's ruling, 2026-07-30).
      //
      // TWO BIBLE LINES WERE IN TENSION and the app had picked the wrong one to obey.
      // `:119` lists what counts as a hard day and team training is first on it. `:704`
      // gives the athlete's own intensity scale — "Light = skills/touch, low running" —
      // and this branch used that answer to downshift a team night to MEDIUM, which took
      // it off the hard-day budget.
      //
      // Sam ruled `:119` governs hard-day status and the intensity answer no longer
      // decides it. `:704`'s scale is not deleted: it describes the athlete's starting
      // assumption about team-night SIZE, which his estimate→measured ruling
      // (docs/TEAM_NIGHT_SIZE_SHEET_2026-07-30.md) makes a seed rather than a truth.
      //
      // Why the old reading was wrong even before the ruling: a static onboarding answer
      // cannot know that THIS Tuesday was a match simulation. Believing it let a hard
      // team night ride free against the budget for the whole season.
      return 'high';
    case 'lower_strength':
      return 'high';
    case 'sprint':
      return 'high';
    case 'hard_conditioning':
      return 'high';

    // ── Medium with context shifts ──
    case 'upper_strength':
      return isBeginner(ctx) ? 'high' : 'medium';
    case 'full_body_strength':
      // "Moderate full body" is medium; hard full body / beginner → high.
      if (isBeginner(ctx)) return 'high';
      return workout?.intensity === 'Maximal' ? 'high' : 'medium';
    case 'tempo_conditioning':
      return isPoorConditioning(ctx) ? 'high' : 'medium';
    case 'aerobic_base': {
      // Low bucket: "Walk/bike flush", easy aerobic. Medium bucket:
      // "Tempo/aerobic — could be low if easier". Use intensity + name.
      const easy =
        workout?.intensity === 'Light' ||
        /flush|easy|zone\s*2|nasal|walk/i.test(workout?.name ?? '');
      if (easy) return 'low';
      return isPoorConditioning(ctx) ? 'high' : 'medium';
    }

    // ── Always low ──
    case 'gunshow':
    case 'prehab':
    case 'recovery':
    case 'rest':
      return 'low';

    // ── Unknown content: medium (visible in audits without inflating
    //    hard-day counts on misclassification) ──
    case 'other':
    default:
      return 'medium';
  }
}
