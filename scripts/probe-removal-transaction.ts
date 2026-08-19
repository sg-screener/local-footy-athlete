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

function main(): void {
  const weekStart = install();
  setJourneyClock(TARGET);
  const before = rowsOf(TARGET, weekStart);
  const otherDayBefore = rowsOf('2026-07-20', weekStart);
  const original = workoutOn(TARGET, weekStart)!;
  const victimIdx = 0;
  const victim = String((original.exercises![victimIdx] as { exercise?: { name?: string } }).exercise?.name);
  console.log(`WEEK ${weekStart}  TARGET ${TARGET}  removing "${victim}"`);
  console.log(`  before ${JSON.stringify(before)}`);

  const remaining: Workout = {
    ...JSON.parse(JSON.stringify(original)),
    exercises: original.exercises!.filter((_, i) => i !== victimIdx),
  } as Workout;

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { commitAthleteSessionDeletionTransaction } = require('../src/store/acceptedStateTransaction');
  let outcome: unknown;
  try {
    outcome = quiet(() => commitAthleteSessionDeletionTransaction({
      date: TARGET,
      reason: 'athlete_removed_exercise',
      source: 'tap',
      scope: 'strength_component',
      originalWorkout: original,
      remainingWorkout: remaining,
    }));
  } catch (e) {
    console.log(`  TRANSACTION THREW: ${(e as Error).message}`);
    return;
  }
  const o = outcome as { outcome?: string; ok?: boolean; published?: unknown };
  console.log(`\n  transaction outcome=${o?.outcome ?? '(none)'} ok=${o?.ok ?? '(n/a)'}`);

  const after = rowsOf(TARGET, weekStart);
  console.log(`  after  ${JSON.stringify(after)}`);
  console.log(`  the exercise is gone      : ${!after.some((r) => r.startsWith(`${victim}@`))}`);
  console.log(`  NOTHING replaced it       : ${after.length === before.length - 1} (${before.length} -> ${after.length})`);
  console.log(`  other rows byte-identical : ${JSON.stringify(after) === JSON.stringify(before.filter((r) => !r.startsWith(`${victim}@`)))}`);
  console.log(`  other DAY untouched       : ${JSON.stringify(rowsOf('2026-07-20', weekStart)) === JSON.stringify(otherDayBefore)}`);

  const constraints = (useProgramStore.getState() as unknown as { userRemovalConstraints?: unknown[] }).userRemovalConstraints ?? [];
  console.log(`\n  stored removal constraints: ${constraints.length}`);
  for (const c of constraints as { id: string; scope: string; targetDate: string; status: string; originalWorkout?: Workout }[]) {
    console.log(`    ${c.id}`);
    console.log(`      scope=${c.scope} date=${c.targetDate} status=${c.status} originalWorkout rows=${c.originalWorkout?.exercises?.length ?? 0}`);
  }

  // ── UNDO — the one decision-ledger owner, not a bespoke reversal ─────────
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { undoLastDecision, pendingUndoTarget, undoableDecisionCount } = require('../src/store/undoLastDecision');
  console.log(`\n  undoable decisions: ${quiet(() => undoableDecisionCount())}`);
  const target = quiet(() => pendingUndoTarget()) as { kind?: string; summary?: string } | null;
  console.log(`  pending undo target: ${target ? JSON.stringify({ kind: target.kind, summary: target.summary }) : 'none'}`);
  undoLastDecision().then((undo: { ok?: boolean; message?: string }) => {
    const restored = rowsOf(TARGET, weekStart);
    console.log(`  UNDO ok=${undo?.ok} "${undo?.message ?? ''}"`);
    console.log(`  after undo ${JSON.stringify(restored)}`);
    console.log(`  the EXACT item is back: ${restored.some((r) => r.startsWith(`${victim}@`))}`);
    console.log(`  and the day is identical to before: ${JSON.stringify(restored) === JSON.stringify(before)}`);
  }).catch((e: Error) => console.log(`  UNDO THREW ${e.message}`));
}
if (require.main === module) main();
