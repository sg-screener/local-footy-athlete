import type {
  Microcycle,
  OnboardingData,
  TrainingProgram,
  UserRemovalConstraint,
  Workout,
  WeekScopedWorkoutOverlay,
} from '../types/domain';
import type { CalendarDayType } from '../store/calendarStore';
import type { WeeklyExposureContractV2 } from './weeklyExposureContractV2';
import {
  resolveFinalVisibleSection18Week,
} from './section18AcceptedWeekGateway';
import {
  evaluateSection18EffectiveWeek,
  type Section18EffectiveWeekEvaluation,
} from './section18EffectiveWeekEvaluator';
import { applyUserRemovalConstraintsToWeek } from './userRemovalConstraints';
import { athletePlacementForDateOverride } from './athletePlacement';
import { composeDaySurfaces } from './dayPrecedence';
import { deriveWeekContract } from './derivedWeekContract';
import type { DaySurfaceOwner } from './dayPrecedence';
import type { TemporarySourceFact } from './temporarySourceFact';

/**
 * THE ATHLETE'S SOURCE FACTS IN THIS WORLD — leg (v)'s read side.
 *
 * Stated as a helper rather than a required field because the surfaces bundle
 * reaches this function two ways: composed through
 * `composeAcceptedEffectiveWeekSurfaces`, which carries the field, and cast
 * whole from the store (`useProgramStore.getState() as never`), where the same
 * list lives under `acceptedMaterialContext`. Both are the SAME list; reading
 * either here is what stops a caller silently claiming the athlete is well.
 */
export function factsForWorld(
  surfaces: AcceptedEffectiveWeekSurfaces,
): readonly TemporarySourceFact[] {
  const direct = (surfaces as { temporarySourceFacts?: readonly TemporarySourceFact[] })
    .temporarySourceFacts;
  if (direct) return direct;
  const context = (surfaces as {
    acceptedMaterialContext?: { temporarySourceFacts?: readonly TemporarySourceFact[] };
  }).acceptedMaterialContext;
  return context?.temporarySourceFacts ?? [];
}

/** Alias, not a second declaration — the owner set is `dayPrecedence`'s. */
export type AcceptedWeekSurfaceOwner = DaySurfaceOwner;

/**
 * THE WORLD UNDER EVALUATION (`docs/SURFACES_CONTEXT_RULING_2026-08-06.md`).
 *
 * Sometimes that world is the persisted store; sometimes it is the world a
 * transaction is composing, because a decision in flight is a decision. Both
 * are expressed here, and which one a call means is stated by the caller.
 */
export interface AcceptedEffectiveWeekSurfaces {
  currentProgram: TrainingProgram | null;
  currentMicrocycle?: Microcycle | null;
  dateOverrides: Readonly<Record<string, Workout>>;
  weekScopedOverlays: Readonly<Record<string, WeekScopedWorkoutOverlay>>;
  /**
   * THE APPLICATION INPUT — the removals this world still has to APPLY.
   *
   * REQUIRED, and that is the whole precondition unit. It was optional, and
   * six doors forgot it — 328 measured entries where the gateway was told the
   * athlete had binned nothing while their bin sat full. A world with no
   * removal decisions says so with `[]`; it no longer says so by silence.
   *
   * It is CONSUMED: once the removals are folded into composed workouts the
   * field is blanked on purpose (`section18AcceptedWeekGateway.ts`'s three
   * blanks), because re-feeding them would apply each twice and re-remove the
   * remainder a bin left behind. That blanking is signed and stays.
   */
  userRemovalConstraints: readonly UserRemovalConstraint[];
  /**
   * THE RECORD — the athlete's removal decisions, NEVER blanked
   * (`docs/REMOVAL_RECORD_SPLIT_RULING_2026-08-06.md`).
   *
   * One representation was carrying two questions. "What must I still remove?"
   * is answered above and emptied by its first consumer. "Does a DECISION
   * explain why this week looks like this?" is a different question, asked
   * later and deeper — by the repair search's stand-down, which must let the
   * deletion class's own relocation (the one recording the typed ownership
   * that makes a restore reversible) run before it may green the week. A field
   * emptied because it has already been APPLIED cannot answer it: measured,
   * 1,045 of 1,045 search entries arrived with `constraints=(none)`.
   *
   * READ-ONLY, and read for EXPLANATION only. Nothing applies it — applying it
   * would be the double-removal the blanking exists to prevent. Both fields
   * are populated by ONE composer
   * (`liveEvaluationSurfaces.composeAcceptedEffectiveWeekSurfaces`) from the
   * same source in the same breath, so they cannot drift; where a staging
   * transaction genuinely means two different sets it says so by NAME, and
   * that is a decision rather than drift.
   */
  removalDecisions: readonly UserRemovalConstraint[];
  /**
   * THE ATHLETE'S SOURCE FACTS in this world — leg (v)'s read side. Optional
   * because the same bundle also arrives as the store cast whole, where the
   * list lives under `acceptedMaterialContext`; `factsForWorld` reads either.
   */
  temporarySourceFacts?: readonly TemporarySourceFact[];
}

export interface AcceptedEffectiveWeekDate {
  date: string;
  dayOfWeek: number;
  owner: AcceptedWeekSurfaceOwner;
  workout: Workout | null;
}

export interface AcceptedEffectiveWeekSnapshot {
  weekStart: string;
  weekEnd: string;
  baseMicrocycle: Microcycle | null;
  overlay: WeekScopedWorkoutOverlay | null;
  contract: WeeklyExposureContractV2;
  markedDays: Record<string, CalendarDayType>;
  dates: AcceptedEffectiveWeekDate[];
  composedWorkouts: Workout[];
  visibleWorkouts: Workout[];
  evaluation: Section18EffectiveWeekEvaluation;
  stablePlanEntryIds: string[];
}

export class AcceptedEffectiveWeekUnavailableError extends Error {
  readonly code = 'accepted_effective_week_unavailable';

  constructor(weekStart: string, detail: string) {
    super(`Accepted effective week unavailable for ${weekStart}: ${detail}`);
    this.name = 'AcceptedEffectiveWeekUnavailableError';
  }
}

function addDays(dateISO: string, count: number): string {
  const date = new Date(`${dateISO.slice(0, 10)}T12:00:00`);
  date.setDate(date.getDate() + count);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function microcycleForWeek(
  surfaces: AcceptedEffectiveWeekSurfaces,
  weekStart: string,
): Microcycle | null {
  return surfaces.currentProgram?.microcycles.find((candidate) =>
    weekStart >= candidate.startDate.slice(0, 10) &&
    weekStart <= candidate.endDate.slice(0, 10)) ?? (
    surfaces.currentMicrocycle &&
    weekStart >= surfaces.currentMicrocycle.startDate.slice(0, 10) &&
    weekStart <= surfaces.currentMicrocycle.endDate.slice(0, 10)
      ? surfaces.currentMicrocycle
      : null
  );
}

/**
 * Sole precedence owner for a currently accepted athlete-visible week.
 *
 * The returned mutation source is always date override > explicit overlay
 * entry (including null) > base microcycle, resolved once with the accepted
 * calendar marks and carried Contract v2.
 */
export function rebaseAcceptedEffectiveWeek(args: {
  surfaces: AcceptedEffectiveWeekSurfaces;
  weekStart: string;
  profile: OnboardingData | null | undefined;
  markedDays: Readonly<Record<string, CalendarDayType>>;
}): AcceptedEffectiveWeekSnapshot {
  const weekStart = args.weekStart.slice(0, 10);
  const weekEnd = addDays(weekStart, 6);
  const overlay = args.surfaces.weekScopedOverlays[weekStart] ?? null;
  const baseMicrocycle = microcycleForWeek(args.surfaces, weekStart);
  const storedContract = overlay?.exposureContractV2 ?? baseMicrocycle?.exposureContractV2;
  if (!storedContract) {
    throw new AcceptedEffectiveWeekUnavailableError(weekStart, 'Contract v2 is missing');
  }

  const dates: AcceptedEffectiveWeekDate[] = [];
  for (let offset = 0; offset < 7; offset++) {
    const date = addDays(weekStart, offset);
    const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
    // Tier 2 of THE ordering, stated once in `rules/dayPrecedence.ts`. This
    // loop WAS the definition — the owner module was written from it verbatim,
    // so delegating here is behaviour-preserving by construction and every
    // accepted-state suite stays green untouched.
    const base = baseMicrocycle?.workouts.find((candidate) =>
      candidate.dayOfWeek === dayOfWeek) ?? null;
    dates.push(composeDaySurfaces({ date, dayOfWeek, dateOverrides: args.surfaces.dateOverrides, overlay, base }));
  }

  // OWNERSHIP TRAVELS WITH THE CONTENT, or the derivers downstream cannot ask.
  //
  // `dates` above knows exactly which days the athlete owns — `owner` is
  // computed one loop up. Flattening to a bare workout list used to throw that
  // away, and `resolveFinalVisibleSection18Week` then resolved with
  // `manualOverrides: {}` (rightly — the content is already composed), leaving
  // an athlete-owned day indistinguishable from a template day. The G+1
  // recovery deriver regenerated over it while the screen, which answers
  // ownership its own way, went on showing the athlete's session.
  //
  // `date_override` is an athlete-owned surface; `week_overlay` is not — a
  // scoped-regen overlay is authored by a source fact, not by the athlete — and
  // `base_microcycle` is the derived plan itself. An existing stamp always
  // wins: a session that arrived here carrying its constraint provenance keeps
  // it rather than being relabelled by the surface it happens to sit on.
  const composedWorkouts = applyUserRemovalConstraintsToWeek({
    workouts: dates.flatMap((entry) => {
      if (!entry.workout) return [];
      if (entry.owner !== 'date_override' || entry.workout.athletePlacement) {
        return [entry.workout];
      }
      return [{
        ...entry.workout,
        athletePlacement: athletePlacementForDateOverride({ placedDate: entry.date }),
      }];
    }),
    weekStart,
    constraints: args.surfaces.userRemovalConstraints,
  });
  // Leg (iii), install site 1 of 3 — the app's contract-SELECTION line.
  // AFTER composition, deliberately: the removal ledger's typed reduction is
  // measured against the composed week, so the contract cannot be derived
  // before the week it describes exists.
  const contract = deriveWeekContract({
    contract: storedContract,
    weekStart,
    profile: args.profile,
    markedDays: args.markedDays,
    userRemovalConstraints: args.surfaces.userRemovalConstraints,
    workouts: composedWorkouts,
    temporarySourceFacts: factsForWorld(args.surfaces),
  });
  const markedDays = { ...args.markedDays };
  const visibleWorkouts = resolveFinalVisibleSection18Week({
    contract,
    workouts: composedWorkouts,
    weekStart,
    profile: args.profile ?? undefined,
    scheduleState: { markedDays },
    surfaces: args.surfaces,
  });
  // ONE BASIS — the contract a week is JUDGED by is derived against the week
  // that IS judged, and that week is the VISIBLE one: the athlete's screen is
  // the only week they can act on, so a contract derived against anything else
  // judges a week nobody sees. Basis chosen by measurement, per
  // `docs/FOUR_LEG_CONVERGENCE_RULING_2026-08-07.md`.
  const judgedContract = deriveWeekContract({
    contract: storedContract,
    weekStart,
    profile: args.profile,
    markedDays: args.markedDays,
    userRemovalConstraints: args.surfaces.userRemovalConstraints,
    workouts: visibleWorkouts,
    temporarySourceFacts: factsForWorld(args.surfaces),
  });
  const evaluation = evaluateSection18EffectiveWeek({
    contract: judgedContract,
    workouts: visibleWorkouts,
    weekStart,
  });

  return {
    weekStart,
    weekEnd,
    baseMicrocycle,
    overlay,
    contract: judgedContract,
    markedDays,
    dates,
    composedWorkouts,
    visibleWorkouts,
    evaluation,
    stablePlanEntryIds: visibleWorkouts.flatMap((workout) =>
      workout.planEntryId ? [workout.planEntryId] : []),
  };
}
