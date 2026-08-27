'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { scanSources } = require('./weekly-writer-census');
let passed = 0;
let failed = 0;
function test(name, run) {
  try { run(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); }
}
const file = 'src/censusMutationFixture.ts';
const clean = { [file]: `
  export interface Workout { exercises: unknown[] }
  export function compile(input: Workout) { return { ...input, exercises: input.exercises.slice() }; }
` };
function reviewed(sources, classify = () => 'canonical_compiler') {
  const scan = scanSources({ sources });
  return { schemaVersion: 1, owners: Object.fromEntries(scan.owners.map((row) => [row.id, {
    classification: classify(row), reason: 'Explicit test fixture classification, never a production exemption.',
    fingerprint: row.fingerprint,
  }])) };
}
const cleanRegistry = reviewed(clean);
test('moving a rival into tests cannot hide a runtime import, barrel or lazy loader', () => {
  for (const edge of [
    "import { oldWriter } from './__tests__/legacy/snapshot'; oldWriter();",
    "import {} from './__tests__/legacy/snapshot';",
    "import './__tests__/legacy/snapshot';",
    "export { oldWriter } from './__tests__/legacy/snapshot';",
    "export {} from './__tests__/legacy/snapshot';",
    "const old = require('./__tests__/legacy/snapshot'); old.oldWriter();",
    "const load = require; const old = load('./__tests__/legacy/snapshot'); old.oldWriter();",
    "export async function load() { return import('./__tests__/legacy/snapshot'); }",
    "import old = require('./__tests__/legacy/snapshot'); old.oldWriter();",
  ]) {
    const result = scanSources({ sources: { ...clean, 'src/snapshotConsumer.ts': edge }, registry: cleanRegistry });
    assert.equal(result.ok, false);
    assert(result.errors.some(error => error.includes('runtime imports excluded diagnostic code')), edge);
  }
});
test('retired event author module is rejected even before it gains a known caller', () => {
  const result = scanSources({ sources: { ...clean, 'src/utils/applyAdjustmentEvents.ts':
    'export function applyAdjustmentEvents(w: any) { w.exercises = []; }' } });
  assert.equal(result.ok, false);
  assert(result.errors.some(error => error.includes('retired event/move author returned')));
});
test('type-only diagnostic references do not become runtime import edges', () => {
  const result = scanSources({ sources: { ...clean, 'src/typeOnlyDiagnostic.ts': `
    import type { Old } from './__tests__/legacy/snapshot';
    import { type Other } from './__tests__/legacy/snapshot';
    export type { Old } from './__tests__/legacy/snapshot';
    export { type Other } from './__tests__/legacy/snapshot';
  ` }, registry: cleanRegistry });
  assert.equal(result.ok, true);
});
test('a fully reviewed pure compiler fixture satisfies zero/zero', () => {
  const r = scanSources({ sources: clean, registry: cleanRegistry });
  assert.equal(r.ok, true); assert.equal(r.counts.canonical_compiler, 1);
});
test('fake rival writer outside the known files fails closed', () => {
  const sources = { ...clean, 'src/newRival.ts': `export function surprise(w: any) { w.exercises = []; }` };
  const r = scanSources({ sources, registry: cleanRegistry });
  assert.equal(r.ok, false);
  assert(r.owners.some((row) => row.id === 'src/newRival.ts#surprise' && row.reviewStatus === 'unreviewed'));
});
test('a reviewed rival remains red even with no unreviewed rows', () => {
  const r = scanSources({ sources: clean, registry: reviewed(clean, () => 'rival_author') });
  assert.equal(r.unresolvedOwners, 0); assert.equal(r.counts.rival_author, 1); assert.equal(r.ok, false);
});
test('a reviewed derived-output writer independently blocks release', () => {
  const r = scanSources({ sources: clean, registry: reviewed(clean, () => 'derived_output_writer') });
  assert.equal(r.counts.derived_output_writer, 1); assert.equal(r.ok, false);
});
test('a changed approved function loses its review rather than inheriting an exemption', () => {
  const sources = { [file]: clean[file].replace('input.exercises.slice()', '[]') };
  const r = scanSources({ sources, registry: cleanRegistry });
  assert.equal(r.ok, false); assert(r.owners.some((row) => row.reviewStatus === 'changed'));
});
test('comments and type-only fields do not manufacture executable writers', () => {
  const r = scanSources({ sources: { [file]: '// x.exercises = [];\ninterface X { workouts: unknown[] }' } });
  assert.equal(r.directWriteSiteOccurrences, 0); assert.equal(r.inspectedCapabilityOwners, 0);
  assert.equal(r.ok, false); // an empty scan cannot prove the real application
});
test('typeof signatures and type-only imports are not executable call edges', () => {
  const sources = {
    [file]: clean[file],
    'src/typeConsumer.ts': `import type { compile } from './censusMutationFixture';
      export type Input = Parameters<typeof compile>[0];`,
  };
  const r = scanSources({ sources });
  assert.deepEqual(r.owners.map((row) => row.id), [file + '#compile']);
});
test('renamed imports, local aliases and wrappers remain linked to the actual writer', () => {
  const sources = {
    [file]: `export function mutate(w: any) { w.exercises = []; }`,
    'src/censusAliasFixture.ts': `import { mutate as innocent } from './censusMutationFixture';
      export function entry(w: any) { const forward = innocent; forward(w); }`,
  };
  const r = scanSources({ sources });
  const entry = r.owners.find((row) => row.id === 'src/censusAliasFixture.ts#entry');
  assert(entry); assert(entry.calls.includes(`${file}#mutate`));
});
test('namespace import property calls retain their executable edge', () => {
  const sources = { [file]: `export function mutate(w: any) { w.exercises = []; }`,
    'src/censusAliasFixture.ts': `import * as api from './censusMutationFixture';
      export function entry(w: any) { api.mutate(w); }` };
  const r = scanSources({ sources });
  assert(r.owners.find((row) => row.id === 'src/censusAliasFixture.ts#entry')?.calls.includes(`${file}#mutate`));
});
test('interface-typed store methods cannot hide a caller behind the public signature', () => {
  const sources = { [file]: `
    interface ProgramState { removeManualOverride(date: string): void }
    declare const useStore: { getState(): ProgramState };
    export function clear() { const store = useStore.getState(); store.removeManualOverride('2026-07-13'); }
    export function callback() { return useStore.getState().removeManualOverride; }
    export function alias() { const { removeManualOverride: erase } = useStore.getState(); erase('2026-07-13'); }
    export function computed() { useStore.getState()['removeManualOverride']('2026-07-13'); }
  ` };
  const r = scanSources({ sources });
  for (const name of ['clear', 'callback', 'alias', 'computed']) {
    const row = r.owners.find((o) => o.id === `${file}#${name}`);
    assert(row?.sites.some((s) => s.kind === 'opaque_domain_callable_requires_review'), name);
  }
  assert.equal(r.ok, false);
});
test('a newly discovered operation invalidates a review even when the function text is unchanged', () => {
  const initial = { [file]: `
    interface OtherState { erase(): void }
    interface ProgramState { erase(): void }
    declare const store: OtherState;
    export function entry() { store.erase(); return { exercises: [] }; }
  ` };
  const registry = reviewed(initial);
  const changed = { [file]: initial[file].replace('store: OtherState', 'store: ProgramState') };
  const r = scanSources({ sources: changed, registry });
  assert.equal(r.ok, false);
  assert.equal(r.owners.find((o) => o.id === `${file}#entry`)?.reviewStatus, 'changed');
});
test('CommonJS destructured and namespace aliases retain the production callback edge', () => {
  const sources = { [file]: `export function mutate(w: any) { w.exercises = []; }`,
    'src/censusAliasFixture.ts': `const { mutate: forward } = require('./censusMutationFixture');
      const api = require('./censusMutationFixture');
      export function first(w: any) { forward(w); }
      export function second(w: any) { api.mutate(w); }` };
  const r = scanSources({ sources });
  for (const name of ['first', 'second']) assert(r.owners.find((row) =>
    row.id === 'src/censusAliasFixture.ts#' + name)?.calls.includes(`${file}#mutate`), name);
});
test('array alias mutation and typed computed placement writes are discovered', () => {
  const sources = { [file]: `interface Workout { dayOfWeek: number; exercises: unknown[] }
    export function mutate(w: Workout, key: keyof Workout) {
      const rows = w.exercises; rows.splice(0, 1); w[key] = [] as never;
    }` };
  const row = scanSources({ sources }).owners.find((row) => row.id === `${file}#mutate`);
  assert(row.sites.some((site) => site.kind === 'mutate_collection'));
  assert(row.sites.some((site) => site.kind === 'assign'));
});
test('Reflect writes and Object.assign cannot bypass assignment discovery', () => {
  const r = scanSources({ sources: { [file]: `interface Workout { exercises: unknown[] }
    export function mutate(w: Workout) { Reflect.set(w, 'exercises', []); Object.assign(w, { exercises: [] }); }` } });
  assert.equal(r.owners.find((row) => row.id === `${file}#mutate`).sites.filter((site) => site.kind === 'assign_object').length, 2);
});
test('disk persistence and captured store setters are distinct discovered operations', () => {
  const r = scanSources({ sources: { [file]: `declare const storage: any; declare const store: any;
    export function write(value: any) { const save = store.setState; save(value); storage.setItem('new-week-cache', JSON.stringify(value)); }` } });
  const row = r.owners.find((row) => row.id === `${file}#write`);
  assert(row.sites.some((site) => site.field === 'setState'));
  assert(row.sites.some((site) => site.field === 'setItem'));
});
test('an anonymous callback mutation is attributed to its containing executable owner', () => {
  const r = scanSources({ sources: { [file]: `export function mutate(items: any[]) { items.forEach(w => { w.exercises = []; }); }` } });
  assert(r.owners.find((row) => row.id === `${file}#mutate`)?.sites.some((site) => site.kind === 'assign'));
});
test('an absent reviewed function cannot leave a stale green inventory entry', () => {
  const r = scanSources({ sources: { [file]: 'export const x = 1;' }, registry: cleanRegistry });
  assert(r.errors.some((error) => error.includes('absent capability'))); assert.equal(r.ok, false);
});
test('a parse failure blocks the gate rather than silently skipping a source file', () => {
  const r = scanSources({ sources: { [file]: 'export function broken( {' } });
  assert(r.errors.length > 0); assert.equal(r.ok, false);
});
test('an invalid registry schema cannot produce a green gate', () => {
  const r = scanSources({ sources: clean, registry: { ...cleanRegistry, schemaVersion: 2 } });
  assert.equal(r.ok, false); assert(r.errors.some((error) => error.includes('invalid ownership registry')));
});
test('opaque computed assignments and mutations require review, not a silent exemption', () => {
  const r = scanSources({ sources: { [file]: `export function hidden(w: any, key: string) {
    w[key] = []; w[key](); delete w[key]; Reflect.set(w, key, []);
  }` } });
  const row = r.owners.find((row) => row.id === `${file}#hidden`);
  for (const kind of ['opaque_assign_requires_review', 'opaque_mutator_requires_review', 'opaque_delete_requires_review', 'assign_object']) {
    assert(row?.sites.some((site) => site.kind === kind), kind);
  }
  assert.equal(r.ok, false);
});
test('incrementing a typed prescription is an executable write', () => {
  const r = scanSources({ sources: { [file]: `interface WorkoutExercise { prescribedSets: number }
    export function hidden(row: WorkoutExercise) { row.prescribedSets++; }` } });
  assert(r.owners.find((row) => row.id === `${file}#hidden`)?.sites.some((site) => site.kind === 'update'));
});
test('retired raw exercise-store authors have no executable implementation', () => {
  const filename = path.resolve(__dirname, '../src/store/programStore.ts');
  const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true);
  const retired = new Set(['addExerciseToWorkout', 'replaceExerciseInWorkout']);
  let found = 0;
  function visit(node) {
    if (ts.isPropertyAssignment(node) && retired.has(node.name.getText(source)) &&
        (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) found++;
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.equal(found, 0, 'raw template writes must use typed canonical exercise effects instead');
});

test('retired private weekly planner cannot return beside the compiler', () => {
  const filename = path.resolve(__dirname, '../src/utils/coachingEngine.ts');
  const contents = fs.readFileSync(filename, 'utf8');
  const retired = new Set(['buildWeeklyPlan', 'applySection18ConditioningAllocation',
    'optimiseStrengthLoadSequence', 'enforcePreSeasonCoreStreak', 'enforceWeekendPeak',
    'enforceFieldLoadStreak', 'enforceAdjacentRegionLimit', 'teamDayPlaceholderAllocation',
    'createFallbackSpeedBlock', 'createSpeedTopUpBlock']);
  const authors = (text) => {
    const source = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true);
    assert.equal(source.parseDiagnostics.length, 0);
    const found = [];
    function visit(node) {
      if (ts.isFunctionDeclaration(node) && node.body && retired.has(node.name?.text)) found.push(node.name.text);
      ts.forEachChild(node, visit);
    }
    visit(source);
    return found;
  };
  assert.deepEqual(authors(contents), []);
  assert.deepEqual(authors(contents + '\nfunction buildWeeklyPlan() { return { weeklyPlan: [] }; }'), ['buildWeeklyPlan']);
});

console.log(`Writer census detector: ${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
