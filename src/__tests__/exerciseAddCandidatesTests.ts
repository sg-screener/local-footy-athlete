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
    legalAddCandidateGroups, ADD_CANDIDATES_PER_GROUP,
  } = require('../utils/addExerciseCandidates');
  const profile = useProfileStore.getState().onboardingData;
  const fullKit = quiet(() => resolveTapSwapEnvironment({
    date: TARGET, profile, activeConstraints: [], readinessSignal: null,
  }));
  const groups = legalAddCandidateGroups({ environment: fullKit, profile }) as
    { label: string; candidates: { name: string; sets: number; weightKg: number | null }[] }[];
  console.log(`    ${groups.length} groups: ${JSON.stringify(groups.map((g) => `${g.label}:${g.candidates.length}`))}`);
  ok('CONTROL — the vocabulary really produced groups', groups.length > 3,
    `${groups.length} groups`);
  const labels = groups.map((g) => g.label);
  ok('strength is offered', labels.some((l) => /Lower|Upper|Accessories/.test(l)),
    JSON.stringify(labels));
  ok('mobility is offered', labels.includes('Mobility'), JSON.stringify(labels));
  ok('conditioning is offered', labels.includes('Conditioning'), JSON.stringify(labels));
  ok('no group is ever empty', groups.every((g) => g.candidates.length > 0));
  ok('no group exceeds its cap',
    groups.every((g) => g.candidates.length <= ADD_CANDIDATES_PER_GROUP));
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

  const namesOf = (list: { label: string; candidates: { name: string }[] }[]) =>
    new Set(list.flatMap((g) => g.candidates.map((c) => c.name)));
  const fullNames = namesOf(groups);

  const bodyweightOnly = quiet(() => resolveTapSwapEnvironment({
    date: TARGET,
    profile: { ...profile, equipment: [], equipmentAnswer: { tags: {}, modalities: {}, answeredOn: INSTALL_DAY } } as never,
    activeConstraints: [], readinessSignal: null,
  }));
  const bodyweightNames = namesOf(legalAddCandidateGroups({
    environment: { ...bodyweightOnly, availableEquipment: [], availableEquipmentTags: [], hasEquipmentConstraint: true },
    profile,
  }));
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
  const injuredNames = namesOf(legalAddCandidateGroups({
    environment: { ...injured, activeInjuries: { ...injured.activeInjuries, knee: 'avoid' } },
    profile,
  }));
  ok('an athlete with a bad knee is offered FEWER things',
    injuredNames.size < fullNames.size, `full=${fullNames.size} injured=${injuredNames.size}`);

  /* ═══════════════════════════════════════════════════════════════════════ */
  console.log('\n[3] ADD REMOVES NOTHING, AND NEVER OFFERS WHAT IS ALREADY THERE');

  const weekStart = mondayFor(TARGET);
  const before = rowsOn(TARGET);
  const onTheDay = before.map((row) => row.split('@')[0]!);
  const withExisting = legalAddCandidateGroups({
    environment: fullKit, existingExerciseNames: onTheDay, profile,
  }) as { candidates: { name: string }[] }[];
  ok('CONTROL — the session really has rows to collide with', onTheDay.length > 0,
    JSON.stringify(onTheDay));
  ok('nothing already on the day is offered',
    withExisting.every((g) => g.candidates.every((c) => !onTheDay.includes(c.name))),
    JSON.stringify(withExisting.flatMap((g) => g.candidates.map((c) => c.name))
      .filter((n) => onTheDay.includes(n))));

  const chosen = withExisting[0]!.candidates[0]!;
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
  for (const group of legalAddCandidateGroups({
    environment: fullKit, existingExerciseNames: rowsOn(TARGET).map((r) => r.split('@')[0]!), profile,
  }) as { candidates: { name: string }[] }[]) {
    for (const candidate of group.candidates) {
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
