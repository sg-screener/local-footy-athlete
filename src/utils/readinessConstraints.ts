import type {
  ActiveConstraint,
  ActiveFatigueConstraint,
  ActiveSorenessConstraint,
  ActiveScheduleConstraint,
} from '../store/coachUpdatesStore';
import type { ReadinessSignal } from './readiness';
import { resolveInjuryBucket } from './programAdjustmentEngine';
import { addDays, getMondayForDate } from './sessionResolver';

export const READINESS_CONSTRAINT_PREFIX = 'readiness:';

export type PoorSleepPattern = 'single_night' | 'repeated';

export function poorSleepConstraintId(
  dateISO: string,
  pattern: PoorSleepPattern,
): string {
  return pattern === 'repeated'
    ? `${READINESS_CONSTRAINT_PREFIX}poor-sleep:week:${getMondayForDate(dateISO)}`
    : `${READINESS_CONSTRAINT_PREFIX}poor-sleep:day:${dateISO}`;
}

export function isPoorSleepConstraint(
  constraint: ActiveConstraint | null | undefined,
): constraint is ActiveFatigueConstraint {
  return constraint?.type === 'fatigue' && constraint.readinessKind === 'poor_sleep';
}

/**
 * Deterministic Bible poor-sleep policy. It deliberately reuses fatigue
 * severity 3 (slight) and 5 (moderate), so projection and generation keep
 * owning the actual exercise/session reductions.
 */
export function buildPoorSleepReadinessConstraint(args: {
  date: string;
  pattern: PoorSleepPattern;
  nowISO?: string;
}): ActiveFatigueConstraint {
  const repeated = args.pattern === 'repeated';
  const now = args.nowISO ?? nowISO();
  const weekStart = getMondayForDate(args.date);
  return {
    id: poorSleepConstraintId(args.date, args.pattern),
    type: 'fatigue',
    severity: repeated ? 5 : 3,
    status: 'active',
    startDate: now,
    lastUpdatedAt: now,
    reasonLabel: repeated ? 'Repeated poor sleep' : 'Poor sleep',
    source: 'readiness',
    readinessKind: 'poor_sleep',
    readinessPattern: args.pattern,
    ...(repeated ? {} : { appliesToDate: args.date }),
    expiresAt: repeated ? addDays(weekStart, 6) : args.date,
    modifierTitle: repeated
      ? 'Poor sleep load reduction active'
      : 'Poor sleep adjustment active',
    modifierBody: repeated
      ? 'Hard load is reduced this week after repeated poor sleep.'
      : "Today's hard extras are reduced after a poor night's sleep.",
    modifierAffects: [repeated ? 'current_week' : 'current_day'],
    rules: repeated
      ? ['hard conditioning + sprints', 'max-effort + heavy lower work', 'extra optional work']
      : ['finishers / hard extras', 'extra sprint / hard conditioning', 'max-effort work'],
    safeFocus: repeated
      ? ['Safe strength at a controlled dose', 'Easy aerobic conditioning', 'Recovery + mobility']
      : ['Main strength work if moving well', 'Easy aerobic conditioning', 'Light technique work'],
    advice: [],
  };
}

function nowISO(): string {
  return new Date().toISOString();
}

function baseFields(signal: ReadinessSignal, suffix: string, label: string) {
  const stamp = signal.updatedAt || nowISO();
  return {
    id: `${READINESS_CONSTRAINT_PREFIX}${signal.date}:${suffix}`,
    status: 'active' as const,
    startDate: stamp,
    lastUpdatedAt: stamp,
    reasonLabel: label,
    source: 'readiness' as const,
    appliesToDate: signal.date,
    modifierTitle: 'Training adjusted',
    modifierBody: "Your program is being adjusted based on how you're feeling.",
    modifierAffects: ['current_day' as const],
  };
}

export function buildReadinessActiveConstraints(
  signal: ReadinessSignal | null | undefined,
): ActiveConstraint[] {
  if (!signal) return [];
  const constraints: ActiveConstraint[] = [];

  if (signal.flatToday || signal.energy === 'low') {
    const fatigue: ActiveFatigueConstraint = {
      ...baseFields(signal, 'flat', 'Feeling flat'),
      type: 'fatigue',
      severity: 3,
      rules: ['finishers / hard extras', '1-2 accessories if the session feels too big'],
      safeFocus: ['Main lift if moving well', 'Easy aerobic conditioning', 'Light technique work'],
      advice: [],
    };
    constraints.push(fatigue);
  }

  if (signal.soreness === 'moderate' || signal.soreness === 'high') {
    const bodyPart = signal.bodyPart?.trim().toLowerCase();
    const bucket = bodyPart ? resolveInjuryBucket(bodyPart) : null;
    if (bodyPart && bucket) {
      const soreness: ActiveSorenessConstraint = {
        ...baseFields(signal, `soreness-${bucket}`, `${capitalise(bodyPart)} soreness`),
        type: 'soreness',
        bodyPart,
        bucket,
        severity: signal.soreness === 'high' ? 7 : 6,
        rules:
          signal.soreness === 'high'
            ? [`avoid hard ${bodyPart} loading today`]
            : [`keep ${bodyPart} work pain-free today`],
        safeFocus: ['Pain-free strength', 'Easy aerobic conditioning', 'Mobility / recovery'],
        advice:
          signal.soreness === 'high'
            ? ["If it feels like pain or doesn't settle, tell coach a pain score."]
            : [],
      };
      constraints.push(soreness);
    } else {
      const sorenessLoad: ActiveFatigueConstraint = {
        ...baseFields(signal, 'general-soreness', 'General soreness'),
        type: 'fatigue',
        severity: signal.soreness === 'high' ? 7 : 5,
        rules:
          signal.soreness === 'high'
            ? ['max-effort lifts', 'sprinting / plyos']
            : ['max-effort lifts', 'extra hard conditioning'],
        safeFocus: ['Easy aerobic conditioning', 'Mobility / recovery', 'Light technique work'],
        advice:
          signal.soreness === 'high'
            ? ["If it feels like pain or doesn't settle, update coach with the body area."]
            : [],
      };
      constraints.push(sorenessLoad);
    }
  }

  if (typeof signal.timeAvailableMinutes === 'number' && signal.timeAvailableMinutes < 35) {
    const shortTime: ActiveScheduleConstraint = {
      ...baseFields(signal, 'short-time', 'Short time'),
      type: 'schedule',
      severity: signal.timeAvailableMinutes < 20 ? 7 : 5,
      rules: ['long accessory blocks', 'extra optional work'],
      safeFocus: ['Main lift / main conditioning stimulus', '1-2 key accessories', 'Short warm-up + exit'],
      advice: [],
      maxSessionsThisWeek: undefined,
    };
    constraints.push(shortTime);
  }

  return constraints;
}

function capitalise(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function isReadinessConstraint(c: ActiveConstraint | null | undefined): boolean {
  return !!c?.id?.startsWith(READINESS_CONSTRAINT_PREFIX);
}

export function constraintAppliesToDate(c: ActiveConstraint | any, date: string): boolean {
  const target = date.slice(0, 10);
  if (typeof c?.expiresAt === 'string' && c.expiresAt.slice(0, 10) < target) return false;
  if (typeof c?.appliesToDate === 'string') return c.appliesToDate.slice(0, 10) === target;
  // Week-scoped schedule modifiers must not rewrite an earlier block merely
  // because their expiry is later. This also keeps future readiness/injury
  // reports from time-travelling into already-authored weeks.
  const starts = typeof c?.weekStartISO === 'string'
    ? c.weekStartISO.slice(0, 10)
    : typeof c?.startDate === 'string'
      ? c.startDate.slice(0, 10)
      : null;
  if (starts && starts > target) return false;
  return true;
}

export function filterConstraintsForDate<T extends ActiveConstraint | any>(
  constraints: T[],
  date: string,
): T[] {
  return constraints.filter((c) => constraintAppliesToDate(c, date));
}
