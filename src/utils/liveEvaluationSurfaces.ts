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
import type { AcceptedEffectiveWeekSurfaces } from '../rules/acceptedEffectiveWeek';

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
export function freshGenerationSurfaces(): AcceptedEffectiveWeekSurfaces {
  return {
    currentProgram: null,
    currentMicrocycle: null,
    dateOverrides: {},
    weekScopedOverlays: {},
    userRemovalConstraints: [],
  };
}

export function liveAcceptedEffectiveWeekSurfaces(): AcceptedEffectiveWeekSurfaces {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const store = require('../store/programStore') as
      typeof import('../store/programStore');
    const state = store.useProgramStore.getState();
    return {
      currentProgram: state.currentProgram ?? null,
      currentMicrocycle: state.currentMicrocycle ?? null,
      dateOverrides: state.dateOverrides ?? {},
      weekScopedOverlays: state.weekScopedOverlays ?? {},
      userRemovalConstraints: state.userRemovalConstraints ?? [],
    };
  } catch {
    return {
      currentProgram: null,
      currentMicrocycle: null,
      dateOverrides: {},
      weekScopedOverlays: {},
      userRemovalConstraints: [],
    };
  }
}
