/**
 * PICTURES MUST BE NEWER THAN CODE — the gate SEAT_INBOX item 12 ordered.
 *
 * ## The founding defect
 *
 * `docs/UI_STATE_2026-08-12.md:14` pinned its four surfaces to `a9c82856` — a
 * **docs-only commit landing 14h48m after the newest screenshot** — and the seat
 * then cited a stale UI location with confidence. Verified here: that commit
 * touches `docs/ATLAS_VERIFICATION_2026-08-12.md` and `docs/SEAT_INBOX.md` and
 * **nothing else**.
 *
 * A SHA that names a commit which touched no code is worse than no SHA. It reads
 * as provenance and carries none.
 *
 * ## WHAT THIS GATE CHECKS, AND WHY EACH PART IS LOAD-BEARING
 *
 * - **A pinned picture names a commit that TOUCHED UI CODE.** This is the whole
 *   defect, and it is decidable: ask git what the commit changed.
 * - **The SHA is in the FILENAME.** `artifacts/` is gitignored, so a shot does
 *   not survive a clone and its mtime means nothing. The filename is the only
 *   provenance that travels with the image.
 * - **The index may never pin to a docs commit.** The index is what an agent
 *   actually reads; a correct manifest behind a wrong index changes nothing.
 *
 * ## WHY EVERY ROW IS `STALE` AND THAT IS A PASS
 *
 * Item 12: *"Do NOT just re-shoot (Sam has more UI coming; they would restale
 * immediately)... Then shoot once, after Sam's UI work settles."* The mechanism
 * ships now; the pictures come later. An honest `STALE` row is the correct state
 * today, and the gate's job is to make a FALSE `pinned` impossible — not to
 * demand pictures nobody asked for yet.
 *
 * Run: npm run test:ui-picture-manifest
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import {
  UI_PICTURE_MANIFEST,
  UI_PICTURE_INDEX_DOC,
  pictureFileName,
  shaFromPictureFileName,
} from '../dev/uiPictureManifest';

const repoRoot = path.join(__dirname, '..', '..');

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

function run(name: string, body: () => void): void {
  try {
    body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failed += 1;
    failures.push(name);
    console.error(`  FAIL ${name}\n      ${(error as Error)?.message ?? String(error)}`);
  }
}

/**
 * Files a commit changed, or null when git cannot answer.
 *
 * NULL IS NOT AN EMPTY LIST. A shallow clone or a missing object means "we do
 * not know", and the cells below treat that as unproven rather than as "touched
 * no code" — reporting a stale pin because git was unavailable would be a
 * fabricated finding.
 */
export function filesChangedBy(sha: string): string[] | null {
  try {
    const out = execFileSync('git', ['show', '--name-only', '--format=', sha], {
      cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.split('\n').map((line) => line.trim()).filter(Boolean);
  } catch {
    return null;
  }
}

/** Pure: does this file list contain anything that changes what a screen LOOKS like? */
export function touchesUiCode(files: readonly string[]): boolean {
  return files.some((file) => /^src\/.*\.(ts|tsx)$/.test(file));
}

// ── [1] A PINNED PICTURE NAMES A COMMIT THAT TOUCHED CODE ─────────────────

run('every pinned picture shows a commit that touched UI code', () => {
  const pinned = UI_PICTURE_MANIFEST
    .filter((row) => row.picture.state === 'pinned')
    .map((row) => ({ surface: row.surface, ...(row.picture as { showsCode: string; file: string }) }));
  const faults: string[] = [];
  for (const entry of pinned) {
    const files = filesChangedBy(entry.showsCode);
    if (files === null) {
      faults.push(`${entry.surface}: git cannot resolve ${entry.showsCode}`);
      continue;
    }
    if (!touchesUiCode(files)) {
      faults.push(`${entry.surface} pins to ${entry.showsCode}, which changed `
        + `${files.join(', ') || 'nothing'} — no source file. That is the exact `
        + 'shape of a9c82856, the docs-only commit this gate exists for.');
    }
  }
  assert(faults.length === 0, faults.join(' | '));
});

// ── [2] AND THE SHA TRAVELS WITH THE IMAGE ────────────────────────────────
//
// `artifacts/` is gitignored, so a shot does not survive a clone and its mtime
// dies with it. The filename is the only provenance that moves with the file.

run('a pinned picture carries its SHA in the filename', () => {
  const wrong = UI_PICTURE_MANIFEST
    .filter((row) => row.picture.state === 'pinned')
    .map((row) => ({ surface: row.surface, ...(row.picture as { showsCode: string; file: string }) }))
    .filter((entry) => {
      const inName = shaFromPictureFileName(entry.file);
      return inName === null || !entry.showsCode.startsWith(inName);
    });
  assert(wrong.length === 0,
    `${wrong.map((entry) => `${entry.surface}: ${entry.file} does not carry `
      + `${entry.showsCode}`).join('; ')}. artifacts/ is gitignored — the `
    + 'filename is the only provenance that survives a clone.');
});

// ── [3] THE INDEX MAY NEVER PIN TO A DOCS COMMIT ──────────────────────────
//
// The index is what an agent reads. A correct manifest behind a wrong index
// changes nothing, which is how the founding defect reached the seat.

run('the picture index does not pin itself to a docs-only commit', () => {
  const full = path.join(repoRoot, UI_PICTURE_INDEX_DOC);
  assert(fs.existsSync(full),
    `${UI_PICTURE_INDEX_DOC} is gone — this cell reads nothing (anchoring law)`);
  // HEADINGS ONLY, NEVER PROSE ABOUT A HEADING. `a-comment-is-not-a-shipped-string`,
  // caught on this cell's own first green run: the index now EXPLAINS the pin it
  // removed, quoting the old wording, and a whole-file regex read that
  // explanation as the offence. A pin is a claim the document MAKES — a heading
  // — not a sentence about one, and blockquote lines are commentary by
  // construction in this file.
  const text = fs.readFileSync(full, 'utf8');
  const pins = text.split('\n')
    .filter((line) => line.trimStart().startsWith('#'))
    .flatMap((line) => Array.from(line.matchAll(/`([0-9a-f]{7,40})`/g)))
    .map((match) => match[1]);
  const faults: string[] = [];
  for (const sha of pins) {
    const files = filesChangedBy(sha);
    if (files === null) continue; // unknown, not a finding — see filesChangedBy
    if (!touchesUiCode(files)) {
      faults.push(`${UI_PICTURE_INDEX_DOC} says the surfaces stand at ${sha}, `
        + `which changed only ${files.join(', ')}. A SHA naming a commit that `
        + 'touched no code reads as provenance and carries none — this is the '
        + 'founding case, verbatim.');
    }
  }
  assert(faults.length === 0, faults.join(' | '));
});

// ── [4] EVERY ROW SAYS SOMETHING TRUE ─────────────────────────────────────

run('every row is well-formed, and a STALE row says what re-shooting takes', () => {
  assert(UI_PICTURE_MANIFEST.length > 0, 'the manifest is empty');
  const faults: string[] = [];
  for (const row of UI_PICTURE_MANIFEST) {
    if (row.showsWhat.trim().length < 20) {
      faults.push(`${row.surface}: showsWhat says nothing an agent could use`);
    }
    if (row.picture.state === 'STALE') {
      if (row.picture.wouldTake.trim().length < 20) {
        faults.push(`${row.surface}: STALE without saying what re-shooting takes`);
      }
      if (row.picture.lastKnown.trim().length < 20) {
        faults.push(`${row.surface}: STALE with no account of the last shot`);
      }
    }
  }
  assert(faults.length === 0, faults.join(' | '));
});

// ── [5] THE CHECKERS RED ON FABRICATED INPUT (liveness) ───────────────────
//
// Cells [1] and [3] are both satisfied by a `touchesUiCode` that says yes to
// everything, or a git reader that always returns null. Both are shown known
// inputs and required to answer correctly.

run('the checkers red on a fabricated docs-only pin (liveness)', () => {
  assert(touchesUiCode(['docs/A.md', 'docs/B.md']) === false,
    'a docs-only change was reported as touching UI code — cells [1] and [3] '
    + 'would then pass over exactly the defect they exist for');
  assert(touchesUiCode(['docs/A.md', 'src/screens/home/HomeScreenV2.tsx']) === true,
    'a real source change was not recognised, so every honest pin would red');
  // THE FOUNDING CASE ITSELF, run as a probe rather than quoted as a claim.
  const founding = filesChangedBy('a9c82856');
  assert(founding === null || touchesUiCode(founding) === false,
    `a9c82856 now reports as touching UI code (${founding?.join(', ')}). This `
    + "gate's own founding case is quoted in three headers; if it is wrong, "
    + 'those headers are wrong too.');
  assert(shaFromPictureFileName('day-a9c82856.png') === 'a9c82856',
    'the filename SHA reader cannot read a well-formed name');
  assert(shaFromPictureFileName('walk-1-day.png') === null,
    'a filename with no SHA was read as carrying one — every legacy shot would '
    + 'then look pinned');
  assert(pictureFileName('day', 'abc1234') === 'day-abc1234.png',
    'the filename builder and the reader disagree');
});

const stale = UI_PICTURE_MANIFEST.filter((row) => row.picture.state === 'STALE').length;
console.log(
  `\nUI PICTURE MANIFEST: ${UI_PICTURE_MANIFEST.length} surfaces, `
  + `${UI_PICTURE_MANIFEST.length - stale} pinned, ${stale} STALE (awaiting Sam's UI to settle)`,
);
console.log(`ui picture manifest totals: ${passed} passed, ${failed} failed`);
if (failures.length) console.log(`Failing: ${failures.join(', ')}`);
totalsPrinted(failed);
process.exit(failed === 0 ? 0 : 1);
