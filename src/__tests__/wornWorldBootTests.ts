import { calendarActionsForTest } from './support/calendarActionsForTest';
/**
 * THE WORN WORLD BOOTS — the coordinate every boot suite skipped.
 *
 * Sam's ruling, 2026-08-06: **the generation anchor is a DECISION, and it has
 * ONE home** — the one written at generation, on the program. A re-derivation
 * may never INVENT a decision. Re-anchoring to today is the clock-twin of "a
 * decision never rebases from a stored week" (the fixture-identity law): both
 * are a derivation quietly authoring an input it was supposed to read.
 *
 * WHAT WENT WRONG, and it is an OWNERSHIP defect wearing a date bug's coat.
 * `rebuildDerivedWorld` read `programStore.generationAnchorISO ??
 * todayISOLocal()`. The store field DOES have a writer — but only one of the
 * two install doors:
 *
 *   - `commitRebuiltProgram` (every EDIT door) stamped it.
 *   - `programStore.setCurrentProgram` — the door ONBOARDING installs a first
 *     program through — did not. Its accepted-state payload had no
 *     `generationAnchorISO` key at all.
 *
 * So a world built by editing carried its anchor, and a world built by
 * onboarding carried null and fell into the `??`. One input, two authors, one
 * of them silent. Measured through the onboarding door on a world generated
 * 2026-06-01 and booted 2026-08-06:
 *
 *     before: 2026-06-01, 2026-06-08, 2026-06-15, 2026-06-22
 *     after:  2026-08-03, 2026-08-10, 2026-08-17, 2026-08-24
 *             the week the athlete was in: gone
 *
 * The athlete's results inputs survive; the week they belong to does not.
 *
 * WHY 138 BIBLE LINKS MISSED IT, which is the reason this suite exists rather
 * than another assertion inside `quiescentBootTests`. Two coordinates had to
 * be wrong at once, and no fixture held both. A world born TODAY has the
 * anchor agreeing with today whichever door built it — and every boot suite is
 * same-day (`quiescentBootTests` generates on 2026-08-05, boots on the real
 * today, and its weeks still overlap). Meanwhile any suite that seeds through
 * the REBUILD door gets the anchor stamped for free and cannot see the
 * onboarding door's silence — this suite passed 3/3 in exactly that shape
 * before it was pointed at the door onboarding really uses. The missing
 * coordinate is BOTH: the onboarding install door AND a generation day far
 * enough back that its week falls out of a re-anchored program. That is every
 * real athlete after their first fortnight, and no fixture.
 * (`gate-passing-on-coordinates-it-never-builds`, fifth sighting.)
 *
 * WHY THE GENERATION DAY IS A FIXED PAST DATE AND NOT AN INJECTED CLOCK. The
 * clock seam (`DevE2EClock`) is `__DEV__`-gated and this suite runs with
 * `__DEV__ = false`, like the boot suite it sits beside. A fixed past date
 * gets the same worn coordinate — world generated on day X, booted on day
 * X+n — with real time supplying the n, and it CANNOT ROT: n only grows, so
 * the world only gets more worn. The assertions are about the anchor decision
 * and its week surviving, which are stable for every n.
 *
 * Run: npm run test:worn-world-boot
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
// (commitRebuiltProgram is deliberately NOT used — see reachWornWorldByActing)
import { rebuildDerivedWorld, runQuiescentBoot } from '../store/quiescentBoot';
import { todayISOLocal } from '../utils/appDate';
import {
  samDevicePass20260805Profile,
  SAM_PASS_20260805_MARKED_DAYS,
} from './support/samDevicePass20260805Fixture';

/**
 * The day the athlete's program was generated. Fixed, and permanently in the
 * past — that is the whole point of the coordinate. The Monday of its week is
 * the week the athlete was in when they last closed the app.
 */
const GENERATION_DAY = '2026-06-01';
const GENERATION_WEEK = '2026-06-01'; // a Monday
const ENTRY_WEEK = '2026-05-25';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

function quiet<T>(body: () => T): T {
  const log = console.log; const warn = console.warn; const error = console.error;
  const debug = console.debug; const info = console.info;
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  console.debug = () => {}; console.info = () => {};
  try { return body(); } finally {
    console.log = log; console.warn = warn; console.error = error;
    console.debug = debug; console.info = info;
  }
}

async function quietAsync<T>(body: () => Promise<T>): Promise<T> {
  const log = console.log; const warn = console.warn; const error = console.error;
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  try { return await body(); } finally {
    console.log = log; console.warn = warn; console.error = error;
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

/** The world, reached by acting: onboard, then generate ON THE PAST DAY. */
function reachWornWorldByActing(): void {
  durable.clear();
  const profile = samDevicePass20260805Profile();
  useCalendarStore.setState({ markedDays: {}, selectedDate: null } as never);
  useReadinessStore.setState({ signalsByDate: {} } as never);
  useDecisionLedgerStore.getState().clear();
  useProgramStore.setState({
    currentProgram: null, currentMicrocycle: null,
    todayWorkout: null, isGenerating: false, isLoading: false, error: null, blockState: null,
    acceptedMaterialContext: {
      markedDays: {}, readinessSignalsByDate: {}, activeConstraints: [], activeInjury: null,
      revision: 0, lastTransaction: null,
      injuryEpisodes: [], temporarySourceFacts: [],
      acceptedCompositionBase: null, acceptedProfileSnapshot: null,
    },
    dateOverrides: {}, overrideContexts: {}, weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {}, sessionFeedback: {}, weightOverrides: {},
  } as never);
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null } as never);
  useProfileStore.setState({ onboardingData: {}, isOnboardingComplete: false } as never);
  useProfileStore.getState().updateOnboardingData(profile);
  quiet(() => useProfileStore.getState().completeOnboarding());
  for (const [date, mark] of Object.entries(SAM_PASS_20260805_MARKED_DAYS)) {
    if (mark === 'game') calendarActionsForTest().setGameDay(date, GENERATION_DAY);
  }
  const program = quiet(() => generateProgramLocally(profile, {
    todayISO: GENERATION_DAY,
    previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1,
      selectedPhase: 'Pre-season',
      phaseEntryWeekStartISO: ENTRY_WEEK,
      originProvenance: 'explicit_user_phase_change',
      persistenceProvenance: 'preserved_persisted_state',
    },
  })) as TrainingProgram;
  // THE DOOR ONBOARDING ACTUALLY USES. `onboardingCompletion.ts:114` installs
  // a first program with `programStore.setCurrentProgram(program, {todayISO})`
  // — NOT `commitRebuiltProgram`. The distinction is the whole defect: the
  // rebuild door stamps the generation anchor onto the store
  // (`weekRebuild.ts:739`, riding the same publication as the program it
  // anchors); the onboarding door's `commitAcceptedStateTransaction` payload
  // has no `generationAnchorISO` key at all. So a freshly onboarded athlete
  // carries the anchor on their PROGRAM and null in the store — and a suite
  // that seeds through the rebuild door cannot see it. Reaching the world by
  // acting means using the door the athlete's taps actually go through.
  quiet(() => useProgramStore.getState().setCurrentProgram(program, {
    todayISO: GENERATION_DAY,
  }));
}

/** The relaunch: the heap dies, the disk survives, boot rebuilds. */
async function relaunch(): Promise<void> {
  await settleWrites();
  const disk = new Map(durable);
  useProgramStore.setState({
    currentProgram: null, currentMicrocycle: null, todayWorkout: null,
    dateOverrides: {}, overrideContexts: {}, weekScopedOverlays: {},
    userRemovalConstraints: [], exposureContractsByWeek: {}, blockState: null,
  } as never);
  useCalendarStore.setState({ markedDays: {}, selectedDate: null } as never);
  useDecisionLedgerStore.getState().clear();
  await settleWrites();
  durable.clear();
  for (const [key, value] of disk) durable.set(key, value);
  await quietAsync(async () => {
    await useProgramStore.persist.rehydrate();
    await useCalendarStore.persist.rehydrate();
    await useProfileStore.persist.rehydrate();
    await useCoachUpdatesStore.persist.rehydrate();
    await useDecisionLedgerStore.persist.rehydrate();
  });
  await runQuiescentBoot();
  await settleWrites();
}

function programState() {
  const state = useProgramStore.getState() as unknown as {
    currentProgram: (TrainingProgram & { generationAnchorISO?: string }) | null;
    blockState: { blockNumber?: number } | null;
  };
  return {
    anchor: state.currentProgram?.generationAnchorISO ?? null,
    weeks: (state.currentProgram?.microcycles ?? []).map((cycle) => cycle.startDate.slice(0, 10)),
    phase: state.currentProgram?.seasonPhaseClock?.selectedPhase ?? null,
    entryWeek: state.currentProgram?.seasonPhaseClock?.phaseEntryWeekStartISO ?? null,
    blockNumber: state.blockState?.blockNumber ?? null,
  };
}

const main = async () => {
  console.log('\n-- The worn world boots (the anchor is a decision) --');
  console.log(`   generated ${GENERATION_DAY}, booting on ${todayISOLocal()}`);

  // ── 1. THE ANCHOR IS A DECISION, AND BOOT READS IT ──────────────────────
  await run('the generation anchor survives the boot of a worn world', async () => {
    reachWornWorldByActing();
    const before = programState();
    assert(before.anchor === GENERATION_DAY,
      `the world was not generated on the past day — anchor is ${before.anchor}`);
    await relaunch();
    const after = programState();
    assert(after.anchor === GENERATION_DAY,
      `boot RE-ANCHORED the athlete's program: ${before.anchor} → ${after.anchor}. `
      + 'The anchor is a decision with one home; a re-derivation may never invent '
      + 'one. Re-anchoring to today is the clock-twin of rebasing from a stored week.');
  });

  // ── 2. THE WEEK THE ATHLETE WAS IN SURVIVES ─────────────────────────────
  await run('the athlete\'s week is still in the program after the boot', async () => {
    reachWornWorldByActing();
    const before = programState();
    assert(before.weeks.includes(GENERATION_WEEK),
      `the generated program has no ${GENERATION_WEEK} week: ${before.weeks.join(', ')}`);
    await relaunch();
    const after = programState();
    assert(after.weeks.includes(GENERATION_WEEK),
      `the week the athlete was in is GONE after a relaunch.\n      `
      + `before: ${before.weeks.join(', ')}\n      after:  ${after.weeks.join(', ')}\n      `
      + 'Their results inputs survive; the week those results belong to does not.');
  });

  // ── 3. WHAT THE SEASON-PHASE CLOCK DID *NOT* DO ─────────────────────────
  // The honest record of why the R1 and R2 device passes read clean while the
  // anchor was moving underneath them: the phase clock IS a persisted input
  // and IS passed to generation, so phase and block held steady even as the
  // program slid forward. The masking is pinned so it can never be mistaken
  // for the anchor being fine — and so a future change that breaks the clock
  // as well is told apart from this defect.
  await run('the season-phase clock held phase and block across the boot (the masking, pinned)', async () => {
    reachWornWorldByActing();
    const before = programState();
    assert(before.phase !== null, 'the seeded world has no season phase to hold');
    await relaunch();
    const after = programState();
    assert(after.phase === before.phase,
      `the phase moved too (${before.phase} → ${after.phase}) — this is a WIDER `
      + 'failure than the anchor defect, not the same one');
    assert(after.entryWeek === before.entryWeek,
      `the phase entry week moved (${before.entryWeek} → ${after.entryWeek}) — the `
      + 'clock is an input and must survive a relaunch untouched');
    assert(after.blockNumber === before.blockNumber,
      `the block number moved (${before.blockNumber} → ${after.blockNumber}) — block `
      + 'position is taken from the phase anchor, never re-derived from a date, and '
      + 'that is the week-identity law');
  });

  // ── 4. NO ANCHOR IS NEVER TODAY — RECOVERED WHERE THE WORLD TESTIFIES,
  // ──    REFUSED WHERE IT DOES NOT ───────────────────────────────────────
  //
  // RE-AIMED 2026-08-09, after a real device could not open. This cell used to
  // assert that a world with no anchor ALWAYS refuses, and it reddened the day
  // recovery landed — correctly, because it is the gate on this exact line.
  //
  // Its law was never "always refuse". Its law is the one in its own title:
  // **do not invent today.** `?? todayISOLocal()` was not a fallback, it was
  // the only branch that ever ran, and it re-anchored worn athletes to today
  // and deleted the week they stood in. A world's OWN earliest week is not
  // today and cannot drift forward, so recovering from it breaks no part of
  // that ruling — while permanent refusal left Sam's install-over world unable
  // to open, ever, with Try Again correctly useless.
  //
  // So the cell now pins BOTH halves, and the second is the one that keeps the
  // ruling: a world that testifies to NOTHING still refuses, audibly and
  // typed, and no recovery may ever land on today.
  await run('no anchor RECOVERS from the world\'s own evidence, never from today', async () => {
    reachWornWorldByActing();
    await relaunch();
    useProgramStore.setState({ generationAnchorISO: null } as never);
    const beforeWeeks = programState().weeks.join(', ');
    await quietAsync(() => rebuildDerivedWorld());
    const afterWeeks = programState().weeks.join(', ');
    assert(afterWeeks === beforeWeeks,
      `recovery moved the athlete's weeks: ${beforeWeeks} → ${afterWeeks}. `
      + 'A recovered anchor must reproduce the world, not re-cut it.');
    // THE RULING, ASSERTED DIRECTLY: whatever was recovered, it is not today.
    const todayISO = todayISOLocal();
    assert(!afterWeeks.includes(todayISO),
      `the recovered world contains today (${todayISO}) as a week start — that is `
      + 'the re-anchoring this unit deleted');
  });

  await run('a world that testifies to NOTHING still refuses, typed and audibly', async () => {
    // The boundary of the recovery, and the half that keeps the ruling intact.
    // No program, no ledger: there is no honest anchor to read, and inventing
    // one is the forbidden move.
    reachWornWorldByActing();
    await relaunch();
    useProgramStore.setState({
      generationAnchorISO: null, currentProgram: null, currentMicrocycle: null,
    } as never);
    useDecisionLedgerStore.getState().clear();
    let refusal: Error | null = null;
    try {
      await quietAsync(() => rebuildDerivedWorld());
    } catch (error) {
      refusal = error as Error;
    }
    assert(refusal !== null,
      'a world with no evidence at all did not refuse — recovery invented an anchor');
    assert((refusal as unknown as { code?: string }).code === 'missing_generation_anchor',
      `the refusal is not typed — code was ${(refusal as unknown as { code?: string }).code}`);
  });

  console.log(`\n  Worn-world boot totals: ${passed} passed, ${failed} failed`);
  totalsPrinted(failed);
  if (failed > 0) {
    console.error(`\nFAILURES:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
};

void main();
