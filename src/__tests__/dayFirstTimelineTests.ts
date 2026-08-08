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
import { visibleDayLeadHeadline } from '../rules/visibleDayDetail';
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
 * THE FIVE DOORS, AS THEY WERE BEFORE THE CHIP ROW EXISTED.
 *
 * Taken from the five bars this row replaces. Each row is what the athlete's tap
 * must still reach: the handler it calls and the coordinate the walker, the
 * explorer and the dev-e2e finder resolve it by. A chip that minted a new testID
 * from its own label would be a silent rename of five doors, and every one of
 * them is a door Sam has tapped on a device.
 */
const LIFE_FACT_DOORS: readonly { readonly label: string; readonly onPress: string; readonly testID: string }[] = [
  { label: 'Time', onPress: 'handleApplyShortOnTimeToday()', testID: 'testID="home-short-on-time-entry"' },
  { label: 'Away', onPress: 'setAwayDaysVisible(true)', testID: 'testID="home-away-this-week-entry"' },
  { label: 'Sick', onPress: 'setReadinessVisible(true)', testID: 'explorerTestId.readinessUpdate(weekReadiness.id)' },
  { label: 'Injured', onPress: 'setReadinessInjuryVisible(true)', testID: 'testID="home-injured-entry"' },
  { label: 'Equipment', onPress: 'setEquipmentVisible(true)', testID: 'explorerTestId.equipmentUpdate(activeEquipmentFact.factId)' },
];

run('the screen is in the order Sam ruled: toggle, strip, card, chips, notes', () => {
  const home = homeScreenSource();
  const at = (needle: string): number => {
    const index = home.indexOf(needle);
    assert(index >= 0, `the day-first spine no longer contains ${needle} — this gate `
      + 'is reading a screen that has been rebuilt around it and would otherwise '
      + 'compare -1 against -1 and call that an order');
    return index;
  };
  // Five landmarks, one per element Sam named, each the thing itself rather than
  // a style name: the toggle's testID, the strip component, the one call that
  // draws the day at full size, the chip row's testID, the notes component.
  const toggle = at('testID="program-view-toggle"');
  const strip = at('<WeekStrip');
  const card = at('renderDayRow(dayFirstDay, dayFirstIdx)');
  const chips = at('testID="home-life-fact-chips"');
  const notes = at('<CoachNotesSection');
  assert(toggle < strip && strip < card && card < chips && chips < notes,
    'the Program screen is no longer in the order Sam ruled on 2026-08-08 '
    + `(toggle ${toggle} → strip ${strip} → card ${card} → chips ${chips} → `
    + 'notes ${notes}). He wrote the sequence out: Today/Week, the seven-day '
    + 'strip directly under it, today\'s card, the chip row under the card, then '
    + 'Coach Notes below all of it.');
  // NOTHING BETWEEN THE TOGGLE AND THE STRIP. "Directly under it" is the half of
  // the ruling an ordering assertion alone cannot see: three cards used to queue
  // up in that gap, and re-inserting any one of them would keep this order and
  // still break what he asked for.
  const gap = home.slice(toggle, strip);
  for (const intruder of ['<CoachNotesSection', '<MissedSessionPrompt', 'home-season-phase-skew']) {
    assert(!gap.includes(intruder),
      `${intruder} is back between the Today/Week control and the week strip. `
      + 'Sam ruled the strip sits DIRECTLY under the toggle; anything that opens '
      + 'in that gap pushes the athlete\'s week below the fold again.');
  }
});

run('the chip row carries the five doors the five bars carried, unchanged', () => {
  const home = homeScreenSource();
  const rowStart = home.indexOf('testID="home-life-fact-chips"');
  assert(rowStart > 0, 'the life-fact chip row is gone from HomeScreenV2 — this gate '
    + 'is watching nothing');
  // The region that RUNS the chips, not the whole file: a chip left behind
  // somewhere else on the screen must not count as a chip in the row.
  const row = home.slice(rowStart, home.indexOf('home-schedule-ack', rowStart));
  assert(row.length > 500,
    'the chip row region could not be delimited — this gate is reading the wrong '
    + 'span and would pass on anything');
  const chips = row.match(/<LifeFactChip\b/g) ?? [];
  assert(chips.length === LIFE_FACT_DOORS.length,
    `the row renders ${chips.length} chip(s); Sam ruled FIVE — short on time, `
    + 'away, sick/flat, injured, missing equipment.');
  for (const door of LIFE_FACT_DOORS) {
    assert(row.includes(door.onPress),
      `the "${door.label}" chip no longer calls ${door.onPress}. The chip row is `
      + 'presentation: the doors behind it do not move.');
    assert(row.includes(door.testID),
      `the "${door.label}" chip no longer resolves by ${door.testID}. That is the `
      + 'coordinate the walker and the explorer reach this door by; renaming it '
      + 'silently is how a tap stops being findable while the screen still looks right.');
    assert(new RegExp(`label="${door.label}"`).test(row),
      `the "${door.label}" chip lost its label. A chip with a glyph and no word is `
      + 'the device-pass finding Sam raised: icon meanings were not obvious.');
  }
  // ONE WORD, TITLE CASE. The short-label law, and also the copy gate: the row is
  // five-across on a phone, and a chip label long enough to be prose is both
  // unreadable there and a new athlete-visible sentence nobody signed.
  const labels = [...row.matchAll(/\blabel="([^"]*)"/g)].map((match) => match[1]);
  assert(labels.length === LIFE_FACT_DOORS.length,
    `found ${labels.length} chip label(s) in the row, expected ${LIFE_FACT_DOORS.length}`);
  for (const label of labels) {
    assert(/^[A-Z][a-z]+$/.test(label),
      `chip label "${label}" is not one Title Case word. The labels ship PROPOSED `
      + 'under the copy regime and are Sam\'s to sign; a sentence smuggled in here '
      + 'is unsigned copy on the busiest row of the screen.');
  }
});

run('the five bars did not survive alongside their own chips', () => {
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
  const barIcons = body.match(/styles\.busyAwayIcon\b/g) ?? [];
  assert(barIcons.length === 1,
    `${barIcons.length} card(s) still use the old 28pt bar icon treatment; exactly `
    + 'one may — the practice-match CTA. The five life-fact bars that used it are '
    + 'the chip row now.');
  const practiceMatch = body.slice(body.indexOf('showPracticeMatchCTA'));
  assert(practiceMatch.includes('styles.busyAwayIcon'),
    'the one card allowed to keep the old bar treatment is no longer the '
    + 'practice-match CTA — something else inherited it, which is the leftover '
    + 'this cell exists to find.');
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

run('every day is titled with a BUCKET word, never a session variant name', () => {
  world();
  const vocabulary = bucketVocabulary();
  let checked = 0;
  const offenders: string[] = [];
  for (const week of WEEKS) {
    for (const day of visibleDays(week)) {
      const title = visibleDayLeadHeadline(day);
      checked += 1;
      if (!vocabulary.has(title)) offenders.push(`${day.date}="${title}"`);
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

run('POWER never titles a day — and the word did not vanish, it moved', () => {
  world();
  let powerDays = 0;
  for (const week of WEEKS) {
    for (const day of visibleDays(week)) {
      const title = visibleDayLeadHeadline(day);
      assert(title !== signedCopy('part.headline.power'),
        `${day.date} is titled "${title}". Sam, verbatim: power should not be `
        + 'labelled there for just one exercise — power is part of the Strength '
        + 'work, and "Power" never appears as a week row or a day title.');
      if (day.parts.some((part) => part.kind === 'power')) {
        powerDays += 1;
        // THE EXHIBIT, PINNED. This is the day whose card read "Power" and made
        // Sam rule: its leading part IS the power component.
        assert(day.parts[0].kind === 'power',
          `${day.date} has a power part but does not lead with it — this cell is `
          + 'no longer standing on the day the ruling was about');
        assert(title === signedCopy('part.headline.strength'),
          `${day.date} leads with a power part and is titled "${title}". A day `
          + 'whose strength work contains power exercises is a Strength day.');
        // AND THE NAME IS NOT DELETED. It moved to the timeline, which is the
        // whole shape of this ruling: one enumeration, in one place.
        const timeline = dayTimeline(day, null);
        assert(timeline.some((entry) => entry.headline === signedCopy('part.headline.power')),
          `${day.date}'s timeline no longer names its power component. The ruling `
          + 'moves the word off the title; it does not take the athlete\'s power '
          + 'work off the only screen that lists it.');
      }
    }
  }
  assert(powerDays >= 1,
    'no day in three generated weeks carries a power part — this cell proved '
    + 'nothing about the exhibit it was written for');
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
  assert(/cardLeadHeadline\(visibleDay\)/.test(home) && /visibleDayLeadHeadline/.test(home),
    'the row no longer takes its title from the projection\'s one lead-headline '
    + 'rule — which is the only thing keeping the card and the day screen from '
    + 'disagreeing about what a day is called');
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
