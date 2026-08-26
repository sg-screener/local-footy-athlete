/**
 * The scenario matrix the power differential harness runs.
 *
 * Chosen to exercise every branch that can decide whether power exists, what
 * dose it carries, which exercise it picks, and whether the §18 weekly budget
 * keeps or strips it — because those are the branches that must survive power
 * becoming a row.
 *
 * Coverage, by the gate each scenario is aimed at:
 *
 *   `powerPrimerPolicy`   phase (off/pre/in-season), off-season subphase
 *                         (contrast is late-off-season only), team days,
 *                         game proximity, training age, and a lower-limb
 *                         niggle (which hands the lower slot to Pogo Hops).
 *   `powerExercisePool`   equipment (Depth Jumps needs a box), the training-age
 *                         ladder, and the in-season impact gate.
 *   §18 weekly budget     anchor pressure — 0, 1 and 2 team days, with and
 *                         without a Saturday game — which is what moves the
 *                         budget between 2, 1 and 0.
 *   the fence itself      a beginner (power ineligible at the budget) and a
 *                         full off-season week (power present on several days),
 *                         so both the empty and the loaded case are pinned.
 *
 * The UPPER family is deliberately not chased through generation. Family
 * follows the session's strength pattern and the engine picks that, so forcing
 * an upper-power day through a profile would be a fixture that tests the
 * engine's placement rather than the fence. `Explosive Push-up` — the one pool
 * entry that matches `MAIN_LIFT_EXERCISE_RX` — gets a direct targeted probe in
 * the test file instead, where the trap can be stated rather than hoped for.
 */

import type { OnboardingData } from '../../types/domain';

export interface PowerScenario {
  id: string;
  description: string;
  profile: OnboardingData;
  /** Season-phase clock entry; defaults to the harness's today. */
  phaseEntryWeekStartISO?: string;
}

const TEAM_DAYS = ['Tuesday', 'Thursday', 'Wednesday'] as const;

function baseProfile(overrides: Partial<OnboardingData> = {}): OnboardingData {
  return {
    // R-130 required fields; fixture predates the rule
    firstName: 'Power',
    gender: 'male',
    heightCm: 183,
    weightKg: 85,
    seasonFinishedOn: '2026-01-01',
    twoKmTimeTrial: { seconds: 465, recordedOn: '2026-01-01', source: 'onboarding' },
    seasonPhase: 'Off-season',
    position: 'inside_mid',
    motivation: 'Build strength and football fitness',
    trainingDaysPerWeek: 6,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    trainingLocation: 'Commercial gym',
    equipment: ['Full Gym'],
    equipmentSelectionCompleteness: 'complete',
    experienceLevel: '2-5 years',
    squatStrength: '1.5x bodyweight',
    benchStrength: '1.25x bodyweight',
    conditioningLevel: 'Elite',
    sprintExposure: '2+ times per week',
    recentTrainingLoad: 'Very consistent',
    injuries: [],
    ...overrides,
  } as OnboardingData;
}

function teamProfile(
  count: number,
  overrides: Partial<OnboardingData> = {},
): Partial<OnboardingData> {
  return {
    teamTrainingDaysPerWeek: count,
    teamTrainingDays: [...TEAM_DAYS.slice(0, count)],
    ...overrides,
  };
}

export const POWER_SCENARIOS: readonly PowerScenario[] = [
  {
    id: 'offseason-solo-consistent',
    description:
      'Off-season, no anchors, 2-5 years, full gym — the loaded case: budget 2, power on several days.',
    profile: baseProfile(),
  },
  {
    id: 'offseason-solo-advanced-late',
    description:
      'Off-season entered earlier so the block reaches late off-season, 5+ years — the contrast branch.',
    profile: baseProfile({ experienceLevel: '5+ years' }),
    phaseEntryWeekStartISO: '2026-04-13',
  },
  {
    id: 'offseason-beginner',
    description:
      'Complete beginner off-season — power is ineligible at the §18 budget (training_age_ineligible).',
    profile: baseProfile({
      experienceLevel: 'Complete beginner',
      squatStrength: 'Less than bodyweight',
      benchStrength: 'Less than bodyweight',
      conditioningLevel: 'Poor',
      recentTrainingLoad: 'Hardly at all',
      sprintExposure: 'No sprint training',
    }),
  },
  {
    id: 'offseason-no-equipment',
    description:
      'Off-season, bodyweight only — the pool drops Depth Jumps rather than substituting an implement.',
    profile: baseProfile({
      // "I own none of these" is an ANSWER (2026-07-31): the typed shape with
      // nothing marked. The old `equipment: ['None']` string was unrecognised,
      // which now reads as silence and silence is refused.
      equipment: undefined,
      equipmentSelectionCompleteness: undefined,
      equipmentAnswer: { tags: {}, modalities: {}, answeredOn: '2026-07-01' },
      trainingLocation: 'Outdoor',
    }),
  },
  {
    id: 'offseason-lower-niggle',
    description:
      'Off-season with a moderate hamstring niggle — the reduced flag hands the lower slot to Pogo Hops.',
    profile: baseProfile({
      injuries: [{
        bodyArea: 'Hamstring',
        description: 'Mild left hamstring tightness',
        severity: 'Mild',
      }] as OnboardingData['injuries'],
    }),
  },
  {
    id: 'preseason-two-team-days',
    description:
      'Pre-season, 2 team trainings, no game — anchor pressure drops the weekly power budget to 1.',
    profile: baseProfile({ seasonPhase: 'Pre-season', ...teamProfile(2) }),
  },
  {
    id: 'preseason-team-and-game',
    description:
      'Pre-season, 1 team training plus a Saturday game — a fixture plus one anchor.',
    profile: baseProfile({
      seasonPhase: 'Pre-season',
      ...teamProfile(1),
      usualGameDay: 'Saturday',
    } as Partial<OnboardingData>),
  },
  {
    id: 'inseason-two-team-and-game',
    description:
      'In-season, 2 team trainings plus a Saturday game — budget 0, and the in-season impact gate.',
    profile: baseProfile({
      seasonPhase: 'In-season',
      ...teamProfile(2),
      usualGameDay: 'Saturday',
    } as Partial<OnboardingData>),
  },
];
