/** Accepted exercise-edit decisions translated once into weekly semantic state. */
import type { DecisionLedgerEntry } from '../types/decisionLedger';
import type {
  DerivedExerciseSource,
  ExercisePrescriptionPayload,
} from '../types/programControlAction';
import { replayableEntries } from './decisionLedgerReplay';

export type CanonicalWeeklyExerciseEdit =
  | {
      readonly kind: 'swap';
      readonly decisionId: string;
      readonly occurredAt: string;
      readonly dateISO: string;
      readonly targetName: string;
      readonly targetComponentId: string | null;
      readonly replacement: ExercisePrescriptionPayload;
      readonly acceptedTarget?: import('./acceptedExerciseTarget').AcceptedExerciseTarget;
      readonly substitutedFrom?: {
        readonly baseExerciseName: string;
        readonly originExerciseName?: string;
        readonly cause: 'injury' | 'kit_today';
      };
      readonly derivedSource?: DerivedExerciseSource;
    }
  | {
      readonly kind: 'add';
      readonly additionId?: string;
      readonly additionFactVersions?: readonly string[];
      readonly decisionId: string;
      readonly occurredAt: string;
      readonly dateISO: string;
      readonly exercise: ExercisePrescriptionPayload;
    }
  | {
      readonly kind: 'remove';
      readonly decisionId: string;
      readonly occurredAt: string;
      readonly dateISO: string;
      readonly targetName: string;
      readonly targetComponentId: string | null;
      readonly derivedSource?: DerivedExerciseSource;
    };

export interface CanonicalWeeklyExerciseEditState {
  readonly kind: 'weekly_exercise_edits';
  readonly weekStartISO: string;
  readonly edits: readonly CanonicalWeeklyExerciseEdit[];
}

function addDays(dateISO: string, amount: number): string {
  const date = new Date(`${dateISO.slice(0, 10)}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    + `-${String(date.getDate()).padStart(2, '0')}`;
}

export function canonicalWeeklyExerciseEditStateFrom(args: {
  readonly weekStartISO: string;
  readonly entries: readonly DecisionLedgerEntry[];
  readonly targetUpgrades?: readonly DecisionLedgerEntry[];
}): CanonicalWeeklyExerciseEditState {
  const weekStartISO = args.weekStartISO.slice(0, 10);
  const weekEndISO = addDays(weekStartISO, 6);
  const edits: CanonicalWeeklyExerciseEdit[] = [];
  for (const entry of replayableEntries(args.entries)) {
    if (entry.decision.kind !== 'program_control') continue;
    const action = entry.decision.action;
    if (action.type === 'swap_exercise') {
      const dateISO = action.payload.date.slice(0, 10);
      if (dateISO < weekStartISO || dateISO > weekEndISO || !action.payload.toExercise) continue;
      edits.push({
        kind: 'swap', decisionId: entry.id, occurredAt: entry.occurredAt, dateISO,
        targetName: action.payload.fromExercise,
        targetComponentId: action.payload.fromExerciseId ?? null,
        replacement: action.payload.toExercise,
        acceptedTarget: action.payload.acceptedTarget ?? (args.targetUpgrades ?? args.entries)
          .flatMap(e => e.decision.kind === 'legacy_exercise_target_upgrade' && e.decision.sourceEntryId === entry.id ? [e.decision.acceptedTarget] : []).at(-1),
        ...(action.payload.substitutedFrom
          ? { substitutedFrom: action.payload.substitutedFrom }
          : {}),
        ...(action.payload.derivedSource
          ? { derivedSource: action.payload.derivedSource }
          : {}),
      });
    } else if (action.type === 'add_exercise') {
      const dateISO = action.payload.date.slice(0, 10);
      if (dateISO < weekStartISO || dateISO > weekEndISO || !action.payload.exercise) continue;
      edits.push({
        kind: 'add', decisionId: entry.id, occurredAt: entry.occurredAt, dateISO,
        exercise: action.payload.exercise, additionId: action.payload.additionId,
        additionFactVersions: action.payload.additionFactVersions,
      });
    } else if (action.type === 'remove_exercise') {
      const dateISO = action.payload.date.slice(0, 10);
      if (dateISO < weekStartISO || dateISO > weekEndISO) continue;
      edits.push({
        kind: 'remove', decisionId: entry.id, occurredAt: entry.occurredAt, dateISO,
        targetName: action.payload.exercise,
        targetComponentId: action.payload.exerciseId ?? null,
        ...(action.payload.derivedSource
          ? { derivedSource: action.payload.derivedSource }
          : {}),
      });
    }
  }
  return { kind: 'weekly_exercise_edits', weekStartISO, edits };
}
