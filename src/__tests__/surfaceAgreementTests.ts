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
 * DELIBERATELY NOT IN `test:bible` YET. Sam's process ruling: the gate stays
 * green after every stage so the branch is mergeable at all times, and the
 * surface laws enter the bible IN THEIR GREEN COMMIT. These cells are red on
 * today's code by design — they are the reds owed before any surface moves — so
 * they are runnable and reportable but ungated until stage 4 turns them green.
 *
 * WHAT THE LAW IS, AND WHY IT IS PHRASED THIS WAY. The assertion is
 * `surface === projection`, never `surface_a === surface_b`. Two surfaces that
 * drifted together would satisfy the weaker form, and surfaces agreeing with each
 * other's mistakes is the whole failure being replaced. Until `project()` exists
 * (stage 2 of the build), the CANONICAL answer is taken from the one place that is
 * already a single derivation of accepted state — `buildProgramTabProjectedWeek` —
 * and each pixel-bearing surface is compared to IT. That is exactly the finding
 * the reassessment named: no screen imports it, so every screen is free to differ.
 *
 * REPRODUCTION STATUS, 2026-07-30 — read this before trusting a pass.
 *
 * Only cell 2 goes red today. Cells 1, 3 and 4 PASS, and they pass because this
 * harness cannot yet reach the surface that actually disagreed on his phone:
 *
 *   - The DETAIL TITLE and DETAIL CONTENT come from `useDayWorkout`, a React hook
 *     that re-derives conditioning identity, option titles and row grouping at
 *     render. It cannot be called from a node harness, so cells 1 and 2 currently
 *     compare `resolveWeekWithConditioning` (the card's source) against
 *     `buildProgramTabProjectedWeek` (the canonical one) — TWO DOMAIN
 *     projections. Those two agree here. The third and fourth stories, which are
 *     the ones he photographed, are not in this comparison at all.
 *   - Cell 4 passes because in a freshly-acted world the G+1 Sunday DOES resolve
 *     a session. His device reached that day after a session's worth of edits;
 *     the add-only menu is a property of that state, not of a clean generate.
 *
 * This is the `harness-enters-below-the-door` failure for the third time, now on
 * the render side, and it is recorded rather than worked around: the honest fix is
 * to make the detail surface callable — extract `useDayWorkout`'s composition into
 * a pure function the harness can call, which is stage 4's first move anyway
 * because that composition is one of the nine paths being retired. Until then a
 * pass in cells 1/3/4 means "the two domain projections agree", NOT "the surfaces
 * agree", and must not be read as the defect being absent.
 *
 * Cell 2's red is real and is defect 2's inverse split: adding conditioning to a
 * recovery day leaves parts ["conditioning"] — the recovery is gone from the
 * projection itself, so no surface can render it.
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
import { composeDayDetail } from '../utils/dayDetailComposition';
import { projectParts } from '../rules/projectVisibleWeek';
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
 * THE DETAIL SURFACE'S OWN STORY — now reachable.
 *
 * `composeDayDetail` is `useDayWorkout`'s composition, extracted verbatim. This is
 * the third story Sam photographed, and until the extraction it could not be
 * compared to anything from a harness.
 */
function detailStory(workout: Workout | null | undefined): {
  title: string | null; parts: string[];
} {
  const composed = composeDayDetail(workout ?? null, workout ?? null);
  const parts: string[] = [];
  if (composed.strengthExercises.length > 0) parts.push('strength');
  if (composed.supportExercises.length > 0) parts.push('support');
  if (composed.conditioningRowCount > 0) parts.push('conditioning');
  if (composed.isRecovery) parts.push('recovery');
  if (composed.hasTeamTraining) parts.push('team_training');
  return { title: workout?.name ?? null, parts };
}

/**
 * The CANONICAL parts, from `project()` — the one projection.
 *
 * `projectParts` rather than `project` because these laws are structural and must
 * not wait on Sam's copy rulings; it is the same derivation with the copy lookup
 * not yet applied, not a second one.
 */
function canonicalPartKinds(week: string, date: string): string[] {
  const projected = projectParts({ week: projectedWeek(week), weekStart: week });
  const day = projected.days.find((candidate) => candidate.date === date);
  return (day?.parts ?? []).map((part) => part.kind);
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

  // THE THIRD SURFACE — the detail screen's own composition, now callable.
  // Compared against `project()`'s part kinds, which is the one canonical answer.
  const detail = detailStory(canonical.workout);
  const canonicalKinds = Array.from(new Set(canonicalPartKinds(week, date))).sort();
  const detailKinds = Array.from(new Set(detail.parts)).sort();
  assert(JSON.stringify(detailKinds) === JSON.stringify(canonicalKinds),
    `${context} — L-P3: the DETAIL screen and the projection disagree about what is `
    + `on ${date}. detail ${JSON.stringify(detailKinds)} / projection `
    + `${JSON.stringify(canonicalKinds)}. This is the third story: the detail `
    + 'composes its own account at render.');
}

console.log('\n-- Surface agreement (L-P1/L-P3) — STAGE 3 REDS, ungated by design --');

run('(1) adding strength to the G+1 recovery Sunday tells ONE story', () => {
  reachHisWorldByActing();
  const added = tap({ kind: 'add_category', date: '2026-08-02', category: 'strength_full' } as PlanChange);
  assert(added.outcome === 'applied',
    `the door refused the add (${added.outcome}: "${added.message}") — this cell is `
    + 'about surfaces, and the tape shows the door accepting');
  assertSurfacesAgree('2026-08-02', 'defect 1, G+1 recovery Sunday + Full Body Strength');
});

run('(2) adding hard conditioning to a recovery day keeps recovery visible', () => {
  reachHisWorldByActing();
  const added = tap({ kind: 'add_category', date: '2026-08-02', category: 'conditioning_hard' } as PlanChange);
  assert(added.outcome === 'applied',
    `the door refused the add (${added.outcome}: "${added.message}")`);
  assertSurfacesAgree('2026-08-02', 'defect 2, recovery day + hard intervals');

  // The inverse split, named: the card dropped recovery, the detail swallowed the
  // intervals into the recovery template. Either way, BOTH parts exist and both
  // surfaces must show both.
  const canonical = dayFrom(projectedWeek(mondayFor('2026-08-02')), '2026-08-02');
  const parts = partIds(canonical?.workout);
  assert(parts.includes('recovery') || parts.includes('recovery_addon'),
    `defect 2: after adding conditioning the projection no longer shows recovery at `
    + `all — parts ${JSON.stringify(parts)}. Adding work to a day must not delete `
    + 'the work already on it.');
  assert(parts.some((part) => part === 'conditioning' || part === 'finisher'),
    `defect 2: the conditioning the athlete added is not a part — `
    + `${JSON.stringify(parts)}. It was embedded inside the recovery template `
    + 'instead of standing beside it.');
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

run('(4) a recovery day is offered the same capabilities as any other day', () => {
  // Sam's ruling 3: recovery is a day type like any other — same menu
  // capabilities, same editing rules. The menu derives capability from
  // `workout.sections.map(kind)` and `hasSession = workout !== null`, and a G+1
  // recovery day is resolver-owned derived filler with no composed placeholder,
  // so it presents as not-a-day and collapses to add-only.
  reachHisWorldByActing();
  const recoveryDay = quiet(() => listPlanChangeOptionsForDay({
    visibleWeek: cardWeek(mondayFor('2026-08-02')), date: '2026-08-02', todayISO: TODAY,
  }));
  assert(recoveryDay.hasSession,
    'defect 4: the G+1 recovery Sunday is not considered to have a session, so the '
    + 'menu offers add only. Recovery is a day type like any other.');
  assert(recoveryDay.canRemove,
    'defect 4: a recovery day cannot be removed while a strength day can');
  assert(!recoveryDay.move.refusal,
    `defect 4: a recovery day is offered no move — "${recoveryDay.move.refusal?.message}"`);
});

console.log(`\nSurface agreement totals: ${passed} passed, ${failed} failed`);
console.log('  STAGE 3: these are the reds owed before any surface moves. They enter');
console.log('  test:bible in their GREEN commit (Sam\'s process ruling), not before.');
if (failed > 0) {
  console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
  // Exit 0 DELIBERATELY: ungated by design at stage 3. Turning this into a
  // non-zero exit before the surfaces move would break Sam's "gate stays green
  // after every stage, branch mergeable at all times".
  process.exit(0);
}
