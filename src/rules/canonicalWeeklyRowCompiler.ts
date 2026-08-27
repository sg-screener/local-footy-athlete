/** Final-week row compiler. Explicit accepted inputs in; complete weeks, selections
 * and diagnostics out. The service only captures inputs and records accepted decisions.
 * Existing scheduler, composer, adapter and dose specialists retain their policies. */
import { OnboardingData, type DayOfWeek, type ConditioningEquipmentModality, type Workout, type Microcycle, type WeekKind } from '../types/domain';
import { buildWorkoutsFromCoach, type CoachGeneratedWorkoutInput } from '../data/defaultProgram';
import { effectiveAnchorParticipation } from '../rules/weeklyExposureContractV2';
import { composedIdentityFor } from '../rules/composedRowLegality';
import { type CoachingInputs, type CoachingPlan } from '../utils/coachingEngine';
import { isoDateForWeekday } from '../utils/appDate';
import { type ActiveConstraint } from '../store/coachUpdatesStore';
import type { TemporarySourceFact } from '../rules/temporarySourceFact';
import { buildBlockWeekStates } from '../utils/programBlockState';
import { buildGenerationConstraintContext, type GenerationConstraintContext } from '../utils/generationConstraints';
import { canonicalWeeklyInjuryStateFrom } from '../rules/canonicalWeeklyInjuryState';
import { canonicalWeeklyAvailabilityStateFrom } from '../rules/canonicalWeeklyAvailabilityState';
import type { EquipmentTag } from '../data/exercisePools';
import { stampSection18GovernedBoundary } from '../rules/weeklyExposureContractV2';
import { storedGameAnchor } from '../rules/gameAnchor';
import { composeWeek, kitUnachievablePatterns, type ComposerInputs, type ComposerPlannedDay } from '../rules/composeWeek';
import { resolveWeekExclusions } from '../rules/exerciseExclusions';
import { composedPlannedDaysFrom } from '../rules/composerPlannedDays';
import { schedulerPlannedDays } from '../rules/schedulerPlannedDays';
import { compileCanonicalWeek, type CanonicalWeeklyIllnessFact, type CanonicalWeeklyReadinessFact } from '../rules/canonicalWeeklyCompiler';
import { canonicalWeeklyScheduledDeloadStateFrom } from '../rules/canonicalWeeklyScheduledDeloadState';
import { canonicalFixtureStateFrom } from '../rules/canonicalWeeklyFixtureState';
import { resolveTrainingAgePolicy } from '../rules/trainingAgePolicy';
import type { WeeklySchedule } from '../rules/weeklyScheduler';
import { WeeklyScheduleRefusedError, weeklySchedulerInputsFrom } from '../rules/weeklySchedulerInputs';
import type { DeloadWeekPolicy } from '../rules/deloadWeekRules';
import { generatedWeekContractFrom } from '../rules/generatedWeekContract';
import { generatedWeekFailureSignature, validateGeneratedWeek, type GeneratedWeekFinding } from '../rules/validateGeneratedWeek';
import { materialiseComposedWeek } from '../rules/materialiseComposedWeek';
import { assembleAuthoredWeek } from '../rules/assembleAuthoredWeek';
import { withCraftSafeTopUps } from '../rules/section18CraftTier';
import type { AcceptedStateOperationKind } from '../store/acceptedStateTransaction';
import { applyOptionalTopUps } from '../utils/optionalTopUpPlacement';
import { weakPointFocusFor } from '../rules/weakPointFocus';
import { stampPlannerDerivedSessionProvenance } from '../rules/derivedSessionProvenance';
import { type SeasonPhaseClock } from '../rules/seasonPhaseClock';
import type { FixtureConditionedAvailability } from '../rules/fixtureConditionedAvailability';
import type { BlockExerciseSelection } from './blockExerciseSelection';

type CoachGeneratedWorkouts = Parameters<typeof buildWorkoutsFromCoach>[0];
type AthletePoolPrefsArg = Parameters<typeof buildWorkoutsFromCoach>[5];
export interface CompilationDiagnostic { readonly message: string; readonly details: Record<string, unknown>; }
export interface CanonicalProgramWeeksResult {
 readonly microcycles: Microcycle[]; readonly plans: CoachingPlan[];
 readonly selections: BlockExerciseSelection[]; readonly diagnostics: CompilationDiagnostic[];
}
const DAY_MAP: Record<string, number> = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };

function dateAtNoonISO(dateISO: string): string {
  return new Date(`${dateISO}T12:00:00`).toISOString();
}

/** One owner of the Monday-first weekday-to-date rule. */
const dateForWeekday = isoDateForWeekday;

/**
 * The game's day-of-week, for the top-up's caps.
 *
 * Read from the WEEK first — a Game session in the built week is the fact — and
 * from the profile's usual game day only when the week has none, so a virtual
 * Saturday still protects its G-1 for the authored Gunshow.
 */
function gameDayOfWeekFor(
  workouts: readonly Workout[],
  profile: OnboardingData,
): number | null {
  const game = workouts.find((workout) => workout.workoutType === 'Game');
  if (game) return game.dayOfWeek;
  const usual = storedGameAnchor(profile);
  return usual ? DAY_MAP[usual] ?? null : null;
}

/**
 * Days the top-up may place on.
 *
 * TWO EXCLUSIONS, both of them the athlete's own inputs rather than the app's
 * preferences. Days they did not name as training days are not the app's to fill —
 * an optional session on an excluded day overrides a stated answer. And days before
 * the governed boundary are history: the week's earlier days are pinned, and adding
 * a session to one would be the app editing a day that has already happened.
 */
function topUpCandidateDays(args: {
  profile: OnboardingData;
  weekStart: string;
  governedFromISO: string | null;
}): number[] {
  const declared = (args.profile.preferredTrainingDays ?? [])
    .map((day) => DAY_MAP[day])
    .filter((day): day is number => typeof day === 'number');
  return [0, 1, 2, 3, 4, 5, 6].filter((day) => {
    if (declared.length > 0 && !declared.includes(day)) return false;
    if (args.governedFromISO &&
      dateForWeekday(args.weekStart, day) < args.governedFromISO) return false;
    return true;
  });
}

/** Equipment-free offers may use any future day, not only a gym-access day. */
function equipmentFreeTopUpCandidateDays(args: {
  weekStart: string;
  governedFromISO: string | null;
}): number[] {
  return [0, 1, 2, 3, 4, 5, 6].filter((day) =>
    !args.governedFromISO
      || dateForWeekday(args.weekStart, day) >= args.governedFromISO);
}


/** Translation only: the readiness door already made the policy decision. */
export function canonicalReadinessFactFrom(
  context: GenerationConstraintContext | undefined,
): CanonicalWeeklyReadinessFact | null {
  const readiness = context?.readiness;
  if (!readiness) return null;
  return {
    kind: 'readiness',
    id: readiness.id,
    deloaded: readiness.deloaded,
    sessionsOptional: readiness.sessionsOptional,
    ...(readiness.windowStartISO ? { windowStartISO: readiness.windowStartISO } : {}),
    ...(readiness.windowEndISO ? { windowEndISO: readiness.windowEndISO } : {}),
  };
}

/** Translation only: the illness door already made both policy decisions. */
export function canonicalIllnessFactFrom(
  context: GenerationConstraintContext | undefined,
): CanonicalWeeklyIllnessFact | null {
  const illness = context?.illness;
  if (!illness) return null;
  return {
    kind: 'illness',
    id: illness.id,
    activeFromISO: illness.activeFromISO,
    deloaded: illness.deloaded,
    sessionsOptional: illness.sessionsOptional,
  };
}

/**
 * A generated week that does not satisfy `GeneratedWeekContract`.
 *
 * It carries the clause findings verbatim, so the refusal names WHICH rule the
 * week broke and by how much — never a builder-shaped signature.
 */
export class GeneratedWeekRefusedError extends Error {
  readonly code = 'generated_week_refused';

  readonly findings: readonly GeneratedWeekFinding[];

  constructor(signature: string, findings: readonly GeneratedWeekFinding[]) {
    super(`Generated week refused (${signature})`);
    this.name = 'GeneratedWeekRefusedError';
    this.findings = findings;
  }
}


/** An athlete-selected extra day uses the same row composer as the generated
 * week. Placement/acceptance remain the session-edit compiler's responsibility. */
export function compileCanonicalStrengthTemplate(args: {
  composition: Omit<ComposerInputs, 'plannedDays'>;
  plannedDay: ComposerPlannedDay;
}): Workout | null {
  const composed = composeWeek({ ...args.composition, plannedDays: [args.plannedDay] });
  return materialiseComposedWeek(composed, {
    microcycleId: 'coach-template', weekStartISO: composed.weekStartISO,
  })[0] ?? null;
}

function composerExclusionInput(
  prefs: AthletePoolPrefsArg,
  weekStartISO: string,
): { excludedIdentities: readonly string[]; excludedIdentitiesByDate: Readonly<Record<string, readonly string[]>> } {
  const resolved = resolveWeekExclusions(prefs?.exclusions, weekStartISO);
  return {
    excludedIdentities: [
      ...new Set([...(prefs?.excluded ?? []), ...resolved.wholeWeek]),
    ],
    excludedIdentitiesByDate: resolved.byDate,
  };
}


export interface CanonicalProgramWeeksInput {
  coachWorkouts: CoachGeneratedWorkouts;
  /** Legacy/test-only precompiled plan. Product generation supplies coachingInputs. */
  plan?: CoachingPlan;
  coachingInputs?: CoachingInputs;
  /** Receives the exact compiler output used by each authored microcycle. */

  profile: OnboardingData;
  programId: string;
  microcyclePrefix: string;
  blockStartISO: string;
  blockNumber?: number;
  seasonPhaseClock: SeasonPhaseClock;
  athletePrefs: AthletePoolPrefsArg;
  /**
   * Identities the athlete trained and earned a rise on, per
   * `blockBoundaryProgression.progressedFromOwnHistory`. The ONLY history fact
   * `rules/blockExerciseSelection.ts` reads, and the contract's *"main and secondary
   * lifts may remain for a second consecutive block when progression, comfort
   * and technical continuity justify it"*. Absent = nothing recorded, so every
   * slot rotates, which is the contract's default.
   */
  progressedIdentities?: readonly string[];
  /**
   * RECORDED selections for earlier blocks. Read from
   * `blockSelectionHistoryStore` by the caller and passed down, so the domain
   * selector performs no hidden store read and boot/rollover feed it explicitly.
   */
  selectionHistory?: readonly import('../rules/blockExerciseSelection').BlockExerciseSelection[];
  availableEquipmentTags: readonly EquipmentTag[];
  availableConditioningModalities?: readonly ConditioningEquipmentModality[];
  generationConstraints?: GenerationConstraintContext;
  activeConstraints?: readonly ActiveConstraint[];
  /** Raw facts, threaded per-week to mint the illness_recovery week mode. */
  temporarySourceFacts?: readonly TemporarySourceFact[] | null;
  weekLimit?: 1 | 4;
  /**
   * Which week a `weekLimit: 1` build must author. Not an extra owner: it is the
   * caller's own target Monday, and the block position that week holds comes
   * from `blockStartISO`. `weekLimit: 1` used to mean "the block's FIRST week",
   * which is only the target week when the target IS a block start — the §18
   * reassessment's D1 (2026-08-05).
   */
  targetWeekStartISO?: string;
  /**
   * The live calendar fixture for `targetWeekStartISO`. Later block weeks keep
   * the profile's recurring default; a target-week bye is not a block-long bye.
   */
  targetFixtureDay?: DayOfWeek | null;
  /** The availability owner's answer for `targetWeekStartISO`. */
  targetWeekAvailability?: FixtureConditionedAvailability;
  /** See GenerateProgramFromProfileOptions.weekAcceptance. */
  weekAcceptance?: AcceptedStateOperationKind;
  /** See GenerateProgramFromProfileOptions.remainderBoundary. */
  remainderBoundary?: {
    governedFromISO: string;
    pinnedHistoryWorkouts: readonly Workout[];
  } | null;
  readonly authoredAtISO: string;
}

export function compileCanonicalProgramWeeks(args: CanonicalProgramWeeksInput): CanonicalProgramWeeksResult {
  const plans: CoachingPlan[] = [];
  const selections: BlockExerciseSelection[] = [];
  const diagnostics: CompilationDiagnostic[] = [];
  const blockStates = buildBlockWeekStates({
    blockStartISO: args.blockStartISO,
    blockNumber: args.blockNumber ?? 1,
    seasonPhase: args.profile.seasonPhase,
    seasonPhaseClock: args.seasonPhaseClock,
  });
  const targetWeekStartISO = args.targetWeekStartISO ?? args.blockStartISO;
  const states = args.weekLimit === 1
    ? blockStates.filter((state) => state.weekStart === targetWeekStartISO)
    : blockStates;
  // A single-week build that cannot find its week has been handed a block it
  // does not belong to. Silently authoring week 1 instead is the defect this
  // unit retired, so the disagreement is raised where it happens.
  if (args.weekLimit === 1 && states.length !== 1) {
    throw new Error(
      `week ${targetWeekStartISO} is not in the block starting ${args.blockStartISO}`,
    );
  }

  const microcycles = states.map((blockState, stateIndex) => {
    const microcycleId = `${args.microcyclePrefix}-${blockState.weekNumber}`;
    const generationConstraints = args.activeConstraints
      ? buildGenerationConstraintContext({
          activeConstraints: args.activeConstraints,
          todayISO: blockState.weekStart,
          periodEndISO: blockState.weekEnd,
          temporarySourceFacts: args.temporarySourceFacts,
        })
      : args.generationConstraints;
    // The door changes the DOSE, not the week's identity. `weekKind` is
    // structure — the block plan's own statement about what this week is — and
    // Sam's law holds structure constant while the work shrinks. Overwriting it
    // here also collided with a real block rule (the first four Off-season
    // weeks are an approved no-deload exception), because that rule governs what
    // the app SCHEDULES and an athlete-declared deload is not a schedule change.
    const effectiveWeekKind: WeekKind = blockState.weekKind;
    const targetFixtureDay = blockState.weekStart === targetWeekStartISO
      ? args.targetFixtureDay
      : undefined;
    const targetWeekAvailability = blockState.weekStart === targetWeekStartISO
      ? args.targetWeekAvailability
      : undefined;
    const weeklyInjury = canonicalWeeklyInjuryStateFrom({
      profile: args.profile,
      generationConstraints,
    });
    const profile: OnboardingData = {
      ...args.profile,
      injuries: [...weeklyInjury.mergedProfileInjuries],
    };
    /* ── THE ONE EQUIPMENT OWNER, ASKED FOR THE WHOLE WEEK ───────────────────
     *
     * ⚠ **THE KIT USED TO BE ONE ANSWER RESOLVED AT `blockState.weekStart`, AND
     * A WEEK IS NOT A DAY.** An away span beginning on the Wednesday does not
     * cover the Monday, so the resolver returned the FULL gym and the whole week
     * — the trip days included — was composed against it. Measured 2026-08-17
     * (`npm run trace:equipment-scopes`, boundary B3): the resolver answered 3
     * tags for the Thursday of the trip while the composer received all 19,
     * inside the same run, and the athlete read `Back Squat` from a hotel room.
     *
     * The window owner answers both questions at once and keeps them apart:
     * `permanent` is what he OWNS and decides what gets RECORDED, `byDate` is
     * what he can REACH each day and decides what ships. */
    const weeklyAvailability = canonicalWeeklyAvailabilityStateFrom({
      profile,
      weekStartISO: blockState.weekStart,
      activeConstraints: args.activeConstraints,
      ...(!args.activeConstraints
        ? {
            fallbackEquipment: {
              tags: [...args.availableEquipmentTags],
              conditioningModalities: [...(args.availableConditioningModalities ?? [])],
              selectionCompleteness: 'complete' as const,
              source: 'complete_selection' as const,
            },
          }
        : {}),
    });
    const equipment = weeklyAvailability.reachableEquipmentAcrossWeek;
    // ── B1-PIVOT: THE COMPOSER IS THE ONLY STRENGTH-CONTENT BUILDER ─────────
    //
    // Sam, 2026-08-14: *"isn't this like the ai? we just realise it's going to
    // suck for a bit and then build a better one with all the info in there?
    // because right now it just seems like we're fixing shit thats going to be
    // deleted anyway"*. **The migration allowlist is deleted, not widened.**
    // Every world's strength content is composed; the planner still owns the
    // skeleton (days, counts, planned patterns) and conditioning is untouched.
    // A world the composer cannot build now FAILS LOUDLY. It is never answered
    // by the legacy builder.
    // ══ THE PRODUCER CUTOVER ═══════════════════════════════════════════════
    //
    // `buildCoachingPlan` used to fill `CoachingPlan` here. **The scheduler and
    // the specialists fill it now**, through the pure connector. The SHAPE is
    // unchanged — the adapter, the §18 gateway, the store and the coach all read
    // it and none of them moved.
    //
    // Order matters and is the whole point: SCHEDULE first (it owns existence,
    // count, purpose, weekday, hard/rest and spacing), then MATERIALISE (the
    // specialists fill content into days they cannot change), then CONNECT
    // (translation only). The old order asked the planner first and let the
    // scheduler disagree with it afterwards.
    const cutoverInputs = args.coachingInputs;
    let allocatedWeekPlan: CoachingPlan;
    let compiledSchedule: WeeklySchedule | null = null;
    let compiledDosePolicyByDay: Readonly<Partial<Record<number, DeloadWeekPolicy>>> = {};
    let compiledDoseDoor: 'scheduled' | 'readiness' | 'illness' | null = null;
    let compiledActiveInjuryKeys = weeklyInjury.activeInjuryKeys;
    let weeklyCompositionAvailability = weeklyAvailability.composition;
    if (cutoverInputs) {
      const schedulerInputs = weeklySchedulerInputsFrom({
        profile,
        weekStartISO: blockState.weekStart,
        offseasonSubphase: blockState.phaseResolution.offseasonSubphase ?? null,
        exposureContract: null,
        miniCycleNumber: blockState.miniCycleNumber ?? null,
        weekKind: effectiveWeekKind,
      });
      const agePolicy = resolveTrainingAgePolicy(cutoverInputs.experienceLevel);
      const compiled = compileCanonicalWeek({
        scheduler: schedulerInputs,
        coaching: cutoverInputs,
        readiness: canonicalReadinessFactFrom(generationConstraints),
        illness: canonicalIllnessFactFrom(generationConstraints),
        scheduledDeload: canonicalWeeklyScheduledDeloadStateFrom({
          weekStartISO: blockState.weekStart,
          seasonPhase: profile.seasonPhase,
          weekKind: effectiveWeekKind,
        }),
        injury: weeklyInjury,
        availability: weeklyAvailability,
        fixture: canonicalFixtureStateFrom({
          weekStartISO: blockState.weekStart,
          availability: targetWeekAvailability,
          targetFixtureDay,
          seasonPhase: profile.seasonPhase,
        }),
        materialisation: {
          weekStartISO: blockState.weekStart,
          miniCycleNumber: blockState.miniCycleNumber,
          powerGoalNudge: false,
          availableMachines: undefined,
          runOnly: false,
          phase: profile.seasonPhase as never,
          offseasonSubphase: blockState.phaseResolution.offseasonSubphase ?? null,
        },
        connector: {
          offseasonSubphase: blockState.phaseResolution.offseasonSubphase ?? undefined,
          preseasonSubphase: blockState.phaseResolution.preseasonSubphase ?? undefined,
          section18Identity: {
            seasonPhase: profile.seasonPhase as never,
            blockNumber: blockState.miniCycleNumber ?? null,
            weekInBlock: blockState.weekInBlock ?? null,
            globalWeek: blockState.weekNumber ?? null,
            phaseWeek: blockState.phaseWeekNumber ?? null,
            phaseEntryWeekStartISO: blockState.phaseClock.phaseEntryWeekStartISO ?? null,
            phaseClockSelectedPhase: blockState.phaseClock.selectedPhase ?? null,
            phaseWeekProvenance: blockState.phaseResolution.provenance ?? 'legacy_unknown',
            weekKind: effectiveWeekKind,
            participationProvenance: 'derived_healthy_unrestricted',
            currentProductionClaimsAnchorCredit: true,
            /* THE WEEK'S OWN ANSWER, not one day's. A pattern the athlete can
             * train on the Monday is achievable this week even if Thursday is
             * spent in a hotel, and exempting it would weaken an achievable
             * requirement — which R-090 forbids by name. */
            kitUnachievablePatterns: kitUnachievablePatterns(
              weeklyAvailability.composition.reachableKitAcrossWeek),
          } as never,
          v1Input: {
            seasonPhase: profile.seasonPhase,
            weekKind: effectiveWeekKind,
            offseasonSubphase: blockState.phaseResolution.offseasonSubphase ?? null,
            preseasonSubphase: blockState.phaseResolution.preseasonSubphase ?? null,
            maxStrengthSessions: agePolicy.maxCoreSessions,
            byeMode: cutoverInputs.byeMode,
          } as never,
        },
        conditioningFeasibility: {
          phase: profile.seasonPhase,
          offseasonSubphase: blockState.phaseResolution.offseasonSubphase,
          preseasonSubphase: blockState.phaseResolution.preseasonSubphase,
          equipment,
        },
      });
      if (compiled.ok === false) throw new WeeklyScheduleRefusedError(compiled.refusal);
      compiledSchedule = compiled.schedule;
      allocatedWeekPlan = compiled.plan;
      compiledDosePolicyByDay = compiled.dosePolicyByDay;
      compiledDoseDoor = compiled.doseDoor;
      compiledActiveInjuryKeys = compiled.activeInjuryKeys;
      if (compiled.compositionAvailability) {
        weeklyCompositionAvailability = compiled.compositionAvailability;
      }
    } else {
      if (!args.plan) throw new Error('canonical week compilation requires coaching inputs or an explicit plan');
      if (generationConstraints?.illness) {
        throw new Error('illness facts require canonical weekly compilation');
      }
      allocatedWeekPlan = args.plan;
    }
    const weekPlan: CoachingPlan = allocatedWeekPlan;
    plans.push(weekPlan);
    // An edge response describes exactly the block state sent in its prompt:
    // week 1. Never replay that single array against week 2-4 allocations.
    // Later weeks use their own deterministic plan/fallback content.
    // ── THE CUTOVER: THE APPROVED CONTRACT OWNS COUNT, PURPOSE AND WEEKDAY ──
    //
    // `composedPlannedDaysFrom(weekPlan.weeklyPlan)` read the LEGACY PLANNER's
    // allocation. The contract's §1 target is one owner — *"ONE approved weekly
    // contract -> ONE weekly scheduler -> composition"* — so the composer's
    // planned days now come from `scheduleWeek`, and no later layer may change
    // the session count, purpose or weekday it chose.
    //
    // **THE PLANNER STILL RUNS, AND STILL OWNS WHAT THE CONTRACT DOES NOT.**
    // Conditioning content, warm-ups and the §18 exposure contract are its work;
    // the contract explicitly does not own exercise selection or dose. What it
    // no longer owns is WHICH DAYS carry strength and WHAT THOSE SESSIONS ARE.
    // The compiler's schedule is the schedule composition consumes. There is no
    // second scheduler pass after the connector and no opportunity for the same
    // week to acquire a different day/purpose answer downstream.
    // The planner's own names and tiers, by weekday, so a composed day keeps the
    // athlete-facing label it already had where the two agree on the day.
    const blockSelectionsAuthored = selections;
    const plannerNameByDay: Record<number, string> = {};
    const plannerTierByDay: Record<number, string> = {};
    for (const entry of weekPlan.weeklyPlan) {
      const dayNumber = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday',
        'Friday', 'Saturday'].indexOf(String(entry.dayOfWeek ?? ''));
      if (dayNumber < 0) continue;
      if (entry.focus) plannerNameByDay[dayNumber] = String(entry.focus);
      if (entry.tier) plannerTierByDay[dayNumber] = String(entry.tier);
    }
    const schedulerOwnedPlannedDays = compiledSchedule
      ? schedulerPlannedDays({
          weekStartISO: blockState.weekStart,
          days: compiledSchedule.days,
          nameByDayOfWeek: plannerNameByDay,
          tierByDayOfWeek: plannerTierByDay,
        })
      : composedPlannedDaysFrom(weekPlan.weeklyPlan);
    const composedWeek = composeWeek({
          profile,
          phaseClock: { weekNumber: blockState.weekNumber },
          // B1-M1: the phase the DOSE is resolved against, before authorship.
          seasonPhase: profile.seasonPhase as never,
          offseasonSubphase: blockState.phaseResolution.offseasonSubphase ?? null,
          plannedDays: schedulerOwnedPlannedDays,
          /* PERMANENT, so a five-day trip cannot enter the athlete's rotation
           * history. The dated half rides the next argument. */
          kit: weeklyCompositionAvailability.permanentKit,
          temporaryKitByDayOfWeek:
            weeklyCompositionAvailability.temporaryKitByDayOfWeek,
          injuries: {
            // §18's OWN safety answer, not a second injury reading.
            prohibitedPatterns:
              weekPlan.weeklyExposureContractV2?.strengthPatterns.prohibitedPatterns ?? [],
            /* ── THE ATHLETE'S EXCLUSIONS, RESOLVED AGAINST THE WEEK BEING BUILT ──
             *
             * It used to be `args.athletePrefs?.excluded` — a flat list of names
             * with no scope, applied to every week forever. Sam's approved
             * contract gives the answer THREE spans and only one of them is
             * week-wide, so a flat list can be right for at most one of them.
             *
             * `resolveWeekExclusions` splits the one predicate two ways: names
             * out for the WHOLE week, and names out on PARTICULAR DAYS. A "today
             * only" answer must not take the exercise out of Thursday's session
             * as well, and this seam is where that stops happening. */
            ...composerExclusionInput(args.athletePrefs, blockState.weekStart),
          },
      todayISO: blockState.weekStart,
      /* ── THE SELECTION OWNER'S INPUTS. See `rules/blockExerciseSelection.ts`. ──────
       * Selection is keyed by the BLOCK, so the block identity that was already
       * resolved here has to reach the composer. It was not passed before, which
       * is why the composer fell back to the phase WEEK number and a main lift
       * changed every week. */
      blockNumber: blockState.miniCycleNumber ?? 1,
      pinnedIdentities: (args.athletePrefs?.pinned ?? []).map(composedIdentityFor),
      progressedIdentities: args.progressedIdentities ?? [],
      /* ── THE RECORDED PAST, HANDED DOWN EXPLICITLY ────────────────────────
       * The composer never reads a store. Boot and rollover reach this same
       * argument, so every path feeds the selector the same history. */
      blockStartISO: blockState.blockStart,
      selectionHistory: args.selectionHistory ?? [],
    });
    /* What this block chose, carried out so the caller can RECORD it. The
     * composer decides; persistence is the caller's job. */
    for (const selection of composedWeek.selections) {
      if (!blockSelectionsAuthored.some((entry) =>
        entry.slot === selection.slot
          && (entry.seatIndex ?? 0) === (selection.seatIndex ?? 0))) {
        blockSelectionsAuthored.push(selection);
      }
    }
    // ⚠ THE HANDOVER. Composer rows are MATERIALISED straight into domain
    // workouts and NEVER enter `buildWorkoutsFromCoach`. The retained adapter
    // still receives the COMPLETE planner week — this app hangs conditioning,
    // running and sprint work off the strength days — and is simply told which
    // days' STRENGTH the composer owns, so it authors no lifts there.
    // ── EVERY STRENGTH DAY THE LEGACY BUILDER MUST STAND DOWN ON ────────────
    //
    // The composer's OWN days, **plus every day the planner still marks as
    // strength.** Once the scheduler owns the weekday, the planner's allocation
    // can name a day the scheduler did not choose — and that orphaned entry fell
    // through to the severed legacy builder, which throws by design.
    //
    // Measured: 6 worlds died exactly that way
    // (`B1-PIVOT: the legacy strength-content builder is severed`). **Strength is
    // the composer's, on every day, so the stand-down list is the union** — not
    // a fallback, not a repair: the legacy builder authors no lifts anywhere.
    const plannerStrengthDays = weekPlan.weeklyPlan
      .map((entry) => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday',
        'Friday', 'Saturday'].indexOf(String(entry.dayOfWeek ?? '')))
      .filter((day) => day >= 0);
    const composedStrengthDays = [...new Set([
      ...composedWeek.days.map((day) => day.dayOfWeek),
      ...plannerStrengthDays,
    ])];
    const sourceCoachWorkouts: CoachGeneratedWorkoutInput[] = [];
    let exposureContractV2 = weekPlan.weeklyExposureContractV2;
    // The governed boundary, when it falls inside THIS week. Days before it are
    // history: the contract is stamped, pre-boundary anchors keep settled
    // participation, and the candidate pins the athlete's actual days so §18
    // acceptance evaluates the true week (remainder authored AS a remainder).
    const boundary = args.remainderBoundary &&
      args.remainderBoundary.governedFromISO > blockState.weekStart &&
      args.remainderBoundary.governedFromISO <= blockState.weekEnd
      ? args.remainderBoundary
      : null;
    if (boundary && exposureContractV2) {
      exposureContractV2 = stampSection18GovernedBoundary({
        contract: exposureContractV2,
        weekStartISO: blockState.weekStart,
        governedFromISO: boundary.governedFromISO,
      });
    }
    const pinHistoryDays = (built: Workout[]): Workout[] => {
      if (!boundary) return built;
      const isHistoryDate = (dayOfWeek: number): boolean =>
        dateForWeekday(blockState.weekStart, dayOfWeek) < boundary.governedFromISO;
      return [
        ...built.filter((workout) => !isHistoryDate(workout.dayOfWeek)),
        ...boundary.pinnedHistoryWorkouts.filter((workout) =>
          isHistoryDate(workout.dayOfWeek)),
      ];
    };
    const buildCanonicalCandidate = (source: typeof sourceCoachWorkouts): Workout[] => {
      // RECOVERY ADD-ONS ARE NOT PLACED BY GENERATION ANY MORE (2026-08-01,
      // device-pass fail 3). `attachRecoveryAddonsToWeek` put 2-4 generator-
      // chosen add-ons on every generated week — including team nights, which
      // is exactly Sam's "TT + Recovery" card — and recovery is a
      // charter-deleted type whose placement is ATHLETE-ONLY (the charter's
      // rest law: the generator stops placing optional work uninvited). The
      // builder module stays for its classifier exports; the placement pass is
      // retired here. Add-ons ALREADY STORED on devices are not stripped at
      // hydration in this round — they render the mobility vocabulary their
      // rows always were (`part.headline.recovery` → "Mobility"), and content
      // removal from §18-verified stored surfaces is its own unit (recorded in
      // the fix-round boundary notes, with `dropRetiredWeekOverlaysAtHydration`
      // as the pattern to follow).
      // ⚠ THE ADAPTER GETS THE WHOLE WEEK, AND AUTHORS NO LIFTS ON COMPOSED DAYS.
      const adapterWorkouts = buildWorkoutsFromCoach(
          source,
          microcycleId,
          weekPlan.weeklyPlan,
          profile,
          {
            conditioningFeasibilityResolved: true,
            miniCycleNumber: blockState.miniCycleNumber,
            weekInBlock: blockState.weekInBlock,
            weekStartISO: blockState.weekStart,
            weekKind: effectiveWeekKind,
            intensityMultiplier: blockState.intensityMultiplier,
            offseasonSubphase: blockState.phaseResolution.offseasonSubphase ?? undefined,
            composedStrengthDays,
            canonicalDosePolicyByDay: compiledDosePolicyByDay,
            canonicalPlanDoseResolved: true as const,
          },
          {
            ...args.athletePrefs,
            activeInjuries: Array.from(new Set([
              ...(args.athletePrefs?.activeInjuries ?? []),
              ...compiledActiveInjuryKeys,
            ])),
            availableEquipment: equipment.tags,
            conditioningModalities: equipment.conditioningModalities,
          },
        );
      // The composer's own rows, materialised directly. No re-dosing, no
      // rotation, no identity rewrite — `assembleAuthoredWeek` lays them onto
      // the adapter's day, which keeps everything non-strength it built.
      // ── THE GOVERNED DOSE INSTRUCTION, RESOLVED ONCE BY THE EXISTING OWNER ──
      //
      const deloadPolicyForDay = (dayOfWeek: number): DeloadWeekPolicy | null => {
        return compiledDosePolicyByDay[dayOfWeek] ?? null;
      };
      const authored = assembleAuthoredWeek({
        composerWorkouts: materialiseComposedWeek(composedWeek, {
          microcycleId,
          weekStartISO: blockState.weekStart,
          deloadPolicyForDay,
          /* ── THE SPECIALIST'S PRIMER, HANDED TO THE DAY THAT CARRIES IT ────
           * The plan already holds `powerPrimer` per day — `powerPrimerPolicy`
           * decided it and `scheduleToCoachingPlan` carried it. Nothing placed
           * it, because the only row builder lived in the adapter and the
           * adapter authors no strength on composer-owned days. Power is part
           * of a strength session, so the composer places it. */
          power: {
            primerByDay: Object.fromEntries(
              weekPlan.weeklyPlan
                .map((entry) => [
                  DAY_MAP[String(entry.dayOfWeek ?? '')],
                  (entry as { powerPrimer?: unknown }).powerPrimer ?? null,
                ])
                .filter(([day, primer]) => day !== undefined && primer !== null),
            ),
            allowance: exposureContractV2?.power?.eligible === true
              ? exposureContractV2.power.plannerSelectedWeeklyBudget ?? 0
              : 0,
            phase: profile.seasonPhase,
            experienceLevel: profile.experienceLevel,
            availableEquipment: profile.equipment ?? [],
            blockId: `mini-${blockState.miniCycleNumber ?? 1}`,
          },
        }),
        adapterWorkouts,
      });
      const built = authored.workouts as Workout[];
      /* ── THE POST-GENERATION CONSTRAINT FILTER IS DELETED ───────────────
       *
       * Demolition area 1, Sam's burn-the-boats ruling 2026-08-19.
       *
       * `validateWorkoutAgainstActiveConstraints` was a REWRITE over a FINISHED
       * week: it collapsed days to Rest, deleted rows for injury and equipment,
       * and trimmed sessions to a time cap — after the composer had authored
       * and after the scheduler had chosen the days. Equipment and travel had
       * already been taken off it on 2026-08-17 (they moved to `composeWeek`'s
       * per-day kit and to `weeklySchedulerInputs.clubInputsAfterTravel`); the
       * remaining schedule kinds are the same defect wearing a narrower filter.
       *
       * ⚠ IT WAS NOT A HARMLESS DUPLICATE — measured, with a FULL commercial
       * gym and a travel fact and NO equipment change, it collapsed Tuesday and
       * Thursday to REST while they carried six of the athlete's own lifts, and
       * §18 then refused the week for training no squat, hinge, push or pull.
       *
       * THE SURVIVING OWNERS: unavailable dates and session caps belong to the
       * weekly scheduler, which chooses days; a time cap belongs to the
       * composer, which chooses content. Neither is rebuilt here — both are on
       * the rebuild list in `docs/STATUS_DEMOLITION.md`. What remains at this
       * boundary is refusal, not repair. */
      const constrained = built;
      return pinHistoryDays(exposureContractV2
        ? stampPlannerDerivedSessionProvenance({
            workouts: constrained,
            contract: exposureContractV2,
            weekStart: blockState.weekStart,
          })
        : constrained);
    };
    let workouts = buildCanonicalCandidate(sourceCoachWorkouts);
    /* ── THE WEEKLY POWER BUDGET, APPLIED BY THE AUTHORING SIDE ──────────────
     *
     * MOVE 1 of the §18 demolition (Sam, 2026-08-19): *"Power trimming → power
     * specialist."*
     *
     * This decision used to live inside `section18AcceptedWeekGateway`, which
     * meant the VALIDATOR decided how much power the week could carry and
     * stripped the excess on its way through. A week therefore left the
     * composer with more power than it was allowed to have, and only a
     * downstream boundary knew it. That is the same shape as every other defect
     * this mission is deleting: the authoring owner could not tell whether its
     * own output was what shipped.
     *
     * Applied HERE — after the candidate is authored, before §18 sees it — the
     * budget is part of what the specialist AUTHORS, and §18 receives a week
     * that already respects it. §18 then has nothing to trim, which is what
     * lets its call be cut.
     *
     * The contract is carried too, because the budget writes the week's
     * `power.plannerSelectedWeeklyBudget`, `achievedPrimerCount`, `eligible`
     * and `removalReason`. The evaluator reads those, so the numbers and the
     * rows must move together or the verdict disagrees with the content. */
    /* ⚠ **THE ALLOWANCE IS A PLACEMENT LIMIT, NOT A STRIP** (2026-08-19).
     *
     * `weeklyPowerBudget` ran here and REMOVED power rows the week exceeded its
     * allowance by. Measured the day power first reached athletes: on a 4-day
     * pre-season bodyweight week it did not merely take the third primer off
     * Thursday — `finaliseWorkoutAfterMutation` re-finalised the stripped day
     * and **DESTROYED IT ENTIRELY**, main lift included. The day went from
     * `power, main_strength:push, strength_accessory` to EMPTY, main-strength
     * exposures fell 3 -> 2, and four worlds were refused.
     *
     * It had been dormant only because no generated week had ever contained a
     * power row for it to act on. Its first live action was to delete an
     * authored strength session.
     *
     * So it is GONE, and the allowance is honoured where it belongs: the
     * composer places at most the allowance, so there is never anything to
     * strip. Nothing re-finalises an authored day to enforce a count. */
    if (exposureContractV2) {
      // ── THE GENERATED WEEK IS JUDGED, NOT REPAIRED ───────────────────────
      //
      // This was `acceptSection18Week`, which could answer a week with a
      // DIFFERENT week: a regenerate arm, a safe-fallback arm, a whole-week
      // repair search, offer placement and a safety finaliser that inserted
      // fallback rows. **That is why a composer could never tell whether its
      // week was accepted or quietly replaced**, and why acceptance depended on
      // residue the legacy builder left behind rather than on what the week
      // contained.
      //
      // Generation now answers to `GeneratedWeekContract` alone. The validator
      // accepts, refuses with typed findings, or accepts while disclosing a
      // typed gap — and it never rewrites a row. **The editing route keeps the
      // gateway unchanged**; nothing here is deleted from under an edit.
      const generatedContract = generatedWeekContractFrom(
        exposureContractV2,
        // Same week-wide answer the contract was built with, so the validator
        // and the contract cannot disagree about what the kit can reach.
        kitUnachievablePatterns(weeklyCompositionAvailability.reachableKitAcrossWeek),
      );
      const validation = validateGeneratedWeek({
        workouts,
        contract: generatedContract,
        // ── WHAT AN ANCHOR IS WORTH BEFORE IT HAS HAPPENED ─────────────────
        //
        // **Sam, 2026-08-15:** *"conditioning/sprint credit supplied by those
        // visible anchors"*.
        //
        // A club night or a fixture the athlete has not attended yet carries
        // `participation: 'unknown'` — nobody has reported anything, because the
        // week is being AUTHORED. Read literally that means no credit, so a week
        // whose high-speed running is entirely supplied by two club nights and a
        // game was refused for having no sprint in it. The app's own contract
        // then had no legal way to satisfy the minimum either: the approved
        // source forbids ADDING sprint work on a club-training week.
        //
        // The contract already records what generation knows, on the anchor
        // itself: `participationProvenance: 'derived_healthy_unrestricted'` —
        // *"we derived that this athlete is healthy and unrestricted"*. That is
        // the plan's stated assumption, and a plan is authored on it. So a
        // DERIVED-healthy anchor participates normally for the purposes of
        // judging the week we are about to hand over.
        //
        // ⚠ It is not promoted to `explicit`, and nothing here is written back.
        // `explicit` means the ATHLETE said so, and the safety boundary treats
        // it very differently; a derived assumption that laundered itself into a
        // reported fact would be the worse defect by far. The moment a real
        // participation fact exists it is not derived any more, and it wins.
        anchors: (exposureContractV2.anchors ?? []).map((anchor) => {
          // ⚠ DELEGATED, NOT RESTATED. This condition used to live here as a
          // local `derivedHealthy` boolean, and the §18 effective-week evaluator
          // — the OTHER judge of the same anchor — had never heard of it. The
          // same week this gate accepted, that one refused with
          // `unjustified_anchor_credit`, which is why no club-night athlete
          // could relaunch the app. One owner now answers for both.
          const participation = String(effectiveAnchorParticipation(anchor));
          return {
            dayOfWeek: anchor.dayOfWeek,
            participation,
            // "Was the athlete there?" — the two states that mean no.
            attended: participation !== 'did_not_participate'
              && participation !== 'unknown',
          };
        }),
      });
      if (validation.verdict === 'refused') {
        /**
         * A FORWARD ATHLETE DECISION IS NEVER VETOED BY ITS OWN WEEK.
         *
         * `weekAcceptance` documented this contract from the day it was added
         * (§18 ownership reassessment 2026-08-05, D3, approved by Sam): a
         * caller carrying out a forward athlete decision "publishes the best
         * achievable week instead of throwing", because the transaction
         * downstream owns accept-and-disclose. The option was passed by both
         * of its callers (`weekRebuild`, the temporary-source-fact scoped
         * regen) and read by NOTHING — so an athlete who said "I'm properly
         * sick" on a week whose reduced remainder missed any clause had the
         * fact rolled back and was told to try again, forever. Launch audit
         * 2026-08-25; guarded by `test:forward-decision-acceptance`.
         *
         * The findings are not swallowed: they are logged with their
         * signature here, and the §18 effective-week evaluator judges the
         * published week again downstream, where shortfalls become athlete
         * disclosures.
         */
        if (args.weekAcceptance === 'forward_decision') {
          diagnostics.push({ message: 'forward_decision publishes a contract-failing week; findings disclosed downstream', details: { signature: generatedWeekFailureSignature(validation) } });
        } else {
          throw new GeneratedWeekRefusedError(
            generatedWeekFailureSignature(validation),
            validation.findings,
          );
        }
      }
    }
    // ── THE NEED-BASED TOP-UP PASS ──
    //
    // Sam's ruling, 2026-07-30: "No defaults. Build the program; if anything is
    // lacking, add a spare optional session to make up for it." This is the only
    // place in the app that places optional accessory or mobility work into a
    // generated week — R2, R3, R4 and R5 are deleted from the allocator in the same
    // commit, so there is nothing left that places it by day.
    //
    // AND IT RUNS HERE, AFTER ACCEPTANCE, BECAUSE THE SEAM IS THE ARGUMENT. The
    // contract was satisfied before these sessions existed and is never
    // re-evaluated against them, so a top-up is INCAPABLE of affecting compliance
    // or load rather than merely checked not to.
    //
    // THAT ARGUMENT COVERS COUNTS AND NOT SHAPE, which is how this pass was
    // escaping the craft tier the gateway now runs. A top-up landing on G-1, or
    // stacking an upper session beside a lower one, is a Section 17 question and
    // arrives after the only place that asks it. `withCraftSafeTopUps` closes
    // the seam in the shape a top-up already has: an optional session that
    // introduces a craft violation is simply not added.
    const acceptedWeekBeforeTopUps = workouts;
    workouts = applyOptionalTopUps({
      workouts,
      seasonPhase: blockState.phaseClock.selectedPhase,
      athlete: {
        injuries: profile.injuries ?? [],
        equipmentTags: [...equipment.tags],
        onboardingData: profile,
      },
      microcycleId,
      weekStartISO: blockState.weekStart,
      gameDayOfWeek: gameDayOfWeekFor(workouts, profile),
      // Only days the athlete said they train, and never a day already governed as
      // history: a top-up on a pinned past day would be the app editing a day that
      // has already been.
      // Reading A, at the only place it touches placement: a mobility or injury-history
      // weakness leans the OPTIONAL needs (Sam's ruling 3). Required work is untouched.
      weakPointFocus: weakPointFocusFor(profile.biggestLimitation),
      candidateDays: topUpCandidateDays({
        profile,
        weekStart: blockState.weekStart,
        governedFromISO: boundary?.governedFromISO ?? null,
      }),
      equipmentFreeCandidateDays: equipmentFreeTopUpCandidateDays({
        weekStart: blockState.weekStart,
        governedFromISO: boundary?.governedFromISO ?? null,
      }),
    }).workouts;
    if (exposureContractV2) {
      const craftSafe = withCraftSafeTopUps({
        contract: exposureContractV2,
        weekStart: blockState.weekStart,
        profile,
        // The same boundary `topUpCandidateDays` above is already given, in the
        // same shape the gateway hands its own consumers: a top-up never lands
        // on a governed history day, so a finding there can never be one it
        // introduced.
        governableDates: new Set([0, 1, 2, 3, 4, 5, 6]
          .map((day) => isoDateForWeekday(blockState.weekStart, day))
          .filter((date) => !boundary?.governedFromISO || date >= boundary.governedFromISO)),
        base: acceptedWeekBeforeTopUps,
        placed: workouts.filter((workout) =>
          !acceptedWeekBeforeTopUps.some((accepted) => accepted.id === workout.id)),
      });
      if (craftSafe.withheld.length > 0) {
        diagnostics.push({ message: 'optional top-ups withheld by the craft tier', details: { microcycleId, withheld: craftSafe.withheld.map((workout) => `${workout.dayOfWeek}:${workout.name}`) } });
      }
      workouts = craftSafe.workouts;
    }
    // THE V1 GENERATION-TIME FALLBACK IS RETIRED (Sam, 2026-08-10: "well
    // fucking delete the old shit here?"). Contract v2 is the accepted-week
    // authority. **V1 cannot represent two valid credits stacked on one day**
    // (team training PLUS an app core block), so it UNDERCOUNTS exactly the
    // combined days the app now builds — and it was still the acceptance gate
    // whenever v2 was absent, i.e. on pre-rebuild saved programs. A week with
    // no v2 contract now regenerates rather than being accepted by a weaker
    // set of rules.
    //
    // The value is still READ here because the microcycle persists it below;
    // retiring the STORED field is a separate unit with a migration, and
    // `evaluateEffectiveWeekExposureContract` still runs at three sites in
    // postGenerationConstraintValidation — see
    // docs/V1_EXPOSURE_CONTRACT_CUT_2026-08-10.md.
    const exposureContract = weekPlan.weeklyExposureContract;

    return {
      id: microcycleId,
      programId: args.programId,
      weekNumber: blockState.weekNumber,
      startDate: dateAtNoonISO(blockState.weekStart),
      endDate: dateAtNoonISO(blockState.weekEnd),
      miniCycleNumber: blockState.miniCycleNumber,
      weekKind: effectiveWeekKind,
      deloadDoor: compiledDoseDoor ?? undefined,
      dosePolicyByDay: compiledDosePolicyByDay,
      readinessDeloadWindow: generationConstraints?.readiness?.deloaded &&
        generationConstraints.readiness.windowStartISO &&
        generationConstraints.readiness.windowEndISO
        ? {
            startISO: generationConstraints.readiness.windowStartISO,
            endISO: generationConstraints.readiness.windowEndISO,
          }
        : undefined,
      exposureContract,
      exposureContractV2,
      intensityMultiplier: blockState.intensityMultiplier,
      workouts,
      createdAt: args.authoredAtISO,
      updatedAt: args.authoredAtISO,
    };
  });
  return { microcycles, plans, selections, diagnostics };
}
