/**
 * Canonical exercise-tag risk lookup for injury filters.
 *
 * Exercise metadata remains the source of truth. The only severity-aware
 * refinement here is the Bible's hamstring 6-7 rule: high-load hinges are
 * risky work even when their base tag is `caution` rather than `avoid`.
 */

import { getExerciseTags, type InjuryKey } from '../data/exerciseTags';
import { injurySeverityRemovesRiskyWork } from './injurySeverityBands';

/**
 * ── THE LIMB THE INJURY IS IN ─────────────────────────────────────────────
 *
 * A `Record` over the closed `InjuryKey` union rather than a list, so a new
 * region cannot be added without deciding which half of the body it is in.
 */
const LOWER_LIMB_BUCKET: Readonly<Record<InjuryKey, boolean>> = {
  groin: true, hip: true, quad: true, hamstring: true, knee: true,
  calf: true, 'ankle/foot': true,
  ribs: false, lowerBack: false, neck: false, shoulder: false,
  elbow: false, 'wrist/hand': false,
};

/**
 * ── SAM'S RULING, 2026-08-21 (R-124): CARRIES ARE OUT FOR A 7/10 KNEE ──────
 *
 * *"Farmer and suitcase carries are OUT for a 7/10 knee. Loaded walking is not
 * an appropriate fallback here. **Hold this in the shared safety authority, not
 * as a screen-specific exception.**"*
 *
 * So it lives HERE, in the one classifier both questions read
 * (`injuryPermitsExerciseAtSeverity` — may this be a replacement — and
 * `injuryWithholdsExistingRow` — must this row come out), and not in the
 * surface that happened to surface the defect.
 *
 * ⚠ **THIS DOES NOT WEAKEN SAM'S MATRIX; IT REFUSES SOMETHING THE MATRIX
 * ALLOWS.** `Farmer Carry`, `Suitcase Carry`, `Bear Carry` and `Overhead Carry`
 * are each rated `good` for knee, hip, quad, hamstring, calf and ankle/foot in
 * his own sheet, which is why the ladder reached for them first: measured
 * 2026-08-21, they were the ONLY patterns the athlete's week carried none of.
 * The matrix rates the LOADING; it does not encode that all four are performed
 * WALKING, which is the part that disqualifies them for a limb that cannot take
 * a stride. The refusal is a second, narrower gate on top of an untouched
 * sheet — the same shape as the hamstring heavy-hinge rule below it.
 *
 * It is identified from the DATA (`movement: 'carry'` is exactly those four),
 * never from a name list.
 *
 * ⚠ **AND KNEELING, WHICH IS AN INFERENCE FROM SAM'S CONDITIONAL AND IS FLAGGED
 * AS ONE.** *"Use … a safe non-kneeling dead-bug option instead of Ab Wheel if
 * Ab Wheel requires kneeling."* It does — an ab-wheel rollout is performed from
 * the knees — and the general form of that instruction is that kneeling on an
 * injured lower limb is no safer than walking on it. Nothing in the tags
 * records posture, so these are AUTHORED, with the reason beside them, and
 * there are exactly two in the whole app. **If Sam rules that kneeling is fine,
 * this half comes out and the carry half stays.**
 */
const KNEELING_POSITION_EXERCISES: readonly string[] = [
  'ab wheel',
  'woodchop (half kneeling)',
];

/**
 * Does this exercise put the athlete's weight or load through a limb that
 * cannot take it — walking under load, or kneeling on it — at a band that has
 * already removed risky work? Read by `classifyExerciseRiskForBucket` only.
 */
function loadedThroughTheInjuredLimb(args: {
  exerciseName: string;
  bucket: InjuryKey;
  severity: number | undefined;
  movement: string;
}): boolean {
  if (args.severity === undefined) return false;
  if (!injurySeverityRemovesRiskyWork(args.severity)) return false;
  if (!LOWER_LIMB_BUCKET[args.bucket]) return false;
  if (args.movement === 'carry') return true;
  return KNEELING_POSITION_EXERCISES.includes(args.exerciseName.trim().toLowerCase());
}

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

  /* R-124 — loaded walking and kneeling, on a lower limb, from 6-7 up. It sits
   * ABOVE the `good` return below on purpose: these four carries are rated
   * `good` and would otherwise be the ladder's first choice. */
  if (loadedThroughTheInjuredLimb({ exerciseName, bucket, severity, movement: tags.movement })) {
    return 'avoid';
  }

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
 * **THE SHEET OUTRANKS THE SECTION'S NAMED SWAP EXAMPLES FROM 6-7 UP.** Sam,
 * 2026-08-20: *"At 6-7/10, the typed injury-risk sheet wins. Never offer Hip
 * Thrust — or any exercise — the sheet marks risky for that injured area, even
 * if an older example says otherwise. Walk down the ladder to the nearest legal
 * option; if none exists, omit honestly."*
 * BIBLE_ANCHOR: injury_sheet_outranks_swap_examples
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

/**
 * ── MUST THIS ROW, ALREADY ON THE ATHLETE'S SESSION, BE TAKEN OUT? ──────────
 *
 * **TWO QUESTIONS WERE SHARING ONE PREDICATE, AND THEY DISAGREE ON EXACTLY ONE
 * ANSWER: `unknown`.** Sam, 2026-08-20, on a screenshot: *"'Breathing Reset is
 * unsafe with your hamstring' appears wrong and may expose a broader
 * classification defect."* It did.
 *
 *   **MAY THIS BE A REPLACEMENT?** — `injuryPermitsExerciseAtSeverity` above.
 *   `unknown` is refused, and rightly: an injury substitution is the last place
 *   in this app to guess, and there is always another rung to try.
 *
 *   **MUST THIS EXISTING ROW COME OUT?** — this function. `unknown` is ALLOWED,
 *   because refusing it invents a restriction out of absent data. There is no
 *   other rung to fall to here: the answer is taken away from the athlete and
 *   the row is struck off their session.
 *
 * ⚠ **THE COST OF GETTING THIS BACKWARDS WAS MEASURED, NOT ARGUED.** `unknown`
 * means "no `EXERCISE_TAGS` entry", and **70 of the 90 pooled and conditioning
 * names have none** — every conditioning format in the app, plus the swap
 * surface's own `Breathing Reset` literal. So every one of them was being marked
 * *"not safe with your <region> right now"* on the athlete's session, for every
 * injury, at every active band, purely because nobody had written a row in a
 * table. `classifyExerciseRiskForBucket`'s own comment already says the rule
 * — *"DO NOT 'FIX' THIS BY MAKING `unknown` RISKY … If you want the gap closed,
 * close it in the DATA"* — and this is the caller that was breaking it.
 *
 * ⚠ **THE LOADED GAP IS NOT LEFT OPEN.** The same comment records why: every
 * loadable untagged row is already refused before it is ever chosen, by
 * `PoolExercise.contraindications` in `sessionBuilder`. What `unknown` covers
 * here is stretches, breathing, foam rolling and conditioning formats.
 *
 * WRITER: none, pure. READERS: `tapSwapHierarchy.injuryRequiresChange` (must
 * this row change) and `rules/injuryWithheldRows` (must it be withheld).
 * TEST: `test:session-injury-review` section [11].
 */
export function injuryWithholdsExistingRow(
  exerciseName: string,
  bucket: InjuryKey,
  severity: number,
): boolean {
  const risk = classifyExerciseRiskForBucket(exerciseName, bucket, severity);
  if (risk === 'unknown') return false;
  if (risk === 'avoid') return true;
  if (risk === 'good') return false;
  return injurySeverityRemovesRiskyWork(severity);
}
