/**
 * ADD OFFERS THE APP'S OWN VOCABULARY, FILTERED FOR THIS ATHLETE.
 *
 * Sam, 2026-08-19: *"Add any legal exercise, mobility or conditioning
 * component. Remove nothing. Respect equipment, injury and genuine session
 * limits. Own load authority."*
 *
 * ⚠ **WHAT THIS REPLACED.** A hand-written table of TWELVE names, two per
 * "kind", offering whichever one the session did not already contain. It asked
 * NOTHING about equipment and NOTHING about injuries.
 *
 * ⚠ **AND WHAT "SESSION LIMITS" DOES NOT MEAN.** `REGISTRY-GREP: R-088` —
 * *"7 is the max the app should set and a user should be able to add as many of
 * their own things on top of it as they choose"*. The cap binds the PLANNER. A
 * cell asserting that Add refuses at seven would be enforcing the opposite of
 * the ruling, so there is one here asserting it does NOT.
 *
 * ## THE CONTROLS
 *
 * A filter suite passes trivially on a world where nothing was ever filtered.
 * Case [2] therefore compares a full-kit athlete against a bodyweight-only one
 * and against an injured one, and each comparison states what it expects to
 * LOSE.
 *
 * ## AND SINCE 2026-08-20 — SAM'S THREE LEVELS
 *
 * *"1. Strength / Conditioning / Mobility-Warm-up. 2. A relevant subcategory,
 * such as upper/lower/movement pattern. 3. Legal final exercise choices. Never
 * show athletes a mixed internal list containing options like 'Breathing
 * reset'."*
 *
 * The names were already right; the MENU was the generation prompt's own filing
 * — 23 flat buttons reading `Upper push horizontal`, `Tissue quality`,
 * `Breathing reset`. Case [5] holds the hierarchy, and it is written as a BAN
 * on every internal label rather than as a list of the good ones: a cell that
 * only checks the three families are present would stay green on a menu that
 * showed them AND `Breathing reset` underneath.
 *
 * ## WHAT THIS SUITE DOES NOT COVER
 *
 * The simulator.
 *
 * Run: npm run test:exercise-add-candidates
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
  console.log('\n[1] ANY LEGAL COMPONENT — strength, mobility AND conditioning');

  install();
  const { resolveTapSwapEnvironment } = require('../utils/tapSwapHierarchy');
  const {
    legalAddFamilies, legalAddCandidates, ADD_SUBCATEGORIES, ADD_FAMILY_ORDER,
  } = require('../utils/addExerciseCandidates');
  const profile = useProfileStore.getState().onboardingData;
  const fullKit = quiet(() => resolveTapSwapEnvironment({
    date: TARGET, profile, activeConstraints: [], readinessSignal: null,
  }));

  type Sub = { id: string; label: string; count: number };
  type Family = { id: string; label: string; count: number; subcategories: Sub[] };
  const familiesOf = (env: unknown, existing?: string[]): Family[] =>
    legalAddFamilies({
      environment: env, profile,
      ...(existing ? { existingExerciseNames: existing } : {}),
    }) as Family[];
  const leafOf = (env: unknown, subcategory: string, existing?: string[]) =>
    legalAddCandidates({
      environment: env, profile, subcategory,
      ...(existing ? { existingExerciseNames: existing } : {}),
    }) as { name: string; sets: number; weightKg: number | null }[];
  /** Every legal name on offer anywhere in the tree — the flat comparison set. */
  const everyNameIn = (env: unknown, existing?: string[]): Set<string> => {
    const names = new Set<string>();
    for (const family of familiesOf(env, existing)) {
      for (const sub of family.subcategories) {
        for (const candidate of leafOf(env, sub.id, existing)) names.add(candidate.name);
      }
    }
    return names;
  };

  const families = familiesOf(fullKit);
  for (const family of families) {
    console.log(`    ${family.label} (${family.count}) — ${family.subcategories.map((sub) => `${sub.label}:${sub.count}`).join(', ')}`);
  }
  const groups = families.flatMap((family) => family.subcategories.map((sub) => ({
    label: sub.label, candidates: leafOf(fullKit, sub.id),
  })));
  ok('CONTROL — the vocabulary really produced subcategories', groups.length > 3,
    `${groups.length} subcategories`);
  const labels = families.map((f) => f.label);
  ok('strength is offered', labels.includes('Strength'), JSON.stringify(labels));
  ok('mobility is offered', labels.includes('Mobility / Warm-up'), JSON.stringify(labels));
  ok('conditioning is offered', labels.includes('Conditioning'), JSON.stringify(labels));
  ok('no subcategory is ever empty', groups.every((g) => g.candidates.length > 0));
  /* ⚠ **THE 6-PER-GROUP CAP IS GONE, AND ITS CELL IS REPLACED BY ITS OPPOSITE.**
   * Sam's level 3 is *"legal final exercise choices"* and `REGISTRY-GREP: R-088`
   * is *"a user should be able to add as many of their own things on top of it
   * as they choose"*. At six the athlete could not reach Dips or the Z-Press at
   * all. So the cell that guarded the cap now proves it is not there: at least
   * one subcategory offers MORE than the old six. */
  ok('a subcategory may now offer more than the old six-per-group cap',
    groups.some((g) => g.candidates.length > 6),
    JSON.stringify(groups.map((g) => `${g.label}:${g.candidates.length}`)));
  ok('every candidate carries a dose', groups.every((g) => g.candidates.every((c) => c.sets > 0)));
  /* ⚠ OWN LOAD AUTHORITY. `startingWeightForAthlete` answers from this
   * athlete's own anchors; a movement with no prescribable load answers null
   * rather than borrowing a number. A suite that only checked "not undefined"
   * would pass on a world where every row came back null. */
  const loaded = groups.flatMap((g) => g.candidates).filter((c) => c.weightKg !== null);
  ok('CONTROL — at least one candidate carries a real load, so the load owner ran',
    loaded.length > 0, `${loaded.length} loaded candidates`);
  ok('and every load it gives is a positive number',
    loaded.every((c) => typeof c.weightKg === 'number' && c.weightKg! > 0),
    JSON.stringify(loaded.slice(0, 5)));

  /* ═══════════════════════════════════════════════════════════════════════ */
  console.log('\n[2] EQUIPMENT AND INJURY ACTUALLY NARROW IT');

  const fullNames = everyNameIn(fullKit);

  const bodyweightOnly = quiet(() => resolveTapSwapEnvironment({
    date: TARGET,
    profile: { ...profile, equipment: [], equipmentAnswer: { tags: {}, modalities: {}, answeredOn: INSTALL_DAY } } as never,
    activeConstraints: [], readinessSignal: null,
  }));
  const bodyweightNames = everyNameIn({
    ...bodyweightOnly, availableEquipment: [], availableEquipmentTags: [], hasEquipmentConstraint: true,
  });
  ok('a bodyweight-only athlete is offered FEWER things',
    bodyweightNames.size < fullNames.size,
    `full=${fullNames.size} bodyweight=${bodyweightNames.size}`);
  ok('and everything they ARE offered was legal for the full-kit athlete too',
    [...bodyweightNames].every((name) => fullNames.has(name)),
    JSON.stringify([...bodyweightNames].filter((n) => !fullNames.has(n))));

  const injured = quiet(() => resolveTapSwapEnvironment({
    date: TARGET, profile, activeConstraints: [], readinessSignal: null,
    primaryInjury: { bucket: 'knee', severity: 7 },
  }));
  /* ⚠ **THIS USED TO SET `activeInjuries`, WHICH IS NOW DELETED.** It was a
   * projection of the severity, and setting it here without the severity is
   * exactly the shape that made a healthy-athlete control read 32 exercises as
   * unsafe. `injurySeverities` is the fact; 6 is Sam's limiting band, which is
   * what `'avoid'` meant. */
  const injuredNames = everyNameIn({
    ...injured,
    injurySeverities: { ...injured.injurySeverities, knee: 6 },
  });
  ok('an athlete with a bad knee is offered FEWER things',
    injuredNames.size < fullNames.size, `full=${fullNames.size} injured=${injuredNames.size}`);

  /* ═══════════════════════════════════════════════════════════════════════ */
  console.log('\n[3] ADD REMOVES NOTHING, AND NEVER OFFERS WHAT IS ALREADY THERE');

  const weekStart = mondayFor(TARGET);
  const before = rowsOn(TARGET);
  const onTheDay = before.map((row) => row.split('@')[0]!);
  const withExisting = everyNameIn(fullKit, onTheDay);
  ok('CONTROL — the session really has rows to collide with', onTheDay.length > 0,
    JSON.stringify(onTheDay));
  ok('nothing already on the day is offered',
    [...withExisting].every((name) => !onTheDay.includes(name)),
    JSON.stringify([...withExisting].filter((n) => onTheDay.includes(n))));

  const firstFamily = familiesOf(fullKit, onTheDay)[0]!;
  const chosen = leafOf(fullKit, firstFamily.subcategories[0]!.id, onTheDay)[0]!;
  const added = quiet(() => executeProgramControlAction({
    type: 'add_exercise',
    source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' },
    scope: 'today_only',
    payload: { date: TARGET, exercise: { name: chosen.name, sets: 2, repsMin: 8, repsMax: 12 } },
    requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true,
  })) as { ok: boolean; message?: string };
  ok('the add door reports success', added.ok, added.message);
  const after = rowsOn(TARGET);
  ok('the session grew by exactly one', after.length === before.length + 1,
    `${before.length} -> ${after.length}`);
  ok('the chosen exercise is on the day', after.some((r) => r.startsWith(`${chosen.name}@`)),
    JSON.stringify(after));
  ok('and NOTHING was removed — every row that was there still is',
    before.every((row) => after.includes(row)),
    JSON.stringify(before.filter((row) => !after.includes(row))));
  ok('an add creates NO exclusion', getAthleteExclusions().length === 0,
    JSON.stringify(getAthleteExclusions()));
  void weekStart;

  /* ═══════════════════════════════════════════════════════════════════════ */
  console.log('\n[4] THE APP\u2019S BUDGET BINDS THE APP, NOT THE ATHLETE (R-088)');

  /* Sam ruled the 7-exercise cap and, in the same sentence, ruled that it does
   * NOT bind the athlete: *"a user should be able to add as many of their own
   * things on top of it as they choose"*. So this asks Add to keep accepting
   * past seven, and it is the ruling that is being enforced, not ignored. */
  let accepted = 0;
  let sawSeven = false;
  const onDayNow = rowsOn(TARGET).map((r) => r.split('@')[0]!);
  for (const sub of familiesOf(fullKit, onDayNow).flatMap((f) => f.subcategories)) {
    for (const candidate of leafOf(fullKit, sub.id, onDayNow)) {
      const rowsNow = rowsOn(TARGET).length;
      if (rowsNow >= 7) sawSeven = true;
      const result = quiet(() => executeProgramControlAction({
        type: 'add_exercise',
        source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' },
        scope: 'today_only',
        payload: { date: TARGET, exercise: { name: candidate.name, sets: 2, repsMin: 8, repsMax: 12 } },
        requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true,
      })) as { ok: boolean };
      if (result.ok) accepted++;
      if (rowsOn(TARGET).length >= 10) break;
    }
    if (rowsOn(TARGET).length >= 10) break;
  }
  ok('CONTROL — the session really was pushed past seven rows', sawSeven,
    `rows now ${rowsOn(TARGET).length}`);
  ok('the athlete\u2019s own adds keep landing past the app\u2019s cap of seven',
    rowsOn(TARGET).length > 7, `rows=${rowsOn(TARGET).length} accepted=${accepted}`);

  /* ═══════════════════════════════════════════════════════════════════════ */
  console.log('\n[5] SAM\u2019S THREE LEVELS, AND NO INTERNAL LABEL AT ANY OF THEM');

  install();
  const { selectableVocabularyGroups } = require('../data/selectableExerciseVocabulary');
  const { SECTION_LABELS } = require('../utils/sessionExecutionChecklist');
  const tree = familiesOf(fullKit);

  // ── LEVEL 1 — exactly Sam's three, in his order ──
  ok('level 1 is exactly three families',
    tree.length === 3, JSON.stringify(tree.map((f) => f.label)));
  ok('and they are Strength, then Conditioning, then Mobility / Warm-up, in that order',
    JSON.stringify(tree.map((f) => f.id)) === JSON.stringify(['strength', 'conditioning', 'mobility']),
    JSON.stringify(tree.map((f) => f.id)));
  /* NOT A SECOND VOCABULARY. The family label must be the SESSION SCREEN'S own
   * word for that section, so adding under "Conditioning" lands in the section
   * the athlete's session calls Conditioning. Re-typing the three strings in
   * this cell would pass on two tables that had already drifted. */
  ok('every family label is the session screen\u2019s own label for that section',
    tree.every((family) => family.label === SECTION_LABELS[family.id]),
    JSON.stringify(tree.map((f) => `${f.id}=${f.label}`)));

  // ── LEVEL 2 — a real subcategory under every family ──
  ok('every family offers at least one subcategory',
    tree.every((family) => family.subcategories.length > 0),
    JSON.stringify(tree.map((f) => `${f.label}:${f.subcategories.length}`)));
  ok('CONTROL — at least one family really subdivides, so level 2 is not a pass-through',
    tree.some((family) => family.subcategories.length > 1),
    JSON.stringify(tree.map((f) => `${f.label}:${f.subcategories.length}`)));
  ok('every subcategory belongs to the family it is listed under',
    tree.every((family) => family.subcategories.every(
      (sub) => ADD_SUBCATEGORIES[sub.id]?.family === family.id)),
    JSON.stringify(tree.flatMap((f) => f.subcategories.map((s) => `${f.id}/${s.id}`))));
  /* R-110 — *"Power belongs inside the Strength section, generally as its first
   * row"*. A menu is where that ruling is easiest to break by accident: power
   * has its own pool, so its own top-level button is the obvious wrong move. */
  const strength = tree.find((family) => family.id === 'strength')!;
  ok('R-110 — Power is INSIDE Strength, and it is Strength\u2019s first subcategory',
    strength.subcategories[0]?.id === 'power',
    JSON.stringify(strength.subcategories.map((s) => s.id)));
  ok('and Power is not a family of its own',
    !tree.some((family) => /power/i.test(family.label)),
    JSON.stringify(tree.map((f) => f.label)));

  // ── LEVEL 3 — the count on a button is the list behind it ──
  /* A count that is not the length of the list it opens is the shape that makes
   * a menu lie: the athlete taps "Prehab (5)" and gets four. Both numbers come
   * from one legality pass precisely so this can be asserted. */
  const countMismatches = tree.flatMap((family) => family.subcategories
    .filter((sub) => leafOf(fullKit, sub.id).length !== sub.count)
    .map((sub) => `${sub.label}: says ${sub.count}, opens ${leafOf(fullKit, sub.id).length}`));
  ok('every subcategory count is exactly the number of choices behind it',
    countMismatches.length === 0, JSON.stringify(countMismatches));
  ok('and a family\u2019s count is the sum of its subcategories\u2019',
    tree.every((family) => family.count
      === family.subcategories.reduce((total, sub) => total + sub.count, 0)),
    JSON.stringify(tree.map((f) => `${f.label}:${f.count}`)));

  /* ── THE BAN — *"Never show athletes a mixed internal list containing options
   * like 'Breathing reset'."*
   *
   * ⚠ **WHY THIS IS A PINNED LIST AND NOT SET ALGEBRA.** The first cut asserted
   * that the shown labels and the prompt's labels are DISJOINT, and it reddened
   * on `Carries` and `Midline` — two words the prompt and the athlete's menu
   * genuinely agree on. Disjointness bans the right answer whenever an internal
   * name happens to be plain English, and excusing those one at a time is a
   * whitelist rotting into a hiding place.
   *
   * These twelve are the labels MEASURED on the flat menu before this change,
   * with the one Sam quoted at the top. The CONTROL below is what stops the pin
   * going stale: every banned string must still be a label the vocabulary
   * really produces, so a rename reddens this cell instead of silently emptying
   * it. And the structural half is the type system — `SUBCATEGORY_FOR_POOL` is
   * a total `Record`, so a NEW pool cannot reach the athlete under its own
   * prompt label without somebody first choosing where it goes. */
  const MEASURED_INTERNAL_LABELS = [
    'Breathing reset', 'Tissue quality', 'Easy cardio (zone 1)', 'Hamstring (light)',
    'Groin / adductors', 'Lower prehab', 'Shoulder health', 'Upper push horizontal',
    'Upper push vertical', 'Upper pull horizontal', 'Upper pull vertical',
    'Lower plyometric', 'Accessories upper', 'Accessories lower', 'Arms \u2014 biceps',
  ];
  const promptLabels: string[] = (selectableVocabularyGroups() as { label: string }[])
    .map((group) => group.label);
  const stalePins = MEASURED_INTERNAL_LABELS.filter((label) => !promptLabels.includes(label));
  ok('CONTROL — every banned label is still one the vocabulary really produces',
    stalePins.length === 0, `renamed or gone, so the pin no longer bans anything: ${JSON.stringify(stalePins)}`);
  const shown = [
    ...tree.map((family) => family.label),
    ...tree.flatMap((family) => family.subcategories.map((sub) => sub.label)),
  ];
  const leaked = shown.filter((label) => MEASURED_INTERNAL_LABELS.includes(label));
  ok('NO internal vocabulary label is shown at level 1 or level 2',
    leaked.length === 0, JSON.stringify(leaked));
  ok('and \u201cBreathing reset\u201d specifically is not a button the athlete sees',
    !shown.includes('Breathing reset'), JSON.stringify(shown));
  /* THE OTHER HALF OF "mixed": the athlete's first screen is a choice between
   * three kinds of work, not a scroll through the vocabulary's filing. */
  ok('level 1 is 3 buttons, not the 23 the flat menu opened with',
    tree.length === 3 && promptLabels.length > 20,
    `families=${tree.length} prompt groups=${promptLabels.length}`);

  /* ⚠ **THE MENU HID NOTHING, AND THAT IS THE OTHER HALF.** A hierarchy that
   * quietly drops a pool would also pass every cell above. Every name the flat
   * menu could reach must still be reachable — through three taps instead of
   * two. Breathing reset's CONTENT is the named case. */
  const reachable = everyNameIn(fullKit);
  ok('the breathing work is still reachable — under Mobility / Warm-up',
    leafOf(fullKit, 'breathing').length > 0
      && tree.find((f) => f.id === 'mobility')!.subcategories.some((s) => s.id === 'breathing'),
    JSON.stringify(leafOf(fullKit, 'breathing').map((c) => c.name)));
  const everyLegalName = new Set<string>();
  for (const group of selectableVocabularyGroups() as { names: string[] }[]) {
    for (const name of group.names) {
      const { assessTapSwapCandidateSafety } = require('../utils/tapSwapHierarchy');
      if (quiet(() => assessTapSwapCandidateSafety(name, fullKit).safe)) everyLegalName.add(name);
    }
  }
  const dropped = [...everyLegalName].filter((name) => !reachable.has(name));
  ok('and NOTHING legal fell out of the vocabulary on the way into the hierarchy',
    dropped.length === 0, `${dropped.length} dropped: ${JSON.stringify(dropped.slice(0, 12))}`);

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
