/**
 * B1 canonical equipment contract across client and edge generation.
 * Run: npx sucrase-node src/__tests__/edgeGenerationEquipmentTests.ts
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  },
};

import fs from 'fs';
import path from 'path';
import type { OnboardingData } from '../types/domain';
import {
  buildProgramGenerationEdgePayload,
} from '../services/api/generateProgram';
import {
  buildTemporaryEquipmentConstraint,
  equipmentRequirementsAreAvailable,
  resolveEquipmentAvailability,
} from '../utils/equipmentAvailability';
import {
  edgeExerciseRequirementsAreAvailable,
  normalizeResolvedEquipmentTags,
} from '../../supabase/functions/shared/equipment';

const DATE = '2026-07-13';
const FULL_GYM: OnboardingData = {
  trainingLocation: 'Commercial gym',
  equipment: ['Full Gym'],
};
const BODYWEIGHT_ONLY: OnboardingData = {
  trainingLocation: 'Home gym',
  equipment: ['Bodyweight Only'],
};

let pass = 0;
let fail = 0;
const failures: string[] = [];
function section(name: string) { console.log(`\n${name}`); }
function ok(name: string, condition: boolean, detail?: unknown) {
  if (condition) { pass++; console.log(`  PASS ${name}`); }
  else {
    fail++;
    failures.push(name);
    console.log(`  FAIL ${name}${detail === undefined ? '' : ` ${JSON.stringify(detail)}`}`);
  }
}
function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value) => right.includes(value));
}

section('[1] client edge payload carries canonical resolved tags');
{
  const tags = resolveEquipmentAvailability(FULL_GYM, [], DATE);
  const payload = buildProgramGenerationEdgePayload({
    generationProfile: FULL_GYM,
    message: 'Generate the program.',
    coachingPlan: {} as any,
    resolvedEquipmentTags: tags,
  });
  ok('resolvedEquipmentTags are included in athleteProfile',
    sameSet(payload.athleteProfile.resolvedEquipmentTags, tags), payload.athleteProfile);
  ok('raw onboarding equipment remains for backward compatibility',
    payload.athleteProfile.equipment?.includes('Full Gym') === true);
}

section('[2] temporary no-barbell constraint is resolved before the edge call');
{
  const noBarbell = buildTemporaryEquipmentConstraint({
    presetId: 'no_barbell_rack',
    date: DATE,
    todayISO: DATE,
  });
  const tags = resolveEquipmentAvailability(FULL_GYM, [noBarbell], DATE);
  const payload = buildProgramGenerationEdgePayload({
    generationProfile: FULL_GYM,
    message: 'Generate the program.',
    coachingPlan: {} as any,
    resolvedEquipmentTags: tags,
  });
  ok('temporary constraint removes barbell from resolved tags', !tags.includes('barbell'), tags);
  ok('edge payload receives the constrained tags',
    !payload.athleteProfile.resolvedEquipmentTags.includes('barbell'),
    payload.athleteProfile.resolvedEquipmentTags);
}

section('[3] edge resolved tags override legacy booleans');
{
  ok('bodyweight-only tags block Barbell despite has_barbell=true',
    !edgeExerciseRequirementsAreAvailable({
      requirements: ['Barbell'],
      resolvedEquipmentTags: ['bodyweight'],
      legacyProfile: { has_barbell: true, has_dumbbells: true },
    }));
  ok('bodyweight-only tags block Rack despite has_barbell=true',
    !edgeExerciseRequirementsAreAvailable({
      requirements: ['Rack'],
      resolvedEquipmentTags: ['bodyweight'],
      legacyProfile: { has_barbell: true },
    }));
  ok('bodyweight requirements remain available',
    edgeExerciseRequirementsAreAvailable({
      requirements: ['Body Weight'],
      resolvedEquipmentTags: ['bodyweight'],
      legacyProfile: { has_barbell: false },
    }));
}

section('[4] old edge payloads keep a safe legacy fallback');
{
  ok('old profile without barbell rejects Barbell',
    !edgeExerciseRequirementsAreAvailable({
      requirements: ['Barbell'],
      legacyProfile: { has_barbell: false, has_dumbbells: true },
    }));
  ok('old profile with dumbbells allows Dumbbells',
    edgeExerciseRequirementsAreAvailable({
      requirements: ['Dumbbells'],
      legacyProfile: { has_barbell: false, has_dumbbells: true },
    }));
  ok('missing legacy boolean retains previous permissive fallback',
    edgeExerciseRequirementsAreAvailable({
      requirements: ['Barbell'],
      legacyProfile: {},
    }));
  ok('explicit empty resolved array is authoritative bodyweight-only',
    sameSet(normalizeResolvedEquipmentTags([]) ?? [], ['bodyweight']));
}

section('[5] local and edge equipment decisions agree');
{
  for (const [label, profile] of [
    ['Full Gym', FULL_GYM],
    ['Bodyweight Only', BODYWEIGHT_ONLY],
  ] as const) {
    const tags = resolveEquipmentAvailability(profile, [], DATE);
    for (const requirements of [
      [],
      ['Body Weight'],
      ['Barbell', 'Rack'],
      ['Dumbbells'],
      ['Cable Machine'],
      ['Machine'],
    ]) {
      const local = equipmentRequirementsAreAvailable(requirements, tags);
      const edge = edgeExerciseRequirementsAreAvailable({
        requirements,
        resolvedEquipmentTags: tags,
        legacyProfile: { has_barbell: true, has_dumbbells: true },
      });
      ok(`${label}: ${requirements.join('+') || 'no equipment'} agrees`, local === edge, {
        tags, requirements, local, edge,
      });
    }
  }
}

section('[6] architectural wiring guards');
{
  const clientSource = fs.readFileSync(path.resolve(__dirname, '../services/api/generateProgram.ts'), 'utf8');
  const edgeSource = fs.readFileSync(path.resolve(__dirname, '../../supabase/functions/generate-program/index.ts'), 'utf8');
  const sharedTypes = fs.readFileSync(path.resolve(__dirname, '../../supabase/functions/shared/types.ts'), 'utf8');
  ok('live full-generation request uses the shared payload builder',
    /const requestBody = buildProgramGenerationEdgePayload\(/.test(clientSource));
  ok('legacy generate-program request schema accepts resolvedEquipmentTags',
    /GenerateProgramRequest[\s\S]{0,300}resolvedEquipmentTags\?/.test(sharedTypes));
  ok('legacy edge normalizes resolvedEquipmentTags from the request',
    /normalizeResolvedEquipmentTags\(body\.resolvedEquipmentTags\)/.test(edgeSource));
  ok('legacy edge passes resolved tags into exercise selection',
    /preSelectExercisesForMiniCycle\([\s\S]{0,400}resolvedEquipmentTags/.test(edgeSource));
  ok('legacy edge filter uses the shared canonical equipment gate',
    /edgeExerciseRequirementsAreAvailable\(\{[\s\S]{0,250}resolvedEquipmentTags/.test(edgeSource));
}

console.log(`\nedgeGenerationEquipmentTests: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.error(failures.map((failure) => `  - ${failure}`).join('\n'));
  process.exit(1);
}
