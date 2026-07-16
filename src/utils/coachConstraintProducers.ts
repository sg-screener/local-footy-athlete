/**
 * coachConstraintProducers.ts — turn a `CoachIntent` (LLM-classified
 * non-injury signal) into a typed `ActiveConstraint` ready for the
 * coachUpdatesStore.
 *
 * WHY THIS MODULE EXISTS
 *
 * The dispatcher used to no-op for fatigue / soreness / busy_week /
 * missed_session — just sending back a state-grounded reply. This module
 * adds the missing producer step so non-injury signals flow through the
 * SAME pipeline as injuries:
 *
 *   intent (LLM) → producer (this file) → upsertActiveConstraint →
 *   exposureEngine.Constraint via projection extraConstraints →
 *   visibleProgramProjection → V2 screens render coachNotes →
 *   buildConstraintPlans → CoachUpdate card
 *
 * No new system. Just the producer step that wires the existing layers
 * together for non-injury constraints.
 *
 * Pure: no store reads/writes, no I/O. The dispatcher calls the result
 * into upsertActiveConstraint.
 */

import type { CoachIntent } from './coachIntent';
import type {
  ActiveFatigueConstraint,
  ActiveSorenessConstraint,
  ActiveScheduleConstraint,
  ActiveMissedSessionConstraint,
} from '../store/coachUpdatesStore';
import type { InjuryBucket } from './programAdjustmentEngine';
import type { ConstraintRegion } from './exposureEngine';
import { todayISOLocal } from './appDate';

// ─── Body-part → InjuryBucket (soreness uses the same canonicalisation) ─

const BODY_PART_TO_BUCKET: Readonly<Record<string, InjuryBucket>> = {
  hamstring: 'hamstring',
  hamstrings: 'hamstring',
  hammy: 'hamstring',
  hammies: 'hamstring',
  glute: 'hamstring',
  glutes: 'hamstring',

  knee: 'knee',
  knees: 'knee',
  quad: 'knee',
  quads: 'knee',
  quadricep: 'knee',
  quadriceps: 'knee',

  calf: 'calf',
  calves: 'calf',
  achilles: 'calf',

  ankle: 'ankle',
  ankles: 'ankle',
  foot: 'ankle',
  feet: 'ankle',

  groin: 'adductor',
  adductor: 'adductor',
  adductors: 'adductor',
  hip: 'adductor',
  hips: 'adductor',

  back: 'lowerBack',
  'lower back': 'lowerBack',
  'upper back': 'lowerBack',

  shoulder: 'shoulder',
  shoulders: 'shoulder',
  pec: 'shoulder',
  pecs: 'shoulder',
  chest: 'shoulder',
  neck: 'shoulder',

  elbow: 'elbow',
  elbows: 'elbow',
  bicep: 'elbow',
  biceps: 'elbow',
  tricep: 'elbow',
  triceps: 'elbow',
  forearm: 'elbow',
  forearms: 'elbow',

  wrist: 'wrist',
  wrists: 'wrist',
};

/** Lower-cased prefix-match against the body-part dictionary. */
function bodyPartToBucket(raw: string | undefined): InjuryBucket | null {
  if (!raw) return null;
  const norm = raw.trim().toLowerCase();
  if (BODY_PART_TO_BUCKET[norm]) return BODY_PART_TO_BUCKET[norm];
  // Try to find a body-part word INSIDE the raw string (free-text)
  for (const key of Object.keys(BODY_PART_TO_BUCKET)) {
    const re = new RegExp(`\\b${key}\\b`, 'i');
    if (re.test(norm)) return BODY_PART_TO_BUCKET[key];
  }
  return null;
}

/** Map an InjuryBucket → engine ConstraintRegion. */
const BUCKET_TO_REGION: Record<InjuryBucket, ConstraintRegion> = {
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

export function bucketToRegion(bucket: InjuryBucket): ConstraintRegion {
  return BUCKET_TO_REGION[bucket];
}

// ─── ID helpers ─────────────────────────────────────────────────────

const FATIGUE_ID = 'fatigue-active';
const SCHEDULE_ID = 'schedule-busy-week';

interface ProducerContext {
  /** Raw user turn, used only to infer day-vs-week scope. */
  userMessage?: string;
  /** Selected program date when the chat turn was sent. */
  selectedDateISO?: string;
}

function sorenessId(bucket: InjuryBucket | 'unknown'): string {
  return `soreness-${bucket}`;
}

function missedSessionId(missedDate?: string): string {
  return `missed-${missedDate ?? 'recent'}`;
}

// ─── Severity helpers ───────────────────────────────────────────────

function clampSeverity(n: unknown, fallback: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(10, Math.round(n)));
}

function isoDate(value: string | undefined): string {
  if (value && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  return todayISOLocal();
}

function addDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days, 12);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

function mondayForDate(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12);
  const dow = dt.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  return addDaysISO(dateISO, diff);
}

function weekEndForDate(dateISO: string): string {
  return addDaysISO(mondayForDate(dateISO), 6);
}

function selectedDateForIntent(
  intent: CoachIntent,
  nowISO: string,
  context?: ProducerContext,
): string {
  return isoDate(
    intent.payload?.requestedDate ??
    intent.payload?.targetDate ??
    context?.selectedDateISO ??
    nowISO,
  );
}

function textForScope(intent: CoachIntent, context?: ProducerContext): string {
  return [
    context?.userMessage,
    intent.payload?.concern,
    intent.payload?.scope,
    intent.payload?.requestedSession,
  ].filter(Boolean).join(' ').toLowerCase();
}

function fatigueIsWeekScoped(
  intent: CoachIntent,
  severity: number,
  context?: ProducerContext,
): boolean {
  const text = textForScope(intent, context);
  const explicitlyToday = /\b(today|tonight|this\s+morning|this\s+arvo|this\s+afternoon)\b/i.test(text);
  const explicitlyWeek =
    /\b(cooked|wrecked|smoked|fried|load\s+reduced|recovery\s+mode|this\s+week|week|weekly)\b/i.test(text);
  return (
    explicitlyWeek ||
    (severity >= 7 && !explicitlyToday)
  );
}

// ─── Producers ──────────────────────────────────────────────────────

/**
 * Produce a fatigue constraint. Severity defaults to 5 (moderate) when
 * the LLM didn't supply one.
 */
export function buildFatigueConstraintFromIntent(
  intent: CoachIntent,
  nowISO: string = new Date().toISOString(),
  context?: ProducerContext,
): ActiveFatigueConstraint {
  const severity = clampSeverity(intent.payload?.severity, 5);
  const selectedDate = selectedDateForIntent(intent, nowISO, context);
  const weekScoped = fatigueIsWeekScoped(intent, severity, context);
  return {
    id: FATIGUE_ID,
    type: 'fatigue',
    severity,
    status: 'active',
    startDate: nowISO,
    lastUpdatedAt: nowISO,
    reasonLabel: 'Fatigue',
    source: 'coach',
    ...(weekScoped ? {} : { appliesToDate: selectedDate }),
    expiresAt: weekScoped ? weekEndForDate(selectedDate) : selectedDate,
    modifierTitle: weekScoped ? 'Load reduced this week' : 'Recovery mode active',
    modifierBody: weekScoped
      ? 'Your week has been adjusted because you said you were cooked.'
      : 'Your training load is reduced today while you recover.',
    modifierAffects: [weekScoped ? 'current_week' : 'current_day'],
    // Noun-phrase form: these strings are joined under an "Avoid:"
    // header by the truth-gate composer, so they must read as things
    // the athlete should NOT do (not as claims of action the engine
    // has taken).
    rules: severity >= 7
      ? ['max-effort + heavy strength this week', 'sprinting / plyos']
      : severity >= 5
        ? ['max-effort lifts', 'hard conditioning + sprints']
        : ['adding extra hard work this week'],
    safeFocus: ['Easy aerobic conditioning', 'Recovery + mobility', 'Light technique work'],
    advice: severity >= 7
      ? ['Prioritise sleep + food this week. Bring hard sessions back gradually.']
      : [],
  };
}

/**
 * Produce a soreness constraint. Returns null when no body part can be
 * resolved — caller should fall back to a clarifying reply rather than
 * write an unmapped soreness entry.
 */
export function buildSorenessConstraintFromIntent(
  intent: CoachIntent,
  nowISO: string = new Date().toISOString(),
  context?: ProducerContext,
): ActiveSorenessConstraint | null {
  const rawBodyPart = intent.payload?.bodyPart;
  const bucket = bodyPartToBucket(rawBodyPart);
  if (!bucket) return null;
  const severity = clampSeverity(intent.payload?.severity, 4);
  const bodyPart = (rawBodyPart ?? bucket).trim().toLowerCase();
  const selectedDate = selectedDateForIntent(intent, nowISO, context);
  const mild = severity <= 5;
  return {
    id: sorenessId(bucket),
    type: 'soreness',
    bodyPart,
    bucket,
    severity,
    status: 'active',
    startDate: nowISO,
    lastUpdatedAt: nowISO,
    reasonLabel: `${bodyPart} soreness`,
    source: 'coach',
    ...(mild ? { appliesToDate: selectedDate } : {}),
    expiresAt: mild ? selectedDate : weekEndForDate(selectedDate),
    modifierTitle: `${bodyPart.charAt(0).toUpperCase()}${bodyPart.slice(1)} soreness active`,
    modifierBody: mild
      ? `Your program is keeping ${bodyPart} work pain-free today.`
      : `Your program is managing soreness around ${bodyPart}.`,
    modifierAffects: [mild ? 'current_day' : 'current_week'],
    rules: severity >= 6
      ? [`heavy ${bodyPart} loading until soreness drops`]
      : [`high ${bodyPart} volume this week`],
    safeFocus: ['Movement + mobility around the sore area', 'Other regions trained as normal'],
    advice: [],
  };
}

/**
 * Produce a busy-week / schedule constraint. Severity 5 by default.
 */
export function buildBusyWeekConstraintFromIntent(
  intent: CoachIntent,
  nowISO: string = new Date().toISOString(),
  context?: ProducerContext,
): ActiveScheduleConstraint {
  const severity = clampSeverity(intent.payload?.severity, 5);
  const selectedDate = selectedDateForIntent(intent, nowISO, context);
  const weekStartISO = mondayForDate(selectedDate);
  return {
    id: SCHEDULE_ID,
    type: 'schedule',
    severity,
    status: 'active',
    startDate: nowISO,
    lastUpdatedAt: nowISO,
    reasonLabel: 'Busy week',
    source: 'coach',
    weekStartISO,
    expiresAt: addDaysISO(weekStartISO, 6),
    modifierTitle: 'Busy week adjustment active',
    modifierBody: 'Your week has been reduced around your schedule.',
    modifierAffects: ['current_week'],
    // Noun-phrase form for the truth-gate "Avoid:" header.
    rules: severity >= 7
      ? ['max-effort sessions this week', 'long accessory blocks']
      : ['long sessions this week', 'optional accessory volume'],
    safeFocus: ['Short, targeted sessions', 'Skill / technique work', 'Recovery + mobility'],
    advice: [],
  };
}

/**
 * Produce a missed-session constraint. Severity 0 — informational only,
 * no exposure mutation. The card surfaces the acknowledgement.
 */
export function buildMissedSessionConstraintFromIntent(
  intent: CoachIntent,
  nowISO: string = new Date().toISOString(),
): ActiveMissedSessionConstraint {
  const missedDate = intent.payload?.requestedDate;
  const sessionName = intent.payload?.requestedSession;
  return {
    id: missedSessionId(missedDate),
    type: 'missed_session',
    missedDate,
    sessionName,
    severity: 0,
    status: 'active',
    startDate: nowISO,
    lastUpdatedAt: nowISO,
    rules: [],
    safeFocus: ['Pick up where the schedule left off', 'Skip make-up sessions if they bunch hard days'],
    advice: [],
  };
}
