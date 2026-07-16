/**
 * Canonical equipment/schedule/time-cap facts + ProfileProgramTransaction.
 * Run: npm run test:equipment-schedule-facts
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
const memory = new Map<string, string>();
(globalThis as any).window = {
  localStorage: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value); },
    removeItem: (key: string) => { memory.delete(key); },
    clear: () => { memory.clear(); },
  },
};

const {
  ACCEPTED_COMPOSITION_BASE_PROTOCOL_VERSION,
  ACCEPTED_PROFILE_SNAPSHOT_PROTOCOL_VERSION,
  createEmptyAcceptedMaterialContext,
  normalizeAcceptedMaterialContext,
} = require('../store/acceptedStateColdStart') as typeof import('../store/acceptedStateColdStart');
const {
  createTemporaryEquipmentFact,
  createTemporaryScheduleFact,
  createTemporaryTimeCapFact,
  composeTemporarySourceFactCompatibility,
  temporaryFactScope,
  temporarySourceFactId,
} = require('../rules/temporarySourceFact') as typeof import('../rules/temporarySourceFact');
const {
  transactTemporarySourceFact,
} = require('../store/temporarySourceFactTransaction') as typeof import('../store/temporarySourceFactTransaction');
const {
  commitProfileProgramTransaction,
} = require('../store/profileProgramTransaction') as typeof import('../store/profileProgramTransaction');
const {
  validateWorkoutAgainstActiveConstraints,
} = require('../utils/postGenerationConstraintValidation') as typeof import('../utils/postGenerationConstraintValidation');
const {
  useProgramStore,
} = require('../store/programStore') as typeof import('../store/programStore');
const {
  useProfileStore,
} = require('../store/profileStore') as typeof import('../store/profileStore');
const {
  useCoachUpdatesStore,
} = require('../store/coachUpdatesStore') as typeof import('../store/coachUpdatesStore');
const {
  createEmptyReversibleAdjustmentLedger,
} = require('../rules/reversibleAdjustmentLedger') as typeof import('../rules/reversibleAdjustmentLedger');
const {
  semanticFingerprint,
} = require('../utils/programSemanticSnapshot') as typeof import('../utils/programSemanticSnapshot');
const {
  parseCoachIntent,
} = require('../utils/coachIntent') as typeof import('../utils/coachIntent');
const {
  executeProgramControlActionDurably,
} = require('../utils/programControlActions') as typeof import('../utils/programControlActions');
const {
  generateProgramLocally,
} = require('../services/api/generateProgram') as typeof import('../services/api/generateProgram');

let passed = 0;
const failures: string[] = [];

function check(name: string, condition: unknown, detail?: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  failures.push(`${name}${detail === undefined ? '' : `: ${JSON.stringify(detail)}`}`);
  console.error(`  FAIL ${name}`, detail ?? '');
}

function profile() {
  return {
    trainingLocation: 'Commercial gym' as const,
    equipment: ['Full Gym'],
    equipmentSelectionCompleteness: 'complete' as const,
    seasonPhase: 'Off-season' as const,
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as
      import('../types/domain').DayOfWeek[],
  };
}

function reset(): void {
  const now = '2026-07-20T09:00:00.000Z';
  const onboardingData = profile();
  useProgramStore.setState({
    currentProgram: null,
    currentMicrocycle: null,
    todayWorkout: null,
    blockState: null,
    dateOverrides: {},
    overrideContexts: {},
    weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {},
    acceptedMaterialContext: {
      ...createEmptyAcceptedMaterialContext(),
      revision: 1,
      lastTransaction: 'test:seed',
      acceptedProfileSnapshot: {
        protocolVersion: ACCEPTED_PROFILE_SNAPSHOT_PROTOCOL_VERSION,
        capturedAt: now,
        updatedAt: now,
        sourceRevision: 1,
        onboardingData,
      },
      acceptedCompositionBase: {
        protocolVersion: ACCEPTED_COMPOSITION_BASE_PROTOCOL_VERSION,
        capturedAt: now,
        updatedAt: now,
        sourceRevision: 1,
        provenance: 'accepted_pre_injury',
        surfaces: {
          currentProgram: null,
          currentMicrocycle: null,
          todayWorkout: null,
          blockState: null,
          dateOverrides: {},
          overrideContexts: {},
          weekScopedOverlays: {},
          userRemovalConstraints: [],
          reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
          exposureContractsByWeek: {},
        },
      },
    },
  });
  useProfileStore.setState({ onboardingData });
  useCoachUpdatesStore.setState({
    updatesByWeek: {},
    activeConstraints: [],
    activeInjury: null,
    dismissedCoachNoteIds: [],
  });
}

async function main(): Promise<void> {
  await Promise.all([
    useProgramStore.persist.rehydrate(),
    useProfileStore.persist.rehydrate(),
    useCoachUpdatesStore.persist.rehydrate(),
  ]);
  reset();
  const date = '2026-07-20';
  const week = temporaryFactScope({ kind: 'week', date });
  const equipment = createTemporaryEquipmentFact({
    observedDate: date,
    scope: week,
    mode: 'only',
    equipmentTags: ['bodyweight', 'dumbbells'],
    sourceSurface: 'test',
  });
  const away = createTemporaryScheduleFact({
    observedDate: date,
    scope: week,
    scheduleKind: 'travel',
    unavailableDates: ['2026-07-22'],
    sourceSurface: 'test',
  });
  const cap = createTemporaryTimeCapFact({
    observedDate: date,
    scope: week,
    targetKind: 'weekdays',
    weekdays: ['Friday'],
    maxSessionMinutes: 30,
    sourceSurface: 'test',
  });

  console.log('\n[1] typed facts and deterministic projections');
  check('coach equipment intent remains typed',
    parseCoachIntent({
      intent: 'equipment_change',
      confidence: 1,
      needsClarification: false,
      payload: {
        equipmentMode: 'only',
        equipmentTags: ['bodyweight', 'dumbbells'],
        equipmentChangeScope: 'temporary',
      },
    })?.intent === 'equipment_change');
  const projection = composeTemporarySourceFactCompatibility({
    temporarySourceFacts: [equipment, away, cap],
  });
  const coachEquipment = createTemporaryEquipmentFact({
    observedDate: date,
    scope: week,
    mode: 'only',
    equipmentTags: ['bodyweight', 'dumbbells'],
    sourceActor: 'coach',
    sourceSurface: 'coach_chat',
  });
  check('coach and tap equivalent equipment inputs share stable fact identity',
    coachEquipment.factId === equipment.factId);
  check('equipment projects from one stable fact',
    projection.activeConstraints.some((constraint) =>
      constraint.type === 'equipment' &&
      constraint.temporarySourceFactIds?.[0] === equipment.factId));
  check('away projects unavailable dates without override ownership',
    projection.activeConstraints.some((constraint) =>
      constraint.type === 'schedule' &&
      constraint.scheduleKind === 'travel' &&
      constraint.unavailableDates?.includes('2026-07-22') &&
      (constraint.linkedOverrideDates?.length ?? 0) === 0));
  check('time cap projects exact weekday and minutes',
    projection.activeConstraints.some((constraint) =>
      constraint.type === 'schedule' &&
      constraint.scheduleKind === 'time_cap' &&
      constraint.maxSessionMinutes === 30 &&
      constraint.timeCapWeekdays?.includes('Friday')));

  const workout = {
    id: 'equipment-time-cap-workout',
    microcycleId: 'week',
    dayOfWeek: 5,
    name: 'Strength',
    description: '',
    durationMinutes: 60,
    intensity: 'Moderate',
    workoutType: 'Strength',
    sessionTier: 'core',
    hasCombinedConditioning: false,
    exercises: [
      {
        id: 'row-barbell',
        workoutId: 'equipment-time-cap-workout',
        exerciseId: 'barbell-row',
        orderIndex: 0,
        prescribedSets: 3,
        prescribedReps: '5',
        exercise: { id: 'barbell-row', name: 'Barbell Row', equipmentRequired: ['Barbell'] },
      },
      {
        id: 'row-db',
        workoutId: 'equipment-time-cap-workout',
        exerciseId: 'db-row',
        orderIndex: 1,
        prescribedSets: 3,
        prescribedReps: '8',
        exercise: { id: 'db-row', name: 'Dumbbell Row', equipmentRequired: ['Dumbbells'] },
      },
    ],
    createdAt: '',
    updatedAt: '',
  } as any;
  const validated = validateWorkoutAgainstActiveConstraints({
    workout,
    date: '2026-07-24',
    todayISO: date,
    activeConstraints: projection.activeConstraints,
    profile: profile(),
  }).workout;
  check('equipment restriction changes visible prescriptions only',
    validated?.exercises?.length === 1 &&
    validated.exercises[0].exercise?.name === 'Dumbbell Row');
  check('time cap applies deterministically to targeted session',
    validated?.durationMinutes === 30);
  let impossibleCapRejected = false;
  try {
    createTemporaryTimeCapFact({
      observedDate: date,
      scope: week,
      targetKind: 'all_sessions',
      maxSessionMinutes: 5,
      sourceSurface: 'test',
    });
  } catch {
    impossibleCapRejected = true;
  }
  check('impossible time cap rejects before publication', impossibleCapRejected);
  const awayWorkout = validateWorkoutAgainstActiveConstraints({
    workout,
    date: '2026-07-22',
    todayISO: date,
    activeConstraints: projection.activeConstraints,
    profile: profile(),
  }).workout;
  check('away date is unavailable without a temporary Rest override', awayWorkout === null);

  console.log('\n[2] canonical fact transactions preserve the base and other facts');
  const beforeBase = semanticFingerprint(
    normalizeAcceptedMaterialContext(useProgramStore.getState().acceptedMaterialContext)
      .acceptedCompositionBase?.surfaces,
  );
  await transactTemporarySourceFact({ operation: 'create', fact: equipment, todayISO: date });
  await transactTemporarySourceFact({ operation: 'create', fact: away, todayISO: date });
  await transactTemporarySourceFact({ operation: 'create', fact: cap, todayISO: date });
  let accepted = normalizeAcceptedMaterialContext(
    useProgramStore.getState().acceptedMaterialContext,
  );
  check('temporary facts never modify composition-base fingerprint',
    semanticFingerprint(accepted.acceptedCompositionBase?.surfaces) === beforeBase);
  check('away writes no date overrides',
    Object.keys(useProgramStore.getState().dateOverrides).length === 0);
  const otherIds = accepted.temporarySourceFacts
    .filter((fact) => temporarySourceFactId(fact) !== equipment.factId)
    .map(temporarySourceFactId)
    .sort();
  await transactTemporarySourceFact({
    operation: 'resolve',
    factId: equipment.factId,
    todayISO: date,
  });
  accepted = normalizeAcceptedMaterialContext(
    useProgramStore.getState().acceptedMaterialContext,
  );
  check('resolving equipment preserves every other fact',
    semanticFingerprint(accepted.temporarySourceFacts
      .filter((fact) => fact.status === 'active')
      .map(temporarySourceFactId)
      .sort()) === semanticFingerprint(otherIds));
  const resolvedEquipment = accepted.temporarySourceFacts.find((fact) =>
    temporarySourceFactId(fact) === equipment.factId);
  check('resolution retains transition history',
    !!resolvedEquipment && !('episodeId' in resolvedEquipment) &&
    resolvedEquipment.transitionHistory.some((transition) =>
      transition.from === 'active' && transition.to === 'resolved'));
  const expiredSchedule = createTemporaryScheduleFact({
    observedDate: '2026-07-19',
    scope: temporaryFactScope({ kind: 'date', date: '2026-07-19' }),
    scheduleKind: 'unavailable_dates',
    unavailableDates: ['2026-07-19'],
    sourceSurface: 'test',
    factId: 'test:expired-schedule',
  });
  await transactTemporarySourceFact({
    operation: 'create',
    fact: expiredSchedule,
    todayISO: date,
  });
  accepted = normalizeAcceptedMaterialContext(
    useProgramStore.getState().acceptedMaterialContext,
  );
  check('schedule expiry is durable accepted history',
    accepted.temporarySourceFacts.some((fact) =>
      temporarySourceFactId(fact) === expiredSchedule.factId &&
      !('episodeId' in fact) &&
      fact.status === 'expired' &&
      fact.transitionHistory.some((transition) => transition.to === 'expired')));

  console.log('\n[3] profile and program commit or roll back together');
  const profileBefore = semanticFingerprint(useProfileStore.getState().onboardingData);
  const profileResult = await commitProfileProgramTransaction({
    change: {
      kind: 'preferred_training_weekdays',
      weekdays: ['Monday', 'Wednesday', 'Friday'],
    },
    todayISO: date,
    sourceSurface: 'test',
  });
  accepted = normalizeAcceptedMaterialContext(
    useProgramStore.getState().acceptedMaterialContext,
  );
  check('accepted profile transaction commits profile mirror',
    profileResult.ok &&
    semanticFingerprint(accepted.acceptedProfileSnapshot?.onboardingData) ===
      semanticFingerprint(useProfileStore.getState().onboardingData));
  check('active schedule and time-cap facts survive profile transaction',
    accepted.temporarySourceFacts.filter((fact) => fact.status === 'active').length === 2);
  const beforeRejected = semanticFingerprint({
    profile: useProfileStore.getState().onboardingData,
    accepted: useProgramStore.getState().acceptedMaterialContext,
  });
  const rejected = await commitProfileProgramTransaction({
    change: {
      kind: 'baseline_equipment',
      equipment: ['Bodyweight Only'],
    },
    todayISO: date,
    sourceSurface: 'test',
    testHooks: { verifyAfterPersistence: () => false },
  });
  check('profile transaction rejects after durable verification failure', !rejected.ok);
  check('profile and program roll back together',
    semanticFingerprint({
      profile: useProfileStore.getState().onboardingData,
      accepted: useProgramStore.getState().acceptedMaterialContext,
    }) === beforeRejected);
  check('profile changed from initial seed only after accepted transaction',
    semanticFingerprint(useProfileStore.getState().onboardingData) !== profileBefore);

  console.log('\n[4] stale mirrors and presentation dismissal cannot publish upstream');
  const canonicalBeforeStale = semanticFingerprint(
    useProgramStore.getState().acceptedMaterialContext,
  );
  useProfileStore.getState().updateOnboardingData({
    preferredTrainingDays: ['Sunday'],
    trainingDaysPerWeek: 1,
  });
  check('stale ProfileStore write is fenced by accepted snapshot',
    useProfileStore.getState().onboardingData.preferredTrainingDays?.join(',') ===
      accepted.acceptedProfileSnapshot?.onboardingData.preferredTrainingDays?.join(','));
  useCoachUpdatesStore.getState().upsertActiveConstraint({
    id: 'stale-equipment',
    type: 'equipment',
    mode: 'without',
    tags: ['dumbbells'],
    severity: 5,
    status: 'active',
    startDate: date,
    lastUpdatedAt: `${date}T09:00:00.000Z`,
    source: 'system',
    modifierAffects: ['current_week'],
    rules: [],
    safeFocus: [],
    advice: [],
  });
  check('stale CoachUpdates mirror cannot overwrite canonical accepted facts',
    semanticFingerprint(useProgramStore.getState().acceptedMaterialContext) ===
      canonicalBeforeStale);
  useCoachUpdatesStore.getState().dismissCoachNote('presentation-only');
  check('Dismiss Note changes no accepted profile, fact, base or program',
    semanticFingerprint(useProgramStore.getState().acceptedMaterialContext) ===
      canonicalBeforeStale);

  console.log('\n[5] busy and away tap actions publish canonical schedule facts');
  reset();
  const actionBase = {
    source: {
      screen: 'test',
      surface: 'equipment_schedule_fact_test',
      initiatedBy: 'test',
    },
    scope: 'current_week',
    requiresRebuild: false,
    createsActiveModifier: true,
    oneOffOnly: false,
  } as const;
  const equipmentResult = await executeProgramControlActionDurably({
    ...actionBase,
    type: 'set_equipment_modifier',
    payload: {
      presetId: 'bodyweight_only',
      date,
      todayISO: date,
    },
  } as any, { todayISO: date });
  accepted = normalizeAcceptedMaterialContext(
    useProgramStore.getState().acceptedMaterialContext,
  );
  check('equipment tap publishes a canonical equipment fact',
    equipmentResult.ok &&
    accepted.temporarySourceFacts.some((fact) =>
      !('episodeId' in fact) &&
      fact.factKind === 'equipment' &&
      fact.mode === 'only' &&
      semanticFingerprint(fact.equipmentTags) === semanticFingerprint(['bodyweight'])));
  const generated = generateProgramLocally(profile(), {
    todayISO: date,
    blockNumber: 1,
  });
  const generatedEquipment = (generated.microcycles[0]?.workouts ?? [])
    .flatMap((workout) => workout.exercises ?? [])
    .flatMap((exercise) => exercise.exercise?.equipmentRequired ?? [])
    .map((value) => String(value).toLowerCase());
  check('generation reads accepted canonical equipment facts',
    generatedEquipment.every((value) =>
      value.includes('bodyweight') || value === 'none' || value.length === 0),
    generatedEquipment);

  const busyResult = await executeProgramControlActionDurably({
    ...actionBase,
    type: 'set_schedule_modifier',
    payload: {
      date,
      todayISO: date,
      severity: 5,
      reasonLabel: 'Busy week',
    },
  } as any, { todayISO: date });
  accepted = normalizeAcceptedMaterialContext(
    useProgramStore.getState().acceptedMaterialContext,
  );
  check('busy tap publishes a canonical busy-week fact',
    busyResult.ok &&
    accepted.temporarySourceFacts.some((fact) =>
      !('episodeId' in fact) &&
      fact.factKind === 'schedule' &&
      fact.scheduleKind === 'busy_week' &&
      fact.status === 'active'));

  const awayDates = ['2026-07-22', '2026-07-23'];
  const awayResult = await executeProgramControlActionDurably({
    ...actionBase,
    type: 'set_schedule_modifier',
    payload: {
      date,
      todayISO: date,
      severity: 7,
      reasonLabel: 'Away / travel',
      planChange: {
        kind: 'clear_days',
        dates: awayDates,
      },
    },
  } as any, { todayISO: date });
  accepted = normalizeAcceptedMaterialContext(
    useProgramStore.getState().acceptedMaterialContext,
  );
  check('away tap publishes one canonical travel fact with exact dates',
    awayResult.ok &&
    accepted.temporarySourceFacts.some((fact) =>
      !('episodeId' in fact) &&
      fact.factKind === 'schedule' &&
      fact.scheduleKind === 'travel' &&
      semanticFingerprint(fact.unavailableDates) === semanticFingerprint(awayDates)));
  check('away tap creates no fact-owned date override',
    Object.keys(useProgramStore.getState().dateOverrides).length === 0);

  console.log(`\nEquipment/schedule source-fact tests: ${passed} passed`);
  if (failures.length > 0) {
    console.error(`\n${failures.length} failure(s):\n${failures.join('\n')}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
