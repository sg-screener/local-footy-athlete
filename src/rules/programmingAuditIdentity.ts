import { resolveTemplateByName } from './conditioningSelection';
import { canonicalExerciseName } from '../utils/exerciseCanonicalisation';

export interface ProgrammingAuditRowIdentity {
  /** Athlete-facing presentation. It may be reworded without changing identity. */
  readonly name: string;
  /** Raw exercise/template identity before athlete-facing formatting. */
  readonly catalogueIdentity?: string;
}

/**
 * Resolve one exported visible row to the identity used by the programming
 * catalogue and compiler trace.
 *
 * The full-year exporter must carry the raw identity. Reconstructing identity
 * from display copy is deliberately forbidden: `Single-Leg Squat (to Box)` is
 * presented as `Single-Leg Box Squat`, and conditioning titles have the same
 * separation. A display-name tally cannot adjudicate catalogue reachability.
 */
export function programmingAuditCatalogueIdentity(
  row: ProgrammingAuditRowIdentity,
): string {
  const raw = row.catalogueIdentity?.trim();
  if (!raw) {
    throw new Error(`Programming audit row is missing catalogueIdentity: ${row.name}`);
  }
  return resolveTemplateByName(raw)?.name ?? canonicalExerciseName(raw);
}

export function programmingAuditRowIsConditioning(
  row: ProgrammingAuditRowIdentity,
): boolean {
  return !!resolveTemplateByName(programmingAuditCatalogueIdentity(row));
}
