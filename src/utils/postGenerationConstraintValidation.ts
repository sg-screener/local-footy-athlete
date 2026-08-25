/**
 * ACTIVE-CONSTRAINT REFUSAL BOUNDARY FOR PROGRAM WRITES.
 *
 * ⚠ THIS MODULE NO LONGER AUTHORS, REPAIRS OR REWRITES ANYTHING (demolition
 * area 1, Sam's burn-the-boats ruling 2026-08-19).
 *
 * It used to be a second programming authority sitting on the store's write
 * primitives. Every export returned a REWRITTEN object: it collapsed days to
 * Rest, filtered rows out for injury and equipment, trimmed sessions to a time
 * cap, deleted whole sessions to satisfy a session cap, re-authored the week's
 * exposure contract, and — after any constraint change — restaged and committed
 * every persisted program surface through the accepted-state transaction. A
 * week the composer authored and the athlete accepted was not the week that
 * reached storage.
 *
 * WHAT SURVIVES IS THE REFUSAL, AND ONLY THE REFUSAL. Every function here
 * returns `void` and communicates by throwing. A caller's workout is the
 * caller's workout: this boundary may say NO to it, and may not hand back a
 * different one.
 *
 *   A THROW IS A REFUSAL AND STAYS. A REWRITE IS A REPAIR AND IS GONE.
 *
 * The named current owners of what left: the weekly scheduler owns days and
 * spacing; the composer and its specialists own content and safety AT
 * AUTHORING TIME; the accepted-state transaction owns every write. What is
 * temporarily missing is recorded on the rebuild list in
 * `docs/STATUS_DEMOLITION.md` — it is not hidden behind a compatibility shim
 * here.
 */

import type {
  Microcycle,
  OnboardingData,
  TrainingProgram,
  WeekScopedWorkoutOverlay,
  Workout,
} from '../types/domain';
import type {
  ActiveConstraint,
  ActiveScheduleConstraint,
} from '../store/coachUpdatesStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { useProfileStore } from '../store/profileStore';
import { useReadinessStore } from '../store/readinessStore';
import {
  buildReadinessActiveConstraints,
  constraintAppliesToDate,
} from './readinessConstraints';
import { hasMeaningfulWorkoutContent } from './workoutContent';
import { todayISOLocal } from './appDate';
import { composeDaySurfaces } from '../rules/dayPrecedence';
import { selectMicrocycleForDate } from './programBlockState';
import { evaluateEffectiveWeekExposureContract } from '../rules/weeklyExposureContract';
import type { WeeklyExposureContractV2 } from '../rules/weeklyExposureContractV2';
import { liveAcceptedEffectiveWeekSurfaces } from './liveEvaluationSurfaces';
import { requireSection18AcceptedWeek } from '../rules/section18AcceptedWeekGateway';
import { selectStoredWeekDeclaration } from '../rules/storedWeekDeclaration';
import { deriveWeekContract } from '../rules/derivedWeekContract';
import { factsForWorld } from '../rules/acceptedEffectiveWeek';

// ─── Pure date / constraint predicates ───────────────────────────────────────

function dateOnly(value: string | undefined): string | undefined {
  return value?.slice(0, 10);
}

function addDaysISO(dateISO: string, days: number): string {
  const [year, month, day] = dateISO.slice(0, 10).split('-').map(Number);
  const value = new Date(year, month - 1, day + days, 12, 0, 0, 0);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

const DAY_NAMES: import('../types/domain').DayOfWeek[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function constraintIsLiveOnDate(constraint: ActiveConstraint, date: string): boolean {
  if (constraint.status === 'resolved') return false;
  const start = dateOnly(constraint.startDate);
  if (start && start > date) return false;
  return constraintAppliesToDate(constraint, date);
}

function liveConstraintsForDate(
  constraints: readonly ActiveConstraint[],
  date: string,
): ActiveConstraint[] {
  return constraints.filter((constraint) => constraintIsLiveOnDate(constraint, date));
}

function scheduleBlocksDate(
  constraint: ActiveScheduleConstraint,
  date: string,
): boolean {
  if (constraint.scheduleKind === 'time_cap') return false;
  if (constraint.unavailableDates?.includes(date)) return true;
  return constraint.unavailableWeekdays?.includes(
    DAY_NAMES[new Date(`${date}T12:00:00`).getDay()],
  ) ?? false;
}

function scheduleTimeCap(
  constraints: readonly ActiveConstraint[],
  date: string,
): number | null {
  const day = DAY_NAMES[new Date(`${date}T12:00:00`).getDay()];
  const caps = constraints
    .filter((constraint): constraint is ActiveScheduleConstraint =>
      constraint.type === 'schedule' &&
      constraint.scheduleKind === 'time_cap' &&
      typeof constraint.maxSessionMinutes === 'number')
    .filter((constraint) =>
      constraint.timeCapAllSessions === true ||
      constraint.timeCapDates?.includes(date) ||
      constraint.timeCapWeekdays?.includes(day))
    .map((constraint) => constraint.maxSessionMinutes!)
    .filter((minutes) => Number.isFinite(minutes) && minutes >= 10);
  return caps.length > 0 ? Math.min(...caps) : null;
}

function dateForWorkout(microcycle: Microcycle, workout: Workout): string {
  const start = microcycle.startDate.slice(0, 10);
  const startDow = new Date(`${start}T12:00:00`).getDay();
  const offset = (workout.dayOfWeek - startDow + 7) % 7;
  return addDaysISO(start, offset);
}

// ─── Refusals ────────────────────────────────────────────────────────────────

function assertEffectiveMicrocycleExposure(microcycle: Microcycle): void {
  if (!microcycle.exposureContract) return;
  const validation = evaluateEffectiveWeekExposureContract(
    microcycle.exposureContract,
    microcycle.workouts,
    microcycle.startDate.slice(0, 10),
  );
  if (validation.accepted) return;
  const detail = validation.unresolvedShortfalls
    .map((entry) => `${entry.code}:${entry.domain ?? 'safety'}=${JSON.stringify(entry.actual)}`)
    .join(', ');
  throw new Error(`Final effective-week exposure contract unresolved (${detail})`);
}

/**
 * The athlete's TEMPORARY schedule answers — "I can only train N times this
 * week", "I am not available on this date", "keep it under N minutes" — are
 * facts they stated. This boundary refuses a week that does not honour them.
 *
 * ⚠ IT NO LONGER MANUFACTURES COMPLIANCE. The removal engine that used to
 * delete sessions until the count fitted the cap is deleted: choosing which
 * session an athlete loses is programming, and it belongs to the scheduler.
 * A week over the cap is now REFUSED rather than silently cut.
 */
function assertTemporaryScheduleConstraintsHonoured(args: {
  weekStart: string;
  datedWorkouts: ReadonlyArray<{ date: string; workout: Workout }>;
  activeConstraints: readonly ActiveConstraint[];
}): void {
  const sessionCaps = args.activeConstraints
    .filter((constraint): constraint is ActiveScheduleConstraint =>
      constraint.type === 'schedule' &&
      typeof constraint.maxSessionsThisWeek === 'number' &&
      constraint.status !== 'resolved' &&
      (!constraint.weekStartISO || constraint.weekStartISO === args.weekStart))
    .map((constraint) => Math.max(0, Math.trunc(constraint.maxSessionsThisWeek!)));
  if (sessionCaps.length > 0) {
    const cap = Math.min(...sessionCaps);
    const visibleSessions = args.datedWorkouts
      .filter(({ workout }) => hasMeaningfulWorkoutContent(workout)).length;
    if (visibleSessions > cap) {
      throw new Error('temporary_schedule_max_sessions_not_preserved');
    }
  }
  for (const { date, workout } of args.datedWorkouts) {
    const live = liveConstraintsForDate(args.activeConstraints, date);
    if (live.some((constraint) =>
      constraint.type === 'schedule' && scheduleBlocksDate(constraint, date)) &&
      hasMeaningfulWorkoutContent(workout)) {
      throw new Error('temporary_schedule_unavailable_date_not_preserved');
    }
    const cap = scheduleTimeCap(live, date);
    if (cap !== null && workout.durationMinutes > cap) {
      throw new Error('temporary_time_cap_not_preserved');
    }
  }
}

/**
 * Refuse a microcycle that the §18 boundary rejects, that breaks a temporary
 * schedule answer, or whose effective exposure is unresolved.
 *
 * `requireSection18AcceptedWeek` returns canonical workouts. THEY ARE
 * DELIBERATELY DISCARDED: §18 is validation-only (demolition area A), so its
 * output equals its input, and taking it back would re-open the door this
 * module was demolished to close.
 */
export function assertMicrocycleAgainstActiveConstraints(args: {
  microcycle: Microcycle;
  todayISO: string;
  activeConstraints: readonly ActiveConstraint[];
  profile?: OnboardingData | null;
}): void {
  const weekStart = args.microcycle.startDate.slice(0, 10);
  const datedWorkouts = args.microcycle.workouts.map((workout) => ({
    date: dateForWorkout(args.microcycle, workout),
    workout,
  }));
  const contract: WeeklyExposureContractV2 | undefined =
    args.microcycle.exposureContractV2 ?? undefined;
  if (contract) {
    requireSection18AcceptedWeek({
      contract,
      workouts: args.microcycle.workouts,
      weekStart,
      profile: args.profile,
      surfaces: liveAcceptedEffectiveWeekSurfaces(),
    });
  }
  assertTemporaryScheduleConstraintsHonoured({
    weekStart,
    datedWorkouts,
    activeConstraints: args.activeConstraints,
  });
  if (!contract) assertEffectiveMicrocycleExposure(args.microcycle);
}

export function assertProgramAgainstActiveConstraints(args: {
  program: TrainingProgram;
  todayISO: string;
  activeConstraints: readonly ActiveConstraint[];
  profile?: OnboardingData | null;
}): void {
  for (const microcycle of args.program.microcycles) {
    assertMicrocycleAgainstActiveConstraints({ ...args, microcycle });
  }
}

// ─── The live world ──────────────────────────────────────────────────────────

function liveValidationContext(
  activeConstraintsOverride?: readonly ActiveConstraint[],
  todayISO: string = todayISOLocal(),
): {
  todayISO: string;
  activeConstraints: ActiveConstraint[];
  profile: OnboardingData;
} {
  // ProgramStore owns the accepted material snapshot. The legacy stores are
  // mirrors used only before the first accepted transaction/hydration.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const accepted = require('../store/programStore').useProgramStore.getState()
    .acceptedMaterialContext;
  const hasAcceptedContext = accepted?.revision > 0;
  const activeById = new Map<string, ActiveConstraint>();
  for (const constraint of activeConstraintsOverride ??
    (hasAcceptedContext ? accepted.activeConstraints : useCoachUpdatesStore.getState().activeConstraints) ?? []) {
    // InjuryEpisodeV1 is composed against AcceptedCompositionBase at the
    // visible boundary. Treating its compatibility constraint as a write
    // validator would destroy the very base resolution needs.
    if (constraint.type !== 'injury') activeById.set(constraint.id, constraint);
  }
  const readinessSignals = hasAcceptedContext
    ? accepted.readinessSignalsByDate
    : useReadinessStore.getState().signalsByDate;
  for (const signal of Object.values(readinessSignals ?? {}) as Array<
    Parameters<typeof buildReadinessActiveConstraints>[0]
  >) {
    for (const constraint of buildReadinessActiveConstraints(signal)) {
      activeById.set(constraint.id, constraint);
    }
  }
  return {
    todayISO,
    activeConstraints: Array.from(activeById.values()),
    profile: useProfileStore.getState().onboardingData,
  };
}

/**
 * Refuse a single-date write whose week the §18 boundary rejects.
 *
 * The surrounding week is COMPOSED here purely to be checked, and is thrown
 * away. Nothing composed in this function is ever returned, stored or handed
 * back to the caller.
 */
function assertLiveDateCandidateAgainstWeek(args: {
  date: string;
  workout: Workout;
  context: ReturnType<typeof liveValidationContext>;
}): void {
  const state = require('../store/programStore').useProgramStore.getState();
  const microcycle = selectMicrocycleForDate(
    state.currentProgram,
    state.currentMicrocycle,
    args.date,
  );
  if (
    !microcycle ||
    args.date < microcycle.startDate.slice(0, 10) ||
    args.date > microcycle.endDate.slice(0, 10)
  ) {
    // A future override outside the currently materialised block has no
    // approved target-week contract yet. The rebuild/rollover path composes and
    // gates it once that target week exists; never check it against the
    // nearest/current microcycle by accident.
    return;
  }
  const weekStart = addDaysISO(
    args.date,
    -((new Date(`${args.date}T12:00:00`).getDay() + 6) % 7),
  );
  const overlay = state.weekScopedOverlays?.[weekStart] as WeekScopedWorkoutOverlay | undefined;
  const contract = selectStoredWeekDeclaration({
    overlay,
    coveringMicrocycle: microcycle,
    weekStart,
    reader: 'postGenerationConstraintValidation.assertLiveDateCandidate',
  });
  if (!contract) return;

  const workouts: Workout[] = [];
  for (let offset = 0; offset < 7; offset++) {
    const date = addDaysISO(weekStart, offset);
    if (date === args.date) continue;
    const dow = new Date(`${date}T12:00:00`).getDay();
    // Tier 2 of THE ordering — `rules/dayPrecedence.ts`.
    const workout = composeDaySurfaces({
      date,
      dayOfWeek: dow,
      dateOverrides: state.dateOverrides,
      overlay,
      base: microcycle.workouts.find((candidate: Workout) => candidate.dayOfWeek === dow) ?? null,
    }).workout;
    if (workout) workouts.push(workout);
  }
  // The candidate is deliberately last: an explicit edit may not displace
  // already-authorised sessions to bypass a safety frequency ceiling.
  workouts.push(args.workout);
  /* ── R-229 S4c: THE WRITE BOUNDARY JUDGES THE DERIVED CONTRACT ───────────
   *
   * Leg (iii)'s missing validator install. MEASURED 2026-08-26 (S4b probe,
   * acted world): severe illness stamps `optional_week core.min=0` into BOTH
   * stored contract homes, a relaunch copies it over the generation-authored
   * microcycle declaration, and CLEARING the illness restores neither — the
   * stored declaration stays the sick week's forever. A validator reading it
   * raw judges every later edit on a healthy week against `optional_week`.
   * `deriveWeekContract` is the one owner already installed at the accepted
   * reader and the replan publisher; the facts being gone IS the derivation's
   * input, so the healthy week judges as itself again. */
  const surfaces = liveAcceptedEffectiveWeekSurfaces();
  requireSection18AcceptedWeek({
    contract: deriveWeekContract({
      contract,
      weekStart,
      profile: args.context.profile,
      markedDays: state.acceptedMaterialContext?.markedDays ?? {},
      userRemovalConstraints: state.userRemovalConstraints,
      workouts,
      temporarySourceFacts: factsForWorld(surfaces),
    }),
    workouts,
    weekStart,
    profile: args.context.profile,
    surfaces,
  });
}

/** Live-store refusals used by ProgramStore's final write primitives. */
export function assertLiveProgramWrite(
  program: TrainingProgram,
  todayISO?: string,
): void {
  assertProgramAgainstActiveConstraints({
    ...liveValidationContext(undefined, todayISO),
    program,
  });
}

export function assertLiveMicrocycleWrite(
  microcycle: Microcycle,
  todayISO?: string,
): void {
  assertMicrocycleAgainstActiveConstraints({
    ...liveValidationContext(undefined, todayISO),
    microcycle,
  });
}

export function assertLiveWorkoutWrite(
  date: string,
  workout: Workout,
  options: {
    /**
     * The caller owns an atomic accepted-week transaction that will gate the
     * complete week. Do not ask the single-date boundary to accept an
     * intentionally incomplete intermediate week.
     */
    deferWeekAcceptance?: boolean;
  } = {},
): void {
  if (options.deferWeekAcceptance) return;
  const context = liveValidationContext(undefined, date);
  assertLiveDateCandidateAgainstWeek({ date, workout, context });
}

export function assertLiveNullableWorkoutWrite(
  date: string,
  workout: Workout | null,
): void {
  if (!workout) return;
  const state = require('../store/programStore').useProgramStore.getState();
  const storedCandidates: Workout[] = [
    ...(state.currentProgram?.microcycles.flatMap((microcycle: Microcycle) => microcycle.workouts) ?? []),
    ...(state.currentMicrocycle?.workouts ?? []),
    ...Object.values(state.dateOverrides ?? {}) as Workout[],
    ...Object.values(state.weekScopedOverlays ?? {}).flatMap((overlay) =>
      Object.values((overlay as WeekScopedWorkoutOverlay).workoutsByDate)
        .filter((candidate): candidate is Workout => !!candidate)),
  ];
  if (storedCandidates.some((candidate) =>
    candidate.id === workout.id && JSON.stringify(candidate) === JSON.stringify(workout))) {
    // todayWorkout is a cache/reference when it points at content already
    // accepted on another persisted surface. Re-evaluating it against the
    // machine's current date would invent a different target week (notably in
    // fixed-date rebuild and rollover flows).
    return;
  }
  assertLiveDateCandidateAgainstWeek({
    date,
    workout,
    context: liveValidationContext(undefined, date),
  });
}

export function assertLiveWeekOverlayWrite(overlay: WeekScopedWorkoutOverlay): void {
  const context = liveValidationContext();
  const state = require('../store/programStore').useProgramStore.getState();
  const baseMicrocycle = (state.currentProgram?.microcycles ?? []).find(
    (microcycle: Microcycle) =>
      overlay.weekStart >= microcycle.startDate.slice(0, 10) &&
      overlay.weekStart <= microcycle.endDate.slice(0, 10),
  ) ?? (
    state.currentMicrocycle &&
    overlay.weekStart >= state.currentMicrocycle.startDate.slice(0, 10) &&
    overlay.weekStart <= state.currentMicrocycle.endDate.slice(0, 10)
      ? state.currentMicrocycle
      : null
  );
  // THE FLIP, MOVE (ii) — one read door. The candidate overlay being checked is
  // the `overlay` rung here: this is a WRITE being refused or allowed, so the
  // answer must come from the candidate, not from what is already stored.
  const contract = selectStoredWeekDeclaration({
    overlay,
    coveringMicrocycle: baseMicrocycle,
    weekStart: overlay.weekStart,
    reader: 'postGenerationConstraintValidation.assertLiveWeekOverlayWrite',
  });
  if (!contract) return;

  const effectiveWorkouts: Workout[] = [];
  const datedWorkouts: Array<{ date: string; workout: Workout }> = [];
  for (let offset = 0; offset < 7; offset++) {
    const date = addDaysISO(overlay.weekStart, offset);
    const dow = new Date(`${date}T12:00:00`).getDay();
    const workout = composeDaySurfaces({
      date,
      dayOfWeek: dow,
      dateOverrides: state.dateOverrides,
      overlay: { workoutsByDate: overlay.workoutsByDate },
      base: baseMicrocycle?.workouts.find((candidate: Workout) => candidate.dayOfWeek === dow) ?? null,
    }).workout;
    if (workout) {
      effectiveWorkouts.push(workout);
      datedWorkouts.push({ date, workout });
    }
  }
  // R-229 S4c: same derived judge as the date-candidate boundary above.
  const overlaySurfaces = liveAcceptedEffectiveWeekSurfaces();
  requireSection18AcceptedWeek({
    contract: deriveWeekContract({
      contract,
      weekStart: overlay.weekStart,
      profile: context.profile,
      markedDays: state.acceptedMaterialContext?.markedDays ?? {},
      userRemovalConstraints: state.userRemovalConstraints,
      workouts: effectiveWorkouts,
      temporarySourceFacts: factsForWorld(overlaySurfaces),
    }),
    workouts: effectiveWorkouts,
    weekStart: overlay.weekStart,
    profile: context.profile,
    surfaces: overlaySurfaces,
  });
  assertTemporaryScheduleConstraintsHonoured({
    weekStart: overlay.weekStart,
    datedWorkouts,
    activeConstraints: context.activeConstraints,
  });
}
