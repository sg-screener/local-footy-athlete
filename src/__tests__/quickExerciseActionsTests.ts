import fs from 'fs';
import path from 'path';

import {
  applyMobilityFlowExerciseDecisions,
  applyRecoveryAddonExerciseDecisions,
} from '../utils/derivedExerciseDecisions';
import { nextQuickSwapChoice, rankedQuickSwapChoices } from '../utils/quickExerciseActions';
import type { DecisionLedgerEntry } from '../types/decisionLedger';
import type { ProgramControlAction } from '../types/programControlAction';
import type { TapSwapEnvironment } from '../utils/tapSwapHierarchy';
import { exerciseSessionFamily } from '../rules/exerciseSessionFamily';

let passed = 0;
let failed = 0;

function assert(condition: unknown, message: string): void {
  if (condition) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error(`FAIL: ${message}`);
}

function entry(id: string, action: ProgramControlAction): DecisionLedgerEntry {
  return {
    id,
    occurredAt: `2026-08-24T00:00:0${id.length}.000Z`,
    provenance: 'athlete_tap',
    decision: { kind: 'program_control', action },
  };
}

function mobilityAction(
  type: 'swap_exercise' | 'remove_exercise',
  toExercise?: { name: string; sets: number; repsMin: number; repsMax: number },
): ProgramControlAction {
  const shared = {
    source: { screen: 'session_detail' as const, surface: 'quick_exercise_action', initiatedBy: 'tap' as const },
    scope: 'today_only' as const,
    requiresRebuild: false,
    createsActiveModifier: false,
    oneOffOnly: true,
  };
  return type === 'swap_exercise'
    ? {
        ...shared,
        type,
        payload: {
          date: '2026-08-24',
          fromExercise: 'Hip Flexor Rock Back',
          fromExerciseId: 'mobility:hip-flexor-rock-back',
          derivedSource: { kind: 'mobility_flow', id: 'mobility:hip-flexor-rock-back' },
          toExercise: toExercise!,
        },
      }
    : {
        ...shared,
        type,
        payload: {
          date: '2026-08-24',
          exercise: 'Hip Flexor Rock Back',
          exerciseId: 'mobility:hip-flexor-rock-back',
          derivedSource: { kind: 'mobility_flow', id: 'mobility:hip-flexor-rock-back' },
        },
      };
}

const choices = [
  { kind: 'exercise' as const, name: 'A' },
  { kind: 'exercise' as const, name: 'B' },
  { kind: 'exercise' as const, name: 'C' },
];

const healthyEnvironment: TapSwapEnvironment = {
  injurySeverities: {},
  primaryInjury: null,
  availableEquipment: ['bodyweight', 'barbell', 'dumbbell', 'cable', 'machine', 'kettlebell'],
  availableEquipmentTags: [
    'bodyweight', 'barbell', 'dumbbells', 'cables', 'machine', 'kettlebell',
    'bike_or_treadmill',
  ],
  capacity: 'high',
  hasEquipmentConstraint: false,
  medicalStop: false,
};
for (const original of ['Bench Press', "World's Greatest Stretch", 'Tempo Run']) {
  const ranked = rankedQuickSwapChoices({
    originalExercise: original,
    reason: 'preference',
    environment: healthyEnvironment,
  });
  assert(ranked.length > 0, `${original} has a real ranked Quick Swap answer`);
  assert(ranked.every((choice) => exerciseSessionFamily(choice.name!) === exerciseSessionFamily(original)),
    `${original} Quick Swap stays inside its session family`);
}
let attempted: readonly string[] = [];
for (const expected of ['A', 'B', 'C', 'A']) {
  const next = nextQuickSwapChoice(choices, attempted);
  assert(next?.choice.name === expected, `repeated Quick Swap advances to ${expected}`);
  attempted = next?.attemptedNames ?? [];
}

const flow = {
  dayType: 'full_body' as const,
  movementCount: 2,
  movements: [
    {
      category: 'hips' as any,
      exercise: {
        id: 'hip-flexor-rock-back',
        name: 'Hip Flexor Rock Back',
        sets: 1,
        repsMin: 8,
        repsMax: 8,
        equipment: [],
      },
    },
    {
      category: 'ankles' as any,
      exercise: {
        id: 'ankle-rock',
        name: 'Ankle Rock',
        sets: 1,
        repsMin: 8,
        repsMax: 8,
        equipment: [],
      },
    },
  ],
};

const removedFlow = applyMobilityFlowExerciseDecisions({
  flow: flow as any,
  date: '2026-08-24',
  entries: [entry('remove', mobilityAction('remove_exercise'))],
});
assert(removedFlow?.movements.length === 1, 'Quick Remove hides one derived warm-up row');
assert(removedFlow?.movementCount === 1, 'derived warm-up count follows the projected rows');

const swappedFlow = applyMobilityFlowExerciseDecisions({
  flow: flow as any,
  date: '2026-08-24',
  entries: [entry('swap', mobilityAction('swap_exercise', {
    name: '90/90 Hip Switch', sets: 1, repsMin: 8, repsMax: 8,
  }))],
});
assert(swappedFlow?.movements[0]?.exercise.name === '90/90 Hip Switch',
  'Quick Swap replaces the exact derived warm-up row');
assert(swappedFlow?.movements[0]?.exercise.id === 'hip-flexor-rock-back',
  'derived warm-up replacement keeps the stable slot id for repeated swaps');

const wrongDate = applyMobilityFlowExerciseDecisions({
  flow: flow as any,
  date: '2026-08-25',
  entries: [entry('wrong-date', mobilityAction('remove_exercise'))],
});
assert(wrongDate?.movements.length === 2, 'a derived edit cannot leak onto another date');

const removal = entry('annul-me', mobilityAction('remove_exercise'));
const restoredFlow = applyMobilityFlowExerciseDecisions({
  flow: flow as any,
  date: '2026-08-24',
  entries: [
    removal,
    {
      id: 'undo', occurredAt: '2026-08-24T00:01:00.000Z', provenance: 'athlete_tap',
      decision: { kind: 'reversal', reversedEntryId: removal.id },
    },
  ],
});
assert(restoredFlow?.movements.length === 2, 'Undo restores a derived warm-up row by replay');

const addonWorkout = {
  id: 'session',
  recoveryAddons: [{
    id: 'addon-block',
    exercises: [
      { id: 'outdoor-walk', name: 'Outdoor Walk', prescription: '5–10 min' },
      { id: 'dead-hang', name: 'Dead Hang', prescription: '20–30s' },
    ],
  }],
};
const addonRemove = entry('addon-remove', {
  type: 'remove_exercise',
  source: { screen: 'session_detail', surface: 'quick_exercise_action', initiatedBy: 'tap' },
  scope: 'today_only', requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true,
  payload: {
    date: '2026-08-24', exercise: 'Outdoor Walk', exerciseId: 'outdoor-walk',
    derivedSource: { kind: 'recovery_addon', id: 'outdoor-walk' },
  },
});
const addonSwap = entry('addon-swap', {
  type: 'swap_exercise',
  source: { screen: 'session_detail', surface: 'quick_exercise_action', initiatedBy: 'tap' },
  scope: 'today_only', requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true,
  payload: {
    date: '2026-08-24', fromExercise: 'Dead Hang', fromExerciseId: 'dead-hang',
    derivedSource: { kind: 'recovery_addon', id: 'dead-hang' },
    toExercise: { name: 'Child’s Pose Breathing', sets: 1, repsMin: 60, repsMax: 60 },
  },
});
const projectedAddon = applyRecoveryAddonExerciseDecisions({
  workout: addonWorkout as any,
  date: '2026-08-24',
  entries: [addonRemove, addonSwap],
});
assert(projectedAddon.recoveryAddons?.[0]?.exercises.length === 1,
  'Quick Remove covers an optional recovery exercise');
assert(projectedAddon.recoveryAddons?.[0]?.exercises[0]?.name === 'Child’s Pose Breathing',
  'Quick Swap covers an optional recovery exercise');
assert(projectedAddon.recoveryAddons?.[0]?.exercises[0]?.id === 'dead-hang',
  'optional recovery replacement keeps its stable slot id');

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/screens/home/DayWorkoutScreenV2.tsx'), 'utf8',
);
assert(/function QuickExerciseActions\(/.test(source), 'one shared Quick Exercise Actions UI exists');
assert(/name="autorenew"/.test(source) && /color="#B9A7FF"/.test(source),
  'Quick Swap uses the purple chasing-arrows icon');
assert(/name="minus"/.test(source) && /color="#FF7F7F"/.test(source)
  && !/name="minus-circle-outline"/.test(source),
  'Quick Remove uses one red circle with only a minus glyph inside');
assert((source.match(/size=\{15\}/g) ?? []).length >= 2,
  'both quick-action glyphs match the exercise-name font size');
assert(/exerciseRowActions: \{[\s\S]*?position: 'absolute'[\s\S]*?top: 12[\s\S]*?right: 14/.test(source),
  'quick actions are anchored together at the top right');
assert(/controlsRow: \{[\s\S]*?position: 'absolute'[\s\S]*?right: 0[\s\S]*?bottom: 0[\s\S]*?alignItems: 'center'/.test(source),
  'the bottom-right controls overlay the card without changing its height');
assert(/<View style=\{styles\.controlsRow\}>[\s\S]*?styles\.weightControl[\s\S]*?\{checkbox\}[\s\S]*?<\/View>/.test(source),
  'the weight toggle and checkbox are siblings on one exact centreline');
const hubStart = source.indexOf('testID="day-workout-change-hub"');
const hubEnd = source.indexOf('/>', hubStart);
const hubSource = source.slice(hubStart, hubEnd);
assert(hubStart >= 0 && hubEnd > hubStart
  && /id: 'equipment'/.test(hubSource)
  && /id: 'injury'/.test(hubSource)
  && /id: 'add'/.test(hubSource)
  && !/id: 'remove'/.test(hubSource)
  && !/id: 'swap'/.test(hubSource),
  'the session-wide change hub keeps Equipment, Injury and Add without duplicate Swap or Remove');
for (const renderer of [
  'MobilityExerciseList', 'StrengthExerciseCard', 'ConditioningPhaseRow',
  'ConditioningRow', 'AddonRow',
]) {
  assert(new RegExp(`${renderer}[\\s\\S]*?onQuickSwap[\\s\\S]*?onQuickRemove`).test(source),
    `${renderer} is wired to both quick actions`);
}
assert(/kind: 'replace_removed'/.test(source),
  'Quick Remove asks whether the athlete wants a replacement after removal');

const controlSource = fs.readFileSync(
  path.join(process.cwd(), 'src/utils/programControlActions.ts'), 'utf8',
);
const derivedLedgerBranch = controlSource.indexOf('const derivedExerciseAction =');
const ordinaryTransaction = controlSource.indexOf('const transaction = await runCoachMutationTransaction', derivedLedgerBranch);
assert(derivedLedgerBranch >= 0 && ordinaryTransaction > derivedLedgerBranch
  && /appendDecisionEntry/.test(controlSource.slice(derivedLedgerBranch, ordinaryTransaction)),
  'derived exercise actions append through the ledger before the material-program transaction');

console.log(`quick exercise actions: ${passed} passed / ${failed} failed`);
if (failed > 0) process.exit(1);
