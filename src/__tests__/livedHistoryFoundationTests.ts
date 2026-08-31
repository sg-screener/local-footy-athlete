(global as unknown as { __DEV__: boolean }).__DEV__ = true;
const localStorageData = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = { localStorage: {
  getItem: (key: string) => localStorageData.get(key) ?? null,
  setItem: (key: string, value: string) => { localStorageData.set(key, value); },
  removeItem: (key: string) => { localStorageData.delete(key); },
  clear: () => { localStorageData.clear(); },
} };
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — lived-history preflight is on-device only');
};
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
armTotalsOrRed();

import { ARCHETYPES, athleteAnswers, plusDays } from './compilerYear/catalog';
import { coldStartThroughOnboarding, quiet, quietAsync, relaunchApp, resolvedDays,
  setJourneyClock } from './support/athleteJourney';
import { sourceMutation } from './support/sourceMutation';
import { useProgramStore, type SessionFeedback } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { flushPendingStorageWrites, asyncStorageCompat } from '../store/asyncStorageCompat';
import { getSessionComponents } from '../utils/sessionComponents';
import { buildSessionTemplate } from '../utils/sessionTemplate';
import { buildSessionExecutionPlan, buildSessionExecutionSummary } from '../utils/sessionExecutionChecklist';
import { buildLastSetFeedbackInputs, buildStrengthPerformanceLogs } from '../utils/strengthLogging';
import { buildSessionFeedbackPayload } from '../utils/sessionFeedbackForm';
import { buildJournalLoadModel, type JournalLoadSessionInput } from '../rules/journalLoad';
import { buildProgressMainLiftHistories } from '../rules/progressMainLiftStrength';
import { executeProgramControlActionDurably } from '../utils/programControlActions';
import { commitProfileProgramTransaction } from '../store/profileProgramTransaction';
import { applyPhaseShift } from '../utils/profileMutations';
import { classifyDaySessions } from '../rules/sessionTaxonomy';
import {
  commitSessionOutcomeTransaction,
  createRecordSessionOutcomeIntentFromFeedback,
  resolveSessionOutcomeTarget,
} from '../store/sessionOutcomeTransaction';
import type { RecordSessionOutcomeIntent } from '../types/sessionOutcome';
import type { Workout } from '../types/domain';

let passed = 0;
let failed = 0;
const failures: string[] = [];
function check(label: string, condition: unknown, detail?: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${label}`);
  } else {
    failed += 1;
    failures.push(label);
    console.log(`  FAIL ${label}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

type Target = ReturnType<typeof resolveSessionOutcomeTarget>;
const INSTALL_DAY = '2026-07-13';

function loadInput(date: string, feedback: SessionFeedback): JournalLoadSessionInput {
  return {
    date,
    strength: feedback.strength ?? [],
    conditioning: feedback.conditioning ?? null,
    teamTraining: feedback.teamTraining ?? null,
    game: feedback.game ?? null,
    difficulty: feedback.difficulty ?? null,
    actualMinutes: feedback.actualMinutes ?? null,
  };
}

function reconstructedLoad(weekStart: string) {
  const feedback = useProgramStore.getState().sessionFeedback;
  return buildJournalLoadModel({
    weekStart,
    sessions: Object.entries(feedback).map(([date, entry]) => loadInput(date, entry)),
    sessionsPlannedThisWeek: 7,
    plannedStrength: [],
  });
}

function feedbackFor(target: Target, date: string, completion: 'full' | 'skipped',
  extras: Partial<SessionFeedback> = {}): SessionFeedback {
  return {
    ...(useProgramStore.getState().sessionFeedback[date] ?? {}),
    dateStr: date,
    completion,
    components: target.components.map((component) => ({
      componentId: component.id,
      kind: component.kind,
      label: component.label,
      completion,
      ...(completion === 'skipped' ? { skipReason: 'busy_no_time' as const } : {}),
    })),
    ...(completion === 'skipped' ? { skipReason: 'busy_no_time' as const } : {}),
    ...extras,
  };
}

async function commitFeedback(target: Target, date: string, feedback: SessionFeedback) {
  setJourneyClock(date);
  return quietAsync(() => commitSessionOutcomeTransaction(
    createRecordSessionOutcomeIntentFromFeedback({
      date,
      workout: target.workout,
      feedback,
      source: { entryPoint: 'tap', surface: 'lived_history_preflight' },
    }),
    date,
  ));
}

async function main(): Promise<void> {
  const start = await coldStartThroughOnboarding({
    profile: athleteAnswers(ARCHETYPES[4]),
    installDayISO: INSTALL_DAY,
  });
  check('real onboarding accepted', start.onboardingRefusal === null, start.onboardingRefusal);

  const visible = [0, 1, 2, 3].flatMap((week) => {
    const monday = plusDays(INSTALL_DAY, week * 7);
    setJourneyClock(monday);
    return resolvedDays(monday).filter((day) => day.sessionName !== null);
  });
  const targets = visible.map((day) => {
    setJourneyClock(day.dateISO);
    return { day, target: quiet(() => resolveSessionOutcomeTarget(day.dateISO, day.dateISO)) };
  });
  const summary = targets.map(({ day, target }) => ({
    date: day.dateISO,
    name: target.workout.name,
    tier: target.workout.sessionTier ?? null,
    components: target.components.map((component) => component.kind),
    game: classifyDaySessions(target.workout).some((unit) => unit.category === 'game'),
  }));
  console.log(`  reached production sessions: ${JSON.stringify(summary)}`);

  const strengthCandidates = targets.filter(({ target }) =>
    target.components.some((component) => component.kind === 'strength')
      && !target.workout.exercises.some((row) => row.exercise?.name === 'Bench Press'));
  const strength = strengthCandidates[0];
  const conditioning = targets.find(({ target }) =>
    target.components.some((component) => component.kind === 'conditioning'
      || component.kind === 'finisher'));
  const team = targets.find(({ target }) =>
    target.components.some((component) => component.kind === 'team_training'));
  const game = targets.find(({ target }) =>
    classifyDaySessions(target.workout).some((unit) => unit.category === 'game'));
  const optionalStrength = targets.filter(({ target }) => target.workout.sessionTier === 'optional'
    && target.components.some((component) => component.kind === 'strength'));
  const skippedOptional = targets.find(({ target, day }) => target.workout.sessionTier === 'optional'
    && day.dateISO !== optionalStrength[0]?.day.dateISO);
  check('preflight found strength, conditioning, team-training and game targets',
    !!strength && !!conditioning && !!team && !!game, summary);
  check('preflight found separate completed and skipped optional targets',
    optionalStrength.length > 0 && !!skippedOptional, summary);
  if (!strength || !conditioning || !team || !game || optionalStrength.length === 0 || !skippedOptional) {
    throw new Error('The real generated four-week journey did not expose every required preflight target.');
  }

  // The athlete adds the exact ruled Bench prescription through the existing
  // accepted exercise-edit door, then uses the ordinary date-specific weight
  // control. No per-set repetition answer is supplied or required.
  setJourneyClock(strength.day.dateISO);
  const added = await quietAsync(() => executeProgramControlActionDurably({
    type: 'add_exercise',
    source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' },
    scope: 'today_only',
    payload: { date: strength.day.dateISO, exercise: { name: 'Bench Press', sets: 3,
      repsMin: 10, repsMax: 10, weight: 62.5, sessionSection: 'strength' } },
    requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true,
  }, { todayISO: strength.day.dateISO }));
  check('Bench 3 x 10 accepted through the exercise-edit door', added.ok, added);
  const strengthTarget = quiet(() => resolveSessionOutcomeTarget(
    strength.day.dateISO, strength.day.dateISO));
  const bench = strengthTarget.workout.exercises.find((row) => row.exercise?.name === 'Bench Press');
  check('visible Bench prescription is exactly 3 x 10',
    bench?.prescribedSets === 3 && bench.prescribedRepsMin === 10 && bench.prescribedRepsMax === 10,
    bench);
  if (!bench) throw new Error('Bench Press did not reach the visible accepted session.');
  useProgramStore.getState().setWeightOverride(strength.day.dateISO, bench.exerciseId, 62.5);

  const plan = buildSessionExecutionPlan({ workout: strengthTarget.workout,
    template: buildSessionTemplate(strengthTarget.workout), mobilityFlow: null });
  const execution = buildSessionExecutionSummary(plan, new Set(plan.items.map((item) => item.id)));
  useProfileStore.getState().setTrackedLiftChoice('bench_press', 'bench_press');
  const estimateInputs = buildLastSetFeedbackInputs({
    date: strength.day.dateISO,
    workout: strengthTarget.workout,
    choices: useProfileStore.getState().trackedLiftChoices,
    weightOverrides: useProgramStore.getState().weightOverrides[strength.day.dateISO],
    executionItems: execution.items,
    completion: 'full',
  });
  const benchInput = estimateInputs.find((input) => input.liftId === 'bench_press');
  check('estimator input is saved 62.5 kg + prescribed 10 reps',
    benchInput?.actualWeightKg === 62.5 && benchInput.actualReps === 10,
    benchInput);
  const answeredInputs = estimateInputs.map((input) => input.liftId === 'bench_press'
    ? { ...input, rir: 2 as const } : input);
  const strengthLogs = buildStrengthPerformanceLogs(strengthTarget.workout,
    useProgramStore.getState().weightOverrides[strength.day.dateISO] ?? {}, 'full', undefined,
    { bodyWeightKg: 80, lastSetInputs: answeredInputs });
  const strengthFeedback = buildSessionFeedbackPayload({
    dateStr: strength.day.dateISO,
    completion: 'full',
    components: execution.components,
    componentCompletions: execution.componentCompletions,
    executionItems: execution.items,
    feeling: 'good', soreness: 'none', difficulty: 7, actualMinutes: 60,
    partialReason: null, skipReason: null, strength: strengthLogs,
  } as never)!;
  const priorFeedback = { ...strengthFeedback, difficulty: 6, actualMinutes: 45 };
  const prior = await commitFeedback(strengthTarget, strength.day.dateISO, priorFeedback);
  check('prior accepted outcome commits before mutation', prior.ok, prior);

  const normalized = createRecordSessionOutcomeIntentFromFeedback({
    date: strength.day.dateISO, workout: strengthTarget.workout, feedback: strengthFeedback,
    source: { entryPoint: 'tap', surface: 'lived_history_preflight_mutation' },
  });
  const mutant = sourceMutation<typeof import('../store/sessionOutcomeTransaction')>(
    require.resolve('../store/sessionOutcomeTransaction'),
    '...(Number.isFinite(intent.actualMinutes) ? { actualMinutes: intent.actualMinutes } : {}),',
    '...(false ? { actualMinutes: intent.actualMinutes } : {}),',
  );
  const mutated = await quietAsync(() => mutant.commitSessionOutcomeTransaction(
    normalized as RecordSessionOutcomeIntent, strength.day.dateISO));
  check('mutation: transaction refuses success after actualMinutes is dropped',
    mutated.ok === false, mutated);
  check('failed verification restores the exact prior accepted outcome',
    useProgramStore.getState().sessionFeedback[strength.day.dateISO]?.actualMinutes === 45
      && useProgramStore.getState().sessionFeedback[strength.day.dateISO]?.difficulty === 6,
    useProgramStore.getState().sessionFeedback[strength.day.dateISO]);

  const strengthCommit = await commitFeedback(strengthTarget, strength.day.dateISO, strengthFeedback);
  check('complete strength outcome commits after implementation restore', strengthCommit.ok, strengthCommit);
  check('normalized intent retains 60 actual minutes',
    strengthCommit.ok && strengthCommit.normalizedIntent.actualMinutes === 60,
    strengthCommit);
  check('live accepted state retains 60 actual minutes and RPE 7',
    useProgramStore.getState().sessionFeedback[strength.day.dateISO]?.actualMinutes === 60
      && useProgramStore.getState().sessionFeedback[strength.day.dateISO]?.difficulty === 7);
  check('live reconstruction is 420 AU',
    reconstructedLoad(INSTALL_DAY).thisWeek.completedLoadAU === 420,
    reconstructedLoad(INSTALL_DAY).thisWeek);

  const conditioningResult = await commitFeedback(conditioning.target, conditioning.day.dateISO,
    feedbackFor(conditioning.target, conditioning.day.dateISO, 'full', {
      conditioning: { rpe: 8, totalTimeMinutes: 30 },
    }));
  check('conditioning 30 x 8 accepted', conditioningResult.ok, conditioningResult);
  const teamResult = await commitFeedback(team.target, team.day.dateISO,
    feedbackFor(team.target, team.day.dateISO, 'full', {
      teamTraining: { effort: 7, durationMinutes: 80 },
    }));
  check('team training 80 x 7 accepted', teamResult.ok, teamResult);
  const gameResult = await commitFeedback(game.target, game.day.dateISO,
    feedbackFor(game.target, game.day.dateISO, 'full', {
      game: { playedWholeGame: true, timeOnGroundMinutes: 110, bodyRpe: 9, feel: 3 },
    }));
  check('game 110 x 9 accepted', gameResult.ok, gameResult);
  const optional = optionalStrength[0];
  const optionalResult = await commitFeedback(optional.target, optional.day.dateISO,
    feedbackFor(optional.target, optional.day.dateISO, 'full', {
      difficulty: 6, actualMinutes: 20,
    }));
  check('completed optional contributes accepted actual load', optionalResult.ok, optionalResult);
  const skippedResult = await commitFeedback(skippedOptional.target, skippedOptional.day.dateISO,
    feedbackFor(skippedOptional.target, skippedOptional.day.dateISO, 'skipped'));
  check('skipped optional is accepted without manufactured load', skippedResult.ok, skippedResult);

  await quietAsync(() => flushPendingStorageWrites());
  const rawProgram = await asyncStorageCompat.getItem('program-store');
  const persistedInputs = rawProgram
    ? (JSON.parse(rawProgram) as { state?: { inputs?: { sessionFeedback?: Record<string, SessionFeedback> } } })
      .state?.inputs?.sessionFeedback ?? {}
    : {};
  check('persisted accepted state retains 60 actual minutes',
    persistedInputs[strength.day.dateISO]?.actualMinutes === 60,
    persistedInputs[strength.day.dateISO]);

  const loadBeforeRestart = reconstructedLoad(INSTALL_DAY);
  const historiesBeforeRestart = buildProgressMainLiftHistories({
    weekStart: INSTALL_DAY,
    sessions: Object.entries(useProgramStore.getState().sessionFeedback)
      .map(([date, entry]) => ({ date, strength: entry.strength ?? [] })),
  });
  const savedBenchBefore = useProgramStore.getState().sessionFeedback[strength.day.dateISO]
    ?.strength?.find((entry) => entry.workoutExerciseId === bench.id)?.lastSetEstimate;
  check('saved Estimated 1RM basis is 62.5 kg x prescribed 10 at RIR 2',
    savedBenchBefore?.actualWeightKg === 62.5 && savedBenchBefore.actualReps === 10
      && savedBenchBefore.rir === 2,
    savedBenchBefore);
  check('weekly total includes all accepted preflight outcomes exactly once',
    loadBeforeRestart.thisWeek.completedLoadAU === 2330,
    loadBeforeRestart.thisWeek);
  check('skipped optional contributes zero after reconstruction',
    loadInput(skippedOptional.day.dateISO,
      useProgramStore.getState().sessionFeedback[skippedOptional.day.dateISO]).actualMinutes == null);

  const restarted = await relaunchApp({ storage: localStorageData, todayISO: game.day.dateISO });
  check('cold restart succeeds', restarted.ok, restarted);
  const loadAfterRestart = reconstructedLoad(INSTALL_DAY);
  const historiesAfterRestart = buildProgressMainLiftHistories({
    weekStart: INSTALL_DAY,
    sessions: Object.entries(useProgramStore.getState().sessionFeedback)
      .map(([date, entry]) => ({ date, strength: entry.strength ?? [] })),
  });
  check('restart reconstructs identical daily, weekly and rolling loads',
    JSON.stringify(loadAfterRestart.thisWeek) === JSON.stringify(loadBeforeRestart.thisWeek)
      && loadAfterRestart.rollingFourWeekCompletedLoadAU
        === loadBeforeRestart.rollingFourWeekCompletedLoadAU,
    { before: loadBeforeRestart.thisWeek, after: loadAfterRestart.thisWeek });
  check('restart reconstructs identical Estimated 1RM histories',
    JSON.stringify(historiesAfterRestart) === JSON.stringify(historiesBeforeRestart));
  check('cold restart retains actualMinutes',
    useProgramStore.getState().sessionFeedback[strength.day.dateISO]?.actualMinutes === 60);

  const feedbackBeforePhase = JSON.stringify(useProgramStore.getState().sessionFeedback);
  const phaseProfile = applyPhaseShift(useProfileStore.getState().onboardingData!, {
    targetPhase: 'Off-season',
  });
  const phaseChange = await quietAsync(() => commitProfileProgramTransaction({
    change: { kind: 'profile_setup', patch: {
      seasonPhase: phaseProfile.seasonPhase,
      seasonFinishedOn: phaseProfile.seasonFinishedOn,
      teamTrainingDays: phaseProfile.teamTrainingDays,
      teamTrainingDaysPerWeek: phaseProfile.teamTrainingDaysPerWeek,
      gameDay: phaseProfile.gameDay,
      usualGameDay: phaseProfile.usualGameDay,
    } },
    todayISO: plusDays(game.day.dateISO, 1),
    sourceSurface: 'lived_history_preflight_phase_change',
  }));
  check('phase change accepted', phaseChange.ok, phaseChange);
  check('phase change does not lose completed history',
    JSON.stringify(useProgramStore.getState().sessionFeedback) === feedbackBeforePhase);

  console.log(`\nlivedHistoryFoundationTests: ${passed} passed, ${failed} failed`);
  totalsPrinted(failed);
  console.log('NOT COVERED: the full 52-week replay, physical iPhones, phone install/wipe, '
    + 'remote sync and programming/fatigue/injury changes. Mounted UI is a separate Maestro '
    + 'preflight; this suite drives production builders, transactions, persistence and restart.');
  if (failures.length) console.log(`Failures:\n  - ${failures.join('\n  - ')}`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
