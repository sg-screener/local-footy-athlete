/**
 * Generate src/data/injuryRegions.ts — the SINGLE owner of body-part -> region
 * routing, replacing five divergent copies.
 *
 *   node scripts/build-injury-region-owner.js docs/INJURY_MATRIX_RULINGS_2026-07-28.json
 *
 * The five it retired:
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
 * INHERITANCE IS FROZEN (LR-27 convergence, 2026-08-03). This script used to
 * read the live copies out of the tree to merge their phrase coverage; the
 * copies are retired, so the coverage they contributed is a SNAPSHOT below —
 * taken from the owner as generated on the day the copies converged onto it.
 * Sam's ruled routes in the ruling file override anything inherited, so the
 * sheet stays the source of truth and every override is reported.
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const OUT = path.join(REPO_ROOT, 'src', 'data', 'injuryRegions.ts');
const ruling = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const REGIONS = ruling.regions;

/**
 * Phrase coverage inherited from the five retired copies, frozen at their
 * retirement. Already renamed onto Sam's 13 regions (the old bucket -> region
 * translation happened when this snapshot was cut). Where a phrase here
 * disagrees with a ruled route, the RULING wins and the override is printed.
 */
const INHERITED_PHRASE_TO_REGION = {
  adductor: 'groin',
  adductors: 'groin',
  groin: 'groin',
  'osteitis pubis': 'groin',
  pubalgia: 'groin',
  'sports hernia': 'groin',
  glute: 'hip',
  glutes: 'hip',
  hip: 'hip',
  'hip flexor': 'hip',
  hips: 'hip',
  quad: 'quad',
  quadriceps: 'quad',
  quads: 'quad',
  hamie: 'hamstring',
  hammie: 'hamstring',
  hammies: 'hamstring',
  hammstring: 'hamstring',
  hammy: 'hamstring',
  hamstring: 'hamstring',
  hamstrings: 'hamstring',
  hamstrng: 'hamstring',
  hamy: 'hamstring',
  knee: 'knee',
  knees: 'knee',
  // The copies' knee proxy for the singular; Sam ruled it a sheet typo on
  // 2026-08-02 — the ruling file routes `quadricep` to quad and overrides this.
  quadricep: 'knee',
  achilles: 'calf',
  calf: 'calf',
  calves: 'calf',
  ankle: 'ankle/foot',
  ankles: 'ankle/foot',
  feet: 'ankle/foot',
  foot: 'ankle/foot',
  rib: 'ribs',
  ribs: 'ribs',
  back: 'lowerBack',
  'lower back': 'lowerBack',
  'lower-back': 'lowerBack',
  'lower_back': 'lowerBack',
  lowerback: 'lowerBack',
  neck: 'neck',
  chest: 'shoulder',
  pec: 'shoulder',
  pecs: 'shoulder',
  shoulder: 'shoulder',
  shoulders: 'shoulder',
  'upper back': 'shoulder',
  bicep: 'elbow',
  biceps: 'elbow',
  elbow: 'elbow',
  elbows: 'elbow',
  forearm: 'elbow',
  forearms: 'elbow',
  tricep: 'elbow',
  triceps: 'elbow',
  fingers: 'wrist/hand',
  hand: 'wrist/hand',
  hands: 'wrist/hand',
  thumb: 'wrist/hand',
  wrist: 'wrist/hand',
  wrists: 'wrist/hand',
};

const merged = {};
for (const [phrase, region] of Object.entries(INHERITED_PHRASE_TO_REGION)) {
  if (!REGIONS.includes(region)) throw new Error(`inherited phrase "${phrase}" targets unknown region "${region}"`);
  merged[phrase] = { region, origin: 'inherited' };
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
console.log('inheritance: frozen snapshot (the five copies are retired)');
if (ruledOverrides.length > 0) {
  console.log(`\nSAM'S RULING OVERRODE (${ruledOverrides.length}):`);
  ruledOverrides.forEach((d) => console.log(`  ${d}`));
}
