import type { OnboardingData, Workout, WorkoutExercise } from '../types/domain';
import type { G1MoveRouteId } from '../utils/planChangeTypes';
import {
  applyConditioningDeloadToExercises,
  applyStrengthDeloadToExercises,
  isAccessoryStrengthRow,
  isConditioningExerciseRow,
  resolveDoorDeloadPolicy,
} from './deloadWeekRules';
import { buildDerivedSession, type AthleteContext } from '../utils/sessionBuilder';

/**
 * THE G-1 MOVE ASK — Sam's ruling, 2026-07-28/29.
 * Design: docs/G1_MOVE_ASK_FLOW_DESIGN_2026-07-29.md
 *
 * Generation never plans hard strength or conditioning on the day before a game.
 * That law is untouched. This owns the OTHER case: the athlete deliberately puts
 * a session there. The app does not silently substitute it and does not silently
 * relocate it. It warns once, offers three routes, and whichever the athlete
 * picks lands on the day they chose.
 *
 * WHY A TYPED LIST rather than three branches: a fourth route — a pre-game
 * PRIMER, short sharp activation over Sam's authored power pool — is ruled in
 * principle and parked pending his authored prescription. Adding it must be one
 * entry in `G1_MOVE_ROUTES` plus one case in `placeSessionForRoute`, not a
 * fourth branch threaded through the producer and the sheet.
 *
 * COPY PROVENANCE: every athlete-facing string here was authored and signed off
 * by Sam on 2026-07-29. `g1MoveAskCopyTests` binds them to the design document
 * in both directions, so neither a reworded warning nor an unfiled one ships.
 * Do not edit a string here without Sam's sign-off and the matching doc edit.
 */

export type { G1MoveRouteId } from '../utils/planChangeTypes';

export interface G1MoveRoute {
  id: G1MoveRouteId;
  /**
   * The option title. A function of the move because Sam's signed copy NAMES
   * the day — "Keep Friday's Gunshow", not "Keep the Gunshow". A day-blind
   * label was the first thing the copy-equality test caught.
   */
  label: (context: G1MoveContext) => string;
  /**
   * The sub-line under the label. A function of the move, because two of the
   * three routes have to name a real day: (a) tells the athlete their session
   * stays put, and it is not honest to say that without saying where.
   */
  detail: (context: G1MoveContext) => string;
  /** Does picking this route commit a transaction? Only (a) does not. */
  commits: boolean;
  /** Does this route need the second, stronger warning first? */
  requiresSecondWarning: boolean;
}

export interface G1MoveContext {
  /** The day the athlete is moving the session FROM, e.g. "Monday". */
  sourceDayName: string;
  /** The G-1 day the session is being moved TO, e.g. "Friday". */
  g1DayName: string;
  /** The fixture day the warning is about, e.g. "Saturday". */
  gameDayName: string;
  /**
   * True when the moved session has no accessory work to keep, so route (b)
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
export const G1_MOVE_WARNING = {
  ask: {
    headline: 'Big session the day before your game.',
    body: (context: G1MoveContext): string =>
      `Train hard ${context.g1DayName} and you'll feel it ${context.gameDayName}. Pick one:`,
  },
  deloadConfirm: {
    headline: (context: G1MoveContext): string =>
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
export const G1_MOVE_ROUTES: readonly G1MoveRoute[] = [
  {
    id: 'keep_gunshow',
    label: (context) => `Keep ${context.g1DayName}'s Gunshow`,
    detail: (context) =>
      'Light upper-body pump, what the day before a game is built for. '
      + `Your ${context.sourceDayName} session stays where it is.`,
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
      ? `Light accessory work before the game. Your ${context.sourceDayName} session is dropped, not moved.`
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

export function g1MoveRoute(id: G1MoveRouteId): G1MoveRoute {
  const route = G1_MOVE_ROUTES.find((candidate) => candidate.id === id);
  if (!route) throw new Error(`Unknown G-1 move route: ${id}`);
  return route;
}

/**
 * Is the athlete putting this session on the day before a fixture, and is it the
 * kind of session that needs the ask?
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
export function resolveG1MoveAsk(args: {
  sourceDate: string;
  targetDate: string;
  sourceWorkout: Workout;
  gameDates: ReadonlySet<string>;
}): G1MoveContext | null {
  const targetDate = args.targetDate.slice(0, 10);
  const dayAfterTarget = shiftISO(targetDate, 1);
  if (!args.gameDates.has(dayAfterTarget)) return null;
  if (isAlreadyLightForG1(args.sourceWorkout)) return null;
  return {
    sourceDayName: dayNameForDate(args.sourceDate),
    g1DayName: dayNameForDate(targetDate),
    gameDayName: dayNameForDate(dayAfterTarget),
    accessoriesComeFromPumpSession: accessoryRows(args.sourceWorkout).length === 0,
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
 * The session that actually lands on G-1 for a committing route.
 *
 * IDENTITY IS PRESERVED. All three routes place the athlete's own session SLOT
 * — same `planEntryId`, same stable id — carrying the content they chose. That
 * is what lets the move stay one atomic transaction with one undo, and it is
 * why the conservation post-condition still sees the athlete's session survive:
 * it did. What changed is what is inside it, which is exactly what the athlete
 * was asked and answered.
 *
 * Returns null for `keep_gunshow`, which commits nothing.
 */
export function placeSessionForRoute(args: {
  route: G1MoveRouteId;
  sourceWorkout: Workout;
  targetDate: string;
  athlete: AthleteContext;
  profile: OnboardingData | null | undefined;
}): Workout | null {
  if (args.route === 'keep_gunshow') return null;
  if (args.route === 'accessories_only') return accessoriesOnlySession(args);
  return deloadedSession(args);
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
  sourceWorkout: Workout;
  targetDate: string;
  athlete: AthleteContext;
}): Workout {
  const kept = accessoryRows(args.sourceWorkout);
  if (kept.length === 0) {
    const pump = buildDerivedSession(
      'arms_pump',
      args.targetDate,
      args.sourceWorkout.microcycleId,
      'Pre-game day',
      args.athlete,
    );
    return {
      ...args.sourceWorkout,
      name: pump.name,
      description: pump.description,
      durationMinutes: pump.durationMinutes,
      intensity: pump.intensity,
      workoutType: pump.workoutType,
      sessionTier: pump.sessionTier,
      exercises: pump.exercises.map((exercise, index) => ({
        ...exercise,
        workoutId: args.sourceWorkout.id,
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
    ...args.sourceWorkout,
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
  sourceWorkout: Workout;
  profile: OnboardingData | null | undefined;
}): Workout {
  const policy = resolveDoorDeloadPolicy({
    door: 'readiness',
    seasonPhase: args.profile?.seasonPhase,
  })!;
  const strengthApplied = applyStrengthDeloadToExercises(
    args.sourceWorkout.exercises,
    policy,
  );
  return {
    ...args.sourceWorkout,
    intensity: 'Light',
    exercises: applyConditioningDeloadToExercises(strengthApplied, policy),
  };
}
