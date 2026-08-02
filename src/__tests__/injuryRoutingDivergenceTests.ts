/**
 * LR-27 — the injury body-part routing DIVERGENCE GATE.
 *
 * `data/injuryRegions.ts` is THE owner of body-part routing (generated from
 * Sam's ruling sheet), and its own header records why it exists: five
 * divergent copies of this mapping, and "five copies is precisely why none of
 * that was visible." Three copies are still live in the tree, and this gate's
 * founding measurement (2026-08-01, scripts differential) proved none of them
 * is reproducible from the owner by composition — the divergences are
 * ROUTING POLICY (which profile protects a glute strain?) and belong to Sam.
 *
 * So this gate does what the census ratchet does: it makes the disagreement
 * VISIBLE AND EQUALITY-PINNED instead of silently drifting.
 *
 *   direction 1 — each copy's map is source-pinned: a phrase added to or
 *     removed from any copy reds here, so routing vocabulary cannot drift
 *     silently again;
 *   direction 2 — the divergence set per door against the owner is pinned
 *     with EQUALITY (per-door, never a total): a new divergence fails, and a
 *     divergence that disappears fails too — paying debt down tightens the
 *     pin in the same commit;
 *   direction 3 — the owner's own routable set is pinned, so the generated
 *     file regenerating differently is a visible event.
 *
 * The ruling table these divergences need is parked for Sam
 * (docs/PARKED_QUESTIONS_2026-08-01.md §5). When he rules a row, the copy
 * converges to the owner and the pin here DROPS in the same commit.
 *
 * Run: npm run test:injury-routing-divergence
 */

process.env.TZ = 'Australia/Melbourne';

import * as fs from 'fs';
import * as path from 'path';
import {
  resolveInjuryRegion,
  routableBodyParts,
  type InjuryRegion,
} from '../data/injuryRegions';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function run(name: string, body: () => void): void {
  try {
    body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failed += 1;
    failures.push(name);
    console.error(`  FAIL ${name}\n      ${error instanceof Error ? error.message : error}`);
  }
}

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

const SRC = path.join(__dirname, '..');

function read(file: string): string {
  return fs.readFileSync(path.join(SRC, file), 'utf8');
}

/** Extract a `Record<string, InjuryBucket>`-shaped literal from source. */
function extractStringMap(source: string, mapName: string): Record<string, string> {
  const match = source.match(new RegExp(`const ${mapName}[^=]*= \\{([\\s\\S]*?)\\n\\};`));
  if (!match) throw new Error(`${mapName} literal not found — the source pin needs re-anchoring`);
  const entries: Record<string, string> = {};
  for (const entry of match[1].matchAll(/^\s*'?([\w/ _-]+)'?:\s*'([\w/ _-]+)'\s*,/gm)) {
    entries[entry[1]] = entry[2];
  }
  return entries;
}

/** Extract sessionBuilder's `Record<string, InjuryTag[]>` literal. */
function extractTagMap(source: string): Record<string, string[]> {
  const match = source.match(/const INJURY_BODY_AREA_MAP[^=]*= \{([\s\S]*?)\n\};/);
  if (!match) throw new Error('INJURY_BODY_AREA_MAP literal not found');
  const entries: Record<string, string[]> = {};
  for (const entry of match[1].matchAll(/'([^']+)':\s*\[([^\]]*)\]/g)) {
    entries[entry[1]] = entry[2].split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean);
  }
  return entries;
}

/** The comparability rename: region -> the tag vocabulary's word for it. */
const REGION_TO_TAG: Readonly<Record<InjuryRegion, string | null>> = {
  groin: 'groin', hip: 'hip', quad: 'quad', hamstring: 'hamstring', knee: 'knee',
  calf: 'calf', 'ankle/foot': 'ankle', ribs: null, lowerBack: 'lower_back',
  neck: 'neck', shoulder: 'shoulder', elbow: 'elbow', 'wrist/hand': 'wrist',
};

interface DoorDivergence {
  phrase: string;
  door: string;
  copyAnswer: string;
  ownerRegion: string;
}

function bucketDivergences(door: string, map: Record<string, string>): DoorDivergence[] {
  const out: DoorDivergence[] = [];
  for (const [phrase, bucket] of Object.entries(map)) {
    const region = resolveInjuryRegion(phrase);
    if (region === null) {
      out.push({ phrase, door, copyAnswer: bucket, ownerRegion: 'UNROUTABLE' });
    } else if (bucket !== region) {
      out.push({ phrase, door, copyAnswer: bucket, ownerRegion: region });
    }
  }
  return out.sort((a, b) => a.phrase.localeCompare(b.phrase));
}

function tagDivergences(map: Record<string, string[]>): DoorDivergence[] {
  const out: DoorDivergence[] = [];
  for (const [phrase, tags] of Object.entries(map)) {
    const region = resolveInjuryRegion(phrase);
    const expected = region === null ? null : REGION_TO_TAG[region];
    const actual = [...tags].sort().join('+');
    if (region === null) {
      out.push({ phrase, door: 'sessionBuilderTags', copyAnswer: actual, ownerRegion: 'UNROUTABLE' });
    } else if (expected === null || actual !== expected) {
      out.push({ phrase, door: 'sessionBuilderTags', copyAnswer: actual, ownerRegion: region });
    }
  }
  return out.sort((a, b) => a.phrase.localeCompare(b.phrase));
}

const paeMap = extractStringMap(read('utils/programAdjustmentEngine.ts'), 'BODY_PART_TO_BUCKET');
const iaeMap = extractStringMap(read('utils/injuryAdjustmentEngine.ts'), 'BODY_PART_TO_BUCKET');
const ccpMap = extractStringMap(read('utils/coachConstraintProducers.ts'), 'BODY_PART_TO_BUCKET');
const tagMap = extractTagMap(read('utils/sessionBuilder.ts'));

// ── Direction 3: the owner's routable set, pinned. ──
run('the owner routes exactly the ruled phrase set', () => {
  // 61 -> 63 on 2026-08-03: Sam's LR-27 ruling (2026-08-02, parked §5) added
  // shin/shins -> calf to the sheet and the owner regenerated.
  assert(routableBodyParts().length === 63,
    `the owner routes ${routableBodyParts().length} phrases, pin says 63 — the `
    + 'generated file changed; re-pin deliberately with the ruling that changed it');
});

// ── Direction 1: each copy's vocabulary, pinned by size. ──
run('the four copies hold exactly their pinned vocabularies', () => {
  const sizes = {
    programAdjustmentEngine: Object.keys(paeMap).length,
    injuryAdjustmentEngine: Object.keys(iaeMap).length,
    coachConstraintProducers: Object.keys(ccpMap).length,
    sessionBuilderTags: Object.keys(tagMap).length,
  };
  const pinned = {
    programAdjustmentEngine: 49,
    injuryAdjustmentEngine: 41,
    coachConstraintProducers: 42,
    sessionBuilderTags: 29,
  };
  assert(JSON.stringify(sizes) === JSON.stringify(pinned),
    `copy vocabularies moved: ${JSON.stringify(sizes)} vs pinned ${JSON.stringify(pinned)} `
    + '— a phrase added to a copy belongs in the OWNER (LR-27); a phrase removed '
    + 'is convergence and drops this pin in the same commit');
});

// ── Direction 2: the divergence sets, pinned with equality per door. ──
// Founding measurement 2026-08-01: the three bucket doors carry an IDENTICAL
// 11-row divergence table (the same proxies, drifted in lockstep — glute and
// hip both resolve to region `hip` yet land in DIFFERENT buckets); the tag
// door carries 3 (multi-tag achilles; shin/shins routable nowhere else).
// The `ankle/foot` / `wrist/hand` rows are bucket-identity keys the owner
// reads as free text — part of the visible table on purpose.
// 11 -> 12 per bucket door on 2026-08-03: Sam's LR-27 ruling corrected the
// owner's `quadricep` (singular) knee route to quad — a sheet typo — so the
// copies' knee proxy for it became VISIBLE divergence. It converges with the
// rest of each copy and this pin drops in that same commit.
const DIVERGENCE_PINS: Readonly<Record<string, number>> = {
  programAdjustmentEngine: 12,
  injuryAdjustmentEngine: 12,
  coachConstraintProducers: 12,
  sessionBuilderTags: 3,
};

const allDivergences = [
  ...bucketDivergences('programAdjustmentEngine', paeMap),
  ...bucketDivergences('injuryAdjustmentEngine', iaeMap),
  ...bucketDivergences('coachConstraintProducers', ccpMap),
  ...tagDivergences(tagMap),
];

for (const [door, pinnedCount] of Object.entries(DIVERGENCE_PINS)) {
  run(`${door} diverges from the owner in exactly ${pinnedCount} phrases`, () => {
    const divergences = allDivergences.filter((entry) => entry.door === door);
    assert(divergences.length === pinnedCount,
      `${door}: ${divergences.length} divergences vs pinned ${pinnedCount} —\n`
      + divergences.map((entry) =>
        `      ${entry.phrase}: copy says "${entry.copyAnswer}", owner region "${entry.ownerRegion}"`,
      ).join('\n')
      + '\n      A NEW divergence goes to the owner or to Sam (parked §5); a paid one '
      + 'drops this pin in the same commit.');
  });
}

console.log(`\nInjury routing divergence totals: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
