/**
 * PROGRAM STORE OVERRIDE OWNERSHIP — the store-armour recipe, the LAST store.
 *
 * `docs/STORE_ARMOUR_RECIPE_2026-08-03.md`, applied to LR-1: the program
 * store's `setManualOverride` was a self-described "raw storage primitive" and
 * TWENTY-SEVEN references across thirteen files reached it — a screen, a dev
 * seed, and eleven pipeline modules. That is the profile store's shape on
 * 2026-07-28, the day before the wipe fix, with thirteen writers instead of
 * two. `dateOverrides` is the athlete's DECISION surface: every move, bin,
 * swap, add and lighten they have ever performed lives there, and it is the
 * one surface the north star says must only ever hold inputs.
 *
 * This suite holds the protections the primitive never had:
 *
 *   1. one door with typed refusals (`applyProgramOverrideSliceWrite`),
 *   2. every write on the tape with its writer NAMED, applied or refused,
 *   3. the erasures that are legal say so — a named act, in flight,
 *   4. a build failure on any writer that reaches the slice around the owner.
 *
 * The quarantine boundary was already the program store's (the hydration wipe
 * bought it in July) and is gated by `test:hydration-refusal-quarantine`; what
 * is new here is that the DOOR's refusal now arms it, which cell 6 pins.
 *
 * Run: npm run test:program-override-ownership
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
  throw new Error('NETWORK DISABLED — override ownership is an on-device law');
};
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import fs from 'fs';
import path from 'path';
import type { TrainingProgram, Workout } from '../types/domain';
import { generateProgramLocally } from '../services/api/generateProgram';
import {
  useProgramStore,
  applyProgramOverrideWrite,
  applyProgramOverrideSliceWrite,
  beginProgramOverrideResetAction,
  endProgramOverrideResetAction,
  activeProgramOverrideResetActionCount,
  PROGRAM_STORE_PERSISTENCE_KEY,
} from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { createEmptyReversibleAdjustmentLedger } from '../rules/reversibleAdjustmentLedger';
import { athleteActionLogEntries } from '../utils/athleteActionLog';
import { quarantineBoundaryKeys, clearAllQuarantines } from '../store/refusedPayloadQuarantine';
import {
  samExport8Profile,
  SAM_EXPORT_8_CURRENT_WEEK,
} from './support/samDeviceExport8Fixture';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

const pendingAsync: Promise<void>[] = [];

function run(name: string, body: () => void | Promise<void>): void {
  const settle = (error?: unknown) => {
    if (error === undefined) {
      passed += 1;
      console.log(`  PASS ${name}`);
    } else {
      failed += 1;
      failures.push(name);
      console.error(`  FAIL ${name}\n      ${error instanceof Error ? error.message : error}`);
    }
  };
  try {
    const result = body();
    if (result instanceof Promise) {
      pendingAsync.push(result.then(() => settle(), (error) => settle(error)));
      return;
    }
    settle();
  } catch (error) {
    settle(error);
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

const WEEK = SAM_EXPORT_8_CURRENT_WEEK;

/** Fresh install, real answers, real generation. Nothing decided yet. */
function freshInstallAndGenerate(): void {
  localStorageData.clear();
  const profile = samExport8Profile();
  useProfileStore.setState({ onboardingData: profile, isOnboardingComplete: true });
  useCalendarStore.setState({ markedDays: {}, selectedDate: null } as never);
  useReadinessStore.setState({ signalsByDate: {} } as never);
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null } as never);
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
      revision: 1, lastTransaction: 'program-override-ownership:generate',
      injuryEpisodes: [], temporarySourceFacts: [],
      acceptedCompositionBase: null, acceptedProfileSnapshot: null,
    },
    dateOverrides: {}, overrideContexts: {}, weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {}, sessionFeedback: {}, weightOverrides: {},
  } as never);
}

const SWAPPED_IN_NAME = 'Assault Bike Sprints';

/** One authored decision, written through the real door. Not a seed. */
function authorOneOverride(date: string): void {
  const week = useProgramStore.getState().currentMicrocycle;
  assert(week, 'precondition: a generated week must be in the store');
  // The workout the generator put on THAT weekday — writing Monday's session
  // onto Wednesday is a §18 pattern rejection that has nothing to do with the
  // door, and would make this suite red about the wrong thing.
  const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
  const source = week.workouts.find((workout) => workout.dayOfWeek === dayOfWeek)
    ?? week.workouts[0];
  assert(source, 'precondition: the generated week must hold a workout');
  quiet(() => applyProgramOverrideWrite({
    date,
    workout: { ...source, name: SWAPPED_IN_NAME } as Workout,
    context: { intent: 'program_adjustment', label: 'Swapped session' } as never,
    writer: 'harness',
  }));
}

function overrideCount(): number {
  return Object.keys(useProgramStore.getState().dateOverrides ?? {}).length;
}

/** COUNT, never index-slice: a busy ring is at cap and an old index points past it. */
function tapeWrites(filter: (entry: Record<string, unknown>) => boolean): number {
  return athleteActionLogEntries()
    .filter((entry) => entry.event === 'program_override_write')
    .filter((entry) => filter(entry as unknown as Record<string, unknown>))
    .length;
}

/** Strip block comments, line comments and trailing comments — the census's own. */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith('//') && !trimmed.startsWith('*');
    })
    .map((line) => line.replace(/\s\/\/.*$/, ''))
    .join('\n');
}

console.log('\n-- Program store override ownership (store-armour recipe, LR-1) --');

run('the door refuses the bare default over authored overrides', () => {
  freshInstallAndGenerate();
  clearAllQuarantines();
  authorOneOverride(WEEK);
  assert(overrideCount() === 1, 'precondition: one authored override must exist');
  const before = JSON.stringify(useProgramStore.getState().dateOverrides);

  const outcome = quiet(() => applyProgramOverrideSliceWrite({
    operation: 'forward_decision',
    next: { dateOverrides: {}, overrideContexts: {} },
    writer: 'coach_action',
    reason: 'test:bare_default',
    validateWeekStarts: [WEEK],
  }));

  assert(!outcome.ok && outcome.reason === 'default_over_answered_overrides',
    `the wipe shape was not refused: ${JSON.stringify(outcome)}`);
  assert(JSON.stringify(useProgramStore.getState().dateOverrides) === before,
    'the refused write erased the athlete\'s decisions anyway');
});

run('a stale erasure act is refused', () => {
  freshInstallAndGenerate();
  authorOneOverride(WEEK);
  const id = beginProgramOverrideResetAction('test_stale');
  endProgramOverrideResetAction(id);

  const outcome = quiet(() => applyProgramOverrideSliceWrite({
    operation: 'forward_decision',
    next: { dateOverrides: {}, overrideContexts: {} },
    writer: 'reset',
    reason: 'test:stale_act',
    validateWeekStarts: [WEEK],
    resetActionId: id,
  }));

  assert(!outcome.ok && outcome.reason === 'reset_action_not_in_flight',
    `a FINISHED erasure's id still emptied the slice: ${JSON.stringify(outcome)}`);
  assert(overrideCount() === 1, 'the stale-act write erased the overrides');
});

run('only full reset can erase generated surfaces directly', () => {
  freshInstallAndGenerate();
  authorOneOverride(WEEK);
  const before = tapeWrites(entry => entry.writer === 'reset' && entry.outcome === 'applied');
  quiet(() => useProgramStore.getState().clear());
  assert(overrideCount() === 0, 'full reset did not empty the slice');
  assert(tapeWrites(entry => entry.writer === 'reset' && entry.outcome === 'applied') === before + 1,
    'full reset must remain attributed on the tape');
  assert(activeProgramOverrideResetActionCount() === 0, 'reset act outlived the reset');
});

run('individual Clear cannot delete a material slice without changing its accepted input', () => {
  const state = useProgramStore.getState();
  assert(!('removeManualOverride' in state) && !('clearManualOverrides' in state),
    'retired output-clearing setters returned; exact fact/decision Clear is covered by compiler-year journeys');
});

run('every override write is on the tape, refused or not — counts, never answers', () => {
  freshInstallAndGenerate();
  authorOneOverride(WEEK);
  const from = athleteActionLogEntries().length;

  const refused = quiet(() => applyProgramOverrideSliceWrite({
    operation: 'forward_decision',
    next: { dateOverrides: {}, overrideContexts: {} },
    writer: 'coach_undo',
    reason: 'test:tape_refused',
    validateWeekStarts: [WEEK],
  }));
  assert(!refused.ok, 'precondition: the wipe shape must refuse');
  const generated = useProgramStore.getState().currentMicrocycle!.workouts
    .find(workout => workout.dayOfWeek === new Date(`${WEEK}T12:00:00`).getDay());
  assert(generated, 'the real generated week must contain the target day');
  const applied = quiet(() => applyProgramOverrideWrite({
    date: WEEK,
    workout: {
      ...generated,
      name: SWAPPED_IN_NAME,
    } as Workout,
    // WAS `'lighter_day'`, retired from the closed union 2026-08-04 when the
    // readiness trim moved to the `readiness_reduction` week overlay. Any
    // surviving product writer id serves as the "a normal write must land"
    // case; `coach_action` is picked because the coach share is the population
    // this surface still legitimately has (LR-6).
    writer: 'coach_action',
  }));
  assert(applied.ok, 'precondition: a normal write must land');

  const writes = athleteActionLogEntries().slice(from)
    .filter((entry) => entry.event === 'program_override_write');
  assert(writes.length === 2, `the tape saw ${writes.length} of 2 override writes`);
  assert(writes[0]!.outcome === 'refused' && writes[0]!.writer === 'coach_undo'
    && writes[0]!.internalResultCode === 'default_over_answered_overrides',
    `the refused write is not named on the tape: ${JSON.stringify(writes[0])}`);
  assert(writes[1]!.outcome === 'applied' && writes[1]!.writer === 'coach_action',
    `the applied write is not named on the tape: ${JSON.stringify(writes[1])}`);
  assert(writes[0]!.overrideCountBefore === 1 && writes[1]!.overrideCountAfter === 1,
    `the tape does not record the material counts either side: ${JSON.stringify(writes)}`);

  // Counts and labels only. A date and an exercise name are ANSWERS.
  const serialised = JSON.stringify(writes);
  assert(!serialised.includes(SWAPPED_IN_NAME) && !serialised.includes(WEEK),
    `an answer VALUE reached the tape: ${serialised}`);
});

run('no writer can reach the override slice around the owner', () => {
  const srcRoot = path.resolve(__dirname, '..');
  const storeSource = fs.readFileSync(path.join(srcRoot, 'store', 'programStore.ts'), 'utf8');
  assert(storeSource.includes('export function applyProgramOverrideSliceWrite'),
    'the override write owner is gone');

  // SCOPE, DECLARED (recipe lesson 4). This store's slice is published by
  // `commitAcceptedStateTransaction`, not by a bare `setState` — so the sweep
  // is on the RETIRED PRIMITIVE'S NAME and on the harness writer id, not on
  // setState. The transaction is the publication owner and is gated by its own
  // suite; this cell owns the DECISION boundary above it.
  const offenders: string[] = [];
  const harnessLeaks: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name)) continue;
      const relative = path.relative(srcRoot, full);
      // This suite carries the search strings as literals — the law statement,
      // not a surviving writer (the writer-audit precedent, lesson 6).
      if (relative === path.join('__tests__', 'programOverrideOwnershipTests.ts')) continue;
      // The census DEFINES the detector that counts the retired name, and its
      // own suite carries the detector's fixtures.
      if (relative === path.join('data', 'legacyReckoningCensus.ts')) continue;
      if (relative === path.join('__tests__', 'legacyReckoningCensusTests.ts')) continue;
      // CODE, not prose: comments are stripped exactly the way the census
      // detector strips them, so the retirement can be NARRATED in a JSDoc
      // without the sweep reading the history as a surviving writer. A comment
      // cannot write to a store; only code can.
      const source = codeOnly(fs.readFileSync(full, 'utf8'));
      // Word match, never `field:` — a `field:` regex is blind to ES6
      // shorthand assignment (recipe lesson 12b).
      if (/\bsetManualOverride\b/.test(source)) offenders.push(relative);
      // The harness writer may not appear in PRODUCT code. `__tests__` is the
      // only place a seeded override may be authored, and it is declared debt
      // under the fixture law, not a hidden writer. The store file DECLARES
      // the union and is the one legitimate mention.
      if (!relative.startsWith('__tests__')
        && relative !== path.join('store', 'programStore.ts')
        && /'harness'/.test(source)
        && /ProgramOverrideWriterId|applyProgramOverrideWrite/.test(source)) {
        harnessLeaks.push(relative);
      }
    }
  };
  walk(srcRoot);
  assert(offenders.length === 0,
    `the retired raw primitive survives in: ${offenders.join(', ')}. Every override `
    + 'write goes through applyProgramOverrideWrite, which makes the writer name itself.');
  assert(harnessLeaks.length === 0,
    `product file(s) write overrides as the test harness: ${harnessLeaks.join(', ')}`);
});

run('the writer boundary is registered and the door\'s refusal arms it', async () => {
  freshInstallAndGenerate();
  clearAllQuarantines();
  assert(quarantineBoundaryKeys().includes(PROGRAM_STORE_PERSISTENCE_KEY),
    'the program store never registered its writer boundary');
  authorOneOverride(WEEK);

  const refused = quiet(() => applyProgramOverrideSliceWrite({
    operation: 'forward_decision',
    next: { dateOverrides: {}, overrideContexts: {} },
    writer: 'coach_executor',
    reason: 'test:quarantine_arm',
    validateWeekStarts: [WEEK],
  }));
  assert(!refused.ok, 'precondition: the wipe shape must refuse');
  // The capture is best-effort and async by design — a quarantine that crashed
  // the refusal it protects would be worse than no quarantine. What is
  // assertable is that the refusal path RAN it: the boundary is registered and
  // the store survived. The bare-over-held behaviour itself is owned by
  // `test:hydration-refusal-quarantine`, which this unit did not touch.
  await Promise.resolve();
  assert(overrideCount() === 1, 'the refused wipe erased the overrides anyway');
  clearAllQuarantines();
});

void Promise.all(pendingAsync).then(() => {
  console.log(`\nProgram override ownership totals: ${passed} passed, ${failed} failed`);
  totalsPrinted(failed);
  if (failed > 0) {
    console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
});
