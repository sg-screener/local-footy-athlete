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
import { safeTextLineHeight } from '../theme/textLineBox';

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

run('onboarding alone keeps the original readable type scale', () => {
  const source = read('theme/onboardingTypography.ts');
  const expected = [
    ['h1', 36, 42], ['h2', 30, 36], ['h3', 24, 30], ['h4', 20, 26],
    ['body', 16, 24], ['bodySmall', 14, 20], ['caption', 12, 16],
    ['label', 14, 20], ['labelSmall', 12, 16], ['overline', 13, 18],
    ['button', 16, 24], ['buttonSmall', 14, 20],
  ] as const;
  for (const [variant, size, lineHeight] of expected) {
    const regionAt = source.indexOf(`${variant}: {`);
    assert(regionAt >= 0, `${variant}: onboarding typography variant was not found`);
    const region = source.slice(regionAt, regionAt + 260);
    assert(new RegExp(`fontSize:\\s*${String(size).replace('.', '\\.')}(?:,|\\s)`).test(region),
      `${variant}: expected original onboarding size ${size}`);
    assert(new RegExp(`lineHeight:\\s*${lineHeight}(?:,|\\s)`).test(region),
      `${variant}: expected original onboarding line-height ${lineHeight}`);
  }

  const text = read('components/common/Text.tsx');
  assert(/createContext<TypographyScale>\(typography\)/.test(text),
    'shared Text has no scoped typography owner');
  assert(/useContext\(TypographyContext\)/.test(text),
    'shared Text does not read the active typography scope');

  const navigator = read('navigation/OnboardingNavigator.tsx');
  const scopeAt = navigator.indexOf('<TypographyScope scale={onboardingTypography}>');
  const stackAt = navigator.indexOf('<Stack.Navigator');
  const scopeCloseAt = navigator.indexOf('</TypographyScope>');
  assert(scopeAt >= 0 && stackAt >= 0 && scopeCloseAt >= 0,
    'onboarding typography scope anchors were not all found');
  assert(scopeAt < stackAt && stackAt < scopeCloseAt,
    'the onboarding typography scope does not contain the navigator');
});

run('shared Text and AppTextInput both apply the one system family', () => {
  const text = read('components/common/Text.tsx');
  const input = read('components/keyboard/AppTextInput.tsx');
  assert(/fontFamily:\s*typo\.fontFamily/.test(text),
    'the shared Text drops the typography family before rendering');
  assert(/fontFamily:\s*fontFamilies\.default/.test(input),
    'AppTextInput does not apply the app-wide system family');
  assert(/style=\{\[styles\.default, props\.style, resolvedLineBox\]\}/.test(input),
    'AppTextInput does not preserve caller styling before its line-box guard');
});

run('every local font-size override receives a safe effective line box', () => {
  const text = read('components/common/Text.tsx');
  const input = read('components/keyboard/AppTextInput.tsx');
  assert(safeTextLineHeight(22, 17) === 26,
    'a 22px title can still inherit the clipped 17px body line box');
  assert(safeTextLineHeight(12, 20) === 20,
    'an already-roomy authored line box was unnecessarily reduced');
  assert(/StyleSheet\.flatten\(style\)/.test(text)
      && /style=\{\[styles\.default, textStyles, style, resolvedLineBox\]\}/.test(text),
    'shared Text does not resolve the final caller size and apply its guard last');
  assert(/StyleSheet\.flatten\(props\.style\)/.test(input)
      && /safeTextLineHeight\(/.test(input),
    'AppTextInput can still render a local font size in a smaller line box');

  const files = [
    ...productionTsxFiles('screens'),
    ...productionTsxFiles('components'),
  ];
  const overrides = files.flatMap((relative) => {
    const matches = read(relative).match(/fontSize\s*:/g) ?? [];
    return matches.map(() => relative);
  });
  assert(overrides.length > 0,
    'the local font-size census reached no occurrences, so the structural guard proves nothing');
  console.log(`      census: ${overrides.length} font-size occurrences across ${new Set(overrides).size} files`);
});

run('every athlete-facing screen stays behind the shared Text owner', () => {
  const offenders: string[] = [];
  for (const relative of [
    ...productionTsxFiles('screens'),
    ...productionTsxFiles('components'),
  ]) {
    if (relative.startsWith('components/dev/')) continue;
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
