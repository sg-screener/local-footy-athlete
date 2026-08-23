/** Release client configuration guardrails after the Coach clean-room cut. */

import * as fs from 'fs';
import * as path from 'path';
import {
  buildMailto,
  describeMissingClientEnv,
  getClientEnvConfig,
} from '../config/env';

let passed = 0;
let failed = 0;

function check(name: string, condition: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL ${name}`);
}

const normal = getClientEnvConfig({
  EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co/',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
});
check('required public configuration is ready', normal.isReady);
check('Supabase URL is normalised', normal.supabaseUrl === 'https://project.supabase.co');
check('the generic functions base remains available',
  normal.supabaseFunctionsBaseUrl === 'https://project.supabase.co/functions/v1');
check('the public anon key is read', normal.supabaseAnonKey === 'anon-key');

const alias = getClientEnvConfig({
  EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
  EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL: 'https://edge.example.com/functions/v1/',
});
check('the publishable-key alias remains supported', alias.supabaseAnonKey === 'publishable-key');
check('a custom functions base is normalised',
  alias.supabaseFunctionsBaseUrl === 'https://edge.example.com/functions/v1');

const missing = getClientEnvConfig({});
check('missing required values keep configuration unready', !missing.isReady);
check('missing configuration names both required public values',
  describeMissingClientEnv(missing).includes('EXPO_PUBLIC_SUPABASE_URL') &&
  describeMissingClientEnv(missing).includes('EXPO_PUBLIC_SUPABASE_ANON_KEY'));

check('mailto subjects are encoded',
  buildMailto('support@example.com', 'LFA feedback & help') ===
    'mailto:support@example.com?subject=LFA%20feedback%20%26%20help');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'config', 'env.ts'), 'utf8');
check('the client configuration contains no private AI key names',
  !/ANTHROPIC|OPENAI/.test(source));
check('the client configuration exposes no retired Coach endpoint or mode',
  !/coachChat|coachIntent|semanticProgramEdit|coachRevisionProposal/i.test(source));

console.log(`\nEnvironment configuration: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
