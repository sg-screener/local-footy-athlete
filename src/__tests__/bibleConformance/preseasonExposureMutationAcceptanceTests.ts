import path from 'node:path';
import { spawnSync } from 'node:child_process';
import type { MutationGateResult } from './types';
import {
  PRESEASON_EXPOSURE_MUTATION_IDS,
  type PreseasonExposureMutationId,
} from './mutations/preseasonExposureMutationProbe';

const RESULT_MARKER = 'BIBLE_PRESEASON_EXPOSURE_MUTATION_RESULT ';

export function runPreseasonExposureMutationAcceptanceTests(): MutationGateResult[] {
  const probe = path.join(__dirname, 'mutations', 'preseasonExposureMutationProbe.ts');
  return PRESEASON_EXPOSURE_MUTATION_IDS.map((mutationId: PreseasonExposureMutationId) => {
    const child = spawnSync(process.execPath, ['-r', 'sucrase/register', probe, mutationId], {
      cwd: path.resolve(__dirname, '../../..'),
      encoding: 'utf8',
      timeout: 20_000,
      env: { ...process.env, TZ: 'Australia/Melbourne' },
    });
    if (child.error) throw child.error;
    if (child.status !== 0) {
      throw new Error(`${mutationId} probe failed (${child.status}):\n${child.stderr || child.stdout}`);
    }
    const marker = child.stdout.split(/\r?\n/).find((line) => line.startsWith(RESULT_MARKER));
    if (!marker) throw new Error(`${mutationId} probe produced no result marker:\n${child.stdout}`);
    const result = JSON.parse(marker.slice(RESULT_MARKER.length)) as MutationGateResult;
    if (!result.killed || !result.active || !result.restored || result.id !== mutationId) {
      throw new Error(`${mutationId} proof incomplete: ${JSON.stringify(result)}`);
    }
    return result;
  });
}
