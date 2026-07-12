import path from 'node:path';
import { spawnSync } from 'node:child_process';
import type { MutationAcceptanceResult } from './types';

const RESULT_MARKER = 'BIBLE_MUTATION_RESULT ';

/** Run the deliberate fault in an isolated module cache/process. */
export function runMutationAcceptanceTest(): MutationAcceptanceResult {
  const probe = path.join(__dirname, 'mutations', 'compositeIntentCollapseProbe.ts');
  const child = spawnSync(
    process.execPath,
    ['-r', 'sucrase/register', probe],
    {
      cwd: path.resolve(__dirname, '../../..'),
      encoding: 'utf8',
      timeout: 10_000,
      env: { ...process.env, TZ: 'Australia/Melbourne' },
    },
  );
  if (child.error) throw child.error;
  if (child.status !== 0) {
    throw new Error(`Composite-collapse mutation probe failed (${child.status}):\n${child.stderr || child.stdout}`);
  }
  const markerLine = child.stdout.split(/\r?\n/).find((line) => line.startsWith(RESULT_MARKER));
  if (!markerLine) {
    throw new Error(`Mutation probe produced no result marker:\n${child.stdout}`);
  }
  const result = JSON.parse(markerLine.slice(RESULT_MARKER.length)) as MutationAcceptanceResult;
  if (!result.killed || !result.mutationActive || !result.restored) {
    throw new Error(`Mutation acceptance proof incomplete: ${JSON.stringify(result)}`);
  }
  return result;
}
