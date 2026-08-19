/**
 * REMOVE MEANS REMOVE — SAM'S CONTRACT, DRIVEN THROUGH THE REAL DOOR.
 *
 * Sam, 2026-08-19: *"Remove means simply remove the selected exercise/component.
 * Nothing replaces it. The session may have fewer exercises and may lose that
 * movement pattern. **Do not ask the composer to fill the empty slot.** This
 * block removes the exercise from every remaining already-authored session in
 * this block. Until restored removes it from current and future
 * sessions/blocks. Undo restores the exact removed item. No second removal
 * authority survives."*
 *
 * Every cell drives PRODUCTION: `executeProgramControlAction` for the tap,
 * `applyExerciseExclusionDecision` for the scope answer,
 * `resolveWeekWithConditioning` through `buildScheduleStateImperative` for what
 * the athlete sees, and `relaunchApp` for the restart.
 *
 * ## THE CONTROL IS THE POINT, IN EVERY CASE
 *
 * A cell that removes a row and asserts its absence is GREEN AND EMPTY when the
 * row was never there, and a cell that reads the wrong week reports the same
 * confident zero. So each case first names the days that DO carry the exercise
 * and refuses to continue if there are none.
 *
 * ## WHAT THIS SUITE DOES NOT COVER
 *
 * The simulator. Every case here is headless.
 *
 * Run: npm run test:exercise-removal-owner
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = true;
const durable = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (k: string) => durable.get(k) ?? null,
    setItem: (k: string, v: string) => { durable.set(k, v); },
    removeItem: (k: string) => { durable.delete(k); },
    clear: () => { durable.clear(); },
  },
};
(global as unknown as { fetch: () => never }).fetch = () => { throw new Error('NETWORK DISABLED'); };
process.env.TZ = 'Australia/Melbourne';

/* eslint-disable import/first, @typescript-eslint/no-var-requires */
import type { OnboardingData, TrainingProgram, Workout } from '../types/domain';
import { addDaysISO } from '../utils/programBlockState';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { generateProgramLocally } from '../services/api/generateProgram';
import { commitRebuiltProgram } from '../utils/weekRebuild';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { resetStoresToFreshInstall } from './support/freshInstallStores';
import { quiet, quietAsync, relaunchApp, setJourneyClock } from './support/athleteJourney';
import { applyExerciseExclusionDecision, restoreExcludedExercise } from '../utils/exerciseExclusionOwner';
import { getAthleteExclusions } from '../store/athletePreferencesStore';
import { executeProgramControlAction } from '../utils/programControlActions';

const INSTALL_DAY = '2026-07-13';
/** A Wednesday inside the athlete's first block, three days after install. */
const TARGET = '2026-07-22';
/** The Monday BEFORE the decision — a session that is already lived. */
const PAST = '2026-07-20';

let passed = 0;
const failures: string[] = [];
function ok(label: string, condition: boolean, detail?: string): void {
  if (condition) { passed++; console.log(`  ✓ ${label}`); return; }
  failures.push(detail ? `${label} — ${detail}` : label);
  console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
}

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
  durable.clear();
  resetStoresToFreshInstall('exercise-removal-owner:install');
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
    reason: 'exercise-removal-owner:generate',
  }));
  useProgramStore.setState({ currentMicrocycle: settled } as never);
  setJourneyClock(TARGET);
  return weekStart;
}

/** What the athlete sees on a day, exactly as the screen reads it. */
function rowsOn(dateISO: string): string[] {
  const week = quiet(() => resolveWeekWithConditioning(
    mondayFor(dateISO),
    buildScheduleStateImperative(),
  ));
  const day = week.find((d) => d.date === dateISO);
  const workout = (day as { workout?: Workout } | undefined)?.workout;
  return (workout?.exercises ?? []).map((row) => {
    const name = (row as { exercise?: { name?: string } }).exercise?.name
      ?? (row as { name?: string }).name;
    const kg = (row as { prescribedWeightKg?: number }).prescribedWeightKg;
    return `${name}@${kg ?? '-'}`;
  });
}

/** Every authored day across the athlete's first four weeks that carries `name`. */
function daysCarrying(weekStart: string, name: string): string[] {
  const days: string[] = [];
  for (let w = 0; w < 4; w++) {
    for (let i = 0; i < 7; i++) {
      const date = addDaysISO(addDaysISO(weekStart, w * 7), i);
      if (rowsOn(date).some((row) => row.startsWith(`${name}@`))) days.push(date);
    }
  }
  return days;
}

function victimOn(dateISO: string): string {
  const rows = rowsOn(dateISO);
  return rows[0]!.split('@')[0]!;
}

function storedProgramCount(name: string): number {
  const program = (useProgramStore.getState() as unknown as {
    currentProgram?: { microcycles?: { workouts: Workout[] }[] };
  }).currentProgram;
  let count = 0;
  for (const mc of program?.microcycles ?? []) {
    for (const workout of mc.workouts ?? []) {
      for (const row of workout.exercises ?? []) {
        const rowName = (row as { exercise?: { name?: string } }).exercise?.name;
        if (rowName === name) count++;
      }
    }
  }
  return count;
}

async function main(): Promise<void> {
  /* ═══════════════════════════════════════════════════════════════════════ */
  console.log('\n[1] TODAY ONLY — one session loses it, and nothing else does');

  let weekStart = install();
  const victim = victimOn(TARGET);
  const before = rowsOn(TARGET);
  const pastBefore = rowsOn(PAST);
  const carriedBefore = daysCarrying(weekStart, victim);
  ok('CONTROL — the exercise is on at least two authored days',
    carriedBefore.length >= 2, `carries=${JSON.stringify(carriedBefore)}`);
  if (carriedBefore.length < 2) {
    console.log('  ⚠ CONTROL FAILED — every zero below would be false. Stopping.');
    report();
    return;
  }

  const tap = quiet(() => executeProgramControlAction({
    type: 'remove_exercise',
    source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' },
    scope: 'today_only',
    payload: { date: TARGET, exercise: victim },
    requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true,
  })) as { ok: boolean; changedProgram: boolean; requiresRebuild: boolean };
  ok('the door reports the change', tap.ok && tap.changedProgram);
  ok('and asks for NO rebuild — a rebuild is what would refill the slot',
    tap.requiresRebuild === false);

  const after = rowsOn(TARGET);
  ok('the exercise is gone from that session',
    !after.some((row) => row.startsWith(`${victim}@`)), JSON.stringify(after));
  ok('NOTHING replaced it — exactly one row fewer',
    after.length === before.length - 1, `${before.length} -> ${after.length}`);
  ok('every other row is byte-identical, load included',
    JSON.stringify(after) === JSON.stringify(before.filter((r) => !r.startsWith(`${victim}@`))));
  ok('the other authored days are untouched',
    daysCarrying(weekStart, victim).join() === carriedBefore.filter((d) => d !== TARGET).join(),
    JSON.stringify(daysCarrying(weekStart, victim)));
  /* ⚠ **THIS CELL WAS GREEN AND EMPTY, AND A MUTATION SAID SO.**
   *
   * It used `PAST = 2026-07-20`, the Monday before the decision — a day that
   * does not carry the victim at all. Deleting `exclusionIsActiveOn`'s lower
   * bound outright left all 32 cells green, because a day with nothing to lose
   * loses nothing either way. The bound is what makes Sam's *"every REMAINING
   * already-authored session"* true, so it is asked of a day that would
   * genuinely change: an EARLIER day that DOES carry the exercise, with the
   * decision taken later in the block. */
  ok('a session the athlete has already lived is not reached',
    JSON.stringify(rowsOn(PAST)) === JSON.stringify(pastBefore));

  ok('exactly ONE decision was stored', getAthleteExclusions().length === 1,
    JSON.stringify(getAthleteExclusions()));

  /* ═══════════════════════════════════════════════════════════════════════ */
  console.log('\n[1b] REMAINING MEANS REMAINING — a later decision cannot reach back');

  weekStart = install();
  const reachVictim = victimOn(TARGET);
  const reachCarried = daysCarrying(weekStart, reachVictim);
  const laterDay = reachCarried[reachCarried.length - 1]!;
  const earlierDay = reachCarried[0]!;
  ok('CONTROL — there is an EARLIER authored day that carries it',
    earlierDay < laterDay && rowsOn(earlierDay).some((r) => r.startsWith(`${reachVictim}@`)),
    `earlier=${earlierDay} later=${laterDay}`);
  const earlierBefore = rowsOn(earlierDay);
  quiet(() => applyExerciseExclusionDecision({
    exercise: reachVictim, scope: 'this_block', decidedOnISO: laterDay,
  }));
  ok('a decision taken LATER does not reach back into an earlier authored session',
    JSON.stringify(rowsOn(earlierDay)) === JSON.stringify(earlierBefore),
    `${JSON.stringify(rowsOn(earlierDay))} vs ${JSON.stringify(earlierBefore)}`);
  ok('and it DID reach the day it was taken on — the control for the line above',
    !rowsOn(laterDay).some((r) => r.startsWith(`${reachVictim}@`)),
    JSON.stringify(rowsOn(laterDay)));
  quiet(() => restoreExcludedExercise(reachVictim));

  /* ═══════════════════════════════════════════════════════════════════════ */
  console.log('\n[2] THIS BLOCK — every REMAINING already-authored session loses it');

  weekStart = install();
  const blockVictim = victimOn(TARGET);
  const blockCarried = daysCarrying(weekStart, blockVictim);
  ok('CONTROL — more than one authored day carries it',
    blockCarried.length >= 2, JSON.stringify(blockCarried));
  const blockDecision = quiet(() => applyExerciseExclusionDecision({
    exercise: blockVictim, scope: 'this_block', decidedOnISO: TARGET,
  }));
  const blockEnd = blockDecision.exclusion?.activeThroughISO ?? null;
  ok('the decision carries a stamped block expiry', Boolean(blockEnd) && blockEnd! > TARGET,
    `activeThrough=${blockEnd}`);
  const stillCarries = daysCarrying(weekStart, blockVictim);
  const expected = blockCarried.filter((d) => d < TARGET || d > (blockEnd ?? TARGET));
  ok('every remaining authored session in the block has lost it',
    JSON.stringify(stillCarries) === JSON.stringify(expected),
    `still=${JSON.stringify(stillCarries)} expected=${JSON.stringify(expected)}`);
  ok('and the days it left were more than one — the scope actually reached',
    blockCarried.length - stillCarries.length >= 2,
    `reached ${blockCarried.length - stillCarries.length} day(s)`);

  /* ═══════════════════════════════════════════════════════════════════════ */
  console.log('\n[3] EXPIRY — the decision stops, by arithmetic, with no sweep');

  ok('a day after the block end still carries it, if the program authored one there',
    daysCarrying(weekStart, blockVictim).every((d) => d < TARGET || d > blockEnd!),
    JSON.stringify(daysCarrying(weekStart, blockVictim)));
  const todayOnly = quiet(() => applyExerciseExclusionDecision({
    exercise: blockVictim, scope: 'today_only', decidedOnISO: TARGET,
  }));
  ok('changing the scope updates the SAME decision, it does not add one',
    getAthleteExclusions().filter((e) => e.exercise === todayOnly.exclusion?.exercise).length === 1);
  ok('and the narrower scope immediately gives the later sessions back',
    daysCarrying(weekStart, blockVictim).length === blockCarried.length - 1,
    JSON.stringify(daysCarrying(weekStart, blockVictim)));

  /* ═══════════════════════════════════════════════════════════════════════ */
  console.log('\n[4] RESTORE — the EXACT item, on the EXACT day');

  quiet(() => restoreExcludedExercise(blockVictim));
  ok('the decision is gone', getAthleteExclusions().length === 0);
  ok('every day that carried it carries it again',
    JSON.stringify(daysCarrying(weekStart, blockVictim)) === JSON.stringify(blockCarried));
  ok('and the restored day is byte-identical to before the removal — the EXACT item',
    rowsOn(TARGET).some((row) => row.startsWith(`${blockVictim}@`)),
    JSON.stringify(rowsOn(TARGET)));

  /* ═══════════════════════════════════════════════════════════════════════ */
  console.log('\n[5] RESTART — the decision survives, and NOTHING takes the empty slot');

  weekStart = install();
  const restartVictim = victimOn(TARGET);
  const restartCarried = daysCarrying(weekStart, restartVictim);
  quiet(() => applyExerciseExclusionDecision({
    exercise: restartVictim, scope: 'this_block', decidedOnISO: TARGET,
  }));
  const beforeRestart = rowsOn(TARGET);
  const relaunch = await quietAsync(() => relaunchApp({ storage: durable, todayISO: TARGET }));
  ok('the app came back up', relaunch.ok, relaunch.error ?? '');
  ok('the decision survived the process death',
    getAthleteExclusions().some((e) => e.exercise === restartVictim));
  const afterRestart = rowsOn(TARGET);
  ok('the athlete still does not see it', !afterRestart.some((r) => r.startsWith(`${restartVictim}@`)),
    JSON.stringify(afterRestart));
  /* ⚠ **THE CELL THIS SUITE EXISTS FOR.** Before the replay-authority fix, the
   * boot regenerated with the exclusion narrowing the block selector, the
   * recorded selection could no longer be restored, and `Deadlift` walked into
   * the hinge slot. The athlete removed a lift and got a DIFFERENT lift back for
   * closing the app — a refill the read filter could never catch, because the
   * row it removes is no longer the row that is there. */
  ok('and NOTHING walked into the empty slot',
    afterRestart.length === beforeRestart.length,
    `before=${JSON.stringify(beforeRestart)} after=${JSON.stringify(afterRestart)}`);
  /* The other half: the authored row must SURVIVE in the stored program, or
   * Restore has nothing exact to give back. */
  ok('the stored program KEPT the row, so Restore stays exact',
    storedProgramCount(restartVictim) > 0, `stored=${storedProgramCount(restartVictim)}`);
  quiet(() => restoreExcludedExercise(restartVictim));
  ok('and after a restart, Restore still returns every day',
    daysCarrying(weekStart, restartVictim).length === restartCarried.length,
    `${JSON.stringify(daysCarrying(weekStart, restartVictim))} vs ${JSON.stringify(restartCarried)}`);

  /* ═══════════════════════════════════════════════════════════════════════ */
  console.log('\n[6] HONEST TYPED FAILURES — never a shrug, never a silent no-op');

  weekStart = install();
  const missing = quiet(() => executeProgramControlAction({
    type: 'remove_exercise',
    source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' },
    scope: 'today_only',
    payload: { date: TARGET, exercise: 'Zercher Carry From Atlantis' },
    requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true,
  })) as { ok: boolean; message?: string };
  ok('a name the session does not carry is REFUSED', missing.ok === false);
  ok('and the refusal names the exercise and the day',
    Boolean(missing.message?.includes('Zercher Carry From Atlantis') && missing.message?.includes(TARGET)),
    missing.message);
  ok('and it wrote NO decision', getAthleteExclusions().length === 0,
    JSON.stringify(getAthleteExclusions()));

  const emptyDay = quiet(() => executeProgramControlAction({
    type: 'remove_exercise',
    source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' },
    scope: 'today_only',
    payload: { date: '2027-12-25', exercise: victim },
    requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true,
  })) as { ok: boolean; message?: string };
  ok('a day with no session at all is REFUSED, and says so', emptyDay.ok === false
    && Boolean(emptyDay.message?.includes('2027-12-25')), emptyDay.message);

  /* ═══════════════════════════════════════════════════════════════════════ */
  console.log('\n[7] NO SECOND REMOVAL AUTHORITY SURVIVES');

  const coachActions = require('../utils/coachActions') as Record<string, unknown>;
  ok('`removeExerciseAtDate` is DELETED, not deprecated',
    coachActions.removeExerciseAtDate === undefined);
  const coachAttempt = quiet(() => (coachActions.applyCoachAction as (a: unknown) => {
    success: boolean; reason?: string;
  })({ kind: 'remove_exercise', payload: { date: TARGET, exercise: victim } }));
  ok('the coach path REFUSES rather than keeping a private removal',
    coachAttempt.success === false, JSON.stringify(coachAttempt));
  ok('and the refusal points at the one door that records the decision',
    Boolean(coachAttempt.reason?.toLowerCase().includes('remove on the session')),
    coachAttempt.reason);

  report();
}

function report(): void {
  console.log(`\n${'─'.repeat(72)}`);
  if (failures.length === 0) {
    console.log(`ALL GREEN — ${passed} passed`);
    return;
  }
  console.log(`FAILURES — ${passed} passed, ${failures.length} failed`);
  for (const failure of failures) console.log(`  ✗ ${failure}`);
  process.exitCode = 1;
}

main().catch((error) => {
  console.log(`SUITE THREW ${(error as Error).message}`);
  console.log((error as Error).stack);
  process.exitCode = 1;
});
