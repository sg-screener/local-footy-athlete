import type { CapacityBand } from '../types/domain';
import type { OffseasonSubphase } from './offseasonSubphase';

export type OffseasonConditioningCategory =
  | 'aerobic_base'
  | 'tempo'
  | 'sprint'
  | 'vo2'
  | 'glycolytic'
  /**
   * COD / DECELERATION — Sam's ruling, and it had no category until 2026-08-13.
   * `CONDITIONING_FRAMEWORK_SAM_2026-07-25.md:121`, Bible `:1440`: prescribed in
   * weeks with NO TEAM TRAINING and cut first when something has to give.
   * It is AVAILABLE, never MUST-COVER — see `mustCoverCategories`.
   */
  | 'cod_decel';

// `blocked_low_readiness` is RETIRED from both unions (Sam's readiness law,
// 2026-07-28). Leaving the word in the vocabulary leaves somewhere for the block
// to come back to; a subphase policy may only be blocked by its SUBPHASE.
export type OffseasonRunningPolicy =
  | 'blocked_by_default'
  | 'careful_reentry_if_healthy'
  | 'gradual_reentry';

export type OffseasonSpeedSprintPolicy =
  | 'blocked_by_default'
  | 'existing_late_offseason_gate';

export interface OffseasonSubphasePolicyContext {
  capacity?: CapacityBand | null;
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

/**
 * The low-capacity overlay: DOSE ONLY (Sam's readiness law, 2026-07-28).
 *
 * This branch used to carry five structural statements alongside its dose ones,
 * and the census warned that deleting the branch wholesale would take a
 * legitimate dose-down with it. So the branch survives and the structure leaves
 * it, field by field:
 *
 *   - `hardSessionCap: 0` — LEFT. It reads as an intensity cap, and for the
 *     conditioning priority list it is one (a filtered-out category falls back
 *     to `aerobic_base`, same session, easier). But the same predicate is the
 *     producer of `injuryAllowsSprint` in the engine, so a zero cap denied the
 *     standalone SPRINT — a distinct exposure with a year-round Bible floor of
 *     one and a typed-reason requirement below it. The aerobic-only category
 *     list below already delivers the intensity intent without that side door.
 *   - `running.*: false` / `speedSprint.*: false` — LEFT. Readiness must not
 *     write "blocked". The off-feet OUTCOME is unchanged: with the policy at
 *     base, `policyRequiresOffFeetAerobic` still answers off-feet for a
 *     low-capacity athlete through its own (dose) readiness edge.
 *   - `coreBias: 'reduced'` — LEFT. A declared core-session count cut.
 *   - `lowAvailabilityCombinedDays: 'avoid'` — LEFT. It suppresses the engine's
 *     H5a conversion, which is the safety net that enforces the weekly
 *     conditioning floor; avoiding combined days there drops exposures.
 *
 * What stays is what shrinks work that still happens: an easier category, an
 * off-feet modality, a lower RPE ceiling, and more optional support.
 */
export function getOffseasonSubphasePolicy(
  subphase: OffseasonSubphase,
  context: OffseasonSubphasePolicyContext = {},
): OffseasonSubphasePolicy {
  const base = BASE_POLICIES[subphase];
  if (context.capacity !== 'low') return base;

  return {
    ...base,
    conditioning: {
      ...base.conditioning,
      // Intensity, not count: the week keeps the same number of conditioning
      // sessions and they become easy aerobic.
      allowedCategories: ['aerobic_base'],
      defaultCategory: 'aerobic_base',
      modalityBias: 'off_feet',
    },
    strength: {
      ...base.strength,
      targetRpeMax: Math.min(base.strength.targetRpeMax, 7),
    },
    sessions: {
      ...base.sessions,
      optionalSupportBias: 'high',
    },
    reasons: [
      ...base.reasons,
      'Low capacity keeps every session and makes them easier: off-feet aerobic conditioning, '
      + 'a lower strength RPE ceiling, and wider optional support work.',
    ],
  };
}
