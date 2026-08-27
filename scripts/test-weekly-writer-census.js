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
test('protected unwired builders remain inventoried without runtime authority', () => {
  const sources = { 'src/data/timeTrialSession.ts':
    'export function timeTrialWorkout() { return { exercises: [] }; }' };
  const result = scanSources({ sources, registry: reviewed(sources, () => 'dormant_quarantined') });
  assert.equal(result.ok, true);
  assert.equal(result.counts.dormant_quarantined, 1);
  assert.equal(result.inspectedCapabilityOwners, 1, 'dormant code must not disappear from the denominator');
});
test('quarantine cannot be assigned to an arbitrary alternative author', () => {
  const result = scanSources({ sources: clean, registry: reviewed(clean, () => 'dormant_quarantined') });
  assert.equal(result.ok, false);
  assert(result.errors.some(error => error.includes('unapproved dormant capability')));
});
test('runtime cannot activate protected builders through imports, barrels or loaders', () => {
  for (const edge of [
    "import { timeTrialWorkout } from './data/timeTrialSession'; timeTrialWorkout();",
    "export * from './data/timeTrialSession';",
    "export { timeTrialWorkout } from './data/timeTrialSession';",
    "const old = require('./data/timeTrialSession'); old.timeTrialWorkout();",
    "const load = require; const old = load('./data/timeTrialSession'); old.timeTrialWorkout();",
    "export async function load() { return import('./data/timeTrialSession'); }",
    "import old = require('./data/timeTrialSession'); old.timeTrialWorkout();",
    "const target = './data/' + 'timeTrialSession'; require(target);",
    "const target = unknownModuleName(); require(target);",
  ]) {
    const sources = { [file]: edge, 'src/data/timeTrialSession.ts':
      'export function timeTrialWorkout() { return { exercises: [] }; }' };
    const registry = reviewed(sources, row => row.file === 'src/data/timeTrialSession.ts'
      ? 'dormant_quarantined' : 'canonical_compiler');
    const result = scanSources({ sources, registry });
    assert.equal(result.ok, false, edge);
    assert(result.errors.some(error => /runtime imports quarantined programming|unresolved runtime module loader/.test(error)), edge);
  }
});
test('parallel session proposal author cannot return as an approved helper', () => {
  const sources = { 'src/utils/planChangeProducer.ts':
    `export function buildPlanChangeProposal() { return { workout: { exercises: [] } }; }` };
  const result = scanSources({ sources, registry: reviewed(sources) });
  assert.equal(result.ok, false);
  assert(result.errors.some(error => error.includes('retired parallel session proposal author')));
});
test('diagnostic program identity rewriters cannot return as approved helpers', () => {
  for (const name of ['stabilizeProgram', 'stabilizeMicrocycle']) {
    const sources = { 'src/dev/e2e/devE2ESeedRegistry.ts':
      `function ${name}(program: any) { return { ...program, id: 'fake', workouts: [] }; }` };
    const result = scanSources({ sources, registry: reviewed(sources) });
    assert.equal(result.ok, false);
    assert(result.errors.some(error => error.includes('retired diagnostic program rewriter')));
  }
});
test('retired read-side conditioning author cannot return', () => {
  const sources = { 'src/utils/sessionBuilder.ts': 'export function buildConditioningSession() { return { exercises: [], durationMinutes: 30 }; }' };
  const result = scanSources({ sources, registry: reviewed(sources) });
  assert.equal(result.ok, false);
  assert(result.errors.some(error => error.includes('retired read-side conditioning author')));
});
test('retired independent strength selectors cannot return as a file or builder', () => {
  for (const [name, body] of [
    ['src/utils/exerciseScorer.ts', 'export function selectExercises(rows: any[]) { return rows.slice(0, 5); }'],
    ['src/utils/sessionBuilder.ts', 'export function buildTagAwareSession(workout: any) { return { ...workout, exercises: [] }; }'],
  ]) {
    const sources = { [name]: body };
    const result = scanSources({ sources, registry: reviewed(sources) });
    assert.equal(result.ok, false);
    assert(result.errors.some(error => error.includes('retired independent strength selector')));
  }
});
test('read-side travel author cannot return outside the compiler', () => {
  const result = scanSources({ sources: { 'src/utils/sessionResolver.ts':
    'function applyAwayPass(days: any[]) { return days.map(day => ({ ...day, workout: null })); }' } });
  assert.equal(result.ok, false);
  assert(result.errors.some(error => error.includes('retired read-side travel author')));
});
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
test('retired post-acceptance conditioning/offer module cannot return', () => {
  const filename = 'src/rules/section18OfferPlacement.ts';
  assert(!fs.existsSync(path.resolve(__dirname, '..', filename)));
  const result = scanSources({ sources: { [filename]:
    'export function presentDeclaredOffer(workouts: any[]) { return [...workouts, { exercises: [] }]; }' } });
  assert.equal(result.ok, false);
  assert(result.errors.some(error => error.includes('retired post-acceptance offer author returned')));
});
test('a fully reviewed pure compiler fixture satisfies zero/zero', () => {
  const r = scanSources({ sources: clean, registry: cleanRegistry });
  assert.equal(r.ok, true); assert.equal(r.counts.canonical_compiler, 1);
});
test('read-only native collection methods are not opaque authors, but callbacks and lookalikes remain visible', () => {
  const source = `interface Workout { exercises: unknown[] }
    export function read(rows: Workout[]) { return rows.some(row => row.exercises.length > 0); }
    export function callbackWriter(rows: Workout[]) { rows.forEach(row => { row.exercises = []; }); }
    interface ProgramState { find(): void }
    export function fake(store: ProgramState) { store.find(); }
    export function mutation(rows: Workout[]) { rows.pop(); }`;
  const r = scanSources({ sources: { [file]: source } });
  assert(!r.owners.some(row => row.id === file + '#read'));
  assert(r.owners.find(row => row.id === file + '#callbackWriter').sites.some(site => site.kind === 'assign'));
  assert(r.owners.find(row => row.id === file + '#fake').sites.some(site => site.kind === 'opaque_domain_callable_requires_review'));
  assert(r.owners.find(row => row.id === file + '#mutation').sites.some(site => site.kind === 'mutate_collection'));
});
test('fake rival writer outside the known files fails closed', () => {
  const sources = { ...clean, 'src/newRival.ts': `export function surprise(w: any) { w.exercises = []; }` };
  const r = scanSources({ sources, registry: cleanRegistry });
  assert.equal(r.ok, false);
  assert(r.owners.some((row) => row.id === 'src/newRival.ts#surprise' && row.reviewStatus === 'unreviewed'));
});
test('zero-operation wrappers inherit only a completely verified call graph', () => {
  const wrappers = { ...clean, 'src/delegates.ts': `
    import { compile } from './censusMutationFixture';
    export function delegate(value: any): any { return compile(value); }
    export function outer(value: any): any { return delegate(value); }
  ` };
  const result = scanSources({ sources: wrappers, registry: cleanRegistry });
  assert.equal(result.ok, true);
  assert.equal(result.inheritedCallGraphOwners, 2);
  const rejected = scanSources({ sources: wrappers, registry: reviewed(clean, () => 'rival_author') });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.counts.rival_author, 1); // one author, not its two callers
  assert.equal(rejected.inheritedCallGraphOwners, 2);
  const changed = scanSources({ sources: { ...wrappers,
    [file]: clean[file].replace('input.exercises.slice()', '[]') }, registry: cleanRegistry });
  assert.equal(changed.ok, false);
  assert.equal(changed.inheritedCallGraphOwners, 0);
  assert(changed.owners.filter(row => row.file === 'src/delegates.ts').every(row => row.reviewStatus === 'unreviewed'));
  const directWriter = scanSources({ sources: { ...wrappers,
    'src/delegates.ts': wrappers['src/delegates.ts'].replace('return compile(value)', 'value.exercises = []; return compile(value)') }, registry: cleanRegistry });
  assert.equal(directWriter.ok, false);
  assert(directWriter.owners.some(row => row.id === 'src/delegates.ts#delegate' && row.sites.length > 0 && row.reviewStatus === 'unreviewed'));
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

test('a passive existing-reference reader is proven, not mistaken for a program author', () => {
  const sources = { [file]: 'interface Workout { exercises: unknown[] } export function read(input: Workout | null) { return input; }' };
  const result = scanSources({ sources });
  assert.equal(result.ok, true);
  assert.equal(result.structurallyProvenReaders, 1);
  assert.equal(result.counts.projection_display, 1);
});
test('reader proof rejects immutable edits, in-place edits, transforms and unknown calls', () => {
  for (const body of [
    'return { ...input, exercises: [] };',
    'input.exercises.length = 0; return input;',
    'input.exercises.pop(); return input;',
    'const copy = { ...input }; return copy;',
    'declareSideEffect(input); return input;',
    'const fake = { getState() { input.exercises = []; return input; } }; return fake.getState();',
    'Object.assign(input, { exercises: [] }); return input;',
    'return [input].filter(() => false);',
  ]) {
    const result = scanSources({ sources: { [file]: 'interface Workout { exercises: unknown[] } export function read(input: Workout) { ' + body + ' }' } });
    assert.equal(result.ok, false, body);
    const owner = result.owners.find(row => row.id === file + '#read');
    assert(owner, `mutation subject not reached: ${body}`);
    assert.equal(owner.reviewOrigin, null, body);
  }
});
test('reader proof cannot replace an explicit rejected or stale source review', () => {
  const sources = { [file]: 'interface Workout { exercises: unknown[] } export function read(input: Workout) { return input; }' };
  const rejected = reviewed(sources, () => 'rival_author');
  assert.equal(scanSources({ sources, registry: rejected }).ok, false);
  const changed = { [file]: sources[file].replace('return input;', 'if (!input) return input; return input;') };
  const result = scanSources({ sources: changed, registry: rejected });
  assert.equal(result.ok, false);
  assert.equal(result.structurallyProvenReaders, 0);
});

test('hard-coded default-program fallback cannot return as an alternative author', () => {
  const filename = 'src/data/defaultProgram.ts';
  const source = ts.createSourceFile(filename,
    fs.readFileSync(path.resolve(__dirname, '..', filename), 'utf8'), ts.ScriptTarget.Latest, true);
  const names = source.statements.flatMap(statement => ts.isFunctionDeclaration(statement)
    ? [statement.name?.text]
    : ts.isVariableStatement(statement) ? statement.declarationList.declarations.map(declaration => declaration.name.getText(source)) : []);
  for (const name of ['DEFAULT_PROGRAM', 'createDefaultMicrocycle', 'createWorkout', 'createWorkoutExercises']) {
    assert(!names.includes(name), `retired implementation still exists: ${name}`);
    const mutation = name === 'DEFAULT_PROGRAM'
      ? `export const ${name} = { microcycles: [] };`
      : `function ${name}() { return { workouts: [] }; }`;
    const result = scanSources({ sources: { [filename]: mutation } });
    assert(result.errors.includes(`retired default-program author returned to runtime: ${name}`));
    assert.equal(result.ok, false);
  }
});

console.log(`Writer census detector: ${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
