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
  // Canonical source facts already publish their one composed constraint.
  // Re-expanding the downstream ReadinessSignal alias would double-apply it.
  if ((signal.temporarySourceFactIds?.length ?? 0) > 0) return [];
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

  /* THE "SHORT ON TIME" READINESS CONSTRAINT IS DELETED (Sam, 2026-08-21).
   *
   * It only ever fired on `signal.timeAvailableMinutes`, and NOTHING WRITES
   * THAT — the one producer, `buildReadinessSignalPatch`, has zero production
   * callers, and no athlete control dispatches the `today_only` schedule
   * modifier the other door needed. Proven by
   * `npm run test:short-on-time-absent`, 8 cells.
   *
   * The comment that stood here was already right that time is a session fact
   * and not a readiness state — it was describing a door the athlete could no
   * longer open. The live time answer is the COACH's typed time-cap fact
   * (`createTemporaryTimeCapFact`, `sourceSurface: 'coach_chat'`), which does
   * not come through this function at all.
   */


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
