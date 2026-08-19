/**
 * WILL THE ACCEPTANCE BOUNDARY LET AN ATHLETE'S REMOVAL STAND?
 *
 * Sam, 2026-08-19: *"Remove means simply remove ... Nothing replaces it. The
 * session may have fewer exercises and may lose that movement pattern ...
 * Validation must not quietly force-fill an athlete-authorised removal."*
 *
 * That is the only question that decides whether Remove is buildable as
 * specified, so it is asked before anything is built: take the REAL accepted
 * week, drop one row the way a removal would, and put it through the REAL
 * acceptance boundary. If the boundary refuses a week with a missing pattern,
 * the athlete's decision cannot survive a transaction and the design has to
 * change.
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
import { quiet, quietAsync, relaunchApp, setJourneyClock } from '../src/__tests__/support/athleteJourney';

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
 * WHAT DOES THE INJURY DOOR ACTUALLY DO TO THE ATHLETE'S SESSION?
 *
 * Sam, 2026-08-19: *"Delete the false-success path. Real safe recomposition
 * using the approved fallback ladder. Honest omission/refusal when nothing safe
 * exists. **Never say 'safely recomposed' unless visible content actually
 * changed appropriately.**"*
 *
 * So the only question worth asking first is the one the claim is about: after
 * the injury door reports success, IS THE VISIBLE SESSION DIFFERENT, and is
 * every remaining row safe for the injury the athlete just declared?
 */
/* eslint-disable @typescript-eslint/no-var-requires */
async function main(): Promise<void> {
  const weekStart = install();
  setJourneyClock(TARGET);
  const { executeProgramControlActionDurably } = require('../src/utils/programControlActions');
  const { resolveTapSwapEnvironment, assessTapSwapCandidateSafety } = require('../src/utils/tapSwapHierarchy');
  const { buildGuidedInjuryConstraint } = require('../src/utils/guidedInjuryControl');

  const before = rowsOf(TARGET, weekStart);
  console.log(`BEFORE ${TARGET}: ${JSON.stringify(before)}`);

  for (const [area, severity] of [['Knee', 6], ['Hamstring', 8], ['Shoulder', 4]] as const) {
    // Reinstall so each declaration starts from the same world.
    const ws = install();
    setJourneyClock(TARGET);
    const rowsBefore = rowsOf(TARGET, ws);
    let constraint: unknown;
    try {
      constraint = buildGuidedInjuryConstraint(
        {
          region: 'lower_body', area: area.toLowerCase(), severity,
          severityBand: 'caution', adjustmentLevel: 'reduce_load',
          triggers: ['during'], seriousSymptoms: false,
        } as never,
        { todayISO: TARGET },
      );
    } catch (e) {
      console.log(`\n  ${area}/${severity}: buildGuidedInjuryConstraint THREW ${(e as Error).message}`);
      continue;
    }
    const c = constraint as { bucket?: string; severity?: number; adjustmentLevel?: string };
    const result = await quietAsync(() => executeProgramControlActionDurably({
      type: 'set_injury_modifier',
      source: { screen: 'session_detail', surface: 'exercise_injury_flow', initiatedBy: 'tap' },
      scope: 'current_and_future',
      payload: { constraint },
      requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
    }, { todayISO: TARGET })) as { ok: boolean; changedProgram: boolean; message?: string };
    const rowsAfter = rowsOf(TARGET, ws);
    console.log(`\n  ${area}/${severity}  bucket=${c.bucket} level=${c.adjustmentLevel}`);
    console.log(`    door: ok=${result.ok} changedProgram=${result.changedProgram} "${result.message ?? ''}"`);
    console.log(`    rows before: ${JSON.stringify(rowsBefore)}`);
    console.log(`    rows after : ${JSON.stringify(rowsAfter)}`);
    console.log(`    VISIBLE CONTENT CHANGED: ${JSON.stringify(rowsBefore) !== JSON.stringify(rowsAfter)}`);
    // And is what remains actually safe for the injury just declared?
    const env = quiet(() => resolveTapSwapEnvironment({
      date: TARGET, profile: useProfileStore.getState().onboardingData,
      activeConstraints: [], readinessSignal: null,
      primaryInjury: c.bucket ? { bucket: c.bucket, severity: c.severity } : null,
    })) as never;
    const unsafe = rowsAfter
      .map((r) => r.split('@')[0]!)
      .filter((name) => !quiet(() => assessTapSwapCandidateSafety(name, env)).safe);
    console.log(`    rows STILL UNSAFE for this injury: ${JSON.stringify(unsafe)}`);
    const { getAthleteExclusions } = require('../src/store/athletePreferencesStore');
    console.log(`    exclusions stored: ${JSON.stringify(quiet(() => getAthleteExclusions()))}`);
    const { planInjuryRecomposition } = require('../src/utils/injurySessionRecomposition');
    const wk = workoutOn(TARGET, ws);
    console.log(`    plan now: ${JSON.stringify(quiet(() => planInjuryRecomposition({ workout: wk, environment: env, primaryInjury: c.bucket ? { bucket: c.bucket, severity: c.severity } : null })))}`);
  }
}
if (require.main === module) main().catch((e) => { console.log(`PROBE THREW ${(e as Error).message}`); process.exit(1); });
