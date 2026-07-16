/**
 * AcceptedCompositionBase + InjuryEpisodeTransaction permanent invariants.
 * Run: npm run test:injury-episode-transactions
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

import type { Workout } from '../types/domain';
import type {
  ActiveConstraint,
  ActiveInjuryConstraint,
} from '../store/coachUpdatesStore';
import type { ReversibleAdjustmentRecord } from '../rules/reversibleAdjustmentLedger';

const {
  createEmptyAcceptedMaterialContext,
  normalizeAcceptedMaterialContext,
} = require('../store/acceptedStateColdStart') as typeof import('../store/acceptedStateColdStart');
const {
  createEmptyReversibleAdjustmentLedger,
} = require('../rules/reversibleAdjustmentLedger') as typeof import('../rules/reversibleAdjustmentLedger');
const {
  asyncStorageDurable,
} = require('../store/asyncStorageCompat') as typeof import('../store/asyncStorageCompat');
const {
  useProgramStore,
  readDurableProgramStoreEnvelope,
} = require('../store/programStore') as typeof import('../store/programStore');
const {
  useCoachUpdatesStore,
} = require('../store/coachUpdatesStore') as typeof import('../store/coachUpdatesStore');
const {
  createOrUpdateInjuryEpisode,
  resolveInjuryEpisode,
} = require('../store/injuryEpisodeTransaction') as typeof import('../store/injuryEpisodeTransaction');
const {
  commitAcceptedStateTransaction,
} = require('../store/acceptedStateTransaction') as typeof import('../store/acceptedStateTransaction');
const {
  runCoachMutationTransaction,
  acceptedStateFingerprint,
} = require('../store/coachMutationTransaction') as typeof import('../store/coachMutationTransaction');
const {
  buildDayWorkoutProjectedDay,
} = require('../utils/visibleProgramReadModel') as typeof import('../utils/visibleProgramReadModel');
const {
  buildScheduleStateImperative,
} = require('../utils/coachWeekDiff') as typeof import('../utils/coachWeekDiff');
const {
  getActiveProgramModifiers,
} = require('../utils/activeProgramModifiers') as typeof import('../utils/activeProgramModifiers');
const {
  buildCoachNotesFromModifiers,
  dismissActiveCoachNote,
} = require('../utils/activeCoachNotes') as typeof import('../utils/activeCoachNotes');
const {
  detectConstraintResolution,
} = require('../utils/constraintResolutionDetector') as typeof import('../utils/constraintResolutionDetector');
const {
  semanticFingerprint,
} = require('../utils/programSemanticSnapshot') as typeof import('../utils/programSemanticSnapshot');
const {
  migrateLegacyInjuryEpisodes,
} = require('../rules/injuryEpisode') as typeof import('../rules/injuryEpisode');

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

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function exercise(name: string, index: number): Workout['exercises'][number] {
  const id = name.toLowerCase().replace(/\s+/g, '-');
  const pattern = name.includes('Deadlift')
    ? 'hinge'
    : name.includes('Press')
      ? 'push'
      : 'squat';
  const isAccessory = name.includes('Goblet');
  return {
    id: `row-${id}`,
    workoutId: 'injury-base-workout',
    exerciseId: id,
    exerciseOrder: index,
    prescribedSets: 3,
    prescribedRepsMin: 6,
    prescribedRepsMax: 8,
    restSeconds: 90,
    section18Evidence: {
      protocolVersion: 1,
      role: isAccessory ? 'strength_accessory' : 'main_strength',
      strengthPattern: pattern,
      mainStrengthPattern: isAccessory ? null : pattern,
      provenance: 'canonical_row_classifier',
    },
    exercise: {
      id,
      name,
      description: name,
      exerciseType: 'Compound',
      muscleGroups: [],
      equipmentRequired: [],
      difficultyLevel: 'Intermediate',
      createdAt: '',
      updatedAt: '',
    },
    createdAt: '',
    updatedAt: '',
  };
}

function baseWorkout(dayOfWeek = 1): Workout {
  return {
    id: 'injury-base-workout',
    microcycleId: 'injury-base-week',
    planEntryId: 'injury-base-entry',
    dayOfWeek,
    name: 'Full Body Strength',
    description: 'Transaction test session',
    durationMinutes: 60,
    intensity: 'Moderate',
    workoutType: 'Strength',
    sessionTier: 'core',
    hasCombinedConditioning: false,
    strengthIntent: {
      archetype: 'full_body',
      primaryPattern: 'hinge',
      plannedPatterns: ['hinge', 'push'],
      effectivePatterns: ['hinge', 'push'],
    },
    strengthPatternContributions: ['hinge', 'push'],
    section18Evidence: {
      protocolVersion: 1,
      conditioningRole: 'none',
      conditioningStress: 'unknown',
      provenance: 'planner_and_canonical_content',
    },
    exercises: [
      exercise('Romanian Deadlift', 0),
      exercise('Barbell Overhead Press', 1),
      exercise('Goblet Squat', 2),
    ],
    createdAt: '',
    updatedAt: '',
  };
}

function injury(args: {
  id: string;
  bodyPart: string;
  bucket: ActiveInjuryConstraint['bucket'];
}): ActiveInjuryConstraint {
  return {
    id: args.id,
    type: 'injury',
    bodyPart: args.bodyPart,
    bucket: args.bucket,
    severity: 6,
    status: 'active',
    startDate: '2026-07-20',
    lastUpdatedAt: '2026-07-20T09:00:00.000Z',
    source: 'guided_injury_flow',
    rules: args.bucket === 'hamstring'
      ? ['No sprinting or high-speed running', 'No heavy hinge work']
      : args.bucket === 'shoulder'
        ? ['No heavy pressing', 'No overhead loading']
        : [],
    safeFocus: ['Pain-free work for unaffected regions'],
    advice: [],
    modifierAffects: ['current_week', 'future_generation'],
    presentationOnlyDismiss: true,
  };
}

function visibleNames(date: string): string[] {
  const state = buildScheduleStateImperative();
  return buildDayWorkoutProjectedDay({
    date,
    todayISO: '2026-07-20',
    state,
    overrideContext: useProgramStore.getState().overrideContexts[date],
  }).workout?.exercises.map((row) => row.exercise?.name ?? row.exerciseId) ?? [];
}

function reset(date = '2026-07-20'): void {
  const fixtureAdjustment: ReversibleAdjustmentRecord = {
    protocolVersion: 1,
    id: 'reversible-adjustment:test:fixture-add',
    kind: 'game_fixture_add',
    sourceActor: 'athlete',
    sourceSurface: 'test',
    sourceActionOrIntentId: 'test-fixture-add',
    createdAt: '2026-07-19T09:00:00.000Z',
    acceptedRevision: 1,
    status: 'active',
    clearedAt: null,
    supersededById: null,
    supersededReason: null,
    affectedDates: ['2026-07-26'],
    affectedWeeks: ['2026-07-20'],
    rollingDependencyWeeks: [],
    displacedOriginalState: {
      ownedDays: [],
      ownedWeeks: [],
      calendarFacts: [{ date: '2026-07-26', before: null, after: 'game' }],
      userRemovalConstraint: null,
    },
    acceptedAfterSemanticFingerprints: [],
    restorationTarget: {
      kind: 'fixture_state',
      dates: ['2026-07-26'],
      stableIdentities: ['fixture:2026-07-26'],
    },
    linkedConstraintIds: [],
    linkedCalendarFacts: [{ date: '2026-07-26', before: null, after: 'game' }],
    linkedOverrideOwners: [],
    linkedOverlayIds: [],
    linkedUserRemovalConstraintIds: [],
    linkedProvenanceIds: [],
    linkedTypedReductions: [],
    validity: {
      reversible: true,
      source: 'runtime_exact_delta',
      validWhile: ['The fixture fact still matches the accepted after-state.'],
      invalidWhen: ['Newer athlete intent supersedes the fixture fact.'],
    },
    laterIntentPolicy: 'newer_athlete_intent_wins',
  };
  const accepted = {
    ...createEmptyAcceptedMaterialContext(),
    markedDays: { '2026-07-26': 'game' as const },
    revision: 1,
    lastTransaction: 'test:seed',
  };
  useProgramStore.setState({
    currentProgram: null,
    currentMicrocycle: null,
    todayWorkout: null,
    blockState: { blockNumber: 1, blockStartDate: '2026-07-13' },
    acceptedMaterialContext: accepted,
    dateOverrides: { [date]: baseWorkout(new Date(`${date}T12:00:00`).getDay()) },
    overrideContexts: {},
    weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: {
      ...createEmptyReversibleAdjustmentLedger(),
      adjustments: [fixtureAdjustment],
    },
    exposureContractsByWeek: {},
    sessionFeedback: {},
    weightOverrides: {},
  });
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
    useCoachUpdatesStore.persist.rehydrate(),
  ]);
  reset();
  const date = '2026-07-20';
  const movedDate = '2026-07-21';
  const rawBaseFingerprint = semanticFingerprint(useProgramStore.getState().dateOverrides);
  const ledgerFingerprint = semanticFingerprint(
    useProgramStore.getState().reversibleAdjustmentLedger,
  );
  const fixtureFingerprint = semanticFingerprint(
    useProgramStore.getState().acceptedMaterialContext.markedDays,
  );

  console.log('\n[1] create owns one durable episode and preserves the base');
  const hamstring = await createOrUpdateInjuryEpisode({
    constraint: injury({ id: 'injury-hamstring-primary', bodyPart: 'hamstring', bucket: 'hamstring' }),
    sourceActor: 'athlete',
    sourceSurface: 'test_guided_flow',
    note: 'Hamstring is 6/10',
    todayISO: date,
  });
  let createdContext = normalizeAcceptedMaterialContext(
    useProgramStore.getState().acceptedMaterialContext,
  );
  const hamstringId = hamstring.episodeId!;
  check('stable native episode created', !!hamstringId && createdContext.injuryEpisodes.length === 1);
  check('derived constraint carries exact episode id', createdContext.activeConstraints.some(
    (constraint) => constraint.type === 'injury' && constraint.injuryEpisodeId === hamstringId));
  check('accepted raw program remains the composition base',
    semanticFingerprint(useProgramStore.getState().dateOverrides) === rawBaseFingerprint);
  check('persisted base surfaces equal raw accepted surfaces',
    semanticFingerprint(createdContext.acceptedCompositionBase?.surfaces.dateOverrides) === rawBaseFingerprint);
  check('injury creates no reversible-ledger record', semanticFingerprint(
    useProgramStore.getState().reversibleAdjustmentLedger) === ledgerFingerprint);
  check('visible hamstring-risk work is removed', !visibleNames(date).includes('Romanian Deadlift'),
    visibleNames(date));
  check('unaffected pressing remains', visibleNames(date).includes('Barbell Overhead Press'), visibleNames(date));
  check('durable ProgramStore envelope exists', !!(await readDurableProgramStoreEnvelope()));
  const beforeReloadVisible = semanticFingerprint(visibleNames(date));
  await useProgramStore.persist.rehydrate();
  createdContext = normalizeAcceptedMaterialContext(
    useProgramStore.getState().acceptedMaterialContext,
  );
  check('create reload retains the exact active episode', createdContext.injuryEpisodes.some(
    (episode) => episode.episodeId === hamstringId && episode.status === 'active'));
  check('create reload retains the same visible prescription',
    semanticFingerprint(visibleNames(date)) === beforeReloadVisible, {
      beforeReloadVisible,
      afterReloadVisible: visibleNames(date),
      rawAfterReload: useProgramStore.getState().dateOverrides[date]?.exercises.map((row) =>
        row.exercise?.name ?? row.exerciseId),
    });

  console.log('\n[2] Dismiss Note is presentation-only and reload-stable');
  const notes = buildCoachNotesFromModifiers(getActiveProgramModifiers(), []);
  const injuryNote = notes.find((note) => note.injuryEpisodeId === hamstringId);
  const beforeDismissAccepted = acceptedStateFingerprint();
  const beforeDismissEpisode = semanticFingerprint(createdContext.injuryEpisodes);
  const beforeDismissRevision = createdContext.revision;
  check('injury note exposes Dismiss Note', injuryNote?.actions.some((action) =>
    action.kind === 'dismiss_note'));
  check('dismiss succeeds', !!injuryNote && dismissActiveCoachNote(injuryNote.id));
  await new Promise((resolve) => setTimeout(resolve, 10));
  const afterDismissContext = normalizeAcceptedMaterialContext(
    useProgramStore.getState().acceptedMaterialContext,
  );
  check('dismiss leaves accepted state unchanged', acceptedStateFingerprint() === beforeDismissAccepted);
  check('dismiss leaves episode unchanged', semanticFingerprint(afterDismissContext.injuryEpisodes) ===
    beforeDismissEpisode);
  check('dismiss leaves accepted revision unchanged', afterDismissContext.revision === beforeDismissRevision);
  const dismissedIds = [...useCoachUpdatesStore.getState().dismissedCoachNoteIds];
  const dismissedEnvelope = await asyncStorageDurable.getItem('coach-updates');
  useCoachUpdatesStore.setState({ dismissedCoachNoteIds: [] });
  if (dismissedEnvelope) await asyncStorageDurable.setItem('coach-updates', dismissedEnvelope);
  await useCoachUpdatesStore.persist.rehydrate();
  check('dismissed note id survives reload', dismissedIds.every((id) =>
    useCoachUpdatesStore.getState().dismissedCoachNoteIds.includes(id)));

  console.log('\n[3] multiple injuries resolve independently');
  const shoulder = await createOrUpdateInjuryEpisode({
    constraint: injury({ id: 'injury-shoulder-primary', bodyPart: 'shoulder', bucket: 'shoulder' }),
    sourceActor: 'athlete',
    sourceSurface: 'test_guided_flow',
    note: 'Shoulder is 6/10',
    todayISO: date,
  });
  const shoulderId = shoulder.episodeId!;
  check('two active episodes coexist', normalizeAcceptedMaterialContext(
    useProgramStore.getState().acceptedMaterialContext).injuryEpisodes.filter((episode) =>
      episode.status === 'active' || episode.status === 'improving').length === 2);
  check('all active episodes compose simultaneously',
    !visibleNames(date).includes('Romanian Deadlift') &&
      !visibleNames(date).includes('Barbell Overhead Press'),
    visibleNames(date));
  const hamstringResolved = await resolveInjuryEpisode(hamstringId, {
    todayISO: date,
    sourceActor: 'athlete',
    sourceSurface: 'test_injury_resolved',
    note: 'Hamstring resolved',
  });
  const afterOneResolve = normalizeAcceptedMaterialContext(
    useProgramStore.getState().acceptedMaterialContext,
  );
  check('resolved episode and append-only history remain', afterOneResolve.injuryEpisodes.some(
    (episode) => episode.episodeId === hamstringId && episode.status === 'resolved' &&
      episode.transitionHistory.length === 2));
  check('other injury remains active with independent history', afterOneResolve.injuryEpisodes.some(
    (episode) => episode.episodeId === shoulderId && episode.status === 'active' &&
      episode.transitionHistory.length === 1));
  check('hamstring content recomposes while shoulder restriction remains',
    visibleNames(date).includes('Romanian Deadlift') && !visibleNames(date).includes('Barbell Overhead Press'),
    visibleNames(date));
  check('resolution reports verified outcome', hamstringResolved.outcome === 'resolved_and_recomposed' ||
    hamstringResolved.outcome === 'resolved_no_program_change', hamstringResolved);

  console.log('\n[4] later accepted move survives injury resolution');
  const movedWorkout = clone(useProgramStore.getState().dateOverrides[date]);
  movedWorkout.dayOfWeek = new Date(`${movedDate}T12:00:00`).getDay();
  const move = await runCoachMutationTransaction({
    todayISO: date,
    extraDates: [date, movedDate],
    mutate: () => commitAcceptedStateTransaction({
      reason: 'test:athlete_move_during_injury',
      program: {
        dateOverrides: { [movedDate]: movedWorkout },
        overrideContexts: {},
      },
      validateWeekStarts: [],
    }),
    didApply: () => true,
  });
  check('accepted move commits while injury is active', move.ok);
  const resolvedShoulder = await resolveInjuryEpisode(shoulderId, {
    todayISO: date,
    sourceActor: 'athlete',
    sourceSurface: 'test_injury_resolved',
  });
  check('moved source date stays empty after resolution', !useProgramStore.getState().dateOverrides[date]);
  check('moved destination survives resolution', !!useProgramStore.getState().dateOverrides[movedDate]);
  check('resolved destination recomposes from current base',
    visibleNames(movedDate).includes('Barbell Overhead Press') && visibleNames(movedDate).includes('Romanian Deadlift'),
    visibleNames(movedDate));
  check('second resolution is verified', resolvedShoulder.outcome === 'resolved_and_recomposed' ||
    resolvedShoulder.outcome === 'resolved_no_program_change');
  check('fixture state survives create/update/resolve', semanticFingerprint(
    useProgramStore.getState().acceptedMaterialContext.markedDays) === fixtureFingerprint);
  check('existing reversible-adjustment ownership survives', semanticFingerprint(
    useProgramStore.getState().reversibleAdjustmentLedger) === ledgerFingerprint);
  check('fixture restoration record remains active and singular',
    useProgramStore.getState().reversibleAdjustmentLedger.adjustments.length === 1 &&
    useProgramStore.getState().reversibleAdjustmentLedger.adjustments[0]?.id ===
      'reversible-adjustment:test:fixture-add' &&
    useProgramStore.getState().reversibleAdjustmentLedger.adjustments[0]?.status === 'active');

  console.log('\n[5] unrelated facts and generic all-good remain safe');
  const fatigue: ActiveConstraint = {
    id: 'fatigue-test-active',
    type: 'fatigue',
    severity: 9,
    status: 'active',
    startDate: date,
    lastUpdatedAt: `${date}T10:00:00.000Z`,
    reasonLabel: 'Fatigue',
    rules: ['No max-effort work', 'No sprinting or plyometrics'],
    safeFocus: ['Recovery and easy aerobic work'],
    advice: ['Prioritise sleep and recovery'],
  };
  const beforeFatigueVisible = semanticFingerprint(visibleNames(movedDate));
  useCoachUpdatesStore.getState().upsertActiveConstraint(fatigue);
  const fatigueVisible = semanticFingerprint(visibleNames(movedDate));
  check('unrelated fact has its own visible program effect',
    fatigueVisible !== beforeFatigueVisible, { beforeFatigueVisible, fatigueVisible });
  const third = await createOrUpdateInjuryEpisode({
    constraint: injury({ id: 'injury-hamstring-third', bodyPart: 'hamstring', bucket: 'hamstring' }),
    sourceActor: 'athlete',
    sourceSurface: 'test_guided_flow',
    todayISO: date,
  });
  const allGood = detectConstraintResolution('all good now', normalizeAcceptedMaterialContext(
    useProgramStore.getState().acceptedMaterialContext).activeConstraints);
  check('generic all-good with multiple facts requires clarification', allGood.ambiguous &&
    allGood.constraintIdsToResolve.length === 0, allGood);
  await resolveInjuryEpisode(third.episodeId!, { todayISO: date });
  check('resolving injury preserves unrelated constraint', normalizeAcceptedMaterialContext(
    useProgramStore.getState().acceptedMaterialContext).activeConstraints.some((constraint) =>
      constraint.id === fatigue.id));
  check('resolving injury preserves the unrelated fact program effect',
    semanticFingerprint(visibleNames(movedDate)) === fatigueVisible, {
      expected: fatigueVisible,
      actual: semanticFingerprint(visibleNames(movedDate)),
    });

  console.log('\n[6] compatibility hydration cannot reactivate resolved episodes');
  const staleConstraint = injury({
    id: 'injury-hamstring-third',
    bodyPart: 'hamstring',
    bucket: 'hamstring',
  });
  useCoachUpdatesStore.setState({
    activeConstraints: [fatigue, staleConstraint],
    activeInjury: {
      bodyPart: 'hamstring',
      bucket: 'hamstring',
      severity: 6,
      initialSeverity: 6,
      status: 'active',
      rules: staleConstraint.rules,
      startDate: date,
      createdAt: `${date}T09:00:00.000Z`,
      lastUpdatedAt: `${date}T09:00:00.000Z`,
      history: [],
    },
  });
  check('stale mirror is immediately replaced by episode projection',
    !useCoachUpdatesStore.getState().activeConstraints.some((constraint) =>
      constraint.type === 'injury'));
  check('resolved canonical episode remains resolved', normalizeAcceptedMaterialContext(
    useProgramStore.getState().acceptedMaterialContext).injuryEpisodes.find((episode) =>
      episode.episodeId === third.episodeId)?.status === 'resolved');

  console.log('\n[7] legacy after-state-only migration is honest');
  const legacyEpisodes = migrateLegacyInjuryEpisodes({
    activeConstraints: [staleConstraint],
    activeInjury: useCoachUpdatesStore.getState().activeInjury,
    sourceSurface: 'test_legacy_hydration',
  });
  check('legacy episode gets stable provable id', legacyEpisodes[0]?.episodeId ===
    'injury-episode:legacy:injury-hamstring-third');
  check('legacy missing-before-state is marked after-state-only', legacyEpisodes[0]?.legacyMigrationStatus ===
    'legacy_after_state_only');

  console.log('\n[8] durable state and semantic rollback boundary remain inspectable');
  check('durable envelope contains episode history', /injuryEpisodes/.test(
    (await readDurableProgramStoreEnvelope()) ?? ''));
  check('accepted base keeps latest moved athlete intent', !!normalizeAcceptedMaterialContext(
    useProgramStore.getState().acceptedMaterialContext).acceptedCompositionBase
    ?.surfaces.dateOverrides[movedDate]);

  console.log('\n[9] every failure boundary rolls back exact memory and storage');
  const failureCases: Array<[
    string,
    NonNullable<Parameters<typeof createOrUpdateInjuryEpisode>[0]['testHooks']>,
  ]> = [
    ['failed staging', { beforeStage: () => { throw new Error('forced_staging_failure'); } }],
    ['failed Bible/gateway validation', {
      beforeEffectiveValidation: () => { throw new Error('forced_gateway_failure'); },
    }],
    ['failed visible verification', { verifyCandidate: () => false }],
    ['failed persistence/readback verification', { verifyAfterPersistence: () => false }],
  ];
  for (const [label, testHooks] of failureCases) {
    reset();
    await new Promise((resolve) => setTimeout(resolve, 10));
    const beforeMemory = acceptedStateFingerprint();
    const beforeStorage = await readDurableProgramStoreEnvelope();
    const rejected = await createOrUpdateInjuryEpisode({
      constraint: injury({
        id: `injury-failure-${label.replace(/\s+/g, '-')}`,
        bodyPart: 'hamstring',
        bucket: 'hamstring',
      }),
      sourceActor: 'athlete',
      sourceSurface: 'test_failure_boundary',
      todayISO: date,
      testHooks,
    });
    check(`${label}: no success outcome`, rejected.outcome === 'safely_rejected', rejected);
    check(`${label}: exact accepted memory rollback`, acceptedStateFingerprint() === beforeMemory);
    check(`${label}: exact durable storage rollback`,
      (await readDurableProgramStoreEnvelope()) === beforeStorage);
    check(`${label}: no episode published`, normalizeAcceptedMaterialContext(
      useProgramStore.getState().acceptedMaterialContext).injuryEpisodes.length === 0);
  }

  console.log('\n[10] every resolution outcome is explicit and honest');
  reset();
  const noImpact = await createOrUpdateInjuryEpisode({
    constraint: injury({ id: 'injury-unknown-no-impact', bodyPart: 'unknown', bucket: null }),
    sourceActor: 'athlete',
    sourceSurface: 'test_no_impact',
    todayISO: date,
  });
  const noImpactResolved = await resolveInjuryEpisode(noImpact.episodeId!, { todayISO: date });
  check('no-impact resolution reports no program change',
    noImpactResolved.outcome === 'resolved_no_program_change' && !noImpactResolved.changedProgram,
    noImpactResolved);
  const alreadyResolved = await resolveInjuryEpisode(noImpact.episodeId!, { todayISO: date });
  check('repeat resolution is idempotent and explicit',
    alreadyResolved.outcome === 'already_resolved' && !alreadyResolved.changedProgram,
    alreadyResolved);

  reset();
  const conflictCandidate = await createOrUpdateInjuryEpisode({
    constraint: injury({ id: 'injury-conflict', bodyPart: 'hamstring', bucket: 'hamstring' }),
    sourceActor: 'athlete',
    sourceSurface: 'test_conflict',
    todayISO: date,
  });
  const currentRevision = normalizeAcceptedMaterialContext(
    useProgramStore.getState().acceptedMaterialContext).revision;
  const conflicted = await resolveInjuryEpisode(conflictCandidate.episodeId!, {
    todayISO: date,
    expectedAcceptedRevision: currentRevision - 1,
  });
  check('stale resolution reports a conflict', conflicted.outcome === 'conflicted', conflicted);
  check('conflicted resolution leaves the episode active', activeInjuryEpisodesForTest().some(
    (episode) => episode.episodeId === conflictCandidate.episodeId));
  const safelyRejected = await resolveInjuryEpisode(conflictCandidate.episodeId!, {
    todayISO: date,
    testHooks: { verifyCandidate: () => false },
  });
  check('unverified resolution is safely rejected', safelyRejected.outcome === 'safely_rejected',
    safelyRejected);
  check('rejected resolution leaves the episode active', activeInjuryEpisodesForTest().some(
    (episode) => episode.episodeId === conflictCandidate.episodeId));
  reset();
  const seriousConstraint = {
    ...injury({ id: 'injury-serious-pause', bodyPart: 'head/neck', bucket: null }),
    seriousSymptoms: true,
    seriousSymptom: 'red flag',
    adjustmentLevel: 'training_paused' as const,
    rules: ['Pause training'],
    safeFocus: ['Recovery guidance only'],
  };
  const serious = await createOrUpdateInjuryEpisode({
    constraint: seriousConstraint,
    sourceActor: 'athlete',
    sourceSurface: 'test_serious_pause',
    todayISO: date,
  });
  const seriousVisible = buildDayWorkoutProjectedDay({
    date,
    todayISO: date,
    state: buildScheduleStateImperative(),
  }).workout;
  check('typed serious-symptom policy pauses visible training',
    seriousVisible === null || (
      seriousVisible.workoutType === 'Recovery' && seriousVisible.exercises.length === 0
    ),
    seriousVisible);
  check('serious pause still preserves the accepted strength base',
    useProgramStore.getState().dateOverrides[date]?.workoutType === 'Strength' &&
    normalizeAcceptedMaterialContext(useProgramStore.getState().acceptedMaterialContext)
      .injuryEpisodes.find((episode) => episode.episodeId === serious.episodeId)
      ?.seriousSymptoms === true);

  console.log('\n[11] legacy after-state resolution never fabricates restoration');
  reset();
  const legacyConstraint = injury({
    id: 'injury-legacy-after-state',
    bodyPart: 'hamstring',
    bucket: 'hamstring',
  });
  const legacyAlias = {
    bodyPart: 'hamstring',
    bucket: 'hamstring' as const,
    severity: 6,
    initialSeverity: 6,
    status: 'active' as const,
    rules: [...legacyConstraint.rules],
    startDate: date,
    createdAt: `${date}T09:00:00.000Z`,
    lastUpdatedAt: `${date}T09:00:00.000Z`,
    history: [],
  };
  commitAcceptedStateTransaction({
    reason: 'test:legacy_injury_seed',
    activeConstraints: [legacyConstraint],
    activeInjury: legacyAlias,
  });
  useCoachUpdatesStore.setState({
    activeConstraints: [legacyConstraint],
    activeInjury: legacyAlias,
  });
  const legacyResolved = await resolveInjuryEpisode(
    'injury-episode:legacy:injury-legacy-after-state',
    { todayISO: date },
  );
  const legacyContext = normalizeAcceptedMaterialContext(
    useProgramStore.getState().acceptedMaterialContext);
  check('legacy resolution uses the required honest wording', legacyResolved.message ===
    'Injury restrictions ended and affected sessions were refreshed.', legacyResolved);
  check('legacy resolution records after-state-only provenance',
    legacyContext.acceptedCompositionBase?.provenance === 'legacy_after_state_only' &&
    legacyContext.injuryEpisodes.some((episode) =>
      episode.episodeId === legacyResolved.episodeId && episode.status === 'resolved' &&
      episode.legacyMigrationStatus === 'legacy_after_state_only'));

  console.log('\n[12] create -> reload -> resolve equals create -> resolve');
  const runReloadParityScenario = async (reload: boolean): Promise<string> => {
    reset();
    const created = await createOrUpdateInjuryEpisode({
      constraint: injury({
        id: 'injury-reload-parity',
        bodyPart: 'hamstring',
        bucket: 'hamstring',
      }),
      sourceActor: 'athlete',
      sourceSurface: 'test_reload_parity',
      todayISO: date,
    });
    if (reload) await useProgramStore.persist.rehydrate();
    await resolveInjuryEpisode(created.episodeId!, { todayISO: date });
    const context = normalizeAcceptedMaterialContext(
      useProgramStore.getState().acceptedMaterialContext);
    return semanticFingerprint({
      surfaces: context.acceptedCompositionBase?.surfaces,
      visible: visibleNames(date),
      episodes: context.injuryEpisodes.map((episode) => ({
        bodyPart: episode.bodyPart,
        bucket: episode.bucket,
        status: episode.status,
        transitionStatuses: episode.transitionHistory.map((entry) => entry.toStatus),
      })),
      constraints: context.activeConstraints.map((constraint) => ({
        id: constraint.id,
        type: constraint.type,
        status: constraint.status,
      })),
    });
  };
  const directResolution = await runReloadParityScenario(false);
  const reloadedResolution = await runReloadParityScenario(true);
  check('reload does not change resolution semantics', reloadedResolution === directResolution, {
    directResolution,
    reloadedResolution,
  });

  if (failures.length > 0) {
    console.error(`\n${failures.length} failure(s):\n${failures.join('\n')}`);
    process.exit(1);
  }
  console.log(`\n[injuryEpisodeTransaction] ${passed} passed, 0 failed`);
}

function activeInjuryEpisodesForTest() {
  return normalizeAcceptedMaterialContext(
    useProgramStore.getState().acceptedMaterialContext,
  ).injuryEpisodes.filter((episode) =>
    episode.status === 'active' || episode.status === 'improving');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
