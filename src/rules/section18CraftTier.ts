/**
 * THE CRAFT TIER — Sam's Section 17 rules, wired to BLOCK instead of to log.
 *
 * `rules/weekStructureValidator` is the Bible's Section 17 kernel: it knows
 * G-1, G-2, G+1, the double-day pairings, team training that is pretending to
 * be recovery, the weekly caps and the minimum effective week. Its own header
 * said "FINDINGS ONLY … enforcement is a later phase behind its own approved
 * plan", and it had exactly three callers, all of which only logged. **The
 * plan became a permanent state: Sam's craft rules were built, and then left
 * switched off.** Meanwhile the gate that DOES block — the §18 effective-week
 * evaluator — asserts CONTRACT CONFORMANCE (counts, ceilings, floors,
 * prohibitions, pattern balance) and never asks whether the week reads like a
 * coach wrote it. That gap is the difference between "the labels are okay" and
 * "the programming is pretty shit".
 *
 * This module is the seam that closes it. It is deliberately ONE seam: every
 * path that can change what the athlete sees — generation, the nine edit doors,
 * a coach revision, a fixture move, a tap, hydration — already converges on
 * `section18AcceptedWeekGateway`'s `assess` closure, so joining the craft tier
 * there retro-fits all of them at once and no future door has to be told.
 *
 * THREE RULES DECIDE WHAT BLOCKS, and each exists because the alternative was
 * measurably wrong:
 *
 *  1. **`strong` and above, never `soft`/`info`.** The validator's own severity
 *     policy (approved 2026-07-08) reserves `strong` for risky programming.
 *     Measured on all 17 `test:qa` scenarios before this landed: zero strong
 *     findings, so turning the tier on changes no generated week today. It
 *     shuts the door, it does not re-write the house.
 *
 *  2. **Only findings that name a day this week can still change.** Days before
 *     the contract's `governedFromISO` are FACTS — work the athlete already
 *     did. Blocking on the past would make a week unrepairable for a reason no
 *     repair can reach. Findings that name no day at all (the weekly caps) are
 *     disclosed but never blocking: those are counts, and counts are already
 *     the §18 evaluator's own question in its own vocabulary. **The craft tier
 *     owns SHAPE; the contract owns COUNT.** Two owners, no overlap.
 *
 *  3. **A SESSION THE ATHLETE PLACED IS NEVER BLOCKED AND NEVER MOVED.** The
 *     violation is still FOUND and still disclosed — the athlete is told — but
 *     it cannot fail the week and no repair may touch it. `resolverMayDisplace`
 *     is THE ONE PREDICATE for this and every deriver in the app already asks
 *     it; this tier is a new deriver and the first version of it did not ask.
 *     `test:placement-ownership`, `test:displacement-sweep`,
 *     `test:g1-landing-ask-flow`, `test:athlete-session-move` and
 *     `test:athlete-door-matrix` all reddened, which is exactly what that table
 *     of guards exists to do. **An athlete who deliberately puts a session on
 *     G-1 has made a decision, and a quality gate that silently undoes it is
 *     the app overruling a person.** The app's job there is to warn, which the
 *     G-1 ask-flow already does before the placement is ever accepted.
 *
 *  4. **A craft violation may fail a CANDIDATE; it may never veto a FACT.**
 *     Same ruling the gateway already lives under (§18 ownership reassessment
 *     2026-08-05, D3). If the repair search can find a week without the
 *     violation, it takes it — that is the behaviour change. If it cannot, the
 *     week publishes with the violation DISCLOSED as a repair kind rather than
 *     throwing, so a stored week generated before this tier existed can still
 *     hydrate. An enforcement that bricks the app on launch is not enforcement.
 *
 * An internal validator error becomes ONE blocking finding rather than silence.
 * Swallowing it would re-create the exact failure this module exists to end: a
 * rule that ships wired to nothing and looks fine.
 */

import type { OnboardingData, Workout } from '../types/domain';
import { isoDateForWeekday } from '../utils/appDate';
import { resolverMayDisplace } from './athletePlacement';
import type { WeeklyExposureContractV2 } from './weeklyExposureContractV2';
import {
  deriveWeekValidationFlags,
  validateProgramWeek,
  type ValidateProgramWeekInput,
  type ValidatorDayInput,
  type WeekFinding,
} from './weekStructureValidator';

/** Monday-first day numbers, JS convention (Sunday 0). */
const WEEK_DAY_NUMBERS = [1, 2, 3, 4, 5, 6, 0] as const;

export interface WeekCraftAssessment {
  /** Every finding the Section 17 kernel produced for this week. */
  findings: readonly WeekFinding[];
  /** The subset that blocks acceptance — see rules 1 and 2 above. */
  blocking: readonly WeekFinding[];
}

export interface WeekCraftInput {
  contract: WeeklyExposureContractV2;
  /** The VISIBLE week — what the athlete will actually see. */
  workouts: readonly Workout[];
  weekStart: string;
  profile?: OnboardingData | null;
  /**
   * THE DATES A REPAIR CAN STILL CHANGE — supplied, never re-derived, and
   * REQUIRED so it cannot be forgotten.
   *
   * The obvious implementation reads the contract's `governedFromISO` here. It
   * is wrong, and `test:gateway-authority-census` reds on it: the one-owner
   * governance boundary (fourteenth-pass ruling, 2026-08-07) puts exactly ONE
   * reader of that field in the app, at the gateway's candidate assembly, so
   * that no downstream writer is ever trusted to know the law again. This tier
   * is downstream. It is TOLD which days are still the app's to change.
   */
  governableDates: ReadonlySet<string>;
}

function shiftISO(dateISO: string, days: number): string {
  const date = new Date(`${dateISO.slice(0, 10)}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function blocksBySeverity(finding: WeekFinding): boolean {
  return finding.severity === 'strong' || finding.severity === 'hard_stop';
}

/** Stable identity for "is this the same finding as before". */
export function craftFindingKey(finding: WeekFinding): string {
  return `${finding.ruleId}|${finding.dates.join(',')}|${finding.sessions.join(',')}`;
}

export function craftBlockingSummary(findings: readonly WeekFinding[]): string {
  return findings.map((finding) => `${finding.ruleId}@${finding.dates.join(',') || 'week'}`)
    .sort()
    .join(',');
}

/**
 * The week as the Section 17 kernel needs to see it.
 *
 * The fixture ANCHOR is the game, not `markedDays` and not the profile: a
 * practice-match week has no calendar mark and the profile's game day has eight
 * representations in this repo. The contract is the one thing that already
 * knows which day this week's fixture is on, so it is the only thing asked.
 *
 * The ±7 shift gives the kernel the neighbouring fixtures it needs to protect
 * the EDGES of the week — a Sunday game means this Monday is G+1, and no
 * session inside this week can tell you that.
 */
function craftValidatorInput(args: WeekCraftInput): ValidateProgramWeekInput {
  const weekStart = args.weekStart.slice(0, 10);
  const byDay = new Map<number, Array<Workout | null>>();
  for (const day of WEEK_DAY_NUMBERS) byDay.set(day, []);
  for (const workout of args.workouts) {
    byDay.get(workout.dayOfWeek)?.push(workout);
  }
  const days: ValidatorDayInput[] = WEEK_DAY_NUMBERS.map((day) => ({
    date: isoDateForWeekday(weekStart, day),
    workouts: byDay.get(day) ?? [],
  }));

  const fixture = args.contract.anchors.find((anchor) =>
    anchor.kind === 'game' || anchor.kind === 'practice_match');
  const fixtureDate = fixture ? isoDateForWeekday(weekStart, fixture.dayOfWeek) : null;
  const anchors: ValidateProgramWeekInput['anchors'] = {
    gameDates: fixtureDate ? [fixtureDate] : [],
    teamTrainingDates: args.contract.anchors
      .filter((anchor) => anchor.kind === 'team_training')
      .map((anchor) => isoDateForWeekday(weekStart, anchor.dayOfWeek)),
    ...(fixtureDate
      ? { previousGameDate: shiftISO(fixtureDate, -7), nextGameDate: shiftISO(fixtureDate, 7) }
      : {}),
  };

  const profile = {
    experienceLevel: args.profile?.experienceLevel,
    conditioningLevel: args.profile?.conditioningLevel,
    // THE WEEK'S OWN PHASE, not the profile's. A rebuild judged by the phase it
    // is replacing is the defect `resolveFinalVisibleSection18Week` already
    // names at its `ownedPhase` argument.
    seasonPhase: args.contract.identity.seasonPhase,
  };

  const explicitFlags = {
    // Every door the app has for "go easier this week". The kernel uses this to
    // stop nagging a light week for being light; a reduced week that is also
    // badly SHAPED still produces its shape findings.
    reducedLoadActive:
      args.contract.safety.trainingPaused === true ||
      args.contract.identity.weekKind === 'deload' ||
      args.contract.identity.mode === 'optional_week' ||
      args.contract.identity.mode === 'in_season_bye_recovery' ||
      args.contract.safety.reasons.includes('low_readiness'),
    ...(args.contract.identity.mode.startsWith('in_season_bye') ? { byeWeek: true } : {}),
  };

  return {
    days,
    anchors,
    profile,
    weekFlags: deriveWeekValidationFlags({ days, anchors, profile, weekFlags: explicitFlags }),
  };
}

function craftTierErrorFinding(error: unknown): WeekFinding {
  return {
    ruleId: 'craft_tier_error',
    severity: 'strong',
    message: 'The week could not be checked against the Section 17 craft rules.',
    // Dateless, and returned WITHOUT passing through rule 2's governable-day
    // filter, which would otherwise demote it: an unchecked week is the one
    // state this tier must never report as clean.
    dates: [],
    sessions: [],
    canOverride: true,
    bibleRef: 'Section 17',
    data: { error: String(error) },
  };
}

/**
 * `date|name` for every session on this week that the ATHLETE put there.
 *
 * A finding names dates and session names, so that is the shape the answer has
 * to be in for the two to meet.
 */
export function athletePlacedSessionKeys(args: {
  workouts: readonly Workout[];
  weekStart: string;
}): ReadonlySet<string> {
  const weekStart = args.weekStart.slice(0, 10);
  return new Set(args.workouts
    .filter((workout) => !resolverMayDisplace(workout))
    .map((workout) => `${isoDateForWeekday(weekStart, workout.dayOfWeek)}|${workout.name}`));
}

/** Does this finding name anything the athlete themselves placed? */
function namesAthletePlacedWork(
  finding: WeekFinding,
  athletePlaced: ReadonlySet<string>,
): boolean {
  return finding.dates.some((date) =>
    finding.sessions.some((session) => athletePlaced.has(`${date}|${session}`)));
}

export function assessWeekCraft(args: WeekCraftInput): WeekCraftAssessment {
  let findings: readonly WeekFinding[];
  try {
    findings = validateProgramWeek(craftValidatorInput(args)).findings;
  } catch (error) {
    const failure = craftTierErrorFinding(error);
    return { findings: [failure], blocking: [failure] };
  }
  const athletePlaced = athletePlacedSessionKeys({
    workouts: args.workouts,
    weekStart: args.weekStart,
  });
  const blocking = findings.filter((finding) =>
    blocksBySeverity(finding) &&
    finding.dates.some((date) => args.governableDates.has(date)) &&
    // RULE 3. Found, disclosed, never blocking. The athlete decided this.
    !namesAthletePlacedWork(finding, athletePlaced));
  return { findings, blocking };
}

/**
 * THE TOP-UP SEAM.
 *
 * `applyOptionalTopUps` runs AFTER the accepted-week gateway, deliberately: the
 * contract was satisfied before those sessions existed and is never re-evaluated
 * against them, which is what makes a top-up incapable of affecting compliance
 * or load. That argument holds for COUNTS and does not hold for SHAPE — an
 * optional session landing on G-1, or stacking an upper session beside a lower
 * one, is exactly a craft question, and it was escaping the tier by arriving
 * after it.
 *
 * The remedy fits what a top-up IS. It is optional by definition, so a top-up
 * that introduces a craft violation is simply not added — no repair search, no
 * disclosure, no week to fail. A finding the week already had is not the
 * top-up's fault and never withholds it.
 */
export function withCraftSafeTopUps(args: {
  contract: WeeklyExposureContractV2;
  weekStart: string;
  profile?: OnboardingData | null;
  governableDates: ReadonlySet<string>;
  /** The accepted week, before top-ups. */
  base: readonly Workout[];
  /** The sessions the top-up pass wants to add. */
  placed: readonly Workout[];
}): { workouts: Workout[]; withheld: Workout[] } {
  if (args.placed.length === 0) return { workouts: [...args.base], withheld: [] };
  const assess = (workouts: readonly Workout[]) =>
    assessWeekCraft({
      contract: args.contract,
      workouts,
      weekStart: args.weekStart,
      profile: args.profile,
      governableDates: args.governableDates,
    });
  const before = new Set(assess(args.base).blocking.map(craftFindingKey));
  const weekStart = args.weekStart.slice(0, 10);
  const dateOf = (workout: Workout) => isoDateForWeekday(weekStart, workout.dayOfWeek);

  let kept = [...args.placed];
  // Bounded by construction: every pass either finishes or drops at least one
  // placement, and a placement is never re-added.
  for (let pass = 0; pass <= args.placed.length; pass += 1) {
    const introduced = assess([...args.base, ...kept]).blocking
      .filter((finding) => !before.has(craftFindingKey(finding)));
    if (introduced.length === 0) break;
    const implicated = new Set(introduced.flatMap((finding) => finding.dates));
    const survivors = kept.filter((workout) => !implicated.has(dateOf(workout)));
    // A finding that names no day (a weekly cap, or the tier's own error) names
    // no top-up to withdraw either. The whole batch goes: the week was clean
    // without it, and optional work never gets the benefit of the doubt.
    kept = survivors.length === kept.length ? [] : survivors;
    if (kept.length === 0) break;
  }

  const keptIds = new Set(kept.map((workout) => workout.id));
  return {
    workouts: [...args.base, ...kept],
    withheld: args.placed.filter((workout) => !keptIds.has(workout.id)),
  };
}
