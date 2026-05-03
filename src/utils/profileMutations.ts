/**
 * Pure profile-mutation helpers — single source of truth for the overlay
 * logic used by HomeScreen mutation handlers AND the QA harness.
 *
 * Why this exists:
 *   Phase C surfaced a class of bugs where the in-app handler
 *   (rebuildForGameChange / executePhaseShift) and the QA harness diverged
 *   on how a profile is patched before being passed to
 *   `generateProgramFromProfile`. Centralising the overlay here means any
 *   change to the rule (e.g. a new derived field added to OnboardingData)
 *   updates both call sites simultaneously.
 *
 * These are PURE functions — they take a profile + change, return a new
 * profile. They never touch React state, calendarStore, profileStore, or
 * the AI pipeline. Callers wire those side effects.
 */

import type { OnboardingData, DayOfWeek, SeasonPhase, GameDay } from '../types/domain';

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Map a full DayOfWeek to the legacy `gameDay` enum (Fri/Sat/Sun/Varies).
 * Anything outside Fri/Sat/Sun maps to 'Varies' so the legacy field stays
 * valid for downstream consumers (edge function, ReviewScreen) without
 * losing the precise day signal — `usualGameDay` carries that.
 */
export function mapToLegacyGameDay(day: DayOfWeek): GameDay {
  if (day === 'Friday' || day === 'Saturday' || day === 'Sunday') return day;
  return 'Varies';
}

// ─────────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────────

/**
 * Apply a game-state change to a profile. Returns the new profile.
 *
 *   newGameDay === null          → bye week (engine will run NO-game branch)
 *   newGameDay === DayOfWeek     → game on that day (engine WITH-game branch)
 *
 * Mirrors the temp-profile build in HomeScreen.rebuildForGameChange.
 */
export function applyGameDayChange(
  profile: OnboardingData,
  newGameDay: DayOfWeek | null,
): OnboardingData {
  return {
    ...profile,
    usualGameDay: newGameDay ?? undefined,
    gameDay: newGameDay === null ? undefined : mapToLegacyGameDay(newGameDay),
  };
}

export interface PhaseShiftInput {
  /** Target season phase. */
  targetPhase: SeasonPhase;
  /**
   * Athlete availability for the new phase. When present, overwrites the
   * stored `preferredTrainingDays` before the rebuild. The phase-shift modal
   * re-asks availability on every shift because the stored value may be
   * months stale; if the athlete opted not to change it, the caller passes
   * the current value and the field round-trips unchanged. Omit when the
   * caller (e.g. older QA scenarios) doesn't care about availability and
   * wants the legacy "reuse stored value" behaviour.
   */
  preferredTrainingDays?: DayOfWeek[];
  /** Required when targetPhase !== 'Off-season'. Empty array allowed. */
  teamTrainingDays?: DayOfWeek[];
  /** Only used when targetPhase === 'In-season'. Falsy → no game anchor. */
  gameDay?: DayOfWeek | null;
}

/**
 * Apply a phase shift to a profile. Returns the new profile.
 *
 * Rules (mirroring HomeScreen.executePhaseShift):
 *   - Off-season: clears team days + game anchors entirely
 *   - Pre-season: keeps team days, clears game anchors (no games in pre-season)
 *   - In-season:  keeps team days, sets game anchors if provided
 *
 * Note: this DOES NOT clear calendar overrides (game/rest/noGame marks).
 * That is a calendarStore concern handled separately by the caller — see
 * the clearAllGames() side effect in HomeScreen.executePhaseShift.
 */
export function applyPhaseShift(
  profile: OnboardingData,
  input: PhaseShiftInput,
): OnboardingData {
  const updates: Partial<OnboardingData> = {
    seasonPhase: input.targetPhase,
  };

  // Availability override — applied regardless of phase, because even
  // Off-season rebuilds care about which days the athlete can train. If the
  // caller omits the field we leave the stored value intact (older call
  // sites that don't re-ask).
  if (input.preferredTrainingDays !== undefined) {
    updates.preferredTrainingDays = input.preferredTrainingDays;
    // Keep `trainingDaysPerWeek` consistent with the day set when the user
    // adjusts availability. Onboarding models this as: explicit
    // `trainingDaysPerWeek === count` OR "flexible" (undefined/0, any count).
    // Mirror that here — if the original profile was in flexible mode, keep
    // it flexible by setting the count to the new selection length.
    updates.trainingDaysPerWeek = input.preferredTrainingDays.length;
  }

  if (input.targetPhase === 'Off-season') {
    updates.teamTrainingDays = [];
    updates.teamTrainingDaysPerWeek = 0;
    updates.usualGameDay = undefined;
    updates.gameDay = undefined;
  } else {
    const teamDays = input.teamTrainingDays ?? [];
    updates.teamTrainingDays = teamDays;
    updates.teamTrainingDaysPerWeek = teamDays.length;

    if (input.targetPhase === 'In-season' && input.gameDay) {
      updates.usualGameDay = input.gameDay;
      updates.gameDay = mapToLegacyGameDay(input.gameDay);
    } else {
      // Pre-season, OR In-season without a game anchor → clear games.
      updates.usualGameDay = undefined;
      updates.gameDay = undefined;
    }
  }

  return { ...profile, ...updates };
}
