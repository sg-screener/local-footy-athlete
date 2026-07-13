import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { MUTATION_CATALOGUE } from './registry/mutationCatalogue';
import type { MutationGateResult } from './types';

const RESULT_MARKER = 'BIBLE_SLICE5_MUTATION_RESULT ';

export function runSlice5MutationAcceptanceTests(): MutationGateResult[] {
  const probe = path.join(__dirname, 'mutations', 'slice5MutationProbe.ts');
  return MUTATION_CATALOGUE.filter((entry) => entry.tier === 'full').map((spec) => {
    const child = spawnSync(process.execPath, ['-r', 'sucrase/register', probe, spec.id], {
      cwd: path.resolve(__dirname, '../../..'), encoding: 'utf8', timeout: 20_000,
      env: { ...process.env, TZ: 'Australia/Melbourne' },
    });
    if (child.error) throw child.error;
    if (child.status !== 0) throw new Error(`${spec.id} probe failed (${child.status}):\n${child.stderr || child.stdout}`);
    const marker = child.stdout.split(/\r?\n/).find((line) => line.startsWith(RESULT_MARKER));
    if (!marker) throw new Error(`${spec.id} probe produced no result marker:\n${child.stdout}`);
    const result = JSON.parse(marker.slice(RESULT_MARKER.length)) as MutationGateResult;
    if (!result.active || !result.killed || !result.restored || result.id !== spec.id) {
      throw new Error(`${spec.id} mutation proof incomplete: ${JSON.stringify(result)}`);
    }
    return result;
  });
}
