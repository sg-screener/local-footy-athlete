/**
 * phaseRepSchemes.ts — Programming Bible main-lift set/rep tables as DATA.
 *
 * Phase 1 rules kernel (DATA ONLY — not consumed by the engine yet).
 * Wiring these into strength generation is Phase 3 and needs its own plan.
 *
 * Bible source: Section 5 (Strength programming rules).
 *   In-season:  main lifts 2-4 sets of 2-4 reps (3x3 base). Upper push
 *               closer to 3x5; pulls tolerate more (up to 3x6).
 *   Pre-season: 2-4 sets of 4-6 reps (3x5 base); pulls 4-8.
 *   Off-season: 2-4 sets of 6-8 reps (3x8 base); pulls 6-12;
 *               push 6-10 when the goal is muscle.
 *   Accessories: 2-3 x 8-15 (pump work 10-20); Nordics 2-3 x 3-6;
 *               timed holds 2-3 x 30-60s; carries 2-4 x 20-60m/30-60s.
 */

import type { SeasonPhase } from '../types/domain';

export interface RepScheme {
  setsMin: number;
  setsMax: number;
  repsMin: number;
  repsMax: number;
  /** Bible's "good base" prescription, e.g. "3x3". */
  base: string;
  /** Bible intensity guidance for the phase. */
  intent: string;
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
  nordics: { setsMin: 2, setsMax: 3, min: 3, max: 6, unit: 'reps', note: 'Keep Nordics low rep — high soreness cost.' },
  timedHold: { setsMin: 2, setsMax: 3, min: 30, max: 60, unit: 'seconds', note: 'Planks/isometrics; groin/knee holds 20-45s.' },
  carries: { setsMin: 2, setsMax: 4, min: 20, max: 60, unit: 'metres', note: 'Or 30-60 seconds per carry.' },
};
