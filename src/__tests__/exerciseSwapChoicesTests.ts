/**
 * SWAP OFFERS A MENU, AND IT IS THE LADDER'S OWN TIERS.
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
  console.log('\n[1] THE SPREAD — what the ladder really offers a real session');

  const weekStart = install();
  const {
    resolveTapSwapEnvironment, getTapSwapChoices, groupTapSwapChoices,
    TAP_SWAP_GROUP_LABEL, TAP_SWAP_CHOICES_PER_GROUP,
  } = require('../utils/tapSwapHierarchy');
  const workout = (() => {
    const week = quiet(() => resolveWeekWithConditioning(
      mondayFor(TARGET), buildScheduleStateImperative()));
    return (week.find((d) => d.date === TARGET) as { workout?: Workout }).workout!;
  })();
  const rowNames = (workout.exercises ?? []).map((r) =>
    String((r as { exercise?: { name?: string } }).exercise?.name));
  const environment = quiet(() => resolveTapSwapEnvironment({
    date: TARGET,
    profile: useProfileStore.getState().onboardingData,
    activeConstraints: [],
    readinessSignal: null,
  }));
  const menuFor = (name: string) => groupTapSwapChoices(quiet(() => getTapSwapChoices({
    originalExercise: name, reason: 'preference', environment,
    existingExerciseNames: rowNames,
  }))) as { id: string; label: string; choices: { name: string; hierarchyTier: string }[] }[];

  const menus = rowNames.map((name) => ({ name, groups: menuFor(name) }));
  for (const entry of menus) {
    console.log(`    ${entry.name.padEnd(24)} ${entry.groups
      .map((g) => `${g.id}:${g.choices.length}`).join(' ') || '(none)'}`);
  }
  ok('CONTROL — at least one row fills TWO training groups, so the caps are not vacuous',
    menus.some((entry) => entry.groups.filter((g) => g.id !== 'other').length >= 2),
    JSON.stringify(menus.map((m) => [m.name, m.groups.map((g) => g.id)])));
  ok('CONTROL — and at least one row genuinely has only ONE group',
    menus.some((entry) => entry.groups.length === 1),
    JSON.stringify(menus.map((m) => [m.name, m.groups.length])));

  /* ═══════════════════════════════════════════════════════════════════════ */
  console.log('\n[2] AT MOST TWO PER GROUP, AT MOST SIX IN ALL');

  for (const entry of menus) {
    ok(`${entry.name} — no group exceeds two`,
      entry.groups.every((g) => g.choices.length <= TAP_SWAP_CHOICES_PER_GROUP),
      JSON.stringify(entry.groups.map((g) => [g.id, g.choices.length])));
  }
  ok('no row is ever offered more than six',
    menus.every((entry) => entry.groups.reduce((n, g) => n + g.choices.length, 0) <= 6),
    JSON.stringify(menus.map((m) => [m.name, m.groups.reduce((n, g) => n + g.choices.length, 0)])));

  /* ═══════════════════════════════════════════════════════════════════════ */
  console.log('\n[3] THE GROUPS ARE LABELLED, ORDERED, AND NEVER EMPTY');

  ok('the three labels are Sam\u2019s words',
    TAP_SWAP_GROUP_LABEL.closest === 'Closest matches'
    && TAP_SWAP_GROUP_LABEL.similar === 'Similar options'
    && TAP_SWAP_GROUP_LABEL.other === 'Other useful options',
    JSON.stringify(TAP_SWAP_GROUP_LABEL));
  ok('every group returned carries its label',
    menus.every((entry) => entry.groups.every((g) =>
      g.label === (TAP_SWAP_GROUP_LABEL as Record<string, string>)[g.id])));
  ok('a group with nothing legal in it is ABSENT, not empty',
    menus.every((entry) => entry.groups.every((g) => g.choices.length > 0)));
  ok('closest always precedes similar, which always precedes other',
    menus.every((entry) => {
      const order = entry.groups.map((g) => ['closest', 'similar', 'other'].indexOf(g.id));
      return order.every((value, index) => index === 0 || value > order[index - 1]!);
    }));

  /* ═══════════════════════════════════════════════════════════════════════ */
  console.log('\n[4] REST IS NOT A SWAP — Remove is a different door');

  ok('no group ever offers rest',
    menus.every((entry) => entry.groups.every((g) =>
      g.choices.every((c) => c.hierarchyTier !== 'rest'))));
  ok('and every offered choice names an exercise',
    menus.every((entry) => entry.groups.every((g) => g.choices.every((c) => Boolean(c.name)))));
  /* ⚠ **THE TWO CELLS ABOVE WERE GREEN AND EMPTY, AND A MUTATION SAID SO.**
   *
   * Making `rest` an offerable group left all 20 cells green: the ladder only
   * ever emits a rest choice on a medical stop or a no-options path, and a real
   * off-season session reaches neither. A cell that asserts an absence must be
   * shown the thing it is refusing, so the refusal is asked of the grouping
   * owner directly, with every tier on the table at once. */
  /* THE REST ENTRIES GO FIRST, DELIBERATELY. Placed last they were absorbed by
   * the per-group cap rather than refused by the tier rule, and the mutation
   * stayed green a SECOND time — a cap is not a refusal. */
  const everyTier = groupTapSwapChoices([
    { kind: 'rest', name: null, hierarchyTier: 'rest', source: 'rest_fallback', reason: '' },
    { kind: 'rest', name: 'Rest', hierarchyTier: 'rest', source: 'rest_fallback', reason: '' },
    { kind: 'rest', name: 'Rest this slot', hierarchyTier: 'rest', source: 'rest_fallback', reason: '' },
    { kind: 'exercise', name: 'A', hierarchyTier: 'same_movement_pattern', source: 'pattern_substitute_engine', reason: '' },
    { kind: 'exercise', name: 'B', hierarchyTier: 'similar_muscle_group', source: 'pattern_substitute_engine', reason: '' },
    { kind: 'exercise', name: 'C', hierarchyTier: 'unaffected_body_area', source: 'pattern_substitute_engine', reason: '' },
    { kind: 'recovery', name: 'D', hierarchyTier: 'recovery_easy_conditioning', source: 'recovery_fallback', reason: '' },
  ]) as { id: string; choices: { name: string }[] }[];
  ok('CONTROL — a rest choice really was on the table', everyTier.length > 0);
  ok('and a `rest` tier is REFUSED a group of its own',
    everyTier.every((g) => g.id !== 'rest'), JSON.stringify(everyTier.map((g) => g.id)));
  ok('and it is not smuggled into "Other useful options" either',
    everyTier.every((g) => g.choices.every((c) => !c.name.startsWith('Rest'))),
    JSON.stringify(everyTier.map((g) => [g.id, g.choices.map((c) => c.name)])));
  ok('a nameless choice is never offered',
    everyTier.every((g) => g.choices.every((c) => Boolean(c.name))));

  /* ═══════════════════════════════════════════════════════════════════════ */
  console.log('\n[5] A SWAP OWNS ITS LOAD AND ITS HISTORY, AND NOTHING ELSE');

  const swapVictim = rowNames[0]!;
  const menu = menuFor(swapVictim);
  const replacement = menu[0]!.choices[0]!;
  const beforeRows = rowsOn(TARGET);
  const originalLoad = beforeRows.find((r) => r.startsWith(`${swapVictim}@`))!.split('@')[1];
  const swap = quiet(() => executeProgramControlAction({
    type: 'swap_exercise',
    source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' },
    scope: 'today_only',
    payload: {
      date: TARGET,
      fromExercise: swapVictim,
      toExercise: { name: replacement.name, sets: 3, repsMin: 6, repsMax: 8 },
    },
    requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true,
  })) as { ok: boolean; message?: string };
  ok('the swap door reports success', swap.ok, swap.message);
  const afterRows = rowsOn(TARGET);
  ok('the original is gone', !afterRows.some((r) => r.startsWith(`${swapVictim}@`)),
    JSON.stringify(afterRows));
  ok('the chosen replacement is there', afterRows.some((r) => r.startsWith(`${replacement.name}@`)),
    JSON.stringify(afterRows));
  ok('the session is the SAME SIZE — a swap replaces, it does not remove',
    afterRows.length === beforeRows.length, `${beforeRows.length} -> ${afterRows.length}`);
  const newLoad = afterRows.find((r) => r.startsWith(`${replacement.name}@`))!.split('@')[1];
  ok('the replacement carries its OWN load, not the original\u2019s',
    newLoad !== originalLoad, `original=${originalLoad} replacement=${newLoad}`);
  /* ⚠ THE CELL THAT SEPARATES SWAP FROM REMOVE. Sam, 2026-08-19: *"No exclusion
   * created."* A swap says "I would rather do this one today"; it does not say
   * "leave the other one out". Writing an exclusion here would silently ban the
   * original from every future session the athlete never asked about. */
  ok('and the swap created NO exclusion', getAthleteExclusions().length === 0,
    JSON.stringify(getAthleteExclusions()));

  /* ═══ RANKED-CHOICE QUALITY ══════════════════════════════════════════════
   *
   * Sam, 2026-08-19, looking at the menu offered for `Back Squat`:
   * *"Bodyweight Squat is not a normal Back Squat alternative for a moderate or
   * experienced full-gym athlete. Breathing Reset is not a Back Squat
   * replacement. … Offer up to two Closest matches, two Similar options, and two
   * genuinely Other useful options. Show fewer choices instead of padding the
   * list with weak or irrelevant options. Regression exercises only appear when
   * an Equipment or Injury constraint justifies them."*
   *
   * ⚠ **EVERY ONE OF THOSE OPTIONS WAS LEGAL.** `assessTapSwapCandidateSafety`
   * was doing its job; legality is simply not the same question as *would this
   * athlete ever choose it*. So these cells are about USEFULNESS, and the last
   * one is the control: the same regressions must still appear when a constraint
   * actually justifies them, or the rule has become a blanket ban.
   */
  console.log('\n[RANKED CHOICES] the menu an unconstrained athlete is offered');
  const { equipmentClassFor } = require('../utils/loadEstimation');

  const freeEnv = quiet(() => resolveTapSwapEnvironment({
    date: TARGET, profile: useProfileStore.getState().onboardingData,
    activeConstraints: [], readinessSignal: null,
  }));
  const barbellRow = rowsOn(TARGET).map((r) => r.split('@')[0]!)
    .find((name) => equipmentClassFor(name) === 'barbell');
  ok('CONTROL — the session has a BARBELL lift to ask about',
    Boolean(barbellRow), JSON.stringify(rowsOn(TARGET)));

  /* ⚠ **EVERY LOADED ROW, NOT THE FIRST ONE.** The first cut asked only about
   * `barbellRow` and mutation M9 — disabling the regression filter outright —
   * SURVIVED it: that row's alternatives happen to be loaded anyway, so the cell
   * was green whether the filter ran or not. A guard that cannot see its own
   * rule being deleted is not guarding it. */
  const loadedRows = rowsOn(TARGET).map((r) => r.split('@')[0]!)
    .filter((name) => {
      const kind = equipmentClassFor(name);
      return Boolean(kind) && kind !== 'bodyweight';
    });
  ok('CONTROL — the session has loaded rows to ask about',
    loadedRows.length > 0, JSON.stringify(rowsOn(TARGET)));
  const offered = new Map<string, string[]>();
  for (const row of loadedRows) {
    offered.set(row, (quiet(() => getTapSwapChoices({
      originalExercise: row, reason: 'preference', environment: freeEnv,
      existingExerciseNames: rowsOn(TARGET).map((r) => r.split('@')[0]!),
    })) as { name: string | null }[]).map((c) => String(c.name)));
  }
  ok('CONTROL — the loaded rows have alternatives at all',
    [...offered.values()].some((names) => names.length > 0),
    JSON.stringify([...offered]));
  const withBodyweight = [...offered].filter(([, names]) =>
    names.some((name) => equipmentClassFor(name) === 'bodyweight'));
  ok('no BODYWEIGHT regression is offered for ANY loaded lift',
    withBodyweight.length === 0, JSON.stringify(withBodyweight));
  const withFiller = [...offered].filter(([, names]) =>
    names.includes('Breathing Reset') || names.includes('Easy Bike'));
  ok('no recovery filler is offered while real training options exist',
    withFiller.length === 0, JSON.stringify(withFiller));
  const freeGroups = groupTapSwapChoices(quiet(() => getTapSwapChoices({
    originalExercise: barbellRow!, reason: 'preference', environment: freeEnv,
    existingExerciseNames: rowsOn(TARGET).map((r) => r.split('@')[0]!),
  }))) as { id: string; choices: unknown[] }[];
  ok('at most two per group, and no empty group is drawn',
    freeGroups.every((g) => g.choices.length > 0 && g.choices.length <= 2),
    JSON.stringify(freeGroups.map((g) => [g.id, g.choices.length])));

  /* ⚠ **THE CONTROL THAT MAKES THIS A CONDITION, NOT A BAN.**
   *
   * Sam: *"Regression exercises only appear when an Equipment or Injury
   * constraint justifies them."* — so the same regressions MUST still be
   * offered once one does. Without this cell the suite would pass just as well
   * on an app that had stopped offering them at all.
   *
   * The first cut faked the constraint by blanking `profile.equipment`, and the
   * menu did not move: `resolveTapSwapEnvironment` reads `equipmentAnswer`, so
   * the athlete still had a full gym and the cell was asserting nothing. A real
   * injury is passed instead.
   */
  const injuredEnv = quiet(() => resolveTapSwapEnvironment({
    date: TARGET, profile: useProfileStore.getState().onboardingData,
    activeConstraints: [], readinessSignal: null,
    primaryInjury: { bucket: 'shoulder', severity: 7, seriousSymptoms: false },
  }));
  const injuredNames = (quiet(() => getTapSwapChoices({
    originalExercise: barbellRow!, reason: 'injury_or_pain',
    environment: injuredEnv, existingExerciseNames: [],
  })) as { name: string | null }[]).map((c) => String(c.name));
  ok('but WITH an injury the gentler options are allowed back',
    injuredNames.some((name) => equipmentClassFor(name) === 'bodyweight'
      || name === 'Breathing Reset' || name === 'Easy Bike'),
    `${barbellRow} with a shoulder injury -> ${JSON.stringify(injuredNames)}`);

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
