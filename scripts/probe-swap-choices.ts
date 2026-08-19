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
import { quiet, quietAsync, relaunchApp, setJourneyClock } from '../src/__tests__/support/athleteJourney';

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
  resetStoresToFreshInstall('removal-transaction:install');
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
    reason: 'removal-transaction:generate',
  }));
  useProgramStore.setState({ currentMicrocycle: settled } as never);
  return weekStart;
}


function rowsOf(dateISO: string, weekStartISO: string): string[] {
  const week = quiet(() => resolveWeekWithConditioning(weekStartISO, buildScheduleStateImperative()));
  const day = week.find((d) => d.date === dateISO);
  const w = (day as { workout?: Workout } | undefined)?.workout;
  return (w?.exercises ?? []).map((r) => {
    const n = (r as { exercise?: { name?: string } }).exercise?.name ?? (r as { name?: string }).name;
    const kg = (r as { prescribedWeightKg?: number }).prescribedWeightKg;
    return `${n}@${kg ?? '-'}`;
  });
}
function workoutOn(dateISO: string, weekStartISO: string): Workout | null {
  const week = quiet(() => resolveWeekWithConditioning(weekStartISO, buildScheduleStateImperative()));
  const day = week.find((d) => d.date === dateISO);
  return ((day as { workout?: Workout } | undefined)?.workout) ?? null;
}



/**
 * HOW MANY LEGAL SWAP CHOICES DOES THE LADDER ACTUALLY PRODUCE, AND IN WHICH
 * TIERS?
 *
 * Sam, 2026-08-19: *"Up to six legal choices: two Closest matches; two Similar
 * options; two Other useful options. Label the groups. Show fewer when good
 * legal options do not exist."*
 *
 * Asked BEFORE the sheet is built, because a three-group sheet is worth
 * building only if the ladder can fill more than one group. The screen takes
 * `getTapSwapChoices(...)[0]` today — one option, no groups — so nothing in the
 * app has ever read past the first entry.
 */
/* eslint-disable @typescript-eslint/no-var-requires */
function main(): void {
  const weekStart = install();
  setJourneyClock(TARGET);
  const { resolveTapSwapEnvironment, getTapSwapChoices } = require('../src/utils/tapSwapHierarchy');
  const workout = workoutOn(TARGET, weekStart)!;
  const names = (workout.exercises ?? []).map((r: any) => String(r.exercise?.name ?? r.name));
  console.log(`SESSION ${TARGET}: ${JSON.stringify(names)}`);
  const environment = quiet(() => resolveTapSwapEnvironment({
    date: TARGET,
    profile: useProfileStore.getState().onboardingData,
    activeConstraints: [],
    readinessSignal: null,
  }));
  for (const reason of ['preference', 'too_hard', 'too_easy', 'no_equipment'] as const) {
    console.log(`\n  reason=${reason}`);
    for (const name of names) {
      const choices = quiet(() => getTapSwapChoices({
        originalExercise: name,
        reason,
        environment,
        existingExerciseNames: names,
      })) as { name: string | null; hierarchyTier: string; source: string }[];
      const byTier: Record<string, string[]> = {};
      for (const c of choices) (byTier[c.hierarchyTier] ??= []).push(String(c.name));
      console.log(`    ${name.padEnd(24)} -> ${choices.length} choice(s)  `
        + Object.entries(byTier).map(([t, n]) => `${t}:${n.length}`).join(' '));
      for (const [tier, list] of Object.entries(byTier)) {
        console.log(`        ${tier}: ${JSON.stringify(list)}`);
      }
    }
  }
}
if (require.main === module) main();
