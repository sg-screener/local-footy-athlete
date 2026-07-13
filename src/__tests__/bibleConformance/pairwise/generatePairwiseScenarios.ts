import { DeterministicRandom, DEFAULT_EXTENDED_SEED } from '../generated/deterministicGenerator';
import type { PairwiseCoverageResult, PairwiseScenario } from '../types';

type DimensionKey = Exclude<keyof PairwiseScenario, 'id' | 'seed' | 'referenceDate' | 'timezone'>;

const DIMENSIONS: { key: DimensionKey; values: readonly (string | number)[] }[] = [
  { key: 'phase', values: ['in_season', 'early_offseason', 'mid_offseason', 'late_offseason', 'early_preseason', 'later_preseason'] },
  { key: 'game', values: ['none', 'saturday', 'sunday', 'bye'] },
  { key: 'teamSessions', values: [0, 1, 2] },
  { key: 'availability', values: [2, 3, 4, 6] },
  { key: 'experience', values: ['beginner', 'experienced'] },
  { key: 'readiness', values: ['low', 'normal', 'high'] },
  { key: 'restriction', values: ['none', 'upper', 'hamstring'] },
  { key: 'equipment', values: ['minimal', 'home', 'commercial'] },
  { key: 'role', values: ['inside', 'outside'] },
  { key: 'goal', values: ['strength', 'speed_conditioning'] },
  { key: 'duration', values: ['short', 'normal', 'long'] },
];

function pairKey(aKey: string, aValue: unknown, bKey: string, bValue: unknown): string {
  return `${aKey}=${String(aValue)}|${bKey}=${String(bValue)}`;
}

function allRequiredPairs(): Set<string> {
  const pairs = new Set<string>();
  for (let left = 0; left < DIMENSIONS.length; left++) {
    for (let right = left + 1; right < DIMENSIONS.length; right++) {
      for (const a of DIMENSIONS[left].values) {
        for (const b of DIMENSIONS[right].values) {
          pairs.add(pairKey(DIMENSIONS[left].key, a, DIMENSIONS[right].key, b));
        }
      }
    }
  }
  return pairs;
}

function pairsFor(row: Record<string, string | number>): string[] {
  const pairs: string[] = [];
  for (let left = 0; left < DIMENSIONS.length; left++) {
    for (let right = left + 1; right < DIMENSIONS.length; right++) {
      pairs.push(pairKey(
        DIMENSIONS[left].key, row[DIMENSIONS[left].key],
        DIMENSIONS[right].key, row[DIMENSIONS[right].key],
      ));
    }
  }
  return pairs;
}

function candidateRows(seed: string): Record<string, string | number>[] {
  const random = new DeterministicRandom(`${seed}:pairwise`);
  const rows: Record<string, string | number>[] = [];
  for (let left = 0; left < DIMENSIONS.length; left++) {
    for (let right = left + 1; right < DIMENSIONS.length; right++) {
      for (const a of DIMENSIONS[left].values) {
        for (const b of DIMENSIONS[right].values) {
          const row: Record<string, string | number> = {};
          for (const dimension of DIMENSIONS) row[dimension.key] = random.pick(dimension.values);
          row[DIMENSIONS[left].key] = a;
          row[DIMENSIONS[right].key] = b;
          rows.push(row);
        }
      }
    }
  }
  return rows;
}

function signature(row: Record<string, string | number>): string {
  return DIMENSIONS.map((dimension) => `${dimension.key}:${row[dimension.key]}`).join(';');
}

export function generatePairwiseScenarios(seed = DEFAULT_EXTENDED_SEED): PairwiseCoverageResult {
  const required = allRequiredPairs();
  const uncovered = new Set(required);
  const candidates = Array.from(new Map(candidateRows(seed).map((row) => [signature(row), row])).values());
  const selected: Record<string, string | number>[] = [];

  while (uncovered.size > 0) {
    let winner: Record<string, string | number> | null = null;
    let best = -1;
    for (const candidate of candidates) {
      const score = pairsFor(candidate).filter((pair) => uncovered.has(pair)).length;
      if (score > best || (score === best && winner && signature(candidate) < signature(winner))) {
        winner = candidate;
        best = score;
      }
    }
    if (!winner || best <= 0) break;
    selected.push(winner);
    for (const pair of pairsFor(winner)) uncovered.delete(pair);
    candidates.splice(candidates.indexOf(winner), 1);
  }

  // Keep the matrix inside the requested 40–80 witness range. Extra rows are
  // deterministic witnesses, not random padding, and preserve 100% pair cover.
  for (const candidate of candidates) {
    if (selected.length >= 40) break;
    selected.push(candidate);
  }

  const scenarios = selected.map((row, index) => ({
    id: `pairwise-${String(index + 1).padStart(2, '0')}`,
    seed,
    referenceDate: '2026-03-23' as const,
    timezone: 'Australia/Melbourne' as const,
    ...row,
  })) as PairwiseScenario[];
  const covered = new Set(scenarios.flatMap((scenario) => pairsFor(scenario as unknown as Record<string, string | number>)));
  const coveredPairs = Array.from(required).filter((pair) => covered.has(pair)).length;
  return {
    scenarios,
    coveredPairs,
    totalPairs: required.size,
    percentage: Number(((coveredPairs / required.size) * 100).toFixed(2)),
    unsupported: [
      'Off-season game anchors are retained as inputs but generation correctly treats off-season as no competition game.',
      'Bye is represented as an explicit absence of the usual game anchor; it is not combined with a same-week game.',
    ],
  };
}
