import type { CanonicalProgramCompilerInput, compileCanonicalProgram } from '../../rules/canonicalProgramCompiler';
import { progressedFromOwnHistory, smallestPracticalIncrementKg } from '../../rules/blockBoundaryProgression';
import { isoDateForWeekday } from '../../utils/appDate';
import type { Check } from './results';
import { coldStartThroughOnboarding, followTheWeek, quiet, quietAsync, recordDay, rolloverIfDue, setJourneyClock } from '../support/athleteJourney';
import { ARCHETYPES, athleteAnswers, YEAR_START, plusDays } from './catalog';

const rowsModule = require('../../rules/materialiseComposedWeek') as typeof import('../../rules/materialiseComposedWeek');
const loadsModule = require('../../rules/blockBoundaryProgression') as typeof import('../../rules/blockBoundaryProgression');

export interface DoseReceipt {
  kind: 'deload_sets' | 'progressed_load' | 'held_load';
  date: string; rowId: string; exercise: string;
  before: number; expected: number; actual: number | null;
}
const equal = (a: number | null | undefined, b: number) => typeof a === 'number' && Math.abs(a - b) < 0.000001;

/** Observe arithmetic on real compiler inputs/returns. Expectations for the
 * halving and addition are independent of the implementation under test.
 * Selection and eligibility remain product-owned; their literal-policy probes
 * live in the promoted deload/load-authority suites, not a second oracle here.
 */
export function observeProgramDose(input: CanonicalProgramCompilerInput, compile: typeof compileCanonicalProgram) {
  const receipts: DoseReceipt[] = [];
  const errors: string[] = [];
  const originalRows = rowsModule.materialiseComposedWeek;
  const originalDecide = loadsModule.decideBlockBoundaryLoads;
  const originalApply = loadsModule.applyBlockBoundaryProgression;
  let materialisations = 0;
  let loadApplications = 0;
  rowsModule.materialiseComposedWeek = (week, context) => {
    materialisations++;
    const workouts = originalRows(week, context);
    for (const day of week.days) {
      if (!context.deloadPolicyForDay?.(day.dayOfWeek)) continue;
      const date = isoDateForWeekday(context.weekStartISO, day.dayOfWeek);
      const workout = workouts.find(w => w.dayOfWeek === day.dayOfWeek);
      for (const source of day.rows.filter(row => row.role === 'main_strength')) {
        const row = workout?.exercises.find(r => r.section18Evidence?.role === 'main_strength' &&
          r.section18Evidence?.slot === source.slot && r.exercise.name === source.identity);
        const expected = Math.max(1, Math.round(source.sets / 2));
        const actual = row?.prescribedSets ?? null;
        receipts.push({ kind: 'deload_sets', date, rowId: row?.id ?? `missing:${source.identity}`,
          exercise: source.identity, before: source.sets, expected, actual });
        if (!equal(actual, expected)) errors.push(`${date}/${source.identity}: deload ${source.sets} sets expected ${expected}, got ${actual}`);
      }
    }
    return workouts;
  };
  loadsModule.decideBlockBoundaryLoads = args => {
    const decisions = originalDecide(args);
    for (const decision of decisions) {
      const recorded = args.history.lastRecordedLoadByExercise[decision.exerciseName];
      if (typeof recorded !== 'number') continue;
      const progresses = progressedFromOwnHistory({ exerciseName: decision.exerciseName, history: args.history });
      const increment = progresses ? smallestPracticalIncrementKg(decision.exerciseName, recorded) : 0;
      const expected = recorded + (increment ?? 0);
      if (decision.previousLoadKg !== recorded || !equal(decision.nextLoadKg, expected) ||
          decision.kind !== (progresses ? 'history_progressed' : 'history_held')) {
        errors.push(`${decision.exerciseName}: recorded ${recorded} + ${increment} expected ${expected}, got ${decision.nextLoadKg}/${decision.kind}`);
      }
    }
    return decisions;
  };
  loadsModule.applyBlockBoundaryProgression = args => {
    loadApplications++;
    const workouts = originalApply(args);
    for (const workout of workouts) {
      // A decision can share an exercise with a standalone mobility session.
      // Only strength-bearing workout types belong to this load application;
      // an unloaded recovery row is not a failed strength-load prescription.
      if (workout.workoutType !== 'Strength' && workout.workoutType !== 'Mixed' &&
          workout.workoutType !== 'Team Training') continue;
      for (const row of workout.exercises) {
        const decision = args.decisions.find(d => d.exerciseName === row.exercise.name);
        if (!decision || decision.previousLoadKg === null ||
            (decision.kind !== 'history_progressed' && decision.kind !== 'history_held')) continue;
        const expected = decision.previousLoadKg + (decision.kind === 'history_progressed' ? decision.incrementKg ?? 0 : 0);
        const actual = row.prescribedWeightKg ?? null;
        receipts.push({ kind: decision.kind === 'history_progressed' ? 'progressed_load' : 'held_load',
          date: '', rowId: row.id, exercise: row.exercise.name, before: decision.previousLoadKg, expected, actual });
        if (!equal(actual, expected)) errors.push(`${row.id}: applied load expected ${expected}, got ${actual}`);
      }
    }
    return workouts;
  };
  try {
    const output = compile(input);
    // The compiler must retain the numeric result, not merely invoke its owner.
    for (const receipt of receipts) {
      const found = output.program.microcycles.flatMap(week => week.workouts.flatMap(workout =>
        workout.exercises.filter(row => row.id === receipt.rowId && row.exercise.name === receipt.exercise)
          .map(row => ({ row, date: isoDateForWeekday(week.startDate.slice(0, 10), workout.dayOfWeek) }))));
      if (!found.length) continue; // Exclusion/conservation is checked by finalRows.
      // Adapter row IDs are scoped to a week, not a whole program. Deload has
      // an exact date; a boundary load belongs to that exact exercise across
      // the block. Check EVERY matching placement, never another lift that
      // happens to reuse the adapter ID in a later week.
      const exactDate = receipt.date;
      for (const { row, date } of found) {
        if (exactDate && date !== exactDate) continue;
        if (input.weeks.remainderBoundary && date < input.weeks.remainderBoundary.governedFromISO) continue;
        const actual = receipt.kind === 'deload_sets' ? row.prescribedSets : row.prescribedWeightKg;
        if (!equal(actual, receipt.expected)) errors.push(`${date}/${receipt.rowId}/${receipt.exercise}: final ${receipt.kind} expected ${receipt.expected}, got ${actual}`);
        receipt.date = date;
        receipt.actual = actual ?? null;
      }
    }
    const checks: Check[] = [{ id: 'dose_arithmetic', ok: materialisations > 0 &&
      (input.progression.blockNumber <= 1 || loadApplications > 0) && errors.length === 0,
      detail: errors.length ? errors.join(' | ') : `${materialisations} materialiser calls, ${loadApplications} load applications, ${receipts.length} numeric row observations` }];
    return { output, checks, receipts };
  } finally {
    rowsModule.materialiseComposedWeek = originalRows;
    loadsModule.decideBlockBoundaryLoads = originalDecide;
    loadsModule.applyBlockBoundaryProgression = originalApply;
  }
}

/** Counts use distinct instruction identities; repeated compiler calls are not
 * additional prescribed exercises. Keep before/expected/actual for auditability.
 */
export function distinctDoseReceipts(receipts: readonly DoseReceipt[]): DoseReceipt[] {
  return [...new Map(receipts.map(r => [JSON.stringify(r), r])).values()];
}

/** In-memory mutations of real production arithmetic. Nothing edits source or
 * accepted athlete state: all mutants compile an input captured at a real earned
 * block rollover after onboarding and four weeks of recorded training.
 */
export async function doseArithmeticMutations(): Promise<Check[]> {
  const compiler = require('../../rules/canonicalProgramCompiler') as typeof import('../../rules/canonicalProgramCompiler');
  const deload = require('../../rules/deloadWeekRules') as typeof import('../../rules/deloadWeekRules');
  const original = compiler.compileCanonicalProgram;
  let captured: CanonicalProgramCompilerInput | undefined;
  compiler.compileCanonicalProgram = input => {
    if (input.progression.blockNumber > 1) captured = input;
    return original(input);
  };
  try {
    const installed = await quietAsync(() => coldStartThroughOnboarding({
      profile: athleteAnswers(ARCHETYPES.find(a => a.id === 'male-3-experienced-gym')!), installDayISO: YEAR_START,
    }));
    if (installed.onboardingRefusal) throw new Error(installed.onboardingRefusal);
    for (let week = 0; week < 4; week++) {
      quiet(() => followTheWeek(plusDays(YEAR_START, week * 7)));
      for (let day = 0; day < 7; day++) {
        const date = plusDays(YEAR_START, week * 7 + day);
        setJourneyClock(date);
        const logged = await quietAsync(() => recordDay(date, { record: true, completion: 'full',
          feeling: 'good', soreness: 'none', difficulty: 7, logWeights: true, conditioningRpe: 6 }));
        if (logged.result !== 'recorded' && (logged.result !== 'no_session' || logged.detail !== null)) {
          throw new Error(`Dose control logging failed: ${JSON.stringify(logged)}`);
        }
      }
    }
    setJourneyClock(plusDays(YEAR_START, 28));
    const rolled = quiet(() => rolloverIfDue(plusDays(YEAR_START, 28)));
    if (rolled.refusal) throw new Error(rolled.refusal);
  } finally { compiler.compileCanonicalProgram = original; }
  if (!captured) throw new Error('Dose control did not reach a real block-two compilation');
  const input = captured;
  const control = quiet(() => observeProgramDose(input, original));
  const clean = control.checks.every(c => c.ok);
  const positive = control.receipts.some(r => r.kind === 'progressed_load' && r.actual! > r.before);
  const halved = control.receipts.some(r => r.kind === 'deload_sets' && r.actual! < r.before);
  const decide = loadsModule.decideBlockBoundaryLoads;
  let progressionInjected = false;
  let progressionCaught = false;
  loadsModule.decideBlockBoundaryLoads = args => decide(args).map(decision => {
    if (decision.kind !== 'history_progressed') return decision;
    progressionInjected = true;
    return { ...decision, nextLoadKg: decision.previousLoadKg };
  });
  try { progressionCaught = quiet(() => observeProgramDose(input, original)).checks.some(c => !c.ok); }
  finally { loadsModule.decideBlockBoundaryLoads = decide; }
  const law = deload.DELOAD_LAW as { mainLiftSetMultiplier: number };
  const multiplier = law.mainLiftSetMultiplier;
  let deloadCaught = false;
  law.mainLiftSetMultiplier = 1;
  try { deloadCaught = quiet(() => observeProgramDose(input, original)).checks.some(c => !c.ok); }
  finally { law.mainLiftSetMultiplier = multiplier; }
  const restored = quiet(() => observeProgramDose(input, original)).checks.every(c => c.ok);
  return [
    { id: 'progression_arithmetic_mutation', ok: clean && positive && progressionInjected && progressionCaught && restored,
      detail: `actual recorded-history control=${clean}, earned increase reached=${positive}; zero-increase injected=${progressionInjected}, caught=${progressionCaught}; restored=${restored}` },
    { id: 'deload_arithmetic_mutation', ok: clean && halved && deloadCaught && restored,
      detail: `actual scheduled-dose control=${clean}, reduced sets reached=${halved}; mainLiftSetMultiplier=1 caught=${deloadCaught}; restored=${restored}` },
  ];
}
