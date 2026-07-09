import type { DayOfWeek, ReadinessLevel, SeasonPhase, WeekKind } from '../types/domain';
import type { ExerciseCategory } from '../data/exercisePools';
import type { InjuryKey } from '../data/exerciseTags';
import type { MobilityFlowFocusTag } from '../data/mobilityFlowTemplates';
import {
  classifyBibleInjurySeverity,
  type BibleInjurySeverityBand,
} from './injurySeverityBands';

export type RecoveryAddonFocusArea =
  | 'trunk_core'
  | 'adductors_groin'
  | 'calves_tib_ankles'
  | 'hamstring_light_prehab'
  | 'shoulder_scap'
  | 'mobility_reset'
  | 'carries';

export type RecoveryAddonCoveragePriority = 'primary' | 'secondary' | 'optional';
export type RecoveryAddonCoverageStatus = 'recommended' | 'caution' | 'reduced' | 'avoid';

export type RecoveryAddonReadinessTier =
  | 'normal'
  | 'slight_reduction'
  | 'moderate_reduction'
  | 'major_reduction'
  | 'full_pause';

export type RecoveryAddonCoverageMode =
  | 'broad_support'
  | 'moderate_support'
  | 'minimum_effective'
  | 'deload_recovery'
  | 'minimum_viable'
  | 'readiness_recovery';

export interface RecoveryAddonActiveInjury {
  bodyPart?: string;
  severity?: number;
  severityBand?: BibleInjurySeverityBand;
  injuryKeys?: readonly InjuryKey[];
  triggers?: readonly string[];
}

export interface RecoveryAddonCoverageContext {
  phase: SeasonPhase;
  weekKind?: WeekKind;
  gameDay?: DayOfWeek | null;
  daysUntilGame?: number | null;
  availabilityDaysPerWeek?: number;
  availableTrainingDays?: readonly DayOfWeek[];
  readiness?: ReadinessLevel;
  readinessTier?: RecoveryAddonReadinessTier;
  activeInjuries?: readonly RecoveryAddonActiveInjury[];
}

export interface RecoveryAddonTargetRange {
  min: number;
  max: number;
  unit: 'exposures_per_week';
}

export interface RecoveryAddonCountingFence {
  hardExposure: false;
  mainStrength: false;
  conditioningCredit: 'none';
  createsHardDay: false;
}

export interface RecoveryAddonPlacementGuidance {
  notes: string[];
  gMinusOneAllowed: boolean;
  gMinusOneIntensity: 'very_light' | 'not_allowed';
}

export interface RecoveryAddonCaution {
  reason: string;
  action: string;
  severityBand?: BibleInjurySeverityBand;
}

export interface RecoveryAddonCoverageRecommendation {
  focusArea: RecoveryAddonFocusArea;
  label: string;
  priority: RecoveryAddonCoveragePriority;
  status: RecoveryAddonCoverageStatus;
  target: RecoveryAddonTargetRange;
  placement: RecoveryAddonPlacementGuidance;
  suitableExerciseCategories: ExerciseCategory[];
  suitableExerciseNames: string[];
  suitableExerciseTags: string[];
  suitableMobilityFlowFocusTags: MobilityFlowFocusTag[];
  templateIds: string[];
  restrictions: string[];
  cautions: RecoveryAddonCaution[];
  counting: RecoveryAddonCountingFence;
}

export interface RecoveryAddonGMinusOnePolicy {
  active: boolean;
  allowedIntensity: 'very_light_only';
  allowedFocusAreas: RecoveryAddonFocusArea[];
  disallowedFocusAreas: RecoveryAddonFocusArea[];
  notes: string[];
}

export interface RecoveryAddonCoveragePlan {
  phase: SeasonPhase;
  weekKind: WeekKind;
  mode: RecoveryAddonCoverageMode;
  totalTarget: RecoveryAddonTargetRange;
  recommendations: RecoveryAddonCoverageRecommendation[];
  deferredFocusAreas: RecoveryAddonFocusArea[];
  gMinusOnePolicy: RecoveryAddonGMinusOnePolicy;
  notes: string[];
  counting: RecoveryAddonCountingFence;
}

const ZERO_CREDIT: RecoveryAddonCountingFence = {
  hardExposure: false,
  mainStrength: false,
  conditioningCredit: 'none',
  createsHardDay: false,
};

const ALL_FOCUS_AREAS: readonly RecoveryAddonFocusArea[] = [
  'trunk_core',
  'adductors_groin',
  'calves_tib_ankles',
  'hamstring_light_prehab',
  'shoulder_scap',
  'mobility_reset',
  'carries',
];

const G_MINUS_ONE_ALLOWED: readonly RecoveryAddonFocusArea[] = [
  'trunk_core',
  'adductors_groin',
  'calves_tib_ankles',
  'hamstring_light_prehab',
  'shoulder_scap',
  'mobility_reset',
];

interface FocusDefinition {
  label: string;
  categories: ExerciseCategory[];
  exerciseNames: string[];
  exerciseTags: string[];
  mobilityFocusTags: MobilityFlowFocusTag[];
  templateIds: string[];
  defaultRestrictions: string[];
  gMinusOneNote: string;
}

const FOCUS_DEFINITIONS: Record<RecoveryAddonFocusArea, FocusDefinition> = {
  trunk_core: {
    label: 'Trunk/Core',
    categories: ['trunk_anti_rotation'],
    exerciseNames: ['Dead Bug', 'Band Pallof Press', 'Side Plank', 'Bird Dog', 'McGill Sit Up'],
    exerciseTags: ['core', 'anti_rotation', 'anti_extension', 'mcgill_big_3'],
    mobilityFocusTags: ['lower_back_trunk'],
    templateIds: ['low-back-friendly-trunk-reset', 'post-training-downshift'],
    defaultRestrictions: ['Keep trunk work controlled and low-soreness.'],
    gMinusOneNote: 'G-1 trunk is breathing, McGill-style, or easy bracing only.',
  },
  adductors_groin: {
    label: 'Adductors/Groin',
    categories: ['groin_adductors', 'mobility'],
    exerciseNames: ['Groin Squeeze (Band Adductor)', 'Short-Lever Copenhagen', 'Long-Lever Copenhagen', 'Adductor Rockback'],
    exerciseTags: ['adductor', 'groin', 'isometric', 'copenhagen'],
    mobilityFocusTags: ['groin_adductors', 'hips'],
    templateIds: ['hips-adductors-groin-reset', 'recovery-day-full-body-flow'],
    defaultRestrictions: ['No aggressive groin stretching or sudden hard Copenhagens.'],
    gMinusOneNote: 'G-1 adductor work is gentle squeeze or short-range mobility only.',
  },
  calves_tib_ankles: {
    label: 'Calves/Tib/Ankles',
    categories: ['calves', 'lower_prehab', 'mobility'],
    exerciseNames: ['Single-Leg Calf Raise', 'Seated Calf Raise', 'Tibialis Raise', 'Calf Stretch'],
    exerciseTags: ['calf', 'soleus', 'tibialis', 'ankle'],
    mobilityFocusTags: ['calves_ankles'],
    templateIds: ['ankles-calves-reset', 'lower-body-reset'],
    defaultRestrictions: ['Keep lower-leg work controlled; no plyometric calf loading in this layer.'],
    gMinusOneNote: 'G-1 lower-leg work is gentle mobility or very low-volume activation only.',
  },
  hamstring_light_prehab: {
    label: 'Hamstring Light Prehab',
    categories: ['hamstring_light', 'trunk_anti_rotation'],
    exerciseNames: ['Swiss Ball Hamstring Curl', 'Nordic Lower', 'Glute Bridge', 'Bird Dog'],
    exerciseTags: ['hamstring_light', 'isometric', 'bridge', 'nordic_low_rep'],
    mobilityFocusTags: ['hamstrings', 'hips'],
    templateIds: ['hamstring-hip-hinge-reset', 'lower-body-reset'],
    defaultRestrictions: ['Nordics stay low-rep and never become a hidden hard hamstring day.'],
    gMinusOneNote: 'G-1 hamstring work is easy bridge/isometric only; no Nordics.',
  },
  shoulder_scap: {
    label: 'Shoulder/Scap',
    categories: ['shoulder_health', 'upper_back_pump', 'mobility'],
    exerciseNames: ['Face Pull', 'Banded External Rotation', 'Scap Push-Up', 'Band Pull-Apart'],
    exerciseTags: ['shoulder_health', 'scap_control', 'rotator_cuff', 'upper_back_pump'],
    mobilityFocusTags: ['shoulders_t_spine'],
    templateIds: ['t-spine-shoulder-reset', 'recovery-day-full-body-flow'],
    defaultRestrictions: ['Shoulder/scap work stays pain-free and unloaded when needed.'],
    gMinusOneNote: 'G-1 shoulder/scap work is light activation or T-spine reset only.',
  },
  mobility_reset: {
    label: 'Mobility/Reset',
    categories: ['mobility', 'breathing_reset', 'tissue_quality'],
    exerciseNames: ['90/90 Breathing', 'Cat-Cow', 'Open Book Thoracic Rotation', 'Hip 90/90 Stretch'],
    exerciseTags: ['mobility', 'breathing_reset', 'downshift', 'recovery'],
    mobilityFocusTags: ['full_body', 'hips', 'lower_back_trunk', 'shoulders_t_spine'],
    templateIds: ['pre-training-movement-prep', 'post-training-downshift', 'game-week-light-mobility', 'recovery-day-full-body-flow'],
    defaultRestrictions: ['Mobility/reset must stay easy and should finish fresher than it started.'],
    gMinusOneNote: 'G-1 mobility/reset is explicitly allowed when very light.',
  },
  carries: {
    label: 'Carries',
    categories: ['trunk_anti_rotation'],
    exerciseNames: ['Farmer Carry', 'Suitcase Carry', 'Bear Carry', 'Bottoms-Up KB Carry'],
    exerciseTags: ['carry', 'grip', 'bracing', 'contact_robustness'],
    mobilityFocusTags: ['lower_back_trunk'],
    templateIds: [],
    defaultRestrictions: ['No hard carries late in game week or after a huge lower-body session.'],
    gMinusOneNote: 'Carries are not a G-1 recovery add-on option.',
  },
};

interface PhaseFocusRule {
  target: RecoveryAddonTargetRange;
  priority: RecoveryAddonCoveragePriority;
  status?: RecoveryAddonCoverageStatus;
  notes: string[];
}

const TARGET_UNIT = 'exposures_per_week' as const;

function target(min: number, max: number): RecoveryAddonTargetRange {
  return { min, max, unit: TARGET_UNIT };
}

const PHASE_RULES: Record<SeasonPhase, Record<RecoveryAddonFocusArea, PhaseFocusRule>> = {
  'Off-season': {
    trunk_core: rule(1, 2, 'primary', 'Regular trunk exposure for bracing and contact robustness.'),
    adductors_groin: rule(1, 1, 'primary', 'Build adductor capacity while there is more room to recover.'),
    calves_tib_ankles: rule(1, 1, 'primary', 'Keep lower-leg capacity ticking without plyometric loading.'),
    hamstring_light_prehab: rule(0, 1, 'secondary', 'Use light hamstring work as robustness support, not a second hinge day.'),
    shoulder_scap: rule(0, 1, 'optional', 'Useful body-armour filler when upper body volume allows.'),
    mobility_reset: rule(1, 2, 'secondary', 'Off-season is the best phase for mobility gains and recovery flows.'),
    carries: rule(0, 1, 'secondary', 'Carries can be built here if back, grip, and shoulders tolerate them.'),
  },
  'Pre-season': {
    trunk_core: rule(1, 1, 'primary', 'Maintain trunk robustness without stealing from team training.'),
    adductors_groin: rule(1, 1, 'primary', 'Keep groin capacity present as running and COD ramp.'),
    calves_tib_ankles: rule(1, 1, 'primary', 'Keep calf/tib support regular but low-fatigue.'),
    hamstring_light_prehab: rule(0, 1, 'secondary', 'Use familiar light hamstring work; avoid soreness spikes.'),
    shoulder_scap: rule(0, 1, 'secondary', 'Small shoulder/scap doses support contact and upper training.'),
    mobility_reset: rule(0, 1, 'secondary', 'Use reset flows to absorb the ramp.'),
    carries: rule(0, 1, 'optional', 'Carries are optional and should not compete with conditioning load.'),
  },
  'In-season': {
    trunk_core: rule(1, 1, 'primary', 'Minimum effective trunk dose, familiar and low-soreness.'),
    adductors_groin: rule(1, 1, 'primary', 'Small groin maintenance dose, not hard new adductor work.'),
    calves_tib_ankles: rule(1, 1, 'primary', 'Small lower-leg maintenance dose.'),
    hamstring_light_prehab: rule(0, 1, 'optional', 'Only familiar light hamstring work; no late-week soreness.'),
    shoulder_scap: rule(0, 1, 'optional', 'Light shoulder/scap hygiene if it fits.'),
    mobility_reset: rule(0, 1, 'secondary', 'Protect game freshness with short reset flows.'),
    carries: rule(0, 1, 'optional', 'If used, keep carries early-week and light.'),
  },
};

const DELOAD_RULES: Record<RecoveryAddonFocusArea, PhaseFocusRule> = {
  trunk_core: rule(0, 1, 'primary', 'Light trunk only: McGill-style, breathing, or easy bracing.'),
  adductors_groin: rule(0, 1, 'optional', 'Gentle adductor squeeze or short-range mobility only.', 'caution'),
  calves_tib_ankles: rule(0, 1, 'optional', 'Gentle ankle/calf mobility or low-volume tib work only.', 'caution'),
  hamstring_light_prehab: rule(0, 1, 'optional', 'Easy bridges/isometrics only if useful.', 'caution'),
  shoulder_scap: rule(0, 1, 'secondary', 'Light activation and T-spine reset are fine.'),
  mobility_reset: rule(1, 2, 'primary', 'Deload bias is mobility/reset and downshift work.'),
  carries: rule(0, 0, 'optional', 'No hard carries or fatiguing carry circuits in deload.', 'avoid'),
};

function rule(
  min: number,
  max: number,
  priority: RecoveryAddonCoveragePriority,
  note: string,
  status: RecoveryAddonCoverageStatus = 'recommended',
): PhaseFocusRule {
  return {
    target: target(min, max),
    priority,
    status,
    notes: [note],
  };
}

export function recommendRecoveryAddonCoverage(
  context: RecoveryAddonCoverageContext,
): RecoveryAddonCoveragePlan {
  const weekKind = context.weekKind ?? 'build';
  const lowAvailability = isLowAvailability(context);
  const readinessTier = effectiveReadinessTier(context);
  const gMinusOneActive = context.daysUntilGame === 1;
  const baseRules = weekKind === 'deload' ? DELOAD_RULES : PHASE_RULES[context.phase];

  let recommendations = ALL_FOCUS_AREAS.map((focusArea) =>
    buildRecommendation(focusArea, baseRules[focusArea]),
  );

  if (readinessTier === 'full_pause' || readinessTier === 'major_reduction') {
    recommendations = applyRecoveryBias(recommendations, readinessTier);
  } else if (readinessTier === 'moderate_reduction') {
    recommendations = recommendations.map(reduceOptionalHarderSupport);
  }

  recommendations = recommendations.map((recommendation) =>
    applyInjuryCautions(recommendation, context.activeInjuries ?? []),
  );

  if (gMinusOneActive) {
    recommendations = recommendations.map(applyGMinusOneGuidance);
  }

  let deferredFocusAreas: RecoveryAddonFocusArea[] = [];
  if (lowAvailability) {
    const filtered = minimumViableCoverage(recommendations, weekKind, gMinusOneActive);
    recommendations = filtered.recommendations;
    deferredFocusAreas = filtered.deferredFocusAreas;
  }

  const totalTarget = totalTargetFor(context, readinessTier, lowAvailability);
  const mode = modeFor(context, readinessTier, lowAvailability);

  return {
    phase: context.phase,
    weekKind,
    mode,
    totalTarget,
    recommendations,
    deferredFocusAreas,
    gMinusOnePolicy: gMinusOnePolicy(gMinusOneActive),
    notes: notesFor(context, readinessTier, lowAvailability),
    counting: ZERO_CREDIT,
  };
}

function buildRecommendation(
  focusArea: RecoveryAddonFocusArea,
  phaseRule: PhaseFocusRule,
): RecoveryAddonCoverageRecommendation {
  const definition = FOCUS_DEFINITIONS[focusArea];
  const gMinusOneAllowed = G_MINUS_ONE_ALLOWED.includes(focusArea);
  return {
    focusArea,
    label: definition.label,
    priority: phaseRule.priority,
    status: phaseRule.status ?? 'recommended',
    target: { ...phaseRule.target },
    placement: {
      notes: [...phaseRule.notes, definition.gMinusOneNote],
      gMinusOneAllowed,
      gMinusOneIntensity: gMinusOneAllowed ? 'very_light' : 'not_allowed',
    },
    suitableExerciseCategories: [...definition.categories],
    suitableExerciseNames: [...definition.exerciseNames],
    suitableExerciseTags: [...definition.exerciseTags],
    suitableMobilityFlowFocusTags: [...definition.mobilityFocusTags],
    templateIds: [...definition.templateIds],
    restrictions: [...definition.defaultRestrictions],
    cautions: [],
    counting: ZERO_CREDIT,
  };
}

function applyRecoveryBias(
  recommendations: RecoveryAddonCoverageRecommendation[],
  readinessTier: RecoveryAddonReadinessTier,
): RecoveryAddonCoverageRecommendation[] {
  return recommendations.map((recommendation) => {
    if (recommendation.focusArea === 'mobility_reset') {
      return withCaution({
        ...recommendation,
        priority: 'primary',
        target: readinessTier === 'full_pause' ? target(0, 1) : target(1, 2),
      }, 'readiness', 'Use mobility/breathing only if it improves recovery today.');
    }
    if (recommendation.focusArea === 'trunk_core') {
      return withCaution({
        ...recommendation,
        priority: 'secondary',
        status: 'caution',
        target: target(0, 1),
      }, 'readiness', 'Light trunk only; skip if sick or it adds fatigue.');
    }
    return withCaution({
      ...recommendation,
      status: 'avoid',
      target: target(0, 0),
    }, 'readiness', 'Defer this support focus while readiness is heavily reduced.');
  });
}

function reduceOptionalHarderSupport(
  recommendation: RecoveryAddonCoverageRecommendation,
): RecoveryAddonCoverageRecommendation {
  if (recommendation.priority !== 'optional' && recommendation.focusArea !== 'carries') {
    return recommendation;
  }
  return withCaution({
    ...recommendation,
    status: recommendation.focusArea === 'carries' ? 'reduced' : 'caution',
    target: target(0, Math.min(1, recommendation.target.max)),
  }, 'readiness', 'Keep this optional and skip before it becomes extra fatigue.');
}

function applyInjuryCautions(
  recommendation: RecoveryAddonCoverageRecommendation,
  injuries: readonly RecoveryAddonActiveInjury[],
): RecoveryAddonCoverageRecommendation {
  let next = recommendation;
  for (const injury of injuries) {
    if (!injuryMatchesFocus(injury, recommendation.focusArea)) continue;
    const band = severityBandFor(injury);
    const label = injury.bodyPart?.trim() || injury.injuryKeys?.join('/') || 'active injury';
    next = adjustForInjuryBand(next, band, label);
  }
  return next;
}

function adjustForInjuryBand(
  recommendation: RecoveryAddonCoverageRecommendation,
  band: BibleInjurySeverityBand,
  label: string,
): RecoveryAddonCoverageRecommendation {
  if (band === 'avoid_trigger_1_3') {
    return withCaution({
      ...recommendation,
      status: maxStatus(recommendation.status, 'caution'),
    }, `${label} caution`, mildInjuryAction(recommendation.focusArea), band);
  }

  if (band === 'reduce_affected_4_5') {
    return withCaution({
      ...recommendation,
      status: maxStatus(recommendation.status, 'reduced'),
      target: target(0, Math.min(1, recommendation.target.max)),
      restrictions: [
        ...recommendation.restrictions,
        moderateInjuryRestriction(recommendation.focusArea),
      ],
    }, `${label} reduction`, moderateInjuryAction(recommendation.focusArea), band);
  }

  if (band === 'restrict_and_refer_6_7') {
    const keepAsLight = recommendation.focusArea === 'trunk_core' || recommendation.focusArea === 'mobility_reset';
    return withCaution({
      ...recommendation,
      status: keepAsLight ? 'reduced' : 'avoid',
      target: keepAsLight ? target(0, 1) : target(0, 0),
      restrictions: [
        ...recommendation.restrictions,
        severeInjuryRestriction(recommendation.focusArea),
      ],
    }, `${label} restriction`, severeInjuryAction(recommendation.focusArea), band);
  }

  return withCaution({
    ...recommendation,
    status: recommendation.focusArea === 'mobility_reset' ? 'caution' : 'avoid',
    target: recommendation.focusArea === 'mobility_reset' ? target(0, 1) : target(0, 0),
    restrictions: [
      ...recommendation.restrictions,
      'Pause affected support work; use only clearly unaffected recovery work.',
    ],
  }, `${label} pause`, 'Pause affected recovery add-on focus for this area.', band);
}

function withCaution(
  recommendation: RecoveryAddonCoverageRecommendation,
  reason: string,
  action: string,
  severityBand?: BibleInjurySeverityBand,
): RecoveryAddonCoverageRecommendation {
  return {
    ...recommendation,
    cautions: [
      ...recommendation.cautions,
      { reason, action, ...(severityBand ? { severityBand } : {}) },
    ],
  };
}

function injuryMatchesFocus(
  injury: RecoveryAddonActiveInjury,
  focusArea: RecoveryAddonFocusArea,
): boolean {
  const keys = new Set(injury.injuryKeys ?? []);
  const text = `${injury.bodyPart ?? ''} ${(injury.triggers ?? []).join(' ')}`.toLowerCase();
  const hasText = (rx: RegExp) => rx.test(text);

  switch (focusArea) {
    case 'adductors_groin':
      return keys.has('adductor') || keys.has('pubalgia') || hasText(/\b(groin|adductor|pubalgia)\b/);
    case 'hamstring_light_prehab':
      return keys.has('hamstring') || hasText(/\b(hamstring|hammy)\b/);
    case 'calves_tib_ankles':
      return keys.has('calf') || keys.has('ankle') || hasText(/\b(calf|achilles|ankle|shin)\b/);
    case 'shoulder_scap':
      return keys.has('shoulder') || hasText(/\bshoulder|scap|rotator\b/);
    case 'trunk_core':
      return keys.has('lowerBack') || hasText(/\b(lower back|lumbar|back)\b/);
    case 'carries':
      return keys.has('lowerBack') || keys.has('shoulder') || keys.has('wrist') || keys.has('elbow') ||
        hasText(/\b(lower back|lumbar|back|shoulder|wrist|grip|elbow)\b/);
    case 'mobility_reset':
      return hasText(/\b(groin|adductor|hamstring|calf|achilles|lower back|lumbar|shoulder)\b/);
    default:
      return false;
  }
}

function severityBandFor(injury: RecoveryAddonActiveInjury): BibleInjurySeverityBand {
  if (injury.severityBand) return injury.severityBand;
  if (typeof injury.severity === 'number' && Number.isFinite(injury.severity)) {
    return classifyBibleInjurySeverity(injury.severity).band;
  }
  return 'avoid_trigger_1_3';
}

function mildInjuryAction(focusArea: RecoveryAddonFocusArea): string {
  switch (focusArea) {
    case 'adductors_groin': return 'Avoid the exact groin trigger and keep any adductor work easy.';
    case 'hamstring_light_prehab': return 'Avoid Nordics or hamstring ranges that reproduce symptoms.';
    case 'calves_tib_ankles': return 'Keep calf/tib work pain-free and low volume.';
    case 'carries': return 'Use light carries only if grip, back, and shoulder positions feel clean.';
    default: return 'Keep the support work pain-free and low fatigue.';
  }
}

function moderateInjuryAction(focusArea: RecoveryAddonFocusArea): string {
  switch (focusArea) {
    case 'adductors_groin': return 'Downgrade to gentle squeeze or skip loaded Copenhagens.';
    case 'hamstring_light_prehab': return 'Avoid Nordics/heavy hamstring loading; use easy bridges or skip.';
    case 'calves_tib_ankles': return 'Reduce calf volume and avoid aggressive calf/Achilles loading.';
    case 'carries': return 'Downgrade carries; no heavy carry if back, grip, wrist, or shoulder is risky.';
    default: return 'Reduce range, volume, or loading around the affected area.';
  }
}

function severeInjuryAction(focusArea: RecoveryAddonFocusArea): string {
  switch (focusArea) {
    case 'adductors_groin': return 'Avoid Copenhagens, aggressive stretching, and loaded adductor work.';
    case 'hamstring_light_prehab': return 'Avoid Nordics and loaded hamstring work.';
    case 'calves_tib_ankles': return 'Avoid loaded calf/Achilles work unless cleared and clearly tolerated.';
    case 'carries': return 'Avoid loaded carries for this week.';
    default: return 'Keep only clearly unaffected, easy recovery work.';
  }
}

function moderateInjuryRestriction(focusArea: RecoveryAddonFocusArea): string {
  if (focusArea === 'carries') return 'No heavy carries while this issue is active.';
  if (focusArea === 'hamstring_light_prehab') return 'No Nordics or high-volume hamstring loading.';
  if (focusArea === 'adductors_groin') return 'No aggressive Copenhagen/adductor loading.';
  if (focusArea === 'calves_tib_ankles') return 'No aggressive calf/Achilles loading.';
  return 'Keep affected support work reduced and pain-free.';
}

function severeInjuryRestriction(focusArea: RecoveryAddonFocusArea): string {
  if (focusArea === 'carries') return 'Avoid loaded carries.';
  if (focusArea === 'hamstring_light_prehab') return 'Avoid Nordics and loaded hamstring work.';
  if (focusArea === 'adductors_groin') return 'Avoid loaded adductor work and aggressive groin stretching.';
  if (focusArea === 'calves_tib_ankles') return 'Avoid high-volume calf raises and Achilles loading.';
  return 'Avoid risky affected work.';
}

function applyGMinusOneGuidance(
  recommendation: RecoveryAddonCoverageRecommendation,
): RecoveryAddonCoverageRecommendation {
  const allowed = G_MINUS_ONE_ALLOWED.includes(recommendation.focusArea);
  const next: RecoveryAddonCoverageRecommendation = {
    ...recommendation,
    target: allowed
      ? target(0, Math.min(1, recommendation.target.max))
      : target(0, 0),
    status: allowed ? recommendation.status : 'avoid',
    placement: {
      ...recommendation.placement,
      gMinusOneAllowed: allowed,
      gMinusOneIntensity: allowed ? 'very_light' : 'not_allowed',
      notes: [
        ...recommendation.placement.notes,
        allowed
          ? 'On G-1, use only very light mobility/reset/prehab.'
          : 'Not allowed on G-1.',
      ],
    },
  };
  if (allowed) return next;
  return withCaution(next, 'G-1 freshness', 'Do not place carries or fatiguing add-ons the day before a game.');
}

function minimumViableCoverage(
  recommendations: RecoveryAddonCoverageRecommendation[],
  weekKind: WeekKind,
  gMinusOneActive: boolean,
): {
  recommendations: RecoveryAddonCoverageRecommendation[];
  deferredFocusAreas: RecoveryAddonFocusArea[];
} {
  const keep: RecoveryAddonFocusArea[] = weekKind === 'deload' || gMinusOneActive
    ? ['mobility_reset', 'trunk_core']
    : ['trunk_core', 'mobility_reset', 'adductors_groin'];
  const kept = recommendations
    .filter((recommendation) => keep.includes(recommendation.focusArea))
    .map((recommendation) => {
      const max = recommendation.status === 'avoid' ? 0 : Math.min(1, recommendation.target.max);
      const min = recommendation.focusArea === 'trunk_core' && max > 0 ? 1 : 0;
      return {
        ...recommendation,
        target: target(min, max),
        placement: {
          ...recommendation.placement,
          notes: [
            ...recommendation.placement.notes,
            'Low availability: this is minimum viable support coverage.',
          ],
        },
      };
    });
  return {
    recommendations: kept,
    deferredFocusAreas: ALL_FOCUS_AREAS.filter((focusArea) => !keep.includes(focusArea)),
  };
}

function totalTargetFor(
  context: RecoveryAddonCoverageContext,
  readinessTier: RecoveryAddonReadinessTier,
  lowAvailability: boolean,
): RecoveryAddonTargetRange {
  if (readinessTier === 'full_pause') return target(0, 1);
  if (readinessTier === 'major_reduction') return target(1, 2);
  if (lowAvailability) return target(1, 2);
  if (context.weekKind === 'deload') return target(1, 2);
  if (context.phase === 'Off-season') return target(2, 4);
  if (context.phase === 'Pre-season') return target(2, 3);
  return target(1, 3);
}

function modeFor(
  context: RecoveryAddonCoverageContext,
  readinessTier: RecoveryAddonReadinessTier,
  lowAvailability: boolean,
): RecoveryAddonCoverageMode {
  if (readinessTier === 'full_pause' || readinessTier === 'major_reduction') return 'readiness_recovery';
  if (lowAvailability) return 'minimum_viable';
  if (context.weekKind === 'deload') return 'deload_recovery';
  if (context.phase === 'Off-season') return 'broad_support';
  if (context.phase === 'Pre-season') return 'moderate_support';
  return 'minimum_effective';
}

function notesFor(
  context: RecoveryAddonCoverageContext,
  readinessTier: RecoveryAddonReadinessTier,
  lowAvailability: boolean,
): string[] {
  const notes = [
    'Recovery add-on coverage is optional low-fatigue support work.',
    'It creates zero hard exposure, zero main-strength credit, and zero conditioning credit.',
  ];
  if (context.phase === 'In-season') {
    notes.push('In-season coverage protects game freshness and stays familiar.');
  }
  if (context.weekKind === 'deload') {
    notes.push('Deload coverage biases toward mobility/reset and light trunk work.');
  }
  if (lowAvailability) {
    notes.push('Low availability uses minimum viable coverage and defers lower-priority support areas.');
  }
  if (readinessTier === 'moderate_reduction' || readinessTier === 'major_reduction' || readinessTier === 'full_pause') {
    notes.push('Reduced readiness trims optional support before it adds fatigue.');
  }
  if (context.daysUntilGame === 1) {
    notes.push('G-1 allows only very light mobility/reset/prehab.');
  }
  return notes;
}

function gMinusOnePolicy(active: boolean): RecoveryAddonGMinusOnePolicy {
  const allowedFocusAreas = [...G_MINUS_ONE_ALLOWED];
  return {
    active,
    allowedIntensity: 'very_light_only',
    allowedFocusAreas,
    disallowedFocusAreas: ALL_FOCUS_AREAS.filter((focusArea) => !allowedFocusAreas.includes(focusArea)),
    notes: [
      'G-1 never allows hard carries, hard conditioning, sprint/COD, or fatiguing circuits.',
      'Use breathing, mobility/reset, or very light familiar prehab only.',
    ],
  };
}

function isLowAvailability(context: RecoveryAddonCoverageContext): boolean {
  const availableCount = context.availableTrainingDays?.length ?? context.availabilityDaysPerWeek;
  return typeof availableCount === 'number' && availableCount <= 2;
}

function effectiveReadinessTier(context: RecoveryAddonCoverageContext): RecoveryAddonReadinessTier {
  if (context.readinessTier) return context.readinessTier;
  if (context.readiness === 'low') return 'moderate_reduction';
  return 'normal';
}

const STATUS_RANK: Record<RecoveryAddonCoverageStatus, number> = {
  recommended: 0,
  caution: 1,
  reduced: 2,
  avoid: 3,
};

function maxStatus(
  current: RecoveryAddonCoverageStatus,
  next: RecoveryAddonCoverageStatus,
): RecoveryAddonCoverageStatus {
  return STATUS_RANK[next] > STATUS_RANK[current] ? next : current;
}
