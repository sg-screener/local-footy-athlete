/** Real generated-session and modality-swap display routes. */
(global as unknown as { __DEV__: boolean }).__DEV__ = false;
const durable = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => durable.get(key) ?? null,
    setItem: (key: string, value: string) => { durable.set(key, value); },
    removeItem: (key: string) => { durable.delete(key); },
    clear: () => { durable.clear(); },
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — conditioning intensity is deterministic');
};
process.env.TZ = 'Australia/Melbourne';

/* eslint-disable import/first */
import { conditioningClarity } from './support/conditioningClarity';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
armTotalsOrRed();

let passed = 0;
let failed = 0;
function check(label: string, value: boolean, detail?: string): void {
  if (value) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

async function main(): Promise<void> {
  await conditioningClarity(durable, check);
  console.log(`conditioning intensity routes: ${passed} passed, ${failed} failed`);
  totalsPrinted(failed);
  console.log('NOT COVERED: native layout/glass, physical phones, and legacy conditioning rows with no typed modality.');
  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
