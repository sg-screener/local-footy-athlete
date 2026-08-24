import type { OnboardingData } from '../types/domain';
import { resolveMotivation } from '../rules/motivationGoals';
import { equipmentAnswered } from './equipmentAvailability';

/**
 * THE onboarding step registry.
 *
 * Before this module the flow's shape existed in three places — the navigator's
 * screen list, `useOnboardingProgress`'s `ONBOARDING_SCREENS`, and
 * `generateProgram`'s `REQUIRED_PROGRAM_GEN_PROFILE_FIELDS` — and nothing kept
 * them agreeing. That is what let the athlete reach Review with a profile the
 * generator then silently defaulted around
 * (docs/ONBOARDING_PERSISTENCE_DIAGNOSIS_2026-07-24.md §2).
 *
 * One declaration now owns, per step: whether it is visible, what it collects,
 * and whether the athlete has actually answered it. Progress display, resume
 * after an interrupted flow, the Review/generation refusal, and the generator's
 * required-field diagnostics are all derived from it.
 */

export type OnboardingStepName =
  | 'Name'
  | 'Gender'
  | 'BodyMeasurements'
  | 'Position'
  | 'Motivation'
  | 'SeasonPhase'
  | 'SeasonFinished'
  | 'GameDay'
  | 'TeamTrainingDays'
  | 'TrainingCommitment'
  | 'PreferredTrainingDays'
  | 'Equipment'
  | 'GymExperience'
  | 'SquatStrength'
  | 'BenchStrength'
  | 'TwoKmTimeTrial'
  | 'ConditioningLevel'
  | 'SprintExposure'
  | 'RecentTrainingLoad'
  | 'Injuries'
  | 'Review';

export interface OnboardingStep {
  readonly name: OnboardingStepName;
  /** Athlete-facing name of the answer, used in refusal copy. */
  readonly answerLabel: string;
  /** Profile fields this step writes — the generator's required set. */
  readonly collects: readonly (keyof OnboardingData)[];
  /** Whether this step appears at all for the given profile. */
  readonly visible: (data: OnboardingData) => boolean;
  /** Whether the athlete has answered it. */
  readonly satisfied: (data: OnboardingData) => boolean;
}

const always = (): boolean => true;

const inSeason = (data: OnboardingData): boolean => data.seasonPhase === 'In-season';

const offSeason = (data: OnboardingData): boolean => data.seasonPhase === 'Off-season';

const preOrInSeason = (data: OnboardingData): boolean =>
  data.seasonPhase === 'Pre-season' || data.seasonPhase === 'In-season';

const notBeginner = (data: OnboardingData): boolean =>
  data.experienceLevel !== 'Complete beginner';

const filled = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && String(value).trim() !== '';
};

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    name: 'Name',
    answerLabel: 'your name',
    collects: ['firstName'],
    visible: always,
    satisfied: (data) => filled(data.firstName),
  },
  {
    // R-130 (Sam, 2026-08-23): one switch, Male or Female, asked EARLY because
    // generation reads it, required with no default — there are no pre-R-130
    // athletes. Immutable after onboarding: no edit surface collects it, and
    // `satisfied` accepting only the two literal answers is what makes a
    // profile that somehow lost it march back through this step rather than
    // generate around the gap.
    name: 'Gender',
    answerLabel: 'your gender',
    collects: ['gender'],
    visible: always,
    satisfied: (data) => data.gender === 'male' || data.gender === 'female',
  },
  {
    name: 'BodyMeasurements',
    answerLabel: 'your height and weight',
    collects: ['heightCm', 'weightKg'],
    visible: always,
    satisfied: (data) => filled(data.heightCm) && filled(data.weightKg),
  },
  {
    name: 'Position',
    answerLabel: 'your footy role',
    collects: ['position'],
    visible: always,
    satisfied: (data) => filled(data.position),
  },
  {
    name: 'Motivation',
    answerLabel: 'what you want out of training',
    // `goals` is what the door writes now (Sam, 2026-07-30). It was `motivation`, and
    // leaving it there would have been a silent onboarding lock: the screen stopped
    // writing that field, so `satisfied` could never become true and
    // `resolveOnboardingResumeStep` would have returned the athlete to this screen
    // forever, however many times they answered it.
    collects: ['goals'],
    visible: always,
    // Answering only "Other" is a real answer — free text with no authored goal beside
    // it — so satisfaction asks the resolver, not either field on its own.
    satisfied: (data) => {
      const resolved = resolveMotivation(data);
      return resolved.goals.length > 0 || !!resolved.other;
    },
  },
  {
    name: 'SeasonPhase',
    answerLabel: 'where you are in the season',
    collects: ['seasonPhase'],
    visible: always,
    satisfied: (data) => filled(data.seasonPhase),
  },
  {
    name: 'SeasonFinished',
    answerLabel: 'when your season finished',
    collects: ['seasonFinishedOn'],
    visible: offSeason,
    // null is the explicit "I'm not sure" answer; undefined is silence.
    satisfied: (data) => Object.prototype.hasOwnProperty.call(data, 'seasonFinishedOn'),
  },
  {
    name: 'GameDay',
    answerLabel: 'your game day',
    collects: ['gameDay'],
    visible: inSeason,
    // `usualGameDay` is the calendar-anchored equivalent and satisfies the
    // same requirement, matching the generator's long-standing rule.
    satisfied: (data) => filled(data.gameDay) || filled(data.usualGameDay),
  },
  {
    name: 'TeamTrainingDays',
    answerLabel: 'your team training days',
    collects: ['teamTrainingDaysPerWeek', 'teamTrainingDays'],
    visible: preOrInSeason,
    satisfied: (data) => filled(data.teamTrainingDays),
  },
  {
    name: 'TrainingCommitment',
    answerLabel: 'how many days a week you can get to a gym or your usual strength equipment',
    collects: ['trainingDaysPerWeek'],
    visible: always,
    satisfied: (data) => filled(data.trainingDaysPerWeek),
  },
  {
    name: 'PreferredTrainingDays',
    answerLabel: 'which days you can usually get there',
    collects: ['preferredTrainingDays'],
    visible: always,
    satisfied: (data) => filled(data.preferredTrainingDays),
  },
  {
    name: 'Equipment',
    // REQUIRED (Sam's ruling 2, 2026-07-31): generation does not run without an
    // equipment answer, so this step has no skip. The checklist's CONTENT is
    // derived from the exercise library (`rules/equipmentVocabulary`), never
    // authored beside it. Answering "I have none of these" is an answer —
    // refusal is for silence, not poverty.
    answerLabel: 'what equipment you have',
    collects: ['equipmentAnswer'],
    visible: always,
    // `equipmentAnswered`, not `filled`: a legacy explicitly-complete selection
    // (the coach baseline door's shape) already answered this question, and an
    // existing install that did so must not be marched back through the step.
    satisfied: (data) => equipmentAnswered(data),
  },
  {
    name: 'GymExperience',
    answerLabel: 'your gym experience',
    collects: ['experienceLevel'],
    visible: always,
    satisfied: (data) => filled(data.experienceLevel),
  },
  {
    name: 'SquatStrength',
    answerLabel: 'your squat strength',
    collects: ['squatStrength'],
    visible: notBeginner,
    satisfied: (data) => filled(data.squatStrength),
  },
  {
    name: 'BenchStrength',
    answerLabel: 'your bench strength',
    collects: ['benchStrength'],
    visible: notBeginner,
    satisfied: (data) => filled(data.benchStrength),
  },
  {
    name: 'TwoKmTimeTrial',
    answerLabel: 'your 2km time',
    collects: ['twoKmTimeTrial'],
    // Squat and bench are hidden from complete beginners; the time trial is
    // not. A beginner is exactly who most needs the ruled default pace, and
    // plenty have run a club 2km without ever having touched a barbell.
    visible: always,
    // Answering "haven't tested" writes `seconds: null`, which is an ANSWER.
    // The step is satisfied by the field being present at all — if a skip were
    // treated as unanswered, an interrupted flow would resume onto a screen the
    // athlete had already dismissed, forever.
    satisfied: (data) => data.twoKmTimeTrial !== undefined && data.twoKmTimeTrial !== null,
  },
  {
    name: 'ConditioningLevel',
    answerLabel: 'your conditioning',
    collects: ['conditioningLevel'],
    visible: always,
    satisfied: (data) => filled(data.conditioningLevel),
  },
  {
    name: 'SprintExposure',
    answerLabel: 'how much sprinting you do',
    collects: ['sprintExposure'],
    visible: always,
    satisfied: (data) => filled(data.sprintExposure),
  },
  {
    name: 'RecentTrainingLoad',
    answerLabel: 'how much you have been training lately',
    collects: ['recentTrainingLoad'],
    visible: always,
    satisfied: (data) => filled(data.recentTrainingLoad),
  },
  {
    name: 'Injuries',
    answerLabel: 'your injury history',
    collects: ['injuries'],
    // Answering "no injuries" is an empty array, not a missing field.
    visible: always,
    satisfied: (data) => Array.isArray(data.injuries),
  },
  {
    name: 'Review',
    answerLabel: 'your profile review',
    collects: [],
    visible: always,
    satisfied: always,
  },
];

/**
 * EMPTY, and kept as a declaration so "no field is store-guaranteed" is a
 * stated fact rather than an absence. It used to carry `trainingLocation` and
 * `equipment` — "guaranteed from initial state" was true only because nothing
 * could ever set them (the equipment ownership sheet's headline finding). The
 * store's initial data is honestly empty now; every required answer has a
 * step that owns it.
 */
export const PROFILE_DEFAULT_REQUIRED_FIELDS: readonly (keyof OnboardingData)[] = [];

export function visibleOnboardingSteps(data: OnboardingData): OnboardingStep[] {
  return ONBOARDING_STEPS.filter((step) => step.visible(data));
}

/** Steps that carry a question — Review is the terminus, not an answer. */
export function answerableOnboardingSteps(data: OnboardingData): OnboardingStep[] {
  return visibleOnboardingSteps(data).filter((step) => step.name !== 'Review');
}

/**
 * Where an interrupted flow should resume: the first visible step the athlete
 * has not answered, or Review once every visible step is answered.
 */
export function resolveOnboardingResumeStep(data: OnboardingData): OnboardingStepName {
  const unanswered = answerableOnboardingSteps(data).find((step) => !step.satisfied(data));
  return unanswered?.name ?? 'Review';
}

/**
 * Profile fields the visible flow was responsible for collecting and did not.
 *
 * Derived from each step's own `satisfied` predicate rather than a field-by-
 * field null check, so equivalences the flow accepts (a calendar-anchored
 * `usualGameDay` standing in for `gameDay`) stay in one place.
 */
export function missingRequiredProfileFields(data: OnboardingData): string[] {
  const missing = PROFILE_DEFAULT_REQUIRED_FIELDS
    .filter((field) => !filled(data[field]))
    .map(String);
  for (const step of answerableOnboardingSteps(data)) {
    if (step.satisfied(data)) continue;
    missing.push(...step.collects.map(String));
  }
  return missing;
}
