/** Typed accepted content placement used after legacy ingress has lifted old data. */
import type { Workout } from '../types/domain';

export interface CanonicalAcceptedDayPlacementEffect {
  readonly kind: 'accepted_day_placement';
  readonly source: 'legacy_migrated_day_placement';
  readonly sourceEntryId: string;
  readonly acceptedAt: string;
  readonly dateISO: string;
  readonly workout: Workout;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Pure ledger-order fold. A later accepted placement on one date wins. */
export function compileCanonicalDayPlacementEffects(args: {
  readonly dateOverrides: Readonly<Record<string, Workout>>;
  readonly effects: readonly CanonicalAcceptedDayPlacementEffect[];
}): Record<string, Workout> {
  const dateOverrides = clone({ ...args.dateOverrides });
  for (const effect of args.effects) {
    dateOverrides[effect.dateISO] = {
      ...clone(effect.workout),
      dayOfWeek: new Date(`${effect.dateISO}T12:00:00`).getDay(),
    };
  }
  return dateOverrides;
}
