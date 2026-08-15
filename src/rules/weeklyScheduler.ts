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
  CATEGORY_FOR_CONDITIONING,
  DEFAULT_SET_BUDGET,
  GLOBAL_RULES,
  INSEASON_SPRINT_RULE,
  PATTERNS_FOR_PURPOSE,
  PATTERN_PLANE,
  PURPOSE_IS_LOWER,
  baseLayoutFor,
  type ConditioningKind,
  type ContractConditioningCategory,
  type ContractConditioningRole,
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
  /**
   * Whether a PREVIOUS fixture exists. **Defaults to `'recurring'` at every
   * caller** — a fixture falling outside the printed week is not evidence that
   * there was no game, and assuming otherwise is the G+1 defect itself. Only an
   * explicit first fixture may say `'first_fixture_no_previous'`.
   */
  readonly fixtureRecurrence: FixtureRecurrence;
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
  /**
   * The PURPOSE the specialist must serve. Scheduler-owned (Sam, 2026-08-15);
   * `conditioningSelection` remains the only authority on which TEMPLATE serves
   * it. Null when the day carries no conditioning.
   */
  readonly conditioningCategory: ContractConditioningCategory | null;
  /** Standalone, or riding on this day's strength session (§3 doubles). */
  readonly conditioningRole: ContractConditioningRole | null;
  /**
   * ⚠ **POWER IS STRENGTH-SIDE CONTENT, NEVER A SESSION** (Sam, 2026-08-15).
   *
   * The scheduler says only whether THIS ALREADY-AUTHORED STRENGTH DAY is
   * eligible; `powerPrimerPolicy` picks the movement and dose. **Power never
   * creates, moves or repurposes a day, and it never counts as conditioning** —
   * which is why this is a flag on a strength day and not a `ConditioningKind`
   * member, and why `WeeklyDemand.coreConditioning` cannot see it.
   */
  readonly powerEligible: boolean;
  /** True when the athlete may skip it — the early off-season block. */
  readonly optional: boolean;
  /** Which contract clause put this here. */
  readonly clauseId: string;
}

/**
 * ── WHAT THE WEEK REQUIRES, DECIDED BY THE SCHEDULER ───────────────────────
 *
 * **Sam's boundary, 2026-08-15:** the scheduler owns *"existence, requiredness,
 * count, purpose, weekday, hard/rest classification and weekly spacing"*.
 * Conditioning, sprint, power and rest are inside that boundary — narrow
 * specialist modules may materialise the CONTENT of a session this authorises
 * (interval prescription, distance, pace, dose) but **may never add, remove, move
 * or repurpose one.**
 *
 * §18 derives its acceptance contract from this. It is not an independent planner.
 */
export interface WeeklyDemand {
  /** Required strength sessions — the layout's count. */
  readonly mainStrength: number;
  /** Core conditioning exposures. Club training and the game COUNT (WC-045). */
  readonly coreConditioning: number;
  /** Anchor-supplied conditioning credit, of the above. */
  readonly anchorConditioning: number;
  readonly sprintHighSpeed: number;
  /** Days carrying app running (WC-046). */
  readonly running: number;
  /** Days with no app work and no anchor (WC-042). */
  readonly fullRestDays: number;
  /** Calendar days holding any hard exposure — DAYS, not sessions (WC-040). */
  readonly hardDays: number;
}

export interface WeeklySchedule {
  readonly weekStartISO: string;
  readonly layoutClauseId: string;
  readonly requiredStrengthSessions: number;
  readonly days: readonly SessionIntention[];
  /** Patterns the week intends to cover at least once. */
  readonly intendedPatterns: readonly MovementPattern[];
  /** What §18 derives its acceptance contract from. */
  readonly demand: WeeklyDemand;
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

/**
 * HOW FAR THIS DAY IS FROM A GAME — **ACROSS THE WEEK BOUNDARY.**
 *
 * ## THE DEFECT THIS REPLACES
 *
 * Proximity was `orderIndex(day) - orderIndex(gameDay)` inside one Monday→Sunday
 * array. For a **Sunday** fixture that makes Monday `-6`: six days *before* the
 * game, wide open. **Monday is one day AFTER last Sunday's game.** The week is a
 * printing convention; the athlete's body is not reset by it. So a recurring
 * Sunday fixture put Lower plus 30–50 minutes of conditioning on G+1, which
 * WC-050 reserves for rest or recovery — and every G-rule was silently
 * unreachable for a fixture on the last day of the array.
 *
 * ## THE DISTINCTION THAT MAKES IT SAFE
 *
 * A cyclic offset assumes a game last week. That is right for a **recurring**
 * fixture and wrong for a genuine **first** fixture — so the caller must say
 * which, and the two are separate answers rather than one number:
 *
 *   - `daysSincePreviousGame` — the recovery side. Real when the fixture recurs,
 *     or when the day simply falls after the game inside this same week.
 *   - `daysUntilNextGame` — the taper side. Real when the fixture recurs, or when
 *     the day falls before the game inside this same week.
 *
 * `null` means **"there is no such fixture"**, not "far away". A caller that
 * treats `null` as a large number reintroduces the bug.
 *
 * ⚠ **`'recurring'` IS THE DEFAULT EVERYWHERE.** Never infer "no previous game"
 * from a fixture being outside the printed week — that inference is exactly what
 * was wrong. Only an explicit `first_fixture_no_previous` says so.
 */
export type FixtureRecurrence = 'recurring' | 'first_fixture_no_previous';

export interface GameProximity {
  readonly daysSincePreviousGame: number | null;
  readonly daysUntilNextGame: number | null;
}

export function gameProximity(
  day: number,
  gameDay: number | null,
  recurrence: FixtureRecurrence,
): GameProximity {
  if (gameDay === null) {
    return { daysSincePreviousGame: null, daysUntilNextGame: null };
  }
  const since = ((orderIndex(day) - orderIndex(gameDay)) + 7) % 7;
  const until = ((orderIndex(gameDay) - orderIndex(day)) + 7) % 7;
  const recurring = recurrence === 'recurring';
  // On the game day itself both are 0, and that is true in either direction.
  const afterInWeek = orderIndex(day) > orderIndex(gameDay);
  const beforeInWeek = orderIndex(day) < orderIndex(gameDay);
  return {
    daysSincePreviousGame: recurring || afterInWeek ? since : null,
    daysUntilNextGame: recurring || beforeInWeek ? until : null,
  };
}

/** G+1: the day after a game. WC-050 reserves it for rest or recovery. */
function isGamePlusOne(day: number, inputs: WeeklySchedulerInputs): boolean {
  return gameProximity(day, inputs.gameDay, inputs.fixtureRecurrence)
    .daysSincePreviousGame === 1;
}

/** G-1: the day before a game. WC-050 forbids heavy lifting. */
function isGameMinusOne(day: number, inputs: WeeklySchedulerInputs): boolean {
  return gameProximity(day, inputs.gameDay, inputs.fixtureRecurrence)
    .daysUntilNextGame === 1;
}

/** G-2: two days out. No heavy LOWER work, and no added lower-body power. */
function isGameMinusTwo(day: number, inputs: WeeklySchedulerInputs): boolean {
  return gameProximity(day, inputs.gameDay, inputs.fixtureRecurrence)
    .daysUntilNextGame === 2;
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
  // G-1: no heavy lifting (WC-050). G+1: rest or recovery only (WC-050).
  // **Cyclic**: a Sunday fixture makes Monday G+1, which the old in-week
  // subtraction read as G-6 and let through.
  if (isGameMinusOne(day, inputs) || isGamePlusOne(day, inputs)) return false;
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
      if (isGameMinusTwo(slot.day, inputs) && PURPOSE_IS_LOWER[slot.purpose]) score -= 25;
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
        setBudget: null, conditioning: null, conditioningCategory: null,
        conditioningRole: null, powerEligible: false,
        optional: false, clauseId: 'WC-050',
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
        conditioningCategory: CATEGORY_FOR_CONDITIONING[
          PURPOSE_IS_LOWER[purpose] ? 'off_leg' : 'running'],
        // Riding on a strength session, never a session of its own.
        conditioningRole: 'component',
        // ── WC-050: WHICH DAYS MAY BE OFFERED A POWER PRIMER AT ALL ────────
        //
        // Never the game day. Never G-1 (*"no heavy lifting or conditioning"*).
        // **AND NEVER LOWER-BODY POWER ON G-2** — §3 G-2 is *"No heavy
        // lower-body or added speed work"*, and a jump primer is explosive
        // lower-body work whether or not its dose is reduced.
        //
        // ⚠ THIS WAS A REAL DEFECT AND I PRINTED IT AS A SUCCESS. The G-2
        // Thursday of the in-season four-day week came back with a Vertical Jump
        // primer cut to one set, and I reported the reduction as the boundary
        // working. **A reduced violation is a violation** — the contract does not
        // permit less speed work on G-2, it permits none.
        //
        // It is OMITTED here, never moved to another day and never converted to
        // something else: the day keeps its strength session and simply carries
        // no primer.
        powerEligible: (() => {
          if (inputs.gameDay === null) return true;
          if (inputs.gameDay === day) return false;          // the game itself
          if (isGameMinusOne(day, inputs) || isGamePlusOne(day, inputs)) return false;
          // WC-051: G-2 bars LOWER-body power only. An upper day keeps its
          // eligibility — *"should not rule out upper body power"* (Sam,
          // 2026-08-15) — and the primer rides the strength session already there.
          if (isGameMinusTwo(day, inputs) && PURPOSE_IS_LOWER[purpose]) return false;
          return true;
        })(),
        optional: overlayOptional, clauseId: layout.clauseId,
        clubTraining: inputs.clubNights.includes(day), game: false,
      });
      continue;
    }
    if (inputs.clubNights.includes(day)) {
      days.push({
        dateISO, dayOfWeek: day, purpose: null, owner: 'club', movementIntention: [],
        setBudget: null, conditioning: null, conditioningCategory: null,
        conditioningRole: null, powerEligible: false,
        optional: false, clauseId: 'WC-062', clubTraining: true, game: false,
      });
      continue;
    }
    days.push({
      dateISO, dayOfWeek: day, purpose: null, owner: 'rest_or_recovery',
      movementIntention: [], setBudget: null, conditioning: null,
      conditioningCategory: null, conditioningRole: null, powerEligible: false,
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
      // WC-050, cyclic — G-1 and G+1 take no app running either.
      if (isGameMinusOne(day, inputs) || isGamePlusOne(day, inputs)) continue;
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
        conditioning: 'running', conditioningCategory: CATEGORY_FOR_CONDITIONING.running,
        // A day of its own — nothing else is authorised here.
        conditioningRole: 'standalone', powerEligible: false,
        optional: false, clauseId: 'WC-060',
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
        conditioning: 'sprint_high_speed' as const,
        conditioningCategory: CATEGORY_FOR_CONDITIONING.sprint_high_speed,
        conditioningRole: 'standalone' as const, optional: false,
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

  // ── THE WEEK'S DEMAND, COUNTED FROM WHAT WAS ACTUALLY PLACED ─────────────
  //
  // Counted from the DATED DAYS, never re-derived from the layout — a demand that
  // disagrees with the week it describes is the exact defect that made §18 judge a
  // composer week against a count nobody built.
  const anchorConditioning = new Set<number>([
    ...inputs.clubNights,
    ...(inputs.gameDay !== null ? [inputs.gameDay] : []),
  ]).size;
  const appConditioningDays = withRunning.filter((day) => day.conditioning !== null).length;
  const runningDayCount = withRunning.filter((day) => day.conditioning === 'running').length;
  // ── WC-124: ANCHORS SUPPLY SPRINT CREDIT ────────────────────────────────
  //
  // §3, Sprint/high-speed: *"At least 1 except early off-season. **Games and club
  // training can supply it.** In-season, only add sprint work when there is no
  // club training."*
  //
  // ⚠ COUNTING ONLY APP-AUTHORED SPRINTS WAS THE SINGLE BIGGEST DEFECT OF THE
  // CUTOVER. The scheduler deliberately does NOT add a sprint when club training
  // exists (WC-135) — so a club athlete's app-sprint count is correctly zero, and
  // reporting zero SPRINT CREDIT told §18 the week trained no high speed at all.
  // Measured: 88 occurrences of `sprint_high_speed_required_minimum` across 44
  // worlds, the dominant refusal at zero legacy executions.
  //
  // The game and every club night carry the credit the contract says they carry.
  const appSprintDays = withRunning.filter(
    (day) => day.conditioning === 'sprint_high_speed').length;
  const sprintCount = appSprintDays + anchorConditioning;
  const hardDaySet = new Set<number>([
    ...withRunning.filter((day) => day.owner === 'strength').map((day) => day.dayOfWeek),
    ...inputs.clubNights,
    ...(inputs.gameDay !== null ? [inputs.gameDay] : []),
  ]);
  const fullRestDays = withRunning.filter((day) =>
    day.owner === 'rest_or_recovery' && !day.clubTraining && !day.game).length;

  return {
    weekStartISO: inputs.weekStartISO,
    layoutClauseId: layout.clauseId,
    requiredStrengthSessions: needed,
    days: withRunning,
    intendedPatterns: [...intended],
    demand: {
      mainStrength: needed,
      // WC-045 caps the total at 5; anchors count toward it.
      coreConditioning: Math.min(
        anchorConditioning + appConditioningDays,
        GLOBAL_RULES.conditioning.max),
      anchorConditioning,
      sprintHighSpeed: sprintCount,
      running: runningDayCount,
      fullRestDays,
      hardDays: hardDaySet.size,
    },
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
  // LATEST legal day first: a sprint sits as close to G-3 as the week allows, so
  // it does not crowd the start of the week away from the game.
  //
  // "G-3 or earlier" is a distance from the NEXT game, so it is cyclic like the
  // rest: `daysUntilNextGame >= 3`. The old form compared raw week positions,
  // which for a Sunday fixture called every day eligible — including G+1.
  const untilGame = (day: number) =>
    gameProximity(day, inputs.gameDay, inputs.fixtureRecurrence).daysUntilNextGame;
  const eligible = WEEK_ORDER
    .filter((day) => !inputs.unavailableDays.includes(day))
    .filter((day) => !occupiedDays.has(day))
    .filter((day) => !isGamePlusOne(day, inputs))
    .filter((day) => {
      const until = untilGame(day);
      return until !== null && until >= -INSEASON_SPRINT_RULE.earliestGameOffset;
    })
    // Closest to the game last, so `eligible[last]` is still the latest legal day.
    .sort((a, b) => (untilGame(b) ?? 0) - (untilGame(a) ?? 0));
  if (eligible.length === 0) return null;
  return eligible[eligible.length - 1];
}

/** Re-exported so readers take the budget from the contract, never a literal. */
export { DEFAULT_SET_BUDGET };
