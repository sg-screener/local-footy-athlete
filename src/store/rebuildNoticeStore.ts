/**
 * rebuildNoticeStore.ts — ONE OWNER OF "A REBUILD IS HAPPENING".
 *
 * WHY THIS EXISTS (docs/REBUILD_NOTICE_OWNERSHIP_2026-08-10.md)
 *   A rebuild is ONE event in the athlete's world: `runRebuild` rebuilds the
 *   athlete's one program. Until now the day screen owned the telling of it —
 *   `useHomeScreen` held `isRebuilding`, the message index, the fade value and
 *   the error as its own `useState`s, which gave that hook a second meaning
 *   ("the day screen's state" AND "the app's rebuild owner").
 *
 *   The moment a second surface (the coach status screen) shows the same
 *   notice, per-screen state means TWO writers of one fact, and the first
 *   disagreement is "the coach screen says it finished while the day screen is
 *   still spinning". Module scope removes that class rather than guarding it.
 *
 * WHAT IT OWNS
 *   - `isRebuilding`   — is a rebuild running right now
 *   - `msgIdx`         — which rotating coach message is showing
 *   - `error` / `errorCanRetry` — USER-FACING copy only, never raw payloads
 *
 * WHAT IT DELIBERATELY DOES NOT OWN: THE FADE, AND THE TICKER THAT DRIVES IT.
 *   No store in this repo imports `react-native`, and this one does not break
 *   that — an `Animated.Value` cannot be constructed in the node harness, so a
 *   store holding one would be the only store its own test suite could not
 *   call. The fade and the interval that advances `msgIdx` live one layer up,
 *   in `hooks/useRebuildNotice.ts`, at module scope for the same reason the
 *   state does: one rebuild, one ticker, one fade, however many readers.
 *
 * NOT PERSISTED, DELIBERATELY. "A rebuild is running" is true only while this
 * process is running it. A relaunch mid-rebuild has no rebuild in flight, so a
 * persisted `true` would be a spinner nothing could ever clear.
 */

import { create } from 'zustand';
import { REBUILD_MESSAGES } from '../screens/home/homeScreenConstants';

export interface RebuildNoticeState {
  isRebuilding: boolean;
  msgIdx: number;
  /** USER-FACING copy only. Raw HTML / server payloads never land here. */
  error: string | null;
  errorCanRetry: boolean;
}

const IDLE: RebuildNoticeState = {
  isRebuilding: false,
  msgIdx: 0,
  error: null,
  errorCanRetry: true,
};

export const useRebuildNoticeStore = create<RebuildNoticeState>(() => ({ ...IDLE }));

/**
 * A rebuild has started. Resets the message to the first one and clears any
 * error from a previous attempt.
 *
 * This is the whole four-line preamble that `handleConfirmRebuild`,
 * `executePhaseShift` and `handleProgramControlResult` each used to repeat.
 */
export const beginRebuildNotice = (): void => {
  useRebuildNoticeStore.setState({
    isRebuilding: true,
    msgIdx: 0,
    error: null,
    errorCanRetry: true,
  });
};

/** The rebuild finished — succeeded, refused or threw. Always paired with begin. */
export const endRebuildNotice = (): void => {
  useRebuildNoticeStore.setState({ isRebuilding: false });
};

/**
 * Advance to the next rotating coach message. Called by the ticker in
 * `hooks/useRebuildNotice.ts`; the wrap lives here because the message list is
 * the thing being indexed and only this module writes `msgIdx`.
 */
export const advanceRebuildMessage = (): void => {
  useRebuildNoticeStore.setState((prev) => ({
    msgIdx: (prev.msgIdx + 1) % REBUILD_MESSAGES.length,
  }));
};

/** Report a failed rebuild in copy the athlete can read. */
export const setRebuildNoticeError = (
  userMessage: string,
  canRetry: boolean,
): void => {
  useRebuildNoticeStore.setState({ error: userMessage, errorCanRetry: canRetry });
};

/**
 * Clear error state. Always resets `canRetry` back to the default (true) so a
 * stale `canRetry=false` from a previous run can't suppress the rebuild button
 * the next time the modal is opened.
 */
export const clearRebuildNoticeError = (): void => {
  useRebuildNoticeStore.setState({ error: null, errorCanRetry: true });
};

/** Test/reset door — no product path calls this. */
export const resetRebuildNotice = (): void => {
  useRebuildNoticeStore.setState({ ...IDLE });
};
