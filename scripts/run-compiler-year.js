#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
process.env.TZ = 'Australia/Melbourne';
global.__DEV__ = true;
const storage = new Map();
global.window = { localStorage: {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key), clear: () => storage.clear(),
} };
global.fetch = () => { throw new Error('NETWORK DISABLED — year acceptance must compile locally'); };
require('sucrase/register');

const { ARCHETYPES, yearTimeline } = require('../src/__tests__/compilerYear/catalog');
const { yearVerdict, renderYearHtml } = require('../src/__tests__/compilerYear/results');
const { runAthlete, realCompilerMutation } = require('../src/__tests__/compilerYear/run');
const { sourceFactCompilerMutation, acceptanceBoundaryMutation, injuryRenderingMutation } = require('../src/__tests__/compilerYear/sourceFacts');
const { doseArithmeticMutations } = require('../src/__tests__/compilerYear/dose');
const { scanSources } = require('./weekly-writer-census');

async function main() {
  const args = process.argv.slice(2);
  let only;
  let output;
  let weeks = 52;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--only') only = args[++i];
    else if (args[i] === '--weeks') weeks = Number(args[++i]);
    else if (args[i] === '--output') output = args[++i];
    else throw new Error(`Unknown argument ${args[i]}`);
  }
  if (only !== undefined && !ARCHETYPES.some((a) => a.id === only)) throw new Error(`Unknown archetype ${only}`);
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > 52) throw new Error('Expected 1..52 weeks');
  const root = path.resolve(__dirname, '..');
  const ownership = scanSources({ registry: JSON.parse(fs.readFileSync(path.join(root, 'scripts/weekly-writer-ownership.json'), 'utf8')) });
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim().length > 0;
  const result = { version: 1, revision: revision + (dirty ? ' + working-tree changes' : ''),
    startedAt: new Date().toISOString(), prerequisites: [{ id: 'canonical_only', ok: ownership.ok,
      detail: `${ownership.counts.rival_author} confirmed rival functions, ${ownership.counts.derived_output_writer} derived publishers, ${ownership.unresolvedOwners}/${ownership.inspectedCapabilityOwners} unresolved candidate owners; ${ownership.counts.dormant_quarantined} explicitly quarantined capabilities retained in that denominator. ${ownership.ok ? 'Executable ownership gate passed.' : 'Executable ownership is not yet proven.'}` }],
    mutations: [await realCompilerMutation(), await sourceFactCompilerMutation(storage), await acceptanceBoundaryMutation(), await injuryRenderingMutation(), ...await doseArithmeticMutations()], athletes: [], notCovered: [
      'Physical device, UI, remote persistence and true OS process death; the restart harness empties and rehydrates all stores then runs production boot.',
      ...(!ownership.ok ? ['Executable ownership is blocked by the failed ownership prerequisite above.'] : []),
      'Protected accessory-mobility pairing and the 2 km assessment-session builder remain unwired and runtime-quarantined; this gate does not claim those features are integrated.',
      'Compiler repeatability compares training semantics; legacy helper audit timestamps are excluded, so transitive clock-purity is not certified.',
      'Numeric receipts cover compiler-authored main-lift deload sets and exact-exercise held/earned loads. Accessory, power and conditioning arithmetic is additionally held by the promoted deload-law diagnostic, not exhaustively enumerated in annual numeric receipts.',
      'Injury, illness, travel, all equipment subsets and every action permutation are not a full cross-product in these eight archetypes.',
    ] };
  const destination = path.resolve(root, output ?? 'outputs/compiler-year-acceptance');
  fs.mkdirSync(destination, { recursive: true });
  const present = () => {
    fs.writeFileSync(path.join(destination, 'result.json'), JSON.stringify(result, null, 2) + '\n');
    fs.writeFileSync(path.join(destination, 'index.html'), renderYearHtml(result));
  };
  // A killed/incomplete run leaves incomplete RED evidence, never yesterday's PASS.
  present();
  for (const archetype of ARCHETYPES.filter((a) => !only || a.id === only)) {
    try { result.athletes.push(await runAthlete(archetype, storage, weeks)); }
    catch (error) {
      const reason = `Harness exception: ${error.message}`;
      result.athletes.push({ id: archetype.id, checks: [{ id: 'harness', ok: false, detail: reason }],
        actions: [], compilerCalls: 0, restarts: 0, loggedSessions: 0,
        weeks: yearTimeline(archetype).map((w) => ({ ...w, status: 'not_reached', checks: [], reason })) });
    }
    present();
  }
  const verdict = yearVerdict(result);
  console.log(`YEAR ACCEPTANCE: ${verdict.greenWeeks} green / ${verdict.measuredWeeks} reached / ${verdict.expectedWeeks} required athlete-weeks (${ARCHETYPES.length} distinct athletes × 52).`);
  console.log(`YEAR ACCEPTANCE: ${verdict.failures.length} distinct failure keys; report=${destination}/index.html`);
  console.log(`COMPILER_YEAR_GATE_EXIT=${verdict.ok ? 0 : 1}`);
  process.exitCode = verdict.ok ? 0 : 1;
}
if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });
