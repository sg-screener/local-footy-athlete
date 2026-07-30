/**
 * MOVE SCOPING AND REFUSAL — the empty "Move to:" list.
 *
 * Device finding (Sam, 2026-07-29): tapping "Move this session" on a combined
 * day (Thu Upper Push + Team Training) opened a picker with no destinations and
 * no explanation. A dead end.
 *
 * The producer was doing exactly what it was written to do: a source day
 * carrying ANY protected anchor returned `[]` for the whole destination list,
 * and `planChangeProducerTests` [17] pinned that empty list as correct. The
 * sheet mapped over the empty array and rendered a heading with nothing under
 * it. The suite's core invariant — "every offered option validates" — passed
 * VACUOUSLY, because a loop over zero destinations makes zero assertions.
 *
 * Sam's rulings (2026-07-30):
 *   * direction (b): a typed refusal travels WITH the list, and the sheet
 *     renders the plain-language reason. Never a dead-end empty picker.
 *   * session-scoped Move: on a combined day, move just the gym session. Team
 *     training stays anchored. Same scoping Bin already has, and destinations
 *     evaluate against the MOVED SESSION rather than the whole day.
 *
 * Run: npm run test:move-scoping
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
process.env.TZ = 'Australia/Melbourne';

import { readFileSync } from 'fs';
import { join } from 'path';
import type { OnboardingData, TrainingProgram, Workout } from '../types/domain';
import type { ResolvedDay } from '../utils/sessionResolver';
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
import {
  applyPlanChange,
  listPlanChangeOptionsForDay,
  planChangeMoveOptionsAreConsistent,
} from '../utils/planChangeProducer';

const CURRENT_WEEK = '2026-07-13';

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
    console.error(`  FAIL ${name}`, error instanceof Error ? error.message : error);
  }
}

function quiet<T>(body: () => T): T {
  const warn = console.warn;
  const error = console.error;
  const debug = console.debug;
  console.warn = () => undefined;
  console.error = () => undefined;
  console.debug = () => undefined;
  try {
    return body();
  } finally {
    console.warn = warn;
    console.error = error;
    console.debug = debug;
  }
}

function profile(): OnboardingData {
  return {
    seasonPhase: 'In-season',
    position: 'inside_mid',
    motivation: 'Build strength and football fitness',
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    teamTrainingDuration: '60-90 minutes',
    teamTrainingIntensity: 'Hard',
    trainingLocation: 'Commercial gym',
    equipment: ['Full Gym'],
    equipmentSelectionCompleteness: 'complete',
    experienceLevel: 'Advanced',
    squatStrength: '1.5x bodyweight',
    benchStrength: '1.25x bodyweight',
    conditioningLevel: 'Good',
    sprintExposure: '2+ times per week',
    recentTrainingLoad: 'Very consistent',
    injuries: [],
    usualGameDay: 'Saturday',
    gameDay: 'Saturday',
  } as unknown as OnboardingData;
}

function addDaysISO(dateISO: string, days: number): string {
  const date = new Date(`${dateISO}T12:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function seed(): string {
  const athlete = profile();
  const program: TrainingProgram = quiet(() => generateProgramLocally(athlete, {
    todayISO: CURRENT_WEEK,
    previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1,
      selectedPhase: athlete.seasonPhase!,
      phaseEntryWeekStartISO: CURRENT_WEEK,
      originProvenance: 'explicit_user_phase_change',
      persistenceProvenance: 'preserved_persisted_state',
    },
  }));
  useProfileStore.setState({ onboardingData: athlete, isOnboardingComplete: true });
  useCalendarStore.setState({ markedDays: {}, selectedDate: null } as never);
  useReadinessStore.setState({ signalsByDate: {} } as never);
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null } as never);
  useCoachMutationHistoryStore.setState({ entries: [] } as never);
  useProgramStore.setState({
    currentProgram: program,
    currentMicrocycle: program.microcycles[0] ?? null,
    todayWorkout: null,
    isGenerating: false,
    isLoading: false,
    error: null,
    blockState: null,
    acceptedMaterialContext: {
      markedDays: {},
      readinessSignalsByDate: {},
      activeConstraints: [],
      activeInjury: null,
      revision: 1,
      lastTransaction: 'move-scoping-test:seed',
      injuryEpisodes: [],
      temporarySourceFacts: [],
      acceptedCompositionBase: null,
      acceptedProfileSnapshot: null,
    },
    dateOverrides: {},
    overrideContexts: {},
    weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {},
    sessionFeedback: {},
    weightOverrides: {},
  } as never);
  return program.microcycles[1]!.startDate.slice(0, 10);
}

function visibleWeek(weekStart: string): ResolvedDay[] {
  return quiet(() => resolveWeekWithConditioning(weekStart, buildScheduleStateImperative()));
}

function optionsFor(weekStart: string, date: string) {
  return listPlanChangeOptionsForDay({
    visibleWeek: visibleWeek(weekStart),
    date,
    todayISO: weekStart,
  });
}

/** The combined day the device finding was reported on: gym work + team training. */
function combinedDay(weekStart: string): { date: string; workout: Workout } {
  const thursday = addDaysISO(weekStart, 3);
  const day = visibleWeek(weekStart).find((entry) => entry.date === thursday);
  assert(day?.workout, 'seed no longer has a Thursday session');
  assert(/team training/i.test(day.workout.name),
    `Thursday is "${day.workout.name}", not a combined team day — this seed no longer exercises the finding`);
  return { date: thursday, workout: day.workout };
}

console.log('\n-- Plan-change move scoping and refusal --');

// ── The reported dead end ────────────────────────────────────────────────

run('a combined day never offers an empty destination list', () => {
  const weekStart = seed();
  const { date } = combinedDay(weekStart);
  const move = optionsFor(weekStart, date).move;
  if (!move.refusal) {
    assert(move.scopes.length > 0, 'move reported ok with no scopes at all');
    for (const scope of move.scopes) {
      assert(scope.destinations.length > 0,
        `scope "${scope.id}" was offered with an empty destination list — the dead end`);
    }
  } else {
    assert(move.refusal.message.length > 0 && !/_/.test(move.refusal.message),
      `refusal reached the athlete as a raw code: "${move.refusal.message}"`);
  }
});

run('the gym session on a combined day IS movable, and team training is not', () => {
  const weekStart = seed();
  const { date } = combinedDay(weekStart);
  const move = optionsFor(weekStart, date).move;
  assert(!move.refusal, `combined day refused all moves: ${move.refusal?.message ?? ''}`);
  const ids = move.scopes.map((scope) => scope.id);
  assert(ids.includes('strength'),
    `no strength scope offered on a combined day; got ${JSON.stringify(ids)}`);
  assert(!ids.includes('whole_day'),
    'whole-day move offered on an anchored day — that would take team training with it');
  assert(!ids.some((id) => String(id) === 'team'),
    'team training was offered as movable; it is an anchor');
});

// ── Sam's doubling law (2026-07-30): a team night is a legal destination ──
//
// His re-test, step 6: moving a session onto Thursday failed with a generic
// "nothing on your plan changed. Try again" — advice that could never work,
// because the commit door refused every anchored destination outright.
//
// The ruling REVERSES that. Moving a session onto a team-training day is legal
// and lands as a COMBINED day — the exact shape generation itself produces
// ("Team Training + Upper Push"): one hard day, two sessions, per the doubling
// law. Refusals stay only where a real law bites — hard-day budget, the G-1
// ask, game day locked — each with its own honest copy, never a blanket "not
// onto team training".

run('a team night is offered as a move destination', () => {
  const weekStart = seed();
  const monday = addDaysISO(weekStart, 0);
  const { date: teamDay } = combinedDay(weekStart);
  const move = optionsFor(weekStart, monday).move;
  assert(!move.refusal, `a plain day refused all moves: ${move.refusal?.message ?? ''}`);

  const offered = move.scopes.flatMap((scope) =>
    scope.destinations.map((destination) => destination.date));
  assert(offered.includes(teamDay),
    `the team night ${teamDay} is not offered as a destination: ${JSON.stringify(offered)}`);
});

run('game day is still never a destination', () => {
  // Non-vacuity, and the boundary of the ruling: the doubling law is about
  // training days. Game day stays locked.
  const weekStart = seed();
  const monday = addDaysISO(weekStart, 0);
  const saturday = addDaysISO(weekStart, 5);
  const move = optionsFor(weekStart, monday).move;
  const offered = move.scopes.flatMap((scope) =>
    scope.destinations.map((destination) => destination.date));
  assert(!offered.includes(saturday),
    'game day was offered as a move destination');
});

run('moving onto a team night lands a combined day, keeping the anchor', () => {
  const weekStart = seed();
  const monday = addDaysISO(weekStart, 0);
  const { date: teamDay } = combinedDay(weekStart);
  const source = visibleWeek(weekStart).find((day) => day.date === monday)?.workout;
  assert(source, 'seed no longer has a Monday session to move');

  const result = quiet(() => applyPlanChange({
    change: { kind: 'move_session', fromDate: monday, toDate: teamDay },
    visibleWeek: visibleWeek(weekStart),
    todayISO: weekStart,
    setManualOverride: (date, workout, context) =>
      useProgramStore.getState().setManualOverride(date, workout, context),
  }));
  assert(result.ok,
    `the doubling law's own shape was refused: "${result.message}" `
    + `${JSON.stringify(result.rejected)}`);

  const landed = visibleWeek(weekStart).find((day) => day.date === teamDay)?.workout;
  assert(landed, 'the team night is empty after the move');
  assert(/team training/i.test(landed.name),
    `the move took the team anchor off the day: "${landed.name}"`);
  assert(landed.name.length > 'Team Training'.length,
    `the day names only the anchor, not the session that landed: "${landed.name}"`);
  assert(!visibleWeek(weekStart).find((day) => day.date === monday)?.workout,
    'the source day was not vacated');
});

run('a plain day still offers the whole-day move it always did', () => {
  const weekStart = seed();
  const monday = addDaysISO(weekStart, 0);
  const move = optionsFor(weekStart, monday).move;
  assert(!move.refusal, 'a plain strength day refused all moves');
  const whole = move.scopes.find((scope) => scope.id === 'whole_day');
  assert(whole, `no whole_day scope on a plain day; got ${JSON.stringify(move.scopes.map((s) => s.id))}`);
  assert(whole.destinations.length > 0, 'whole-day move offered no destinations');
});

run('a rest day refuses in plain language rather than offering an empty picker', () => {
  const weekStart = seed();
  // THE CELL IS ABOUT A REST DAY, NOT ABOUT WEDNESDAY.
  //
  // It named Wednesday, which was empty only because the §18 gateway used to
  // DELETE the generator's optional accessory work there to manufacture a rest
  // day. Sam's Rest law (2026-07-30) stops that, so Wednesday now carries the
  // athlete's accessory session and the cell was asserting a fixture accident.
  // Finding the rest day keeps the subject and survives the week's shape moving.
  const restDay = visibleWeek(weekStart).find((day) => !day.workout);
  assert(restDay, 'this seed has no rest day at all, so the refusal cannot be observed');
  const move = optionsFor(weekStart, restDay.date).move;
  assert(move.refusal, 'a rest day offered a move');
  assert(move.refusal.reason === 'no_session',
    `rest day refused with "${move.refusal.reason}"`);
  assert(move.refusal.message.length > 0 && !/_/.test(move.refusal.message),
    `refusal reached the athlete as a raw code: "${move.refusal.message}"`);
});

// ── The scoped move actually applies ─────────────────────────────────────

run('moving the gym session off a combined day leaves team training behind', () => {
  const weekStart = seed();
  const { date } = combinedDay(weekStart);
  const move = optionsFor(weekStart, date).move;
  assert(!move.refusal, 'combined day refused all moves');
  const strength = move.scopes.find((scope) => scope.id === 'strength');
  assert(strength, 'no strength scope to move');
  const destination = strength.destinations[0];
  assert(destination, 'strength scope had no destination');

  const result = quiet(() => applyPlanChange({
    change: {
      kind: 'move_session',
      fromDate: date,
      toDate: destination.date,
      scope: 'strength',
    },
    visibleWeek: visibleWeek(weekStart),
    todayISO: weekStart,
    setManualOverride: (overrideDate, workout, context) =>
      useProgramStore.getState().setManualOverride(overrideDate, workout, context),
  }));
  assert(result.ok, `scoped move refused: ${result.message}`);

  const after = visibleWeek(weekStart);
  const source = after.find((day) => day.date === date)?.workout;
  const target = after.find((day) => day.date === destination.date)?.workout;
  assert(source, 'the combined day was emptied — team training went with the gym session');
  assert(/team training/i.test(source.name),
    `the anchor did not stay put; source day is now "${source.name}"`);
  assert(target, `the destination ${destination.date} is empty after the move`);
  assert(!/team training/i.test(target.name),
    `team training was relocated to ${destination.date} as "${target.name}"`);
});

// ── The invariant that used to pass vacuously ────────────────────────────

run('every day in the week either offers a usable move or refuses with a reason', () => {
  const weekStart = seed();
  let scopesChecked = 0;
  for (const day of visibleWeek(weekStart)) {
    const options = optionsFor(weekStart, day.date);
    if (options.locked !== null) continue;
    const move = options.move;
    if (!move.refusal) {
      assert(move.scopes.length > 0, `${day.date}: move ok with zero scopes`);
      for (const scope of move.scopes) {
        assert(scope.destinations.length > 0,
          `${day.date}: scope "${scope.id}" offered with no destinations`);
        assert(scope.label.length > 0, `${day.date}: scope "${scope.id}" has no label`);
        scopesChecked += 1;
      }
    } else {
      assert(move.refusal.message.length > 0 && !/_/.test(move.refusal.message),
        `${day.date}: refusal is a raw code "${move.refusal.message}"`);
    }
  }
  // Non-vacuity: the loop above is exactly the shape that passed while the
  // device was showing an empty picker. It must actually have inspected
  // something.
  assert(scopesChecked > 0,
    'no movable scope was inspected — this invariant is passing vacuously again');
});

run('emptiness and refusal are the same fact, both directions, on every day', () => {
  const weekStart = seed();
  let refusals = 0;
  let offers = 0;
  for (const day of visibleWeek(weekStart)) {
    const move = optionsFor(weekStart, day.date).move;
    assert(planChangeMoveOptionsAreConsistent(move),
      `${day.date}: scopes and refusal disagree — ${JSON.stringify(move)}`);
    if (move.refusal) refusals += 1; else offers += 1;
  }
  // Non-vacuity in both directions: a week that only refused, or only offered,
  // would satisfy the predicate above without exercising it.
  assert(refusals > 0 && offers > 0,
    `this week only produced ${refusals} refusals and ${offers} offers`);
});

// ── The sheet renders the refusal, never a bare empty list ───────────────

run('the sheet has no path that renders a destination list without its refusal', () => {
  const sheet = readFileSync(
    join(__dirname, '..', 'screens', 'home', 'PlanChangeSheet.tsx'),
    'utf8',
  );
  assert(!/options\.moveDestinations/.test(sheet),
    'the sheet still reads the old untyped moveDestinations array');
  assert(/refusal/.test(sheet),
    'the sheet never mentions the typed move refusal, so it cannot render one');
});

run('the sheet never commits a move scope the athlete was never shown', () => {
  // SAM'S FINDING 3, second half. The producer no longer offers a bare
  // `whole_day` on a multi-session day, but the sheet's own shortcut could
  // reintroduce the same outcome: one offered scope skipped straight to
  // destinations, so "move the gym session" committed a whole-day move the
  // athlete never saw named.
  //
  // A source contract, not a render one: there is no mounted-render path in
  // this repo, and this is control flow rather than layout — which is the
  // half of a screen source reading CAN hold honestly.
  const sheet = readFileSync(
    join(__dirname, '..', 'screens', 'home', 'PlanChangeSheet.tsx'),
    'utf8',
  );
  const start = sheet.indexOf('const startMove');
  const end = sheet.indexOf('const startBin');
  assert(start > 0 && end > start, 'startMove no longer exists in the sheet');
  const startMove = sheet.slice(start, end);
  assert(/scopes\.length === 1/.test(startMove),
    'the move entry point no longer decides anything about a single scope');
  assert(/scopes\.length === 1\s*&&[^)]*visibleSessionCount/.test(startMove),
    'the scope step is skipped on a single offered scope ALONE — on a day the app '
    + 'renders as two sessions that commits a move the athlete was never shown');
});

console.log(`\nMove scoping totals: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
