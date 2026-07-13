import path from 'node:path';
import { spawnSync } from 'node:child_process';
import type { Slice3MutationAcceptanceResult, Slice3MutationId } from './types';

const RESULT_MARKER = 'BIBLE_SLICE3_MUTATION_RESULT ';

export const SLICE3_MUTATION_IDS: readonly Slice3MutationId[] = [
  'early_power_survives',
  'contrast_without_heavy',
  'offfeet_reported_running',
  'drop_second_modality',
  'mixed_strength_fatigue_zero',
  'team_false_squat_credit',
  'g2_heavy_survives',
  'constraint_drops_unrelated',
  'equipment_incompatible_survives',
  'trunk_creates_conditioning',
];

export function runSlice3MutationAcceptanceTests(): Slice3MutationAcceptanceResult[] {
  const probe = path.join(__dirname, 'mutations', 'slice3MutationProbe.ts');
  return SLICE3_MUTATION_IDS.map((mutationId) => {
    const child = spawnSync(process.execPath, ['-r', 'sucrase/register', probe, mutationId], {
      cwd: path.resolve(__dirname, '../../..'),
      encoding: 'utf8',
      timeout: 12_000,
      env: { ...process.env, TZ: 'Australia/Melbourne' },
    });
    if (child.error) throw child.error;
    if (child.status !== 0) {
      throw new Error(`${mutationId} probe failed (${child.status}):\n${child.stderr || child.stdout}`);
    }
    const marker = child.stdout.split(/\r?\n/).find((line) => line.startsWith(RESULT_MARKER));
    if (!marker) throw new Error(`${mutationId} probe produced no result marker:\n${child.stdout}`);
    const result = JSON.parse(marker.slice(RESULT_MARKER.length)) as Slice3MutationAcceptanceResult;
    if (!result.killed || !result.mutationActive || !result.restored || result.mutationId !== mutationId) {
      throw new Error(`${mutationId} proof incomplete: ${JSON.stringify(result)}`);
    }
    return result;
  });
}
