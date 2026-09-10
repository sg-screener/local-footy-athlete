(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import fs from 'fs';
import path from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import { CANONICAL_COACH_KNOWLEDGE } from '../../supabase/functions/coach-chat/canonicalCoachKnowledge.generated';
import { COACH_KNOWLEDGE_SOURCE_SPECS } from '../rules/coachKnowledgeManifest';
import {
  askCoachReadOnly,
  coachChatFailureCode,
} from '../services/api/coachChat';
import { coachLabFixtureSnapshot } from '../dev/coachLab/coachLabCases';
import {
  coachResponseContractFailureCode,
  evaluateCoachResponseContract,
} from '../rules/coachResponseContract';
import { COACH_APP_DOOR_LABELS } from '../rules/coachAppMap';
import { coachFailureReply } from '../rules/coachTabCopy';
import { buildCoachModelInput } from '../rules/coachModelContext';
import { coachResponseGroundingFacts } from '../rules/coachResponseContract';
import {
  checkDurableCoachRateLimit,
  forwardedClientAddress,
  opaqueClientRateLimitKey,
} from '../../supabase/functions/_shared/durableCoachRateLimit';

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
  ok('the server refuses identity-shaped keys including a generic name',
    /email\|userId\|athleteId\|accountId\|name/.test(edge));
  ok('the composer and server share one 1,000-character request boundary',
    /maxLength=\{COACH_CHAT_MAX_MESSAGE_CHARACTERS\}/.test(
      read('src/screens/coach/CoachTabScreen.tsx'),
    )
      && /if \(!coachChatMessageWithinLimit\(message\) \|\| isSending\) return;/.test(
        read('src/screens/coach/CoachTabScreen.tsx'),
      )
      && /value\.athleteMessage\.length <= COACH_CHAT_MAX_MESSAGE_CHARACTERS/.test(edge)
      && /turn\.text\.length <= COACH_CHAT_MAX_MESSAGE_CHARACTERS/.test(edge)
      && !/athleteMessage\.length <= 1_000/.test(edge));
  ok('the server refuses any model-produced program action before replying',
    /programActions\.length === 0/.test(read('src/rules/coachResponseContract.ts'))
      && /const failureCode = coachResponseContractFailureCode\(evaluation\)/.test(edge)
      && /failureCode === 'invalid_answer'[\s\S]{0,100}?'coach_chat_response_refused'/.test(edge));
  ok('production and Coach Lab call one shared automatic response contract',
    /evaluateCoachResponseContract/.test(edge)
      && /evaluateCoachResponseContract/.test(read('src/dev/coachLab/coachLab.ts'))
      && !/const automaticChecks: CoachLabAutomaticChecks/.test(read('src/dev/coachLab/coachLab.ts')));
  ok('production supplies both live-program and retrieved-source grounding inputs',
    /requiresLiveProgramFacts:\s*true/.test(edge)
      && /allowedKnowledgeSourceIds:\s*citableCoachKnowledgeIds\(retrieval\.chunks\)/.test(edge));
  ok('Coach Lab supplies both case truth and actual retrieved-source grounding inputs',
    /requiresLiveProgramFacts:\s*labCase\.requiresLiveProgramFacts/.test(read('src/dev/coachLab/coachLab.ts'))
      && /allowedKnowledgeSourceIds:\s*response\.diagnostics\.retrievedChunkIds/.test(
        read('src/dev/coachLab/coachLab.ts'),
      ));
  ok('an automatic production failure is refused before any answer is returned',
    /if \(failureCode !== null\) \{[\s\S]{0,500}?send\(\{\s*t: 'refused'/.test(edge)
      && edge.indexOf('if (failureCode !== null)') < edge.indexOf('console.log(\'coach-chat token receipt\''));
  ok('a production truth refusal leaves a typed server receipt without athlete text',
    /console\.warn\('coach-chat response rejected by contract', evaluation\.violations\)/.test(edge)
      && edge.indexOf("console.warn('coach-chat response rejected by contract'")
        < edge.indexOf("t: 'refused'", edge.indexOf("console.warn('coach-chat response rejected by contract'")));
  ok('answer usability failures are absence while truth and read-only failures are refusals',
    /coachResponseContractFailureCode\(evaluation\)/.test(edge)
      && /failureCode === 'invalid_answer'\s*\? 'coach_chat_invalid_answer'\s*:\s*'coach_chat_response_refused'/.test(edge));
  ok('a durable shared request window refuses before the paid provider call',
    /checkDurableCoachRateLimit/.test(edge)
      && !/createSlidingWindowRateLimiter/.test(edge)
      && /if \(!rateLimit\.allowed\) \{\s*return json\(429/.test(edge)
      && /Retry-After/.test(edge)
      && edge.indexOf('return json(429') < edge.indexOf('new OpenAIResponsesClient'));
  ok('rate-limit identity never falls back to the app-wide authorization key',
    /forwardedClientAddress/.test(edge)
      && !/request\.headers\.get\('authorization'\)/.test(edge));
  ok('the durable limiter is held by an atomic database migration',
    /private\.coach_rate_limits/.test(read('supabase/migrations/007_coach_rate_limits.sql'))
      && /on conflict \(client_key\) do update/i.test(
        read('supabase/migrations/007_coach_rate_limits.sql'),
      )
      && /global:coach-chat/.test(read('supabase/migrations/007_coach_rate_limits.sql')));
  // F14 (Sam, 2026-09-09): the contract used to accept a self-declared
  // grounding receipt and never read a snapshot value. Every door that shows
  // an answer now hands the contract the facts to check the words against.
  ok('production hands the contract the snapshot facts the answer must agree with',
    /const facts = coachResponseGroundingFacts\(\s*modelInput\.currentAthleteSnapshot,\s*doorLabelsFromKnowledge\(CANONICAL_COACH_KNOWLEDGE\),?\s*\)/.test(edge) && /allowedKnowledgeSourceIds: citableCoachKnowledgeIds\(retrieval\.chunks\),\s*facts,/.test(edge));
  ok('Coach Lab hands the same facts, read from the same projection',
    /coachResponseGroundingFacts\(projectCoachSnapshotForModel\(args\.snapshot\), COACH_APP_DOOR_LABELS\)/.test(
      read('src/dev/coachLab/coachLab.ts'),
    ));
  ok('the app client checks the returned words against the same facts before showing them',
    /coachResponseGroundingFacts\(/.test(read('src/services/api/coachChat.ts'))
      && /readinessClaimGrounded\(/.test(read('src/services/api/coachChat.ts'))
      && /fixtureClaimGrounded\(/.test(read('src/services/api/coachChat.ts'))
      && /phaseClaimGrounded\(/.test(read('src/services/api/coachChat.ts')));
  const pack = read('src/dev/coachLab/coachLabBrainPack.ts');
  ok('the prompt says what an unreported readiness, the fixture list and earlier turns mean',
    /readiness\.reported is false/.test(pack)
      && /visibleWeek\.fixtures is the complete list/.test(pack)
      && /earlier wording, not athlete facts/.test(pack));
}

console.log('\n[2] THE BUNDLED KNOWLEDGE IS AN EXACT GUARDED BUILD ARTIFACT');
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
  const expected = COACH_KNOWLEDGE_SOURCE_SPECS.map(spec => ({ ...spec, content: read(spec.path) }));
  const matches = (sources: readonly unknown[]) => JSON.stringify(sources) === JSON.stringify(expected);
  ok('the bundled sources exactly match the manifest, authority and current bytes', matches(CANONICAL_COACH_KNOWLEDGE));
  for (const [index, source] of expected.entries()) {
    ok(`freshness rejects changed bytes in ${source.path}`, !matches(expected.map((entry, at) =>
      at === index ? { ...entry, content: entry.content + '\nSTALE' } : entry)));
  }
  ok('freshness rejects a missing source', !matches(expected.slice(1)));
  ok('freshness rejects an extra duplicate source', !matches([...expected, expected[0]]));
  ok('freshness rejects a changed authority', !matches(expected.map((entry, index) =>
    index === 0 ? { ...entry, authority: 'canonical_source' } : entry)));

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
  ok('the screen reads a typed failure and logs safety refusals without athlete text',
    /coachChatFailureCode\(error\)/.test(screen)
      && /failure === 'refused'/.test(screen)
      && /console\.warn\('\[coach-chat\] response refused by the read-only truth contract'\)/.test(screen));
  const coachCopy = read('src/rules/coachTabCopy.ts');
  ok('the three typed failure causes render three truthful approved answers',
    /unavailable: `Coach isn't available right now\. Try again shortly\. \$\{COACH_FAILURE_FEEDBACK_ASK\}`/.test(coachCopy)
      && /refused: `I can't answer that safely\. \$\{COACH_FAILURE_FEEDBACK_ASK\}`/.test(coachCopy)
      && /no_answer: `\$\{COACH_TAB_COPY\.noAnswerYet\} \$\{COACH_FAILURE_FEEDBACK_ASK\}`/.test(coachCopy)
      && /Leave Feedback on the Profile tab/.test(coachCopy)
      && /say\(coachFailureReply\(failure\)\)/.test(screen));
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
    actionRejected = coachChatFailureCode(error) === 'refused';
  }
  ok('the app itself rejects a response carrying any action', actionRejected);

  let oversizedFetches = 0;
  let oversizedCode = '';
  try {
    await askCoachReadOnly({
      message: 'x'.repeat(1_001),
      snapshot: coachLabFixtureSnapshot(),
      conversationContext: { recentTurns: [], activeProgramTarget: null },
      fetch: async () => {
        oversizedFetches += 1;
        return { ok: true, status: 200, async text() { return '{}'; } };
      },
    });
  } catch (error) {
    oversizedCode = coachChatFailureCode(error);
  }
  ok('an oversized current turn is refused before fetch as no usable answer',
    oversizedFetches === 0 && oversizedCode === 'no_answer',
    { oversizedFetches, oversizedCode });
  const boundedAfterOversizedTurn = buildCoachModelInput({
    athleteMessage: 'what is next',
    snapshot: coachLabFixtureSnapshot(),
    conversationContext: {
      activeProgramTarget: null,
      recentTurns: [
        { speaker: 'athlete', text: 'x'.repeat(1_001) },
        { speaker: 'coach', text: 'Your last usable answer.' },
      ],
    },
  });
  ok('an oversized historical turn is dropped before it can poison later requests',
    boundedAfterOversizedTurn.conversationContext.recentTurns.length === 1
      && boundedAfterOversizedTurn.conversationContext.recentTurns[0]?.text
        === 'Your last usable answer.');

  let falseChangeRejected = false;
  try {
    await askCoachReadOnly({
      message: 'what changed',
      snapshot: coachLabFixtureSnapshot(),
      conversationContext: { recentTurns: [], activeProgramTarget: null },
      fetch: async () => ({
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({ message: 'I adjusted your week.', programActions: [] });
        },
      }),
    });
  } catch (error) {
    falseChangeRejected = coachChatFailureCode(error) === 'refused';
  }
  ok('the live app refuses a false change claim even with an empty action list',
    falseChangeRejected);

  // F14 (Sam's 2026-09-09 walkthrough): with nothing recorded the Coach said
  // "readiness recorded as flat", and with one Saturday game it said "Game Day
  // Saturday and Sunday". The snapshot sent was right both times; only the
  // words were free. These stubs replay those two answers.
  const stubReply = (message: string) => async () => ({
    ok: true,
    status: 200,
    async text() {
      return JSON.stringify({ message, programActions: [] });
    },
  });
  let inventedReadinessCode = '';
  try {
    await askCoachReadOnly({
      message: 'how am I looking today',
      snapshot: coachLabFixtureSnapshot({ readiness: 'not_recorded' }),
      conversationContext: { recentTurns: [], activeProgramTarget: null },
      fetch: stubReply('Your readiness is recorded as flat today, so keep the session easy.'),
    });
    inventedReadinessCode = 'answered';
  } catch (error) {
    inventedReadinessCode = coachChatFailureCode(error);
  }
  ok('F14: the live app refuses a readiness tier when the athlete recorded nothing',
    inventedReadinessCode === 'refused', inventedReadinessCode);
  let inventedFixtureCode = '';
  try {
    await askCoachReadOnly({
      message: 'what is on this weekend',
      snapshot: coachLabFixtureSnapshot(),
      conversationContext: { recentTurns: [], activeProgramTarget: null },
      fetch: stubReply('Game Day Saturday and Sunday, so Friday stays light.'),
    });
    inventedFixtureCode = 'answered';
  } catch (error) {
    inventedFixtureCode = coachChatFailureCode(error);
  }
  ok('F14: the live app refuses a game named on a day the week has no game',
    inventedFixtureCode === 'refused', inventedFixtureCode);
  const groundedWords = 'Your game is Saturday. Nothing is recorded for readiness today, so tell me how you feel before Thursday\'s session.';
  let groundedAnswer = '';
  try {
    groundedAnswer = await askCoachReadOnly({
      message: 'what is on this weekend',
      snapshot: coachLabFixtureSnapshot({ readiness: 'not_recorded' }),
      conversationContext: { recentTurns: [], activeProgramTarget: null },
      fetch: stubReply(groundedWords),
    });
  } catch (error) {
    groundedAnswer = `refused:${coachChatFailureCode(error)}`;
  }
  ok('and an answer that names the real game and admits the absence reaches the athlete unchanged',
    groundedAnswer === groundedWords, groundedAnswer);

  let emptyAnswerCode = '';
  try {
    await askCoachReadOnly({
      message: 'what is next',
      snapshot: coachLabFixtureSnapshot(),
      conversationContext: { recentTurns: [], activeProgramTarget: null },
      fetch: async () => ({
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({ message: '', programActions: [] });
        },
      }),
    });
  } catch (error) {
    emptyAnswerCode = coachChatFailureCode(error);
  }
  ok('an empty provider answer is typed as no_answer', emptyAnswerCode === 'no_answer');

  let outageCode = '';
  try {
    await askCoachReadOnly({
      message: 'what is next',
      snapshot: coachLabFixtureSnapshot(),
      conversationContext: { recentTurns: [], activeProgramTarget: null },
      fetch: async () => { throw new Error('offline'); },
    });
  } catch (error) {
    outageCode = coachChatFailureCode(error);
  }
  ok('a transport failure is typed as unavailable without exposing its message',
    outageCode === 'unavailable');

  let serverRefusalCode = '';
  try {
    await askCoachReadOnly({
      message: 'what is next',
      snapshot: coachLabFixtureSnapshot(),
      conversationContext: { recentTurns: [], activeProgramTarget: null },
      fetch: async () => ({
        ok: false,
        status: 502,
        async text() {
          return JSON.stringify({ error: 'coach_chat_response_refused' });
        },
      }),
    });
  } catch (error) {
    serverRefusalCode = coachChatFailureCode(error);
  }
  ok('a server contract refusal remains refused at the screen boundary',
    serverRefusalCode === 'refused');

  let serverInvalidAnswerCode = '';
  try {
    await askCoachReadOnly({
      message: 'what is next',
      snapshot: coachLabFixtureSnapshot(),
      conversationContext: { recentTurns: [], activeProgramTarget: null },
      fetch: async () => ({
        ok: false,
        status: 502,
        async text() {
          return JSON.stringify({ error: 'coach_chat_invalid_answer' });
        },
      }),
    });
  } catch (error) {
    serverInvalidAnswerCode = coachChatFailureCode(error);
  }
  ok('a benign server answer failure remains no_answer at the screen boundary',
    serverInvalidAnswerCode === 'no_answer');
  ok('the copy owner executes a distinct approved answer for every typed failure',
    coachFailureReply('unavailable') === "Coach isn't available right now. Try again shortly. Please send a screenshot through Leave Feedback on the Profile tab and we'll fix it ASAP."
      && coachFailureReply('refused') === "I can't answer that safely. Please send a screenshot through Leave Feedback on the Profile tab and we'll fix it ASAP."
      && coachFailureReply('no_answer') === "I don't have an answer for that yet. Please send a screenshot through Leave Feedback on the Profile tab and we'll fix it ASAP."
      && new Set([
        coachFailureReply('unavailable'),
        coachFailureReply('refused'),
        coachFailureReply('no_answer'),
      ]).size === 3);

  console.log('\n[6] ONE AUTOMATIC CONTRACT BITES IN LAB AND PRODUCTION');
  const grounded = {
    message: 'Saturday is your game day.',
    answerMode: 'answer',
    basis: ['athlete_snapshot', 'lfa_rule'],
    snapshotFieldsUsed: ['visibleWeek'],
    knowledgeSources: [{
      id: 'bible:L1-L2',
      authority: 'lfa_bible',
      sourceReference: 'docs/LFA_PROGRAMMING_BIBLE.md:L1-L2',
    }],
    judgementLabel: 'not_needed',
    programActions: [],
  };
  // Slice S3: the facts also carry every door label the map holds.
  const DOOR_LABELS = COACH_APP_DOOR_LABELS.map((label) => label.toLowerCase());
  const FIXTURE_FACTS = { readinessReported: true, gameWeekdays: ['Saturday'], seasonPhase: 'In-season', doorLabels: DOOR_LABELS } as const;
  const sound = evaluateCoachResponseContract(grounded, {
    requiresLiveProgramFacts: true,
    allowedKnowledgeSourceIds: ['bible:L1-L2'],
    facts: FIXTURE_FACTS,
  });
  ok('a concise read-only answer with real Snapshot and source receipts passes',
    sound.ok && Object.values(sound.automaticChecks).every(Boolean), sound);
  const noSnapshotReceipt = evaluateCoachResponseContract({
    ...grounded,
    snapshotFieldsUsed: [],
  }, { requiresLiveProgramFacts: true, allowedKnowledgeSourceIds: ['bible:L1-L2'], facts: FIXTURE_FACTS });
  ok('a live program answer without a Snapshot receipt fails closed',
    !noSnapshotReceipt.ok && !noSnapshotReceipt.automaticChecks.programFactsGrounded);
  const unknownSource = evaluateCoachResponseContract({
    ...grounded,
    knowledgeSources: [{
      id: 'invented:L9-L10',
      authority: 'lfa_bible',
      sourceReference: 'invented',
    }],
  }, { requiresLiveProgramFacts: true, allowedKnowledgeSourceIds: ['bible:L1-L2'], facts: FIXTURE_FACTS });
  ok('a citation outside the retrieved knowledge fails closed',
    !unknownSource.ok && !unknownSource.automaticChecks.lfaClaimsGrounded);
  const hiddenJudgement = evaluateCoachResponseContract({
    ...grounded,
    basis: ['coaching_judgement'],
    snapshotFieldsUsed: [],
    knowledgeSources: [],
    judgementLabel: 'missing',
  }, { requiresLiveProgramFacts: false, allowedKnowledgeSourceIds: [], facts: FIXTURE_FACTS });
  ok('unlabelled coaching judgement fails closed',
    !hiddenJudgement.ok && !hiddenJudgement.automaticChecks.judgementTransparent);
  const falseChange = evaluateCoachResponseContract({
    ...grounded,
    message: 'I moved your session to Friday.',
  }, { requiresLiveProgramFacts: false, allowedKnowledgeSourceIds: ['bible:L1-L2'], facts: FIXTURE_FACTS });
  ok('a read-only answer claiming it changed the program fails closed',
    !falseChange.ok
      && !falseChange.automaticChecks.changeClaimsTruthful
      && coachResponseContractFailureCode(falseChange) === 'refused');
  const tooLong = evaluateCoachResponseContract({
    ...grounded,
    message: Array.from({ length: 101 }, () => 'word').join(' '),
  }, { requiresLiveProgramFacts: true, allowedKnowledgeSourceIds: ['bible:L1-L2'], facts: FIXTURE_FACTS });
  ok('a grounded 101-word answer is unusable rather than a safety refusal',
    !tooLong.ok
      && !tooLong.automaticChecks.concise
      && coachResponseContractFailureCode(tooLong) === 'invalid_answer');
  const wrongShape = evaluateCoachResponseContract({ message: 'Safe words, wrong envelope.' }, {
    requiresLiveProgramFacts: true,
    allowedKnowledgeSourceIds: ['bible:L1-L2'],
    facts: FIXTURE_FACTS,
  });
  ok('a wrong response shape is unusable rather than a claim about athlete safety',
    !wrongShape.ok
      && !wrongShape.automaticChecks.schemaValid
      && coachResponseContractFailureCode(wrongShape) === 'invalid_answer');
  const readOnlyViolation = evaluateCoachResponseContract({
    ...grounded,
    programActions: [{ kind: 'move', label: 'Move it' }],
  }, { requiresLiveProgramFacts: true, allowedKnowledgeSourceIds: ['bible:L1-L2'], facts: FIXTURE_FACTS });
  // F14 (2026-09-09): the two invented facts Sam read on the device.
  const inventedReadiness = evaluateCoachResponseContract({
    ...grounded,
    message: 'Your readiness is recorded as flat today, so keep it easy.',
    snapshotFieldsUsed: ['readiness'],
  }, {
    requiresLiveProgramFacts: true,
    allowedKnowledgeSourceIds: ['bible:L1-L2'],
    facts: { readinessReported: false, gameWeekdays: ['Saturday'], seasonPhase: 'In-season', doorLabels: DOOR_LABELS },
  });
  ok('F14: a readiness tier asserted when nothing was recorded fails closed as a refusal',
    !inventedReadiness.ok
      && inventedReadiness.automaticChecks.readinessClaimsGrounded === false
      && coachResponseContractFailureCode(inventedReadiness) === 'refused',
    inventedReadiness);
  const sameWordsReported = evaluateCoachResponseContract({
    ...grounded,
    message: 'Your readiness is recorded as flat today, so keep it easy.',
    snapshotFieldsUsed: ['readiness'],
  }, { requiresLiveProgramFacts: true, allowedKnowledgeSourceIds: ['bible:L1-L2'], facts: FIXTURE_FACTS });
  ok('the same words pass once a readiness answer actually exists',
    sameWordsReported.ok, sameWordsReported.violations);
  // R-397 (2026-09-10): the phase is the app's fact, never inferred from a game.
  const inventedPhase = evaluateCoachResponseContract({
    ...grounded,
    message: "You're pre-season, so the Nordic minimum doesn't apply this week.",
    snapshotFieldsUsed: ['situation'],
  }, { requiresLiveProgramFacts: true, allowedKnowledgeSourceIds: ['bible:L1-L2'], facts: FIXTURE_FACTS });
  ok('R-397: a phase asserted against the snapshot phase fails closed as a refusal',
    !inventedPhase.ok
      && inventedPhase.automaticChecks.phaseClaimsGrounded === false
      && coachResponseContractFailureCode(inventedPhase) === 'refused',
    inventedPhase);
  const phaseUnknown = evaluateCoachResponseContract({
    ...grounded,
    message: "You're in-season, so keep the Nordics in.",
    snapshotFieldsUsed: ['situation'],
  }, {
    requiresLiveProgramFacts: true,
    allowedKnowledgeSourceIds: ['bible:L1-L2'],
    facts: { readinessReported: true, gameWeekdays: ['Saturday'], seasonPhase: null, doorLabels: DOOR_LABELS },
  });
  ok('R-397: a phase asserted when the app could not say one is refused',
    !phaseUnknown.ok && phaseUnknown.automaticChecks.phaseClaimsGrounded === false, phaseUnknown);
  const phaseMatches = evaluateCoachResponseContract({
    ...grounded,
    message: "You're in-season: week 6, block 2. Keep the Nordics in this week.",
    snapshotFieldsUsed: ['situation'],
  }, { requiresLiveProgramFacts: true, allowedKnowledgeSourceIds: ['bible:L1-L2'], facts: FIXTURE_FACTS });
  ok('R-397: the same shape passes when it names the snapshot phase',
    phaseMatches.ok, phaseMatches.violations);
  const phaseConditional = evaluateCoachResponseContract({
    ...grounded,
    message: "If you're pre-season, a curl can stand in; in-season Nordics stay. Your week is in-season.",
    snapshotFieldsUsed: ['situation'],
  }, { requiresLiveProgramFacts: true, allowedKnowledgeSourceIds: ['bible:L1-L2'], facts: FIXTURE_FACTS });
  ok('R-397: a conditional or a general rule naming another phase is not a claim about this athlete',
    phaseConditional.ok, phaseConditional.violations);
  const inventedFixture = evaluateCoachResponseContract({
    ...grounded,
    message: 'Game Day Saturday and Sunday, so Friday stays light.',
  }, { requiresLiveProgramFacts: true, allowedKnowledgeSourceIds: ['bible:L1-L2'], facts: FIXTURE_FACTS });
  ok('F14: a game named on a day the week has no game fails closed as a refusal',
    !inventedFixture.ok
      && inventedFixture.automaticChecks.fixtureClaimsGrounded === false
      && coachResponseContractFailureCode(inventedFixture) === 'refused',
    inventedFixture);
  const deniedFixture = evaluateCoachResponseContract({
    ...grounded,
    message: 'There is no game this week, so push the lifts.',
  }, { requiresLiveProgramFacts: true, allowedKnowledgeSourceIds: ['bible:L1-L2'], facts: FIXTURE_FACTS });
  ok('denying the real game fails the same check',
    !deniedFixture.ok && deniedFixture.automaticChecks.fixtureClaimsGrounded === false);
  const gameInAnEmptyWeek = evaluateCoachResponseContract(grounded, {
    requiresLiveProgramFacts: true,
    allowedKnowledgeSourceIds: ['bible:L1-L2'],
    facts: { readinessReported: true, gameWeekdays: [], seasonPhase: 'In-season', doorLabels: DOOR_LABELS },
  });
  ok('naming a Saturday game in a week with no fixture fails the same check',
    !gameInAnEmptyWeek.ok && gameInAnEmptyWeek.automaticChecks.fixtureClaimsGrounded === false);
  const otherDayNearGame = evaluateCoachResponseContract({
    ...grounded,
    message: 'Saturday\'s game is the anchor, so Thursday is your last hard session and Friday is light.',
  }, { requiresLiveProgramFacts: true, allowedKnowledgeSourceIds: ['bible:L1-L2'], facts: FIXTURE_FACTS });
  ok('other weekdays in the same sentence are not read as game claims',
    otherDayNearGame.ok, otherDayNearGame.violations);
  let derivedFacts: unknown = 'threw';
  try {
    derivedFacts = coachResponseGroundingFacts(buildCoachModelInput({
      athleteMessage: 'x',
      snapshot: coachLabFixtureSnapshot(),
    }).currentAthleteSnapshot, COACH_APP_DOOR_LABELS);
  } catch (error) {
    derivedFacts = `threw: ${error instanceof Error ? error.message : String(error)}`;
  }
  ok('the facts the contract checks are read from the projection, never re-derived',
    JSON.stringify(derivedFacts) === JSON.stringify(FIXTURE_FACTS), derivedFacts);
  const refusalMatrix = [
    ['readOnly', readOnlyViolation],
    ['programFactsGrounded', noSnapshotReceipt],
    ['lfaClaimsGrounded', unknownSource],
    ['judgementTransparent', hiddenJudgement],
    ['changeClaimsTruthful', falseChange],
    ['readinessClaimsGrounded', inventedReadiness],
    ['phaseClaimsGrounded', inventedPhase],
    ['fixtureClaimsGrounded', inventedFixture],
  ] as const;
  ok('every truth and read-only contract member independently remains a refusal',
    refusalMatrix.every(([check, evaluation]) =>
      evaluation.automaticChecks[check] === false
        && coachResponseContractFailureCode(evaluation) === 'refused'),
    refusalMatrix.map(([check, evaluation]) => ({
      check,
      value: evaluation.automaticChecks[check],
      code: coachResponseContractFailureCode(evaluation),
    })));

  console.log('\n[7] THE LIVE RATE WINDOW IS DURABLE, PRIVATE AND SHARED');
  const forwarded = new Request('https://example.test', {
    headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.2' },
  });
  ok('the platform-forwarded client address is read without the shared auth fallback',
    forwardedClientAddress(forwarded) === '203.0.113.7'
      && forwardedClientAddress(new Request('https://example.test')) === null);
  const keyA = await opaqueClientRateLimitKey('203.0.113.7', 'a'.repeat(32));
  const keyAAgain = await opaqueClientRateLimitKey('203.0.113.7', 'a'.repeat(32));
  const keyB = await opaqueClientRateLimitKey('203.0.113.8', 'a'.repeat(32));
  ok('the durable store receives a stable opaque key rather than a raw address',
    keyA === keyAAgain && keyA !== keyB && !keyA.includes('203.0.113.7'));
  let rpcBody = '';
  let rpcHeaders: Record<string, string> = {};
  const durable = await checkDurableCoachRateLimit({
    clientKey: keyA,
    supabaseUrl: 'https://project.supabase.co',
    serviceRoleKey: 'private-service-key',
    windowSeconds: 60,
    clientMaxRequests: 20,
    globalMaxRequests: 200,
    fetch: async (_url, init) => {
      rpcBody = init.body;
      rpcHeaders = init.headers;
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify([{
            allowed: false,
            retry_after_seconds: 17,
            scope: 'client',
          }]);
        },
      };
    },
  });
  ok('the shared database verdict carries its retry receipt and refusal scope',
    !durable.allowed && durable.retryAfterSeconds === 17 && durable.scope === 'client',
    durable);
  ok('the private database credential stays in headers and both spend ceilings reach the RPC',
    rpcHeaders.apikey === 'private-service-key'
      && !rpcBody.includes('private-service-key')
      && rpcBody.includes('"p_client_max_requests":20')
      && rpcBody.includes('"p_global_max_requests":200'));

  const rulingRegistry = read('docs/RULINGS_REGISTRY.md');
  const lawRegistry = read('src/rules/lawRegistry.ts');
  ok('R-140 records the exact approved failure and privacy words with a chained guard',
    /\*\*R-140\*\*/.test(rulingRegistry)
      && /LAW-coach-failures-and-ai-disclosure-are-truthful/.test(lawRegistry)
      && /test:coach-snapshot \+ test:profile-reset-ui/.test(lawRegistry));

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
