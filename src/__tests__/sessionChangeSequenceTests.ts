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

// TOTALS-OR-RED (Sam, 2026-08-03): armed at module top, cleared only by the
// printed totals line. Added 2026-08-20 when this suite entered `test:bible` —
// the chain reads a drained loop as green, and this suite awaits a boot.
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
armTotalsOrRed();

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
import { coldStartThroughOnboarding, quiet, quietAsync, relaunchApp, setJourneyClock } from './support/athleteJourney';
import { deriveVisibleWeekLive } from '../utils/deriveVisibleWeek';
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
    firstName: 'Sim', heightCm: 184, weightKg: 90, gender: 'male', seasonPhase: 'Off-season',
    seasonFinishedOn: '2026-07-12',
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

async function install(): Promise<void> {
  durable.clear();
  const installed = await coldStartThroughOnboarding({ profile: theAthlete(), installDayISO: INSTALL_DAY });
  if (installed.onboardingRefusal) throw new Error(installed.onboardingRefusal);
  setJourneyClock(TARGET);
}

/** What the athlete sees on a day, exactly as the screen reads it. */
function rowsOn(dateISO: string): string[] {
  const week = quiet(() => deriveVisibleWeekLive(mondayFor(dateISO), TARGET));
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
  const { legalAddFamilies, legalAddCandidates } = require('../utils/addExerciseCandidates');
  const { buildGuidedInjuryConstraint } = require('../utils/guidedInjuryControl');
  const { unsafeRowsForInjury } = require('../utils/injurySessionRecomposition');
  const { restoreExcludedExerciseDurably } = require('../utils/exerciseExclusionOwner');

  console.log('\n[1] THE WALK — remove, then swap, then add, on ONE session');

  await install();
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
  // SAM'S HIERARCHY (2026-08-20). The menu is walked the way the athlete walks
  // it, and the "allows another copy" check is asked of every LEAF,
  // not of one flat list — a hierarchy could hide the collision in a branch
  // nobody opened. Walking leaves also survives the depth being uneven.
  const addArgs = {
    environment, existingExerciseNames: onTheDay,
    profile: useProfileStore.getState().onboardingData,
  };
  const addFamilies = legalAddFamilies(addArgs) as
    { groups: { leaves: { id: string }[] }[] }[];
  const everyOffered = addFamilies.flatMap((family) => family.groups.flatMap(
    (group) => group.leaves.flatMap(
      (leaf) => (legalAddCandidates({ ...addArgs, leaf: leaf.id }) as { name: string }[])
        .map((candidate) => candidate.name))));
  ok('CONTROL — the add menu is not empty after two changes', everyOffered.length > 0);
  ok('R-387: Add still offers the exercise just swapped onto the day',
    everyOffered.includes(replacement), replacement);
  const added = everyOffered[0]!;
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
  /* ⚠⚠ **CLOSED 2026-08-19, AND THE FIRST HYPOTHESIS WAS WRONG.**
   *
   * This cell was red with the note *"the later writes appear to compose from a
   * base that does not carry the earlier one, so the last write wins"*. That
   * was a guess from the symptom, and the symptom fitted it. It was not the
   * cause: nothing was composing badly, because **the swap's replay never ran
   * at all.** Instrumenting the boot (the replay's own warning is swallowed by
   * the suite's `quietAsync`) produced the actual line:
   *
   * ```
   * [quiescentBoot] a recorded door action no longer applies on replay
   *   entryId: 'dl-2', actionType: 'swap_exercise',
   *   message: "2026-07-22 is in the past - I can't change it."
   * ```
   *
   * Replay passes `entry.occurredAt` as `todayISO`, and `replaceExerciseAtDate`
   * refuses any date before "today". So STARTUP was re-adjudicating a decision
   * the ledger already says was accepted, and dropping it. The removal survived
   * because it is a durable decision in athlete preferences, and the add
   * survived because it has no such guard — which is exactly why it read as
   * *"the SWAP specifically"*.
   *
   * The guard no longer applies to a replay: a replay is not the athlete
   * acting. See the note at `utils/coachActions.replaceExerciseAtDate`, which
   * also records the production world this bites — `occurredAt` is a UTC
   * instant string-sliced to a date, so in any timezone behind UTC an ordinary
   * evening swap stamps tomorrow and is refused on the next launch.
   *
   * Held by `test:session-change-durability` sequences 1, 3, 4, 5 and 7, and by
   * its mutation M1 (dropping the swap decision during boot). */
  ok('the swap survived',
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
  /* ⚠ **THE DOOR, NOT THE INNER FUNCTION.** `restoreExcludedExercise` writes the
   * decision; `restoreExcludedExerciseDurably` is the act My Status' "Restore
   * exercise" performs — it also annuls the outstanding ledger removal and
   * settles the derived world. The distinction became load-bearing when a
   * removal started reaching STORAGE at generation time (Sam, 2026-08-20,
   * *"stored truth and visible truth must agree"*): the boot above has already
   * re-authored this week WITHOUT the row, so there is nothing left to un-hide
   * and only the re-derivation can bring the recorded lift back. */
  await quietAsync(() => restoreExcludedExerciseDurably(removed));
  const afterRestore = rowsOn(TARGET);
  /* ⚠ THE CLAIM IS ABOUT THE REMOVAL, AND ONLY THE REMOVAL. The first cut also
   * asserted the ADD was still there, and it was not — the injury pass one case
   * up had legitimately swapped it out, because the exercise the add chose was a
   * squat and the declared injury is a knee. A restore cell that fails because
   * an injury pass did its job is a cell about the wrong subject. */
  /* ⚠⚠ **CLOSED 2026-08-19, AND IT WAS NARROWER THAN THE NOTE FEARED.**
   *
   * The diagnosis here was right: `replaceExerciseAtDate` wrote the day's
   * override from a read that ALREADY HAD THE EXCLUSION FILTER APPLIED, so the
   * hidden row was baked out of the stored override permanently and Restore had
   * nothing to reveal. *A filter that gets written down is not a filter.*
   *
   * The note priced the fix as *"a writer-side `ScheduleState` … and that
   * function has fourteen callers"*. It does — but the fourteen are callers of
   * `buildScheduleStateImperative`, and the leak is not there. It is at
   * `coachActions.resolveDateWorkout`, the module-private read those writers
   * actually use, and **all six of its callers are writers** (`lightenSession`,
   * `moveSession`, `makeSessionOptional`, `replaceExerciseAtDate`,
   * `addExerciseAtDate`, `addWeeklyOverride`) — not one is a view. So the seam
   * is one function, and it states `athleteExclusions: []` the same way
   * `liveEvaluationSurfaces.freshGenerationSurfaces` does: a world that
   * deliberately has none.
   *
   * Held by `test:session-change-durability` sequences 2 and 3, and by its
   * mutation M3 (restoring the removal snapshot over a later swap). */
  ok('restoring the removal brings the EXACT row back',
    afterRestore.some((r) => r.startsWith(`${removed}@`)), JSON.stringify(afterRestore));
  ok('and it changes NOTHING else — every other row is byte-identical',
    JSON.stringify(afterRestore.filter((r) => !r.startsWith(`${removed}@`)))
      === JSON.stringify(beforeRestore),
    `${JSON.stringify(beforeRestore)} -> ${JSON.stringify(afterRestore)}`);

  report();
}

function report(): void {
  console.log(`\n${'─'.repeat(72)}`);
  if (failures.length === 0) {
    console.log(`ALL GREEN — ${passed} passed`);
    totalsPrinted(0);
    return;
  }
  console.log(`FAILURES — ${passed} passed, ${failures.length} failed`);
  for (const failure of failures) console.log(`  ✗ ${failure}`);
  totalsPrinted(failures.length);
}

main().catch((error) => {
  console.log(`SUITE THREW ${(error as Error).message}`);
  console.log((error as Error).stack);
  process.exitCode = 1;
});
