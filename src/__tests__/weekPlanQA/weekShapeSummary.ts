import type { SeasonPhase, WeekKind } from '../../types/domain';
import type { ResolvedDay } from '../../utils/sessionResolver';
import type { WeekValidationReport } from '../../rules/weekStructureValidator';
import type { ClassifiedDay, ClassifiedUnit } from '../../rules/weeklyExposureCounts';

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export type WeekShapeDayLabel = (typeof DAY_SHORT)[number];

export interface WeekShapeCountsSummary {
  hardDays: number;
  mainStrength: number;
  conditioning: number;
  running: number;
  sprintCod: number;
}

export interface WeekShapeSnapshot {
  days: Partial<Record<WeekShapeDayLabel, string>>;
  tiers: Partial<Record<WeekShapeDayLabel, string>>;
  counts: WeekShapeCountsSummary | null;
  anchors: {
    teamTrainingDays: WeekShapeDayLabel[];
    fixtureDays: WeekShapeDayLabel[];
    fixtureLabel: string;
  };
  hardDays: WeekShapeDayLabel[];
  gMinusOneLightDays: WeekShapeDayLabel[];
  stackedDays: string[];
  weekKind: string;
}

export interface WeekShapeSummaryInput {
  resolvedWeek: ResolvedDay[] | null;
  validationReport: WeekValidationReport | null;
  seasonPhase?: SeasonPhase;
  gameDay?: string;
  teamTrainingDays?: readonly string[];
  weekKind?: WeekKind | null;
}

function dateAtNoon(dateISO: string): Date {
  return new Date(`${dateISO}T12:00:00Z`);
}

function addDaysISO(dateISO: string, days: number): string {
  const date = dateAtNoon(dateISO);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dayLabelFromDate(dateISO: string): WeekShapeDayLabel {
  return DAY_SHORT[dateAtNoon(dateISO).getUTCDay()] ?? 'Mon';
}

function compactList(labels: readonly string[]): string {
  return labels.length > 0 ? labels.join(', ') : 'none';
}

function capitalize(value: string): string {
  return value.length > 0 ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}

function truncate(value: string, max = 54): string {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

function categoryLabel(unit: Pick<ClassifiedUnit, 'category'>, phase?: SeasonPhase): string {
  switch (unit.category) {
    case 'lower_strength': return 'lower strength';
    case 'upper_strength': return 'upper strength';
    case 'full_body_strength': return 'full body strength';
    case 'gunshow_prehab': return 'gunshow/prehab';
    case 'recovery': return 'recovery';
    case 'rest': return 'rest';
    case 'aerobic_base': return 'easy conditioning';
    case 'tempo_conditioning': return 'tempo conditioning';
    case 'hard_conditioning': return 'hard conditioning';
    case 'sprint': return 'sprint/COD';
    case 'team_training': return 'team training';
    case 'game': return phase === 'Pre-season' ? 'practice match' : 'game';
    default: return 'other';
  }
}

function unitsLabel(day: ClassifiedDay | undefined, phase?: SeasonPhase): string {
  if (!day || day.units.length === 0) return 'rest';
  return day.units.map((unit) => categoryLabel(unit, phase)).join(' + ');
}

function tierLabel(day: ResolvedDay): string {
  return day.workout?.sessionTier ?? day.indicator ?? day.source;
}

function fixtureLabel(phase?: SeasonPhase): string {
  return phase === 'Pre-season' ? 'practice match' : 'game';
}

function configuredDayLabel(day: string): string {
  return day.slice(0, 3);
}

function anchorLine(input: WeekShapeSummaryInput): string {
  const anchors = input.validationReport?.anchorsUsed;
  const teamDates = anchors?.teamTrainingDates ?? [];
  const gameDates = anchors?.gameDates ?? [];
  const parts: string[] = [];

  if (teamDates.length > 0) {
    parts.push(`TT ${compactList(teamDates.map(dayLabelFromDate))}`);
  } else if (input.teamTrainingDays && input.teamTrainingDays.length > 0) {
    parts.push(`TT configured ${compactList(input.teamTrainingDays.map(configuredDayLabel))}`);
  }

  const fixture = fixtureLabel(input.seasonPhase);
  if (gameDates.length > 0) {
    parts.push(`${fixture} ${compactList(gameDates.map(dayLabelFromDate))}`);
  } else if (input.gameDay && input.gameDay !== 'none') {
    parts.push(`${fixture} configured ${configuredDayLabel(input.gameDay)}`);
  }

  return `  Anchors: ${parts.length > 0 ? parts.join('; ') : 'none'}`;
}

function stackedLine(report: WeekValidationReport | null, phase?: SeasonPhase): string {
  const stacked = stackedDayLabels(report, phase);
  return `  Stacked days: ${stacked.length > 0 ? stacked.join('; ') : 'none'}`;
}

function stackedDayLabels(report: WeekValidationReport | null, phase?: SeasonPhase): string[] {
  return (report?.counts.days ?? [])
    .filter((day) => day.units.length > 1)
    .map((day) => `${dayLabelFromDate(day.date)}: ${unitsLabel(day, phase)}`);
}

function isLightDay(day: ClassifiedDay | undefined): boolean {
  if (!day || day.units.length === 0) return true;
  return day.units.every((unit) =>
    unit.stress === 'low' ||
    unit.category === 'rest' ||
    unit.category === 'recovery' ||
    unit.category === 'gunshow_prehab'
  );
}

function noteLines(input: WeekShapeSummaryInput): string[] {
  const report = input.validationReport;
  const notes: string[] = [];
  const daysByDate = new Map((report?.counts.days ?? []).map((day) => [day.date, day]));
  const gameDates = report?.anchorsUsed.gameDates ?? [];
  const teamDates = report?.anchorsUsed.teamTrainingDates ?? [];

  if (input.seasonPhase === 'In-season' && gameDates.length === 0) {
    notes.push('In-season bye week: no game anchor this week.');
  }

  for (const gameDate of gameDates) {
    const gMinusOne = addDaysISO(gameDate, -1);
    const day = daysByDate.get(gMinusOne);
    if (day && isLightDay(day)) {
      notes.push(`${dayLabelFromDate(gMinusOne)} kept light before ${dayLabelFromDate(gameDate)} ${fixtureLabel(input.seasonPhase)}.`);
    }
  }

  const recoveryDays = (report?.counts.days ?? [])
    .filter((day) => day.units.some((unit) => unit.category === 'recovery'))
    .map((day) => dayLabelFromDate(day.date));
  if (recoveryDays.length > 0) {
    notes.push(`Recovery day(s): ${compactList(recoveryDays)}.`);
  }

  const sprintCodSources: string[] = [];
  if (teamDates.length > 0) sprintCodSources.push('team training');
  if (gameDates.length > 0) sprintCodSources.push(fixtureLabel(input.seasonPhase));
  if (sprintCodSources.length > 0) {
    const sourceText = sprintCodSources.join(' and ');
    const verb = sprintCodSources.length === 1 ? 'counts' : 'count';
    notes.push(`${capitalize(sourceText)} ${verb} as sprint/COD exposure.`);
  }

  return notes;
}

export function buildWeekShapeSnapshot(input: WeekShapeSummaryInput): WeekShapeSnapshot | null {
  if (!input.resolvedWeek) return null;

  const classifiedByDate = new Map((input.validationReport?.counts.days ?? []).map((day) => [day.date, day]));
  const days: Partial<Record<WeekShapeDayLabel, string>> = {};
  const tiers: Partial<Record<WeekShapeDayLabel, string>> = {};

  for (const day of input.resolvedWeek) {
    const label = dayLabelFromDate(day.date);
    days[label] = unitsLabel(classifiedByDate.get(day.date), input.seasonPhase);
    tiers[label] = tierLabel(day);
  }

  const counts = input.validationReport?.counts
    ? {
      hardDays: input.validationReport.counts.hardDays,
      mainStrength: input.validationReport.counts.mainStrengthExposures,
      conditioning: input.validationReport.counts.conditioningExposures,
      running: input.validationReport.counts.runningExposures,
      sprintCod: input.validationReport.counts.sprintCodExposures,
    }
    : null;

  const teamTrainingDates = input.validationReport?.anchorsUsed.teamTrainingDates ?? [];
  const gameDates = input.validationReport?.anchorsUsed.gameDates ?? [];
  const teamTrainingDays = teamTrainingDates.length > 0
    ? teamTrainingDates.map(dayLabelFromDate)
    : (input.teamTrainingDays ?? []).map((day) => configuredDayLabel(day) as WeekShapeDayLabel);
  const fixtureDays = gameDates.length > 0
    ? gameDates.map(dayLabelFromDate)
    : input.gameDay && input.gameDay !== 'none'
      ? [configuredDayLabel(input.gameDay) as WeekShapeDayLabel]
      : [];

  const daysByDate = new Map((input.validationReport?.counts.days ?? []).map((day) => [day.date, day]));
  const gMinusOneLightDays = gameDates
    .map((gameDate) => addDaysISO(gameDate, -1))
    .filter((date) => isLightDay(daysByDate.get(date)))
    .map(dayLabelFromDate);

  return {
    days,
    tiers,
    counts,
    anchors: {
      teamTrainingDays,
      fixtureDays,
      fixtureLabel: fixtureLabel(input.seasonPhase),
    },
    hardDays: (input.validationReport?.counts.days ?? [])
      .filter((day) => day.isHardDay)
      .map((day) => dayLabelFromDate(day.date)),
    gMinusOneLightDays,
    stackedDays: stackedDayLabels(input.validationReport, input.seasonPhase),
    weekKind: input.weekKind ?? 'unknown',
  };
}

export function buildWeekShapeSummaryLines(input: WeekShapeSummaryInput): string[] {
  if (!input.resolvedWeek) {
    return [
      '  WEEK SHAPE:',
      '  Week shape unavailable: resolver did not return a week.',
    ];
  }

  const classifiedByDate = new Map((input.validationReport?.counts.days ?? []).map((day) => [day.date, day]));
  const lines: string[] = ['  WEEK SHAPE:'];

  for (const day of [...input.resolvedWeek].sort((a, b) => a.date.localeCompare(b.date))) {
    const classified = classifiedByDate.get(day.date);
    const label = dayLabelFromDate(day.date);
    const session = day.workout ? truncate(day.workout.name) : 'Rest';
    lines.push(`  ${label}: ${unitsLabel(classified, input.seasonPhase)} (${tierLabel(day)}) - ${session}`);
  }

  const counts = input.validationReport?.counts;
  lines.push('');
  lines.push('  COUNTS:');
  if (counts) {
    lines.push(
      `  Hard days: ${counts.hardDays} | Main strength: ${counts.mainStrengthExposures} | Conditioning: ${counts.conditioningExposures} | Running: ${counts.runningExposures} | Sprint/COD: ${counts.sprintCodExposures} | Week kind: ${input.weekKind ?? 'unknown'}`
    );
  } else {
    lines.push(`  Counts unavailable | Week kind: ${input.weekKind ?? 'unknown'}`);
  }
  lines.push(anchorLine(input));
  lines.push(stackedLine(input.validationReport, input.seasonPhase));

  const notes = noteLines(input);
  lines.push('');
  lines.push('  NOTES:');
  if (notes.length === 0) {
    lines.push('  - none');
  } else {
    for (const note of notes) lines.push(`  - ${note}`);
  }

  return lines;
}

export function renderWeekShapeSummary(input: WeekShapeSummaryInput): string {
  return buildWeekShapeSummaryLines(input).join('\n');
}
