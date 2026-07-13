import fs from 'node:fs';
import path from 'node:path';

export interface ImportBoundaryResult {
  checkedFiles: string[];
  violations: string[];
}

const ALLOWED_HARNESS_IMPORTS = new Set([
  '../types',
]);

const FORBIDDEN_PRODUCTION_SEGMENTS = new Set([
  'rules',
  'utils',
  'data',
  'services',
  'store',
]);

function importSpecifiers(source: string): string[] {
  const specs: string[] = [];
  const pattern = /(?:from\s+|require\(\s*)['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(pattern)) specs.push(match[1]);
  return specs;
}

function isForbidden(specifier: string): boolean {
  if (specifier.startsWith('node:')) return false;
  if (ALLOWED_HARNESS_IMPORTS.has(specifier)) return false;
  const segments = specifier.split('/').filter((segment) => segment && segment !== '..' && segment !== '.');
  return specifier.startsWith('../../..') ||
    segments.some((segment) => FORBIDDEN_PRODUCTION_SEGMENTS.has(segment));
}

function filesRecursively(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? filesRecursively(full) : entry.name.endsWith('.ts') ? [full] : [];
  });
}

/** Source-level dependency fence for Bible-authored expectations and generated expected outcomes. */
export function verifyExpectationImportBoundary(expectationsDir: string): ImportBoundaryResult {
  const harnessRoot = path.dirname(expectationsDir);
  const absoluteFiles = [
    ...filesRecursively(expectationsDir).filter((file) => !file.endsWith('importBoundaryTests.ts')),
    ...filesRecursively(path.join(harnessRoot, 'properties')),
    ...filesRecursively(path.join(harnessRoot, 'metamorphic')).filter((file) => /expected/i.test(path.basename(file))),
    ...filesRecursively(path.join(harnessRoot, 'registry')),
  ].sort();
  const checkedFiles = absoluteFiles.map((file) => path.relative(harnessRoot, file));
  const violations: string[] = [];

  for (const absoluteFile of absoluteFiles) {
    const file = path.relative(harnessRoot, absoluteFile);
    const source = fs.readFileSync(absoluteFile, 'utf8');
    for (const specifier of importSpecifiers(source)) {
      if (isForbidden(specifier)) violations.push(`${file}: forbidden import "${specifier}"`);
    }
  }

  return { checkedFiles, violations };
}
