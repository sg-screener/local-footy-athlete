/**
 * ── THE SEED A GLASS PASS NEEDS FOR THE INJURY FALLBACK ────────────────────
 *
 * This unit was built and measured entirely headless — another lane owns the
 * simulator today — so the device check is OWED, and this script is what makes
 * it cheap to pay rather than re-derive.
 *
 * It drives the REAL athlete through the REAL injury door, deterministically,
 * and prints the exact state a device pass should find: which day, the rows
 * before, the rows after with their loads, and the sentence the athlete is
 * shown. Nothing here is hand-authored — every line is read back out of the
 * app after the door has run, so the expectations cannot drift from the code
 * the way a written-down list would.
 *
 * Run: `npm run seed:injury-fallback`
 */
(global as unknown as { __DEV__: boolean }).__DEV__ = true;
const localStorageData = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (k: string) => localStorageData.get(k) ?? null,
    setItem: (k: string, v: string) => { localStorageData.set(k, v); },
    removeItem: (k: string) => { localStorageData.delete(k); },
    clear: () => { localStorageData.clear(); },
  },
};
(global as unknown as { fetch: () => never }).fetch = () => { throw new Error('NETWORK DISABLED'); };
process.env.TZ = 'Australia/Melbourne';

/* eslint-disable import/first */
import type { OnboardingData, TrainingProgram, Workout } from '../src/types/domain';
import { addDaysISO } from '../src/utils/programBlockState';
import { useProgramStore } from '../src/store/programStore';
import { useProfileStore } from '../src/store/profileStore';
import { useCalendarStore } from '../src/store/calendarStore';
import { generateProgramLocally } from '../src/services/api/generateProgram';
import { commitRebuiltProgram } from '../src/utils/weekRebuild';
import { resolveWeekWithConditioning } from '../src/utils/sessionResolver';
import { buildScheduleStateImperative } from '../src/utils/coachWeekDiff';
import { resetStoresToFreshInstall } from '../src/__tests__/support/freshInstallStores';
import { quiet, quietAsync, relaunchApp, setJourneyClock, weekdayName } from '../src/__tests__/support/athleteJourney';

const INSTALL_DAY = '2026-07-13';
const TARGET = '2026-07-22';

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
  localStorageData.clear();
  resetStoresToFreshInstall('removal-transaction:install');
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
    reason: 'removal-transaction:generate',
  }));
  useProgramStore.setState({ currentMicrocycle: settled } as never);
  return weekStart;
}


function rowsOf(dateISO: string, weekStartISO: string): string[] {
  const week = quiet(() => resolveWeekWithConditioning(weekStartISO, buildScheduleStateImperative()));
  const day = week.find((d) => d.date === dateISO);
  const w = (day as { workout?: Workout } | undefined)?.workout;
  return (w?.exercises ?? []).map((r) => {
    const n = (r as { exercise?: { name?: string } }).exercise?.name ?? (r as { name?: string }).name;
    const kg = (r as { prescribedWeightKg?: number }).prescribedWeightKg;
    return `${n}@${kg ?? '-'}`;
  });
}
function workoutOn(dateISO: string, weekStartISO: string): Workout | null {
  const week = quiet(() => resolveWeekWithConditioning(weekStartISO, buildScheduleStateImperative()));
  const day = week.find((d) => d.date === dateISO);
  return ((day as { workout?: Workout } | undefined)?.workout) ?? null;
}





/**
 * ⚠ **THE BANDS AND THE PLANES ARE BOTH COVERED ON PURPOSE.**
 *
 * `hamstring 4` is the case the whole unit turns on: `RDLs` is rated
 * `hamstring: 'avoid'` so it must be swapped even in Sam's mild band, while
 * `Leg Press` and `Bulgarian Split Squats` are `caution` and must be **kept**
 * — *"Swap obvious aggravators. Keep safe work in."* On `main` that world
 * replaced the whole lower day with a bench press and a bike.
 *
 * `shoulder 6` is the only case that reaches the four UPPER planes, because the
 * generated week puts them on their own day. Without it, `horizontal_push`,
 * `vertical_push`, `horizontal_pull` and `vertical_pull` are never walked here.
 */

const SEEDS = [
  { label: 'hamstring, mild — the aggravator is swapped and safe work is KEPT',
    area: 'hamstring', region: 'lower_body', severity: 4 },
  { label: 'knee, limiting — risky work through the area is removed',
    area: 'knee', region: 'lower_body', severity: 6 },
  { label: 'hamstring, paused — affected training is paused, unaffected work stands in',
    area: 'hamstring', region: 'lower_body', severity: 8 },
  { label: 'shoulder, limiting — the four upper planes',
    area: 'shoulder', region: 'upper_body', severity: 6 },
] as const;

function trainingDays(weekStart: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < 14; i += 1) {
    const date = addDaysISO(weekStart, i);
    if (rowsOf(date, weekStart).length > 0) out.push(date);
  }
  return out;
}

async function main(): Promise<void> {
  const { executeProgramControlActionDurably } = require('../src/utils/programControlActions');
  const { buildGuidedInjuryConstraint } = require('../src/utils/guidedInjuryControl');
  const { resolveTapSwapEnvironment } = require('../src/utils/tapSwapHierarchy');
  const { unsafeRowsForInjury } = require('../src/utils/injurySessionRecomposition');

  console.log('══ INJURY FALLBACK — SEED FOR A LATER GLASS PASS ══');
  console.log('Athlete: off-season, 3 LFA days Mon/Wed/Fri, commercial gym, 5+ years.');
  console.log('Install day 2026-07-13. Every value below is READ BACK from the app.');

  for (const seed of SEEDS) {
    const weekStart = install();
    const bucket = seed.area === 'lower back' ? 'lowerBack' : seed.area;
    let target = '';
    let best = 0;
    for (const date of trainingDays(weekStart)) {
      setJourneyClock(date);
      const environment = quiet(() => resolveTapSwapEnvironment({
        date, profile: useProfileStore.getState().onboardingData,
        activeConstraints: [], readinessSignal: null,
        primaryInjury: { bucket, severity: seed.severity },
      }));
      const unsafe = quiet(() => unsafeRowsForInjury({
        workout: workoutOn(date, weekStart), environment,
      })) as string[];
      if (unsafe.length > best) { target = date; best = unsafe.length; }
    }
    if (!target) { console.log(`\n[${seed.label}] NO AFFECTED DAY IN THE GENERATED FORTNIGHT`); continue; }
    setJourneyClock(target);
    const before = rowsOf(target, weekStart);
    const constraint = buildGuidedInjuryConstraint({
      region: seed.region, area: seed.area, severity: seed.severity,
      severityBand: 'caution', adjustmentLevel: 'reduce_load',
      triggers: ['during'], seriousSymptoms: false,
    } as never, { todayISO: target });
    const result = await quietAsync(() => executeProgramControlActionDurably({
      type: 'set_injury_modifier',
      source: { screen: 'session_detail', surface: 'exercise_injury_flow', initiatedBy: 'tap' },
      scope: 'current_and_future',
      payload: { constraint },
      requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
    }, { todayISO: target })) as { ok: boolean; changedProgram: boolean; message?: string };
    const after = rowsOf(target, weekStart);

    console.log(`\n[${seed.label}]`);
    console.log(`  DECLARE   ${seed.area} ${seed.severity}/10 on ${target} (${weekdayName(target)})`);
    console.log(`  BEFORE    ${JSON.stringify(before)}`);
    console.log(`  AFTER     ${JSON.stringify(after)}`);
    console.log(`  SENTENCE  "${result.message ?? ''}"`);
    console.log(`  ON GLASS  open the session on ${target} and expect exactly the AFTER rows,`);
    console.log('            each at the load printed, and that sentence on the confirmation.');
    console.log('            Then close and reopen the app: the rows must not move again.');
  }
}

if (require.main === module) {
  main().catch((error) => { console.log(`SEED THREW ${(error as Error).message}`); process.exit(1); });
}
