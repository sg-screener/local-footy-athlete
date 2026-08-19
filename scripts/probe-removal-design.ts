/**
 * DOES THE COMPOSER ALREADY DO WHAT REMOVE NEEDS? — the design experiment,
 * run before a line of production code is written.
 *
 * Claim under test: with the athlete's exclusion STORED, a ONE-WEEK scoped
 * regeneration (`microcycleLimit: 1`) makes `composeWeek` substitute a legal
 * same-pattern replacement carrying its own load, with no new owner and no new
 * stored shape. If this is false, the Remove design is wrong and better to know
 * now.
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
import type { TrainingProgram, Workout } from '../src/types/domain';
import { generateProgramLocally } from '../src/services/api/generateProgram';
import { useProgramStore } from '../src/store/programStore';
import { useProfileStore } from '../src/store/profileStore';
import { getBlockPositionForGeneration } from '../src/store/programStore';
import { quiet, setJourneyClock, leaveExerciseOut } from '../src/__tests__/support/athleteJourney';
import { getAthletePrefs } from '../src/store/athletePreferencesStore';
import type { OnboardingData } from '../src/types/domain';
import { addDaysISO } from '../src/utils/programBlockState';
import { useCalendarStore } from '../src/store/calendarStore';
import { commitRebuiltProgram } from '../src/utils/weekRebuild';
import { resolveWeekWithConditioning } from '../src/utils/sessionResolver';
import { buildScheduleStateImperative } from '../src/utils/coachWeekDiff';
import { resetStoresToFreshInstall } from '../src/__tests__/support/freshInstallStores';

// ⚠ INLINED, NOT IMPORTED FROM `probe-removal-slice`. That file installs its own
// `window`/`__DEV__` at module scope; importing it here ran the bootstrap twice
// and the second one broke module init with "Cannot read properties of
// undefined (reading 'call')". A probe is not a library.
const INSTALL_DAY = '2026-07-13';
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
  resetStoresToFreshInstall('removal-design:install');
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
    reason: 'removal-design:generate',
  }));
  useProgramStore.setState({ currentMicrocycle: settled } as never);
  return weekStart;
}
function session(dateISO: string, weekStartISO: string): { name: string; kg: number | null }[] {
  const week = quiet(() => resolveWeekWithConditioning(weekStartISO, buildScheduleStateImperative()));
  const day = week.find((d) => d.date === dateISO);
  const w = (day as { workout?: Workout } | undefined)?.workout;
  return (w?.exercises ?? []).map((r) => ({
    name: String((r as { exercise?: { name?: string } }).exercise?.name ?? (r as { name?: string }).name),
    kg: Number.isFinite((r as { prescribedWeightKg?: number }).prescribedWeightKg)
      ? Number((r as { prescribedWeightKg?: number }).prescribedWeightKg) : null,
  }));
}

const TARGET = '2026-07-22';

/**
 * ⚠ **A `Workout` CARRIES `dayOfWeek`, NOT A DATE.** The first version of this
 * reader looked for `workout.date`, found nothing, and printed "(date not found
 * in generated program)" — which read exactly like the recompose had failed. It
 * had not; the reader had.
 */
function rowsOf(program: TrainingProgram, dateISO: string): string[] {
  const dow = new Date(`${dateISO}T12:00:00`).getDay();
  for (const micro of program.microcycles ?? []) {
    for (const w of (micro as { workouts?: Workout[] }).workouts ?? []) {
      if (Number(w.dayOfWeek) !== dow) continue;
      return (w.exercises ?? []).map((r) => {
        const n = (r as { exercise?: { name?: string } }).exercise?.name ?? (r as { name?: string }).name;
        const kg = (r as { prescribedWeightKg?: number }).prescribedWeightKg;
        const sub = (r as { substitutedFrom?: { baseExerciseName?: string; cause?: string } }).substitutedFrom;
        return `${n}@${kg ?? '-'}${sub ? `  [swapped from ${sub.baseExerciseName} — ${sub.cause}]` : ''}`;
      });
    }
  }
  return [`(no workout on weekday ${dow})`];
}

function main(): void {
  const weekStart = install();
  setJourneyClock(TARGET);
  const before = session(TARGET, weekStart);
  const victim = before[0]!.name;
  console.log(`WEEK ${weekStart}  TARGET ${TARGET}  removing "${victim}"`);
  console.log(`  visible before: ${JSON.stringify(before.map((r) => `${r.name}@${r.kg ?? '-'}`))}`);

  // 1. THE DECISION — the owner the demolition kept.
  const decision = quiet(() => leaveExerciseOut({
    exercise: victim, scope: 'today_only', decidedOnISO: TARGET, reason: 'dont_like',
  })) as { ok?: boolean };
  console.log(`\n1. decision stored ok=${decision?.ok}`);
  console.log(`   prefs the generator will read: ${JSON.stringify(quiet(() => getAthletePrefs()).exclusions ?? [])}`);

  // 2. THE ONE-WEEK RECOMPOSE — the shared lane's own call, nothing new.
  const profile = useProfileStore.getState().onboardingData;
  const currentProgram = useProgramStore.getState().currentProgram;
  const pos = quiet(() => getBlockPositionForGeneration(weekStart)) as { blockNumber: number; blockStart: string };
  const regen = quiet(() => generateProgramLocally(profile as never, {
    recordSelections: 'replay',
    todayISO: weekStart,
    blockNumber: pos.blockNumber,
    blockStartISO: pos.blockStart,
    previousProgram: currentProgram as never,
    seasonPhaseClock: (currentProgram as { seasonPhaseClock?: unknown })?.seasonPhaseClock as never,
    microcycleLimit: 1,
    weekAcceptance: 'forward_decision',
  } as never)) as TrainingProgram;

  console.log(`\n2. one-week recompose (microcycleLimit: 1), athletePrefs read from the store by default`);
  console.log(`   regenerated ${TARGET}:`);
  for (const r of rowsOf(regen, TARGET)) console.log(`     ${r}`);

  const rows = rowsOf(regen, TARGET);
  const gone = !rows.some((r) => r.startsWith(`${victim}@`));
  const substituted = rows.filter((r) => r.includes('excluded_today'));
  console.log(`\n   VERDICT`);
  console.log(`     the excluded exercise is gone : ${gone}`);
  console.log(`     a substitution is RECORDED    : ${substituted.length > 0} ${JSON.stringify(substituted)}`);
  console.log(`     row count preserved           : ${rows.length} (visible before was ${before.length})`);
}
if (require.main === module) main();
