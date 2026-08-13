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
// TOTALS-OR-RED (Sam, 2026-08-03): born failing, cleared only by the printed
// totals. Added when this suite was wired into test:bible — an unarmed suite
// in the chain exits 0 on a drained loop and the chain calls that green.
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
armTotalsOrRed();
import {
  buildProgramGenerationEdgePayload,
} from '../services/api/generateProgram';
import {
  buildActiveEquipmentConstraint,
  temporaryEquipmentConstraintIdForDate,
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
  const noBarbell = buildActiveEquipmentConstraint({
    id: temporaryEquipmentConstraintIdForDate(DATE),
    mode: 'without',
    tags: ['barbell'],
    source: 'tap',
    startDate: DATE,
    nowISO: DATE,
    scope: 'this_week',
    modifierAffects: ['current_week'],
    reasonLabel: 'Missing this week',
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
  // The legacy `generate-program` edge function was DELETED by the Phase 1.6
  // purge (2026-07-25) — confirmed dead by import graph and it still named 21
  // exercises Sam had retired. The four assertions that pinned its request
  // schema went with it; only the live client wiring is still a real contract.
  const clientSource = fs.readFileSync(path.resolve(__dirname, '../services/api/generateProgram.ts'), 'utf8');
  ok('live full-generation request uses the shared payload builder',
    /const requestBody = buildProgramGenerationEdgePayload\(/.test(clientSource));
}

/* ── LOAD IS NOT AVAILABILITY — R-083's second site, per row ───────────────
 *
 * Sam set this acceptance test himself, 2026-08-13: *"Prove it per row on a
 * bodyweight kit: Pull-Ups must read illegal, Walking Lunges and Single Leg
 * RDL must read legal."*
 *
 * IT IS A PER-ROW TABLE ON PURPOSE. The defect being closed was one field
 * answering two questions, and it was wrong in BOTH directions at once — so a
 * cell that only checked the illegal side would have passed on the old,
 * conflated field. **Every row therefore carries its bodyweight verdict AND a
 * full-gym control**, and the two directions are asserted separately below so
 * a regression names which way it went.
 */
{
  const { exerciseAllowedByEquipment } =
    require('../data/exercisePoolsStrength') as typeof import('../data/exercisePoolsStrength');
  const BODYWEIGHT = ['bodyweight'] as never;
  const FULL_GYM = [
    'bodyweight', 'dumbbells', 'barbell', 'rack', 'bench', 'pullup_bar', 'dip_bars',
    'rings_trx', 'machine', 'cables', 'kettlebell', 'plyo_box', 'bands',
  ] as never;

  // The three Sam named, then the rest of R-083's family, then the controls
  // that must NOT have been swept up.
  const ROWS: readonly { name: string; legalOnBodyweight: boolean; why: string }[] = [
    { name: 'Pull-Ups', legalOnBodyweight: false, why: 'no load, but needs a BAR — the wrong direction the old field got wrong' },
    { name: 'Walking Lunges', legalOnBodyweight: true, why: 'classed `dumbbell` for LOAD, still a walking lunge without them' },
    { name: 'Single-Leg RDL', legalOnBodyweight: true, why: 'authored `barbell`, and Sam ruled it performable unloaded' },
    { name: 'Dips', legalOnBodyweight: false, why: 'no load, needs dip bars' },
    { name: 'Inverted Row (Bodyweight)', legalOnBodyweight: false, why: 'no load, needs rings/TRX — R-083 closes the horizontal pull' },
    { name: 'Overhead Press', legalOnBodyweight: false, why: 'R-083: no vertical push on a bodyweight kit' },
    { name: 'Leg Extension', legalOnBodyweight: false, why: 'machine' },
    { name: 'Back Squat', legalOnBodyweight: false, why: 'needs a rack' },
    { name: 'Reverse Lunges', legalOnBodyweight: true, why: 'authored as needing nothing' },
    { name: 'Push-ups', legalOnBodyweight: true, why: 'control — a true bodyweight row must survive' },
    { name: 'Bodyweight Squat', legalOnBodyweight: true, why: 'control' },
  ];

  for (const row of ROWS) {
    const onBodyweight = exerciseAllowedByEquipment(row.name, BODYWEIGHT);
    ok(
      `[avail] '${row.name}' is ${row.legalOnBodyweight ? 'LEGAL' : 'ILLEGAL'} on a bodyweight kit — ${row.why}`,
      onBodyweight === row.legalOnBodyweight,
      { got: onBodyweight, want: row.legalOnBodyweight },
    );
  }

  // THE CONTROL ARM. Without it the table above passes on a filter that
  // refuses everything, which is the failure mode this whole unit produced
  // once already (a week thinned to 8 rows and the census read a happy zero).
  const illegalInGym = ROWS
    .map((row) => row.name)
    .filter((name) => !exerciseAllowedByEquipment(name, FULL_GYM));
  ok('[avail] every row above is LEGAL on a full gym — the filter refuses kit, not exercises',
    illegalInGym.length === 0, illegalInGym);

  // NON-VACUITY: the table must actually contain both verdicts, or it is
  // asserting one thing twice.
  ok('[avail] the table asserts BOTH directions (the old field was wrong both ways)',
    ROWS.some((r) => r.legalOnBodyweight) && ROWS.some((r) => !r.legalOnBodyweight));
}

console.log(`\nedgeGenerationEquipmentTests: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
if (fail > 0) {
  console.error(failures.map((failure) => `  - ${failure}`).join('\n'));
  process.exit(1);
}
