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
 * relocate it. It warns once, offers three routes, and whichever the athlete
 * picks lands on the day they chose.
 *
 * IT IS THE DESTINATION THAT ASKS, NOT THE DOOR. This began as the MOVE ask,
 * and a swap onto the same day therefore reported "Done." and changed nothing —
 * the ask never ran, so the routeless full session went in and the resolver ate
 * it. What raises the ask is the day being G-1 and the content landing on it
 * being something that day is not built for. Which door the athlete used is not
 * information about that. Move, Swap and Add now funnel through
 * `resolveG1LandingAsk` once, in `resolveAthleteMutation`.
 *
 * WHY A TYPED LIST rather than three branches: a fourth route — a pre-game
 * PRIMER, short sharp activation over Sam's authored power pool — is ruled in
 * principle and parked pending his authored prescription. Adding it must be one
 * entry in `G1_LANDING_ROUTES` plus one case in `placeSessionForRoute`, not a
 * fourth branch threaded through the producer and the sheet.
 *
 * COPY PROVENANCE: every athlete-facing string here was authored and signed off
 * by Sam on 2026-07-29. `g1LandingAskFlowTests` binds them to the design document
 * in both directions, so neither a reworded warning nor an unfiled one ships.
 * Do not edit a string here without Sam's sign-off and the matching doc edit.
 */

export type { G1LandingRouteId } from '../utils/planChangeTypes';

export interface G1LandingRoute {
  id: G1LandingRouteId;
  /**
   * The option title. A function of the context because Sam's signed copy NAMES
   * the day and what is on it — "Keep Friday's Gunshow", not "Keep the
   * Gunshow". A day-blind label was the first thing the copy-equality test
   * caught; a CONTENT-blind one was the second, once swap and add started
   * raising the ask over days that hold a recovery session or nothing at all.
   */
  label: (context: G1LandingAskContext) => string;
  /**
   * The sub-line under the label. A function of the context, because two of the
   * three routes have to name a real day: (a) tells the athlete their session
   * stays put, and it is not honest to say that without saying where.
   */
  detail: (context: G1LandingAskContext) => string;
  /** Does picking this route commit a transaction? Only (a) does not. */
  commits: boolean;
  /** Does this route need the second, stronger warning first? */
  requiresSecondWarning: boolean;
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
   */
  keptSessionName: string | null;
  /**
   * R-130a item 3 (Sam: *"yes offer females the primer"*): the one switch,
   * carried so the empty-day route can name what it will actually place —
   * the Primer for her, the Gunshow for him. Absent behaves male, which is
   * the pre-R-130 ask verbatim; the real flows always carry it.
   */
  athleteGender?: AthleteGender;
  /**
   * True when the landing session has no accessory work to keep, so route (b)
   * yields the derived pump session rather than a stripped-down version of
   * their own session. This changes only the sub-line, never the menu shape.
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
 * Sam's authored warnings. Signed 2026-07-29.
 *
 * The first is the ask. The second gates route (c) alone, and it is deliberately
 * blunter than the first — a deloaded session is still a session the day before
 * a game, and the athlete has already chosen to ignore one warning to get here.
 */
export const G1_LANDING_WARNING = {
  ask: {
    headline: 'Big session the day before your game.',
    body: (context: G1LandingAskContext): string =>
      `Train hard ${context.g1DayName} and you'll feel it ${context.gameDayName}. Pick one:`,
  },
  deloadConfirm: {
    headline: (context: G1LandingAskContext): string =>
      `This still costs you ${context.gameDayName}.`,
    body:
      'Half the sets is easier, not light. The day before a game is built for a '
      + 'pump and nothing else. Go ahead only if this session matters more than '
      + 'the game.',
  },
} as const;

/**
 * The menu. UNIFORM for every session type (Sam, 2026-07-29): the athlete gets
 * the same three choices whatever they moved. Only route (b)'s CONTENT varies,
 * and when it varies the sub-line says so rather than dressing the pump session
 * up as theirs.
 */
/**
 * "Your Monday session stays where it is." — Sam's clause, and the ONE place
 * the source day is spoken about. It renders only when there is a source day.
 */
function sourceStaysClause(context: G1LandingAskContext): string {
  return context.sourceDayName
    ? ` Your ${context.sourceDayName} session stays where it is.`
    : '';
}

/**
 * Sam's fourth route, signed 2026-07-30. An athlete adding work the day before
 * a game should be offered the session that day was built for — the menu had
 * three ways to place THEIR choice and never offered the day's own.
 *
 * Only on an EMPTY G-1: when the day already holds something, route (a) keeps
 * it, and offering both would be two names for one outcome.
 */
export function g1LandingRoutesFor(
  context: G1LandingAskContext,
): readonly G1LandingRoute[] {
  return context.keptSessionName
    ? G1_LANDING_ROUTES
    : [G1_LANDING_ROUTES[0]!, GUNSHOW_ROUTE, ...G1_LANDING_ROUTES.slice(1)];
  // NB: every id returned here must resolve through `g1LandingRoute`, which is
  // what `ALL_G1_LANDING_ROUTES` guarantees. A route the sheet can show and the
  // producer cannot look up is a crash on selection — it was, on Sam's phone.
}

const GUNSHOW_ROUTE: G1LandingRoute = {
  // ⚠ THE ID IS A PERSISTED ROUTE KEY AND PREDATES R-130 — it stays
  // `take_the_gunshow` for BOTH paths. What the athlete READS (the label) and
  // what the route PLACES (`placeSessionForRoute`) are per-path: R-130a item
  // 3, *"yes offer females the primer"*. Renaming the id would fork every
  // suite and stored decision that carries it, to fix a word no athlete sees.
  id: 'take_the_gunshow',
  label: (context) => (context.athleteGender === 'female'
    ? `Keep ${context.g1DayName}'s Primer`
    : `Keep ${context.g1DayName}'s Gunshow`),
  // The female sub-line is R-129's SIGNED Primer sentence, reused verbatim
  // from the Add menu (`planChangeProducer` CATEGORY_COPY) — no new words.
  detail: (context) => (context.athleteGender === 'female'
    ? 'Short, sharp session to feel ready for game day.'
    : 'light upper-body pump, what the day before a game is built for.'),
  commits: true,
  requiresSecondWarning: false,
};

/**
 * The back affordance, signed by Sam 2026-07-30. Labelled for what it does: on
 * a warning screen "Back" reads as "cancel", and what leaving actually does is
 * leave the day the way the day was built.
 */
export const G1_LANDING_BACK_ROW = {
  label: (context: G1LandingAskContext): string =>
    `Go back — leave ${context.g1DayName} free`,
} as const;

export const G1_LANDING_ROUTES: readonly G1LandingRoute[] = [
  {
    id: 'keep_the_day',
    label: (context) => context.keptSessionName
      ? `Keep ${context.g1DayName}'s ${context.keptSessionName}`
      : `Leave ${context.g1DayName} free`,
    detail: (context) => (context.keptSessionName
      ? 'what the day before a game is built for.'
      : 'rest before the game.') + sourceStaysClause(context),
    commits: false,
    requiresSecondWarning: false,
  },
  {
    id: 'accessories_only',
    label: () => 'Accessories only',
    detail: (context) => context.accessoriesComeFromPumpSession
      // Honest labelling (Sam's ruling): a conditioning session has no
      // accessories to keep, so this route is the pump session under its own
      // name. It is NOT an easy version wearing the athlete's session name —
      // that identity swap stays banned.
      // "Pump" is reserved for Gunshow's own description (Sam, 2026-07-29) so
      // route (a) and route (b) can never read as the same thing.
      ? 'Light accessory work before the game.' + (context.sourceDayName
          ? ` Your ${context.sourceDayName} session is dropped, not moved.`
          : '')
      : 'Your session with the main lifts stripped out. Pump and prehab, nothing heavy.',
    commits: true,
    requiresSecondWarning: false,
  },
  {
    id: 'deloaded',
    label: () => 'Same session, deloaded',
    detail: () => 'Half the sets at RPE 5–6, weight stays. Conditioning halved.',
    commits: true,
    requiresSecondWarning: true,
  },
];

/**
 * EVERY route, not just the ones on the default menu.
 *
 * The Gunshow route lives outside `G1_LANDING_ROUTES` because it is offered
 * only on an empty G-1 — and this lookup only knew the default list, so the
 * moment Sam picked it the app THREW: "Unknown G-1 move route:
 * take_the_gunshow". A menu the sheet can render and this function cannot
 * resolve is two lists disagreeing about what exists.
 *
 * `ALL_G1_LANDING_ROUTES` is now the single membership answer, and
 * `g1LandingRoutesFor` decides only which of them a given day OFFERS.
 */
export const ALL_G1_LANDING_ROUTES: readonly G1LandingRoute[] = [
  GUNSHOW_ROUTE,
  ...G1_LANDING_ROUTES,
];

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
 * IDENTITY IS PRESERVED. All three routes place the athlete's own session SLOT
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
  if (args.route === 'take_the_gunshow') {
    // The day's own session, in the athlete's slot. Same identity rule as every
    // other committing route: their session moved, carrying what they chose.
    // R-130a item 3: the route PLACES per path — her Primer, his Gunshow —
    // through the same builder each path's Add door uses.
    const pump = buildDerivedSession(
      args.profile?.gender === 'female' ? 'primer' : 'arms_pump',
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
  // A ROUTE IS A SMALLER SESSION, NEVER NO SESSION. Returning an empty workout
  // here would publish a day that renders as rest while the sheet said "Done",
  // and the athlete would have picked a route in order to be given nothing.
  //
  // It is reachable: DELOAD_LAW's row-level `isConditioningExerciseRow` is a
  // NAME regex, and the registry's own conditioning templates are named "Flush
  // Out - 2min On / 1min Off" and "3 x 8min zone 2 Rower", which it does not
  // match. Those rows are then classified as strength accessories, and the
  // accessory trim deletes the only row in the session. The workout ITSELF
  // knows better — `conditioningBlock.options[].exerciseIds` names those exact
  // rows.
  //
  // Sam ruled this a NAME-DECIDES-IDENTITY instance and queued the fix as
  // MASTER_PLAN 5D.4: the classification reads the authored structure, and the
  // regex is NOT widened. This boundary holds until then, and
  // `g1LandingAskFlowTests` 26 goes red when 5D.4 lands — that is the signal to
  // delete these three lines, not a regression.
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
  })!;
  const strengthApplied = applyStrengthDeloadToExercises(
    args.landingWorkout.exercises,
    policy,
  );
  return {
    ...args.landingWorkout,
    intensity: 'Light',
    exercises: applyConditioningDeloadToExercises(strengthApplied, policy),
  };
}
