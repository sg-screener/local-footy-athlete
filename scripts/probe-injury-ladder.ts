/**
 * WHY IS THIS ROW BEING SKIPPED? — the ladder, rung by rung, candidate by
 * candidate, with every rejection named.
 *
 * Sam, 2026-08-20: *"For every row currently being skipped, print which
 * candidates each rung considered and why each candidate was rejected."*
 *
 * It drives the REAL doors on a REAL generated week and asks the REAL ladder
 * (`walkInjuryFallbackLadder`), which is the same traversal
 * `buildInjuryFallbackLadder` is a projection of — so nothing printed here can
 * be true of a different ladder than the one the athlete gets.
 *
 * Run: npm run probe:injury-ladder
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
import { useCoachUpdatesStore } from '../src/store/coachUpdatesStore';
import { useReadinessStore } from '../src/store/readinessStore';
import { generateProgramLocally } from '../src/services/api/generateProgram';
import { commitRebuiltProgram } from '../src/utils/weekRebuild';
import { resolveWeekWithConditioning } from '../src/utils/sessionResolver';
import { buildScheduleStateImperative } from '../src/utils/coachWeekDiff';
import { resetStoresToFreshInstall } from '../src/__tests__/support/freshInstallStores';
import { quiet, setJourneyClock } from '../src/__tests__/support/athleteJourney';
import { buildGuidedInjuryConstraint, type GuidedInjuryFlowResult } from '../src/utils/guidedInjuryControl';
import { resolveTapSwapEnvironment, assessTapSwapCandidateSafety } from '../src/utils/tapSwapHierarchy';
import { planInjuryRecomposition, sessionRowNames } from '../src/utils/injurySessionRecomposition';
import { walkInjuryFallbackLadder, INJURY_FALLBACK_RUNGS } from '../src/rules/injuryFallbackLadder';
import { exerciseSessionFamily } from '../src/rules/exerciseSessionFamily';

const INSTALL_DAY = '2026-07-13';
const AREA = process.env.PROBE_AREA ?? 'Knee';
const SEVERITY = Number(process.env.PROBE_SEVERITY ?? '7');
/** An injury applied FIRST, through the real door, so the probe can walk a
 *  session that has already been recomposed once — the stacked case. */
const PRIOR_AREA = process.env.PROBE_PRIOR_AREA ?? '';
const PRIOR_SEVERITY = Number(process.env.PROBE_PRIOR_SEVERITY ?? '7');

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
  resetStoresToFreshInstall('probe-injury-ladder');
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
    reason: 'probe-injury-ladder:generate',
  }));
  useProgramStore.setState({ currentMicrocycle: settled } as never);
  return weekStart;
}

function workoutOn(dateISO: string, weekStartISO: string): Workout | null {
  const week = quiet(() => resolveWeekWithConditioning(weekStartISO, buildScheduleStateImperative()));
  const day = week.find((d) => d.date === dateISO);
  return ((day as { workout?: Workout } | undefined)?.workout) ?? null;
}

function constraintFor(area: string, severity: number, todayISO: string) {
  const answer: GuidedInjuryFlowResult = {
    region: 'other', area, severity,
    severityBand: 'moderate', adjustmentLevel: 'moderate',
    triggers: [], seriousSymptoms: false,
  };
  return buildGuidedInjuryConstraint(answer, { todayISO });
}

async function main(): Promise<void> {
  const weekStart = install();
  let target = '';
  for (let i = 0; i < 14 && !target; i += 1) {
    const date = addDaysISO(weekStart, i);
    if ((sessionRowNames(workoutOn(date, weekStart)) ?? []).length >= 4) target = date;
  }
  setJourneyClock(target);

  if (PRIOR_AREA) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { executeProgramControlActionDurably } = require('../src/utils/programControlActions');
    await executeProgramControlActionDurably({
      type: 'set_injury_modifier',
      source: { screen: 'session_detail', surface: 'session_injury_review', initiatedBy: 'tap' },
      scope: 'current_and_future',
      payload: { constraint: constraintFor(PRIOR_AREA, PRIOR_SEVERITY, target) },
      requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
    }, { todayISO: target });
    console.log(`\n(prior injury applied: ${PRIOR_AREA} ${PRIOR_SEVERITY}/10)`);
  }

  const constraint = constraintFor(AREA, SEVERITY, target);
  const primaryInjury = constraint.bucket
    ? { bucket: constraint.bucket as never, severity: constraint.severity, seriousSymptoms: false }
    : null;
  const environment = resolveTapSwapEnvironment({
    date: target,
    profile: useProfileStore.getState().onboardingData,
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    readinessSignal: useReadinessStore.getState().signalsByDate[target],
    primaryInjury,
  });
  const workout = workoutOn(target, weekStart);
  const plan = planInjuryRecomposition({ workout, environment, primaryInjury });

  console.log(`\n══ ${target} · ${AREA} ${SEVERITY}/10 ═══════════════════════════════`);
  console.log(`rows            : ${JSON.stringify(sessionRowNames(workout))}`);
  console.log(`unsafe          : ${JSON.stringify(plan.unsafeRows)}`);
  console.log(`substituted     : ${JSON.stringify(plan.substitutions.map((s) => `${s.from} -> ${s.to.name}`))}`);
  console.log(`SKIPPED         : ${JSON.stringify(plan.omissions)}`);

  if (plan.omissions.length === 0) {
    console.log('\nNothing was skipped — every unsafe row found an answer in its own section.');
  }

  const taken = sessionRowNames(workout).filter((n) => !plan.unsafeRows.includes(n))
    .concat(plan.substitutions.map((s) => s.to.name!));

  for (const row of plan.omissions) {
    console.log(`\n──── SKIPPED: ${row}  (section: ${exerciseSessionFamily(row) ?? 'unplaced'}) ────`);
    const { options, evaluations } = walkInjuryFallbackLadder({
      exercise: row,
      region: constraint.bucket as never,
      isLegal: (name) => assessTapSwapCandidateSafety(name, environment).safe,
      explainLegality: (name) => assessTapSwapCandidateSafety(name, environment).reason,
      avoidNames: taken,
    });
    console.log(`  ladder returned ${options.length} option(s)`);
    for (const rung of INJURY_FALLBACK_RUNGS) {
      const atRung = evaluations.filter((e) => e.rung === rung.id);
      const accepted = atRung.filter((e) => !e.rejection).map((e) => e.name);
      console.log(`  RUNG ${rung.rank} ${rung.id}: considered ${atRung.length}, accepted ${accepted.length}`);
      if (accepted.length) console.log(`      ACCEPTED: ${accepted.join(', ')}`);
      const byReason = new Map<string, string[]>();
      for (const e of atRung.filter((x) => x.rejection)) {
        const key = e.detail ? `${e.rejection} — ${e.detail}` : String(e.rejection);
        byReason.set(key, [...(byReason.get(key) ?? []), e.name]);
      }
      for (const [reason, names] of byReason) {
        console.log(`      rejected (${names.length}) ${reason}`);
        console.log(`         ${names.slice(0, 8).join(', ')}${names.length > 8 ? ` … +${names.length - 8}` : ''}`);
      }
    }
    const noRung = evaluations.filter((e) => e.rung === null);
    const grouped = new Map<string, number>();
    for (const e of noRung) grouped.set(String(e.rejection), (grouped.get(String(e.rejection)) ?? 0) + 1);
    console.log(`  never reached a rung: ${JSON.stringify(Object.fromEntries(grouped))}`);
    const wrongSection = noRung.filter((e) => e.rejection === 'different_session_section').map((e) => e.name);
    if (wrongSection.length) {
      console.log(`      of which WRONG SECTION (${wrongSection.length}): `
        + `${wrongSection.slice(0, 10).join(', ')}${wrongSection.length > 10 ? ' …' : ''}`);
    }
  }
}

main().catch((error) => { console.log('PROBE THREW', (error as Error).message); process.exit(1); });
