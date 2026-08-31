import assert from 'node:assert/strict';
import { decideExerciseForBlock, type BlockExerciseSelection } from '../rules/blockExerciseSelection';
import { selectConditioningTemplate } from '../rules/conditioningSelection';
import { CONDITIONING_TEMPLATES } from '../data/conditioningTemplates';
import { POWER_EXERCISE_POOL, selectPowerExercise } from '../rules/powerExercisePool';

let passed = 0;
function check(name: string, run: () => void): void {
  run();
  passed += 1;
  console.log(`PASS ${name}`);
}

const prior: BlockExerciseSelection[] = [];
const strengthInput = {
  phase: 'Off-season' as const,
  blockNumber: 3,
  slot: 'horizontal_push' as const,
  group: null,
  role: 'main_bilateral' as const,
  legalCandidates: ['Bench Press', 'Incline Bench Press', 'Close Grip Bench Press'] as any,
  previousSelection: null,
  currentBlockSelection: null,
  recentSelections: prior,
  progressedIdentities: [] as any,
  pinnedIdentities: [] as any,
};

check('strength equal-cohort selection ignores candidate order', () => {
  const forward = decideExerciseForBlock(strengthInput).identity;
  const reversed = decideExerciseForBlock({
    ...strengthInput,
    legalCandidates: [...strengthInput.legalCandidates].reverse(),
  }).identity;
  assert.equal(reversed, forward);
});

check('conditioning selection ignores authored-template array order', () => {
  const args = { category: 'glycolytic' as const, dateStr: '2026-11-02', miniCycleNumber: 5, seatIndex: 0 };
  const forward = selectConditioningTemplate(args).name;
  (CONDITIONING_TEMPLATES as any[]).reverse();
  try {
    assert.equal(selectConditioningTemplate(args).name, forward);
  } finally {
    (CONDITIONING_TEMPLATES as any[]).reverse();
  }
});

check('power selection ignores pool array order', () => {
  const args = {
    family: 'lower' as const,
    phase: 'Pre-season' as const,
    trainingAge: 'consistent' as const,
    reduced: false,
    availableEquipment: ['plyo_box'],
    blockId: '2026-11-02',
    kind: 'primer' as const,
  };
  const forward = selectPowerExercise(args)?.name;
  (POWER_EXERCISE_POOL as any[]).reverse();
  try {
    assert.equal(selectPowerExercise(args)?.name, forward);
  } finally {
    (POWER_EXERCISE_POOL as any[]).reverse();
  }
});

console.log(`programming catalogue order: ${passed} passed`);
