/**
 * THE ATHLETE'S FACTS → `WeeklySchedulerInputs`. One place, so generation does not
 * assemble them inline and quietly disagree with the guards.
 *
 * **EVERY INPUT IS ALREADY AUTHORISED ELSEWHERE.** Nothing here invents a fact:
 * gym access is the athlete's preferred training days, club nights and game day
 * are their own answers, age comes from the onboarding range, readiness from the
 * generation constraints, and explicit unavailability from the active constraints
 * the away/busy doors already write.
 */
import type { OnboardingData } from '../types/domain';
import type { OffseasonSubphase } from './offseasonSubphase';
import type {
  SchedulerReadiness,
  WeeklyScheduleRefusal,
  WeeklySchedulerInputs,
} from './weeklyScheduler';
import type { ContractPhase, OffseasonBlock } from './weeklyProgrammingContract';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday',
  'Friday', 'Saturday'];

function dayNumber(name: unknown): number | null {
  const index = DAY_NAMES.indexOf(String(name ?? ''));
  return index < 0 ? null : index;
}

function dayNumbers(names: readonly unknown[] | undefined): number[] {
  return (names ?? []).map(dayNumber).filter((n): n is number => n !== null);
}

/**
 * ⚠ THE AGE RANGE IS A BAND, AND THE SELECTOR NEEDS A NUMBER.
 *
 * `AgeRange` is `'Under 18' | '18-22' | '22-26' | '26-30' | '30+'` and the
 * contract's boundary is 27. **`'26-30'` STRADDLES IT**, so the band alone cannot
 * answer "is this athlete 27 or younger".
 *
 * The band's TOP is used, which is the conservative reading: a `26-30` athlete is
 * treated as 30 and does NOT qualify on age. That is deliberate — decision 14's
 * other arm (consistently completing three with high readiness and low fatigue) is
 * the route for an older athlete, and **guessing young would hand a fourth session
 * to someone the contract does not cover.** Recorded because it is a real
 * boundary the source does not resolve, not a silent rounding.
 */
export function ageFromRange(range: OnboardingData['ageRange']): number | null {
  switch (range) {
    case 'Under 18': return 17;
    case '18-22': return 22;
    case '22-26': return 26;
    case '26-30': return 30;   // straddles 27 — conservative, see docstring
    case '30+': return 31;
    default: return null;
  }
}

/** The contract's three off-season blocks, from the app's subphase vocabulary. */
export function offseasonBlockFrom(
  subphase: OffseasonSubphase | null,
): OffseasonBlock | null {
  switch (subphase) {
    case 'early_offseason': return 'early_optional';
    case 'mid_offseason': return 'transition';
    case 'late_offseason': return 'normal_build';
    default: return null;
  }
}

/** Thrown when the contract cannot build a legal week. Carries the typed refusal. */
export class WeeklyScheduleRefusedError extends Error {
  readonly code = 'weekly_schedule_refused';

  readonly refusal: WeeklyScheduleRefusal;

  constructor(refusal: WeeklyScheduleRefusal) {
    super(`Weekly schedule refused (${refusal.finding}: ${refusal.clauseId})`);
    this.name = 'WeeklyScheduleRefusedError';
    this.refusal = refusal;
  }
}

export function weeklySchedulerInputsFrom(args: {
  readonly profile: OnboardingData;
  readonly weekStartISO: string;
  readonly offseasonSubphase: OffseasonSubphase | null;
  readonly generationConstraints?: {
    readonly readiness?: { readonly deloaded?: boolean } | null;
  } | null;
  readonly activeConstraints?: readonly unknown[];
  readonly exposureContract?: { readonly anchors?: unknown } | null;
  /** WC-136. Rotates the authored hard conditioning quality at the block boundary. */
  readonly miniCycleNumber?: number | null;
}): WeeklySchedulerInputs {
  const profile = args.profile as OnboardingData & {
    preferredTrainingDays?: readonly string[];
    teamTrainingDays?: readonly string[];
    gameDay?: string;
  };

  // ⚠ READINESS IS READ CONSERVATIVELY, AND THAT IS THE CONTRACT'S OWN BIAS.
  // Decision 14: *"Low readiness never adds work."* The app has a typed deload
  // signal; it has no typed "consistently completes three comfortably" signal, so
  // that arm is FALSE until one exists rather than assumed true. The effect is
  // that an older athlete stays on three sessions — the contract's default.
  const readiness: SchedulerReadiness = {
    lowReadiness: args.generationConstraints?.readiness?.deloaded === true,
    highReadiness: false,
    lowFatigue: false,
    consistentlyCompletesThree: false,
  };

  // Explicit unavailability, from the constraints the away/busy doors write.
  const unavailableDays = new Set<number>();
  for (const raw of args.activeConstraints ?? []) {
    const constraint = raw as {
      type?: string;
      unavailableWeekdays?: readonly unknown[];
      unavailableDates?: readonly unknown[];
    };
    if (constraint.type !== 'schedule') continue;
    for (const weekday of constraint.unavailableWeekdays ?? []) {
      const n = typeof weekday === 'number' ? weekday : dayNumber(weekday);
      if (n !== null) unavailableDays.add(n);
    }
  }

  return {
    weekStartISO: args.weekStartISO,
    phase: profile.seasonPhase as ContractPhase,
    offseasonBlock: offseasonBlockFrom(args.offseasonSubphase),
    gymAccessDays: dayNumbers(profile.preferredTrainingDays),
    clubNights: dayNumbers(profile.teamTrainingDays),
    gameDay: dayNumber(profile.gameDay),
    // **ALWAYS RECURRING FROM ONBOARDING.** The athlete names a usual game day,
    // which by definition means there was one last week too. Nothing in the
    // profile can say "first fixture ever", so nothing here may claim it — and
    // claiming it is precisely how Lower landed on G+1.
    fixtureRecurrence: 'recurring' as const,
    age: ageFromRange(profile.ageRange),
    readiness,
    unavailableDays: [...unavailableDays],
    miniCycleNumber: args.miniCycleNumber ?? null,
  };
}
