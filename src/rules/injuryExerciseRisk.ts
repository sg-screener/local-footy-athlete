/**
 * Canonical exercise-tag risk lookup for injury filters.
 *
 * Exercise metadata remains the source of truth. The only severity-aware
 * refinement here is the Bible's hamstring 6-7 rule: high-load hinges are
 * risky work even when their base tag is `caution` rather than `avoid`.
 */

import { getExerciseTags, type InjuryKey } from '../data/exerciseTags';
import { injurySeverityRemovesRiskyWork } from './injurySeverityBands';

export type InjuryExerciseRisk = 'avoid' | 'caution' | 'good' | 'unknown';

export function classifyExerciseRiskForBucket(
  exerciseName: string,
  bucket: InjuryKey,
  severity?: number,
): InjuryExerciseRisk {
  if (!exerciseName) return 'unknown';
  const tags = getExerciseTags(exerciseName);
  if (!tags) return 'unknown';

  const rating = tags.injury[bucket];
  if (rating === 'avoid') return 'avoid';

  if (rating === 'caution') {
    const limitingHamstringHeavyHinge =
      bucket === 'hamstring' &&
      severity !== undefined &&
      injurySeverityRemovesRiskyWork(severity) &&
      tags.movement === 'hinge' &&
      tags.load === 'high';
    return limitingHamstringHeavyHinge ? 'avoid' : 'caution';
  }

  return 'good';
}
