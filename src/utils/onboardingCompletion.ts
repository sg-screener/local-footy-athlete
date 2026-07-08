import type { OnboardingData, TrainingProgram } from '../types/domain';
import { useProgramStore } from '../store/programStore';
import { useCalendarStore } from '../store/calendarStore';
import { computeGameDatesForBlock } from './sessionResolver';
import { logger } from './logger';

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
  useProgramStore.getState().clearManualOverrides();
  programStore.setCurrentProgram(program);
  if (program.microcycles && program.microcycles.length > 0) {
    const firstMicrocycle = program.microcycles[0];
    programStore.setCurrentMicrocycle(firstMicrocycle);

    const today = new Date();
    const dayOfWeek = today.getDay();
    const todayWorkout = firstMicrocycle.workouts?.find(
      (w) => w.dayOfWeek === dayOfWeek,
    );
    if (todayWorkout) {
      programStore.setTodayWorkout(todayWorkout);
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
    gameDates.forEach((date) => calendarStore.setGameDay(date));
  }
}
