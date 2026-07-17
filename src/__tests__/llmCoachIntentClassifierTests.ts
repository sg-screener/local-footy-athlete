/**
 * llmCoachIntentClassifierTests — verifies the production-wired
 * classifier with a mocked fetch.
 *
 * The classifier MUST:
 *   - shape the request correctly (POST + JSON body + auth header)
 *   - parse a valid CoachIntent response
 *   - distinguish configuration, transport, HTTP, JSON, schema, and timeout failures
 *   - never rewrite service failure as general_question
 *   - log at each stage
 *
 * Run: npm run test:llm-classifier
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.EXPO_PUBLIC_ENABLE_DEBUG_LOGS = 'true';

import { LLMCoachIntentClassifier } from '../utils/llmCoachIntentClassifier';
import type { CoachContextPacket, CoachIntent } from '../utils/coachIntent';
import { readFileSync } from 'fs';

let pass = 0;
let fail = 0;
const failures: string[] = [];
function ok(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  \u2713 ${name}`); }
  else { fail++; failures.push(name); console.log(`  \u2717 ${name}${detail ? '\n      ' + detail : ''}`); }
}
function eq<T>(name: string, a: T, b: T) {
  ok(name, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function section(label: string) { console.log(`\n${label}`); }

// Capture console output so we can assert on logs.
const realLog = console.log;
const realWarn = console.warn;
let captured: string[] = [];
function captureLogs() {
  captured = [];
  console.log = (...args: any[]) => {
    captured.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    realLog.apply(console, args);
  };
  console.warn = (...args: any[]) => {
    captured.push('[WARN] ' + args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    realLog.apply(console, args);
  };
}
function restoreLogs() {
  console.log = realLog;
  console.warn = realWarn;
}
function loggedAny(needle: string): boolean {
  return captured.some((line) => line.includes(needle));
}

function makePacket(overrides: Partial<CoachContextPacket> = {}): CoachContextPacket {
  return {
    userMessage: 'still cooked',
    recentMessages: [
      { role: 'user', content: 'hammy cooked' },
      { role: 'assistant', content: 'How bad is it?' },
    ],
    activeInjury: {
      bodyPart: 'hammy',
      bucket: 'hamstring' as any,
      severity: 6,
      initialSeverity: 6,
      status: 'active',
      createdAt: '2026-04-29T10:00:00Z',
      lastUpdatedAt: '2026-04-29T10:00:00Z',
      history: [],
    },
    acceptedInjuryContext: {
      revision: 1,
      activeEpisodes: [{
        episodeId: 'hammy-episode',
        bodyPart: 'hammy',
        bucket: 'hamstring' as any,
        severity: 6,
        status: 'active',
        onsetOrReportedDate: '2026-04-29',
        updatedAt: '2026-04-29T10:00:00Z',
        seriousSymptoms: false,
      }],
    },
    coachUpdate: null,
    currentWeek: [],
    nextWeek: [],
    todayISO: '2026-04-29',
    ...overrides,
  };
}

function makeFakeResp(body: unknown, status: number = 200): Response {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  return {
    ok: status >= 200 && status < 300,
    status,
    headers,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response;
}

function makeBadJSONResp(text: string, status: number = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: async () => { throw new Error('invalid json'); },
    text: async () => text,
  } as unknown as Response;
}

// Wrap all top-level awaits in an async IIFE — sucrase-node treats
// top-level await as an ES module and fails the import.
(async () => {

// ─────────────────────────────────────────────────────────────────────
// 1. Valid response → parsed intent + correct request shape
// ─────────────────────────────────────────────────────────────────────
section('[1] Valid LLM response → parsed CoachIntent');
{
  let capturedRequest: { url: string; init?: RequestInit } | null = null;
  const validIntent: CoachIntent = {
    intent: 'active_injury_followup',
    confidence: 0.92,
    needsClarification: false,
    payload: { followupKind: 'unchanged' },
    rationale: 'Athlete confirms ongoing hammy issue without new info.',
  };
  const fetcher = ((url: any, init?: RequestInit) => {
    capturedRequest = { url: String(url), init };
    return Promise.resolve(makeFakeResp(validIntent));
  }) as unknown as typeof fetch;

  captureLogs();
  const classifier = new LLMCoachIntentClassifier({
    endpoint: 'https://x.supabase.co/functions/v1/coach-intent',
    authToken: 'anon-key-123',
    fetcher,
  });
  const result = await classifier.classify(makePacket());
  restoreLogs();

  eq('classification status', result.status, 'classified');
  const intent = result.status === 'classified' ? result.intent : null;
  eq('classification provenance', result.status === 'classified' ? result.provenance : null, 'semantic_service');
  eq('intent kind', intent?.intent, 'active_injury_followup');
  eq('intent confidence', intent?.confidence, 0.92);
  eq('intent needsClarification', intent?.needsClarification, false);

  // Request shape.
  ok('endpoint hit', capturedRequest?.url === 'https://x.supabase.co/functions/v1/coach-intent');
  eq('method = POST', (capturedRequest?.init as any)?.method, 'POST');
  const headers = (capturedRequest?.init as any)?.headers || {};
  eq('Content-Type header', headers['Content-Type'], 'application/json');
  eq('Authorization header', headers['Authorization'], 'Bearer anon-key-123');

  const body = JSON.parse(((capturedRequest?.init as any)?.body) || '{}');
  ok('body has packet (string)', typeof body.packet === 'string');
  ok('body packet contains activeInjury', /hammy/i.test(body.packet));
  eq('body has message', body.message, 'still cooked');

  // Logs.
  ok('logs [coach-intent] input', loggedAny('[coach-intent] input'));
  ok('logs [coach-intent] raw', loggedAny('[coach-intent] raw'));
  ok('logs [coach-intent] parsed', loggedAny('[coach-intent] parsed'));
}

// ─────────────────────────────────────────────────────────────────────
// 2. Missing configuration → unavailable
// ─────────────────────────────────────────────────────────────────────
section('[2] Missing configuration → unavailable');
{
  let fetchCalls = 0;
  const classifier = new LLMCoachIntentClassifier({
    endpoint: '',
    fetcher: (async () => {
      fetchCalls += 1;
      return makeFakeResp({});
    }) as unknown as typeof fetch,
  });
  const result = await classifier.classify(makePacket());
  eq('missing config status', result.status, 'unavailable');
  eq('missing config reason', result.status === 'unavailable' ? result.reason : null, 'missing_configuration');
  eq('missing config makes no fetch', fetchCalls, 0);
}

// ─────────────────────────────────────────────────────────────────────
// 3. HTTP 500 → unavailable
// ─────────────────────────────────────────────────────────────────────
section('[3] HTTP 500 → unavailable');
{
  const fetcher = (() => Promise.resolve(makeFakeResp({ error: 'boom' }, 500))) as unknown as typeof fetch;
  captureLogs();
  const classifier = new LLMCoachIntentClassifier({
    endpoint: 'https://x.com/coach-intent',
    fetcher,
  });
  const result = await classifier.classify(makePacket());
  restoreLogs();
  eq('HTTP status', result.status, 'unavailable');
  eq('HTTP reason', result.status === 'unavailable' ? result.reason : null, 'http_failure');
  ok('logs http_error', loggedAny('[coach-intent] error'));
}

// ─────────────────────────────────────────────────────────────────────
// 4. Network error → unavailable
// ─────────────────────────────────────────────────────────────────────
section('[4] Network error → unavailable');
{
  const fetcher = (() => Promise.reject(new Error('ECONNREFUSED'))) as unknown as typeof fetch;
  captureLogs();
  const classifier = new LLMCoachIntentClassifier({
    endpoint: 'https://x.com/coach-intent',
    fetcher,
  });
  const result = await classifier.classify(makePacket());
  restoreLogs();
  eq('network status', result.status, 'unavailable');
  eq('network reason', result.status === 'unavailable' ? result.reason : null, 'network_failure');
  ok('logs fetch_failed', loggedAny('fetch_failed'));
}

// ─────────────────────────────────────────────────────────────────────
// 5. Body is not JSON → unavailable
// ─────────────────────────────────────────────────────────────────────
section('[5] Non-JSON response body → unavailable');
{
  const fetcher = (() => Promise.resolve(makeBadJSONResp('not json'))) as unknown as typeof fetch;
  captureLogs();
  const classifier = new LLMCoachIntentClassifier({
    endpoint: 'https://x.com/coach-intent',
    fetcher,
  });
  const result = await classifier.classify(makePacket());
  restoreLogs();
  eq('invalid JSON status', result.status, 'unavailable');
  eq('invalid JSON reason', result.status === 'unavailable' ? result.reason : null, 'invalid_json');
  ok('logs json_parse_failed', loggedAny('json_parse_failed'));
}

// ─────────────────────────────────────────────────────────────────────
// 6. Body is JSON but schema-invalid → unavailable
// ─────────────────────────────────────────────────────────────────────
section('[6] Schema-invalid response → unavailable');
{
  // Missing intent field.
  const fetcher = (() => Promise.resolve(makeFakeResp({ confidence: 0.9 }))) as unknown as typeof fetch;
  captureLogs();
  const classifier = new LLMCoachIntentClassifier({
    endpoint: 'https://x.com/coach-intent',
    fetcher,
  });
  const result = await classifier.classify(makePacket());
  restoreLogs();
  eq('schema status', result.status, 'unavailable');
  eq('schema reason', result.status === 'unavailable' ? result.reason : null, 'schema_failure');
  ok('logs schema_validation_failed', loggedAny('schema_validation_failed'));
}

// ─────────────────────────────────────────────────────────────────────
// 7. Unknown intent kind → schema unavailable (parseCoachIntent rejects it)
// ─────────────────────────────────────────────────────────────────────
section('[7] Unknown intent kind → schema unavailable');
{
  const fetcher = (() => Promise.resolve(makeFakeResp({
    intent: 'eat_lunch', confidence: 0.99, needsClarification: false,
  }))) as unknown as typeof fetch;
  captureLogs();
  const classifier = new LLMCoachIntentClassifier({
    endpoint: 'https://x.com/coach-intent',
    fetcher,
  });
  const result = await classifier.classify(makePacket());
  restoreLogs();
  eq('unknown kind status', result.status, 'unavailable');
  eq('unknown kind reason', result.status === 'unavailable' ? result.reason : null, 'schema_failure');
}

// ─────────────────────────────────────────────────────────────────────
// 8. Timeout → unavailable
// ─────────────────────────────────────────────────────────────────────
section('[8] Timeout → unavailable');
{
  const fetcher = ((_url: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      reject(error);
    });
  })) as typeof fetch;
  const classifier = new LLMCoachIntentClassifier({
    endpoint: 'https://x.com/coach-intent',
    fetcher,
    timeoutMs: 1,
  });
  const result = await classifier.classify(makePacket());
  eq('timeout status', result.status, 'unavailable');
  eq('timeout reason', result.status === 'unavailable' ? result.reason : null, 'timeout');
}

// ─────────────────────────────────────────────────────────────────────
// 9. Each spec-defined intent kind round-trips
// ─────────────────────────────────────────────────────────────────────
section('[9] All intent kinds parse correctly');
{
  const kinds = [
    'new_injury_report',
    'injury_severity_reply',
    'active_injury_followup',
    'why_didnt_program_change',
    'program_explanation',
    'session_mismatch_question',
    'request_program_adjustment',
    'record_session_outcome',
    'fatigue',
    'missed_session',
    'exercise_swap',
    'general_question',
  ];
  for (const k of kinds) {
    const fetcher = (() => Promise.resolve(makeFakeResp({
      intent: k, confidence: 0.8, needsClarification: false,
      ...(k === 'active_injury_followup'
        ? { payload: { followupKind: 'unchanged' } }
        : {}),
    }))) as unknown as typeof fetch;
    captureLogs();
    const classifier = new LLMCoachIntentClassifier({
      endpoint: 'https://x.com/coach-intent',
      fetcher,
    });
    const result = await classifier.classify(makePacket());
    restoreLogs();
    eq(`kind '${k}' classified`, result.status, 'classified');
    eq(`kind '${k}' round-trip`, result.status === 'classified' ? result.intent.intent : null, k);
  }

  const fixtureFetcher = (() => Promise.resolve(makeFakeResp({
    intent: 'fixture_change',
    confidence: 0.95,
    needsClarification: false,
    payload: { action: 'move', sourceDate: '2026-03-28', targetDate: '2026-03-29' },
  }))) as unknown as typeof fetch;
  const fixtureResult = await new LLMCoachIntentClassifier({
    endpoint: 'https://x.com/coach-intent',
    fetcher: fixtureFetcher,
  }).classify(makePacket());
  eq('fixture_change classified', fixtureResult.status, 'classified');
  eq('fixture_change action preserved',
    fixtureResult.status === 'classified' ? fixtureResult.intent.payload?.action : null,
    'move');

  const hallucinatedKindResult = await new LLMCoachIntentClassifier({
    endpoint: 'https://x.com/coach-intent',
    fetcher: (() => Promise.resolve(makeFakeResp({
      intent: 'fixture_change',
      confidence: 0.95,
      needsClarification: false,
      payload: {
        action: 'move',
        sourceDate: '2026-03-28',
        targetDate: '2026-03-29',
        explicitFixtureKind: 'game',
      },
    }))) as unknown as typeof fetch,
  }).classify(makePacket({ userMessage: 'move the fixture to Sunday' }));
  eq('explicit fixture kind is rejected unless the athlete said it',
    hallucinatedKindResult.status, 'unavailable');

  for (const invalidPayload of [
    { action: 'add', sourceDate: '2026-03-28', targetDate: '2026-03-29' },
    { action: 'move', sourceDate: '2026-03-28' },
    { action: 'remove', sourceDate: '2026-03-28', targetDate: '2026-03-29' },
  ]) {
    const invalidResult = await new LLMCoachIntentClassifier({
      endpoint: 'https://x.com/coach-intent',
      fetcher: (() => Promise.resolve(makeFakeResp({
        intent: 'fixture_change',
        confidence: 0.95,
        needsClarification: false,
        payload: invalidPayload,
      }))) as unknown as typeof fetch,
    }).classify(makePacket());
    eq(`invalid fixture payload rejected ${JSON.stringify(invalidPayload)}`,
      invalidResult.status, 'unavailable');
  }

  const edgeSource = readFileSync('supabase/functions/coach-intent/index.ts', 'utf8');
  const appSource = readFileSync('src/utils/coachIntent.ts', 'utf8');
  const edgePrompt = edgeSource.match(/COACH_INTENT_SYSTEM_PROMPT = `([\s\S]*?)`;\n/)?.[1];
  const appPrompt = appSource.match(/COACH_INTENT_SYSTEM_PROMPT = `([\s\S]*?)`;\n/)?.[1];
  ok('app and edge classifier prompts remain byte-exact', edgePrompt === appPrompt);
  const intentSet = (source: string) => source
    .match(/const VALID_COACH_INTENTS = new Set(?:<CoachIntentKind>)?\(\[([\s\S]*?)\]\);/)?.[1]
    .match(/['"]([^'"]+)['"]/g)
    ?.map((value) => value.slice(1, -1));
  eq('app and edge allowed intent sets remain exact', intentSet(edgeSource), intentSet(appSource));
}

// ─── Summary ────
console.log(`\n— Summary —`);
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);
if (fail > 0) {
  console.log(`\n— Failures —`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
process.exit(0);

})().catch((err) => {
  console.error('test runner error:', err);
  process.exit(1);
});
