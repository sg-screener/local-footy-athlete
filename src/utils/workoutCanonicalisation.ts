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
import { alignPowerToFinalWorkoutContent } from '../rules/powerRowAlignment';
import { classifyVisibleSession } from '../rules/sessionClassificationAdapter';
import {
  withSection18WorkoutEvidence,
  type Section18EvidenceMode,
} from '../rules/section18WorkoutEvidence';
import { canonicalConditioningLabel, canonicalStrengthLabel } from './sessionNaming';
import { normalizeVisibleWorkoutIdentity } from './visibleWorkoutIdentity';
import { collapseWorkoutToRest, hasMeaningfulWorkoutContent } from './workoutContent';
import {
  countingIndices,
  hasPowerRow,
  powerRows,
  withoutPowerRows,
} from '../rules/sessionRowCounting';
import {
  SLOTS_FOR_KIND,
  patternsCompletingLadder,
  slotDayKindForPatterns,
  slotsFilledByRow,
  type SessionSlot,
} from '../rules/sessionSlotCoverage';

/**
 * The ONE conversion from "phase + whatever the caller resolved" into the
 * canonical context's required subphase.
 *
 * It refuses rather than guesses. If the phase is Off-season and the caller has
 * no resolved subphase, that is a builder that does not know where in the
 * off-season its week sits — which is exactly the state that used to silently
 * delete the athlete's power work. Throwing here surfaces it at the builder, in
 * the stack of whoever failed to carry the fact, instead of as missing content
 * three layers downstream.
 */
export function canonicalContextSubphase(
  phase: SeasonPhase | null | undefined,
  resolved: OffseasonSubphase | null | undefined,
): CanonicalContextOffseasonSubphase {
  if (phase !== 'Off-season') return 'not_off_season';
  if (resolved) return resolved;
  throw new Error(
    '[WorkoutCanonicalisation] an Off-season canonical context was built with no ' +
    'resolved off-season subphase. Carry it from the season phase clock or the ' +
    "Section 18 contract's declaredSubphase — it must not be defaulted.",
  );
}

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

/**
 * The resolved off-season position, stated by whoever builds the context.
 *
 * `'not_off_season'` is an ANSWER, not a blank: it says the resolver looked and
 * this week is not an off-season week. That distinction is the whole point of
 * the field being required — see the note on `offseasonSubphase` below.
 */
export type CanonicalContextOffseasonSubphase =
  | OffseasonSubphase
  | 'not_off_season';

export interface WorkoutCanonicalisationContext {
  date?: string;
  phase?: SeasonPhase | null;
  /**
   * REQUIRED, and deliberately so (Sam, 2026-07-27).
   *
   * This was optional, and `updatePowerForPhase` read a missing value as
   * `'early_offseason'` — the conservative guess. The guess deleted power from
   * any off-season week whose context happened not to carry the subphase, with
   * the reason `early_offseason_power_blocked`, on a week the phase clock had
   * resolved as LATE off-season. It was found on deload weeks (a deload always
   * sets `lighterStrengthRequired`, so the §18 safety pass always re-canonicalises
   * there) but the trigger was never the deload: FIVE builders did not carry the
   * subphase, including hydration, the coach command executor and the plan-change
   * producer, so any off-season mutation through those paths lost power too.
   *
   * The absence of a fact is not a fact. Making the field required puts the
   * question to every builder at compile time; `'not_off_season'` is how a
   * builder says "resolved, and there is no subphase here". A builder that
   * cannot answer is a typed error, which is the loud failure this replaces the
   * silent guess with.
   */
  offseasonSubphase: CanonicalContextOffseasonSubphase;
  weekKind?: WeekKind | null;
  // NO `readiness` FIELD (Sam's readiness law, 2026-07-28). Capacity is a dose
  // and the dose has one owner (`decidePowerPrimer`); a finaliser that re-reads
  // it either removes work the law protects or compounds a shrink it cannot
  // detect. Removing the field is what makes that unrepresentable rather than
  // merely discouraged. `prohibitPower` remains for §18 SAFETY, which is an
  // injury/eligibility fact, not a capacity one.
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
  /** Safety-owned patterns can never be restored from plan/default identity. */
  prohibitedStrengthPatterns?: readonly MainStrengthPattern[];
  /** Safety eligibility outranks ordinary phase power placement. */
  prohibitPower?: boolean;
  /** Safety eligibility outranks ordinary sprint/high-speed placement. */
  prohibitSprintHighSpeed?: boolean;
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
  const intentLabel = canonicalConditioningLabel(intent);
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

/**
 * A MINOR ACCESSORY THE DRIFT GUARD LETS THROUGH — BUT ONLY IF IT BELONGS TO
 * THIS DAY'S BODY REGION.
 *
 * **THE EXEMPTION WAS REGION-BLIND AND THAT IS HOW ARM WORK GOT ONTO LEG DAYS.**
 * It asked two questions — is this an accessory, and is it past position 2 — and
 * neither of them is "does it belong here". Measured 2026-08-13, pre-season,
 * every week: a day NAMED `Lower Squat` shipped
 *
 *     Bicep Curls | Tricep Pushdowns | Face Pulls | Nordic Lower | Pallof Press | Back Squat
 *
 * — ONE lower lift and THREE arm exercises. `Lower Hinge` was the same. C7's
 * receipt recorded this as *"a lower day whose entire content is arm work is a
 * separate defect, upstream of this drop"* and left it unclaimed; this is it.
 *
 * THE RULE IS THE LADDER, SAME AS THE MAIN-PATTERN CHECK ABOVE. An accessory is
 * minor-and-allowed when the slot it fills is a slot THIS day's ladder contains.
 * A lower day's ladder ends in `accessory_or_core`, so a Pallof Press and a
 * Nordic Lower stay — they are the accessory work Sam's fill order asks for. It
 * has no `arm_or_shoulder`, so a bicep curl is drift and goes. An upper day's
 * ladder DOES have `arm_or_shoulder`, so the same curl stays there.
 *
 * A row that fills NO slot at all keeps the old behaviour and is let through:
 * this guard exists to stop a day wandering off its plan, not to become a second
 * vocabulary gate on rows nothing classifies.
 */
function isMinorCrossPatternAccessory(
  classified: ClassifiedRow,
  daySlots: readonly SessionSlot[],
): boolean {
  if (classified.classification.kind !== 'strength_accessory' || classified.index < 2) return false;
  const slots = slotsFilledByRow(classified.row);
  if (slots.length === 0) return true;
  return slots.some((slot) => daySlots.includes(slot));
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

/**
 * The final content owns the name — but on a COMBINED day it owns only its own
 * half of it.
 *
 * "Recovery Session + Full Body Strength" carries a container the strength
 * label knows nothing about, and rewriting the whole name from the strength
 * patterns deleted it: the card named the session the athlete added and not the
 * one it was added to. The strength half is still verified against the final
 * patterns, so a name whose strength half has gone stale is still corrected;
 * only a container that is still on the day survives.
 */
function nameWithContainerPreserved(
  currentName: string,
  canonical: string | null,
): string | null {
  if (!canonical) return null;
  return currentName.endsWith(` + ${canonical}`) ? currentName : canonical;
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
  const rows = powerRows(workout);
  if (rows.length === 0) return workout;
  const primary = rows[0];
  const blockTitle = primary.power?.kind === 'contrast' ? 'Contrast Power' : 'Power Primer';
  const gameProtected = args.context.hasGame &&
    args.context.gOffset !== undefined &&
    [0, -1, 1].includes(args.context.gOffset);
  const experiencedForGamePrimer = args.context.profile?.experienceLevel === '2-5 years' ||
    args.context.profile?.experienceLevel === '5+ years';
  // Capacity left this gate (Sam's readiness law, 2026-07-28). It read
  // `readiness !== 'high'`, and because the field was optional every context
  // that did not carry it — most of them — answered "not high" and removed the
  // G-2 primer outright. The experience requirement is a training-age fact and
  // stays; the dose belongs to `decidePowerPrimer`, which shrinks the G-2 primer
  // below high capacity instead of deleting it.
  const gMinusTwoBlocked = args.context.hasGame && args.context.gOffset === -2 &&
    !experiencedForGamePrimer;
  // The subphase is READ, never derived. There is no `?? 'early_offseason'`
  // here any more: that default deleted power from late off-season weeks whose
  // builder simply had not carried the resolution. A builder that states
  // `'not_off_season'` on an off-season week is contradicting itself, and that
  // is surfaced loudly rather than resolved into a guess — see the throw below.
  const earlyOffseason = args.context.phase === 'Off-season' &&
    args.context.offseasonSubphase === 'early_offseason';
  if (
    args.context.phase === 'Off-season' &&
    args.context.offseasonSubphase === 'not_off_season'
  ) {
    throw new Error(
      '[WorkoutCanonicalisation] canonical context claims phase=Off-season with ' +
      'offseasonSubphase=not_off_season. The off-season subphase is a resolved ' +
      'fact and this context states two contradictory ones; carry the resolution ' +
      'from the phase clock (or the contract\'s declaredSubphase) instead.',
    );
  }
  // THE DELOAD LAW (Sam, 2026-07-27) removed `weekKind === 'deload'` from this
  // gate: "Power is not removed on a deload; a deload is not a reason to lose
  // sharpness." The deload transform shrinks the dose inside the primer instead.
  //
  // CAPACITY LEFT THIS FINALISER ENTIRELY (Sam's readiness law, 2026-07-28).
  // `readiness === 'low'` removed the block here; the ruling extends the deload
  // sentence directly above — if a deload is not a reason to lose sharpness,
  // neither is low capacity.
  //
  // It became a DOSE rather than a smaller removal, and the dose has exactly one
  // owner: `decidePowerPrimer` shrinks the spec once, where the block is
  // decided. This finaliser deliberately does not shrink, because it cannot tell
  // an already-shrunk row from a full one — a shrink here would compound on
  // every re-canonicalisation of the same week. That is the same split the
  // deload law already uses (`deloadPowerDose` runs where the block is built).
  //
  // So the input is GONE rather than inverted: `WorkoutCanonicalisationContext`
  // no longer carries readiness, and there is no field here for the removal to
  // grow back on. What remains — `earlyOffseason`, `gameProtected`,
  // `gMinusTwoBlocked`, §18 safety — are phase, schedule and injury facts, which
  // the ruling keeps.
  if (
    args.context.prohibitPower === true ||
    earlyOffseason ||
    gameProtected ||
    gMinusTwoBlocked
  ) {
    args.actions.push({
      kind: 'power_removed',
      item: blockTitle,
      reason: earlyOffseason
        ? 'early_offseason_power_blocked'
        : args.context.prohibitPower
          ? 'section18_safety_power_blocked'
          : `game_proximity_power_blocked:G${args.context.gOffset! >= 0 ? '+' : ''}${args.context.gOffset}`,
    });
    return withoutPowerRows(workout);
  }
  const isTeamDay = classifyVisibleSession(workout).anchors.teamTraining;
  const isContrast = primary.power?.kind === 'contrast';
  const preSeasonTeamContrast = args.context.phase === 'Pre-season' &&
    isTeamDay && isContrast;
  const gMinusTwoContrast = args.context.hasGame && args.context.gOffset === -2 && isContrast;
  if (
    isContrast && (
      (args.context.phase === 'Off-season' &&
        args.context.offseasonSubphase === 'mid_offseason') ||
      preSeasonTeamContrast ||
      gMinusTwoContrast
    )
  ) {
    args.actions.push({
      kind: 'power_downgraded',
      item: blockTitle,
      reason: gMinusTwoContrast
        ? 'game_proximity_primer_only:G-2'
        : preSeasonTeamContrast
        ? 'preseason_team_day_primer_only'
        : 'mid_offseason_primer_only',
    });
    // The downgrade is a DOSE/pairing change on the row, not a new object: drop
    // the contrast pairing sentence from the notes and mark the row a primer.
    workout = {
      ...workout,
      exercises: (workout.exercises ?? []).map((row) => row.role === 'power' && row.power
        ? {
            ...row,
            power: { ...row.power, kind: 'primer' as const },
            notes: (row.notes ?? '').replace(/\s*Contrast:[^]*$/i, '').trim() || undefined,
          }
        : row),
    };
  }
  const aligned = alignPowerToFinalWorkoutContent(workout);
  if (aligned.action === 'removed') {
    args.actions.push({ kind: 'power_removed', item: blockTitle, reason: aligned.reason! });
  } else if (aligned.action === 'downgraded') {
    args.actions.push({ kind: 'power_downgraded', item: blockTitle, reason: aligned.reason! });
  }
  return aligned.workout;
}

/** Pure canonical finaliser shared by generation and every persisted mutation. */
export function finaliseWorkoutAfterMutation(
  inputWorkout: Workout,
  // No `= {}` default: an empty context would silently answer the subphase
  // question with a guess, which is the defect this signature now forbids.
  context: WorkoutCanonicalisationContext,
): WorkoutCanonicalisationResult {
  const actions: WorkoutCanonicalisationAction[] = [];
  const earlyOffseason = context.phase === 'Off-season' &&
    context.offseasonSubphase === 'early_offseason';
  const originalJson = JSON.stringify(inputWorkout);
  let workout: Workout = {
    ...inputWorkout,
    exercises: [...(inputWorkout.exercises ?? [])],
  };
  const originalConditioningIds = linkedConditioningIds(workout);
  // SPEED-BLOCK MEMBERSHIP VETOES CONDITIONING CLASSIFICATION (Stage B
  // switchover). Speed rows now carry AUTHORED template names shared with the
  // conditioning vocabulary ('20 m Acceleration Reps'), so a name classifier
  // cannot tell a speed exposure from a conditioning one — but the SpeedBlock's
  // typed counting fence already says `conditioningCredit: 'none'`, and block
  // membership is the typed authority. Without this veto, canonicalisation
  // promoted a pre-lift speed dose into a combined VO2 conditioning block and
  // handed a deload week a third core conditioning exposure.
  const speedRowIds = new Set(workout.speedBlock?.exerciseIds ?? []);
  // Position among COUNTED work, not among array slots. Power leads the list and
  // counts toward nothing, so it must not renumber the lifts behind it — see
  // `countingIndices`.
  const classifyIndices = countingIndices(workout.exercises);
  const classified: ClassifiedRow[] = workout.exercises.map((row, index) => {
    let classification = classifyRow(row, classifyIndices[index]);
    if (classification.kind === 'conditioning' && speedRowIds.has(row.id)) {
      classification = {
        ...classification,
        kind: 'strength_accessory',
        conditioningModality: null,
        hardConditioning: false,
      };
    }
    return {
      row,
      index,
      classification,
      linkedConditioning: originalConditioningIds.has(row.id),
    };
  });

  const planIntentValid = context.planIntentValid ?? !!workout.planEntryId;
  const prohibitedPatterns = new Set(context.prohibitedStrengthPatterns ?? []);
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
    ? new Set(canonicalIntent.plannedPatterns.filter((pattern) => !prohibitedPatterns.has(pattern)))
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
  // Authored power rows pass through the triage untouched. They are not
  // strength, not support and not conditioning, and the canonicaliser has no
  // opinion to add about them — identity came from the pool and dose from the
  // policy, both upstream of here.
  const authoredPowerRows: ClassifiedRow[] = [];
  const recoveryAddonRows: ClassifiedRow[] = [];
  const sourceIsRecovery = workout.workoutType === 'Recovery' || workout.sessionTier === 'recovery';
  // Loop-invariant: a pure function of the plan's patterns, which do not change
  // while the rows are triaged.
  const ladderPatterns = patternsCompletingLadder(intendedPatterns);
  // The day's own slot ladder, for the accessory exemption below. Derived from
  // the SAME intent the drift check reads, so the two cannot disagree.
  const dayKind = slotDayKindForPatterns(intendedPatterns);
  const daySlots = dayKind ? SLOTS_FOR_KIND[dayKind] : [];
  for (const item of classified) {
    const name = rowName(item.row);
    const pattern = item.classification.mainPattern;
    if (pattern && prohibitedPatterns.has(pattern)) {
      actions.push({
        kind: 'row_removed',
        item: name,
        reason: `section18_prohibited_pattern:${pattern}`,
      });
      continue;
    }
    // AUTHORED ROLE WINS. This rule used to remove every row the classifier
    // called power, because power lived in `workout.powerBlock` and a
    // power-looking ROW could only be a generator inventing one. Now the power
    // policy's own output IS a row, so the rule has to tell the two apart — and
    // the authored role is what tells them apart, not the name.
    //
    // The old behaviour survives exactly where it still applies: a row that
    // LOOKS like power but carries no authored role is still a stray, still
    // removed, still for the same reason. `workoutCanonicalisationTests` [2]
    // pins that half.
    if (item.row.role === 'power') {
      authoredPowerRows.push(item);
      continue;
    }
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
    // ── DRIFT IS MEASURED AGAINST THE DAY'S LADDER, NOT ITS MAIN LIFT ────────
    //
    // `intendedPatterns` is what the PLAN named, and a plan entry names the lift
    // the day is BUILT AROUND — not its whole content. Sam's `:227` ladder then
    // asks that same day for a hinge, a single-leg knee, a single-leg hip and an
    // accessory. Comparing rows against `intendedPatterns` therefore deleted the
    // hinge out of every fallback-built lower day: measured, exactly one line in
    // the away suite and ZERO across the whole QA corpus —
    // `DRIFT-DROP "Deadlift" pattern=hinge intended=[squat] workout="Lower Squat"`.
    // `:227` and this guard were in direct contradiction and the guard was
    // winning, against *"an athlete is better served by a squat and a hinge than
    // by two squats."*
    //
    // THE GUARD IS NOT DELETED AND IS NOT WEAKENED WHERE IT EARNS ITS KEEP. It
    // exists to stop a day wandering off its plan, and it still does: a bench
    // press on a squat day is `push`, which no lower ladder admits, so it is
    // still removed. What stops counting as drift is only work the day's own
    // ladder was asking for all along.
    if (
      intendedPatterns.size > 0 && pattern && !ladderPatterns.has(pattern) &&
      !isMinorCrossPatternAccessory(item, daySlots)
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
  // Power leads. Its position in the one list is what carries "do this fresh,
  // before the main lifts" — no renderer has to know power is special.
  const finalRows = [
    ...authoredPowerRows.map(({ row }) => row),
    ...strengthAndSupportRows.map(({ row }) => row),
    ...finalConditioningRows,
  ];
  const finalConditioningBlock = buildCanonicalConditioningBlock({
    workout,
    rows: conditioningRows,
    finalRows,
    earlyOffseason,
  });
  const finalIndices = countingIndices(finalRows);
  const finalClassified = finalRows.map((row, index) => ({
    row,
    index,
    classification: classifyRow(row, finalIndices[index]),
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
      ? nameWithContainerPreserved(
          workout.name,
          canonicalStrengthName(
            finalStrengthIntent?.effectivePatterns ?? finalStrengthPatterns,
            anchorClassification.anchors.teamTraining,
          ),
        ) ?? workout.name
      : workout.name;
  if (canonicalName !== workout.name) {
    actions.push({ kind: 'name_changed', item: canonicalName, reason: 'final_content_owns_name' });
  }

  const generatedRecoveryAddon = recoveryAddonRows.length > 0
    ? {
        id: `canonical-recovery-${workout.id}`,
        // MOBILITY VOCABULARY (2026-08-01, device-pass fail 3): recovery is a
        // charter-deleted type; these rows have always been typed
        // `kind: 'mobility'` one line down, and the athlete-visible words now
        // say what the rows are. The id prefix is identity, not vocabulary —
        // it stays, so nothing keyed on it moves.
        title: 'Optional Mobility Add-on',
        label: 'Mobility',
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
          section18ConditioningRole: undefined,
          attachedConditioningKind: undefined,
          hasCombinedConditioning: false,
          coachAddedConditioningLabel: undefined,
        }),
  };
  workout = updatePowerForPhase({ workout, context, actions });
  if (context.prohibitSprintHighSpeed && workout.speedBlock) {
    actions.push({
      kind: 'row_removed',
      item: workout.speedBlock.title,
      reason: 'section18_safety_sprint_blocked',
    });
    workout = { ...workout, speedBlock: undefined };
  }
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
