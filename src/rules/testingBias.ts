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
  BiggestLimitation,
  ConditioningLevel,
  OnboardingInjury,
  SeasonPhase,
  SprintExposure,
} from '../types/domain';
import type { RecoveryAddonFocusArea } from './recoveryAddonCoverage';
// BIBLE_ANCHOR: weak_point_off_season_focus
import { WEAK_POINT_LEAN, weakPointFocusFor } from './weakPointFocus';
import type {
  BiasConditioningCategory,
  ProgrammingBias,
  RecoveryAddonFocusPreference,
} from './programmingBias';

/**
 * THE STRENGTH ANSWERS ARE ABSENT ON PURPOSE — Sam's ruling, 2026-07-30.
 *
 * `squatStrength` and `benchStrength` used to be here, banded 0-4 and COMPARED, and a
 * two-band gap leaned the program toward the trailing region. Sam killed the mechanism
 * twice on record:
 *
 *   > "unlikely someone is super strong upper and super weak lower"
 *   > "we shouldn't bias lower over upper"
 *
 * DELETED, not tuned — so the band-comparability question ("is squat band 3 the same
 * amount of strong as bench band 3?") is moot rather than answered. See
 * `docs/UNAUTHORED_TRANSLATIONS_SHEET_2026-07-30.md` §1.
 *
 * WHAT ANSWERS THE WEAK-BUT-FIT ATHLETE INSTEAD. Nothing inferred. A global lean toward
 * strength is the STATED-weakness mechanism doing its job — `biggestLimitation` below,
 * bound to `:105` — plus `:105`'s own default ordering. The app asks; it does not deduce.
 *
 * THE ONE LEGITIMATE UPPER/LOWER ASYMMETRY is in-season game proximity, and it is a
 * PLACEMENT rule keyed on the calendar, not a lean keyed on an athlete property. The
 * Bible owns it outright and needs no mechanism built here — `strengthAnswerAuthority`
 * cites the lines and gates their presence:
 *
 *   `:78`  "What is acceptable 1-2 days before a game: upper body training, gunshow,
 *          accessories, low volume low range power work..."
 *   `:378` "In-season version: Upper strength can stay in year-round. It can often be
 *          placed before team training or closer to game day than lower strength."
 *   `:803` "If lower strength is unsafe close to game day, preserve upper strength
 *          where possible."
 *
 * WHERE THE STRENGTH ANSWERS DO STILL GO: `loadEstimation`, through Sam's anchor ladders
 * (`data/anchorMultipliers.ts`, RULED 2026-07-28, workbook-gated both directions). That
 * is a starting LOAD, not a verdict on the athlete — which is exactly why "I don't squat"
 * can carry a conservative 0.5 multiplier there while meaning UNTESTED, never "weak",
 * here.
 */
export interface TestingBiasInputs {
  phase: SeasonPhase;
  conditioningLevel?: ConditioningLevel;
  sprintExposure?: SprintExposure;
  biggestLimitation?: BiggestLimitation;
  injuries?: readonly OnboardingInjury[] | null;
  isBeginner?: boolean;
}

export interface TestingBias {
  speedBias: number;
  conditioningCategoryPreference: Partial<Record<BiasConditioningCategory, number>>;
  recoveryAddonFocusPreference: RecoveryAddonFocusPreference;
  /** Observability only. No programming consumer reads these fields. */
  debug: {
    phaseAdjustedWeight: number;
    reasons: string[];
  };
}

export interface ComposedProgrammingBias extends ProgrammingBias {
  testingDebug: TestingBias['debug'];
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

function clamp(value: number, max: number): number {
  return Math.round(Math.max(-max, Math.min(max, value)) * 1e4) / 1e4 || 0;
}

/**
 * Compute a testing bias from signals the profile already stores.
 *
 * Reads conditioning, sprint exposure, the stated weakness and injury history. It does
 * NOT read the strength answers — see `TestingBiasInputs` for Sam's ruling.
 */
export function computeTestingBias(inputs: TestingBiasInputs): TestingBias {
  const phaseScale = PHASE_SCALE[inputs.phase] ?? PHASE_SCALE['Pre-season'];
  const beginnerScale = inputs.isBeginner ? BEGINNER_SCALE : 1;
  const phaseAdjustedWeight = Math.round(phaseScale * beginnerScale * 1e4) / 1e4;
  const notes: string[] = [];

  let aerobic = 0;
  let speed = 0;
  let recovery = 0;
  let robustnessSignal = false;
  let mobilitySignal = false;

  if (inputs.conditioningLevel === 'Poor') {
    aerobic += 1;
    notes.push('Testing: poor conditioning signal — aerobic/tempo lean');
  }

  if (inputs.sprintExposure === 'No sprint training') {
    speed += 0.5;
    notes.push('Testing gap: no current sprint exposure — small speed lean');
  }

  // ── THE STATED WEAKNESS, BOUND TO `:105` (Sam's ruling, 2026-07-30) ──
  //
  // READING A: a stated weakness changes WHAT FILLS the week, never its counts or
  // distributions. This is the whole of the weak-point mechanism, and its DIRECTION is
  // now `rules/weakPointFocus.ts` rather than a switch here — because the direction is
  // the part Sam signs and `:105` is the line it answers to. `weakPointFocusTests` binds
  // the two so neither can drift.
  //
  // IT WAS A SWITCH OVER FIVE OF SEVEN ANSWERS. `Size` and `Power & explosiveness` fell
  // to `default: break` and leaned nothing — Size is half of `:105`'s own "strength and
  // size" category, so its silence was a gap and not a decision. It leans now.
  // `Power & explosiveness` still leans nothing, but for a stated reason: Sam deferred
  // it, the authored record holds no prior ruling, and the map declares it `unresolved`
  // rather than guessing it into speed.
  const weakPointFocus = weakPointFocusFor(inputs.biggestLimitation);
  if (weakPointFocus) {
    const lean = WEAK_POINT_LEAN[weakPointFocus];
    if (lean.aerobic) aerobic += 1;
    if (lean.speed) speed += 1;
    if (lean.recovery) recovery += 1;
    // `lean.accessory` IS NOT READ HERE, AND WAS NEVER INDEPENDENTLY READ. Deleting the
    // squat/bench gap made that visible: the accessory weight this block used to
    // accumulate was consumed ONLY inside the two gap-gated blocks below, so a stated
    // `strength_and_size` weakness expressed its accessory direction only when the gap
    // ALSO fired — and expressed nothing at all otherwise.
    //
    // Not repaired here on purpose. `WEAK_POINT_LEAN.strength_and_size.accessory` is
    // Sam's signed direction and stays declared; giving it a consumer is a mechanism, and
    // Sam's instruction on this unit was to return an unruled asymmetry as a QUESTION
    // rather than build one. `strengthAnswerAuthorityTests` pins the finding so it cannot
    // be quietly rediscovered as a bug, and the boundary report carries it to him.
    if (weakPointFocus === 'mobility_and_injury_prevention') {
      // Both halves of `:105`'s first category, kept distinguishable: an injury history
      // is a robustness signal and a mobility answer is a mobility one. The bias
      // consumers read these separately, so collapsing them would lose real information
      // the mapping does not intend to lose.
      if (inputs.biggestLimitation === 'Injury history') robustnessSignal = true;
      if (inputs.biggestLimitation === 'Mobility') mobilitySignal = true;
    }
    notes.push(`Limitation: ${inputs.biggestLimitation} → :105 focus "${weakPointFocus}"`);
  }

  if ((inputs.injuries ?? []).length > 0) {
    recovery += 0.75;
    robustnessSignal = true;
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

  const aerobicBias = toBias(aerobic);
  const speedBias = toBias(speed);
  const recoveryAddonBias = toBias(recovery);

  const conditioningCategoryPreference: Partial<Record<BiasConditioningCategory, number>> = {};
  if (aerobicBias > 0) {
    conditioningCategoryPreference.aerobic_base = aerobicBias;
    conditioningCategoryPreference.tempo = clamp(aerobicBias * 0.5, TESTING_MAX_BIAS);
  }
  if (speedBias > 0) {
    conditioningCategoryPreference.sprint = speedBias;
    conditioningCategoryPreference.vo2 = clamp(speedBias * 0.5, TESTING_MAX_BIAS);
  }

  const recoveryAddonFocusPreference: RecoveryAddonFocusPreference = {};
  const addFocuses = (focuses: readonly RecoveryAddonFocusArea[], weight: number): void => {
    for (const focus of focuses) {
      recoveryAddonFocusPreference[focus] = Math.max(
        recoveryAddonFocusPreference[focus] ?? 0,
        weight,
      );
    }
  };
  if (robustnessSignal && recoveryAddonBias > 0) {
    addFocuses(
      ['trunk_core', 'adductors_groin', 'calves_tib_ankles', 'hamstring_light_prehab'],
      recoveryAddonBias,
    );
  }
  if (mobilitySignal && recoveryAddonBias > 0) {
    addFocuses(['mobility_reset', 'trunk_core'], recoveryAddonBias);
  }

  if (notes.length === 0) notes.push('No clear testing imbalance — neutral bias');

  return {
    speedBias,
    conditioningCategoryPreference,
    recoveryAddonFocusPreference,
    debug: {
      phaseAdjustedWeight,
      reasons: notes,
    },
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

function mergeRecoveryAddonPreferences(
  roleGoal: ProgrammingBias['recoveryAddonFocusPreference'],
  testing: TestingBias['recoveryAddonFocusPreference'],
): ProgrammingBias['recoveryAddonFocusPreference'] {
  const out: ProgrammingBias['recoveryAddonFocusPreference'] = { ...roleGoal };
  for (const focus of Object.keys(testing) as RecoveryAddonFocusArea[]) {
    // Max, not sum: matching role/goal/testing signals remain one bounded nudge.
    out[focus] = Math.max(out[focus] ?? 0, testing[focus] ?? 0);
  }
  return out;
}

/** Compose role/goal and testing vectors while retaining the global 15% cap. */
export function composeProgrammingBias(
  roleGoal: ProgrammingBias,
  testing: TestingBias,
): ComposedProgrammingBias {
  return {
    ...roleGoal,
    strengthBias: clamp(roleGoal.strengthBias, COMPOSED_MAX_BIAS),
    speedBias: clamp(roleGoal.speedBias + testing.speedBias, COMPOSED_MAX_BIAS),
    conditioningCategoryPreference: mergeCategoryPreferences(
      roleGoal.conditioningCategoryPreference,
      testing.conditioningCategoryPreference,
    ),
    recoveryAddonFocusPreference: mergeRecoveryAddonPreferences(
      roleGoal.recoveryAddonFocusPreference,
      testing.recoveryAddonFocusPreference,
    ),
    testingDebug: {
      phaseAdjustedWeight: testing.debug.phaseAdjustedWeight,
      reasons: [...testing.debug.reasons],
    },
  };
}

/** Bounded stable re-order of already-safe recovery add-on recommendations. */
export function applyRecoveryAddonBias<T extends { focusArea: RecoveryAddonFocusArea }>(
  ordered: readonly T[],
  preference: RecoveryAddonFocusPreference,
): T[] {
  if (Object.keys(preference).length === 0) return [...ordered];
  const BIAS_ORDER_SCALE = 25;
  return ordered
    .map((item, index) => ({
      item,
      index,
      score: index - (preference[item.focusArea] ?? 0) * BIAS_ORDER_SCALE,
    }))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map(({ item }) => item);
}
