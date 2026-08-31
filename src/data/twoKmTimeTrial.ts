/**
 * LEGACY 2km TIME TRIAL + SHARED MAS MATH.
 *
 * WHY THIS EXISTS. Every %MAS prescription in the app was a STRING. Fifteen
 * conditioning template rows carry an intensity like '90-100% MAS', and
 * `sessionBuilder` renders a standing apology on every one of them — "Don't
 * know MAS? Send your 2km or 3km time trial." Nothing stored the athlete's
 * pace, so nothing could turn a percentage into a number anyone could run to.
 * `masCopy` even held a calculator with zero consumers, written against a MAS
 * that never arrived.
 *
 * THE ARCHITECTURE. Store the time. Derive MAS. Never store MAS. New Progress
 * 2km/3km histories live in `performanceTests`; this file retains the authored
 * 2km ingress, bounds, defaults and the one base MAS equation they reuse.
 *
 * A stored MAS is a second representation of the same fact, and second
 * representations drift: correct the time and the stale MAS keeps prescribing.
 * Deriving it means the disagreement is not merely discouraged, it is
 * unrepresentable. Everything downstream reads `deriveMas`, and nothing else in
 * the app knows what MAS means.
 *
 * SAM'S RULINGS live in docs/STAGE_C_TIME_TRIAL_RULINGS_2026-07-29.md and are
 * cited by anchor sentence below. `twoKmTimeTrialTests` asserts each sentence is
 * still in that document AND still states the numbers shipped here — so the
 * code and the ruling cannot drift apart in either direction.
 *
 * NAMING. `TT` means TEAM TRAINING everywhere in this codebase — twelve rule
 * files key on `teamTrainingDays`, and `finisherEligibilityTests` documents
 * "game window / TT day / TT-adjacent finishers". Sam ruled (2026-07-29) that
 * the time trial never shares that token. It is `timeTrial` / `time_trial` /
 * `twoKm` here and everywhere downstream.
 */

// The stored shape lives in `types/domain` with the other onboarding answers —
// `OnboardingData` has to reference it, and the type home is the one place that
// can hold it without the two files importing each other in a circle.
import type {
  ExperienceLevel,
  TwoKmTimeTrialAnswer,
  TwoKmTimeTrialSource,
} from '../types/domain';
import {
  validateAgainstBound,
  type BoundAttribution,
  type MeasurementValidation,
  type NumericBound,
} from './numericBound';

const STAGE_C_RULING: BoundAttribution = {
  ruledOn: '2026-07-29',
  where: 'docs/STAGE_C_TIME_TRIAL_RULINGS_2026-07-29.md',
};

// ─── Display ───

/** Seconds as the athlete typed them: 300 -> "5:00", 435 -> "7:15". */
export function formatTwoKmTime(seconds: number): string {
  const whole = Math.round(seconds);
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

// ─── The accepted range ───

/**
 * Sam, 2026-07-29: "accept 5:00-15:00. Out of range = re-ask with a plain
 * message, never clamp, never silently accept — same law as bodyweight."
 *
 * The no-clamping half is the point, and it is the bodyweight law
 * (`onboardingNumericBounds`) applied to pace. A clamp substitutes the app's
 * number for the athlete's and then carries on as though they had agreed to it.
 *
 * Stored in seconds, spoken in min:sec — see `format` and `NumericBound`.
 */
export const TWO_KM_SECONDS_BOUND: NumericBound = {
  min: 300,
  max: 900,
  unit: 'min:sec',
  noun: 'time',
  anchor: '2km time trial accepted range 5:00–15:00, that is 300–900 seconds.',
  attribution: STAGE_C_RULING,
  format: formatTwoKmTime,
};

// ─── The derivation ───

/**
 * Sam, 2026-07-29: "1.00 — MAS = 2km average speed, no correction. Standard
 * field proxy; the %MAS templates were authored against an honest average."
 *
 * WHAT THIS REPLACED. `masCopy` derived MAS the same way but never authored it,
 * and justified it with a comment that contradicted itself:
 *
 *   "Conservative estimate — actual MAS is typically 1-3% higher than TT
 *    average pace because TTs are run slightly above MAS"
 *
 * If a time trial is run ABOVE MAS then MAS is LOWER than time-trial pace, not
 * higher. The comment argued for a discount, called that conservative, and
 * applied neither. The number it produced happens to be the one Sam ruled — but
 * an unauthored number that is accidentally right is still unauthored, and its
 * stated reason pointed in both directions at once.
 *
 * Anchor: MAS = 2km average speed × 1.00, no correction.
 */
export const MAS_FROM_TIME_TRIAL_MULTIPLIER = 1.0;

/** The distance, in km. Named so the derivation reads as physics, not magic. */
const TWO_KM = 2;

/**
 * Sam, 2026-07-25, re-confirmed 2026-07-29: a skipped time trial gets a signed
 * default pace by experience level (descending experience): advanced 6:30,
 * 2-5yrs 7:15, 1-2yrs 8:00, new to training 8:45 per 2km.
 *
 * `satisfies Record<ExperienceLevel, number>` is load-bearing. Sam's four values
 * cover the enum exactly, so there is no fallback branch — and if the enum ever
 * grows a fifth level, this fails the BUILD rather than quietly handing the new
 * level somebody else's pace.
 *
 * Anchor: Skipped 2km time trial defaults: 5+ years 6:30, 2-5 years 7:15,
 * 1-2 years 8:00, Complete beginner 8:45.
 */
export const TWO_KM_TIME_TRIAL_DEFAULTS = {
  '5+ years': 390,          // 6:30
  '2-5 years': 435,         // 7:15
  '1-2 years': 480,         // 8:00
  'Complete beginner': 525, // 8:45
} as const satisfies Record<ExperienceLevel, number>;

// ─── Derivation ───

export interface DerivedMas {
  readonly masKmh: number;
  /**
   * `measured` — derived from a time the athlete actually ran.
   * `experience_default` — derived from Sam's signed default for their level.
   *
   * Carried so consumers can say "your MAS" or "our estimate" honestly rather
   * than presenting a guess with the same confidence as a measurement.
   */
  readonly source: 'measured' | 'experience_default';
  /** The time the MAS was derived from, in seconds. */
  readonly seconds: number;
}

/**
 * Derive MAS from the athlete's answer, or from the ruled default for their
 * experience level when they have not tested.
 *
 * THE DEFAULT IS APPLIED HERE, NEVER WRITTEN INTO STORAGE. Freezing it into the
 * stored answer would do two bad things at once: erase the difference between
 * the athlete's number and the app's guess, and pin that guess against a later
 * experience-level change. This is `applyLoadEstimates`' priority ladder —
 * the athlete's real data beats the onboarding estimate — applied to pace
 * instead of load.
 */
export function deriveMas(
  answer: TwoKmTimeTrialAnswer | undefined,
  experienceLevel: ExperienceLevel,
): DerivedMas {
  const measured = answer && answer.seconds !== null && answer.seconds !== undefined;
  const seconds = measured
    ? answer.seconds
    : TWO_KM_TIME_TRIAL_DEFAULTS[experienceLevel];
  const hours = seconds / 3600;
  return {
    masKmh: (TWO_KM / hours) * MAS_FROM_TIME_TRIAL_MULTIPLIER,
    source: measured ? 'measured' : 'experience_default',
    seconds,
  };
}

// ─── The ingress ───

export interface RecordTwoKmTimeResult {
  readonly ok: boolean;
  /** Present exactly when `ok`. A refusal commits nothing. */
  readonly answer?: TwoKmTimeTrialAnswer;
  /** Present exactly when refused — the same sentence the screen shows. */
  readonly message?: string;
}

/**
 * THE one ingress. Every producer of a 2km time goes through here:
 * the onboarding screen, the profile editor, a logged time-trial session, and
 * coach chat ("my 2km is 7:20").
 *
 * The fourth producer is why the law lives here rather than on a screen. Coach
 * chat is unconstrained free text, so no amount of UI discipline can enforce
 * the bound — a screen can only ever be the ruling's politest face.
 *
 * A refusal writes NOTHING and suggests NOTHING. Handing back a corrected value
 * would invite the athlete to accept the app's number as their own, which is
 * the clamp the ruling exists to forbid, one tap further away.
 */
export function recordTwoKmTime(
  seconds: number | null,
  source: TwoKmTimeTrialSource,
  today: string,
): RecordTwoKmTimeResult {
  // "Haven't tested" is an answer, and a range does not apply to it.
  if (seconds === null) {
    return { ok: true, answer: { seconds: null, recordedOn: today, source } };
  }
  const validation = validateTwoKmTime(seconds);
  if (!validation.ok) return { ok: false, message: validation.message };
  return { ok: true, answer: { seconds, recordedOn: today, source } };
}

/** Accept a 2km time against Sam's ruled range, or refuse it with words. */
export function validateTwoKmTime(seconds: number): MeasurementValidation {
  return validateAgainstBound(TWO_KM_SECONDS_BOUND, seconds);
}
