/**
 * LR-29 REPLAY UNIT — ITEM 1 OF THE MEASURED DEPENDENCY LIST.
 *
 * > **Does the boot replay reconstruct `authorisedReductions`?** One tape at
 * > `rebuildDerivedWorld`. **Blocks everything** — if it already does, the unit
 * > is far smaller than priced.
 * > (`docs/REPLAY_UNIT_DEPENDENCY_LIST_2026-08-07.md` §6, item 1)
 *
 * THIS IS AN INSTRUMENT, NOT A GATE. It is deliberately NOT in `test:bible`:
 * it asserts nothing and passes nothing. It prints a measurement, and the unit
 * opening rests on the number it prints.
 *
 * WHY IT IS SHAPED LIKE `quiescentBootTests` AND NOT LIKE A FIXTURE. The state
 * it needs — a week whose contract has ACCUMULATED an authorised reduction —
 * is reached by ACTING through the real program-control door, per the standing
 * ruling that hand-built state fixtures are deprecated for anything
 * athlete-facing. A seeded `authorisedReductions` array would prove that an
 * array survives a rebuild, which is not the question. The question is whether
 * the ARITHMETIC that produced it happens again.
 *
 * WHAT IT MEASURES, in three photographs of the same week:
 *
 *   BEFORE  — after generation, before any decision. The floor.
 *   ACTED   — after one real delete lands through `executeProgramControlActionDurably`.
 *   BOOTED  — after the heap dies, the disk is restored, and the boot replays.
 *
 * The answer to item 1 is whether ACTED and BOOTED agree. Everything else in
 * the output is context for reading that one comparison.
 *
 * Run: npm run tape:lr29-boot-replay
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
  throw new Error('NETWORK DISABLED');
};

import type { TrainingProgram } from '../types/domain';
import type { PlanChange } from '../utils/planChangeTypes';
import { flushPendingStorageWrites, pendingStorageWriteCount } from '../store/asyncStorageCompat';
import { generateProgramLocally } from '../services/api/generateProgram';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { useDecisionLedgerStore, decisionLedgerEntries } from '../store/decisionLedgerStore';
import { createEmptyReversibleAdjustmentLedger } from '../rules/reversibleAdjustmentLedger';
import { commitRebuiltProgram } from '../utils/weekRebuild';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import {
  executeProgramControlActionDurably,
  programControlActionForPlanChange,
} from '../utils/programControlActions';
import { seedManualOverride } from './support/programOverrideHarness';
import { runQuiescentBoot } from '../store/quiescentBoot';
import { selectStoredWeekDeclaration, microcycleCoversWeek } from '../rules/storedWeekDeclaration';
import {
  samDevicePass20260805Profile,
  SAM_PASS_20260805_TODAY_ISO,
  SAM_PASS_20260805_CURRENT_WEEK,
  SAM_PASS_20260805_ENTRY_WEEK,
  SAM_PASS_20260805_GENERATION_DAY,
  SAM_PASS_20260805_MARKED_DAYS,
} from './support/samDevicePass20260805Fixture';

const TODAY = SAM_PASS_20260805_TODAY_ISO;
const WEEK = SAM_PASS_20260805_CURRENT_WEEK;

function quiet<T>(body: () => T): T {
  const log = console.log; const warn = console.warn; const error = console.error;
  console.log = () => undefined; console.warn = () => undefined; console.error = () => undefined;
  try { return body(); } finally { console.log = log; console.warn = warn; console.error = error; }
}

async function quietAsync<T>(body: () => Promise<T>): Promise<T> {
  const log = console.log; const warn = console.warn; const error = console.error;
  console.log = () => undefined; console.warn = () => undefined; console.error = () => undefined;
  try { return await body(); } finally { console.log = log; console.warn = warn; console.error = error; }
}

async function settleWrites(): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await flushPendingStorageWrites().catch(() => undefined);
    if (pendingStorageWriteCount() === 0) break;
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 250));
  await flushPendingStorageWrites().catch(() => undefined);
}

function reachWorldByActing(): void {
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
  // THE PROFILE IS AUTHORED THROUGH ITS TWO DOORS AND NOTHING ELSE, and the
  // absence of a direct store write here is the point.
  // `profileMirrorNarrowingTests` caught the first version of this file on its
  // first full chain: the one-door law reaches TEST sources, and a direct
  // profile write must be routed through the owned door or DECLARED as debt.
  // The clear it was doing was unnecessary — this tape runs one world per
  // process and the two doors below author the whole profile. The debt is PAID
  // rather than declared, which is the cheaper of the two for a brand-new file.
  // (The literal is kept out of this note deliberately: the census scans raw
  // source, and a comment naming what it forbids is how four gates have lied.)
  useProfileStore.getState().updateOnboardingData(profile);
  quiet(() => useProfileStore.getState().completeOnboarding());
  for (const [date, mark] of Object.entries(SAM_PASS_20260805_MARKED_DAYS)) {
    if (mark === 'game') useCalendarStore.getState().setGameDay(date, SAM_PASS_20260805_GENERATION_DAY);
  }
  const program = quiet(() => generateProgramLocally(profile, {
    todayISO: SAM_PASS_20260805_GENERATION_DAY,
    previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1,
      selectedPhase: 'Pre-season',
      phaseEntryWeekStartISO: SAM_PASS_20260805_ENTRY_WEEK,
      originProvenance: 'explicit_user_phase_change',
      persistenceProvenance: 'preserved_persisted_state',
    },
  })) as TrainingProgram;
  quiet(() => commitRebuiltProgram(program, { preserve: [], clear: [], conflictsRemoved: [] }, {
    markedDays: useCalendarStore.getState().markedDays ?? {},
    selectedDate: SAM_PASS_20260805_GENERATION_DAY,
    reason: 'lr29-tape:generate',
  }));
  const his = (useProgramStore.getState().currentProgram as TrainingProgram | null)
    ?.microcycles.find((cycle) => cycle.startDate.slice(0, 10) === WEEK) ?? null;
  if (his) useProgramStore.setState({ currentMicrocycle: his } as never);
}

async function actOneDelete(): Promise<string> {
  const week = quiet(() => resolveWeekWithConditioning(WEEK, buildScheduleStateImperative()));
  const candidates = week.filter((day) => day.workout && day.date > TODAY
    && !(day.workout as { isTeamDay?: boolean }).isTeamDay);
  if (candidates.length === 0) throw new Error('TAPE ABORT: no future non-team session to delete');
  const target = candidates[candidates.length - 1]!;
  const change = { kind: 'remove_session', date: target.date, scope: 'whole_day' } as never as PlanChange;
  const action = programControlActionForPlanChange(change);
  if (!action) throw new Error('TAPE ABORT: no program control action for remove_session');
  const result = await quietAsync(() => executeProgramControlActionDurably(action, {
    visibleWeek: week, todayISO: TODAY,
    applyOverride: (date, workout, ctx) => seedManualOverride(date, workout, ctx),
  })) as { ok?: boolean };
  if (!result.ok) throw new Error('TAPE ABORT: the acted delete failed — the world is not reached');
  return target.date;
}

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

/**
 * The photograph. The unit's noun is the ACCUMULATOR, so the reduction rows
 * are printed in full rather than counted — `a count taken for a record`: two
 * rows with different metrics and two rows with the same metric are different
 * worlds, and a length says neither.
 */
function photograph(label: string): Record<string, unknown> {
  // ASKED THROUGH THE DOOR EVERY READER USES, and the first version of this
  // tape did not — it read `programStore.exposureContractsByWeek`, which was
  // empty in all three photographs and would have reported "the accumulator is
  // always zero" about a world that had one. **The declaration lives on the
  // week's OVERLAY or on the microcycle that COVERS it**, and the door owns
  // that precedence. Reading the store map directly is asking a different
  // question and getting a confident answer to it.
  const state = useProgramStore.getState() as unknown as {
    weekScopedOverlays?: Record<string, { exposureContractV2?: unknown }>;
    currentProgram?: { microcycles?: Array<{ startDate: string; exposureContractV2?: unknown }> };
    userRemovalConstraints?: unknown[];
  };
  const overlays = state.weekScopedOverlays ?? {};
  const microcycles = state.currentProgram?.microcycles ?? [];
  const weeks = [...new Set([
    ...Object.keys(overlays),
    ...microcycles.map((cycle) => cycle.startDate.slice(0, 10)),
  ])].sort();

  const rows: Record<string, unknown[]> = {};
  const sources: Record<string, string> = {};
  let total = 0;
  let declared = 0;
  for (const week of weeks) {
    const declaration = selectStoredWeekDeclaration({
      overlay: overlays[week] as never,
      coveringMicrocycle: microcycles.find((cycle) =>
        microcycleCoversWeek(cycle as never, week)) as never,
      weekStart: week,
      reader: 'lr29_tape',
    }) as { authorisedReductions?: unknown[] } | null;
    if (!declaration) { sources[week] = 'none'; continue; }
    declared += 1;
    sources[week] = (overlays[week] as { exposureContractV2?: unknown })?.exposureContractV2
      ? 'overlay' : 'covering_microcycle';
    const reductions = declaration.authorisedReductions ?? [];
    total += reductions.length;
    if (reductions.length > 0) rows[week] = reductions;
  }
  const removals = (state.userRemovalConstraints ?? []).length;
  console.log(`\n── ${label} ──`);
  console.log(`   weeks in the world           : ${weeks.length} [${weeks.join(', ')}]`);
  console.log(`   weeks the door answers for   : ${declared}`);
  console.log(`   answered from                : ${JSON.stringify(sources)}`);
  console.log(`   authorisedReductions, TOTAL  : ${total}`);
  console.log(`   weeks holding at least one   : ${Object.keys(rows).length}`);
  console.log(`   userRemovalConstraints       : ${removals}`);
  console.log(`   ledger entries               : ${decisionLedgerEntries().length}`);
  for (const [week, reductions] of Object.entries(rows)) {
    console.log(`   ${week} rows:`);
    for (const reduction of reductions) console.log(`     ${JSON.stringify(reduction)}`);
  }
  return { weeks, declared, total, rows, sources, removals, ledger: decisionLedgerEntries().length };
}

const main = async (): Promise<void> => {
  console.log('\n════ LR-29 ITEM 1 — DOES THE BOOT REPLAY RECONSTRUCT THE ACCUMULATOR? ════');
  console.log(`world: Sam's 2026-08-05 pass · generated ${SAM_PASS_20260805_GENERATION_DAY} · week ${WEEK}`);

  reachWorldByActing();
  const before = photograph('BEFORE — generated, no decision landed');

  const deleted = await actOneDelete();
  console.log(`\n   [acted] one whole-day delete landed on ${deleted}`);
  const acted = photograph('ACTED — one real delete through the program-control door');

  await relaunch();
  const booted = photograph('BOOTED — heap died, disk restored, boot replayed');

  console.log('\n════ THE ANSWER ════');
  const grew = (acted.total as number) > (before.total as number);
  console.log(`   did the ACT accumulate anything?   ${grew ? 'YES' : 'NO'} `
    + `(${before.total} → ${acted.total})`);

  // PRINTED WHETHER OR NOT THE ACT GREW THE ACCUMULATOR, because it is the
  // comparison item 1 names and it is informative either way — it just answers
  // a smaller question when the delta is zero.
  console.log(`   ACTED → BOOTED, total              : ${acted.total} → ${booted.total}`);
  console.log(`   ACTED → BOOTED, row-for-row        : ${
    JSON.stringify(booted.rows) === JSON.stringify(acted.rows) ? 'IDENTICAL' : 'DIFFERENT'}`);
  console.log(`   ACTED → BOOTED, answering rung     : ${
    JSON.stringify(booted.sources) === JSON.stringify(acted.sources) ? 'IDENTICAL' : 'DIFFERENT'}`);
  console.log(`   ACTED → BOOTED, removal constraints: ${acted.removals} → ${booted.removals}`);

  if (!grew) {
    console.log('\n   ⚠ ITEM 1 IS NOT ANSWERED BY THIS RUN, and saying so is the result.');
    console.log('     The acted world never GAINED a reduction, so "the boot reconstructed');
    console.log('     it" and "there was nothing to reconstruct" are the same reading of');
    console.log('     an identical total. What the run does establish is narrower and');
    console.log('     still worth having: every reduction present here is GENERATION-');
    console.log('     AUTHORED policy, and those survive because the boot re-generates —');
    console.log('     no ledger replay is involved in keeping them. The athlete\'s delete');
    console.log('     landed in `userRemovalConstraints`, not in the accumulator.');
    console.log('     THE PROBE IS WHAT IS WRONG. Item 1 needs a decision that authorises');
    console.log('     a reduction ON THE DECLARATION — not a whole-day delete.');
  }
  console.log('\n   NOT COVERED: ONE decision kind, ONE week, ONE world. A delete is the');
  console.log('   kind whose reduction arithmetic the kickoff names; illness, injury,');
  console.log('   readiness and phase have NO ledger vocabulary at all (§3 of the list)');
  console.log('   and are not measured here — they cannot be, until that fork is ruled.');
};

main().catch((error) => {
  console.error('\nTAPE FAILED:', error);
  process.exitCode = 1;
});
