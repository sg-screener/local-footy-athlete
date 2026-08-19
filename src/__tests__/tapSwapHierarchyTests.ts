(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  },
};

import { getExerciseTags, type InjuryKey } from '../data/exerciseTags';
import type { TapSwapEnvironment } from '../utils/tapSwapHierarchy';
import {
  assessTapSwapCandidateSafety,
  getTapSwapChoices,
  resolveTapSwapEnvironment,
} from '../utils/tapSwapHierarchy';
import { getSafeTrainingFallbackRank } from '../rules/conflictResolutionHierarchy';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) {
    pass++;
    console.log(`  ok ${name}`);
    return;
  }
  fail++;
  failures.push(name);
  console.log(`  fail ${name}${detail === undefined ? '' : `\n      ${JSON.stringify(detail)}`}`);
}

function eq(name: string, actual: unknown, expected: unknown): void {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), { expected, actual });
}

/**
 * ⚠ **`injurySeverities` IS THE STORED FACT AND `activeInjuries` IS ITS
 * PROJECTION, SO THE HELPER DERIVES ONE FROM THE OTHER.**
 *
 * Every case below states its world as `activeInjuries: { knee: 'avoid' }`, and
 * that is now the LEGALITY level: `avoid` is Sam's 6-7 band (*"remove risky work
 * through the area"*) and `caution` is 1-5 (*"keep safe work in"*). Deriving the
 * severity here keeps each case meaning exactly what it meant, and — because
 * `TapSwapEnvironment` requires the field — no case can silently describe a
 * healthy athlete and pass for the wrong reason.
 */
const SEVERITY_FOR_LEVEL = { avoid: 6, caution: 4 } as const;

interface CaseOverrides extends Partial<Omit<TapSwapEnvironment, 'injurySeverities'>> {
  /** Each case states its world in the old two-value vocabulary; translated here. */
  activeInjuries?: Partial<Record<InjuryKey, 'caution' | 'avoid'>>;
  injurySeverities?: TapSwapEnvironment['injurySeverities'];
}

function environment(overrides: CaseOverrides = {}): TapSwapEnvironment {
  const activeInjuries = overrides.activeInjuries ?? {};
  const injurySeverities = overrides.injurySeverities ?? (Object.fromEntries(
    Object.entries(activeInjuries).map(([region, level]) => [
      region, SEVERITY_FOR_LEVEL[level as 'avoid' | 'caution'],
    ]),
  ) as TapSwapEnvironment['injurySeverities']);
  const { activeInjuries: _ignored, ...rest } = overrides;
  return {
    injurySeverities,
    primaryInjury: null,
    availableEquipment: ['bodyweight', 'barbell', 'dumbbell', 'cable', 'machine', 'kettlebell'],
    availableEquipmentTags: [
      'bodyweight',
      'barbell',
      'dumbbells',
      'cables',
      'machine',
      'kettlebell',
      'bike_or_treadmill',
    ],
    capacity: 'high',
    hasEquipmentConstraint: false,
    medicalStop: false,
    ...rest,
  };
}

console.log('\n-- Bible tap swap hierarchy --');

{
  const choices = getTapSwapChoices({
    originalExercise: 'Bench Press',
    reason: 'preference',
    environment: environment(),
  });
  eq('safe normal swap starts in the same movement pattern',
    choices[0]?.hierarchyTier,
    'same_movement_pattern');
  ok('safe normal swap does not repeat Bench Press',
    choices[0]?.name !== 'Bench Press',
    choices);
  ok('tap choices follow the canonical safe fallback order',
    choices.every((choice, index) => index === 0 ||
      getSafeTrainingFallbackRank(choices[index - 1].hierarchyTier) <=
        getSafeTrainingFallbackRank(choice.hierarchyTier)),
    choices);
}

{
  const primaryInjury = { bucket: 'knee' as const, severity: 6 };
  const choices = getTapSwapChoices({
    originalExercise: 'Back Squat',
    reason: 'injury_or_pain',
    environment: environment({
      activeInjuries: { knee: 'avoid' },
      primaryInjury,
    }),
    primaryInjury,
  });
  eq('same muscle group is used when safe same-pattern knee work is unavailable',
    choices[0]?.hierarchyTier,
    'similar_muscle_group');
  eq('knee-blocked squat selects the curated posterior-chain option',
    choices[0]?.name,
    'Hip Thrusts');
}

{
  const primaryInjury = { bucket: 'shoulder' as const, severity: 6 };
  const choices = getTapSwapChoices({
    originalExercise: 'Bench Press',
    reason: 'injury_or_pain',
    environment: environment({
      activeInjuries: { shoulder: 'avoid' },
      primaryInjury,
      availableEquipment: ['bodyweight', 'dumbbell'],
      availableEquipmentTags: ['bodyweight', 'dumbbells'],
    }),
    primaryInjury,
  });
  eq('unaffected body area is used when pressing options are unsafe/unavailable',
    choices[0]?.hierarchyTier,
    'unaffected_body_area');
  eq('shoulder issue selects supported pulling before recovery',
    choices[0]?.name,
    'Chest Supported Row');
}

console.log('\n-- Injury, readiness and equipment precedence --');

{
  const choices = getTapSwapChoices({
    originalExercise: 'Back Squat',
    reason: 'no_equipment',
    environment: environment({
      availableEquipment: ['bodyweight', 'barbell'],
      availableEquipmentTags: ['bodyweight', 'barbell'],
    }),
  });
  eq('no-barbell tap falls back to a bodyweight same-pattern squat',
    choices[0]?.name,
    'Bodyweight Squat');
  ok('no-equipment hierarchy never returns another barbell lift first',
    choices[0]?.name !== 'Front Squat' && choices[0]?.name !== 'Box Squat',
    choices);
}

{
  const primaryInjury = { bucket: 'shoulder' as const, severity: 6 };
  const choices = getTapSwapChoices({
    originalExercise: 'Bench Press',
    reason: 'injury_or_pain',
    environment: environment({
      activeInjuries: { shoulder: 'avoid' },
      primaryInjury,
    }),
    primaryInjury,
  });
  const firstTags = choices[0]?.name ? getExerciseTags(choices[0].name) : null;
  ok('shoulder issue does not suggest the same painful pressing trigger first',
    choices[0]?.name !== 'Bench Press' &&
      choices[0]?.name !== 'DB Bench Press' &&
      firstTags?.injury.shoulder === 'good',
    choices);
}

{
  const primaryInjury = { bucket: 'hamstring' as const, severity: 7 };
  const choices = getTapSwapChoices({
    originalExercise: 'RDLs',
    reason: 'injury_or_pain',
    environment: environment({
      activeInjuries: { hamstring: 'avoid' },
      primaryInjury,
    }),
    primaryInjury,
  });
  /* ⚠ **THE REGEX ALSO HAD TO STOP MATCHING `Air Bike Sprints`, AND THAT WAS A
   * REAL DEFECT, NOT A TEST ARTEFACT.** When the recovery rung began deriving
   * from the exercise library rather than from a four-name table, it offered
   * `Air Bike Sprints`, `Hard Assault Bike Intervals` and `MetCon` — all rated
   * `hamstring: 'good'` because they are off-feet, all hard sessions, and all
   * named by Sam's own bad-swap line *"Hamstring pain from sprinting ->
   * repeated sprint bike at max effort without control."* The rung now reads
   * `CONDITIONING_META.tier === 'C'`, his authored recovery/flush tier, so the
   * assertion below is kept EXACTLY as it was and passes on the fix. */
  ok('hamstring issue avoids sprint, heavy hinge and Nordic suggestions',
    choices.every((choice) =>
      !/sprint|nordic|deadlift|rdl/i.test(choice.name ?? '')),
    choices);
}

{
  const primaryInjury = { bucket: 'knee' as const, severity: 7 };
  const choices = getTapSwapChoices({
    originalExercise: 'Box Jumps',
    reason: 'injury_or_pain',
    environment: environment({
      activeInjuries: { knee: 'avoid' },
      primaryInjury,
    }),
    primaryInjury,
  });
  /* ⚠ **THIS CELL PINNED THE OLD TABLE'S ONLY ANSWER, NOT SAM'S RULE.**
   * `REPLACEMENT_BY_BUCKET.knee['Box Jumps']` held exactly one entry —
   * `Easy Bike` — so "recovery is first" was a statement about the table's size.
   * His actual line is *"Jump/plyo -> **controlled strength** or bike or ski
   * erg"* (Bible :2144), and controlled strength is named FIRST. The derived
   * ladder now reaches it, so the cell asserts the rule instead of the table:
   * the first answer is legal for this knee, is not more jumping, and easy
   * conditioning is still on offer below it. */
  const firstKneeTags = choices[0]?.name ? getExerciseTags(choices[0].name) : null;
  ok('knee issue answers jumping with safe work, not more jumping',
    firstKneeTags?.injury.knee === 'good'
      && firstKneeTags?.movement !== 'plyo',
    choices[0]);
  ok('knee issue still offers easy conditioning below it',
    choices.some((choice) => choice.hierarchyTier === 'recovery_easy_conditioning'),
    choices.map((choice) => choice.hierarchyTier));
  ok('knee issue does not return knee-dominant, COD or jumping work',
    choices.every((choice) => !/jump|sprint|change of direction|cod/i.test(choice.name ?? '')),
    choices);
}

{
  const choices = getTapSwapChoices({
    originalExercise: 'Bench Press',
    reason: 'preference',
    environment: environment({ capacity: 'low' }),
  });
  ok('low readiness removes high-fatigue alternatives',
    choices.filter((choice) => choice.kind === 'exercise').every((choice) =>
      !choice.name || getExerciseTags(choice.name)?.fatigue !== 'high'),
    choices);
}

{
  const noBarbell = environment({
    availableEquipment: ['bodyweight', 'dumbbell'],
    availableEquipmentTags: ['bodyweight', 'dumbbells'],
    hasEquipmentConstraint: true,
  });
  eq('execution safety rejects an unavailable barbell alternative',
    assessTapSwapCandidateSafety('Front Squat', noBarbell).safe,
    false);
  eq('execution safety accepts a bodyweight alternative',
    assessTapSwapCandidateSafety('Bodyweight Squat', noBarbell).safe,
    true);
}

console.log('\n-- Recovery and rest are true fallbacks --');

{
  const choices = getTapSwapChoices({
    originalExercise: 'Unknown Exercise',
    reason: 'other',
    environment: environment({
      availableEquipment: ['bodyweight'],
      availableEquipmentTags: ['bodyweight'],
    }),
  });
  eq('recovery/easy option appears when no training substitute is verifiable',
    choices[0]?.hierarchyTier,
    'recovery_easy_conditioning');
  eq('rest is absent while a useful recovery option exists',
    choices.some((choice) => choice.hierarchyTier === 'rest'),
    false);
}

{
  const choices = getTapSwapChoices({
    originalExercise: 'Unknown Exercise',
    reason: 'other',
    environment: environment({
      availableEquipment: [],
      availableEquipmentTags: [],
    }),
    recoveryAllowed: false,
  });
  eq('rest appears only when no safe useful training or recovery remains',
    choices.map((choice) => choice.hierarchyTier),
    ['rest']);
}

{
  const resolved = resolveTapSwapEnvironment({
    date: '2026-07-06',
    profile: {
      trainingLocation: 'Commercial gym',
      equipment: ['Dumbbells Only'],
      seasonPhase: 'Off-season',
    },
    activeConstraints: [{
      id: 'fatigue',
      type: 'fatigue',
      severity: 7,
      status: 'active',
      startDate: '2026-07-06',
      lastUpdatedAt: '2026-07-06T00:00:00Z',
      rules: [],
      safeFocus: [],
      advice: [],
    }],
  });
  eq('live environment resolves active fatigue to low capacity', resolved.capacity, 'low');
  ok('live environment resolves profile equipment without barbell',
    resolved.availableEquipment.includes('dumbbell') &&
      !resolved.availableEquipment.includes('barbell'),
    resolved.availableEquipment);
}

console.log(`\ntapSwapHierarchyTests: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.error(`Failures: ${failures.join(', ')}`);
  process.exit(1);
}
