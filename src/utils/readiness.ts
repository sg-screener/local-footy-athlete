import type { OnboardingData, CapacityBand } from '../types/domain';
import { MissingCapacityAnswerError, capacityFor } from '../data/capacityRubric';

export type ReadinessEnergy = 'low' | 'okay' | 'good';
export type ReadinessSoreness = 'none' | 'mild' | 'moderate' | 'high';
export type ReadinessSource = 'quick_check' | 'coach_message' | 'session_feedback';
/**
 * THE `short_time` OPTION IS GONE (Sam, 2026-08-21). It had no athlete-facing
 * route: the only thing that could put minutes on a readiness signal was
 * `buildReadinessSignalPatch`, and that has zero production callers. Proven by
 * `npm run census:short-on-time-route`. The coach's "only got 40 minutes on
 * Wednesdays" answer is a DIFFERENT, LIVE feature — it writes a typed time-cap
 * fact and never touches a readiness signal.
 */
export type ReadinessQuickOption = 'good' | 'flat' | 'sore';

export interface ReadinessSignal {
  date: string;
  bodyPart?: string;
  energy?: ReadinessEnergy;
  soreness?: ReadinessSoreness;
  painFlag?: boolean;
  timeAvailableMinutes?: number;
  flatToday?: boolean;
  source: ReadinessSource;
  updatedAt: string;
  /** Downstream compatibility provenance for canonical health source facts. */
  temporarySourceFactIds?: string[];
  poorSleepPattern?: 'single_night' | 'repeated';
}

/**
 * The athlete's standing capacity band.
 *
 * REWRITTEN (Sam, 2026-07-28). This used to build the whole `CoachingInputs`
 * object, call `calculateReadiness`, and wrap it in `catch { return 'medium' }`
 * — with a second silent `'medium'` when `seasonPhase` was absent. Either one
 * would have swallowed the rubric's refusal one layer up and handed back a
 * confident tier, which is exactly the failure the fail-loud ruling exists to
 * stop.
 *
 * It now asks the rubric owner directly. The `seasonPhase` guard went with the
 * rewrite rather than being preserved: capacity stopped depending on phase when
 * Sam deleted the in-season -1 modifier, so the guard was gating on a field the
 * calculation no longer reads.
 *
 * Throws `MissingCapacityAnswerError` when either answer is absent. That is the
 * contract, not an accident — see `data/capacityRubric.ts`.
 */
export function deriveProfileReadiness(
  onboardingData: OnboardingData | null | undefined,
): CapacityBand {
  return capacityFor(
    onboardingData?.recentTrainingLoad,
    onboardingData?.conditioningLevel,
  ).level;
}

/**
 * The band, or `null` when this profile cannot be scored.
 *
 * THE SEAM, not a softening (Sam's ruling, 2026-07-30). `deriveProfileReadiness`
 * above still throws and is what PRESCRIBERS call — generation must not build a
 * program on a guess, and that refusal is unchanged.
 *
 * This is for READERS. `useSchedule` called the throwing accessor from a hook
 * body, so an athlete whose profile could not be scored crashed the app during
 * render on launch. Rendering is not prescribing: the week can be shown, and
 * the athlete told what is missing, without anyone inventing a capacity tier.
 *
 * `null` is the whole point and must stay null all the way down. It means "no
 * band" — not 'medium', not 'low'. Returning a tier here would be the silent
 * default the rubric's fail-loud exists to kill, reintroduced one layer out and
 * harder to see. Consumers that need a band to prescribe must refuse; consumers
 * that only modulate something already built do nothing.
 */
export function profileCapacityBandOrNull(
  onboardingData: OnboardingData | null | undefined,
): CapacityBand | null {
  try {
    return deriveProfileReadiness(onboardingData);
  } catch (error) {
    if (error instanceof MissingCapacityAnswerError) return null;
    throw error;
  }
}

function lowerOf(a: CapacityBand, b: CapacityBand): CapacityBand {
  const rank: Record<CapacityBand, number> = { low: 0, medium: 1, high: 2 };
  return rank[a] <= rank[b] ? a : b;
}

export function deriveScheduleReadiness(args: {
  onboardingData?: OnboardingData | null;
  signal?: ReadinessSignal | null;
}): CapacityBand {
  const base = deriveProfileReadiness(args.onboardingData);
  const signal = args.signal;
  if (!signal) return base;

  if (signal.painFlag || signal.soreness === 'high') return lowerOf(base, 'low');
  if (signal.energy === 'low' && signal.flatToday) return lowerOf(base, 'low');
  if ((signal.timeAvailableMinutes ?? 999) < 20) return lowerOf(base, 'low');

  if (
    signal.energy === 'low' ||
    signal.flatToday ||
    signal.soreness === 'moderate' ||
    (signal.timeAvailableMinutes ?? 999) < 35
  ) {
    return lowerOf(base, 'medium');
  }

  // A good check-in keeps the planned readiness; it never adds extra load.
  return base;
}

export function buildReadinessSignalPatch(
  option: ReadinessQuickOption,
): Omit<ReadinessSignal, 'date' | 'source' | 'updatedAt'> {
  switch (option) {
    case 'good':
      return {
        energy: 'good',
        soreness: 'none',
        flatToday: false,
        painFlag: false,
        timeAvailableMinutes: undefined,
      };
    case 'flat':
      return {
        energy: 'low',
        soreness: undefined,
        flatToday: true,
        painFlag: false,
        timeAvailableMinutes: undefined,
      };
    case 'sore':
      return {
        energy: 'okay',
        soreness: 'moderate',
        flatToday: false,
        painFlag: false,
        timeAvailableMinutes: undefined,
      };
  }
}

export function getReadinessQuickOption(
  signal: ReadinessSignal | null | undefined,
): ReadinessQuickOption | null {
  if (!signal) return null;
  if (signal.energy === 'good' && signal.soreness === 'none' && !signal.flatToday) return 'good';
  if (signal.flatToday || signal.energy === 'low') return 'flat';
  if (signal.soreness === 'moderate' || signal.soreness === 'high') return 'sore';
  return null;
}
