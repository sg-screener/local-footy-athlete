/**
 * Small deterministic bias from existing testing / limitation signals.
 *
 * This module does not prescribe volume or bypass any programming gate. It
 * only exposes a phase-scaled preference vector and stable re-order helpers.
 * Consumers use it only within structures, categories or recommendations
 * already admitted by their existing safety gates. Concrete exercise and
 * modality selection remains owned by the downstream equipment rules.
 */

import type {
  BenchStrength,
  BiggestLimitation,
  ConditioningLevel,
  OnboardingInjury,
  SeasonPhase,
  SprintExposure,
  SquatStrength,
} from '../types/domain';
import type { RecoveryAddonFocusArea } from './recoveryAddonCoverage';
import type {
  BiasConditioningCategory,
  ProgrammingBias,
} from './programmingBias';

export interface TestingBiasInputs {
  phase: SeasonPhase;
  squatStrength?: SquatStrength;
  benchStrength?: BenchStrength;
  conditioningLevel?: ConditioningLevel;
  sprintExposure?: SprintExposure;
  biggestLimitation?: BiggestLimitation;
  injuries?: readonly OnboardingInjury[] | null;
  isBeginner?: boolean;
}

export interface TestingBias {
  lowerStrengthBias: number;
  upperStrengthBias: number;
  aerobicBias: number;
  speedBias: number;
  recoveryAddonBias: number;
  accessoryBias: number;
  phaseAdjustedWeight: number;
  conditioningCategoryPreference: Partial<Record<BiasConditioningCategory, number>>;
  recoveryAddonFocusPreference: RecoveryAddonFocusArea[];
  notes: string[];
}

export interface ComposedProgrammingBias extends ProgrammingBias {
  lowerStrengthBias: number;
  upperStrengthBias: number;
  aerobicBias: number;
  testingNotes: string[];
  recoveryAddonFocusPreference: RecoveryAddonFocusArea[];
}

const TESTING_MAX_BIAS = 0.1;
const COMPOSED_MAX_BIAS = 0.15;
const BASE_UNIT = 0.1;
const BEGINNER_SCALE = 0.3;
const PHASE_SCALE: Record<SeasonPhase, number> = {
  'Off-season': 1,
  'Pre-season': 0.6,
  'In-season': 0.3,
};

const ROBUSTNESS_FOCUS: RecoveryAddonFocusArea[] = [
  'trunk_core',
  'adductors_groin',
  'calves_tib_ankles',
  'hamstring_light_prehab',
  'shoulder_scap',
  'mobility_reset',
  'carries',
];

function clamp(value: number, max: number): number {
  return Math.round(Math.max(-max, Math.min(max, value)) * 1e4) / 1e4 || 0;
}

function squatBand(value: SquatStrength | undefined): number | null {
  switch (value) {
    case "I don't squat": return 0;
    case 'Less than bodyweight': return 1;
    case 'Around bodyweight': return 2;
    case '1.5x bodyweight': return 3;
    case '2x bodyweight+': return 4;
    default: return null;
  }
}

function benchBand(value: BenchStrength | undefined): number | null {
  switch (value) {
    case "I don't bench": return 0;
    case 'Less than bodyweight': return 1;
    case 'Around bodyweight': return 2;
    case '1.25x bodyweight': return 3;
    case '1.5x bodyweight+': return 4;
    default: return null;
  }
}

/**
 * Compute a testing bias from signals the profile already stores. Relative
 * strength requires a clear two-band gap; missing / "Not sure" values never
 * become weakness evidence.
 */
export function computeTestingBias(inputs: TestingBiasInputs): TestingBias {
  const phaseScale = PHASE_SCALE[inputs.phase] ?? PHASE_SCALE['Pre-season'];
  const beginnerScale = inputs.isBeginner ? BEGINNER_SCALE : 1;
  const phaseAdjustedWeight = Math.round(phaseScale * beginnerScale * 1e4) / 1e4;
  const notes: string[] = [];

  let lower = 0;
  let upper = 0;
  let aerobic = 0;
  let speed = 0;
  let recovery = 0;
  let accessory = 0;

  const lowerBand = squatBand(inputs.squatStrength);
  const upperBand = benchBand(inputs.benchStrength);
  if (lowerBand !== null && upperBand !== null) {
    const gap = upperBand - lowerBand;
    if (gap >= 2) {
      lower += 1;
      accessory += 0.5;
      notes.push('Testing: lower strength trails upper by a clear margin');
    } else if (gap <= -2) {
      upper += 1;
      accessory += 0.5;
      notes.push('Testing: upper strength trails lower by a clear margin');
    }
  }

  if (inputs.conditioningLevel === 'Poor') {
    aerobic += 1;
    notes.push('Testing: poor conditioning signal — aerobic/tempo lean');
  }

  if (inputs.sprintExposure === 'No sprint training') {
    speed += 0.5;
    notes.push('Testing gap: no current sprint exposure — small speed lean');
  }

  switch (inputs.biggestLimitation) {
    case 'Endurance':
      aerobic += 1;
      notes.push('Limitation: endurance');
      break;
    case 'Speed':
      speed += 1;
      notes.push('Limitation: speed');
      break;
    case 'Strength':
      accessory += 0.5;
      notes.push('Limitation: general strength — small support lean');
      break;
    case 'Injury history':
      recovery += 1;
      accessory += 0.25;
      notes.push('Limitation: injury history — robustness/prehab lean');
      break;
    case 'Mobility':
      recovery += 0.5;
      notes.push('Limitation: mobility — recovery add-on lean');
      break;
    default:
      break;
  }

  if ((inputs.injuries ?? []).length > 0) {
    recovery += 0.75;
    notes.push('Profile injury history: recovery/prehab coverage lean');
  }

  // Beginners keep a small support bias, but aggressive speed bias is fully
  // suppressed. The training-age policy still owns sessions and dose.
  if (inputs.isBeginner) {
    speed = 0;
    notes.push('Beginner policy: aggressive testing/speed bias suppressed');
  }

  const toBias = (raw: number) =>
    clamp(raw * BASE_UNIT * phaseScale * beginnerScale, TESTING_MAX_BIAS);

  const lowerStrengthBias = toBias(lower);
  const upperStrengthBias = toBias(upper);
  const aerobicBias = toBias(aerobic);
  const speedBias = toBias(speed);
  const recoveryAddonBias = toBias(recovery);
  const accessoryBias = toBias(accessory);

  const conditioningCategoryPreference: Partial<Record<BiasConditioningCategory, number>> = {};
  if (aerobicBias > 0) {
    conditioningCategoryPreference.aerobic_base = 2;
    conditioningCategoryPreference.tempo = 1;
  }
  if (speedBias > 0) {
    conditioningCategoryPreference.sprint = 2;
    conditioningCategoryPreference.vo2 = 1;
  }

  if (notes.length === 0) notes.push('No clear testing imbalance — neutral bias');

  return {
    lowerStrengthBias,
    upperStrengthBias,
    aerobicBias,
    speedBias,
    recoveryAddonBias,
    accessoryBias,
    phaseAdjustedWeight,
    conditioningCategoryPreference,
    recoveryAddonFocusPreference: recoveryAddonBias > 0 ? [...ROBUSTNESS_FOCUS] : [],
    notes,
  };
}

function mergeCategoryPreferences(
  roleGoal: ProgrammingBias['conditioningCategoryPreference'],
  testing: TestingBias['conditioningCategoryPreference'],
): ProgrammingBias['conditioningCategoryPreference'] {
  const out: ProgrammingBias['conditioningCategoryPreference'] = { ...roleGoal };
  for (const category of Object.keys(testing) as BiasConditioningCategory[]) {
    // Max, not sum: goals + testing in the same direction stay one nudge.
    out[category] = Math.max(out[category] ?? 0, testing[category] ?? 0);
  }
  return out;
}

/** Compose role/goal and testing vectors while retaining the global 15% cap. */
export function composeProgrammingBias(
  roleGoal: ProgrammingBias,
  testing: TestingBias,
): ComposedProgrammingBias {
  const regionalStrength = Math.max(testing.lowerStrengthBias, testing.upperStrengthBias);
  return {
    ...roleGoal,
    strengthBias: clamp(roleGoal.strengthBias + regionalStrength, COMPOSED_MAX_BIAS),
    conditioningBias: clamp(roleGoal.conditioningBias + testing.aerobicBias, COMPOSED_MAX_BIAS),
    speedBias: clamp(roleGoal.speedBias + testing.speedBias, COMPOSED_MAX_BIAS),
    recoveryAddonBias: clamp(roleGoal.recoveryAddonBias + testing.recoveryAddonBias, COMPOSED_MAX_BIAS),
    accessoryBias: clamp(roleGoal.accessoryBias + testing.accessoryBias, COMPOSED_MAX_BIAS),
    lowerStrengthBias: testing.lowerStrengthBias,
    upperStrengthBias: testing.upperStrengthBias,
    aerobicBias: testing.aerobicBias,
    conditioningCategoryPreference: mergeCategoryPreferences(
      roleGoal.conditioningCategoryPreference,
      testing.conditioningCategoryPreference,
    ),
    recoveryAddonFocusPreference: [...testing.recoveryAddonFocusPreference],
    testingNotes: [...testing.notes],
    notes: [...roleGoal.notes, ...testing.notes],
  };
}

/** Stable re-order of already-safe recovery add-on recommendations. */
export function applyRecoveryAddonTestingBias<T extends { focusArea: RecoveryAddonFocusArea }>(
  ordered: readonly T[],
  testing: TestingBias,
): T[] {
  if (testing.recoveryAddonBias <= 0 || testing.recoveryAddonFocusPreference.length === 0) {
    return [...ordered];
  }
  const rank = new Map(
    testing.recoveryAddonFocusPreference.map((focus, index) => [focus, index]),
  );
  return ordered
    .map((item, index) => ({ item, index, rank: rank.get(item.focusArea) ?? 99 }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ item }) => item);
}
