/**
 * Canonical equipment availability resolver tests.
 *
 * Run: npx sucrase-node src/__tests__/equipmentAvailabilityTests.ts
 */

import type { OnboardingData } from '../types/domain';
import {
  EQUIPMENT_CHECKLIST_OPTION_TAGS,
  FULL_GYM_EQUIPMENT,
  equipmentTagsToSubstituteEquipmentClasses,
  resolveEquipmentAvailability,
} from '../utils/equipmentAvailability';
import { buildProgramGenerationRequestDiagnostics } from '../services/api/generateProgram';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function assert(condition: boolean, msg: string): void {
  if (condition) {
    pass++;
  } else {
    fail++;
    failures.push(msg);
    console.error(`  FAIL: ${msg}`);
  }
}

function sameSet<T>(actual: readonly T[], expected: readonly T[]): boolean {
  return actual.length === expected.length && expected.every((item) => actual.includes(item));
}

function section(title: string): void {
  console.log(`\n=== ${title} ===`);
}

const currentOptions: Array<[string, readonly string[]]> = [
  ['Full Gym', FULL_GYM_EQUIPMENT],
  ['Home Gym', ['bodyweight', 'dumbbells', 'bands', 'foam_roller', 'kettlebell']],
  ['Barbell & Rack', ['bodyweight', 'barbell']],
  ['Dumbbells Only', ['bodyweight', 'dumbbells']],
  ['Bodyweight Only', ['bodyweight']],
  ['Resistance Bands', ['bodyweight', 'bands']],
  ['Kettlebells', ['bodyweight', 'kettlebell']],
  ['Cable Machine', ['bodyweight', 'cables']],
  ['Pull-up Bar', ['bodyweight', 'pullup_bar']],
];

section('1. Current checklist option mapping');
{
  for (const [option, expected] of currentOptions) {
    assert(
      EQUIPMENT_CHECKLIST_OPTION_TAGS[option] !== undefined,
      `mapping exists for current option "${option}"`,
    );
    const resolved = resolveEquipmentAvailability({
      trainingLocation: 'Commercial gym',
      equipment: [option],
    });
    assert(
      sameSet(resolved, expected as any),
      `${option} resolves to ${expected.join(', ')} (got ${resolved.join(', ')})`,
    );
  }
}

section('2. Fallback and bodyweight invariants');
{
  const outdoor = resolveEquipmentAvailability({
    trainingLocation: 'Outdoor',
    equipment: [],
  });
  assert(outdoor.includes('bodyweight'), 'bodyweight is included for empty checklist fallback');
  assert(outdoor.includes('bands'), 'empty checklist falls back to inferEquipment(trainingLocation)');
  assert(!outdoor.includes('barbell'), 'Outdoor fallback does not invent barbell');

  const absent = resolveEquipmentAvailability({
    trainingLocation: 'Home gym',
  });
  assert(absent.includes('bodyweight'), 'bodyweight is included when checklist is absent');
  assert(absent.includes('kettlebell'), 'absent checklist falls back to Home gym inference');

  const legacy = resolveEquipmentAvailability({
    trainingLocation: 'Outdoor',
    equipment: ['barbell', 'dumbbells', 'cable_machine', 'hamstring_curl', 'bands'],
  });
  assert(legacy.includes('barbell'), 'legacy barbell checklist value maps to barbell');
  assert(legacy.includes('dumbbells'), 'legacy dumbbells checklist value maps to dumbbells');
  assert(legacy.includes('cables'), 'legacy cable_machine checklist value maps to cables');
  assert(legacy.includes('machine'), 'legacy machine-specific checklist value maps to machine');
  assert(legacy.includes('bands'), 'legacy bands checklist value maps to bands');
}

section('3. Full gym and substitution class bridge');
{
  const full = resolveEquipmentAvailability({
    trainingLocation: 'Outdoor',
    equipment: ['Full Gym'],
  });
  assert(sameSet(full, FULL_GYM_EQUIPMENT), 'Full Gym maps to the broad gym equipment superset');

  const classes = equipmentTagsToSubstituteEquipmentClasses(
    resolveEquipmentAvailability({
      trainingLocation: 'Commercial gym',
      equipment: ['Dumbbells Only'],
    }),
  );
  assert(
    sameSet(classes, ['bodyweight', 'dumbbell']),
    `Dumbbells Only bridges to bodyweight + dumbbell classes (got ${classes.join(', ')})`,
  );
}

section('4. Generation diagnostics serialize resolved equipment');
{
  const profile: OnboardingData = {
    firstName: 'Sam',
    position: 'inside_mid',
    motivation: 'Strength',
    heightCm: 182,
    weightKg: 82,
    seasonPhase: 'Off-season',
    trainingDaysPerWeek: 3,
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
    sessionDurationMinutes: 60,
    trainingLocation: 'Commercial gym',
    equipment: ['Dumbbells Only'],
    experienceLevel: '2-5 years',
    squatStrength: 'Around bodyweight',
    benchStrength: 'Around bodyweight',
    conditioningLevel: 'Average',
    sprintExposure: 'Occasionally',
    recentTrainingLoad: 'Pretty consistent',
    injuries: [],
  };
  const plan: any = {
    readiness: 'medium',
    coreSessions: 2,
    optionalSessions: 1,
    recoverySessions: 1,
    weeklyPlan: [],
    constraints: { notes: [] },
  };
  const diagnostics = buildProgramGenerationRequestDiagnostics(
    profile,
    plan,
    'test message',
    { coachChatEndpoint: 'test' } as any,
    ['bodyweight', 'dumbbells'],
  ) as any;
  assert(
    sameSet(diagnostics.profile.summary.resolvedEquipmentTags, ['bodyweight', 'dumbbells']),
    'generation diagnostics include resolvedEquipmentTags in profile summary',
  );
  assert(
    JSON.stringify(diagnostics).includes('resolvedEquipmentTags'),
    'generation diagnostics payload serializes resolvedEquipmentTags',
  );
}

console.log(`\n[equipmentAvailability] ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
