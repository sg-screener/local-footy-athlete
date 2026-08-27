'use strict';

// Static executable-capability census, not a count of words or runtime calls.
// Unknown owners and changed reviews are RED. Never infer permission from a
// filename, from a `compile` prefix, or from the absence of a known bad name.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const CATEGORIES = new Set([
  'canonical_input_writer', 'canonical_compiler', 'persistence_boundary',
  'projection_display', 'legacy_ingress', 'rival_author', 'derived_output_writer',
]);
const FIELDS = new Set([
  'currentProgram', 'currentMicrocycle', 'todayWorkout', 'microcycles', 'workouts',
  'exercises', 'weeklyPlan', 'manualOverrides', 'overrideContexts',
  'weekScopedWorkoutOverlays', 'userRemovalConstraints', 'acceptedMaterialContext',
  'weekScopedOverlays', 'dateOverrides', 'derived',
  'reversibleAdjustmentLedger', 'derivedSessions', 'derivedSessionRecords',
  'markedDays', 'athletePlacement', 'prescribedSets', 'prescribedRepsMin',
  'prescribedRepsMax', 'prescribedWeightKg', 'prescribedRestSeconds',
  'conditioningBlock', 'speedBlock', 'powerBlock', 'dosePolicyByDay',
  'workout', 'workoutsByDate', 'dayOfWeek', 'sessionType',
]);
const DOMAIN_TYPES = new Set([
  'TrainingProgram', 'Microcycle', 'Workout', 'WorkoutExercise', 'SessionAllocation',
  'WeeklySchedule', 'WeekScopedWorkoutOverlay', 'ReversibleAdjustmentLedger',
  'DerivedSessionRecord', 'UserRemovalConstraint', 'ProgramState', 'CalendarState',
  'CalendarDayType',
  'CanonicalAcceptedDayPlacementEffect', 'CanonicalAcceptedSessionEditEffect',
  'CanonicalAcceptedFixtureEditEffect', 'DecisionLedgerEntry',
]);
const MUTATORS = new Set(['push', 'pop', 'splice', 'shift', 'unshift', 'sort',
  'reverse', 'fill', 'copyWithin', 'set', 'delete', 'clear']);
const SINKS = new Set(['setState', 'setItem', 'multiSet', 'removeItem', 'multiRemove',
  'mergeItem', 'clearStorage', 'persist', 'setCurrentProgram', 'setCurrentMicrocycle',
  'setTodayWorkout', 'applyProgramOverrideWrite', 'applyProgramOverrideSliceWrite',
  'commitAcceptedStateTransaction']);
const printer = ts.createPrinter({ removeComments: true });
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relative = (root, file) => path.relative(root, file).split(path.sep).join('/');

function sourceFiles(root) {
  const found = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '__tests__', '__mocks__'].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.[cm]?[jt]sx?$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) found.push(full);
    }
  }
  walk(path.join(root, 'src'));
  walk(path.join(root, 'supabase', 'functions'));
  for (const name of ['App.tsx', 'App.js', 'index.ts', 'index.js']) {
    if (fs.existsSync(path.join(root, name))) found.push(path.join(root, name));
  }
  return found.sort();
}

function propertyName(node) {
  if (!node) return null;
  if (ts.isIdentifier(node) || ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)) return node.text;
  if (ts.isComputedPropertyName(node)) return propertyName(node.expression);
  return null;
}

function directFunctionName(node) {
  if (!ts.isFunctionLike(node) || !node.body) return null;
  if (node.name) return propertyName(node.name);
  const parent = node.parent;
  if (ts.isVariableDeclaration(parent) || ts.isPropertyAssignment(parent)) return propertyName(parent.name);
  return null; // anonymous callbacks belong to the enclosing executable owner
}

function scanSources({ root = ROOT, sources, registry = { schemaVersion: 1, owners: {} } } = {}) {
  const overrides = new Map(Object.entries(sources ?? {}).map(([file, text]) => [path.resolve(root, file), text]));
  const files = sources ? [...overrides.keys()] : sourceFiles(root);
  const fileSet = new Set(files);
  const options = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX, allowJs: true, skipLibCheck: true,
    moduleResolution: ts.ModuleResolutionKind.Node10, noResolve: false };
  const host = ts.createCompilerHost(options);
  const readFile = host.readFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  host.readFile = (file) => overrides.get(path.resolve(file)) ?? readFile(file);
  host.fileExists = (file) => overrides.has(path.resolve(file)) || fileExists(file);
  const program = ts.createProgram(files, options, host);
  const checker = program.getTypeChecker();
  const units = new Map();
  const nodeUnits = new Map();
  const sourceUnits = new Map();
  const errors = [];
  if (registry.schemaVersion !== 1 || !registry.owners ||
      typeof registry.owners !== 'object' || Array.isArray(registry.owners)) {
    errors.push('invalid ownership registry: expected schemaVersion 1 and an owners object');
  }

  // First enumerate executable owners. Comments, interfaces and property
  // declarations do not produce write sites. Module initialisers do.
  for (const file of files) {
    const sf = program.getSourceFile(file);
    if (!sf) { errors.push(`source missing: ${relative(root, file)}`); continue; }
    for (const diagnostic of sf.parseDiagnostics) {
      errors.push(`${relative(root, file)}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`);
    }
    function add(node, name) {
      const base = `${relative(root, file)}#${name}`;
      let id = base;
      let index = 2;
      while (units.has(id)) id = `${base}@${index++}`;
      const unit = { id, file: relative(root, file), name,
        line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
        sites: [], calls: new Set(), callers: new Set(), node, sf };
      units.set(id, unit); nodeUnits.set(node, unit);
      return unit;
    }
    const top = add(sf, '<module>');
    sourceUnits.set(sf, top);
    function walk(node, parentNames) {
      const name = directFunctionName(node);
      const names = name ? [...parentNames, name] : parentNames;
      if (name) add(node, names.join('.'));
      ts.forEachChild(node, (child) => walk(child, names));
    }
    ts.forEachChild(sf, (node) => walk(node, []));
  }

  function owner(node) {
    for (let cursor = node; cursor; cursor = cursor.parent) {
      if (nodeUnits.has(cursor)) return nodeUnits.get(cursor);
    }
    return null;
  }
  function resolveSymbol(node) {
    const property = ts.isPropertyAccessExpression(node) ? node
      : ts.isPropertyAccessExpression(node.parent) && node.parent.name === node ? node.parent : null;
    let symbol = checker.getSymbolAtLocation(node)
      ?? (property && requireExport(property.expression, property.name.text));
    const seen = new Set();
    while (symbol && !seen.has(symbol)) {
      seen.add(symbol);
      if (symbol.flags & ts.SymbolFlags.Alias) { symbol = checker.getAliasedSymbol(symbol); continue; }
      const declaration = symbol.valueDeclaration;
      if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer &&
          (ts.isIdentifier(declaration.initializer) || ts.isPropertyAccessExpression(declaration.initializer))) {
        const target = checker.getSymbolAtLocation(declaration.initializer);
        if (target) { symbol = target; continue; }
      }
      if (declaration && ts.isBindingElement(declaration) && ts.isObjectBindingPattern(declaration.parent)) {
        const binding = declaration.parent.parent;
        const initializer = binding.initializer;
        const key = propertyName(declaration.propertyName ?? declaration.name);
        const target = initializer && key && (checker.getPropertyOfType(checker.getTypeAtLocation(initializer), key)
          ?? requireExport(initializer, key));
        if (target) { symbol = target; continue; }
      }
      break;
    }
    return symbol;
  }
  function requireExport(expression, key) {
    let value = expression;
    if (ts.isIdentifier(value)) value = checker.getSymbolAtLocation(value)?.valueDeclaration?.initializer ?? value;
    if (!ts.isCallExpression(value) || !ts.isIdentifier(value.expression) || value.expression.text !== 'require' ||
        !value.arguments[0] || !ts.isStringLiteralLike(value.arguments[0])) return null;
    const modulePath = ts.resolveModuleName(value.arguments[0].text, value.getSourceFile().fileName, options, host)
      .resolvedModule?.resolvedFileName;
    const sf = modulePath && program.getSourceFile(modulePath);
    const symbol = sf && checker.getSymbolAtLocation(sf);
    return symbol ? checker.getExportsOfModule(symbol).find((exported) => exported.name === key) : null;
  }
  function symbolUnit(symbol) {
    for (const declaration of symbol?.declarations ?? []) {
      if (nodeUnits.has(declaration)) return nodeUnits.get(declaration);
      if (declaration.initializer && nodeUnits.has(declaration.initializer)) return nodeUnits.get(declaration.initializer);
    }
    return null;
  }
  function domainType(type, seen = new Set()) {
    if (!type || seen.has(type)) return false;
    seen.add(type);
    if ([type.aliasSymbol?.name, type.symbol?.name].some((name) => DOMAIN_TYPES.has(name))) return true;
    if (type.isUnionOrIntersection?.() && type.types.some((part) => domainType(part, seen))) return true;
    const args = type.aliasTypeArguments ?? type.typeArguments ?? [];
    return args.some((arg) => domainType(arg, seen));
  }
  function semantic(node, seen = new Set()) {
    if (!node || seen.has(node)) return false;
    seen.add(node);
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) ||
        ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node)) return semantic(node.expression, seen);
    if (ts.isPropertyAccessExpression(node)) {
      if (FIELDS.has(node.name.text) || semantic(node.expression, seen)) return true;
    }
    if (ts.isElementAccessExpression(node)) {
      if (FIELDS.has(propertyName(node.argumentExpression)) || semantic(node.expression, seen)) return true;
    }
    if (ts.isIdentifier(node)) {
      const symbol = checker.getSymbolAtLocation(node);
      for (const decl of symbol?.declarations ?? []) {
        if (ts.isVariableDeclaration(decl) && decl.initializer && semantic(decl.initializer, seen)) return true;
        if (ts.isBindingElement(decl) && FIELDS.has(propertyName(decl.propertyName ?? decl.name))) return true;
      }
    }
    if (ts.isObjectLiteralExpression(node) && node.properties.some((p) =>
      FIELDS.has(propertyName(p.name)) || (ts.isSpreadAssignment(p) && semantic(p.expression, seen)))) return true;
    return domainType(checker.getTypeAtLocation(node));
  }
  function site(node, kind, field) {
    const unit = owner(node);
    if (!unit) return;
    const start = node.getStart(unit.sf);
    const key = `${start}:${kind}`;
    if (unit.sites.some((existing) => existing.key === key)) return;
    unit.sites.push({ key, kind, field,
      line: unit.sf.getLineAndCharacterOfPosition(start).line + 1,
      code: node.getText(unit.sf).replace(/\s+/g, ' ').slice(0, 210) });
  }
  function opaqueReceiver(node) {
    if (!node) return false;
    return Boolean(checker.getTypeAtLocation(node).flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown));
  }
  function opaqueTarget(node) {
    return (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) && opaqueReceiver(node.expression);
  }

  for (const file of files) {
    const sf = program.getSourceFile(file);
    if (!sf) continue;
    function walk(node) {
      const unit = owner(node);
      // Symbol-resolved references also include callback/JSX handoffs. These
      // are conservative possible-call edges, not claims that a tap occurred.
      if (ts.isIdentifier(node) && unit) {
        const target = symbolUnit(resolveSymbol(node));
        const declarationName = node.parent?.name === node &&
          (ts.isFunctionLike(node.parent) || ts.isVariableDeclaration(node.parent) ||
           ts.isParameter(node.parent) || ts.isImportSpecifier(node.parent));
        if (target && target !== unit && fileSet.has(target.sf.fileName) && !declarationName) unit.calls.add(target.id);
        if (ts.isPropertyAccessExpression(node.parent) && node.parent.name === node && SINKS.has(node.text)) {
          site(node.parent, 'publish_or_persist_reference', node.text);
        }
      }
      if ((ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) && FIELDS.has(propertyName(node.name))) {
        site(node, 'construct', propertyName(node.name));
      }
      if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
          node.operatorToken.kind <= ts.SyntaxKind.LastAssignment && (semantic(node.left) || semantic(node.right))) {
        site(node, 'assign', node.left.getText(sf));
      } else if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
          node.operatorToken.kind <= ts.SyntaxKind.LastAssignment && opaqueTarget(node.left)) {
        site(node, 'opaque_assign_requires_review', node.left.getText(sf));
      }
      if (ts.isDeleteExpression(node) && semantic(node.expression)) site(node, 'delete', node.expression.getText(sf));
      else if (ts.isDeleteExpression(node) && opaqueTarget(node.expression)) site(node, 'opaque_delete_requires_review', node.expression.getText(sf));
      if ((ts.isPostfixUnaryExpression(node) || ts.isPrefixUnaryExpression(node)) &&
          [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator) &&
          (semantic(node.operand) || opaqueTarget(node.operand))) site(node, 'update', node.operand.getText(sf));
      if (ts.isReturnStatement(node) && node.expression && domainType(checker.getTypeAtLocation(node.expression))) {
        site(node, 'return_domain', checker.typeToString(checker.getTypeAtLocation(node.expression)).slice(0, 100));
      }
      if (ts.isArrowFunction(node) && !ts.isBlock(node.body) && domainType(checker.getTypeAtLocation(node.body))) {
        site(node.body, 'return_domain', checker.typeToString(checker.getTypeAtLocation(node.body)).slice(0, 100));
      }
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        const name = ts.isPropertyAccessExpression(callee) ? callee.name.text
          : ts.isElementAccessExpression(callee) ? (ts.isStringLiteralLike(callee.argumentExpression) ? callee.argumentExpression.text : null)
          : ts.isIdentifier(callee) ? callee.text : null;
        const originalName = resolveSymbol(ts.isPropertyAccessExpression(callee) ? callee.name : callee)?.name;
        if (SINKS.has(name) || SINKS.has(originalName)) site(node, 'publish_or_persist', originalName ?? name);
        if ((name === 'require' || callee.kind === ts.SyntaxKind.ImportKeyword) &&
            (!node.arguments[0] || !ts.isStringLiteralLike(node.arguments[0]))) {
          site(node, 'opaque_module_load_requires_review', name ?? 'import');
        }
        if (ts.isPropertyAccessExpression(callee) && MUTATORS.has(name) && semantic(callee.expression)) {
          site(node, 'mutate_collection', callee.expression.getText(sf));
        } else if ((ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee)) &&
            (MUTATORS.has(name) || name === null) && opaqueReceiver(callee.expression)) {
          site(node, 'opaque_mutator_requires_review', callee.getText(sf));
        }
        if (ts.isPropertyAccessExpression(callee) && ['Object', 'Reflect'].includes(callee.expression.getText(sf)) &&
            ['assign', 'defineProperty', 'defineProperties', 'set', 'deleteProperty'].includes(name) &&
            (node.arguments.some((argument) => semantic(argument)) || opaqueReceiver(node.arguments[0]))) site(node, 'assign_object', name);
      }
      ts.forEachChild(node, walk);
    }
    walk(sf);
  }

  // Include wrapper/dispatch functions that lead to a capability, not just
  // the line containing `workouts:`. This prevents laundering a writer
  // through an alias or an apparently harmless local helper.
  for (const unit of units.values()) for (const target of unit.calls) units.get(target)?.callers.add(unit.id);
  const capable = new Set([...units.values()].filter((unit) => unit.sites.length).map((unit) => unit.id));
  let grew = true;
  while (grew) {
    grew = false;
    for (const unit of units.values()) if (!capable.has(unit.id) && [...unit.calls].some((id) => capable.has(id))) {
      capable.add(unit.id); grew = true;
    }
  }
  const rows = [...capable].sort().map((id) => {
    const unit = units.get(id);
    const calls = [...unit.calls].filter((target) => capable.has(target)).sort();
    const callers = [...unit.callers].filter((target) => capable.has(target)).sort();
    const fingerprint = hash(printer.printNode(ts.EmitHint.Unspecified, unit.node, unit.sf) + '\n' + calls.join('\n'));
    const review = registry.owners?.[id];
    let reviewStatus = !review ? 'unreviewed' : review.fingerprint !== fingerprint ? 'changed' : 'reviewed';
    if (review && (!CATEGORIES.has(review.classification) || !review.reason?.trim())) {
      errors.push(`invalid review: ${id}`); reviewStatus = 'invalid';
    }
    return { id, file: unit.file, line: unit.line, fingerprint, reviewStatus,
      classification: review?.classification ?? null, reason: review?.reason ?? null,
      sites: unit.sites.map(({ key, ...rest }) => rest), calls, callers };
  });
  const stale = Object.keys(registry.owners ?? {}).filter((id) => !capable.has(id));
  for (const id of stale) errors.push(`review names an absent capability: ${id}`);
  const reviewed = rows.filter((row) => row.reviewStatus === 'reviewed');
  const counts = Object.fromEntries([...CATEGORIES].map((category) =>
    [category, reviewed.filter((row) => row.classification === category).length]));
  const result = { schemaVersion: 1,
    unit: 'distinct executable capability owners (file + named function, anonymous callbacks grouped with owner)',
    scope: 'App/index, all src JS/TS including dev, and deployable edge functions; excludes tests, mocks, declarations and dependencies',
    sourceFiles: files.length, executableOwners: units.size,
    directWriteSiteOccurrences: rows.reduce((sum, row) => sum + row.sites.length, 0),
    distinctDirectOwners: rows.filter((row) => row.sites.length).length,
    inspectedCapabilityOwners: rows.length, reviewedOwners: reviewed.length,
    unresolvedOwners: rows.length - reviewed.length, counts, errors, owners: rows };
  result.ok = rows.length > 0 && result.unresolvedOwners === 0 && errors.length === 0 &&
    counts.rival_author === 0 && counts.derived_output_writer === 0;
  return result;
}

function printSummary(result) {
  console.log(`UNIT: ${result.unit}`);
  console.log(`SCOPE: ${result.scope}`);
  console.log(`SCANNED: ${result.sourceFiles} files; ${result.directWriteSiteOccurrences} direct operation occurrences in ${result.distinctDirectOwners} distinct direct owners.`);
  console.log(`DENOMINATOR: ${result.inspectedCapabilityOwners} capability owners, including callers; ${result.reviewedOwners} reviewed; ${result.unresolvedOwners} unresolved.`);
  console.log(`RIVAL AUTHORS: ${result.counts.rival_author} confirmed / ${result.inspectedCapabilityOwners} candidates. ${result.unresolvedOwners ? 'ZERO NOT PROVEN.' : ''}`);
  console.log(`DERIVED-OUTPUT WRITERS: ${result.counts.derived_output_writer} confirmed / ${result.inspectedCapabilityOwners} candidates. ${result.unresolvedOwners ? 'ZERO NOT PROVEN.' : ''}`);
  for (const error of result.errors) console.log(`ERROR: ${error}`);
  console.log(`WEEKLY_WRITER_GATE_EXIT=${result.ok ? 0 : 1}`);
}

if (require.main === module) {
  const flags = process.argv.slice(2);
  if (flags.some((flag) => !['--json', '--report'].includes(flag))) throw new Error('Expected --json and/or --report');
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/weekly-writer-ownership.json'), 'utf8'));
  const result = scanSources({ registry });
  if (flags.includes('--json')) console.log(JSON.stringify(result, null, 2));
  else printSummary(result);
  // Report mode emits evidence without claiming release approval.
  if (!flags.includes('--report')) process.exitCode = result.ok ? 0 : 1;
}

module.exports = { scanSources, printSummary, CATEGORIES };
