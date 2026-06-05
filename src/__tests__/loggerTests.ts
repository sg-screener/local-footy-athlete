/**
 * loggerTests — release logging gates.
 *
 * Run: npm run test:logger
 */

import { createLogger, shouldEmitLog } from '../utils/logger';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  \u2713 ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  \u2717 ${name}${detail ? '\n      ' + detail : ''}`);
  }
}

function section(label: string) {
  console.log(`\n${label}`);
}

function makeSink() {
  const calls: Array<{ level: 'log' | 'warn' | 'error'; args: unknown[] }> = [];
  return {
    calls,
    sink: {
      log: (...args: unknown[]) => calls.push({ level: 'log', args }),
      warn: (...args: unknown[]) => calls.push({ level: 'warn', args }),
      error: (...args: unknown[]) => calls.push({ level: 'error', args }),
    },
  };
}

section('[1] production gate');
{
  ok('debug suppressed in production', !shouldEmitLog('debug', { isDev: false }));
  ok('info suppressed in production', !shouldEmitLog('info', { isDev: false }));
  ok('warn emitted in production', shouldEmitLog('warn', { isDev: false }));
  ok('error emitted in production', shouldEmitLog('error', { isDev: false }));
}

section('[2] explicit debug override');
{
  ok(
    'debug emitted when public flag enabled',
    shouldEmitLog('debug', { isDev: false, enableDebugLogs: true }),
  );
}

section('[3] logger sink behavior');
{
  const { calls, sink } = makeSink();
  const log = createLogger({ isDev: false, sink });
  log.debug('hidden');
  log.info('hidden');
  log.warn('visible-warn');
  log.error('visible-error');
  ok('only warn/error emitted', calls.length === 2, JSON.stringify(calls));
  ok('warn used warn sink', calls[0]?.level === 'warn');
  ok('error used error sink', calls[1]?.level === 'error');
}

section('[4] dev behavior stays quiet unless explicitly enabled');
{
  const { calls, sink } = makeSink();
  const log = createLogger({ isDev: true, sink });
  log.debug('hidden-debug');
  log.info('hidden-info');
  ok('debug/info suppressed in normal dev', calls.length === 0, JSON.stringify(calls));
}

section('[5] explicit dev debug behavior');
{
  const { calls, sink } = makeSink();
  const log = createLogger({ isDev: true, enableDebugLogs: true, sink });
  log.debug('visible-debug');
  log.info('visible-info');
  ok('debug/info emitted with debug flag', calls.length === 2, JSON.stringify(calls));
  ok('debug/info use log sink', calls.every((c) => c.level === 'log'));
}

console.log(`\n— Summary —`);
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);
if (fail > 0) {
  console.log(`\n— Failures —`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
process.exit(0);
