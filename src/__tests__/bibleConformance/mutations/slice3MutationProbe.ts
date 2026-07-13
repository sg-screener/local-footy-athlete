import { SLICE3_GOLDEN_SCENARIOS } from '../scenarios/slice3Goldens';
import { buildSlice3ScenarioTrace } from '../observations/buildSlice3Trace';
import { evaluateSlice3Trace, firstSlice3Failure } from '../invariants/slice3Invariants';
import { renderConformanceFailure } from '../report/renderConformanceFailure';
import type {
  Slice3InvariantId,
  Slice3MutationAcceptanceResult,
  Slice3MutationId,
  Slice3ScenarioId,
  Slice3ScenarioTrace,
} from '../types';

const RESULT_MARKER = 'BIBLE_SLICE3_MUTATION_RESULT ';

const MUTATION_CASES: Record<Slice3MutationId, {
  scenarioId: Slice3ScenarioId;
  invariantId: Slice3InvariantId;
}> = {
  early_power_survives: { scenarioId: 'early-offseason-healthy', invariantId: 'INV_POWER_PHASE_GATED' },
  contrast_without_heavy: { scenarioId: 'late-offseason-valid-contrast', invariantId: 'INV_CONTRAST_STRUCTURALLY_VALID' },
  offfeet_reported_running: { scenarioId: 'early-offseason-healthy', invariantId: 'INV_MODALITY_IDENTITY_HONEST' },
  drop_second_modality: { scenarioId: 'multi-modality-conditioning', invariantId: 'INV_MULTI_MODALITY_NO_COLLAPSE' },
  mixed_strength_fatigue_zero: { scenarioId: 'inseason-mixed-team-accounting', invariantId: 'INV_STRENGTH_FATIGUE_CREDIT_CONSERVED' },
  team_false_squat_credit: { scenarioId: 'inseason-mixed-team-accounting', invariantId: 'INV_TEAM_GAME_ANCHOR_CREDIT_VALID' },
  g2_heavy_survives: { scenarioId: 'inseason-game-sat-g2-lower', invariantId: 'INV_G2_HEAVY_LOWER_PROTECTED' },
  constraint_drops_unrelated: { scenarioId: 'hamstring-restriction-mixed', invariantId: 'INV_UNAFFECTED_CONTENT_PRESERVED' },
  equipment_incompatible_survives: { scenarioId: 'equipment-no-barbell-lower', invariantId: 'INV_EQUIPMENT_COMPATIBLE' },
  trunk_creates_conditioning: { scenarioId: 'inseason-mixed-team-accounting', invariantId: 'INV_CONDITIONING_EXPOSURE_CREDIT_CONSERVED' },
  legacy_list_exhaustive: { scenarioId: 'early-offseason-legacy-commercial', invariantId: 'INV_CONDITIONING_FEASIBILITY_SINGLE_OWNER' },
  edge_restores_unavailable_bike: { scenarioId: 'early-offseason-explicit-no-cardio', invariantId: 'INV_CONDITIONING_FEASIBILITY_SINGLE_OWNER' },
  fallback_drops_feasible_conditioning: { scenarioId: 'early-offseason-modern-full-gym', invariantId: 'INV_EARLY_OFFSEASON_CROSS_MICROCYCLE_CONDITIONING' },
  second_week_conditioning_loss: { scenarioId: 'early-offseason-legacy-commercial', invariantId: 'INV_EARLY_OFFSEASON_CROSS_MICROCYCLE_CONDITIONING' },
  stale_subphase_note_survives: { scenarioId: 'early-offseason-explicit-no-cardio', invariantId: 'INV_SUBPHASE_NOTE_REQUIRES_VISIBLE_EFFECT' },
};

function assertGreen(trace: Slice3ScenarioTrace, label: string): void {
  const failure = firstSlice3Failure(evaluateSlice3Trace(trace));
  if (failure) throw new Error(`${label} was not green:\n${renderConformanceFailure(failure)}`);
}

function meaningfulProjection(trace: Slice3ScenarioTrace): string {
  return JSON.stringify(trace.stages);
}

export function runSlice3MutationProbe(mutationId: Slice3MutationId): Slice3MutationAcceptanceResult {
  const testCase = MUTATION_CASES[mutationId];
  if (!testCase) throw new Error(`Unknown Slice 3 mutation: ${mutationId}`);
  const scenario = SLICE3_GOLDEN_SCENARIOS.find((candidate) => candidate.id === testCase.scenarioId);
  if (!scenario) throw new Error(`Missing Slice 3 mutation scenario: ${testCase.scenarioId}`);

  const baseline = buildSlice3ScenarioTrace(scenario);
  assertGreen(baseline, `${mutationId} baseline`);
  const mutant = buildSlice3ScenarioTrace(scenario, mutationId);
  const mutationActive = meaningfulProjection(baseline) !== meaningfulProjection(mutant);
  if (!mutationActive) throw new Error(`${mutationId} mutation was not active in observed output`);

  const first = firstSlice3Failure(evaluateSlice3Trace(mutant));
  if (!first) throw new Error(`Harness remained green under active mutation ${mutationId}`);
  const report = renderConformanceFailure(first);
  if (first.invariantId !== testCase.invariantId) {
    throw new Error(`${mutationId} failed ${first.invariantId}, expected ${testCase.invariantId}\n${report}`);
  }
  if (!report.includes(scenario.id) || !report.includes('unauthorised')) {
    throw new Error(`${mutationId} report omitted scenario/unauthorised evidence:\n${report}`);
  }

  // The mutation is a temporary test-side observation transform. Rebuilding
  // without it proves no mutated state escaped this isolated child process.
  const restoredTrace = buildSlice3ScenarioTrace(scenario);
  const restored = meaningfulProjection(restoredTrace) === meaningfulProjection(baseline);
  if (!restored) throw new Error(`${mutationId} observation restoration failed`);
  assertGreen(restoredTrace, `${mutationId} restored harness`);

  return {
    mutationId,
    killed: true,
    mutationActive,
    restored,
    invariantId: first.invariantId as Slice3InvariantId,
    scenarioId: scenario.id,
    firstDivergenceStage: first.stage,
    report,
  };
}

if (require.main === module) {
  try {
    const mutationId = process.argv[2] as Slice3MutationId;
    if (!mutationId) throw new Error('Slice 3 mutation id is required');
    const result = runSlice3MutationProbe(mutationId);
    process.stdout.write(`${RESULT_MARKER}${JSON.stringify(result)}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}
