import { STRENGTH_GOLDEN_SCENARIOS } from '../scenarios/strengthGoldens';
import { buildStrengthScenarioTrace } from '../observations/buildStrengthTrace';
import {
  evaluateStrengthTrace,
  firstInvariantFailure,
} from '../invariants/strengthIntentInvariants';
import { renderConformanceFailure } from '../report/renderConformanceFailure';
import type { MutationAcceptanceResult } from '../types';

const RESULT_MARKER = 'BIBLE_MUTATION_RESULT ';

function requirementsSatisfied(report: string, missingPattern: string): boolean {
  return report.includes('ALL-STR-BLOCK-01') &&
    report.includes('is-healthy-5d-tt2-game-sat') &&
    report.includes('STAGE     allocation') &&
    report.includes(missingPattern) &&
    report.includes('unauthorised');
}

export function runCompositeIntentCollapseProbe(): MutationAcceptanceResult {
  const scenario = STRENGTH_GOLDEN_SCENARIOS[0];
  const strengthModule = require('../../../rules/strengthPatternContributions') as any;
  const descriptor = Object.getOwnPropertyDescriptor(strengthModule, 'createStrengthIntent');
  if (!descriptor?.writable || !descriptor.configurable) {
    throw new Error('createStrengthIntent export is not writable/configurable under the active test loader');
  }

  const original = strengthModule.createStrengthIntent;
  const baselineTrace = buildStrengthScenarioTrace(scenario);
  const baselineResults = evaluateStrengthTrace(baselineTrace);
  const baselineFailures = baselineResults.flatMap((result) => result.failures);
  if (baselineFailures.length > 0) {
    throw new Error(`Baseline conformance was not green:\n${renderConformanceFailure(baselineFailures[0])}`);
  }

  let mutationActive = false;
  let restored = false;
  let report = '';
  let firstDivergenceStage: MutationAcceptanceResult['firstDivergenceStage'] = null;
  try {
    strengthModule.createStrengthIntent = (args: any) => {
      const planned = Array.isArray(args.plannedPatterns) ? [...args.plannedPatterns] : [];
      if (!planned.includes('hinge')) return original(args);
      return original({
        ...args,
        plannedPatterns: planned.filter((pattern) => pattern !== 'hinge'),
        effectivePatterns: planned.filter((pattern) => pattern !== 'hinge'),
      });
    };

    const mutantTrace = buildStrengthScenarioTrace(scenario);
    const baselineLower = baselineTrace.sessions.allocation.find((row) =>
      row.day === 'Monday' && row.weekInBlock === 1)?.plannedPatterns ?? [];
    const mutantLower = mutantTrace.sessions.allocation.find((row) =>
      row.day === 'Monday' && row.weekInBlock === 1)?.plannedPatterns ?? [];
    mutationActive = JSON.stringify(baselineLower) !== JSON.stringify(mutantLower) &&
      JSON.stringify(mutantLower) === JSON.stringify(['squat']);
    if (!mutationActive) throw new Error('Composite-collapse mutation was not active in allocation output');

    const mutantResults = evaluateStrengthTrace(mutantTrace);
    const first = firstInvariantFailure(mutantResults);
    if (!first) throw new Error('Bible conformance harness remained green under active composite collapse');
    firstDivergenceStage = first.stage;
    report = renderConformanceFailure(first);
    if (first.stage !== 'allocation') {
      throw new Error(`Expected first divergence at allocation, received ${first.stage}\n${report}`);
    }
    if (!requirementsSatisfied(report, 'hinge')) {
      throw new Error(`Mutation report omitted required evidence:\n${report}`);
    }
  } finally {
    strengthModule.createStrengthIntent = original;
    restored = strengthModule.createStrengthIntent === original;
  }

  if (!restored) throw new Error('createStrengthIntent export was not restored');
  const restoredFailures = evaluateStrengthTrace(buildStrengthScenarioTrace(scenario))
    .flatMap((result) => result.failures);
  if (restoredFailures.length > 0) {
    throw new Error(`Normal harness did not return green after restoration:\n${renderConformanceFailure(restoredFailures[0])}`);
  }

  return {
    killed: true,
    mutationActive,
    restored,
    firstDivergenceStage,
    report,
  };
}

if (require.main === module) {
  try {
    const result = runCompositeIntentCollapseProbe();
    process.stdout.write(`${RESULT_MARKER}${JSON.stringify(result)}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}
