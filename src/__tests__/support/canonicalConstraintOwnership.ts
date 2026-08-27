import { readFileSync } from 'fs';
import { resolve } from 'path';
import ts from 'typescript';

const paths = {
  read: 'utils/visibleProgramReadModel.ts',
  resolver: 'utils/sessionResolver.ts',
  hook: 'hooks/useSchedule.ts',
  compiler: 'rules/canonicalWeeklyConstraintCompiler.ts',
};
const root = resolve(__dirname, '../..');

/** A source-edge check, not a claim that the entire application has one owner.
 * Runtime surface/restart parity is checked separately by the onboarding journeys. */
function boundaryFailures(sources: Record<string, string>): string[] {
  const failures: string[] = [];
  function body(file: string, name: string): ts.Block | null {
    const source = ts.createSourceFile(file, sources[file], ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const fn = source.statements.find((node): node is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(node) && node.name?.text === name);
    if (!fn?.body || fn.body.statements.length === 0) {
      failures.push(`missing executable body: ${name}`); return null;
    }
    return fn.body;
  }
  function calls(block: ts.Block, name: string): ts.CallExpression[] {
    const found: ts.CallExpression[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === name) found.push(node);
      ts.forEachChild(node, visit);
    };
    visit(block); return found;
  }
  for (const [name, target] of [
    ['buildProgramTabProjectedWeek', 'resolveWeekWithConditioning'],
    ['buildDayWorkoutProjectedDay', 'resolveDateWithConditioning'],
  ]) {
    const fn = body(paths.read, name);
    if (fn && (fn.statements.length !== 1 || !ts.isReturnStatement(fn.statements[0]) || calls(fn, target).length !== 1)) {
      failures.push(`${name} must return the compiled result unchanged`);
    }
  }
  const resolver = body(paths.resolver, 'resolveWeekWithConditioning');
  if (resolver) {
    const statement = resolver.statements[0];
    const expression = statement && ts.isReturnStatement(statement) ? statement.expression : undefined;
    const argument = expression && ts.isCallExpression(expression) ? expression.arguments[0] : undefined;
    const days = argument && ts.isObjectLiteralExpression(argument) ? argument.properties.find((p) =>
      ts.isPropertyAssignment(p) && p.name.getText() === 'days') : undefined;
    if (resolver.statements.length !== 1 || !expression || !ts.isCallExpression(expression) ||
        expression.expression.getText() !== 'compileCanonicalResolvedWeek' || !days ||
        !ts.isPropertyAssignment(days) || !ts.isCallExpression(days.initializer) ||
        days.initializer.expression.getText() !== 'resolveWeekBeforeConstraints' ||
        calls(resolver, 'compileCanonicalResolvedWeek').length !== 1 ||
        calls(resolver, 'resolveWeekBeforeConstraints').length !== 1) failures.push('public week read bypasses final compilation');
  }
  const hook = body(paths.hook, 'useScheduleState');
  if (hook && calls(hook, 'assembleScheduleState').length !== 1) failures.push('reactive assembly diverged');
  // Prove the final stage actually consumes the days; a dormant call is not a boundary.
  const compiler = body(paths.compiler, 'compileCanonicalResolvedWeek');
  if (compiler && (!compiler.getText().includes('input.days.map((day) =>') ||
      calls(compiler, 'compileCanonicalDayConstraints').length !== 1)) failures.push('compiler does not process every day');
  return failures;
}

export function checkCanonicalConstraintOwnership(ok: (name: string, condition: unknown, detail?: unknown) => void): void {
  const sources = Object.fromEntries(Object.values(paths).map((file) => [file, readFileSync(resolve(root, file), 'utf8')]));
  ok('final constraint compilation has one shared public boundary', boundaryFailures(sources).length === 0,
    boundaryFailures(sources).join(', '));
  const mutations = [
    { file: paths.resolver, from: 'return compileCanonicalResolvedWeek({', to: 'return bypassFinalCompiler({' },
    { file: paths.resolver, from: 'return compileCanonicalResolvedWeek({', to: 'if (false) return compileCanonicalResolvedWeek({' },
    { file: paths.compiler, from: 'input.days.map((day) =>', to: '[].map((day) =>' },
    { file: paths.hook, from: 'const assembled = assembleScheduleState({', to: 'const assembled = secondAssembly({' },
    { file: paths.read, from: 'export function buildDayWorkoutProjectedDay(', to: 'export function missingDayReader(' },
  ];
  for (const mutation of mutations) {
    const original = sources[mutation.file];
    const changed = original.replace(mutation.from, mutation.to);
    ok(`ownership guard rejects ${mutation.from}`, changed !== original &&
      boundaryFailures({ ...sources, [mutation.file]: changed }).length > 0);
  }
}
