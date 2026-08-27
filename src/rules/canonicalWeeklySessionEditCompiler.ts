/** Pure ordered fold of exact accepted session-constraint effects. */
import type { UserRemovalConstraint } from '../types/domain';
import type { CalendarDayType } from '../store/calendarStore';
import type {
  CanonicalAcceptedSessionEditEffect,
  CanonicalSessionMutationIntent,
} from './canonicalWeeklySessionEditState';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function compileCanonicalSessionConstraintEffects(args: {
  readonly constraints: readonly UserRemovalConstraint[];
  readonly effects: readonly CanonicalAcceptedSessionEditEffect[];
}): UserRemovalConstraint[] {
  let constraints = clone([...args.constraints]);
  for (const effect of args.effects) {
    const removed = new Set(effect.removedConstraintIds);
    const restored = new Map(effect.restoredConstraints.map((entry) => [entry.id, entry]));
    const upserted = new Set(effect.upsertedConstraints.map((constraint) => constraint.id));
    constraints = constraints
      .filter((constraint) => !removed.has(constraint.id) && !upserted.has(constraint.id))
      .map((constraint) => {
        const restoration = restored.get(constraint.id);
        return restoration && constraint.status === 'active'
          ? {
              ...constraint,
              status: 'restored' as const,
              restoredAt: restoration.restoredAt,
              restorationReason: 'explicit_re_add' as const,
            }
          : constraint;
      });
    constraints.push(...clone(effect.upsertedConstraints));
  }
  return constraints;
}

export function canonicalAcceptedSessionEditEffectForConstraint(args: {
  readonly constraints: readonly UserRemovalConstraint[];
  readonly constraint: UserRemovalConstraint;
  readonly restoreConstraintIds?: readonly string[];
  readonly mutationIntent: CanonicalSessionMutationIntent;
  readonly affectedDates: readonly string[];
  readonly beforeMarkedDays: Readonly<Record<string, CalendarDayType>>;
  readonly afterMarkedDays: Readonly<Record<string, CalendarDayType>>;
}): CanonicalAcceptedSessionEditEffect {
  const restoreIds = new Set(args.restoreConstraintIds ?? []);
  const removedConstraintIds = args.constraints
    .filter((candidate) => candidate.id !== args.constraint.id && !restoreIds.has(candidate.id) &&
      candidate.status === 'active' &&
      candidate.targetDate === args.constraint.targetDate &&
      (args.constraint.scope === 'whole_session' || candidate.scope === args.constraint.scope))
    .map((candidate) => candidate.id);
  const markedDates = new Set([
    ...Object.keys(args.beforeMarkedDays),
    ...Object.keys(args.afterMarkedDays),
  ]);
  const markedDayChanges = [...markedDates]
    .filter((dateISO) => args.beforeMarkedDays[dateISO] !== args.afterMarkedDays[dateISO])
    .sort()
    .map((dateISO) => ({
      dateISO,
      value: args.afterMarkedDays[dateISO] ?? null,
    }));
  return {
    mutationIntent: args.mutationIntent,
    acceptedAt: args.constraint.createdAt,
    affectedDates: args.affectedDates.map((date) => date.slice(0, 10)),
    removedConstraintIds,
    restoredConstraints: [...restoreIds].map((id) => ({
      id,
      restoredAt: args.constraint.createdAt,
    })),
    upsertedConstraints: [clone(args.constraint)],
    markedDayChanges,
  };
}

export function canonicalAcceptedSessionEditEffectFromDiff(args: {
  readonly beforeConstraints: readonly UserRemovalConstraint[];
  readonly afterConstraints: readonly UserRemovalConstraint[];
  readonly beforeMarkedDays: Readonly<Record<string, CalendarDayType>>;
  readonly afterMarkedDays: Readonly<Record<string, CalendarDayType>>;
  readonly mutationIntent: CanonicalSessionMutationIntent;
  readonly affectedDates: readonly string[];
  readonly acceptedAt: string;
}): CanonicalAcceptedSessionEditEffect {
  const before = new Map(args.beforeConstraints.map((constraint) => [constraint.id, constraint]));
  const after = new Map(args.afterConstraints.map((constraint) => [constraint.id, constraint]));
  const removedConstraintIds = [...before.keys()].filter((id) => !after.has(id));
  const restoredConstraints = [...after.values()]
    .filter((constraint) => before.get(constraint.id)?.status === 'active' &&
      constraint.status === 'restored')
    .map((constraint) => ({
      id: constraint.id,
      restoredAt: constraint.restoredAt ?? args.acceptedAt,
    }));
  const upsertedConstraints = [...after.values()].filter((constraint) =>
    JSON.stringify(before.get(constraint.id)) !== JSON.stringify(constraint) &&
      constraint.status === 'active');
  const markedDates = new Set([
    ...Object.keys(args.beforeMarkedDays),
    ...Object.keys(args.afterMarkedDays),
  ]);
  return {
    mutationIntent: args.mutationIntent,
    acceptedAt: args.acceptedAt,
    affectedDates: args.affectedDates.map((date) => date.slice(0, 10)),
    removedConstraintIds,
    restoredConstraints,
    upsertedConstraints: clone(upsertedConstraints),
    markedDayChanges: [...markedDates]
      .filter((dateISO) => args.beforeMarkedDays[dateISO] !== args.afterMarkedDays[dateISO])
      .sort()
      .map((dateISO) => ({ dateISO, value: args.afterMarkedDays[dateISO] ?? null })),
  };
}
