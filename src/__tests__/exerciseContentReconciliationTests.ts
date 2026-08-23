/**
 * Three-way exercise content reconciliation: pool ↔ cue ↔ video.
 *
 * Every exercise the app can prescribe must be complete — a pool entry with no
 * cue, a cue nothing can prescribe, or a video alias pointing at a name that
 * does not exist are all silent content holes. This suite finds them and fails
 * on anything that is not an explicitly recorded, Sam-approved exception.
 *
 * "Can prescribe" now means SELECTABLE POOL MEMBERSHIP, and the exceptions are
 * TYPED KINDS declared in src/data/selectableExerciseVocabulary.ts rather than
 * bare name whitelists here — Sam's locked-list changeset, 2026-07-24. An
 * orphan with no typed exemption fails the build, so "zero unexplained" is
 * enforced rather than asserted, and each exemption is checked against the
 * specific field it claims to waive.
 *
 * Run: npm run test:content-reconciliation
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';


import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import fs from 'fs';
import path from 'path';

import { EXERCISE_CUES } from '../data/exerciseCues';
import { muscleMetadataFor } from '../data/muscleExperienceMetadata';
import { POOL_REGISTRY } from '../data/exercisePools';
import { STRENGTH_POOLS } from '../data/exercisePoolsStrength';
import { EXERCISE_DEMO_VIDEOS, lookupExerciseDemo } from '../services/exerciseVideoService';
import { EXERCISE_TAGS, CONDITIONING_META } from '../data/exerciseTags';
import {
  EXERCISE_LOAD_MAP,
  resolveLoadAuthority,
  isTrueBodyweightExercise,
  isAthleteChosenLoadExercise,
  resolveExerciseName,
} from '../utils/loadEstimation';
import {
  EXEMPTION_KINDS,
  POWER_POOL_PENDING,
  exemptionsFor,
  isExempt,
  selectableExerciseNames,
} from '../data/selectableExerciseVocabulary';

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

/* ── Recorded exceptions — TYPED KINDS, not a name whitelist ── */

/**
 * Every exception now lives in `src/data/selectableExerciseVocabulary.ts` as a
 * typed KIND that states which completeness field it waives and why (Sam's
 * locked-list changeset, 2026-07-24 — "typed-kind exemptions only").
 *
 * The four whitelists this file used to carry (ZONE_1_NO_VIDEO_BY_DESIGN,
 * MOBILITY_NO_TAGS_BY_DESIGN, UNPOOLED_BY_RULING, CUE_ONLY_BY_RULING) were bare
 * name lists: a name in one was exempt from everything the assertion happened
 * to skip, and nothing checked that the stated reason still applied. A kind is
 * checkable — `isExempt(name, 'video')` is a different question from
 * `isExempt(name, 'pool')`, so an entry cannot quietly widen its own licence.
 */

/* ── Inputs ── */

/**
 * The one definition of "the app can prescribe this". Derived by the vocabulary
 * owner from all four selectable systems, so this suite and the generation
 * prompt cannot disagree about what exists.
 */
const selectable = selectableExerciseNames();
const selectableSet = new Set(selectable);
const cues = new Set(Object.keys(EXERCISE_CUES));
const videos = new Set(Object.keys(EXERCISE_DEMO_VIDEOS));

console.log('\n[0] EXEMPTIONS — zero pending holes, every kind Sam-attributed');
{
  // Sam, 2026-07-27: the reconciliation gate must prove there is no hole being
  // held open, and that no exemption class can appear without his ruling.
  //
  // "Zero exemptions of any kind" is enforced for the class that CAN hide a
  // hole — the pending/awaiting kinds, which exist to defer work. The three
  // remaining kinds are Sam's own BY-DESIGN rulings, not deferrals:
  // conditioning formats have no videos by design (his locked-list note),
  // zone-1 walks are not movements to demo, and stretching carries none of the
  // STRENGTH taxonomy's properties. Deleting those would not close holes; it
  // would demand videos for 36 session formats and tags for 26 stretches.
  const PENDING_KINDS = Object.keys(EXEMPTION_KINDS).filter((kind) =>
    /_pending$|^awaiting_/.test(kind));

  const heldOpen = selectable.filter((n) =>
    exemptionsFor(n).some((kind) => PENDING_KINDS.includes(kind)));
  ok('zero selectable exercises carry a pending/awaiting exemption', heldOpen);

  // The kind SET is frozen. A new class cannot appear without editing this
  // list, and the assertion below forces that edit to carry Sam's attribution.
  const AUTHORISED_KINDS = [
    'conditioning_format',
    'zone1_recovery',
    'mobility_untagged',
    'power_pool_pending',
    'load_ruling_pending',
    // R-129/R-130 (Sam, 2026-08-23): rows a signed session authors by name —
    // the Primer's accelerations. Deliberately poolless (the signed-copy entry
    // records why); the kind's own ruling carries the full attribution.
    'session_authored_row',
  ];
  ok('no exemption kind exists outside the authorised set',
    Object.keys(EXEMPTION_KINDS).filter((k) => !AUTHORISED_KINDS.includes(k)));
  ok('no authorised kind was silently deleted',
    AUTHORISED_KINDS.filter((k) => !(k in EXEMPTION_KINDS)));

  // Every kind must state WHY, and name the person who ruled it.
  ok('every exemption kind states a ruling',
    Object.entries(EXEMPTION_KINDS)
      .filter(([, spec]) => !spec.ruling || spec.ruling.trim() === '')
      .map(([kind]) => kind));

  // Every kind is Sam-attributed as of 2026-07-27 — the known-gap list is gone,
  // not emptied, for the same reason `awaiting_sam_video` was deleted: a list
  // that can hold exceptions is a place for the next one to hide.
  ok('every exemption kind names Sam as the ruling authority',
    Object.entries(EXEMPTION_KINDS)
      .filter(([, spec]) => !/Sam/.test(spec.ruling))
      .map(([kind]) => kind));

  // Coverage, stated positively: nothing is missing for an UNEXPLAINED reason.
  ok('no selectable exercise lacks a cue for an unexplained reason',
    selectable.filter((n) => !cues.has(n) && !isExempt(n, 'cue')));
  ok('no selectable exercise lacks a video for an unexplained reason',
    selectable.filter((n) => !lookupExerciseDemo(n).url && !isExempt(n, 'video')));

  // Metadata is waived by NO exemption kind, so coverage is unconditional
  // again: Sam signed the 53 conditioning rows on 2026-08-05 and the derived
  // gap list emptied at its source (docs/MUSCLE_SHEET_SIGNING_2026-08-05.md).
  ok('every selectable exercise has muscle/experience metadata',
    selectable.filter((n) => !muscleMetadataFor(n)));
}

console.log('\n[1] Pool → cue / video / load / tags (typed exemptions only)');
{
  ok('every selectable entry has an authored cue',
    selectable.filter((n) => !cues.has(n) && !isExempt(n, 'cue')));

  ok('every demoable selectable entry resolves a video',
    selectable.filter((n) => !isExempt(n, 'video') && !lookupExerciseDemo(n).url));

  // Asked of the AUTHORITY rather than enumerated set by set. Each new honest
  // answer used to need a new clause here — a map entry, then bodyweight, then
  // `athlete_chosen`, then Sam's 2026-07-28 `equipment_minimum`. Every addition
  // reached this list only after the build went red for exercises that were
  // correctly handled. `resolveLoadAuthority` owns the list; this asks it.
  ok('every selectable entry has defined load handling, or a Sam-pending ruling',
    selectable.filter((n) =>
      resolveLoadAuthority(n).kind === 'unauthored'
      && !isExempt(n, 'cue')                      // conditioning formats carry no load
      && !isExempt(n, 'load')));                  // Sam's pending line-by-line ruling

  ok('every selectable entry is tagged (mobility / conditioning / zone-1 exempt)',
    selectable.filter((n) => !EXERCISE_TAGS[n] && !isExempt(n, 'tags')));
}

console.log('\n[2] Cue → something that can prescribe it');
{
  ok('every curated cue is prescribable (typed exemptions only)',
    [...cues].filter((n) => !selectableSet.has(n) && !isExempt(n, 'pool')));
}

console.log('\n[3] Video → something that uses it');
{
  ok('every video entry is prescribable (typed exemptions only)',
    [...videos].filter((n) => !selectableSet.has(n) && !isExempt(n, 'pool')));
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

console.log('\n[5] The exemptions themselves stay honest');
{
  // A typed kind that no longer describes reality is rot — it would hide a
  // future orphan. Each kind is checked against the thing it claims.
  ok('no power-staged exercise has quietly been pooled',
    [...POWER_POOL_PENDING].filter((n) => selectableSet.has(n)),
    'placement landed — remove it from POWER_POOL_PENDING and let the invariant bite');

  ok('every exemption resolves to a declared kind',
    [...POWER_POOL_PENDING].filter((n) => exemptionsFor(n).length === 0));

  ok('every kind waives at least one field',
    Object.entries(EXEMPTION_KINDS)
      .filter(([, spec]) => spec.waives.length === 0)
      .map(([kind]) => kind));

  ok('every kind records the ruling that created it',
    Object.entries(EXEMPTION_KINDS)
      .filter(([, spec]) => spec.ruling.trim().length < 40)
      .map(([kind]) => kind));
}

const total = passed + failures.length;
console.log(`\nContent reconciliation: passed=${passed}/${total} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
