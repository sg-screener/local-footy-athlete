/**
 * THE ONE LEGALITY OWNER — every contract PROHIBITION, as a typed rule.
 *
 * **Sam, 2026-08-16:** *"one typed legality owner for prohibitions … scoring only
 * among legal, complete candidates … adversarial pressure tests prove scoring
 * cannot buy its way through a ban."*
 *
 * ## WHY THIS FILE EXISTS
 *
 * G-2 — *"**No** heavy lower-body"* — was implemented as a −25 point penalty. A
 * week short of legal days paid the penalty and put Deadlift and Bulgarian Split
 * Squats two days before a game. **A rule a placement can buy its way past is a
 * preference, and the contract did not word that one as a preference.**
 *
 * The class defect was not that rule. It was that prohibitions and preferences
 * lived in the same function, resolved onto one number, so which kind you got
 * depended on who wrote it. Here they cannot mix: **a rule in this file returns a
 * REASON or null, and it has no access to a score.** A prohibition cannot be
 * outbid because there is nothing to bid with.
 *
 * ## IT IS A PORT, NOT A REWRITE
 *
 * Every rule below is the check `assignmentIsLegal` already performed, moved
 * verbatim and given its clause id. **Deliberately not re-derived from the prose**
 * — an "improved" reimplementation would change behaviour while claiming to be a
 * refactor, and the first draft of this file did exactly that by inventing
 * constants (`GLOBAL_RULES.sets`, `running.maxConsecutive`) that do not exist.
 *
 * ## ENUMERABLE, AND CHECKED AGAINST THE CONTRACT
 *
 * `test:clause-enforcement` walks `CLAUSE_MODALITY` and requires a rule here for
 * every clause declaring `prohibits`, and NO rule here for a clause that only
 * `prefers`. **The modality table is the specification; this file answers to it.**
 * A rule that is genuinely enforced elsewhere declares `enforcedElsewhere` and
 * says where — an empty function body would read as "enforced" while enforcing
 * nothing, which is the shape this whole pass exists to remove.
 */
import {
  GLOBAL_RULES,
  PATTERNS_FOR_PURPOSE,
  PATTERN_PLANE,
  PURPOSE_IS_LOWER,
  type SessionPurpose,
} from './weeklyProgrammingContract';
import type { MainStrengthPattern } from './strengthPatternContributions';

/** Monday-first, matching the scheduler's own week order. */
const WEEK_ORDER: readonly number[] = [1, 2, 3, 4, 5, 6, 0];
const orderIndex = (day: number): number => WEEK_ORDER.indexOf(day);
const areConsecutive = (a: number, b: number): boolean =>
  Math.abs(orderIndex(a) - orderIndex(b)) === 1;

/** What a legality rule may see. Facts only — never a score. */
export interface LegalityCandidate {
  readonly assignment: readonly { day: number; purpose: SessionPurpose }[];
  readonly gymAccessDays: readonly number[];
  readonly unavailableDays: readonly number[];
  readonly clubNights: readonly number[];
  readonly gameDay: number | null;
  readonly gameDays?: readonly number[];
  /**
   * Game proximity, SUPPLIED by the scheduler from its canonical context.
   * Passing the answer rather than the inputs is deliberate: re-deriving
   * proximity here would be a second owner of the cyclic-week question, and that
   * question already cost a Sunday-fixture athlete their recovery day.
   */
  readonly isGameMinusOne: (day: number) => boolean;
  readonly isGameMinusTwo: (day: number) => boolean;
  readonly isGamePlusOne: (day: number) => boolean;
  /**
   * R-378. The main-strength patterns this athlete's injury prohibits, SUPPLIED
   * from `canonicalWeeklyInjuryStateFrom` — the same reading §18's safety policy
   * judges by, never a second interpretation of the constraints.
   */
  readonly prohibitedPatterns?: readonly MainStrengthPattern[];
}

export interface LegalityRule {
  readonly clauseId: string;
  /** Null when legal; otherwise the typed reason it is not. */
  readonly violated?: (c: LegalityCandidate) => string | null;
  /** Set INSTEAD of `violated` when another owner genuinely holds this clause. */
  readonly enforcedElsewhere?: string;
}

/** Every calendar day carrying a hard exposure. DAYS, not sessions (§3). */
function hardDaysOf(c: LegalityCandidate): Set<number> {
  return new Set<number>([
    ...c.assignment.map((s) => s.day),
    ...c.clubNights,
    ...(c.gameDays ?? (c.gameDay !== null ? [c.gameDay] : [])),
  ]);
}

export const LEGALITY_RULES: readonly LegalityRule[] = [
  {
    // ⚠ THE ONE THAT REACHED AN ATHLETE'S FRIDAY. Previously `score -= 25`.
    clauseId: 'WC-051',
    violated: (c) => {
      const bad = c.assignment.find((s) =>
        c.isGameMinusTwo(s.day) && PURPOSE_IS_LOWER[s.purpose]);
      return bad ? `heavy lower-body work on G-2 (day ${bad.day})` : null;
    },
  },
  {
    // ── R-378. THE DAY AN INJURED ATHLETE HAS NOTHING TO DO ON ──────────────
    //
    // **Sam, 2026-09-04:** *"if he can do something and it's safe to do so then
    // feel free to chuck something in — even if optional — otherwise give them
    // nothing — dont just add junk or extra work in"*, affirming R-095's
    // omit-and-disclose for the G-2 case that prompted it.
    //
    // ⚠ **THE SCHEDULER HAD NO INJURY INPUT AT ALL**, so the reduction ladder's
    // rung 1 — which offers `upper` where a constrained day may not hold heavy
    // lower — handed the G-2 day to an athlete whose shoulder was paused. That
    // shipped Bench Press and Seated DB Press two days before a game to someone
    // who could not press. The ladder was doing exactly what it was written to
    // do; it was never told the substitute was unavailable.
    //
    // **A PURPOSE IS ILLEGAL ONLY WHEN THE INJURY TAKES EVERY PATTERN IT
    // OFFERS.** Prohibiting `push` alone does not close `upper` — `upper` can
    // still be run as pull — and pretending otherwise would delete work the
    // athlete can safely do, which is the opposite failure.
    //
    // **THIS CANNOT FILL THE DAY, ONLY EMPTY IT.** The exception Sam attached —
    // repairing a genuine week-level gap — is not a second gap-finder here:
    // `strengthPatternContributions.uncoveredMainPatternsForWeek` and
    // `canonicalWeeklyPlaneCompletion` already own that question downstream,
    // where the week's actual content is known and a plane-completion row can be
    // placed safely or honestly refused.
    clauseId: 'WC-064',
    enforcedElsewhere: 'scheduleWeek — applied as a REMOVAL after the '
      + 'ladder has chosen the week, never as a candidate filter inside it. '
      + 'Ruling it out mid-search sends the ladder down a rung, and a reduced '
      + 'rung is the authored SMALLER structure (three split days become two '
      + 'full-body days), so the injury ended up ADDING sets — measured at '
      + '12 to 20 on one day and 0 to 12 on another. Dropping the impossible '
      + 'sessions from the healthy week can only ever remove.',
  },
  {
    clauseId: 'WC-050',
    violated: (c) => {
      const bad = c.assignment.find((s) =>
        (c.gameDays ?? (c.gameDay !== null ? [c.gameDay] : [])).includes(s.day)
        || c.isGameMinusOne(s.day) || c.isGamePlusOne(s.day));
      return bad ? `strength on the game day, G-1 or G+1 (day ${bad.day})` : null;
    },
  },
  {
    clauseId: 'WC-040',
    violated: (c) => {
      const hard = hardDaysOf(c).size;
      return hard >= GLOBAL_RULES.hardDays.neverProgrammed
        ? `${hard} hard days; the app never programs ${GLOBAL_RULES.hardDays.neverProgrammed}`
        : null;
    },
  },
  {
    clauseId: 'WC-041',
    violated: (c) => {
      const hard = hardDaysOf(c);
      let run = 0;
      let longest = 0;
      for (const day of WEEK_ORDER) {
        run = hard.has(day) ? run + 1 : 0;
        longest = Math.max(longest, run);
      }
      const limit = GLOBAL_RULES.consecutiveHardDays.fiveRequiresTwoFullRestDays;
      if (longest > limit) return `${longest} consecutive hard days`;
      if (longest === limit) {
        const rest = WEEK_ORDER.filter((day) => !hard.has(day)
          && !c.unavailableDays.includes(day));
        if (rest.length < 2) return `${longest} consecutive hard days without two full rest days`;
      }
      return null;
    },
  },
  {
    clauseId: 'WC-043',
    violated: (c) => {
      const byOrder = [...c.assignment].sort((a, b) => orderIndex(a.day) - orderIndex(b.day));
      for (let i = 1; i < byOrder.length; i += 1) {
        if (!areConsecutive(byOrder[i - 1].day, byOrder[i].day)) continue;
        if (PURPOSE_IS_LOWER[byOrder[i - 1].purpose] && PURPOSE_IS_LOWER[byOrder[i].purpose]) {
          return `lower sessions on consecutive days (${byOrder[i - 1].day}->${byOrder[i].day})`;
        }
      }
      return null;
    },
  },
  {
    clauseId: 'WC-022',
    violated: (c) => {
      const byOrder = [...c.assignment].sort((a, b) => orderIndex(a.day) - orderIndex(b.day));
      for (let i = 1; i < byOrder.length; i += 1) {
        if (!areConsecutive(byOrder[i - 1].day, byOrder[i].day)) continue;
        const prevPlanes = new Set(PATTERNS_FOR_PURPOSE[byOrder[i - 1].purpose]
          .map((pattern) => PATTERN_PLANE[pattern]));
        const shared = PATTERNS_FOR_PURPOSE[byOrder[i].purpose]
          .some((pattern) => prevPlanes.has(PATTERN_PLANE[pattern]));
        if (shared) return `same movement plane on consecutive days (${byOrder[i - 1].day}->${byOrder[i].day})`;
      }
      return null;
    },
  },
  {
    clauseId: 'WC-060',
    violated: (c) => {
      const bad = c.assignment.find((s) => !c.gymAccessDays.includes(s.day));
      return bad ? `required strength outside gym-access days (day ${bad.day})` : null;
    },
  },
  {
    clauseId: 'WC-061',
    violated: (c) => {
      const bad = c.assignment.find((s) => c.unavailableDays.includes(s.day));
      return bad ? `work on a day the athlete marked unavailable (day ${bad.day})` : null;
    },
  },

  // ── HELD BY ANOTHER OWNER, AND NAMED SO IT CANNOT READ AS ENFORCED ──────
  { clauseId: 'WC-048', enforcedElsewhere: 'composer daily movement ceiling' },
  { clauseId: 'WC-062', enforcedElsewhere: 'coachingInputsToSchedulerInputs — declared club nights only' },
  { clauseId: 'WC-110', enforcedElsewhere: 'WC-043 spacing above' },
  // 2026-09-03: this row named `appSprintDay`, an exported function with zero
  // callers — a ghost enforcer. The app sprint is placed inside `scheduleWeek`
  // (the WC-135/WC-124 block: `plannedSprintDay` via `selectFreshSpeedDay`),
  // and `test:clause-enforcement` now proves every owner named here is live.
  { clauseId: 'WC-135', enforcedElsewhere: 'scheduleWeek — app-sprint placement (plannedSprintDay via selectFreshSpeedDay)' },
];

/**
 * Every prohibition, in one pass. Returns the FIRST typed reason, or null.
 *
 * Order is the table's and is not significant — a candidate breaking two bans is
 * illegal either way, and one reason keeps the refusal readable.
 */
export function firstLegalityViolation(
  c: LegalityCandidate,
): { clauseId: string; reason: string } | null {
  for (const rule of LEGALITY_RULES) {
    if (!rule.violated) continue;
    const reason = rule.violated(c);
    if (reason !== null) return { clauseId: rule.clauseId, reason };
  }
  return null;
}

// ─── THE SECOND MOMENT: PROHIBITIONS ABOUT THE FINISHED WEEK ───────────────

/**
 * **ONE OWNER, TWO MOMENTS — NOT TWO OWNERS.**
 *
 * Sam, 2026-08-16: *"The finished architecture must have one authoritative
 * legality verdict; other modules may supply facts, but not separate competing
 * verdicts."*
 *
 * Some prohibitions cannot be answered about a candidate ASSIGNMENT because their
 * subject does not exist yet: running days are topped up after placement,
 * conditioning exposures count anchors, and the session count belongs to the
 * chosen layout. Those were delegated with a note naming another owner — and
 * **eight of those notes were claims nobody had executed.** The pressure receipts
 * exposed two shapes of that:
 *
 *   - WC-030's receipt was VACUOUS. It called `baseLayoutFor` with the wrong
 *     argument shape, measured `0` sets, and reported HELD. A green receipt that
 *     observed nothing is worse than no receipt.
 *   - WC-044 and WC-046 produced weeks that never approached their limits, so
 *     they showed the ban was not NEEDED, never that it BINDS.
 *
 * So they move here. Same module, same typed reason, evaluated once the week
 * exists. **The downstream loops may still compute the facts — they no longer
 * render the verdict.**
 */
export interface WeekLegalityFacts {
  readonly strengthDays: readonly { day: number; purpose: SessionPurpose }[];
  readonly runningDays: readonly number[];
  readonly coreConditioning: number;
  readonly setsPerSession: number;
  readonly phase: string;
}

export interface WeekLegalityRule {
  readonly clauseId: string;
  readonly violated: (w: WeekLegalityFacts) => string | null;
}

function longestRunOf(days: readonly number[]): number {
  const set = new Set(days);
  let run = 0;
  let longest = 0;
  for (const day of WEEK_ORDER) {
    run = set.has(day) ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return longest;
}

export const WEEK_LEGALITY_RULES: readonly WeekLegalityRule[] = [
  {
    clauseId: 'WC-030',
    // ⚠ The FIRST two attempts at this check were vacuous. Both read fields off
    // `SetBudget` that do not exist (`main`/`secondary`), measured 0, and passed.
    // The real shape is `{preferredMin, preferredMax, hardCeiling}`, so the
    // enforceable statement is that a layout may not declare a ceiling above the
    // contract's own. **A check that reads a missing field always passes.**
    violated: (w) => (w.setsPerSession > SET_CEILING
      ? `layout set ceiling ${w.setsPerSession} exceeds the contract's ${SET_CEILING}`
      : null),
  },
  {
    clauseId: 'WC-044',
    violated: (w) => {
      const run = longestRunOf(w.runningDays);
      return run > GLOBAL_RULES.runningStreakMaximum
        ? `${run} consecutive running days; maximum ${GLOBAL_RULES.runningStreakMaximum}`
        : null;
    },
  },
  {
    clauseId: 'WC-045',
    violated: (w) => (w.coreConditioning > GLOBAL_RULES.conditioning.max
      ? `${w.coreConditioning} conditioning exposures; cap ${GLOBAL_RULES.conditioning.max}`
      : null),
  },
  {
    clauseId: 'WC-046',
    violated: (w) => (w.runningDays.length > GLOBAL_RULES.running.max
      ? `${w.runningDays.length} running days; maximum ${GLOBAL_RULES.running.max}`
      : null),
  },
  {
    clauseId: 'WC-113',
    violated: (w) => (w.phase === 'Pre-season' && w.strengthDays.length > REQUIRED_STRENGTH_CEILING
      ? `${w.strengthDays.length} pre-season strength sessions; extra availability creates no fifth`
      : null),
  },
  {
    clauseId: 'WC-122',
    violated: (w) => (w.phase === 'Off-season' && w.strengthDays.length > REQUIRED_STRENGTH_CEILING
      ? `${w.strengthDays.length} off-season strength sessions; extra availability creates no fifth`
      : null),
  },
  {
    // WC-063 / WC-113 / WC-122 are one prohibition wearing three clause ids:
    // availability is permission, not a quota, and never creates a fifth
    // required strength session. Asserted once per id so each is enforced.
    //
    // ⚠ **ORDERED LAST OF THE THREE, DELIBERATELY.** WC-063 is the general
    // form and matches everything the phase-specific pair matches, so running
    // it first made every pre-season and off-season breach report as WC-063.
    // The refusal named a real rule but the WRONG one, and a wrong attribution
    // is worse than none — the next reader goes looking in the wrong clause.
    clauseId: 'WC-063',
    violated: (w) => (w.strengthDays.length > REQUIRED_STRENGTH_CEILING
      ? `${w.strengthDays.length} required strength sessions; availability is not a quota`
      : null),
  },
  {
    clauseId: 'WC-133',
    violated: (w) => {
      if (w.phase !== 'Pre-season') return null;
      // ⚠ NOT `PURPOSE_IS_LOWER`, which is true for `full_body`. Reading it that
      // way made the contract refuse its OWN approved pre-season 3-day layout —
      // "Full Body x3 on the best-separated days" — as three lower sessions.
      // WC-133's "no more than two lower sessions" means sessions whose PURPOSE
      // is lower; a full-body day is not a lower day in that sentence.
      const lower = w.strengthDays.filter((s) => s.purpose.startsWith('lower')).length;
      return lower > PRESEASON_LOWER_CEILING
        ? `${lower} pre-season lower sessions; the overlay permits ${PRESEASON_LOWER_CEILING}`
        : null;
    },
  },
];

/**
 * §3 Session size: *"16 is a hard ceiling"*.
 *
 * EXPORTED 2026-08-16 so the block-boundary set ladder spends THIS number rather
 * than declaring a second 16. Two constants holding one ceiling is how they come
 * to disagree, and the boundary is the only other place in the app that adds a
 * main/secondary set.
 */
export const SET_CEILING = 16;
/** §2 / the layout rows: no phase requires a fifth strength session. */
const REQUIRED_STRENGTH_CEILING = 4;
/** WC-133: pre-season carries *"no more than two lower sessions"*. */
const PRESEASON_LOWER_CEILING = 2;

export function firstWeekLegalityViolation(
  w: WeekLegalityFacts,
): { clauseId: string; reason: string } | null {
  for (const rule of WEEK_LEGALITY_RULES) {
    const reason = rule.violated(w);
    if (reason !== null) return { clauseId: rule.clauseId, reason };
  }
  return null;
}
