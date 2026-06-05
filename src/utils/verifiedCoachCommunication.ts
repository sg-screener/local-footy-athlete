/**
 * verifiedCoachCommunication.ts — TRUTH GATE between the coach engine
 * and everything the athlete sees.
 *
 * WHY THIS EXISTS
 * ───────────────
 *   The Coach Update card was claiming things it hadn't done. Real
 *   incident: an athlete typed "I'm cooked this week", the engine
 *   wrote a fatigue constraint, and the card rendered:
 *
 *     Sub in:
 *       • Easy aerobic conditioning (zone 1–2 bike or row)
 *       • Mobility / recovery
 *       • Light technique work
 *
 *   But the visible program had no zone 1–2 bike, no rower session,
 *   no actual easy-aerobic replacement, no visible load reduction.
 *   The card was lying — those bullets came from `plan.substituteWith`,
 *   which is GUIDANCE about what to do IF the athlete adds work, not a
 *   record of work the engine actually inserted.
 *
 *   This module separates three concepts that previously were mashed
 *   together:
 *
 *     1. APPLIED CHANGES — things that actually changed in the visible
 *        program (derived from the visible-week diff).
 *     2. ACTIVE GUIDANCE — restrictions the coach is enforcing
 *        regardless of whether a session moved (constraint.rules).
 *     3. OPTIONAL ADVICE — suggestions for the athlete IF they choose
 *        to add work (constraint.substituteWith / safe focus).
 *
 *   The card and the chat reply BOTH read from this verified object.
 *   Reply phrasing like "program updated" / "lighter loads" / "I
 *   adjusted" is gated on `canSayProgramUpdated`, which is true only
 *   when `appliedChanges.length > 0`.
 *
 * PURE
 * ────
 *   No I/O, no React, no store access. Caller passes the visible diff,
 *   the constraints, and any plan-derived guidance; this module
 *   composes the verified shape and runs the validator.
 *
 * LOGS
 * ────
 *   [truth-gate] communication_built       { applied, guidance, optional }
 *   [truth-gate] validation_passed
 *   [truth-gate] validation_failed         { violations: string[] }
 *   [truth-gate] downgraded_to_guidance_only
 */

import type { ConstraintPlan } from './constraintPlan';
import type {
  ActiveConstraint,
  ActiveInjuryConstraint,
  ActiveSorenessConstraint,
} from '../store/coachUpdatesStore';
import type { VisibleDiffEntry } from './visibleWorkoutDiff';
import { logger } from './logger';

// ─── Types ──────────────────────────────────────────────────────────

export type AppliedChangeKind =
  | 'session_replaced'
  | 'session_lightened'
  | 'exercise_removed'
  | 'exercise_replaced'
  | 'conditioning_changed'
  | 'volume_reduced'
  | 'coach_note_added';

export interface AppliedChange {
  /** ISO date the change applies to. */
  date: string;
  /** "Mon Lower Body Strength" — what the athlete sees as the day label. */
  sessionName: string;
  /** Coarse change kind — used by the card to pick a phrasing. */
  kind: AppliedChangeKind;
  /** Optional before label — "Trap Bar Deadlift". */
  before?: string;
  /** Optional after label — "Goblet Squat" / "removed". */
  after?: string;
  /** True when the change is rendered on a user-visible surface. */
  visible: boolean;
}

export interface VerifiedCoachCommunication {
  /** Verified — only items derived from the actual visible diff. */
  appliedChanges: AppliedChange[];
  /** Active rules the athlete must respect (avoid sprinting / no max effort / …). */
  activeGuidance: string[];
  /**
   * Suggestions the athlete CAN follow if they choose to add work
   * — never claimed as something the program now contains.
   */
  optionalAdvice: string[];
  /**
   * Optional honest "why nothing visible moved" line, e.g.
   *   "Nothing risky scheduled this week — flagging only."
   */
  unchangedReason?: string;
  /** True iff appliedChanges has at least one visible entry. */
  canSayProgramUpdated: boolean;
  /**
   * Subset of canSayProgramUpdated that is ALSO conservative about
   * "changed" — currently identical, but kept distinct so we can lower
   * the bar later (e.g. allow note-only changes to count as "changed"
   * but not as "updated").
   */
  canSayProgramChanged: boolean;
}

// ─── Severity-explicit detection ────────────────────────────────────

/**
 * True when the raw user message contains an explicit severity number
 * — "5/10", "5 / 10", "5 out of 10", "5 outta ten". The LLM intent
 * classifier may estimate severity from intensity language ("I'm
 * cooked"), but those estimates MUST NOT be displayed back to the
 * athlete as if they had stated a number themselves.
 *
 * This is a deterministic check the dispatcher runs against the raw
 * message — independent of the LLM payload.
 */
export function isSeverityExplicitInMessage(message: string): boolean {
  if (!message || typeof message !== 'string') return false;
  // "5/10", "5 / 10", "5 out of 10", "5 outta 10", "5 outta ten"
  const numericOutOfTen = /\b(?:10|[1-9])\s*(?:\/|out\s+of|outta)\s*(?:10|ten)\b/i;
  return numericOutOfTen.test(message);
}

// ─── Forbidden / allowed reply phrases ──────────────────────────────

/**
 * Phrases the reply must NOT contain when canSayProgramUpdated=false.
 * These all imply a structural mutation occurred. If the dispatcher
 * wants to use them, it has to actually mutate something visible.
 */
export const FORBIDDEN_WHEN_NO_APPLIED: readonly RegExp[] = [
  /\bprogram\s+updated\b/i,
  /\bI\s+changed\b/i,
  /\bI\s+reduced\b/i,
  /\blighter\s+loads?\b/i,
  /\bsubbed?\s+in\b/i,
  /\bcap(p|ping|ped)\s+the\s+hard\s+sessions?\b/i,
  /\badjusted\s+your\s+week\b/i,
  /\bI\s+adjusted\b/i,
  /\bI\s+removed\b/i,
  /\bI\s+swapped\b/i,
  /\bI\s+pulled\s+back\b/i,
  /\bI(?:'ve|\s+have)?\s+pulled\s+back\b/i,
  /\bpulled\s+back\b/i,
  /\bnow\s+adjusted\b/i,
] as const;

// ─── Build path: visible diff → AppliedChange[] ─────────────────────

function nameFromDiff(entry: VisibleDiffEntry): string {
  return entry.after.name ?? entry.before.name ?? 'session';
}

function classifyDiff(entry: VisibleDiffEntry): AppliedChange[] {
  const date = entry.date;
  const sessionName = nameFromDiff(entry);
  const out: AppliedChange[] = [];

  // Detect added / removed exercises.
  const beforeSet = new Set(entry.before.exerciseNames);
  const afterSet = new Set(entry.after.exerciseNames);
  const removed = entry.before.exerciseNames.filter((n) => !afterSet.has(n));
  const added = entry.after.exerciseNames.filter((n) => !beforeSet.has(n));

  // Pair removals + additions of the same count as replacements.
  const pairCount = Math.min(removed.length, added.length);
  for (let i = 0; i < pairCount; i++) {
    out.push({
      date,
      sessionName,
      kind: 'exercise_replaced',
      before: removed[i],
      after: added[i],
      visible: true,
    });
  }
  for (let i = pairCount; i < removed.length; i++) {
    out.push({
      date,
      sessionName,
      kind: 'exercise_removed',
      before: removed[i],
      visible: true,
    });
  }
  for (let i = pairCount; i < added.length; i++) {
    out.push({
      date,
      sessionName,
      kind: 'exercise_replaced',
      after: added[i],
      visible: true,
    });
  }

  // Session name itself changed (e.g. "Lower Body Strength" → "Recovery").
  if (entry.before.name && entry.after.name && entry.before.name !== entry.after.name) {
    out.push({
      date,
      sessionName: entry.after.name,
      kind: 'session_replaced',
      before: entry.before.name,
      after: entry.after.name,
      visible: true,
    });
  }

  // Coach note added (used for note-only changes — visible but not
  // structural).
  if (out.length === 0 && entry.changedFields.includes('coachNotes')) {
    const beforeNotes = new Set(entry.before.coachNotes);
    const newNotes = entry.after.coachNotes.filter((n) => !beforeNotes.has(n));
    if (newNotes.length > 0) {
      out.push({
        date,
        sessionName,
        kind: 'coach_note_added',
        after: newNotes[0],
        visible: true,
      });
    }
  }

  return out;
}

// ─── Guidance + optional advice from constraints/plans ──────────────

function dedupeStr(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    const v = (s ?? '').trim();
    if (!v) continue;
    if (seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    out.push(v);
  }
  return out;
}

function constraintRulesForGuidance(c: ActiveConstraint): string[] {
  return c.rules ?? [];
}

function planAvoidLines(plans: ConstraintPlan[]): string[] {
  return plans.flatMap((p) => p.avoid);
}

function planSubLines(plans: ConstraintPlan[]): string[] {
  return plans.flatMap((p) => p.substituteWith);
}

function planKeepLines(plans: ConstraintPlan[]): string[] {
  return plans.flatMap((p) => p.keep);
}

function planAdviceLines(plans: ConstraintPlan[]): string[] {
  return plans.flatMap((p) => p.advice);
}

// ─── Public API ─────────────────────────────────────────────────────

export interface BuildVerifiedInput {
  /** All active constraints (injury / fatigue / soreness / etc). */
  activeConstraints: ActiveConstraint[];
  /** Plan layer — the engine's avoid/sub/keep view of the constraints. */
  plans?: ConstraintPlan[];
  /**
   * Per-date visible diffs — the actual user-visible delta between the
   * current resolved week and a baseline week (e.g. without the
   * constraint applied). This is the GROUND TRUTH for appliedChanges.
   */
  visibleDiff: VisibleDiffEntry[];
}

/**
 * Build a VerifiedCoachCommunication from the engine's state. Only
 * `visibleDiff` populates appliedChanges — `plans` and `constraints`
 * never touch the Applied list, no matter how confident they are.
 */
export function buildVerifiedCommunication(
  input: BuildVerifiedInput,
): VerifiedCoachCommunication {
  const appliedChanges = input.visibleDiff.flatMap(classifyDiff);

  // Guidance: avoid labels (from plans) + per-constraint rules. These
  // are what the athlete must respect this week.
  const plans = input.plans ?? [];
  const activeGuidance = dedupeStr([
    ...planAvoidLines(plans),
    ...input.activeConstraints.flatMap(constraintRulesForGuidance),
  ]);

  // Optional: substituteWith + keep + plan advice. These describe what
  // the athlete CAN choose to do, never what the engine has done.
  const optionalAdvice = dedupeStr([
    ...planSubLines(plans),
    ...planKeepLines(plans),
    ...planAdviceLines(plans),
  ]);

  const canSayProgramUpdated = appliedChanges.some((c) => c.visible);
  const canSayProgramChanged = canSayProgramUpdated;

  // Honest unchangedReason — only populated when no applied changes but
  // there ARE active constraints (otherwise we don't render anything).
  let unchangedReason: string | undefined;
  if (!canSayProgramUpdated && input.activeConstraints.length > 0) {
    unchangedReason =
      'Nothing risky scheduled in your visible week — flagging only.';
  }

  if (typeof console !== 'undefined') {
    logger.debug('[truth-gate] communication_built', {
      applied: appliedChanges.length,
      guidance: activeGuidance.length,
      optional: optionalAdvice.length,
      canSayProgramUpdated,
    });
  }

  return {
    appliedChanges,
    activeGuidance,
    optionalAdvice,
    unchangedReason,
    canSayProgramUpdated,
    canSayProgramChanged,
  };
}

// ─── Validator: reply / card vs truth ───────────────────────────────

export interface ValidateInput {
  communication: VerifiedCoachCommunication;
  /** The chat reply the coach LLM/the engine wants to send. */
  replyText?: string;
  /**
   * The card data the UI is about to render. Only the fields that can
   * lie — Applied / Guidance / Optional. We deliberately don't ask for
   * the entire CoachUpdate because legacy fields are allowed to drift.
   */
  cardData?: {
    appliedChanges?: AppliedChange[];
    activeGuidance?: string[];
    optionalAdvice?: string[];
    /** Legacy fields — flagged when present alongside appliedChanges=0. */
    substituteWith?: string[];
  };
}

export interface ValidationResult {
  ok: boolean;
  violations: string[];
}

/**
 * Validate that a reply + card don't claim things outside what the
 * verified communication permits.
 */
export function validateCoachCommunicationTruth(
  input: ValidateInput,
): ValidationResult {
  const v: string[] = [];
  const c = input.communication;

  // Reply rules — only run forbidden-phrase scan when the reply
  // explicitly cannot say "updated".
  if (input.replyText && !c.canSayProgramUpdated) {
    for (const re of FORBIDDEN_WHEN_NO_APPLIED) {
      if (re.test(input.replyText)) {
        v.push(`reply contains forbidden claim: ${re.source}`);
      }
    }
  }

  // Card rules.
  if (input.cardData) {
    const card = input.cardData;
    // applied list must not exceed the verified list.
    if (card.appliedChanges && card.appliedChanges.length > c.appliedChanges.length) {
      v.push('card.appliedChanges has more entries than verified');
    }
    // appliedChanges in card must all match a verified entry by date+kind+after.
    const verifiedKeys = new Set(
      c.appliedChanges.map((a) => `${a.date}|${a.kind}|${a.before ?? ''}|${a.after ?? ''}`),
    );
    for (const a of card.appliedChanges ?? []) {
      const key = `${a.date}|${a.kind}|${a.before ?? ''}|${a.after ?? ''}`;
      if (!verifiedKeys.has(key)) {
        v.push(`card.appliedChanges contains unverified entry: ${key}`);
      }
    }
    // Legacy substituteWith field should not be rendered on cards going
    // forward, but if a caller passes it AND there are no applied
    // changes, that's the exact failure pattern we're guarding against.
    if (
      card.substituteWith &&
      card.substituteWith.length > 0 &&
      !c.canSayProgramUpdated
    ) {
      v.push('card.substituteWith presented as applied but no visible changes');
    }
  }

  const ok = v.length === 0;
  if (typeof console !== 'undefined') {
    if (ok) {
      logger.debug('[truth-gate] validation_passed');
    } else {
      logger.warn('[truth-gate] validation_failed', { violations: v });
    }
  }
  return { ok, violations: v };
}

// ─── Reply composer: guidance-only fallback ─────────────────────────

/**
 * Produce a guidance-only reply when no applied changes exist. The
 * caller swaps to this whenever validateCoachCommunicationTruth
 * fails or canSayProgramUpdated=false.
 */
export interface GuidanceOnlyInput {
  communication: VerifiedCoachCommunication;
  /** Lead constraint — drives the headline. */
  constraints: ActiveConstraint[];
  /**
   * When set, the user explicitly gave a severity (e.g. "fatigue 7/10").
   * When false (e.g. just "I'm cooked this week"), we MUST NOT print
   * "fatigue 5/10" — we ask for clarification instead.
   */
  severityIsExplicit?: boolean;
}

function leadHeadline(c: ActiveConstraint, severityIsExplicit: boolean): string {
  if (c.type === 'fatigue') {
    if (severityIsExplicit && c.severity > 0) {
      return `Got it — fatigue ${c.severity}/10. Flagging the week so we avoid adding extra hard work.`;
    }
    return `Got it — sounds like fatigue is up. I've flagged the week so we avoid adding extra hard work.`;
  }
  if (c.type === 'soreness') {
    const part = (c as ActiveSorenessConstraint).bodyPart || 'soreness';
    return severityIsExplicit
      ? `Got it — ${part} sore at ${c.severity}/10. Flagging the week so it doesn't get worse.`
      : `Got it — ${part} feeling sore. Flagging the week so it doesn't get worse.`;
  }
  if (c.type === 'schedule') {
    return `Got it — busy week. Flagging the week so we keep extra hard work off the menu.`;
  }
  if (c.type === 'missed_session') {
    return `No worries — picking up where the schedule left off, no make-up needed.`;
  }
  // injury (severity-unknown — rare, the injury path normally has explicit severity)
  const inj = c as ActiveInjuryConstraint;
  return severityIsExplicit
    ? `Got it — ${inj.bodyPart} ${inj.severity}/10. Flagging the week.`
    : `Got it — flagging the ${inj.bodyPart} restriction.`;
}

export function composeGuidanceOnlyReply(input: GuidanceOnlyInput): string {
  const c = input.communication;
  const lead = input.constraints[0];
  const severityIsExplicit = input.severityIsExplicit ?? false;

  const sections: string[] = [];

  if (lead) sections.push(leadHeadline(lead, severityIsExplicit));

  if (c.activeGuidance.length > 0) {
    const top = c.activeGuidance.slice(0, 3);
    sections.push(`Avoid: ${top.join(', ')}.`);
  }

  if (c.optionalAdvice.length > 0) {
    const top = c.optionalAdvice.slice(0, 2);
    sections.push(`Optional: if adding work, ${top.join(', ').toLowerCase()}.`);
  }

  // Severity-clarifier nudge when the constraint is fatigue/soreness/
  // schedule and severity wasn't explicit. We want the athlete to give
  // us a number so we can actually mutate.
  if (
    !severityIsExplicit &&
    lead &&
    (lead.type === 'fatigue' || lead.type === 'soreness' || lead.type === 'schedule')
  ) {
    sections.push(
      `If you want me to actively reduce sessions, tell me how cooked you are out of 10.`,
    );
  }

  if (typeof console !== 'undefined') {
    logger.debug('[truth-gate] downgraded_to_guidance_only', {
      sections: sections.length,
      severityIsExplicit,
      leadType: lead?.type,
    });
  }

  return sections.join('\n\n');
}
