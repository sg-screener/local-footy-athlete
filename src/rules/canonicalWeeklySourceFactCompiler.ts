/** Dated facts -> derived weeks. No stores, wall clock, transactions or writes.
 * Live fact acceptance and cold reconstruction supply the same accepted base,
 * fact history and generation inputs. Derived overlays are never fact history.
 */
import type { OnboardingData, WeekScopedWorkoutOverlay } from '../types/domain';
import type { CanonicalProgramCompilerInput } from './canonicalProgramCompiler';
import { compileCanonicalProgram } from './canonicalProgramCompiler';
import { compileWeekOverlay } from './canonicalWeekOverlay';
import { rebaseAcceptedEffectiveWeek, type AcceptedEffectiveWeekSurfaces } from './acceptedEffectiveWeek';
import { activeTemporarySourceFacts, composeTemporarySourceFactCompatibility, datedFatigueReportsFromFacts, isInjurySourceFact, READINESS_FACT_KINDS, temporarySourceFactId,
  type TemporarySourceFact } from './temporarySourceFact';
import { factHorizon, factHorizonCoversDate, factHorizonWeeks, firstShapedDateInWeek } from './durableFactHorizon';
import { isoDateForWeekday } from '../utils/appDate';
import { isTeamNightMoveFact, buildTeamNightMoveWeekOverlay } from './teamNightMoveDerivation';
import { activeUserRemovalConstraintsForWeek } from './canonicalWeeklyAthleteEditState';
import { compileCanonicalAthleteEditedContract, compileCanonicalFrequencyReducedContract } from './canonicalWeeklyAthleteEditCompiler';
import { semanticFingerprint } from '../utils/programSemanticSnapshot';
import type { CalendarDayType } from '../store/calendarStore';
import { compileCanonicalInjuryWeek } from './canonicalWeeklyInjuryCompiler';
import { withPlannedInjuryConditioning } from './canonicalInjuryConditioning';
import { resolveEquipmentCapabilities } from '../utils/equipmentAvailability';
import { composedRowIsLegal } from './composedRowLegality';
import { fatiguePoliciesForWeek, resolveFatigueDayPolicy } from './fatigueSequencePolicy';
import { compileCanonicalLighterDayWorkout } from './canonicalWeeklyLighterDayCompiler';

export function sourceFactRequiresCompilation(fact: TemporarySourceFact): boolean {
  if (!isInjurySourceFact(fact) && fact.factKind === 'fatigue') return true;
  const constraints = composeTemporarySourceFactCompatibility({ temporarySourceFacts: [fact] }).activeConstraints;
  return constraints.some((constraint) => constraint.type === 'injury' ||
    constraint.type === 'fatigue' || constraint.type === 'equipment' ||
    (constraint.type === 'schedule' &&
      (constraint.scheduleKind === 'time_cap' || constraint.scheduleKind === 'team_night_move')));
}

export interface CanonicalWeeklySourceFactInput {
  readonly surfaces: AcceptedEffectiveWeekSurfaces;
  readonly profile: OnboardingData;
  readonly markedDays: Readonly<Record<string, CalendarDayType>>;
  readonly facts: readonly TemporarySourceFact[];
  /** The boundary captures profile, block position, selections and earned loads. */
  readonly programsByWeek: Readonly<Record<string, CanonicalProgramCompilerInput>>;
  readonly recordedLoads: Parameters<typeof compileCanonicalInjuryWeek>[0]['recordedLoads'];
}

export function compileCanonicalSourceFactWeeks(input: CanonicalWeeklySourceFactInput): {
  weekScopedOverlays: Record<string, WeekScopedWorkoutOverlay>;
  affectedWeekStarts: string[];
  dateOverrides: AcceptedEffectiveWeekSurfaces['dateOverrides'];
  injuryStagesByDate: ReturnType<typeof compileCanonicalInjuryWeek>['stagesByDate'];
} {
  const overlays = { ...input.surfaces.weekScopedOverlays };
  const changed = new Set<string>();
  const active = activeTemporarySourceFacts(input.facts);
  // A one-day fatigue fact becomes expired at midnight but remains a factual
  // report for consecutive-calendar-day policy. Cleared/resolved facts do not.
  const fatigueHistory = input.facts.filter((fact) =>
    !isInjurySourceFact(fact) && fact.factKind === 'fatigue' && fact.status === 'expired');
  const compilationFacts = Array.from(new Map(
    [...active, ...fatigueHistory].map((fact) => [temporarySourceFactId(fact), fact]),
  ).values());
  const deriving = compilationFacts.filter(sourceFactRequiresCompilation).sort((a, b) =>
    factHorizon(a).startsFrom.localeCompare(factHorizon(b).startsFrom) ||
      a.createdAt.localeCompare(b.createdAt));
  const appliedFacts = active.filter(fact => !sourceFactRequiresCompilation(fact));
  for (const fact of deriving) {
    if (!isInjurySourceFact(fact) && fact.factKind === 'fatigue') {
      const visibleReports = datedFatigueReportsFromFacts(compilationFacts.filter((candidate) =>
        factHorizon(candidate).startsFrom <= factHorizon(fact).startsFrom));
      // "Bit tired" records a fact and nothing else. Do not mint an otherwise
      // identical week overlay: even a metadata-only workout id change can
      // disturb logging/Undo plumbing despite leaving the rows looking equal.
      if (resolveFatigueDayPolicy(visibleReports, fact.observedDate).effect === 'none') {
        appliedFacts.push(fact);
        continue;
      }
    }
    for (const weekStart of factHorizonWeeks(fact, Object.keys(input.programsByWeek))) {
      const priorCompatibility = composeTemporarySourceFactCompatibility({ temporarySourceFacts: appliedFacts });
      const world = { ...input.surfaces, ...priorCompatibility,
        temporarySourceFacts: appliedFacts, weekScopedOverlays: overlays };
      const effective = rebaseAcceptedEffectiveWeek({
        surfaces: world, weekStart, profile: input.profile, markedDays: { ...input.markedDays },
      });
      const governedFromISO = firstShapedDateInWeek(fact, weekStart);
      let overlay: WeekScopedWorkoutOverlay;
      if (isTeamNightMoveFact(fact)) {
        const result = buildTeamNightMoveWeekOverlay({ fact, weekStart,
          effectiveWorkoutsByDate: new Map(effective.visibleWorkouts.map(workout =>
            [isoDateForWeekday(weekStart, workout.dayOfWeek), workout])), now: fact.updatedAt });
        if (result.ok === false) throw new Error(`team_night_move_${result.code}`);
        overlay = result.overlay;
      } else {
        const programInput = input.programsByWeek[weekStart];
        const visibleFacts = compilationFacts.filter(candidate =>
          factHorizon(candidate).startsFrom <= factHorizon(fact).startsFrom);
        const compatibility = composeTemporarySourceFactCompatibility({ temporarySourceFacts: visibleFacts });
        const compiled = compileCanonicalProgram({
          ...programInput,
          weeks: { ...programInput.weeks,
            activeConstraints: compatibility.activeConstraints,
            temporarySourceFacts: visibleFacts,
            generationConstraints: undefined,
            // This is the already accepted fact's reduced remainder, never a
            // permissive boot of the healthy base. Its contract is disclosed
            // by the same accepted-state boundary on live and reconstruction.
            weekAcceptance: 'forward_decision',
            authoredAtISO: fact.updatedAt,
            remainderBoundary: governedFromISO > weekStart ? {
              governedFromISO,
              pinnedHistoryWorkouts: effective.visibleWorkouts.filter(workout =>
                isoDateForWeekday(weekStart, workout.dayOfWeek) < governedFromISO),
            } : null,
          },
        });
        overlay = compileWeekOverlay({ program: compiled.program, weekStart,
          anchorDate: null, reason: 'readiness_reduction', authoredAtISO: fact.updatedAt });
        if ('factKind' in fact && READINESS_FACT_KINDS.has(fact.factKind)) {
          // R-034 holds load on a readiness/illness reduction. Recompiling the
          // reduced dose skips progression, so its starting estimates are NOT
          // the accepted loads. Carry only the same lift's own accepted load;
          // new/replacement lifts keep the compiler's independently owned load.
          overlay = { ...overlay, workoutsByDate: Object.fromEntries(
            Object.entries(overlay.workoutsByDate).map(([date, workout]) => {
              const accepted = effective.visibleWorkouts.find(day =>
                isoDateForWeekday(weekStart, day.dayOfWeek) === date);
              if (!workout || !accepted) return [date, workout];
              return [date, { ...workout, exercises: workout.exercises.map(row => {
                const matches = accepted.exercises.filter(old =>
                  old.exercise?.name === row.exercise?.name &&
                  old.section18Evidence?.role === row.section18Evidence?.role);
                const own = matches.find(old => old.id === row.id)
                  ?? (matches.length === 1 ? matches[0] : undefined);
                return own ? { ...row, prescribedWeightKg: own.prescribedWeightKg } : row;
              }) }];
            }),
          ) };
        }
        if (isInjurySourceFact(fact)) {
          // Strength uses the approved injury ladder. Conditioning placement
          // remains the weekly planner's responsibility: preserving the whole
          // old workout here discarded its replacement for lost sprint/club
          // exposure while keeping the new contract that required it.
          overlay = { ...overlay, workoutsByDate: Object.fromEntries(effective.dates.map(day =>
            {
              const accepted = effective.visibleWorkouts.find(workout => workout.dayOfWeek === day.dayOfWeek);
              const planned = overlay.workoutsByDate[day.date] ?? null;
              // Explicit athlete placements/removals and fixtures take priority
              // over a fresh scheduler seat; the final injury stage still makes
              // their retained contents safe. Never resurrect a removed day.
              const athleteOwned = !!input.surfaces.dateOverrides[day.date] ||
                input.surfaces.userRemovalConstraints.some(removal => removal.status === 'active' &&
                  (removal.targetDate === day.date || removal.moveTargetDate === day.date));
              return [day.date, athleteOwned || accepted?.authoredDay?.anchor === 'game'
                ? accepted ?? null
                : accepted ? withPlannedInjuryConditioning(accepted, planned) : planned];
            })) };
        }
        const fatigueReports = datedFatigueReportsFromFacts(visibleFacts);
        if (fatigueReports.length > 0) {
          const fatigueByDate = new Map(fatiguePoliciesForWeek(fatigueReports, weekStart)
            .map((policy) => [policy.dateISO, policy]));
          overlay = { ...overlay, workoutsByDate: Object.fromEntries(
            Object.entries(overlay.workoutsByDate).map(([date, workout]) => {
              const policy = fatigueByDate.get(date);
              if (!policy || !workout || policy.effect === 'none' || policy.effect === 'deload') {
                return [date, workout];
              }
              if (policy.effect === 'rest') return [date, null];
              return [date, compileCanonicalLighterDayWorkout(workout).workout];
            }),
          ) };
        }
        const currentFatiguePolicy = !isInjurySourceFact(fact) && fact.factKind === 'fatigue'
          ? resolveFatigueDayPolicy(datedFatigueReportsFromFacts(visibleFacts), fact.observedDate)
          : null;
        overlay = { ...overlay, workoutsByDate: {
          ...(overlays[weekStart]?.workoutsByDate ?? {}),
          ...Object.fromEntries(effective.dates.filter(day => day.date < governedFromISO)
            .map(day => [day.date, effective.visibleWorkouts.find(workout =>
              workout.dayOfWeek === day.dayOfWeek) ?? null])),
          ...Object.fromEntries(Object.entries(overlay.workoutsByDate).filter(([date]) =>
            factHorizonCoversDate(fact, date) || !!(
              currentFatiguePolicy?.consecutiveTrigger &&
              currentFatiguePolicy.deloadThroughISO &&
              date >= currentFatiguePolicy.dateISO && date <= currentFatiguePolicy.deloadThroughISO
            ))),
        } };
      }
      let contract = overlay.exposureContractV2;
      if (contract) {
        const removals = activeUserRemovalConstraintsForWeek(input.surfaces.userRemovalConstraints, weekStart);
        for (let attempt = 0; attempt < 6; attempt += 1) {
          const rebased = rebaseAcceptedEffectiveWeek({
            surfaces: { ...world, weekScopedOverlays: { ...overlays, [weekStart]: { ...overlay, exposureContractV2: contract } } },
            weekStart, profile: input.profile, markedDays: { ...input.markedDays },
          });
          const next = compileCanonicalAthleteEditedContract({
            contract: rebased.evaluation.contract, workouts: rebased.visibleWorkouts,
            weekStartISO: weekStart, constraints: removals,
          });
          if (semanticFingerprint(next) === semanticFingerprint(contract)) break;
          contract = next;
        }
        const fatigueReports = datedFatigueReportsFromFacts(compilationFacts);
        const fatiguePolicies = fatiguePoliciesForWeek(fatigueReports, weekStart);
        const fatigueSourceIds = Array.from(new Set(fatiguePolicies
          .filter((policy) => policy.effect === 'rest' || policy.effect === 'lighter')
          .flatMap((policy) => policy.sourceFactIds))).sort();
        if (fatigueSourceIds.length > 0) {
          const rebased = rebaseAcceptedEffectiveWeek({
            surfaces: { ...world, weekScopedOverlays: { ...overlays, [weekStart]: { ...overlay, exposureContractV2: contract } } },
            weekStart, profile: input.profile, markedDays: { ...input.markedDays },
          });
          contract = compileCanonicalFrequencyReducedContract({
            contract,
            workouts: rebased.visibleWorkouts,
            weekStartISO: weekStart,
            identity: fatigueSourceIds.join('+'),
            reason: 'low_readiness',
            detail: `Dated fatigue policy from ${fatigueSourceIds.join(', ')}.`,
          });
        }
        overlay = { ...overlay, exposureContractV2: contract };
      }
      overlays[weekStart] = overlay;
      changed.add(weekStart);
    }
    appliedFacts.push(fact);
  }
  const dateOverrides = { ...input.surfaces.dateOverrides };
  const injuryStagesByDate: ReturnType<typeof compileCanonicalInjuryWeek>['stagesByDate'] = {};
  const constraints = composeTemporarySourceFactCompatibility({ temporarySourceFacts: input.facts }).activeConstraints;
  for (const weekStart of changed) {
    const effective = rebaseAcceptedEffectiveWeek({ surfaces: { ...input.surfaces,
      weekScopedOverlays: overlays, dateOverrides }, weekStart,
      profile: input.profile, markedDays: { ...input.markedDays } });
    // Accepted Add content is replayed above the generated overlay. Its optional
    // rows still answer to the dated kit. Shrink that authored component, never
    // refill it with new work or overwrite its healthy accepted source; Clear
    // reconstructs that source through this same compiler.
    const equipmentWorkoutsByDate = Object.fromEntries(effective.visibleWorkouts.map(workout => {
      const dateISO = isoDateForWeekday(weekStart, workout.dayOfWeek);
      const kit = resolveEquipmentCapabilities(input.profile, constraints, dateISO).tags;
      const exercises = workout.exercises.filter(row =>
        !(row.composedOptionalKind ?? workout.composedOptionalKind) ||
        composedRowIsLegal(row.exercise.name, kit));
      return [dateISO, exercises.length === workout.exercises.length ? workout : { ...workout, exercises }];
    }));
    const injuryWeek = compileCanonicalInjuryWeek({
      workoutsByDate: equipmentWorkoutsByDate,
      profile: input.profile, constraints, exclusions: input.surfaces.athleteExclusions ?? [],
      recordedLoads: input.recordedLoads,
    });
    for (const workout of effective.visibleWorkouts) {
      const dateISO = isoDateForWeekday(weekStart, workout.dayOfWeek);
      let next = injuryWeek.workoutsByDate[dateISO];
      if (next !== workout) {
        if (workout.athletePlacement?.constraintId) next = { ...next,
          sourceFactAdjustedPlacementId: workout.athletePlacement.constraintId };
        if (input.surfaces.dateOverrides[dateISO]) dateOverrides[dateISO] = next;
        else overlays[weekStart] = { ...overlays[weekStart], workoutsByDate: {
          ...overlays[weekStart].workoutsByDate, [dateISO]: next,
        } };
      }
    }
    Object.assign(injuryStagesByDate, injuryWeek.stagesByDate);
  }
  return { weekScopedOverlays: overlays, dateOverrides, injuryStagesByDate,
    affectedWeekStarts: [...changed].sort() };
}
