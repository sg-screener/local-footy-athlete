/**
 * useRebuildNotice.ts — EVERY SCREEN READS THE SAME REBUILD, HERE.
 *
 * The rebuild notice has one owner (`store/rebuildNoticeStore.ts`); this is the
 * door screens read it through. The hook itself is a PURE READER — it starts no
 * timer, owns no state and decides nothing. Two screens mounted at once
 * therefore observe one truth, which is the point: a rebuild IS one event.
 *
 * Writers are the store's exported acts (`beginRebuildNotice`,
 * `endRebuildNotice`, `setRebuildNoticeError`, `clearRebuildNoticeError`), not
 * setters handed back from here — a reader that hands out setters is a second
 * writer wearing a hook's name.
 *
 * THE FADE AND THE TICKER LIVE AT MODULE SCOPE, NOT IN THE HOOK.
 *   The message rotation used to be a `useEffect` inside `useHomeScreen`. That
 *   was fine while one screen showed the notice and wrong the moment a second
 *   one did: two mounts would run two intervals and rotate the messages at
 *   double speed. So the ticker subscribes to the store once, when this module
 *   loads — one rebuild, one ticker, however many readers mount or unmount.
 *
 *   The fade is an `Animated.Value` rather than store state because it is a
 *   driver read by the native driver, never a value React renders. It is a
 *   module singleton for the same reason the rest is: one fade for one event.
 */

import { Animated } from 'react-native';
import { REBUILD_MSG_INTERVAL_MS } from '../screens/home/homeScreenConstants';
import {
  useRebuildNoticeStore,
  advanceRebuildMessage,
} from '../store/rebuildNoticeStore';

const FADE_MS = 200;

/** The fade driving the rotating message. One event, one fade — see the header. */
export const rebuildMsgOpacity = new Animated.Value(1);

let rotationTimer: ReturnType<typeof setInterval> | null = null;

const stopRotation = (): void => {
  if (rotationTimer === null) return;
  clearInterval(rotationTimer);
  rotationTimer = null;
};

const startRotation = (): void => {
  stopRotation();
  rebuildMsgOpacity.setValue(1);
  rotationTimer = setInterval(() => {
    Animated.timing(rebuildMsgOpacity, {
      toValue: 0,
      duration: FADE_MS,
      useNativeDriver: true,
    }).start(() => {
      advanceRebuildMessage();
      Animated.timing(rebuildMsgOpacity, {
        toValue: 1,
        duration: FADE_MS,
        useNativeDriver: true,
      }).start();
    });
  }, REBUILD_MSG_INTERVAL_MS);
};

// ONE SUBSCRIPTION, ESTABLISHED AT IMPORT. Not a hook, not an effect — nothing
// about the ticker depends on which screens happen to be mounted.
useRebuildNoticeStore.subscribe((state, prev) => {
  if (state.isRebuilding === prev.isRebuilding) return;
  if (state.isRebuilding) startRotation();
  else stopRotation();
});

export interface RebuildNotice {
  isRebuilding: boolean;
  rebuildMsgIdx: number;
  rebuildMsgOpacity: Animated.Value;
  /** USER-FACING copy only — never a raw payload. */
  rebuildError: string | null;
  rebuildErrorCanRetry: boolean;
}

/**
 * The field names match what `useHomeScreen` already returned so the day
 * screen's rendering does not change. That unchanged rendering is the
 * assertion that proves this was a move and not a rewrite.
 */
export const useRebuildNotice = (): RebuildNotice => {
  const isRebuilding = useRebuildNoticeStore((s) => s.isRebuilding);
  const rebuildMsgIdx = useRebuildNoticeStore((s) => s.msgIdx);
  const rebuildError = useRebuildNoticeStore((s) => s.error);
  const rebuildErrorCanRetry = useRebuildNoticeStore((s) => s.errorCanRetry);

  return {
    isRebuilding,
    rebuildMsgIdx,
    rebuildMsgOpacity,
    rebuildError,
    rebuildErrorCanRetry,
  };
};
