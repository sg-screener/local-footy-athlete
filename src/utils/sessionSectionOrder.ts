import type { SessionComponent, SessionComponentKind } from './sessionComponents';

/**
 * The one section order used wherever an athlete reads or performs a session.
 *
 * `mobility` is the execution bucket for the derived Movement Prep flow. A
 * typed standalone Mobility session uses the same position but keeps its own
 * label and icon; identity is decided separately by `sectionPresentation`.
 * Primer and Accessories are retained because they are real execution-section
 * identities, even though an ordinary programmed day normally reads:
 *
 *   Movement Prep → Strength → Speed → Conditioning
 *
 * Day and Week do not project Movement Prep as a stored workout part — it is a
 * derived flow mounted ahead of these parts — so ordering their components by
 * this same list produces Strength → Speed → Conditioning underneath it.
 */
export const SESSION_EXECUTION_SECTION_ORDER = [
  'mobility',
  'primer',
  'strength',
  'accessories',
  'speed',
  'conditioning',
  'team_training',
  'recovery',
  'optional',
  'other',
] as const;

export type SessionExecutionSectionId = typeof SESSION_EXECUTION_SECTION_ORDER[number];

const COMPONENT_EXECUTION_SECTION: Readonly<Record<SessionComponentKind, SessionExecutionSectionId>> = {
  power: 'strength',
  strength: 'strength',
  mobility: 'mobility',
  speed: 'speed',
  conditioning: 'conditioning',
  finisher: 'conditioning',
  team_training: 'team_training',
  recovery: 'recovery',
  // These compatibility components have no ordinary rowless execution
  // section. Their real rows are routed by the template when present.
  support: 'other',
  recovery_addon: 'other',
  session: 'other',
};

export function executionSectionForComponentKind(
  kind: SessionComponentKind,
): SessionExecutionSectionId {
  return COMPONENT_EXECUTION_SECTION[kind];
}

const SECTION_RANK: Readonly<Record<SessionExecutionSectionId, number>> =
  Object.fromEntries(SESSION_EXECUTION_SECTION_ORDER.map((id, index) => [id, index])) as
    Record<SessionExecutionSectionId, number>;

/** Stable: components sharing one section retain their authored arrival order. */
export function orderSessionComponentsForExecution<T extends Pick<SessionComponent, 'kind'>>(
  components: readonly T[],
): T[] {
  return components
    .map((component, arrival) => ({ component, arrival }))
    .sort((left, right) => {
      const rank = SECTION_RANK[executionSectionForComponentKind(left.component.kind)]
        - SECTION_RANK[executionSectionForComponentKind(right.component.kind)];
      return rank || left.arrival - right.arrival;
    })
    .map(({ component }) => component);
}
