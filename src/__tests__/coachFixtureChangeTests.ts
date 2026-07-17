/** Typed Coach fixture intent-to-command adapter tests. */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { canonicalFixtureKind } from '../rules/fixtureConditionedAvailability';
import type { FixtureMutationTransactionResult } from '../store/fixtureMutationTransaction';
import type { FixtureChangeCommand } from '../types/fixtureMutation';
import {
  executeCoachFixtureChange,
  type AcceptedCoachFixtureSnapshot,
  type CoachFixtureChangeDependencies,
} from '../utils/coachFixtureChange';
import { parseCoachIntent, type CoachContextPacket, type FixtureChangeIntent } from '../utils/coachIntent';
import {
  beginAthleteActionTrace,
  clearAthleteActionDiagnosticEvents,
  configureAthleteActionDiagnosticsForTests,
  getAthleteActionDiagnosticEvents,
  type AthleteActionTraceContext,
} from '../utils/athleteActionDiagnostics';

const TODAY = '2026-03-23';
const SATURDAY = '2026-03-28';
const SUNDAY = '2026-03-29';
const NEXT_SATURDAY = '2026-04-04';

let passed = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

async function run(name: string, body: () => void | Promise<void>): Promise<void> {
  try {
    await body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`  FAIL ${name}`, error);
  }
}

function packet(overrides: Partial<CoachContextPacket> = {}): CoachContextPacket {
  return {
    turnId: 'turn-42',
    userMessage: 'fixture request',
    recentMessages: [],
    activeInjury: null,
    acceptedInjuryContext: { revision: 0, activeEpisodes: [] },
    activeConstraints: [],
    coachUpdate: null,
    currentWeek: [],
    nextWeek: [],
    todayISO: TODAY,
    ...overrides,
  };
}

function intent(
  payload: FixtureChangeIntent['payload'],
  clarification?: string,
): FixtureChangeIntent {
  return clarification
    ? {
        intent: 'fixture_change',
        confidence: 0.98,
        needsClarification: true,
        clarificationQuestion: clarification,
        payload: payload as Extract<FixtureChangeIntent, { needsClarification: true }>['payload'],
      }
    : {
        intent: 'fixture_change',
        confidence: 0.98,
        needsClarification: false,
        payload: payload as Extract<FixtureChangeIntent, { needsClarification: false }>['payload'],
      };
}

function trace(): AthleteActionTraceContext {
  return {
    traceId: 'trace-fixture-42',
    spanId: 'span-fixture-42',
    source: 'coach',
    actionType: 'coach_command',
    startedAt: `${TODAY}T10:00:00.000Z`,
  } as AthleteActionTraceContext;
}

function snapshot(args: {
  phase?: 'In-season' | 'Pre-season' | 'Off-season';
  fixtures?: AcceptedCoachFixtureSnapshot['fixtures'];
  revision?: number;
} = {}): AcceptedCoachFixtureSnapshot {
  const profile = { seasonPhase: args.phase ?? 'In-season' };
  return {
    expectedAcceptedRevision: args.revision ?? 41,
    profile,
    fixtureKind: canonicalFixtureKind(profile),
    fixtures: args.fixtures ?? [],
  };
}

function applied(
  command: FixtureChangeCommand & { trace: AthleteActionTraceContext },
  outcome: 'accepted' | 'repaired' | 'regenerated' | 'fallback' = 'accepted',
): FixtureMutationTransactionResult {
  return {
    outcome,
    result: { reversibleAdjustmentId: 'fixture-adjustment-proof' } as any,
    noteId: 'game-change-note-proof',
    acceptedRevision: command.expectedAcceptedRevision + 1,
    traceId: command.trace.traceId,
  };
}

function harness(args: {
  accepted?: AcceptedCoachFixtureSnapshot | null;
  transaction?: (
    command: FixtureChangeCommand & { trace: AthleteActionTraceContext },
  ) => Promise<FixtureMutationTransactionResult>;
}) {
  const commands: Array<FixtureChangeCommand & { trace: AthleteActionTraceContext }> = [];
  const dependencies: CoachFixtureChangeDependencies = {
    readAcceptedSnapshot: () => args.accepted === undefined ? snapshot() : args.accepted,
    executeTransaction: async (command) => {
      commands.push(command);
      return args.transaction ? args.transaction(command) : applied(command);
    },
  };
  return { commands, dependencies };
}

async function assertCommand(args: {
  phase: 'In-season' | 'Pre-season';
  payload: Extract<FixtureChangeIntent, { needsClarification: false }>['payload'];
  fixtures: AcceptedCoachFixtureSnapshot['fixtures'];
  expectedAction: FixtureChangeCommand['action'];
  expectedKind: FixtureChangeCommand['fixtureKind'];
}): Promise<void> {
  const h = harness({ accepted: snapshot({ phase: args.phase, fixtures: args.fixtures }) });
  const root = trace();
  const outcome = await executeCoachFixtureChange(
    intent(args.payload),
    packet(),
    root,
    h.dependencies,
  );
  assert(outcome.handled && outcome.mutated, JSON.stringify(outcome));
  assert(h.commands.length === 1, `commands=${h.commands.length}`);
  const command = h.commands[0]!;
  assert(command.action === args.expectedAction, JSON.stringify(command));
  assert(command.fixtureKind === args.expectedKind, JSON.stringify(command));
  assert(command.expectedAcceptedRevision === 41, JSON.stringify(command));
  assert(command.todayISO === TODAY, JSON.stringify(command));
  assert(command.source.requestedBy === 'athlete', JSON.stringify(command.source));
  assert(command.source.producer === 'coach', JSON.stringify(command.source));
  assert(command.source.surface === 'coach_chat', JSON.stringify(command.source));
  assert(command.source.commandId === 'coach-fixture:turn-42', JSON.stringify(command.source));
  assert(command.source.turnId === 'turn-42', JSON.stringify(command.source));
  assert(command.trace === root, 'classification TraceV2 root was not reused');
}

async function main(): Promise<void> {
  await run('1 game and practice-match add/move/remove stay typed', async () => {
    for (const phase of ['In-season', 'Pre-season'] as const) {
      const kind = phase === 'Pre-season' ? 'practice_match' : 'game';
      await assertCommand({
        phase,
        payload: { action: 'add', targetDate: SATURDAY },
        fixtures: [],
        expectedAction: 'add',
        expectedKind: kind,
      });
      await assertCommand({
        phase,
        payload: { action: 'move', sourceDate: SATURDAY, targetDate: SUNDAY },
        fixtures: [{ date: SATURDAY, kind }],
        expectedAction: 'move',
        expectedKind: kind,
      });
      await assertCommand({
        phase,
        payload: { action: 'remove', sourceDate: SATURDAY },
        fixtures: [{ date: SATURDAY, kind }],
        expectedAction: 'remove',
        expectedKind: kind,
      });
    }
  });

  await run('2 canonical phase kind ignores classifier kind except for conflict', async () => {
    assert(canonicalFixtureKind({ seasonPhase: 'Pre-season' }) === 'practice_match', 'pre-season kind');
    assert(canonicalFixtureKind({ seasonPhase: 'In-season' }) === 'game', 'in-season kind');
    assert(canonicalFixtureKind({ seasonPhase: 'Off-season' }) === 'game', 'off-season kind');
    const h = harness({ accepted: snapshot({ phase: 'Pre-season' }) });
    const result = await executeCoachFixtureChange(
      intent({ action: 'add', targetDate: SATURDAY, explicitFixtureKind: 'game' }),
      packet(),
      trace(),
      h.dependencies,
    );
    assert(result.handled && !result.mutated, JSON.stringify(result));
    assert(result.transaction?.route === 'fixture_change_kind_conflict_clarification', JSON.stringify(result));
    assert(h.commands.length === 0, 'kind conflict constructed a command');
  });

  await run('3 add never becomes move', async () => {
    const h = harness({
      accepted: snapshot({ fixtures: [{ date: SATURDAY, kind: 'game' }] }),
    });
    const result = await executeCoachFixtureChange(
      intent({ action: 'add', targetDate: SUNDAY }),
      packet(),
      trace(),
      h.dependencies,
    );
    assert(!result.mutated, JSON.stringify(result));
    assert(result.transaction?.route === 'fixture_change_rejected_add_requires_explicit_move', JSON.stringify(result));
    assert(/move it explicitly/i.test(result.reply), result.reply);
    assert(h.commands.length === 0, 'add was converted to another command');
  });

  await run('4 move resolves zero, one and multiple accepted sources', async () => {
    const zero = harness({ accepted: snapshot() });
    const zeroResult = await executeCoachFixtureChange(
      intent({ action: 'move', targetDate: SUNDAY }), packet(), trace(), zero.dependencies);
    assert(zeroResult.transaction?.route === 'fixture_change_no_change_source_missing', JSON.stringify(zeroResult));

    const one = harness({
      accepted: snapshot({ fixtures: [{ date: SATURDAY, kind: 'game' }] }),
    });
    const oneResult = await executeCoachFixtureChange(
      intent({ action: 'move', targetDate: SUNDAY }), packet(), trace(), one.dependencies);
    assert(oneResult.mutated && one.commands[0]?.action === 'move', JSON.stringify(oneResult));
    assert(one.commands[0]?.sourceDate === SATURDAY, JSON.stringify(one.commands[0]));

    const multiple = harness({
      accepted: snapshot({ fixtures: [
        { date: SATURDAY, kind: 'game' },
        { date: SUNDAY, kind: 'game' },
      ] }),
    });
    const multipleResult = await executeCoachFixtureChange(
      intent({ action: 'move', targetDate: '2026-03-27' }), packet(), trace(), multiple.dependencies);
    assert(multipleResult.transaction?.route === 'fixture_change_source_clarification', JSON.stringify(multipleResult));
    assert(multiple.commands.length === 0, 'ambiguous move constructed a command');
  });

  await run('5 remove resolves zero, one and multiple Coach-horizon sources', async () => {
    const zero = harness({ accepted: snapshot() });
    const zeroResult = await executeCoachFixtureChange(
      intent({ action: 'remove' }), packet(), trace(), zero.dependencies);
    assert(zeroResult.transaction?.route === 'fixture_change_no_change_source_missing', JSON.stringify(zeroResult));

    const one = harness({
      accepted: snapshot({ fixtures: [{ date: SATURDAY, kind: 'game' }] }),
    });
    const oneResult = await executeCoachFixtureChange(
      intent({ action: 'remove' }), packet(), trace(), one.dependencies);
    assert(oneResult.mutated && one.commands[0]?.action === 'remove', JSON.stringify(oneResult));

    const multiple = harness({
      accepted: snapshot({ fixtures: [
        { date: SATURDAY, kind: 'game' },
        { date: NEXT_SATURDAY, kind: 'game' },
      ] }),
    });
    const multipleResult = await executeCoachFixtureChange(
      intent({ action: 'remove' }), packet(), trace(), multiple.dependencies);
    assert(multipleResult.transaction?.route === 'fixture_change_source_clarification', JSON.stringify(multipleResult));
    assert(multiple.commands.length === 0, 'ambiguous remove constructed a command');
  });

  await run('6 explicit missing source, same date and cross-week move never mutate', async () => {
    const h = harness({
      accepted: snapshot({ fixtures: [{ date: SATURDAY, kind: 'game' }] }),
    });
    const missing = await executeCoachFixtureChange(
      intent({ action: 'move', sourceDate: '2026-03-27', targetDate: SUNDAY }),
      packet(), trace(), h.dependencies);
    assert(missing.transaction?.route === 'fixture_change_no_change_source_missing', JSON.stringify(missing));
    const same = await executeCoachFixtureChange(
      intent({ action: 'move', sourceDate: SATURDAY, targetDate: SATURDAY }),
      packet(), trace(), h.dependencies);
    assert(same.transaction?.route === 'fixture_change_no_change_same_date', JSON.stringify(same));
    const crossWeek = await executeCoachFixtureChange(
      intent({ action: 'move', sourceDate: SATURDAY, targetDate: NEXT_SATURDAY }),
      packet(), trace(), h.dependencies);
    assert(crossWeek.transaction?.route === 'fixture_change_cross_week_clarification', JSON.stringify(crossWeek));
    assert(h.commands.length === 0, 'invalid move reached transaction');
  });

  await run('7 strict parser rejects invalid combinations and accepts incomplete clarification', () => {
    const validIncomplete = parseCoachIntent({
      intent: 'fixture_change',
      confidence: 0.9,
      needsClarification: true,
      clarificationQuestion: 'What date?',
      payload: { action: 'add', missingFields: ['targetDate'] },
    });
    assert(validIncomplete?.intent === 'fixture_change', JSON.stringify(validIncomplete));
    const invalid = [
      { action: 'add', sourceDate: SATURDAY, targetDate: SUNDAY },
      { action: 'move', sourceDate: SATURDAY },
      { action: 'remove', sourceDate: SATURDAY, targetDate: SUNDAY },
      { action: 'add', targetDate: '2026-02-31' },
    ];
    for (const payload of invalid) {
      assert(parseCoachIntent({
        intent: 'fixture_change',
        confidence: 0.9,
        needsClarification: false,
        payload,
      }) === null, JSON.stringify(payload));
    }
  });

  await run('8 only durable acknowledged outcomes permit success copy', async () => {
    for (const durable of ['accepted', 'repaired', 'regenerated', 'fallback'] as const) {
      const h = harness({
        accepted: snapshot(),
        transaction: async (command) => applied(command, durable),
      });
      const result = await executeCoachFixtureChange(
        intent({ action: 'add', targetDate: SATURDAY }), packet(), trace(), h.dependencies);
      assert(result.mutated && /accepted plan was saved/i.test(result.reply), JSON.stringify(result));
    }
    for (const failure of ['no_change', 'conflicted', 'impossible'] as const) {
      const h = harness({
        accepted: snapshot(),
        transaction: async (command) => ({
          outcome: failure,
          reason: failure === 'impossible' ? 'persistence failed' : failure,
          error: { code: failure === 'impossible' ? 'persistence_failed' : failure },
          noteId: null,
          acceptedRevision: command.expectedAcceptedRevision,
          traceId: command.trace.traceId,
        }),
      });
      const result = await executeCoachFixtureChange(
        intent({ action: 'add', targetDate: SATURDAY }), packet(), trace(), h.dependencies);
      assert(!result.mutated, JSON.stringify(result));
      assert(/not changed or saved/i.test(result.reply), result.reply);
    }
  });

  await run('9 dependency failure and exception stay handled with zero fallback', async () => {
    const unavailable = harness({ accepted: null });
    const unavailableResult = await executeCoachFixtureChange(
      intent({ action: 'add', targetDate: SATURDAY }), packet(), trace(), unavailable.dependencies);
    assert(unavailableResult.handled && !unavailableResult.mutated, JSON.stringify(unavailableResult));
    assert(unavailableResult.transaction?.route === 'fixture_change_dependency_failure', JSON.stringify(unavailableResult));

    const throwing = harness({
      accepted: snapshot(),
      transaction: async () => { throw new Error('injected'); },
    });
    const throwingResult = await executeCoachFixtureChange(
      intent({ action: 'add', targetDate: SATURDAY }), packet(), trace(), throwing.dependencies);
    assert(throwingResult.handled && !throwingResult.mutated, JSON.stringify(throwingResult));
    assert(throwingResult.transaction?.route === 'fixture_change_exception', JSON.stringify(throwingResult));
  });

  await run('10 TraceV2 child evidence records resolved command and fallback ownership', async () => {
    configureAthleteActionDiagnosticsForTests({
      enabled: true,
      production: false,
      now: () => new Date('2026-03-23T10:00:00.000Z'),
      sink: () => undefined,
    });
    clearAthleteActionDiagnosticEvents();
    const root = beginAthleteActionTrace({
      source: 'coach',
      actionType: 'coach_command',
      route: 'coach_intent_classification',
    }, undefined, { forceRoot: true });
    const h = harness({
      accepted: snapshot({ fixtures: [{ date: SATURDAY, kind: 'game' }] }),
    });
    await executeCoachFixtureChange(
      intent({ action: 'move', targetDate: SUNDAY }),
      packet(),
      root,
      h.dependencies,
    );
    const events = getAthleteActionDiagnosticEvents(root.traceId);
    const parsed = events.find((event) => event.event === 'athlete_action_parsed' &&
      event.resolvedAction === 'move');
    assert(parsed?.resolvedSourceDate === SATURDAY, JSON.stringify(parsed));
    assert(parsed?.resolvedTargetDate === SUNDAY, JSON.stringify(parsed));
    assert(parsed?.resolvedFixtureKind === 'game', JSON.stringify(parsed));
    const verified = events.find((event) => event.event === 'transaction_verification_result' &&
      event.transactionOutcome === 'accepted');
    assert(verified?.deterministicFallbackDecision === 'forbidden:deterministic_owner',
      JSON.stringify(verified));
    configureAthleteActionDiagnosticsForTests(null);
    clearAthleteActionDiagnosticEvents();
  });
}

void main().then(() => {
  console.log(`\ncoachFixtureChangeTests: ${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) {
    console.log(`Failures:\n  - ${failures.join('\n  - ')}`);
    process.exit(1);
  }
  process.exit(0);
});
