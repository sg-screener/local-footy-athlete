/**
 * A DERIVED REPAIR NEVER LANDS ON THE ATHLETE'S SURFACE.
 *
 * `dateOverrides` is the athlete's decision surface — `rebaseAcceptedEffective-
 * Week` says so in its own comment, and the whole precedence stack is built on
 * it meaning that. A §18 accepted-week gateway repair is authored by the
 * gateway, not by the athlete, so it belongs in the week overlay, which already
 * means "derived content for this week, authored by a fact".
 *
 * WHY THIS SUITE EXISTS. Three actions from a fresh install — onboard, generate,
 * mark ONE day as rest — and the program tab prescribed a strength session on the
 * day the athlete said he was resting, while the accepted week correctly held
 * nothing there. `canonicaliseAcceptedStateCandidate` wrote the gateway's repair
 * into `dateOverrides` whenever the week had no overlay to put it in: one rest
 * mark materialised FIVE overrides, one of them on the rest day itself. The split
 * followed because the two resolvers order the same two inputs oppositely —
 * `_resolveDateRaw` puts a manual override at Priority 1 ABOVE the calendar mark,
 * `rebaseAcceptedEffectiveWeek` composes the override and applies the marks LAST.
 *
 * It also cost two device findings. `stageAthleteSessionMoveTransaction` compares
 * accepted against visible on a move's destination and refuses when they
 * disagree; it was refusing correctly about a day that disagreed with itself,
 * and the move door wore the blame for a whole session.
 *
 * THE CLASS THIS CATCHES, not the instance: any transaction that repairs a week
 * and files the repair under the athlete. Asserted as an ownership invariant over
 * the surface — "no override the athlete did not author" — rather than as a count
 * or a named date, so a different mark, a different repair or a different week
 * fails it the same way.
 *
 * Run: npm run test:derived-repair-ownership
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
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
  throw new Error('NETWORK DISABLED — derived-repair ownership is an on-device law');
};
process.env.TZ = 'Australia/Melbourne';

import type { TrainingProgram, Workout } from '../types/domain';
import type { ResolvedDay } from '../utils/sessionResolver';
import type { PlanChange } from '../utils/planChangeTypes';
import { generateProgramLocally } from '../services/api/generateProgram';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { useCoachMutationHistoryStore } from '../store/coachMutationHistoryStore';
import { createEmptyReversibleAdjustmentLedger } from '../rules/reversibleAdjustmentLedger';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { rebaseAcceptedEffectiveWeek } from '../rules/acceptedEffectiveWeek';
import { applyPlanChange } from '../utils/planChangeProducer';
import {
  samExport8Profile,
  SAM_EXPORT_8_TODAY_ISO,
  SAM_EXPORT_8_CURRENT_WEEK,
} from './support/samDeviceExport8Fixture';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

function run(name: string, body: () => void): void {
  try {
    body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failed += 1;
    failures.push(name);
    console.error(`  FAIL ${name}\n      ${error instanceof Error ? error.message : error}`);
  }
}

function quiet<T>(body: () => T): T {
  const warn = console.warn; const error = console.error;
  const debug = console.debug; const info = console.info; const log = console.log;
  console.warn = () => undefined; console.error = () => undefined;
  console.debug = () => undefined; console.info = () => undefined;
  console.log = () => undefined;
  try { return body(); } finally {
    console.warn = warn; console.error = error;
    console.debug = debug; console.info = info; console.log = log;
  }
}

const TODAY = SAM_EXPORT_8_TODAY_ISO;
const WEEK = SAM_EXPORT_8_CURRENT_WEEK;

/** Fresh install, his answers, generate. No marks yet — the athlete has decided nothing. */
function freshInstallAndGenerate(): void {
  localStorageData.clear();
  const profile = samExport8Profile();
  useProfileStore.setState({ onboardingData: profile, isOnboardingComplete: true });
  useCalendarStore.setState({ markedDays: {}, selectedDate: null } as never);
  useReadinessStore.setState({ signalsByDate: {} } as never);
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null } as never);
  useCoachMutationHistoryStore.setState({ entries: [] } as never);
  const program = quiet(() => generateProgramLocally(profile, {
    todayISO: '2026-07-13', previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1, selectedPhase: 'Pre-season', phaseEntryWeekStartISO: '2026-07-13',
      originProvenance: 'explicit_user_phase_change',
      persistenceProvenance: 'preserved_persisted_state',
    },
  })) as TrainingProgram;
  const week = program.microcycles.find((cycle) => cycle.startDate.slice(0, 10) === WEEK) ?? null;
  assert(week, 'the generated program does not contain the week under test');
  useProgramStore.setState({
    currentProgram: program, currentMicrocycle: week,
    todayWorkout: null, isGenerating: false, isLoading: false, error: null, blockState: null,
    acceptedMaterialContext: {
      markedDays: {}, readinessSignalsByDate: {}, activeConstraints: [], activeInjury: null,
      revision: 1, lastTransaction: 'derived-repair-ownership:generate',
      injuryEpisodes: [], temporarySourceFacts: [],
      acceptedCompositionBase: null, acceptedProfileSnapshot: null,
    },
    dateOverrides: {}, overrideContexts: {}, weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {}, sessionFeedback: {}, weightOverrides: {},
  } as never);
}

function overrideDates(): string[] {
  return Object.keys((useProgramStore.getState() as unknown as {
    dateOverrides: Record<string, Workout>;
  }).dateOverrides ?? {}).sort();
}

function visibleWeek(week: string = WEEK): ResolvedDay[] {
  return quiet(() => resolveWeekWithConditioning(week, buildScheduleStateImperative()));
}

/** Days where the screen and the accepted week disagree about what is on them. */
function workoutIdentity(workout: Workout | null | undefined): string | null {
  return workout ? workout.planEntryId ?? workout.id : null;
}

function splitDays(week: string = WEEK): string[] {
  const state = useProgramStore.getState() as never;
  const profile = useProfileStore.getState().onboardingData;
  const identity = workoutIdentity;
  const accepted = quiet(() => rebaseAcceptedEffectiveWeek({
    surfaces: state,
    weekStart: week,
    profile,
    markedDays: (useProgramStore.getState().acceptedMaterialContext).markedDays,
  }));
  const split: string[] = [];
  for (const day of visibleWeek(week)) {
    const dayOfWeek = new Date(`${day.date}T12:00:00`).getDay();
    const acceptedWorkout = accepted.visibleWorkouts.find((workout) =>
      workout.dayOfWeek === dayOfWeek) ?? null;
    if (identity(acceptedWorkout) !== identity(day.workout)) split.push(day.date);
  }
  return split;
}

console.log('\n-- Derived repair ownership --');

run('a calendar mark writes no override the athlete did not author', () => {
  freshInstallAndGenerate();
  assert(overrideDates().length === 0,
    `generation alone already wrote overrides: ${JSON.stringify(overrideDates())}`);

  // ONE rest mark, through the real calendar door. The athlete has made exactly
  // one decision and it is not "put a session on 2026-07-28".
  quiet(() => useCalendarStore.getState().setRestDay('2026-07-28'));

  assert(overrideDates().length === 0,
    'marking ONE day as rest materialised date overrides on the athlete\'s own '
    + `surface: ${JSON.stringify(overrideDates())}. A §18 gateway repair is `
    + 'derived content and belongs in the week overlay; `dateOverrides` means '
    + 'athlete decisions.');
});

run('the screen honours the rest mark the accepted week honours', () => {
  freshInstallAndGenerate();
  quiet(() => useCalendarStore.getState().setRestDay('2026-07-28'));

  const rested = visibleWeek().find((day) => day.date === '2026-07-28');
  assert(!rested?.workout,
    `the athlete marked 2026-07-28 as rest and the screen still prescribes `
    + `"${rested?.workout?.name}" on it`);
  assert(splitDays().length === 0,
    'the screen and the accepted week disagree about '
    + `${JSON.stringify(splitDays())} — one week, two answers. A manual override `
    + 'outranks a calendar mark on the screen and is outranked by it in the '
    + 'accepted week, so any override the athlete did not author splits them.');
});

/**
 * Author an override the way the surface's own writer does.
 *
 * DELIBERATELY NOT through a plan-change door. The typed add path now goes
 * through the constraint ingress rather than the override surface (see the
 * occupied-day add unit), so an add proves nothing about `dateOverrides` — the
 * first draft of these two tests asserted an add would land there and failed for
 * a reason that had nothing to do with the law. `setManualOverride` is the
 * writer that surface actually has, and it is what the sheet hands every
 * producer as `setManualOverride`.
 */
function authorAnOverride(date: string): Workout {
  // The day's OWN session, re-authored under the athlete's name. Renaming what
  // is already there keeps every §18 count identical, so the suite asserts
  // ownership rather than accidentally asserting that the week survives an extra
  // strength day — the first draft cloned another day's session onto this one
  // and was rejected for `maximum_breach:main_strength:5`, which is the contract
  // working and had nothing to say about who owns the surface.
  const source = visibleWeek().find((day) => day.date === date)?.workout;
  assert(source, `${date} has no session to re-author`);
  const authored: Workout = {
    ...JSON.parse(JSON.stringify(source)) as Workout,
    id: `athlete-authored-${date}`,
    planEntryId: `athlete-authored-${date}`,
  };
  quiet(() => useProgramStore.getState().setManualOverride(date, authored));
  return authored;
}

run('an override the athlete DID author still outranks the derived plan', () => {
  // The law is about AUTHORSHIP, not about emptying the surface. A fix that
  // simply stopped writing to `dateOverrides` would pass the two tests above and
  // break every athlete edit in the app, so the surface is proved still to work.
  freshInstallAndGenerate();
  const authored = authorAnOverride('2026-07-30');

  assert(overrideDates().includes('2026-07-30'),
    'the athlete authored a session and no athlete-owned override records it — '
    + 'the decision surface has to keep working for decisions');
  const shown = visibleWeek().find((day) => day.date === '2026-07-30');
  assert(workoutIdentity(shown?.workout) === workoutIdentity(authored),
    "the athlete's own override is not what the screen shows — authored "
    + `"${workoutIdentity(authored)}", screen "${workoutIdentity(shown?.workout)}"`);
  assert(splitDays().length === 0,
    'an athlete-authored edit split the screen from the accepted week on '
    + `${JSON.stringify(splitDays())}`);
});

run('a rest mark on a week the athlete has already edited keeps his edit', () => {
  // THE COMBINATION CELL — an authored override AND a later calendar mark on the
  // same week. Moving the repair to the overlay must not walk over an override
  // that IS the athlete's: the branch updating an existing override is the one
  // case where writing to that surface is correct, and this is the cell that
  // separates "the repair moved" from "the write was deleted".
  freshInstallAndGenerate();
  authorAnOverride('2026-07-30');
  const authored = overrideDates();

  quiet(() => useCalendarStore.getState().setRestDay('2026-07-28'));

  assert(overrideDates().includes('2026-07-30'),
    "a later calendar mark discarded the athlete's own override — "
    + `${JSON.stringify(authored)} became ${JSON.stringify(overrideDates())}`);
  assert(overrideDates().every((date) => authored.includes(date)),
    'the calendar mark added overrides the athlete never authored: '
    + `${JSON.stringify(overrideDates().filter((date) => !authored.includes(date)))}`);
  const rested = visibleWeek().find((day) => day.date === '2026-07-28');
  assert(!rested?.workout,
    `the rest mark did not empty 2026-07-28 — the screen shows "${rested?.workout?.name}"`);
  assert(splitDays().length === 0,
    `screen and accepted week disagree on ${JSON.stringify(splitDays())}`);
});

console.log(`\nDerived repair ownership totals: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
