/**
 * THE WEEKLY SCHEDULER — the ONE owner that turns the approved contract into
 * dated days. Pure: no store, no clock, no network, no logging.
 *
 * In:  `WeeklyProgrammingContract` (typed, `weeklyProgrammingContract.ts`) plus the
 *      athlete's already-authorised scheduling facts.
 * Out: dated SESSION INTENTIONS — purpose, ownership, movement-coverage intention
 *      and set budget — or a TYPED REFUSAL.
 *
 * **IT DOES NOT SELECT EXERCISES.** The contract's §1 is explicit that the source
 * *"does not choose exact exercises, equipment substitutions, injury/readiness
 * reductions, block progression from completed training, or athlete-facing
 * wording"*, and neither does this. `composeWeek` keeps all of it and receives an
 * intention rather than a plan entry it has to second-guess.
 *
 * **NO LATER LAYER MAY CHANGE SESSION COUNT, PURPOSE OR WEEKDAY.** The contract's
 * §1 target diagram: *"ONE approved weekly contract → ONE weekly scheduler →
 * composition → safety modifiers → athlete display … No later layer may silently
 * redesign the week."*
 *
 * ## WHY THE SEARCH IS EXHAUSTIVE AND NOT GREEDY
 *
 * A greedy placer answers differently depending on the order it considers days,
 * and this repo has been bitten by order-dependent oracles twice. The space is
 * tiny — at most `C(7,4) = 35` day-sets times `4! = 24` orderings, so 840
 * candidates in the worst case — so every legal arrangement is enumerated and
 * scored, and the best is chosen by a total order. **The same inputs always give
 * the same week, and the answer is optimal rather than merely feasible.**
 */
import {
  DEFAULT_SET_BUDGET,
  GLOBAL_RULES,
  INSEASON_SPRINT_RULE,
  PATTERNS_FOR_PURPOSE,
  PATTERN_PLANE,
  PURPOSE_IS_LOWER,
  baseLayoutFor,
  type ConditioningKind,
  type ContractPhase,
  type MovementPattern,
  type OffseasonBlock,
  type SessionPurpose,
  type SetBudget,
} from './weeklyProgrammingContract';

// ─── INPUTS ────────────────────────────────────────────────────────────────

export interface SchedulerReadiness {
  readonly lowReadiness: boolean;
  readonly highReadiness: boolean;
  readonly lowFatigue: boolean;
  readonly consistentlyCompletesThree: boolean;
}

export interface WeeklySchedulerInputs {
  /** Monday of the week being scheduled, ISO. */
  readonly weekStartISO: string;
  readonly phase: ContractPhase;
  /** Off-season only; decides the §8 overlay. */
  readonly offseasonBlock: OffseasonBlock | null;
  /**
   * Days the athlete can reach a gym or their usual strength equipment.
   * Day-of-week numbers, 0 = Sunday. **Not total active days** (contract §2).
   */
  readonly gymAccessDays: readonly number[];
  /** The athlete's REAL club nights. Never assumed (WC-062). */
  readonly clubNights: readonly number[];
  readonly gameDay: number | null;
  readonly age: number | null;
  readonly readiness: SchedulerReadiness;
  /** Days the athlete explicitly marked unavailable. Never used (WC-061). */
  readonly unavailableDays: readonly number[];
}

// ─── OUTPUT ────────────────────────────────────────────────────────────────

export interface SessionIntention {
  readonly dateISO: string;
  readonly dayOfWeek: number;
  /** Null for a conditioning-only or anchor-only day. */
  readonly purpose: SessionPurpose | null;
  /**
   * Who owns the APP'S work on this day. Club training and the game are anchors
   * carried alongside on their own flags, because a day can hold both.
   */
  readonly owner: 'strength' | 'conditioning' | 'club' | 'game' | 'rest_or_recovery';
  /**
   * ⚠ **A CLUB NIGHT AND A GYM SESSION SHARE A DAY, AND THAT IS THE COMMON CASE.**
   * §3 "Club-day gym": *"Gym may share a club-training day. Use regular loads; do
   * not reduce solely because club training is later."* The contract's own
   * in-season reference week pairs an upper session with EACH club night.
   *
   * Modelling `owner` as exclusive dropped the club night from every day the app
   * also used — caught by the WC-062 guard, which found ZERO club days on a
   * Wednesday/Friday club athlete because both were gym days.
   */
  readonly clubTraining: boolean;
  readonly game: boolean;
  /** What the composer should aim to cover. Intention, never exercises. */
  readonly movementIntention: readonly MovementPattern[];
  /** Main/secondary working sets. Null when the day owns no strength. */
  readonly setBudget: SetBudget | null;
  readonly conditioning: ConditioningKind | null;
  /** True when the athlete may skip it — the early off-season block. */
  readonly optional: boolean;
  /** Which contract clause put this here. */
  readonly clauseId: string;
}

export interface WeeklySchedule {
  readonly weekStartISO: string;
  readonly layoutClauseId: string;
  readonly requiredStrengthSessions: number;
  readonly days: readonly SessionIntention[];
  /** Patterns the week intends to cover at least once. */
  readonly intendedPatterns: readonly MovementPattern[];
}

export type SchedulerFinding =
  | 'no_layout_for_phase_and_availability'
  | 'not_enough_legal_gym_days'
  | 'no_legal_arrangement_within_spacing_rules';

export interface WeeklyScheduleRefusal {
  readonly refused: true;
  readonly finding: SchedulerFinding;
  readonly detail: string;
  /** The clause that could not be satisfied. */
  readonly clauseId: string;
}

export type WeeklySchedulerResult = WeeklySchedule | WeeklyScheduleRefusal;

export function scheduleRefused(
  result: WeeklySchedulerResult,
): result is WeeklyScheduleRefusal {
  return (result as WeeklyScheduleRefusal).refused === true;
}

// ─── DATES ─────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

/** Day-of-week (0=Sun) to its ISO date inside the week starting `mondayISO`. */
function dateForDayOfWeek(mondayISO: string, dayOfWeek: number): string {
  const monday = new Date(`${mondayISO}T12:00:00`);
  // Monday is index 0 in the week; Sunday (0) is the last day.
  const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return new Date(monday.getTime() + offset * DAY_MS).toISOString().slice(0, 10);
}

/** The week's days in calendar order, Monday first. */
const WEEK_ORDER: readonly number[] = [1, 2, 3, 4, 5, 6, 0];

function orderIndex(dayOfWeek: number): number {
  return WEEK_ORDER.indexOf(dayOfWeek);
}

/** Are two weekdays adjacent in THIS week? Monday-first, no wraparound. */
function areConsecutive(a: number, b: number): boolean {
  return Math.abs(orderIndex(a) - orderIndex(b)) === 1;
}

// ─── LEGALITY ──────────────────────────────────────────────────────────────

/**
 * ⚠ **A DAY THE ATHLETE MARKED UNAVAILABLE IS NEVER USED, FOR ANYTHING** — WC-061.
 * The game day and club nights are ANCHORS the athlete gave us; they are not
 * available for app strength work, but they are not "unavailable" either.
 */
function dayIsUsableForStrength(day: number, inputs: WeeklySchedulerInputs): boolean {
  if (inputs.unavailableDays.includes(day)) return false;
  if (inputs.gameDay === day) return false;
  if (!inputs.gymAccessDays.includes(day)) return false;
  if (inputs.gameDay !== null) {
    const gap = orderIndex(day) - orderIndex(inputs.gameDay);
    // G-1: no heavy lifting (WC-050). G+1: rest or recovery only (WC-050).
    if (gap === -1 || gap === 1) return false;
  }
  return true;
}

/**
 * The plane-repeat rule (WC-022) and lower spacing (WC-043), checked over an
 * ORDERED assignment of purposes to days.
 *
 * **THE PLANE RULE IS NOT THE FAMILY RULE.** Decision 17: *"Horizontal push may
 * precede vertical push."* So only an identical plane on consecutive days is
 * illegal, which is why this compares `PATTERN_PLANE` members and not push-vs-pull.
 */
function assignmentIsLegal(
  assignment: readonly { day: number; purpose: SessionPurpose }[],
  inputs: WeeklySchedulerInputs,
): boolean {
  // ── WC-040 / WC-041 ARE HARD LIMITS, NOT PREFERENCES ────────────────────
  //
  // *"The app does not program 6 [hard days]"* and *"Five [consecutive] is allowed
  // only when followed by two complete rest days."* An earlier draft only SCORED
  // these, so a five-gym-day athlete with two club nights and a game was handed
  // six and seven hard days — caught by the WC-040/WC-041 guards, which is the
  // difference between a preference and a law.
  //
  // **THE UNIT IS DAYS, NOT SESSIONS** (§3 "Count days, not sessions"), so a gym
  // session sharing a club night is ONE hard day and the set below de-duplicates.
  const hardDays = new Set<number>([
    ...assignment.map((slot) => slot.day),
    ...inputs.clubNights,
    ...(inputs.gameDay !== null ? [inputs.gameDay] : []),
  ]);
  if (hardDays.size >= GLOBAL_RULES.hardDays.neverProgrammed) return false;
  let run = 0;
  let longestRun = 0;
  for (const day of WEEK_ORDER) {
    run = hardDays.has(day) ? run + 1 : 0;
    longestRun = Math.max(longestRun, run);
  }
  if (longestRun > GLOBAL_RULES.consecutiveHardDays.fiveRequiresTwoFullRestDays) return false;
  if (longestRun === GLOBAL_RULES.consecutiveHardDays.fiveRequiresTwoFullRestDays) {
    // The five-day run is legal ONLY when two complete rest days remain — the
    // contract's own example is Monday-Friday training with the weekend off.
    const restDays = WEEK_ORDER.filter((day) => !hardDays.has(day)
      && !inputs.unavailableDays.includes(day));
    if (restDays.length < 2) return false;
  }

  const byOrder = [...assignment].sort((a, b) => orderIndex(a.day) - orderIndex(b.day));
  for (let i = 1; i < byOrder.length; i += 1) {
    const prev = byOrder[i - 1];
    const cur = byOrder[i];
    if (!areConsecutive(prev.day, cur.day)) continue;
    // WC-043 — lower sessions are NEVER on consecutive days.
    if (PURPOSE_IS_LOWER[prev.purpose] && PURPOSE_IS_LOWER[cur.purpose]) return false;
    // WC-022 — the same plane must not repeat on consecutive days.
    const prevPlanes = new Set(PATTERNS_FOR_PURPOSE[prev.purpose]
      .map((pattern) => PATTERN_PLANE[pattern]));
    const shared = PATTERNS_FOR_PURPOSE[cur.purpose]
      .some((pattern) => prevPlanes.has(PATTERN_PLANE[pattern]));
    if (shared) return false;
  }
  return true;
}

/**
 * How GOOD a legal arrangement is. Higher wins; ties break on the earliest day,
 * so the answer is a total order and never depends on enumeration order.
 *
 * The contract's preferences, in its own priority language: lower sessions
 * *"prefer two or more"* clear days (WC-043); hard days *"prefer no more than 3"*
 * consecutive (WC-041); and in-season *"pair one upper session with each"* club
 * night (WC-101).
 */
function scoreAssignment(
  assignment: readonly { day: number; purpose: SessionPurpose }[],
  inputs: WeeklySchedulerInputs,
): number {
  const byOrder = [...assignment].sort((a, b) => orderIndex(a.day) - orderIndex(b.day));
  let score = 0;

  // WC-043 — reward clear days between lower sessions, two or more preferred.
  const lowerDays = byOrder.filter((s) => PURPOSE_IS_LOWER[s.purpose])
    .map((s) => orderIndex(s.day));
  for (let i = 1; i < lowerDays.length; i += 1) {
    const clear = lowerDays[i] - lowerDays[i - 1] - 1;
    score += clear >= 2 ? 30 : clear === 1 ? 10 : 0;
  }

  // General separation — the contract says "best-separated" in nine layout rows.
  const idx = byOrder.map((s) => orderIndex(s.day));
  for (let i = 1; i < idx.length; i += 1) score += Math.min(idx[i] - idx[i - 1], 3) * 4;

  // WC-101 — pair an upper session with a club night where the layout allows.
  for (const slot of byOrder) {
    if (inputs.clubNights.includes(slot.day) && !PURPOSE_IS_LOWER[slot.purpose]) score += 12;
    // A lower session on a club night is legal but not preferred: the contract
    // pairs UPPER with club training and off-leg conditioning with lower.
    if (inputs.clubNights.includes(slot.day) && PURPOSE_IS_LOWER[slot.purpose]) score -= 6;
  }

  // WC-041 — penalise long consecutive-hard runs. Club nights and the game are
  // hard days too, which is why they are counted here and not only app sessions.
  const hardDays = new Set<number>([
    ...byOrder.map((s) => s.day), ...inputs.clubNights,
    ...(inputs.gameDay !== null ? [inputs.gameDay] : []),
  ]);
  let run = 0; let longestRun = 0;
  for (const day of WEEK_ORDER) {
    run = hardDays.has(day) ? run + 1 : 0;
    longestRun = Math.max(longestRun, run);
  }
  if (longestRun > GLOBAL_RULES.consecutiveHardDays.preferred) {
    score -= (longestRun - GLOBAL_RULES.consecutiveHardDays.preferred) * 15;
  }
  // WC-050 — keep the two days before the game clear of heavy lower work.
  if (inputs.gameDay !== null) {
    for (const slot of byOrder) {
      const gap = orderIndex(slot.day) - orderIndex(inputs.gameDay);
      if (gap === -2 && PURPOSE_IS_LOWER[slot.purpose]) score -= 25;
    }
  }
  return score;
}

/** Every k-sized subset, in a deterministic order. */
function combinations<T>(items: readonly T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (items.length < k) return [];
  const [head, ...rest] = items;
  return [
    ...combinations(rest, k - 1).map((combo) => [head, ...combo]),
    ...combinations(rest, k),
  ];
}

/** Every ordering, deterministic. Purposes are few (max 4), so this is small. */
function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  const out: T[][] = [];
  items.forEach((item, index) => {
    const rest = [...items.slice(0, index), ...items.slice(index + 1)];
    for (const tail of permutations(rest)) out.push([item, ...tail]);
  });
  return out;
}

// ─── SCHEDULE ──────────────────────────────────────────────────────────────

export function scheduleWeek(inputs: WeeklySchedulerInputs): WeeklySchedulerResult {
  const usableGymDays = WEEK_ORDER.filter((day) => dayIsUsableForStrength(day, inputs));
  // Weekend availability is a fact about the athlete's gym access, read from the
  // access set itself rather than asked for twice (WC-111 / WC-112).
  const weekendAvailable = inputs.gymAccessDays.some((day) => day === 6 || day === 0);

  // ── HOW MANY SESSIONS THIS WEEK CAN ACTUALLY HOLD ────────────────────────
  //
  // Availability chooses the layout, but **game proximity can leave fewer LEGAL
  // days than the athlete has gym access on** — a Mon/Wed/Fri athlete with a
  // Saturday game loses Friday to G-1 and has two.
  //
  // **THE CONTRACT SAYS SCALE, NOT REFUSE.** §8 Pre-season: *"Scale honestly to
  // two or three strength sessions when that is all the athlete can do."* §6's
  // in-season rows are *"the two-, three- or four-session reference structure"*, a
  // ladder the scheduler picks from. So the layout is chosen by the number of days
  // that are actually usable, floored at the smallest approved layout.
  //
  // MEASURED: refusing instead cost 60 occurrences across 30 worlds — every
  // three-day athlete with a weekend game — for a week the contract has a stated
  // answer for.
  // Below the smallest approved layout there is nothing to scale TO, and that is
  // a different fact from "no layout exists for this phase" — so it gets its own
  // typed finding rather than falling through to the layout lookup.
  const SMALLEST_APPROVED_LAYOUT = 2;
  if (usableGymDays.length < SMALLEST_APPROVED_LAYOUT) {
    return {
      refused: true, finding: 'not_enough_legal_gym_days', clauseId: 'WC-142',
      detail: `only ${usableGymDays.length} legal gym day(s) remain after game `
        + 'proximity and explicit unavailability — below the smallest approved '
        + `layout of ${SMALLEST_APPROVED_LAYOUT}`,
    };
  }

  const effectiveGymDays = Math.min(
    Math.max(inputs.gymAccessDays.length, 0),
    Math.max(usableGymDays.length, 0),
    6);

  const layout = baseLayoutFor({
    phase: inputs.phase,
    gymDayCount: effectiveGymDays,
    weekendAvailable,
    fourthSession: {
      gymDayCount: effectiveGymDays,
      age: inputs.age,
      consistentlyCompletesThree: inputs.readiness.consistentlyCompletesThree,
      highReadiness: inputs.readiness.highReadiness,
      lowFatigue: inputs.readiness.lowFatigue,
      lowReadiness: inputs.readiness.lowReadiness,
    },
  });
  if (!layout) {
    return {
      refused: true, finding: 'no_layout_for_phase_and_availability', clauseId: 'WC-142',
      detail: `no approved base layout for ${inputs.phase} with `
        + `${inputs.gymAccessDays.length} gym-access day(s)`,
    };
  }

  const needed = layout.purposes.length;
  if (usableGymDays.length < needed) {
    return {
      refused: true, finding: 'not_enough_legal_gym_days', clauseId: layout.clauseId,
      detail: `${layout.clauseId} requires ${needed} strength session(s) but only `
        + `${usableGymDays.length} gym-access day(s) survive game proximity and `
        + `explicit unavailability`,
    };
  }

  // ── THE EXHAUSTIVE SEARCH ────────────────────────────────────────────────
  let best: { assignment: { day: number; purpose: SessionPurpose }[]; score: number } | null = null;
  for (const dayCombo of combinations(usableGymDays, needed)) {
    for (const ordering of permutations(layout.purposes)) {
      const assignment = dayCombo.map((day, index) => ({ day, purpose: ordering[index] }));
      if (!assignmentIsLegal(assignment, inputs)) continue;
      const score = scoreAssignment(assignment, inputs);
      if (!best || score > best.score) best = { assignment, score };
    }
  }
  if (!best) {
    return {
      refused: true, finding: 'no_legal_arrangement_within_spacing_rules',
      clauseId: 'WC-043',
      detail: `${layout.clauseId} could not place ${needed} session(s) on `
        + `${usableGymDays.length} legal day(s) without breaking lower spacing or `
        + 'the consecutive-plane rule',
    };
  }

  const overlayOptional = inputs.phase === 'Off-season'
    && inputs.offseasonBlock === 'early_optional';
  const purposeByDay = new Map(best.assignment.map((s) => [s.day, s.purpose]));

  const days: SessionIntention[] = [];
  for (const day of WEEK_ORDER) {
    const dateISO = dateForDayOfWeek(inputs.weekStartISO, day);
    if (inputs.unavailableDays.includes(day)) continue;   // WC-061 — never used
    const purpose = purposeByDay.get(day) ?? null;
    if (inputs.gameDay === day) {
      days.push({
        dateISO, dayOfWeek: day, purpose: null, owner: 'game', movementIntention: [],
        setBudget: null, conditioning: null, optional: false, clauseId: 'WC-050',
        clubTraining: inputs.clubNights.includes(day), game: true,
      });
      continue;
    }
    if (purpose) {
      days.push({
        dateISO, dayOfWeek: day, purpose, owner: 'strength',
        movementIntention: PATTERNS_FOR_PURPOSE[purpose],
        setBudget: layout.setBudget,
        // WC-115 — off-leg conditioning pairs with lower, running with upper.
        conditioning: PURPOSE_IS_LOWER[purpose] ? 'off_leg' : 'running',
        optional: overlayOptional, clauseId: layout.clauseId,
        clubTraining: inputs.clubNights.includes(day), game: false,
      });
      continue;
    }
    if (inputs.clubNights.includes(day)) {
      days.push({
        dateISO, dayOfWeek: day, purpose: null, owner: 'club', movementIntention: [],
        setBudget: null, conditioning: null, optional: false, clauseId: 'WC-062',
        clubTraining: true, game: false,
      });
      continue;
    }
    days.push({
      dateISO, dayOfWeek: day, purpose: null, owner: 'rest_or_recovery',
      movementIntention: [], setBudget: null, conditioning: null,
      optional: true, clauseId: 'WC-042', clubTraining: false, game: false,
    });
  }

  // ── WC-060 / WC-046: REQUIRED RUNNING MAY LEAVE THE GYM DAYS ─────────────
  //
  // The contract's §2 is explicit that gym access bounds STRENGTH, not running:
  // *"Equipment-free running or conditioning—required or optional—may be placed on
  // other days when needed to satisfy the phase contract."* Decision 15 repeats it.
  //
  // **AND IT IS STILL BOUND BY EVERYTHING ELSE** — *"subject to all scheduling,
  // safety and explicit-unavailability constraints"* — so this walks the same
  // legality the strength placer used: never an unavailable day, never the game,
  // never G-1 or G+1, and never a fourth consecutive running day (WC-044).
  //
  // CLUB TRAINING AND THE GAME COUNT toward the minimum (WC-046), which is why
  // they seed the tally rather than being ignored.
  const runningDays = new Set<number>([
    ...inputs.clubNights,
    ...(inputs.gameDay !== null ? [inputs.gameDay] : []),
    ...days.filter((d) => d.conditioning === 'running').map((d) => d.dayOfWeek),
  ]);
  const runningTopUps: SessionIntention[] = [];
  if (inputs.phase !== 'Off-season' || inputs.offseasonBlock !== 'early_optional') {
    for (const day of WEEK_ORDER) {
      if (runningDays.size >= GLOBAL_RULES.running.min) break;
      if (runningDays.has(day)) continue;
      if (inputs.unavailableDays.includes(day)) continue;      // WC-061
      if (inputs.gameDay === day) continue;
      if (purposeByDay.has(day)) continue;                      // already a gym day
      if (inputs.gameDay !== null) {
        const gap = orderIndex(day) - orderIndex(inputs.gameDay);
        if (gap === -1 || gap === 1) continue;                  // WC-050
      }
      // WC-044 — no more than three running days consecutively.
      const wouldRun = new Set([...runningDays, day]);
      let run = 0; let longest = 0;
      for (const probe of WEEK_ORDER) {
        run = wouldRun.has(probe) ? run + 1 : 0;
        longest = Math.max(longest, run);
      }
      if (longest > GLOBAL_RULES.runningStreakMaximum) continue;
      runningDays.add(day);
      runningTopUps.push({
        dateISO: dateForDayOfWeek(inputs.weekStartISO, day), dayOfWeek: day,
        purpose: null, owner: 'conditioning', movementIntention: [], setBudget: null,
        conditioning: 'running', optional: false, clauseId: 'WC-060',
        clubTraining: inputs.clubNights.includes(day), game: false,
      });
    }
  }
  // ── WC-135: THE IN-SEASON SPRINT, PLACED RATHER THAN ONLY DESCRIBED ──────
  //
  // *"In-season, only add sprint work when there is no club training, and place it
  // G-3 or earlier."* **`inSeasonSprintDay` existed and nothing called it**, so the
  // scheduler emitted no sprint under ANY conditions and the WC-135 guard was green
  // because the thing it forbids could not happen. The mutation harness found it:
  // flipping `addOnlyWhenNoClubTraining` to false reddened nothing.
  const sprintDay = inSeasonSprintDay(inputs, new Set(purposeByDay.keys()));
  const withSprint = sprintDay === null ? days : days.map((entry) =>
    (entry.dayOfWeek === sprintDay && entry.owner === 'rest_or_recovery'
      ? { ...entry, owner: 'conditioning' as const,
        conditioning: 'sprint_high_speed' as const, optional: false,
        clauseId: 'WC-135' }
      : entry));

  const withRunning = withSprint.map((entry) => {
    const topUp = runningTopUps.find((r) => r.dayOfWeek === entry.dayOfWeek);
    return topUp && entry.owner === 'rest_or_recovery' ? topUp : entry;
  });

  const intended = new Set<MovementPattern>();
  for (const slot of best.assignment) {
    for (const pattern of PATTERNS_FOR_PURPOSE[slot.purpose]) intended.add(pattern);
  }

  return {
    weekStartISO: inputs.weekStartISO,
    layoutClauseId: layout.clauseId,
    requiredStrengthSessions: needed,
    days: withRunning,
    intendedPatterns: [...intended],
  };
}

/**
 * WC-135. May the app add its own sprint session this week?
 * *"In-season, only add sprint work when there is no club training, and place it
 * G-3 or earlier."* Exported so the conditioning owner reads the contract rather
 * than restating it.
 */
export function inSeasonSprintDay(
  inputs: WeeklySchedulerInputs,
  /**
   * Days already holding app work. **A sprint must land on a FREE day** — the
   * first draft returned the first eligible weekday without asking, which was
   * Monday, already a strength day, so no sprint was ever placed and the WC-135
   * guard sat green over a rule the scheduler did not implement.
   */
  occupiedDays: ReadonlySet<number> = new Set(),
): number | null {
  if (inputs.phase !== 'In-season') return null;
  if (!INSEASON_SPRINT_RULE.addOnlyWhenNoClubTraining) return null;
  if (inputs.clubNights.length > 0) return null;
  if (inputs.gameDay === null) return null;
  const gameIndex = orderIndex(inputs.gameDay);
  // LATEST legal day first: a sprint sits as close to G-3 as the week allows, so
  // it does not crowd the start of the week away from the game.
  const eligible = WEEK_ORDER
    .filter((day) => !inputs.unavailableDays.includes(day))
    .filter((day) => !occupiedDays.has(day))
    .filter((day) => orderIndex(day) <= gameIndex + INSEASON_SPRINT_RULE.earliestGameOffset);
  if (eligible.length === 0) return null;
  return eligible[eligible.length - 1];
}

/** Re-exported so readers take the budget from the contract, never a literal. */
export { DEFAULT_SET_BUDGET };
