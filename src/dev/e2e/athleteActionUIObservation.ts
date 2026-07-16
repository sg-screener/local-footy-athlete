import {
  athleteActionDiagnosticsEnabled,
  athleteActionTraceCoordinator,
  currentAthleteActionTrace,
} from '../../utils/athleteActionDiagnostics';

export interface RenderedAthleteActionObservationInput {
  traceId: string;
  observationId: string;
  renderedText: unknown;
  controlId: string;
  accessibilityNode: unknown;
  screenshotReference?: string;
  hierarchyReference?: string;
}

/** Records the domain result expected to render; this is not UI proof. */
export function registerAthleteActionUIOutcome(args: {
  traceId?: string;
  observationId: string;
  domainReturn: unknown;
  controlId?: string;
}): void {
  if (!athleteActionDiagnosticsEnabled()) return;
  const current = currentAthleteActionTrace();
  const traceId = args.traceId ?? current?.traceId;
  if (!traceId) return;
  athleteActionTraceCoordinator.registerUIOutcome(
    current?.traceId === traceId ? current : { traceId, spanId: 'ui-observation-registration' },
    args.observationId,
    args.domainReturn,
    args.controlId,
  );
}

/** Called from a post-commit React effect or E2E bridge after the node exists. */
export function observeRenderedAthleteActionOutcome(
  args: RenderedAthleteActionObservationInput,
): void {
  if (!athleteActionDiagnosticsEnabled()) return;
  athleteActionTraceCoordinator.observeRenderedUI(args);
}
