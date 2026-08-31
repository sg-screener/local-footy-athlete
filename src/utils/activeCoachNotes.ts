import {
  clearActiveProgramModifier,
  selectActiveProgramModifiers,
  getActiveProgramModifiers,
  shouldCreateCoachNote,
  type ActiveProgramModifier,
  type ActiveProgramModifierAction,
  type ActiveProgramModifierActionKind,
  type ActiveProgramModifierSnapshot,
  type ActiveProgramModifierType,
  type ActiveProgramModifierEffect,
} from './activeProgramModifiers';
import { useCoachUpdatesStore, type ActiveConstraint } from '../store/coachUpdatesStore';
import type { ProgramControlStatusUpdate } from './programControlActions';
import type { ReadinessFactKind } from './readinessFactAttribution';

export type ActiveCoachNoteType = ActiveProgramModifierType;
export type ActiveCoachNoteActionKind = ActiveProgramModifierActionKind;
export type ActiveCoachNoteAction = ActiveProgramModifierAction;

export interface ActiveCoachNote {
  id: string;
  modifierId: string;
  constraintId: string;
  type: ActiveCoachNoteType;
  /**
   * What this modifier DID, for the sheet's right-hand column. Carried from
   * the modifier rather than re-derived here: only the builder can tell a
   * tired week from a sick one, and a second derivation is a second answer.
   */
  effect: ActiveProgramModifierEffect;
  /** The canonical source-fact family; never inferred from athlete-facing copy. */
  readinessKind?: ReadinessFactKind;
  title: string;
  body: string;
  severity?: number;
  actions: ActiveCoachNoteAction[];
  reversibleAdjustmentId?: string;
  injuryEpisodeId?: string;
  temporarySourceFactIds?: string[];
  presentationOnlyDismiss?: boolean;
  /**
   * WHICH EXERCISE THIS EXCLUSION ROW IS ABOUT — the canonical identity the
   * builder stamped, carried rather than re-derived from the title.
   *
   * WRITER: `activeProgramModifiers.athleteExclusionModifier`, through the
   * projection below. READER: `useCoachNoteActions.changeExclusionScope`, which
   * needs it to address the canonical transaction owner. TEST:
   * `exerciseExclusionScopeTests` §Status.
   *
   * Undefined on every other kind of row — this is not a general "what is this
   * about" field, and giving it one would invite a second identity for notes
   * that already have `constraintId`.
   */
  excludedExercise?: string;
}

export interface ClearActiveCoachNoteResult {
  cleared: ActiveProgramModifier | null;
  remainingActiveCount: number;
  rebuildRequired: boolean;
}

const GENERIC_STATUS_UPDATE_OPTIONS = [
  'good_now',
  'still_not_right',
  'worse',
] as const satisfies readonly ProgramControlStatusUpdate[];

const STATUS_UPDATE_OPTIONS_BY_READINESS_KIND: Readonly<
  Record<ReadinessFactKind, readonly ProgramControlStatusUpdate[]>
> = {
  fatigue: ['good_now', 'still_not_right', 'still_cooked', 'worse'],
  poor_sleep: ['good_now', 'still_not_right', 'still_cooked', 'worse'],
  illness: ['good_now', 'still_not_right', 'still_sick', 'worse'],
  soreness: GENERIC_STATUS_UPDATE_OPTIONS,
};

/**
 * The one answer selector for every modifier surface.
 *
 * The vocabulary remains signed independently; this function only decides
 * which words belong to the accepted fact being updated. Unknown legacy notes
 * get neutral answers instead of being guessed into illness or fatigue.
 */
export function statusUpdateOptionsForNote(
  note: Pick<ActiveCoachNote, 'readinessKind'>,
): readonly ProgramControlStatusUpdate[] {
  return note.readinessKind
    ? STATUS_UPDATE_OPTIONS_BY_READINESS_KIND[note.readinessKind]
    : GENERIC_STATUS_UPDATE_OPTIONS;
}

function lifecycleKey(modifier: ActiveProgramModifier): string {
  const key = modifier.payload?.lifecycleKey;
  return typeof key === 'string' && key.trim()
    ? `${modifier.source}:${key}`
    : `${modifier.source}:${modifier.sourceId}`;
}

function dedupeModifiersByLifecycle(
  modifiers: readonly ActiveProgramModifier[],
): ActiveProgramModifier[] {
  const byKey = new Map<string, ActiveProgramModifier>();
  for (const modifier of modifiers) {
    if (!shouldCreateCoachNote(modifier)) continue;
    const key = lifecycleKey(modifier);
    if (byKey.has(key)) byKey.delete(key);
    byKey.set(key, modifier);
  }
  return Array.from(byKey.values());
}

export function buildCoachNotesFromModifiers(
  modifiers: readonly ActiveProgramModifier[],
  dismissedCoachNoteIds: readonly string[] = [],
): ActiveCoachNote[] {
  return dedupeModifiersByLifecycle(modifiers).map((modifier) => ({
    id: `coach-note:${modifier.id}`,
    modifierId: modifier.id,
    constraintId: modifier.sourceId,
    type: modifier.type,
    effect: modifier.effect,
    readinessKind: modifier.readinessKind,
    title: modifier.title,
    body: modifier.body,
    severity: modifier.severity,
    actions: modifier.actions.filter(action => action.kind !== 'dismiss_note'),
    reversibleAdjustmentId: typeof modifier.payload?.reversibleAdjustmentId === 'string'
      ? modifier.payload.reversibleAdjustmentId
      : undefined,
    injuryEpisodeId: typeof modifier.payload?.injuryEpisodeId === 'string'
      ? modifier.payload.injuryEpisodeId
      : undefined,
    temporarySourceFactIds: Array.isArray(modifier.payload?.temporarySourceFactIds)
      ? modifier.payload.temporarySourceFactIds.filter((value): value is string => typeof value === 'string')
      : undefined,
    presentationOnlyDismiss: modifier.payload?.presentationOnlyDismiss === true,
    excludedExercise: modifier.payload?.kind === 'excluded'
      && typeof modifier.payload?.exercise === 'string'
      ? modifier.payload.exercise
      : undefined,
  }));
}

export function dismissActiveCoachNote(noteId: string): boolean {
  // R-262: an active effect cannot be hidden independently of ending its cause.
  // Retain the old command boundary so persisted/older callers fail safely.
  return false;
}

export function selectActiveCoachNotes(
  snapshot: ActiveProgramModifierSnapshot,
): ActiveCoachNote[] {
  return buildCoachNotesFromModifiers(
    selectActiveProgramModifiers(snapshot),
    snapshot.dismissedCoachNoteIds ?? useCoachUpdatesStore.getState().dismissedCoachNoteIds,
  );
}

/**
 * Back-compatible helper for tests and older call sites. New consumers
 * should prefer `selectActiveCoachNotes(snapshot)` so every program-
 * consumed modifier source is visible, not just activeConstraints.
 */
export function buildActiveCoachNotes(
  activeConstraints: readonly ActiveConstraint[] | null | undefined,
  snapshot: Omit<ActiveProgramModifierSnapshot, 'activeConstraints'> = {},
): ActiveCoachNote[] {
  return selectActiveCoachNotes({
    ...snapshot,
    activeConstraints,
  });
}

export function clearActiveCoachNote(noteId: string): ClearActiveCoachNoteResult {
  const notes = buildCoachNotesFromModifiers(getActiveProgramModifiers());
  const note = notes.find((candidate) => candidate.id === noteId);
  const modifierId = note?.modifierId ?? noteId.replace(/^coach-note:/, '');
  return clearActiveProgramModifier(modifierId);
}
