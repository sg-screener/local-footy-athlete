export type FixtureMutationAction = 'add' | 'move' | 'remove';

export type FixtureMutationKind = 'game' | 'practice_match';

export type FixtureMutationRequestedBy = 'athlete' | 'coach' | 'system';

export type FixtureMutationProducer = 'tap' | 'coach' | 'system';

export type FixtureMutationSurface =
  | 'program_tab'
  | 'session_detail'
  | 'coach_chat'
  | 'calendar'
  | 'hydration_migration'
  | 'test';

/**
 * Diagnostic and acknowledgement metadata for one fixture request.
 *
 * These fields identify who requested and produced the command. They never
 * participate in fixture semantic identity or target resolution.
 */
export interface FixtureMutationSourceMetadata {
  requestedBy: FixtureMutationRequestedBy;
  producer: FixtureMutationProducer;
  surface: FixtureMutationSurface;
  commandId: string;
  turnId?: string;
}

export interface CoachFixtureMutationSourceMetadata
  extends FixtureMutationSourceMetadata {
  requestedBy: 'athlete';
  producer: 'coach';
  surface: 'coach_chat';
  turnId: string;
}

interface FixtureChangeCommandBase {
  fixtureKind: FixtureMutationKind;
  expectedAcceptedRevision: number;
  todayISO: string;
  source: CoachFixtureMutationSourceMetadata;
}

/**
 * Typed Coach-to-transaction contract. Date requirements are represented in
 * the type so an add can never be silently widened into a move.
 */
export type FixtureChangeCommand =
  | (FixtureChangeCommandBase & {
      action: 'add';
      targetDate: string;
      sourceDate?: never;
    })
  | (FixtureChangeCommandBase & {
      action: 'move';
      sourceDate: string;
      targetDate: string;
    })
  | (FixtureChangeCommandBase & {
      action: 'remove';
      sourceDate: string;
      targetDate?: never;
    });
