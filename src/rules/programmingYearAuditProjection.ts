import { resolveTemplateByName } from './conditioningSelection';
import {
  programmingAuditCatalogueIdentity,
  programmingAuditRowRequiresCatalogueIdentity,
} from './programmingAuditIdentity';

export type ConditioningAuditCategory =
  | 'Continuous Aerobic'
  | 'Tempo'
  | 'Hard Intervals'
  | 'Flush';

export interface ProgrammingAuditExportRow {
  readonly name: string;
  readonly catalogueIdentity?: string;
  readonly role?: string;
  readonly modalityLabel?: string;
  readonly choices?: readonly {
    readonly modalityLabel?: string;
    readonly rows: readonly ProgrammingAuditExportRow[];
  }[];
}

export interface ProgrammingAuditExportDay {
  readonly date: string;
  readonly rows?: readonly ProgrammingAuditExportRow[];
  /** Typed evidence only. Never a second display source. */
  readonly speedRows?: readonly ProgrammingAuditExportRow[];
  readonly conditioningIdentity?: {
    readonly structureFamily?: string;
    readonly primaryLabel?: string;
  } | null;
}

export function flattenProgrammingAuditRows(
  rows: readonly ProgrammingAuditExportRow[],
  inheritedModality?: string,
): ProgrammingAuditExportRow[] {
  return rows.flatMap((row) => row.choices
    ? row.choices.flatMap((choice) => flattenProgrammingAuditRows(
      choice.rows, choice.modalityLabel ?? inheritedModality,
    ))
    : [{ ...row, modalityLabel: row.modalityLabel ?? inheritedModality }]);
}

/** The final athlete-facing projection has one owner: `day.rows`. */
export function finalAthleteFacingAuditRows(
  day: ProgrammingAuditExportDay,
): ProgrammingAuditExportRow[] {
  return flattenProgrammingAuditRows(day.rows ?? []);
}

export interface ProgrammingAuditProjectionFinding {
  readonly kind: 'duplicate_final_row' | 'speed_evidence_missing_from_final' | 'speed_modality_mismatch';
  readonly date: string;
  readonly catalogueIdentity: string;
  readonly occurrences?: number;
  readonly finalModality?: string;
  readonly evidenceModality?: string;
}

/**
 * Compare typed Speed evidence with the final projection without appending it.
 * This is the boundary the old PDF exporter broke by concatenating both arrays.
 */
export function programmingAuditProjectionFindings(
  day: ProgrammingAuditExportDay,
): ProgrammingAuditProjectionFinding[] {
  const finalRows = finalAthleteFacingAuditRows(day);
  const finalByIdentity = new Map<string, ProgrammingAuditExportRow[]>();
  for (const row of finalRows.filter(programmingAuditRowRequiresCatalogueIdentity)) {
    const identity = programmingAuditCatalogueIdentity(row);
    finalByIdentity.set(identity, [...(finalByIdentity.get(identity) ?? []), row]);
  }
  const findings: ProgrammingAuditProjectionFinding[] = [];
  for (const [catalogueIdentity, rows] of finalByIdentity) {
    if (rows.length > 1) findings.push({
      kind: 'duplicate_final_row', date: day.date, catalogueIdentity,
      occurrences: rows.length,
    });
  }
  for (const evidence of flattenProgrammingAuditRows(day.speedRows ?? [])) {
    const catalogueIdentity = programmingAuditCatalogueIdentity(evidence);
    const final = finalByIdentity.get(catalogueIdentity)?.[0];
    if (!final) {
      findings.push({
        kind: 'speed_evidence_missing_from_final', date: day.date, catalogueIdentity,
        evidenceModality: evidence.modalityLabel,
      });
    } else if (evidence.modalityLabel && final.modalityLabel !== evidence.modalityLabel) {
      findings.push({
        kind: 'speed_modality_mismatch', date: day.date, catalogueIdentity,
        finalModality: final.modalityLabel, evidenceModality: evidence.modalityLabel,
      });
    }
  }
  return findings;
}

const CATEGORY_BY_STRUCTURE: Readonly<Record<string, ConditioningAuditCategory>> = {
  continuous_aerobic: 'Continuous Aerobic',
  tempo_intervals: 'Tempo',
  hard_intervals: 'Hard Intervals',
  aerobic_flush: 'Flush',
};

export interface ProgrammingAuditConditioningVocabularySummary {
  readonly categoryDayCounts: Readonly<Record<ConditioningAuditCategory, number>>;
  readonly distinctCategories: readonly ConditioningAuditCategory[];
  readonly templateRowPlacements: number;
  readonly distinctTemplates: readonly string[];
}

/** Categories are the four programme roles; templates are actual selected rows. */
export function summarizeProgrammingAuditConditioningVocabulary(
  days: readonly ProgrammingAuditExportDay[],
): ProgrammingAuditConditioningVocabularySummary {
  const categoryDayCounts: Record<ConditioningAuditCategory, number> = {
    'Continuous Aerobic': 0,
    Tempo: 0,
    'Hard Intervals': 0,
    Flush: 0,
  };
  const templates = new Set<string>();
  let templateRowPlacements = 0;
  for (const day of days) {
    const category = CATEGORY_BY_STRUCTURE[day.conditioningIdentity?.structureFamily ?? ''];
    if (category) categoryDayCounts[category] += 1;
    for (const row of finalAthleteFacingAuditRows(day)
      .filter(programmingAuditRowRequiresCatalogueIdentity)) {
      const identity = programmingAuditCatalogueIdentity(row);
      const template = resolveTemplateByName(identity);
      if (!template) continue;
      templates.add(template.name);
      templateRowPlacements += 1;
    }
  }
  return {
    categoryDayCounts,
    distinctCategories: (Object.keys(categoryDayCounts) as ConditioningAuditCategory[])
      .filter((category) => categoryDayCounts[category] > 0),
    templateRowPlacements,
    distinctTemplates: [...templates].sort(),
  };
}
