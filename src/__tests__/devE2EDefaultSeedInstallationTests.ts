type AsyncStorageEntry = readonly [string, string];

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
    return;
  }
  failures.push(`${name}${detail ? `: ${detail}` : ''}`);
  console.log(`  ✗ ${name}`);
}

async function main(): Promise<void> {
  (globalThis as typeof globalThis & { __DEV__: boolean }).__DEV__ = true;

  // Patch storage before loading any persisted store so the default adapter,
  // not a mocked coordinator dependency set, is exercised headlessly.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const storageModule = require('@react-native-async-storage/async-storage') as {
    default: Record<string, unknown>;
  };
  const values = new Map<string, string>();
  Object.assign(storageModule.default, {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => { values.set(key, value); },
    removeItem: async (key: string) => { values.delete(key); },
    clear: async () => { values.clear(); },
    getAllKeys: async () => Array.from(values.keys()),
    multiGet: async (keys: readonly string[]) =>
      keys.map((key) => [key, values.get(key) ?? null] as const),
    multiSet: async (entries: readonly AsyncStorageEntry[]) => {
      for (const [key, value] of entries) values.set(key, value);
    },
    multiRemove: async (keys: readonly string[]) => {
      for (const key of keys) values.delete(key);
    },
  });

  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error('default seed installation must not fetch');
  }) as typeof fetch;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createDefaultDevE2ESeedCoordinator } = require(
      '../dev/e2e/defaultDevE2ESeedCoordinator'
    ) as typeof import('../dev/e2e/defaultDevE2ESeedCoordinator');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useProgramStore } = require('../store/programStore') as
      typeof import('../store/programStore');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useCoachStore } = require('../store/coachStore') as
      typeof import('../store/coachStore');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useCoachMemoryStore } = require('../store/coachMemoryStore') as
      typeof import('../store/coachMemoryStore');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useCoachMutationHistoryStore } = require('../store/coachMutationHistoryStore') as
      typeof import('../store/coachMutationHistoryStore');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { section18PhaseTableSignature } = require('../rules/weeklyExposureContractV2') as
      typeof import('../rules/weeklyExposureContractV2');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { readActiveDevE2EScenarioSession } = require('../dev/e2e/devE2EScenarioRuntime') as
      typeof import('../dev/e2e/devE2EScenarioRuntime');

    const seedIds = [
      'multi-reload-fixture-chain',
      'repeat-week-phase-transition',
      'coach-production-replay',
    ] as const;
    const coordinator = createDefaultDevE2ESeedCoordinator(true);
    const installed: string[] = [];

    for (const seedId of seedIds) {
      if (await coordinator.reset(seedId)) installed.push(seedId);
      ok(
        `${seedId} installs with no system-authored overlay reinterpretation`,
        Object.keys(useProgramStore.getState().weekScopedOverlays).length === 0,
      );

      if (seedId === 'multi-reload-fixture-chain') {
        const state = useProgramStore.getState();
        ok(
          'multi-reload default installation retains multiple accepted weeks and revision 8',
          (state.currentProgram?.microcycles.length ?? 0) >= 2 &&
            state.acceptedMaterialContext.revision === 8,
        );
      }

      if (seedId === 'repeat-week-phase-transition') {
        const weeks = useProgramStore.getState().currentProgram?.microcycles ?? [];
        ok(
          'Repeat Week default installation retains genuinely different phase signatures',
          weeks.length >= 2 &&
            section18PhaseTableSignature(weeks[0].exposureContractV2) !==
              section18PhaseTableSignature(weeks[1].exposureContractV2),
        );
      }

      if (seedId === 'coach-production-replay') {
        ok(
          'Coach replay default installation begins with empty durable Coach state',
          useCoachStore.getState().messages.length === 0 &&
            useCoachStore.getState().conversations.length === 0 &&
            useCoachMemoryStore.getState().notes.length === 0 &&
            useCoachMutationHistoryStore.getState().entries.length === 0,
        );
      }
    }

    ok(
      'all three new seed families install through the production adapter',
      installed.join(',') === seedIds.join(','),
    );
    await coordinator.reset('equipment-restriction-case');
    const equipmentFacts = useProgramStore.getState()
      .acceptedMaterialContext.temporarySourceFacts;
    ok(
      'equipment restriction installs the canonical temporary source fact',
      equipmentFacts.some((fact) =>
        'factId' in fact &&
        fact.factId === 'temporary-equipment-bodyweight-only-2026-07-13' &&
        (!('status' in fact) || fact.status === 'active')),
    );
    const explorerReset = await coordinator.resetScenario('smoke-whole-session-deletion');
    const explorerSession = readActiveDevE2EScenarioSession();
    ok(
      'production scenario reset evaluates typed Explorer predicates',
      explorerReset &&
        explorerSession?.nextActionEligibility.status === 'eligible' &&
        explorerSession.nextActionEligibility.nextStepId === 'delete-whole-session',
      explorerSession?.nextActionEligibility.reasonCode ?? 'missing session',
    );
    ok('default seed installation performs no fetch', fetchCalls === 0);

    const release = createDefaultDevE2ESeedCoordinator(false);
    const releaseResults = await Promise.all(seedIds.map((seedId) => release.reset(seedId)));
    ok(
      'release default coordinator refuses all three new seed families',
      releaseResults.every((result) => result === false),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

void main().then(() => {
  console.log(`\nDefault Dev E2E seed installation: ${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) {
    failures.forEach((failure) => console.log(`  • ${failure}`));
    process.exit(1);
  }
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
