/**
 * Exact injury input transactions against real onboarding and the canonical
 * live/restart compiler. Retires the old null-program/hand-built override world,
 * retired alias migration, and snapshot-restoration assertions.
 */
Object.assign(globalThis, { __DEV__: true });
const memory = new Map<string, string>();
Object.assign(globalThis, { window: { localStorage: {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => { memory.set(key, value); },
  removeItem: (key: string) => { memory.delete(key); },
  clear: () => { memory.clear(); },
} } });

const { armTotalsOrRed, totalsPrinted } = require('./support/totalsOrRed') as typeof import('./support/totalsOrRed');
armTotalsOrRed();
const { coldStartThroughOnboarding, quiet, quietAsync, relaunchApp } =
  require('./support/athleteJourney') as typeof import('./support/athleteJourney');
const { ARCHETYPES, athleteAnswers, YEAR_START } = require('./compilerYear/catalog') as typeof import('./compilerYear/catalog');
const { sourceFactLifecycle } = require('./compilerYear/sourceFacts') as typeof import('./compilerYear/sourceFacts');
const { clearFactLifecycle } = require('./compilerYear/clearFacts') as typeof import('./compilerYear/clearFacts');
const { useProgramStore, readDurableProgramStoreEnvelope } = require('../store/programStore') as typeof import('../store/programStore');
const { createOrUpdateInjuryEpisode, resolveInjuryEpisode } =
  require('../store/injuryEpisodeTransaction') as typeof import('../store/injuryEpisodeTransaction');
const { buildGuidedInjuryConstraint } = require('../utils/guidedInjuryControl') as typeof import('../utils/guidedInjuryControl');
const { semanticFingerprint } = require('../utils/programSemanticSnapshot') as typeof import('../utils/programSemanticSnapshot');
const { deriveVisibleWeekLive } = require('../utils/deriveVisibleWeek') as typeof import('../utils/deriveVisibleWeek');
const { visibleSignature } = require('./compilerYear/invariants') as typeof import('./compilerYear/invariants');
const { decisionLedgerEntries } = require('../store/decisionLedgerStore') as typeof import('../store/decisionLedgerStore');

let passed = 0;
const failed: string[] = [];
function check(name: string, ok: unknown, detail?: unknown): void {
  if (ok) { passed++; console.log('PASS', name); }
  else { failed.push(name); console.error('FAIL', name, detail ?? ''); }
}
async function install() {
  memory.clear();
  const result = await coldStartThroughOnboarding({
    profile: athleteAnswers(ARCHETYPES.find(athlete => athlete.id === 'male-3-experienced-gym')!),
    installDayISO: YEAR_START,
  });
  if (result.onboardingRefusal) throw new Error(result.onboardingRefusal);
}
const signature = () => semanticFingerprint({
  context: useProgramStore.getState().acceptedMaterialContext,
  visible: quiet(() => visibleSignature(deriveVisibleWeekLive(YEAR_START, YEAR_START))),
  entries: decisionLedgerEntries(),
});
const constraint = () => buildGuidedInjuryConstraint({
  region: 'lower_body', area: 'knee', severity: 7, severityBand: 'moderate',
  adjustmentLevel: 'moderate', triggers: ['running'], seriousSymptoms: false,
}, { todayISO: YEAR_START });
const report = (hooks?: import('../store/injuryEpisodeTransaction').InjuryEpisodeTransactionTestHooks) =>
  quietAsync(() => createOrUpdateInjuryEpisode({ constraint: constraint(), sourceActor: 'athlete',
    sourceSurface: 'status_card', todayISO: YEAR_START, testHooks: hooks }));

async function main() {
  for (const upperFirst of [false, true]) {
    await install();
    for (const result of await sourceFactLifecycle({ weekStart: YEAR_START, storage: memory, upperFirst })) {
      check((upperFirst ? 'upper-first ' : 'lower-first ') + result.id, result.ok, result.detail);
    }
    for (const result of await clearFactLifecycle(YEAR_START, memory)) check(result.id, result.ok, result.detail);
  }
  const cases: Array<[string, import('../store/injuryEpisodeTransaction').InjuryEpisodeTransactionTestHooks]> = [
    ['before stage', { beforeStage: () => { throw new Error('injected staging failure'); } }],
    ['before validation', { beforeEffectiveValidation: () => { throw new Error('injected validation failure'); } }],
    ['candidate verification', { verifyCandidate: () => false }],
    ['persisted verification', { verifyAfterPersistence: () => false }],
  ];
  for (const [name, hooks] of cases) {
    await install();
    const before = signature();
    const persisted = await readDurableProgramStoreEnvelope();
    const result = await report(hooks);
    check(name + ' rejects', result.outcome === 'safely_rejected' || result.outcome === 'conflicted', result);
    check(name + ' preserves complete accepted inputs and visible week', signature() === before);
    check(name + ' preserves persisted program envelope', await readDurableProgramStoreEnvelope() === persisted);
  }
  await install();
  const active = await report();
  check('native report owns an exact episode', !!active.episodeId &&
    useProgramStore.getState().acceptedMaterialContext.injuryEpisodes.some(episode =>
      episode.episodeId === active.episodeId && episode.status !== 'resolved'), active);
  if (!active.episodeId) throw new Error('No episode for resolution witness');
  const before = signature();
  const conflict = await quietAsync(() => resolveInjuryEpisode(active.episodeId!, {
    todayISO: YEAR_START, expectedAcceptedRevision: useProgramStore.getState().acceptedMaterialContext.revision + 1,
  }));
  check('stale resolution is refused without changing inputs', conflict.outcome === 'conflicted' && signature() === before);
  const rejected = await quietAsync(() => resolveInjuryEpisode(active.episodeId!, {
    todayISO: YEAR_START, testHooks: { verifyAfterPersistence: () => false },
  }));
  check('failed Clear preserves the exact active episode and week', rejected.outcome === 'safely_rejected' && signature() === before);
  const resolved = await quietAsync(() => resolveInjuryEpisode(active.episodeId!, { todayISO: YEAR_START }));
  check('exact resolution succeeds', resolved.outcome === 'resolved_and_recomposed' || resolved.outcome === 'resolved_no_program_change', resolved);
  const repeated = await quietAsync(() => resolveInjuryEpisode(active.episodeId!, { todayISO: YEAR_START }));
  check('resolution is idempotent', repeated.outcome === 'already_resolved', repeated);
  const boot = await quietAsync(() => relaunchApp({ storage: memory, todayISO: YEAR_START }));
  check('resolved input remains resolved after restart', boot.ok &&
    useProgramStore.getState().acceptedMaterialContext.injuryEpisodes.some(episode =>
      episode.episodeId === active.episodeId && episode.status === 'resolved'), boot);
}
main().catch(error => { failed.push(String(error)); console.error(error); }).finally(() => {
  console.log(`Injury transactions: ${passed} passed, ${failed.length} failed`);
  totalsPrinted(failed.length);
  if (failed.length) process.exitCode = 1;
});
