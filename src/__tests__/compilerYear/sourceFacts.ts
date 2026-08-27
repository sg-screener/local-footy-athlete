import { useProgramStore } from '../../store/programStore';
import { useProfileStore } from '../../store/profileStore';
import { decisionLedgerEntries } from '../../store/decisionLedgerStore';
import { pendingUndoTarget, undoLastDecision } from '../../store/undoLastDecision';
import { adjustmentMatchesDecision, clearReversibleAdjustment } from '../../store/reversibleAdjustmentTransaction';
import { executeProgramControlActionDurably } from '../../utils/programControlActions';
import { buildGuidedInjuryConstraint, type GuidedInjuryRegion } from '../../utils/guidedInjuryControl';
import { applyPlanChange } from '../../utils/planChangeProducer';
import { deriveVisibleWeekLive } from '../../utils/deriveVisibleWeek';
import { quiet, quietAsync, relaunchApp, setJourneyClock } from '../support/athleteJourney';
import { visibleSignature, signatureDifferences } from './invariants';
import { plusDays } from './catalog';
import { athleteAnswers, ARCHETYPES, YEAR_START } from './catalog';
import { coldStartThroughOnboarding } from '../support/athleteJourney';
import type { Check } from './results';
import { asyncStorageDurable, flushPendingStorageWrites } from '../../store/asyncStorageCompat';
import { completeAcceptedStateFingerprint } from '../../store/coachMutationTransaction';
import { rebaseAcceptedEffectiveWeek } from '../../rules/acceptedEffectiveWeek';
import { storedWorldSurfaces } from '../../utils/liveEvaluationSurfaces';

/** The view may hide a row, but must not invent or re-prescribe injury work. */
export function compilerOwnsVisibleInjuryRows(weekStart: string, todayISO: string): string[] {
  const state = useProgramStore.getState();
  const compiled = rebaseAcceptedEffectiveWeek({ surfaces: storedWorldSurfaces(state), weekStart,
    profile: useProfileStore.getState().onboardingData, markedDays: state.acceptedMaterialContext.markedDays });
  const differences: string[] = [];
  const prescription = (row: import('../../types/domain').WorkoutExercise) => JSON.stringify([
    row.exercise?.name, row.prescribedSets, row.prescribedRepsMin, row.prescribedRepsMax,
    row.prescribedWeightKg, row.restSeconds,
  ]);
  for (const day of deriveVisibleWeekLive(weekStart, todayISO)) {
    const raw = compiled.visibleWorkouts.find(workout => workout.dayOfWeek === new Date(`${day.date}T12:00:00`).getDay());
    for (const row of day.workout?.exercises ?? []) {
      const original = raw?.exercises.find(candidate => candidate.id === row.id);
      if (!original || prescription(original) !== prescription(row)) differences.push(`${day.date}:${row.id}`);
    }
  }
  return differences;
}

/** The guard must reject both a new display-authored row and a changed dose. */
export async function injuryRenderingMutation(): Promise<Check> {
  await quietAsync(() => coldStartThroughOnboarding({
    profile: athleteAnswers(ARCHETYPES.find(athlete => athlete.id === 'male-3-experienced-gym')!),
    installDayISO: YEAR_START,
  }));
  const constraint = buildGuidedInjuryConstraint({ region: 'lower_body', area: 'knee', severity: 7,
    severityBand: 'moderate', adjustmentLevel: 'moderate', triggers: ['running'], seriousSymptoms: false,
  }, { todayISO: YEAR_START });
  const injury = await quietAsync(() => executeProgramControlActionDurably({
    type: 'set_injury_modifier', scope: 'current_and_future', payload: { constraint },
    source: { screen: 'my_status', surface: 'status_card', initiatedBy: 'tap' },
    requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
  }, { todayISO: YEAR_START }));
  const view = require('../../utils/deriveVisibleWeek') as typeof import('../../utils/deriveVisibleWeek');
  const original = view.deriveVisibleWeekLive;
  const clean = quiet(() => compilerOwnsVisibleInjuryRows(YEAR_START, YEAR_START)).length === 0;
  const outcomes: boolean[] = [];
  for (const mutation of ['add', 'prescribe'] as const) {
    let reached = false;
    view.deriveVisibleWeekLive = (...args) => {
      const days = JSON.parse(JSON.stringify(original(...args))) as ReturnType<typeof original>;
      const workout = days.find(day => (day.workout?.exercises.length ?? 0) > 0)?.workout;
      if (workout) {
        reached = true;
        if (mutation === 'add') workout.exercises.push({ ...workout.exercises[0], id: 'injected-render-author' });
        else workout.exercises[0].prescribedSets += 1;
      }
      return days;
    };
    try {
      const differences = quiet(() => compilerOwnsVisibleInjuryRows(YEAR_START, YEAR_START));
      outcomes.push(reached && differences.length > 0);
    } finally { view.deriveVisibleWeekLive = original; }
  }
  return { id: 'injury_render_writer_mutation', ok: injury.ok && clean && outcomes.length === 2 && outcomes.every(Boolean),
    detail: `real injury=${injury.ok}, clean=${clean}, injected row and dose authors caught=${outcomes.join(',')}` };
}

/** Executes acceptance on a copy of real compiler output, including every material surface. */
export function acceptancePreservesCompilerOutput(todayISO: string): boolean {
  const state = useProgramStore.getState();
  const candidate = JSON.parse(JSON.stringify({ currentProgram: state.currentProgram,
    currentMicrocycle: state.currentMicrocycle, todayWorkout: state.todayWorkout,
    dateOverrides: state.dateOverrides, overrideContexts: state.overrideContexts,
    weekScopedOverlays: state.weekScopedOverlays, userRemovalConstraints: state.userRemovalConstraints,
  })) as Partial<import('../../store/programStore').ProgramState>;
  const before = JSON.stringify(candidate);
  const result = require('../../store/programStore').canonicaliseAcceptedStateCandidate(candidate, {
    profile: useProfileStore.getState().onboardingData,
    markedDays: state.acceptedMaterialContext.markedDays, todayISO,
  }) as typeof candidate;
  return JSON.stringify(candidate) === before &&
    Object.keys(candidate).every(key => JSON.stringify(result[key as keyof typeof result]) ===
      JSON.stringify(candidate[key as keyof typeof candidate]));
}

/** Prove the acceptance check catches a second author, rather than only matching source text. */
export async function acceptanceBoundaryMutation(): Promise<Check> {
  const boundary = require('../../store/programStore') as typeof import('../../store/programStore');
  await quietAsync(() => coldStartThroughOnboarding({
    profile: athleteAnswers(ARCHETYPES.find(athlete => athlete.id === 'male-3-experienced-gym')!),
    installDayISO: YEAR_START,
  }));
  const clean = quiet(() => acceptancePreservesCompilerOutput(YEAR_START));
  const original = boundary.canonicaliseAcceptedStateCandidate;
  let injected = false;
  boundary.canonicaliseAcceptedStateCandidate = (candidate, options) => {
    const result = original(candidate, options);
    const program = result.currentProgram;
    if (!program?.microcycles.some(week => week.workouts.some(workout => workout.exercises.length))) return result;
    injected = true;
    return { ...result, currentProgram: { ...program, microcycles: program.microcycles.map(week => ({
      ...week, workouts: week.workouts.map(workout => ({ ...workout, exercises: [] })),
    })) } };
  };
  let caught = false;
  try { caught = !quiet(() => acceptancePreservesCompilerOutput(YEAR_START)); }
  finally { boundary.canonicaliseAcceptedStateCandidate = original; }
  return { id: 'acceptance_writer_mutation', ok: clean && injected && caught,
    detail: `Real onboarding material: clean=${clean}, acceptance row erasure injected=${injected}, caught=${caught}` };
}

/** Operates on an actual accumulated athlete world; never seeds stored output. */
export async function sourceFactLifecycle(args: {
  weekStart: string; storage: Map<string, string>; upperFirst?: boolean;
}): Promise<Check[]> {
  const checks: Check[] = [];
  const check = (id: string, ok: boolean, detail?: string) => {
    checks.push({ id: `facts_${id}`, ok, detail });
    if (!ok) throw new Error(`${id}: ${detail ?? 'invariant failed'}`);
  };
  const date = plusDays(args.weekStart, 2);
  const days = () => quiet(() => deriveVisibleWeekLive(args.weekStart, date));
  const signature = () => visibleSignature(days());
  const history = () => visibleSignature(days().filter(day => day.date < date));
  const restart = async (label: string) => {
    const viewDifferences = quiet(() => compilerOwnsVisibleInjuryRows(args.weekStart, date));
    check(`${label}_compiler_owns_visible_rows`, viewDifferences.length === 0, viewDifferences.join(', '));
    check(`${label}_acceptance_preserves_material`, quiet(() => acceptancePreservesCompilerOutput(date)));
    const before = signature();
    const facts = JSON.stringify(useProgramStore.getState().acceptedMaterialContext.temporarySourceFacts);
    const ledger = JSON.stringify(decisionLedgerEntries());
    const result = await quietAsync(() => relaunchApp({ storage: args.storage, todayISO: date }));
    check(`${label}_restart`, result.ok && signature() === before, result.error);
    check(`${label}_facts`, JSON.stringify(useProgramStore.getState().acceptedMaterialContext.temporarySourceFacts) === facts);
    check(`${label}_ledger`, JSON.stringify(decisionLedgerEntries()) === ledger);
  };
  const report = async (region: GuidedInjuryRegion, area: string, severity: number) => {
    const constraint = buildGuidedInjuryConstraint({ region, area, severity,
      severityBand: severity >= 8 ? 'avoid' : 'moderate',
      adjustmentLevel: severity >= 8 ? 'training_paused' : 'moderate',
      triggers: ['running'], seriousSymptoms: false }, { todayISO: date });
    const result = await quietAsync(() => executeProgramControlActionDurably({
      type: 'set_injury_modifier',
      source: { screen: 'my_status', surface: 'status_card', initiatedBy: 'tap' },
      scope: 'current_and_future', payload: { constraint },
      requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
    }, { todayISO: date }));
    check(`report_${area}_${severity}`, result.ok && !!result.createdModifierIds?.[0], result.message);
    return result.createdModifierIds![0];
  };
  const resolve = async (episodeId: string) => {
    const result = await quietAsync(() => executeProgramControlActionDurably({
      type: 'clear_injury_modifier',
      source: { screen: 'my_status', surface: 'status_card', initiatedBy: 'tap' },
      scope: 'current_and_future', payload: { episodeId },
      requiresRebuild: false, createsActiveModifier: false, oneOffOnly: false,
    }, { todayISO: date }));
    check('resolve', result.ok, result.message);
  };
  try {
    setJourneyClock(date);
    const original = signature();
    const target = days().find(day => day.date >= date && day.source !== 'game' && day.workout?.exercises.length);
    check('edit_coordinate', !!target);
    const teamDay = (useProfileStore.getState().onboardingData.teamTrainingDays ?? []).includes(
      ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][target!.dayOfWeek] as never);
    const edit = quiet(() => applyPlanChange({
      change: { kind: 'remove_session', date: target!.date, scope: teamDay ? 'strength' : 'whole_day' },
      visibleWeek: days(), todayISO: date, applyOverride: () => undefined,
    }));
    check('prior_edit', edit.ok, edit.message);
    const healthy = signature();
    const past = history();
    const first = args.upperFirst ? ['upper_body', 'shoulder'] as const : ['lower_body', 'knee'] as const;
    const second = args.upperFirst ? ['lower_body', 'knee'] as const : ['upper_body', 'shoulder'] as const;
    const firstId = await report(first[0], first[1], 7);
    check('history_unchanged', history() === past, signatureDifferences(past, history()).join(' | '));
    await restart('active');
    const updatedId = await report(first[0], first[1], 9);
    check('update_identity', updatedId === firstId);
    await restart('updated');
    const improvingId = await report(first[0], first[1], 3);
    check('improving_identity', improvingId === firstId);
    await restart('improving');
    await report(first[0], first[1], 7);
    const secondId = await report(second[0], second[1], 7);
    check('overlap_identity', secondId !== firstId);
    await restart('overlap');
    await resolve(firstId);
    check('independent_resolution', useProgramStore.getState().acceptedMaterialContext.injuryEpisodes.some(
      episode => episode.episodeId === secondId && episode.status !== 'resolved'));
    await restart('one_remaining');
    await resolve(secondId);
    check('healthy_restored', signature() === healthy);
    await restart('resolved');
    const resolvedHistory = JSON.stringify(useProgramStore.getState().acceptedMaterialContext.temporarySourceFacts);
    const targetEntry = pendingUndoTarget();
    for (const key of ['program-store', 'decision-ledger-store', 'athlete-preferences-store']) {
      await flushPendingStorageWrites();
      const beforeMemory = completeAcceptedStateFingerprint();
      const storageKeys = ['program-store', 'decision-ledger-store', 'athlete-preferences-store',
        'calendar-storage', 'profile-store', 'coach-updates', 'readiness-store', 'coach-preferences-store'];
      const beforeDisk = await Promise.all(storageKeys.map(name => asyncStorageDurable.getItem(name)));
      const originalWrite = asyncStorageDurable.setItem;
      let injected = false;
      asyncStorageDurable.setItem = async (name, value) => {
        if (name === key && !injected) { injected = true; throw new Error(`injected_undo_write_failure:${key}`); }
        return originalWrite(name, value);
      };
      let failedUndo: Awaited<ReturnType<typeof undoLastDecision>>;
      try { failedUndo = await quietAsync(() => undoLastDecision()); }
      finally { asyncStorageDurable.setItem = originalWrite; }
      const afterDisk = await Promise.all(storageKeys.map(name => asyncStorageDurable.getItem(name)));
      check(`undo_failure_${key}`, injected && failedUndo!.outcome === 'refused' &&
        completeAcceptedStateFingerprint() === beforeMemory &&
        JSON.stringify(beforeDisk) === JSON.stringify(afterDisk) && pendingUndoTarget()?.id === targetEntry?.id);
    }
    const adjustment = useProgramStore.getState().reversibleAdjustmentLedger.adjustments.find(record =>
      record.status === 'active' && !!targetEntry && adjustmentMatchesDecision(record, targetEntry));
    if (args.upperFirst) check('clear_exact_decision_reached', !!adjustment);
    const undo = args.upperFirst
      ? await quietAsync(() => clearReversibleAdjustment(adjustment!.id, useProgramStore.getState().acceptedMaterialContext.revision))
      : await quietAsync(() => undoLastDecision());
    check('undo_edit_only', ['undone', 'recomposed'].includes(undo.outcome) && signature() === original &&
      JSON.stringify(useProgramStore.getState().acceptedMaterialContext.temporarySourceFacts) === resolvedHistory);
    await restart('undo');
  } catch (error) {
    checks.push({ id: 'facts_lifecycle_complete', ok: false,
      detail: error instanceof Error ? error.message : String(error) });
  }
  return checks;
}

/** A real fact must not alter an earlier day; prove the gate detects that. */
export async function sourceFactCompilerMutation(storage: Map<string, string>): Promise<Check> {
  const compiler = require('../../rules/canonicalWeeklySourceFactCompiler') as typeof import('../../rules/canonicalWeeklySourceFactCompiler');
  const original = compiler.compileCanonicalSourceFactWeeks;
  const profile = athleteAnswers(ARCHETYPES.find(athlete => athlete.id === 'female-4-experienced-gym')!);
  await quietAsync(() => coldStartThroughOnboarding({ profile, installDayISO: YEAR_START }));
  const clean = await sourceFactLifecycle({ weekStart: YEAR_START, storage });
  await quietAsync(() => coldStartThroughOnboarding({ profile, installDayISO: YEAR_START }));
  let injected = false;
  compiler.compileCanonicalSourceFactWeeks = input => {
    const output = original(input);
    if (injected || !input.facts.some(fact => 'episodeId' in fact && fact.status === 'active')) return output;
    const overlay = output.weekScopedOverlays[YEAR_START];
    const prior = Object.keys(overlay?.workoutsByDate ?? {}).find(date =>
      date < plusDays(YEAR_START, 2) && overlay.workoutsByDate[date]?.exercises.length);
    if (!prior) return output;
    injected = true;
    return { ...output, weekScopedOverlays: { ...output.weekScopedOverlays,
      [YEAR_START]: { ...overlay, workoutsByDate: { ...overlay.workoutsByDate, [prior]: null } } } };
  };
  let mutant: Check[] = [];
  try { mutant = await sourceFactLifecycle({ weekStart: YEAR_START, storage }); }
  finally { compiler.compileCanonicalSourceFactWeeks = original; }
  const caught = mutant.some(check => !check.ok &&
    (check.id === 'facts_history_unchanged' || check.id.startsWith('facts_report_')));
  return { id: 'source_fact_history_mutation', ok: clean.length > 0 && clean.every(check => check.ok) && injected && caught,
    detail: `Real onboarding/fact journey: clean=${clean.every(check => check.ok)}, prior-day deletion injected=${injected}, caught=${caught}` };
}
