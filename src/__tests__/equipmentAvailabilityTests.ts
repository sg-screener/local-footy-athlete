/**
 * Canonical equipment availability resolver tests.
 *
 * Run: npx sucrase-node src/__tests__/equipmentAvailabilityTests.ts
 */

(global as any).window = {
  localStorage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  },
};

import type { OnboardingData } from '../types/domain';
import {
  EQUIPMENT_CHECKLIST_OPTION_TAGS,
  FULL_GYM_EQUIPMENT,
  TEMPORARY_EQUIPMENT_PRESETS,
  buildBaselineEquipmentSavePlan,
  buildActiveEquipmentConstraint,
  buildTemporaryEquipmentConstraint,
  equipmentTagsToSubstituteEquipmentClasses,
  resolveEquipmentAvailability,
  resolveEquipmentCapabilities,
  saveBaselineEquipmentSelection,
} from '../utils/equipmentAvailability';
import { buildProgramGenerationRequestDiagnostics } from '../services/api/generateProgram';
import { useCoachUpdatesStore, type ActiveEquipmentConstraint } from '../store/coachUpdatesStore';
import { selectActiveCoachNotes } from '../utils/activeCoachNotes';

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

  const legacyCommercial = resolveEquipmentCapabilities({
    trainingLocation: 'Commercial gym',
    equipment: ['barbell', 'dumbbells', 'squat_rack', 'cable_machine', 'bands'],
  });
  assert(
    legacyCommercial.source === 'legacy_positive_plus_location' &&
      sameSet(legacyCommercial.conditioningModalities, ['bike', 'row', 'ski', 'treadmill']),
    'legacy positive Commercial-gym checklist is supplemented by location capabilities',
  );

  const completeNoCardio = resolveEquipmentCapabilities({
    trainingLocation: 'Commercial gym',
    equipment: ['Dumbbells Only'],
    equipmentSelectionCompleteness: 'complete',
  });
  assert(
    completeNoCardio.conditioningModalities.length === 0 &&
      !completeNoCardio.tags.includes('bike_or_treadmill'),
    'complete no-cardio selection outranks Commercial-gym location baseline',
  );

  const rowOnly = resolveEquipmentCapabilities({
    trainingLocation: 'Commercial gym',
    equipment: ['RowErg'],
    equipmentSelectionCompleteness: 'complete',
  });
  assert(
    sameSet(rowOnly.conditioningModalities, ['row']),
    'complete RowErg-only selection exposes exactly one off-feet modality',
  );
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

section('5. Equipment constraints apply to availability');
{
  const profile: OnboardingData = {
    trainingLocation: 'Commercial gym',
    equipment: ['Full Gym'],
  };
  const onlyDb: ActiveEquipmentConstraint = buildActiveEquipmentConstraint({
    id: 'equipment-db-only',
    mode: 'only',
    tags: ['dumbbells'],
    source: 'chat',
    nowISO: '2026-04-22T09:00:00.000Z',
    scope: 'this_week',
    modifierAffects: ['current_week'],
  });
  const resolvedOnly = resolveEquipmentAvailability(profile, [onlyDb], '2026-04-23');
  assert(
    sameSet(resolvedOnly, ['bodyweight', 'dumbbells']),
    `mode=only restricts to bodyweight + selected tags (got ${resolvedOnly.join(', ')})`,
  );
  assert(
    onlyDb.expiresAt === '2026-04-26',
    `this-week equipment constraint expires Sunday (got ${onlyDb.expiresAt})`,
  );

  const withoutBarbellMachines = buildActiveEquipmentConstraint({
    id: 'equipment-no-barbell-machines',
    mode: 'without',
    tags: ['barbell', 'machine', 'bodyweight'],
    source: 'tap',
    nowISO: '2026-04-22T09:00:00.000Z',
    scope: 'open_ended',
  });
  const resolvedWithout = resolveEquipmentAvailability(profile, [withoutBarbellMachines], '2026-05-20');
  assert(resolvedWithout.includes('bodyweight'), 'bodyweight remains available even if a without constraint names it');
  assert(!resolvedWithout.includes('barbell'), 'mode=without subtracts unavailable barbell');
  assert(!resolvedWithout.includes('machine'), 'mode=without subtracts unavailable machine');
  assert(resolvedWithout.includes('dumbbells'), 'mode=without keeps unrelated baseline equipment');

  const noCardio = buildTemporaryEquipmentConstraint({
    presetId: 'no_erg_cardio',
    date: '2026-04-23',
    todayISO: '2026-04-23T09:00:00.000Z',
  });
  const constrainedCapabilities = resolveEquipmentCapabilities(profile, [noCardio], '2026-04-23');
  assert(
    constrainedCapabilities.conditioningModalities.length === 0,
    'temporary no-cardio constraint overrides Full Gym conditioning capabilities',
  );
  const restoredCapabilities = resolveEquipmentCapabilities(profile, [], '2026-04-23');
  assert(
    sameSet(restoredCapabilities.conditioningModalities, ['bike', 'row', 'ski', 'treadmill']),
    'clearing temporary no-cardio constraint restores baseline modalities',
  );
}

section('5b. Temporary equipment preset mapping');
{
  const date = '2026-04-22';
  const expected = {
    bodyweight_only: { mode: 'only', tags: ['bodyweight'] },
    dumbbells_only: { mode: 'only', tags: ['bodyweight', 'dumbbells'] },
    home_hotel_gym: { mode: 'only', tags: ['bodyweight', 'dumbbells', 'bands'] },
    no_barbell_rack: { mode: 'without', tags: ['barbell'] },
    no_machines_cables: { mode: 'without', tags: ['machine', 'cables'] },
    no_erg_cardio: { mode: 'without', tags: ['bike_or_treadmill'] },
  } as const;
  for (const [presetId, expectation] of Object.entries(expected)) {
    const constraint = buildTemporaryEquipmentConstraint({
      presetId: presetId as keyof typeof expected,
      date,
      todayISO: `${date}T09:00:00.000Z`,
    });
    assert(
      constraint.mode === expectation.mode,
      `${presetId} uses mode ${expectation.mode}`,
    );
    assert(
      sameSet(constraint.tags as readonly string[], expectation.tags),
      `${presetId} uses canonical tags ${expectation.tags.join(', ')}`,
    );
    assert(
      constraint.expiresAt === '2026-04-26',
      `${presetId} expires at selected week end`,
    );
  }
  assert(
    TEMPORARY_EQUIPMENT_PRESETS.some((preset) => preset.id === 'back_to_normal' && preset.clearsActiveEquipment),
    'Back to normal preset clears active equipment constraints',
  );
}

section('6. Equipment constraint expiry lifecycle');
{
  const profile: OnboardingData = {
    trainingLocation: 'Commercial gym',
    equipment: ['Full Gym'],
  };
  const weekOnly = buildActiveEquipmentConstraint({
    id: 'equipment-week-only',
    mode: 'only',
    tags: ['dumbbells'],
    source: 'chat',
    nowISO: '2026-04-22T09:00:00.000Z',
    scope: 'this_week',
  });
  assert(
    resolveEquipmentAvailability(profile, [weekOnly], '2026-04-26').includes('dumbbells') &&
      !resolveEquipmentAvailability(profile, [weekOnly], '2026-04-26').includes('barbell'),
    'this-week constraint applies through week end',
  );
  const afterWeek = resolveEquipmentAvailability(profile, [weekOnly], '2026-04-27');
  assert(afterWeek.includes('barbell'), 'expired this-week constraint no longer affects next week');

  const awayRange = buildActiveEquipmentConstraint({
    id: 'equipment-away-range',
    mode: 'only',
    tags: ['bodyweight', 'bands'],
    source: 'system',
    nowISO: '2026-05-01T09:00:00.000Z',
    scope: 'date_range',
    rangeEndDate: '2026-05-10',
  });
  assert(awayRange.expiresAt === '2026-05-10', `away-range expires at range end (got ${awayRange.expiresAt})`);
  assert(!resolveEquipmentAvailability(profile, [awayRange], '2026-05-10').includes('barbell'),
    'away-range applies on range end date');
  assert(resolveEquipmentAvailability(profile, [awayRange], '2026-05-11').includes('barbell'),
    'away-range no longer affects after range end');

  const openEnded = buildActiveEquipmentConstraint({
    id: 'equipment-open-ended',
    mode: 'without',
    tags: ['barbell'],
    source: 'chat',
    nowISO: '2026-04-22T09:00:00.000Z',
    scope: 'open_ended',
  });
  assert(openEnded.expiresAt === undefined, 'open-ended equipment constraint has no auto expiry');
  assert(!resolveEquipmentAvailability(profile, [openEnded], '2026-10-01').includes('barbell'),
    'open-ended equipment constraint persists until cleared');

  const futureStart = buildActiveEquipmentConstraint({
    id: 'equipment-future-start',
    mode: 'only',
    tags: ['bands'],
    source: 'system',
    startDate: '2026-06-01',
    nowISO: '2026-05-20T09:00:00.000Z',
    scope: 'open_ended',
  });
  assert(resolveEquipmentAvailability(profile, [futureStart], '2026-05-31').includes('barbell'),
    'future-start equipment constraint does not affect dates before startDate');
  assert(!resolveEquipmentAvailability(profile, [futureStart], '2026-06-01').includes('barbell'),
    'future-start equipment constraint applies on startDate');
}

section('7. Store lifecycle and modifier metadata');
{
  const profile: OnboardingData = {
    trainingLocation: 'Commercial gym',
    equipment: ['Full Gym'],
  };
  useCoachUpdatesStore.getState().setActiveConstraints([]);
  const constraint = buildActiveEquipmentConstraint({
    id: 'equipment-store-db-only',
    mode: 'only',
    tags: ['dumbbells'],
    source: 'chat',
    nowISO: '2026-04-22T09:00:00.000Z',
    scope: 'this_week',
    modifierAffects: ['current_week'],
  });
  useCoachUpdatesStore.getState().upsertActiveConstraint(constraint);
  const stored = useCoachUpdatesStore.getState().activeConstraints[0];
  assert(stored?.type === 'equipment', 'equipment constraint type is accepted by store');
  assert(
    sameSet((stored as ActiveEquipmentConstraint).modifierAffects, ['current_week']),
    'store preserves provided equipment modifierAffects',
  );
  const constrained = resolveEquipmentAvailability(
    profile,
    useCoachUpdatesStore.getState().activeConstraints,
    '2026-04-23',
  );
  assert(!constrained.includes('barbell'), 'stored equipment constraint affects resolver');
  useCoachUpdatesStore.getState().removeActiveConstraint('equipment-store-db-only');
  const restored = resolveEquipmentAvailability(
    profile,
    useCoachUpdatesStore.getState().activeConstraints,
    '2026-04-23',
  );
  assert(restored.includes('barbell'), 'clearing equipment constraint restores baseline availability');

  const missingAffects = {
    ...buildActiveEquipmentConstraint({
      id: 'equipment-default-affects',
      mode: 'without',
      tags: ['barbell'],
      source: 'system',
      nowISO: '2026-04-22T09:00:00.000Z',
      scope: 'open_ended',
    }),
    modifierAffects: undefined,
  } as any;
  useCoachUpdatesStore.getState().upsertActiveConstraint(missingAffects);
  const defaulted = useCoachUpdatesStore.getState().activeConstraints
    .find((c) => c.id === 'equipment-default-affects') as ActiveEquipmentConstraint | undefined;
  assert(
    sameSet(defaulted?.modifierAffects ?? [], ['current_week', 'future_generation']),
    'store defaults missing equipment modifierAffects to visible current/future metadata',
  );
  useCoachUpdatesStore.getState().setActiveConstraints([]);
}

section('8. Baseline equipment save/rebuild behaviour');
{
  const date = '2026-04-22';
  const baseline: OnboardingData = {
    trainingLocation: 'Commercial gym',
    equipment: ['Full Gym'],
  };
  let updatedEquipment: string[] | undefined;
  let refreshedProfile: OnboardingData | undefined;
  const changed = saveBaselineEquipmentSelection({
    profile: baseline,
    selectedEquipment: ['Dumbbells Only'],
    dateISO: date,
    updateOnboardingData: (data) => {
      updatedEquipment = data.equipment;
    },
    refreshProgram: (nextProfile) => {
      refreshedProfile = nextProfile;
    },
  });
  assert(changed.profileUpdated === true, 'changing baseline equipment updates profile/onboarding equipment');
  assert(changed.rebuildRequired === true, 'changed resolved baseline equipment requires rebuild');
  assert(changed.refreshed === true, 'changed resolved baseline equipment triggers refresh callback');
  assert(sameSet(updatedEquipment ?? [], ['Dumbbells Only']), 'profile save writes selected equipment checklist');
  assert(sameSet(refreshedProfile?.equipment ?? [], ['Dumbbells Only']), 'refresh receives patched profile');

  let unchangedRefreshCalled = false;
  const unchanged = saveBaselineEquipmentSelection({
    profile: { trainingLocation: 'Commercial gym', equipment: ['dumbbells'] },
    selectedEquipment: ['Dumbbells Only'],
    dateISO: date,
    updateOnboardingData: () => undefined,
    refreshProgram: () => {
      unchangedRefreshCalled = true;
    },
  });
  assert(unchanged.rebuildRequired === true, 'modern exhaustive save replaces ambiguous legacy positive baseline');
  assert(unchangedRefreshCalled === true, 'legacy-to-modern capability change refreshes program');
  assert(unchanged.message === 'Equipment updated. Your program was refreshed.', 'legacy-to-modern save reports refresh');
  assert(
    unchanged.nextProfile.equipmentSelectionCompleteness === 'complete',
    'modern equipment save records authoritative completeness',
  );

  useCoachUpdatesStore.getState().setActiveConstraints([]);
  const plan = buildBaselineEquipmentSavePlan(baseline, ['Bodyweight Only'], date);
  assert(plan.rebuildRequired === true, 'baseline bodyweight change is meaningful');
  assert(
    selectActiveCoachNotes({
      activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
      onboardingData: plan.nextProfile,
      todayISO: date,
    }).length === 0,
    'baseline equipment change does not create persistent Coach Note',
  );
  assert(
    useCoachUpdatesStore.getState().activeConstraints.every((constraint) => constraint.type !== 'equipment'),
    'baseline equipment change does not create active equipment constraint',
  );

  const temporary = buildTemporaryEquipmentConstraint({
    presetId: 'bodyweight_only',
    date,
    todayISO: `${date}T09:00:00.000Z`,
  });
  useCoachUpdatesStore.getState().setActiveConstraints([temporary]);
  const savedWithTemporary = saveBaselineEquipmentSelection({
    profile: baseline,
    selectedEquipment: ['Full Gym'],
    dateISO: date,
    updateOnboardingData: () => undefined,
    refreshProgram: () => undefined,
  });
  assert(
    useCoachUpdatesStore.getState().activeConstraints.some((constraint) => constraint.id === temporary.id),
    'active temporary equipment constraint survives baseline save',
  );
  assert(
    sameSet(
      resolveEquipmentAvailability(
        savedWithTemporary.nextProfile,
        useCoachUpdatesStore.getState().activeConstraints,
        date,
      ),
      ['bodyweight'],
    ),
    'resolved availability after baseline save still applies live temporary constraint',
  );
  useCoachUpdatesStore.getState().setActiveConstraints([]);
}

console.log(`\n[equipmentAvailability] ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
