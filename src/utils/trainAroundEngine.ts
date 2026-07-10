/**
 * trainAroundEngine.ts — train-around-injury decision layer.
 *
 * NOT a rehab engine. NOT random substitutions. The rule is simple:
 * remove what's unsafe, keep what's safe, tell the athlete to see a
 * physio when severity is high. We do NOT pretend to "fix" the
 * injury and we do NOT swap a barbell press for a split squat as a
 * fake like-for-like.
 *
 * The decision is movement-pattern-driven, not exercise-name-driven:
 * "Incline DB Press" → ['horizontal_press'] → red for shoulder severe
 * → REMOVE. The pattern classifier uses regex on names (robust to
 * AI-generated exercise names) plus per-bucket policy tables.
 *
 *   classifyExercisePatterns(name)         → MovementPattern[]
 *   getTrainAroundPolicy(bucket, severity) → TrainAroundPolicy
 *   classifyExercise(name, policy)         → 'green' | 'amber' | 'red'
 *   applyTrainAroundPolicy(workout, ...)   → { workout, removed, kept, action }
 *   validateAgainstPolicy(week, ...)       → { passed, violations }
 */

import type { Workout, WorkoutExercise } from '../types/domain';
import type { InjuryBucket } from './programAdjustmentEngine';
import { logger } from './logger';
import {
  classifyBibleInjurySeverity,
  injurySeverityRecommendsPhysio,
} from '../rules/injurySeverityBands';

// ─── Type system ─────────────────────────────────────────────────────

export type InjurySeverityTier = 'minor' | 'moderate' | 'severe';

export type MovementRisk = 'green' | 'amber' | 'red';

export type MovementPattern =
  // upper
  | 'horizontal_press'
  | 'vertical_press'
  | 'explosive_push'
  | 'shoulder_isolation'
  | 'heavy_pull'
  | 'overhead_loading'
  | 'loaded_carry'
  | 'grip_heavy'
  // lower
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'plyometric'
  | 'sprint'
  | 'running'
  | 'calf_achilles'
  | 'adductor_groin'
  | 'knee_dominant'
  | 'posterior_chain'
  // other
  | 'trunk'
  | 'mobility'
  | 'recovery'
  | 'bike_erg'
  | 'rower_erg'
  | 'ski_erg'
  | 'low_load_accessory';

export interface TrainAroundPolicy {
  bucket: InjuryBucket;
  severityTier: InjurySeverityTier;
  redPatterns: MovementPattern[];
  amberPatterns: MovementPattern[];
  greenPatterns: MovementPattern[];
  globalRules: string[];
  safeTrainingFocus: string[];
  physioAdvice?: string;
}

export function severityToTier(severity: number): InjurySeverityTier {
  const band = classifyBibleInjurySeverity(severity).band;
  if (band === 'pause_affected_8_10') return 'severe';
  if (band === 'restrict_and_refer_6_7' || band === 'reduce_affected_4_5') return 'moderate';
  return 'minor';
}

// ─── Movement-pattern classifier ────────────────────────────────────

/**
 * Map an exercise NAME to one or more movement patterns. Robust to
 * AI-generated naming variants ("Incline DB Press", "Single Arm Half
 * Kneeling DB OHP", "Explosive Push-Ups", "Slider Hamstring Curl").
 *
 * An exercise can match multiple patterns — e.g. "Explosive Push-Ups"
 * is both `horizontal_press` AND `explosive_push`; "Deadlift" is both
 * `hinge` AND `posterior_chain` AND `heavy_pull`.
 *
 * Returns an empty array for genuinely-unknown exercises so the
 * caller can default to green (don't remove things you don't
 * understand).
 */
export function classifyExercisePatterns(rawName: string): MovementPattern[] {
  if (!rawName) return [];
  const n = rawName.toLowerCase();
  const patterns: Set<MovementPattern> = new Set();

  // Upper body — pressing
  if (/(bench\s*press|incline\s*press|incline.*db\s*press|decline\s*press|chest\s*press)/i.test(n)) {
    patterns.add('horizontal_press');
  }
  if (/(push[-\s]?ups?|press[-\s]?ups?)/i.test(n) && !/(scap|bird|hindu|wall)/i.test(n)) {
    patterns.add('horizontal_press');
  }
  if (/(overhead\s*press|shoulder\s*press|\bohp\b|military\s*press|pike\s*press|push\s*press|jerk|snatch)/i.test(n)) {
    patterns.add('vertical_press');
    patterns.add('overhead_loading');
  }
  if (/(arnold\s*press|landmine\s*press)/i.test(n)) {
    patterns.add('vertical_press');
  }
  if (/explosive|plyo.*push|clap\s*push/i.test(n)) {
    patterns.add('explosive_push');
  }
  if (/dips?\b/i.test(n)) {
    patterns.add('horizontal_press');
  }

  // Upper body — pulling
  if (/(deadlift|rdl|romanian\s*deadlift|trap\s*bar)/i.test(n)) {
    patterns.add('hinge');
    patterns.add('heavy_pull');
    patterns.add('posterior_chain');
  }
  if (/(barbell\s*row|bent[-\s]*over\s*row|pendlay|t[-\s]*bar\s*row)/i.test(n)) {
    patterns.add('heavy_pull');
  }
  if (/pull[-\s]?ups?|chin[-\s]?ups?/i.test(n)) {
    patterns.add('heavy_pull');
    patterns.add('grip_heavy');
  }

  // Shoulder isolation
  if (/(lateral\s*raise|front\s*raise|rear\s*delt|reverse\s*fly|external\s*rotation|internal\s*rotation|cuban\s*press|y\s*raise)/i.test(n)) {
    patterns.add('shoulder_isolation');
  }

  // Loaded carry / grip
  if (/(farmer.*carry|suitcase\s*carry|loaded\s*carry|trap\s*bar\s*carry|yoke)/i.test(n)) {
    patterns.add('loaded_carry');
    patterns.add('grip_heavy');
  }

  // Squat
  if (/squat\b/i.test(n) && !/(hindu|sissy)/i.test(n)) {
    patterns.add('squat');
    patterns.add('knee_dominant');
  }
  if (/leg\s*press/i.test(n)) {
    patterns.add('squat');
    patterns.add('knee_dominant');
  }

  // Lunge / single-leg
  if (/(lunge|split\s*squat|step[-\s]*up|bulgarian|reverse\s*lunge|walking\s*lunge|forward\s*lunge|side\s*lunge|lateral\s*lunge)/i.test(n)) {
    patterns.add('lunge');
    patterns.add('knee_dominant');
  }

  // Hinge / posterior chain
  if (/(rdl|romanian\s*deadlift|good\s*morning|kettlebell\s*swing|hip\s*thrust|glute\s*bridge|back\s*extension|reverse\s*hyper|45\s*degree)/i.test(n)) {
    patterns.add('hinge');
    patterns.add('posterior_chain');
  }
  if (/(nordic|hamstring\s*curl|leg\s*curl|prone\s*curl|slider\s*curl|slider\s*hamstring)/i.test(n)) {
    patterns.add('posterior_chain');
  }

  // Plyometric / explosive lower
  if (/(box\s*jump|broad\s*jump|tuck\s*jump|squat\s*jump|depth\s*jump|hop|bound|pogo|plyo)/i.test(n)) {
    patterns.add('plyometric');
  }

  // Sprint / running
  if (/(\bsprint(s|ing)?\b|10\s*m\s*sprint|flying\s*sprint|hill\s*sprint|max\s*velocity)/i.test(n)) {
    patterns.add('sprint');
    patterns.add('running');
  }
  if (/(\brun\b|\bruns\b|tempo\s*run|long\s*run|interval\s*run|fartlek|\bmas\b|km\s*repeat)/i.test(n)) {
    patterns.add('running');
  }

  // Calf
  if (/calf\s*raise|calf\b|gastroc|soleus|donkey\s*calf/i.test(n)) {
    patterns.add('calf_achilles');
  }

  // Adductor / groin
  if (/(copenhagen|adductor|groin|pancake)/i.test(n)) {
    patterns.add('adductor_groin');
  }

  // Trunk
  if (/(plank|side\s*plank|dead[-\s]?bug|bird[-\s]?dog|ab\s*wheel|hollow|crunch|sit[-\s]?up|pallof|landmine\s*twist|rotation|anti[-\s]?rotation|cable\s*chop|farmer\s*carry|core)/i.test(n)) {
    patterns.add('trunk');
  }
  // Note: Copenhagen Plank is BOTH adductor_groin and trunk; we
  // already added trunk via "plank" match above — that's fine.

  // Mobility / recovery
  if (/(mobility|stretch|foam\s*roll|active\s*recovery|walk(ing)?)/i.test(n)) {
    patterns.add('mobility');
  }
  if (/recovery/i.test(n)) {
    patterns.add('recovery');
  }

  // Conditioning ergs
  if (/(assault\s*bike|echo\s*bike|airbike|\bbike\b|cycling)/i.test(n)) {
    patterns.add('bike_erg');
  }
  if (/(rower|rowing\s*erg|\brow\b)/i.test(n) && !/(bent|barbell|seal)/i.test(n)) {
    patterns.add('rower_erg');
  }
  if (/ski[-\s]?erg|ski\s*machine/i.test(n)) {
    patterns.add('ski_erg');
  }

  // Low-load accessory (curl / extension / pump work)
  if (/(bicep\s*curl|tricep|hammer\s*curl|wrist\s*curl|face\s*pull|band\s*pull[-\s]?apart)/i.test(n)) {
    patterns.add('low_load_accessory');
  }

  return Array.from(patterns);
}

// ─── Train-around policy table ──────────────────────────────────────

const PHYSIO_HARD = 'Get this assessed by a physio so we know what you can safely reload.';
const PHYSIO_SOFT = "If it's not improving in a few days, worth getting a physio to look at it.";

/**
 * Per-bucket × per-tier policy. Severe tier policies are intentionally
 * conservative: remove anything that loads the injured area, keep
 * everything that doesn't, tell the athlete to see a physio.
 */
const POLICY_TABLE: Record<
  InjuryBucket,
  Record<InjurySeverityTier, Omit<TrainAroundPolicy, 'bucket' | 'severityTier'>>
> = {
  shoulder: {
    severe: {
      redPatterns: [
        'horizontal_press', 'vertical_press', 'overhead_loading',
        'explosive_push', 'shoulder_isolation', 'heavy_pull', 'loaded_carry',
      ],
      amberPatterns: ['grip_heavy'],
      greenPatterns: [
        'squat', 'lunge', 'hinge', 'plyometric', 'knee_dominant',
        'posterior_chain', 'sprint', 'running', 'trunk', 'mobility',
        'recovery', 'bike_erg', 'rower_erg', 'low_load_accessory',
      ],
      globalRules: [
        'No heavy pressing',
        'No overhead loading',
        'No explosive push work',
        'No heavy shoulder isolation',
      ],
      safeTrainingFocus: [
        'Lower body',
        'Trunk',
        'Bike / rower if pain-free',
        'Light accessories that don\'t irritate the shoulder',
      ],
      physioAdvice: PHYSIO_HARD,
    },
    moderate: {
      redPatterns: ['overhead_loading', 'explosive_push'],
      amberPatterns: ['horizontal_press', 'vertical_press', 'shoulder_isolation', 'heavy_pull'],
      greenPatterns: [
        'squat', 'lunge', 'hinge', 'plyometric', 'knee_dominant',
        'posterior_chain', 'sprint', 'running', 'trunk', 'mobility',
        'recovery', 'bike_erg', 'rower_erg', 'low_load_accessory',
      ],
      globalRules: [
        'No overhead loading',
        'No explosive push work',
        'Reduce pressing volume / load',
      ],
      safeTrainingFocus: [
        'Lower body', 'Trunk', 'Light pressing if pain-free',
        'Bike / rower / ski', 'Light accessories',
      ],
      physioAdvice: PHYSIO_SOFT,
    },
    minor: {
      redPatterns: [],
      amberPatterns: ['overhead_loading', 'explosive_push'],
      greenPatterns: [
        'horizontal_press', 'vertical_press', 'shoulder_isolation', 'heavy_pull',
        'squat', 'lunge', 'hinge', 'plyometric', 'knee_dominant',
        'posterior_chain', 'sprint', 'running', 'trunk', 'mobility',
        'recovery', 'bike_erg', 'rower_erg', 'low_load_accessory',
      ],
      globalRules: ['Ease back into overhead / explosive push gradually'],
      safeTrainingFocus: ['Most of the program with caution on overhead work'],
    },
  },

  hamstring: {
    severe: {
      redPatterns: [
        'sprint', 'running', 'hinge', 'posterior_chain', 'plyometric',
      ],
      // `knee_dominant` is intentionally GREEN here — quad-dominant work
      // (goblet/back squat, leg press) is the canonical safe lower-body
      // alternative when the hamstring is the injured tissue. `lunge`
      // stays amber because the trail-leg eccentric loads the hamstring.
      amberPatterns: ['lunge'],
      greenPatterns: [
        'horizontal_press', 'vertical_press', 'overhead_loading',
        'explosive_push', 'shoulder_isolation', 'heavy_pull',
        'squat', 'knee_dominant', 'trunk', 'mobility', 'recovery',
        'bike_erg', 'rower_erg', 'ski_erg', 'low_load_accessory',
      ],
      globalRules: [
        'No sprinting or high-speed running',
        'No heavy hinge work (RDLs, deadlifts, nordics)',
        'No explosive lower-body work',
      ],
      safeTrainingFocus: [
        'Upper body', 'Trunk', 'Quad-dominant lower if pain-free',
        'Bike / rower / ski for conditioning',
      ],
      physioAdvice: PHYSIO_HARD,
    },
    moderate: {
      redPatterns: ['sprint', 'running', 'hinge', 'posterior_chain'],
      amberPatterns: ['plyometric', 'lunge'],
      greenPatterns: [
        'horizontal_press', 'vertical_press', 'overhead_loading',
        'explosive_push', 'shoulder_isolation', 'heavy_pull',
        'squat', 'knee_dominant', 'trunk', 'mobility', 'recovery',
        'bike_erg', 'rower_erg', 'ski_erg', 'low_load_accessory',
      ],
      globalRules: [
        'No sprinting or high-speed running',
        'No heavy hinge work (RDLs, deadlifts, nordics)',
      ],
      safeTrainingFocus: [
        'Upper body', 'Quad-dominant lower if pain-free',
        'Bike / rower / ski', 'Light accessories', 'Trunk',
      ],
      physioAdvice: PHYSIO_SOFT,
    },
    minor: {
      redPatterns: [],
      amberPatterns: ['sprint', 'hinge', 'plyometric'],
      greenPatterns: [
        'horizontal_press', 'vertical_press', 'overhead_loading',
        'explosive_push', 'shoulder_isolation', 'heavy_pull',
        'squat', 'lunge', 'knee_dominant', 'posterior_chain',
        'running', 'trunk', 'mobility', 'recovery', 'bike_erg',
        'rower_erg', 'ski_erg', 'low_load_accessory',
      ],
      globalRules: ['Build sprint volume back gradually'],
      safeTrainingFocus: ['Most of the program - monitor symptoms'],
    },
  },

  knee: {
    severe: {
      redPatterns: [
        'plyometric', 'sprint', 'running', 'squat', 'lunge', 'knee_dominant',
      ],
      amberPatterns: ['hinge', 'posterior_chain'],
      greenPatterns: [
        'horizontal_press', 'vertical_press', 'overhead_loading',
        'explosive_push', 'shoulder_isolation', 'heavy_pull',
        'trunk', 'mobility', 'recovery', 'bike_erg', 'rower_erg',
        'low_load_accessory',
      ],
      globalRules: [
        'No plyos or jumping',
        'No sprinting or running',
        'No heavy knee-dominant lifts',
        'No deep / loaded squat or lunge',
      ],
      safeTrainingFocus: [
        'Upper body', 'Trunk', 'Bike if pain-free',
        'Hip-dominant work only if pain-free',
      ],
      physioAdvice: PHYSIO_HARD,
    },
    moderate: {
      redPatterns: ['plyometric', 'sprint'],
      amberPatterns: ['squat', 'lunge', 'knee_dominant', 'running'],
      greenPatterns: [
        'horizontal_press', 'vertical_press', 'overhead_loading',
        'explosive_push', 'shoulder_isolation', 'heavy_pull',
        'hinge', 'posterior_chain', 'trunk', 'mobility', 'recovery',
        'bike_erg', 'rower_erg', 'low_load_accessory',
      ],
      globalRules: [
        'No plyos or jumping',
        'No sprinting or cutting',
        'Reduce heavy knee-dominant lifts',
      ],
      safeTrainingFocus: [
        'Upper body', 'Hinge work (light)', 'Trunk', 'Bike',
      ],
      physioAdvice: PHYSIO_SOFT,
    },
    minor: {
      redPatterns: [],
      amberPatterns: ['plyometric', 'sprint'],
      greenPatterns: [
        'horizontal_press', 'vertical_press', 'overhead_loading',
        'explosive_push', 'shoulder_isolation', 'heavy_pull',
        'squat', 'lunge', 'knee_dominant', 'hinge',
        'posterior_chain', 'running', 'trunk', 'mobility', 'recovery',
        'bike_erg', 'rower_erg', 'ski_erg', 'low_load_accessory',
      ],
      globalRules: ['Rebuild plyo + sprint volume gradually'],
      safeTrainingFocus: ['Most of the program - monitor symptoms'],
    },
  },

  lowerBack: {
    severe: {
      redPatterns: [
        'hinge', 'posterior_chain', 'heavy_pull', 'loaded_carry', 'squat',
      ],
      amberPatterns: ['knee_dominant', 'overhead_loading'],
      greenPatterns: [
        'horizontal_press', 'vertical_press', 'shoulder_isolation',
        'mobility', 'recovery', 'bike_erg', 'low_load_accessory', 'trunk',
      ],
      globalRules: [
        'No axial loading (heavy squat, carries)',
        'No deadlifts / RDLs',
        'No heavy hinges',
      ],
      safeTrainingFocus: [
        'Supported upper body', 'Trunk if pain-free',
        'Bike / walk / mobility', 'Light accessories',
      ],
      physioAdvice: PHYSIO_HARD,
    },
    moderate: {
      redPatterns: ['hinge', 'posterior_chain', 'heavy_pull'],
      amberPatterns: ['squat', 'loaded_carry'],
      greenPatterns: [
        'horizontal_press', 'vertical_press', 'overhead_loading',
        'explosive_push', 'shoulder_isolation', 'lunge', 'knee_dominant',
        'trunk', 'mobility', 'recovery', 'bike_erg', 'rower_erg',
        'low_load_accessory',
      ],
      globalRules: ['No deadlifts / RDLs', 'Reduce axial loading'],
      safeTrainingFocus: [
        'Upper body', 'Light unilateral lower (no axial load)',
        'Bike', 'Trunk',
      ],
      physioAdvice: PHYSIO_SOFT,
    },
    minor: {
      redPatterns: [],
      amberPatterns: ['hinge', 'heavy_pull'],
      greenPatterns: [
        'horizontal_press', 'vertical_press', 'overhead_loading',
        'explosive_push', 'shoulder_isolation', 'squat', 'lunge',
        'knee_dominant', 'plyometric', 'sprint', 'running',
        'posterior_chain', 'loaded_carry', 'trunk', 'mobility',
        'recovery', 'bike_erg', 'rower_erg', 'ski_erg', 'low_load_accessory',
      ],
      globalRules: ['Ease back into heavy hinges gradually'],
      safeTrainingFocus: ['Most of the program - monitor symptoms'],
    },
  },

  calf: {
    severe: {
      redPatterns: ['sprint', 'running', 'plyometric', 'calf_achilles'],
      amberPatterns: ['lunge', 'squat', 'knee_dominant'],
      greenPatterns: [
        'horizontal_press', 'vertical_press', 'overhead_loading',
        'explosive_push', 'shoulder_isolation', 'heavy_pull',
        'hinge', 'posterior_chain', 'trunk', 'mobility', 'recovery',
        'bike_erg', 'rower_erg', 'low_load_accessory',
      ],
      globalRules: [
        'No sprinting or running',
        'No plyos / jumping',
        'No heavy calf loading',
      ],
      safeTrainingFocus: [
        'Upper body', 'Hip-dominant lower work', 'Trunk',
        'Bike if pain-free',
      ],
      physioAdvice: PHYSIO_HARD,
    },
    moderate: {
      redPatterns: ['sprint', 'plyometric', 'calf_achilles'],
      amberPatterns: ['running'],
      greenPatterns: [
        'horizontal_press', 'vertical_press', 'overhead_loading',
        'explosive_push', 'shoulder_isolation', 'heavy_pull',
        'squat', 'lunge', 'hinge', 'knee_dominant', 'posterior_chain',
        'trunk', 'mobility', 'recovery', 'bike_erg', 'rower_erg',
        'low_load_accessory',
      ],
      globalRules: ['No sprinting / plyos', 'Reduce running volume'],
      safeTrainingFocus: [
        'Upper body', 'Hip-dominant lower', 'Light squat/lunge',
        'Bike / rower', 'Trunk',
      ],
      physioAdvice: PHYSIO_SOFT,
    },
    minor: {
      redPatterns: [],
      amberPatterns: ['sprint', 'plyometric'],
      greenPatterns: [
        'horizontal_press', 'vertical_press', 'overhead_loading',
        'explosive_push', 'shoulder_isolation', 'heavy_pull',
        'squat', 'lunge', 'hinge', 'knee_dominant', 'posterior_chain',
        'running', 'calf_achilles', 'trunk', 'mobility', 'recovery',
        'bike_erg', 'rower_erg', 'ski_erg', 'low_load_accessory',
      ],
      globalRules: ['Build sprint + plyo volume gradually'],
      safeTrainingFocus: ['Most of the program - monitor symptoms'],
    },
  },

  // For the rest, mirror the closest-fit pattern. Conservative defaults.
  ankle: {
    severe: {
      redPatterns: ['sprint', 'running', 'plyometric', 'lunge'],
      amberPatterns: ['squat', 'knee_dominant'],
      greenPatterns: [
        'horizontal_press', 'vertical_press', 'overhead_loading',
        'explosive_push', 'shoulder_isolation', 'heavy_pull', 'hinge',
        'posterior_chain', 'trunk', 'mobility', 'recovery',
        'bike_erg', 'rower_erg', 'low_load_accessory',
      ],
      globalRules: [
        'No sprinting or cutting',
        'No plyos / jumping',
        'No loaded unilateral lower work',
      ],
      safeTrainingFocus: ['Upper body', 'Trunk', 'Hip-dominant lower', 'Bike'],
      physioAdvice: PHYSIO_HARD,
    },
    moderate: {
      redPatterns: ['sprint', 'plyometric'],
      amberPatterns: ['running', 'lunge'],
      greenPatterns: [
        'horizontal_press', 'vertical_press', 'overhead_loading',
        'explosive_push', 'shoulder_isolation', 'heavy_pull',
        'squat', 'hinge', 'knee_dominant', 'posterior_chain',
        'trunk', 'mobility', 'recovery', 'bike_erg', 'rower_erg',
        'low_load_accessory',
      ],
      globalRules: ['No sprinting / plyos', 'Reduce single-leg loading'],
      safeTrainingFocus: ['Upper body', 'Bilateral lower', 'Bike', 'Trunk'],
      physioAdvice: PHYSIO_SOFT,
    },
    minor: {
      redPatterns: [],
      amberPatterns: ['sprint', 'plyometric'],
      greenPatterns: [
        'horizontal_press', 'vertical_press', 'overhead_loading',
        'explosive_push', 'shoulder_isolation', 'heavy_pull',
        'squat', 'lunge', 'hinge', 'knee_dominant', 'posterior_chain',
        'running', 'trunk', 'mobility', 'recovery',
        'bike_erg', 'rower_erg', 'ski_erg', 'low_load_accessory',
      ],
      globalRules: ['Rebuild change-of-direction gradually'],
      safeTrainingFocus: ['Most of the program - monitor symptoms'],
    },
  },

  adductor: {
    severe: {
      redPatterns: ['sprint', 'running', 'lunge', 'adductor_groin', 'plyometric'],
      amberPatterns: ['squat', 'knee_dominant'],
      greenPatterns: [
        'horizontal_press', 'vertical_press', 'overhead_loading',
        'explosive_push', 'shoulder_isolation', 'heavy_pull',
        'hinge', 'posterior_chain', 'trunk', 'mobility', 'recovery',
        'bike_erg', 'rower_erg', 'low_load_accessory',
      ],
      globalRules: [
        'No sprinting or cutting',
        'No adductor-heavy work',
        'No lateral lunges',
      ],
      safeTrainingFocus: ['Upper body', 'Hip-dominant lower if pain-free', 'Bike', 'Trunk'],
      physioAdvice: PHYSIO_HARD,
    },
    moderate: {
      redPatterns: ['sprint', 'adductor_groin'],
      amberPatterns: ['lunge', 'plyometric'],
      greenPatterns: [
        'horizontal_press', 'vertical_press', 'overhead_loading',
        'explosive_push', 'shoulder_isolation', 'heavy_pull',
        'squat', 'hinge', 'knee_dominant', 'posterior_chain',
        'trunk', 'mobility', 'recovery', 'bike_erg', 'rower_erg',
        'low_load_accessory',
      ],
      globalRules: ['No sprinting / cutting', 'Reduce adductor work'],
      safeTrainingFocus: ['Upper body', 'Bilateral lower', 'Bike', 'Trunk'],
      physioAdvice: PHYSIO_SOFT,
    },
    minor: {
      redPatterns: [],
      amberPatterns: ['sprint', 'adductor_groin'],
      greenPatterns: [
        'horizontal_press', 'vertical_press', 'overhead_loading',
        'explosive_push', 'shoulder_isolation', 'heavy_pull',
        'squat', 'lunge', 'hinge', 'knee_dominant', 'posterior_chain',
        'running', 'plyometric', 'trunk', 'mobility', 'recovery',
        'bike_erg', 'rower_erg', 'ski_erg', 'low_load_accessory',
      ],
      globalRules: ['Rebuild lateral work gradually'],
      safeTrainingFocus: ['Most of the program - monitor symptoms'],
    },
  },

  pubalgia: {
    severe: {
      redPatterns: ['sprint', 'running', 'lunge', 'plyometric', 'hinge', 'adductor_groin'],
      amberPatterns: ['squat', 'knee_dominant'],
      greenPatterns: [
        'horizontal_press', 'vertical_press', 'overhead_loading',
        'explosive_push', 'shoulder_isolation', 'heavy_pull',
        'trunk', 'mobility', 'recovery',
        'bike_erg', 'rower_erg', 'low_load_accessory',
      ],
      globalRules: ['No cutting / kicking', 'No heavy hinges'],
      safeTrainingFocus: ['Upper body', 'Trunk if pain-free', 'Bike'],
      physioAdvice: PHYSIO_HARD,
    },
    moderate: {
      redPatterns: ['sprint', 'hinge', 'adductor_groin'],
      amberPatterns: ['lunge', 'plyometric'],
      greenPatterns: [
        'horizontal_press', 'vertical_press', 'overhead_loading',
        'explosive_push', 'shoulder_isolation', 'heavy_pull',
        'squat', 'knee_dominant', 'posterior_chain', 'trunk',
        'mobility', 'recovery', 'bike_erg', 'rower_erg',
        'low_load_accessory',
      ],
      globalRules: ['No sprinting / cutting / kicking', 'Reduce adductor + hinge work'],
      safeTrainingFocus: ['Upper body', 'Light bilateral lower', 'Bike', 'Trunk'],
      physioAdvice: PHYSIO_SOFT,
    },
    minor: {
      redPatterns: [],
      amberPatterns: ['sprint', 'adductor_groin', 'hinge'],
      greenPatterns: [
        'horizontal_press', 'vertical_press', 'overhead_loading',
        'explosive_push', 'shoulder_isolation', 'heavy_pull',
        'squat', 'lunge', 'knee_dominant', 'posterior_chain',
        'running', 'plyometric', 'trunk', 'mobility', 'recovery',
        'bike_erg', 'rower_erg', 'ski_erg', 'low_load_accessory',
      ],
      globalRules: ['Rebuild kicking + cutting gradually'],
      safeTrainingFocus: ['Most of the program - monitor symptoms'],
    },
  },

  elbow: {
    severe: {
      redPatterns: ['horizontal_press', 'vertical_press', 'overhead_loading', 'explosive_push', 'heavy_pull', 'grip_heavy', 'loaded_carry'],
      amberPatterns: ['shoulder_isolation'],
      greenPatterns: [
        'squat', 'lunge', 'hinge', 'plyometric', 'sprint', 'running',
        'knee_dominant', 'posterior_chain', 'trunk', 'mobility',
        'recovery', 'bike_erg', 'low_load_accessory',
      ],
      globalRules: ['No heavy pressing or pulling', 'No loaded gripping work'],
      safeTrainingFocus: ['Lower body', 'Trunk', 'Bike'],
      physioAdvice: PHYSIO_HARD,
    },
    moderate: {
      redPatterns: ['heavy_pull', 'grip_heavy'],
      amberPatterns: ['horizontal_press', 'vertical_press', 'overhead_loading'],
      greenPatterns: [
        'squat', 'lunge', 'hinge', 'plyometric', 'sprint', 'running',
        'knee_dominant', 'posterior_chain', 'shoulder_isolation', 'trunk',
        'mobility', 'recovery', 'bike_erg', 'low_load_accessory',
      ],
      globalRules: ['Avoid heavy pulling and gripping'],
      safeTrainingFocus: ['Lower body', 'Light upper accessories', 'Trunk'],
      physioAdvice: PHYSIO_SOFT,
    },
    minor: {
      redPatterns: [],
      amberPatterns: ['heavy_pull', 'grip_heavy'],
      greenPatterns: [
        'horizontal_press', 'vertical_press', 'overhead_loading',
        'explosive_push', 'shoulder_isolation', 'heavy_pull',
        'squat', 'lunge', 'hinge', 'knee_dominant', 'posterior_chain',
        'running', 'plyometric', 'sprint', 'trunk', 'mobility',
        'recovery', 'bike_erg', 'rower_erg', 'ski_erg', 'low_load_accessory',
      ],
      globalRules: ['Build pulling load back gradually'],
      safeTrainingFocus: ['Most of the program - monitor symptoms'],
    },
  },

  wrist: {
    severe: {
      redPatterns: ['horizontal_press', 'vertical_press', 'overhead_loading', 'explosive_push', 'heavy_pull', 'grip_heavy', 'loaded_carry'],
      amberPatterns: [],
      greenPatterns: [
        'squat', 'lunge', 'hinge', 'plyometric', 'sprint', 'running',
        'knee_dominant', 'posterior_chain', 'trunk', 'mobility',
        'recovery', 'bike_erg', 'low_load_accessory',
      ],
      globalRules: ['No pressing / pulling that loads the wrist', 'No loaded gripping'],
      safeTrainingFocus: ['Lower body', 'Trunk', 'Bike'],
      physioAdvice: PHYSIO_HARD,
    },
    moderate: {
      redPatterns: ['heavy_pull', 'grip_heavy'],
      amberPatterns: ['horizontal_press', 'vertical_press'],
      greenPatterns: [
        'squat', 'lunge', 'hinge', 'plyometric', 'sprint', 'running',
        'knee_dominant', 'posterior_chain', 'trunk', 'mobility',
        'recovery', 'bike_erg', 'low_load_accessory',
      ],
      globalRules: ['Avoid heavy pulling and loaded gripping'],
      safeTrainingFocus: ['Lower body', 'Light upper accessories', 'Trunk'],
      physioAdvice: PHYSIO_SOFT,
    },
    minor: {
      redPatterns: [],
      amberPatterns: ['heavy_pull', 'grip_heavy'],
      greenPatterns: [
        'horizontal_press', 'vertical_press', 'overhead_loading',
        'explosive_push', 'shoulder_isolation', 'squat', 'lunge',
        'hinge', 'knee_dominant', 'posterior_chain', 'running',
        'plyometric', 'sprint', 'trunk', 'mobility', 'recovery',
        'bike_erg', 'rower_erg', 'ski_erg', 'low_load_accessory',
      ],
      globalRules: ['Build grip work back gradually'],
      safeTrainingFocus: ['Most of the program - monitor symptoms'],
    },
  },
};

export function getTrainAroundPolicy(
  bucket: InjuryBucket | null,
  severity: number,
): TrainAroundPolicy | null {
  if (!bucket) return null;
  const tier = severityToTier(severity);
  const entry = POLICY_TABLE[bucket]?.[tier];
  if (!entry) return null;
  return {
    bucket,
    severityTier: tier,
    ...entry,
    physioAdvice: injurySeverityRecommendsPhysio(severity)
      ? PHYSIO_HARD
      : entry.physioAdvice,
  };
}

// ─── Per-exercise decision ──────────────────────────────────────────

export interface ExerciseDecision {
  decision: MovementRisk;
  /** Patterns matched on the exercise name. */
  patterns: MovementPattern[];
  /** Patterns that triggered the decision. */
  triggeringPatterns: MovementPattern[];
  /** Free-text reason for logs. */
  reason: string;
}

export function classifyExercise(
  exerciseName: string,
  policy: TrainAroundPolicy,
): ExerciseDecision {
  const patterns = classifyExercisePatterns(exerciseName);
  if (patterns.length === 0) {
    return {
      decision: 'green',
      patterns,
      triggeringPatterns: [],
      reason: 'no recognised movement pattern (default keep)',
    };
  }
  const redHits = patterns.filter((p) => policy.redPatterns.includes(p));
  if (redHits.length > 0) {
    return {
      decision: 'red',
      patterns,
      triggeringPatterns: redHits,
      reason: `red: ${redHits.join(', ')}`,
    };
  }
  const amberHits = patterns.filter((p) => policy.amberPatterns.includes(p));
  if (amberHits.length > 0) {
    return {
      decision: policy.severityTier === 'severe' ? 'red' : 'amber',
      patterns,
      triggeringPatterns: amberHits,
      reason: `amber: ${amberHits.join(', ')}${
        policy.severityTier === 'severe' ? ' (severe → escalate)' : ''
      }`,
    };
  }
  return {
    decision: 'green',
    patterns,
    triggeringPatterns: [],
    reason: 'no policy hits',
  };
}

// ─── Session-level decision ─────────────────────────────────────────

export type SessionImpact = 'none' | 'low' | 'moderate' | 'high';

export interface ApplyTrainAroundResult {
  workout: Workout;
  removed: Array<{ name: string; patterns: MovementPattern[] }>;
  kept: string[];
  impact: SessionImpact;
  /** True when at least one exercise was removed or coachNote attached. */
  policyApplied: boolean;
}

function isRecovery(workout: Workout): boolean {
  const wt = (workout as any).workoutType;
  if (wt === 'Recovery') return true;
  if ((workout as any).sessionTier === 'recovery') return true;
  return /\brecovery\b/i.test(workout.name || '');
}
function isGame(workout: Workout): boolean {
  return (workout as any).workoutType === 'Game';
}

export function applyTrainAroundPolicy(
  workout: Workout,
  policy: TrainAroundPolicy,
): ApplyTrainAroundResult {
  if (isRecovery(workout) || isGame(workout)) {
    return {
      workout,
      removed: [],
      kept: (workout.exercises ?? []).map((e: any) => e.exercise?.name ?? '').filter(Boolean),
      impact: 'none',
      policyApplied: false,
    };
  }

  const removed: Array<{ name: string; patterns: MovementPattern[] }> = [];
  const kept: string[] = [];
  const newExercises: WorkoutExercise[] = [];

  for (const ex of workout.exercises ?? []) {
    const name: string = (ex as any).exercise?.name ?? '';
    if (!name) {
      newExercises.push(ex);
      continue;
    }
    const decision = classifyExercise(name, policy);
    logger.debug('[train-around] exercise_decision', {
      exercise: name,
      patterns: decision.patterns,
      decision: decision.decision,
      triggeringPatterns: decision.triggeringPatterns,
      reason: decision.reason,
    });
    if (decision.decision === 'red') {
      removed.push({ name, patterns: decision.triggeringPatterns });
      // Don't replace — see module docstring. The athlete is told what
      // SAFE training to do; we do not fabricate fake substitutions.
    } else {
      kept.push(name);
      newExercises.push(ex);
    }
  }

  const totalBefore = (workout.exercises ?? []).length;
  const removedCount = removed.length;
  let impact: SessionImpact = 'none';
  if (removedCount === 0) impact = 'none';
  else if (removedCount / Math.max(1, totalBefore) >= 0.5) impact = 'high';
  else if (removedCount >= 2) impact = 'moderate';
  else impact = 'low';

  // Attach coachNotes summarising what was removed and why.
  let coachNotes = workout.coachNotes ? [...workout.coachNotes] : [];
  if (removedCount > 0) {
    for (const r of removed) {
      const note = `Removed: ${r.name}`;
      if (!coachNotes.includes(note)) coachNotes.push(note);
    }
    for (const rule of policy.globalRules) {
      if (!coachNotes.includes(rule)) coachNotes.push(rule);
    }
  }

  logger.debug('[train-around] session_decision', {
    workoutName: workout.name,
    bucket: policy.bucket,
    tier: policy.severityTier,
    impact,
    removed: removed.map((r) => r.name),
    kept,
  });

  return {
    workout: {
      ...workout,
      exercises: newExercises,
      coachNotes,
    },
    removed,
    kept,
    impact,
    policyApplied: removedCount > 0,
  };
}

// ─── Final consistency validator ────────────────────────────────────

export interface PolicyViolation {
  date?: string;
  workoutName?: string;
  exercise: string;
  patterns: MovementPattern[];
  triggeringPatterns: MovementPattern[];
}

export interface ValidationResult {
  passed: boolean;
  violations: PolicyViolation[];
}

export function validateAgainstPolicy(
  workout: Workout | null,
  policy: TrainAroundPolicy | null,
  meta: { date?: string } = {},
): ValidationResult {
  if (!workout || !policy) return { passed: true, violations: [] };
  if (isRecovery(workout) || isGame(workout)) return { passed: true, violations: [] };

  const violations: PolicyViolation[] = [];
  for (const ex of workout.exercises ?? []) {
    const name: string = (ex as any).exercise?.name ?? '';
    if (!name) continue;
    const decision = classifyExercise(name, policy);
    if (decision.decision === 'red') {
      violations.push({
        date: meta.date,
        workoutName: workout.name,
        exercise: name,
        patterns: decision.patterns,
        triggeringPatterns: decision.triggeringPatterns,
      });
    }
  }
  const passed = violations.length === 0;
  logger.debug('[train-around] final_validation', {
    date: meta.date ?? null,
    workoutName: workout.name,
    bucket: policy.bucket,
    tier: policy.severityTier,
    passed,
    violationCount: violations.length,
    violations: violations.map((v) => v.exercise),
  });
  return { passed, violations };
}
