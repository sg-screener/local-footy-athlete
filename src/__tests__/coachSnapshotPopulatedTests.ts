/**
 * POPULATED COACH SNAPSHOT — one earned five-week athlete life.
 *
 * No feedback, readiness answer, restriction or program is seeded. The athlete
 * enters through onboarding, records sessions through the live outcome writer,
 * crosses the real block rollover and checks in through the accepted-state
 * transaction. The assertion then calls the exact pure derivation used by the
 * mounted Coach hook.
 *
 * Run: npm run test:coach-snapshot
 */

// Headless bootstrap must precede every app import. The journey clock refuses
// outside development, and a refused clock would make the five-week walk false.
(global as unknown as { __DEV__: boolean }).__DEV__ = true;
const localStorageData = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => localStorageData.get(key) ?? null,
    setItem: (key: string, value: string) => { localStorageData.set(key, value); },
    removeItem: (key: string) => { localStorageData.delete(key); },
    clear: () => { localStorageData.clear(); },
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — the populated Coach proof is local');
};
process.env.TZ = 'Australia/Melbourne';

import type { OnboardingData } from '../types/domain';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import {
  coldStartThroughOnboarding,
  followTheWeek,
  leaveExerciseOut,
  quiet,
  recordDay,
  reportFatigue,
  resolvedDays,
  rolloverIfDue,
  setJourneyClock,
  type DayIntent,
} from './support/athleteJourney';
import { addDaysISO } from '../utils/programBlockState';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { useAthletePreferencesStore } from '../store/athletePreferencesStore';
import { useCoachPreferencesStore } from '../store/coachPreferencesStore';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { buildProgramTabProjectedWeek } from '../utils/visibleProgramReadModel';
import { project } from '../rules/projectVisibleWeek';
import { selectActiveCoachNotes } from '../utils/activeCoachNotes';
import {
  deriveCoachSnapshot,
  type CoachSnapshot,
  type CoachSnapshotRecordedSession,
} from '../rules/liveAthleteSnapshot';
import { coachLoadMarkerFraction } from '../rules/snapshotDashboardCopy';

armTotalsOrRed();

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) {
    pass += 1;
    console.log(`  PASS ${name}`);
  } else {
    fail += 1;
    failures.push(name);
    console.error(`  FAIL ${name}${detail === undefined ? '' : `\n      ${JSON.stringify(detail)}`}`);
  }
}

const INSTALL_DAY = '2026-07-13';

function athlete(): OnboardingData {
  return {
    firstName: 'Jordan',
    ageRange: '22-26',
    position: 'inside_mid',
    heightCm: 182,
    weightKg: 84,
    motivation: 'Dominate your level',
    gender: 'male',
    seasonPhase: 'Off-season',
    trainingDaysPerWeek: 3,
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    teamTrainingDuration: '90 minutes',
    teamTrainingIntensity: 'Hard',
    usualGameDay: undefined,
    gameDay: undefined,
    trainingLocation: 'Commercial gym',
    equipment: [
      'barbell', 'dumbbells', 'squat_rack', 'pullup_bar', 'cable_machine',
      'hamstring_curl', 'knee_extension', 'bands',
    ],
    equipmentAnswer: {
      tags: {
        barbell: 'have', dumbbells: 'have', cables: 'have', machine: 'have',
        bands: 'have', bench: 'have', pullup_bar: 'have', kettlebell: 'have',
        foam_roller: 'have', plyo_box: 'have',
      },
      modalities: {
        bike_erg: 'have', air_bike: 'have', row: 'have', ski: 'have',
        treadmill: 'have',
      },
      answeredOn: INSTALL_DAY,
    },
    injuries: [],
    goals: ['Get stronger'],
    experienceLevel: '5+ years',
    squatStrength: '1.5x bodyweight',
    benchStrength: '1.25x bodyweight',
    conditioningLevel: 'Good',
    sprintExposure: '2+ times per week',
    recentTrainingLoad: 'Pretty consistent',
    twoKmTimeTrial: { seconds: 420, recordedOn: INSTALL_DAY, source: 'onboarding' },
  } as unknown as OnboardingData;
}

const DID_THE_WORK: DayIntent = {
  record: true,
  completion: 'full',
  feeling: 'good',
  soreness: 'mild',
  difficulty: 6,
  logWeights: true,
  conditioningRpe: 6,
};

function liveSnapshot(
  asOfDateISO: string,
  recordedSessions: Readonly<Record<string, CoachSnapshotRecordedSession>> =
    useProgramStore.getState().sessionFeedback,
): CoachSnapshot {
  const weekStart = (() => {
    const parsed = new Date(`${asOfDateISO}T12:00:00.000Z`);
    return addDaysISO(asOfDateISO, -((parsed.getUTCDay() + 6) % 7));
  })();
  const state = buildScheduleStateImperative();
  const weekDays = quiet(() => buildProgramTabProjectedWeek({
    mondayISO: weekStart,
    todayISO: asOfDateISO,
    state,
    overrideContexts: useProgramStore.getState().overrideContexts ?? {},
  }));
  const visibleWeek = quiet(() => project({
    week: weekDays as never,
    weekStart,
    program: useProgramStore.getState().currentProgram as never,
  }));
  const modifiers = selectActiveCoachNotes({
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    dismissedCoachNoteIds: useCoachUpdatesStore.getState().dismissedCoachNoteIds,
    athletePrefs: useAthletePreferencesStore.getState().prefs,
    modalityPreferences: useCoachPreferencesStore.getState().modalityPreferences,
    onboardingData: useProfileStore.getState().onboardingData,
    readinessSignalsByDate: useReadinessStore.getState().signalsByDate,
    visibleWeekDays: weekDays,
  });
  const profile = useProfileStore.getState().onboardingData;
  return deriveCoachSnapshot({
    asOfDateISO,
    weekDays,
    visibleWeek,
    activeModifiers: modifiers,
    recordedSessions,
    readinessSignal: useReadinessStore.getState().signalsByDate[asOfDateISO] ?? null,
    experienceLevel: profile?.experienceLevel,
    conditioningLevel: profile?.conditioningLevel,
  });
}

async function main(): Promise<void> {
  console.log('\n[POPULATED] FIVE WEEKS ARE EARNED THROUGH REAL ATHLETE ACTIONS');
  const install = await coldStartThroughOnboarding({
    profile: athlete(),
    installDayISO: INSTALL_DAY,
  });
  ok('fresh onboarding installs the first real block',
    install.onboardingRefusal === null && install.program.microcycles.length > 0,
    install.onboardingRefusal);

  const currentWeekStart = addDaysISO(install.blockOneStart, 28);
  const currentSunday = addDaysISO(currentWeekStart, 6);
  let recorded = 0;
  let rolloverCount = 0;
  for (let dateISO = install.blockOneStart; dateISO <= currentSunday;
    dateISO = addDaysISO(dateISO, 1)) {
    setJourneyClock(dateISO);
    const rollover = rolloverIfDue(dateISO);
    if (rollover.fired) rolloverCount += 1;
    if (rollover.refusal) {
      throw new Error(`rollover refused on ${dateISO}: ${rollover.refusal}`);
    }
    followTheWeek(dateISO);
    const result = await recordDay(dateISO, DID_THE_WORK);
    if (result.result === 'recorded') recorded += 1;
    if (result.result === 'refused' || result.result === 'threw') {
      throw new Error(`session outcome ${result.result} on ${dateISO}: ${result.detail}`);
    }
  }

  ok('the walk crosses the real block boundary once', rolloverCount === 1, rolloverCount);
  ok('the depth-35 walk records at least 15 real session decisions', recorded >= 15, recorded);
  ok('the accumulated state spans five distinct calendar weeks',
    new Set(Object.keys(useProgramStore.getState().sessionFeedback)
      .map((date) => {
        const parsed = new Date(`${date}T12:00:00.000Z`);
        return addDaysISO(date, -((parsed.getUTCDay() + 6) % 7));
      })).size === 5);

  const excludedExercise = resolvedDays(currentWeekStart)
    .flatMap((day) => day.rows)
    .find((row) => row.name)?.name;
  if (!excludedExercise) throw new Error('current week exposes no exercise to exclude');
  const exclusion = leaveExerciseOut({
    exercise: excludedExercise,
    scope: 'this_block',
    decidedOnISO: currentSunday,
    reason: 'athlete preference',
  });
  ok('the real exclusion door accepts a durable restriction',
    exclusion.ok && exclusion.exclusion !== null,
    exclusion);

  const beforeCheckIn = liveSnapshot(currentSunday);
  ok('earned history produces a signed load ratio and movable marker',
    beforeCheckIn.load.headline !== null
      && beforeCheckIn.load.sweetSpotBand !== null
      && coachLoadMarkerFraction(
        beforeCheckIn.load.headline.ratio,
        beforeCheckIn.load.sweetSpotBand,
      ) > 0
      && coachLoadMarkerFraction(
        beforeCheckIn.load.headline.ratio,
        beforeCheckIn.load.sweetSpotBand,
      ) < 1,
    beforeCheckIn.load);
  const withoutFirstWeek = Object.fromEntries(
    Object.entries(useProgramStore.getState().sessionFeedback)
      .filter(([date]) => date >= addDaysISO(install.blockOneStart, 7)),
  );
  ok('liveness: removing one earned history week kills the four-week ratio',
    liveSnapshot(currentSunday, withoutFirstWeek).load.headline === null);
  ok('current-week actions populate Consistency',
    beforeCheckIn.thisWeek.work.completedFull >= 3,
    beforeCheckIn.thisWeek.work);
  ok('logged real lifts populate Progress against last week',
    beforeCheckIn.progress.length > 0
      && beforeCheckIn.progress.some((lift) => lift.lastWeek !== null),
    beforeCheckIn.progress);
  ok('the initial live picture honestly has no current-day check-in',
    beforeCheckIn.readiness.state === 'not_recorded');
  ok('the durable exclusion populates the active restriction tile',
    beforeCheckIn.restrictions.length > 0,
    beforeCheckIn.restrictions.map((note) => note.title));

  // This is the same program-control door reached by Sunday's status check-in.
  // Nothing is reopened or reset; the store changes beneath the live picture.
  const fatigueDoor = await reportFatigue({
    dateISO: currentSunday,
    weekStartISO: currentWeekStart,
    level: 'cooked',
  });
  ok('the real cooked-status door accepts the live fact', fatigueDoor.ok, fatigueDoor.message);
  const afterCheckIn = liveSnapshot(currentSunday);
  ok('the next live derivation sees the check-in without reopening Coach',
    afterCheckIn.readiness.state !== 'not_recorded'
      && afterCheckIn.readiness.signal?.date === currentSunday);
  ok('the active restriction remains in the same live picture',
    afterCheckIn.restrictions.length > 0,
    {
      notes: afterCheckIn.restrictions.map((note) => note.title),
      activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
      readiness: useReadinessStore.getState().signalsByDate[currentSunday],
    });
  ok('the Snapshot itself was not stored as a stale copy',
    beforeCheckIn !== afterCheckIn
      && beforeCheckIn.readiness.state === 'not_recorded'
      && afterCheckIn.load.headline !== null);

  console.log(`\nPopulated Coach Snapshot totals: ${pass} passed, ${fail} failed`);
  totalsPrinted(fail);
  console.log('  NOT COVERED: this proves production derivation after a depth-35 calendar-day walk. It does not tap the feedback/check-in pixels, mount React Native, or replace simulator and physical-phone acceptance.');
  if (failures.length > 0) console.log(`Failures:\n  - ${failures.join('\n  - ')}`);
}

main().catch((error) => {
  console.error(error);
  totalsPrinted(1);
  process.exitCode = 1;
});
