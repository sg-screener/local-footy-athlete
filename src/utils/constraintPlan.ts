/**
 * constraintPlan.ts — human-readable plan derived from the universal
 * exposure engine policies. ConstraintPlan is the SHARED layer the
 * Coach Update card, the chat reply composer, and the final validator
 * all read from. Same source of truth, same wording.
 *
 * Why this exists:
 *   The previous card listed every removed exercise verbatim ("Sprint
 *   removed", "RDL removed", "Box jump removed"). That's 12 lines of
 *   noise. What the athlete actually needs is:
 *
 *     Avoid: sprinting, plyos, heavy hinge
 *     Sub in: goblet squats, upper body, easy bike
 *     Keep:   trunk, mobility, recovery
 *     ↳ Update coach when it improves, worsens, or clears.
 *
 *   That four-line summary is the same regardless of how many exercises
 *   were removed under the hood, and it generalises across constraints.
 *
 * Pure: no I/O, no store reads. Caller passes activeConstraints (UI
 * shape) and the plan is derived deterministically from the engine
 * policy via `buildInjuryConstraint` / `buildFatigueConstraint`.
 *
 * Logs (runtime):
 *   [constraint-plan] built          { count, ids }
 *   [constraint-plan] card_summary   { id, avoidLines, keepLines }
 *   [constraint-plan] validation_passed / validation_failed
 */

import type {
  ActiveConstraint,
  ActiveInjuryConstraint,
  ActiveFatigueConstraint,
  ActiveSorenessConstraint,
  ActiveScheduleConstraint,
  ActiveMissedSessionConstraint,
} from '../store/coachUpdatesStore';
import { logger } from './logger';
import {
  buildInjuryConstraint,
  buildFatigueConstraint,
  buildSorenessConstraint,
  buildScheduleConstraint,
  buildMissedSessionConstraint,
  validateVisibleProgramAgainstConstraints,
  type Constraint,
  type ConstraintRegion,
  type Exposure,
  type ProgramValidationResult,
} from './exposureEngine';
import type { Workout } from '../types/domain';

// ─── ConstraintPlan type ────────────────────────────────────────────

export interface ConstraintPlan {
  /** Stable id — mirrors the underlying constraint id. */
  id: string;
  /** Constraint origin — "injury" | "fatigue" | etc. */
  type: ActiveConstraint['type'];
  /** "Hammy pain — 7/10" / "Shoulder pain — 8/10" / "Fatigue — 7/10". */
  activeIssue: string;
  /**
   * Short, deduped, human-readable labels for what to avoid this block.
   * Derived from blockedExposures (severity-aware) so the spec the
   * card shows matches what the engine actually enforces.
   *
   * Examples: "Sprinting / max-speed running", "Heavy hinge / nordics / RDLs",
   * "Pressing / overhead", "Plyometrics / jumping".
   */
  avoid: string[];
  /**
   * What to substitute with — short labels, region-aware.
   * Examples: "Quad-dominant lower (goblet squats, leg press)",
   * "Trunk", "Easy bike / rower if pain-free".
   */
  substituteWith: string[];
  /** What's safe to keep doing — kept in alignment with engine safeFocus. */
  keep: string[];
  /** Closing advice (physio nudges, etc). */
  advice: string[];
  /** "Update coach when it improves, worsens, or clears." */
  updatePrompt: string;
  /** The underlying engine Constraint — used by the plan validator. */
  constraint: Constraint;
}

// ─── Avoid-label vocabulary ─────────────────────────────────────────

/**
 * Map a single Exposure to a human-readable avoid label. Multiple
 * exposures may share a label (e.g. `sprint` and `high_speed_running`
 * both → "Sprinting / max-speed running") — dedup happens in the
 * caller.
 */
function exposureToAvoidLabel(e: Exposure): string | null {
  switch (e) {
    case 'sprint':
    case 'high_speed_running':
    case 'acceleration':
      return 'Sprinting / max-speed running';
    case 'running':
      return 'Running';
    case 'plyometric':
    case 'explosive_lower':
      return 'Plyometrics / jumping';
    case 'change_of_direction':
      return 'Cutting / agility';
    case 'heavy_hinge':
    case 'hamstring_dominant':
      return 'Heavy hinge / nordics / RDLs';
    case 'hinge':
      return 'Hinge patterns';
    case 'posterior_chain':
      return 'Posterior-chain work';
    case 'heavy_squat':
    case 'axial_loading':
    case 'heavy_lower_strength':
      return 'Heavy squatting / axial loading';
    case 'squat':
      return 'Squat patterns';
    case 'knee_dominant':
      return 'Knee-dominant loading';
    case 'lunge':
      return 'Lunging / single-leg loading';
    case 'hip_dominant':
      return 'Hip-dominant lower';
    case 'horizontal_press':
      return 'Bench / horizontal pressing';
    case 'vertical_press':
      return 'Overhead pressing';
    case 'overhead_loading':
      return 'Overhead loading';
    case 'explosive_push':
      return 'Explosive push (clap push-ups, push press)';
    case 'shoulder_isolation':
      return 'Shoulder isolation';
    case 'horizontal_pull':
      return 'Heavy rows';
    case 'vertical_pull':
      return 'Pull-ups / chin-ups';
    case 'heavy_pull':
      return 'Heavy rows / pull-ups';
    case 'grip_heavy':
      return 'Heavy grip work';
    case 'loaded_carry':
      return 'Loaded carries';
    case 'calf_achilles':
      return 'Loaded calf work';
    case 'adductor_groin':
      return 'Adductor work';
    case 'elbow_loading':
      return 'Heavy elbow loading';
    case 'wrist_loading':
      return 'Heavy wrist loading';
    case 'contact_risk':
      return 'Contact / wrestling drills';
    case 'max_effort_strength':
      return 'Max-effort strength';
    case 'hard_erg':
      return 'High-intensity conditioning';
    case 'high_volume_accessory':
      return 'High-volume accessory work';
    default:
      return null;
  }
}

function dedupeOrdered<T>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = JSON.stringify(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * Build a deduped, ordered list of avoid-labels from a constraint's
 * blocked + (severe-tier) limited exposures. We treat "limited at
 * severe severity (≥7)" as effectively avoid for the card, because
 * the engine already removes those exercises.
 */
function buildAvoidLabels(c: Constraint): string[] {
  const severity = c.severity ?? 0;
  const exposures = new Set<Exposure>(c.blockedExposures);
  if (severity >= 7) {
    for (const e of c.limitedExposures) exposures.add(e);
  }

  // Semantic merging — if "Sprinting / max-speed running" already
  // present, drop the broader "Running" so the avoid list reads
  // cleanly. Same for heavy-squat vs general squat.
  const labels: string[] = [];
  for (const e of exposures) {
    const label = exposureToAvoidLabel(e);
    if (label) labels.push(label);
  }
  const deduped = dedupeOrdered(labels);

  const has = (s: string) => deduped.includes(s);
  return deduped.filter((label) => {
    if (label === 'Running' && has('Sprinting / max-speed running')) return false;
    if (label === 'Squat patterns' && has('Heavy squatting / axial loading')) return false;
    if (label === 'Hinge patterns' && has('Heavy hinge / nordics / RDLs')) return false;
    if (label === 'Posterior-chain work' && has('Heavy hinge / nordics / RDLs')) return false;
    if (label === 'Hip-dominant lower' && has('Heavy hinge / nordics / RDLs')) return false;
    if (label === 'Knee-dominant loading' && has('Heavy squatting / axial loading')) return false;
    if (label === 'Heavy rows' && has('Heavy rows / pull-ups')) return false;
    if (label === 'Pull-ups / chin-ups' && has('Heavy rows / pull-ups')) return false;
    if (label === 'Overhead pressing' && has('Overhead loading')) return false;
    return true;
  });
}

// ─── SubstituteWith vocabulary ──────────────────────────────────────

/**
 * Region-aware "substitute with" suggestions. Short, athlete-facing,
 * and consistent with the safeFocus the engine already emits — but
 * worded as substitution prompts rather than focus areas.
 */
function buildSubstituteLabels(c: Constraint): string[] {
  if (c.type === 'fatigue') {
    return [
      'Easy aerobic conditioning (zone 1–2 bike or row)',
      'Mobility / recovery',
      'Light technique work',
    ];
  }
  if (c.type === 'schedule') {
    return [
      'Short, focused strength (compound + 1–2 accessories)',
      'Skill / technique work',
      'Easy aerobic conditioning if time allows',
    ];
  }
  if (c.type === 'missed_session') {
    return [
      'Pick up the next scheduled session as planned',
      'Skip make-up work if it bunches hard days',
    ];
  }
  const region = c.region as ConstraintRegion;
  switch (region) {
    case 'shoulder':
    case 'elbow':
    case 'wrist':
      return [
        'Lower body strength (squat / hinge / lunge)',
        'Trunk + anti-rotation',
        'Easy bike / rower / ski if pain-free',
        'Light accessories',
      ];
    case 'hamstring':
      return [
        'Quad-dominant lower (goblet squats, leg press, step-ups)',
        'Upper body strength',
        'Trunk',
        'Easy bike if pain-free',
      ];
    case 'knee':
    case 'quad':
      return [
        'Light hinge / hip-dominant work',
        'Upper body strength',
        'Trunk',
        'Easy bike if pain-free',
      ];
    case 'calf':
    case 'achilles':
      return [
        'Hip-dominant lower (RDLs, hip thrusts)',
        'Upper body strength',
        'Trunk',
        'Easy bike if pain-free',
      ];
    case 'groin':
      return [
        'Bilateral lower (light squat / hinge)',
        'Upper body strength',
        'Trunk',
        'Easy bike',
      ];
    case 'hip':
      return [
        'Light bilateral lower',
        'Upper body strength',
        'Trunk',
        'Easy bike',
      ];
    case 'ankle':
      return [
        'Bilateral lower (no jumping / cutting)',
        'Upper body strength',
        'Trunk',
        'Easy bike',
      ];
    case 'back':
      return [
        'Supported upper body (machine press / cable rows)',
        'Light unilateral lower without axial load',
        'Bike / walk / mobility',
      ];
    default:
      return ['Upper body', 'Trunk', 'Easy bike if pain-free'];
  }
}

// ─── Active-issue + advice ──────────────────────────────────────────

function capitalise(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function activeIssueLabel(c: ActiveConstraint): string {
  const labelled = (c as ActiveConstraint & { reasonLabel?: string }).reasonLabel;
  if (labelled && 'severity' in c) return `${labelled} — ${c.severity}/10`;
  if (c.type === 'injury') {
    const part = c.bodyPart === 'unknown' ? 'Injury' : capitalise(c.bodyPart);
    return `${part} pain — ${c.severity}/10`;
  }
  if (c.type === 'fatigue') {
    return `Fatigue — ${c.severity}/10`;
  }
  if (c.type === 'soreness') {
    const part = !c.bodyPart || c.bodyPart === 'unknown' ? 'Soreness' : `${capitalise(c.bodyPart)} soreness`;
    return `${part} — ${c.severity}/10`;
  }
  if (c.type === 'schedule') {
    return `Busy week — ${c.severity}/10`;
  }
  // missed_session
  const label = c.sessionName ? c.sessionName : 'session';
  return `Missed ${label}`;
}

const PHYSIO_HARD = 'Get this assessed by a physio so we know what you can safely reload.';
const PHYSIO_SOFT = "If it's not improving in a few days, worth getting a physio to look at it.";
const UPDATE_PROMPT = 'Update coach when it improves, worsens, or clears.';

function buildAdviceForInjury(c: ActiveInjuryConstraint): string[] {
  const out: string[] = [];
  if (c.severity >= 7) out.push(PHYSIO_HARD);
  else if (c.severity >= 4) out.push(PHYSIO_SOFT);
  // Carry through any extra advice from the active constraint store.
  for (const a of c.advice ?? []) {
    if (!out.includes(a)) out.push(a);
  }
  return out;
}

function buildAdviceForFatigue(c: ActiveFatigueConstraint): string[] {
  return [...(c.advice ?? [])];
}

function buildAdviceForSoreness(c: ActiveSorenessConstraint): string[] {
  const out: string[] = [];
  if (c.severity >= 7) out.push(PHYSIO_SOFT);
  for (const a of c.advice ?? []) {
    if (!out.includes(a)) out.push(a);
  }
  return out;
}

function buildAdviceForSchedule(c: ActiveScheduleConstraint): string[] {
  return [...(c.advice ?? [])];
}

function buildAdviceForMissedSession(c: ActiveMissedSessionConstraint): string[] {
  return [...(c.advice ?? [])];
}

// ─── Region resolution ──────────────────────────────────────────────

const BUCKET_TO_REGION: Record<string, ConstraintRegion> = {
  shoulder: 'shoulder',
  elbow: 'elbow',
  wrist: 'wrist',
  knee: 'knee',
  ankle: 'ankle',
  calf: 'calf',
  hamstring: 'hamstring',
  adductor: 'groin',
  pubalgia: 'groin',
  lowerBack: 'back',
};

function resolveRegion(bucket: string): ConstraintRegion {
  return BUCKET_TO_REGION[bucket] ?? 'global';
}

// ─── Plan builders ──────────────────────────────────────────────────

function buildPlanForInjury(c: ActiveInjuryConstraint): ConstraintPlan {
  const region = resolveRegion(c.bucket as string);
  // Reach into the engine for the canonical exposure policy. This is
  // the single source of truth — the card and the validator both read
  // it through the plan.
  const constraint: Constraint = buildInjuryConstraint({
    id: c.id,
    region,
    severity: c.severity,
    status: c.status === 'resolved' ? 'resolved' : c.status === 'improving' ? 'improving' : 'active',
    startDate: c.startDate,
  });
  return {
    id: c.id,
    type: 'injury',
    activeIssue: activeIssueLabel(c),
    avoid: buildAvoidLabels(constraint),
    substituteWith: buildSubstituteLabels(constraint),
    // Engine safeFocus is already worded as "what to keep doing" — pass
    // through verbatim so the spec stays in one place.
    keep: [...(constraint.safeFocus ?? [])],
    advice: buildAdviceForInjury(c),
    updatePrompt: UPDATE_PROMPT,
    constraint,
  };
}

function buildPlanForFatigue(c: ActiveFatigueConstraint): ConstraintPlan {
  const constraint: Constraint = buildFatigueConstraint({
    id: c.id,
    severity: c.severity,
    startDate: c.startDate,
  });
  return {
    id: c.id,
    type: 'fatigue',
    activeIssue: activeIssueLabel(c),
    avoid: buildAvoidLabels(constraint),
    substituteWith: buildSubstituteLabels(constraint),
    keep: [...(constraint.safeFocus ?? [])],
    advice: buildAdviceForFatigue(c),
    updatePrompt: UPDATE_PROMPT,
    constraint,
  };
}

function buildPlanForSoreness(c: ActiveSorenessConstraint): ConstraintPlan {
  const region = resolveRegion(c.bucket as string);
  const constraint: Constraint = buildSorenessConstraint({
    id: c.id,
    region,
    severity: c.severity,
    startDate: c.startDate,
  });
  return {
    id: c.id,
    type: 'soreness',
    activeIssue: activeIssueLabel(c),
    avoid: buildAvoidLabels(constraint),
    substituteWith: buildSubstituteLabels(constraint),
    keep: [...(constraint.safeFocus ?? [])],
    advice: buildAdviceForSoreness(c),
    updatePrompt: UPDATE_PROMPT,
    constraint,
  };
}

function buildPlanForBusyWeek(c: ActiveScheduleConstraint): ConstraintPlan {
  const constraint: Constraint = buildScheduleConstraint({
    id: c.id,
    severity: c.severity,
    startDate: c.startDate,
  });
  return {
    id: c.id,
    type: 'schedule',
    activeIssue: activeIssueLabel(c),
    avoid: buildAvoidLabels(constraint),
    substituteWith: buildSubstituteLabels(constraint),
    keep: [...(constraint.safeFocus ?? [])],
    advice: buildAdviceForSchedule(c),
    updatePrompt: UPDATE_PROMPT,
    constraint,
  };
}

function buildPlanForMissedSession(c: ActiveMissedSessionConstraint): ConstraintPlan {
  const constraint: Constraint = buildMissedSessionConstraint({
    id: c.id,
    missedDate: c.missedDate,
    sessionName: c.sessionName,
    startDate: c.startDate,
  });
  return {
    id: c.id,
    type: 'missed_session',
    activeIssue: activeIssueLabel(c),
    // Informational — empty exposure sets means avoid is naturally empty.
    avoid: buildAvoidLabels(constraint),
    substituteWith: buildSubstituteLabels(constraint),
    keep: [...(constraint.safeFocus ?? [])],
    advice: buildAdviceForMissedSession(c),
    updatePrompt: UPDATE_PROMPT,
    constraint,
  };
}

/**
 * Build a plan per active constraint. Resolved constraints are
 * skipped — they shouldn't drive a card or a reply.
 *
 * Multi-constraint: returns one plan per constraint. The composer
 * (card / reply) decides how to merge them for display.
 */
export function buildConstraintPlans(
  activeConstraints: ActiveConstraint[],
): ConstraintPlan[] {
  const plans: ConstraintPlan[] = [];
  for (const c of activeConstraints) {
    if (c.status === 'resolved') continue;
    if (c.type === 'injury') plans.push(buildPlanForInjury(c));
    else if (c.type === 'fatigue') plans.push(buildPlanForFatigue(c));
    else if (c.type === 'soreness') plans.push(buildPlanForSoreness(c));
    else if (c.type === 'schedule') plans.push(buildPlanForBusyWeek(c));
    else if (c.type === 'missed_session') plans.push(buildPlanForMissedSession(c));
  }
  if (typeof console !== 'undefined' && (globalThis as any).__DEV__ !== false) {
    // eslint-disable-next-line no-console
    logger.debug('[constraint-plan] built', {
      count: plans.length,
      ids: plans.map((p) => p.id),
    });
  }
  return plans;
}

// ─── Plan-driven validation ─────────────────────────────────────────

/**
 * Strong final validator — proves the visible week respects every
 * plan's avoid policy. Implementation delegates to the universal
 * exposure-engine validator (the engine `Constraint` is carried on
 * the plan), so plans + engine never drift.
 *
 * Returns the same `ProgramValidationResult` shape as the engine
 * validator.
 */
export function validateVisibleProgramAgainstConstraintPlans(
  visibleWeek: Array<{ date?: string; workout: Workout | null }>,
  plans: ConstraintPlan[],
): ProgramValidationResult {
  const constraints = plans.map((p) => p.constraint);
  const result = validateVisibleProgramAgainstConstraints(visibleWeek, constraints);
  if (typeof console !== 'undefined' && (globalThis as any).__DEV__ !== false) {
    if (result.passed) {
      // eslint-disable-next-line no-console
      logger.debug('[constraint-plan] validation_passed', {
        planIds: plans.map((p) => p.id),
        weekDays: visibleWeek.length,
      });
    } else {
      // eslint-disable-next-line no-console
      logger.debug('[constraint-plan] validation_failed', {
        planIds: plans.map((p) => p.id),
        violationCount: result.violations.length,
        violations: result.violations.map((v) => ({
          date: v.date ?? null,
          exercise: v.exercise,
        })),
      });
    }
  }
  return result;
}

// ─── Concise per-session note ───────────────────────────────────────

/**
 * Produce a short single-line coachNote for a session that's been
 * adjusted under one or more plans. The line names the active issues
 * and points at the avoid labels so the athlete sees exactly why this
 * session looks different.
 *
 *   "Adjusted for hammy 7/10 — no sprinting, plyos, or heavy hinge."
 *   "Adjusted for hammy + shoulder — no sprinting, plyos, or pressing."
 *
 * Returns null if no plans apply.
 */
export function buildSessionPlanNote(plans: ConstraintPlan[]): string | null {
  if (!plans.length) return null;

  const issueLabels = plans.map((p) => {
    if (p.type === 'injury') {
      // "Hammy pain — 7/10"  →  "hammy 7/10" (concise card-friendly)
      const m = p.activeIssue.match(/^(.*?) pain — (\d+)\/10$/);
      if (m) return `${m[1].toLowerCase()} ${m[2]}/10`;
      return p.activeIssue.toLowerCase();
    }
    if (p.type === 'soreness') {
      // "Quad soreness — 6/10"  →  "quad soreness 6/10"
      const m = p.activeIssue.match(/^(.*?) — (\d+)\/10$/);
      if (m) return `${m[1].toLowerCase()} ${m[2]}/10`;
      return p.activeIssue.toLowerCase();
    }
    return p.activeIssue.toLowerCase();
  });
  const issuesJoined = issueLabels.length === 1
    ? issueLabels[0]
    : issueLabels.join(' + ');

  // Combined, deduped avoid labels — top 3 only so the note stays short.
  const avoidCombined = dedupeOrdered(plans.flatMap((p) => p.avoid));
  const avoidShort = avoidCombined
    .slice(0, 3)
    .map((s) => s.split(' / ')[0].toLowerCase());

  if (avoidShort.length === 0) {
    return `Adjusted for ${issuesJoined} — update coach if symptoms improve.`;
  }
  const avoidJoined = avoidShort.length === 1
    ? avoidShort[0]
    : avoidShort.length === 2
      ? avoidShort.join(' or ')
      : `${avoidShort.slice(0, -1).join(', ')}, or ${avoidShort[avoidShort.length - 1]}`;
  return `Adjusted for ${issuesJoined} — no ${avoidJoined}.`;
}
