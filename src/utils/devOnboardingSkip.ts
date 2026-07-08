import type { OnboardingData, TrainingProgram } from '../types/domain';
import { DEFAULT_PROGRAM } from '../data/defaultProgram';
import {
  ProgramGenError,
  buildProgramGenerationRequestDiagnostics,
  generateProgramFromProfile,
  getProgramGenerationProfileFieldDiagnostics,
} from '../services/api/generateProgram';
import { useProfileStore } from '../store/profileStore';
import { useProgramStore } from '../store/programStore';
import { useCalendarStore } from '../store/calendarStore';
import { logger } from './logger';
import { seedOnboardingProgram } from './onboardingCompletion';

export const DEV_TEST_ONBOARDING_DATA: OnboardingData = {
  firstName: 'Sam',
  heightCm: 184,
  weightKg: 90,
  position: 'inside_mid',
  motivation: 'Stay injury-free',
  goals: ['Stay injury-free'],
  seasonPhase: 'In-season',
  gameDay: 'Saturday',
  usualGameDay: 'Saturday',
  teamTrainingDaysPerWeek: 2,
  teamTrainingDays: ['Tuesday', 'Thursday'],
  teamTrainingDuration: '90 minutes',
  teamTrainingIntensity: 'Moderate',
  trainingDaysPerWeek: 5,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  sessionDurationMinutes: 60,
  trainingLocation: 'Commercial gym',
  equipment: [
    'barbell',
    'dumbbells',
    'squat_rack',
    'pullup_bar',
    'cable_machine',
    'hamstring_curl',
    'knee_extension',
    'bands',
  ],
  experienceLevel: '5+ years',
  squatStrength: '1.5x bodyweight',
  benchStrength: '1.5x bodyweight+',
  conditioningLevel: 'Elite',
  sprintExposure: '2+ times per week',
  recentTrainingLoad: 'Very consistent',
  injuries: [],
  biggestLimitation: 'Power & explosiveness',
  biggestFrustration: 'Getting a week that respects team training and game day.',
  successVision: 'A durable in-season week that keeps strength and conditioning ticking over without cooking the legs.',
};

export function isDevOnboardingSkipEnabled(
  isDev: boolean =
    typeof __DEV__ !== 'undefined'
      ? __DEV__
      : process.env.NODE_ENV !== 'production',
): boolean {
  return isDev;
}

export async function runDevOnboardingSkip(args: {
  onboardingData?: OnboardingData;
  generateProgram?: (data: OnboardingData) => Promise<TrainingProgram>;
  profileStore?: Pick<
    ReturnType<typeof useProfileStore.getState>,
    'updateOnboardingData' | 'completeOnboarding'
  >;
  programStore?: Pick<
    ReturnType<typeof useProgramStore.getState>,
    'setCurrentProgram' | 'setCurrentMicrocycle' | 'setTodayWorkout'
  > & Partial<Pick<ReturnType<typeof useProgramStore.getState>, 'setError'>>;
  calendarStore?: Pick<ReturnType<typeof useCalendarStore.getState>, 'setGameDay'>;
} = {}): Promise<{ program: TrainingProgram; onboardingData: OnboardingData; usedFallback: boolean }> {
  const onboardingData = args.onboardingData ?? DEV_TEST_ONBOARDING_DATA;
  const profileStore = args.profileStore ?? useProfileStore.getState();
  const programStore = args.programStore ?? useProgramStore.getState();
  const generate = args.generateProgram ?? generateProgramFromProfile;
  const generationSource = args.generateProgram ? 'injected_generator' : 'coach-chat';
  let program: TrainingProgram;
  let usedFallback = false;

  // ── Smoke-test diagnostic markers ────────────────────────────────
  // These three lines are the deterministic trace that the live-smoke
  // wrapper greps from the simulator system log. Do not remove without
  // updating scripts/smoke-coach-bike-flow.js diagnostics.
  logger.info('[dev-skip] started');

  profileStore.updateOnboardingData(onboardingData);
  logger.info('[dev-skip] profile seeded');

  try {
    program = await generate(onboardingData);
    logger.warn(
      generationSource === 'coach-chat'
        ? '[dev-onboarding-skip] Using generated program from coach-chat'
        : '[dev-onboarding-skip] Using generated program from injected generator',
      {
        source: generationSource,
        programId: program.id,
        programName: program.name,
        microcycleCount: program.microcycles?.length ?? 0,
        firstMicrocycleWorkoutCount: program.microcycles?.[0]?.workouts?.length ?? 0,
        firstWorkout: program.microcycles?.[0]?.workouts?.[0]
          ? {
            dayOfWeek: program.microcycles[0].workouts[0].dayOfWeek,
            name: program.microcycles[0].workouts[0].name,
            workoutType: program.microcycles[0].workouts[0].workoutType,
            sessionTier: program.microcycles[0].workouts[0].sessionTier ?? null,
          }
          : null,
      },
    );
  } catch (err: any) {
    usedFallback = true;
    const fieldDiagnostics = getProgramGenerationProfileFieldDiagnostics(onboardingData);
    const requestDiagnostics = buildProgramGenerationRequestDiagnostics(onboardingData);
    const programGenError = err instanceof ProgramGenError ? err : null;
    const fallbackReason =
      programGenError?.diagnostic ??
      err?.message ??
      String(err);
    const fallbackWarning =
      `DEV WARNING: Program generation failed during skip onboarding. Using DEFAULT_PROGRAM because: ${fallbackReason}`;
    logger.error('[dev-onboarding-skip] Program generation failed', {
      errorName: err?.name ?? 'Error',
      kind: programGenError?.kind ?? 'unknown',
      canRetry: programGenError?.canRetry ?? null,
      userMessage: programGenError?.userMessage ?? err?.message ?? String(err),
      diagnostic: fallbackReason,
      details: programGenError?.details ?? null,
      request: requestDiagnostics,
      missingProfileFields: fieldDiagnostics,
      fallbackReason,
    });
    logger.warn(`[dev-onboarding-skip] Using DEFAULT_PROGRAM fallback because: ${fallbackReason}`, {
      warning: fallbackWarning,
      defaultProgram: {
        id: DEFAULT_PROGRAM.id,
        name: DEFAULT_PROGRAM.name,
        microcycleCount: DEFAULT_PROGRAM.microcycles?.length ?? 0,
        firstMicrocycleWorkoutCount: DEFAULT_PROGRAM.microcycles?.[0]?.workouts?.length ?? 0,
      },
    });
    programStore.setError?.(fallbackWarning);
    program = DEFAULT_PROGRAM;
  }

  seedOnboardingProgram({
    onboardingData,
    program,
    programStore,
    calendarStore: args.calendarStore,
  });
  profileStore.completeOnboarding();
  logger.info('[dev-skip] completeOnboarding called');

  return { program, onboardingData, usedFallback };
}
