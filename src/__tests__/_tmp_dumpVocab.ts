import { selectableVocabularyGroups, exemptionsFor } from '../data/selectableExerciseVocabulary';
import { EXERCISE_TAGS, CONDITIONING_META } from '../data/exerciseTags';
import { GROIN_ADDUCTORS_POOL, CALVES_POOL, LOWER_PREHAB_POOL, TRUNK_ANTI_ROTATION_POOL, SHOULDER_HEALTH_POOL, HAMSTRING_LIGHT_POOL, TISSUE_QUALITY_POOL, MOBILITY_POOL, EASY_CARDIO_POOL, BREATHING_RESET_POOL, BICEPS_POOL, TRICEPS_POOL, DELTS_POOL, UPPER_BACK_PUMP_POOL } from '../data/exercisePools';
import { STRENGTH_POOLS } from '../data/exercisePoolsStrength';

const groups = selectableVocabularyGroups();

const poolNotes: Record<string, string> = {};
for (const pool of [GROIN_ADDUCTORS_POOL, CALVES_POOL, LOWER_PREHAB_POOL, TRUNK_ANTI_ROTATION_POOL, SHOULDER_HEALTH_POOL, HAMSTRING_LIGHT_POOL, TISSUE_QUALITY_POOL, MOBILITY_POOL, EASY_CARDIO_POOL, BREATHING_RESET_POOL, BICEPS_POOL, TRICEPS_POOL, DELTS_POOL, UPPER_BACK_PUMP_POOL]) {
  for (const e of pool) poolNotes[e.name] = e.notes;
}

const strengthSlotInfo: Record<string, { slot: string; role: string }> = {};
for (const slot of Object.keys(STRENGTH_POOLS) as (keyof typeof STRENGTH_POOLS)[]) {
  for (const role of ['anchor', 'accessory'] as const) {
    for (const entry of STRENGTH_POOLS[slot][role].entries) {
      strengthSlotInfo[entry.name] = { slot, role };
    }
  }
}

const out: any[] = [];
for (const group of groups) {
  for (const name of group.names) {
    const tags = EXERCISE_TAGS[name];
    const cond = CONDITIONING_META[name];
    out.push({
      group: group.label,
      name,
      movement: tags?.movement ?? null,
      region: tags?.region ?? null,
      power: tags?.power ?? false,
      contraindications: tags ? Object.entries(tags.injury).filter(([,v]) => v !== 'good').map(([k,v]) => `${k}:${v}`) : [],
      slotRole: strengthSlotInfo[name] ?? null,
      conditioningTier: cond?.tier ?? null,
      notes: poolNotes[name] ?? null,
      exemptions: exemptionsFor(name),
    });
  }
}

console.log(JSON.stringify(out, null, 2));
