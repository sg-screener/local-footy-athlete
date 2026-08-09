/**
 * LR-29 UNDO UNIT — THE BLOCKING MEASUREMENT FOR THE SHAPE SAM RULED.
 *
 * Sam, 2026-08-09: *"it should be last change i think? you can already undo
 * changes using coaches notes for older things."*
 *
 * The ruling's GROUNDS are a claim about an existing surface, and this repo has
 * a law about those: quote the line before building against it, then measure it.
 * The claim has two halves and only the first is obvious from source:
 *
 *   (1) Coach Notes really does carry an undo route — `clearReversibleAdjustment`,
 *       reached from an `ActiveCoachNote.reversibleAdjustmentId`. TRUE by
 *       inspection.
 *   (2) That route is a DURABLE undo — the athlete's unwinding is still
 *       unwound after they close the app. **NOT measured anywhere.**
 *
 * Half (2) is what this tape was built to measure. IT NOW MEASURES MORE, because
 * the first run answered it in the negative and the unit built the answer:
 * `undoLastDecision` (`store/undoLastDecision.ts`) appends the ledger's declared
 * `reversal` and re-derives, and `replayableEntries`
 * (`rules/decisionLedgerReplay.ts`) is what the boot's early return was waiting
 * for.
 *
 * SO THE TAPE RUNS BOTH ROUTES OVER ONE WORLD, BACK TO BACK — the strongest
 * available presentation, because every variable but the route is held fixed.
 *
 * FIVE PHOTOGRAPHS OF THE SAME WEEK:
 *
 *   BEFORE   — generated, no decision landed. The floor, and the target.
 *   ACTED    — after one real move lands through the program-control door.
 *   SNAPSHOT — after Coach Notes' `clearReversibleAdjustment` is asked to undo it.
 *   LEDGER   — after `undoLastDecision` annuls the decision and re-derives.
 *   BOOTED   — after the heap dies, the disk is restored, and the boot replays.
 *
 * THE PROBE ASSERTS ITS OWN PRECONDITIONS. Item 1's tape reported nothing
 * because a delete the week could absorb put nothing in the accumulator, and
 * "it worked" was indistinguishable from "there was nothing to do". So the
 * acted week must DIFFER from the floor and the ledger must hold a live
 * decision before any verdict is read — and the run says VACUOUS out loud if
 * not, rather than printing a comparison nobody can interpret.
 *
 * Run: npm run tape:lr29-undo-durability
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
import { useCoachMutationHistoryStore } from '../store/coachMutationHistoryStore';
import { useDecisionLedgerStore, decisionLedgerEntries } from '../store/decisionLedgerStore';
import { createEmptyReversibleAdjustmentLedger } from '../rules/reversibleAdjustmentLedger';
import { commitRebuiltProgram } from '../utils/weekRebuild';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import {
  executeProgramControlActionDurably,
  programControlActionForPlanChange,
} from '../utils/programControlActions';
import { clearReversibleAdjustment } from '../store/reversibleAdjustmentTransaction';
import { undoLastDecision, pendingUndoTarget } from '../store/undoLastDecision';
import { seedManualOverride } from './support/programOverrideHarness';
import { runQuiescentBoot } from '../store/quiescentBoot';
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

/**
 * The same world as the boot-replay tape, reached the same way: by ACTING
 * through the real doors. A hand-built adjustment ledger would prove that a
 * stored record survives a rebuild, which is not the question — the question is
 * whether the athlete's UNWINDING is still true tomorrow.
 */
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
  useCoachMutationHistoryStore.setState({ entries: [] } as never);
  // The profile is authored through its two doors and nothing else — the
  // one-door census reaches TEST sources, and it caught the sibling tape on its
  // first full chain. Debt paid rather than declared.
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
    reason: 'lr29-undo-tape:generate',
  }));
  const his = (useProgramStore.getState().currentProgram as TrainingProgram | null)
    ?.microcycles.find((cycle) => cycle.startDate.slice(0, 10) === WEEK) ?? null;
  if (his) useProgramStore.setState({ currentMicrocycle: his } as never);
}

/**
 * A MOVE, not a delete — chosen deliberately.
 *
 * The sibling tape's delete was absorbed by §18 relocation and put nothing in
 * the accumulator. A move is the decision Coach Notes most plainly offers to
 * restore, it lands a `plan_change` on the ledger by the same act, and its
 * effect is visible in the week's shape rather than in a policy row. The
 * question here is durability of the UNWINDING, so the loudest possible
 * material change is the right subject.
 */
async function actOneMove(): Promise<{ from: string; to: string }> {
  const week = quiet(() => resolveWeekWithConditioning(WEEK, buildScheduleStateImperative()));
  const future = week.filter((day) => day.workout && day.date > TODAY
    && !(day.workout as { isTeamDay?: boolean }).isTeamDay);
  const empty = week.filter((day) => !day.workout && day.date > TODAY);
  if (future.length === 0) throw new Error('TAPE ABORT: no future non-team session to move');
  if (empty.length === 0) throw new Error('TAPE ABORT: no empty future day to move onto');
  const from = future[future.length - 1]!.date;
  const to = empty[empty.length - 1]!.date;
  const change = { kind: 'move_session', fromDate: from, toDate: to } as never as PlanChange;
  const action = programControlActionForPlanChange(change);
  if (!action) throw new Error('TAPE ABORT: no program control action for move_session');
  const result = await quietAsync(() => executeProgramControlActionDurably(action, {
    visibleWeek: week, todayISO: TODAY,
    applyOverride: (date, workout, ctx) => seedManualOverride(date, workout, ctx),
  })) as { ok?: boolean };
  if (!result.ok) throw new Error('TAPE ABORT: the acted move failed — the world is not reached');
  return { from, to };
}

/**
 * THE UNDO THE RULING'S GROUNDS NAME, through the door Coach Notes calls.
 * Not a re-move in the opposite direction — that would be a second decision,
 * and it is not what the athlete taps.
 */
async function undoThroughCoachNotesRoute(): Promise<string> {
  const ledger = useProgramStore.getState().reversibleAdjustmentLedger;
  const adjustment = ledger.adjustments.filter((row) => row.status === 'active').at(-1);
  if (!adjustment) throw new Error('TAPE ABORT: the move landed no active reversible adjustment');
  const revision = useProgramStore.getState().acceptedMaterialContext.revision;
  const result = await quietAsync(() =>
    clearReversibleAdjustment(adjustment.id, revision)) as {
      outcome?: string; reason?: string;
    };
  console.log(`\n   [undo] adjustment kind : ${adjustment.kind}`);
  console.log(`   [undo] adjustment id   : ${adjustment.id}`);
  console.log(`   [undo] expectedRevision: ${revision}`);
  console.log(`   [undo] OUTCOME         : ${result.outcome}`);
  // THE REASON IS THE RESULT WHEN THE OUTCOME IS A REFUSAL. The sibling tape's
  // whole finding was that a refusal can be a CONDITION rather than a gap, and
  // the condition is never in the outcome word — it is in the reason line.
  if (result.reason) console.log(`   [undo] REASON          : ${result.reason}`);
  if (result.outcome !== 'restored') {
    console.log('   ⚠ the restore did not report `restored` — the reading below is about');
    console.log('     THAT outcome, not about a successful undo.');
  }
  return adjustment.id;
}

/**
 * THE LEDGER ROUTE — the door this unit built, driven end to end.
 *
 * Asserts its own precondition before acting: if nothing is undoable the run is
 * vacuous and says so, rather than reporting a comparison nobody can read.
 */
async function undoThroughLedgerRoute(): Promise<string> {
  const target = pendingUndoTarget();
  if (!target) throw new Error('TAPE ABORT: nothing undoable — the probe is vacuous');
  console.log(`\n   [ledger-undo] target : ${target.id} (${target.decision.kind})`);
  const result = await quietAsync(() => undoLastDecision());
  console.log(`   [ledger-undo] OUTCOME: ${result.outcome}`);
  if (result.outcome === 'refused') console.log(`   [ledger-undo] REASON : ${result.reason}`);
  return result.outcome;
}

async function relaunch(): Promise<void> {
  await settleWrites();
  const disk = new Map(durable);
  useProgramStore.setState({
    currentProgram: null, currentMicrocycle: null, todayWorkout: null,
    dateOverrides: {}, overrideContexts: {}, weekScopedOverlays: {},
    userRemovalConstraints: [], exposureContractsByWeek: {}, blockState: null,
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
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
  await quietAsync(() => runQuiescentBoot());
  await settleWrites();
}

/**
 * The photograph. The unit's noun is THE WEEK THE ATHLETE SEES, so the week is
 * printed as a per-date shape rather than counted — `a count taken for a
 * record`: a week with a session on Tuesday and a week with the same session on
 * Thursday have the same length, and a length says nothing about the only thing
 * an undo changes.
 */
function photograph(label: string): Record<string, unknown> {
  const week = quiet(() => resolveWeekWithConditioning(WEEK, buildScheduleStateImperative()));
  const shape = week
    .map((day) => `${day.date}:${day.workout
      ? (day.workout as { name?: string }).name ?? 'session'
      : '—'}`)
    .sort()
    .join(' | ');
  const state = useProgramStore.getState() as unknown as {
    reversibleAdjustmentLedger?: { adjustments?: Array<{ id: string; status: string; kind: string }> };
    dateOverrides?: Record<string, unknown>;
  };
  const adjustments = state.reversibleAdjustmentLedger?.adjustments ?? [];
  const byStatus: Record<string, number> = {};
  for (const row of adjustments) byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
  // THE CALENDAR MARKS ARE PHOTOGRAPHED TOO, because a decision's effect may
  // not live entirely on the ledger — and if it does not, an undo that annuls
  // the ledger half cannot be complete. Measured rather than assumed.
  const marks = useCalendarStore.getState().markedDays ?? {};
  const markLine = Object.entries(marks)
    .filter(([date]) => date >= WEEK && date <= '2026-08-09')
    .map(([date, mark]) => `${date}:${String(mark)}`).sort().join(' ') || '(none in week)';
  const entries = decisionLedgerEntries();
  const kinds = entries.map((entry) => entry.decision.kind);

  console.log(`\n── ${label} ──`);
  console.log(`   week shape                   : ${shape}`);
  console.log(`   dateOverrides                : ${Object.keys(state.dateOverrides ?? {}).length}`);
  console.log(`   reversible adjustments       : ${adjustments.length} ${JSON.stringify(byStatus)}`);
  console.log(`   calendar marks, this week    : ${markLine}`);
  console.log(`   ledger entries               : ${entries.length} [${kinds.join(', ')}]`);
  console.log(`   ledger holds a reversal?     : ${kinds.includes('reversal') ? 'YES' : 'NO'}`);
  return { shape, adjustments: adjustments.length, byStatus, kinds, markLine };
}

const main = async (): Promise<void> => {
  console.log('\n════ LR-29 UNDO — IS THE EXISTING UNDO DURABLE? ════');
  console.log(`world: Sam's 2026-08-05 pass · generated ${SAM_PASS_20260805_GENERATION_DAY} · week ${WEEK}`);
  console.log('the claim under test: "you can already undo changes using coaches notes"');

  reachWorldByActing();
  const before = photograph('BEFORE — generated, no decision landed');

  // THE CONTROL, RUN FIRST AND ON AN EMPTY LEDGER.
  //
  // Every verdict below compares a re-derived week against BEFORE, and that
  // comparison is only about UNDO if a re-derivation with NOTHING to undo
  // reproduces BEFORE. A boot whose own regeneration diverges would make a
  // perfect undo look broken — the misattribution this repo has paid for
  // before ("a control red belongs to the instrument only if removing it
  // helps"). So: relaunch with an empty ledger, and photograph.
  await relaunch();
  const bootClean = photograph('BOOT-CLEAN — relaunched with an EMPTY ledger (control)');
  const bootIsFaithful = bootClean.shape === before.shape;
  console.log(`\n   [control] does a boot with NO decisions reproduce the generated week? `
    + `${bootIsFaithful ? 'YES' : 'NO'}`);
  if (!bootIsFaithful) {
    console.log('   ⚠ NO — so the boot\'s own regeneration diverges from generation, and');
    console.log('     NO comparison against BEFORE below can be attributed to undo.');
    console.log('     The undo verdict is re-aimed at BOOT-CLEAN, which is the week a');
    console.log('     faithful undo should actually produce.');
  }

  const moved = await actOneMove();
  console.log(`\n   [acted] one move landed: ${moved.from} → ${moved.to}`);
  const acted = photograph('ACTED — one real move through the program-control door');

  // THE LEDGER ROUTE RUNS FIRST, AND THE ORDER IS LOAD-BEARING.
  //
  // The first version of this sequence asked the SNAPSHOT route first. It
  // succeeded, put the week back, and the ledger undo then ran against a week
  // that was already restored — so "the ledger route restored the week" was
  // TRUE and VACUOUS in the same breath, which is precisely the reading item
  // 1's tape refused to publish. Each route now gets a world it actually has
  // to change.
  const undoOutcome = await undoThroughLedgerRoute();
  const undone = photograph('LEDGER ROUTE — undoLastDecision: annul + re-derive');

  await relaunch();
  const booted = photograph('BOOTED — heap died, disk restored, boot replayed');

  // THE SNAPSHOT ROUTE, RE-MEASURED ON A POST-BOOT WORLD — and this exists to
  // CORRECT the fifty-second pass rather than to confirm it. That pass measured
  // this route refusing with `maximum_breach`, in a freshly generated and
  // committed world. A boot clears that violation, and an athlete's app is a
  // booted world every time they open it. So the refusal is re-asked where it
  // actually matters, on its own act.
  const second = await actOneMove();
  console.log(`\n   [acted #2] ${second.from} → ${second.to}`);
  const acted2 = photograph('ACTED #2 — a fresh move on the booted world');
  await undoThroughCoachNotesRoute();
  const restored = photograph('SNAPSHOT ROUTE — clearReversibleAdjustment, post-boot');

  console.log('\n════ THE ANSWER ════');
  const actedMoved = acted.shape !== before.shape;
  // AIMED AT THE CONTROL, not at BEFORE — see the control block above. When the
  // boot is faithful these are the same target and nothing changes.
  const target = bootIsFaithful ? before.shape : bootClean.shape;
  const ledgerWorked = undone.shape === target;
  // The snapshot route is judged against the week IT was asked to unwind.
  const snapshotWorked = restored.shape === booted.shape && acted2.shape !== booted.shape;
  const survived = booted.shape === undone.shape;
  const returned = booted.shape === acted.shape;

  // THE PRECONDITION IS ASSERTED BEFORE ANY VERDICT IS READ. Item 1's tape
  // reported nothing because its probe was too easy and a vacuous comparison
  // read as agreement; this one says so at the top instead of at the bottom.
  console.log(`   PROBE — did the ACT change the week? ${actedMoved ? 'YES' : 'NO — VACUOUS'}`);
  console.log('');
  console.log(`   compared against                    : `
    + `${bootIsFaithful ? 'BEFORE (boot is faithful)' : 'BOOT-CLEAN (boot diverges)'}`);
  console.log(`   SNAPSHOT route restored the week?   ${snapshotWorked ? 'YES' : 'NO'}`);
  console.log(`   LEDGER route restored the week?     ${ledgerWorked ? 'YES' : 'NO'} `
    + `(${undoOutcome})`);
  console.log('');
  console.log(`   ── DURABILITY, the question item (b) asked ──`);
  console.log(`   UNDONE → BOOTED                     : ${survived ? 'IDENTICAL' : 'DIFFERENT'}`);
  console.log(`   did the change come BACK on boot?   : ${returned ? 'YES' : 'NO'}`);
  console.log(`   ledger after boot                   : `
    + `${(booted.kinds as string[]).join(', ')}`);

  if (actedMoved && ledgerWorked && survived && !returned) {
    console.log('\n   ✓✓ THE UNDO IS DURABLE, AND IT IS THE LEDGER ROUTE THAT CARRIES IT.');
    console.log('      The athlete unwound the change, the app died, the boot replayed a');
    console.log('      ledger that still HOLDS the original decision — and the week came');
    console.log('      back undone, because the reversal annuls it in the replay set.');
    console.log('      No snapshot was restored and no new stored state was written.');
    if (!snapshotWorked) {
      console.log('      **On the same world, in the same run, the snapshot route REFUSED.**');
    }
  }

  if (!actedMoved) {
    console.log('\n   ⚠ THIS RUN ANSWERS NOTHING, and saying so is the result.');
    console.log('     The acted week is identical to the floor, so "the undo worked" and');
    console.log('     "there was nothing to undo" are the same reading — the same vacuous');
    console.log('     comparison the boot-replay tape refused to report as a finding.');
  } else if (!ledgerWorked) {
    console.log('\n   ✗ THE LEDGER ROUTE DID NOT RESTORE THE WEEK. Durability is not the');
    console.log('     question this run answers; the undo itself is. Read the LEDGER');
    console.log(`     photograph, not the BOOTED one. Outcome was: ${undoOutcome}`);
  } else if (returned) {
    console.log('\n   ✗ THE UNDO DIED AT THE APP BOUNDARY. The week came back on boot, so');
    console.log('     the replay is not honouring the reversal the door appended.');
    console.log('     `replayableEntries` (rules/decisionLedgerReplay.ts) is the filter');
    console.log('     that should have dropped it — read the ledger line above first.');
  } else if (!survived) {
    console.log('\n   ? THE BOOTED WEEK MATCHES NEITHER THE UNDONE NOR THE ACTED WEEK.');
    console.log('     A third world. Read the shapes above before concluding anything.');
  }

  console.log('\n   NOT COVERED: one decision kind, one week, one world, depth 1. No device');
  console.log('   evidence. This tape asserts nothing — only the printed lines are the');
  console.log('   result, and a green exit code means the process ran, not that undo works.');
  console.log('');
};

void main().catch((error) => {
  console.error('\nTAPE ABORTED', error);
  process.exitCode = 1;
});
