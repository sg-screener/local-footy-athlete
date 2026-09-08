import { POOL_REGISTRY, type PoolExercise } from '../data/exercisePools';
import type { Workout } from '../types/domain';
import type { DecisionLedgerEntry } from '../types/decisionLedger';
import type { ExercisePrescriptionPayload } from '../types/programControlAction';
import { canonicalWeeklyExerciseEditStateFrom } from '../rules/canonicalWeeklyExerciseEditState';
import { canonicalExerciseName } from './exerciseCanonicalisation';
import type { MobilityPrehabFlow } from './mobilityPrehabFlow';
import type { AthleteContext } from './sessionBuilder';
import { injuryAllowsContextExercise } from '../rules/datedAthleteContext';

type DerivedKind = 'mobility_flow' | 'recovery_addon';

type DerivedDecision = {
  kind: 'swap' | 'remove';
  sourceKind: DerivedKind;
  sourceId: string;
  exerciseName: string;
  replacement?: ExercisePrescriptionPayload;
};

function decisionsOn(
  entries: readonly DecisionLedgerEntry[],
  date: string,
  sourceKind: DerivedKind,
): DerivedDecision[] {
  const decisions: DerivedDecision[] = [];
  const targetDate = date.slice(0, 10);
  const parsed = new Date(`${targetDate}T12:00:00`);
  parsed.setDate(parsed.getDate() - ((parsed.getDay() + 6) % 7));
  const weekStartISO = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`
    + `-${String(parsed.getDate()).padStart(2, '0')}`;
  const state = canonicalWeeklyExerciseEditStateFrom({ weekStartISO, entries });
  for (const edit of state.edits) {
    if (edit.kind !== 'swap' && edit.kind !== 'remove') continue;
    if (edit.dateISO !== targetDate || edit.derivedSource?.kind !== sourceKind) continue;
    decisions.push(edit.kind === 'swap'
      ? {
          kind: 'swap',
          sourceKind,
          sourceId: edit.derivedSource.id,
          exerciseName: edit.targetName,
          replacement: edit.replacement,
        }
      : {
          kind: 'remove',
          sourceKind,
          sourceId: edit.derivedSource.id,
          exerciseName: edit.targetName,
        });
  }
  return decisions;
}

const POOL_BY_NAME: ReadonlyMap<string, PoolExercise> = (() => {
  const map = new Map<string, PoolExercise>();
  for (const pool of Object.values(POOL_REGISTRY)) {
    for (const exercise of pool) map.set(canonicalExerciseName(exercise.name), exercise);
  }
  return map;
})();

function excluded(name: string, excludedNames: readonly string[]): boolean {
  const wanted = canonicalExerciseName(name);
  return excludedNames.some((candidate) => canonicalExerciseName(candidate) === wanted);
}

/**
 * Apply ledger decisions to the D17 flow at read time.
 *
 * The flow remains derived. A quick edit is a decision in the existing ledger,
 * not a copied flow saved beside it. Replacements retain the original slot id,
 * which is what lets the same button advance to the next-ranked option.
 */
export function applyMobilityFlowExerciseDecisions(args: {
  athlete?: AthleteContext;
  flow: MobilityPrehabFlow | null;
  date: string;
  entries: readonly DecisionLedgerEntry[];
  excludedExerciseNames?: readonly string[];
}): MobilityPrehabFlow | null {
  if (!args.flow) return null;
  const byId = new Map<string, DerivedDecision>();
  for (const decision of decisionsOn(args.entries, args.date, 'mobility_flow')) {
    byId.set(decision.sourceId, decision);
  }
  const excludedNames = args.excludedExerciseNames ?? [];
  const movements = args.flow.movements.flatMap((movement) => {
    const sourceId = `mobility:${movement.exercise.id}`;
    const decision = byId.get(sourceId);
    if (decision?.kind === 'remove') return [];
    if (decision?.kind !== 'swap' || !decision.replacement) {
      return excluded(movement.exercise.name, excludedNames) ? [] : [movement];
    }

    const authored = POOL_BY_NAME.get(canonicalExerciseName(decision.replacement.name));
    const replacement: PoolExercise = {
      ...(authored ?? movement.exercise),
      // Slot identity survives; content changes.
      id: movement.exercise.id,
      name: decision.replacement.name,
      sets: decision.replacement.sets,
      repsMin: decision.replacement.repsMin,
      repsMax: decision.replacement.repsMax,
      ...(decision.replacement.prescriptionType
        ? { prescriptionType: decision.replacement.prescriptionType }
        : {}),
      ...(decision.replacement.perSide !== undefined
        ? { perSide: decision.replacement.perSide }
        : {}),
      ...(decision.replacement.restSeconds !== undefined
        ? { restSeconds: decision.replacement.restSeconds }
        : {}),
    };
    return excluded(replacement.name, excludedNames) ? [] : [{ ...movement, exercise: replacement }];
  }).filter(movement=>injuryAllowsContextExercise(movement.exercise.name,args.athlete,args.date));
  if (movements.length === 0) return null;
  return { ...args.flow, movements, movementCount: movements.length };
}

function addonPrescription(replacement: ExercisePrescriptionPayload): string {
  const high = replacement.repsMax ?? replacement.repsMin;
  const suffix = replacement.prescriptionType === 'duration_minutes'
    ? ' min'
    : replacement.prescriptionType === 'duration' ? 's' : '';
  return `${replacement.sets} × ${high}${suffix}`;
}

/** Project optional recovery rows through the same ledger decisions. */
export function applyRecoveryAddonExerciseDecisions(args: {
  athlete?: AthleteContext;
  workout: Workout;
  date: string;
  entries: readonly DecisionLedgerEntry[];
  excludedExerciseNames?: readonly string[];
}): Workout {
  const decisions = decisionsOn(args.entries, args.date, 'recovery_addon');
  if (!args.athlete && decisions.length === 0 && (args.excludedExerciseNames ?? []).length === 0) {
    return args.workout;
  }
  const byId = new Map(decisions.map((decision) => [decision.sourceId, decision]));
  const excludedNames = args.excludedExerciseNames ?? [];
  return {
    ...args.workout,
    recoveryAddons: (args.workout.recoveryAddons ?? []).map((addon) => ({
      ...addon,
      exercises: addon.exercises.flatMap((exercise) => {
        const id = String((exercise as { id?: string }).id ?? '');
        const name = String((exercise as { name?: string }).name ?? '');
        const decision = byId.get(id);
        if (decision?.kind === 'remove') return [];
        if (decision?.kind !== 'swap' || !decision.replacement) {
          return excluded(name, excludedNames) ? [] : [exercise];
        }
        if (excluded(decision.replacement.name, excludedNames)) return [];
        return [{
          ...exercise,
          id,
          name: decision.replacement.name,
          prescription: addonPrescription(decision.replacement),
        }];
      }).filter(exercise=>injuryAllowsContextExercise(exercise.name,args.athlete,args.date)),
    })),
  };
}
