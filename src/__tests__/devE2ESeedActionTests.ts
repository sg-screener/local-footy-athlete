/* Diagnostic seed actions must be real accepted edits, including after restart. */
(global as { __DEV__?: boolean }).__DEV__ = true;
const storage = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = { localStorage: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); }, clear: () => storage.clear(),
} };
import { coldStartThroughOnboarding, quiet, quietAsync, relaunchApp } from './support/athleteJourney';
import { DEV_E2E_SEED_IDS, buildDevE2ESeed, validateDevE2EWitnesses } from '../dev/e2e/devE2ESeedRegistry';
import { applyDevE2ESeedAction } from '../dev/e2e/devE2ESeedAction';
import { readDevE2EWitnessState } from '../dev/e2e/defaultDevE2ESeedCoordinator';
import { decisionLedgerEntries } from '../store/decisionLedgerStore';
import { undoLastDecision } from '../store/undoLastDecision';
import { deriveVisibleWeekLive } from '../utils/deriveVisibleWeek';
import { visibleSignature } from './compilerYear/invariants';

let passed = 0;
const failures: string[] = [];
function check(label: string, condition: boolean, detail = '') {
  if (condition) passed++; else failures.push(`${label}: ${detail}`);
  console.log(`${condition ? 'PASS' : 'FAIL'} ${label}${condition ? '' : ` ${detail}`}`);
}
async function main() {
  // Capture actual generator output before the seed sees it. Every seed must
  // preserve both identities and material, not merely look similar on screen.
  const generation = require('../services/api/generateProgram') as typeof import('../services/api/generateProgram');
  const originalGenerate = generation.generateProgramLocally;
  for (const id of DEV_E2E_SEED_IDS) {
    let produced = '';
    generation.generateProgramLocally = (...args) => {
      const program = originalGenerate(...args);
      produced = JSON.stringify(program);
      return program;
    };
    try {
      const seed = quiet(() => buildDevE2ESeed(id));
      check(`${id} preserves the exact canonical program`, !!produced && JSON.stringify(seed.program) === produced);
    } finally { generation.generateProgramLocally = originalGenerate; }
  }
  for (const id of ['one-set-strength', 'session-layout-showcase'] as const) {
    const seed = quiet(() => buildDevE2ESeed(id));
    const action = seed.auxiliaryState.find(item => item.kind === 'program_control');
    check(`${id} contains an input action, not edited output`, !!action && seed.program.microcycles.length === 4);
    if (!action || action.kind !== 'program_control') continue;
    await quietAsync(() => coldStartThroughOnboarding({ profile: seed.profile, installDayISO: seed.anchorDate }));
    const witnesses = seed.witnesses.filter(w => w.kind !== 'program' && w.kind !== 'profile_exact');
    const validate = () => quiet(() => validateDevE2EWitnesses(id, witnesses, readDevE2EWitnessState()));
    const signature = () => quiet(() => visibleSignature(deriveVisibleWeekLive(seed.anchorDate, seed.anchorDate)));
    const before = signature();
    check(`${id} missing action fails its witness`, validate().length > 0);
    const ledgerSize = decisionLedgerEntries().length;
    await quietAsync(() => applyDevE2ESeedAction(action));
    check(`${id} action is recorded once`, decisionLedgerEntries().length === ledgerSize + 1);
    check(`${id} real accepted action satisfies witness`, validate().length === 0, validate().join(', '));
    const accepted = signature();
    const restart = await quietAsync(() => relaunchApp({ storage, todayISO: seed.anchorDate }));
    check(`${id} accepted edit survives restart`, restart.ok && signature() === accepted && validate().length === 0, restart.error);
    const undo = await quietAsync(() => undoLastDecision());
    check(`${id} Undo restores generated training`, undo.outcome === 'undone' && signature() === before);
  }
  console.log(`Dev seed accepted actions: ${passed} passed; ${failures.length} failures`);
  if (failures.length) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
