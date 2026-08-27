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
  'dormant_quarantined',
]);
// Preserve Sam's built-but-unwired work without allowing it to become an
// alternate runtime author. These exact capabilities stay fingerprinted and
// counted. ANY runtime import of either module blocks release until deliberate
// compiler integration replaces this boundary and supplies acceptance tests.
const DORMANT_OWNERS = new Set([
  'src/data/timeTrialSession.ts#buildTimeTrialSession',
  'src/data/timeTrialSession.ts#timeTrialWorkout',
  'src/rules/mobilityPairing.ts#mobilityRowFor',
  'src/rules/mobilityPairing.ts#pairMobilityWithAccessories',
]);
const DORMANT_FILES = new Set([...DORMANT_OWNERS].map(id => id.split('#')[0]));
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
    if (relative(root, file) === 'src/utils/applyAdjustmentEvents.ts') {
      errors.push('retired event/move author returned to runtime: src/utils/applyAdjustmentEvents.ts');
    }
    if (relative(root, file) === 'src/rules/section18OfferPlacement.ts') {
      errors.push('retired post-acceptance offer author returned to runtime: src/rules/section18OfferPlacement.ts');
    }
    if (relative(root, file) === 'src/utils/planChangeProducer.ts' && sf.statements.some(statement =>
      ts.isFunctionDeclaration(statement) && statement.body && statement.name?.text === 'buildPlanChangeProposal')) {
      errors.push(`${relative(root, file)}: retired parallel session proposal author must not return`);
    }
    if (relative(root, file) === 'src/dev/e2e/devE2ESeedRegistry.ts' && sf.statements.some(statement =>
      ts.isFunctionDeclaration(statement) && statement.body && ['stabilizeProgram', 'stabilizeMicrocycle'].includes(statement.name?.text))) {
      errors.push(`${relative(root, file)}: retired diagnostic program rewriter must not return`);
    }
    if (relative(root, file) === 'src/utils/exerciseScorer.ts' ||
      relative(root, file) === 'src/utils/sessionBuilder.ts' && sf.statements.some(statement =>
        ts.isFunctionDeclaration(statement) && statement.body && statement.name?.text === 'buildTagAwareSession')) {
      errors.push('retired independent strength selector returned to runtime');
    }
    if (relative(root, file) === 'src/utils/sessionBuilder.ts' && sf.statements.some(statement =>
      ts.isFunctionDeclaration(statement) && statement.body && statement.name?.text === 'buildConditioningSession')) {
      errors.push('retired read-side conditioning author returned to runtime');
    }
    if (relative(root, file) === 'src/utils/sessionResolver.ts' && sf.statements.some(statement =>
      ts.isFunctionDeclaration(statement) && statement.body && statement.name?.text === 'applyAwayPass')) {
      errors.push('retired read-side travel author returned to runtime: applyAwayPass');
    }
    if (relative(root, file) === 'src/data/defaultProgram.ts') {
      const retired = new Set(['DEFAULT_PROGRAM', 'createDefaultMicrocycle',
        'createWorkout', 'createWorkoutExercises']);
      for (const statement of sf.statements) {
        const names = ts.isFunctionDeclaration(statement) && statement.body
          ? [statement.name?.text]
          : ts.isVariableStatement(statement)
          ? statement.declarationList.declarations.filter(declaration => declaration.initializer)
            .map(declaration => propertyName(declaration.name))
          : [];
        for (const name of names) {
          if (retired.has(name)) errors.push(`retired default-program author returned to runtime: ${name}`);
        }
      }
    }
    // Excluding diagnostics from the denominator is valid only while runtime
    // cannot import them. Check every runtime edge, including barrels and lazy
    // loaders, so moving a writer to tests cannot hide an executable author.
    if (!/(^|\/)(__tests__|__mocks__)\//.test(relative(root, file))) {
      function isModuleLoader(expression, seen = new Set()) {
        if (expression.kind === ts.SyntaxKind.ImportKeyword) return true;
        if (!ts.isIdentifier(expression) || seen.has(expression)) return false;
        if (expression.text === 'require') return true;
        seen.add(expression);
        const declaration = checker.getSymbolAtLocation(expression)?.valueDeclaration;
        return !!declaration && ts.isVariableDeclaration(declaration) &&
          !!declaration.initializer && isModuleLoader(declaration.initializer, seen);
      }
      function inspectImport(node) {
        let specifier = null;
        if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly) {
          const clause = node.importClause;
          const bindings = clause?.namedBindings;
          if (!clause || clause.name || !bindings || ts.isNamespaceImport(bindings) ||
              bindings.elements.length === 0 || bindings.elements.some(element => !element.isTypeOnly)) {
            specifier = node.moduleSpecifier;
          }
        }
        if (ts.isExportDeclaration(node) && !node.isTypeOnly) {
          const clause = node.exportClause;
          if (!clause || ts.isNamespaceExport(clause) ||
              clause.elements.length === 0 || clause.elements.some(element => !element.isTypeOnly)) {
            specifier = node.moduleSpecifier;
          }
        }
        if (ts.isImportEqualsDeclaration(node) && !node.isTypeOnly &&
            ts.isExternalModuleReference(node.moduleReference)) specifier = node.moduleReference.expression;
        if (ts.isCallExpression(node) && isModuleLoader(node.expression)) specifier = node.arguments[0];
        function literalModuleName(expression, seen = new Set()) {
          if (ts.isStringLiteralLike(expression)) return expression.text;
          if (ts.isParenthesizedExpression(expression)) return literalModuleName(expression.expression, seen);
          if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.PlusToken) {
            const left = literalModuleName(expression.left, new Set(seen));
            const right = literalModuleName(expression.right, new Set(seen));
            return left !== null && right !== null ? left + right : null;
          }
          if (ts.isIdentifier(expression) && !seen.has(expression.text)) {
            seen.add(expression.text);
            const declaration = checker.getSymbolAtLocation(expression)?.valueDeclaration;
            if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer &&
                ts.isVariableDeclarationList(declaration.parent) && (declaration.parent.flags & ts.NodeFlags.Const)) {
              return literalModuleName(declaration.initializer, seen);
            }
          }
          return null;
        }
        if (specifier) {
          const moduleName = literalModuleName(specifier);
          if (moduleName === null) {
            errors.push(`unresolved runtime module loader: ${relative(root, file)}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`);
            ts.forEachChild(node, inspectImport);
            return;
          }
          const resolved = ts.resolveModuleName(moduleName, file, options, host).resolvedModule?.resolvedFileName;
          const target = resolved ?? (moduleName.startsWith('.')
            ? path.resolve(path.dirname(file), moduleName) : moduleName);
          if (/(^|\/)(__tests__|__mocks__)\//.test(relative(root, target))) {
            errors.push(`runtime imports excluded diagnostic code: ${relative(root, file)} -> ${moduleName}`);
          }
          if (DORMANT_FILES.has(relative(root, target)) ||
              DORMANT_FILES.has(relative(root, target) + '.ts')) {
            errors.push(`runtime imports quarantined programming: ${relative(root, file)} -> ${moduleName}`);
          }
        }
        ts.forEachChild(node, inspectImport);
      }
      inspectImport(sf);
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
  function readOnlyBuiltinCollectionMember(symbol) {
    // Array<Workout>.map/find is not an opaque store method. Resolve its actual
    // TypeScript library declaration, never exempt a user method by its name.
    // Callback bodies/references still enter the executable graph independently.
    return !!symbol?.declarations?.length && symbol.declarations.every(declaration =>
      /[/\\]typescript[/\\]lib[/\\]lib\..*\.d\.ts$/.test(declaration.getSourceFile().fileName) &&
      ts.isInterfaceDeclaration(declaration.parent) &&
      ['Array', 'ReadonlyArray'].includes(declaration.parent.name.text) &&
      !MUTATORS.has(propertyName(declaration.name)));
  }
  function librarySnapshotRead(symbol) {
    // Resolve the dependency's declaration, never trust a method named getState
    // on an arbitrary object. Only these reads return an existing reference.
    return !!symbol?.declarations?.length && symbol.declarations.every(declaration => {
      const file = declaration.getSourceFile().fileName.replace(/\\/g, '/');
      const name = propertyName(declaration.name);
      return (/\/node_modules\/zustand\/vanilla\.d\.ts$/.test(file) && name === 'getState') ||
        (/\/typescript\/lib\/lib\..*\.d\.ts$/.test(file) && name === 'get' &&
          ts.isInterfaceDeclaration(declaration.parent) &&
          ['Map', 'ReadonlyMap', 'WeakMap'].includes(declaration.parent.name.text));
    });
  }
  function isPassiveReferenceReader(unit) {
    // This proof is deliberately smaller than "pure function". A filter or an
    // immutable spread can author different sessions while looking pure. Only
    // returning an already-existing reference is admitted; all constructions,
    // transforms, unknown calls and assignments require source review.
    if (!ts.isFunctionLike(unit.node) || !unit.node.body || !unit.sites.length ||
        unit.sites.some(site => site.kind !== 'return_domain')) return false;
    let safe = true;
    function inspect(node) {
      if (!safe || ts.isTypeNode(node)) return;
      if ((node !== unit.node && ts.isFunctionLike(node)) ||
          ts.isObjectLiteralExpression(node) || ts.isArrayLiteralExpression(node) ||
          ts.isNewExpression(node) || ts.isDeleteExpression(node) ||
          ts.isAwaitExpression(node) || ts.isYieldExpression(node) ||
          ts.isTaggedTemplateExpression(node) ||
          (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
            node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) ||
          ((ts.isPostfixUnaryExpression(node) || ts.isPrefixUnaryExpression(node)) &&
            [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator))) {
        safe = false; return;
      }
      if (ts.isCallExpression(node) && !librarySnapshotRead(resolveSymbol(node.expression))) {
        safe = false; return;
      }
      ts.forEachChild(node, inspect);
    }
    inspect(unit.node.body);
    return safe;
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
      // Type signatures and import/export declarations do not execute writers.
      // Runtime references (including callbacks) are still followed below.
      if (ts.isTypeNode(node) || ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
      const unit = owner(node);
      // Store interfaces often expose method signatures, not the arrow-function
      // implementation inside a Zustand initializer. Symbol resolution alone
      // loses this edge. Keep such domain callables RED for explicit review,
      // including callback references, computed access and destructured aliases.
      if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
        const receiver = node.expression;
        const symbol = resolveSymbol(ts.isPropertyAccessExpression(node) ? node.name : node);
        if (domainType(checker.getTypeAtLocation(receiver)) && !symbolUnit(symbol) &&
            !readOnlyBuiltinCollectionMember(symbol) &&
            checker.getTypeAtLocation(node).getCallSignatures().length > 0) {
          site(node, 'opaque_domain_callable_requires_review', node.getText(sf));
        }
      }
      if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
        const initializer = node.parent.parent.initializer;
        if (initializer && domainType(checker.getTypeAtLocation(initializer)) &&
            !readOnlyBuiltinCollectionMember(resolveSymbol(node.name)) &&
            !symbolUnit(resolveSymbol(node.name)) && checker.getTypeAtLocation(node.name).getCallSignatures().length > 0) {
          site(node, 'opaque_domain_callable_requires_review', node.getText(sf));
        }
      }
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
      if ((ts.isSpreadAssignment(node) || ts.isSpreadElement(node)) && semantic(node.expression)) {
        // Inferred object types lose the Workout alias. A spread-only clone
        // (including one with an altered name/identity) is still a capable
        // return path even when no explicit `exercises:` property is written.
        site(node, 'copy_domain', node.expression.getText(sf));
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
    // The reviewed subject includes the detector's operation inventory, not
    // only source text. A new type/sink insight must invalidate an old review
    // even when the function body has not changed.
    const operations = unit.sites.map(({ kind, field }) => ({ kind,
      field: String(field ?? '').replace(/\s+/g, ' ').trim() }));
    const fingerprint = hash(printer.printNode(ts.EmitHint.Unspecified, unit.node, unit.sf) +
      '\n' + calls.join('\n') + '\n' + JSON.stringify(operations));
    const review = registry.owners?.[id];
    let reviewStatus = !review ? 'unreviewed' : review.fingerprint !== fingerprint ? 'changed' : 'reviewed';
    if (review && (!CATEGORIES.has(review.classification) || !review.reason?.trim())) {
      errors.push(`invalid review: ${id}`); reviewStatus = 'invalid';
    }
    if (review?.classification === 'dormant_quarantined' && !DORMANT_OWNERS.has(id)) {
      errors.push(`unapproved dormant capability: ${id}`); reviewStatus = 'invalid';
    }
    return { id, file: unit.file, line: unit.line, fingerprint, reviewStatus, reviewOrigin: review ? 'explicit' : null,
      classification: review?.classification ?? null, reason: review?.reason ?? null,
      sites: unit.sites.map(({ key, ...rest }) => rest), calls, callers };
  });
  // A function with no direct capability may only delegate. Prove its entire
  // reachable capability graph, rather than requiring another prose approval
  // for the same writer at every UI/callback layer. Never inherit through an
  // opaque site, an unknown/changed owner, or an explicitly rejected review.
  // Cycles remain unresolved unless an explicit review breaks the cycle.
  const byId = new Map(rows.map(row => [row.id, row]));
  let inherited = true;
  while (inherited) {
    inherited = false;
    for (const row of rows) {
      if (row.reviewStatus === 'unreviewed' && isPassiveReferenceReader(units.get(row.id)) &&
          row.calls.every(id => byId.get(id)?.reviewStatus === 'reviewed' &&
            byId.get(id)?.classification === 'projection_display')) {
        row.classification = 'projection_display';
        row.reviewStatus = 'reviewed';
        row.reviewOrigin = 'structural_reference_read';
        row.reason = 'AST proves an existing-reference reader: no construction, transform, mutation, unknown call or non-reader callee. Dependency snapshot reads resolve to library declarations.';
        inherited = true;
        continue;
      }
      if (row.reviewStatus !== 'unreviewed' || row.sites.length || !row.calls.length) continue;
      const callees = row.calls.map(id => byId.get(id));
      if (!callees.every(callee => callee?.reviewStatus === 'reviewed')) continue;
      const categories = new Set(callees.map(callee => callee.classification));
      // No caller inherits quarantine. Its import is already a release error;
      // it must also remain unresolved instead of acquiring runtime permission.
      if (categories.has('dormant_quarantined')) continue;
      // Carry a rejected capability upward instead of laundering it through
      // a zero-site wrapper. The direct owner is still counted independently.
      row.classification = ['rival_author', 'derived_output_writer', 'canonical_input_writer',
        'persistence_boundary', 'canonical_compiler', 'legacy_ingress', 'projection_display']
        .find(category => categories.has(category));
      row.reviewStatus = 'reviewed';
      row.reviewOrigin = 'inherited_call_graph';
      row.reason = `No direct operations; all ${callees.length} callable capability owners are verified. See calls for exact dependencies.`;
      inherited = true;
    }
  }
  const stale = Object.keys(registry.owners ?? {}).filter((id) => !capable.has(id));
  for (const id of stale) errors.push(`review names an absent capability: ${id}`);
  const reviewed = rows.filter((row) => row.reviewStatus === 'reviewed');
  const counts = Object.fromEntries([...CATEGORIES].map((category) =>
    [category, reviewed.filter((row) => row.classification === category &&
      (!['rival_author', 'derived_output_writer'].includes(category) || row.reviewOrigin === 'explicit')).length]));
  const result = { schemaVersion: 1,
    unit: 'distinct executable capability owners (file + named function, anonymous callbacks grouped with owner)',
    scope: 'App/index, all src JS/TS including dev, and deployable edge functions; excludes tests, mocks, declarations and dependencies',
    sourceFiles: files.length, executableOwners: units.size,
    directWriteSiteOccurrences: rows.reduce((sum, row) => sum + row.sites.length, 0),
    distinctDirectOwners: rows.filter((row) => row.sites.length).length,
    inspectedCapabilityOwners: rows.length, reviewedOwners: reviewed.length,
    explicitlyReviewedOwners: reviewed.filter(row => row.reviewOrigin === 'explicit').length,
    structurallyProvenReaders: reviewed.filter(row => row.reviewOrigin === 'structural_reference_read').length,
    inheritedCallGraphOwners: reviewed.filter(row => row.reviewOrigin === 'inherited_call_graph').length,
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
  console.log(`REVIEW BASIS: ${result.explicitlyReviewedOwners} explicit reviews; ${result.structurallyProvenReaders} AST-proven existing-reference readers; ${result.inheritedCallGraphOwners} zero-operation callers verified through their complete callee graph. Confirmed authors/writers exclude inherited callers.`);
  console.log(`RIVAL AUTHORS: ${result.counts.rival_author} confirmed / ${result.inspectedCapabilityOwners} candidates. ${result.unresolvedOwners ? 'ZERO NOT PROVEN.' : ''}`);
  console.log(`DERIVED-OUTPUT WRITERS: ${result.counts.derived_output_writer} confirmed / ${result.inspectedCapabilityOwners} candidates. ${result.unresolvedOwners ? 'ZERO NOT PROVEN.' : ''}`);
  console.log(`DORMANT QUARANTINE: ${result.counts.dormant_quarantined} inventoried capabilities in protected unwired modules; runtime imports are forbidden. These are not integrated features.`);
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
