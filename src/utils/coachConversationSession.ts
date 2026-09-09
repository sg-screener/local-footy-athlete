/**
 * THE CONVERSATION IS THE APP SESSION (R-398, Sam, 2026-09-10: *"just need him
 * to be able to remember that conversation until the app is exited"*).
 *
 * The turns used to be `useState` inside `CoachTabScreen`, so leaving the tab
 * wiped them. They now live in this module-level holder for the life of the
 * app process: leaving and returning to the Coach tab keeps them, closing the
 * app loses them. NOTHING is written to disk or to a server — this is not a
 * store (no zustand, no persist, no AsyncStorage) and it is not a Snapshot
 * (`LAW-live-athlete-snapshot-is-live-and-shared` stands). Full reset clears
 * it through `clearCoachConversation`.
 *
 * WRITER: `CoachTabScreen` (append), `clearCoachConversation` (reset).
 * READER: `CoachTabScreen` through `useCoachConversation`. TEST:
 * `coachTabSlice1Tests` (the holder is the only home; no store, no persist).
 * Lives in utils so the Full reset (`resetCoach.ts`) can clear it without a
 * utils → screens import.
 */
import { useSyncExternalStore } from 'react';

export interface CoachConversationTurn {
  readonly id: string;
  readonly speaker: 'coach' | 'athlete';
  readonly text: string;
}

let turns: readonly CoachConversationTurn[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function readCoachConversation(): readonly CoachConversationTurn[] {
  return turns;
}

export function appendCoachConversation(turn: CoachConversationTurn): void {
  turns = [...turns, turn];
  emit();
}

export function clearCoachConversation(): void {
  if (turns.length === 0) return;
  turns = [];
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** The live conversation, re-rendered on every append; identical across mounts. */
export function useCoachConversation(): readonly CoachConversationTurn[] {
  return useSyncExternalStore(subscribe, readCoachConversation, readCoachConversation);
}
