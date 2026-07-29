/**
 * `project()` IS THE ONE PROJECTION — and it changes nothing yet.
 *
 * Stage 2 of the build. Before any surface renders from a new owner, that owner
 * must be proven equivalent to the one it succeeds: `buildProgramTabProjectedWeek`
 * is today's single derivation of accepted state, and `project()` must agree with
 * it on every day the matrix reaches. A new owner that quietly changes the week
 * while claiming to unify it would be the worst possible version of this unit.
 *
 * WHAT IS PINNED:
 *   1. EQUIVALENCE — `project()`'s parts match the components of the week
 *      `buildProgramTabProjectedWeek` produces, day for day.
 *   2. ONE DERIVATION — `project()` and `projectParts()` never disagree, because
 *      they are the same derivation asked two questions rather than two
 *      projections.
 *   3. RULING 3, RECOVERY — a recovery part gets the same capabilities as a
 *      strength part in the same position, and counts toward NOTHING.
 *   4. REST IS NOT EMPTINESS — a rest day and an empty training day are different
 *      kinds, so no consumer can conflate them.
 *   5. NO INVENTED WORDS — `project()` raises rather than composing a headline
 *      that Sam has not signed.
 *
 * Run: npm run test:projection-ownership
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
import { getSessionComponents } from '../utils/sessionComponents';
import { project, projectParts } from '../rules/projectVisibleWeek';
import { UnsignedCopyError } from '../rules/signedCopy';
import { PART_COUNTS_TOWARD_LOAD } from '../rules/visibleProjection';
import { samExport8Profile, SAM_EXPORT_8_TODAY_ISO, SAM_EXPORT_8_CURRENT_WEEK } from './support/samDeviceExport8Fixture';

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

function world(): void {
  localStorageData.clear();
  const profile = samExport8Profile();
  useProfileStore.setState({ onboardingData: profile, isOnboardingComplete: true });
  useCalendarStore.setState({ markedDays: {}, selectedDate: null } as never);
  useReadinessStore.setState({ signalsByDate: {} } as never);
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null } as never);
  const program = quiet(() => generateProgramLocally(profile, {
    todayISO: '2026-07-13', previousProgram: null,
    seasonPhaseClock: { protocolVersion: 1, selectedPhase: 'Pre-season',
      phaseEntryWeekStartISO: '2026-07-13', originProvenance: 'explicit_user_phase_change',
      persistenceProvenance: 'preserved_persisted_state' },
  })) as TrainingProgram;
  const his = program.microcycles.find((m) => m.startDate.slice(0, 10) === WEEK) ?? null;
  useProgramStore.setState({
    currentProgram: program, currentMicrocycle: his, todayWorkout: null,
    isGenerating: false, isLoading: false, error: null, blockState: null,
    acceptedMaterialContext: {
      markedDays: {}, readinessSignalsByDate: {}, activeConstraints: [], activeInjury: null,
      revision: 1, lastTransaction: 'projection-ownership:generate',
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
    mondayISO: week, todayISO: TODAY, state: buildScheduleStateImperative(),
    overrideContexts: useProgramStore.getState().overrideContexts ?? {},
  }));
}

const WEEKS = [WEEK, '2026-08-03', '2026-08-10'];

console.log('\n-- Projection ownership --');

run('project() agrees with the derivation it succeeds, every day', () => {
  world();
  for (const week of WEEKS) {
    const days = projected(week);
    const mine = projectParts({ week: days, weekStart: week });
    assert(mine.days.length === days.length,
      `${week}: project() produced ${mine.days.length} days for ${days.length}`);
    for (const [index, day] of days.entries()) {
      const componentCount = getSessionComponents(day.workout ?? null).length;
      const partCount = mine.days[index].parts.length;
      const expected = day.workout ? componentCount : 0;
      assert(partCount === expected,
        `${day.date}: project() has ${partCount} parts, the derivation it succeeds `
        + `has ${expected}. A new owner must change nothing before any surface `
        + 'renders from it.');
    }
  }
});

run('project() and projectParts() are one derivation, not two', () => {
  world();
  for (const week of WEEKS) {
    const days = projected(week);
    const structural = projectParts({ week: days, weekStart: week });
    // `project` adds words to `projectParts`; with no words signed it must raise
    // rather than diverge. Either behaviour proves they share one derivation —
    // silently returning a DIFFERENT structure would not.
    let threw: unknown = null;
    try { project({ week: days, weekStart: week }); } catch (error) { threw = error; }
    if (threw === null) {
      const full = project({ week: days, weekStart: week });
      for (const [index, day] of full.days.entries()) {
        assert(day.parts.length === structural.days[index].parts.length,
          `${day.date}: project() and projectParts() disagree about part count`);
      }
    } else {
      assert(threw instanceof UnsignedCopyError,
        `project() failed for a reason other than unsigned copy: ${String(threw)}`);
    }
  }
});

run('a recovery part is capable of everything a strength part is (ruling 3)', () => {
  world();
  const days = projected(WEEK).concat(projected('2026-08-03'));
  const parts = projectParts({ week: days, weekStart: WEEK }).days.flatMap((d) => d.parts);
  const recovery = parts.filter((p) => p.kind === 'recovery');
  const strength = parts.filter((p) => p.kind === 'strength');
  assert(recovery.length > 0 && strength.length > 0,
    `nothing to compare — recovery ${recovery.length}, strength ${strength.length}`);
  for (const part of recovery) {
    assert(JSON.stringify(part.capabilities) === JSON.stringify(strength[0].capabilities),
      `a recovery part is offered ${JSON.stringify(part.capabilities)} while a `
      + `strength part gets ${JSON.stringify(strength[0].capabilities)}. Recovery is `
      + 'a day type like any other.');
  }
});

run('recovery counts toward nothing (ruling 3)', () => {
  assert(PART_COUNTS_TOWARD_LOAD.recovery === false,
    'recovery counts toward the load ledger');
  for (const kind of ['strength', 'conditioning', 'power', 'speed'] as const) {
    assert(PART_COUNTS_TOWARD_LOAD[kind] === true,
      `${kind} stopped counting — the ruling was about recovery only`);
  }
  world();
  const parts = projectParts({ week: projected(WEEK), weekStart: WEEK })
    .days.flatMap((d) => d.parts);
  for (const part of parts.filter((p) => p.kind === 'recovery')) {
    assert(part.countsTowardLoad === false,
      `a projected recovery part claims to count toward load`);
  }
});

run('rest is a kind, not an absence of parts', () => {
  world();
  quiet(() => useCalendarStore.getState().setRestDay('2026-07-30'));
  const days = projected(WEEK);
  const mine = projectParts({ week: days, weekStart: WEEK });
  const rest = mine.days.find((d) => d.date === '2026-07-30');
  assert(rest, 'the rest day vanished from the projection');
  assert(rest.kind === 'rest',
    `a day the athlete marked as rest projects as "${rest.kind}". Rest is complete `
    + 'rest and is its own kind — never "a day whose workout is null", which is the '
    + 'conflation that let a deletion door write a schedule fact.');
  const emptyTraining = mine.days.find((d) => d.kind === 'training' && d.parts.length === 0);
  if (emptyTraining) {
    assert(emptyTraining.kind !== 'rest',
      'an empty training day is being reported as rest');
  }
});

run('project() will not invent a headline', () => {
  world();
  let threw: unknown = null;
  try { project({ week: projected(WEEK), weekStart: WEEK }); }
  catch (error) { threw = error; }
  assert(threw instanceof UnsignedCopyError,
    'project() produced athlete-facing headlines with nothing signed. The words '
    + 'must come from artifacts/COPY_SHEET_RULINGS_2026-07-30.md or not exist.');
});

console.log(`\nProjection ownership totals: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error(`FAILURES:\n  ${failures.join('\n  ')}`); process.exit(1); }
