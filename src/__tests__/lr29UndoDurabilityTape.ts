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
 * Half (2) is what this tape measures, and it is the one that decides the
 * unit's size. `types/decisionLedger.ts:38` declares `reversal` and
 * `quiescentBoot.ts:122` refuses to replay it — *"No reversal producer exists
 * yet … a reversal entry is declared, typed, and inert until then."* So the
 * decision ledger has no record that an undo happened, while the boot replays
 * the ORIGINAL decision from that same ledger. If the restore is material-only,
 * the boot puts the change back.
 *
 * `athleteSessionMoveTests` cell 21 pins the ABSENCE of a reversal entry and
 * says in its own comment that an undo *"does not survive a relaunch"* — but a
 * comment is output, never evidence. No cell relaunches. This one does.
 *
 * THIS IS AN INSTRUMENT, NOT A GATE. Deliberately NOT in `test:bible`: it
 * asserts nothing and passes nothing. It prints a measurement, and the undo
 * unit's shape rests on the number it prints.
 *
 * FOUR PHOTOGRAPHS OF THE SAME WEEK:
 *
 *   BEFORE   — generated, no decision landed. The floor, and the target.
 *   ACTED    — after one real move lands through the program-control door.
 *   RESTORED — after Coach Notes' own undo route clears that adjustment.
 *   BOOTED   — after the heap dies, the disk is restored, and the boot replays.
 *
 * The answer is which of ACTED / RESTORED the BOOTED week equals. RESTORED
 * means the existing undo is durable and Sam's grounds hold as stated. ACTED
 * means the undo is a display that dies at the app boundary — the same class as
 * the journal's reminder, on the other side of the wall.
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
 * THE CONTROL, and it is what makes the refusal above readable.
 *
 * A refusal on its own has two readings: *this world refuses this material
 * change* or *this world refuses RESTORATIONS*. They are indistinguishable from
 * one refusal, and the sibling tape's whole lesson was that an unreadable
 * comparison must not be reported as a finding.
 *
 * So the same unwinding is expressed the other way — as a forward
 * `move_session` back to where it came from, through the door the athlete used
 * to move it in the first place. Same world, same week, same two dates, same
 * material end state. Only the ROUTE differs. If this lands while the restore
 * refused, the variable is isolated to the route.
 */
async function controlMoveBack(from: string, to: string): Promise<boolean> {
  const week = quiet(() => resolveWeekWithConditioning(WEEK, buildScheduleStateImperative()));
  const change = { kind: 'move_session', fromDate: to, toDate: from } as never as PlanChange;
  const action = programControlActionForPlanChange(change);
  if (!action) throw new Error('TAPE ABORT: no program control action for the control move');
  const result = await quietAsync(() => executeProgramControlActionDurably(action, {
    visibleWeek: week, todayISO: TODAY,
    applyOverride: (date, workout, ctx) => seedManualOverride(date, workout, ctx),
  })) as { ok?: boolean; outcome?: string; reason?: string };
  console.log(`\n   [control] forward move BACK ${to} → ${from} : `
    + `${result.ok ? 'LANDED' : `REFUSED (${result.outcome ?? ''} ${result.reason ?? ''})`}`);
  return result.ok === true;
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
  const entries = decisionLedgerEntries();
  const kinds = entries.map((entry) => entry.decision.kind);

  console.log(`\n── ${label} ──`);
  console.log(`   week shape                   : ${shape}`);
  console.log(`   dateOverrides                : ${Object.keys(state.dateOverrides ?? {}).length}`);
  console.log(`   reversible adjustments       : ${adjustments.length} ${JSON.stringify(byStatus)}`);
  console.log(`   ledger entries               : ${entries.length} [${kinds.join(', ')}]`);
  console.log(`   ledger holds a reversal?     : ${kinds.includes('reversal') ? 'YES' : 'NO'}`);
  return { shape, adjustments: adjustments.length, byStatus, kinds };
}

const main = async (): Promise<void> => {
  console.log('\n════ LR-29 UNDO — IS THE EXISTING UNDO DURABLE? ════');
  console.log(`world: Sam's 2026-08-05 pass · generated ${SAM_PASS_20260805_GENERATION_DAY} · week ${WEEK}`);
  console.log('the claim under test: "you can already undo changes using coaches notes"');

  reachWorldByActing();
  const before = photograph('BEFORE — generated, no decision landed');

  const moved = await actOneMove();
  console.log(`\n   [acted] one move landed: ${moved.from} → ${moved.to}`);
  const acted = photograph('ACTED — one real move through the program-control door');

  await undoThroughCoachNotesRoute();
  const restored = photograph('RESTORED — Coach Notes\' own undo route cleared it');

  const controlLanded = await controlMoveBack(moved.from, moved.to);
  const control = photograph('CONTROL — the same unwinding, as a FORWARD decision');

  await relaunch();
  const booted = photograph('BOOTED — heap died, disk restored, boot replayed');

  console.log('\n════ THE ANSWER ════');
  const actedMoved = acted.shape !== before.shape;
  const undoWorked = restored.shape === before.shape;
  const survived = booted.shape === restored.shape;
  const returned = booted.shape === acted.shape;

  console.log(`   did the ACT change the week?       ${actedMoved ? 'YES' : 'NO'}`);
  console.log(`   did the UNDO restore the week?     ${undoWorked ? 'YES' : 'NO'}`);
  console.log(`   RESTORED → BOOTED                  : ${survived ? 'IDENTICAL' : 'DIFFERENT'}`);
  console.log(`   BOOTED equals the ACTED week?      : ${returned ? 'YES' : 'NO'}`);

  if (!actedMoved) {
    console.log('\n   ⚠ THIS RUN ANSWERS NOTHING, and saying so is the result.');
    console.log('     The acted week is identical to the floor, so "the undo worked" and');
    console.log('     "there was nothing to undo" are the same reading — the same vacuous');
    console.log('     comparison the boot-replay tape refused to report as a finding.');
  } else if (!undoWorked) {
    console.log('\n   ⚠ THE UNDO DID NOT RESTORE THE WEEK IN THE FIRST PLACE.');
    console.log('     Durability is not the question this run answers; the restore itself');
    console.log('     is. Read the RESTORED photograph, not the BOOTED one.');
    if (controlLanded && control.shape === before.shape) {
      console.log('\n   ✗✗ AND THE CONTROL ISOLATES THE VARIABLE TO THE ROUTE.');
      console.log('      The SAME unwinding, expressed as a forward decision, LANDED and');
      console.log('      reproduced the pre-move week exactly. So this world does not');
      console.log('      refuse the material change — it refuses the RESTORATION.');
      console.log('      `acceptedStateTransaction.ts:509` is why, and it says so out loud:');
      console.log('      accept-and-reduce is FORWARD ONLY; `operation === \'restoration\'`');
      console.log('      throws on a blocking violation instead of reducing.');
      console.log('      **Undo-by-snapshot is held to a stricter standard than the act it');
      console.log('      reverses. Undo-by-annul-and-re-derive is not — it re-derives');
      console.log('      forward, so it takes the forward path by construction.**');
    } else if (!controlLanded) {
      console.log('\n   … and the CONTROL was refused too, so the variable is NOT isolated:');
      console.log('     this world may refuse the material change by either route. The');
      console.log('     restoration finding above is UNPROVEN by this run.');
    }
  } else if (survived && !returned) {
    console.log('\n   ✓ THE EXISTING UNDO IS DURABLE. Sam\'s grounds hold exactly as stated:');
    console.log('     Coach Notes already carries a real, surviving undo for older changes,');
    console.log('     and UNDO LAST CHANGE is a shortcut to a mechanism that works.');
  } else if (returned) {
    console.log('\n   ✗ THE UNDO DIED AT THE APP BOUNDARY. The athlete unwound the change,');
    console.log('     closed the app, and the boot replayed the original decision from a');
    console.log('     ledger that has no record the undo ever happened.');
    console.log('     `reversal` is declared at types/decisionLedger.ts:38 and refused at');
    console.log('     quiescentBoot.ts:122 — typed, and inert. THAT is the undo unit\'s');
    console.log('     first build, and it is upstream of any button.');
  } else {
    console.log('\n   ? THE BOOTED WEEK MATCHES NEITHER PHOTOGRAPH. A third world — read the');
    console.log('     shapes above before concluding anything about undo.');
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
