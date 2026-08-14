/**
 * WHICH WORLDS THE COMPOSER OWNS — the migration boundary, and the ONLY place
 * that names a configuration.
 *
 * **IT IS SEPARATE FROM `composeWeek` ON PURPOSE.** The composer must contain no
 * branch keyed to a world's identity: it takes typed inputs and composes from
 * them, so it cannot overfit to the world CP1 happens to prove. Deciding WHICH
 * worlds are migrated is a different question, it belongs to the migration, and
 * putting it here makes "the composer never asks which world this is" a property
 * a cell can check by import graph rather than by reading.
 *
 * **CP1 admits exactly one configuration** — full gym, two-day pre-season with a
 * club night, week 1 — which is one of the six worlds the 180-world sweep
 * refuses. The other five are CP2's, and every other world keeps the legacy
 * route byte-for-byte.
 */

export interface ComposedRouteWorld {
  readonly seasonPhase: string | null | undefined;
  readonly trainingDayCount: number;
  readonly teamTrainingDayCount: number;
  readonly kit: readonly string[];
  readonly weekNumber: number;
}

/**
 * THE SHAPE THE COMPOSER WAS RULED FOR — an athlete whose only available gym
 * days are club nights. Sam's full-body ruling is about exactly this athlete,
 * and it is a typed fact about the plan, not a world name.
 */
function everyGymDayIsAClubNight(world: ComposedRouteWorld): boolean {
  return world.trainingDayCount === 2
    && world.teamTrainingDayCount === world.trainingDayCount;
}

/**
 * ⚠ WHAT CP2 ADMITS, AND WHY IT IS A STAGING LIST RATHER THAN A RULE.
 *
 * The RULED shape (`everyGymDayIsAClubNight`) is phase-, kit- and week-blind, and
 * that is the boundary the composer will eventually own outright. **CP2 was
 * authorised for seven worlds, not eighteen**, so admission is deliberately
 * narrowed on top of the ruled shape:
 *
 *   - the six-world refusal family — pre-season, weeks 1 and 2, all three kits;
 *   - ONE in-season dumbbells world that already builds, as the non-refusal
 *     control, so the migration is measured against a world with something to
 *     lose as well as against worlds with nothing.
 *
 * **THE NARROWING IS THE MIGRATION'S, NOT THE PRODUCT'S.** It disappears in CP3
 * when the legacy content path is deleted; nothing downstream reads it, and the
 * composer cannot see it at all.
 */
function isDumbbellClassKit(kit: readonly string[]): boolean {
  return kit.includes('dumbbells') && !kit.includes('barbell');
}

export function composedRouteAdmits(world: ComposedRouteWorld): boolean {
  if (!everyGymDayIsAClubNight(world)) return false;
  // ⚠ EVERY WEEK OF THE BLOCK, NOT JUST THE TWO MEASURED. Building week 2 builds
  // the whole block, and one unmigrated week throws the entire call — so
  // admitting only weeks 1 and 2 left all three week-2 worlds still refused.
  // Measured: the sweep sat at 177/3 until this line dropped its week test.
  if (world.seasonPhase === 'Pre-season') return true;
  // The non-refusal control, and only it.
  return world.seasonPhase === 'In-season'
    && world.weekNumber === 1
    && isDumbbellClassKit(world.kit);
}
