import { MUTATION_CATALOGUE } from '../registry/mutationCatalogue';
import {
  applySlice5Mutation,
  buildSlice5MutationWitness,
  evaluateSlice5MutationWitness,
} from '../observations/buildSlice5MutationWitness';
import type { MutationGateResult } from '../types';

const RESULT_MARKER = 'BIBLE_SLICE5_MUTATION_RESULT ';

function projection(value: unknown): string {
  return JSON.stringify(value);
}

export function runSlice5MutationProbe(id: string): MutationGateResult {
  const spec = MUTATION_CATALOGUE.find((entry) => entry.id === id && entry.tier === 'full');
  if (!spec) throw new Error(`Unknown full mutation: ${id}`);
  const baseline = buildSlice5MutationWitness(spec);
  const baselineProjection = projection(baseline);
  const baselineEvaluation = evaluateSlice5MutationWitness(baseline);
  if (!baselineEvaluation.passed) throw new Error(`${id} production baseline is not green: ${projection(baselineEvaluation)}`);
  const mutant = applySlice5Mutation(baseline);
  const active = projection(mutant) !== baselineProjection;
  if (!active) throw new Error(`${id} mutation was not active`);
  const mutantEvaluation = evaluateSlice5MutationWitness(mutant);
  if (mutantEvaluation.passed) throw new Error(`${id} active mutation survived its invariant`);
  const restored = projection(baseline) === baselineProjection && evaluateSlice5MutationWitness(baseline).passed;
  if (!restored) throw new Error(`${id} restoration failed`);
  const report = [
    `RULE       ${spec.affectedRuleIds[0]}`,
    `MUTATION   ${id}`,
    `STAGE      ${baseline.stage}`,
    `EXPECTED   ${projection(mutantEvaluation.expected)}`,
    `ACTUAL     ${projection(mutantEvaluation.actual)}`,
    'LOSS       canonical relationship — unauthorised',
  ].join('\n');
  return {
    id, active, killed: true, restored,
    invariantId: baseline.invariantId, firstStage: baseline.stage, report,
  };
}

if (require.main === module) {
  try {
    const id = process.argv[2];
    if (!id) throw new Error('Slice 5 mutation id is required');
    process.stdout.write(`${RESULT_MARKER}${JSON.stringify(runSlice5MutationProbe(id))}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exit(1);
  }
}
