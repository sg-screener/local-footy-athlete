import type { OnboardingData, TrainingProgram } from '../types/domain';
import { assertAcceptedProgramInstallable, useProgramStore } from '../store/programStore';
import { computeGameDatesForBlock } from './sessionResolver';
import { logger } from './logger';
import { acceptedStatePresenceSummary } from '../store/acceptedStateColdStart';
import { dayOfWeekForISODate } from './appDate';
import { selectMicrocycleForDate } from './programBlockState';
import { storedGameAnchor } from '../rules/gameAnchor';

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
  todayISO: string;
  programStore?: Pick<
    ReturnType<typeof useProgramStore.getState>,
    'setCurrentProgram' | 'setCurrentMicrocycle' | 'setTodayWorkout'
  >;
  /**
   * Test-seed-only fixture materialisation. Real onboarding leaves the usual
   * game day on the accepted profile, where the resolver projects it each
   * week. Supplying this explicitly is reserved for deterministic harness
   * worlds whose registry includes dated fixture marks.
   */
  fixtureMarkInstaller?: { setGameDay: (date: string, todayISO?: string) => void };
}): void {
  const usesLiveProgramStore = args.programStore === undefined;
  const programStore = args.programStore ?? useProgramStore.getState();
  const { program, onboardingData } = args;

  // Fail fast, by name, BEFORE anything is installed (Sam ruling 2026-07-26,
  // option (b)). A program with no exposure contract cannot be installed —
  // every accepted-week read requires one — but accepting it used to succeed
  // here and detonate several steps later at `setGameDay`, so the athlete was
  // told a save had failed when the real fault was an uninstallable week.
  // Refusing here reports the fault at its cause. The accept path never
  // rebuilds a week to rescue it; structural migration belongs to hydration.
  assertAcceptedProgramInstallable(program);

  // Brand-new athlete program: this is a TRUE fresh slate. The full live
  // program input/result surface is cleared before acceptance; deterministic
  // harnesses inject their own closed program-store implementation and retain
  // exact seed ownership.
  runAcceptedStateStep('clear_previous_training_state', () => {
    if (usesLiveProgramStore) useProgramStore.getState().clear();
  });
  runAcceptedStateStep('set_current_program', () =>
    programStore.setCurrentProgram(program, {
      todayISO: args.todayISO,
      freshAcceptedContext: usesLiveProgramStore,
    }));

  // Select from the accepted store copy. The acceptance boundary may
  // canonicalise rows, and todayWorkout must reference that accepted raw row
  // rather than the pre-acceptance generation object.
  const acceptedProgram = useProgramStore.getState().currentProgram ?? program;
  const currentMicrocycle = selectMicrocycleForDate(
    acceptedProgram,
    null,
    args.todayISO,
  );
  runAcceptedStateStep('set_current_microcycle', () =>
    programStore.setCurrentMicrocycle(currentMicrocycle, args.todayISO));

  const acceptedCurrentMicrocycle = useProgramStore.getState().currentMicrocycle ??
    currentMicrocycle;
  const dayOfWeek = dayOfWeekForISODate(args.todayISO);
  const todayWorkout = acceptedCurrentMicrocycle?.workouts?.find(
    (workout) => workout.dayOfWeek === dayOfWeek,
  ) ?? null;
  runAcceptedStateStep('set_today_workout', () =>
    programStore.setTodayWorkout(todayWorkout, args.todayISO));

  // A recurring game day is already an accepted PROFILE fact and is projected
  // virtually by the resolver. Materialising every Saturday (or other chosen
  // day) as an explicit calendar override creates a second source of truth and
  // runs one accepted-state rebuild per fixture. That exact duplicate path
  // made a healthy generated program fail during onboarding with WC-142.
  // Only deterministic test seeds may ask for dated marks explicitly.
  const selectedGameDay = args.fixtureMarkInstaller
    ? storedGameAnchor(onboardingData)
    : null;
  if (args.fixtureMarkInstaller && selectedGameDay && program.startDate && program.endDate) {
    const gameDates = computeGameDatesForBlock(
      selectedGameDay,
      program.startDate,
      program.endDate,
    );
    logger.debug(`[Onboarding] Seeding ${gameDates.length} game dates for ${selectedGameDay}:`, gameDates);
    gameDates.forEach((date) => runAcceptedStateStep(
      `set_game_day:${date}`,
      () => args.fixtureMarkInstaller!.setGameDay(date, args.todayISO),
    ));
  }
}
