import type {
  ConditioningEquipmentModality,
  ConditioningFeasibilityDecision,
  ConditioningSubstitutionFamily,
  SeasonPhase,
  Workout,
} from '../types/domain';
import type { SessionAllocation } from '../utils/coachingEngine';
import type { ResolvedEquipmentCapabilities } from '../utils/equipmentAvailability';
import type { CanonicalWeeklyInjuryPolicy } from './canonicalWeeklyInjuryState';
import type { OffseasonSubphase } from './offseasonSubphase';
import type { PreseasonSubphase } from './preseasonSubphase';
import type { Section18ConditioningStress, Section18EquipmentPolicyState } from './weeklyExposureContractV2';
import { selectDefaultAerobicErgModalityFromHash } from '../utils/sessionBuilder';

import { CONDITIONING_WARMUP_ROW_NAME } from './conditioningSelection';
type ErgModality = NonNullable<SessionAllocation['ergModality']>;
type AllowedErgModality = Exclude<ErgModality, 'bike_erg'>;

export interface ConditioningFeasibilityContext {
  phase?: SeasonPhase | null;
  offseasonSubphase?: OffseasonSubphase | null;
  preseasonSubphase?: PreseasonSubphase | null;
  equipment: ResolvedEquipmentCapabilities;
  /** Compiler-owned dated capability; absent callers retain the weekly fallback. */
  equipmentByDayOfWeek?: Readonly<Record<number, ResolvedEquipmentCapabilities>>;
  injury?: CanonicalWeeklyInjuryPolicy;
  readinessDeloaded?: boolean;
}

export interface ConditioningSubstitutionPolicy extends Section18EquipmentPolicyState {
  /** Exact ordered families considered by the modality resolver. */
  attemptedFamilies: ConditioningSubstitutionFamily[];
  feasibilityReason: string;
}

const COARSE_SUBSTITUTIONS: Section18EquipmentPolicyState['consideredSubstitutions'] = [
  'available_ergs',
  'running',
  'hills',
  'walking',
  'bodyweight',
  'safe_mixed',
];

const ALL_FAMILIES: ConditioningSubstitutionFamily[] = [
  'selected_modality',
  'bike',
  'row',
  'ski',
  'treadmill',
  'outdoor_running',
  'hill_running_or_walking',
  'brisk_walking',
  'bodyweight_circuit',
  'safe_mixed_modal',
];

/**
 * IS THIS FAMILY ON THE ATHLETE'S FEET? — declared ONCE, read by both gates.
 *
 * SEAT_INBOX item 14: *"declare `onFeet` on the family table and derive both
 * gates"*. Before this table the answer lived in two `&&` chains written at
 * different times, and they disagreed:
 *
 * - the SELECTION gate refused `outdoor_running` and `hill_running_or_walking`
 *   to an off-feet athlete and then offered them `brisk_walking`, which is the
 *   one thing an off-feet report is about;
 * - the CLEARING step below cleared `conditioningOffFeet` for running and hills
 *   and forgot walking.
 *
 * The same omission twice, because the property had no home. A `Record` over the
 * union makes a family with no answer a COMPILE error rather than a third place
 * to forget.
 *
 * TREADMILL IS DELIBERATELY `false`, and it is the one entry a reader could
 * reasonably argue with. A treadmill is literally on your feet — but
 * `conditioningOffFeet` here is the athlete's report about impact and terrain,
 * set beside restrictions that refuse outdoor running and hills, and the
 * treadmill is ordered with the MACHINES that exist to serve that athlete.
 * Declaring it on-feet would take a machine option away from the person it was
 * chosen for. Changing it is a Sam ruling, not a tidy-up.
 */
export const FAMILY_ON_FEET: Record<ConditioningSubstitutionFamily, boolean> = {
  selected_modality: false,
  bike: false,
  row: false,
  ski: false,
  // FOUND BY THE TABLE ON ITS FIRST COMPILE, which is the argument for a table
  // rather than two more `&&`s. `mixed` is in the family UNION and is NOT in
  // `ALL_FAMILIES` — an erg pairing (`bike/mixed/row/ski`, :160-161), so it is
  // machine work and off-feet like its neighbours. Nothing had to answer for it
  // before, because nothing asked.
  mixed: false,
  treadmill: false,
  outdoor_running: true,
  hill_running_or_walking: true,
  brisk_walking: true,
  bodyweight_circuit: false,
  safe_mixed_modal: false,
};

/** The one reader of that table. Both gates go through here. */
export function familyIsOnFeet(family: ConditioningSubstitutionFamily): boolean {
  return FAMILY_ON_FEET[family] === true;
}

function stableHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function allowedErgs(
  equipmentModalities: readonly ConditioningEquipmentModality[],
  injury?: CanonicalWeeklyInjuryPolicy,
): AllowedErgModality[] {
  const available = new Set(equipmentModalities);
  const upperRestricted = injury?.upperBodyRestricted === true;
  // The session-side 'bike' family renders on EITHER bike machine; the
  // athlete's answer distinguishes them (ruling 2, 2026-07-31) so that
  // native-air-bike rows can require air_bike specifically at selection.
  const anyBike = available.has('bike_erg') || available.has('air_bike');
  const out: AllowedErgModality[] = [];
  if (anyBike) out.push('bike');
  if (available.has('row') && !upperRestricted) out.push('row');
  if (available.has('ski') && !upperRestricted) out.push('ski');
  if (anyBike && !upperRestricted && (available.has('row') || available.has('ski'))) {
    out.push('mixed');
  }
  return out;
}

function canonicalRequested(modality: ErgModality | undefined): AllowedErgModality | undefined {
  return modality === 'bike_erg' ? 'bike' : modality;
}

function weightedOrder(seed: string): AllowedErgModality[] {
  const first = selectDefaultAerobicErgModalityFromHash(stableHash(seed));
  const orders: Record<AllowedErgModality, AllowedErgModality[]> = {
    bike: ['bike', 'mixed', 'row', 'ski'],
    mixed: ['mixed', 'bike', 'row', 'ski'],
    row: ['row', 'bike', 'mixed', 'ski'],
    ski: ['ski', 'mixed', 'bike', 'row'],
  };
  return orders[first];
}

function stripConditioningFocus(focus: string): string {
  const parts = focus.split('+').map((part) => part.trim()).filter(Boolean);
  const kept = parts.filter((part) =>
    !/conditioning|aerobic|tempo|interval|zone\s*2|finisher|off-feet/i.test(part));
  return kept.join(' + ') || 'Mobility, foam rolling, light movement';
}

function removeConditioning(
  entry: SessionAllocation,
  decision: ConditioningFeasibilityDecision,
): SessionAllocation {
  const strengthRemains = !!entry.strengthPattern || !!entry.strengthIntent?.plannedPatterns.length;
  return {
    ...entry,
    tier: strengthRemains ? entry.tier : 'recovery',
    focus: strengthRemains ? stripConditioningFocus(entry.focus) : 'Mobility, foam rolling, light movement',
    isHardExposure: strengthRemains ? entry.isHardExposure : false,
    hasCombinedConditioning: false,
    attachedConditioningKind: undefined,
    conditioningFlavour: undefined,
    conditioningCategory: undefined,
    conditioningVariant: undefined,
    conditioningFeel: undefined,
    conditioningOffFeet: undefined,
    ergModality: undefined,
    section18ConditioningRole: 'none',
    conditioningFeasibility: decision,
  };
}

function stressFor(entry: SessionAllocation): 'light' | 'moderate' | 'hard' {
  if (entry.conditioningCategory === 'vo2' || entry.conditioningCategory === 'glycolytic' ||
      entry.conditioningCategory === 'sprint' || entry.conditioningFlavour === 'high-intensity') {
    return 'hard';
  }
  if (entry.section18ConditioningRole === 'optional_flush' ||
      entry.section18ConditioningRole === 'optional_recovery_aerobic') return 'light';
  return 'moderate';
}

/**
 * EXPORTED FOR ONE REASON: the claim this module makes is about a CHOICE, and a
 * choice can only be checked by making it.
 *
 * `test:off-feet-walking` asserts the table (`FAMILY_ON_FEET`) and then asserts
 * this function's ANSWER for an off-feet athlete. Testing only the table would
 * be `AGENTS.md`'s own warning — *"a cell that names a function does not cover
 * its arguments"* — and the defect it is about was precisely a correct fact used
 * in one place and forgotten in another.
 */
export function substitutionDecision(args: {
  entry: SessionAllocation;
  context: ConditioningFeasibilityContext;
  allowed: AllowedErgModality[];
}): { family: ConditioningSubstitutionFamily; erg?: AllowedErgModality; attempted: ConditioningSubstitutionFamily[] } | null {
  const { entry, context, allowed } = args;
  const attempted: ConditioningSubstitutionFamily[] = ['selected_modality'];
  const canonical = canonicalRequested(entry.ergModality);
  if (canonical && allowed.includes(canonical)) {
    return { family: canonical, erg: canonical, attempted };
  }
  // With the full normal pool available, preserve the builder's deliberate
  // deterministic modality rotation. Feasibility owns whether the exposure
  // can survive; it does not collapse an already-valid mixed/default choice
  // to a single erg.
  if (!canonical && ['bike', 'row', 'ski', 'mixed'].every((candidate) =>
    allowed.includes(candidate as AllowedErgModality))) {
    return { family: 'selected_modality', attempted };
  }

  for (const candidate of weightedOrder(entry.planEntryId ?? `${entry.dayOfWeek}:${entry.focus}`)) {
    attempted.push(candidate);
    if (allowed.includes(candidate)) return { family: candidate, erg: candidate, attempted };
  }

  // R-266: a flush is off-leg recovery on an available suitable ergo. Missing
  // or injury-ineligible machines cannot turn it into walking or a circuit.
  if (entry.section18ConditioningRole === 'optional_flush' ||
      entry.section18ConditioningRole === 'optional_recovery_aerobic') return null;

  const modalities = new Set(context.equipment.conditioningModalities);
  attempted.push('treadmill');
  if (modalities.has('treadmill') && !context.injury?.lowerBodyRestricted) {
    return { family: 'treadmill', attempted };
  }

  const lowerRestricted = context.injury?.lowerBodyRestricted === true;
  const upperRestricted = context.injury?.upperBodyRestricted === true;
  const stress = stressFor(entry);
  const genuineSprint = entry.conditioningCategory === 'sprint';
  const runningSafe = !lowerRestricted && !entry.conditioningOffFeet &&
    // A deloaded week caps quality exposures at one, and sprint is a quality
    // exposure — so "deloaded" is the whole question here now.
    !(genuineSprint && context.readinessDeloaded);

  attempted.push('outdoor_running');
  if (runningSafe) return { family: 'outdoor_running', attempted };

  attempted.push('hill_running_or_walking');
  if (!lowerRestricted && !entry.conditioningOffFeet) {
    return { family: 'hill_running_or_walking', attempted };
  }

  attempted.push('brisk_walking');
  // `!entry.conditioningOffFeet` IS THE FIX. Walking was the only on-feet family
  // that never asked, so an athlete told to stay off their feet was refused
  // running, refused hills, and handed a walk.
  if (!lowerRestricted && stress !== 'hard' && !genuineSprint
    && !(entry.conditioningOffFeet && familyIsOnFeet('brisk_walking'))) {
    return { family: 'brisk_walking', attempted };
  }

  const bodyweightAvailable = context.equipment.tags.includes('bodyweight');
  attempted.push('bodyweight_circuit');
  if (bodyweightAvailable && !genuineSprint && !(lowerRestricted && upperRestricted)) {
    return { family: 'bodyweight_circuit', attempted };
  }

  attempted.push('safe_mixed_modal');
  if (bodyweightAvailable && !genuineSprint && !lowerRestricted && !upperRestricted) {
    return { family: 'safe_mixed_modal', attempted };
  }
  return null;
}

/**
 * Whole-week preflight used before target construction. Missing machines are
 * not global infeasibility: the contract is reduced only when every safe
 * equivalent family is unavailable.
 */
export function resolveConditioningSubstitutionPolicy(
  context: ConditioningFeasibilityContext,
): ConditioningSubstitutionPolicy {
  // Readiness can no longer pause training — only serious injury or an explicit
  // force can, through §18's safety.trainingPaused.
  const trainingPaused = false;
  const lowerRestricted = context.injury?.lowerBodyRestricted === true;
  const upperRestricted = context.injury?.upperBodyRestricted === true;
  const ergs = allowedErgs(
    context.equipment.conditioningModalities,
    context.injury,
  );
  const treadmill = context.equipment.conditioningModalities.includes('treadmill') && !lowerRestricted;
  const running = !lowerRestricted;
  const bodyweight = context.equipment.tags.includes('bodyweight') && !(lowerRestricted && upperRestricted);
  const feasible = !trainingPaused && (ergs.length > 0 || treadmill || running || bodyweight);
  const substitutionNeeded = feasible && ergs.length === 0;
  return {
    appConditioningFeasible: feasible,
    substitutionStatus: trainingPaused
      ? 'exhausted'
      : substitutionNeeded
        ? 'substituted'
        : feasible
          ? 'not_required'
          : 'exhausted',
    consideredSubstitutions: substitutionNeeded || !feasible ? [...COARSE_SUBSTITUTIONS] : [],
    attemptedFamilies: substitutionNeeded || !feasible ? [...ALL_FAMILIES] : ['selected_modality'],
    feasibilityReason: trainingPaused
      ? 'readiness_full_pause'
      : feasible
        ? substitutionNeeded ? 'safe_non_machine_substitute_available' : 'selected_or_machine_modality_available'
        : 'all_safe_equivalent_conditioning_families_exhausted',
  };
}

/**
 * One allocation boundary owns modality feasibility. It preserves role,
 * stress and purpose; a hard/core exposure is removed only after equivalent
 * machine, running, hill, walking, bodyweight and mixed-modal options have
 * been considered in order.
 */
export function resolveConditioningFeasibility(
  entry: SessionAllocation,
  context: ConditioningFeasibilityContext,
): SessionAllocation {
  if (!entry.conditioningCategory && !entry.conditioningFlavour) return { ...entry };

  const requested = entry.ergModality;
  const allowed = allowedErgs(
    context.equipment.conditioningModalities,
    context.injury,
  );
  if ((
    context.readinessDeloaded && stressFor(entry) === 'hard'
  )) {
    return removeConditioning(entry, {
      status: 'removed',
      ...(requested ? { requestedModality: requested } : {}),
      allowedModalities: allowed,
      attemptedSubstitutionFamilies: [],
      feasibilityDetail: false
        ? 'full_pause_blocks_conditioning'
        : 'readiness_blocks_required_intensity',
      reason: 'readiness_blocks_conditioning',
    });
  }

  const resolved = substitutionDecision({ entry, context, allowed });
  if (!resolved) {
    return removeConditioning(entry, {
      status: 'removed',
      ...(requested ? { requestedModality: requested } : {}),
      allowedModalities: allowed,
      attemptedSubstitutionFamilies: [...ALL_FAMILIES],
      feasibilityDetail: `no_safe_equivalent_for_${entry.section18ConditioningRole ?? 'untyped'}_${stressFor(entry)}`,
      reason: 'no_safe_equivalent_substitute',
    });
  }

  const canonical = canonicalRequested(requested);
  const selectedWasAvailable = !!canonical && resolved.erg === canonical;
  const machineDefault = !requested && !!resolved.erg;
  const isReplacement = !selectedWasAvailable && !machineDefault;
  return {
    ...entry,
    ...(resolved.erg ? { ergModality: resolved.erg } : { ergModality: undefined }),
    // DERIVED FROM THE TABLE, not a hand-written pair. This read
    // `outdoor_running || hill_running_or_walking` and forgot `brisk_walking` —
    // the same omission as the selection gate above, in the second of the two
    // places that had to agree.
    ...(familyIsOnFeet(resolved.family)
      ? { conditioningOffFeet: false }
      : {}),
    conditioningFeasibility: {
      status: isReplacement ? 'replaced' : 'feasible',
      ...(requested ? { requestedModality: requested } : {}),
      ...(resolved.erg ? { resolvedModality: resolved.erg } : {}),
      allowedModalities: allowed,
      attemptedSubstitutionFamilies: resolved.attempted,
      resolvedSubstitutionFamily: resolved.family,
      feasibilityDetail: `preserved_${entry.section18ConditioningRole ?? 'untyped'}_${stressFor(entry)}_conditioning`,
      reason: isReplacement ? 'safe_equivalent_substitution' : 'available_capability',
    },
  };
}

export function resolveWeeklyConditioningFeasibility(
  weeklyPlan: readonly SessionAllocation[],
  context: ConditioningFeasibilityContext,
): SessionAllocation[] {
  const dayNames = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
  ];
  return weeklyPlan.map((entry) => {
    const day = dayNames.indexOf(String(entry.dayOfWeek ?? ''));
    return resolveConditioningFeasibility(entry, {
      ...context,
      equipment: context.equipmentByDayOfWeek?.[day] ?? context.equipment,
    });
  });
}

/**
 * The authored row name for each non-machine substitution family, by stress.
 *
 * THE SINGLE SOURCE for these names — `applyResolvedConditioningSubstitution`
 * below looks its answer up here, and `rules/projectionCopy.ts` derives its
 * signed-copy registration from `CONDITIONING_SUBSTITUTION_ROW_NAMES`
 * (exported below) rather than transcribing the strings a second time. A
 * family added here is automatically both emittable AND signed; one that is
 * signed but never emitted, or emitted but never signed, cannot happen by
 * construction.
 *
 * A family with one string (not `{ hard, other }`) does not vary by stress.
 */
export const CONDITIONING_SUBSTITUTION_LABELS: Readonly<
  Partial<Record<ConditioningSubstitutionFamily, { hard: string; other: string } | string>>
> = {
  treadmill: { hard: 'Treadmill Intervals', other: 'Treadmill Aerobic Work' },
  outdoor_running: { hard: 'Outdoor Running Intervals', other: 'Outdoor Aerobic Run' },
  hill_running_or_walking: { hard: 'Hill Running Intervals', other: 'Brisk Hill Walk' },
  brisk_walking: 'Brisk Walking',
  bodyweight_circuit: 'Bodyweight Conditioning Circuit',
};

/** The label for any family not listed in `CONDITIONING_SUBSTITUTION_LABELS`. */
export const CONDITIONING_SUBSTITUTION_DEFAULT_LABEL = 'Mixed-Modal Conditioning Circuit';

function conditioningSubstitutionLabel(
  family: ConditioningSubstitutionFamily,
  stress: Section18ConditioningStress,
): string {
  const entry = CONDITIONING_SUBSTITUTION_LABELS[family];
  if (!entry) return CONDITIONING_SUBSTITUTION_DEFAULT_LABEL;
  if (typeof entry === 'string') return entry;
  return stress === 'hard' ? entry.hard : entry.other;
}

/**
 * Every row name `applyResolvedConditioningSubstitution` can emit — the flat
 * form `projectionCopy.ts` registers as signed copy. Derived, not
 * transcribed: a new family or a re-worded label here changes this list for
 * free.
 */
export const CONDITIONING_SUBSTITUTION_ROW_NAMES: readonly string[] = [
  ...Object.values(CONDITIONING_SUBSTITUTION_LABELS).flatMap((entry) =>
    (typeof entry === 'string' ? [entry] : [entry.hard, entry.other])),
  CONDITIONING_SUBSTITUTION_DEFAULT_LABEL,
];

/** Make a non-machine substitution real in canonical content, not metadata-only. */
export function applyResolvedConditioningSubstitution(workout: Workout): Workout {
  const family = workout.conditioningFeasibility?.resolvedSubstitutionFamily;
  if (!family || family === 'selected_modality' || family === 'bike' || family === 'row' ||
      family === 'ski' || family === 'mixed') {
    return workout;
  }
  const stress = workout.section18Evidence?.conditioningStress ??
    (workout.intensity === 'High' || workout.intensity === 'Maximal' ? 'hard' : 'moderate');
  const label = conditioningSubstitutionLabel(family, stress);
  const description = stress === 'hard'
    ? 'Complete the prescribed hard work and recovery structure at the same intended session stress.'
    : stress === 'light'
      ? 'Keep this easy and conversational for the prescribed duration.'
      : 'Complete the prescribed controlled work at a moderate, repeatable effort.';
  const conditioningIds = new Set(
    workout.conditioningBlock?.options.flatMap((option) => option.exerciseIds) ??
      workout.exercises.filter((row) => row.section18Evidence?.role === 'conditioning').map((row) => row.id),
  );
  /* ⚠ **THE WARM-UP KEEPS ITS OWN NAME, AND THAT IS THE WHOLE OF THE
   * DUPLICATE-EXERCISE DEFECT SAM ORDERED FIXED (2026-08-20).**
   *
   * `conditioningIds` is every row in the block, and the block includes the
   * structural warm-up row. So a substituted session renamed BOTH rows to the
   * modality label and the athlete's screen read:
   *
   *     Conditioning
   *       - Outdoor Running Intervals
   *       - Outdoor Running Intervals
   *
   * **MEASURED across the 180-world corpus: 48 occurrences / 20 athletes / 40
   * weeks / 48 sessions**, every one a low-kit world where running is the
   * substituted modality. Verified on the athlete-visible projection, not just
   * in the workout object — the two lines really are what they read.
   *
   * ⚠ **IT IS NOT THE SAME WORK TWICE. IT IS ONE ROW WEARING THE OTHER'S
   * NAME.** The warm-up carries 1 set and Sam's signed warm-up sentence; the
   * main carries the authored dose. Only the NAME was overwritten, which is why
   * no count of sessions or exposures could see it.
   *
   * **IDENTIFIED BY NAME, NEVER BY ID SUFFIX.** `-warmup` is right there in the
   * id and matching it would be the string-prefix-on-id shape this module's
   * neighbours explicitly refuse (*"rows derive from the template by name —
   * never from string-prefix matching on `id`"*). The warm-up's authored name
   * IS its identity, and it is the one thing the substitution must not touch:
   * a warm-up jog is a warm-up jog whichever modality replaced the main block.
   *
   * R-049 already says the warm-up is not the work — *"dose counts main work
   * only; warm-up and cool-down never count"* — and the projection already
   * gives it no dose. This makes the NAME agree with what the app already
   * believes about that row. */
  const isStructuralWarmup = (row: { exercise?: { name?: string } | null }): boolean =>
    row.exercise?.name === CONDITIONING_WARMUP_ROW_NAME;
  const exercises = workout.exercises.map((row) => conditioningIds.has(row.id) && !isStructuralWarmup(row)
    ? {
        ...row,
        exercise: row.exercise ? {
          ...row.exercise,
          name: label,
          description,
          equipmentRequired: family === 'treadmill' ? ['Treadmill'] : [],
        } : row.exercise,
      }
    : row);
  /* The block's option lists the rows the substitution actually renamed. Leaving
   * the warm-up id in it would hand the same contradiction to every reader that
   * trusts `exerciseIds` instead of the rows. */
  const allIds = workout.exercises
    .filter((row) => conditioningIds.has(row.id) && !isStructuralWarmup(row))
    .map((row) => row.id);
  return {
    ...workout,
    exercises,
    ...(workout.conditioningBlock ? {
      conditioningBlock: {
        ...workout.conditioningBlock,
        options: [{ title: label, description, exerciseIds: allIds }],
      },
    } : {}),
  };
}
