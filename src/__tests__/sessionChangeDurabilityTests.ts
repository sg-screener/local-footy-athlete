/**
 * EVERY SESSION CHANGE SURVIVES THE PROCESS DYING — EIGHT SEQUENCES, EXACTLY.
 *
 * Sam, 2026-08-19: *"Swap survives process death with the exact selected
 * exercise and its own load. Remove survives process death. Restore reverses
 * only the removal decision. A later same-day Swap remains intact when an
 * earlier removal is restored. Decisions replay in their real action order.
 * Restart produces the same visible session as immediately before shutdown. No
 * exercise is silently refilled, reselected or rotated during restart."*
 *
 * And, after the first device pass found the hole the seven did not cover:
 * *"If a later injury or equipment fact makes the athlete's chosen exercise
 * unsafe or impossible … do not show the illegal choice … automatically use the
 * closest safe/legal replacement … tell the athlete exactly why … keep the
 * athlete's original Swap preference underneath … when the constraint ends,
 * their chosen Swap returns if it is legal again. Apply this when the
 * injury/equipment action occurs — not for the first time during startup."*
 *
 * ## WHY THIS SUITE IS NOT `test:session-change-sequence`
 *
 * That suite walks ONE long sequence and asks whether the doors compose. This
 * one asks the durability question eight different ways, and it asserts the
 * WHOLE VISIBLE ROW LIST — identity, ORDER and LOAD — rather than a count or a
 * membership test. Every defect it was written for produced a session with the
 * RIGHT NUMBER OF ROWS and the wrong rows in it, so every cell compares arrays.
 *
 * ## THE FOUR DEFECTS IT HOLDS CLOSED
 *
 * 1. **A swap did not survive a restart.** Boot replay passed `entry.occurredAt`
 *    as `todayISO`, and `replaceExerciseAtDate` refuses a date before "today" —
 *    so startup re-adjudicated an already-accepted decision and dropped it.
 * 2. **Restore could not reveal a row a later swap wrote over.** The swap writer
 *    read its base through the VIEW state, which carries the athlete's
 *    exclusions, and then stored that filtered day — baking the hidden row out.
 *    A filter that gets written down is not a filter.
 * 3. **The injury recomposition was memory-only.** The episode was durable, the
 *    rows it changed were not, and no ledger entry replayed them. The FACT is
 *    now re-applied at boot, after the decisions, through the same owner.
 * 4. **A later fact VETOED an accepted decision instead of displacing it**, and
 *    an ended injury never gave the athlete's choice back — the resolve path
 *    did not re-derive while the create path did.
 *
 * ⚠ **SEQUENCE 8 IS THE RULING, AND IT CARRIES ITS OWN NON-VACUITY CONTROL.**
 * If the ladder ever picks something the declared injury allows, nothing is
 * displaced and every cell after it would pass by not applying. The control
 * cell fails in that case rather than reporting a green it did not earn.
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
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { generateProgramLocally } from '../services/api/generateProgram';
import { commitRebuiltProgram } from '../utils/weekRebuild';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { resetStoresToFreshInstall } from './support/freshInstallStores';
import { coldStartThroughOnboarding, followTheWeek, quiet, quietAsync, relaunchApp, setJourneyClock } from './support/athleteJourney';
import { useDecisionLedgerStore } from '../store/decisionLedgerStore';
import { undoToastFor, undoToastSeenMarker } from '../rules/undoToast';
import type { AddCandidate } from '../utils/addExerciseCandidates';

const INSTALL_DAY = '2026-07-13';
/** A Wednesday inside the athlete's first block, three days after install. */
let TARGET = '2026-07-22';

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
    firstName: 'Sim', ageRange: '22-26', gender: 'male', heightCm: 184, weightKg: 90, seasonPhase: 'Off-season',
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

async function install(): Promise<string> {
  TARGET = '2026-07-22';
  const installed = await quietAsync(() => coldStartThroughOnboarding({ profile: theAthlete(), installDayISO: INSTALL_DAY }));
  if (installed.onboardingRefusal) throw new Error(JSON.stringify(installed.onboardingRefusal));
  const weekStart = mondayFor(TARGET);
  quiet(() => followTheWeek(weekStart));
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


/** Every row that is standing in for another, as `standin<-displaced`. */
function substitutionsOn(dateISO: string): string[] {
  const week = quiet(() => resolveWeekWithConditioning(
    mondayFor(dateISO), buildScheduleStateImperative()));
  const day = week.find((d) => d.date === dateISO);
  const workout = (day as { workout?: Workout } | undefined)?.workout;
  return (workout?.exercises ?? []).flatMap((row) => {
    const sub = (row as { substitutedFrom?: { baseExerciseName?: string; cause?: string } })
      .substitutedFrom;
    if (!sub?.baseExerciseName) return [];
    const name = (row as { exercise?: { name?: string } }).exercise?.name;
    return [`${name}<-${sub.baseExerciseName}:${sub.cause}`];
  });
}

function injuryAdjustmentOn(dateISO: string) {
  return quiet(() => resolveWeekWithConditioning(mondayFor(dateISO), buildScheduleStateImperative()))
    .find(day => day.date === dateISO)?.workout?.injuryAdjustment;
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
function offeredReplacementFor(victim: string, existing: string[], avoid: readonly string[] = []): string {
  const { resolveTapSwapEnvironment, getTapSwapChoices, groupTapSwapChoices } =
    require('../utils/tapSwapHierarchy');
  const environment = quiet(() => resolveTapSwapEnvironment({
    scheduleState: buildScheduleStateImperative(),
    date: TARGET, profile: useProfileStore.getState().onboardingData,
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints, readinessSignal: null,
  }));
  const menu = groupTapSwapChoices(quiet(() => getTapSwapChoices({
    originalExercise: victim, reason: 'preference', environment,
    existingExerciseNames: existing,
  }))) as { choices: { name: string }[] }[];
  /* RE-PINNED 2026-09-02: the menu's first offer for a swapped-in row is the
   * exercise it replaced (it is no longer on the day, so it is offered back).
   * The order probe needs a THIRD exercise, so the caller names what to avoid. */
  const offered = menu.flatMap((group) => group.choices.map((choice) => choice.name))
    .find((name) => name !== victim && !avoid.includes(name));
  if (!offered) throw new Error(`No replacement offered for ${victim} beyond ${avoid.join(', ')}`);
  return offered;
}

async function swap(victim: string, replacement: string): Promise<{ ok: boolean }> {
  const visible = quiet(() => resolveWeekWithConditioning(mondayFor(TARGET), buildScheduleStateImperative()))
    .find(day => day.date === TARGET)?.workout;
  const row = visible?.exercises.find(row => row.exercise?.name === victim);
  if (!row) throw new Error(`Visible swap target absent: ${victim}`);
  const seen = undoToastSeenMarker(useDecisionLedgerStore.getState().entries);
  const result = await quietAsync(() => door()({
    type: 'swap_exercise',
    source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' },
    scope: 'today_only',
    payload: {
      date: TARGET, fromExercise: victim, fromExerciseId: row.id,
      toExercise: { name: replacement, sets: 3, repsMin: 6, repsMax: 8 },
    },
    requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true,
    }, { todayISO: TARGET })) as { ok: boolean };
  if (result.ok) ok('actual Swap exposes its newest decision through the shared Undo model',
    undoToastFor(useDecisionLedgerStore.getState().entries, seen)?.sentence === 'swapped an exercise');
  return result;
}

async function add(exercise: AddCandidate): Promise<{ ok: boolean }> {
  const seen = undoToastSeenMarker(useDecisionLedgerStore.getState().entries);
  const result = await quietAsync(() => door()({
    type: 'add_exercise',
    source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' },
    scope: 'today_only',
    payload: { date: TARGET, exercise },
    requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true,
  }, { todayISO: TARGET })) as { ok: boolean };
  if (result.ok) ok('actual Add exposes its newest decision through the shared Undo model',
    undoToastFor(useDecisionLedgerStore.getState().entries, seen)?.sentence === 'added an exercise');
  return result;
}

function offeredAddFor(existing: string[]): AddCandidate {
  const { resolveTapSwapEnvironment } = require('../utils/tapSwapHierarchy');
  const { legalAddFamilies, legalAddCandidates } = require('../utils/addExerciseCandidates');
  const environment = quiet(() => resolveTapSwapEnvironment({
    scheduleState: buildScheduleStateImperative(),
    date: TARGET, profile: useProfileStore.getState().onboardingData,
    activeConstraints: [], readinessSignal: null,
  }));
  ok('early off-season Add reads the accepted no-power contract',
    environment.weeklyContract?.power.eligible === false);
  // SAM'S HIERARCHY (2026-08-20): the first thing the athlete could actually tap
  // through to — first family, first heading, first leaf under it, first choice.
  // The depth is not uniform, so this walks LEAVES rather than assuming a level.
  const args = {
    environment, existingExerciseNames: existing,
    profile: useProfileStore.getState().onboardingData,
  };
  const families = legalAddFamilies(args) as
    { groups: { leaves: { id: string }[] }[] }[];
  ok('early off-season Add does not offer rejected power work',
    !families.some(family => family.groups.some(group => group.leaves.some(leaf => leaf.id === 'power'))));
  const leaf = families[0]!.groups[0]!.leaves[0]!.id;
  return (legalAddCandidates({ ...args, leaf }) as AddCandidate[])[0]!;
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
  /* THE DOOR, NOT THE INNER FUNCTION — see the note in
   * `sessionChangeSequenceTests` [4]. A removal now reaches storage at
   * generation, so a restart destroys the row a plain restore would un-hide,
   * and only the durable door's re-derivation returns the recorded lift. */
  const { restoreExcludedExerciseDurably } = require('../utils/exerciseExclusionOwner');
  const { undoLastDecision } = require('../store/undoLastDecision');

  /* ═══ 1 ═══════════════════════════════════════════════════════════════ */
  console.log('\n[1] SWAP -> close -> reopen');
  await install();
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
  const s1Third = offeredReplacementFor(s1New, s1After.map((r) => r.split('@')[0]!), [s1Victim]);
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
  await install();
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
  await quietAsync(() => restoreExcludedExerciseDurably(s2Gone));
  const s2Restored = rowsOn(TARGET);
  ok('RESTORE returns the EXACT original session — the row is back in its place at its load',
    sameSession(s2Restored, s2Start), `${JSON.stringify(s2Start)} -> ${JSON.stringify(s2Restored)}`);

  /* ═══ 3 ═══════════════════════════════════════════════════════════════ */
  console.log('\n[3] REMOVE -> SWAP another row -> close -> reopen -> RESTORE');
  await install();
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
  await quietAsync(() => restoreExcludedExerciseDurably(s3Gone));
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
  await install();
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
  await install();
  const s5Equip = await equipmentGone(['barbell']);
  ok('CONTROL — the equipment door accepted the change', s5Equip.ok);
  const s5AfterEquip = rowsOn(TARGET);
  const s5Victim = s5AfterEquip[0]!.split('@')[0]!;
  const s5New = offeredReplacementFor(s5Victim, s5AfterEquip.map((r) => r.split('@')[0]!));
  const s5Swap = await swap(s5Victim, s5New);
  ok('CONTROL — equipment-constrained swap is accepted', s5Swap.ok,
    JSON.stringify({ victim: s5Victim, replacement: s5New, result: s5Swap }));
  const s5AfterSwap = rowsOn(TARGET);
  const s5Gone = s5AfterSwap[s5AfterSwap.length - 1]!.split('@')[0]!;
  await remove(s5Gone);
  const s5Before = rowsOn(TARGET);
  ok('CONTROL — all three changes are visible before the restart',
    s5Before.some((r) => r.startsWith(`${s5New}@`))
      && !s5Before.some((r) => r.startsWith(`${s5Gone}@`)), JSON.stringify({ victim: s5Victim, replacement: s5New, removed: s5Gone, afterEquipment: s5AfterEquip, afterSwap: s5AfterSwap, afterRemove: s5Before }));
  ok('the app came back up', await restart());
  const s5After = rowsOn(TARGET);
  ok('the restarted session is IDENTICAL after an equipment change, a swap and a removal',
    sameSession(s5After, s5Before), `${JSON.stringify(s5Before)} -> ${JSON.stringify(s5After)}`);

  /* ═══ 6 ═══════════════════════════════════════════════════════════════ */
  console.log('\n[6] INJURY change -> REMOVE -> restart');
  await install();
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
  /* ⚠ **THIS CELL WAS RED, AND CLOSING IT NEEDED A RULING RATHER THAN A PATCH.**
   *
   * It failed like this:
   *
   * ```
   * before restart  ["Easy Bike@-","Landmine Press@35","Barbell Row@72.5","Banded Dead Bug@0"]
   * after  restart  ["RDLs@67.5","Bulgarian Split Squats@25","Landmine Press@35","Barbell Row@72.5","Banded Dead Bug@0"]
   * ```
   *
   * **THE INJURY RECOMPOSITION WAS HELD IN MEMORY ONLY.** The episode is durable
   * — `activeConstraints` still reads `["injury-knee"]` after hydration — but the
   * rows it changed live in `dateOverrides`, which boot blanks by design and
   * rebuilds from the decision ledger. The injury is deliberately NOT a ledger
   * decision (`LEDGER_RECORDED_ACTION_TYPES` is the three exercise-level types,
   * so one act never becomes two undoable decisions), so nothing put it back.
   *
   * Three facts blocked every small fix — that allow-list rule, a
   * NON-RE-ENTRANT `withAcceptedMutationLock`, and the synchronous executor the
   * replay uses refusing `set_injury_modifier` outright. Sam ruled the way
   * through: *"Startup may replay the accepted decisions and facts, but it must
   * not make a new choice or silently discard anything."* So the FACT is
   * re-applied at boot, after the decisions, through the same owner the live
   * door used — `reapplyActiveInjuryRecompositions`. No new ledger entry, no
   * transaction, same day, same ladder, same answer. */
  ok('the restarted session is IDENTICAL after an injury change and a removal',
    sameSession(s6After, s6Before), `${JSON.stringify(s6Before)} -> ${JSON.stringify(s6After)}`);

  /* ═══ 7 ═══════════════════════════════════════════════════════════════ */
  console.log('\n[7] ADD -> SWAP -> restart');
  await install();
  const s7Start = rowsOn(TARGET);
  const s7Added = offeredAddFor(s7Start.map((r) => r.split('@')[0]!));
  const s7AddResult = await add(s7Added);
  ok('CONTROL — the offered Add is accepted', s7AddResult.ok, JSON.stringify({ exercise: s7Added, result: s7AddResult }));
  const s7AfterAdd = rowsOn(TARGET);
  ok('ADD landed and took nothing away',
    s7AfterAdd.some((r) => r.startsWith(`${s7Added.name}@`))
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
    s7After.some((r) => r.startsWith(`${s7Added.name}@`)), JSON.stringify(s7After));

  /* ═══ 8 ═══════════════════════════════════════════════════════════════ */
  console.log("\n[8] SAM'S RULING — a later injury DISPLACES the athlete's choice, says so, keeps it, and gives it back");
  await install();
  const lowerDay = quiet(() => resolveWeekWithConditioning(mondayFor(TARGET), buildScheduleStateImperative()))
    .find(day => day.workout?.exercises[0]?.section18Evidence?.mainStrengthPattern === 'squat'
      || day.workout?.exercises[0]?.section18Evidence?.mainStrengthPattern === 'hinge');
  if (!lowerDay) throw new Error('Knee displacement coordinate did not reach a lower-body lift');
  TARGET = lowerDay.date;
  setJourneyClock(TARGET);
  const s8Start = rowsOn(TARGET);
  const s8Victim = s8Start[0]!.split('@')[0]!;
  const s8Choice = offeredReplacementFor(s8Victim, s8Start.map((r) => r.split('@')[0]!));
  await swap(s8Victim, s8Choice);
  const s8AfterSwap = rowsOn(TARGET);
  ok("CONTROL — the athlete's chosen exercise is on the day before the injury",
    s8AfterSwap.some((r) => r.startsWith(`${s8Choice}@`)), `${s8Choice} / ${JSON.stringify(s8AfterSwap)}`);

  const s8Injury = await injuryDeclared() as { ok: boolean; createdModifierIds?: string[] };
  const s8AfterInjury = rowsOn(TARGET);
  const s8Subs = substitutionsOn(TARGET);
  /* ⚠ **NON-VACUITY.** If the ladder happened to pick something the knee allows,
   * nothing is displaced and every cell below would pass by not applying. The
   * suite says so rather than reporting a green it did not earn. */
  const displaced = !s8AfterInjury.some((r) => r.startsWith(`${s8Choice}@`));
  ok("CONTROL — the injury really does forbid the athlete's choice (else this case proves nothing)",
    displaced, `${s8Choice} still present: ${JSON.stringify(s8AfterInjury)}`);
  ok('the illegal choice is NOT shown',
    !s8AfterInjury.some((r) => r.startsWith(`${s8Choice}@`)), JSON.stringify(s8AfterInjury));
  // R-124: knee restrictions exhaust the per-exercise ladder; unrelated work
  // must not be labelled a replacement. The session reports its pause instead.
  const s8Adjustment = injuryAdjustmentOn(TARGET);
  /* ⚠ **THIS ASKED FOR ZERO SUBSTITUTIONS ON THE WHOLE DAY, AND THAT WAS AN
   * ACCIDENT OF SCARCITY (R-368/R-372, 2026-09-04).**
   *
   * R-124's property is about THE ATHLETE'S CHOSEN LIFT: a knee restriction
   * exhausts its per-exercise ladder, so the session must NAME it as paused
   * rather than dress unrelated work up as its replacement. `s8Subs.length === 0`
   * was a proxy that held only because no hinge in the app was better for a knee
   * than `RDLs`.
   *
   * `B-Stance RDL` arrived with `knee: good` where `RDLs` is `caution`, so the
   * injury system now does the right thing and swaps THAT lift — a real,
   * same-family, better-for-the-knee substitution, on a different row from the
   * one this cell is about. Refusing it would be pausing a hinge the athlete
   * could safely train.
   *
   * So the cell asks its own question: the CHOSEN lift is paused, and nothing is
   * offered as its replacement. The non-vacuity below keeps it honest — if the
   * chosen lift ever stops being displaced, this case proves nothing. */
  const s8ChoiceSubstituted = s8Subs.some((entry) => entry.includes(`<-${s8Choice}`));
  ok('R-124 names the chosen lift as paused rather than inventing a replacement',
    !!s8Adjustment?.paused.includes(s8Choice) && !s8ChoiceSubstituted,
    JSON.stringify({ adjustment: s8Adjustment, substitutions: s8Subs }));
  ok('non-vacuity: the chosen lift really was displaced by the injury',
    displaced, `${s8Choice} still on the day`);
  ok('the visible session explains the injury adjustment',
    !!s8Adjustment?.summary && /knee/i.test(s8Adjustment.summary), JSON.stringify(s8Adjustment));

  const s8Before = rowsOn(TARGET);
  ok('the app came back up', await restart());
  const s8After = rowsOn(TARGET);
  ok('and the restart reproduces it EXACTLY — no new choice at startup',
    sameSession(s8After, s8Before), `${JSON.stringify(s8Before)} -> ${JSON.stringify(s8After)}`);
  ok('the named pause and explanation survive the restart too',
    !!s8Adjustment && JSON.stringify(injuryAdjustmentOn(TARGET)) === JSON.stringify(s8Adjustment),
    JSON.stringify(injuryAdjustmentOn(TARGET)));

  /* ── AND THE PREFERENCE IS STILL UNDERNEATH ──────────────────────────────
   * Sam: "Keep the athlete's original Swap preference underneath. When the
   * injury/equipment constraint ends, their chosen Swap returns if it is legal
   * again." Nothing re-swaps here — the decision was never discarded, so
   * clearing the fact is enough. */
  const episodeId = (s8Injury.createdModifierIds ?? [])[0];
  ok('CONTROL — the injury episode has an id to clear', Boolean(episodeId), String(episodeId));
  await quietAsync(() => door()({
    type: 'clear_injury_modifier',
    source: { screen: 'session_detail', surface: 'exercise_injury_flow', initiatedBy: 'tap' },
    scope: 'current_and_future',
    payload: { episodeId },
    requiresRebuild: false, createsActiveModifier: false, oneOffOnly: false,
  }, { todayISO: TARGET }));
  const s8Cleared = rowsOn(TARGET);
  ok("the athlete's chosen exercise RETURNS once the injury clears",
    s8Cleared.some((r) => r.startsWith(`${s8Choice}@`)), JSON.stringify(s8Cleared));
  ok('and nothing is standing in for it any more',
    !substitutionsOn(TARGET).some((entry) => entry.includes(`<-${s8Choice}:injury`)),
    JSON.stringify(substitutionsOn(TARGET)));

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
