/**
 * Sam's authored cue + video pass — conformance to the changesets.
 *
 *   docs/CUE_CHANGESET_2026-07-23.md
 *   docs/VIDEO_CHANGESET_2026-07-24.md
 *
 * The changeset documents are parsed here and treated as the source of truth,
 * so "apply EXACTLY — no rewording" is machine-checked rather than trusted. If
 * Sam edits a cue in the doc, this suite fails until the library matches.
 *
 * Run: npm run test:authored-cues
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import fs from 'fs';
import path from 'path';

import { EXERCISE_CUES } from '../data/exerciseCues';
import { POOL_REGISTRY } from '../data/exercisePools';
import { STRENGTH_POOLS } from '../data/exercisePoolsStrength';
import { EXERCISE_DEMO_VIDEOS, lookupExerciseDemo } from '../services/exerciseVideoService';
import {
  EXERCISE_LOAD_MAP,
  isTrueBodyweightExercise,
  resolveExerciseName,
} from '../utils/loadEstimation';
import { CONDITIONING_META } from '../data/exerciseTags';

const repoRoot = path.resolve(__dirname, '../..');
const src = path.resolve(__dirname, '..');

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

/* ── Parse Sam's changesets ── */

const cueDoc = fs.readFileSync(
  path.join(repoRoot, 'docs/CUE_CHANGESET_2026-07-23.md'), 'utf8');
const videoDoc = fs.readFileSync(
  path.join(repoRoot, 'docs/VIDEO_CHANGESET_2026-07-24.md'), 'utf8');

/**
 * Names a LATER Sam changeset overrode, parsed from each document's own
 * "Superseded by the locked list" section.
 *
 * Two Sam sign-offs can both be true at once: the 2026-07-23 cue sheet is a
 * record of what he approved then, and the 2026-07-24 locked list is what
 * ships now. Rewriting the earlier document would falsify a record; ignoring
 * it would let this suite demand retired content. So the earlier document
 * declares its own supersessions and they are subtracted here — DERIVED from
 * the document, never a literal list in this file, for the same reason §4's
 * retired names are.
 */
function parseSuperseded(source: string): Set<string> {
  const section = source.split('## Superseded by the locked list')[1] ?? '';
  const names = new Set<string>();
  for (const line of section.split('\n')) {
    const match = line.match(/^- (.+?) — /);
    if (match) names.add(match[1].trim());
  }
  return names;
}

const supersededCues = parseSuperseded(cueDoc);
const supersededVideos = parseSuperseded(videoDoc);

/** `- **Name**: primary | secondary` from the final cue library section. */
function parseAuthoredCues(): Map<string, { primary: string; secondary: string }> {
  const section = cueDoc.split('## Final cue library')[1] ?? '';
  const cues = new Map<string, { primary: string; secondary: string }>();
  for (const line of section.split('\n')) {
    const match = line.match(/^- \*\*(.+?)\*\*:\s*(.*)$/);
    if (!match) continue;
    const [, name, body] = match;
    if (supersededCues.has(name)) continue;
    const pipe = body.lastIndexOf('|');
    const primary = (pipe >= 0 ? body.slice(0, pipe) : body).trim();
    const rawSecondary = pipe >= 0 ? body.slice(pipe + 1).trim() : '';
    cues.set(name, {
      primary,
      // "(none)" is Sam's marker for a blank secondary; render omits it.
      secondary: rawSecondary === '(none)' ? '' : rawSecondary,
    });
  }
  return cues;
}

/** `- **Name**: https://…` from the video set/replace section. */
function parseAuthoredVideos(): Map<string, string> {
  const section = videoDoc.split('## Set / replace')[1]?.split('## Still no video')[0] ?? '';
  const videos = new Map<string, string>();
  for (const line of section.split('\n')) {
    const match = line.match(/^- \*\*(.+?)\*\*:\s*(\S+)\s*$/);
    if (match && !supersededVideos.has(match[1])) videos.set(match[1], match[2]);
  }
  return videos;
}

const authoredCues = parseAuthoredCues();
const authoredVideos = parseAuthoredVideos();

/* ── Collect every pool exercise the app can actually prescribe ── */

function poolExerciseNames(): string[] {
  const names = new Set<string>();
  for (const pool of Object.values(POOL_REGISTRY)) {
    for (const entry of pool) names.add(entry.name);
  }
  for (const slot of Object.values(STRENGTH_POOLS)) {
    for (const definition of [slot.anchor, slot.accessory]) {
      for (const entry of definition.entries) names.add(entry.name);
    }
  }
  return [...names].sort();
}

/* ── Source scan helpers ── */

function allSourceFiles(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        walk(full);
        continue;
      }
      if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) found.push(full);
    }
  };
  walk(src);
  return found;
}

function main(): void {
  console.log('\n[1] The changesets parsed cleanly');
  {
    ok('cue changeset yielded a full library', authoredCues.size >= 130,
      `parsed ${authoredCues.size} cues — expected the full authored library`);
    // 36 original picks, + 5 added on 2026-07-24 when applying the changeset
    // exposed four real gaps and Sam added the new Abductor Machine, + 1 for
    // the unified Groin Squeeze = 42 supplied. The locked list then retired the
    // two machine exercises the same day, so 40 of them still ship.
    ok('video changeset yielded Sam\'s 42 picks, less the 2 it superseded',
      authoredVideos.size === 40 && supersededVideos.size === 2,
      `parsed ${authoredVideos.size} live video URLs (expected 40), `
        + `${supersededVideos.size} superseded (expected 2)`);

    ok('both supersessions are declared by the documents themselves',
      supersededCues.size === 4 && supersededVideos.size === 2,
      `cue supersessions=${supersededCues.size} (expected 4), `
        + `video supersessions=${supersededVideos.size} (expected 2)`);
  }

  console.log('\n[2] The cue library IS Sam\'s authored text');
  {
    const mismatches: string[] = [];
    const missing: string[] = [];
    for (const [name, authored] of authoredCues) {
      const shipped = EXERCISE_CUES[name];
      if (!shipped) {
        missing.push(name);
        continue;
      }
      if (shipped.primaryCue !== authored.primary) {
        mismatches.push(
          `${name} primary:\n        doc:  ${JSON.stringify(authored.primary)}\n        code: ${JSON.stringify(shipped.primaryCue)}`);
      }
      if (shipped.secondaryCue !== authored.secondary) {
        mismatches.push(
          `${name} secondary:\n        doc:  ${JSON.stringify(authored.secondary)}\n        code: ${JSON.stringify(shipped.secondaryCue)}`);
      }
    }
    ok('every authored cue is present', missing.length === 0,
      `absent from EXERCISE_CUES: ${missing.join(', ')}`);
    ok('no authored cue was reworded', mismatches.length === 0,
      mismatches.join('\n      '));
  }

  console.log('\n[3] Cue rules');
  {
    const overCap: string[] = [];
    for (const [name, cue] of Object.entries(EXERCISE_CUES)) {
      for (const [which, text] of [['primary', cue.primaryCue], ['secondary', cue.secondaryCue]] as const) {
        const words = text.trim().split(/\s+/).filter(Boolean).length;
        if (words > 18) overCap.push(`${name} ${which}: ${words} words`);
      }
    }
    ok('no cue exceeds the 18-word cap', overCap.length === 0, overCap.join('\n      '));

    const cueSource = fs.readFileSync(path.join(src, 'data/exerciseCues.ts'), 'utf8');
    ok('the file carries Sam\'s provenance header',
      /Authored by Sam, 2026-07-23\. Additions require Sam sign-off\./.test(cueSource));
    ok('the retired 12-word cap is gone from the header',
      !/12 words hard cap/.test(cueSource));
  }

  console.log('\n[4] Deletions and renames are complete across src');
  {
    // The retired names are DERIVED from the changeset's own Renames and
    // Deletions sections, not written as literals here. A future blanket rename
    // sweep across src would rewrite literals in this file and silently disarm
    // the guard; deriving them from the document cannot be disarmed that way.
    const retired = new Set<string>();
    const renameSection = cueDoc.split('## Renames')[1]?.split('##')[0] ?? '';
    for (const line of renameSection.split('\n')) {
      const match = line.match(/^- (.+?) → /);
      if (!match) continue;
      // "Tib Raise / Tibialis Raise → Tib Raises" retires both left-hand names.
      for (const name of match[1].split(' / ')) retired.add(name.trim());
    }
    const deleteSection = cueDoc.split('## Deletions')[1]?.split('##')[0] ?? '';
    for (const line of deleteSection.split('\n')) {
      const match = line.match(/^- (.+)$/);
      if (!match) continue;
      // Strip Sam's trailing rationale parenthetical, which starts lowercase or
      // with a quote — a real name's parenthetical is capitalised, e.g.
      // "Groin Squeeze (Band Adductor)".
      retired.add(match[1].replace(/\s\((?:Sam:|['a-z])[\s\S]*\)$/, '').trim());
    }
    // MetCon is a live workout type elsewhere in the app; only its cue entry
    // was retired, so it is not a banned string.
    retired.delete('MetCon');

    ok('retired names were derived from the changeset', retired.size >= 9,
      `derived only ${retired.size}: ${[...retired].join(', ')}`);

    /**
     * Names whose new form CONTAINS the old one, so a bare match would flag the
     * replacement itself. The lookahead excludes the surviving form.
     */
    const survivingForm: Record<string, string> = {
      'Copenhagen Plank': '(?! \\(Half\\))',
      'Tib Raise': '(?!s)',
      // "Assault Bike Sprints" is a coach term Sam keeps; "Air Bike Sprints" is
      // the new canonical name. Only the unqualified name is retired.
      'Bike Sprints': '',
    };
    const precedingGuard: Record<string, string> = {
      'Bike Sprints': '(?<!Assault )(?<!Air )',
    };

    const banned = [...retired].map((name) => ({
      label: name,
      pattern: new RegExp(
        (precedingGuard[name] ?? '')
        + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        + (survivingForm[name] ?? ''),
      ),
    }));

    for (const { label, pattern } of banned) {
      const offenders: string[] = [];
      for (const file of allSourceFiles()) {
        // This suite necessarily names the retired exercises in order to ban
        // them; it is the guard, not a consumer.
        if (file === __filename) continue;
        const text = fs.readFileSync(file, 'utf8');
        if (pattern.test(text)) offenders.push(path.relative(src, file));
      }
      ok(`"${label}" appears nowhere in src`, offenders.length === 0,
        offenders.join(', '));
    }
  }

  console.log('\n[5] Renamed exercises resolve under their new names');
  {
    const renamed = [
      'Air Bike Sprints',
      'Single-Arm Pulldown',
      'Tib Raises',
      'Copenhagen Plank (Half)',
    ];
    for (const name of renamed) {
      ok(`${name} has a cue`, Boolean(EXERCISE_CUES[name]));

      // Conditioning modalities are sessions, not demoed movements — they have
      // never been in the video map (nor had 'Bike Sprints' before the rename).
      if (!CONDITIONING_META[name]) {
        const demo = lookupExerciseDemo(name);
        ok(`${name} resolves a video entry`, Boolean(demo.url),
          `lookupExerciseDemo returned ${JSON.stringify(demo)}`);
      }

      // Load handling is defined two ways in this app: an entry in
      // EXERCISE_LOAD_MAP, or membership of TRUE_BODYWEIGHT_EXERCISES. The
      // rename must not drop the exercise out of BOTH.
      const resolved = resolveExerciseName(name);
      ok(`${name} keeps defined load handling`,
        Boolean(EXERCISE_LOAD_MAP[resolved]) || isTrueBodyweightExercise(name),
        `resolveExerciseName('${name}') gave '${resolved}': no load profile and not bodyweight`);
    }
  }

  console.log('\n[6] Pool coverage — every prescribable exercise is complete');
  {
    const names = poolExerciseNames();
    ok('pools are non-empty', names.length > 50, `found ${names.length} pool exercises`);

    const withoutCue = names.filter((name) => !EXERCISE_CUES[name]);
    ok('every pool exercise has an authored cue', withoutCue.length === 0,
      withoutCue.join(', '));

    // Zone-1 cyclical recovery is out of the video map by design — they are not
    // movements to demo. Documented in exerciseVideoService's header and in the
    // video changeset.
    const ZONE_1_BY_DESIGN = new Set([
      'Light Walk or Stationary Bike',
      'Incline Treadmill Walk',
      'Outdoor Walk',
      'Light Skipping',
    ]);
    const withoutVideo = names
      .filter((name) => !ZONE_1_BY_DESIGN.has(name) && !CONDITIONING_META[name])
      .filter((name) => !lookupExerciseDemo(name).url);
    ok('every demoable pool exercise resolves a working video', withoutVideo.length === 0,
      withoutVideo.join(', '));
  }

  console.log('\n[7] Pool additions Sam approved are present');
  {
    // 'Speed Bench' is deliberately absent: it classifies as `power`, so the
    // power policy strips it from strength content — pooling it silently
    // deleted the athlete's accessory. Owned by the power-pool unit.
    const additions = [
      'Goblet Squat',
      'Bottoms-Up KB Press',
      'Single-Arm DB Bench Press',
      'Single-Leg Leg Press',
      'Single-Leg Squat (to Box)',
      'Long-Lever Copenhagen',
      'Scap Push-Up',
    ];
    const names = new Set(poolExerciseNames());
    const absent = additions.filter((name) => !names.has(name));
    ok('every approved pool addition is in a pool', absent.length === 0, absent.join(', '));
  }

  console.log('\n[8] Sam\'s 36 video URLs, exactly');
  {
    const wrong: string[] = [];
    for (const [name, url] of authoredVideos) {
      const shipped = EXERCISE_DEMO_VIDEOS[name];
      if (shipped !== url) {
        wrong.push(`${name}\n        doc:  ${url}\n        code: ${String(shipped)}`);
      }
    }
    ok('every authored URL is applied verbatim', wrong.length === 0, wrong.join('\n      '));
    ok('the changeset records no remaining gaps',
      /NONE — every pool exercise has a video after this changeset\./.test(videoDoc));
  }

  console.log('\n[9] Depth Jumps / Lateral Bounds power-pool spec matches the sheet');
  {
    for (const name of ['Depth Jumps', 'Lateral Bounds']) {
      const authored = authoredCues.get(name);
      ok(`${name} is in the authored sheet`, Boolean(authored));
      if (!authored) continue;
      const shipped = EXERCISE_CUES[name];
      ok(`${name} cue matches the sheet`,
        shipped?.primaryCue === authored.primary && shipped?.secondaryCue === authored.secondary,
        `code: ${JSON.stringify(shipped)}\n      doc: ${JSON.stringify(authored)}`);
      // The power pool carries its own spec cues; they must not diverge.
      const strengthSource = fs.readFileSync(path.join(src, 'data/exercisePoolsStrength.ts'), 'utf8');
      const block = strengthSource.split(`name: '${name}'`)[1]?.slice(0, 400) ?? '';
      if (/cue/i.test(block)) {
        ok(`${name} power-pool spec cue aligns with the sheet`,
          block.includes(authored.primary),
          `power pool spec near '${name}' does not carry the authored primary cue`);
      }
    }
  }

  const total = passed + failures.length;
  console.log(`\nAuthored cue + video totals: passed=${passed}/${total} failures=${failures.length}`);
  if (failures.length > 0) {
    console.error(`Failing: ${failures.join(', ')}`);
    process.exit(1);
  }
}

main();
