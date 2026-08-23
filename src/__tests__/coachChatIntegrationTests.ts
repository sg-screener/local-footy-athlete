(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import fs from 'fs';
import path from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import { CANONICAL_COACH_KNOWLEDGE } from '../../supabase/functions/coach-chat/canonicalCoachKnowledge.generated';
import { COACH_KNOWLEDGE_SOURCE_SPECS } from '../rules/coachKnowledgeManifest';
import { askCoachReadOnly } from '../services/api/coachChat';
import { coachLabFixtureSnapshot } from '../dev/coachLab/coachLabCases';

armTotalsOrRed();

const ROOT = path.resolve(__dirname, '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

let passed = 0;
let failed = 0;
function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL ${name}${detail === undefined ? '' : `\n      ${String(detail)}`}`);
}

console.log('\n[1] THE LIVE ENDPOINT OWNS THE BRAIN AND THE MODEL');
{
  const edge = read('supabase/functions/coach-chat/index.ts');
  ok('the production Coach endpoint exists', edge.length > 2000, edge.length);
  ok('Terra is fixed on the server and cannot come from the request',
    /gpt-5\.6-terra/.test(edge)
      && !/body\.model\b/.test(edge)
      && !/body\.instructions\b/.test(edge));
  ok('the server builds retrieval and instructions from canonical knowledge',
    /retrieveCoachLabKnowledge/.test(edge)
      && /buildRetrievedCoachLabBrainInstructions/.test(edge)
      && /CANONICAL_COACH_KNOWLEDGE/.test(edge));
  ok('the live endpoint is separately kill-switched and returns no provider detail',
    /COACH_CHAT_ENABLED/.test(edge)
      && /coach_chat_disabled/.test(edge)
      && /coach_chat_provider_failed/.test(edge)
      && !/detail\s*\}/.test(edge));
  ok('the server refuses any model-produced program action before replying',
    /parsed\.programActions\.length === 0/.test(edge)
      && /if \(!payload\) return json\(502/.test(edge));
}

console.log('\n[2] THE DEPLOYED KNOWLEDGE IS AN EXACT GUARDED BUILD ARTIFACT');
{
  const manifest = read('src/rules/coachKnowledgeManifest.ts');
  const generated = read('supabase/functions/coach-chat/canonicalCoachKnowledge.generated.ts');
  for (const requiredPath of [
    'docs/LFA_PROGRAMMING_BIBLE.md',
    'docs/RULINGS_REGISTRY.md',
    'src/data/exercisePoolsStrength.ts',
    'src/data/exerciseTags.ts',
    'src/data/exerciseEquipmentRequirement.ts',
    'src/data/conditioningTemplates.ts',
  ]) {
    ok(`the canonical manifest includes ${requiredPath}`, manifest.includes(requiredPath));
    ok(`the generated server artifact includes ${requiredPath}`, generated.includes(requiredPath));
  }
  ok('a generator owns the artifact instead of a hand-maintained mini-Bible',
    /canonicalCoachKnowledge\.generated\.ts/.test(read('scripts/build-coach-knowledge-bundle.ts'))
      && /COACH_KNOWLEDGE_SOURCE_SPECS/.test(read('scripts/build-coach-knowledge-bundle.ts')));
  ok('every deployed byte equals its current canonical source',
    COACH_KNOWLEDGE_SOURCE_SPECS.every((spec) => {
      const deployed = CANONICAL_COACH_KNOWLEDGE.find((entry) => entry.path === spec.path);
      return deployed?.authority === spec.authority && deployed.content === read(spec.path);
    }));
}

console.log('\n[3] THE APP CHAT IS TERRA-READ-ONLY');
{
  const client = read('src/services/api/coachChat.ts');
  const screen = read('src/screens/coach/CoachTabScreen.tsx');
  ok('the app calls only the server-owned coach-chat endpoint',
    /functionsBaseUrl.*coach-chat|coach-chat/.test(client)
      && !/api\.openai\.com|OPENAI_API_KEY/.test(client));
  ok('the client sends the shared model context, not an account or a private prompt',
    /buildCoachModelInput/.test(client)
      && !/\binstructions\s*:|\bmodel\s*:/.test(client));
  ok('the screen awaits Terra and carries recent conversation with the live Snapshot',
    /await askCoachReadOnly/.test(screen)
      && /snapshot/.test(screen)
      && /recentTurns/.test(screen));
  ok('the replaced conversational path has no program-change reader, card or writer',
    !/readCoachMessage|coachAnswer|coachProposal|ChangeCard|executeProgramControlActionDurably/.test(screen));
  ok('the composer cannot send twice while Terra is answering',
    /isSending/.test(screen)
      && /disabled=\{!canSend\}/.test(screen)
      && /coach-tab-thinking/.test(screen));
  ok('Coach is the conversation surface while its athlete facts remain private model input',
    screen.indexOf('testID="coach-tab-conversation"') >= 0
      && screen.indexOf('{turns.map((turn) => (')
        > screen.indexOf('testID="coach-tab-conversation"')
      && !/CoachDashboard|SnapshotDashboard|coach-dashboard/.test(screen)
      && /const snapshot = useLiveAthleteSnapshot/.test(screen));
}

console.log('\n[4] THE LIVE FUNCTION REQUIRES SUPABASE JWT VERIFICATION');
{
  const config = read('supabase/config.toml');
  ok('coach-chat verifies JWTs independently of Coach Lab',
    /\[functions\.coach-chat\][\s\S]*?verify_jwt = true/.test(config));
}

async function finish(): Promise<void> {
  console.log('\n[5] THE APP CLIENT EXECUTES THE BOUNDED READ-ONLY REQUEST');
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'public-test-key';
  let capturedUrl = '';
  let capturedHeaders: Record<string, string> = {};
  let capturedBody = '';
  const answer = await askCoachReadOnly({
    message: 'whats on tomorrow',
    snapshot: coachLabFixtureSnapshot(),
    conversationContext: { recentTurns: [], activeProgramTarget: null },
    fetch: async (url, init) => {
      capturedUrl = url;
      capturedHeaders = init.headers;
      capturedBody = init.body;
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({ message: 'Tomorrow is team training.', programActions: [] });
        },
      };
    },
  });
  const sent = JSON.parse(capturedBody) as {
    modelInput?: {
      currentAthleteSnapshot?: { visibleWeek?: { days?: readonly { timing?: { relationToAsOf?: string } }[] } };
      conversationContext?: { activeProgramTarget?: unknown; recentTurns?: readonly unknown[] };
    };
  };
  ok('the executed request reaches only coach-chat with public Supabase auth',
    capturedUrl === 'https://project.supabase.co/functions/v1/coach-chat'
      && capturedHeaders.Authorization === 'Bearer public-test-key'
      && !capturedBody.includes('public-test-key'));
  ok('the executed payload carries typed time and explicit missing reference context',
    sent.modelInput?.currentAthleteSnapshot?.visibleWeek?.days?.[1]?.timing?.relationToAsOf === 'future'
      && sent.modelInput?.conversationContext?.activeProgramTarget === null
      && sent.modelInput?.conversationContext?.recentTurns?.length === 0,
    sent.modelInput);
  ok('an empty-action answer reaches the athlete', answer === 'Tomorrow is team training.');

  let actionRejected = false;
  try {
    await askCoachReadOnly({
      message: 'move monday',
      snapshot: coachLabFixtureSnapshot(),
      conversationContext: { recentTurns: [], activeProgramTarget: null },
      fetch: async () => ({
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({
            message: 'Moved it.',
            programActions: [{ kind: 'move', label: 'Move' }],
          });
        },
      }),
    });
  } catch (error) {
    actionRejected = /read-only/.test(String(error));
  }
  ok('the app itself rejects a response carrying any action', actionRejected);

  console.log(`\nCoach chat integration totals: ${passed} passed, ${failed} failed`);
  totalsPrinted(failed);
  console.log('  NOT COVERED: this source/parity and client tape makes no provider call, mounts no React Native screen and proves no physical-phone layout.');
  if (failed > 0) process.exit(1);
}

finish().catch((error) => {
  console.error(error);
  totalsPrinted(1);
  process.exit(1);
});
