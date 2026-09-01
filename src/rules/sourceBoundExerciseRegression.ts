import type { OnboardingData } from '../types/domain';

/**
 * Regressions that are legal only as a replacement for one named source lift.
 *
 * This is deliberately not part of the global experience crosswalk. The
 * Band-Assisted Pull-Up carries Sam's one exercise-specific exception: all
 * complete beginners, plus female athletes at 1-2 years. It may not leak into
 * Add or become a general Chin-Up/vertical-pull alternative.
 */
export interface SourceBoundExerciseRegression {
  readonly source: string;
  readonly target: string;
}

export const SOURCE_BOUND_EXERCISE_REGRESSIONS: readonly SourceBoundExerciseRegression[] = [
  { source: 'Pull-Ups', target: 'Band-Assisted Pull-Up' },
];

export const BAND_ASSISTED_PULL_UP_ELIGIBILITY = {
  completeBeginner: true,
  developingFemale: true,
};

export function sourceBoundRegressionIsEligible(
  target: string,
  profile: Pick<OnboardingData, 'experienceLevel' | 'gender'> | null | undefined,
): boolean {
  if (target !== 'Band-Assisted Pull-Up') return false;
  return (BAND_ASSISTED_PULL_UP_ELIGIBILITY.completeBeginner
      && profile?.experienceLevel === 'Complete beginner')
    || (BAND_ASSISTED_PULL_UP_ELIGIBILITY.developingFemale
      && profile?.experienceLevel === '1-2 years' && profile?.gender === 'female');
}

export function sourceBoundRegressionFor(
  source: string,
  profile: Pick<OnboardingData, 'experienceLevel' | 'gender'> | null | undefined,
): SourceBoundExerciseRegression | null {
  const relation = SOURCE_BOUND_EXERCISE_REGRESSIONS.find(row => row.source === source) ?? null;
  return relation && sourceBoundRegressionIsEligible(relation.target, profile) ? relation : null;
}

export function sourceBoundRegressionTarget(name: string): boolean {
  return SOURCE_BOUND_EXERCISE_REGRESSIONS.some(row => row.target === name);
}

/** Keep the source lift's deterministic selection position for its regression. */
export function sourceBoundSelectionIdentity(name: string): string {
  return SOURCE_BOUND_EXERCISE_REGRESSIONS.find(row => row.target === name)?.source ?? name;
}

export function sourceBoundAutomaticIdentityFor(
  source: string,
  availableCandidates: readonly string[],
  profile: Pick<OnboardingData, 'experienceLevel' | 'gender'> | null | undefined,
): string {
  const relation = sourceBoundRegressionFor(source, profile);
  return relation && availableCandidates.includes(relation.target) ? relation.target : source;
}

export function sourceBoundRegressionAllows(args: {
  readonly target: string;
  readonly source?: string | null;
  readonly profile: Pick<OnboardingData, 'experienceLevel' | 'gender'> | null | undefined;
}): boolean {
  const relation = SOURCE_BOUND_EXERCISE_REGRESSIONS.find(row => row.target === args.target);
  return !!relation
    && relation.source === args.source
    && sourceBoundRegressionIsEligible(relation.target, args.profile);
}

/** Replace the source candidate with its regression without changing the slot. */
export function applySourceBoundAutomaticRegression(
  candidates: readonly string[],
  profile: Pick<OnboardingData, 'experienceLevel' | 'gender'> | null | undefined,
): readonly string[] {
  let next = [...candidates];
  for (const relation of SOURCE_BOUND_EXERCISE_REGRESSIONS) {
    const eligible = sourceBoundRegressionIsEligible(relation.target, profile);
    next = next.filter(name => name !== relation.target && (!eligible || name !== relation.source));
    if (eligible && candidates.includes(relation.target)) {
      const sourceIndex = candidates.indexOf(relation.source);
      next.splice(sourceIndex < 0 ? 0 : Math.min(sourceIndex, next.length), 0, relation.target);
    } else if (!eligible && candidates.includes(relation.source) && !next.includes(relation.source)) {
      next.push(relation.source);
    }
  }
  return next;
}
