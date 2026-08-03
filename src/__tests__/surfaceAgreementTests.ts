/**
 * L-P1 / L-P3 — EVERY SURFACE TELLS THE SAME STORY. STAGE 3 REDS.
 *
 * Sam's 2026-07-29 render split, three defects, all with doors that reported
 * ACCEPTED (`plan_change_add_category_accepted`,
 * `program_control_move_session_accepted`) — the domain agreed with itself every
 * time, so every one of these is a surface composing its own answer:
 *
 *   1. Add FBS to the G+1 recovery Sunday. Card said "Recovery + Recovery
 *      Session", detail title said "Recovery Session + Full Body Strength",
 *      content showed recovery only. THREE surfaces, THREE stories.
 *   2. Add hard intervals to a recovery day. The card dropped recovery entirely;
 *      the detail embedded the intervals INSIDE the recovery template. The
 *      inverse split.
 *   3. Move Tue -> Sat. The Tuesday card rendered internal planner vocabulary —
 *      "Aerobic conditioning component (25m…)" — to an athlete.
 *
 * ARMED IN `test:bible` SINCE TASK 6 (2026-07-31). Sam's process ruling was that
 * the gate stays green after every stage and the surface laws enter the bible IN
 * THEIR GREEN COMMIT, not before. This is that commit: the menu (Task 4), the week
 * card (Task 5) and the day-detail title/content (Task 6) all render from
 * `project()`, and the L-P1/L-P3 cells hold against it. A failure exits 1.
 *
 * WHAT THE LAW IS, AND WHY IT IS PHRASED THIS WAY. The assertion is
 * `surface === projection`, never `surface_a === surface_b`. Two surfaces that
 * drifted together would satisfy the weaker form, and surfaces agreeing with each
 * other's mistakes is the whole failure being replaced. The CANONICAL answer is
 * `buildProgramTabProjectedWeek` -> `project()`, and each pixel-bearing surface is
 * compared to IT. That is exactly the finding the reassessment named: no screen
 * imported it, so every screen was free to differ.
 *
 * CELLS 2 AND 4 WERE RE-POINTED, 2026-07-31, BY A SAM RULING — NOT LOOSENED.
 *
 * They used to describe the Sunday after his Saturday fixture as a RECOVERY day
 * and assert recovery behaviour on it, and both reds were carried as one declared
 * domain gap (`g1_sunday_is_rest_not_a_recovery_day`) waiting on a stage-5
 * "recovery as a day type" unit. That unit is not coming: the session-type
 * charter work DELETED recovery as an athlete-facing session type (design ruling
 * 9's "(type deleted)"; the Add/Swap menus stopped offering it in Task 4), so
 * Sam ruled that a G+1 Sunday resolving REST with zero parts IS the end state,
 * not a gap.
 *
 * So the reference these two cells are held to changed, and they are held to the
 * new one just as exactly: `kind: 'rest'`, zero parts, the same words on card,
 * detail and menu, an ADD door offering the five signed types, and swap / move /
 * remove REFUSING because there is nothing on the day to act on. That is
 * capability parity for a day of that shape — the charter's own Rest row says the
 * athlete reaches rest through Remove and never by adding a rest session — and it
 * is asserted as equalities on the ruled state, never as a softened version of the
 * recovery expectation. L13 holds: nothing here asks less, it asks something
 * different because Sam ruled something different.
 *
 * STATUS, 2026-07-31 — read this before trusting a result.
 *
 *   - Cell 1 PASSES. READ WHAT THAT DOES AND DOES NOT MEAN. Since Task 6 the
 *     detail comparison here reads `projectDayDetail`, which is what
 *     `DayWorkoutScreenV2` uses for its TITLE and its attached-part line — and
 *     `projectDayDetail` maps `parts` one-to-one, so those two lists agree by
 *     construction. What the cell holds is that they STAY that way: a filter or a
 *     `kind` branch added to the detail surface reds it. It does NOT compare the
 *     rendered CONTENT: the athlete's session list is filled by D13's separate
 *     composition (`buildSessionTemplate`), and the law that crosses those two
 *     representations lives in `athleteActionWalkerTests` as
 *     `L-P3 TEMPLATE = PROJECTION`, because only the walker reaches real
 *     generated weeks by acting. That law reds today, in four declared shapes
 *     owned by D13 — so the content half of "one story" is watched, and it is
 *     not yet true.
 *   - Cells 2 and 4 PASS against the ruled rest-day end state (above). The
 *     declared domain gap they used to share is DELETED, because the thing it
 *     declared is no longer a defect.
 *   - Cell 3 PASSES over the whole visible horizon.
 *
 * The `harness-enters-below-the-door` note this header used to carry is HALF paid:
 * the detail surface is callable and it is the one the screen calls for its
 * words. The content list entered a harness only when
 * `L-P3 TEMPLATE = PROJECTION` was written, and it went red immediately.
 *
 * Run: npm run test:surface-agreement
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
  throw new Error('NETWORK DISABLED — surface agreement is an on-device law');
};
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
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
import { buildProgramTabProjectedWeek } from '../utils/visibleProgramReadModel';
import { applyPlanChange, listPlanChangeOptionsForDay } from '../utils/planChangeProducer';
import { getSessionComponents } from '../utils/sessionComponents';
import type { PlanChangeCategoryId } from '../utils/planChangeTypes';
import type { PlanChangeDayOptions } from '../utils/planChangeProducer';
import { project } from '../rules/projectVisibleWeek';
import type { VisibleDayDetail } from '../rules/visibleDayDetail';
import { projectDayDetail } from '../rules/visibleDayDetail';
import type { VisibleDay } from '../rules/visibleProjection';
import { athleteVisibleStrings } from '../rules/visibleProjection';
import { isSignedCopyText } from '../rules/signedCopy';
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

/**
 * A DECLARED DOMAIN GAP — the walker's `DECLARED_RED` pattern, in this suite.
 *
 * This suite is ARMED (Task 6): it is in `test:bible` and a failure exits 1. Two
 * of its four cells assert something that is true of Sam's DEVICE and not of any
 * world this harness can reach by acting, and the reason is one gap sitting
 * upstream of every surface — so the honest move is neither to delete the cells
 * nor to soften what they assert, but to name the gap, pin the exact message it
 * produces, and let the assertion stand behind it word for word.
 *
 * The three properties that make this a ratchet rather than a mute button, all
 * borrowed from `athleteActionWalkerTests`:
 *
 *   1. THE ASSERTION IS UNCHANGED. Not loosened, not skipped early, not wrapped
 *      in a conditional. It runs, it fails, and the failure is matched against a
 *      declared message. L13: "cells go green by surfaces converging, never by
 *      asking less" — nothing here went green.
 *   2. STALE DECLARATIONS FAIL. If a declared gap stops producing its message,
 *      the suite fails and the entry has to be deleted. A gap cannot outlive the
 *      defect it names.
 *   3. IT IS VISIBLE IN THE OUTPUT AND IT IS NOT A PASS. Declared gaps print as
 *      `GAP` and are counted separately from `passed`, so no run of this suite
 *      can be read as "four cells agree".
 */
interface DeclaredDomainGap {
  id: string;
  /**
   * WHICH CELLS THIS MAY EXPLAIN. Scoped by name, not global: a matcher loose
   * enough to be useful is loose enough to absorb a future red in a DIFFERENT
   * cell that happens to contain the same phrase, and a gap that can swallow an
   * unrelated failure has stopped being a declaration. Matched against the cell
   * name as a prefix.
   */
  cells: readonly string[];
  /** The exact failure this explains. Cut from the message, not guessed at. */
  matches: RegExp;
  why: string;
  owner: string;
  expiresWhen: string;
}

/**
 * EMPTY, AND THAT IS A RESULT — not a mechanism nobody wired up.
 *
 * One entry lived here: `g1_sunday_is_rest_not_a_recovery_day`, covering cells 2
 * and 4, owned by "the recovery-as-a-day-type owner — reassessment staging step
 * 5". Sam CLOSED that question on 2026-07-31 instead of scheduling it: the
 * session-type charter work deleted recovery as an athlete-facing session type,
 * so a G+1 Sunday resolving REST with zero parts is the ruled end state and there
 * is nothing left to declare. The two cells are re-pointed at that end state
 * (see the header) and they pass against it, so the entry goes — property 2 of
 * this mechanism, "stale declarations fail", would have red on the very next run
 * if it had been left behind.
 *
 * THE MECHANISM STAYS. It is general — the next suite-level domain gap declares
 * itself here rather than being softened into an assertion — and it degrades
 * correctly on an empty list: `declaredGapFor` finds nothing so every failure is
 * a real failure, and `staleGaps` is empty so the stale-check passes trivially.
 * There is deliberately no non-vacuity floor on THIS list (unlike `PROPOSED` in
 * `copyRulingsBindingTests`): a floor would mean the suite could not report
 * "every cell agrees with the projection", which is the state it is supposed to
 * be able to reach.
 */
const DECLARED_DOMAIN_GAPS: readonly DeclaredDomainGap[] = [];

const gapsHit = new Set<string>();
let gapped = 0;

function declaredGapFor(cell: string, message: string): DeclaredDomainGap | null {
  return DECLARED_DOMAIN_GAPS.find((gap) =>
    gap.cells.some((scope) => cell.startsWith(scope)) && gap.matches.test(message)) ?? null;
}

function run(name: string, body: () => void): void {
  try {
    body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const gap = declaredGapFor(name, message);
    if (gap) {
      gapped += 1;
      gapsHit.add(gap.id);
      console.log(`  GAP  ${name}\n      declared domain gap: ${gap.id}`
        + `\n      owner: ${gap.owner}\n      ${message}`);
      return;
    }
    failed += 1;
    failures.push(name);
    console.error(`  FAIL ${name}\n      ${message}`);
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

/**
 * The Sunday after his Saturday fixture — G+1, and under Sam's 2026-07-31 ruling
 * a REST day. Named once because three cells describe the same date and a typo in
 * one of them would look like a disagreement between surfaces.
 */
const G1_SUNDAY = '2026-08-02';

function mondayFor(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  parsed.setDate(parsed.getDate() - ((parsed.getDay() + 6) % 7));
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

/** THE CARD's source — `useScheduleState` -> `resolveWeekWithConditioning`. */
function cardWeek(week: string): ResolvedDay[] {
  return quiet(() => resolveWeekWithConditioning(week, buildScheduleStateImperative()));
}

/** THE CANONICAL answer — the one single derivation of accepted state today. */
function projectedWeek(week: string): ResolvedDay[] {
  return quiet(() => buildProgramTabProjectedWeek({
    mondayISO: week, todayISO: TODAY,
    state: buildScheduleStateImperative(),
    overrideContexts: useProgramStore.getState().overrideContexts ?? {},
  }));
}

function dayFrom(days: ResolvedDay[], date: string): ResolvedDay | undefined {
  return days.find((day) => day.date === date);
}

/** The part list a surface would show. The ONLY plural, per the ruling. */
function partIds(workout: Workout | null | undefined): string[] {
  return getSessionComponents(workout ?? null).map((part) => String(part.id));
}

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
      revision: 1, lastTransaction: 'surface-agreement:generate',
      injuryEpisodes: [], temporarySourceFacts: [],
      acceptedCompositionBase: null, acceptedProfileSnapshot: null,
    },
    dateOverrides: {}, overrideContexts: {}, weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {}, sessionFeedback: {}, weightOverrides: {},
  } as never);
  // His fixture: the Saturday game that makes Sunday G+1 recovery.
  quiet(() => useCalendarStore.getState().setGameDay('2026-08-01', TODAY));
}

function tap(change: PlanChange) {
  const date = (change as { date?: string; fromDate?: string }).date
    ?? (change as { fromDate?: string }).fromDate ?? TODAY;
  return quiet(() => applyPlanChange({
    change, visibleWeek: cardWeek(mondayFor(date)), todayISO: TODAY,
    setManualOverride: (target, workout, context) =>
      useProgramStore.getState().setManualOverride(target, workout, context),
  }));
}

/**
 * THE DETAIL SURFACE'S OWN STORY, AND THE PROJECTION'S — from the real path.
 *
 * Until Task 6 this read `composeDayDetail`, the composition `useDayWorkout`
 * performed at render: five booleans and three row buckets, which is how a day
 * carrying strength AND recovery told the athlete "Strength". That composition no
 * longer reaches a screen. `projectDayDetail` (`rules/visibleDayDetail.ts`) is
 * what `DayWorkoutScreenV2` renders now — title, attached-part line and section
 * list — so the comparison below is against the function that actually draws the
 * pixels, not against a stand-in for it.
 *
 * WHAT THIS CELL PROVES AND WHAT IT DOES NOT, STATED PLAINLY. `projectDayDetail`
 * maps `parts`, so the two lists agree by construction — that IS the ruled end
 * state (reassessment §4: "`parts` is the ONLY plural ... two surfaces reading one
 * list cannot disagree", and defects 1 and 2 become *unrepresentable*). What the
 * assertion holds is that it STAYS that way: a filter, a `kind` branch or a
 * "recovery renders differently" case added to the detail surface reds here and
 * in the walker on the next run. It is NOT a cross-representation check, and it
 * must not be read as one: the words this covers are the title and the
 * attached-part line, not the rendered session list, which D13's
 * `buildSessionTemplate` composes separately. That comparison is
 * `L-P3 TEMPLATE = PROJECTION` in `athleteActionWalkerTests` — the walker,
 * because only the walker reaches real generated weeks — and it is red today in
 * four declared shapes. The teeth in THIS suite that do not depend on the
 * construction live below, in cell 2's own two assertions about what the DOMAIN
 * carries after an add.
 */
function detailAndProjectionKinds(week: string, date: string): {
  detail: string[]; projection: string[];
} {
  const projected = project({ week: projectedWeek(week), weekStart: week });
  const day = projected.days.find((candidate) => candidate.date === date) ?? null;
  const detail = projectDayDetail(day);
  return {
    detail: Array.from(new Set((detail?.sections ?? []).map((section) => String(section.kind)))).sort(),
    projection: Array.from(new Set((day?.parts ?? []).map((part) => String(part.kind)))).sort(),
  };
}

/** L-P1 + L-P3 for one day, against the canonical projection. */
function assertSurfacesAgree(date: string, context: string): void {
  const week = mondayFor(date);
  const canonical = dayFrom(projectedWeek(week), date);
  const card = dayFrom(cardWeek(week), date);
  assert(canonical, `${context}: the projection has no ${date}`);

  // L-P1: the card IS the projection, not merely consistent with something else.
  const canonicalName = canonical.workout?.name ?? null;
  const cardName = card?.workout?.name ?? null;
  assert(cardName === canonicalName,
    `${context} — L-P1: the week card and the projection name ${date} differently. `
    + `card "${cardName}" / projection "${canonicalName}". One day, two stories.`);

  // L-P3: parts conservation. Same ids, same order, same count.
  const canonicalParts = partIds(canonical.workout);
  const cardParts = partIds(card?.workout);
  assert(JSON.stringify(cardParts) === JSON.stringify(canonicalParts),
    `${context} — L-P3: parts differ on ${date}. card ${JSON.stringify(cardParts)} / `
    + `projection ${JSON.stringify(canonicalParts)}. \`parts\` is the only plural; `
    + 'a surface that shows a different list has composed its own.');

  // THE THIRD SURFACE — what the day-detail screen renders, from the real path.
  const { detail: detailKinds, projection: canonicalKinds } =
    detailAndProjectionKinds(week, date);
  assert(JSON.stringify(detailKinds) === JSON.stringify(canonicalKinds),
    `${context} — L-P3: the DETAIL screen and the projection disagree about what is `
    + `on ${date}. detail ${JSON.stringify(detailKinds)} / projection `
    + `${JSON.stringify(canonicalKinds)}. This is the third story: the detail `
    + 'composes its own account at render.');
}

console.log('\n-- Surface agreement (L-P1/L-P3) — ARMED, in test:bible since Task 6 --');

/**
 * THE G+1 SUNDAY AS THE PROJECTION SEES IT, plus what the detail surface makes
 * of it. One read, used by both re-pointed cells so they cannot describe the
 * same day two ways.
 */
function g1Sunday(): { day: VisibleDay | null; detail: VisibleDayDetail | null } {
  const week = mondayFor(G1_SUNDAY);
  const projected = quiet(() => project({ week: projectedWeek(week), weekStart: week }));
  const day = projected.days.find((candidate) => candidate.date === G1_SUNDAY) ?? null;
  return { day, detail: projectDayDetail(day) };
}

/**
 * THE RULED SHAPE OF A G+1 SUNDAY, asserted as equalities.
 *
 * Sam's ruling of 2026-07-31: recovery is not an athlete-facing session type, so
 * the day after a Saturday fixture with nothing planned on it is REST — and rest
 * is a decision with an owner (`sessionTypeCharter.ts`, the Rest row), not a
 * residue. "Consistently on every surface" is the whole of the claim, so the card
 * name, the detail headline and the part list are each compared, and each is an
 * equality rather than a "contains" or a "not-empty".
 */
function assertG1SundayIsRest(context: string): void {
  const { day, detail } = g1Sunday();
  assert(day, `${context}: the projection has no ${G1_SUNDAY}`);
  assert(String(day.kind) === 'rest',
    `${context}: the G+1 Sunday projects "${day.kind}", not "rest". Sam's ruling `
    + 'is that this day IS rest — a recovery placeholder here is the type the '
    + 'charter deleted, coming back.');
  assert(day.parts.length === 0,
    `${context}: the G+1 rest Sunday carries `
    + `${JSON.stringify(day.parts.map((part) => String(part.kind)))}. A rest day has `
    + 'no contents (charter, Rest row: "a rest day has no contents").');
  assert(String(day.headline) === 'Rest Day',
    `${context}: the day-kind headline reads "${day.headline}", not "Rest Day".`);
  // THE DETAIL SURFACE SAYS THE SAME WORD, from the same field — `projectDayDetail`
  // falls back to `day.headline` at zero parts, and this holds it there.
  assert(detail, `${context}: the detail surface has nothing for ${G1_SUNDAY}`);
  assert(String(detail.headline) === String(day.headline),
    `${context}: the detail titles the day "${detail.headline}" while the projection `
    + `calls it "${day.headline}". One day, two stories.`);
  assert(detail.attached.length === 0 && detail.sections.length === 0,
    `${context}: the detail invented ${detail.sections.length} section(s) and `
    + `${detail.attached.length} attached headline(s) for a day with no parts.`);
  // AND THE CARD. `assertSurfacesAgree` is the card-vs-projection law itself, so
  // the rest day is put through it rather than given a private version of it.
  assertSurfacesAgree(G1_SUNDAY, `${context} — the untouched G+1 rest Sunday`);
}

run('(1) adding strength to the G+1 Sunday tells ONE story', () => {
  reachHisWorldByActing();
  const added = tap({ kind: 'add_category', date: G1_SUNDAY, category: 'strength_full' } as PlanChange);
  assert(added.outcome === 'applied',
    `the door refused the add (${added.outcome}: "${added.message}") — this cell is `
    + 'about surfaces, and the tape shows the door accepting');
  assertSurfacesAgree(G1_SUNDAY, 'defect 1, G+1 rest Sunday + Full Body Strength');
});

run('(2) adding hard conditioning to the G+1 rest Sunday lands on every surface', () => {
  // RE-POINTED 2026-07-31 BY SAM'S RULING, and this is what it now asks.
  //
  // The old cell asked that adding hard intervals to a RECOVERY Sunday must not
  // delete the recovery already there — defect 2 of the 2026-07-29 render split,
  // where the card dropped recovery and the detail swallowed the intervals inside
  // the recovery template. There is no recovery on that Sunday to conserve any
  // more and there is not supposed to be: the charter deleted recovery as an
  // athlete-facing type, so the day is REST and the athlete's add is the ONLY
  // thing that puts work on it.
  //
  // The conservation question does not disappear, it changes subject: the day
  // starts with nothing, so after the add the projection must carry EXACTLY the
  // conditioning the athlete asked for — not less (the add lost), not more (a
  // recovery placeholder conjured beside it, which is the deleted type coming
  // back through the resolver). Both are equalities on the ruled state.
  reachHisWorldByActing();
  assertG1SundayIsRest('before the add');

  const added = tap({ kind: 'add_category', date: G1_SUNDAY, category: 'conditioning_hard' } as PlanChange);
  assert(added.outcome === 'applied',
    `the door refused the add (${added.outcome}: "${added.message}")`);

  // THE ADD LANDED AND EVERY SURFACE TELLS THE SAME STORY ABOUT IT.
  assertSurfacesAgree(G1_SUNDAY, 'the G+1 rest Sunday + hard intervals');

  const canonical = dayFrom(projectedWeek(mondayFor(G1_SUNDAY)), G1_SUNDAY);
  const parts = partIds(canonical?.workout);
  assert(JSON.stringify(parts) === JSON.stringify(['conditioning']),
    `the day carries ${JSON.stringify(parts)} after the athlete added hard intervals `
    + 'to an empty rest day. Exactly one part, and it is the one they asked for: '
    + 'anything less lost the add, anything more was invented beside it.');

  // AND THE DAY STOPPED BEING REST, on the projection and on the detail together.
  const { day, detail } = g1Sunday();
  assert(day, 'the projection has no G+1 Sunday after the add');
  assert(String(day.kind) === 'training',
    `after the add the projection still calls the day "${day.kind}". A day with work `
    + 'on it is a training day.');
  assert(JSON.stringify(day.parts.map((part) => String(part.kind))) === JSON.stringify(['conditioning']),
    `the projection's parts are ${JSON.stringify(day.parts.map((part) => String(part.kind)))}.`);
  assert(detail, 'the detail surface has nothing for the G+1 Sunday after the add');
  assert(JSON.stringify(detail.sections.map((section) => String(section.kind)))
    === JSON.stringify(day.parts.map((part) => String(part.kind))),
    `the detail renders ${JSON.stringify(detail.sections.map((section) => String(section.kind)))} `
    + `while the projection carries ${JSON.stringify(day.parts.map((part) => String(part.kind)))}.`);
  assert(String(detail.headline) === String(day.parts[0].headline),
    `the detail titles the day "${detail.headline}" while the part it is showing is `
    + `"${day.parts[0].headline}". The lead name is one rule for both surfaces.`);
  assert(detail.attached.length === 0,
    `the detail attached ${JSON.stringify(detail.attached.map(String))} to a `
    + 'single-part day.');
});

run('(3) no surface renders internal planner vocabulary', () => {
  // The generator appends ' + easy off-feet aerobic conditioning component' to
  // `allocation.focus` (coachingEngine.ts:1262, :6500) and
  // `resolveSessionDisplayName`'s last precedence rule is a cleaned name/focus
  // pass-through — so planner scratch reaches the glass through a punctuation
  // tidier. Asserted over the WHOLE visible horizon, not one date: this is a
  // vocabulary law, and the day it surfaces on is an accident of allocation.
  reachHisWorldByActing();
  const banned = [
    'conditioning component',
    'off-feet',
    'planner',
    'allocation',
    'appPrescribed',
    'plannerSelected',
  ];
  const offences: string[] = [];
  for (const week of [WEEK, '2026-08-03', '2026-08-10']) {
    for (const day of projectedWeek(week)) {
      const name = day.workout?.name ?? '';
      for (const phrase of banned) {
        if (name.toLowerCase().includes(phrase.toLowerCase())) {
          offences.push(`${day.date}: "${name}" (contains "${phrase}")`);
        }
      }
    }
  }
  assert(offences.length === 0,
    'defect 3 — L-P2: internal vocabulary reached an athlete-facing name:\n        '
    + `${offences.join('\n        ')}\n      Athlete-facing words come from the `
    + 'signed-copy sheet; `allocation.focus` must be structurally unable to reach '
    + 'a card.');
});

run('(5) L-P2 — every word the migrated surfaces render is signed', () => {
  // THE RUNTIME HALF OF L-P2, ARMED (Task 11).
  //
  // Cell 3 above is the law stated as a BLOCKLIST: six phrases that must not
  // appear. A blocklist only ever catches the leak somebody already found —
  // "off-feet" was on it because Sam saw it on his phone. This is the same law
  // stated as an ALLOWLIST, which is the only form that can catch the next one:
  // every string the four migrated surfaces put on the glass must be IN the
  // signed-copy sheet, not merely absent from a list of known-bad words.
  //
  // `athleteVisibleStrings` is the projection's own enumeration of what a day
  // would render — day headline, refusal, every part headline and detail, every
  // row name, prescription and cue (`visibleProjection.ts`). It is collected
  // from the PROJECTION rather than by scraping components on purpose: the law
  // is that the projection is the only source, so a surface that shows something
  // this does not return has composed it, and cells 1-4 are what hold the
  // surfaces to the projection.
  //
  // WHY THIS IS NOT VACUOUS EVEN THOUGH `project()` ONLY EVER CALLS
  // `signedCopy()`. `SignedCopy` is a branded string, and a brand is a compile-
  // time claim: one `as SignedCopy` cast, one template literal assembled from
  // two signed halves, one `${}` interpolation of a number that no entry
  // templates, and the type still passes while the athlete reads something
  // nobody authored. `isSignedCopyText` re-derives the claim at runtime against
  // the filled text of every registered entry. It is also the assertion that
  // FAILS if a future edit reintroduces a pass-through: Task 11 deleted
  // `resolveSessionDisplayName`'s cleaned-focus rule, and if it came back, a
  // strength part on a legacy day would resolve to planner text, miss
  // `STRENGTH_HEADLINE_ID_BY_LABEL`, and — were `partHeadline` ever to return it
  // rather than fall through — land here.
  //
  // OVER THE WHOLE VISIBLE HORIZON, not one date: the same reason cell 3 gives.
  // Which day a gap surfaces on is an accident of allocation.
  reachHisWorldByActing();
  const offences: string[] = [];
  for (const week of [WEEK, '2026-08-03', '2026-08-10']) {
    const projected = quiet(() => project({ week: projectedWeek(week), weekStart: week }));
    for (const day of projected.days) {
      for (const text of athleteVisibleStrings(day)) {
        if (!isSignedCopyText(text)) {
          offences.push(`${day.date}: "${text}"`);
        }
      }
    }
  }
  assert(offences.length === 0,
    `L-P2: the projection rendered ${offences.length} string(s) that are not in the `
    + `signed-copy sheet:\n        ${offences.join('\n        ')}\n      `
    + 'Athlete-facing words come from an authored source or a Sam ruling.');
});

/**
 * THE FIVE ROWS THE ADD/SWAP SHEET ACTUALLY DRAWS, computed the way the sheet
 * computes them.
 *
 * `PlanChangeSheet` does not render `options.categories` one row per id — it
 * groups them into design ruling 9's five types: Strength (any of the three
 * buckets), Conditioning (either intensity), Gunshow, Mobility and
 * Prehab/Accessories. Restating that grouping here rather than asserting over the
 * raw id list is what makes the assertion about the MENU the athlete sees; the
 * raw list still carries `recovery` for the producer's own reasons, and that
 * residual is named as follow-up debt in the boundary report rather than pinned
 * here as though Sam had ruled it.
 */
const SIGNED_ADD_ROWS = ['conditioning', 'gunshow', 'mobility', 'prehab', 'strength'] as const;

function addRowsOffered(options: PlanChangeDayOptions): string[] {
  const offers = (id: PlanChangeCategoryId) =>
    options.categories.some((category) => category.id === id);
  const rows: string[] = [];
  if (offers('strength_upper') || offers('strength_lower') || offers('strength_full')) rows.push('strength');
  if (offers('conditioning_light') || offers('conditioning_hard')) rows.push('conditioning');
  if (offers('gunshow')) rows.push('gunshow');
  if (offers('mobility')) rows.push('mobility');
  if (offers('prehab')) rows.push('prehab');
  return rows.sort();
}

run('(4) a rest day is offered the capabilities a day of its shape has', () => {
  // RE-POINTED 2026-07-31 BY SAM'S RULING. This cell used to read "a recovery day
  // is offered the same capabilities as any other day" and assert `hasSession`,
  // `canRemove` and a move with no refusal on the G+1 Sunday — reassessment
  // defect 4, where the menu collapsed to add-only on a day the app had decided
  // was recovery. Recovery is no longer an athlete-facing session type, so the
  // day is REST, and the honest question is what capability parity MEANS for a
  // day with nothing on it.
  //
  // It means this: the ADD door is fully open, with the same five signed types
  // every other day offers, and swap / move / remove REFUSE — not because rest is
  // a lesser day, but because there is nothing there to swap, move or remove. A
  // menu that offered them would be offering doors with nothing behind them,
  // which is the defect this suite exists to catch pointed the other way. The
  // charter says the same thing from the domain side: the athlete reaches rest
  // through Remove, never by adding a rest session.
  //
  // NOTE FOR WHOEVER READS A FAILURE HERE. Under the old declaration this cell
  // aborted on its FIRST assertion, so its `canRemove` and move claims had not
  // run since the gap was written. They run now, against the opposite
  // expectation, and they were unproven in either direction before this commit.
  reachHisWorldByActing();
  assertG1SundayIsRest('the menu\'s subject');

  const restDay = quiet(() => listPlanChangeOptionsForDay({
    visibleWeek: cardWeek(mondayFor(G1_SUNDAY)), date: G1_SUNDAY, todayISO: TODAY,
  }));

  assert(restDay.locked === null,
    `the rest Sunday is locked "${restDay.locked}" — it is inside the edit horizon `
    + 'and it is not a fixture, so the menu opens.');

  // THE ADD DOOR — the whole of what a rest day can offer, and all of it.
  assert(restDay.canAdd,
    'the rest Sunday refuses ADD. A rest day is the one day every optional type '
    + 'can land on.');
  assert(JSON.stringify(addRowsOffered(restDay)) === JSON.stringify([...SIGNED_ADD_ROWS]),
    `the rest day's Add menu draws ${JSON.stringify(addRowsOffered(restDay))}, not the `
    + `five signed types ${JSON.stringify([...SIGNED_ADD_ROWS])} (design ruling 9).`);

  // AND THE THREE DOORS THAT CORRECTLY REFUSE, each for the same one reason.
  assert(restDay.hasSession === false,
    'the menu says the rest Sunday has a session. It has zero parts — a menu that '
    + 'thinks otherwise is about to offer swap and remove on nothing.');
  assert(restDay.canSwap === false,
    'the menu offers SWAP on a day with nothing to swap.');
  assert(restDay.canRemove === false,
    'the menu offers REMOVE on a day with nothing to remove. Rest is already what '
    + 'Remove produces.');
  assert(JSON.stringify(restDay.binScopes) === '[]',
    `the menu lists bin scopes ${JSON.stringify(restDay.binScopes)} on an empty day.`);
  assert(restDay.move.refusal?.reason === 'no_session',
    `the move door refuses "${restDay.move.refusal?.reason ?? 'nothing — it offers a move'}" `
    + 'on an empty day. The typed cause is `no_session`, and the sentence the athlete '
    + 'reads is selected from it.');
  assert(restDay.move.refusal?.message === "There's nothing on this day to move.",
    `the move refusal reads "${restDay.move.refusal?.message}".`);
  assert(JSON.stringify(restDay.move.scopes) === '[]',
    `the move door refuses and still lists scopes ${JSON.stringify(restDay.move.scopes)}.`);

  // ADD-ON-TOP IS EMPTY, AND THAT IS NOT THE SAME AS ADD BEING SHUT. Stacking is
  // defined against what is already on the day; nothing is, so the normal add
  // flow above owns this day entirely (`PlanChangeDayOptions.addOnTopCategories`:
  // "Rest days instead use `categories` via the normal add flow").
  assert(JSON.stringify(restDay.addOnTopCategories) === '[]',
    `the rest day lists add-on-top categories `
    + `${JSON.stringify(restDay.addOnTopCategories.map((category) => category.id))} with `
    + 'nothing underneath to stack on.');
  assert(restDay.visibleSessionCount === 0 && restDay.visibleSessionKinds.length === 0,
    `the menu counts ${restDay.visibleSessionCount} visible session(s) `
    + `${JSON.stringify(restDay.visibleSessionKinds)} on a day with no parts.`);
});

// STALE DECLARATIONS FAIL — a gap that stopped happening is a cell that went
// green, and the commit that turned it green owes the deletion of its entry.
const staleGaps = DECLARED_DOMAIN_GAPS.filter((gap) => !gapsHit.has(gap.id));
if (staleGaps.length > 0) {
  failed += staleGaps.length;
  for (const gap of staleGaps) {
    failures.push(`declared domain gap no longer reds: ${gap.id}`);
    console.error(`  FAIL declared domain gap "${gap.id}" no longer reds — delete the `
      + 'entry, do not leave it carrying debt that is already paid.');
  }
}

console.log(`\nSurface agreement totals: ${passed} passed, ${gapped} declared gap(s), `
  + `${failed} failed`);
totalsPrinted(failed);
// ARMED IN TASK 6. This suite is in `test:bible` and a failure exits 1 — the
// process ruling was that the surface laws enter the gate IN THEIR GREEN COMMIT,
// and this is it: the surfaces moved onto `project()` and the L-P1/L-P3 cells
// hold against it. The `process.exit(0)` softener that lived here is gone with
// the stage it belonged to. What is NOT green is declared above and counted
// separately, never as a pass.
if (failed > 0) {
  console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
