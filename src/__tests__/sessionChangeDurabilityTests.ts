/**
 * EVERY SESSION CHANGE SURVIVES THE PROCESS DYING — SEVEN SEQUENCES, EXACTLY.
 *
 * Sam, 2026-08-19: *"Swap survives process death with the exact selected
 * exercise and its own load. Remove survives process death. Restore reverses
 * only the removal decision. A later same-day Swap remains intact when an
 * earlier removal is restored. Decisions replay in their real action order.
 * Restart produces the same visible session as immediately before shutdown. No
 * exercise is silently refilled, reselected or rotated during restart."*
 *
 * ## WHY THIS SUITE IS NOT `test:session-change-sequence`
 *
 * That suite walks ONE long sequence and asks whether the doors compose. This
 * one asks the durability question seven different ways, and it asserts the
 * WHOLE VISIBLE ROW LIST — identity, ORDER and LOAD — rather than a count or a
 * membership test. Both defects this suite was written for produced a session
 * with the RIGHT NUMBER OF ROWS and the wrong rows in it, so every cell here
 * compares arrays.
 *
 * ## THE TWO DEFECTS IT HOLDS CLOSED
 *
 * 1. **A swap did not survive a restart.** Boot replay passed `entry.occurredAt`
 *    as `todayISO`, and `replaceExerciseAtDate` refuses a date before "today" —
 *    so startup re-adjudicated an already-accepted decision and dropped it. A
 *    replay is not the athlete acting; it is not refused for staleness.
 * 2. **Restore could not reveal a row a later swap wrote over.** The swap writer
 *    read its base through the VIEW state, which carries the athlete's
 *    exclusions, and then stored that filtered day — baking the hidden row out
 *    permanently. A filter that gets written down is not a filter.
 *
 * Run: npm run test:session-change-durability
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

/**
 * ⚠ **THE WHOLE ROW LIST, IN ORDER, WITH LOADS.** Not a count and not a
 * membership test. Both defects this suite holds closed produced a session with
 * the right NUMBER of rows and the wrong rows in it; one of them also produced
 * the right NAME carrying another lift's LOAD. `Name@kg` in array order is the
 * cheapest assertion that catches identity, order and load at once.
 */
function sameSession(a: string[], b: string[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

const door = () => require('../utils/programControlActions').executeProgramControlActionDurably;

async function remove(exercise: string): Promise<{ ok: boolean }> {
  return await quietAsync(() => door()({
    type: 'remove_exercise',
    source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' },
    scope: 'today_only',
    payload: { date: TARGET, exercise },
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

async function add(exercise: string): Promise<{ ok: boolean }> {
  return await quietAsync(() => door()({
    type: 'add_exercise',
    source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' },
    scope: 'today_only',
    payload: { date: TARGET, exercise: { name: exercise, sets: 2, repsMin: 8, repsMax: 12 } },
    requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true,
  }, { todayISO: TARGET })) as { ok: boolean };
}

function offeredAddFor(existing: string[]): string {
  const { resolveTapSwapEnvironment } = require('../utils/tapSwapHierarchy');
  const { legalAddCandidateGroups } = require('../utils/addExerciseCandidates');
  const environment = quiet(() => resolveTapSwapEnvironment({
    date: TARGET, profile: useProfileStore.getState().onboardingData,
    activeConstraints: [], readinessSignal: null,
  }));
  const groups = legalAddCandidateGroups({
    environment, existingExerciseNames: existing,
    profile: useProfileStore.getState().onboardingData,
  }) as { candidates: { name: string }[] }[];
  return groups[0]!.candidates[0]!.name;
}

async function restart(): Promise<boolean> {
  const r = await quietAsync(() => relaunchApp({ storage: durable, todayISO: TARGET }));
  return r.ok;
}

async function equipmentGone(tags: string[]): Promise<{ ok: boolean }> {
  return await quietAsync(() => door()({
    type: 'set_equipment_modifier',
    source: { screen: 'session_detail', surface: 'session_equipment_sheet', initiatedBy: 'tap' },
    scope: 'today_only',
    payload: {
      date: TARGET, todayISO: TARGET,
      decision: { kind: 'missing_for_session', tags, conditioningModalities: [] },
    },
    requiresRebuild: false, createsActiveModifier: true, oneOffOnly: true,
  }, { todayISO: TARGET })) as { ok: boolean };
}

async function injuryDeclared(): Promise<{ ok: boolean }> {
  const { buildGuidedInjuryConstraint } = require('../utils/guidedInjuryControl');
  const constraint = buildGuidedInjuryConstraint({
    region: 'lower_body', area: 'knee', severity: 6,
    severityBand: 'caution', adjustmentLevel: 'reduce_load',
    triggers: ['during'], seriousSymptoms: false,
  } as never, { todayISO: TARGET });
  return await quietAsync(() => door()({
    type: 'set_injury_modifier',
    source: { screen: 'session_detail', surface: 'exercise_injury_flow', initiatedBy: 'tap' },
    scope: 'current_and_future',
    payload: { constraint },
    requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
  }, { todayISO: TARGET })) as { ok: boolean };
}

async function main(): Promise<void> {
  const { restoreExcludedExercise } = require('../utils/exerciseExclusionOwner');
  const { undoLastDecision } = require('../store/undoLastDecision');

  /* ═══ 1 ═══════════════════════════════════════════════════════════════ */
  console.log('\n[1] SWAP -> close -> reopen');
  install();
  const s1Start = rowsOn(TARGET);
  const s1Victim = s1Start[0]!.split('@')[0]!;
  const s1New = offeredReplacementFor(s1Victim, s1Start.map((r) => r.split('@')[0]!));
  ok('CONTROL — the victim is on the day before the swap',
    s1Start.some((r) => r.startsWith(`${s1Victim}@`)), JSON.stringify(s1Start));
  await swap(s1Victim, s1New);
  const s1Before = rowsOn(TARGET);
  ok('SWAP landed', s1Before.some((r) => r.startsWith(`${s1New}@`)), JSON.stringify(s1Before));
  ok('and the outgoing exercise is gone',
    !s1Before.some((r) => r.startsWith(`${s1Victim}@`)), JSON.stringify(s1Before));
  ok('the app came back up', await restart());
  const s1After = rowsOn(TARGET);
  /* THE WHOLE SESSION, NOT THE SWAPPED ROW. A restart that kept the swap and
   * rotated a neighbour would pass a membership test and fail the athlete. */
  ok('the restarted session is IDENTICAL — identity, order and load',
    sameSession(s1After, s1Before), `${JSON.stringify(s1Before)} -> ${JSON.stringify(s1After)}`);
  ok('and the exact selected exercise carries its OWN load, not the outgoing one',
    s1After.some((r) => r === s1Before.find((b) => b.startsWith(`${s1New}@`))),
    JSON.stringify(s1After));

  /* ── AND THE ORDER IS THE REAL ACTION ORDER ────────────────────────────
   *
   * ⚠ **TWO SWAPS OF THE SAME ROW ARE THE ONLY CHEAP ORDER PROBE.** Remove is a
   * standing decision and Add appends, so replaying either out of order lands
   * the same world and proves nothing about ordering. Replacing A with B and
   * then B with C does not commute: replayed backwards the day ends on B, and
   * the athlete gets the exercise they swapped AWAY from. Sam: *"Decisions
   * replay in their real action order."* */
  const s1Third = offeredReplacementFor(s1New, s1After.map((r) => r.split('@')[0]!));
  await swap(s1New, s1Third);
  const s1BeforeB = rowsOn(TARGET);
  ok('CONTROL — the second swap of the same row landed, and it is a THIRD exercise',
    s1BeforeB.some((r) => r.startsWith(`${s1Third}@`))
      && s1Third !== s1New && s1Third !== s1Victim, `${s1Victim} -> ${s1New} -> ${s1Third}`);
  ok('the app came back up', await restart());
  const s1AfterB = rowsOn(TARGET);
  ok('after the restart the day is on the LAST swap, not the first',
    s1AfterB.some((r) => r.startsWith(`${s1Third}@`))
      && !s1AfterB.some((r) => r.startsWith(`${s1New}@`)), JSON.stringify(s1AfterB));
  ok('and the twice-swapped session is IDENTICAL to the one before shutdown',
    sameSession(s1AfterB, s1BeforeB),
    `${JSON.stringify(s1BeforeB)} -> ${JSON.stringify(s1AfterB)}`);

  /* ═══ 2 ═══════════════════════════════════════════════════════════════ */
  console.log('\n[2] REMOVE -> close -> reopen -> RESTORE');
  install();
  const s2Start = rowsOn(TARGET);
  const s2Gone = s2Start[0]!.split('@')[0]!;
  await remove(s2Gone);
  const s2Before = rowsOn(TARGET);
  ok('REMOVE landed and nothing filled the hole',
    !s2Before.some((r) => r.startsWith(`${s2Gone}@`)) && s2Before.length === s2Start.length - 1,
    JSON.stringify(s2Before));
  ok('the app came back up', await restart());
  const s2After = rowsOn(TARGET);
  ok('the restarted session is IDENTICAL — nothing refilled, reselected or rotated',
    sameSession(s2After, s2Before), `${JSON.stringify(s2Before)} -> ${JSON.stringify(s2After)}`);
  quiet(() => restoreExcludedExercise(s2Gone));
  const s2Restored = rowsOn(TARGET);
  ok('RESTORE returns the EXACT original session — the row is back in its place at its load',
    sameSession(s2Restored, s2Start), `${JSON.stringify(s2Start)} -> ${JSON.stringify(s2Restored)}`);

  /* ═══ 3 ═══════════════════════════════════════════════════════════════ */
  console.log('\n[3] REMOVE -> SWAP another row -> close -> reopen -> RESTORE');
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
  const s3After = rowsOn(TARGET);
  ok('the restarted session is IDENTICAL',
    sameSession(s3After, s3Before), `${JSON.stringify(s3Before)} -> ${JSON.stringify(s3After)}`);
  quiet(() => restoreExcludedExercise(s3Gone));
  const s3Restored = rowsOn(TARGET);
  /* ⚠ THE CELL THE SECOND DEFECT LIVED IN. The swap's stored override used to be
   * built from a day the removal had already been filtered out of, so the
   * removed row was destroyed rather than hidden and Restore had nothing to
   * give back. */
  ok('RESTORE brings the removed row back',
    s3Restored.some((r) => r.startsWith(`${s3Gone}@`)), JSON.stringify(s3Restored));
  ok('and the LATER SWAP is still intact — restore reverses the removal and nothing else',
    s3Restored.some((r) => r.startsWith(`${s3New}@`))
      && !s3Restored.some((r) => r.startsWith(`${s3Victim}@`)), JSON.stringify(s3Restored));
  ok('the restored session is EXACTLY the pre-restart session plus the removed row',
    sameSession(s3Restored.filter((r) => !r.startsWith(`${s3Gone}@`)), s3Before),
    `${JSON.stringify(s3Before)} -> ${JSON.stringify(s3Restored)}`);

  /* ═══ 4 ═══════════════════════════════════════════════════════════════ */
  console.log('\n[4] SWAP -> REMOVE another row -> close -> reopen -> UNDO');
  install();
  const s4Start = rowsOn(TARGET);
  const s4Victim = s4Start[0]!.split('@')[0]!;
  const s4New = offeredReplacementFor(s4Victim, s4Start.map((r) => r.split('@')[0]!));
  await swap(s4Victim, s4New);
  const s4AfterSwap = rowsOn(TARGET);
  const s4Gone = s4AfterSwap[1]!.split('@')[0]!;
  await remove(s4Gone);
  const s4Before = rowsOn(TARGET);
  ok('the app came back up', await restart());
  const s4After = rowsOn(TARGET);
  ok('the restarted session is IDENTICAL',
    sameSession(s4After, s4Before), `${JSON.stringify(s4Before)} -> ${JSON.stringify(s4After)}`);
  const undone = await quietAsync(() => undoLastDecision()) as { outcome: string };
  const s4Undone = rowsOn(TARGET);
  ok('UNDO reported that it undid something', undone.outcome === 'undone', undone.outcome);
  /* UNDO REVERSES THE LAST DECISION — THE REMOVAL — AND LEAVES THE SWAP. */
  ok('UNDO reverses only the removal: the session is exactly the post-swap one',
    sameSession(s4Undone, s4AfterSwap),
    `${JSON.stringify(s4AfterSwap)} -> ${JSON.stringify(s4Undone)}`);

  /* ═══ 5 ═══════════════════════════════════════════════════════════════ */
  console.log('\n[5] EQUIPMENT change -> SWAP -> REMOVE -> restart');
  install();
  const s5Equip = await equipmentGone(['barbell']);
  ok('CONTROL — the equipment door accepted the change', s5Equip.ok);
  const s5AfterEquip = rowsOn(TARGET);
  const s5Victim = s5AfterEquip[0]!.split('@')[0]!;
  const s5New = offeredReplacementFor(s5Victim, s5AfterEquip.map((r) => r.split('@')[0]!));
  await swap(s5Victim, s5New);
  const s5AfterSwap = rowsOn(TARGET);
  const s5Gone = s5AfterSwap[s5AfterSwap.length - 1]!.split('@')[0]!;
  await remove(s5Gone);
  const s5Before = rowsOn(TARGET);
  ok('CONTROL — all three changes are visible before the restart',
    s5Before.some((r) => r.startsWith(`${s5New}@`))
      && !s5Before.some((r) => r.startsWith(`${s5Gone}@`)), JSON.stringify(s5Before));
  ok('the app came back up', await restart());
  const s5After = rowsOn(TARGET);
  ok('the restarted session is IDENTICAL after an equipment change, a swap and a removal',
    sameSession(s5After, s5Before), `${JSON.stringify(s5Before)} -> ${JSON.stringify(s5After)}`);

  /* ═══ 6 ═══════════════════════════════════════════════════════════════ */
  console.log('\n[6] INJURY change -> REMOVE -> restart');
  install();
  const s6Injury = await injuryDeclared();
  ok('CONTROL — the injury door accepted the change', s6Injury.ok);
  const s6AfterInjury = rowsOn(TARGET);
  const s6Gone = s6AfterInjury[0]!.split('@')[0]!;
  await remove(s6Gone);
  const s6Before = rowsOn(TARGET);
  ok('REMOVE landed on top of the injury pass',
    !s6Before.some((r) => r.startsWith(`${s6Gone}@`)), JSON.stringify(s6Before));
  ok('the app came back up', await restart());
  const s6After = rowsOn(TARGET);
  /* ⚠⚠ **RED ON PURPOSE — A THIRD DEFECT, IN A DOOR THIS MISSION DOES NOT OWN,
   * AND IT IS PRE-EXISTING.** Measured byte-identical with this branch's two
   * fixes REVERTED, so it is not caused by them.
   *
   * ```
   * before restart  ["Easy Bike@-","Landmine Press@35","Barbell Row@72.5","Banded Dead Bug@0"]
   * after  restart  ["RDLs@67.5","Bulgarian Split Squats@25","Landmine Press@35","Barbell Row@72.5","Banded Dead Bug@0"]
   * ```
   *
   * **THE INJURY RECOMPOSITION IS HELD IN MEMORY ONLY.** The injury EPISODE is
   * durable — `activeConstraints` still reads `["injury-knee"]` after hydration
   * — but the recomposition it performed (`RDLs` -> `Bench Press`,
   * `Bulgarian Split Squats` -> `Easy Bike`) is written to `dateOverrides`,
   * which boot blanks by design and rebuilds from the DECISION LEDGER. The
   * ledger holds one entry, `dl-1 remove_exercise`; the injury declaration is
   * not on it, so nothing replays the recomposition. The removal then hides a
   * row (`Bench Press`) that the un-replayed injury never created, so the
   * athlete gets the pristine session back and BOTH changes appear lost.
   *
   * **WHY IT IS NOT FIXED HERE, ON EVIDENCE RATHER THAN ON APPETITE.** Three
   * independent facts each block the small version of the fix:
   *   1. `rules/programControlDecisions.LEDGER_RECORDED_ACTION_TYPES` is
   *      deliberately the three EXERCISE-LEVEL types, and the door states the
   *      rule the list exists to keep — *"one act"* must not become *"two
   *      decisions ... which the athlete would feel as an undo that needs two
   *      taps"*. So recording the injury's component swaps individually is
   *      ruled out by a standing decision, not by taste.
   *   2. `withAcceptedMutationLock` is a strict serial queue and is NOT
   *      re-entrant, so the injury arm cannot route its component writes
   *      through the durable door from inside itself — it would deadlock.
   *   3. Recording ONE `set_injury_modifier` decision does not help either:
   *      boot replay uses the SYNCHRONOUS executor by design, and that executor
   *      refuses this action outright — *"Injury changes must use the durable
   *      injury transaction."* Making it replayable means giving the boot an
   *      async acceptance cycle per recorded edit, which is the exact cost the
   *      replay's design comment refuses.
   *
   * It is therefore its own slice, with the injury episode owner. Editing this
   * expectation to match would be the
   * `expectation-edited-to-match-the-regression` defect; the cell stays and
   * names the cause. */
  ok('the restarted session is IDENTICAL after an injury change and a removal'
    + ' — ⚠ OPEN DEFECT (injury durability), see the note above this cell',
    sameSession(s6After, s6Before), `${JSON.stringify(s6Before)} -> ${JSON.stringify(s6After)}`);

  /* ═══ 7 ═══════════════════════════════════════════════════════════════ */
  console.log('\n[7] ADD -> SWAP -> restart');
  install();
  const s7Start = rowsOn(TARGET);
  const s7Added = offeredAddFor(s7Start.map((r) => r.split('@')[0]!));
  await add(s7Added);
  const s7AfterAdd = rowsOn(TARGET);
  ok('ADD landed and took nothing away',
    s7AfterAdd.some((r) => r.startsWith(`${s7Added}@`))
      && s7AfterAdd.length === s7Start.length + 1, JSON.stringify(s7AfterAdd));
  const s7Victim = s7AfterAdd[0]!.split('@')[0]!;
  const s7New = offeredReplacementFor(s7Victim, s7AfterAdd.map((r) => r.split('@')[0]!));
  await swap(s7Victim, s7New);
  const s7Before = rowsOn(TARGET);
  ok('the app came back up', await restart());
  const s7After = rowsOn(TARGET);
  ok('the restarted session is IDENTICAL — the add and the swap both survive',
    sameSession(s7After, s7Before), `${JSON.stringify(s7Before)} -> ${JSON.stringify(s7After)}`);
  ok('and the ADD is still there by name',
    s7After.some((r) => r.startsWith(`${s7Added}@`)), JSON.stringify(s7After));

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
