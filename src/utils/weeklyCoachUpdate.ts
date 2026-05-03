/**
 * weeklyCoachUpdate.ts — derive the Coach Update card for ANY week,
 * driven by activeConstraints + the visible projection (not the
 * stored coachUpdatesByWeek snapshot).
 *
 * Why this exists:
 *   The previous card was stored per-week. Future weeks reshape
 *   silently via projection but no card was written, so the user had
 *   no explanation for the changes. This helper derives the card
 *   live from `activeConstraints + visibleWeek + baselineWeek` so
 *   every affected week shows the same coherent context.
 *
 * Pure: no I/O, no store writes. Caller passes constraints + the two
 * resolved weeks (with vs without constraint) and the helper does the
 * diff + composition.
 */

import type { ResolvedDay } from './sessionResolver';
import type {
  ActiveConstraint,
  ActiveInjuryConstraint,
} from '../store/coachUpdatesStore';
import { buildConstraintPlans, type ConstraintPlan } from './constraintPlan';
import {
  snapshotVisibleWorkout,
  computeVisibleDiff,
  type VisibleDiffEntry,
} from './visibleWorkoutDiff';
import {
  buildVerifiedCommunication,
  type VerifiedCoachCommunication,
  type AppliedChange,
} from './verifiedCoachCommunication';

export interface WeeklyCoachUpdateView {
  weekStartISO: string;
  title: 'Coach update';
  /** Bullet per active constraint — e.g. "Hammy pain — 7/10". */
  activeIssues: string[];
  /** Combined rules from all active constraints, deduped. */
  rules: string[];
  /** Combined safeFocus, deduped. */
  safeFocus: string[];
  /** Per-session change bullets visible on THIS week. */
  sessionsChanged: string[];
  /** Closing advice (physio nudges, etc) — deduped. */
  advice: string[];
  /** CTA label. Always "Update coach". */
  cta: 'Update coach';
  /** Suggested prefill text for the Update Coach CTA. */
  ctaPrefill: string;
  /**
   * Plan-driven concise summary fields. The card and the chat reply
   * both read from these to stay short + on-spec.
   */
  plans: ConstraintPlan[];
  /** Combined avoid labels across all plans, deduped + ordered (legacy). */
  avoid: string[];
  /** Combined substituteWith labels across all plans, deduped (legacy). */
  substituteWith: string[];
  /** Combined keep labels across all plans, deduped (legacy). */
  keep: string[];

  /**
   * TRUTH-GATE FIELDS — the canonical card data going forward.
   * appliedChanges is derived from the ACTUAL visible diff between
   * baselineWeek and visibleWeek; activeGuidance + optionalAdvice
   * come from the plans/constraints. canSayProgramUpdated gates any
   * reply phrasing that implies a structural mutation.
   */
  appliedChanges: AppliedChange[];
  activeGuidance: string[];
  optionalAdvice: string[];
  canSayProgramUpdated: boolean;
  unchangedReason?: string;
  /** Raw verified communication for direct reply composition. */
  verified: VerifiedCoachCommunication;
}

export interface BuildWeeklyInput {
  weekStartISO: string;
  visibleWeek: ResolvedDay[];
  baselineWeek: ResolvedDay[];
  activeConstraints: ActiveConstraint[];
}

const DOW: Record<number, string> = {
  0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat',
};

function dowFromISO(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return DOW[new Date(y, m - 1, d, 12, 0, 0, 0).getDay()] ?? '';
}

function exerciseNames(d: ResolvedDay | undefined): string[] {
  if (!d?.workout) return [];
  return (d.workout.exercises ?? [])
    .map((e: any) => e.exercise?.name ?? '')
    .filter(Boolean);
}

function dedupe<T>(arr: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    const key = JSON.stringify(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function activeFilter(constraints: ActiveConstraint[]): ActiveConstraint[] {
  return constraints.filter((c) => c.status !== 'resolved');
}

function capitalise(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function reasonLine(c: ActiveConstraint): string {
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
  return c.sessionName ? `Missed ${c.sessionName}` : 'Missed session';
}

/**
 * Build the bullet for one session that changed on this week.
 *
 *   "Mon Lower Body Strength adjusted — Trap Bar Deadlift removed"
 *   "Thu Upper Push adjusted — pressing/overhead removed"
 */
function sessionBullet(date: string, baseline: ResolvedDay | undefined, projected: ResolvedDay | undefined): string {
  const before = exerciseNames(baseline);
  const after = exerciseNames(projected);
  const removed = before.filter((n) => !after.includes(n));
  const dow = dowFromISO(date);
  const name = projected?.workout?.name ?? baseline?.workout?.name ?? 'session';
  if (removed.length === 0) return `${dow} ${name} adjusted`;
  if (removed.length === 1) return `${dow} ${name} adjusted — ${removed[0]} removed`;
  if (removed.length <= 3) return `${dow} ${name} adjusted — removed ${removed.join(', ')}`;
  const head = removed.slice(0, 2).join(', ');
  return `${dow} ${name} adjusted — ${head} + ${removed.length - 2} more removed`;
}

/**
 * Compose the prefill string for the "Update coach" CTA based on the
 * active constraint set. Single injury → "Update on my hammy: ".
 * Multiple → "Update on my hammy/shoulder: ".
 */
export function getUpdateCoachPrefill(constraints: ActiveConstraint[]): string {
  const active = activeFilter(constraints);
  const injuries = active.filter((c): c is ActiveInjuryConstraint => c.type === 'injury');
  if (injuries.length === 1) return `Update on my ${injuries[0].bodyPart}: `;
  if (injuries.length > 1) return `Update on my ${injuries.map((i) => i.bodyPart).join('/')}: `;
  // Non-injury fall-throughs.
  const sorenesses = active.filter((c) => c.type === 'soreness') as Array<
    Extract<ActiveConstraint, { type: 'soreness' }>
  >;
  if (sorenesses.length === 1) return `Update on my ${sorenesses[0].bodyPart} soreness: `;
  if (sorenesses.length > 1) {
    return `Update on my ${sorenesses.map((s) => s.bodyPart).join('/')} soreness: `;
  }
  if (active.some((c) => c.type === 'fatigue')) return 'Update on how I’m feeling: ';
  if (active.some((c) => c.type === 'schedule')) return 'Update on my week: ';
  if (active.some((c) => c.type === 'missed_session')) return 'Update on the missed session: ';
  return 'Update on my injury: ';
}

/**
 * Derive a weekly Coach Update view. Returns `null` ONLY when:
 *   - no active constraints
 *   - AND no visible-projection diff for this week
 *
 * If active constraints exist but the visible week shows no diff, we
 * STILL return a view — the card explains the active restriction is
 * in place even though no sessions this week were affected (e.g. a
 * pure-rest week). The card is the persistent explanation layer for
 * the active constraints.
 */
export function buildWeeklyCoachUpdateFromConstraints(
  input: BuildWeeklyInput,
): WeeklyCoachUpdateView | null {
  const constraints = activeFilter(input.activeConstraints);
  if (constraints.length === 0) return null;

  // Diff baseline vs visible.
  const baselineByDate = new Map(input.baselineWeek.map((d) => [d.date, d]));
  const visibleByDate = new Map(input.visibleWeek.map((d) => [d.date, d]));
  const sessionsChanged: string[] = [];
  for (const date of Array.from(baselineByDate.keys())) {
    const b = baselineByDate.get(date);
    const v = visibleByDate.get(date);
    if (!b || !v) continue;
    const before = exerciseNames(b);
    const after = exerciseNames(v);
    const removed = before.filter((n) => !after.includes(n));
    const beforeNotes = b.workout?.coachNotes ?? [];
    const afterNotes = v.workout?.coachNotes ?? [];
    const addedNotes = afterNotes.filter((n) => !beforeNotes.includes(n));
    if (removed.length === 0 && addedNotes.length === 0) continue;
    sessionsChanged.push(sessionBullet(date, b, v));
  }

  const activeIssues = constraints.map(reasonLine);
  const rules = dedupe(constraints.flatMap((c) => c.rules ?? []));
  const safeFocus = dedupe(constraints.flatMap((c) => c.safeFocus ?? []));
  // Build plans + derive the concise card aggregates. Plans carry the
  // engine policy as the canonical source so card + validator + reply
  // never drift.
  const plans = buildConstraintPlans(constraints);
  const avoid = dedupe(plans.flatMap((p) => p.avoid));
  const substituteWith = dedupe(plans.flatMap((p) => p.substituteWith));
  const keep = dedupe(plans.flatMap((p) => p.keep));
  // Advice prefers the plan's physio nudges (severity-aware) but
  // falls back to per-constraint advice if a caller passed one in.
  const advice = dedupe([
    ...plans.flatMap((p) => p.advice),
    ...constraints.flatMap((c) => c.advice ?? []),
  ]);
  const ctaPrefill = getUpdateCoachPrefill(input.activeConstraints);

  // ── Truth-gate verified communication ───────────────────────────
  // Build VisibleDiffEntry[] from baselineWeek vs visibleWeek so the
  // truth-gate has actual ground-truth diffs (not plan inferences).
  const allDates = Array.from(baselineByDate.keys());
  const beforeSnap: Record<string, ReturnType<typeof snapshotVisibleWorkout>> = {};
  const afterSnap: Record<string, ReturnType<typeof snapshotVisibleWorkout>> = {};
  for (const date of allDates) {
    beforeSnap[date] = snapshotVisibleWorkout(baselineByDate.get(date)?.workout);
    afterSnap[date] = snapshotVisibleWorkout(visibleByDate.get(date)?.workout);
  }
  const visibleDiff: VisibleDiffEntry[] = computeVisibleDiff(
    allDates,
    beforeSnap,
    afterSnap,
  );
  const verified = buildVerifiedCommunication({
    activeConstraints: constraints,
    plans,
    visibleDiff,
  });

  return {
    weekStartISO: input.weekStartISO,
    title: 'Coach update',
    activeIssues,
    rules,
    safeFocus,
    sessionsChanged,
    advice,
    cta: 'Update coach',
    ctaPrefill,
    plans,
    avoid,
    substituteWith,
    keep,
    appliedChanges: verified.appliedChanges,
    activeGuidance: verified.activeGuidance,
    optionalAdvice: verified.optionalAdvice,
    canSayProgramUpdated: verified.canSayProgramUpdated,
    unchangedReason: verified.unchangedReason,
    verified,
  };
}

/**
 * Build a per-session coachNote attribution that names the constraints
 * affecting THIS session. Used by the projection/exposure layer when
 * multiple constraints fire on one session — surfaces a single human
 * note instead of duplicates.
 *
 * Examples:
 *   ["Adjusted for active hammy — update coach if symptoms improve."]
 *   ["Adjusted for active hammy + shoulder — update coach if symptoms improve."]
 */
export function buildSessionConstraintNote(
  affectingConstraints: ActiveConstraint[],
): string | null {
  const active = activeFilter(affectingConstraints);
  const parts = active
    .map((c) => {
      if (c.type === 'injury') return c.bodyPart;
      if (c.type === 'fatigue') return 'fatigue';
      if (c.type === 'soreness') return c.bodyPart ? `${c.bodyPart} soreness` : 'soreness';
      if (c.type === 'schedule') return 'busy week';
      // missed_session — informational only, no per-session attribution.
      return null;
    })
    .filter((s): s is string => Boolean(s));
  if (parts.length === 0) return null;
  const joined = parts.length === 1 ? parts[0] : parts.join(' + ');
  return `Adjusted for active ${joined} — update coach if symptoms improve.`;
}
