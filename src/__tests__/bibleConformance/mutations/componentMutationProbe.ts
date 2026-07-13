import { COMPONENT_GOLDEN_SCENARIOS } from '../scenarios/componentGoldens';
import { STRENGTH_GOLDEN_SCENARIOS } from '../scenarios/strengthGoldens';
import { buildComponentScenarioTrace } from '../observations/buildComponentTrace';
import { buildStrengthScenarioTrace } from '../observations/buildStrengthTrace';
import {
  evaluateComponentTrace,
  firstComponentFailure,
} from '../invariants/sessionComponentInvariants';
import {
  evaluateStrengthTrace,
  firstInvariantFailure,
} from '../invariants/strengthIntentInvariants';
import { renderConformanceFailure } from '../report/renderConformanceFailure';
import type {
  ComponentMutationAcceptanceResult,
  ComponentMutationId,
  InvariantCheckResult,
} from '../types';

const RESULT_MARKER = 'BIBLE_COMPONENT_MUTATION_RESULT ';

function writableExport(moduleValue: any, key: string): PropertyDescriptor {
  const descriptor = Object.getOwnPropertyDescriptor(moduleValue, key);
  if (!descriptor?.writable || !descriptor.configurable) {
    throw new Error(`${key} export is not writable/configurable under the active test loader`);
  }
  return descriptor;
}

function componentScenario(id: string) {
  const scenario = COMPONENT_GOLDEN_SCENARIOS.find((candidate) => candidate.id === id);
  if (!scenario) throw new Error(`Missing component mutation scenario: ${id}`);
  return scenario;
}

function targetGenerated(trace: ReturnType<typeof buildComponentScenarioTrace>) {
  return trace.sessions.generated_fallback.find((row) =>
    row.weekInBlock === trace.scenario.target.weekInBlock && row.day === trace.scenario.target.day);
}

function assertGreen(results: readonly InvariantCheckResult[], label: string): void {
  const failure = results.flatMap((entry) => entry.failures)[0];
  if (failure) throw new Error(`${label} was not green:\n${renderConformanceFailure(failure)}`);
}

function runComponentMutation(mutationId: Exclude<ComponentMutationId, 'full_body_extra_lower'>) {
  const scenarioId = mutationId === 'drop_mixed_conditioning'
    ? 'mixed-strength-aerobic'
    : mutationId === 'drop_team_strength'
      ? 'team-training-plus-strength'
      : mutationId === 'trunk_as_conditioning'
        ? 'strength-plus-trunk-support'
        : 'accessory-gunshow-only';
  const scenario = componentScenario(scenarioId);
  const baselineTrace = buildComponentScenarioTrace(scenario);
  assertGreen(evaluateComponentTrace(baselineTrace), 'Component mutation baseline');
  const baseline = targetGenerated(baselineTrace);
  if (!baseline) throw new Error(`No baseline target for ${mutationId}`);

  let moduleValue: any;
  let exportName: string;
  if (mutationId === 'drop_mixed_conditioning' || mutationId === 'drop_team_strength') {
    moduleValue = require('../../../data/defaultProgram');
    exportName = 'buildWorkoutsFromCoach';
  } else if (mutationId === 'trunk_as_conditioning') {
    moduleValue = require('../../../utils/sessionComponents');
    exportName = 'getSessionComponentRows';
  } else {
    moduleValue = require('../../../utils/workoutCanonicalisation');
    exportName = 'finaliseWorkoutAfterMutation';
  }
  writableExport(moduleValue, exportName);
  const original = moduleValue[exportName];
  let mutationActive = false;
  let restored = false;
  let report = '';
  let invariantId: ComponentMutationAcceptanceResult['invariantId'] = 'INV_COMPONENT_SET_CONSERVED';
  let firstDivergenceStage: ComponentMutationAcceptanceResult['firstDivergenceStage'] = null;

  try {
    if (mutationId === 'drop_mixed_conditioning') {
      moduleValue[exportName] = (...args: any[]) => original(...args).map((workout: any) => {
        if (workout.planEntryId !== baseline.planEntryId) return workout;
        const conditioningIds = new Set(
          (workout.conditioningBlock?.options ?? []).flatMap((option: any) => option.exerciseIds ?? []),
        );
        return {
          ...workout,
          exercises: workout.exercises.filter((row: any) => !conditioningIds.has(row.id)),
          conditioningBlock: undefined,
          hasCombinedConditioning: false,
          attachedConditioningKind: undefined,
          conditioningCategory: undefined,
          conditioningFlavour: undefined,
          workoutType: 'Strength',
        };
      });
    } else if (mutationId === 'drop_team_strength') {
      moduleValue[exportName] = (...args: any[]) => original(...args).map((workout: any) => {
        if (workout.planEntryId !== 'w1:tuesday:none:team') return workout;
        return {
          ...workout,
          exercises: [],
          strengthIntent: workout.strengthIntent
            ? { ...workout.strengthIntent, effectivePatterns: [] }
            : undefined,
          powerBlock: undefined,
        };
      });
    } else if (mutationId === 'trunk_as_conditioning') {
      moduleValue[exportName] = (workout: any) => {
        const rows = original(workout);
        if (workout?.planEntryId !== 'w1:monday:none:strength') return rows;
        return {
          ...rows,
          supportRows: [],
          conditioningRows: [...rows.conditioningRows, ...rows.supportRows],
        };
      };
    } else {
      moduleValue[exportName] = (...args: any[]) => {
        const result = original(...args);
        if (result.workout?.planEntryId !== 'fixture:w1:wednesday:accessory') return result;
        return {
          ...result,
          workout: {
            ...result.workout,
            strengthIntent: {
              archetype: 'upper',
              primaryPattern: 'push',
              plannedPatterns: ['push'],
              effectivePatterns: ['push'],
            },
            strengthPatternContributions: ['push'],
          },
        };
      };
    }

    const mutantTrace = buildComponentScenarioTrace(scenario);
    const mutant = targetGenerated(mutantTrace);
    if (!mutant) throw new Error(`No mutant target for ${mutationId}`);
    mutationActive = mutationId === 'drop_mixed_conditioning'
      ? baseline.components.includes('conditioning') && !mutant.components.includes('conditioning')
      : mutationId === 'drop_team_strength'
        ? baseline.components.includes('strength') && !mutant.components.includes('strength') && mutant.effectivePatterns.length === 0
        : mutationId === 'trunk_as_conditioning'
          ? baseline.supportRowNames.includes('Pallof Press') && mutant.conditioningRowNames.includes('Pallof Press')
          : baseline.effectivePatterns.length === 0 && mutant.effectivePatterns.includes('push');
    if (!mutationActive) throw new Error(`${mutationId} mutation was not active in observed output`);

    const results = evaluateComponentTrace(mutantTrace);
    const first = firstComponentFailure(results);
    if (!first) throw new Error(`Harness remained green under active mutation ${mutationId}`);
    invariantId = first.invariantId;
    firstDivergenceStage = first.stage;
    report = renderConformanceFailure(first);
    const expectedInvariant = mutationId === 'trunk_as_conditioning'
      ? 'INV_TRUNK_NOT_CONDITIONING'
      : mutationId === 'accessory_main_credit'
        ? 'INV_ACCESSORY_NOT_MAIN_EXPOSURE'
        : 'INV_COMPONENT_SET_CONSERVED';
    if (first.invariantId !== expectedInvariant) {
      throw new Error(`${mutationId} failed ${first.invariantId}, expected ${expectedInvariant}\n${report}`);
    }
    if (!report.includes(scenario.id) || !report.includes('unauthorised')) {
      throw new Error(`${mutationId} report omitted scenario/unauthorised evidence:\n${report}`);
    }
  } finally {
    moduleValue[exportName] = original;
    restored = moduleValue[exportName] === original;
  }

  if (!restored) throw new Error(`${mutationId} export restoration failed`);
  assertGreen(evaluateComponentTrace(buildComponentScenarioTrace(scenario)), `${mutationId} restored harness`);
  return {
    mutationId,
    killed: true,
    mutationActive,
    restored,
    invariantId,
    scenarioId: scenario.id,
    firstDivergenceStage,
    report,
  } satisfies ComponentMutationAcceptanceResult;
}

function runFullBodyMutation(): ComponentMutationAcceptanceResult {
  const mutationId = 'full_body_extra_lower' as const;
  const scenario = STRENGTH_GOLDEN_SCENARIOS[1];
  const baselineTrace = buildStrengthScenarioTrace(scenario);
  assertGreen(evaluateStrengthTrace(baselineTrace), 'Full-body mutation baseline');
  const moduleValue = require('../../../rules/strengthPatternContributions') as any;
  const exportName = 'createStrengthIntent';
  writableExport(moduleValue, exportName);
  const original = moduleValue[exportName];
  let mutationActive = false;
  let restored = false;
  let report = '';
  let firstDivergenceStage: ComponentMutationAcceptanceResult['firstDivergenceStage'] = null;
  let invariantId: ComponentMutationAcceptanceResult['invariantId'] = 'INV_FULL_BODY_EXACT_LEDGER';
  try {
    moduleValue[exportName] = (args: any) => {
      const result = original(args);
      const lower = result.plannedPatterns.filter((pattern: string) => pattern === 'squat' || pattern === 'hinge');
      if (result.archetype !== 'full_body' || lower.length !== 1) return result;
      const extra = lower[0] === 'squat' ? 'hinge' : 'squat';
      return original({
        ...result,
        plannedPatterns: [...result.plannedPatterns, extra],
        effectivePatterns: [...result.effectivePatterns, extra],
      });
    };
    const mutantTrace = buildStrengthScenarioTrace(scenario);
    const mutant = mutantTrace.sessions.allocation.find((row) => row.weekInBlock === 1 && row.day === 'Monday');
    mutationActive = !!mutant && mutant.plannedPatterns.includes('squat') && mutant.plannedPatterns.includes('hinge');
    if (!mutationActive) throw new Error('full_body_extra_lower mutation was not active');
    const first = firstInvariantFailure(evaluateStrengthTrace(mutantTrace));
    if (!first) throw new Error('Strength harness remained green under full-body over-credit mutation');
    invariantId = first.invariantId;
    firstDivergenceStage = first.stage;
    report = renderConformanceFailure(first);
    if (first.invariantId !== 'INV_FULL_BODY_EXACT_LEDGER' || first.stage !== 'allocation') {
      throw new Error(`Unexpected full-body mutation divergence:\n${report}`);
    }
  } finally {
    moduleValue[exportName] = original;
    restored = moduleValue[exportName] === original;
  }
  if (!restored) throw new Error('full_body_extra_lower export restoration failed');
  assertGreen(evaluateStrengthTrace(buildStrengthScenarioTrace(scenario)), 'Full-body restored harness');
  return {
    mutationId,
    killed: true,
    mutationActive,
    restored,
    invariantId,
    scenarioId: scenario.id,
    firstDivergenceStage,
    report,
  };
}

export function runComponentMutationProbe(mutationId: ComponentMutationId): ComponentMutationAcceptanceResult {
  return mutationId === 'full_body_extra_lower'
    ? runFullBodyMutation()
    : runComponentMutation(mutationId);
}

if (require.main === module) {
  try {
    const mutationId = process.argv[2] as ComponentMutationId;
    if (!mutationId) throw new Error('Component mutation id is required');
    const result = runComponentMutationProbe(mutationId);
    process.stdout.write(`${RESULT_MARKER}${JSON.stringify(result)}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}
