import type { OnboardingData, TrainingProgram } from '../types/domain';
import { DEFAULT_PROGRAM } from '../data/defaultProgram';
import { generateProgramFromProfile } from '../services/api/generateProgram';
import { useProfileStore } from '../store/profileStore';
import { useProgramStore } from '../store/programStore';
import { useCalendarStore } from '../store/calendarStore';
import { logger } from './logger';
import { seedOnboardingProgram } from './onboardingCompletion';

export const DEV_TEST_ONBOARDING_DATA: OnboardingData = {
  firstName: 'Sam',
  heightCm: 184,
  weightKg: 90,
  position: 'Midfielder',
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
  >;
  calendarStore?: Pick<ReturnType<typeof useCalendarStore.getState>, 'setGameDay'>;
} = {}): Promise<{ program: TrainingProgram; onboardingData: OnboardingData; usedFallback: boolean }> {
  const onboardingData = args.onboardingData ?? DEV_TEST_ONBOARDING_DATA;
  const profileStore = args.profileStore ?? useProfileStore.getState();
  const generate = args.generateProgram ?? generateProgramFromProfile;
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
  } catch (err: any) {
    usedFallback = true;
    logger.warn('[dev-onboarding-skip] Program generation failed; using DEFAULT_PROGRAM', {
      message: err?.message ?? String(err),
    });
    program = DEFAULT_PROGRAM;
  }

  seedOnboardingProgram({
    onboardingData,
    program,
    programStore: args.programStore,
    calendarStore: args.calendarStore,
  });
  profileStore.completeOnboarding();
  logger.info('[dev-skip] completeOnboarding called');

  return { program, onboardingData, usedFallback };
}
