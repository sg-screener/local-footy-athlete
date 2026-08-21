/**
 * Canonical equipment availability resolver tests.
 *
 * Run: npx sucrase-node src/__tests__/equipmentAvailabilityTests.ts
 */

const memory = new Map<string, string>();
(global as any).window = {
  localStorage: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value); },
    removeItem: (key: string) => { memory.delete(key); },
  },
};

import type { OnboardingData } from '../types/domain';
import {
  EQUIPMENT_CHECKLIST_OPTION_TAGS,
  FULL_GYM_EQUIPMENT,
  buildActiveEquipmentConstraint,
  temporaryEquipmentConstraintIdForDate,
  equipmentTagsToSubstituteEquipmentClasses,
  resolveEquipmentAvailability,
  resolveEquipmentCapabilities,
} from '../utils/equipmentAvailability';
import { buildProgramGenerationRequestDiagnostics } from '../services/api/generateProgram';
import { useCoachUpdatesStore, type ActiveEquipmentConstraint } from '../store/coachUpdatesStore';
import { createEmptyAcceptedMaterialContext } from '../store/acceptedStateColdStart';
import { useProfileStore } from '../store/profileStore';
import { useProgramStore } from '../store/programStore';
import { transactTemporarySourceFact } from '../store/temporarySourceFactTransaction';
import {
  createTemporaryEquipmentFact,
  temporaryFactScope,
  temporarySourceFactId,
} from '../rules/temporarySourceFact';
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

async function main(): Promise<void> {
const currentOptions: Array<[string, readonly string[]]> = [
  ['Full Gym', FULL_GYM_EQUIPMENT],
  ['Home Gym', ['bodyweight', 'dumbbells', 'bands', 'foam_roller', 'kettlebell']],
  ['Barbell and plates', ['bodyweight', 'barbell']],
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
    equipment: [],
  });
  // Ruling 4 (2026-07-31): the location union is DELETED. An empty or absent
  // checklist resolves to the honest bodyweight floor — no location invents
  // bands, kettlebells or anything else.
  assert(outdoor.includes('bodyweight'), 'bodyweight is included for empty checklist fallback');
  assert(!outdoor.includes('bands'), 'empty checklist no longer inherits location equipment');
  assert(!outdoor.includes('barbell'), 'Outdoor fallback does not invent barbell');

  const absent = resolveEquipmentAvailability({
  });
  assert(absent.includes('bodyweight'), 'bodyweight is included when checklist is absent');
  assert(!absent.includes('kettlebell'), 'absent checklist no longer inherits Home gym inference');

  const legacy = resolveEquipmentAvailability({
    equipment: ['barbell', 'dumbbells', 'cable_machine', 'hamstring_curl', 'bands'],
  });
  assert(legacy.includes('barbell'), 'legacy barbell checklist value maps to barbell');
  assert(legacy.includes('dumbbells'), 'legacy dumbbells checklist value maps to dumbbells');
  assert(legacy.includes('cables'), 'legacy cable_machine checklist value maps to cables');
  assert(legacy.includes('machine'), 'legacy machine-specific checklist value maps to machine');
  assert(legacy.includes('bands'), 'legacy bands checklist value maps to bands');

  const retiredCombinedBarbell = resolveEquipmentAvailability({
    equipment: ['Barbell & Rack'],
  });
  assert(
    sameSet(retiredCombinedBarbell, ['bodyweight', 'barbell', 'rack']),
    'retired Barbell & Rack answer keeps both capabilities without remaining an active label',
  );

  const legacyCommercial = resolveEquipmentCapabilities({
    equipment: ['barbell', 'dumbbells', 'squat_rack', 'cable_machine', 'bands'],
  });
  assert(
    legacyCommercial.source === 'legacy_positive_lift' &&
      legacyCommercial.conditioningModalities.length === 0,
    'legacy positive checklist lifts its OWN tags only — the location union is deleted',
  );

  const completeNoCardio = resolveEquipmentCapabilities({
    equipment: ['Dumbbells Only'],
    equipmentSelectionCompleteness: 'complete',
  });
  assert(
    completeNoCardio.conditioningModalities.length === 0 &&
      !completeNoCardio.tags.includes('bike_or_treadmill'),
    'complete no-cardio selection outranks Commercial-gym location baseline',
  );

  const rowOnly = resolveEquipmentCapabilities({
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
    equipment: ['Full Gym'],
  });
  assert(sameSet(full, FULL_GYM_EQUIPMENT), 'Full Gym maps to the broad gym equipment superset');

  const classes = equipmentTagsToSubstituteEquipmentClasses(
    resolveEquipmentAvailability({
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

  // The retired no-cardio preset, expressed as the own-kit decision builds it.
  const noCardio = buildActiveEquipmentConstraint({
    id: temporaryEquipmentConstraintIdForDate('2026-04-23'),
    mode: 'without',
    tags: ['bike_or_treadmill'],
    source: 'tap',
    startDate: '2026-04-23',
    nowISO: '2026-04-23T09:00:00.000Z',
    scope: 'this_week',
    modifierAffects: ['current_week'],
    reasonLabel: 'Missing this week',
  });
  const constrainedCapabilities = resolveEquipmentCapabilities(profile, [noCardio], '2026-04-23');
  assert(
    constrainedCapabilities.conditioningModalities.length === 0,
    'temporary no-cardio constraint overrides Full Gym conditioning capabilities',
  );
  const restoredCapabilities = resolveEquipmentCapabilities(profile, [], '2026-04-23');
  assert(
    sameSet(restoredCapabilities.conditioningModalities, ['bike_erg', 'air_bike', 'row', 'ski', 'treadmill']),
    'clearing temporary no-cardio constraint restores baseline modalities',
  );
}

// Section 5b (temporary equipment preset mapping) is DELETED with the presets
// (Sam's ruling 5, 2026-07-31): the this-week flow is expressed against the
// athlete's own kit; there is no preset table left to map.

section('6. Equipment constraint expiry lifecycle');
{
  const profile: OnboardingData = {
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
    equipment: ['Full Gym'],
  };
  useProgramStore.setState({
    acceptedMaterialContext: createEmptyAcceptedMaterialContext(),
    currentProgram: null,
    currentMicrocycle: null,
    todayWorkout: null,
    dateOverrides: {},
    overrideContexts: {},
    weekScopedOverlays: {},
    reversibleAdjustmentLedger: [],
  } as any);
  useProfileStore.setState({ onboardingData: profile } as any);
  useCoachUpdatesStore.setState({
    activeConstraints: [],
    activeInjury: null,
  } as any);
  const fact = createTemporaryEquipmentFact({
    factId: 'equipment-store-db-only',
    observedDate: '2026-04-22',
    scope: temporaryFactScope({ kind: 'week', date: '2026-04-22' }),
    mode: 'only',
    equipmentTags: ['dumbbells'],
    sourceActor: 'coach',
    sourceSurface: 'test',
  });
  const created = await transactTemporarySourceFact({
    operation: 'create',
    fact,
    todayISO: '2026-04-22',
  });
  const stored = useCoachUpdatesStore.getState().activeConstraints[0];
  assert(
    created.outcome !== 'conflicted' &&
      created.outcome !== 'safely_rejected' &&
      stored?.type === 'equipment' &&
      stored.temporarySourceFactIds?.includes(fact.factId),
    'canonical equipment fact publishes the downstream store mirror',
  );
  assert(
    sameSet(
      (stored as ActiveEquipmentConstraint).modifierAffects,
      ['current_week', 'future_generation'],
    ),
    'canonical projection publishes visible current/future modifier metadata',
  );
  const constrained = resolveEquipmentAvailability(
    profile,
    useCoachUpdatesStore.getState().activeConstraints,
    '2026-04-23',
  );
  assert(!constrained.includes('barbell'), 'accepted equipment projection affects resolver');
  await transactTemporarySourceFact({
    operation: 'resolve',
    factId: fact.factId,
    todayISO: '2026-04-22',
  });
  const restored = resolveEquipmentAvailability(
    profile,
    useCoachUpdatesStore.getState().activeConstraints,
    '2026-04-23',
  );
  assert(
    restored.includes('barbell') &&
      useProgramStore.getState().acceptedMaterialContext.temporarySourceFacts
        .some((candidate) =>
          temporarySourceFactId(candidate) === fact.factId &&
          candidate.status === 'resolved'),
    'resolving the canonical fact restores baseline availability and retains history',
  );
}

// Section 8 (baseline equipment save/rebuild) is DELETED with its subject:
// saveBaselineEquipmentSelection wrote the legacy shape and had no product
// caller (ownership sheet §1.4). The profile surface commits the canonical
// `equipment_answer` change through commitProfileProgramTransaction, which is
// asserted where that transaction's tests live.

console.log(`\n[equipmentAvailability] ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
