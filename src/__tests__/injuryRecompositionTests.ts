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




interface InjuryWorld {
  label: string;
  area: string;
  severity: number;
}

const WORLDS: InjuryWorld[] = [
  { label: 'knee, moderate', area: 'knee', severity: 6 },
  { label: 'hamstring, training paused', area: 'hamstring', severity: 8 },
  { label: 'shoulder, slight', area: 'shoulder', severity: 4 },
];

async function main(): Promise<void> {
  const { executeProgramControlActionDurably } = require('../utils/programControlActions');
  const { resolveTapSwapEnvironment } = require('../utils/tapSwapHierarchy');
  const { buildGuidedInjuryConstraint } = require('../utils/guidedInjuryControl');
  const { unsafeRowsForInjury, planInjuryRecomposition } =
    require('../utils/injurySessionRecomposition');

  for (const world of WORLDS) {
    console.log(`\n[${world.label}]`);
    install();
    setJourneyClock(TARGET);
    const before = rowsOn(TARGET);
    const constraint = buildGuidedInjuryConstraint({
      region: 'lower_body', area: world.area, severity: world.severity,
      severityBand: 'caution', adjustmentLevel: 'reduce_load',
      triggers: ['during'], seriousSymptoms: false,
    } as never, { todayISO: TARGET }) as
      { bucket?: string; severity: number; adjustmentLevel?: string };

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

  install();
  setJourneyClock(TARGET);
  const workout = (() => {
    const week = quiet(() => resolveWeekWithConditioning(
      mondayFor(TARGET), buildScheduleStateImperative()));
    return (week.find((d) => d.date === TARGET) as { workout?: Workout }).workout!;
  })();
  const kneeEnv = quiet(() => resolveTapSwapEnvironment({
    date: TARGET, profile: useProfileStore.getState().onboardingData,
    activeConstraints: [], readinessSignal: null,
    primaryInjury: { bucket: 'knee', severity: 6 },
  }));
  const plan = planInjuryRecomposition({
    workout, environment: kneeEnv, primaryInjury: { bucket: 'knee', severity: 6 },
  }) as {
    unsafeRows: string[];
    substitutions: { from: string; to: { name: string; hierarchyTier: string; kind: string } }[];
    omissions: string[]; untouched: string[];
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
  ok('every unsafe row is either substituted or omitted — none is silently kept',
    plan.unsafeRows.every((name) =>
      plan.substitutions.some((s) => s.from === name) || plan.omissions.includes(name)),
    JSON.stringify(plan));
  /* ⚠ **THE REST CELL ABOVE WAS GREEN AND EMPTY AND A MUTATION SAID SO.**
   * Letting a rest fallback count as a substitution left all 30 cells green: in
   * a knee world the ladder returns named exercises before it ever reaches
   * rest, so there was no rest choice to mis-count. A rest fallback is only
   * ever offered in a MEDICAL-STOP world, so the refusal is asked THERE. */
  const pausedEnv = quiet(() => resolveTapSwapEnvironment({
    date: TARGET, profile: useProfileStore.getState().onboardingData,
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
  let pausedPlan: { substitutions: { to: { kind: string } }[]; omissions: string[]; unsafeRows: string[] };
  try {
    pausedPlan = planInjuryRecomposition({
      workout, environment: pausedEnv,
      primaryInjury: { bucket: 'hamstring', severity: 8, seriousSymptoms: true },
    }) as typeof pausedPlan;
  } catch (error) {
    ok('planning a medical-stop world does not throw', false, (error as Error).message);
    pausedPlan = { substitutions: [{ to: { kind: 'threw' } }], omissions: [], unsafeRows: ['threw'] };
  }
  ok('CONTROL — and the paused world has unsafe rows to answer for',
    pausedPlan.unsafeRows.length > 0, JSON.stringify(pausedPlan.unsafeRows));
  ok('in a medical-stop world NOTHING is substituted — every unsafe row is an omission',
    pausedPlan.substitutions.length === 0
      && pausedPlan.omissions.length === pausedPlan.unsafeRows.length,
    JSON.stringify(pausedPlan));

  ok('and no replacement duplicates something the session is already keeping',
    plan.substitutions.every((s) =>
      !plan.untouched.some((name) => name.toLowerCase() === s.to.name.toLowerCase())),
    JSON.stringify(plan.substitutions.map((s) => s.to.name)));

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
