/**
 * THE DAY-FIRST TIMELINE — SHOWN, NEVER WRITTEN.
 *
 * Slice 1 of Sam's day-first UI unit (docs/DAY_FIRST_UI_UNIT_PLAN_2026-08-07.md,
 * ruled fork A on 2026-08-07): the Program tab leads with today, the week is a
 * strip above it, and the day's session is a tappable component timeline.
 *
 * WHAT THIS SUITE HOLDS, AND WHY EACH CELL EXISTS:
 *
 *   1. THE PART ID HAS ONE OWNER, BOTH WAYS. `partIdFor`/`componentIdFromPartId`
 *      round-trip on ids the PROJECTION minted, not on strings this file wrote.
 *      L12's class for this unit is "a surface that re-derives an identity the
 *      projection already carries"; the gate against it is that there is one
 *      helper and it is correct on real ids.
 *   2. THE TIMELINE IS THE PROJECTION'S PARTS. Same ids, same order, no filter.
 *      A `kind` branch or a "recovery renders differently" case added to the
 *      day-first surface reds here, exactly as it would in `visibleDayDetail`.
 *   3. EVERY WORD IS SIGNED (L-P2 for the new surface).
 *   4. `null` IS NOT `skipped`. Two different facts; the athlete said one.
 *   5. A SAVED OUTCOME SHOWS, AND ONLY ON WHAT IT NAMES.
 *   6. THE LEGACY LIFT STILL LIFTS — or a session the card badges "Done" shows
 *      an unticked timeline, which is one screen telling two stories.
 *   7. TWO PARTS OF ONE KIND BOTH SURVIVE. `COMPONENT_TO_PART` is many-to-one;
 *      keying a timeline by kind loses work the athlete has to do.
 *   8. THE TIMELINE WRITES NOTHING — frozen inputs, and no writer in its module.
 *      This is fork A stated as a gate rather than as an intention.
 *   9. EVERY DAY STILL REPORTS ITSELF. The day-first shape draws six of its days
 *      as strip chips; their canonical state leaves must mount all the same.
 *  10. NO CLOCK TIMES, AND THE SHAPE IS PINNED. Sam's direction, and the entry
 *      shape is fixed so a future time field cannot arrive unnoticed.
 *
 * Run: npm run test:day-first-timeline
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
  throw new Error('NETWORK DISABLED');
};
process.env.TZ = 'Australia/Melbourne';

import * as fs from 'fs';
import * as path from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import type { TrainingProgram, Workout } from '../types/domain';
import {
  clampProgramWeekOffset,
  programWeekOffsetBounds,
  type ResolvedDay,
} from '../utils/sessionResolver';
import { generateProgramLocally } from '../services/api/generateProgram';
import { useProgramStore } from '../store/programStore';
import { applyProfileOnboardingWrite } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { createEmptyReversibleAdjustmentLedger } from '../rules/reversibleAdjustmentLedger';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { buildProgramTabProjectedWeek } from '../utils/visibleProgramReadModel';
import { getSessionComponents, type SessionComponentKind } from '../utils/sessionComponents';
import {
  componentIdFromPartId,
  partIdFor,
  project,
  projectParts,
} from '../rules/projectVisibleWeek';
import { dayTimeline } from '../rules/dayTimeline';
import {
  buildSessionExecutionPlan,
  buildSessionExecutionSummary,
  reconcileRecordedSessionExecution,
  recordedCompletedSessionExecutionItemIds,
} from '../utils/sessionExecutionChecklist';
import { buildSessionTemplate } from '../utils/sessionTemplate';
// The exhibit is found by its power ROWS now — the part it used to be found
// by is exactly what Sam's 2026-08-20 ruling deleted.
import { powerRows } from '../rules/sessionRowCounting';
import { visibleDayLeadBucket, visibleDayLeadHeadline } from '../rules/visibleDayDetail';
import { isSignedCopyText, joinSignedCopy, signedCopy } from '../rules/signedCopy';
import { registerProjectionCopy } from '../rules/projectionCopy';
import type { VisibleDay } from '../rules/visibleProjection';
import type { SessionFeedback } from '../store/programStore';
import { samExport8Profile, SAM_EXPORT_8_TODAY_ISO, SAM_EXPORT_8_CURRENT_WEEK } from './support/samDeviceExport8Fixture';
import { stripComments } from './support/sourceText';

/**
 * THE ANCHOR FOR THE PROJECTED-ENTRY LOOP, in one place.
 *
 * It was the literal `{entries.map((entry) => {` in two cells, and both missed
 * silently the day the loop learned to filter: club training left the session
 * box for its own card on 2026-08-22 (Sam), so the loop reads
 * `entries.filter(...).map(...)`. Two copies of an anchor are two chances to
 * point at nothing — `.indexOf` returning -1 is what the repo's own
 * unproven-anchor law is about.
 */
const PROJECTED_ENTRY_LOOP = '{entries.filter((entry) => entry.kind !== \'team_training\').map((entry) => {';


let passed = 0; let failed = 0; const failures: string[] = [];
function assert(c: unknown, d: string): asserts c { if (!c) throw new Error(d); }
function run(name: string, body: () => void): void {
  try { body(); passed += 1; console.log(`  PASS ${name}`); }
  catch (e) { failed += 1; failures.push(name); console.error(`  FAIL ${name}\n      ${e instanceof Error ? e.message : e}`); }
}
function quiet<T>(b: () => T): T {
  const w = console.warn, e = console.error, d = console.debug, i = console.info, l = console.log;
  console.warn = console.error = console.debug = console.info = console.log = (() => undefined) as never;
  try { return b(); } finally { console.warn = w; console.error = e; console.debug = d; console.info = i; console.log = l; }
}

const TODAY = SAM_EXPORT_8_TODAY_ISO;
const WEEK = SAM_EXPORT_8_CURRENT_WEEK;
const WEEKS = [WEEK, '2026-08-03', '2026-08-10'];

/**
 * A REAL GENERATED WEEK, NOT A HAND-BUILT ONE.
 *
 * The profile is an INPUT (onboarding answers); the program is generated from it
 * by the real generator, exactly as `projectionOwnershipTests` does. Nothing here
 * seeds a derived state — a seed asserts a world nobody arrived at by acting
 * (AGENTS.md), and every claim below is about ids and words a real week produces.
 */
function world(): void {
  localStorageData.clear();
  const profile = samExport8Profile();
  // THROUGH THE OWNED DOOR, NOT AROUND IT. `profileMirrorNarrowingTests`'
  // one-door census counts every test source that assigns `onboardingData`
  // directly, and its ~50 declared entries are DEBT, not permission — a new
  // suite joining that list would push a ratchet that has only moved down this
  // era. `applyProfileOnboardingWrite` is the write owner; this suite has no
  // reason to need the back way in, so it does not take it.
  applyProfileOnboardingWrite({
    next: profile,
    writer: 'onboarding_step',
    isOnboardingComplete: true,
  });
  useCalendarStore.setState({ markedDays: {}, selectedDate: null } as never);
  useReadinessStore.setState({ signalsByDate: {} } as never);
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null } as never);
  const program = quiet(() => generateProgramLocally(profile, {
    todayISO: '2026-07-13',
    previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1,
      selectedPhase: 'Pre-season',
      phaseEntryWeekStartISO: '2026-07-13',
      originProvenance: 'explicit_user_phase_change',
      persistenceProvenance: 'preserved_persisted_state',
    },
  })) as TrainingProgram;
  const his = program.microcycles.find((m) => m.startDate.slice(0, 10) === WEEK) ?? null;
  useProgramStore.setState({
    currentProgram: program, currentMicrocycle: his, todayWorkout: null,
    isGenerating: false, isLoading: false, error: null, blockState: null,
    acceptedMaterialContext: {
      markedDays: {}, readinessSignalsByDate: {}, activeConstraints: [], activeInjury: null,
      revision: 1, lastTransaction: 'day-first-timeline:generate',
      injuryEpisodes: [], temporarySourceFacts: [],
      acceptedCompositionBase: null, acceptedProfileSnapshot: null,
    },
    dateOverrides: {}, overrideContexts: {}, weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {}, sessionFeedback: {}, weightOverrides: {},
  } as never);
  quiet(() => useCalendarStore.getState().setGameDay('2026-08-01', TODAY));
}

function projected(week: string): ResolvedDay[] {
  return quiet(() => buildProgramTabProjectedWeek({
    mondayISO: week,
    todayISO: TODAY,
    state: buildScheduleStateImperative(),
    overrideContexts: useProgramStore.getState().overrideContexts ?? {},
  }));
}

function visibleDays(week: string): readonly VisibleDay[] {
  return quiet(() => project({ week: projected(week), weekStart: week })).days;
}

/** Every component id the app can emit — the closed union, spelled out. */
const COMPONENT_IDS: readonly SessionComponentKind[] = [
  'power', 'strength', 'mobility', 'support', 'conditioning', 'team_training',
  'speed', 'finisher', 'recovery_addon', 'recovery', 'session',
];

console.log('\n-- Day-first timeline (slice 1: completion shown, not written) --');

run('the part id round-trips through its one owner, on ids the projection minted', () => {
  world();
  let checked = 0;
  for (const week of WEEKS) {
    for (const day of visibleDays(week)) {
      for (const part of day.parts) {
        const componentId = componentIdFromPartId(part.id);
        assert((COMPONENT_IDS as readonly string[]).includes(componentId),
          `${part.id}: recovered "${componentId}", which is not a component id. The `
          + 'part id\'s two halves have drifted apart.');
        assert(partIdFor(day.date, componentId) === part.id,
          `${part.id}: does not round-trip — partIdFor(${day.date}, ${componentId}) `
          + `is "${partIdFor(day.date, componentId)}"`);
        checked += 1;
      }
    }
  }
  // NON-VACUITY. A week with no parts would pass every assertion above by
  // never running one, and that is exactly how a green gate lies.
  assert(checked > 10,
    `only ${checked} part ids were checked across ${WEEKS.length} weeks — the round `
    + 'trip is unexercised, so this cell proves nothing');
  console.log(`      round-tripped ${checked} part ids (occurrences; `
    + `${new Set(COMPONENT_IDS).size} distinct component ids possible)`);
});

run('the timeline IS the projection\'s parts — same ids, same order, no filter', () => {
  world();
  for (const week of WEEKS) {
    for (const day of visibleDays(week)) {
      const entries = dayTimeline(day, null);
      const timelineIds = entries.map((entry) => entry.partId);
      const projectionIds = day.parts.map((part) => part.id);
      assert(JSON.stringify(timelineIds) === JSON.stringify(projectionIds),
        `${day.date}: the timeline shows ${JSON.stringify(timelineIds)} and the `
        + `projection carries ${JSON.stringify(projectionIds)}. \`parts\` is the only `
        + 'plural; a surface showing a different list has composed its own.');
      for (const [index, entry] of entries.entries()) {
        assert(entry.kind === day.parts[index].kind,
          `${entry.partId}: the timeline calls it ${entry.kind}, the projection `
          + `${day.parts[index].kind}`);
        assert(entry.headline === day.parts[index].headline,
          `${entry.partId}: the timeline renamed the part`);
      }
    }
  }
});

run('every word the timeline renders is signed', () => {
  world();
  let words = 0;
  for (const week of WEEKS) {
    for (const day of visibleDays(week)) {
      for (const entry of dayTimeline(day, null)) {
        assert(isSignedCopyText(entry.headline),
          `${entry.partId}: unregistered headline "${entry.headline}" reached the `
          + 'day-first timeline (L-P2)');
        words += 1;
      }
    }
  }
  assert(words > 10, `only ${words} headlines were checked — the cell is vacuous`);
});

run('no saved outcome means unanswered, never skipped', () => {
  world();
  for (const week of WEEKS) {
    for (const day of visibleDays(week)) {
      for (const entry of dayTimeline(day, null)) {
        assert(entry.completion === null,
          `${entry.partId}: reads "${entry.completion}" with nothing saved. An `
          + 'unanswered component is not a skipped one — the athlete said neither.');
      }
    }
  }
});

run('a saved outcome shows on the components it names, and only those', () => {
  world();
  const day = visibleDays(WEEK).find((candidate) => candidate.parts.length >= 2)
    ?? visibleDays(WEEK).find((candidate) => candidate.parts.length === 1);
  assert(day, 'no day in the generated week carries a part to record an outcome on');
  const first = componentIdFromPartId(day.parts[0].id);
  const feedback = {
    dateStr: day.date,
    completion: 'full',
    components: [
      { componentId: first, kind: first, label: first, completion: 'partial' },
      // A component the day does not carry. It must be ignored rather than
      // appearing as a row — a saved outcome can outlive the session it named.
      { componentId: 'speed', kind: 'speed', label: 'speed work', completion: 'full' },
    ],
  } as unknown as SessionFeedback;

  const entries = dayTimeline(day, feedback);
  assert(entries.length === day.parts.length,
    `the outcome changed the part list: ${entries.length} rows for ${day.parts.length} parts`);
  assert(entries[0].completion === 'partial',
    `${entries[0].partId}: the saved outcome recorded "partial" and the timeline shows `
    + `"${entries[0].completion}"`);
  for (const entry of entries.slice(1)) {
    if (entry.componentId === 'speed') continue;
    assert(entry.completion === null,
      `${entry.partId}: shows "${entry.completion}" though the outcome never named it`);
  }
});

run('a legacy single-component outcome still ticks its one component', () => {
  world();
  const day = visibleDays(WEEK).find((candidate) => candidate.parts.length === 1);
  assert(day,
    'the generated weeks carry no single-component day, so the legacy lift is '
    + 'unexercised here — find one or the cell is vacuous');
  // A saved outcome from before component-level completions: no `components[]`
  // at all. The card badges this day "Done" off its receipt; without the lift the
  // timeline would show it unticked, and one screen would tell two stories.
  const legacy = { dateStr: day.date, completion: 'full' } as unknown as SessionFeedback;
  const entries = dayTimeline(day, legacy);
  assert(entries.length === 1, `expected one entry, got ${entries.length}`);
  assert(entries[0].completion === 'full',
    `${entries[0].partId}: the legacy session-level completion did not lift onto its `
    + `one component (reads "${entries[0].completion}")`);
});

run('the day card and reopened checklist reconcile one saved result against one current plan', () => {
  world();
  const resolved = projected(WEEK).find((candidate) => candidate.workout
    && getSessionComponents(candidate.workout).some((component) => component.kind === 'strength'));
  assert(resolved?.workout, 'the generated week has no strength session to edit after logging');
  const day = visibleDays(WEEK).find((candidate) => candidate.date === resolved.date);
  assert(day, `the visible projection lost the chosen session on ${resolved.date}`);

  const beforeWorkout = resolved.workout as Workout;
  const beforePlan = buildSessionExecutionPlan({
    workout: beforeWorkout,
    template: buildSessionTemplate(beforeWorkout),
    mobilityFlow: null,
  });
  const completedBefore = new Set(beforePlan.items
    .filter((item) => item.sectionId !== 'optional')
    .map((item) => item.id));
  const feedback = {
    dateStr: resolved.date,
    completion: 'full',
    components: beforePlan.components.map((component) => ({
      componentId: component.id,
      kind: component.kind,
      label: component.label,
      completion: 'full' as const,
    })),
    executionItems: buildSessionExecutionSummary(beforePlan, completedBefore).items,
  } as unknown as SessionFeedback;

  const changedWorkout = {
    ...beforeWorkout,
    exercises: [
      ...(beforeWorkout.exercises ?? []),
      {
        id: 'added-after-session-was-logged',
        exerciseId: 'added-after-session-was-logged',
        prescribedSets: 3,
        prescribedRepsMin: 6,
        prescribedRepsMax: 8,
        exercise: { id: 'added-after-session-was-logged', name: 'Added lift' },
      },
    ],
  } as Workout;
  const currentPlan = buildSessionExecutionPlan({
    workout: changedWorkout,
    template: buildSessionTemplate(changedWorkout),
    mobilityFlow: null,
  });
  const reopenedIds = recordedCompletedSessionExecutionItemIds(currentPlan, feedback);
  const strengthEntry = dayTimeline(
    day,
    feedback,
    changedWorkout,
    reconcileRecordedSessionExecution(currentPlan, feedback),
  )
    .find((entry) => entry.kind === 'strength');
  assert(strengthEntry,
    `the changed session has no Strength row: ${JSON.stringify(day.parts.map((part) => part.kind))}`);
  assert(strengthEntry.completion === null,
    `the day card says Strength is ${String(strengthEntry.completion)} while the reopened `
    + `checklist restores ${reopenedIds.size}/${currentPlan.items.length} exact item ids`);
  assert(reopenedIds.size < currentPlan.items.length,
    'the changed-plan exhibit did not add an unknown row, so the agreement assertion is vacuous');
});

run('two parts of one kind both survive — the timeline keys on id, not kind', () => {
  registerProjectionCopy();
  // REACHABILITY FIRST. The unit plan named conditioning + finisher as the live
  // collision; measuring the emitter REFUTES that pair — `getSessionComponents`
  // chooses ONE of them from `attachedConditioningKind` and can never emit both.
  // The pair that IS reachable is recovery + recovery_addon, and this is it.
  const workout = {
    id: 'recovery-with-addon',
    workoutType: 'Recovery',
    exercises: [],
    recoveryAddons: [{ exercises: [{ id: 'addon-row', name: 'Easy Swim' }] }],
  } as never;
  const componentIds = getSessionComponents(workout).map((component) => component.id);
  assert(JSON.stringify(componentIds) === JSON.stringify(['recovery', 'recovery_addon']),
    'the recovery + recovery-addon shape no longer emits two components — it emits '
    + `${JSON.stringify(componentIds)}. If that is deliberate, this cell needs the `
    + 'new reachable collision, not deleting.');

  const structural = projectParts({
    week: [{ date: '2026-08-10', source: 'plan', workout } as never],
    weekStart: '2026-08-10',
  });
  const kinds = structural.days[0].parts.map((part) => part.kind);
  const ids = structural.days[0].parts.map((part) => part.id);
  assert(kinds.length === 2 && kinds[0] === kinds[1],
    `expected two parts of one kind, got ${JSON.stringify(kinds)}`);
  assert(ids[0] !== ids[1], 'the two parts share an id, so nothing can tell them apart');

  // AND THE TIMELINE KEEPS BOTH. Built from the structural parts with registered
  // headlines rather than from `project()`, so the cell tests the KEYING and does
  // not also depend on a recovery add-on's row names being on the copy sheet.
  const day = {
    date: '2026-08-10',
    kind: 'training',
    owner: 'plan',
    headline: signedCopy('day.headline.training'),
    capabilities: { canAdd: true, canMoveWholeDay: false, canRemoveWholeDay: true, refusal: null },
    parts: structural.days[0].parts.map((part) => ({
      ...part,
      headline: signedCopy(`part.headline.${part.kind}`),
      detail: null,
      rows: [],
    })),
  } as unknown as VisibleDay;

  const entries = dayTimeline(day, null);
  assert(entries.length === 2,
    `the timeline shows ${entries.length} of 2 parts — a list keyed by kind loses work `
    + 'the athlete has to do');
  assert(entries[0].componentId === 'recovery' && entries[1].componentId === 'recovery_addon',
    `the timeline recovered ${JSON.stringify(entries.map((e) => e.componentId))}`);
});

run('the timeline writes nothing — frozen inputs, and no writer in its module', () => {
  world();
  const day = visibleDays(WEEK).find((candidate) => candidate.parts.length > 0);
  assert(day, 'no day with parts to read');
  const feedback = {
    dateStr: day.date,
    completion: 'full',
    components: [{
      componentId: componentIdFromPartId(day.parts[0].id),
      kind: 'strength', label: 'strength work', completion: 'full',
    }],
  } as unknown as SessionFeedback;

  // FORK A AS A GATE, NOT AN INTENTION. A frozen input throws on assignment in
  // strict mode and silently ignores it otherwise — so the values are compared
  // as well, and either way a write is caught.
  const before = JSON.stringify(feedback);
  Object.freeze(feedback);
  Object.freeze((feedback as unknown as { components: unknown[] }).components);
  Object.freeze(day);
  Object.freeze(day.parts);
  dayTimeline(day, feedback);
  assert(JSON.stringify(feedback) === before,
    'dayTimeline mutated the saved outcome it was handed');

  const source = stripComments(
    fs.readFileSync(path.join(__dirname, '..', 'rules', 'dayTimeline.ts'), 'utf8'),
  );
  for (const writer of [
    'commitSessionOutcomeTransaction',
    'useProgramStore',
    'setState',
    'recordSessionOutcome',
  ]) {
    assert(!source.includes(writer),
      `rules/dayTimeline.ts reaches ${writer}. Slice 1 SHOWS completion and never `
      + 'writes it — there is no per-component door in this app and this unit does '
      + 'not invent one (Sam, fork A, 2026-08-07).');
  }
});

run('every day still reports its canonical state leaves in the day-first shape', () => {
  // The day-first view draws six of its seven days as strip chips. Their state
  // leaves are what the dev-e2e explorer resolves mutations against, so they must
  // mount in BOTH shapes — a view that drew fewer of them would make six of the
  // athlete's days look, to the explorer, as though they had stopped existing.
  const home = stripComments(
    fs.readFileSync(
      path.join(__dirname, '..', 'screens', 'home', 'HomeScreenV2.tsx'),
      'utf8',
    ),
  );
  // COUNTING THE CALL SITES IS NOT ENOUGH, AND THAT WAS MEASURED. The first
  // version of this cell counted `<DayStateLeaves` occurrences and PASSED against
  // a mutation that emptied the loop feeding them (`weekDays.map` -> `[].map`) —
  // the count was right and the days were gone. A call site that iterates nothing
  // mounts nothing, so the gate reads the day-first block itself.
  const mounts = home.match(/<DayStateLeaves\b/g) ?? [];
  assert(mounts.length === 2,
    `HomeScreenV2 mounts <DayStateLeaves> ${mounts.length} time(s). It must mount `
    + 'inside the full-size row AND for the days the strip stands in for — exactly '
    + 'two call sites.');
  const dayFirstBlock = home.slice(
    home.indexOf('{dayFirst ? ('),
    home.indexOf('<View style={styles.dayList}>'),
  );
  assert(dayFirstBlock.length > 200,
    'the day-first block could not be located in HomeScreenV2 — this gate is '
    + 'reading the wrong region and would pass on anything');
  assert(/weekDays\.map\(/.test(dayFirstBlock) && /<DayStateLeaves\b/.test(dayFirstBlock),
    'the day-first shape no longer mounts a state leaf for EVERY day of the week. '
    + 'Six of the athlete\'s days are drawn as strip chips there; if their leaves '
    + 'stop mounting, the explorer sees six days that have ceased to exist.');
  assert(/idx === dayFirstIdx \? null :/.test(dayFirstBlock),
    'the day-first block no longer skips the day it draws at full size — that day '
    + 'would mount its leaves twice, and a duplicate testID is a finder that picks '
    + 'one of two nodes at random.');
  assert(/function dayStateToken\(/.test(home),
    'the day state token no longer has one owner — two copies is two answers about '
    + 'what a day is, and the explorer reads whichever one rendered');
  assert(/const dayFirst = /.test(home) && /preferredProgramView/.test(home),
    'the day-first shape is gone from HomeScreenV2; this gate is watching nothing');
});

// ─────────────────────────────────────────────────────────────────────────────
// SLICE 2 — THE LAYOUT AND THE CHIP ROW (Sam's ruling, 2026-08-08)
//
// Sam named the spine himself: Today/Week toggle → the seven-day strip with the
// numbers directly under it → today's card → the life-fact chip row → Coach
// Notes. Slice 2 is presentation: five stacked bars become one row of chips and
// two blocks change places. So these cells watch ORDER and DOORS, which are the
// two things a "presentation only" change is allowed to leave alone — and the
// only two things that would prove it did not.
//
// SOURCE-SCAN LAW (`a count taken for a record`, sighting 4, which fired inside
// this very suite): word-boundary the count, read the REGION that runs it, and
// prove the region was found before believing anything it says.
// ─────────────────────────────────────────────────────────────────────────────

/** The file every slice-2 cell reads, comments stripped so a comment cannot pass a gate. */
function homeScreenSource(): string {
  return stripComments(fs.readFileSync(
    path.join(__dirname, '..', 'screens', 'home', 'HomeScreenV2.tsx'), 'utf8',
  ));
}

/**
 * THE CARD ITSELF LIVES IN A SHARED COMPONENT NOW (2026-08-19).
 *
 * The Day screen composes the LIST — which three doors, with which testIDs —
 * and `components/SessionChangeHub` draws the card, the heading, the sub-line,
 * the circles, the tints and the three glyphs. So the cells below read the
 * SCREEN for the doors and this file for the picture, which is the same split
 * `test:session-change-hub` already uses.
 *
 * ⚠ **A CELL THAT READ ONLY THE SCREEN WOULD NOW PASS ON A CARD WITH NO
 * PICTURES IN IT AT ALL.**
 */
function changeHubSource(): string {
  return stripComments(fs.readFileSync(
    path.join(__dirname, '..', 'components', 'SessionChangeHub.tsx'), 'utf8',
  ));
}

run('the live Program screen owns one persistent Day/Week choice across weeks', () => {
  const wrapper = stripComments(fs.readFileSync(
    path.join(__dirname, '..', 'screens', 'home', 'HomeScreen.tsx'), 'utf8',
  ));
  const home = homeScreenSource();
  const toggle = home.slice(
    home.indexOf('<View style={styles.viewToggle} testID="program-view-toggle">'),
    home.indexOf('{/* WEEK NAVIGATION BELONGS TO THE WEEK SHAPE.'),
  );

  assert(/const DESIGN_VERSION: DesignVersion = 'v2'/.test(wrapper)
    && /return <HomeScreenV2\s*\/>/.test(wrapper),
  'the navigator wrapper no longer proves that HomeScreenV2 is the live Program screen');
  assert(toggle.length > 500,
    'the Day/Week toggle region was not found; this guard would otherwise pass over nothing');
  assert(!/isThisWeek\s*&&\s*isNormal/.test(toggle),
    'the live Day/Week toggle is still conditional on this week, so it disappears after Next week');
  assert(/const dayFirst = preferredProgramView === 'today' && isNormal/.test(home),
    'the Day preference is still being reinterpreted by week position instead of remaining the chosen view');
});

run('week navigation is bounded by the saved program dates, whatever its length', () => {
  const todayISO = '2026-08-12';
  const oneDay = programWeekOffsetBounds({
    startDate: '2026-08-12T00:00:00.000Z',
    endDate: '2026-08-12T00:00:00.000Z',
  }, todayISO);
  assert(oneDay.min === 0 && oneDay.max === 0,
    `a program starting and ending today resolved to ${JSON.stringify(oneDay)}`);

  const unevenProgramSpan = programWeekOffsetBounds({
    startDate: '2026-08-05T00:00:00.000Z',
    endDate: '2026-09-11T00:00:00.000Z',
  }, todayISO);
  assert(unevenProgramSpan.min === -1 && unevenProgramSpan.max === 4,
    `the real dated span was replaced by a fixed block assumption: ${JSON.stringify(unevenProgramSpan)}`);
  assert(clampProgramWeekOffset(-2, unevenProgramSpan) === -1,
    'Previous week escaped before the first week containing programmed dates');
  assert(clampProgramWeekOffset(5, unevenProgramSpan) === 4,
    'Next week escaped after the final week containing programmed dates');
  assert(clampProgramWeekOffset(2, unevenProgramSpan) === 2,
    'an in-program week was incorrectly blocked');

  const noProgram = programWeekOffsetBounds(null, todayISO);
  assert(noProgram.min === 0 && noProgram.max === 0,
    'an athlete with no program can browse invented past/future weeks');

  const schedule = stripComments(fs.readFileSync(
    path.join(__dirname, '..', 'hooks', 'useSchedule.ts'), 'utf8',
  ));
  const ownerAt = schedule.indexOf('const weekBounds = programWeekOffsetBounds(');
  const owner = schedule.slice(ownerAt, schedule.indexOf('return {', ownerAt));
  assert(ownerAt > 0 && owner.length > 1200,
    'the live week-navigation owner was not found; this guard would otherwise pass over nothing');
  assert(/programWeekOffsetBounds\(state\.currentProgram, todayISOLocal\(\)\)/.test(owner)
    && /const canGoPrev = boundedWeekOffset > weekBounds\.min/.test(owner)
    && /const canGoNext = boundedWeekOffset < weekBounds\.max/.test(owner),
  'the live hook does not derive both arrow edges from the saved current program');

  const home = homeScreenSource();
  const navAt = home.indexOf('testID="program-week-navigation"');
  const navEnd = home.indexOf('{dayFirst ? (', navAt);
  const nav = home.slice(navAt, navEnd);
  assert(navAt > 0 && navEnd > navAt && nav.length > 1000,
    'the live week-navigation region was not found; this guard would otherwise pass over nothing');
  assert(/disabled=\{!canGoPrev\}[\s\S]{0,180}testID="program-week-previous"/.test(nav)
    && /disabled=\{!canGoNext\}[\s\S]{0,180}testID="program-week-next"/.test(nav),
  'the visible arrow controls can still be tapped beyond the program-date edges');
});

/**
 * THE THREE STATUS DOORS THAT REMAIN ON THE DAY SCREEN.
 *
 * Taken from the five bars this row replaces. Each row is what the athlete's tap
 * must still reach: the handler it calls and the coordinate the walker, the
 * explorer and the dev-e2e finder resolve it by. A chip that minted a new testID
 * from its own label would be a silent rename of five doors, and every one of
 * them is a door Sam has tapped on a device.
 *
 * **AWAY LEFT THIS ROW ON 2026-08-13 (SEAT_INBOX item 28).** Sam: *"I think the
 * away button should live on the weekly screen"*. It is INVERTED rather than
 * deleted — the cell below asserts it is absent here and present there, because
 * a move that only deletes is how a door quietly stops existing.
 */
const LIFE_FACT_DOORS: readonly {
  readonly id: string; readonly label: string;
  readonly onPress: string; readonly testID: string;
}[] = [
  { id: 'tired', label: 'Tired', onPress: "setReadinessEntry('flat')", testID: "testID: 'home-tired-entry'" },
  { id: 'sick', label: 'Sick', onPress: "setReadinessEntry('sick')", testID: 'explorerTestId.readinessUpdate(weekReadiness.id)' },
  { id: 'injured', label: 'Injured', onPress: 'setReadinessInjuryVisible(true)', testID: "testID: 'home-injured-entry'" },
  // ── FOUR -> THREE, AND THE FOURTH IS SUPERSEDED, NOT FORGOTTEN ─────────────
  //
  // A `Remove` chip lived here for one day. It was raised on 2026-08-19 —
  // *"the required trigger is not complete until the athlete can clearly tap a
  // labelled Remove action"* — because the only route to a removal was then an
  // unlabelled icon on a pushed session screen.
  //
  // **SAM SUPERSEDED IT THE SAME DAY**, once that labelled route existed on the
  // session screen itself: *"DAY PAGE: exactly Tired, Sick and Injured … NO
  // Remove, Equipment, Add or Swap."* The requirement was never "Remove must be
  // on the Day screen" — it was "a labelled Remove must exist", and the session
  // hub is where it now is. See `test:session-change-hub` [9].
  //
  // ⚠ **ONE THING WAS LOST WITH IT AND IS NAMED HERE RATHER THAN ABSORBED.**
  // `UndoToast` mounts on the Program screen and nowhere else, so a removal
  // driven from the pushed session screen raises its toast on the screen
  // BEHIND it. The Day chip had been hiding that. It is recorded as a finding
  // in `docs/STATUS_ORCHESTRATOR.md`; it is not this cell's to fix, and a
  // second toast mount would breach the one-mount ruling.
];

run('the screen is in the order Sam ruled: toggle, card, then change controls', () => {
  const home = homeScreenSource();
  const at = (needle: string): number => {
    const index = home.indexOf(needle);
    assert(index >= 0, `the day-first spine no longer contains ${needle} — this gate `
      + 'is reading a screen that has been rebuilt around it and would otherwise '
      + 'compare -1 against -1 and call that an order');
    return index;
  };
  // RE-AIMED 2026-08-10 BY THE UI MERGE, AND IT WAS RED IN BETWEEN — which is
  // the gate-must-watch-the-deleted-surface law behaving correctly rather than a
  // gate being edited to match a regression. Slice 1 removed `<WeekStrip` from
  // this spine (ruling 3, "No days at the top of the page"), so the landmark
  // this cell navigated by stopped existing; it reported that in words instead
  // of comparing -1 against -1, and stayed red until the surface settled.
  //
  // THE SPINE IS SHORTER AGAIN: My Status now owns Coach Notes, so Program ends
  // its primary sequence after the four working status controls.
  // ⚠ **THE FOLLOW-UP MOVED TO THE FRONT — SAM, 2026-08-22:** *"right now it
  // pops up at the bottom of the screen ... Notifications at top of screen above
  // or below active modifiers"*. It used to be the LAST landmark on this spine,
  // and this cell held it there. A question about whether yesterday happened is
  // the first thing to answer, not the last — so the assertion is inverted at
  // that one link and the rest of the sequence is untouched.
  const toggle = at('testID="program-view-toggle"');
  const followUp = at('<MissedSessionNotice');
  const card = at('renderDayRow(dayFirstDay, dayFirstIdx)');
  const changeCard = at('testID="home-change-card"');
  const chips = at('rowTestID="home-life-fact-chips"');
  assert(toggle < followUp && followUp < card && card < changeCard && changeCard < chips,
    'the Program screen is no longer in the order Sam ruled '
    + `(toggle ${toggle} → missed-session notices ${followUp} → card ${card} → `
    + `change card ${changeCard} → chips ${chips}). The sequence is Today/Week, `
    + "the notices, today's card, then the change card holding the status circles.");
  // THE STRIP STAYS GONE. Ruling 3 removed it and the removal has a home (the
  // week shape); a re-inserted strip would keep the order above and still be the
  // thing he ruled out. Asserted on the SPINE, not the file — `WeekStrip` the
  // component still exists and is still the week shape's, which is deliberate.
  const spine = home.slice(toggle, followUp);
  assert(!spine.includes('<WeekStrip'),
    'the seven-day strip is back at the top of the day screen. Sam, 2026-08-10: '
    + '"No days at the top of the page - people only care about the day they are '
    + 'on and if they need to view the other days they go to weekly view."');
  // NOTHING BETWEEN THE TOGGLE AND TODAY'S CARD. "Directly under it" is the half
  // of the ruling an ordering assertion alone cannot see: three cards used to
  // queue up in that gap, and re-inserting any one of them would keep this order
  // and still break what he asked for. The landmark moved from the strip to the
  // card because the card is now what sits directly under the toggle.
  const gap = home.slice(toggle, card);
  for (const intruder of ['<CoachNotesSection', '<MissedSessionPrompt', 'home-season-phase-skew']) {
    assert(!gap.includes(intruder),
      `${intruder} is back between the Today/Week control and today's card. `
      + 'Sam ruled the day sits DIRECTLY under the toggle; anything that opens '
      + 'in that gap pushes his session below the fold again.');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// THE UI MERGE, SLICE 2 — Sam's eye pass, 2026-08-10
//
// He put his screen next to the signed prototype and listed what was missing.
// Each cell below holds one of the four things he named. **A negative
// behavioural claim needs a cell in the same commit** — "the card now shows the
// exercises" is exactly the kind of sentence that survived two reports and was
// false once already.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⚠ **THIS CELL IS INVERTED, NOT DELETED — Sam, 2026-08-22.**
 *
 * *"we no longer need todays session or the date in the top left hand corner of
 * the S&C box - the date is now between the arrows at the top of screen - so
 * that can be removed and the title of the session i.e. game day, or strength
 * or whatever can take its place"*.
 *
 * It used to hold ruling 5: the eyebrow ("TODAY'S SESSION - MON 10/8") is the
 * words, and the Today BADGE is gone because the words say it. The eyebrow is
 * now gone too — the date nav above the card says the date on every day, not
 * only today — and the ruling that mattered survives the change: **the day card
 * carries the date ONCE, and it is not the card that carries it.**
 *
 * THE BADGE MUST STILL NOT COME BACK. That is the half of ruling 5 a careless
 * removal would have undone, because its old condition was "no eyebrow".
 */
run('the day card leads with the TITLE — no eyebrow, no date, no Today badge', () => {
  const home = homeScreenSource();
  assert(!/TODAY'S SESSION/.test(home),
    'the eyebrow\'s words are back in HomeScreenV2, hardcoded');
  assert(!/day-card-eyebrow/.test(home) && !/showTodayEyebrow/.test(home),
    'the day card still draws the eyebrow Sam removed');
  assert(!/signedCopy\('day\.card\.eyebrow\./.test(home),
    'the day card still reads the retired eyebrow rows from the sheet');

  const dayHeaderAt = home.indexOf('const dayCardHeader =');
  const weekHeaderAt = home.indexOf('const weekCardHeader =', dayHeaderAt);
  assert(dayHeaderAt > 0 && weekHeaderAt > dayHeaderAt,
    'the day card header region could not be found');
  const head = home.slice(dayHeaderAt, weekHeaderAt);
  // THE DATE IS THE THING REMOVED, so the cell names the date, not the markup
  // that happened to draw it. `shortDayMonthLabel` is how this screen writes a
  // date; the head must not call it, whatever element it would put it in.
  assert(!/shortDayMonthLabel/.test(head) && !/day\.short/.test(head),
    'the day card head is dating itself again. The date lives between the '
    + 'arrows above the card, and Sam removed the card\'s copy of it.');
  assert(/testID="day-card-title"/.test(head)
    && /\{selectedTitle\}/.test(head),
    'the day card head no longer leads with the session title, which is what '
    + 'Sam put in the space the date left.');
  // AND NO GAME BADGE EITHER — Sam, 2026-08-22: *"we don't need the game badge
  // at all any more"*. The day is CALLED "Game Day" in the title beside this
  // slot, so the badge was the second thing on one line saying the one word.
  // THE REAL RISK IS THE FALL-THROUGH: a fixture can carry a sessionTier, so
  // removing the game arm alone would put CORE on game day — the badge back
  // under a different word. `!isGame` is what stops that, and it is what this
  // cell asserts; the week card has always drawn nothing there.
  assert(!/function GameBadge/.test(home) && !/<GameBadge/.test(home),
    'the GAME badge is back on the day card');
  assert(/showRowBadges && hasWorkout && !isGame && day\.workout\.sessionTier/.test(home),
    'a fixture now falls through to the session tier chip. Sam removed the GAME '
    + 'badge; a game day wearing CORE is that badge returning as another word.');

  // AND THE TODAY BADGE STAYS GONE. `!dayShape`, not "no eyebrow": the old
  // condition would have re-summoned it the moment the eyebrow was deleted.
  assert(/showRowBadges && day\.isToday && !dayShape/.test(home),
    'the "Today" badge is no longer scoped away from the day shape. Ruling 5 '
    + 'removed it from the day card; if it is deleted outright instead, the '
    + 'week list silently loses its today marker.');
});

run('the day card lists each part\'s exercises, name and prescription', () => {
  const home = homeScreenSource();
  const projectedEntriesAt = home.indexOf(PROJECTED_ENTRY_LOOP);
  assert(projectedEntriesAt >= 0,
    'the projected timeline-entry loop could not be found');
  const rowsStart = home.indexOf('day-timeline-rows-${entry.componentId}', projectedEntriesAt);
  assert(rowsStart > 0,
    'the drop-down\'s expanded body is gone from HomeScreenV2 — Sam\'s biggest '
    + 'named gap ("there\'s no drop downs for the session overview") is unbuilt.');
  const region = home.slice(rowsStart, rowsStart + 900);
  assert(/row\.name/.test(region) && /row\.prescription/.test(region),
    'the expanded drop-down no longer renders both halves. His words: "hers has '
    + 'like mobility / warmup then drop down of the exercise AND the sets and '
    + 'reps" — a name with no prescription is half the thing he asked for.');
  // THE COUNT LINE COMES FROM THE SHEET, SINGULAR AND PLURAL BOTH.
  assert(!/\bexercises['"`]/.test(home),
    'the "N exercises" meta line is being composed in the screen. It is a '
    + 'template in the sheet (`day.part.exercise_count`) precisely so a surface '
    + 'never joins a number to a word.');
  assert(/day\.part\.exercise_count_one/.test(home),
    'the singular form is not read — a card can render "1 exercise" and a part '
    + 'holding exactly one row is common.');
  // A PART WITH NOTHING IN IT DOES NOT OFFER TO OPEN. Her own week rows carry
  // the same rule for rest and game days.
  assert(/canOpen = entry\.rows\.length > 0/.test(home),
    'every part now offers a chevron, including the ones with no exercises '
    + '(team training, a fixture). An affordance that opens onto nothing '
    + 'teaches the athlete the affordance is a lie.');
});

run('the day timeline uses each session icon as its only marker and matches her type scale', () => {
  const home = homeScreenSource();
  const timelineAt = home.indexOf('function DayTimeline(');
  const chevronAt = home.indexOf('function TimelineChevron(', timelineAt);
  assert(timelineAt > 0 && chevronAt > timelineAt,
    'the interactive DayTimeline region could not be found');
  const timeline = home.slice(timelineAt, chevronAt);
  const interactiveAt = timeline.indexOf('<Pressable');
  const interactive = timeline.slice(interactiveAt);
  assert(interactiveAt > 0 && interactive.length > 900,
    'the interactive day rows could not be isolated from the flat Week branch');
  assert(!/timelineRail|timelineNode|timelineConnector/.test(interactive),
    'the day timeline still draws a hollow dot or connector beside its session icon');
  /**
   * ⚠ **RE-AIMED 2026-08-22 — SAM CHANGED WHAT A LOGGED ROW LOOKS LIKE.**
   * *"They should not be amber - they should be a green tick once they are
   * logged"*. The row used to TINT its session icon by completion, and
   * `partial` was `#FFC247`; the marker is a green check now, and the tinting
   * map is deleted.
   *
   * The cell's SUBJECT is unchanged and still one-marker-per-row: exactly one
   * of the two is drawn, never both, and the unlogged case is still the
   * session's own icon in its own colour.
   */
  assert(/timelineIconMarker[\s\S]{0,900}<MaterialCommunityIcons name="check"[\s\S]{0,200}<RowIcon/.test(interactive),
    'a logged row no longer shows the green tick, or the unlogged row lost its session icon');
  assert(!/completionColor/.test(interactive),
    'the completion tint is back — amber on a part icon is what Sam removed');

  const dayHeaderAt = home.indexOf('const dayCardHeader =');
  const weekHeaderAt = home.indexOf('const weekCardHeader =', dayHeaderAt);
  assert(dayHeaderAt > 0 && weekHeaderAt > dayHeaderAt,
    'the day card header region could not be found');
  assert(!/<RowIcon\b/.test(home.slice(dayHeaderAt, weekHeaderAt)),
    'the day headline still repeats a session icon above the icon-led component rows');
  assert(/<SessionTierBadge\s+compact=\{dayShape\}/.test(home),
    'the day header still uses the oversized category badge');

  assert(!/dayEyebrow:\s*\{/.test(home),
    'the retired eyebrow\'s style is back in the screen. Sam removed the '
    + 'element on 2026-08-22; a style with no element is a value nobody can date.');
  assert(/workoutTitleSelected:\s*\{[^}]*fontSize:\s*19[^}]*lineHeight:\s*23/.test(home),
    'the day session title does not match Renee\'s 19pt headline');
  assert(/timelineHeadline:\s*\{[^}]*fontSize:\s*10\.5[^}]*lineHeight:\s*14[^}]*fontWeight:\s*'800'/.test(home),
    'the compact status-label scale has drifted');
  assert(/programmedPartHeadline:\s*\{[^}]*fontSize:\s*15[^}]*lineHeight:\s*20[^}]*textTransform:\s*'none'[^}]*letterSpacing:\s*0/.test(home),
    'programmed section headings must keep the 15pt scale and normal casing while compact status labels remain uppercase');
  assert((home.match(/styles\.programmedPartHeadline/g) ?? []).length === 2,
    'both programmed part headings must use the larger scale, without enlarging Team Training session status');
  assert(/timelinePartMeta:\s*\{[^}]*fontSize:\s*10\.5[^}]*lineHeight:\s*14/.test(home),
    'the exercise counts no longer match Renee\'s component meta size');
  assert(/timelineRow:\s*\{[^}]*minHeight:\s*52[^}]*paddingVertical:\s*10[^}]*borderTopWidth:\s*StyleSheet\.hairlineWidth/.test(home),
    'the simplified icon-led rows lost their accepted height or quiet dividers');
  assert(/dayRowInnerSelected:\s*\{[^}]*paddingHorizontal:\s*20[^}]*paddingVertical:\s*20/.test(home)
    && /selectedHeader:\s*\{[^}]*gap:\s*14/.test(home)
    && /expanded:\s*\{[^}]*marginTop:\s*20[^}]*gap:\s*12/.test(home),
    'the Today card has fallen back to the under-filled spacing shown on Sam\'s phone');
  assert(/label="Start Session"[\s\S]{0,100}size="md"/.test(home),
    'the primary day action has fallen back to the rejected 36pt control');
});

run('the Today card has no accent rail and no retired change link', () => {
  const home = homeScreenSource();
  const dayRowAt = home.indexOf('function DayRow(');
  const dayRowEnd = home.indexOf('interface WeekStripProps', dayRowAt);
  assert(dayRowAt > 0 && dayRowEnd > dayRowAt,
    'the DayRow region could not be found');
  const dayRow = home.slice(dayRowAt, dayRowEnd);
  assert(!/dayAccentStrip/.test(dayRow),
    'the Today card still renders the lime left rail Renee does not have');
  assert(!/dayAccentStrip:\s*\{/.test(home),
    'the retired Today-card accent rail style is still live');
  assert(!/Want to change something\?/.test(dayRow)
    && !/testID="make-change-link"/.test(dayRow),
  'the retired Day change link is still mounted');
});

run('the front review includes the owned mobility warm-up before all projected parts', () => {
  const home = homeScreenSource();
  assert(/selectMobilityPrehabFlow\(/.test(home),
    'the Program review does not ask the existing mobility-flow owner for the flow');
  assert(/mobilityFlow=\{mobilityFlowByDate\.get\(day\.date\) \?\? null\}/.test(home),
    'the review does not pass each day\'s owned flow into the shared timeline');
  const timelineAt = home.indexOf('function DayTimeline(');
  const chevronAt = home.indexOf('function TimelineChevron(', timelineAt);
  assert(timelineAt > 0 && chevronAt > timelineAt,
    'the DayTimeline region could not be found');
  const timeline = home.slice(timelineAt, chevronAt);
  assert(/mobilityFlow \? \(/.test(timeline)
    && /testID="day-timeline-part-mobility-warmup"/.test(timeline)
    && /mobilityFlow\.movements\.map/.test(timeline)
    && /RowIcon kind="mobility" size=\{13\} color=\{rowIconColor\('mobility'\)\}/.test(timeline),
  'the mobility warm-up is not a real review row with its owned movements');
  /* `'entries.map'` was the anchor here and it stopped existing when the loop
     learned to filter (2026-08-22) — `indexOf` returned -1 and the comparison
     silently became false. Both ends are proven found before they are compared,
     which is what the repo's unproven-anchor law asks for. */
  const warmupAt = timeline.indexOf('day-timeline-part-mobility-warmup');
  const partsAt = timeline.indexOf(PROJECTED_ENTRY_LOOP);
  assert(warmupAt >= 0 && partsAt >= 0 && warmupAt < partsAt,
    'the mobility warm-up no longer precedes the projected session parts');
  /* Re-aimed with the anchor above: the loop renders every projected part
     EXCEPT club training, which moved to its own card (Sam, 2026-08-22). The
     exclusion is asserted rather than assumed, so the card cannot quietly
     start dropping something else. */
  assert(partsAt >= 0,
    'the review stopped rendering every projected part, including conditioning when present');
  assert(/entry\.kind !== 'team_training'/.test(timeline),
    'club training is back inside the programmed-work box');
});

run('Start Session sits inside the card, below the drop-downs', () => {
  const home = homeScreenSource();
  const timeline = home.indexOf('{timeline}');
  const start = home.indexOf('testID="view-workout-button"');
  assert(timeline > 0 && start > 0,
    'the expanded block no longer holds both the timeline and the session CTA');
  assert(timeline < start,
    'Start Session now renders ABOVE the drop-downs. Sam\'s read of her card is '
    + '"START SESSION sits INSIDE the card, full width, at the bottom — after '
    + 'the drop-downs, not before them".');
  // RULING 2 IS A PROTECTION: the button still reaches the session screen it
  // always did, and that screen is out of scope for this merge.
  assert(/onPress=\{onViewWorkout\}[\s\S]{0,120}testID="view-workout-button"/.test(home)
    || /testID="view-workout-button"[\s\S]{0,120}onPress=\{onViewWorkout\}/.test(home)
    || /label="Start Session"[\s\S]{0,200}onPress=\{onViewWorkout\}/.test(home),
    'Start Session no longer calls onViewWorkout — ruling 2 protects that door '
    + 'and the session screen behind it.');
});

run('the status circles sit in a card with words above them', () => {
  const home = homeScreenSource();
  const hub = changeHubSource();
  const cardAt = home.indexOf('testID="home-change-card"');
  const chipsAt = home.indexOf('rowTestID="home-life-fact-chips"');
  const mountAt = home.lastIndexOf('<SessionChangeHub', cardAt);
  assert(cardAt > 0, 'the change card is gone — ruling 1, Sam\'s FIRST bullet '
    + '("there\'s no text above the little buttons like rens said"), is unbuilt.');
  assert(mountAt >= 0 && mountAt < cardAt && cardAt < chipsAt,
    'the change card is no longer the shared hub carrying the status row — see '
    + '`test:session-change-hub` [8] for why there is exactly one implementation');

  // THE PICTURE IS THE SHARED COMPONENT'S. Same numbers as before, read where
  // they now live: `padding="lg"`, a 48pt circle and a 12/16 label.
  assert(/padding="lg"/.test(hub)
    && /chipIcon:\s*\{[^}]*width:\s*48[^}]*height:\s*48[^}]*borderRadius:\s*24/.test(hub)
    && /chipLabel:\s*\{[^}]*fontSize:\s*12[^}]*lineHeight:\s*16/.test(hub),
    'the status card has fallen back to its undersized padding or chip geometry');
  assert(/signedCopy\('day\.change_card\.heading'\)/.test(hub)
    && /signedCopy\('day\.change_card\.subline'\)/.test(hub),
    'the heading and sub-line above the circles are not read from the sheet.');
  assert(!/Not feeling 100%\?/.test(home) && !/Not feeling 100%\?/.test(hub)
    && !/Tell us what’s changed and we’ll adjust your training\./.test(home)
    && !/Tell us what’s changed and we’ll adjust your training\./.test(hub),
    'the change card\'s sentences are hardcoded. They are PROPOSED sheet entries '
    + '(batch 33) awaiting Sam — a literal is a word he can never re-word. They '
    + 'were literals in the shared component for one day, which is why this cell '
    + 'now reads BOTH files.');
  // SUPERSEDED 2026-08-11. The old Time door was inert on Sam's screen and its
  // one-tap schedule mutation did not belong beside status controls. Tired now
  // owns this slot and enters the existing flat-readiness choices directly.
  assert(/tired: 'Tired'/.test(hub) && !/'Time'/.test(hub),
    'the first circle is not the direct Tired readiness door, or the dead Time '
    + 'door has returned.');

  // ── THE THREE GLYPHS, BY EXACT PATH DATA ────────────────────────────────
  // ⚠ **THIS IS THE CELL THAT CAUGHT THE 2026-08-19 REGRESSION** — the Injured
  // cross was deleted from the Day screen and replaced by the session's warning
  // triangle, and only the path data could tell those apart. Bounded to the
  // hub's `glyph` function so a picture drawn anywhere else does not count.
  const glyphAt = hub.indexOf('function glyph(');
  assert(glyphAt > 0, 'the shared card no longer draws its own glyphs — this '
    + 'cell would otherwise scan the whole file and pass on a stray path');
  const glyphs = hub.slice(glyphAt, hub.indexOf('export function SessionChangeHub', glyphAt));
  assert(/case 'tired':[\s\S]{0,400}M3 8h15v8H3z/.test(glyphs)
    && /tired: '#67D7FF'/.test(hub)
    && /tired: 'rgba\(103, 215, 255, 0\.12\)'/.test(hub),
  'Tired is not using the ruled blue battery icon and matching circle tint');
  assert(/case 'sick':[\s\S]{0,400}M10 5a2 2 0 0 1 4 0v8\.2a4 4 0 1 1-4 0Z[\s\S]{0,120}M12 10v6/.test(glyphs)
    && /sick: '#FFCA68'/.test(hub)
    && /sick: 'rgba\(255, 202, 104, 0\.12\)'/.test(hub),
    'Sick is not using Renee\'s amber thermometer icon and tint');
  assert(/case 'injured':[\s\S]{0,400}M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z/.test(glyphs)
    && /injured: '#FF7F7F'/.test(hub)
    && /injured: 'rgba\(255, 127, 127, 0\.12\)'/.test(hub),
    'Injured is not using Renee\'s red cross icon and tint');
  // ⚠ **THE TWO INJURY DOORS DRAW ONE PICTURE, BY SAM'S RULING** (2026-08-19:
  // *"injured still has the wrong icon - it should match the injured icon on
  // the day screen"*). The first cut of this correction gave the session's
  // Injury door a warning triangle; he rejected it on sight. So the claim this
  // cell holds is now SAMENESS, and the triangle must not come back to either.
  assert(!/M10\.3 3\.9 1\.8 18/.test(glyphs),
    'the warning triangle is back on an injury door. Sam ruled that the session '
    + 'Injury chip shows the same red cross as the Day screen\'s Injured chip.');
  assert(/case 'injured':\s*case 'injury':/.test(glyphs),
    'the two injury doors no longer share one `case`. They were split once and '
    + 'immediately drifted into different pictures; one branch is what stops a '
    + 'future edit changing one and leaving the other behind.');

  // ITEM 28: THE MAP PIN IS NOT IN THIS CARD, and its own cell below proves it
  // landed on the week shape rather than simply disappearing.
  assert(!/M12 21s6-5\.2 6-11a6 6 0 1 0-12 0c0 5\.8 6 11 6 11Z/.test(hub),
    'the Away map-pin is back in the day-screen chip row — Sam moved that '
    + 'control to the weekly screen, and two live copies is the duplicate this '
    + 'file exists to catch');
  assert(home.includes('testID="edit-week-away"'),
    'Away did not move into the Week-only Edit this week menu');
});

run('Team Training and the change card share the programmed card surface', () => {
  const home = homeScreenSource();
  const calmStyle = home.match(/dayRowCalm:\s*\{[^}]+\}/)?.[0] ?? '';
  assert(calmStyle.includes("backgroundColor: '#101010'")
    && calmStyle.includes("borderColor: '#1F1F1F'"),
  'the programmed card surface token could not be found — this cell would be comparing against nothing');
  assert(/<Card\s+style=\{\[styles\.teamTrainingCard, styles\.dayRowCalm\]\}/.test(home),
    'Team Training does not reuse the programmed card surface');
  assert(/<SessionChangeHub[\s\S]{0,900}style=\{\[styles\.changeHub, styles\.dayRowCalm\]\}/.test(home),
    'Need to make a change does not reuse the programmed card surface');
});

run('unselected Week cards share the darker Day programmed surface', () => {
  const home = homeScreenSource();
  const dayRowAt = home.indexOf('function DayRow(');
  const dayRowEnd = home.indexOf('interface WeekStripProps', dayRowAt);
  assert(dayRowAt > 0 && dayRowEnd > dayRowAt,
    'the shared DayRow region could not be found');
  const dayRow = home.slice(dayRowAt, dayRowEnd);
  assert(/!dayShape && !cardSelected && styles\.dayRowCalm/.test(dayRow),
    'ordinary Week cards do not reuse the darker Day programmed-session surface');
  assert(/const cardSelected = normal && \(dayShape \? isSelected : day\.isToday\)/.test(dayRow)
      && /selected=\{cardSelected\}/.test(dayRow),
    'the Week Today card lost its selected surface while darkening the ordinary rows');
  assert(dayRow.indexOf('!dayShape && !cardSelected && styles.dayRowCalm')
      < dayRow.indexOf('isMoveTarget && styles.dayRowMoveTarget'),
    'move-target feedback must remain later than the calm Week surface so it stays visible');
});

/**
 * ITEM 28 — THE OTHER HALF OF THE MOVE, AND THE HALF A DELETION WOULD PASS.
 *
 * Sam, 2026-08-13: *"I think the away button should live on the weekly screen,
 * it should say 'when do you leave?' then 'when do you return' thhe leave button
 * should be limited to that week in dates, but the return date can be any date
 * in the future / then you are asked about the equipment stuff"*.
 *
 * The cell above asserts the chip row LOST it. Without this one, deleting the
 * control outright would leave that suite green and the athlete with no way to
 * say they are away at all.
 */
run('Away is a week-shape control, and it asks leave, return, then equipment', () => {
  const home = homeScreenSource();
  const entryAt = home.indexOf('testID="edit-week-away"');
  assert(entryAt > 0,
    'there is no away entry inside Edit this week');
  assert(home.includes('testID="edit-week-button"')
    && home.includes('onPress={() => setWeekEditVisible(true)}'),
  'the weekly edit button no longer opens the menu that owns Away');

  const sheetAt = home.indexOf('interface AwaySheetProps');
  assert(sheetAt >= 0, 'the away sheet is gone; the entry opens nothing');
  const calendarAt = home.indexOf('function AwayReturnCalendar', sheetAt);
  assert(calendarAt >= 0 && calendarAt > sheetAt,
    'the return-date calendar no longer follows the away sheet, so this cell '
    + 'cannot bound the sheet region and would read to the end of the file');
  const sheet = home.slice(sheetAt, calendarAt);
  assert(/When do you leave\?/.test(sheet)
    && /When do you return\?/.test(sheet)
    && /Do you have your normal equipment\?/.test(sheet),
    'the away sheet no longer asks Sam\'s three questions in his words');
  assert(/date >= todayISO/.test(sheet) && /weekDays/.test(sheet),
    'the leave date is no longer bounded to the week on screen');
  // READ THE COMPONENT, NOT THE LITERAL. This matched the composed testID
  // `home-away-return-calendar`, and reddened the day a neighbour parameterised
  // the prefix so a second sheet could reuse the same month grid — correct work,
  // and reusing it is better than a second calendar with a second set of bugs.
  // What this cell actually cares about is that the return date is picked from an
  // UNBOUNDED month grid, which is the component's identity.
  assert(/function AwayReturnCalendar/.test(home) && /<AwayReturnCalendar/.test(home),
    'the unbounded return-date calendar is gone — a bounded picker is the exact '
    + 'defect item 28 exists to remove ("away for ten days" was unsayable)');
  assert(/testIDPrefix = 'home-away-return'/.test(home),
    'the away calendar no longer answers to its own testID prefix, so the flows '
    + 'and the explorer cannot find it');

  // THE OLD SHEET MUST NOT SURVIVE BESIDE THE NEW ONE.
  assert(!/Which days are you away\?/.test(home) && !/AwayDaysSheet/.test(home),
    'the replaced "which days are you away?" sheet is still in the screen');
});

run('Tired and Sick enter one readiness sheet at their own options', () => {
  const home = homeScreenSource();
  const sheetStart = home.indexOf('interface WeekReadinessSheetProps');
  const sheetEnd = home.indexOf('type AwayAnswer = {', sheetStart);
  assert(sheetStart >= 0 && sheetEnd > sheetStart,
    'the readiness sheet region could not be found — this gate would otherwise '
    + 'claim direct routing from an empty slice');
  const sheet = home.slice(sheetStart, sheetEnd);

  assert(/const \[readinessEntry, setReadinessEntry\] = useState<'flat' \| 'sick' \| null>\(null\)/.test(home),
    'visibility and entry choice are not owned by one typed readiness entry');
  assert(/initialBucket=\{readinessEntry \?\? 'flat'\}/.test(home),
    'the shared readiness sheet does not receive the door that opened it');
  assert(/setReadinessEntry\('flat'\)/.test(home) && /setReadinessEntry\('sick'\)/.test(home),
    'Tired and Sick do not route directly to their own option groups');
  assert(/initialBucket: 'flat' \| 'sick'/.test(sheet),
    'the sheet has no typed direct-entry contract');
  assert(!/'top'/.test(sheet) && !/readiness-bucket-flat/.test(sheet)
    && !/readiness-bucket-sick/.test(sheet),
    'the removed flat/sick chooser still exists inside the readiness sheet');
  assert(!/Something hurts/.test(sheet) && !/onInjury/.test(sheet),
    'injury is still nested under readiness instead of living only behind Injured');
  assert(/title="Fatigue" subtitle="What’s closest\?"/.test(sheet)
    && /title="Sick" subtitle="How bad\?"/.test(sheet),
    'one of the two existing option groups was lost while removing the chooser');
  const flatStart = sheet.indexOf("{showOptions && bucket === 'flat'");
  const sickStart = sheet.indexOf("{showOptions && bucket === 'sick'", flatStart);
  assert(flatStart >= 0 && sickStart > flatStart,
    'the flat-options region could not be found before the sick-options region');
  const flat = sheet.slice(flatStart, sickStart);
  assert((flat.match(/<SheetOption\b/g) ?? []).length === 3,
    'Tired does not show exactly three choices');
  assert(/label="Bit tired today"/.test(flat)
    && /label="Pretty flat"/.test(flat)
    && /label="Totally cooked"/.test(flat),
    'Tired is missing one of the three signed severity labels');
  assert(/onApply\('tired_today'\)/.test(flat)
    && /onApply\('flat_today'\)/.test(flat)
    && /onApply\('cooked_week'\)/.test(flat),
    'the three Tired severities do not reach three typed readiness actions');
  assert(!/Rough sleep|Sore or tight|readiness-leaf-sleep|bucket === 'sleep'/.test(sheet),
    'sleep or soreness still appears in the Tired pathway');
  assert(/home-injured-entry/.test(home)
    && /setReadinessInjuryVisible\(true\)/.test(home),
    'the dedicated Injured door or its existing guided pathway was removed');
});

run('the Tired choices use one readable colour-and-energy ladder', () => {
  const home = homeScreenSource();
  const flatStart = home.indexOf("{showOptions && bucket === 'flat'");
  const sickStart = home.indexOf("{showOptions && bucket === 'sick'", flatStart);
  const flat = home.slice(flatStart, sickStart);
  assert(flatStart > 0 && sickStart > flatStart && flat.length > 900,
    'the Tired option region was not found; this guard would otherwise pass over nothing');

  assert(/label="Bit tired today"[\s\S]{0,240}icon=\{moonIcon\('#67D7FF'\)\}/.test(flat),
    'Bit tired today does not carry the distinct blue moon Sam chose');
  assert(/label="Pretty flat"[\s\S]{0,240}icon=\{flatTodayIcon\('#FFC247'\)\}/.test(flat),
    'Pretty flat does not carry the amber half-full battery');
  assert(/label="Totally cooked"[\s\S]{0,280}icon=\{cookedIcon\('#FF7F7F'\)\}/.test(flat),
    'Totally cooked does not carry the red skull-and-crossbones');

  const iconOwner = stripComments(fs.readFileSync(
    path.join(__dirname, '..', 'components', 'icons', 'LfaIcon.tsx'), 'utf8',
  ));
  assert(/'half-energy': 'battery-50'/.test(iconOwner)
    && /'totally-cooked': 'skull-crossbones-outline'/.test(iconOwner),
  'the two new readiness glyphs are not owned by the shared semantic icon map');
});

run('the week rows open in place onto the same projected session', () => {
  const home = homeScreenSource();
  // RULING 7. Sam's question — open in place, or navigate? — was answered by
  // reading her signed prototype: IN PLACE. The app already expanded; the rows
  // simply had nothing worth opening.
  //
  // THE LOAD-BEARING ASSERTION IS THE ABSENCE OF `dayFirst &&`. If the timeline
  // is gated on the shape again, the week rows silently go back to opening onto
  // nothing — and every data-level cell here would still pass, because the
  // component and the read would both still exist.
  assert(/timeline=\{visibleDay \? \(/.test(home),
    'the timeline is gated on the shape again — the week rows have lost their '
    + 'drop-downs, and ruling 7 with them');
  assert(!/timeline=\{dayFirst && visibleDay/.test(home),
    'the `dayFirst &&` gate is back on the timeline prop');
  // ONE COMPONENT FOR BOTH SHAPES. A second timeline for the week is the defect
  // this whole slice exists to avoid: the week row and the day card would be two
  // accounts of one day.
  assert((home.match(/<DayTimeline\b/g) ?? []).length === 1,
    'there is more than one DayTimeline call site — the week row and the day '
    + 'card must be one component, or they can disagree about a day');
});

run('the week chevron opens one flat full session, not nested drop-downs', () => {
  const home = homeScreenSource();
  assert(/presentation=\{dayFirst \? 'interactive' : 'flat'\}/.test(home),
    'the one DayTimeline call site does not select the week\'s flat presentation');
  const timelineAt = home.indexOf('function DayTimeline(');
  const chevronAt = home.indexOf('function TimelineChevron(', timelineAt);
  assert(timelineAt > 0 && chevronAt > timelineAt,
    'the DayTimeline render region could not be found');
  const timeline = home.slice(timelineAt, chevronAt);
  const projectedEntriesAt = timeline.indexOf(PROJECTED_ENTRY_LOOP);
  assert(projectedEntriesAt >= 0,
    'the projected timeline-entry loop could not be found');
  const flatAt = timeline.indexOf("presentation === 'flat'", projectedEntriesAt);
  const interactiveAt = timeline.indexOf('<Pressable', flatAt);
  assert(flatAt > 0 && interactiveAt > flatAt,
    'the flat week-session branch was not found before the interactive rows');
  const flat = timeline.slice(flatAt, interactiveAt);
  assert(/entry\.rows\.map\(\(row, rowIndex\)/.test(flat),
    'the flat week session does not render every exercise row directly');
  assert(/\{rowIndex \+ 1\}/.test(flat),
    'the flat week session does not carry her simple row numbers');
  assert(/weekSessionSectionTitle/.test(flat)
    && /weekSessionExerciseRow/.test(flat)
    && /weekSessionExercisePrescription/.test(flat),
  'the flat week session has no section/row/prescription structure');
  assert(!/openParts|TimelineChevron|timelineRail|RowIcon/.test(flat),
    'the flat week session still contains an inner accordion, rail or icon layer');
});

run('the week starts collapsed while Day owns its persistent weekday directly', () => {
  const home = homeScreenSource();
  const toggleAt = home.indexOf('testID="program-view-toggle"');
  const weekContentAt = home.indexOf('{dayFirst ? (', toggleAt);
  assert(toggleAt > 0 && weekContentAt > toggleAt,
    'the Today/Week toggle region could not be found');
  const toggle = home.slice(toggleAt, weekContentAt);
  assert(/onPress=\{\(\) => \{[\s\S]{0,180}setPreferredProgramView\(option\)[\s\S]{0,120}handleClearWeekPresentation\(\)/.test(toggle),
    'the shape toggle does not clear the new template\'s Week expansion coordinate');

  assert(/const \[expandedWeekIdx, setExpandedWeekIdx\] = useState\(-1\)/.test(home),
    'the new template still borrows the shared day/picker selection as Week expansion');
  const clearAt = home.indexOf('const handleClearWeekPresentation =');
  const clear = home.slice(clearAt, clearAt + 180);
  assert(clearAt > 0 && /setExpandedWeekIdx\(-1\)/.test(clear)
    && /handleClearSelection\(\)/.test(clear)
    && /onPress=\{dayFirst \? undefined : handleClearWeekPresentation\}/.test(home),
  'the shared shape/whitespace clear no longer collapses the local Week details');
  for (const pair of [
    ['handleCompactPrev', 'handlePrev'],
    ['handleCompactNext', 'handleNext'],
    ['handleCompactThisWeek', 'handleThisWeek'],
  ]) {
    const handlerAt = home.indexOf(`const ${pair[0]} =`);
    const handler = home.slice(handlerAt, handlerAt + 180);
    assert(handlerAt > 0 && /setExpandedWeekIdx\(-1\)/.test(handler)
      && handler.includes(`${pair[1]}()`),
    `${pair[0]} does not collapse the Week before changing its date range`);
  }
  assert(/const \[preferredDayIdx, setPreferredDayIdx\] = useState\(todayIdx >= 0 \? todayIdx : 0\)/.test(home)
    && /const dayFirstIdx = Math\.min\(Math\.max\(preferredDayIdx, 0\), Math\.max\(weekDays\.length - 1, 0\)\)/.test(home)
    && /const isSelected = dayFirst \? true : isNormal\s*\? idx === expandedWeekIdx\s*:\s*idx === selectedIdx/.test(home),
    'Day still borrows Week expansion instead of owning a persistent weekday directly');

  const dayRowAt = home.indexOf('function DayRow(');
  const dayRow = home.slice(dayRowAt, home.indexOf('interface WeekStripProps', dayRowAt));
  assert(dayRowAt > 0 && dayRow.length > 2000,
    'the DayRow region could not be found');
  assert(/const cardSelected = normal && \(dayShape \? isSelected : day\.isToday\)/.test(dayRow)
      && /selected=\{cardSelected\}/.test(dayRow),
    'clearing Week expansion also removed today\'s independent highlight');
});

run('the Program shape control is the large Day / Week toggle Sam chose', () => {
  const home = homeScreenSource();
  const toggleAt = home.indexOf('testID="program-view-toggle"');
  const weekContentAt = home.indexOf('{dayFirst ? (', toggleAt);
  assert(toggleAt > 0 && weekContentAt > toggleAt,
    'the Day / Week toggle region could not be found');
  const toggle = home.slice(toggleAt, weekContentAt);
  assert(/accessibilityLabel=\{option === 'today' \? 'Day' : 'Week'\}/.test(toggle)
    && /\{option === 'today' \? 'Day' : 'Week'\}/.test(toggle),
  'the shape control does not say Day / Week in visible and accessibility copy');
  assert(/viewToggle:\s*\{[^}]*width:\s*280\b/.test(home)
    && /viewToggleOption:\s*\{[^}]*minHeight:\s*44\b/.test(home)
    && /viewToggleLabel:\s*\{[^}]*fontSize:\s*15\b/.test(home),
  'the shape control has fallen back to the old undersized pill');
});

run('week navigation is absent from Today and compact below the toggle in Week', () => {
  const home = homeScreenSource();
  const toggleAt = home.indexOf('testID="program-view-toggle"');
  const navAt = home.indexOf('testID="program-week-navigation"');
  const weekContentAt = home.indexOf('{dayFirst ? (', toggleAt);
  assert(toggleAt > 0 && navAt > toggleAt && weekContentAt > navAt,
    'the compact week navigator is not ordered toggle → navigator → week content');

  const betweenToggleAndContent = home.slice(toggleAt, weekContentAt);
  assert(/\{!dayFirst \? \([\s\S]*testID="program-week-navigation"/.test(betweenToggleAndContent),
    'the week navigator is not owned by the Week shape — Today can still render it');
  const pickerAt = home.indexOf("mode.type === 'moveGame'", navAt);
  assert(pickerAt > navAt,
    'the live picker boundary after the navigator could not be found');
  const nav = home.slice(navAt, pickerAt);
  assert(nav.length > 500,
    'the compact week navigator region could not be found');
  assert(/program-week-previous[\s\S]*program-week-current[\s\S]*program-week-next/.test(nav),
    'simplifying the navigator removed one of its three established doors');
  assert(!/<IconButton\b/.test(nav) && !/<Badge\b/.test(nav),
    'the Week shape still uses the large circular buttons or relative-week badge');
  assert(/compactWeekNavLabel:\s*\{[^}]*fontSize:\s*13\b[^}]*lineHeight:\s*18\b/.test(home)
    && /compactWeekNavButton:\s*\{[^}]*width:\s*40[^}]*height:\s*40/.test(home)
    && /compactWeekNavCurrent:\s*\{[^}]*minWidth:\s*112[^}]*minHeight:\s*40/.test(home)
    && (home.match(/<Svg width=\{17\} height=\{17\}/g) ?? []).length >= 2,
    'the Week navigator has fallen back to the rejected undersized proportions');
  assert(/topBar:\s*\{[^}]*marginBottom:\s*spacing\.md[^}]*gap:\s*spacing\.md/.test(home),
    'the week range is not equally spaced between the Day / Week toggle and the week cards');
});

run('all seven week days use her one card head, including today', () => {
  const home = homeScreenSource();
  const componentAt = home.indexOf('function WeekDayCardHeader(');
  const dayRowAt = home.indexOf('function DayRow(');
  assert(componentAt > 0 && dayRowAt > componentAt,
    'the week card head is not a named component before DayRow — the seven days '
    + 'have no single structural owner');
  const component = home.slice(componentAt, dayRowAt);
  assert(component.length > 500,
    'the week card head region is too small to be the dated card Sam chose');
  assert(/dayOfMonthLabel\(day\.date\)/.test(component),
    'the week card no longer carries her large date numeral');
  assert(/day\.isToday[\s\S]{0,220}testID="day-week-today-pill"/.test(component),
    'today is not marked inside the same week-card date column as every other day');
  assert(/<SessionTierBadge[\s\S]{0,160}tier=\{day\.workout\.sessionTier\}/.test(component),
    'the week card no longer carries the program category chip');
  assert(/rowCount > 0[\s\S]{0,500}day\.part\.exercise_count/.test(component),
    'the week card no longer carries the exercise total from its own details');
  assert(/canExpand[\s\S]{0,600}weekCardChevron/.test(component),
    'a card with details no longer shows that it opens');

  const dayRow = home.slice(dayRowAt, home.indexOf('interface WeekStripProps', dayRowAt));
  assert(dayRow.length > 2000,
    'the DayRow region could not be found — this cell would otherwise pass on '
    + 'a detached WeekDayCardHeader that no day renders');
  assert((dayRow.match(/<WeekDayCardHeader\b/g) ?? []).length === 1,
    'DayRow must have exactly one week-card head call site for all seven days');
  assert(/const weekCardHeader = \([\s\S]{0,120}<WeekDayCardHeader\b/.test(dayRow)
    && /\{dayShape \? dayCardHeader : weekCardHeader\}/.test(dayRow),
    'the week-card head is not selected by the SCREEN shape. Today or an opened '
    + 'day can still fall into a different head, recreating the divergence Sam caught.');
});

run('the week card keeps her proportions — large date, compact badges', () => {
  const home = homeScreenSource();
  const componentAt = home.indexOf('function WeekDayCardHeader(');
  const dayRowAt = home.indexOf('function DayRow(');
  assert(componentAt > 0 && dayRowAt > componentAt,
    'the WeekDayCardHeader region could not be found');
  const component = home.slice(componentAt, dayRowAt);
  assert(/weekCardDateNumeral:\s*\{[^}]*fontSize:\s*27\b/.test(home),
    'the week date numeral is not the signed prototype\'s 27pt anchor');
  assert(/<SessionTierBadge\s+compact\s+tier=\{day\.workout\.sessionTier\}/.test(component),
    'the week category still uses the full-size session badge');
  assert(/label="Today"[\s\S]{0,100}size="xxs"/.test(component),
    'the Today marker still uses the full-size badge treatment');
  assert(!/<GameBadge/.test(component),
    'the week Game Day card added a GAME badge that is not in the signed card');
  const tierBadge = fs.readFileSync(
    path.join(__dirname, '..', 'components', 'common', 'SessionTierBadge.tsx'), 'utf8');
  const uiBadge = fs.readFileSync(
    path.join(__dirname, '..', 'components', 'ui', 'Badge.tsx'), 'utf8');
  assert(/compactText:\s*\{[^}]*fontSize:\s*8[^}]*lineHeight:\s*10/.test(tierBadge),
    'the compact category font shrank but kept the normal 24pt text line-height');
  assert(/fontSize: s\.font, lineHeight: s\.line/.test(uiBadge)
    && /case 'xxs':[\s\S]{0,180}font:\s*8, line:\s*10/.test(uiBadge),
  'the tiny Today badge shrank its font but kept the normal 24pt text line-height');
});

run('logging a game is a POP-UP on the day screen, not a session view', () => {
  const home = homeScreenSource();
  // Sam, 2026-08-22: *"Fix the game feedback form - it now takes you inside a
  // session view that doesn't need to be there - it should just be a pop up
  // like it is for team training"*.
  assert(/onLogGame=\{\(\) => setGameFeedbackDate\(day\.date\)\}/.test(home),
    'Log Game no longer opens the game form in place');
  assert(!/handleLogGame/.test(home),
    'the day screen still calls the navigating handler. That is the session '
    + 'view Sam removed — its header, its list and its change box around four '
    + 'questions.');
  assert(/visible=\{gameFeedbackDate !== null\}[\s\S]{0,200}testID="game-feedback-sheet"/.test(home),
    'the game form is not mounted in a sheet of its own');

  // IT IS THE CLUB FORM'S TWIN, which is the whole of what Sam asked for: the
  // same container, the same open/close shape, the same one-date state.
  assert(/<Sheet[\s\S]{0,200}testID="club-training-feedback-sheet"/.test(home)
    && /const \[gameFeedbackDate, setGameFeedbackDate\] = useState<string \| null>\(null\)/.test(home),
    'the game pop-up and the club pop-up no longer have the same shape');

  // THE PANEL IS NAMED, NOT DISPATCHED. A fixture may carry no workout, and
  // `SessionFeedbackPanel` picks its presentation by classifying one — an
  // absent workout would land the athlete on the TRAINING questions.
  assert(/<GameSessionFeedbackPanel/.test(home) && !/<SessionFeedbackPanel/.test(home),
    'the day screen reaches the game form through the classifying dispatcher, '
    + 'so a fixture with no workout gets the training questions');
});

run('a team-only day is CALLED team training, and logs it in one place', () => {
  const home = homeScreenSource();
  // Sam, 2026-08-22, looking at a day whose strength session he had removed:
  // *"If it is only a team training day - the Title should be 'Team Training'
  // not 'Training Day' ... and the bottom section should be removed from view -
  // but the log session button left over - should just be a pop up like the
  // game day one = not take you inside session view"*.

  // ONE DOOR. The separate club box is what the card's own button replaced, so
  // a team-only day must not draw both — two buttons for one act, on a card
  // already titled Team Training.
  assert(/clubEntry && !isTeamTrainingOnlyWorkout\(day\.workout\)/.test(home),
    'the club box is back on a team-only day, beside a card that already says '
    + 'the same words and offers the same act');
  assert(/onFinishTeam=\{[\s\S]{0,600}setClubTrainingDate\(day\.date\)\}/.test(home),
    'the team-only day\'s button no longer opens the club form in place. It '
    + 'used to open the SESSION view — a list, a change box and a summary, all '
    + 'about programmed work, for a day that has none.');
  assert(!/handleFinishTeamSession/.test(home),
    'the day screen still holds the navigating handler');
  assert(/isTeamOnly \? \([\s\S]{0,220}<Text style=\{styles\.expandedMeta\}>\{signedCopy\('day\.club_training\.solo_helper'\)\}<\/Text>/.test(home),
    'the team-only card does not show the signed "Have fun at training!" helper in the Game Day subtitle position');

  // AND THE DAY GETS ITS NAME BACK. The title owner is a rule, not the screen,
  // so this half is asserted where it lives.
  const detail = fs.readFileSync(
    path.join(__dirname, '..', 'rules', 'visibleDayDetail.ts'), 'utf8');
  assert(/const named = buckets\.length > 0 \? buckets : dayBuckets\(day\);/.test(detail),
    'a day whose only part is filtered out by `programmedOnly` falls through to '
    + 'the generic headline again — which is how a club night came to be called '
    + '"Training Day" on Sam\'s phone.');
});

run('the day navigator says TODAY for today and a date for every other day', () => {
  const home = homeScreenSource();
  // Sam, 2026-08-22: *"make it say 'today' in between the arrows at the top for
  // todays date ... tomorrow will be unchanged ie. SUN 23/8 or yesterday would
  // still say FRI 21/8"*.
  const navAt = home.indexOf('testID="program-day-navigation"');
  const navEnd = home.indexOf('testID="program-day-next"', navAt);
  assert(navAt > 0 && navEnd > navAt, 'the day navigator could not be found');
  const nav = home.slice(navAt, navEnd);

  assert(/navIsToday\s*\?\s*signedCopy\('day\.navigator\.today'\)/.test(nav),
    'the navigator no longer says the signed word on today');
  assert(!/'Today'/.test(nav) && !/"Today"/.test(nav),
    'the navigator authors the word "Today" itself. It is a signed row '
    + '(`day.navigator.today`) — a surface writing it is what SignedCopy exists '
    + 'to make impossible.');
  // THE OTHER DAYS ARE UNCHANGED, which is half of what Sam asked for and the
  // half a careless read would drop.
  assert(/dayFirstDay\.short\}\s*\$\{shortDayMonthLabel\(dayFirstDay\.date\)/.test(nav),
    'the navigator stopped dating the days that are not today. Sam: "tomorrow '
    + 'will be unchanged ie. SUN 23/8".');
  // ONE READ OF "IS THIS TODAY?", so the visible word and the spoken label can
  // never disagree — the screen reader used to answer this question separately.
  assert(/const navIsToday = dayFirstDay\?\.isToday === true;/.test(home),
    'the navigator no longer derives today once from the projection\'s own flag');
  assert((nav.match(/navIsToday/g) ?? []).length === 2,
    'the navigator\'s label and its accessibility label are no longer driven by '
    + 'the same answer — one of them can now say TODAY while the other says a date');
});

run('a logged day shows DONE INSTEAD of its tier, at the tier chip\'s own size', () => {
  const home = homeScreenSource();
  const componentAt = home.indexOf('function WeekDayCardHeader(');
  const dayRowAt = home.indexOf('function DayRow(');
  assert(componentAt > 0 && dayRowAt > componentAt,
    'the WeekDayCardHeader region could not be found');
  const component = home.slice(componentAt, dayRowAt);

  // Sam, 2026-08-22: *"Done badge is bigger than the core badge on weekly view
  // — make it the same size — then ... it should replace the badge for that
  // day. i.e. done should replace core or optional and so on"*.
  assert(/<SessionTierBadge compact tier="done" \/>/.test(component),
    'the week card no longer draws DONE with the same badge as CORE, so the two '
    + 'chips can differ in size again — which is exactly what Sam reported');
  assert(!/label="Done"/.test(component),
    'the week card still draws DONE with the shared ui/Badge. That badge adds a '
    + '1px border at its success tone, which is the height difference itself');

  // REPLACES, not accompanies: the completed arm must be an `else` of the tier
  // arm. A cell that only checked both strings exist would pass on the two-chip
  // row the ruling removed.
  const categoryRowAt = component.indexOf('styles.weekCardCategoryRow');
  const categoryRowEnd = component.indexOf('styles.weekCardTitleLine', categoryRowAt);
  const categoryRow = categoryRowAt >= 0 && categoryRowEnd > categoryRowAt
    ? component.slice(categoryRowAt, categoryRowEnd)
    : '';
  assert(categoryRow.length > 200, 'the week card category row could not be read');
  assert(/isCompleted \? \([\s\S]{0,200}tier="done"[\s\S]{0,200}\) : isGame \?/.test(categoryRow),
    'DONE is not the branch BEFORE the tier — a finished day can still carry '
    + 'two chips, which is the shape Sam asked to be replaced');
  assert((categoryRow.match(/<SessionTierBadge/g) ?? []).length === 2,
    'the category row draws something other than exactly the two badge arms '
    + '(done, tier) — one of them may have gained a second, unreachable copy');

  // THE SIZE IS ONE TABLE ENTRY, NOT A SECOND STYLE. If DONE ever grows its own
  // geometry inside the badge, this is where it shows up.
  const tierBadge = fs.readFileSync(
    path.join(__dirname, '..', 'components', 'common', 'SessionTierBadge.tsx'), 'utf8');
  assert(/done:\s*\{[^}]*label:\s*'DONE'/.test(tierBadge),
    'DONE is not a row of the badge\'s own label table');
  assert(!/done[\s\S]{0,200}paddingVertical|doneBadge:/.test(tierBadge),
    'DONE grew its own box style inside the badge, so it can drift from CORE again');
});

run('week Game Day and Rest are shorter status cards with centred titles', () => {
  const home = homeScreenSource();
  const componentAt = home.indexOf('function WeekDayCardHeader(');
  const dayRowAt = home.indexOf('function DayRow(');
  const lifeFactAt = home.indexOf('interface WeekStripProps', dayRowAt);
  assert(componentAt > 0 && dayRowAt > componentAt && lifeFactAt > dayRowAt,
    'the week header and DayRow regions could not be found');
  const component = home.slice(componentAt, dayRowAt);
  const dayRow = home.slice(dayRowAt, lifeFactAt);

  assert(/const compactWeekStatus = !dayShape && normal && \(isGame \|\| !hasWorkout\) && !isMoveTarget/.test(dayRow),
    'Game Day and Rest do not share one explicit compact week-state decision');
  assert(/!dayShape && compactWeekStatus && styles\.weekDayCardCompact/.test(dayRow)
    && /!dayShape && compactWeekStatus && styles\.weekDayCardInnerCompact/.test(dayRow),
    'the compact status decision does not shorten both the card and its inner padding');
  assert(/compactStatus && styles\.weekCardHeaderCompact/.test(component)
    && /compactStatus && styles\.weekCardDateColumnCompact/.test(component)
    && /compactStatus && styles\.weekCardMainCompact/.test(component),
    'the compact status decision does not reach the whole header layout');
  assert(/weekCardMainCompact:\s*\{[^}]*alignSelf:\s*'stretch'[^}]*justifyContent:\s*'center'/.test(home),
    'the Rest/Game title block is not vertically centred in the shorter card');
  assert(/const showsCategory =/.test(component) && /\{showsCategory \? \(/.test(component),
    'an empty category row still reserves training-card space on Rest or Game Day');
});

run('Coach Notes have one home and do not render on Today or Week', () => {
  const home = homeScreenSource();
  // INVERTED 2026-08-13 (SEAT_INBOX item 16). "One home" was always about the
  // LIST and its controls, never about whether Program may say that a change
  // exists. Sam ruled the notice back onto both Program shapes — read-only,
  // opening My Status — so this line now asserts the notice IS mounted; the
  // line below it, which is the one this cell is actually named for, is
  // untouched.
  assert(/import \{ ModifiersStrip \}/.test(home) && /<ModifiersStrip/.test(home),
    'Program no longer mounts the read-only active-modifier notice on Today or Week');
  assert(!/import \{ ActiveModifiersSection \}/.test(home)
    && !/<ActiveModifiersSection/.test(home),
  'Program still mounts the Coach Notes list after My Status became its home');
  const flow = fs.readFileSync(
    path.join(__dirname, '..', '..', '.maestro', 'golden', 'standard-program-week.yaml'),
    'utf8',
  );
  // RE-AIMED 2026-08-13. This cell pinned the tape's ORDER — make a real
  // modifier, then check both Program shapes — and that order is still the
  // property worth holding. Two things under it changed:
  //
  //   1. The door. `equipment-preset-open` is produced by no product source
  //      (measured 2026-08-13, `grep -rn` over `src` and `.maestro`), so this
  //      cell was pinning the tape to an id that resolves to nothing. It now
  //      pins the readiness door, which is live and is the one the sibling
  //      golden flow was re-routed onto.
  //   2. The verdict. Item 16 mounted the notice, so the tape proves both
  //      shapes SHOW it rather than hide it.
  //
  // The `assertVisible:` prefix is part of each search on purpose: matching the
  // bare id would pass just as happily on an `assertNotVisible`, which is the
  // exact line this cell exists to stop someone quietly restoring.
  const createAt = flow.indexOf('id: "readiness-option-cooked-week"');
  const weekAt = flow.indexOf('file: ../common/show-week-shape.yaml');
  const dayNoticeAt = flow.search(
    /- assertVisible:\s*\n\s*id: "modifiers-strip-day"/);
  const weekNoticeAt = flow.search(
    /- assertVisible:\s*\n\s*id: "modifiers-strip-week"/);
  assert(createAt > 0 && dayNoticeAt > createAt && weekAt > dayNoticeAt
    && weekNoticeAt > weekAt,
  'the visual tape does not create a real modifier before proving BOTH Program '
    + 'shapes show the read-only notice — day first, then week after the shape '
    + 'switch. A tape that asserts the notice before anything is active is '
    + 'asserting the zero state and calling it the built one.');
});

run('the week cards expand details only — session and change controls stay on the day screen', () => {
  const home = homeScreenSource();
  const dayRowAt = home.indexOf('function DayRow(');
  const dayRow = home.slice(dayRowAt, home.indexOf('interface WeekStripProps', dayRowAt));
  assert(dayRowAt > 0 && dayRow.length > 2000,
    'the DayRow region could not be found');
  assert(/!dayShape && isSelected && hasWorkout && !isGame && normal[\s\S]{0,180}\{timeline\}/.test(dayRow),
    'the week card does not own a details-only expanded region');
  assert(/dayShape && isSelected && hasWorkout && !isGame && normal/.test(dayRow),
    'the Start Session block is no longer explicitly scoped to the day screen');
  assert(/dayShape && isSelected && isGame && normal/.test(dayRow),
    'game actions are no longer explicitly scoped to the day screen');
  assert(/dayShape && isSelected && !hasWorkout && normal/.test(dayRow),
    'the add-optional control is no longer explicitly scoped to the day screen');
});

run('a week row carries the day\'s exercise count, and zero shows nothing', () => {
  const home = homeScreenSource();
  const at = home.indexOf('rowCount = ');
  assert(at > 0, 'the week row no longer derives a count — ruling 7\'s head is gone');
  // DERIVED FROM THE PROJECTION THE ROW OPENS ONTO, never stored and never a
  // second read: the head's number and the opened list are one fact.
  assert(/rowCount = \(visibleDay\?\.parts \?\? \[\]\)\.reduce/.test(home),
    'the count is no longer summed from the projection\'s own parts — a number '
    + 'taken beside the list it counts is `a count taken for a record`, again');
  assert(/rowCount > 0 \? \(/.test(home),
    'a day with nothing in it now renders a count. A rest day already says Rest, '
    + 'and "0 exercises" is a sentence about nothing.');
  // AND IT IS THE SHEET'S TEMPLATE, the same one the drop-downs use, so the week
  // row and the opened part cannot phrase the count differently.
  // READ THE REGION THAT RENDERS IT, not the region that computes it — the two
  // are 300 lines apart in this file and the first version of this line sliced
  // from the wrong one, which is the source-scan law biting its own cell.
  const renderAt = home.indexOf('-count`}');
  assert(renderAt > 0, 'the count line is not rendered anywhere');
  const region = home.slice(renderAt, renderAt + 400);
  assert(/day\.part\.exercise_count_one/.test(region) && /day\.part\.exercise_count/.test(region),
    'the week row composes its own count text instead of reading the sheet');
});

run('the chip row carries status and no scheduling doorway', () => {
  const home = homeScreenSource();
  const hub = changeHubSource();
  const rowStart = home.indexOf('<SessionChangeHub');
  assert(rowStart > 0, 'the life-fact chip row is gone from HomeScreenV2 — this gate '
    + 'is watching nothing');
  // The region that RUNS the chips, not the whole file: a chip left behind
  // somewhere else on the screen must not count as a chip in the row.
  const row = home.slice(rowStart, home.indexOf('/>', rowStart));
  assert(row.length > 500 && row.includes('rowTestID="home-life-fact-chips"'),
    'the chip row region could not be delimited — this gate is reading the wrong '
    + 'span and would pass on anything');
  const chips = [...row.matchAll(/id: '(\w+)' as const/g)].map((match) => match[1]!);
  assert(JSON.stringify(chips) === JSON.stringify(['tired', 'sick', 'injured']),
  `the Day card renders the wrong action set: ${JSON.stringify(chips)}`);
  for (const door of LIFE_FACT_DOORS) {
    assert(chips.includes(door.id),
      `the "${door.label}" chip is not in the Day surface's action list at all.`);
    assert(row.includes(door.onPress),
      `the "${door.label}" chip no longer calls ${door.onPress}, the direct `
      + 'door it owns.');
    assert(row.includes(door.testID),
      `the "${door.label}" chip no longer resolves by ${door.testID}. That is the `
      + 'coordinate the walker and the explorer reach this door by.');
    // ⚠ **THE WORD MOVED TO THE SHARED OWNER, SO IT IS ASSERTED THERE.** The
    // screen names the door by id; `components/SessionChangeHub` holds the one
    // copy of each label, which is what stops the two surfaces disagreeing.
    assert(new RegExp(`${door.id}: '${door.label}'`).test(hub),
      `the "${door.label}" chip lost its label. A chip with a glyph and no word is `
      + 'the device-pass finding Sam raised: icon meanings were not obvious.');
  }
  // ONE WORD, TITLE CASE. The short-label law, and also the copy gate: the row is
  // three-across on a phone, and a chip label long enough to be prose is both
  // unreadable there and a new athlete-visible sentence nobody signed. Counted
  // over the SHARED table, because that is where a long word could now be added.
  const labelAt = hub.indexOf('CHANGE_ACTION_LABEL: Record<ChangeActionId, string> = {');
  assert(labelAt > 0, 'the shared label table is gone — this cell would scan the '
    + 'whole component and pass on any quoted string');
  const table = hub.slice(labelAt, hub.indexOf('};', labelAt));
  const labels = [...table.matchAll(/: '([^']*)'/g)].map((match) => match[1]!);
  assert(labels.length === 6,
    `found ${labels.length} chip label(s) in the shared table, expected 6 — the `
    + 'Day and open-session direct-action sets are now disjoint');
  for (const label of labels) {
    assert(/^[A-Z][a-z]+$/.test(label),
      `chip label "${label}" is not one Title Case word. The labels ship PROPOSED `
      + 'under the copy regime and are Sam\'s to sign; a sentence smuggled in here '
      + 'is unsigned copy on the busiest row of the screen.');
  }
  assert(!/editAction=/.test(row),
    'the physical-status card still owns a scheduling doorway');
});

run('the old status bars did not survive alongside their own chips', () => {
  const home = homeScreenSource();
  // COUNTED IN THE SCREEN BODY, NOT IN THE FILE — and the first version of this
  // cell got that wrong and said so out loud on its first run. It counted
  // `setReadinessInjuryVisible(true)` file-wide, found two, and called the second
  // a leftover bar. It is the readiness sheet's own "Something hurts" row: the
  // documented SECOND DOOR to one owner, older than this unit. The number named
  // the FILE while the claim was about the SCREEN (`a count taken for a record`,
  // again). So the region is the scroll body, where a row either is or is not.
  const bodyStart = home.indexOf('<ScrollView');
  const bodyEnd = home.indexOf('</ScrollView>');
  assert(bodyStart > 0 && bodyEnd > bodyStart,
    'the Program screen\'s scroll body could not be located — this gate is reading '
    + 'the wrong region and would pass on anything');
  const body = home.slice(bodyStart, bodyEnd);
  // A MOVE THAT DOES NOT DELETE IS A DUPLICATE. Two live copies of one door means
  // two nodes answering to one testID, and a finder that picks one at random.
  for (const door of LIFE_FACT_DOORS) {
    const hits = body.split(door.onPress).length - 1;
    assert(hits === 1,
      `${door.onPress} appears ${hits} times in the Program screen's body. The chip `
      + 'row REPLACES the stacked bars; leaving one behind gives the athlete the '
      + 'same door twice and gives the explorer two nodes with one identity.');
  }
  // THE OLD BAR TREATMENT HAS EXACTLY ONE SURVIVOR, AND IT IS NAMED. The 28pt
  // icon-and-sentence card is what the five bars were; the practice-match CTA
  // borrowed the same styles and is NOT one of Sam's five — it is a conditional
  // week-level offer with a composed label, not a life fact. So the survivor is
  // pinned by name rather than the treatment being banned outright: a SECOND
  // survivor is a bar that was missed, and this reds on it.
  //
  // RE-COUNTED 2026-08-21: ZERO. Away and add-fixture are still week-level
  // controls, but they now live as rows inside the one Edit this week menu.
  // Neither needs the old icon-and-sentence card treatment in the scroll body.
  const barIcons = body.match(/styles\.busyAwayIcon\b/g) ?? [];
  assert(barIcons.length === 0,
    `${barIcons.length} old icon-and-sentence week card(s) remain. Add fixture and `
    + 'Away now belong inside the one Edit this week menu.');
  assert(!body.includes('testID="home-away-entry"')
    && !body.includes('showAddFixtureCTA'),
  'a separate Away or add-fixture card survived beside Edit this week');
});

// ── ITEM 19: AS MANY GAMES AS THE WEEK NEEDS ────────────────────────────────
//
// **Sam, 2026-08-12:** *"no a user should be able to have as many games as
// needed in their week."* He was looking at the button when he said it.
//
// THE ORDER'S PREMISE WAS WRONG AND THE CELLS SAY SO. It states "in season
// there is NO add-a-game control at all". There was one; it was gated
// `!weekHasGame` and vanished once the week had a fixture, and pre-season's
// card turned into a LABEL for the first fixture at the same moment. The defect
// is real — no route to a SECOND game — but it was a CAP, not an absence, and
// these cells hold the cap down rather than holding a third card up.
run('the add-fixture control never caps the week at one game', () => {
  const home = homeScreenSource();
  const sheetStart = home.indexOf('function WeekEditSheet');
  const sheetEnd = home.indexOf('function GameDaySheet', sheetStart);
  assert(sheetStart >= 0 && sheetEnd > sheetStart,
    'the Edit this week sheet could not be bounded');
  const sheet = home.slice(sheetStart, sheetEnd);
  assert(/phase === 'In-season' \|\| phase === 'Pre-season'/.test(sheet)
    && sheet.includes('testID="edit-week-add-fixture"'),
  'the add-fixture row is no longer available in both competitive phases');
  assert(!/hasFixture[\s\S]{0,160}edit-week-add-fixture/.test(sheet),
    'the add-fixture row is gated on whether the week already has a fixture — '
    + 'that silently restores the one-game cap');
  assert(!/practiceMatchDay/.test(home),
    'the screen has re-grown a `find`-the-first-fixture binding. A week may hold '
    + 'several fixtures; the first of a set is how the one-game assumption gets '
    + 'back in, and it is what made the control become a label.');
});

// SAM, 2026-08-13, ON SEEING THE BUTTON ON THE DAY SCREEN: *"add a game button
// should only be on week screen - not day screen and then you select what day
// you need to add it too"*.
//
// THE SHAPE GATE IS THE CLAIM, SO THE SHAPE GATE IS THE CELL. The control lives
// in the shared scroll body, which BOTH shapes render — so week-only is not
// something the code says by where it sits, and nothing but an assertion keeps
// it true. It is one edit away from showing on the day screen again, which is
// exactly where Sam found it.
run('the add-fixture control is on the WEEK shape only', () => {
  const home = homeScreenSource();
  const body = home.slice(home.indexOf('function HomeScreenV2'));
  const entryAt = body.indexOf('testID="edit-week-button"');
  const weekBranchAt = body.lastIndexOf('<ModifiersStrip', entryAt);
  assert(entryAt > 0 && weekBranchAt > 0
    && body.slice(weekBranchAt, entryAt).includes('surface="week"'),
  'Edit this week is no longer mounted in the Week branch');
  assert(body.split('testID="edit-week-button"').length - 1 === 1,
    'Edit this week has more than one visible entry, so it may have leaked onto Day');
});

run('the add-fixture control shows in BOTH competitive phases, labelled by phase', () => {
  const home = homeScreenSource();
  assert(!/showPracticeMatchCTA|showAddGameCTA|showAddFixtureCTA/.test(home),
    'the two old CTA flags are back. They were one decision wearing two names, '
    + 'and two names is how the two cards drifted into disagreeing about '
    + 'whether a week may have a second game.');
  assert(/'Add a practice match'/.test(home) && /'Add a game'/.test(home),
    'the control no longer carries both phase labels; the order is that the '
    + 'label follows the phase, matching the picker banner that already branches');
  assert(!/No game this week/.test(home),
    'the old in-season copy is back. "No game this week - add one" is FALSE on '
    + 'exactly the weeks this control now has to appear on — the ones that '
    + 'already have a game.');
});

run('Week keeps one edit menu while Day enters it through the session card menu', () => {
  const home = homeScreenSource();
  const hook = fs.readFileSync(
    path.join(__dirname, '..', 'screens', 'home', 'useHomeScreen.ts'), 'utf8');
  const plan = fs.readFileSync(
    path.join(__dirname, '..', 'screens', 'home', 'PlanChangeSheet.tsx'), 'utf8');

  assert(home.includes('<Text style={styles.editWeekButtonText}>Edit this week</Text>')
    && home.includes('name="pencil-outline"')
    && home.includes('testID="edit-week-button"'),
  'the Week-only pen button is missing');
  assert(/editWeekButton:\s*\{[\s\S]*?justifyContent:\s*'flex-start'[\s\S]*?backgroundColor:\s*'#1A1E18'/.test(home),
    'Edit this week is no longer a subtly distinct, left-aligned button');
  assert(!home.includes('Want to change something?')
    && !home.includes('testID="make-change-link"')
    && home.includes('testID="home-plan-options"')
    && /onPlanOptions=\{\(\) => setChangeSheetEntry\(\{ date: day\.date \}\)\}/.test(home),
  'Day does not enter the existing Add / Move / Remove menu through its programmed-session card');

  const sheetStart = home.indexOf('function WeekEditSheet');
  const sheetEnd = home.indexOf('function GameDaySheet', sheetStart);
  assert(sheetStart >= 0 && sheetEnd > sheetStart,
    'the Week edit sheet could not be bounded');
  const sheet = home.slice(sheetStart, sheetEnd);
  assert(sheet.includes('label="I have a bye"')
    && /phase === 'In-season'/.test(sheet),
  'the bye row is missing or is not limited to In-season');
  assert(sheet.includes('label="I’m going away"')
    && sheet.includes('label="Add, move or remove a session"'),
  'the Away or session-edit row is missing from Edit this week');
  assert(sheet.indexOf('label="Add, move or remove a session"')
    > sheet.indexOf('label="I’m going away"'),
  'session editing is no longer the bottom option in Edit this week');
  assert(sheet.includes('name="calendar-remove-outline" size={18} color={hasFixture ? \'#67D7FF\' : \'#666666\'}')
    && sheet.includes('icon={<RowIcon kind="game" size={18} color={rowIconColor(\'game\')} />}')
    && sheet.includes('name="airplane" size={18} color="#B9A7FF"')
    && sheet.includes('name="pencil-outline" size={18} color="#5BD98A"'),
  'the Week edit rows no longer use the established bye, game, away and session icon treatment');
  assert(sheet.includes("setStep('session_action')")
    && sheet.includes("'What do you want to do?'")
    && ['Add a session', 'Move a session', 'Remove a session']
      .every((label) => sheet.includes(`label="${label}"`))
    && !sheet.includes('label="Swap a session"')
    && ["onEditSession('add')", "onEditSession('move')", "onEditSession('remove')"]
      .every((route) => sheet.includes(route)),
  'the weekly session flow does not choose Add, Move or Remove first');
  assert(home.includes('setWeekSessionEditAction(action)')
    && home.includes('WEEK_SESSION_PICKER_COPY[weekSessionEditAction].banner')
    && home.includes('const isPickerMode = pickerMode !== \'normal\'')
    && home.includes('WEEK_SESSION_PICKER_COPY[weekPickerAction].row'),
  'the chosen action does not turn the Week cards into the day picker');
  assert(home.includes("setChangeSheetEntry({ date: day.date, initialAction, origin: 'week' })")
    && home.includes("fromWeek={changeSheetEntry?.origin === 'week'}"),
  'the selected weekly day and action do not enter the existing PlanChangeSheet');
  assert(plan.includes("export type PlanChangeInitialAction = 'add' | 'move' | 'remove'")
    && plan.includes("if (initialAction === 'add')")
    && plan.includes("if (initialAction === 'move')")
    && !plan.includes("if (initialAction === 'swap')")
    && ['Add this session', 'Move this session', 'Remove this session']
      .every((label) => plan.includes(`label="${label}"`)),
  'the weekly route does not enter the same three action owners as Day');
  assert(plan.includes('name="plus-circle-outline" size={18} color={options.canAdd ? \'#5BD98A\' : MUTED}')
    && plan.includes('name="arrow-right-bold-outline" size={18} color={options.move.refusal ? MUTED : \'#67D7FF\'}')
    && plan.includes('name="delete-outline" size={18} color={options.canRemove ? \'#FF7A85\' : MUTED}'),
  'the Day action menu no longer matches the Week icon and colour system');
  const dayActions = plan.slice(
    plan.indexOf("step.kind === 'actions'"),
    plan.indexOf("step.kind === 'add_blocked_max_sessions'"),
  );
  assert(dayActions.indexOf('label="Add this session"') < dayActions.indexOf('label="Move this session"')
    && dayActions.indexOf('label="Move this session"') < dayActions.indexOf('label="Remove this session"')
    && !dayActions.includes('Swap this session')
    && /<Button[\s\S]{0,120}label="Back"[\s\S]{0,160}variant="ghost"/.test(dayActions),
  'the Day action menu no longer matches the Week order and centred Back treatment');

  assert(/const handleSetByeWeek = async \(\): Promise<boolean> =>/.test(hook)
    && /fixtureDates[\s\S]{0,500}rebuildForGameChange\(null, \{ targetDate: fixtureDate \}\)/.test(hook),
  'the bye row is not reusing the existing durable fixture-removal path');
  assert(home.includes('setAwayVisible(true)') && home.includes('testID="edit-week-away"'),
    'the weekly Away row no longer opens the existing Away flow');
});

// ─────────────────────────────────────────────────────────────────────────────
// SLICE 2 — THE BUCKET VOCABULARY (Sam's ruling, 2026-08-08 morning)
//
// "BUCKET WORDS ONLY on the week view rows AND the day title" — Strength,
// Conditioning, Rest, Mobility, Accessories, Gunshow, and Speed. The variant
// (Upper Push, Lower Squat, Full Body) belongs on the TIMELINE rows, one per
// line, "exactly as now". And, verbatim: *"power should not be labelled there
// for just 1 exercise — power is just part of the Strength work."*
//
// These cells watch a real generated week, because the exhibit that produced the
// ruling was one: a Tuesday whose power component held a single exercise and
// whose card therefore read "Power".
// ─────────────────────────────────────────────────────────────────────────────

/** Every `VisiblePartKind`, spelled out — the closed union is the test's job to state. */
const PART_KINDS = [
  'strength', 'conditioning', 'recovery', 'team_training',
  'game', 'power', 'speed', 'support',
] as const;

/**
 * THE WORDS A DAY IS ALLOWED TO BE CALLED.
 *
 * Assembled from the SIGNED SHEET — the generic kind headline for every part
 * kind, the three charter optional doors (which are themselves three of Sam's
 * bucket words), and the day-level names for the days that have no parts to take
 * a bucket from. Not from `partBucket`'s own table, which would make this cell
 * agree with the implementation by construction.
 */
function bucketVocabulary(): Set<string> {
  const words = new Set<string>();
  for (const kind of PART_KINDS) words.add(signedCopy(`part.headline.${kind}`));
  // THE CATEGORY ID IS `prehab`; THE ATHLETE'S WORD IS "Accessories" (Sam,
  // ruling 6-IV-1). Writing `accessories` here reds immediately — the registry
  // throws on an unregistered id rather than inventing a word, which is how this
  // cell learned the id on its first run.
  for (const optional of ['gunshow', 'mobility', 'prehab']) {
    words.add(signedCopy(`part.headline.optional.${optional}`));
  }
  for (const day of ['training', 'rest', 'game', 'practice_match']) {
    words.add(signedCopy(`day.headline.${day}`));
  }
  return words;
}

/** Sam's separator, from the sheet — never a literal written in this file. */
const JOINER = signedCopy('copy.joiner.plus');

/**
 * The bucket words in a day's title, as the athlete reads them.
 *
 * A title is a LIST since Sam's compound ruling (2026-08-08 afternoon), so every
 * cell that used to ask "is this title a bucket word" now asks it of each word in
 * the list. Splitting here rather than loosening those cells is the difference
 * between the vocabulary law surviving the ruling and being quietly dropped by it.
 */
function titleWords(day: VisibleDay): string[] {
  return String(visibleDayLeadHeadline(day)).split(String(JOINER));
}

run('every day is titled with BUCKET words, never a session variant name', () => {
  world();
  const vocabulary = bucketVocabulary();
  let checked = 0;
  const offenders: string[] = [];
  for (const week of WEEKS) {
    for (const day of visibleDays(week)) {
      const title = visibleDayLeadHeadline(day);
      checked += 1;
      // EVERY WORD IN THE LIST, not the list as a whole — a compound whose
      // second half is a variant name ("Strength + Upper Push") is exactly the
      // defect the ruling exists to prevent, and a whole-string membership test
      // would have no opinion about it at all.
      for (const word of titleWords(day)) {
        if (!vocabulary.has(word)) offenders.push(`${day.date}="${title}" (word "${word}")`);
      }
    }
  }
  // NON-VACUITY FIRST. A world that produced no days, or a vocabulary that
  // swallowed everything, would pass this cell while proving nothing.
  assert(checked >= 21, `only ${checked} day(s) read — the world is not built`);
  assert(vocabulary.size >= 10 && !vocabulary.has('Upper Push'),
    'the bucket vocabulary is wrong: it must not contain a session variant name, '
    + 'or this cell passes on exactly what it exists to catch');
  assert(offenders.length === 0,
    `${offenders.length} day(s) are titled with something that is not a bucket `
    + `word: ${offenders.join(', ')}. Sam ruled bucket words only on the week rows `
    + 'and the day title; the variant name belongs on the timeline.');
});

run('a charter door\'s own word IS the bucket — Gunshow does not become Strength', () => {
  // WRITTEN BECAUSE A MUTATION SURVIVED. Deleting the charter-optional branch
  // from `partBucket` left every cell above green: a Gunshow day would quietly
  // read "Strength", and "Strength" is a perfectly legal bucket word, so the
  // vocabulary cell could not see it. Three of the seven words Sam listed —
  // Gunshow, Mobility, Accessories — are the Add-menu's doors, and an athlete
  // who tapped one must find their day filed under the word they tapped.
  world();
  const titles: string[] = [];
  for (const week of WEEKS) {
    for (const day of visibleDays(week)) titles.push(visibleDayLeadHeadline(day));
  }
  const gunshow = signedCopy('part.headline.optional.gunshow');
  assert(titles.includes(gunshow),
    `no day in three generated weeks is titled "${gunshow}". Either the charter `
    + 'optional door stopped naming its own day — which is this cell\'s whole '
    + 'point — or the generator stopped producing one, in which case this cell '
    + 'is standing on nothing and needs a day that reaches the door.');
  // AND IT IS NOT THE STRENGTH FALLBACK WEARING THE RIGHT WORD BY ACCIDENT.
  assert(gunshow !== signedCopy('part.headline.strength'),
    'the two ids resolve to the same word, so the assertion above cannot tell '
    + 'the door\'s answer from the fallback');
});

/* ⚠ **INVERTED, NOT DELETED — SAM, 2026-08-20, EXTENDING R-110 TO THE DAY CARD.**
 *
 * *"Merge POWER into Strength on the Program tab's Day summary card too. No
 * separate POWER row. Strength's count includes the power exercise. If Strength
 * is expanded, power appears first."*
 *
 * This cell REQUIRED the thing the ruling removes. It asserted that a day with
 * power parts LEADS with one (`day.parts[0].kind === 'power'`) and that the
 * timeline still NAMES it (`part.headline.power`) — the 2026-08-08 ruling, which
 * moved the word "Power" off the title and onto the timeline. Sam has now moved
 * it off the timeline as well, so the two assertions are turned around: there is
 * no power part at all, and the day's power exercises are inside its STRENGTH
 * part, first. The half of the old cell that still holds — "Power" never appears
 * in a day's title — is kept untouched, because that ruling was not overturned.
 *
 * ⚠ **IT WAS ALSO RED AT HEAD, FOR A REASON THAT HAD NOTHING TO DO WITH POWER.**
 * `title === signedCopy('part.headline.strength')` predates the COMPOUND-title
 * ruling below it, so the exhibit day — which carries team training too —
 * legitimately reads "Strength + Team Training" and the equality could not hold.
 * A guard that reds for a stale reason is a guard nobody reads, so it is fixed
 * here rather than left: the day must CONTAIN the Strength word, which is what
 * the ruling actually says. */
run('POWER is not a part — a day\'s power work sits inside Strength, first', () => {
  world();
  let powerDays = 0;
  let pairedOnlyDays = 0;
  for (const week of WEEKS) {
    // The SAME resolved week the projection was built from, so the workout a
    // day's power rows come from is the workout that day projects — not a
    // second read that could disagree with it.
    const resolved = projected(week);
    for (const day of visibleDays(week)) {
      const title = visibleDayLeadHeadline(day);
      // NOT `title !== "Power"` — that was enough while a title was one word, and
      // a compound title would smuggle the word straight past it as
      // "Strength + Power". Every word in the list is checked.
      assert(!titleWords(day).includes(String(signedCopy('part.headline.power'))),
        `${day.date} is titled "${title}". Sam, verbatim: power should not be `
        + 'labelled there for just one exercise — power is part of the Strength '
        + 'work, and "Power" never appears as a week row or a day title.');

      // THE EXHIBIT IS FOUND BY ITS ROWS NOW, NOT BY ITS PART. The part is
      // exactly what the ruling deleted, so a cell that looked for one would
      // find nothing and pass by saying nothing about any day at all.
      const workout = resolved.find((entry) => entry.date === day.date)?.workout ?? null;
      const power = powerRows(workout);
      if (power.length === 0) continue;
      powerDays += 1;

      // 1. NO SEPARATE POWER ROW, anywhere on the day.
      const timeline = dayTimeline(day, null);
      assert(!timeline.some((entry) => entry.headline === signedCopy('part.headline.power')),
        `${day.date}'s timeline still names a Power component. Sam: "No separate `
        + 'POWER row."');

      // 2. STRENGTH'S COUNT INCLUDES THE POWER EXERCISE — and this is the cell
      //    that catches the lazy fix, which is deleting the power row and
      //    leaving its exercises off the card entirely.
      const strength = timeline.filter((entry) => entry.kind === 'strength');
      assert(strength.length === 1,
        `${day.date} has ${strength.length} strength rows on its timeline; power `
        + 'and strength must merge into exactly one.');
      const names = strength[0].rows.map((row) => String(row.name));
      for (const row of power) {
        assert(names.includes(String(row.exercise?.name ?? '')),
          `${day.date}: "${row.exercise?.name}" is prescribed as power work and `
          + `is not in the Strength row's ${names.length} exercises: ${names.join(', ')}. `
          + 'Merging the row must not drop the work.');
      }

      // 3. IF STRENGTH IS EXPANDED, A STANDALONE PRIMER APPEARS FIRST.
      //
      // ⚠ NARROWED 2026-08-20 (Sam): *"'Power appears first' applies only to a
      // standalone power primer. For valid contrast training, preserve the
      // authored pair at the main slot: heavy lift → paired explosive movement."*
      // A paired row is SKIPPED here rather than asserted the wrong way round —
      // and the skip is counted, so a world that is all-contrast cannot make this
      // cell pass by having nothing left to check.
      const standalone = power.filter((row: any) =>
        !row.supersetGroup && row.pairType !== 'contrast');
      if (standalone.length === 0) { pairedOnlyDays += 1; continue; }
      assert(names[0] === String(standalone[0].exercise?.name ?? ''),
        `${day.date}'s Strength row opens with "${names[0]}", not with the standalone `
        + `power primer "${standalone[0].exercise?.name}".`);

      // 4. AND THE DAY IS STILL A STRENGTH DAY BY NAME. Contains, not equals:
      //    the exhibit carries team training too and reads "Strength + Team
      //    Training" under the compound-name ruling below.
      assert(titleWords(day).includes(String(signedCopy('part.headline.strength'))),
        `${day.date} holds power work and is titled "${title}", which does not `
        + 'name Strength at all.');
    }
  }
  assert(powerDays >= 1,
    'no day in three generated weeks carries power work — this cell proved '
    + 'nothing about the exhibit it was written for');
  assert(powerDays > pairedOnlyDays,
    `all ${powerDays} power days are CONTRAST PAIRS, so the standalone-primer `
    + 'assertion was skipped on every one of them and this cell proved nothing. '
    + 'The pair-order rule is held by test:power-primer-policy section [9].');
});

// ─────────────────────────────────────────────────────────────────────────────
// THE COMPOUND NAME (Sam's ruling, 2026-08-08 afternoon, verbatim):
//
//   "on weekly view it should say whatever the bucket is that day i.e. Strength
//    or strength + conditioning. On the daily it can get more granular and be
//    like Upper body push and MAS work or whatever it is i think"
//
// The week row and the day title say ALL of the day's buckets, joined by his own
// " + ", in timeline order, each word once.
// ─────────────────────────────────────────────────────────────────────────────

run('a day is named with ALL of its buckets, in timeline order, each word once', () => {
  world();
  let compound = 0;
  let checked = 0;
  for (const week of WEEKS) {
    for (const day of visibleDays(week)) {
      // A fixture's title is its fixture whatever its workout resolved — the
      // gate traced in `visibleDayLeadHeadline`, not re-litigated here.
      if (day.kind === 'game' || day.parts.length === 0) continue;
      checked += 1;
      // THE EXPECTATION IS BUILT FROM THE DAY'S OWN PARTS, in the order the
      // timeline renders them, deduplicated by the WORD. Built here rather than
      // read from the implementation, or the cell agrees with whatever the code
      // does by construction.
      const expected: string[] = [];
      for (const part of day.parts) {
        const word = String(part.bucket);
        if (!expected.includes(word)) expected.push(word);
      }
      assert(String(visibleDayLeadHeadline(day)) === expected.join(String(JOINER)),
        `${day.date} is named "${visibleDayLeadHeadline(day)}" but holds buckets `
        + `${JSON.stringify(expected)}. Sam ruled the week row says whatever the `
        + 'buckets are that day, joined, in timeline order, each word once.');
      // AND THE TIMELINE ORDER IS THE PART ORDER — the clause "in timeline order"
      // is unfalsifiable unless the two lists are actually compared.
      const timelineOrder = dayTimeline(day, null).map((entry) => entry.partId);
      assert(JSON.stringify(timelineOrder) === JSON.stringify(day.parts.map((part) => part.id)),
        `${day.date}'s timeline runs ${JSON.stringify(timelineOrder)} while the name `
        + 'is built from the parts in projection order. "Timeline order" means '
        + 'nothing if the two can differ.');
      if (expected.length > 1) compound += 1;
    }
  }
  // NON-VACUITY, BOTH WAYS. A world with no multi-bucket day proves nothing
  // about a joined name, and a world with no days proves nothing at all.
  assert(checked >= 8, `only ${checked} named day(s) read — the world is not built`);
  assert(compound >= 1,
    'no day in three generated weeks holds two different buckets, so this cell '
    + 'never exercised the join it exists to check');
});

/* ⚠ **INVERTED — SAM, 2026-08-20 — AND THE HONEST HALF IS THE NOT-COVERED NOTE.**
 *
 * This cell guarded the deduplication in `dayBuckets`, and its exhibit was named
 * in its own words: *"a day carrying both a power and a strength part"*, which
 * both bucket to "Strength". **That day no longer exists** — the power component
 * projects into the strength PART now, so the collision the dedupe existed to
 * absorb cannot be built by the generator at all.
 *
 * So the cell asserts the ruling's actual consequence, which is stronger than
 * what it replaced: no day has two parts sharing a bucket, so a compound title
 * CANNOT stutter, rather than not stuttering because something de-duplicated it.
 *
 * ⚠ **NOT COVERED, SAID RATHER THAN HIDDEN:** `dayBuckets`' `seen` set is now
 * unreachable in three generated weeks, so deleting it would red nothing here.
 * It is KEPT, because `COMPONENT_TO_PART` is still many-to-one for
 * `recovery`/`recovery_addon` (both bucket to "Recovery") and a recovery day
 * carrying add-ons would collide the same way — that world simply is not one the
 * generator reaches in this suite's three weeks. Removing the safeguard on the
 * strength of an unreachable exhibit is how the collision comes back. */
run('no two parts on a day share a bucket — power was the only collision', () => {
  world();
  let multiPartDays = 0;
  for (const week of WEEKS) {
    for (const day of visibleDays(week)) {
      if (day.parts.length < 2) continue;
      multiPartDays += 1;
      const buckets = day.parts.map((part) => String(part.bucket));
      assert(buckets.length === new Set(buckets).size,
        `${day.date} has two parts bucketing to the same word. Its parts are `
        + `${JSON.stringify(day.parts.map((p) => String(p.kind)))}, bucketing to `
        + `${JSON.stringify(buckets)}. Sam merged the one pair that collided; a `
        + 'new collision needs its own ruling, not a silent dedupe.');
      // AND THE TITLE STILL SAYS EACH WORD ONCE, which is what the athlete reads.
      const words = titleWords(day);
      assert(words.length === new Set(words).size,
        `${day.date} is titled "${visibleDayLeadHeadline(day)}" — a bucket word is `
        + 'repeated.');
    }
  }
  assert(multiPartDays >= 1,
    'no day in three generated weeks carries two parts — this cell proved '
    + 'nothing, and the suite has stopped generating multi-part days.');
});

run('a compound name is SIGNED, and one unsigned half makes the whole thing unsigned', () => {
  world();
  const strength = String(signedCopy('part.headline.strength'));
  const conditioning = String(signedCopy('part.headline.conditioning'));
  // THE L-P2 RUNTIME LAW STILL ANSWERS for a joined name — otherwise every
  // surface-agreement sweep would report the athlete reading unsigned words.
  assert(isSignedCopyText(`${strength}${JOINER}${conditioning}`),
    'a compound of two signed bucket words does not read as signed. The runtime '
    + 'copy law is what sweeps the surfaces; it has to know what a join is.');
  // AND IT IS NOT A HOLE. This is the half that matters: the join must not turn
  // `isSignedCopyText` into "contains a plus sign somewhere".
  assert(!isSignedCopyText(`${strength}${JOINER}Upper Body Blast`),
    'a compound with an UNSIGNED half reads as signed. The join would then be a '
    + 'door for any text at all, which is the hole the branded type exists to '
    + 'close — every part of a compound must be in the sheet.');
  assert(!isSignedCopyText(`${strength} plus ${conditioning}`),
    'two signed words joined by a separator NOBODY SIGNED read as signed. The '
    + 'separator is athlete-visible text and it comes from the sheet like every '
    + 'other character.');
});

run('the glyph keys on ONE bucket word — a compound name never reaches the icon table', () => {
  // A LIVE REGRESSION THIS UNIT CAUSED, CAUGHT BY MEASURING THE TABLE RATHER
  // THAN REASONING ABOUT IT. The row's icon and accent colour resolve by
  // matching the day's name against `displayLabelIconKind`, which is a list of
  // label EQUALITIES ('strength', 'upper push', 'gunshow'). "Strength + Team
  // Training" matches no row in it, so every joined day would have dropped to
  // the grey generic activity glyph — four of the six rows this ruling changes.
  //
  // The slice-2 report had already looked at this table and concluded nothing
  // regressed because "Strength" resolved. That was true until the title stopped
  // being one word. `a-ruling-premise-is-a-claim-too`: the premise aged out.
  world();
  const vocabulary = bucketVocabulary();
  let checked = 0;
  for (const week of WEEKS) {
    for (const day of visibleDays(week)) {
      const key = String(visibleDayLeadBucket(day));
      checked += 1;
      assert(!key.includes(String(JOINER)),
        `${day.date}'s icon key is "${key}" — a JOINED name reaching the icon `
        + 'table, which matches on equalities and will return the generic glyph.');
      assert(vocabulary.has(key),
        `${day.date}'s icon key is "${key}", which is not a bucket word. The glyph `
        + 'table is keyed on these; anything else falls through.');
    }
  }
  assert(checked >= 21, `only ${checked} day(s) read — the world is not built`);
  // AND IT IS THE SAME ANSWER THE TITLE USED TO GIVE, which is the whole reason
  // no glyph can have moved: the leading bucket IS the pre-compound title rule.
  for (const week of WEEKS) {
    for (const day of visibleDays(week)) {
      const expected = day.kind === 'game' || day.parts.length === 0
        ? String(day.headline)
        : String(day.parts[0].bucket);
      assert(String(visibleDayLeadBucket(day)) === expected,
        `${day.date}'s icon key is "${visibleDayLeadBucket(day)}" where the rule `
        + `before the compound ruling gave "${expected}". If these can differ, a `
        + 'glyph moved on a day this ruling was never about.');
    }
  }
  // THE SURFACE ACTUALLY USES IT. Deleting the wiring would leave every
  // assertion above green while the screen went on passing the compound title.
  const home = homeScreenSource();
  assert(/titleIconKind\(\{[^}]*title: iconKey/.test(home)
    && /getDayRowAccentColor\(\{[\s\S]{0,200}?title: iconKey/.test(home),
    'the row no longer feeds the leading-bucket key to its icon and accent '
    + 'colour — the compound title is reaching the equality table again.');
});

run('joining is a SHEET operation — no surface picks its own separator', () => {
  // THE COMPOSITION IS THE DEFECT, NOT THE PUNCTUATION. `DayWorkoutScreenV2` used
  // to build its subtitle with `detail.attached.join(' + ')` — a screen choosing
  // athlete-visible characters. This watches both screens that name a day.
  for (const file of ['HomeScreenV2.tsx', 'DayWorkoutScreenV2.tsx']) {
    const source = stripComments(fs.readFileSync(
      path.join(__dirname, '..', 'screens', 'home', file), 'utf8'));
    assert(!/\.join\((['"`])\s*\+\s*\1\)/.test(source),
      `${file} joins something on a " + " literal again. The separator is a signed `
      + 'entry (`copy.joiner.plus`) and the projection does the joining — a screen '
      + 'that picks its own is authoring words the sheet never saw.');
  }
  // AND THE SHEET'S OWN DOOR REFUSES A NON-SEPARATOR, so the rule cannot be
  // satisfied by joining with any entry that happens to be handy.
  let refused = false;
  try {
    joinSignedCopy([signedCopy('part.headline.strength')], 'part.headline.conditioning');
  } catch { refused = true; }
  assert(refused,
    'joinSignedCopy accepted an ordinary entry as its separator. It would paste '
    + 'one athlete-visible sentence between two others and the result would still '
    + 'type as signed.');
});

run('the day card composes no name of its own', () => {
  const home = homeScreenSource();
  // THE COMPOSITION IS THE DEFECT, NOT THE LINE. "+ Conditioning" was built in
  // the row by joining part headlines, which is a surface making a name out of
  // other names. The gate watches for the JOIN returning, in the two shapes it
  // took (a template literal and an `Array.join` over headlines).
  assert(!/`\+ \$\{/.test(home),
    'a "+ ..." line is being composed in HomeScreenV2 again. The timeline is the '
    + 'day\'s one enumeration; a title that restates it is the double-labelling '
    + 'Sam ruled out on 2026-08-08.');
  assert(!/\.map\(\(part\) => part\.headline\)\.join\(/.test(home),
    'the row is joining part headlines into one string again — same defect, '
    + 'different spelling.');
  assert(!/contextLabel/.test(home),
    'the secondary context line is back in HomeScreenV2.');
  // AND THE TITLE STILL COMES FROM THE PROJECTION. Deleting the line would also
  // "pass" if the whole title were deleted, so the surviving half is asserted.
  /* The call gained its second argument on 2026-08-22 — `dayShape` decides
     whether the title covers the whole day (week row) or the programmed work
     alone (day card, since club training moved to its own box). The rule this
     cell protects is unchanged: the title still comes from the projection's one
     lead-headline owner and is never composed in the screen. */
  assert(/cardLeadHeadline\(visibleDay, dayShape\)/.test(home) && /visibleDayLeadHeadline/.test(home),
    'the row no longer takes its title from the projection\'s one lead-headline '
    + 'rule — which is the only thing keeping the card and the day screen from '
    + 'disagreeing about what a day is called');
});

run('no clock times, and the timeline entry shape is pinned', () => {
  world();
  const day = visibleDays(WEEK).find((candidate) => candidate.parts.length > 0);
  assert(day, 'no day with parts to read');
  const entry = dayTimeline(day, null)[0];
  const keys = Object.keys(entry).sort();
  // `rows` ADMITTED 2026-08-10, UI merge slice 2, and this is the gate doing its
  // job rather than being loosened: it caught the new field on the first run.
  //
  // WHY IT IS ADMITTED. Sam's eye pass — *"hers has like mobility / warmup then
  // drop down of the exercise and the sets and reps"* — needs each part's
  // exercises on the card. `rows` is the PROJECTION's own list, passed through
  // untouched (`section.rows`), so it adds no representation and no clock time:
  // it is the same list the day-detail screen already renders, which is what
  // `surfaceAgreementTests` exists to keep true. **A start time still cannot
  // arrive through here** — that is what this pin is for, and it is unchanged.
  // ── `iconKind` ADMITTED 2026-08-23 (R-129). IT CAUGHT THE FIELD ON THE FIRST
  // RUN, which is the second time this pin has done its job.
  //
  // WHY IT IS ADMITTED. Sam asked for the lightning bolt on his Primer's day
  // card. The screen used to choose the glyph itself with
  // `PART_ICON_KIND[entry.kind]`, and `VisiblePartKind` has no `primer` member —
  // nor should it grow one, because a Primer IS a strength part; it is a
  // strength part with its own identity. The alternative was to match the
  // headline STRING on the card, which is `displayLabelIconKind`'s antipattern
  // and this repo already carries one of those.
  //
  // It adds NO representation: it is a lookup in `PART_ICON_KIND` — the same
  // table the screen was reading — performed where the workout's typed
  // `composedOptionalKind` is still in scope, and it carries no clock time.
  // **A start time still cannot arrive through here**; that is what this pin is
  // for, and it is unchanged.
  assert(JSON.stringify(keys) === JSON.stringify(
    ['completion', 'componentId', 'headline', 'iconKind', 'kind', 'partId', 'rows']),
    `the timeline entry carries ${JSON.stringify(keys)}. Sam's direction is ordered `
    + 'steps and no times of day; a new field — a start time above all — arrives '
    + 'through this gate or not at all.');
  // NOT VACUOUS: a `rows` that arrived empty would satisfy the shape pin and
  // render a drop-down onto nothing. The day picked above has parts, and a part
  // the athlete has to do has exercises in it.
  assert(entry.rows.length > 0,
    'the timeline entry carries an EMPTY rows list — the drop-down would open '
    + 'onto nothing, and the shape pin alone cannot see that.');
  // AND IT IS THE PROJECTION'S OWN LIST, not a copy that could drift: same
  // length and same first id as the part the entry names.
  const part = day.parts.find((candidate) => candidate.id === entry.partId);
  assert(part && part.rows.length === entry.rows.length && part.rows[0].id === entry.rows[0].id,
    'the timeline\'s rows are not the projection\'s rows for that part — a second '
    + 'reading of a day is exactly what this file exists to prevent.');
});

console.log(`\n  day-first timeline totals: ${passed} passed, ${failed} failed`);
if (failures.length > 0) console.log(`  failed: ${failures.join(', ')}`);
totalsPrinted(failed);
if (failed > 0) process.exit(1);
