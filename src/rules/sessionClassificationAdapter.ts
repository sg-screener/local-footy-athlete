/**
 * sessionClassificationAdapter.ts — shared read-only projection for visible
 * workouts.
 *
 * The canonical classification rules remain in sessionTaxonomy.ts and
 * stressClassification.ts. This adapter gives non-generation consumers one
 * API for reading those rules and the weekly-exposure contribution semantics
 * that used to be repeated inside individual reporters.
 *
 * It never mutates a workout, validates a week, or makes placement decisions.
 */

import type { Workout } from '../types/domain';
import {
  classifyDaySessions,
  CONDITIONING_CATEGORIES,
  MAIN_STRENGTH_CATEGORIES,
  type SessionCategory,
  type SessionUnit,
} from './sessionTaxonomy';
import {
  classifySessionStress,
  type StressContext,
  type StressLevel,
} from './stressClassification';

export type SessionRegion = 'lower' | 'upper' | 'full_body' | 'none';

/**
 * Conditioning ownership/dose is deliberately separate from weekly exposure
 * counting. A finisher remains a partial add-on even though the existing
 * weekly counter records the visible conditioning unit as one exposure.
 */
export type ConditioningRole =
  | 'none'
  | 'anchor'
  | 'standalone'
  | 'component'
  | 'finisher';

export type ConditioningCredit = 'none' | 'partial' | 'full';

export interface SessionClassificationContributions {
  hardExposures: number;
  /** One visible workout can create at most one hard calendar day. */
  hardDay: 0 | 1;
  mainStrength: number;
  conditioning: number;
  /** App-added conditioning only; excludes team training and games. */
  extraConditioning: number;
  running: number;
  sprintCod: number;
  teamAnchors: number;
  gameAnchors: number;
  gunshow: number;
  recovery: number;
}

export interface ClassifiedVisibleSessionUnit extends SessionUnit {
  stress: StressLevel;
  region: SessionRegion;
  conditioningRole: ConditioningRole;
  conditioningCredit: ConditioningCredit;
  contributions: Omit<SessionClassificationContributions, 'hardDay'>;
}

export interface VisibleSessionClassification {
  units: ClassifiedVisibleSessionUnit[];
  categories: SessionCategory[];
  stressLevel: StressLevel | null;
  strengthRegion: SessionRegion;
  conditioningRoles: ConditioningRole[];
  anchors: {
    teamTraining: boolean;
    game: boolean;
  };
  contributions: SessionClassificationContributions;
}

const STRESS_RANK: Record<StressLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

function unitRegion(category: SessionCategory): SessionRegion {
  switch (category) {
    case 'lower_strength': return 'lower';
    case 'upper_strength': return 'upper';
    case 'full_body_strength': return 'full_body';
    default: return 'none';
  }
}

function overallStrengthRegion(units: readonly ClassifiedVisibleSessionUnit[]): SessionRegion {
  const regions = new Set(units.map((unit) => unit.region).filter((region) => region !== 'none'));
  if (regions.has('full_body') || (regions.has('lower') && regions.has('upper'))) return 'full_body';
  if (regions.has('lower')) return 'lower';
  if (regions.has('upper')) return 'upper';
  return 'none';
}

function conditioningRole(
  unit: SessionUnit,
  workout: Workout,
  conditioningContribution: number,
): ConditioningRole {
  if (unit.category === 'game' || unit.category === 'team_training') return 'anchor';
  if (conditioningContribution === 0) return 'none';
  if (workout.attachedConditioningKind === 'component') return 'component';
  if (
    workout.attachedConditioningKind === 'finisher' ||
    workout.hasCombinedConditioning
  ) {
    return 'finisher';
  }
  return 'standalone';
}

function emptyUnitContributions(): Omit<SessionClassificationContributions, 'hardDay'> {
  return {
    hardExposures: 0,
    mainStrength: 0,
    conditioning: 0,
    extraConditioning: 0,
    running: 0,
    sprintCod: 0,
    teamAnchors: 0,
    gameAnchors: 0,
    gunshow: 0,
    recovery: 0,
  };
}

function contributionsForUnit(
  unit: SessionUnit,
  stress: StressLevel,
): Omit<SessionClassificationContributions, 'hardDay'> {
  const contributions = emptyUnitContributions();
  const onFeet = unit.modality === 'running' || unit.modality === 'mixed';
  const isAnchor = unit.category === 'game' || unit.category === 'team_training';
  const isAppConditioning =
    CONDITIONING_CATEGORIES.has(unit.category) ||
    (unit.category === 'sprint' && !onFeet);

  if (stress === 'high') contributions.hardExposures = 1;
  if (MAIN_STRENGTH_CATEGORIES.has(unit.category)) contributions.mainStrength = 1;
  if (unit.category === 'gunshow_prehab') contributions.gunshow = 1;
  if (unit.category === 'recovery') contributions.recovery = 1;
  if (unit.category === 'team_training') contributions.teamAnchors = 1;
  if (unit.category === 'game') contributions.gameAnchors = 1;

  if (isAnchor) contributions.running = 1;
  else if (unit.category === 'sprint' && onFeet) contributions.running = 1;
  else if (CONDITIONING_CATEGORIES.has(unit.category) && onFeet) contributions.running = 1;

  if (isAnchor) contributions.sprintCod = 1;
  else if (unit.category === 'sprint' && onFeet) contributions.sprintCod = 1;

  if (isAppConditioning) {
    contributions.conditioning = 1;
    contributions.extraConditioning = 1;
  } else if (isAnchor) {
    contributions.conditioning = 1;
  }

  return contributions;
}

function sumContributions(
  units: readonly ClassifiedVisibleSessionUnit[],
): SessionClassificationContributions {
  const total: SessionClassificationContributions = {
    ...emptyUnitContributions(),
    hardDay: units.some((unit) => unit.stress === 'high') ? 1 : 0,
  };

  for (const unit of units) {
    for (const key of Object.keys(unit.contributions) as Array<keyof typeof unit.contributions>) {
      total[key] += unit.contributions[key];
    }
  }
  return total;
}

/**
 * Classify one visible workout through the canonical taxonomy/stress kernel
 * and project all reporting/counting contributions in one place.
 */
export function classifyVisibleSession(
  workout: Workout | null | undefined,
  context: StressContext = {},
): VisibleSessionClassification {
  if (!workout) {
    return {
      units: [],
      categories: [],
      stressLevel: null,
      strengthRegion: 'none',
      conditioningRoles: [],
      anchors: { teamTraining: false, game: false },
      contributions: { ...emptyUnitContributions(), hardDay: 0 },
    };
  }

  const units = classifyDaySessions(workout).map((unit): ClassifiedVisibleSessionUnit => {
    const stress = classifySessionStress(unit, workout, context);
    const contributions = contributionsForUnit(unit, stress);
    const role = conditioningRole(unit, workout, contributions.conditioning);
    return {
      ...unit,
      stress,
      region: unitRegion(unit.category),
      conditioningRole: role,
      conditioningCredit: role === 'finisher' ? 'partial' : role === 'none' ? 'none' : 'full',
      contributions,
    };
  });

  const stressLevel = units.reduce<StressLevel | null>((highest, unit) => {
    if (!highest || STRESS_RANK[unit.stress] > STRESS_RANK[highest]) return unit.stress;
    return highest;
  }, null);

  return {
    units,
    categories: units.map((unit) => unit.category),
    stressLevel,
    strengthRegion: overallStrengthRegion(units),
    conditioningRoles: Array.from(new Set(
      units.map((unit) => unit.conditioningRole).filter((role) => role !== 'none'),
    )),
    anchors: {
      teamTraining: units.some((unit) => unit.category === 'team_training'),
      game: units.some((unit) => unit.category === 'game'),
    },
    contributions: sumContributions(units),
  };
}
