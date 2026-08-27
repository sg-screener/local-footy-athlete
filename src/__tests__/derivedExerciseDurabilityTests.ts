/* Real onboarding and generated warm-up -> durable edit -> restart / failed save. */
(global as { __DEV__?: boolean }).__DEV__ = true;
process.env.TZ = 'Australia/Melbourne';
const storage = new Map<string, string>();
let failLedgerWrite = false;
let failFixtureAppend = false;
let rejectedWrites = 0;
(globalThis as unknown as { window: unknown }).window = { localStorage: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    if (key === 'decision-ledger-store' && (failLedgerWrite ||
      failFixtureAppend && /"kind":"fixture_(?:add|move|remove)"/.test(value))) {
      failLedgerWrite = false;
      failFixtureAppend = false;
      rejectedWrites++;
      throw new Error('injected derived-edit persistence failure');
    }
    storage.set(key, value);
  },
  removeItem: (key: string) => { storage.delete(key); }, clear: () => storage.clear(),
} };
import { coldStartThroughOnboarding, quiet, quietAsync, relaunchApp } from './support/athleteJourney';
import { ARCHETYPES, athleteAnswers, YEAR_START } from './compilerYear/catalog';
import { selectMobilityPrehabFlow } from '../utils/mobilityPrehabFlow';
import { applyMobilityFlowExerciseDecisions } from '../utils/derivedExerciseDecisions';
import { liveAthleteContext } from '../utils/liveAthleteContext';
import { deriveVisibleWeekLive } from '../utils/deriveVisibleWeek';
import { executeProgramControlActionDurably } from '../utils/programControlActions';
import { decisionLedgerEntries, DECISION_LEDGER_PERSISTENCE_KEY } from '../store/decisionLedgerStore';
import { flushPendingStorageWrites } from '../store/asyncStorageCompat';
import { undoLastDecision } from '../store/undoLastDecision';
import type { ProgramControlAction } from '../types/programControlAction';
import { executeFixtureMutationTransaction } from '../store/fixtureMutationTransaction';
import { useProgramStore } from '../store/programStore';
import { visibleSignature } from './compilerYear/invariants';

let passed = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = '') {
  if (ok) passed++; else failures.push(label);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${ok ? '' : ` ${detail}`}`);
}
async function main() {
  check('fault injector targets actual ledger key', DECISION_LEDGER_PERSISTENCE_KEY === 'decision-ledger-store');
  const profile = athleteAnswers(ARCHETYPES[2]);
  await quietAsync(() => coldStartThroughOnboarding({ profile, installDayISO: YEAR_START }));
  const base = () => {
    const days = quiet(() => deriveVisibleWeekLive(YEAR_START, YEAR_START));
    const day = days.find(day => day.workout?.strengthIntent);
    if (!day) throw new Error('generated strength day missing');
    return { date: day.date, flow: selectMobilityPrehabFlow({ workout: day.workout,
      date: day.date, seasonPhase: profile.seasonPhase, isGameWeek: false,
      athlete: liveAthleteContext(), performedMovementIds: [] }) };
  };
  const projected = () => {
    const {date, flow} = base();
    return applyMobilityFlowExerciseDecisions({ date, flow, entries: decisionLedgerEntries() });
  };
  const original = JSON.stringify(projected());
  const {date, flow} = base();
  check('witness reaches a real generated warm-up', !!flow?.movements.length);
  if (!flow?.movements.length) throw new Error('no generated flow');
  const movement = flow.movements[0].exercise;
  const action: ProgramControlAction = { type: 'remove_exercise',
    source: { screen: 'session_detail', surface: 'quick_exercise_action', initiatedBy: 'tap' },
    scope: 'today_only', requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true,
    payload: { date, exercise: movement.name, exerciseId: `mobility:${movement.id}`,
      derivedSource: { kind: 'mobility_flow', id: `mobility:${movement.id}` } } };
  const accepted = await quietAsync(() => executeProgramControlActionDurably(action, { todayISO: YEAR_START }));
  check('generated warm-up removal accepted', accepted.ok, accepted.message);
  const changed = JSON.stringify(projected());
  check('only selected warm-up row removed', projected()?.movements.length === flow.movements.length - 1);
  check('acknowledgement has already persisted the ledger',
    JSON.parse(storage.get(DECISION_LEDGER_PERSISTENCE_KEY) ?? '{}').state?.entries?.length === decisionLedgerEntries().length);
  const restart = await quietAsync(() => relaunchApp({ storage, todayISO: YEAR_START }));
  check('warm-up edit survives restart', restart.ok && JSON.stringify(projected()) === changed, restart.error);
  const undo = await quietAsync(() => undoLastDecision());
  check('Undo restores exact generated warm-up', undo.outcome === 'undone' && JSON.stringify(projected()) === original);
  await flushPendingStorageWrites();
  const ledgerBefore = JSON.stringify(decisionLedgerEntries());
  failLedgerWrite = true;
  const rejected = await quietAsync(() => executeProgramControlActionDurably(action, { todayISO: YEAR_START }));
  await flushPendingStorageWrites().catch(() => undefined);
  check('failure witness actually rejects one durable write', rejectedWrites === 1);
  check('failed derived-row save cannot claim success', !rejected.ok);
  check('failed derived-row save restores ledger and visible warm-up',
    JSON.stringify(decisionLedgerEntries()) === ledgerBefore && JSON.stringify(projected()) === original);
  const afterFailure = await quietAsync(() => relaunchApp({ storage, todayISO: YEAR_START }));
  check('failed save remains undone after restart', afterFailure.ok && JSON.stringify(projected()) === original, afterFailure.error);
  for (const kind of ['add', 'move', 'remove'] as const) {
    const profile = athleteAnswers(ARCHETYPES[3]);
    await quietAsync(() => coldStartThroughOnboarding({ profile, installDayISO: YEAR_START }));
    const read = () => quiet(() => deriveVisibleWeekLive(YEAR_START, YEAR_START));
    const before = visibleSignature(read());
    const fixtureDate = read().find(day => day.workout?.workoutType === 'Game')?.date;
    check(`${kind} fixture failure starts from a real fixture week`, !!fixtureDate);
    if (!fixtureDate) throw new Error('no fixture');
    const input = { action: kind, fixtureKind: 'game' as const,
      sourceDate: kind === 'add' ? undefined : fixtureDate,
      targetDate: kind === 'remove' ? undefined : '2026-07-15',
      expectedAcceptedRevision: useProgramStore.getState().acceptedMaterialContext.revision,
      source: { requestedBy: 'athlete' as const, producer: 'tap' as const, surface: 'program_tab' as const,
        commandId: `fixture-durable:${kind}` }, todayISO: YEAR_START };
    const beforeLedger = JSON.stringify(decisionLedgerEntries());
    const beforeRejections = rejectedWrites;
    failFixtureAppend = true;
    const refused = await quietAsync(() => executeFixtureMutationTransaction(input));
    await flushPendingStorageWrites().catch(() => undefined);
    check(`${kind} fault targets the new accepted fixture decision`, rejectedWrites === beforeRejections + 1);
    check(`${kind} fixture cannot acknowledge an unpersisted decision`, refused.outcome !== 'accepted');
    check(`${kind} fixture failure restores ledger and visible week`,
      JSON.stringify(decisionLedgerEntries()) === beforeLedger && visibleSignature(read()) === before);
    const cold = await quietAsync(() => relaunchApp({ storage, todayISO: YEAR_START }));
    check(`${kind} failed fixture remains absent after restart`, cold.ok && visibleSignature(read()) === before, cold.error);
  }
  console.log(`Derived exercise durability: ${passed} passed; ${failures.length} failures`);
  if (failures.length) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
