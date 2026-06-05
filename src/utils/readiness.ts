import type { OnboardingData, ReadinessLevel } from '../types/domain';
import { calculateReadiness, onboardingToCoachingInputs } from './coachingEngine';

export type ReadinessEnergy = 'low' | 'okay' | 'good';
export type ReadinessSoreness = 'none' | 'mild' | 'moderate' | 'high';
export type ReadinessSource = 'quick_check' | 'coach_message' | 'session_feedback';
export type ReadinessQuickOption = 'good' | 'flat' | 'sore' | 'short_time';

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
}

export function deriveProfileReadiness(
  onboardingData: OnboardingData | null | undefined,
): ReadinessLevel {
  if (!onboardingData?.seasonPhase) return 'medium';
  try {
    return calculateReadiness(onboardingToCoachingInputs(onboardingData)).level;
  } catch {
    return 'medium';
  }
}

function lowerOf(a: ReadinessLevel, b: ReadinessLevel): ReadinessLevel {
  const rank: Record<ReadinessLevel, number> = { low: 0, medium: 1, high: 2 };
  return rank[a] <= rank[b] ? a : b;
}

export function deriveScheduleReadiness(args: {
  onboardingData?: OnboardingData | null;
  signal?: ReadinessSignal | null;
}): ReadinessLevel {
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
    case 'short_time':
      return {
        energy: 'okay',
        soreness: undefined,
        flatToday: false,
        painFlag: false,
        timeAvailableMinutes: 25,
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
  if (typeof signal.timeAvailableMinutes === 'number' && signal.timeAvailableMinutes < 35) return 'short_time';
  return null;
}
