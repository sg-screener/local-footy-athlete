/**
 * RESTORE GIVES BACK THE EXACT ITEM — AFTER A RESTART, AND UNDER AN INJURY.
 *
 * Sam's two rulings meet on one slot, and this suite is where they are both
 * held:
 *
 *   - 2026-08-19: *"Remove means simply remove the selected exercise/component.
 *     Nothing replaces it."* and *"Restore still retrieves the block's recorded
 *     exercise."*
 *   - 2026-08-20: *"A settings change must not re-add an excluded lift to the
 *     stored accepted program and rely on projection to hide it. Stored truth
 *     and visible truth must agree."*
 *
 * ## WHY THIS SUITE EXISTS SEPARATELY FROM THE TWO IT WAS EXTRACTED FROM
 *
 * `test:session-change-sequence` and `test:session-change-durability` both hold
 * this property, and both were OUTSIDE `test:bible` — *a check outside the chain
 * is a check nobody runs*, which is exactly why the cross-lane defect below
 * reached an integration candidate with a full green sweep behind it. The
 * sequence suite is green and goes into the chain whole. The durability suite
 * carries **five failures that pre-date this work and are about a different
 * subject** (sequence [6]'s three-change control, and sequence [8]'s injury
 * displacement reason), so it cannot enter the chain without either hiding them
 * or breaking it. Its two RESTORE scenarios are therefore reproduced here, in a
 * file that is green, and **the five stay red where they are, unrenamed and
 * unweakened**.
 *
 * ## THE DEFECT THIS HOLDS CLOSED, AND THE ONE THAT WAS RECORDED
 *
 * The integration report bisected the failure to the Settings + Injury merge and
 * read it as *"the injury swap's day override is baked from a week regenerated
 * without the removed row"*. **Instrumented, that is not where the row dies.**
 * Measured 2026-08-20, printing the stored program, the day override and the
 * unfiltered authored day at every step of the walk:
 *
 * | step | authored day carries `Bench Press` | stored rows |
 * | --- | --- | --- |
 * | after Remove | YES (hidden by the read filter) | 4 |
 * | after Swap | YES — the override kept it | 4 |
 * | after Add | YES | 4 |
 * | **after RESTART** | **NO** | **3** |
 * | after the Injury swap | NO | 3 |
 *
 * The row is destroyed by the RESTART, before any injury exists — and
 * `test:session-change-durability` [2] (remove → restart → restore, no swap and
 * no injury at all) fails the same way. Boot regenerates on every launch, and
 * since 2026-08-20 generation applies `applyExclusionsToAuthoredWeek` to the
 * week it authors, so the removal is baked into storage. That is Sam's second
 * ruling working exactly as ordered. What did not follow it was Restore:
 * `restoreExcludedExercise` still reported `rebuildRequired: false` for a
 * `today_only` decision — true while a removal was only ever a read-time filter,
 * false the moment it reached storage — so Restore un-hid a row that was no
 * longer there and reported success over an unchanged session.
 *
 * **THE FIX IS THE OWNER, NOT THE CALLER.** `restoreExcludedExerciseDurably` is
 * the act, `restoreExcludedExercise` is the decision inside it — the same split
 * `executeProgramControlActionDurably` already has on the forward side. The
 * door annuls the outstanding ledger removal (which otherwise replays the
 * removal straight back) and settles by RE-DERIVATION, so the composer restores
 * what the block recorded and the athlete's own later swaps and adds are
 * re-applied on top of a day that has the row back.
 *
 * ⚠ **AND THE RE-DERIVATION IS THE ONLY INSTRUMENT THAT WORKS.** Walked
 * headlessly through the real Status control plus the author-path rebuild a
 * `rebuildRequired: true` used to buy (`generateProgramForProfileFromStore({
 * recordSelections: 'author' })`), the restored lift went from 3 stored rows to
 * **0** — re-authoring re-decides the emptied slot, which is the one thing the
 * Remove contract forbids. Case [4] below pins that difference.
 *
 * Run: npm run test:exercise-restore-owner
 */

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
import { quiet, quietAsync, relaunchApp, setJourneyClock } from './support/athleteJourney';
import { getAthleteExclusions } from '../store/athletePreferencesStore';

const INSTALL_DAY = '2026-07-13';
/** A Wednesday inside the athlete's first block, three days after install. */
const TARGET = '2026-07-22';

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

function install(): void {
  durable.clear();
  resetStoresToFreshInstall('exercise-restore-owner:install');
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
    reason: 'exercise-restore-owner:generate',
  }));
  useProgramStore.setState({ currentMicrocycle: settled } as never);
  setJourneyClock(TARGET);
}

/**
 * ⚠ **THE WHOLE ROW LIST, IN ORDER, WITH LOADS.** Not a count and not a
 * membership test. The defect this suite holds closed produced a session with
 * the right number of rows and the wrong rows in it, and the claim Sam signed is
 * *"the row is back in its place at its load"* — so `Name@kg` in array order is
 * the cheapest assertion that catches identity, position and load at once.
 */
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

/** How many rows the STORED program carries for a name, across every week. */
function storedProgramCount(name: string): number {
  const program = (useProgramStore.getState() as unknown as {
    currentProgram?: { microcycles?: { workouts: Workout[] }[] };
  }).currentProgram;
  let count = 0;
  for (const mc of program?.microcycles ?? []) {
    for (const workout of mc.workouts ?? []) {
      for (const row of workout.exercises ?? []) {
        if ((row as { exercise?: { name?: string } }).exercise?.name === name) count++;
      }
    }
  }
  return count;
}

const door = () => require('../utils/programControlActions').executeProgramControlActionDurably;
const restoreDoor = () =>
  require('../utils/exerciseExclusionOwner').restoreExcludedExerciseDurably;

async function remove(exercise: string): Promise<{ ok: boolean }> {
  return await quietAsync(() => door()({
    type: 'remove_exercise',
    source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' },
    scope: 'today_only',
    payload: { date: TARGET, exercise },
    requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true,
  }, { todayISO: TARGET })) as { ok: boolean };
}

async function swap(victim: string, replacement: string): Promise<{ ok: boolean }> {
  return await quietAsync(() => door()({
    type: 'swap_exercise',
    source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' },
    scope: 'today_only',
    payload: {
      date: TARGET, fromExercise: victim,
      toExercise: { name: replacement, sets: 3, repsMin: 6, repsMax: 8 },
    },
    requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true,
  }, { todayISO: TARGET })) as { ok: boolean };
}

/** The app's own offered replacement for a row — never a name this suite invented. */
function offeredReplacementFor(victim: string, existing: string[]): string {
  const { resolveTapSwapEnvironment, getTapSwapChoices, groupTapSwapChoices } =
    require('../utils/tapSwapHierarchy');
  const environment = quiet(() => resolveTapSwapEnvironment({
    date: TARGET, profile: useProfileStore.getState().onboardingData,
    activeConstraints: [], readinessSignal: null,
  }));
  const menu = groupTapSwapChoices(quiet(() => getTapSwapChoices({
    originalExercise: victim, reason: 'preference', environment,
    existingExerciseNames: existing,
  }))) as { choices: { name: string }[] }[];
  return menu[0]!.choices[0]!.name;
}

/**
 * A LOWER BACK, AND THE CHOICE OF AREA IS ITSELF A CONTROL. MEASURED, NOT PICKED.
 *
 * `TARGET` is an UPPER day, and the area decides whether this case can say
 * anything at all. Swept over six areas at the same severity:
 *
 * | area | what the injury did to this day |
 * | --- | --- |
 * | knee | **nothing** — *"Nothing on this session needed changing"* |
 * | shoulder, chest | swapped four rows, **and forbids the removed press too** |
 * | lower back | swapped four rows, and horizontal pressing stays legal |
 *
 * A knee makes every cell below pass by not applying. A shoulder makes the
 * restore FAIL CORRECTLY — the restored `Bench Press` is itself unsafe under it,
 * so the injury substitutes it, which is Sam's *"do not show the illegal
 * choice"* working, not a restore defect. A lower back displaces the day's rows
 * while leaving the removed one legal, which is the only shape in which
 * *"Restore returns the exact original row and the injury swap is unchanged"* is
 * a question with an answer.
 */
async function declareBackInjury(): Promise<{ ok: boolean; message?: string }> {
  const { buildGuidedInjuryConstraint } = require('../utils/guidedInjuryControl');
  const constraint = buildGuidedInjuryConstraint({
    region: 'back_midline', area: 'lower back', severity: 6,
    severityBand: 'caution', adjustmentLevel: 'reduce_load',
    triggers: ['during'], seriousSymptoms: false,
  } as never, { todayISO: TARGET });
  return await quietAsync(() => door()({
    type: 'set_injury_modifier',
    source: { screen: 'session_detail', surface: 'exercise_injury_flow', initiatedBy: 'tap' },
    scope: 'current_and_future',
    payload: { constraint },
    requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
  }, { todayISO: TARGET })) as { ok: boolean; message?: string };
}

async function restart(): Promise<boolean> {
  const r = await quietAsync(() => relaunchApp({ storage: durable, todayISO: TARGET }));
  return r.ok;
}

async function main(): Promise<void> {
  /* ═══ 1 ═══════════════════════════════════════════════════════════════ */
  console.log('\n[1] REMOVE -> RESTART -> RESTORE — the simplest world there is');
  install();
  const s1Start = rowsOn(TARGET);
  const s1Gone = s1Start[0]!.split('@')[0]!;
  const s1StoredBefore = storedProgramCount(s1Gone);
  ok('CONTROL — the athlete has a real session to change',
    s1Start.length >= 4 && s1StoredBefore > 0, JSON.stringify(s1Start));
  await remove(s1Gone);
  ok('REMOVE landed and nothing filled the hole',
    !rowsOn(TARGET).some((r) => r.startsWith(`${s1Gone}@`))
      && rowsOn(TARGET).length === s1Start.length - 1, JSON.stringify(rowsOn(TARGET)));
  ok('the app came back up', await restart());
  /* ⚠ **THE MEASUREMENT THAT REDIRECTED THIS WHOLE FIX.** The row is gone from
   * STORAGE here, not merely hidden — boot regenerates and generation bakes the
   * exclusion into the week it authors. Asserted rather than narrated, because
   * the recorded diagnosis said the row survived to this point and died at the
   * injury swap, and that was wrong. If a later change makes the removal
   * read-time again, THIS cell fails and the note above it must be rewritten. */
  ok('the removal reached STORAGE across the restart — stored truth agrees with the screen',
    storedProgramCount(s1Gone) < s1StoredBefore,
    `stored ${s1StoredBefore} -> ${storedProgramCount(s1Gone)}`);
  await quietAsync(() => restoreDoor()(s1Gone));
  ok('RESTORE returns the EXACT original session — identity, position and load',
    JSON.stringify(rowsOn(TARGET)) === JSON.stringify(s1Start),
    `${JSON.stringify(s1Start)} -> ${JSON.stringify(rowsOn(TARGET))}`);
  ok('and the decision itself is gone, not merely out-voted',
    !getAthleteExclusions().some((e) => e.exercise === s1Gone),
    JSON.stringify(getAthleteExclusions().map((e) => e.exercise)));

  /* ═══ 2 ═══════════════════════════════════════════════════════════════ */
  console.log('\n[2] REMOVE -> same-day INJURY SWAP -> RESTORE — the cross-lane defect');
  install();
  const s2Start = rowsOn(TARGET);
  const s2Gone = s2Start[0]!.split('@')[0]!;
  await remove(s2Gone);
  ok('the app came back up', await restart());
  const s2BeforeInjury = rowsOn(TARGET);
  const injury = await declareBackInjury();
  const s2AfterInjury = rowsOn(TARGET);
  /* ⚠ **NON-VACUITY, AND IT IS THE BISECT'S OWN PIVOT.** If the injury ladder
   * finds nothing to displace, this case proves nothing about a swap and every
   * cell after it would pass by not applying. The integration bisect turned on
   * exactly this difference: the Settings-only tree OMITTED the unsafe lift
   * (*"nothing safe was available"*) and the merged tree SWAPS it — and a swap
   * is a WRITE. This cell fails rather than reporting a green it did not earn. */
  const standIns = s2AfterInjury.filter((row) => !s2BeforeInjury.includes(row));
  ok('CONTROL — the injury really did SWAP rows on this day, not merely omit them',
    standIns.length > 0 && s2AfterInjury.length === s2BeforeInjury.length
      && /swapped for/i.test(injury.message ?? ''),
    `"${injury.message}" ${JSON.stringify(s2BeforeInjury)} -> ${JSON.stringify(s2AfterInjury)}`);
  await quietAsync(() => restoreDoor()(s2Gone));
  const s2Restored = rowsOn(TARGET);
  ok('RESTORE brings the removed row back, at its original load',
    s2Restored.some((r) => r === s2Start.find((s) => s.startsWith(`${s2Gone}@`))),
    `${JSON.stringify(s2Restored)} — wanted ${s2Start[0]}`);
  ok('and it is back in its ORIGINAL POSITION, not appended',
    s2Restored[0]!.startsWith(`${s2Gone}@`), JSON.stringify(s2Restored));
  ok('EVERY INJURY STAND-IN is untouched — restore reverses the removal and nothing else',
    standIns.every((row) => s2Restored.includes(row)),
    `${JSON.stringify(standIns)} vs ${JSON.stringify(s2Restored)}`);
  ok('and every UNRELATED row is byte-identical to the moment before the restore',
    JSON.stringify(s2Restored.filter((r) => !r.startsWith(`${s2Gone}@`)))
      === JSON.stringify(s2AfterInjury),
    `${JSON.stringify(s2AfterInjury)} -> ${JSON.stringify(s2Restored)}`);
  /* SAM'S REQUIREMENT IN ITS OWN CELL: *"Restart reproduces the same result."*
   * A restore that only holds until the process dies is a restore that has not
   * reversed the ledger, which is precisely the half-reversal this owner used to
   * ship — the `remove_exercise` entry replayed the removal straight back. */
  ok('the app came back up', await restart());
  ok('and the RESTART reproduces it EXACTLY — the restore survived the process dying',
    JSON.stringify(rowsOn(TARGET)) === JSON.stringify(s2Restored),
    `${JSON.stringify(s2Restored)} -> ${JSON.stringify(rowsOn(TARGET))}`);

  /* ═══ 3 ═══════════════════════════════════════════════════════════════ */
  console.log('\n[3] REMOVE -> ATHLETE SWAP of another row -> RESTART -> RESTORE');
  install();
  const s3Start = rowsOn(TARGET);
  const s3Gone = s3Start[0]!.split('@')[0]!;
  await remove(s3Gone);
  const s3AfterRemove = rowsOn(TARGET);
  const s3Victim = s3AfterRemove[0]!.split('@')[0]!;
  const s3New = offeredReplacementFor(s3Victim, s3AfterRemove.map((r) => r.split('@')[0]!));
  await swap(s3Victim, s3New);
  const s3Before = rowsOn(TARGET);
  ok('CONTROL — both decisions are visible before the restart',
    !s3Before.some((r) => r.startsWith(`${s3Gone}@`))
      && s3Before.some((r) => r.startsWith(`${s3New}@`)), JSON.stringify(s3Before));
  ok('the app came back up', await restart());
  await quietAsync(() => restoreDoor()(s3Gone));
  const s3Restored = rowsOn(TARGET);
  ok('RESTORE brings the removed row back over a later swap',
    s3Restored.some((r) => r.startsWith(`${s3Gone}@`)), JSON.stringify(s3Restored));
  ok('and the LATER SWAP is still intact',
    s3Restored.some((r) => r.startsWith(`${s3New}@`))
      && !s3Restored.some((r) => r.startsWith(`${s3Victim}@`)), JSON.stringify(s3Restored));
  ok('the restored session is EXACTLY the pre-restore session plus the removed row',
    JSON.stringify(s3Restored.filter((r) => !r.startsWith(`${s3Gone}@`)))
      === JSON.stringify(s3Before),
    `${JSON.stringify(s3Before)} -> ${JSON.stringify(s3Restored)}`);

  /* ═══ 4 ═══════════════════════════════════════════════════════════════ */
  console.log('\n[4] THE OWNER REPORTS THE TRUTH ABOUT WHAT RESTORE NEEDS');
  install();
  const s4Start = rowsOn(TARGET);
  const s4Gone = s4Start[0]!.split('@')[0]!;
  await remove(s4Gone);
  ok('the app came back up', await restart());
  const { restoreExcludedExercise } = require('../utils/exerciseExclusionOwner');
  const plain = quiet(() => restoreExcludedExercise(s4Gone)) as {
    ok: boolean; rebuildRequired: boolean;
  };
  /* ⚠ **THE LINE THE DEFECT LIVED ON.** It read `scope !== 'today_only'`, which
   * was true while a removal was only ever a read-time projection. Since the
   * removal reaches STORAGE at generation, a Restore that reports "no rebuild
   * needed" is a Restore that reports success over an unchanged session. The
   * decision-writer must state it; the door acts on it. */
  ok('the DECISION writer says the world must be re-derived, even for `today_only`',
    plain.ok && plain.rebuildRequired === true, JSON.stringify(plain));
  ok('and the plain writer alone does NOT bring the row back — it writes a decision, '
    + 'it does not perform the act',
    !rowsOn(TARGET).some((r) => r.startsWith(`${s4Gone}@`)), JSON.stringify(rowsOn(TARGET)));

  report();
}

function report(): void {
  console.log(`\n${'─'.repeat(72)}`);
  if (failures.length === 0) {
    console.log(`Exercise restore owner: ${passed} passed, 0 failed`);
    totalsPrinted(0);
    return;
  }
  console.log(`Exercise restore owner: ${passed} passed, ${failures.length} failed`);
  for (const failure of failures) console.log(`  ✗ ${failure}`);
  totalsPrinted(failures.length);
}

main().catch((error) => {
  console.log(`SUITE THREW ${(error as Error).message}`);
  console.log((error as Error).stack);
  process.exitCode = 1;
});
