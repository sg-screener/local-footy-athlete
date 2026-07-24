/**
 * Three-way exercise content reconciliation: pool ↔ cue ↔ video.
 *
 * Every exercise the app can prescribe must be complete — a pool entry with no
 * cue, a cue nothing can prescribe, or a video alias pointing at a name that
 * does not exist are all silent content holes. This suite finds them and fails
 * on anything that is not an explicitly recorded, Sam-approved exception.
 *
 * The whitelists below are the exceptions, each with the ruling that created
 * it. An orphan with no whitelist entry fails the build — so "zero unexplained"
 * is enforced rather than asserted.
 *
 * Run: npm run test:content-reconciliation
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import fs from 'fs';
import path from 'path';

import { EXERCISE_CUES } from '../data/exerciseCues';
import { POOL_REGISTRY } from '../data/exercisePools';
import { STRENGTH_POOLS } from '../data/exercisePoolsStrength';
import { EXERCISE_DEMO_VIDEOS, lookupExerciseDemo } from '../services/exerciseVideoService';
import { EXERCISE_TAGS, CONDITIONING_META } from '../data/exerciseTags';
import {
  EXERCISE_LOAD_MAP,
  isTrueBodyweightExercise,
  resolveExerciseName,
} from '../utils/loadEstimation';

const src = path.resolve(__dirname, '..');

let passed = 0;
const failures: string[] = [];

function ok(name: string, offenders: string[], detail?: string): void {
  if (offenders.length === 0) {
    passed += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  for (const o of offenders.sort()) console.error(`         - ${o}`);
}

/* ── Recorded exceptions ── */

/**
 * Zone-1 cyclical recovery: not movements to demo. Documented in
 * exerciseVideoService's header and the video changeset.
 */
const ZONE_1_NO_VIDEO_BY_DESIGN = new Set([
  'Light Walk or Stationary Bike',
  'Incline Treadmill Walk',
  'Outdoor Walk',
  'Light Skipping',
]);

/**
 * `EXERCISE_TAGS` is the STRENGTH-movement taxonomy (movement pattern, load,
 * fatigue, DOMS, injury ratings). Mobility, breathing, stretching and tissue
 * work carry none of those properties, so they are deliberately absent.
 * Approved by Sam, 2026-07-24, as by-design rather than an orphan class.
 */
const MOBILITY_NO_TAGS_BY_DESIGN = new Set([
  '90/90 Breathing', 'Adductor Rockback', 'Box Breathing', 'Calf Stretch',
  'Cat-Cow', 'Chest / Pec Stretch (Doorway)', "Child's Pose with Breathing",
  'Couch Stretch', 'Crocodile Breathing', 'Dead Hang', 'Deep Squat Hold',
  'Foam Roll — Calves & Outer Shins', 'Foam Roll — Hip Flexor, Quad, Adductors',
  'Foam Roll — IT Band', 'Foam Roll — Lats', 'Foam Roll — T-Spine',
  'Hip 90/90 Stretch', 'Lacrosse Ball Glute Release', 'Lat Stretch',
  'Open Book Thoracic Rotation', 'Pigeon Stretch', 'Toe Stretch',
  "World's Greatest Stretch",
]);

/** Exercises that ship (cue + video + tags) but are deliberately unpooled. */
const UNPOOLED_BY_RULING: Record<string, string> = {
  'Abductor Machine':
    'Sam 2026-07-24: "never a swap candidate for groin/adductor work" cannot be '
    + 'expressed until the muscle-block mechanism lands (PROGRAMMING_DESIGN_SESSION '
    + 'D3/D11, first item of the Phase 4.3 pass). Joins a pool then.',
  'Single-Arm DB Floor Press':
    'Sam 2026-07-24: the Bible\'s pressing injury-swap. Reached by injury '
    + 'substitution, not by pool rotation.',
  'Speed Bench':
    'Classifies as `power`; the power policy strips power rows from strength '
    + 'content (workoutCanonicalisation.ts:572), so pooling it silently deleted '
    + 'the athlete\'s accessory. Placement owned by the power-pool unit.',
  'Kneeling Jump':
    'Power exercise — owned by docs/POWER_EXERCISE_POOL_SPEC_2026-07-23.md, '
    + 'where its cue lives. Pool placement lands with that unit.',
  'Lateral Jump':
    'Power exercise — owned by docs/POWER_EXERCISE_POOL_SPEC_2026-07-23.md, '
    + 'where its cue lives. Pool placement lands with that unit.',
  'Explosive Push-Ups':
    'Survivor of the 2026-07-23 cue changeset\'s explosive-pushup deletion. '
    + 'Present in the video map as null so the "explosive push up" aliases '
    + 'resolve rather than dangle; no demo pinned yet.',
};

/**
 * Cues that ship for a fallback default-program exercise that is deliberately
 * NOT pooled or demoed. The athlete meets these only in the hardcoded default
 * program (defaultProgram.ts), never via pool rotation, so they carry a curated
 * cue but no pool slot and no video. A recorded Sam ruling, not an orphan.
 */
const CUE_ONLY_BY_RULING: Record<string, string> = {
  'Hamstring Curl':
    'Sam 2026-07-24 (L10 run 3): a curated cue for the default-program hamstring '
    + 'curl fallback. The pooled + demoed curl is "Swiss Ball Hamstring Curl"; this '
    + 'bare machine-curl name renders only in the hardcoded default program, so it '
    + 'ships a cue but no pool slot or video.',
};

/**
 * Pool entries awaiting a load-handling ruling from Sam.
 *
 * EMPTY as of 2026-07-24 — Sam ruled on all nine (carries re-anchored to bench
 * and stored per hand, Neutral-Grip Pulldown mirroring Lat Pulldown, the two
 * zone-1 walks moved to TRUE_BODYWEIGHT_EXERCISES, the rest as proposed). It
 * stays here deliberately: the `[1]` assertion below now demands EVERY pool
 * entry have defined load handling, and `[5]` fails if anything is ever added
 * back without a ruling. Emptiness is the proof, not a comment.
 */
const LOAD_HANDLING_PENDING_SAM = new Set<string>([]);

/* ── Inputs ── */

function poolNames(): string[] {
  const names = new Set<string>();
  for (const pool of Object.values(POOL_REGISTRY)) {
    for (const entry of pool) names.add(entry.name);
  }
  for (const slot of Object.values(STRENGTH_POOLS)) {
    for (const definition of [slot.anchor, slot.accessory]) {
      for (const entry of definition.entries) names.add(entry.name);
    }
  }
  return [...names];
}

const pool = new Set(poolNames());
const cues = new Set(Object.keys(EXERCISE_CUES));
const videos = new Set(Object.keys(EXERCISE_DEMO_VIDEOS));
const conditioning = new Set(Object.keys(CONDITIONING_META));

console.log('\n[1] Pool → cue / video / load / tags');
{
  ok('every pool entry has an authored cue',
    [...pool].filter((n) => !cues.has(n)));

  ok('every demoable pool entry resolves a video',
    [...pool].filter((n) =>
      !ZONE_1_NO_VIDEO_BY_DESIGN.has(n) && !conditioning.has(n) && !lookupExerciseDemo(n).url));

  ok('EVERY pool entry has defined load handling — zero pending',
    [...pool].filter((n) =>
      !EXERCISE_LOAD_MAP[resolveExerciseName(n)]
      && !isTrueBodyweightExercise(n)
      && !LOAD_HANDLING_PENDING_SAM.has(n)));

  ok('every strength/prehab pool entry is tagged (mobility exempt by design)',
    [...pool].filter((n) =>
      !EXERCISE_TAGS[n]
      && !MOBILITY_NO_TAGS_BY_DESIGN.has(n)
      && !ZONE_1_NO_VIDEO_BY_DESIGN.has(n)
      && !conditioning.has(n)));
}

console.log('\n[2] Cue → something that can prescribe it');
{
  ok('no cue is fully orphaned (no pool, no conditioning, no video)',
    [...cues].filter((n) =>
      !pool.has(n) && !conditioning.has(n) && !videos.has(n) && !(n in CUE_ONLY_BY_RULING)));

  ok('every cue is prescribable, or unpooled by a recorded ruling',
    [...cues].filter((n) =>
      !pool.has(n) && !conditioning.has(n)
      && !(n in UNPOOLED_BY_RULING) && !(n in CUE_ONLY_BY_RULING)));
}

console.log('\n[3] Video → something that uses it');
{
  ok('every video entry has a cue, or is unpooled by a recorded ruling',
    [...videos].filter((n) => !cues.has(n) && !(n in UNPOOLED_BY_RULING)));

  ok('every video entry is prescribable, or unpooled by a recorded ruling',
    [...videos].filter((n) =>
      !pool.has(n) && !conditioning.has(n) && !(n in UNPOOLED_BY_RULING)));
}

console.log('\n[4] Alias integrity — no dangling pointers');
{
  const videoSource = fs.readFileSync(path.join(src, 'services/exerciseVideoService.ts'), 'utf8');
  const aliasBlock = videoSource.split('EXERCISE_NAME_ALIASES')[1] ?? '';
  const dangling: string[] = [];
  for (const match of aliasBlock.matchAll(/^\s*'([^']+)':\s*'([^']+)',/gm)) {
    if (!videos.has(match[2])) dangling.push(`${match[1]} → ${match[2]}`);
  }
  ok('every video alias points at a name in the video map', dangling);

  const loadSource = fs.readFileSync(path.join(src, 'utils/loadEstimation.ts'), 'utf8');
  const loadAliases = loadSource.split('EXERCISE_NAME_ALIASES')[1] ?? loadSource;
  const badLoad: string[] = [];
  for (const match of loadAliases.matchAll(/^\s*'([a-z0-9 \-()\/.']+)':\s*'([A-Z][^']*)',/gm)) {
    const target = match[2];
    if (!EXERCISE_LOAD_MAP[target] && !isTrueBodyweightExercise(target) && !cues.has(target)) {
      badLoad.push(`${match[1]} → ${target}`);
    }
  }
  ok('every load alias points at a known exercise', badLoad);
}

console.log('\n[5] The whitelists themselves stay honest');
{
  // A whitelist entry that no longer describes reality is rot — it would hide a
  // future orphan. Every recorded exception must still BE an exception.
  ok('no UNPOOLED_BY_RULING entry has quietly been pooled',
    Object.keys(UNPOOLED_BY_RULING).filter((n) => pool.has(n)),
    'these are now pooled — remove them from the whitelist');

  ok('no MOBILITY_NO_TAGS_BY_DESIGN entry has quietly gained tags',
    [...MOBILITY_NO_TAGS_BY_DESIGN].filter((n) => EXERCISE_TAGS[n]),
    'these are now tagged — remove them from the whitelist');

  ok('no CUE_ONLY_BY_RULING entry has quietly been pooled or demoed',
    Object.keys(CUE_ONLY_BY_RULING).filter((n) => pool.has(n) || videos.has(n)),
    'these now ship a pool slot or video — remove them from the whitelist');

  ok('the load-handling pending list is empty',
    [...LOAD_HANDLING_PENDING_SAM],
    'every entry now carries a Sam ruling; nothing may be parked here silently');
}

const total = passed + failures.length;
console.log(`\nContent reconciliation: passed=${passed}/${total} failures=${failures.length}`);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
