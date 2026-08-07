/**
 * THE LIVE WORLD, COMPOSED ONCE
 * (`docs/SURFACES_CONTEXT_RULING_2026-08-06.md`).
 *
 * The gateway's constraint input is no longer a bare optional array — it is
 * the EVALUATION CONTEXT, an `AcceptedEffectiveWeekSurfaces`, and it is
 * required. That closes the forgettable class structurally: a caller cannot
 * omit a parameter the type demands.
 *
 * What it does NOT do is decide what the truth is, because the truth is not
 * always the persisted store. A transaction staging an athlete's deletion or
 * move is composing a world that is not persisted yet, and that world is the
 * one its week must be judged against — a decision in flight is a decision
 * (`docs/CONSTRAINT_VISIBILITY_ENTRY_MEASUREMENT_2026-08-06.md`: 2,827 of
 * 8,528 entries). So every site passes the surfaces it MEANS.
 *
 * This is what a site means when it means "the world as persisted": the four
 * accepted surfaces read from the one store that owns them, in one place. It
 * is a composer, not a default — the only DEFAULTING to live is
 * `buildFixtureProjection`'s `args.sourceSurfaces ?? …`, which is the line the
 * ruling names and the only place a missing caller intent resolves silently.
 *
 * EMPTY IS TRUTH. A world with no removal decisions answers with an empty
 * array and says exactly that. The lie the measurement found was never an
 * empty answer — it was an absent parameter that read like one.
 */
import type {
  Microcycle,
  TrainingProgram,
  UserRemovalConstraint,
  Workout,
  WeekScopedWorkoutOverlay,
} from '../types/domain';
import type { AcceptedEffectiveWeekSurfaces } from '../rules/acceptedEffectiveWeek';

/**
 * THE ONE COMPOSER (`docs/REMOVAL_RECORD_SPLIT_RULING_2026-08-06.md`).
 *
 * The surfaces carry the athlete's removals TWICE, because two different
 * questions are asked of them: `userRemovalConstraints` is the APPLICATION
 * input, consumed and blanked once folded into composed workouts;
 * `removalDecisions` is the RECORD, never blanked, read only to explain why a
 * week looks the way it does.
 *
 * Two fields is one field more than the disease this unit has been treating,
 * so they are populated HERE, together, from one argument — the drift between
 * them would be a third representation and the exact thing the split is meant
 * to avoid. Every `AcceptedEffectiveWeekSurfaces` in the app is built through
 * this function; there is no other constructor.
 *
 * `applyOnly` is the one case where the two genuinely differ, and it is stated
 * by NAME rather than reached by accident: a delete composes from the world
 * where the binned target is still present (it is the relocation template)
 * while the record already carries the decision that binned it. A named
 * divergence is a decision; an unnamed one would be the drift.
 */
export function composeAcceptedEffectiveWeekSurfaces(source: {
  currentProgram: TrainingProgram | null;
  currentMicrocycle?: Microcycle | null;
  dateOverrides?: Readonly<Record<string, Workout>>;
  weekScopedOverlays?: Readonly<Record<string, WeekScopedWorkoutOverlay>>;
  /** THE athlete's removal decisions in this world — the single source. */
  removalDecisions: readonly UserRemovalConstraint[];
  /** The APPLICATION input when it is deliberately NOT the whole record. */
  applyOnly?: readonly UserRemovalConstraint[];
}): AcceptedEffectiveWeekSurfaces {
  return {
    currentProgram: source.currentProgram ?? null,
    currentMicrocycle: source.currentMicrocycle ?? null,
    dateOverrides: source.dateOverrides ?? {},
    weekScopedOverlays: source.weekScopedOverlays ?? {},
    userRemovalConstraints: source.applyOnly ?? source.removalDecisions,
    removalDecisions: source.removalDecisions,
  };
}

/**
 * The store is reached lazily, the way `programStore` already reaches the
 * gateway: at call time, never at module load, so neither side appears in the
 * other's module graph until a call is actually made.
 *
 * A harness that never mounts the store is not an error — it is a world with
 * no accepted surfaces, which is what the empty answer states.
 */
/**
 * THE WORLD A GENERATOR IS BUILDING, which has no accepted surfaces yet.
 *
 * MEASURED, NOT ASSUMED. The entry census counted 160 FORGOTTEN entries at
 * `generateProgram`'s gateway door and I read them as a defect — the store
 * holds the athlete's bins, so surely generation should honour them. Wiring it
 * to the live world refuted that in one cell: a REBUILD after a deletion
 * (`athleteSessionDeletionTests` regression 11) strips the binned day from a
 * freshly generated week and then refuses it outright, because generation
 * applies the SUBTRACTION without the COMPENSATION. The relocation that
 * answers a removal, and the typed reduction that authorises the shortfall,
 * are recorded by the mutation transaction — they are accepted state, and a
 * generator has none.
 *
 * So a generator means the world it is composing: no program, no overrides, no
 * overlays, no removals. That is not the forgotten case wearing a disguise —
 * the forgotten case could not be seen, and this is STATED, at one site, with
 * the cell that pays for it named. If generation should ever honour removals,
 * it must first acquire the repair that answers them, and this is the single
 * line that changes.
 */
/**
 * A WORLD WHOSE REMOVALS HAVE NOT BEEN CONSUMED — the persisted store, a
 * transaction's snapshot of it, an accepted surfaces bundle.
 *
 * In all of those the removal list is still the athlete's full record: the
 * blanking happens further in, inside one derivation, on a `ScheduleState`
 * that never travels back out. So the record and the application input are the
 * same list, and that is stated ONCE here rather than at each of the
 * twenty-four doors that pass such a world to the gateway.
 */
export function storedWorldSurfaces(source: {
  currentProgram: TrainingProgram | null;
  currentMicrocycle?: Microcycle | null;
  dateOverrides?: Readonly<Record<string, Workout>>;
  weekScopedOverlays?: Readonly<Record<string, WeekScopedWorkoutOverlay>>;
  userRemovalConstraints?: readonly UserRemovalConstraint[];
}): AcceptedEffectiveWeekSurfaces {
  return composeAcceptedEffectiveWeekSurfaces({
    currentProgram: source.currentProgram,
    currentMicrocycle: source.currentMicrocycle,
    dateOverrides: source.dateOverrides,
    weekScopedOverlays: source.weekScopedOverlays,
    removalDecisions: source.userRemovalConstraints ?? [],
  });
}

export function freshGenerationSurfaces(): AcceptedEffectiveWeekSurfaces {
  return composeAcceptedEffectiveWeekSurfaces({
    currentProgram: null,
    removalDecisions: [],
  });
}

export function liveAcceptedEffectiveWeekSurfaces(): AcceptedEffectiveWeekSurfaces {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const store = require('../store/programStore') as
      typeof import('../store/programStore');
    const state = store.useProgramStore.getState();
    return composeAcceptedEffectiveWeekSurfaces({
      currentProgram: state.currentProgram ?? null,
      currentMicrocycle: state.currentMicrocycle ?? null,
      dateOverrides: state.dateOverrides ?? {},
      weekScopedOverlays: state.weekScopedOverlays ?? {},
      removalDecisions: state.userRemovalConstraints ?? [],
    });
  } catch {
    return composeAcceptedEffectiveWeekSurfaces({
      currentProgram: null,
      removalDecisions: [],
    });
  }
}
