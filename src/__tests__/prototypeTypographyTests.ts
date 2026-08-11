/**
 * RENEE'S TYPOGRAPHY IS THE APP TYPOGRAPHY — Sam, 2026-08-11.
 *
 * The reference is the signed interactive prototype. Its type system is the
 * Apple system face with a deliberately compact six-step scale. This gate
 * watches the OWNERS, not every rendered string: every production screen uses
 * the shared Text component, every editable field uses AppTextInput, and those
 * two owners apply the same family. A screen importing React Native Text would
 * bypass the owner, so the census fails rather than silently accepting a second
 * type system.
 *
 * Run: npm run test:prototype-typography
 */

import * as fs from 'fs';
import * as path from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';

armTotalsOrRed();

let passed = 0; let failed = 0; const failures: string[] = [];
function assert(c: unknown, d: string): asserts c { if (!c) throw new Error(d); }
function run(name: string, body: () => void): void {
  try { body(); passed += 1; console.log(`  PASS ${name}`); }
  catch (error) {
    failed += 1; failures.push(name);
    console.error(`  FAIL ${name}\n      ${error instanceof Error ? error.message : error}`);
  }
}

const ROOT = path.join(__dirname, '..');
const read = (relative: string) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function productionTsxFiles(directory: string): string[] {
  const absolute = path.join(ROOT, directory);
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) return productionTsxFiles(relative);
    return entry.isFile() && entry.name.endsWith('.tsx') ? [relative] : [];
  });
}

console.log('\n-- Renee prototype typography --');

run('the shared scale matches Renee\'s compact prototype hierarchy', () => {
  const source = read('theme/typography.ts');
  const expected = [
    ['h1', 23, 28], ['h2', 21, 25], ['h3', 17, 21], ['h4', 14, 18],
    ['body', 11.5, 17], ['bodySmall', 10.5, 15], ['caption', 8.5, 12],
    ['label', 10.5, 14], ['labelSmall', 9.5, 13], ['overline', 9, 12],
    ['button', 12, 16], ['buttonSmall', 11, 15],
  ] as const;
  for (const [variant, size, lineHeight] of expected) {
    const regionAt = source.indexOf(`${variant}: {`);
    assert(regionAt >= 0, `${variant}: typography variant was not found`);
    const region = source.slice(regionAt, regionAt + 260);
    assert(new RegExp(`fontSize:\\s*${String(size).replace('.', '\\.')}(?:,|\\s)`).test(region),
      `${variant}: expected Renee size ${size}`);
    assert(new RegExp(`lineHeight:\\s*${lineHeight}(?:,|\\s)`).test(region),
      `${variant}: expected Renee line-height ${lineHeight}`);
  }
  assert(!/BebasNeue/.test(source),
    'the retired industrial heading face is still in the shared type owner');
  assert(/default:\s*'System'/.test(source) && /heading:\s*'System'/.test(source),
    'the shared heading and body families are not both the iPhone system face');
});

run('shared Text and AppTextInput both apply the one system family', () => {
  const text = read('components/common/Text.tsx');
  const input = read('components/keyboard/AppTextInput.tsx');
  assert(/fontFamily:\s*typo\.fontFamily/.test(text),
    'the shared Text drops the typography family before rendering');
  assert(/fontFamily:\s*fontFamilies\.default/.test(input),
    'AppTextInput does not apply the app-wide system family');
  assert(/style=\{\[styles\.default, props\.style\]\}/.test(input),
    'AppTextInput does not preserve caller styling after its family default');
});

run('every athlete-facing screen stays behind the shared Text owner', () => {
  const offenders: string[] = [];
  for (const relative of [
    ...productionTsxFiles('screens'),
    ...productionTsxFiles('components'),
  ]) {
    if (relative.startsWith('components/dev/')) continue;
    if (relative === 'components/keyboard/KeyboardDoneAccessory.tsx') continue;
    const source = read(relative);
    const imports = [...source.matchAll(
      /import\s*\{([\s\S]*?)\}\s*from\s*['"]react-native['"]/g,
    )];
    if (imports.some((match) => /(?:^|,)\s*Text\s*(?:,|$)/.test(match[1]))) {
      offenders.push(relative);
    }
  }
  assert(offenders.length === 0,
    `these athlete-facing files bypass the shared type owner: ${offenders.join(', ')}`);
});

console.log(`\n  prototype typography totals: ${passed} passed, ${failed} failed`);
if (failures.length > 0) console.log(`  failed: ${failures.join(', ')}`);
totalsPrinted(failed);
if (failed > 0) process.exit(1);
