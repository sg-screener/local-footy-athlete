/**
 * exposureEngine.ts — Universal S&C constraint + exposure engine.
 *
 * This is the GENERAL decision layer that replaces all per-body-part
 * blacklists. It reasons about TRAINING EXPOSURES (sprint, heavy_hinge,
 * overhead_loading, etc.) rather than exercise names, and supports
 * arbitrary constraint types (injury, fatigue, soreness, schedule,
 * missed_session, equipment, preference, game_proximity).
 *
 * Pipeline:
 *   exercise name
 *   → classifyExerciseExposures(name)        → Exposure[]
 *   → scoreExerciseAgainstConstraints(...)   → keep | limit | remove
 *   → classifySessionAgainstConstraints(...) → impact + action
 *   → applyConstraintsToSession(...)         → rebuilt workout
 *   → validateVisibleProgramAgainstConstraints → final sweep
 *
 * Design rules:
 *   D1. Decisions are EXPOSURE-driven, not name-driven. Exercise names
 *       map to exposures; constraints block/limit exposures. Adding a
 *       new constraint never requires touching the classifier.
 *   D2. No fake substitutions. Red exercises are removed. The athlete
 *       is told what SAFE training to focus on instead.
 *   D3. Multiple constraints — most conservative wins. If one blocks
 *       and another permits, blocked wins.
 *   D4. Recovery + game sessions are NEVER modified.
 *   D5. The validator is the last word. Anything blocked that survived
 *       prior passes is dropped, with a loud log.
 *
 * Logs (runtime):
 *   [exposure] exercise_decision  { name, exposures, decision, ... }
 *   [exposure] session_decision   { workoutName, impact, action, ... }
 *   [exposure] final_validation   { date, passed, violations, ... }
 */

import type { Workout, WorkoutExercise } from '../types/domain';
import { logger } from './logger';

// ─── Exposure taxonomy ──────────────────────────────────────────────

export type Exposure =
  // Lower body / running
  | 'sprint'
  | 'high_speed_running'
  | 'acceleration'
  | 'change_of_direction'
  | 'running'
  | 'plyometric'
  | 'explosive_lower'
  | 'heavy_lower_strength'
  | 'heavy_squat'
  | 'heavy_hinge'
  | 'knee_dominant'
  | 'hip_dominant'
  | 'posterior_chain'
  | 'hamstring_dominant'
  | 'calf_achilles'
  | 'adductor_groin'
  | 'axial_loading'
  | 'loaded_carry'
  | 'lunge'
  | 'squat'
  | 'hinge'
  // Upper body
  | 'horizontal_press'
  | 'vertical_press'
  | 'overhead_loading'
  | 'explosive_push'
  | 'shoulder_isolation'
  | 'horizontal_pull'
  | 'vertical_pull'
  | 'heavy_pull'
  | 'grip_heavy'
  | 'elbow_loading'
  | 'wrist_loading'
  // General
  | 'trunk'
  | 'anti_rotation'
  | 'mobility'
  | 'recovery'
  | 'easy_erg'
  | 'hard_erg'
  | 'low_load_accessory'
  | 'machine_supported'
  | 'isometric'
  | 'contact_risk'
  | 'max_effort_strength'
  | 'high_volume_accessory';

export type ConstraintType =
  | 'injury'
  | 'fatigue'
  | 'soreness'
  | 'schedule'
  | 'missed_session'
  | 'equipment'
  | 'preference'
  | 'game_proximity';

export type ConstraintRegion =
  | 'shoulder'
  | 'elbow'
  | 'wrist'
  | 'back'
  | 'hip'
  | 'groin'
  | 'hamstring'
  | 'quad'
  | 'knee'
  | 'calf'
  | 'achilles'
  | 'ankle'
  | 'global';

export interface Constraint {
  id: string;
  type: ConstraintType;
  /** 1–10. Severity drives how aggressive the engine is. */
  severity?: number;
  region?: ConstraintRegion;
  status?: 'active' | 'improving' | 'resolved';
  startDate: string;
  blockedExposures: Exposure[];
  limitedExposures: Exposure[];
  allowedExposures: Exposure[];
  /** Free-text — drives coachNotes. */
  safeFocus: string[];
  /** Free-text closing advice — physio etc. */
  advice?: string[];
  /** Human-readable reason for logs. */
  label?: string;
}

export type ExerciseDecisionKind = 'keep' | 'limit' | 'remove';

export interface ExerciseDecision {
  decision: ExerciseDecisionKind;
  matchedExposures: Exposure[];
  triggeringExposures: Exposure[];
  /** Constraint id(s) that drove the decision. */
  triggeringConstraintIds: string[];
  reason: string;
}

export type SessionImpact = 'none' | 'low' | 'moderate' | 'high';
export type SessionAction = 'unchanged' | 'modify' | 'rebuild' | 'recovery';

export interface SessionClassification {
  impact: SessionImpact;
  action: SessionAction;
  exerciseDecisions: Array<{ name: string } & ExerciseDecision>;
  removedNames: string[];
  limitedNames: string[];
  keptNames: string[];
}

export interface ApplyConstraintsResult {
  workout: Workout;
  classification: SessionClassification;
  /** True when at least one exercise was removed or note attached. */
  applied: boolean;
}

export interface ProgramViolation {
  date?: string;
  workoutName?: string;
  exercise: string;
  exposures: Exposure[];
  triggeringExposures: Exposure[];
  constraintIds: string[];
}

export interface ProgramValidationResult {
  passed: boolean;
  violations: ProgramViolation[];
}

// ─── Exposure classifier ────────────────────────────────────────────

/**
 * Map an exercise NAME → set of exposures. Robust to AI-generated
 * naming variants. Returns [] for genuinely unknown exercises so the
 * caller defaults to KEEP (don't remove what you don't understand).
 */
export function classifyExerciseExposures(rawName: string): Exposure[] {
  if (!rawName) return [];
  const n = rawName.toLowerCase();
  const out: Set<Exposure> = new Set();

  // ─ Pressing
  if (/(bench\s*press|incline\s*press|incline.*db\s*press|decline\s*press|chest\s*press)/i.test(n)) {
    out.add('horizontal_press');
  }
  if (/(push[-\s]?ups?|press[-\s]?ups?)/i.test(n) && !/(scap|bird|hindu|wall)/i.test(n)) {
    out.add('horizontal_press');
  }
  if (/(overhead\s*press|shoulder\s*press|\bohp\b|military\s*press|pike\s*press|push\s*press|jerk|snatch)/i.test(n)) {
    out.add('vertical_press');
    out.add('overhead_loading');
  }
  if (/(arnold\s*press|landmine\s*press|seated\s*db\s*press)/i.test(n)) {
    out.add('vertical_press');
    if (/(seated\s*db\s*press|arnold\s*press)/i.test(n)) out.add('overhead_loading');
  }
  if (/(explosive|plyo.*push|clap\s*push)/i.test(n)) {
    out.add('explosive_push');
  }
  if (/dips?\b/i.test(n)) {
    out.add('horizontal_press');
    out.add('elbow_loading');
  }

  // ─ Pulling — note deadlifts are HINGE patterns, not "heavy_pull"
  // (heavy_pull is reserved for rows/pull-ups — upper-body pulling).
  if (/(deadlift|rdl|romanian\s*deadlift|trap\s*bar)/i.test(n)) {
    out.add('hinge');
    out.add('heavy_hinge');
    out.add('posterior_chain');
    out.add('hip_dominant');
    out.add('heavy_lower_strength');
    if (/\bdeadlift\b|trap\s*bar/i.test(n)) out.add('axial_loading');
    if (/(rdl|romanian\s*deadlift)/i.test(n)) out.add('hamstring_dominant');
  }
  if (/(barbell\s*row|bent[-\s]*over\s*row|pendlay|t[-\s]*bar\s*row)/i.test(n)) {
    out.add('horizontal_pull');
    out.add('heavy_pull');
  }
  if (/(seated\s*row|cable\s*row|machine\s*row)/i.test(n)) {
    out.add('horizontal_pull');
    if (/machine/i.test(n)) out.add('machine_supported');
  }
  if (/pull[-\s]?ups?|chin[-\s]?ups?/i.test(n)) {
    out.add('vertical_pull');
    out.add('heavy_pull');
    out.add('grip_heavy');
  }
  if (/lat\s*pull|pulldown/i.test(n)) {
    out.add('vertical_pull');
  }

  // ─ Shoulder isolation
  if (/(lateral\s*raise|front\s*raise|rear\s*delt|reverse\s*fly|external\s*rotation|internal\s*rotation|cuban\s*press|y\s*raise)/i.test(n)) {
    out.add('shoulder_isolation');
  }

  // ─ Carry / grip
  if (/(farmer.*carry|suitcase\s*carry|loaded\s*carry|trap\s*bar\s*carry|yoke)/i.test(n)) {
    out.add('loaded_carry');
    out.add('grip_heavy');
  }

  // ─ Squat
  if (/squat\b/i.test(n) && !/(hindu|sissy|wall|jump\s*squat|squat\s*jump)/i.test(n)) {
    out.add('squat');
    out.add('knee_dominant');
    if (/(back\s*squat|front\s*squat|barbell\s*squat|heavy\s*squat|low\s*bar|high\s*bar)/i.test(n)) {
      out.add('heavy_squat');
      out.add('heavy_lower_strength');
      out.add('axial_loading');
    }
  }
  if (/(squat\s*jump|jump\s*squat)/i.test(n)) {
    out.add('plyometric');
    out.add('explosive_lower');
    out.add('squat');
  }
  if (/leg\s*press/i.test(n)) {
    out.add('squat');
    out.add('knee_dominant');
    out.add('machine_supported');
  }

  // ─ Lunge / single-leg
  if (/(lunge|split\s*squat|step[-\s]*up|bulgarian|reverse\s*lunge|walking\s*lunge|forward\s*lunge|side\s*lunge|lateral\s*lunge)/i.test(n)) {
    out.add('lunge');
    out.add('knee_dominant');
    if (/(heavy|barbell|loaded)/i.test(n)) out.add('heavy_lower_strength');
  }

  // ─ Hinge / posterior chain (non-deadlift)
  if (/(good\s*morning|kettlebell\s*swing|hip\s*thrust|glute\s*bridge|back\s*extension|reverse\s*hyper|45\s*degree)/i.test(n)) {
    out.add('hinge');
    out.add('hip_dominant');
    out.add('posterior_chain');
    if (/(good\s*morning|reverse\s*hyper)/i.test(n)) out.add('heavy_hinge');
  }
  if (/(nordic|hamstring\s*curl|leg\s*curl|prone\s*curl|slider\s*curl|slider\s*hamstring)/i.test(n)) {
    out.add('posterior_chain');
    out.add('hamstring_dominant');
    if (/nordic/i.test(n)) {
      out.add('isometric');
      out.add('explosive_lower');
    }
  }

  // ─ Plyometric / explosive
  if (/(box\s*jump|broad\s*jump|tuck\s*jump|squat\s*jump|jump\s*squat|depth\s*jump|hop|bound|pogo|plyo)/i.test(n)) {
    out.add('plyometric');
    out.add('explosive_lower');
  }

  // ─ Sprint / running
  if (/(\bsprint(s|ing)?\b|10\s*m\s*sprint|flying\s*sprint|hill\s*sprint|max\s*velocity|3\s*?\d\s*m\s*sprint)/i.test(n)) {
    out.add('sprint');
    out.add('acceleration');
    out.add('high_speed_running');
    out.add('running');
  }
  if (/(\brun\b|\bruns\b|tempo\s*run|long\s*run|interval\s*run|fartlek|\bmas\b|km\s*repeat|jog)/i.test(n)) {
    out.add('running');
    if (/tempo/i.test(n)) out.add('high_speed_running');
    if (/interval|fartlek|repeat/i.test(n)) out.add('hard_erg');
    if (/long|easy|jog/i.test(n)) out.add('easy_erg');
  }
  if (/(cut(ting)?|change[-\s]*of[-\s]*direction|cod\b|agility|shuttle|t[-\s]*test|zigzag|side\s*shuffle)/i.test(n)) {
    out.add('change_of_direction');
    out.add('contact_risk');
  }

  // ─ Calf / achilles
  if (/calf\s*raise|calf\b|gastroc|soleus|donkey\s*calf|toe\s*raise/i.test(n)) {
    out.add('calf_achilles');
  }

  // ─ Adductor / groin
  if (/(copenhagen|adductor|groin|pancake)/i.test(n)) {
    out.add('adductor_groin');
    if (/copenhagen/i.test(n)) {
      out.add('isometric');
      out.add('trunk');
    }
  }

  // ─ Trunk / anti-rotation
  if (/(plank|side\s*plank|dead[-\s]?bug|bird[-\s]?dog|ab\s*wheel|hollow|crunch|sit[-\s]?up|core)/i.test(n)) {
    out.add('trunk');
    if (/(plank|hollow|dead\s*bug|bird\s*dog)/i.test(n)) out.add('isometric');
  }
  if (/(pallof|landmine\s*twist|rotation|anti[-\s]?rotation|cable\s*chop|woodchop)/i.test(n)) {
    out.add('trunk');
    out.add('anti_rotation');
  }

  // ─ Mobility / recovery
  if (/(mobility|stretch|foam\s*roll|active\s*recovery|walk(ing)?)/i.test(n)) {
    out.add('mobility');
  }
  if (/recovery/i.test(n)) {
    out.add('recovery');
  }

  // ─ Conditioning ergs
  if (/(assault\s*bike|echo\s*bike|airbike|\bbike\b|cycling)/i.test(n)) {
    if (/(zone\s*[12]|easy|aerobic\s*base|long)/i.test(n)) out.add('easy_erg');
    else if (/(intervals?|sprint|hard|hiit|threshold)/i.test(n)) out.add('hard_erg');
    else out.add('easy_erg'); // bike default
  }
  if (/(rower|rowing\s*erg|\brow\b)/i.test(n) && !/(bent|barbell|seal|cable|machine\s*row|seated\s*row)/i.test(n)) {
    if (/(intervals?|sprint|hard|threshold)/i.test(n)) out.add('hard_erg');
    else out.add('easy_erg');
  }
  if (/ski[-\s]?erg|ski\s*machine/i.test(n)) {
    out.add('easy_erg');
  }

  // ─ Low-load accessory
  if (/(bicep\s*curl|tricep|hammer\s*curl|wrist\s*curl|face\s*pull|band\s*pull[-\s]?apart|reverse\s*curl)/i.test(n)) {
    out.add('low_load_accessory');
    if (/wrist/i.test(n)) out.add('wrist_loading');
    if (/(bicep|tricep|hammer|reverse\s*curl)/i.test(n)) out.add('elbow_loading');
  }

  // ─ Machine-supported (general flag)
  if (/machine|smith\s*machine|hack\s*squat|chest\s*press\s*machine/i.test(n)) {
    out.add('machine_supported');
  }

  return Array.from(out);
}

// ─── Constraint builders ────────────────────────────────────────────

export function severityToTier(severity: number): 'minor' | 'moderate' | 'severe' {
  if (severity >= 7) return 'severe';
  if (severity >= 4) return 'moderate';
  return 'minor';
}

const PHYSIO_HARD = 'Get this assessed by a physio so we know what you can safely reload.';
const PHYSIO_SOFT = "If it's not improving in a few days, worth getting a physio to look at it.";

function regionToBlockedRegional(region: ConstraintRegion, severity: number): {
  blocked: Exposure[];
  limited: Exposure[];
  allowed: Exposure[];
  safeFocus: string[];
} {
  const tier = severityToTier(severity);
  const generalSafe: Exposure[] = [
    'trunk', 'anti_rotation', 'mobility', 'recovery', 'easy_erg', 'low_load_accessory',
  ];
  const upperBodyAllowed: Exposure[] = [
    'horizontal_press', 'vertical_press', 'overhead_loading',
    'shoulder_isolation', 'horizontal_pull', 'vertical_pull',
  ];
  const lowerBodyAllowed: Exposure[] = [
    'squat', 'lunge', 'hinge', 'knee_dominant', 'hip_dominant',
    'posterior_chain', 'plyometric', 'sprint',
  ];

  switch (region) {
    case 'shoulder':
    case 'elbow':
    case 'wrist': {
      const blocked: Exposure[] = [];
      const limited: Exposure[] = [];
      if (tier === 'severe') {
        blocked.push(
          'horizontal_press', 'vertical_press', 'overhead_loading',
          'explosive_push', 'shoulder_isolation', 'heavy_pull',
          'loaded_carry', 'grip_heavy', 'contact_risk',
        );
        if (region === 'wrist') blocked.push('wrist_loading');
        if (region === 'elbow') blocked.push('elbow_loading');
        limited.push('horizontal_pull', 'vertical_pull');
      } else if (tier === 'moderate') {
        blocked.push('overhead_loading', 'explosive_push');
        limited.push(
          'horizontal_press', 'vertical_press', 'shoulder_isolation',
          'heavy_pull', 'grip_heavy', 'loaded_carry',
        );
        if (region === 'wrist') limited.push('wrist_loading');
        if (region === 'elbow') limited.push('elbow_loading');
      } else {
        limited.push('overhead_loading', 'explosive_push', 'heavy_pull', 'grip_heavy');
      }
      return {
        blocked,
        limited,
        allowed: [...lowerBodyAllowed, ...generalSafe],
        safeFocus: ['Lower body', 'Trunk', 'Easy bike / rower / ski if pain-free', 'Light accessories'],
      };
    }

    case 'hamstring': {
      const blocked: Exposure[] = [];
      const limited: Exposure[] = [];
      if (tier === 'severe') {
        blocked.push(
          'sprint', 'high_speed_running', 'plyometric', 'explosive_lower',
          'hinge', 'heavy_hinge', 'posterior_chain', 'hamstring_dominant',
        );
        // Heavy back squats load the hamstring eccentrically at depth —
        // limit at severe so they stay flagged but don't blanket-block
        // unloaded knee-dominant work.
        limited.push('heavy_squat', 'heavy_lower_strength');
      } else if (tier === 'moderate') {
        blocked.push(
          'sprint', 'high_speed_running', 'plyometric', 'explosive_lower',
          'heavy_hinge', 'hamstring_dominant',
        );
        limited.push('hinge', 'posterior_chain', 'heavy_lower_strength', 'heavy_squat');
      } else {
        limited.push('sprint', 'heavy_hinge', 'plyometric', 'hamstring_dominant');
      }
      return {
        blocked, limited,
        allowed: [...upperBodyAllowed, ...generalSafe, 'horizontal_pull', 'vertical_pull', 'squat', 'knee_dominant'],
        safeFocus: ['Upper body', 'Trunk', 'Quad-dominant lower if pain-free', 'Easy bike / rower / ski'],
      };
    }

    case 'knee':
    case 'quad': {
      const blocked: Exposure[] = [];
      const limited: Exposure[] = [];
      if (tier === 'severe') {
        blocked.push(
          'plyometric', 'explosive_lower', 'sprint', 'high_speed_running',
          'change_of_direction', 'squat', 'lunge', 'knee_dominant',
          'heavy_squat',
        );
      } else if (tier === 'moderate') {
        blocked.push('plyometric', 'sprint', 'change_of_direction');
        limited.push('squat', 'lunge', 'knee_dominant', 'heavy_squat');
      } else {
        limited.push('plyometric', 'sprint', 'heavy_squat');
      }
      return {
        blocked, limited,
        allowed: [...upperBodyAllowed, ...generalSafe, 'horizontal_pull', 'vertical_pull', 'hinge', 'posterior_chain', 'hip_dominant'],
        safeFocus: ['Upper body', 'Hinge work (light)', 'Trunk', 'Easy bike'],
      };
    }

    case 'calf':
    case 'achilles': {
      const blocked: Exposure[] = [];
      const limited: Exposure[] = [];
      if (tier === 'severe') {
        blocked.push(
          'sprint', 'high_speed_running', 'running', 'plyometric',
          'explosive_lower', 'calf_achilles', 'change_of_direction',
        );
      } else if (tier === 'moderate') {
        blocked.push('sprint', 'plyometric', 'calf_achilles', 'high_speed_running');
        limited.push('running');
      } else {
        limited.push('sprint', 'plyometric');
      }
      return {
        blocked, limited,
        allowed: [
          ...upperBodyAllowed, ...generalSafe, 'horizontal_pull', 'vertical_pull',
          'squat', 'lunge', 'hinge', 'knee_dominant', 'hip_dominant',
          'posterior_chain', 'heavy_lower_strength', 'heavy_hinge', 'heavy_squat',
        ],
        safeFocus: ['Upper body', 'Hip-dominant lower', 'Trunk', 'Easy bike if pain-free'],
      };
    }

    case 'groin': {
      const blocked: Exposure[] = [];
      const limited: Exposure[] = [];
      if (tier === 'severe') {
        blocked.push(
          'sprint', 'high_speed_running', 'change_of_direction',
          'adductor_groin', 'lunge', 'plyometric',
        );
      } else if (tier === 'moderate') {
        blocked.push('sprint', 'change_of_direction', 'adductor_groin');
        limited.push('lunge', 'plyometric');
      } else {
        limited.push('sprint', 'change_of_direction', 'adductor_groin');
      }
      return {
        blocked, limited,
        allowed: [...upperBodyAllowed, ...generalSafe, 'horizontal_pull', 'vertical_pull', 'squat', 'hinge', 'knee_dominant'],
        safeFocus: ['Upper body', 'Bilateral lower', 'Trunk', 'Easy bike'],
      };
    }

    case 'hip': {
      const blocked: Exposure[] = [];
      const limited: Exposure[] = [];
      if (tier === 'severe') {
        blocked.push(
          'heavy_squat', 'heavy_hinge', 'lunge', 'sprint',
          'plyometric', 'change_of_direction',
        );
        limited.push('hip_dominant');
      } else if (tier === 'moderate') {
        blocked.push('sprint', 'plyometric');
        limited.push('lunge', 'heavy_squat', 'heavy_hinge', 'hip_dominant');
      } else {
        limited.push('sprint', 'plyometric', 'heavy_hinge');
      }
      return {
        blocked, limited,
        allowed: [...upperBodyAllowed, ...generalSafe, 'horizontal_pull', 'vertical_pull', 'trunk'],
        safeFocus: ['Upper body', 'Light bilateral lower', 'Trunk', 'Easy bike'],
      };
    }

    case 'ankle': {
      const blocked: Exposure[] = [];
      const limited: Exposure[] = [];
      if (tier === 'severe') {
        blocked.push(
          'sprint', 'high_speed_running', 'plyometric',
          'change_of_direction', 'lunge', 'running',
        );
      } else if (tier === 'moderate') {
        blocked.push('sprint', 'plyometric', 'change_of_direction');
        limited.push('lunge', 'running');
      } else {
        limited.push('sprint', 'plyometric', 'change_of_direction');
      }
      return {
        blocked, limited,
        allowed: [
          ...upperBodyAllowed, ...generalSafe, 'horizontal_pull', 'vertical_pull',
          'squat', 'hinge', 'knee_dominant', 'hip_dominant', 'posterior_chain',
        ],
        safeFocus: ['Upper body', 'Bilateral lower', 'Trunk', 'Easy bike'],
      };
    }

    case 'back': {
      const blocked: Exposure[] = [];
      const limited: Exposure[] = [];
      if (tier === 'severe') {
        blocked.push(
          'axial_loading', 'heavy_hinge', 'heavy_squat', 'loaded_carry',
          'heavy_pull', 'heavy_lower_strength', 'hinge', 'posterior_chain',
        );
        limited.push('squat', 'overhead_loading');
      } else if (tier === 'moderate') {
        blocked.push('heavy_hinge', 'heavy_pull', 'axial_loading');
        limited.push('heavy_squat', 'loaded_carry', 'hinge');
      } else {
        limited.push('heavy_hinge', 'heavy_pull', 'axial_loading');
      }
      return {
        blocked,
        limited,
        allowed: [
          'horizontal_press', 'vertical_press', 'shoulder_isolation',
          'lunge', 'knee_dominant', ...generalSafe, 'machine_supported',
        ],
        safeFocus: [
          'Supported upper body',
          'Light unilateral lower (no axial load)',
          'Trunk if pain-free',
          'Bike / walk / mobility',
        ],
      };
    }

    default:
      return { blocked: [], limited: [], allowed: [], safeFocus: [] };
  }
}

/**
 * Build an injury constraint. severity 1-10. Returns null if region
 * is not provided (caller must pre-canonicalise unknowns).
 */
export function buildInjuryConstraint(args: {
  id?: string;
  region: ConstraintRegion;
  severity: number;
  status?: 'active' | 'improving' | 'resolved';
  startDate?: string;
}): Constraint {
  const region = args.region;
  const severity = args.severity;
  const tier = severityToTier(severity);
  const sets = regionToBlockedRegional(region, severity);
  const advice: string[] = [];
  if (tier === 'severe') advice.push(PHYSIO_HARD);
  else if (tier === 'moderate') advice.push(PHYSIO_SOFT);

  return {
    id: args.id ?? `injury-${region}-${Date.now()}`,
    type: 'injury',
    region,
    severity,
    status: args.status ?? 'active',
    startDate: args.startDate ?? new Date().toISOString(),
    blockedExposures: sets.blocked,
    limitedExposures: sets.limited,
    allowedExposures: sets.allowed,
    safeFocus: sets.safeFocus,
    advice,
    label: `injury:${region}@${severity}/10`,
  };
}

/**
 * Build a fatigue constraint. Global, no region. Severity drives
 * how aggressively we cull hard exposures across the week.
 */
export function buildFatigueConstraint(args: {
  id?: string;
  severity: number;
  startDate?: string;
}): Constraint {
  const severity = args.severity;
  const tier = severityToTier(severity);
  const blocked: Exposure[] = [];
  const limited: Exposure[] = [];
  if (tier === 'severe') {
    blocked.push(
      'sprint', 'high_speed_running', 'plyometric', 'explosive_lower',
      'explosive_push', 'heavy_lower_strength', 'max_effort_strength',
      'hard_erg', 'change_of_direction',
    );
    limited.push('high_volume_accessory', 'heavy_squat', 'heavy_hinge', 'heavy_pull');
  } else if (tier === 'moderate') {
    blocked.push('max_effort_strength');
    limited.push(
      'sprint', 'plyometric', 'heavy_lower_strength', 'heavy_squat',
      'heavy_hinge', 'hard_erg', 'high_volume_accessory',
    );
  } else {
    limited.push('max_effort_strength', 'hard_erg');
  }
  return {
    id: args.id ?? `fatigue-${Date.now()}`,
    type: 'fatigue',
    region: 'global',
    severity,
    status: 'active',
    startDate: args.startDate ?? new Date().toISOString(),
    blockedExposures: blocked,
    limitedExposures: limited,
    allowedExposures: ['mobility', 'recovery', 'easy_erg', 'low_load_accessory', 'trunk'],
    safeFocus: ['Easy conditioning', 'Recovery + mobility', 'Light technique work'],
    advice: [],
    label: `fatigue@${severity}/10`,
  };
}

/**
 * Build a soreness constraint. Like an injury but milder — limited,
 * not blocked. Region required.
 */
export function buildSorenessConstraint(args: {
  id?: string;
  region: ConstraintRegion;
  severity: number;
  startDate?: string;
}): Constraint {
  // Soreness is one tier lower than the equivalent injury.
  const downscaled = Math.max(1, args.severity - 2);
  const sets = regionToBlockedRegional(args.region, downscaled);
  return {
    id: args.id ?? `soreness-${args.region}-${Date.now()}`,
    type: 'soreness',
    region: args.region,
    severity: args.severity,
    status: 'active',
    startDate: args.startDate ?? new Date().toISOString(),
    blockedExposures: sets.blocked,
    limitedExposures: sets.limited,
    allowedExposures: sets.allowed,
    safeFocus: sets.safeFocus,
    advice: [],
    label: `soreness:${args.region}@${args.severity}/10`,
  };
}

/**
 * Build a busy-week / schedule constraint. Treated like a milder
 * fatigue — drops max-effort + heavy-strength exposures so the athlete
 * can still get useful sessions in without the high-cost ones.
 */
export function buildScheduleConstraint(args: {
  id?: string;
  severity: number;
  startDate?: string;
}): Constraint {
  const severity = args.severity;
  const tier = severityToTier(severity);
  const blocked: Exposure[] = [];
  const limited: Exposure[] = [];
  if (tier === 'severe') {
    blocked.push('max_effort_strength', 'hard_erg', 'high_volume_accessory');
    limited.push('heavy_squat', 'heavy_hinge', 'heavy_lower_strength', 'plyometric', 'sprint');
  } else if (tier === 'moderate') {
    blocked.push('max_effort_strength');
    limited.push('hard_erg', 'high_volume_accessory', 'heavy_lower_strength');
  } else {
    limited.push('max_effort_strength', 'high_volume_accessory');
  }
  return {
    id: args.id ?? `schedule-${Date.now()}`,
    type: 'schedule',
    region: 'global',
    severity,
    status: 'active',
    startDate: args.startDate ?? new Date().toISOString(),
    blockedExposures: blocked,
    limitedExposures: limited,
    allowedExposures: ['mobility', 'recovery', 'easy_erg', 'low_load_accessory', 'trunk'],
    safeFocus: ['Short, targeted sessions', 'Skill / technique work', 'Recovery + mobility'],
    advice: [],
    label: `schedule@${severity}/10`,
  };
}

/**
 * Build a missed-session constraint. Informational — no exposure
 * mutations. Surfaces the missed session as a Coach Update card and
 * lets the athlete know it was acknowledged.
 */
export function buildMissedSessionConstraint(args: {
  id?: string;
  missedDate?: string;
  sessionName?: string;
  startDate?: string;
}): Constraint {
  return {
    id: args.id ?? `missed-${args.missedDate ?? Date.now()}`,
    type: 'missed_session',
    region: 'global',
    severity: 0,
    status: 'active',
    startDate: args.startDate ?? new Date().toISOString(),
    blockedExposures: [],
    limitedExposures: [],
    allowedExposures: [],
    safeFocus: [
      'Pick up where the schedule left off',
      'Skip make-up sessions if they bunch hard days',
    ],
    advice: [],
    label: `missed${args.sessionName ? `:${args.sessionName}` : ''}@${args.missedDate ?? 'unknown'}`,
  };
}

// ─── Per-exercise scoring ───────────────────────────────────────────

/**
 * Score an exercise against a list of active constraints.
 *
 *   if any constraint blocks an exposure the exercise has → REMOVE
 *   else if any constraint LIMITS an exposure:
 *     - severity ≥ 7 (severe) → REMOVE
 *     - else                  → LIMIT
 *   else → KEEP
 *
 * Multiple constraints — most conservative wins.
 */
export function scoreExerciseAgainstConstraints(
  exerciseName: string,
  constraints: Constraint[],
): ExerciseDecision {
  const exposures = classifyExerciseExposures(exerciseName);
  if (exposures.length === 0 || constraints.length === 0) {
    return {
      decision: 'keep',
      matchedExposures: exposures,
      triggeringExposures: [],
      triggeringConstraintIds: [],
      reason: exposures.length === 0
        ? 'no recognised exposure (default keep)'
        : 'no active constraints',
    };
  }

  const blockHits: Array<{ exposure: Exposure; constraintId: string }> = [];
  const limitHits: Array<{ exposure: Exposure; constraintId: string; severity: number }> = [];

  for (const c of constraints) {
    if (c.status === 'resolved') continue;
    for (const e of exposures) {
      if (c.blockedExposures.includes(e)) {
        blockHits.push({ exposure: e, constraintId: c.id });
      } else if (c.limitedExposures.includes(e)) {
        limitHits.push({ exposure: e, constraintId: c.id, severity: c.severity ?? 5 });
      }
    }
  }

  if (blockHits.length > 0) {
    const exps = Array.from(new Set(blockHits.map((h) => h.exposure)));
    const ids = Array.from(new Set(blockHits.map((h) => h.constraintId)));
    return {
      decision: 'remove',
      matchedExposures: exposures,
      triggeringExposures: exps,
      triggeringConstraintIds: ids,
      reason: `blocked: ${exps.join(', ')}`,
    };
  }
  if (limitHits.length > 0) {
    const exps = Array.from(new Set(limitHits.map((h) => h.exposure)));
    const ids = Array.from(new Set(limitHits.map((h) => h.constraintId)));
    const maxSeverity = Math.max(...limitHits.map((h) => h.severity));
    if (maxSeverity >= 7) {
      return {
        decision: 'remove',
        matchedExposures: exposures,
        triggeringExposures: exps,
        triggeringConstraintIds: ids,
        reason: `limited+severe: ${exps.join(', ')}`,
      };
    }
    return {
      decision: 'limit',
      matchedExposures: exposures,
      triggeringExposures: exps,
      triggeringConstraintIds: ids,
      reason: `limit: ${exps.join(', ')}`,
    };
  }

  return {
    decision: 'keep',
    matchedExposures: exposures,
    triggeringExposures: [],
    triggeringConstraintIds: [],
    reason: 'no constraint hits',
  };
}

// ─── Session-level classification + apply ───────────────────────────

function isRecovery(workout: Workout): boolean {
  const wt = (workout as any).workoutType;
  if (wt === 'Recovery') return true;
  if ((workout as any).sessionTier === 'recovery') return true;
  return /\brecovery\b/i.test(workout.name || '');
}
function isGame(workout: Workout): boolean {
  return (workout as any).workoutType === 'Game';
}

export function classifySessionAgainstConstraints(
  workout: Workout,
  constraints: Constraint[],
): SessionClassification {
  const decisions: Array<{ name: string } & ExerciseDecision> = [];
  const removedNames: string[] = [];
  const limitedNames: string[] = [];
  const keptNames: string[] = [];

  for (const ex of workout.exercises ?? []) {
    const name = (ex as any).exercise?.name ?? '';
    if (!name) continue;
    const decision = scoreExerciseAgainstConstraints(name, constraints);
    decisions.push({ name, ...decision });
    if (decision.decision === 'remove') removedNames.push(name);
    else if (decision.decision === 'limit') limitedNames.push(name);
    else keptNames.push(name);
  }

  const totalScored = decisions.length;
  let impact: SessionImpact = 'none';
  if (removedNames.length === 0 && limitedNames.length === 0) impact = 'none';
  else if (totalScored > 0 && removedNames.length / totalScored >= 0.5) impact = 'high';
  else if (removedNames.length >= 2) impact = 'moderate';
  else impact = 'low';

  let action: SessionAction = 'unchanged';
  if (impact === 'none') action = 'unchanged';
  else if (totalScored > 0 && removedNames.length / totalScored >= 0.75) {
    action = constraints.some((c) => c.type === 'injury' && (c.severity ?? 0) >= 7)
      ? 'recovery'
      : 'rebuild';
  } else if (impact === 'high') action = 'rebuild';
  else action = 'modify';

  return { impact, action, exerciseDecisions: decisions, removedNames, limitedNames, keptNames };
}

export function applyConstraintsToSession(
  workout: Workout,
  constraints: Constraint[],
): ApplyConstraintsResult {
  if (isRecovery(workout) || isGame(workout)) {
    const kept = (workout.exercises ?? []).map((e: any) => e.exercise?.name ?? '').filter(Boolean);
    return {
      workout,
      classification: {
        impact: 'none',
        action: 'unchanged',
        exerciseDecisions: [],
        removedNames: [],
        limitedNames: [],
        keptNames: kept,
      },
      applied: false,
    };
  }
  const active = constraints.filter((c) => c.status !== 'resolved');
  if (active.length === 0) {
    return {
      workout,
      classification: {
        impact: 'none', action: 'unchanged', exerciseDecisions: [],
        removedNames: [], limitedNames: [],
        keptNames: (workout.exercises ?? []).map((e: any) => e.exercise?.name ?? '').filter(Boolean),
      },
      applied: false,
    };
  }
  const classification = classifySessionAgainstConstraints(workout, active);
  for (const d of classification.exerciseDecisions) {
    logger.debug('[exposure] exercise_decision', {
      exercise: d.name,
      exposures: d.matchedExposures,
      decision: d.decision,
      triggeringExposures: d.triggeringExposures,
      triggeringConstraintIds: d.triggeringConstraintIds,
      reason: d.reason,
    });
  }

  const removedSet = new Set(classification.removedNames);
  const newExercises: WorkoutExercise[] = (workout.exercises ?? []).filter(
    (ex: any) => !removedSet.has(ex.exercise?.name ?? ''),
  );

  const coachNotes = workout.coachNotes ? [...workout.coachNotes] : [];
  for (const name of classification.removedNames) {
    const note = `Removed: ${name}`;
    if (!coachNotes.includes(note)) coachNotes.push(note);
  }
  for (const name of classification.limitedNames) {
    const note = `Caution: ${name}`;
    if (!coachNotes.includes(note)) coachNotes.push(note);
  }
  // Attach safeFocus + advice from constraints (deduped).
  for (const c of active) {
    for (const f of c.safeFocus) {
      const note = `Focus: ${f}`;
      if (!coachNotes.includes(note)) coachNotes.push(note);
    }
    for (const a of c.advice ?? []) {
      if (!coachNotes.includes(a)) coachNotes.push(a);
    }
  }

  logger.debug('[exposure] session_decision', {
    workoutName: workout.name,
    impact: classification.impact,
    action: classification.action,
    constraints: active.map((c) => c.label || c.id),
    removed: classification.removedNames,
    limited: classification.limitedNames,
    kept: classification.keptNames,
  });

  return {
    workout: { ...workout, exercises: newExercises, coachNotes },
    classification,
    applied: classification.removedNames.length > 0 || classification.limitedNames.length > 0,
  };
}

// ─── Final program validation ───────────────────────────────────────

export function validateVisibleProgramAgainstConstraints(
  visibleWeek: Array<{ date?: string; workout: Workout | null }>,
  constraints: Constraint[],
): ProgramValidationResult {
  const violations: ProgramViolation[] = [];
  const active = constraints.filter((c) => c.status !== 'resolved');
  if (active.length === 0) return { passed: true, violations: [] };

  for (const day of visibleWeek) {
    const w = day.workout;
    if (!w) continue;
    if (isRecovery(w) || isGame(w)) continue;
    for (const ex of w.exercises ?? []) {
      const name = (ex as any).exercise?.name ?? '';
      if (!name) continue;
      const decision = scoreExerciseAgainstConstraints(name, active);
      if (decision.decision === 'remove') {
        violations.push({
          date: day.date,
          workoutName: w.name,
          exercise: name,
          exposures: decision.matchedExposures,
          triggeringExposures: decision.triggeringExposures,
          constraintIds: decision.triggeringConstraintIds,
        });
      }
    }
  }
  const passed = violations.length === 0;
  logger.debug('[exposure] final_validation', {
    weekDays: visibleWeek.length,
    constraintIds: active.map((c) => c.id),
    passed,
    violationCount: violations.length,
    violations: violations.map((v) => ({ date: v.date ?? null, exercise: v.exercise })),
  });
  return { passed, violations };
}

// ─── Single-day validator (convenience) ─────────────────────────────

export function validateWorkoutAgainstConstraints(
  workout: Workout | null,
  constraints: Constraint[],
  meta: { date?: string } = {},
): ProgramValidationResult {
  if (!workout) return { passed: true, violations: [] };
  return validateVisibleProgramAgainstConstraints(
    [{ date: meta.date, workout }],
    constraints,
  );
}
