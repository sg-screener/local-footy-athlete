/**
 * The readiness acknowledgment claims only what the COMMITTED result did.
 *
 * Launch audit 2026-08-25, finding #8: a record-only "bit tired" report was
 * acknowledged with "Your week's adjusted to match" — a sentence about an
 * adjustment that did not happen. The module's own schedule-door half already
 * states the law ("a signed sentence must never claim a state-dependent
 * outcome"; the effect clause is "selected by the COMMITTED result, never by
 * the door alone") — these cells hold the readiness half to it.
 *
 * Run: npm run test:readiness-acknowledgment
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
armTotalsOrRed();
import { buildReadinessAcknowledgment } from '../utils/readinessAcknowledgment';

let passes = 0;
const failures: string[] = [];

function run(name: string, body: () => void): void {
  try {
    body();
    passes += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`  FAIL ${name}: ${(error as Error).message}`);
  }
}

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

run('a record-only report is acknowledged without claiming an adjustment', () => {
  const ack = buildReadinessAcknowledgment({ ok: true, changedProgram: false });
  assert(ack && ack.tone === 'success', 'record-only success must still acknowledge');
  assert(!/adjust/i.test(ack.message),
    `the record-only ack claims an adjustment that did not happen: "${ack.message}"`);
});

run('a program-changing report may say the week adjusted', () => {
  const ack = buildReadinessAcknowledgment({ ok: true, changedProgram: true });
  assert(ack && ack.tone === 'success' && /adjust/i.test(ack.message),
    `a changed program should be told to the athlete: "${ack?.message}"`);
});

run('a program-changing report with an authored disclosure keeps the disclosure', () => {
  const ack = buildReadinessAcknowledgment({
    ok: true,
    changedProgram: true,
    message: 'The report is active and the visible program was safely recomposed.',
  });
  assert(ack?.message === 'The report is active and the visible program was safely recomposed.',
    `the authored disclosure was replaced: "${ack?.message}"`);
});

run('a failed report is acknowledged as an error, never silence', () => {
  const ack = buildReadinessAcknowledgment({ ok: false });
  assert(ack && ack.tone === 'error' && ack.message.trim().length > 0,
    'a failure must be acknowledged honestly');
});

console.log(`\n${passes} passed, ${failures.length} failed`);
totalsPrinted(failures.length);
if (failures.length > 0) process.exit(1);
process.exit(0);
