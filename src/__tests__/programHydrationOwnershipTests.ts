/**
 * ProgramStore hydration ownership invariants.
 *
 * Run: npm run test:program-hydration-ownership
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

const storage = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
    removeItem: (key: string) => { storage.delete(key); },
    clear: () => storage.clear(),
  },
};

const NOW = '2026-07-13T00:00:00.000Z';
const WEEK = '2026-07-13';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function row(workoutId: string, suffix: string, name: string, role: string) {
  return {
    id: `${workoutId}:${suffix}`,
    workoutId,
    exerciseId: `${workoutId}:exercise:${suffix}`,
    exerciseOrder: suffix === 'strength' ? 1 : 2,
    prescribedSets: role === 'conditioning' ? 1 : 3,
    prescribedRepsMin: role === 'conditioning' ? 1 : 6,
    prescribedRepsMax: role === 'conditioning' ? 1 : 8,
    prescribedWeightKg: 0,
    restSeconds: 90,
    notes: role === 'conditioning' ? '5 x 2min' : '3 x 6-8',
    section18Evidence: {
      protocolVersion: 1,
      role,
      strengthPattern: role === 'main_strength' ? 'squat' : null,
      mainStrengthPattern: role === 'main_strength' ? 'squat' : null,
      provenance: 'canonical_row_classifier',
    },
    exercise: {
      id: `${workoutId}:exercise:${suffix}`,
      name,
      description: name,
      muscleGroups: [],
      exerciseType: role === 'conditioning' ? 'Cardio' : 'Compound',
      equipmentRequired: [],
      difficultyLevel: 'Intermediate',
      createdAt: NOW,
      updatedAt: NOW,
    },
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function mixedWorkout(id = 'accepted-mixed', dayOfWeek = 1) {
  const strength = row(id, 'strength', 'Back Squat', 'main_strength');
  const conditioning = row(id, 'conditioning', 'Assault Bike Sprints', 'conditioning');
  return {
    id,
    microcycleId: 'accepted-week',
    dayOfWeek,
    name: 'Lower Strength + Assault Bike Sprints',
    description: 'Typed mixed session',
    durationMinutes: 60,
    intensity: 'Moderate',
    workoutType: 'Strength',
    sessionTier: 'core',
    planEntryId: `${id}:plan`,
    strengthIntent: {
      archetype: 'lower',
      primaryPattern: 'squat',
      plannedPatterns: ['squat'],
      effectivePatterns: ['squat'],
    },
    strengthPatternContributions: ['squat'],
    conditioningCategory: 'sprint',
    conditioningFlavour: 'high-intensity',
    conditioningBlock: {
      intent: 'high-intensity',
      attachedKind: 'component',
      options: [{
        title: 'Assault Bike Sprints',
        description: '5 x 2min',
        exerciseIds: [conditioning.id],
      }],
    },
    hasCombinedConditioning: true,
    attachedConditioningKind: 'component',
    section18ConditioningRole: 'planner_selected_core',
    section18Evidence: {
      protocolVersion: 1,
      conditioningRole: 'core',
      conditioningStress: 'hard',
      provenance: 'planner_and_canonical_content',
    },
    exercises: [strength, conditioning],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function simpleWorkout(id: string, dayOfWeek: number, workoutType: string) {
  return {
    id,
    microcycleId: 'accepted-week',
    dayOfWeek,
    name: workoutType,
    description: workoutType,
    durationMinutes: workoutType === 'Recovery' ? 30 : 60,
    intensity: workoutType === 'Recovery' ? 'Light' : 'Moderate',
    workoutType,
    sessionTier: workoutType === 'Recovery' ? 'recovery' : 'core',
    section18Evidence: {
      protocolVersion: 1,
      conditioningRole: workoutType === 'Conditioning' ? 'core' : 'none',
      conditioningStress: workoutType === 'Conditioning' ? 'moderate' : 'unknown',
      provenance: 'planner_and_canonical_content',
    },
    ...(workoutType === 'Conditioning' ? {
      conditioningCategory: 'tempo',
      conditioningFlavour: 'tempo',
      conditioningBlock: {
        intent: 'tempo',
        options: [{ title: 'Tempo Intervals', description: '4 x 4min', exerciseIds: [] }],
      },
      hasCombinedConditioning: false,
    } : {}),
    ...(workoutType === 'Strength' ? {
      strengthIntent: {
        archetype: 'upper', primaryPattern: 'push',
        plannedPatterns: ['push'], effectivePatterns: ['push'],
      },
      strengthPatternContributions: ['push'],
    } : {}),
    exercises: [],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function currentContract() {
  return { protocolVersion: 2, authority: 'LFA_PROGRAMMING_BIBLE_SECTION_18' };
}

function acceptedFixture() {
  const workouts = [
    mixedWorkout(),
    simpleWorkout('accepted-game', 2, 'Game'),
    simpleWorkout('accepted-recovery', 3, 'Recovery'),
    simpleWorkout('accepted-strength', 4, 'Strength'),
    simpleWorkout('accepted-conditioning', 5, 'Conditioning'),
  ];
  const microcycle = {
    id: 'accepted-week', programId: 'accepted-program', weekNumber: 1,
    startDate: WEEK, endDate: '2026-07-19', miniCycleNumber: 1,
    intensityMultiplier: 1, weekKind: 'build', exposureContractV2: currentContract(),
    workouts, createdAt: NOW, updatedAt: NOW,
  };
  const program = {
    id: 'accepted-program', userId: 'athlete', name: 'Accepted program', description: '',
    programPhase: 'In-season', startDate: WEEK, endDate: '2026-08-09',
    microcycles: [microcycle], primaryFocus: 'Football', isActive: true,
    createdAt: NOW, updatedAt: NOW,
  };
  const repeatWorkout = simpleWorkout('repeat-week-owned', 1, 'Recovery');
  const overlay = {
    id: 'repeat-week-overlay', weekStart: '2026-07-20', weekEnd: '2026-07-26',
    anchorDate: null, reason: 'repeat_week', exposureContractV2: currentContract(),
    workoutsByDate: { '2026-07-20': repeatWorkout }, createdAt: NOW, updatedAt: NOW,
  };
  const deletedWorkout = simpleWorkout('deleted-session', 0, 'Strength');
  const removal = {
    protocolVersion: 1, id: 'removal:deleted-session', authorship: 'user', source: 'coach',
    mutationKind: 'deletion', status: 'active', targetDate: '2026-07-19',
    scope: 'whole_session', targetPlanEntryId: 'deleted:plan', targetWorkoutId: 'deleted-session',
    originalWorkout: deletedWorkout, remainingWorkout: null,
    equivalentExposureMayRelocate: false, wholeDayRestOwned: true,
    createdAt: NOW, restoredAt: null, restorationReason: null,
  };
  const ledger = {
    protocolVersion: 1,
    adjustments: [{
      protocolVersion: 1,
      id: 'reversible:repeat-week-owned',
      kind: 'repeat_week',
      sourceActor: 'athlete',
      sourceSurface: 'program_tab',
      sourceActionOrIntentId: 'repeat-week-action',
      createdAt: NOW,
      acceptedRevision: 7,
      status: 'active',
      ownershipToken: 'must-survive-byte-for-byte',
    }],
  };
  const surfaces = {
    currentProgram: program,
    currentMicrocycle: microcycle,
    todayWorkout: workouts[0],
    blockState: { blockStartDate: WEEK, blockNumber: 1 },
    dateOverrides: { '2026-07-16': workouts[3] },
    overrideContexts: {
      '2026-07-16': { intent: 'program_adjustment', label: 'Athlete-owned move destination' },
    },
    weekScopedOverlays: { '2026-07-20': overlay },
    userRemovalConstraints: [removal],
    reversibleAdjustmentLedger: ledger,
    exposureContractsByWeek: {},
  };
  const equipmentFact = {
    protocolVersion: 1,
    factId: 'temporary-source-fact:v1:equipment:week:2026-07-13',
    factKind: 'equipment', status: 'active', observedDate: WEEK,
    effectiveFrom: WEEK, effectiveUntil: '2026-07-19',
    scope: { kind: 'week', weekStart: WEEK, from: WEEK, until: '2026-07-19' },
    athleteReportedLevel: 'unspecified', mode: 'only', equipmentTags: ['bike_or_treadmill'],
    conditioningModalities: ['bike'], createdAt: NOW, updatedAt: NOW, resolvedAt: null,
    sourceActor: 'athlete', sourceSurface: 'coach_chat', legacyMigrationStatus: 'native_v1',
    transitionHistory: [{
      at: NOW, from: null, to: 'active', actor: 'athlete', surface: 'coach_chat', reason: 'created',
    }],
  };
  const profile = {
    seasonPhase: 'In-season', trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    availabilityConstraints: [],
  };
  const acceptedMaterialContext = {
    markedDays: { '2026-07-14': 'game' },
    readinessSignalsByDate: {
      '2026-07-15': {
        date: '2026-07-15', timeAvailableMinutes: 45,
        source: 'quick_check', updatedAt: NOW,
      },
    },
    activeConstraints: [], activeInjury: null, injuryEpisodes: [],
    temporarySourceFacts: [equipmentFact],
    acceptedCompositionBase: {
      protocolVersion: 1, capturedAt: NOW, updatedAt: NOW, sourceRevision: 7,
      provenance: 'accepted_pre_injury', surfaces: clone(surfaces),
    },
    acceptedProfileSnapshot: {
      protocolVersion: 1, capturedAt: NOW, updatedAt: NOW, sourceRevision: 7,
      onboardingData: profile,
    },
    revision: 7, lastTransaction: 'accepted-fixture',
  };
  return {
    ...surfaces,
    acceptedMaterialContext,
    isGenerating: false, isLoading: false, error: null,
    sessionFeedback: {}, weightOverrides: {},
  };
}

function componentFingerprint(workout: any): string {
  return JSON.stringify({
    id: workout.id,
    strengthIntent: workout.strengthIntent,
    conditioningBlock: workout.conditioningBlock,
    section18Evidence: workout.section18Evidence,
    section18ConditioningRole: workout.section18ConditioningRole,
    exercises: workout.exercises,
  });
}

function acceptedSemanticFingerprint(state: any): string {
  return JSON.stringify({
    program: state.currentProgram,
    microcycle: state.currentMicrocycle,
    todayWorkout: state.todayWorkout,
    dateOverrides: state.dateOverrides,
    overrideContexts: state.overrideContexts,
    overlays: state.weekScopedOverlays,
    removals: state.userRemovalConstraints,
    ledger: state.reversibleAdjustmentLedger,
    facts: state.acceptedMaterialContext.temporarySourceFacts,
    base: state.acceptedMaterialContext.acceptedCompositionBase,
    profile: state.acceptedMaterialContext.acceptedProfileSnapshot,
    markedDays: state.acceptedMaterialContext.markedDays,
    readiness: state.acceptedMaterialContext.readinessSignalsByDate,
  });
}

let passed = 0;
const failures: string[] = [];

async function run(name: string, body: () => void | Promise<void>): Promise<void> {
  try {
    await body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`  FAIL ${name}`, error);
  }
}

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

async function main(): Promise<void> {
  const fixture = acceptedFixture();
  const beforeMixed = fixture.currentProgram.microcycles[0].workouts[0];
  const beforeComponent = componentFingerprint(beforeMixed);
  storage.set('profile-store', JSON.stringify({
    state: { onboardingData: { seasonPhase: 'Off-season', trainingDaysPerWeek: 1 } }, version: 0,
  }));
  storage.set('coach-updates', JSON.stringify({
    state: { activeConstraints: [{ id: 'conflicting-mirror', type: 'injury', status: 'active' }] },
    version: 0,
  }));
  storage.set('program-store', JSON.stringify({ state: clone(fixture), version: 0 }));

  const programStore = require('../store/programStore') as typeof import('../store/programStore');
  const ingress = require('../store/programHydrationIngress') as
    typeof import('../store/programHydrationIngress');
  const temporaryFacts = require('../rules/temporarySourceFact') as
    typeof import('../rules/temporarySourceFact');
  const reversible = require('../rules/reversibleAdjustmentLedger') as
    typeof import('../rules/reversibleAdjustmentLedger');

  await run('1 accepted envelope is classified from durable protocols', () => {
    const result = ingress.requireProgramHydrationIngress(fixture, 0);
    assert(result.kind === 'accepted_canonical', JSON.stringify(result));
  });

  await run('2 accepted mixed workout repairs stale workoutType without semantic mutation', () => {
    const projected = programStore.canonicaliseHydratedState(clone(fixture) as any, {
      ingressKind: 'accepted_canonical',
    }) as any;
    const mixed = projected.currentProgram.microcycles[0].workouts[0];
    assert(mixed.workoutType === 'Mixed', `type=${mixed.workoutType}`);
    assert(componentFingerprint(mixed) === beforeComponent, 'component/exercise fingerprint changed');
  });

  await run('3 real persistence hydration remains 5/5/5 and repairs scalar authority', async () => {
    const storedCount = fixture.currentProgram.microcycles[0].workouts.length;
    await programStore.useProgramStore.persist.rehydrate();
    const first = programStore.useProgramStore.getState();
    const firstCount = first.currentProgram?.microcycles[0].workouts.length ?? 0;
    await programStore.useProgramStore.persist.rehydrate();
    const second = programStore.useProgramStore.getState();
    const secondCount = second.currentProgram?.microcycles[0].workouts.length ?? 0;
    assert(`${storedCount}/${firstCount}/${secondCount}` === '5/5/5',
      `counts=${storedCount}/${firstCount}/${secondCount}`);
    assert(second.currentProgram?.microcycles[0].workouts[0].workoutType === 'Mixed',
      'stale scalar survived real hydration');
  });

  let firstFingerprint = '';
  await run('4 canonical envelope is semantically idempotent over first and second hydration', async () => {
    const first = programStore.useProgramStore.getState();
    firstFingerprint = acceptedSemanticFingerprint(first);
    await programStore.useProgramStore.persist.rehydrate();
    const twice = acceptedSemanticFingerprint(programStore.useProgramStore.getState());
    assert(twice === firstFingerprint, 'second hydration changed accepted semantics');
  });

  await run('5 accepted deletion ownership remains deleted', () => {
    const state = programStore.useProgramStore.getState();
    const ids = state.currentProgram?.microcycles.flatMap((week) =>
      week.workouts.map((workout) => workout.id)) ?? [];
    assert(!ids.includes('deleted-session'), 'deleted session resurrected');
    assert(state.userRemovalConstraints[0]?.id === 'removal:deleted-session',
      'deletion ownership changed');
  });

  await run('6 move, fixture, override and Repeat Week ownership remains unchanged', () => {
    const state = programStore.useProgramStore.getState();
    assert(state.acceptedMaterialContext.markedDays['2026-07-14'] === 'game',
      'fixture changed');
    assert(state.overrideContexts['2026-07-16']?.label === 'Athlete-owned move destination',
      'move/override context changed');
    const repeat = state.weekScopedOverlays['2026-07-20'];
    assert(repeat?.reason === 'repeat_week' && repeat.id === 'repeat-week-overlay',
      'Repeat Week ownership changed');
  });

  await run('7 current source facts, readiness, equipment and accepted profile truth remain unchanged', () => {
    const state = programStore.useProgramStore.getState();
    assert(JSON.stringify(state.acceptedMaterialContext.temporarySourceFacts) ===
      JSON.stringify(fixture.acceptedMaterialContext.temporarySourceFacts),
    'source facts changed');
    assert(state.acceptedMaterialContext.temporarySourceFacts[0]?.factKind === 'equipment',
      'equipment source fact disappeared');
    assert(state.acceptedMaterialContext.readinessSignalsByDate['2026-07-15']
      ?.timeAvailableMinutes === 45, 'readiness changed');
    assert(JSON.stringify(state.acceptedMaterialContext.acceptedProfileSnapshot) ===
      JSON.stringify(fixture.acceptedMaterialContext.acceptedProfileSnapshot),
    'accepted profile truth changed');
  });

  await run('8 reversible ledger identities and ownership remain byte-for-byte unchanged', () => {
    const state = programStore.useProgramStore.getState();
    assert(JSON.stringify(state.reversibleAdjustmentLedger) ===
      JSON.stringify(fixture.reversibleAdjustmentLedger), 'reversible ledger changed');
    assert(state.reversibleAdjustmentLedger.adjustments[0]?.id ===
      'reversible:repeat-week-owned', 'ledger identity changed');
  });

  await run('9 accepted composition base is preserved except derived projections', () => {
    const base = programStore.useProgramStore.getState().acceptedMaterialContext
      .acceptedCompositionBase;
    assert(base?.provenance === 'accepted_pre_injury' && base.sourceRevision === 7,
      'base provenance changed');
    assert(base.surfaces.currentProgram?.microcycles[0].workouts[0].workoutType === 'Mixed',
      'base derived scalar was not projected');
    assert(componentFingerprint(base.surfaces.currentProgram?.microcycles[0].workouts[0]) ===
      beforeComponent, 'base component semantics changed');
  });

  await run('10 persisted readback equals the accepted normalized state', () => {
    const envelope = JSON.parse(storage.get('program-store') ?? '{}');
    const persistedFingerprint = acceptedSemanticFingerprint(envelope.state);
    const liveFingerprint = acceptedSemanticFingerprint(programStore.useProgramStore.getState());
    assert(persistedFingerprint === liveFingerprint, 'accepted/persisted normalization drift');
    assert(envelope.state.currentProgram.microcycles[0].workouts[0].workoutType === 'Mixed',
      'normalized derived scalar was not durably acknowledged');
  });

  await run('11 cold readback has the same canonical semantic fingerprint', async () => {
    await programStore.useProgramStore.persist.rehydrate();
    assert(acceptedSemanticFingerprint(programStore.useProgramStore.getState()) === firstFingerprint,
      'cold readback fingerprint changed');
  });

  await run('12 compatibility-store import/hydration order cannot override accepted truth', () => {
    const context = programStore.useProgramStore.getState().acceptedMaterialContext;
    assert(context.acceptedProfileSnapshot?.onboardingData.seasonPhase === 'In-season',
      'profile mirror overrode accepted profile');
    assert(!context.activeConstraints.some((constraint) => constraint.id === 'conflicting-mirror'),
      'coach compatibility mirror overrode accepted context');
  });

  const legacyMixed = {
    ...mixedWorkout('legacy-mixed'),
    strengthIntent: undefined,
    strengthPatternContributions: ['squat'],
    workoutType: 'Strength',
  };
  await run('13 legacy scalar and contribution-owned workout migrates to typed Mixed', () => {
    const migrated = programStore.canonicaliseHydratedState({
      dateOverrides: { [WEEK]: clone(legacyMixed) },
      userRemovalConstraints: [],
    } as any, { ingressKind: 'migration_required' }) as any;
    const workout = migrated.dateOverrides[WEEK];
    assert(workout.workoutType === 'Mixed', `legacy type=${workout.workoutType}`);
    assert(workout.strengthIntent?.effectivePatterns.includes('squat'),
      'legacy scalar ownership did not become typed intent');
    const scalarOnly = clone(legacyMixed) as any;
    scalarOnly.planEntryId = undefined;
    scalarOnly.strengthPatternContributions = undefined;
    scalarOnly.exercises.forEach((exercise: any) => { exercise.section18Evidence = undefined; });
    const scalarMigrated = programStore.canonicaliseHydratedState({
      dateOverrides: { [WEEK]: scalarOnly }, userRemovalConstraints: [],
    } as any, { ingressKind: 'migration_required' }) as any;
    assert(scalarMigrated.dateOverrides[WEEK].strengthIntent?.effectivePatterns.includes('squat'),
      'legacy scalar/exercise ownership did not migrate to typed intent');
  });

  await run('14 legacy typed-intent compatibility representation migrates idempotently', () => {
    const oldTyped = {
      ...simpleWorkout('legacy-upper', 2, 'Strength'),
      strengthIntent: undefined,
      strengthPatternContributions: ['pull', 'push', 'pull'],
      exercises: [row('legacy-upper', 'strength', 'Bench Press', 'main_strength')],
    };
    const once = programStore.canonicaliseHydratedState({
      dateOverrides: { '2026-07-14': oldTyped }, userRemovalConstraints: [],
    } as any, { ingressKind: 'migration_required' }) as any;
    const twice = programStore.canonicaliseHydratedState(once, {
      ingressKind: 'migration_required',
    }) as any;
    const legacyEnvelope = clone(fixture) as any;
    legacyEnvelope.currentProgram.microcycles[0].workouts[0].strengthIntent = undefined;
    legacyEnvelope.currentMicrocycle.workouts[0].strengthIntent = undefined;
    legacyEnvelope.todayWorkout.strengthIntent = undefined;
    const classified = ingress.requireProgramHydrationIngress(legacyEnvelope, 0);
    assert(classified.kind === 'migration_required', JSON.stringify(classified));
    assert(once.dateOverrides['2026-07-14'].strengthIntent,
      'old typed representation was not migrated');
    assert(JSON.stringify(once) === JSON.stringify(twice), 'typed-intent migration was not idempotent');
  });

  const legacyEquipmentConstraint = {
    id: 'legacy-equipment', type: 'equipment', status: 'active', startDate: WEEK,
    expiresAt: '2026-07-19', mode: 'only', tags: ['bike_or_treadmill'],
    conditioningModalities: ['bike'], lastUpdatedAt: NOW,
  } as any;
  await run('15 legacy compatibility constraint migrates to a current source fact', async () => {
    const facts = temporaryFacts.migrateLegacyTemporarySourceFacts({
      activeConstraints: [legacyEquipmentConstraint],
      activeInjury: null,
      readinessSignalsByDate: {},
      sourceSurface: 'program_store_hydration',
    });
    assert(facts.length === 1 && facts[0].protocolVersion === 1 &&
      'factKind' in facts[0] && facts[0].factKind === 'equipment',
    'legacy constraint did not become canonical source fact');
    const legacyEnvelope = {
      currentProgram: null,
      currentMicrocycle: null,
      todayWorkout: null,
      blockState: null,
      dateOverrides: { [WEEK]: clone(legacyMixed) },
      overrideContexts: {},
      weekScopedOverlays: {},
      userRemovalConstraints: [clone(fixture.userRemovalConstraints[0])],
      exposureContractsByWeek: {},
      acceptedMaterialContext: {
        markedDays: {}, readinessSignalsByDate: {},
        activeConstraints: [legacyEquipmentConstraint], activeInjury: null,
        injuryEpisodes: [], temporarySourceFacts: [],
        acceptedCompositionBase: null, acceptedProfileSnapshot: null,
        revision: 0, lastTransaction: null,
      },
      isGenerating: false, isLoading: false, error: null,
      sessionFeedback: {}, weightOverrides: {},
    } as any;
    assert(ingress.requireProgramHydrationIngress(legacyEnvelope, 0).kind ===
      'migration_required', 'legacy fixture was not classified for migration');
    const legacySerialized = JSON.stringify({ state: legacyEnvelope, version: 0 });
    storage.set('program-store', legacySerialized);
    assert(await programStore.readDurableProgramStoreEnvelope() === legacySerialized,
      'legacy fixture was not installed in durable storage');
    await programStore.useProgramStore.persist.rehydrate();
    const hydratedFacts = programStore.useProgramStore.getState().acceptedMaterialContext
      .temporarySourceFacts;
    assert(hydratedFacts.some((fact: any) => fact.factKind === 'equipment' &&
      fact.legacyMigrationStatus === 'legacy_after_state_only'),
      `real ProgramStore hydration did not publish the canonical source fact: ${JSON.stringify(hydratedFacts)}`);
  });

  await run('16 legacy reversible ownership migrates to normalized protocol', () => {
    const removal = fixture.userRemovalConstraints[0] as any;
    const ledger = reversible.normalizeReversibleAdjustmentLedger({
      value: undefined,
      userRemovalConstraints: [removal],
      acceptedRevision: 1,
    });
    assert(ledger.protocolVersion === 1 && ledger.adjustments.length === 1,
      'legacy reversible record was not migrated');
    assert(ledger.adjustments[0].linkedUserRemovalConstraintIds.includes(removal.id),
      'legacy reversible ownership identity changed');
    const hydratedLedger = programStore.useProgramStore.getState().reversibleAdjustmentLedger;
    assert(hydratedLedger.protocolVersion === 1 && hydratedLedger.adjustments.some((adjustment) =>
      adjustment.linkedUserRemovalConstraintIds?.includes(removal.id)),
    `real ProgramStore hydration did not migrate legacy reversible ownership: ${JSON.stringify(hydratedLedger)}`);
  });

  await run('17 scalar fields never override typed components or exercises', () => {
    const mutant = mixedWorkout('scalar-mutant');
    mutant.workoutType = 'Recovery' as any;
    const protectedRecovery = programStore.canonicaliseHydratedState({
      dateOverrides: { [WEEK]: clone(mutant) }, userRemovalConstraints: [],
    } as any, { ingressKind: 'accepted_canonical' }) as any;
    mutant.workoutType = 'Conditioning' as any;
    const projected = programStore.canonicaliseHydratedState({
      dateOverrides: { [WEEK]: mutant }, userRemovalConstraints: [],
    } as any, { ingressKind: 'accepted_canonical' }) as any;
    assert(protectedRecovery.dateOverrides[WEEK].workoutType === 'Mixed',
      'recovery scalar overrode typed mixed components');
    assert(projected.dateOverrides[WEEK].workoutType === 'Mixed',
      'generic scalar overrode typed mixed components');
    assert(componentFingerprint(projected.dateOverrides[WEEK]) === componentFingerprint(mutant),
      'typed prescription changed during scalar repair');
  });

  await run('18 unsupported schema fails closed with an exact hydration reason', () => {
    let reason = '';
    try {
      ingress.requireProgramHydrationIngress(fixture, 99);
    } catch (error) {
      reason = (error as { reason?: string }).reason ?? '';
    }
    assert(reason === 'unsupported_program_store_persistence_version:99',
      `unexpected reason=${reason}`);
    const unsupportedBaseLedger = clone(fixture) as any;
    unsupportedBaseLedger.acceptedMaterialContext.acceptedCompositionBase.surfaces
      .reversibleAdjustmentLedger.protocolVersion = 99;
    reason = '';
    try {
      ingress.requireProgramHydrationIngress(unsupportedBaseLedger, 0);
    } catch (error) {
      reason = (error as { reason?: string }).reason ?? '';
    }
    assert(reason === 'unsupported_accepted_base_reversible_ledger_protocol:99',
      `unexpected accepted-base reason=${reason}`);
  });

  console.log(`\nProgram hydration ownership totals: passed=${passed}/18 failures=${failures.length}`);
  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
