/**
 * buildCueText — primary/secondary cues must join as two sentences, never
 * concatenate mid-sentence.
 *
 * L10 device finding (2026-07-24): a curated cue whose primary line does not
 * end in terminal punctuation rendered as a run-on ("Chest up brace and stand
 * Drive through the floor"). The two cue fields are independent authored
 * clauses; the join owns the sentence boundary between them, not the author.
 *
 * Run: npm run test:cue-join
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { buildCueText } from '../screens/home/dayWorkoutHelpers';

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

// buildCueText looks a cue up by name; we can't inject cues directly, so these
// assert the join contract against the pure joiner it delegates to.
import { joinCueClauses } from '../screens/home/dayWorkoutHelpers';

console.log('\n[cue join] primary + secondary read as two sentences');
{
  ok(
    'a primary without terminal punctuation gets a sentence stop before the secondary',
    joinCueClauses('Chest up, brace and stand', 'Drive through the floor.') ===
      'Chest up, brace and stand. Drive through the floor.',
    `got: ${JSON.stringify(joinCueClauses('Chest up, brace and stand', 'Drive through the floor.'))}`,
  );

  ok(
    'a primary that already ends in a full stop is left intact',
    joinCueClauses('Shoulders packed, walk tall.', 'Weight shown is per hand.') ===
      'Shoulders packed, walk tall. Weight shown is per hand.',
  );

  ok(
    'a primary ending in ! or ? keeps its own terminal mark',
    joinCueClauses('Explode up!', 'Land soft.') === 'Explode up! Land soft.',
  );

  ok(
    'a dangling comma/semicolon on the primary is promoted to a full stop',
    joinCueClauses('Hips back,', 'chest proud.') === 'Hips back. chest proud.',
    `got: ${JSON.stringify(joinCueClauses('Hips back,', 'chest proud.'))}`,
  );

  ok(
    'the join never produces a double space or double stop',
    !/ {2}|\.\./.test(joinCueClauses('Brace', 'Go.')),
  );

  ok(
    'a single present clause is returned unchanged (no trailing separator)',
    joinCueClauses('Brace hard.', '') === 'Brace hard.' &&
      joinCueClauses('', 'Drive up.') === 'Drive up.',
  );
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
