/**
 * ONE decision behind the Profile setup page's Save button.
 *
 * The screen used to carry two. `setupHasChanges` decided whether Save was
 * enabled; `buildSetupPatch` decided what would actually be committed. Two
 * comparisons over the same fields, written separately, free to disagree —
 * and when they disagreed the athlete got a button that looked live and did
 * nothing, with no way to find out why.
 *
 * They are collapsed here: the patch IS the decision, and "has changes" is
 * "the patch is not empty". A live-but-inert Save is now unrepresentable
 * rather than something a reviewer has to notice.
 *
 * The second half of the same defect was the phase this compared against.
 * `currentPhase` came from `profile.seasonPhase`, so on a device carrying
 * phase skew the sheet displayed the profile's phase, re-picking it was "no
 * change", and the rebuild that would have repaired the skew never ran. This
 * takes the OWNED phase (see rules/seasonPhaseOwner) — so on a skewed device
 * picking the phase you meant is a real change, and saving it reconciles.
 */

import type {
  DayOfWeek,
  ExperienceLevel,
  OnboardingData,
  Position,
  SeasonPhase,
} from '../types/domain';
import { DAYS_OF_WEEK, storedGameAnchor } from './gameAnchor';

/** An ALIAS of the canonical week, not a second copy of it. */
export const SETUP_WEEK_DAYS: readonly DayOfWeek[] = DAYS_OF_WEEK;

export function sortSetupDays(days: readonly DayOfWeek[]): DayOfWeek[] {
  return [...days].sort((a, b) => SETUP_WEEK_DAYS.indexOf(a) - SETUP_WEEK_DAYS.indexOf(b));
}

export function sameSetupDays(a?: readonly DayOfWeek[], b?: readonly DayOfWeek[]): boolean {
  const left = sortSetupDays(a ?? []);
  const right = sortSetupDays(b ?? []);
  return left.length === right.length && left.every((day, index) => day === right[index]);
}

/** The athlete's stored game anchor, read from either field. */
export function storedGameDay(profile: OnboardingData): DayOfWeek | null {
  return storedGameAnchor(profile);
}

/** Everything the sheet is currently holding, already resolved. */
export interface ProfileSetupSelection {
  name: string;
  position: Position | null;
  experience: ExperienceLevel | null;
  twoKmSeconds: number | null;
  twoKmAnswer: OnboardingData['twoKmTimeTrial'] | null;
  seasonPhase: SeasonPhase;
  preferredDays: readonly DayOfWeek[];
  teamDays: readonly DayOfWeek[];
  gameDay: DayOfWeek | null;
}

/** Why Save is not available. Empty means it is. */
export type ProfileSetupBlockReason =
  /** At least one LFA training day is required. */
  | 'no_training_days'
  /** In-season needs a game anchor answer before it can rebuild. */
  | 'game_day_unanswered'
  /** Nothing in the sheet differs from what the program is already built on. */
  | 'no_changes';

export interface ProfileSetupChangeDecision {
  patch: Partial<OnboardingData>;
  hasChanges: boolean;
  blockedBy: ProfileSetupBlockReason[];
  canSave: boolean;
}

export interface DecideProfileSetupChangeInput {
  stored: OnboardingData;
  /**
   * The OWNED season phase — what the program is actually built on. Passing
   * `stored.seasonPhase` here reinstates the dead Save button on any device
   * whose profile and clock disagree.
   */
  ownedPhase: SeasonPhase;
  selection: ProfileSetupSelection;
  /** Set when the stored LFA day COUNT needs re-syncing to the day set. */
  lfaDayCountNeedsSync: boolean;
  /** Resolved stored role bucket, normalised by the caller. */
  storedPosition: Position | null;
}

export function decideProfileSetupChange(
  input: DecideProfileSetupChangeInput,
): ProfileSetupChangeDecision {
  const { stored, ownedPhase, selection } = input;
  const preferredDays = sortSetupDays(selection.preferredDays);
  const teamDays = sortSetupDays(selection.teamDays);
  const trimmedName = selection.name.trim();
  const currentGameDay = storedGameDay(stored);
  const patch: Partial<OnboardingData> = {};

  if (trimmedName && trimmedName !== (stored.firstName || '')) {
    patch.firstName = trimmedName;
  }
  if (selection.position && selection.position !== input.storedPosition) {
    patch.position = selection.position;
  }
  if (
    selection.experience &&
    selection.experience !== ((stored.experienceLevel as ExperienceLevel) || null)
  ) {
    patch.experienceLevel = selection.experience;
  }
  // Compare the TIME, not the answer object — re-recording the same time on a
  // new date is not a change the athlete made to their program.
  const storedTwoKmSeconds = stored.twoKmTimeTrial?.seconds ?? null;
  if (selection.twoKmAnswer && selection.twoKmSeconds !== storedTwoKmSeconds) {
    patch.twoKmTimeTrial = selection.twoKmAnswer;
  }

  const phaseChanged = selection.seasonPhase !== ownedPhase;
  if (phaseChanged) {
    patch.seasonPhase = selection.seasonPhase;
  }

  if (
    input.lfaDayCountNeedsSync ||
    !sameSetupDays(preferredDays, stored.preferredTrainingDays as DayOfWeek[] | undefined)
  ) {
    patch.preferredTrainingDays = preferredDays;
    patch.trainingDaysPerWeek = preferredDays.length;
    patch.trainingDaysUnsure = false;
  }

  if (!sameSetupDays(teamDays, stored.teamTrainingDays as DayOfWeek[] | undefined)) {
    patch.teamTrainingDays = teamDays;
    patch.teamTrainingDaysPerWeek = teamDays.length;
  }

  if (selection.seasonPhase === 'In-season') {
    if (selection.gameDay !== currentGameDay || phaseChanged) {
      patch.usualGameDay = selection.gameDay ?? undefined;
      patch.gameDay = selection.gameDay ?? undefined;
    }
  } else if (ownedPhase === 'In-season' || currentGameDay) {
    // Leaving In-season, or a stale anchor left behind by an earlier phase.
    // Only a change when there is actually an anchor to retire.
    if (currentGameDay) {
      patch.usualGameDay = undefined;
      patch.gameDay = undefined;
    }
  }

  const hasChanges = Object.keys(patch).length > 0;
  const blockedBy: ProfileSetupBlockReason[] = [];
  if (preferredDays.length < 1) blockedBy.push('no_training_days');
  if (selection.seasonPhase === 'In-season' && !selection.gameDay) {
    blockedBy.push('game_day_unanswered');
  }
  if (!hasChanges) blockedBy.push('no_changes');

  return {
    patch,
    hasChanges,
    blockedBy,
    canSave: blockedBy.length === 0,
  };
}

/** Athlete-facing explanation for a Save that is unavailable. */
export function profileSetupBlockCopy(reason: ProfileSetupBlockReason): string {
  switch (reason) {
    case 'no_training_days':
      return 'Pick at least one day you can train.';
    case 'game_day_unanswered':
      return 'Pick your usual game day so we can anchor the week around it.';
    case 'no_changes':
      return 'Nothing to update — this is already what your program is built on.';
  }
}
