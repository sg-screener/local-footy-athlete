/**
 * ExerciseVideoModal — the demo player must fill its frame (no in-frame
 * letterbox).
 *
 * L10 device finding (2026-07-24): the demo video did not fill its modal frame —
 * black side bars. Root cause is a layout conflict in `playerFrame`: an explicit
 * `width: '100%'` alongside `aspectRatio: 9/16` AND `maxHeight`. When `maxHeight`
 * binds on a shorter phone, the explicit width wins and the box stops being 9:16
 * (400×560, ratio 0.71), so the 9:16 Short letterboxes inside it. A true
 * aspect-locked box (one definite dimension + aspectRatio, no fighting width)
 * keeps the WebView box equal to the video, so it fills edge to edge.
 *
 * The repository ships no native renderer, so this is a source contract in the
 * same style as keyboardConventionContractTests.
 *
 * Run: npm run test:video-modal-fill
 */

import fs from 'fs';
import path from 'path';

const src = path.resolve(__dirname, '..');
const modal = fs.readFileSync(path.join(src, 'components/ExerciseVideoModal.tsx'), 'utf8');

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

// Isolate the playerFrame style block.
const frameMatch = modal.match(/playerFrame:\s*\{([\s\S]*?)\}/);
const frame = frameMatch ? frameMatch[1] : '';

console.log('\n[video modal] the player frame is a true aspect-locked box');
{
  ok('playerFrame style block exists', frame.length > 0);
  ok(
    'playerFrame keeps a 9:16 aspect ratio',
    /aspectRatio:\s*9\s*\/\s*16/.test(frame),
  );
  ok(
    'playerFrame does not pin an explicit width against the aspect ratio',
    !/width:\s*['"]100%['"]/.test(frame),
    'an explicit 100% width fights aspectRatio+maxHeight and produces the letterbox',
  );
  ok(
    'playerFrame does not use maxHeight to clamp the aspect box',
    !/maxHeight:/.test(frame),
    'maxHeight + explicit width is exactly what distorts the box off 9:16',
  );
  ok(
    'playerFrame drives its size from a definite dimension + aspectRatio',
    /(?:^|\s)height:\s*\d/.test(frame),
    'a definite height lets aspectRatio compute the matching width, so no letterbox',
  );
  ok(
    'playerFrame centres itself rather than stretching',
    /alignSelf:\s*['"]center['"]/.test(frame),
  );
  ok(
    'the WebView still fills the frame',
    /webview:\s*\{[\s\S]*?flex:\s*1/.test(modal),
  );
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
