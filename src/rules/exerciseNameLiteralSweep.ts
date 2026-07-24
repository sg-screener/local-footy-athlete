/**
 * exerciseNameLiteralSweep — find every exercise name hardcoded in CODE.
 *
 * THE GAP SAM CAUGHT. The vocabulary switch closed the GENERATOR's naming
 * rights: the prompt offers selectable pool membership and acceptance refuses
 * anything else. It said nothing about names written directly into code, which
 * bypass every one of those gates —
 *
 *   - `Medicine Ball Overhead Throw` lived in `buildPowerBlock` for months with
 *     no cue, no video, no pool, and no gate that could see it;
 *   - `Leg Curl`, a name Sam RETIRED, still sat in a journal fixture;
 *   - the live "Add exercise" affordance on the session screen offers six names
 *     the app cannot cue, so the athlete gets a blank card — the device run-5
 *     failure reached through a different door.
 *
 * A literal in a builder is a name the athlete can see, so it is held to the
 * same vocabulary as a generated one. This module is the extractor; the gate
 * that fails the build is `src/__tests__/hardcodedExerciseNameLockTests.ts`.
 *
 * PRECISION, NOT A KEYWORD GUESS. A string is only treated as an exercise name
 * when it sits in `name:` / `exerciseName:` inside an object that ALSO carries
 * prescription fields (sets, reps, order, equipment, duration…), or inside a
 * bare string array whose identifier ends in EXERCISES. An exercise written by
 * a builder always comes with its dose; a store key, a screen route, an icon
 * name and a session title never do. Without that rule the sweep drowns in ids
 * and muscle groups, and a list nobody can read is a list nobody rules on.
 */

import fs from 'fs';
import path from 'path';

/**
 * The curated content REGISTRIES — the only files where an exercise name is
 * supposed to live, and therefore the only files exempt from the sweep.
 *
 * `data/defaultProgram.ts` is deliberately absent despite its path: it is the
 * program BUILDER, and `buildPowerBlock` is exactly the class of site this
 * sweep exists to police.
 */
export const CURATED_REGISTRIES: ReadonlySet<string> = new Set([
  'data/exerciseCues.ts',
  'data/exerciseTags.ts',
  'data/exercisePools.ts',
  'data/exercisePoolsStrength.ts',
  'data/mobilityFlowTemplates.ts',
  'data/selectableExerciseVocabulary.ts',
]);

/** Fields that only ever accompany a prescribed exercise. */
const PRESCRIPTION_FIELD =
  /\b(?:sets|reps|repsMin|repsMax|exerciseOrder|equipmentRequired|prescriptionType|durationSecondsMin|durationSecondsMax|restSeconds|targetReps)\s*:/;

const NAME_ASSIGNMENT = /\b(?:name|exerciseName)\s*:\s*'([^']{2,60})'/g;

export interface LiteralHit {
  literal: string;
  /** Path relative to `src`. */
  file: string;
  line: number;
}

function sourceFiles(src: string): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') walk(full);
        continue;
      }
      if (/\.(ts|tsx)$/.test(entry.name)) found.push(full);
    }
  };
  walk(src);
  return found
    // Test files name retired exercises in order to ban them. They are guards,
    // not consumers, and nothing they contain reaches an athlete.
    .filter((f) => !f.includes(`${path.sep}__tests__${path.sep}`))
    .filter((f) => !CURATED_REGISTRIES.has(path.relative(src, f)));
}

/** The smallest `{...}` enclosing `index`, or null if unbalanced/absent. */
function enclosingObject(text: string, index: number): string | null {
  let depth = 0;
  let start = -1;
  for (let i = index; i >= 0; i -= 1) {
    if (text[i] === '}') depth += 1;
    else if (text[i] === '{') {
      if (depth === 0) { start = i; break; }
      depth -= 1;
    }
  }
  if (start < 0) return null;
  depth = 0;
  for (let i = start; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split('\n').length;
}

/**
 * Every string literal in an exercise-identity position, across all code
 * outside the curated registries.
 */
export function sweepExerciseNameLiterals(srcRoot: string): LiteralHit[] {
  const hits: LiteralHit[] = [];
  for (const file of sourceFiles(srcRoot)) {
    const text = fs.readFileSync(file, 'utf8');
    const rel = path.relative(srcRoot, file);

    // 1. `name:` inside an object that also prescribes a dose.
    for (const match of text.matchAll(NAME_ASSIGNMENT)) {
      const block = enclosingObject(text, match.index!);
      if (!block || !PRESCRIPTION_FIELD.test(block)) continue;
      hits.push({ literal: match[1], file: rel, line: lineOf(text, match.index!) });
    }

    // 2. Bare string arrays whose identifier names exercises. Arrays of OBJECTS
    //    are skipped — rule 1 already covers them, and slurping their ids and
    //    muscle groups would bury the real findings in noise.
    for (const match of text.matchAll(/const\s+([A-Z_]*EXERCISES)\s*(?::[^=]+)?=\s*\[([^\]]*)\]/g)) {
      if (match[2].includes('{')) continue;
      for (const literal of match[2].matchAll(/'([^']{2,60})'/g)) {
        hits.push({ literal: literal[1], file: rel, line: lineOf(text, match.index!) });
      }
    }
  }
  return hits;
}

/** Hits grouped by literal, each with its de-duplicated `file:line` sites. */
export function groupLiteralHits(hits: readonly LiteralHit[]): Map<string, string[]> {
  const byLiteral = new Map<string, string[]>();
  for (const hit of hits) {
    const where = `${hit.file}:${hit.line}`;
    const seen = byLiteral.get(hit.literal);
    if (seen) { if (!seen.includes(where)) seen.push(where); }
    else byLiteral.set(hit.literal, [where]);
  }
  return byLiteral;
}
