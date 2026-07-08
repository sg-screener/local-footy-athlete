/**
 * Role bucket formatter/compatibility tests.
 *
 * Run: npx sucrase-node src/__tests__/roleBucketsTests.ts
 */

import {
  ROLE_BUCKET_OPTIONS,
  getProgrammingRoleBias,
  normalizeOnboardingRole,
  normalizeRoleBucket,
  roleBucketLabel,
} from '../utils/roleBuckets';
import { buildProgramGenerationRequestDiagnostics } from '../services/api/generateProgram';
import type { OnboardingData } from '../types/domain';

const fs = require('fs');
const path = require('path');

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    pass++;
    console.log(`  PASS ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  FAIL ${name}${detail ? `\n      ${JSON.stringify(detail)}` : ''}`);
  }
}

function eq<T>(name: string, actual: T, expected: T) {
  ok(name, actual === expected, { actual, expected });
}

function eqJson<T>(name: string, actual: T, expected: T) {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected });
}

function section(label: string) {
  console.log(`\n${label}`);
}

section('[0] visible role options');
eq('five visible role options', ROLE_BUCKET_OPTIONS.length, 5);
eqJson('visible role option labels', ROLE_BUCKET_OPTIONS.map((option) => option.label), [
  'Inside mid',
  'Outside mid',
  'Key position / ruck',
  'High forward / back',
  'Small forward / back',
]);
eqJson('stored role option ids', ROLE_BUCKET_OPTIONS.map((option) => option.id), [
  'inside_mid',
  'outside_runner',
  'key_position_ruck_tall',
  'high_forward_back',
  'small_forward_back',
]);

section('[1] legacy exact positions map to role buckets');
eq('Small back -> small_forward_back', normalizeRoleBucket('Small back'), 'small_forward_back');
eq('Small forward -> small_forward_back', normalizeRoleBucket('Small forward'), 'small_forward_back');
eq('Key back -> key_position_ruck_tall', normalizeRoleBucket('Key back'), 'key_position_ruck_tall');
eq('Key forward -> key_position_ruck_tall', normalizeRoleBucket('Key forward'), 'key_position_ruck_tall');
eq('Ruck -> key_position_ruck_tall', normalizeRoleBucket('Ruck'), 'key_position_ruck_tall');
eq('Midfielder -> inside_mid', normalizeRoleBucket('Midfielder'), 'inside_mid');

section('[2] new labels and variants map cleanly');
eq('inside_mid remains inside_mid', normalizeRoleBucket('inside_mid'), 'inside_mid');
eq('Inside mid label maps', normalizeRoleBucket('Inside mid'), 'inside_mid');
eq('outside_runner remains outside_runner', normalizeRoleBucket('outside_runner'), 'outside_runner');
eq('outside runner label maps', normalizeRoleBucket('Outside runner'), 'outside_runner');
eq('Outside mid label maps', normalizeRoleBucket('Outside mid'), 'outside_runner');
eq('high_forward_back remains high_forward_back', normalizeRoleBucket('high_forward_back'), 'high_forward_back');
eq('High forward / back label maps', normalizeRoleBucket('High forward / back'), 'high_forward_back');
eq('Key position / ruck label maps', normalizeRoleBucket('Key position / ruck'), 'key_position_ruck_tall');
eq('key-position-ruck variant maps', normalizeRoleBucket('key-position-ruck'), 'key_position_ruck_tall');
eq('Small forward / back label maps', normalizeRoleBucket('Small forward / back'), 'small_forward_back');
eq('small-forward-back variant maps', normalizeRoleBucket('small-forward-back'), 'small_forward_back');

section('[3] labels are user-facing');
eq('inside_mid label', roleBucketLabel('inside_mid'), 'Inside mid');
eq('outside_runner label', roleBucketLabel('outside_runner'), 'Outside mid');
eq('key_position_ruck_tall label', roleBucketLabel('key_position_ruck_tall'), 'Key position / ruck');
eq('high_forward_back label', roleBucketLabel('high_forward_back'), 'High forward / back');
eq('small_forward_back label', roleBucketLabel('small_forward_back'), 'Small forward / back');
eq('legacy label formats through mapper', roleBucketLabel('Midfielder'), 'Inside mid');
eq('legacy outside runner displays as outside mid', roleBucketLabel('Outside runner'), 'Outside mid');

section('[3b] programming bias stays simple');
eq('Inside mid bias', getProgrammingRoleBias('inside_mid'), 'inside_mid');
eq('Outside mid bias', getProgrammingRoleBias('outside_runner'), 'outside_runner');
eq('High forward / back bias', getProgrammingRoleBias('high_forward_back'), 'outside_runner');
eq('Key position / ruck bias', getProgrammingRoleBias('key_position_ruck_tall'), 'key_position_ruck_tall');
eq('Small forward / back bias', getProgrammingRoleBias('small_forward_back'), 'small_forward_back');

section('[4] defensive fallback');
eq('unknown -> inside_mid', normalizeRoleBucket('utility half forward'), 'inside_mid');
eq('empty -> inside_mid', normalizeRoleBucket(''), 'inside_mid');
eq('null -> inside_mid', normalizeRoleBucket(null), 'inside_mid');

section('[5] onboarding storage normalization');
{
  const normalized = normalizeOnboardingRole({
    firstName: 'Sam',
    position: 'Small forward',
  });
  eq('legacy onboarding role normalized', normalized.position, 'small_forward_back');
}
{
  const normalized = normalizeOnboardingRole({
    firstName: 'Sam',
    position: 'outside_runner',
  });
  eq('canonical onboarding role stays canonical', normalized.position, 'outside_runner');
}
{
  const normalized = normalizeOnboardingRole({
    firstName: 'Sam',
    position: 'high_forward_back',
  });
  eq('high forward/back onboarding role stays canonical', normalized.position, 'high_forward_back');
}

section('[6] program generation diagnostics include role bias');
{
  const profile: OnboardingData = {
    firstName: 'Sam',
    heightCm: 184,
    weightKg: 90,
    position: 'high_forward_back',
    motivation: 'Get fitter',
    goals: ['Get fitter'],
    seasonPhase: 'Pre-season',
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    trainingDaysPerWeek: 4,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
    sessionDurationMinutes: 60,
    trainingLocation: 'Commercial gym',
    equipment: ['barbell'],
    experienceLevel: '2-5 years',
    squatStrength: 'Around bodyweight',
    benchStrength: 'Around bodyweight',
    conditioningLevel: 'Good',
    sprintExposure: 'Occasionally',
    recentTrainingLoad: 'Pretty consistent',
    injuries: [],
  };
  const diagnostics = buildProgramGenerationRequestDiagnostics(
    profile,
    undefined,
    undefined,
    {
      isReady: true,
      missing: [],
      coachChatEndpoint: 'https://example.test/functions/v1/coach-chat',
      supabaseAnonKey: 'anon',
    } as any,
  );
  const summary = (diagnostics.profile as any).summary;
  eq('diagnostics selected role', summary.selectedRole, 'high_forward_back');
  eq('diagnostics selected role label', summary.selectedRoleLabel, 'High forward / back');
  eq('diagnostics programming bias', summary.programmingRoleBias, 'outside_runner');
}

section('[7] onboarding role screen layout is a 5-item vertical list');
{
  const src = fs.readFileSync(
    path.join(__dirname, '../screens/onboarding/PositionScreen.tsx'),
    'utf8',
  );
  ok('screen renders shared role labels, not raw enum ids', /\{role\.label\}/.test(src));
  ok('screen maps all shared role options', /ROLE_OPTIONS\.map/.test(src));
  ok('screen title is fixed uppercase copy', /WHAT FOOTY ROLE FITS YOU BEST\?/.test(src));
  ok('screen subtitle is fixed copy', /Your role gives LFA a small programming bias\./.test(src));
  ok('screen uses vertical list style', /<View style=\{styles\.list\}>/.test(src));
  ok('screen does not render old grid style', !/styles\.grid/.test(src));
  ok('screen does not use wrapping row grid', !/flexWrap:\s*['"]wrap['"]/.test(src));
  ok('screen does not use 2-column flex basis', !/flexBasis:\s*['"]48\.5%['"]/.test(src));
  ok('role cards are full width', /width:\s*['"]100%['"]/.test(src));
  ok('combined outside/high label is not in screen source', !/Outside mid \/ high fwd \/ high back/.test(src));
}

console.log(`\nSummary: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  failures.forEach((name) => console.log(`  - ${name}`));
  process.exit(1);
}
