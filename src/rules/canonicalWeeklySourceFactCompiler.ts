import { runningReturnStage } from './runningReturn';
import { additionOverridesInjury } from './athleteAdditionAuthority';
import { injuryWithholdsExistingRow } from './injuryExerciseRisk';
import { resolveExerciseName } from '../utils/loadEstimation';
import { resolveSeasonPhaseClock } from './seasonPhaseClock';
import { selectedTrackedLifts, TRACKED_LIFTS } from './estimatedOneRepMax';
import { resolveDoorDeloadPolicy } from './deloadWeekRules';
import { conditioningRecoveryWindowsForProgram } from './canonicalWeeklyProgressionCompiler';
import { hasMeaningfulWorkoutContent } from '../utils/workoutContent';
import { restDayReasonsForWeek } from './restDayReason';
import { activeInjuryFactsOn, isRedFlagInjury } from './injuryWithheldRows';
/** Dated facts -> derived weeks. No stores, wall clock, transactions or writes.
 * Live fact acceptance and cold reconstruction supply the same accepted base,
 * fact history and generation inputs. Derived overlays are never fact history.
 */
import { applyConstraintsToSession, applyConstraintsToTypedComponents } from '../utils/exposureEngine';
import { compileActiveExposureConstraints } from './canonicalWeeklyConstraintCompiler';
import { recordInjuryWithdrawals } from './section18SafetyPolicy';
import type { OnboardingData, WeekScopedWorkoutOverlay } from '../types/domain';
import type { CanonicalProgramCompilerInput } from './canonicalProgramCompiler';
import { compileCanonicalProgram } from './canonicalProgramCompiler';
import { compileWeekOverlay } from './canonicalWeekOverlay';
import { carryOwnAcceptedLoadsIntoWorkout } from './acceptedLoadCarry';
import { rebaseAcceptedEffectiveWeek, type AcceptedEffectiveWeekSurfaces } from './acceptedEffectiveWeek';
import { temporarySourceFactId, sourceFactsForHistoricalCompilation, composeTemporarySourceFactCompatibility, datedFatigueReportsFromFacts, isInjurySourceFact, READINESS_FACT_KINDS,
  type TemporarySourceFact } from './temporarySourceFact';
import { factHorizon, factHorizonCoversDate, factHorizonCoversWeek, factHorizonWeeks, firstShapedDateInWeek } from './durableFactHorizon';
import { isoDateForWeekday } from '../utils/appDate';
import { isTeamNightMoveFact, buildTeamNightMoveWeekOverlay } from './teamNightMoveDerivation';
import { activeUserRemovalConstraintsForWeek } from './canonicalWeeklyAthleteEditState';
import { compileCanonicalAthleteEditedContract, compileCanonicalFrequencyReducedContract } from './canonicalWeeklyAthleteEditCompiler';
import { semanticFingerprint } from '../utils/programSemanticSnapshot';
import type { CalendarDayType } from '../store/calendarStore';
import { compileCanonicalInjuryWeek } from './canonicalWeeklyInjuryCompiler';
import { withPlannedInjuryConditioning } from './canonicalInjuryConditioning';
import { resolveEquipmentCapabilities, FULL_GYM_EQUIPMENT } from '../utils/equipmentAvailability';
import { composedRowIsLegal } from './composedRowLegality';
import { fatiguePoliciesForWeek, resolveFatigueDayPolicy } from './fatigueSequencePolicy';
import { compileCanonicalLighterDayWorkout } from './canonicalWeeklyLighterDayCompiler';
import { preserveAcceptedFixtureRelativeOffer } from './fixtureRelativePlannerOffer';
import type { CanonicalWeeklyExerciseEdit } from './canonicalWeeklyExerciseEditState';

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
  /** Accepted row edits that belong after dated injury composition. */
  readonly exerciseEdits?: readonly CanonicalWeeklyExerciseEdit[];
}

export function compileCanonicalSourceFactWeeks(input: CanonicalWeeklySourceFactInput): {
  weekScopedOverlays: Record<string, WeekScopedWorkoutOverlay>;
  affectedWeekStarts: string[];
  dateOverrides: AcceptedEffectiveWeekSurfaces['dateOverrides'];
  injuryStagesByDate: ReturnType<typeof compileCanonicalInjuryWeek>['stagesByDate'];
} {
  const overlays = { ...input.surfaces.weekScopedOverlays };
  const compiledMicrocycles = new Map<string, import('../types/domain').Microcycle>();
  const changed = new Set<string>();
  const compilationFacts = sourceFactsForHistoricalCompilation(input.facts);
  const deriving = compilationFacts.filter(sourceFactRequiresCompilation).sort((a, b) =>
    factHorizon(a).startsFrom.localeCompare(factHorizon(b).startsFrom) ||
      a.createdAt.localeCompare(b.createdAt));
  const appliedFacts = compilationFacts.filter(fact => !sourceFactRequiresCompilation(fact));
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
        const compiledWeek = compiled.program.microcycles.find(week => String(week.startDate).slice(0,10) === weekStart);
        if (compiledWeek) compiledMicrocycles.set(weekStart, compiledWeek);
        overlay = compileWeekOverlay({ program: compiled.program, weekStart,
          anchorDate: null, reason: 'readiness_reduction', authoredAtISO: fact.updatedAt });
        // Fixture actions and dated source facts are independent accepted
        // decisions. The source-fact compiler starts from the recorded block,
        // so its healthy plan may still contain the block's old G-1 offer even
        // though `effective` already reflects a later fixture Move/Remove.
        // Rebase this fixture-relative class before any fact-specific merge.
        overlay = { ...overlay, workoutsByDate: Object.fromEntries(
          Object.entries(overlay.workoutsByDate).map(([date, planned]) => {
            const accepted = effective.visibleWorkouts.find(workout =>
              isoDateForWeekday(weekStart, workout.dayOfWeek) === date);
            return [date, preserveAcceptedFixtureRelativeOffer(accepted, planned) ?? null];
          }),
        ) };
        if ('factKind' in fact && READINESS_FACT_KINDS.has(fact.factKind)) {
          // R-034 holds load on a readiness/illness reduction. Recompiling the
          // reduced dose skips progression, so its starting estimates are NOT
          // the accepted loads. Carry only the same lift's own accepted load;
          // new/replacement lifts keep the compiler's independently owned load.
          // R-344: one owner for "the same lift's own accepted load", shared
          // with the fixture projection. Same-day match first, as before; a
          // lift that moved days now takes the week's one load too.
          overlay = { ...overlay, workoutsByDate: Object.fromEntries(
            Object.entries(overlay.workoutsByDate).map(([date, workout]) => {
              const accepted = effective.visibleWorkouts.find(day =>
                isoDateForWeekday(weekStart, day.dayOfWeek) === date);
              if (!workout) return [date, workout];
              return [date, carryOwnAcceptedLoadsIntoWorkout({
                rebuilt: workout, acceptedSameDay: accepted ?? null,
                acceptedWeek: effective.visibleWorkouts,
              })];
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
              // Fixture replay already compiled this dated fact into its own
              // accepted layout. Replanning that historical day here would
              // rotate its conditioning a second time after Clear.
              const fixtureBase = input.surfaces.weekScopedOverlays[weekStart];
              const fixtureHistory = !!fact.resolvedOnISO && day.date < fact.resolvedOnISO
                && (fixtureBase?.reason === 'one_off_game' || fixtureBase?.reason === 'one_off_no_game');
              // Explicit athlete placements/removals and fixtures take priority
              // over a fresh scheduler seat; the final injury stage still makes
              // their retained contents safe. Never resurrect a removed day.
              const athleteOwned = !!input.surfaces.dateOverrides[day.date] ||
                input.surfaces.userRemovalConstraints.some(removal => removal.status === 'active' &&
                  (removal.targetDate === day.date || removal.moveTargetDate === day.date));
              // A serious-symptom day stays visible and withheld, even when
              // ordinary injury planning would empty it. The existing injury
              // predicate owns this distinction across combined injuries.
              const withheld = activeInjuryFactsOn(visibleFacts, day.date).some(isRedFlagInjury);
              return [day.date, fixtureHistory || withheld || athleteOwned || accepted?.authoredDay?.anchor === 'game'
                ? accepted ?? null
                : !hasMeaningfulWorkoutContent(planned) && overlay.restDayReasonByDay?.[day.dayOfWeek] === 'injury'
                  ? null
                  : withPlannedInjuryConditioning(accepted ?? null, planned)];
            })) };
        }
        const fatigueReports = datedFatigueReportsFromFacts(visibleFacts);
        if (fatigueReports.length > 0) {
          const restDayReasonByDay = { ...overlay.restDayReasonByDay };
          const fatigueByDate = new Map(fatiguePoliciesForWeek(fatigueReports, weekStart)
            .map((policy) => [policy.dateISO, policy]));
          overlay = { ...overlay, restDayReasonByDay, workoutsByDate: Object.fromEntries(
            Object.entries(overlay.workoutsByDate).map(([date, workout]) => {
              const policy = fatigueByDate.get(date);
              if (!policy || !workout || policy.effect === 'none' || policy.effect === 'deload') {
                return [date, workout];
              }
              if (policy.effect === 'rest') {
                restDayReasonByDay[new Date(`${date}T12:00:00Z`).getUTCDay()] = 'fatigue';
                return [date, null];
              }
              return [date, compileCanonicalLighterDayWorkout(workout).workout];
            }),
          ) };
        }
        const currentFatiguePolicy = !isInjurySourceFact(fact) && fact.factKind === 'fatigue'
          ? resolveFatigueDayPolicy(datedFatigueReportsFromFacts(visibleFacts), fact.observedDate)
          : null;
        const priorReasons = restDayReasonsForWeek(input.surfaces.currentProgram, weekStart, overlays[weekStart]);
        const nextReasons = { ...priorReasons };
        for (const day of effective.dates) {
          if (day.date < governedFromISO || !factHorizonCoversDate(fact, day.date)) continue;
          delete nextReasons[day.dayOfWeek];
          const reason = overlay.restDayReasonByDay?.[day.dayOfWeek];
          if (reason) nextReasons[day.dayOfWeek] = reason;
        }
        overlay = { ...overlay, restDayReasonByDay: nextReasons, workoutsByDate: {
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
  const constraints = composeTemporarySourceFactCompatibility({ temporarySourceFacts: compilationFacts }).activeConstraints;
  // The restriction ends on recovery; the following two field weeks still
  // belong to that fact's return dose. Materialise them in the compiler too.
  for (const weekStart of Object.keys(input.programsByWeek)) {
    if (![0,1,2,3,4,5,6].some(day=>runningReturnStage({
      dateISO:isoDateForWeekday(weekStart,day),constraints})!==null)) continue;
    if (!overlays[weekStart]) {
      const effective=rebaseAcceptedEffectiveWeek({surfaces:{...input.surfaces,weekScopedOverlays:overlays,dateOverrides},
        weekStart,profile:input.profile,markedDays:{...input.markedDays}});
      const stamp=input.facts.map(fact=>fact.updatedAt).sort().at(-1)??weekStart+'T00:00:00Z';
      overlays[weekStart]={id:`running-return:${weekStart}`,weekStart,
        weekEnd:isoDateForWeekday(weekStart,0),anchorDate:null,reason:'readiness_reduction',
        exposureContractV2:effective.contract,workoutsByDate:{},createdAt:stamp,updatedAt:stamp};
    }
    changed.add(weekStart);
  }
  for (const weekStart of changed) {
    const effective = rebaseAcceptedEffectiveWeek({ surfaces: { ...input.surfaces,
      ...composeTemporarySourceFactCompatibility({ temporarySourceFacts: compilationFacts }),
      temporarySourceFacts: compilationFacts,
      weekScopedOverlays: overlays, dateOverrides }, weekStart,
      profile: input.profile, markedDays: { ...input.markedDays } });
    // Evaluate authority against the injury that would change this row. A
    // fatigue, kit, schedule or unrelated injury report is not a retraction.
    const holdsChoice = (row: import('../types/domain').WorkoutExercise, dateISO: string): boolean =>
      !!row.athleteAdditionId && !!row.additionFactVersions && deriving
        .filter(fact => factHorizonCoversDate(fact, dateISO))
        .every(fact => {
          const current = input.facts.find(candidate => temporarySourceFactId(candidate) === temporarySourceFactId(fact)) ?? fact;
          if (!isInjurySourceFact(fact)) {
            if (fact.factKind !== 'equipment' || row.additionFactVersions!.includes(semanticFingerprint(current))) return true;
            const kit = fact.mode === 'only' ? fact.equipmentTags
              : FULL_GYM_EQUIPMENT.filter(tag => !fact.equipmentTags.includes(tag));
            return composedRowIsLegal(row.exercise.name, kit);
          }
          return (isInjurySourceFact(current) && additionOverridesInjury(row, current))
            || (!fact.seriousSymptoms && (!fact.bucket || !injuryWithholdsExistingRow(
              resolveExerciseName(row.exercise.name), fact.bucket, fact.severity, fact.triggers)));
        });
    const equipmentWorkoutsByDate = Object.fromEntries(effective.visibleWorkouts.map(workout => {
      const dateISO = isoDateForWeekday(weekStart, workout.dayOfWeek);
      const kit = resolveEquipmentCapabilities(input.profile, constraints, dateISO).tags;
      const exercises = workout.exercises.filter(row => !row.athleteAdditionId && (
        !(row.composedOptionalKind ?? workout.composedOptionalKind) ||
        composedRowIsLegal(row.exercise.name, kit)));
      return [dateISO, exercises.length === workout.exercises.length ? workout : { ...workout, exercises }];
    }));
    // R-354/R-393: every dated report preserves earlier days, including fatigue,
    // illness and equipment changes. Weekly completion cannot backfill history.
    const historyBeforeISO = deriving
      .filter((fact) => factHorizonCoversWeek(fact, weekStart))
      .map((fact) => firstShapedDateInWeek(fact, weekStart))
      .sort().pop();
    const programInput = input.programsByWeek[weekStart];
    const doseWeek = compiledMicrocycles.get(weekStart) ?? effective.baseMicrocycle;
    const phase = programInput?.weeks.profile.seasonPhase ?? input.profile.seasonPhase ?? 'Off-season';
    const phaseResolution = resolveSeasonPhaseClock({ selectedPhase: phase, targetWeekStartISO: weekStart,
      persistedClock: programInput?.weeks.seasonPhaseClock });
    const recoveryWindows = programInput ? conditioningRecoveryWindowsForProgram(programInput.progression) : [];
    const programmingContextByDate = Object.fromEntries(Object.entries(equipmentWorkoutsByDate).map(([date, workout]) => [date, {
      seasonPhase: phase, offseasonSubphase: phaseResolution.offseasonSubphase,
      deloadPolicy: doseWeek?.dosePolicyByDay?.[workout.dayOfWeek]
        ?? (recoveryWindows.some(window => date >= window.startISO && date <= window.endISO)
          ? resolveDoorDeloadPolicy({ door: 'readiness', seasonPhase: phase }) : null),
      blockNumber: programInput?.weeks.blockNumber,
      blockStartISO: programInput?.weeks.blockStartISO,
      selectionHistory: programInput?.weeks.selectionHistory,
      progressedIdentities: programInput?.weeks.progressedIdentities,
      pinnedIdentities: [...(programInput?.weeks.athletePrefs?.pinned ?? []),
        ...selectedTrackedLifts(programInput?.weeks.trackedLiftChoices).map(id => TRACKED_LIFTS[id].names[0])],
    }]));
    const injuryWeek = compileCanonicalInjuryWeek({
      programmingContextByDate,
      workoutsByDate: equipmentWorkoutsByDate,
      profile: input.profile, constraints, exclusions: input.surfaces.athleteExclusions ?? [],
      recordedLoads: input.recordedLoads,
      exerciseEdits: input.exerciseEdits,
      ...(historyBeforeISO ? { historyBeforeISO } : {}),
    });
    // Athlete additions have their own accepted size. A later injury can
    // adjust that work, but restoring an automatic row must not reallocate it.
    // Run the same injury owner on that accepted addition, independently of
    // the automatic session's set/pattern budget.
    const changedAdditionWorkouts = Object.fromEntries(effective.visibleWorkouts.flatMap(workout => {
      const dateISO = isoDateForWeekday(weekStart, workout.dayOfWeek);
      const kit = resolveEquipmentCapabilities(input.profile, constraints, dateISO).tags;
      const rows = workout.exercises.filter(row => row.athleteAdditionId && !holdsChoice(row, dateISO)
        && (!(row.composedOptionalKind ?? workout.composedOptionalKind) || composedRowIsLegal(row.exercise.name, kit)));
      return rows.length ? [[dateISO, {...workout, exercises: rows}]] : [];
    }));
    const changedAdditions = Object.keys(changedAdditionWorkouts).length ? compileCanonicalInjuryWeek({
      programmingContextByDate, workoutsByDate: changedAdditionWorkouts,
      profile: input.profile, constraints, exclusions: input.surfaces.athleteExclusions ?? [],
      recordedLoads: input.recordedLoads,
      reservedExerciseNames: [...effective.visibleWorkouts.flatMap(workout => workout.exercises
        .filter(row => !row.athleteAdditionId).map(row => row.exercise.name)),
        ...(input.surfaces.athleteExclusions ?? []).map(exclusion => exclusion.exercise)],
      ...(historyBeforeISO ? {historyBeforeISO} : {}),
    }) : null;
    // Fix 1 (Sam, 2026-09-02): count the core-conditioning sessions the injury
    // withdrew outright (accepted day carried a conditioning block; the injured
    // day carries none) and record them on the week's contract as the
    // authorised reduction they are. See `recordInjuryConditioningWithdrawal`.
    let withdrawnCoreSessions = 0;
    let withdrawnMainDays = 0;
    for (const workout of effective.visibleWorkouts) {
      const dateISO = isoDateForWeekday(weekStart, workout.dayOfWeek);
      const next = injuryWeek.workoutsByDate[dateISO];
      const before = equipmentWorkoutsByDate[dateISO];
      // A core credit is a conditioning block in a core ROLE. The injury may
      // remove the block outright or turn a hard core run into easy aerobic
      // work the ledger no longer credits as core — both are withdrawals.
      const coreCredit = (candidate: typeof before): boolean =>
        (candidate?.conditioningBlock?.options.length ?? 0) > 0
        && candidate?.section18Evidence?.conditioningRole === 'core';
      // The athlete sees the day AFTER the read-time exposure filter, which
      // can withdraw a hard run the fold left in place (a day the fold already
      // adjudicated is not filtered again at read). Count what the athlete
      // sees, not what the fold wrote.
      const adjudicated = !!next?.injuryAdjustment || (next?.exercises ?? []).some((row) =>
        !!row.unavailableForInjury || (row as { substitutedFrom?: { cause?: string } }).substitutedFrom?.cause === 'injury');
      const asRead = (() => {
        if (!next || adjudicated) return next;
        try {
          const exposure = compileActiveExposureConstraints([...constraints]);
          return applyConstraintsToTypedComponents(
            applyConstraintsToSession(next, exposure).workout, exposure).workout;
        } catch {
          return next;
        }
      })();
      if (coreCredit(before) && !coreCredit(asRead)) withdrawnCoreSessions += 1;
      const mainDay = (candidate: typeof before): boolean =>
        (candidate?.exercises ?? []).some((row) => row.section18Evidence?.role === 'main_strength');
      if (mainDay(before) && !mainDay(asRead)) withdrawnMainDays += 1;
    }
    if ((withdrawnCoreSessions > 0 || withdrawnMainDays > 0) && overlays[weekStart]?.exposureContractV2) {
      overlays[weekStart] = { ...overlays[weekStart], exposureContractV2: recordInjuryWithdrawals(
        overlays[weekStart].exposureContractV2!,
        { coreConditioningSessions: withdrawnCoreSessions, mainStrengthDays: withdrawnMainDays }) };
    }
    for (const workout of effective.visibleWorkouts) {
      const dateISO = isoDateForWeekday(weekStart, workout.dayOfWeek);
      let next = injuryWeek.workoutsByDate[dateISO];
      const athleteRows = workout.exercises.filter(row => holdsChoice(row, dateISO));
      const adjustedAddition = changedAdditions?.workoutsByDate[dateISO];
      const parent = changedAdditionWorkouts[dateISO]?.exercises[0];
      const adjustedRows = (adjustedAddition?.exercises ?? []).map(row => ({...row,
        athleteAdditionId: row.athleteAdditionId ?? `${parent!.athleteAdditionId}:injury:${row.id}`,
        additionFactVersions: row.additionFactVersions ?? parent!.additionFactVersions,
        automaticSelection: undefined,
      }));
      if (athleteRows.length || adjustedRows.length) next = { ...next,
        exercises: [...next.exercises, ...athleteRows, ...adjustedRows] };
      if (changedAdditions?.stagesByDate[dateISO]?.length)
        (injuryWeek.stagesByDate[dateISO] ??= []).push(...changedAdditions.stagesByDate[dateISO]);
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
