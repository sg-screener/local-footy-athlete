/**
 * llmCoachIntentClassifierTests — verifies the production-wired
 * classifier with a mocked fetch.
 *
 * The classifier MUST:
 *   - shape the request correctly (POST + JSON body + auth header)
 *   - parse a valid CoachIntent response
 *   - reject HTTP errors safely (general_question fallback)
 *   - reject malformed JSON safely
 *   - reject schema-invalid responses safely
 *   - log at each stage
 *
 * Run: npm run test:llm-classifier
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.EXPO_PUBLIC_ENABLE_DEBUG_LOGS = 'true';

import { LLMCoachIntentClassifier } from '../utils/llmCoachIntentClassifier';
import type { CoachContextPacket, CoachIntent } from '../utils/coachIntent';

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
  const intent = await classifier.classify(makePacket());
  restoreLogs();

  eq('intent kind', intent.intent, 'active_injury_followup');
  eq('intent confidence', intent.confidence, 0.92);
  eq('intent needsClarification', intent.needsClarification, false);

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
// 2. HTTP 500 → safe fallback (general_question + confidence 0)
// ─────────────────────────────────────────────────────────────────────
section('[2] HTTP 500 → safe fallback');
{
  const fetcher = (() => Promise.resolve(makeFakeResp({ error: 'boom' }, 500))) as unknown as typeof fetch;
  captureLogs();
  const classifier = new LLMCoachIntentClassifier({
    endpoint: 'https://x.com/coach-intent',
    fetcher,
  });
  const intent = await classifier.classify(makePacket());
  restoreLogs();
  eq('fallback intent', intent.intent, 'general_question');
  eq('fallback confidence', intent.confidence, 0);
  ok('fallback rationale', intent.rationale === 'classifier_fallback');
  ok('logs http_error', loggedAny('[coach-intent] error'));
}

// ─────────────────────────────────────────────────────────────────────
// 3. Network error → safe fallback
// ─────────────────────────────────────────────────────────────────────
section('[3] Network error → safe fallback');
{
  const fetcher = (() => Promise.reject(new Error('ECONNREFUSED'))) as unknown as typeof fetch;
  captureLogs();
  const classifier = new LLMCoachIntentClassifier({
    endpoint: 'https://x.com/coach-intent',
    fetcher,
  });
  const intent = await classifier.classify(makePacket());
  restoreLogs();
  eq('fallback intent', intent.intent, 'general_question');
  ok('logs fetch_failed', loggedAny('fetch_failed'));
}

// ─────────────────────────────────────────────────────────────────────
// 4. Body is not JSON → safe fallback
// ─────────────────────────────────────────────────────────────────────
section('[4] Non-JSON response body → safe fallback');
{
  const fetcher = (() => Promise.resolve(makeBadJSONResp('not json'))) as unknown as typeof fetch;
  captureLogs();
  const classifier = new LLMCoachIntentClassifier({
    endpoint: 'https://x.com/coach-intent',
    fetcher,
  });
  const intent = await classifier.classify(makePacket());
  restoreLogs();
  eq('fallback intent', intent.intent, 'general_question');
  ok('logs json_parse_failed', loggedAny('json_parse_failed'));
}

// ─────────────────────────────────────────────────────────────────────
// 5. Body is JSON but schema-invalid → safe fallback
// ─────────────────────────────────────────────────────────────────────
section('[5] Schema-invalid response → safe fallback');
{
  // Missing intent field.
  const fetcher = (() => Promise.resolve(makeFakeResp({ confidence: 0.9 }))) as unknown as typeof fetch;
  captureLogs();
  const classifier = new LLMCoachIntentClassifier({
    endpoint: 'https://x.com/coach-intent',
    fetcher,
  });
  const intent = await classifier.classify(makePacket());
  restoreLogs();
  eq('fallback intent', intent.intent, 'general_question');
  ok('logs schema_validation_failed', loggedAny('schema_validation_failed'));
}

// ─────────────────────────────────────────────────────────────────────
// 6. Unknown intent kind → safe fallback (parseCoachIntent rejects it)
// ─────────────────────────────────────────────────────────────────────
section('[6] Unknown intent kind → safe fallback');
{
  const fetcher = (() => Promise.resolve(makeFakeResp({
    intent: 'eat_lunch', confidence: 0.99, needsClarification: false,
  }))) as unknown as typeof fetch;
  captureLogs();
  const classifier = new LLMCoachIntentClassifier({
    endpoint: 'https://x.com/coach-intent',
    fetcher,
  });
  const intent = await classifier.classify(makePacket());
  restoreLogs();
  eq('fallback intent', intent.intent, 'general_question');
}

// ─────────────────────────────────────────────────────────────────────
// 7. Each spec-defined intent kind round-trips
// ─────────────────────────────────────────────────────────────────────
section('[7] All intent kinds parse correctly');
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
    }))) as unknown as typeof fetch;
    captureLogs();
    const classifier = new LLMCoachIntentClassifier({
      endpoint: 'https://x.com/coach-intent',
      fetcher,
    });
    const intent = await classifier.classify(makePacket());
    restoreLogs();
    eq(`kind '${k}' round-trip`, intent.intent, k);
  }
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
