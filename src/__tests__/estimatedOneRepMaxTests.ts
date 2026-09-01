(global as any).__DEV__ = false;
const storage = new Map<string, string>();
(globalThis as any).window = { localStorage: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key), clear: () => storage.clear(),
} };
import { RIR_ESTIMATE_METHOD, TRACKED_LIFTS, TRACKED_LIFT_PAIRS, estimateLastSetOneRepMaxKg,
  selectedTrackedLifts, trackedLiftId, type LastSetEstimateInput, type TrackedLiftSlot } from '../rules/estimatedOneRepMax';
import { buildLastSetFeedbackInputs, lastCompletedWorkingSet, buildStrengthPerformanceLogs } from '../utils/strengthLogging';
import { buildProgressMainLiftHistories } from '../rules/progressMainLiftStrength';
import { coldStartThroughOnboarding, quietAsync, quiet, relaunchApp, setJourneyClock } from './support/athleteJourney';
import { athleteAnswers, ARCHETYPES, plusDays } from './compilerYear/catalog';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { commitProfileProgramTransaction } from '../store/profileProgramTransaction';
import { applyPhaseShift } from '../utils/profileMutations';
import { useWorkoutLogStore } from '../store/workoutLogStore';
import { executeProgramControlActionDurably } from '../utils/programControlActions';
import { resolveSessionOutcomeTarget, commitSessionOutcomeTransaction, createRecordSessionOutcomeIntentFromFeedback } from '../store/sessionOutcomeTransaction';
import { buildSessionFeedbackPayload } from '../utils/sessionFeedbackForm';
import { buildSessionTemplate } from '../utils/sessionTemplate';
import { buildSessionExecutionPlan, buildSessionExecutionSummary } from '../utils/sessionExecutionChecklist';
import type { LoggedSet } from '../types/domain';
import { sourceMutation } from './support/sourceMutation';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import { displayReps } from '../rules/prescriptionDisplay';
armTotalsOrRed();
let passed = 0, failed = 0;
function check(label: string, value: unknown, detail?: unknown) {
  if (value) passed++; else { failed++; console.error(`FAIL ${label}${detail === undefined ? '' : `\n     ${JSON.stringify(detail)}`}`); }
}
const basis: LastSetEstimateInput = { method: RIR_ESTIMATE_METHOD, liftId: 'bench_press',
  exerciseId: 'bench', workoutExerciseId: 'bench-row', setId: 'last', setNumber: 3,
  source: 'logged_set', actualWeightKg: 100, actualReps: 5, rir: 2, skipped: false, setup: '' };
check('verified Bench interpolation: 100 x 5 + 2 => 120 kg', Math.round(estimateLastSetOneRepMaxKg(basis)!) === 120);
check('general curve differs from Bench', estimateLastSetOneRepMaxKg({ ...basis, liftId: 'rdl' }) !== estimateLastSetOneRepMaxKg(basis));
for (const rir of [null, '5+', -1, 5, 2.5] as const) check(`RIR ${rir} excluded`, estimateLastSetOneRepMaxKg({ ...basis, rir } as LastSetEstimateInput) === null);
check('skip excluded', estimateLastSetOneRepMaxKg({ ...basis, skipped: true }) === null);
check('effective reps 15 accepted', estimateLastSetOneRepMaxKg({ ...basis, actualReps: 11, rir: 4 }) !== null);
check('effective reps 16 excluded', estimateLastSetOneRepMaxKg({ ...basis, actualReps: 12, rir: 4 }) === null);
check('unknown method excluded', estimateLastSetOneRepMaxKg({ ...basis, method: 'future' } as any) === null);
for (const actualReps of [null, 0, 2.5, NaN]) check(`actual reps ${actualReps} excluded`, estimateLastSetOneRepMaxKg({ ...basis, actualReps }) === null);
for (const actualWeightKg of [null, -10, NaN]) check(`actual load ${actualWeightKg} excluded`, estimateLastSetOneRepMaxKg({ ...basis, actualWeightKg }) === null);
check('pulldown uses the session pair without a second setup answer',
  estimateLastSetOneRepMaxKg({ ...basis, liftId: 'lat_pulldown' }) !== null);
check('Bulgarians require non-dominant leg', estimateLastSetOneRepMaxKg({ ...basis, liftId: 'bulgarian_split_squat' }) === null);
check('Bulgarians use one total load, not doubled reps or weight', estimateLastSetOneRepMaxKg({ ...basis, liftId: 'bulgarian_split_squat', side: 'non_dominant' }) === estimateLastSetOneRepMaxKg({ ...basis, liftId: 'rdl' }));
check('pull-up requires session bodyweight', estimateLastSetOneRepMaxKg({ ...basis, liftId: 'pull_up' }) === null);
const pullUp = { ...basis, liftId: 'pull_up' as const, actualWeightKg: 10, bodyWeightKg: 80 };
const total = estimateLastSetOneRepMaxKg({ ...basis, liftId: 'rdl', actualWeightKg: 90 })!;
check('pull-up computes system load and displays added load', Math.abs(estimateLastSetOneRepMaxKg(pullUp)! - (total - 80)) < 1e-8);
for (const name of ['DB Bench Press', 'Single-Arm Lat Pulldown', 'Assisted Pull-Up', 'Band-Assisted Pull-Up']) check(`${name} is not a tracked equivalent`, trackedLiftId(name) === null);
const sets: LoggedSet[] = [
  { id: 'early', loggedWorkoutId: 'log', workoutExerciseId: 'row', setNumber: 1, actualWeightKg: 120, actualReps: 3, createdAt: '', updatedAt: '' },
  { id: 'last', loggedWorkoutId: 'log', workoutExerciseId: 'row', setNumber: 2, actualWeightKg: 90, actualReps: 7, createdAt: '', updatedAt: '' },
];
check('last back-off wins over first/best set', lastCompletedWorkingSet(sets)?.id === 'last');
const firstSetMutation = sourceMutation<typeof import('../utils/strengthLogging')>(require.resolve('../utils/strengthLogging'),
  'set.setNumber >= last.setNumber', 'set.setNumber <= last.setNumber');
check('mutation: same last-set assertion rejects selecting the first working set', firstSetMutation.lastCompletedWorkingSet(sets)?.id !== 'last'
  && lastCompletedWorkingSet(sets)?.id === 'last');
const zeroMutation = sourceMutation<typeof import('../rules/estimatedOneRepMax')>(require.resolve('../rules/estimatedOneRepMax'),
  'export function estimateLastSetOneRepMaxKg(input: LastSetEstimateInput): number | null {',
  'export function estimateLastSetOneRepMaxKg(input: LastSetEstimateInput): number | null { input = { ...input, rir: input.rir ?? 0 };');
check('mutation: unanswered exclusion rejects assumed zero', zeroMutation.estimateLastSetOneRepMaxKg({ ...basis, rir: null }) !== null
  && estimateLastSetOneRepMaxKg({ ...basis, rir: null }) === null);

// Sam's 2026-08-31 correction to audit F002: checking the exercise means the
// prescribed final working-set reps were completed. The ordinary athlete flow
// owns the saved weight and RIR answer; incidental per-set reps are not a
// second estimator input.
const prescribedBench = {
  id: 'bench-session', exercises: [{ id: 'bench-row', exerciseId: 'bench',
    prescribedSets: 3, prescribedRepsMin: 10, prescribedRepsMax: 10,
    prescribedWeightKg: 50, exercise: { id: 'bench', name: 'Bench Press' } }],
} as any;
const prescribedBenchInputs = buildLastSetFeedbackInputs({
  date: '2026-09-28', workout: prescribedBench, choices: { bench_press: 'bench_press' },
  completion: 'full', weightOverrides: { bench: 62.5 },
  executionItems: [{ itemId: 'exercise:bench-row', completed: true }] as any,
  loggedSets: { 'bench-row': [{ id: 'audit-incidental-12', loggedWorkoutId: 'log',
    workoutExerciseId: 'bench-row', setNumber: 3, actualWeightKg: 62.5,
    actualReps: 12, completed: true, createdAt: '', updatedAt: '' }] },
});
check('audit F002 reclassified: 62.5 kg uses prescribed 10 reps, not incidental 12',
  prescribedBenchInputs.length === 1
    && prescribedBenchInputs[0].actualWeightKg === 62.5
    && prescribedBenchInputs[0].actualReps === 10);
const incidentalRepsMutation = sourceMutation<typeof import('../utils/strengthLogging')>(
  require.resolve('../utils/strengthLogging'),
  'actualReps: displayReps(row.prescribedRepsMin, row.prescribedRepsMax),',
  'actualReps: anyLast?.actualReps ?? displayReps(row.prescribedRepsMin, row.prescribedRepsMax),',
);
check('mutation: incidental logged reps cannot replace the prescribed-rep convention',
  incidentalRepsMutation.buildLastSetFeedbackInputs({
    date: '2026-09-28', workout: prescribedBench, choices: { bench_press: 'bench_press' },
    completion: 'full', weightOverrides: { bench: 62.5 },
    executionItems: [{ itemId: 'exercise:bench-row', completed: true }] as any,
    loggedSets: { 'bench-row': [{ id: 'audit-incidental-12', loggedWorkoutId: 'log',
      workoutExerciseId: 'bench-row', setNumber: 3, actualWeightKg: 62.5,
      actualReps: 12, completed: true, createdAt: '', updatedAt: '' }] },
  })[0]?.actualReps === 12 && prescribedBenchInputs[0].actualReps === 10);

check('warmup and incomplete are excluded', lastCompletedWorkingSet([...sets, { ...sets[0], id: 'warmup', setNumber: 3, kind: 'warmup' }, { ...sets[0], setNumber: 4, completed: false }])?.id === 'last');
check('last missing measurement does not fall back to earlier set', lastCompletedWorkingSet([...sets, { ...sets[0], id: 'missing', setNumber: 3, actualReps: undefined }])?.id === 'missing');
check('Bulgarians choose last non-dominant set, not last dominant set', lastCompletedWorkingSet([
  { ...sets[0], side: 'non_dominant' }, { ...sets[1], side: 'dominant' }], true)?.id === 'early');
async function main() {
  for (const gender of ['male', 'female'] as const) {
    const date = '2026-08-24';
    const profile = athleteAnswers({ ...ARCHETYPES[6], gender, extraGame: false });
    const start = await coldStartThroughOnboarding({ profile, installDayISO: date });
    check(`${gender}: valid real onboarding`, !start.onboardingRefusal);
    for (const [dayOffset, alternatives] of [[0, false], [2, true], [7, false]] as const) {
      const day = plusDays(date, dayOffset); setJourneyClock(day);
      for (const slot of Object.keys(TRACKED_LIFT_PAIRS) as TrackedLiftSlot[]) {
        quiet(() => useProfileStore.getState().setTrackedLiftChoice(
          slot, TRACKED_LIFT_PAIRS[slot][alternatives ? 1 : 0],
        ));
      }
      let target = quiet(() => resolveSessionOutcomeTarget(day))!;
      check(`${gender}/${day}: real session`, !!target);
      if (!target) continue;
      for (const id of selectedTrackedLifts(useProfileStore.getState().trackedLiftChoices)) {
        if (target.workout.exercises.some(row => trackedLiftId(row.exercise?.name ?? '') === id)) continue;
        const result = await quietAsync(() => executeProgramControlActionDurably({ type: 'add_exercise',
          source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' }, scope: 'today_only',
          payload: { date: day, exercise: { name: TRACKED_LIFTS[id].names[0], sets: 3, repsMin: 5, repsMax: 8, weight: 80, sessionSection: 'strength' } },
          requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true }, { todayISO: day }));
        check(`${gender}/${id}: actual Add accepted`, result.ok);
        target = quiet(() => resolveSessionOutcomeTarget(day))!;
      }
      const workout = target.workout;
      const plan = buildSessionExecutionPlan({ workout, template: buildSessionTemplate(workout), mobilityFlow: null });
      const selected = new Set(selectedTrackedLifts(useProfileStore.getState().trackedLiftChoices));
      const rows = workout.exercises.filter(row => selected.has(trackedLiftId(row.exercise?.name ?? '')!));
      const summary = buildSessionExecutionSummary(plan, new Set(rows.map(row => `exercise:${row.id}`)));
      const byRow: Record<string, LoggedSet[]> = {};
      useWorkoutLogStore.getState().startWorkout(workout);
      for (const row of rows) {
        byRow[row.id] = sets.map(set => ({ ...set, id: `${row.id}:${set.id}`, workoutExerciseId: row.id,
          side: 'non_dominant', bodyWeightKg: 80 }));
        byRow[row.id].forEach(set => useWorkoutLogStore.getState().logSet(row.id, set));
      }
      const sessionLoads = Object.fromEntries(rows.map((row, index) => [row.exerciseId,
        trackedLiftId(row.exercise?.name ?? '') === 'pull_up' ? null : 72.5 + index * 5]));
      const inputs = buildLastSetFeedbackInputs({ date: day, workout, choices: useProfileStore.getState().trackedLiftChoices,
        executionItems: summary.items, completion: 'partial', loggedSets: byRow, bodyWeightKg: 80,
        weightOverrides: sessionLoads });
      check(`${gender}/${day}: four selected completed lifts get questions`, inputs.length === 4);
      check(`${gender}/${day}: unanswered is not zero`, inputs.every(input => input.rir === null));
      check(`${gender}/${day}: checked row supplies its session load and visible reps`, inputs.every(input => {
        const row = rows.find(candidate => candidate.id === input.workoutExerciseId)!;
        const expectedWeight = input.liftId === 'pull_up' ? 0 : sessionLoads[row.exerciseId];
        return input.actualWeightKg === expectedWeight
          && input.actualReps === displayReps(row.prescribedRepsMin, row.prescribedRepsMax)
          && input.setId === `${day}:${row.id}:last-working-set`;
      }));
      const missing = buildLastSetFeedbackInputs({ date: day, workout, choices: useProfileStore.getState().trackedLiftChoices,
        executionItems: summary.items, completion: 'partial', weightOverrides: sessionLoads });
      check(`${gender}/${day}: no per-set log is required to reuse the checked session values`,
        missing.every(input => {
          const row = rows.find(candidate => candidate.id === input.workoutExerciseId)!;
          const expectedWeight = input.liftId === 'pull_up' ? 0 : sessionLoads[row.exerciseId];
          return input.actualWeightKg === expectedWeight
            && input.actualReps === displayReps(row.prescribedRepsMin, row.prescribedRepsMax);
        }));
      check(`${gender}/${day}: unticked partial lifts have no question`, buildLastSetFeedbackInputs({ date: day, workout,
        choices: useProfileStore.getState().trackedLiftChoices, completion: 'partial', loggedSets: byRow,
        executionItems: summary.items.map(i => ({ ...i, completed: false })) }).length === 0);
      check(`${gender}/${day}: skipped session has no question`, buildLastSetFeedbackInputs({ date: day, workout, completion: 'skipped', loggedSets: byRow }).length === 0);
      const answered = inputs.map((input, index) => ({ ...input,
        rir: dayOffset === 7 ? (index === 1 ? '5+' as const : null) : 2 as const,
        skipped: dayOffset === 7 && index === 2 }));
      const strength = buildStrengthPerformanceLogs(workout, {}, 'partial', byRow, { lastSetInputs: answered, bodyWeightKg: 80 });
      check(`${gender}/${day}: session-owned pair stays with the exact checked row`, strength.filter(log => log.lastSetEstimate)
        .every(log => answered.some(input => input.workoutExerciseId === log.workoutExerciseId
          && input.actualWeightKg === log.lastSetEstimate!.actualWeightKg
          && input.actualReps === log.lastSetEstimate!.actualReps)));
      check(`${gender}/${day}: no legacy basis written`, strength.every(log => !log.oneRepMaxBasis));
      const changedRir = buildStrengthPerformanceLogs(workout, {}, 'partial', byRow, { lastSetInputs: answered.map(input => ({ ...input, rir: 4 })) });
      const progressionInputs = (logs: typeof strength) => logs.map(({ lastSetEstimate, ...log }) => log);
      check(`${gender}/${day}: RIR never changes existing progression inputs`, JSON.stringify(progressionInputs(strength)) === JSON.stringify(progressionInputs(changedRir)));
      if (dayOffset === 7) check(`${gender}: skipped/unanswered/5+ session makes no estimate`,
        buildProgressMainLiftHistories({ weekStart: day, sessions: [{ date: day, strength }] }).every(history => history.series.length === 0));
      const feedback = buildSessionFeedbackPayload({ dateStr: day, components: summary.components,
        completion: 'partial', componentCompletions: summary.componentCompletions,
        executionItems: summary.items, feeling: 'good', soreness: 'none', difficulty: 7,
        partialReason: 'ran_out_of_time', skipReason: null, strength });
      check(`${gender}/${day}: feedback valid`, !!feedback);
      if (feedback) {
        const result = await quietAsync(() => commitSessionOutcomeTransaction(createRecordSessionOutcomeIntentFromFeedback({ date: day, workout, feedback,
          source: { entryPoint: 'tap', surface: 'session_feedback_panel' } })));
        check(`${gender}/${day}: accepted save`, result.ok);
        check(`${gender}/${day}: accepted save retains explicit chart choices on disk`,
          JSON.stringify(JSON.parse(storage.get('profile-store')!).state.trackedLiftChoices)
            === JSON.stringify(useProfileStore.getState().trackedLiftChoices));
      }
    }
    const sessions = Object.entries(useProgramStore.getState().sessionFeedback).map(([date, feedback]) => ({ date, strength: feedback.strength ?? [] }));
    const histories = buildProgressMainLiftHistories({ weekStart: date, sessions });
    check(`${gender}: defaults preserved after alternative logging`, histories.every(h => h.points.length === 1));
    for (const slot of Object.keys(TRACKED_LIFT_PAIRS) as TrackedLiftSlot[]) {
      quiet(() => useProfileStore.getState().setTrackedLiftChoice(slot, TRACKED_LIFT_PAIRS[slot][1]));
    }
    check(`${gender}: live chart choices persist the compiler's alternative-anchor input`,
      (Object.keys(TRACKED_LIFT_PAIRS) as TrackedLiftSlot[]).every(slot =>
        useProfileStore.getState().trackedLiftChoices[slot] === TRACKED_LIFT_PAIRS[slot][1]));
    const liveAlternativeNames = new Set(useProgramStore.getState().currentProgram?.microcycles
      .flatMap(week => week.workouts).flatMap(workout => workout.exercises)
      .map(row => row.exercise?.name ?? '') ?? []);
    check(`${gender}: the live Progress choice immediately displaces defaults in the rebuilt week`,
      (Object.keys(TRACKED_LIFT_PAIRS) as TrackedLiftSlot[]).every(slot =>
        !liveAlternativeNames.has(TRACKED_LIFTS[slot].names[0]))
      && (Object.keys(TRACKED_LIFT_PAIRS) as TrackedLiftSlot[]).some(slot =>
        liveAlternativeNames.has(TRACKED_LIFTS[TRACKED_LIFT_PAIRS[slot][1]].names[0])),
      [...liveAlternativeNames]);
    const pull = histories.find(h => h.id === 'pull_up');
    check(`${gender}: today's BW does not change historical estimate`, JSON.stringify(pull) === JSON.stringify(buildProgressMainLiftHistories({ weekStart: date, sessions, bodyWeightKg: 125 }).find(h => h.id === 'pull_up')));
    const prior = JSON.stringify(useProgramStore.getState().sessionFeedback);
    const choicesBefore = JSON.stringify(useProfileStore.getState().trackedLiftChoices);
    const phaseProfile = applyPhaseShift(useProfileStore.getState().onboardingData, { targetPhase: 'Off-season' });
    const phaseChange = await quietAsync(() => commitProfileProgramTransaction({
      change: { kind: 'profile_setup', patch: {
        seasonPhase: phaseProfile.seasonPhase, seasonFinishedOn: phaseProfile.seasonFinishedOn,
        teamTrainingDays: phaseProfile.teamTrainingDays, teamTrainingDaysPerWeek: phaseProfile.teamTrainingDaysPerWeek,
        gameDay: phaseProfile.gameDay, usualGameDay: phaseProfile.usualGameDay,
      } }, todayISO: plusDays(date, 7), sourceSurface: 'phase_shift',
    }));
    check(`${gender}: real phase change accepted`, phaseChange.ok && phaseChange.changedProgram);
    check(`${gender}: phase change preserves non-default selections`, JSON.stringify(useProfileStore.getState().trackedLiftChoices) === choicesBefore);
    const reboot = await quietAsync(() => relaunchApp({ storage, todayISO: plusDays(date, 7) }));
    check(`${gender}: reboot accepted`, reboot.ok);
    check(`${gender}: raw answers/session BW/5+ schema survive storage`, JSON.stringify(useProgramStore.getState().sessionFeedback) === prior);
    const reopenedInputs = Object.values(useProgramStore.getState().sessionFeedback).flatMap(feedback => (feedback.strength ?? []).flatMap(log => log.lastSetEstimate ? [log.lastSetEstimate] : []));
    check(`${gender}: open-ended 5+ actually persisted, never numeric five`, reopenedInputs.some(input => input.rir === '5+') && reopenedInputs.every(input => (input.rir as unknown) !== 5));
    check(`${gender}: explicit Skip and unanswered both persisted`, reopenedInputs.some(input => input.skipped && input.rir === null) && reopenedInputs.some(input => !input.skipped && input.rir === null));
    check(`${gender}: non-default selections survive accepted edits and restart`, JSON.stringify(useProfileStore.getState().trackedLiftChoices) === choicesBefore);
    const reopenedAlternativeNames = new Set(useProgramStore.getState().currentProgram?.microcycles
      .flatMap(week => week.workouts).flatMap(workout => workout.exercises)
      .map(row => row.exercise?.name ?? '') ?? []);
    check(`${gender}: restart keeps defaults displaced in the rebuilt week`,
      (Object.keys(TRACKED_LIFT_PAIRS) as TrackedLiftSlot[]).every(slot =>
        !reopenedAlternativeNames.has(TRACKED_LIFTS[slot].names[0]))
      && (Object.keys(TRACKED_LIFT_PAIRS) as TrackedLiftSlot[]).some(slot =>
        reopenedAlternativeNames.has(TRACKED_LIFTS[TRACKED_LIFT_PAIRS[slot][1]].names[0])),
      [...reopenedAlternativeNames]);
    check(`${gender}: alternative histories reopen separately`, buildProgressMainLiftHistories({ weekStart: date, sessions,
      choices: useProfileStore.getState().trackedLiftChoices }).every(history => history.points.length === 1));
    const log = sessions.flatMap(s => s.strength).find(l => l.lastSetEstimate?.liftId === 'bench_press')!;
    const raw = log.lastSetEstimate!;
    for (const patch of [{ rir: null }, { rir: '5+' }, { skipped: true }, { workoutExerciseId: 'wrong-set-row' }, { exerciseId: 'different-exercise' }, { method: 'other-method' }] as const) {
      const varied = { ...log, lastSetEstimate: { ...raw, ...patch } } as typeof log;
      check(`${gender}: invalid/skipped capture never falls back to legacy ${JSON.stringify(patch)}`,
        buildProgressMainLiftHistories({ weekStart: date, sessions: [{ date, strength: [varied] }] })[1].points.length === 0);
    }
    const mixed = buildProgressMainLiftHistories({ weekStart: date, sessions: [{ date, strength: [log,
      { ...log, estimateCaptureVersion: undefined, lastSetEstimate: undefined, oneRepMaxBasis: { externalLoadKg: 100, reps: 5 } },
      { ...log, lastSetEstimate: { ...raw, setup: 'paused variation' } }] }] });
    check(`${gender}: removed setup text cannot split one lift into extra histories`,
      mixed[1].series.length === 2 && mixed[1].series.some(series => series.points.length === 1));
  }
  console.log(`Estimated 1RM: ${passed} passed, ${failed} failed`); totalsPrinted(failed);
  console.log('NOT COVERED: native pixels and touch gestures (separate simulator tape); individual prediction accuracy.');
  process.exitCode = failed ? 1 : 0;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
