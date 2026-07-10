/**
 * phaseRepSchemes.ts — Programming Bible main-lift set/rep tables as DATA.
 *
 * Consumed by the deterministic workout builder. Keep this as the single
 * source of truth for phase-aware strength prescriptions.
 *
 * Bible source: Section 5 (Strength programming rules).
 *   In-season:  main lifts 2-4 sets of 2-4 reps (3x3 base). Upper push
 *               closer to 3x5; pulls tolerate more (up to 3x6).
 *   Pre-season: 2-4 sets of 4-6 reps (3x5 base); pulls 4-8.
 *   Off-season: 2-4 sets of 6-8 reps (3x8 base); pulls 6-12;
 *               push 6-10 when the goal is muscle.
 *   Accessories: 2-3 x 8-15 (pump work 10-20); Nordics 2-3 x 3-5;
 *               timed holds 2-3 x 30-60s; carries 2-4 x 20-60m/30-60s.
 */

import type { SeasonPhase } from '../types/domain';
import {
  getOffseasonSubphasePolicy,
} from './offseasonSubphasePolicy';
import type { OffseasonSubphase } from './offseasonSubphase';

export interface RepScheme {
  setsMin: number;
  setsMax: number;
  repsMin: number;
  repsMax: number;
  /** Bible's "good base" prescription, e.g. "3x3". */
  base: string;
  /** Bible intensity guidance for the phase. */
  intent: string;
  /** Optional materialised effort target for subphase-aware prescriptions. */
  targetRpeMin?: number;
  targetRpeMax?: number;
  /** Starting-load adjustment relative to the existing phase estimate. */
  loadMultiplier?: number;
}

export interface PhaseMainLiftSchemes {
  lower: RepScheme;
  upperPush: RepScheme;
  upperPull: RepScheme;
}

const IN_SEASON_INTENT = 'Heavy but not to failure (~7-8/10). Familiar lifts only; maintain, don\'t chase soreness.';
const PRE_SEASON_INTENT = 'Strength + muscle combination; can push closer to failure (~8-9/10).';
const OFF_SEASON_INTENT = 'Build strength/size; can grind more (~8-9/10). Bias reps to goal (muscle → higher).';

export const MAIN_LIFT_REP_SCHEMES: Record<SeasonPhase, PhaseMainLiftSchemes> = {
  'In-season': {
    lower: { setsMin: 2, setsMax: 4, repsMin: 2, repsMax: 4, base: '3x3', intent: IN_SEASON_INTENT },
    upperPush: { setsMin: 2, setsMax: 4, repsMin: 3, repsMax: 5, base: '3x5', intent: IN_SEASON_INTENT },
    upperPull: { setsMin: 2, setsMax: 4, repsMin: 4, repsMax: 6, base: '3x5', intent: IN_SEASON_INTENT },
  },
  'Pre-season': {
    lower: { setsMin: 2, setsMax: 4, repsMin: 4, repsMax: 6, base: '3x5', intent: PRE_SEASON_INTENT },
    upperPush: { setsMin: 2, setsMax: 4, repsMin: 4, repsMax: 6, base: '3x6', intent: PRE_SEASON_INTENT },
    upperPull: { setsMin: 2, setsMax: 4, repsMin: 4, repsMax: 8, base: '3x6', intent: PRE_SEASON_INTENT },
  },
  'Off-season': {
    lower: { setsMin: 2, setsMax: 4, repsMin: 6, repsMax: 8, base: '3x8', intent: OFF_SEASON_INTENT },
    upperPush: { setsMin: 2, setsMax: 4, repsMin: 6, repsMax: 10, base: '3x8', intent: OFF_SEASON_INTENT },
    upperPull: { setsMin: 2, setsMax: 4, repsMin: 6, repsMax: 12, base: '3x8', intent: OFF_SEASON_INTENT },
  },
};

function offseasonSubphaseSchemes(
  subphase: OffseasonSubphase,
): PhaseMainLiftSchemes {
  const policy = getOffseasonSubphasePolicy(subphase);
  const rpe = {
    targetRpeMin: policy.strength.targetRpeMin,
    targetRpeMax: policy.strength.targetRpeMax,
  };

  if (subphase === 'early_offseason') {
    const scheme: RepScheme = {
      setsMin: 2,
      setsMax: 3,
      repsMin: policy.strength.repsMin,
      repsMax: policy.strength.repsMax,
      base: '3x10',
      intent: 'Early off-season body-armour work: smooth, controlled reps; leave 3-4 reps in reserve.',
      loadMultiplier: 0.75,
      ...rpe,
    };
    return { lower: scheme, upperPush: scheme, upperPull: scheme };
  }

  if (subphase === 'mid_offseason') {
    const common = {
      setsMin: 2,
      setsMax: 4,
      repsMax: policy.strength.repsMax,
      base: '3x8',
      intent: 'Mid off-season bridge work: controlled strength volume; leave 2-4 reps in reserve.',
      loadMultiplier: 0.9,
      ...rpe,
    };
    return {
      lower: { ...common, repsMin: policy.strength.repsMin },
      upperPush: { ...common, repsMin: policy.strength.repsMin },
      upperPull: { ...common, repsMin: Math.max(8, policy.strength.repsMin) },
    };
  }

  const legacy = MAIN_LIFT_REP_SCHEMES['Off-season'];
  const lateIntent = 'Late off-season strength work: build toward pre-season without training to failure.';
  return {
    lower: { ...legacy.lower, ...rpe, intent: lateIntent, loadMultiplier: 1 },
    upperPush: { ...legacy.upperPush, ...rpe, intent: lateIntent, loadMultiplier: 1 },
    upperPull: { ...legacy.upperPull, ...rpe, intent: lateIntent, loadMultiplier: 1 },
  };
}

export const OFFSEASON_SUBPHASE_MAIN_LIFT_REP_SCHEMES: Readonly<
  Record<OffseasonSubphase, PhaseMainLiftSchemes>
> = {
  early_offseason: offseasonSubphaseSchemes('early_offseason'),
  mid_offseason: offseasonSubphaseSchemes('mid_offseason'),
  late_offseason: offseasonSubphaseSchemes('late_offseason'),
};

export function resolveMainLiftRepSchemes(
  seasonPhase: SeasonPhase,
  offseasonSubphase?: OffseasonSubphase | null,
): PhaseMainLiftSchemes {
  if (seasonPhase === 'Off-season' && offseasonSubphase) {
    return OFFSEASON_SUBPHASE_MAIN_LIFT_REP_SCHEMES[offseasonSubphase];
  }
  return MAIN_LIFT_REP_SCHEMES[seasonPhase];
}

export interface AccessoryGuideline {
  setsMin: number;
  setsMax: number;
  /** Reps, seconds, or metres depending on `unit`. */
  min: number;
  max: number;
  unit: 'reps' | 'seconds' | 'metres';
  note: string;
}

export const ACCESSORY_REP_GUIDELINES: Record<string, AccessoryGuideline> = {
  general: { setsMin: 2, setsMax: 3, min: 8, max: 15, unit: 'reps', note: 'Standard accessory range; ~6-7/10, pump not soreness.' },
  pump: { setsMin: 2, setsMax: 3, min: 10, max: 20, unit: 'reps', note: 'Arms/delts/upper-back pump; arms may go to failure in gunshow.' },
  nordics: { setsMin: 2, setsMax: 3, min: 3, max: 5, unit: 'reps', note: 'Keep Nordics low rep — high soreness cost.' },
  timedHold: { setsMin: 2, setsMax: 3, min: 30, max: 60, unit: 'seconds', note: 'Planks/isometrics; groin/knee holds 20-45s.' },
  carries: { setsMin: 2, setsMax: 4, min: 20, max: 60, unit: 'metres', note: 'Or 30-60 seconds per carry.' },
};
