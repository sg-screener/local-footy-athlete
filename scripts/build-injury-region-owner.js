/**
 * Generate src/data/injuryRegions.ts — the SINGLE owner of body-part -> region
 * routing, replacing five divergent copies.
 *
 *   node scripts/build-injury-region-owner.js docs/INJURY_MATRIX_RULINGS_2026-07-28.json
 *
 * The five it retires:
 *   1. utils/programAdjustmentEngine.ts   BODY_PART_TO_BUCKET
 *   2. utils/injuryAdjustmentEngine.ts    BODY_PART_TO_BUCKET   (no wrist/elbow/neck)
 *   3. utils/guidedInjuryControl.ts       guidedInjuryBucketForArea (regex)
 *   4. utils/exerciseFilter.ts            INJURY_AREA_MAP
 *   5. utils/coachConstraintProducers.ts  BODY_PART_TO_BUCKET
 *
 * They disagreed with each other and with Sam's ruling — e.g. exerciseFilter sent
 * `achilles` to ankle while Sam ruled it to calf, and guidedInjuryControl sent
 * `rib` to shoulder when ribs is now its own region. Five copies is why nobody
 * could see that.
 *
 * Phrases Sam did not re-rule keep their existing target, renamed onto the 13.
 * Sam's ruled routes override. Every disagreement between the old copies is
 * reported rather than silently resolved.
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const OUT = path.join(REPO_ROOT, 'src', 'data', 'injuryRegions.ts');
const ruling = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const REGIONS = ruling.regions;

/** Old bucket key -> Sam's region. `pubalgia` merged into groin. */
const OLD_TO_NEW = {
  adductor: 'groin', pubalgia: 'groin', lowerBack: 'lowerBack', knee: 'knee',
  hamstring: 'hamstring', calf: 'calf', ankle: 'ankle/foot', shoulder: 'shoulder',
  elbow: 'elbow', wrist: 'wrist/hand',
};

/** Pull `phrase: 'bucket'` pairs out of one of the legacy object maps. */
function readMap(file, marker) {
  const text = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
  const start = text.indexOf(marker);
  if (start < 0) throw new Error(`${marker} not found in ${file}`);
  const open = text.indexOf('{', start);
  const close = text.indexOf('\n};', open);
  const block = text.slice(open, close);
  const out = {};
  for (const m of block.matchAll(/^\s*'?([a-z_ -]+)'?:\s*'([a-zA-Z]+)'/gm)) {
    out[m[1].trim()] = m[2];
  }
  return out;
}

const sources = {
  programAdjustmentEngine: readMap('src/utils/programAdjustmentEngine.ts', 'const BODY_PART_TO_BUCKET'),
  injuryAdjustmentEngine: readMap('src/utils/injuryAdjustmentEngine.ts', 'const BODY_PART_TO_BUCKET'),
  exerciseFilter: readMap('src/utils/exerciseFilter.ts', 'const INJURY_AREA_MAP'),
  coachConstraintProducers: readMap('src/utils/coachConstraintProducers.ts', 'const BODY_PART_TO_BUCKET'),
};

// Union every phrase, translated onto the 13, recording disagreements.
const merged = {};
const disagreements = [];
for (const [origin, map] of Object.entries(sources)) {
  for (const [phrase, bucket] of Object.entries(map)) {
    const region = OLD_TO_NEW[bucket];
    if (!region) continue;                       // not an injury bucket
    if (merged[phrase] && merged[phrase].region !== region) {
      disagreements.push(`"${phrase}": ${merged[phrase].region} (${merged[phrase].origin}) `
        + `vs ${region} (${origin})`);
      continue;                                  // first one wins; Sam's ruling may override
    }
    merged[phrase] = { region, origin };
  }
}

// Sam's ruled routes override anything inherited.
const ruledOverrides = [];
for (const [phraseGroup, region] of Object.entries(ruling.routing.single)) {
  if (phraseGroup === '_') continue;
  if (!REGIONS.includes(region)) throw new Error(`ruled route targets unknown region "${region}"`);
  for (const phrase of phraseGroup.split('/').map((p) => p.trim().toLowerCase())) {
    const before = merged[phrase];
    if (before && before.region !== region) {
      ruledOverrides.push(`"${phrase}": ${before.region} -> ${region} (Sam)`);
    }
    merged[phrase] = { region, origin: 'sam' };
  }
}

const phrases = Object.keys(merged).sort();
const byRegion = {};
for (const phrase of phrases) {
  (byRegion[merged[phrase].region] = byRegion[merged[phrase].region] || []).push(phrase);
}

const entries = REGIONS.filter((region) => byRegion[region]).map((region) => {
  const lines = byRegion[region]
    .map((phrase) => `  ${/^[a-z]+$/.test(phrase) ? phrase : `'${phrase}'`}: '${region}',`);
  return `  // -> ${region}\n${lines.join('\n')}`;
}).join('\n\n');

const file = `/**
 * Injury regions — THE single owner of the region vocabulary and of body-part
 * routing.
 *
 * GENERATED from docs/INJURY_MATRIX_RULINGS_2026-07-28.json by
 * scripts/build-injury-region-owner.js. Do not hand-edit: change the ruling file
 * and regenerate, so the sheet stays the source of truth.
 *
 * ── Why this file exists ──
 *
 * Five divergent copies of this mapping used to exist:
 *   utils/programAdjustmentEngine, utils/injuryAdjustmentEngine,
 *   utils/guidedInjuryControl, utils/exerciseFilter, utils/coachConstraintProducers
 *
 * They disagreed with each other and with Sam's ruling. \`exerciseFilter\` sent
 * "achilles" to the ankle while Sam ruled it to the calf; \`guidedInjuryControl\`
 * sent "rib" to the shoulder, which stopped being true the moment ribs became a
 * region; \`injuryAdjustmentEngine\` knew nothing about wrist, elbow or neck, so a
 * neck complaint could not reach the neck column at all. Five copies is precisely
 * why none of that was visible.
 *
 * Routing is SINGLE-TARGET by Sam's ruling (2026-07-28): one phrase resolves to
 * exactly one region. Duals (hip flexor -> hip+quad, achilles -> calf+ankle/foot,
 * upper back -> shoulder+neck) were considered and ruled out, so episode-identity
 * semantics — which compare regions for equality — stay simple. Revisit only if
 * athlete complaints expose a coverage gap.
 *
 * A region nobody can reach is a region that does not exist: \`pubalgia\` was
 * authored on 34 exercises and no free text ever resolved to it.
 */
import type { InjuryProfile } from './exerciseTags';

/** One of Sam's ${REGIONS.length} authored injury regions. */
export type InjuryRegion = keyof InjuryProfile;

/** Every region, in Sam's authored order. */
export const INJURY_REGIONS: readonly InjuryRegion[] = [
${REGIONS.map((r) => `  '${r}',`).join('\n')}
];

/**
 * Free-text body part -> region. Sam's ruled routes, plus the phrase coverage
 * inherited from the five retired copies.
 */
const BODY_PART_TO_REGION: Readonly<Record<string, InjuryRegion>> = {
${entries}
};

function normalise(value: string): string {
  return value.trim().toLowerCase().replace(/\\s+/g, ' ');
}

/**
 * Resolve a free-text body part to a region, or null when nothing matches.
 *
 * Returning null is deliberate and load-bearing: an unroutable complaint must be
 * visible as unrouted rather than quietly assigned somewhere plausible.
 */
export function resolveInjuryRegion(bodyPart: string): InjuryRegion | null {
  const key = normalise(bodyPart);
  const direct = BODY_PART_TO_REGION[key];
  if (direct) return direct;
  const collapsed = key.replace(/[\\s-]+/g, '');
  for (const [phrase, region] of Object.entries(BODY_PART_TO_REGION)) {
    if (phrase.replace(/[\\s-]+/g, '') === collapsed) return region;
  }
  return null;
}

/** Every phrase that routes somewhere — for gates and diagnostics. */
export function routableBodyParts(): readonly string[] {
  return Object.keys(BODY_PART_TO_REGION);
}
`;

fs.writeFileSync(OUT, file);

console.log(`wrote ${path.relative(REPO_ROOT, OUT)} — ${phrases.length} phrases -> ${REGIONS.length} regions`);
console.log(`sources merged: ${Object.keys(sources).join(', ')}`);
if (disagreements.length > 0) {
  console.log(`\nDISAGREEMENTS between the retired copies (${disagreements.length}):`);
  disagreements.forEach((d) => console.log(`  ${d}`));
}
if (ruledOverrides.length > 0) {
  console.log(`\nSAM'S RULING OVERRODE (${ruledOverrides.length}):`);
  ruledOverrides.forEach((d) => console.log(`  ${d}`));
}
