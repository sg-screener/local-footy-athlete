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
  /**
   * Game proximity, SUPPLIED by the scheduler from its canonical context.
   * Passing the answer rather than the inputs is deliberate: re-deriving
   * proximity here would be a second owner of the cyclic-week question, and that
   * question already cost a Sunday-fixture athlete their recovery day.
   */
  readonly isGameMinusOne: (day: number) => boolean;
  readonly isGameMinusTwo: (day: number) => boolean;
  readonly isGamePlusOne: (day: number) => boolean;
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
    ...(c.gameDay !== null ? [c.gameDay] : []),
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
    clauseId: 'WC-050',
    violated: (c) => {
      const bad = c.assignment.find((s) =>
        s.day === c.gameDay || c.isGameMinusOne(s.day) || c.isGamePlusOne(s.day));
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
  { clauseId: 'WC-030', enforcedElsewhere: 'layout set budget (BASE_LAYOUTS.setBudget)' },
  { clauseId: 'WC-044', enforcedElsewhere: 'running top-up loop (WC-044 streak check)' },
  { clauseId: 'WC-045', enforcedElsewhere: 'demand.coreConditioning cap, GLOBAL_RULES.conditioning.max' },
  { clauseId: 'WC-046', enforcedElsewhere: 'running top-up loop, GLOBAL_RULES.running.max' },
  { clauseId: 'WC-048', enforcedElsewhere: 'composer daily movement ceiling' },
  { clauseId: 'WC-062', enforcedElsewhere: 'coachingInputsToSchedulerInputs — declared club nights only' },
  { clauseId: 'WC-063', enforcedElsewhere: 'baseLayoutFor — the layout owns the count' },
  { clauseId: 'WC-110', enforcedElsewhere: 'WC-043 spacing above' },
  { clauseId: 'WC-113', enforcedElsewhere: 'baseLayoutFor — no fifth session' },
  { clauseId: 'WC-122', enforcedElsewhere: 'baseLayoutFor — no fifth session' },
  { clauseId: 'WC-133', enforcedElsewhere: 'pre-season overlay + WC-043' },
  { clauseId: 'WC-135', enforcedElsewhere: 'inSeasonSprintDay placement' },
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
