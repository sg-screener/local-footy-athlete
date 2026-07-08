import type {
  ActiveConstraint,
  ActiveFatigueConstraint,
  ActiveSorenessConstraint,
  ActiveScheduleConstraint,
} from '../store/coachUpdatesStore';
import type { ReadinessSignal } from './readiness';
import { resolveInjuryBucket } from './programAdjustmentEngine';

export const READINESS_CONSTRAINT_PREFIX = 'readiness:';

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
      severity: signal.flatToday ? 7 : 5,
      rules: ['max-effort lifts', 'hard conditioning + sprints'],
      safeFocus: ['Easy aerobic conditioning', 'Recovery + mobility', 'Light technique work'],
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
  if (typeof c?.expiresAt === 'string' && c.expiresAt < date) return false;
  return !c?.appliesToDate || c.appliesToDate === date;
}

export function filterConstraintsForDate<T extends ActiveConstraint | any>(
  constraints: T[],
  date: string,
): T[] {
  return constraints.filter((c) => constraintAppliesToDate(c, date));
}
