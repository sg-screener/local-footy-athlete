/**
 * envConfigTests - release config guardrails.
 *
 * Run: npm run test:env-config
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  buildMailto,
  describeMissingClientEnv,
  getClientEnvConfig,
  shouldCreateSemanticProgramEditDraftAdapter,
} from '../config/env';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  PASS ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  FAIL ${name}${detail ? '\n      ' + detail : ''}`);
  }
}

function section(label: string) {
  console.log(`\n${label}`);
}

section('[1] Reads required Supabase public env');
{
  const config = getClientEnvConfig({
    EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co/',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  });

  ok('config is ready', config.isReady);
  ok('trims Supabase URL slash', config.supabaseUrl === 'https://project.supabase.co');
  ok(
    'coach-chat endpoint derived',
    config.coachChatEndpoint === 'https://project.supabase.co/functions/v1/coach-chat',
  );
  ok(
    'coach-intent endpoint derived',
    config.coachIntentEndpoint === 'https://project.supabase.co/functions/v1/coach-intent',
  );
  ok(
    'semantic ProgramEditDraft endpoint derived',
    config.coachSemanticProgramEditDraftEndpoint ===
      'https://project.supabase.co/functions/v1/coach-semantic-program-edit-draft',
  );
  ok('semantic ProgramEditDraft mode defaults off', config.semanticProgramEditDraftMode === 'off');
  ok('anon key read', config.supabaseAnonKey === 'anon-key');
}

section('[2] Supports publishable key alias and custom functions base');
{
  const config = getClientEnvConfig({
    EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
    EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL: 'https://edge.example.com/functions/v1/',
  });

  ok('publishable alias read', config.supabaseAnonKey === 'publishable-key');
  ok(
    'custom functions base used',
    config.coachIntentEndpoint === 'https://edge.example.com/functions/v1/coach-intent',
  );
  ok(
    'semantic ProgramEditDraft endpoint uses custom functions base',
    config.coachSemanticProgramEditDraftEndpoint ===
      'https://edge.example.com/functions/v1/coach-semantic-program-edit-draft',
  );
}

section('[3] Missing env produces clear error copy');
{
  const config = getClientEnvConfig({});
  const message = describeMissingClientEnv(config);

  ok('config not ready', !config.isReady);
  ok('missing URL named', message.includes('EXPO_PUBLIC_SUPABASE_URL'));
  ok('missing key named', message.includes('EXPO_PUBLIC_SUPABASE_ANON_KEY'));
}

section('[4] Client config does not reference private AI keys');
{
  const envPath = path.resolve(__dirname, '..', 'config', 'env.ts');
  const src = fs.readFileSync(envPath, 'utf8');
  ok('no ANTHROPIC string in client env module', !/ANTHROPIC/i.test(src));
  ok('no OPENAI string in client env module', !/OPENAI/i.test(src));
}

section('[5] Support mailto helper is encoded');
{
  ok(
    'mailto subject encoded',
    buildMailto('support@example.com', 'LFA - Speak to a Human') ===
      'mailto:support@example.com?subject=LFA%20-%20Speak%20to%20a%20Human',
  );
}

section('[6] Semantic ProgramEditDraft mode is dev-active gated');
{
  const defaultMode = getClientEnvConfig({
    EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  });
  const shadow = getClientEnvConfig({
    EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    EXPO_PUBLIC_COACH_SEMANTIC_PROGRAM_EDIT_MODE: ' shadow ',
  });
  const legacyShadow = getClientEnvConfig({
    EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    EXPO_PUBLIC_SEMANTIC_PROGRAM_EDIT_DRAFT_MODE: ' shadow ',
  });
  const activeWithoutFlag = getClientEnvConfig({
    EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    EXPO_PUBLIC_COACH_SEMANTIC_PROGRAM_EDIT_MODE: 'active',
  }, { isDev: true });
  const activeOutsideDev = getClientEnvConfig({
    EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    EXPO_PUBLIC_COACH_SEMANTIC_PROGRAM_EDIT_MODE: 'active',
    EXPO_PUBLIC_COACH_SEMANTIC_PROGRAM_EDIT_DEV_ACTIVE: '1',
  }, { isDev: false });
  const activeInDev = getClientEnvConfig({
    EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    EXPO_PUBLIC_COACH_SEMANTIC_PROGRAM_EDIT_MODE: ' active ',
    EXPO_PUBLIC_COACH_SEMANTIC_PROGRAM_EDIT_DEV_ACTIVE: '1',
  }, { isDev: true });

  ok('default mode resolves off', defaultMode.semanticProgramEditDraftMode === 'off');
  ok('shadow mode can be enabled for diagnostics', shadow.semanticProgramEditDraftMode === 'shadow');
  ok('legacy shadow env still works', legacyShadow.semanticProgramEditDraftMode === 'shadow');
  ok('active without dev-active flag resolves off', activeWithoutFlag.semanticProgramEditDraftMode === 'off');
  ok('active with dev-active flag outside dev resolves off', activeOutsideDev.semanticProgramEditDraftMode === 'off');
  ok('active with dev-active flag in dev resolves active', activeInDev.semanticProgramEditDraftMode === 'active');
  ok('raw semantic mode is exposed for diagnostics', activeInDev.semanticProgramEditDraftRawMode === 'active');
  ok('activeAllowed diagnostic true only in dev-active mode', activeInDev.semanticProgramEditDraftActiveAllowed);
  ok('production active path remains impossible', !activeOutsideDev.semanticProgramEditDraftActiveAllowed);
  ok('adapter is not created for off mode', !shouldCreateSemanticProgramEditDraftAdapter('off'));
  ok('adapter is created for shadow mode', shouldCreateSemanticProgramEditDraftAdapter('shadow'));
  ok('adapter is created for dev active mode', shouldCreateSemanticProgramEditDraftAdapter('active'));
}

section('[7] CoachScreen passes resolved semantic mode wiring');
{
  const coachScreenPath = path.resolve(__dirname, '..', 'screens', 'coach', 'CoachScreen.tsx');
  const coachScreen = fs.readFileSync(coachScreenPath, 'utf8');

  ok(
    'CoachScreen creates semantic adapter through resolved-mode helper',
    /shouldCreateSemanticProgramEditDraftAdapter\(clientEnv\.semanticProgramEditDraftMode\)/.test(coachScreen),
  );
  ok(
    'CoachScreen passes resolved semantic mode to controller',
    /semanticProgramEditDraftMode:\s*clientEnv\.semanticProgramEditDraftMode/.test(coachScreen),
  );
  ok(
    'CoachScreen passes raw semantic mode diagnostics to controller',
    /semanticProgramEditDraftRawMode:\s*clientEnv\.semanticProgramEditDraftRawMode/.test(coachScreen),
  );
  ok(
    'CoachScreen passes active gate diagnostics to controller',
    /semanticProgramEditDraftActiveAllowed:\s*clientEnv\.semanticProgramEditDraftActiveAllowed/.test(coachScreen),
  );
}

console.log(`\n- Summary -`);
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);

if (fail > 0) {
  console.log(`\n- Failures -`);
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}

process.exit(0);
