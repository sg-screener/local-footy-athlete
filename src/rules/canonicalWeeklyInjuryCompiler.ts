/** Injury facts constrain accepted sessions; they never become athlete edits. */
import type { OnboardingData, Workout } from '../types/domain';
import type { ActiveConstraint, ActiveInjuryConstraint } from '../store/coachUpdatesStore';
import { planInjuryRecomposition } from '../utils/injurySessionRecomposition';
import { resolveTapSwapEnvironment } from '../utils/tapSwapHierarchy';
import { applyExclusionsToAuthoredDay } from './exerciseExclusions';
import { compileCanonicalExerciseEditOnWorkout } from './canonicalWeeklyExerciseEditCompiler';
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
import { completeWeeklyCore, completeWeeklyLowerBodyFrontal } from './canonicalWeeklyPlaneCompletion';
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
}

/** The preview and the accepted fold execute this exact transformation. */
export function compileCanonicalInjuryStage(args: InjurySessionInput & {
  stage: ActiveInjuryConstraint;
}) {
  const { stage } = args;
  const primaryInjury = stage.bucket ? { bucket: stage.bucket, severity: stage.severity,
    triggers: stage.triggers,
    seriousSymptoms: stage.seriousSymptoms === true } : null;
  const environment = resolveTapSwapEnvironment({ date: args.dateISO, profile: args.profile,
    activeConstraints: [...args.constraints], primaryInjury });
  const visible = applyExclusionsToAuthoredDay({ workout: args.workout, dateISO: args.dateISO,
    exclusions: args.exclusions }) ?? args.workout;
  const plan = planInjuryRecomposition({ workout: visible, environment, primaryInjury,
    existingAutomaticExerciseNames: args.weekAutomaticExerciseNames });
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
        // An injury swap keeps the already-reduced dose ceiling, including
        // scheduled deload/readiness. Missing replacement dose is not 3 new sets.
        sets: Math.min(originalRow?.prescribedSets ?? 3,
          substitution.to.prescription?.sets ?? originalRow?.prescribedSets ?? 3),
        repsMin: substitution.to.prescription?.repsMin ?? 8,
        repsMax: substitution.to.prescription?.repsMax ?? 12,
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
    profile: args.profile, recordedLoads: args.recordedLoads, bodyPart: stage.bodyPart,
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
  /**
   * R-354: the first date this compile may shape. Days before it are history
   * — the source-fact fold pins them from the accepted week — and no pass in
   * here may add to them. Absent, every date is placeable (boot replays).
   */
  historyBeforeISO?: string;
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
      if (stages[index].startDate.slice(0, 10) > dateISO) continue;
      const weekExerciseNames = Object.values(workoutsByDate).flatMap(day =>
        day.exercises.map(row => row.exercise?.name ?? '').filter(Boolean));
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
          ...stages.slice(0, index + 1)] });
      workoutsByDate[dateISO] = result.workout;
      (stagesByDate[dateISO] ??= []).push(result);
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
        const frontal = completeWeeklyLowerBodyFrontal({ ...weeklyCompletionArgs, workoutsByDate });
        // One core row per week (Sam, 2026-09-03), re-answered after the injury
        // fold the same way the frontal plane is: an injury that withdrew the
        // week's core row gets a safe one back on a day not yet done.
        return completeWeeklyCore({ ...weeklyCompletionArgs, workoutsByDate: frontal.workoutsByDate }).workoutsByDate;
      })()
    : workoutsByDate;
  const contracted = Object.fromEntries(Object.entries(completed).map(([dateISO, workout]) => {
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
