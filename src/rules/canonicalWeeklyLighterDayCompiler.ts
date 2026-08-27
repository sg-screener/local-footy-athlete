/**
 * Canonical date-scoped opt-in policy for the existing §9 `slight` tier.
 * The policy is an accepted ledger input, linked to its readiness source fact.
 * Both live acceptance and reconstruction call this pure transformation.
 *
 * Methodology (docs/LFA_PROGRAMMING_BIBLE.md §9 lines 2494-2503;
 * docs/SLICE_4_2_READINESS_SUBSTITUTION_PLAN_2026-07-09.md C1 `slight`):
 *   • Reduce volume — halve accessory sets (ceil(n/2), floor 1), the same
 *     halving rule as the existing go-lighter transforms (applyReduceStrengthBlock
 *     / lightenSession).
 *   • Remove the hard finisher.
 *   • Swap hard conditioning for easy.
 *   • Keep the main lift if it can still move well — main-strength rows are
 *     byte-identical (sets AND weight). NEVER reduced or removed at this tier.
 *   • Session stays intact (never collapses to rest); session count unchanged.
 *
 * This module neither persists workouts nor decides progression. Its caller
 * publishes an ephemeral compiler result; only the accepted policy is saved.
 * Conditioning changes replace the owned prescription rows and metadata together;
 * an intensity label alone is never a change of training dose.
 */

import type { Workout, WorkoutExercise } from '../types/domain';
import type { TemporarySourceFact } from './temporarySourceFact';
import { selectReadinessFactForDate, temporarySourceFactId } from './temporarySourceFact';
import { composeConditioningRows, selectConditioningTemplate, templateDurationMinutes } from './conditioningSelection';
import { evaluateSection18EffectiveWeek } from './section18EffectiveWeekEvaluator';
import type { WeeklyExposureContractV2 } from './weeklyExposureContractV2';

/** Accepted opt-in policy, never a saved copy of the resulting session. */
export interface CanonicalAcceptedLighterDayEffect {
  readonly kind: 'lighter_day';
  readonly policy: 'slight_v1';
  readonly dateISO: string;
  readonly sourceFactId: string;
}

export function lighterDayEffectActive(
  effect: CanonicalAcceptedLighterDayEffect,
  facts: readonly TemporarySourceFact[],
): boolean {
  return effect.policy === 'slight_v1' && selectReadinessFactForDate({
    facts: facts.filter((fact) => temporarySourceFactId(fact) === effect.sourceFactId),
    dateISO: effect.dateISO,
  }) !== null;
}

export interface LighterDayTrimResult {
  workout: Workout;
  /** Athlete-facing disclosure lines — one per change actually made. */
  changes: string[];
}

/** A main-strength row is protected. Prefer the canonical §18 role; fall back to
 *  the session's first strength row when role evidence is absent. */
function isMainStrengthRow(row: WorkoutExercise): boolean {
  const role = (row as { section18Evidence?: { role?: string }; section18ConditioningRole?: string })
    .section18Evidence?.role ?? (row as { section18ConditioningRole?: string }).section18ConditioningRole;
  return role === 'main_strength';
}

function halveSets(sets: number): number {
  return Math.max(1, Math.ceil(sets / 2));
}

/**
 * Apply the `slight`-tier lighter-day trim to a single day's workout. Pure —
 * returns a new workout plus the list of changes made (empty list = nothing to
 * trim, e.g. a rest/recovery day).
 */
export function compileCanonicalLighterDayWorkout(workout: Workout): LighterDayTrimResult {
  const changes: string[] = [];
  const rows = (workout.exercises ?? []) as WorkoutExercise[];
  // Some accepted legacy workouts have no audit timestamp. Preserve that
  // absence instead of reading the device clock during reconstruction.
  const authoredAtISO = workout.createdAt ?? rows[0]?.createdAt ?? '';
  const block = workout.conditioningBlock;
  const conditioningIds = new Set(block?.options.flatMap((option) => option.exerciseIds) ?? []);
  const ownsConditioningRow = (row: WorkoutExercise): boolean =>
    conditioningIds.has(row.id) || conditioningIds.has(row.exerciseId);
  const dropFinisher = (block?.attachedKind ?? workout.attachedConditioningKind) === 'finisher';
  const easeConditioning = !dropFinisher && block?.intent === 'high-intensity';

  // If no §18 role evidence anywhere, protect the first strength row positionally
  // (Slice 4.2: "never remove the session's first/main lift").
  const anyRoleEvidence = rows.some((row) => isMainStrengthRow(row) ||
    !!(row as { section18Evidence?: unknown }).section18Evidence);
  const firstStrengthIndex = rows.findIndex((row) =>
    (row.prescribedWeightKg ?? 0) >= 0 && (row.prescribedSets ?? 0) > 0);

  const trimmedExercises = rows.map((row, index) => {
    // Conditioning and true power work have authored doses, not accessory sets.
    if (ownsConditioningRow(row) || row.role === 'conditioning' || row.role === 'power') return row;
    const isMain = anyRoleEvidence ? isMainStrengthRow(row) : index === firstStrengthIndex;
    if (isMain) return row; // main lift kept byte-identical (sets AND weight)
    const sets = Number(row.prescribedSets ?? 0);
    if (!Number.isFinite(sets) || sets <= 1) return row; // nothing to halve
    const nextSets = halveSets(sets);
    if (nextSets === sets) return row;
    changes.push(`${row.exercise?.name ?? 'Accessory'} ${sets}→${nextSets} sets`);
    return { ...row, prescribedSets: nextSets };
  });

  let compiled: Workout = { ...workout, exercises: trimmedExercises };
  if (dropFinisher && block) {
    changes.push('Dropped the finisher');
    compiled = {
      ...compiled,
      exercises: trimmedExercises.filter((row) => !ownsConditioningRow(row)),
      conditioningBlock: undefined,
      hasCombinedConditioning: false,
      attachedConditioningKind: undefined,
      conditioningFlavour: undefined,
      conditioningCategory: undefined,
      conditioningFeasibility: undefined,
      coachAddedConditioningLabel: undefined,
      section18ConditioningRole: 'none',
      section18Evidence: { protocolVersion: 1, conditioningRole: 'none',
        conditioningStress: 'unknown', provenance: 'explicit_mutation' },
    };
  } else if (easeConditioning && block) {
    // Use a signed flush template, retaining the already accepted modality.
    // The short-role pool prefers a short authored dose; it never invents one.
    const options = block.options.map((option, index) => {
      const modality = option.modality ?? 'running';
      const machine = modality === 'running' || modality === 'mixed' ? null : modality;
      const template = selectConditioningTemplate({
        category: 'recovery_flush', dateStr: `${workout.id}:${index}`, role: 'finisher',
        offFeet: !!machine, runOnly: modality === 'running',
        availableMachines: machine ? [machine] : [],
      });
      const easyRows = composeConditioningRows(template, authoredAtISO.slice(0, 10), {
        idPrefix: `${workout.id}-lighter-${index}`, omitWarmup: true,
        authoredMinimumDose: true, authoredAtISO,
      }).map((row): WorkoutExercise => ({ ...row, workoutId: workout.id,
        section18Evidence: { protocolVersion: 1, role: 'conditioning',
          strengthPattern: null, mainStrengthPattern: null, provenance: 'canonical_row_classifier' },
      }));
      return { rows: easyRows, option: { title: template.name, description: easyRows[0].notes ?? '',
        exerciseIds: easyRows.map((row) => row.id), modality,
        intensity: 'Light' as const, durationMinutes: templateDurationMinutes(template) } };
    });
    const remaining = trimmedExercises.filter((row) => !ownsConditioningRow(row));
    const hasStrength = remaining.some((row) => row.section18Evidence?.role === 'main_strength' ||
      (row.role !== 'conditioning' && (row.exercise?.exerciseType === 'Compound' || row.exercise?.exerciseType === 'Isolation')));
    changes.push('Eased the hard conditioning');
    compiled = {
      ...compiled,
      exercises: [...remaining, ...options.flatMap((entry) => entry.rows)]
        .map((row, index) => row.exerciseOrder === index + 1 ? row : { ...row, exerciseOrder: index + 1 }),
      conditioningBlock: { ...block, intent: 'aerobic', options: options.map((entry) => entry.option) },
      conditioningFlavour: 'aerobic', conditioningCategory: 'aerobic_base',
      conditioningFeasibility: undefined,
      section18ConditioningRole: 'optional_flush',
      section18Evidence: { protocolVersion: 1, conditioningRole: 'optional_flush',
        conditioningStress: 'light', provenance: 'explicit_mutation' },
      ...(!hasStrength ? { name: options[0].option.title, description: options[0].option.description,
        intensity: 'Light' as const, durationMinutes: options[0].option.durationMinutes,
        workoutType: 'Conditioning' as const } : {}),
    };
  }

  const accessoryHalved = changes.some((line) => /→/.test(line));
  const summaryChanges = accessoryHalved && !changes.some((l) => /volume/i.test(l))
    ? ['Trimmed accessory volume', ...changes.filter((l) => !/→/.test(l))]
    : changes;

  return {
    workout: compiled,
    changes: summaryChanges,
  };
}

/**
 * Would the lighter-day trim actually CHANGE this workout? Pure, and the ONE
 * predicate the offer and the apply both stand on (R-228's class: an offer is
 * an effect claim, so it is selected by what the commit would do, never by the
 * fact alone). Launch audit 2026-08-25, finding #8: the offer was made after
 * every today-scoped report, so a team-training or rest day offered a lighter
 * day whose accept could only answer "There is no session to lighten today."
 */
export function lighterDayTrimAvailable(workout: Workout | null | undefined): boolean {
  if (!workout || (workout.exercises ?? []).length === 0) return false;
  return compileCanonicalLighterDayWorkout(workout).changes.length > 0;
}

/** Compile only the conditioning-target delta authorised by this date's opt-in.
 * Existing deficits elsewhere in the week cannot become new allowances. Strength,
 * fixtures, placement ceilings and all other safety policies are unchanged. */
export function compileCanonicalLighterDayContract(args: {
  contract: WeeklyExposureContractV2;
  before: readonly Workout[];
  after: readonly Workout[];
  weekStartISO: string;
  effect: CanonicalAcceptedLighterDayEffect;
}): WeeklyExposureContractV2 {
  const before = evaluateSection18EffectiveWeek({ contract: args.contract,
    workouts: args.before, weekStart: args.weekStartISO }).ledger.conditioning;
  const after = evaluateSection18EffectiveWeek({ contract: args.contract,
    workouts: args.after, weekStart: args.weekStartISO }).ledger.conditioning;
  const removedCore = Math.max(0, before.coreCount - after.coreCount);
  const removedHard = Math.max(0, before.byStress.hard - after.byStress.hard);
  const removedMediumHard = Math.max(0,
    before.byStress.hard + before.byStress.moderate - after.byStress.hard - after.byStress.moderate);
  const contract: WeeklyExposureContractV2 = JSON.parse(JSON.stringify(args.contract));
  const core = contract.conditioning.core;
  const originalTarget = Math.max(core.requiredMinimum, core.plannerSelectedTarget ?? 0);
  core.requiredMinimum = Math.max(0, core.requiredMinimum - removedCore);
  if (core.plannerSelectedTarget !== null) core.plannerSelectedTarget = Math.max(0, core.plannerSelectedTarget - removedCore);
  const intensity = contract.conditioning.intensityPolicy;
  intensity.requiredAppHardMinimum = Math.max(0, intensity.requiredAppHardMinimum - removedHard);
  intensity.requiredAppMediumHardMinimum = Math.max(0, intensity.requiredAppMediumHardMinimum - removedMediumHard);
  if (removedCore > 0) {
    const reduction = {
      metric: 'conditioning_core_frequency' as const, originalApprovedTarget: originalTarget,
      reducedTarget: Math.max(core.requiredMinimum, core.plannerSelectedTarget ?? 0),
      reason: 'explicit_user_override' as const, scope: 'week' as const, change: 'frequency' as const,
      detail: `Accepted lighter day on ${args.effect.dateISO}; source ${args.effect.sourceFactId}.`,
      provenance: 'live_typed_reduction' as const, affectedWeek: args.weekStartISO,
    };
    contract.authorisedReductions.push(reduction);
    contract.conditioning.reductions.push(reduction);
  }
  return contract;
}
