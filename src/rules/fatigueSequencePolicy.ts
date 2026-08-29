/** Pure dated-fatigue policy. Saved reports are inputs; no streak counter is stored. */

export type FatigueReportLevel = 'slight' | 'moderate' | 'cooked';
export type FatigueDayEffect = 'none' | 'lighter' | 'deload' | 'rest';

export interface DatedFatigueReport {
  readonly dateISO: string;
  readonly level: FatigueReportLevel;
  readonly factId?: string;
}

export interface FatigueDayPolicy {
  readonly dateISO: string;
  readonly effect: FatigueDayEffect;
  readonly consecutiveTrigger: boolean;
  readonly triggerDateISO: string | null;
  readonly deloadThroughISO: string | null;
  readonly sourceFactIds: readonly string[];
}

const LEVEL_RANK: Readonly<Record<FatigueReportLevel, number>> = {
  slight: 1,
  moderate: 2,
  cooked: 3,
};

function addDaysISO(dateISO: string, days: number): string {
  const [year, month, day] = dateISO.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function sundayFor(dateISO: string): string {
  const date = new Date(`${dateISO.slice(0, 10)}T12:00:00Z`);
  const day = date.getUTCDay();
  return addDaysISO(dateISO, day === 0 ? 0 : 7 - day);
}

/** One report per calendar day. A repeat tap cannot create a streak. */
function strongestByDate(reports: readonly DatedFatigueReport[]): Map<string, DatedFatigueReport> {
  const byDate = new Map<string, DatedFatigueReport>();
  for (const raw of reports) {
    const report = { ...raw, dateISO: raw.dateISO.slice(0, 10) };
    const prior = byDate.get(report.dateISO);
    if (!prior || LEVEL_RANK[report.level] > LEVEL_RANK[prior.level]) byDate.set(report.dateISO, report);
  }
  return byDate;
}

/**
 * Any two consecutive reported dates open a deload on the second date through
 * Sunday. Cooked always wins on its own date and removes that day's session.
 */
export function resolveFatigueDayPolicy(
  reports: readonly DatedFatigueReport[],
  dateISO: string,
): FatigueDayPolicy {
  const date = dateISO.slice(0, 10);
  const byDate = strongestByDate(reports);
  const triggers = [...byDate.keys()].sort().filter((candidate) =>
    byDate.has(addDaysISO(candidate, -1)));
  const activeTrigger = [...triggers].reverse().find((trigger) =>
    date >= trigger && date <= sundayFor(trigger)) ?? null;
  const own = byDate.get(date);
  const ownIds = own?.factId ? [own.factId] : [];
  const pairIds = activeTrigger
    ? [byDate.get(addDaysISO(activeTrigger, -1))?.factId, byDate.get(activeTrigger)?.factId]
        .filter((id): id is string => !!id)
    : [];
  const effect: FatigueDayEffect = own?.level === 'cooked'
    ? 'rest'
    : activeTrigger
      ? 'deload'
      : own?.level === 'moderate'
        ? 'lighter'
        : 'none';
  return {
    dateISO: date,
    effect,
    consecutiveTrigger: triggers.includes(date),
    triggerDateISO: activeTrigger,
    deloadThroughISO: activeTrigger ? sundayFor(activeTrigger) : null,
    sourceFactIds: Array.from(new Set([...ownIds, ...pairIds])).sort(),
  };
}

export function fatiguePoliciesForWeek(
  reports: readonly DatedFatigueReport[],
  weekStartISO: string,
): readonly FatigueDayPolicy[] {
  return Array.from({ length: 7 }, (_, offset) =>
    resolveFatigueDayPolicy(reports, addDaysISO(weekStartISO, offset)));
}
