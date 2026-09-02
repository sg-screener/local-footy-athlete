import type { CapacityBand } from '../types/domain';
import type { OffseasonConditioningCategory } from './offseasonSubphasePolicy';
import type { PreseasonSubphase } from './preseasonSubphase';

export type PreseasonConditioningCategory = OffseasonConditioningCategory;

export interface PreseasonSubphasePolicyContext {
  capacity?: CapacityBand | null;
  teamTrainingExposures?: number | null;
  hasPracticeMatch?: boolean;
}

export interface PreseasonSubphasePolicy {
  readonly subphase: PreseasonSubphase;
  readonly conditioning: Readonly<{
    categoryPriority: readonly PreseasonConditioningCategory[];
    hardSessionCap: number;
    targetCap: number;
    minimumAppExposures: number;
    hardDose: 'standard' | 'reduced';
  }>;
  readonly speedSprint: Readonly<{
    targetExposures: number;
    practiceMatchSatisfiesTarget: boolean;
  }>;
  readonly strength: Readonly<{
    coreSessionCap: number;
    volumeBias: 'moderate' | 'build' | 'controlled';
  }>;
  readonly sessions: Readonly<{
    combinedStrengthConditioning: 'avoid' | 'normal';
  }>;
  readonly reasons: readonly string[];
}

/**
 * The low-capacity overlay: DOSE ONLY (Sam's readiness law, 2026-07-28).
 *
 * Six of this branch's nine statements were structure and have left it:
 *
 *   - `strength.coreSessionCap`, `conditioning.targetCap` — counts. The week's
 *     exposure counts belong to the phase contract.
 *   - `conditioning.minimumAppExposures: 0` — a floor readiness can zero is not
 *     a floor.
 *   - `conditioning.hardSessionCap: 0` — reads as an intensity cap, but the same
 *     predicate produces `injuryAllowsSprint` in the engine, so it denied the
 *     standalone sprint outright.
 *   - `speedSprint.targetExposures: 0` — Bible Section 2 sets a year-round floor
 *     of one sprint/high-speed exposure and requires an explicit typed
 *     authorised reason for any reduction below it. Low readiness was never one,
 *     and Sam confirmed the floor stands.
 *   - `sessions.combinedStrengthConditioning: 'avoid'` — suppresses the engine's
 *     H5a conversion, the safety net that enforces the conditioning floor.
 *
 * What remains shrinks work that still happens: an easier category order, a
 * reduced hard dose, and a controlled strength volume.
 */
export function getPreseasonSubphasePolicy(
  subphase: PreseasonSubphase,
  context: PreseasonSubphasePolicyContext = {},
): PreseasonSubphasePolicy {
  const teamTrainingExposures = Math.max(0, Math.floor(context.teamTrainingExposures ?? 0));
  const hasPracticeMatch = context.hasPracticeMatch === true;
  const base = basePolicy(subphase, teamTrainingExposures, hasPracticeMatch);
  if (context.capacity !== 'low') return base;

  return {
    ...base,
    conditioning: {
      ...base.conditioning,
      categoryPriority: ['aerobic_base'],
      hardDose: 'reduced',
    },
    strength: {
      ...base.strength,
      volumeBias: 'controlled',
    },
    reasons: [
      ...base.reasons,
      'Low capacity keeps every exposure and makes it easier: easy aerobic conditioning first, '
      + 'a reduced hard dose, and controlled strength volume.',
    ],
  };
}

function basePolicy(
  subphase: PreseasonSubphase,
  teamTrainingExposures: number,
  hasPracticeMatch: boolean,
): PreseasonSubphasePolicy {
  const anchorExposures = teamTrainingExposures + (hasPracticeMatch ? 1 : 0);
  const minimumAppExposures = Math.max(0, 4 - anchorExposures);
  if (subphase === 'early_preseason') {
    return {
      subphase,
      conditioning: {
        categoryPriority: ['aerobic_base', 'tempo', 'vo2'],
        hardSessionCap: 1,
        targetCap: 4,
        minimumAppExposures,
        hardDose: 'reduced',
      },
      speedSprint: {
        targetExposures: 1,
        practiceMatchSatisfiesTarget: true,
      },
      strength: {
        coreSessionCap: 4,
        volumeBias: 'moderate',
      },
      sessions: {
        combinedStrengthConditioning: 'normal',
      },
      reasons: [
        'Early pre-season rebuilds running and conditioning progressively from aerobic and tempo work.',
        'One controlled hard-conditioning exposure is enough; remaining conditioning uses lower-cost prescriptions.',
        'Team training or a practice match supplies the first sprint/COD exposure.',
      ],
    };
  }

  if (subphase === 'mid_preseason') {
    return {
      subphase,
      conditioning: {
        categoryPriority: ['vo2', 'glycolytic', 'aerobic_base', 'sprint'],
        hardSessionCap: 1,
        targetCap: 4,
        minimumAppExposures,
        hardDose: 'standard',
      },
      speedSprint: {
        targetExposures: 1,
        practiceMatchSatisfiesTarget: true,
      },
      strength: {
        coreSessionCap: 4,
        volumeBias: 'build',
      },
      sessions: {
        combinedStrengthConditioning: 'normal',
      },
      reasons: [
        'Mid pre-season is the main strength and conditioning build.',
        'Team training owns field load and app conditioning fills genuine exposure gaps.',
      ],
    };
  }

  return {
    subphase,
    conditioning: {
      categoryPriority: ['tempo', 'aerobic_base', 'vo2', 'repeat_sprint', 'glycolytic'],
      hardSessionCap: hasPracticeMatch || teamTrainingExposures >= 2 ? 0 : 1,
      targetCap: 4,
      minimumAppExposures,
      hardDose: 'reduced',
    },
    speedSprint: {
      targetExposures: 1,
      practiceMatchSatisfiesTarget: true,
    },
    strength: {
      coreSessionCap: 4,
      volumeBias: 'controlled',
    },
    sessions: {
      combinedStrengthConditioning: hasPracticeMatch ? 'avoid' : 'normal',
    },
    reasons: [
      'Late pre-season is shorter and sharper, with lower soreness cost and controlled strength volume.',
      'Two team sessions or a practice match remove the need for extra hard conditioning.',
      'A practice match supplies the game-like sprint/COD exposure, so no app sprint top-up is added.',
    ],
  };
}
