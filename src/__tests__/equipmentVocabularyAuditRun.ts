/** One-shot audit printer for the equipment vocabulary derivation. */
import { deriveEquipmentVocabulary } from '../rules/equipmentVocabulary';
import { FULL_GYM_EQUIPMENT } from '../utils/equipmentAvailability';

const vocabulary = deriveEquipmentVocabulary();

console.log('=== REQUIRED TAGS (tag: site count, sample sites) ===');
for (const { tag, sites } of vocabulary.requiredTags) {
  const bySource = new Map<string, number>();
  for (const site of sites) bySource.set(site.source, (bySource.get(site.source) ?? 0) + 1);
  console.log(
    `${tag}: ${sites.length}  [${[...bySource.entries()].map(([s, n]) => `${s}=${n}`).join(', ')}]`,
  );
  for (const site of sites.slice(0, 3)) {
    console.log(`    e.g. ${site.exercise} (${site.requirement})`);
  }
}

console.log('\n=== TAGS IN VOCABULARY THAT NOTHING REQUIRES ===');
const required = new Set(vocabulary.requiredTags.map((d) => d.tag));
for (const tag of FULL_GYM_EQUIPMENT) {
  if (!required.has(tag)) console.log(`  ${tag}`);
}

console.log('\n=== REQUIRED CONDITIONING MODALITIES ===');
for (const { modality, sites } of vocabulary.requiredModalities) {
  const bySource = new Map<string, number>();
  for (const site of sites) bySource.set(site.source, (bySource.get(site.source) ?? 0) + 1);
  console.log(
    `${modality}: ${sites.length}  [${[...bySource.entries()].map(([s, n]) => `${s}=${n}`).join(', ')}]`,
  );
}

console.log('\n=== UNMAPPABLE REQUIREMENTS (athlete can never answer these) ===');
for (const site of vocabulary.unmappableRequirements) {
  console.log(`  ${site.source} / ${site.exercise}: "${site.requirement}"`);
}

console.log('\n=== UNCLASSIFIED STRENGTH NAMES (equipment invisible to the filter) ===');
for (const name of vocabulary.unclassifiedStrengthNames) console.log(`  ${name}`);
console.log(`\ntotals: tags=${vocabulary.requiredTags.length}, modalities=${vocabulary.requiredModalities.length}, unmappable=${vocabulary.unmappableRequirements.length}, unclassified=${vocabulary.unclassifiedStrengthNames.length}`);
