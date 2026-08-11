/**
 * THE GAME ANCHOR — ONE OWNER FOR "WHAT DAY IS THE GAME ON?"
 *
 * **Sam, 2026-08-12, verbatim:** *"games should be able to be placed any day of
 * the week - i can't know when every single club in aus is going to play a game
 * so I want to be prepared for everything"*.
 *
 * ## WHAT WAS ACTUALLY IN THE WAY, MEASURED
 *
 * Not the calendar and not the kernel. `GAME_DAY_MAP` already mapped all seven
 * days; `usualGameDay: DayOfWeek` already offered seven; the Section 17
 * validator already protects around whatever date it is handed. The restriction
 * was **one allowlist** — `sessionResolver.resolveEffectiveGameDay` returned
 * `undefined` for anything outside Friday/Saturday/Sunday — plus a legacy enum
 * (`GameDay = 'Friday' | 'Saturday' | 'Sunday' | 'Varies'`) that could not hold
 * a Tuesday, and **two pickers** that only ever offered three days.
 *
 * A Tuesday game therefore resolved to no effective game day at all, so it got
 * **no G-1, no G-2 and no G+1 protection** — the wrong week, not a missing
 * preference.
 *
 * ## WHY THIS MODULE EXISTS RATHER THAN A WIDER ENUM
 *
 * The question "is this the athlete's game day?" had **EIGHT answers** in the
 * app, and widening the enum would have left all eight:
 *
 *   1. `sessionResolver.resolveEffectiveGameDay`  — Fri/Sat/Sun allowlist
 *   2. `profileSetupChange.storedGameDay`         — seven-day membership test
 *   3. `ProfileScreen.dayFromGameFields`          — seven-day membership test
 *   4. `useSeasonPhaseControl`, inline            — seven-day membership test
 *   5. `recoveryAddonBuilder.gameDayForWeek`      — `!== 'Varies'`
 *   6. `postGenerationConstraintValidation`       — `!== 'Varies'`
 *   7. `generateProgram.gameDayOfWeekFor`         — `!== 'Varies'`
 *   8. `weekRebuild`, inline seven-name `includes`
 *
 * Three of them already accepted all seven days. **The app could already READ a
 * Wednesday game and could not WRITE one** — which is the shape the north star
 * calls a duplicated representation, not a missing feature.
 *
 * ## AND THIS IS WHY NO DEVICE MIGRATION IS OWED
 *
 * `'Varies'` was never a day. It meant "no usual game day", which is what
 * `undefined` already means, so a stored profile still holding it **parses to
 * `null` here and behaves exactly as it does today** — no virtual game, no
 * seeded fixtures, nothing to migrate and nothing to lose. The owner reads the
 * stored string rather than trusting the type, in the same way
 * `normalizeRoleBucket` reads a stored position. The type is what the app
 * WRITES from now on; this function is what it READS.
 *
 * NOT COVERED BY THIS MODULE: which dates the fixtures actually fall on. This
 * answers the recurring weekday only. The calendar owns real fixture dates, and
 * `derivedWeekContract.ts:90` still collapses an N-fixture week to one — that is
 * `HOW_TO_BUILD_THIS_APP` §5 item 4 and is untouched here.
 */

import type { DayOfWeek } from '../types/domain';

/**
 * The week, Monday first. THE canonical list — `homeScreenConstants.WEEK_DAYS`
 * and `profileSetupChange.SETUP_WEEK_DAYS` are aliases of this one, so a picker
 * and a validator can never disagree about how many days a week has.
 *
 * (There are further hand-rolled day lists elsewhere in the app, most of them
 * Sunday-first `getDay()` index tables, which are a different unit. This unit
 * removed two of them; it did not attempt the rest.)
 */
export const DAYS_OF_WEEK: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const DAY_LOOKUP: ReadonlySet<string> = new Set<string>(DAYS_OF_WEEK);

/** Is this stored value one of the seven days? Parses, never asserts. */
export function isDayOfWeek(value: unknown): value is DayOfWeek {
  return typeof value === 'string' && DAY_LOOKUP.has(value);
}

/**
 * The two fields an athlete's game anchor can be stored in. Deliberately loose
 * about the value: this function's whole job is to be the place where a stored
 * string becomes a day or becomes nothing.
 */
export interface GameAnchorFields {
  readonly usualGameDay?: unknown;
  readonly gameDay?: unknown;
}

/**
 * The athlete's recurring game day, or `null` if they have not got one.
 *
 * `usualGameDay` wins because it is the field every modern door writes.
 * `gameDay` is the onboarding screen's field and is read as the fallback, which
 * is the precedence `resolveEffectiveGameDay`, `storedGameDay`,
 * `dayFromGameFields` and four others all already used separately.
 */
export function storedGameAnchor(fields: GameAnchorFields | null | undefined): DayOfWeek | null {
  if (isDayOfWeek(fields?.usualGameDay)) return fields.usualGameDay;
  if (isDayOfWeek(fields?.gameDay)) return fields.gameDay;
  return null;
}
