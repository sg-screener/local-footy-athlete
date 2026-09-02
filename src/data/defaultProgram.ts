import { getExerciseTags } from './exerciseTags';
import {
  Workout,
  WorkoutExercise,
  Exercise,
  UserProfile,
  SessionTier,
  OnboardingData,
  ExperienceLevel,
  SeasonPhase,
  AttachedConditioningKind,
  ConditioningBlock,
  IntensityLevel,
  SpeedBlock,
  WorkoutType,
} from '../types/domain';
import {
  classifyGenerationSession,
  type SessionAllocation,
} from '../utils/coachingEngine';
import { logger } from '../utils/logger';
import { addDaysISO } from '../utils/programBlockState';
import {
  dayOfWeekForISODate,
  todayISOLocal,
} from '../utils/appDate';
import {
  applyLoadEstimates,
  isTrueBodyweightExercise,
  normaliseAutomaticExerciseLoadChange,
  resolveExerciseName,
  startingWeightForAthlete,
} from '../utils/loadEstimation';
import {
  buildConditioningTemplate,
  buildDerivedSession,
  condEx,
  flavourToCategory,
  isRunningBasedConditioning,
  tagAsShiftedFromRun,
  conditioningDateHash,
  selectDefaultAerobicErgModalityFromHash,
  SPEED_SPRINT_TEMPLATES,
  type ErgModality,
  type ConditioningFeel,
  type ConditioningVariant,
} from '../utils/sessionBuilder';
import {
  SPEED_FALLBACK_TEMPLATE,
  composeConditioningRows,
  composeSpeedRows,
  demandCategoryFor,
  offFeetAlternative,
  renderableModalities,
  rendersOffFeet,
  resolveTemplateByName,
  selectConditioningTemplate,
  templateDurationMinutes,
  workoutTypeForCategory,
  type AthleteConditioningCategory,
  type ConditioningRole,
  codDecelPermitted,
  combinedConditioningMustBeOffFeet,
} from '../rules/conditioningSelection';
import {
  rankedPowerExerciseCandidates,
  selectPowerExerciseWithTrace,
} from '../rules/powerExercisePool';
import type { AutomaticWeeklyExerciseSelector } from '../rules/automaticWeeklyExerciseSelection';
import { slotsForExerciseName } from '../rules/sessionSlotCoverage';
import { rankSelectedFirst } from '../rules/programmingSelectionTrace';
import { parseConditioningDose, doseMidpoint } from '../rules/conditioningDose';
import {
  deloadPowerDose,
  applyConditioningDeloadToExercises,
} from '../rules/deloadWeekRules';
import { ladderLevelForProfile } from '../rules/experienceCrosswalk';
import {
  ACCESSORY_REP_GUIDELINES,
  LOWER_SECONDARY_REP_GUIDELINES,
  mainLiftSchemeForSlot,
  type AccessoryGuideline,
  type RepScheme,
} from '../rules/phaseRepSchemes';
import { automaticNordicPrescriptionForIdentity } from '../rules/nordicPrescription';
import {
  resolveOffseasonSubphase,
  type OffseasonSubphase,
} from '../rules/offseasonSubphase';
import { resolveTrainingAgePolicy } from '../rules/trainingAgePolicy';
import {
  applyDeloadPolicyToSessionAllocation,
  applyStrengthDeloadToExercises,
  type DeloadWeekPolicy,
} from '../rules/deloadWeekRules';
import {
  canonicalStrengthLabel,
  isConditioningOnlyText,
  resolveSessionDisplayName,
} from '../utils/sessionNaming';
import {
  classifyPoolSlot,
  findPoolEntry,
  type RotationContext,
  type AthletePoolPrefs,
  type PoolSlotKey,
} from './exercisePoolsStrength';
import { isTeamTrainingItem } from '../utils/teamTraining';
import {
  attachPrescriptionEffectEvidence,
  attachSessionEffectEvidence,
  buildPrescriptionEffectEvidence,
} from '../utils/deterministicCoachNoteFactory';
import { classifyGeneratedWorkoutRow } from '../rules/generatedWorkoutRowClassification';
import { enforceCuratedCueContract } from '../rules/curatedCueContract';
import {
  mainPatternsForLegacyStrengthPattern,
  normalizeStrengthIntent,
  type MainStrengthPattern,
  type StrengthIntent,
} from '../rules/strengthPatternContributions';
import { finaliseWorkoutAfterMutation } from '../utils/workoutCanonicalisation';
import { resolveEquipmentCapabilities } from '../utils/equipmentAvailability';
import {
  applyResolvedConditioningSubstitution,
  resolveWeeklyConditioningFeasibility,
} from '../rules/conditioningFeasibility';
import { canonicalWeeklyInjuryStateFrom } from '../rules/canonicalWeeklyInjuryState';

/**
 * Default exercises used in the training program
 */
export const DEFAULT_EXERCISES: Exercise[] = [
  // Lower Strength
  {
    id: 'ex-squat',
    name: 'Back Squat',
    description: 'Heavy compound leg exercise',
    exerciseType: 'Compound',
    muscleGroups: ['Quadriceps', 'Glutes', 'Hamstrings'],
    equipmentRequired: ['Barbell', 'Rack'],
    difficultyLevel: 'Intermediate',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-bulgarian-split',
    name: 'Bulgarian Split Squats',
    description: 'Single leg squat variation',
    exerciseType: 'Compound',
    muscleGroups: ['Quadriceps', 'Glutes'],
    equipmentRequired: ['Dumbbells', 'Bench'],
    difficultyLevel: 'Intermediate',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-rdl',
    name: 'RDLs',
    description: 'Romanian Deadlifts - posterior chain',
    exerciseType: 'Compound',
    muscleGroups: ['Hamstrings', 'Glutes', 'Lower Back'],
    equipmentRequired: ['Barbell'],
    difficultyLevel: 'Intermediate',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-leg-press',
    name: 'Leg Press',
    description: 'Machine leg press exercise',
    exerciseType: 'Compound',
    muscleGroups: ['Quadriceps', 'Glutes'],
    equipmentRequired: ['Machine'],
    difficultyLevel: 'Beginner',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-goblet-squat',
    name: 'Goblet Squat',
    description: 'Squat with dumbbell',
    exerciseType: 'Compound',
    muscleGroups: ['Quadriceps', 'Glutes'],
    equipmentRequired: ['Dumbbells'],
    difficultyLevel: 'Beginner',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-bodyweight-squat',
    name: 'Bodyweight Squat',
    description: 'Controlled squat pattern for technique and range',
    exerciseType: 'Compound',
    muscleGroups: ['Quadriceps', 'Glutes'],
    equipmentRequired: [],
    difficultyLevel: 'Beginner',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-glute-bridge',
    name: 'Glute Bridge',
    description: 'Bodyweight hip extension and hinge pattern',
    exerciseType: 'Compound',
    muscleGroups: ['Glutes', 'Hamstrings'],
    equipmentRequired: [],
    difficultyLevel: 'Beginner',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-calf-raises',
    name: 'Calf Raises',
    description: 'Standing calf raise',
    exerciseType: 'Isolation',
    muscleGroups: ['Calves'],
    equipmentRequired: [],
    difficultyLevel: 'Beginner',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // Upper Strength
  {
    id: 'ex-bench-press',
    name: 'Bench Press',
    description: 'Heavy chest press',
    exerciseType: 'Compound',
    muscleGroups: ['Chest', 'Triceps', 'Front Shoulders'],
    equipmentRequired: ['Barbell', 'Bench'],
    difficultyLevel: 'Intermediate',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-overhead-press',
    name: 'Overhead Press',
    description: 'Standing shoulder press',
    exerciseType: 'Compound',
    muscleGroups: ['Shoulders', 'Triceps', 'Chest'],
    equipmentRequired: ['Barbell'],
    difficultyLevel: 'Intermediate',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-db-rows',
    name: 'Single-Arm DB Row',
    description: 'Dumbbell rows',
    exerciseType: 'Compound',
    muscleGroups: ['Back', 'Biceps'],
    equipmentRequired: ['Dumbbells'],
    difficultyLevel: 'Intermediate',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-inverted-row',
    name: 'Inverted Row (Bodyweight)',
    description: 'Bodyweight row with an adjustable torso angle',
    exerciseType: 'Compound',
    muscleGroups: ['Back', 'Biceps'],
    // Item 47, 2026-08-13, from Sam's edit: an inverted row needs rings/TRX or
    // a bar to hang under. It is NOT free bodyweight — on true bodyweight
    // there is no horizontal pull at all, which is R-083 in his own words.
    equipmentRequired: ['Rings/TRX'],
    difficultyLevel: 'Beginner',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-face-pulls',
    name: 'Face Pulls',
    description: 'Rear delt and back exercise',
    exerciseType: 'Isolation',
    muscleGroups: ['Rear Delts', 'Back'],
    equipmentRequired: ['Cable Machine'],
    difficultyLevel: 'Beginner',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-tricep-dips',
    name: 'Dips',
    description: 'Bodyweight or weighted dips',
    exerciseType: 'Compound',
    muscleGroups: ['Triceps', 'Chest', 'Shoulders'],
    // Item 47, 2026-08-13, from Sam's edit of the equipment sheet: dips need
    // dip bars. Listed as needing nothing, they were reachable by a
    // bodyweight-only athlete who has nothing to dip on.
    equipmentRequired: ['Dip Bars'],
    difficultyLevel: 'Intermediate',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // Lower Hypertrophy
  {
    id: 'ex-trap-bar-deadlift',
    name: 'Trap Bar Deadlift',
    description: 'Deadlift with trap bar',
    exerciseType: 'Compound',
    muscleGroups: ['Glutes', 'Hamstrings', 'Quadriceps', 'Lower Back'],
    equipmentRequired: ['Trap Bar'],
    difficultyLevel: 'Advanced',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-hip-thrusts',
    name: 'Hip Thrusts',
    description: 'Barbell hip thrusts',
    exerciseType: 'Compound',
    muscleGroups: ['Glutes', 'Hamstrings'],
    equipmentRequired: ['Barbell', 'Bench'],
    difficultyLevel: 'Intermediate',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-walking-lunges',
    name: 'Walking Lunges',
    description: 'Walking lunge steps',
    exerciseType: 'Compound',
    muscleGroups: ['Quadriceps', 'Glutes', 'Hamstrings'],
    equipmentRequired: ['Dumbbells'],
    difficultyLevel: 'Intermediate',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-leg-extension',
    name: 'Leg Extension',
    description: 'Machine quad isolation',
    exerciseType: 'Isolation',
    muscleGroups: ['Quads'],
    equipmentRequired: ['Machine'],
    difficultyLevel: 'Beginner',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-nordic-lower',
    name: 'Nordic Lower',
    description: 'Nordic hamstring lower - eccentric posterior-chain isolation',
    exerciseType: 'Isolation',
    muscleGroups: ['Hamstrings'],
    equipmentRequired: [],
    difficultyLevel: 'Advanced',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // Upper Hypertrophy
  {
    id: 'ex-pullups',
    name: 'Pull-Ups',
    description: 'Bodyweight pullups',
    exerciseType: 'Compound',
    muscleGroups: ['Back', 'Biceps'],
    equipmentRequired: [],
    difficultyLevel: 'Intermediate',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-incline-db-bench',
    name: 'Incline DB Bench',
    description: 'Incline dumbbell bench press',
    exerciseType: 'Compound',
    muscleGroups: ['Upper Chest', 'Front Shoulders', 'Triceps'],
    equipmentRequired: ['Dumbbells', 'Bench'],
    difficultyLevel: 'Intermediate',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-barbell-rows',
    name: 'Barbell Row',
    description: 'Barbell bent-over rows',
    exerciseType: 'Compound',
    muscleGroups: ['Back', 'Biceps'],
    equipmentRequired: ['Barbell'],
    difficultyLevel: 'Intermediate',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-lateral-raises',
    name: 'Lateral Raise',
    description: 'Dumbbell lateral raises',
    exerciseType: 'Isolation',
    muscleGroups: ['Shoulders'],
    equipmentRequired: ['Dumbbells'],
    difficultyLevel: 'Beginner',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-barbell-curls',
    name: 'Bicep Curl (Barbell)',
    description: 'Barbell bicep curls',
    exerciseType: 'Isolation',
    muscleGroups: ['Biceps'],
    equipmentRequired: ['Barbell'],
    difficultyLevel: 'Beginner',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // Conditioning
  {
    id: 'ex-sprint-intervals',
    name: 'Sprint Intervals',
    description: '100m sprint repeats',
    exerciseType: 'Cardio',
    muscleGroups: [],
    equipmentRequired: [],
    difficultyLevel: 'Advanced',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-tempo-run',
    name: 'Tempo Run',
    description: 'Sustained running pace',
    exerciseType: 'Cardio',
    muscleGroups: [],
    equipmentRequired: [],
    difficultyLevel: 'Intermediate',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];




/**
 * Find an exercise by name (case-insensitive partial match) or create a simple one.
 *
 * Exported so the cross-cycle variation layer can resolve pool sibling
 * names to their canonical Exercise.id — needed for progression transfer
 * (pulling logged sets across rotated anchors in the same slot).
 */
export function findOrCreateExercise(name: string): Exercise {
  const canonicalName = resolveExerciseName(name);
  const lower = canonicalName.toLowerCase();

  // Pass 1 — exact match (case-insensitive). Always preferred.
  const exact = DEFAULT_EXERCISES.find((e) => e.name.toLowerCase() === lower);
  if (exact) return exact;

  // Pass 2 — fuzzy substring match, but ONLY for non-pool-managed names.
  //
  // The strength pool system canonicalises exercise names upstream; once a
  // name is in a pool, its identity is authoritative and must not be
  // collapsed onto a different pool member via substring match. Without
  // this guard "Deadlift" would be fuzzy-matched to "Trap Bar Deadlift"
  // (because "trap bar deadlift".includes("deadlift") is true), silently
  // breaking cross-cycle anchor rotation. For non-pool AI-suggested names
  // (typos, regional variants) the fuzzy fallback is still useful.
  if (!findPoolEntry(canonicalName)) {
    const fuzzy = DEFAULT_EXERCISES.find(
      (e) => e.name.toLowerCase().includes(lower) || lower.includes(e.name.toLowerCase()),
    );
    if (fuzzy) return fuzzy;
  }

  // Pass 3 — fall through to a custom Exercise.
  return {
    id: `ex-custom-${lower.replace(/[^a-z0-9]/g, '-')}`,
    name: canonicalName,
    description: canonicalName,
    exerciseType: 'Compound',
    muscleGroups: [],
    equipmentRequired: [],
    difficultyLevel: 'Intermediate',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export type CoachGeneratedWorkoutInput = {
  /**
   * SLICE B1 clause (f): this day's content was COMPOSED, so no later pass may
   * rewrite it. Written by `composedWeekToCoachInputs`; read here to skip
   * `applyPoolRotation` and by `finaliseWorkoutAfterMutation` to skip the drift
   * and restore branches. Held by the zero-mutation cell.
   */
  composed?: boolean;
  planEntryId?: string;
  strengthIntent?: StrengthIntent;
  dayOfWeek: number;
  name: string;
  workoutType: string;
  sessionTier?: string;
  exercises: Array<{
    name: string;
    sets: number;
    repsMin: number;
    repsMax: number;
    weight?: number;
    notes?: string;
    supersetGroup?: string;
    supersetOrder?: number;
    pairType?: string;
    /** B1-PIVOT: the composer's DECLARED role and pattern, carried to §18. */
    composedRole?: 'main_strength' | 'strength_accessory';
    composedPattern?: MainStrengthPattern | null;
  }>;
};

type PhasePrescriptionContext = {
  seasonPhase?: SeasonPhase;
  offseasonSubphase?: OffseasonSubphase | null;
  workoutName?: string;
  workoutType?: string;
  planEntry?: SessionAllocation | null;
};

const MAIN_LIFT_POOL_SLOTS = new Set<PoolSlotKey>([
  'squat',
  'hinge',
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
]);

const REP_ACCESSORY_POOL_SLOTS = new Set<PoolSlotKey>([
  'squat',
  'hinge',
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
  'isolation_upper',
  'isolation_lower',
]);

function baseSetsFromScheme(scheme: RepScheme): number {
  const match = /^(\d+)x/i.exec(scheme.base);
  const parsed = match ? Number(match[1]) : 3;
  return Math.min(scheme.setsMax, Math.max(scheme.setsMin, parsed || 3));
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function appendRepSchemeIntent(
  notes: string | undefined,
  scheme: RepScheme,
): string | undefined {
  if (scheme.targetRpeMin === undefined || scheme.targetRpeMax === undefined) return notes;
  const target = `Target RPE ${scheme.targetRpeMin}-${scheme.targetRpeMax}. ${scheme.intent}`;
  if (!notes) return target;
  if (notes.includes(target)) return notes;
  return `${notes} ${target}`;
}

function accessoryGuidelineForExercise(
  exerciseName: string,
  slot: PoolSlotKey,
  context: PhasePrescriptionContext,
  isLowerSecondary: boolean,
): AccessoryGuideline {
  const text = `${exerciseName} ${context.workoutName ?? ''} ${context.planEntry?.focus ?? ''}`;
  const nordic = automaticNordicPrescriptionForIdentity(exerciseName);
  if (nordic) {
    return {
      setsMin: nordic.sets,
      setsMax: nordic.sets,
      min: nordic.repsMin,
      max: nordic.repsMax,
      unit: 'reps',
      note: nordic.notes,
    };
  }
  if (slot === 'isolation_upper' || /gunshow|pump|arms?|bicep|tricep|curl|pushdown|lateral raise|rear delt|face pull/i.test(text)) {
    return ACCESSORY_REP_GUIDELINES.pump;
  }
  if (isLowerSecondary && context.seasonPhase) {
    return LOWER_SECONDARY_REP_GUIDELINES[context.seasonPhase];
  }
  return ACCESSORY_REP_GUIDELINES.general;
}

function isAccessoryPrescriptionContext(context: PhasePrescriptionContext): boolean {
  if (context.planEntry?.strengthPattern || context.planEntry?.hasCombinedConditioning) return false;
  const text = `${context.workoutName ?? ''} ${context.workoutType ?? ''} ${context.planEntry?.focus ?? ''}`;
  return /\b(gunshow|prehab|pump|accessor|trunk|arms?|bicep|tricep|delts?)\b/i.test(text);
}

function isStrengthPrescriptionContext(context: PhasePrescriptionContext): boolean {
  if (!context.seasonPhase) return false;
  const planEntry = context.planEntry;

  if (planEntry?.conditioningFlavour && !planEntry.hasCombinedConditioning) return false;
  if (planEntry?.tier === 'recovery') return false;

  const text = `${context.workoutName ?? ''} ${context.workoutType ?? ''} ${planEntry?.focus ?? ''}`;
  if (/\b(recovery|mobility|foam rolling|conditioning|aerobic|tempo|sprint|interval|game)\b/i.test(text) &&
      !/\b(strength|upper|lower|push|pull|squat|hinge|full body|gunshow|accessor|prehab|pump)\b/i.test(text)) {
    return false;
  }

  if (planEntry?.strengthPattern) return true;
  if (planEntry?.hasCombinedConditioning) return true;
  return /\b(strength|upper|lower|push|pull|squat|hinge|full body|gunshow|accessor|prehab|pump)\b/i.test(text);
}

function applyPhaseRepSchemeToExercise(
  exercise: WorkoutExercise,
  context: PhasePrescriptionContext,
): WorkoutExercise {
  if (!isStrengthPrescriptionContext(context) || exercise.prescriptionType && exercise.prescriptionType !== 'reps') {
    return exercise;
  }
  // THE DOSE IS THE RULING HERE, so the phase scheme does not own it. Every
  // other strength session takes its sets and reps from the phase because the
  // phase is the right owner; `lower_strength_g3`'s state 2 is the one session
  // whose sets and reps ARE the Bible sentence ("low reps ... 2x3 ... low
  // volume"). A phase scheme applied on top rewrote 2x3 to 3x2-4, which is a
  // heavy squat wearing the exception's name. Read as a variant, exactly as
  // `conditioningVariant` is read — not a phrase match, not a day check.
  if (context.planEntry?.strengthVariant === 'quality_low_volume') return exercise;

  const seasonPhase = context.seasonPhase!;
  const exerciseName = exercise.exercise?.name ?? '';
  const classification = classifyPoolSlot(resolveExerciseName(exerciseName));
  if (!classification) return exercise;

  const { slot, role } = classification;
  const accessoryContext = isAccessoryPrescriptionContext(context);
  if (!accessoryContext && role === 'anchor' && MAIN_LIFT_POOL_SLOTS.has(slot)) {
    const scheme = mainLiftSchemeForSlot(slot, seasonPhase, context.offseasonSubphase);
    if (!scheme) return exercise;
    return {
      ...exercise,
      prescribedSets: baseSetsFromScheme(scheme),
      prescribedRepsMin: scheme.repsMin,
      prescribedRepsMax: scheme.repsMax,
      notes: appendRepSchemeIntent(exercise.notes, scheme),
    };
  }

  if (!REP_ACCESSORY_POOL_SLOTS.has(slot)) return exercise;
  const lowerSecondary =
    (slot === 'squat' || slot === 'hinge') &&
    (role === 'accessory' || accessoryContext);
  const guideline = accessoryGuidelineForExercise(
    exerciseName,
    slot,
    context,
    lowerSecondary,
  );
  if (guideline.unit !== 'reps') return exercise;
  const setsFallback = Math.min(guideline.setsMax, Math.max(guideline.setsMin, exercise.prescribedSets || guideline.setsMin));
  return {
    ...exercise,
    prescribedSets: clampInt(exercise.prescribedSets, guideline.setsMin, guideline.setsMax, setsFallback),
    prescribedRepsMin: guideline.min,
    prescribedRepsMax: guideline.max,
  };
}

function applyPhaseRepSchemesToWorkoutExercises(
  exercises: WorkoutExercise[],
  context: PhasePrescriptionContext,
): WorkoutExercise[] {
  return exercises.map((exercise) => applyPhaseRepSchemeToExercise(exercise, context));
}

function applySubphaseMainLiftLoadMultiplier(
  exercises: WorkoutExercise[],
  context: PhasePrescriptionContext,
): WorkoutExercise[] {
  if (context.seasonPhase !== 'Off-season' || !context.offseasonSubphase) return exercises;
  if (!isStrengthPrescriptionContext(context) || isAccessoryPrescriptionContext(context)) return exercises;

  return exercises.map((exercise) => {
    const name = exercise.exercise?.name ?? '';
    const classification = classifyPoolSlot(resolveExerciseName(name));
    if (!classification || classification.role !== 'anchor' || !MAIN_LIFT_POOL_SLOTS.has(classification.slot)) {
      return exercise;
    }
    const scheme = mainLiftSchemeForSlot(
      classification.slot,
      context.seasonPhase!,
      context.offseasonSubphase,
    );
    const multiplier = scheme?.loadMultiplier ?? 1;
    const weight = exercise.prescribedWeightKg ?? 0;
    if (multiplier >= 1 || weight <= 0) return exercise;

    const adjustedWeight = normaliseAutomaticExerciseLoadChange({
      exerciseName: name,
      baseKg: weight,
      targetKg: weight * multiplier,
    }) ?? weight;
    return { ...exercise, prescribedWeightKg: adjustedWeight };
  });
}

function appendBeginnerTechniqueIntent(
  notes: string | undefined,
  targetRpeMin: number,
  targetRpeMax: number,
): string {
  let next = notes ?? '';
  if (!new RegExp(`Target RPE ${targetRpeMin}-${targetRpeMax}`, 'i').test(next)) {
    next = `${next}${next ? ' ' : ''}Target RPE ${targetRpeMin}-${targetRpeMax}.`;
  }
  const technique = 'Use controlled technique and stop well before failure.';
  if (!next.includes(technique)) next = `${next}${next ? ' ' : ''}${technique}`;
  return next;
}

function applyTrainingAgePrescription(
  exercises: WorkoutExercise[],
  onboardingData: OnboardingData,
  context: PhasePrescriptionContext,
): WorkoutExercise[] {
  const policy = resolveTrainingAgePolicy(onboardingData.experienceLevel);
  if (
    policy.level !== 'new' ||
    !isStrengthPrescriptionContext(context) ||
    policy.maxSetsPerExercise === null ||
    policy.compoundRepMin === null ||
    policy.compoundRepMax === null ||
    policy.targetRpeMin === null ||
    policy.targetRpeMax === null
  ) {
    return exercises;
  }

  return exercises.map((exercise) => {
    if (exercise.prescriptionType && exercise.prescriptionType !== 'reps') return exercise;
    const exerciseName = exercise.exercise?.name ?? '';
    const classification = classifyPoolSlot(exerciseName);
    if (!classification) return exercise;

    const compound = MAIN_LIFT_POOL_SLOTS.has(classification.slot);
    const repsMin = compound
      ? Math.min(
          policy.compoundRepMax,
          Math.max(policy.compoundRepMin, exercise.prescribedRepsMin),
        )
      : exercise.prescribedRepsMin;
    const repsMax = compound
      ? Math.max(
          repsMin,
          Math.min(policy.compoundRepMax, exercise.prescribedRepsMax),
        )
      : exercise.prescribedRepsMax;

    let prescribedWeightKg = exercise.prescribedWeightKg;
    if (!isTrueBodyweightExercise(exerciseName)) {
      // The multiplier is NOT applied here any more. `startingWeightForAthlete`
      // owns it, so the render-time fallback in useDayWorkout gets the same
      // number this does — previously it did not, and a beginner saw two
      // different weights for one exercise depending on which path filled the
      // card in (Sam, 2026-07-28).
      const beginnerCap = startingWeightForAthlete(exerciseName, onboardingData);
      if (beginnerCap) {
        prescribedWeightKg = prescribedWeightKg && prescribedWeightKg > 0
          ? Math.min(prescribedWeightKg, beginnerCap)
          : beginnerCap;
      }
    }

    return {
      ...exercise,
      prescribedSets: Math.max(1, Math.min(policy.maxSetsPerExercise, exercise.prescribedSets || 1)),
      prescribedRepsMin: repsMin,
      prescribedRepsMax: repsMax,
      prescribedWeightKg,
      notes: appendBeginnerTechniqueIntent(
        exercise.notes,
        policy.targetRpeMin,
        policy.targetRpeMax,
      ),
    };
  });
}

/**
 * Day name → JS dayOfWeek number (0=Sun..6=Sat).
 * Must match coachingEngine's DAY_NAMES indexing.
 */
const PLAN_DAY_MAP: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
};

/**
 * Convert the coaching engine's weeklyPlan into a day-of-week lookup.
 * Key: numeric dayOfWeek (0–6). Value: the engine's SessionAllocation.
 * Used to enforce deterministic structural fields over AI output.
 */
function buildPlanLookup(
  weeklyPlan: SessionAllocation[],
): Map<number, SessionAllocation> {
  const lookup = new Map<number, SessionAllocation>();
  for (const entry of weeklyPlan) {
    if (entry.dayOfWeek) {
      const dow = PLAN_DAY_MAP[entry.dayOfWeek];
      if (dow !== undefined) lookup.set(dow, entry);
    }
  }
  return lookup;
}

function buildPlanIdentityLookup(
  weeklyPlan: SessionAllocation[],
): Map<string, SessionAllocation> {
  return new Map(
    weeklyPlan
      .filter((entry): entry is SessionAllocation & { planEntryId: string } => !!entry.planEntryId)
      .map((entry) => [entry.planEntryId, entry]),
  );
}

function resolveGeneratedPlanEntry(
  workout: Pick<CoachGeneratedWorkoutInput, 'dayOfWeek' | 'planEntryId'>,
  planIdentityLookup: Map<string, SessionAllocation> | null,
  planLookup: Map<number, SessionAllocation> | null,
): SessionAllocation | null {
  const identityMatch = workout.planEntryId
    ? planIdentityLookup?.get(workout.planEntryId)
    : undefined;
  if (
    identityMatch?.dayOfWeek &&
    PLAN_DAY_MAP[identityMatch.dayOfWeek] === workout.dayOfWeek
  ) {
    return identityMatch;
  }
  return planLookup?.get(workout.dayOfWeek) ?? null;
}

/**
 * THE SCHEDULER'S TYPED DAY IDENTITY → the app's workout type. **One owner.**
 *
 * There were TWO copies of the day-identity inference in this file — this
 * fallback, which labels a synthesized day, and `normalizeGeneratedWorkoutType`,
 * which labels a built one. Both guessed from the same loose hints in the same
 * wrong precedence, and both were missing any carrier for the fixture. Fixing
 * one would have left the other, which is how this survived: **the same wall
 * twice.** So the typed answer is resolved HERE, once, and both readers call it.
 *
 * Returns null when the producer carried no identity — older producers still get
 * the historical inference rather than a fabricated answer.
 */
function authoredWorkoutType(entry: SessionAllocation | null): WorkoutType | null {
  const authored = entry?.authoredDay;
  if (!authored) return null;
  // Anchors are immovable and outrank every component on the day.
  if (authored.anchor === 'game') return 'Game';
  if (authored.anchor === 'club_training') return 'Team Training';
  const strength = authored.components.includes('strength');
  const conditioning = authored.components.includes('conditioning');
  // A multi-part day stays multi-part instead of collapsing to whichever
  // component the precedence happened to test first.
  if (strength && conditioning) return 'Mixed';
  if (strength) return 'Strength';
  if (conditioning) return 'Conditioning';
  return 'Recovery';
}

function fallbackWorkoutTypeForPlanEntry(entry: SessionAllocation): string {
  // The day's owner has stated what the day IS; a reader that keeps guessing
  // past that is the defect this whole change is about.
  const authored = authoredWorkoutType(entry);
  if (authored) return authored;
  if (entry.isTeamDay) return 'Team Training';
  if (entry.speedWorkKind === 'true_speed' && !entry.strengthPattern) return 'Sprint-Intervals';
  if (entry.tier === 'recovery' || /recovery|mobility|foam rolling/i.test(entry.focus)) {
    return 'Recovery';
  }
  if (entry.conditioningFlavour && !entry.hasCombinedConditioning) return 'Conditioning';
  if (entry.hasCombinedConditioning) return 'Mixed';
  return 'Strength';
}

function fallbackNameForPlanEntry(entry: SessionAllocation): string {
  // An anchor names itself. The fixture used to fall through every test here and
  // land on the strength label, so it reached the athlete typed `Game` and named
  // "Strength Session" — **the athlete reads the name**, so that is still a lost
  // anchor. Same resolver as the type, so the two cannot disagree.
  const anchorName = authoredWorkoutType(entry);
  if (anchorName === 'Game' || anchorName === 'Team Training') return anchorName;
  if (entry.isTeamDay) return 'Team Training';
  if (entry.speedWorkKind === 'true_speed' && !entry.strengthPattern) {
    return entry.speedBlock?.title ?? SPEED_FALLBACK_TEMPLATE;
  }
  if (entry.tier === 'recovery' || /recovery|mobility|foam rolling/i.test(entry.focus)) {
    return 'Recovery Session';
  }
  if (entry.conditioningFlavour && !entry.hasCombinedConditioning) return 'Conditioning';
  // Low-fatigue accessory/prehab slots (typical G-1 content) must not fall
  // through to a main-lift label — the resolver's G-1 pass expects a light
  // session here, and "Gunshow" is the canonical athlete-facing name.
  if (/accessor|prehab|gunshow|pump|low-fatigue/i.test(entry.focus)) return 'Gunshow';
  if (entry.strengthIntent) {
    return canonicalStrengthLabel(
      normalizeStrengthIntent(entry.strengthIntent).effectivePatterns,
    ) ?? 'Strength Session';
  }
  return 'Strength Session';
}

/**
 * ⚠ THE STRENGTH BRANCHES OF THIS FUNCTION ARE DELETED (B1-PIVOT, 2026-08-14).
 *
 * It held fifteen hardcoded branches, eleven of them returning exactly three
 * rows into a five-slot ladder, and with the AI severed (R-091) it had become
 * the sole author of every composed strength row. **`composeWeek` is now the
 * only production strength-content builder**, so a strength plan entry reaching
 * here is a reachability defect, not a case to be served — it throws rather than
 * quietly answering with the builder this slice retired.
 *
 * WHAT SURVIVES, AND WHY. Two branches author no strength at all: a mobility
 * day and a conditioning day, whose content belongs to the retained conditioning
 * and mobility adapters. They are a LABEL for a day the composer does not fill,
 * not a strength template.
 */
function fallbackExercisesForPlanEntry(entry: SessionAllocation): CoachGeneratedWorkoutInput['exercises'] {
  const lower = `${entry.focus ?? ''}`.toLowerCase();
  /**
   * ⚠ **`Mobility Flow` STOOD HERE AS A ONE-ROW PLACEHOLDER AND IS DELETED**
   * (Sam, 2026-08-21, on being shown it: *"yes delete this too"* — the fifth
   * name of the same family as the four invented recovery rows).
   *
   * It read `{ name: 'Mobility Flow', sets: 1, repsMin: 10, repsMax: 15 }`, so
   * a mobility or recovery day the composer had not filled shipped a single row
   * whose name is in no pool, with a rep range nobody authored, on a session
   * type that is supposed to carry 5-8 real movements.
   *
   * The comment above already says what these branches are: a LABEL for a day
   * whose content *"belongs to the retained conditioning and mobility
   * adapters"*. A label does not need a fake exercise inside it — so the list
   * is empty and the adapter fills the day. An uncovered day now shows as
   * EMPTY, which is visible, rather than as one invented movement, which reads
   * like a prescription.
   */
  if (entry.tier === 'recovery' || /mobility|recovery|foam|flush/i.test(lower)) {
    return [];
  }
  if (entry.conditioningFlavour || /conditioning|aerobic|tempo|sprint|interval/i.test(lower)) {
    return [{ name: 'Conditioning', sets: 1, repsMin: 1, repsMax: 1 }];
  }
  // ── A COMPOSED-OPTIONAL DAY IS NOT A STRENGTH TEMPLATE (2026-08-14) ───────
  //
  // **MEASURED: 48 of the 180 worlds refused here, and not one of them was a
  // strength day.** Every one named `…:optional` carrying
  // `composedOptionalKind: 'gunshow'` — Sam's optional arms/pump session, whose
  // content comes from the SIGNED POOLS through `buildDerivedSession` a few
  // hundred lines below (his class ruling, 2026-07-30: *"REAL COMPOSED SESSIONS
  // ONLY"*). The builder DISCARDS whatever it is seeded with for these days, so
  // this row is a placeholder that keeps the DAY alive until its real owner
  // composes it — exactly what the conditioning branch above does.
  //
  // The severance throw was right to exist and wrong to catch this: the
  // composer never owned an arms day, so a composed week not covering one is
  // not a hole in the composer.
  if (entry.composedOptionalKind) {
    return [{ name: 'Optional', sets: 1, repsMin: 1, repsMax: 1 }];
  }
  throw new Error(
    'B1-PIVOT: the legacy strength-content builder is severed. A strength plan '
    + `entry (${entry.planEntryId ?? entry.dayOfWeek ?? 'unknown'}) reached `
    + 'fallbackExercisesForPlanEntry, which means composeWeek did not cover a day '
    + 'the planner asked for. Fix the composer or the skeleton — never reconnect '
    + 'this builder.',
  );
}

function completeCoachWorkoutsFromPlan(
  coachWorkouts: CoachGeneratedWorkoutInput[],
  weeklyPlan?: SessionAllocation[],
  composedStrengthDays?: readonly number[],
): CoachGeneratedWorkoutInput[] {
  if (!weeklyPlan?.length) return coachWorkouts;

  const existingDows = new Set(coachWorkouts.map((workout) => workout.dayOfWeek));
  const additions: CoachGeneratedWorkoutInput[] = [];

  for (const entry of weeklyPlan) {
    if (!entry.dayOfWeek) continue;
    const dayOfWeek = PLAN_DAY_MAP[entry.dayOfWeek];
    if (dayOfWeek === undefined || existingDows.has(dayOfWeek)) continue;
    // ⚠ THE COMPOSER OWNS THE STRENGTH OF THIS DAY, SO THE ADAPTER AUTHORS NONE.
    // The DAY still exists here — that is the whole point — so its conditioning,
    // running and sprint work is built exactly as before, and
    // `assembleAuthoredWeek` merges the composer's lifts onto it.
    const composerOwnsStrength = composedStrengthDays?.includes(dayOfWeek) === true;
    additions.push({
      planEntryId: entry.planEntryId,
      strengthIntent: entry.strengthIntent,
      dayOfWeek,
      name: fallbackNameForPlanEntry(entry),
      workoutType: fallbackWorkoutTypeForPlanEntry(entry),
      sessionTier: entry.tier,
      // ⚠ NOT SIMPLY EMPTY. A day with no content at all collapses to REST on
      // the adapter's side and its conditioning resolution never runs —
      // measured on the first attempt: three composed days came back `Rest`,
      // rows 0, block false, and §18 then reported zero sprint exposure. A
      // composed day the plan gave conditioning keeps the conditioning SEED and
      // nothing else; its lifts are the composer's.
      exercises: composerOwnsStrength
        ? (entry.conditioningFlavour || entry.hasCombinedConditioning
            ? [{ name: 'Conditioning', sets: 1, repsMin: 1, repsMax: 1 }]
            : [])
        : fallbackExercisesForPlanEntry(entry),
    });
    existingDows.add(dayOfWeek);
  }

  if (additions.length > 0) {
    logger.warn('[ProgramGen] AI omitted weekly plan days; completing from deterministic plan', {
      missingDays: additions.map((workout) => workout.dayOfWeek),
    });
  }

  return [...coachWorkouts, ...additions].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
}

/**
 * Build Workout domain objects from AI-generated JSON.
 *
 * STRUCTURAL FIELDS (tier, intensity) are AUTHORITATIVE from the coaching
 * engine's weeklyPlan — the AI is not trusted for these. The AI controls
 * exercise selection, names, progression, and coaching detail.
 *
 * "Code decides the dose. AI decides the details."
 *
 * @param coachWorkouts  — Parsed JSON from the AI edge function
 * @param microcycleId   — Microcycle ID for the generated workouts
 * @param weeklyPlan     — Coaching engine's deterministic session allocations.
 *                          When provided, tier and intensity are enforced from
 *                          the plan. Omit only for legacy/fallback callers.
 */
/**
 * Validate and strip invalid or excessive superset pairings.
 *
 * Rules enforced:
 *   1. Max THREE paired blocks per workout (strip all groups beyond the third)
 *   2. Pairing only allowed on core strength sessions
 *   3. Each group must have exactly 2 exercises (strip incomplete groups)
 *   4. pairType must be 'contrast' | 'superset' | 'circuit' (strip unknown)
 *
 * ## Rule 1 was ONE and Sam authored THREE — corrected 2026-08-13
 *
 * `docs/MOBILITY_PAIRING_RULINGS_2026-07-31.md` rule 1, Sam-ruled: *"On strength
 * days, 2-3 accessory exercises are paired with mobility exercises as SUPERSETS
 * by default"*. This validator capped a session at ONE pair and silently binned
 * the rest, so a producer built to his design would have lost two thirds of it
 * with no error — the session would simply arrive smaller and nothing would say
 * why. Its ceiling is now his number.
 *
 * IT IS STILL A CEILING, NOT A TARGET. Four pairs is not his design either, so
 * the fourth is still stripped; what changed is where the line sits.
 */
const MAX_PAIRED_BLOCKS_PER_SESSION = 3;
export function validatePairings(
  exercises: WorkoutExercise[],
  tier: SessionTier | undefined,
): WorkoutExercise[] {
  // Rule 2: only core strength sessions may have pairings
  if (tier !== 'core') {
    return exercises.map((ex) => {
      if (ex.supersetGroup) {
        logger.warn(`[PairingValidator] Stripped pairing on non-core session: ${ex.exercise?.name}`);
        const { supersetGroup, supersetOrder, pairType, ...rest } = ex;
        return rest as WorkoutExercise;
      }
      return ex;
    });
  }

  // Collect groups
  const groups = new Map<string, number>();
  for (const ex of exercises) {
    if (ex.supersetGroup) {
      groups.set(ex.supersetGroup, (groups.get(ex.supersetGroup) || 0) + 1);
    }
  }

  // Rule 3: strip incomplete groups (not exactly 2 members)
  const invalidGroups = new Set<string>();
  for (const [group, count] of groups) {
    if (count !== 2) {
      logger.warn(`[PairingValidator] Stripped group "${group}" — has ${count} exercises (expected 2)`);
      invalidGroups.add(group);
    }
  }

  // Rule 1: keep the first THREE valid groups in authored order, strip the rest.
  const allowedGroups = new Set<string>();
  const excessGroups = new Set<string>();
  for (const ex of exercises) {
    if (!ex.supersetGroup || invalidGroups.has(ex.supersetGroup)) continue;
    if (allowedGroups.has(ex.supersetGroup)) continue;
    if (allowedGroups.size < MAX_PAIRED_BLOCKS_PER_SESSION) {
      allowedGroups.add(ex.supersetGroup);
    } else {
      logger.warn(`[PairingValidator] Stripped excess group "${ex.supersetGroup}" — `
        + `max ${MAX_PAIRED_BLOCKS_PER_SESSION} pairs per session`);
      excessGroups.add(ex.supersetGroup);
    }
  }

  const stripGroups = new Set([...invalidGroups, ...excessGroups]);

  // Rule 4: validate pairType
  const VALID_PAIR_TYPES = new Set(['contrast', 'superset', 'circuit']);

  return exercises.map((ex) => {
    if (!ex.supersetGroup) return ex;
    if (stripGroups.has(ex.supersetGroup)) {
      const { supersetGroup, supersetOrder, pairType, ...rest } = ex;
      return rest as WorkoutExercise;
    }
    // Validate pairType
    if (ex.pairType && !VALID_PAIR_TYPES.has(ex.pairType)) {
      logger.warn(`[PairingValidator] Unknown pairType "${ex.pairType}" — stripping`);
      return { ...ex, pairType: undefined };
    }
    return ex;
  });
}

/**
 * Build a resolved ConditioningBlock from the assembled condBlock exercises.
 *
 * Emits a single option representing the prescribed conditioning session.
 * The `options` array is kept as the data-model contract so multi-modality
 * "Choose one" variants (e.g. run / bike / row for a zone-2 session) can be
 * added later without touching the renderer — but a block always has at
 * least one option, and all options within a block share the same intent.
 *
 * No "flush" or "supplementary" concept at this layer: every session has
 * exactly one conditioning intent. Aerobic flush was removed from the
 * combined S+C path so it can no longer appear as a secondary block.
 */
export function buildConditioningBlock(
  flavour: 'aerobic' | 'tempo' | 'high-intensity',
  condBlock: WorkoutExercise[],
  attachedKind?: AttachedConditioningKind,
  modality?: 'bike' | 'row' | 'ski' | 'running' | 'mixed',
  availableMachines?: ReadonlyArray<'bike' | 'air_bike' | 'row' | 'ski'>,
  templateName?: string,
): ConditioningBlock | undefined {
  if (!condBlock || condBlock.length === 0) return undefined;

  // Headline row = the first non-warm-up / non-cool-down exercise, used
  // as the option title so the description matches what the athlete will
  // actually do.
  const headline =
    condBlock.find((ex) => {
      const n = (ex.exercise?.name || '').toLowerCase();
      return !n.includes('warm-up') && !n.includes('cool-down') && !n.includes('cooldown');
    }) ?? condBlock[condBlock.length - 1];
  const headlineName = headline.exercise?.name || 'Conditioning';
  const template = resolveTemplateByName(templateName ?? headlineName);
  const optionTitle = template?.name ?? headlineName;
  const machines = template ? renderableModalities(template).filter(m => m !== 'run'
    && (availableMachines === undefined || availableMachines.includes(m as never))) : [];
  const mixedMachines = (['bike', 'air_bike', 'ski', 'row'] as const)
    .filter(machine => machines.includes(machine));
  const modalitySequence = modality === 'running' ? ['run' as const]
    : modality === 'mixed' ? mixedMachines.slice(0, Math.max(1, headline.prescribedSets))
    : modality === 'bike' ? machines.filter(m => m === 'bike' || m === 'air_bike').slice(0, 1)
    : machines.filter(m => m === modality).slice(0, 1);

  return {
    intent: flavour,
    ...(attachedKind ? { attachedKind } : {}),
    options: [
      {
        title: optionTitle,
        description: '',
        ...(template?.quality === 'flush' ? { durationMinutes: templateDurationMinutes(template) } : {}),
        exerciseIds: condBlock.map((ex) => ex.id),
        ...(modality ? { modality } : {}),
        ...(modalitySequence.length ? { modalitySequence } : {}),
      },
    ],
  };
}

/**
 * The modality a combined conditioning block resolved to. Authored names
 * never carry a machine word, so this is typed from the selection decision:
 * the erg pick when the block renders off-feet, 'running' when the authored
 * template renders on run only.
 */
export function resolvedBlockModality(
  templateName: string,
  ergModality: ErgModality | undefined,
  availableMachines?: ReadonlyArray<'bike' | 'air_bike' | 'row' | 'ski'>,
): 'bike' | 'row' | 'ski' | 'running' | 'mixed' | undefined {
  const template = resolveTemplateByName(templateName);
  if (template && !rendersOffFeet(template)) return renderableModalities(template).includes('run') ? 'running' : undefined;
  const requested = ergModality === 'bike_erg' ? 'bike' : ergModality;
  if (!template) {
    return requested === 'bike' || requested === 'row' || requested === 'ski' || requested === 'mixed'
      ? requested
      : undefined;
  }
  // No machine was selected: a generic compatible template remains a run.
  // Never manufacture the first catalogue machine merely because one exists.
  if (!requested && renderableModalities(template).includes('run')) return 'running';
  // Clamp the erg pick to what the AUTHORED notes let this row render on —
  // a ski stamp on a run/bike-only template would be an invented rendering.
  const permittedMachines = renderableModalities(template)
      .filter((m) => m !== 'run')
      .filter((m) => availableMachines === undefined || availableMachines.includes(m as never));
  const machines = new Set(permittedMachines.map((m) => (m === 'air_bike' ? 'bike' : m)));
  if (permittedMachines.length === 0 && renderableModalities(template).includes('run')) return 'running';
  // Delivery feasibility reads the signed count. Athlete copy may phrase that
  // count as a complete block (`4 × 3-minute blocks`), which is display text
  // rather than a new selection input.
  const rounds = parseConditioningDose(template.setsRounds);
  if (requested === 'mixed' && template.quality === 'flush' && permittedMachines.length > 1
    && rounds.ok && doseMidpoint(rounds.quantity) > 1) return 'mixed';
  if ((requested === 'bike' || requested === 'row' || requested === 'ski') && machines.has(requested)) {
    return requested;
  }
  return machines.has('bike') ? 'bike'
    : machines.has('row') ? 'row'
    : machines.has('ski') ? 'ski'
    : undefined;
}

function buildSpeedBlock(
  planEntry: SessionAllocation,
  speedExercises: WorkoutExercise[],
): SpeedBlock | undefined {
  if (!planEntry.speedBlock) return undefined;
  return {
    ...planEntry.speedBlock,
    exerciseIds: speedExercises.map((exercise) => exercise.id),
  };
}

/**
 * Render the engine's typed power-primer intent into a POWER ROW.
 *
 * Sam's ruling (2026-07-27): power is a row in `exercises[]` with a typed role,
 * not a block beside the list. What used to be a `PowerBlock` is now ordinary
 * row data — the pool's chosen exercise is the row's exercise, the policy's dose
 * is the row's sets and rep range, and the placement/contrast guidance is the
 * row's notes. Only `family` and `kind` had nowhere else to live, so they are
 * the row's `power` field.
 *
 * Identity is chosen by `selectPowerExercise` from Sam's typed pool
 * (docs/POWER_EXERCISE_POOL_SPEC_2026-07-23.md). No exercise name is hardcoded
 * here beyond the unreachable null fallback, and the med-ball family stays
 * retired. Equipment is read again — the pool has an equipment-gated entry
 * (Depth Jumps needs a box) and the selector drops it for athletes without one
 * rather than substituting.
 *
 * THE FENCE. It used to be enforced by absence: power was not in `exercises[]`,
 * so nothing that iterated the list could count it. Now the row is in the list
 * and `role: 'power'` carries the exemption, read at one place
 * (`src/rules/sessionRowCounting.ts`). The four fence facts are unchanged — not
 * a hard exposure, not main strength, no conditioning credit, not a finisher —
 * and the differential golden is what proves it.
 */
/**
 * ⚠ EXPORTED 2026-08-19 SO THE COMPOSER CAN CONSUME IT (seat `demolition`).
 *
 * The power primer is decided by `powerPrimerPolicy` and carried on the plan
 * entry; this turns that typed decision into the row. It was private to the
 * adapter, and the adapter authors no strength on composer-owned days — which
 * is exactly why no generated athlete has ever received a power row. The
 * composer now calls THIS function rather than growing a second one, so there
 * is one power-row builder in the app and the dose stays the specialist's.
 */
export function buildPowerRow(
  spec: NonNullable<SessionAllocation['powerPrimer']>,
  workoutId: string,
  selection: PowerBlockSelectionInput = {},
): WorkoutExercise | null {
  // Identity comes from the pool. The policy owns placement and legacy dose;
  // R-270's authored per-exercise prescription supplies the new ball doses.
  // A reduced policy remains a ceiling on their set count.
  const powerContext = {
    family: spec.family,
    phase: selection.phase ?? 'Pre-season',
    trainingAge: ladderLevelForProfile(selection.experienceLevel),
    reduced: spec.reduced,
    availableEquipment: selection.availableEquipment ?? [],
    blockId: selection.blockId ?? 'block-1',
    kind: spec.kind,
    seatIndex: selection.seatIndex,
    selectionContext: selection.blockStartISO ? {
      blockStartISO: selection.blockStartISO,
      history: selection.selectionHistory ?? [],
    } : undefined,
  } as const;
  const decision = selectPowerExerciseWithTrace(powerContext, selection.traceContext ?? {
    dateISO: 'unknown', weekStartISO: 'unknown', dayOfWeek: -1,
    experience: selection.experienceLevel ?? null, injuries: [], daysToGame: null,
  });
  const picked = selection.automaticWeeklyExerciseSelector
    ? rankedPowerExerciseCandidates(powerContext).find((candidate) =>
        selection.automaticWeeklyExerciseSelector!.canUse({
          identity: candidate.name,
          requestedSlot: slotsForExerciseName(candidate.name)[0] ?? 'core',
          dayKind: null,
          route: 'power',
          requestedAsMain: false,
        })) ?? null
    : decision.entry;
  selection.selectionTracesOut?.push(picked === decision.entry ? decision.trace : {
    ...decision.trace,
    selected: picked?.name ?? null,
    selectionReason: picked ? 'weekly_history_next_legal_power_candidate' : 'weekly_history_no_unused_power_candidate',
    candidates: rankSelectedFirst(decision.trace.candidates, picked?.name ?? null),
  });
  // The selector covers every real (family, phase, experience) cell, so null is
  // unreachable in practice; falling back to the family's bodyweight default
  // keeps a missing power row from being worse than a plain one.
  if (selection.automaticWeeklyExerciseSelector && !picked) return null;
  const name = picked?.name ?? (spec.family === 'lower' ? 'Vertical Jump' : 'Explosive Push-up');
  selection.automaticWeeklyExerciseSelector?.accept({
    identity: name,
    requestedSlot: slotsForExerciseName(name)[0] ?? 'core',
    dayKind: null,
    route: 'power',
    requestedAsMain: false,
  });
  const authored = getExerciseTags(name)?.prescription;

  // PLACEMENT and CONTRAST guidance only. Per-exercise coaching text is NOT
  // here: rows render curated `EXERCISE_CUES` like every other row, so a second
  // cue channel through notes would be the bypass Sam's run-7 ruling closed.
  // What stays is the information no exercise cue could carry — when to do it,
  // and how contrast pairs with the heavy set.
  const notes = spec.kind === 'contrast'
    ? 'Do this fresh, early in the session — before the main lifts. Contrast: perform sharply straight after your heavy set, then rest fully before the next round.'
    : 'Do this fresh, early in the session — before the main lifts.';

  return {
    ...(selection.automaticWeeklyExerciseSelector ? { automaticSelection: true as const } : {}),
    id: `power-${workoutId}`,
    workoutId,
    exerciseId: `power-${workoutId}-exercise`,
    // Power is pre-lift and must sort first. `exerciseOrder` 0 puts it ahead of
    // every generated strength row, which start at 1.
    exerciseOrder: 0,
    prescribedSets: authored ? (spec.reduced ? Math.min(spec.sets, authored.sets) : authored.sets) : spec.sets,
    prescribedRepsMin: authored?.repsMin ?? spec.repsMin,
    prescribedRepsMax: authored?.repsMax ?? spec.repsMax,
    restSeconds: authored?.restSeconds ?? 120,
    prescriptionType: authored?.prescriptionType,
    perSide: authored?.perSide,
    notes: authored ? `${notes} ${authored.notes}` : notes,
    role: 'power',
    power: { family: spec.family, kind: spec.kind },
    section18Evidence: {
      protocolVersion: 1,
      // Authored, not inferred. `Explosive Push-up` classifies as a main lift by
      // name, so letting the row classifier answer here would hand §18
      // main-strength evidence for power work — the same trap the taxonomy's
      // choke point exists to close, one layer down.
      role: 'power',
      strengthPattern: null,
      mainStrengthPattern: null,
      provenance: 'canonical_row_classifier',
    },
    exercise: findOrCreateExercise(name),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/** Context the power selector needs that the policy's dose spec does not carry. */
interface PowerBlockSelectionInput {
  automaticWeeklyExerciseSelector?: AutomaticWeeklyExerciseSelector;
  phase?: SeasonPhase;
  experienceLevel?: ExperienceLevel | null;
  availableEquipment?: readonly string[];
  /**
   * Training-block identity — the mini-cycle number, NOT the microcycle/week.
   * Seeding on the week would re-pick every week and break the spec's
   * block-stability rule.
   */
  blockId?: string;
  blockStartISO?: string;
  seatIndex?: number;
  selectionHistory?: readonly import('../rules/powerExercisePool').BlockPowerSelection[];
  selectionTracesOut?: import('../rules/programmingSelectionTrace').AutomaticProgrammingSelectionTrace[];
  traceContext?: {
    readonly dateISO: string;
    readonly weekStartISO: string;
    readonly dayOfWeek: number;
    readonly experience: string | null;
    readonly injuries: readonly string[];
    readonly daysToGame: number | null;
  };
}

export function buildWorkoutsFromCoach(
  coachWorkouts: CoachGeneratedWorkoutInput[],
  microcycleId: string = 'mc-1',
  weeklyPlan?: SessionAllocation[],
  onboardingData?: OnboardingData,
  /**
   * Optional rotation context for the cross-cycle exercise variation system.
   * When provided, AI-suggested exercises that map to a managed strength
   * pool slot (squat, hinge, horizontal_push/vertical_push, horizontal_pull/
   * vertical_pull, carry, isolation_upper, isolation_lower, plyo) are
   * rewritten to the rotation-selected variant for this block/week. When
   * omitted, names pass through unchanged (backwards-compatible default).
   */
  rotationContext?: RotationContext,
  /**
   * Optional per-athlete pool overrides (exclusion / pinning / active-injury
   * filter). Threaded into `applyPoolRotation` → `selectPoolEntryAvoiding`.
   * When undefined (or every pref field is empty), behaviour is identical
   * to the refinement-2 baseline — no filter, no bias.
   */
  athletePrefs?: AthletePoolPrefs,
): Workout[] {
  const effectiveAthletePrefs = onboardingData?.experienceLevel
    ? {
        excluded: athletePrefs?.excluded ?? [],
        pinned: athletePrefs?.pinned ?? [],
        ...athletePrefs,
        experienceLevel: onboardingData.experienceLevel,
      }
    : athletePrefs;
  const offseasonSubphase = resolveOffseasonSubphase({
    seasonPhase: onboardingData?.seasonPhase,
    explicitSubphase: rotationContext?.offseasonSubphase,
  });
  function deloadPolicyForDayOfWeek(dayOfWeek: number | undefined): DeloadWeekPolicy | null {
    if (dayOfWeek !== undefined && rotationContext?.canonicalDosePolicyByDay) {
      return rotationContext.canonicalDosePolicyByDay[dayOfWeek] ?? null;
    }
    return null;
  }

  const profileEquipment = resolveEquipmentCapabilities(onboardingData);
  const availableEquipment = effectiveAthletePrefs?.availableEquipment ?? profileEquipment.tags;
  const conditioningModalities = effectiveAthletePrefs?.conditioningModalities ?? (
    effectiveAthletePrefs?.availableEquipment
      ? effectiveAthletePrefs.availableEquipment.includes('bike_or_treadmill')
        ? profileEquipment.conditioningModalities.length > 0
          ? profileEquipment.conditioningModalities
          : (['bike_erg', 'air_bike', 'row', 'ski', 'treadmill'] as import('../types/domain').ConditioningEquipmentModality[])
        : []
      : profileEquipment.conditioningModalities
  );
  const equipmentCapabilities = {
    ...profileEquipment,
    tags: [...availableEquipment],
    conditioningModalities: [...conditioningModalities],
  };
  // The athlete's machine set in the authored-template modality space —
  // selection must not serve a row nothing they own can render.
  const availableMachines = equipmentCapabilities.conditioningModalities
    .filter((modality) => modality !== 'treadmill')
    .map((modality) => (modality === 'bike_erg' ? 'bike' : modality)) as
      Array<'bike' | 'air_bike' | 'row' | 'ski'>;
  const deloadedWeeklyPlan = rotationContext?.canonicalPlanDoseResolved
    ? weeklyPlan
    : weeklyPlan?.map((entry) => applyDeloadPolicyToSessionAllocation(
        entry,
        deloadPolicyForDayOfWeek(entry.dayOfWeek ? PLAN_DAY_MAP[entry.dayOfWeek] : undefined),
      ));
  const effectiveWeeklyPlan = deloadedWeeklyPlan
    ? rotationContext?.conditioningFeasibilityResolved &&
        rotationContext.canonicalPlanDoseResolved
      // The compiler already authored this derived output. Re-running the
      // specialist here would make the retained adapter a second writer of the
      // same plan, even when its answer happened to be idempotent.
      ? deloadedWeeklyPlan
      : resolveWeeklyConditioningFeasibility(
          deloadedWeeklyPlan,
          {
            phase: onboardingData?.seasonPhase,
            offseasonSubphase,
            equipment: equipmentCapabilities,
            injury: onboardingData
              ? canonicalWeeklyInjuryStateFrom({ profile: onboardingData })
              : undefined,
          },
        )
    : undefined;
  const planLookup = effectiveWeeklyPlan ? buildPlanLookup(effectiveWeeklyPlan) : null;
  const planIdentityLookup = effectiveWeeklyPlan
    ? buildPlanIdentityLookup(effectiveWeeklyPlan)
    : null;
  const feasibleCoachWorkouts = coachWorkouts.flatMap((workout) => {
    const planEntry = resolveGeneratedPlanEntry(workout, planIdentityLookup, planLookup);
    const plannerOwnsConditioning = !!planEntry?.conditioningCategory ||
      planEntry?.hasCombinedConditioning === true;
    const conditioningRemoved = planEntry?.conditioningFeasibility?.status === 'removed';
    if (!planEntry || (plannerOwnsConditioning && !conditioningRemoved)) return [workout];
    const strengthRemains = !!planEntry.strengthPattern ||
      !!planEntry.strengthIntent?.plannedPatterns.length;
    const withoutUnselectedConditioning = {
      ...workout,
      exercises: (workout.exercises ?? []).filter((exercise, index) =>
        classifyGeneratedWorkoutRow({
          name: exercise.name,
          sets: exercise.sets,
          repsMax: exercise.repsMax,
          index,
        }).kind !== 'conditioning'),
    };
    if (!strengthRemains && withoutUnselectedConditioning.exercises.length === 0) return [];
    return [withoutUnselectedConditioning];
  });
  const edgeProvidedDays = new Set(feasibleCoachWorkouts.map((workout) => workout.dayOfWeek));
  const completedCoachWorkouts = completeCoachWorkoutsFromPlan(
    feasibleCoachWorkouts,
    effectiveWeeklyPlan,
    rotationContext?.composedStrengthDays,
  );

  const finaliseBuiltWorkout = (
    workout: Workout,
    planEntry: SessionAllocation | null,
  ): Workout => {
    const result = finaliseWorkoutAfterMutation(workout, {
      phase: onboardingData?.seasonPhase,
      offseasonSubphase,
      weekKind: rotationContext?.weekKind,
      profile: onboardingData,
      planIntentValid: !!planEntry?.planEntryId &&
        workout.planEntryId === planEntry.planEntryId,
      // B1-PIVOT: EVERY generation-built workout is composed content now, so the
      // canonicaliser's drift and restore branches stand down for all of them.
      // Edit-time canonicalisation is a different consumer and keeps both.
      composed: true,
    });
    if (result.actions.length > 0) {
      logger.warn('[WorkoutCanonicalisation] Generated workout finalised', {
        microcycleId,
        dayOfWeek: workout.dayOfWeek,
        planEntryId: workout.planEntryId ?? null,
        actions: result.actions,
      });
    }
    return result.workout;
  };

  // ── Build a synthetic dateStr for deterministic variety ──
  // Generated workouts are day-of-week keyed. When the caller passes a
  // weekStartISO, hash against that real generated week; legacy callers fall
  // back to today's week for backward compatibility.
  const todayISO = todayISOLocal();
  const todayDow = dayOfWeekForISODate(todayISO); // 0=Sun
  function syntheticDateStr(dayOfWeek: number): string {
    if (rotationContext?.weekStartISO) {
      const mondayBasedOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      return addDaysISO(rotationContext.weekStartISO, mondayBasedOffset);
    }
    const offset = ((dayOfWeek - todayDow) + 7) % 7;
    return addDaysISO(todayISO, offset);
  }

  // The conditioning builder uses the shared generation projection to decide
  // whether a combined day needs an off-feet modality. Typed strengthPattern
  // wins; legacy focus text is handled by the same adapter fallback.
  function strengthRegionForPlanEntry(
    entry: SessionAllocation,
  ): 'lower' | 'upper' | 'full' | undefined {
    const region = classifyGenerationSession(entry).strengthRegion;
    if (region === 'full_body') return 'full';
    return region === 'lower' || region === 'upper' ? region : undefined;
  }

  function normalizeGeneratedWorkoutType(
    cw: { name: string; workoutType: string },
    planEntry: SessionAllocation | null,
  ): WorkoutType {
    const raw = String(cw.workoutType || '').trim().toLowerCase();
    const text = `${cw.name || ''} ${planEntry?.focus || ''}`.toLowerCase();

    // ── THE SCHEDULER'S TYPED DAY IDENTITY WINS, AND NOTHING BELOW RUNS ─────
    //
    // **Sam, 2026-08-15:** *"merge by typed day/component identity, never
    // names"* / *"no layer replaces an entire scheduler-authored day"*.
    //
    // Everything after this block is INFERENCE — a fixed precedence over loose
    // hints, kept for producers that do not carry an identity. Inference is what
    // renamed an authored strength-plus-conditioning day to "Conditioning" (the
    // flavour test sat above the pattern test) and turned the fixture into
    // "Rest" (nothing typed carried a game at all). **When the day's owner has
    // stated what the day IS, a reader that keeps guessing is the defect**, so
    // this returns and does not fall through. Shared with the synthesized-day
    // labeller, so the two readers cannot drift apart again.
    const authored = authoredWorkoutType(planEntry);
    if (authored) return authored;

    // The deterministic plan owns structure. Resolve typed anchors/components
    // before considering the edge-provided label so a Mixed session cannot be
    // downgraded to Conditioning merely because the model chose that enum.
    if (planEntry?.isTeamDay || raw === 'team' || raw === 'team training') {
      return 'Team Training';
    }
    if (planEntry?.speedWorkKind === 'true_speed' && !planEntry.strengthPattern) return 'Sprint-Intervals';
    if (planEntry?.tier === 'recovery') return 'Recovery';
    if (planEntry?.hasCombinedConditioning && planEntry.conditioningFlavour) return 'Mixed';
    if (planEntry?.conditioningFlavour && !planEntry.hasCombinedConditioning) return 'Conditioning';
    if (planEntry?.strengthPattern) return 'Strength';

    if (raw === 'strength') return 'Strength';
    if (raw === 'conditioning') return 'Conditioning';
    if (raw === 'recovery') return 'Recovery';
    if (raw === 'mixed') {
      if (planEntry?.hasCombinedConditioning) return 'Mixed';
      if (planEntry?.conditioningFlavour) return 'Conditioning';
      return 'Strength';
    }
    if (raw === 'game') return 'Game';

    // Older generate-mode schema incorrectly described workoutType as a tier.
    // Treat those values as sessionTier only and infer the app-level type.
    if (raw === 'core' || raw === 'optional') {
      if (planEntry?.speedWorkKind === 'true_speed' && !planEntry.strengthPattern) return 'Sprint-Intervals';
      if (planEntry?.conditioningFlavour && !planEntry.hasCombinedConditioning) {
        return 'Conditioning';
      }
      if (planEntry?.hasCombinedConditioning) {
        return 'Mixed';
      }
      if (/\b(recovery|mobility|flush|restore|reset)\b/.test(text)) {
        return 'Recovery';
      }
      if (/\b(conditioning|aerobic|tempo|sprint|interval|run|bike|row|ski)\b/.test(text)) {
        return 'Conditioning';
      }
      return 'Strength';
    }

    if (/\b(recovery|mobility|flush|restore|reset)\b/.test(text)) return 'Recovery';
    if (/\b(conditioning|aerobic|tempo|sprint|interval|run|bike|row|ski)\b/.test(text)) {
      return 'Conditioning';
    }
    return 'Strength';
  }

  // ── Team-day name enforcement ──
  // Guarantees that any day marked isTeamDay in the engine plan has its
  // workout.name lead with "Team Training" — independent of what the AI
  // generator produced. Handles three upstream patterns:
  //   1. Name already starts with "Team Training" → leave as-is
  //   2. Name ends with "... + Team Training" (old AI convention) →
  //      swap to "Team Training + ..."
  //   3. Name is pure gym/accessory/recovery label (e.g. "Upper Pull",
  //      "Recovery Session") → prefix "Team Training + "
  //   4. Empty/missing → default to "Team Training"
  // This is the last line of defence; the AI prompt now emits the correct
  // order, but we must not rely on model adherence for a label Sam
  // considers non-negotiable.
  // Deprecated: delegated to resolveSessionDisplayName (the single naming
  // source of truth). Kept only for backward-compatible call sites that
  // don't have access to the engine's SessionAllocation. New code should
  // call resolveSessionDisplayName directly with the planEntry.
  function enforceTeamDayName(
    name: string | undefined,
    isTeamDay: boolean | undefined,
    focus?: string,
    strengthPattern?: SessionAllocation['strengthPattern'],
  ): string {
    return resolveSessionDisplayName({
      name,
      focus,
      strengthPattern,
      isTeamDay,
    });
  }

  // ──────────────────────────────────────────────────────────────────────
  // RUN-LOAD GUARD — pre-resolve conditioning templates for the week so
  // we never program 3 consecutive days of running exposure.
  //
  // "Run exposure" = any day that hammers ground-contact running:
  //   • A day whose conditioning candidate is a running template (MAS,
  //     tempo intervals, long runs, etc.); OR
  //   • A TEAM TRAINING day (sprints + skills + contact = pure run load,
  //     even if no formal conditioning block is programmed on that day).
  //
  // We walk the week in day-of-week order tracking `runStreak` across both
  // species. When a day would be the 3rd-in-a-row run exposure AND it
  // carries a running conditioning candidate, we convert that candidate
  // to off-feet (bike / row / SkiErg). Pure speed/sprint templates
  // (Flying Sprints, Free Sprint Session, Max Effort Sprint Accumulation)
  // are NEVER converted — running IS the goal there.
  //
  // Team days that are themselves the 3rd run exposure can't be converted
  // (field session is the whole point); we let them stand but refuse to
  // add a running conditioning block on top — the cond-day enforcement
  // downstream prevents that, and the engine's H-PRE-12 already caps the
  // broader field-load streak so a 3-team-day-in-a-row scenario wouldn't
  // slip through.
  //
  // Output: a map dayOfWeek → resolved conditioning, used by the workout
  // builder below instead of re-resolving the template per-day.
  // ──────────────────────────────────────────────────────────────────────
  type ConditioningResolution = {
    exerciseName: string;
    exercises: WorkoutExercise[];
    shiftedFromRun: boolean;
  };
  const conditioningByDow = new Map<number, ConditioningResolution>();

  // 1. First pass: pick the candidate template name for every day that has
  //    conditioning, in day-of-week order, applying the run-load guard.
  //
  // Also maintain a weekly set of erg modalities already used. When a
  // session would use an erg (combined vo2/glyco, lower-paired sprint,
  // off-feet conversion, or aerobic default), prefer an UNUSED modality
  // from the pool so the athlete doesn't end up on the bike twice in
  // one week unless we've exhausted options.
  const sortedCw = [...completedCoachWorkouts].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  const usedErgs = new Set<ErgModality>();
  let lastErg: ErgModality | undefined; // last erg used on the immediately-preceding day
  let lastErgDow = -2;
  let runStreak = 0;
  let prevDow = -2;
  for (const cw of sortedCw) {
    const planEntry = resolveGeneratedPlanEntry(cw, planIdentityLookup, planLookup);
    const isTeamDay = !!planEntry?.isTeamDay;
    const isConsecutiveFromPrev = cw.dayOfWeek - prevDow === 1;

    // Non-conditioning day: still update the run streak if it's a team
    // day (team training = running exposure). Pure rest / strength / recovery
    // days break the streak.
    if (!planEntry?.conditioningFlavour) {
      if (isTeamDay) {
        runStreak = isConsecutiveFromPrev ? runStreak + 1 : 1;
      } else {
        runStreak = 0;
      }
      prevDow = cw.dayOfWeek;
      continue;
    }
    const dateStr = syntheticDateStr(cw.dayOfWeek);
    const isCombined = !!planEntry.hasCombinedConditioning;
    const attachedConditioningKind = isCombined
      ? planEntry.attachedConditioningKind ?? 'finisher'
      : undefined;
    const selectionRole: ConditioningRole = isCombined
      ? (attachedConditioningKind === 'component' ? 'component' : 'finisher')
      : 'standalone';
    // Infer the strength region being paired on combined days so selection
    // can shift to an ergometer when pairing a lower-body lift with sprint
    // or glycolytic work. "Lower body" / "hip-dominant" / "squat" / "hinge"
    // / "leg" all count as lower.
    const strengthRegion: 'lower' | 'upper' | 'full' | undefined =
      !isCombined ? undefined
      : strengthRegionForPlanEntry(planEntry);
    const selectionCategory: AthleteConditioningCategory =
      demandCategoryFor(
        (planEntry.conditioningCategory as AthleteConditioningCategory | undefined)
          ?? flavourToCategory(planEntry.conditioningFlavour),
        planEntry.section18ConditioningRole,
      )!;
    // Selection over the signed conditioning catalogue (Stage B switchover). The
    // planner's category (or legacy flavour) names the demand; the engine's
    // off-feet ruling (typed field) and the standing combined-day policy are
    // selection CONSTRAINTS now, not hardcoded names. The policy is the old
    // path's, unchanged: combined non-sprint conditioning renders off-feet
    // (the lift owns the legs); combined sprint goes off-feet only when
    // paired with a lower-body lift.
    const legSparingOffFeet = isCombined && combinedConditioningMustBeOffFeet({
      category: selectionCategory,
      strengthRegion,
      hasAvailableMachine: availableMachines.length > 0,
      seasonPhase: onboardingData?.seasonPhase,
    });
    // R-339: "running" on an upper day means running, not "running allowed".
    // Outside In-season an upper day's attached hard/tempo/aerobic work is a
    // run unless the athlete's own answer, an injury or the running-load guard
    // below says otherwise. Flush and COD keep their own rules.
    const runOnUpperDay = isCombined
      && strengthRegion === 'upper'
      && !legSparingOffFeet
      && planEntry.conditioningOffFeet !== true
      && selectionCategory !== 'recovery_flush'
      && onboardingData?.seasonPhase !== 'In-season';
    const selectedTemplate = selectConditioningTemplate({
      category: selectionCategory,
      preferredTemplateName: planEntry.conditioningVariant,
      dateStr,
      miniCycleNumber: rotationContext?.miniCycleNumber,
      offFeet: planEntry.conditioningOffFeet === true || legSparingOffFeet || undefined,
      runOnly: runOnUpperDay || undefined,
      availableMachines,
      role: selectionRole,
      // THE GATE THAT WAS DEAD TWICE, AND THEN READ THE WRONG THING.
      // `availability_gate_no_team_training` sits on the combined COD session.
      // The old templates were authored with NO caller passing the flag, so the filter could
      // never open. It was then wired to
      // `onboardingData.teamTrainingDays.length === 0` — the athlete's STANDING
      // PROFILE, not a fact about THIS WEEK. A club athlete's list is non-empty
      // all year, so the gate stayed shut in December for exactly the athlete
      // Sam's ruling is written for (item 31, measured).
      //
      // NOW IT ASKS THE ONE RULE (Sam, 2026-08-13): no team training this week
      // AND not in season AND past off-season's first four weeks. The week fact
      // is the PLAN's team days — `weeklyPlan` is what this week actually
      // contains — so a dated fact that clears team training (the away span
      // today, the Christmas span when it exists) opens the gate by itself,
      // which is why the Christmas break needs no case of its own.
      noTeamTrainingWeek: codDecelPermitted({
        weekHasTeamTraining: (weeklyPlan ?? []).some((entry) => entry.isTeamDay === true),
        seasonPhase: onboardingData?.seasonPhase,
        offseasonSubphase: offseasonSubphase ?? null,
      }),
    });
    const candidateName = selectedTemplate.name;

    // ── Assign feel (density/psychological character) per session ──
    // Deterministic per date + category so sessions feel distinct but
    // stay reproducible. Categories without meaningful feel variation
    // (pure speed micro-doses) fall back to undefined.
    const cat = planEntry.conditioningCategory;
    const engineFeel: ConditioningFeel | undefined = planEntry.conditioningFeel as ConditioningFeel | undefined;
    const feel: ConditioningFeel | undefined =
      engineFeel ? engineFeel
      : (cat === 'aerobic_base' || cat === 'tempo' || cat === 'vo2' || cat === 'glycolytic' || cat === 'sprint')
        ? (['grindy', 'sharp', 'flowing'] as const)[conditioningDateHash(`${dateStr}-${cat}`) % 3]
        : undefined;

    // ── Pick erg modality with weekly repeat-avoidance ──
    // Session will use an erg if: combined vo2/glyco/aerobic (always erg),
    // combined sprint on lower pairing (erg), or (later) off-feet swap.
    // We pre-pick here so the weekly-tracker sees each session exactly once.
    // R-339: a machine only where the policy above says off-feet. An upper
    // day in Off-season or Pre-season runs its attached work.
    const willUseErgCombined =
      isCombined && !runOnUpperDay && (
        cat === 'vo2' || cat === 'glycolytic'
        || cat === 'aerobic_base'
        || cat === 'tempo' // 4B: combined tempo finishers are erg-based
        || (cat === 'sprint' && strengthRegion === 'lower')
      );
    // Standalone aerobic_base uses the same deterministic weighted erg
    // default as combined zone-2 work. Explicit/off-feet decisions remain
    // authoritative, and weekly repeat avoidance only affects fallback.
    // R-339: a standalone easy-aerobic day runs in Off-season and Pre-season
    // ("half or more of off-season conditioning on legs"); in-season extras and
    // explicit off-feet answers stay on the machines.
    const willUseErgStandaloneAero =
      !isCombined && cat === 'aerobic_base' &&
      (planEntry.conditioningOffFeet === true
        || (onboardingData?.seasonPhase === 'In-season' && usedErgs.size < 3));
    let ergHint: ErgModality | undefined;
    const generatedModality = (cw.exercises ?? [])
      .map((exercise, index) => classifyGeneratedWorkoutRow({
        name: exercise.name,
        sets: exercise.sets,
        repsMax: exercise.repsMax,
        index,
      }))
      .find((classification) => classification.kind === 'conditioning')
      ?.conditioningModality;
    const generatedErg = generatedModality === 'bike' || generatedModality === 'row' ||
      generatedModality === 'ski' || generatedModality === 'mixed'
      ? generatedModality
      : undefined;
    const explicitErg = (planEntry.ergModality as ErgModality | undefined) ?? generatedErg;
    if (explicitErg && (willUseErgCombined || (!isCombined && cat === 'aerobic_base'))) {
      // Typed engine/athlete choice always wins over default weighting and
      // weekly variety. This was previously overwritten on combined days.
      ergHint = explicitErg;
      usedErgs.add(ergHint);
    } else if (willUseErgCombined) {
      const weightedAerobicDefault = selectDefaultAerobicErgModalityFromHash(
        conditioningDateHash(dateStr),
      );
      const weightedAerobicFallbacks: Record<Exclude<ErgModality, 'bike_erg'>, ErgModality[]> = {
        bike: ['bike', 'mixed', 'row', 'ski'],
        mixed: ['mixed', 'bike', 'row', 'ski'],
        row: ['row', 'bike', 'mixed', 'ski'],
        ski: ['ski', 'mixed', 'bike', 'row'],
      };
      const pool: ErgModality[] = cat === 'aerobic_base'
        ? weightedAerobicFallbacks[weightedAerobicDefault]
        : (strengthRegion === 'lower' && (cat === 'sprint' || cat === 'glycolytic'))
          ? ['ski', 'row', 'bike', 'mixed']
          : ['bike', 'row', 'ski', 'mixed'];
      // Preference order:
      //   1. Unused this week AND not yesterday's erg (best — fresh modality
      //      with no day-adjacent repeat).
      //   2. Unused this week, even if it was yesterday's erg (rare — pool
      //      size 4 usually gives us option 1).
      //   3. Not yesterday's erg, accepting a weekly repeat (we'd rather
      //      repeat Wed's bike on Fri than use yesterday's bike again).
      //   4. Pool fallback — no alternatives remain.
      const isConsecutiveDayErg = cw.dayOfWeek === lastErgDow + 1;
      ergHint =
        pool.find(m => !usedErgs.has(m) && m !== (isConsecutiveDayErg ? lastErg : undefined))
        ?? pool.find(m => !usedErgs.has(m))
        ?? pool.find(m => m !== (isConsecutiveDayErg ? lastErg : undefined))
        ?? pool[0];
      usedErgs.add(ergHint);
    } else if (willUseErgStandaloneAero) {
      const weightedDefault = selectDefaultAerobicErgModalityFromHash(
        conditioningDateHash(dateStr),
      );
      const pool: ErgModality[] = weightedDefault === 'bike'
        ? ['bike', 'mixed', 'row', 'ski']
        : weightedDefault === 'mixed'
          ? ['mixed', 'bike', 'row', 'ski']
          : weightedDefault === 'row'
            ? ['row', 'bike', 'mixed', 'ski']
            : ['ski', 'mixed', 'bike', 'row'];
      ergHint = pool.find((modality) => !usedErgs.has(modality)) ?? pool[0];
      usedErgs.add(ergHint);
    }
    // Persist on plan entry so downstream code (and any diagnostic output)
    // sees the decisions made by this pass. Feel from the engine wins;
    // only fall back to hash-derived feel if the engine left it blank.
    if (ergHint) {
      planEntry.ergModality = ergHint;
      lastErg = ergHint;
      lastErgDow = cw.dayOfWeek;
    }
    if (!planEntry.conditioningFeel && feel) planEntry.conditioningFeel = feel;
    const templateErgModality = (ergHint ?? planEntry.ergModality) as ErgModality | undefined;
    const isConsecutive = cw.dayOfWeek - prevDow === 1;
    const candidateIsRun = isRunningBasedConditioning(candidateName);
    const forcedOffFeet =
      planEntry.conditioningOffFeet === true &&
      candidateIsRun &&
      templateErgModality !== undefined;
    const isProtectedSpeed = SPEED_SPRINT_TEMPLATES.has(candidateName);
    // A day counts as run-exposure if EITHER the conditioning candidate
    // is run-based OR the athlete has team training on the same day
    // (team = sprints + skills + contact = running).
    const dayIsRun = (candidateIsRun && !forcedOffFeet) || isTeamDay;

    // Update running streak of CONSECUTIVE run-exposure days.
    if (dayIsRun && isConsecutive) {
      runStreak += 1;
    } else if (dayIsRun) {
      runStreak = 1;
    } else {
      runStreak = 0;
    }

    let resolved: ConditioningResolution;
    // Rule: Hard cap of 2 consecutive running days.
    // When we hit a 3rd field-load day whose conditioning candidate is
    // running, it MUST be converted off-feet. (Team days themselves
    // can't be converted — that's handled by the engine's H-PRE-12.)
    if (candidateIsRun && runStreak >= 3 && !isProtectedSpeed) {
      // 3rd (or later) consecutive run — convert to off-feet: an authored
      // template of the SAME quality that renders on a machine.
      const offFeetTemplate = isCombined ? null : offFeetAlternative(candidateName, dateStr, availableMachines);
      const offFeet = isCombined
        ? buildConditioningTemplate(candidateName, dateStr, {
            combined: true,
            attachedConditioningKind,
            strengthRegion,
            feel,
            ergModality: templateErgModality,
            variant: planEntry.conditioningVariant as ConditioningVariant | undefined,
            weekInBlock: rotationContext?.weekInBlock,
          })
        : offFeetTemplate
          ? composeConditioningRows(offFeetTemplate, dateStr, { weekInBlock: rotationContext?.weekInBlock })
          : null;
      if (offFeet && offFeet.length > 0) {
        const tagged = tagAsShiftedFromRun(offFeet);
        resolved = {
          exerciseName: candidateName, // keep original name for flavour mapping
          exercises: tagged,
          shiftedFromRun: true,
        };
        // After conversion the cond block is off-feet. If the day is ALSO
        // a team day, it still carries a running stimulus via the field
        // session — keep the streak at its current value so the following
        // day's enforcement remains correct. Otherwise the day no longer
        // counts as run exposure — reset so a 4th day can be run again.
        if (!isTeamDay) runStreak = 0;
      } else {
        // Couldn't convert (shouldn't happen for normal templates) — accept
        // the run but log it.
        resolved = {
          exerciseName: candidateName,
          exercises: buildConditioningTemplate(candidateName, dateStr, {
            combined: isCombined,
            attachedConditioningKind,
            strengthRegion,
            feel,
            ergModality: templateErgModality,
            variant: planEntry.conditioningVariant as ConditioningVariant | undefined,
            weekInBlock: rotationContext?.weekInBlock,
          }),
          shiftedFromRun: false,
        };
        logger.warn(
          `[RunLoadGuard] day=${cw.dayOfWeek} 3rd consecutive run "${candidateName}" — no off-feet conversion available`,
        );
      }
      logger.debug(
        `[RunLoadGuard] day=${cw.dayOfWeek} converted "${candidateName}" to off-feet (3rd consecutive run-exposure day)`,
      );
    } else {
      resolved = {
        exerciseName: candidateName,
        exercises: buildConditioningTemplate(candidateName, dateStr, {
          combined: isCombined,
          attachedConditioningKind,
          strengthRegion,
          feel,
          ergModality: templateErgModality,
          variant: planEntry.conditioningVariant as ConditioningVariant | undefined,
          weekInBlock: rotationContext?.weekInBlock,
        }),
        shiftedFromRun: forcedOffFeet,
      };
    }

    conditioningByDow.set(cw.dayOfWeek, resolved);
    prevDow = cw.dayOfWeek;
  }

  const acceptedWorkouts = completedCoachWorkouts.map((cw) => {
    const workoutId = `w-coach-${cw.dayOfWeek}`;
    const planEntry = resolveGeneratedPlanEntry(cw, planIdentityLookup, planLookup);
    const aiTier = (cw.sessionTier as SessionTier) || undefined;
    let canonicalTier: SessionTier | undefined;
    let canonicalIntensity: 'Light' | 'Moderate' | 'High' = 'Moderate';

    if (planEntry) {
      canonicalTier = planEntry.tier;
      canonicalIntensity = planEntry.isHardExposure
        ? 'High'
        : planEntry.tier === 'core' ? 'Moderate' : 'Light';

      if (aiTier && aiTier !== canonicalTier) {
        logger.warn(
          `[ProgramGen] AI tier drift: day ${cw.dayOfWeek} (${cw.name}) ` +
          `AI="${aiTier}" vs engine="${canonicalTier}" — using engine tier`
        );
      }
    } else {
      canonicalTier = aiTier;
    }

    if (deloadPolicyForDayOfWeek(cw.dayOfWeek) && canonicalIntensity === 'High') {
      canonicalIntensity = 'Moderate';
    }

    // ──────────────────────────────────────────────────────────────────────
    // STANDALONE CONDITIONING / TRUE SPEED - deterministic, AI exercises ignored
    // ──────────────────────────────────────────────────────────────────────
    // ⚠ **THIS BRANCH BUILDS A WHOLE DAY BY ITSELF** — it constructs the Workout
    // inline and never reaches `normalizeGeneratedWorkoutType`, so the typed
    // identity resolved there cannot save a day that gets in here. **Sam,
    // 2026-08-15: *"no layer replaces an entire scheduler-authored day"*.**
    //
    // Entry was decided by inference — "has a conditioning flavour and is not
    // flagged combined" — which is true of an authored strength day that also
    // carries conditioning. Measured: the scheduler authored Monday as
    // strength + conditioning and it arrived at the athlete as a standalone
    // "Conditioning" day, its lifts gone. A day whose OWNER says it holds a
    // strength component is a combined day, and this branch may not claim it.
    const authoredComponents = planEntry?.authoredDay?.components;
    const authoredHasStrength = authoredComponents?.includes('strength') === true;
    const isStandaloneSpeed = planEntry?.speedWorkKind === 'true_speed'
      && !planEntry.strengthPattern && !authoredHasStrength;
    const isStandaloneConditioning = planEntry
      && planEntry.conditioningFlavour
      && !planEntry.hasCombinedConditioning
      && !authoredHasStrength;

    if (isStandaloneConditioning || isStandaloneSpeed) {
      const resolved = conditioningByDow.get(cw.dayOfWeek);
      const dateStr = syntheticDateStr(cw.dayOfWeek);
      const standaloneCategory: AthleteConditioningCategory | undefined = isStandaloneSpeed
        ? undefined
        : demandCategoryFor(
            (planEntry.conditioningCategory as AthleteConditioningCategory | undefined)
              ?? flavourToCategory(planEntry.conditioningFlavour!),
            planEntry.section18ConditioningRole,
          );
      const exerciseName = isStandaloneSpeed
        ? (planEntry.speedBlock?.templateName ?? SPEED_FALLBACK_TEMPLATE)
        : resolved?.exerciseName
        ?? selectConditioningTemplate({
          category: standaloneCategory!,
          dateStr,
          miniCycleNumber: rotationContext?.miniCycleNumber,
          offFeet: planEntry.conditioningOffFeet === true || undefined,
          availableMachines,
        }).name;
      let condExercises = isStandaloneSpeed
        ? composeSpeedRows(planEntry.speedBlock?.templateName, dateStr)
        : resolved?.exercises
        ?? buildConditioningTemplate(exerciseName, dateStr, {
          feel: planEntry.conditioningFeel as ConditioningFeel | undefined,
          ergModality: planEntry.ergModality as ErgModality | undefined,
          variant: planEntry.conditioningVariant as ConditioningVariant | undefined,
          weekInBlock: rotationContext?.weekInBlock,
        });
      // Stamp workoutId on all exercises
      for (const ex of condExercises) {
        ex.workoutId = workoutId;
      }
      const standaloneDeloadPolicy = deloadPolicyForDayOfWeek(cw.dayOfWeek);
      if (standaloneDeloadPolicy) {
        condExercises = applyConditioningDeloadToExercises(
          condExercises,
          standaloneDeloadPolicy,
          planEntry.deloadConditioningRole,
          isStandaloneSpeed ? 'speed' : 'conditioning',
        );
      }

      // If the run-load guard shifted this session, reflect that in the
      // workout name + workoutType so the downstream UI doesn't read as
      // a run when the prescription is bike/row/ski.
      const isReducedAerobicBase =
        planEntry.conditioningVariant === 'reduced' && planEntry.conditioningCategory === 'aerobic_base';
      const headlineExerciseName = condExercises.find((ex) => {
        const n = (ex.exercise?.name || '').toLowerCase();
        return !n.includes('warm-up') && !n.includes('cool-down') && !n.includes('cooldown');
      })?.exercise?.name;
      const displayName = resolved?.shiftedFromRun || isReducedAerobicBase
        ? (headlineExerciseName || exerciseName)
        : isStandaloneSpeed
          ? (planEntry.speedBlock?.title ?? SPEED_FALLBACK_TEMPLATE)
          : exerciseName;
      const condWorkoutType = isStandaloneSpeed
        ? 'Sprint-Intervals'
        : resolved?.shiftedFromRun
        || isReducedAerobicBase
        ? 'Conditioning'
        : workoutTypeForCategory(standaloneCategory ?? null, planEntry.tier === 'recovery' ? 'C' : undefined);
      const speedBlock = isStandaloneSpeed
        ? buildSpeedBlock(planEntry, condExercises)
        : undefined;

      logger.debug(`[BUILDER-TRACE] day=${cw.dayOfWeek} ${isStandaloneSpeed ? 'STANDALONE SPEED' : 'STANDALONE CONDITIONING'} - flavour="${planEntry.conditioningFlavour}" -> template="${exerciseName}"${resolved?.shiftedFromRun ? ' [SHIFTED off-feet]' : ''} (AI exercises IGNORED: ${cw.exercises.length} discarded)`);

      const standaloneWorkout: Workout = {
        id: workoutId,
        microcycleId,
        dayOfWeek: cw.dayOfWeek,
        name: resolveSessionDisplayName({
          name: displayName,
          focus: planEntry?.focus,
          strengthPattern: planEntry?.strengthPattern,
          strengthIntent: planEntry?.strengthIntent,
          isTeamDay: planEntry?.isTeamDay,
          conditioningFlavour: planEntry?.conditioningFlavour,
          hasCombinedConditioning: planEntry?.hasCombinedConditioning,
          tier: planEntry?.tier,
        }),
        description: '',
        intensity: canonicalIntensity,
        workoutType: condWorkoutType as any,
        sessionTier: canonicalTier,
        ...(planEntry.planEntryId ? { planEntryId: planEntry.planEntryId } : {}),
        ...(!isStandaloneSpeed ? { conditioningFlavour: planEntry.conditioningFlavour } : {}),
        // The same modality owner as combined work; a later title classifier
        // cannot recover which available machine the specialist selected.
        ...(!isStandaloneSpeed ? { conditioningBlock: buildConditioningBlock(
          planEntry.conditioningFlavour!, condExercises, undefined,
          resolvedBlockModality(exerciseName, planEntry.ergModality as ErgModality | undefined, availableMachines),
          availableMachines,
          exerciseName,
        ) } : {}),
        // 4B: carry the energy-system category onto conditioning workouts
        // so the rules kernel classifies from the typed field. True speed
        // uses speedBlock instead, so it never looks like conditioning.
        ...(!isStandaloneSpeed && planEntry.conditioningCategory
          ? { conditioningCategory: planEntry.conditioningCategory }
          : {}),
        ...(!isStandaloneSpeed && planEntry.section18ConditioningRole
          ? { section18ConditioningRole: planEntry.section18ConditioningRole }
          : {}),
        ...(planEntry.conditioningFeasibility
          ? { conditioningFeasibility: planEntry.conditioningFeasibility }
          : {}),
        ...(speedBlock ? { speedBlock } : {}),
        durationMinutes: 0,
        exercises: condExercises,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Workout;
      const finalWorkout = applyResolvedConditioningSubstitution(
        finaliseBuiltWorkout(standaloneWorkout, planEntry),
      );
      return attachSessionEffectEvidence(
        finalWorkout,
        planEntry.deterministicCoachNoteEffects,
      );
    }

    // ──────────────────────────────────────────────────────────────────────
    // COMPOSED OPTIONAL — the pools generate the exercises, not the AI
    // ──────────────────────────────────────────────────────────────────────
    //
    // Sam's class ruling, 2026-07-30: REAL COMPOSED SESSIONS ONLY. Where the plan
    // says `composedOptionalKind`, the day's content comes from the signed pools
    // through the SAME builder the athlete's own doors use — so the generator and
    // the doors cannot prescribe different work under one name.
    //
    // AI CONTENT IS DISCARDED HERE, deliberately and exactly as it is for
    // standalone conditioning above. That branch has ignored the model's exercises
    // since the conditioning templates were signed, for the same reason: when the
    // composition is authored, a model's suggestion is not an input.
    // The marker has to still be COHERENT with the rest of the entry, exactly as
    // `isStandaloneConditioning` above requires a flavour AND no combined block. A
    // repair can promote an optional accessory day to required strength or hang
    // conditioning on it; if it does, this is not an accessory day any more,
    // whatever it still says. `assignRequiredStrength` clears the marker at the
    // point of promotion — this is the second half of the same boundary, so a
    // future mutator that forgets cannot silently compose prehab over required work.
    const composedOptional = planEntry?.composedOptionalKind
      && !planEntry.strengthIntent
      && !planEntry.strengthPattern
      && !planEntry.conditioningFlavour
      && !planEntry.conditioningCategory
      && !planEntry.speedBlock
      ? planEntry.composedOptionalKind
      : null;
    if (composedOptional) {
      const composed = buildDerivedSession(
        // Three markers, three signed compositions. The binary ternary that
        // stood here would have built PREHAB for a primer marker — the R-130
        // audit's named trap.
        composedOptional === 'gunshow' ? 'arms_pump'
          : composedOptional === 'primer' ? 'primer'
            : 'prehab_accessories',
        syntheticDateStr(cw.dayOfWeek),
        microcycleId,
        planEntry.focus,
        {
          injuries: onboardingData?.injuries ?? [],
          equipmentTags: [...availableEquipment],
          daysToGame: rotationContext?.daysToGameByDay?.[cw.dayOfWeek],
          powerSelectionHistory: [
            ...(rotationContext?.powerSelectionHistory ?? []),
            ...(rotationContext?.powerSelectionsOut ?? []),
          ],
          powerSelectionsOut: rotationContext?.powerSelectionsOut,
          powerSelectionTracesOut: rotationContext?.selectionTracesOut,
          powerSelectionBlockStartISO: rotationContext?.powerSelectionBlockStartISO,
          automaticWeeklyExerciseSelector: rotationContext?.automaticWeeklyExerciseSelector,
          ...(onboardingData ? { onboardingData } : {}),
        },
      );
      logger.debug(
        `[BUILDER-TRACE] day=${cw.dayOfWeek} COMPOSED OPTIONAL `
        + `(${composedOptional}) — ${composed.exercises.length} pool rows, `
        + `AI exercises IGNORED: ${cw.exercises.length} discarded`,
      );
      const composedWorkout = finaliseBuiltWorkout({
        ...composed,
        id: workoutId,
        microcycleId,
        dayOfWeek: cw.dayOfWeek,
        sessionTier: canonicalTier,
        ...(planEntry.planEntryId ? { planEntryId: planEntry.planEntryId } : {}),
        exercises: composed.exercises.map((row, index) => ({
          ...row,
          id: `we-${workoutId}-${index}`,
          workoutId,
        })),
      } as Workout, planEntry);
      return attachSessionEffectEvidence(
        composedWorkout,
        planEntry.deterministicCoachNoteEffects,
      );
    }

    // ──────────────────────────────────────────────────────────────────────
    // STRENGTH (or non-conditioning) — AI generates exercises
    // ──────────────────────────────────────────────────────────────────────
    // Per-session pool usage tracker. Prevents two AI-suggested exercises
    // in the same (slot, role) from collapsing to the same rotation pick.
    const poolUsage = rotationContext
      ? new Map<string, Set<string>>()
      : undefined;

    const filteredAiExercises = (cw.exercises ?? []).filter((ex) =>
      !isTeamTrainingItem({
        name: ex.name,
        exerciseName: ex.name,
        workoutType: (ex as any).workoutType,
      }),
    );
    const classifiedRows = filteredAiExercises.map((exercise, index) => ({
      exercise,
      classification: classifyGeneratedWorkoutRow({
        name: exercise.name,
        sets: exercise.sets,
        repsMax: exercise.repsMax,
        index,
      }),
    }));
    // ⚠ A COMPOSED DAY IS NEVER REPLACED BY THE FALLBACK TEMPLATE (clause f).
    // This guard exists for an AI payload that arrived without the strength work
    // the plan asked for. A composed day's content IS the plan's answer, built
    // slot by slot under one legality owner — and measured 2026-08-14, letting
    // this fire on one put the template's `Overhead Press` and `Pull-Ups` back
    // in front of a bodyweight athlete, which is the exact defect R-083 removes.
    const requiresStrengthContent =
      !cw.composed &&
      edgeProvidedDays.has(cw.dayOfWeek) &&
      !!planEntry?.strengthPattern &&
      !/\b(gunshow|prehab|pump|accessor|low-fatigue)\b/i.test(`${cw.name} ${planEntry?.focus ?? ''}`);
    // Preserve any plausible strength/support row from the edge. Fall back
    // only for an empty shell or a payload made entirely of conditioning
    // rows; the normaliser must not discard unusual but valid strength work.
    const aiHasStrengthContent = classifiedRows.some(({ classification }) =>
      classification.kind === 'strength_main' || classification.kind === 'strength_accessory');
    const fallbackStrengthExercises = requiresStrengthContent && !aiHasStrengthContent
      ? fallbackExercisesForPlanEntry(planEntry!)
      : [];
    const sourceAiExercises: CoachGeneratedWorkoutInput['exercises'] = fallbackStrengthExercises.length > 0
      ? fallbackStrengthExercises
      : filteredAiExercises;

    if (fallbackStrengthExercises.length > 0) {
      logger.warn('[ProgramGen] Edge workout lacked strength content required by deterministic plan; using safe plan fallback', {
        dayOfWeek: cw.dayOfWeek,
        workoutName: cw.name,
        strengthPattern: planEntry?.strengthPattern,
        strengthIntent: planEntry?.strengthIntent,
        receivedExercises: filteredAiExercises.map((exercise) => exercise.name),
      });
    }

    // ── B1-PIVOT: GENERATION-TIME ROTATION IS DELETED ──────────────────────
    //
    // `applyPoolRotation` existed to rewrite names an AI or a hardcoded template
    // proposed. **Nothing proposes a strength name any more** — the composer
    // selects from the authorised pools under one legality owner, and rewriting
    // its choice here was one of the three post-composition mutations measured
    // on 2026-08-14 (`Bodyweight Squat` -> `Walking Lunges`). The function
    // itself REMAINS: `coachProgramEdit` and the athlete's own swap flow are
    // separate consumers and are untouched.
    const rotatedAiExercises = sourceAiExercises.map((ex) => ({ ex, resolvedName: ex.name }));

    const aiExercises: WorkoutExercise[] = rotatedAiExercises.map(({ ex, resolvedName }, index) => {
      // Cross-cycle variation happened above, in `rotatedAiExercises`.
      // Non-pool exercises (carry, core, isolation, anything untagged) pass
      // through unchanged.
      // THE AUTHORED G-2 EXCEPTION NAMES ITS OWN MOVEMENT. Rotation is the
      // cross-cycle VARIATION system for ordinary main lifts; here the movement
      // is the ruling — "box squats to HIGH BOX" is the low-range-of-motion half
      // of `lower_strength_g3`'s state 2, and rotating it to a Front or Back
      // Squat would put a full-range squat two days before a game while still
      // reading as the exception. BIBLE_ANCHOR: lower_strength_g3
      const exercise = findOrCreateExercise(resolvedName);
      return {
        id: `we-${workoutId}-${index}`,
        workoutId,
        exerciseId: exercise.id,
        exerciseOrder: index + 1,
        prescribedSets: ex.sets,
        prescribedRepsMin: ex.repsMin,
        prescribedRepsMax: ex.repsMax,
        prescribedWeightKg: ex.weight || 0,
        restSeconds: 0,
        notes: ex.notes,
        ...(ex.supersetGroup ? { supersetGroup: ex.supersetGroup } : {}),
        ...(ex.supersetOrder ? { supersetOrder: ex.supersetOrder } : {}),
        ...(ex.pairType ? { pairType: ex.pairType as any } : {}),
        // A COMPOSED ROW ARRIVES WITH ITS ROLE ALREADY DECIDED (R-092). Stamped
        // here so `withSection18WorkoutEvidence` finds a declaration instead of
        // a bare row to guess about.
        ...(ex.composedRole
          ? {
              section18Evidence: {
                protocolVersion: 1 as const,
                role: ex.composedRole,
                strengthPattern: ex.composedPattern ?? null,
                mainStrengthPattern: ex.composedRole === 'main_strength'
                  ? ex.composedPattern ?? null
                  : null,
                provenance: 'composer_declaration' as const,
              },
            }
          : {}),
        exercise,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });

    // Validate superset pairings (deterministic rules)
    const validatedExercises = validatePairings(aiExercises, canonicalTier);
    const phaseAwareExercises = applyPhaseRepSchemesToWorkoutExercises(validatedExercises, {
      seasonPhase: onboardingData?.seasonPhase,
      offseasonSubphase,
      workoutName: cw.name,
      workoutType: cw.workoutType,
      planEntry,
    });

    // Apply load estimates for exercises missing weights
    let finalExercises = onboardingData
      ? applyLoadEstimates(phaseAwareExercises, onboardingData)
      : phaseAwareExercises;
    finalExercises = applySubphaseMainLiftLoadMultiplier(finalExercises, {
      seasonPhase: onboardingData?.seasonPhase,
      offseasonSubphase,
      workoutName: cw.name,
      workoutType: cw.workoutType,
      planEntry,
    });
    let beginnerPrescriptionEvidence = null;
    if (onboardingData) {
      const beforeTrainingAge = finalExercises;
      finalExercises = applyTrainingAgePrescription(finalExercises, onboardingData, {
        seasonPhase: onboardingData.seasonPhase,
        offseasonSubphase,
        workoutName: cw.name,
        workoutType: cw.workoutType,
        planEntry,
      });
      if (resolveTrainingAgePolicy(onboardingData.experienceLevel).level === 'new') {
        beginnerPrescriptionEvidence = buildPrescriptionEffectEvidence({
          seed: {
            kind: 'beginner_policy',
            reason: 'beginner_conservative_prescription',
            ownerKey: `training-age:${cw.dayOfWeek}`,
          },
          before: beforeTrainingAge,
          after: finalExercises,
        });
      }
    }

    // Resolved conditioning block — assembled below for combined S+C days.
    let resolvedConditioningBlock: ConditioningBlock | undefined;
    const normalizedWorkoutType = normalizeGeneratedWorkoutType(cw, planEntry);

    // ──────────────────────────────────────────────────────────────────────
    // COMBINED S+C — AI strength + deterministic conditioning appended
    // ──────────────────────────────────────────────────────────────────────
    if (planEntry?.hasCombinedConditioning && planEntry.conditioningFlavour) {
      // Deterministic plan conditioning replaces edge-authored conditioning.
      // Classification is shared with the final post-mutation path; location
      // inside the raw exercise array is irrelevant.
      const rawStrengthBlock = finalExercises.filter((exercise, index) =>
        classifyGeneratedWorkoutRow({
          name: exercise.exercise?.name ?? '',
          sets: exercise.prescribedSets,
          repsMax: exercise.prescribedRepsMax,
          index,
        }).kind !== 'conditioning');
      const dayDeloadPolicy = deloadPolicyForDayOfWeek(cw.dayOfWeek);
      const strengthBlock = dayDeloadPolicy
        ? applyStrengthDeloadToExercises(rawStrengthBlock, dayDeloadPolicy)
        : rawStrengthBlock;

      // Build deterministic conditioning block and append. The block was
      // pre-resolved above by the run-load guard; fall back to a fresh
      // build only if the guard did not produce a resolution for this day.
      const dateStr = syntheticDateStr(cw.dayOfWeek);
      const resolved = conditioningByDow.get(cw.dayOfWeek);
      const condExName = resolved?.exerciseName
        ?? selectConditioningTemplate({
          category: demandCategoryFor(
            (planEntry.conditioningCategory as AthleteConditioningCategory | undefined)
              ?? flavourToCategory(planEntry.conditioningFlavour),
            planEntry.section18ConditioningRole,
          )!,
          dateStr,
          miniCycleNumber: rotationContext?.miniCycleNumber,
          offFeet: planEntry.conditioningOffFeet === true || undefined,
          availableMachines,
          role: (planEntry.attachedConditioningKind ?? 'finisher') === 'component'
            ? 'component' : 'finisher',
        }).name;
      const condBlock = resolved?.exercises
        ?? buildConditioningTemplate(condExName, dateStr, {
          combined: true,
          attachedConditioningKind: planEntry.attachedConditioningKind ?? 'finisher',
          strengthRegion: strengthRegionForPlanEntry(planEntry),
          feel: planEntry.conditioningFeel as ConditioningFeel | undefined,
          ergModality: planEntry.ergModality as ErgModality | undefined,
          variant: planEntry.conditioningVariant as ConditioningVariant | undefined,
          weekInBlock: rotationContext?.weekInBlock,
        });

      // Re-number: strength exercises keep their order, conditioning appends after
      const maxOrder = strengthBlock.length;
      for (let i = 0; i < condBlock.length; i++) {
        condBlock[i].workoutId = workoutId;
        condBlock[i].exerciseOrder = maxOrder + i + 1;
      }

      // ⚠ **NO SPRINT COMPOSITION HERE.** WC-139's pre-lift sprint is composed
      // by the EXISTING pre-lift speed path further down this function
      // (`planEntry.speedWorkKind === 'true_speed' && speedPlacement ===
      // 'pre_lift'`), which already prepends the rows and builds the
      // `speedBlock` §18 reads. Composing it here as well gave the day TWO
      // sprint rows — `20 m Acceleration Reps` from that path and
      // `10 m Acceleration Reps` from this one.
      finalExercises = [...strengthBlock, ...condBlock];

      // Resolve the conditioning block once, here — single source of truth
      // for the renderer. Title/description/exerciseIds are populated together
      // so header and rows can't drift. Single-intent, no flush sub-block.
      resolvedConditioningBlock = buildConditioningBlock(
        planEntry.conditioningFlavour,
        condBlock,
        planEntry.attachedConditioningKind ?? 'finisher',
        resolvedBlockModality(
          condExName,
          planEntry.ergModality as ErgModality | undefined,
          availableMachines,
        ),
        availableMachines,
        condExName,
      );

      logger.debug(`[BUILDER-TRACE] day=${cw.dayOfWeek} COMBINED S+C — strength=${strengthBlock.length} exercises (AI) + conditioning="${condExName}"${resolved?.shiftedFromRun ? ' [SHIFTED off-feet]' : ''} (template, ${condBlock.length} exercises)`);
    } else {
      const dayStrengthDeload = deloadPolicyForDayOfWeek(cw.dayOfWeek);
      if (
        dayStrengthDeload &&
        normalizedWorkoutType !== 'Conditioning' &&
        normalizedWorkoutType !== 'Recovery' &&
        normalizedWorkoutType !== 'Game'
      ) {
        finalExercises = applyStrengthDeloadToExercises(finalExercises, dayStrengthDeload);
      }
      logger.debug(`[BUILDER-TRACE] day=${cw.dayOfWeek} aiName="${cw.name}" aiType="${cw.workoutType}" aiTier="${cw.sessionTier}" → canonicalTier="${canonicalTier}" intensity="${canonicalIntensity}" planEntry=${planEntry ? `"${planEntry.tier} / ${planEntry.focus?.substring(0, 40)}"` : 'NONE'}`);
    }

    // ── Conditioning half of the deload law (Sam, 2026-07-27) ──
    // "Conditioning: half the total work. One quality exposure max, the rest
    // easy aerobic." NEW LAW: a deload used to leave conditioning volume
    // untouched, and the strength branch above deliberately skips standalone
    // Conditioning days — so without this, the half never happened on exactly
    // the days that are mostly conditioning. Games are left alone: a game is
    // not ours to shrink.
    const dayConditioningDeload = deloadPolicyForDayOfWeek(cw.dayOfWeek);
    if (dayConditioningDeload && normalizedWorkoutType !== 'Game') {
      finalExercises = applyConditioningDeloadToExercises(
        finalExercises,
        dayConditioningDeload,
        planEntry?.deloadConditioningRole,
        isStandaloneSpeed ? 'speed' : 'conditioning',
      );
    }

    let resolvedSpeedBlock: SpeedBlock | undefined;
    if (planEntry?.speedWorkKind === 'true_speed' && planEntry.speedPlacement === 'pre_lift') {
      const dateStr = syntheticDateStr(cw.dayOfWeek);
      const authoredSpeedExercises = composeSpeedRows(planEntry.speedBlock?.templateName, dateStr);
      const speedDeloadPolicy = deloadPolicyForDayOfWeek(cw.dayOfWeek);
      const speedExercises = speedDeloadPolicy
        ? applyConditioningDeloadToExercises(
          authoredSpeedExercises,
          speedDeloadPolicy,
          planEntry.deloadConditioningRole,
          'speed',
        )
        : authoredSpeedExercises;
      for (let i = 0; i < speedExercises.length; i++) {
        speedExercises[i].workoutId = workoutId;
        speedExercises[i].exerciseOrder = i + 1;
      }
      finalExercises = finalExercises.map((exercise) => ({
        ...exercise,
        exerciseOrder: exercise.exerciseOrder + speedExercises.length,
      }));
      finalExercises = [...speedExercises, ...finalExercises];
      resolvedSpeedBlock = buildSpeedBlock(planEntry, speedExercises);
    }

    // ── Power primer (Bible § Power work) ──
    // Rendered as a distinct block, NOT interleaved into exercises.
    //
    // Power SURVIVES a deload (Sam's deload law, 2026-07-27): "keep a small
    // sharp dose — few reps, full recovery, stop the moment speed drops." This
    // used to skip power entirely on deload weeks, which the law supersedes —
    // a deload is not a reason to lose sharpness. The dose shrinks instead.
    let resolvedPowerRow: WorkoutExercise | undefined;
    if (planEntry?.powerPrimer) {
      const powerSpec = deloadPolicyForDayOfWeek(cw.dayOfWeek)
        ? (() => {
            const shrunk = deloadPowerDose({
              sets: planEntry.powerPrimer.sets,
              repsMin: planEntry.powerPrimer.repsMin,
              repsMax: planEntry.powerPrimer.repsMax,
            });
            // `reduced` is NOT set here. It means one thing on this spec — a
            // mild same-region niggle — and the pool reads it as a SLOT rule:
            // reduced + lower hands the slot to Pogo Hops. Reusing it to mean
            // "deloaded" would silently swap the athlete's movement on a
            // deload week, which no law authorises. The deload law's own words
            // are "same week, same days: the structure does not change, the
            // work shrinks" — so only the numbers move.
            return shrunk ? { ...planEntry.powerPrimer, ...shrunk } : null;
          })()
        : planEntry.powerPrimer;

      if (powerSpec) resolvedPowerRow = buildPowerRow(powerSpec, workoutId, {
        phase: onboardingData?.seasonPhase,
        experienceLevel: onboardingData?.experienceLevel,
        availableEquipment,
        // Mini-cycle = the 3-4 week block. Stable all block, rotates at rollover.
        blockId: `mini-${rotationContext?.miniCycleNumber ?? 1}`,
        automaticWeeklyExerciseSelector: rotationContext?.automaticWeeklyExerciseSelector,
      }) ?? undefined;
    }

    // Deterministic plan intent always wins. Edge-authored typed intent is
    // accepted only for legacy/no-plan callers; names/focus never reconstruct it.
    const canonicalStrengthIntent = planEntry?.strengthIntent ?? cw.strengthIntent;
    const builtWorkout: Workout = {
      id: workoutId,
      microcycleId,
      dayOfWeek: cw.dayOfWeek,
      name: resolveSessionDisplayName({
        name: cw.name,
        focus: planEntry?.focus,
        exercises: finalExercises,
        strengthPattern: planEntry?.strengthPattern,
        strengthIntent: canonicalStrengthIntent,
        isTeamDay: planEntry?.isTeamDay,
        conditioningFlavour: planEntry?.conditioningFlavour,
        hasCombinedConditioning: planEntry?.hasCombinedConditioning,
        tier: planEntry?.tier,
      }),
      description: '',
      intensity: canonicalIntensity,
      workoutType: normalizedWorkoutType,
      // The day's typed identity travels ONTO the workout, because the layer
      // that merges composer strength onto this day is downstream of here and
      // otherwise has nothing but names to go on. Reader: `assembleAuthoredWeek`.
      ...(planEntry?.authoredDay ? { authoredDay: planEntry.authoredDay } : {}),
      // ⚠ **THE ANCHOR FACT ITSELF WAS NEVER WRITTEN HERE.** `builtWorkout` set
      // neither `isTeamDay` nor anything equivalent — it passed the flag to the
      // NAME resolver and dropped it — so a club night reached §18 as a day with
      // no club training on it, and the credit those anchors supply went with
      // it. Measured on the anchor world: both club nights came out `undefined`.
      // Derived from the typed identity so the two cannot disagree.
      isTeamDay: planEntry?.authoredDay
        ? planEntry.authoredDay.anchor === 'club_training'
        : planEntry?.isTeamDay,
      // THE SCHEDULER'S OFF-LEG REQUEST, CARRIED. It types `off_leg` whenever
      // conditioning pairs with a lower session (WC-115), the specialist duly
      // resolved a bike — and the flag then reached the workout as `undefined`,
      // so nothing downstream could tell that this aerobic block is deliberately
      // off the legs rather than a run someone happened to pick. Measured on the
      // Sunday-fixture world: `modality=bike`, `conditioningOffFeet=undefined`.
      ...(planEntry?.conditioningOffFeet !== undefined
        ? { conditioningOffFeet: planEntry.conditioningOffFeet }
        : {}),
      sessionTier: canonicalTier,
      ...(planEntry?.planEntryId ? { planEntryId: planEntry.planEntryId } : {}),
      ...(canonicalStrengthIntent
        ? { strengthIntent: normalizeStrengthIntent(canonicalStrengthIntent) }
        : {}),
      ...(planEntry?.strengthPatternContributions?.length
        ? { strengthPatternContributions: [...planEntry.strengthPatternContributions] }
        : {}),
      // Ruling 4a (Sam, 2026-08-06): the dose variant rides onto the day so the
      // §18 power owners can see that this session's jump row is AUTHORED by the
      // G-2 prescription rather than chosen by the weekly primer selector.
      ...(planEntry?.strengthVariant && planEntry.strengthVariant !== 'standard'
        ? { strengthVariant: planEntry.strengthVariant }
        : {}),
      ...(planEntry?.hasCombinedConditioning ? { hasCombinedConditioning: true } : {}),
      ...(planEntry?.attachedConditioningKind ? { attachedConditioningKind: planEntry.attachedConditioningKind } : {}),
      ...(planEntry?.conditioningFlavour ? { conditioningFlavour: planEntry.conditioningFlavour } : {}),
      ...(planEntry?.conditioningCategory ? { conditioningCategory: planEntry.conditioningCategory } : {}),
      ...(planEntry?.section18ConditioningRole
        ? { section18ConditioningRole: planEntry.section18ConditioningRole }
        : {}),
      ...(planEntry?.conditioningFeasibility
        ? { conditioningFeasibility: planEntry.conditioningFeasibility }
        : {}),
      ...(resolvedConditioningBlock ? { conditioningBlock: resolvedConditioningBlock } : {}),
      ...(resolvedSpeedBlock ? { speedBlock: resolvedSpeedBlock } : {}),

      durationMinutes: 0,
      // Power leads the list. It is pre-lift work and D2's session order puts it
      // first; placing it here means the ROW ORDER already carries that fact, so
      // no renderer has to know power is special to show it in the right place.
      exercises: resolvedPowerRow ? [resolvedPowerRow, ...finalExercises] : finalExercises,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const finalWorkout = applyResolvedConditioningSubstitution(
      finaliseBuiltWorkout(builtWorkout, planEntry),
    );
    return attachPrescriptionEffectEvidence(
      attachSessionEffectEvidence(
        finalWorkout,
        planEntry?.deterministicCoachNoteEffects,
      ),
      beginnerPrescriptionEvidence,
    );
  });
  // Program acceptance: every strength card must carry a curated cue. A name
  // that does not resolve is a loud generation-contract violation, never a
  // silent cueless card (Sam ruling, L10 run 3). Scoped by typed kind — power /
  // conditioning / recovery rows are exempt.
  enforceCuratedCueContract(acceptedWorkouts, `buildWorkoutsFromCoach(${microcycleId})`);
  return acceptedWorkouts;
}

/**
 * Default user profile
 */
export const DEFAULT_PROFILE: UserProfile = {
  id: 'user-default',
  email: 'athlete@localfooty.app',
  displayName: 'Athlete',
  age: 25,
  position: 'inside_mid',
  experienceLevel: '2-5 years',
  hasBarbell: true,
  hasDumbbells: true,
  hasFullGym: true,
  daysPerWeek: 6,
  injuryHistory: [],
  primaryGoals: ['Build Strength', 'Improve Performance'],
  subscriptionStatus: 'active',
  onboardingCompleted: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
