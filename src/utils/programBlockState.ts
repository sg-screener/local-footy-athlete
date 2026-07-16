import type { Microcycle, SeasonPhase, TrainingProgram, WeekKind } from '../types/domain';
import {
  resolveWeekIntensityMultiplier,
  resolveWeekKind,
} from '../rules/deloadWeekRules';
import {
  resolveSeasonPhaseClock,
  type SeasonPhaseClock,
  type SeasonPhaseClockResolution,
} from '../rules/seasonPhaseClock';
import { todayISOLocal } from './appDate';

export const WEEKS_PER_BLOCK = 4;
const DAYS_PER_WEEK = 7;
const DAYS_PER_BLOCK = WEEKS_PER_BLOCK * DAYS_PER_WEEK;

export interface BlockBounds {
  blockStart: string;
  blockEnd: string;
}

export interface ProgramBlockState {
  /** 1-based training block / mini-cycle number. */
  blockNumber: number;
  /** Alias used by the existing exercise-pool rotation layer. */
  miniCycleNumber: number;
  /** 1-based week within the current 4-week block. */
  weekInBlock: number;
  /** 1-based week number inside the active program. */
  weekNumber: number;
  /** Start and end of the 4-week block this week belongs to. */
  blockStart: string;
  blockEnd: string;
  /** Monday/Sunday bounds for this specific week. */
  weekStart: string;
  weekEnd: string;
  /** Metadata consumed by existing microcycle/progression machinery. */
  weekKind: WeekKind;
  /** Canonical phase-age result for this target calendar week. */
  phaseClock: SeasonPhaseClock;
  phaseResolution: SeasonPhaseClockResolution;
  phaseWeekNumber: number;
  intensityMultiplier: number;
  weeksSinceDeload: number;
  consecutiveBuildWeeks: number;
}

export interface StoredProgramBlockState {
  /** Monday ISO date for the block this program is currently using. */
  blockStartDate: string;
  /** 1-based block / mini-cycle number. */
  blockNumber: number;
}

export interface ProgramBlockRolloverStatus {
  needsRollover: boolean;
  targetDateISO: string;
  currentBlockStart: string | null;
  currentBlockEnd: string | null;
  currentBlockNumber: number | null;
  nextBlockStart: string | null;
  nextBlockEnd: string | null;
  nextBlockNumber: number | null;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function atNoon(dateISO: string): Date {
  return new Date(`${dateISO}T12:00:00`);
}

export function addDaysISO(dateISO: string, days: number): string {
  const d = atNoon(dateISO);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

function daysBetween(startISO: string, endISO: string): number {
  const start = atNoon(startISO);
  const end = atNoon(endISO);
  return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

function todayISO(): string {
  return todayISOLocal();
}

/**
 * Compute week-aligned block start (Monday) and end (Sunday) from any
 * start date. The start week counts as week 1; total span is 4 Mon-Sun weeks.
 */
export function computeBlockBounds(startDate: Date): BlockBounds {
  const dow = startDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysToMonday = dow === 0 ? -6 : -(dow - 1);
  const monday = new Date(startDate);
  monday.setDate(startDate.getDate() + daysToMonday);
  monday.setHours(12, 0, 0, 0);

  const endSunday = new Date(monday);
  endSunday.setDate(monday.getDate() + DAYS_PER_BLOCK - 1);
  endSunday.setHours(12, 0, 0, 0);

  return {
    blockStart: formatDate(monday),
    blockEnd: formatDate(endSunday),
  };
}

export function getMondayISOForDate(dateISO: string): string {
  const d = atNoon(dateISO);
  const dow = d.getDay(); // 0=Sun
  const mondayOffset = dow === 0 ? -6 : -(dow - 1);
  d.setDate(d.getDate() + mondayOffset);
  return formatDate(d);
}

/** First Monday strictly after the supplied date. */
export function getNextMondayAfterDate(dateISO: string): string {
  return addDaysISO(getMondayISOForDate(dateISO), DAYS_PER_WEEK);
}

/**
 * Pure end-of-block detection. The generated program window is authoritative:
 * week 4 remains active through its final Sunday and rollover begins only when
 * the selected/current date is after that boundary.
 */
export function getProgramBlockRolloverStatus(args: {
  program: TrainingProgram | null;
  dateISO: string;
  blockState?: StoredProgramBlockState | null;
}): ProgramBlockRolloverStatus {
  const targetDateISO = args.dateISO.split('T')[0];
  if (!args.program) {
    return {
      needsRollover: false,
      targetDateISO,
      currentBlockStart: null,
      currentBlockEnd: null,
      currentBlockNumber: null,
      nextBlockStart: null,
      nextBlockEnd: null,
      nextBlockNumber: null,
    };
  }

  const currentBlockStart = args.program.startDate.split('T')[0];
  const currentBlockEnd = args.program.endDate.split('T')[0];
  const currentBlockNumber = Math.max(
    1,
    Math.floor(
      args.blockState?.blockNumber ??
      args.program.microcycles?.[0]?.miniCycleNumber ??
      1,
    ),
  );
  const nextBlockStart = getNextMondayAfterDate(currentBlockEnd);
  const nextBlockEnd = addDaysISO(nextBlockStart, DAYS_PER_BLOCK - 1);

  return {
    needsRollover: targetDateISO > currentBlockEnd,
    targetDateISO,
    currentBlockStart,
    currentBlockEnd,
    currentBlockNumber,
    nextBlockStart,
    nextBlockEnd,
    nextBlockNumber: currentBlockNumber + 1,
  };
}

function getWeekOffset(blockStartDate: string, dateISO: string): number {
  const blockMonday = getMondayISOForDate(blockStartDate.split('T')[0]);
  const dateMonday = getMondayISOForDate(dateISO.split('T')[0]);
  return Math.max(0, Math.floor(daysBetween(blockMonday, dateMonday) / DAYS_PER_WEEK));
}

export function getWeekInBlock(blockStartDate: string, dateISO: string): number {
  return (getWeekOffset(blockStartDate, dateISO) % WEEKS_PER_BLOCK) + 1;
}

export function getWeeksSinceDeload(blockStartDate: string, dateISO: string): number {
  return getWeekInBlock(blockStartDate, dateISO) - 1;
}

export function getBlockNumberForDate(
  blockStartDate: string,
  blockNumber: number,
  dateISO: string,
): number {
  const baseBlockNumber = Math.max(1, Math.floor(blockNumber || 1));
  return baseBlockNumber + Math.floor(getWeekOffset(blockStartDate, dateISO) / WEEKS_PER_BLOCK);
}

export function resolveIntensityMultiplier(
  seasonPhase: SeasonPhase | null | undefined,
  phaseWeekNumber: number,
): number {
  return resolveWeekIntensityMultiplier(
    seasonPhase,
    resolveWeekKind(seasonPhase, phaseWeekNumber),
  );
}

function phaseProgressionCounters(
  seasonPhase: SeasonPhase | null | undefined,
  phaseWeekNumber: number,
  fallbackWeekInBlock: number,
): { weeksSinceDeload: number; consecutiveBuildWeeks: number } {
  const cycleWeek = seasonPhase === 'Pre-season'
    ? ((phaseWeekNumber - 1) % WEEKS_PER_BLOCK) + 1
    : seasonPhase === 'Off-season' && phaseWeekNumber > WEEKS_PER_BLOCK
      ? ((phaseWeekNumber - WEEKS_PER_BLOCK - 1) % WEEKS_PER_BLOCK) + 1
      : seasonPhase === 'Off-season'
        ? phaseWeekNumber
        : fallbackWeekInBlock;
  return {
    weeksSinceDeload: Math.max(0, cycleWeek - 1),
    consecutiveBuildWeeks: Math.max(0, cycleWeek - 1),
  };
}

function clockFromEffectiveStart(
  selectedPhase: SeasonPhase,
  effectiveWeekStartISO: string,
  persistedClock?: SeasonPhaseClock | null,
): SeasonPhaseClock {
  return persistedClock ?? resolveSeasonPhaseClock({
    selectedPhase,
    targetWeekStartISO: effectiveWeekStartISO,
  }).clock;
}

export function getProgramBlockStateForDate(args: {
  dateISO: string;
  programStartISO: string;
  blockNumber?: number;
  seasonPhase?: SeasonPhase | null;
  seasonPhaseClock?: SeasonPhaseClock | null;
}): ProgramBlockState {
  const programStart = args.programStartISO.split('T')[0];
  const anchorBounds = computeBlockBounds(atNoon(programStart));
  const offsetWeeks = getWeekOffset(anchorBounds.blockStart, args.dateISO);
  const blockIndex = Math.floor(offsetWeeks / WEEKS_PER_BLOCK);
  const weekInBlock = (offsetWeeks % WEEKS_PER_BLOCK) + 1;
  const blockNumber = Math.max(1, Math.floor(args.blockNumber ?? 1)) + blockIndex;
  const weekNumber = (blockNumber - 1) * WEEKS_PER_BLOCK + weekInBlock;
  const blockStart = addDaysISO(anchorBounds.blockStart, blockIndex * DAYS_PER_BLOCK);
  const blockEnd = addDaysISO(blockStart, DAYS_PER_BLOCK - 1);
  const weekStart = addDaysISO(blockStart, (weekInBlock - 1) * DAYS_PER_WEEK);
  const weekEnd = addDaysISO(weekStart, DAYS_PER_WEEK - 1);

  const seasonPhase = args.seasonPhase ?? args.seasonPhaseClock?.selectedPhase ?? 'In-season';
  const seasonPhaseClock = clockFromEffectiveStart(
    seasonPhase,
    anchorBounds.blockStart,
    args.seasonPhaseClock,
  );
  const phaseResolution = resolveSeasonPhaseClock({
    selectedPhase: seasonPhase,
    targetWeekStartISO: weekStart,
    persistedClock: seasonPhaseClock,
  });
  const weekKind = phaseResolution.weekKind;
  const counters = phaseProgressionCounters(seasonPhase, phaseResolution.phaseWeekNumber, weekInBlock);
  return {
    blockNumber,
    miniCycleNumber: blockNumber,
    weekInBlock,
    weekNumber,
    blockStart,
    blockEnd,
    weekStart,
    weekEnd,
    weekKind,
    phaseClock: phaseResolution.clock,
    phaseResolution,
    phaseWeekNumber: phaseResolution.phaseWeekNumber,
    intensityMultiplier: resolveWeekIntensityMultiplier(seasonPhase, weekKind),
    ...counters,
  };
}

export function deriveStoredBlockStateFromProgram(
  program: TrainingProgram | null,
  dateISO: string = todayISO(),
): StoredProgramBlockState {
  const sourceDate = program?.startDate ?? program?.createdAt ?? dateISO;
  const blockStartDate = computeBlockBounds(atNoon(sourceDate.split('T')[0])).blockStart;
  const blockNumber = Math.max(1, Math.floor(program?.microcycles?.[0]?.miniCycleNumber ?? 1));
  return { blockStartDate, blockNumber };
}

export function getStoredBlockStateForDate(
  state: StoredProgramBlockState,
  dateISO: string,
  seasonPhase?: SeasonPhase | null,
  seasonPhaseClock?: SeasonPhaseClock | null,
): ProgramBlockState {
  const weekInBlock = getWeekInBlock(state.blockStartDate, dateISO);
  const blockNumber = getBlockNumberForDate(state.blockStartDate, state.blockNumber, dateISO);
  const blockOffset = blockNumber - state.blockNumber;
  const blockStart = addDaysISO(
    getMondayISOForDate(state.blockStartDate),
    blockOffset * DAYS_PER_BLOCK,
  );
  const blockEnd = addDaysISO(blockStart, DAYS_PER_BLOCK - 1);
  const weekStart = addDaysISO(blockStart, (weekInBlock - 1) * DAYS_PER_WEEK);
  const weekEnd = addDaysISO(weekStart, DAYS_PER_WEEK - 1);
  const selectedPhase = seasonPhase ?? seasonPhaseClock?.selectedPhase ?? 'In-season';
  const effectiveClock = clockFromEffectiveStart(
    selectedPhase,
    state.blockStartDate,
    seasonPhaseClock,
  );
  const phaseResolution = resolveSeasonPhaseClock({
    selectedPhase,
    targetWeekStartISO: weekStart,
    persistedClock: effectiveClock,
  });
  const weekKind = phaseResolution.weekKind;
  const counters = phaseProgressionCounters(selectedPhase, phaseResolution.phaseWeekNumber, weekInBlock);
  return {
    blockNumber,
    miniCycleNumber: blockNumber,
    weekInBlock,
    weekNumber: (blockNumber - 1) * WEEKS_PER_BLOCK + weekInBlock,
    blockStart,
    blockEnd,
    weekStart,
    weekEnd,
    weekKind,
    phaseClock: phaseResolution.clock,
    phaseResolution,
    phaseWeekNumber: phaseResolution.phaseWeekNumber,
    intensityMultiplier: resolveWeekIntensityMultiplier(selectedPhase, weekKind),
    ...counters,
  };
}

export function buildBlockWeekStates(args: {
  blockStartISO: string;
  blockNumber?: number;
  seasonPhase?: SeasonPhase | null;
  seasonPhaseClock?: SeasonPhaseClock | null;
}): ProgramBlockState[] {
  const blockNumber = Math.max(1, Math.floor(args.blockNumber ?? 1));
  const blockEnd = addDaysISO(args.blockStartISO, DAYS_PER_BLOCK - 1);
  const selectedPhase = args.seasonPhase ?? args.seasonPhaseClock?.selectedPhase ?? 'In-season';
  const seasonPhaseClock = clockFromEffectiveStart(
    selectedPhase,
    args.blockStartISO,
    args.seasonPhaseClock,
  );
  return Array.from({ length: WEEKS_PER_BLOCK }, (_, index) => {
    const weekInBlock = index + 1;
    const weekStart = addDaysISO(args.blockStartISO, index * DAYS_PER_WEEK);
    const weekEnd = addDaysISO(weekStart, DAYS_PER_WEEK - 1);
    const phaseResolution = resolveSeasonPhaseClock({
      selectedPhase,
      targetWeekStartISO: weekStart,
      persistedClock: seasonPhaseClock,
    });
    const weekKind = phaseResolution.weekKind;
    const counters = phaseProgressionCounters(selectedPhase, phaseResolution.phaseWeekNumber, weekInBlock);
    return {
      blockNumber,
      miniCycleNumber: blockNumber,
      weekInBlock,
      weekNumber: (blockNumber - 1) * WEEKS_PER_BLOCK + weekInBlock,
      blockStart: args.blockStartISO,
      blockEnd,
      weekStart,
      weekEnd,
      weekKind,
      phaseClock: phaseResolution.clock,
      phaseResolution,
      phaseWeekNumber: phaseResolution.phaseWeekNumber,
      intensityMultiplier: resolveWeekIntensityMultiplier(selectedPhase, weekKind),
      ...counters,
    };
  });
}

export function selectMicrocycleForDate(
  program: TrainingProgram | null,
  fallbackMicrocycle: Microcycle | null,
  dateISO: string,
): Microcycle | null {
  const microcycles = program?.microcycles ?? [];
  const exact = microcycles.find((mc) => {
    const start = mc.startDate.split('T')[0];
    const end = mc.endDate.split('T')[0];
    return dateISO >= start && dateISO <= end;
  });
  if (exact) return exact;

  if (microcycles.length === 1) return microcycles[0];
  return fallbackMicrocycle;
}
