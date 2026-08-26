/**
 * A DEV-ONLY LIVED WORLD FOR THE POPULATED COACH GLASS.
 *
 * This module never writes feedback, load history, readiness or a Coach
 * Snapshot directly. It advances the app clock and takes the same production
 * doors as the athlete: select week, type loads, submit feedback, roll the
 * block, leave an exercise out, and report readiness. The UI test therefore
 * mounts real accumulated inputs while remaining honest about its scope: the
 * glass run proves rendering, while the headless depth-35 test owns the domain
 * assertions and mutation arm.
 */

import type { DevE2ESeedId } from './devE2ESeedIds';
import type { LoggedSet, OnboardingData, Workout } from '../../types/domain';
import {
  DEV_E2E_CAMPAIGN_TIME_ZONE,
  createDevE2EClockReceipt,
  devE2EAnchorInstantForDate,
  setDevE2EClock,
} from './DevE2EClock';
import { todayISOLocal } from '../../utils/appDate';
import { addDaysISO, getProgramBlockRolloverStatus } from '../../utils/programBlockState';
import { rolloverProgramBlock } from '../../utils/programBlockRollover';
import { useProfileStore } from '../../store/profileStore';
import { useProgramStore } from '../../store/programStore';
import { useWorkoutLogStore } from '../../store/workoutLogStore';
import { getSessionComponents } from '../../utils/sessionComponents';
import {
  commitSessionOutcomeTransaction,
  createRecordSessionOutcomeIntentFromFeedback,
  resolveSessionOutcomeTarget,
} from '../../store/sessionOutcomeTransaction';
import { buildSessionFeedbackPayload, getVisibleFeedbackSections } from
  '../../utils/sessionFeedbackForm';
import { buildStrengthPerformanceLogs, collectLoggedStrengthSets } from
  '../../utils/strengthLogging';
import { getConditioningLoggingConfig } from '../../utils/conditioningLogging';
import { resolveWeekWithConditioning } from '../../utils/sessionResolver';
import { buildScheduleStateImperative } from '../../utils/coachWeekDiff';
import { applyExerciseExclusionDecision } from '../../utils/exerciseExclusionOwner';
import { executeProgramControlActionDurably } from '../../utils/programControlActions';
import { generateProgramLocally } from '../../services/api/generateProgram';
import { seedOnboardingProgram } from '../../utils/onboardingCompletion';
import { resetDevE2EWorldThroughPublicAPIs } from './devE2EWorldReset';

function mondayFor(dateISO: string): string {
  const parsed = new Date(`${dateISO}T12:00:00.000Z`);
  return addDaysISO(dateISO, -((parsed.getUTCDay() + 6) % 7));
}

const JOURNEY_START = '2026-07-13';

function journeyAthlete(): OnboardingData {
  return {
    firstName: 'Jordan',
    ageRange: '22-26',
    position: 'inside_mid',
    heightCm: 182,
    weightKg: 84,
    motivation: 'Dominate your level',
    gender: 'male',
    seasonPhase: 'Off-season',
    seasonFinishedOn: '2026-07-12',
    trainingDaysPerWeek: 3,
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    teamTrainingDuration: '90 minutes',
    teamTrainingIntensity: 'Hard',
    trainingLocation: 'Commercial gym',
    equipmentSelectionCompleteness: 'complete',
    equipment: [
      'barbell', 'dumbbells', 'squat_rack', 'pullup_bar', 'cable_machine',
      'hamstring_curl', 'knee_extension', 'bands',
    ],
    equipmentAnswer: {
      tags: {
        barbell: 'have', dumbbells: 'have', cables: 'have', machine: 'have',
        bands: 'have', bench: 'have', pullup_bar: 'have', kettlebell: 'have',
        foam_roller: 'have', plyo_box: 'have',
      },
      modalities: {
        bike_erg: 'have', air_bike: 'have', row: 'have', ski: 'have',
        treadmill: 'have',
      },
      answeredOn: JOURNEY_START,
    },
    injuries: [],
    goals: ['Get stronger'],
    experienceLevel: '5+ years',
    squatStrength: '1.5x bodyweight',
    benchStrength: '1.25x bodyweight',
    conditioningLevel: 'Good',
    sprintExposure: '2+ times per week',
    recentTrainingLoad: 'Pretty consistent',
    twoKmTimeTrial: {
      seconds: 420,
      recordedOn: JOURNEY_START,
      source: 'onboarding',
    },
  } as unknown as OnboardingData;
}

async function installJourneyBlockOne(seedId: DevE2ESeedId): Promise<void> {
  resetDevE2EWorldThroughPublicAPIs();
  setJourneyDate(seedId, JOURNEY_START);
  const profile = journeyAthlete();
  useProfileStore.getState().updateOnboardingData(profile);
  let program: ReturnType<typeof generateProgramLocally>;
  try {
    program = generateProgramLocally(profile, {
      weekAcceptance: 'restoration',
      todayISO: JOURNEY_START,
    } as never);
  } catch (error) {
    throw new Error(`coach_snapshot_journey_onboarding_generation_threw:${String(error)}`);
  }
  seedOnboardingProgram({
    onboardingData: profile,
    program,
    todayISO: JOURNEY_START,
  });
  const completion = useProfileStore.getState().completeOnboarding();
  if (!completion.ok) {
    throw new Error(
      `coach_snapshot_journey_onboarding_refused:${completion.missingAnswers.join(',')}`,
    );
  }
}

function setJourneyDate(seedId: DevE2ESeedId, dateISO: string): void {
  const receipt = createDevE2EClockReceipt({
    seedId,
    anchorInstant: devE2EAnchorInstantForDate(dateISO, DEV_E2E_CAMPAIGN_TIME_ZONE),
    timezone: DEV_E2E_CAMPAIGN_TIME_ZONE,
    createdAt: '2026-08-24T00:00:00.000Z',
  });
  if (!setDevE2EClock(receipt) || todayISOLocal() !== dateISO) {
    throw new Error(`coach_snapshot_journey_clock_refused:${dateISO}`);
  }
}

function selectVisibleWeek(dateISO: string): void {
  const weekStart = mondayFor(dateISO);
  const state = useProgramStore.getState();
  if (state.currentMicrocycle?.startDate.slice(0, 10) === weekStart) return;
  const microcycle = state.currentProgram?.microcycles
    .find((candidate) => candidate.startDate.slice(0, 10) === weekStart);
  if (microcycle) {
    // Through the store owner, and only on the one day the visible week moves.
    // Re-running this same accepted-week selection every day is both false to
    // the app and materially more work than the athlete performs.
    state.setCurrentMicrocycle(microcycle, dateISO);
  }
}

function rolloverIfDue(dateISO: string): boolean {
  const state = useProgramStore.getState();
  const status = getProgramBlockRolloverStatus({
    program: state.currentProgram,
    dateISO,
    blockState: state.blockState,
  });
  if (!status.needsRollover) return false;
  let result: ReturnType<typeof rolloverProgramBlock>;
  try {
    result = rolloverProgramBlock({
      baseProfile: useProfileStore.getState().onboardingData,
      targetDateISO: dateISO,
    });
  } catch (error) {
    throw new Error(`coach_snapshot_journey_rollover_threw:${dateISO}:${String(error)}`);
  }
  if (result.refusal) {
    throw new Error(`coach_snapshot_journey_rollover_refused:${result.refusal.code}`);
  }
  return true;
}

function conditioningQuestionIsVisible(
  workout: Workout,
  components: readonly { id: unknown }[],
): boolean {
  const config = getConditioningLoggingConfig(workout);
  const performed = components.some((component) =>
    String(component.id).includes('conditioning'));
  return getVisibleFeedbackSections('full', {
    includeConditioningPerformance: config.level === 'trackable' && performed,
  }).some((section) => section.id === 'conditioning');
}

function typePrescribedLoads(dateISO: string, workout: Workout): void {
  const logStore = useWorkoutLogStore.getState();
  const programStore = useProgramStore.getState();
  for (const row of workout.exercises ?? []) {
    const weight = Number(row.prescribedWeightKg);
    if (!Number.isFinite(weight) || weight <= 0) continue;
    const sets = Math.max(1, Number(row.prescribedSets) || 1);
    for (let setNumber = 1; setNumber <= sets; setNumber += 1) {
      logStore.logSet(row.id, {
        id: `coach-snapshot-journey:${dateISO}:${row.id}:${setNumber}`,
        loggedWorkoutId: `coach-snapshot-journey:${dateISO}`,
        workoutExerciseId: row.id,
        setNumber,
        actualReps: Number(row.prescribedRepsMax) || undefined,
        actualWeightKg: weight,
        createdAt: `${dateISO}T12:00:00.000Z`,
        updatedAt: `${dateISO}T12:00:00.000Z`,
      } as LoggedSet);
    }
    programStore.setWeightOverride(dateISO, row.exerciseId, weight);
  }
}

async function recordVisibleSession(dateISO: string): Promise<boolean> {
  let workout: Workout;
  try {
    workout = resolveSessionOutcomeTarget(dateISO).workout;
  } catch (error) {
    if (/session_not_found|No visible session/.test(String(error))) return false;
    throw error;
  }
  const components = getSessionComponents(workout);
  typePrescribedLoads(dateISO, workout);
  const loggedSets = collectLoggedStrengthSets(
    workout,
    useWorkoutLogStore.getState().loggedSets,
    undefined,
  );
  const strength = buildStrengthPerformanceLogs(
    workout,
    useProgramStore.getState().weightOverrides?.[dateISO] ?? {},
    'full',
    loggedSets,
  );
  const componentCompletions = Object.fromEntries(
    components.map((component) => [String(component.id), 'full' as const]),
  );
  const feedback = buildSessionFeedbackPayload({
    dateStr: dateISO,
    completion: 'full',
    componentCompletions,
    components,
    feeling: 'good',
    soreness: 'mild',
    difficulty: 6,
    partialReason: null,
    skipReason: null,
    ...(strength.length > 0 ? { strength } : {}),
    ...(conditioningQuestionIsVisible(workout, components)
      ? { conditioning: { rpe: 6 } }
      : {}),
  } as never);
  if (!feedback) {
    throw new Error(`coach_snapshot_journey_feedback_refused:${dateISO}`);
  }
  const result = await commitSessionOutcomeTransaction(
    createRecordSessionOutcomeIntentFromFeedback({
      date: dateISO,
      workout,
      feedback,
      source: {
        entryPoint: 'tap',
        surface: 'coach_snapshot_journey',
        interpretedIntent: 'record_session_outcome',
        traceId: `coach-snapshot-journey:${dateISO}`,
      } as never,
    }),
  );
  if (!result.ok) {
    throw new Error(
      `coach_snapshot_journey_session_refused:${dateISO}:` +
      `${(result as { code?: string }).code ?? 'unknown'}`,
    );
  }
  return true;
}

function leaveOneCurrentExerciseOut(dateISO: string): void {
  const exercise = resolveWeekWithConditioning(
    mondayFor(dateISO),
    buildScheduleStateImperative(),
  ).flatMap((day) => day.workout?.exercises ?? [])
    .map((row) => row.exercise?.name ?? (row as { name?: string }).name)
    .find((name): name is string => typeof name === 'string' && name.length > 0);
  if (!exercise) throw new Error('coach_snapshot_journey_exercise_missing');
  const result = applyExerciseExclusionDecision({
    exercise,
    scope: 'this_block',
    decidedOnISO: dateISO,
    reason: 'athlete preference',
  });
  if (!result.ok || !result.exclusion) {
    throw new Error('coach_snapshot_journey_exclusion_refused');
  }
}

export async function runCoachSnapshotPopulatedJourney(args: {
  seedId: DevE2ESeedId;
  throughDate: string;
}): Promise<void> {
  const startDate = useProgramStore.getState().currentProgram
    ?.microcycles[0]?.startDate.slice(0, 10);
  if (!startDate) throw new Error('coach_snapshot_journey_program_missing');
  let recorded = 0;
  let rollovers = 0;
  for (let dateISO = startDate; dateISO <= args.throughDate;
    dateISO = addDaysISO(dateISO, 1)) {
    setJourneyDate(args.seedId, dateISO);
    try {
      if (rolloverIfDue(dateISO)) rollovers += 1;
    } catch (error) {
      throw new Error(`coach_snapshot_journey_rollover_stage:${dateISO}:${String(error)}`);
    }
    try {
      selectVisibleWeek(dateISO);
    } catch (error) {
      throw new Error(`coach_snapshot_journey_week_selection_stage:${dateISO}:${String(error)}`);
    }
    try {
      if (await recordVisibleSession(dateISO)) recorded += 1;
    } catch (error) {
      throw new Error(`coach_snapshot_journey_session_stage:${dateISO}:${String(error)}`);
    }
  }
  const feedbackDates = Object.keys(useProgramStore.getState().sessionFeedback);
  const earnedWeeks = new Set(feedbackDates.map(mondayFor));
  if (recorded < 15 || earnedWeeks.size !== 5 || rollovers !== 1) {
    throw new Error(
      `coach_snapshot_journey_depth_failed:recorded=${recorded}:weeks=${earnedWeeks.size}:rollovers=${rollovers}`,
    );
  }
  leaveOneCurrentExerciseOut(args.throughDate);
}

export async function startCoachSnapshotPopulatedJourney(): Promise<void> {
  const seedId: DevE2ESeedId = 'standard-in-season-week';
  await installJourneyBlockOne(seedId);
  await runCoachSnapshotPopulatedJourney({
    seedId,
    throughDate: addDaysISO(JOURNEY_START, 34),
  });
}

/** Report cooked while Coach remains mounted; the hook must repaint live. */
export async function runCoachSnapshotCookedCheckIn(): Promise<void> {
  const dateISO = todayISOLocal();
  const weekStart = mondayFor(dateISO);
  const visibleWeek = resolveWeekWithConditioning(
    weekStart,
    buildScheduleStateImperative(),
  );
  const result = await executeProgramControlActionDurably({
    type: 'set_fatigue_status',
    source: {
      screen: 'program_tab',
      surface: 'how_are_you_feeling',
      initiatedBy: 'tap',
    },
    scope: 'today_only',
    payload: { date: dateISO, todayISO: dateISO, level: 'cooked' },
    requiresRebuild: false,
    createsActiveModifier: true,
    oneOffOnly: false,
  } as never, { visibleWeek, todayISO: dateISO });
  if (!result.ok) {
    throw new Error(`coach_snapshot_cooked_check_in_refused:${result.message}`);
  }
}
