import {
  EXERCISE_TAGS,
  getExerciseTags,
  type InjuryKey,
  type MovementPattern,
} from '../data/exerciseTags';
import type { EquipmentTag } from '../data/exercisePools';
import type { ActiveConstraint } from '../store/coachUpdatesStore';
import type { OnboardingData, ReadinessLevel } from '../types/domain';
import {
  getReplacementChoicesForBucket,
  type SubstitutionHierarchyTier,
} from './injurySessionClassifier';
import type { InjuryBucket } from './programAdjustmentEngine';
import {
  getSubstituteCandidates,
  type SubstituteCandidate,
} from './exerciseSubstitutes';
import {
  equipmentTagsToSubstituteEquipmentClasses,
  resolveEquipmentAvailability,
} from './equipmentAvailability';
import {
  EXERCISE_LOAD_MAP,
  resolveExerciseName,
  type EquipmentClass,
} from './loadEstimation';
import { deriveScheduleReadiness, type ReadinessSignal } from './readiness';
import { filterConstraintsForDate } from './readinessConstraints';
import {
  compareSafeTrainingFallbackTiers,
  type SafeTrainingFallbackTier,
} from '../rules/conflictResolutionHierarchy';

export type TapSwapReason =
  | 'no_equipment'
  | 'injury_or_pain'
  | 'too_hard'
  | 'too_easy'
  | 'preference'
  | 'other';

export type TapSwapHierarchyTier = SafeTrainingFallbackTier;

export interface TapSwapPrimaryInjury {
  bucket: InjuryBucket;
  severity: number;
  seriousSymptoms?: boolean;
}

export interface TapSwapEnvironment {
  activeInjuries: Partial<Record<InjuryKey, 'caution' | 'avoid'>>;
  primaryInjury: TapSwapPrimaryInjury | null;
  availableEquipment: EquipmentClass[];
  availableEquipmentTags: EquipmentTag[];
  readiness: ReadinessLevel;
  hasEquipmentConstraint: boolean;
  medicalStop: boolean;
}

export interface TapSwapChoice {
  kind: 'exercise' | 'recovery' | 'rest';
  name: string | null;
  hierarchyTier: TapSwapHierarchyTier;
  source:
    | 'injury_hierarchy'
    | 'pattern_substitute_engine'
    | 'tag_registry_pattern_fallback'
    | 'recovery_fallback'
    | 'rest_fallback';
  reason: string;
  prescription?: {
    sets: number;
    repsMin: number;
    repsMax: number;
    weight?: number;
    prescriptionType?: 'reps' | 'duration' | 'duration_minutes' | 'distance';
    restSeconds?: number;
  };
}

export interface TapSwapSafetyDecision {
  safe: boolean;
  reason: string;
}

const PATTERN_REGISTRY_FALLBACKS = new Set<MovementPattern>([
  'squat',
  'lunge',
  'hinge',
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
]);

const FATIGUE_RANK = { low: 0, moderate: 1, high: 2 } as const;
const LOAD_RANK = { low: 0, moderate: 1, high: 2 } as const;

function activeConstraint(constraint: ActiveConstraint): boolean {
  return constraint.status !== 'resolved';
}

function injuryLevel(severity: number): 'caution' | 'avoid' {
  return severity >= 4 ? 'avoid' : 'caution';
}

function lowerReadiness(
  left: ReadinessLevel,
  right: ReadinessLevel,
): ReadinessLevel {
  const rank: Record<ReadinessLevel, number> = { low: 0, medium: 1, high: 2 };
  return rank[left] <= rank[right] ? left : right;
}

/**
 * Build the live safety context for a tap swap from the same profile,
 * constraint and readiness sources used by the deterministic program.
 */
export function resolveTapSwapEnvironment(args: {
  date: string;
  profile?: OnboardingData | null;
  activeConstraints?: readonly ActiveConstraint[] | null;
  readinessSignal?: ReadinessSignal | null;
  primaryInjury?: TapSwapPrimaryInjury | null;
}): TapSwapEnvironment {
  const constraints = filterConstraintsForDate(
    [...(args.activeConstraints ?? [])].filter(activeConstraint),
    args.date,
  );
  const activeInjuries: Partial<Record<InjuryKey, 'caution' | 'avoid'>> = {};
  let primaryInjury = args.primaryInjury ?? null;

  for (const constraint of constraints) {
    if (constraint.type !== 'injury' && constraint.type !== 'soreness') continue;
    const bucket = constraint.bucket as InjuryBucket | null;
    if (!bucket) continue;
    const level = injuryLevel(constraint.severity);
    if (activeInjuries[bucket] !== 'avoid') activeInjuries[bucket] = level;
    if (!primaryInjury || constraint.severity > primaryInjury.severity) {
      primaryInjury = {
        bucket,
        severity: constraint.severity,
        seriousSymptoms:
          constraint.type === 'injury' && constraint.seriousSymptoms === true,
      };
    }
  }

  if (args.primaryInjury) {
    activeInjuries[args.primaryInjury.bucket] = injuryLevel(args.primaryInjury.severity);
  }

  const availableEquipmentTags = resolveEquipmentAvailability(
    args.profile,
    constraints,
    args.date,
  );
  let readiness = deriveScheduleReadiness({
    onboardingData: args.profile,
    signal: args.readinessSignal,
  });
  const fatigueConstraint = constraints.find((constraint) =>
    constraint.type === 'fatigue' && constraint.severity >= 6);
  if (fatigueConstraint) readiness = lowerReadiness(readiness, 'low');

  return {
    activeInjuries,
    primaryInjury,
    availableEquipment: equipmentTagsToSubstituteEquipmentClasses(
      availableEquipmentTags,
    ),
    availableEquipmentTags: [...availableEquipmentTags],
    readiness,
    hasEquipmentConstraint: constraints.some((constraint) =>
      constraint.type === 'equipment'),
    medicalStop: constraints.some((constraint) =>
      constraint.type === 'injury' && constraint.seriousSymptoms === true),
  };
}

function equipmentForExercise(name: string): EquipmentClass | null {
  return EXERCISE_LOAD_MAP[resolveExerciseName(name)]?.equipment ?? null;
}

function recoveryChoice(environment: TapSwapEnvironment): TapSwapChoice {
  if (environment.availableEquipmentTags.includes('bike_or_treadmill')) {
    return {
      kind: 'recovery',
      name: 'Easy Bike',
      hierarchyTier: 'recovery_easy_conditioning',
      source: 'recovery_fallback',
      reason: 'No useful safe training substitute remains, so use easy off-feet recovery.',
      prescription: {
        sets: 1,
        repsMin: 15,
        repsMax: 20,
        weight: 0,
        prescriptionType: 'duration_minutes',
        restSeconds: 0,
      },
    };
  }
  return {
    kind: 'recovery',
    name: 'Breathing Reset',
    hierarchyTier: 'recovery_easy_conditioning',
    source: 'recovery_fallback',
    reason: 'No useful safe training substitute remains, so use equipment-free recovery.',
    prescription: {
      sets: 1,
      repsMin: 5,
      repsMax: 5,
      weight: 0,
      prescriptionType: 'duration_minutes',
      restSeconds: 0,
    },
  };
}

function restChoice(reason: string): TapSwapChoice {
  return {
    kind: 'rest',
    name: null,
    hierarchyTier: 'rest',
    source: 'rest_fallback',
    reason,
  };
}

function isRecoveryName(name: string): boolean {
  return name === 'Easy Bike' || name === 'Breathing Reset';
}

/**
 * Final safety check used both while ranking suggestions and immediately
 * before the typed program-control action writes an override.
 */
export function assessTapSwapCandidateSafety(
  name: string,
  environment: TapSwapEnvironment,
): TapSwapSafetyDecision {
  if (environment.medicalStop) {
    return { safe: false, reason: 'A medical-stop constraint is active.' };
  }

  if (name === 'Easy Bike' &&
      !environment.availableEquipmentTags.includes('bike_or_treadmill')) {
    return { safe: false, reason: 'Bike/cardio equipment is not available.' };
  }

  const equipment = equipmentForExercise(name);
  if (equipment && !environment.availableEquipment.includes(equipment)) {
    return { safe: false, reason: `${equipment} equipment is not available.` };
  }
  if (!equipment && environment.hasEquipmentConstraint && !isRecoveryName(name)) {
    return { safe: false, reason: 'The replacement equipment cannot be verified.' };
  }

  const tags = getExerciseTags(resolveExerciseName(name));
  const activeInjuryEntries = Object.entries(environment.activeInjuries) as Array<
    [InjuryKey, 'caution' | 'avoid']
  >;
  if (activeInjuryEntries.length > 0 && !tags && !isRecoveryName(name)) {
    return { safe: false, reason: 'The replacement cannot be verified against the active injury.' };
  }
  for (const [bucket, level] of activeInjuryEntries) {
    const rating = tags?.injury[bucket];
    if (rating === 'avoid' || (level === 'avoid' && rating === 'caution')) {
      return { safe: false, reason: `The replacement still loads the active ${bucket} issue.` };
    }
  }

  if (environment.readiness === 'low' && tags?.fatigue === 'high') {
    return { safe: false, reason: 'Low readiness blocks a high-fatigue replacement.' };
  }
  return { safe: true, reason: 'Replacement passes injury, readiness and equipment checks.' };
}

function environmentForReason(
  originalExercise: string,
  reason: TapSwapReason,
  environment: TapSwapEnvironment,
): TapSwapEnvironment {
  if (reason !== 'no_equipment') return environment;
  const originalEquipment = equipmentForExercise(originalExercise);
  if (!originalEquipment || originalEquipment === 'bodyweight') return environment;
  return {
    ...environment,
    availableEquipment: environment.availableEquipment.filter(
      (equipment) => equipment !== originalEquipment,
    ),
  };
}

function tierForPatternCandidate(
  originalExercise: string,
  candidate: SubstituteCandidate,
): SubstitutionHierarchyTier {
  const originalMovement = getExerciseTags(
    resolveExerciseName(originalExercise),
  )?.movement;
  return originalMovement && candidate.tags?.movement === originalMovement
    ? 'same_movement_pattern'
    : 'similar_muscle_group';
}

function patternChoices(
  originalExercise: string,
  reason: TapSwapReason,
  environment: TapSwapEnvironment,
  avoidNames: readonly string[],
): TapSwapChoice[] {
  const candidates = getSubstituteCandidates(originalExercise, {
    activeInjuries: environment.activeInjuries,
    availableEquipment: environment.availableEquipment,
    allowHigherFatigue: reason === 'too_easy',
  });
  const ordered = reason === 'too_easy'
    ? [...candidates].sort((left, right) =>
        right.loadRatio - left.loadRatio || left.name.localeCompare(right.name))
    : candidates;
  return ordered
    .filter((candidate) => !avoidNames.includes(candidate.name.toLowerCase()))
    .filter((candidate) => assessTapSwapCandidateSafety(candidate.name, environment).safe)
    .map((candidate) => ({
      kind: 'exercise' as const,
      name: candidate.name,
      hierarchyTier: tierForPatternCandidate(originalExercise, candidate),
      source: 'pattern_substitute_engine' as const,
      reason: candidate.reason ?? 'Safe movement-pattern substitute.',
    }));
}

function registryPatternChoices(
  originalExercise: string,
  reason: TapSwapReason,
  environment: TapSwapEnvironment,
  avoidNames: readonly string[],
): TapSwapChoice[] {
  const canonical = resolveExerciseName(originalExercise);
  const originalTags = getExerciseTags(canonical);
  if (!originalTags || !PATTERN_REGISTRY_FALLBACKS.has(originalTags.movement)) return [];

  return Object.entries(EXERCISE_TAGS)
    .filter(([name, tags]) =>
      name !== canonical &&
      tags.movement === originalTags.movement &&
      !avoidNames.includes(name.toLowerCase()) &&
      assessTapSwapCandidateSafety(name, environment).safe)
    .sort((left, right) => {
      const leftTags = left[1];
      const rightTags = right[1];
      if (reason === 'too_easy') {
        return (
          LOAD_RANK[rightTags.load] - LOAD_RANK[leftTags.load] ||
          FATIGUE_RANK[rightTags.fatigue] - FATIGUE_RANK[leftTags.fatigue] ||
          left[0].localeCompare(right[0])
        );
      }
      return (
        FATIGUE_RANK[leftTags.fatigue] - FATIGUE_RANK[rightTags.fatigue] ||
        LOAD_RANK[leftTags.load] - LOAD_RANK[rightTags.load] ||
        left[0].localeCompare(right[0])
      );
    })
    .slice(0, 2)
    .map(([name]) => ({
      kind: 'exercise' as const,
      name,
      hierarchyTier: 'same_movement_pattern' as const,
      source: 'tag_registry_pattern_fallback' as const,
      reason: 'Safe same-pattern option from the exercise tag registry.',
    }));
}

function dedupeChoices(choices: readonly TapSwapChoice[]): TapSwapChoice[] {
  const seen = new Set<string>();
  return choices.filter((choice) => {
    const key = `${choice.kind}:${choice.name ?? ''}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((left, right) =>
    compareSafeTrainingFallbackTiers(left.hierarchyTier, right.hierarchyTier));
}

/**
 * Ordered tap swap ladder. It never forces a mutation: callers show the
 * first safe preference and still commit through ProgramControlAction.
 */
export function getTapSwapChoices(args: {
  originalExercise: string;
  reason: TapSwapReason;
  environment: TapSwapEnvironment;
  existingExerciseNames?: readonly string[];
  primaryInjury?: TapSwapPrimaryInjury | null;
  recoveryAllowed?: boolean;
}): TapSwapChoice[] {
  const primaryInjury = args.primaryInjury ?? args.environment.primaryInjury;
  const activeInjuries = { ...args.environment.activeInjuries };
  if (primaryInjury) {
    activeInjuries[primaryInjury.bucket] = injuryLevel(primaryInjury.severity);
  }
  const environment = environmentForReason(
    args.originalExercise,
    args.reason,
    {
      ...args.environment,
      activeInjuries,
      primaryInjury: primaryInjury ?? null,
      medicalStop:
        args.environment.medicalStop || primaryInjury?.seriousSymptoms === true,
    },
  );
  if (environment.medicalStop) {
    return [restChoice('A medical-stop constraint leaves no normal tap-swap option.')];
  }
  if (args.reason === 'injury_or_pain' && !primaryInjury) {
    return args.recoveryAllowed === false
      ? [restChoice('The injury area is unclassified and no verified recovery option is available.')]
      : [recoveryChoice(environment)];
  }

  const avoidNames = Array.from(new Set([
    resolveExerciseName(args.originalExercise).toLowerCase(),
    ...(args.existingExerciseNames ?? []).map((name) =>
      resolveExerciseName(name).toLowerCase()),
  ]));
  let trainingChoices: TapSwapChoice[] = [];

  if (primaryInjury) {
    trainingChoices = getReplacementChoicesForBucket(
      args.originalExercise,
      primaryInjury.bucket,
      primaryInjury.severity,
      args.existingExerciseNames ?? [],
    )
      .filter((choice) => assessTapSwapCandidateSafety(choice.name, environment).safe)
      .map((choice) => ({
        kind: choice.hierarchyTier === 'recovery_easy_conditioning'
          ? 'recovery' as const
          : 'exercise' as const,
        name: choice.name,
        hierarchyTier: choice.hierarchyTier,
        source: 'injury_hierarchy' as const,
        reason: `Safe ${choice.hierarchyTier.replace(/_/g, ' ')} option from the injury hierarchy.`,
        ...(choice.hierarchyTier === 'recovery_easy_conditioning'
          ? { prescription: recoveryChoice(environment).prescription }
          : {}),
      }));
  } else {
    trainingChoices = patternChoices(
      args.originalExercise,
      args.reason,
      environment,
      avoidNames,
    );
    if (trainingChoices.length === 0) {
      trainingChoices = registryPatternChoices(
        args.originalExercise,
        args.reason,
        environment,
        avoidNames,
      );
    }
  }

  const choices = dedupeChoices(trainingChoices);
  if (choices.length > 0) {
    if (!choices.some((choice) => choice.hierarchyTier === 'recovery_easy_conditioning') &&
        args.recoveryAllowed !== false) {
      choices.push(recoveryChoice(environment));
    }
    return dedupeChoices(choices);
  }
  if (args.recoveryAllowed !== false) return [recoveryChoice(environment)];
  return [restChoice('No safe useful training or recovery option remains.')];
}
