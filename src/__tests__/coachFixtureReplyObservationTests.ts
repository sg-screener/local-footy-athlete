/** Coach fixture domain-reply registration and rendered-bubble observation. */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { readFileSync } from 'fs';
import {
  beginAthleteActionTrace,
  clearAthleteActionDiagnosticEvents,
  configureAthleteActionDiagnosticsForTests,
  getAthleteActionTraceV2,
} from '../utils/athleteActionDiagnostics';
import {
  observeCoachFixtureReply,
  registerCoachFixtureReply,
} from '../utils/coachFixtureReplyObservation';

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

async function main(): Promise<void> {
  configureAthleteActionDiagnosticsForTests({
    enabled: true,
    production: false,
    now: () => new Date('2026-03-23T10:00:00.000Z'),
    sink: () => undefined,
  });

  await run('1 domain reply is registered before rendered proof', () => {
    clearAthleteActionDiagnosticEvents();
    const trace = beginAthleteActionTrace({
      source: 'coach',
      actionType: 'coach_command',
      route: 'coach_intent_classification',
    }, undefined, { forceRoot: true });
    const observation = registerCoachFixtureReply({
      traceId: trace.traceId,
      assistantId: 'assistant-success-1',
      resultCode: 'fixture_change_applied_accepted',
      replyText: 'The game was moved and the accepted plan was saved.',
    });
    const before = getAthleteActionTraceV2(trace.traceId)?.evidence.uiObservation;
    assert(before?.status === 'captured', JSON.stringify(before));
    assert(before.value.observationId === observation.observationId, JSON.stringify(before));
    assert(before.value.controlId.status === 'captured' &&
      before.value.controlId.value === observation.controlId, JSON.stringify(before));
    assert(before.value.actualRenderedText.status === 'missing', JSON.stringify(before));
  });

  await run('2 clarification, no-change, failure and success bubbles are observed', () => {
    for (const [index, entry] of [
      ['clarification', 'Which fixture date do you mean?'],
      ['no-change', 'The accepted plan was not changed or saved.'],
      ['failure', 'The fixture change could not be saved durably.'],
      ['success', 'The accepted plan was saved.'],
    ].entries()) {
      const [kind, text] = entry;
      const trace = beginAthleteActionTrace({
        source: 'coach',
        actionType: 'coach_command',
        route: 'coach_intent_classification',
      }, undefined, { forceRoot: true });
      const assistantId = `assistant-${kind}-${index}`;
      const observation = registerCoachFixtureReply({
        traceId: trace.traceId,
        assistantId,
        resultCode: `fixture_change_${kind}`,
        replyText: text,
      });
      observeCoachFixtureReply({ observation, renderedText: text });
      const evidence = getAthleteActionTraceV2(trace.traceId)?.evidence.uiObservation;
      assert(evidence?.status === 'captured', JSON.stringify(evidence));
      assert(evidence.value.observationId === `coach-fixture-reply:${assistantId}`, JSON.stringify(evidence));
      assert(evidence.value.controlId.status === 'captured' &&
        evidence.value.controlId.value === observation.controlId, JSON.stringify(evidence));
      assert(evidence.value.actualRenderedText.status === 'captured', JSON.stringify(evidence));
      assert(evidence.value.accessibilityNode.status === 'captured', JSON.stringify(evidence));
      const node = evidence.value.accessibilityNode.value as Record<string, unknown>;
      assert(node.testID === observation.controlId, JSON.stringify(node));
      assert(node.assistantId === assistantId, JSON.stringify(node));
    }
  });

  await run('3 Coach bubble observes from a post-commit React effect with stable native identity', () => {
    const source = readFileSync(`${__dirname}/../screens/coach/CoachScreen.tsx`, 'utf8');
    assert(/function CoachConversationBubble/.test(source), 'fixture reply is not bubble-owned');
    assert(/useEffect\(\(\) => \{[\s\S]*observeCoachFixtureReply/.test(source),
      'render observation is not in a post-commit effect');
    assert(/testID=\{observation\?\.controlId\}/.test(source), 'stable testID missing');
    assert(/accessibilityLabel=\{observation \? item\.content/.test(source),
      'actual bubble accessibility label missing');
  });

  configureAthleteActionDiagnosticsForTests(null);
  clearAthleteActionDiagnosticEvents();
}

void main().then(() => {
  console.log(`\ncoachFixtureReplyObservationTests: ${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) {
    console.log(`Failures:\n  - ${failures.join('\n  - ')}`);
    process.exit(1);
  }
  process.exit(0);
});
