/**
 * Exercise Tags — Structured metadata for tag-based exercise selection.
 *
 * Used by the session builder's filter → score → select pipeline.
 * Each exercise has tags for movement pattern, region, load, fatigue,
 * DOMS, stability, laterality, eccentric demand, late-week suitability,
 * and per-injury-area safety ratings.
 *
 * ADDING EXERCISES:
 *   Append to the EXERCISE_TAGS map. The filter/scorer will pick them up
 *   automatically. Follow the existing tag patterns.
 *
 * INJURY RATINGS:
 *   'good'    = safe, no concern
 *   'caution' = usable but deprioritise / reduce volume
 *   'avoid'   = hard exclude when injury is active
 */

// ─── Tag Types ───

export type MovementPattern =
  | 'squat' | 'lunge' | 'hinge' | 'plyo'
  | 'horizontal_push' | 'vertical_push'
  | 'horizontal_pull' | 'vertical_pull'
  | 'carry' | 'core' | 'isolation_upper' | 'isolation_lower'
  | 'conditioning';

export type Region = 'lower' | 'upper' | 'full' | 'core';

export type LoadLevel = 'low' | 'moderate' | 'high';
export type FatigueLevel = 'low' | 'moderate' | 'high';
export type DomsLevel = 'low' | 'moderate' | 'high';
export type StabilityLevel = 'low' | 'moderate' | 'high';
export type EccentricLevel = 'low' | 'moderate' | 'high';
export type LateWeekRating = 'good' | 'caution' | 'avoid';
export type InjuryRating = 'good' | 'caution' | 'avoid';

export interface InjuryProfile {
  adductor: InjuryRating;
  pubalgia: InjuryRating;
  lowerBack: InjuryRating;
  knee: InjuryRating;
  hamstring: InjuryRating;
  calf: InjuryRating;
  ankle: InjuryRating;
  shoulder: InjuryRating;
  elbow: InjuryRating;
  wrist: InjuryRating;
}

/**
 * Typed key for an injury region — matches the `InjuryProfile` fields
 * on every `ExerciseTag`. `AthletePoolPrefs.activeInjuries` is typed
 * against this so the overrides seam can filter pool entries by real
 * injury tags rather than free-text matching on `UserProfile.injuryHistory`.
 */
export type InjuryKey = keyof InjuryProfile;

export interface ExerciseTag {
  movement: MovementPattern;
  region: Region;
  load: LoadLevel;
  fatigue: FatigueLevel;
  doms: DomsLevel;
  stability: StabilityLevel;
  unilateral: boolean;
  eccentric: EccentricLevel;
  lateWeek: LateWeekRating;
  power?: boolean;
  injury: InjuryProfile;
}

// ─── Conditioning Tier Types ───

export type ConditioningTier = 'A' | 'B-high' | 'B-low' | 'C';
export type ConditioningModality = 'run' | 'bike' | 'row' | 'ski' | 'swim' | 'mixed';
export type ConditioningImpact = 'high' | 'low';

export interface ConditioningMeta {
  tier: ConditioningTier;
  modality: ConditioningModality;
  /** high = running (ground contact), low = bike/row/ski/swim */
  impact: ConditioningImpact;
}

/**
 * Conditioning metadata per exercise name.
 * Only conditioning-movement exercises appear here.
 *
 * Tier classification is by SESSION INTENT, not individual modalities:
 *   Tier A = high output, sprint-dominant, high CNS (field sprinting).
 *   Tier B-high = high output (running or machine-based).
 *   Tier B-low = moderate output, lower tissue cost.
 *   Tier C = recovery / flush.
 *
 * Mixed-modality sessions (Flog Friday, MetCon) are classified by intent.
 * Modality field is used only for injury compatibility routing.
 */
export const CONDITIONING_META: Record<string, ConditioningMeta> = {
  // ── Tier A — Field Sprints Only ──
  'Sprint Intervals':         { tier: 'A',      modality: 'run',  impact: 'high' },
  'Hill Sprints':             { tier: 'A',      modality: 'run',  impact: 'high' },
  'Quality Sprints':          { tier: 'A',      modality: 'run',  impact: 'high' },
  'MAS Training':             { tier: 'A',      modality: 'run',  impact: 'high' },
  'Flying Sprints':           { tier: 'A',      modality: 'run',  impact: 'high' },
  'MAS 15:15 Blocks':         { tier: 'A',      modality: 'run',  impact: 'high' },
  'Tabata Intervals':         { tier: 'A',      modality: 'mixed', impact: 'low' },
  'Inverse Tabata':           { tier: 'A',      modality: 'mixed', impact: 'low' },
  'Max Effort Sprint Accumulation': { tier: 'A', modality: 'bike', impact: 'low' },
  'Free Sprint Session':      { tier: 'A',      modality: 'run',  impact: 'high' },
  'Flog Friday':              { tier: 'A',      modality: 'mixed', impact: 'high' },

  // ── Tier B-high — High Output ──
  'MetCon':                   { tier: 'B-high', modality: 'mixed', impact: 'high' },
  'Long Run':                 { tier: 'B-high', modality: 'run',  impact: 'high' },
  '6x1km':                    { tier: 'B-high', modality: 'run',  impact: 'high' },
  '1km Repeat Intervals':     { tier: 'B-high', modality: 'run',  impact: 'high' },
  '4x4 VO2':                  { tier: 'B-high', modality: 'mixed', impact: 'low' },
  '200m/400m Repeat Runs':    { tier: 'B-high', modality: 'run',  impact: 'high' },
  'Footy Fartlek':            { tier: 'B-high', modality: 'run',  impact: 'high' },
  'Hard Row Intervals':       { tier: 'B-high', modality: 'row',  impact: 'low' },
  'Hard SkiErg Intervals':    { tier: 'B-high', modality: 'ski',  impact: 'low' },
  'Hard Assault Bike Intervals': { tier: 'B-high', modality: 'bike', impact: 'low' },

  // ── Tier B-low — Moderate Output ──
  'Tempo Run':                { tier: 'B-low',  modality: 'run',  impact: 'high' },
  'Long Nasal Run':           { tier: 'B-low',  modality: 'run',  impact: 'high' },
  // 4B TRUE tempo templates — controlled repeat efforts, 6-7/10.
  '30:30 Tempo Blocks':       { tier: 'B-low',  modality: 'run',  impact: 'high' },
  'Tempo Intervals (1min on / 1min easy)': { tier: 'B-low', modality: 'run', impact: 'high' },
  'Cruise Intervals':         { tier: 'B-low',  modality: 'run',  impact: 'high' },
  'Bike/Row/Ski Tempo Intervals': { tier: 'B-low', modality: 'mixed', impact: 'low' },
  'Bike Sprints':             { tier: 'B-low',  modality: 'bike', impact: 'low' },
  'Row Intervals':            { tier: 'B-low',  modality: 'row',  impact: 'low' },
  'SkiErg Intervals':         { tier: 'B-low',  modality: 'ski',  impact: 'low' },
  'Assault Bike Intervals':   { tier: 'B-low',  modality: 'bike', impact: 'low' },

  // ── Tier C — Recovery / Flush ──
  'Flush Run':                { tier: 'C',      modality: 'run',  impact: 'high' },
  'Easy Bike':                { tier: 'C',      modality: 'bike', impact: 'low' },
  'Easy Row':                 { tier: 'C',      modality: 'row',  impact: 'low' },
  'Easy Ski':                 { tier: 'C',      modality: 'ski',  impact: 'low' },
  'Easy Swim':                { tier: 'C',      modality: 'swim', impact: 'low' },
  'Light Circuits':           { tier: 'C',      modality: 'bike', impact: 'low' },
};

/** Default injury profile — all good. Useful for upper body exercises. */
const SAFE: InjuryProfile = {
  adductor: 'good', pubalgia: 'good', lowerBack: 'good',
  knee: 'good', hamstring: 'good', calf: 'good', ankle: 'good',
  shoulder: 'good', elbow: 'good', wrist: 'good',
};

/** Helper to override specific injury ratings. */
function inj(overrides: Partial<InjuryProfile>): InjuryProfile {
  return { ...SAFE, ...overrides };
}

// ─── Exercise Tag Registry ───

export const EXERCISE_TAGS: Record<string, ExerciseTag> = {

  // ═══════════════════════════════════════════════════════════════
  // LOWER BODY — SQUAT / LUNGE
  // ═══════════════════════════════════════════════════════════════

  'Back Squat': {
    movement: 'squat', region: 'lower', load: 'high', fatigue: 'high',
    doms: 'moderate', stability: 'moderate', unilateral: false,
    eccentric: 'moderate', lateWeek: 'avoid',
    injury: inj({ adductor: 'caution', pubalgia: 'avoid', lowerBack: 'avoid', knee: 'caution', shoulder: 'caution' }),
  },

  'Front Squat': {
    movement: 'squat', region: 'lower', load: 'high', fatigue: 'high',
    doms: 'moderate', stability: 'moderate', unilateral: false,
    eccentric: 'moderate', lateWeek: 'avoid',
    injury: inj({ adductor: 'caution', pubalgia: 'avoid', lowerBack: 'caution', knee: 'caution', wrist: 'caution' }),
  },

  'Box Squat': {
    movement: 'squat', region: 'lower', load: 'high', fatigue: 'moderate',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'caution',
    injury: inj({ pubalgia: 'caution', lowerBack: 'caution' }),
  },

  'Goblet Squat': {
    movement: 'squat', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'caution',
    injury: SAFE,
  },

  'Bulgarian Split Squats': {
    movement: 'lunge', region: 'lower', load: 'moderate', fatigue: 'high',
    doms: 'high', stability: 'moderate', unilateral: true,
    eccentric: 'high', lateWeek: 'avoid',
    injury: inj({ adductor: 'caution', pubalgia: 'avoid', knee: 'caution', calf: 'caution', ankle: 'caution' }),
  },

  'Walking Lunges': {
    movement: 'lunge', region: 'lower', load: 'moderate', fatigue: 'high',
    doms: 'high', stability: 'low', unilateral: true,
    eccentric: 'high', lateWeek: 'avoid',
    injury: inj({ adductor: 'caution', pubalgia: 'avoid', knee: 'caution', calf: 'caution', ankle: 'caution' }),
  },

  'Reverse Lunges': {
    movement: 'lunge', region: 'lower', load: 'moderate', fatigue: 'moderate',
    doms: 'moderate', stability: 'moderate', unilateral: true,
    eccentric: 'moderate', lateWeek: 'caution',
    injury: inj({ pubalgia: 'caution', ankle: 'caution' }),
  },

  'Step Ups': {
    movement: 'lunge', region: 'lower', load: 'moderate', fatigue: 'moderate',
    doms: 'low', stability: 'moderate', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ ankle: 'caution' }),
  },

  'Tempo Step-Up': {
    movement: 'lunge', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ knee: 'caution', ankle: 'caution' }),
  },

  'Step-Down': {
    movement: 'lunge', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: true,
    eccentric: 'moderate', lateWeek: 'good',
    injury: inj({ knee: 'caution', ankle: 'caution' }),
  },

  'Slant Board Step-Down': {
    movement: 'lunge', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: true,
    eccentric: 'moderate', lateWeek: 'good',
    injury: inj({ knee: 'caution', ankle: 'caution' }),
  },

  'Single-Leg Squat (to Box)': {
    movement: 'squat', region: 'lower', load: 'low', fatigue: 'moderate',
    doms: 'low', stability: 'low', unilateral: true,
    eccentric: 'moderate', lateWeek: 'caution',
    injury: inj({ pubalgia: 'caution', knee: 'caution', ankle: 'caution' }),
  },

  'Leg Press': {
    movement: 'squat', region: 'lower', load: 'moderate', fatigue: 'moderate',
    doms: 'moderate', stability: 'high', unilateral: false,
    eccentric: 'moderate', lateWeek: 'caution',
    injury: inj({ knee: 'caution' }),
  },

  'Single-Leg Leg Press': {
    movement: 'squat', region: 'lower', load: 'moderate', fatigue: 'moderate',
    doms: 'low', stability: 'high', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ knee: 'caution' }),
  },

  // ═══════════════════════════════════════════════════════════════
  // LOWER BODY — HINGE
  // ═══════════════════════════════════════════════════════════════

  'Deadlift': {
    movement: 'hinge', region: 'lower', load: 'high', fatigue: 'high',
    doms: 'high', stability: 'moderate', unilateral: false,
    eccentric: 'moderate', lateWeek: 'avoid',
    injury: inj({ pubalgia: 'avoid', lowerBack: 'avoid', hamstring: 'caution' }),
  },

  'Trap Bar Deadlift': {
    movement: 'hinge', region: 'lower', load: 'high', fatigue: 'high',
    doms: 'moderate', stability: 'moderate', unilateral: false,
    eccentric: 'moderate', lateWeek: 'avoid',
    injury: inj({ pubalgia: 'caution', lowerBack: 'caution', hamstring: 'caution' }),
  },

  'RDLs': {
    movement: 'hinge', region: 'lower', load: 'moderate', fatigue: 'moderate',
    doms: 'high', stability: 'moderate', unilateral: false,
    eccentric: 'high', lateWeek: 'avoid',
    injury: inj({ pubalgia: 'caution', lowerBack: 'caution', hamstring: 'avoid' }),
  },

  'Single-Leg RDL': {
    movement: 'hinge', region: 'lower', load: 'low', fatigue: 'moderate',
    doms: 'moderate', stability: 'low', unilateral: true,
    eccentric: 'moderate', lateWeek: 'caution',
    injury: inj({ adductor: 'caution', pubalgia: 'caution', hamstring: 'caution', calf: 'caution', ankle: 'caution' }),
  },

  'Hip Thrusts': {
    movement: 'hinge', region: 'lower', load: 'moderate', fatigue: 'moderate',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'caution',
    injury: inj({ pubalgia: 'caution' }),
  },

  'Nordic Lower': {
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'high',
    doms: 'high', stability: 'low', unilateral: false,
    eccentric: 'high', lateWeek: 'avoid',
    injury: inj({ adductor: 'caution', pubalgia: 'avoid', hamstring: 'avoid', calf: 'caution', ankle: 'caution' }),
  },

  'Kettlebell Swings': {
    movement: 'hinge', region: 'lower', load: 'moderate', fatigue: 'moderate',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'caution',
    injury: inj({ lowerBack: 'caution', hamstring: 'caution' }),
  },

  // ═══════════════════════════════════════════════════════════════
  // LOWER BODY — ISOLATION (rehab / prehab / tissue work)
  //
  // Accessory-only pool. Low-load, low-fatigue isolation movements
  // used for volume, tissue work, and injury prehab. No progression
  // transfer — loadRatio=0 by convention.
  // ═══════════════════════════════════════════════════════════════

  'Leg Extension': {
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ knee: 'caution' }),
  },

  'Calf Raises': {
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ calf: 'caution', ankle: 'caution' }),
  },

  'Tib Raise': {
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ calf: 'caution', ankle: 'caution' }),
  },

  'Tibialis Raise': {
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ calf: 'caution', ankle: 'caution' }),
  },

  'Single-Leg Calf Raise': {
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: true,
    eccentric: 'moderate', lateWeek: 'good',
    injury: inj({ calf: 'caution', ankle: 'caution' }),
  },

  'Seated Calf Raise': {
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ calf: 'caution', ankle: 'caution' }),
  },

  'Adductor Machine': {
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ adductor: 'caution', pubalgia: 'caution' }),
  },

  'Banded TKE': {
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ knee: 'caution' }),
  },

  'Spanish Squat Hold': {
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ knee: 'caution' }),
  },

  'Copenhagen Plank': {
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'moderate',
    doms: 'moderate', stability: 'low', unilateral: true,
    eccentric: 'moderate', lateWeek: 'caution',
    injury: inj({ adductor: 'caution', pubalgia: 'caution', knee: 'caution' }),
  },

  'Short-Lever Copenhagen': {
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ adductor: 'caution', pubalgia: 'caution', knee: 'caution' }),
  },

  'Long-Lever Copenhagen': {
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'moderate',
    doms: 'moderate', stability: 'low', unilateral: true,
    eccentric: 'moderate', lateWeek: 'caution',
    injury: inj({ adductor: 'caution', pubalgia: 'caution', knee: 'caution' }),
  },

  'Groin Squeeze (Band Adductor)': {
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ adductor: 'caution', pubalgia: 'caution' }),
  },

  'Swiss Ball Hamstring Curl': {
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ hamstring: 'caution', lowerBack: 'caution' }),
  },

  'Bosch Hold': {
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ hamstring: 'caution', calf: 'caution', ankle: 'caution' }),
  },

  // ═══════════════════════════════════════════════════════════════
  // LOWER BODY — POWER / PLYO
  // ═══════════════════════════════════════════════════════════════

  'Vertical Jump': {
    movement: 'plyo', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'caution', power: true,
    injury: inj({ knee: 'caution', hamstring: 'caution', calf: 'caution', ankle: 'caution' }),
  },

  'Countermovement Jump': {
    movement: 'plyo', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'caution', power: true,
    injury: inj({ knee: 'caution', hamstring: 'caution', calf: 'caution', ankle: 'caution' }),
  },

  'Box Jumps': {
    movement: 'plyo', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'caution', power: true,
    injury: inj({ knee: 'caution', hamstring: 'caution', calf: 'caution', ankle: 'caution' }),
  },

  'Broad Jumps': {
    movement: 'plyo', region: 'lower', load: 'low', fatigue: 'moderate',
    doms: 'low', stability: 'low', unilateral: false,
    eccentric: 'moderate', lateWeek: 'avoid', power: true,
    injury: inj({ adductor: 'caution', pubalgia: 'caution', knee: 'caution', hamstring: 'caution', calf: 'caution', ankle: 'caution' }),
  },

  'Jump Squats': {
    movement: 'plyo', region: 'lower', load: 'low', fatigue: 'moderate',
    doms: 'moderate', stability: 'moderate', unilateral: false,
    eccentric: 'moderate', lateWeek: 'avoid', power: true,
    injury: inj({ adductor: 'caution', pubalgia: 'caution', lowerBack: 'caution', knee: 'caution', hamstring: 'caution', calf: 'caution', ankle: 'caution' }),
  },

  'Lateral Bounds': {
    movement: 'plyo', region: 'lower', load: 'low', fatigue: 'moderate',
    doms: 'moderate', stability: 'low', unilateral: true,
    eccentric: 'moderate', lateWeek: 'avoid', power: true,
    injury: inj({ adductor: 'avoid', pubalgia: 'avoid', knee: 'caution', hamstring: 'caution', calf: 'caution', ankle: 'caution' }),
  },

  'RFE Split Squat Jump': {
    movement: 'plyo', region: 'lower', load: 'low', fatigue: 'high',
    doms: 'moderate', stability: 'low', unilateral: true,
    eccentric: 'high', lateWeek: 'avoid', power: true,
    injury: inj({ adductor: 'avoid', pubalgia: 'avoid', lowerBack: 'caution', knee: 'avoid', hamstring: 'avoid', calf: 'avoid', ankle: 'avoid' }),
  },

  'Depth Jumps': {
    movement: 'plyo', region: 'lower', load: 'low', fatigue: 'high',
    doms: 'moderate', stability: 'low', unilateral: false,
    eccentric: 'high', lateWeek: 'avoid', power: true,
    injury: inj({ adductor: 'caution', pubalgia: 'caution', lowerBack: 'caution', knee: 'avoid', hamstring: 'caution', calf: 'caution', ankle: 'avoid' }),
  },

  // ═══════════════════════════════════════════════════════════════
  // UPPER BODY — HORIZONTAL PUSH
  // ═══════════════════════════════════════════════════════════════

  'Bench Press': {
    movement: 'horizontal_push', region: 'upper', load: 'high', fatigue: 'high',
    doms: 'moderate', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ shoulder: 'caution', elbow: 'caution', wrist: 'caution' }),
  },

  'DB Bench Press': {
    movement: 'horizontal_push', region: 'upper', load: 'moderate', fatigue: 'moderate',
    doms: 'moderate', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ shoulder: 'caution' }),
  },

  'Incline Bench': {
    movement: 'horizontal_push', region: 'upper', load: 'moderate', fatigue: 'moderate',
    doms: 'moderate', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ shoulder: 'caution', wrist: 'caution' }),
  },

  'Incline DB Bench': {
    movement: 'horizontal_push', region: 'upper', load: 'moderate', fatigue: 'moderate',
    doms: 'moderate', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ shoulder: 'caution' }),
  },

  'Close Grip Bench': {
    movement: 'horizontal_push', region: 'upper', load: 'moderate', fatigue: 'moderate',
    doms: 'moderate', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ shoulder: 'caution', elbow: 'caution', wrist: 'caution' }),
  },

  'Push-ups': {
    movement: 'horizontal_push', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ shoulder: 'caution', wrist: 'caution' }),
  },

  'Dips': {
    movement: 'horizontal_push', region: 'upper', load: 'moderate', fatigue: 'moderate',
    doms: 'moderate', stability: 'moderate', unilateral: false,
    eccentric: 'high', lateWeek: 'caution',
    injury: inj({ shoulder: 'caution', elbow: 'caution' }),
  },

  'Single-Arm DB Floor Press': {
    movement: 'horizontal_push', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: SAFE,
  },

  'Single-Arm DB Bench Press': {
    movement: 'horizontal_push', region: 'upper', load: 'moderate', fatigue: 'moderate',
    doms: 'moderate', stability: 'low', unilateral: true,
    eccentric: 'low', lateWeek: 'caution',
    injury: inj({ shoulder: 'caution' }),
  },

  'Scap Push-Up': {
    movement: 'horizontal_push', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ shoulder: 'caution', wrist: 'caution' }),
  },

  // ═══════════════════════════════════════════════════════════════
  // UPPER BODY — VERTICAL PUSH
  // ═══════════════════════════════════════════════════════════════

  'Overhead Press': {
    movement: 'vertical_push', region: 'upper', load: 'high', fatigue: 'high',
    doms: 'moderate', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'caution',
    injury: inj({ shoulder: 'caution', lowerBack: 'caution', elbow: 'caution' }),
  },

  'DB Shoulder Press': {
    movement: 'vertical_push', region: 'upper', load: 'moderate', fatigue: 'moderate',
    doms: 'moderate', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'caution',
    injury: inj({ shoulder: 'caution' }),
  },

  'Landmine Press': {
    movement: 'vertical_push', region: 'upper', load: 'moderate', fatigue: 'moderate',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: SAFE,
  },

  'Half-Kneeling Landmine Press': {
    movement: 'vertical_push', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ shoulder: 'caution', elbow: 'caution', wrist: 'caution' }),
  },

  'Bottoms-Up KB Press': {
    movement: 'vertical_push', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'low', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ shoulder: 'caution', elbow: 'caution', wrist: 'caution' }),
  },

  'Z-Press': {
    movement: 'vertical_push', region: 'upper', load: 'moderate', fatigue: 'moderate',
    doms: 'low', stability: 'low', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ shoulder: 'caution', lowerBack: 'caution' }),
  },

  'Seated DB Press': {
    movement: 'vertical_push', region: 'upper', load: 'moderate', fatigue: 'moderate',
    doms: 'moderate', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ shoulder: 'caution' }),
  },

  'Half-Kneeling Single-Arm Overhead Press': {
    movement: 'vertical_push', region: 'upper', load: 'moderate', fatigue: 'moderate',
    doms: 'low', stability: 'high', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ shoulder: 'caution' }),
  },

  // ═══════════════════════════════════════════════════════════════
  // UPPER BODY — HORIZONTAL PULL
  // ═══════════════════════════════════════════════════════════════

  'Barbell Row': {
    movement: 'horizontal_pull', region: 'upper', load: 'high', fatigue: 'moderate',
    doms: 'moderate', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'caution',
    injury: inj({ lowerBack: 'caution', elbow: 'caution', wrist: 'caution' }),
  },

  'Chest Supported Row': {
    movement: 'horizontal_pull', region: 'upper', load: 'moderate', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: SAFE,
  },

  'Chest-Supported DB Row': {
    movement: 'horizontal_pull', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: SAFE,
  },

  'Seated Cable Row': {
    movement: 'horizontal_pull', region: 'upper', load: 'moderate', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: SAFE,
  },

  'Single-Arm DB Row': {
    movement: 'horizontal_pull', region: 'upper', load: 'moderate', fatigue: 'moderate',
    doms: 'low', stability: 'high', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ lowerBack: 'caution' }),
  },

  'Inverted Row (Bodyweight)': {
    movement: 'horizontal_pull', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ shoulder: 'caution', elbow: 'caution', wrist: 'caution' }),
  },

  // ═══════════════════════════════════════════════════════════════
  // UPPER BODY — VERTICAL PULL
  // ═══════════════════════════════════════════════════════════════

  'Pull-Ups': {
    movement: 'vertical_pull', region: 'upper', load: 'high', fatigue: 'moderate',
    doms: 'moderate', stability: 'low', unilateral: false,
    eccentric: 'moderate', lateWeek: 'good',
    injury: inj({ shoulder: 'caution', elbow: 'caution' }),
  },

  'Chin-Ups': {
    movement: 'vertical_pull', region: 'upper', load: 'high', fatigue: 'moderate',
    doms: 'moderate', stability: 'low', unilateral: false,
    eccentric: 'moderate', lateWeek: 'good',
    injury: inj({ shoulder: 'caution', elbow: 'caution' }),
  },

  'Lat Pulldown': {
    movement: 'vertical_pull', region: 'upper', load: 'moderate', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ shoulder: 'caution' }),
  },

  'Neutral-Grip Pulldown': {
    movement: 'vertical_pull', region: 'upper', load: 'moderate', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: SAFE,
  },

  'Straight-Arm Pulldown': {
    movement: 'vertical_pull', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ shoulder: 'caution' }),
  },

  'Single-Arm Lat Pulldown': {
    movement: 'vertical_pull', region: 'upper', load: 'moderate', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ shoulder: 'caution' }),
  },

  // ═══════════════════════════════════════════════════════════════
  // UPPER BODY — POWER / PLYO
  // ═══════════════════════════════════════════════════════════════

  'Speed Bench': {
    movement: 'horizontal_push', region: 'upper', load: 'moderate', fatigue: 'moderate',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'avoid', power: true,
    injury: inj({ shoulder: 'caution', elbow: 'caution', wrist: 'caution' }),
  },

  'Clap Push-Ups': {
    movement: 'horizontal_push', region: 'upper', load: 'low', fatigue: 'moderate',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'moderate', lateWeek: 'avoid', power: true,
    injury: inj({ shoulder: 'caution', elbow: 'caution', wrist: 'caution' }),
  },

  'Explosive Push-Ups': {
    movement: 'horizontal_push', region: 'upper', load: 'low', fatigue: 'moderate',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'moderate', lateWeek: 'avoid', power: true,
    injury: inj({ shoulder: 'caution', elbow: 'caution', wrist: 'caution' }),
  },

  'Explosive Landmine Press': {
    movement: 'vertical_push', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'caution', power: true,
    injury: SAFE,
  },

  // ═══════════════════════════════════════════════════════════════
  // CORE / TRUNK
  // ═══════════════════════════════════════════════════════════════

  'Band Pallof Press': {
    movement: 'core', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: SAFE,
  },

  'Woodchop (Standing)': {
    movement: 'core', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ lowerBack: 'caution', adductor: 'caution', pubalgia: 'caution' }),
  },

  'Woodchop (Half Kneeling)': {
    movement: 'core', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ lowerBack: 'caution', adductor: 'caution', pubalgia: 'caution' }),
  },

  'Ab Wheel': {
    movement: 'core', region: 'upper', load: 'low', fatigue: 'moderate',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'moderate', lateWeek: 'caution',
    injury: inj({ shoulder: 'caution', lowerBack: 'caution', pubalgia: 'avoid' }),
  },

  'Hanging Leg Raise': {
    movement: 'core', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ shoulder: 'caution', adductor: 'caution', pubalgia: 'caution' }),
  },

  'Side Plank': {
    movement: 'core', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: SAFE,
  },

  'Dead Bug': {
    movement: 'core', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ pubalgia: 'caution' }),
  },

  'Banded Dead Bug': {
    movement: 'core', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ pubalgia: 'caution' }),
  },

  'Weighted Dead Bug': {
    movement: 'core', region: 'upper', load: 'low', fatigue: 'moderate',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'caution',
    injury: inj({ pubalgia: 'caution', shoulder: 'caution', lowerBack: 'caution' }),
  },

  'McGill Sit Up': {
    movement: 'core', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ lowerBack: 'caution' }),
  },

  'Bird Dog': {
    movement: 'core', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: SAFE,
  },

  // ═══════════════════════════════════════════════════════════════
  // CARRIES
  // ═══════════════════════════════════════════════════════════════

  'Farmer Carry': {
    movement: 'carry', region: 'upper', load: 'moderate', fatigue: 'moderate',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ lowerBack: 'caution', shoulder: 'caution', elbow: 'caution', wrist: 'caution' }),
  },

  'Suitcase Carry': {
    movement: 'carry', region: 'upper', load: 'moderate', fatigue: 'moderate',
    doms: 'low', stability: 'moderate', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ lowerBack: 'caution', shoulder: 'caution', elbow: 'caution', wrist: 'caution', adductor: 'caution', pubalgia: 'caution' }),
  },

  'Bear Carry': {
    movement: 'carry', region: 'upper', load: 'moderate', fatigue: 'moderate',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ lowerBack: 'caution', shoulder: 'caution', elbow: 'caution', wrist: 'caution' }),
  },

  'Overhead Carry': {
    movement: 'carry', region: 'upper', load: 'moderate', fatigue: 'moderate',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ shoulder: 'caution', lowerBack: 'caution' }),
  },

  'Bottoms-Up KB Carry': {
    movement: 'carry', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'low', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ shoulder: 'caution', elbow: 'caution', wrist: 'caution', lowerBack: 'caution' }),
  },

  'Zercher Carry': {
    movement: 'carry', region: 'upper', load: 'moderate', fatigue: 'moderate',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ elbow: 'caution', lowerBack: 'caution' }),
  },

  // ═══════════════════════════════════════════════════════════════
  // SHOULDERS / UPPER BACK
  // ═══════════════════════════════════════════════════════════════

  'Lateral Raise': {
    movement: 'isolation_upper', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ shoulder: 'caution' }),
  },

  'Face Pull': {
    movement: 'horizontal_pull', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ shoulder: 'caution' }),
  },

  'Cable Face Pull': {
    movement: 'horizontal_pull', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ shoulder: 'caution' }),
  },

  'Rear Delt Fly': {
    movement: 'horizontal_pull', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: SAFE,
  },

  'Band Pull-Apart': {
    movement: 'horizontal_pull', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: SAFE,
  },

  'Banded External Rotation': {
    movement: 'isolation_upper', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ shoulder: 'caution' }),
  },

  'Shrugs': {
    movement: 'isolation_upper', region: 'upper', load: 'moderate', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ wrist: 'caution', lowerBack: 'caution' }),
  },

  'Single-Arm Shrug': {
    movement: 'isolation_upper', region: 'upper', load: 'moderate', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ wrist: 'caution', lowerBack: 'caution' }),
  },

  'Incline Y Raise': {
    movement: 'isolation_upper', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: SAFE,
  },

  // ═══════════════════════════════════════════════════════════════
  // ARMS — BICEPS
  // ═══════════════════════════════════════════════════════════════

  'Bicep Curl (Barbell)': {
    movement: 'isolation_upper', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ elbow: 'caution', wrist: 'caution' }),
  },

  'Bicep Curl (Dumbbell)': {
    movement: 'isolation_upper', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: SAFE,
  },

  'Hammer Curl': {
    movement: 'isolation_upper', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: SAFE,
  },

  'Chin-Up Negative (Slow)': {
    movement: 'vertical_pull', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'moderate', stability: 'low', unilateral: false,
    eccentric: 'moderate', lateWeek: 'good',
    injury: inj({ shoulder: 'caution', elbow: 'caution' }),
  },

  'Incline Dumbbell Curl': {
    movement: 'isolation_upper', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'moderate', stability: 'moderate', unilateral: false,
    eccentric: 'moderate', lateWeek: 'caution',
    injury: inj({ shoulder: 'caution' }),
  },

  'Lying Dumbbell Curl': {
    movement: 'isolation_upper', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: SAFE,
  },

  'Banded Bicep Curl': {
    movement: 'isolation_upper', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: SAFE,
  },

  'Concentration Curl': {
    movement: 'isolation_upper', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: SAFE,
  },

  // ═══════════════════════════════════════════════════════════════
  // ARMS — TRICEPS
  // ═══════════════════════════════════════════════════════════════

  'Tricep Pushdown': {
    movement: 'isolation_upper', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: SAFE,
  },

  'Banded Tricep Pushdown': {
    movement: 'isolation_upper', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: SAFE,
  },

  'Skull Crushers': {
    movement: 'isolation_upper', region: 'upper', load: 'moderate', fatigue: 'low',
    doms: 'moderate', stability: 'high', unilateral: false,
    eccentric: 'moderate', lateWeek: 'caution',
    injury: inj({ elbow: 'caution', wrist: 'caution' }),
  },

  'Dumbbell Skull Crusher': {
    movement: 'isolation_upper', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'moderate', stability: 'moderate', unilateral: false,
    eccentric: 'moderate', lateWeek: 'caution',
    injury: inj({ elbow: 'caution', wrist: 'caution' }),
  },

  'Overhead Tricep Extension': {
    movement: 'isolation_upper', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ shoulder: 'caution', elbow: 'caution' }),
  },

  'Dumbbell Kickback': {
    movement: 'isolation_upper', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: SAFE,
  },

  'Tricep Circuit (Dirty 30)': {
    movement: 'isolation_upper', region: 'upper', load: 'low', fatigue: 'moderate',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ elbow: 'caution' }),
  },

  // ═══════════════════════════════════════════════════════════════
  // CONDITIONING
  // ═══════════════════════════════════════════════════════════════

  // ── Tier A — Field Sprints Only ──
  // Field-based sprinting only. High CNS demand, high tissue load.
  // Bike-based sprint work is explicitly excluded from Tier A.

  'Sprint Intervals': {
    movement: 'conditioning', region: 'full', load: 'high', fatigue: 'high',
    doms: 'moderate', stability: 'low', unilateral: false,
    eccentric: 'moderate', lateWeek: 'avoid',
    injury: inj({ hamstring: 'avoid', calf: 'avoid', ankle: 'caution', adductor: 'caution' }),
  },

  'Hill Sprints': {
    movement: 'conditioning', region: 'full', load: 'high', fatigue: 'high',
    doms: 'high', stability: 'low', unilateral: false,
    eccentric: 'moderate', lateWeek: 'avoid',
    injury: inj({ hamstring: 'avoid', calf: 'avoid', ankle: 'caution', adductor: 'caution', knee: 'caution' }),
  },

  'Quality Sprints': {
    movement: 'conditioning', region: 'full', load: 'high', fatigue: 'high',
    doms: 'moderate', stability: 'low', unilateral: false,
    eccentric: 'moderate', lateWeek: 'avoid',
    injury: inj({ hamstring: 'avoid', calf: 'avoid', ankle: 'caution', adductor: 'caution' }),
  },

  'MAS Training': {
    movement: 'conditioning', region: 'full', load: 'high', fatigue: 'high',
    doms: 'moderate', stability: 'low', unilateral: false,
    eccentric: 'low', lateWeek: 'avoid',
    injury: inj({ hamstring: 'avoid', calf: 'avoid', ankle: 'caution', adductor: 'caution' }),
  },

  'Flog Friday': {
    movement: 'conditioning', region: 'full', load: 'high', fatigue: 'high',
    doms: 'high', stability: 'moderate', unilateral: false,
    eccentric: 'moderate', lateWeek: 'avoid',
    injury: inj({ hamstring: 'avoid', calf: 'avoid', ankle: 'caution', adductor: 'caution', lowerBack: 'caution', shoulder: 'caution' }),
  },

  // ── Tier B-high — High Output ──

  'MetCon': {
    movement: 'conditioning', region: 'full', load: 'high', fatigue: 'high',
    doms: 'moderate', stability: 'moderate', unilateral: false,
    eccentric: 'moderate', lateWeek: 'avoid',
    injury: inj({ lowerBack: 'caution', shoulder: 'caution' }),
  },

  'Long Run': {
    movement: 'conditioning', region: 'full', load: 'moderate', fatigue: 'high',
    doms: 'low', stability: 'low', unilateral: false,
    eccentric: 'low', lateWeek: 'caution',
    injury: inj({ hamstring: 'caution', calf: 'caution', ankle: 'caution', knee: 'caution' }),
  },

  '6x1km': {
    movement: 'conditioning', region: 'full', load: 'high', fatigue: 'high',
    doms: 'moderate', stability: 'low', unilateral: false,
    eccentric: 'low', lateWeek: 'avoid',
    injury: inj({ hamstring: 'caution', calf: 'caution', ankle: 'caution', knee: 'caution' }),
  },

  'Hard Row Intervals': {
    movement: 'conditioning', region: 'full', load: 'high', fatigue: 'high',
    doms: 'moderate', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'caution',
    injury: inj({ lowerBack: 'caution' }),
  },

  'Hard SkiErg Intervals': {
    movement: 'conditioning', region: 'full', load: 'high', fatigue: 'high',
    doms: 'moderate', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'caution',
    injury: inj({ shoulder: 'caution' }),
  },

  'Hard Assault Bike Intervals': {
    movement: 'conditioning', region: 'full', load: 'high', fatigue: 'high',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'caution',
    injury: inj({ knee: 'caution' }),
  },

  // ── Tier B-low — Moderate Output ──

  'Tempo Run': {
    movement: 'conditioning', region: 'full', load: 'moderate', fatigue: 'moderate',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'caution',
    injury: inj({ hamstring: 'caution', calf: 'caution', ankle: 'caution' }),
  },

  'Bike Sprints': {
    movement: 'conditioning', region: 'full', load: 'moderate', fatigue: 'moderate',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ knee: 'caution' }),
  },

  'Row Intervals': {
    movement: 'conditioning', region: 'full', load: 'moderate', fatigue: 'moderate',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ lowerBack: 'caution' }),
  },

  'SkiErg Intervals': {
    movement: 'conditioning', region: 'full', load: 'moderate', fatigue: 'moderate',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ shoulder: 'caution' }),
  },

  'Assault Bike Intervals': {
    movement: 'conditioning', region: 'full', load: 'moderate', fatigue: 'moderate',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ knee: 'caution' }),
  },

  // ── Tier C — Recovery / Flush ──

  'Flush Run': {
    movement: 'conditioning', region: 'full', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ hamstring: 'caution', calf: 'caution', ankle: 'caution' }),
  },

  'Easy Bike': {
    movement: 'conditioning', region: 'full', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: SAFE,
  },

  'Easy Row': {
    movement: 'conditioning', region: 'full', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ lowerBack: 'caution' }),
  },

  'Easy Ski': {
    movement: 'conditioning', region: 'full', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ shoulder: 'caution' }),
  },

  'Easy Swim': {
    movement: 'conditioning', region: 'full', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: inj({ shoulder: 'caution' }),
  },

  'Light Circuits': {
    movement: 'conditioning', region: 'full', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: SAFE,
  },
};

// ─── Lookup Helpers ───

/** Get tags for an exercise. Returns undefined if not tagged. */
export function getExerciseTags(name: string): ExerciseTag | undefined {
  return EXERCISE_TAGS[name];
}

/** Get all tagged exercise names. */
export function getAllTaggedExercises(): string[] {
  return Object.keys(EXERCISE_TAGS);
}

/** Get all exercises matching a movement pattern. */
export function getByMovement(movement: MovementPattern): string[] {
  return Object.entries(EXERCISE_TAGS)
    .filter(([, tags]) => tags.movement === movement)
    .map(([name]) => name);
}

/** Get all exercises matching a region. */
export function getByRegion(region: Region): string[] {
  return Object.entries(EXERCISE_TAGS)
    .filter(([, tags]) => tags.region === region)
    .map(([name]) => name);
}

/** Get conditioning metadata for an exercise. Returns undefined if not a conditioning exercise. */
export function getConditioningMeta(name: string): ConditioningMeta | undefined {
  return CONDITIONING_META[name];
}

/** Get all conditioning exercises for a given tier. */
export function getConditioningByTier(tier: ConditioningTier): string[] {
  return Object.entries(CONDITIONING_META)
    .filter(([, meta]) => meta.tier === tier)
    .map(([name]) => name);
}
