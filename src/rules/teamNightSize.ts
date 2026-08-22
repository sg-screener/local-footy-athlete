/**
 * HOW BIG IS A TEAM NIGHT — measured, not assumed.
 *
 * SAM'S RULINGS. The principle, 2026-07-30:
 *
 *   > The onboarding team-training duration and intensity answers are a
 *   > STARTING ASSUMPTION ONLY. Season reality varies — some team nights hard, some
 *   > lighter — so a static onboarding answer can never own team-night size. The
 *   > ESTIMATE→MEASURED pattern applies, same as loads and the 2km TT.
 *
 * Then the mechanism, signed in full (`docs/TEAM_NIGHT_SIZE_SHEET_2026-07-30.md`):
 *
 *   > The one-question mechanism ("How was training?" Light / Normal / Hard) on the
 *   > existing completion flow for team-training days, stored in `SessionFeedback`;
 *   > size = rolling read of the LAST 3 logged team nights; silence = onboarding seed
 *   > persists (never decays); a Hard night informs next WEEK, never next day (readiness
 *   > door owns today); the team-training
 *   > duration question STOPS BEING ASKED at onboarding.
 *
 * THIS MODULE STORES NOTHING. The size is a pure read over answers the athlete already
 * gave — the north star's shape exactly: the ANSWERS are stored (in `SessionFeedback`,
 * per date, through the existing transaction), and the size is derived every time it is
 * asked for. A stored `teamNightSize` would be a second copy of an answer, which the
 * convergence rule presumes wrong.
 */

import type { TeamTrainingIntensity } from '../types/domain';
import { registerSignedCopy, signedCopy } from './signedCopy';

/**
 * The three answers, and the Bible's own scale.
 *
 * `:704` — "Light = skills/touch, low running · Moderate = normal training · Hard = lots
 * of running, sprinting, contact, match sim". The athlete-facing middle word is "Normal"
 * rather than "Moderate" because that is the word Sam signed for the question; the two
 * name the same rung.
 */
export type TeamNightSize = 'light' | 'normal' | 'hard';

export const TEAM_NIGHT_SIZES: readonly TeamNightSize[] = ['light', 'normal', 'hard'];

/**
 * WHAT THE ATHLETE READS — Sam's signed answer set, 2026-07-30.
 *
 * The sub-labels are the Bible's own `:704` descriptions, shortened to chip width. They
 * are here rather than in the panel for the same reason the goal options are: a label
 * written in a component is a word nobody signed, and this is the list Sam signed.
 */
export const TEAM_NIGHT_SIZE_OPTIONS: readonly {
  readonly key: TeamNightSize;
  readonly label: string;
  readonly color: string;
}[] = [
  { key: 'light', label: 'Light', color: '#81C784' },
  { key: 'normal', label: 'Normal', color: '#C8FF00' },
  { key: 'hard', label: 'Hard', color: '#EF5350' },
];

/** One logged team night: the athlete's answer, and the date they answered it about. */
export interface LoggedTeamNight {
  readonly dateISO: string;
  readonly size: TeamNightSize;
}

/**
 * How many logged nights the rolling read looks at. Sam: "the LAST 3".
 *
 * Fewer than three is not a failure — the read uses what exists, and reports how many it
 * had, so a consumer can tell a confident size from a single night's.
 */
export const TEAM_NIGHT_WINDOW = 3;

export type TeamNightSizeSource =
  /** At least one logged team night before this week. The athlete's own measurements. */
  | 'measured'
  /** No logged nights yet: the onboarding answer, still standing. */
  | 'onboarding_seed'
  /** No logged nights and no onboarding answer. The app knows nothing and says so. */
  | 'unknown';

export interface ResolvedTeamNightSize {
  /** `null` only when the source is `unknown` — absence renders as absence. */
  readonly size: TeamNightSize | null;
  readonly source: TeamNightSizeSource;
  /** How many logged nights the read actually used (0–3). */
  readonly sampleSize: number;
}

/**
 * THE SEED. The onboarding intensity answer, on the same three-rung scale.
 *
 * Four answers, three rungs: `Hard` and `Very intense` both seed `hard`. That is not a
 * loss — the seed's whole job is to be replaced by the first logged night, and the
 * distinction between "hard" and "match-level" has no consumer that measurement will not
 * supply better. Recorded here rather than assumed, because it is the one place the four
 * become three.
 */
const SEED_BY_INTENSITY: Readonly<Record<TeamTrainingIntensity, TeamNightSize>> = {
  Light: 'light',
  Moderate: 'normal',
  Hard: 'hard',
  'Very intense': 'hard',
};

export function teamNightSeedFor(
  intensity: TeamTrainingIntensity | null | undefined,
): TeamNightSize | null {
  if (!intensity) return null;
  return SEED_BY_INTENSITY[intensity] ?? null;
}

/**
 * THE WORDS, IN THE SHEET.
 *
 * Sam signed this question and its three answers in the team-night ruling, so they enter
 * the signed-copy registry with `signed_sentence` provenance rather than sitting as
 * literals in a component. This is the sheet's first population — it shipped empty at
 * stage 1 precisely so that entries would arrive with a ruling attached, one at a time,
 * instead of being backfilled with invented wording.
 */
registerSignedCopy([
  {
    id: 'team_night_size_question',
    source: 'signed_sentence',
    provenance: 'Sam, 2026-07-30 — team-night size sheet ruling: the one-question '
      + 'mechanism ("How was training?" Light / Normal / Hard, Sam-signed copy) on the '
      + 'existing completion flow for team-training days.',
    text: 'How was training?',
  },
  ...TEAM_NIGHT_SIZE_OPTIONS.map((option) => ({
    id: `team_night_size_answer_${option.key}`,
    source: 'signed_sentence' as const,
    provenance: 'Sam, 2026-07-30 — the three answers he signed, matching the Bible\'s own '
      + 'scale at `:704` ("Light = skills/touch, low running · Moderate = normal training '
      + '· Hard = lots of running, sprinting, contact, match sim").',
    text: option.label,
  })),
  {
    id: 'team_training.feedback.duration_question',
    source: 'sam_ruling',
    provenance: 'SIGNED — Sam, 2026-08-22, one shape for the same question on all '
      + 'three feedback forms: the game asks for rough time on ground and the gym for '
      + 'rough time in the gym, so this one no longer asks a differently-shaped '
      + 'question. Supersedes the 2026-08-11 wording (batch 18-b-i-A).',
    text: 'Rough time at training',
  },
  {
    id: 'team_training.feedback.effort_question',
    source: 'sam_ruling',
    provenance: 'Sam, 2026-08-11 — verbatim team-training feedback question.',
    text: 'How hard was team training?',
  },
  {
    id: 'team_training.feedback.effort_hint',
    source: 'sam_ruling',
    provenance: 'Sam, 2026-08-12 — the common scale is 1-10; supersedes the 2026-08-11 1-5 ruling.',
    text: '1 = very easy · 10 = very hard',
  },
  {
    id: 'team_training.feedback.duration_refusal',
    source: 'sam_ruling',
    provenance: 'Sam, 2026-08-11 — hours and minutes follow the existing match duration input.',
    text: 'Enter a time, with minutes between 0 and 59.',
  },
]);

export const TEAM_TRAINING_FEEDBACK_COPY = {
  durationQuestion: signedCopy('team_training.feedback.duration_question'),
  effortQuestion: signedCopy('team_training.feedback.effort_question'),
  effortHint: signedCopy('team_training.feedback.effort_hint'),
  durationRefusal: signedCopy('team_training.feedback.duration_refusal'),
} as const;

const ORDINAL: Readonly<Record<TeamNightSize, number>> = { light: 0, normal: 1, hard: 2 };
const BY_ORDINAL: readonly TeamNightSize[] = ['light', 'normal', 'hard'];

export interface DeriveTeamNightSizeInput {
  /** Every logged team night the athlete has. Order does not matter. */
  readonly loggedNights: readonly LoggedTeamNight[];
  /** The onboarding `teamTrainingIntensity` answer, if they gave one. */
  readonly onboardingIntensity?: TeamTrainingIntensity | null;
  /**
   * The Monday of the week being planned.
   *
   * THIS IS THE LAW, NOT A CONVENIENCE. Sam: "a Hard night informs next WEEK, never next
   * day (readiness door owns today)." Nights logged ON or AFTER this date are excluded,
   * so tonight's answer cannot reshape tonight — or tomorrow. The readiness door already
   * answers "I am cooked today"; if this read could too, the athlete would have two doors
   * answering one question, which is the defect class this repo exists to avoid.
   */
  readonly weekStartISO: string;
}

/**
 * The rolling read.
 *
 * AGGREGATION IS [MINE] AND FLAGGED. Sam ruled the WINDOW ("the last 3") and the silence
 * rule; he did not name the function that turns three answers into one size. This uses
 * the ordinal MEAN, rounded to nearest — equal weight, which is what "rolling read of the
 * last 3" says most plainly, and the only combination that is total (a majority vote has
 * no winner for {light, normal, hard}). Two hard nights and a light read as normal; two
 * hard and a normal read as hard.
 *
 * If Sam wants recency-weighting instead, this function is the only thing that changes —
 * which is why the window, the silence rule and the next-week law live outside it.
 */
export function deriveTeamNightSize(
  input: DeriveTeamNightSizeInput,
): ResolvedTeamNightSize {
  const eligible = input.loggedNights
    // The next-week law. A night logged this week is not evidence for this week.
    .filter((night) => night.dateISO < input.weekStartISO)
    .slice()
    .sort((a, b) => (a.dateISO < b.dateISO ? 1 : a.dateISO > b.dateISO ? -1 : 0))
    .slice(0, TEAM_NIGHT_WINDOW);

  if (eligible.length === 0) {
    // SILENCE IS NOT EVIDENCE (Sam's ruling). The seed persists indefinitely and never
    // decays toward Normal — an athlete who does not answer has not told us their nights
    // got easier.
    const seed = teamNightSeedFor(input.onboardingIntensity);
    return seed === null
      ? { size: null, source: 'unknown', sampleSize: 0 }
      : { size: seed, source: 'onboarding_seed', sampleSize: 0 };
  }

  const mean = eligible.reduce((total, night) => total + ORDINAL[night.size], 0)
    / eligible.length;
  return {
    size: BY_ORDINAL[Math.round(mean)],
    source: 'measured',
    sampleSize: eligible.length,
  };
}
