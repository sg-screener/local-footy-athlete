/** Clean-room phrase-branch ratchet for the current and future Coach. */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import * as fs from 'fs';
import * as path from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';

armTotalsOrRed();

const SRC = path.join(__dirname, '..');
const BASELINE = path.join(__dirname, '..', '..', 'scripts', 'coach-phrase-baseline.json');

let passed = 0;
let failed = 0;

function check(name: string, condition: unknown, detail?: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL ${name}`, detail ?? '');
}

function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function phraseBranches(source: string): number {
  const code = codeOnly(source);
  const regexTests = code.match(/\/[^/\n]{4,}\/[gimsuy]*/g)?.length ?? 0;
  const singleQuoted = code.match(/\.includes\(\s*'[^']{4,}'/g)?.length ?? 0;
  const doubleQuoted = code.match(/\.includes\(\s*"[^"]{4,}"/g)?.length ?? 0;
  return regexTests + singleQuoted + doubleQuoted;
}

function coachFiles(): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/coach/i.test(entry.name) && /\.tsx?$/.test(entry.name)) {
        const relative = path.relative(SRC, full);
        if (!relative.startsWith('__tests__/') && !relative.startsWith('dev/')) {
          found.push(relative);
        }
      }
    }
  };
  walk(SRC);
  return found.sort();
}

function measure(): Record<string, number> {
  const measured: Record<string, number> = {};
  for (const file of coachFiles()) {
    const count = phraseBranches(fs.readFileSync(path.join(SRC, file), 'utf8'));
    if (count > 0) measured[file] = count;
  }
  return measured;
}

const current = measure();

if (process.argv.includes('--update')) {
  fs.writeFileSync(BASELINE, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`Coach phrase baseline: ${Object.keys(current).length} files`);
  totalsPrinted(0);
} else {
  check('the scan reaches the current Coach path', Object.keys(current).length > 3,
    Object.keys(current));
  check('the known lexical reader remains visible to the scan',
    (current['rules/coachQuestion.ts'] ?? 0) > 0, current['rules/coachQuestion.ts']);
  check('line comments do not count', phraseBranches('// /hello there/.test(value)') === 0);
  check('block comments do not count', phraseBranches('/* /hello there/.test(value) */') === 0);
  check('a live branch does count', phraseBranches('/hello there/.test(value)') === 1);
  check('the clean-room baseline exists', fs.existsSync(BASELINE));

  if (fs.existsSync(BASELINE)) {
    const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8')) as Record<string, number>;
    const grew = Object.entries(current)
      .filter(([file, count]) => count > (baseline[file] ?? 0))
      .map(([file, count]) => `${file}: ${baseline[file] ?? 0} -> ${count}`);
    check('no Coach file grows a text-literal branch', grew.length === 0, grew);
    const newFiles = Object.keys(current).filter((file) => !(file in baseline));
    check('no new Coach file arrives with text-literal branches', newFiles.length === 0, newFiles);
  }

  console.log(`\nCoach phrase ratchet: ${passed} passed, ${failed} failed`);
  totalsPrinted(failed);
  if (failed > 0) process.exit(1);
}
