/**
 * THE COMPOSED ROW'S DOSE — resolved before authorship, by typed category.
 *
 * ## THE RULINGS THIS ENCODES
 *
 * **U-1, Sam VERBATIM (2026-08-14):** *"App wins because accessories are
 * differnt to single leg work - for example calf raises are accessories and
 * would fit the 10-20 rep range - but single leg rdl's are better in the 5-10
 * rep range."*
 *
 * **U-2, Sam VERBATIM (2026-08-14):** *"Keep the cut (75% / 90%)."*
 *
 * **U-3 and U-4 are SEAT-DRAFTED WORDING APPROVED BY SAM — not his words.**
 * U-3: a genuinely unloaded lower compound takes 2-3 x 10-20 and is NOT
 * reclassified as an isolation accessory. U-4: a Kettlebell Swing used as a
 * strength-side ballistic row takes 2-3 x 6-10 fast crisp reps, stopping when
 * speed or technique drops — not ordinary hypertrophy accessory work.
 *
 * ## THE OWNER IS A TYPED CATEGORY, NEVER A NAME
 *
 * `PoolEntry.doseCategory` is authored on the entry. `group` + `loadRatio`
 * cannot do this job: `Kettlebell Swings` shares `bilateral_hinge` with
 * `Hip Thrusts`, and `loadRatio: 0` says a row is unloaded without saying what
 * it is FOR. **No exercise-name regex appears in this module or reaches it.**
 */
import {
  STRENGTH_POOLS,
  type ComposedDoseCategory,
  type PoolSlotKey,
} from '../data/exercisePoolsStrength';
import { mainLiftSchemeForSlot } from './phaseRepSchemes';
import { composedIdentityFor } from './composedRowLegality';
import type { OffseasonSubphase } from './offseasonSubphase';
import { estimateStartingWeight } from '../utils/loadEstimation';
import type { OnboardingData, SeasonPhase } from '../types/domain';

export interface ComposedDose {
  readonly sets: number;
  readonly repsMin: number;
  readonly repsMax: number;
  readonly category: ComposedDoseCategory;
  /** Set only where a ruling limits the row by quality rather than by count. */
  readonly qualityLimit?: 'stop_when_speed_or_technique_drops';
}

/**
 * U-1's loaded band, phase by phase. All three sit inside the 5-10 he named.
 *
 * **⚠ OFF-SEASON IS 8-10, NOT THE OLD 8-15.** The retired constant let
 * off-season secondary work run to 15, which is outside his range. That is the
 * one authorised numerical change in this slice and it is named in the dose
 * differential rather than absorbed.
 */
const LOADED_LOWER_SECONDARY: Readonly<Record<SeasonPhase, readonly [number, number, number]>> = {
  'In-season': [3, 6, 8],
  'Pre-season': [3, 6, 10],
  'Off-season': [3, 8, 10],
};

/** U-1's own example: calf raises. Unchanged from Bible `:818`. */
const ISOLATION_ACCESSORY: readonly [number, number, number] = [2, 10, 20];
/** U-3, seat-drafted and approved. Same numbers, DIFFERENT category. */
const UNLOADED_LOWER_COMPOUND: readonly [number, number, number] = [2, 10, 20];
/** U-4, seat-drafted and approved. Quality-limited, and 2-3 sets not 3-5. */
const BALLISTIC_STRENGTH: readonly [number, number, number] = [3, 6, 10];

let categoryByIdentity: Map<string, ComposedDoseCategory> | null = null;

/** The authored category for an identity, read off the pool entry that owns it. */
export function composedDoseCategoryFor(rawName: string): ComposedDoseCategory | null {
  if (!categoryByIdentity) {
    const built = new Map<string, ComposedDoseCategory>();
    for (const slot of Object.keys(STRENGTH_POOLS) as PoolSlotKey[]) {
      for (const role of ['anchor', 'accessory'] as const) {
        for (const entry of STRENGTH_POOLS[slot][role].entries) {
          if (entry.doseCategory) built.set(composedIdentityFor(entry.name), entry.doseCategory);
        }
      }
    }
    categoryByIdentity = built;
  }
  return categoryByIdentity.get(composedIdentityFor(rawName)) ?? null;
}

export interface ComposedDoseInput {
  readonly identity: string;
  /** The composer's own decision about what this row IS on this day. */
  readonly isMainLift: boolean;
  /** The pool slot the row was selected for, when it has one. */
  readonly poolSlot: PoolSlotKey | null;
  readonly seasonPhase: SeasonPhase;
  readonly offseasonSubphase: OffseasonSubphase | null;
  /** The band the composer would otherwise author — used only where nothing rules. */
  readonly authoredFallback: readonly [number, number, number];
}

/**
 * ⚠ THE MAIN-LIFT ROLE OUTRANKS THE CATEGORY, and that is the resumed prompt's
 * own wording: *"A row used as a main lift follows the applicable main-lift
 * phase scheme, regardless of whether the movement is bilateral or
 * single-leg."* So a `Single-Leg RDL` leading a day is dosed by the phase table,
 * and the same movement supporting one takes U-1's loaded band.
 */
export function resolveComposedDose(input: ComposedDoseInput): ComposedDose {
  if (input.isMainLift && input.poolSlot) {
    const scheme = mainLiftSchemeForSlot(input.poolSlot, input.seasonPhase, input.offseasonSubphase);
    if (scheme) {
      return {
        sets: Math.min(scheme.setsMax, Math.max(scheme.setsMin, 3)),
        repsMin: scheme.repsMin,
        repsMax: scheme.repsMax,
        category: 'main_lift',
      };
    }
  }
  const category = composedDoseCategoryFor(input.identity);
  if (category === 'loaded_lower_secondary_compound') {
    const [sets, min, max] = LOADED_LOWER_SECONDARY[input.seasonPhase];
    return { sets, repsMin: min, repsMax: max, category };
  }
  if (category === 'unloaded_lower_compound') {
    const [sets, min, max] = UNLOADED_LOWER_COMPOUND;
    return { sets, repsMin: min, repsMax: max, category };
  }
  if (category === 'ballistic_strength') {
    const [sets, min, max] = BALLISTIC_STRENGTH;
    return {
      sets, repsMin: min, repsMax: max, category,
      qualityLimit: 'stop_when_speed_or_technique_drops',
    };
  }
  if (category === 'isolation_accessory') {
    const [sets, min, max] = ISOLATION_ACCESSORY;
    return { sets, repsMin: min, repsMax: max, category };
  }
  // Nothing authored for this identity: the composer's own band stands, and the
  // row is declared an isolation accessory only for reporting. A SPECIAL row —
  // Nordics, carries, timed holds — keeps its existing governed policy because
  // nothing here overrides a band the composer already authored for it.
  // ⚠ NO SILENT FALLTHROUGH. Nothing ruled overrides this identity, so the
  // composer's own authored band stands AND SAYS SO. Calling it an
  // `isolation_accessory` — which the first version did — was a programming
  // claim nobody made about `Cossack Squat` or `Scap Push-Up`. A SPECIAL row
  // (Nordics, carries, timed holds) also lands here and keeps its existing
  // governed policy, because nothing in this module overrides a band the
  // composer already authored for it.
  const [sets, min, max] = input.authoredFallback;
  return { sets, repsMin: min, repsMax: max, category: 'composer_authored_passthrough' };
}

/**
 * U-2, Sam VERBATIM: *"Keep the cut (75% / 90%)."*
 *
 * **APPLIES EXACTLY ONCE, and only to a governed main-lift anchor.** The
 * multiplier lives on the off-season subphase scheme; this function is the only
 * caller on the composed path, it runs before authorship, and the composed row
 * is never re-dosed afterwards — so it cannot stack on regeneration. Accessories
 * and unloaded rows are excluded by the `isMainLift`/`load > 0` tests rather
 * than by a list.
 */
export function applyOffseasonMainLiftLoad(args: {
  readonly load: number;
  readonly isMainLift: boolean;
  readonly poolSlot: PoolSlotKey | null;
  readonly seasonPhase: SeasonPhase;
  readonly offseasonSubphase: OffseasonSubphase | null;
}): number {
  if (!args.isMainLift || !args.poolSlot) return args.load;
  if (args.seasonPhase !== 'Off-season' || !args.offseasonSubphase) return args.load;
  if (!(args.load > 0)) return args.load;   // unloaded rows are never cut
  const scheme = mainLiftSchemeForSlot(args.poolSlot, args.seasonPhase, args.offseasonSubphase);
  const multiplier = scheme?.loadMultiplier ?? 1;
  if (multiplier >= 1) return args.load;
  return Math.round((args.load * multiplier) / 2.5) * 2.5;
}

/**
 * THE COMPOSED ROW'S FINAL LOAD — derived, and therefore naturally non-stacking.
 *
 *     resolved base working load  x  ONE governed phase multiplier  =  final load
 *
 * **THE DERIVATION IS THE GUARANTEE, NOT A CALL COUNT.** `applyOffseasonMainLiftLoad`
 * is pure arithmetic and cannot tell a cut load from an uncut one; asking it
 * twice cuts twice. So the final load is always recomputed FROM THE BASE — the
 * estimator's answer for this athlete and this exercise — rather than adjusted
 * in place. Running this on its own output gives the same number, because the
 * base it reads has not moved.
 *
 * **BASE-LOAD AUTHORITY, established 2026-08-14 before this was built:**
 * `estimateStartingWeight` -> `EXERCISE_LOAD_MAP` x the anchor 1RM, where the
 * anchor is `weightKg x ANCHOR_MULTIPLIER_RULING`'s ladder — Sam-authored
 * 2026-07-28, recorded in `docs/PROVENANCE_INVENTORY_2026-07-28.md`, held by
 * `test:anchor-multipliers` (38/38) and `test:load-ratio-rulings` (47/47), both
 * of which assert the ruling sentences still state the shipped numbers.
 *
 * A row the estimator calls TRUE BODYWEIGHT resolves to 0 and is never cut.
 */
export function resolveComposedLoad(args: {
  readonly identity: string;
  readonly isMainLift: boolean;
  readonly poolSlot: PoolSlotKey | null;
  readonly seasonPhase: SeasonPhase;
  readonly offseasonSubphase: OffseasonSubphase | null;
  readonly profile: OnboardingData | null;
}): number {
  if (!args.profile) return 0;
  const base = estimateStartingWeight(composedIdentityFor(args.identity), args.profile);
  if (base === null || !(base > 0)) return 0;
  return applyOffseasonMainLiftLoad({
    load: base,
    isMainLift: args.isMainLift,
    poolSlot: args.poolSlot,
    seasonPhase: args.seasonPhase,
    offseasonSubphase: args.offseasonSubphase,
  });
}
