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
 * DOES A REMOVAL SCOPE REACH THE ALREADY-AUTHORED SESSIONS IT PROMISES?
 *
 * Sam, 2026-08-19: *"This block removes the exercise from every remaining
 * already-authored session in this block. Until restored removes it from
 * current and future sessions/blocks."*
 *
 * Three scopes, three spans, one real athlete and the REAL visible-week door.
 * A control run at the top proves the instrument can see a row at all, because
 * a filter that reports "gone" on a week it never read reports the same clean
 * zero as a filter that works.
 */
/* eslint-disable @typescript-eslint/no-var-requires */
async function main(): Promise<void> {
  const weekStart = install();
  setJourneyClock(TARGET);

  const { applyExerciseExclusionDecision, restoreExcludedExercise } =
    require('../src/utils/exerciseExclusionOwner');
  const { getAthleteExclusions } = require('../src/store/athletePreferencesStore');

  // Which authored days inside the block carry the victim at all?
  const original = workoutOn(TARGET, weekStart)!;
  const victim = String((original.exercises![0] as { exercise?: { name?: string } }).exercise?.name);
  const weeks = Array.from({ length: 8 }, (_, i) => addDaysISO(weekStart, i * 7));
  const days: string[] = [];
  for (const w of weeks) for (let i = 0; i < 7; i++) days.push(addDaysISO(w, i));

  const carriesBefore = days.filter((d) => rowsOf(d, mondayFor(d)).some((r) => r.startsWith(`${victim}@`)));
  console.log(`VICTIM "${victim}"  decided on ${TARGET}`);
  console.log(`  CONTROL — authored days carrying it across 4 weeks: ${JSON.stringify(carriesBefore)}`);
  if (carriesBefore.length === 0) {
    console.log('  ⚠ CONTROL FAILED — the instrument cannot see the row anywhere. Everything below is a false zero.');
    return;
  }
  const blockEnd = (() => {
    const { useProgramStore: ps } = require('../src/store/programStore');
    const { getStoredBlockStateForDate } = require('../src/utils/programBlockState');
    const stored = ps.getState().blockState;
    return stored ? getStoredBlockStateForDate(stored, TARGET).blockEnd : null;
  })();
  console.log(`  block the athlete is standing in ends: ${blockEnd}`);

  for (const scope of ['today_only', 'this_block', 'until_changed'] as const) {
    const decision = quiet(() => applyExerciseExclusionDecision({
      exercise: victim, scope, decidedOnISO: TARGET,
    })) as { exclusion?: { activeThroughISO: string | null; blockNumber: number | null } };
    const carriesAfter = days.filter((d) => rowsOf(d, mondayFor(d)).some((r) => r.startsWith(`${victim}@`)));
    const gone = carriesBefore.filter((d) => !carriesAfter.includes(d));
    const rowsToday = rowsOf(TARGET, weekStart);
    console.log(`\n  scope=${scope}  activeThrough=${decision.exclusion?.activeThroughISO ?? 'null'} block=${decision.exclusion?.blockNumber}`);
    console.log(`    still carries it : ${JSON.stringify(carriesAfter)}`);
    console.log(`    removed from     : ${JSON.stringify(gone)}`);
    console.log(`    ${TARGET} rows   : ${JSON.stringify(rowsToday)}`);
    console.log(`    nothing refilled : ${rowsToday.length === rowsOf(TARGET, weekStart).length}`);
    quiet(() => restoreExcludedExercise(victim));
  }

  // RESTORE — the exact rows come back, everywhere.
  const carriesRestored = days.filter((d) => rowsOf(d, mondayFor(d)).some((r) => r.startsWith(`${victim}@`)));
  console.log(`\n  after RESTORE, carries it again: ${JSON.stringify(carriesRestored)}`);
  console.log(`  identical to the control        : ${JSON.stringify(carriesRestored) === JSON.stringify(carriesBefore)}`);
  console.log(`  stored exclusions left          : ${(getAthleteExclusions() ?? []).length}`);

  // ⚠ THE CONTROL THAT DECIDES WHOSE FAULT A POST-RESTART CHANGE IS.
  // A restart REGENERATES (`quiescentBoot`). If the week changes across a
  // restart with NO exclusion stored at all, then a change seen WITH one is not
  // evidence about removal — it is evidence about boot.
  const { blockSelectionHistory } = require('../src/store/blockSelectionHistoryStore');
  console.log(`\n  selection history before any restart: ${JSON.stringify(blockSelectionHistory())}`);
  const controlBefore = rowsOf(TARGET, weekStart);
  const controlRelaunch = await quietAsync(() => relaunchApp({ storage: localStorageData, todayISO: TARGET }));
  const controlAfter = rowsOf(TARGET, mondayFor(TARGET));
  console.log(`  CONTROL RESTART with NO exclusion (${controlRelaunch.ok ? 'ok' : controlRelaunch.error})`);
  console.log(`    before: ${JSON.stringify(controlBefore)}`);
  console.log(`    after : ${JSON.stringify(controlAfter)}`);
  console.log(`    boot alone preserves the week: ${JSON.stringify(controlBefore) === JSON.stringify(controlAfter)}`);
  console.log(`    selection history after: ${JSON.stringify(blockSelectionHistory())}`);

  // RESTART — the decision must survive a reboot of the world.
  quiet(() => applyExerciseExclusionDecision({ exercise: victim, scope: 'this_block', decidedOnISO: TARGET }));
  const beforeRestart = days.filter((d) => rowsOf(d, mondayFor(d)).some((r) => r.startsWith(`${victim}@`)));
  const relaunch = await quietAsync(() => relaunchApp({ storage: localStorageData, todayISO: TARGET }));
  const restartOk = relaunch.ok ? 'ok' : `BOOT FAILED ${relaunch.error}`;
  const afterRestart = days.filter((d) => rowsOf(d, mondayFor(d)).some((r) => r.startsWith(`${victim}@`)));
  console.log(`\n  RESTART (${restartOk})`);
  console.log(`    carries it before restart: ${JSON.stringify(beforeRestart)}`);
  console.log(`    carries it after  restart: ${JSON.stringify(afterRestart)}`);
  console.log(`    survived                 : ${JSON.stringify(beforeRestart) === JSON.stringify(afterRestart)}`);
  // ⚠ POSITIVE CONTROL FOR THE RESTART. An empty list after a restart is the
  // same empty list a probe prints when the world failed to come back at all.
  quiet(() => restoreExcludedExercise(victim));
  const afterRestartRestored = days.filter((d) => rowsOf(d, mondayFor(d)).some((r) => r.startsWith(`${victim}@`)));
  console.log(`    CONTROL restore after restart: ${JSON.stringify(afterRestartRestored)}`);
  console.log(`    the post-restart zero was REAL: ${afterRestartRestored.length > 0}`);
  for (const d of ['2026-07-22', '2026-07-29', '2026-08-05']) {
    console.log(`    post-restart rows ${d} (week ${mondayFor(d)}): ${JSON.stringify(rowsOf(d, mondayFor(d)))}`);
  }
  // ⚠ IS THE HOLE A FILTER, OR HAS IT BEEN BAKED INTO STORED STATE? A filter
  // that has been persisted is not a filter — Restore could never undo it.
  const prog = (useProgramStore.getState() as unknown as { currentProgram?: { microcycles?: { startDate: string; workouts: Workout[] }[] } }).currentProgram;
  for (const mc of prog?.microcycles ?? []) {
    const wed = mc.workouts.find((w) => w.dayOfWeek === 3);
    console.log(`    STORED microcycle ${String(mc.startDate).slice(0, 10)} Wed rows: `
      + `${JSON.stringify((wed?.exercises ?? []).map((r: any) => r.exercise?.name ?? r.name))}`);
  }
}
if (require.main === module) main().catch((e) => { console.log(`PROBE THREW ${(e as Error).message}`); process.exit(1); });
