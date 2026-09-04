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

import { CONDITIONING_TEMPLATES } from './conditioningTemplates';
import { TIER_FOR_QUALITY, renderableModalities } from '../rules/conditioningSelection';

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
  'groin': InjuryRating;
  'hip': InjuryRating;
  'quad': InjuryRating;
  'hamstring': InjuryRating;
  'knee': InjuryRating;
  'calf': InjuryRating;
  'ankle/foot': InjuryRating;
  'ribs': InjuryRating;
  'lowerBack': InjuryRating;
  'neck': InjuryRating;
  'shoulder': InjuryRating;
  'elbow': InjuryRating;
  'wrist/hand': InjuryRating;
}

/**
 * Typed key for an injury region — matches the `InjuryProfile` fields
 * on every `ExerciseTag`. `AthletePoolPrefs.activeInjuries` is typed
 * against this so the overrides seam can filter pool entries by real
 * injury tags rather than free-text matching on `UserProfile.injuryHistory`.
 */
export type InjuryKey = keyof InjuryProfile;

/** Curated movement doses override generic slot bands (28 August intake).
 * Writer: this catalogue. Readers: composedDose, power rows and manual Add/Swap.
 * Guard: exerciseIntakeTests. No derived prescription is persisted here.
 */
export interface AuthoredExercisePrescription {
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number;
  prescriptionType: 'reps' | 'duration';
  perSide: boolean;
  notes: string;
}

/**
 * A hamstring Nordic's regression status changes the realistic automatic rep
 * band. Keep that distinction on the exercise identity itself: neither the
 * composer nor a final-week audit should have to infer assistance from notes.
 * `Reverse Nordic Curl` is a different, quad-dominant movement and therefore
 * deliberately carries no value from this type.
 */
export type NordicCurlVariant =
  | 'full_unassisted_eccentric'
  | 'assisted_or_substantially_regressed';

/** Sam's optional strength-only exercise classification (R-319). */
export type StrengthExerciseClassification = 'compound' | 'isolation';

/**
 * Which half of a split upper session may automatically own an accessory.
 * `both` is reserved for genuinely mixed support work; athlete-added rows do
 * not consult this field.
 */
export type UpperAccessoryAffinity = 'push' | 'pull' | 'both';

export interface ExerciseProgramming {
  strengthRole?: 'none' | 'accessory' | 'secondary';
  automaticMinimum: import('../rules/experienceCrosswalk').TrainingAgeLevel;
  /** Highest training-age tier this exercise may be selected for automatically. */
  automaticMaximum?: import('../rules/experienceCrosswalk').TrainingAgeLevel;
  manualMinimum: import('../rules/experienceCrosswalk').TrainingAgeLevel;
  excludeWithinDaysOfGame?: number;
  automaticExcludeWithinDaysOfGame?: number;
  warmup: boolean;
  primer: boolean;
  /** Rotation/throwing is not a same-pattern pressing contrast. */
  contrast?: boolean;
}

export interface ExerciseTag {
  /** Unset for power, plyometrics, carries, core, prehab, mobility and conditioning. */
  strengthClassification?: StrengthExerciseClassification;
  /** Authored direction for automatic split-upper accessory selection. */
  accessoryAffinity?: UpperAccessoryAffinity;
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
  nordicCurlVariant?: NordicCurlVariant;
  prescription?: AuthoredExercisePrescription;
  programming?: ExerciseProgramming;
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
 * Mixed-modality sessions (MetCon) are classified by intent.
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

  // ── Tier B-high — High Output ──
  'Long Run':                 { tier: 'B-high', modality: 'run',  impact: 'high' },
  '6x1km':                    { tier: 'B-high', modality: 'run',  impact: 'high' },
  '1km Repeat Intervals':     { tier: 'B-high', modality: 'run',  impact: 'high' },
  '4x4 VO2':                  { tier: 'B-high', modality: 'mixed', impact: 'low' },
  '200m/400m Repeat Runs':    { tier: 'B-high', modality: 'run',  impact: 'high' },
  'Footy Fartlek':            { tier: 'B-high', modality: 'run',  impact: 'high' },
  'Hard Row Intervals':       { tier: 'B-high', modality: 'row',  impact: 'low' },
  'Hard SkiErg Intervals':    { tier: 'B-high', modality: 'ski',  impact: 'low' },
  'Hard Assault Bike Intervals': { tier: 'B-high', modality: 'bike', impact: 'low' },
  // Sam's locked list (2026-07-24) adds the format; he ruled the
  // tier/modality/impact triple on 2026-07-25 (mirrors Hard Row Intervals /
  // 4x4 VO2 — a hard-intervals format on a low-impact mixed modality).
  'Erg EMOM':                 { tier: 'B-high', modality: 'mixed', impact: 'low' },

  // The 2km time trial (D14). Sam ruled it a TEST, not a dose (2026-07-29) —
  // it has no conditioning-templates row, because "run 2km, time it" is its
  // complete specification and there is no dose to author. It still needs
  // membership HERE: this map is one of the five systems that define "this
  // exercise exists", so without it the session could never be prescribed.
  // Sam ruled the tier B-high on 2026-07-29, confirming the triple rather than
  // leaving it derived — matching how he ruled `Erg EMOM`'s triple above. It
  // sits with `6x1km` and `1km Repeat Intervals`: a hard sustained run on feet.
  '2km Time Trial':           { tier: 'B-high', modality: 'run',  impact: 'high' },

  // ── Tier B-low — Moderate Output ──
  'Tempo Run':                { tier: 'B-low',  modality: 'run',  impact: 'high' },
  'Long Nasal Run':           { tier: 'B-low',  modality: 'run',  impact: 'high' },
  // 4B TRUE tempo templates — controlled repeat efforts, 6-7/10.
  '30:30 Tempo Blocks':       { tier: 'B-low',  modality: 'run',  impact: 'high' },
  'Tempo Intervals (1min on / 1min easy)': { tier: 'B-low', modality: 'run', impact: 'high' },
  'Cruise Intervals':         { tier: 'B-low',  modality: 'run',  impact: 'high' },
  'Bike/Row/Ski Tempo Intervals': { tier: 'B-low', modality: 'mixed', impact: 'low' },
  'Air Bike Sprints':             { tier: 'B-low',  modality: 'bike', impact: 'low' },
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

/**
 * The 55 authored conditioning templates join the registry by DERIVATION
 * (Stage B switchover, 2026-08-05): tier from the quality tab, modality and
 * impact from the authored `modalityNotes`. Nothing here is invented — a
 * curated entry above (a ruled triple, e.g. `Erg EMOM`, `MAS 15:15 Blocks`)
 * always wins over the derivation, so Sam's rulings cannot be overwritten by
 * a reader. This is what makes the authored names selectable vocabulary and
 * lets the row classifiers answer from the registry instead of a name regex.
 */
{
  const machineToMeta: Record<string, ConditioningModality> = {
    bike: 'bike', air_bike: 'bike', row: 'row', ski: 'ski',
  };
  for (const template of CONDITIONING_TEMPLATES) {
    if (CONDITIONING_META[template.name]) continue;
    const modalities = renderableModalities(template);
    const machines = modalities.filter((modality) => modality !== 'run');
    const runs = modalities.includes('run');
    CONDITIONING_META[template.name] = {
      tier: TIER_FOR_QUALITY[template.quality],
      modality: runs
        ? (machines.length > 0 ? 'mixed' : 'run')
        : machines.length > 1 ? 'mixed' : machineToMeta[machines[0]] ?? 'mixed',
      impact: runs && machines.length === 0 ? 'high' : 'low',
    };
  }
}

// ─── Exercise Tag Registry ───

export const EXERCISE_TAGS: Record<string, ExerciseTag> = {
  'Rotational Medicine-Ball Slam': {
    movement: 'core', region: 'upper', load: 'moderate',
    fatigue: 'low', doms: 'low', stability: 'moderate',
    unilateral: true, eccentric: 'low', lateWeek: 'caution',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'avoid',
      'lowerBack': 'avoid',
      'neck': 'caution',
      'shoulder': 'avoid',
      'elbow': 'caution',
      'wrist/hand': 'avoid',
    },
    prescription: {
      sets: 3, repsMin: 4, repsMax: 6,
      restSeconds: 60, prescriptionType: 'reps', perSide: true,
      notes: 'Start around 3–6 kg; log total ball weight. Reset each rep. Low-volume power only near games; stop if speed drops.',
    },
    programming: {
      automaticMinimum: 'developing', manualMinimum: 'new', warmup: false,
      primer: true, contrast: false,
    },
    power: true,
  },
  'Medicine-Ball Slam': {
    movement: 'vertical_pull', region: 'upper', load: 'moderate',
    fatigue: 'moderate', doms: 'low', stability: 'low',
    unilateral: false, eccentric: 'low', lateWeek: 'caution',
    injury: {
      'groin': 'good',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'avoid',
      'lowerBack': 'avoid',
      'neck': 'caution',
      'shoulder': 'avoid',
      'elbow': 'caution',
      'wrist/hand': 'avoid',
    },
    prescription: {
      sets: 3, repsMin: 4, repsMax: 6,
      restSeconds: 60, prescriptionType: 'reps', perSide: false,
      notes: 'Start around 3–6 kg; log total ball weight. Low-volume power only near games. Stop if speed drops.',
    },
    programming: {
      automaticMinimum: 'new', manualMinimum: 'new', warmup: false,
      primer: true, contrast: false,
    },
    power: true,
  },
  'Rotational Medicine-Ball Throw': {
    movement: 'core', region: 'upper', load: 'low',
    fatigue: 'low', doms: 'low', stability: 'moderate',
    unilateral: true, eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'avoid',
      'lowerBack': 'avoid',
      'neck': 'caution',
      'shoulder': 'avoid',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
    prescription: {
      sets: 3, repsMin: 3, repsMax: 5,
      restSeconds: 60, prescriptionType: 'reps', perSide: true,
      notes: 'Use a wall-throw ball. Start around 2–4 kg; log total ball weight. Fast reps with complete recovery.',
    },
    programming: {
      automaticMinimum: 'developing', manualMinimum: 'new', warmup: false,
      primer: true, contrast: false,
    },
    power: true,
  },
  'Reverse Nordic Curl': {
    movement: 'isolation_lower', region: 'lower', load: 'moderate',
    fatigue: 'moderate', doms: 'high', stability: 'low',
    unilateral: false, eccentric: 'high', lateWeek: 'avoid',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'avoid',
      'hamstring': 'good',
      'knee': 'avoid',
      'calf': 'good',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
    prescription: {
      sets: 2, repsMin: 5, repsMax: 5,
      restSeconds: 60, prescriptionType: 'reps', perSide: false,
      notes: 'Lower for 5 seconds. Bodyweight; beginners use shallow range or band assistance. External loading not yet specified.',
    },
    programming: {
      automaticMinimum: 'developing', manualMinimum: 'new', warmup: false,
      primer: false, excludeWithinDaysOfGame: 2,
    },
  },
  'SL 45° Back Extension Hold': {
    movement: 'isolation_lower', region: 'lower', load: 'moderate',
    fatigue: 'low', doms: 'low', stability: 'moderate',
    unilateral: true, eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'good',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
    prescription: {
      sets: 2, repsMin: 30, repsMax: 30,
      restSeconds: 45, prescriptionType: 'duration', perSide: true,
      notes: 'Short submaximal holds near games; never maximum duration. Start bodyweight; optional plate or dumbbell at chest, total external load.',
    },
    programming: {
      automaticMinimum: 'developing', manualMinimum: 'developing', warmup: true,
      primer: true,
    },
  },
  'SL 45° Back Extension': {
    strengthClassification: 'isolation',
    movement: 'hinge', region: 'lower', load: 'moderate',
    fatigue: 'moderate', doms: 'moderate', stability: 'moderate',
    unilateral: true, eccentric: 'moderate', lateWeek: 'caution',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'good',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
    prescription: {
      sets: 3, repsMin: 10, repsMax: 10,
      restSeconds: 60, prescriptionType: 'reps', perSide: true,
      notes: 'Start with bodyweight. Optional plate or dumbbell at chest; log total external load. Caution two days before a game.',
    },
    programming: {
      automaticMinimum: 'developing', manualMinimum: 'developing', warmup: false,
      primer: false, automaticExcludeWithinDaysOfGame: 1,
    },
  },
  'Seated Good Morning': {
    movement: 'hinge', region: 'lower', load: 'low',
    fatigue: 'low', doms: 'low', stability: 'low',
    unilateral: false, eccentric: 'moderate', lateWeek: 'caution',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'good',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'caution',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
    prescription: {
      sets: 2, repsMin: 5, repsMax: 5,
      restSeconds: 60, prescriptionType: 'reps', perSide: false,
      notes: 'Lower for 5 seconds. Use bodyweight, dumbbells or a barbell; log total external load. Mobility only; never a main lift.',
    },
    programming: {
      strengthRole: 'none', automaticMinimum: 'new', manualMinimum: 'new',
      warmup: true, primer: false,
    },
  },
  'Crab Hold': {
    movement: 'core', region: 'full', load: 'low',
    fatigue: 'low', doms: 'low', stability: 'moderate',
    unilateral: false, eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'caution',
      'quad': 'good',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'caution',
      'shoulder': 'avoid',
      'elbow': 'caution',
      'wrist/hand': 'avoid',
    },
    prescription: {
      sets: 2, repsMin: 15, repsMax: 30,
      restSeconds: 30, prescriptionType: 'duration', perSide: false,
      notes: 'Hold with an open chest. Bodyweight. Familiar and pain-free near games.',
    },
    programming: {
      strengthRole: 'none', automaticMinimum: 'new', manualMinimum: 'new',
      warmup: true, primer: false,
    },
  },
  'Standing Knee Extension': {
    movement: 'isolation_lower', region: 'lower', load: 'low',
    fatigue: 'low', doms: 'low', stability: 'moderate',
    unilateral: true, eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
    prescription: {
      sets: 2, repsMin: 5, repsMax: 5,
      restSeconds: 30, prescriptionType: 'reps', perSide: true,
      notes: 'Squeeze for 5 seconds each rep. Bodyweight.',
    },
    programming: {
      automaticMinimum: 'new', manualMinimum: 'new', warmup: true,
      primer: false,
    },
  },
  'Seated Single-Leg Pike Lift': {
    movement: 'isolation_lower', region: 'lower', load: 'low',
    fatigue: 'low', doms: 'low', stability: 'low',
    unilateral: true, eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
    prescription: {
      sets: 2, repsMin: 6, repsMax: 10,
      restSeconds: 30, prescriptionType: 'reps', perSide: true,
      notes: 'Hold each rep for 2 seconds. Bodyweight.',
    },
    programming: {
      automaticMinimum: 'new', manualMinimum: 'new', warmup: true,
      primer: false,
    },
  },
  'Horse Stance Hold': {
    movement: 'isolation_lower', region: 'lower', load: 'low',
    fatigue: 'low', doms: 'low', stability: 'low',
    unilateral: false, eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'good',
      'knee': 'caution',
      'calf': 'good',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
    prescription: {
      sets: 2, repsMin: 60, repsMax: 60,
      restSeconds: 30, prescriptionType: 'duration', perSide: false,
      notes: 'Bodyweight; use a higher or narrower stance as the beginner regression. Progress depth, stance width or hold duration before optional dumbbell load.',
    },
    programming: {
      strengthRole: 'none', automaticMinimum: 'new', manualMinimum: 'new',
      excludeWithinDaysOfGame: 1, warmup: true, primer: false,
    },
  },
  'Bench Thoracic Extension': {
    movement: 'core', region: 'upper', load: 'low',
    fatigue: 'low', doms: 'low', stability: 'low',
    unilateral: false, eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'caution',
      'calf': 'good',
      'ankle/foot': 'caution',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'caution',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'good',
    },
    prescription: {
      sets: 2, repsMin: 5, repsMax: 5,
      restSeconds: 30, prescriptionType: 'reps', perSide: false,
      notes: 'Slow reps. Pause 3 seconds at the bottom. Bodyweight only; use a comfortable range near games.',
    },
    programming: {
      strengthRole: 'none', automaticMinimum: 'new', manualMinimum: 'new',
      warmup: true, primer: false,
    },
  },
  'Sleeper Stretch': {
    movement: 'isolation_upper', region: 'upper', load: 'low',
    fatigue: 'low', doms: 'low', stability: 'low',
    unilateral: true, eccentric: 'low', lateWeek: 'caution',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'good',
      'neck': 'caution',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
    prescription: {
      sets: 2, repsMin: 30, repsMax: 30,
      restSeconds: 15, prescriptionType: 'duration', perSide: true,
      notes: 'Gentle pressure from the opposite hand; no external loading or bouncing. Use short, comfortable holds near games and avoid aggressive holds before throwing, pressing or contact.',
    },
    programming: {
      strengthRole: 'none', automaticMinimum: 'new', manualMinimum: 'new',
      warmup: true, primer: false,
    },
  },
  'Foam Roller Thoracic Extension': {
    movement: 'core', region: 'upper', load: 'low',
    fatigue: 'low', doms: 'low', stability: 'low',
    unilateral: false, eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'caution',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
    prescription: {
      sets: 2, repsMin: 5, repsMax: 5,
      restSeconds: 30, prescriptionType: 'reps', perSide: false,
      notes: 'Slow reps. Pause 5 seconds overhead. Hold one light dumbbell or weight plate in both hands and record total load; beginners may use no weight. Keep the range comfortable near games.',
    },
    programming: {
      strengthRole: 'none', automaticMinimum: 'new', manualMinimum: 'new',
      warmup: true, primer: false,
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // RECOVERY — MOBILITY / TISSUE QUALITY / BREATHING / ZONE-1 WALKS
  // Sam, 2026-09-04 (R-364): the complete intake supersedes the 24 July
  // "mobility untagged" exemption for these 33. Authored in
  // docs/EXERCISE_INTAKE_RECOVERY_2026-09-04.md; every pool contraindication
  // is Avoid; the pool entry owns the dose, so no prescription is carried.
  // ═══════════════════════════════════════════════════════════════

  'Hip 90/90 Stretch': {
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'low', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'avoid',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'avoid',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
    programming: {
      strengthRole: 'none', automaticMinimum: 'new', manualMinimum: 'new',
      warmup: true, primer: true,
    },
  },

  'Cat-Cow': {
    movement: 'core', region: 'core', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'low', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'caution',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
    programming: {
      strengthRole: 'none', automaticMinimum: 'new', manualMinimum: 'new',
      warmup: true, primer: true,
    },
  },

  'World\'s Greatest Stretch': {
    movement: 'isolation_lower', region: 'full', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
    programming: {
      strengthRole: 'none', automaticMinimum: 'new', manualMinimum: 'new',
      warmup: true, primer: true,
    },
  },

  'Deep Squat Hold': {
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'low', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'good',
      'knee': 'avoid',
      'calf': 'caution',
      'ankle/foot': 'avoid',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
    programming: {
      strengthRole: 'none', automaticMinimum: 'new', manualMinimum: 'new',
      warmup: true, primer: true,
    },
  },

  'Couch Stretch': {
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'low', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'avoid',
      'quad': 'caution',
      'hamstring': 'good',
      'knee': 'avoid',
      'calf': 'good',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
    programming: {
      strengthRole: 'none', automaticMinimum: 'new', manualMinimum: 'new',
      warmup: true, primer: true,
    },
  },

  'Open Book Thoracic Rotation': {
    movement: 'core', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'low', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'caution',
      'shoulder': 'caution',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
    programming: {
      strengthRole: 'none', automaticMinimum: 'new', manualMinimum: 'new',
      warmup: true, primer: true,
    },
  },

  'Pigeon Stretch': {
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'low', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'avoid',
      'quad': 'caution',
      'hamstring': 'good',
      'knee': 'avoid',
      'calf': 'good',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'caution',
    },
    programming: {
      strengthRole: 'none', automaticMinimum: 'new', manualMinimum: 'new',
      warmup: true, primer: true,
    },
  },

  'Adductor Rockback': {
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'low', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'avoid',
      'hip': 'caution',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'caution',
      'calf': 'good',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
    programming: {
      strengthRole: 'none', automaticMinimum: 'new', manualMinimum: 'new',
      warmup: true, primer: true,
    },
  },

  'Chest / Pec Stretch (Doorway)': {
    movement: 'isolation_upper', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'low', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'good',
      'neck': 'good',
      'shoulder': 'avoid',
      'elbow': 'caution',
      'wrist/hand': 'good',
    },
    programming: {
      strengthRole: 'none', automaticMinimum: 'new', manualMinimum: 'new',
      warmup: true, primer: true,
    },
  },

  'Lat Stretch': {
    movement: 'isolation_upper', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'low', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'avoid',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
    programming: {
      strengthRole: 'none', automaticMinimum: 'new', manualMinimum: 'new',
      warmup: true, primer: true,
    },
  },

  'Dead Hang': {
    movement: 'isolation_upper', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'low', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'good',
      'neck': 'good',
      'shoulder': 'avoid',
      'elbow': 'avoid',
      'wrist/hand': 'caution',
    },
    programming: {
      strengthRole: 'none', automaticMinimum: 'new', manualMinimum: 'new',
      warmup: true, primer: true,
    },
  },

  'Toe Stretch': {
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'low', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'avoid',
      'ribs': 'good',
      'lowerBack': 'good',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
    programming: {
      strengthRole: 'none', automaticMinimum: 'new', manualMinimum: 'new',
      warmup: true, primer: true,
    },
  },

  'Calf Stretch': {
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'low', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'avoid',
      'ankle/foot': 'avoid',
      'ribs': 'good',
      'lowerBack': 'good',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
    programming: {
      strengthRole: 'none', automaticMinimum: 'new', manualMinimum: 'new',
      warmup: true, primer: true,
    },
  },

  'QL Back Extension': {
    movement: 'core', region: 'core', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'low', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'caution',
      'quad': 'good',
      'hamstring': 'caution',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'caution',
      'ribs': 'caution',
      'lowerBack': 'avoid',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
    programming: {
      strengthRole: 'none', automaticMinimum: 'new', manualMinimum: 'new',
      warmup: true, primer: true,
    },
  },

  'ATG Split Squat': {
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'moderate', stability: 'moderate', unilateral: true,
    eccentric: 'moderate', lateWeek: 'caution',
    injury: {
      'groin': 'caution',
      'hip': 'avoid',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'avoid',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
    programming: {
      strengthRole: 'none', automaticMinimum: 'new', manualMinimum: 'new',
      warmup: true, primer: true,
    },
  },

  'Elephant Walks': {
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'low', unilateral: true,
    eccentric: 'low', lateWeek: 'caution',
    injury: {
      'groin': 'good',
      'hip': 'caution',
      'quad': 'good',
      'hamstring': 'avoid',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'avoid',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'caution',
    },
    programming: {
      strengthRole: 'none', automaticMinimum: 'new', manualMinimum: 'new',
      warmup: true, primer: true,
    },
  },

  'Butterfly Stretch': {
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'low', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'avoid',
      'hip': 'avoid',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'avoid',
      'calf': 'good',
      'ankle/foot': 'avoid',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
    programming: {
      strengthRole: 'none', automaticMinimum: 'new', manualMinimum: 'new',
      warmup: true, primer: true,
    },
  },

  'Pissing Dog Against Wall': {
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'low', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'avoid',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'caution',
      'calf': 'good',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'avoid',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
    programming: {
      strengthRole: 'none', automaticMinimum: 'new', manualMinimum: 'new',
      warmup: true, primer: true,
    },
  },

  'Jefferson Curl': {
    movement: 'core', region: 'core', load: 'low', fatigue: 'low',
    doms: 'moderate', stability: 'low', unilateral: false,
    eccentric: 'moderate', lateWeek: 'caution',
    injury: {
      'groin': 'good',
      'hip': 'caution',
      'quad': 'good',
      'hamstring': 'avoid',
      'knee': 'good',
      'calf': 'caution',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'avoid',
      'neck': 'avoid',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
    programming: {
      strengthRole: 'none', automaticMinimum: 'new', manualMinimum: 'new',
      warmup: true, primer: true,
    },
  },

  'Dumbbell Pullovers': {
    movement: 'isolation_upper', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'low', unilateral: false,
    eccentric: 'low', lateWeek: 'caution',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'avoid',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'avoid',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
    programming: {
      strengthRole: 'none', automaticMinimum: 'new', manualMinimum: 'new',
      warmup: true, primer: true,
    },
  },

  'Foam Roll — Hip Flexor, Quad, Adductors': {
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'low', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'good',
      'knee': 'caution',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'good',
    },
    programming: {
      strengthRole: 'none', automaticMinimum: 'new', manualMinimum: 'new',
      warmup: true, primer: true,
    },
  },

  'Foam Roll — T-Spine': {
    movement: 'core', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'low', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'caution',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
    programming: {
      strengthRole: 'none', automaticMinimum: 'new', manualMinimum: 'new',
      warmup: true, primer: true,
    },
  },

  'Foam Roll — IT Band': {
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'low', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'good',
      'knee': 'caution',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'good',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
    programming: {
      strengthRole: 'none', automaticMinimum: 'new', manualMinimum: 'new',
      warmup: true, primer: true,
    },
  },

  'Foam Roll — Lats': {
    movement: 'isolation_upper', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'low', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'good',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
    programming: {
      strengthRole: 'none', automaticMinimum: 'new', manualMinimum: 'new',
      warmup: true, primer: true,
    },
  },

  'Foam Roll — Calves & Outer Shins': {
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'low', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'good',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
    programming: {
      strengthRole: 'none', automaticMinimum: 'new', manualMinimum: 'new',
      warmup: true, primer: true,
    },
  },

  'Lacrosse Ball Glute Release': {
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'low', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'caution',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
    programming: {
      strengthRole: 'none', automaticMinimum: 'new', manualMinimum: 'new',
      warmup: true, primer: true,
    },
  },

  '90/90 Breathing': {
    movement: 'core', region: 'core', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'low', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'good',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
    programming: {
      strengthRole: 'none', automaticMinimum: 'new', manualMinimum: 'new',
      warmup: true, primer: true,
    },
  },

  'Crocodile Breathing': {
    movement: 'core', region: 'core', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'low', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'good',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
    programming: {
      strengthRole: 'none', automaticMinimum: 'new', manualMinimum: 'new',
      warmup: true, primer: true,
    },
  },

  'Box Breathing': {
    movement: 'core', region: 'core', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'low', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'good',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
    programming: {
      strengthRole: 'none', automaticMinimum: 'new', manualMinimum: 'new',
      warmup: true, primer: true,
    },
  },

  'Child\'s Pose with Breathing': {
    movement: 'core', region: 'core', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'low', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'caution',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'caution',
      'calf': 'good',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'good',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
    programming: {
      strengthRole: 'none', automaticMinimum: 'new', manualMinimum: 'new',
      warmup: true, primer: true,
    },
  },

  'Light Walk or Stationary Bike': {
    movement: 'conditioning', region: 'full', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'low', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'good',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
    programming: {
      strengthRole: 'none', automaticMinimum: 'new', manualMinimum: 'new',
      warmup: true, primer: true,
    },
  },

  'Incline Treadmill Walk': {
    movement: 'conditioning', region: 'full', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'low', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'good',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
    programming: {
      strengthRole: 'none', automaticMinimum: 'new', manualMinimum: 'new',
      warmup: true, primer: true,
    },
  },

  'Outdoor Walk': {
    movement: 'conditioning', region: 'full', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'low', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'good',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
    programming: {
      strengthRole: 'none', automaticMinimum: 'new', manualMinimum: 'new',
      warmup: true, primer: true,
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // LOWER BODY — SQUAT / LUNGE
  // ═══════════════════════════════════════════════════════════════

  'Back Squat': {
    strengthClassification: 'compound',
    movement: 'squat', region: 'lower', load: 'high', fatigue: 'high',
    doms: 'moderate', stability: 'moderate', unilateral: false,
    eccentric: 'moderate', lateWeek: 'avoid',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'caution',
      'lowerBack': 'avoid',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  // Sam, 2026-08-26: "front squats are arguably worse [for a shoulder] if you
  // do them with a different grip ... remove it from good". The rack-position
  // squats (Front/Box/High Box) now match Back Squat's own shoulder: 'caution'
  // — the sheet's existing convention for a bar carried on the shoulders.
  'Front Squat': {
    strengthClassification: 'compound',
    movement: 'squat', region: 'lower', load: 'high', fatigue: 'high',
    doms: 'moderate', stability: 'moderate', unilateral: false,
    eccentric: 'moderate', lateWeek: 'avoid',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Box Squat': {
    strengthClassification: 'compound',
    movement: 'squat', region: 'lower', load: 'high', fatigue: 'moderate',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'caution',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'good',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Goblet Squat': {
    strengthClassification: 'compound',
    movement: 'squat', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'caution',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'good',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Bodyweight Squat': {
    strengthClassification: 'compound',
    movement: 'squat', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  'High Box Squat': {
    strengthClassification: 'compound',
    movement: 'squat', region: 'lower', load: 'high', fatigue: 'moderate',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'caution',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'good',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Bulgarian Split Squats': {
    strengthClassification: 'compound',
    movement: 'lunge', region: 'lower', load: 'moderate', fatigue: 'high',
    doms: 'high', stability: 'moderate', unilateral: true,
    eccentric: 'high', lateWeek: 'avoid',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Walking Lunges': {
    strengthClassification: 'compound',
    movement: 'lunge', region: 'lower', load: 'moderate', fatigue: 'high',
    doms: 'high', stability: 'low', unilateral: true,
    eccentric: 'high', lateWeek: 'avoid',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Reverse Lunges': {
    strengthClassification: 'compound',
    movement: 'lunge', region: 'lower', load: 'moderate', fatigue: 'moderate',
    doms: 'moderate', stability: 'moderate', unilateral: true,
    eccentric: 'moderate', lateWeek: 'caution',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Step Ups': {
    strengthClassification: 'compound',
    movement: 'lunge', region: 'lower', load: 'moderate', fatigue: 'moderate',
    doms: 'low', stability: 'moderate', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'good',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },



  'Slant Board Step-Down': {
    movement: 'lunge', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: true,
    eccentric: 'moderate', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  'Cossack Squat': {
    strengthClassification: 'compound',
    movement: 'lunge', region: 'lower', load: 'low', fatigue: 'moderate',
    doms: 'moderate', stability: 'low', unilateral: true,
    eccentric: 'moderate', lateWeek: 'caution',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  'Lateral Lunge': {
    strengthClassification: 'compound',
    movement: 'lunge', region: 'lower', load: 'low', fatigue: 'moderate',
    doms: 'moderate', stability: 'moderate', unilateral: true,
    eccentric: 'moderate', lateWeek: 'caution',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  'Single-Leg Squat (to Box)': {
    strengthClassification: 'compound',
    movement: 'squat', region: 'lower', load: 'low', fatigue: 'moderate',
    doms: 'low', stability: 'low', unilateral: true,
    eccentric: 'moderate', lateWeek: 'caution',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Leg Press': {
    strengthClassification: 'compound',
    movement: 'squat', region: 'lower', load: 'moderate', fatigue: 'moderate',
    doms: 'moderate', stability: 'high', unilateral: false,
    eccentric: 'moderate', lateWeek: 'caution',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'good',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  'Single-Leg Leg Press': {
    strengthClassification: 'compound',
    movement: 'squat', region: 'lower', load: 'moderate', fatigue: 'moderate',
    doms: 'low', stability: 'high', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // LOWER BODY — HINGE
  // ═══════════════════════════════════════════════════════════════

  'Deadlift': {
    strengthClassification: 'compound',
    movement: 'hinge', region: 'lower', load: 'high', fatigue: 'high',
    doms: 'high', stability: 'moderate', unilateral: false,
    eccentric: 'moderate', lateWeek: 'avoid',
    injury: {
      'groin': 'avoid',
      'hip': 'caution',
      'quad': 'good',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'caution',
      'lowerBack': 'avoid',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Trap Bar Deadlift': {
    strengthClassification: 'compound',
    movement: 'hinge', region: 'lower', load: 'high', fatigue: 'high',
    doms: 'moderate', stability: 'moderate', unilateral: false,
    eccentric: 'moderate', lateWeek: 'avoid',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'good',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'RDLs': {
    strengthClassification: 'compound',
    movement: 'hinge', region: 'lower', load: 'moderate', fatigue: 'moderate',
    doms: 'high', stability: 'moderate', unilateral: false,
    eccentric: 'high', lateWeek: 'avoid',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'good',
      'hamstring': 'avoid',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  /**
   * ⚠ **HAMSTRING IS `avoid`, NOT `caution` — Sam, 2026-09-04: *"single leg rdl
   * should be avoid for hammy injuries"*.**
   *
   * It was `caution`, which made it the one RDL-family lift a hamstring injury
   * still permitted — `RDLs` and `B-Stance RDL` are both `avoid`. A single-leg
   * RDL is gentler than a loaded bilateral one, but it is still a loaded
   * hamstring lengthening under injury, and the family it belongs to says so.
   *
   * Surfaced while chasing a `prohibited_pattern_breach`: R-373 let a graded
   * single-leg hinge fill the MAIN hinge seat, and this was the only member of
   * that family a hamstring prohibition did not already stop.
   */
  'Single-Leg RDL': {
    strengthClassification: 'compound',
    movement: 'hinge', region: 'lower', load: 'low', fatigue: 'moderate',
    doms: 'moderate', stability: 'low', unilateral: true,
    eccentric: 'moderate', lateWeek: 'caution',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'good',
      'hamstring': 'avoid',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  /**
   * R-368, Sam's signed intake 2026-09-04
   * (`docs/EXERCISE_INTAKE_B_STANCE_RDL_2026-09-04.md`).
   *
   * ⚠ **NOT A COPY OF THE `Single-Leg RDL` ROW ABOVE, AND THE DIFFERENCES ARE
   * THE POINT.** `hamstring` is **avoid** rather than caution — a B-stance
   * loads the front hamstring harder because the rear leg is not sharing the
   * work — while `knee` is good and `stability` is moderate rather than low,
   * because the rear foot is a kickstand. `load` and `eccentric` rise with it.
   * A row that merely inherited Single-Leg RDL's ratings would offer this lift
   * to a hamstring the app is supposed to be protecting.
   *
   * What IS shared is shared through its owner, never duplicated here:
   * `movement: 'hinge'` + `unilateral: true` is what makes
   * `slotsForExerciseName` seat it in `single_leg_hip`, exactly as it does for
   * Single-Leg RDL, and `lateWeek: 'caution'` is the same season/game rating
   * Sam's sheet asked for.
   */
  'B-Stance RDL': {
    strengthClassification: 'compound',
    movement: 'hinge', region: 'lower', load: 'moderate', fatigue: 'moderate',
    doms: 'moderate', stability: 'moderate', unilateral: true,
    eccentric: 'high', lateWeek: 'caution',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'good',
      'hamstring': 'avoid',
      'knee': 'good',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Hip Thrusts': {
    strengthClassification: 'compound',
    movement: 'hinge', region: 'lower', load: 'moderate', fatigue: 'moderate',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'caution',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'good',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Glute Bridge': {
    strengthClassification: 'compound',
    movement: 'hinge', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'good',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  'Single-Leg Hip Thrust': {
    strengthClassification: 'isolation',
    movement: 'isolation_lower', region: 'lower', load: 'moderate', fatigue: 'moderate',
    doms: 'low', stability: 'moderate', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Back Extension': {
    strengthClassification: 'isolation',
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'moderate', lateWeek: 'good',
    injury: {
      'groin': 'avoid',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Nordic Lower': {
    strengthClassification: 'isolation',
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'high',
    doms: 'high', stability: 'low', unilateral: false,
    eccentric: 'high', lateWeek: 'avoid',
    nordicCurlVariant: 'full_unassisted_eccentric',
    programming: {
      automaticMinimum: 'developing', manualMinimum: 'new',
      automaticExcludeWithinDaysOfGame: 2,
      warmup: false, primer: false,
    },
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'avoid',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  'Kettlebell Swings': {
    strengthClassification: 'compound',
    movement: 'hinge', region: 'lower', load: 'moderate', fatigue: 'moderate',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'caution',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'good',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // LOWER BODY — ISOLATION (rehab / prehab / tissue work)
  //
  // Accessory-only pool. Low-load, low-fatigue isolation movements
  // used for volume, tissue work, and injury prehab. No progression
  // transfer — loadRatio=0 by convention.
  // ═══════════════════════════════════════════════════════════════

  'Leg Extension': {
    strengthClassification: 'isolation',
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'good',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  'Calf Raises': {
    strengthClassification: 'isolation',
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  'Tib Raises': {
    strengthClassification: 'isolation',
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  'T-Bar Tib Raises': {
    strengthClassification: 'isolation',
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'moderate', stability: 'high', unilateral: false,
    eccentric: 'moderate', lateWeek: 'caution',
    prescription: {
      sets: 2, repsMin: 15, repsMax: 20, restSeconds: 30,
      prescriptionType: 'reps', perSide: false,
      notes: 'Begin with the empty tib bar or a light load. Keep full ankle range and lower under control. Record total external load.',
    },
    programming: {
      strengthRole: 'accessory', automaticMinimum: 'new', manualMinimum: 'new',
      warmup: true, primer: false,
    },
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  'Single-Leg Calf Raise': {
    strengthClassification: 'isolation',
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: true,
    eccentric: 'moderate', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  'Seated Calf Raise': {
    strengthClassification: 'isolation',
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  /**
   * Abductor Machine and Adductor Machine were RETIRED by Sam's locked-list
   * changeset (2026-07-24, late ruling) — cue, video, tags, load profile and
   * the isolation_lower pool slot all deleted. The muscle-block mechanism they
   * were waiting on (PROGRAMMING_DESIGN_SESSION D3/D11) is no longer needed for
   * them. Groin coverage after the removal is Copenhagens + Groin Squeeze +
   * Cossack Squat + Lateral Lunge, per the changeset's NOTES.
   */

  'Groin Squeeze': {
    strengthClassification: 'isolation',
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },


  'Banded TKE': {
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  'Spanish Squat Hold': {
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  'Copenhagen Plank (Half)': {
    strengthClassification: 'isolation',
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'moderate',
    doms: 'moderate', stability: 'low', unilateral: true,
    eccentric: 'moderate', lateWeek: 'caution',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'good',
    },
  },


  'Long-Lever Copenhagen': {
    strengthClassification: 'isolation',
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'moderate',
    doms: 'moderate', stability: 'low', unilateral: true,
    eccentric: 'moderate', lateWeek: 'caution',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'good',
    },
  },


  'Hamstring Curl': {
    strengthClassification: 'isolation',
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'moderate', stability: 'high', unilateral: false,
    eccentric: 'moderate', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  'Crab Walks': {
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  'Swiss Ball Hamstring Curl': {
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    // A useful regression for less-experienced athletes, but never an
    // automatic advanced-athlete choice. Manual Add remains unrestricted.
    programming: {
      automaticMinimum: 'new', automaticMaximum: 'consistent',
      manualMinimum: 'new', warmup: false, primer: false,
    },
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  'Bosch Hold': {
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // LOWER BODY — POWER / PLYO
  // ═══════════════════════════════════════════════════════════════

  'Vertical Jump': {
    movement: 'plyo', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'caution', power: true,
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },


  'Pogo Hops': {
    movement: 'plyo', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good', power: true,
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  'Kneeling Jump': {
    movement: 'plyo', region: 'lower', load: 'low', fatigue: 'moderate',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'caution', power: true,
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  'Lateral Jump': {
    movement: 'plyo', region: 'lower', load: 'low', fatigue: 'moderate',
    doms: 'low', stability: 'low', unilateral: true,
    eccentric: 'moderate', lateWeek: 'caution', power: true,
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  'Box Jumps': {
    movement: 'plyo', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'caution', power: true,
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  'Broad Jumps': {
    movement: 'plyo', region: 'lower', load: 'low', fatigue: 'moderate',
    doms: 'low', stability: 'low', unilateral: false,
    eccentric: 'moderate', lateWeek: 'avoid', power: true,
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  'Jump Squats': {
    movement: 'plyo', region: 'lower', load: 'low', fatigue: 'moderate',
    doms: 'moderate', stability: 'moderate', unilateral: false,
    eccentric: 'moderate', lateWeek: 'avoid', power: true,
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  'Lateral Bounds': {
    movement: 'plyo', region: 'lower', load: 'low', fatigue: 'moderate',
    doms: 'moderate', stability: 'low', unilateral: true,
    eccentric: 'moderate', lateWeek: 'avoid', power: true,
    injury: {
      'groin': 'avoid',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  'RFE Split Squat Jump': {
    movement: 'plyo', region: 'lower', load: 'low', fatigue: 'high',
    doms: 'moderate', stability: 'low', unilateral: true,
    eccentric: 'high', lateWeek: 'avoid', power: true,
    injury: {
      'groin': 'avoid',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'avoid',
      'knee': 'avoid',
      'calf': 'avoid',
      'ankle/foot': 'avoid',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  'Single-Leg Hop and Stick': {
    movement: 'plyo', region: 'lower', load: 'moderate', fatigue: 'low',
    doms: 'low', stability: 'low', unilateral: true,
    eccentric: 'high', lateWeek: 'caution', power: true,
    prescription: {
      sets: 2, repsMin: 5, repsMax: 5, restSeconds: 120,
      prescriptionType: 'reps', perSide: true,
      notes: 'Reset fully before every repetition. Start with a short-to-moderate hop and progress distance only while the landing stays controlled.',
    },
    programming: {
      automaticMinimum: 'consistent', manualMinimum: 'consistent',
      excludeWithinDaysOfGame: 1, automaticExcludeWithinDaysOfGame: 1,
      warmup: false, primer: true,
    },
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'avoid',
      'calf': 'avoid',
      'ankle/foot': 'avoid',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  'Depth Jumps': {
    movement: 'plyo', region: 'lower', load: 'low', fatigue: 'high',
    doms: 'moderate', stability: 'low', unilateral: false,
    eccentric: 'high', lateWeek: 'avoid', power: true,
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'avoid',
      'calf': 'caution',
      'ankle/foot': 'avoid',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // UPPER BODY — HORIZONTAL PUSH
  // ═══════════════════════════════════════════════════════════════

  'Bench Press': {
    strengthClassification: 'compound',
    movement: 'horizontal_push', region: 'upper', load: 'high', fatigue: 'high',
    doms: 'moderate', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'good',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'DB Bench Press': {
    strengthClassification: 'compound',
    movement: 'horizontal_push', region: 'upper', load: 'moderate', fatigue: 'moderate',
    doms: 'moderate', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'good',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Incline Bench': {
    strengthClassification: 'compound',
    movement: 'horizontal_push', region: 'upper', load: 'moderate', fatigue: 'moderate',
    doms: 'moderate', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Incline DB Bench': {
    strengthClassification: 'compound',
    movement: 'horizontal_push', region: 'upper', load: 'moderate', fatigue: 'moderate',
    doms: 'moderate', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Close Grip Bench': {
    strengthClassification: 'compound',
    movement: 'horizontal_push', region: 'upper', load: 'moderate', fatigue: 'moderate',
    doms: 'moderate', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'good',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Push-ups': {
    strengthClassification: 'compound',
    movement: 'horizontal_push', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'good',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Incline Push-Up': {
    strengthClassification: 'compound',
    movement: 'horizontal_push', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'moderate', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'caution',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'caution',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Dips': {
    strengthClassification: 'compound',
    movement: 'horizontal_push', region: 'upper', load: 'moderate', fatigue: 'moderate',
    doms: 'moderate', stability: 'moderate', unilateral: false,
    eccentric: 'high', lateWeek: 'caution',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'good',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Single-Arm DB Floor Press': {
    strengthClassification: 'compound',
    movement: 'horizontal_push', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'good',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Single-Arm DB Bench Press': {
    strengthClassification: 'compound',
    movement: 'horizontal_push', region: 'upper', load: 'moderate', fatigue: 'moderate',
    doms: 'moderate', stability: 'low', unilateral: true,
    eccentric: 'low', lateWeek: 'caution',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'good',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Scap Push-Up': {
    movement: 'horizontal_push', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },
  // Sam, 2026-07-28. This entry was the PRECEDENT: the first to write every
  // injury key out deliberately, so a reviewed-and-safe rating could not be
  // mistaken for one nobody had looked at. Every entry now does the same, and
  // the helper that made omission possible is gone.
  'Scap Pull Ups': {
    movement: 'vertical_pull', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'good',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // UPPER BODY — VERTICAL PUSH
  // ═══════════════════════════════════════════════════════════════

  'Overhead Press': {
    strengthClassification: 'compound',
    movement: 'vertical_push', region: 'upper', load: 'high', fatigue: 'high',
    doms: 'moderate', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'caution',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'caution',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'DB Shoulder Press': {
    strengthClassification: 'compound',
    movement: 'vertical_push', region: 'upper', load: 'moderate', fatigue: 'moderate',
    doms: 'moderate', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'caution',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'caution',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Landmine Press': {
    strengthClassification: 'compound',
    movement: 'vertical_push', region: 'upper', load: 'moderate', fatigue: 'moderate',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'caution',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },


  'Bottoms-Up KB Press': {
    movement: 'vertical_push', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'low', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'caution',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Z-Press': {
    strengthClassification: 'compound',
    movement: 'vertical_push', region: 'upper', load: 'moderate', fatigue: 'moderate',
    doms: 'low', stability: 'low', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'caution',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Seated DB Press': {
    strengthClassification: 'compound',
    movement: 'vertical_push', region: 'upper', load: 'moderate', fatigue: 'moderate',
    doms: 'moderate', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'caution',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Half-Kneeling Single-Arm Overhead Press': {
    strengthClassification: 'compound',
    movement: 'vertical_push', region: 'upper', load: 'moderate', fatigue: 'moderate',
    doms: 'low', stability: 'high', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'caution',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // UPPER BODY — HORIZONTAL PULL
  // ═══════════════════════════════════════════════════════════════

  'Bent Row': {
    strengthClassification: 'compound',
    movement: 'horizontal_pull', region: 'upper', load: 'high', fatigue: 'moderate',
    doms: 'moderate', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'caution',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Chest Supported Row': {
    strengthClassification: 'compound',
    movement: 'horizontal_pull', region: 'upper', load: 'moderate', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Chest-Supported DB Row': {
    strengthClassification: 'compound',
    movement: 'horizontal_pull', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Seated Cable Row': {
    strengthClassification: 'compound',
    movement: 'horizontal_pull', region: 'upper', load: 'moderate', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Single-Arm DB Row': {
    strengthClassification: 'compound',
    movement: 'horizontal_pull', region: 'upper', load: 'moderate', fatigue: 'moderate',
    doms: 'low', stability: 'high', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Inverted Row (Bodyweight)': {
    strengthClassification: 'compound',
    movement: 'horizontal_pull', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // UPPER BODY — VERTICAL PULL
  // ═══════════════════════════════════════════════════════════════

  'Pull-Ups': {
    strengthClassification: 'compound',
    movement: 'vertical_pull', region: 'upper', load: 'high', fatigue: 'moderate',
    doms: 'moderate', stability: 'low', unilateral: false,
    eccentric: 'moderate', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Band-Assisted Pull-Up': {
    strengthClassification: 'compound',
    movement: 'vertical_pull', region: 'upper', load: 'moderate', fatigue: 'moderate',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'moderate', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'caution',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'caution',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Chin-Ups': {
    strengthClassification: 'compound',
    movement: 'vertical_pull', region: 'upper', load: 'high', fatigue: 'moderate',
    doms: 'moderate', stability: 'low', unilateral: false,
    eccentric: 'moderate', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Lat Pulldown': {
    strengthClassification: 'compound',
    movement: 'vertical_pull', region: 'upper', load: 'moderate', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Neutral-Grip Pulldown': {
    strengthClassification: 'compound',
    movement: 'vertical_pull', region: 'upper', load: 'moderate', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Single-Arm Lat Pulldown': {
    strengthClassification: 'compound',
    movement: 'vertical_pull', region: 'upper', load: 'moderate', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // UPPER BODY — POWER / PLYO
  // ═══════════════════════════════════════════════════════════════

  'Speed Trap Bar Deadlift': {
    movement: 'hinge', region: 'lower', load: 'moderate', fatigue: 'moderate',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'caution', power: true,
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'good',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Speed Bench': {
    movement: 'horizontal_push', region: 'upper', load: 'moderate', fatigue: 'moderate',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'avoid', power: true,
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'good',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },


  'Explosive Push-up': {
    movement: 'horizontal_push', region: 'upper', load: 'low', fatigue: 'moderate',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'moderate', lateWeek: 'avoid', power: true,
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'good',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Explosive Landmine Press': {
    movement: 'vertical_push', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'caution', power: true,
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'caution',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // CORE / TRUNK
  // ═══════════════════════════════════════════════════════════════

  'Band Pallof Press': {
    movement: 'core', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Woodchop (Standing)': {
    movement: 'core', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Woodchop (Half Kneeling)': {
    movement: 'core', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Ab Wheel': {
    movement: 'core', region: 'upper', load: 'low', fatigue: 'moderate',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'moderate', lateWeek: 'caution',
    injury: {
      'groin': 'avoid',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Hanging Leg Raise': {
    movement: 'core', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Plank': {
    movement: 'core', region: 'core', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Hollow Hold': {
    movement: 'core', region: 'core', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Side Plank Row': {
    movement: 'core', region: 'core', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'low', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Side Plank': {
    movement: 'core', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Stir the Pot': {
    movement: 'core', region: 'core', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'low', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Dragon Flag': {
    movement: 'core', region: 'core', load: 'low', fatigue: 'moderate',
    doms: 'moderate', stability: 'low', unilateral: false,
    eccentric: 'high', lateWeek: 'caution',
    injury: {
      'groin': 'caution',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'avoid',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  /**
   * ⚠ **`unilateral: true` — R-370, Sam 2026-09-04: *"8 per side"*.**
   *
   * This row's own authored cue is *"Opposite arm and leg, slow"*: right arm
   * with left leg, then swap. It is one side at a time, and the trunk pool
   * entry has said `perSide: true` all along — the two records CONTRADICTED
   * each other and nobody could see it, because the strength card did not
   * render the field until R-369.
   *
   * **THE CONTRADICTION WAS LIVE IN A SECOND PLACE.** The manual Add door
   * doses core rows `perSide: tags.unilateral`, so adding Dead Bug by hand gave
   * a TOTAL while automatic programming gave per side — the same exercise, two
   * answers, depending on which door the athlete came through. Flipping the tag
   * is what makes both doors agree.
   *
   * Its two loaded siblings went the OTHER way in the same ruling: `Banded Dead
   * Bug` and `Weighted Dead Bug` lost their `perSide` because their cues say
   * both arms move together. Sam: *"those deadbugs are double limb"*.
   *
   * Known and accepted: `exerciseSubstitutes` counts a bilateral↔unilateral
   * difference as a swap-suggestion AXIS and labels it "unilateral variation".
   * Neither blocks a swap; both are descriptive, and describing this movement
   * as one-sided is the honest answer.
   */
  'Dead Bug': {
    movement: 'core', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Banded Dead Bug': {
    movement: 'core', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Weighted Dead Bug': {
    movement: 'core', region: 'upper', load: 'low', fatigue: 'moderate',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'caution',
    injury: {
      'groin': 'caution',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'McGill Sit Up': {
    movement: 'core', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Bird Dog': {
    movement: 'core', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // CARRIES
  // ═══════════════════════════════════════════════════════════════

  'Farmer Carry': {
    movement: 'carry', region: 'upper', load: 'moderate', fatigue: 'moderate',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'caution',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Suitcase Carry': {
    movement: 'carry', region: 'upper', load: 'moderate', fatigue: 'moderate',
    doms: 'low', stability: 'moderate', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'caution',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Bear Carry': {
    movement: 'carry', region: 'upper', load: 'moderate', fatigue: 'moderate',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'caution',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Overhead Carry': {
    movement: 'carry', region: 'upper', load: 'moderate', fatigue: 'moderate',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'caution',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },



  // ═══════════════════════════════════════════════════════════════
  // SHOULDERS / UPPER BACK
  // ═══════════════════════════════════════════════════════════════

  'Lateral Raise': {
    strengthClassification: 'isolation',
    movement: 'isolation_upper', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Face Pull': {
    strengthClassification: 'isolation',
    movement: 'horizontal_pull', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Cable Face Pull': {
    strengthClassification: 'isolation',
    movement: 'horizontal_pull', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Rear Delt Fly': {
    strengthClassification: 'isolation',
    movement: 'horizontal_pull', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Band Pull-Apart': {
    strengthClassification: 'isolation',
    movement: 'horizontal_pull', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Banded External Rotation': {
    movement: 'isolation_upper', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Banded 90/90 External Rotation': {
    movement: 'isolation_upper', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    prescription: {
      sets: 2, repsMin: 15, repsMax: 20, restSeconds: 20,
      prescriptionType: 'reps', perSide: true,
      notes: 'Use band resistance. Reduce resistance or range if the shoulder shrugs, the ribs lift, the back arches or the front of the shoulder pinches.',
    },
    programming: {
      strengthRole: 'none', automaticMinimum: 'new', manualMinimum: 'new',
      warmup: true, primer: false,
    },
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'good',
      'neck': 'caution',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Shrugs': {
    strengthClassification: 'isolation',
    movement: 'isolation_upper', region: 'upper', load: 'moderate', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'caution',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Single-Arm Shrug': {
    strengthClassification: 'isolation',
    movement: 'isolation_upper', region: 'upper', load: 'moderate', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Incline Y Raise': {
    strengthClassification: 'isolation',
    movement: 'isolation_upper', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'caution',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // ARMS — BICEPS
  // ═══════════════════════════════════════════════════════════════

  'Bicep Curl (Barbell)': {
    strengthClassification: 'isolation',
    movement: 'isolation_upper', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Bicep Curl (Dumbbell)': {
    strengthClassification: 'isolation',
    movement: 'isolation_upper', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Hammer Curl': {
    strengthClassification: 'isolation',
    movement: 'isolation_upper', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Chin-Up Negative (Slow)': {
    strengthClassification: 'compound',
    movement: 'vertical_pull', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'moderate', stability: 'low', unilateral: false,
    eccentric: 'moderate', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Incline Dumbbell Curl': {
    strengthClassification: 'isolation',
    movement: 'isolation_upper', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'moderate', stability: 'moderate', unilateral: false,
    eccentric: 'moderate', lateWeek: 'caution',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Lying Dumbbell Curl': {
    strengthClassification: 'isolation',
    movement: 'isolation_upper', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Banded Bicep Curl': {
    strengthClassification: 'isolation',
    movement: 'isolation_upper', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Concentration Curl': {
    strengthClassification: 'isolation',
    movement: 'isolation_upper', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // ARMS — TRICEPS
  // ═══════════════════════════════════════════════════════════════

  'Tricep Pushdown': {
    strengthClassification: 'isolation',
    movement: 'isolation_upper', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Banded Tricep Pushdown': {
    strengthClassification: 'isolation',
    movement: 'isolation_upper', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Skull Crushers': {
    strengthClassification: 'isolation',
    movement: 'isolation_upper', region: 'upper', load: 'moderate', fatigue: 'low',
    doms: 'moderate', stability: 'high', unilateral: false,
    eccentric: 'moderate', lateWeek: 'caution',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Dumbbell Skull Crusher': {
    strengthClassification: 'isolation',
    movement: 'isolation_upper', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'moderate', stability: 'moderate', unilateral: false,
    eccentric: 'moderate', lateWeek: 'caution',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Overhead Tricep Extension': {
    strengthClassification: 'isolation',
    movement: 'isolation_upper', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Dumbbell Kickback': {
    strengthClassification: 'isolation',
    movement: 'isolation_upper', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: true,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
  },

  'Tricep Circuit (Dirty 30)': {
    strengthClassification: 'isolation',
    movement: 'isolation_upper', region: 'upper', load: 'low', fatigue: 'moderate',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'caution',
      'wrist/hand': 'caution',
    },
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
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'avoid',
      'knee': 'caution',
      'calf': 'avoid',
      'ankle/foot': 'caution',
      'ribs': 'caution',
      'lowerBack': 'good',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  'Hill Sprints': {
    movement: 'conditioning', region: 'full', load: 'high', fatigue: 'high',
    doms: 'high', stability: 'low', unilateral: false,
    eccentric: 'moderate', lateWeek: 'avoid',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'avoid',
      'knee': 'caution',
      'calf': 'avoid',
      'ankle/foot': 'caution',
      'ribs': 'caution',
      'lowerBack': 'good',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  'Quality Sprints': {
    movement: 'conditioning', region: 'full', load: 'high', fatigue: 'high',
    doms: 'moderate', stability: 'low', unilateral: false,
    eccentric: 'moderate', lateWeek: 'avoid',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'avoid',
      'knee': 'caution',
      'calf': 'avoid',
      'ankle/foot': 'caution',
      'ribs': 'caution',
      'lowerBack': 'good',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  'MAS Training': {
    movement: 'conditioning', region: 'full', load: 'high', fatigue: 'high',
    doms: 'moderate', stability: 'low', unilateral: false,
    eccentric: 'low', lateWeek: 'avoid',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'avoid',
      'knee': 'caution',
      'calf': 'avoid',
      'ankle/foot': 'caution',
      'ribs': 'caution',
      'lowerBack': 'good',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },


  // ── Tier B-high — High Output ──

  'MetCon': {
    movement: 'conditioning', region: 'full', load: 'high', fatigue: 'high',
    doms: 'moderate', stability: 'moderate', unilateral: false,
    eccentric: 'moderate', lateWeek: 'avoid',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  'Long Run': {
    movement: 'conditioning', region: 'full', load: 'moderate', fatigue: 'high',
    doms: 'low', stability: 'low', unilateral: false,
    eccentric: 'low', lateWeek: 'caution',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'caution',
      'lowerBack': 'good',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  '6x1km': {
    movement: 'conditioning', region: 'full', load: 'high', fatigue: 'high',
    doms: 'moderate', stability: 'low', unilateral: false,
    eccentric: 'low', lateWeek: 'avoid',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'caution',
      'lowerBack': 'good',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  'Hard Row Intervals': {
    movement: 'conditioning', region: 'full', load: 'high', fatigue: 'high',
    doms: 'moderate', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'caution',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'good',
      'wrist/hand': 'caution',
    },
  },

  'Hard SkiErg Intervals': {
    movement: 'conditioning', region: 'full', load: 'high', fatigue: 'high',
    doms: 'moderate', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'caution',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'good',
      'wrist/hand': 'caution',
    },
  },

  'Hard Assault Bike Intervals': {
    movement: 'conditioning', region: 'full', load: 'high', fatigue: 'high',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'caution',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'caution',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'good',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  // ── Tier B-low — Moderate Output ──

  'Tempo Run': {
    movement: 'conditioning', region: 'full', load: 'moderate', fatigue: 'moderate',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'caution',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'caution',
      'lowerBack': 'good',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  'Air Bike Sprints': {
    movement: 'conditioning', region: 'full', load: 'moderate', fatigue: 'moderate',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'caution',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'good',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  'Row Intervals': {
    movement: 'conditioning', region: 'full', load: 'moderate', fatigue: 'moderate',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'good',
      'wrist/hand': 'caution',
    },
  },

  'SkiErg Intervals': {
    movement: 'conditioning', region: 'full', load: 'moderate', fatigue: 'moderate',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'good',
      'wrist/hand': 'caution',
    },
  },

  'Assault Bike Intervals': {
    movement: 'conditioning', region: 'full', load: 'moderate', fatigue: 'moderate',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'caution',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'good',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  // ── Tier C — Recovery / Flush ──

  'Flush Run': {
    movement: 'conditioning', region: 'full', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'caution',
      'hip': 'caution',
      'quad': 'caution',
      'hamstring': 'caution',
      'knee': 'caution',
      'calf': 'caution',
      'ankle/foot': 'caution',
      'ribs': 'caution',
      'lowerBack': 'good',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  'Easy Bike': {
    movement: 'conditioning', region: 'full', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'good',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  'Easy Row': {
    movement: 'conditioning', region: 'full', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'good',
      'wrist/hand': 'caution',
    },
  },

  'Easy Ski': {
    movement: 'conditioning', region: 'full', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'caution',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'good',
      'wrist/hand': 'caution',
    },
  },

  'Easy Swim': {
    movement: 'conditioning', region: 'full', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'good',
      'neck': 'good',
      'shoulder': 'caution',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },

  'Light Circuits': {
    movement: 'conditioning', region: 'full', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'moderate', unilateral: false,
    eccentric: 'low', lateWeek: 'good',
    injury: {
      'groin': 'good',
      'hip': 'good',
      'quad': 'good',
      'hamstring': 'good',
      'knee': 'good',
      'calf': 'good',
      'ankle/foot': 'good',
      'ribs': 'good',
      'lowerBack': 'good',
      'neck': 'good',
      'shoulder': 'good',
      'elbow': 'good',
      'wrist/hand': 'good',
    },
  },
};

/**
 * Canonical split-upper accessory ownership (R-334).
 *
 * Kept beside the tag catalogue so generation, final-composition guards and
 * the Exercise Master workbook compare one typed answer. Shoulder is not a
 * direction: lateral-delt work belongs to Push while rear-delt/face-pull/shrug
 * work belongs to Pull.
 */
export const UPPER_ACCESSORY_AFFINITY: Readonly<Record<string, UpperAccessoryAffinity>> = {
  'Banded Bicep Curl': 'pull',
  'Bicep Curl (Barbell)': 'pull',
  'Bicep Curl (Dumbbell)': 'pull',
  'Concentration Curl': 'pull',
  'Hammer Curl': 'pull',
  'Incline Dumbbell Curl': 'pull',
  'Lying Dumbbell Curl': 'pull',
  'Band Pull-Apart': 'pull',
  'Cable Face Pull': 'pull',
  'Face Pull': 'pull',
  'Incline Y Raise': 'pull',
  'Rear Delt Fly': 'pull',
  'Shrugs': 'pull',
  'Single-Arm Shrug': 'pull',
  'Banded Tricep Pushdown': 'push',
  'Dumbbell Kickback': 'push',
  'Dumbbell Skull Crusher': 'push',
  'Lateral Raise': 'push',
  'Overhead Tricep Extension': 'push',
  'Skull Crushers': 'push',
  'Tricep Circuit (Dirty 30)': 'push',
  'Tricep Pushdown': 'push',
};

for (const [name, accessoryAffinity] of Object.entries(UPPER_ACCESSORY_AFFINITY)) {
  const tag = EXERCISE_TAGS[name];
  if (!tag) throw new Error(`Accessory affinity names untagged exercise: ${name}`);
  tag.accessoryAffinity = accessoryAffinity;
}

// ─── Lookup Helpers ───

/** Get tags for an exercise. Returns undefined if not tagged. */
export function getExerciseTags(name: string): ExerciseTag | undefined {
  // CANONICALISE FIRST — the app already knows these are the same exercise.
  //
  // THE DEFECT THIS CLOSES (measured 2026-08-13): this was a bare exact-name
  // lookup, and the generator ships names the map does not hold. 151 GYM ROWS
  // across 5 worlds resolved to NOTHING — `Face Pulls` x37, `Pallof Press` x28,
  // `Bicep Curls` x20, `Tricep Pushdowns` x20, `Romanian Deadlift` x10.
  //
  // NONE OF THEM WERE MISSING DATA. Every one resolves through the normaliser
  // the app already trusts: Face Pulls -> Face Pull (horizontal_pull),
  // Pallof Press -> Band Pallof Press (core), Bicep Curls -> Bicep Curl
  // (Dumbbell), Tricep Pushdowns -> Tricep Pushdown, Romanian Deadlift -> RDLs
  // (hinge). `hardcodedExerciseNameLockTests` has ALWAYS canonicalised before
  // asking whether a name is legal — which is why that gate is green while this
  // lookup was blind. One vocabulary, two readers, only one of them normalising.
  //
  // PURELY ADDITIVE, AND PROVEN SO BEFORE THE CHANGE: all 149 keys in this map
  // are already canonical (`canonicalExerciseName(key) === key` for every one),
  // so no existing hit can move and no tag can be lost. It can only turn an
  // `undefined` into the answer that was always there.
  //
  // WHY IT MATTERS BEYOND TIDINESS: a miss reads as "this row has no pattern",
  // which is indistinguishable from "this row is not strength work". Sam's slot
  // ruling (R-014) is composed of patterns — "a lower day with no hinge is RED"
  // would have fired on a Romanian Deadlift.
  // ⚠ LAZY require, NOT a top-level import, AND THE CYCLE IS REAL — I shipped it
  // and it crashed on module load. `exerciseCanonicalisation` pulls
  // `selectableExerciseVocabulary`, which reads `CONDITIONING_META` back out of
  // THIS file; at import time that binding is still undefined and
  // `Object.keys(undefined)` throws before a single test runs. Deferring the
  // resolve to CALL time breaks the cycle — this module is fully initialised by
  // the time anyone asks for a tag.
  //
  // TYPECHECK PASSED ON THE BROKEN VERSION. A circular import is not a type
  // error; only running it found this.
  const direct = EXERCISE_TAGS[name];
  if (direct) return direct;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { canonicalExerciseName } = require('../utils/exerciseCanonicalisation') as {
    canonicalExerciseName: (raw: string) => string;
  };
  return EXERCISE_TAGS[canonicalExerciseName(name)];
}

/**
 * ⚠ **DOES THIS MOVEMENT'S DOSE COUNT ONE SIDE? ONE OWNER, FOUR CALLERS.**
 *
 * Sam, 2026-09-04, asked whether "per side" should show on screen: **yes**.
 *
 * MEASURED over the preserved 52-week driver before the change: **200 rows
 * (male) and 202 (female) read as a TOTAL when the movement only has one
 * side** — `Single-Leg RDL`, `Walking Lunges` and `Bulgarian Split Squats` all
 * shipped a bare `3 × 8`, while `Half Copenhagen` correctly shipped
 * `3 × 30s / side`. `Side Plank` managed BOTH in the same year.
 *
 * **THE CAUSE WAS FOUR BUILDERS ANSWERING THE SAME QUESTION FROM DIFFERENT
 * PLACES**, each right about its own rows and blind outside them:
 *
 *   - `rules/composedDose` band categories — no authored field to read at all;
 *   - `utils/sessionBuilder` power rows — only the tag's `prescription`;
 *   - `utils/sessionBuilder` pool rows — only the pool entry;
 *   - `utils/addExerciseCandidates` — the ONLY one that already asked
 *     `unilateral`, which is why the manual Add door got this right while
 *     automatic programming did not.
 *
 * `unilateral` has always been the app's answer to "does this movement have a
 * side". **Nothing new is authored here and there is no name list** — this
 * function is the fourth caller's question asked once, so a fifth builder
 * cannot quietly disagree.
 *
 * ⚠ **AN AUTHORED ANSWER STILL WINS.** A pool entry or authored prescription
 * that says `perSide: false` is deliberate authorship; the tag may only fill
 * SILENCE, never overrule. `undefined` is returned rather than `false` so a
 * caller spreading the result cannot stamp a field the row never had.
 */
export function resolvePerSide(
  rawName: string,
  authoredPerSide?: boolean,
): boolean | undefined {
  if (authoredPerSide !== undefined) return authoredPerSide;
  return getExerciseTags(rawName)?.unilateral === true ? true : undefined;
}

/** The one canonical answer consumed by selection, auditing and completeness gates. */
export function strengthExerciseClassification(
  name: string,
): StrengthExerciseClassification | undefined {
  return getExerciseTags(name)?.strengthClassification;
}

/** The canonical typed direction used by every automatic split-upper route. */
export function upperAccessoryAffinity(
  name: string,
): UpperAccessoryAffinity | undefined {
  return getExerciseTags(name)?.accessoryAffinity;
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
