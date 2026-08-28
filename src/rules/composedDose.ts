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
  TIMED_CARRY_PRESCRIPTIONS,
  type ComposedDoseCategory,
  type PoolSlotKey,
} from '../data/exercisePoolsStrength';
import { mainLiftSchemeForSlot } from './phaseRepSchemes';
import { composedIdentityFor } from './composedRowLegality';
import { equipmentRequiredFor } from '../data/exerciseEquipmentRequirement';
import type { OffseasonSubphase } from './offseasonSubphase';
import { estimateStartingWeight } from '../utils/loadEstimation';
import type { OnboardingData, SeasonPhase } from '../types/domain';
import { getExerciseTags } from '../data/exerciseTags';

export interface ComposedDose {
  readonly restSeconds?: number;
  readonly notes?: string;
  readonly sets: number;
  readonly repsMin: number;
  readonly repsMax: number;
  readonly category: ComposedDoseCategory;
  /** Set only where a ruling limits the row by quality rather than by count. */
  readonly qualityLimit?: 'stop_when_speed_or_technique_drops';
  /**
   * Sam, 2026-08-23 (slice 5): an isometric filling a strength seat keeps its
   * authored UNIT — `repsMin/repsMax` are SECONDS (or minutes) when this is
   * set, exactly as the authored pool entry states them. Absent means reps,
   * which is every other row unchanged. ('distance' left this union with
   * R-133 — *"carries all timed"* — when Suitcase Carry's metres became
   * seconds; the Primer's Acceleration keeps distance outside this path.)
   */
  readonly prescriptionType?: 'reps' | 'duration' | 'duration_minutes';
  readonly perSide?: boolean;
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

let timedHoldByIdentity: Map<string, ComposedDose> | null = null;

/**
 * The authored duration dose for an identity, when any authored pool entry
 * prescribes one. Read off `POOL_REGISTRY` (the prehab/recovery pools — the
 * strength pools carry no durations), keyed by composed identity, first
 * authored entry wins. Lazy for the same import-order reason as the category
 * map above.
 */
function authoredTimedHoldFor(identity: string): ComposedDose | null {
  if (!timedHoldByIdentity) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { POOL_REGISTRY } = require('../data/exercisePools') as {
      POOL_REGISTRY: Record<string, readonly {
        name: string; sets: number; repsMin: number; repsMax: number;
        prescriptionType?: string; perSide?: boolean;
      }[]>;
    };
    const built = new Map<string, ComposedDose>();
    for (const entries of Object.values(POOL_REGISTRY)) {
      for (const entry of entries) {
        if (entry.prescriptionType !== 'duration'
          && entry.prescriptionType !== 'duration_minutes') continue;
        const key = composedIdentityFor(entry.name);
        if (built.has(key)) continue;
        built.set(key, {
          sets: entry.sets,
          repsMin: entry.repsMin,
          repsMax: entry.repsMax,
          category: 'authored_timed_hold',
          prescriptionType: entry.prescriptionType,
          ...(entry.perSide ? { perSide: true } : {}),
        });
      }
    }
    // R-133 (Sam, 2026-08-23): *"carries all timed"*. The strength pools author
    // no doses, so the carries' timed prescriptions live in their own authored
    // table beside the carry pool — same law, second authored source. (The
    // 'distance' arm this loop briefly carried left with Suitcase Carry's
    // metres; the Primer's Acceleration row keeps distance without this module.)
    for (const carry of TIMED_CARRY_PRESCRIPTIONS) {
      const key = composedIdentityFor(carry.name);
      if (built.has(key)) continue;
      built.set(key, {
        sets: carry.sets,
        repsMin: carry.secondsMin,
        repsMax: carry.secondsMax,
        category: 'authored_timed_hold',
        prescriptionType: 'duration',
        ...(carry.perSide ? { perSide: true } : {}),
      });
    }
    timedHoldByIdentity = built;
  }
  return timedHoldByIdentity.get(composedIdentityFor(identity)) ?? null;
}

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
  const authored = getExerciseTags(input.identity)?.prescription;
  if (authored && !input.isMainLift) return { ...authored, category: 'authored_exercise' };
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
  // ── AN ISOMETRIC KEEPS ITS AUTHORED SECONDS — Sam, 2026-08-23 (slice 5) ──
  //
  // *"bosch hold and half copenhagen both show 2x15 but its an isometric not
  // a rep thing."* The prehab pools ALREADY author these rows in seconds
  // (Bosch Hold 2×20-30s, Copenhagen Plank (Half) 3×20-30s, per side); the
  // gap was that a hold filling a STRENGTH seat was dosed by the positional
  // rep ladder, which cannot say "seconds". The authored entry outranks the
  // ladder — the same authored-dose-bounds rule every other governed row
  // follows — and this closes the timed-hold case the passthrough comment
  // below has always named as special.
  const timedHold = authoredTimedHoldFor(input.identity);
  if (timedHold) return timedHold;
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
 * CAN THIS ATHLETE ACTUALLY LOAD THIS MOVEMENT?
 *
 * Asked of the ONE equipment owner and its corrected sheet — never a second
 * lookup. A movement whose authored kit the athlete HAS is loadable; a movement
 * that is legal only because it survives losing its load is not, and takes 0kg.
 */
function composedLoadIsReachable(identity: string, kit: readonly string[]): boolean {
  const required = equipmentRequiredFor(composedIdentityFor(identity));
  if (required === null) return true;          // unknown to the sheet — unchanged
  if (required.length === 0) return false;     // his convention: needs nothing
  const owned = new Set(kit);
  const satisfied = (entry: unknown): boolean =>
    Array.isArray(entry) ? entry.some((tag) => owned.has(tag)) : owned.has(entry as string);
  return required.every(satisfied);
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
  /** The athlete's resolved kit. R-083 decides whether a load is reachable. */
  readonly kit: readonly string[];
}): number {
  if (!args.profile) return 0;
  // ── R-083: A LOAD THE ATHLETE CANNOT REACH IS NOT A PRESCRIPTION ─────────
  //
  // **MEASURED 2026-08-14: an away athlete was authored `Single-Leg RDL @10kg`
  // while owning nothing.** `estimateStartingWeight` derives a working weight
  // from his strength answers and never asks what he owns, which was invisible
  // while every composed row read `@0kg`.
  //
  // The row's IDENTITY is already legal here — `composeWeek` selects only
  // through `composedRowIsLegal`, the one equipment owner — so this is about
  // the LOAD alone: a movement that is legal because it survives losing its
  // load (R-086's `BODYWEIGHT_CAPABLE`) is prescribed at **0kg** rather than at
  // a weight he has no way to hold. **An identity that intrinsically needs kit
  // he lacks never reaches this function**; if one ever did, the legality owner
  // — not this one — is what failed, and the composed row is refused upstream.
  if (!composedLoadIsReachable(args.identity, args.kit)) return 0;
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
