import { applyRunningReturn } from '../../rules/runningReturn';
import type { CanonicalProgramCompilerInput, compileCanonicalProgram } from '../../rules/canonicalProgramCompiler';
import type { Workout } from '../../types/domain';
import { applyExclusionsToAuthoredWeek } from '../../rules/exerciseExclusions';
import { isoDateForWeekday } from '../../utils/appDate';
import { semanticFingerprint } from '../../utils/programSemanticSnapshot';
import type { Check } from './results';
import { resolveTemplateByName } from '../../rules/conditioningSelection';

const rowsModule = require('../../rules/materialiseComposedWeek') as typeof import('../../rules/materialiseComposedWeek');
const adapterModule = require('../../data/defaultProgram') as typeof import('../../data/defaultProgram');
import { observeStrengthPlacementScope } from './placementObservation';
type Output = ReturnType<typeof compileCanonicalProgram>;
interface AuthoredRows { weekStart: string; producer: 'strength' | 'conditioning'; workouts: Workout[]; }

// Timestamps are audit metadata, not training instructions. This deliberately
// measures semantic determinism, not transitive clock-purity of legacy helpers.
export const finalProgramSignature = (value: unknown): string => semanticFingerprint(
  JSON.parse(JSON.stringify(value, (key, item) => key === 'createdAt' || key === 'updatedAt' ? undefined : item)),
);

/** Compare actual specialist-authored rows with the complete compiler return.
 * Exclusions and pinned history are explicit inputs, not excuses for missing rows.
 * Dose progression may change sets/load; identity, day and semantic role may not.
 */
export function finalRowChecks(input: CanonicalProgramCompilerInput, output: Output, sources: AuthoredRows[]): Check[] {
  const missing: string[] = [];
  const changedIntent: string[] = [];
  const missingMode = output.program.microcycles.flatMap(week => week.workouts.flatMap(workout =>
    (workout.conditioningBlock?.options ?? []).filter(option => resolveTemplateByName(option.title) && !option.modality)
      .map(option => `${week.startDate}/${workout.dayOfWeek}/${option.title}`)));
  let expectedRows = 0;
  for (const source of sources) {
    const retained = applyExclusionsToAuthoredWeek({ workouts: source.workouts,
      weekStart: source.weekStart, exclusions: input.exclusions });
    const week = output.program.microcycles.find((w) => w.startDate.slice(0, 10) === source.weekStart);
    for (const authored of retained) {
      const final=week?.workouts.find(candidate=>candidate.dayOfWeek===authored.dayOfWeek);
      const workout=applyRunningReturn(authored,isoDateForWeekday(source.weekStart,authored.dayOfWeek),final?.runningReturnStage??null);
      const date = isoDateForWeekday(source.weekStart, workout.dayOfWeek);
      if (input.weeks.remainderBoundary && date < input.weeks.remainderBoundary.governedFromISO) continue;
      if (source.producer === 'strength' && workout.exercises.length > 0) {
        const finalWorkout = week?.workouts.find(candidate => candidate.dayOfWeek === workout.dayOfWeek);
        if (semanticFingerprint(finalWorkout?.strengthIntent) !== semanticFingerprint(workout.strengthIntent)) {
          changedIntent.push(date);
        }
      }
      for (const row of workout.exercises) {
        expectedRows++;
        const matches = week?.workouts.flatMap((w) => w.exercises
          .filter((r) => r.id === row.id).map((r) => ({ day: w.dayOfWeek, row: r }))) ?? [];
        if (matches.length !== 1 || matches[0].day !== workout.dayOfWeek ||
          matches[0].row.exerciseId !== row.exerciseId ||
          semanticFingerprint(matches[0].row.section18Evidence) !== semanticFingerprint(row.section18Evidence)) {
          missing.push(`${source.weekStart}/${workout.dayOfWeek}/${row.id}`);
        }
      }
    }
  }
  return [
    // This invocation can legitimately prescribe zero remaining rows: for
    // example a midweek injury with no safe movements on the athlete's kit.
    // Liveness here is observing the actual specialists, not demanding unsafe
    // work. The mandatory real_compiler_mutation separately requires a healthy
    // nonempty row to be removed and detected; an empty author cannot pass it.
    { id: 'final_rows_observed', ok: output.program.microcycles.length > 0 &&
      output.program.microcycles.every(week => ['strength', 'conditioning'].every(producer =>
        sources.some(source => source.weekStart === week.startDate.slice(0, 10) && source.producer === producer))),
      detail: `${expectedRows} specialist-authored rows across ${sources.length} observed specialist calls`
        + (expectedRows ? '' : JSON.stringify(output.program.microcycles.map(week => ({
          start: week.startDate, paused: week.exposureContractV2?.safety.trainingPaused,
          strength: week.exposureContractV2?.mainStrength.exposure.plannerSelectedTarget,
          conditioning: week.exposureContractV2?.conditioning.core.plannerSelectedTarget,
          patterns: week.exposureContractV2?.strengthPatterns.prohibitedPatterns,
        })))) },
    { id: 'final_rows_conserved', ok: missing.length === 0, detail: missing.join(',') },
    { id: 'final_strength_intent_conserved', ok: changedIntent.length === 0, detail: changedIntent.join(',') },
    { id: 'final_authored_conditioning_modality', ok: missingMode.length === 0, detail: missingMode.join(',') },
    { id: 'final_week_identity', ok: output.program.microcycles.length === output.plans.length &&
      new Set(output.program.microcycles.map((w) => w.startDate)).size === output.plans.length },
  ];
}

/** Runtime observation: the real composer and adapter run, not synthetic rows. */
export function observeFinalRows(input: CanonicalProgramCompilerInput, compile: typeof compileCanonicalProgram) {
  const sources: AuthoredRows[] = [];
  const originalRows = rowsModule.materialiseComposedWeek;
  const originalAdapter = adapterModule.buildWorkoutsFromCoach;
  const placement = observeStrengthPlacementScope();
  let placementPreviewObserved = false;
  rowsModule.materialiseComposedWeek = (week, context) => {
    const workouts = originalRows(week, context);
    if (placement.isPreview()) placementPreviewObserved = true;
    else sources.push({ weekStart: context.weekStartISO, producer: 'strength', workouts: JSON.parse(JSON.stringify(workouts)) });
    return workouts;
  };
  adapterModule.buildWorkoutsFromCoach = (...args) => {
    const workouts = originalAdapter(...args);
    if (args[4]?.weekStartISO) sources.push({ weekStart: args[4].weekStartISO, producer: 'conditioning',
      workouts: JSON.parse(JSON.stringify(workouts.map((w) => ({ ...w, exercises: w.exercises.filter((r) =>
        r.section18Evidence?.role === 'conditioning') })))) });
    return workouts;
  };
  const before = semanticFingerprint(input);
  try {
    const output = compile(input);
    return { output, sources, placementPreviewObserved, checks: [
      { id: 'final_input_immutable', ok: before === semanticFingerprint(input) },
      ...finalRowChecks(input, output, sources),
    ] };
  } finally {
    rowsModule.materialiseComposedWeek = originalRows;
    adapterModule.buildWorkoutsFromCoach = originalAdapter;
    placement.restore();
  }
}
