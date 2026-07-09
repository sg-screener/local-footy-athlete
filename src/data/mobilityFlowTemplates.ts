import type { SeasonPhase } from '../types/domain';
import type { EquipmentTag, FatigueLevel, InjuryTag } from './exercisePools';

export type MobilityFlowFocusTag =
  | 'hips'
  | 'groin_adductors'
  | 'calves_ankles'
  | 'hamstrings'
  | 'shoulders_t_spine'
  | 'lower_back_trunk'
  | 'full_body';

export type MobilityFlowPhaseSuitability =
  | SeasonPhase
  | 'Deload'
  | 'Game week';

export type MobilityFlowInjuryCautionKey =
  | 'groin_adductor'
  | 'hamstring'
  | 'calf_achilles'
  | 'lower_back'
  | 'shoulder';

export type MobilityFlowPrescriptionType = 'duration' | 'reps' | 'breathing_reps';

export interface MobilityFlowLocalMovementMeta {
  fatigue: 'low';
  equipment: EquipmentTag[];
  contraindications: InjuryTag[];
  notes: string;
}

export interface MobilityFlowMovement {
  name: string;
  prescriptionType: MobilityFlowPrescriptionType;
  sets?: number;
  repsMin?: number;
  repsMax?: number;
  durationSecondsMin?: number;
  durationSecondsMax?: number;
  perSide?: boolean;
  notes?: string;
  /** Present only for movements that are not in the shared exercise pools. */
  localMeta?: MobilityFlowLocalMovementMeta;
}

export interface MobilityFlowInjuryCaution {
  injury: MobilityFlowInjuryCautionKey;
  caution: string;
  avoidWhen: string;
}

export interface MobilityFlowTemplate {
  id: string;
  name: string;
  durationMinutes: number;
  roundsMin: 1 | 2;
  roundsMax: 1 | 2 | 3;
  focusTags: MobilityFlowFocusTag[];
  phaseSuitability: MobilityFlowPhaseSuitability[];
  fatigue: FatigueLevel;
  countsAs: 'recovery';
  hardExposure: false;
  mainStrength: false;
  conditioningCredit: 'none';
  sprintCodExposure: false;
  movements: MobilityFlowMovement[];
  injuryCautions: MobilityFlowInjuryCaution[];
}

const ALL_PHASES: MobilityFlowPhaseSuitability[] = [
  'Off-season',
  'Pre-season',
  'In-season',
  'Deload',
];

const ALL_PHASES_PLUS_GAME_WEEK: MobilityFlowPhaseSuitability[] = [
  ...ALL_PHASES,
  'Game week',
];

export const MOBILITY_FLOW_TEMPLATES: MobilityFlowTemplate[] = [
  {
    id: 'lower-body-reset',
    name: 'Lower Body Reset',
    durationMinutes: 12,
    roundsMin: 1,
    roundsMax: 2,
    focusTags: ['hips', 'hamstrings', 'calves_ankles', 'full_body'],
    phaseSuitability: ALL_PHASES,
    fatigue: 'low',
    countsAs: 'recovery',
    hardExposure: false,
    mainStrength: false,
    conditioningCredit: 'none',
    sprintCodExposure: false,
    movements: [
      { name: 'Cat-Cow', prescriptionType: 'reps', sets: 1, repsMin: 8, repsMax: 10 },
      { name: 'Hip 90/90 Stretch', prescriptionType: 'duration', sets: 1, durationSecondsMin: 30, durationSecondsMax: 45, perSide: true },
      { name: 'Couch Stretch', prescriptionType: 'duration', sets: 1, durationSecondsMin: 30, durationSecondsMax: 45, perSide: true },
      { name: 'Calf Stretch', prescriptionType: 'duration', sets: 1, durationSecondsMin: 30, durationSecondsMax: 45, perSide: true },
      { name: '90/90 Breathing', prescriptionType: 'breathing_reps', sets: 1, repsMin: 6, repsMax: 8 },
    ],
    injuryCautions: [
      { injury: 'hamstring', caution: 'Keep hip positions easy and avoid end-range hamstring stretching.', avoidWhen: 'Sharp hamstring pain or protective guarding.' },
      { injury: 'calf_achilles', caution: 'Keep calf positions gentle and avoid bouncing.', avoidWhen: 'Reactive Achilles or calf pain during stretch.' },
    ],
  },
  {
    id: 'hips-adductors-groin-reset',
    name: 'Hips/Adductors/Groin Reset',
    durationMinutes: 12,
    roundsMin: 1,
    roundsMax: 2,
    focusTags: ['hips', 'groin_adductors'],
    phaseSuitability: ['Off-season', 'Pre-season', 'In-season', 'Deload'],
    fatigue: 'low',
    countsAs: 'recovery',
    hardExposure: false,
    mainStrength: false,
    conditioningCredit: 'none',
    sprintCodExposure: false,
    movements: [
      { name: 'Hip 90/90 Stretch', prescriptionType: 'duration', sets: 1, durationSecondsMin: 30, durationSecondsMax: 45, perSide: true },
      { name: 'Adductor Rockback', prescriptionType: 'reps', sets: 1, repsMin: 6, repsMax: 10 },
      { name: 'Deep Squat Hold', prescriptionType: 'duration', sets: 1, durationSecondsMin: 30, durationSecondsMax: 45 },
      { name: 'Crocodile Breathing', prescriptionType: 'breathing_reps', sets: 1, repsMin: 6, repsMax: 8 },
    ],
    injuryCautions: [
      { injury: 'groin_adductor', caution: 'Use short range only; no aggressive adductor stretching.', avoidWhen: 'Active groin/adductor pain above mild discomfort.' },
    ],
  },
  {
    id: 'ankles-calves-reset',
    name: 'Ankles/Calves Reset',
    durationMinutes: 10,
    roundsMin: 1,
    roundsMax: 2,
    focusTags: ['calves_ankles'],
    phaseSuitability: ALL_PHASES,
    fatigue: 'low',
    countsAs: 'recovery',
    hardExposure: false,
    mainStrength: false,
    conditioningCredit: 'none',
    sprintCodExposure: false,
    movements: [
      { name: 'Toe Stretch', prescriptionType: 'duration', sets: 1, durationSecondsMin: 30, durationSecondsMax: 45 },
      { name: 'Calf Stretch', prescriptionType: 'duration', sets: 1, durationSecondsMin: 30, durationSecondsMax: 45, perSide: true },
      { name: 'Tibialis Raise', prescriptionType: 'reps', sets: 1, repsMin: 8, repsMax: 10 },
      { name: 'Cat-Cow', prescriptionType: 'reps', sets: 1, repsMin: 6, repsMax: 8 },
      { name: 'Box Breathing', prescriptionType: 'breathing_reps', sets: 1, repsMin: 6, repsMax: 8 },
    ],
    injuryCautions: [
      { injury: 'calf_achilles', caution: 'Keep stretch pressure low and skip tib raises if symptoms flare.', avoidWhen: 'Reactive Achilles, calf strain symptoms, or pain with dorsiflexion.' },
    ],
  },
  {
    id: 'hamstring-hip-hinge-reset',
    name: 'Hamstring/Hip Hinge Reset',
    durationMinutes: 10,
    roundsMin: 1,
    roundsMax: 2,
    focusTags: ['hamstrings', 'hips', 'lower_back_trunk'],
    phaseSuitability: ['Off-season', 'Pre-season', 'In-season', 'Deload'],
    fatigue: 'low',
    countsAs: 'recovery',
    hardExposure: false,
    mainStrength: false,
    conditioningCredit: 'none',
    sprintCodExposure: false,
    movements: [
      { name: 'Cat-Cow', prescriptionType: 'reps', sets: 1, repsMin: 8, repsMax: 10 },
      { name: "World's Greatest Stretch", prescriptionType: 'reps', sets: 1, repsMin: 6, repsMax: 8, perSide: true },
      { name: 'Couch Stretch', prescriptionType: 'duration', sets: 1, durationSecondsMin: 30, durationSecondsMax: 45, perSide: true },
      { name: 'Bird Dog', prescriptionType: 'reps', sets: 1, repsMin: 6, repsMax: 8, perSide: true },
      { name: '90/90 Breathing', prescriptionType: 'breathing_reps', sets: 1, repsMin: 6, repsMax: 8 },
    ],
    injuryCautions: [
      { injury: 'hamstring', caution: 'Stay away from aggressive hamstring stretching and long end-range holds.', avoidWhen: 'Any sharp pull, catching, or worsening hamstring symptoms.' },
      { injury: 'lower_back', caution: 'Keep spinal motion controlled and pain-free.', avoidWhen: 'Flexion or rotation reproduces back pain.' },
    ],
  },
  {
    id: 't-spine-shoulder-reset',
    name: 'T-Spine/Shoulder Reset',
    durationMinutes: 10,
    roundsMin: 1,
    roundsMax: 2,
    focusTags: ['shoulders_t_spine'],
    phaseSuitability: ALL_PHASES,
    fatigue: 'low',
    countsAs: 'recovery',
    hardExposure: false,
    mainStrength: false,
    conditioningCredit: 'none',
    sprintCodExposure: false,
    movements: [
      { name: 'Cat-Cow', prescriptionType: 'reps', sets: 1, repsMin: 6, repsMax: 8 },
      { name: 'Open Book Thoracic Rotation', prescriptionType: 'reps', sets: 1, repsMin: 6, repsMax: 8, perSide: true },
      { name: 'Chest / Pec Stretch (Doorway)', prescriptionType: 'duration', sets: 1, durationSecondsMin: 30, durationSecondsMax: 45, perSide: true },
      { name: 'Lat Stretch', prescriptionType: 'duration', sets: 1, durationSecondsMin: 30, durationSecondsMax: 45, perSide: true },
      { name: 'Banded External Rotation', prescriptionType: 'reps', sets: 1, repsMin: 8, repsMax: 10 },
    ],
    injuryCautions: [
      { injury: 'shoulder', caution: 'Use pain-free shoulder range only; avoid loaded or painful overhead positions.', avoidWhen: 'Overhead, hanging, or external rotation positions reproduce pain.' },
    ],
  },
  {
    id: 'low-back-friendly-trunk-reset',
    name: 'Low Back Friendly Trunk Reset',
    durationMinutes: 10,
    roundsMin: 1,
    roundsMax: 2,
    focusTags: ['lower_back_trunk'],
    phaseSuitability: ALL_PHASES,
    fatigue: 'low',
    countsAs: 'recovery',
    hardExposure: false,
    mainStrength: false,
    conditioningCredit: 'none',
    sprintCodExposure: false,
    movements: [
      { name: 'Crocodile Breathing', prescriptionType: 'breathing_reps', sets: 1, repsMin: 6, repsMax: 8 },
      { name: 'Cat-Cow', prescriptionType: 'reps', sets: 1, repsMin: 6, repsMax: 10 },
      { name: 'McGill Sit Up', prescriptionType: 'reps', sets: 1, repsMin: 6, repsMax: 8, perSide: true },
      { name: 'Bird Dog', prescriptionType: 'reps', sets: 1, repsMin: 6, repsMax: 8, perSide: true },
      { name: 'Side Plank', prescriptionType: 'duration', sets: 1, durationSecondsMin: 30, durationSecondsMax: 45, perSide: true },
    ],
    injuryCautions: [
      { injury: 'lower_back', caution: 'Keep this neutral-spine and low effort; no loaded flexion or twisting.', avoidWhen: 'Any trunk position increases back or nerve symptoms.' },
    ],
  },
  {
    id: 'pre-training-movement-prep',
    name: 'Pre-Training Movement Prep',
    durationMinutes: 8,
    roundsMin: 1,
    roundsMax: 2,
    focusTags: ['full_body', 'hips', 'calves_ankles', 'shoulders_t_spine'],
    phaseSuitability: ALL_PHASES_PLUS_GAME_WEEK,
    fatigue: 'low',
    countsAs: 'recovery',
    hardExposure: false,
    mainStrength: false,
    conditioningCredit: 'none',
    sprintCodExposure: false,
    movements: [
      { name: 'Cat-Cow', prescriptionType: 'reps', sets: 1, repsMin: 6, repsMax: 8 },
      { name: "World's Greatest Stretch", prescriptionType: 'reps', sets: 1, repsMin: 6, repsMax: 8, perSide: true },
      { name: 'Open Book Thoracic Rotation', prescriptionType: 'reps', sets: 1, repsMin: 6, repsMax: 8, perSide: true },
      { name: 'Calf Stretch', prescriptionType: 'duration', sets: 1, durationSecondsMin: 30, durationSecondsMax: 30, perSide: true },
      { name: 'Box Breathing', prescriptionType: 'breathing_reps', sets: 1, repsMin: 6, repsMax: 6 },
    ],
    injuryCautions: [
      { injury: 'groin_adductor', caution: 'Keep lateral and hip range comfortable; no deep groin prying.', avoidWhen: 'Groin symptoms increase during prep.' },
      { injury: 'hamstring', caution: 'Move through range without chasing hamstring stretch.', avoidWhen: 'Hamstring symptoms increase during hinge or stride positions.' },
      { injury: 'calf_achilles', caution: 'Keep ankle/calf range gentle and skip bouncing.', avoidWhen: 'Calf or Achilles symptoms increase during prep.' },
      { injury: 'shoulder', caution: 'Keep shoulder movement unloaded and pain-free.', avoidWhen: 'Shoulder symptoms increase with rotation or reach.' },
    ],
  },
  {
    id: 'post-training-downshift',
    name: 'Post-Training Downshift',
    durationMinutes: 8,
    roundsMin: 1,
    roundsMax: 1,
    focusTags: ['full_body', 'lower_back_trunk'],
    phaseSuitability: ALL_PHASES_PLUS_GAME_WEEK,
    fatigue: 'low',
    countsAs: 'recovery',
    hardExposure: false,
    mainStrength: false,
    conditioningCredit: 'none',
    sprintCodExposure: false,
    movements: [
      { name: 'Crocodile Breathing', prescriptionType: 'breathing_reps', sets: 1, repsMin: 8, repsMax: 10 },
      { name: "Child's Pose with Breathing", prescriptionType: 'duration', sets: 1, durationSecondsMin: 60, durationSecondsMax: 60 },
      { name: 'Hip 90/90 Stretch', prescriptionType: 'duration', sets: 1, durationSecondsMin: 30, durationSecondsMax: 45, perSide: true },
      { name: 'Open Book Thoracic Rotation', prescriptionType: 'reps', sets: 1, repsMin: 6, repsMax: 8, perSide: true },
      { name: '90/90 Breathing', prescriptionType: 'breathing_reps', sets: 1, repsMin: 6, repsMax: 8 },
    ],
    injuryCautions: [
      { injury: 'lower_back', caution: 'Keep breathing positions relaxed and pain-free.', avoidWhen: 'Child pose or floor positions increase back symptoms.' },
    ],
  },
  {
    id: 'game-week-light-mobility',
    name: 'Game-Week Light Mobility',
    durationMinutes: 8,
    roundsMin: 1,
    roundsMax: 1,
    focusTags: ['full_body'],
    phaseSuitability: ['In-season', 'Deload', 'Game week'],
    fatigue: 'low',
    countsAs: 'recovery',
    hardExposure: false,
    mainStrength: false,
    conditioningCredit: 'none',
    sprintCodExposure: false,
    movements: [
      { name: '90/90 Breathing', prescriptionType: 'breathing_reps', sets: 1, repsMin: 6, repsMax: 8 },
      { name: 'Cat-Cow', prescriptionType: 'reps', sets: 1, repsMin: 6, repsMax: 8 },
      { name: 'Open Book Thoracic Rotation', prescriptionType: 'reps', sets: 1, repsMin: 6, repsMax: 8, perSide: true },
      { name: 'Hip 90/90 Stretch', prescriptionType: 'duration', sets: 1, durationSecondsMin: 30, durationSecondsMax: 30, perSide: true },
      { name: 'Calf Stretch', prescriptionType: 'duration', sets: 1, durationSecondsMin: 30, durationSecondsMax: 30, perSide: true },
    ],
    injuryCautions: [
      { injury: 'groin_adductor', caution: 'Use only light range; no aggressive adductor stretch in game week.', avoidWhen: 'Any groin symptoms are active.' },
      { injury: 'hamstring', caution: 'Keep hamstring positions easy and short.', avoidWhen: 'Any hamstring symptoms are active.' },
      { injury: 'calf_achilles', caution: 'Keep calf stretch gentle and skip if reactive.', avoidWhen: 'Any calf or Achilles symptoms are active.' },
      { injury: 'shoulder', caution: 'Use pain-free T-spine range only.', avoidWhen: 'Shoulder pain changes the movement.' },
    ],
  },
  {
    id: 'recovery-day-full-body-flow',
    name: 'Recovery Day Full-Body Flow',
    durationMinutes: 18,
    roundsMin: 1,
    roundsMax: 2,
    focusTags: ['full_body', 'hips', 'groin_adductors', 'calves_ankles', 'shoulders_t_spine', 'lower_back_trunk'],
    phaseSuitability: ALL_PHASES_PLUS_GAME_WEEK,
    fatigue: 'low',
    countsAs: 'recovery',
    hardExposure: false,
    mainStrength: false,
    conditioningCredit: 'none',
    sprintCodExposure: false,
    movements: [
      { name: 'Hip 90/90 Stretch', prescriptionType: 'duration', sets: 1, durationSecondsMin: 30, durationSecondsMax: 45, perSide: true },
      { name: 'Open Book Thoracic Rotation', prescriptionType: 'reps', sets: 1, repsMin: 6, repsMax: 8, perSide: true },
      { name: 'Adductor Rockback', prescriptionType: 'reps', sets: 1, repsMin: 6, repsMax: 8 },
      { name: 'Couch Stretch', prescriptionType: 'duration', sets: 1, durationSecondsMin: 30, durationSecondsMax: 45, perSide: true },
      { name: 'Calf Stretch', prescriptionType: 'duration', sets: 1, durationSecondsMin: 30, durationSecondsMax: 45, perSide: true },
      { name: 'Bird Dog', prescriptionType: 'reps', sets: 1, repsMin: 6, repsMax: 8, perSide: true },
      { name: 'Cat-Cow', prescriptionType: 'reps', sets: 1, repsMin: 6, repsMax: 8 },
      { name: "Child's Pose with Breathing", prescriptionType: 'duration', sets: 1, durationSecondsMin: 60, durationSecondsMax: 60 },
    ],
    injuryCautions: [
      { injury: 'groin_adductor', caution: 'Keep adductor range controlled and non-aggressive.', avoidWhen: 'Groin/adductor pain is active beyond mild symptoms.' },
      { injury: 'hamstring', caution: 'Avoid chasing end-range hamstring stretch.', avoidWhen: 'Hamstring symptoms increase during flow.' },
      { injury: 'calf_achilles', caution: 'Keep calf positions gentle.', avoidWhen: 'Calf or Achilles symptoms are reactive.' },
      { injury: 'lower_back', caution: 'Keep floor positions neutral and relaxed.', avoidWhen: 'Back symptoms increase with flexion, extension, or rotation.' },
      { injury: 'shoulder', caution: 'Keep shoulder range unloaded and pain-free.', avoidWhen: 'Shoulder symptoms increase during T-spine or floor positions.' },
    ],
  },
];

export function mobilityFlowTemplatesForFocus(
  focus: MobilityFlowFocusTag,
): MobilityFlowTemplate[] {
  return MOBILITY_FLOW_TEMPLATES.filter((template) => template.focusTags.includes(focus));
}
