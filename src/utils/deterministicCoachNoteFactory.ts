import type {
  ActiveConstraintModifierAffect,
} from '../store/coachUpdatesStore';
import type {
  DeterministicCoachNoteEffectEvidence,
  DeterministicCoachNoteEffectReason,
  DeterministicCoachNoteEffectSeed,
  DeterministicPrescriptionProofRow,
  Workout,
  WorkoutExercise,
} from '../types/domain';
import { classifyGeneratedWorkoutRow } from '../rules/generatedWorkoutRowClassification';
import type { ConditioningModality } from '../data/exerciseTags';
import { getSessionComponentRows } from './sessionComponents';

type DeterministicCoachNoteVisibleWorkout = Pick<
  Workout,
  | 'name'
  | 'workoutType'
  | 'sessionTier'
  | 'conditioningCategory'
  | 'conditioningBlock'
  | 'exercises'
  | 'speedBlock'
  | 'powerBlock'
  | 'recoveryAddons'
  | 'deterministicCoachNoteEvidence'
>;

export interface DeterministicCoachNoteVisibleDay {
  date: string;
  workout?: DeterministicCoachNoteVisibleWorkout | null;
}

export interface DeterministicCoachNoteDescriptor {
  sourceId: string;
  lifecycleKey: string;
  title: string;
  body: string;
  affects: ActiveConstraintModifierAffect[];
}

type PrescriptionComparable = Pick<
  WorkoutExercise,
  | 'exerciseId'
  | 'prescribedSets'
  | 'prescribedRepsMin'
  | 'prescribedRepsMax'
  | 'prescribedWeightKg'
  | 'restSeconds'
  | 'notes'
  | 'exercise'
>;

function prescriptionRow(exercise: PrescriptionComparable): DeterministicPrescriptionProofRow {
  return {
    exerciseId: exercise.exerciseId,
    exerciseName: exercise.exercise?.name ?? exercise.exerciseId,
    prescribedSets: exercise.prescribedSets,
    prescribedRepsMin: exercise.prescribedRepsMin,
    prescribedRepsMax: exercise.prescribedRepsMax,
    prescribedWeightKg: exercise.prescribedWeightKg,
    restSeconds: exercise.restSeconds,
    notes: exercise.notes,
  };
}

function samePrescription(
  left: PrescriptionComparable | DeterministicPrescriptionProofRow,
  right: PrescriptionComparable | DeterministicPrescriptionProofRow,
): boolean {
  return left.exerciseId === right.exerciseId &&
    left.prescribedSets === right.prescribedSets &&
    left.prescribedRepsMin === right.prescribedRepsMin &&
    left.prescribedRepsMax === right.prescribedRepsMax &&
    left.prescribedWeightKg === right.prescribedWeightKg &&
    left.restSeconds === right.restSeconds &&
    left.notes === right.notes;
}

/** Build prescription evidence only when at least one visible row changed. */
export function buildPrescriptionEffectEvidence(args: {
  seed: DeterministicCoachNoteEffectSeed;
  before: readonly PrescriptionComparable[];
  after: readonly PrescriptionComparable[];
}): DeterministicCoachNoteEffectEvidence | null {
  const beforeById = new Map(args.before.map((row) => [row.exerciseId, row]));
  const changedRows = args.after.filter((row) => {
    const before = beforeById.get(row.exerciseId);
    return !before || !samePrescription(before, row);
  });
  if (changedRows.length === 0) return null;
  return {
    ...args.seed,
    proof: {
      type: 'prescription',
      rows: changedRows.map(prescriptionRow),
    },
  };
}

function sessionShapeProof(workout: Workout): DeterministicCoachNoteEffectEvidence['proof'] {
  const conditioningRows = getSessionComponentRows(workout).conditioningRows;
  const conditioningModalities = Array.from(new Set(conditioningRows
    .map((row, index) => classifyGeneratedWorkoutRow({
      name: row.exercise?.name ?? '',
      sets: row.prescribedSets,
      repsMax: row.prescribedRepsMax,
      index,
    }).conditioningModality)
    .filter((modality): modality is ConditioningModality => !!modality)));
  return {
    type: 'session_shape',
    name: workout.name,
    workoutType: workout.workoutType,
    sessionTier: workout.sessionTier,
    conditioningCategory: workout.conditioningCategory,
    hasConditioningComponent: conditioningRows.length > 0,
    conditioningModalities,
    exerciseNames: workout.exercises.map((row) => row.exercise?.name ?? row.exerciseId),
    hasSpeedBlock: !!workout.speedBlock,
    hasPowerBlock: !!workout.powerBlock,
  };
}

function appendEvidence(
  workout: Workout,
  evidence: DeterministicCoachNoteEffectEvidence,
): Workout {
  const current = workout.deterministicCoachNoteEvidence ?? [];
  const withoutOwner = current.filter((row) =>
    row.kind !== evidence.kind || row.ownerKey !== evidence.ownerKey,
  );
  return {
    ...workout,
    deterministicCoachNoteEvidence: [...withoutOwner, evidence],
  };
}

/** Convert generation-owned effect seeds into proof tied to the built session. */
export function attachSessionEffectEvidence(
  workout: Workout,
  seeds: readonly DeterministicCoachNoteEffectSeed[] | null | undefined,
): Workout {
  if (!seeds?.length) return workout;
  return seeds.reduce(
    (next, seed) => appendEvidence(next, { ...seed, proof: sessionShapeProof(workout) }),
    workout,
  );
}

export function attachPrescriptionEffectEvidence(
  workout: Workout,
  evidence: DeterministicCoachNoteEffectEvidence | null | undefined,
): Workout {
  return evidence ? appendEvidence(workout, evidence) : workout;
}

export function attachRecoveryAddonEffectEvidence(args: {
  workout: Workout;
  seed: DeterministicCoachNoteEffectSeed;
  focusAreas: string[];
}): Workout {
  if (args.focusAreas.length === 0) return args.workout;
  return appendEvidence(args.workout, {
    ...args.seed,
    proof: { type: 'recovery_addon', focusAreas: [...args.focusAreas] },
  });
}

function prescriptionProofStillVisible(
  workout: DeterministicCoachNoteVisibleWorkout,
  rows: readonly DeterministicPrescriptionProofRow[],
): boolean {
  if (rows.length === 0) return false;
  const currentById = new Map(workout.exercises.map((row) => [row.exerciseId, row]));
  return rows.every((proof) => {
    const current = currentById.get(proof.exerciseId);
    return !!current && samePrescription(current, proof);
  });
}

function evidenceStillVisible(
  workout: DeterministicCoachNoteVisibleWorkout,
  evidence: DeterministicCoachNoteEffectEvidence,
): boolean {
  const proof = evidence.proof;
  if (proof.type === 'prescription') {
    return prescriptionProofStillVisible(workout, proof.rows);
  }
  if (proof.type === 'recovery_addon') {
    const current = new Set((workout.recoveryAddons ?? []).map((addon) => addon.focusArea));
    return proof.focusAreas.length > 0 && proof.focusAreas.every((focus) => current.has(focus));
  }
  const shapeStillVisible = workout.name === proof.name &&
    workout.workoutType === proof.workoutType &&
    workout.sessionTier === proof.sessionTier &&
    workout.conditioningCategory === proof.conditioningCategory &&
    workout.exercises.map((row) => row.exercise?.name ?? row.exerciseId).join('\u0000') ===
      proof.exerciseNames.join('\u0000') &&
    !!workout.speedBlock === proof.hasSpeedBlock &&
    !!workout.powerBlock === proof.hasPowerBlock;
  if (!shapeStillVisible) return false;
  if (evidence.reason === 'early_offseason' || evidence.reason === 'mid_offseason') {
    return proof.hasConditioningComponent &&
      proof.conditioningModalities.length > 0 &&
      proof.conditioningModalities.every((modality) => modality !== 'run');
  }
  return true;
}

function mondayFor(dateISO: string): string {
  const [year, month, day] = dateISO.slice(0, 10).split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  const offset = date.getDay() === 0 ? -6 : 1 - date.getDay();
  date.setDate(date.getDate() + offset);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function copyFor(reason: DeterministicCoachNoteEffectReason): { title: string; body: string } {
  switch (reason) {
    case 'adaptation_reduced':
      return {
        title: 'Training adaptation active',
        body: 'Your strength prescription was reduced after the last session felt hard.',
      };
    case 'adaptation_held':
      return {
        title: 'Training adaptation active',
        body: 'Your strength prescription was adjusted based on your latest session feedback.',
      };
    case 'adaptation_increased':
      return {
        title: 'Training adaptation active',
        body: 'Your strength prescription moved up slightly after the last session went well.',
      };
    case 'beginner_conservative_prescription':
      return {
        title: 'Beginner dose active',
        body: 'Strength sets, loads and effort targets are being kept simple and conservative.',
      };
    case 'testing_lower_strength':
      return {
        title: 'Testing focus active',
        body: 'Lower-body strength was nudged slightly based on your testing profile.',
      };
    case 'testing_upper_strength':
      return {
        title: 'Testing focus active',
        body: 'Upper-body strength was nudged slightly based on your testing profile.',
      };
    case 'testing_aerobic':
      return {
        title: 'Testing focus active',
        body: 'Aerobic or tempo work was nudged slightly based on your testing profile.',
      };
    case 'testing_speed':
      return {
        title: 'Testing focus active',
        body: 'Speed preparation was nudged slightly based on your testing profile.',
      };
    case 'testing_robustness':
      return {
        title: 'Testing focus active',
        body: 'Prehab support was prioritised slightly based on your testing profile.',
      };
    case 'early_offseason':
      return {
        title: 'Early off-season focus',
        body: 'Conditioning stays lighter and off-feet this week while you rebuild.',
      };
    case 'mid_offseason':
      return {
        title: 'Mid off-season focus',
        body: 'Controlled conditioning stays mostly off-feet while running returns gradually.',
      };
    case 'late_offseason':
      return {
        title: 'Late off-season focus',
        body: 'Sharper running or conditioning is being reintroduced gradually this week.',
      };
    case 'early_preseason':
      return {
        title: 'Early pre-season focus',
        body: 'A hard conditioning dose was reduced while your running base builds this week.',
      };
    case 'mid_preseason':
      return {
        title: 'Mid pre-season focus',
        body: 'Strength and conditioning both carry meaningful work in this build week.',
      };
    case 'late_preseason':
      return {
        title: 'Late pre-season focus',
        body: 'A hard conditioning dose was reduced to protect freshness this week.',
      };
    case 'bye_recovery':
      return {
        title: 'Bye-week recovery active',
        body: 'The bye is being used to reduce fatigue while keeping useful training rhythm.',
      };
    case 'bye_build':
      return {
        title: 'Bye-week plan active',
        body: 'The bye is being used for a controlled training top-up while game-week intensity is out.',
      };
  }
}

/**
 * One central truth gate for generated/system Coach Notes. Evidence must both
 * exist and still match the visible workout. Notes are derived, week-scoped,
 * deduped by effect kind, and intentionally non-clearable.
 */
export function buildDeterministicCoachNoteDescriptors(
  days: readonly DeterministicCoachNoteVisibleDay[] | null | undefined,
): DeterministicCoachNoteDescriptor[] {
  if (!days?.length) return [];
  const weekStart = mondayFor(days[0].date);
  const byKind = new Map<DeterministicCoachNoteEffectEvidence['kind'], DeterministicCoachNoteEffectEvidence>();
  for (const day of days) {
    const workout = day.workout;
    if (!workout) continue;
    for (const evidence of workout.deterministicCoachNoteEvidence ?? []) {
      if (!evidenceStillVisible(workout, evidence)) continue;
      if (!byKind.has(evidence.kind)) byKind.set(evidence.kind, evidence);
    }
  }
  return Array.from(byKind.values()).map((evidence) => {
    const copy = copyFor(evidence.reason);
    const sourceId = `${evidence.kind}:${weekStart}`;
    return {
      sourceId,
      lifecycleKey: `program_effect:${sourceId}`,
      title: copy.title,
      body: copy.body,
      affects: ['current_week'],
    };
  });
}
