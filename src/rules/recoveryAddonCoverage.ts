/**
 * Recovery add-on FOCUS AREAS — the vocabulary, and only the vocabulary.
 *
 * WHAT THIS FILE USED TO BE. `recommendRecoveryAddonCoverage` was a second
 * recovery-add-on authority: it scored the seven focus areas against season
 * phase, week kind, capacity band, readiness and active injuries and returned a
 * whole placement plan (targets, counting fences, G-1 policy, cautions).
 * It had ZERO production execution — every production importer of this module
 * took `RecoveryAddonFocusArea` as a TYPE and nothing else, so the module was
 * erased at compile time and the recommender never ran on any athlete's device.
 *
 * WHO OWNS THE BEHAVIOUR NOW.
 *   - the counting fence          `RecoveryAddonCountingFence` in `types/domain.ts`
 *     (this file carried a duplicate declaration nothing imported)
 *   - what a recovery add-on IS   `types/domain.ts` `RecoveryAddonBlock`
 *   - which focus area is biased  `rules/testingBias.ts`, `rules/programmingBias.ts`
 *   - what the athlete sees       `utils/sessionComponents.ts` -> `DayWorkoutScreenV2`
 *
 * The focus-area union stays because those two bias modules are live and read it.
 */

export type RecoveryAddonFocusArea =
  | 'trunk_core'
  | 'adductors_groin'
  | 'calves_tib_ankles'
  | 'hamstring_light_prehab'
  | 'shoulder_scap'
  | 'mobility_reset'
  | 'carries';
