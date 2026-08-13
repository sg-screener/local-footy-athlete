/**
 * THE SYNTHETIC ATHLETE — four weeks of real use, driven in seconds.
 *
 * SEAT_INBOX item 66. Sam: *"is there a way to simulate the 4 week change over
 * for the new program? there has to be a better way to test it without having to
 * just wait 4 weeks?"*
 *
 *   TZ=Australia/Melbourne npx sucrase-node scripts/simulate-changeover.ts
 *   TZ=Australia/Melbourne npx sucrase-node scripts/simulate-changeover.ts --profile misses_fridays
 *
 * WHAT THIS IS. A read-only driver. It installs a fresh athlete, answers
 * onboarding, generates a program, then walks the clock forward ONE DAY AT A
 * TIME for five weeks, completing that day's session through the app's REAL
 * completion path. At the end it prints week 1 and week 5 of the SAME athlete
 * side by side.
 *
 * WHAT IT IS NOT, AND THIS IS THE WHOLE POINT OF THE ORDER. It does not write
 * completed-session records into storage. Every completion goes through
 * `commitSessionOutcomeTransaction` — the app's ONE live session-outcome writer
 * (`store/sessionOutcomeTransaction.ts:196`), the same function
 * `useHomeScreen.ts:1370` and `SessionFeedbackPanel.tsx:308` call when the
 * athlete taps. A refusal from that door is reported as a refusal, never
 * papered over: a history the app would not have produced is worth nothing.
 *
 * THE CLOCK IS NOT MINE AND I DID NOT WRITE ONE. `DevE2EClock` already owns the
 * app's today (`setDevE2EClock` writes the receipt; `appDate.ts:54-77` reads it
 * before the wall clock). This script sets that receipt once per simulated day
 * and then ASSERTS `todayISOLocal()` agrees — so every door below reads its
 * clock from the app's own source of now, not from an argument this script
 * threads. That assertion is load-bearing: it is the difference between
 * simulating time and passing a date around.
 *
 * WHY NOT `athleteActionWalker`. It is the right engine for random deep walks
 * and it already rolls blocks over, but its host `perform` is SYNCHRONOUS and
 * the completion transaction is `async` — the walker's own file says so at
 * `athleteActionWalkerTests.ts:595` about the schedule doors ("They cannot be
 * the door because `perform` is synchronous and the executor is awaited"). Its
 * host is also an unexported module-scope const inside a 3,979-line suite. So
 * this driver reuses the walker's DOORS — the same generator, the same accept
 * boundary, the same rollover coordinator, the same awaited executor — and not
 * its engine. Nothing here is a second copy of a door.
 */

// ── Headless bootstrap. Must precede every app import. ────────────────────
//
// `__DEV__` IS TRUE HERE AND FALSE IN THE WALKER, DELIBERATELY. The walker
// threads its own `todayISO` and wants the wall clock inert; this script wants
// the app's clock to BE the simulated day, and `isDevE2EClockAvailable()`
// refuses outside dev (`DevE2EClock.ts:53-56`), so `setDevE2EClock` would
// silently return null and every door would read the real today.
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
  throw new Error('NETWORK DISABLED — the synthetic athlete trains entirely on-device');
};
process.env.TZ = process.env.TZ ?? 'Australia/Melbourne';

/* eslint-disable import/first */
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';

import type { OnboardingData, TrainingProgram, Workout } from '../src/types/domain';
import type { ResolvedDay } from '../src/utils/sessionResolver';

import {
  DEV_E2E_CAMPAIGN_TIME_ZONE,
  createDevE2EClockReceipt,
  devE2EAnchorInstantForDate,
  setDevE2EClock,
} from '../src/dev/e2e/DevE2EClock';
import { todayISOLocal } from '../src/utils/appDate';
import { generateProgramLocally } from '../src/services/api/generateProgram';
import { useProgramStore } from '../src/store/programStore';
import { useProfileStore } from '../src/store/profileStore';
import { useCalendarStore } from '../src/store/calendarStore';
import { commitRebuiltProgram } from '../src/utils/weekRebuild';
import { addDaysISO, getProgramBlockRolloverStatus } from '../src/utils/programBlockState';
import { rolloverProgramBlock } from '../src/utils/programBlockRollover';
import { buildRolloverAcknowledgment } from '../src/utils/readinessAcknowledgment';
import { resolveWeekWithConditioning } from '../src/utils/sessionResolver';
import { buildScheduleStateImperative } from '../src/utils/coachWeekDiff';
import { buildProgramTabProjectedWeek } from '../src/utils/visibleProgramReadModel';
import { resolveEquipmentAvailability } from '../src/utils/equipmentAvailability';
// ── ITEM 65'S PRINTER, JOINED RATHER THAN COPIED ─────────────────────────
//
// The order said reuse it and do not write a second one. `projectWithGapsMarked`
// is why that matters beyond tidiness: `project()` throws on the FIRST unsigned
// copy id, so a plain try/catch surfaces one gap and hides the rest. Seat
// `printer` owns the loop that registers each id and retries until it
// converges, so their [NO COPY] count and mine come out of the same code and
// are comparable. Two renderers would have produced two counts that disagree
// with no way to tell which was right.
//
// Importing this was unsafe until `d9c91fdb` — the file ended in a bare
// `main();`, so any import reran their six-week generation and rewrote
// `docs/printed-weeks/`. It is `require.main === module` guarded now.
import { projectWithGapsMarked, renderWeekAsPlainEnglish } from './print-week';
import { executeProgramControlActionDurably } from '../src/utils/programControlActions';
import {
  commitSessionOutcomeTransaction,
  createRecordSessionOutcomeIntentFromFeedback,
  resolveSessionOutcomeTarget,
} from '../src/store/sessionOutcomeTransaction';
import { flushPendingStorageWrites } from '../src/store/asyncStorageCompat';
import { buildStrengthPerformanceLogs, collectLoggedStrengthSets } from '../src/utils/strengthLogging';
import { useWorkoutLogStore } from '../src/store/workoutLogStore';
import { buildSessionFeedbackPayload } from '../src/utils/sessionFeedbackForm';
import { getSessionComponents } from '../src/utils/sessionComponents';
import { buildStrengthWorkoutHistoryFromFeedback } from '../src/utils/strengthProgressionIntegration';
import { resetStoresToFreshInstall } from '../src/__tests__/support/freshInstallStores';

// ── Quiet ─────────────────────────────────────────────────────────────────

function quiet<T>(body: () => T): T {
  const { warn, error, log, info, debug } = console;
  console.warn = () => undefined; console.error = () => undefined;
  console.log = () => undefined; console.info = () => undefined;
  console.debug = () => undefined;
  try { return body(); } finally {
    console.warn = warn; console.error = error;
    console.log = log; console.info = info; console.debug = debug;
  }
}

async function quietAsync<T>(body: () => Promise<T>): Promise<T> {
  const { warn, error, log, info, debug } = console;
  console.warn = () => undefined; console.error = () => undefined;
  console.log = () => undefined; console.info = () => undefined;
  console.debug = () => undefined;
  try { return await body(); } finally {
    console.warn = warn; console.error = error;
    console.log = log; console.info = info; console.debug = debug;
  }
}

// ── The athlete's onboarding answers ──────────────────────────────────────
//
// ONE ONBOARDING PROFILE, FOUR BEHAVIOURS. Sam's four profiles ("does
// everything", "misses Fridays", "away week 3", "sore week 2") differ in what
// the athlete DOES, not in who they are, so holding the answers fixed is what
// makes the four printouts comparable to each other. Modelled on the walker's
// own world-builder so this is a world the product would accept: In-season
// REQUIRES a game-day answer or `completeOnboarding` refuses.

const INSTALL_DAY = '2026-07-13';

function syntheticProfile(): OnboardingData {
  return {
    firstName: 'Sim',
    heightCm: 184,
    weightKg: 90,
    seasonPhase: 'In-season',
    position: 'inside_mid',
    motivation: 'Dominate your level',
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    teamTrainingDuration: '90 minutes',
    teamTrainingIntensity: 'Moderate',
    trainingLocation: 'Commercial gym',
    equipment: ['barbell', 'dumbbells', 'squat_rack', 'pullup_bar',
      'cable_machine', 'hamstring_curl', 'knee_extension', 'bands'],
    experienceLevel: '5+ years',
    squatStrength: '1.5x bodyweight',
    benchStrength: '1.5x bodyweight+',
    conditioningLevel: 'Good',
    sprintExposure: '2+ times per week',
    recentTrainingLoad: 'Very consistent',
    injuries: [],
    twoKmTimeTrial: { seconds: 420, recordedOn: INSTALL_DAY, source: 'onboarding' },
    equipmentAnswer: {
      tags: {
        barbell: 'have', dumbbells: 'have', cables: 'have', machine: 'have',
        bands: 'have', bench: 'have', pullup_bar: 'have', kettlebell: 'have',
        foam_roller: 'have', plyo_box: 'have',
      },
      modalities: {
        bike_erg: 'have', air_bike: 'have', row: 'have', ski: 'have', treadmill: 'have',
      },
      answeredOn: INSTALL_DAY,
    },
    usualGameDay: 'Saturday',
    gameDay: 'Saturday',
  } as unknown as OnboardingData;
}

// ── The four behaviour profiles ───────────────────────────────────────────

type ProfileId = 'does_everything' | 'logs_every_weight' | 'misses_fridays'
  | 'away_week_3' | 'sore_week_2';

interface DayIntent {
  /** Does the athlete open the app and record this session at all? */
  record: boolean;
  completion: 'full' | 'partial' | 'skipped';
  feeling: 'very_easy' | 'easy' | 'good' | 'hard' | 'very_hard';
  soreness: 'none' | 'mild' | 'moderate' | 'high';
  /**
   * SESSION EFFORT, 1-10 — NOT 1-5.
   *
   * Sam ruled one scale on 2026-08-12 and `isSessionEffortRating` enforces
   * 1..10. This script first used 3 and 4 meaning "middling" and "fairly hard"
   * on a 1-5 scale; on the real scale both land in `feedbackAdapter`'s `<= 5`
   * branch, which is the EASY arm and gives the athlete MORE volume. The
   * "declares sore" profile was therefore telling the app the sessions were
   * easy — see `docs/EFFORT_SCALE_INVERSION_2026-08-12.md` for the same
   * inversion when it was a live product defect.
   */
  difficulty: number;
  /** Why the day was not recorded — reported, never silently dropped. */
  absenceReason?: string;
  /**
   * DID THE ATHLETE ENTER WHAT THEY LIFTED?
   *
   * The difference between ticking a session complete and logging the sets, and
   * it is not cosmetic: `lastPerformedWeights` comes from the `weightOverrides`
   * store, which is written by `setWeightOverride` when the athlete types a
   * weight. An athlete who only ticks sessions gives progression a history with
   * no loads in it, so there is nothing for it to progress FROM. This flag is
   * what lets the report show both athletes side by side instead of assuming
   * which one Sam meant by "does everything".
   */
  logWeights?: boolean;
}

interface BehaviourProfile {
  id: ProfileId;
  title: string;
  /** What Sam asked for, in his words where he gave them. */
  description: string;
  /** Real doors to walk on a given day, before the day's session is recorded. */
  eventsForDay?: (context: { dateISO: string; weekIndex: number; weekStart: string }) =>
    readonly ScriptedEvent[];
  intentForDay: (context: {
    dateISO: string; weekIndex: number; weekday: string;
  }) => DayIntent;
}

type ScriptedEvent = { kind: 'away_this_week'; from: string; until: string };

const NORMAL_DAY: DayIntent = {
  record: true,
  completion: 'full',
  feeling: 'good',
  soreness: 'none',
  // Middle of the 1-10 scale: the session was what it said on the tin.
  difficulty: 6,
};

const PROFILES: readonly BehaviourProfile[] = [
  {
    id: 'does_everything',
    title: 'Does everything',
    description: 'Records every session the app puts in front of them, full completion, '
      + 'feeling good, no soreness. The control run: anything that changes between week 1 '
      + 'and week 5 here is the program progressing, not the athlete pushing it around.',
    intentForDay: () => NORMAL_DAY,
  },
  {
    id: 'logs_every_weight',
    title: 'Does everything AND writes down every weight',
    description: 'The same athlete as above, except they also type in what they lifted on '
      + 'every set. This profile exists because the two are NOT the same athlete to the app: '
      + 'progression reads loads out of what was logged, so ticking a session complete and '
      + 'logging it are different amounts of information. Comparing this week 5 against the '
      + 'one above is what shows how much the logging is worth.',
    intentForDay: () => ({ ...NORMAL_DAY, logWeights: true }),
  },
  {
    id: 'misses_fridays',
    title: 'Misses every Friday',
    description: 'Every Friday the athlete simply does not open the app. NOT a "skipped" '
      + 'record — a real miss leaves NO record, which is what makes it a miss rather than '
      + 'a reported skip. Recording a skip instead would be answering a question the app '
      + 'never put on the screen.',
    intentForDay: ({ weekday }) => (weekday === 'Friday'
      ? { ...NORMAL_DAY, record: false, absenceReason: 'profile: Friday is missed — no record' }
      : NORMAL_DAY),
  },
  {
    id: 'away_week_3',
    title: 'Away for week 3',
    description: 'On the Monday of week 3 the athlete taps "Away this week" through the real '
      + 'awaited executor, with the away span covering the whole week, and records nothing '
      + 'until the trip ends.',
    eventsForDay: ({ dateISO, weekIndex, weekStart }) => (
      weekIndex === 3 && dateISO === weekStart
        ? [{ kind: 'away_this_week', from: weekStart, until: addDaysISO(weekStart, 6) }]
        : []),
    intentForDay: ({ weekIndex }) => (weekIndex === 3
      ? { ...NORMAL_DAY, record: false, absenceReason: 'profile: away all week — no record' }
      : NORMAL_DAY),
  },
  {
    id: 'sore_week_2',
    title: 'Declares sore in week 2',
    description: 'Trains through week 2 but answers the feedback form honestly: high '
      + 'soreness, sessions felt hard. The soreness reaches the app the way an athlete\'s '
      + 'soreness actually reaches it — as an answer on a recorded session, not as a '
      + 'readiness record written behind the app\'s back.',
    intentForDay: ({ weekIndex }) => (weekIndex === 2
      ? { record: true, completion: 'full', feeling: 'very_hard', soreness: 'high', difficulty: 9 }
      : NORMAL_DAY),
  },
];

// ── The clock, and the assertion that it is really driving the app ────────

function setClockTo(dateISO: string): void {
  // ⚠ RE-ASSERTED HERE BECAUSE AN IMPORT TOOK IT AWAY. `scripts/print-week.ts`
  // sets `__DEV__ = false` at module scope (as the walker does, deliberately —
  // both want the wall clock inert), and that assignment wins over this file's
  // own `__DEV__ = true` at the top. The first run after joining item 65's
  // renderer failed on exactly the guard below, which is what the guard is for:
  // without it the clock would have silently stopped setting and all five
  // profiles would have walked the REAL today while reporting simulated dates.
  (global as unknown as { __DEV__: boolean }).__DEV__ = true;
  const applied = setDevE2EClock(createDevE2EClockReceipt({
    seedId: 'standard-in-season-week',
    anchorInstant: devE2EAnchorInstantForDate(dateISO, DEV_E2E_CAMPAIGN_TIME_ZONE),
    timezone: DEV_E2E_CAMPAIGN_TIME_ZONE,
    createdAt: '2026-08-13T00:00:00.000Z',
  }));
  if (!applied) {
    throw new Error('DevE2EClock REFUSED to set — __DEV__ is not true in this process, so '
      + 'every door below would read the wall clock and this run would be a lie.');
  }
  // THE LOAD-BEARING CHECK. If the app's own source of now disagrees with the
  // day we think we are simulating, nothing downstream means anything.
  const appToday = todayISOLocal();
  if (appToday !== dateISO) {
    throw new Error(`the app's clock says ${appToday} but the simulation is on ${dateISO} — `
      + 'DevE2EClock is not driving appDate, so this is not a simulation of time passing.');
  }
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function weekdayName(dateISO: string): string {
  return WEEKDAYS[new Date(`${dateISO}T12:00:00Z`).getUTCDay()];
}

function mondayFor(dateISO: string): string {
  const parsed = new Date(`${dateISO}T12:00:00Z`);
  return addDaysISO(dateISO, -((parsed.getUTCDay() + 6) % 7));
}

// ── The world, built by acting ────────────────────────────────────────────

interface RunLogEntry {
  dateISO: string;
  weekday: string;
  weekIndex: number;
  /** What the app had on that day, in its own vocabulary. */
  sessionName: string | null;
  /** What happened when we tried to record it. */
  result: 'recorded' | 'no_session' | 'not_recorded' | 'refused' | 'threw';
  detail: string | null;
}

interface WeekSnapshot {
  weekStart: string;
  weekIndex: number;
  /** Item 65's renderer output — the words the athlete would actually read. */
  plainEnglish: string;
  noCopyCount: number;
  printFindings: string[];
  days: {
    dateISO: string;
    weekday: string;
    sessionName: string | null;
    sessionType: string | null;
    intensity: string | null;
    exercises: {
      name: string; sets: number | null; reps: string | null; weightKg: number | null;
    }[];
  }[];
}

function visibleWeek(weekStart: string, todayISO: string): ResolvedDay[] {
  return quiet(() => resolveWeekWithConditioning(weekStart, buildScheduleStateImperative()))
    .filter((day) => day.date >= weekStart && day.date <= addDaysISO(weekStart, 6))
    .concat([])
    .sort((left, right) => left.date.localeCompare(right.date))
    // `todayISO` is not a filter — it is here to make the read explicit that a
    // week is read AS OF a day, which is how every surface in the app reads one.
    .map((day) => ({ ...day, asOf: todayISO } as ResolvedDay));
}

/**
 * THE ATHLETE'S OWN WORDS FOR THIS WEEK, through item 65's renderer.
 *
 * MUST BE CALLED WHILE THE STORE IS IN THIS WEEK'S STATE. Both the projection
 * and the equipment resolution read live store state, so rendering week 1 after
 * the walk has reached week 5 would print week 5 twice under two headings — a
 * side-by-side comparison that is secretly a comparison of one thing with
 * itself. That is why this is called from inside `snapshotWeek` rather than at
 * report time.
 */
function renderPlainEnglish(args: {
  weekStart: string; todayISO: string; heading: string; intro: string;
}): { markdown: string; noCopyCount: number; findings: readonly { message?: string }[] } {
  const resolved = quiet(() => buildProgramTabProjectedWeek({
    mondayISO: args.weekStart,
    todayISO: args.todayISO,
    state: buildScheduleStateImperative(),
    overrideContexts: useProgramStore.getState().overrideContexts ?? {},
  }));
  const { visibleWeek: projected, gapIds } = quiet(() => projectWithGapsMarked({
    week: resolved as never, weekStart: args.weekStart,
  }));
  const equipmentTags = quiet(() => resolveEquipmentAvailability(
    useProfileStore.getState().onboardingData,
    useProgramStore.getState().acceptedMaterialContext.activeConstraints as never,
    args.todayISO,
  ));
  return quiet(() => renderWeekAsPlainEnglish({
    projected,
    heading: args.heading,
    intro: args.intro,
    noCopyIds: gapIds,
    equipmentTags: equipmentTags as never,
  })) as never;
}

function snapshotWeek(weekStart: string, weekIndex: number, todayISO: string): WeekSnapshot {
  const week = visibleWeek(weekStart, todayISO);
  const printed = renderPlainEnglish({
    weekStart,
    todayISO,
    heading: `Week ${weekIndex} — starting ${weekStart}`,
    intro: weekIndex === 1
      ? 'This is the week the athlete STARTED on, before any training was recorded.'
      : 'This is the same athlete four weeks later, after everything below was '
        + 'recorded. Read it against week 1 and ask whether four weeks of work '
        + 'should have left it looking like this.',
  });
  return {
    weekStart,
    weekIndex,
    plainEnglish: printed.markdown,
    noCopyCount: printed.noCopyCount,
    printFindings: printed.findings.map((finding) => String(
      (finding as { message?: string }).message ?? JSON.stringify(finding))),
    days: week.map((day) => {
      const workout = day.workout as Workout | null | undefined;
      return {
        dateISO: day.date,
        weekday: weekdayName(day.date),
        sessionName: workout?.name ?? null,
        sessionType: (workout as { workoutType?: string } | null | undefined)?.workoutType ?? null,
        intensity: (workout as { intensity?: string } | null | undefined)?.intensity ?? null,
        // THE ROW'S OWN AUTHORED FIELDS, read the way the app reads them.
        // `row.exercise?.name ?? row.name` is `projectVisibleWeek.ts:396` and
        // `sessionComponents.ts:566` — the two owners of this read. Reading
        // `row.name` alone (the first version of this line) printed every row
        // as "(unnamed)", which would have been reported as an app defect.
        //
        // ⚠ THIS IS THE RAW AUTHORED NAME, NOT SIGNED COPY. The projection runs
        // the same value through `signedCopy(exerciseNameCopyId(...))` before an
        // athlete sees it. That is item 65's territory and this script must not
        // duplicate it, so what is printed here is deliberately the structural
        // fact and is labelled as such in the report header.
        exercises: (workout?.exercises ?? []).map((row) => {
          const nested = (row as { exercise?: { name?: string } }).exercise;
          const sets = (row as { prescribedSets?: number }).prescribedSets;
          const repsMin = (row as { prescribedRepsMin?: number }).prescribedRepsMin;
          const repsMax = (row as { prescribedRepsMax?: number }).prescribedRepsMax;
          const weight = (row as { prescribedWeightKg?: number }).prescribedWeightKg;
          return {
            name: String(nested?.name ?? (row as { name?: string }).name ?? '(NO NAME ON ROW)'),
            sets: Number.isFinite(sets) ? Number(sets) : null,
            reps: Number.isFinite(repsMin) && Number.isFinite(repsMax)
              ? (repsMin === repsMax ? String(repsMin) : `${repsMin}-${repsMax}`)
              : null,
            // WEIGHT IS WHERE PROGRESSION ACTUALLY LANDS, and printing sets and
            // reps alone made this report blind to it: `applyStrengthProgression`
            // moves `prescribedWeightKg` by a multiplier
            // (`strengthProgressionIntegration.ts:745-789`), so a week whose
            // loads all climbed read as "unchanged" here. Omitting it would have
            // reported a false "nothing moved" to Sam.
            weightKg: Number.isFinite(weight) ? Number(weight) : null,
          };
        }),
      };
    }),
  };
}

/** Fresh install → onboarding → generation, through the real doors. */
function installAndGenerate(): { weekStart: string } {
  localStorageData.clear();
  resetStoresToFreshInstall('simulate-changeover:fresh-install');

  const profile = syntheticProfile();
  useProfileStore.getState().updateOnboardingData(profile);
  const completion = useProfileStore.getState().completeOnboarding() as
    { ok?: boolean; missingAnswers?: unknown } | undefined;
  if (completion && typeof completion === 'object' && completion.ok === false) {
    throw new Error('onboarding completion REFUSED — the synthetic athlete is not a world '
      + `the product would accept: ${JSON.stringify(completion.missingAnswers ?? null)}`);
  }

  const program = quiet(() => generateProgramLocally(profile, {
    todayISO: INSTALL_DAY,
    previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1,
      selectedPhase: (profile as { seasonPhase?: string }).seasonPhase as never,
      phaseEntryWeekStartISO: mondayFor(INSTALL_DAY),
      originProvenance: 'explicit_user_phase_change',
      persistenceProvenance: 'preserved_persisted_state',
    },
  })) as TrainingProgram;

  // The settled week, exactly as the walker picks it: week one of a fresh
  // generation is a partial week and is not what a changeover is about.
  const settled = program.microcycles[1] ?? program.microcycles[0]!;
  const weekStart = settled.startDate.slice(0, 10);

  quiet(() => commitRebuiltProgram(
    program,
    { preserve: [], clear: [], conflictsRemoved: [] },
    {
      markedDays: useCalendarStore.getState().markedDays ?? {},
      selectedDate: weekStart,
      reason: 'simulate-changeover:generate',
    },
  ));
  useProgramStore.setState({ currentMicrocycle: settled } as never);
  return { weekStart };
}

/** The app's own answer to time passing: roll the block until today is inside it. */
function rollBlocksForward(todayISO: string): string | null {
  for (let pass = 0; pass < 6; pass += 1) {
    const store = useProgramStore.getState();
    const status = getProgramBlockRolloverStatus({
      program: store.currentProgram, dateISO: todayISO, blockState: store.blockState,
    });
    if (!status.needsRollover) return null;
    try {
      const rolled = quiet(() => rolloverProgramBlock({
        baseProfile: useProfileStore.getState().onboardingData,
        targetDateISO: todayISO,
      }));
      if (rolled.refusal) {
        const ack = buildRolloverAcknowledgment(rolled);
        return `rollover REFUSED on ${todayISO}: ${ack?.message ?? '(the ack owner said nothing)'}`;
      }
    } catch (error) {
      return `rollover THREW on ${todayISO}: ${
        error instanceof Error ? error.message : String(error)}`;
    }
  }
  return null;
}

/** Point the athlete at the week they are actually in, as Monday arriving does. */
function followTheWeek(todayISO: string): string {
  const monday = mondayFor(todayISO);
  const program = useProgramStore.getState().currentProgram;
  const next = program?.microcycles.find((m) => m.startDate.slice(0, 10) === monday);
  if (next) useProgramStore.setState({ currentMicrocycle: next } as never);
  return monday;
}

async function walkAwayDoor(event: ScriptedEvent, todayISO: string, weekStart: string):
Promise<string> {
  const week = visibleWeek(weekStart, todayISO);
  const result = await quietAsync(() => executeProgramControlActionDurably({
    type: 'set_schedule_modifier',
    source: { screen: 'program_tab', surface: 'away_this_week', initiatedBy: 'tap' },
    scope: 'current_week',
    // THE SHAPE `useHomeScreen` SENDS since Sam's 2026-08-13 ruling: a SPAN.
    // The retired `clear_days` shape took the whole day, gym session included.
    payload: { date: event.from, todayISO, awaySpan: { from: event.from, until: event.until } },
    requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
  } as never, { visibleWeek: week, todayISO }));
  return result?.ok === true
    ? `away door accepted ${event.from}..${event.until}`
    : `away door REFUSED: ${result?.message ?? '(no message)'}`;
}

/**
 * Record one day's session through the app's ONE live outcome writer.
 *
 * ⚠ THE STRENGTH LOG IS NOT OPTIONAL DECORATION, AND LEAVING IT OUT MADE THE
 * FIRST VERSION OF THIS SCRIPT LIE. `buildStrengthWorkoutHistoryFromFeedback`
 * (`strengthProgressionIntegration.ts:195`) keeps a recorded session only when
 * `feedback.strength` is non-empty OR the session was skipped:
 *
 *   .filter((fb) => (fb.strength?.length ?? 0) > 0 || strengthCompletion(fb) === 'skipped')
 *
 * So a `full` completion with no per-exercise log contributes NOTHING to
 * progression. The first run recorded 30 sessions that way and produced a week 5
 * byte-identical across all four profiles — which read exactly like "the app
 * ignores four weeks of training" and was in fact this script forgetting to log
 * what the athlete lifted.
 *
 * Both builders below are the SessionFeedbackPanel's own
 * (`SessionFeedbackPanel.tsx:880-886`), called in the same order with the same
 * arguments. No logged per-set detail is supplied, which is the honest
 * "tapped done without logging weights" case — `buildStrengthPerformanceLogs`
 * then falls back to the prescribed snapshot, exactly as it does for a real
 * athlete who does the same.
 */
async function recordDay(dateISO: string, intent: DayIntent): Promise<{
  result: RunLogEntry['result']; sessionName: string | null; detail: string | null;
}> {
  let target: { workout: Workout } | null = null;
  try {
    target = resolveSessionOutcomeTarget(dateISO) as unknown as { workout: Workout };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // `session_not_found` is not a defect — it is a rest day, and the app says so.
    return {
      result: 'no_session',
      sessionName: null,
      detail: /session_not_found|No visible session/.test(message) ? null : message,
    };
  }
  const sessionName = (target.workout as { name?: string }).name ?? null;
  if (!intent.record) {
    return { result: 'not_recorded', sessionName, detail: intent.absenceReason ?? null };
  }

  const components = getSessionComponents(target.workout as never);

  // ── THE ATHLETE TYPES IN WHAT THEY LIFTED, through the real doors ────────
  //
  // `logSet` is the workout logger's own action and `setWeightOverride` is the
  // one writer of `weightOverrides` (`programStore.ts:2227`), which is where
  // `lastPerformedWeights` comes from. Logging the PRESCRIBED load is the honest
  // "did exactly what it said on the card" case — not a performance claim this
  // script invents, but the athlete confirming the prescription.
  let loggedSets: Record<string, unknown[]> | undefined;
  if (intent.logWeights) {
    const logStore = useWorkoutLogStore.getState();
    const programStore = useProgramStore.getState() as unknown as {
      setWeightOverride: (date: string, exerciseId: string, weightKg: number) => void;
    };
    for (const row of (target.workout.exercises ?? []) as unknown as {
      id: string; exerciseId: string; prescribedSets?: number;
      prescribedRepsMax?: number; prescribedWeightKg?: number;
    }[]) {
      const weight = Number(row.prescribedWeightKg);
      if (!Number.isFinite(weight) || weight <= 0) continue;
      const sets = Math.max(1, Number(row.prescribedSets) || 1);
      for (let setNumber = 1; setNumber <= sets; setNumber += 1) {
        logStore.logSet(row.id, {
          id: `sim:${dateISO}:${row.id}:${setNumber}`,
          loggedWorkoutId: `sim:${dateISO}`,
          workoutExerciseId: row.id,
          setNumber,
          actualReps: Number(row.prescribedRepsMax) || undefined,
          actualWeightKg: weight,
          createdAt: `${dateISO}T12:00:00.000Z`,
          updatedAt: `${dateISO}T12:00:00.000Z`,
        } as never);
      }
      programStore.setWeightOverride(dateISO, row.exerciseId, weight);
    }
    loggedSets = quiet(() => collectLoggedStrengthSets(
      target!.workout, useWorkoutLogStore.getState().loggedSets as never, undefined,
    )) as Record<string, unknown[]> | undefined;
  }

  // `weightOverrides` is keyed BY DATE first, then by exercise
  // (`programStore.ts:1940`), and the panel reads `weightOverrides[date]`
  // (`SessionFeedbackPanel.tsx:474`). Handing the whole map to a function
  // expecting one day's slice silently resolves no override at all.
  const strength = quiet(() => buildStrengthPerformanceLogs(
    target!.workout,
    useProgramStore.getState().weightOverrides?.[dateISO] ?? {},
    intent.completion,
    loggedSets as never,
  ));
  // Every component answered explicitly: `canSaveFeedbackDraft` refuses a draft
  // holding a null component answer, and a half-answered form is not a thing an
  // athlete can submit either.
  const componentCompletions: Record<string, typeof intent.completion> = {};
  for (const component of components) componentCompletions[String(component.id)] = intent.completion;

  const feedback = quiet(() => buildSessionFeedbackPayload({
    dateStr: dateISO,
    completion: intent.completion,
    componentCompletions,
    components,
    feeling: intent.feeling,
    soreness: intent.soreness,
    difficulty: intent.difficulty,
    partialReason: null,
    skipReason: null,
    ...(strength.length > 0 ? { strength } : {}),
  } as never));
  if (!feedback) {
    // THE FORM ITSELF REFUSED. Reported, never worked around: a payload the app
    // would not build is a session an athlete could not have submitted.
    return {
      result: 'refused',
      sessionName,
      detail: 'buildSessionFeedbackPayload returned null — the app would not accept '
        + `this answer set (completion=${intent.completion}, feeling=${intent.feeling}, `
        + `soreness=${intent.soreness}, difficulty=${intent.difficulty})`,
    };
  }

  const recordIntent = createRecordSessionOutcomeIntentFromFeedback({
    date: dateISO,
    workout: target.workout,
    feedback,
    source: {
      entryPoint: 'tap',
      surface: 'simulate_changeover',
      interpretedIntent: 'record_session_outcome',
      traceId: `simulate-changeover:${dateISO}`,
    } as never,
  });
  try {
    const result = await quietAsync(() => commitSessionOutcomeTransaction(recordIntent));
    if (!result.ok) {
      return {
        result: 'refused',
        sessionName,
        detail: `${(result as { code?: string }).code ?? 'refused'}: ${
          (result as { message?: string }).message ?? '(no message)'}`,
      };
    }
    return { result: 'recorded', sessionName, detail: null };
  } catch (error) {
    return {
      result: 'threw',
      sessionName,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

interface RunResult {
  profile: BehaviourProfile;
  log: RunLogEntry[];
  week1: WeekSnapshot;
  week5: WeekSnapshot;
  rolloverProblems: string[];
  doorNotes: string[];
  census: HistoryCensus;
}

/**
 * WHAT THE HISTORY ACTUALLY BECAME — the anti-vacuity check, and the reason the
 * first version of this script was wrong for half an hour.
 *
 * "The transaction returned ok" is a claim about a call, not about a world. This
 * counts what is really in the store afterwards and, crucially, how much of it
 * SURVIVES the progression reader's own filter. `storedFeedbackDays` high with
 * `progressionHistoryEntries` at zero is the signature of a history the app
 * cannot see, and any conclusion drawn about week 5 in that state is worthless.
 */
interface HistoryCensus {
  storedFeedbackDays: number;
  feedbackWithStrengthLogs: number;
  progressionHistoryEntries: number;
  storedSorenessAnswers: number;
  /**
   * Days carrying at least one athlete-entered load, and how many loads in all.
   *
   * WITHOUT THIS THE `logs_every_weight` PROFILE COULD BE A SILENT NO-OP and the
   * comparison it exists to make would be a comparison of one athlete with
   * themselves. `weightOverrides` is what `lastPerformedWeights` reads, so these
   * two numbers are the difference between "logging changed nothing" and "no
   * logging happened".
   */
  weightOverrideDays: number;
  weightOverrideEntries: number;
}

function takeCensus(beforeDate: string): HistoryCensus {
  const feedbackMap = (useProgramStore.getState() as unknown as {
    sessionFeedback: Record<string, { strength?: unknown[]; soreness?: string | null }>;
  }).sessionFeedback ?? {};
  const entries = Object.values(feedbackMap);
  const overrides = (useProgramStore.getState() as unknown as {
    weightOverrides: Record<string, Record<string, number | null>>;
  }).weightOverrides ?? {};
  return {
    weightOverrideDays: Object.keys(overrides).length,
    weightOverrideEntries: Object.values(overrides)
      .reduce((total, day) => total + Object.keys(day ?? {}).length, 0),
    storedFeedbackDays: entries.length,
    feedbackWithStrengthLogs: entries.filter((entry) => (entry.strength?.length ?? 0) > 0).length,
    progressionHistoryEntries: quiet(() => buildStrengthWorkoutHistoryFromFeedback(
      feedbackMap as never, beforeDate,
    )).length,
    storedSorenessAnswers: entries.filter((entry) => entry.soreness != null
      && entry.soreness !== 'none').length,
  };
}

const WEEKS_TO_WALK = 5;

async function runProfile(profile: BehaviourProfile): Promise<RunResult> {
  setClockTo(INSTALL_DAY);
  const { weekStart: firstWeekStart } = installAndGenerate();

  const log: RunLogEntry[] = [];
  const rolloverProblems: string[] = [];
  const doorNotes: string[] = [];
  let week1: WeekSnapshot | null = null;

  const lastDay = addDaysISO(firstWeekStart, WEEKS_TO_WALK * 7 - 1);
  for (let dateISO = firstWeekStart; dateISO <= lastDay; dateISO = addDaysISO(dateISO, 1)) {
    // ONE DAY AT A TIME, THROUGH THE APP'S OWN CLOCK.
    setClockTo(dateISO);
    const problem = rollBlocksForward(dateISO);
    if (problem) rolloverProblems.push(problem);
    const weekStart = followTheWeek(dateISO);
    const weekIndex = Math.round(
      (Date.parse(`${weekStart}T12:00:00Z`) - Date.parse(`${firstWeekStart}T12:00:00Z`))
      / (7 * 24 * 3600 * 1000)) + 1;

    if (weekIndex === 1 && !week1 && dateISO === firstWeekStart) {
      week1 = snapshotWeek(weekStart, 1, dateISO);
    }

    for (const event of profile.eventsForDay?.({ dateISO, weekIndex, weekStart }) ?? []) {
      doorNotes.push(`${dateISO}: ${await walkAwayDoor(event, dateISO, weekStart)}`);
    }

    const intent = profile.intentForDay({ dateISO, weekIndex, weekday: weekdayName(dateISO) });
    const outcome = await recordDay(dateISO, intent);
    log.push({
      dateISO,
      weekday: weekdayName(dateISO),
      weekIndex,
      sessionName: outcome.sessionName,
      result: outcome.result,
      detail: outcome.detail,
    });
    await quietAsync(() => flushPendingStorageWrites());
  }

  const week5Start = addDaysISO(firstWeekStart, 4 * 7);
  setClockTo(week5Start);
  rollBlocksForward(week5Start);
  followTheWeek(week5Start);
  const week5 = snapshotWeek(week5Start, 5, week5Start);

  return {
    profile,
    log,
    week1: week1 ?? snapshotWeek(firstWeekStart, 1, firstWeekStart),
    week5,
    rolloverProblems,
    doorNotes,
    census: takeCensus(week5Start),
  };
}

// ── Reporting ─────────────────────────────────────────────────────────────
//
// ⚠ THIS IS A STRUCTURAL REPORT, NOT THE PAPER PHONE. Item 65 (`printer`) owns
// the plain-English athlete-facing rendering and the SignedCopy discipline that
// goes with it, and item 66's order says to reuse that printer rather than write
// a second one. It did not exist when this ran, so what follows deliberately
// stays STRUCTURAL — session names, types and authored sets/reps straight off
// the workout — and invents no athlete-facing words of its own. When the
// printer exports its renderer, the two snapshots below are its input and this
// section becomes a call to it.

function renderDay(day: WeekSnapshot['days'][number]): string {
  if (!day.sessionName) return `${day.weekday.padEnd(9)} ${day.dateISO}  —  rest`;
  const head = `${day.weekday.padEnd(9)} ${day.dateISO}  —  ${day.sessionName}`
    + `${day.sessionType ? ` [${day.sessionType}` : ''}`
    + `${day.intensity ? `/${day.intensity}]` : day.sessionType ? ']' : ''}`;
  const lines = day.exercises.map((exercise) => `      · ${exercise.name}`
    + `${exercise.sets != null ? ` — ${exercise.sets} sets` : ''}`
    + `${exercise.reps != null ? ` × ${exercise.reps}` : ''}`
    + `${exercise.weightKg != null ? ` @ ${exercise.weightKg}kg` : ''}`);
  return [head, ...lines].join('\n');
}

function renderRun(run: RunResult): string {
  const recorded = run.log.filter((entry) => entry.result === 'recorded').length;
  const notRecorded = run.log.filter((entry) => entry.result === 'not_recorded').length;
  const rest = run.log.filter((entry) => entry.result === 'no_session').length;
  const refused = run.log.filter((entry) => entry.result === 'refused');
  const threw = run.log.filter((entry) => entry.result === 'threw');

  const out: string[] = [];
  out.push(`# ${run.profile.title}`);
  out.push('');
  out.push(run.profile.description);
  out.push('');
  out.push('## What the athlete actually did');
  out.push('');
  out.push(`- Days walked: **${run.log.length}** (${WEEKS_TO_WALK} weeks, one day at a time)`);
  out.push(`- Sessions RECORDED through the real completion path: **${recorded}**`);
  out.push(`- Days the athlete chose not to record: **${notRecorded}**`);
  out.push(`- Days with no session to record (rest): **${rest}**`);
  out.push(`- Sessions the app REFUSED to record: **${refused.length}**`);
  out.push(`- Doors that THREW: **${threw.length}**`);
  out.push('');
  out.push('### What the history actually became');
  out.push('');
  out.push('If the last number here is 0 while the first is not, the app cannot see this '
    + 'athlete\'s training and nothing below about week 5 means anything.');
  out.push('');
  out.push(`- Days of feedback stored: **${run.census.storedFeedbackDays}**`);
  out.push(`- Of those, carrying a per-exercise strength log: **${
    run.census.feedbackWithStrengthLogs}**`);
  out.push(`- Soreness answers stored above "none": **${run.census.storedSorenessAnswers}**`);
  out.push(`- Days the athlete typed in a load: **${run.census.weightOverrideDays}** `
    + `(**${run.census.weightOverrideEntries}** loads in all)`);
  out.push(`- Entries the progression reader actually SEES: **${
    run.census.progressionHistoryEntries}**`);
  out.push('');
  if (refused.length > 0) {
    out.push('### Refusals — the app declined to record these, verbatim');
    out.push('');
    for (const entry of refused) out.push(`- ${entry.dateISO} ${entry.weekday}: ${entry.detail}`);
    out.push('');
  }
  if (threw.length > 0) {
    out.push('### Throws — a door broke rather than answering');
    out.push('');
    for (const entry of threw) out.push(`- ${entry.dateISO} ${entry.weekday}: ${entry.detail}`);
    out.push('');
  }
  if (run.doorNotes.length > 0) {
    out.push('### Other doors walked');
    out.push('');
    for (const note of run.doorNotes) out.push(`- ${note}`);
    out.push('');
  }
  if (run.rolloverProblems.length > 0) {
    out.push('### Block rollover problems');
    out.push('');
    for (const problem of run.rolloverProblems) out.push(`- ${problem}`);
    out.push('');
  }

  // ── THE PART SAM READS ─────────────────────────────────────────────────
  //
  // Item 65's renderer, so these words are the app's own signed copy and the
  // [NO COPY] counting is the same code that produced the paper-phone weeks.
  out.push('## Week 1 and week 5, in the athlete\'s own words');
  out.push('');
  out.push('Rendered by item 65\'s printer, not by this script — so every word below is '
    + 'the app\'s, and the two reports\' [NO COPY] counts are produced by the same code.');
  out.push('');
  out.push(`[NO COPY] in week 1: **${run.week1.noCopyCount}** · in week 5: `
    + `**${run.week5.noCopyCount}**`);
  out.push('');
  out.push(run.week1.plainEnglish);
  out.push('');
  out.push(run.week5.plainEnglish);
  out.push('');
  if (run.week1.printFindings.length > 0 || run.week5.printFindings.length > 0) {
    out.push('### What the printer flagged in these two weeks');
    out.push('');
    for (const finding of run.week1.printFindings) out.push(`- week 1 — ${finding}`);
    out.push('');
    for (const finding of run.week5.printFindings) out.push(`- week 5 — ${finding}`);
    out.push('');
  }

  out.push('## The same two weeks, structurally');
  out.push('');
  out.push('Sets, reps and the loads underneath — including `prescribedWeightKg`, which the '
    + 'athlete-facing surface above does NOT show. This is where progression actually '
    + 'lands, so it is the only place a load change is visible.');
  out.push('');
  out.push(`### Week 1 — starting ${run.week1.weekStart}`);
  out.push('');
  out.push('```');
  for (const day of run.week1.days) out.push(renderDay(day));
  out.push('```');
  out.push('');
  out.push(`### Week 5 — starting ${run.week5.weekStart}`);
  out.push('');
  out.push('```');
  for (const day of run.week5.days) out.push(renderDay(day));
  out.push('```');
  out.push('');
  out.push(changeSummary(run));
  return out.join('\n');
}

/** WHAT CHANGED — stated as a comparison, never as a verdict this script invents. */
function changeSummary(run: RunResult): string {
  const out: string[] = ['## What changed between week 1 and week 5', ''];
  const byWeekday = (snapshot: WeekSnapshot): Map<string, WeekSnapshot['days'][number]> =>
    new Map(snapshot.days.map((day) => [day.weekday, day]));
  const first = byWeekday(run.week1);
  const fifth = byWeekday(run.week5);
  let differences = 0;
  for (const weekday of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday',
    'Saturday', 'Sunday']) {
    const before = first.get(weekday);
    const after = fifth.get(weekday);
    const beforeName = before?.sessionName ?? 'rest';
    const afterName = after?.sessionName ?? 'rest';
    const beforeCount = before?.exercises.length ?? 0;
    const afterCount = after?.exercises.length ?? 0;
    // COMPARE THE PRESCRIPTION, NOT JUST THE HEADLINE. Comparing name and
    // exercise count alone cannot see a load increase, which is precisely what
    // four weeks of progression is supposed to produce.
    const rowSignature = (day?: WeekSnapshot['days'][number]): string =>
      (day?.exercises ?? []).map((exercise) => `${exercise.name}|${exercise.sets}|`
        + `${exercise.reps}|${exercise.weightKg}`).join(';');
    const beforeRows = rowSignature(before);
    const afterRows = rowSignature(after);
    if (beforeName === afterName && beforeRows === afterRows) {
      out.push(`- **${weekday}** — unchanged (${beforeName}, ${beforeCount} exercises, `
        + 'same sets/reps/loads)');
      continue;
    }
    differences += 1;
    if (beforeName === afterName && beforeCount === afterCount) {
      out.push(`- **${weekday}** — same session (\`${beforeName}\`), but the prescription `
        + 'moved:');
      const beforeList = before?.exercises ?? [];
      const afterList = after?.exercises ?? [];
      for (let index = 0; index < Math.max(beforeList.length, afterList.length); index += 1) {
        const one = beforeList[index];
        const two = afterList[index];
        const describe = (exercise?: typeof one): string => (exercise
          ? `${exercise.name} ${exercise.sets ?? '?'}×${exercise.reps ?? '?'}`
            + `${exercise.weightKg != null ? ` @ ${exercise.weightKg}kg` : ''}`
          : '(none)');
        if (describe(one) !== describe(two)) {
          out.push(`    - ${describe(one)} → ${describe(two)}`);
        }
      }
      continue;
    }
    out.push(`- **${weekday}** — \`${beforeName}\` (${beforeCount} ex) → `
      + `\`${afterName}\` (${afterCount} ex)`);
  }
  out.push('');
  out.push(differences === 0
    ? '**NOTHING MOVED.** Four weeks of recorded training changed nothing about the '
      + 'shape of the week. Whether that is right is Sam\'s call, not this script\'s — '
      + 'but it is the single most important line in this file.'
    : `**${differences} of 7 days differ.**`);
  return out.join('\n');
}

// ── Entry ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const requested = process.argv.includes('--profile')
    ? process.argv[process.argv.indexOf('--profile') + 1]
    : null;
  const selected = requested
    ? PROFILES.filter((profile) => profile.id === requested)
    : PROFILES;
  if (selected.length === 0) {
    throw new Error(`unknown profile "${requested}" — known: ${
      PROFILES.map((profile) => profile.id).join(', ')}`);
  }

  const outDir = resolve(__dirname, '../docs/simulated-changeover');
  mkdirSync(outDir, { recursive: true });

  const summaries: string[] = [];
  for (const profile of selected) {
    process.stdout.write(`\n── ${profile.title} ──\n`);
    const run = await runProfile(profile);
    const markdown = renderRun(run);
    const file = resolve(outDir, `${profile.id}.md`);
    writeFileSync(file, `${markdown}\n`, 'utf8');
    const recorded = run.log.filter((entry) => entry.result === 'recorded').length;
    const refused = run.log.filter((entry) => entry.result === 'refused').length;
    const threw = run.log.filter((entry) => entry.result === 'threw').length;
    process.stdout.write(`   recorded=${recorded} refused=${refused} threw=${threw} `
      + `rollover_problems=${run.rolloverProblems.length}\n`);
    process.stdout.write(`   wrote ${file}\n`);
    summaries.push(`${profile.title}: recorded=${recorded} refused=${refused} threw=${threw}`);
  }

  process.stdout.write('\n── summary ──\n');
  for (const line of summaries) process.stdout.write(`   ${line}\n`);
  process.stdout.write('\n');
}

main().catch((error) => {
  process.stderr.write(`\nSIMULATION FAILED — ${
    error instanceof Error ? error.stack ?? error.message : String(error)}\n\n`);
  process.exit(1);
});
