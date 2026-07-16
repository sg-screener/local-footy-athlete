import type { OnboardingData, TrainingProgram } from '../types/domain';
import { useProgramStore } from '../store/programStore';
import { useCalendarStore } from '../store/calendarStore';
import { computeGameDatesForBlock } from './sessionResolver';
import { logger } from './logger';
import { acceptedStatePresenceSummary } from '../store/acceptedStateColdStart';
import { dayOfWeekForISODate, todayISOLocal } from './appDate';

export type OnboardingPipelineStage =
  | 'generation'
  | 'section18_acceptance'
  | 'accepted_state_transaction'
  | 'persistence'
  | 'onboarding_navigation';

export class OnboardingPipelineError extends Error {
  readonly originalStack: string | null;

  constructor(
    public readonly stage: OnboardingPipelineStage,
    public readonly step: string,
    public readonly cause: unknown,
  ) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = 'OnboardingPipelineError';
    this.originalStack = cause instanceof Error ? cause.stack ?? null : null;
  }
}

function inferOnboardingPipelineStage(
  error: unknown,
  fallback: Exclude<OnboardingPipelineStage, 'generation' | 'onboarding_navigation'>,
): Exclude<OnboardingPipelineStage, 'generation' | 'onboarding_navigation'> {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code ?? '')
    : '';
  const name = error instanceof Error ? error.name : '';
  if (code === 'section18_week_rejected' || code === 'section18_legacy_migration_failed') {
    return 'section18_acceptance';
  }
  if (/storage|persist/i.test(`${code} ${name}`)) return 'persistence';
  return fallback;
}

export function toOnboardingPipelineError(
  error: unknown,
  stage: OnboardingPipelineStage,
  step: string,
): OnboardingPipelineError {
  if (error instanceof OnboardingPipelineError) return error;
  const inferred = stage === 'accepted_state_transaction' || stage === 'persistence'
    ? inferOnboardingPipelineStage(error, stage)
    : stage;
  return new OnboardingPipelineError(inferred, step, error);
}

export function logOnboardingPipelineError(
  scope: string,
  error: OnboardingPipelineError,
): void {
  const state = useProgramStore.getState();
  logger.error(`[Onboarding][${error.stage}] ${scope}`, {
    stage: error.stage,
    step: error.step,
    errorName: error.cause instanceof Error ? error.cause.name : typeof error.cause,
    message: error.message,
    stack: error.originalStack,
    surfaces: acceptedStatePresenceSummary({
      program: state,
      context: state.acceptedMaterialContext,
    }),
  });
}

function runAcceptedStateStep(step: string, body: () => void): void {
  try {
    body();
  } catch (error) {
    throw toOnboardingPipelineError(error, 'accepted_state_transaction', step);
  }
}

export function seedOnboardingProgram(args: {
  onboardingData: OnboardingData;
  program: TrainingProgram;
  programStore?: Pick<
    ReturnType<typeof useProgramStore.getState>,
    'setCurrentProgram' | 'setCurrentMicrocycle' | 'setTodayWorkout'
  >;
  calendarStore?: Pick<ReturnType<typeof useCalendarStore.getState>, 'setGameDay'>;
}): void {
  const programStore = args.programStore ?? useProgramStore.getState();
  const calendarStore = args.calendarStore ?? useCalendarStore.getState();
  const { program, onboardingData } = args;

  // Brand-new athlete program: a TRUE fresh slate is intended here, so the
  // override wipe is explicit. (setCurrentProgram no longer clears
  // overrides implicitly — override lifecycle belongs to the canonical
  // rebuild sweep; see programStore.setCurrentProgram.)
  runAcceptedStateStep('clear_manual_overrides', () =>
    useProgramStore.getState().clearManualOverrides());
  runAcceptedStateStep('set_current_program', () =>
    programStore.setCurrentProgram(program));
  if (program.microcycles && program.microcycles.length > 0) {
    const firstMicrocycle = program.microcycles[0];
    runAcceptedStateStep('set_current_microcycle', () =>
      programStore.setCurrentMicrocycle(firstMicrocycle));

    const dayOfWeek = dayOfWeekForISODate(todayISOLocal());
    const todayWorkout = firstMicrocycle.workouts?.find(
      (w) => w.dayOfWeek === dayOfWeek,
    );
    if (todayWorkout) {
      runAcceptedStateStep('set_today_workout', () =>
        programStore.setTodayWorkout(todayWorkout));
    }
  }

  const selectedGameDay = onboardingData?.gameDay;
  if (selectedGameDay && selectedGameDay !== 'Varies' && program.startDate && program.endDate) {
    const gameDates = computeGameDatesForBlock(
      selectedGameDay,
      program.startDate,
      program.endDate,
    );
    logger.debug(`[Onboarding] Seeding ${gameDates.length} game dates for ${selectedGameDay}:`, gameDates);
    gameDates.forEach((date) => runAcceptedStateStep(
      `set_game_day:${date}`,
      () => calendarStore.setGameDay(date),
    ));
  }
}
