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

/** Source-level dependency fence for Bible-authored expectations. */
export function verifyExpectationImportBoundary(expectationsDir: string): ImportBoundaryResult {
  const checkedFiles = fs.readdirSync(expectationsDir)
    .filter((file) => file.endsWith('.ts') && file !== 'importBoundaryTests.ts')
    .sort();
  const violations: string[] = [];

  for (const file of checkedFiles) {
    const source = fs.readFileSync(path.join(expectationsDir, file), 'utf8');
    for (const specifier of importSpecifiers(source)) {
      if (isForbidden(specifier)) violations.push(`${file}: forbidden import "${specifier}"`);
    }
  }

  return { checkedFiles, violations };
}
