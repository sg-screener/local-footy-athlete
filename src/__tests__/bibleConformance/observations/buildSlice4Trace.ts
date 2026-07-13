import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import type { SessionAllocation } from '../../../utils/coachingEngine';
import type { Workout } from '../../../types/domain';
import { buildWorkoutsFromCoach } from '../../../data/defaultProgram';
import { finaliseWorkoutAfterMutation } from '../../../utils/workoutCanonicalisation';
import { buildRepeatWeekOverlay } from '../../../utils/repeatWeek';
import { rebuildLocalWeek } from '../../../utils/weekRebuild';
import { rolloverProgramBlock } from '../../../utils/programBlockRollover';
import { applyAdjustmentEvents, applyMoveSession } from '../../../utils/applyAdjustmentEvents';
import { useProgramStore } from '../../../store/programStore';
import { useCoachUpdatesStore } from '../../../store/coachUpdatesStore';
import type {
  ConformancePathId,
  HarnessCanonicalWeekLedger,
  Slice4GoldenScenario,
  Slice4MutationId,
  Slice4PathObservation,
  Slice4ScenarioTrace,
  Slice4TraceStage,
} from '../types';
import {
  canonicalWeekLedger,
  pathExercise,
  pathPowerBlock,
  pathProgram,
  pathWorkout,
  PATH_PROFILE,
} from './buildCanonicalPathLedger';

const PERSISTENCE_MARKER = 'BIBLE_SLICE4_PERSISTENCE_RESULT ';

function observation(
  pathId: ConformancePathId,
  stage: Slice4TraceStage,
  ledger: HarnessCanonicalWeekLedger,
  runtimeMs: number,
  authorisedChanges: string[] = [],
  persistence?: Slice4PathObservation['persistence'],
): Slice4PathObservation {
  return { pathId, stage, ledger, runtimeMs, authorisedChanges, persistence };
}

function resetStore(): void {
  const memory = new Map<string, string>();
  (globalThis as any).window = (globalThis as any).window ?? {};
  (globalThis as any).window.localStorage = (globalThis as any).window.localStorage ?? {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value); },
    removeItem: (key: string) => { memory.delete(key); },
    clear: () => memory.clear(),
  };
  useProgramStore.setState({
    currentProgram: null, currentMicrocycle: null, todayWorkout: null,
    blockState: null, dateOverrides: {}, overrideContexts: {},
    weekScopedOverlays: {}, sessionFeedback: {}, weightOverrides: {},
  });
  useCoachUpdatesStore.setState((state) => ({ ...state, activeConstraints: [] }));
}

function combinedLower(id = 'path-lower', dayOfWeek = 1, withConditioning = true): Workout {
  return pathWorkout({
    id, dayOfWeek, name: 'Lower Body Strength', patterns: ['squat', 'hinge'], primary: 'squat',
    exercises: [
      pathExercise(id, 0, 'Back Squat', { weight: 100, reps: 5 }),
      pathExercise(id, 1, 'Romanian Deadlift', { weight: 90, reps: 6 }),
      pathExercise(id, 2, 'Pallof Press', { reps: 10 }),
    ],
    conditioning: withConditioning ? [{ title: 'Bike Zone 2 25min', modality: 'bike' }] : undefined,
    recoveryAddon: 'Calf and adductor reset',
  });
}

function upperPush(id = 'path-upper', dayOfWeek = 3): Workout {
  return pathWorkout({
    id, dayOfWeek, name: 'Upper Push', patterns: ['push'], primary: 'push',
    exercises: [pathExercise(id, 0, 'Bench Press', { weight: 80 }), pathExercise(id, 1, 'Overhead Press', { weight: 45 })],
  });
}

function resolvedDay(date: string, workout: Workout | null) {
  return {
    date, dayOfWeek: new Date(`${date}T12:00:00`).getDay(), short: '', isToday: false,
    workout, source: workout ? 'template' : 'none', indicator: workout?.sessionTier ?? null,
  } as any;
}

function seedProgram(workouts: Workout[]): void {
  const program = pathProgram(workouts);
  useProgramStore.getState().setCurrentProgram(program);
  useProgramStore.getState().setCurrentMicrocycle(program.microcycles[0]);
}

function generationObservations(): Slice4PathObservation[] {
  const planEntryId = 'slice4:generation:lower';
  const plan: SessionAllocation[] = [{
    dayOfWeek: 'Monday', tier: 'core', focus: 'Combined lower plus aerobic',
    isHardExposure: false, planEntryId,
    strengthPattern: 'lower_combined',
    strengthIntent: {
      archetype: 'lower', primaryPattern: 'squat',
      plannedPatterns: ['squat', 'hinge'], effectivePatterns: ['squat', 'hinge'],
    },
    strengthPatternContributions: ['squat', 'hinge'],
    hasCombinedConditioning: true, attachedConditioningKind: 'component',
    conditioningCategory: 'aerobic_base', conditioningFlavour: 'aerobic',
    ergModality: 'bike',
  } as SessionAllocation];
  const started = performance.now();
  const fallback = buildWorkoutsFromCoach([], 'slice4:generation:fallback', plan, PATH_PROFILE, {
    miniCycleNumber: 1, weekInBlock: 1, weekStartISO: '2026-03-23', weekKind: 'build',
  });
  const fallbackMs = performance.now() - started;
  const aiStarted = performance.now();
  const ai = buildWorkoutsFromCoach([{
    dayOfWeek: 1, name: 'Unhelpful Core Label', workoutType: 'core' as any, sessionTier: 'core',
    exercises: [
      { name: 'Back Squat', sets: 3, repsMin: 5, repsMax: 5 },
      { name: 'Romanian Deadlift', sets: 3, repsMin: 6, repsMax: 6 },
      { name: 'Pallof Press', sets: 3, repsMin: 10, repsMax: 10 },
      { name: 'Bike Zone 2 25min', sets: 1, repsMin: 25, repsMax: 25 },
    ],
  } as any], 'slice4:generation:ai', plan, PATH_PROFILE, {
    miniCycleNumber: 1, weekInBlock: 1, weekStartISO: '2026-03-23', weekKind: 'build',
  });
  return [
    observation('deterministic_generation', 'path_output', canonicalWeekLedger(fallback), fallbackMs),
    observation('ai_fixture_normalisation', 'path_output', canonicalWeekLedger(ai), performance.now() - aiStarted),
  ];
}

function rebuildObservations(): Slice4PathObservation[] {
  resetStore();
  const started = performance.now();
  rebuildLocalWeek({ baseProfile: PATH_PROFILE, todayISO: '2026-03-23', scope: 'block' });
  const first = useProgramStore.getState().currentProgram?.microcycles?.[0]?.workouts ?? [];
  const firstLedger = canonicalWeekLedger(first);
  const middle = performance.now();
  rebuildLocalWeek({ baseProfile: PATH_PROFILE, todayISO: '2026-03-23', scope: 'block' });
  const second = useProgramStore.getState().currentProgram?.microcycles?.[0]?.workouts ?? [];
  return [
    observation('no_op_week_rebuild', 'path_input', firstLedger, middle - started),
    observation('no_op_week_rebuild', 'path_output', canonicalWeekLedger(second), performance.now() - middle),
  ];
}

function repeatObservations(): Slice4PathObservation[] {
  const source = [combinedLower(), pathWorkout({
    id: 'repeat-team', dayOfWeek: 2, name: 'Team Training + Upper Pull', patterns: ['pull'], primary: 'pull',
    workoutType: 'Team Training', team: true,
    exercises: [pathExercise('repeat-team', 0, 'Pull-Ups')],
  })];
  const started = performance.now();
  const overlay = buildRepeatWeekOverlay({ sourceWorkouts: source, targetWeekStart: '2026-03-30' });
  const output = Object.values(overlay.workoutsByDate).filter(Boolean) as Workout[];
  return [
    observation('repeat_week', 'path_input', canonicalWeekLedger(source), 0),
    observation('repeat_week', 'path_output', canonicalWeekLedger(output), performance.now() - started, ['date', 'workout_id', 'microcycle_id']),
  ];
}

function rolloverObservations(): Slice4PathObservation[] {
  resetStore();
  rebuildLocalWeek({ baseProfile: PATH_PROFILE, todayISO: '2026-03-23', scope: 'block', blockNumber: 1 });
  const before = useProgramStore.getState().currentProgram?.microcycles?.[0]?.workouts ?? [];
  const started = performance.now();
  const result = rolloverProgramBlock({ baseProfile: PATH_PROFILE, targetDateISO: '2026-04-20' });
  if (!result.rolledOver || !result.program) throw new Error('Slice 4 rollover fixture did not cross the block boundary');
  return [
    observation('block_rollover', 'path_input', canonicalWeekLedger(before), 0),
    observation('block_rollover', 'path_output', canonicalWeekLedger(result.program.microcycles[0].workouts), performance.now() - started, ['block_number', 'block_start', 'dose', 'variation', 'plan_entry_ids']),
  ];
}

function addBikeObservation(): Slice4PathObservation[] {
  resetStore();
  const source = combinedLower('coach-bike-lower', 1, false);
  seedProgram([source]);
  const date = '2026-03-23';
  const week = [resolvedDay(date, source)];
  const started = performance.now();
  const result = applyAdjustmentEvents([{
    id: 'slice4-add-bike', kind: 'add_conditioning_block', date, reason: 'Add easy bike',
    before: null, after: {
      title: 'Bike Zone 2 25min', description: '25min easy bike at conversational pace.',
      minutes: 25, sets: 1, restSeconds: 0, conditioningCategory: 'aerobic_base',
      conditioningFlavour: 'aerobic', prescriptionType: 'duration_minutes', exerciseId: 'slice4-bike-zone2',
    },
  } as any], {
    todayISO: date, buildState: () => ({} as any), resolveWeek: () => week,
  });
  if (result.rejected.length || !useProgramStore.getState().dateOverrides[date]) throw new Error('Slice 4 coach Bike edit did not apply');
  return [
    observation('conditioning_edit', 'path_input', canonicalWeekLedger([source]), 0),
    observation('conditioning_edit', 'path_output', canonicalWeekLedger([useProgramStore.getState().dateOverrides[date]]), performance.now() - started, ['conditioning_added']),
  ];
}

function contrastRemovalObservation(): Slice4PathObservation[] {
  resetStore();
  const id = 'contrast-edit';
  const source = finaliseWorkoutAfterMutation(pathWorkout({
    id, dayOfWeek: 1, name: 'Lower Contrast', patterns: ['squat'], primary: 'squat',
    exercises: [pathExercise(id, 0, 'Back Squat', { weight: 100, reps: 4 })],
    powerBlock: pathPowerBlock('contrast'),
  }), { phase: 'Off-season', offseasonSubphase: 'late_offseason', planIntentValid: true }).workout;
  seedProgram([source]);
  const date = '2026-03-23';
  const started = performance.now();
  applyAdjustmentEvents([{
    id: 'slice4-remove-heavy', kind: 'remove_exercise', date, reason: 'Remove heavy lift',
    before: 'Back Squat', after: null,
  } as any], { todayISO: date, buildState: () => ({} as any), resolveWeek: () => [resolvedDay(date, source)] });
  const output = useProgramStore.getState().dateOverrides[date];
  if (!output) throw new Error('Slice 4 Contrast removal edit did not apply');
  return [
    observation('coach_revision', 'path_input', canonicalWeekLedger([source]), 0),
    observation('coach_revision', 'path_output', canonicalWeekLedger([output]), performance.now() - started, ['heavy_lift_removed', 'strength_component_removed']),
  ];
}

function directPallofObservation(): Slice4PathObservation[] {
  resetStore();
  const source = upperPush('direct-pallof', 1);
  seedProgram([source]);
  const started = performance.now();
  useProgramStore.getState().addExerciseToWorkout(source.id, pathExercise(source.id, 2, 'Pallof Press', { reps: 10 }));
  const output = useProgramStore.getState().currentMicrocycle?.workouts ?? [];
  return [
    observation('direct_exercise_edit', 'path_input', canonicalWeekLedger([source]), 0),
    observation('direct_exercise_edit', 'path_output', canonicalWeekLedger(output), performance.now() - started, ['support_added']),
  ];
}

function moveOrSwapObservations(swap: boolean): Slice4PathObservation[] {
  resetStore();
  const lower = combinedLower('move-lower', 1);
  const upper = upperPush('move-upper', 3);
  const workouts = swap ? [lower, upper] : [lower];
  seedProgram(workouts);
  const sourceDate = '2026-03-23';
  const destDate = '2026-03-25';
  const week = [resolvedDay(sourceDate, lower), resolvedDay(destDate, swap ? upper : null)];
  const started = performance.now();
  const result = applyMoveSession({ sourceDate, destDate, swap, reason: 'Slice 4 identity check' }, {
    todayISO: sourceDate, allowPastDates: true,
    buildState: () => ({} as any), resolveWeek: () => week,
  });
  if (result.rejected.length) throw new Error(`Slice 4 ${swap ? 'swap' : 'move'} rejected: ${result.rejected[0].reason}`);
  const overrides = useProgramStore.getState().dateOverrides;
  const output = swap ? [overrides[sourceDate], overrides[destDate]] : [overrides[destDate]];
  const pathId = swap ? 'workout_swap' : 'workout_move';
  return [
    observation(pathId, 'path_input', canonicalWeekLedger(workouts), 0),
    observation(pathId, 'path_output', canonicalWeekLedger(output), performance.now() - started, ['day_of_week', 'coach_note']),
  ];
}

function persistenceObservations(scenario: Slice4GoldenScenario): Slice4PathObservation[] {
  const probe = path.join(__dirname, 'slice4PersistenceProbe.ts');
  const started = performance.now();
  const child = spawnSync(process.execPath, ['-r', 'sucrase/register', probe, scenario.id], {
    cwd: path.resolve(__dirname, '../../..'), encoding: 'utf8', timeout: 15_000,
    env: { ...process.env, TZ: 'Australia/Melbourne' },
  });
  if (child.error) throw child.error;
  if (child.status !== 0) throw new Error(`Slice 4 persistence probe failed:\n${child.stderr || child.stdout}`);
  const marker = child.stdout.split(/\r?\n/).find((line) => line.startsWith(PERSISTENCE_MARKER));
  if (!marker) throw new Error(`Slice 4 persistence probe produced no marker:\n${child.stdout}`);
  const parsed = JSON.parse(marker.slice(PERSISTENCE_MARKER.length));
  const elapsed = performance.now() - started;
  const pathId = scenario.id === 'legacy-program-rehydrate' ? 'legacy_store_rehydrate' : 'store_rehydrate';
  const observations = [
    observation(pathId, 'stored_before_rehydrate', parsed.stored, 0, [], parsed.persistence),
    observation(pathId, 'rehydrated', parsed.hydrated, elapsed / 2, ['canonical_legacy_ingress'], parsed.persistence),
    observation(pathId, 'rehydrated_twice', parsed.hydratedTwice, elapsed / 2, [], parsed.persistence),
  ];
  if (scenario.id === 'post-rehydrate-edit-rebuild') {
    observations.push(
      observation('conditioning_edit', 'path_input', parsed.liveEdit, 0, ['conditioning_added'], parsed.persistence),
      observation('conditioning_edit', 'post_rehydrate_edit', parsed.rehydratedEdit, 0, ['conditioning_added'], parsed.persistence),
      observation('no_op_week_rebuild', 'path_output', parsed.liveRebuild, 0, [], parsed.persistence),
      observation('no_op_week_rebuild', 'post_rehydrate_rebuild', parsed.rehydratedRebuild, 0, [], parsed.persistence),
    );
  }
  return observations;
}

export function applySlice4Mutation(
  trace: Slice4ScenarioTrace,
  mutation?: Slice4MutationId,
): Slice4ScenarioTrace {
  if (!mutation) return trace;
  const clone = JSON.parse(JSON.stringify(trace)) as Slice4ScenarioTrace;
  const input = clone.observations[0];
  const output = mutation === 'ai_drops_conditioning'
    ? clone.observations[1]
    : clone.observations.find((entry) => entry.stage !== 'path_input' && entry.stage !== 'stored_before_rehydrate') ?? clone.observations[1];
  const firstWorkout = output?.ledger.workouts[0];
  if (mutation === 'ai_drops_conditioning' && firstWorkout) firstWorkout.components = firstWorkout.components.filter((value) => value !== 'conditioning');
  else if (mutation === 'rebuild_joins_by_weekday' && firstWorkout) firstWorkout.planEntryId = 'destination-weekday-plan';
  else if (mutation === 'repeat_drops_conditioning' && firstWorkout) { firstWorkout.components = firstWorkout.components.filter((value) => value !== 'conditioning'); firstWorkout.conditioning = []; }
  else if (mutation === 'move_replaces_plan_id' && firstWorkout) firstWorkout.planEntryId = 'slice4:friday:optional';
  else if (mutation === 'swap_keeps_destination_ids' && output?.ledger.workouts.length === 2) {
    output.ledger.workouts[0].planEntryId = input.ledger.workouts[1].planEntryId;
    output.ledger.workouts[1].planEntryId = input.ledger.workouts[0].planEntryId;
  } else if (mutation === 'rehydrate_drops_second_pattern' && firstWorkout) firstWorkout.plannedPatterns = firstWorkout.plannedPatterns.filter((value) => value !== 'hinge');
  else if (mutation === 'workout_type_overwrites_components' && firstWorkout) firstWorkout.components = ['strength'];
  else if (mutation === 'stale_name_restores_pattern' && firstWorkout) firstWorkout.effectivePatterns.push('push');
  else if (mutation === 'second_hydration_mutates') {
    const twice = clone.observations.find((entry) => entry.stage === 'rehydrated_twice')?.ledger.workouts[0];
    if (twice) twice.plannedPatterns = twice.plannedPatterns.filter((value) => value !== 'hinge');
  } else if (mutation === 'coach_bike_stays_strength_row' && firstWorkout) {
    firstWorkout.components = firstWorkout.components.filter((value) => value !== 'conditioning');
    firstWorkout.strengthRows.push('Bike Zone 2 25min'); firstWorkout.conditioning = [];
  } else if (mutation === 'contrast_survives_lift_removal' && firstWorkout) firstWorkout.power = { kind: 'contrast', explosiveFamily: 'lower', heavyLiftFamily: 'lower', heavyLiftPresent: false };
  else if (mutation === 'post_rehydrate_rebuild_drops_component') {
    const rebuilt = clone.observations.find((entry) => entry.stage === 'post_rehydrate_rebuild')
      ?.ledger.workouts.find((workout) => workout.components.includes('conditioning'));
    if (rebuilt) rebuilt.components = rebuilt.components.filter((value) => value !== 'conditioning');
  }
  return clone;
}

export function buildSlice4ScenarioTrace(
  scenario: Slice4GoldenScenario,
  mutation?: Slice4MutationId,
): Slice4ScenarioTrace {
  const started = performance.now();
  let observations: Slice4PathObservation[];
  if (scenario.id === 'generation-ai-fallback-equivalence') observations = generationObservations();
  else if (scenario.id === 'noop-inseason-week-rebuild') observations = rebuildObservations();
  else if (scenario.id === 'repeat-rich-week') observations = repeatObservations();
  else if (scenario.id === 'block-rollover-contract') observations = rolloverObservations();
  else if (scenario.id === 'coach-add-bike-zone2') observations = addBikeObservation();
  else if (scenario.id === 'coach-remove-contrast-lift') observations = contrastRemovalObservation();
  else if (scenario.id === 'direct-add-pallof') observations = directPallofObservation();
  else if (scenario.id === 'move-combined-lower') observations = moveOrSwapObservations(false);
  else if (scenario.id === 'swap-upper-and-lower') observations = moveOrSwapObservations(true);
  else observations = persistenceObservations(scenario);
  return applySlice4Mutation({ scenario, observations, runtimeMs: performance.now() - started }, mutation);
}
