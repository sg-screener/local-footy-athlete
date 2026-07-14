/**
 * Canonical final content owner for generated and mutated workouts.
 *
 * Producers may express intent in imperfect shapes. This finaliser owns the
 * persisted representation: row domains, typed conditioning, power safety,
 * deterministic strength-pattern intent, workout type and visible identity.
 */

import type {
  ConditioningBlock,
  OnboardingData,
  ReadinessLevel,
  SeasonPhase,
  WeekKind,
  Workout,
  WorkoutExercise,
  WorkoutType,
} from '../types/domain';
import {
  classifyGeneratedWorkoutRow,
  type GeneratedWorkoutRowClassification,
} from '../rules/generatedWorkoutRowClassification';
import {
  createStrengthIntent,
  inferStrengthArchetype,
  resolveLegacyStrengthIntent,
  resolveStrengthOwnershipBoundary,
  withEffectiveStrengthPatterns,
  type MainStrengthPattern,
  type StrengthIntent,
} from '../rules/strengthPatternContributions';
import type { OffseasonSubphase } from '../rules/offseasonSubphase';
import { alignPowerBlockToFinalWorkoutContent } from '../rules/powerBlockContentAlignment';
import { classifyVisibleSession } from '../rules/sessionClassificationAdapter';
import {
  withSection18WorkoutEvidence,
  type Section18EvidenceMode,
} from '../rules/section18WorkoutEvidence';
import { canonicalStrengthLabel } from './sessionNaming';
import { normalizeVisibleWorkoutIdentity } from './visibleWorkoutIdentity';
import { collapseWorkoutToRest, hasMeaningfulWorkoutContent } from './workoutContent';

export type WorkoutCanonicalisationAction = {
  kind:
    | 'row_removed'
    | 'row_promoted'
    | 'row_downgraded'
    | 'row_restored'
    | 'pairing_removed'
    | 'power_removed'
    | 'power_downgraded'
    | 'effective_pattern_removed'
    | 'plan_intent_cleared'
    | 'type_changed'
    | 'name_changed'
    | 'collapsed_to_rest';
  item?: string;
  reason: string;
};

export interface WorkoutCanonicalisationContext {
  date?: string;
  phase?: SeasonPhase | null;
  offseasonSubphase?: OffseasonSubphase | null;
  weekKind?: WeekKind | null;
  readiness?: ReadinessLevel;
  /** True when a real game/practice-match anchor exists in the relevant week. */
  hasGame?: boolean;
  /** Calendar offset from the nearest game (0=game, -1=G-1, +1=G+1). */
  gOffset?: number;
  profile?: OnboardingData | null;
  /** True only when planEntryId was matched to the actual allocated entry. */
  planIntentValid?: boolean;
  /** Original allocated workout, used to restore an edited-away main pattern. */
  referenceWorkout?: Workout | null;
  /** False for a final safety pass after constraints intentionally removed work. */
  restoreMissingPlanPatterns?: boolean;
  /** Legacy hydration preserves missing evidence as unknown; modern paths infer it canonically. */
  section18EvidenceMode?: Section18EvidenceMode;
}

export interface WorkoutCanonicalisationResult {
  workout: Workout;
  changed: boolean;
  actions: WorkoutCanonicalisationAction[];
}

type ClassifiedRow = {
  row: WorkoutExercise;
  index: number;
  classification: GeneratedWorkoutRowClassification;
  linkedConditioning: boolean;
};

const FALLBACK_PATTERN_EXERCISE: Record<MainStrengthPattern, string> = {
  squat: 'Back Squat',
  hinge: 'Romanian Deadlift',
  push: 'Overhead Press',
  pull: 'Pull-Ups',
};

function rowName(row: WorkoutExercise): string {
  return String(row.exercise?.name ?? row.exerciseId ?? '').trim();
}

function classifyRow(row: WorkoutExercise, index: number): GeneratedWorkoutRowClassification {
  return classifyGeneratedWorkoutRow({
    name: rowName(row),
    sets: row.prescribedSets,
    repsMax: row.prescribedRepsMax,
    index,
  });
}

function linkedConditioningIds(workout: Workout): Set<string> {
  return new Set(
    (workout.conditioningBlock?.options ?? []).flatMap((option) => option.exerciseIds ?? []),
  );
}

function withoutPairing(row: WorkoutExercise): WorkoutExercise {
  const { supersetGroup, supersetOrder, pairType, ...plain } = row;
  return plain as WorkoutExercise;
}

function conditioningIntent(
  workout: Workout,
  rows: readonly ClassifiedRow[],
  earlyOffseason: boolean,
): ConditioningBlock['intent'] {
  if (earlyOffseason) return 'aerobic';
  if (workout.conditioningBlock?.intent) return workout.conditioningBlock.intent;
  if (
    workout.conditioningCategory === 'vo2' ||
    workout.conditioningCategory === 'glycolytic' ||
    rows.some(({ classification }) => classification.hardConditioning)
  ) return 'high-intensity';
  if (
    workout.conditioningCategory === 'tempo' ||
    workout.conditioningFlavour === 'tempo' ||
    rows.some(({ row }) => /\btempo\b/i.test(rowName(row)))
  ) return 'tempo';
  return 'aerobic';
}

function durationFromRow(row: WorkoutExercise, fallback: number): number {
  const text = `${rowName(row)} ${row.notes ?? ''}`;
  const match = /\b(\d{1,2})\s*(?:min|minutes?)\b/i.exec(text);
  if (match) return Math.max(5, Math.min(60, Number(match[1])));
  if (row.prescriptionType === 'duration_minutes' && row.prescribedRepsMax > 1) {
    return Math.max(5, Math.min(60, row.prescribedRepsMax));
  }
  return fallback;
}

function withExerciseName(row: WorkoutExercise, name: string): WorkoutExercise {
  return {
    ...row,
    exerciseId: row.exercise?.id ?? row.exerciseId,
    exercise: row.exercise
      ? { ...row.exercise, name, description: name }
      : row.exercise,
  };
}

function canonicalEarlyAerobicRow(
  row: WorkoutExercise,
  classification: GeneratedWorkoutRowClassification,
): WorkoutExercise {
  const modality = classification.conditioningModality;
  if (modality === 'row' || modality === 'ski') {
    const label = modality === 'row' ? 'RowErg' : 'SkiErg';
    return {
      ...withoutPairing(withExerciseName(row, `Easy ${label} Aerobic Blocks`)),
      prescribedSets: 3,
      prescribedRepsMin: 8,
      prescribedRepsMax: 8,
      prescribedWeightKg: undefined,
      prescriptionType: 'duration_minutes',
      restSeconds: 120,
      notes: '3 x 8 min easy aerobic work. Take complete rest for 2 min between blocks.',
    };
  }

  const minutes = durationFromRow(row, 20);
  return {
    ...withoutPairing(withExerciseName(row, 'Easy Zone 2 Bike')),
    prescribedSets: 1,
    prescribedRepsMin: minutes,
    prescribedRepsMax: minutes,
    prescribedWeightKg: undefined,
    prescriptionType: 'duration_minutes',
    restSeconds: 0,
    notes: `${minutes} min easy Zone 2. Smooth and conversational.`,
  };
}

function canonicalConditioningRow(
  classified: ClassifiedRow,
  earlyOffseason: boolean,
  actions: WorkoutCanonicalisationAction[],
): WorkoutExercise {
  const original = classified.row;
  if (earlyOffseason && (
    classified.classification.hardConditioning ||
    classified.classification.conditioningModality === 'run' ||
    (/\bintervals?\b/i.test(rowName(original)) &&
      !/\b(?:easy|aerobic|zone\s*2|flush)\b/i.test(rowName(original)))
  )) {
    actions.push({
      kind: 'row_downgraded',
      item: rowName(original),
      reason: classified.classification.conditioningModality === 'run'
        ? 'early_offseason_no_running'
        : 'early_offseason_no_hard_conditioning',
    });
    return canonicalEarlyAerobicRow(original, classified.classification);
  }
  return {
    ...withoutPairing(original),
    prescribedWeightKg: undefined,
  };
}

function buildCanonicalConditioningBlock(args: {
  workout: Workout;
  rows: ClassifiedRow[];
  finalRows: WorkoutExercise[];
  earlyOffseason: boolean;
}): ConditioningBlock | undefined {
  if (args.rows.length === 0) {
    const finalIds = new Set(args.finalRows.map((row) => row.id));
    const options = (args.workout.conditioningBlock?.options ?? []).flatMap((option) => {
      // A component-only prescription legitimately has no linked exercise
      // rows. An option that named rows must lose references removed by a
      // safety/edit pass, and disappears when none remain.
      if ((option.exerciseIds ?? []).length === 0) return [option];
      const exerciseIds = option.exerciseIds.filter((id) => finalIds.has(id));
      return exerciseIds.length > 0 ? [{ ...option, exerciseIds }] : [];
    });
    return options.length > 0 && args.workout.conditioningBlock
      ? {
          ...args.workout.conditioningBlock,
          intent: args.earlyOffseason ? 'aerobic' : args.workout.conditioningBlock.intent,
          options,
        }
      : undefined;
  }
  const finalIds = new Set(args.finalRows.map((row) => row.id));
  const conditioningIds = args.rows.map(({ row }) => row.id).filter((id) => finalIds.has(id));
  if (conditioningIds.length === 0) return undefined;
  const existingOptions = args.workout.conditioningBlock?.options ?? [];
  const retainedOptions = existingOptions.flatMap((option) => {
    const exerciseIds = (option.exerciseIds ?? []).filter((id) => conditioningIds.includes(id));
    return exerciseIds.length > 0 ? [{ ...option, exerciseIds }] : [];
  });
  const isWarmupOrCooldown = (value: string): boolean =>
    /\b(?:warm[- ]?up|cool[- ]?down|cooldown)\b/i.test(value);
  const existingHeadline = retainedOptions[0]?.title?.trim();
  const mainWorkRow = args.finalRows.find((row) =>
    conditioningIds.includes(row.id) && !isWarmupOrCooldown(rowName(row)));
  const intent = conditioningIntent(args.workout, args.rows, args.earlyOffseason);
  const modalities = Array.from(new Set(args.rows
    .map(({ classification }) => classification.conditioningModality)
    .filter((value): value is NonNullable<typeof value> => !!value)));
  const modalityLabel = modalities.length === 1
    ? ({ bike: 'Bike', row: 'RowErg', ski: 'SkiErg', run: 'Running', swim: 'Swimming', mixed: 'Mixed' } as const)[modalities[0]]
    : modalities.length > 1
      ? 'Mixed'
      : '';
  const intentLabel = intent === 'tempo'
    ? 'Tempo Conditioning'
    : intent === 'high-intensity'
      ? 'Hard Conditioning'
      : 'Aerobic Conditioning';
  const typedFallback = `${modalityLabel} ${intentLabel}`.trim() || 'Conditioning';
  const title = existingHeadline && !isWarmupOrCooldown(existingHeadline)
    ? existingHeadline
    : (mainWorkRow ? rowName(mainWorkRow) : '') || typedFallback;
  const covered = new Set(retainedOptions.flatMap((option) => option.exerciseIds));
  const promoted = conditioningIds.filter((id) => !covered.has(id));
  const options = retainedOptions.length > 0
    ? retainedOptions.map((option, index) => index === 0 && promoted.length > 0
      ? { ...option, title, exerciseIds: [...option.exerciseIds, ...promoted] }
      : index === 0 && isWarmupOrCooldown(option.title)
        ? { ...option, title }
        : option)
    : [{ title, description: '', exerciseIds: conditioningIds }];
  if (args.earlyOffseason) {
    options[0] = { ...options[0], title, description: '' };
  }
  return {
    intent,
    ...(args.workout.conditioningBlock?.attachedKind || args.workout.attachedConditioningKind
      ? { attachedKind: args.workout.conditioningBlock?.attachedKind ?? args.workout.attachedConditioningKind }
      : {}),
    options,
  };
}

function isMinorCrossPatternAccessory(classified: ClassifiedRow): boolean {
  return classified.classification.kind === 'strength_accessory' && classified.index >= 2;
}

function matchingReferenceRow(
  reference: Workout | null | undefined,
  pattern: MainStrengthPattern,
): WorkoutExercise | null {
  for (const [index, row] of (reference?.exercises ?? []).entries()) {
    const classification = classifyRow(row, index);
    if (classification.kind === 'strength_main' && classification.mainPattern === pattern) {
      return { ...row };
    }
  }
  return null;
}

function fallbackPatternRow(
  workout: Workout,
  pattern: MainStrengthPattern,
  index: number,
  earlyOffseason: boolean,
): WorkoutExercise {
  const name = FALLBACK_PATTERN_EXERCISE[pattern];
  const now = new Date().toISOString();
  const id = `canonical-${workout.id}-${pattern}`;
  return {
    id,
    workoutId: workout.id,
    exerciseId: `ex-canonical-${pattern}`,
    exerciseOrder: index + 1,
    prescribedSets: 3,
    prescribedRepsMin: earlyOffseason ? 8 : 6,
    prescribedRepsMax: earlyOffseason ? 12 : 10,
    prescribedWeightKg: 0,
    restSeconds: 90,
    notes: 'Restored from the deterministic main-pattern plan after an invalid edit.',
    exercise: {
      id: `ex-canonical-${pattern}`,
      name,
      description: name,
      muscleGroups: [],
      exerciseType: 'Compound',
      equipmentRequired: [],
      difficultyLevel: 'Intermediate',
      createdAt: now,
      updatedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  };
}

function canonicalStrengthName(
  patterns: readonly MainStrengthPattern[],
  isTeamDay: boolean,
): string | null {
  const label = canonicalStrengthLabel([...patterns]);
  if (!label) return isTeamDay ? 'Team Training' : null;
  return isTeamDay ? `Team Training + ${label}` : label;
}

function domainPatterns(rows: readonly ClassifiedRow[]): MainStrengthPattern[] {
  return Array.from(new Set(
    rows.flatMap(({ classification }) =>
      classification.kind === 'strength_main' && classification.mainPattern
        ? [classification.mainPattern]
        : []),
  ));
}

function updatePowerForPhase(args: {
  workout: Workout;
  context: WorkoutCanonicalisationContext;
  actions: WorkoutCanonicalisationAction[];
}): Workout {
  let workout = args.workout;
  const block = workout.powerBlock;
  if (!block) return workout;
  const gameProtected = args.context.hasGame &&
    args.context.gOffset !== undefined &&
    [0, -1, 1].includes(args.context.gOffset);
  const experiencedForGamePrimer = args.context.profile?.experienceLevel === '2-5 years' ||
    args.context.profile?.experienceLevel === '5+ years';
  const gMinusTwoBlocked = args.context.hasGame && args.context.gOffset === -2 &&
    (args.context.readiness !== 'high' || !experiencedForGamePrimer);
  const earlyOffseason = args.context.phase === 'Off-season' &&
    (args.context.offseasonSubphase ?? 'early_offseason') === 'early_offseason';
  if (
    earlyOffseason ||
    args.context.weekKind === 'deload' ||
    args.context.readiness === 'low' ||
    gameProtected ||
    gMinusTwoBlocked
  ) {
    args.actions.push({
      kind: 'power_removed',
      item: block.title,
      reason: earlyOffseason
        ? 'early_offseason_power_blocked'
        : args.context.weekKind === 'deload'
          ? 'deload_power_blocked'
          : gameProtected || gMinusTwoBlocked
            ? `game_proximity_power_blocked:G${args.context.gOffset! >= 0 ? '+' : ''}${args.context.gOffset}`
          : 'low_readiness_power_blocked',
    });
    return { ...workout, powerBlock: undefined };
  }
  const isTeamDay = classifyVisibleSession(workout).anchors.teamTraining;
  const preSeasonTeamContrast = args.context.phase === 'Pre-season' &&
    isTeamDay && block.kind === 'contrast';
  const gMinusTwoContrast = args.context.hasGame && args.context.gOffset === -2 &&
    block.kind === 'contrast';
  if (
    block.kind === 'contrast' && (
      (args.context.phase === 'Off-season' &&
        args.context.offseasonSubphase === 'mid_offseason') ||
      preSeasonTeamContrast ||
      gMinusTwoContrast
    )
  ) {
    args.actions.push({
      kind: 'power_downgraded',
      item: block.title,
      reason: gMinusTwoContrast
        ? 'game_proximity_primer_only:G-2'
        : preSeasonTeamContrast
        ? 'preseason_team_day_primer_only'
        : 'mid_offseason_primer_only',
    });
    workout = {
      ...workout,
      powerBlock: {
        ...block,
        kind: 'primer',
        title: 'Power Primer',
        notes: block.notes.filter((note) => !/^contrast:/i.test(note)),
      },
    };
  }
  const aligned = alignPowerBlockToFinalWorkoutContent(workout);
  if (aligned.action === 'removed') {
    args.actions.push({ kind: 'power_removed', item: block.title, reason: aligned.reason! });
  } else if (aligned.action === 'downgraded') {
    args.actions.push({ kind: 'power_downgraded', item: block.title, reason: aligned.reason! });
  }
  return aligned.workout;
}

/** Pure canonical finaliser shared by generation and every persisted mutation. */
export function finaliseWorkoutAfterMutation(
  inputWorkout: Workout,
  context: WorkoutCanonicalisationContext = {},
): WorkoutCanonicalisationResult {
  const actions: WorkoutCanonicalisationAction[] = [];
  const earlyOffseason = context.phase === 'Off-season' &&
    (context.offseasonSubphase ?? 'early_offseason') === 'early_offseason';
  const originalJson = JSON.stringify(inputWorkout);
  let workout: Workout = {
    ...inputWorkout,
    exercises: [...(inputWorkout.exercises ?? [])],
  };
  const originalConditioningIds = linkedConditioningIds(workout);
  const classified: ClassifiedRow[] = workout.exercises.map((row, index) => ({
    row,
    index,
    classification: classifyRow(row, index),
    linkedConditioning: originalConditioningIds.has(row.id),
  }));

  const planIntentValid = context.planIntentValid ?? !!workout.planEntryId;
  const explicitRestIdentity = workout.workoutType === ('Rest' as WorkoutType) ||
    /^rest(?:\s+day)?$/i.test(workout.name.trim());
  const supportOnlyTextHint =
    /\b(?:gunshow|prehab|pump|accessor|low-fatigue)\b/i.test(
      `${workout.name} ${workout.description ?? ''}`,
    );
  const initialMainPatterns = domainPatterns(classified.filter((row) => !row.linkedConditioning));
  const hasCanonicalConditioningRows = classified.some((row) =>
    row.linkedConditioning || row.classification.kind === 'conditioning');
  const trustExistingTypedIntent = !!workout.strengthIntent &&
    (!workout.planEntryId || planIntentValid);
  const trustedContributions = !workout.planEntryId || planIntentValid
    ? workout.strengthPatternContributions
    : undefined;
  const standaloneConditioningOwnership = !workout.hasCombinedConditioning && !!(
    workout.conditioningBlock || workout.conditioningCategory || workout.conditioningFlavour
  );
  const ownership = resolveStrengthOwnershipBoundary({
    strengthIntent: trustExistingTypedIntent ? workout.strengthIntent : undefined,
    strengthPatternContributions: trustedContributions,
    hasMatchedPlanEntry: !!workout.planEntryId && planIntentValid,
    hasModernPlanIdentity: !!workout.planEntryId,
    standaloneConditioning: standaloneConditioningOwnership,
    canonicalConditioningOnly: hasCanonicalConditioningRows && initialMainPatterns.length === 0,
    hasCanonicalMainStrengthRows: initialMainPatterns.length > 0,
  });
  const supportOnlyIdentity = explicitRestIdentity || (
    supportOnlyTextHint &&
    ownership.owner !== 'typed_strength' &&
    ownership.owner !== 'canonical_strength_rows'
  );
  const ingress = resolveLegacyStrengthIntent({
    strengthIntent: trustExistingTypedIntent ? workout.strengthIntent : undefined,
    strengthPatternContributions: trustedContributions,
    contentPatterns: ownership.allowCanonicalRowInference ? initialMainPatterns : undefined,
    name: workout.name,
    allowTextInference: ownership.allowLegacyTextInference,
    allowScalarInference: ownership.allowLegacyTextInference,
  });
  const authoritativeNoStrength = ownership.owner === 'typed_no_strength';
  let canonicalIntent: StrengthIntent | null = supportOnlyIdentity || authoritativeNoStrength
    ? null
    : ingress.intent;
  const intendedPatterns = planIntentValid && canonicalIntent
    ? new Set(canonicalIntent.plannedPatterns)
    : new Set<MainStrengthPattern>();
  if (supportOnlyIdentity && (workout.strengthIntent || workout.strengthPatternContributions?.length)) {
    actions.push({
      kind: 'plan_intent_cleared',
      item: workout.planEntryId,
      reason: explicitRestIdentity
        ? 'rest_session_has_no_main_strength_contribution'
        : 'support_session_has_no_main_strength_contribution',
    });
    workout = {
      ...workout,
      strengthIntent: undefined,
      strengthPatternContributions: undefined,
    };
    canonicalIntent = null;
  }
  if (!planIntentValid && workout.planEntryId) {
    actions.push({
      kind: 'plan_intent_cleared',
      item: workout.planEntryId,
      reason: 'plan_entry_absent_or_stale',
    });
    workout = {
      ...workout,
      planEntryId: undefined,
      strengthPatternContributions: undefined,
    };
    canonicalIntent = ingress.intent;
  }

  const conditioningRows: ClassifiedRow[] = [];
  const strengthAndSupportRows: ClassifiedRow[] = [];
  const recoveryAddonRows: ClassifiedRow[] = [];
  const sourceIsRecovery = workout.workoutType === 'Recovery' || workout.sessionTier === 'recovery';
  for (const item of classified) {
    const name = rowName(item.row);
    if (item.classification.kind === 'power') {
      actions.push({ kind: 'row_removed', item: name, reason: 'raw_power_owned_by_power_policy' });
      continue;
    }
    if (item.linkedConditioning || item.classification.kind === 'conditioning') {
      conditioningRows.push(item);
      if (!item.linkedConditioning) {
        actions.push({ kind: 'row_promoted', item: name, reason: 'promoted_to_typed_conditioning' });
      }
      continue;
    }
    if (item.classification.kind === 'recovery_addon' && !sourceIsRecovery) {
      recoveryAddonRows.push(item);
      actions.push({ kind: 'row_promoted', item: name, reason: 'promoted_to_recovery_addon' });
      continue;
    }
    if (
      standaloneConditioningOwnership &&
      item.classification.kind === 'strength_accessory' &&
      item.classification.reason === 'unknown_strength_accessory'
    ) {
      conditioningRows.push(item);
      actions.push({
        kind: 'row_promoted',
        item: name,
        reason: 'standalone_conditioning_domain_owns_unclassified_row',
      });
      continue;
    }
    if (
      (authoritativeNoStrength && item.classification.kind === 'strength_main') ||
      (standaloneConditioningOwnership && item.classification.kind === 'strength_accessory')
    ) {
      actions.push({
        kind: 'row_removed',
        item: name,
        reason: standaloneConditioningOwnership
          ? 'standalone_conditioning_has_no_strength_ownership'
          : 'modern_plan_has_no_strength_ownership',
      });
      continue;
    }
    const pattern = item.classification.mainPattern;
    if (
      intendedPatterns.size > 0 && pattern && !intendedPatterns.has(pattern) &&
      !isMinorCrossPatternAccessory(item)
    ) {
      actions.push({
        kind: 'row_removed',
        item: name,
        reason: `main_pattern_drift:${pattern}->${Array.from(intendedPatterns).join('+')}`,
      });
      continue;
    }
    const plain = item.row.pairType === 'contrast'
      ? withoutPairing(item.row)
      : item.row;
    if (plain !== item.row) {
      actions.push({ kind: 'pairing_removed', item: name, reason: 'stale_raw_contrast_pairing' });
    }
    strengthAndSupportRows.push({ ...item, row: plain });
  }

  if (intendedPatterns.size > 0 && context.restoreMissingPlanPatterns !== false) {
    const represented = new Set(domainPatterns(strengthAndSupportRows));
    for (const pattern of intendedPatterns) {
      if (represented.has(pattern)) continue;
      const restored = matchingReferenceRow(context.referenceWorkout, pattern) ??
        fallbackPatternRow(workout, pattern, strengthAndSupportRows.length, earlyOffseason);
      strengthAndSupportRows.push({
        row: restored,
        index: strengthAndSupportRows.length,
        classification: classifyRow(restored, strengthAndSupportRows.length),
        linkedConditioning: false,
      });
      actions.push({
        kind: 'row_restored',
        item: rowName(restored),
        reason: `restore_missing_plan_pattern:${pattern}`,
      });
    }
  }

  const finalConditioningRows = conditioningRows.map((item) =>
    canonicalConditioningRow(item, earlyOffseason, actions));
  const finalRows = [...strengthAndSupportRows.map(({ row }) => row), ...finalConditioningRows];
  const finalConditioningBlock = buildCanonicalConditioningBlock({
    workout,
    rows: conditioningRows,
    finalRows,
    earlyOffseason,
  });
  const finalClassified = finalRows.map((row, index) => ({
    row,
    index,
    classification: classifyRow(row, index),
    linkedConditioning: !!finalConditioningBlock?.options.some((option) =>
      option.exerciseIds.includes(row.id)),
  }));
  const finalStrengthPatterns = domainPatterns(
    finalClassified.filter((row) => !row.linkedConditioning),
  );
  if (!canonicalIntent && ownership.allowCanonicalRowInference && finalStrengthPatterns.length > 0) {
    const archetype = inferStrengthArchetype(finalStrengthPatterns);
    canonicalIntent = archetype
      ? createStrengthIntent({
          archetype,
          plannedPatterns: finalStrengthPatterns,
          effectivePatterns: finalStrengthPatterns,
        })
      : null;
  }
  const finalStrengthIntent = canonicalIntent
    ? withEffectiveStrengthPatterns(canonicalIntent, finalStrengthPatterns)
    : null;
  const strengthIntentDiagnostics = [] as NonNullable<Workout['strengthIntentDiagnostics']>;
  if (canonicalIntent) {
    for (const planned of canonicalIntent.plannedPatterns) {
      if (!finalStrengthIntent?.effectivePatterns.includes(planned)) {
        actions.push({
          kind: 'effective_pattern_removed',
          item: planned,
          reason: context.restoreMissingPlanPatterns === false
            ? 'removed_by_final_constraint_validation'
            : 'planned_pattern_absent_from_final_main_content',
        });
        strengthIntentDiagnostics.push({
          pattern: planned,
          change: 'removed',
          reason: context.restoreMissingPlanPatterns === false
            ? 'removed_by_final_constraint_validation'
            : 'planned_pattern_absent_from_final_main_content',
        });
      }
    }
  }
  const hasStrength = finalStrengthPatterns.length > 0;
  const hasConditioning = !!finalConditioningBlock?.options.length;
  const anchorClassification = classifyVisibleSession(workout);
  const isAnchor = anchorClassification.anchors.game || anchorClassification.anchors.teamTraining;
  const isRecovery = workout.workoutType === 'Recovery' ||
    (workout.sessionTier === 'recovery' && !hasStrength && !hasConditioning);

  let workoutType: WorkoutType = workout.workoutType;
  if (!isAnchor && !isRecovery) {
    workoutType = hasStrength && hasConditioning
      ? 'Mixed'
      : hasConditioning
        ? 'Conditioning'
        : hasStrength
          ? 'Strength'
          : workoutType;
  }
  if (workoutType !== workout.workoutType) {
    actions.push({
      kind: 'type_changed',
      item: `${workout.workoutType}->${workoutType}`,
      reason: 'final_component_structure_owns_type',
    });
  }

  const canonicalName = isAnchor || isRecovery
    ? workout.name
    : hasStrength
      ? canonicalStrengthName(
          finalStrengthIntent?.effectivePatterns ?? finalStrengthPatterns,
          anchorClassification.anchors.teamTraining,
        ) ?? workout.name
      : workout.name;
  if (canonicalName !== workout.name) {
    actions.push({ kind: 'name_changed', item: canonicalName, reason: 'final_content_owns_name' });
  }

  const generatedRecoveryAddon = recoveryAddonRows.length > 0
    ? {
        id: `canonical-recovery-${workout.id}`,
        title: 'Optional Recovery Add-on',
        label: 'Recovery',
        kind: 'mobility' as const,
        focusArea: 'General recovery',
        optional: true as const,
        skipPolicy: 'no_penalty' as const,
        durationMinutes: 5,
        exercises: recoveryAddonRows.map(({ row }, index) => ({
          id: `canonical-recovery-${workout.id}-${index}`,
          name: rowName(row),
          prescription: row.notes || `${row.prescribedSets} x ${row.prescribedRepsMin}-${row.prescribedRepsMax}`,
          source: 'local' as const,
        })),
        counting: {
          hardExposure: false as const,
          mainStrength: false as const,
          conditioningCredit: 'none' as const,
          createsHardDay: false as const,
          sprintCodExposure: false as const,
        },
      }
    : null;

  workout = {
    ...workout,
    name: canonicalName,
    workoutType,
    exercises: finalRows,
    strengthIntent: finalStrengthIntent ?? undefined,
    strengthIntentDiagnostics: strengthIntentDiagnostics.length > 0
      ? strengthIntentDiagnostics
      : undefined,
    strengthPatternContributions: finalStrengthIntent
      ? [...finalStrengthIntent.plannedPatterns]
      : undefined,
    recoveryAddons: generatedRecoveryAddon
      ? [...(workout.recoveryAddons ?? []), generatedRecoveryAddon]
      : workout.recoveryAddons,
    ...(finalConditioningBlock
      ? {
          conditioningBlock: finalConditioningBlock,
          conditioningFlavour: finalConditioningBlock.intent === 'high-intensity'
            ? 'high-intensity'
            : finalConditioningBlock.intent,
          conditioningCategory: earlyOffseason
            ? 'aerobic_base'
            : workout.conditioningCategory ??
              (finalConditioningBlock.intent === 'tempo'
                ? 'tempo'
                : finalConditioningBlock.intent === 'high-intensity'
                  ? 'vo2'
                  : 'aerobic_base'),
          hasCombinedConditioning: hasStrength,
        }
      : {
          conditioningBlock: undefined,
          conditioningFlavour: undefined,
          conditioningCategory: undefined,
          attachedConditioningKind: undefined,
          hasCombinedConditioning: false,
          coachAddedConditioningLabel: undefined,
        }),
  };
  workout = updatePowerForPhase({ workout, context, actions });
  workout = normalizeVisibleWorkoutIdentity(workout);

  if (!hasMeaningfulWorkoutContent(workout)) {
    actions.push({ kind: 'collapsed_to_rest', reason: 'no_meaningful_final_content' });
    workout = collapseWorkoutToRest(workout);
  }
  workout = withSection18WorkoutEvidence(
    workout,
    context.section18EvidenceMode ?? 'infer',
    context.planIntentValid === false ? 'explicit_mutation' : 'planner_and_canonical_content',
  );
  return {
    workout,
    changed: originalJson !== JSON.stringify(workout),
    actions,
  };
}
