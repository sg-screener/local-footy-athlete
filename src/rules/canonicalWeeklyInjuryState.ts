/**
 * The weekly compiler's complete semantic injury input.
 *
 * Raw onboarding injuries and accepted injury facts are translated here once.
 * Weekly specialists consume the decisions below; they do not inspect body-area
 * copy or graduate severity independently. Session-level row recomposition is a
 * separate specialist and deliberately remains outside this weekly policy.
 */
import type { InjuryKey } from '../data/exerciseTags';
import type { OnboardingData, OnboardingInjury } from '../types/domain';
import {
  applyGenerationConstraintsToProfile,
  type GenerationConstraintContext,
} from '../utils/generationConstraints';
import {
  injurySeverityReducesAffectedWork,
  injurySeverityRemovesRiskyWork,
  onboardingInjurySeverityScore,
} from './injurySeverityBands';
import type { PowerInjuryInput } from './powerPrimerPolicy';
import type { MainStrengthPattern } from './strengthPatternContributions';

export interface CanonicalWeeklyInjuryPolicy {
  readonly prohibitedPatterns: readonly MainStrengthPattern[];
  readonly blocksAppSprint: boolean;
  readonly lowerBodyRestricted: boolean;
  readonly upperBodyRestricted: boolean;
}

export interface CanonicalWeeklyInjuryState extends CanonicalWeeklyInjuryPolicy {
  readonly kind: 'injury';
  /** Compatibility projection for content selectors that still consume profile injuries. */
  readonly mergedProfileInjuries: readonly OnboardingInjury[];
  /** Correctly shaped power-policy inputs; never cast from onboarding injuries. */
  readonly powerInjuries: readonly PowerInjuryInput[];
  /** Semantic exercise-pool exclusions authored by the accepted injury door. */
  readonly activeInjuryKeys: readonly InjuryKey[];
}

const UPPER_BODY = /shoulder|elbow|wrist|hand|upper arm|pec|rotator|forearm|rib|neck/i;
const LOWER_BODY = /foot|ankle|achilles|calf|shin|knee|quad|hamstring|groin|adductor|hip|glute|lower back|lowerback|lumbar|leg/i;
const SPRINT_TRIGGER = /\b(sprint|speed|max velocity|running|cod|change of direction|cutting|jumping)\b/i;

function uniquePatterns(values: readonly MainStrengthPattern[]): MainStrengthPattern[] {
  return Array.from(new Set(values));
}

export function canonicalWeeklyInjuryStateFrom(args: {
  profile: Pick<OnboardingData, 'injuries'>;
  generationConstraints?: GenerationConstraintContext;
}): CanonicalWeeklyInjuryState {
  const mergedProfile = applyGenerationConstraintsToProfile(
    args.profile as OnboardingData,
    args.generationConstraints,
  );
  const mergedProfileInjuries = [...(mergedProfile.injuries ?? [])];
  const prohibited: MainStrengthPattern[] = [];

  for (const injury of args.generationConstraints?.injuries ?? []) {
    if (!injury.removeRiskyWork && !injury.pauseAffectedTraining) continue;
    const keys = new Set(injury.injuryKeys);
    if (injury.region === 'upper_body') {
      prohibited.push('push');
      if (injury.pauseAffectedTraining) prohibited.push('pull');
    }
    if (injury.region === 'lower_body' || injury.region === 'back_midline') {
      prohibited.push('squat', 'hinge');
    }
    if (keys.has('shoulder')) prohibited.push('push');
    if (keys.has('hamstring')) prohibited.push('hinge');
    if (keys.has('knee')) prohibited.push('squat');
  }

  for (const injury of args.profile.injuries ?? []) {
    if (!injurySeverityRemovesRiskyWork(onboardingInjurySeverityScore(injury))) continue;
    const text = `${injury.bodyArea} ${injury.description ?? ''}`;
    if (UPPER_BODY.test(text)) prohibited.push('push');
    if (LOWER_BODY.test(text)) prohibited.push('squat', 'hinge');
  }

  const prohibitedPatterns = uniquePatterns(prohibited);
  const lowerBodyRestricted = mergedProfileInjuries.some((injury) =>
    injurySeverityReducesAffectedWork(onboardingInjurySeverityScore(injury)) &&
      LOWER_BODY.test(`${injury.bodyArea} ${injury.description ?? ''}`));
  const upperBodyRestricted = mergedProfileInjuries.some((injury) =>
    injurySeverityReducesAffectedWork(onboardingInjurySeverityScore(injury)) &&
      UPPER_BODY.test(`${injury.bodyArea} ${injury.description ?? ''}`));
  const activeSprintRestriction = (args.generationConstraints?.injuries ?? []).some((injury) =>
    (injury.region === 'lower_body' || injury.region === 'back_midline') &&
      (injury.pauseAffectedTraining || injury.removeRiskyWork ||
        SPRINT_TRIGGER.test(injury.triggers.join(' '))));

  return {
    kind: 'injury',
    mergedProfileInjuries,
    powerInjuries: mergedProfileInjuries.map((injury) => ({
      area: `${injury.bodyArea} ${injury.description ?? ''}`.trim(),
      severity: onboardingInjurySeverityScore(injury),
    })),
    activeInjuryKeys: [...(args.generationConstraints?.activeInjuryKeys ?? [])],
    prohibitedPatterns,
    blocksAppSprint:
      activeSprintRestriction || prohibitedPatterns.includes('squat') ||
      prohibitedPatterns.includes('hinge'),
    lowerBodyRestricted,
    upperBodyRestricted,
  };
}
