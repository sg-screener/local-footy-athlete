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
  // ⚠ `unknown` MEANS "NOT IN THE TAGS MAP", AND CALLERS TREAT IT AS ALLOWED —
  // `injuryWorkoutFilter.ts:187,223` count only `avoid`/`caution` as risky. So a
  // MISSING tag and a SAFE tag are indistinguishable HERE.
  //
  // THAT IS NOT A SAFETY GAP, AND THE REASON IS IN ANOTHER FILE — which is
  // exactly why this comment exists. **THERE ARE TWO INJURY MECHANISMS AT TWO
  // LAYERS, AND NEITHER USED TO NAME THE OTHER:**
  //
  //   1. THIS ONE — a FILTER over an already-built week, reading `EXERCISE_TAGS`.
  //   2. `PoolExercise.contraindications`, read by `sessionBuilder.ts:408`
  //      (`if (ex.contraindications.some(c => injuryTags.has(c))) return false`) —
  //      a SELECTOR that refuses the exercise before it is ever chosen.
  //
  // MEASURED 2026-08-13: **34 of 90 pooled exercises have no `EXERCISE_TAGS`
  // entry**, so this function returns `unknown` for every one of them — and every
  // loadable one is covered by mechanism 2 (`Jefferson Curl` → lower_back,
  // hamstring, neck; `Dead Hang` → shoulder, elbow; `ATG Split Squat` → knee,
  // hip; `Dumbbell Pullovers` → shoulder, ribs). The rest are stretches,
  // breathing and foam rolling.
  //
  // **DO NOT "FIX" THIS BY MAKING `unknown` RISKY.** That would refuse every
  // mobility row in the app on the strength of absent data, which is the
  // invented-restriction failure the equipment filter's own comment warns about.
  // If you want the gap closed, close it in the DATA — add the tag.
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
