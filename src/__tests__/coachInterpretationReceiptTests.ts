import {
  COACH_INTERPRETATION_RECEIPT_SCHEMA_VERSION,
  CoachInterpretationReceiptValidationError,
  coachInterpretationReceiptSemanticHash,
  coachInterpretationSemanticHash,
  createCoachInterpretationReceiptV1,
  evaluateCoachReplayEligibilityV1,
  stableCoachInterpretationReceiptJson,
  validateCoachInterpretationReceiptV1,
  type CoachClassifiedInterpretationReceiptDraftV1,
  type CoachInterpretationReceiptV1,
  type CoachResolvedTargetReceiptV1,
} from '../dev/e2e/coachInterpretationReceipt';

let passed = 0;
let failed = 0;

function test(name: string, run: () => void): void {
  try {
    run();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  ✗ ${name}`, error);
  }
}

function expect(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function equal(actual: unknown, expected: unknown, message: string): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${message}\nexpected=${expectedJson}\nactual=${actualJson}`);
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach((child) => deepFreeze(child));
  }
  return value;
}

function expectReceiptError(
  run: () => unknown,
  options: { readonly code?: string; readonly pathIncludes?: string } = {},
): void {
  try {
    run();
  } catch (error) {
    expect(
      error instanceof CoachInterpretationReceiptValidationError,
      'expected CoachInterpretationReceiptValidationError',
    );
    const receiptError = error as CoachInterpretationReceiptValidationError;
    if (options.code) {
      expect(
        receiptError.issues.some((issue) => issue.code === options.code),
        `expected issue code ${options.code}; got ${receiptError.issues
          .map((issue) => issue.code)
          .join(', ')}`,
      );
    }
    if (options.pathIncludes) {
      expect(
        receiptError.issues.some((issue) => issue.path.includes(options.pathIncludes as string)),
        `expected issue path containing ${options.pathIncludes}`,
      );
    }
    return;
  }
  throw new Error('expected receipt validation to reject the input');
}

const MESSAGE_HASH = coachInterpretationSemanticHash({ normalizedMessage: 'fixture-change-1' });
const CLOCK_HASH = coachInterpretationSemanticHash({
  protocolVersion: 1,
  seedId: 'standard-in-season',
  anchorInstant: '2026-07-17T02:00:00.000Z',
  timezone: 'Australia/Melbourne',
});
const CONTEXT_HASH = coachInterpretationSemanticHash({
  acceptedRevision: 7,
  visibleWeekId: 'week-2026-07-13',
  stableTargetIds: ['fixture-1', 'session-1'],
});

const FIXTURE_TARGET: CoachResolvedTargetReceiptV1 = {
  kind: 'fixture',
  action: 'move',
  fixtureKind: 'game',
  sourceDate: '2026-07-18',
  targetDate: '2026-07-19',
  acceptedRevision: 7,
};

function classifiedDraft(
  intentKind: CoachClassifiedInterpretationReceiptDraftV1['intentKind'],
  resolvedTarget: CoachResolvedTargetReceiptV1 | null,
  overrides: Partial<CoachClassifiedInterpretationReceiptDraftV1> = {},
): CoachClassifiedInterpretationReceiptDraftV1 {
  return {
    messageSemanticHash: MESSAGE_HASH,
    classifierSchemaVersion: 'coach-intent-v1',
    classifierPromptVersion: 'coach-prompt-v4',
    interpretationProvider: 'semantic_service',
    intentKind,
    confidenceBucket: 'high',
    needsClarification: false,
    classificationStatus: 'classified',
    clockFingerprint: CLOCK_HASH,
    canonicalContextFingerprint: CONTEXT_HASH,
    clarification: { kind: 'none' },
    resolvedTarget,
    ...overrides,
  };
}

function fixtureReceipt(): CoachInterpretationReceiptV1 {
  return createCoachInterpretationReceiptV1(
    classifiedDraft('fixture_change', FIXTURE_TARGET),
  );
}

test('valid classified fixture receipt is canonical and privacy-safe', () => {
  const receipt = fixtureReceipt();
  const parsed = validateCoachInterpretationReceiptV1(receipt);
  expect(parsed.schemaVersion === 1, 'wrong schema version');
  if (parsed.classificationStatus !== 'classified') {
    throw new Error('fixture receipt was not classified');
  }
  expect(parsed.resolvedTarget?.kind === 'fixture', 'fixture target was lost');
  expect(parsed.resolvedTarget?.acceptedRevision === 7, 'accepted revision was lost');
  expect(!stableCoachInterpretationReceiptJson(parsed).includes('fixture-change-1'),
    'raw-like message identity leaked into receipt serialization');
});

test('valid new injury report uses the explicit new-report marker', () => {
  const receipt = createCoachInterpretationReceiptV1(classifiedDraft('injury_report', {
    kind: 'injury',
    operation: 'report',
    episodeTarget: { kind: 'new-report' },
    bodyPartToken: 'hamstring',
    severity: 'moderate',
    acceptedRevision: 8,
  }));
  expect(receipt.classificationStatus === 'classified' &&
    receipt.resolvedTarget?.kind === 'injury' &&
    receipt.resolvedTarget.episodeTarget.kind === 'new-report',
  'new injury report did not preserve its typed marker');
});

test('valid injury update requires and preserves an exact episode ID', () => {
  const receipt = createCoachInterpretationReceiptV1(classifiedDraft('injury_update', {
    kind: 'injury',
    operation: 'update',
    episodeTarget: { kind: 'existing-episode', episodeId: 'injury-episode-17' },
    bodyPartToken: 'lower-limb',
    severity: 'minor',
    acceptedRevision: 9,
  }));
  expect(receipt.classificationStatus === 'classified' &&
    receipt.resolvedTarget?.kind === 'injury' &&
    receipt.resolvedTarget.episodeTarget.kind === 'existing-episode' &&
    receipt.resolvedTarget.episodeTarget.episodeId === 'injury-episode-17',
  'exact injury episode identity was not retained');
});

test('valid session and source-fact targets retain stable identities', () => {
  const session = createCoachInterpretationReceiptV1(classifiedDraft('session_change', {
    kind: 'session',
    sessionId: 'session-17',
    componentId: 'component-power',
    sourceDate: '2026-07-17',
    targetDate: '2026-07-18',
    acceptedRevision: 10,
  }));
  const sourceFact = createCoachInterpretationReceiptV1(classifiedDraft('source_fact_change', {
    kind: 'source-fact',
    factKind: 'equipment',
    factId: 'equipment-fact-3',
    operation: 'clear',
    acceptedRevision: 11,
  }));
  expect(session.classificationStatus === 'classified' &&
    session.resolvedTarget?.kind === 'session' &&
    session.resolvedTarget.componentId === 'component-power',
  'session/component target was not retained');
  expect(sourceFact.classificationStatus === 'classified' &&
    sourceFact.resolvedTarget?.kind === 'source-fact' &&
    sourceFact.resolvedTarget.factId === 'equipment-fact-3',
  'source-fact target was not retained');
});

test('genuine conversation is classified with no mutation target', () => {
  const receipt = createCoachInterpretationReceiptV1(
    classifiedDraft('general_conversation', null, { confidenceBucket: 'medium' }),
  );
  expect(receipt.classificationStatus === 'classified' && receipt.resolvedTarget === null,
    'general conversation invented a mutation target');
});

test('valid unavailable classification has no intent or resolved target', () => {
  const receipt = createCoachInterpretationReceiptV1({
    messageSemanticHash: MESSAGE_HASH,
    classifierSchemaVersion: 'coach-intent-v1',
    classifierPromptVersion: 'coach-prompt-v4',
    interpretationProvider: 'semantic_service',
    confidenceBucket: 'unavailable',
    needsClarification: false,
    classificationStatus: 'unavailable',
    unavailableReason: 'semantic_service_unavailable',
    clockFingerprint: CLOCK_HASH,
    canonicalContextFingerprint: CONTEXT_HASH,
    clarification: { kind: 'none' },
  });
  expect(receipt.classificationStatus === 'unavailable' &&
    !('intentKind' in receipt) && !('resolvedTarget' in receipt),
  'unavailable receipt contained a resolved interpretation');
});

test('unknown fields and environment-specific fields are rejected', () => {
  const unknown = clone(fixtureReceipt()) as unknown as Record<string, unknown>;
  unknown.absolutePath = '/Users/person/worktree';
  unknown.metroPort = 8081;
  expectReceiptError(() => validateCoachInterpretationReceiptV1(unknown), {
    code: 'unknown-field',
    pathIncludes: 'absolutePath',
  });
});

test('raw message, reply, and injury-note fields are privacy-forbidden', () => {
  for (const field of ['rawMessage', 'reply', 'injuryNote']) {
    const unsafe = clone(fixtureReceipt()) as unknown as Record<string, unknown>;
    unsafe[field] = 'private athlete wording';
    expectReceiptError(() => validateCoachInterpretationReceiptV1(unsafe), {
      code: 'privacy-forbidden-field',
      pathIncludes: field,
    });
  }
});

test('invalid hashes are rejected', () => {
  const invalid = clone(fixtureReceipt()) as unknown as Record<string, unknown>;
  invalid.messageSemanticHash = 'not-a-hash';
  expectReceiptError(() => validateCoachInterpretationReceiptV1(invalid), {
    code: 'invalid-hash',
    pathIncludes: 'messageSemanticHash',
  });
});

test('unsupported schema versions are rejected', () => {
  const invalid = clone(fixtureReceipt()) as unknown as Record<string, unknown>;
  invalid.schemaVersion = 2;
  expectReceiptError(() => validateCoachInterpretationReceiptV1(invalid), {
    code: 'unsupported-schema-version',
  });
});

test('classified receipts without an intent are rejected', () => {
  const invalid = clone(fixtureReceipt()) as unknown as Record<string, unknown>;
  delete invalid.intentKind;
  expectReceiptError(() => validateCoachInterpretationReceiptV1(invalid), {
    code: 'missing-field',
    pathIncludes: 'intentKind',
  });
});

test('unavailable receipts containing a resolved target are rejected', () => {
  const unavailable = createCoachInterpretationReceiptV1({
    messageSemanticHash: MESSAGE_HASH,
    classifierSchemaVersion: 'coach-intent-v1',
    classifierPromptVersion: 'coach-prompt-v4',
    interpretationProvider: 'deterministic',
    confidenceBucket: 'unavailable',
    needsClarification: false,
    classificationStatus: 'unavailable',
    unavailableReason: 'invalid_response',
    clockFingerprint: CLOCK_HASH,
    canonicalContextFingerprint: CONTEXT_HASH,
    clarification: { kind: 'none' },
  });
  const invalid = clone(unavailable) as unknown as Record<string, unknown>;
  invalid.resolvedTarget = FIXTURE_TARGET;
  expectReceiptError(() => validateCoachInterpretationReceiptV1(invalid), {
    code: 'invalid-combination',
    pathIncludes: 'resolvedTarget',
  });
});

test('mutation target without accepted revision is rejected', () => {
  const invalid = clone(fixtureReceipt()) as unknown as {
    resolvedTarget: Record<string, unknown>;
  };
  delete invalid.resolvedTarget.acceptedRevision;
  expectReceiptError(() => validateCoachInterpretationReceiptV1(invalid), {
    code: 'missing-field',
    pathIncludes: 'acceptedRevision',
  });
});

test('fixture action/date mismatch is rejected', () => {
  const invalid = clone(fixtureReceipt()) as unknown as {
    resolvedTarget: Record<string, unknown>;
  };
  invalid.resolvedTarget.action = 'add';
  expectReceiptError(() => validateCoachInterpretationReceiptV1(invalid), {
    code: 'invalid-combination',
    pathIncludes: 'resolvedTarget',
  });
});

test('injury update without an exact episode ID is rejected', () => {
  const valid = createCoachInterpretationReceiptV1(classifiedDraft('injury_update', {
    kind: 'injury',
    operation: 'update',
    episodeTarget: { kind: 'existing-episode', episodeId: 'episode-1' },
    bodyPartToken: 'ankle',
    severity: 'minor',
    acceptedRevision: 12,
  }));
  const invalid = clone(valid) as unknown as {
    resolvedTarget: { episodeTarget: Record<string, unknown> };
  };
  delete invalid.resolvedTarget.episodeTarget.episodeId;
  expectReceiptError(() => validateCoachInterpretationReceiptV1(invalid), {
    code: 'missing-field',
    pathIncludes: 'episodeId',
  });
});

test('new injury report pretending to target an episode is rejected', () => {
  const valid = createCoachInterpretationReceiptV1(classifiedDraft('injury_report', {
    kind: 'injury',
    operation: 'report',
    episodeTarget: { kind: 'new-report' },
    bodyPartToken: 'knee',
    severity: 'moderate',
    acceptedRevision: 13,
  }));
  const invalid = clone(valid) as unknown as {
    resolvedTarget: Record<string, unknown>;
  };
  invalid.resolvedTarget.episodeTarget = {
    kind: 'existing-episode',
    episodeId: 'episode-existing',
  };
  expectReceiptError(() => validateCoachInterpretationReceiptV1(invalid), {
    code: 'invalid-combination',
    pathIncludes: 'resolvedTarget',
  });
});

test('clarification state is typed and consistent with needsClarification', () => {
  const pending = createCoachInterpretationReceiptV1(classifiedDraft('session_change', null, {
    confidenceBucket: 'low',
    needsClarification: true,
    clarification: {
      kind: 'target',
      candidateIdentities: ['session-2', 'session-1'],
      pendingStateSemanticHash: coachInterpretationSemanticHash({ pending: 'session-target' }),
    },
  }));
  expect(pending.classificationStatus === 'classified' &&
    pending.clarification.kind === 'target' &&
    pending.clarification.candidateIdentities.join(',') === 'session-1,session-2',
  'clarification candidates were not canonically normalized');

  const inconsistent = clone(pending) as unknown as Record<string, unknown>;
  inconsistent.needsClarification = false;
  expectReceiptError(() => validateCoachInterpretationReceiptV1(inconsistent), {
    code: 'invalid-combination',
    pathIncludes: 'needsClarification',
  });
});

test('serialization and receipt hashing are deterministic across key order', () => {
  const receipt = fixtureReceipt();
  const reordered = Object.fromEntries(Object.entries(receipt).reverse());
  expect(
    stableCoachInterpretationReceiptJson(receipt) ===
      stableCoachInterpretationReceiptJson(reordered),
    'stable serialization changed with key insertion order',
  );
  expect(
    coachInterpretationReceiptSemanticHash(receipt) ===
      coachInterpretationReceiptSemanticHash(reordered),
    'receipt hash changed with key insertion order',
  );
});

test('receipt creation does not mutate its input', () => {
  const draft = deepFreeze(classifiedDraft('fixture_change', clone(FIXTURE_TARGET)));
  const before = JSON.stringify(draft);
  createCoachInterpretationReceiptV1(draft);
  expect(JSON.stringify(draft) === before, 'receipt builder mutated its input');
});

test('same input produces the same receipt hash', () => {
  const draft = classifiedDraft('fixture_change', FIXTURE_TARGET);
  const first = createCoachInterpretationReceiptV1(draft);
  const second = createCoachInterpretationReceiptV1(clone(draft));
  expect(first.receiptId === second.receiptId, 'identical inputs produced different receipt IDs');
});

test('semantic identity covers provider, target revision, clarification, and context', () => {
  const base = fixtureReceipt().receiptId;
  const provider = createCoachInterpretationReceiptV1(classifiedDraft(
    'fixture_change', FIXTURE_TARGET, { interpretationProvider: 'deterministic' },
  )).receiptId;
  const revision = createCoachInterpretationReceiptV1(classifiedDraft('fixture_change', {
    ...FIXTURE_TARGET as Extract<CoachResolvedTargetReceiptV1, { kind: 'fixture' }>,
    acceptedRevision: 8,
  })).receiptId;
  const context = createCoachInterpretationReceiptV1(classifiedDraft(
    'fixture_change', FIXTURE_TARGET, {
      canonicalContextFingerprint: coachInterpretationSemanticHash({ context: 'different' }),
    },
  )).receiptId;
  expect(new Set([base, provider, revision, context]).size === 4,
    'a required semantic field was omitted from receipt identity');
});

test('context mismatch blocks replay without reinterpretation', () => {
  const receipt = fixtureReceipt();
  const result = evaluateCoachReplayEligibilityV1(receipt, {
    canonicalContextFingerprint: coachInterpretationSemanticHash({ context: 'mismatch' }),
    clockFingerprint: CLOCK_HASH,
    coachMessageCapabilityEnabled: true,
  });
  expect(result.status === 'context_mismatch', `unexpected status ${result.status}`);
});

test('clock mismatch blocks replay', () => {
  const result = evaluateCoachReplayEligibilityV1(fixtureReceipt(), {
    canonicalContextFingerprint: CONTEXT_HASH,
    clockFingerprint: coachInterpretationSemanticHash({ clock: 'mismatch' }),
    coachMessageCapabilityEnabled: true,
  });
  expect(result.status === 'clock_mismatch', `unexpected status ${result.status}`);
});

test('coach.message remains capability-disabled by default', () => {
  const result = evaluateCoachReplayEligibilityV1(fixtureReceipt(), {
    canonicalContextFingerprint: CONTEXT_HASH,
    clockFingerprint: CLOCK_HASH,
  });
  expect(result.status === 'capability_disabled', `unexpected status ${result.status}`);
  expect(result.status !== 'capability_disabled' || result.capabilityId === 'coach.message',
    'wrong capability was checked');
});

test('replay receipt requires an available source interpretation receipt hash', () => {
  const source = fixtureReceipt();
  const replay = createCoachInterpretationReceiptV1(classifiedDraft('fixture_change', FIXTURE_TARGET, {
    interpretationProvider: 'replay',
    sourceInterpretationReceiptHash: source.receiptId,
  }));
  const missing = evaluateCoachReplayEligibilityV1(replay, {
    canonicalContextFingerprint: CONTEXT_HASH,
    clockFingerprint: CLOCK_HASH,
    coachMessageCapabilityEnabled: true,
  });
  expect(missing.status === 'missing_source_receipt', `unexpected status ${missing.status}`);
  const eligible = evaluateCoachReplayEligibilityV1(replay, {
    canonicalContextFingerprint: CONTEXT_HASH,
    clockFingerprint: CLOCK_HASH,
    coachMessageCapabilityEnabled: true,
    availableSourceInterpretationReceiptHashes: [source.receiptId],
  });
  expect(eligible.status === 'eligible', `unexpected status ${eligible.status}`);
});

test('replay eligibility returns schema mismatch and invalid receipt as typed results', () => {
  const schemaMismatch = clone(fixtureReceipt()) as unknown as Record<string, unknown>;
  schemaMismatch.schemaVersion = 2;
  equal(
    evaluateCoachReplayEligibilityV1(schemaMismatch, {
      canonicalContextFingerprint: CONTEXT_HASH,
      clockFingerprint: CLOCK_HASH,
      coachMessageCapabilityEnabled: true,
    }),
    { status: 'schema_mismatch', expectedSchemaVersion: 1, actualSchemaVersion: 2 },
    'schema mismatch result changed',
  );
  const invalid = clone(fixtureReceipt()) as unknown as Record<string, unknown>;
  invalid.receiptId = 'invalid';
  const invalidResult = evaluateCoachReplayEligibilityV1(invalid, {
    canonicalContextFingerprint: CONTEXT_HASH,
    clockFingerprint: CLOCK_HASH,
    coachMessageCapabilityEnabled: true,
  });
  expect(invalidResult.status === 'invalid_receipt', `unexpected status ${invalidResult.status}`);
});

test('replay compatibility layer performs no classification, mutation, network, or store access', () => {
  const receipt = deepFreeze(fixtureReceipt());
  const before = JSON.stringify(receipt);
  let networkCalls = 0;
  const runtime = globalThis as typeof globalThis & { fetch?: (...args: unknown[]) => unknown };
  const originalFetch = runtime.fetch;
  runtime.fetch = () => {
    networkCalls += 1;
    throw new Error('network access is forbidden');
  };
  try {
    const result = evaluateCoachReplayEligibilityV1(receipt, {
      canonicalContextFingerprint: CONTEXT_HASH,
      clockFingerprint: CLOCK_HASH,
      coachMessageCapabilityEnabled: true,
    });
    expect(result.status === 'eligible', `unexpected status ${result.status}`);
  } finally {
    runtime.fetch = originalFetch;
  }
  expect(networkCalls === 0, 'replay eligibility attempted network access');
  expect(JSON.stringify(receipt) === before, 'replay eligibility mutated receipt state');
});

test('public schema version remains exactly V1', () => {
  expect(COACH_INTERPRETATION_RECEIPT_SCHEMA_VERSION === 1, 'schema version drifted');
});

console.log(`\nCoach interpretation receipt tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
