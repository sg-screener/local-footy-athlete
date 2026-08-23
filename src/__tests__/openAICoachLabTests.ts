(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import {
  buildCoachLabBrainInstructions,
  serializeCoachSnapshotForModel,
} from '../dev/coachLab/coachLabBrainPack';
import { COACH_LAB_CASES, coachLabFixtureSnapshot } from '../dev/coachLab/coachLabCases';
import { runCoachLabAsync } from '../dev/coachLab/coachLab';
import {
  createOpenAICoachLabCandidate,
  OPENAI_COACH_LAB_MODEL,
  OPENAI_COACH_LAB_PROMPT_VERSION,
} from '../dev/coachLab/openAICoachLabCandidate';
import {
  OpenAIResponsesClient,
  type CoachLabFetch,
} from '../dev/coachLab/openAIResponsesClient';
import { SupabaseCoachLabClient } from '../dev/coachLab/supabaseCoachLabClient';

armTotalsOrRed();

let passed = 0;
let failed = 0;

function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL ${name}${detail === undefined ? '' : `\n      ${JSON.stringify(detail)}`}`);
}

const MODEL_PAYLOAD = {
  message: 'My coaching judgement is to keep the useful work but reduce the dose today.',
  answerMode: 'answer',
  basis: ['athlete_snapshot', 'coaching_judgement'],
  snapshotFieldsUsed: ['visibleWeek', 'readiness', 'load'],
  knowledgeSources: [],
  judgementLabel: 'labelled',
  programActions: [],
};

async function main(): Promise<void> {
  console.log('\n[1] THE BRAIN PACK CONTAINS THE CANONICAL KNOWLEDGE, NOT OLD COACH CODE');
  {
    const instructions = buildCoachLabBrainInstructions({
      bible: 'BIBLE_START\nall bible words\nBIBLE_END',
      rulings: 'RULINGS_START\nR-999 current ruling\nRULINGS_END',
      exerciseSources: [
        { path: 'src/data/exerciseTags.ts', content: 'EXERCISE_TAG_SOURCE' },
        { path: 'src/data/conditioningTemplates.ts', content: 'CONDITIONING_SOURCE' },
      ],
    });
    ok('the entire supplied Bible survives into the prompt',
      instructions.includes('BIBLE_START\nall bible words\nBIBLE_END'));
    ok('the entire current rulings registry survives into the prompt',
      instructions.includes('RULINGS_START\nR-999 current ruling\nRULINGS_END'));
    ok('every supplied exercise source survives with its path',
      instructions.includes('src/data/exerciseTags.ts')
        && instructions.includes('EXERCISE_TAG_SOURCE')
        && instructions.includes('CONDITIONING_SOURCE'));
    ok('the prompt states the read-only and judgement boundaries',
      /never diagnose/i.test(instructions)
        && /never change/i.test(instructions)
        && /clearly label/i.test(instructions)
        && /one focused follow-up question/i.test(instructions));
    ok('the prompt names the authority order',
      /CURRENT ATHLETE SNAPSHOT[\s\S]+ACTIVE LFA RULINGS[\s\S]+LFA PROGRAMMING BIBLE[\s\S]+COACHING JUDGEMENT/.test(instructions));
  }

  console.log('\n[2] THE SNAPSHOT IS THE ONLY ATHLETE PAYLOAD');
  {
    const snapshotText = serializeCoachSnapshotForModel(coachLabFixtureSnapshot());
    const parsed = JSON.parse(snapshotText) as Record<string, unknown>;
    ok('the live week, readiness, load, progress and restrictions are present',
      'visibleWeek' in parsed
        && 'readiness' in parsed
        && 'load' in parsed
        && 'progress' in parsed
        && 'restrictions' in parsed);
    ok('no account, email or athlete id is sent',
      !/email|userId|athleteId|accountId/i.test(snapshotText));
  }

  console.log('\n[3] THE OPENAI REQUEST IS NEW, STATELESS AND STRICT');
  {
    let capturedUrl = '';
    let capturedHeaders: Record<string, string> = {};
    let capturedBody = '';
    const fakeFetch: CoachLabFetch = async (url, init) => {
      capturedUrl = url;
      capturedHeaders = init.headers;
      capturedBody = init.body;
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({
            output: [{
              type: 'message',
              content: [{ type: 'output_text', text: JSON.stringify(MODEL_PAYLOAD) }],
            }],
            usage: { input_tokens: 1200, output_tokens: 80, total_tokens: 1280 },
          });
        },
      };
    };
    const client = new OpenAIResponsesClient({ apiKey: 'secret-test-key', fetch: fakeFetch });
    const result = await client.create({
      model: OPENAI_COACH_LAB_MODEL,
      instructions: 'FULL BRAIN PACK',
      input: 'ATHLETE MESSAGE AND SNAPSHOT',
    });
    const body = JSON.parse(capturedBody) as Record<string, any>;
    ok('the fresh client calls the Responses endpoint',
      capturedUrl === 'https://api.openai.com/v1/responses');
    ok('the API key exists only in the bearer header',
      capturedHeaders.Authorization === 'Bearer secret-test-key'
        && !capturedBody.includes('secret-test-key'));
    ok('the strongest benchmark model is the default', body.model === 'gpt-5.6-sol');
    ok('the request disables provider-side response storage', body.store === false);
    ok('structured output is strict JSON Schema',
      body.text?.format?.type === 'json_schema'
        && body.text.format.strict === true
        && body.text.format.schema?.additionalProperties === false
        && !JSON.stringify(body.text.format.schema).includes('uniqueItems'));
    ok('the schema structurally forbids program actions',
      body.text.format.schema.properties.programActions.maxItems === 0);
    ok('the complete brain pack and athlete input reach their separate fields',
      body.instructions === 'FULL BRAIN PACK'
        && body.input === 'ATHLETE MESSAGE AND SNAPSHOT');
    ok('the typed output and token receipt return from the response',
      result.outputText === JSON.stringify(MODEL_PAYLOAD)
        && result.totalTokens === 1280);
  }

  console.log('\n[4] CHATGPT IS A REAL COACH LAB CANDIDATE, NEVER A LIVE APP WRITER');
  {
    const client = {
      async create() {
        return { outputText: JSON.stringify(MODEL_PAYLOAD), totalTokens: 1280 };
      },
    };
    const candidate = createOpenAICoachLabCandidate({
      client,
      instructions: 'FULL BIBLE + RULINGS + EXERCISE SOURCES',
    });
    const report = await runCoachLabAsync({
      cases: [COACH_LAB_CASES[2]],
      snapshot: coachLabFixtureSnapshot(),
      candidate,
    });
    const result = report.results[0];
    ok('the OpenAI response enters the existing Lab evaluator',
      report.candidateId === `openai:${OPENAI_COACH_LAB_MODEL}`
        && result.response.message === MODEL_PAYLOAD.message);
    ok('the candidate records provider, model, prompt and tokens itself',
      result.response.diagnostics.provider === 'openai'
        && result.response.diagnostics.model === OPENAI_COACH_LAB_MODEL
        && result.response.diagnostics.promptVersion === OPENAI_COACH_LAB_PROMPT_VERSION
        && result.response.diagnostics.tokenUse === 1280);
    ok('no ChatGPT output can contain a program action',
      result.response.programActions.length === 0
        && result.automaticChecks.readOnly);
    ok('the real answer still cannot approve itself',
      result.verdict === 'needs_owner_review' && report.summary.approved === 0);
  }

  console.log('\n[5] KEY AND RESPONSE FAILURES STOP BEFORE QUALITY CLAIMS');
  {
    let called = false;
    let missingKeyStopped = false;
    try {
      const client = new OpenAIResponsesClient({
        apiKey: '',
        fetch: async () => {
          called = true;
          throw new Error('should not call');
        },
      });
      await client.create({ model: OPENAI_COACH_LAB_MODEL, instructions: 'x', input: 'y' });
    } catch (error) {
      missingKeyStopped = /OPENAI_API_KEY/.test(String(error));
    }
    ok('a missing key stops before any network call', missingKeyStopped && !called);

    let invalidResponseStopped = false;
    try {
      const client = new OpenAIResponsesClient({
        apiKey: 'secret-test-key',
        fetch: async () => ({ ok: true, status: 200, async text() { return '{"output":[]}'; } }),
      });
      await client.create({ model: OPENAI_COACH_LAB_MODEL, instructions: 'x', input: 'y' });
    } catch (error) {
      invalidResponseStopped = /output text/i.test(String(error))
        && !String(error).includes('secret-test-key');
    }
    ok('an empty API response stops without leaking the key', invalidResponseStopped);
  }

  console.log('\n[6] THE LIVE RUNNER READS THE WHOLE CURRENT KNOWLEDGE SET');
  {
    const runner = readFileSync(resolve(__dirname, '../../scripts/run-openai-coach-lab.ts'), 'utf8');
    for (const requiredPath of [
      'docs/LFA_PROGRAMMING_BIBLE.md',
      'docs/RULINGS_REGISTRY.md',
      'src/data/exercisePoolsStrength.ts',
      'src/data/exerciseTags.ts',
      'src/data/exerciseEquipmentRequirement.ts',
      'src/data/conditioningTemplates.ts',
    ]) {
      ok(`the live runner includes ${requiredPath}`, runner.includes(requiredPath));
    }
    ok('the deleted Coach pipeline is not an input',
      !/CoachScreen|coachTurnController|coach-chat\/index/.test(runner));
    ok('one case is the default so a command cannot accidentally buy ten calls',
      /DEFAULT_CASE_ID/.test(runner) && /--all/.test(runner));
  }

  console.log('\n[7] THE EXISTING SUPABASE KEY STAYS SERVER-SIDE');
  {
    let capturedUrl = '';
    let capturedHeaders: Record<string, string> = {};
    let capturedBody = '';
    const gateway = new SupabaseCoachLabClient({
      supabaseUrl: 'https://project.supabase.co/',
      anonKey: 'public-anon-key',
      fetch: async (url, init) => {
        capturedUrl = url;
        capturedHeaders = init.headers;
        capturedBody = init.body;
        return {
          ok: true,
          status: 200,
          async text() {
            return JSON.stringify({ outputText: JSON.stringify(MODEL_PAYLOAD), totalTokens: 900 });
          },
        };
      },
    });
    const result = await gateway.create({
      model: OPENAI_COACH_LAB_MODEL,
      instructions: 'BRAIN',
      input: 'SNAPSHOT',
    });
    ok('the local Lab calls only the new coach-lab function',
      capturedUrl === 'https://project.supabase.co/functions/v1/coach-lab');
    ok('Supabase auth is present but the OpenAI secret is not sent by the Lab',
      capturedHeaders.Authorization === 'Bearer public-anon-key'
        && !/OPENAI_API_KEY|sk-/.test(capturedBody));
    ok('the gateway returns the typed OpenAI receipt',
      result.totalTokens === 900 && result.outputText === JSON.stringify(MODEL_PAYLOAD));

    const edgeSource = readFileSync(resolve(__dirname, '../../supabase/functions/coach-lab/index.ts'), 'utf8');
    const config = readFileSync(resolve(__dirname, '../../supabase/config.toml'), 'utf8');
    ok('only the new server endpoint reads the existing OpenAI secret',
      /Deno\.env\.get\('OPENAI_API_KEY'\)/.test(edgeSource)
        && !/ANTHROPIC_API_KEY|COACH_LLM_PROVIDER|coach-chat/.test(edgeSource));
    ok('the endpoint fixes the model and bounds request size',
      /ALLOWED_MODEL = 'gpt-5\.6-sol'/.test(edgeSource)
        && /instructions\.length > 1_500_000/.test(edgeSource)
        && /input\.length > 100_000/.test(edgeSource));
    ok('the paid endpoint is disabled between controlled Lab runs',
      /Deno\.env\.get\('COACH_LAB_ENABLED'\) !== 'true'/.test(edgeSource)
        && /return json\(503, \{ error: 'coach_lab_disabled' \}\)/.test(edgeSource));
    ok('provider failures do not return internal details to the caller',
      /return json\(502, \{ error: 'coach_lab_provider_failed' \}\)/.test(edgeSource)
        && !edgeSource.includes('syntheticSmokeDetail'));
    ok('Supabase JWT verification is explicitly required',
      /\[functions\.coach-lab\][\s\S]*verify_jwt = true/.test(config));
  }

  console.log(`\nOpenAI Coach Lab totals: ${passed} passed, ${failed} failed`);
  totalsPrinted(failed);
  console.log('  NOT COVERED: the deployed endpoint ran one paid synthetic request only. Canonical private LFA sources were not sent, no real LFA answer was judged, and no live app screen or program change is touched.');
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  totalsPrinted(1);
  process.exit(1);
});
