/**
 * WHAT HAPPENS WHEN A DOOR ASKS FOR A REBUILD — one owner, every surface that
 * has a door.
 *
 * ## Why this file exists (SEAT_INBOX item 8, 2026-08-12)
 *
 * `LAW-one-name-two-meanings`, sighting 7, is already in the registry and reads:
 * *"`useHomeScreen` meaning both 'the day screen's state' and 'the app's rebuild
 * owner'"*. This is the second meaning, moved out — and it moved because item 8
 * made the cost real rather than theoretical.
 *
 * **MEASURED, NOT ASSUMED.** Coach / My Status now owns the modifier controls.
 * A census of `clearActiveProgramModifier` (2026-08-12) shows four modifier
 * families whose clear returns `rebuildRequired: true` — equipment constraints,
 * exercise adjustments, athlete exercise preferences and profile availability —
 * and `athlete_preferences` modifiers carry a live `clear_adjustment` action and
 * NO source facts, so they take the `clear_active_modifier` path and come back
 * asking for a rebuild. A My Status without this hook would clear the athlete's
 * excluded exercise, tell them nothing, and leave the week un-regenerated until
 * something else happened to rebuild it.
 *
 * ## WHAT DID NOT MOVE, AND IT MATTERS
 *
 * The generator itself. `generateProgramFromProfile` is CALLED here exactly as
 * it was called from `useHomeScreen`, with the same options and the same sweep
 * — this file relocates a caller, it does not touch a generation path, an
 * anchor, or the program store's persistence. (Generator stand-down D,
 * 2026-08-12: another agent holds those.)
 *
 * The Program tab's own rebuild sheet state moves here with it, because a second
 * copy of "is the rebuild sheet up" is exactly the two-representations shape
 * this repo keeps paying for. Both screens read `rebuildModalVisible` from the
 * one place; `isRebuilding` and the error already came from
 * `store/rebuildNoticeStore`, which has been the notice's one owner since
 * 2026-08-10.
 */

import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import {
  beginRebuildNotice,
  endRebuildNotice,
  setRebuildNoticeError,
  clearRebuildNoticeError,
} from '../store/rebuildNoticeStore';
import { useRebuildNotice } from './useRebuildNotice';
import { useProfileStore } from '../store/profileStore';
import { getCurrentBlockNumberForGeneration } from '../store/programStore';
import { generateProgramFromProfile } from '../services/api/generateProgram';
import { classifyProgramGenerationFailure } from '../utils/onboardingGenerationOutcome';
import { commitRebuiltProgram, decideSweepForCurrentStores } from '../utils/weekRebuild';
import { logger } from '../utils/logger';
import type { OnboardingData } from '../types/domain';
import type { ProgramControlActionResult } from '../utils/programControlActions';

/**
 * A preserved manual edit that clashed with a game window was removed —
 * protect the game, but never silently.
 *
 * EXPORTED because it has a second caller: the fixture-mutation path on the
 * Program tab reports the same removals from its own transaction result. Two
 * copies of this sentence would be two ways to describe one protection.
 */
export function alertGameConflicts(conflictsRemoved: Array<{ date: string; name: string }>): void {
  if (conflictsRemoved.length === 0) return;
  const lines = conflictsRemoved
    .map((c) => `• ${c.name} (${new Date(c.date + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })})`)
    .join('\n');
  Alert.alert(
    'Protected your game day',
    `These custom sessions were too close to the game and were removed:\n${lines}`,
  );
}

/**
 * The athlete never sees an engine string.
 *
 * `classifyProgramGenerationFailure` collapses whatever threw into safe copy and
 * a retryable flag; the diagnostic goes to the log and nowhere else.
 */
export function classifyRebuildFailure(
  err: unknown,
): { userMessage: string; canRetry: boolean } {
  const { userMessage, canRetry } = classifyProgramGenerationFailure(err);
  return { userMessage, canRetry };
}

export interface ProgramRebuild {
  /** Whether the rebuild sheet is up. Both screens mount `RebuildSheet` on it. */
  readonly rebuildModalVisible: boolean;
  readonly setRebuildModalVisible: (visible: boolean) => void;
  /**
   * The AI rebuild path (onboarding / phase shift / a door that asked for it).
   * Commits through the SAME canonical `weekRebuild` policy as tap/edit
   * rebuilds — modifier-owned overrides and user manual edits survive; system
   * junk is cleared.
   */
  readonly runRebuild: (profileOverride?: OnboardingData) => Promise<void>;
  /**
   * WHAT A DOOR RESULT MEANS. Every program-control caller hands its result
   * here; only a result that ASKS for a rebuild gets one, and a rebuild that
   * fails lands a retryable sentence rather than a silent stop.
   */
  readonly handleProgramControlResult: (
    result: ProgramControlActionResult,
  ) => Promise<void>;
  readonly handleCancelRebuild: () => void;
  readonly handleConfirmRebuild: () => Promise<void>;
}

export function useProgramRebuild(): ProgramRebuild {
  const onboardingData = useProfileStore((s) => s.onboardingData);
  const { isRebuilding } = useRebuildNotice();
  const [rebuildModalVisible, setRebuildModalVisible] = useState(false);

  const runRebuild = useCallback(async (profileOverride?: OnboardingData) => {
    const profile = profileOverride ?? onboardingData;
    const program = await generateProgramFromProfile(profile, {
      // The athlete asked for this rebuild (onboarding, phase shift). A week
      // that cannot meet its contract is disclosed downstream, not refused.
      weekAcceptance: 'forward_decision',
      blockNumber: getCurrentBlockNumberForGeneration(),
    });
    const sweep = decideSweepForCurrentStores(program, profile);
    commitRebuiltProgram(program, {
      preserve: sweep.preserve,
      clear: sweep.clear,
      conflictsRemoved: sweep.conflictsRemoved,
    });
    alertGameConflicts(sweep.conflictsRemoved);
  }, [onboardingData]);

  const handleProgramControlResult = useCallback(async (
    result: ProgramControlActionResult,
  ) => {
    if (result.fallbackToCoach) {
      logger.warn('[ProgramControl] action requested Coach fallback:', result.fallbackReason);
      return;
    }
    if (!result.requiresRebuild) return;

    beginRebuildNotice();
    setRebuildModalVisible(true);
    try {
      await runRebuild();
      setRebuildModalVisible(false);
    } catch (err: any) {
      logger.error('[CoachNotes] rebuild after clear failed:', err?.diagnostic || err?.message || err);
      const { userMessage, canRetry } = classifyRebuildFailure(err);
      setRebuildNoticeError(userMessage, canRetry);
    } finally {
      endRebuildNotice();
    }
  }, [runRebuild]);

  const handleCancelRebuild = useCallback(() => {
    if (isRebuilding) return;
    setRebuildModalVisible(false);
    clearRebuildNoticeError();
  }, [isRebuilding]);

  const handleConfirmRebuild = useCallback(async () => {
    beginRebuildNotice();
    try {
      await runRebuild();
      setRebuildModalVisible(false);
    } catch (err: any) {
      // Log diagnostic payload to dev console — UI only ever sees safe copy.
      logger.error('[Rebuild] failed:', err?.diagnostic || err?.message || err);
      const { userMessage, canRetry } = classifyRebuildFailure(err);
      setRebuildNoticeError(userMessage, canRetry);
    } finally {
      endRebuildNotice();
    }
  }, [runRebuild]);

  return {
    rebuildModalVisible,
    setRebuildModalVisible,
    runRebuild,
    handleProgramControlResult,
    handleCancelRebuild,
    handleConfirmRebuild,
  };
}
