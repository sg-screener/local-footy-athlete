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
import type { TrainingProgram } from '../types/domain';
import type { ResolvedDay } from '../utils/sessionResolver';
import { generateProgramLocally } from '../services/api/generateProgram';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
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
import { isSignedCopyText, signedCopy } from '../rules/signedCopy';
import { registerProjectionCopy } from '../rules/projectionCopy';
import type { VisibleDay } from '../rules/visibleProjection';
import type { SessionFeedback } from '../store/programStore';
import { samExport8Profile, SAM_EXPORT_8_TODAY_ISO, SAM_EXPORT_8_CURRENT_WEEK } from './support/samDeviceExport8Fixture';
import { stripComments } from './support/sourceText';

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
  useProfileStore.setState({ onboardingData: profile, isOnboardingComplete: true });
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
  'power', 'strength', 'support', 'conditioning', 'team_training',
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

run('no clock times, and the timeline entry shape is pinned', () => {
  world();
  const day = visibleDays(WEEK).find((candidate) => candidate.parts.length > 0);
  assert(day, 'no day with parts to read');
  const keys = Object.keys(dayTimeline(day, null)[0]).sort();
  assert(JSON.stringify(keys) === JSON.stringify(
    ['completion', 'componentId', 'headline', 'kind', 'partId']),
    `the timeline entry carries ${JSON.stringify(keys)}. Sam's direction is ordered `
    + 'steps and no times of day; a new field — a start time above all — arrives '
    + 'through this gate or not at all.');
});

console.log(`\n  day-first timeline totals: ${passed} passed, ${failed} failed`);
if (failures.length > 0) console.log(`  failed: ${failures.join(', ')}`);
totalsPrinted(failed);
if (failed > 0) process.exit(1);
