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


import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import type { EquipmentTag } from '../data/exercisePools';
import { CONDITIONING_TEMPLATES } from '../data/conditioningTemplates';
import {
  deriveEquipmentVocabulary,
  derivedEquipmentChecklistTags,
  derivedConditioningModalityQuestions,
  formatEquipmentProfileSummary,
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
  // Sam's audit ruling 1, 2026-07-31: the 10th question.
  plyo_box: 'asked',
  // ── ITEM 46/47, 2026-08-13 — the seven that became askable. ──
  // Every one of these was ALREADY required by an authored row; the bridge
  // just answered it with the wrong tick (`Rack` and `Trap Bar` collapsed onto
  // `barbell`) or with none at all. They are asked, not derived: no other
  // answer implies owning a rack, and nothing else can stand in for one.
  rack: 'asked',
  trap_bar: 'asked',
  swiss_ball: 'asked',
  ab_wheel: 'asked',
  back_extension_bench: 'asked',
  dip_bars: 'asked',
  rings_trx: 'asked',
  // 2026-08-17. ASKED, and it is the row this classification exists for: Sam's
  // sheet required `sandbag` for `Bear Carry` and the checklist had never heard
  // of it, so `exerciseIsAvailableWith` asked every athlete for a thing none of
  // them could own and the exercise was refused on every kit, forever, in
  // silence. The gate could not see it because the derivation read five
  // authored sources and Sam's own sheet was not one of them; it is now read
  // FIRST (`rules/equipmentVocabulary.ts`).
  sandbag: 'asked',
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

// THE PIN, FLIPPED BY RULING. Sam's audit ruling 1 (2026-07-31) made the box
// the 10th question; 'Box' maps to `plyo_box`, and Depth Jumps is alive again
// for an athlete who has one — and stays dead for an athlete who does not.
const offSeasonAdvancedFullGym = eligiblePowerExercises({
  family: 'lower',
  phase: 'Off-season',
  trainingAge: 'advanced',
  reduced: false,
  blockId: 'audit-pin',
  availableEquipment: [...FULL_GYM_EQUIPMENT],
});
ok(
  'Depth Jumps is selectable again for a full gym WITH a box (ruling 1)',
  offSeasonAdvancedFullGym.some((entry) => entry.name === 'Depth Jumps'),
  offSeasonAdvancedFullGym.map((entry) => entry.name),
);
const offSeasonAdvancedNoBox = eligiblePowerExercises({
  family: 'lower',
  phase: 'Off-season',
  trainingAge: 'advanced',
  reduced: false,
  blockId: 'audit-pin',
  availableEquipment: FULL_GYM_EQUIPMENT.filter((tag) => tag !== 'plyo_box'),
});
ok(
  'and still unselectable without one — the requirement is real, not decorative',
  !offSeasonAdvancedNoBox.some((entry) => entry.name === 'Depth Jumps'),
  offSeasonAdvancedNoBox.map((entry) => entry.name),
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
  { equipment: ['Bodyweight Only'], equipmentSelectionCompleteness: 'complete' },
  null,
  '2026-07-31',
);
ok(
  "exclusion justification: 'bodyweight' is seeded unconditionally by the resolver",
  bodyweightOnly.tags.includes('bodyweight'),
  bodyweightOnly,
);

const withBike = resolveEquipmentCapabilities(
  { equipment: ['Dumbbells Only', 'Bike'], equipmentSelectionCompleteness: 'complete' },
  null,
  '2026-07-31',
);
const withoutMachines = resolveEquipmentCapabilities(
  { equipment: ['Dumbbells Only'], equipmentSelectionCompleteness: 'complete' },
  null,
  '2026-07-31',
);
ok(
  "exclusion justification: 'bike_or_treadmill' derives from modality answers (present with a bike)",
  withBike.tags.includes('bike_or_treadmill') && withBike.conditioningModalities.includes('bike_erg'),
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
  ['bike_erg', 'air_bike', 'row', 'ski', 'treadmill'];

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

for (const modality of ['bike_erg', 'air_bike', 'row', 'ski'] as const) {
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

console.log('\n— location presets are seeds INSIDE the vocabulary (audit ruling 3) —');
{
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { EQUIPMENT_LOCATION_PRESETS } =
    require('../rules/equipmentLocationPresets') as typeof import('../rules/equipmentLocationPresets');
  ok('there are exactly the three ruled location choices',
    EQUIPMENT_LOCATION_PRESETS.length === 3 &&
      JSON.stringify(EQUIPMENT_LOCATION_PRESETS.map((preset) => preset.id)) ===
        JSON.stringify(['commercial_gym', 'club_gym', 'home_gym']));
  for (const preset of EQUIPMENT_LOCATION_PRESETS) {
    ok(`preset '${preset.id}' pre-ticks only askable tags`,
      preset.preTickedTags.every((tag) => checklist.includes(tag)),
      preset.preTickedTags.filter((tag) => !checklist.includes(tag)));
    ok(`preset '${preset.id}' pre-ticks only askable modalities`,
      preset.preTickedModalities.every((modality) => modalityQuestions.includes(modality)),
      preset.preTickedModalities.filter((m) => !modalityQuestions.includes(m)));
  }
  ok('the commercial preset ticks the whole vocabulary (Sam: commercial = all)',
    EQUIPMENT_LOCATION_PRESETS[0].preTickedTags.length === checklist.length &&
      EQUIPMENT_LOCATION_PRESETS[0].preTickedModalities.length === modalityQuestions.length);

  // SIGNED CONTENT PINS — Sam, 2026-07-31, one amendment (club adds pull-up
  // bar). These are equality pins, not subset checks: the lists carry his
  // signature, and a drift here is a change to it.
  const club = EQUIPMENT_LOCATION_PRESETS.find((preset) => preset.id === 'club_gym');
  // `rack` ADDED 2026-08-13 (item 46/47) AND IT IS NOT A CHANGE TO HIS
  // SIGNATURE — it is the same signature re-expressed after the question split.
  // When Sam signed this list, `barbell` WAS "barbell & rack": the bridge
  // collapsed Back Squat's `Rack` requirement onto the barbell tick, so a club
  // athlete who ticked barbell got squats. Leaving `rack` off now would take
  // squats away from every club-gym athlete — a behaviour change smuggled in
  // under a pin whose job is to prevent exactly that.
  ok('the SIGNED club preset is exactly barbell (+rack, post-split), dumbbells, bands, bench, pull-up bar, plyo box + bike erg',
    JSON.stringify([...(club?.preTickedTags ?? [])].sort()) ===
      JSON.stringify(['bands', 'barbell', 'bench', 'dumbbells', 'plyo_box', 'pullup_bar', 'rack']) &&
      JSON.stringify(club?.preTickedModalities) === JSON.stringify(['bike_erg']),
    club);
  const home = EQUIPMENT_LOCATION_PRESETS.find((preset) => preset.id === 'home_gym');
  ok('the SIGNED home preset is exactly dumbbells, bands, foam roller and no machines',
    JSON.stringify([...(home?.preTickedTags ?? [])].sort()) ===
      JSON.stringify(['bands', 'dumbbells', 'foam_roller']) &&
      home?.preTickedModalities.length === 0,
    home);
}

console.log('\n— Profile repeats the onboarding choice, never its seeded checklist —');
ok(
  'a selected commercial gym reads as Commercial gym',
  formatEquipmentProfileSummary({
    trainingLocation: 'Commercial gym',
    equipmentAnswer: { tags: { barbell: 'have' }, modalities: {} },
  }) === 'Commercial gym',
);
ok(
  'club and home choices retain the exact onboarding labels',
  formatEquipmentProfileSummary({ trainingLocation: 'Club gym' }) === 'Club gym'
    && formatEquipmentProfileSummary({ trainingLocation: 'Home gym' }) === 'Home gym',
);
ok(
  'an explicitly empty equipment answer reads as Bodyweight only even when seeded from a gym',
  formatEquipmentProfileSummary({
    trainingLocation: 'Commercial gym',
    equipmentAnswer: { tags: { barbell: 'never' }, modalities: {} },
  }) === 'Bodyweight only',
);
ok(
  'Profile never falls back to an itemised equipment list',
  formatEquipmentProfileSummary({
    equipmentSelectionCompleteness: 'complete',
    equipment: ['Barbell', 'Dumbbells', 'Cable machine'],
  }) === 'Not selected',
);

console.log(`\n${failures.length === 0 ? 'ALL PASS' : 'FAILURES'}: ${passed} passed, ${failures.length} failed`);
totalsPrinted(failures.length);
if (failures.length > 0) process.exit(1);
