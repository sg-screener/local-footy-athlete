import type { ActiveConstraint } from './coachUpdatesStore';
import type { ReadinessSignal } from '../utils/readiness';
import { isTemporarySourceFactConstraint } from '../rules/temporarySourceFact';

/** Canonical facts and logged outcomes already persist the source inputs.
 * Keep only independent/legacy inputs here, so an old athlete's unlifted input
 * is not discarded merely because current reports use the canonical fact store.
 */
export function constraintInputsForPersistence(constraints: readonly ActiveConstraint[]): ActiveConstraint[] {
  return constraints.filter(constraint => !isTemporarySourceFactConstraint(constraint));
}

export function readinessInputsForPersistence(
  signals: Readonly<Record<string, ReadinessSignal>>,
): Record<string, ReadinessSignal> {
  return Object.fromEntries(Object.entries(signals).filter(([, signal]) =>
    !signal.temporarySourceFactIds?.length && signal.source !== 'session_feedback'));
}
