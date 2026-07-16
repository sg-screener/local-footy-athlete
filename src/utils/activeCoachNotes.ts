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
} from './activeProgramModifiers';
import { useCoachUpdatesStore, type ActiveConstraint } from '../store/coachUpdatesStore';
import type { InjuryState } from './injuryProgression';

export type ActiveCoachNoteType = ActiveProgramModifierType;
export type ActiveCoachNoteActionKind = ActiveProgramModifierActionKind;
export type ActiveCoachNoteAction = ActiveProgramModifierAction;

export interface ActiveCoachNote {
  id: string;
  modifierId: string;
  constraintId: string;
  type: ActiveCoachNoteType;
  title: string;
  body: string;
  severity?: number;
  actions: ActiveCoachNoteAction[];
  reversibleAdjustmentId?: string;
  injuryEpisodeId?: string;
  presentationOnlyDismiss?: boolean;
}

export interface ClearActiveCoachNoteResult {
  cleared: ActiveProgramModifier | null;
  remainingActiveCount: number;
  rebuildRequired: boolean;
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
  const dismissed = new Set(dismissedCoachNoteIds);
  return dedupeModifiersByLifecycle(modifiers).map((modifier) => ({
    id: `coach-note:${modifier.id}`,
    modifierId: modifier.id,
    constraintId: modifier.sourceId,
    type: modifier.type,
    title: modifier.title,
    body: modifier.body,
    severity: modifier.severity,
    actions: modifier.actions,
    reversibleAdjustmentId: typeof modifier.payload?.reversibleAdjustmentId === 'string'
      ? modifier.payload.reversibleAdjustmentId
      : undefined,
    injuryEpisodeId: typeof modifier.payload?.injuryEpisodeId === 'string'
      ? modifier.payload.injuryEpisodeId
      : undefined,
    presentationOnlyDismiss: modifier.payload?.presentationOnlyDismiss === true,
  })).filter((note) => !dismissed.has(note.id));
}

export function dismissActiveCoachNote(noteId: string): boolean {
  const note = buildCoachNotesFromModifiers(getActiveProgramModifiers(), [])
    .find((candidate) => candidate.id === noteId);
  if (!note || (!note.presentationOnlyDismiss && !note.reversibleAdjustmentId)) return false;
  useCoachUpdatesStore.getState().dismissCoachNote(note.id);
  return true;
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
  activeInjury?: InjuryState | null,
  snapshot: Omit<ActiveProgramModifierSnapshot, 'activeConstraints' | 'activeInjury'> = {},
): ActiveCoachNote[] {
  return selectActiveCoachNotes({
    ...snapshot,
    activeConstraints,
    activeInjury,
  });
}

export function clearActiveCoachNote(noteId: string): ClearActiveCoachNoteResult {
  const notes = buildCoachNotesFromModifiers(getActiveProgramModifiers());
  const note = notes.find((candidate) => candidate.id === noteId);
  const modifierId = note?.modifierId ?? noteId.replace(/^coach-note:/, '');
  return clearActiveProgramModifier(modifierId);
}
