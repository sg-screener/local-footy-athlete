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
  hip: 'lowerBack',
  hips: 'lowerBack',

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

// ─── Producers ──────────────────────────────────────────────────────

/**
 * Produce a fatigue constraint. Severity defaults to 5 (moderate) when
 * the LLM didn't supply one.
 */
export function buildFatigueConstraintFromIntent(
  intent: CoachIntent,
  nowISO: string = new Date().toISOString(),
): ActiveFatigueConstraint {
  const severity = clampSeverity(intent.payload?.severity, 5);
  return {
    id: FATIGUE_ID,
    type: 'fatigue',
    severity,
    status: 'active',
    startDate: nowISO,
    lastUpdatedAt: nowISO,
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
): ActiveSorenessConstraint | null {
  const rawBodyPart = intent.payload?.bodyPart;
  const bucket = bodyPartToBucket(rawBodyPart);
  if (!bucket) return null;
  const severity = clampSeverity(intent.payload?.severity, 4);
  const bodyPart = (rawBodyPart ?? bucket).trim().toLowerCase();
  return {
    id: sorenessId(bucket),
    type: 'soreness',
    bodyPart,
    bucket,
    severity,
    status: 'active',
    startDate: nowISO,
    lastUpdatedAt: nowISO,
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
): ActiveScheduleConstraint {
  const severity = clampSeverity(intent.payload?.severity, 5);
  return {
    id: SCHEDULE_ID,
    type: 'schedule',
    severity,
    status: 'active',
    startDate: nowISO,
    lastUpdatedAt: nowISO,
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
