import { deriveSessionLoad, journalWeekStartOf, type JournalLoadSessionInput } from './journalLoad';
import { filterProgressPeriod, progressLoadComparison } from './progressPeriod';

export interface ProgressLoadRecord extends JournalLoadSessionInput {
  readonly completion?: string;
  readonly notes?: string;
  readonly components?: readonly { kind: string; label: string; completion: string }[];
}
export interface ProgressLoadPart {
  readonly label: string;
  readonly minutes: number | null;
  readonly effort: number | null;
  readonly value: number | null;
}
export interface ProgressLoadSession {
  readonly date: string;
  readonly weekStart: string;
  readonly title: string;
  readonly value: number;
  readonly measured: boolean;
  readonly parts: readonly ProgressLoadPart[];
  readonly record: ProgressLoadRecord;
}
export interface ProgressLoadWeek {
  readonly weekStart: string;
  readonly value: number;
  readonly measured: boolean;
  readonly sessions: readonly ProgressLoadSession[];
}

/** Read-only presentation of the same canonical component AU used by Progress. */
export function buildProgressLoadHistory(records: readonly ProgressLoadRecord[], asOfDateISO: string): readonly ProgressLoadWeek[] {
  const byWeek = new Map<string, ProgressLoadSession[]>();
  const measuredWeeks = new Set<string>();
  const dated = filterProgressPeriod(records, { startDateISO: '1900-01-01', endDateISO: asOfDateISO }, record => record.date);
  for (const record of dated) {
    const weekStart = journalWeekStartOf(record.date)!;
    const load = deriveSessionLoad(record);
    if (load.measured) measuredWeeks.add(weekStart);
    const parts: ProgressLoadPart[] = [];
    if (record.strength.length || record.actualMinutes != null || record.components?.some(part => part.kind === 'strength')) {
      parts.push({ label: 'Strength', minutes: record.actualMinutes ?? null, effort: record.difficulty ?? null, value: load.strengthSRPE });
    }
    if (record.conditioning) parts.push({ label: record.conditioning.sessionName || 'Conditioning', minutes: record.conditioning.totalTimeMinutes ?? null, effort: record.conditioning.rpe ?? null, value: load.conditioningSRPE });
    if (record.teamTraining) parts.push({ label: 'Team training', minutes: record.teamTraining.durationMinutes, effort: record.teamTraining.effort, value: load.teamTrainingSRPE });
    if (record.game) parts.push({ label: 'Game', minutes: record.game.timeOnGroundMinutes, effort: record.game.bodyRpe, value: load.gameSRPE });
    const title = parts.length ? parts.map(part => part.label).join(' + ')
      : record.components?.map(part => part.label).join(' + ') || 'Recorded session';
    const session = { date: record.date, weekStart, title, value: load.completedLoadAU,
      measured: parts.some(part => part.value !== null), parts, record };
    byWeek.set(weekStart, [...(byWeek.get(weekStart) ?? []), session]);
  }
  return [...byWeek.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([weekStart, sessions]) => ({
    weekStart, value: sessions.reduce((total, session) => total + session.value, 0),
    // Match the dashboard's measured-week inclusion, including old tonnage-only records.
    measured: measuredWeeks.has(weekStart),
    sessions: sessions.sort((a, b) => a.date.localeCompare(b.date)),
  }));
}

export function progressLoadWeekBaseline(weeks: readonly ProgressLoadWeek[], selected: ProgressLoadWeek | undefined) {
  if (!selected?.sessions.some(session => session.measured)) return null;
  const measured = weeks.filter(week => week.measured);
  const comparison = progressLoadComparison(measured, selected, '4w');
  if (!selected || !comparison) return null;
  const start = Date.parse(`${selected.weekStart}T00:00:00Z`) - 28 * 86400000;
  const prior = measured.filter(week => Date.parse(`${week.weekStart}T00:00:00Z`) >= start && week.weekStart < selected.weekStart);
  return { average: prior.reduce((total, week) => total + week.value, 0) / 4, ...comparison };
}
