import type { AthleteGender, OnboardingData, Workout, WorkoutExercise } from '../types/domain';
import type { G1LandingRouteId } from '../utils/planChangeTypes';
import {
  applyConditioningDeloadToExercises,
  applyStrengthDeloadToExercises,
  isAccessoryStrengthRow,
  isConditioningExerciseRow,
  resolveDoorDeloadPolicy,
} from './deloadWeekRules';
import { buildDerivedSession, type AthleteContext } from '../utils/sessionBuilder';

/**
 * THE G-1 LANDING ASK — Sam's ruling, 2026-07-28/29, generalised 2026-07-30.
 * Design: docs/G1_MOVE_ASK_FLOW_DESIGN_2026-07-29.md
 *
 * Generation never plans hard strength or conditioning on the day before a game.
 * That law is untouched. This owns the OTHER case: the athlete deliberately puts
 * a session there. The app does not silently substitute it and does not silently
 * relocate it. It warns once, offers the gender-appropriate typed routes, and
 * whichever the athlete picks lands on the day they chose.
 *
 * IT IS THE DESTINATION THAT ASKS, NOT THE DOOR. This began as the MOVE ask,
 * and a swap onto the same day therefore reported "Done." and changed nothing —
 * the ask never ran, so the routeless full session went in and the resolver ate
 * it. What raises the ask is the day being G-1 and the content landing on it
 * being something that day is not built for. Which door the athlete used is not
 * information about that. Move, Swap and Add now funnel through
 * `resolveG1LandingAsk` once, in `resolveAthleteMutation`.
 *
 * WHY A TYPED LIST rather than branches: Gunshow and Primer are different
 * authored sessions and therefore different route ids. The screen filters that
 * one list for the athlete; the producer materialises the chosen id. No label
 * is allowed to stand in for a different session type.
 *
 * COPY PROVENANCE: every athlete-facing string here was authored and signed off
 * by Sam on 2026-07-29. `g1LandingAskFlowTests` binds them to the design document
 * in both directions, so neither a reworded warning nor an unfiled one ships.
 * Do not edit a string here without Sam's sign-off and the matching doc edit.
 */

export type { G1LandingRouteId } from '../utils/planChangeTypes';

export interface G1LandingRoute {
  id: G1LandingRouteId;
  /** Athlete-facing option title. Context remains available for future signed copy. */
  label: (context: G1LandingAskContext) => string;
  /** Visible routes commit; the retained legacy keep route does not. */
  commits: boolean;
}

export interface G1LandingAskContext {
  /**
   * The day the athlete is moving the session FROM, e.g. "Monday", or NULL for
   * a door that has no source day. A swap and an add take content from the
   * registry, not from another day, so Sam's "Your Monday session stays where
   * it is" clause has nothing to name and does not render. Dropping the clause
   * keeps the rest of his signed sentence exactly as signed; inventing a
   * replacement for it would not.
   */
  sourceDayName: string | null;
  /** The G-1 day the session is being placed ON, e.g. "Friday". */
  g1DayName: string;
  /** The fixture day the warning is about, e.g. "Saturday". */
  gameDayName: string;
  /**
   * What G-1 holds today, and therefore what route (a) keeps by doing nothing —
   * "Gunshow" for the ordinary in-season week, a recovery session's name when
   * the day holds one, NULL when the day is empty.
   *
   * Route (a)'s label was the literal string "Keep Friday's Gunshow" while only
   * Move could raise the ask, because a move onto G-1 always landed on the
   * derived Gunshow. Once swap and add ask too, that label is a lie on any day
   * that holds something else. Sam signed the PATTERN on 2026-07-30 rather than
   * the four strings: name what the day would keep, or say the day is left free.
   *
   * Retained as decision context for existing transactions and diagnostics. It
   * no longer creates a visible no-op option; Go back owns that outcome.
   */
  keptSessionName: string | null;
  /**
   * Filters the visible list. Male sees Gunshow and Primer; female sees Primer
   * without Gunshow. Absent retains the historic male/default behaviour.
   */
  athleteGender?: AthleteGender;
  /**
   * True when the landing session has no accessory work to keep, so route (b)
   * yields the derived pump session rather than a stripped-down version of
   * their own session. Retained for diagnostics; option subtitles are gone.
   */
  accessoriesComeFromPumpSession: boolean;
}

const DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const;

export function dayNameForDate(dateISO: string): string {
  return DAY_NAMES[new Date(`${dateISO.slice(0, 10)}T12:00:00`).getDay()];
}

/**
 * Sam's authored warning, revised 2026-08-26. The ask itself is the one
 * confirmation; every displayed choice applies directly.
 */
export const G1_LANDING_WARNING = {
  ask: {
    headline: 'Are you sure?',
    body: (context: G1LandingAskContext): string =>
      `Train hard ${context.g1DayName} and you'll feel it ${context.gameDayName}`,
  },
} as const;

const GUNSHOW_ROUTE: G1LandingRoute = {
  // Persisted key. Historical female decisions under this id still materialise
  // a Primer in `placeSessionForRoute`; the current female menu never offers it.
  id: 'take_the_gunshow',
  label: () => 'Gunshow',
  commits: true,
};

const PRIMER_ROUTE: G1LandingRoute = {
  id: 'take_the_primer',
  label: () => 'Primer',
  commits: true,
};

/**
 * The back affordance. Signed by Sam 2026-07-30 as *"Go back — leave <day>
 * free"*, on the reasoning that "Back" on a warning screen reads as "cancel"
 * and the row should say what it DOES.
 *
 * ⚠ **SHORTENED TO "Go back" BY SAM, 2026-08-25 (R-221), VERBATIM: *"the bottom
 * button should just say 'go back' too not double up on leave frday free"*.**
 * The reasoning above stopped applying the moment route (a) on the same screen
 * was already labelled *"Leave Friday free"* — the back row was repeating an
 * option sitting three lines above it, so the athlete read two ways to do one
 * thing. The day name goes with it: this row now takes no context.
 */
export const G1_LANDING_BACK_ROW = {
  label: (): string => 'Go back',
} as const;

const LEGACY_KEEP_DAY_ROUTE: G1LandingRoute = {
  /* Persisted compatibility only. It is no longer a visible choice: Go back
   * already performs this no-op, and rendering both created two exits. */
  id: 'keep_the_day',
  label: () => 'Go back',
  commits: false,
};

const ACCESSORIES_ROUTE: G1LandingRoute = {
  id: 'accessories_only',
  label: () => 'Accessories only',
  commits: true,
};

const EASIER_ROUTE: G1LandingRoute = {
  id: 'deloaded',
  label: () => 'Same session but easier',
  commits: true,
};

/** Male sees all four choices; female sees the same list without Gunshow. */
export const G1_LANDING_ROUTES: readonly G1LandingRoute[] = [
  EASIER_ROUTE,
  GUNSHOW_ROUTE,
  PRIMER_ROUTE,
  ACCESSORIES_ROUTE,
];

export function g1LandingRoutesFor(
  context: G1LandingAskContext,
): readonly G1LandingRoute[] {
  return context.athleteGender === 'female'
    ? G1_LANDING_ROUTES.filter((route) => route.id !== 'take_the_gunshow')
    : G1_LANDING_ROUTES;
}

/*
 * Every route the producer may receive, including the retired visible no-op.
 * A historical decision remains readable even though the current sheet no
 * longer offers it.
 */
export const ALL_G1_LANDING_ROUTES: readonly G1LandingRoute[] = [
  LEGACY_KEEP_DAY_ROUTE,
  ...G1_LANDING_ROUTES,
];

/**
 * EVERY route, not just the ones on the default menu.
 *
 * `ALL_G1_LANDING_ROUTES` is the membership answer, including the retired
 * visible keep route. `g1LandingRoutesFor` decides which current choices the
 * athlete sees.
 */
export function g1LandingRoute(id: G1LandingRouteId): G1LandingRoute {
  const route = ALL_G1_LANDING_ROUTES.find((candidate) => candidate.id === id);
  if (!route) throw new Error(`Unknown G-1 landing route: ${id}`);
  return route;
}

/**
 * Is the athlete putting this session on the day before a fixture, and is it the
 * kind of session that needs the ask?
 *
 * THE FUNNEL. Every athlete door that can land content on a day calls this, and
 * only this, through one site in `resolveAthleteMutation`. The arguments are
 * deliberately about the DAY and the CONTENT, never about the door:
 *
 *   - `landingWorkout` is what would end up on G-1: the moved session for Move,
 *     the registry template for Swap and Add.
 *   - `existingWorkout` is what is on the day now, which is what route (a)
 *     keeps by applying nothing. Null means the day is empty.
 *   - `sourceDate` exists only for Move. Its absence is not a missing field —
 *     it is the fact that a swap and an add take nothing off another day, and
 *     the copy renders accordingly.
 *
 * "Needs the ask" is the same question the resolver's G-1 branch already
 * answers when it decides whether to displace: recovery work and empty rest
 * stubs are already what the day is for, so they land without a word. Anything
 * else is the athlete overriding the day's purpose, and Sam's ruling is that
 * they get told before it happens rather than after.
 *
 * `gameDates` comes from `effectiveGameDatesAround` — the resolver's own owner
 * of where the games are, explicit and virtual alike. It is passed in rather
 * than re-derived so there is exactly one answer to that question.
 */
export function resolveG1LandingAsk(args: {
  targetDate: string;
  landingWorkout: Workout;
  existingWorkout: Workout | null;
  gameDates: ReadonlySet<string>;
  sourceDate?: string | null;
  /** R-130a item 3 — the one switch, for the empty-day route's own words. */
  athleteGender?: AthleteGender;
}): G1LandingAskContext | null {
  const targetDate = args.targetDate.slice(0, 10);
  const dayAfterTarget = shiftISO(targetDate, 1);
  if (!args.gameDates.has(dayAfterTarget)) return null;
  if (isAlreadyLightForG1(args.landingWorkout)) return null;
  return {
    sourceDayName: args.sourceDate ? dayNameForDate(args.sourceDate) : null,
    g1DayName: dayNameForDate(targetDate),
    gameDayName: dayNameForDate(dayAfterTarget),
    keptSessionName: args.existingWorkout?.name ?? null,
    ...(args.athleteGender ? { athleteGender: args.athleteGender } : {}),
    accessoriesComeFromPumpSession: accessoryRows(args.landingWorkout).length === 0,
  };
}

/**
 * Sessions G-1 is already built to hold. Mirrors the resolver's own G-1
 * exemptions (`applyGameProximity`) so the ask and the placement rule cannot
 * disagree about what "light" means.
 */
export function isAlreadyLightForG1(workout: Workout | null | undefined): boolean {
  if (!workout) return true;
  if (workout.sessionTier === 'recovery') return true;
  if (workout.workoutType === 'Recovery') return true;
  if (workout.workoutType === 'Rest') return true;
  return false;
}

/** Row identity for "did this route change anything?" — names and doses. */
function rowIdentities(workout: Workout): string[] {
  return workout.exercises.map((row) =>
    `${row.exercise?.name ?? row.exerciseId}:${row.prescribedSets}`);
}

function accessoryRows(workout: Workout): WorkoutExercise[] {
  return workout.exercises.filter((exercise) =>
    !isConditioningExerciseRow(exercise) && isAccessoryStrengthRow(exercise));
}

function shiftISO(dateISO: string, days: number): string {
  const date = new Date(`${dateISO.slice(0, 10)}T12:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * The session that actually lands on G-1 for a committing route. The input is
 * the LANDING content — the moved session for Move, the registry template for
 * Swap and Add — because the transformation is the same either way.
 *
 * IDENTITY IS PRESERVED. All committing routes place the athlete's own session SLOT
 * — same `planEntryId`, same stable id — carrying the content they chose. That
 * is what lets the move stay one atomic transaction with one undo, and it is
 * why the conservation post-condition still sees the athlete's session survive:
 * it did. What changed is what is inside it, which is exactly what the athlete
 * was asked and answered.
 *
 * Returns null for `keep_the_day`, which commits nothing.
 */
export function placeSessionForRoute(args: {
  route: G1LandingRouteId;
  landingWorkout: Workout;
  targetDate: string;
  athlete: AthleteContext;
  profile: OnboardingData | null | undefined;
}): Workout | null {
  if (args.route === 'keep_the_day') return null;
  if (args.route === 'take_the_gunshow' || args.route === 'take_the_primer') {
    // The day's own session, in the athlete's slot. Same identity rule as every
    // other committing route: their session moved, carrying what they chose.
    // R-130a item 3: the route PLACES per path — her Primer, his Gunshow —
    // through the same builder each path's Add door uses.
    const pump = buildDerivedSession(
      args.route === 'take_the_primer' || args.profile?.gender === 'female'
        ? 'primer'
        : 'arms_pump',
      args.targetDate, args.landingWorkout.microcycleId,
      'Pre-game day', args.athlete,
    );
    return {
      ...args.landingWorkout,
      name: pump.name,
      description: pump.description,
      durationMinutes: pump.durationMinutes,
      intensity: pump.intensity,
      workoutType: pump.workoutType,
      sessionTier: pump.sessionTier,
      // The typed charter identity travels with the content it identifies —
      // this route erases even the row-id channel (the landing workout keeps
      // its own id), so without this field the placed Gunshow is name-only and
      // the projection falls back to the generic strength word.
      composedOptionalKind: pump.composedOptionalKind,
      exercises: pump.exercises.map((exercise, index) => ({
        ...exercise,
        workoutId: args.landingWorkout.id,
        exerciseOrder: index + 1,
      })),
      strengthIntent: undefined,
      strengthPatternContributions: undefined,
      hasCombinedConditioning: false,
      conditioningBlock: undefined,
      conditioningFlavour: undefined,
      conditioningCategory: undefined,
    };
  }
  const placed = args.route === 'accessories_only'
    ? accessoriesOnlySession(args)
    : deloadedSession(args);
  // A ROUTE THAT CHANGES NOTHING IS NOT AN ANSWER (Sam, 2026-07-30, ruling 4).
  //
  // "Accessories only" over a registry strength template lands the template
  // unchanged, because every one of its rows classifies as an accessory:
  // `isMainStrengthRow` asks the pool registry for an anchor role and template
  // rows are not pool slots. So the athlete asks for the light version and is
  // handed the whole session — which is what Sam reported, twice, in two
  // different shapes.
  //
  // That is 5D.4's classifier (the template's own structure is the authored
  // truth, not a name lookup). Until it lands, the route refuses rather than
  // pretending: same containment as the empty-result case below, and it
  // disappears the moment the classifier can tell the rows apart.
  if (args.route === 'accessories_only' &&
    JSON.stringify(rowIdentities(placed)) === JSON.stringify(rowIdentities(args.landingWorkout))) {
    return null;
  }
  // A ROUTE IS A LIGHTER SESSION, NEVER NO SESSION. Returning an empty workout
  // here would publish a day that renders as rest while the sheet said "Done",
  // and the athlete would have picked a route in order to be given nothing.
  //
  // Same session but easier now preserves every selected row before it reaches
  // this post-condition. The guard remains for Accessories only and any future
  // route: a materialiser regression must still refuse rather than publish an
  // empty success.
  return placed.exercises.length > 0 ? placed : null;
}

/**
 * Route (b). Keep the accessory strength work, drop the main lifts and the
 * conditioning — "pump and prehab, nothing heavy".
 *
 * When the moved session has no accessories at all (a conditioning or sprint
 * session), the athlete gets the derived pump session's CONTENT under its own
 * name, in their session's slot. Sam's ruling: honestly labelled as its own
 * thing, never an easy version wearing their session's name.
 */
function accessoriesOnlySession(args: {
  landingWorkout: Workout;
  targetDate: string;
  athlete: AthleteContext;
  profile: OnboardingData | null | undefined;
}): Workout {
  const kept = accessoryRows(args.landingWorkout);
  if (kept.length === 0) {
    // R-130a item 3: the zero-accessory fallback is the same per-path offer
    // as the empty-day route — her Primer, his Gunshow.
    const pump = buildDerivedSession(
      args.profile?.gender === 'female' ? 'primer' : 'arms_pump',
      args.targetDate,
      args.landingWorkout.microcycleId,
      'Pre-game day',
      args.athlete,
    );
    return {
      ...args.landingWorkout,
      name: pump.name,
      description: pump.description,
      durationMinutes: pump.durationMinutes,
      intensity: pump.intensity,
      workoutType: pump.workoutType,
      sessionTier: pump.sessionTier,
      composedOptionalKind: pump.composedOptionalKind,
      exercises: pump.exercises.map((exercise, index) => ({
        ...exercise,
        workoutId: args.landingWorkout.id,
        exerciseOrder: index + 1,
      })),
      // The moved session's strength contract does not survive its own removal.
      strengthIntent: undefined,
      strengthPatternContributions: undefined,
      hasCombinedConditioning: false,
      conditioningBlock: undefined,
      conditioningFlavour: undefined,
      conditioningCategory: undefined,
    };
  }
  return {
    ...args.landingWorkout,
    intensity: 'Light',
    exercises: kept.map((exercise, index) => ({ ...exercise, exerciseOrder: index + 1 })),
    hasCombinedConditioning: false,
    conditioningBlock: undefined,
    conditioningFlavour: undefined,
    conditioningCategory: undefined,
    strengthIntent: undefined,
    strengthPatternContributions: undefined,
  };
}

/**
 * Route (c). The ONE reduction mechanism — DELOAD_LAW, through its own two
 * appliers. Nothing here decides what a deload is; that is `deloadWeekRules`'
 * job and this must never grow a second opinion about it.
 */
function deloadedSession(args: {
  landingWorkout: Workout;
  profile: OnboardingData | null | undefined;
}): Workout {
  const policy = resolveDoorDeloadPolicy({
    door: 'readiness',
    seasonPhase: args.profile?.seasonPhase,
    preserveExerciseSelection: true,
  })!;
  const strengthApplied = applyStrengthDeloadToExercises(
    args.landingWorkout.exercises,
    policy,
  );
  return {
    ...args.landingWorkout,
    intensity: 'Light',
    g1Adjustment: 'same_session_easier',
    exercises: applyConditioningDeloadToExercises(strengthApplied, policy),
  };
}
