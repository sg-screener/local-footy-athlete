/**
 * injuryProgression.ts — pure helpers for the injury follow-up loop.
 *
 *   classifyInjuryUpdate(message, current)  — what does the athlete's
 *                                              latest message MEAN
 *                                              relative to the active
 *                                              injury?
 *   daysBetween(isoA, isoB)                  — calendar-day delta used
 *                                              by the "if unchanged for
 *                                              3–5 days, suggest physio"
 *                                              rule.
 *
 * No store, no engine, no I/O. Easy to test in isolation; CoachScreen
 * orchestrates the actual mutation flow that consumes the outcome.
 */

import { parseSeverityNumber } from './injuryAdjustmentEngine';
import type { InjuryBucket } from './programAdjustmentEngine';
import { classifyBibleInjurySeverity } from '../rules/injurySeverityBands';

/** Status surfaced on the Coach Update card and stored in InjuryState. */
export type InjuryStatus = 'active' | 'improving' | 'resolved';

/**
 * Restriction tier — how aggressively the engine + resolver should
 * modify the program for a given pain level.
 *
 *   severe (8-10) — pause affected training where needed
 *   strict (6-7)  — no risky work + physio/medical advice
 *   relaxed (4-5) — reduce affected work, coachNotes only
 *   light (1-3)   — avoid exact trigger, advisory notes
 *   none (0)      — no modifications (fully restored)
 */
export type RestrictionTier = 'severe' | 'strict' | 'relaxed' | 'light' | 'none';

export function severityToTier(severity: number): RestrictionTier {
  if (severity <= 0) return 'none';
  switch (classifyBibleInjurySeverity(severity).band) {
    case 'avoid_trigger_1_3':
      return 'light';
    case 'reduce_affected_4_5':
      return 'relaxed';
    case 'restrict_and_refer_6_7':
      return 'strict';
    case 'pause_affected_8_10':
      return 'severe';
  }
}

/**
 * True when the tier represents a "real" restriction layer (i.e. the
 * resolver / engine should emit some kind of modification).
 *
 *   none → no filter
 *   light → notes only, no removals
 *   relaxed/strict/severe → removals + notes
 */
export function tierIsActive(tier: RestrictionTier): boolean {
  return tier !== 'none';
}

/**
 * True when the tier should remove tagged risky exercises (vs notes-
 * only). Relaxed and below keep exercises in but flag them via notes.
 */
export function tierRemovesExercises(tier: RestrictionTier): boolean {
  return tier === 'strict' || tier === 'severe';
}

/**
 * Persistent injury state — lives across weeks until resolved. The
 * coach update card reads this for its reason / rules; the follow-up
 * classifier compares incoming messages against `severity`; the
 * resolver-level filter (`applyInjuryFilterToWorkout`) reads
 * `bodyPart` + `bucket` + `severity` + `status` to filter every
 * future-week session, not just the current week.
 *
 * INVARIANTS
 *   - `bodyPart` and `bucket` MUST be set together (or both null /
 *     'unknown' for the unmapped fallback). The resolver short-circuits
 *     when bucket is null.
 *   - `severity` ranges 0..10. 0 is transient — the lifecycle
 *     immediately transitions to 'resolved' and the card deactivates.
 *   - `status === 'resolved'` is the signal to STOP applying the
 *     filter. Future-week renders return to template.
 *   - `rules` is a SNAPSHOT of `buildInjuryPolicy(...).globalRules` at
 *     the last transition. Use `getInjuryRules(state)` for the live
 *     value (re-derives from current severity).
 */
export interface InjuryState {
  bodyPart: string;
  bucket: InjuryBucket | null;
  /** Current pain level (post-update). 0 means resolved (transient). */
  severity: number;
  /** Severity at first report — keeps the trend interpretable. */
  initialSeverity: number;
  status: InjuryStatus;
  /**
   * Snapshot of `buildInjuryPolicy(...).globalRules` at the last
   * transition. Stored for cheap UI reads; the live computation via
   * `getInjuryRules(state)` is authoritative.
   */
  rules: string[];
  /** ISO timestamp when the injury was first reported (alias of createdAt). */
  startDate: string;
  /** ISO timestamp when this state was last touched. */
  lastUpdatedAt: string;
  /** ISO timestamp of the very first report. */
  createdAt: string;
  /** Append-only audit trail of severity transitions. */
  history: InjuryHistoryEntry[];
}

export interface InjuryHistoryEntry {
  timestamp: string;
  /** Status BEFORE this entry was applied. */
  fromStatus: InjuryStatus | 'new';
  /** Status AFTER this entry. */
  toStatus: InjuryStatus;
  /** Severity AFTER this entry. */
  severity: number;
  /** Free-text note (the user's message, trimmed). */
  note: string;
}

export type InjuryUpdateOutcome =
  | { kind: 'resolved'; reason: string }
  | { kind: 'improving'; newSeverity: number; reason: string }
  | { kind: 'worsening'; newSeverity: number; reason: string }
  | { kind: 'unchanged'; reason: string }
  | { kind: 'no_match'; reason: string };

const RESOLVED_RE =
  /\b(pain (is )?(gone|all good|fully gone)|all better|fully (healed|recovered|good)|no (more )?pain|fine now|feels (great|fine|perfect|100%?)|resolved|all sorted|sorted now|cleared up|good as gold|all good now)\b/i;
const RESOLVED_ZERO_RE = /\b0\s*\/\s*10\b/;

const IMPROVING_RE =
  /\b(better|improving|improved|easing( up)?|less pain|easier|loosening up|starting to settle|coming good|on the mend)\b/i;

const WORSENING_RE =
  /\b(worse|worse today|getting worse|more pain|flared up|flaring|killing me|much worse|deteriorating|spiked|spiking)\b/i;

const UNCHANGED_RE =
  /\b(same|no change|still hurts|still sore|still the same|same as|no different|holding steady)\b/i;

/**
 * Classify an athlete's follow-up message relative to the active injury.
 *
 * Decision order:
 *   1. Resolved phrases / "0/10" → resolved.
 *   2. Numeric "<n>/10" → compare against current.severity.
 *   3. Worsening phrases → bump severity by ~2 (capped at 10).
 *   4. Improving phrases → drop severity by ~2 (floor 1; we only emit
 *      'resolved' when the user is explicit so we don't prematurely
 *      cancel restrictions on a vague "better").
 *   5. Unchanged phrases → unchanged.
 *   6. Otherwise → no_match (caller falls through to the new-injury
 *      flow or the LLM).
 */
export function classifyInjuryUpdate(
  message: string,
  current: InjuryState,
): InjuryUpdateOutcome {
  if (!message || typeof message !== 'string') {
    return { kind: 'no_match', reason: 'empty message' };
  }
  const text = message.toLowerCase().trim();
  if (!text) return { kind: 'no_match', reason: 'empty message' };

  // 1. Explicit resolved.
  if (RESOLVED_ZERO_RE.test(text)) {
    return { kind: 'resolved', reason: '0/10' };
  }
  if (RESOLVED_RE.test(text)) {
    return { kind: 'resolved', reason: 'resolved language' };
  }

  // 2. Numeric severity (uses the same parser as the new-injury flow,
  //    which also handles qualitative phrases like "feels off" → 6).
  //    For follow-ups we ONLY care about explicit "n/10" numbers — the
  //    qualitative phrases below produce more useful classifications.
  const numMatch = text.match(/(\d+)\s*\/\s*10/);
  const numericSeverity = numMatch ? parseInt(numMatch[1], 10) : null;
  if (numericSeverity !== null && numericSeverity >= 0 && numericSeverity <= 10) {
    if (numericSeverity === 0) return { kind: 'resolved', reason: '0/10' };
    if (numericSeverity < current.severity) {
      return {
        kind: 'improving',
        newSeverity: numericSeverity,
        reason: `${numericSeverity}/10 < ${current.severity}/10`,
      };
    }
    if (numericSeverity > current.severity) {
      return {
        kind: 'worsening',
        newSeverity: numericSeverity,
        reason: `${numericSeverity}/10 > ${current.severity}/10`,
      };
    }
    return { kind: 'unchanged', reason: 'same severity' };
  }

  // Worsening checked BEFORE improving so "worse than yesterday" beats
  // a stray "better" elsewhere in the message.
  if (WORSENING_RE.test(text)) {
    const newSeverity = Math.min(10, current.severity + 2);
    return { kind: 'worsening', newSeverity, reason: 'worsening language' };
  }

  if (IMPROVING_RE.test(text)) {
    // Drop by 2 but stay ≥1 — explicit "resolved" is the only path to 0.
    const newSeverity = Math.max(1, current.severity - 2);
    return { kind: 'improving', newSeverity, reason: 'improving language' };
  }

  if (UNCHANGED_RE.test(text)) {
    return { kind: 'unchanged', reason: 'same language' };
  }

  // Fallback: parseSeverityNumber catches qualitative + bare numbers.
  // We only act if the parsed number diverges from current.severity —
  // otherwise we let the message through to the LLM.
  const parsed = parseSeverityNumber(text);
  if (parsed != null) {
    if (parsed === 0) return { kind: 'resolved', reason: 'parsed 0' };
    if (parsed < current.severity) {
      return { kind: 'improving', newSeverity: parsed, reason: `parsed ${parsed}` };
    }
    if (parsed > current.severity) {
      return { kind: 'worsening', newSeverity: parsed, reason: `parsed ${parsed}` };
    }
    return { kind: 'unchanged', reason: 'parsed-same' };
  }

  return { kind: 'no_match', reason: 'no update language' };
}

/**
 * Calendar-day delta between two ISO timestamps. Used for the
 * "unchanged for 3+ days → physio nudge" rule. Day boundary is local
 * time; partial days round down.
 */
export function daysBetween(isoA: string, isoB: string): number {
  const a = new Date(isoA);
  const b = new Date(isoB);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0;
  const ms = Math.abs(b.getTime() - a.getTime());
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

/**
 * Should the coach card include a "see a physio" nudge given the
 * unchanged-streak rule? Returns true when the injury has been
 * `active` or `unchanged` for >= `thresholdDays` days.
 */
export function shouldSuggestPhysio(
  state: InjuryState,
  nowISO: string = new Date().toISOString(),
  thresholdDays: number = 3,
): boolean {
  if (state.status === 'resolved') return false;
  // The classifier maps "unchanged" follow-ups to status='active' (we
  // don't lower severity), so "active for >= N days" covers both.
  return daysBetween(state.createdAt, nowISO) >= thresholdDays;
}

/**
 * Re-derive the live policy rules from current severity. The
 * `state.rules` field is a snapshot at the last transition — this
 * helper is the authoritative read for UI / reply-time consumers
 * who want "what restrictions apply RIGHT NOW".
 *
 * Lazy require avoids a circular import with programAdjustmentEngine.
 */
export function getInjuryRules(state: InjuryState | null | undefined): string[] {
  if (!state || state.status === 'resolved') return [];
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { buildInjuryPolicy } = require('./programAdjustmentEngine');
  const policy = buildInjuryPolicy(state.bucket, state.severity);
  return [...policy.globalRules];
}
