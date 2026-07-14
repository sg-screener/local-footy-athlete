import type {
  SeasonPhase,
  TrainingProgram,
  WeekKind,
} from '../types/domain';

export type CanonicalOffseasonSubphase =
  | 'early_offseason'
  | 'mid_offseason'
  | 'late_offseason';

export type CanonicalPreseasonSubphase =
  | 'early_preseason'
  | 'mid_preseason'
  | 'late_preseason';

export const SEASON_PHASE_CLOCK_VERSION = 1 as const;

export type SeasonPhaseClockOriginProvenance =
  | 'explicit_user_phase_change'
  | 'deterministic_legacy_migration';

export type SeasonPhaseClockResolutionProvenance =
  | SeasonPhaseClockOriginProvenance
  | 'preserved_persisted_state';

/**
 * Persisted source of truth for continuous time inside a user-selected phase.
 * Block and program counters deliberately do not appear in this model.
 */
export interface SeasonPhaseClock {
  protocolVersion: typeof SEASON_PHASE_CLOCK_VERSION;
  selectedPhase: SeasonPhase;
  phaseEntryWeekStartISO: string;
  originProvenance: SeasonPhaseClockOriginProvenance;
  /** Documents that subsequent writes preserve, rather than recreate, this clock. */
  persistenceProvenance: 'preserved_persisted_state';
}

export type ResolvedSeasonSubphase =
  | CanonicalOffseasonSubphase
  | CanonicalPreseasonSubphase
  | null;

export interface SeasonPhaseClockResolution {
  clock: SeasonPhaseClock;
  targetWeekStartISO: string;
  completedPhaseWeeks: number;
  phaseWeekNumber: number;
  subphase: ResolvedSeasonSubphase;
  offseasonSubphase: CanonicalOffseasonSubphase | null;
  preseasonSubphase: CanonicalPreseasonSubphase | null;
  weekKind: WeekKind;
  firstOffseasonBlock: boolean;
  laterOffseasonDeloadEligible: boolean;
  provenance: SeasonPhaseClockResolutionProvenance;
}

export interface ResolveSeasonPhaseClockInput {
  selectedPhase: SeasonPhase;
  targetWeekStartISO: string;
  persistedClock?: SeasonPhaseClock | null;
  /** Existing persisted program, used only when migrating a missing clock. */
  legacyProgram?: TrainingProgram | null;
}

export function resolveSeasonSubphaseAtPhaseWeek(
  selectedPhase: SeasonPhase,
  phaseWeekNumber: number,
): ResolvedSeasonSubphase {
  if (selectedPhase === 'Off-season') {
    if (phaseWeekNumber <= 2) return 'early_offseason';
    if (phaseWeekNumber <= 4) return 'mid_offseason';
    return 'late_offseason';
  }
  if (selectedPhase === 'Pre-season') {
    if (phaseWeekNumber === 1) return 'early_preseason';
    if (phaseWeekNumber <= 3) return 'mid_preseason';
    return 'late_preseason';
  }
  return null;
}

export function resolveSeasonPhaseWeekKind(
  selectedPhase: SeasonPhase | null | undefined,
  phaseWeekNumber: number,
): WeekKind {
  if (selectedPhase === 'Pre-season' && phaseWeekNumber % 4 === 0) return 'deload';
  if (
    selectedPhase === 'Off-season' &&
    phaseWeekNumber > 4 &&
    (phaseWeekNumber - 4) % 4 === 0
  ) {
    return 'deload';
  }
  return 'build';
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;

function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseLocalDate(dateISO: string): Date | null {
  const match = DATE_ONLY_PATTERN.exec(String(dateISO ?? ''));
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function localCalendarDayNumber(dateISO: string): number | null {
  const match = DATE_ONLY_PATTERN.exec(String(dateISO ?? ''));
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const dayNumber = Date.UTC(year, monthIndex, day) / DAY_MS;
  const calendarDate = new Date(dayNumber * DAY_MS);

  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== monthIndex ||
    calendarDate.getUTCDate() !== day
  ) {
    return null;
  }

  return dayNumber;
}

/** App-local Monday for a date; no UTC conversion and no wall-clock dependency. */
export function phaseClockMondayISO(dateISO: string): string {
  const date = parseLocalDate(dateISO);
  if (!date) throw new Error(`Invalid phase-clock date: ${dateISO}`);
  const offset = date.getDay() === 0 ? -6 : 1 - date.getDay();
  date.setDate(date.getDate() + offset);
  return formatLocalDate(date);
}

function seasonPhaseForProgram(program: TrainingProgram | null | undefined): SeasonPhase | null {
  const value = String(program?.programPhase ?? '');
  if (/off|base/i.test(value)) return 'Off-season';
  if (/pre/i.test(value)) return 'Pre-season';
  if (/in/i.test(value)) return 'In-season';
  return null;
}

export function isValidSeasonPhaseClock(value: unknown): value is SeasonPhaseClock {
  if (!value || typeof value !== 'object') return false;
  const clock = value as Partial<SeasonPhaseClock>;
  return clock.protocolVersion === SEASON_PHASE_CLOCK_VERSION &&
    (clock.selectedPhase === 'Off-season' ||
      clock.selectedPhase === 'Pre-season' ||
      clock.selectedPhase === 'In-season') &&
    !!parseLocalDate(clock.phaseEntryWeekStartISO ?? '') &&
    (clock.originProvenance === 'explicit_user_phase_change' ||
      clock.originProvenance === 'deterministic_legacy_migration');
}

function migratedEntryWeek(
  program: TrainingProgram,
  targetWeekStartISO: string,
): string {
  // Exact precedence: the earliest valid effective start represented by the
  // program or one of its microcycles. If neither exists, use the target week.
  // createdAt/updatedAt are intentionally excluded: they are wall-clock audit
  // timestamps, not evidence of when the selected season phase became active.
  const microcycleStarts = (program.microcycles ?? [])
    .map((microcycle) => microcycle.startDate)
    .filter((date): date is string => !!parseLocalDate(date))
    .map(phaseClockMondayISO);
  const programStart = parseLocalDate(program.startDate)
    ? phaseClockMondayISO(program.startDate)
    : null;
  return [...microcycleStarts, ...(programStart ? [programStart] : [])]
    .sort()[0] ?? targetWeekStartISO;
}

function createClock(
  selectedPhase: SeasonPhase,
  phaseEntryWeekStartISO: string,
  originProvenance: SeasonPhaseClockOriginProvenance,
): SeasonPhaseClock {
  return {
    protocolVersion: SEASON_PHASE_CLOCK_VERSION,
    selectedPhase,
    phaseEntryWeekStartISO: phaseClockMondayISO(phaseEntryWeekStartISO),
    originProvenance,
    persistenceProvenance: 'preserved_persisted_state',
  };
}

export function establishSeasonPhaseClock(
  input: ResolveSeasonPhaseClockInput,
): { clock: SeasonPhaseClock; provenance: SeasonPhaseClockResolutionProvenance } {
  const targetWeekStartISO = phaseClockMondayISO(input.targetWeekStartISO);
  if (
    isValidSeasonPhaseClock(input.persistedClock) &&
    input.persistedClock.selectedPhase === input.selectedPhase
  ) {
    return {
      clock: {
        ...input.persistedClock,
        phaseEntryWeekStartISO: phaseClockMondayISO(input.persistedClock.phaseEntryWeekStartISO),
        persistenceProvenance: 'preserved_persisted_state',
      },
      provenance: 'preserved_persisted_state',
    };
  }

  const legacyPhase = seasonPhaseForProgram(input.legacyProgram);
  if (
    input.legacyProgram &&
    !isValidSeasonPhaseClock(input.persistedClock) &&
    legacyPhase === input.selectedPhase
  ) {
    return {
      clock: createClock(
        input.selectedPhase,
        migratedEntryWeek(input.legacyProgram, targetWeekStartISO),
        'deterministic_legacy_migration',
      ),
      provenance: 'deterministic_legacy_migration',
    };
  }

  // A different selected phase, or a genuinely new program, is an explicit
  // phase entry. The target week—not the current wall clock—is Phase Week 1.
  return {
    clock: createClock(
      input.selectedPhase,
      targetWeekStartISO,
      'explicit_user_phase_change',
    ),
    provenance: 'explicit_user_phase_change',
  };
}

export function resolveSeasonPhaseClock(
  input: ResolveSeasonPhaseClockInput,
): SeasonPhaseClockResolution {
  const targetWeekStartISO = phaseClockMondayISO(input.targetWeekStartISO);
  const established = establishSeasonPhaseClock({ ...input, targetWeekStartISO });
  // Calendar ordinals avoid DST-shortened or DST-lengthened local weeks. UTC
  // is used only for arithmetic over date components; neither instants nor the
  // current wall clock participate in the phase decision.
  const entryDay = localCalendarDayNumber(established.clock.phaseEntryWeekStartISO)!;
  const targetDay = localCalendarDayNumber(targetWeekStartISO)!;
  const completedPhaseWeeks = Math.max(
    0,
    Math.floor((targetDay - entryDay) / 7),
  );
  const phaseWeekNumber = completedPhaseWeeks + 1;

  const resolvedSubphase = resolveSeasonSubphaseAtPhaseWeek(input.selectedPhase, phaseWeekNumber);
  const offseasonSubphase = input.selectedPhase === 'Off-season'
    ? resolvedSubphase as CanonicalOffseasonSubphase
    : null;
  const preseasonSubphase = input.selectedPhase === 'Pre-season'
    ? resolvedSubphase as CanonicalPreseasonSubphase
    : null;

  const firstOffseasonBlock = input.selectedPhase === 'Off-season' && phaseWeekNumber <= 4;
  const lateOffseasonWeek = phaseWeekNumber - 4;
  const laterOffseasonDeloadEligible = input.selectedPhase === 'Off-season' &&
    phaseWeekNumber > 4 && lateOffseasonWeek % 4 === 0;
  const weekKind = resolveSeasonPhaseWeekKind(input.selectedPhase, phaseWeekNumber);

  return {
    clock: established.clock,
    targetWeekStartISO,
    completedPhaseWeeks,
    phaseWeekNumber,
    subphase: offseasonSubphase ?? preseasonSubphase,
    offseasonSubphase,
    preseasonSubphase,
    weekKind,
    firstOffseasonBlock,
    laterOffseasonDeloadEligible,
    provenance: established.provenance,
  };
}

/** Deterministic migration used at the persistence ingress boundary. */
export function ensureProgramSeasonPhaseClock(program: TrainingProgram): TrainingProgram {
  const selectedPhase = isValidSeasonPhaseClock(program.seasonPhaseClock)
    ? program.seasonPhaseClock.selectedPhase
    : seasonPhaseForProgram(program);
  if (!selectedPhase) return program;
  const targetWeekStartISO = parseLocalDate(program.startDate)
    ? phaseClockMondayISO(program.startDate)
    : (program.microcycles ?? []).map((microcycle) => microcycle.startDate).find(Boolean);
  if (!targetWeekStartISO) return program;
  const { clock } = establishSeasonPhaseClock({
    selectedPhase,
    targetWeekStartISO,
    persistedClock: program.seasonPhaseClock,
    legacyProgram: program,
  });
  return { ...program, seasonPhaseClock: clock };
}

export function seasonPhaseFromProgram(program: TrainingProgram | null | undefined): SeasonPhase | null {
  return isValidSeasonPhaseClock(program?.seasonPhaseClock)
    ? program.seasonPhaseClock.selectedPhase
    : seasonPhaseForProgram(program);
}
