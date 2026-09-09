/**
 * THE WORDS ARRIVE AS THEY ARE WRITTEN, AND ARE WITHDRAWN IF THE CHECK FAILS
 * (R-399, Sam, 2026-09-10).
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { armTotalsOrRed } from './support/totalsOrRed';
import {
  createMessageExtractor,
  isCoachChatStream,
  parseCoachChatStream,
} from '../rules/coachChatStream';
import { askCoachReadOnly, coachChatFailureCode } from '../services/api/coachChat';
import type { CoachChatTransport } from '../services/api/coachChatTransport';
import { coachLabFixtureSnapshot } from '../dev/coachLab/coachLabCases';
import { COACH_CHAT_CONTRACT_VERSION } from '../rules/coachChatLimits';

armTotalsOrRed();
process.env.EXPO_PUBLIC_SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://example.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'anon-test-key';

const ROOT = resolve(__dirname, '../..');
let passed = 0;
let failed = 0;
function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failed += 1;
  console.error(`  FAIL ${name}${detail === undefined ? '' : `\n      ${JSON.stringify(detail)}`}`);
}
const read = (relative: string): string => readFileSync(resolve(ROOT, relative), 'utf8');

console.log('\n[1] THE MESSAGE IS READ OUT OF THE MODEL\'S JSON AS IT STREAMS');
{
  const extractor = createMessageExtractor();
  extractor.push('{"mess');
  extractor.push('age": "You\'re in-');
  const mid = extractor.push('season, block 2.\\n');
  ok('the first key is found across chunks and the words follow', mid === "You're in-season, block 2.\n");
  extractor.push('Keep the \\"Nordic\\" in. \\u2014 done"');
  const done = extractor.push(', "answerMode": "answer"}');
  ok('escapes and a split unicode escape decode, and the closing quote ends it',
    done === "You're in-season, block 2.\nKeep the \"Nordic\" in. — done" && extractor.complete, done);
  const tornEscape = createMessageExtractor();
  tornEscape.push('{"message":"a\\');
  ok('a chunk ending mid-escape waits for the rest', tornEscape.push('"b"') === 'a"b');
}

console.log('\n[2] THE WIRE IS ONE JSON LINE PER EVENT');
{
  const parsed = parseCoachChatStream('{"t":"open"}\n{"t":"m","text":"Hello"}\n{"t":"fin');
  ok('complete lines parse and the torn last line waits',
    parsed.lines.length === 2 && parsed.lines[1].t === 'm' && parsed.trailing === '{"t":"fin');
  ok('a stream is recognised by content type or by its first bytes',
    isCoachChatStream('application/x-ndjson; charset=utf-8', '') && isCoachChatStream(null, '{"t":"open"}\n')
      && !isCoachChatStream('application/json', '{"message":"x"}'));
}

function transportOf(lines: readonly string[], onCalls?: (soFar: string) => void): CoachChatTransport {
  return async (_url, _init, onText) => {
    let text = '';
    for (const line of lines) {
      text += `${line}\n`;
      onText(text);
      onCalls?.(text);
    }
    return { status: 200, contentType: 'application/x-ndjson', text };
  };
}
const snapshot = coachLabFixtureSnapshot();
const conversationContext = { recentTurns: [], activeProgramTarget: null } as const;

async function main(): Promise<void> {
console.log('\n[3] THE APP SHOWS THE WORDS, THEN KEEPS OR WITHDRAWS THEM');
{
  const seen: string[] = [];
  const answer = await askCoachReadOnly({
    message: 'what phase am i in',
    snapshot,
    conversationContext,
    transport: transportOf([
      '{"t":"open"}',
      '{"t":"m","text":"You’re in-season,"}',
      '{"t":"m","text":"You’re in-season, block 2 week 2."}',
      '{"t":"final","message":"You’re in-season, block 2 week 2.","programActions":[]}',
    ]),
    onDelta: (text) => seen.push(text),
  });
  ok('every update reaches the caller and the final checked answer is the value',
    seen.length === 2 && seen[1] === 'You’re in-season, block 2 week 2.' && answer === seen[1], seen);

  const withheld: string[] = [];
  let failure: string | null = null;
  try {
    await askCoachReadOnly({
      message: 'what phase am i in',
      snapshot,
      conversationContext,
      transport: transportOf([
        '{"t":"open"}',
        '{"t":"m","text":"You’re pre-season,"}',
        '{"t":"m","text":"You’re pre-season, so no Nordics."}',
        '{"t":"refused","error":"coach_chat_response_refused","violations":["phaseClaimsGrounded"]}',
      ]),
      onDelta: (text) => withheld.push(text),
    });
  } catch (error) {
    failure = coachChatFailureCode(error);
  }
  ok('words that trip a gate on the phone are never forwarded, and the refused final is a refusal',
    withheld.length === 0 && failure === 'refused', { withheld, failure });

  const shown: string[] = [];
  let later: string | null = null;
  try {
    await askCoachReadOnly({
      message: 'x',
      snapshot,
      conversationContext,
      transport: transportOf([
        '{"t":"m","text":"On the Program tab, tap Sick."}',
        '{"t":"refused","error":"coach_chat_response_refused","violations":["lfaClaimsGrounded"],"details":{"citedIds":"DOOR-sick"}}',
      ]),
      onDelta: (text) => shown.push(text),
    });
  } catch (error) {
    later = `${coachChatFailureCode(error)}: ${error instanceof Error ? error.message : ''}`;
  }
  ok('words already shown are withdrawn when the whole answer fails a receipt gate, with the reason named',
    shown.length === 1 && /^refused: .*lfaClaimsGrounded.*DOOR-sick/.test(later ?? ''), { shown, later });

  let ended: string | null = null;
  try {
    await askCoachReadOnly({ message: 'x', snapshot, conversationContext, transport: transportOf(['{"t":"open"}', '{"t":"error","error":"coach_chat_provider_failed"}']) });
  } catch (error) { ended = coachChatFailureCode(error); }
  ok('a provider failure mid-stream is unavailable, not a refusal', ended === 'unavailable');

  const plain: CoachChatTransport = async () => ({ status: 200, contentType: 'application/json', text: JSON.stringify({ message: 'Saturday is your game day.', programActions: [] }) });
  const legacy = await askCoachReadOnly({ message: 'x', snapshot, conversationContext, transport: plain });
  ok('a plain JSON answer still reads (a server one version behind)', legacy === 'Saturday is your game day.');
}

console.log('\n[4] SERVER AND PHONE SPEAK THE SAME STREAM');
{
  const edge = read('supabase/functions/coach-chat/index.ts');
  const client = read('src/services/api/coachChat.ts');
  ok('the function streams JSON lines with the shared content type and gates every forwarded update',
    /new ReadableStream/.test(edge) && /COACH_CHAT_STREAM_CONTENT_TYPE/.test(edge)
      && /createMessageExtractor\(\)/.test(edge) && /wordGatesHold\(soFar, facts\)/.test(edge)
      && /send\(\{ t: 'm', text: soFar \}\)/.test(edge));
  ok('the whole-answer contract still decides, and a refusal ends the stream typed',
    /evaluateCoachResponseContract\(payload/.test(edge) && /t: 'refused'/.test(edge) && /t: 'final'/.test(edge));
  ok('the app forwards an update only while the same word gates hold on the phone',
    /wordGatesHold\(newest\.text, facts\)/.test(client) && /parseCoachChatStream/.test(client));
  ok('the model is asked for the message first',
    /message: \{ type: 'string', minLength: 1 \}/.test(read('src/dev/coachLab/openAIResponsesClient.ts'))
      && read('src/dev/coachLab/openAIResponsesClient.ts').indexOf("message: { type: 'string'") < read('src/dev/coachLab/openAIResponsesClient.ts').indexOf('answerMode: {'));
  ok('contract version 3 names the streamed shape', COACH_CHAT_CONTRACT_VERSION === 3);
}

console.log(`\nCoach chat streaming totals: ${passed} passed, ${failed} failed`);
console.log('  NOT COVERED: a real network stream on a phone — the smoke script reports time to first word against the deployed function.');
process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
