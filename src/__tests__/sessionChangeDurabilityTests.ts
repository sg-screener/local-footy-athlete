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
  const { legalAddFamilies, legalAddCandidates } = require('../utils/addExerciseCandidates');
  const environment = quiet(() => resolveTapSwapEnvironment({
    date: TARGET, profile: useProfileStore.getState().onboardingData,
    activeConstraints: [], readinessSignal: null,
  }));
  // SAM'S THREE LEVELS (2026-08-20): the first thing the athlete could actually
  // tap through to — first family, first subcategory, first choice.
  const args = {
    environment, existingExerciseNames: existing,
    profile: useProfileStore.getState().onboardingData,
  };
  const families = legalAddFamilies(args) as { subcategories: { id: string }[] }[];
  const subcategory = families[0]!.subcategories[0]!.id;
  return (legalAddCandidates({ ...args, subcategory }) as { name: string }[])[0]!.name;
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
  await quietAsync(() => restoreExcludedExerciseDurably(s2Gone));
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

  /* ═══ 8 ═══════════════════════════════════════════════════════════════ */
  console.log("\n[8] SAM'S RULING — a later injury DISPLACES the athlete's choice, says so, keeps it, and gives it back");
  install();
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
  ok('a legal replacement stands in its place — the day did not just lose a row',
    s8AfterInjury.length === s8AfterSwap.length, `${s8AfterSwap.length} -> ${s8AfterInjury.length}`);
  /* Sam: "Tell the athlete exactly why their chosen exercise is temporarily not
   * being used." The row names whose place it is taking, and the cause. */
  ok("the athlete is TOLD why — the standing-in row names their exercise and the injury",
    s8Subs.some((entry) => entry.includes(`<-${s8Choice}:injury`)), JSON.stringify(s8Subs));

  const s8Before = rowsOn(TARGET);
  ok('the app came back up', await restart());
  const s8After = rowsOn(TARGET);
  ok('and the restart reproduces it EXACTLY — no new choice at startup',
    sameSession(s8After, s8Before), `${JSON.stringify(s8Before)} -> ${JSON.stringify(s8After)}`);
  ok('the reason survives the restart too',
    substitutionsOn(TARGET).some((entry) => entry.includes(`<-${s8Choice}:injury`)),
    JSON.stringify(substitutionsOn(TARGET)));

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
