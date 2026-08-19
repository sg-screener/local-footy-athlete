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
  // the deleted resolver-level filter counted only `avoid`/`caution` as risky. So a
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

/**
 * ── MAY THIS EXERCISE BE USED WHILE THAT REGION IS AT THAT SEVERITY? ────────
 *
 * **THE ONE OWNER OF THE LEGALITY QUESTION, BECAUSE IT HAD TWO AND THEY
 * DISAGREED.** `assessTapSwapCandidateSafety` decided it from a two-value level
 * on `TapSwapEnvironment`, and `injurySessionClassifier` decided it again from
 * the severity — so the finer of the two was simply overruled by the coarser,
 * and Sam's own knee swap could be chosen by one and refused by the other.
 *
 * The rule is his four bands, read whole (`LFA_PROGRAMMING_BIBLE.md` Section 8,
 * "General severity rules"):
 *
 *   **1-3** *"Keep most training the same. Avoid only the exact movement or
 *   trigger that flares it up."* -> only an `avoid` rating is refused.
 *
 *   **4-5** *"Reduce load, volume, range, speed or intensity slightly. Swap
 *   obvious aggravators. **Keep safe work in.**"* -> `caution` work is still
 *   usable, and it is what makes a shoulder-friendly press reachable for a 4/10
 *   shoulder instead of a squat.
 *
 *   **6-7** *"Remove risky work through the area; keep unaffected work."* ->
 *   `caution` work through that region goes, whatever its load.
 *
 *   ⚠ **A LOOSER READING OF THIS BAND WAS TRIED AND REFUTED BY MEASUREMENT.**
 *   The band also says *"Reduce or remove high-speed, heavy, high-impact or
 *   high-volume work through that area"*, which reads as *"only the HEAVY
 *   `caution` work goes"* — and it would have reconciled the three
 *   `test:tap-swap-hierarchy` cells that have been red on `main` since Sam's
 *   matrix landed, because `Hip Thrusts` (`knee: 'caution'`, moderate load) is
 *   his verbatim answer to *"Heavy knee-dominant work"*.
 *
 *   **IT SHIPPED THREE OF HIS OWN BAD SWAPS.** Measured immediately
 *   (`npm run test:tap-swap-hierarchy`, 3 fails -> 8): a 7/10 knee was offered
 *   **`Broad Jumps`** for `Box Jumps` — *"Knee pain from jumping -> more jump
 *   contacts"* — a 7/10 hamstring was offered **`Single-Leg RDL`** — *"Avoid /
 *   reduce: RDLs/deadlifts"* — and a 6/10 shoulder was offered
 *   **`Close Grip Bench`** for a bench press. Low load does not make a movement
 *   stop going through the area.
 *
 *   **SO THE THREE RED CELLS ARE A REAL CONFLICT BETWEEN TWO THINGS SAM
 *   AUTHORED**, not a defect in this function: his per-region good-swap prose
 *   names `Hip Thrusts` for knee and *"some pulling"* for shoulder, and his
 *   ruled matrix rates both `caution` for those regions. That is a question for
 *   him, and it is carried in `docs/STATUS_FINISH_INJURY.md` rather than
 *   answered here.
 *
 *   **8-10** *"Pause affected training... Use rest, recovery, or clearly
 *   unaffected training only."* -> `good` only.
 *
 * `unknown` — a name Sam's matrix does not rate — is refused at every active
 * band. A row that cannot be SHOWN safe is not a safe replacement, and an injury
 * substitution is the last place in this app to guess.
 */
export function injuryPermitsExerciseAtSeverity(
  exerciseName: string,
  bucket: InjuryKey,
  severity: number,
): boolean {
  const risk = classifyExerciseRiskForBucket(exerciseName, bucket, severity);
  if (risk === 'avoid' || risk === 'unknown') return false;
  if (risk === 'good') return true;
  return !injurySeverityRemovesRiskyWork(severity);
}
