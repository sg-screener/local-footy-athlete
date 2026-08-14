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
import { kitUnachievablePatterns } from './composeWeek';

export interface ComposedRouteWorld {
  readonly seasonPhase: string | null | undefined;
  readonly trainingDayCount: number;
  readonly teamTrainingDayCount: number;
  readonly kit: readonly string[];
  readonly weekNumber: number;
}

/**
 * A FULL GYM STATED IN TAGS, not in the checklist label that produced them. The
 * label is an onboarding answer; the tags are what the athlete can actually do,
 * and they are what the composer and the sheet both read.
 */
function isFullGymKit(kit: readonly string[]): boolean {
  return kitUnachievablePatterns(kit).length === 0
    && ['barbell', 'rack', 'bench', 'pullup_bar', 'cables', 'dumbbells']
      .every((tag) => kit.includes(tag));
}

export function composedRouteAdmits(world: ComposedRouteWorld): boolean {
  return world.seasonPhase === 'Pre-season'
    && world.trainingDayCount === 2
    && world.teamTrainingDayCount > 0
    && world.weekNumber === 1
    && isFullGymKit(world.kit);
}
