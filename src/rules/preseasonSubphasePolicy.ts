import type { ReadinessLevel } from '../types/domain';
import type { OffseasonConditioningCategory } from './offseasonSubphasePolicy';
import type { PreseasonSubphase } from './preseasonSubphase';

export type PreseasonConditioningCategory = OffseasonConditioningCategory;

export interface PreseasonSubphasePolicyContext {
  readiness?: ReadinessLevel | null;
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

export function getPreseasonSubphasePolicy(
  subphase: PreseasonSubphase,
  context: PreseasonSubphasePolicyContext = {},
): PreseasonSubphasePolicy {
  const teamTrainingExposures = Math.max(0, Math.floor(context.teamTrainingExposures ?? 0));
  const hasPracticeMatch = context.hasPracticeMatch === true;
  const base = basePolicy(subphase, teamTrainingExposures, hasPracticeMatch);
  if (context.readiness !== 'low') return base;

  return {
    ...base,
    conditioning: {
      categoryPriority: ['aerobic_base'],
      hardSessionCap: 0,
      targetCap: Math.min(base.conditioning.targetCap, 1),
      minimumAppExposures: 0,
      hardDose: 'reduced',
    },
    speedSprint: {
      ...base.speedSprint,
      targetExposures: 0,
    },
    strength: {
      coreSessionCap: Math.min(base.strength.coreSessionCap, 2),
      volumeBias: 'controlled',
    },
    sessions: {
      combinedStrengthConditioning: 'avoid',
    },
    reasons: [
      ...base.reasons,
      'Low readiness removes app-added hard conditioning and sprint top-ups and caps strength dose.',
    ],
  };
}

function basePolicy(
  subphase: PreseasonSubphase,
  teamTrainingExposures: number,
  hasPracticeMatch: boolean,
): PreseasonSubphasePolicy {
  if (subphase === 'early_preseason') {
    return {
      subphase,
      conditioning: {
        categoryPriority: ['aerobic_base', 'tempo', 'vo2'],
        hardSessionCap: 1,
        targetCap: teamTrainingExposures > 0 ? 2 : 3,
        minimumAppExposures: 1,
        hardDose: 'reduced',
      },
      speedSprint: {
        targetExposures: 1,
        practiceMatchSatisfiesTarget: true,
      },
      strength: {
        coreSessionCap: 3,
        volumeBias: 'moderate',
      },
      sessions: {
        combinedStrengthConditioning: 'avoid',
      },
      reasons: [
        'Early pre-season rebuilds running and conditioning progressively from aerobic and tempo work.',
        'One controlled hard-conditioning exposure is enough; large combined S+C days stay out.',
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
        minimumAppExposures: teamTrainingExposures > 0 ? 1 : 2,
        hardDose: 'standard',
      },
      speedSprint: {
        targetExposures: 2,
        practiceMatchSatisfiesTarget: false,
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
      categoryPriority: ['tempo', 'aerobic_base', 'vo2', 'glycolytic'],
      hardSessionCap: hasPracticeMatch || teamTrainingExposures >= 2 ? 0 : 1,
      targetCap: hasPracticeMatch ? 1 : teamTrainingExposures >= 2 ? 2 : 3,
      minimumAppExposures: hasPracticeMatch ? 0 : teamTrainingExposures > 0 ? 1 : 2,
      hardDose: 'reduced',
    },
    speedSprint: {
      targetExposures: 2,
      practiceMatchSatisfiesTarget: true,
    },
    strength: {
      coreSessionCap: 3,
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
