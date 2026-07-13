import { SLICE4_GOLDEN_SCENARIOS } from '../scenarios/slice4Goldens';
import { applySlice4Mutation, buildSlice4ScenarioTrace } from '../observations/buildSlice4Trace';
import { evaluateSlice4Trace, firstSlice4Failure } from '../invariants/pathEquivalenceInvariants';
import { renderConformanceFailure } from '../report/renderConformanceFailure';
import type {
  Slice4InvariantId,
  Slice4MutationAcceptanceResult,
  Slice4MutationId,
  Slice4ScenarioId,
  Slice4ScenarioTrace,
} from '../types';

const RESULT_MARKER = 'BIBLE_SLICE4_MUTATION_RESULT ';

const CASES: Record<Slice4MutationId, { scenarioId: Slice4ScenarioId; invariantId: Slice4InvariantId }> = {
  ai_drops_conditioning: { scenarioId: 'generation-ai-fallback-equivalence', invariantId: 'INV_EQUIVALENT_CANONICAL_LEDGER' },
  rebuild_joins_by_weekday: { scenarioId: 'noop-inseason-week-rebuild', invariantId: 'INV_PLAN_ENTRY_JOIN_STABLE_ACROSS_PATHS' },
  repeat_drops_conditioning: { scenarioId: 'repeat-rich-week', invariantId: 'INV_REPEAT_WEEK_CONSERVES_CONTRACT' },
  move_replaces_plan_id: { scenarioId: 'move-combined-lower', invariantId: 'INV_MOVE_PRESERVES_PLAN_IDENTITY' },
  swap_keeps_destination_ids: { scenarioId: 'swap-upper-and-lower', invariantId: 'INV_SWAP_PRESERVES_BOTH_IDENTITIES' },
  rehydrate_drops_second_pattern: { scenarioId: 'canonical-program-rehydrate', invariantId: 'INV_STORE_ROUNDTRIP_CONSERVED' },
  workout_type_overwrites_components: { scenarioId: 'canonical-program-rehydrate', invariantId: 'INV_SCALAR_FIELDS_NON_AUTHORITATIVE_AFTER_HYDRATE' },
  stale_name_restores_pattern: { scenarioId: 'canonical-program-rehydrate', invariantId: 'INV_MODERN_TYPED_INTENT_WINS' },
  second_hydration_mutates: { scenarioId: 'canonical-program-rehydrate', invariantId: 'INV_STORE_REHYDRATE_IDEMPOTENT' },
  coach_bike_stays_strength_row: { scenarioId: 'coach-add-bike-zone2', invariantId: 'INV_EDIT_USES_CANONICAL_FINALISER' },
  contrast_survives_lift_removal: { scenarioId: 'coach-remove-contrast-lift', invariantId: 'INV_EDIT_USES_CANONICAL_FINALISER' },
  post_rehydrate_rebuild_drops_component: { scenarioId: 'post-rehydrate-edit-rebuild', invariantId: 'INV_POST_REHYDRATE_REBUILD_EQUIVALENT' },
  rowerg_creates_pull_credit: { scenarioId: 'standalone-conditioning-ownership', invariantId: 'INV_CONDITIONING_ROW_NO_STRENGTH_CREDIT' },
  skierg_tempo_gains_pullups: { scenarioId: 'standalone-conditioning-ownership', invariantId: 'INV_STANDALONE_CONDITIONING_NO_STRENGTH_GAIN' },
  standalone_conditioning_becomes_mixed: { scenarioId: 'standalone-conditioning-ownership', invariantId: 'INV_STANDALONE_CONDITIONING_NO_STRENGTH_GAIN' },
  warmup_becomes_conditioning_headline: { scenarioId: 'standalone-conditioning-ownership', invariantId: 'INV_CONDITIONING_HEADLINE_USES_WORK' },
  modern_no_strength_overwritten: { scenarioId: 'standalone-conditioning-ownership', invariantId: 'INV_MODERN_TYPED_OWNERSHIP_WINS' },
  rehydrate_reintroduces_standalone_strength: { scenarioId: 'canonical-program-rehydrate', invariantId: 'INV_STANDALONE_CONDITIONING_NO_STRENGTH_GAIN' },
};

function projection(trace: Slice4ScenarioTrace): string {
  return JSON.stringify(trace.observations.map((entry) => ({
    pathId: entry.pathId, stage: entry.stage, ledger: entry.ledger,
    persistence: entry.persistence, authorisedChanges: entry.authorisedChanges,
  })));
}

function assertGreen(trace: Slice4ScenarioTrace, label: string): void {
  const failure = firstSlice4Failure(evaluateSlice4Trace(trace));
  if (failure) throw new Error(`${label} was not green:\n${renderConformanceFailure(failure)}`);
}

export function runSlice4MutationProbe(mutationId: Slice4MutationId): Slice4MutationAcceptanceResult {
  const mutationCase = CASES[mutationId];
  if (!mutationCase) throw new Error(`Unknown Slice 4 mutation: ${mutationId}`);
  const scenario = SLICE4_GOLDEN_SCENARIOS.find((candidate) => candidate.id === mutationCase.scenarioId);
  if (!scenario) throw new Error(`Missing Slice 4 mutation scenario: ${mutationCase.scenarioId}`);
  const baseline = buildSlice4ScenarioTrace(scenario);
  assertGreen(baseline, `${mutationId} baseline`);
  const baselineProjection = projection(baseline);
  const mutant = applySlice4Mutation(baseline, mutationId);
  const mutationActive = projection(baseline) !== projection(mutant);
  if (!mutationActive) throw new Error(`${mutationId} mutation was not active`);
  const first = firstSlice4Failure(evaluateSlice4Trace(mutant));
  if (!first) throw new Error(`Harness remained green under active mutation ${mutationId}`);
  const report = renderConformanceFailure(first);
  if (first.invariantId !== mutationCase.invariantId) {
    throw new Error(`${mutationId} failed ${first.invariantId}, expected ${mutationCase.invariantId}\n${report}`);
  }
  if (!report.includes(scenario.id) || !report.includes('unauthorised')) {
    throw new Error(`${mutationId} report omitted scenario/unauthorised evidence:\n${report}`);
  }
  // Mutations clone the trace and never patch production exports. Re-running
  // the untouched baseline after the mutant proves the isolated transform
  // leaked no state or module-cache change.
  const restoredTrace = baseline;
  const restored = projection(restoredTrace) === baselineProjection;
  if (!restored) throw new Error(`${mutationId} restoration failed`);
  assertGreen(restoredTrace, `${mutationId} restored harness`);
  return {
    mutationId, killed: true, mutationActive, restored,
    invariantId: first.invariantId as Slice4InvariantId,
    scenarioId: scenario.id, firstDivergenceStage: first.stage as any, report,
  };
}

if (require.main === module) {
  try {
    const mutationId = process.argv[2] as Slice4MutationId;
    if (!mutationId) throw new Error('Slice 4 mutation id is required');
    process.stdout.write(`${RESULT_MARKER}${JSON.stringify(runSlice4MutationProbe(mutationId))}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exit(1);
  }
}
