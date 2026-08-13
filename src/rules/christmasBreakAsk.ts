import type { OnboardingData } from '../types/domain';
import { phaseHasClubTraining } from './clubSeasonScope';

/**
 * WHEN THE APP ASKS ABOUT THE CHRISTMAS BREAK — SEAT_INBOX item 31 part 5,
 * ruled by Sam on 2026-08-13.
 *
 * **HIS WORDS ARE THE SPEC:** *"it may be helpful to add a button for Christmas
 * break and removing team training sessions from the app - maybe around the
 * 10th of December. That way an athlete can select when their last team
 * training is, and then around the 3rd of Jan they should be ask when does team
 * training go back? that way the app isn't guessing"*.
 *
 * **TWO QUESTIONS, AND THE SECOND ONE IS THE POINT.** The December question is
 * cheap — a club athlete knows his last session. The January question is what
 * makes the whole thing honest: without it the app either invents a return date
 * or leaves the club off the calendar forever, and Sam ruled out the first by
 * name. So this module decides WHICH question is live, never what the answer is.
 *
 * **THE DATES ARE DEFAULTS, NOT RULES.** He said *"maybe around the 10th"* and
 * *"around the 3rd of Jan"*. They decide when to ASK; the athlete's answer is
 * the truth, and it may be any date, before or after either threshold.
 *
 * **WHY THE ASK IS A DECISION AND NOT A GUESS.** Nothing here writes anything.
 * It reads the calendar, whether the athlete has a club at all, and which break
 * facts already exist — and returns the question that has not been answered.
 * Every date in this app's program still comes from the athlete's own answer.
 */

/** *"maybe around the 10th of December"*. */
export const CHRISTMAS_BREAK_ASK_FROM = { month: 12, day: 10 } as const;
/** *"around the 3rd of Jan"*. */
export const CHRISTMAS_RETURN_ASK_FROM = { month: 1, day: 3 } as const;

export type ChristmasBreakAsk =
  | {
      kind: 'last_team_training';
      /** The break's year, e.g. `'2026'` for the break starting Dec 2026. */
      seasonKey: string;
      /** The id `dismissCoachNote` stores when the athlete says they train through. */
      dismissId: string;
    }
  | {
      kind: 'team_training_returns';
      seasonKey: string;
      /** First day of the open break — the answer must land after it. */
      breakFromISO: string;
    };

export interface ChristmasBreakAskInputs {
  todayISO: string;
  /** The athlete's phase, for `phaseHasClubTraining`. */
  seasonPhase: OnboardingData['seasonPhase'] | null | undefined;
  /** The club nights they answered. An athlete with none has no break to state. */
  teamTrainingDays: readonly string[] | null | undefined;
  /**
   * The first day of an ACTIVE break whose end nobody has stated yet, or null.
   * This is the December answer waiting for its January half.
   */
  openBreakFromISO: string | null;
  /** First days of breaks that already have an end — nothing left to ask about. */
  answeredBreakFromISOs: readonly string[];
  /** `coachUpdatesStore.dismissedCoachNoteIds`. */
  dismissedIds: readonly string[];
}

/**
 * THE YEAR A BREAK BELONGS TO. A break that starts in December 2026 and ends in
 * January 2027 is ONE break, so both halves have to key to the same string or
 * the January question would look like a different season's business. July is
 * the split because no football calendar puts a Christmas break near it.
 */
export function christmasBreakSeasonKey(dateISO: string): string {
  const year = Number(dateISO.slice(0, 4));
  const month = Number(dateISO.slice(5, 7));
  return String(month >= 7 ? year : year - 1);
}

export function christmasBreakDismissId(seasonKey: string): string {
  return `christmas-break-ask:${seasonKey}`;
}

function onOrAfter(dateISO: string, month: number, day: number): boolean {
  const m = Number(dateISO.slice(5, 7));
  const d = Number(dateISO.slice(8, 10));
  return m > month || (m === month && d >= day);
}

/**
 * WHICH QUESTION IS LIVE TODAY, or null.
 *
 * ORDER MATTERS AND IT IS NOT ARBITRARY: an open break outranks a new one. An
 * athlete looking at a program with no team training in it needs to be able to
 * say when it comes back before anything else is asked of him — that is the
 * only question whose absence leaves the app in a wrong state.
 */
export function decideChristmasBreakAsk(
  inputs: ChristmasBreakAskInputs,
): ChristmasBreakAsk | null {
  const today = inputs.todayISO.slice(0, 10);

  // ── THE JANUARY QUESTION — the one that must always be answerable ──
  // NOT GATED ON THE CLUB ANSWER, and not dismissible anywhere in the app. The
  // athlete told us the club stopped; only he can tell us it is back. Gating
  // this on anything would be a way for a break to outlive the season.
  if (inputs.openBreakFromISO !== null) {
    const seasonKey = christmasBreakSeasonKey(inputs.openBreakFromISO);
    // From the 3rd of January FOLLOWING the break's own December, and every day
    // after. A break opened on the 20th does not get asked about on the 21st.
    const askFrom = `${Number(seasonKey) + 1}-${String(CHRISTMAS_RETURN_ASK_FROM.month).padStart(2, '0')}-${String(CHRISTMAS_RETURN_ASK_FROM.day).padStart(2, '0')}`;
    if (today >= askFrom) {
      return {
        kind: 'team_training_returns',
        seasonKey,
        breakFromISO: inputs.openBreakFromISO.slice(0, 10),
      };
    }
    return null;
  }

  // ── THE DECEMBER QUESTION ──
  // ONLY AN ATHLETE WITH A CLUB HAS A BREAK TO STATE. Off-season derivation
  // already reads no team days at all (`phaseHasClubTraining`), so asking an
  // off-season athlete when his club stops is asking about something the app
  // has already decided does not exist.
  if (!phaseHasClubTraining(inputs.seasonPhase)) return null;
  if ((inputs.teamTrainingDays?.length ?? 0) === 0) return null;

  const seasonKey = christmasBreakSeasonKey(today);
  // 10 December to the end of the month. IT DOES NOT ROLL INTO JANUARY, on
  // purpose: an athlete who never answered has told us nothing, and the safe
  // reading of nothing is that his club did not stop. A break the app invents
  // in the second week of January is exactly the guess Sam ruled out.
  if (!onOrAfter(today, CHRISTMAS_BREAK_ASK_FROM.month, CHRISTMAS_BREAK_ASK_FROM.day)) return null;
  if (Number(today.slice(5, 7)) !== CHRISTMAS_BREAK_ASK_FROM.month) return null;

  const alreadyAnswered = inputs.answeredBreakFromISOs
    .some((from) => christmasBreakSeasonKey(from) === seasonKey);
  if (alreadyAnswered) return null;

  const dismissId = christmasBreakDismissId(seasonKey);
  if (inputs.dismissedIds.includes(dismissId)) return null;

  return { kind: 'last_team_training', seasonKey, dismissId };
}
