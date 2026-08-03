/**
 * SAM'S DEVICE FINDINGS, REPLAYED THROUGH REAL DOORS.
 *
 * The five taps he performed on 2026-07-29, of which three failed. Reached by
 * ACTING — fresh install, his onboarding answers, generate, his calendar, his
 * taps in the action tape's order — never by seeding a state nobody arrived at
 * (AGENTS.md: hand-built state fixtures are deprecated for athlete-facing
 * suites).
 *
 * SEPARATE FROM THE WALKER ON PURPOSE. This is a regression suite with named
 * expectations; the walker is a fuzzer with laws. They also have very different
 * memory profiles — the walker's bounded budget generates a program per walk,
 * and running a fixed scenario on top of that heap is what made the pair fall
 * over once the typed stack-add path started doing real transaction work.
 *
 * Run: npm run test:device-findings
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
  throw new Error('NETWORK DISABLED — device findings replay entirely on-device');
};
process.env.TZ = 'Australia/Melbourne';


import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import type { TrainingProgram } from '../types/domain';
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
import { buildProgramTabProjectedWeek } from '../utils/visibleProgramReadModel';
import { applyPlanChange, listPlanChangeOptionsForDay } from '../utils/planChangeProducer';
import {
  executeProgramControlAction,
  programControlActionForPlanChange,
} from '../utils/programControlActions';
import { getSessionComponents } from '../utils/sessionComponents';
import {
  samExport8Profile,
  SAM_EXPORT_8_MARKED_DAYS,
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

/** Fresh install, his answers, generate, his calendar. Every step a real door. */
function reachHisWorldByActing(): void {
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
  const his = program.microcycles.find((cycle) => cycle.startDate.slice(0, 10) === WEEK) ?? null;
  assert(his, 'his week is not in the generated program');
  useProgramStore.setState({
    currentProgram: program, currentMicrocycle: his,
    todayWorkout: null, isGenerating: false, isLoading: false, error: null, blockState: null,
    acceptedMaterialContext: {
      markedDays: {}, readinessSignalsByDate: {}, activeConstraints: [], activeInjury: null,
      revision: 1, lastTransaction: 'device-findings:generate',
      injuryEpisodes: [], temporarySourceFacts: [],
      acceptedCompositionBase: null, acceptedProfileSnapshot: null,
    },
    dateOverrides: {}, overrideContexts: {}, weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {}, sessionFeedback: {}, weightOverrides: {},
  } as never);
  // His calendar, through the calendar door — two rest marks and two games.
  for (const [date, mark] of Object.entries(SAM_EXPORT_8_MARKED_DAYS)) {
    if (mark === 'game') useCalendarStore.getState().setGameDay(date, TODAY);
    else useCalendarStore.getState().setRestDay(date);
  }
}

/**
 * The week a date lives in. His taps 2, 3 and 4 are all on 2026-08-06 / -07 /
 * -09, which is the week AFTER the one his first pass used — resolving a fixed
 * week here is how the first draft of these tests reported "the day is empty"
 * about a day it was not looking at.
 */
function mondayFor(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  const offset = (parsed.getDay() + 6) % 7;
  parsed.setDate(parsed.getDate() - offset);
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

function visibleWeek(week: string = WEEK): ResolvedDay[] {
  return quiet(() => resolveWeekWithConditioning(week, buildScheduleStateImperative()));
}

/** The visible week containing `date`. */
function weekOf(date: string): ResolvedDay[] {
  return visibleWeek(mondayFor(date));
}

function projectedWeek(): ResolvedDay[] {
  return quiet(() => buildProgramTabProjectedWeek({
    mondayISO: WEEK, todayISO: TODAY,
    state: buildScheduleStateImperative(),
    overrideContexts: useProgramStore.getState().overrideContexts ?? {},
  }));
}

/**
 * THE DOOR THE SCREEN USES — not the one underneath it.
 *
 * `PlanChangeSheet.commitPlanChange` dispatches by change kind: a MOVE or a BIN
 * goes through `executeProgramControlAction`, everything else goes straight to
 * `applyPlanChange`. That split is why taps 1 and 5 (adds) passed on his device
 * while 2, 3 and 4 (moves) failed — the failing layer is one every previous
 * suite entered BELOW.
 *
 * This mirrors the sheet's dispatch, including the payload it builds. Where that
 * payload loses something the athlete chose, this loses it too — a harness that
 * quietly passes what the screen drops is testing a screen that does not exist.
 */
function tapThroughTheScreen(change: PlanChange) {
  const anchorDate = change.kind === 'move_session' ? change.fromDate
    : (change as { date?: string }).date ?? TODAY;
  const context = { visibleWeek: weekOf(anchorDate), todayISO: TODAY };
  const screenAction = programControlActionForPlanChange(change);
  if (!screenAction) {
    return quiet(() => applyPlanChange({
      change, visibleWeek: context.visibleWeek, todayISO: TODAY,
      setManualOverride: (date, workout, ctx) =>
        useProgramStore.getState().setManualOverride(date, workout, ctx),
    }));
  }
  return quiet(() => executeProgramControlAction(screenAction, context));
}

function tap(change: PlanChange) {
  const anchorDate = change.kind === 'move_session' ? change.fromDate
    : (change as { date?: string }).date ?? TODAY;
  return quiet(() => applyPlanChange({
    change, visibleWeek: weekOf(anchorDate), todayISO: TODAY,
    setManualOverride: (date, workout, context) =>
      useProgramStore.getState().setManualOverride(date, workout, context),
  }));
}

console.log('\n-- Sam device findings, replayed --');

run('his three failing taps all land, and the screen agrees', () => {
  // HIS FIVE TAPS, of which three failed on 2026-07-29. Reached by ACTING —
  // fresh install, his onboarding answers, generate, his calendar — never by
  // seeding a state nobody arrived at. The dates are his; the tap order is the
  // action tape's.
  reachHisWorldByActing();

  // (1) Add strength to the G+1 Sunday. His copy said added and his screen
  //     showed Recovery + Recovery; here the whole tap must land AND the screen
  //     must agree with the domain about what the day holds.
  const one = tap({ kind: 'add_category', date: '2026-08-02', category: 'strength_full' } as PlanChange);
  assert(one.outcome === 'applied',
    `(1) add strength on the G+1 Sunday was ${one.outcome}: "${one.message}"`);
  const sunday = projectedWeek().find((day) => day.date === '2026-08-02');
  const sundayResolved = visibleWeek().find((day) => day.date === '2026-08-02');
  assert(sunday?.workout?.name === sundayResolved?.workout?.name,
    `(1) the screen and the domain disagree about the G+1 Sunday — screen `
    + `"${sunday?.workout?.name}", domain "${sundayResolved?.workout?.name}"`);
  const sections = (sunday?.workout as { sections?: { kind: string; title: string }[] } | undefined)
    ?.sections ?? [];
  const titles = sections.map((section) => `${section.kind}:${section.title}`);
  assert(new Set(titles).size === titles.length,
    `(1) the screen renders the same session twice — ${JSON.stringify(titles)} `
    + '(his device showed "Recovery + Recovery")');

  // (2)/(3) Move his Wednesday gym session onto Thursday. One tap, two laws:
  //     the refusal was generic, AND moving onto a team night is LEGAL under
  //     the doubling law. The OFFER has to exist before the tap can be honest.
  const wednesday = quiet(() => listPlanChangeOptionsForDay({
    visibleWeek: visibleWeek(), date: '2026-07-29', todayISO: TODAY,
  }));
  assert(!wednesday.move.refusal,
    `(2/3) his Wednesday offers no move at all: "${wednesday.move.refusal?.message}"`);
  const scoped = wednesday.move.scopes.filter((scope) => scope.id !== 'whole_day');
  assert(scoped.length > 0,
    '(2/3) his Wednesday offers no per-session scope — the gym session beside a '
    + 'team commitment is the one thing that CAN move');
  // THE DOUBLING LAW, asserted as itself. "At least one destination" is too
  // weak — it passed with the old free-days-only filter still in place, because
  // one day in his week happened to read as free. What Sam ruled is that moving
  // onto an OCCUPIED day is legal and lands combined, so the offer has to carry
  // one.
  assert(scoped.some((scope) => scope.destinations.some((destination) => destination.occupiedBy)),
    '(2/3) no scoped destination is an occupied day — the doubling law says a '
    + 'team night IS a destination, and his week has no free days to fall back on');

  // (5) Add conditioning to an occupied day. Light worked on his device; HARD
  //     was refused, and the confirmation narrated a move.
  const five = tap({ kind: 'add_category', date: '2026-07-30', category: 'conditioning_hard' } as PlanChange);
  assert(five.outcome === 'applied',
    `(5) adding hard conditioning to an occupied day was ${five.outcome}: "${five.message}"`);
  assert(!/\bmoved\b/i.test(five.message ?? ''),
    `(5) the confirmation narrates a MOVE for an ADD: "${five.message}"`);
});


// ── The 2026-07-29 five-tap pass: through the SCREEN's door ──────────────
//
// Taps 1 and 5 passed on his device and pass here through `applyPlanChange`,
// which is the door the sheet uses for adds. Taps 2, 3 and 4 go through
// `executeProgramControlAction`, and that is where they failed.

/** His world plus the state his 2026-07-29 pass had reached: two games. */
function reachHisSecondPassWorld(): void {
  reachHisWorldByActing();
  // The 08-08 game is already in his marks. The 08-06 -> 08-07 move is the one
  // that matters: 08-07 is the Friday before it, so this is a G-1 landing and
  // the ask MUST render.
}

/**
 * The Thursday he moved FROM had a session on it, and this world has to reach
 * that by acting before it can replay the move.
 *
 * His export records `override:set:2026-08-06` as the last transaction of the
 * pass — revision 43, a session's worth of edits — so on his phone 08-06 was
 * occupied. A generated week does not put one there. The first version of this
 * test tapped the move straight onto the empty day, the producer answered
 * `no_session` ("There's nothing on this day to move"), and the G-1 ask it was
 * written to assert could not arise at all: it was asserting the routing of a
 * sentinel the world never produced. Green would have meant nothing and red
 * meant nothing either, which is the fixture-fidelity law (AGENTS.md) in its
 * exact words — an input that cannot exhibit the defect proves nothing.
 *
 * The add is a real door, in the tape's own shape.
 */
function reachHisOccupiedThursday(): void {
  reachHisSecondPassWorld();
  const added = tap({
    kind: 'add_category', date: '2026-08-06', category: 'strength_full',
  } as PlanChange);
  assert(added.outcome === 'applied',
    `could not reach his occupied Thursday by acting: the add was ${added.outcome}`
    + ` — "${added.message}"`);
}

run('the G-1 ask reaches the screen instead of becoming a failure', () => {
  reachHisOccupiedThursday();
  const result = tapThroughTheScreen({
    kind: 'move_session', fromDate: '2026-08-06', toDate: '2026-08-07',
  } as PlanChange) as { ok?: boolean; needsGuidedFollowUp?: boolean; message?: string };

  // The engine's answer is a SENTINEL, not a refusal: `g1_route_required` means
  // "ask the athlete". His tape shows it arriving correctly at the producer and
  // being reported as `program_control_move_session_rejected` /
  // `technical_failure` — the ask-flow never rendered, three taps running.
  assert(result.needsGuidedFollowUp === true,
    '(2/3) the G-1 ask was not routed to the ask-flow — the wrapper reported a '
    + `refusal instead. ok=${result.ok} needsGuidedFollowUp=${result.needsGuidedFollowUp} `
    + `message="${result.message}" codes=${JSON.stringify(((result as any).rejected ?? []).map((r: any) => r.code))}`);
  assert(!/couldn't|could not|didn't go through|try again/i.test(result.message ?? ''),
    `(2/3) the athlete was given failure copy for a question: "${result.message}"`);
});

/**
 * Find a day the athlete can genuinely scope a move on, by ACTING: stack a
 * second component onto a day until the producer itself offers a per-session
 * scope with somewhere to go.
 *
 * Scanning beats hard-coding his dates. His 08-06 held two parts because of a
 * session's worth of edits (revision 43, eight constraints); asserting that
 * exact date made the harness report "the day is empty" about days it had
 * simply built differently. The LAW is about any multi-part day, so the test
 * asks the app which day that is.
 */
function reachAScopedMoveOffer(): {
  source: string;
  scope: string;
  destination: { date: string; occupiedBy: string | null };
  parts: string[];
} | null {
  for (const week of ['2026-07-27', '2026-08-03']) {
    for (const day of visibleWeek(week)) {
      for (const category of ['strength_full', 'conditioning_light'] as const) {
        tap({ kind: 'add_category', date: day.date, category } as PlanChange);
      }
      const parts = getSessionComponents(
        weekOf(day.date).find((entry) => entry.date === day.date)?.workout ?? null,
      ).map((part) => String(part.id));
      if (parts.length < 2) continue;
      const options = quiet(() => listPlanChangeOptionsForDay({
        visibleWeek: weekOf(day.date), date: day.date, todayISO: TODAY,
      }));
      if (options.move.refusal) continue;
      const scoped = options.move.scopes.find((scope) =>
        scope.id !== 'whole_day' && scope.destinations.length > 0);
      if (!scoped) continue;
      return {
        source: day.date, scope: scoped.id, parts,
        destination: scoped.destinations[0],
      };
    }
  }
  return null;
}

run('a scoped move through the screen carries the scope the athlete chose', () => {
  reachHisSecondPassWorld();
  const offer = reachAScopedMoveOffer();
  assert(offer, 'no day in either week offers a scoped move — nothing to assert');

  const result = tapThroughTheScreen({
    kind: 'move_session', fromDate: offer.source, toDate: offer.destination.date,
    scope: offer.scope,
  } as PlanChange) as { ok?: boolean; message?: string };
  assert(result.ok, `(4) the scoped move ${offer.source}->${offer.destination.date} scope=${offer.scope} was refused: "${result.message}" codes=${JSON.stringify(((result as any).rejected ?? []).map((r: any) => r.code + '::' + String(r.reason).slice(0, 90)))}`);

  const after = weekOf(offer.source).find((day) => day.date === offer.source);
  const afterParts = getSessionComponents(after?.workout ?? null).map((part) => String(part.id));
  // SCOPED MEANS SCOPED. On his device a scoped selection moved Upper Pull AND
  // Continuous Aerobic, emptying the day — because the sheet's wrapper payload
  // has nowhere to put a component scope and drops it.
  const survivors = offer.parts.filter((part) => part !== offer.scope);
  for (const survivor of survivors) {
    assert(afterParts.includes(survivor),
      `(4) a SCOPED move took "${survivor}" with it — ${offer.source} held `
      + `${JSON.stringify(offer.parts)} and now holds ${JSON.stringify(afterParts)}`);
  }
});

run('the move door accepts every destination the move offer advertises', () => {
  // MY OWN REGRESSION, from the same tape: at 10:28:57 a scoped move to an
  // occupied day returned `scoped_move_destination_occupied`. Last unit the
  // free-days-only filter came off the OFFER under the doubling law and the
  // matching refusal stayed in the COMMIT path, so the menu advertises
  // destinations the door rejects. The matrix's menu law drives
  // `addOnTopCategories` only, which is why it did not see this.
  reachHisSecondPassWorld();
  const offer = reachAScopedMoveOffer();
  assert(offer, 'no scoped move offered anywhere — nothing to assert');
  const options = quiet(() => listPlanChangeOptionsForDay({
    visibleWeek: weekOf(offer.source), date: offer.source, todayISO: TODAY,
  }));
  const scoped = options.move.scopes.find((scope) => scope.id === offer.scope);
  const occupied = scoped?.destinations.find((destination) => destination.occupiedBy);
  assert(occupied,
    'the offer advertises no occupied destination — the doubling law says a team '
    + 'night IS one, so this should not happen');

  const result = tapThroughTheScreen({
    kind: 'move_session', fromDate: offer.source, toDate: occupied.date, scope: offer.scope,
  } as PlanChange) as { ok?: boolean; message?: string };
  assert(result.ok,
    `the offer advertised ${occupied.date} ("${occupied.occupiedBy}") as a destination for `
    + `"${offer.scope}" and the door refused it: "${result.message}" `
    + `codes=${JSON.stringify(((result as any).rejected ?? []).map((r: any) => r.code))}`);
});

console.log(`\nDevice findings totals: ${passed} passed, ${failed} failed`);
totalsPrinted(failed);
if (failed > 0) {
  console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
