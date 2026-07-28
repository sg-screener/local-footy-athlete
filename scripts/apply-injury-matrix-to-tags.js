/**
 * Phase 2 codegen: rewrite every `injury:` profile in exerciseTags.ts from the
 * AUTHORED FINAL matrix, so all 13 regions are written out explicitly.
 *
 *   node scripts/extract-injury-matrix.js       /tmp/matrix.json
 *   node scripts/derive-injury-matrix-rules.js  /tmp/matrix.json \
 *        docs/INJURY_MATRIX_RULINGS_2026-07-28.json /tmp/rules.json
 *   node scripts/apply-injury-matrix-to-tags.js  /tmp/rules.json
 *
 * This kills the defect at its root. `inj()` filled any unwritten key with
 * 'good', so an unreviewed pair and a reviewed-safe pair were identical once
 * merged. After this there is nothing to omit: every entry names every region,
 * and `injuryMatrixEqualityTests` holds the file equal to the workbook in both
 * directions, so drift in either fails the build.
 *
 * Idempotent — running it twice produces the same file.
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const TAGS = path.join(REPO_ROOT, 'src', 'data', 'exerciseTags.ts');

const data = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const REGIONS = data.REGIONS;
const finalByName = new Map(
  [...data.strength, ...data.conditioning].map((row) => [row.name, row]),
);

let source = fs.readFileSync(TAGS, 'utf8');
const mapStart = source.indexOf('export const EXERCISE_TAGS');
if (mapStart < 0) throw new Error('EXERCISE_TAGS not found');

const head = source.slice(0, mapStart);
let body = source.slice(mapStart);

let rewritten = 0;
const missing = [];

body = body.replace(
  /^( {2}'([^']+)':\s*\{[\s\S]*?)(\n {4}injury:\s*(?:SAFE|inj\(\{[\s\S]*?\}\)|\{[\s\S]*?\n {4}\}),)/gm,
  (whole, prefix, name, injuryClause) => {
    const row = finalByName.get(name);
    if (!row) { missing.push(name); return whole; }
    rewritten += 1;
    const lines = REGIONS.map((region) => {
      const value = row.final[region];
      if (!value) throw new Error(`no final rating for ${name}.${region}`);
      return `      '${region}': '${value}',`;
    });
    return `${prefix}\n    injury: {\n${lines.join('\n')}\n    },`;
  },
);

if (missing.length > 0) {
  throw new Error(`exercises in code with no ruled matrix row: ${missing.join(', ')}`);
}

source = head + body;

/* ── Retire the type and the helper ── */

source = source.replace(
  /export interface InjuryProfile \{[\s\S]*?\n\}/,
  `export interface InjuryProfile {\n${REGIONS.map((r) => `  '${r}': InjuryRating;`).join('\n')}\n}`,
);

// SAFE and inj() ARE the defect. Removing them is the point of the unit: with no
// helper there is no way to author a partial profile, so a new exercise cannot
// enter the map half-specified. Done as two narrow deletions, each asserted, so a
// silent no-op cannot leave the trap in place.
function deleteBlock(text, pattern, label, optional = false) {
  const next = text.replace(pattern, '');
  if (next === text && !optional) throw new Error(`could not remove ${label} — pattern did not match`);
  return next;
}
source = deleteBlock(source, /\n?\/\*\*[^*]*Default injury profile[\s\S]*?\*\/\nconst SAFE: InjuryProfile = \{[\s\S]*?\n\};\n/, 'the SAFE constant', true);
source = deleteBlock(source, /\n?\/\*\*[^*]*Helper to override[\s\S]*?\*\/\nfunction inj\([\s\S]*?\n\}\n/, 'the inj() helper', true);

// The Scap Pull Ups note was the precedent that started this unit: the one entry
// that wrote every key out deliberately, so a reviewed-safe rating could not be
// mistaken for an omission. That is now true of all 149, so the note's premise
// has changed and leaving it would misdescribe the file.
source = deleteBlock(
  source,
  / {2}\/\/ Sam, 2026-07-28\. All TEN injury keys[\s\S]*?blank-means-good trap\.\n/,
  'the stale Scap Pull Ups note',
  true,
);
source = source.replace(
  /( {2}'Scap Pull Ups': \{)/,
  '  // Sam, 2026-07-28. This entry was the PRECEDENT: the first to write every\n'
  + '  // injury key out deliberately, so a reviewed-and-safe rating could not be\n'
  + '  // mistaken for one nobody had looked at. Every entry now does the same, and\n'
  + '  // the helper that made omission possible is gone.\n$1',
);

fs.writeFileSync(TAGS, source);

const leftovers = [];
if (/\binj\(/.test(source)) leftovers.push('inj( still present');
if (/\bconst SAFE\b/.test(source)) leftovers.push('SAFE still present');
if (/\badductor\b|\bpubalgia\b/.test(source)) leftovers.push('old keys still present');
if (leftovers.length > 0) throw new Error(`incomplete rewrite: ${leftovers.join('; ')}`);

console.log(`rewrote ${rewritten} injury profiles, ${REGIONS.length} regions each `
  + `= ${rewritten * REGIONS.length} explicit ratings`);
console.log('SAFE and inj() removed — a partial profile is now unwritable');
