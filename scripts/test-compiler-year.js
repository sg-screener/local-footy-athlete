'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
// Install the same offline runtime; importing the CLI does not run the year.
require('./run-compiler-year');
const { ARCHETYPES, yearTimeline } = require('../src/__tests__/compilerYear/catalog');
const { WEEK_CHECKS, yearVerdict, renderYearHtml } = require('../src/__tests__/compilerYear/results');
const { runUnits } = require('./release-gate');
let passed = 0;
let failed = 0;
function test(name, run) {
  try { run(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); }
}

// Verdict-engine fixture ONLY. These are synthetic check results, never
// athlete programs or evidence that any training journey ran successfully.
function control() {
  return { version: 1, revision: 'verdict-control', startedAt: 'synthetic', notCovered: ['Not an athlete journey'],
    prerequisites: [{ id: 'canonical_only', ok: true }], mutations: [{ id: 'real_compiler_mutation', ok: true }],
    athletes: ARCHETYPES.map((a) => ({ id: a.id, compilerCalls: 1, loggedSessions: 1, restarts: 52,
      checks: [{ id: 'onboarding', ok: true }],
      actions: ['remove_session', 'undo_session', 'practice_match', 'phase_shift', 'phase_shift', 'move_game', 'remove_game', 'add_game', 'swap_exercise', 'lighter_day']
        .map((kind) => ({ kind, date: 'fixture-only', ok: true })),
      weeks: yearTimeline(a).map((w) => ({ ...w, status: 'measured', checks: WEEK_CHECKS.map((id) => ({ id, ok: true })) })),
    })) };
}
test('complete synthetic result is accepted by the verdict engine', () => assert.equal(yearVerdict(control()).ok, true));
const mutations = {
  missing_archetype: (r) => r.athletes.pop(),
  duplicate_archetype: (r) => { r.athletes[1] = r.athletes[0]; },
  missing_week: (r) => r.athletes[0].weeks.pop(),
  duplicate_week: (r) => { r.athletes[0].weeks[1] = r.athletes[0].weeks[0]; },
  missing_required_check: (r) => r.athletes[0].weeks[0].checks.pop(),
  missing_selection_history_check: (r) => { r.athletes[0].weeks[0].checks = r.athletes[0].weeks[0].checks.filter(c => c.id !== 'selection_history'); },
  rewritten_selection_history: (r) => { r.athletes[0].weeks[0].checks.find(c => c.id === 'selection_history').ok = false; },
  false_compiler_invariant: (r) => { r.athletes[0].weeks[0].checks[0].ok = false; },
  unreached_week: (r) => { r.athletes[0].weeks[0].status = 'not_reached'; },
  wrong_phase: (r) => { r.athletes[0].weeks[0].phase = 'In-season'; },
  no_restart: (r) => { r.athletes[0].restarts = 0; },
  no_logging: (r) => { r.athletes[0].loggedSessions = 0; },
  no_compiler_calls: (r) => { r.athletes[0].compilerCalls = 0; },
  refused_action: (r) => { r.athletes[0].actions[0].ok = false; },
  missing_phase_transition: (r) => r.athletes[0].actions.splice(3, 1),
  missing_multi_game: (r) => { const a = r.athletes.find((a) => a.id === 'male-5-two-fixtures'); a.actions = a.actions.filter((x) => x.kind !== 'add_game'); },
  missing_exercise_before_fixture: (r) => { const a = r.athletes.find((a) => a.id === 'male-5-two-fixtures'); a.actions = a.actions.filter((x) => x.kind !== 'swap_exercise'); },
  missing_lighter_day: (r) => { const a = r.athletes.find((a) => a.id === 'male-5-two-fixtures'); a.actions = a.actions.filter((x) => x.kind !== 'lighter_day'); },
  missing_ownership_proof: (r) => { r.prerequisites = []; },
  rival_author: (r) => { r.prerequisites[0].ok = false; },
  missing_mutation_proof: (r) => { r.mutations = []; },
};
for (const [name, mutate] of Object.entries(mutations)) test(`mutation: ${name} blocks acceptance`, () => {
  const result = control(); mutate(result); assert.equal(yearVerdict(result).ok, false);
});
test('release runner stops on a failed year invariant after a green control', () => {
  const unit = [{ label: 'test:compiler-year', role: 'current_contract', contracts: ['test:compiler-year'] }];
  const result = control();
  const execute = () => ({ exit: yearVerdict(result).ok ? 0 : 1 });
  assert.equal(runUnits(unit, execute).exit, 0);
  mutations.false_compiler_invariant(result);
  assert.equal(runUnits(unit, execute).exit, 1);
});
test('HTML derives the verdict again and cannot accept a cached PASS', () => {
  const result = control(); result.ok = true; mutations.false_compiler_invariant(result);
  assert.match(renderYearHtml(result), /NOT ACCEPTED/);
  assert.match(renderYearHtml(control()), />PASS<\/p>/);
});
test('HTML escapes athlete and failure content', () => {
  const result = control(); result.athletes[0].id = '<script>bad()</script>';
  const html = renderYearHtml(result); assert(!html.includes('<script>bad()')); assert(html.includes('&lt;script&gt;'));
});

function definitions(source) {
  const ast = ts.createSourceFile('subject.ts', source, ts.ScriptTarget.Latest, true);
  return ast.statements.filter(ts.isFunctionDeclaration).map((node) => node.name?.text);
}
const resolver = fs.readFileSync('src/utils/sessionResolver.ts', 'utf8');
const generator = fs.readFileSync('src/services/api/generateProgram.ts', 'utf8');
const progression = fs.readFileSync('src/rules/canonicalWeeklyProgressionCompiler.ts', 'utf8');
function retiredWritersAbsent(source) {
  return !definitions(source).some((name) => ['materialiseWeekStrengthProgression', 'authorWeekStrengthProgression', 'bakeMicrocycleStrengthProgression'].includes(name));
}
test('display resolver has no progression author implementation', () => assert(retiredWritersAbsent(resolver)));
test('reintroduced resolver progression author is caught as executable code', () => {
  assert(!retiredWritersAbsent(resolver + '\nexport function materialiseWeekStrengthProgression(w) { w.workouts = []; }'));
});
function delegatesFullComposition(source) {
  const ast = ts.createSourceFile('generator.ts', source, ts.ScriptTarget.Latest, true);
  const generation = ast.statements.find((n) => ts.isFunctionDeclaration(n) && n.name?.text === 'generateProgramLocally');
  assert(generation?.body && generation.body.statements.length > 5, 'live generation body must be found');
  const calls = []; const visit = (n) => { if (ts.isCallExpression(n)) calls.push(n.expression.getText(ast)); ts.forEachChild(n, visit); }; visit(ast);
  return calls.includes('compileCanonicalProgram') && !calls.some((name) => ['composeWeek', 'materialiseComposedWeek', 'assembleAuthoredWeek',
    'applyOptionalTopUps', 'applyExclusionsToAuthoredWeek', 'compileCanonicalProgramProgression'].includes(name)) &&
    !calls.some((name) => /^applyBlockBoundary|^bakeMicrocycleStrengthProgression$/.test(name));
}
test('generator delegates full composition and has no rival row or progression calls', () => {
  assert(delegatesFullComposition(generator));
  assert(definitions(progression).includes('compileCanonicalProgramProgression'));
});
test('an assembly call reintroduced inside live generation fails the ownership guard', () => {
  const ast = ts.createSourceFile('generator.ts', generator, ts.ScriptTarget.Latest, true);
  const generation = ast.statements.find((n) => ts.isFunctionDeclaration(n) && n.name?.text === 'generateProgramLocally');
  assert(generation?.body);
  const position = generation.body.getStart(ast) + 1;
  const mutant = generator.slice(0, position) + '\nassembleAuthoredWeek({ composerWorkouts: [], adapterWorkouts: [] });\n' + generator.slice(position);
  assert(!delegatesFullComposition(mutant));
});
console.log(`Compiler-year detector: ${passed} passed, ${failed} failed (infrastructure controls, not athlete-week results).`);
process.exitCode = failed ? 1 : 0;
