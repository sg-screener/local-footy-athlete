import path from 'node:path';
import { spawnSync } from 'node:child_process';
import type {
  ComponentMutationAcceptanceResult,
  ComponentMutationId,
} from './types';

const RESULT_MARKER = 'BIBLE_COMPONENT_MUTATION_RESULT ';

export const COMPONENT_MUTATION_IDS: readonly ComponentMutationId[] = [
  'drop_mixed_conditioning',
  'drop_team_strength',
  'trunk_as_conditioning',
  'accessory_main_credit',
  'full_body_extra_lower',
];

export function runComponentMutationAcceptanceTests(): ComponentMutationAcceptanceResult[] {
  const probe = path.join(__dirname, 'mutations', 'componentMutationProbe.ts');
  return COMPONENT_MUTATION_IDS.map((mutationId) => {
    const child = spawnSync(
      process.execPath,
      ['-r', 'sucrase/register', probe, mutationId],
      {
        cwd: path.resolve(__dirname, '../../..'),
        encoding: 'utf8',
        timeout: 12_000,
        env: { ...process.env, TZ: 'Australia/Melbourne' },
      },
    );
    if (child.error) throw child.error;
    if (child.status !== 0) {
      throw new Error(`${mutationId} probe failed (${child.status}):\n${child.stderr || child.stdout}`);
    }
    const marker = child.stdout.split(/\r?\n/).find((line) => line.startsWith(RESULT_MARKER));
    if (!marker) throw new Error(`${mutationId} probe produced no result marker:\n${child.stdout}`);
    const result = JSON.parse(marker.slice(RESULT_MARKER.length)) as ComponentMutationAcceptanceResult;
    if (!result.killed || !result.mutationActive || !result.restored || result.mutationId !== mutationId) {
      throw new Error(`${mutationId} proof incomplete: ${JSON.stringify(result)}`);
    }
    return result;
  });
}
