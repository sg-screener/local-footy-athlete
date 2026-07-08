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
  /** Usual club-training intensity from the profile. Default: moderate-hard. */
  teamTrainingIntensity?: TeamTrainingIntensity;
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
      // "Light = skills/touch, low running" — the one team-training
      // downshift the Bible allows. Otherwise assume moderate-to-hard.
      return ctx.teamTrainingIntensity === 'Light' ? 'medium' : 'high';
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
    case 'gunshow_prehab':
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
