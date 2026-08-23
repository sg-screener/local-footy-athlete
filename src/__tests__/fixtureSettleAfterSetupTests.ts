/**
 * THE CHANGED GAME DAY IS VISIBLE WITHOUT A RELAUNCH.
 *
 * Sam's ruling, 2026-08-12: option A of
 * `docs/FIXTURE_STALENESS_OWNERSHIP_REASSESSMENT_2026-08-12.md`.
 *
 * THE DEFECT. `markedDays` game entries are a PROJECTION of the profile answer
 * plus the ledger — boot proves it by DROPPING every stored game mark and
 * rebuilding them (`quiescentBoot.deriveBootFixtureMarks`, the
 * `FIXTURE_BOOT_ORDER_RULING_2026-08-06`). But `profileProgramTransaction`
 * carried `before.markedDays` forward whenever the athlete stayed In-season, so
 * the ONE door that had just changed the answer was the one door that did not
 * consult it. Measured: game day Saturday -> Wednesday committed fine and
 * reached disk, and the athlete's fixtures stayed on Saturday until the process
 * was killed and reopened.
 *
 * THE FIX is not a refresh bolted onto the door. The door SETTLES BY
 * RE-DERIVING — `settleDerivedWorldAfterDecision`, which IS `rebuildDerivedWorld`
 * under the replay latch (R5.1's switchover) and is what the injury door and the
 * undo door already call. So the week after a tap is the week after a relaunch
 * BY CONSTRUCTION rather than by two engines agreeing.
 *
 * WHY THESE FIVE CELLS. Cell 1 is the defect. Cell 2 states R5.1's property
 * directly. Cell 3 is the guard on the fix's one real risk — the settle
 * regenerates from the ANCHOR and rebases on today, while the transaction
 * generated on `input.todayISO`, so a save that touches nothing fixture-shaped
 * must not reshuffle the week. Cell 4 keeps the behaviour the deleted
 * `leavingInSeason` branch used to own. Cell 5 proves the derivation did not
 * flatten the athlete's explicit fixtures.
 *
 * Run: npm run test:fixture-settle-after-setup
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

const durable = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => durable.get(key) ?? null,
    setItem: (key: string, value: string) => { durable.set(key, value); },
    removeItem: (key: string) => { durable.delete(key); },
    clear: () => durable.clear(),
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — this suite runs entirely on-device');
};

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

import type { TrainingProgram } from '../types/domain';
import { flushPendingStorageWrites, pendingStorageWriteCount } from '../store/asyncStorageCompat';
import { generateProgramLocally } from '../services/api/generateProgram';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { useDecisionLedgerStore } from '../store/decisionLedgerStore';
import { createEmptyReversibleAdjustmentLedger } from '../rules/reversibleAdjustmentLedger';
import { seedOnboardingProgram } from '../utils/onboardingCompletion';
import { decideProfileSetupChange } from '../rules/profileSetupChange';
import { commitProfileProgramTransaction } from '../store/profileProgramTransaction';
import { rebuildDerivedWorld } from '../store/quiescentBoot';
import { samDevicePass20260805Profile } from './support/samDevicePass20260805Fixture';

const TODAY = '2026-08-12';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

function quiet<T>(body: () => T): T {
  const l = console.log; const w = console.warn; const e = console.error;
  const d = console.debug; const i = console.info;
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  console.debug = () => {}; console.info = () => {};
  try { return body(); } finally {
    console.log = l; console.warn = w; console.error = e; console.debug = d; console.info = i;
  }
}

async function quietAsync<T>(body: () => Promise<T>): Promise<T> {
  const l = console.log; const w = console.warn; const e = console.error;
  const d = console.debug; const i = console.info;
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  console.debug = () => {}; console.info = () => {};
  try { return await body(); } finally {
    console.log = l; console.warn = w; console.error = e; console.debug = d; console.info = i;
  }
}

async function run(name: string, body: () => Promise<void>): Promise<void> {
  try {
    await body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failed += 1;
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`${name}: ${message}`);
    console.log(`  FAIL ${name}`);
    console.log(`      ${message}`);
  }
}

async function settleWrites(): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await flushPendingStorageWrites().catch(() => undefined);
    if (pendingStorageWriteCount() === 0) break;
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 100));
  await flushPendingStorageWrites().catch(() => undefined);
}

/** Every date carrying a `game` mark, sorted. */
function gameDates(): string[] {
  const marks = useCalendarStore.getState().markedDays ?? {};
  return Object.entries(marks).filter(([, v]) => v === 'game').map(([d]) => d).sort();
}

function weekdaysOfGames(): string[] {
  return [...new Set(gameDates().map((d) =>
    new Date(`${d}T12:00:00`).toLocaleDateString('en-AU', { weekday: 'long' })))];
}

/** An onboarded, in-season world whose fixtures sit on `gameDay`. */
async function reachOnboardedWorld(gameDay: string): Promise<void> {
  durable.clear();
  const base = samDevicePass20260805Profile();
  const profile = { ...base, gender: 'male', seasonPhase: 'In-season', gameDay } as typeof base;

  useCalendarStore.setState({ markedDays: {}, selectedDate: null } as never);
  useReadinessStore.setState({ signalsByDate: {} } as never);
  useDecisionLedgerStore.getState().clear();
  useProgramStore.setState({
    currentProgram: null, currentMicrocycle: null, todayWorkout: null,
    isGenerating: false, isLoading: false, error: null, blockState: null,
    acceptedMaterialContext: {
      markedDays: {}, readinessSignalsByDate: {}, activeConstraints: [], activeInjury: null,
      revision: 0, lastTransaction: null, injuryEpisodes: [], temporarySourceFacts: [],
      acceptedCompositionBase: null, acceptedProfileSnapshot: null,
    },
    dateOverrides: {}, overrideContexts: {}, weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {}, sessionFeedback: {}, weightOverrides: {},
    generationAnchorISO: null,
  } as never);
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null } as never);
  useProfileStore.setState({ onboardingData: {}, isOnboardingComplete: false } as never);
  useProfileStore.getState().updateOnboardingData(profile);
  quiet(() => useProfileStore.getState().completeOnboarding());

  const program = quiet(() => generateProgramLocally(profile, {
    weekAcceptance: 'restoration', todayISO: TODAY, previousProgram: null,
  })) as TrainingProgram;
  quiet(() => seedOnboardingProgram({ onboardingData: profile, program, todayISO: TODAY }));
  // The steady state a real app boots into, so the cells start where an athlete
  // actually stands rather than mid-install.
  await quietAsync(() => rebuildDerivedWorld());
  await settleWrites();
}

/** The Profile sheet's own decision, with one field overridden. */
function setupPatchFor(overrides: {
  seasonPhase?: string; gameDay?: string | null; name?: string;
}): unknown {
  const stored = useProfileStore.getState().onboardingData as Record<string, unknown>;
  const decision = decideProfileSetupChange({
    stored,
    ownedPhase: (stored.seasonPhase ?? 'In-season') as never,
    storedPosition: stored.position as never,
    lfaDayCountNeedsSync: false,
    selection: {
      name: (overrides.name ?? stored.firstName) as never,
      position: stored.position as never,
      experience: stored.experienceLevel as never,
      twoKmSeconds: null,
      twoKmAnswer: null,
      seasonPhase: (overrides.seasonPhase ?? stored.seasonPhase) as never,
      preferredDays: (stored.preferredTrainingDays ?? []) as never,
      teamDays: (stored.teamTrainingDays ?? []) as never,
      gameDay: (overrides.gameDay === undefined
        ? stored.gameDay
        : overrides.gameDay) as never,
    } as never,
  } as never) as { patch: unknown; hasChanges: boolean; canSave: boolean };
  assert(decision.canSave, 'the setup decision refused a change this suite depends on');
  return decision.patch;
}

async function commitSetup(patch: unknown): Promise<{ ok?: boolean; reason?: string }> {
  return await quietAsync(() => commitProfileProgramTransaction({
    change: { kind: 'profile_setup', patch },
    todayISO: TODAY,
    sourceSurface: 'profile_setup',
  } as never)) as { ok?: boolean; reason?: string };
}

async function main(): Promise<void> {
  // THE STORES SETTLE BEFORE THE FIRST CELL, exactly as the app's own boot gate
  // makes them. Without this the first cell pays for the calendar store's
  // async rehydrate: its empty persisted envelope lands AFTER the seed and
  // wipes the fixtures, so cell 1 alone started with no games while every later
  // cell started correctly. A suite whose first cell measures a different world
  // than its second is measuring its own startup, not the app.
  await quietAsync(async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { awaitAppHydration } = require('../store/appHydrationGate');
    await awaitAppHydration();
  });

  // ── CELL 1: THE DEFECT ───────────────────────────────────────────────────
  await run(
    'a changed game day moves the fixtures WITHOUT a relaunch',
    async () => {
      await reachOnboardedWorld('Saturday');
      assert(
        weekdaysOfGames().join() === 'Saturday',
        `the world did not start on Saturday: ${weekdaysOfGames().join() || '(no games)'}`,
      );
      const result = await commitSetup(setupPatchFor({ gameDay: 'Wednesday' }));
      assert(result.ok, `the setup commit refused: ${String(result.reason)}`);
      assert(
        weekdaysOfGames().join() === 'Wednesday',
        'the athlete stated Wednesday, the app said it saved, and the fixtures '
        + `still fall on ${weekdaysOfGames().join() || '(none)'} until a relaunch`,
      );
    },
  );

  // ── CELL 2: R5.1's PROPERTY, STATED ──────────────────────────────────────
  await run(
    'the week after the tap IS the week after a relaunch',
    async () => {
      await reachOnboardedWorld('Saturday');
      const result = await commitSetup(setupPatchFor({ gameDay: 'Wednesday' }));
      assert(result.ok, `the setup commit refused: ${String(result.reason)}`);
      const afterTap = gameDates().join(',');
      await settleWrites();
      await quietAsync(() => rebuildDerivedWorld());
      const afterRelaunch = gameDates().join(',');
      assert(
        afterTap === afterRelaunch,
        `tap-week and relaunch-week disagree:\n      tap:      ${afterTap}\n      relaunch: ${afterRelaunch}`,
      );
    },
  );

  // ── CELL 3: THE NO-OP GUARD (the fix's one real risk) ────────────────────
  await run(
    'a save that touches nothing fixture-shaped leaves the week identical',
    async () => {
      await reachOnboardedWorld('Saturday');
      const before = gameDates().join(',');
      const beforeProgram = JSON.stringify(
        useProgramStore.getState().currentProgram?.microcycles?.map((m) => m.startDate) ?? [],
      );
      const result = await commitSetup(setupPatchFor({ name: 'Renamed' }));
      assert(result.ok, `the name-only commit refused: ${String(result.reason)}`);
      const after = gameDates().join(',');
      const afterProgram = JSON.stringify(
        useProgramStore.getState().currentProgram?.microcycles?.map((m) => m.startDate) ?? [],
      );
      assert(
        before === after,
        `a name change moved the fixtures:\n      before: ${before}\n      after:  ${after}`,
      );
      assert(
        beforeProgram === afterProgram,
        'a name change reshuffled the program weeks — the settle re-anchored '
        + 'something it had no decision for',
      );
    },
  );

  // ── CELL 4: WHAT THE DELETED BRANCH USED TO OWN ──────────────────────────
  await run(
    'leaving In-season still retires the fixtures',
    async () => {
      await reachOnboardedWorld('Saturday');
      assert(gameDates().length > 0, 'the world started with no fixtures to retire');
      const result = await commitSetup(setupPatchFor({
        seasonPhase: 'Off-season',
        gameDay: null,
      }));
      assert(result.ok, `the phase change refused: ${String(result.reason)}`);
      assert(
        gameDates().length === 0,
        `leaving In-season left ${gameDates().length} fixture(s) behind: ${gameDates().join(',')}`,
      );
    },
  );

  // ── CELL 5: A RECORDED FIXTURE DECISION IS TREATED EXACTLY AS BOOT TREATS IT
  //
  // TWO DRAFTS WERE WRONG BEFORE THIS ONE, and both are recorded because each
  // was asserting something the architecture does not promise.
  //
  // Draft 1 added the fixture with `calendarStore.setGameDay`, which the store
  // itself labels "COMPATIBILITY-ONLY FIXTURE WRITE — Live Home fixture UI must
  // use FixtureMutationTransaction". A raw mark records no DECISION, so the
  // ledger has nothing to replay and BOOT already drops it. The cell would have
  // failed this fix for HONOURING the fixture-boot-order ruling.
  //
  // Draft 2 went through the real door but asserted the added game must still
  // be there afterwards. The domain refused the add outright — "Use a move
  // action when the accepted week already contains a fixture" — and even had it
  // landed, a decision about a Saturday legitimately stops applying once the
  // recurring day is Wednesday (`quiescentBoot.replayEntry` reports and drops
  // exactly that). The cell was inventing a rule the app does not hold.
  //
  // WHAT IS ACTUALLY PROMISED, and all that is promised, is R5.1's equality:
  // whatever the ledger does with a recorded decision, the settle must do the
  // SAME THING BOOT DOES. So the cell records a real decision and then compares
  // the two engines on a world that has one. This is cell 2 on harder ground —
  // deliberately, because a ledger is where a re-derivation would diverge.
  await run(
    'with a recorded fixture decision, the settled week still equals the relaunched week',
    async () => {
      await reachOnboardedWorld('Saturday');
      const from = gameDates()[0];
      assert(from, 'the world started with no fixture to decide about');
      // The day AFTER the recurring Saturday — the Sunday that closes the same
      // Mon–Sun accepted week. A move must stay inside one accepted week in a
      // single slice ("Move the fixture within one accepted week in this
      // transaction slice"), which the first target (the following Tuesday)
      // broke by crossing the week boundary.
      const to = new Date(`${from}T12:00:00`);
      to.setDate(to.getDate() + 1);
      const toISO = `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, '0')}-${String(to.getDate()).padStart(2, '0')}`;
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { executeFixtureMutationTransaction } = require('../store/fixtureMutationTransaction');
      const moved = await quietAsync(() => executeFixtureMutationTransaction({
        action: 'move',
        fixtureKind: 'game',
        sourceDate: from,
        targetDate: toISO,
        todayISO: TODAY,
        expectedAcceptedRevision: (useProgramStore.getState() as unknown as {
          acceptedMaterialContext: { revision: number };
        }).acceptedMaterialContext.revision,
        source: {
          requestedBy: 'athlete',
          producer: 'tap',
          surface: 'program_tab',
          commandId: `fixture-settle-suite:move:${from}->${toISO}`,
        },
      })) as { outcome?: string; reason?: string };
      assert(
        gameDates().includes(toISO),
        `the fixture move was refused: outcome=${String(moved?.outcome)} `
        + `reason=${String(moved?.reason)}`,
      );

      const result = await commitSetup(setupPatchFor({ gameDay: 'Wednesday' }));
      assert(result.ok, `the setup commit refused: ${String(result.reason)}`);
      const afterTap = gameDates().join(',');
      await settleWrites();
      await quietAsync(() => rebuildDerivedWorld());
      const afterRelaunch = gameDates().join(',');
      assert(
        afterTap === afterRelaunch,
        'a world carrying a recorded fixture decision settles differently than it '
        + `boots:\n      tap:      ${afterTap}\n      relaunch: ${afterRelaunch}`,
      );
    },
  );

  console.log(`\nFixture settle-after-setup totals: ${passed} passed, ${failed} failed`);
  totalsPrinted(failures.length);
  if (failures.length > 0) {
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exitCode = 1;
  }
}

void main();
