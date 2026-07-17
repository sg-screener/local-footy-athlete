/** Convert a persisted/domain identity into a stable native-test token. */
export function stableTestIdToken(value: string | number | null | undefined): string {
  const token = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return token || 'unknown';
}

const DAY_OF_WEEK_TEST_TOKENS = [
  'sun',
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
] as const;

/** Native-test identity derived from the schedule domain, never display copy. */
export function dayOfWeekTestIdToken(dayOfWeek: number): string {
  return DAY_OF_WEEK_TEST_TOKENS[dayOfWeek] ?? 'unknown';
}

/**
 * Explorer selectors are projections of canonical domain identities. Keep
 * their construction here so a copy change, sort order, or array position can
 * never change the native identifier used by the smoke campaign.
 */
export const explorerTestId = {
  fixtureIngress: (action: 'add' | 'move' | 'remove', fixtureId: string) =>
    `fixture-${action}-action-${stableTestIdToken(fixtureId)}`,
  fixtureLog: (fixtureId: string) =>
    `fixture-log-action-${stableTestIdToken(fixtureId)}`,
  fixtureActions: (fixtureId: string) =>
    `fixture-actions-${stableTestIdToken(fixtureId)}`,
  fixtureTarget: (dateISO: string) =>
    `fixture-target-${stableTestIdToken(dateISO)}`,
  fixtureCard: (fixtureId: string) =>
    `fixture-card-${stableTestIdToken(fixtureId)}`,
  fixtureState: (fixtureId: string, state: 'active' | 'absent') =>
    `fixture-${state}-${stableTestIdToken(fixtureId)}`,

  sessionCard: (sessionId: string) =>
    `session-card-${stableTestIdToken(sessionId)}`,
  sessionDetail: (sessionId: string) =>
    `session-detail-${stableTestIdToken(sessionId)}`,
  sessionMoveIngress: (sessionId: string) =>
    `session-move-action-${stableTestIdToken(sessionId)}`,
  sessionMoveDestination: (dateISO: string) =>
    `session-move-destination-${stableTestIdToken(dateISO)}`,
  sessionDeleteIngress: (sessionId: string) =>
    `session-delete-action-${stableTestIdToken(sessionId)}`,
  sessionDeleteScope: (sessionId: string, scopeId: string) =>
    `session-delete-scope-${stableTestIdToken(sessionId)}-${stableTestIdToken(scopeId)}`,
  sessionMutationResult: (action: 'move' | 'delete', identity: string) =>
    `session-${action}-result-${stableTestIdToken(identity)}`,

  componentIdentity: (sessionId: string, componentId: string) =>
    `component-${stableTestIdToken(sessionId)}-${stableTestIdToken(componentId)}`,
  componentDeleteIngress: (sessionId: string, componentId: string) =>
    `component-delete-action-${stableTestIdToken(sessionId)}-${stableTestIdToken(componentId)}`,
  componentDeleteConfirm: (sessionId: string, componentId: string) =>
    `component-delete-confirm-${stableTestIdToken(sessionId)}-${stableTestIdToken(componentId)}`,
  componentDeleteScope: (
    sessionId: string,
    componentId: string,
    scope: 'today' | 'future',
  ) => `component-delete-scope-${stableTestIdToken(sessionId)}-${stableTestIdToken(componentId)}-${scope}`,
  componentDeleteResult: (sessionId: string, componentId: string) =>
    `component-delete-result-${stableTestIdToken(sessionId)}-${stableTestIdToken(componentId)}`,

  injuryIngress: (mode: 'set' | 'update', episodeId?: string) =>
    `injury-${mode}-action-${stableTestIdToken(episodeId ?? 'new')}`,
  injuryResolveAction: (episodeId: string) =>
    `injury-resolve-action-${stableTestIdToken(episodeId)}`,
  injuryActive: (episodeId: string) =>
    `injury-active-${stableTestIdToken(episodeId)}`,
  injuryDetail: (episodeId: string) =>
    `injury-detail-${stableTestIdToken(episodeId)}`,
  injuryResolved: (episodeId: string) =>
    `injury-resolved-${stableTestIdToken(episodeId)}`,

  readinessOption: (kind: string) =>
    `readiness-option-${stableTestIdToken(kind)}`,
  readinessSetAction: (readinessId: string) =>
    `readiness-set-action-${stableTestIdToken(readinessId)}`,
  readinessUpdate: (readinessId: string) =>
    `readiness-update-${stableTestIdToken(readinessId)}`,
  readinessClearAction: (readinessId: string) =>
    `readiness-clear-action-${stableTestIdToken(readinessId)}`,
  readinessClear: (readinessId: string) =>
    `readiness-clear-${stableTestIdToken(readinessId)}`,
  readinessActive: (readinessId: string) =>
    `readiness-active-${stableTestIdToken(readinessId)}`,
  readinessClearState: (weekStartISO: string) =>
    `readiness-clear-state-${stableTestIdToken(weekStartISO)}`,
  readinessProgrammingEffect: (readinessId: string) =>
    `readiness-programming-effect-${stableTestIdToken(readinessId)}`,

  equipmentOption: (presetId: string) =>
    `equipment-preset-${stableTestIdToken(presetId)}`,
  equipmentSet: (factId: string, presetId: string) =>
    `equipment-set-${stableTestIdToken(factId)}-${stableTestIdToken(presetId)}`,
  equipmentUpdate: (factId: string, presetId?: string) =>
    `equipment-update-${stableTestIdToken(factId)}${presetId ? `-${stableTestIdToken(presetId)}` : ''}`,
  equipmentClear: (factId: string) =>
    `equipment-clear-${stableTestIdToken(factId)}`,
  equipmentActive: (factId: string) =>
    `equipment-active-${stableTestIdToken(factId)}`,
  equipmentCleared: (factId: string) =>
    `equipment-cleared-${stableTestIdToken(factId)}`,

  feedbackReceipt: (transactionId: string) =>
    `session-feedback-receipt-${stableTestIdToken(transactionId)}`,
  feedbackSave: (sessionId: string) =>
    `session-feedback-save-${stableTestIdToken(sessionId)}`,
  feedbackProgressionTarget: (transactionId: string, targetSessionId: string) =>
    `session-feedback-progression-target-${stableTestIdToken(transactionId)}-${stableTestIdToken(targetSessionId)}`,

  adjustmentActive: (adjustmentId: string) =>
    `adjustment-active-${stableTestIdToken(adjustmentId)}`,
  adjustmentRestore: (adjustmentId: string) =>
    `adjustment-restore-${stableTestIdToken(adjustmentId)}`,
  adjustmentRestored: (adjustmentId: string) =>
    `adjustment-restored-${stableTestIdToken(adjustmentId)}`,
  adjustmentState: (adjustmentId: string, state: string) =>
    `adjustment-${stableTestIdToken(state)}-${stableTestIdToken(adjustmentId)}`,

  repeatIngress: (sourceWeekStart: string) =>
    `repeat-week-action-${stableTestIdToken(sourceWeekStart)}`,
  repeatConfirm: (sourceWeekStart: string) =>
    `repeat-week-confirm-${stableTestIdToken(sourceWeekStart)}`,
  repeatActive: (adjustmentId: string) =>
    `repeat-week-active-${stableTestIdToken(adjustmentId)}`,
  repeatRestore: (adjustmentId: string) =>
    `repeat-week-restore-${stableTestIdToken(adjustmentId)}`,
  repeatRestored: (adjustmentId: string) =>
    `repeat-week-restored-${stableTestIdToken(adjustmentId)}`,
} as const;
