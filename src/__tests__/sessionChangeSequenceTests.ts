/**
 * ONE ATHLETE, EVERY DOOR, IN SEQUENCE — AND THEN A RESTART.
 *
 * Sam, 2026-08-19: *"Run the combined sequential-action and restart flow."*
 *
 * Each of Remove, Swap, Add and Injury has its own gate. This is the one that
 * asks whether they **compose**: whether a swap after a removal still lands,
 * whether an add sees the session the earlier actions left, whether the injury
 * pass respects decisions already made — and whether ALL of it is still there
 * after the process dies.
 *
 * ## WHY A COMBINED WALK IS NOT REDUNDANT WITH FOUR GREEN GATES
 *
 * Every gate above installs a FRESH world and takes ONE action. Three of the
 * four defects this branch fixed were interaction defects that a single-action
 * world cannot show: the removal that a boot re-decided into a different lift,
 * the read filter that a WRITE path persisted, and an injury claim that was true
 * about a transaction and false about the rows. A sequence is where those live.
 *
 * ## WHAT THIS SUITE DOES NOT COVER
 *
 * The simulator. Every step here is headless, through the real action doors.
 *
 * Run: npm run test:session-change-sequence
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
  const { executeProgramControlActionDurably, executeProgramControlAction } =
    require('../utils/programControlActions');
  const { resolveTapSwapEnvironment, getTapSwapChoices, groupTapSwapChoices } =
    require('../utils/tapSwapHierarchy');
  const { legalAddCandidateGroups } = require('../utils/addExerciseCandidates');
  const { buildGuidedInjuryConstraint } = require('../utils/guidedInjuryControl');
  const { unsafeRowsForInjury } = require('../utils/injurySessionRecomposition');
  const { restoreExcludedExercise } = require('../utils/exerciseExclusionOwner');

  console.log('\n[1] THE WALK — remove, then swap, then add, on ONE session');

  install();
  setJourneyClock(TARGET);
  const start = rowsOn(TARGET);
  ok('CONTROL — the athlete has a real session to change',
    start.length >= 4, JSON.stringify(start));

  // ── REMOVE ─────────────────────────────────────────────────────────────
  const removed = start[0]!.split('@')[0]!;
  const removeResult = await quietAsync(() => executeProgramControlActionDurably({
    type: 'remove_exercise',
    source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' },
    scope: 'today_only',
    payload: { date: TARGET, exercise: removed },
    requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true,
  }, { todayISO: TARGET })) as { ok: boolean };
  const afterRemove = rowsOn(TARGET);
  ok('REMOVE landed', removeResult.ok && !afterRemove.some((r) => r.startsWith(`${removed}@`)),
    JSON.stringify(afterRemove));
  ok('and nothing took its place', afterRemove.length === start.length - 1,
    `${start.length} -> ${afterRemove.length}`);

  // ── SWAP, on the session the removal left ──────────────────────────────
  const swapVictim = afterRemove[0]!.split('@')[0]!;
  const environment = quiet(() => resolveTapSwapEnvironment({
    date: TARGET, profile: useProfileStore.getState().onboardingData,
    activeConstraints: [], readinessSignal: null,
  }));
  const menu = groupTapSwapChoices(quiet(() => getTapSwapChoices({
    originalExercise: swapVictim, reason: 'preference', environment,
    existingExerciseNames: afterRemove.map((r) => r.split('@')[0]!),
  }))) as { choices: { name: string }[] }[];
  ok('CONTROL — the swap menu still has something after a removal',
    menu.length > 0 && menu[0]!.choices.length > 0, JSON.stringify(menu));
  const replacement = menu[0]!.choices[0]!.name;
  const swapResult = await quietAsync(() => executeProgramControlActionDurably({
    type: 'swap_exercise',
    source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' },
    scope: 'today_only',
    payload: {
      date: TARGET, fromExercise: swapVictim,
      toExercise: { name: replacement, sets: 3, repsMin: 6, repsMax: 8 },
    },
    requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true,
  }, { todayISO: TARGET })) as { ok: boolean; message?: string };
  const afterSwap = rowsOn(TARGET);
  ok('SWAP landed on top of the removal', swapResult.ok
    && afterSwap.some((r) => r.startsWith(`${replacement}@`)), JSON.stringify(afterSwap));
  ok('and the removed exercise did NOT come back with it',
    !afterSwap.some((r) => r.startsWith(`${removed}@`)), JSON.stringify(afterSwap));
  ok('the swap replaced rather than grew', afterSwap.length === afterRemove.length,
    `${afterRemove.length} -> ${afterSwap.length}`);

  // ── ADD, seeing what the first two left ────────────────────────────────
  const onTheDay = afterSwap.map((r) => r.split('@')[0]!);
  const addGroups = legalAddCandidateGroups({
    environment, existingExerciseNames: onTheDay,
    profile: useProfileStore.getState().onboardingData,
  }) as { candidates: { name: string }[] }[];
  ok('CONTROL — the add menu is not empty after two changes', addGroups.length > 0);
  ok('and it does not offer the replacement the swap just put on the day',
    addGroups.every((g) => g.candidates.every((c) => c.name !== replacement)),
    replacement);
  const added = addGroups[0]!.candidates[0]!.name;
  const addResult = await quietAsync(() => executeProgramControlActionDurably({
    type: 'add_exercise',
    source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' },
    scope: 'today_only',
    payload: { date: TARGET, exercise: { name: added, sets: 2, repsMin: 8, repsMax: 12 } },
    requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true,
  }, { todayISO: TARGET })) as { ok: boolean };
  const afterAdd = rowsOn(TARGET);
  ok('ADD landed', addResult.ok && afterAdd.some((r) => r.startsWith(`${added}@`)),
    JSON.stringify(afterAdd));
  ok('and it took nothing away', afterAdd.length === afterSwap.length + 1,
    `${afterSwap.length} -> ${afterAdd.length}`);
  ok('all three decisions are visible at once',
    !afterAdd.some((r) => r.startsWith(`${removed}@`))
      && afterAdd.some((r) => r.startsWith(`${replacement}@`))
      && afterAdd.some((r) => r.startsWith(`${added}@`)),
    JSON.stringify(afterAdd));

  /* ═══════════════════════════════════════════════════════════════════════ */
  console.log('\n[2] THE RESTART — every decision survives the process dying');

  const beforeRestart = rowsOn(TARGET);
  const relaunch = await quietAsync(() => relaunchApp({ storage: durable, todayISO: TARGET }));
  ok('the app came back up', relaunch.ok, relaunch.error ?? '');
  const afterRestart = rowsOn(TARGET);
  ok('the removal survived',
    !afterRestart.some((r) => r.startsWith(`${removed}@`)), JSON.stringify(afterRestart));
  /* ⚠ **AND NOTHING WALKED INTO THE HOLE.** This is the defect that shipped
   * unnoticed until this branch: the boot regenerates, and with the exclusion
   * reaching the block selector it re-decided the slot and put a DIFFERENT lift
   * back. A sequence is the only place it is visible — a single-action world
   * that never restarts cannot show it. */
  ok('and nothing took the removed slot during the boot',
    afterRestart.filter((r) => !beforeRestart.includes(r)).length === 0
      || afterRestart.length <= beforeRestart.length,
    `before=${JSON.stringify(beforeRestart)} after=${JSON.stringify(afterRestart)}`);
  ok('the add survived',
    afterRestart.some((r) => r.startsWith(`${added}@`)), JSON.stringify(afterRestart));
  /* ⚠⚠ **THIS CELL IS RED ON PURPOSE AND IT IS THE BRANCH'S ONE OPEN DEFECT.**
   *
   * The swap does not survive a restart. Measured here, three actions deep:
   *
   * ```
   * before restart  [..., <replacement>, ...]
   * after  restart  ["Bulgarian Split Squats", ..., "Back Squat"]
   *                  ^ the original is back      ^ the ADD replayed fine
   * ```
   *
   * The removal survives (it is a decision in athlete preferences) and the ADD
   * survives (its ledger replay lands), so this is not "the ledger is not
   * replayed" — it is the SWAP's replay specifically. Remove, swap and add each
   * write a `dateOverride` for the same day during replay, and the later writes
   * appear to compose from a base that does not carry the earlier one, so the
   * last write wins and the swap is the one that loses.
   *
   * **NOT FIXED HERE, AND NOT HIDDEN.** The fix is in how overrides for one day
   * compose during ledger replay, which is `quiescentBoot`'s ordering and not
   * this mission's five doors. Editing this expectation to match would be the
   * `expectation-edited-to-match-the-regression` defect; the cell stays, it
   * names the defect, and the suite is RED until someone closes it. */
  ok('the swap survived — ⚠ OPEN DEFECT, see the note above this cell',
    afterRestart.some((r) => r.startsWith(`${replacement}@`)), JSON.stringify(afterRestart));

  /* ═══════════════════════════════════════════════════════════════════════ */
  console.log('\n[3] INJURY OVER THE TOP — and it still tells the truth');

  const constraint = buildGuidedInjuryConstraint({
    region: 'lower_body', area: 'knee', severity: 6,
    severityBand: 'caution', adjustmentLevel: 'reduce_load',
    triggers: ['during'], seriousSymptoms: false,
  } as never, { todayISO: TARGET }) as { bucket?: string; severity: number };
  const beforeInjury = rowsOn(TARGET);
  const injuryResult = await quietAsync(() => executeProgramControlActionDurably({
    type: 'set_injury_modifier',
    source: { screen: 'session_detail', surface: 'exercise_injury_flow', initiatedBy: 'tap' },
    scope: 'current_and_future',
    payload: { constraint },
    requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
  }, { todayISO: TARGET })) as { ok: boolean; changedProgram: boolean; message?: string };
  const afterInjury = rowsOn(TARGET);
  const injuryEnv = quiet(() => resolveTapSwapEnvironment({
    date: TARGET, profile: useProfileStore.getState().onboardingData,
    activeConstraints: [], readinessSignal: null,
    primaryInjury: { bucket: constraint.bucket, severity: constraint.severity },
  }));
  const stillUnsafe = unsafeRowsForInjury({
    workout: (() => {
      const week = quiet(() => resolveWeekWithConditioning(
        mondayFor(TARGET), buildScheduleStateImperative()));
      return (week.find((d) => d.date === TARGET) as { workout?: Workout }).workout ?? null;
    })(),
    environment: injuryEnv,
  }) as string[];
  console.log(`    "${injuryResult.message ?? ''}"`);
  ok('the injury door still reports honestly after three earlier changes',
    injuryResult.changedProgram === (JSON.stringify(beforeInjury) !== JSON.stringify(afterInjury)),
    `changedProgram=${injuryResult.changedProgram}`);
  ok('and nothing unsafe is left under a claim that it is safe',
    stillUnsafe.length === 0 || /could not be made safe/i.test(injuryResult.message ?? ''),
    `${JSON.stringify(stillUnsafe)} / "${injuryResult.message}"`);
  ok('the earlier removal is STILL honoured under an injury pass',
    !afterInjury.some((r) => r.startsWith(`${removed}@`)), JSON.stringify(afterInjury));

  /* ═══════════════════════════════════════════════════════════════════════ */
  console.log('\n[4] RESTORE, AT THE END OF ALL OF IT');

  const beforeRestore = rowsOn(TARGET);
  quiet(() => restoreExcludedExercise(removed));
  const afterRestore = rowsOn(TARGET);
  /* ⚠ THE CLAIM IS ABOUT THE REMOVAL, AND ONLY THE REMOVAL. The first cut also
   * asserted the ADD was still there, and it was not — the injury pass one case
   * up had legitimately swapped it out, because the exercise the add chose was a
   * squat and the declared injury is a knee. A restore cell that fails because
   * an injury pass did its job is a cell about the wrong subject. */
  /* ⚠⚠ **THE SECOND OPEN DEFECT, AND IT IS THE SAME SHAPE AS THE FIRST.**
   *
   * Restore does not bring the row back once a SWAP has landed on the same day.
   * Traced here: the injury pass correctly leaves the excluded row alone — the
   * plan's `unsafe` list is `["Bulgarian Split Squats","Back Squat"]` with
   * `RDLs` filtered out — but `replaceExerciseAtDate` then writes the day's
   * override from a read that ALREADY HAS THE FILTER APPLIED, so the hidden row
   * is baked out of the stored override permanently and there is nothing left
   * for Restore to reveal.
   *
   * **This is the "a filter that gets written down is not a filter" defect,
   * one door along.** It was closed at the compose owner and at the resolver by
   * putting the exclusions on `ScheduleState` and giving them only to VIEW
   * doors; the leak that remains is that `buildScheduleStateImperative` is used
   * by writers as well as views, so the swap writer sees the filtered week.
   *
   * **NOT FIXED HERE.** The fix is a writer-side `ScheduleState` that carries no
   * exclusions, and that function has fourteen callers — it is its own slice,
   * not a line at the end of this one. The cell stays and names the cause. */
  ok('restoring the removal brings the EXACT row back — ⚠ OPEN DEFECT, see the note above',
    afterRestore.some((r) => r.startsWith(`${removed}@`)), JSON.stringify(afterRestore));
  ok('and it changes NOTHING else — every other row is byte-identical',
    JSON.stringify(afterRestore.filter((r) => !r.startsWith(`${removed}@`)))
      === JSON.stringify(beforeRestore),
    `${JSON.stringify(beforeRestore)} -> ${JSON.stringify(afterRestore)}`);

  report();
}

function report(): void {
  console.log(`\n${'─'.repeat(72)}`);
  if (failures.length === 0) { console.log(`ALL GREEN — ${passed} passed`); return; }
  console.log(`FAILURES — ${passed} passed, ${failures.length} failed`);
  for (const failure of failures) console.log(`  ✗ ${failure}`);
  process.exitCode = 1;
}

main().catch((error) => {
  console.log(`SUITE THREW ${(error as Error).message}`);
  console.log((error as Error).stack);
  process.exitCode = 1;
});
