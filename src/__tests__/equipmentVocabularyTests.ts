/**
 * THE EQUIPMENT CHECKLIST IS THE LIBRARY'S SHADOW — GATED IN BOTH DIRECTIONS.
 *
 * SAM'S RULING 1, 2026-07-31: the onboarding equipment checklist's content is
 * DERIVED from the exercise library — every tag and conditioning modality any
 * authored exercise or template can require. If nothing needs it, it is not
 * asked; if anything does, it cannot be omitted.
 *
 *   library -> checklist   a tag any authored row requires must be askable.
 *                          The next Depth-Jumps-'Box' — an authored exercise
 *                          whose requirement no athlete can answer about —
 *                          fails here the day it is authored, not the day an
 *                          athlete misses a session it silently gated.
 *   checklist -> library   an askable tag nothing requires is a dead question,
 *                          and a dead question is how the old 8-tag constant
 *                          survived unnoticed: nothing checked that the answer
 *                          mattered.
 *
 * The two exclusions from the ASKED list are pinned to their justifications,
 * not asserted as facts of taste: `bodyweight` because the resolver seeds it
 * unconditionally, `bike_or_treadmill` because the resolver derives it from
 * the athlete's modality answers.
 *
 * DEPTH (L13): 0 — static derivation over the authored data modules. No
 * walked state; the walker meets equipment at the onboarding-step stage.
 *
 * Run: npm run test:equipment-vocabulary
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import type { EquipmentTag } from '../data/exercisePools';
import { CONDITIONING_TEMPLATES } from '../data/conditioningTemplates';
import {
  deriveEquipmentVocabulary,
  derivedEquipmentChecklistTags,
  derivedConditioningModalityQuestions,
  UNMAPPABLE_REQUIREMENTS_PENDING_RULING,
} from '../rules/equipmentVocabulary';
import { eligiblePowerExercises } from '../rules/powerExercisePool';
import {
  FULL_GYM_EQUIPMENT,
  resolveEquipmentCapabilities,
} from '../utils/equipmentAvailability';
import type { ConditioningEquipmentModality } from '../types/domain';

let passed = 0; const failures: string[] = [];
function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail !== undefined ? `\n      ${
    typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
}

const vocabulary = deriveEquipmentVocabulary();
const demandedTags = new Set(vocabulary.requiredTags.map((demand) => demand.tag));
const checklist = derivedEquipmentChecklistTags();

/* ── Typed exhaustiveness pin ─────────────────────────────────────────────
 * Adding a member to `EquipmentTag` fails COMPILATION here until the author
 * classifies it: asked, or excluded with a pinned justification below. */
const TAG_CLASSIFICATION: Record<EquipmentTag, 'asked' | 'always_available' | 'derived_from_modalities'> = {
  bodyweight: 'always_available',
  dumbbells: 'asked',
  barbell: 'asked',
  cables: 'asked',
  bands: 'asked',
  bench: 'asked',
  foam_roller: 'asked',
  bike_or_treadmill: 'derived_from_modalities',
  pullup_bar: 'asked',
  kettlebell: 'asked',
  machine: 'asked',
};

console.log('\n— library -> checklist (nothing authored can require an unaskable tag) —');

for (const demand of vocabulary.requiredTags) {
  const classification = TAG_CLASSIFICATION[demand.tag];
  ok(
    `demanded tag '${demand.tag}' (${demand.sites.length} sites) is askable or excluded-with-reason`,
    classification === 'asked'
      ? checklist.includes(demand.tag)
      : classification !== undefined,
    demand.sites.slice(0, 3),
  );
}

ok(
  'unmappable requirements are EXACTLY the pinned pending-ruling list',
  JSON.stringify(
    vocabulary.unmappableRequirements
      .map((site) => ({ exercise: site.exercise, requirement: site.requirement }))
      .sort((a, b) => a.exercise.localeCompare(b.exercise)),
  ) === JSON.stringify(
    [...UNMAPPABLE_REQUIREMENTS_PENDING_RULING]
      .sort((a, b) => a.exercise.localeCompare(b.exercise)),
  ),
  vocabulary.unmappableRequirements,
);

ok(
  'every strength-pool name is classifiable (equipment demand visible to the filter)',
  vocabulary.unclassifiedStrengthNames.length === 0,
  vocabulary.unclassifiedStrengthNames,
);

// The consequence of the one pinned unmappable row, held true so the audit
// sheet's claim cannot rot: Depth Jumps is unselectable even with a FULL gym.
// Sam's §3 ruling on the sheet flips this pin in the same change that pays it.
const offSeasonAdvancedFullGym = eligiblePowerExercises({
  family: 'lower',
  phase: 'Off-season',
  trainingAge: 'advanced',
  reduced: false,
  blockId: 'audit-pin',
  availableEquipment: [...FULL_GYM_EQUIPMENT],
});
ok(
  "pinned consequence: Depth Jumps ('Box') is unselectable even with a full gym",
  !offSeasonAdvancedFullGym.some((entry) => entry.name === 'Depth Jumps'),
  offSeasonAdvancedFullGym.map((entry) => entry.name),
);

console.log('\n— checklist -> library (no dead questions) —');

for (const tag of checklist) {
  ok(`asked tag '${tag}' has at least one authored requiring site`, demandedTags.has(tag));
}
for (const [tag, classification] of Object.entries(TAG_CLASSIFICATION)) {
  if (classification === 'asked') {
    ok(
      `classification and checklist agree on '${tag}'`,
      checklist.includes(tag as EquipmentTag),
    );
  } else {
    ok(`excluded tag '${tag}' is not asked`, !checklist.includes(tag as EquipmentTag));
  }
}

console.log('\n— pinned justifications for the two exclusions —');

const bodyweightOnly = resolveEquipmentCapabilities(
  { equipment: ['Bodyweight Only'], trainingLocation: 'Home gym', equipmentSelectionCompleteness: 'complete' },
  null,
  '2026-07-31',
);
ok(
  "exclusion justification: 'bodyweight' is seeded unconditionally by the resolver",
  bodyweightOnly.tags.includes('bodyweight'),
  bodyweightOnly,
);

const withBike = resolveEquipmentCapabilities(
  { equipment: ['Dumbbells Only', 'Bike'], trainingLocation: 'Home gym', equipmentSelectionCompleteness: 'complete' },
  null,
  '2026-07-31',
);
const withoutMachines = resolveEquipmentCapabilities(
  { equipment: ['Dumbbells Only'], trainingLocation: 'Home gym', equipmentSelectionCompleteness: 'complete' },
  null,
  '2026-07-31',
);
ok(
  "exclusion justification: 'bike_or_treadmill' derives from modality answers (present with a bike)",
  withBike.tags.includes('bike_or_treadmill') && withBike.conditioningModalities.includes('bike'),
  withBike,
);
ok(
  "exclusion justification: 'bike_or_treadmill' derives from modality answers (absent without)",
  !withoutMachines.tags.includes('bike_or_treadmill'),
  withoutMachines,
);

console.log('\n— conditioning modalities —');

const modalityQuestions = derivedConditioningModalityQuestions();
const ALL_EQUIPMENT_MODALITIES: readonly ConditioningEquipmentModality[] =
  ['bike', 'row', 'ski', 'treadmill'];

ok(
  'every equipment modality in the domain vocabulary is demanded (no dead modality question)',
  ALL_EQUIPMENT_MODALITIES.every((modality) => modalityQuestions.includes(modality)),
  modalityQuestions,
);
ok(
  'every demanded modality is in the domain vocabulary',
  modalityQuestions.every((modality) => ALL_EQUIPMENT_MODALITIES.includes(modality)),
  modalityQuestions,
);

for (const modality of ['bike', 'row', 'ski'] as const) {
  const demand = vocabulary.requiredModalities.find((entry) => entry.modality === modality);
  ok(
    `'${modality}' is demanded by AUTHORED content, not only rules`,
    !!demand && demand.sites.some((site) => site.source !== 'feasibility_rules'),
    demand?.sites.slice(0, 2),
  );
}
{
  const treadmill = vocabulary.requiredModalities.find((entry) => entry.modality === 'treadmill');
  ok(
    "'treadmill' demand is the substitution ladder and nothing authored — the audit sheet's provenance claim",
    !!treadmill && treadmill.sites.every((site) => site.source === 'feasibility_rules'),
    treadmill?.sites,
  );
}

// The renderable-modality authority is PROSE (`modalityNotes`) — a known
// representation gap. Until it is typed, hold every authored note to the
// vocabulary this gate's reader understands, so a new modality cannot be
// introduced in prose invisibly.
const RECOGNISED_NOTE_WORDS = /run|walk|bike|row|ski|erg|treadmill|hill|all 5 modalities/i;
const unrecognisedNotes = CONDITIONING_TEMPLATES
  .filter((template) => !RECOGNISED_NOTE_WORDS.test(template.modalityNotes))
  .map((template) => `${template.name}: ${template.modalityNotes}`);
ok(
  'every template modalityNotes names at least one recognised modality form',
  unrecognisedNotes.length === 0,
  unrecognisedNotes,
);

console.log(`\n${failures.length === 0 ? 'ALL PASS' : 'FAILURES'}: ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
