/**
 * WILL THE ACCEPTANCE BOUNDARY LET AN ATHLETE'S REMOVAL STAND?
 *
 * Sam, 2026-08-19: *"Remove means simply remove ... Nothing replaces it. The
 * session may have fewer exercises and may lose that movement pattern ...
 * Validation must not quietly force-fill an athlete-authorised removal."*
 *
 * That is the only question that decides whether Remove is buildable as
 * specified, so it is asked before anything is built: take the REAL accepted
 * week, drop one row the way a removal would, and put it through the REAL
 * acceptance boundary. If the boundary refuses a week with a missing pattern,
 * the athlete's decision cannot survive a transaction and the design has to
 * change.
 */
(global as unknown as { __DEV__: boolean }).__DEV__ = true;
const localStorageData = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (k: string) => localStorageData.get(k) ?? null,
    setItem: (k: string, v: string) => { localStorageData.set(k, v); },
    removeItem: (k: string) => { localStorageData.delete(k); },
    clear: () => { localStorageData.clear(); },
  },
};
(global as unknown as { fetch: () => never }).fetch = () => { throw new Error('NETWORK DISABLED'); };
process.env.TZ = 'Australia/Melbourne';

/* eslint-disable import/first */
import type { OnboardingData, TrainingProgram, Workout } from '../src/types/domain';
import { addDaysISO } from '../src/utils/programBlockState';
import { useProgramStore } from '../src/store/programStore';
import { useProfileStore } from '../src/store/profileStore';
import { useCalendarStore } from '../src/store/calendarStore';
import { generateProgramLocally } from '../src/services/api/generateProgram';
import { commitRebuiltProgram } from '../src/utils/weekRebuild';
import { resolveWeekWithConditioning } from '../src/utils/sessionResolver';
import { buildScheduleStateImperative } from '../src/utils/coachWeekDiff';
import { resetStoresToFreshInstall } from '../src/__tests__/support/freshInstallStores';
import { quiet, setJourneyClock } from '../src/__tests__/support/athleteJourney';

const INSTALL_DAY = '2026-07-13';
const TARGET = '2026-07-22';

function mondayFor(d: string): string {
  const p = new Date(`${d}T12:00:00Z`);
  return addDaysISO(d, -((p.getUTCDay() + 6) % 7));
}
function theAthlete(): OnboardingData {
  return {
    firstName: 'Sim', heightCm: 184, weightKg: 90, seasonPhase: 'Off-season',
    position: 'inside_mid', motivation: 'Dominate your level', trainingDaysPerWeek: 3,
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
    teamTrainingDaysPerWeek: 0, teamTrainingDays: [],
    teamTrainingDuration: '90 minutes', teamTrainingIntensity: 'Moderate',
    trainingLocation: 'Commercial gym',
    equipment: ['barbell', 'dumbbells', 'squat_rack', 'pullup_bar', 'cable_machine', 'hamstring_curl', 'knee_extension', 'bands'],
    experienceLevel: '5+ years', squatStrength: '1.5x bodyweight', benchStrength: '1.5x bodyweight+',
    conditioningLevel: 'Good', sprintExposure: '2+ times per week', recentTrainingLoad: 'Very consistent',
    injuries: [], twoKmTimeTrial: { seconds: 420, recordedOn: INSTALL_DAY, source: 'onboarding' },
    equipmentAnswer: {
      tags: { barbell: 'have', dumbbells: 'have', cables: 'have', machine: 'have', bands: 'have', bench: 'have', pullup_bar: 'have', kettlebell: 'have', foam_roller: 'have', plyo_box: 'have' },
      modalities: { bike_erg: 'have', air_bike: 'have', row: 'have', ski: 'have', treadmill: 'have' },
      answeredOn: INSTALL_DAY,
    },
    usualGameDay: 'Saturday', gameDay: 'Saturday',
  } as unknown as OnboardingData;
}
function install(): string {
  localStorageData.clear();
  resetStoresToFreshInstall('removal-validation:install');
  const profile = theAthlete();
  useProfileStore.getState().updateOnboardingData(profile);
  quiet(() => useProfileStore.getState().completeOnboarding());
  setJourneyClock(INSTALL_DAY);
  const program = quiet(() => generateProgramLocally(profile, {
    todayISO: INSTALL_DAY, previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1, selectedPhase: 'Off-season' as never,
      phaseEntryWeekStartISO: mondayFor(INSTALL_DAY),
      originProvenance: 'explicit_user_phase_change',
      persistenceProvenance: 'preserved_persisted_state',
    },
  })) as TrainingProgram;
  const settled = program.microcycles[1] ?? program.microcycles[0]!;
  const weekStart = String(settled.startDate).slice(0, 10);
  quiet(() => commitRebuiltProgram(program, { preserve: [], clear: [], conflictsRemoved: [] }, {
    markedDays: useCalendarStore.getState().markedDays ?? {}, selectedDate: weekStart,
    reason: 'removal-validation:generate',
  }));
  useProgramStore.setState({ currentMicrocycle: settled } as never);
  return weekStart;
}

function main(): void {
  const weekStart = install();
  setJourneyClock(TARGET);
  const week = quiet(() => resolveWeekWithConditioning(weekStart, buildScheduleStateImperative()));
  const day = week.find((d) => d.date === TARGET);
  const workout = (day as { workout?: Workout } | undefined)?.workout;
  if (!workout) throw new Error('no session on the target day');
  const names = (workout.exercises ?? []).map((r) =>
    String((r as { exercise?: { name?: string } }).exercise?.name ?? (r as { name?: string }).name));
  console.log(`WEEK ${weekStart}  TARGET ${TARGET}`);
  console.log(`  rows: ${JSON.stringify(names)}`);

  // The removal, done the way Sam means it: the row comes OUT and nothing
  // replaces it. Everything else on the day is conserved byte-for-byte.
  const victimIndex = 0;
  const victim = names[victimIndex]!;
  const reduced: Workout = {
    ...workout,
    exercises: (workout.exercises ?? []).filter((_, i) => i !== victimIndex),
  } as Workout;
  console.log(`\n  removing "${victim}" — ${workout.exercises!.length} rows -> ${reduced.exercises!.length}, nothing put back`);

  // ── THE REAL ACCEPTANCE BOUNDARY ────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const gateway = require('../src/rules/section18AcceptedWeekGateway');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const validation = require('../src/utils/postGenerationConstraintValidation');
  console.log(`\n  §18 gateway exports: ${Object.keys(gateway).filter((k) => typeof gateway[k] === 'function').slice(0, 12).join(', ')}`);
  console.log(`  write-validation exports: ${Object.keys(validation).filter((k) => typeof validation[k] === 'function').join(', ')}`);

  const reducedWeek = week.map((d) => (d.date === TARGET ? { ...d, workout: reduced } : d));
  for (const [name, fn] of Object.entries(validation) as [string, unknown][]) {
    if (typeof fn !== 'function') continue;
    try {
      (fn as (...a: unknown[]) => unknown)({
        workouts: reducedWeek.map((d) => (d as { workout?: Workout }).workout).filter(Boolean),
        weekStart,
        profile: useProfileStore.getState().onboardingData,
      });
      console.log(`    ${name}: returned (no throw)`);
    } catch (e) {
      console.log(`    ${name}: THREW ${(e as Error).message.slice(0, 140)}`);
    }
  }
}
if (require.main === module) main();
