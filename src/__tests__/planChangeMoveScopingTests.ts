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


import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import { readFileSync } from 'fs';
import { join } from 'path';
import type { OnboardingData, TrainingProgram, Workout } from '../types/domain';
import type { ResolvedDay } from '../utils/sessionResolver';
import { seedManualOverride } from './support/programOverrideHarness';
import { generateProgramLocally } from '../services/api/generateProgram';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { createEmptyReversibleAdjustmentLedger } from '../rules/reversibleAdjustmentLedger';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import {
  applyPlanChange,
  listPlanChangeOptionsForDay,
  planChangeMoveOptionsAreConsistent,
  removeEmptiesTheDay,
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
    firstName: 'Sam',
    gender: 'male',
    heightCm: 184,
    weightKg: 90,
    twoKmTimeTrial: '08:00',
    seasonPhase: 'In-season',
    position: 'inside_mid',
    motivation: 'Build strength and football fitness',
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    teamTrainingDuration: '60-90 minutes',
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

/**
 * A day whose ONLY content is the session on it — the fixture the two Remove
 * sub-line cells below are about.
 *
 * It ASKS the seed rather than naming a weekday, and that is a repair rather
 * than a convenience. Both cells hardcoded Monday, which was sole-content when
 * they were written. Sam's flush-offer ruling landed on 2026-08-06 and the
 * in-season week now carries its authored offer as a component on the first
 * fixture-safe strength day — Monday — so Monday became a two-part day and the
 * cells could no longer build the shape they assert about. Nothing about the
 * CLAIM changed; the seed moved underneath it. Asking makes it unable to rot
 * that way again, and the assertion here fails loudly if the seed ever stops
 * producing such a day at all rather than passing on a shape it never built.
 */
function soleContentDay(weekStart: string): string {
  for (let offset = 0; offset < 7; offset++) {
    const date = addDaysISO(weekStart, offset);
    const options = optionsFor(weekStart, date);
    if (options.canRemove && removeEmptiesTheDay(options)) return date;
  }
  throw new Error('the seed no longer produces ANY sole-content day, so neither '
    + 'Remove sub-line cell can build its fixture');
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

run('the gym session on a combined day IS movable — and so is the anchor, through the ask', () => {
  // RE-POINTED by the team-night movability unit (Sam's 2026-08-01 ruling,
  // signed 2026-08-02): the anchor is no longer immovable — the `team` scope
  // is offered, and picking a destination raises the typed once-or-permanent
  // ask (`teamNightMovabilityTests` owns that gate). What still holds from
  // the old cell: whole_day is withheld (a whole-day move would silently
  // take the anchor), and the gym session moves on its own.
  const weekStart = seed();
  const { date } = combinedDay(weekStart);
  const move = optionsFor(weekStart, date).move;
  assert(!move.refusal, `combined day refused all moves: ${move.refusal?.message ?? ''}`);
  const ids = move.scopes.map((scope) => scope.id);
  assert(ids.includes('strength'),
    `no strength scope offered on a combined day; got ${JSON.stringify(ids)}`);
  assert(!ids.includes('whole_day'),
    'whole-day move offered on an anchored day — that would take team training with it');
  assert(ids.some((id) => String(id) === 'team'),
    `the team scope must be offered on a team night (signed ruling); got ${JSON.stringify(ids)}`);
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

run('strength landing on Team Training is explicitly a combine, never a swap', () => {
  const weekStart = seed();
  const monday = addDaysISO(weekStart, 0);
  const { date: teamDay } = combinedDay(weekStart);
  const move = optionsFor(weekStart, monday).move;
  assert(!move.refusal, `a plain day refused all moves: ${move.refusal?.message ?? ''}`);
  const destination = move.scopes
    .flatMap((scope) => scope.destinations)
    .find((entry) => entry.date === teamDay);
  assert(destination, `team night ${teamDay} was not offered`);
  assert(destination.placement === 'combine',
    `strength -> Team Training was described as ${destination.placement}, not combine`);
});

run('an occupied non-anchor destination can still be a swap', () => {
  const weekStart = seed();
  const sourceDate = soleContentDay(weekStart);
  const sourceWorkout = visibleWeek(weekStart)
    .find((day) => day.date === sourceDate)?.workout;
  const restDate = visibleWeek(weekStart)
    .find((day) => !day.workout)?.date;
  assert(sourceWorkout && restDate,
    'the seed no longer supplies the ordinary session + rest-day fixture');

  // Turn the rest day into an ordinary occupied destination. The live seed's
  // occupied days are all anchors, so without this explicit fixture the cell
  // would "prove" ordinary swapping by never reaching one.
  seedManualOverride(restDate, {
    ...sourceWorkout,
    id: 'ordinary-swap-target',
    name: 'Ordinary accessory session',
    dayOfWeek: new Date(`${restDate}T12:00:00`).getDay(),
  }, { intent: 'program_adjustment' });

  const move = optionsFor(weekStart, sourceDate).move;
  assert(!move.refusal, `a plain day refused all moves: ${move.refusal?.message ?? ''}`);
  const swap = move.scopes
    .flatMap((scope) => scope.destinations)
    .find((entry) => entry.date === restDate);
  assert(swap, `the occupied ordinary destination ${restDate} was not offered`);
  assert(swap.placement === 'swap',
    `an occupied ordinary destination was described as ${swap.placement}, not swap`);
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
    applyOverride: (date, workout, context) =>
      seedManualOverride(date, workout, context),
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
    applyOverride: (overrideDate, workout, context) =>
      seedManualOverride(overrideDate, workout, context),
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

// ── The Remove row's sub-line: one predicate, two signed sentences ────────
//
// SAM RULED, 2026-07-31 (copy sheet §6-IV-3, boundary question 4). Batch 3's
// "Remove it — anything else on the day stays." is FALSE on a day whose only
// content is the session being removed: the very next screen says the day becomes
// rest, and there is nothing else to stay. Batch 3's own principle — a signed
// sentence must never be able to lie — applied to itself. The ruling is a
// STATE-SELECTED variant, this unit's own pattern: a typed cause picks the
// sentence, exactly as `hasSession` picks the Swap row's disabled line.
//
// THESE TWO CELLS LIVE HERE, NOT IN `planChangeProducerTests`, BECAUSE THIS SUITE
// IS ARMED IN `test:bible` AND THAT ONE IS NOT. The same reasoning put the
// startMove source contract here (see the cell above): a law about what the
// athlete is told is worth nothing in a suite the build does not run.

run('one predicate decides whether removing this day empties it', () => {
  // THE BEHAVIOURAL HALF, over really-produced options rather than a hand-built
  // shape. `removeEmptiesTheDay` reads `binScopes`, which the producer already
  // computed, so the sentence the athlete reads and the removal that follows are
  // answering from one fact.
  const weekStart = seed();
  const plain = optionsFor(weekStart, soleContentDay(weekStart));
  const { date: combined } = combinedDay(weekStart);
  const multi = optionsFor(weekStart, combined);

  assert(plain.canRemove && multi.canRemove,
    'one of the two days cannot be removed from at all, so neither sentence is '
    + `reachable and this cell proves nothing (plain=${plain.canRemove}, multi=${multi.canRemove})`);
  assert(removeEmptiesTheDay(plain),
    'a day whose only content IS the session is reported as '
    + `having something that survives the removal; binScopes=${JSON.stringify(plain.binScopes.map((s) => s.id))}. `
    + 'It would read "anything else on the day stays" over a day about to become rest.');
  assert(plain.binScopes.length === 1 && plain.binScopes[0].id === 'whole_day',
    'the day this cell calls sole-content offers more than one bin scope, so the '
    + `predicate is agreeing with the wrong shape; binScopes=${JSON.stringify(plain.binScopes.map((s) => s.id))}`);
  // The combined day is the case that makes this more than a restatement of a
  // length: a team night offers its two parts and NO whole-day scope at all, so
  // removing either leaves the other standing.
  assert(!removeEmptiesTheDay(multi),
    'a combined team + gym day is reported as sole-content, so the Remove row would '
    + `promise the day becomes rest while the anchor stays put; binScopes=${JSON.stringify(multi.binScopes.map((s) => s.id))}`);
});

run('the row sub-line and the remove confirmation cannot disagree', () => {
  // THE SOURCE CONTRACT. Two signed sentences one tap apart make the SAME claim
  // about the SAME day; that is only safe while ONE fact decides both. A second
  // predicate answering "does this empty the day?" is precisely how the row and
  // the confirmation come to contradict each other — and a signed sentence lying
  // beside another signed sentence saying so is worse than either alone.
  //
  // Control flow and literal wording, which is the half a screen source reading
  // can hold honestly (same standing as the two cells above).
  const sheet = readFileSync(
    join(__dirname, '..', 'screens', 'home', 'PlanChangeSheet.tsx'),
    'utf8',
  );
  assert(/signedCopy\('plan_change\.remove_to_rest'\)/.test(sheet)
    && /'Remove it — anything else on the day stays\.'/.test(sheet),
    'both of Sam\'s signed Remove sub-lines are no longer in the sheet');
  assert(/removeEmptiesTheDay\(options\)\s*\n?\s*\?\s*signedCopy\('plan_change\.remove_to_rest'\)/.test(sheet),
    'the Remove row no longer selects its sub-line from removeEmptiesTheDay — if it '
    + 'derives the claim any other way it can contradict the confirmation');

  const startBin = sheet.slice(sheet.indexOf('const startBin'), sheet.indexOf('return ('));
  assert(startBin.length > 0, 'startBin no longer exists in the sheet');
  assert(/!removeEmptiesTheDay\(options\)/.test(startBin),
    'the scope picker is no longer gated on the same predicate as the sub-line');
  assert(/kind: 'confirm_remove'[\s\S]{0,80}label: null/.test(startBin),
    'startBin no longer sets `label: null` on the sole-scope path, which is what '
    + 'selects the "the day becomes rest" confirmation one tap later');
  assert(/step\.label === null\s*\n?\s*\?\s*'Are you sure\? This will be removed and the day becomes rest\.'/.test(sheet),
    'the confirmation no longer selects on `step.label === null`, so it and the row '
    + 'are answering from two different facts again');

  // AND NO SECOND DERIVATION. The sheet must ask the producer, never count for
  // itself — a `binScopes.length` anywhere here is the second predicate coming
  // back under a different name.
  assert(!/binScopes\.length/.test(sheet),
    'the sheet counts binScopes itself somewhere — that is the second predicate '
    + 'this cell exists to forbid');
});

run('the fifth Add/Swap row reads "Accessories"', () => {
  // SAM RULED, 2026-07-31 (copy sheet §6-IV-1): the fifth Add/Swap row is
  // "ACCESSORIES" — ruling 9's own word — wired to the `prehab` door with the
  // shield. The typed id stays `prehab`; only the word changed.
  //
  // IT IS PINNED HERE BECAUSE NOTHING ELSE CATCHES IT, and that was measured
  // rather than assumed. `copyRulingsBindingTests` passes with the old label
  // still in place: its PROPOSED direction asks whether the string appears
  // ANYWHERE in the scanned sources, and "Accessories" occurs in
  // `coachRevisionTemplates.ts`'s "Prehab & Accessories" and in this sheet's own
  // comments, so a substring search can never see the label revert. A one-word
  // label is exactly the shape that gate is blind to. This asserts the produced
  // option — what the row actually renders — instead.
  const weekStart = seed();
  const options = optionsFor(weekStart, addDaysISO(weekStart, 0));
  const prehab = options.categories.find((category) => category.id === 'prehab');
  assert(prehab,
    'the `prehab` door is not offered on a plain day at all, so the label this cell '
    + `pins is unreachable; offered: ${JSON.stringify(options.categories.map((c) => c.id))}`);
  assert(prehab.label === 'Accessories',
    `the fifth Add/Swap row reads "${prehab.label}". Sam signed "Accessories" on `
    + '2026-07-31; the door id stays `prehab` because ids are not copy.');
  assert(prehab.sub === 'Groin, calves, midline, shoulders - the armour work',
    `the row's sub-line changed to "${prehab.sub}" — it was signed as written and `
    + 'describes the door whichever noun heads the row');
});

// ── The row sub-line and the whole-day scope confirm can still disagree ──
//
// POST-UNIT REVIEW FINDING, 2026-07-31 — open question, copy sheet §6-VI. Not a
// regression of 6-IV-3; a state 6-IV-3's ruling did not name. `removeEmptiesTheDay`
// is a binary (sole-content vs multi-content), but `binScopesForSnapshot`
// (`planChangeProducer.ts:846-862`) has a third shape: an UNANCHORED day carrying
// two-plus section kinds returns `[...parts, WHOLE_DAY_SCOPE]` — more than one
// part (so `removeEmptiesTheDay` is FALSE, and the row reads "anything else on
// the day stays"), but a "Whole day" scope is offered anyway, because nothing
// anchors the day and removing everything is a legal choice. Picking it sets
// `label: null` (`PlanChangeSheet.tsx:973`), which the confirmation reads as "the
// day becomes rest" (`:985`) — the sole-content sentence, under a row that just
// promised the opposite.
//
// THIS CELL PINS CURRENT BEHAVIOUR, NOT A FIX. No new copy is invented here
// (batch 3's own principle forbids guessing a signed sentence into existence).
// When Sam rules the open question (device-pass checklist item 4f), this cell
// should RED — that is the stale-check signal to re-point it at whichever
// sentence he picks, per this repo's declared-red/declared-gap pattern.
run('the row sub-line and the whole-day scope can still disagree on an '
  + 'unanchored multi-kind day (PINNED, copy sheet §6-VI, unruled)', () => {
  // HOW THE FIXTURE IS REACHED CHANGED; WHAT IT PINS DID NOT.
  //
  // This used to take the seed's plain Monday and ADD light conditioning to it,
  // because nothing in the seed produced an unanchored two-kind day on its own.
  // Since Sam's flush-offer ruling landed (2026-08-06) the in-season week
  // carries its authored offer as a component on a strength day, so the seed now
  // produces exactly this shape without being asked — and the old construction
  // no longer reaches it, because the only remaining sole-content day is an
  // accessory day that absorbs an added conditioning part instead of standing
  // beside it. The cell takes the day that HAS the shape, and still refuses to
  // pass if no such day exists.
  const weekStart = seed();
  const target = [0, 1, 2, 3, 4, 5, 6]
    .map((offset) => addDaysISO(weekStart, offset))
    .find((date) => {
      const options = optionsFor(weekStart, date);
      const ids = options.binScopes.map((scope) => scope.id);
      return options.canRemove && ids.includes('whole_day') &&
        ids.filter((id) => id !== 'whole_day').length >= 2;
    });
  assert(target,
    'the seed produces no unanchored multi-kind day at all, so this cell cannot '
    + 'reach the state it pins — re-point it or retire it');

  const after = optionsFor(weekStart, target);
  // THE ROW'S HALF: unanchored, two kinds, `removeEmptiesTheDay` is false —
  // the row reads "anything else on the day stays."
  assert(!removeEmptiesTheDay(after),
    'the unanchored two-kind day is reported as sole-content again — the fixture '
    + `no longer reaches the state this cell pins; binScopes=${JSON.stringify(after.binScopes.map((s) => s.id))}`);
  // THE PICKER'S HALF: a whole-day scope is offered anyway, alongside the parts.
  const wholeDay = after.binScopes.find((scope) => scope.id === 'whole_day');
  assert(wholeDay,
    'no whole_day scope is offered on this unanchored multi-kind day — if the '
    + 'producer stopped offering one, the collision this cell pins is closed and '
    + `the cell should be re-pointed at that outcome; binScopes=${JSON.stringify(after.binScopes.map((s) => s.id))}`);
  const parts = after.binScopes.filter((scope) => scope.id !== 'whole_day');
  assert(parts.length >= 2,
    'fewer than two non-whole-day parts are offered, so this is not the shape '
    + `binScopesForSnapshot's [...parts, WHOLE_DAY_SCOPE] branch describes; binScopes=${JSON.stringify(after.binScopes.map((s) => s.id))}`);

  // THE CONTRADICTION ITSELF, over the sheet's own control flow (same standing as
  // the source-contract cells above): choosing the offered whole_day scope sets
  // `label: null`, which is what selects the sole-content confirmation sentence —
  // the one the row, one tap earlier, contradicted.
  const sheet = readFileSync(
    join(__dirname, '..', 'screens', 'home', 'PlanChangeSheet.tsx'),
    'utf8',
  );
  assert(/scope\.id === 'whole_day' \? null/.test(sheet),
    'the scope picker no longer sets label:null for the whole_day choice — if this '
    + 'was fixed by naming the scope\'s own confirmation instead, the collision this '
    + 'cell pins is closed and it should be re-pointed at that outcome');
});

console.log(`\nMove scoping totals: ${passed} passed, ${failed} failed`);
totalsPrinted(failed);
if (failed > 0) {
  console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
