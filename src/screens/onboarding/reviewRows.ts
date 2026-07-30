/**
 * THE Review rows — one per answer the athlete gave, derived from the step registry.
 *
 * THE DEFECT (Sam, device pass 2026-07-29). The 2km time trial shipped with no
 * Review row. Nothing was wrong with the stored answer; it simply could not be
 * seen or corrected from the screen whose entire job is seeing and correcting
 * answers.
 *
 * The general fault was that Review's rows were hand-listed inside the screen.
 * Adding a step to the flow and forgetting to add a row here failed silently, in
 * the direction that looks like nothing happened — which is why it survived to a
 * device pass rather than to a red test.
 *
 * WHAT CHANGED. Each row now declares the STEP that owns its answer, and a row
 * is included exactly when that step is `visible` for this profile. So the same
 * `ONBOARDING_STEPS` registry that decides what the athlete is asked also
 * decides what Review shows them, and `onboardingAnswerPresentationTests` walks
 * several profiles asserting the two agree in both directions:
 *
 *   - every step the athlete WAS asked has a row that routes back to it;
 *   - no row exists for a step they were NOT asked.
 *
 * The second direction is not pedantry. A complete beginner is never asked about
 * squat or bench, and the old screen showed them "Squat Strength — Not selected"
 * anyway: an invitation to correct an answer nobody wanted, and a complete
 * profile reading as an incomplete one.
 *
 * The rows are DATA — a row names its step, it does not carry a navigation
 * closure. The screen turns a step name into a `navigate`, which is the only
 * place that knows about navigation at all.
 */

import type {
  BenchStrength,
  ConditioningLevel,
  DayOfWeek,
  ExperienceLevel,
  OnboardingData,
  RecentTrainingLoad,
  SprintExposure,
  SquatStrength,
  TeamTrainingDuration,
  TeamTrainingIntensity,
  TwoKmTimeTrialAnswer,
} from '../../types/domain';
import { formatTwoKmTime } from '../../data/twoKmTimeTrial';
import { roleBucketLabel } from '../../utils/roleBuckets';
import { motivationDisplay, resolveMotivation } from '../../rules/motivationGoals';
import {
  ONBOARDING_STEPS,
  type OnboardingStepName,
} from '../../utils/onboardingSteps';

export type ReviewSectionTitle =
  | 'About You'
  | 'Body'
  | 'Season'
  | 'Training'
  | 'Physical'
  | 'Health';

export interface ReviewRowData {
  readonly label: string;
  readonly value: string;
  /** The step that owns this answer — where "Edit" goes. */
  readonly step: OnboardingStepName;
}

export interface ReviewSectionData {
  readonly title: ReviewSectionTitle;
  readonly rows: readonly ReviewRowData[];
}

interface ReviewRowSpec {
  readonly section: ReviewSectionTitle;
  readonly label: string;
  readonly step: OnboardingStepName;
  readonly value: (data: OnboardingData) => string;
}

// ─── Value formatters ───
//
// These live with the rows rather than on the screen. A formatter on the screen
// and a row here would be two answers to "what does this value say", and the
// screen's copy is the one that drifts unnoticed because nothing tests a render.

const DAY_ORDER: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const sortDays = (days: DayOfWeek[]): DayOfWeek[] =>
  [...days].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));

const formatDays = (days?: DayOfWeek[]): string | null => {
  if (!days || days.length === 0) return null;
  return sortDays(days).join(', ');
};

const formatTeamDuration = (duration?: TeamTrainingDuration): string | null => {
  if (!duration) return null;
  const labels: Record<TeamTrainingDuration, string> = {
    '60 minutes': '60 min',
    '90 minutes': '90 min',
    '2 hours': '2 hrs',
  };
  return labels[duration];
};

const formatTeamIntensity = (intensity?: TeamTrainingIntensity): string | null => {
  if (!intensity) return null;
  return intensity === 'Very intense' ? 'Very hard' : intensity;
};

const formatTeamSessions = (data: OnboardingData): string | null => {
  const parts = [
    formatTeamDuration(data.teamTrainingDuration as TeamTrainingDuration | undefined),
    formatTeamIntensity(data.teamTrainingIntensity as TeamTrainingIntensity | undefined),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
};

const formatExperience = (value?: ExperienceLevel): string => {
  if (!value) return 'Not selected';
  const labels: Record<ExperienceLevel, string> = {
    'Complete beginner': 'New to training',
    '1-2 years': 'Developing',
    '2-5 years': 'Consistent',
    '5+ years': 'Advanced',
  };
  return labels[value];
};

const formatSquatStrength = (value?: SquatStrength): string => {
  if (!value) return 'Not selected';
  const labels: Record<SquatStrength, string> = {
    "I don't squat": "I don't squat / not sure",
    'Less than bodyweight': 'Less than bodyweight',
    'Around bodyweight': 'Around bodyweight',
    '1.5x bodyweight': '1.5× bodyweight',
    '2x bodyweight+': '2× bodyweight+',
    'Not sure': "I don't squat / not sure",
  };
  return labels[value];
};

const formatBenchStrength = (value?: BenchStrength): string => {
  if (!value) return 'Not selected';
  const labels: Record<BenchStrength, string> = {
    "I don't bench": "I don't bench / not sure",
    'Less than bodyweight': 'Less than bodyweight',
    'Around bodyweight': 'Around bodyweight',
    '1.25x bodyweight': '1.25× bodyweight',
    '1.5x bodyweight+': '1.5× bodyweight+',
    'Not sure': "I don't bench / not sure",
  };
  return labels[value];
};

const formatConditioning = (value?: ConditioningLevel): string => {
  if (!value) return 'Not selected';
  const labels: Record<ConditioningLevel, string> = {
    Poor: 'Struggle early',
    Average: 'Fade late',
    Good: 'Solid',
    Elite: 'Very fit',
  };
  return labels[value];
};

const formatSprintWork = (value?: SprintExposure): string => {
  if (!value) return 'Not selected';
  const labels: Record<SprintExposure, string> = {
    'No sprint training': 'None',
    Occasionally: 'Occasional',
    '2+ times per week': 'Regular',
  };
  return labels[value];
};

const formatRecentTraining = (value?: RecentTrainingLoad): string => {
  if (!value) return 'Not selected';
  const labels: Record<RecentTrainingLoad, string> = {
    'Hardly at all': 'Hardly at all',
    'A bit': 'A bit',
    'Pretty consistent': 'Consistent',
    'Very consistent': 'Very consistent',
  };
  return labels[value];
};

/**
 * The 2km answer has THREE states and they are three different things.
 *
 * `seconds: null` is the athlete saying "I haven't tested it" — a real answer
 * that `deriveMas` acts on by applying the ruled default for their experience
 * level. Rendering it as a gap would invite them to "fix" a question they have
 * already answered, and would hide the fact that their paces come from an
 * estimate rather than a time they ran.
 */
const formatTwoKmAnswer = (answer?: TwoKmTimeTrialAnswer): string => {
  if (!answer) return 'Not provided';
  if (answer.seconds === null || answer.seconds === undefined) return "Haven't tested";
  return formatTwoKmTime(answer.seconds);
};

const present = (value: string | null | undefined): string =>
  value && value.trim().length > 0 ? value : 'Not selected';

// ─── The rows ───

const REVIEW_ROWS: readonly ReviewRowSpec[] = [
  {
    section: 'About You',
    label: 'Name',
    step: 'Name',
    value: (data) => present(data.firstName),
  },
  {
    section: 'About You',
    label: 'Footy role',
    step: 'Position',
    value: (data) => (data.position ? roleBucketLabel(data.position) : 'Not provided'),
  },
  {
    section: 'About You',
    label: 'Goals',
    step: 'Motivation',
    // DERIVED AT RENDER, per Sam's ruling. Was `data.motivation || goals.join(', ')` —
    // two shapes racing, with the stored sentence winning. `resolveMotivation` prefers the
    // typed decision and lifts a legacy sentence when that is all a profile has.
    value: (data) => present(motivationDisplay(resolveMotivation(data))),
  },
  {
    section: 'Body',
    label: 'Height',
    step: 'BodyMeasurements',
    value: (data) => (data.heightCm ? `${data.heightCm} cm` : 'Not provided'),
  },
  {
    section: 'Body',
    label: 'Weight',
    step: 'BodyMeasurements',
    value: (data) => (data.weightKg ? `${data.weightKg} kg` : 'Not provided'),
  },
  {
    section: 'Season',
    label: 'Season Phase',
    step: 'SeasonPhase',
    value: (data) => present(data.seasonPhase),
  },
  {
    section: 'Season',
    label: 'Game Day',
    step: 'GameDay',
    // The step's own `satisfied` accepts either field, so the row must speak
    // both — otherwise a calendar-anchored athlete reads as unanswered.
    value: (data) => present(data.gameDay || (data.usualGameDay as string | undefined)),
  },
  {
    section: 'Season',
    label: 'Team Training',
    step: 'TeamTrainingDays',
    value: (data) =>
      formatDays(data.teamTrainingDays as DayOfWeek[] | undefined)
      ?? (data.teamTrainingDaysPerWeek
        ? `${data.teamTrainingDaysPerWeek} days per week`
        : 'Not selected'),
  },
  {
    section: 'Season',
    label: 'Team Sessions',
    step: 'TeamTrainingDuration',
    value: (data) => formatTeamSessions(data) ?? 'Not selected',
  },
  {
    section: 'Training',
    label: 'LFA Days',
    step: 'TrainingCommitment',
    value: (data) =>
      data.trainingDaysPerWeek ? `${data.trainingDaysPerWeek} days per week` : 'Not selected',
  },
  {
    section: 'Training',
    label: 'LFA Training Days',
    step: 'PreferredTrainingDays',
    value: (data) =>
      formatDays(data.preferredTrainingDays as DayOfWeek[] | undefined) ?? 'Not selected',
  },
  {
    section: 'Physical',
    label: 'Training Experience',
    step: 'GymExperience',
    value: (data) => formatExperience(data.experienceLevel as ExperienceLevel | undefined),
  },
  {
    section: 'Physical',
    label: 'Squat Strength',
    step: 'SquatStrength',
    value: (data) => formatSquatStrength(data.squatStrength as SquatStrength | undefined),
  },
  {
    section: 'Physical',
    label: 'Bench Strength',
    step: 'BenchStrength',
    value: (data) => formatBenchStrength(data.benchStrength as BenchStrength | undefined),
  },
  {
    section: 'Physical',
    label: '2km Time',
    step: 'TwoKmTimeTrial',
    value: (data) => formatTwoKmAnswer(data.twoKmTimeTrial as TwoKmTimeTrialAnswer | undefined),
  },
  {
    section: 'Physical',
    label: 'Conditioning',
    step: 'ConditioningLevel',
    value: (data) => formatConditioning(data.conditioningLevel as ConditioningLevel | undefined),
  },
  {
    section: 'Physical',
    label: 'Sprint Work',
    step: 'SprintExposure',
    value: (data) => formatSprintWork(data.sprintExposure as SprintExposure | undefined),
  },
  {
    section: 'Physical',
    label: 'Recent Training',
    step: 'RecentTrainingLoad',
    value: (data) => formatRecentTraining(data.recentTrainingLoad as RecentTrainingLoad | undefined),
  },
  {
    section: 'Health',
    label: 'Injuries',
    step: 'Injuries',
    value: (data) =>
      data.injuries && data.injuries.length > 0
        ? `${data.injuries.length} reported`
        : 'No current issues',
  },
];

const SECTION_ORDER: readonly ReviewSectionTitle[] = [
  'About You',
  'Body',
  'Season',
  'Training',
  'Physical',
  'Health',
];

const stepIsVisible = (step: OnboardingStepName, data: OnboardingData): boolean =>
  ONBOARDING_STEPS.find((candidate) => candidate.name === step)?.visible(data) ?? false;

/**
 * Every answer this athlete gave, grouped for display, in flow order.
 *
 * A section with no visible rows is dropped rather than rendered empty — an
 * off-season athlete has no Season questions beyond the phase itself, and an
 * empty card headed "Season" reads as something failing to load.
 */
export function buildReviewSections(data: OnboardingData): ReviewSectionData[] {
  const visible = REVIEW_ROWS.filter((row) => stepIsVisible(row.step, data));
  return SECTION_ORDER
    .map((title) => ({
      title,
      rows: visible
        .filter((row) => row.section === title)
        .map((row) => ({ label: row.label, value: row.value(data), step: row.step })),
    }))
    .filter((section) => section.rows.length > 0);
}
