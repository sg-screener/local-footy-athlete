/**
 * THE INJURY DOOR TELLS THE TRUTH ABOUT THE SESSION, OR IT DOES NOT CLAIM.
 *
 * Sam, 2026-08-19: *"Delete the false-success path. Real safe recomposition
 * using the approved fallback ladder. Honest omission/refusal when nothing safe
 * exists. **Never say 'safely recomposed' unless visible content actually
 * changed appropriately.**"*
 *
 * ## THE DEFECT THIS SUITE HOLDS SHUT, MEASURED BEFORE ANYTHING WAS BUILT
 *
 * ```
 * Knee/6   door: ok=true changedProgram=true
 *          "Injury restrictions are active and affected sessions were safely recomposed."
 *          VISIBLE CONTENT CHANGED: false
 *          rows STILL UNSAFE: ["RDLs","Bulgarian Split Squats"]
 * ```
 *
 * The old claim came from `visibleProgramChanged`, which is true about the
 * accepted-state TRANSACTION and says nothing about the athlete's rows. A
 * hamstring at severity 8 — training PAUSED — got the same sentence with both
 * unsafe lifts still on the day.
 *
 * ## THE INVARIANT EVERY CASE ENFORCES
 *
 * **The sentence and the rows must agree.** Three worlds are driven end to end
 * and each is checked both ways: what the door said, and what the session
 * actually is afterwards.
 *
 * ## WHAT THIS SUITE DOES NOT COVER
 *
 * The simulator.
 *
 * Run: npm run test:injury-recomposition
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = true;
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
armTotalsOrRed();
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
import { ARCHETYPES, athleteAnswers, YEAR_START } from './compilerYear/catalog';
import { deriveVisibleWeekLive } from '../utils/deriveVisibleWeek';
import { applyExerciseExclusionDecision, restoreExcludedExercise } from '../utils/exerciseExclusionOwner';
import { getAthleteExclusions } from '../store/athletePreferencesStore';
import { executeProgramControlAction } from '../utils/programControlActions';
import { snapshotSemanticWorkout } from '../utils/programSemanticSnapshot';
import { visibleInjuryPrescriptionChanged } from '../utils/injurySessionRecomposition';

const INSTALL_DAY = '2026-07-13';
/** A Wednesday inside the athlete's first block, three days after install. */
/**
 * ⚠ **THE TARGET DAY IS DERIVED PER WORLD, NOT NAMED.**
 *
 * This was `const TARGET = '2026-07-22'` — the generated week's UPPER day — and
 * every world below declares a LOWER-LIMB injury against it. So this suite's own
 * CONTROL cells (*"the session really does carry unsafe work"*) have been RED on
 * `main`, and every *"no unsafe rows left"* cell beneath them has been green over
 * a session the injury never touched. A bind can be green and empty.
 *
 * `targetDayFor` asks the real generated week which day this particular injury
 * has the most work to do on. A generation change can move the lower day; it
 * cannot make this suite silently stop testing.
 */
const FALLBACK_TARGET = '2026-07-22';
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
  // The clock is set by the CALLER once it has derived the day this world needs.
  setJourneyClock(FALLBACK_TARGET);
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

/** The day in the generated fortnight this injury actually affects most. */
function targetDayFor(weekStartISO: string, bucket: string, severity: number): string {
  const { resolveTapSwapEnvironment } = require('../utils/tapSwapHierarchy');
  const { unsafeRowsForInjury } = require('../utils/injurySessionRecomposition');
  let best = FALLBACK_TARGET;
  let bestCount = 0;
  for (let i = 0; i < 14; i += 1) {
    const date = addDaysISO(weekStartISO, i);
    const week = quiet(() => resolveWeekWithConditioning(
      mondayFor(date), buildScheduleStateImperative()));
    const workout = (week.find((day) => day.date === date) as { workout?: Workout } | undefined)
      ?.workout ?? null;
    if (!workout) continue;
    const environment = quiet(() => resolveTapSwapEnvironment({
      date, profile: useProfileStore.getState().onboardingData,
      activeConstraints: [], readinessSignal: null,
      primaryInjury: { bucket, severity },
    }));
    const unsafe = quiet(() => unsafeRowsForInjury({ workout, environment })) as string[];
    if (unsafe.length > bestCount) { best = date; bestCount = unsafe.length; }
  }
  return best;
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




interface InjuryWorld {
  label: string;
  area: string;
  region: string;
  severity: number;
}

const WORLDS: InjuryWorld[] = [
  { label: 'knee, moderate', area: 'knee', region: 'lower_body', severity: 6 },
  { label: 'hamstring, training paused', area: 'hamstring', region: 'lower_body', severity: 8 },
  /* ⚠ **SEVERITY 4 IS THE BAND SAM KEEPS SAFE WORK IN**, so a `caution`-only day
   * legitimately has nothing to do and the CONTROL below would be red for the
   * right reason. The world that exercises the mild band is one whose row is
   * `avoid`-rated: `RDLs` for a hamstring. */
  { label: 'hamstring, mild', area: 'hamstring', region: 'lower_body', severity: 4 },
  { label: 'shoulder, limiting', area: 'shoulder', region: 'upper_body', severity: 6 },
];

async function main(): Promise<void> {
  const { executeProgramControlActionDurably } = require('../utils/programControlActions') as typeof import('../utils/programControlActions');
  const { resolveTapSwapEnvironment } = require('../utils/tapSwapHierarchy');
  const { buildGuidedInjuryConstraint } = require('../utils/guidedInjuryControl');
  const { unsafeRowsForInjury, planInjuryRecomposition } =
    require('../utils/injurySessionRecomposition');

  for (const world of WORLDS) {
    console.log(`\n[${world.label}]`);
    const weekStart = install();
    const bucket = world.area === 'lower back' ? 'lowerBack' : world.area;
    const TARGET = targetDayFor(weekStart, bucket, world.severity);
    console.log(`    day: ${TARGET}`);
    setJourneyClock(TARGET);
    const before = rowsOn(TARGET);
    const constraint = buildGuidedInjuryConstraint({
      region: world.region, area: world.area, severity: world.severity,
      severityBand: 'caution', adjustmentLevel: 'reduce_load',
      triggers: ['during'], seriousSymptoms: false,
    } as never, { todayISO: TARGET }) as import('../store/coachUpdatesStore').ActiveInjuryConstraint;

    const environmentBefore = quiet(() => resolveTapSwapEnvironment({
      date: TARGET, profile: useProfileStore.getState().onboardingData,
      activeConstraints: [], readinessSignal: null,
      primaryInjury: { bucket: constraint.bucket, severity: constraint.severity },
    }));
    const workoutBefore = (() => {
      const week = quiet(() => resolveWeekWithConditioning(
        mondayFor(TARGET), buildScheduleStateImperative()));
      return (week.find((d) => d.date === TARGET) as { workout?: Workout }).workout!;
    })();
    const unsafeBefore = unsafeRowsForInjury({
      workout: workoutBefore, environment: environmentBefore,
    }) as string[];
    const instructionsBefore = snapshotSemanticWorkout(TARGET, workoutBefore);
    /* ⚠ THE CONTROL. A suite that declares an injury on a session the injury
     * does not touch proves nothing at all — every "no unsafe rows left" cell
     * would pass on a session that never had any. */
    ok(`${world.label} — CONTROL: the session really does carry unsafe work`,
      unsafeBefore.length > 0, JSON.stringify(unsafeBefore));

    const result = await quietAsync(() => executeProgramControlActionDurably({
      type: 'set_injury_modifier',
      source: { screen: 'session_detail', surface: 'exercise_injury_flow', initiatedBy: 'tap' },
      scope: 'current_and_future',
      payload: { constraint },
      requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
    }, { todayISO: TARGET })) as { ok: boolean; changedProgram: boolean; message?: string };

    const after = rowsOn(TARGET);
    const workoutAfter = (() => {
      const week = quiet(() => resolveWeekWithConditioning(
        mondayFor(TARGET), buildScheduleStateImperative()));
      return (week.find((d) => d.date === TARGET) as { workout?: Workout }).workout ?? null;
    })();
    const unsafeAfter = unsafeRowsForInjury({
      workout: workoutAfter, environment: environmentBefore,
    }) as string[];
    const visiblyChanged = JSON.stringify(before) !== JSON.stringify(after);
    const message = result.message ?? '';
    console.log(`    "${message}"`);
    console.log(`    ${JSON.stringify(before)}\n -> ${JSON.stringify(after)}`);

    /* ── SAM'S RULE, STATED AS AN ASSERTION ─────────────────────────────── */
    ok(`${world.label} — "recomposed"/"swapped" is claimed ONLY when the rows moved`,
      !/swapped|recomposed/i.test(message) || visiblyChanged,
      `message="${message}" visiblyChanged=${visiblyChanged}`);
    ok(`${world.label} — changedProgram matches what the athlete can see`,
      result.changedProgram === visiblyChanged,
      `changedProgram=${result.changedProgram} visiblyChanged=${visiblyChanged}`);
    const unchanged = snapshotSemanticWorkout(TARGET, workoutBefore);
    ok(`${world.label} — identical prescriptions never count as changed`,
      !visibleInjuryPrescriptionChanged(instructionsBefore, unchanged));
    for (const field of ['prescribedSets', 'prescribedWeightKg'] as const) {
      const changed = JSON.parse(JSON.stringify(workoutBefore)) as Workout;
      changed.exercises[0][field] = (changed.exercises[0][field] ?? 0) + 1;
      ok(`${world.label} — ${field}-only changes count without a renamed exercise`,
        visibleInjuryPrescriptionChanged(instructionsBefore, snapshotSemanticWorkout(TARGET, changed)));
    }
    const annotated = JSON.parse(JSON.stringify(workoutBefore)) as Workout;
    annotated.coachNotes = ['Injury restrictions are active.'];
    ok(`${world.label} — annotation-only changes cannot claim program changed`,
      !visibleInjuryPrescriptionChanged(instructionsBefore, snapshotSemanticWorkout(TARGET, annotated)));
    ok(`${world.label} — a session left with unsafe work is NOT called safe`,
      unsafeAfter.length === 0 || /could not be made safe/i.test(message),
      `unsafeAfter=${JSON.stringify(unsafeAfter)} message="${message}"`);
    ok(`${world.label} — and when it IS called safe, nothing unsafe is left`,
      !/swapped for a safe option/i.test(message) || unsafeAfter.length === 0,
      `unsafeAfter=${JSON.stringify(unsafeAfter)}`);
    ok(`${world.label} — an honest refusal NAMES the rows to skip`,
      !/could not be made safe/i.test(message)
        || unsafeAfter.every((name) => message.includes(name)),
      `unsafeAfter=${JSON.stringify(unsafeAfter)} message="${message}"`);
    ok(`${world.label} — nothing is duplicated onto the session`,
      new Set(after.map((r) => r.split('@')[0])).size === after.length,
      JSON.stringify(after));
    ok(`${world.label} — recomposition never GROWS the session`,
      after.length <= before.length, `${before.length} -> ${after.length}`);
  }

  /* ═══════════════════════════════════════════════════════════════════════ */
  console.log('\n[4] THE LADDER IS THE APPROVED ONE, AND REST IS NOT A REPLACEMENT');

  const ladderWeekStart = install();
  const LADDER_TARGET = targetDayFor(ladderWeekStart, 'knee', 6);
  console.log(`    day: ${LADDER_TARGET}`);
  setJourneyClock(LADDER_TARGET);
  const workout = (() => {
    const week = quiet(() => resolveWeekWithConditioning(
      mondayFor(LADDER_TARGET), buildScheduleStateImperative()));
    return (week.find((d) => d.date === LADDER_TARGET) as { workout?: Workout }).workout!;
  })();
  const kneeEnv = quiet(() => resolveTapSwapEnvironment({
    date: LADDER_TARGET, profile: useProfileStore.getState().onboardingData,
    activeConstraints: [], readinessSignal: null,
    primaryInjury: { bucket: 'knee', severity: 6 },
  }));
  const plan = planInjuryRecomposition({
    workout, environment: kneeEnv, primaryInjury: { bucket: 'knee', severity: 6 },
  }) as {
    unsafeRows: string[];
    substitutions: { from: string; to: { name: string; hierarchyTier: string; kind: string } }[];
    pausedRows: string[]; untouched: string[];
  };
  ok('CONTROL — the plan really has something to do', plan.unsafeRows.length > 0,
    JSON.stringify(plan.unsafeRows));
  ok('every substitution comes off the approved fallback ladder',
    plan.substitutions.every((s) => ['same_movement_pattern', 'similar_muscle_group',
      'unaffected_body_area', 'recovery_easy_conditioning'].includes(s.to.hierarchyTier)),
    JSON.stringify(plan.substitutions.map((s) => s.to.hierarchyTier)));
  /* A `rest` fallback is the ABSENCE of a replacement. Counting it as one is how
   * "recomposed" would come to mean "emptied". */
  ok('a rest fallback is never counted as a substitution',
    plan.substitutions.every((s) => s.to.kind !== 'rest'),
    JSON.stringify(plan.substitutions.map((s) => s.to.kind)));
  ok('nothing safe is touched',
    plan.untouched.every((name) => !plan.unsafeRows.includes(name)));
  /* R-124 renamed `omissions` to `pausedRows`, and the rename is the ruling:
   * the list no longer means "the whole ladder had nothing", it means "rungs 1-4
   * had nothing and the row is paused". The property this cell asserts —
   * every unsafe row is accounted for, none silently kept — is unchanged. */
  ok('every unsafe row is either substituted or paused — none is silently kept',
    plan.unsafeRows.every((name) =>
      plan.substitutions.some((s) => s.from === name) || plan.pausedRows.includes(name)),
    JSON.stringify(plan));
  /* ⚠ **THE REST CELL ABOVE WAS GREEN AND EMPTY AND A MUTATION SAID SO.**
   * Letting a rest fallback count as a substitution left all 30 cells green: in
   * a knee world the ladder returns named exercises before it ever reaches
   * rest, so there was no rest choice to mis-count. A rest fallback is only
   * ever offered in a MEDICAL-STOP world, so the refusal is asked THERE. */
  const pausedEnv = quiet(() => resolveTapSwapEnvironment({
    date: LADDER_TARGET, profile: useProfileStore.getState().onboardingData,
    activeConstraints: [], readinessSignal: null,
    primaryInjury: { bucket: 'hamstring', severity: 8, seriousSymptoms: true },
  }));
  const pausedLadder = quiet(() => require('../utils/tapSwapHierarchy').getTapSwapChoices({
    originalExercise: 'RDLs', reason: 'injury_or_pain', environment: pausedEnv,
    primaryInjury: { bucket: 'hamstring', severity: 8, seriousSymptoms: true },
  })) as { kind: string }[];
  ok('CONTROL — a medical-stop world really does offer a rest fallback',
    pausedLadder.some((c) => c.kind === 'rest'),
    JSON.stringify(pausedLadder.map((c) => c.kind)));
  /* CAUGHT, NOT LET FLY. The mutation that accepts a nameless choice makes the
   * planner dereference `null`, and a suite that dies reports zero cells rather
   * than the one that is wrong. A throw is a failure of THIS claim and says so. */
  let pausedPlan: { substitutions: { to: { kind: string } }[]; pausedRows: string[]; unsafeRows: string[] };
  try {
    pausedPlan = planInjuryRecomposition({
      workout, environment: pausedEnv,
      primaryInjury: { bucket: 'hamstring', severity: 8, seriousSymptoms: true },
    }) as typeof pausedPlan;
  } catch (error) {
    ok('planning a medical-stop world does not throw', false, (error as Error).message);
    pausedPlan = { substitutions: [{ to: { kind: 'threw' } }], pausedRows: [], unsafeRows: ['threw'] };
  }
  ok('CONTROL — and the paused world has unsafe rows to answer for',
    pausedPlan.unsafeRows.length > 0, JSON.stringify(pausedPlan.unsafeRows));
  ok('in a medical-stop world NOTHING is substituted — every unsafe row is an omission',
    pausedPlan.substitutions.length === 0
      && pausedPlan.pausedRows.length === pausedPlan.unsafeRows.length,
    JSON.stringify(pausedPlan));

  ok('and no replacement duplicates something the session is already keeping',
    plan.substitutions.every((s) =>
      !plan.untouched.some((name) => name.toLowerCase() === s.to.name.toLowerCase())),
    JSON.stringify(plan.substitutions.map((s) => s.to.name)));

  console.log('\n[5] REAL ONBOARDING → INJURY → REPEAT → RESTART');
  for (const coordinate of ['session_detail', 'my_status', 'changed_session'] as const) {
    const screen = coordinate === 'changed_session' ? 'session_detail' : coordinate;
    const installed = await quietAsync(() => coldStartThroughOnboarding({
      profile: athleteAnswers(ARCHETYPES.find(a => a.id === 'male-3-experienced-gym')!), installDayISO: YEAR_START,
    }));
    ok(`${screen} — actual onboarding accepted`, !installed.onboardingRefusal);
    const days = () => quiet(() => deriveVisibleWeekLive(YEAR_START, YEAR_START));
    const day = days().find(d => (coordinate === 'changed_session' ? d.date === YEAR_START : d.date > YEAR_START)
      && d.workout?.exercises.some(row => row.section18Evidence?.role === 'main_strength'));
    if (!day) throw new Error('Real injury reporting coordinate did not reach a later strength day');
    const date = day.date;
    setJourneyClock(date);
    const instructions = () => JSON.stringify(snapshotSemanticWorkout(date,
      days().find(d => d.date === date)?.workout ?? null), (key, value) =>
      ['presentation', 'unavailableForInjury', 'createdAt', 'updatedAt'].includes(key) ? undefined : value);
    const constraint = buildGuidedInjuryConstraint({ region: 'lower_body', area: 'knee', severity: 7,
      severityBand: 'moderate', adjustmentLevel: 'moderate', triggers: ['running'], seriousSymptoms: false },
      { todayISO: YEAR_START });
    const reportInjury = () => executeProgramControlActionDurably({ type: 'set_injury_modifier',
      source: { screen, surface: 'guided_injury_flow', initiatedBy: 'tap' }, scope: 'current_and_future',
      payload: { constraint }, requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false }, { todayISO: date });
    const baseline = instructions();
    const report = await quietAsync(reportInjury);
    const active = instructions();
    if (coordinate === 'changed_session') ok('actual changed prescription coordinate reached', baseline !== active && report.changedProgram);
    ok(`${screen} — reports the selected day, not the earlier onset day`, report.ok && report.changedProgram === (baseline !== active), JSON.stringify(report));
    const repeated = await quietAsync(reportInjury);
    ok(`${screen} — repeat with unchanged prescriptions cannot claim a change`, repeated.ok && !repeated.changedProgram && instructions() === active, JSON.stringify(repeated));
    const episode = report.createdModifierIds?.[0];
    const reboot = await quietAsync(() => relaunchApp({ storage: durable, todayISO: date }));
    ok(`${screen} — restriction and visible result survive reopening`, reboot.ok && instructions() === active &&
      !!episode && useProgramStore.getState().acceptedMaterialContext.injuryEpisodes.some(e => e.episodeId === episode));
  }

  report();
}

function report(): void {
  console.log(`\n${'─'.repeat(72)}`);
  totalsPrinted(failures.length);
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
