import { programmingAuditCatalogueIdentity } from './programmingAuditIdentity';

export type ProgrammingYearContentBucket =
  | 'mainStrength'
  | 'power'
  | 'core'
  | 'prehab'
  | 'mobilityRecovery'
  | 'conditioning'
  | 'unclassified';

export interface ProgrammingYearVisibleRow {
  readonly name: string;
  readonly catalogueIdentity?: string;
  readonly role?: string;
}

export interface ProgrammingYearVisibleDay {
  readonly date: string;
  readonly type?: string | null;
  readonly tier?: string | null;
  readonly rows?: readonly ProgrammingYearVisibleRow[];
  readonly warmup?: readonly ProgrammingYearVisibleRow[];
}

export interface ProgrammingYearRowSummary {
  readonly unit: 'athlete-visible row placements';
  readonly mainSessionRows: number;
  readonly movementPrepRows: number;
  readonly totalAthleteVisibleRows: number;
  readonly mainSessionRowsByContent: Readonly<Record<ProgrammingYearContentBucket, number>>;
  /** Orthogonal to content: these rows remain in their content bucket too. */
  readonly optionalSessionRows: number;
  readonly optionalSessionDays: number;
  readonly duplicateCanonicalRows: readonly {
    readonly date: string;
    readonly catalogueIdentity: string;
    readonly occurrences: number;
  }[];
}

/**
 * One audit owner for the workload headline and its content explanation.
 *
 * Content buckets partition the final session rows. Optionality is deliberately
 * reported as a second axis: Primer and Gunshow still contain power/core/prehab
 * or strength rows, and hiding that content behind an `optional` bucket would
 * make the gender explanation less truthful rather than more precise.
 */
export function summarizeProgrammingYearRows(
  days: readonly ProgrammingYearVisibleDay[],
): ProgrammingYearRowSummary {
  const mainSessionRowsByContent: Record<ProgrammingYearContentBucket, number> = {
    mainStrength: 0,
    power: 0,
    core: 0,
    prehab: 0,
    mobilityRecovery: 0,
    conditioning: 0,
    unclassified: 0,
  };
  const duplicateCanonicalRows: Array<{
    date: string;
    catalogueIdentity: string;
    occurrences: number;
  }> = [];
  let mainSessionRows = 0;
  let movementPrepRows = 0;
  let optionalSessionRows = 0;
  let optionalSessionDays = 0;

  for (const day of days) {
    const rows = day.rows ?? [];
    mainSessionRows += rows.length;
    movementPrepRows += day.warmup?.length ?? 0;
    if (day.tier === 'optional') {
      optionalSessionDays += 1;
      optionalSessionRows += rows.length;
    }

    const canonicalCounts = new Map<string, number>();
    for (const row of rows) {
      const identity = programmingAuditCatalogueIdentity(row);
      canonicalCounts.set(identity, (canonicalCounts.get(identity) ?? 0) + 1);

      const bucket: ProgrammingYearContentBucket = day.type === 'Mobility' || day.tier === 'recovery'
        ? 'mobilityRecovery'
        : row.role === 'power'
          ? 'power'
          : row.role === 'midline'
            ? 'core'
            : row.role === 'prehab'
              ? 'prehab'
              : row.role === 'conditioning'
                ? 'conditioning'
                : row.role === 'main_lift' || row.role === 'accessory'
                  ? 'mainStrength'
                  : 'unclassified';
      mainSessionRowsByContent[bucket] += 1;
    }
    for (const [catalogueIdentity, occurrences] of canonicalCounts) {
      if (occurrences > 1) duplicateCanonicalRows.push({
        date: day.date, catalogueIdentity, occurrences,
      });
    }
  }

  return {
    unit: 'athlete-visible row placements',
    mainSessionRows,
    movementPrepRows,
    totalAthleteVisibleRows: mainSessionRows + movementPrepRows,
    mainSessionRowsByContent,
    optionalSessionRows,
    optionalSessionDays,
    duplicateCanonicalRows,
  };
}
