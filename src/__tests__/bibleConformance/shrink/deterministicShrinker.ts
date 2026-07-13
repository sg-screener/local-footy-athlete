import type { GeneratedPropertyCase } from '../types';

export interface ShrinkResult {
  original: GeneratedPropertyCase;
  minimal: GeneratedPropertyCase;
  attempts: number;
  reduced: boolean;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function candidates(input: GeneratedPropertyCase): GeneratedPropertyCase[] {
  const output: GeneratedPropertyCase[] = [];
  const data = input.data;
  const optionalKeys = ['duration', 'gameDay', 'goal', 'role', 'phase', 'readiness'];
  for (const key of optionalKeys) {
    if (!(key in data)) continue;
    const next = clone(input);
    delete next.data[key];
    output.push(next);
  }
  for (const key of ['restrictions', 'equipmentChanges', 'components', 'planned', 'effective', 'modalities', 'operations']) {
    const values = data[key];
    if (!Array.isArray(values) || values.length <= 1) continue;
    for (let size = values.length - 1; size >= 1; size--) {
      const next = clone(input);
      next.data[key] = values.slice(0, size);
      output.push(next);
    }
  }
  const baselines: Record<string, unknown> = {
    restriction: 'none', equipment: 'commercial', readiness: 'normal',
    availability: 5, teamSessions: 0, game: 'none', duration: 'normal',
  };
  for (const [key, value] of Object.entries(baselines)) {
    if (!(key in data) || data[key] === value) continue;
    const next = clone(input);
    next.data[key] = value;
    output.push(next);
  }
  return output;
}

/** Stable, bounded first-improvement shrinker. Predicate is true while the same failure persists. */
export function shrinkGeneratedFailure(
  original: GeneratedPropertyCase,
  stillFails: (candidate: GeneratedPropertyCase) => boolean,
  maxAttempts = 100,
): ShrinkResult {
  let current = clone(original);
  let attempts = 0;
  let improved = true;
  while (improved && attempts < maxAttempts) {
    improved = false;
    for (const candidate of candidates(current)) {
      attempts++;
      if (attempts > maxAttempts) break;
      if (!stillFails(candidate)) continue;
      current = candidate;
      improved = true;
      break;
    }
  }
  return {
    original: clone(original), minimal: current, attempts,
    reduced: JSON.stringify(original.data) !== JSON.stringify(current.data),
  };
}

export function verifyShrinkerAcceptance(): ShrinkResult {
  const original: GeneratedPropertyCase = {
    id: 'component-shrinker-proof', seed: '20260323', domain: 'components',
    referenceDate: '2026-03-23', timezone: 'Australia/Melbourne',
    data: {
      components: ['strength', 'conditioning', 'trunk_support', 'recovery'],
      restrictions: ['hamstring', 'upper'], equipmentChanges: ['commercial', 'home'],
      operations: ['add_conditioning', 'add_support', 'rebuild'], duration: 'long', gameDay: 6,
    },
  };
  const result = shrinkGeneratedFailure(original, (candidate) => {
    const components = candidate.data.components;
    return Array.isArray(components) && components.includes('strength') && components.includes('conditioning');
  });
  if (!result.reduced) throw new Error('Deterministic shrinker did not reduce the synthetic witness');
  const minimalComponents = result.minimal.data.components as string[];
  if (minimalComponents.length !== 2 || !minimalComponents.includes('strength') || !minimalComponents.includes('conditioning')) {
    throw new Error(`Deterministic shrinker lost the failure cause: ${JSON.stringify(result.minimal.data)}`);
  }
  return result;
}
