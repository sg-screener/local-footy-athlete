/**
 * sessionTaxonomy.ts — canonical Programming Bible session taxonomy.
 *
 * Phase 1 rules kernel (READ-ONLY). This module classifies existing
 * program structures into the Bible's session categories. It never
 * mutates workouts, never gates writes, and never changes scheduling.
 *
 * Bible source: Programming Rules v1, Section 4 (Session types) and
 * Section 17.A (definitions). Categories map 1:1 to the Bible's session
 * types, plus 'tempo_conditioning' (Section 6's middle bucket, which the
 * app already models via conditioningFlavour: 'tempo').
 *
 * Design rules:
 *   T1. A calendar day can contain MULTIPLE session units (Section 17.A:
 *       "Tuesday upper strength + team training = 1 hard day, 2 exposures").
 *       Classification therefore returns SessionUnit[], not one category.
 *   T2. Reuse existing single-source-of-truth helpers instead of new
 *       regexes: sessionNaming (movement patterns / canonical strength
 *       labels), teamTraining (team-day detection), exposureEngine
 *       (exercise-name → exposure classification for modality).
 *   T3. Unknown content classifies as 'other' — never guess a hard
 *       category for something we don't understand.
 */

import type { Workout } from '../types/domain';
import {
  inferMovementPatterns,
  canonicalStrengthLabel,
  hasConditioningText,
  hasExplicitStrengthText,
} from '../utils/sessionNaming';
import { isTeamTrainingSession } from '../utils/teamTraining';
import { classifyExerciseExposures } from '../utils/exposureEngine';

// ─── Taxonomy ────────────────────────────────────────────────────────

export type SessionCategory =
  // Strength (main sessions — count toward the 4/week strength cap)
  | 'lower_strength'
  | 'upper_strength'
  | 'full_body_strength'
  // Low-fatigue accessory work (does NOT count as a main strength session)
  | 'gunshow_prehab'
  // Recovery / rest
  | 'recovery'
  | 'rest'
  // Conditioning buckets (Section 6)
  | 'aerobic_base'
  | 'tempo_conditioning'
  | 'hard_conditioning'
  // Speed (Section 7 — quality work, not conditioning)
  | 'sprint'
  // Anchors (Section 17.E — never recovery)
  | 'team_training'
  | 'game'
  // Anything we can't confidently classify
  | 'other';

/** On-feet vs off-feet matters for the Bible's running-exposure cap. */
export type SessionModality = 'running' | 'off_feet' | 'mixed' | 'none';

export interface SessionUnit {
  category: SessionCategory;
  modality: SessionModality;
  /** Human-readable classification trail for debug output. */
  reason: string;
}

// ─── Category helpers ────────────────────────────────────────────────

export const MAIN_STRENGTH_CATEGORIES: ReadonlySet<SessionCategory> = new Set([
  'lower_strength',
  'upper_strength',
  'full_body_strength',
]);

export const CONDITIONING_CATEGORIES: ReadonlySet<SessionCategory> = new Set([
  'aerobic_base',
  'tempo_conditioning',
  'hard_conditioning',
]);

// ─── Internal detection helpers ──────────────────────────────────────

const GUNSHOW_RX = /gunshow|gun show|prehab|accessor|arm pump|pump session/i;
const ACCESSORY_SUPPORT_NAME_RX = /gunshow|gun show|prehab|accessor|arm pump|pump session|trunk|hypertrophy/i;
const RECOVERY_RX = /\brecovery\b|mobility|foam roll|stretch|breathing/i;

/** Exposure kinds that prove a session actually contains strength work. */
const STRENGTH_EXPOSURES = new Set([
  'squat', 'hinge', 'lunge', 'heavy_lower_strength',
  'horizontal_press', 'vertical_press',
  'horizontal_pull', 'vertical_pull', 'heavy_pull',
]);

const MAIN_LIFT_EXERCISE_RX =
  /\b(?:back|front|box|goblet)\s+squat\b|\bsquat\b|\bdeadlift\b|\brdl\b|romanian\s+deadlift|hip\s+thrust|split\s+squat|\blunge\b|leg\s+press|bench\s+press|overhead\s+press|\bohp\b|military\s+press|\bdips?\b|push[-\s]?ups?|pull[-\s]?ups?|chin[-\s]?ups?|barbell\s+row|bent[-\s]*over\s+row|pendlay|t[-\s]*bar\s+row/i;

/** WorkoutType values that are unambiguous conditioning sub-types. */
const WORKOUT_TYPE_CONDITIONING: Record<string, SessionCategory> = {
  'Sprint-Intervals': 'sprint',
  'Quality-Sprints': 'sprint',
  'Hill-Sprints': 'sprint',
  'MetCon': 'hard_conditioning',
  'Nordic-4x4': 'hard_conditioning',
  '6x1km': 'hard_conditioning',
  'MAS-Training': 'hard_conditioning',
  'Flog-Friday': 'hard_conditioning',
  'Tempo-Run': 'tempo_conditioning',
  'Long-Run': 'aerobic_base',
  'Flush-Out': 'aerobic_base',
};

/** WorkoutType values that imply an on-feet (running) modality. */
const RUNNING_WORKOUT_TYPES = new Set([
  'Sprint-Intervals', 'Quality-Sprints', 'Hill-Sprints',
  '6x1km', 'MAS-Training', 'Tempo-Run', 'Long-Run',
]);

function textOf(workout: Workout): string {
  return `${workout.name ?? ''} ${workout.description ?? ''}`;
}

function conditioningCategoryFromFields(workout: Workout): SessionCategory | null {
  // 1. Explicit energy-system category (set by the coaching engine).
  switch (workout.conditioningCategory) {
    case 'sprint': return 'sprint';
    case 'vo2':
    case 'glycolytic': return 'hard_conditioning';
    // 4B: TRUE tempo — the kernel's medium-stress conditioning bucket.
    case 'tempo': return 'tempo_conditioning';
    case 'aerobic_base': return 'aerobic_base';
    default: break;
  }
  // 2. Resolved conditioning block intent / flavour.
  const intent = workout.conditioningBlock?.intent ?? workout.conditioningFlavour;
  switch (intent) {
    case 'high-intensity': return 'hard_conditioning';
    case 'tempo': return 'tempo_conditioning';
    case 'aerobic': return 'aerobic_base';
    default: return null;
  }
}

/**
 * Modality of a conditioning/sprint unit — reuses the exposure engine's
 * exercise-name classifier so running detection has ONE home.
 */
function detectModality(workout: Workout, fallbackCategory: SessionCategory): SessionModality {
  let sawRunning = false;
  let sawErg = false;

  for (const ex of workout.exercises ?? []) {
    const name = (ex as { exercise?: { name?: string } }).exercise?.name ?? '';
    if (!name) continue;
    const exposures = classifyExerciseExposures(name);
    if (exposures.includes('running') || exposures.includes('sprint') || exposures.includes('high_speed_running')) {
      sawRunning = true;
    }
    if (exposures.includes('easy_erg') || exposures.includes('hard_erg')) {
      // Erg exposures also fire for interval RUNS ("interval|fartlek|repeat"
      // adds hard_erg) — only treat as off-feet when running didn't fire.
      sawErg = true;
    }
  }

  if (sawRunning) return sawErg ? 'mixed' : 'running';
  if (sawErg) return 'off_feet';

  // No exercise signal — fall back to workoutType / name hints.
  const wt = String(workout.workoutType ?? '');
  if (RUNNING_WORKOUT_TYPES.has(wt)) return 'running';
  const text = textOf(workout).toLowerCase();
  if (/\brun\b|running|sprint(?!.*\b(bike|row|ski|erg)\b)|shuttle|fartlek|\bkm\b/.test(text)) {
    if (/\b(bike|row|rower|ski|erg|assault|swim)\b/.test(text)) return 'off_feet';
    return 'running';
  }
  if (/\b(bike|row|rower|ski|erg|assault|swim|circuit)\b/.test(text)) return 'off_feet';
  if (fallbackCategory === 'sprint') return 'running';
  return 'none';
}

function hasMainStrengthNameProof(text: string): boolean {
  return !!canonicalStrengthLabel(inferMovementPatterns(text)) ||
    /\bstrength\b|squat|hinge|hip[- ]?dominant|quad[- ]?dominant|push emphasis|pull emphasis|\bbench\b|overhead press|\bohp\b|\bdips?\b|push[- ]?up|deadlift|\brdl\b|\blunge\b|leg press|pull[- ]?up|chin[- ]?up/i.test(text);
}

function strengthCategoryFrom(
  text: string,
  opts: { allowRegionNameFallback?: boolean } = {},
): SessionCategory | null {
  const label = canonicalStrengthLabel(inferMovementPatterns(text));
  if (label) {
    if (label.startsWith('Lower')) return 'lower_strength';
    if (label.startsWith('Upper')) return 'upper_strength';
    return 'full_body_strength';
  }
  const allowRegionNameFallback = opts.allowRegionNameFallback ?? true;
  if (!allowRegionNameFallback) return null;
  // Canonical REGION names carry no pattern tokens ("Lower Body Strength"
  // is the canonical squat+hinge label but contains neither word) — the
  // probes alone would drop the strength unit entirely (found 2026-07-08
  // on locally generated programs).
  if (/\blower[- ]body\b/i.test(text)) return 'lower_strength';
  if (/\bupper[- ]body\b/i.test(text)) return 'upper_strength';
  return null;
}

/**
 * Last-resort strength category from the EXERCISES themselves — covers
 * workouts whose name/description are lossy or empty but whose content is
 * plainly strength work. Reuses the exposure classifier (one home for
 * exercise-name knowledge).
 */
function strengthCategoryFromExercises(workout: Workout): SessionCategory | null {
  let lower = false;
  let upper = false;
  for (const ex of workout.exercises ?? []) {
    const name = (ex as { exercise?: { name?: string } }).exercise?.name ?? '';
    if (!name) continue;
    const exp = classifyExerciseExposures(name);
    if (exp.includes('squat') || exp.includes('hinge') || exp.includes('lunge')) lower = true;
    if (exp.includes('horizontal_press') || exp.includes('vertical_press') ||
        exp.includes('horizontal_pull') || exp.includes('vertical_pull')) upper = true;
  }
  if (lower && upper) return 'full_body_strength';
  if (lower) return 'lower_strength';
  if (upper) return 'upper_strength';
  return null;
}

function hasMainLiftExercises(workout: Workout): boolean {
  return (workout.exercises ?? []).some((ex) => {
    const name = (ex as { exercise?: { name?: string } }).exercise?.name ?? '';
    return MAIN_LIFT_EXERCISE_RX.test(name);
  });
}

// ─── Public classifier ───────────────────────────────────────────────

/**
 * Classify one resolved calendar day's workout into Bible session units.
 *
 *   null workout          → []               (rest day — nothing to count)
 *   Game                  → [game]
 *   Team Training         → [team_training]  (+ strength / conditioning
 *                            units when the day is a combined team day)
 *   Strength + flush day  → [lower_strength, aerobic_base]
 *
 * The resolver's rest days come through as `workout === null`; explicit
 * "Rest" stubs classify as 'rest'.
 */
export function classifyDaySessions(workout: Workout | null | undefined): SessionUnit[] {
  if (!workout) return [];

  const units: SessionUnit[] = [];
  const text = textOf(workout);
  const wt = String(workout.workoutType ?? '');

  // ── Game (anchor — nothing else programmed on the day) ──
  if (wt === 'Game' || /^game\b/i.test(workout.name ?? '')) {
    return [{ category: 'game', modality: 'running', reason: `workoutType/name = Game` }];
  }

  // ── Explicit rest stub ──
  if (/^rest\b/i.test(workout.name ?? '') && (workout.exercises ?? []).length === 0) {
    return [{ category: 'rest', modality: 'none', reason: 'explicit rest stub' }];
  }

  // ── Team training (Section 17.E: never recovery; counts as running,
  //    sprint/COD and conditioning exposure) ──
  // Defensive hardening (2026-07-08): a name STARTING with "team training"
  // is a team session even when the explicit isTeamDay flag is missing or
  // the name was truncated by a lossy source ("Team training - field
  // session (sprint + …"). Without this, such days fall through to the
  // conditioning name fallback and misclassify as sprint — proven false
  // positive in the QA sweep (S13/S14). Rules-layer only; live
  // teamTraining.ts behaviour is untouched.
  const isTeamDay =
    isTeamTrainingSession(workout as never) ||
    /^\s*team training\b/i.test(workout.name ?? '');
  if (isTeamDay) {
    units.push({ category: 'team_training', modality: 'running', reason: 'team-day detection (teamTraining.ts / name prefix)' });
  }

  // ── Recovery (only when the WHOLE session is recovery-tier) ──
  const looksRecovery =
    wt === 'Recovery' || workout.sessionTier === 'recovery' || RECOVERY_RX.test(workout.name ?? '');
  if (!isTeamDay && looksRecovery) {
    // Easy erg/run "recovery" sessions (Easy Bike, Flush Run…) are the
    // Bible's easy-aerobic/flush bucket — classify as aerobic_base so
    // conditioning counting sees them; stress classification keeps them low.
    const modality = detectModality(workout, 'aerobic_base');
    if (modality !== 'none' && !RECOVERY_RX.test(workout.name ?? '')) {
      units.push({ category: 'aerobic_base', modality, reason: `recovery-tier easy conditioning (${workout.name})` });
    } else {
      units.push({ category: 'recovery', modality: 'none', reason: `recovery tier/type (${wt || workout.sessionTier})` });
    }
    return units;
  }

  // ── Strength unit (may coexist with team training / conditioning) ──
  // Guard: text-based pattern inference only counts as strength when either
  //   (a) the exercises prove strength content, or
  //   (b) the NAME is not a conditioning session name. This stops
  //   "easy bike/row" style conditioning text false-matching the pull probe.
  const hasStrengthExercises = (workout.exercises ?? []).some((ex) => {
    const exName = (ex as { exercise?: { name?: string } }).exercise?.name ?? '';
    return exName ? classifyExerciseExposures(exName).some((e) => STRENGTH_EXPOSURES.has(e)) : false;
  });
  const hasMainLiftExerciseProof = hasMainLiftExercises(workout);
  const nameIsConditioning =
    hasConditioningText(workout.name ?? '') &&
    !hasExplicitStrengthText(text);
  // Gunshow-named sessions ("Gunshow", "Prehab & Accessories") infer
  // strength from the NAME only — their descriptions legitimately mention
  // pattern words (face pulls, calves) without being strength sessions.
  const workoutName = workout.name ?? '';
  const nameLooksAccessorySupport =
    ACCESSORY_SUPPORT_NAME_RX.test(workoutName) &&
    !hasMainStrengthNameProof(workoutName);
  const nameLooksGunshow = GUNSHOW_RX.test(workoutName) || nameLooksAccessorySupport;
  const hasStrengthProofForSession = nameLooksGunshow
    ? hasMainLiftExerciseProof
    : hasStrengthExercises;
  const strengthSourceText = nameLooksGunshow && !hasMainLiftExerciseProof
    ? workoutName
    : text;
  const strengthCat =
    strengthCategoryFrom(strengthSourceText, {
      allowRegionNameFallback: !nameLooksGunshow || hasMainLiftExerciseProof,
    }) ??
    // Text yielded nothing — fall back to what the session actually
    // contains (exercise exposures). Accessory-named sessions only take
    // this fallback when exercises prove real main-lift content; light
    // curls/pushdowns/face pulls remain gunshow/prehab.
    (hasStrengthProofForSession ? strengthCategoryFromExercises(workout) : null);
  const isStrengthSession =
    strengthCat &&
    (wt === 'Strength' || wt === 'Mixed' || wt === 'Team Training' || isTeamDay) &&
    (hasStrengthProofForSession || !nameIsConditioning);
  if (isStrengthSession) {
    units.push({ category: strengthCat!, modality: 'none', reason: `movement patterns → ${strengthCat}` });
  }

  // ── Gunshow / prehab — only when the session is NOT a main strength
  //    session. Checked AFTER strength inference: a lower/upper focus that
  //    merely MENTIONS accessories ("…optional quad accessory: leg
  //    extension") must stay a strength session (bug found 2026-07-08:
  //    the substring 'accessor' was reclassifying real lower days as
  //    gunshow, hiding both the strength unit and the combined finisher). ──
  if (!isStrengthSession && !isTeamDay && nameLooksGunshow) {
    units.push({ category: 'gunshow_prehab', modality: 'none', reason: `name matches gunshow/prehab (${workout.name})` });
    // No early return: a gunshow day may still carry a combined easy
    // conditioning finisher (Bible pairing: gunshow + easy flush).
  }

  // ── Conditioning unit(s) ──
  let condCat: SessionCategory | null = null;
  if (WORKOUT_TYPE_CONDITIONING[wt]) {
    condCat = WORKOUT_TYPE_CONDITIONING[wt];
    // Flush-Out is the Bible's low-stress flush — keep aerobic_base.
  } else if (wt === 'Conditioning' || workout.hasCombinedConditioning || workout.conditioningBlock) {
    condCat = conditioningCategoryFromFields(workout);
    if (!condCat && wt === 'Conditioning') {
      // Bare 'Conditioning' with no flavour metadata: use intensity.
      condCat = workout.intensity === 'Maximal' || workout.intensity === 'High'
        ? 'hard_conditioning'
        : 'aerobic_base';
    }
  }
  if (condCat) {
    units.push({
      category: condCat,
      modality: detectModality(workout, condCat),
      reason: `conditioning via ${WORKOUT_TYPE_CONDITIONING[wt] ? `workoutType ${wt}` : (workout.conditioningCategory ?? workout.conditioningBlock?.intent ?? workout.conditioningFlavour ?? 'intensity fallback')}`,
    });
  }

  // ── Name-based conditioning fallback ──
  // Allocation-level sessions sometimes reach the calendar with a generic
  // workoutType ('Strength') but a clearly-conditioning name ("Easy Aerobic
  // Flush - 20-30min easy bike/row"). Classify by name before giving up.
  if (units.length === 0 && hasConditioningText(workout.name ?? '')) {
    const nameText = (workout.name ?? '').toLowerCase();
    let fallbackCat: SessionCategory;
    if (/\bsprints?\b/.test(nameText)) fallbackCat = 'sprint';
    else if (/metcon|interval|\bmas\b|vo2|glycolytic|repeat|hard/.test(nameText)) fallbackCat = 'hard_conditioning';
    else if (/tempo/.test(nameText)) fallbackCat = 'tempo_conditioning';
    else fallbackCat = 'aerobic_base';
    units.push({
      category: fallbackCat,
      modality: detectModality(workout, fallbackCat),
      reason: `conditioning name fallback (${workout.name})`,
    });
  }

  // ── Fallback ──
  if (units.length === 0) {
    units.push({ category: 'other', modality: detectModality(workout, 'other'), reason: `unclassified (workoutType=${wt || 'none'}, name=${workout.name})` });
  }

  return units;
}
