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
import { injuryTriggerMatchesConditioningModality } from './injuryExerciseRisk';
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
  const available = new Set(equipmentModalities.filter(mode =>
    !injuryTriggerMatchesConditioningModality(mode, injury?.painfulMovements ?? [])
      && !(mode === 'air_bike' && injury?.upperBodyRestricted)));
  const upperRestricted = injury?.upperBodyRestricted === true;
  // The session-side 'bike' family renders on EITHER bike machine; the
  // athlete's answer distinguishes them (ruling 2, 2026-07-31) so that
  // native-air-bike rows can require air_bike specifically at selection.
  const anyBike = available.has('bike_erg') || available.has('air_bike');
  const out: AllowedErgModality[] = [];
  if (anyBike) out.push('bike');
  if (available.has('row') && !upperRestricted) out.push('row');
  if (available.has('ski') && !upperRestricted) out.push('ski');
  if (anyBike && !upperRestricted && (available.has('row') || available.has('ski'))
      && equipmentModalities.every(mode => !injuryTriggerMatchesConditioningModality(mode, injury?.painfulMovements ?? []))) {
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
  if (modalities.has('treadmill') && !context.injury?.lowerBodyRestricted
      && !injuryTriggerMatchesConditioningModality('treadmill', context.injury?.painfulMovements ?? [])) {
    return { family: 'treadmill', attempted };
  }

  const lowerRestricted = context.injury?.lowerBodyRestricted === true;
  const upperRestricted = context.injury?.upperBodyRestricted === true;
  const runningPain = injuryTriggerMatchesConditioningModality('running', context.injury?.painfulMovements ?? []);
  const walkingPain = injuryTriggerMatchesConditioningModality('walking', context.injury?.painfulMovements ?? []);
  const stress = stressFor(entry);
  const genuineSprint = entry.conditioningCategory === 'sprint';
  const runningSafe = !runningPain && !lowerRestricted && !entry.conditioningOffFeet &&
    // A deloaded week caps quality exposures at one, and sprint is a quality
    // exposure — so "deloaded" is the whole question here now.
    !(genuineSprint && context.readinessDeloaded);

  attempted.push('outdoor_running');
  if (runningSafe) return { family: 'outdoor_running', attempted };

  attempted.push('hill_running_or_walking');
  if (!runningPain && !walkingPain && !lowerRestricted && !entry.conditioningOffFeet) {
    return { family: 'hill_running_or_walking', attempted };
  }

  attempted.push('brisk_walking');
  // `!entry.conditioningOffFeet` IS THE FIX. Walking was the only on-feet family
  // that never asked, so an athlete told to stay off their feet was refused
  // running, refused hills, and handed a walk.
  if (!walkingPain && !lowerRestricted && stress !== 'hard' && !genuineSprint
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
  const treadmill = context.equipment.conditioningModalities.includes('treadmill') && !lowerRestricted
    && !injuryTriggerMatchesConditioningModality('treadmill', context.injury?.painfulMovements ?? []);
  const running = !lowerRestricted
    && !injuryTriggerMatchesConditioningModality('running', context.injury?.painfulMovements ?? []);
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
 * Make a non-machine delivery substitution real without changing template
 * identity.
 *
 * The selected template owns the session name and prescription. Equipment
 * feasibility owns only HOW that prescription is delivered. The active-session
 * projection reads the typed substitution family as a separate mode line, so
 * this boundary must never turn a delivery method into a second template name.
 */
export function applyResolvedConditioningSubstitution(workout: Workout): Workout {
  const family = workout.conditioningFeasibility?.resolvedSubstitutionFamily;
  if (!family || family === 'selected_modality' || family === 'bike' || family === 'row' ||
      family === 'ski' || family === 'mixed') {
    return workout;
  }
  const stress = workout.section18Evidence?.conditioningStress ??
    (workout.intensity === 'High' || workout.intensity === 'Maximal' ? 'hard' : 'moderate');
  const description = stress === 'hard'
    ? 'Complete the prescribed hard work and recovery structure at the same intended session stress.'
    : stress === 'light'
      ? 'Keep this easy and conversational for the prescribed duration.'
      : 'Complete the prescribed controlled work at a moderate, repeatable effort.';
  const conditioningIds = new Set(
    workout.conditioningBlock?.options.flatMap((option) => option.exerciseIds) ??
      workout.exercises.filter((row) => row.section18Evidence?.role === 'conditioning').map((row) => row.id),
  );
  /* The warm-up is not substituted work. Identify it by its authored name,
   * never by an id suffix, and remove it from the block option as before. */
  const isStructuralWarmup = (row: { exercise?: { name?: string } | null }): boolean =>
    row.exercise?.name === CONDITIONING_WARMUP_ROW_NAME;
  const exercises = workout.exercises.map((row) => conditioningIds.has(row.id) && !isStructuralWarmup(row)
    ? {
        ...row,
        exercise: row.exercise ? {
          ...row.exercise,
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
  const authoredTitle = exercises.find((row) => allIds.includes(row.id))?.exercise?.name
    ?? workout.conditioningBlock?.options[0]?.title
    ?? workout.name;
  return {
    ...workout,
    exercises,
    ...(workout.conditioningBlock ? {
      conditioningBlock: {
        ...workout.conditioningBlock,
        options: [{ title: authoredTitle, description, exerciseIds: allIds }],
      },
    } : {}),
  };
}
