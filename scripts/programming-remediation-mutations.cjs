'use strict';
// In-memory mutants only. The shared checkout is never changed by this runner.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const repo = path.resolve(__dirname, '..');
const mutants = {
  trigger: ['src/rules/injuryExerciseRisk.ts', '  const movement = getExerciseTags(exerciseName)?.movement;', '  return false;\n  const movement = getExerciseTags(exerciseName)?.movement;', 'injury', 'no affected existing row survives'],
  dose: ['src/rules/canonicalWeeklyInjuryCompiler.ts', 'sets: Math.min(originalRow?.prescribedSets ?? 3,\n          substitution.to.prescription?.sets ?? originalRow?.prescribedSets ?? 3)', 'sets: substitution.to.prescription?.sets ?? 3', 'injury', 'does not increase reduced session sets'],
  equipment: ['src/rules/canonicalWeeklyRowCompiler.ts', 'availableEquipment: equipment.tags,\n            availableEquipmentByDay: Object.fromEntries(Object.entries(weeklyAvailability.equipmentByDayOfWeek)\n              .map(([day, capabilities]) => [day, capabilities.tags]))', 'availableEquipment: profile.equipment ?? []', 'inputs', 'conflicting legacy equipment cannot change any final row'],
  mobility_identity: ['src/utils/visibleProgramReadModel.ts', "domain: lowLoadIds.has(exercise.id) ? 'recovery' : 'strength'", "domain: 'strength'", 'mobility', 'actual Mobility is recovery'],
  mobility_conservation: ['src/utils/workoutCanonicalisation.ts', 'const composedRows = inputWorkout.exercises.filter(row => row.composedOptionalKind);', 'const composedRows = [];', 'mobility', 'accepted Add keeps original Mobility'],
  mobility_move: ['src/utils/sessionComponents.ts', 'if (wantedExerciseIds.size > 0) return ids.some((id) => wantedExerciseIds.has(id));', 'if (wantedExerciseIds.size > 0 && hasStrength) return ids.some((id) => wantedExerciseIds.has(id));', 'mobility', 'Move transfers only Mobility'],
  weekday_prefix: ['src/rules/weeklyScheduler.ts', 'const count = Math.min(appConditioningBudget, legalConditioningCandidates.length);', 'const count = Math.min(appConditioningBudget, legalConditioningCandidates.length);\n    return legalConditioningCandidates.slice(0, count);', 'inputs', 'conditioning receiver spacing includes week boundary'],
  machine_count: ['src/rules/conditioningSelection.ts', 'let candidates = pool.filter((template) => filters.every((filter) => filter(template)));', 'let candidates = pool.filter((template) => filters.every((filter) => filter(template)));\n  if (args.offFeet && candidates.length) { const count = t => renderableModalities(t).filter(m => m !== "run" && machineOwned(m)).length; const most = Math.max(...candidates.map(count)); candidates = candidates.filter(t => count(t) === most); }', 'inputs', 'all five usable off-leg aerobic templates'],
  advanced_curl: ['src/data/exercisePools.ts', "if (ladderLevelForProfile(experience ?? null) !== 'advanced') return [...candidates];", 'return [...candidates];', 'inputs', 'advanced automatic curl pool prefers loaded alternatives'],
  specialist_choice: ['src/rules/conditioningSelection.ts', 'if (preferred) return preferred;', 'if (false && preferred) return preferred;', 'inputs', 'equivalent conditioning seats have distinct eligible templates'],
  quality_history: ['src/rules/conditioningSelection.ts', 'if (args.selectionContext) {', 'if (false && args.selectionContext) {', 'inputs', 'accepted identity restores independent of global block number'],
  in_run_selections: ['src/rules/canonicalWeeklyRowCompiler.ts', 'selectionHistory: [...(args.selectionHistory ?? []), ...selections]', 'selectionHistory: args.selectionHistory ?? []', 'inputs', 'accepted conditioning history and final rows survive restart'],
};
const child = process.argv.find(a => a.startsWith('--child='))?.slice(8);
if (child) {
  require(path.join(repo, 'node_modules/sucrase/register'));
  const [file, from, to, witness] = mutants[child];
  const original = require.extensions['.ts'];
  require.extensions['.ts'] = (module, filename) => {
    if (filename !== path.join(repo, file)) return original(module, filename);
    let code = fs.readFileSync(filename, 'utf8');
    if (code.split(from).length !== 2) throw Error(`MUTATION MISSED: ${child}`);
    code = code.replace(from, to);
    console.log(`MUTATION_LANDED=${child}`);
    module._compile(require(path.join(repo, 'node_modules/sucrase')).transform(code, { transforms: ['typescript', 'imports'] }).code, filename);
  };
  if (witness === 'injury') require(path.join(repo, 'src/__tests__/injuryRecompositionTests'));
  else {
    global.__DEV__ = true;
    const storage = new Map();
    global.window = { localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k), clear: () => storage.clear() } };
    global.fetch = () => { throw Error('NETWORK DISABLED'); };
    let failures = 0;
    const helper = witness === 'mobility' ? 'mobilityAddJourney' : 'programmingInputTruth';
    require(path.join(repo, 'src/__tests__/support', helper))[helper](storage, (label, value, detail) => {
      if (!value) failures++;
      console.log(value ? 'PASS' : 'FAIL', label, value ? '' : detail ?? '');
    }).then(() => { console.log(`MUTANT_FAILURES=${failures}`); process.exitCode = failures ? 1 : 0; })
      .catch(error => { console.error(error); process.exitCode = 1; });
  }
} else {
  const output = path.resolve(repo, process.argv.find(a => a.startsWith('--output='))?.slice(9)
    ?? 'outputs/programming-remedy-2026-08-28/mutations');
  fs.mkdirSync(output, { recursive: true });
  const receipts = [];
  for (const [id, [, , , , expected]] of Object.entries(mutants)) {
    const only = process.argv.find(a => a.startsWith('--only='))?.slice(7);
    if (only && id !== only) continue;
    const result = spawnSync(process.execPath, [__filename, `--child=${id}`], { cwd: repo, env: { ...process.env, TZ: 'Australia/Melbourne' }, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
    const log = result.stdout + result.stderr;
    fs.writeFileSync(path.join(output, `${id}.log`), log);
    const caught = result.status === 1 && log.includes(`MUTATION_LANDED=${id}`)
      && log.split('\n').some(line => /FAIL|✗/.test(line) && line.includes(expected));
    receipts.push({ id, landed: log.includes(`MUTATION_LANDED=${id}`), exit: result.status, caught, expected });
    console.log(`${caught ? 'CAUGHT' : 'UNPROVEN'} ${id}`);
  }
  fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify(receipts, null, 2));
  process.exitCode = receipts.every(r => r.caught) ? 0 : 1;
}
