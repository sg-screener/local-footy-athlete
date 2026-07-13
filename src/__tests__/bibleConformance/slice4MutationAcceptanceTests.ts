import path from 'node:path';
import { spawnSync } from 'node:child_process';
import type { Slice4MutationAcceptanceResult, Slice4MutationId } from './types';

const RESULT_MARKER = 'BIBLE_SLICE4_MUTATION_RESULT ';
export const SLICE4_MUTATION_IDS: readonly Slice4MutationId[] = [
  'ai_drops_conditioning', 'rebuild_joins_by_weekday', 'repeat_drops_conditioning',
  'move_replaces_plan_id', 'swap_keeps_destination_ids', 'rehydrate_drops_second_pattern',
  'workout_type_overwrites_components', 'stale_name_restores_pattern',
  'second_hydration_mutates', 'coach_bike_stays_strength_row',
  'contrast_survives_lift_removal', 'post_rehydrate_rebuild_drops_component',
  'rowerg_creates_pull_credit', 'skierg_tempo_gains_pullups',
  'standalone_conditioning_becomes_mixed', 'warmup_becomes_conditioning_headline',
  'modern_no_strength_overwritten', 'rehydrate_reintroduces_standalone_strength',
];

export function runSlice4MutationAcceptanceTests(): Slice4MutationAcceptanceResult[] {
  const probe = path.join(__dirname, 'mutations', 'slice4MutationProbe.ts');
  return SLICE4_MUTATION_IDS.map((mutationId) => {
    const child = spawnSync(process.execPath, ['-r', 'sucrase/register', probe, mutationId], {
      cwd: path.resolve(__dirname, '../../..'), encoding: 'utf8', timeout: 20_000,
      env: { ...process.env, TZ: 'Australia/Melbourne' },
    });
    if (child.error) throw child.error;
    if (child.status !== 0) throw new Error(`${mutationId} probe failed (${child.status}):\n${child.stderr || child.stdout}`);
    const marker = child.stdout.split(/\r?\n/).find((line) => line.startsWith(RESULT_MARKER));
    if (!marker) throw new Error(`${mutationId} probe produced no result marker:\n${child.stdout}`);
    const result = JSON.parse(marker.slice(RESULT_MARKER.length)) as Slice4MutationAcceptanceResult;
    if (!result.killed || !result.mutationActive || !result.restored || result.mutationId !== mutationId) {
      throw new Error(`${mutationId} proof incomplete: ${JSON.stringify(result)}`);
    }
    return result;
  });
}
