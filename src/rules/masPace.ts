/**
 * THE ATHLETE'S OWN PACE — the read half of the selected aerobic time trial.
 *
 * ## WHY THIS EXISTS
 *
 * `docs/RULINGS_NOT_IN_THE_APP_2026-08-13.md` C2, verbatim: *"The athlete's 2km
 * time trial is collected and never used."* The receipt was `deriveMas`
 * (`data/twoKmTimeTrial.ts`) having **zero production callers**, and the athlete
 * impact was that a conditioning card read the literal authored string
 * `Intensity: 110% MAS` — a percentage of a number nobody had ever been told.
 *
 * Sam ruled the work itself on 2026-07-29, ruling 6
 * (`docs/STAGE_C_TIME_TRIAL_RULINGS_2026-07-29.md`): *"deriving per-athlete
 * paces into the %MAS template rows"* is a Stage B requirement. This is that
 * requirement, and nothing more than it.
 *
 * ## WHY IT DERIVES AT THE READ AND NEVER AT GENERATION
 *
 * The north star: **store only decisions, derive everything else.** A pace
 * written into a composed row's notes at generation time is a SECOND
 * representation of the athlete's pace — the same defect `twoKmTimeTrial.ts`'s
 * own header exists to forbid — and it rots the moment they log a faster 2km or
 * change their experience level. Derived here, the stored program holds no pace
 * at all and every card reprices itself the instant the answer moves.
 *
 * So this module is a pure function of (the words already on the card, the
 * athlete's selected 2km/3km result, their legacy 2km answer and their level).
 * It stores nothing, and generation does not import it.
 *
 * ## AND IT DOES NOT ANSWER Q-001
 *
 * `docs/RULINGS_REGISTRY.md` Q-001 — *"%MAS: RANGE OR BINARY?"* — is OPEN, and
 * it is the disagreement between the templates' authored ranges (`90–100% MAS`)
 * and `masCopy.ts`'s unauthored binary (`≤30s → 110%`). **This module reads
 * whichever percentage the card is ALREADY SHOWING** — it never chooses one.
 * `masCopy` is not imported here and gains no consumer. If Sam ever rules the
 * binary, the intensity string changes and the pace follows it for free, because
 * the pace is derived from the string rather than from a second opinion about
 * it. That is the whole reason the parse reads the rendered words instead of
 * re-deriving the percentage from the dose.
 */

import { paceMinPerKm } from './conditioningDisplay';
import { deriveMas } from '../data/twoKmTimeTrial';
import { deriveMasFromPerformanceTesting, selectedAerobicResult } from '../data/performanceTests';
import type { ExperienceLevel, TwoKmTimeTrialAnswer } from '../types/domain';
import { registerSignedCopy, signedCopy, type SignedCopy,
  derivedNumericText,
  type DerivedNumericText,
} from './signedCopy';

/**
 * THE WORDS ARE THE TERMINAL'S AND THIS SAYS SO.
 *
 * Sam ruled the FEATURE (ruling 6), the NUMBER (ruling 2, MAS = 2km average
 * speed × 1.00), and the athlete-facing `Your target` label in R-286's approved
 * conditioning mock. They remain registered as `derived_number` because the
 * changing figures are computed from the athlete's own result at read time.
 */
const TARGET_PROVENANCE = 'Sam: docs/STAGE_C_TIME_TRIAL_RULINGS_2026-07-29.md '
  + 'rulings 2 and 6 own the MAS calculation and derived target; '
  + 'docs/RULINGS_REGISTRY.md R-286 owns the athlete-facing Your target label.';

/**
 * MEASURED AND ESTIMATED ARE TWO DIFFERENT SENTENCES, AND THAT IS THE POINT.
 *
 * `DerivedMas.source` was written to carry exactly this distinction — its own
 * comment says *"so consumers can say 'your MAS' or 'our estimate' honestly
 * rather than presenting a guess with the same confidence as a measurement"* —
 * and until now it had no consumer either. An athlete who skipped the trial is
 * reading Sam's default for their experience level, and the word `Estimated` is
 * the only thing that tells them so.
 */
export const MAS_PACE_COPY = {
  measuredRange: 'part.row.conditioning.pace.measured.range',
  measuredSingle: 'part.row.conditioning.pace.measured.single',
  estimatedRange: 'part.row.conditioning.pace.estimated.range',
  estimatedSingle: 'part.row.conditioning.pace.estimated.single',
} as const;

registerSignedCopy([
  {
    id: MAS_PACE_COPY.measuredRange,
    source: 'derived_number',
    provenance: TARGET_PROVENANCE,
    /* ⚠ **km/h UNDER A PACE LABEL — SAM, 2026-08-20.** *"The pace must be
     * calculated using `60 / kmh`, rounded to the nearest second. Do not
     * relabel km/h values as min/km."* This line called a SPEED a pace and
     * printed it in km/h with a hyphen; a footballer reading "Your pace:
     * 13.5-15 km/h" is being handed the wrong quantity in the wrong unit with
     * the wrong dash. Now `m:ss–m:ss min/km`, faster end first. */
    text: 'Your target: {fast}–{slow} min/km',
  },
  {
    id: MAS_PACE_COPY.measuredSingle,
    source: 'derived_number',
    provenance: TARGET_PROVENANCE,
    text: 'Your target: {pace} min/km',
  },
  {
    id: MAS_PACE_COPY.estimatedRange,
    source: 'derived_number',
    provenance: TARGET_PROVENANCE,
    text: 'Estimated target: {fast}–{slow} min/km',
  },
  {
    id: MAS_PACE_COPY.estimatedSingle,
    source: 'derived_number',
    provenance: TARGET_PROVENANCE,
    text: 'Estimated target: {pace} min/km',
  },
]);

/** The %MAS band an authored intensity string prescribes. Equal ends = a point. */
export interface MasBand {
  readonly lowPct: number;
  readonly highPct: number;
}

/**
 * THE PARSE REQUIRES THE LITERAL TOKEN `MAS`.
 *
 * Fourteen distinct authored intensity strings mention MAS; twenty-odd more
 * carry a percentage that is NOT a MAS percentage — `95–100% maximal`,
 * `70–85% HRmax`, `90–95% — mechanics-gated`. Pricing a max-velocity sprint as
 * 95% of a 2km pace would be worse than saying nothing.
 *
 * **THE TOKEN IS THE WHOLE DEFENCE, AND THAT IS MEASURED.** Deleting `MAS` from
 * both patterns reds four cells in `[23]`. The other two things this line could
 * be credited with are NOT what refuses those rows, and the comment says so
 * rather than borrowing their credit: dropping `\b`, adding `/i`, or doing both
 * at once leaves all 144 cells green. `maximal` and `MAS` diverge at the third
 * letter (`x` / `S`), so case never came into it — a first draft of this comment
 * claimed otherwise and the mutation run refuted it. `\b` stays as cheap cover
 * against a future authored word that STARTS `MAS…`, which is a hazard nothing
 * in the sheet exhibits today.
 *
 * En dash, em dash and hyphen are all admitted because the sheet uses `–`
 * throughout and a future row may not.
 */
const MAS_RANGE = /(\d+)\s*[–—-]\s*(\d+)\s*%\s*MAS\b/;
const MAS_SINGLE = /(\d+)\s*%\s*MAS\b/;

/**
 * The band the card is showing, or `null` when it is not showing one.
 *
 * LEFTMOST WINS, AND THE ORDERING IS THE REASON THIS IS SAFE. Two authored rows
 * put a second percentage after the MAS one (`65–80% MAS; 70–85% HRmax`), and
 * `joinNotes` puts the `Intensity:` line ahead of the effort cue — one of which
 * says *"pace it off your actual MAS"* without a figure. Range is tried before
 * point, or `90–100% MAS` would price as a flat 90.
 */
export function parseMasBand(text: string): MasBand | null {
  const range = MAS_RANGE.exec(text);
  if (range) return { lowPct: Number(range[1]), highPct: Number(range[2]) };
  const single = MAS_SINGLE.exec(text);
  if (single) return { lowPct: Number(single[1]), highPct: Number(single[1]) };
  return null;
}

/** Speed to run at, in km/h, at a given percentage of the athlete's MAS. */
export function speedForPercent(masKmh: number, percent: number): number {
  return Math.round((masKmh * percent) / 10) / 10;
}

/**
 * THE PACE AT A %MAS, AS THE ATHLETE RUNS IT — `60 / kmh`, to the nearest
 * second, `m:ss`.
 *
 * Sam, 2026-08-20. `speedForPercent` above is a SPEED and stays one — the
 * exposure engine and the legality checks read km/h. What reaches the athlete
 * is the pace, because that is the number on their watch.
 */
export function paceForPercent(masKmh: number, percent: number): DerivedNumericText {
  return derivedNumericText(paceMinPerKm(speedForPercent(masKmh, percent)));
}

export interface PersonalPaceArgs {
  /** The words already on the card — the row's notes, or a bare intensity. */
  readonly intensityText: string | null | undefined;
  readonly answer: TwoKmTimeTrialAnswer | undefined;
  readonly performanceTesting?: import('../types/domain').PerformanceTesting;
  /** Undefined only for a profile that has not answered it — see below. */
  readonly experienceLevel: ExperienceLevel | undefined;
}

/**
 * The one line the athlete reads under a %MAS prescription, or `null`.
 *
 * `null` in three cases, and each is a refusal rather than a fallback:
 *   • the row prescribes no %MAS — nothing to translate;
 *   • the athlete has no measured time AND no experience level, so the only
 *     available pace would be an invented one. Sam's no-clamp ruling is about
 *     exactly this: the app does not substitute its own number and carry on.
 *     A profile in that state cannot exist through onboarding (both fields are
 *     required) but a partial mirror can, and it must go quiet, not guess.
 */
export function personalPaceLine(args: PersonalPaceArgs): SignedCopy | null {
  if (!args.intensityText) return null;
  const band = parseMasBand(args.intensityText);
  if (!band) return null;

  const measuredPerformance = selectedAerobicResult(args.performanceTesting) !== null;
  const measured = measuredPerformance
    || (args.answer?.seconds !== null && args.answer?.seconds !== undefined);
  if (!measured && !args.experienceLevel) return null;

  // `experienceLevel` is only read on the unmeasured branch, which the guard
  // above has already made non-null. The cast keeps the ladder in `deriveMas`
  // as the single owner of "what does a skipped trial get".
  const mas = measuredPerformance
    ? deriveMasFromPerformanceTesting(
      args.performanceTesting,
      args.answer,
      args.experienceLevel as ExperienceLevel,
    )
    : deriveMas(args.answer, args.experienceLevel as ExperienceLevel);
  /* THE HIGHER %MAS IS THE FASTER PACE, so it leads the range: 90–100% MAS on a
   * 15 km/h athlete reads `4:00–4:27 min/km`, not `4:27–4:00`. */
  const slow = paceForPercent(mas.masKmh, band.lowPct);
  const fast = paceForPercent(mas.masKmh, band.highPct);
  const estimated = mas.source === 'experience_default';

  if (slow === fast) {
    return signedCopy(
      estimated ? MAS_PACE_COPY.estimatedSingle : MAS_PACE_COPY.measuredSingle,
      { pace: fast },
    );
  }
  return signedCopy(
    estimated ? MAS_PACE_COPY.estimatedRange : MAS_PACE_COPY.measuredRange,
    { fast, slow },
  );
}
