/** R-361 — the app accent is yellow; the supplied LFA logo is unchanged. */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';

armTotalsOrRed();

let passed = 0;
const failures: string[] = [];

function run(name: string, body: () => void): void {
  try {
    body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`  FAIL ${name}: ${(error as Error).message}`);
  }
}

const root = process.cwd();
const read = (relativePath: string): string => readFileSync(resolve(root, relativePath), 'utf8');

function filesBelow(relativePath: string): string[] {
  return readdirSync(resolve(root, relativePath)).flatMap((entry) => {
    const child = `${relativePath}/${entry}`;
    return statSync(resolve(root, child)).isDirectory() ? filesBelow(child) : [child];
  });
}

const productionFiles = [
  'App.tsx',
  ...filesBelow('src').filter((file) => /\.(ts|tsx)$/.test(file)
    && !file.startsWith('src/__tests__/')
    && file !== 'src/rules/lawRegistry.ts'),
  ...filesBelow('assets/icons').filter((file) => file.endsWith('.svg')),
];
const mutation = process.env.LFA_ACCENT_COLOUR_MUTATION;
const sourceFor = (file: string): string => {
  const source = read(file);
  if (mutation === 'old-primary' && file === 'src/theme/colors.ts') {
    return source.replace("lime: '#D8D800'", "lime: '#C8FF00'");
  }
  return source;
};

console.log('\n-- R-361 app accent colour --');

run('the primary accent token is exactly yellow #D8D800', () => {
  assert.match(sourceFor('src/theme/colors.ts'), /lime:\s*'#D8D800'/);
});

run('the pressed accent token is exactly #B0B000', () => {
  assert.match(sourceFor('src/theme/colors.ts'), /limeDark:\s*'#B0B000'/);
});

run('no active app source or pictogram retains the old lime colours or tints', () => {
  const offenders = productionFiles.filter((file) =>
    /#C8FF00|#A3CC00|#D9FF4D|#1A1D12|#141814|#14160F|rgba\(200,\s*255,\s*0,/i
      .test(sourceFor(file)));
  assert.deepEqual(offenders, []);
});

// Sam, 2026-09-03, the preview on his phone: *"'today's focus' on day view and
// the little icons on the weekly view still have the old lime green — why was
// lime green not completely ripped out of the app?"* The list above named the
// exact old tokens; three hand-written near-lime literals (#C6FF00) were not on
// it. Any hex in the lime family — strong red, full green, no blue — is refused
// in app source from here; the accent is the token, never a literal.
run('no active app source carries ANY lime-family literal (#8x–#Fx FF 00)', () => {
  const offenders = productionFiles.flatMap((file) => {
    const hits = sourceFor(file).match(/#[89a-f][0-9a-f]ff00\b/gi) ?? [];
    return hits.length ? [`${file}: ${Array.from(new Set(hits)).join(', ')}`] : [];
  });
  assert.deepEqual(offenders, []);
});

run('both shared primary buttons render the exact pressed colour', () => {
  for (const file of ['src/components/ui/Button.tsx', 'src/components/common/Button.tsx']) {
    const source = sourceFor(file);
    assert.match(source, /pressed[\s\S]{0,180}variant\s*===\s*'primary'[\s\S]{0,180}colors\.accent\.limeDark/,
      `${file} does not bind the primary pressed state to the pressed token`);
  }
});

run('all six traced app pictograms use the new yellow accent', () => {
  const traced = productionFiles.filter((file) => file.endsWith('-traced.svg'));
  assert.equal(traced.length, 6);
  for (const file of traced) assert.match(sourceFor(file), /color="#D8D800"/);
});

run('the reusable LFA logo keeps its original white default and vector geometry', () => {
  const wordmark = sourceFor('src/components/branding/LfaWordmark.tsx');
  assert.match(wordmark, /color\s*=\s*'#FFFFFF'/);
  assert.match(wordmark, /viewBox="0 0 871 314"/);
  assert.equal((wordmark.match(/<Path\b/g) ?? []).length, 3);
});

if (!mutation) run('mutation: restoring the old primary lime makes this guard fail', () => {
  const child = spawnSync(resolve(root, 'node_modules/.bin/sucrase-node'), [__filename], {
    encoding: 'utf8',
    env: { ...process.env, LFA_ACCENT_COLOUR_MUTATION: 'old-primary' },
    timeout: 120000,
  });
  assert.equal(child.status, 1);
  assert.match(`${child.stdout}\n${child.stderr}`, /primary accent token|retains the old lime colours/);
});

console.log(`\nAccent colour: passed=${passed}/${mutation ? 6 : 7} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) process.exit(1);
