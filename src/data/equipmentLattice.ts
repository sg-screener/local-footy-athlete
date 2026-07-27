/**
 * Equipment lattices and minimums — Sam-authored, 2026-07-28. ONE OWNER.
 *
 * WHAT THIS REPLACES. The same facts about equipment lived in three places:
 * `ROUND_INCREMENTS` and `MIN_WEIGHTS` in `loadEstimation`, and a byte-identical
 * `MIN_SUBPHASE_LOAD_BY_EQUIPMENT` in `defaultProgram`. Three representations of
 * one fact is three chances to drift, and the third had already been copied
 * rather than imported. Sam ruled they must live in one place; this is it.
 *
 * THE LATTICE IS WHAT THE ATHLETE CAN ACTUALLY LOAD. A gym does not stock a
 * 13.7 kg dumbbell, so an estimate of 13.7 is not a smaller error than 12.5 —
 * it is an unloadable number. The lattice is the set of real weights, and
 * rounding is ALWAYS DOWN: conservative by construction, and consistent with
 * the long-standing "starting too light is always better than too heavy".
 *
 * SCOPE — this bounds the ESTIMATE ONLY. An athlete's own entered weight is
 * never rounded, snapped or corrected. If they log 13.7 kg, the app shows
 * 13.7 kg. Their number is their number; the same law as render-truth, where
 * the app may not substitute its own claim for the athlete's.
 */

export type EquipmentKind =
  | 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'kettlebell' | 'bodyweight';

/**
 * How the available weights are spaced.
 *
 *   step  — a constant increment from zero (barbell 2.5, kettlebell 4 …)
 *   rungs — an explicit ladder, for equipment whose spacing changes partway up
 */
export type Lattice =
  | { readonly kind: 'step'; readonly stepKg: number }
  | { readonly kind: 'rungs'; readonly rungsKg: readonly number[] }
  | { readonly kind: 'none' };

export interface EquipmentSpec {
  readonly lattice: Lattice;
  /** Lightest weight worth prescribing. Below this, prescribe the minimum. */
  readonly minimumKg: number;
  /** True when `minimumKg` itself carries a Sam ruling. See MINIMUMS_PENDING. */
  readonly minimumRuled: boolean;
}

export const EQUIPMENT_LATTICE_RULING = {
  ruledOn: '2026-07-28',
  where: 'docs/PROVENANCE_INVENTORY_2026-07-28.md',
  latticeAnchor:
    'Barbell, cable and machine: round DOWN to nearest 2.5 kg. Dumbbell: available '
    + 'lattice is 1–10 kg in 1 kg steps, then 2.5 kg steps above 10 (12.5, 15, 17.5 …); '
    + 'round down to nearest available. Kettlebell: 4 kg steps (8, 12, 16, 20, 24 …), '
    + 'round down. Rounding is always DOWN — conservative by construction.',
  athleteWeightAnchor:
    'An athlete\'s own entered weight is never rounded, snapped, or corrected — their '
    + 'number is their number.',
} as const;

/** Dumbbells: 1 kg steps to 10, then 2.5 kg steps. Sam, 2026-07-28. */
const DUMBBELL_RUNGS: readonly number[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 37.5, 40, 42.5, 45, 47.5, 50,
  52.5, 55, 57.5, 60,
];

export const EQUIPMENT: Record<EquipmentKind, EquipmentSpec> = {
  // Every minimum is now Sam-ruled. Barbell 20 and kettlebell 8 came with the
  // floor-out ruling; dumbbell 1, cable 2.5 and machine 10 closed the table on
  // 2026-07-28. Nothing here is inherited from the pre-ruling values.
  barbell: { lattice: { kind: 'step', stepKg: 2.5 }, minimumKg: 20, minimumRuled: true },
  cable: { lattice: { kind: 'step', stepKg: 2.5 }, minimumKg: 2.5, minimumRuled: true },
  machine: { lattice: { kind: 'step', stepKg: 2.5 }, minimumKg: 10, minimumRuled: true },
  kettlebell: { lattice: { kind: 'step', stepKg: 4 }, minimumKg: 8, minimumRuled: true },
  // 1 kg matches the lattice start. Before Sam ruled it the minimum was 5 while
  // the lattice began at 1, so 1-4 kg dumbbells were loadable and never
  // prescribed — a floor that quietly contradicted the ladder above it.
  dumbbell: { lattice: { kind: 'rungs', rungsKg: DUMBBELL_RUNGS }, minimumKg: 1, minimumRuled: true },
  bodyweight: { lattice: { kind: 'none' }, minimumKg: 0, minimumRuled: true },
};

/**
 * Minimums Sam has not ruled. EMPTY as of 2026-07-28 — and empty for a reason
 * that is recorded rather than assumed.
 *
 * `PENDING_LISTS.equipment_minimums` carries the `ruled_empty` state with
 * attribution. That distinction is the whole point: an empty array nobody
 * emptied is indistinguishable from a completed review, which is precisely what
 * `LOAD_RULING_PENDING` looked like while 71 ratios sat unruled behind it.
 */
export const MINIMUMS_PENDING: readonly EquipmentKind[] =
  (Object.keys(EQUIPMENT) as EquipmentKind[]).filter((k) => !EQUIPMENT[k].minimumRuled);

/**
 * Round an ESTIMATE down to a weight the athlete can actually load.
 *
 * Never called on an athlete's own entry — see the scope note in the header.
 */
export function roundDownToLattice(weightKg: number, equipment: EquipmentKind): number {
  const { lattice } = EQUIPMENT[equipment];
  if (lattice.kind === 'none') return 0;

  if (lattice.kind === 'step') {
    return Math.floor(weightKg / lattice.stepKg) * lattice.stepKg;
  }

  let best = 0;
  for (const rung of lattice.rungsKg) {
    if (rung <= weightKg && rung > best) best = rung;
  }
  return best;
}

/**
 * The weight to prescribe: the athlete's computed load, snapped down to what
 * exists, and never below the minimum worth putting on a card.
 */
export function prescribableWeight(weightKg: number, equipment: EquipmentKind): number {
  const spec = EQUIPMENT[equipment];
  if (spec.lattice.kind === 'none') return 0;
  return Math.max(roundDownToLattice(weightKg, equipment), spec.minimumKg);
}
