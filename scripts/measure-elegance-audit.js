const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function relative(file) {
  return path.relative(ROOT, file).replaceAll(path.sep, '/');
}

const allTs = walk(SRC).filter((file) => /\.tsx?$/.test(file));
const production = allTs.filter((file) =>
  !file.includes(`${path.sep}__tests__${path.sep}`) &&
  !file.includes(`${path.sep}__scratch__${path.sep}`),
);
const productionSet = new Set(production.map((file) => path.resolve(file)));

function resolveLocal(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), specifier);
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
  ]) {
    if (productionSet.has(candidate)) return candidate;
  }
  return null;
}

const graph = new Map(production.map((file) => [file, new Set()]));
const lineCounts = new Map();
const keywordFiles = new Map([
  ['fallback', new Set()],
  ['repair', new Set()],
  ['canonical', new Set()],
  ['normaliz', new Set()],
  ['override', new Set()],
  ['projection', new Set()],
  ['adapter', new Set()],
  ['legacy', new Set()],
]);

for (const file of production) {
  const sourceText = fs.readFileSync(file, 'utf8');
  lineCounts.set(file, sourceText.split(/\r?\n/).length);
  const lower = sourceText.toLowerCase();
  for (const [word, files] of keywordFiles) {
    if (lower.includes(word)) files.add(file);
  }

  const source = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const visit = (node) => {
    let specifier = null;
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      specifier = node.moduleSpecifier.text;
    } else if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require' &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifier = node.arguments[0].text;
    }
    if (specifier) {
      const resolved = resolveLocal(file, specifier);
      if (resolved) graph.get(file).add(resolved);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

const incoming = new Map(production.map((file) => [file, 0]));
for (const edges of graph.values()) {
  for (const target of edges) incoming.set(target, incoming.get(target) + 1);
}

let index = 0;
const indices = new Map();
const lowlinks = new Map();
const stack = [];
const onStack = new Set();
const components = [];

function strongConnect(node) {
  indices.set(node, index);
  lowlinks.set(node, index);
  index += 1;
  stack.push(node);
  onStack.add(node);

  for (const target of graph.get(node)) {
    if (!indices.has(target)) {
      strongConnect(target);
      lowlinks.set(node, Math.min(lowlinks.get(node), lowlinks.get(target)));
    } else if (onStack.has(target)) {
      lowlinks.set(node, Math.min(lowlinks.get(node), indices.get(target)));
    }
  }

  if (lowlinks.get(node) === indices.get(node)) {
    const component = [];
    let member;
    do {
      member = stack.pop();
      onStack.delete(member);
      component.push(member);
    } while (member !== node);
    components.push(component);
  }
}

for (const file of production) {
  if (!indices.has(file)) strongConnect(file);
}

function top(map, count = 20) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || relative(a[0]).localeCompare(relative(b[0])))
    .slice(0, count)
    .map(([file, value]) => ({ file: relative(file), value }));
}

const byArea = {};
for (const file of production) {
  const area = relative(file).split('/')[1];
  byArea[area] ??= { files: 0, lines: 0 };
  byArea[area].files += 1;
  byArea[area].lines += lineCounts.get(file);
}

const crossLayer = [];
const layerEdgeMatrix = {};
for (const [file, edges] of graph) {
  const fromArea = relative(file).split('/')[1];
  for (const target of edges) {
    const toArea = relative(target).split('/')[1];
    if (fromArea !== toArea) {
      crossLayer.push({ from: relative(file), to: relative(target) });
      const key = `${fromArea}->${toArea}`;
      layerEdgeMatrix[key] = (layerEdgeMatrix[key] ?? 0) + 1;
    }
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  corpus: {
    productionFiles: production.length,
    productionLines: [...lineCounts.values()].reduce((sum, value) => sum + value, 0),
    filesOver1000Lines: [...lineCounts.values()].filter((value) => value > 1000).length,
    filesOver2000Lines: [...lineCounts.values()].filter((value) => value > 2000).length,
    filesOver4000Lines: [...lineCounts.values()].filter((value) => value > 4000).length,
  },
  byArea: Object.fromEntries(Object.entries(byArea).sort((a, b) => b[1].lines - a[1].lines)),
  graph: {
    relativeImportEdges: [...graph.values()].reduce((sum, edges) => sum + edges.size, 0),
    crossLayerEdges: crossLayer.length,
    circularGroups: components.filter((component) => component.length > 1).length,
    filesInCircularGroups: components.filter((component) => component.length > 1).flat().length,
    circularGroupSizes: components
      .filter((component) => component.length > 1)
      .map((component) => component.length)
      .sort((a, b) => b - a),
    busiestCrossLayerDirections: Object.fromEntries(
      Object.entries(layerEdgeMatrix).sort((a, b) => b[1] - a[1]).slice(0, 20),
    ),
    largestCircularGroups: components
      .filter((component) => component.length > 1)
      .sort((a, b) => b.length - a.length)
      .slice(0, 10)
      .map((component) => component.map(relative).sort()),
  },
  largestFiles: top(lineCounts, 25),
  highestFanIn: top(incoming, 25),
  highestFanOut: top(new Map([...graph].map(([file, edges]) => [file, edges.size])), 25),
  keywordReach: Object.fromEntries(
    [...keywordFiles].map(([word, files]) => [word, files.size]),
  ),
};

console.log(JSON.stringify(report, null, 2));
