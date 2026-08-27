/**
 * Real accumulated fixture/edit/injury worlds, not hand-built after-state or
 * obsolete automatic-relocation/single-publication expectations.
 * The release gate runs the same checks for all eight athletes over 52 weeks.
 * NOT COVERED: native controls and native storage adapters.
 */
Object.assign(globalThis, { __DEV__: true });
const storage = new Map<string, string>();
Object.assign(globalThis, { window: { localStorage: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
  clear: () => { storage.clear(); },
} } });
const { armTotalsOrRed, totalsPrinted } = require('./support/totalsOrRed') as typeof import('./support/totalsOrRed');
armTotalsOrRed();
const { ARCHETYPES } = require('./compilerYear/catalog') as typeof import('./compilerYear/catalog');
const { runAthlete } = require('./compilerYear/run') as typeof import('./compilerYear/run');
let passed = 0;
const failures: string[] = [];
async function main() {
  for (const id of ['male-5-two-fixtures', 'female-3-novice-home']) {
    const athlete = ARCHETYPES.find(candidate => candidate.id === id);
    if (!athlete) throw new Error('Missing continuity archetype: ' + id);
    const result = await runAthlete(athlete, storage, 20);
    const measuredWeeks = result.weeks.filter(week => week.status === 'measured').length;
    if (measuredWeeks !== 20) failures.push(id + ': did not reach 20 weeks');
    for (const week of result.weeks) for (const check of week.checks) {
      if (check.ok) passed++;
      else failures.push(id + ': week ' + week.index + ': ' + check.id + ': ' + check.detail);
    }
    for (const check of result.checks) {
      if (check.ok) passed++;
      else failures.push(id + ': ' + check.id + ': ' + check.detail);
    }
    for (const action of result.actions) if (!action.ok)
      failures.push(id + ': action ' + action.kind + ': ' + action.detail);
    console.log(id + ': ' + measuredWeeks + '/20 reached athlete-weeks; ' +
      result.actions.length + ' executed actions; ' + result.restarts + ' restarts');
  }
}
main().catch(error => { failures.push(String(error)); }).finally(() => {
  for (const failure of failures) console.error('FAIL', failure);
  console.log('Continuity: ' + passed + ' passed checks, ' + failures.length + ' failures');
  totalsPrinted(failures.length);
  if (failures.length) process.exitCode = 1;
});
