/** Preserve conditioning's intended work through the existing capability policy. */
import type { Workout, OnboardingData } from '../types/domain';
import type { ActiveConstraint } from '../store/coachUpdatesStore';
import { resolveEquipmentCapabilities } from '../utils/equipmentAvailability';
import { buildGenerationConstraintContext } from '../utils/generationConstraints';
import { canonicalWeeklyInjuryStateFrom } from './canonicalWeeklyInjuryState';
import { resolveConditioningFeasibility, applyResolvedConditioningSubstitution } from './conditioningFeasibility';
import { applyConditioningModalityToWorkout } from '../utils/coachModalitySwap';
import { applyConstraintsToTypedComponents } from '../utils/exposureEngine';
import { compileActiveExposureConstraints } from './canonicalWeeklyConstraintCompiler';
import { withoutConditioningComponent } from './strengthRelocationTemplate';
import { getSessionComponentRows } from '../utils/sessionComponents';

export function compileInjuryConditioning(args: {
  workout: Workout; profile: OnboardingData; dateISO: string;
  constraints: readonly ActiveConstraint[];
}): Workout {
  const constraints = compileActiveExposureConstraints([...args.constraints]);
  const filtered = applyConstraintsToTypedComponents(args.workout, constraints).workout;
  if (!args.workout.conditioningBlock?.options.length) return filtered;
  const generationConstraints = buildGenerationConstraintContext({
    activeConstraints: args.constraints, todayISO: args.dateISO,
  });
  // A full stop is not permission to find another workout.
  if (constraints.some(constraint => constraint.trainingPaused)) return filtered;
  const injury = canonicalWeeklyInjuryStateFrom({ profile: args.profile, generationConstraints });
  const equipment = resolveEquipmentCapabilities(args.profile, args.constraints, args.dateISO);
  const actualModesAvailable = filtered.conditioningBlock?.options.every(option => {
    const modes = option.modalitySequence?.length ? option.modalitySequence : [option.modality];
    return modes.every(mode => mode === 'running' || (mode !== undefined
      && equipment.conditioningModalities.includes(mode === 'bike' ? 'bike_erg' : mode as never)));
  });
  // Weekly capability policy also governs easy running. The exposure filter
  // alone only removes specific hard exposures and cannot certify an on-feet
  // session for an athlete whose lower-body work is restricted.
  if (filtered.conditioningBlock?.options.length && actualModesAvailable && !injury.lowerBodyRestricted &&
      !injury.upperBodyRestricted) return filtered;
  const feasible = resolveConditioningFeasibility({
    tier: args.workout.sessionTier ?? 'core', focus: args.workout.name,
    ergModality: args.workout.conditioningFeasibility?.resolvedModality,
    isHardExposure: args.workout.section18Evidence?.conditioningStress === 'hard',
    conditioningCategory: args.workout.conditioningCategory,
    conditioningFlavour: args.workout.conditioningFlavour,
    hasCombinedConditioning: args.workout.hasCombinedConditioning,
    attachedConditioningKind: args.workout.attachedConditioningKind,
    conditioningOffFeet: injury.lowerBodyRestricted,
    section18ConditioningRole: args.workout.section18ConditioningRole,
  }, { phase: args.profile.seasonPhase, equipment, injury });
  const decision = feasible.conditioningFeasibility;
  if (!decision || decision.status === 'removed') return withoutConditioningComponent(filtered);
  const candidate = { ...args.workout, conditioningFeasibility: decision };
  const family = decision.resolvedSubstitutionFamily;
  const replacement = family === 'bike' || family === 'row' || family === 'ski'
    ? applyConditioningModalityToWorkout(candidate, {
      fromModality: null, toModality: family,
      bikeLabel: equipment.conditioningModalities.includes('bike_erg') ? 'standard' : 'assault',
    })
    : applyResolvedConditioningSubstitution(candidate);
  const checked = applyConstraintsToTypedComponents(replacement, constraints).workout;
  return checked.conditioningBlock?.options.length ? checked : withoutConditioningComponent(filtered);
}

/** Compose the weekly planner's conditioning with the accepted strength rows.
 * No selection, target adjustment or gap-filling occurs here. The planner has
 * already placed these components, including replacements for withdrawn field
 * exposure. Athlete-owned days are handled separately by the source-fact fold.
 */
export function withPlannedInjuryConditioning(accepted: Workout, planned: Workout | null): Workout | null {
  const components = getSessionComponentRows(accepted);
  const hasOtherWork = components.strengthRows.length + components.supportRows.length +
    components.powerRows.length + components.mobilityRows.length + components.recoveryRows.length +
    components.teamTrainingRows.length > 0;
  // A relocated standalone energy session takes its warm-up with it. Keeping
  // the old container would leave a conditioning card containing only Warm-up.
  if (!hasOtherWork && (accepted.conditioningBlock || accepted.speedBlock)) return planned;
  const conditioningIds = new Set(accepted.conditioningBlock?.options.flatMap(option => option.exerciseIds) ?? []);
  const rows = accepted.exercises.filter(row => row.section18Evidence?.role !== 'conditioning' &&
    !conditioningIds.has(row.id));
  const plannedIds = new Set(planned?.conditioningBlock?.options.flatMap(option => option.exerciseIds) ?? []);
  const conditioningRows = planned?.exercises.filter(row => row.section18Evidence?.role === 'conditioning' ||
    plannedIds.has(row.id)) ?? [];
  return {
    ...accepted,
    exercises: [...rows, ...conditioningRows],
    conditioningBlock: planned?.conditioningBlock,
    conditioningCategory: planned?.conditioningCategory,
    conditioningFlavour: planned?.conditioningFlavour,
    conditioningOffFeet: planned?.conditioningOffFeet,
    conditioningFeasibility: planned?.conditioningFeasibility,
    attachedConditioningKind: planned?.attachedConditioningKind,
    hasCombinedConditioning: !!planned?.conditioningBlock && rows.length > 0,
    section18ConditioningRole: planned?.section18ConditioningRole,
    speedBlock: planned?.speedBlock,
    section18Evidence: {
      ...accepted.section18Evidence,
      conditioningRole: planned?.section18Evidence?.conditioningRole ?? 'none',
      conditioningStress: planned?.section18Evidence?.conditioningStress ?? 'unknown',
    },
  };
}
