import type { ReadinessLevel } from '../types/domain';
import type { OffseasonSubphase } from './offseasonSubphase';

export type OffseasonConditioningCategory =
  | 'aerobic_base'
  | 'tempo'
  | 'sprint'
  | 'vo2'
  | 'glycolytic';

export type OffseasonRunningPolicy =
  | 'blocked_by_default'
  | 'careful_reentry_if_healthy'
  | 'gradual_reentry'
  | 'blocked_low_readiness';

export type OffseasonSpeedSprintPolicy =
  | 'blocked_by_default'
  | 'existing_late_offseason_gate'
  | 'blocked_low_readiness';

export interface OffseasonSubphasePolicyContext {
  readiness?: ReadinessLevel | null;
}

export interface OffseasonSubphasePolicy {
  readonly subphase: OffseasonSubphase;
  readonly conditioning: Readonly<{
    allowedCategories: readonly OffseasonConditioningCategory[];
    defaultCategory: OffseasonConditioningCategory;
    hardSessionCap: number;
    modalityBias: 'off_feet' | 'off_feet_preferred' | 'mixed';
  }>;
  readonly running: Readonly<{
    allowedBySubphase: boolean;
    enabledByDefault: boolean;
    policy: OffseasonRunningPolicy;
  }>;
  readonly speedSprint: Readonly<{
    allowedBySubphase: boolean;
    policy: OffseasonSpeedSprintPolicy;
  }>;
  readonly strength: Readonly<{
    repBias: 'body_armour_8_12' | 'bridge_6_10' | 'strength_6_8';
    repsMin: number;
    repsMax: number;
    targetRpeMin: number;
    targetRpeMax: number;
  }>;
  readonly sessions: Readonly<{
    coreBias: 'reduced' | 'balanced' | 'build';
    optionalSupportBias: 'high' | 'moderate' | 'normal';
    lowAvailabilityCombinedDays: 'avoid' | 'cautious' | 'normal';
  }>;
  readonly reasons: readonly string[];
}

const BASE_POLICIES: Readonly<Record<OffseasonSubphase, OffseasonSubphasePolicy>> = {
  early_offseason: {
    subphase: 'early_offseason',
    conditioning: {
      allowedCategories: ['aerobic_base'],
      defaultCategory: 'aerobic_base',
      hardSessionCap: 0,
      modalityBias: 'off_feet',
    },
    running: {
      allowedBySubphase: false,
      enabledByDefault: false,
      policy: 'blocked_by_default',
    },
    speedSprint: {
      allowedBySubphase: false,
      policy: 'blocked_by_default',
    },
    strength: {
      repBias: 'body_armour_8_12',
      repsMin: 8,
      repsMax: 12,
      targetRpeMin: 6,
      targetRpeMax: 7,
    },
    sessions: {
      coreBias: 'reduced',
      optionalSupportBias: 'high',
      lowAvailabilityCombinedDays: 'avoid',
    },
    reasons: [
      'Early off-season prioritises low-intensity movement, aerobic base and recovery.',
      'Running, sprint/COD and hard conditioning stay out by default for the first 1-2 weeks.',
      'Strength uses 8-12 rep body-armour work around RPE 6-7.',
    ],
  },
  mid_offseason: {
    subphase: 'mid_offseason',
    conditioning: {
      allowedCategories: ['aerobic_base', 'tempo'],
      defaultCategory: 'aerobic_base',
      hardSessionCap: 0,
      modalityBias: 'off_feet_preferred',
    },
    running: {
      allowedBySubphase: true,
      enabledByDefault: false,
      policy: 'careful_reentry_if_healthy',
    },
    speedSprint: {
      allowedBySubphase: false,
      policy: 'blocked_by_default',
    },
    strength: {
      repBias: 'bridge_6_10',
      repsMin: 6,
      repsMax: 10,
      targetRpeMin: 6,
      targetRpeMax: 8,
    },
    sessions: {
      coreBias: 'balanced',
      optionalSupportBias: 'moderate',
      lowAvailabilityCombinedDays: 'cautious',
    },
    reasons: [
      'Mid off-season bridges aerobic base toward controlled tempo without default hard intervals.',
      'Running may re-enter carefully when health and readiness support it; sprint/COD remains blocked.',
      'Strength bridges through 6-10 reps before late off-season loading.',
    ],
  },
  late_offseason: {
    subphase: 'late_offseason',
    conditioning: {
      allowedCategories: ['aerobic_base', 'tempo', 'vo2', 'glycolytic', 'sprint'],
      defaultCategory: 'tempo',
      hardSessionCap: 1,
      modalityBias: 'mixed',
    },
    running: {
      allowedBySubphase: true,
      enabledByDefault: true,
      policy: 'gradual_reentry',
    },
    speedSprint: {
      allowedBySubphase: true,
      policy: 'existing_late_offseason_gate',
    },
    strength: {
      repBias: 'strength_6_8',
      repsMin: 6,
      repsMax: 8,
      targetRpeMin: 7,
      targetRpeMax: 8,
    },
    sessions: {
      coreBias: 'build',
      optionalSupportBias: 'normal',
      lowAvailabilityCombinedDays: 'normal',
    },
    reasons: [
      'Late off-season builds toward pre-season with gradual running and controlled hard conditioning.',
      'Speed and sprint work use the existing late off-season gate rather than becoming automatic.',
      'Strength can use the established 6-8 rep off-season scheme.',
    ],
  },
};

export function getOffseasonSubphasePolicy(
  subphase: OffseasonSubphase,
  context: OffseasonSubphasePolicyContext = {},
): OffseasonSubphasePolicy {
  const base = BASE_POLICIES[subphase];
  if (context.readiness !== 'low') return base;

  return {
    ...base,
    conditioning: {
      ...base.conditioning,
      allowedCategories: ['aerobic_base'],
      defaultCategory: 'aerobic_base',
      hardSessionCap: 0,
      modalityBias: 'off_feet',
    },
    running: {
      allowedBySubphase: false,
      enabledByDefault: false,
      policy: 'blocked_low_readiness',
    },
    speedSprint: {
      allowedBySubphase: false,
      policy: 'blocked_low_readiness',
    },
    strength: {
      ...base.strength,
      targetRpeMax: Math.min(base.strength.targetRpeMax, 7),
    },
    sessions: {
      coreBias: 'reduced',
      optionalSupportBias: 'high',
      lowAvailabilityCombinedDays: 'avoid',
    },
    reasons: [
      ...base.reasons,
      'Low readiness removes running, speed and hard conditioning while increasing support/recovery bias.',
    ],
  };
}
