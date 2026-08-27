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

interface InjurySessionInput {
  workout: Workout; dateISO: string; profile: OnboardingData;
  constraints: readonly ActiveConstraint[];
  exclusions: Parameters<typeof applyExclusionsToAuthoredDay>[0]['exclusions'];
  recordedLoads: ReturnType<typeof readBlockHistory>['lastRecordedLoadByExercise'];
  weekExerciseNames: readonly string[];
  otherMainStrengthPatterns?: readonly MainStrengthPattern[];
}

/** The preview and the accepted fold execute this exact transformation. */
export function compileCanonicalInjuryStage(args: InjurySessionInput & {
  stage: ActiveInjuryConstraint;
}) {
  const { stage } = args;
  const primaryInjury = stage.bucket ? { bucket: stage.bucket, severity: stage.severity,
    seriousSymptoms: stage.seriousSymptoms === true } : null;
  const environment = resolveTapSwapEnvironment({ date: args.dateISO, profile: args.profile,
    activeConstraints: [...args.constraints], primaryInjury });
  const visible = applyExclusionsToAuthoredDay({ workout: args.workout, dateISO: args.dateISO,
    exclusions: args.exclusions }) ?? args.workout;
  const plan = planInjuryRecomposition({ workout: visible, environment, primaryInjury });
  const adjustment = deriveInjurySessionAdjustment({ workout: visible, environment,
    profile: args.profile, bodyPart: stage.bodyPart,
    redFlag: isRedFlagInjurySeverity(stage.seriousSymptoms, stage.severity),
    weekExerciseNames: args.weekExerciseNames,
    otherMainStrengthPatterns: args.otherMainStrengthPatterns,
    excludedByAthlete: args.exclusions.map(entry => entry.exercise),
    pausedRowNames: plan.pausedRows, dateISO: args.dateISO });
  let workout = args.workout;
  for (const substitution of plan.substitutions) {
    if (!substitution.to.name) continue;
    const previous = workout.exercises.find(row => row.exercise?.name === substitution.from)?.substitutedFrom;
    const origin = previous?.cause === 'injury'
      ? previous.originExerciseName ?? previous.baseExerciseName : substitution.from;
    workout = compileCanonicalExerciseEditOnWorkout(workout, {
      kind: 'swap', decisionId: stage.id, occurredAt: stage.lastUpdatedAt ?? stage.startDate,
      dateISO: args.dateISO, targetName: substitution.from, targetComponentId: null,
      replacement: { name: substitution.to.name,
        sets: substitution.to.prescription?.sets ?? 3,
        repsMin: substitution.to.prescription?.repsMin ?? 8,
        repsMax: substitution.to.prescription?.repsMax ?? 12,
        weight: loadForReplacementExercise({ exerciseName: substitution.to.name,
          onboardingData: args.profile, recordedLoadByExercise: args.recordedLoads }),
      },
      substitutedFrom: { baseExerciseName: substitution.from, cause: 'injury',
        ...(origin !== substitution.from ? { originExerciseName: origin } : {}) },
    });
  }
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
    if (workout.strengthIntent) workout = { ...workout,
      strengthIntent: withEffectiveStrengthPatterns(workout.strengthIntent, workout.exercises.flatMap(row =>
        row.section18Evidence?.role === 'main_strength' && row.section18Evidence.mainStrengthPattern
          ? [row.section18Evidence.mainStrengthPattern] : [])),
    };
  }
  return { workout, plan, adjustment, constraintId: stage.id };
}

export function compileCanonicalInjuryWeek(args: Omit<InjurySessionInput, 'workout' | 'dateISO' | 'weekExerciseNames' | 'otherMainStrengthPatterns'> & {
  workoutsByDate: Readonly<Record<string, Workout>>;
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
      const otherMainStrengthPatterns = Object.entries(workoutsByDate).flatMap(([date, day]) =>
        date === dateISO ? [] : day.exercises.flatMap(row =>
          row.section18Evidence?.role === 'main_strength' && row.section18Evidence.mainStrengthPattern
            ? [row.section18Evidence.mainStrengthPattern] : []));
      const result = compileCanonicalInjuryStage({ ...args, workout, dateISO,
        weekExerciseNames, otherMainStrengthPatterns, stage: stages[index],
        constraints: [...args.constraints.filter(constraint => constraint.type !== 'injury'),
          ...stages.slice(0, index + 1)] });
      workoutsByDate[dateISO] = result.workout;
      (stagesByDate[dateISO] ??= []).push(result);
    }
  }
  return { workoutsByDate, stagesByDate };
}
