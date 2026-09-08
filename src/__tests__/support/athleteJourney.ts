import { displayReps } from '../../rules/prescriptionDisplay';
/**
 * THE COMPLETE ATHLETE JOURNEY — one real athlete, production doors only.
 *
 * Sam's mission, 2026-08-17: *"Prove and complete one real athlete journey
 * through the production app: cold start → onboarding → Block 1 → athlete
 * actions and feedback → program adjustment → Block 2 → restart/rebuild. Use
 * production builders and real app doors—not hand-built state."*
 *
 * ## WHY THIS EXISTS WHEN THREE INSTRUMENTS ALREADY WALK PART OF IT
 *
 * `scripts/simulate-changeover.ts` walks the clock and records sessions through
 * the one live outcome writer. `scripts/print-week.ts` runs the real read chain.
 * `blockTwoExplanationDeliveryTests` crosses a real block boundary. **None of
 * them enters through the door a real athlete enters through.**
 *
 * The changeover script installs block 1 with a bare `generateProgramLocally` +
 * `commitRebuiltProgram` pair of its own — a second copy of a job production
 * splits between two owners — and the block-two suites roll the block with
 * `acceptBlock` rather than `rolloverProgramBlock`. Each is right for what it
 * was built for. But a journey harness that installs block 1 its own way cannot
 * see a defect in the way the APP installs block 1, and that is exactly the
 * defect this file found first (see `RECORD_SELECTIONS` below).
 *
 * So this module owns ONE rule: **every state change goes through the function
 * the athlete's tap reaches, and the function is named beside the call.** No
 * `setState`, no hand-built `ScheduleState`, no feedback record written into
 * storage. Where a door refuses, the refusal is returned and reported — a
 * history the app would not have produced is worth nothing.
 *
 * ## THE DOORS, AND WHO IN THE APP CALLS THEM
 *
 * | journey step | door | the app's own caller |
 * | --- | --- | --- |
 * | cold start | `resetStoresToFreshInstall` | a fresh install |
 * | onboarding answers | `updateOnboardingData` | every onboarding step screen |
 * | onboarding accepted | `completeOnboarding` | `CompleteScreen.tsx:426` |
 * | block 1 authored | `generateProgramFromProfile` | `CompleteScreen.tsx:302` |
 * | block 1 installed | `seedOnboardingProgram` | `CompleteScreen.tsx:408` |
 * | a day passing | `setDevE2EClock` | `DevE2EClock`, the app's one source of now |
 * | session recorded | `commitSessionOutcomeTransaction` | `useHomeScreen.ts:1370`, `SessionFeedbackPanel.tsx:308` |
 * | a load typed in | `programStore.setWeightOverride` | `useDayWorkout.ts:218` |
 * | exercise left out | `applyExerciseExclusionDecision` | the day screen's Remove, My Status, the coach |
 * | exercise restored | `restoreExcludedExerciseDurably` | My Status' Restore |
 * | swap / remove / readiness | `executeProgramControlActionDurably` | every program-control surface |
 * | block rolled over | `rolloverProgramBlock` | `useHomeScreen`, on the day the block ends |
 * | app relaunched | `runQuiescentBoot` | `appHydrationGate.ts:190` |
 * | what the athlete reads | `buildProgramTabProjectedWeek` → `project` | `useSchedule.projectWeekFor` |
 *
 * ## ⚠ THE HEADLESS BOOTSTRAP IS THE CALLER'S JOB, NOT THIS FILE'S
 *
 * `__DEV__` must be TRUE before any app import or `setDevE2EClock` returns null
 * *silently* and every door reads the wall clock
 * (`DevE2EClock.isDevE2EClockAvailable`). This module therefore does NOT set
 * `__DEV__` at module scope — importing a module that does (`print-week.ts` sets
 * it false) would win over a caller that set it true, which is how a run comes
 * to report simulated dates while walking the real today. `setJourneyClock`
 * re-asserts it on every call and then ASSERTS `todayISOLocal()` agrees.
 */

import type { OnboardingData, TrainingProgram, Workout } from '../../types/domain';
import type { ResolvedDay } from '../../utils/sessionResolver';

import {
  DEV_E2E_CAMPAIGN_TIME_ZONE,
  createDevE2EClockReceipt,
  devE2EAnchorInstantForDate,
  setDevE2EClock,
} from '../../dev/e2e/DevE2EClock';
import { todayISOLocal } from '../../utils/appDate';
import { generateProgramFromProfile } from '../../services/api/generateProgram';
import { seedOnboardingProgram } from '../../utils/onboardingCompletion';
import { useProgramStore } from '../../store/programStore';
import { useProfileStore } from '../../store/profileStore';
import { useWorkoutLogStore } from '../../store/workoutLogStore';
import { useBlockSelectionHistoryStore } from '../../store/blockSelectionHistoryStore';
import { addDaysISO, getProgramBlockRolloverStatus } from '../../utils/programBlockState';
import { rolloverProgramBlock } from '../../utils/programBlockRollover';
import { buildRolloverAcknowledgment } from '../../utils/readinessAcknowledgment';
import { buildScheduleStateImperative } from '../../utils/coachWeekDiff';
import { resolveWeekWithConditioning } from '../../utils/sessionResolver';
import { buildProgramTabProjectedWeek } from '../../utils/visibleProgramReadModel';
import { project } from '../../rules/projectVisibleWeek';
import { executeProgramControlActionDurably } from '../../utils/programControlActions';
import {
  applyExerciseExclusionDecision,
  restoreExcludedExerciseDurably,
} from '../../utils/exerciseExclusionOwner';
import {
  commitSessionOutcomeTransaction,
  createRecordSessionOutcomeIntentFromFeedback,
  resolveSessionOutcomeTarget,
} from '../../store/sessionOutcomeTransaction';
import { flushPendingStorageWrites } from '../../store/asyncStorageCompat';
import { buildStrengthPerformanceLogs, collectLoggedStrengthSets } from '../../utils/strengthLogging';
import { resolveLoadControlMode } from '../../utils/loadEstimation';
import { buildSessionFeedbackPayload } from '../../utils/sessionFeedbackForm';
import { getSessionComponents } from '../../utils/sessionComponents';
import { buildStrengthWorkoutHistoryFromFeedback } from '../../utils/strengthProgressionIntegration';
import { resetStoresToFreshInstall } from './freshInstallStores';

// ═══════════════════════════════════════════════════════════════════════════
// QUIET
// ═══════════════════════════════════════════════════════════════════════════

export function quiet<T>(body: () => T): T {
  const { warn, error, log, info, debug } = console;
  console.warn = console.error = console.log = console.info = console.debug =
    (() => undefined) as never;
  try { return body(); } finally {
    console.warn = warn; console.error = error; console.log = log;
    console.info = info; console.debug = debug;
  }
}

export async function quietAsync<T>(body: () => Promise<T>): Promise<T> {
  const { warn, error, log, info, debug } = console;
  console.warn = console.error = console.log = console.info = console.debug =
    (() => undefined) as never;
  try { return await body(); } finally {
    console.warn = warn; console.error = error; console.log = log;
    console.info = info; console.debug = debug;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// THE CLOCK
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Move the app's own today. Load-bearing, both lines of it.
 *
 * The `__DEV__` re-assertion is not defensive noise: `scripts/print-week.ts`
 * and `athleteActionWalkerTests.ts` both set it FALSE at module scope, and that
 * assignment wins over a caller's, so importing either one silently disarms the
 * clock. The `todayISOLocal()` check is what turns "we passed a date around"
 * into "time passed in the app".
 */
export function setJourneyClock(dateISO: string): void {
  (global as unknown as { __DEV__: boolean }).__DEV__ = true;
  const applied = setDevE2EClock(createDevE2EClockReceipt({
    seedId: 'standard-in-season-week',
    anchorInstant: devE2EAnchorInstantForDate(dateISO, DEV_E2E_CAMPAIGN_TIME_ZONE),
    timezone: DEV_E2E_CAMPAIGN_TIME_ZONE,
    createdAt: '2026-08-13T00:00:00.000Z',
  }));
  if (!applied) {
    throw new Error('DevE2EClock REFUSED — __DEV__ is not true in this process, so every '
      + 'door below would read the wall clock and this journey would be a lie.');
  }
  const appToday = todayISOLocal();
  if (appToday !== dateISO) {
    throw new Error(`the app's clock says ${appToday} but the journey is on ${dateISO} — `
      + 'DevE2EClock is not driving appDate.');
  }
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function weekdayName(dateISO: string): string {
  return WEEKDAYS[new Date(`${dateISO}T12:00:00Z`).getUTCDay()];
}

export function mondayFor(dateISO: string): string {
  const parsed = new Date(`${dateISO}T12:00:00Z`);
  return addDaysISO(dateISO, -((parsed.getUTCDay() + 6) % 7));
}

// ═══════════════════════════════════════════════════════════════════════════
// COLD START → ONBOARDING → BLOCK 1
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚠ **`recordSelections` IS THE ONBOARDING DOOR'S MISSING ARGUMENT, AND IT IS A
 * PRODUCTION DEFECT THIS HARNESS EXISTS TO HOLD.**
 *
 * Read `CompleteScreen.tsx:302`. It calls `generateProgramFromProfile` with
 * `weekAcceptance` and `todayISO` and nothing else, and `seedOnboardingProgram`
 * then INSTALLS that program. Every other committing caller in the app passes
 * `recordSelections: true` and says so in the same comment —
 * `quiescentBoot.ts:535`, `acceptedStateTransaction.ts:1953`,
 * `profileProgramTransaction.ts:205`, `weekRebuild.ts:649`,
 * `temporarySourceFactTransaction.ts:534`. The first block every athlete is ever
 * given is the one block whose selections are never recorded.
 *
 * This harness calls the door the way the screen calls it. `installBlockOne`
 * takes no flag and offers no "record it anyway" option, because a harness that
 * quietly supplies the missing argument cannot see the defect — it becomes the
 * fixture whose input cannot exhibit the fault.
 */
export const RECORD_SELECTIONS_OWNER = 'src/screens/onboarding/CompleteScreen.tsx';

export interface JourneyInstallResult {
  program: TrainingProgram;
  /** The Monday the installed program starts on. */
  blockOneStart: string;
  /** How many selection records exist after install — 0 is the defect above. */
  recordedSelectionCount: number;
  onboardingRefusal: string | null;
}

/**
 * Cold start, onboarding, block 1 — through `CompleteScreen`'s own three calls,
 * in `CompleteScreen`'s own order.
 *
 * The screen generates FIRST and completes onboarding SECOND
 * (`generateProgram()` runs in a mount effect at `:268`; `handleStartTraining`
 * calls `completeOnboarding()` at `:426`). That order is reproduced rather than
 * tidied, because `completeOnboarding` is what flips `isOnboardingComplete`, and
 * `rebuildDerivedWorld` returns early without it — so the order decides whether
 * a later relaunch regenerates at all.
 */
export async function coldStartThroughOnboarding(args: {
  profile: OnboardingData;
  installDayISO: string;
}): Promise<JourneyInstallResult> {
  resetStoresToFreshInstall('athlete-journey:cold-start');
  useBlockSelectionHistoryStore.getState().clear();

  setJourneyClock(args.installDayISO);

  // THE ANSWERS. One call, as the onboarding steps accumulate them.
  useProfileStore.getState().updateOnboardingData(args.profile);

  // THE PROGRAM, through the screen's own generator call — argument for argument.
  const program = await quietAsync(() => generateProgramFromProfile(args.profile, {
    // Exact parity with CompleteScreen: onboarding authors the first block.
    recordSelections: 'author',
    weekAcceptance: 'restoration',
    todayISO: args.installDayISO,
  } as never)) as TrainingProgram;

  // THE INSTALL, through the screen's own installer.
  quiet(() => seedOnboardingProgram({
    onboardingData: args.profile,
    program,
    todayISO: args.installDayISO,
  }));

  // ACCEPTANCE LAST, as the screen does it.
  const outcome = quiet(() => useProfileStore.getState().completeOnboarding()) as
    { ok?: boolean; message?: string } | undefined;
  const onboardingRefusal = outcome && outcome.ok === false
    ? String(outcome.message ?? 'completeOnboarding refused without a message')
    : null;

  await quietAsync(() => flushPendingStorageWrites());

  const installed = useProgramStore.getState().currentProgram ?? program;
  return {
    program: installed,
    blockOneStart: String(installed.microcycles[0]?.startDate ?? args.installDayISO).slice(0, 10),
    recordedSelectionCount: useBlockSelectionHistoryStore.getState().selections.length,
    onboardingRefusal,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// WHAT THE ATHLETE SEES — the read chain, never a hand-built projection
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The two calls `useSchedule.projectWeekFor` makes, on LIVE store state.
 *
 * ⚠ **CALL THIS WHILE THE STORE IS IN THE WEEK YOU MEAN.** Both
 * `buildProgramTabProjectedWeek` and `project` read the live stores, so
 * capturing week 1 after the walk has reached week 5 prints week 5 under a week
 * 1 heading — a before/after pair that is secretly one thing twice.
 */
export function visibleProjection(weekStartISO: string, todayISO: string): {
  explanations: string[];
  days: VisibleDay[];
} {
  const weekDays = quiet(() => buildProgramTabProjectedWeek({
    mondayISO: weekStartISO,
    todayISO,
    state: buildScheduleStateImperative(),
    overrideContexts: useProgramStore.getState().overrideContexts ?? {},
  }));
  const projected = quiet(() => project({
    week: weekDays as never,
    weekStart: weekStartISO,
    program: useProgramStore.getState().currentProgram as never,
  })) as unknown as { explanations?: readonly unknown[] };
  return {
    explanations: (projected.explanations ?? []).map(String),
    days: resolvedDays(weekStartISO, todayISO),
  };
}

export interface VisibleRow {
  name: string;
  sets: number | null;
  repsMin: number | null;
  repsMax: number | null;
  weightKg: number | null;
}

export interface VisibleDay {
  dateISO: string;
  weekday: string;
  sessionName: string | null;
  /** The app's own typed session components; never inferred from row names. */
  components: string[];
  rows: VisibleRow[];
}

/** The resolved week — the same resolver every app surface reads. */
export function resolvedDays(weekStartISO: string, _todayISO?: string): VisibleDay[] {
  const week = quiet(() => resolveWeekWithConditioning(weekStartISO, buildScheduleStateImperative()));
  return week
    .filter((day) => day.date >= weekStartISO && day.date <= addDaysISO(weekStartISO, 6))
    .slice()
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((day) => {
      const workout = (day as ResolvedDay).workout as Workout | null | undefined;
      return {
        dateISO: day.date,
        weekday: weekdayName(day.date),
        sessionName: workout?.name ?? null,
        components: workout
          ? getSessionComponents(workout).map((component) => String(component.kind))
          : [],
        // `row.exercise?.name ?? row.name` is the app's own read
        // (`projectVisibleWeek.ts:396`, `sessionComponents.ts:566`). Reading
        // `row.name` alone prints every row as unnamed and reads as a defect.
        rows: (workout?.exercises ?? []).map((row) => {
          const nested = (row as { exercise?: { name?: string } }).exercise;
          const num = (value: unknown): number | null =>
            (Number.isFinite(value) ? Number(value) : null);
          return {
            name: String(nested?.name ?? (row as { name?: string }).name ?? '(NO NAME ON ROW)'),
            sets: num((row as { prescribedSets?: number }).prescribedSets),
            repsMin: num((row as { prescribedRepsMin?: number }).prescribedRepsMin),
            repsMax: num((row as { prescribedRepsMax?: number }).prescribedRepsMax),
            // WHERE PROGRESSION LANDS, and the athlete-facing surface does not
            // print it — so a report of sets and reps alone is blind to a load
            // change, which is the whole subject of a block boundary.
            weightKg: num((row as { prescribedWeightKg?: number }).prescribedWeightKg),
          };
        }),
      };
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// A DAY PASSING, AND A SESSION RECORDED
// ═══════════════════════════════════════════════════════════════════════════

export interface DayIntent {
  /** Does the athlete open the app and record at all? A miss leaves NO record. */
  record: boolean;
  completion: 'full' | 'partial' | 'skipped';
  feeling: 'very_easy' | 'easy' | 'good' | 'hard' | 'very_hard';
  soreness: 'none' | 'mild' | 'moderate' | 'high';
  /**
   * SESSION EFFORT IS 1-10, NOT 1-5, and a 1-5 value is silently valid on it.
   * `isSessionEffortRating` enforces 1..10; `feedbackAdapter` treats `<= 5` as
   * the EASY arm and ADDS volume, so `difficulty: 3` meaning "middling" tells
   * the app the session was easy. See `docs/EFFORT_SCALE_INVERSION_2026-08-12.md`.
   */
  difficulty: number;
  /** Does the athlete type in what they lifted? Progression reads these. */
  logWeights?: boolean;
  /**
   * THE CONDITIONING RPE, answered separately from session effort.
   *
   * `readBlockHistory` reads `feedback.conditioning.rpe` for the conditioning
   * quality and nothing else — so an athlete who never fills this in has
   * `conditioningEasy: false` no matter how easy they found it, and the
   * extra-session offer's *"everything consistently easy"* gate can never open.
   * Measured: `strengthEasy=true conditioningEasy=false` on an athlete answering
   * effort 2 out of 10 on every session.
   */
  conditioningRpe?: number;
  /**
   * THE ATHLETE TYPES A NUMBER THE CARD DID NOT SAY.
   *
   * Confirming the prescription and OVERRIDING it are different athlete acts, and
   * only the second can prove whose number block 2 progresses from. Applied
   * BEFORE the performance logs are built, because
   * `buildStrengthPerformanceLogs` reads that day's `weightOverrides` slice — an
   * edit made afterwards is real in the store and invisible to progression, which
   * is a genuinely different (and much subtler) bug than this models.
   *
   * Names the exercise so the assertion can be about a derived identity rather
   * than "whichever row happened to be first".
   */
  editLoad?: { exerciseName: string; toKg: number };
  absenceReason?: string;
  /**
   * Why a SKIPPED session was skipped — the form's own reason list. The draft
   * rule refuses a skip with no reason, exactly as the screen does, so a robot
   * that skips must say why (default: no time).
   */
  skipReason?: 'busy_no_time' | 'injured_niggle' | 'sick_low_energy' | 'didnt_feel_like_it' | 'equipment_unavailable' | 'other';
}

export type DayOutcome =
  | { result: 'recorded'; sessionName: string | null }
  | { result: 'no_session'; sessionName: null; detail: string | null }
  | { result: 'not_recorded'; sessionName: string | null; detail: string | null }
  | { result: 'refused'; sessionName: string | null; detail: string }
  | { result: 'threw'; sessionName: string | null; detail: string };

/**
 * Record one day through the app's ONE live outcome writer.
 *
 * ⚠ **A `full` COMPLETION WITH NO `feedback.strength` IS INVISIBLE TO
 * PROGRESSION.** `buildStrengthWorkoutHistoryFromFeedback`
 * (`strengthProgressionIntegration.ts:195`) keeps a session only when
 * `strength` is non-empty or the session was skipped. Thirty sessions recorded
 * without it once produced a week 5 identical across four different histories,
 * which reads exactly like "the app ignores training" and was the harness
 * forgetting to log what was lifted.
 *
 * Both builders below are `SessionFeedbackPanel.tsx:880-886`'s own, in its order.
 */
export async function recordDay(dateISO: string, intent: DayIntent): Promise<DayOutcome> {
  let target: { workout: Workout } | null = null;
  try {
    target = resolveSessionOutcomeTarget(dateISO) as unknown as { workout: Workout };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // `session_not_found` is a REST DAY, not a defect. The app says so too.
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

  const components = quiet(() => getSessionComponents(target!.workout as never));

  let loggedSets: Record<string, unknown[]> | undefined;
  if (intent.logWeights) {
    // ⚠ **THE EDIT GOES INTO THE SET LOG, NOT ON TOP OF IT.** The first version of
    // this harness logged every set at the prescribed load and THEN called
    // `setWeightOverride` with the athlete's number, and reported that block 2
    // ignored the edit. It was right to ignore it: `buildStrengthPerformanceLogs`
    // prefers the LOGGED sets, and logging 125 then relabelling the prescription
    // 111 is not "the athlete lifted 111" — it is two different facts, and the
    // logged one wins because it is what actually happened.
    typeLoadsForSession(dateISO, target.workout, intent.editLoad
      ? { [intent.editLoad.exerciseName]: intent.editLoad.toKg }
      : undefined);
    loggedSets = quiet(() => collectLoggedStrengthSets(
      target!.workout, useWorkoutLogStore.getState().loggedSets as never, undefined,
    )) as Record<string, unknown[]> | undefined;
  }

  // `weightOverrides` is keyed BY DATE FIRST (`programStore.ts:1940`) and the
  // panel hands over one day's slice (`SessionFeedbackPanel.tsx:474`). Passing
  // the whole map resolves no override at all, silently.
  const strength = quiet(() => buildStrengthPerformanceLogs(
    target!.workout,
    useProgramStore.getState().weightOverrides?.[dateISO] ?? {},
    intent.completion,
    loggedSets as never,
  ));

  // Every component answered: `canSaveFeedbackDraft` refuses a draft holding a
  // null component answer, and a half-answered form is not submittable either.
  const componentCompletions: Record<string, typeof intent.completion> = {};
  for (const component of components) {
    componentCompletions[String(component.id)] = intent.completion;
  }
  const skipReason = intent.completion === 'skipped' ? (intent.skipReason ?? 'busy_no_time') : null;
  const componentReasons: Record<string, { partialReason: null; skipReason: typeof skipReason }> = {};
  if (skipReason) {
    for (const component of components) {
      componentReasons[String(component.id)] = { partialReason: null, skipReason };
    }
  }

  const feedback = quiet(() => buildSessionFeedbackPayload({
    dateStr: dateISO,
    completion: intent.completion,
    componentCompletions,
    components,
    feeling: intent.feeling,
    soreness: intent.soreness,
    difficulty: intent.difficulty,
    partialReason: null,
    skipReason,
    ...(skipReason ? { componentReasons } : {}),
    ...(strength.length > 0 ? { strength } : {}),
    // ⚠ **ANSWERED ONLY WHERE THE REAL SCREEN ASKS — the panel's own two gates.**
    //
    // Sam, 2026-08-18: *"Do not manufacture both answers only in the test
    // harness."* `SessionFeedbackPanel.tsx:681` shows the conditioning block when
    // `conditioningConfig.level === 'trackable' && conditioningWasPerformed`, and
    // `getVisibleFeedbackSections` is what turns that into a visible section. Both
    // owners are asked here, with the panel's own arguments, so this athlete can
    // only answer a question a real athlete would have been shown.
    ...(typeof intent.conditioningRpe === 'number'
      && conditioningSectionIsVisible(target.workout, intent.completion, components)
      ? { conditioning: { rpe: intent.conditioningRpe } }
      : {}),
  } as never));
  if (!feedback) {
    return {
      result: 'refused',
      sessionName,
      detail: 'buildSessionFeedbackPayload returned null — the app would not accept this '
        + `answer set (completion=${intent.completion}, feeling=${intent.feeling}, `
        + `soreness=${intent.soreness}, difficulty=${intent.difficulty})`,
    };
  }

  const recordIntent = createRecordSessionOutcomeIntentFromFeedback({
    date: dateISO,
    workout: target.workout,
    feedback,
    source: {
      entryPoint: 'tap',
      surface: 'athlete_journey',
      interpretedIntent: 'record_session_outcome',
      traceId: `athlete-journey:${dateISO}`,
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
    return { result: 'recorded', sessionName };
  } catch (error) {
    return {
      result: 'threw',
      sessionName,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}


/**
 * IS THE CONDITIONING QUESTION ON THE SCREEN FOR THIS SESSION?
 *
 * Reproduces `SessionFeedbackPanel`'s own decision using the panel's own owners —
 * `getConditioningLoggingConfig` for whether the work is trackable, the
 * conditioning component's completion for whether it was performed, and
 * `getVisibleFeedbackSections` for whether that becomes a visible section.
 *
 * This exists so the harness cannot answer a question the app never asked. It is
 * the panel's LOGIC, not its pixels — the taps themselves belong to the Maestro
 * flows, and that limit is stated in the suite header.
 */
export function conditioningSectionIsVisible(
  workout: Workout,
  completion: 'full' | 'partial' | 'skipped',
  components: readonly { id: unknown }[],
): boolean {
  return quiet(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getConditioningLoggingConfig } = require('../../utils/conditioningLogging');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getVisibleFeedbackSections } = require('../../utils/sessionFeedbackForm');
    const config = getConditioningLoggingConfig(workout) as { level?: string };
    const conditioningComponent = components
      .find((component) => String(component.id).includes('conditioning'));
    // The athlete completed every component they were shown, which is what this
    // journey's intents say, so a present conditioning component was performed.
    const performed = Boolean(conditioningComponent)
      && (completion === 'full' || completion === 'partial');
    const sections = getVisibleFeedbackSections(completion, {
      includeConditioningPerformance: config.level === 'trackable' && performed,
    }) as { id: string }[];
    return sections.some((section) => section.id === 'conditioning');
  });
}

/**
 * THE ATHLETE TYPES IN WHAT THEY LIFTED — `useDayWorkout.ts:218`'s own writer.
 *
 * Logging the PRESCRIBED load is the honest "did exactly what the card said"
 * case: the athlete confirming the prescription, not a performance this harness
 * invented.
 */
export function typeLoadsForSession(
  dateISO: string,
  workout: Workout,
  /**
   * Loads the athlete typed that DIFFER from the card, by exercise name.
   *
   * Both the logged set and the weight override are written at this number, which
   * is what a real athlete's edit produces — the two must agree or the logged one
   * silently wins and the override reads as ignored.
   */
  editedByName?: Record<string, number>,
): number {
  const logStore = useWorkoutLogStore.getState();
  const programStore = useProgramStore.getState() as unknown as {
    setWeightOverride: (date: string, exerciseId: string, weightKg: number) => void;
  };
  let typed = 0;
  for (const row of (workout.exercises ?? []) as unknown as {
    id: string; exerciseId: string; prescribedSets?: number;
    prescribedRepsMin?: number; prescribedRepsMax?: number; prescribedWeightKg?: number; prescriptionType?: string;
    exercise?: { name?: string };
  }[]) {
    const rowName = (row as { exercise?: { name?: string } }).exercise?.name ?? '';
    const edited = editedByName?.[rowName];
    const weight = Number.isFinite(edited) ? Number(edited) : Number(row.prescribedWeightKg);
    // ── R-343: A BODYWEIGHT LIFT IS LOGGED TOO — AT BODYWEIGHT, WITH ITS REPS ──
    // The first version skipped every zero-load row, so a Pull-Up done for the
    // full range left no set behind it and the block boundary could never see
    // the athlete had reached the target. Confirming the card at bodyweight is
    // the same honest act as confirming it at 80 kg; no weight is invented.
    const mode = resolveLoadControlMode(rowName);
    const atBodyweight = (!Number.isFinite(weight) || weight <= 0)
      && (mode === 'bodyweight_plus' || mode === 'bodyweight');
    if (!atBodyweight && (!Number.isFinite(weight) || weight <= 0)) continue;
    const sets = Math.max(1, Number(row.prescribedSets) || 1);
    for (let setNumber = 1; setNumber <= sets; setNumber += 1) {
      logStore.logSet(row.id, {
        id: `journey:${dateISO}:${row.id}:${setNumber}`,
        loggedWorkoutId: `journey:${dateISO}`,
        workoutExerciseId: row.id,
        setNumber,
        actualReps: (!row.prescriptionType || row.prescriptionType === 'reps')
          ? displayReps(row.prescribedRepsMin, row.prescribedRepsMax) ?? undefined
          : undefined,
        ...(atBodyweight ? {} : { actualWeightKg: weight }),
        createdAt: `${dateISO}T12:00:00.000Z`,
        updatedAt: `${dateISO}T12:00:00.000Z`,
      } as never);
    }
    if (!atBodyweight) programStore.setWeightOverride(dateISO, row.exerciseId, weight);
    typed += 1;
  }
  return typed;
}

/**
 * THE ATHLETE EDITS ONE LOAD — the same door, a DIFFERENT number.
 *
 * Distinct from `typeLoadsForSession` on purpose: confirming the prescription
 * and overriding it are different athlete acts, and only the second can prove
 * that the athlete's own number is what block 2 progresses from rather than the
 * number the app suggested.
 */
export function editLoad(args: {
  dateISO: string; exerciseId: string; weightKg: number;
}): void {
  (useProgramStore.getState() as unknown as {
    setWeightOverride: (date: string, exerciseId: string, weightKg: number) => void;
  }).setWeightOverride(args.dateISO, args.exerciseId, args.weightKg);
}

// ═══════════════════════════════════════════════════════════════════════════
// THE OTHER DOORS
// ═══════════════════════════════════════════════════════════════════════════

export interface DoorResult {
  ok: boolean;
  message: string;
}

/** Any program-control tap, through the real awaited executor. */
export async function walkProgramControlDoor(
  action: unknown,
  context: { weekStartISO: string; todayISO: string },
): Promise<DoorResult> {
  const week = resolvedDaysRaw(context.weekStartISO);
  const result = await quietAsync(() => executeProgramControlActionDurably(
    action as never,
    { visibleWeek: week as never, todayISO: context.todayISO },
  ));
  return {
    ok: (result as { ok?: boolean })?.ok === true,
    message: String((result as { message?: string })?.message ?? ''),
  };
}

function resolvedDaysRaw(weekStartISO: string): ResolvedDay[] {
  return quiet(() => resolveWeekWithConditioning(weekStartISO, buildScheduleStateImperative()))
    .filter((day) => day.date >= weekStartISO && day.date <= addDaysISO(weekStartISO, 6))
    .slice()
    .sort((left, right) => left.date.localeCompare(right.date));
}

/** "Leave this exercise out" — the one transaction owner, with the scope answer. */
export function leaveExerciseOut(args: {
  exercise: string;
  scope: 'today_only' | 'this_block' | 'until_changed';
  decidedOnISO: string;
  reason?: string;
}) {
  return applyExerciseExclusionDecision({
    exercise: args.exercise,
    scope: args.scope as never,
    decidedOnISO: args.decidedOnISO,
    ...(args.reason ? { reason: args.reason } : {}),
  });
}

/**
 * THE SWAP OPTIONS THE APP ITSELF OFFERS FOR A ROW.
 *
 * `getTapSwapChoices` is the production producer of the list the athlete taps —
 * it applies the substitute engine, the injury hierarchy, the kit filter and
 * `assessTapSwapCandidateSafety`. **Deriving a candidate any other way invents an
 * exercise the app would refuse**, and the refusal then reads as a product defect
 * (measured: picking a lift from another day offered a squat as a substitute for a
 * hinge, and the door correctly declined).
 */
export function swapOptionsFor(args: {
  dateISO: string;
  originalExercise: string;
  existingExerciseNames?: readonly string[];
}): { name: string; tier: string; source: string }[] {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getTapSwapChoices, resolveTapSwapEnvironment } = require('../../utils/tapSwapHierarchy');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useCoachUpdatesStore } = require('../../store/coachUpdatesStore');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useReadinessStore } = require('../../store/readinessStore');
  return quiet(() => {
    const environment = resolveTapSwapEnvironment({
      date: args.dateISO,
      profile: useProfileStore.getState().onboardingData,
      activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
      readinessSignal: useReadinessStore.getState().signalsByDate[args.dateISO],
    });
    return (getTapSwapChoices({
      originalExercise: args.originalExercise,
      reason: 'preference',
      environment,
      existingExerciseNames: args.existingExerciseNames ?? [],
    }) as { kind: string; name: string | null; hierarchyTier: string; source: string }[])
      .filter((choice) => choice.kind === 'exercise' && typeof choice.name === 'string')
      .map((choice) => ({
        name: String(choice.name), tier: choice.hierarchyTier, source: choice.source,
      }));
  });
}

/**
 * AN ORDINARY SUBSTITUTION — *"changes the programmed row without banning the
 * original exercise"* (approved contract).
 *
 * ⚠ **`futureWeeksToo` IS FALSE AND THAT IS THE WHOLE DISTINCTION.** With it true
 * the executor additionally calls `setPreferredAlternative`
 * (`programControlActions.ts`), which PINS the replacement for future weeks. An
 * ordinary substitution is exactly the same door without that flag: this week's
 * row changes and nothing is banned, pinned or excluded. A harness that passed
 * `true` would be walking the pin door and calling it a substitution.
 */
export async function substituteExercise(args: {
  dateISO: string;
  weekStartISO: string;
  fromExercise: string;
  toExercise: { name: string; sets: number; repsMin: number; repsMax: number };
}): Promise<DoorResult> {
  return walkProgramControlDoor({
    type: 'swap_exercise',
    source: { screen: 'session_detail', surface: 'exercise_row', initiatedBy: 'tap' },
    scope: 'today_only',
    payload: {
      date: args.dateISO,
      fromExercise: args.fromExercise,
      toExercise: args.toExercise,
      futureWeeksToo: false,
    },
    requiresRebuild: false,
    createsActiveModifier: false,
    oneOffOnly: true,
  }, { weekStartISO: args.weekStartISO, todayISO: args.dateISO });
}

/**
 * THE ATHLETE SAYS THEY ARE SORE OR COOKED — the readiness door, as its own act.
 *
 * Distinct from the soreness ANSWER on a completed session: that is a report
 * about work already done, and this is the athlete telling the app how they are
 * BEFORE it decides what to give them. Both exist and they are different taps.
 */
export async function reportFatigue(args: {
  dateISO: string;
  weekStartISO: string;
  level: 'spark' | 'cooked' | 'low_energy' | 'not_right' | 'sore' | 'worse';
}): Promise<DoorResult> {
  return walkProgramControlDoor({
    type: 'set_fatigue_status',
    source: { screen: 'program_tab', surface: 'how_are_you_feeling', initiatedBy: 'tap' },
    scope: 'today_only',
    payload: { date: args.dateISO, todayISO: args.dateISO, level: args.level },
    requiresRebuild: false,
    createsActiveModifier: true,
    oneOffOnly: false,
  }, { weekStartISO: args.weekStartISO, todayISO: args.dateISO });
}

// ═══════════════════════════════════════════════════════════════════════════
// THE OPTIONAL EXTRA-SESSION OFFER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * DOES THE APP OFFER THIS ATHLETE ANOTHER SESSION — asked the way the screen asks.
 *
 * Every dependency is the production one: the real history signal, the real
 * ledger, the real legality probe and the real patch builder. `decideExtraSessionOffer`
 * takes `patchFor` and `isCommitmentLegal` injected precisely so it never becomes a
 * second author of a schedule, so a harness that hand-rolled either would be
 * testing its own arithmetic.
 */
export function extraSessionOfferFor(args: {
  profile: OnboardingData;
  history: unknown;
  forBlockNumber: number;
  currentSessionsPerWeek: number;
}): { offer: boolean; refusal?: string; question?: {
  currentSessionsPerWeek: number; offeredSessionsPerWeek: number;
  trainingDays: readonly string[];
} } {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { decideExtraSessionOffer, availableTrainingDays } =
    require('../../rules/extraSessionOffer');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { commitmentPatchFor } = require('../../rules/weeklyCommitmentQuestion');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { commitmentLegalityProbe } = require('../../rules/weeklyCommitmentLegality');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useDecisionLedgerStore } = require('../../store/decisionLedgerStore');
  const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return quiet(() => decideExtraSessionOffer({
    history: args.history,
    forBlockNumber: args.forBlockNumber,
    profile: args.profile,
    weekOrder: WEEK,
    ledgerEntries: useDecisionLedgerStore.getState().entries ?? [],
    isCommitmentLegal: commitmentLegalityProbe,
    currentSessionsPerWeek: args.currentSessionsPerWeek,
    // ⚠ **`availableDays` IS NOT OPTIONAL FOR THE GROWING DIRECTION.** Left
    // undefined, `commitmentPatchFor` cannot place the extra day, the patch comes
    // back no larger, and `decideExtraSessionOffer` reports `no_available_day` —
    // about an athlete who has FOUR free days. Measured: `availableTrainingDays`
    // returned Thu/Fri/Sat/Sun while the offer refused for want of one.
    patchFor: (sessionsPerWeek: number) => commitmentPatchFor({
      profile: args.profile, sessionsPerWeek, weekOrder: WEEK,
      availableDays: availableTrainingDays({ profile: args.profile, weekOrder: WEEK }),
    }),
  })) as never;
}

/** ACCEPT — the growing direction, through the one commitment door. */
export async function acceptExtraSession(args: {
  profile: OnboardingData;
  forBlockNumber: number;
  sessionsPerWeek: number;
  todayISO: string;
  availableDays?: readonly string[];
}): Promise<DoorResult> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { confirmWeeklyCommitment, EXTRA_SESSION_SOURCE_SURFACE } =
    require('../../store/weeklyCommitmentAnswer');
  const result = await quietAsync(() => confirmWeeklyCommitment({
    forBlockNumber: args.forBlockNumber,
    sessionsPerWeek: args.sessionsPerWeek,
    profile: args.profile,
    todayISO: args.todayISO,
    ...(args.availableDays ? { availableDays: args.availableDays } : {}),
    sourceSurface: EXTRA_SESSION_SOURCE_SURFACE,
  }));
  return {
    ok: (result as { ok?: boolean })?.ok === true,
    message: String((result as { message?: string })?.message ?? ''),
  };
}

/**
 * DECLINE — and it CANNOT touch the program.
 *
 * `declineWeeklyCommitment` records the answer and imports nothing that can write
 * a program, which is how *"declining keeps the existing commitment"* is held —
 * by construction rather than by a branch that chooses not to.
 */
export function declineExtraSession(forBlockNumber: number): void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { declineWeeklyCommitment } = require('../../store/weeklyCommitmentAnswer');
  quiet(() => declineWeeklyCommitment({ forBlockNumber }));
}

/**
 * "Put it back" — the same owner, the other direction, through the DOOR.
 *
 * `restoreExcludedExerciseDurably`, not `restoreExcludedExercise`: the plain
 * function writes the decision, the door completes the act and settles the
 * world. My Status' "Restore exercise" takes the door
 * (`screens/coach/useCoachNoteActions`), so a harness that took the inner
 * function was modelling half the control — and a removal baked into storage by
 * any generation since is only recovered by the settle.
 */
export async function putExerciseBack(exercise: string) {
  return await quietAsync(() => restoreExcludedExerciseDurably(exercise));
}

// ═══════════════════════════════════════════════════════════════════════════
// THE BLOCK BOUNDARY
// ═══════════════════════════════════════════════════════════════════════════

export interface RolloverOutcome {
  fired: boolean;
  refusal: string | null;
  fromBlock: number | null;
  toBlock: number | null;
  nextBlockStart: string | null;
}

/**
 * The app's own answer to a block ending. Asked every simulated day, exactly as
 * `useHomeScreen` asks it, so the boundary is crossed on the day the app says it
 * is crossed rather than on a day this harness chose.
 */
export function rolloverIfDue(todayISO: string): RolloverOutcome {
  const store = useProgramStore.getState();
  const status = getProgramBlockRolloverStatus({
    program: store.currentProgram, dateISO: todayISO, blockState: store.blockState,
  });
  if (!status.needsRollover) {
    return {
      fired: false, refusal: null,
      fromBlock: status.currentBlockNumber ?? null,
      toBlock: null,
      nextBlockStart: status.nextBlockStart ?? null,
    };
  }
  try {
    const rolled = quiet(() => rolloverProgramBlock({
      baseProfile: useProfileStore.getState().onboardingData,
      targetDateISO: todayISO,
    }));
    if (rolled.refusal) {
      const ack = quiet(() => buildRolloverAcknowledgment(rolled));
      return {
        fired: false,
        refusal: String((ack as { message?: string })?.message
          ?? `refused: ${rolled.refusal.code}`),
        fromBlock: status.currentBlockNumber ?? null,
        toBlock: null,
        nextBlockStart: status.nextBlockStart ?? null,
      };
    }
    return {
      fired: true, refusal: null,
      fromBlock: status.currentBlockNumber ?? null,
      toBlock: status.nextBlockNumber ?? null,
      nextBlockStart: status.nextBlockStart ?? null,
    };
  } catch (error) {
    return {
      fired: false,
      refusal: `rollover THREW: ${error instanceof Error ? error.message : String(error)}`,
      fromBlock: status.currentBlockNumber ?? null,
      toBlock: null,
      nextBlockStart: status.nextBlockStart ?? null,
    };
  }
}

/** Point the athlete at the week they are in, as Monday arriving does. */
export function followTheWeek(todayISO: string): string {
  const monday = mondayFor(todayISO);
  const program = useProgramStore.getState().currentProgram;
  const next = program?.microcycles.find((m) => m.startDate.slice(0, 10) === monday);
  if (next) useProgramStore.setState({ currentMicrocycle: next } as never);
  return monday;
}

// ═══════════════════════════════════════════════════════════════════════════
// THE CENSUS — the anti-vacuity check
// ═══════════════════════════════════════════════════════════════════════════

/**
 * "The transaction returned ok" is a claim about a CALL, not about a world.
 *
 * `storedFeedbackDays` high with `progressionHistoryEntries` at zero is the
 * signature of a history the app cannot see, and every conclusion drawn about
 * block 2 in that state is worthless.
 */
export interface JourneyCensus {
  storedFeedbackDays: number;
  feedbackWithStrengthLogs: number;
  progressionHistoryEntries: number;
  storedSorenessAnswers: number;
  weightOverrideDays: number;
  weightOverrideEntries: number;
  recordedSelectionCount: number;
  activeExclusions: number;
}

export function takeCensus(asOfISO: string): JourneyCensus {
  const state = useProgramStore.getState() as unknown as {
    sessionFeedback: Record<string, { strength?: unknown[]; soreness?: string | null }>;
    weightOverrides: Record<string, Record<string, number | null>>;
  };
  const feedbackMap = state.sessionFeedback ?? {};
  const entries = Object.values(feedbackMap);
  const overrides = state.weightOverrides ?? {};
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getAthleteExclusions } = require('../../store/athletePreferencesStore');
  return {
    storedFeedbackDays: entries.length,
    feedbackWithStrengthLogs: entries.filter((e) => (e.strength?.length ?? 0) > 0).length,
    progressionHistoryEntries: quiet(() => buildStrengthWorkoutHistoryFromFeedback(
      feedbackMap as never, asOfISO,
    )).length,
    storedSorenessAnswers: entries.filter((e) => e.soreness != null && e.soreness !== 'none').length,
    weightOverrideDays: Object.keys(overrides).length,
    weightOverrideEntries: Object.values(overrides)
      .reduce((total, day) => total + Object.keys(day ?? {}).length, 0),
    recordedSelectionCount: useBlockSelectionHistoryStore.getState().selections.length,
    activeExclusions: (getAthleteExclusions() as unknown[]).length,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// RESTART
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A REAL RELAUNCH, not a JSON round-trip.
 *
 * **The program is never persisted** — `programStore.partialize` writes inputs
 * only, so a relaunch is a full REGENERATION plus a decision-ledger replay
 * (`quiescentBoot.rebuildDerivedWorld`). That is why "survives restart" here
 * means the regenerated week says the same thing, and why a generation defect
 * re-executes on every single launch rather than being frozen into a stored week.
 *
 * The persisted envelope is snapshotted and restored around the store reset so
 * the relaunch starts from the emptiness a real process death leaves, exactly as
 * `tracing-the-six-lifecycle-boundaries-headlessly` records.
 */
export async function relaunchApp(args: {
  storage: Map<string, string>;
  todayISO: string;
}): Promise<{ ok: boolean; error: string | null }> {
  setJourneyClock(args.todayISO);
  // THE APP GETS TO FINISH SAVING FIRST. A relaunch that snapshots storage with
  // writes still pending is not modelling a restart, it is modelling a crash —
  // and it would report unflushed state as lost persistence, which is a different
  // (and much rarer) defect. Crash-loss is worth its own tape; this is not it.
  await quietAsync(() => flushPendingStorageWrites());
  const snapshot = new Map(args.storage);

  // ⚠ **THE ORDER OF THESE THREE STEPS IS THE WHOLE FIDELITY OF THE SIMULATION,
  // AND GETTING IT WRONG MANUFACTURED A PERSISTENCE DEFECT THAT DOES NOT EXIST.**
  //
  // Emptying the stores is how a process death is modelled — but every store that
  // empties PERSISTS ITS EMPTINESS, and those writes are queued and tracked, not
  // synchronous. The first version of this function restored the disk snapshot
  // immediately after the reset, so the reset's own empty writes drained
  // afterwards and overwrote it. The journey then reported that nineteen days of
  // recorded training never reached disk. **It had: measured 19 on disk
  // immediately before the relaunch, through the real owner.** The loss was
  // entirely this ordering.
  //
  // So: empty the stores, let their writes SETTLE, and only then restore what the
  // real process death actually left behind. After this point nothing else may
  // write before hydration reads.
  resetStoresToFreshInstall('athlete-journey:relaunch');
  await quietAsync(() => flushPendingStorageWrites());
  args.storage.clear();
  for (const [key, value] of snapshot) args.storage.set(key, value);

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PERSISTED_STORE_HYDRATION_REGISTRY } = require('../../store/appHydrationGate');
  for (const entry of PERSISTED_STORE_HYDRATION_REGISTRY as { rehydrate: () => unknown }[]) {
    await quietAsync(async () => { await entry.rehydrate(); });
  }

  // WHAT SURVIVED THE PROCESS DEATH, read BEFORE boot regenerates anything. This
  // is the line that separates "persistence dropped it" from "boot ignored it".
  // WHAT SURVIVED THE PROCESS DEATH, read BEFORE boot regenerates anything. This
  // is the line that separates "persistence dropped it" from "boot ignored it".
  for (const [key, value] of args.storage) {
    if (!/program/i.test(key)) continue;
    const inputs = (JSON.parse(value) as { state?: { inputs?: Record<string, unknown> } })
      ?.state?.inputs;
    console.log('    [relaunch] restored accepted blocks: '
      + `${JSON.stringify(inputs?.acceptedBlocks ?? null)}`);
  }
  for (const [key, value] of args.storage) {
    if (!/program/i.test(key)) continue;
    const inputs = (JSON.parse(value) as { state?: { inputs?: Record<string, any> } })
      ?.state?.inputs;
    console.log('    [relaunch] ENVELOPE: sessionFeedback days='
      + `${Object.keys(inputs?.sessionFeedback ?? {}).length} `
      + `weightOverride days=${Object.keys(inputs?.weightOverrides ?? {}).length}`);
  }
  const live = useProgramStore.getState() as unknown as {
    sessionFeedback?: Record<string, unknown>;
    weightOverrides?: Record<string, unknown>;
    acceptedBlocks?: Record<string, unknown>;
    blockState: unknown;
  };
  console.log('    [relaunch] LIVE STORE after rehydrate: sessionFeedback days='
    + `${Object.keys(live.sessionFeedback ?? {}).length} `
    + `weightOverride days=${Object.keys(live.weightOverrides ?? {}).length} `
    + `acceptedBlocks=${Object.keys(live.acceptedBlocks ?? {}).length} `
    + `blockState=${JSON.stringify(live.blockState)}`);

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { runQuiescentBoot } = require('../../store/quiescentBoot');
  try {
    await quietAsync(() => runQuiescentBoot());
    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
