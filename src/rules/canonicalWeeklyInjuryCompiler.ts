import { runningReturnStage, applyRunningReturn } from './runningReturn';
import { reduceDemandingPrehab } from './trainingWorkload';
import { resolveWeekExclusions } from './exerciseExclusions';
import { completeWeeklySupport } from './weeklyLegCoverage';
/** Injury facts constrain accepted sessions; they never become athlete edits. */
import type { OnboardingData, Workout, WorkoutExercise } from '../types/domain';
import { POOL_REGISTRY } from '../data/exercisePools';
import { getExerciseTags } from '../data/exerciseTags';
import type { TapSwapChoice } from '../utils/tapSwapHierarchy';
import type { ActiveConstraint, ActiveInjuryConstraint } from '../store/coachUpdatesStore';
import { planInjuryRecomposition } from '../utils/injurySessionRecomposition';
import { assessTapSwapCandidateSafety, resolveTapSwapEnvironment } from '../utils/tapSwapHierarchy';
import { applyExclusionsToAuthoredDay } from './exerciseExclusions';
import { canonicalWeeklyInjuryStateFrom } from './canonicalWeeklyInjuryState';
import { buildGenerationConstraintContext } from '../utils/generationConstraints';
import { compileCanonicalExerciseEditOnWorkout, resolveCanonicalExerciseEditTarget } from './canonicalWeeklyExerciseEditCompiler';
import type { CanonicalWeeklyExerciseEdit } from './canonicalWeeklyExerciseEditState';
import { loadForReplacementExercise, type readBlockHistory } from './blockBoundaryProgression';
import { applyInjurySessionAdjustment, deriveInjurySessionAdjustment } from '../utils/injurySessionAdjustment';
import { isRedFlagInjurySeverity } from './injuryWithheldRows';
import { withSection18WorkoutEvidence } from './section18WorkoutEvidence';
import { withEffectiveStrengthPatterns, type MainStrengthPattern } from './strengthPatternContributions';
import { compileInjuryConditioning } from './canonicalInjuryConditioning';
import {
  INJURY_ADJUSTED_SESSION_NAME,
  resolveSessionDisplayName,
} from '../utils/sessionNaming';
import { workoutExerciseWasAutomaticallySelected } from './automaticWeeklyExerciseSelection';
import { completeWeeklyLowerBodyFrontal } from './canonicalWeeklyPlaneCompletion';
import { getMondayISOForDate } from '../utils/programBlockState';
import { filterConstraintsForDate } from '../utils/readinessConstraints';
import {
  withUsefulStrengthSessionContract,
  type UsefulStrengthReductionReason,
} from './minimumUsefulStrengthSession';

interface InjurySessionInput {
  workout: Workout; dateISO: string; profile: OnboardingData;
  constraints: readonly ActiveConstraint[];
  exclusions: Parameters<typeof applyExclusionsToAuthoredDay>[0]['exclusions'];
  recordedLoads: ReturnType<typeof readBlockHistory>['lastRecordedLoadByExercise'];
  weekExerciseNames: readonly string[];
  weekAutomaticExerciseNames: readonly string[];
  otherMainStrengthPatterns?: readonly MainStrengthPattern[];
  programmingContext?: import('../utils/injurySessionAdjustment').InjuryProgrammingContext;
  programmingContextByDate?: Readonly<Record<string, import('../utils/injurySessionAdjustment').InjuryProgrammingContext>>;
}

/** A replacement owns its units and cues. Only compatible strength-slot dose
 * can be inherited; a stretch is never converted to eight seconds by a swap. */
export function injuryReplacementPrescription(original: WorkoutExercise | undefined, choice: TapSwapChoice) {
  const name = choice.name ?? '';
  const pool = Object.values(POOL_REGISTRY).flat().find(row => row.name === name);
  const explicit = choice.prescription;
  const authored = pool ?? getExerciseTags(name)?.prescription;
  const prescriptionType = explicit?.prescriptionType ?? authored?.prescriptionType ?? 'reps';
  const compatible = (original?.prescriptionType ?? 'reps') === prescriptionType;
  return {
    sets: Math.min(original?.prescribedSets ?? 3, explicit?.sets ?? authored?.sets ?? original?.prescribedSets ?? 3),
    repsMin: explicit?.repsMin ?? authored?.repsMin ?? (compatible ? original?.prescribedRepsMin : undefined) ?? 8,
    repsMax: explicit?.repsMax ?? authored?.repsMax ?? (compatible ? original?.prescribedRepsMax : undefined) ?? 12,
    prescriptionType,
    perSide: explicit?.perSide ?? authored?.perSide ?? getExerciseTags(name)?.unilateral ?? false,
    restSeconds: explicit?.restSeconds ?? authored?.restSeconds ?? (compatible ? original?.restSeconds : undefined) ?? 0,
    notes: explicit?.notes ?? pool?.notes ?? '',
  };
}

/** The preview and the accepted fold execute this exact transformation. */
export function compileCanonicalInjuryStage(args: InjurySessionInput & {
  stage: ActiveInjuryConstraint;
}) {
  const { stage } = args;
  const primaryInjury = stage.bucket ? { bucket: stage.bucket, severity: stage.severity,
    triggers: stage.triggers,
    seriousSymptoms: stage.seriousSymptoms === true } : null;
  const environment = { ...resolveTapSwapEnvironment({ date: args.dateISO, profile: args.profile,
    activeConstraints: [...args.constraints], primaryInjury }), selectionRoute: 'automatic' as const };
  const visible = applyExclusionsToAuthoredDay({ workout: args.workout, dateISO: args.dateISO,
    exclusions: args.exclusions }) ?? args.workout;
  const plan = planInjuryRecomposition({ workout: visible, environment, primaryInjury,
    existingAutomaticExerciseNames: args.weekAutomaticExerciseNames,
    prohibitedMainPatterns: canonicalWeeklyInjuryStateFrom({ profile: args.profile,
      generationConstraints: buildGenerationConstraintContext({
        activeConstraints: args.constraints, todayISO: args.dateISO,
      }) }).prohibitedPatterns });
  let workout = args.workout;
  for (const substitution of plan.substitutions) {
    if (!substitution.to.name) continue;
    const originalRow = workout.exercises.find(row => row.exercise?.name === substitution.from);
    const previous = originalRow?.substitutedFrom;
    const origin = previous?.cause === 'injury'
      ? previous.originExerciseName ?? previous.baseExerciseName : substitution.from;
    workout = compileCanonicalExerciseEditOnWorkout(workout, {
      kind: 'swap', decisionId: stage.id, occurredAt: stage.lastUpdatedAt ?? stage.startDate,
      dateISO: args.dateISO, targetName: substitution.from, targetComponentId: null,
      replacement: { name: substitution.to.name,
        ...injuryReplacementPrescription(originalRow, substitution.to),
        weight: loadForReplacementExercise({ exerciseName: substitution.to.name,
          onboardingData: args.profile, recordedLoadByExercise: args.recordedLoads }),
      },
      substitutedFrom: { baseExerciseName: substitution.from, cause: 'injury',
        ...(origin !== substitution.from ? { originExerciseName: origin } : {}) },
    });
  }
  // The added block must see the ladder's actual substitutions. Planning both
  // against the original rows could independently choose Bodyweight Squat,
  // putting it on the same day twice and overstating weekly squat exposure.
  const substitutedVisible = applyExclusionsToAuthoredDay({ workout, dateISO: args.dateISO,
    exclusions: args.exclusions }) ?? workout;
  const substitutedWeekNames = [...args.weekExerciseNames];
  for (const row of visible.exercises) {
    const index = substitutedWeekNames.indexOf(row.exercise?.name ?? '');
    if (index >= 0) substitutedWeekNames.splice(index, 1);
  }
  substitutedWeekNames.push(...substitutedVisible.exercises.map(row => row.exercise?.name ?? '').filter(Boolean));
  const substitutedWeekAutomaticNames = [...args.weekAutomaticExerciseNames];
  for (const row of visible.exercises.filter(workoutExerciseWasAutomaticallySelected)) {
    const index = substitutedWeekAutomaticNames.indexOf(row.exercise?.name ?? '');
    if (index >= 0) substitutedWeekAutomaticNames.splice(index, 1);
  }
  substitutedWeekAutomaticNames.push(...substitutedVisible.exercises
    .filter(workoutExerciseWasAutomaticallySelected)
    .map(row => row.exercise?.name ?? '').filter(Boolean));
  const adjustment = deriveInjurySessionAdjustment({ workout: substitutedVisible, environment,
    profile: args.profile, programmingContext: args.programmingContextByDate?.[args.dateISO] ?? args.programmingContext, recordedLoads: args.recordedLoads, bodyPart: stage.bodyPart,
    redFlag: isRedFlagInjurySeverity(stage.seriousSymptoms, stage.severity),
    weekExerciseNames: substitutedWeekNames,
    weekAutomaticExerciseNames: substitutedWeekAutomaticNames,
    otherMainStrengthPatterns: args.otherMainStrengthPatterns,
    excludedByAthlete: args.exclusions.map(entry => entry.exercise),
    pausedRowNames: plan.pausedRows, dateISO: args.dateISO });
  workout = applyInjurySessionAdjustment({ workout, adjustment });
  // Typed speed/power/conditioning components obey the same stage. Planning
  // first preserves the original names in the review and paused-work summary.
  workout = compileInjuryConditioning({ workout, profile: args.profile, dateISO: args.dateISO,
    constraints: args.constraints });
  if (workout !== args.workout) {
    const declaredRows = new Map(workout.exercises.filter(row => row.section18Evidence)
      .map(row => [row.id, row.section18Evidence!]));
    workout = withSection18WorkoutEvidence(workout);
    // A primer's bench remains primer work after an unrelated knee change.
    // Refresh the workout envelope, but do not ask the name classifier to
    // overwrite roles already declared by the original session or injury slot.
    workout = { ...workout, exercises: workout.exercises.map(row => declaredRows.has(row.id)
      ? { ...row, section18Evidence: declaredRows.get(row.id)! } : row) };
    if (workout.strengthIntent) {
      workout = { ...workout,
        strengthIntent: withEffectiveStrengthPatterns(workout.strengthIntent, workout.exercises.flatMap(row =>
        row.section18Evidence?.role === 'main_strength' && row.section18Evidence.mainStrengthPattern
          ? [row.section18Evidence.mainStrengthPattern] : [])),
      };
      const resolvedName = resolveSessionDisplayName({
        strengthIntent: workout.strengthIntent,
        injuryAdjustment: workout.injuryAdjustment,
        exercises: workout.exercises,
        isTeamDay: workout.isTeamDay,
        tier: workout.sessionTier,
      });
      // Injury naming is the only responsibility added here. Ordinary session
      // names remain owned by their original composer and canonicaliser.
      if (resolvedName === INJURY_ADJUSTED_SESSION_NAME ||
          resolvedName.endsWith(` + ${INJURY_ADJUSTED_SESSION_NAME}`)) {
        workout = { ...workout, name: resolvedName };
      }
    }
  }
  return { workout, plan, adjustment, constraintId: stage.id };
}

export function compileCanonicalInjuryWeek(args: Omit<InjurySessionInput, 'workout' | 'dateISO' | 'weekExerciseNames' | 'weekAutomaticExerciseNames' | 'otherMainStrengthPatterns'> & {
  workoutsByDate: Readonly<Record<string, Workout>>;
  reservedExerciseNames?: readonly string[];
  /**
   * R-354: the first date new reports and weekly completion may shape.
   * Earlier days still replay injury facts already in force before this date.
   * Absent, every date is placeable (boot replays).
   */
  historyBeforeISO?: string;
  exerciseEdits?: readonly CanonicalWeeklyExerciseEdit[];
}) {
  const stages = args.constraints.filter((constraint): constraint is ActiveInjuryConstraint =>
    constraint.type === 'injury' && constraint.status === 'active' && !!constraint.bucket)
    .sort((left, right) => left.startDate.localeCompare(right.startDate) ||
      String(left.lastUpdatedAt ?? '').localeCompare(String(right.lastUpdatedAt ?? '')) ||
      left.id.localeCompare(right.id));
  const workoutsByDate = { ...args.workoutsByDate };
  const stagesByDate: Record<string, ReturnType<typeof compileCanonicalInjuryStage>[]> = {};
  for (let index = 0; index < stages.length; index += 1) {
    // Fold chronologically; later days see the additions already made to the
    // week, so a single report cannot duplicate its new compound on every day.
    for (const [dateISO, workout] of Object.entries(workoutsByDate).sort(([left], [right]) => left.localeCompare(right))) {
      if (args.historyBeforeISO && dateISO < args.historyBeforeISO && stages[index].startDate >= args.historyBeforeISO) continue;
      if (!filterConstraintsForDate([stages[index]], dateISO).length) continue;
      const weekExerciseNames = [...(args.reservedExerciseNames ?? []), ...Object.values(workoutsByDate).flatMap(day =>
        day.exercises.map(row => row.exercise?.name ?? '').filter(Boolean))];
      const weekAutomaticExerciseNames = Object.values(workoutsByDate).flatMap(day =>
        day.exercises.filter(workoutExerciseWasAutomaticallySelected)
          .map(row => row.exercise?.name ?? '').filter(Boolean));
      const otherMainStrengthPatterns = Object.entries(workoutsByDate).flatMap(([date, day]) =>
        date === dateISO ? [] : day.exercises.flatMap(row =>
          row.section18Evidence?.role === 'main_strength' && row.section18Evidence.mainStrengthPattern
            ? [row.section18Evidence.mainStrengthPattern] : []));
      const result = compileCanonicalInjuryStage({ ...args, workout, dateISO,
        weekExerciseNames, weekAutomaticExerciseNames, otherMainStrengthPatterns,
        stage: stages[index],
        constraints: [...args.constraints.filter(constraint => constraint.type !== 'injury'),
          ...filterConstraintsForDate(stages.slice(0, index + 1), dateISO)] });
      workoutsByDate[dateISO] = result.workout;
      (stagesByDate[dateISO] ??= []).push(result);
    }
  }
  /* ⚠ **A BANNED PATTERN IS BANNED WHOEVER AUTHORED THE DAY — R-377.**
   *
   * TWO THINGS BUILD A TRAINING DAY. The composer refuses to create a seat for
   * a prohibited pattern (`composeWeek`: *"safety, not kit"*). The retained
   * `defaultProgram` adapter, which builds every day the composer does not own,
   * has NEVER known prohibitions exist — zero references in that file.
   *
   * It survived only by luck: until 2026-09-04 every prohibited pattern was also
   * exercise-prohibited, so the row-level filter above removed the lift anyway.
   * `B-Stance RDL` is individually PERMITTED for an athlete whose hinge pattern
   * is banned, so it was the first lift to walk through — reaching 45
   * athlete-weeks as a main hinge on a week that forbids hinging.
   *
   * ⚠ **IT LIVES HERE, AND ONLY HERE, ON PURPOSE.** Mirroring the composer's
   * check into the adapter would be a SECOND copy of one rule — the shape that
   * caused most of that day's defects — and would still miss a third author.
   * This runs after the whole week is folded, downstream of every author, on
   * rows that carry the same `section18Evidence` the week evaluator judges by,
   * so what ships and what is judged cannot disagree.
   *
   * ⚠ **IT CAN ONLY REMOVE.** No row is added, renamed or re-dosed here, so it
   * cannot become a second programming authority. Supporting work is untouched:
   * the ban is on TRAINING that pattern as a main lift, and whether an
   * individual exercise is safe is already owned above. */
  for (const [dateISO, workout] of Object.entries(workoutsByDate)) {
    if (args.historyBeforeISO && dateISO < args.historyBeforeISO) continue;
    const datedConstraints = filterConstraintsForDate([...args.constraints], dateISO);
    const prohibitedPatterns = new Set(canonicalWeeklyInjuryStateFrom({
    profile: args.profile,
    // The SAME builder the rest of generation uses to turn this week's active
    // constraints into an injury context — never a second reading of them here.
    generationConstraints: buildGenerationConstraintContext({
      activeConstraints: datedConstraints,
      todayISO: dateISO,
    }),
  }).prohibitedPatterns);
  if (prohibitedPatterns.size > 0) {
      // R-115: serious symptoms block training while keeping the original
      // session visible. Those rows are not active main-pattern prescriptions.
      if (filterConstraintsForDate([...args.constraints], dateISO).some(constraint =>
        constraint.type === 'injury' && constraint.status === 'active'
        && isRedFlagInjurySeverity(constraint.seriousSymptoms, constraint.severity))) continue;
      const rows = workout.exercises ?? [];
      const kept = rows.filter((row) => {
        const evidence = row.section18Evidence;
        if (evidence?.role !== 'main_strength') return true;
        return !(evidence.mainStrengthPattern
          && prohibitedPatterns.has(evidence.mainStrengthPattern));
      });
      if (kept.length !== rows.length) {
        workoutsByDate[dateISO] = { ...workout, exercises: kept };
      }
    }
  }

  const dates = Object.keys(workoutsByDate).sort();
  const completed = dates.length > 0
    ? (() => {
        const weeklyCompletionArgs = {
          weekStartISO: getMondayISOForDate(dates[0]),
          profile: args.profile,
          activeConstraints: args.constraints,
          gameDates: Object.entries(workoutsByDate)
            .filter(([, workout]) => workout.workoutType === 'Game')
            .map(([date]) => date),
          placeableFromISO: args.historyBeforeISO,
        };
        const dosePolicyForDate = (date: string) =>
          (args.programmingContextByDate?.[date] ?? args.programmingContext)?.deloadPolicy ?? null;
        const frontal = completeWeeklyLowerBodyFrontal({ ...weeklyCompletionArgs, dosePolicyForDate, workoutsByDate });
        // One core row per week (Sam, 2026-09-03), re-answered after the injury
        // fold the same way the frontal plane is: an injury that withdrew the
        // week's core row gets a safe one back on a day not yet done.
        return completeWeeklySupport({ ...weeklyCompletionArgs,
          dosePolicyForDate,
          excludedExerciseNames:resolveWeekExclusions(args.exclusions,weeklyCompletionArgs.weekStartISO).wholeWeek,
          excludedExerciseNamesByDate:resolveWeekExclusions(args.exclusions,weeklyCompletionArgs.weekStartISO).byDate,
          workoutsByDate: frontal.workoutsByDate }).workoutsByDate;
      })()
    : workoutsByDate;
  const contracted = Object.fromEntries(Object.entries(completed).map(([dateISO, original]) => {
    if (args.historyBeforeISO && dateISO < args.historyBeforeISO) return [dateISO, workoutsByDate[dateISO]];
    // The dated deload policy is the same answer the completion rows consumed
    // above. A Mixed day carries no useful-strength contract, so reading only
    // the contract left a deload Friday's completed Copenhagen at full dose.
    let workout = reduceDemandingPrehab(original,(original.usefulStrengthSessionContract?.reductionReasons.some(reason=>['scheduled_deload','low_readiness','illness'].includes(reason))??false)
      || !!((args.programmingContextByDate?.[dateISO] ?? args.programmingContext)?.deloadPolicy));
    // Base edits retain their existing order. The edit compiler carries only
    // injury-era edits and unresolved targets here, after those rows exist.
    // The same ledger translation and edit compiler own both paths.
    const datedConstraints = filterConstraintsForDate([...args.constraints], dateISO);
    const environment = resolveTapSwapEnvironment({ date: dateISO, profile: args.profile,
      activeConstraints: datedConstraints });
    workout=applyRunningReturn(workout,dateISO,runningReturnStage({dateISO,constraints:args.constraints}));
    for (const edit of args.exerciseEdits ?? []) {
      if (edit.kind !== 'swap' || edit.dateISO !== dateISO) continue;
      const target = resolveCanonicalExerciseEditTarget(workout, edit);
      if (target.kind !== 'found') continue;
      if (target.row.unavailableForInjury ||
          !assessTapSwapCandidateSafety(edit.replacement.name, environment).safe) continue;
      workout = compileCanonicalExerciseEditOnWorkout(workout, edit);
    }
    const reasons = new Set<UsefulStrengthReductionReason>(
      workout.usefulStrengthSessionContract?.reductionReasons ?? [],
    );
    for (const constraint of filterConstraintsForDate([...args.constraints], dateISO)) {
      if (constraint.status !== 'active') continue;
      if (constraint.type === 'injury') reasons.add('injury');
      if (constraint.type === 'equipment') reasons.add('restricted_equipment');
      if (constraint.type === 'schedule') reasons.add('restricted_availability');
      if (constraint.type === 'fatigue') {
        reasons.add(constraint.readinessKind === 'illness' ? 'illness' : 'low_readiness');
      }
    }
    return [dateISO, withUsefulStrengthSessionContract(workout, [...reasons])];
  }));
  return { workoutsByDate: contracted, stagesByDate };
}
