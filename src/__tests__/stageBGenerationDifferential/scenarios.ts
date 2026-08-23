/**
 * The Stage B generation-differential scenario matrix.
 *
 * Stage 0 of Stage B (docs/STAGE_B_PROMPT_DRAFT_2026-07-29.md §Discipline,
 * docs/STAGE_B_KICKOFF_ADDENDUM_2026-08-03.md §6): snapshot CURRENT generation
 * output across a scenario matrix BEFORE anything changes, so every later
 * stage's diff is a prediction checked against a committed baseline rather
 * than a hope. The power-counting differential proved the pattern
 * (src/__tests__/powerCountingDifferential/) — this matrix widens it from
 * power counts to the whole generated program, because Stage B rebuilds the
 * whole engine.
 *
 * Dimension coverage, and which Stage B scope item each is aimed at:
 *
 *   season phase + subphase   the week-mode contracts (draft §Scope 1) —
 *                             early/mid/late off-season and pre-season reached
 *                             by moving `phaseEntryWeekStartISO`, in-season by
 *                             declaration. The snapshot records the resolved
 *                             `identity.mode` per week, so which modes this
 *                             matrix ACTUALLY reaches is pinned in the golden,
 *                             not assumed here.
 *   team days 0/1/2 + game    day placement, anchors, hard-day spacing,
 *                             game proximity (draft §Scope 1)
 *   experience ladder         master-sheet experience gates + regressions
 *                             (draft §Scope 3), power eligibility
 *   equipment                 selection under the typed EquipmentAnswer
 *                             (addendum §1.7)
 *   injury                    selection filtering through the one owner
 *                             (addendum §1.11) at Mild, AND pattern
 *                             restriction at Severe — two different rule sets,
 *                             and only the second reaches the restricted-week
 *                             frequency rules. See the note above
 *                             `offseason-severe-restriction`.
 *   training days 3 vs 6      density + placement under scarcity
 *   conditioning level        conditioning dose derivation (draft §Scope 2)
 *
 * Modes this matrix does NOT reach (declared, per the golden's mode census):
 * bye weeks and practice-match weeks need fixture facts that
 * `generateProgramLocally` does not take from onboarding alone, and
 * `optional_week` needs the early-off-season all-optional contract's calendar
 * position. Their absence is recorded in the Stage 0 boundary report's
 * NOT-COVERED, and they join the matrix in the stage that first touches them.
 */

import type { OnboardingData } from '../../types/domain';

export interface StageBScenario {
  id: string;
  description: string;
  profile: OnboardingData;
  /** Season-phase clock entry; defaults to the harness's pinned today. */
  phaseEntryWeekStartISO?: string;
}

const TEAM_DAYS = ['Tuesday', 'Thursday', 'Wednesday'] as const;

function baseProfile(overrides: Partial<OnboardingData> = {}): OnboardingData {
  return {
    // R-130: required answer, no default. `male` is the byte-identity control —
    // a male-stamped profile must generate exactly the pre-R-130 output, and
    // this golden is the instrument that holds that claim.
    gender: 'male',
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

export const STAGE_B_SCENARIOS: readonly StageBScenario[] = [
  {
    id: 'offseason-early-solo',
    description:
      'Off-season entered this week, no anchors, 2-5 years, full gym, 6 days — the loaded baseline.',
    profile: baseProfile(),
  },
  {
    id: 'offseason-mid',
    description:
      'Off-season entered ~9 weeks back — the mid-off-season subphase branch.',
    profile: baseProfile(),
    phaseEntryWeekStartISO: '2026-05-25',
  },
  {
    id: 'offseason-late-advanced',
    description:
      'Off-season entered 2026-04-13, 5+ years — late off-season, the contrast branch.',
    profile: baseProfile({ experienceLevel: '5+ years' }),
    phaseEntryWeekStartISO: '2026-04-13',
  },
  {
    id: 'offseason-beginner',
    description:
      'Complete beginner off-season — regressions, experience gates, power ineligible.',
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
      'Off-season, typed "I own none of these" answer, outdoor — selection under restriction.',
    profile: baseProfile({
      equipment: undefined,
      equipmentSelectionCompleteness: undefined,
      equipmentAnswer: { tags: {}, modalities: {}, answeredOn: '2026-07-01' },
      trainingLocation: 'Outdoor',
    }),
  },
  {
    id: 'offseason-lower-niggle',
    description:
      'Off-season with a mild hamstring niggle — injury routing filters selection.',
    profile: baseProfile({
      injuries: [{
        bodyArea: 'Hamstring',
        description: 'Mild left hamstring tightness',
        severity: 'Mild',
      }] as OnboardingData['injuries'],
    }),
  },
  {
    id: 'offseason-three-days',
    description:
      'Off-season, 3 training days — placement and density under scarcity.',
    profile: baseProfile({
      trainingDaysPerWeek: 3,
      preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
    }),
  },
  {
    id: 'preseason-early-solo',
    description: 'Pre-season entered this week, no anchors — the early pre-season contract.',
    profile: baseProfile({ seasonPhase: 'Pre-season' }),
  },
  {
    id: 'preseason-late',
    description:
      'Pre-season entered 2026-05-04 — the late pre-season subphase branch.',
    profile: baseProfile({ seasonPhase: 'Pre-season' }),
    phaseEntryWeekStartISO: '2026-05-04',
  },
  {
    id: 'preseason-two-team-days',
    description: 'Pre-season, 2 team trainings, no game — anchor pressure without a fixture.',
    profile: baseProfile({ seasonPhase: 'Pre-season', ...teamProfile(2) }),
  },
  {
    id: 'preseason-team-and-game',
    description: 'Pre-season, 1 team training plus a Saturday game.',
    profile: baseProfile({
      seasonPhase: 'Pre-season',
      ...teamProfile(1),
      usualGameDay: 'Saturday',
    } as Partial<OnboardingData>),
  },
  {
    id: 'inseason-game-week',
    description:
      'In-season, 2 team trainings plus a Saturday game — the full game-week shape (G-3/G-2/G-1/G+1).',
    profile: baseProfile({
      seasonPhase: 'In-season',
      ...teamProfile(2),
      usualGameDay: 'Saturday',
    } as Partial<OnboardingData>),
  },
  {
    id: 'inseason-one-anchor-game',
    description: 'In-season, 1 team training plus a Saturday game — lighter anchor pressure.',
    profile: baseProfile({
      seasonPhase: 'In-season',
      ...teamProfile(1),
      usualGameDay: 'Saturday',
    } as Partial<OnboardingData>),
  },
  {
    id: 'inseason-poor-conditioning',
    description:
      'In-season game week, conditioning level Poor, average strength — the dose ladder low end.',
    profile: baseProfile({
      seasonPhase: 'In-season',
      ...teamProfile(2),
      usualGameDay: 'Saturday',
      conditioningLevel: 'Poor',
      squatStrength: 'Around bodyweight',
      benchStrength: 'Less than bodyweight',
      recentTrainingLoad: 'A bit',
    } as Partial<OnboardingData>),
  },
  // THE INJURY DIMENSION ABOVE DOES NOT REACH THE RESTRICTION RULES, measured.
  //
  // `offseason-lower-niggle` is a MILD profile injury, and
  // `resolveRestrictedMainStrengthPatterns` restricts profile injuries only at
  // SEVERE. Measured against the healthy control on the unfixed tree, every
  // field matched: no prohibited patterns, no reductions, the same week shape.
  // So the matrix's "injury" scenario was, for the pattern-restriction rules, a
  // second copy of `offseason-early-solo` — coverage that reads as coverage and
  // is not (`docs/FINDING_3_MATRIX_COVERAGE_PREDICTIONS_2026-08-06.md`).
  //
  // This scenario reaches BOTH sites that state the frequency rule, which is
  // the property that matters: paying one alone left the world unchanged
  // (`docs/FINDING_3_BUILD_MEASUREMENT_2026-08-06.md` §1). Its baseline shows
  // site 2's cap as `main_strength/weekly_exposure_count:3->2` and site 1's as
  // `main_strength_frequency:3->2`.
  //
  // APPENDED LAST, deliberately. The golden's `scenarios` array follows this
  // declaration order, so appending keeps the golden diff purely ADDITIVE —
  // every existing scenario stays at its index, on its own lines. Declaring it
  // beside `offseason-lower-niggle` would group better here and would shift
  // every later scenario's byte position, destroying the one property the
  // coverage diff needs to be able to prove.
  {
    id: 'offseason-severe-restriction',
    description:
      'Off-season with a SEVERE hamstring — squat and hinge prohibited, the '
      + 'restricted-week frequency rules reached at both sites.',
    profile: baseProfile({
      injuries: [{
        bodyArea: 'Hamstring',
        description: 'Severe left hamstring strain',
        severity: 'Severe',
      }] as OnboardingData['injuries'],
    }),
  },
];
