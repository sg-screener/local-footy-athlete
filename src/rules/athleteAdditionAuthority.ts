/** An accepted Add overrides the injuries the athlete had already reported.
 * Unrelated facts cannot revoke that decision. A later relevant injury still
 * uses the ordinary injury policy; adding the exercise again overrides it.
 */
import type { WorkoutExercise } from '../types/domain';
import type { InjuryEpisodeV1 } from './injuryEpisode';
import { semanticFingerprint } from '../utils/programSemanticSnapshot';

export function additionOverridesInjury(row: WorkoutExercise, injury: InjuryEpisodeV1): boolean {
  return !!row.athleteAdditionId
    && !!row.additionFactVersions?.includes(semanticFingerprint(injury));
}
