/**
 * WHICH `coachingEngine` HELPERS ARE NOW UNREACHABLE — computed, not eyeballed.
 *
 *   npx sucrase-node scripts/find-unreachable-engine-helpers.ts
 *
 * Deleting the legacy weekly planner strands whatever only it called, and that
 * strands whatever only THOSE called. Doing the cascade by hand is how a live
 * function gets deleted or a dead one survives — this repo has paid for both.
 *
 * For every top-level function in the file it counts references OUTSIDE the
 * function's own body, plus references anywhere else in `src`. A function with
 * neither is unreachable and is reported with its exact line span. It deletes
 * nothing: the operator reads the list and the spans, so a surprise stays a
 * surprise rather than becoming a commit.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..');
const ENGINE = resolve(ROOT, 'src/utils/coachingEngine.ts');
const lines = readFileSync(ENGINE, 'utf8').split('\n');

interface Fn { name: string; exported: boolean; start: number; end: number; }

const fns: Fn[] = [];
lines.forEach((line, index) => {
  const match = /^(export )?(async )?function (\w+)/.exec(line);
  if (!match) return;
  let depth = 0; let started = false; let end = index;
  for (let k = index; k < lines.length; k += 1) {
    depth += (lines[k].match(/\{/g) ?? []).length;
    depth -= (lines[k].match(/\}/g) ?? []).length;
    if (lines[k].includes('{')) started = true;
    if (started && depth <= 0) { end = k; break; }
  }
  fns.push({ name: match[3], exported: !!match[1], start: index, end });
});

/** Every other `src` file's text, for the external-reference check. */
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry) && full !== ENGINE) out.push(full);
  }
  return out;
}
const otherFiles = walk(resolve(ROOT, 'src'));
const otherText = otherFiles.map((f) => ({ f, text: readFileSync(f, 'utf8') }));

const unreachable: (Fn & { lines: number })[] = [];
for (const fn of fns) {
  const outsideOwnBody = lines
    .filter((_, i) => i < fn.start || i > fn.end)
    .join('\n');
  const internal = new RegExp(`\\b${fn.name}\\b`).test(outsideOwnBody);
  const externalIn = otherText.filter(({ text }) =>
    new RegExp(`\\b${fn.name}\\b`).test(text));
  const externalProd = externalIn.filter(({ f }) => !f.includes('__tests__'));
  if (!internal && externalProd.length === 0) {
    unreachable.push({ ...fn, lines: fn.end - fn.start + 1 });
    if (externalIn.length > 0) {
      console.log(`  (tests still name ${fn.name}: `
        + `${externalIn.map((e) => e.f.split('/src/')[1]).join(', ')})`);
    }
  }
}

unreachable.sort((a, b) => b.lines - a.lines);
console.log(`\ntop-level functions: ${fns.length}`);
console.log(`UNREACHABLE (no caller in this file, none in src outside tests): ${unreachable.length}`);
let total = 0;
for (const fn of unreachable) {
  total += fn.lines;
  console.log(`  ${String(fn.lines).padStart(4)} lines  ${fn.start + 1}-${fn.end + 1}  `
    + `${fn.exported ? 'export ' : ''}${fn.name}`);
}
console.log(`\ntotal unreachable: ${total} lines`);
