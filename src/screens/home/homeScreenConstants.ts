import type { SeasonPhase, DayOfWeek } from '../../types/domain';

/**
 * Shared constants for the Home screen.
 *
 * Kept in their own module so HomeScreenClassic, HomeScreenV2 and the shared
 * useHomeScreen() hook all read the same values. Anything UI-shape-agnostic
 * (phase rotations, rebuild copy, quick-action prefills) lives here; presentational
 * tokens stay inside the render files.
 */

/** Week day labels for the phase-shift setup selectors. */
export const WEEK_DAYS: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export const DAY_SHORT: Record<DayOfWeek, string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
};

/** JS Date.getDay() → DayOfWeek name. Indexed by getDay() convention (Sun=0..Sat=6). */
export const DAY_NUM_TO_NAME: DayOfWeek[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/**
 * Phase-shift flow steps.
 *
 * Order:
 *   confirm → availability → [teamDays (non-Off-season)] → [gameDay (In-season)] → building
 *
 * `availability` re-asks "what days can you train?" before rebuild. Onboarding
 * may have happened months ago and the athlete's real schedule drifts, so we
 * never trust the stored `preferredTrainingDays` without a confirmation pass.
 * This is deliberately inserted after `confirm` (commitment to shift) and
 * before `teamDays` (club schedule layered on top of athlete availability).
 */
export type PhaseShiftStep =
  | 'confirm'
  | 'availability'
  | 'teamDays'
  | 'gameDay'
  | 'building';

/** Next phase in the fixed transition order. */
export const NEXT_PHASE: Record<SeasonPhase, SeasonPhase> = {
  'In-season': 'Off-season',
  'Off-season': 'Pre-season',
  'Pre-season': 'In-season',
};

/** Human-friendly conditioning flavour labels. */
export const COND_FLAVOUR_LABELS: Record<string, string> = {
  aerobic: 'Aerobic Base',
  tempo: 'Tempo',
  'high-intensity': 'HI Intervals',
};

/** Rotating coach messages shown while the week is rebuilding. */
export const REBUILD_MESSAGES = [
  'Coach is reviewing your week…',
  'Adjusting sessions around your schedule…',
  'Balancing load and recovery…',
  'Dialing in conditioning…',
  'Finalising your program…',
];

/** Rotating messages shown while shifting season phase. */
export const PHASE_SHIFT_MESSAGES = [
  'Coach is reviewing your week…',
  'Adjusting sessions for your new phase…',
  'Balancing load and recovery…',
  'Dialing in conditioning…',
  'Finalising your program…',
];

/** Rotation interval for rebuild messages. */
export const REBUILD_MSG_INTERVAL_MS = 2500;

/** Quick-action chip prefills wired to the Coach tab. */
export const QUICK_ACTIONS = [
  {
    label: 'I missed a session',
    prefill:
      'I missed a session this week — can you adjust my program to account for this?',
  },
  {
    label: 'Game day changed',
    prefill: 'My game day has changed — can you adjust my program?',
  },
  {
    label: 'I got injured',
    prefill: "I've picked up an injury and need to adjust my program.",
  },
  {
    label: 'Training cancelled',
    prefill: 'Training is cancelled tonight — can you adjust my week?',
  },
  {
    label: 'Change my schedule',
    prefill: 'My training days have changed — can you adjust my program?',
  },
  {
    label: 'Missing equipment',
    prefill: "I’m missing equipment for my program — ",
  },
  { label: 'Something else? Tell the coach', prefill: '' },
];

/** Interaction mode for the week view — normal tap, move-a-game, or add-a-game. */
export type InteractionMode =
  | { type: 'normal' }
  | { type: 'moveGame'; fromDate: string; fromIdx: number }
  | { type: 'addGame' };
