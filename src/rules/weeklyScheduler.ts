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
  hardConditioningQualityFor,
  overlayForPhase,
  type ConditioningKind,
  type ContractConditioningCategory,
  type ContractConditioningRole,
  type ContractPhase,
  type MovementPattern,
  type OffseasonBlock,
  type PhaseOverlay,
  type SessionPurpose,
  type SetBudget,
} from './weeklyProgrammingContract';
import { firstLegalityViolation, firstWeekLegalityViolation } from './weeklyLegality';
import type { WeekKind } from '../types/domain';

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
  /**
   * WC-136. The block this week sits in, used ONLY to rotate the authored hard
   * conditioning quality at the block boundary. Optional because a caller that
   * cannot say which block it is gets the first quality rather than none —
   * absence must not silently delete a required exposure.
   */
  readonly miniCycleNumber?: number | null;
  /**
   * WC-136. Is this a SCHEDULED deload week? Distinct from
   * `readiness.lowReadiness`, which is the athlete DECLARING they are cooked.
   * Absence means `'build'` — the ordinary state, and the safe read, because
   * treating an unknown week as a deload would silently delete a required
   * exposure the phase asked for.
   */
  readonly weekKind?: WeekKind | null;
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
  /**
   * ── WC-139: A SPRINT RIDING A DAY THAT ALREADY CARRIES CONDITIONING ───────
   *
   * **Sam, 2026-08-17, pre-season:** *"Tuesday: Sprint first → Upper strength →
   * authored hard conditioning."* That is TWO conditioning components on one
   * day, and `conditioning` is a single slot — putting the sprint in it
   * DISPLACED the hard session and the pre-season week came back with no hard
   * conditioning at all (measured: `test:conditioning-phase-authorship` 42/42
   * → 40/42).
   *
   * So the sprint gets its own flag rather than competing for the slot. The day
   * keeps `conditioning`/`conditioningCategory` for its hard or aerobic
   * component, and this says a sprint ALSO rides here.
   *
   * **ORDER IS PART OF THE RULING** — *"Sprint first"*, and *"do not place
   * sprinting after Tuesday's hard conditioning"*. The sprint is fresh work; it
   * goes before the lift and before the conditioning. The materialisation
   * boundary and the row composer both honour that, and it is guarded.
   *
   * ⚠ It is FALSE on a day whose only conditioning IS the sprint — that day
   * uses the ordinary `conditioning: 'sprint_high_speed'` slot (WC-138). This
   * flag means specifically *"a second component, and it is a sprint"*.
   */
  readonly sprintComponent: boolean;
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

/** The four facts a reduced or substituted week owes its reader. */
export interface WeeklyReductionRecord {
  readonly intendedStrengthCount: number;
  readonly deliveredStrengthCount: number;
  /** The purpose the week could not deliver as authored. Null when only the count moved. */
  readonly omittedPurpose: SessionPurpose | null;
  readonly reason: string;
}

export interface WeeklySchedule {
  readonly weekStartISO: string;
  readonly layoutClauseId: string;
  readonly requiredStrengthSessions: number;
  /**
   * WHAT THE APPROVED LAYOUT ASKED FOR, before game freshness and availability
   * reduced it. Equal to `requiredStrengthSessions` on an unreduced week.
   */
  readonly authoredStrengthSessions: number;
  /**
   * **Set when the week is a REDUCED one**, naming what was given up and why.
   * Sam, 2026-08-16: *"intended strength count -> delivered count -> omitted
   * purpose -> exact reason."*
   *
   * ⚠ It was a bare string first, and a string could not say the one thing the
   * Sunday-fixture week actually gives up. That week delivers the SAME COUNT it
   * authored — nothing is dropped — but a lower session is offered as upper
   * because G-2 may not hold heavy lower. **A count-only disclosure records that
   * as "no reduction", which is exactly the silent omission this field exists to
   * prevent.** All four facts travel, and the omitted purpose is its own field.
   *
   * Null means nothing was omitted — **not** "we did not check".
   */
  readonly reductionDisclosure: WeeklyReductionRecord | null;
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
  return legalityViolation(assignment, inputs) === null;
}

/**
 * THE SINGLE DOOR TO EVERY PROHIBITION. Delegates to `weeklyLegality`, which owns
 * them all as one enumerable table keyed by clause id.
 *
 * These checks used to live inline here, beside `scoreAssignment`, and that
 * proximity was the defect: G-2 was written as a −25 penalty rather than a ban,
 * so a week short of legal days bought its way past it and put Deadlift two days
 * before a game. **The legality owner cannot see a score, so nothing can be
 * bought.** Proximity is passed IN rather than re-derived there — one owner for
 * the cyclic-week question, which has already cost an athlete a recovery day.
 */
function legalityViolation(
  assignment: readonly { day: number; purpose: SessionPurpose }[],
  inputs: WeeklySchedulerInputs,
): { clauseId: string; reason: string } | null {
  return firstLegalityViolation({
    assignment,
    gymAccessDays: inputs.gymAccessDays,
    unavailableDays: inputs.unavailableDays,
    clubNights: inputs.clubNights,
    gameDay: inputs.gameDay,
    isGameMinusOne: (day) => isGameMinusOne(day, inputs),
    isGameMinusTwo: (day) => isGameMinusTwo(day, inputs),
    isGamePlusOne: (day) => isGamePlusOne(day, inputs),
  });
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

  const authored = layout.purposes.length;

  // ── THE REDUCTION LADDER — BUILD THE BEST SMALLER LEGAL WEEK ─────────────
  //
  // **Sam, 2026-08-16:** *"The approved contract already resolves the choice: game
  // freshness may reduce the selected base, availability is not a quota, and
  // upper-body strength is legal on G-2. Build the best smaller LEGAL week before
  // refusing."*
  //
  // The search used to try the layout's purposes and nothing else, so an athlete
  // whose only remaining legal day was G-2 was refused outright — even though the
  // contract expressly permits UPPER work there. **That refusal was a failure to
  // meet a preferred session count, reported as an impossibility.**
  //
  // The ladder is tried in preference order and the FIRST rung that yields a legal
  // arrangement wins, so a full-count week is always preferred to a substituted
  // one, and a substituted one to a shorter one:
  //
  //   rung 0  the layout exactly as authored
  //   rung 1  same count, lower-ish purposes swapped to `upper` where that is the
  //           only thing a constrained day can legally hold
  //   rung 2+ one fewer session at a time, down to a single session
  //
  // **Nothing here weakens a prohibition.** Every rung is filtered by the same
  // `assignmentIsLegal`, so heavy lower still cannot touch G-2 and G-1/G+1 remain
  // closed. The ladder only changes WHAT is offered, never WHERE it may go.
  const lowerish = (purpose: SessionPurpose): boolean => PURPOSE_IS_LOWER[purpose];
  const rungs: { purposes: SessionPurpose[]; omitted: SessionPurpose | null;
    reason: string | null }[] = [];
  rungs.push({ purposes: [...layout.purposes], omitted: null, reason: null });
  // Rung 1 — substitute lower-ish purposes with upper, fewest swaps first.
  const lowerIdx = layout.purposes
    .map((purpose, index) => (lowerish(purpose) ? index : -1))
    .filter((index) => index >= 0);
  for (let swaps = 1; swaps <= lowerIdx.length; swaps += 1) {
    for (const chosen of combinations(lowerIdx, swaps)) {
      const purposes = [...layout.purposes];
      for (const index of chosen) purposes[index] = 'upper';
      rungs.push({
        purposes,
        omitted: layout.purposes[chosen[0]],
        reason: `${swaps} lower session(s) offered as upper instead — the remaining `
          + 'legal day(s) may not hold heavy lower work two days before the game',
      });
    }
  }
  // Rung 2+ — fewer sessions, keeping the highest-priority purposes first.
  for (let count = authored - 1; count >= 1; count -= 1) {
    rungs.push({
      purposes: layout.purposes.slice(0, count),
      omitted: layout.purposes[count],
      reason: `reduced from ${authored} to ${count} strength session(s) — game `
        + 'freshness and availability leave no legal placement for the rest',
    });
    const reducedLower = layout.purposes.slice(0, count)
      .map((purpose, index) => (lowerish(purpose) ? index : -1))
      .filter((index) => index >= 0);
    for (const index of reducedLower) {
      const purposes = layout.purposes.slice(0, count);
      purposes[index] = 'upper';
      rungs.push({
        purposes,
        omitted: layout.purposes[count],
        reason: `reduced from ${authored} to ${count} strength session(s), one `
          + 'offered as upper — the legal day(s) may not hold heavy lower work',
      });
    }
  }

  let best: { assignment: { day: number; purpose: SessionPurpose }[]; score: number } | null = null;
  let reductionDisclosure: WeeklyReductionRecord | null = null;
  for (const rung of rungs) {
    const needed = rung.purposes.length;
    if (usableGymDays.length < needed) continue;
    for (const dayCombo of combinations(usableGymDays, needed)) {
      for (const ordering of permutations(rung.purposes)) {
        const assignment = dayCombo.map((day, index) => ({ day, purpose: ordering[index] }));
        if (!assignmentIsLegal(assignment, inputs)) continue;
        const score = scoreAssignment(assignment, inputs);
        if (!best || score > best.score) best = { assignment, score };
      }
    }
    // FIRST rung that produces anything wins: the ladder is ordered by
    // preference, so a later rung is by construction a worse week.
    if (best) {
      reductionDisclosure = rung.reason === null ? null : {
        intendedStrengthCount: authored,
        deliveredStrengthCount: best.assignment.length,
        omittedPurpose: rung.omitted,
        reason: rung.reason,
      };
      break;
    }
  }
  if (!best) {
    // A TRUE hard minimum failure: not even ONE strength session fits.
    return {
      refused: true, finding: 'no_legal_arrangement_within_spacing_rules',
      clauseId: 'WC-043',
      detail: `${layout.clauseId} could not place even one strength session on `
        + `${usableGymDays.length} legal day(s): every arrangement breaks a `
        + 'prohibition (game proximity, lower spacing or plane repetition)',
    };
  }
  const needed = best.assignment.length;

  const overlayOptional = inputs.phase === 'Off-season'
    && inputs.offseasonBlock === 'early_optional';

  // ── ANCHOR CREDIT IS SPENT BEFORE THE APP ADDS ANYTHING ──────────────────
  //
  // **Sam, 2026-08-16:** *"club training Wednesday, club training Friday and the
  // Sunday game already provide three conditioning exposures. Do not add
  // conditioning merely to increase the count."*
  //
  // WC-045: *"Aim for 3-5 conditioning exposures; **club training and games
  // count**"*, and Bible §18 C: *"Add only the remaining requirement after genuine
  // anchor credit."* Conditioning was attached to EVERY strength day
  // unconditionally, so a two-club-night athlete with a fixture — already at the
  // floor of three — was given a bike on Wednesday and a rower on Friday purely to
  // raise a number that was already met. **That is added training load with no
  // rule asking for it.**
  //
  // The app now supplies only the shortfall. Anchors are counted first, and the
  // budget is spent in day order so the result does not depend on which day the
  // loop happens to reach first.
  const anchorConditioningDays = new Set<number>([
    ...inputs.clubNights,
    ...(inputs.gameDay !== null ? [inputs.gameDay] : []),
  ]).size;
  const purposeByDay = new Map(best.assignment.map((s) => [s.day, s.purpose]));

  // ── WC-136: THE PHASE OWNS THE COUNT AND THE QUALITY ─────────────────────
  //
  // **This read is the whole point of the overlays.** The budget came from
  // `GLOBAL_RULES.conditioning.min` — ONE number, 3, for every phase — while
  // `PRESEASON_OVERLAY.conditioningTarget` said 4 and `early_optional` said 0,
  // and neither was read by anything. A healthy no-club pre-season athlete was
  // authored two app exposures against the approved source's four.
  const overlay = overlayForPhase(inputs.phase, inputs.offseasonBlock);

  // ⚠ **THE SPRINT IS DECIDED FIRST, AND IT IS SPENT FROM THE SAME BUDGET.**
  // A sprint night IS a conditioning exposure — `demand.coreConditioning`
  // counts it, and so does §18. Placing it after the budget had already been
  // spent made it ADDITIVE: a no-club pre-season athlete with a fixture was
  // authored three component exposures plus a standalone sprint plus the game,
  // which is five against the overlay's target of four. The app is only ever
  // meant to supply *"the remaining shortfall"*.
  // ── WC-138: THE SPRINT RIDES AN UPPER DAY WHEN THERE IS ONE ──────────────
  //
  // **Sam, 2026-08-17**, on both rejected layouts: the sprint belongs ON a
  // strength day, not on a day of its own. Pre-season *"Tuesday: Sprint first →
  // Upper strength → authored hard conditioning"*; later off-season *"Friday:
  // Upper + sprint/top-end"*. §3 already said so — *"Upper + running: hard
  // running/top-end work belongs with upper days where possible"* — and the
  // scheduler was reading that for `running` and not for the sprint.
  //
  // A standalone sprint day is the FALLBACK, not the default: it is what an
  // athlete with no legal upper day gets, and it is what produced the rejected
  // Wednesday and Sunday sprints.
  //
  // **THE LAST legal upper day, not the first.** Off-season's approved
  // reference puts it on Friday with Tuesday carrying the hard running, so the
  // week's two high-output running exposures sit apart. Taking the first upper
  // day would stack them on Tuesday.
  const sprintUpperDay = upperDayForSprint(inputs, overlay, purposeByDay);
  const plannedSprintDay = sprintUpperDay
    ?? appSprintDay(inputs, overlay, new Set(purposeByDay.keys()));

  // ── WC-139: PRE-SEASON PUTS THE SPRINT ON THE HARD DAY, AS A SECOND
  //           COMPONENT ─────────────────────────────────────────────────────
  //
  // **Sam:** *"Tuesday: Sprint first → Upper strength → authored hard
  // conditioning"*, and *"consolidate the two high-output running exposures
  // onto Tuesday"*. So pre-season's sprint does not take a slot or a day of its
  // own — it joins the day the hard conditioning is already on.
  //
  // `hardDay` is computed below, so this is resolved after it. Off-season keeps
  // WC-138's separate Friday (its reference deliberately SPREADS the two), and
  // in-season keeps its own standalone day.
  const preseasonSprintRidesHardDay = inputs.phase === 'Pre-season'
    && overlay.sprintExposureRequired
    && inputs.clubNights.length === 0;
  let appConditioningBudget = Math.max(
    0,
    overlay.conditioningTarget.min
      - anchorConditioningDays
      // ⚠ ONLY A STANDALONE SPRINT COSTS AN EXTRA DAY. When the sprint rides an
      // upper strength day (WC-138) it occupies one of the component slots this
      // budget is already counting, so subtracting for it too spent the same
      // exposure twice and the week came back one short.
      - (sprintUpperDay !== null || plannedSprintDay === null ? 0 : 1),
  );

  // ── WHICH DAYS MAY CARRY APP CONDITIONING AT ALL, DECIDED BEFORE THE LOOP ─
  //
  // The budget used to be spent greedily inside the day loop, which meant the
  // hard exposure could only ever land wherever the loop happened to reach
  // first. Choosing the receiving days up front lets the hard slot be PLACED
  // rather than fall out, and it is the same day order either way.
  //
  // **NEVER A CLUB NIGHT.** *"Never add app conditioning on club-training
  // days."* A club night is already a conditioning exposure and already counted
  // in `anchorConditioningDays`; attaching app conditioning to it both
  // double-counts the day and stacks the athlete's hardest evening.
  const conditioningDays = WEEK_ORDER.filter((day) =>
    purposeByDay.has(day)
    && !inputs.unavailableDays.includes(day)
    && !inputs.clubNights.includes(day)
    && inputs.gameDay !== day).slice(0, appConditioningBudget);
  const conditioningDaySet = new Set(conditioningDays);

  // ── WC-060: THE SHORTFALL MAY LEAVE THE GYM DAYS ─────────────────────────
  //
  // Decision 15, verbatim: *"required equipment-free running OR CONDITIONING
  // may be placed outside gym-access days when needed to meet the phase
  // minimum"*. The existing top-up below reads only the RUNNING minimum, and
  // that is not the same requirement.
  //
  // ⚠ **THE WORLD THAT PROVED IT: two gym days that are BOTH club nights, no
  // fixture.** Refusing app conditioning on a club night (correctly) leaves no
  // gym day free, the anchors supply two exposures against a minimum of three,
  // and the week refuses — 8 worlds. The honest answer is not to weaken the
  // club-night rule or to inflate the count: it is the one the approved source
  // already gives, a standalone equipment-free exposure on a free day.
  const residualConditioning = Math.max(0, appConditioningBudget - conditioningDays.length);

  // ── WC-136: WHERE THE ONE HARD EXPOSURE MAY LAND ─────────────────────────
  //
  // *"No hard conditioning within 48 hours of a game."* G-2 and G-1 are inside
  // 48 hours; G+1 is the contract's own rest/recovery day. All three are
  // excluded, and the day is never moved to make room — if no legal day exists
  // the week simply authors no hard session, which is a correct week and not a
  // shortfall.
  //
  // *"Prefer hard running/top-end work with upper-body days"* — so an UPPER day
  // is chosen first and a lower day only if no upper day is legal. On a lower
  // day the exposure stays `off_leg`, which keeps *"prefer off-leg bike/row/ski/
  // air-bike conditioning with lower-body days"* true of the hard session too.
  // ── WC-136: THE THREE IN-SEASON SHAPES, AND THE READINESS FLOOR ──────────
  //
  // `requiresNoGameWeek` is what makes in-season *"maintain strength and
  // conditioning while arriving fresh for the game"* into a rule rather than a
  // blanket refusal. A normal in-season game week and a no-club game week both
  // author no hard aerobic work (the no-club week still gets its SPRINT below);
  // a healthy bye week does, and it stands in for the exposure the fixture
  // would have supplied.
  //
  // **AND HARD WORK IS NEVER ADDED IN LOW READINESS, IN ANY PHASE.** The Block
  // Two contract: *"Do not add sessions or load in this state."* Reducing the
  // week is the readiness owner's job; this is only the refusal to ADD.
  //
  // ⚠ **A REDUCED WEEK IS A REDUCED WEEK, WHICHEVER WAY IT GOT THERE — AND THE
  // SCHEDULED DELOAD IS THE HALF THAT WAS MISSING.**
  //
  // The first version gated only on `readiness.lowReadiness`, the athlete's own
  // declaration. That left the SCHEDULED block deload — every fourth week —
  // authoring a hard session, and the deload machinery downstream then stripped
  // it. The scheduler's demand still counted it, so §18 saw a week that owed 4
  // conditioning exposures and delivered 3 and raised
  // `unresolvedPlannerSelectedShortfall: 1`. Measured on
  // `Pre-season/6 gym days/club Tue+Thu/no fixture`: weeks 1-3 clean, **week 4
  // short by exactly one — the hard one.**
  //
  // The honest fix is at THIS producer, not at §18: a deload week must never be
  // AUTHORED a hard exposure in the first place, so nothing downstream has to
  // remove one. §8's deload is a reduction, and adding the week's hardest
  // session to it was never the contract's intent.
  //
  // **AND THIS IS NOW ONE AUTHORITY, NOT TWO.** The `lowReadiness` half is no
  // longer a redundant second refusal sitting behind an owner that already did
  // the job — it is one arm of the single question *"is this a week we may add
  // hard work to?"*, and the `weekKind` arm is reachable and mutation-visible.
  const weekIsReduced = inputs.weekKind === 'deload' || inputs.readiness.lowReadiness;
  const weekAllowsHard =
    (!overlay.hardConditioning.requiresNoGameWeek || inputs.gameDay === null)
    && !weekIsReduced;
  const hardQuality = weekAllowsHard
    ? hardConditioningQualityFor(overlay, inputs.miniCycleNumber)
    : null;
  const hardEligible = conditioningDays.filter((day) => {
    if (inputs.gameDay === null) return true;
    if (isGameMinusOne(day, inputs) || isGameMinusTwo(day, inputs)) return false;
    return !isGamePlusOne(day, inputs);
  });
  const hardDayForSprint = hardQuality === null ? null : (
    hardEligible.find((day) => !PURPOSE_IS_LOWER[purposeByDay.get(day)!])
    ?? hardEligible[0] ?? null);
  const hardDay = hardDayForSprint;
  // WC-139 — the sprint joins the hard day when the phase asks for that shape,
  // and only when that day is legal for a sprint (never inside G-3, never a
  // club night; `hardEligible` has already excluded G-2, G-1 and G+1).
  const sprintComponentDay = preseasonSprintRidesHardDay
    && hardDay !== null
    && sprintDayIsLegal(hardDay, inputs)
    ? hardDay
    : null;

  const days: SessionIntention[] = [];
  for (const day of WEEK_ORDER) {
    const dateISO = dateForDayOfWeek(inputs.weekStartISO, day);
    if (inputs.unavailableDays.includes(day)) continue;   // WC-061 — never used
    const purpose = purposeByDay.get(day) ?? null;
    if (inputs.gameDay === day) {
      days.push({
        dateISO, dayOfWeek: day, purpose: null, owner: 'game', movementIntention: [],
        setBudget: null, conditioning: null, conditioningCategory: null,
        conditioningRole: null, powerEligible: false, sprintComponent: false,
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
        // Attached ONLY on the days chosen above: anchors have already been
        // counted, and a day that needs no top-up carries none.
        conditioning: conditioningDaySet.has(day)
          ? (PURPOSE_IS_LOWER[purpose] ? 'off_leg' : 'running')
          : null,
        // ⚠ WC-136 — THE QUALITY, NOT JUST THE MODALITY. The category used to
        // be a pure function of upper/lower, so it could only ever be
        // `aerobic_base` or `tempo` and the 18 authored aerobic-power and
        // anaerobic templates were unreachable from here. The hard day overrides
        // the capacity default with the phase's authored quality; the modality
        // (`off_leg` above) is untouched, so a hard lower day is still off-leg.
        conditioningCategory: conditioningDaySet.has(day)
          ? (day === hardDay && hardQuality !== null
            ? hardQuality
            : CATEGORY_FOR_CONDITIONING[PURPOSE_IS_LOWER[purpose] ? 'off_leg' : 'running'])
          : null,
        // Riding on a strength session, never a session of its own — and null
        // when no conditioning was owed, so the day carries no empty component.
        conditioningRole: conditioningDaySet.has(day) ? 'component' : null,
        sprintComponent: day === sprintComponentDay,
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
        conditioningRole: null, powerEligible: false, sprintComponent: false,
        optional: false, clauseId: 'WC-062', clubTraining: true, game: false,
      });
      continue;
    }
    days.push({
      dateISO, dayOfWeek: day, purpose: null, owner: 'rest_or_recovery',
      movementIntention: [], setBudget: null, conditioning: null,
      conditioningCategory: null, conditioningRole: null, powerEligible: false, sprintComponent: false,
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
  // The RUNNING minimum and the CONDITIONING shortfall are two different
  // requirements served by the same placement rules, so the loop satisfies
  // whichever is still outstanding. `residualConditioning` is what the gym days
  // could not absorb; it is spent here or not at all.
  let outstandingConditioning = residualConditioning;
  // ── WC-041: A TOP-UP GOES WHERE IT DOES NOT BUILD A FIFTH STRAIGHT DAY ────
  //
  // The loop used to take the first legal day in week order, which for a
  // Mon/Tue/Thu/Fri athlete is WEDNESDAY — the one rest day the approved
  // off-season reference protects, and the day whose loss turns Mon-Fri into
  // five consecutive training days. §3: *"Consecutive hard days: prefer no more
  // than 3."* Saturday extends Thu-Fri to three; Wednesday extends Mon-Fri to
  // five, and the contract already prefers the first.
  //
  // So the candidates are ORDERED by the training streak they would create,
  // shortest first, week order breaking ties. It is a preference over legal
  // days, not a new prohibition: nothing is excluded that was legal before.
  const trainingDayNumbers = new Set<number>([
    ...purposeByDay.keys(),
    ...inputs.clubNights,
    ...(inputs.gameDay !== null ? [inputs.gameDay] : []),
  ]);
  // ⚠ **CYCLIC.** A Sunday top-up is adjacent to NEXT Monday's lower session,
  // and a Mon-to-Sun scan cannot see that — it scored Sunday as a streak of one
  // and put the long run immediately before a squat day. Walking the week twice
  // and taking the longest run inside the second lap counts the wrap-around,
  // which is how `gameProximity` already reasons about G-1 and G+1.
  const longestStreakWith = (day: number): number => {
    const withDay = new Set([...trainingDayNumbers, day]);
    let run = 0; let longest = 0;
    for (const probe of [...WEEK_ORDER, ...WEEK_ORDER]) {
      run = withDay.has(probe) ? run + 1 : 0;
      longest = Math.max(longest, run);
    }
    return Math.min(longest, WEEK_ORDER.length);
  };
  const topUpOrder = [...WEEK_ORDER].sort((a, b) =>
    longestStreakWith(a) - longestStreakWith(b)
    || WEEK_ORDER.indexOf(a) - WEEK_ORDER.indexOf(b));

  if (inputs.phase !== 'Off-season' || inputs.offseasonBlock !== 'early_optional') {
    for (const day of topUpOrder) {
      if (runningDays.size >= GLOBAL_RULES.running.min && outstandingConditioning <= 0) break;
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
      outstandingConditioning = Math.max(0, outstandingConditioning - 1);
      runningTopUps.push({
        dateISO: dateForDayOfWeek(inputs.weekStartISO, day), dayOfWeek: day,
        purpose: null, owner: 'conditioning', movementIntention: [], setBudget: null,
        conditioning: 'running', conditioningCategory: CATEGORY_FOR_CONDITIONING.running,
        // A day of its own — nothing else is authorised here.
        conditioningRole: 'standalone', powerEligible: false, sprintComponent: false,
        optional: false, clauseId: 'WC-060',
        clubTraining: inputs.clubNights.includes(day), game: false,
      });
    }
  }
  // ── WC-135/WC-124: THE APP SPRINT, IN EVERY PHASE THAT REQUIRES ONE ──────
  //
  // *"At least 1 except early off-season. Games and club training can supply it.
  // In-season, only add sprint work when there is no club training, and place it
  // G-3 or earlier."*
  //
  // The in-season half was placed here already; **pre-season and off-season were
  // not, and `coachingEngine`'s post-validation "sprint rescue" was covering for
  // them by OVERWRITING a conditioning slot this scheduler had authored.** That
  // legacy authority is deleted in the same commit, so this call has to answer
  // for every phase the overlay marks `sprintExposureRequired`.
  // Decided above, before the conditioning budget was spent, so the sprint sits
  // INSIDE the phase target rather than on top of it.
  // WC-139 — when the sprint rides the hard day it is NOT also placed
  // elsewhere. Leaving both would give the week two sprints and a Wednesday
  // session Sam explicitly rejected.
  const sprintDay = sprintComponentDay !== null ? null : plannedSprintDay;
  const withSprint = sprintDay === null ? days : days.map((entry) => {
    if (entry.dayOfWeek !== sprintDay) return entry;
    // WC-138 — the sprint rides the upper session already authorised here.
    if (entry.owner === 'strength') {
      return { ...entry,
        conditioning: 'sprint_high_speed' as const,
        conditioningCategory: CATEGORY_FOR_CONDITIONING.sprint_high_speed,
        conditioningRole: 'component' as const,
        clauseId: 'WC-138' };
    }
    // WC-135 — the fallback: a day of its own, for an athlete with no legal
    // upper day to put it on.
    if (entry.owner === 'rest_or_recovery') {
      return { ...entry, owner: 'conditioning' as const,
        conditioning: 'sprint_high_speed' as const,
        conditioningCategory: CATEGORY_FOR_CONDITIONING.sprint_high_speed,
        conditioningRole: 'standalone' as const, optional: false,
        clauseId: 'WC-135' };
    }
    return entry;
  });

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
  // ⚠ A WC-139 SPRINT COMPONENT IS ITS OWN EXPOSURE. It shares a DAY with the
  // hard session but it is a second piece of conditioning, and Sam counts it:
  // *"Monday aerobic + Tuesday sprint + Tuesday hard conditioning + Saturday
  // game"* is four. Counting days rather than components lost it.
  const appConditioningDays = withRunning.filter((day) => day.conditioning !== null).length
    + withRunning.filter((day) => day.sprintComponent).length;
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
    (day) => day.conditioning === 'sprint_high_speed' || day.sprintComponent).length;
  const sprintCount = appSprintDays + anchorConditioning;
  const hardDaySet = new Set<number>([
    ...withRunning.filter((day) => day.owner === 'strength').map((day) => day.dayOfWeek),
    ...inputs.clubNights,
    ...(inputs.gameDay !== null ? [inputs.gameDay] : []),
  ]);
  const fullRestDays = withRunning.filter((day) =>
    day.owner === 'rest_or_recovery' && !day.clubTraining && !day.game).length;

  const demand = {
    mainStrength: needed,
    // WC-045 caps the total at 5; anchors count toward it. **The clamp is a
    // FACT, not the verdict** — the week-level legality pass below renders that,
    // so a future edit removing this `min` refuses the week instead of shipping it.
    coreConditioning: Math.min(
      anchorConditioning + appConditioningDays,
      GLOBAL_RULES.conditioning.max),
    anchorConditioning,
    sprintHighSpeed: sprintCount,
    running: runningDayCount,
    fullRestDays,
    hardDays: hardDaySet.size,
  };

  // ── THE SECOND LEGALITY MOMENT, SAME OWNER ──────────────────────────────
  //
  // Prohibitions whose subject only exists once the week is built — running
  // top-ups, conditioning exposures counting anchors, the session count from the
  // chosen layout, the set ceiling. They were DELEGATED with a note naming
  // another owner, and the pressure receipts showed those notes were claims:
  // WC-030's was vacuous, WC-044 and WC-046 never approached their limits.
  //
  // The loops above still COMPUTE these facts. They no longer render the verdict.
  const weekViolation = firstWeekLegalityViolation({
    strengthDays: withRunning
      .filter((day) => day.owner === 'strength' && day.purpose !== null)
      .map((day) => ({ day: day.dayOfWeek, purpose: day.purpose as SessionPurpose })),
    runningDays: withRunning
      .filter((day) => day.conditioning === 'running'
        || day.conditioning === 'sprint_high_speed'
        || day.sprintComponent)
      .map((day) => day.dayOfWeek),
    coreConditioning: demand.coreConditioning,
    setsPerSession: layout.setBudget?.hardCeiling ?? 0,
    phase: inputs.phase,
  });
  if (weekViolation !== null) {
    return {
      refused: true,
      finding: 'no_legal_arrangement_within_spacing_rules',
      clauseId: weekViolation.clauseId,
      detail: weekViolation.reason,
    };
  }

  return {
    weekStartISO: inputs.weekStartISO,
    layoutClauseId: layout.clauseId,
    requiredStrengthSessions: needed,
    authoredStrengthSessions: authored,
    reductionDisclosure,
    days: withRunning,
    intendedPatterns: [...intended],
    demand,
  };
}

/**
 * WC-135. May the app add its own sprint session this week?
 * *"In-season, only add sprint work when there is no club training, and place it
 * G-3 or earlier."* Exported so the conditioning owner reads the contract rather
 * than restating it.
 */
/**
 * WC-138. The LAST legal upper strength day for the sprint, or null.
 *
 * Null means "no legal upper day" and sends the caller to `appSprintDay`'s
 * standalone placement — the preference must never become a refusal.
 *
 * The legality is `appSprintDay`'s, asked of a strength day instead of a free
 * one: the phase must require a sprint, club training must be absent, and with
 * a fixture the day must be G-3 or earlier.
 */
/**
 * WC-135's day legality, asked of one day. Never a club night, never inside G-3.
 *
 * BIBLE_ANCHOR: last_high_stress_g3
 *
 * ⚠ THIS IS NOW THE ANCHOR'S GENERATION-SIDE SITE, AND IT ALWAYS SHOULD HAVE
 * BEEN. The citation used to name `distanceBeforeFixture` inside
 * `postGenerationConstraintValidation.buildSection18ProductionFallbackCandidate`
 * — the §18 FALLBACK WEEK BUILDER, deleted 2026-08-19. So the Bible's "last
 * additional high stress is G-3" was being enforced by a second authority while
 * it authored a replacement week, downstream of the scheduler that had already
 * decided the days. Deleting that builder took the citation with it and reddened
 * `test:bible-anchors`, which is the anchor registry doing exactly its job.
 *
 * The LAW is current and approved; only its duplicate implementation was legacy.
 * The scheduler owns session days and spacing, so the citation moves here, to
 * the site that actually decides whether a hard day may sit inside G-3.
 */
function sprintDayIsLegal(day: number, inputs: WeeklySchedulerInputs): boolean {
  if (inputs.clubNights.includes(day)) return false;
  if (inputs.gameDay === day) return false;
  if (inputs.unavailableDays.includes(day)) return false;
  if (inputs.gameDay === null) return true;
  if (isGamePlusOne(day, inputs)) return false;
  const until = gameProximity(day, inputs.gameDay, inputs.fixtureRecurrence)
    .daysUntilNextGame;
  return until !== null && until >= -INSEASON_SPRINT_RULE.earliestGameOffset;
}

function upperDayForSprint(
  inputs: WeeklySchedulerInputs,
  overlay: PhaseOverlay,
  purposeByDay: ReadonlyMap<number, SessionPurpose>,
): number | null {
  if (!overlay.sprintExposureRequired) return null;
  if (inputs.clubNights.length > 0) return null;
  // ⚠ **OFF-SEASON ONLY, AND PRE-SEASON'S ABSENCE HERE IS A MEASURED REFUSAL,
  // NOT AN OVERSIGHT.**
  //
  // IN-SEASON: Sam approved that week as it stands. Widening this moved its
  // sprint off its own Wednesday and onto Tuesday's upper session — a week he
  // had already signed, and its printed output stopped being byte-identical.
  //
  // PRE-SEASON: his layout is *"Tuesday: Sprint first → Upper strength →
  // authored hard conditioning"* — TWO conditioning components on one day. A
  // `SessionIntention` carries ONE `conditioning` kind and
  // `materialiseAuthoredSessions` returns ONE `conditioningTemplate` per day,
  // so the sprint can only take Tuesday's slot by DISPLACING the hard session.
  // Measured: doing that left the pre-season week with no hard conditioning at
  // all (`test:conditioning-phase-authorship` 42/42 -> 40/42), which is a
  // straight loss of the exposure the conditioning work exists to deliver.
  // **The two-component day is a model change across the scheduler, the
  // materialisation boundary, the coaching plan and row composition; it is not
  // a line in this one.**
  if (inputs.phase !== 'Off-season') return null;
  const untilGame = (day: number) =>
    gameProximity(day, inputs.gameDay, inputs.fixtureRecurrence).daysUntilNextGame;
  const eligible = WEEK_ORDER
    .filter((day) => purposeByDay.has(day))
    .filter((day) => !PURPOSE_IS_LOWER[purposeByDay.get(day)!])
    .filter((day) => !inputs.unavailableDays.includes(day))
    .filter((day) => !inputs.clubNights.includes(day))
    .filter((day) => inputs.gameDay !== day)
    .filter((day) => (inputs.gameDay === null ? true : !isGamePlusOne(day, inputs)))
    .filter((day) => {
      if (inputs.gameDay === null) return true;
      const until = untilGame(day);
      return until !== null && until >= -INSEASON_SPRINT_RULE.earliestGameOffset;
    });
  return eligible.length === 0 ? null : eligible[eligible.length - 1];
}

export function appSprintDay(
  inputs: WeeklySchedulerInputs,
  overlay: PhaseOverlay,
  /**
   * Days already holding app work. **A sprint must land on a FREE day** — the
   * first draft returned the first eligible weekday without asking, which was
   * Monday, already a strength day, so no sprint was ever placed and the WC-135
   * guard sat green over a rule the scheduler did not implement.
   */
  occupiedDays: ReadonlySet<number> = new Set(),
): number | null {
  // ── WC-124/WC-135, GENERALISED TO EVERY PHASE ────────────────────────────
  //
  // §3's sprint row is ONE rule, not an in-season one: *"At least 1 except
  // early off-season. **Games and club training can supply it.** In-season,
  // only add sprint work when there is no club training, and place it G-3 or
  // earlier."*
  //
  // ⚠ **THIS FUNCTION USED TO REFUSE EVERY PHASE BUT IN-SEASON**, so the
  // pre-season and off-season sprint had no owner here — and the thing that
  // actually placed them was `coachingEngine`'s post-validation "sprint
  // rescue", which took a conditioning slot the scheduler had already authored
  // and OVERWROTE it. That is the legacy authority this mission removes, and
  // it cannot be removed until this owner covers the phases it was covering.
  //
  // The club-training gate is the whole of the anchor test, deliberately: a
  // GAME does not suppress the app sprint. Sam's approved source adds the
  // in-season sprint on a no-club week that still has a fixture, and the
  // placement rule below (G-3 or earlier) is what keeps that safe.
  if (!overlay.sprintExposureRequired) return null;
  if (inputs.clubNights.length > 0) return null;
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
    .filter((day) => inputs.gameDay !== day)
    .filter((day) => !inputs.clubNights.includes(day))
    // A NO-GAME WEEK HAS NO PROXIMITY TO RESPECT, so every free day is legal and
    // the ordering below is a no-op. Guarding the whole function on a fixture —
    // which the in-season-only version did — is what left a bye week, and every
    // off-season week, with no sprint owner at all.
    .filter((day) => (inputs.gameDay === null ? true : !isGamePlusOne(day, inputs)))
    .filter((day) => {
      if (inputs.gameDay === null) return true;
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
