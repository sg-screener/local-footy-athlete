import type { CanonicalProgramCompilerInput, compileCanonicalProgram } from '../../rules/canonicalProgramCompiler';
import type { Workout } from '../../types/domain';
import { applyExclusionsToAuthoredWeek } from '../../rules/exerciseExclusions';
import { isoDateForWeekday } from '../../utils/appDate';
import { semanticFingerprint } from '../../utils/programSemanticSnapshot';
import type { Check } from './results';

const rowsModule = require('../../rules/materialiseComposedWeek') as typeof import('../../rules/materialiseComposedWeek');
const adapterModule = require('../../data/defaultProgram') as typeof import('../../data/defaultProgram');
type Output = ReturnType<typeof compileCanonicalProgram>;
interface AuthoredRows { weekStart: string; workouts: Workout[]; }

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
  let expectedRows = 0;
  for (const source of sources) {
    const retained = applyExclusionsToAuthoredWeek({ workouts: source.workouts,
      weekStart: source.weekStart, exclusions: input.exclusions });
    const week = output.program.microcycles.find((w) => w.startDate.slice(0, 10) === source.weekStart);
    for (const workout of retained) {
      const date = isoDateForWeekday(source.weekStart, workout.dayOfWeek);
      if (input.weeks.remainderBoundary && date < input.weeks.remainderBoundary.governedFromISO) continue;
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
    { id: 'final_rows_observed', ok: sources.length > 0 && expectedRows > 0,
      detail: `${expectedRows} specialist-authored rows across ${sources.length} observed specialist calls` },
    { id: 'final_rows_conserved', ok: missing.length === 0, detail: missing.join(',') },
    { id: 'final_week_identity', ok: output.program.microcycles.length === output.plans.length &&
      new Set(output.program.microcycles.map((w) => w.startDate)).size === output.plans.length },
  ];
}

/** Runtime observation: the real composer and adapter run, not synthetic rows. */
export function observeFinalRows(input: CanonicalProgramCompilerInput, compile: typeof compileCanonicalProgram) {
  const sources: AuthoredRows[] = [];
  const originalRows = rowsModule.materialiseComposedWeek;
  const originalAdapter = adapterModule.buildWorkoutsFromCoach;
  rowsModule.materialiseComposedWeek = (week, context) => {
    const workouts = originalRows(week, context);
    sources.push({ weekStart: context.weekStartISO, workouts: JSON.parse(JSON.stringify(workouts)) });
    return workouts;
  };
  adapterModule.buildWorkoutsFromCoach = (...args) => {
    const workouts = originalAdapter(...args);
    if (args[4]?.weekStartISO) sources.push({ weekStart: args[4].weekStartISO,
      workouts: JSON.parse(JSON.stringify(workouts.map((w) => ({ ...w, exercises: w.exercises.filter((r) =>
        r.section18Evidence?.role === 'conditioning') })))) });
    return workouts;
  };
  const before = semanticFingerprint(input);
  try {
    const output = compile(input);
    return { output, sources, checks: [
      { id: 'final_input_immutable', ok: before === semanticFingerprint(input) },
      ...finalRowChecks(input, output, sources),
    ] };
  } finally {
    rowsModule.materialiseComposedWeek = originalRows;
    adapterModule.buildWorkoutsFromCoach = originalAdapter;
  }
}
